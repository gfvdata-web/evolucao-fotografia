# 0008 — Versão principal e campo de visão das versões

Data: 2026-10-12 · Situação: aceita (v0.2, calibração com as amostras reais)

## Contexto

Uma foto pode chegar em várias versões: CR3, JPG do cartão e JPG do tablet. Os indicadores de
nitidez e ruído usam uma versão principal, e a comparação recorta "a mesma região" em todas.
As 26 amostras da EOS RP mostraram dois problemas:

1. O site lê o CR3 pelo JPEG que a câmera grava dentro dele. Esse JPEG tem os mesmos pixels do
   JPG L, mas é uma prévia mais comprimida (qualidade estimada 80 contra 97) e mediu até 34%
   menos nitidez (mediana de 8%). No empate de pixels, a regra antiga escolhia o CR3.
2. O JPEG dentro do CR3 é sempre o sensor inteiro (3:2). Numa foto 16:9 com RAW, o JPG é só a
   faixa central. A mesma posição relativa (0–1) recortava partes diferentes da cena, e a
   comparação acusava "−16% de pixels" como perda no caminho.

## Decisão

- **Versão principal:** a de mais pixels; no empate, o JPG da câmera. O CR3 só é a principal
  quando tem mais pixels (por exemplo, RAW + JPEG M).
- **Campo de visão:** cada versão tem um campo em pixels do sensor, deduzido do tamanho que a
  EOS RP grava (`sensorField`). M e S mostram a mesma cena do L da mesma proporção; 16:9, 4:3,
  1:1 e recorte 1,6x são a parte central do sensor. As regiões são convertidas de um campo
  para o outro (`mapRegion`). Tamanho desconhecido (cópia reduzida): mesma posição relativa.
- Na comparação entre versões, uma queda de pixels para um tamanho que a câmera grava é
  informada como "formato escolhido na câmera", não como alerta.

## Alternativas consideradas

- **Campo pelo `AFImageWidth/Height` de cada arquivo.** Funciona no 16:9 e no recorte 1,6x
  (o MakerNote traz 6240×3504 e 3888×2592), mas não há amostra em M ou S para saber se o
  valor vem em pixels do sensor ou do arquivo, e um JPG sem MakerNote não o tem. A tabela de
  tamanhos da especificação da Canon cobre os dois casos.
- **Sempre o CR3 como principal**, por ser "o original". Só seria verdade com a renderização
  neutra do RAW (importador Python, v0.5). Hoje mediria a prévia comprimida.
- **Usar `CropTopMargin`/`CropLeftMargin`.** Dá a posição exata da faixa 16:9, mas também
  depende do MakerNote. Nas amostras, a faixa é centrada (328 px em cima e embaixo), que é o
  que a tabela já assume.

## Consequências

- Quando o importador da v0.5 trouxer a renderização neutra do RAW, ela entra como mais uma
  versão com o campo do sensor inteiro, sem mudar esta regra.
- Outra câmera precisa de um perfil em `core/camera-profiles.js` para ter o campo de visão; sem
  perfil, vale a posição relativa.
