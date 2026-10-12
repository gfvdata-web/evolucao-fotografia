# 0011 — Diagnóstico com orientação, cenas e IA só na V3

Data: 2026-10-12 · Situação: aceita (planejamento da v0.5; nada implementado ainda)

## Contexto

Usando a v0.3 no tablet, o Guilherme pediu mais do que indicadores. O ponto ideal, nas palavras
dele: mandar **uma foto só** e o site dizer se está boa ou ruim e o que ele tinha que ter feito
(subir a velocidade, abrir o diafragma...), considerando a câmera, a lente e a luz. Numa sessão,
o site deve separar as cenas (normalmente 3 ou 4), dar o ajuste principal de cada uma e mostrar
quanto as configurações foram alternadas.

Isso contrariava a regra 4 da v0.1 ("indicadores objetivos, sem conselhos; não dizer 'use ISO
menor'"). O Guilherme revogou a regra: ele quer que o site o ajude a melhorar as fotos.

## Decisão

- **O site orienta, sempre com o porquê.** Cada orientação mostra o número que a gerou, a
  origem (física da exposição, calibração da EOS RP, comparação dentro da cena, avaliações do
  Guilherme) e o grau de certeza. A regra 5 continua: campo não lido não gera orientação.
- **Motor de diagnóstico sem IA**, em `core/` (puro), que funciona com uma foto só:
  - luz da cena pela exposição: `EV100 = log2(N² / t) − log2(ISO / 100)`, ajustada pela
    compensação e pelo brilho real medido na foto (a exposição escolhida pela câmera não é a
    luz absoluta quando a foto saiu escura ou clara);
  - perfil das lentes (abertura máxima, faixa mais nítida, difração) e da EOS RP (ruído por ISO);
  - "o que era possível com essa luz": combinações que evitariam o problema, pesando tremido ×
    ruído × profundidade de campo;
  - separar foco errado, tremido e ruído pelos pixels (nitidez no ponto de AF × no resto da
    foto) e pelos metadados; histograma para altas luzes e sombras.
- **Cenas separadas sozinhas e reajustadas por arrastar e soltar**, com "mover para…" como
  alternativa (arrastar com o dedo numa grade cheia falha às vezes). Sinais: intervalo entre
  disparos, troca de lente ou salto de zoom, semelhança das prévias.
- **A comparação dentro da cena é reforço**, não a base: uma cena pode ter todas as fotos com a
  mesma configuração, e a orientação tem que sair mesmo assim.
- **Calibração em duas camadas:** a Rodada 2 de amostras mede o equipamento e a mão do
  Guilherme (v0.5); as avaliações dele ajustam os limites ao gosto dele (V2). É estatística,
  não treino de modelo.
- **Ordem:** a v0.4 (Drive, PWA, backup) continua antes. Cenas e diagnóstico são a v0.5; o
  importador Python passa para a v0.6.

## Alternativas consideradas

- **Só comparação, sem conselho** ("a mais nítida foi a 1/500; entre ela e a pior mudou a
  velocidade"). Mantinha a regra 4, mas não serve para uma foto só nem para cenas com a mesma
  configuração, que é o caso que o Guilherme quer resolver.
- **IA agora** (modelo de visão para nitidez, cenas e contexto). Entende o assunto, o que a
  física não faz, mas exige chave fora do repositório, tem custo por foto e manda as fotos para
  um provedor. Fica para a V3, com essas três questões decididas antes.
- **Cenas antes do Drive.** É o que ele usa ao fotografar, mas proteger fotos e avaliações no
  Drive veio primeiro, por escolha dele.

## Consequências

- Regra 4 do `CLAUDE.md` reescrita. Os textos atuais dos indicadores (v0.2) ficam como estão
  até a v0.5 trazer o diagnóstico.
- A v0.5 depende da Rodada 2 para os limites de ruído, de tremido à mão e de abertura da RF 50;
  sem ela, o motor usa regras genéricas e diz isso na orientação.
- Toda orientação precisa de teste unitário com o caso que a dispara e com o caso de campo
  ausente.
