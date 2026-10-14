# 0017 — v2.0: reprocessamento

Data: 2026-10-13 · Situação: **aceita** (v2.0). Escolhas do Guilherme no mesmo dia.

## Contexto

As estatísticas da V2 (v2.1 em diante) só valem com todas as fotos medidas pela mesma
`METRICS_VERSION`. Até a v1.0, uma foto com medidas antigas era refeita ao abrir a ficha ou pelo
botão "Recalcular desatualizadas" do Sobre, mas só a partir de um original guardado **neste
aparelho**. Foto que chegou pelo Drive (sem original no aparelho) ficava com a medida antiga sem
avisar, e não havia progresso, pausa nem lista do que não deu para refazer.

## Decisão

1. **Tela `#/reprocessar`** (todas as fotos) e `#/reprocessar/<sessão>`: antes de começar mostra
   quantas fotos têm o original neste aparelho, quantas no Drive (com os MB a baixar) e quantas
   não têm original; depois, progresso com `aria-live`, **Pausar** (para depois da foto atual) e a
   lista das que ficaram com as medidas antigas, cada uma com o motivo e o link para a ficha.
2. **Original só no Drive: baixado, medido e apagado** (escolha do Guilherme). Não ocupa o
   aparelho; um reprocessamento futuro baixa de novo. Alternativa recusada: guardar o original
   baixado (mais rápido da segunda vez, mas ~8 MB por JPEG e ~30 MB por CR3 no navegador).
3. **Tamanho do download à vista, com OK** (escolha do Guilherme): o botão diz "Baixar N MB do
   Drive e reprocessar". O navegador não informa com segurança se a conexão é Wi-Fi.
4. **Sem estado próprio**: a fila é o que ainda tem medida antiga. Pausar, fechar a aba ou falhar
   e rodar de novo continua de onde parou. Nada novo é guardado (esquema de dados igual).
5. "Medida antiga" = versão medida com `metrics_version` diferente da atual. Foto ainda não medida
   (na fila do envio) não conta, e o RAW sem processamento (`transient`, decisão 0015) mantém as
   primeiras medidas: a imagem inteira dele não existe mais.
6. Aviso "N fotos com medidas antigas" na grade, no Painel e na sessão, com o link para reprocessar.
   O botão do Sobre continua (só originais do aparelho) e aponta para a tela nova.
7. Uma única implementação das métricas: o reprocessamento passa pela mesma fila de análise
   (`pipeline/analyze.js`, uma foto por vez), que agora aceita originais vindos de fora.

## Consequências

- `core/reprocess.js` (plano, puro), `pipeline/reprocess.js` (fila, pausa, download temporário),
  `ui/views/reprocess.js` (tela e aviso). `sync.js` expõe `downloadFile` e `driveReady`.
- Foto cujo original não foi ao Drive (envio de originais desligado) e não está no aparelho fica
  com as medidas antigas e aparece como tal (regra 5).
