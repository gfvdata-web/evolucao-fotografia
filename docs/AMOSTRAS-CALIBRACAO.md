# Amostras reais para calibração

Fotos reais da EOS RP usadas para calibrar a leitura de metadados (EXIF e MakerNotes Canon), o indicador de resolução e o de risco de tremido, e para servir de base às métricas de nitidez e ruído.

- Gabarito (o que cada foto deve conter): [`tests/amostras/roteiro.mjs`](../tests/amostras/roteiro.mjs)
- Conferência: `node tests/amostras/conferir.mjs` lê tudo em `amostras/`, reconhece cada foto pelo EXIF e gera `amostras/relatorio.md`.
- As fotos ficam só neste computador: `amostras/` está no `.gitignore`.

## Configuração base (todas as fotos, salvo indicação)

| Ajuste | Valor |
|---|---|
| Qualidade | **RAW + JPEG L** (grande, fina) |
| Recorte/proporção | **3:2** (tamanho cheio) |
| Estilo de imagem | Padrão |
| Balanço de branco | AWB |
| Red. ruído ISO alta | Padrão |
| Operação AF | One-Shot |
| Método AF | AF de 1 ponto |
| Medição | Avaliativa |
| Flash | desligado |
| Data/hora da câmera | conferir antes de começar |

Não mexa em correção de lente, otimizador de iluminação, etc.: deixe como você usa normalmente. A ordem das fotos não importa, exceto F08 → F09.

## O que é obrigatório e o que é livre

- **Obrigatório:** modo, lente, os números da coluna "Ajustes" e os ajustes em negrito (método AF, disparo, NR, estilo, proporção). É por eles que o conferidor reconhece cada foto e confere a leitura dos metadados.
- **Livre:** o assunto. Qualquer coisa do seu dia a dia serve: a vista da janela, a rua, plantas, objetos da casa. Não precisa ser bonita.
- **Foto escura ou clara demais não estraga o teste**, exceto onde a tabela diz o contrário (F01, F02, F08 e F09). Nas outras, o que se mede são os metadados e o tremido. Não corrija a exposição mudando os ajustes obrigatórios.
- **Se algum ajuste não for possível** (o menu não oferece, ou a luz não permite), fotografe com o mais próximo e me diga o que mudou. Eu ajusto o gabarito.

## As fotos

| Código | O que é | Lente | Modo | Ajustes | Assunto e luz sugeridos | Se a exposição sair ruim |
|---|---|---|---|---|---|---|
| F01 | Referência de nitidez | RF 50 | **Av** | f/5.6 · ISO 100 · 0 EV | Estante de livros ou objeto com texto e textura, a 1–3 m, perto da janela, **de dia**, com uma parede lisa em parte do quadro. Tripé ou câmera apoiada, temporizador 2 s. **Ponto de AF no canto superior direito**, sobre um detalhe. | Precisa ficar bem exposta: escolha um lugar mais claro. Em Av a câmera escolhe o tempo, e com tripé um tempo longo não faz mal. |
| F02 | AF em outro ponto | RF 50 | **M** | f/1.8 · ISO 100 · tempo livre | Mesmo lugar e enquadramento da F01. **Ponto de AF no canto inferior esquerdo**. | Gire o dial do tempo até a marca do fotômetro (escala no visor) ficar no 0. |
| F03 | Rajada (3 fotos) | RF 50 | **Tv** | 1/500 · ISO Auto | Pessoa andando, carro passando ou bicho, **de dia** (rua ou janela). Operação AF **Servo**, método **Rosto + Rastreamento**, disparo **contínuo**. Segure o botão até sair 3 fotos. | Tanto faz. |
| F04 | Tremido proposital | RF 50 | **Tv** | 1/8 · ISO Auto | Objeto parado com detalhe, **dentro de casa ou na sombra**. Ao sol, 1/8 deixa a foto toda branca. À mão, sem apoio. | Tanto faz. |
| F05 | Controle do tremido | RF 50 | **Tv** | 1/200 · ISO Auto | Mesmo objeto e lugar da F04, à mão. | Tanto faz. |
| F06 | Tele com risco | RF 75-300 em **300 mm** | **Tv** | 1/100 · ISO Auto | Algo distante com detalhe (placa, telhado, antena, árvore), **de dia, ao ar livre ou da janela**. À mão. | Tanto faz. |
| F07 | Tele controle | RF 75-300 em **300 mm** | **Tv** | 1/1000 · ISO Auto | Mesmo assunto da F06, **ponto de AF no centro**. | Tanto faz. A câmera sobe o ISO sozinha. |
| F08 | ISO alto, NR Alta | RF 50 | **M** | f/1.8 · **ISO 12800** · tempo livre | Cômodo **com pouca luz** (abajur, ou de noite com uma luz acesa em outro cômodo), com uma parede ou porta lisa no quadro. Câmera apoiada. Red. ruído ISO alta = **Alta**. | Precisa ficar exposta normalmente: ajuste o tempo até o fotômetro marcar 0 (provavelmente entre 1/250 e 1/4000). |
| F09 | ISO alto, NR Desativada | RF 50 | **M** | f/1.8 · **ISO 12800** · mesmo tempo da F08 | **Logo depois** da F08, mesmo lugar e enquadramento. Red. ruído ISO alta = **Desativada**. | Use exatamente o tempo da F08, para comparar só a redução de ruído. |
| F10 | Programa e estilo | RF 50 | **P** | **ISO 200 · −1 EV** | Qualquer cena. Medição **Pontual**, estilo **Paisagem**. | Ela sai mais escura de propósito (−1 EV). |
| F11 | Proporção 16:9 | RF 50 | **Av** | f/8 · ISO 400 | Qualquer cena. Recorte/proporção = **16:9**. | Tanto faz. |
| F12 | Recorte 1,6x | RF 50 | **Av** | f/4 · ISO 400 | Qualquer cena. Recorte/proporção = **1,6x (recorte)**. | Tanto faz. |
| F13 | Automático, JPEG menor | RF 50 | **A+** (Cena Inteligente) | — | Qualquer cena. Qualidade **só JPEG M**, sem RAW. | Tanto faz. |
| F14 *(opcional)* | GPS | qualquer | **Av** | f/11 · ISO 100 | Ao ar livre, só se você usa a localização pelo Camera Connect (Bluetooth). | Tanto faz. |

Sugestão de roteiro: de dia, perto da janela, faça F01, F02, F04, F05, F10–F13. Da janela ou na rua, faça F03, F06, F07 (e F14). À noite, num cômodo com pouca luz, faça F08 e F09.

**Ao terminar, volte a câmera para a sua configuração normal** (qualidade, proporção 3:2, estilo, NR, medição, AF).

São 16 disparos (F03 vale 3). F13 não tem CR3.

## Série T: a RF 75-300 no tripé

Isola o que tira nitidez na tele, uma variável por vez: abertura, distância focal, vidro da janela, apoio e forma de disparar. Fotografe todas com o **mesmo alvo distante** e o **mesmo ponto de AF**, em poucos minutos, para a luz não mudar.

**Base da série:** RF 75-300, tripé, modo **Av**, ISO 100, temporizador 2 s (*Self-timer: 2 sec*), AF de 1 ponto sobre o alvo e **janela aberta**. Escolha um alvo com detalhe fino: antena, placa, telhado com telhas ou prédio com janelas. Evite olhar por cima de telhados muito quentes ao sol do meio-dia, porque o ar quente ondula a imagem.

| Código | Focal | Ajustes | O que muda |
|---|---|---|---|
| T01 | 300 mm | f/5.6 · ISO 100 | Abertura máxima |
| T02 | 300 mm | f/8 · ISO 100 | Referência da série |
| T03 | 300 mm | f/11 · ISO 100 | Mais fechada |
| T04 | 300 mm | f/16 · ISO 100 | Bem fechada (difração) |
| T05 | **200 mm** | f/8 · ISO 100 | Distância focal menor, mesmo alvo |
| T06 | 300 mm | f/8 · **ISO 200** | **Janela fechada**, através do vidro. O ISO 200 só serve para diferenciar da T02 |
| T07 | 300 mm | **Tv 1/640 · ISO Auto** | **À mão livre**, sem tripé |
| T08 | 300 mm | f/8 · **ISO 400** | Tripé, mas **sem temporizador** (*Single shooting*), disparando com o dedo. O ISO 400 só serve para diferenciar da T02 |
| T09 | 300 mm | f/8 · **ISO 800** | Tripé, **temporizador de 10 s** (*Self-timer: 10 sec/remote*), mãos fora: dá tempo de a vibração do toque passar. O ISO 800 só serve para diferenciar da T02 |

Se a janela não abrir, faça todas através do vidro, pule a T06 e avise.

## Como entregar os arquivos

Coloque tudo nestas pastas dentro de `EvolucaoFotografia\amostras\`, **sem renomear, editar, girar ou recortar**:

| Pasta | O que vai nela |
|---|---|
| `cartao\` | Do **cartão, pelo leitor**: o CR3 **e** o JPG de todas as fotos. |
| `tablet\` | Do **Camera Connect**, o JPG de todas as fotos, transferido com **Tam. original** (o habitual; "Reduzido" nunca é usado e fica fora da análise). |
| `tablet-raw\` *(opcional)* | O CR3 da F01 transferido pelo Camera Connect. |

O JPG do cartão é o original da câmera: comparado ao do tablet, mostra o que o caminho altera.

**Do tablet para o computador:** cabo USB (o tablet aparece no Explorador de Arquivos) ou Quick Share. Não use WhatsApp, Google Fotos nem anexo no chat do Claude: eles recomprimem a foto ou apagam metadados, e a amostra perde o valor.

## O que a conferência mostra

Para cada foto: qual código do roteiro ela é, os valores lidos (texto e número do ExifTool), o tamanho de cada versão e quantas tags se perderam entre o cartão e o tablet.

Os números dos campos Canon (método AF, estilo, NR, ponto de AF) vêm das próprias fotos. É isso que calibra o normalizador e os testes.

---

# Rodada 2: o equipamento e a sua mão

Pedido de 2026-10-12 (decisão 0011). A 1ª rodada calibrou a **leitura** dos metadados. Esta mede
o que o motor de diagnóstico da v0.5 precisa saber para orientar a partir de uma foto só:

- até onde subir o ISO compensa, em vez de arriscar tremido;
- o **seu** limite de tremido à mão, na 50 mm e na 75-300;
- a abertura mais nítida da RF 50;
- como fica uma foto com foco errado, para não confundir com tremido;
- quando o céu estoura.

São **~50 disparos**, em umas duas saídas: uma com tripé, na janela, e outra à mão livre. A
ordem dos blocos não importa. Dentro de cada bloco, fotografe tudo em poucos minutos, com o
mesmo assunto, para a luz não mudar.

**Como você usa cada lente, e por isso o roteiro é assim:** a **RF 50 só à mão livre**; a
**RF 75-300 no tripé** (assunto longe, da janela) **e à mão**.

## Configuração base da Rodada 2

A mesma da 1ª rodada (RAW + JPEG L, 3:2, AWB, One-Shot, AF de 1 ponto, avaliativa, sem flash,
redução de ruído Padrão), com uma diferença: **estilo de imagem no seu habitual (Auto)**. Aqui
se mede a foto como você realmente tira.

**ISO Auto com velocidade mínima** (blocos A e E): no menu *ISO speed settings* →
*Min. shutter spd.*, escolha **1/250**. Assim, na 50 mm à mão, a câmera sobe o ISO em vez de
baixar a velocidade, e o tremido não atrapalha a medida. Se não achar o ajuste, fotografe ao
ar livre, de dia, e confira no visor que a velocidade ficou em 1/250 ou mais rápida.
Volte o ajuste ao seu normal no fim.

## Bloco I: escada de ISO (tripé, RF 75-300)

Mede o ruído de verdade em cada ISO, na mesma cena. **Tripé, temporizador 2 s, 200 mm, modo
Av, f/11**, AF de 1 ponto sobre um alvo com detalhe fino. Deixe no quadro uma área lisa
(parede, céu sem nuvem, muro). **Melhor no fim da tarde ou em dia nublado:** no sol forte, os
ISOs altos passam do limite de 1/4000 e a foto estoura. Se a câmera piscar 4000 no visor, pare
a escada ali e avise.

| Código | Ajustes |
|---|---|
| I01 | ISO 100 |
| I02 | ISO 200 |
| I03 | ISO 400 |
| I04 | ISO 800 |
| I05 | ISO 1600 |
| I06 | ISO 3200 |
| I07 | ISO 6400 |
| I08 | ISO 12800 |
| I09 | ISO 25600 |

## Bloco M: a sua mão na RF 50

Mede a velocidade a partir da qual a sua mão para de tremer a 50 mm. **À mão livre, modo Tv,
ISO Auto** (sem a velocidade mínima: aqui a velocidade é o que se testa). Objeto parado com
detalhe fino (texto, tecido, folhas), a 1–3 m, **dentro de casa ou na sombra**. Segure do jeito
de sempre. **Duas fotos em cada velocidade**, porque o tremido varia de uma para outra.

| Código | Ajustes |
|---|---|
| M01, M02 | 1/15 |
| M03, M04 | 1/30 |
| M05, M06 | 1/60 |
| M07, M08 | 1/125 |
| M09, M10 | 1/250 |

## Bloco Z: a sua mão na RF 75-300

O mesmo, na tele. **À mão livre, modo Tv, ISO Auto**, algo distante com detalhe (placa,
telhado, antena), **de dia**. A 1ª rodada já tem 1/100 (F06), 1/640 (T07) e 1/1000 (F07) em
300 mm; aqui fecha a curva e confere se o limite muda na proporção da distância focal.

| Código | Focal | Ajustes |
|---|---|---|
| Z01, Z02 | 300 mm | 1/60 |
| Z03, Z04 | 300 mm | 1/125 |
| Z05, Z06 | 300 mm | 1/250 |
| Z07, Z08 | 300 mm | 1/500 |
| Z09, Z10 | 300 mm | 1/1000 |
| Z11 | **100 mm** | 1/30 |
| Z12 | **100 mm** | 1/60 |
| Z13 | **100 mm** | 1/125 |

## Bloco A: abertura da RF 50 (à mão)

Mede a abertura mais nítida da 50 mm e onde a difração começa (a 75-300 já foi medida na
T01–T04). **À mão livre, modo Av, ISO Auto com velocidade mínima 1/250**, de dia, ao ar livre.
Assunto **plano e com detalhe**, a 3–5 m, de frente: fachada, muro de tijolos, placa. Ponto de
AF no **centro**.

| Código | Ajustes |
|---|---|
| A01 | f/1.8 |
| A02 | f/2.8 |
| A03 | f/4 |
| A04 | f/5.6 |
| A05 | f/8 |
| A06 | f/11 |
| A07 | f/16 |

## Bloco D: foco errado de propósito

Ensina o site a separar "focou no lugar errado" de "tremeu". Escolha um objeto **perto**, com
um fundo **bem longe** atrás dele. As fotos vão em pares: uma com o ponto de AF no objeto e
outra com o ponto de AF no fundo, **sem mudar o enquadramento**.

| Código | Lente | Ajustes | Ponto de AF |
|---|---|---|---|
| D01 | RF 50 | Av f/1.8 · ISO Auto | no objeto, a ~1 m |
| D02 | RF 50 | igual à D01 | **no fundo** |
| D03 | RF 75-300 em 300 mm, à mão | Tv 1/1000 · ISO Auto | no objeto, a 3–5 m |
| D04 | RF 75-300 em 300 mm, à mão | igual à D03 | **no fundo** |

## Bloco E: céu e exposição (RF 50, à mão)

Mede quando o céu estoura e quando as sombras ficam pretas. Uma cena com **céu claro e chão ou
prédios mais escuros** no mesmo quadro, de dia. **Modo Av, f/8, ISO Auto com velocidade mínima
1/250**, mesmo enquadramento em todas. Muda só a compensação de exposição.

| Código | Compensação |
|---|---|
| E01 | −2 EV |
| E02 | −1 EV |
| E03 | 0 |
| E04 | +1 EV |
| E05 | +2 EV |

## Pendentes da 1ª rodada (série T, no tripé)

Faça junto com o bloco I, que já está no tripé: **T08 em 300 mm** (a da 1ª rodada saiu em 205 mm),
**T09** e, se você fotografa através de vidro, **T06**. Ajustes na tabela da série T acima.

## Entrega da Rodada 2

Só **do cartão, pelo leitor**: o CR3 e o JPG de todas as fotos, em
`EvolucaoFotografia\amostras\rodada2\cartao\`, sem renomear nem editar. Não precisa da versão do
tablet: a 1ª rodada mostrou que o Camera Connect com **Tam. original** não altera a foto.

**Ao terminar, volte a câmera à sua configuração normal** (velocidade mínima do ISO Auto,
compensação em 0).

## Para o Claude, ao receber a Rodada 2

1. Acrescentar os blocos I, M, Z, A, D e E em `tests/amostras/roteiro.mjs` (reconhecimento pelo
   EXIF; nos pares de mesma configuração, `quantidade: 2`) e fazer o `conferir.mjs` e o
   `metricas.mjs` aceitarem `amostras/rodada2/`.
2. Rodar os dois e registrar em `docs/CALIBRACAO-RESULTADOS.md`: curva de ruído por ISO, limite
   de tremido da mão a 50, 100 e 300 mm, nitidez por abertura da RF 50, nitidez no AF × no fundo
   (D01–D04) e histograma por compensação (E01–E05).
3. Esses números viram os limites do motor de diagnóstico da v0.5 (decisão 0011).
