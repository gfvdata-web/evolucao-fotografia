# Roadmap

Legenda: ✅ entregue · 🔨 em andamento · 🔜 próxima · ⏳ planejada · 💡 ideia (precisa de OK antes)

## V1 — revisar cada sessão com dados

Cada entrega pode ser testada no tablet.

### ✅ v0.1 — Envio + ficha básica (dados só no navegador)
- Envio pela página: botão "Fotos da galeria" (JPEG) e "Arquivos (inclui CR3)", sem filtro de
  tipo, para o CR3 aparecer no Android; arrastar e soltar no computador.
- Tipo detectado pelo conteúdo do arquivo, não pela extensão.
- Leitura híbrida de metadados: exifr (instantâneo) + ExifTool-WASM em Web Worker (MakerNotes
  Canon: modo e área de AF, ponto de AF, disparo, estilo, redução de ruído). Ver decisão 0002.
- CR3: metadados completos e prévia a partir do JPEG embutido.
- Identificador estável por foto; JPEG e CR3 do mesmo disparo viram uma foto; reenvio
  reconhecido.
- Ficha: prévia com o quadro do AF, arquivos da foto, configuração em linguagem simples com
  explicação curta, "o que não foi possível ler" com o motivo provável, metadados completos.
- Tela Sobre com diagnóstico do aparelho (tela, espaço usado, versões).

### ✅ v0.2 — Recortes e indicadores
- Recortes a 100%: no ponto de AF (MakerNote); sem ele, no centro, com toque na prévia para
  escolher a área. Recorte de área uniforme para ruído (escolha automática + ajuste por toque).
- Indicadores objetivos por foto, calculados em Web Worker:
  - resolução real × nativa da EOS RP, considerando proporções (3:2, 4:3, 16:9, 1:1), crop 1,6x
    e tamanhos M/S1/S2; separa "tamanho escolhido na câmera" de "reduzida no caminho";
  - metadados ausentes ou removidos;
  - risco de tremido: velocidade × 1/distância focal (sem estabilização);
  - nitidez no recorte do AF (variância do Laplaciano) e ruído na área uniforme — valores
    relativos, calibrados depois com as avaliações;
  - **qualidade de compressão do JPEG** (estimada pelas tabelas de quantização) — detecta
    recompressão no caminho mesmo quando a resolução está intacta.
- **Cadeia de etapas** (pedido do Guilherme, item 7): quando a mesma foto chega em mais de uma
  versão (CR3, JPEG do cartão, JPEG do tablet, JPEG transferido "sem redimensionar"), a ficha
  compara as versões lado a lado: pixels, bytes por pixel, qualidade JPEG estimada, tags
  perdidas e nitidez no mesmo recorte — e aponta em qual etapa a qualidade caiu.
- Calibração com as amostras reais: 1ª rodada feita com 26 fotos (séries F e T), resultados em
  `docs/CALIBRACAO-RESULTADOS.md`. A nitidez segue relativa até haver avaliações (v0.3).

### ✅ v0.3 — Avaliação e sessões
- Sessões: data, local, nome dado pelo usuário; marcação opcional de "experimento"
  (um único parâmetro variado). Agrupamento sugerido por data ao enviar.
- Avaliação por toque: categoria (nítida / ruído / tremida / fora de foco / pixelada no envio /
  outro), nota 1–5, luz (sol forte / sombra / nublado / interno / noite), assunto (parado / em
  movimento), nota livre.
- Navegação por deslize otimizada para avaliar dezenas de fotos em poucos minutos.
- Feito: aba **Sessões** com sugestão por dia; tela **Avaliar** com avanço automático ao escolher
  a categoria, "luz e assunto iguais à anterior" e foco a 100%; mover fotos entre sessões;
  avaliação e sessão na ficha. Decisão 0009.

### 🔨 v0.4 — Google Drive, sincronização, PWA e backup (pronta no ramo `v0.4`; falta o Client ID)
- Login Google (Google Identity Services, modelo de token) com escopo `drive.file`.
  Token de 1 h sem renovação automática garantida: renovação silenciosa no próximo toque,
  botão "Reconectar" se falhar, fila pausa e retoma. Ver decisão 0005.
- Pasta `EvolucaoFotografia/` no Drive com `indice.json`, `config.json` e uma subpasta por
  sessão (`originais/`, `previas/`, `recortes/`, `sessao.json`, `_historico/`).
- Fila de envio com progresso, retomada (upload "resumable") e envio enquanto se avalia, com o
  app aberto (decisão 0006 — rever depois de testar na prática).
- IndexedDB como cache offline; mudanças offline em fila; indicador "pendente / sincronizado".
- Configurações: guardar JPEG (padrão sim), CR3 (padrão não), GPS (padrão descartar),
  N versões no histórico (padrão 10).
- **Limite de espaço no Drive: 100 GB** (configurável). O app mostra o uso e avisa antes de
  passar do limite. Preparar o fluxo futuro de "não guardar originais para sempre" (ver ideias).
- PWA instalável no Android, `navigator.storage.persist()`, exportar/importar backup.
- Guia passo a passo da configuração do Google Cloud no GUIA-DE-USO.
- Feito e testado com um Drive simulado (decisão 0010): conexão e renovação no toque,
  sincronização entre dois aparelhos, histórico, lixeira, GPS removido (JPEG e CR3), limite
  de espaço, backup `.efbackup`, PWA com uso sem internet. Falta: Client ID do Google Cloud
  do Guilherme e o primeiro uso com o Drive de verdade.

### ⏳ v0.5 — Importador Python (Windows)
- `importador/`: ExifTool (metadados completos), rawpy/LibRaw (renderização neutra do RAW, sem
  redução de ruído nem nitidez), prévias, recortes e "pacote de sessão" `.efsessao` (ZIP sem
  compressão, lido por partes no navegador).
- O site importa o pacote pelo mesmo botão de envio e sobe ao Drive pelo fluxo normal.
- Comparação lado a lado: recorte do RAW neutro × recorte do JPEG da câmera (entra na cadeia
  de etapas como a etapa "sensor").
- Testes com pytest; guia de instalação no Windows.

### ⏳ v1.0 — Polimento + Painel (beta)
- Acessibilidade, desempenho no tablet, Samsung Internet.
- Aba "Painel (beta)" mínima: contagem de fotos por avaliação.
- Roadmap da V2 detalhado.

## V2 — padrões e experimentos (preparada, não implementada)
- Painel de padrões cruzando avaliações e indicadores com ISO, velocidade, distância focal,
  lente, abertura e luz (ex.: % de fotos com ruído por faixa de ISO; % de tremidas por
  velocidade × distância focal; desempenho por lente).
- Guia de experimentos mensais, com roteiro e comparação de resultados (usa o campo
  `experiment` da sessão, que já existe na v0.3).
- Reprocessamento de sessões antigas com métricas novas a partir dos originais no Drive
  (`metrics_version` em cada foto identifica o que está desatualizado; comando
  "reprocessar sessão / todas" previsto no modelo).

## Ideias (pedir OK antes)
- 💡 Fluxo "sem guardar originais para sempre": manter no Drive só prévias, recortes e
  metadados completos depois de analisada a sessão; originais apagados após N dias ou após
  avaliação. Os metadados completos do ExifTool já são guardados por foto para permitir isso.
- 💡 Histograma e recorte de altas luzes como indicador de exposição.
