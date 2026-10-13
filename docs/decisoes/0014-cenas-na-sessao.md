# 0014 — Cenas dentro da sessão: separação, ajuste por arrastar e diagnóstico por cena

Data: 2026-10-12 · Situação: aceita (v0.5.1). Completa a decisão 0011 (o que a v0.5 faz) e a
0013 (o diagnóstico de cada foto, que a cena reúne).

## Contexto

Numa saída o Guilherme fotografa normalmente 3 ou 4 cenas: o mesmo assunto e a mesma luz por
alguns minutos, com ajustes variando entre os disparos. Ele quer ver o que deu errado em cada
cena, o ajuste principal e quanto as configurações foram alternadas, e corrigir a separação no
tablet arrastando a foto.

## Decisão

1. **Separação automática** (`core/scenes.js`), entre fotos seguidas na ordem da captura:
   - corta sempre: pausa de 15 min ou mais, troca de lente, ou mudança entre "com data" e
     "sem data" (as fotos sem data ficam juntas, no fim);
   - sinais fracos, que cortam dois de cada vez: pausa de 2 min, salto de zoom de 1,8× (100 →
     300 mm) e enquadramento diferente (distância da assinatura 8×8 de 28 ou mais);
   - enquadramento muito diferente (45 ou mais) corta sozinho depois de 30 s.
   Nas 26 amostras, a separação bateu com o roteiro: a rajada F03 (7 quadros) ficou numa cena,
   a série T inteira também (com o zoom indo de 300 para 205 mm) e cada experimento da série F
   ficou separado. A distância de enquadramento ficou entre 1 e 30 na mesma cena e entre 38 e 78
   com assunto novo.
2. **Cada corte diz o motivo** ("pausa de 16 min", "troca de lente", "enquadramento diferente").
3. **O vínculo fica na foto** (`scene_id`, esquema 6), como o da sessão. `null` = automático.
   Mover uma foto **congela** a sessão: todas as fotos recebem o id da cena em que estão, e a
   movida recebe o destino. Assim a correção vale em outro aparelho (vai no registro da foto,
   pelo Drive) e não muda quando chegam fotos novas: essas entram na cena mais próxima no tempo
   (até 5 min, mesma lente) ou formam cenas automáticas. "Separar as cenas automaticamente de
   novo" limpa tudo. Mudar a foto de sessão limpa a cena dela.
4. **Numeração pela foto mediana** de cada cena. Ordenar pela primeira foto trocava os números
   quando a foto mais antiga ia para outra cena.
5. **Arrastar e soltar feito para o dedo** (`ui/scene-drag.js`, eventos de ponteiro): segurar
   0,45 s levanta a foto (o celular vibra, se puder), soltar em outra cena move e soltar na área
   "Solte aqui para criar uma cena nova", que só aparece durante o arraste, cria uma cena. Perto
   da borda de cima ou de baixo a tela rola sozinha. Mexer o dedo antes de 0,45 s rola a tela
   normalmente, e um toque rápido abre a ficha. "Selecionar fotos" → "Mover para" (Cena N, Nova
   cena) faz o mesmo sem arrastar.
6. **Diagnóstico por cena** (`core/scene-diagnosis.js`), feito sobre o diagnóstico de cada foto:
   - problema principal: o achado presente em mais fotos (alerta pesa o dobro), contando só os de
     certeza média ou alta ou confirmados pela avaliação; o ajuste principal é a orientação desse
     achado na foto em que ele é mais forte, e a tela diz em quantas fotos ele aparece;
   - comparação na cena: a mais nítida × a mais mole (desfoque no ponto de foco) e o que mudou
     entre elas, ou "têm os mesmos ajustes: a diferença veio da mão, do assunto ou do foco".
     Só aparece quando a mais mole não está nítida. É reforço, nunca a base;
   - quanto os ajustes variaram: faixa de cada ajuste (em pontos) e aviso quando **dois ajustes
     escolhidos pelo usuário** mudaram ao mesmo tempo entre fotos seguidas. Conta o que o modo
     deixa na mão dele: em Av, abertura e compensação (a velocidade muda sozinha); em Tv,
     velocidade e compensação; em M, velocidade, abertura e ISO; sempre focal, lente, modo, foco
     e disparo. Entrar ou sair do A+ conta como um ajuste só.
7. **Diagnóstico da sessão**: totais, problema que se repete em mais de uma cena e a variação dos
   ajustes na sessão inteira, sem avisos entre cenas diferentes.

## Alternativas consideradas

- **Cenas guardadas no documento da sessão** (lista de cenas com as fotos). Seria um segundo
  lugar dizendo onde a foto está, além do `session_id`, com risco de divergência na junção entre
  aparelhos, que é feita foto a foto. Ficou no registro da foto.
- **Só a separação automática, sem congelar**, guardando apenas as fotos movidas. Uma foto nova
  podia redesenhar a separação e desfazer a correção do usuário.
- **HTML5 drag and drop.** Não funciona com o dedo no Chrome do Android. Eventos de ponteiro com
  toque longo funcionam no tablet, com mouse e com caneta.
- **Agrupar pelas prévias com IA.** Fica para a V3 (decisão 0011).

## Consequências

- `SCHEMA_VERSION` 6 (`scene_id`); a migração 5 → 6 põe todas as fotos na separação automática.
- Os limites da separação ficam em `SCENE_LIMITS`. Fotos analisadas antes da v0.5.0 sem o
  original no aparelho não têm assinatura: a separação usa só tempo, lente e zoom.
- O teste ponta a ponta usa toque real do Chrome (CDP) além do mouse, porque o uso é no tablet.
