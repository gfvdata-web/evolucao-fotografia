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

### Ver a ficha
Aba **Fotos** → toque numa foto.
- **Quadro amarelo** na imagem: a área onde a câmera registrou o foco (AF).
- **Arquivos desta foto**: tamanho em pixels de cada arquivo. Se o "declarado no EXIF" for
  maior que os pixels reais, a foto foi reduzida em algum ponto do caminho.
- **Configuração usada**: cada ajuste em linguagem simples, com uma explicação curta embaixo.
- **O que não foi possível ler**: dados ausentes e o motivo provável.
- **Metadados completos (técnico)**: tudo que o ExifTool leu, para conferência.
- Troque de foto com as setas ‹ › ou **deslizando** a imagem para os lados.

Nesta versão as fotos ficam **só neste aparelho** (no navegador). "Remover do aparelho" e
"Apagar dados locais" (aba Sobre) não afetam as fotos do cartão nem da galeria.

### Aba Sobre
Versão do app, tamanho da tela, espaço usado e estado do leitor completo. Se algo estranho
acontecer, tire um print desta tela.

## Configuração do Google Cloud

Chega na **v0.4** (Drive e sincronização). O passo a passo será escrito aqui.

## No computador (importador Python)

Chega na **v0.5**. Instalação no Windows (Python, ExifTool via `winget install
OliverBetz.ExifTool`, dependências) e uso serão descritos aqui.

## Amostras de calibração

Roteiro das fotos de teste: [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md).
