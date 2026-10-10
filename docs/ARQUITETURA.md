# Arquitetura

## Visão geral

```
Tablet / PC (navegador)
 ├─ UI: HTML + CSS + JavaScript puro (módulos ES, sem build)
 ├─ Worker de metadados: ExifTool-WASM (MakerNotes, CR3)        ← exifr no thread principal (rápido)
 ├─ Worker de mídia: decodifica, gera prévia (v0.2: recortes e métricas)
 ├─ IndexedDB: fotos, arquivos originais, prévias, metadados completos
 └─ (v0.4) Cliente Drive + token GIS ⇄ Google Drive /EvolucaoFotografia
PC Windows (v0.5): importador Python → pacote .efsessao → mesmo botão de envio
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

## Leitura de metadados

- Saída do ExifTool pedida como `-json -l -G1`: cada tag vem como `"Grupo:Tag": {val, num}` —
  texto legível e número exato numa só leitura (~0,4 s por foto no desktop, ~1 s esperado no
  tablet; a primeira leitura baixa ~7,5 MB compactado e inicia o Perl em WebAssembly).
- `metadata/normalize.js` converte exifr e ExifTool para a mesma forma (`capture`). Valores
  enumerados ficam no texto em inglês do ExifTool; a tradução é só na tela.
- Ponto de AF Canon (AFInfo2): áreas relativas ao centro em coordenadas de AF, **Y positivo para
  cima** em corpos EOS (confirmado no código-fonte do ExifTool). `core/af-geometry.js` converte
  para a imagem exibida, considerando a orientação.

## CR3 no navegador

`metadata/cr3.js` lê só os cabeçalhos das caixas ISO-BMFF e localiza o primeiro track
(`moov/trak/mdia/minf/stbl` → `stsz` + `co64`), que é um JPEG em tamanho cheio feito pela câmera.
Esse JPEG é processado pela câmera (mesmo caminho do JPEG gravado), portanto **não substitui** a
renderização neutra do RAW, que fica com o importador Python.

## Armazenamento local (IndexedDB `evolucao-fotografia`, versão 1)

| Store | Chave | Conteúdo |
|---|---|---|
| `photos` | `id` | registro da foto (ver MODELO-DE-DADOS); índices `match_key`, `added_at` |
| `blobs` | `<id>/original/<variante>`, `<id>/preview` | arquivo original e prévia |
| `raw_metadata` | `<id>/<variante>` | JSON completo do ExifTool |
| `meta` | texto | reservado (configurações, v0.3+) |

Toda leitura de registro passa por `migrate()`.

## Telas

`#/enviar` (padrão), `#/fotos`, `#/foto/<id>` (ficha; setas, teclado e deslize), `#/sobre`.
Texto vindo de arquivos sempre entra via `textContent` (`ui/dom.js`).

## Publicação

`.github/workflows/ci-pages.yml`: job `testes` (`npm ci`, Chromium, `npm test`) e, só em `main`
e se passar, job `publicar` (`npm run vendor` + `upload-pages-artifact` da pasta `site/`).
