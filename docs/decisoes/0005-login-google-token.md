# 0005 — Login Google sem servidor (token de 1 hora)

**Data:** 2026-10-10 · **Situação:** aceita para a v0.4

## Contexto
O Drive é acessado direto do navegador. Sem backend, o único fluxo possível do Google Identity
Services é o **modelo de token**: o Google entrega um *access token* válido por **1 hora** e
**nenhum refresh token** (renovar sem perguntar exige um segredo guardado em servidor).

## O que isso significa na prática
- Tudo que é local (enviar, ver fichas, avaliar) funciona sem token.
- O token só é usado para falar com o Drive. Ao vencer, chamadas ao Drive respondem 401.
- Afeta: filas de envio que passam de 1 h e abrir o app no dia seguinte.

## Como contornar (escolha)
1. **Renovação silenciosa no próximo toque.** Com o token perto de vencer (~50 min), o app
   pede um novo junto com qualquer toque seu (avaliar, trocar de foto). Se o Google ainda
   reconhece a sua conta no navegador e o consentimento já foi dado, a janela abre e fecha
   sozinha, sem perguntar nada. O pedido precisa vir de um toque porque o navegador bloqueia
   janelas abertas sem ação do usuário.
2. **Se não der**, a fila de envio pausa e aparece um aviso "Reconectar ao Drive" — um toque e
   continua de onde parou (o upload "resumable" do Drive guarda o progresso por uma semana).
3. Nada se perde enquanto isso: mudanças ficam na fila local com o selo "pendente".

Na prática: zero ou um toque em "Reconectar" por sessão de uso.

## Alternativa descartada (por ora)
Um mini-servidor (ex.: Cloudflare Worker ou Google Apps Script) guardando o segredo e emitindo
refresh tokens — acaba com o "Reconectar", mas cria um backend com credencial, contra a regra
"sem servidor". Reavaliar só se o "Reconectar" incomodar no uso real.

## Outras consequências
- Escopo `drive.file` (não sensível): o app vê só o que ele criou; dá para publicar o app como
  "Em produção" sem verificação do Google.
- Testar no app instalado (PWA) no Android: janelas de login em modo standalone podem se
  comportar diferente de uma aba comum.
