# 0015 — Importador Python (v0.6): o que ele faz, o pacote e a renderização neutra do RAW

Data: 2026-10-12 · Situação: **aceita** (v0.6). Proposta em 12/10/2026; o Guilherme aceitou as
recomendações no mesmo dia (pacote em pasta; renderização inteira descartada depois de medida).

A numeração pula a 0014, reservada para a v0.5.1 (cenas), em andamento em outra sessão.

## Contexto

O site já lê JPEG e CR3 no navegador, mas do CR3 só aproveita o JPEG embutido, que é
processado pela câmera (decisão 0003). Para ver o que o processamento da câmera acrescenta ou
tira (redução de ruído, nitidez do Picture Style, Digital Lens Optimizer), é preciso revelar o
RAW sem nenhum desses efeitos. Isso não existe no navegador com a maturidade necessária e fica
com um importador Python no PC (roadmap desde a v0.1), com rawpy (LibRaw).

Restrições que valem aqui: sem backend (regra 3), sem segredo no repositório (regra 2) e uma
única implementação de cada métrica, em JavaScript (regra 6). Pedido do Guilherme
(2026-10-12): deixar claro **na tela** que o CR3 serve para essa investigação e que o JPEG L do
tablet basta para o diagnóstico.

Há 26 pares CR3 + JPG reais em `amostras/cartao/` (1ª rodada), que servem para calibrar a
renderização.

## Decisão

1. **O importador não calcula indicadores nem fala com o Drive.** Ele entrega arquivos; o site,
   aberto no navegador do PC, importa o pacote, mede tudo com o mesmo código de sempre e sobe ao
   Drive pelo fluxo normal (decisão 0010). O tablet recebe as medidas e os recortes pelo Drive.
   Assim não há um segundo login Google (um app de desktop exigiria um "client secret" no PC),
   nem uma segunda implementação da junção do `sessao.json`.
2. **O que o importador entrega, por disparo:**
   - os originais do cartão (CR3 e JPEG), sem alteração;
   - o JSON completo do ExifTool nativo, com **os mesmos argumentos do site**
     (`-json -l -G1`, `EXIFTOOL_ARGS` em `metadata/exiftool-engine.js`), para o
     `normalize.js` ler sem mudança e o site não precisar rodar o ExifTool-WASM;
   - a **renderização neutra do RAW** (abaixo).
3. **Renderização neutra** (rawpy/LibRaw): interpolação AHD, balanço de branco da câmera, saída
   sRGB, **sem** redução de ruído, **sem** nitidez, **sem** correção da lente e sem brilho
   automático. Os tons seguem a **curva do JPEG da câmera**, tirada do histograma dele (ver
   "Resultado da calibração"). Os parâmetros e a versão do LibRaw vão gravados junto (`render`).
   A calibração da v0.6, nos 26 pares, confere: tamanho em pixels (se o LibRaw entrega
   6240×4160 como o JPEG L), brilho comparado ao JPEG da câmera e diferença de geometria nas
   bordas (o JPEG pode ter correção de distorção; o RAW neutro, não).
4. **Formato da renderização no pacote: PNG de 8 bits, em tamanho cheio.** O navegador decodifica
   sem perda e o recorte a 100% sai exato. Um JPEG, mesmo em qualidade 100, misturaria a
   compressão na comparação que a renderização existe para fazer.
5. **Pacote = pasta `<AAAA-MM-DD>_<nome>.efsessao/`** (aceito), escrita onde o Guilherme
   escolher (padrão: Área de Trabalho), com `pacote.json` e os arquivos; o site a lê por
   "Importar pacote do PC" (escolher pasta) ou arrastando a pasta para a página. Um pacote por
   dia de fotos; a sessão é sugerida pelo site, como no envio (`core/sessions.js`), sem
   reimplementar em Python.
   - `pacote.json` usa `kind: "efpacote"` (o `efsessao` já é o tipo do `sessao.json` no Drive),
     `format_version: 1`, `importer_version`, motores (`exiftool`, `libraw`, `rawpy`) e, por
     disparo, os nomes dos arquivos, o JSON do ExifTool e os parâmetros da renderização.
6. **A renderização inteira não é guardada** (aceito): no PC, o site mede a variante neutra,
   grava os recortes a 100% (PNG, como as outras variantes) e as medidas, e descarta a imagem
   inteira. Ao Drive vão só recortes e medidas (alguns KB por foto, contra 40–70 MB). A imagem
   pode ser refeita a partir do CR3 rodando o importador de novo.
   - Consequência: a variante neutra é marcada `transient: true`. Quando `METRICS_VERSION`
     subir, ela mantém a medida antiga e a ficha diz "medida com a versão N das métricas;
     importe o CR3 de novo para atualizar", em vez de tentar reabrir um arquivo que não existe.
7. **Modelo de dados:** variante nova `kind: "raw_neutral"`, `source: "importer"`, chave
   `raw_neutral-importer`, `pixels.decoded_from: "libraw"`, `render: {...}` e `transient`.
   Junta-se à foto pelo mesmo `match_key` do CR3 de origem. Esquema 7 (a v0.5.1 usou o 6), com migração (só a
   versão) e teste com documento antigo.
8. **Versão principal não muda** (decisão 0008): no empate de pixels, vence o JPEG da câmera. O
   diagnóstico continua medindo o JPEG, que é a foto que o Guilherme usa; a neutra entra na
   **cadeia de etapas** como a primeira etapa, "sensor (RAW sem processamento)", e na
   comparação lado a lado dos recortes no mesmo trecho da cena (`mapRegion`).
9. **Uso pelo Guilherme sem programar:** `importador/importar.bat` (duplo clique) abre uma
   janela para escolher a pasta do cartão (ou `DCIM`), mostra quantos disparos e quais dias
   achou, pede confirmação e mostra o progresso. Também `py -m importador <pasta>` para quem
   quiser. Dependências: Python 3.13 (já instalado no PC), ExifTool (`winget install
   OliverBetz.ExifTool`), `rawpy`, `numpy`, `Pillow`, em `requirements.txt`.
10. **Testes:** pytest com o rawpy simulado para os parâmetros e o pacote; conferência real só
    local, sobre `amostras/cartao/` (`tests/amostras/`), como as outras amostras. No site, a
    importação é testada ponta a ponta (`tests/e2e/v06-*.spec.mjs`) com um pacote sintético
    gerado pelos próprios testes (PNG + JSON + fixtures CR3/JPEG de `tests/fixtures/`).

## Resultado da calibração (13/10/2026, 26 pares da 1ª rodada)

- **Enquadramento:** o recorte que o próprio CR3 informa (margens do LibRaw) coincide pixel a
  pixel com o JPEG da câmera em 3:2, em 16:9 e no recorte 1,6x (no 1,6x o próprio RAW já vem
  recortado). Nenhum deslocamento no centro nem nos cantos. Não foi preciso mexer em
  `core/camera-profiles.js`.
- **Tons:** a primeira versão igualava só o brilho mediano, com um ganho único. Nas medidas do
  site, a curva em S do JPEG sozinha mudava nitidez e ruído em até 90% (sombra escurecida de 52
  para 23 em IMG_9372/9373), e isso aparecia como "a câmera apagou detalhe" ou "realçou a
  nitidez". Passou-se a aplicar à revelação a **curva de tons do próprio JPEG**, tirada do
  histograma (uma tabela crescente por canal). Uma curva de tons não muda a ordem dos valores:
  ruído, bordas e detalhe continuam os do sensor, e a comparação passa a mostrar só o que o
  processamento faz no espaço (redução de ruído, realce de nitidez, correção da lente). Os
  números por foto estão em `docs/CALIBRACAO-RESULTADOS.md`.
- **Custo:** ~4 s por CR3 da EOS RP no PC e ~27 MB de PNG (nível 3).

## Alternativas consideradas

- **Pacote em ZIP sem compressão** (o que o roadmap previa). Um arquivo só é mais fácil de
  mover, mas uma sessão de 100 fotos com a renderização em PNG passa de 4 GB: exigiria ZIP64 no
  `core/zip.js` e leitura por partes. A pasta não tem limite e o Chrome do PC lê pastas
  nativamente. O pacote é consumido no PC de qualquer jeito (levar GBs ao tablet não faz
  sentido).
- **Guardar a renderização inteira no Drive.** Permite remedir quando as métricas mudarem sem
  rodar o importador de novo, mas gasta 40–70 MB por foto, perto de 5 GB por sessão, contra o
  limite de 100 GB.
- **Recortes feitos no Python.** Leve, mas duplica a escolha da região (ponto de AF, toque na
  prévia, área uniforme automática, 12 trechos) e o mapeamento entre campos de visão, contra a
  regra 6 e a decisão 0008. Descartada.
- **Importador que sobe direto ao Drive.** Evita abrir o site no PC, mas exige um cliente OAuth
  de desktop (com "client secret" no PC) e reescrever em Python a junção, as lápides e o
  histórico do `sessao.json`. Descartada.
- **LibRaw em WebAssembly no navegador**, sem Python. Funcionaria até no tablet, mas os pacotes
  disponíveis são pouco mantidos, revelar 26 MP em 16 bits pede centenas de MB de memória (o
  tablet já sofre com a análise) e o CR3 não chega ao tablet no fluxo normal (Camera Connect
  manda o JPEG). Fica como ideia se o importador se mostrar trabalhoso no uso.

## Consequências

- A v0.6 começa pela calibração da renderização nos 26 pares de `amostras/cartao/`; se o LibRaw
  não entregar o mesmo campo de visão do JPEG L, `core/camera-profiles.js` ganha o campo do RAW.
- A tela de envio e a ficha passam a explicar o papel do CR3 (pedido do Guilherme): aviso quando
  a foto só tem JPEG, selo "etapa sensor" na foto que tem a neutra, explicação no Sobre e no
  GUIA-DE-USO.
- `docs/MODELO-DE-DADOS.md` ganha a variante `raw_neutral` e o formato do `pacote.json`.
- As decisões 0003, 0007 e 0008 citam o importador como "v0.5"; vale a v0.6 (renumeração da
  decisão 0011).
