# 0007 — Estratégia de testes

**Data:** 2026-10-10 · **Situação:** aceita

## Escolha
- **Unitários:** `node:test` (já vem no Node, sem dependência). Cobrem o núcleo puro e rodam o
  **ExifTool-WASM real** sobre as fixtures, o que também protege a cópia em `site/vendor/`.
- **Ponta a ponta:** Playwright (Chromium) com viewport de tablet Android (toque, densidade 2),
  retrato 876×1400 e paisagem 1400×876.
- **Fixtures sintéticas:** `tests/fixtures/generate.mjs` cria JPEGs (jpeg-js) e um CR3 mínimo
  (caixas ISO-BMFF com CMT1–CMT4 e JPEG embutido), com EXIF e MakerNote Canon escritos pelos
  próprios testes (`tests/fixtures/specs.mjs` é o gabarito). O ExifTool decodifica essas
  fixtures como se fossem da câmera.
- **Amostras reais:** só locais, em `amostras/` (ignorada); conferidas por
  `tests/amostras/conferir.mjs`, fora da suíte do CI.
- **Drive (v0.4):** sempre contra um simulador da API; nunca chamadas reais.
- **Importador (v0.5):** pytest.

## Consequências
- `npm test` = vendor → fixtures → unitários → ponta a ponta. O CI roda o mesmo comando.
