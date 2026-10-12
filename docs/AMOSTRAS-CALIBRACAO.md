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
