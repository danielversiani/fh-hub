import type { Locale } from '../i18n';

/**
 * Text of the "Data use" page (owner's request, 2026-11-08, modelled on the topics of
 * fh6meta.com/legal, written in our own words). Long prose, so it lives here instead of the
 * i18n dictionaries. Keep both languages in sync.
 */
export interface LegalText {
  title: string;
  lead: string;
  notAdvice: string;
  updated: string;
  sections: { id: string; title: string; paragraphs: string[] }[];
  sourcesTitle: string;
  sourcesLead: string;
  status: Record<'granted' | 'prelaunch' | 'not-required', string>;
  requestsCta: string;
}

export const LEGAL: Record<Locale, LegalText> = {
  'pt-br': {
    title: 'Uso de dados',
    lead: 'O Forza Paddock é um projeto de fãs que reúne, organiza e compila informações públicas da comunidade de Forza Horizon. Esta página explica o que o site faz com essas informações, o que ele não reivindica e como pedir correções ou remoções.',
    notAdvice: 'Texto informativo; não é aconselhamento jurídico.',
    updated: 'Atualizado em 8 de novembro de 2026',
    sections: [
      {
        id: 'posse',
        title: 'Não reivindicamos a posse de nada',
        paragraphs: [
          'As planilhas, tunes, códigos de compartilhamento, observações, tempos de volta e textos exibidos aqui pertencem aos seus autores: Noa Miyako, kleis, K1Z Gray, LetzeLU, Wrong Hand Drive e os demais tunadores citados em cada tune.',
          'Forza, Forza Horizon, Xbox e Microsoft são marcas de seus donos. O Forza Paddock não tem afiliação com Microsoft, Xbox Game Studios ou Playground Games.',
        ],
      },
      {
        id: 'papel',
        title: 'O que o site faz',
        paragraphs: [
          'O objetivo é agregar e compilar informações que já são públicas, para que fique mais fácil encontrar e comparar tunes e carros. Para isso, o site padroniza nomes de carros, classes, pisos, pneus e tunadores, junta a mesma tune vista em mais de uma planilha, traduz observações e organiza tudo em listas e sugestões.',
          'Esse trabalho de organização é nosso, mas não transforma os dados dos autores em dados do Forza Paddock. O site é um atalho de consulta: a planilha original continua sendo a referência, com o texto, o contexto e as atualizações do próprio autor.',
        ],
      },
      {
        id: 'credito',
        title: 'Crédito e fonte original',
        paragraphs: [
          'Toda tune mostra o nome do tunador, e a página "Status das fontes" lista cada planilha com o link original. Os nomes e links existem para dar crédito e para você conferir a informação na fonte. Descrever o papel ou a cobertura de uma fonte não significa que ela apoia o site.',
          'Fotos dos carros: capturas de tela do jogo hospedadas na Forza Wiki (Fandom), usadas sob as regras de uso de conteúdo da Microsoft. Raridade e tração de fábrica: Forza Wiki, licença CC BY-SA. Eventos da Playlist do Festival e lista oficial de carros: forza.net.',
        ],
      },
      {
        id: 'pedidos',
        title: 'Pedidos de remoção, correção ou crédito',
        paragraphs: [
          'Se você é autor de uma fonte e quer corrigir algo, mudar o crédito, tirar um link ou retirar seus dados do site, abra um pedido no link abaixo. Informe o link da sua planilha, o que deve mudar (linhas, campos ou a fonte inteira), sua relação com a fonte e o motivo.',
          'Pedidos de autores sobre os próprios dados são atendidos em até 7 dias: a fonte sai do site na sincronização seguinte. Pedidos vagos, que não puderem ser confirmados ou que tratem de dados de outra pessoa podem precisar de mais informações.',
        ],
      },
      {
        id: 'o-que-fica',
        title: 'O que pode continuar existindo depois de uma remoção',
        paragraphs: [
          'Quando uma fonte sai, seus dados deixam de aparecer no site. Podem continuar existindo registros técnicos que não reproduzem os dados (por exemplo, contagens gerais e notas de funcionamento) e o histórico do código no GitHub, que guarda versões antigas dos arquivos.',
        ],
      },
      {
        id: 'garantia',
        title: 'Sem garantia',
        paragraphs: [
          'O Forza Paddock é uma referência da comunidade, oferecida como está. As informações podem estar incompletas, desatualizadas ou erradas, e o site pode ficar fora do ar ou mudar quando uma fonte muda. Confira o que for importante na fonte original e no jogo.',
        ],
      },
    ],
    sourcesTitle: 'Fontes e autorizações',
    sourcesLead:
      'Estamos pedindo a autorização expressa de cada autor. A lista abaixo mostra a situação de cada fonte e é atualizada conforme as respostas chegam.',
    status: {
      granted: 'Autorização expressa do autor',
      prelaunch: 'Pedido de autorização em andamento',
      'not-required': 'Dado oficial ou de licença aberta',
    },
    requestsCta: 'Pedir remoção, correção ou mudança de crédito',
  },
  en: {
    title: 'Data use',
    lead: 'Forza Paddock is a fan project that gathers, organises and compiles public information from the Forza Horizon community. This page explains what the site does with that information, what it does not claim, and how to ask for corrections or removals.',
    notAdvice: 'Informational text; not legal advice.',
    updated: 'Updated on 8 November 2026',
    sections: [
      {
        id: 'ownership',
        title: 'We claim no ownership',
        paragraphs: [
          'The sheets, tunes, share codes, notes, lap times and texts shown here belong to their authors: Noa Miyako, kleis, K1Z Gray, LetzeLU, Wrong Hand Drive and the other tuners credited on each tune.',
          'Forza, Forza Horizon, Xbox and Microsoft are trademarks of their owners. Forza Paddock is not affiliated with Microsoft, Xbox Game Studios or Playground Games.',
        ],
      },
      {
        id: 'role',
        title: 'What the site does',
        paragraphs: [
          'The goal is to aggregate and compile information that is already public, so tunes and cars are easier to find and compare. To do that, the site standardises car names, classes, surfaces, tires and tuners, merges the same tune seen in more than one sheet, translates notes and arranges everything into lists and suggestions.',
          "That organising work is ours, but it does not turn the authors' data into Forza Paddock's data. The site is a lookup shortcut: the original sheet remains the reference, with the author's own wording, context and updates.",
        ],
      },
      {
        id: 'credit',
        title: 'Credit and original source',
        paragraphs: [
          'Every tune shows its tuner, and the "Source status" page lists each sheet with its original link. Names and links are there to give credit and to let you check the information at the source. Describing a source\'s role or coverage does not mean it endorses the site.',
          "Car photos: in-game screenshots hosted on the Forza Wiki (Fandom), used under Microsoft's Game Content Usage Rules. Rarity and stock drivetrain: Forza Wiki, CC BY-SA licence. Festival Playlist events and the official car list: forza.net.",
        ],
      },
      {
        id: 'requests',
        title: 'Removal, correction or credit requests',
        paragraphs: [
          "If you author a source and want to correct something, change the credit, remove a link or take your data off the site, open a request at the link below. Include your sheet's link, what should change (rows, fields or the whole source), your relationship to the source and the reason.",
          "Requests from authors about their own data are handled within 7 days: the source leaves the site on the next sync. Requests that are vague, cannot be verified or concern someone else's data may need more information.",
        ],
      },
      {
        id: 'what-remains',
        title: 'What may remain after a removal',
        paragraphs: [
          'When a source is removed, its data stops appearing on the site. Technical records that do not reproduce the data (such as overall counts and operational notes) may remain, as may the code history on GitHub, which keeps old versions of files.',
        ],
      },
      {
        id: 'warranty',
        title: 'No warranty',
        paragraphs: [
          'Forza Paddock is a community reference, provided as is. Information may be incomplete, outdated or wrong, and the site may go offline or change when a source changes. Check anything important against the original source and in game.',
        ],
      },
    ],
    sourcesTitle: 'Sources and permissions',
    sourcesLead:
      'We are asking each author for express permission. The list below shows where each source stands and is updated as answers come in.',
    status: {
      granted: 'Express permission from the author',
      prelaunch: 'Permission request in progress',
      'not-required': 'Official data or open licence',
    },
    requestsCta: 'Ask for removal, correction or a credit change',
  },
};
