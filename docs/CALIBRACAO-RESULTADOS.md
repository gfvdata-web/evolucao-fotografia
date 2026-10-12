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

## Próximos passos

- Fazer a **T09** (temporizador 10 s), a **T08 em 300 mm** e, se possível, a **T06** (através do vidro). Depois rodar o conferidor e `metricas.mjs` de novo para comparar T02 × T08 × T09 em 300 mm.
- Com as avaliações da v0.3 (nítida / tremida / fora de foco...), transformar a nitidez relativa em faixas por cena e lente.
