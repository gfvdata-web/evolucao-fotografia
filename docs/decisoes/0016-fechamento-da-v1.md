# 0016 — v1.0: polimento, Painel (beta) e critério para fechar a V1

Data: 2026-10-12 · Situação: **aceita** (v1.0; nada implementado). Proposta em 12/10/2026; o Guilherme
aceitou as recomendações no mesmo dia (axe-core nos testes; tabela "o site disse × você marcou").

## Contexto

O roadmap reserva a v1.0 para "acessibilidade, desempenho no tablet, Samsung Internet, um Painel
(beta) mínimo e o roadmap da V2 detalhado". Faltava dizer o que cada item significa na prática,
como medir e quando a V1 está terminada. Pontos já conhecidos:

- A grade de fotos carrega a **prévia de 2048 px** de cada foto (`ui/views/photos.js`); com
  centenas de fotos, isso pesa na memória e na rolagem do tablet.
- O Playwright não roda o Samsung Internet; hoje ele só é conferido à mão pelo Guilherme.
- A avaliação mudou na v0.3.1 (nitidez 1–5 + problema principal) e a v0.5 trouxe o veredito do
  diagnóstico: o Painel pode contar os dois.
- As decisões 0006 (envio com o app aberto) e 0010 (sincronização) pediam revisão depois do uso
  real.

## Decisão

1. **Desempenho no tablet, com números.**
   - Miniatura de ~400 px gerada junto da prévia (blob `<id>/thumb`, refeita para as fotos
     antigas na primeira abertura) e usada na grade, na sessão e nas cenas; a prévia de 2048 px
     fica para a ficha e a avaliação.
   - Grade montada aos poucos (só o que aparece na tela, `IntersectionObserver`).
   - Aba Sobre ganha **"Desempenho deste aparelho"**: tempo médio de leitura, prévia e análise
     por foto, medido nas fotos reais, para o Guilherme mandar o número do Tab S9+.
   - Metas a confirmar no tablet: grade de 500 fotos rolando sem travar; uma foto analisada em
     até ~3 s; sessão de 300 fotos enviada sem o navegador fechar a aba por memória.
   - Teste ponta a ponta com 200 fotos sintéticas, conferindo que a grade só cria as miniaturas
     visíveis (contagem, não tempo, para não ficar instável no CI).
2. **Acessibilidade.**
   - Auditoria automática com **axe-core** nos testes ponta a ponta, em cada tela, nos dois
     temas e nas duas orientações (aceito: dependência nova, só de desenvolvimento; o site não
     muda).
   - Conferências próprias, sem dependência: alvos de toque ≥ 48 px, foco visível, todo botão
     de ícone com nome, contraste das variáveis de cor de `:root` nos dois temas, página
     legível com a fonte do sistema em 200%.
   - `aria-live` no progresso do envio, no selo de sincronização e no avanço da avaliação.
3. **Samsung Internet.**
   - Botão **"Conferir compatibilidade"** na aba Sobre: testa cada recurso que o app usa
     (IndexedDB, Web Worker de módulo, WebAssembly, `createImageBitmap` com orientação, Wake
     Lock, armazenamento protegido, janela de login do Google, instalação) e mostra ok/falha.
     O Guilherme toca nele no Chrome e no Samsung Internet do tablet e manda o resultado.
   - Cada recurso que falhar ganha uma alternativa ou um aviso claro na tela.
   - Roteiro de conferência manual curto no GUIA-DE-USO (o que só dá para ver no aparelho).
4. **Painel (beta) mínimo**, aba nova "Painel":
   - quantas fotos por nitidez (1–5), por problema principal e por veredito do diagnóstico;
     avaliadas × não avaliadas; filtro por sessão e por período;
   - cada número leva à grade de fotos filtrada;
   - sem cruzar com ISO, velocidade, lente etc.: isso é a V2.
   - Aceito: uma tabela "o site disse × você marcou" (veredito × nitidez), que
     mostra onde o diagnóstico discorda do olho dele e prepara os limites da V2.
5. **Revisões pendentes:** com o uso real até lá, rever as decisões 0006 e 0010 e registrar o
   resultado nelas. A Rodada 2 de amostras **não** bloqueia a v1.0: se chegar antes, os limites
   de `LIMITS` são atualizados; se não, a orientação continua dizendo que usa regra geral.
6. **Roadmap da V2 detalhado** em entregas (v2.0, v2.1...), com o que cada uma pede de dados
   (quantas fotos avaliadas para cada estatística fazer sentido).
7. **Critério para fechar a V1 (tag `v1.0.0`):** todas as funcionalidades do roadmap, de v0.1 a
   v1.0, com teste automatizado (unitário + ponta a ponta) e `npm test` verde; amostras
   conferidas (`conferir.mjs` e `metricas.mjs`); importador testado no PC do Guilherme com um
   cartão real; GUIA-DE-USO completo (tablet, Drive, importador, Painel); conferência no Chrome
   e no Samsung Internet do tablet relatada por ele.

## Alternativas consideradas

- **Acessibilidade só com conferências próprias**, sem axe-core. Nenhuma dependência nova, mas
  cobre só o que lembramos de testar; o axe-core verifica dezenas de regras (rótulos, papéis,
  contraste real dos elementos) e não vai para o site publicado.
- **Painel já com cruzamentos** (ISO × ruído, velocidade × tremido). É o coração da V2 e só faz
  sentido com muitas fotos avaliadas; na v1.0 o Painel serve para mostrar o volume e a
  distribuição das avaliações.
- **Virtualização completa da grade** (recriar só as linhas visíveis ao rolar). Mais rápida com
  milhares de fotos, mas complica a rolagem, o arrastar e soltar das cenas (v0.5.1) e o "voltar
  para onde estava"; miniaturas + montagem aos poucos devem bastar até centenas de fotos por
  sessão. Rever com os números do tablet.

## Consequências

- Blob novo de miniatura: `docs/MODELO-DE-DADOS.md`, `core/drive-layout.js` (vai ou não ao
  Drive: proposta é não, refeita a partir da prévia) e backup.
- Uma aba a mais no menu (seis): conferir que cabe no tablet em retrato.
- Teste ponta a ponta `tests/e2e/v10-*.spec.mjs` para o Painel, a grade aos poucos e a
  auditoria de acessibilidade em todas as telas.
