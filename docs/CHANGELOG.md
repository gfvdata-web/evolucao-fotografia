# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versões semânticas.

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
