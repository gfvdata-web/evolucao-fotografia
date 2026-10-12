# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões semânticas.

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
