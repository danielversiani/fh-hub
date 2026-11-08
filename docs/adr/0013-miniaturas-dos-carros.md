# 0013. Miniaturas dos carros a partir da Forza Wiki, sob as regras de conteúdo da Microsoft

- **Status:** Proposta (aguarda o dono)
- **Data:** 2026-11-08

## Contexto

O dono quer a miniatura de cada carro na página do carro e na caixa expandida da lista de tunes (como no forzacity.gg). Hoje o projeto não usa imagens de terceiros: o [ADR-0009](0009-playlist-fonte-oficial.md) proíbe artes oficiais na playlist, e o [ADR-0010](0010-politica-de-fontes.md) (item 5) proíbe copiar imagens de guias e wikis. Usar fotos de carros muda essa regra, por isso este ADR.

Fatos levantados em 2026-11-08:
- **forza.net** não tem foto por carro na lista oficial (só a arte de capa da página).
- **Forza Wiki (Fandom)** tem uma foto de cada carro do FH6: são capturas de tela do jogo, na categoria `Car Images (FH6)`, com cerca de 1340×750 px. A API pública (`prop=pageimages`) devolve o endereço da imagem e de uma versão reduzida (ex.: 400 px).
  - O texto da wiki é CC BY-SA, mas as capturas de tela **não**: o direito é da Microsoft (conteúdo do jogo).
- **Regras de conteúdo de jogos da Microsoft** ([Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules)) permitem que fãs usem capturas de tela num site, com condições:
  1. **Uso não comercial:** o site não pode ter anúncios nem cobrar acesso. Pedido de doação opcional é permitido.
  2. **Aviso obrigatório**, com link para as regras: "Forza Horizon 6 © Microsoft Corporation. [nome do site] was created under Microsoft's "Game Content Usage Rules" using assets from Forza Horizon 6, and it is not endorsed by or affiliated with Microsoft."
  3. Nada de extrair arquivos do jogo (capturas de tela são permitidas).
  4. As próprias regras avisam que, em jogos como Forza, **carros e marcas podem exigir permissão do fabricante**. Sites de fãs costumam usar essas imagens sem problema, mas o risco não é zero.

## Decisão (proposta)

1. Usar a imagem principal da página de cada carro na Forza Wiki, **na versão reduzida** (400 px), carregada direto do servidor de imagens da Fandom (`static.wikia.nocookie.net`), sem copiar os arquivos para o repositório.
2. O endereço vem de uma fonte nova (`fandom-images`, `permission: not-required`), lida pela API como a raridade e a tração. Carro sem imagem continua sem imagem.
3. O site passa a ser **explicitamente não comercial**: sem anúncios. Doações opcionais continuam possíveis.
4. O rodapé ganha o aviso exigido pela Microsoft, com link para as regras, e o crédito "Imagens: Forza Wiki".
5. Se a Microsoft, um fabricante ou a Fandom pedirem a remoção, as imagens saem do ar desligando a fonte (`active: false`).

## Alternativas consideradas

- **Sem imagens (como hoje):** zero risco, mas o site fica menos agradável e mais difícil de navegar.
- **Copiar as imagens para o nosso site:** mais rápido e não depende da Fandom, mas aí redistribuímos ~700 arquivos de terceiros. Fica para depois, se o carregamento direto der problema.
- **Silhuetas desenhadas por tipo de carro:** sem risco legal, mas não mostra o carro de verdade.
- **Imagens do forzacity.gg / codmunity:** são sites concorrentes, sem licença de reuso. Descartado (ADR-0010).

## Consequências

- **Positivas:** páginas de carro e lista de tunes muito mais fáceis de reconhecer, como o dono pediu.
- **Negativas:**
  - o site não poderá ter anúncios enquanto usar as imagens;
  - dependência do servidor de imagens da Fandom (se mudar o endereço, a miniatura some até a próxima sincronização);
  - risco pequeno de pedido de remoção por marca de carro.
- **Muda:** o item 5 do ADR-0010 passa a ter a exceção "capturas de tela do jogo, sob as regras da Microsoft".
