# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões semânticas.

## [2.1.0] — 2026-10-19

Painel de padrões (decisão 0018).

### Adicionado
- Seção **Padrões** no Painel: escolha com o que cruzar (ISO, margem de velocidade, lente,
  abertura, luz medida, onde, luz percebida, assunto) e a medida ("Nitidez 4 ou 5", cada problema
  principal ou "Com problema" segundo o site). Cada faixa mostra a porcentagem com o intervalo de
  95% (Wilson), quantas fotos a sustentam e a nitidez média; com menos de 10 fotos, só
  "poucas fotos (n)". Campo não lido fica numa faixa própria, nunca num valor suposto.
- A aba Fotos aceita os filtros das faixas: todo número dos Padrões abre exatamente essas fotos,
  e o aviso "Filtro: …" diz a faixa.

## [2.0.1] — 2026-10-19

O diagnóstico mostra os números também quando a foto sai "Boa" (regra 4).

### Adicionado
- Bloco **Medidas desta foto** no cartão Diagnóstico, sempre visível: desfoque no ponto de foco
  com a escala das amostras (tripé 0,27 · à mão 0,37 · limite 0,40 · tremidas 0,54), detalhe do
  recorte, onde o recorte foi feito (ponto de AF gravado, área escolhida ou centro), o trecho mais
  nítido e o mais mole do resto da foto, velocidade × referência de tremido, ISO e brilho. Cada
  número diz de onde vem.
- Nota **Nítida por pouco** quando o desfoque fica entre 0,37 e 0,40, com o que dá mais folga.
- Link **"Discorda? Marque a nitidez que você vê"**, que abre a avaliação da foto.

### Alterado
- O "Boa" agora diz o número: "Nítida no ponto de foco (desfoque 0,31; o limite é 0,40)."
  O veredito e os limites não mudaram; a calibração vem com a Rodada 2.

## [2.0.0] — 2026-10-13

Reprocessamento (decisão 0017), primeira entrega da V2.

### Adicionado
- **Reprocessar** (sessão ou todas): refaz recortes, indicadores e diagnóstico das fotos medidas
  por uma versão anterior das métricas. Mostra antes quantas têm o original no aparelho, quantas
  no Drive (com os MB a baixar) e quantas não têm original; progresso, Pausar e continuar de onde
  parou; ao fim, a lista das que ficaram com as medidas antigas e o motivo.
- Original que está só no Drive é baixado, medido e apagado do aparelho.
- Aviso "N fotos com medidas antigas" na grade, no Painel e na sessão.

## [1.0.0] — 2026-10-13

Polimento e Painel (beta), decisão 0016. V1 fechada em 19/10/2026 com o relato do Guilherme
(tablet e sincronização sem problemas; decisões 0006 e 0010 aceitas no uso). O importador com um
cartão real é conferido na Rodada 2 de amostras.

### Adicionado
- Grade, sessões e cenas mostram uma **miniatura de ~400 px** (feita a partir da prévia, só no
  aparelho: não vai ao Drive nem ao backup) e carregam as imagens só quando chegam perto da tela.
- **Desempenho deste aparelho** na aba Sobre: tempo médio de leitura, prévia e análise por foto.
- **Acessibilidade**: auditoria automática (axe-core) em todas as telas, nos dois temas, em retrato e
  paisagem; o progresso do envio, o selo do Drive e o avanço da avaliação são anunciados pelo leitor de tela.

- **Conferir compatibilidade** na aba Sobre: testa cada recurso que o app usa (15) e diz o que
  falha e o que fazer; sem um recurso essencial, o app avisa no topo de qualquer tela.
- **Painel (beta)**: fotos por nitidez, problema principal e veredito, avaliadas × não avaliadas,
  filtro por sessão e período e a tabela "o site disse × você marcou"; cada número abre a grade
  filtrada. O veredito do Painel é calculado sem a sua nota, para a comparação fazer sentido.

### Alterado
- Tema claro com verdes, amarelos e azul do foco mais escuros, bordas de botões e campos mais
  visíveis e botões pequenos com 48 px de altura (contraste e alvo de toque).

## [0.6.0] — 2026-10-13

Importador no PC e o RAW sem processamento (decisão 0015).

### Adicionado
- **Importador** (`importador/`, Python): dois cliques no `importar.bat`, escolher a pasta do
  cartão, confirmar. Lê os metadados com o ExifTool nativo e revela cada CR3 **sem o
  processamento da câmera** (LibRaw: sem redução de ruído, sem realce de nitidez, sem correção da
  lente), no mesmo enquadramento do JPEG e com a curva de tons dele, para a comparação mostrar
  só o que o processamento muda nos detalhes. Escreve um pacote por dia (`<dia>_cartao.efsessao/`).
- **Importar pacote do PC** na tela Enviar (escolher a pasta ou arrastá-la): uma linha por
  disparo, JPEG + CR3 + RAW sem processamento.
- Na ficha, a versão **RAW sem processamento** vem primeiro e a comparação entre versões ganha
  **"O que a câmera fez com o RAW"**: quanto ruído a câmera tirou, quanta nitidez acrescentou ou
  se apagou detalhe, nos mesmos recortes a 100%.
- Selo **RAW** na grade de fotos. Explicações do papel do CR3 no envio, na ficha (foto só com
  JPEG) e no Sobre (pedido do Guilherme).
- Testes do importador (pytest) dentro do `npm test` e no GitHub.

### Mudado
- Esquema de dados 7 (variante `raw_neutral`). Um aparelho com app antigo é avisado para
  atualizar ao encontrar dados do formato novo no Drive (v0.5.3).
- A revelação inteira (~27 MB) é medida uma vez no PC e apagada; ao Drive vão só os recortes e
  as medidas dela.

## [0.5.4] — 2026-10-12

### Corrigido
- O aviso de atualização da v0.5.3 podia sumir sozinho logo depois de aparecer, quando os dados
  locais terminavam de abrir depois dele (os testes no GitHub pegaram, e a v0.5.3 não chegou a ser
  publicada). Cada aviso do topo agora esconde só a si mesmo.

## [0.5.3] — 2026-10-12

### Adicionado
- Aviso **"Versão nova do app"** com o botão **Atualizar agora**: o app confere a versão publicada
  ao abrir, ao voltar para a tela e a cada 30 minutos. Um aparelho deixado aberto com uma cópia
  antiga (o app instalado no tablet, principalmente) fica sabendo que precisa atualizar.

### Corrigido
- Uma sessão criada num aparelho podia não aparecer no outro, mesmo sincronizando: quando um dos
  aparelhos estava com uma versão antiga do app e o outro já tinha gravado no Drive dados num
  formato novo (a v0.5 mudou o formato duas vezes), a sincronização do aparelho antigo parava
  antes de enviar o que ele tinha de novo, e o motivo ficava escondido na aba Drive. Agora o
  topo da tela mostra **"Atualize o app neste aparelho"** com o botão para atualizar, o selo
  vira "Atualize o app" e nada é enviado até atualizar, para não estragar os dados mais novos.

## [0.5.2] — 2026-10-12

### Corrigido
- Logo depois de soltar uma foto em outra cena, um toque rápido em qualquer botão da sessão (por
  exemplo "Selecionar fotos") era ignorado por meio segundo. Agora só o clique gerado pelo próprio
  soltar é ignorado.

## [0.5.1] — 2026-10-12

Cenas dentro da sessão (decisão 0014). Fecha a v0.5.

### Adicionado
- A sessão aparece separada em **cenas**, sozinha, com o motivo de cada corte (pausa, troca de
  lente, salto de zoom, enquadramento diferente). Separação conferida nas 26 amostras.
- **Arrastar e soltar** com o dedo: segurar a foto, levar a outra cena ou à área "nova cena"; a
  tela rola sozinha perto das bordas. "Mover para" ganhou "Cena N" e "Nova cena". "Separar as
  cenas automaticamente de novo" desfaz as correções.
- **Diagnóstico por cena:** vereditos, luz, problema e ajuste principal (com "Por quê"),
  comparação entre a mais nítida e a mais mole e o que mudou entre elas.
- **Quanto os ajustes variaram** na cena e na sessão, com aviso quando dois ajustes escolhidos
  por você mudaram ao mesmo tempo entre fotos seguidas.
- **Diagnóstico da sessão:** número de cenas, totais e problema que se repete em mais de uma
  cena.

### Mudado
- Esquema de dados 6 (`scene_id` na foto). Mudar a foto de sessão volta a cena dela para a
  separação automática.
- Na grade, o selo "risco de tremido" não aparece mais quando o diagnóstico já diz "Provável
  tremido".

## [0.5.0] — 2026-10-12

Diagnóstico de uma foto com orientação (decisões 0011 e 0013). Primeira parte da v0.5; as cenas
vêm na v0.5.1.

### Adicionado
- Cartão **Diagnóstico** no topo da ficha: veredito (Boa, Aceitável, Com problema, Sem dados para
  julgar), o que aconteceu e **o que fazer na próxima captura**. Cada achado mostra o número que
  o gerou e, em "Por quê", de onde vem (física da exposição, calibração da EOS RP, regra geral
  à espera da Rodada 2, pixels desta foto, sua avaliação) e o grau de certeza.
- Achados: tremido (velocidade × 1/focal, confirmado pelo desfoque no foco), assunto em
  movimento (com Servo AF), foco fora do ponto de AF (com profundidade de campo pela distância
  de foco da RF 50), mole sem velocidade lenta, RF 75-300 na abertura máxima, difração, ISO alto
  (e redução de ruído Forte), altas luzes estouradas, sombras empastadas, foto escura,
  reduzida ou recomprimida no caminho e tamanho menor escolhido na câmera.
- **O que dava para fazer com esta luz**: a combinação à mão sem tremido e a combinação com
  apoio, calculadas pela luz da cena, pela abertura máxima no zoom usado e pela lente.
- Luz da cena pelo **fotômetro da câmera** (`MeasuredEV`), sem a compensação; também na tela
  Avaliar.
- **O que faltou para diagnosticar**: campo não lido ou medida que não deu para fazer nunca
  vira orientação (regra 5).
- Veredito de cada foto na grade de fotos.
- Medidas novas por foto: desfoque (Crété-Roffet) no recorte do foco e em 12 trechos a 100%,
  histograma com estouro e pretos, assinatura 8×8 (para as cenas da v0.5.1).
- Leitura da abertura máxima no zoom, da luz do fotômetro e da distância de foco (MakerNote
  Canon).
- Limites calibrados nas 26 amostras reais (`docs/CALIBRACAO-RESULTADOS.md`).

### Mudado
- Esquema de dados 5 (campos novos da captura) e métricas versão 2: cada foto é medida de novo
  uma vez, a partir do original guardado no aparelho.
- A tela Avaliar mostra "Luz da cena: EV …" com a mesma origem da ficha (antes: "Luz da cena
  (pela exposição)").

## [0.4.1] — 2026-10-12

### Corrigido
- Com uma aba aberta antes da atualização, o app travava calado: a sincronização ficava em
  "Sincronizando…" e as configurações não apareciam, porque a aba antiga segurava os dados
  locais (banco na versão anterior). Agora aparece um aviso "Feche as outras abas do
  Evolução Fotografia", e a aba nova continua sozinha quando a outra fecha. Uma aba antiga
  aberta com esta versão larga os dados quando uma versão mais nova abre e pede para ser
  recarregada.

## [0.4.0] — 2026-10-12

Google Drive, sincronização, app instalável e backup. Client ID do projeto "Evolucao
Fotografia" (app em teste no Google Cloud), conferido nas duas origens autorizadas.

### Adicionado
- Aba **Drive**: conectar ao Google Drive (escopo `drive.file`), estado da sincronização,
  espaço usado, configurações, backup e instalação. Selo de sincronização no topo.
- Sincronização com o app aberto: traz do Drive o que mudou (outro aparelho) e envia o que
  está pendente; pastas por sessão, `sessao.json` com histórico, `indice.json` e `config.json`;
  fotos movidas, removidas (lixeira do Drive) e sessões excluídas chegam aos outros aparelhos.
- Login de 1 hora renovado no próximo toque; "Reconectar" quando não der.
- Originais enviados em partes de 8 MB, retomando de onde pararam; tela acesa durante o envio.
- Configurações: guardar JPEG, CR3 e localização; versões no histórico; limite de espaço
  (padrão 100 GB), que segura só os originais.
- Localização (GPS) removida de JPEG, CR3, metadados e registros antes de ir para o Drive.
- Backup `.efbackup` (exportar e importar, juntando com o que já está no app).
- App instalável (PWA) com uso sem internet e armazenamento protegido.
- Guia do Google Cloud para criar o Client ID, tela por tela, com os nomes em inglês.
- Espaço livre da conta Google na aba Drive; os originais esperam quando ele acaba.

### Corrigido
- Entre duas sincronizações seguidas, a tela mostrava "Tudo sincronizado." por um instante
  antes de a segunda começar.
- Sessão → "Selecionar fotos": a escolha em "Mover para" voltava sozinha para "Nova sessão"
  quando a tela se atualizava (análise terminando, sincronização), e a foto ia para uma sessão
  nova.

### Modelo de dados
- Banco local versão 3 (store `sync`); configurações em `meta`. Registros sem mudança.

## [0.3.1] — 2026-10-12

Avaliação refeita depois do primeiro uso no tablet (decisão 0012).

### Mudado
- **Nitidez 1–5** no lugar da nota geral, em botões (teclas 1–5 no computador).
- **Problema principal** pelo que se vê ao ampliar, sem supor a causa: nenhum problema, mole
  por inteiro, foco no lugar errado, arrastada, granulada, quadriculada ao ampliar, outro.
  Substitui a categoria ("pixelada no envio" supunha o envio como causa).
- **Onde** (dentro / fora) e **Luz** percebida (forte / média / fraca) no lugar das cinco
  opções de luz; "Onde, luz e assunto iguais à anterior".
- Avaliada = nitidez + problema; o avanço automático acontece quando os dois estão marcados,
  em qualquer ordem. Corrigir só a nitidez de uma foto já avaliada não muda de foto.
- Sessão mostra a nitidez média e a contagem de cada problema; selo da lista e ficha mostram
  nitidez e problema.

### Adicionado
- **Luz da cena pela exposição** (EV a ISO 100, com faixa de referência) na tela Avaliar.

### Modelo de dados
- Esquema 4: novo formato de `rating`. Migração 3 → 4 mantém só o que tem o mesmo sentido;
  as fotos já avaliadas voltam a "não avaliada" (falta a nitidez).

## [0.3.0] — 2026-10-12

Avaliação e sessões.

### Adicionado
- Aba **Sessões**: fotos sem sessão agrupadas pelo dia da captura, com "Criar sessão" ou
  "Juntar a" uma sessão do mesmo dia; o mesmo quadro aparece na aba Enviar depois do envio.
- Sessão com nome, data, local, notas e marcação de experimento (parâmetro variado e
  descrição); cada foto mostra o valor do parâmetro. Seleção de fotos para mover entre
  sessões; excluir sessão mantém as fotos.
- Tela **Avaliar**: categoria, nota 1–5, luz, assunto e nota livre por toque; avanço
  automático ao escolher a categoria; "luz e assunto iguais à anterior"; foco a 100%;
  deslize, setas e teclas 1–5; "próxima sem avaliação".
- Ficha da foto: avaliação, troca de sessão e botão Avaliar. Lista de fotos: selo da avaliação
  e contagem de avaliadas.

### Modelo de dados
- Esquema 3: formato de `rating`, documento de sessão. Migração 2 → 3. Banco local versão 2
  (store `sessions`, índice `session_id`).

## [0.2.0] — 2026-10-12

Recortes a 100% e indicadores objetivos por foto, calibrados com 26 fotos reais da EOS RP.

### Adicionado
- Recortes a 100% (sem reamostrar) no ponto de AF da câmera, ou no centro, e numa área uniforme
  para medir ruído. O toque na prévia escolhe outra área, e "Voltar ao automático" desfaz.
  Ampliação de 100% e 200%.
- Indicadores em Web Worker: resolução real × tamanhos da EOS RP (proporções, M/S, recorte
  1,6x), metadados removidos, risco de tremido (velocidade × 1/distância focal), nitidez no
  foco (variância do Laplaciano), ruído na área uniforme (Immerkær) e qualidade estimada do
  JPEG pelas tabelas de quantização.
- Comparação entre versões do mesmo disparo (CR3, JPEG do cartão, JPEG do tablet): pixels,
  bytes por pixel, compressão, cor, dados Canon e nitidez no mesmo recorte, com o que mudou em
  cada etapa.
- Etiquetas na lista de fotos: reduzida no caminho, risco de tremido, metadados removidos.
- Aba Sobre: versão das métricas e "Recalcular desatualizadas".
- `tests/amostras/metricas.mjs`: mede as amostras reais com o próprio site (local).

### Corrigido (calibração com as amostras reais)
- AF em 1 ponto aparecia como 143 áreas: o normalizador agora usa `ValidAFPoints`.
- Modo A+ aparecia como Programa (P): agora usa `Canon:EasyMode` ("Cena Inteligente Auto").
- "Flexizone Single" (AF em 1 ponto da EOS RP) aparecia sem tradução.
- Foto 16:9 com RAW acusava perda de pixels entre o CR3 e o JPG; agora aparece como formato
  escolhido na câmera. A região de cada recorte é convertida pelo campo de visão de cada versão
  (o JPEG dentro do CR3 é o sensor inteiro).
- Nitidez e ruído passam a ser medidos no JPG da câmera, e não no JPEG embutido no CR3
  (qualidade ~80 contra ~97), quando os dois têm os mesmos pixels.
- A busca automática da área uniforme evita tons quase brancos, onde a curva do JPEG esconde
  o ruído.
- Fotos enviadas na v0.1 têm os metadados relidos do JSON guardado do ExifTool ao serem
  analisadas, e recebem as correções acima.
- O conferidor das amostras mostrava o tempo e a abertura "exatos" do CR3 (grupo Canon); agora
  usa os nominais do EXIF, como o site.

### Modelo de dados
- Esquema 2: `crop_choice`, `crops`, `tag_count` e `analysis` por variante. Migração 1 → 2.

## [0.1.0] — 2026-10-10

Primeira entrega: envio pela página e ficha básica, com dados só no navegador.

### Adicionado
- Envio de fotos JPEG e CR3: botão de galeria, botão "Arquivos" (para o CR3 aparecer no
  Android) e arrastar e soltar no computador. Tipo detectado pelo conteúdo.
- Leitura híbrida de metadados: exifr (instantânea) + ExifTool 13.42 em WebAssembly, em Web
  Worker, com MakerNotes Canon (modo e área de AF, ponto de AF, disparo, estilo de imagem,
  redução de ruído, qualidade e tamanho do JPEG).
- CR3: metadados completos e prévia a partir do JPEG embutido, com a orientação correta.
- Identificador estável por foto; JPEG + CR3 do mesmo disparo viram uma foto; reenvio
  reconhecido como repetido.
- Ficha da foto: prévia com o quadro do AF, arquivos e pixels de cada um, configuração em
  linguagem simples com explicações, lista do que não foi lido com o motivo provável,
  metadados completos, navegação por setas, teclado e deslize, remoção.
- Tela Sobre com diagnóstico (tela, densidade, espaço, versões, estado do leitor).
- Armazenamento local em IndexedDB com modelo de dados versionado e migrações.
- Testes: 35 unitários (`node:test`, inclusive ExifTool real sobre fixtures sintéticas de
  JPEG e CR3) e 14 de ponta a ponta (Playwright, tablet retrato e paisagem).
- CI no GitHub Actions: testes a cada push; publicação no Pages só se tudo passar.
- Documentação: CLAUDE.md, arquitetura, modelo de dados, roadmap, guia de uso, 7 decisões,
  protocolo de amostras de calibração.
