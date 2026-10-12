# 0013 — Motor de diagnóstico da v0.5.0: medidas, limites e ordem de entrega

Data: 2026-10-12 · Situação: aceita (v0.5.0). Detalha a decisão 0011.

## Contexto

A decisão 0011 definiu o que a v0.5 faz: cenas e um diagnóstico com orientação que funciona com
uma foto só. Faltava decidir como medir cada coisa sem IA e em que ordem entregar. A Rodada 2 de
amostras, que mede a mão e o equipamento do Guilherme, ainda não foi feita. A 1ª rodada (26
fotos reais, séries F e T) serve de calibração parcial.

## Decisão

1. **Duas entregas.** v0.5.0 = diagnóstico de uma foto (é o "ponto ideal" do pedido). v0.5.1 =
   cenas, que reúne o diagnóstico das fotos de cada cena, compara e mostra a variação dos ajustes.
   A "assinatura" 8×8 de cada foto, que vai ajudar a separar as cenas, já é calculada na v0.5.0,
   para não recalcular as fotos duas vezes.
2. **Luz da cena pelo fotômetro da câmera** (`Canon:MeasuredEV`). Nas 26 amostras ele bateu com a
   luz calculada pela exposição (diferença ≤ 0,25 EV) e, na F10 (compensação −1), deu a luz real
   da cena, sem a compensação. Sem ele: exposição usada + compensação; no modo M, corrigida pelo
   brilho mediano da foto.
3. **Desfoque pela métrica de Crété-Roffet** (2007), e não pela variância do Laplaciano, que
   depende demais do assunto (de 4 a 954 nas amostras). A nova vai de 0 (nítido) a 1 e separou as
   amostras: tripé 0,26–0,27, à mão sem tremido 0,37–0,38, tremidas (F04, F06) 0,54–0,56, RF
   75-300 aberta a 300 mm (T01) 0,52. Limites: até 0,40 nítida, até 0,47 um pouco mole, acima
   disso mole.
4. **Foco errado × tremido pelos trechos.** Além do recorte do foco, 12 trechos de 256 px a 100%,
   espalhados numa grade de 4 × 3. Foco errado só quando um trecho com detalhe está nítido e
   tem pelo menos 0,22 a menos de desfoque que o ponto de AF. Nas fotos bem focadas da série T,
   um trecho com mais contraste que o alvo já mediu até 0,14 a menos; na F06, tremida, 0,17.
   Com velocidade abaixo da referência, a certeza do foco errado cai para baixa.
5. **Abertura máxima lida do arquivo** (`Canon:MaxAperture`, no zoom usado) e distância de foco
   (`FocusDistanceLower/Upper`, só a RF 50 grava) para a profundidade de campo. Perfis das lentes
   em `core/lens-profiles.js`: a RF 75-300 tem a faixa nítida calibrada (f/8 a partir de 200 mm,
   T01–T04); a da RF 50 é regra geral até o bloco A da Rodada 2.
6. **"O que era possível"**: com a luz, a focal e a abertura máxima, o motor monta a combinação à
   mão (velocidade com folga de 2× sobre 1/focal, ou 1/500 s com assunto em movimento; abertura
   mais nítida se o ISO ficar até 3200, senão abertura máxima e depois a velocidade mínima) e a
   combinação com apoio (ISO 100). Os limites de ISO e de tremido são regra geral, e cada
   orientação diz isso.
7. **Nada é guardado.** O diagnóstico é derivado do registro na hora (como os indicadores), então
   mudar um limite muda todas as fotos de uma vez, sem migração. As medidas de pixels novas
   ficam na análise (`METRICS_VERSION` 2); os campos novos da captura sobem o esquema para 5.
8. **A avaliação do Guilherme manda no veredito.** Nitidez 4–5 sem problema = "Boa", mesmo que os
   números digam outra coisa; o problema marcado confirma o achado que o explica (certeza sobe um
   nível) ou vira "os dados não apontam a causa", com as causas que os dados não veem.

## Alternativas consideradas

- **Tudo da v0.5 numa entrega só.** Menos fechamentos de versão, mas o Guilherme esperaria mais
  para testar o que pediu primeiro (uma foto só) e as cenas dependem do diagnóstico estar certo.
- **Direção do borrão para separar tremido de foco errado** (desfoque por eixo, que a métrica
  já calcula). Nas amostras a diferença entre os eixos dependeu mais do assunto que do tremido (a
  F02, sem tremido, teve a maior diferença). Fica calculada, mas não entra no diagnóstico.
- **Variância do Laplaciano com limites por cena.** Precisaria de várias fotos da mesma cena, o
  que contraria o "uma foto só". Continua nos indicadores, como valor relativo.
- **Esperar a Rodada 2 para começar.** Os limites de ISO, de tremido à mão e de abertura da RF 50
  sairiam medidos, mas o motor, as telas e os testes não dependem disso: os números ficam em
  `LIMITS` (`core/diagnosis.js`) e trocam quando as amostras chegarem.

## Consequências

- Cada foto é recalculada uma vez a partir do original guardado no aparelho (`METRICS_VERSION`
  2). Fotos que chegaram pelo Drive sem o original ficam com a análise antiga e a ficha diz o que
  não foi medido.
- Na Rodada 2: blocos M e Z trocam a regra 1/focal pela mão do Guilherme, o bloco I troca os
  limites de ISO, o bloco A dá a faixa nítida da RF 50, o bloco D calibra a margem do foco errado
  e o bloco E a compensação para o céu.
- Os textos da orientação ficam em `core/diagnosis.js` (como os dos indicadores em
  `core/indicators.js`), porque saem dos números.
