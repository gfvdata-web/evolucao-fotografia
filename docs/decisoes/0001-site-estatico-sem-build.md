# 0001 — Site estático sem etapa de build, publicado por GitHub Actions

**Data:** 2026-10-10 · **Situação:** aceita

## Contexto
O site roda no GitHub Pages, sem servidor. Os outros projetos do Guilherme com Pages
(SimuladorInvestimentos, PesquisasEVotos, cruzeiro-indata-publico) usam HTML/CSS/JS puro com
módulos ES e publicam por Actions (`configure-pages` → `upload-pages-artifact` → `deploy-pages`).

## Opções
1. **JS puro, módulos ES, sem build** — o que roda é o que está no repositório; fácil de ler
   e depurar no tablet. Exige servir por HTTP (não abre em `file://`).
2. Framework com build (Vite/React) — componentes prontos, porém mais dependências, etapa de
   build e código publicado diferente do escrito.

## Escolha
Opção 1, igual aos outros projetos. Só as bibliotecas de terceiros (exifr, ExifTool-WASM) são
copiadas do npm para `site/vendor/` por `scripts/vendor.mjs` — no CI e localmente — e não são
versionadas (o `.wasm` tem 25 MB).

## Consequências
- Publicação pelo workflow `ci-pages.yml`, que só publica se os testes passarem.
- Testes de navegador com Playwright usando o mesmo servidor estático (`scripts/serve.mjs`).
