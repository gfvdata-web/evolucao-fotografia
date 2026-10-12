# Modelo de dados

Versão atual do esquema: **3** (`SCHEMA_VERSION` em `site/js/core/model.js`).
Todo documento guardado leva `schema_version` e é migrado na leitura (`core/migrations.js`).
Chaves em inglês, `snake_case`.

## Foto (registro no IndexedDB `photos`; na v0.4 também em `sessao.json`)

```jsonc
{
  "schema_version": 3,
  "id": "012345678901-20261010T143012.45-IMG_0001",   // estável; nunca muda depois de criado
  "match_key": "20261010T143012.45-IMG_0001",          // sem a série: pareia versões do disparo
  "session_id": "ses-20261010-k3x9ab",                 // v0.3; null = sem sessão
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
  "rating": {                                          // v0.3; null = não avaliada
    "category": "sharp",       // sharp | noise | shake | out_of_focus | pixelated_upload | other
    "score": 4,                // 1–5 ou null
    "light": "shade",          // harsh_sun | shade | overcast | indoor | night ou null
    "subject": "still",        // still | moving ou null
    "note": "",
    "rated_at": "..."          // última mudança
  }
}
```

Uma foto conta como **avaliada** quando tem `category` (`core/rating.js`). Os valores são
guardados em inglês e traduzidos na tela (`RATING_LABELS` em `core/glossary.js`). Avaliação
toda vazia volta a `null`.

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
  "kind": "jpeg" | "cr3",
  "source": "web" | "importer",
  "file": { "name", "size", "type", "last_modified" },
  "pixels": { "width": 6240, "height": 4160, "decoded_from": "jpeg" | "cr3-embedded-jpeg" },
  "metadata_status": "pending" | "quick" | "complete" | "failed",
  "engines": ["exifr@7.1.3", "exiftool@13.42"],
  "capture": { /* o que ESTE arquivo contém */ },
  "missing": [ ... ],
  "tag_count": 277,                // campos de metadados que o ExifTool achou no arquivo
  "analysis": {                    // pixels (v0.2); null até a análise rodar
    "metrics_version": 1,
    "analyzed_at": "...",
    "decoded": { "width": 6240, "height": 4160 },
    "jpeg": { "quality_estimate": 97, "sampling": "4:2:2", ... },
    "af":      { "rect": {...}, "px": { "w": 512, "h": 512 }, "laplacian_var": 139, "sigma": 0.3, "mean_luma": 120, "source": "makernote" },
    "uniform": { "rect": {...}, "px": { "w": 256, "h": 256 }, "laplacian_var": 2, "sigma": 0.25, "mean_luma": 151, "source": "auto" }
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

### Captura (`capture`)

| Campo | Exemplo | Origem |
|---|---|---|
| `datetime_original` | `2026-10-10T14:30:12.45-03:00` | EXIF |
| `camera.{make, model, serial, firmware}` | `Canon`, `Canon EOS RP` | EXIF / Canon |
| `lens.{model, focal_length_mm}` | `RF50mm F1.8 STM`, `50` | EXIF |
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
  "schema_version": 3,
  "id": "ses-20261010-k3x9ab",        // ses-<AAAAMMDD | semdata>-<6 caracteres aleatórios>
  "name": "Sessão de 10/10/2026",     // vazio volta a este padrão
  "date": "2026-10-10",               // ou null
  "location": "", "notes": "",
  "experiment": null,                 // ou { "parameter": "iso", "description": "100 a 12800" }
  "created_at": "...", "updated_at": "..."
}
```

O vínculo fica só na foto (`session_id`); a sessão não lista as fotos. `experiment.parameter`:
`iso`, `shutter`, `aperture`, `focal_length`, `lens`, `af_mode`, `af_area`, `drive_mode` (lidos
da foto, e a sessão mostra o valor de cada uma), `transfer` e `other` (só a descrição). Sessões
usam o mesmo `SCHEMA_VERSION`, com migrações próprias (`SESSION_MIGRATIONS`); a versão 3 é a
primeira. Ver decisão 0009.

## Indicadores (`indicators`, calculados em `core/indicators.js`)

```jsonc
{
  "metrics_version": 1, "computed_at": "...", "primary_variant": "jpeg-web",
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

Banco `evolucao-fotografia`, versão 2: stores `photos` (índice `session_id` desde a versão 2), `blobs`, `raw_metadata`, `meta` e `sessions` (versão 2)
(detalhes em ARQUITETURA.md). Os recortes a 100% ficam em `blobs`, como PNG, na chave
`<id>/crop/<variante>/<af|uniform>`. O JSON completo do ExifTool fica em `raw_metadata`, fora do
registro, para manter a lista leve.

## Google Drive (planejado para a v0.4)

```
EvolucaoFotografia/
├── indice.json          { schema_version, updated_at, sessions: [{id, name, date, folder_id, photo_count, ...}] }
├── config.json          preferências comuns a tablet e PC
└── <AAAA-MM-DD>_<nome>_<id curto>/
    ├── sessao.json      { schema_version, session: {..., experiment}, photos: [ ... ] }
    ├── _historico/      últimas N versões datadas de sessao.json
    ├── originais/       JPEG / CR3 (configurável)
    ├── previas/  recortes/  metadados/<id>.json
```
Cada arquivo leva `appProperties` (tipo e sessão), para recuperar a estrutura se o índice se
perder. Conflitos tablet × PC: junção foto a foto, vence o `updated_at` mais recente.

## Migrações

| De → para | O que muda |
|---|---|
| 0 → 1 | Marca documentos sem versão como versão 1 (modelo da etapa). |
| 1 → 2 (v0.2) | Acrescenta `crop_choice` (automático), `crops: null` e, em cada variante, `tag_count: null` e `analysis: null`. Os indicadores são calculados quando a foto é aberta ou pelo botão da aba Sobre. |
| 2 → 3 (v0.3) | Garante `session_id` e `rating` (já existiam, sempre `null`). O banco local passa da versão 1 para a 2 (store `sessions` e índice `session_id`). |
