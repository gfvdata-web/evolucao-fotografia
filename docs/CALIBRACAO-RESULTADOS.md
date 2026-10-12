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
2. **Listas de AF com zeros sobrando:** `AFAreaXPositions`, `AFAreaYPositions` e `AFAreaWidths` vêm com dezenas de zeros depois dos valores úteis. Use `NumAFPoints` e `AFPointsInFocus` para saber quantos valores valem.
3. **No A+ com Face + Tracking:** o MakerNote traz uma grade inteira de pontos (13 colunas, de x = −2520 a +2520). O ponto que focou precisa sair de `AFPointsInFocus`, e não do primeiro da lista.
4. **CR3 traz tempo e abertura "exatos", não os nominais:** CR3 com 1/76 s e f/5.657, contra 1/80 s e f/5.6 no JPG da mesma foto. Para a ficha e para os indicadores, arredondar para a escala nominal de 1/3 de ponto ou preferir o valor do JPG quando houver par.
5. **Subsegundos são texto:** `SubSecTimeOriginal` vem como `"08"` (80 ms). Converter para número dá 8 e inverte a ordem dos quadros de uma rajada. O site usa `Composite:SubSecDateTimeOriginal` em texto e está correto. O conferidor tinha esse erro e foi corrigido.
6. **Grupo GPS vazio:** o JPG tem o grupo `GPS` mesmo sem localização (sem `GPSLatitude`). "Tem grupo GPS" não quer dizer "tem localização".

## Próximos passos

- Fazer a **T09** (temporizador 10 s) e, se possível, a **T06** (através do vidro).
- **T02, T08 e T09:** dizer se a vibração do toque no tripé tira nitidez em 300 mm. Na T08 a mão ficou apoiada na câmera.
- Quando o site tiver os recortes a 100% e a nitidez medida (v0.2), rodar essas mesmas fotos para calibrar as métricas.
