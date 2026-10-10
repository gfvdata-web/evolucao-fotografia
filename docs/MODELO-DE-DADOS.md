# Modelo de dados

Versão atual do esquema: **1** (`SCHEMA_VERSION` em `site/js/core/model.js`).
Todo documento guardado leva `schema_version` e é migrado na leitura (`core/migrations.js`).
Chaves em inglês, `snake_case`.

## Foto (registro no IndexedDB `photos`; na v0.4 também em `sessao.json`)

```jsonc
{
  "schema_version": 1,
  "id": "012345678901-20261010T143012.45-IMG_0001",   // estável; nunca muda depois de criado
  "match_key": "20261010T143012.45-IMG_0001",          // sem a série: pareia versões do disparo
  "session_id": null,                                   // v0.3
  "added_at": "2026-10-10T18:00:00.000Z",
  "updated_at": "...",
  "variants": [ /* uma por arquivo da mesma foto, ver abaixo */ ],
  "capture": { /* junção das variantes: CR3 > JPEG completo > demais */ },
  "missing": ["focus.af_point"],                       // campos esperados sem valor em capture
  "preview": { "width": 2048, "height": 1365, "from_variant": "jpeg-web" },
  "indicators": null,                                   // v0.2 (com metrics_version)
  "rating": null                                        // v0.3
}
```

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
  "error": null
}
```

Guardar a captura por variante permite comparar etapas (cartão × tablet) na v0.2.

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

`focus.af_point`:
```jsonc
{ "af_image_width": 6240, "af_image_height": 4160, "y_axis": "up",
  "areas": [{ "x": -1560, "y": 1040, "w": 312, "h": 312 }],   // relativo ao centro
  "in_focus": [0], "selected": [] }
```

## IndexedDB

Banco `evolucao-fotografia`, versão 1: stores `photos`, `blobs`, `raw_metadata`, `meta`
(detalhes em ARQUITETURA.md). O JSON completo do ExifTool fica em `raw_metadata`, fora do
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
