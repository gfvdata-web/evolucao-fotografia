# Modelo de dados

Versão atual do esquema: **7** (`SCHEMA_VERSION` em `site/js/core/model.js`).
Todo documento guardado leva `schema_version` e é migrado na leitura (`core/migrations.js`).
Chaves em inglês, `snake_case`.

## Foto (registro no IndexedDB `photos`; na v0.4 também em `sessao.json`)

```jsonc
{
  "schema_version": 6,
  "id": "012345678901-20261010T143012.45-IMG_0001",   // estável; nunca muda depois de criado
  "match_key": "20261010T143012.45-IMG_0001",          // sem a série: pareia versões do disparo
  "session_id": "ses-20261010-k3x9ab",                 // v0.3; null = sem sessão
  "scene_id": "cena-k3x9ab",                           // v0.5.1; null = separação automática das cenas
  "added_at": "2026-10-10T18:00:00.000Z",
  "updated_at": "...",
  "variants": [ /* uma por arquivo da mesma foto, ver abaixo */ ],
  "capture": { /* junção das variantes: CR3 > JPEG completo > demais */ },
  "missing": ["focus.af_point"],                       // campos esperados sem valor em capture
  "preview": { "width": 2048, "height": 1365, "from_variant": "jpeg-web" },
  "crop_choice": { "af": { "cx": 0.62, "cy": 0.4 }, "uniform": null },  // toque na prévia; null = automático
  "crops": {                                            // regiões usadas nos recortes a 100%
    "primary_variant": "jpeg-web",
    "af": { "rect": { "x": 0.58, "y": 0.34, "w": 0.082, "h": 0.123 }, "source": "makernote" },
    "uniform": { "rect": { ... }, "source": "auto" }    // ou null
  },
  "indicators": { /* ver Indicadores */ },
  "rating": {                                          // v0.3.1 (esquema 4); null = não avaliada
    "sharpness": 4,            // 1–5 no que o usuário queria nítido, ou null
    "problem": "none",         // none | soft | missed_focus | motion_blur | grain | blocky | other ou null
    "place": "outdoor",        // indoor | outdoor ou null
    "light": "medium",         // strong | medium | weak (luz percebida) ou null
    "subject": "still",        // still | moving ou null
    "note": "",
    "rated_at": "..."          // última mudança
  }
}
```

Uma foto conta como **avaliada** quando tem `sharpness` **e** `problem` (`core/rating.js`).
`problem` é o sintoma visto ao ampliar, não a causa: mole por inteiro, foco no lugar errado,
arrastada, granulada, quadriculada ao ampliar (decisão 0012). Os valores são guardados em inglês
e traduzidos na tela (`RATING_LABELS` em `core/glossary.js`). Avaliação toda vazia volta a
`null`. A luz da cena (`sceneLightOf`) e todo o diagnóstico (`diagnosePhoto`, ambos em
`core/diagnosis.js`, v0.5.0) não são guardados: saem do registro na hora (decisão 0013).

`crop_choice` e `crops.*.rect` são normalizados (0–1) **no quadro da prévia**
(`preview.from_variant`), já na orientação de exibição. `source`: `manual` (toque),
`makernote` (ponto de AF da câmera), `center` (sem AF) ou `auto` (busca da área uniforme).

### Identidade

- `id` = `<série>-<AAAAMMDDTHHMMSS[.ss]>-<NOME>`; sem série: `semserie-...`.
- Sem data de captura: `semexif-<hash de 16 hex>-<NOME>` (hash de tamanho + primeiros 256 KB).
- Uma variante nova se junta ao registro com o mesmo `id` **ou** o mesmo `match_key`.

### Variante

```jsonc
{
  "key": "jpeg-web",               // <tipo>-<origem>[-n]
  "kind": "jpeg" | "cr3" | "raw_neutral",   // raw_neutral: v0.6, ver abaixo
  "source": "web" | "importer",
  "file": { "name", "size", "type", "last_modified" },
  "pixels": { "width": 6240, "height": 4160, "decoded_from": "jpeg" | "cr3-embedded-jpeg" | "libraw" },
  "metadata_status": "pending" | "quick" | "complete" | "failed",
  "engines": ["exifr@7.1.3", "exiftool@13.42"],
  "capture": { /* o que ESTE arquivo contém */ },
  "missing": [ ... ],
  "tag_count": 277,                // campos de metadados que o ExifTool achou no arquivo
  "analysis": {                    // pixels (v0.2); null até a análise rodar
    "metrics_version": 2,
    "analyzed_at": "...",
    "decoded": { "width": 6240, "height": 4160 },
    "jpeg": { "quality_estimate": 97, "sampling": "4:2:2", ... },
    "af":      { "rect": {...}, "px": { "w": 512, "h": 512 }, "laplacian_var": 139, "sigma": 0.3, "mean_luma": 120, "source": "makernote",
                 "blur": { "blur": 0.26, "x": 0.24, "y": 0.26, "detail": 1.72 } },   // v0.5.0 (Crété-Roffet)
    "uniform": { "rect": {...}, "px": { "w": 256, "h": 256 }, "laplacian_var": 2, "sigma": 0.25, "mean_luma": 151, "source": "auto", "blur": {...} },
    "whole": {                     // v0.5.0, só na versão principal; null nas outras
      "histogram": { "bins": [64 frações], "mean": 118, "p05": 20, "p50": 112, "p95": 230, "clip_high": 0.004, "clip_low": 0.0 },
      "signature": { "grid": [64 brilhos 0–255], "rgb": [120, 118, 110] },   // para separar cenas (v0.5.1)
      "tiles": [ { "rect": {...}, "col": 0, "row": 0, "blur": { "blur", "x", "y", "detail" }, "laplacian_var": 80, "mean_luma": 130 } ]  // 12 trechos 256 px a 100%
    }
  },                               // ou { metrics_version, analyzed_at, error }
  "error": null
}
```

Guardar a captura por variante permite comparar etapas (cartão × tablet). Em `analysis`, cada
`rect` está no quadro **desta** variante: a mesma parte da cena aparece em posições relativas
diferentes quando as versões cobrem áreas diferentes do sensor (o JPEG dentro do CR3 é sempre o
sensor inteiro; o JPEG da câmera pode ser 16:9 ou recorte 1,6x). Ver `core/af-geometry.js`
(`mapRegion`) e `core/camera-profiles.js` (`sensorField`).

A captura de cada variante é refeita a partir do JSON do ExifTool guardado em `raw_metadata`
toda vez que a foto é analisada. Assim, correções no normalizador também chegam às fotos já
guardadas.

### RAW sem processamento (`raw_neutral`, v0.6, esquema 7)

O CR3 revelado pelo importador no PC, sem redução de ruído, sem realce de nitidez e sem correção
da lente, com a curva de tons do JPEG da câmera (decisão 0015). Chave `raw_neutral-importer`,
`source: "importer"`. Campos a mais:

```jsonc
{
  "from_variant": "cr3-importer",   // o CR3 de origem: a captura e o JSON do ExifTool são os dele
  "transient": true,                // a imagem inteira (PNG, ~27 MB) é medida uma vez e apagada
  "render": {                       // como o importador revelou (vem do pacote.json)
    "width": 6240, "height": 4160, "demosaic": "AHD", "white_balance": "camera", "color": "sRGB",
    "noise_reduction": "none", "sharpening": "none", "lens_correction": "none",
    "frame": { "x": 12, "y": 12, "width": 6240, "height": 4160 },  // recorte que o CR3 informa
    "frame_source": "cr3_crop", "flip": 0,
    "tone_curve": "camera_jpeg",      // ou "srgb" sem JPEG do mesmo tamanho (com "tone_note")
    "tone_matched_to": "IMG_9362.JPG", // curva tirada do histograma deste JPEG
    "median_luma": { "neutral": 131, "camera_jpeg": 131 }
  }
}
```

Nunca é a versão principal (o diagnóstico mede o JPEG); vem primeiro na cadeia e é comparada com
a versão principal na **etapa sensor** (`sensorStep` em `core/indicators.js`). Não gera original
nem metadados no Drive, só os recortes. Com `transient`, uma versão nova das métricas não pede a
reanálise dela: a medida antiga fica, e a ficha diz como atualizar (importar o CR3 de novo).

### Captura (`capture`)

| Campo | Exemplo | Origem |
|---|---|---|
| `datetime_original` | `2026-10-10T14:30:12.45-03:00` | EXIF |
| `camera.{make, model, serial, firmware}` | `Canon`, `Canon EOS RP` | EXIF / Canon |
| `lens.{model, focal_length_mm}` | `RF50mm F1.8 STM`, `50` | EXIF |
| `lens.max_aperture` (v0.5.0) | `5.66` (abertura máxima no zoom usado) | Canon `MaxAperture` |
| `exposure.measured_ev` (v0.5.0) | `12.125` (luz medida pelo fotômetro, EV a ISO 100; não muda com a compensação) | Canon `MeasuredEV` |
| `focus.distance` (v0.5.0) | `{near_m: 1.09, far_m: 1.2, far_infinite: false}` ou `null` (a RF 75-300 não grava) | Canon `FocusDistanceLower/Upper` |
| `exposure.program` | `Aperture-priority AE` | EXIF |
| `exposure.{shutter_s, aperture, iso, ev_comp}` | `0.004`, `1.8`, `400`, `-0.333` | EXIF |
| `exposure.metering` | `Evaluative` | Canon / EXIF |
| `focus.af_mode` / `focus.af_area_mode` | `One-shot AF` / `Single-point AF` | Canon |
| `focus.af_point` | ver abaixo | Canon AFInfo2 |
| `drive_mode` | `Single-frame Shooting` | Canon |
| `picture_style` | `Standard` | Canon |
| `noise_reduction.{high_iso, long_exposure}` | `Standard`, `Auto` | Canon |
| `image.{exif_width, exif_height, quality, canon_image_size, orientation}` | | EXIF / Canon |
| `white_balance`, `flash` | | Canon / EXIF |
| `gps` | `{lat, lon}` ou `null` | EXIF |

Enumerados ficam no texto em inglês do ExifTool; a tradução para pt-BR é feita na tela.
Em `exposure.program`, os modos automáticos da Canon (A+, cenas) usam o `EasyMode` (ex.:
`Scene Intelligent Auto`), porque o EXIF diz `Program AE` neles, igual ao P.

`focus.af_point`:
```jsonc
{ "af_image_width": 6240, "af_image_height": 4160, "y_axis": "up",
  "areas": [{ "x": -1560, "y": 1040, "w": 312, "h": 312 }],   // relativo ao centro
  "in_focus": [0], "selected": [] }
```
`areas` traz só as `ValidAFPoints` primeiras posições: na EOS RP as listas sempre têm 143
posições, e com AF em 1 ponto as outras 142 são zeros.

## Sessão (store `sessions`, v0.3; na v0.4 também em `sessao.json`)

```jsonc
{
  "schema_version": 6,
  "id": "ses-20261010-k3x9ab",        // ses-<AAAAMMDD | semdata>-<6 caracteres aleatórios>
  "name": "Sessão de 10/10/2026",     // vazio volta a este padrão
  "date": "2026-10-10",               // ou null
  "location": "", "notes": "",
  "experiment": null,                 // ou { "parameter": "iso", "description": "100 a 12800" }
  "created_at": "...", "updated_at": "..."
}
```

O vínculo fica só na foto (`session_id`); a sessão não lista as fotos. O mesmo vale para as
**cenas** (v0.5.1, decisão 0014): `scene_id` na foto, `null` enquanto a separação é automática.
Ao mover uma foto de cena, todas as fotos da sessão recebem o id da cena em que estavam
(`cena-` + 6 caracteres); trocar a foto de sessão volta o `scene_id` a `null`. As cenas não têm
documento próprio: número, horário e diagnóstico são calculados na hora (`core/scenes.js`,
`core/scene-diagnosis.js`). `experiment.parameter`:
`iso`, `shutter`, `aperture`, `focal_length`, `lens`, `af_mode`, `af_area`, `drive_mode` (lidos
da foto, e a sessão mostra o valor de cada uma), `transfer` e `other` (só a descrição). Sessões
usam o mesmo `SCHEMA_VERSION`, com migrações próprias (`SESSION_MIGRATIONS`); a versão 3 é a
primeira, e da 4 à 6 o formato não mudou. Ver decisão 0009.

## Indicadores (`indicators`, calculados em `core/indicators.js`)

```jsonc
{
  "metrics_version": 2, "computed_at": "...", "primary_variant": "jpeg-web",
  "resolution": { "status", "text", "per_variant": [{ "key", "kind": "native|camera_size|crop_mode|path_reduced|no_profile", ... }] },
  "metadata":   { "status", "text", "per_variant": [ ... ] },
  "shake":      { "status", "text", "ratio": 3.33, "shutter_s", "focal_mm", "equivalent_focal_mm", "reference_s" },
  "sharpness":  { "status": "info", "value": 139, "variant", "source", "text" },
  "noise":      { "status": "info", "value": 0.25, "mean_luma": 151, "variant", "text" },
  "jpeg":       { "status": "info", "per_variant": [ ... ], "text" },
  "chain":      { "status", "versions": [ ... ], "steps": [{ "from", "to", "findings": [{ "kind", "severity", "text" }] }] }  // ou null
}
```
`status`: `unknown` < `ok` < `info` < `attention` < `alert`. Os limites ficam em `THRESHOLDS`.
A versão principal (`primary_variant`) é a de mais pixels; no empate, o JPEG da câmera, e não o
JPEG embutido no CR3, que é mais comprimido. Mudou um cálculo ou um limite? Suba
`METRICS_VERSION`: as fotos guardadas são recalculadas a partir dos originais.

## IndexedDB

Banco `evolucao-fotografia`, versão 3: stores `photos` (índice `session_id` desde a versão 2), `blobs`, `raw_metadata`, `meta` (configurações), `sessions` (versão 2) e `sync` (versão 3: o que já foi para o Drive, lápides e envios em andamento; ver `storage/sync-repo.js`)
(detalhes em ARQUITETURA.md). Os recortes a 100% ficam em `blobs`, como PNG, na chave
`<id>/crop/<variante>/<af|uniform>`. O JSON completo do ExifTool fica em `raw_metadata`, fora do
registro, para manter a lista leve.

## Google Drive (v0.4)

Detalhes e alternativas: decisão 0010. Código: `core/drive-layout.js` (o quê e onde) e
`pipeline/sync.js` (quando).

```
EvolucaoFotografia/                       appProperties ef_kind=root
├── indice.json                           ef_kind=indice
├── config.json                           ef_kind=config
├── _sem_sessao/                          fotos sem sessão (mesma estrutura de uma sessão)
└── <AAAA-MM-DD>_<nome>_<id curto>/       ef_kind=session, ef_session=<id da sessão | none>
    ├── sessao.json                       ef_kind=sessao
    ├── _historico/sessao_<data>.json     ef_kind=historico (últimas N, padrão 10)
    ├── originais/<nome>__<variante>.<ext>        JPEG (padrão sim) / CR3 (padrão não)
    ├── previas/<id da foto>.jpg
    ├── recortes/<id>__<variante>__<af|uniform>.png
    └── metadados/<id>__<variante>.json   JSON completo do ExifTool
```
Subpastas: `ef_kind=sub`, `ef_sub=<nome>`. Arquivos de foto: `ef_kind=asset`, `ef_photo`,
`ef_asset` (`preview`, `crop/<variante>/<af|uniform>`, `metadata/<variante>`,
`original/<variante>`).

```jsonc
// sessao.json
{
  "schema_version": 6, "kind": "efsessao", "app_version": "0.5.1", "written_at": "...",
  "session": { /* documento da sessão */ } ,          // null em _sem_sessao
  "photos": [ { /* registro da foto */ ,
               "drive_assets": { "preview": { "id": "...", "sig": "jpeg-web", "size": 123 }, ... } } ],
  "deleted_photos": [ { "id": "...", "at": "..." } ]  // lápides: o outro aparelho apaga também
}
// indice.json
{ "schema_version": 6, "kind": "efindice", "sessions": [ {id, name, date, updated_at} ],
  "deleted_sessions": [ { "id", "at" } ] }
// config.json
{ "schema_version": 1, "kind": "efconfig", "updated_at": "...", "settings": { /* abaixo */ } }
```

Com "Guardar a localização" desligado, `capture.gps` vai `null` (na foto e em cada variante),
as tags `GPS*` saem do JSON do ExifTool e os originais vão com o bloco de GPS zerado. Junção
entre aparelhos: por foto, sessão e configurações, vence o `updated_at` mais novo.

## Configurações (`meta` → `settings`; no Drive, `config.json`)

| Campo | Padrão | O que faz |
|---|---|---|
| `keep_jpeg` | `true` | envia os JPEG originais |
| `keep_cr3` | `false` | envia os CR3 originais |
| `keep_gps` | `false` | mantém a localização no que vai para o Drive |
| `history_versions` | `10` | cópias de `sessao.json` em `_historico/` |
| `drive_limit_gb` | `100` | acima disso, os originais ficam esperando |
| `updated_at` | — | quando mudaram (junção tablet × PC) |

## Backup local (`.efbackup`, v0.4)

ZIP sem compressão (`core/zip.js`): `backup.json` (`kind: "efbackup"`, `format_version: 1`,
`settings`, `sessions`, `photos`, `raw_metadata` por `"<id>/<variante>"`) e `blobs/<chave
codificada>` (prévias, recortes e, se pedido, originais). Importar junta com a mesma regra do
Drive. Sem ZIP64: até 4 GB.

## Pacote do importador (`.efsessao/`, v0.6)

Pasta (não ZIP; uma sessão passa de 4 GB) escrita por `importador/package.py` e lida por
`core/package-format.js` + `pipeline/import-package.js`. Uma por dia de fotos:

```
<AAAA-MM-DD>_<nome>.efsessao/
├── pacote.json                  kind "efpacote", format_version 1
├── originais/<arquivo do cartão>   JPEG e CR3 sem alteração
├── metadados/<arquivo>.json     saída do ExifTool (-json -l -G1), sem caminhos do PC
└── neutro/<nome>.png            revelação neutra de cada CR3 (PNG 8 bits, tamanho cheio)
```

```jsonc
{
  "kind": "efpacote", "format_version": 1, "importer_version": "0.6.0", "created_at": "...",
  "day": "2026-10-12", "name": "cartao",
  "engines": { "libraw": "0.22.1", "rawpy": "0.27.1", "exiftool": "13.42" },
  "shots": [{
    "name": "IMG_9362",
    "files": [{ "file": "originais/IMG_9362.JPG", "kind": "jpeg", "size": 9000000, "metadata": "metadados/IMG_9362.JPG.json" }, ...],
    "neutral": { "file": "neutro/IMG_9362.png", "from": "originais/IMG_9362.CR3", "render": { /* acima */ } },  // ou null
    "problems": []                // textos para a tela (ex.: CR3 que o LibRaw não abriu)
  }]
}
```
`metadata: null` = o ExifTool não leu o arquivo; o site lê com o ExifTool-WASM. Caminhos fora de
`originais/`, `metadados/` ou `neutro/` são recusados. Exemplo canônico, conferido pelos testes
dos dois lados: `importador/tests/pacote-exemplo.json`. O tipo `efsessao` continua sendo o do
`sessao.json` no Drive.

## Migrações

| De → para | O que muda |
|---|---|
| 0 → 1 | Marca documentos sem versão como versão 1 (modelo da etapa). |
| 1 → 2 (v0.2) | Acrescenta `crop_choice` (automático), `crops: null` e, em cada variante, `tag_count: null` e `analysis: null`. Os indicadores são calculados quando a foto é aberta ou pelo botão da aba Sobre. |
| 2 → 3 (v0.3) | Garante `session_id` e `rating` (já existiam, sempre `null`). O banco local passa da versão 1 para a 2 (store `sessions` e índice `session_id`). |
| 3 → 4 (v0.3.1) | Avaliação por sintoma (decisão 0012). Passa só o que tem o mesmo sentido: `sharp`→`none`, `noise`→`grain`, `shake`→`motion_blur`, `pixelated_upload`→`blocky`, `other`; `harsh_sun`→fora + forte, `shade`/`overcast`→fora, `indoor`→dentro; assunto e nota. `out_of_focus`, `score` e `night` viram "não marcado". `sharpness` fica `null`, então a foto volta a "não avaliada". Sessões: só a versão. |
| — (v0.4) | Registros sem mudança (esquema 4). O banco local passa para a versão 3 (store `sync`). |
| 4 → 5 (v0.5.0) | A captura (da foto e de cada variante) ganha `lens.max_aperture`, `exposure.measured_ev` e `focus.distance`, todos `null` até a próxima análise reler o JSON do ExifTool guardado. `METRICS_VERSION` 2: desfoque, histograma, assinatura e trechos, recalculados a partir dos originais do aparelho. Sessões: só a versão. |
| 5 → 6 (v0.5.1) | Cenas: `scene_id: null` (separação automática) em toda foto. Sessões: só a versão. |
| 6 → 7 (v0.6) | Variante nova `raw_neutral` (importador); nenhuma foto antiga a tem, então só a versão muda. Fotos e sessões. Um aparelho com o app antigo que encontra um `sessao.json` 7 no Drive para de enviar e pede a atualização (v0.5.3). |
