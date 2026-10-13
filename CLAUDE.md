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
4. **Orientar sempre com o porquê.** O site ajuda a fotografar melhor: diz o que aconteceu e o
   que fazer na próxima captura, mas toda orientação mostra o número que a gerou, de onde ela
   vem (física, calibração, comparação na cena, avaliações) e o grau de certeza. Conselho sem
   número por trás, não. Decisão 0011 (substitui o "sem conselhos" da v0.1–v0.3).
5. **O que não foi lido aparece como não lido.** Nunca preencher campo ausente com um valor
   plausível. A ficha mostra o que faltou e o motivo provável.
6. **Uma única implementação de cada métrica**, em JavaScript. O importador Python (v0.6)
   entrega metadados, prévias e recortes, mas não calcula indicadores.
7. **Não adicionar funcionalidade fora do escopo sem perguntar.** Escolha não óbvia: trazer
   1–2 alternativas com prós e contras e registrar em `docs/decisoes/`.

## Arquitetura resumida

```
site/                       ← publicado no Pages (sem build; módulos ES)
  index.html, css/, icons/, manifest.webmanifest, sw.js (PWA, uso sem internet)
  js/config.js              Client ID público do Google (vazio = Drive "não configurado")
  js/app.js                 roteador por hash (#/enviar, #/sessoes, #/sessao/<id>, #/avaliar/...,
                            #/fotos, #/foto/<id>, #/sobre)
  js/core/                  PURO (sem I/O): modelo, migrações, ids, glossário, formatação, geometria do AF
                            e campos de visão, perfis de câmera e de lente, indicadores, métricas de pixels,
                            qualidade JPEG, sessões e avaliação, física da exposição e diagnóstico (v0.5)
  js/metadata/              exifr (rápido) + ExifTool-WASM em Web Worker (completo) → normalize.js
  js/media/                 worker de pixels (prévia, recortes a 100% e métricas)
  js/drive/                 login Google (auth.js, token GIS) e REST do Drive (api.js)
  js/storage/               IndexedDB (idb.js) e repositórios de fotos, sessões e estado do Drive
  js/pipeline/              ingestão de arquivos, fila de envio, análise de pixels (analyze.js) e
                            sessões/avaliações (organize.js), Drive (sync.js) e backup (backup.js)
  js/ui/                    dom.js (sempre textContent, nunca innerHTML) e telas
  vendor/                   GERADO por `npm run vendor` (não versionado)
tests/unit/                 node:test (puro + ExifTool real sobre fixtures)
tests/e2e/                  Playwright, viewport de tablet retrato e paisagem
tests/fixtures/             gerador de JPEG/CR3 sintéticos com EXIF e MakerNote Canon
tests/lib/fake-drive.mjs    Drive falso em memória (unitários e ponta a ponta; nada vai ao Google)
tests/amostras/             conferência das amostras reais (roda só localmente)
scripts/                    vendor.mjs, serve.mjs, icons.mjs (PNG dos ícones a partir do SVG)
importador/                 script Python (v0.6)
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
npm run test:e2e       # só Playwright (E2E_PORT=8791 para rodar em paralelo com outra cópia)
node tests/amostras/conferir.mjs   # relatório das amostras reais em amostras/ (local)
node tests/amostras/metricas.mjs   # métricas do site sobre as amostras + recortes (local, após o conferir)
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

## Fechar uma versão (regressão obrigatória)

Pedido permanente do Guilherme: **nenhuma versão é dada por terminada sem garantir que todas
as funcionalidades acumuladas (desta e de todas as anteriores) continuam funcionando.** Faz
parte do desenvolvimento, não é etapa opcional nem precisa ser pedida.

1. Cada funcionalidade marcada como feita no `docs/ROADMAP.md`, de qualquer versão, tem teste
   automatizado: unitário para a lógica e ponta a ponta (`tests/e2e/vNN-*.spec.mjs`) para o
   fluxo na tela. Faltou teste? Escrever antes de fechar.
2. Specs de versões anteriores nunca são apagadas, desligadas (`skip`, `fixme`, `only`) nem
   afrouxadas para passar; se o comportamento mudou de propósito, ajustar o teste e explicar
   no commit.
3. Rodar `npm test` completo (unitários + ponta a ponta em retrato e paisagem) e só fechar com
   tudo verde. Havendo amostras em `amostras/`, rodar também `conferir.mjs` e `metricas.mjs`.
4. Depois do push: workflow verde e conferência do site publicado.
5. Ao entregar, dizer ao Guilherme o resultado (quantos testes, todos passaram) e citar
   qualquer funcionalidade que só dá para conferir no tablet.

## Commits

Conventional Commits em português: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`,
`ci:`. Mensagem descritiva do porquê. Nunca commitar `amostras/`, `.CR3`, `.JPG` fora de
fixtures, pacotes `.efsessao`, backups `.efbackup` ou credenciais (o `.gitignore` bloqueia).

## Estado atual

**v0.3.1**: sessões sugeridas por dia e avaliação por toque (nitidez 1–5, problema principal
pelo sintoma, onde/luz/assunto e luz da cena calculada pela exposição; decisão 0012), sobre os
recortes e indicadores da v0.2. Esquema de dados 4. **v0.4.1**: Google Drive (Client ID em
`site/js/config.js`, projeto "Evolucao Fotografia" em teste, decisão 0010), sincronização entre
aparelhos, PWA e backup `.efbackup`. **v0.5.0**: diagnóstico de uma foto com orientação (cartão
na ficha, veredito na grade; `core/diagnosis.js`, limites em `LIMITS` calibrados nas amostras;
decisões 0011 e 0013). **v0.5.1**: cenas na sessão (separação automática com motivo, arrastar e
soltar com o dedo, diagnóstico por cena e variação dos ajustes; `core/scenes.js`,
`core/scene-diagnosis.js`, `ui/scene-drag.js`; decisão 0014). Esquema de dados 6, métricas
versão 2. Próximo: v0.6 (importador Python). Ver `docs/ROADMAP.md`.

Amostras reais da EOS RP (protocolo em `docs/AMOSTRAS-CALIBRACAO.md`): a 1ª rodada (26 fotos)
está em `docs/CALIBRACAO-RESULTADOS.md`. Para novas amostras em `amostras/`: rodar o
`conferir.mjs` e depois o `metricas.mjs`, e comparar com o normalizador e os indicadores.
Pendentes do Guilherme: a **Rodada 2** (mesmo documento), que já inclui T09, T08 em 300 mm e,
se ele fotografa através de vidro, T06.

O monitoramento do site no `painel-status` é feito pelo Guilherme naquele repositório — não
mexer lá a partir daqui.
