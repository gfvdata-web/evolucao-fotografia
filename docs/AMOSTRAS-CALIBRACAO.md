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

Versão ilustrada para imprimir ou levar no tablet: [guia-fotos/Guia-rodada-2.pdf](guia-fotos/Guia-rodada-2.pdf).

Roteiro de bolso, para ler no tablet ao lado da câmera. Revisto em 19/10/2026. São **~50
disparos em três saídas**, mais as suas fotos reais. A ordem das saídas não importa. Dentro de um
bloco, fotografe tudo em poucos minutos e com o mesmo assunto, para a luz não mudar.

O que cada bloco ensina ao site:

| Bloco | O que mede |
|---|---|
| I | ruído em cada ISO: até onde subir o ISO compensa |
| M e Z | o **seu** limite de tremido à mão, a 50, 100 e 300 mm |
| A | a abertura mais nítida da RF 50 |
| D | foco errado, para não confundir com tremido |
| E | quando o céu estoura |
| **R** | **as suas fotos reais**: onde o site diz "Boa" e você vê mole |

## Antes de começar (checklist da câmera)

- [ ] **RAW + JPEG L**, proporção **3:2**, AWB, **One-Shot**, **AF de 1 ponto**, medição avaliativa, sem flash.
- [ ] Redução de ruído em **Padrão**, estilo de imagem no seu **habitual (Auto)**.
- [ ] Compensação de exposição em **0**, salvo no bloco E.
- [ ] Data e hora da câmera certas.
- [ ] Nas saídas 2 e 3, **ISO Auto**. Nos blocos A e E, ponha em *ISO speed settings → Min. shutter spd.* o valor **1/250**. Se não achar, fotografe de dia, ao ar livre, com a velocidade no visor em 1/250 ou mais rápida.

Os números da coluna "Ajustes" são **obrigatórios**: é por eles que o site reconhece cada foto.
O assunto é livre. Se um ajuste não for possível, use o mais próximo e me avise.

## Saída 1: tripé na janela (RF 75-300), ~12 fotos

Fim de tarde ou dia nublado (no sol forte, os ISOs altos passam de 1/4000).

**Bloco I, escada de ISO.** Modo **Av**, **f/11**, **200 mm**, temporizador **2 s**, AF sobre um
alvo com detalhe fino. Deixe no quadro uma área lisa (parede, céu sem nuvem). Se o visor piscar
4000, pare a escada ali e avise.

| I01 | I02 | I03 | I04 | I05 | I06 | I07 | I08 | I09 |
|---|---|---|---|---|---|---|---|---|
| ISO 100 | 200 | 400 | 800 | 1600 | 3200 | 6400 | 12800 | 25600 |

**Pendentes da 1ª rodada**, no mesmo tripé, **300 mm**, modo **Av**, **f/8**:

| Código | Ajustes | Como |
|---|---|---|
| T08 | ISO **400** | sem temporizador (*Single shooting*), disparando com o dedo |
| T09 | ISO **800** | temporizador de **10 s**, mãos fora |
| T06 | ISO **200** | **janela fechada**, através do vidro (só se você fotografa através de vidro) |

## Saída 2: à mão, de dia, ao ar livre, 29 fotos

**Bloco A, abertura da RF 50.** Modo **Av**, ISO Auto com mínimo 1/250. Assunto plano e com
detalhe (fachada, muro de tijolos, placa), a 3–5 m, de frente, ponto de AF no centro.

| A01 | A02 | A03 | A04 | A05 | A06 | A07 |
|---|---|---|---|---|---|---|
| f/1.8 | f/2.8 | f/4 | f/5.6 | f/8 | f/11 | f/16 |

**Bloco Z, a sua mão na RF 75-300.** Modo **Tv**, ISO Auto, algo distante com detalhe. **Duas
fotos em cada velocidade a 300 mm**, porque o tremido varia de uma para outra.

| Código | Focal | Velocidade |
|---|---|---|
| Z01, Z02 | 300 mm | 1/60 |
| Z03, Z04 | 300 mm | 1/125 |
| Z05, Z06 | 300 mm | 1/250 |
| Z07, Z08 | 300 mm | 1/500 |
| Z09, Z10 | 300 mm | 1/1000 |
| Z11 | **100 mm** | 1/30 |
| Z12 | **100 mm** | 1/60 |
| Z13 | **100 mm** | 1/125 |

**Bloco D, foco errado de propósito.** Um objeto **perto**, com um fundo **bem longe**. As fotos
vão em pares, **sem mudar o enquadramento**: uma com o ponto de AF no objeto e outra no fundo.

| Código | Lente | Ajustes | Ponto de AF |
|---|---|---|---|
| D01 | RF 50 | Av **f/2** · ISO Auto | no objeto, a ~1 m |
| D02 | RF 50 | igual à D01 | **no fundo** |
| D03 | RF 75-300 em 300 mm | Tv **1/800** · ISO Auto | no objeto, a 3–5 m |
| D04 | RF 75-300 em 300 mm | igual à D03 | **no fundo** |

(f/2 e 1/800 são de propósito: com f/1.8 e 1/1000, o site confundiria D com A01 e Z09.)

**Bloco E, céu e exposição.** RF 50, modo **Av**, **f/7.1**, ISO Auto com mínimo 1/250. Uma cena
com **céu claro e chão ou prédios mais escuros**, sempre o mesmo enquadramento. Muda só a
compensação.

| E01 | E02 | E03 | E04 | E05 |
|---|---|---|---|---|
| −2 EV | −1 EV | 0 | +1 EV | +2 EV |

## Saída 3: à mão, dentro de casa ou na sombra (RF 50), 10 fotos

**Bloco M, a sua mão na RF 50.** Modo **Tv**, ISO Auto **sem** a velocidade mínima (aqui a
velocidade é o que se testa). Objeto parado com detalhe fino (texto, tecido, folhas), a 1–3 m.
Segure do jeito de sempre. **Duas fotos em cada velocidade.**

| M01, M02 | M03, M04 | M05, M06 | M07, M08 | M09, M10 |
|---|---|---|---|---|
| 1/15 | 1/30 | 1/60 | 1/125 | 1/250 |

## Bloco R: as suas fotos reais (a qualquer hora)

São as fotos que ensinam o site a ver como você vê. Escolha, das suas saídas normais:

- **5 a 10 fotos que você acha moles**, inclusive a que o site chamou de "Boa";
- **5 a 10 fotos que você acha nítidas**.

Do jeito que saíram da câmera (de preferência CR3 + JPG do cartão), sem editar. Para cada uma,
dê uma nota de nitidez de **1 a 5**, como na tela Avaliar: escreva num arquivo `notas.txt`, uma
linha por foto (`IMG_1234 2`), ou ponha a nota no fim do nome (`IMG_1234_n2.JPG`).

## Entrega

| O quê | Onde |
|---|---|
| Saídas 1 a 3 (CR3 + JPG, sem renomear) | `EvolucaoFotografia\amostras\rodada2\cartao\` |
| Bloco R (fotos + `notas.txt`) | `EvolucaoFotografia\amostras\rodada2\reais\` |

A versão do tablet não é necessária: a 1ª rodada mostrou que o Camera Connect em **Tam.
original** não altera a foto. Se quiser, passe também o cartão pelo `importar.bat` e importe o
pacote no site: isso confere o importador com um cartão real, o último item da V1.

**Ao terminar, volte a câmera à sua configuração normal** (velocidade mínima do ISO Auto,
compensação em 0).

## Para o Claude, ao receber a Rodada 2

O código já está pronto (19/10/2026):

1. `node tests/amostras/conferir.mjs amostras/rodada2`: reconhece cada foto pelo EXIF (gabarito
   em `tests/amostras/roteiro.mjs`, `FOTOS_R2`) e gera `amostras/rodada2/relatorio.md`. Conferir
   fotos faltando, sobrando ou marcadas `ambigua`.
2. `node tests/amostras/metricas.mjs amostras/rodada2`: as métricas do site em cada foto
   (`amostras/rodada2/metricas.json`).
3. `node tests/amostras/calibrar.mjs amostras/rodada2`: escreve `proposta-limites.md` com a
   curva de ruído por ISO, o limite de tremido a 50, 100 e 300 mm, a abertura mais nítida da RF
   50, o AF × o fundo (D) e o estouro por compensação. Para o bloco R, o limiar de desfoque que
   separa as notas 4–5 das 1–2, comparado com cada valor atual de `LIMITS`.
4. Estudar as fotos R que o site chamou de "Boa" e você marcou mole (caso de 19/10/2026).
5. Mostrar a proposta ao Guilherme. Só com o OK dele os números vão para `LIMITS`
   (`core/diagnosis.js`) e `lens-profiles.js`, com resultado em `docs/CALIBRACAO-RESULTADOS.md`.
   Se a métrica de desfoque mudar, subir a versão das métricas e reprocessar (v2.0).
