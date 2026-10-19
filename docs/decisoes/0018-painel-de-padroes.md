# 0018 — v2.1: Painel de padrões

Data: 2026-10-19 · Situação: **aceita** (plano aprovado pelo Guilherme em 19/10/2026).

## Contexto

O roadmap da V2 pede cruzamentos das avaliações (nitidez, problema principal) e do veredito do
site com ISO, margem de velocidade, lente, abertura, luz e assunto, com intervalo de incerteza e
"poucas fotos (n)" abaixo de um mínimo (regra 4). O Guilherme ainda tem poucas fotos avaliadas, e
o veredito do site errou numa foto mole que saiu "Boa" (caso a estudar com a Rodada 2).

## Decisão

1. **Uma dimensão × uma medida por vez**, escolhidas por botões. Cabe no tablet em retrato e se lê
   sem legenda; uma matriz com todos os problemas ficaria larga demais.
2. **Dimensões e faixas** (`core/pattern-bands.js`):
   - ISO: até 400 · 500–1600 · 2000–6400 · 8000 ou mais;
   - margem de velocidade (velocidade × 1/distância focal, sem estabilização): folga de 2× ou
     mais · entre 1× e 2× · mais lenta que a referência;
   - lente (perfis do app; outra lente à parte);
   - abertura: f/1,8–2,8 · f/3,2–5,6 · f/6,3–11 · f/13 ou mais;
   - luz medida (as faixas de EV já usadas na ficha);
   - onde, luz percebida e assunto (o que ele marcou).
   Campo não lido ou não marcado vai para a faixa "não lido" (regra 5); a faixa vazia não aparece.
3. **Medidas** (`core/patterns.js`):
   - "Nitidez 4 ou 5" e cada problema principal (granulada, arrastada, mole, foco no lugar errado,
     quadriculada): **só fotos avaliadas** (nitidez + problema, decisão 0012);
   - "Com problema (o site disse)": todas as fotos da faixa, com o veredito calculado **sem** a
     nota dele (o mesmo do "o site disse × você marcou").
   Cada linha mostra também a nitidez média das avaliadas da faixa, com o n.
4. **Incerteza**: intervalo de Wilson de 95%, desenhado como faixa com a marca da porcentagem.
   Com **menos de 10 fotos** na faixa, só a contagem ("poucas fotos (n)"), sem porcentagem.
5. **Cada número abre a grade com as mesmas fotos**: a grade ganha as chaves de faixa no hash
   (`iso=`, `margem=`, `lente=`, `abertura=`, `ev=`, `onde=`, `luz=`, `assunto=`) e o filtro usa a
   mesma função de faixa do Painel. Um teste confere, para todas as medidas, que a conta do Painel e
   a grade filtrada dão o mesmo número.

## Alternativas consideradas

- **Matriz faixa × todos os problemas**: tudo de uma vez, mas com 6 colunas de porcentagem e
  intervalo não cabe no retrato e mistura números com n diferentes.
- **Intervalo pela aproximação normal** (p ± 1,96·√(p(1−p)/n)): mais simples, mas sai de 0–100% e
  fica estreito demais com poucas fotos ou porcentagens perto de 0 e 100%, justamente o caso aqui.
- **Mínimo de 5 fotos**: mostraria padrões antes, mas com 5 fotos o intervalo de 95% cobre quase
  metade da escala; 10 é o ponto de partida do roadmap.

## Consequências

- Nenhuma mudança no formato dos dados nem nas métricas: as faixas são calculadas na hora.
- O Painel calcula o diagnóstico de cada foto só na medida "o site disse".
- Quando a Rodada 2 trouxer novos limites, as faixas de ISO e de margem de velocidade podem ser
  revistas (registrar aqui).
