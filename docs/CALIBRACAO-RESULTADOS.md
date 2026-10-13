# Resultados da calibração com amostras reais

Primeira rodada de `node tests/amostras/conferir.mjs`, feita em 2026-10-12 com 26 capturas reais da EOS RP: séries F e T, CR3 e JPG do cartão, mais o JPG do Camera Connect em "Tam. original". O protocolo está em [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md) e o gabarito em [`tests/amostras/roteiro.mjs`](../tests/amostras/roteiro.mjs).

As fotos e o relatório completo ficam só no computador do Guilherme (`amostras/`). Este documento traz apenas os valores de metadados que servem para o normalizador, sem número de série nem fotos.

## Cobertura

24 de 25 fotos obrigatórias reconhecidas automaticamente pelo EXIF. A F03 (rajada) teve 7 quadros.

| Situação | Fotos |
|---|---|
| Conforme o roteiro | F01–F11, T01–T05, T07 |
| Com desvio, mas válida | **F12** (ISO 640, não 400: estava em ISO Auto) · **F13** (A+ em RAW + JPEG L, e não só JPEG M) · **T08** (205 mm, e não 300: o zoom ficou na posição da T05; comparar com a T05) |
| Não feitas | T06 (através do vidro) · T09 (temporizador 10 s, a fazer) · F14 (GPS, opcional) |

## Achado principal: o Camera Connect não altera a foto

Os 26 JPG transferidos pelo Camera Connect em **"Tam. original"** são **idênticos byte a byte** aos JPG do cartão, com os mesmos pixels e os mesmos metadados (inclusive MakerNotes e subsegundos). Com essa opção, a transferência não causa a perda de qualidade.

O Guilherme diz que sempre usou "Tam. original" e nunca "Reduzido", e por isso o "Reduzido" ficou fora da análise.

## Valores reais da EOS RP para o normalizador

Formato: texto do ExifTool (número com `-n`).

| Ajuste na câmera (menu em inglês) | Tag | Valor lido |
|---|---|---|
| AF method: 1-point AF | `Canon:AFAreaMode` | `Flexizone Single` (13) |
| AF method: Spot AF | `Canon:AFAreaMode` | `Spot AF` (9) |
| AF method: Face+Tracking | `Canon:AFAreaMode` | `Face + Tracking` (6) |
| AF operation: Servo AF | `Canon:FocusMode` | `AI Servo AF` (1) |
| Drive: High-speed continuous | `Canon:ContinuousDrive` | `Continuous, High` (5) |
| Drive: Self-timer 2 sec | `Canon:SelfTimer` | `2 s` (20). `ContinuousDrive` fica `Single` |
| Drive: Self-timer: Continuous | `Canon:SelfTimer` | `10 s, Custom` (16484). Gera várias fotos no mesmo segundo: foi o que produziu 2 quadros extras na F03 |
| High ISO speed NR: Low / Standard / **High** / Disable | `Canon:HighISONoiseReduction` | `Low` (1) / `Standard` (0) / **`Strong`** (2) / `Off` (3) |
| Picture Style: Auto / Landscape | `Canon:PictureStyle` | `Auto` (135) / `Landscape` (131). O habitual dele é **Auto** |
| Modo A+ (Cena Inteligente) | `ExifIFD:ExposureProgram` = `Program AE` (2), **igual ao P** | `Canon:CanonExposureMode` = `Easy` (0) é o que separa A+ de P |
| Cropping: 1.6x (crop) | `Canon:AspectRatio` | `3:2 (APS-C crop)` (13), com JPEG e CR3 de 3888×2592 e AFImage 3888×2592 |
| Cropping: 16:9 | `Canon:AspectRatio` | `16:9` (7), com JPEG de 6240×3504 |
| Medição avaliativa | `MeteringMode` | JPEG: `Multi-segment` (5). CR3: `Evaluative` (3). Mesmo ajuste com nomes diferentes |
| Otimizador digital da lente | `Canon:DigitalLensOptimizer` | `Standard` (1) em todas: afeta a nitidez do JPEG da câmera |
| Auto Lighting Optimizer | `Canon:AutoLightingOptimizer` | `Standard` (0). Aparece `Off` (3) nas fotos em M |

## Pontos de atenção para o código

1. **Eixo Y do AF:** confirmado com fotos reais. Na F01 (ponto no canto superior direito), x = +2140 e y = +980. Na F02 (canto inferior esquerdo), x = −2010 e y = −891. Origem no centro e **Y positivo para cima**, como já está em `core/af-geometry.js`.
2. **Listas de AF com zeros sobrando:** `AFAreaXPositions`, `AFAreaYPositions` e `AFAreaWidths` vêm com dezenas de zeros depois dos valores úteis. Quem diz quantos valem é `ValidAFPoints`: 1 com AF em 1 ponto e 143 na grade do A+. `NumAFPoints` é sempre 143. **Corrigido na v0.2:** a ficha mostrava "143 áreas" no AF em 1 ponto.
3. **No A+ com Face + Tracking:** o MakerNote traz uma grade inteira de pontos (13 colunas, de x = −2520 a +2520). O ponto que focou precisa sair de `AFPointsInFocus`, e não do primeiro da lista. O site já fazia isso (6 áreas em foco na F13). **Corrigido na v0.2:** o modo A+ aparecia como "Programa (P)". Agora vem de `Canon:EasyMode` = `Scene Intelligent Auto` quando `CanonExposureMode` = `Easy`.
4. **Tempo e abertura "exatos" no CR3:** o 1/76 s e o f/5.657 vêm do grupo `Canon` (`Canon:ExposureTime`, `Canon:FNumber`). O mesmo CR3 tem, no grupo `ExifIFD`, os nominais 1/80 s e f/5.6, e é esse grupo que o site usa. Conferido nas 52 fotos: o site sempre mostrou os valores nominais. O erro estava só no conferidor, que pegava o primeiro grupo; agora ele também prefere o EXIF padrão.
5. **Subsegundos são texto:** `SubSecTimeOriginal` vem como `"08"` (80 ms). Converter para número dá 8 e inverte a ordem dos quadros de uma rajada. O site usa `Composite:SubSecDateTimeOriginal` em texto e está correto. O conferidor tinha esse erro e foi corrigido.
6. **Grupo GPS vazio:** o JPG tem o grupo `GPS` mesmo sem localização (sem `GPSLatitude`). "Tem grupo GPS" não quer dizer "tem localização".

## Métricas da v0.2 nas amostras

Medidas pelo próprio site com `node tests/amostras/metricas.mjs`, que envia as fotos de `amostras/cartao` a um navegador e lê o que o site calculou. Recortes e tabela completa ficam em `amostras/` (local). Valores da versão principal (JPG do cartão, qualidade estimada 97, cor 4:2:2).

**Nitidez no recorte do foco** (variância do Laplaciano; depende da cena, então só vale comparar fotos da mesma cena):

| Comparação | Fotos | Nitidez |
|---|---|---|
| Tremido à mão, 50 mm: 1/8 × 1/200 | F04 × F05 | 18 × 122 (≈ 7× menor) |
| Tremido à mão, 300 mm: 1/100 × 1/1000 | F06 × F07 | 42 × 280 (≈ 7× menor) |
| RF 75-300 em 300 mm no tripé: f/5.6, f/8, f/11, f/16 | T01–T04 | 36, 108, 90, 97 |
| 205 mm no tripé, f/8: temporizador 2 s × dedo com a mão na câmera | T05 × T08b | 954 × 884 (−7%) |
| ISO 12800, redução de ruído Forte × Desligada | F08 × F09 | 15 × 284 |

- O indicador separa bem a foto tremida da foto de controle: cerca de 7× nas duas distâncias focais.
- Na RF 75-300 em 300 mm, f/5.6 (abertura máxima) deu um terço da nitidez de f/8. De f/8 a f/16 ficou parecido.
- Em 205 mm, tocar a câmera com a mão apoiada não fez diferença clara contra o temporizador. Falta a comparação em 300 mm (T02 × T08 refeita × T09).
- **Ruído entra como detalhe:** em ISO 12800 sem redução de ruído o número sobe muito (284). Por isso a ficha avisa, a partir de ISO 3200, que o ruído também aumenta a nitidez medida (`THRESHOLDS.high_iso_sharpness_note`).
- O JPEG embutido no CR3 mediu até 34% menos nitidez que o JPG do cartão na mesma região (mediana de 8%; as maiores perdas foram nas fotos de pouco detalhe, como a rajada F03), e tem qualidade estimada 80. **Mudança na v0.2:** no empate de pixels, a versão principal passou a ser o JPG da câmera.

**Ruído na área uniforme** (desvio em níveis de 0 a 255):

- Entre ISO 100 e 800: de 0,17 a 0,57. ISO 12800: 0,44 com redução Forte (F08) e 1,68 sem redução (F09).
- Áreas quase brancas escondem o ruído. Na mesma foto (F01), uma área de brilho 220 mediu 0,03, e uma de brilho 151 mediu 0,25. **Mudança na v0.2:** a busca automática só aceita tons médios (brilho 30–200).

**Comparação entre versões:**

- A F11 (16:9 com RAW) acusava "−16% de pixels" entre o CR3 e o JPG. O JPEG dentro do CR3 é sempre o sensor inteiro (6240×4160, `AFImageHeight` 4160), e o JPG 16:9 é a faixa central (6240×3504, `CropTopMargin` 328). **Corrigido na v0.2:** agora a ficha diz "formato L 16:9 escolhido na câmera, não perda no caminho", e os recortes de cada versão mostram o mesmo trecho da cena (conferido visualmente na F11).
- Nas outras fotos, a única diferença apontada entre CR3 e JPG é o número de campos de metadados (informativo).

**Risco de tremido:** os valores batem com o roteiro (F04 6,25×, F06 3×, T04 10×). O app não sabe se havia tripé, então as fotos de tripé (F01, T02–T04) também aparecem com risco. Isso é esperado: o indicador mede a velocidade, não o resultado.

## Diagnóstico da v0.5.0 nas amostras

Medido em 2026-10-12 com `node tests/amostras/metricas.mjs` (que agora também roda o diagnóstico
de cada foto), sobre os 26 JPG do cartão. Os limites do motor (`LIMITS` em `core/diagnosis.js`)
saíram destes números. Decisão 0013.

**Luz da cena.** O fotômetro da câmera (`Canon:MeasuredEV`) bateu com a luz calculada pela
exposição em todas as fotos (diferença de até 0,25 EV), inclusive no modo M. Na F10, com
compensação −1, a exposição dá 8,7 e o fotômetro 7,9: ele mede a cena, sem a compensação. Por
isso o motor usa o fotômetro primeiro.

**Desfoque no recorte do foco** (Crété-Roffet; 0 = nítido, 1 = sem detalhe):

| Situação | Fotos | Desfoque |
|---|---|---|
| Tripé, foco certo | F01, T05, T08 | 0,26–0,27 |
| À mão, sem tremido | F05, F07 | 0,37–0,38 |
| Tripé, 300 mm, f/8 a f/16 | T02–T04 | 0,40–0,43 |
| Tremidas | F04 (1/8 a 50 mm), F06 (1/100 a 300 mm) | 0,54–0,56 |
| RF 75-300 aberta a 300 mm | T01 | 0,52 |
| ISO 12800 (com e sem redução de ruído) | F08, F09 | 0,17 (o ruído parece detalhe) |

- Limites: até **0,40** nítida, até **0,47** um pouco mole, acima disso mole.
- A diferença entre os eixos (direção do borrão) **não** separou tremido de foco: a maior
  diferença foi na F02, sem tremido. Fica calculada, mas fora do diagnóstico.
- Recortes com pouco detalhe (rajada F03 em ambiente interno, variação 0,6–1,1) ainda deram
  valores coerentes a partir de **0,9**; abaixo disso a ficha diz que não deu para julgar.

**Trechos a 100% (foco errado × tremido).** Nas fotos bem focadas da série T, um trecho com mais
contraste que o alvo distante mediu até 0,14 a menos de desfoque que o ponto de AF (T02: 0,40 ×
0,26). Na F06, tremida, 0,17 a menos. Por isso "foco fora do ponto" exige **0,22** a menos, num
trecho com detalhe de pelo menos 1,2. A 1ª rodada não tem foco errado de verdade: o bloco D da
Rodada 2 vai calibrar essa margem.

**Resultado do diagnóstico:**

| Foto | O que se sabe | Diagnóstico |
|---|---|---|
| F04, F06 | tremidas à mão | Provável tremido (certeza alta) |
| F11 | 1/25 a 50 mm, à mão | Provável tremido |
| F01 | 1/15 no tripé | Boa; "velocidade lenta, mas a foto ficou nítida: houve apoio" |
| F02, F05, F10, F12, F13, T02, T03, T05, T08 | de controle | Boa |
| T01 | tripé, f/5,6 a 300 mm | RF 75-300 na abertura máxima (feche para f/8) |
| T04 | tripé, f/16, 1/30 | Possível tremido leve (o app não sabe do tripé e diz isso) + difração |
| T07 | à mão, 1/640 a 300 mm | Mole sem velocidade lenta (causa não identificada, certeza baixa) |
| F08, F09 | ISO 12800 | ISO alto; na F08, o efeito da redução de ruído Forte |
| F06, F07 | céu no quadro | Altas luzes estouradas (14% e 6%) |
| F03 (7 quadros) | rajada interna | 4 boas, 1 um pouco mole, 2 com pouco detalhe para julgar |

## Cenas da v0.5.1 nas amostras

Com as 26 fotos numa sessão só, `metricas.mjs` agora também mostra a separação em cenas
(decisão 0014). Distância de enquadramento (assinatura 8×8, já descontada a exposição) em relação
à foto anterior:

- **Mesma cena:** de 1 a 30 (série T de 300 para 205 mm: 30; rajada F03: até 41, mas 22 s
  depois da anterior).
- **Assunto novo:** de 38 a 78 (F04 78, F10 59, F03 56, F08 50).

Resultado: 8 cenas, todas batendo com o roteiro: F01–F02 | F04–F05 | F10–F11 | F12–F13 | rajada
F03 (7) | F06–F07 (troca de lente) | F08–F09 (pausa de 16 min) | série T (7, pausa de 35 min).
Limites: corte com dois sinais (pausa de 2 min, zoom 1,8×, enquadramento 28 ou mais); corte só
pelo enquadramento a partir de 45 e 30 s de pausa.

## RAW sem processamento da v0.6 nas amostras

Os 26 CR3 revelados pelo importador (`tests/amostras/revelar.py`), empacotados
(`pacote-amostras.py`) e importados no site (`sensor.mjs`, 155 s para as 26 no PC). Decisão 0015.

**Enquadramento.** O recorte que o CR3 informa coincide pixel a pixel com o JPEG da câmera nas
26, inclusive 16:9 (IMG_9368) e recorte 1,6x (IMG_9370, onde o próprio RAW já vem recortado):
deslocamento zero no centro e nos dois cantos (correlação de fase em trechos de 512 px).

**Tons.** Com só o brilho mediano igualado (ganho único), a curva em S do JPEG mudava sozinha as
medidas: a sombra do foco de IMG_9372/9373 ia de 52 para 23 e a "nitidez" caía 92–97%, o que o
site leria como detalhe apagado. Com a curva de tons do próprio JPEG (histograma), o brilho do
recorte do foco fica a até 6 níveis do JPEG em 21 das 26; nas 5 da rajada F03 (IMG_9374–9378) a
câmera deixou essa região 14 a 21 níveis mais escura que a curva geral, um ajuste local; a ficha
avisa que ali a comparação é aproximada.

**Ruído e detalhe** (detalhe = variância do Laplaciano menos 20σ², o que o ruído soma a ela;
mesmos recortes a 100%):

| Grupo | ISO | Redução de ruído | Ruído σ RAW → JPEG | Detalhe RAW → JPEG |
|---|---|---|---|---|
| F01, F02, F06 (IMG_9362, 9364, 9380) | 100 | Padrão | 0,46–0,86 → 0,25–0,39 | +86% a +271% |
| T01–T05, T08b, T07 (IMG_9384–9390) | 100–400 | Baixa | 0,62–1,14 → 0,39–0,57 | +109% a +179% |
| IMG_9365, 9366 | 100, 640 | Padrão | 0,61–0,72 → 0,27–0,28 | −11%, 0% |
| IMG_9367, 9370, 9371 | 200–640 | Padrão | 0,53–1,38 → 0,27–0,31 | −49% a −62% |
| Rajada F03 (IMG_9372–9378) | 500–800 | Padrão | 0,36–1,36 → 0,25–0,30 | −82% a −98% |
| F08 (IMG_9382) | 12800 | Forte | 5,75 → 0,44 | −96% |
| F09 (IMG_9383) | 12800 | Desligada | 5,09 → 1,68 | −61% |
| IMG_9381 (F07, 300 mm) | 640 | Padrão | 1,65 → 0,40 | +100% |

Leitura: em ISO baixo a câmera **realça** a nitidez (o estilo de imagem), com a redução de ruído
Baixa ou Padrão. Com a Padrão, a partir de ISO ~250 ela passa a **apagar detalhe**, muito na
rajada em ISO 500–800. Em ISO 12800, mesmo "Desligada" ainda tira 61% (a câmera sempre faz
alguma redução); "Forte" tira 96%. Ressalva: os grupos são cenas diferentes (a série T, toda com
redução Baixa, é outra cena); para comparar Baixa × Padrão no mesmo ISO, faltam fotos da mesma
cena com as duas (sugestão para a Rodada 2).

Limites em `THRESHOLDS` (`core/indicators.js`): mudança de 15% para virar achado (só 2 das 26
ficaram abaixo); redução de ruído só é citada com σ do RAW a partir de 0,8 (abaixo disso o ruído
não aparece na foto); brilho dos recortes a mais de 12 níveis = comparação aproximada.

## Próximos passos

- Fazer a **T09** (temporizador 10 s), a **T08 em 300 mm** e, se possível, a **T06** (através do vidro). Depois rodar o conferidor e `metricas.mjs` de novo para comparar T02 × T08 × T09 em 300 mm.
- Com as avaliações da v0.3 (nítida / tremida / fora de foco...), transformar a nitidez relativa em faixas por cena e lente.
- **Rodada 2 (sugestão da v0.6)**: a mesma cena em ISO 400 e 800 com a redução de ruído Baixa e
  Padrão, em RAW + JPEG, para medir pelo importador quanto detalhe cada uma apaga.
- **Rodada 2**: trocar as regras gerais do diagnóstico pelos números do equipamento e da mão do Guilherme (blocos M e Z: tremido; I: ISO; A: abertura da RF 50; D: margem do foco errado; E: compensação do céu). Ver decisão 0013.
