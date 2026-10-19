# 0006 — Envio ao Drive com o app aberto

**Data:** 2026-10-10 · **Situação:** aceita (revista no uso real em 2026-10-19, decisão 0016)

## Contexto
O Android pausa páginas quando a tela apaga ou o navegador sai da frente.

## Opções
1. **Fila na página**: envia enquanto o app está aberto (inclusive enquanto você avalia),
   mantém a tela acesa durante a fila (Screen Wake Lock) e retoma sozinha ao voltar.
2. Envio "em segundo plano de verdade" pelo service worker (Background Sync/Fetch): continuaria
   com a tela apagada, mas esbarra no token de 1 h (decisão 0005) e no suporte desigual entre
   Chrome e Samsung Internet.

## Escolha
Opção 1. O Guilherme pediu para rediscutir quando a prática estiver sendo testada.

## Revisão na v1.0 (13/10/2026)

Sem relato de uso real do envio com o app aberto até a v1.0 (a primeira sincronização real foi
no computador, em 12/10/2026). A decisão continua valendo; volta a ser revista no fechamento da
tag `v1.0.0`, com o relato do Guilherme no tablet (sessão grande enviada, tela apagando, aba
fechada no meio do envio).
