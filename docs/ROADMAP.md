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
- ✅ **v0.3.1 — avaliação por sintoma** (pedido do Guilherme depois de testar no tablet,
  2026-10-12; decisão 0012): **nitidez 1–5** no lugar da nota geral; **problema principal**
  pelo que se vê ao ampliar (nenhum / mole por inteiro / foco no lugar errado / arrastada /
  granulada / quadriculada ao ampliar / outro), sem supor a causa; contexto em **onde**
  (dentro / fora), **luz** percebida (forte / média / fraca) e assunto. A tela mostra a **luz
  da cena calculada pela exposição** (EV), primeiro pedaço do motor da v0.5. Avaliada =
  nitidez + problema. Esquema 4.

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

### ⏳ v0.5 — Cenas e diagnóstico com orientação
Pedido do Guilherme (2026-10-12): mandar uma foto, ou uma sessão, e o site dizer se está boa
ou ruim, o que aconteceu e o que fazer na próxima captura. Sem IA: física da exposição, perfil
do equipamento e pixels. Ver decisão 0011.
- **Cenas dentro da sessão**, separadas sozinhas (intervalo entre disparos, troca de lente ou
  salto de zoom, semelhança das prévias) e reajustadas por **arrastar e soltar** no tablet
  (segurar a foto e soltar em outra cena ou num espaço vazio), com "mover para…" como
  alternativa.
- **Motor de diagnóstico** (`core/`, puro), que funciona com **uma foto só**:
  - luz da cena calculada pela exposição (abertura, velocidade, ISO e compensação), corrigida
    pelo brilho real da foto;
  - perfil das lentes: abertura máxima, faixa mais nítida e perda por difração (RF 50 e
    RF 75-300, nenhuma estabilizada);
  - "o que era possível com essa luz": combinações de velocidade, abertura e ISO que evitariam
    o problema, pesando tremido × ruído × profundidade de campo;
  - foco errado × tremido × ruído, separados pelos pixels (nitidez no ponto de AF × no resto
    da foto) e pelos metadados;
  - **histograma** e altas luzes estouradas (céu), sombras empastadas.
- **Orientação com o porquê**: cada orientação mostra o número que a gerou, de onde vem (física,
  calibração da EOS RP, comparação na cena, suas avaliações) e o grau de certeza. Campo não lido
  não gera orientação: a ficha diz o que faltou (regra 5).
- **Diagnóstico por cena**: o que deu errado em cada cena e o ajuste principal; comparação
  entre as fotos da cena (a mais nítida × as piores e o que mudou entre elas) como reforço.
- **Quanto as configurações variaram** na cena e na sessão: quais ajustes mudaram e entre quais
  valores; aviso quando dois ajustes mudaram ao mesmo tempo entre fotos parecidas.
- Pré-requisito: **Rodada 2 de amostras** (`docs/AMOSTRAS-CALIBRACAO.md`), que mede ruído por
  ISO, o limite de tremido da mão do Guilherme, a abertura da RF 50, foco errado e altas luzes.
  Pode ser feita a qualquer momento, antes da v0.5 começar.

### ⏳ v0.6 — Importador Python (Windows)
- `importador/`: ExifTool (metadados completos), rawpy/LibRaw (renderização neutra do RAW, sem
  redução de ruído nem nitidez), prévias, recortes e "pacote de sessão" `.efsessao` (ZIP sem
  compressão, lido por partes no navegador).
- O site importa o pacote pelo mesmo botão de envio e sobe ao Drive pelo fluxo normal.
- Comparação lado a lado: recorte do RAW neutro × recorte do JPEG da câmera (entra na cadeia
  de etapas como a etapa "sensor").
- Testes com pytest; guia de instalação no Windows.
- **Pedido do Guilherme (2026-10-12), ler antes de começar a v0.6:** deixar claro **na tela**,
  de forma intuitiva, que enviar o CR3 junto com o JPEG permite ver o que o processamento da
  câmera acrescenta ou tira (redução de ruído, nitidez do Picture Style, otimizador da lente):
  o RAW neutro mostra a foto sem esses efeitos e distorções. Hoje ele usa só o JPEG L do tablet,
  que basta para o diagnóstico; o CR3 é opcional e serve para essa investigação. Ideias a
  propor: aviso no envio e na ficha quando só há JPEG ("envie o CR3 pelo importador para ver a
  foto sem o processamento da câmera"), selo na foto que tem a etapa "sensor", explicação no
  Sobre. Lembrar que o CR3 chega pelo importador no computador, não pelo envio do tablet.

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
- **Orientações ajustadas pelas avaliações**: a nitidez relativa vira "nítida / não nítida" pelo
  olho do Guilherme (limite abaixo do qual ele marca tremida ou fora de foco), e os limites do
  motor de diagnóstico (ruído aceitável por ISO, velocidade mínima por distância focal) passam
  a ser os dele. Estatística sobre as avaliações, sem treinar modelo.

## V3 — IA (a discutir)
O que a física e os pixels não resolvem: entender o assunto (pessoa, pássaro, paisagem, céu no
fundo), saber se o assunto se mexia sem o usuário marcar, julgar nitidez como um olho humano,
separar cenas pelo conteúdo e escrever a orientação em contexto. As fotos avaliadas podem servir
de exemplo para o modelo. Antes de começar, decidir:
- **onde fica a chave do modelo** (nunca no repositório): colada pelo usuário no próprio
  navegador, chamada pelo importador Python ou modelo pequeno rodando no tablet;
- **custo por foto** e quando chamar (toda foto, só as ruins, sob pedido);
- **privacidade**: as fotos saem do tablet e do Drive para o provedor do modelo.

## Ideias (pedir OK antes)
- 💡 Fluxo "sem guardar originais para sempre": manter no Drive só prévias, recortes e
  metadados completos depois de analisada a sessão; originais apagados após N dias ou após
  avaliação. Os metadados completos do ExifTool já são guardados por foto para permitir isso.
