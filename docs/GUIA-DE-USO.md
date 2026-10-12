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

**Para que serve:** o Google só deixa um site mexer no seu Drive se esse site estiver
cadastrado. O cadastro gera um código chamado **ID do cliente** (Client ID), que vai no
código do site. Faz-se uma vez só, no computador, em uns 15 minutos. Não custa nada e não
pede cartão de crédito.

O ID do cliente é público (qualquer um pode vê-lo no site, e isso não dá acesso a nada). O que
nunca se compartilha é a **chave secreta do cliente**, que este app não usa.

### Etapa 1 — Entrar no Google Cloud
1. No computador, abra **https://console.cloud.google.com/**.
2. Entre com a **conta Google onde as fotos vão ficar** (a do Drive que você quer usar).
3. Se for a primeira vez, aparece uma janela de boas-vindas: escolha **Brasil**, marque que
   aceita os Termos de Serviço e clique em **Concordar e continuar**.

### Etapa 2 — Criar o projeto
1. No topo, à esquerda, clique na caixa **Selecione um projeto** (ou no nome de um projeto, se
   já houver um).
2. Na janela que abre, clique em **Novo projeto** (canto superior direito).
3. Em **Nome do projeto**, escreva `Evolucao Fotografia`. Deixe o resto como está e clique em
   **Criar**.
4. Espere uns segundos. Aparece um aviso no sino (canto superior direito): clique em
   **Selecionar projeto**. Confira que o nome **Evolucao Fotografia** aparece no topo.

### Etapa 3 — Ligar a API do Google Drive
1. Na barra de pesquisa do topo, escreva `Google Drive API` e clique no resultado
   **Google Drive API**.
2. Clique no botão azul **Ativar**. Espere a página mudar (aparece "API ativada" ou um painel
   com gráficos). Pronto.

### Etapa 4 — Tela de permissão (o que você vê ao conectar)
1. Na barra de pesquisa do topo, escreva `Google Auth Platform` e clique no resultado (o nome
   também pode aparecer como **Tela de permissão OAuth**).
2. Clique em **Começar** (ou **Primeiros passos**). Abre um formulário em 4 partes:
   - **Informações do app**: em **Nome do app**, escreva `Evolução Fotografia`; em
     **E-mail para suporte do usuário**, escolha o seu e-mail. Clique em **Próxima**.
   - **Público-alvo**: marque **Externo**. Clique em **Próxima**.
   - **Informações de contato**: escreva o seu e-mail. Clique em **Próxima**.
   - **Concluir**: marque a caixa de que concorda com a política de dados do Google. Clique em
     **Continuar** e depois em **Criar**.

### Etapa 5 — Permissão só para a pasta do app
1. No menu da esquerda (dentro do Google Auth Platform), clique em **Acesso a dados**.
2. Clique em **Adicionar ou remover escopos**.
3. Na lista que abre, use o filtro e escreva `drive.file`. Marque a linha
   **.../auth/drive.file** ("ver, editar, criar e excluir apenas os arquivos do Google Drive
   que você usa com este app").
4. Clique em **Atualizar** (no fim da lista) e depois em **Salvar** (no fim da página).

Essa permissão só deixa o app ver a pasta **EvolucaoFotografia** que ele mesmo cria. O resto do
seu Drive fica invisível para ele.

### Etapa 6 — Liberar o uso
1. No menu da esquerda, clique em **Público-alvo**.
2. Em **Status de publicação** aparece **Em teste**. Clique em **Publicar app** e confirme.
   Como o app só pede a permissão `drive.file`, o Google não exige análise.
3. (Se preferir não publicar: em **Usuários de teste**, clique em **Adicionar usuários**,
   escreva o seu e-mail e salve. Funciona do mesmo jeito para você.)

### Etapa 7 — Criar o ID do cliente
1. No menu da esquerda, clique em **Clientes**.
2. Clique em **Criar cliente** (ou **+ Criar cliente OAuth**).
3. Em **Tipo de aplicativo**, escolha **Aplicativo da Web**.
4. Em **Nome**, escreva `Site`.
5. Em **Origens JavaScript autorizadas**, clique em **Adicionar URI** e escreva exatamente
   `https://gfvdata-web.github.io` (sem barra no final e sem o resto do endereço).
   Clique em **Adicionar URI** de novo e escreva `http://localhost:8765`.
6. Deixe **URIs de redirecionamento autorizados** em branco.
7. Clique em **Criar**.
8. Abre uma janela **Cliente OAuth criado**. Copie o **ID do cliente**: um código longo que
   termina em `.apps.googleusercontent.com`. Se a janela fechar, ele continua na lista
   **Clientes**: clique no nome **Site** para ver.

### Etapa 8 — Mandar o ID para o Claude
Cole o ID do cliente na conversa com o Claude. Ele coloca o ID no site e publica. A
**chave secreta do cliente**, se aparecer, fica onde está: não copie nem mande.

O Google pode levar de 5 minutos a algumas horas para ativar um cliente novo. Se ao conectar
aparecer "erro 401: invalid_client" ou "origin_mismatch", espere um pouco e tente de novo.

### Depois: conectar no tablet
1. Abra o app, aba **Drive** → **Conectar ao Google Drive**.
2. Escolha a mesma conta Google da Etapa 1.
3. Se aparecer **"O Google não verificou este app"**: toque em **Avançado** e depois em
   **Acessar Evolução Fotografia**. É normal para um app pessoal: quem o cadastrou foi você.
4. Na tela de permissão, toque em **Continuar** (ou **Permitir**).
5. O selo no topo do app passa para **Sincronizando…** e depois **Sincronizado**. No seu Drive
   aparece a pasta **EvolucaoFotografia**.
## No computador (importador Python)

Chega na **v0.6**. Instalação no Windows (Python, ExifTool via `winget install
OliverBetz.ExifTool`, dependências) e uso serão descritos aqui.

## Amostras de calibração

Roteiro das fotos de teste: [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md).
