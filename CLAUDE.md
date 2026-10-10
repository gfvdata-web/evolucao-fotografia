# CLAUDE.md — Evolução Fotografia

Lido no início de cada sessão. Mantenha-o atualizado no mesmo commit de qualquer mudança
que altere o que está escrito aqui.

## O que é

Sistema para o Guilherme (fotógrafo amador, Canon EOS RP + RF 50mm f/1.8 STM + RF 75-300mm,
nada estabilizado) revisar cada sessão de fotos e descobrir, **com dados**, o que causa
fotos pixeladas ou sem nitidez. **Não edita fotos**: analisa a qualidade da captura e de cada
etapa do caminho (câmera → Camera Connect → tablet → app).

Site estático no GitHub Pages, em pt-BR, pensado primeiro para o **Galaxy Tab S9+**
(Chrome e Samsung Internet; retrato e paisagem) e que funciona no desktop.
Publicado em https://gfvdata-web.github.io/evolucao-fotografia/

O Guilherme programa em Python mas **não quer programar**: Claude constrói, ele testa no
tablet e dá direção.

## Regras que não se quebram

1. **Nenhuma foto ou dado pessoal no repositório.** Fotos, avaliações e metadados vivem no
   navegador (IndexedDB) e, a partir da v0.4, no Google Drive do usuário. Fixtures de teste são
   sintéticas, geradas pelos testes (`tests/fixtures/`). Amostras reais ficam em `amostras/`
   (ignorada pelo git).
2. **Nada de segredo no repositório.** O Client ID do Google é público e pode ficar no código;
   nunca client secret, tokens ou credenciais.
3. **Sem backend.** Todo processamento roda no navegador. O GitHub guarda só o código.
4. **Indicadores são objetivos, sem conselhos.** Mostrar o número e o que ele significa; não
   dizer "use ISO menor".
5. **O que não foi lido aparece como não lido.** Nunca preencher campo ausente com um valor
   plausível. A ficha mostra o que faltou e o motivo provável.
6. **Uma única implementação de cada métrica**, em JavaScript. O importador Python (v0.5)
   entrega metadados, prévias e recortes, mas não calcula indicadores.
7. **Não adicionar funcionalidade fora do escopo sem perguntar.** Escolha não óbvia: trazer
   1–2 alternativas com prós e contras e registrar em `docs/decisoes/`.

## Arquitetura resumida

```
site/                       ← publicado no Pages (sem build; módulos ES)
  index.html, css/, icons/
  js/app.js                 roteador por hash (#/enviar, #/fotos, #/foto/<id>, #/sobre)
  js/core/                  PURO (sem I/O): modelo, migrações, ids, glossário, formatação, geometria do AF
  js/metadata/              exifr (rápido) + ExifTool-WASM em Web Worker (completo) → normalize.js
  js/media/                 worker de pixels (prévia; na v0.2 recortes e métricas)
  js/storage/               IndexedDB (idb.js) e repositório de fotos
  js/pipeline/              ingestão de arquivos e fila de envio
  js/ui/                    dom.js (sempre textContent, nunca innerHTML) e telas
  vendor/                   GERADO por `npm run vendor` (não versionado)
tests/unit/                 node:test (puro + ExifTool real sobre fixtures)
tests/e2e/                  Playwright, viewport de tablet retrato e paisagem
tests/fixtures/             gerador de JPEG/CR3 sintéticos com EXIF e MakerNote Canon
tests/amostras/             conferência das amostras reais (roda só localmente)
scripts/                    vendor.mjs, serve.mjs
importador/                 script Python (v0.5)
docs/                       catálogo em docs/INDICE.md
```

Detalhes: `docs/ARQUITETURA.md`. Modelo de dados: `docs/MODELO-DE-DADOS.md`.

## Convenções

- **Interface e documentação em pt-BR. Código em inglês** (nomes, comentários, chaves de JSON
  em `snake_case`). Textos da tela ficam em `core/glossary.js` ou nas telas.
- JavaScript puro, sem framework e sem etapa de build no site. Dependência nova: discutir antes.
- `site/js/core/` é puro: recebe objetos e devolve objetos. Só `storage/`, `metadata/`,
  `media/` e `pipeline/` fazem I/O.
- Valores enumerados (modo de AF, estilo...) são guardados como o texto em inglês do ExifTool e
  traduzidos só na exibição (`translate()` no glossário).
- Mudou o formato dos dados? Suba `SCHEMA_VERSION` (`core/model.js`), escreva a migração em
  `core/migrations.js`, um teste com o documento antigo e atualize `docs/MODELO-DE-DADOS.md`.
- Alvos de toque ≥ 48 px; cores por variáveis CSS em `:root` (tema escuro neutro + claro).

## Comandos

```bash
npm ci                 # dependências (uma vez)
npm run vendor         # copia exifr e ExifTool-WASM para site/vendor/
npm run serve          # http://localhost:8765/  (file:// não funciona: módulos ES + wasm)
npm test               # vendor → fixtures → unitários → ponta a ponta (tudo)
npm run test:unit      # só unitários
npm run test:e2e       # só Playwright
node tests/amostras/conferir.mjs   # relatório das amostras reais em amostras/ (local)
```

## Rotina de cada mudança

1. Algo novo? Atualizar `docs/ROADMAP.md`.
2. Implementar.
3. `npm test` — **só seguir se tudo passar.**
4. Atualizar os docs afetados e `docs/CHANGELOG.md`; versão em `site/js/version.js` e
   `package.json` quando for entrega.
5. Commit e push para `main` **sem pedir permissão** (autorização permanente do Guilherme).
   Cada entrega ganha uma tag semântica (`v0.1.0`, `v0.2.0`...).
6. Conferir que o workflow "Testes e publicação" passou e o Pages atualizou
   (`gh run list`, `curl` na URL), e dizer ao Guilherme o link e o que testar no tablet.

## Commits

Conventional Commits em português: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`,
`ci:`. Mensagem descritiva do porquê. Nunca commitar `amostras/`, `.CR3`, `.JPG` fora de
fixtures, pacotes `.efsessao`, backups `.efbackup` ou credenciais (o `.gitignore` bloqueia).

## Estado atual

**v0.1.0**: envio pela página + ficha básica; dados só no navegador. Próximo: v0.2 (recortes
a 100% e indicadores). Ver `docs/ROADMAP.md`.

Amostras reais da EOS RP: o protocolo está em `docs/AMOSTRAS-CALIBRACAO.md`. Quando chegarem em
`amostras/`, rodar `node tests/amostras/conferir.mjs`, comparar com o normalizador e calibrar
(eixo Y do AF já confirmado no código do ExifTool: positivo para cima em corpos EOS).

O monitoramento do site no `painel-status` é feito pelo Guilherme naquele repositório — não
mexer lá a partir daqui.
