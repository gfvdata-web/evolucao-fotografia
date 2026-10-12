# 0012 — Avaliação por sintoma: nitidez 1–5, problema principal e contexto

Data: 2026-10-12 · Situação: aceita (v0.3.1, pedido do Guilherme depois de usar a v0.3.0 no
tablet). Substitui a parte "o que se marca" da decisão 0009; o fluxo (avanço automático, "igual
à anterior", foco a 100%) continua.

## Contexto

Usando a tela Avaliar com fotos reais, o Guilherme apontou três problemas:

1. **Luz**: as cinco opções (sol forte, sombra, nublado, interno, noite) misturavam coisas
   diferentes: lugar (dentro/fora), hora (dia/noite) e quantidade de luz.
2. **Categoria**: "pixelada no envio" já supunha a causa. O que ele vê é a foto perder qualidade
   ao ampliar, e isso pode vir do envio, da compressão JPEG ou do redutor de ruído em ISO alto.
   Descobrir a causa é o trabalho dos indicadores, não do usuário.
3. **Nota 1–5** ambígua (nota de quê?). Ele sugeriu medir a nitidez, talvez com um slider de 0
   a 1.

## Decisão

- **Nitidez 1–5**, em cinco botões, no que o usuário queria nítido. Substitui a nota geral.
- **Problema principal** descrito pelo **sintoma** visto ao ampliar, um toque só:
  nenhum problema · mole por inteiro · foco no lugar errado · arrastada · granulada ·
  quadriculada ao ampliar · outro.
- **Contexto que a câmera não sabe**: **Onde** (dentro / fora), **Luz** percebida (forte /
  média / fraca) e **Assunto** (parado / em movimento). "Onde, luz e assunto iguais à anterior"
  copia os três.
- **O que dá para calcular não é perguntado.** Dia ou noite vem do relógio da foto; a quantidade
  de luz vem da exposição: a tela mostra a **luz da cena** em EV a ISO 100
  (log2(N²/t) − log2(ISO/100), `sceneLight` em `core/indicators.js`) com a faixa de referência
  das tabelas de exposição. A luz marcada pelo usuário fica para comparar com esse número.
- **Avaliada = nitidez + problema principal.** O avanço automático acontece quando o toque
  completa os dois, ou quando se escolhe o problema numa foto já avaliada. Corrigir só a
  nitidez de uma foto já avaliada não muda de foto.
- **Migração 3 → 4**: só passa o que tem exatamente o mesmo sentido (nítida → nenhum problema,
  ruído → granulada, tremida → arrastada, pixelada no envio → quadriculada, sol forte → fora +
  forte, sombra/nublado → fora, interno → dentro, assunto e nota). "Fora de foco" (mole ou foco
  errado?), a nota geral e "noite" não são adivinhados (regra 5). O Guilherme autorizou perder
  as avaliações já feitas; a migração mantém o que dá sem inventar.

## Alternativas consideradas

- **Slider de nitidez 0–1.** Parece mais preciso, mas no tablet é difícil acertar o mesmo valor
  e um 0,63 não se repete de um dia para o outro. Cinco botões dão um julgamento repetível, que
  é o que importa para cruzar com os dados na V2.
- **Marcar vários problemas por foto** (ex.: granulada e arrastada). Mais fiel em alguns casos,
  mas acaba com o avanço automático de um toque. Fica o principal; a nota livre cobre o resto.
- **Manter a nota geral e criar a nitidez à parte.** Mais um campo por foto, e o objetivo do
  projeto é a nitidez, não a estética.
- **Luz em uma linha só com mais opções** (sol direto, sombra, janela, lâmpada, noite...).
  Mistura de novo lugar, fonte e quantidade; e a quantidade já sai da exposição.

## Consequências

- `SCHEMA_VERSION` 4. Sessões sobem junto, sem mudança de formato.
- A luz da cena pela exposição não corrige compensação nem foto sub/superexposta; a correção
  pelo brilho real da foto está planejada para o motor de diagnóstico (v0.5).
- A V2 cruza nitidez (1–5) e problema principal com ISO, velocidade, distância focal, lente,
  onde/luz e a luz calculada.
