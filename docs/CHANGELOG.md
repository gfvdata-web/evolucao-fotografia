# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões semânticas.

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
