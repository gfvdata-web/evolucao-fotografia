# Arquitetura

## Visão geral

```
Tablet / PC (navegador)
 ├─ UI: HTML + CSS + JavaScript puro (módulos ES, sem build)
 ├─ Worker de metadados: ExifTool-WASM (MakerNotes, CR3)        ← exifr no thread principal (rápido)
 ├─ Worker de mídia: decodifica, gera prévia, recortes a 100% e métricas de pixels
 ├─ IndexedDB: fotos, sessões, arquivos originais, prévias, metadados completos
 ├─ Service worker (sw.js): o app instalado abre sem internet
 └─ Cliente Drive (REST) + token GIS ⇄ Google Drive /EvolucaoFotografia (v0.4)
PC Windows (v0.6): importador Python → pacote .efsessao → mesmo botão de envio
GitHub: só código. Actions roda os testes e publica site/ no Pages se tudo passar.
```

## Fluxo de entrada de uma foto (v0.1)

`pipeline/ingest.js`, um arquivo por vez (fila em `pipeline/upload-queue.js`):

1. **Tipo pelo conteúdo** (`FF D8 FF` = JPEG; caixa `ftyp` com marca `crx ` = CR3). Outros são
   recusados com mensagem.
2. **Leitura rápida** (JPEG): exifr nos primeiros 192 KB → data, câmera, exposição, lente, GPS.
3. **Leitura completa**: ExifTool-WASM no worker. Para CR3 (que o exifr não lê) ou JPEG sem data,
   acontece antes de gravar; para JPEG normal, em segundo plano depois de gravar.
4. **Identidade** (`core/ids.js`): `id` = série + data/hora com subsegundos + nome; `match_key`
   sem a série. Um registro existente com o mesmo id ou a mesma chave recebe o arquivo como nova
   *variante* (JPEG + CR3 = uma foto). Mesmo nome e tamanho = repetido, ignorado.
5. **Prévia** (worker de mídia): decodifica com `createImageBitmap` (aplica a orientação EXIF;
   para CR3 a orientação é aplicada à mão), reduz para 2048 px no lado maior, JPEG 85%.
6. **Grava** no IndexedDB numa transação: registro + original + prévia + JSON do ExifTool.
7. Leituras em segundo plano atualizam o registro sob uma trava por `match_key`, para o JPEG e o
   CR3 do mesmo disparo não sobrescreverem um ao outro.
8. Terminada a leitura completa, a foto entra na fila de análise (abaixo).

## Análise de pixels (v0.2)

`pipeline/analyze.js`, uma foto por vez (decodificar 26 MP pesa na memória do tablet):

1. Refaz a captura de cada versão a partir do JSON do ExifTool guardado (`raw_metadata`),
   para que correções no normalizador cheguem às fotos antigas.
2. **Versão principal** (`core/indicators.js` → `primaryVariant`): a de mais pixels; no empate,
   o JPEG da câmera (o JPEG dentro do CR3 é uma prévia mais comprimida: qualidade ~80 contra ~97
   nas amostras da EOS RP).
3. **Região do foco**: toque do usuário na prévia → ponto de AF da câmera → centro. 512 px na
   resolução cheia da versão principal. **Área uniforme**: toque, ou busca automática do bloco
   mais liso em tons médios (brilho 30–200; perto do branco a curva do JPEG achata o ruído).
4. **Mesma parte da cena em cada versão**: a região é convertida pelo campo de visão de cada
   arquivo (`core/camera-profiles.js` → `sensorField`; `core/af-geometry.js` → `mapRegion`).
   M e S mostram a mesma cena do L; 16:9, 4:3, 1:1 e recorte 1,6x são a parte central do
   sensor; o JPEG dentro do CR3 é sempre o sensor inteiro. Tamanho desconhecido (cópia
   reduzida): mesma posição relativa.
5. **Worker de mídia** (`media/media-worker.js`), por versão: lê o cabeçalho do JPEG (tabelas
   de quantização → qualidade estimada e subamostragem de cor, `core/jpeg-quality.js`), recorta
   a 100% sem reamostrar, mede (`core/image-metrics.js`) e grava o recorte em PNG.
6. **Indicadores** (`core/indicators.js`, puro): resolução, metadados, risco de tremido,
   nitidez (variância do Laplaciano), ruído (estimador de Immerkær), compressão e comparação
   entre versões. Valores descrevem, não aconselham. `METRICS_VERSION` vai em cada análise;
   ao mudar um cálculo, a versão sobe e as fotos são recalculadas.

## Leitura de metadados

- Saída do ExifTool pedida como `-json -l -G1`: cada tag vem como `"Grupo:Tag": {val, num}` —
  texto legível e número exato numa só leitura (~0,4 s por foto no desktop, ~1 s esperado no
  tablet; a primeira leitura baixa ~7,5 MB compactado e inicia o Perl em WebAssembly).
- `metadata/normalize.js` converte exifr e ExifTool para a mesma forma (`capture`). Valores
  enumerados ficam no texto em inglês do ExifTool; a tradução é só na tela.
- Ponto de AF Canon (AFInfo2): áreas relativas ao centro em coordenadas de AF, **Y positivo para
  cima** em corpos EOS (confirmado no código-fonte do ExifTool). `core/af-geometry.js` converte
  para a imagem exibida, considerando a orientação. As listas têm `NumAFPoints` posições (143
  na EOS RP), mas só as `ValidAFPoints` primeiras valem; o resto é zero.
- Modo de disparo: nos modos automáticos (A+, cenas) o EXIF diz `Program AE`, igual ao P. O
  normalizador usa `Canon:CanonExposureMode = Easy` + `Canon:EasyMode` para separar.

## CR3 no navegador

`metadata/cr3.js` lê só os cabeçalhos das caixas ISO-BMFF e localiza o primeiro track
(`moov/trak/mdia/minf/stbl` → `stsz` + `co64`), que é um JPEG em tamanho cheio feito pela câmera.
Esse JPEG é processado pela câmera (mesmo caminho do JPEG gravado), portanto **não substitui** a
renderização neutra do RAW, que fica com o importador Python.

## Armazenamento local (IndexedDB `evolucao-fotografia`, versão 3)

| Store | Chave | Conteúdo |
|---|---|---|
| `photos` | `id` | registro da foto (ver MODELO-DE-DADOS); índices `match_key`, `added_at`, `session_id` |
| `sessions` | `id` | sessão (v0.3) |
| `sync` | texto | estado do Drive (v0.4): `photo/<id>`, `session/<id>`, `folders`, `tombstones`, `trash`, `upload/<foto>/<arquivo>` |
| `blobs` | `<id>/original/<variante>`, `<id>/preview`, `<id>/crop/<variante>/<af\|uniform>` | arquivo original, prévia e recortes a 100% (PNG) |
| `raw_metadata` | `<id>/<variante>` | JSON completo do ExifTool |
| `meta` | texto | `settings` (configurações, v0.4) |

Toda leitura de registro passa por `migrate()`.

## Sessões e avaliação (v0.3)

`pipeline/organize.js` grava avaliações (`setRating`) e sessões (criar, editar, excluir, mover
fotos). Toda mudança numa foto é feita dentro de `withLock` (a mesma trava por disparo da
ingestão e da análise) e relida dentro da trava, para não perder uma avaliação feita enquanto
a análise roda. Eventos: `changed` (uma foto) e `sessions` em `photoEvents`.
A tela de avaliação é montada uma vez e só troca a imagem e repinta os controles
(`ui/rating-controls.js`); o endereço muda com `history.replaceState`, sem recriar a tela.

## Google Drive (v0.4)

- `config.js`: Client ID público do Google (vazio = Drive "não configurado").
- `drive/auth.js`: Google Identity Services, modelo de token (decisão 0005). Token só na
  memória; `renewOnGesture` renova no próximo toque (o navegador bloqueia janelas sem toque).
- `drive/api.js`: REST do Drive v3 com `fetch` injetável (testes usam `tests/lib/fake-drive.mjs`):
  listar por `appProperties`, pastas, envio multipart (até 5 MB) e "resumable" em partes de
  8 MB com retomada, mover, copiar, lixeira, baixar.
- `pipeline/sync.js`: traz → envia (decisão 0010). Gatilhos: mudanças locais (2 s depois),
  conexão, volta da internet, "Sincronizar agora". Wake Lock durante a execução.
  `core/drive-layout.js` decide o que vai e onde; `core/gps-strip.js` tira o GPS de uma cópia.
- `pipeline/backup.js`: `.efbackup` (ZIP de `core/zip.js`), exportar e importar com junção.
- `pwa.js` + `sw.js` + `manifest.webmanifest`: instalação, armazenamento protegido e cache
  (código: rede primeiro, cópia guardada sem internet; ExifTool e ícones: cópia primeiro).
  Os ícones PNG saem de `icons/icon.svg` por `node scripts/icons.mjs`.

## Telas

`#/enviar` (padrão), `#/drive` (Drive, configurações, backup, instalação), `#/sessoes`, `#/sessao/<id>`, `#/avaliar/<escopo>[/<fotoId>]` (escopo = id
da sessão, `sem-sessao` ou `todas`), `#/fotos`, `#/foto/<id>` (ficha; setas, teclado e
deslize), `#/sobre`.
Texto vindo de arquivos sempre entra via `textContent` (`ui/dom.js`).

## Publicação

`.github/workflows/ci-pages.yml`: job `testes` (`npm ci`, Chromium, `npm test`) e, só em `main`
e se passar, job `publicar` (`npm run vendor` + `upload-pages-artifact` da pasta `site/`).
