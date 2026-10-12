// Roteiro das fotos reais de calibração (ver docs/AMOSTRAS-CALIBRACAO.md).
// Cada foto é reconhecida pelo EXIF (campo `id`), sem depender do nome do
// arquivo. `confere` lista o que a ficha deve mostrar quando o extrator ler
// corretamente: serve de gabarito para os testes com amostras reais.
//
// Convenções dos valores de `id` (números do EXIF padrão, iguais em JPEG e CR3):
//   programa: 1 = Manual (M), 2 = Programa (P), 3 = Av, 4 = Tv
//   tempo em segundos, abertura em f/, focal em mm, ev em passos.

export const BASE = {
  descricao: 'Configuração comum a todas as fotos, salvo indicação.',
  qualidade: 'RAW + JPEG L (grande, fina)',
  proporcao: '3:2',
  estiloImagem: 'Padrão',
  balancoBranco: 'AWB',
  reducaoRuidoIsoAlto: 'Padrão',
  modoAF: 'One-Shot',
  areaAF: 'AF de 1 ponto',
  medicao: 'Avaliativa',
  flash: 'desligado',
};

export const FOTOS = [
  {
    codigo: 'F01', titulo: 'Referência no tripé',
    id: { programa: 3, abertura: 5.6, iso: 100, focal: 50 },
    confere: {
      lente: 'RF50mm F1.8 STM', disparo: 'temporizador 2 s', modoAF: 'One-Shot',
      pontoAF: 'canto superior direito', jpegCamera: [6240, 4160],
    },
  },
  {
    codigo: 'F02', titulo: 'Mesma cena, f/1.8, ponto de AF em outro canto',
    id: { programa: 1, abertura: 1.8, iso: 100, focal: 50 },
    confere: { pontoAF: 'canto inferior esquerdo', jpegCamera: [6240, 4160] },
  },
  {
    codigo: 'F03', titulo: 'Rajada com rastreamento (3 fotos)', quantidade: 3,
    id: { programa: 4, tempo: 1 / 500, focal: 50 },
    confere: {
      disparo: 'contínuo', modoAF: 'Servo', areaAF: 'Rosto + Rastreamento',
      observacao: 'as 3 fotos podem cair no mesmo segundo: o identificador precisa dos subsegundos',
    },
  },
  {
    codigo: 'F04', titulo: 'Tremido proposital (1/8 à mão)',
    id: { programa: 4, tempo: 1 / 8, focal: 50 },
    confere: { riscoTremido: true },
  },
  {
    codigo: 'F05', titulo: 'Controle do tremido (1/200 à mão)',
    id: { programa: 4, tempo: 1 / 200, focal: 50 },
    confere: { riscoTremido: false },
  },
  {
    codigo: 'F06', titulo: 'Tele 300 mm com risco (1/100)',
    id: { programa: 4, tempo: 1 / 100, focal: 300 },
    confere: { lente: 'RF75-300mm F4-5.6', riscoTremido: true },
  },
  {
    codigo: 'F07', titulo: 'Tele 300 mm controle (1/1000)',
    id: { programa: 4, tempo: 1 / 1000, focal: 300 },
    confere: { lente: 'RF75-300mm F4-5.6', riscoTremido: false, pontoAF: 'centro' },
  },
  {
    codigo: 'F08', titulo: 'ISO 12800, redução de ruído Alta',
    id: { programa: 1, abertura: 1.8, iso: 12800 },
    confere: { reducaoRuidoIsoAlto: 'Alta' },
  },
  {
    codigo: 'F09', titulo: 'ISO 12800, redução de ruído Desativada (mesmo tempo da F08)',
    id: { programa: 1, abertura: 1.8, iso: 12800 },
    confere: { reducaoRuidoIsoAlto: 'Desativada' },
    // F08 e F09 têm o mesmo EXIF padrão: o desempate é a ordem de captura.
  },
  {
    codigo: 'F10', titulo: 'Programa, −1 EV, medição Pontual, estilo Paisagem',
    id: { programa: 2, ev: -1, iso: 200, focal: 50 },
    confere: { medicao: 'Pontual', estiloImagem: 'Paisagem' },
  },
  {
    codigo: 'F11', titulo: 'Proporção 16:9',
    id: { programa: 3, abertura: 8, iso: 400, focal: 50 },
    confere: { jpegCamera: [6240, 3504], proporcao: '16:9' },
  },
  {
    codigo: 'F12', titulo: 'Recorte 1,6x',
    id: { programa: 3, abertura: 4, focal: 50, larguraMax: 3888 },
    // Capturada com ISO 640 (ISO Auto), não 400: reconhecida pelo recorte.
    confere: { jpegCamera: [3888, 2592], recorte: '1,6x' },
  },
  {
    codigo: 'F13', titulo: 'Cena Inteligente Auto (A+), só JPEG M',
    id: { canonModo: 0, focal: 50 },
    // Capturada em RAW + JPEG L (a qualidade não foi trocada para JPEG M).
    confere: { modo: 'Cena Inteligente Auto (CanonExposureMode Easy)', jpegCamera: [6240, 4160] },
  },
  {
    codigo: 'F14', titulo: 'GPS pelo Camera Connect (opcional)', opcional: true,
    id: { programa: 3, abertura: 11, iso: 100, gps: true },
    confere: { gps: true },
  },

  // Série T: RF 75-300 no tripé, mesmo alvo distante pela janela. Isola o que
  // tira nitidez na tele: abertura, distância focal, vidro, apoio e disparo.
  {
    codigo: 'T01', titulo: 'Tele 300 mm, tripé, f/5.6 (abertura máxima)', serie: 'tele',
    id: { programa: 3, abertura: 5.6, iso: 100, focal: 300 },
    confere: { lente: 'RF75-300mm F4-5.6', disparo: 'temporizador 2 s' },
  },
  {
    codigo: 'T02', titulo: 'Tele 300 mm, tripé, f/8', serie: 'tele',
    id: { programa: 3, abertura: 8, iso: 100, focal: 300 },
    confere: { disparo: 'temporizador 2 s' },
  },
  {
    codigo: 'T03', titulo: 'Tele 300 mm, tripé, f/11', serie: 'tele',
    id: { programa: 3, abertura: 11, iso: 100, focal: 300 },
    confere: { disparo: 'temporizador 2 s' },
  },
  {
    codigo: 'T04', titulo: 'Tele 300 mm, tripé, f/16 (difração)', serie: 'tele',
    id: { programa: 3, abertura: 16, iso: 100, focal: 300 },
    confere: { disparo: 'temporizador 2 s' },
  },
  {
    codigo: 'T05', titulo: 'Tele 200 mm, tripé, f/8', serie: 'tele',
    id: { programa: 3, abertura: 8, iso: 100, focal: 200 },
    confere: { disparo: 'temporizador 2 s' },
  },
  {
    codigo: 'T06', titulo: 'Tele 300 mm, tripé, f/8, através do vidro fechado', serie: 'tele',
    id: { programa: 3, abertura: 8, iso: 200, focal: 300 },
    confere: { observacao: 'ISO 200 só para diferenciar da T02' },
  },
  {
    codigo: 'T07', titulo: 'Tele 300 mm à mão livre, 1/640', serie: 'tele',
    id: { programa: 4, tempo: 1 / 640, focal: 300 },
    confere: { riscoTremido: false },
  },
  {
    codigo: 'T08', titulo: 'Tele 300 mm, tripé, f/8, disparo com o dedo (sem temporizador)', serie: 'tele',
    id: { programa: 3, abertura: 8, iso: 400, lente: 'RF75-300' },
    // Capturada em 205 mm: o zoom ficou na posição da T05. Comparar com a T05, não com a T02.
    confere: { disparo: 'foto única', observacao: 'ISO 400 só para diferenciar da T02' },
  },
  {
    codigo: 'T09', titulo: 'Tele 300 mm, tripé, f/8, temporizador 10 s (vibração assentada)', serie: 'tele',
    id: { programa: 3, abertura: 8, iso: 800, focal: 300 },
    confere: { disparo: 'temporizador 10 s', observacao: 'ISO 800 só para diferenciar da T02' },
  },
];

// Pastas dentro de amostras/ (ignorada pelo git).
export const PASTAS = {
  cartao: 'copiadas do cartão pelo leitor (CR3 + JPG, nomes originais)',
  tablet: 'JPG do Camera Connect em "Tam. original" (o habitual dele; "Reduzido" nunca é usado)',
  'tablet-raw': 'CR3 transferido pelo Camera Connect (opcional, só F01)',
};
