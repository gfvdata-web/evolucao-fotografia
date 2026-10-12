# Guia de uso

Endereço: **https://gfvdata-web.github.io/evolucao-fotografia/**

## No tablet (fluxo principal)

### Primeira vez
1. Abra o endereço no **Chrome** do tablet (também funciona no Samsung Internet).
2. Dica: menu ⋮ → **Adicionar à tela inicial** para abrir como app. (Na v0.4 ele vira um app
   instalável completo, que funciona sem internet.)
3. Na primeira foto, o app baixa o leitor completo de metadados (~7 MB). Só acontece uma vez
   por aparelho; prefira estar no Wi-Fi.

### Enviar fotos
1. Receba as fotos no tablet pelo Camera Connect, como de costume.
2. No app, aba **Enviar**:
   - **Fotos da galeria** — escolha os JPEG (pode marcar várias);
   - **Arquivos (inclui CR3)** — abre o gerenciador de arquivos; use este para os CR3, que não
     aparecem na galeria.
3. A lista **Andamento** mostra cada arquivo: *pronta*, *já estava no app (ignorada)*,
   *não suportado* ou *erro*. "Lendo dados da Canon…" significa que a leitura completa ainda
   está rodando — pode abrir a ficha mesmo assim, ela se atualiza sozinha.

Se o JPEG e o CR3 da mesma foto forem enviados, eles aparecem como **uma foto só**, com as
etiquetas JPEG e CR3.

### Lista de fotos
Aba **Fotos**. Etiquetas aparecem só nos casos mais claros: **reduzida no caminho**,
**risco de tremido** e **metadados removidos**.

### Ver a ficha
Aba **Fotos** → toque numa foto. Assim que a foto chega, o app calcula sozinho os recortes e
os indicadores ("Calculando recortes e indicadores…" leva alguns segundos por foto).
- **Quadro amarelo** na imagem: a área onde a câmera registrou o foco (AF). Os quadros
  coloridos mostram de onde saíram os recortes: **foco** e **área uniforme** (usada para medir
  o ruído).
- **Indicadores**: números objetivos, com o que cada um significa.
  - **Resolução**: pixels da foto × o máximo da câmera. Separa o tamanho escolhido na câmera
    (M, S, 16:9, recorte 1,6x) da redução feita no caminho.
  - **Metadados**: se algum dado foi removido no caminho.
  - **Risco de tremido**: a velocidade comparada com a referência 1/distância focal (sem
    estabilização na lente nem no corpo). O app não sabe se havia tripé: no tripé, ignore.
  - **Nitidez no foco** e **Ruído**: valores relativos. Compare fotos de cenas parecidas; em
    ISO alto, o ruído também aumenta o número da nitidez.
  - **Compressão JPEG**: qualidade estimada do arquivo (a EOS RP grava cerca de 97).
- **Recortes a 100%**: o trecho do foco e o da área uniforme em tamanho real, um par por
  versão do arquivo. **100% / 200%** amplia na tela. **Escolher área do foco** ou **Escolher
  área uniforme** e depois um toque na foto troca a área; **Voltar ao automático** desfaz.
- **Comparação entre versões** (quando a mesma foto chega em mais de um arquivo, por exemplo
  CR3 + JPEG, ou cartão + tablet): tabela lado a lado e **o que mudou entre as versões** —
  pixels, compressão, cor, dados da Canon, nitidez no mesmo recorte.
  O CR3 entra pelo JPEG que a câmera grava dentro dele (uma prévia mais comprimida, cerca de
  80): ele mostra o sensor inteiro, então um JPEG em 16:9 ao lado dele aparece como "formato
  escolhido na câmera", não como perda.
- **Arquivos desta foto**: tamanho em pixels de cada arquivo. Se o "declarado no EXIF" for
  maior que os pixels reais, a foto foi reduzida em algum ponto do caminho.
- **Configuração usada**: cada ajuste em linguagem simples, com uma explicação curta embaixo.
- **O que não foi possível ler**: dados ausentes e o motivo provável.
- **Metadados completos (técnico)**: tudo que o ExifTool leu, para conferência.
- Troque de foto com as setas ‹ › ou **deslizando** a imagem para os lados.

Nesta versão as fotos ficam **só neste aparelho** (no navegador). "Remover do aparelho" e
"Apagar dados locais" (aba Sobre) não afetam as fotos do cartão nem da galeria.

### Aba Sobre
Versão do app, tamanho da tela, espaço usado, estado do leitor completo e **versão das
métricas**. Fotos enviadas antes da v0.2, ou de quando um cálculo mudou numa atualização,
são analisadas ao abrir a ficha ou todas de uma vez pelo botão **Recalcular desatualizadas**. Se algo estranho acontecer, tire
um print desta tela.

## Configuração do Google Cloud

Chega na **v0.4** (Drive e sincronização). O passo a passo será escrito aqui.

## No computador (importador Python)

Chega na **v0.5**. Instalação no Windows (Python, ExifTool via `winget install
OliverBetz.ExifTool`, dependências) e uso serão descritos aqui.

## Amostras de calibração

Roteiro das fotos de teste: [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md).
