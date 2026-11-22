# Builds tools/recorder/dist/ForzaPaddockRecorder.exe with the C# compiler that ships with Windows
# (.NET Framework 4.x), so the program runs on any Windows 10/11 without installing anything.
#   powershell -ExecutionPolicy Bypass -File tools/recorder/build.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $here 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw 'C# compiler not found (.NET Framework 4.x).' }

# The icon comes from the site's favicon (needs the repo's node_modules).
node (Join-Path $here 'make-icon.mjs')

$exe = Join-Path $dist 'ForzaPaddockRecorder.exe'
$ico = Join-Path $dist 'icon.ico'
$src = Join-Path $here 'Program.cs'
& $csc /nologo /optimize+ /target:winexe /platform:anycpu "/out:$exe" "/win32icon:$ico" `
  /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll $src
if ($LASTEXITCODE -ne 0) { throw "csc failed ($LASTEXITCODE)" }
Write-Host "Built $(Join-Path $dist 'ForzaPaddockRecorder.exe')"
