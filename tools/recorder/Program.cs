// Forza Paddock Recorder: records Forza Horizon "Data Out" telemetry and marks points of interest
// (barn finds, treasure cars, landmarks, track references) with a hotkey, for the Forza Paddock
// site (ADR-0021, ADR-0024). It only listens on this PC: nothing is sent anywhere.
//
// Built with the C# 5 compiler that ships with Windows (.NET Framework 4.x): see build.ps1.
// Recording format matches `pnpm telemetry:record` (pipeline/telemetry/record.ts): per packet a
// float64 time (ms since start), a uint16 length, then the packet bytes.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Media;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Forza Paddock Recorder")]
[assembly: System.Reflection.AssemblyProduct("Forza Paddock Recorder")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace ForzaPaddock
{
    /// <summary>One telemetry reading (the "Dash" layout, 324 bytes).</summary>
    public class Reading
    {
        public bool RaceOn;
        public float X, Y, Z, Speed, Yaw;
        public DateTime At;

        public static Reading Parse(byte[] p, int n)
        {
            if (n < 268) return null;
            Reading r = new Reading();
            r.RaceOn = BitConverter.ToInt32(p, 0) != 0;
            r.Yaw = BitConverter.ToSingle(p, 56);
            r.X = BitConverter.ToSingle(p, 244);
            r.Y = BitConverter.ToSingle(p, 248);
            r.Z = BitConverter.ToSingle(p, 252);
            r.Speed = BitConverter.ToSingle(p, 256);
            r.At = DateTime.Now;
            return r;
        }

        /// <summary>Menus and pauses send zeroed packets: those carry no position.</summary>
        public bool HasPosition { get { return RaceOn && (X != 0 || Z != 0); } }
    }

    /// <summary>A marked point.</summary>
    public class Mark
    {
        public DateTime At;
        public string Category;
        public string Note = "";
        public float X, Y, Z, YawDeg, Kmh;
        /// <summary>How old the position was when marked (seconds): above 0 means it came from before a menu.</summary>
        public double AgeSec;
    }

    /// <summary>Listens to the game's UDP packets and, when asked, records them.</summary>
    public class Telemetry : IDisposable
    {
        readonly object gate = new object();
        UdpClient udp;
        Thread thread;
        volatile bool running;
        FileStream file;
        DateTime recordStart;
        long packets, recorded;
        Reading last, lastWithPosition;
        readonly Queue<DateTime> recent = new Queue<DateTime>();

        public string RecordingPath { get; private set; }

        public void Start(int port)
        {
            udp = new UdpClient(new IPEndPoint(IPAddress.Any, port));
            udp.Client.ReceiveTimeout = 500;
            running = true;
            thread = new Thread(Loop);
            thread.IsBackground = true;
            thread.Start();
        }

        void Loop()
        {
            IPEndPoint from = new IPEndPoint(IPAddress.Any, 0);
            while (running)
            {
                byte[] data;
                try { data = udp.Receive(ref from); }
                catch (SocketException) { continue; }
                catch (ObjectDisposedException) { return; }
                Reading r = Reading.Parse(data, data.Length);
                lock (gate)
                {
                    packets++;
                    recent.Enqueue(DateTime.Now);
                    while (recent.Count > 0 && (DateTime.Now - recent.Peek()).TotalSeconds > 1) recent.Dequeue();
                    if (r != null)
                    {
                        last = r;
                        if (r.HasPosition) lastWithPosition = r;
                    }
                    if (file != null)
                    {
                        double ms = (DateTime.Now - recordStart).TotalMilliseconds;
                        file.Write(BitConverter.GetBytes(ms), 0, 8);
                        file.Write(BitConverter.GetBytes((ushort)data.Length), 0, 2);
                        file.Write(data, 0, data.Length);
                        recorded++;
                    }
                }
            }
        }

        public void Snapshot(out Reading now, out Reading withPosition, out long total, out int perSecond, out long saved)
        {
            lock (gate)
            {
                now = last;
                withPosition = lastWithPosition;
                total = packets;
                perSecond = recent.Count;
                saved = recorded;
            }
        }

        public void StartRecording(string path)
        {
            lock (gate)
            {
                StopRecording();
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                file = new FileStream(path, FileMode.CreateNew, FileAccess.Write);
                recordStart = DateTime.Now;
                recorded = 0;
                RecordingPath = path;
            }
        }

        public void StopRecording()
        {
            lock (gate)
            {
                if (file != null) { file.Flush(); file.Dispose(); file = null; }
            }
        }

        public bool Recording { get { lock (gate) { return file != null; } } }

        public void Dispose()
        {
            running = false;
            StopRecording();
            if (udp != null) udp.Close();
        }
    }

    /// <summary>Texts in Portuguese (Brazil) or English, by the Windows language.</summary>
    public static class T
    {
        public static readonly bool Pt = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "pt";
        public static string S(string pt, string en) { return Pt ? pt : en; }

        public static readonly string[] CategoryKeys = {
            "barn-find", "treasure-car", "aftermarket", "house", "landmark", "mascot", "bonus-board",
            "track-reference", "other" };

        public static string Category(string key)
        {
            switch (key)
            {
                case "barn-find": return S("Celeiro", "Barn find");
                case "treasure-car": return S("Carro tesouro", "Treasure car");
                case "aftermarket": return S("Carro aftermarket", "Aftermarket car");
                case "house": return S("Casa", "House");
                case "landmark": return S("Landmark / ponto turístico", "Landmark");
                case "mascot": return S("Mascote", "Mascot");
                case "bonus-board": return S("Placa de bônus", "Bonus board");
                case "track-reference": return S("Referência de pista", "Track reference");
                default: return S("Outro", "Other");
            }
        }

        public static string CategoryKey(string label)
        {
            foreach (string k in CategoryKeys) if (Category(k) == label) return k;
            return "other";
        }

        public static string Help()
        {
            return S(
"COMO LIGAR A TELEMETRIA DO JOGO (sem SimHub)\r\n\r\n" +
"1. No Forza Horizon 6, abra Configurações › HUD e Jogabilidade e procure \"Data Out\" (Saída de dados), no fim da lista.\r\n" +
"2. Ligue o Data Out.\r\n" +
"3. Endereço IP (Data Out IP Address): 127.0.0.1 se o jogo roda neste PC.\r\n" +
"4. Porta (Data Out IP Port): a mesma porta deste programa (padrão 5300).\r\n" +
"5. Volte ao jogo e dirija: o quadro \"Telemetria\" deve mostrar dados chegando.\r\n\r\n" +
"NO XBOX OU NO PS5\r\n" +
"Use o IP deste PC (mostrado na janela, na linha \"IP deste PC\") no lugar de 127.0.0.1. O PC e o console precisam estar na mesma rede. Na primeira vez, o Windows pergunta se o programa pode usar a rede: permita em redes privadas.\r\n\r\n" +
"SE VOCÊ USA SIMHUB\r\n" +
"Só um programa pode ouvir cada porta. Deixe o jogo mandando para o SimHub e, no SimHub, ligue o repasse de UDP (UDP forwarding) para 127.0.0.1 numa outra porta, por exemplo 5301; use essa porta aqui.\r\n\r\n" +
"MARCAR UM PONTO\r\n" +
"Pare o carro em cima do que quer marcar (celeiro, carro, landmark, referência de pista) e aperte a tecla de marcar (padrão F8), mesmo com o jogo em primeiro plano. Um bipe confirma. Depois, na lista, escolha a categoria certa e escreva uma nota.\r\n\r\n" +
"ONDE FICAM OS ARQUIVOS\r\n" +
"Em Documentos\\Forza Paddock: as marcações em \"marcacoes\" (JSON e CSV) e as gravações em \"gravacoes\" (.bin). Mande esses arquivos para o Forza Paddock.\r\n\r\n" +
"O programa só escuta os dados do jogo neste PC. Não envia nada para a internet.",
"HOW TO TURN ON THE GAME'S TELEMETRY (no SimHub)\r\n\r\n" +
"1. In Forza Horizon 6, open Settings › HUD and Gameplay and find \"Data Out\", at the end of the list.\r\n" +
"2. Turn Data Out on.\r\n" +
"3. Data Out IP Address: 127.0.0.1 if the game runs on this PC.\r\n" +
"4. Data Out IP Port: the same port as this program (5300 by default).\r\n" +
"5. Go back to the game and drive: the \"Telemetry\" box should show data coming in.\r\n\r\n" +
"ON XBOX OR PS5\r\n" +
"Use this PC's IP (shown in the window, on the \"This PC's IP\" line) instead of 127.0.0.1. The PC and the console must be on the same network. The first time, Windows asks whether the program may use the network: allow it on private networks.\r\n\r\n" +
"IF YOU USE SIMHUB\r\n" +
"Only one program can listen on each port. Keep the game sending to SimHub and, in SimHub, turn on UDP forwarding to 127.0.0.1 on another port, for example 5301; use that port here.\r\n\r\n" +
"MARKING A POINT\r\n" +
"Stop the car on what you want to mark (barn find, car, landmark, track reference) and press the mark key (F8 by default), even with the game in front. A beep confirms. Then, in the list, pick the right category and write a note.\r\n\r\n" +
"WHERE THE FILES GO\r\n" +
"In Documents\\Forza Paddock: marks in \"marcacoes\" (JSON and CSV) and recordings in \"gravacoes\" (.bin). Send these files to Forza Paddock.\r\n\r\n" +
"The program only listens to the game's data on this PC. It sends nothing to the internet.");
        }
    }

    /// <summary>Settings kept in %APPDATA%\ForzaPaddockRecorder\settings.ini.</summary>
    public class Settings
    {
        public int Port = 5300;
        public string HotKey = "F8";
        public string Category = "barn-find";
        public bool OnTop = false;

        static string FilePath
        {
            get
            {
                return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "ForzaPaddockRecorder", "settings.ini");
            }
        }

        public static Settings Load()
        {
            Settings s = new Settings();
            try
            {
                foreach (string line in File.ReadAllLines(FilePath))
                {
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    string k = line.Substring(0, eq).Trim(), v = line.Substring(eq + 1).Trim();
                    if (k == "port") int.TryParse(v, out s.Port);
                    else if (k == "hotkey") s.HotKey = v;
                    else if (k == "category") s.Category = v;
                    else if (k == "ontop") s.OnTop = v == "1";
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            if (s.Port < 1 || s.Port > 65535) s.Port = 5300;
            return s;
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                File.WriteAllLines(FilePath, new[] {
                    "port=" + Port, "hotkey=" + HotKey, "category=" + Category, "ontop=" + (OnTop ? "1" : "0") });
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    /// <summary>Saves the session's marks as JSON and CSV after every change.</summary>
    public static class MarkFile
    {
        static string Esc(string s)
        {
            StringBuilder b = new StringBuilder();
            foreach (char c in s ?? "")
            {
                if (c == '"' || c == '\\') b.Append('\\').Append(c);
                else if (c == '\n') b.Append("\\n");
                else if (c == '\r') b.Append("\\r");
                else if (c == '\t') b.Append("\\t");
                else if (c < 32) b.AppendFormat("\\u{0:x4}", (int)c);
                else b.Append(c);
            }
            return b.ToString();
        }

        static string F(double v) { return v.ToString("0.###", CultureInfo.InvariantCulture); }

        public static void Save(string basePath, List<Mark> marks)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(basePath));
            StringBuilder json = new StringBuilder();
            json.Append("{\n  \"format\": \"forza-paddock-marks\",\n  \"version\": 1,\n");
            json.Append("  \"game\": \"Forza Horizon 6\",\n");
            json.Append("  \"coordinates\": \"game x, y (height), z in metres, from Data Out\",\n");
            json.Append("  \"marks\": [");
            for (int i = 0; i < marks.Count; i++)
            {
                Mark m = marks[i];
                json.Append(i == 0 ? "\n" : ",\n");
                json.AppendFormat("    {{ \"at\": \"{0}\", \"category\": \"{1}\", \"note\": \"{2}\", \"x\": {3}, \"y\": {4}, \"z\": {5}, \"yawDeg\": {6}, \"kmh\": {7}, \"positionAgeSec\": {8} }}",
                    m.At.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture), Esc(m.Category), Esc(m.Note),
                    F(m.X), F(m.Y), F(m.Z), F(m.YawDeg), F(m.Kmh), F(m.AgeSec));
            }
            json.Append(marks.Count > 0 ? "\n  ]\n}\n" : "]\n}\n");
            File.WriteAllText(basePath + ".json", json.ToString(), new UTF8Encoding(false));

            StringBuilder csv = new StringBuilder("at;category;note;x;y;z;yawDeg;kmh;positionAgeSec\r\n");
            foreach (Mark m in marks)
            {
                csv.AppendFormat("{0};{1};\"{2}\";{3};{4};{5};{6};{7};{8}\r\n",
                    m.At.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture), m.Category,
                    (m.Note ?? "").Replace("\"", "\"\""), F(m.X), F(m.Y), F(m.Z), F(m.YawDeg), F(m.Kmh), F(m.AgeSec));
            }
            File.WriteAllText(basePath + ".csv", csv.ToString(), new UTF8Encoding(true));
        }
    }

    public class MainForm : Form
    {
        [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint mods, uint vk);
        [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
        const int WM_HOTKEY = 0x0312, HOTKEY_ID = 0xF0D1;

        static readonly string Root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Forza Paddock");

        readonly Settings settings = Settings.Load();
        readonly List<Mark> marks = new List<Mark>();
        readonly string marksBase = Path.Combine(Root, "marcacoes",
            "marcacoes-" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss", CultureInfo.InvariantCulture));
        Telemetry telemetry;

        Label status, position, ipLine, recordInfo;
        NumericUpDown portBox;
        ComboBox hotkeyBox, categoryBox;
        TextBox routeBox;
        Button recordButton, markButton;
        CheckBox onTopBox;
        DataGridView grid;
        System.Windows.Forms.Timer timer;
        bool hotkeyOk;

        public MainForm()
        {
            Text = "Forza Paddock Recorder";
            Font = new Font("Segoe UI", 9.5f);
            MinimumSize = new Size(760, 560);
            Size = new Size(860, 640);
            StartPosition = FormStartPosition.CenterScreen;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (ArgumentException) { }
            TopMost = settings.OnTop;
            BuildUi();
            StartListening();
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 250;
            timer.Tick += delegate { RefreshStatus(); };
            timer.Start();
        }

        Label AddLabel(Control parent, string text, int x, int y, int w, bool bold)
        {
            Label l = new Label();
            l.Text = text;
            l.Location = new Point(x, y);
            l.Size = new Size(w, 22);
            if (bold) l.Font = new Font(Font, FontStyle.Bold);
            parent.Controls.Add(l);
            return l;
        }

        void BuildUi()
        {
            // Settings row.
            GroupBox setup = new GroupBox();
            setup.Text = T.S("Configuração", "Setup");
            setup.Location = new Point(12, 8);
            setup.Size = new Size(820, 64);
            setup.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            Controls.Add(setup);
            AddLabel(setup, T.S("Porta UDP:", "UDP port:"), 12, 27, 70, false);
            portBox = new NumericUpDown();
            portBox.Minimum = 1024; portBox.Maximum = 65535; portBox.Value = settings.Port;
            portBox.Location = new Point(84, 25); portBox.Width = 70;
            portBox.ValueChanged += delegate { settings.Port = (int)portBox.Value; settings.Save(); StartListening(); };
            setup.Controls.Add(portBox);
            AddLabel(setup, T.S("Tecla de marcar:", "Mark key:"), 172, 27, 100, false);
            hotkeyBox = new ComboBox();
            hotkeyBox.DropDownStyle = ComboBoxStyle.DropDownList;
            foreach (string k in new[] { "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Pause", "Insert" }) hotkeyBox.Items.Add(k);
            hotkeyBox.SelectedItem = settings.HotKey;
            if (hotkeyBox.SelectedIndex < 0) hotkeyBox.SelectedItem = "F8";
            hotkeyBox.Location = new Point(276, 24); hotkeyBox.Width = 80;
            hotkeyBox.SelectedIndexChanged += delegate { settings.HotKey = (string)hotkeyBox.SelectedItem; settings.Save(); RegisterKey(); };
            setup.Controls.Add(hotkeyBox);
            onTopBox = new CheckBox();
            onTopBox.Text = T.S("Sempre por cima", "Always on top");
            onTopBox.Checked = settings.OnTop;
            onTopBox.Location = new Point(374, 26); onTopBox.Width = 140;
            onTopBox.CheckedChanged += delegate { settings.OnTop = onTopBox.Checked; TopMost = onTopBox.Checked; settings.Save(); };
            setup.Controls.Add(onTopBox);
            Button help = new Button();
            help.Text = T.S("Como configurar o jogo", "How to set up the game");
            help.Location = new Point(520, 22); help.Size = new Size(180, 28);
            help.Click += delegate { ShowHelp(); };
            setup.Controls.Add(help);
            Button folder = new Button();
            folder.Text = T.S("Abrir pasta", "Open folder");
            folder.Location = new Point(706, 22); folder.Size = new Size(104, 28);
            folder.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            folder.Click += delegate { Directory.CreateDirectory(Root); System.Diagnostics.Process.Start("explorer.exe", "\"" + Root + "\""); };
            setup.Controls.Add(folder);

            // Telemetry status.
            GroupBox live = new GroupBox();
            live.Text = T.S("Telemetria", "Telemetry");
            live.Location = new Point(12, 78);
            live.Size = new Size(820, 92);
            live.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            Controls.Add(live);
            status = AddLabel(live, "", 12, 22, 790, true);
            status.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            position = AddLabel(live, "", 12, 44, 790, false);
            position.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            ipLine = AddLabel(live, T.S("IP deste PC (para Xbox/PS5): ", "This PC's IP (for Xbox/PS5): ") + LocalIps(), 12, 66, 790, false);
            ipLine.ForeColor = Color.DimGray;

            // Marking.
            GroupBox markBox = new GroupBox();
            markBox.Text = T.S("Marcar pontos", "Mark points");
            markBox.Location = new Point(12, 176);
            markBox.Size = new Size(820, 70);
            markBox.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            Controls.Add(markBox);
            AddLabel(markBox, T.S("Categoria da próxima marcação:", "Next mark's category:"), 12, 30, 200, false);
            categoryBox = new ComboBox();
            categoryBox.DropDownStyle = ComboBoxStyle.DropDownList;
            foreach (string k in T.CategoryKeys) categoryBox.Items.Add(T.Category(k));
            categoryBox.SelectedItem = T.Category(settings.Category);
            if (categoryBox.SelectedIndex < 0) categoryBox.SelectedIndex = 0;
            categoryBox.Location = new Point(214, 27); categoryBox.Width = 210;
            categoryBox.SelectedIndexChanged += delegate { settings.Category = T.CategoryKey((string)categoryBox.SelectedItem); settings.Save(); };
            markBox.Controls.Add(categoryBox);
            markButton = new Button();
            markButton.Location = new Point(440, 22); markButton.Size = new Size(370, 34);
            markButton.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            markButton.Font = new Font(Font, FontStyle.Bold);
            markButton.Click += delegate { AddMark(); };
            markBox.Controls.Add(markButton);

            // Recording.
            GroupBox rec = new GroupBox();
            rec.Text = T.S("Gravar a telemetria (para medir pistas)", "Record telemetry (to measure tracks)");
            rec.Location = new Point(12, 252);
            rec.Size = new Size(820, 64);
            rec.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            Controls.Add(rec);
            AddLabel(rec, T.S("Nome (opcional):", "Name (optional):"), 12, 27, 110, false);
            routeBox = new TextBox();
            routeBox.Location = new Point(124, 24); routeBox.Width = 200;
            rec.Controls.Add(routeBox);
            recordButton = new Button();
            recordButton.Location = new Point(334, 21); recordButton.Size = new Size(150, 30);
            recordButton.Click += delegate { ToggleRecording(); };
            rec.Controls.Add(recordButton);
            recordInfo = AddLabel(rec, "", 494, 27, 316, false);
            recordInfo.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

            // Marks list.
            Label listTitle = AddLabel(this, T.S("Marcações desta sessão (edite a categoria e a nota; tudo é salvo na hora)",
                "This session's marks (edit the category and note; everything saves at once)"), 14, 324, 800, true);
            listTitle.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            grid = new DataGridView();
            grid.Location = new Point(12, 348);
            grid.Size = new Size(820, 240);
            grid.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            grid.AllowUserToAddRows = false;
            grid.RowHeadersVisible = false;
            grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            grid.BackgroundColor = SystemColors.Window;
            DataGridViewTextBoxColumn time = new DataGridViewTextBoxColumn();
            time.HeaderText = T.S("Hora", "Time"); time.ReadOnly = true; time.FillWeight = 12;
            DataGridViewComboBoxColumn cat = new DataGridViewComboBoxColumn();
            cat.HeaderText = T.S("Categoria", "Category"); cat.FillWeight = 24;
            foreach (string k in T.CategoryKeys) cat.Items.Add(T.Category(k));
            DataGridViewTextBoxColumn note = new DataGridViewTextBoxColumn();
            note.HeaderText = T.S("Nota (ex.: nome do carro)", "Note (e.g. car name)"); note.FillWeight = 34;
            DataGridViewTextBoxColumn pos = new DataGridViewTextBoxColumn();
            pos.HeaderText = T.S("Posição (x, y, z)", "Position (x, y, z)"); pos.ReadOnly = true; pos.FillWeight = 30;
            grid.Columns.AddRange(new DataGridViewColumn[] { time, cat, note, pos });
            grid.CellValueChanged += GridChanged;
            grid.CurrentCellDirtyStateChanged += delegate { if (grid.IsCurrentCellDirty) grid.CommitEdit(DataGridViewDataErrorContexts.Commit); };
            grid.UserDeletingRow += delegate (object s, DataGridViewRowCancelEventArgs e) {
                int i = e.Row.Index;
                if (i >= 0 && i < marks.Count) { marks.RemoveAt(i); SaveMarks(); }
            };
            Controls.Add(grid);
            Label tip = AddLabel(this, T.S("Dica: selecione uma linha e aperte Delete para apagar uma marcação errada.",
                "Tip: select a row and press Delete to remove a wrong mark."), 14, 592, 800, false);
            tip.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;
            tip.ForeColor = Color.DimGray;
        }

        static string LocalIps()
        {
            List<string> ips = new List<string>();
            try
            {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up || ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    foreach (UnicastIPAddressInformation a in ni.GetIPProperties().UnicastAddresses)
                        if (a.Address.AddressFamily == AddressFamily.InterNetwork) ips.Add(a.Address.ToString());
                }
            }
            catch (NetworkInformationException) { }
            return ips.Count > 0 ? string.Join("  ·  ", ips.ToArray()) : "?";
        }

        void StartListening()
        {
            bool wasRecording = telemetry != null && telemetry.Recording;
            if (telemetry != null) telemetry.Dispose();
            telemetry = new Telemetry();
            try { telemetry.Start(settings.Port); }
            catch (SocketException)
            {
                telemetry = null;
                MessageBox.Show(this, string.Format(T.S(
                    "A porta {0} já está em uso por outro programa (por exemplo, o SimHub).\r\n\r\nEscolha outra porta aqui e, no jogo ou no repasse do SimHub, use a mesma.",
                    "Port {0} is already used by another program (SimHub, for example).\r\n\r\nPick another port here and use the same one in the game or in SimHub's forwarding."), settings.Port),
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            if (wasRecording) recordButton.PerformClick();
        }

        void RegisterKey()
        {
            UnregisterHotKey(Handle, HOTKEY_ID);
            Keys key;
            try { key = (Keys)Enum.Parse(typeof(Keys), settings.HotKey); } catch (ArgumentException) { key = Keys.F8; }
            hotkeyOk = RegisterHotKey(Handle, HOTKEY_ID, 0x4000 /* MOD_NOREPEAT */, (uint)key);
            markButton.Text = T.S("Marcar este ponto", "Mark this point") + "  (" + settings.HotKey + ")";
            if (!hotkeyOk)
                MessageBox.Show(this, string.Format(T.S(
                    "Não deu para usar a tecla {0}: outro programa já a usa. Escolha outra tecla.",
                    "Could not use the {0} key: another program already uses it. Pick another key."), settings.HotKey),
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            RegisterKey();
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID) AddMark();
            base.WndProc(ref m);
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            UnregisterHotKey(Handle, HOTKEY_ID);
            if (telemetry != null) telemetry.Dispose();
            base.OnFormClosed(e);
        }

        void RefreshStatus()
        {
            if (telemetry == null)
            {
                status.Text = T.S("Sem escuta: escolha uma porta livre.", "Not listening: pick a free port.");
                status.ForeColor = Color.Firebrick;
                return;
            }
            Reading now, withPos; long total; int perSec; long saved;
            telemetry.Snapshot(out now, out withPos, out total, out perSec, out saved);
            if (perSec == 0)
            {
                status.Text = total == 0
                    ? string.Format(T.S("Esperando dados do jogo na porta {0}… (veja \"Como configurar o jogo\")",
                        "Waiting for game data on port {0}… (see \"How to set up the game\")"), settings.Port)
                    : T.S("Os dados pararam de chegar (jogo fechado ou minimizado?).", "Data stopped coming in (game closed or minimised?).");
                status.ForeColor = Color.DarkOrange;
            }
            else if (now != null && !now.HasPosition)
            {
                status.Text = string.Format(T.S("Recebendo {0} pacotes/s · menu ou pausa: sem posição agora",
                    "Receiving {0} packets/s · menu or pause: no position right now"), perSec);
                status.ForeColor = Color.DarkOrange;
            }
            else
            {
                status.Text = string.Format(T.S("Recebendo {0} pacotes/s · tudo certo", "Receiving {0} packets/s · all good"), perSec);
                status.ForeColor = Color.ForestGreen;
            }
            position.Text = withPos == null
                ? T.S("Posição: ainda nenhuma (dirija um pouco)", "Position: none yet (drive a little)")
                : string.Format(CultureInfo.InvariantCulture, T.S("Posição: x {0:0.0}  ·  altura {1:0.0}  ·  z {2:0.0}  ·  {3:0} km/h", "Position: x {0:0.0}  ·  height {1:0.0}  ·  z {2:0.0}  ·  {3:0} km/h"),
                    withPos.X, withPos.Y, withPos.Z, withPos.Speed * 3.6);
            recordButton.Text = telemetry.Recording ? T.S("Parar de gravar", "Stop recording") : T.S("Começar a gravar", "Start recording");
            recordInfo.Text = telemetry.Recording
                ? string.Format(T.S("Gravando · {0:N0} pacotes", "Recording · {0:N0} packets"), saved)
                : (telemetry.RecordingPath != null ? T.S("Salvo em ", "Saved to ") + Path.GetFileName(telemetry.RecordingPath) : "");
        }

        void ToggleRecording()
        {
            if (telemetry == null) return;
            if (telemetry.Recording) { telemetry.StopRecording(); return; }
            string name = routeBox.Text.Trim().ToLowerInvariant();
            StringBuilder slug = new StringBuilder();
            foreach (char c in name) slug.Append(char.IsLetterOrDigit(c) && c < 128 ? c : '-');
            string n = slug.ToString().Trim('-');
            if (n.Length == 0) n = "volta";
            string path = Path.Combine(Root, "gravacoes",
                n + "-" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss", CultureInfo.InvariantCulture) + ".bin");
            telemetry.StartRecording(path);
        }

        void AddMark()
        {
            if (telemetry == null) return;
            Reading now, withPos; long total; int perSec; long saved;
            telemetry.Snapshot(out now, out withPos, out total, out perSec, out saved);
            if (withPos == null)
            {
                SystemSounds.Hand.Play();
                status.Text = T.S("Sem posição para marcar: dirija um pouco com o Data Out ligado.",
                    "No position to mark: drive a little with Data Out on.");
                return;
            }
            Mark m = new Mark();
            m.At = DateTime.Now;
            m.Category = settings.Category;
            m.X = withPos.X; m.Y = withPos.Y; m.Z = withPos.Z;
            m.YawDeg = (float)(withPos.Yaw * 180 / Math.PI);
            m.Kmh = withPos.Speed * 3.6f;
            m.AgeSec = Math.Round((DateTime.Now - withPos.At).TotalSeconds, 1);
            marks.Add(m);
            grid.Rows.Add(m.At.ToString("HH:mm:ss"), T.Category(m.Category), "",
                string.Format(CultureInfo.InvariantCulture, "{0:0.0}, {1:0.0}, {2:0.0}", m.X, m.Y, m.Z));
            grid.FirstDisplayedScrollingRowIndex = grid.Rows.Count - 1;
            SaveMarks();
            SystemSounds.Asterisk.Play();
        }

        void GridChanged(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || e.RowIndex >= marks.Count) return;
            object v = grid.Rows[e.RowIndex].Cells[e.ColumnIndex].Value;
            if (e.ColumnIndex == 1 && v != null) marks[e.RowIndex].Category = T.CategoryKey((string)v);
            if (e.ColumnIndex == 2) marks[e.RowIndex].Note = v == null ? "" : (string)v;
            SaveMarks();
        }

        void SaveMarks()
        {
            try { MarkFile.Save(marksBase, marks); }
            catch (IOException ex)
            {
                MessageBox.Show(this, T.S("Não deu para salvar as marcações: ", "Could not save the marks: ") + ex.Message,
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        void ShowHelp()
        {
            Form f = new Form();
            f.Text = T.S("Como configurar o jogo", "How to set up the game");
            f.Size = new Size(640, 560);
            f.StartPosition = FormStartPosition.CenterParent;
            f.Font = Font;
            TextBox box = new TextBox();
            box.Multiline = true; box.ReadOnly = true; box.ScrollBars = ScrollBars.Vertical;
            box.Dock = DockStyle.Fill; box.Text = T.Help(); box.BackColor = SystemColors.Window;
            box.Font = new Font("Segoe UI", 10f);
            f.Controls.Add(box);
            f.ShowDialog(this);
        }
    }

    public static class Program
    {
        [STAThread]
        public static int Main(string[] args)
        {
            if (args.Length >= 3 && args[0] == "--selftest") return SelfTest(int.Parse(args[1]), args[2]);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }

        /// <summary>
        /// Headless check used by the build: listen on a port, record what arrives for a few seconds,
        /// mark the last position and write a summary next to the files.
        /// </summary>
        static int SelfTest(int port, string dir)
        {
            Directory.CreateDirectory(dir);
            using (Telemetry t = new Telemetry())
            {
                t.Start(port);
                t.StartRecording(Path.Combine(dir, "selftest.bin"));
                Thread.Sleep(6000);
                t.StopRecording();
                Reading now, withPos; long total; int perSec; long saved;
                t.Snapshot(out now, out withPos, out total, out perSec, out saved);
                List<Mark> marks = new List<Mark>();
                if (withPos != null)
                {
                    Mark m = new Mark();
                    m.At = DateTime.Now; m.Category = "barn-find"; m.Note = "selftest \"quoted\"";
                    m.X = withPos.X; m.Y = withPos.Y; m.Z = withPos.Z;
                    m.YawDeg = (float)(withPos.Yaw * 180 / Math.PI); m.Kmh = withPos.Speed * 3.6f;
                    marks.Add(m);
                }
                MarkFile.Save(Path.Combine(dir, "selftest-marks"), marks);
                File.WriteAllText(Path.Combine(dir, "selftest.txt"), string.Format(CultureInfo.InvariantCulture,
                    "packets={0} recorded={1} position={2}\n", total, saved, withPos == null ? "none" :
                    string.Format(CultureInfo.InvariantCulture, "{0:0.0},{1:0.0},{2:0.0}", withPos.X, withPos.Y, withPos.Z)));
                return total > 0 ? 0 : 1;
            }
        }
    }
}
