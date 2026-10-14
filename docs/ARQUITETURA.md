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
   ao mudar um cálculo, a versão sobe e as fotos são recalculadas. **Desde a v2.0** (decisão 0017),
   `#/reprocessar` refaz as fotos com medidas antigas (`core/reprocess.js` monta o plano,
   `pipeline/reprocess.js` processa uma por vez pela fila de `analyze.js`), baixando do Drive o
   original que não está no aparelho, medindo e descartando.
7. **Desde a v0.5.0** (`METRICS_VERSION` 2): o recorte do foco também mede o **desfoque**
   (Crété-Roffet, `blurEffect`) e, só na versão principal, a foto inteira: **histograma** com
   estouro e pretos (`histogramStats`) e **assinatura** 8×8 (`signature`) numa cópia de 600 px,
   e **12 trechos de 256 px a 100%** numa grade 4 × 3 (desfoque e detalhe de cada um), em
   `analysis.whole`.

## Diagnóstico com orientação (v0.5.0)

Tudo puro, em `core/`, e calculado na hora a partir do registro (nada é guardado; decisão 0013):

- `core/exposure.js`: EV a ISO 100, ISO e velocidade que expõem uma cena, escalas de 1/3 de
  ponto da EOS RP, profundidade de campo e disco de difração.
- `core/lens-profiles.js`: RF 50 e RF 75-300 (sem estabilização), abertura máxima por focal
  (o arquivo vence a tabela: `Canon:MaxAperture`) e faixa mais nítida, com a origem de cada
  número (calibração ou regra geral).
- `core/diagnosis.js`: `sceneLightOf` (fotômetro da câmera → exposição + compensação → brilho
  no modo M), `focusAssessment` (recorte do foco × trechos), `possibleSettings` (combinação à
  mão e com apoio para a luz da cena) e `diagnosePhoto`: veredito, achados com número, origem
  (`sources`) e certeza, orientação para a próxima captura e o que faltou (regra 5). Limites em
  `LIMITS`, com a amostra que justifica cada um.
- Telas: `ui/diagnosis-card.js` monta o cartão **Diagnóstico** no topo da ficha; a grade mostra
  o veredito (`diagnosisChip`); a tela Avaliar usa a mesma luz da cena.

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

## Importador no PC e pacote de sessão (v0.6)

Decisão 0015. O importador **entrega arquivos**: não calcula indicadores (regra 6) e não fala
com o Drive (o site no PC importa e sincroniza).

```
importador/ (Python 3.13, importador/.venv)      site no navegador do PC
 scan.py      disparos do cartão (JPEG + CR3)      Enviar → Importar pacote do PC
 exiftool.py  ExifTool nativo, -json -l -G1        core/package-format.js  valida pacote.json
 render.py    LibRaw/rawpy → PNG neutro            pipeline/import-package.js  um item da fila
 package.py   <dia>_<nome>.efsessao/                 por disparo: JPEG e CR3 pela ingestão normal
 __main__.py  janela + confirmação + progresso       (com o JSON do pacote) + versão raw_neutral
 importar.bat duplo clique                         análise normal → recortes; PNG apagado
```

- **Revelação neutra** (`render.py`): AHD, balanço de branco da câmera, sRGB, sem redução de
  ruído, sem nitidez, sem correção da lente; renderiza em 16 bits lineares, corta no **recorte
  que o próprio CR3 informa** (o mesmo enquadramento do JPEG da câmera em 3:2, 16:9 e recorte
  1,6x, conferido pixel a pixel nas 26 amostras) e passa para 8 bits com a **curva de tons do
  JPEG da câmera**, tirada do histograma dele (uma tabela de 65 536 valores por canal, sempre
  crescente). A curva só muda brilho e contraste de cada valor; ruído, nitidez e detalhe ficam
  como o sensor captou. Sem JPEG do mesmo tamanho, curva sRGB (e a ficha avisa que a comparação
  é aproximada). PNG nível 3: ~27 MB e ~4 s por foto da EOS RP.
- **No site**: a versão `raw_neutral` repete a captura do CR3 (`from_variant`) e é
  `transient`: `pipeline/analyze.js` a mede como as outras e, ao gravar, apaga a imagem inteira
  (`dropBlobs`). Nunca é a versão principal; vem primeiro na cadeia e a **etapa sensor**
  (`sensorStep`, `core/indicators.js`) a compara com a principal nos mesmos recortes: redução
  de ruído, realce de nitidez, detalhe apagado, com os limites em `THRESHOLDS.sensor_*`.
- `core/drive-layout.js`: só os recortes dela vão ao Drive (nem original, nem metadados).
- Testes: `npm run test:py` (pytest, rawpy e ExifTool simulados) faz parte do `npm test`;
  `tests/e2e/v06-importador.spec.mjs` importa um pacote sintético gerado pelas fixtures.
  Conferência local com as amostras: `tests/amostras/revelar.py`, `pacote-amostras.py` e
  `sensor.mjs`.

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

Outras abas: uma aba aberta com uma versão antiga segura o banco e impede a atualização dele
(`blocked`). O `openDb` não desiste: avisa (`dbEvents`, faixa no topo da página) e continua
quando a outra aba fecha. Cada conexão fecha sozinha quando uma versão mais nova pede o banco
(`versionchange`) e pede para recarregar.

## Atualização do app (v0.5.3)

`pipeline/app-update.js` busca `js/version.js?check=…` (sem cache; o service worker deixa passar)
ao abrir, ao voltar para a tela, ao voltar a internet e a cada 30 min, e compara com a versão em
execução (`core/app-version.js`). A sincronização trata `NewerDataError` (`core/drive-layout.js`,
um `sessao.json` com `schema_version` maior que o deste app): para tudo, sem enviar nada, e pede
a atualização. `app.js` mostra o aviso em `#app-alert` com o botão **Atualizar agora**.

## Cenas (v0.5.1)

Decisão 0014. Puro, calculado na hora a partir das fotos da sessão:

- `core/scenes.js`: `boundary` (por que uma foto começa uma cena nova: pausa, lente, zoom,
  enquadramento pela assinatura 8×8), `autoSplit`, `sessionScenes` (cenas fixadas pelo usuário
  + automáticas; numeradas pela foto mediana) e `planMove` (congela a separação e move). Limites
  em `SCENE_LIMITS`.
- `core/scene-diagnosis.js`: `diagnoseScene` (vereditos, problema e ajuste principal, mais
  nítida × mais mole, variação dos ajustes com aviso de dois ajustes ao mesmo tempo) e
  `diagnoseSession`.
- `pipeline/organize.js`: `movePhotosToScene` e `resetScenes`; `assignPhotos` limpa a cena ao
  trocar de sessão.
- `ui/scene-drag.js`: toque longo, arrastar, rolagem automática na borda e soltar (eventos de
  ponteiro; `touchmove` não passivo para a tela não rolar enquanto a foto está levantada). A tela
  da sessão adia as atualizações enquanto uma foto está sendo arrastada.

## Sessões e avaliação (v0.3)

`pipeline/organize.js` grava avaliações (`setRating`) e sessões (criar, editar, excluir, mover
fotos). Toda mudança numa foto é feita dentro de `withLock` (a mesma trava por disparo da
ingestão e da análise) e relida dentro da trava, para não perder uma avaliação feita enquanto
a análise roda. Eventos: `changed` (uma foto) e `sessions` em `photoEvents`.
A tela de avaliação é montada uma vez e só troca a imagem e repinta os controles
(`ui/rating-controls.js`); o endereço muda com `history.replaceState`, sem recriar a tela.
Desde a v0.3.1 a avaliação é nitidez 1–5 + problema principal (sintoma) + onde/luz/assunto
(decisão 0012); a tela mostra a luz da cena, calculada na hora a partir dos metadados (desde a
v0.5.0, a mesma do diagnóstico: `sceneLightOf`, `core/diagnosis.js`).

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
