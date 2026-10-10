# 0006 — Envio ao Drive com o app aberto

**Data:** 2026-10-10 · **Situação:** aceita para a v0.4 — **rever depois do uso real**

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
