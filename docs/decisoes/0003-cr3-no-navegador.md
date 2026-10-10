# 0003 — CR3 no navegador: seletor sem filtro e JPEG embutido

**Data:** 2026-10-10 · **Situação:** aceita

## Contexto
No Android, o seletor de arquivos filtra por tipo MIME e não por extensão, e o CR3 costuma
aparecer como genérico (`application/octet-stream`) — some com `accept="image/*"` ou `.cr3`.
O navegador também não decodifica RAW.

## Escolha
- Dois botões: **"Fotos da galeria"** (`accept="image/*,.jpg,.jpeg"`) e **"Arquivos (inclui
  CR3)"** sem `accept`, que abre o gerenciador de arquivos e entrega o arquivo intacto.
- O tipo é detectado pelo conteúdo (assinatura), não pela extensão nem pelo MIME.
- Para pixels, usa-se o JPEG em tamanho cheio que a câmera grava dentro do CR3 (primeiro
  track), localizado lendo só os cabeçalhos das caixas ISO-BMFF (`metadata/cr3.js`).

## Consequências
- O JPEG embutido é processado pela câmera: não serve como "RAW neutro". A comparação RAW
  neutro × JPEG fica com o importador Python (v0.5), com rawpy/LibRaw.
- O JPEG embutido não tem orientação própria: a do CR3 é aplicada ao gerar a prévia.
- Observação: o seletor de fotos do Android 14+ pode remover o GPS das imagens; o indicador de
  metadados ausentes vai mostrar isso.
