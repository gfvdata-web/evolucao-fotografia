# Guia de uso

Endereço: **https://gfvdata-web.github.io/evolucao-fotografia/**

## No tablet (fluxo principal)

### Primeira vez
1. Abra o endereço no **Chrome** do tablet (também funciona no Samsung Internet).
2. Instale como app: aba **Drive** → **Instalar como app**, ou menu ⋮ → **Instalar app** /
   **Adicionar à tela inicial**. Instalado, ele abre sem a barra do navegador e funciona sem
   internet (o Drive precisa de internet, claro).
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

### Sessões (v0.3)
Depois de enviar, o quadro **Organizar em sessões** (aba Enviar e aba **Sessões**) mostra as
fotos sem sessão agrupadas pelo dia em que foram tiradas. **Criar sessão** cria a sessão do dia
com essas fotos; se já houver uma sessão daquele dia, aparece **Juntar a "…"**.

Na sessão:
- **Nome, Data, Local e Notas** são salvos sozinhos ao sair do campo ("salvo" no canto).
- **Esta sessão é um experimento**: marque quando variou um único ajuste de propósito (por
  exemplo, ISO 100, 800, 3200 e 12800 no mesmo assunto). Escolha o parâmetro e descreva o que
  fez; cada foto passa a mostrar o valor daquele ajuste.
- **Selecionar fotos** → toque nas fotos → **Mover para** outra sessão, uma nova ou "sem
  sessão" (para separar dois passeios do mesmo dia).
- **Excluir sessão** apaga só a sessão: as fotos e as avaliações continuam no aparelho.

### Avaliar (v0.3)
**Avaliar fotos** (na sessão ou na aba Fotos) abre uma foto por vez, na ordem em que foram
tiradas, começando pela primeira sem avaliação.
1. Se quiser, toque em **Nota** (1–5), **Luz** e **Assunto**. **Luz e assunto iguais à
   anterior** repete os da foto anterior.
2. Toque na **Categoria**: nítida, ruído, tremida, fora de foco, pixelada no envio ou outro.
   O app passa sozinho para a próxima foto (desmarque "Avançar…" se preferir passar à mão).
- Tocar de novo numa opção marcada desmarca.
- **Foco a 100%** mostra o recorte do ponto de foco em tamanho real; **Foto inteira** volta.
- Deslize a foto para os lados ou use ‹ › para navegar; **Próxima sem avaliação** pula as já
  avaliadas. No computador, as setas do teclado navegam e as teclas 1–5 dão a nota.
- A **nota livre** é salva ao sair do campo ou ao trocar de foto.

A ficha da foto mostra a avaliação, a sessão (dá para trocar ali) e o botão **Avaliar**.

### Lista de fotos
Aba **Fotos**. Etiquetas aparecem só nos casos mais claros: **reduzida no caminho**,
**risco de tremido** e **metadados removidos**. A categoria e a nota dadas por você aparecem
num selo à parte. O topo mostra quantas já foram avaliadas.

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

### Google Drive (v0.4)
Aba **Drive** → **Conectar ao Google Drive** e escolha a conta. O app cria a pasta
**EvolucaoFotografia** no seu Drive e só enxerga o que está nela.
- A sincronização roda sozinha com o app aberto, inclusive enquanto você avalia. O selo no
  topo mostra **Sincronizado**, **N pendentes**, **Enviando…** ou **Reconectar ao Drive**.
- O login do Google vale 1 hora. Depois disso, o próximo toque em qualquer lugar do app renova
  sozinho (pode piscar uma janela). Se não der, toque em **Reconectar** na aba Drive.
- Sem internet, tudo continua funcionando; as mudanças ficam pendentes e vão depois.
- **O que guardar no Drive**: JPEG originais (padrão sim), CR3 originais (padrão não, ~30 MB
  cada) e localização (padrão não: o GPS é apagado dos arquivos antes de subir). Prévias,
  recortes, avaliações e metadados vão sempre.
- **Limite de espaço** (padrão 100 GB): perto dele aparece um aviso; ao passar, os originais
  ficam esperando e o resto continua indo.
- **Remover foto** (na ficha) tira a foto do app e manda os arquivos dela para a **lixeira do
  Drive** (dá para recuperar por 30 dias). Excluir uma sessão manda a pasta para a lixeira e
  as fotos vão para `_sem_sessao`.
- No PC, abrindo o mesmo endereço e conectando a mesma conta, aparecem as mesmas sessões e
  avaliações (as fotos vêm com prévia e recortes).

### Backup neste aparelho (v0.4)
Aba **Drive** → **Exportar backup** gera um arquivo `.efbackup` (avaliações, sessões,
metadados, prévias e recortes; marque **Incluir os arquivos originais** para levar as fotos).
**Importar backup** junta o arquivo com o que já está no app: em cada foto vale a versão mais
recente, então importar um backup antigo não desfaz avaliações novas.

## Configuração do Google Cloud

Uma vez só, no computador. Cria o "Client ID", que identifica o app para o Google. Ele é
público (vai no código do site); a **chave secreta não é usada** e não deve ser enviada a
ninguém.

1. Abra https://console.cloud.google.com/ com a conta do Google cujo Drive vai guardar as fotos.
2. No seletor de projetos (topo) → **Novo projeto** → nome `Evolucao Fotografia` → **Criar**.
   Confira que o projeto novo está selecionado.
3. Menu ☰ → **APIs e serviços** → **Biblioteca** → procure **Google Drive API** → **Ativar**.
4. Menu ☰ → **Google Auth Platform** (ou **APIs e serviços → Tela de permissão OAuth**) →
   **Começar**:
   - Nome do app: `Evolução Fotografia`; e-mail de suporte: o seu;
   - Público: **Externo**;
   - Dados de contato: o seu e-mail → aceite a política → **Criar**.
5. **Acesso a dados** → **Adicionar ou remover escopos** → marque
   `.../auth/drive.file` ("Ver, editar, criar e excluir apenas os arquivos do Google Drive que
   você usa com este app") → **Atualizar** → **Salvar**.
6. **Público-alvo** → **Publicar app** → confirmar. Como o escopo `drive.file` não é sensível,
   o Google não exige verificação. (Alternativa: deixar "Em teste" e adicionar o seu e-mail em
   **Usuários de teste**.)
7. **Clientes** → **Criar cliente** → tipo **Aplicativo da Web** → nome `Site` →
   **Origens JavaScript autorizadas** → adicione:
   - `https://gfvdata-web.github.io`
   - `http://localhost:8765` (para testes no computador)

   Não precisa de "URIs de redirecionamento". → **Criar**.
8. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) e mande para o Claude,
   que o coloca em `site/js/config.js`. Ignore a "chave secreta do cliente".

Na primeira conexão, o Google mostra uma tela de permissão com o nome do app; se aparecer
"O Google não verificou este app", toque em **Avançado → Acessar Evolução Fotografia**
(acontece com apps pessoais publicados sem verificação).

## No computador (importador Python)

Chega na **v0.6**. Instalação no Windows (Python, ExifTool via `winget install
OliverBetz.ExifTool`, dependências) e uso serão descritos aqui.

## Amostras de calibração

Roteiro das fotos de teste: [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md).
