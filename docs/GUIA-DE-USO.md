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

### Cenas (v0.5.1)
Dentro da sessão, as fotos aparecem separadas em **cenas** (o mesmo assunto e a mesma luz). O app
separa sozinho e diz o motivo de cada corte: pausa longa, troca de lente, salto de zoom ou
enquadramento diferente.
- **Corrigir a separação:** **segure** a foto até ela "levantar" (meio segundo) e **arraste**
  para outra cena. Para criar uma cena nova, solte na área **"Solte aqui para criar uma cena
  nova"**, que aparece no fim da tela durante o arraste. Chegando perto da borda de cima ou de
  baixo, a tela rola sozinha. Um toque rápido continua abrindo a foto, e arrastar sem segurar
  continua rolando a tela.
- Sem arrastar: **Selecionar fotos** → **Mover para** → "Cena 2" ou "Nova cena".
- **Separar as cenas automaticamente de novo** desfaz as suas correções.
- Cada cena mostra: quantas fotos estão boas, aceitáveis ou com problema; a luz (EV); o
  **problema principal** e o **ajuste principal** (com "Por quê"); a **comparação** entre a mais
  nítida e a mais mole e o que mudou entre elas; e **quanto os ajustes variaram**. Um aviso em
  laranja aparece quando dois ajustes mudaram ao mesmo tempo entre duas fotos seguidas: assim não
  dá para saber qual deles fez a diferença.
- No topo, o **Diagnóstico da sessão**: número de cenas, totais e o problema que se repetiu em
  mais de uma cena.

### Avaliar (v0.3.1)
**Avaliar fotos** (na sessão ou na aba Fotos) abre uma foto por vez, na ordem em que foram
tiradas, começando pela primeira sem avaliação. Você diz o que **vê**; a causa é o app que
procura, pelos números.
1. Se quiser, marque o contexto: **Onde** (dentro / fora), **Luz** que você percebeu (forte /
   média / fraca) e **Assunto** (parado / em movimento). **Onde, luz e assunto iguais à
   anterior** repete os três da foto anterior.
2. Toque na **Nitidez**, de 1 (borrada) a 5 (perfeita), no que você queria nítido.
3. Toque no **Problema principal**, o que aparece ao ampliar: nenhum problema, mole por
   inteiro, foco no lugar errado, arrastada, granulada, quadriculada ao ampliar ou outro.
   Com nitidez e problema marcados, o app passa sozinho para a próxima foto (desmarque
   "Avançar…" se preferir passar à mão). A ordem dos toques não importa.
- Abaixo da foto aparece a **luz da cena** calculada pela exposição (EV a ISO 100: cada ponto
  a mais é o dobro de luz; sol direto ≈ 14–15, interno comum ≈ 5–8). Dia ou noite sai do
  horário da foto, por isso não é perguntado.
- Tocar de novo numa opção marcada desmarca. Corrigir só a nitidez de uma foto já avaliada não
  muda de foto.
- **Foco a 100%** mostra o recorte do ponto de foco em tamanho real; **Foto inteira** volta.
- Deslize a foto para os lados ou use ‹ › para navegar; **Próxima sem avaliação** pula as já
  avaliadas. No computador, as setas do teclado navegam e as teclas 1–5 dão a nitidez.
- A **nota livre** é salva ao sair do campo ou ao trocar de foto.

A ficha da foto mostra a avaliação, a sessão (dá para trocar ali) e o botão **Avaliar**.

### Lista de fotos
Aba **Fotos**. Etiquetas aparecem só nos casos mais claros: **reduzida no caminho**,
**risco de tremido** e **metadados removidos**. Desde a v0.5.0, cada foto também mostra o
**veredito do diagnóstico**: verde "Boa", ou o problema principal (por exemplo "Provável
tremido") em laranja ou vermelho. A nitidez e o problema dados por você aparecem
num selo à parte; a sessão mostra a nitidez média e quantas fotos tiveram cada problema. O topo mostra quantas já foram avaliadas.

### Ver a ficha
Aba **Fotos** → toque numa foto. Assim que a foto chega, o app calcula sozinho os recortes e
os indicadores ("Calculando recortes e indicadores…" leva alguns segundos por foto).

**Diagnóstico** (v0.5.0), o primeiro cartão: diz se a foto está boa, o que aconteceu e o que
fazer na próxima captura.
- **Veredito**: Boa · Aceitável · Com problema · Sem dados para julgar. Se você já avaliou a
  foto, vale a sua avaliação.
- **Luz da cena** em EV, medida pelo fotômetro da câmera (de 15 = sol forte a menos de 5 =
  noite).
- Cada **achado** traz o número que o gerou e, em **Na próxima**, o ajuste. Toque em **Por quê**
  para ver de onde vem (física da exposição, calibração com as suas amostras, regra geral à
  espera da Rodada 2, pixels desta foto, sua avaliação) e o grau de certeza.
- **O que dava para fazer com esta luz**: o que você usou, a combinação à mão sem tremido e a
  combinação com apoio ou tripé (ISO mais baixo, assunto parado).
- **O que faltou para diagnosticar**: o que a câmera não gravou ou o app não conseguiu medir.
  Nada disso é adivinhado.
- O app não sabe se havia tripé: com velocidade lenta e a foto nítida, ele diz que houve apoio;
  com a foto mole, ele avisa "se havia tripé, desconsidere".
- Fotos enviadas antes da v0.5.0 são medidas de novo ao abrir a ficha (uma vez), se o original
  estiver neste aparelho.
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

Se aparecer **"Feche as outras abas do Evolução Fotografia"**: o app foi atualizado e uma aba
aberta antes ainda usa os dados. Feche (ou recarregue) a outra aba; esta continua sozinha.

### Backup neste aparelho (v0.4)
Aba **Drive** → **Exportar backup** gera um arquivo `.efbackup` (avaliações, sessões,
metadados, prévias e recortes; marque **Incluir os arquivos originais** para levar as fotos).
**Importar backup** junta o arquivo com o que já está no app: em cada foto vale a versão mais
recente, então importar um backup antigo não desfaz avaliações novas.

## Configuração do Google Cloud

**Para que serve:** o Google só deixa um site mexer no seu Drive se esse site estiver
cadastrado. O cadastro gera um código chamado **ID do cliente** (Client ID), que vai no
código do site. Faz-se uma vez só, no computador, em uns 15 minutos.

**Custo:** nenhum. A API do Drive é gratuita, e o projeto não precisa de conta de faturamento
nem de cartão (se o Google oferecer "teste gratuito" ou pedir faturamento, recuse: não é
necessário). O único limite é o espaço do seu próprio Drive: a conta gratuita tem 15 GB,
divididos com o Gmail e o Google Fotos. Ajuste o limite na aba Drive do app ao espaço que você
tem.

**Privacidade:** ninguém além de você vê as suas fotos. O cadastro diz ao Google que este site
pode pedir acesso; cada pessoa que conectar só dá acesso ao **próprio** Drive, e só à pasta que
o app cria. Com o app "em teste" (Etapa 6), só os e-mails que você listar conseguem conectar.

O console pode aparecer em inglês: os nomes em inglês vêm entre parênteses.

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
2. Clique em **Começar** (**Get started**). Abre um formulário em 4 partes:
   - **Informações do app** (**App information**): em **Nome do app** (**App name**), escreva
     `Evolução Fotografia`; em **E-mail para suporte do usuário** (**User support email**),
     escolha o seu e-mail. **Próxima** (**Next**).
   - **Público-alvo** (**Audience**): marque **Externo** (**External**). **Next**.
     "Externo" só quer dizer "contas Google comuns, como o Gmail" (o contrário seria "só
     funcionários de uma empresa"). Não deixa ninguém ver nada seu.
   - **Informações de contato** (**Contact information**): o seu e-mail. **Next**.
   - **Concluir** (**Finish**): marque a caixa de que concorda com a política de dados do
     Google. **Continuar** (**Continue**) e depois **Criar** (**Create**).

### Etapa 5 — Permissão só para a pasta do app
1. No menu da esquerda (dentro do Google Auth Platform), clique em **Acesso a dados**
   (**Data Access**).
2. Clique em **Adicionar ou remover escopos** (**Add or remove scopes**).
3. Na lista que abre, use o filtro e escreva `drive.file`. Marque a linha
   **.../auth/drive.file** ("ver, editar, criar e excluir apenas os arquivos do Google Drive
   que você usa com este app").
4. Clique em **Atualizar** (**Update**, no fim da lista) e depois em **Salvar** (**Save**,
   no fim da página).

Essa permissão só deixa o app ver a pasta **EvolucaoFotografia** que ele mesmo cria. O resto do
seu Drive fica invisível para ele.

### Etapa 6 — Liberar o seu e-mail
O app fica **"em teste"** (**Testing**): só os e-mails da lista conseguem conectar. É o certo
para um app pessoal. **Não clique em "Publicar app"** (**Publish app**): o Google pediria
página inicial e política de privacidade, e não há necessidade.
1. No menu da esquerda, clique em **Público-alvo** (**Audience**).
2. Role a página até **Usuários de teste** (**Test users**).
3. Clique em **Adicionar usuários** (**+ Add users**), escreva o e-mail da conta Google da
   Etapa 1 e clique em **Salvar** (**Save**).

Em teste, o Google pode pedir para você confirmar a permissão de novo de vez em quando (no
app, aparece "Reconectar"). É só tocar e confirmar.

### Etapa 7 — Criar o ID do cliente
1. No menu da esquerda, clique em **Clientes** (**Clients**).
2. Clique em **Criar cliente** (**+ Create client**).
3. Em **Tipo de aplicativo** (**Application type**), escolha **Aplicativo da Web**
   (**Web application**).
4. Em **Nome** (**Name**), escreva `Site`.
5. Em **Origens JavaScript autorizadas** (**Authorized JavaScript origins**), clique em
   **Adicionar URI** (**+ Add URI**) e escreva exatamente
   `https://gfvdata-web.github.io` (sem barra no final e sem o resto do endereço).
   Clique em **Adicionar URI** de novo e escreva `http://localhost:8765`.
6. Deixe **URIs de redirecionamento autorizados** (**Authorized redirect URIs**) em branco.
7. Clique em **Criar** (**Create**).
8. Abre uma janela **Cliente OAuth criado** (**OAuth client created**). Copie o **ID do
   cliente** (**Client ID**): um código longo que
   termina em `.apps.googleusercontent.com`. Se a janela fechar, ele continua na lista
   **Clientes**: clique no nome **Site** para ver.

### Etapa 8 — Mandar o ID para o Claude
Cole o ID do cliente na conversa com o Claude. Ele coloca o ID no site e publica. A
**chave secreta do cliente**, se aparecer, fica onde está: não copie nem mande.

Feito em 12/10/2026: o ID está em `site/js/config.js`. Só é preciso refazer estas etapas se o
projeto for apagado ou se o site mudar de endereço.

**Por que duas origens:** o Google só aceita pedidos de login vindos dos endereços listados.
`https://gfvdata-web.github.io` é o site que o tablet abre (a origem é só o domínio, sem o
caminho `/evolucao-fotografia/`). `http://localhost:8765` é o site rodando no computador, para
testes; esse endereço só existe dentro do próprio computador, então não abre acesso para
ninguém. Qualquer outro endereço recebe "erro 400: redirect_uri_mismatch".

O Google pode levar de 5 minutos a algumas horas para ativar um cliente novo. Se ao conectar
aparecer "erro 401: invalid_client" ou "origin_mismatch", espere um pouco e tente de novo.

### Depois: conectar no tablet
1. Abra o app, aba **Drive** → **Conectar ao Google Drive**.
2. Escolha a mesma conta Google da Etapa 1.
3. Aparece **"O Google não verificou este app"** (**Google hasn't verified this app**):
   toque em **Continuar** (**Continue**; em algumas telas, **Avançado** → **Acessar Evolução
   Fotografia**). É normal para um app em teste: quem o cadastrou foi você.
4. Na tela de permissão, toque em **Continuar** (ou **Permitir**).
5. O selo no topo do app passa para **Sincronizando…** e depois **Sincronizado**. No seu Drive
   aparece a pasta **EvolucaoFotografia**.
## No computador (importador Python)

Chega na **v0.6** (plano na decisão 0015). Ele lê o cartão no PC e revela o CR3 sem o
processamento da câmera, para você ver o que a redução de ruído e a nitidez da câmera mudam.
Para o dia a dia e o diagnóstico, o JPEG L enviado pelo tablet basta.

**Para adiantar (opcional):** instalar o ExifTool no PC. Abra o **Prompt de Comando** e rode:

```bash
winget install OliverBetz.ExifTool
```

O Python 3.13 já está instalado. O resto (dependências e o `importar.bat`) vem com a v0.6.

## Amostras de calibração

Roteiro das fotos de teste: [AMOSTRAS-CALIBRACAO.md](AMOSTRAS-CALIBRACAO.md).
