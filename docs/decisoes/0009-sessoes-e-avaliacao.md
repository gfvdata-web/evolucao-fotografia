# 0009 — Sessões e avaliação por toque

Data: 2026-10-12 · Situação: proposta (v0.3, rever depois do uso no tablet)

## Contexto

A v0.3 precisa permitir avaliar dezenas de fotos em poucos minutos no Galaxy Tab S9+ e agrupar
as fotos em sessões. Escolhas que não eram óbvias:

1. Como agrupar: sessão criada sozinha ou sugerida?
2. Onde fica o vínculo foto ↔ sessão?
3. O que conta como "avaliada"?
4. Como avançar rápido sem perder a chance de marcar nota, luz e assunto?
5. Repetir luz e assunto, que costumam ser os mesmos na sessão inteira.

## Decisão

- **Sessão sugerida, não automática.** Fotos sem sessão aparecem agrupadas pelo dia da captura
  (relógio da câmera, sem converter fuso), com **Criar sessão** ou **Juntar a "…"** quando já
  existe sessão do mesmo dia. Aparece na aba Enviar logo depois do envio e na aba Sessões.
  Fotos sem data de captura formam um grupo à parte; nunca se usa a data do envio no lugar
  (regra 5: o que não foi lido aparece como não lido).
- **O vínculo fica na foto** (`session_id`), como o modelo já previa. A sessão guarda só os
  próprios dados. Mover fotos é trocar um campo; excluir a sessão devolve as fotos para "sem
  sessão", com as avaliações.
- **Avaliada = tem categoria.** A categoria é o julgamento que a V2 cruza com configurações e
  indicadores. Nota, luz, assunto e nota livre são opcionais.
- **Categoria por último e avanço automático.** Na tela de avaliação, nota, luz e assunto vêm
  antes, e escolher a categoria passa para a próxima foto depois de 250 ms. "Avançar ao
  escolher a categoria" pode ser desligado (fica guardado no navegador). Tocar de novo na opção
  marcada desmarca.
- **"Luz e assunto iguais à anterior" é um botão**, e não um valor copiado sozinho: uma foto
  só tem luz ou assunto quando o usuário tocou.
- **Foco a 100% na própria tela de avaliação** (o recorte do AF da v0.2), para julgar a nitidez
  sem abrir a ficha.
- Toda gravação de avaliação ou sessão numa foto usa a mesma trava por disparo da análise de
  pixels: uma avaliação feita durante a análise em segundo plano não é sobrescrita por ela.

## Alternativas consideradas

- **Criar sessões sozinho por dia, ao enviar.** Menos toques, mas dois passeios no mesmo dia
  virariam uma sessão só, e fotos reenviadas criariam sessões repetidas. A sugestão custa um
  toque e evita desfazer.
- **Lista de ids de fotos dentro da sessão.** Facilita escrever `sessao.json` na v0.4, mas
  duplica a verdade: foto e sessão poderiam discordar. Na v0.4 o `sessao.json` é montado a
  partir do `session_id` das fotos.
- **Categoria primeiro, sem avanço automático.** Um toque a mais por foto (seta ou deslize).
  Com dezenas de fotos, o avanço automático economiza mais.
- **Luz e assunto preenchidos com o valor da foto anterior.** Mais rápido, mas gravaria um dado
  que o usuário não informou.

## Consequências

- O campo `experiment` da sessão (parâmetro variado + descrição) fica pronto para o guia de
  experimentos da V2; na v0.3 a sessão só mostra o valor do parâmetro em cada foto.
- Reavaliar depois de usar no tablet: o atraso de 250 ms, a ordem dos grupos na tela em retrato
  e se o avanço automático deve pular as fotos já avaliadas.
