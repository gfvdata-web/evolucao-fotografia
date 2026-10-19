// Roteiro das fotos reais de calibração (ver docs/AMOSTRAS-CALIBRACAO.md).
// Cada foto é reconhecida pelo EXIF (campo `id`), sem depender do nome do
// arquivo. `confere` lista o que a ficha deve mostrar quando o extrator ler
// corretamente: serve de gabarito para os testes com amostras reais.
//
// Convenções dos valores de `id` (números do EXIF padrão, iguais em JPEG e CR3):
//   programa: 1 = Manual (M), 2 = Programa (P), 3 = Av, 4 = Tv
//   tempo em segundos, abertura em f/, focal em mm, ev em passos.

import { existsSync } from 'node:fs';

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
    id: { programa: 3, abertura: 8, iso: 400, focal: 300 },
    confere: { disparo: 'foto única', observacao: 'ISO 400 só para diferenciar da T02' },
  },
  {
    codigo: 'T08b', titulo: 'Tele 205 mm, tripé, f/8, disparo com o dedo e mão apoiada (comparar com T05)', serie: 'tele', opcional: true,
    id: { programa: 3, abertura: 8, iso: 400, focal: 205 },
    confere: { disparo: 'foto única', observacao: 'primeira T08: o zoom ficou na posição da T05' },
  },
  {
    codigo: 'T09', titulo: 'Tele 300 mm, tripé, f/8, temporizador 10 s (vibração assentada)', serie: 'tele',
    id: { programa: 3, abertura: 8, iso: 800, focal: 300 },
    confere: { disparo: 'temporizador 10 s', observacao: 'ISO 800 só para diferenciar da T02' },
  },
];

// ---------------------------------------------------------------------------
// Rodada 2 (docs/AMOSTRAS-CALIBRACAO.md, "Rodada 2"). Pasta amostras/rodada2/.
// Pares de mesma configuração são uma entrada com `quantidade: 2` (código "M01-M02").
// `focalTol` = tolerância relativa da focal (padrão 3 %).
// D usa f/2 e 1/800 e E usa f/7.1 para não repetir o EXIF de A01, Z09/Z10 e A05 (roteiro de
// 19/10/2026). Se ainda houver configurações idênticas, a ordem de captura decide e o relatório
// marca `ambigua`.

const ladder = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];
const tempoTxt = (t) => `1/${Math.round(1 / t)}`;
const fRound2 = [
  ...ladder.map((iso, i) => ({
    codigo: `I0${i + 1}`, titulo: `Escada de ISO ${iso}, tripé, 200 mm, f/11`, bloco: 'I',
    id: { programa: 3, abertura: 11, iso, focal: 200, focalTol: 0.08 },
    confere: { disparo: 'temporizador 2 s' },
  })),
  ...[[1, 15], [3, 30], [5, 60], [7, 125], [9, 250]].map(([n, d]) => ({
    codigo: `M0${n}-M${String(n + 1).padStart(2, '0')}`, quantidade: 2, bloco: 'M',
    titulo: `RF 50 à mão, 1/${d} (par)`,
    id: { programa: 4, tempo: 1 / d, focal: 50 },
    confere: { observacao: 'ISO Auto, objeto parado com detalhe fino' },
  })),
  ...[[1, 60], [3, 125], [5, 250], [7, 500], [9, 1000]].map(([n, d]) => ({
    codigo: `Z0${n}-Z${String(n + 1).padStart(2, '0')}`, quantidade: 2, bloco: 'Z',
    titulo: `RF 75-300 à mão, 300 mm, ${tempoTxt(1 / d)} (par)`,
    id: { programa: 4, tempo: 1 / d, focal: 300 },
    confere: { observacao: 'ISO Auto, distante com detalhe' },
  })),
  ...[[11, 100, 30], [12, 100, 60], [13, 100, 125]].map(([n, mm, d]) => ({
    codigo: `Z${n}`, titulo: `RF 75-300 à mão, ${mm} mm, 1/${d}`, bloco: 'Z',
    id: { programa: 4, tempo: 1 / d, focal: mm },
    confere: { observacao: 'ISO Auto' },
  })),
  ...[1.8, 2.8, 4, 5.6, 8, 11, 16].map((f, i) => ({
    codigo: `A0${i + 1}`, titulo: `RF 50 à mão, f/${f}`, bloco: 'A',
    id: { programa: 3, abertura: f, focal: 50, ev: 0 },
    confere: { pontoAF: 'centro' },
  })),
  { codigo: 'D01', titulo: 'Foco errado: RF 50 f/2, AF no objeto (~1 m)', bloco: 'D',
    id: { programa: 3, abertura: 2, focal: 50, ev: 0 }, confere: {} },
  { codigo: 'D02', titulo: 'Foco errado: RF 50 f/2, AF no fundo', bloco: 'D',
    id: { programa: 3, abertura: 2, focal: 50, ev: 0 }, confere: {} },
  { codigo: 'D03', titulo: 'Foco errado: 300 mm 1/800, AF no objeto (3–5 m)', bloco: 'D',
    id: { programa: 4, tempo: 1 / 800, focal: 300 }, confere: {} },
  { codigo: 'D04', titulo: 'Foco errado: 300 mm 1/800, AF no fundo', bloco: 'D',
    id: { programa: 4, tempo: 1 / 800, focal: 300 }, confere: {} },
  ...[-2, -1, 0, 1, 2].map((ev, i) => ({
    codigo: `E0${i + 1}`, titulo: `Céu e exposição, RF 50 f/7.1, compensação ${ev > 0 ? '+' : ''}${ev} EV`, bloco: 'E',
    ev_alvo: ev,
    id: { programa: 3, abertura: 7.1, focal: 50, ev },
    confere: {},
  })),
];
// Pendentes da 1ª rodada, feitos junto com o bloco I (mesmos ajustes da série T).
const pendentes = FOTOS.filter((f) => ['T06', 'T08', 'T09'].includes(f.codigo)).map((f) => ({ ...f, bloco: 'T' }));
export const FOTOS_R2 = [...fRound2, ...pendentes];

// Pastas dentro de amostras/ (ignorada pelo git).
export const PASTAS = {
  cartao: 'copiadas do cartão pelo leitor (CR3 + JPG, nomes originais)',
  tablet: 'JPG do Camera Connect em "Tam. original" (o habitual dele; "Reduzido" nunca é usado)',
  'tablet-raw': 'CR3 transferido pelo Camera Connect (opcional, só F01)',
};
export const PASTAS_R2 = {
  cartao: 'Rodada 2: CR3 + JPG do cartão, sem renomear',
  reais: 'Bloco R: fotos reais, sem gabarito; nota em notas.txt ou sufixo _n1.._n5 no nome',
};

/** Roteiro, pastas e rodada de uma raiz (amostras/ = rodada 1; amostras/rodada2/ = rodada 2). */
export function roteiroDe(raiz) {
  const r2 = /(^|[\/])rodada2[\/]?$/.test(String(raiz).replace(/[\/]+$/, '')) || /rodada2$/.test(String(raiz));
  return r2 ? { rodada: 2, fotos: FOTOS_R2, pastas: PASTAS_R2 } : { rodada: 1, fotos: FOTOS, pastas: PASTAS };
}

/** Bloco R: lê "NOME_DO_ARQUIVO nota" linha a linha (# comenta). Chave em maiúsculas, sem extensão. */
export function parseNotas(texto) {
  const mapa = new Map();
  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    const m = linha.replace(/#.*/, '').trim().match(/^(.+?)[\s;,=:]+([1-5])$/);
    if (m) mapa.set(m[1].trim().replace(/\.[^.\/]+$/, '').toUpperCase(), Number(m[2]));
  }
  return mapa;
}

/** Nota 1–5 do bloco R: notas.txt primeiro, depois o sufixo _n1.._n5 do nome; null se não houver. */
export function notaDe(nomeArquivo, mapa = new Map()) {
  const base = String(nomeArquivo).replace(/\.[^.\/]+$/, '').toUpperCase();
  if (mapa.has(base)) return mapa.get(base);
  const m = base.match(/_N([1-5])$/);
  return m ? Number(m[1]) : null;
}

/** Raiz das amostras: argumento, ou amostras/ (rodada 1) e, se só existir a rodada 2, amostras/rodada2/. */
export function raizDe(argumento) {
  if (argumento) return argumento;
  if (!existsSync('amostras/cartao') && existsSync('amostras/rodada2')) return 'amostras/rodada2';
  return 'amostras';
}
