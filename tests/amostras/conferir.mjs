// Confere as fotos reais de calibração em amostras/ contra o roteiro.
// Uso: node tests/amostras/conferir.mjs [pasta]   (padrão: amostras)
// Gera <pasta>/relatorio.md com: qual foto do roteiro cada arquivo é, o que o
// ExifTool leu (texto e número), tamanho de cada versão e o que se perdeu no
// caminho cartão → tablet. Lê com o mesmo ExifTool-WASM usado pelo site.

// O zeroperl monta mal o caminho do .wasm no Node para Windows; fingindo ser
// navegador, ele usa o fetch abaixo, que entrega o arquivo de site/vendor.
globalThis.window ??= globalThis;
globalThis.document ??= {};

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parseMetadata } from '@uswriting/exiftool';
import { FOTOS, PASTAS } from './roteiro.mjs';

const raiz = process.argv[2] ?? 'amostras';
const wasmPath = 'site/vendor/zeroperl.wasm';
if (!existsSync(wasmPath)) {
  console.error('Falta site/vendor/zeroperl.wasm: rode "npm run vendor" antes.');
  process.exit(1);
}
const wasm = readFileSync(wasmPath);
const fetchWasm = async () => new Response(wasm, { headers: { 'Content-Type': 'application/wasm' } });

// Campos mostrados no relatório (nome ExifTool sem grupo).
const CAMPOS = [
  'Model', 'SerialNumber', 'LensModel', 'DateTimeOriginal', 'SubSecTimeOriginal', 'OffsetTimeOriginal',
  'ExposureProgram', 'CanonExposureMode', 'ExposureTime', 'FNumber', 'ISO', 'FocalLength',
  'ExposureCompensation', 'MeteringMode', 'FocusMode', 'AFAreaMode', 'ContinuousDrive', 'SelfTimer',
  'AFImageWidth', 'AFImageHeight', 'AFAreaXPositions', 'AFAreaYPositions', 'AFAreaWidths', 'AFAreaHeights',
  'AFPointsInFocus', 'PictureStyle', 'HighISONoiseReduction', 'LongExposureNoiseReduction',
  'DigitalLensOptimizer', 'PeripheralIlluminationCorr', 'AutoLightingOptimizer', 'WhiteBalance',
  'Quality', 'CanonImageSize', 'AspectRatio', 'CropLeftMargin', 'CropTopMargin',
  'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight', 'Orientation',
  'GPSLatitude', 'GPSLongitude', 'Software', 'JFIFVersion',
];

async function ler(caminho) {
  const nome = caminho.split(/[\\/]/).pop();
  const file = new File([readFileSync(caminho)], nome);
  const r = await parseMetadata(file, { args: ['-json', '-l', '-G1', '-a'], fetch: fetchWasm, transform: JSON.parse });
  if (!r.success) throw new Error(`${nome}: ${r.error}`);
  const bruto = r.data[0];
  const plano = {};
  const grupos = new Set();
  for (const [chave, v] of Object.entries(bruto)) {
    const [grupo, tag] = chave.includes(':') ? chave.split(':') : ['', chave];
    if (grupo) grupos.add(grupo);
    if (!(tag in plano)) plano[tag] = v;
  }
  return { nome, bruto, plano, grupos, totalTags: Object.keys(bruto).length };
}

const num = (m, tag) => {
  const v = m.plano[tag];
  if (v == null) return undefined;
  const n = typeof v === 'object' ? (v.num ?? v.val) : v;
  return typeof n === 'string' && /^-?[\d.]+$/.test(n) ? Number(n) : n;
};
// Texto cru, sem conversão numérica: "08" em SubSecTimeOriginal são 80 ms, não 8.
const cru = (m, tag) => {
  const v = m.plano[tag];
  if (v == null) return undefined;
  return String(typeof v === 'object' ? (v.num ?? v.val) : v);
};
const txt = (m, tag) => {
  const v = m.plano[tag];
  if (v == null) return '—';
  if (typeof v !== 'object') return String(v);
  return v.num !== undefined && String(v.num) !== String(v.val) ? `${v.val} (${v.num})` : String(v.val);
};
const pertoStops = (a, b) => a > 0 && b > 0 && Math.abs(Math.log2(a / b)) < 0.25;
const perto = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

function bate(id, m, temRaw) {
  if (id.semRaw && temRaw) return false;
  if (id.larguraJpeg) {
    const w = num(m, 'ImageWidth'); const h = num(m, 'ImageHeight');
    if (Math.max(w, h) !== id.larguraJpeg) return false;
  }
  if (id.programa != null && num(m, 'ExposureProgram') !== id.programa) return false;
  if (id.tempo != null && !pertoStops(num(m, 'ExposureTime'), id.tempo)) return false;
  if (id.abertura != null && !perto(num(m, 'FNumber'), id.abertura, 0.15)) return false;
  if (id.iso != null && num(m, 'ISO') !== id.iso) return false;
  if (id.focal != null && !perto(num(m, 'FocalLength'), id.focal, id.focal * 0.03)) return false;
  if (id.ev != null && !perto(num(m, 'ExposureCompensation'), id.ev, 0.1)) return false;
  if (id.gps && num(m, 'GPSLatitude') == null) return false;
  if (id.lente && !String(num(m, 'LensModel') ?? '').includes(id.lente)) return false;
  if (id.canonModo != null && num(m, 'CanonExposureMode') !== id.canonModo) return false;
  if (id.larguraMin != null && Math.max(num(m, 'ImageWidth'), num(m, 'ImageHeight')) < id.larguraMin) return false;
  if (id.larguraMax != null && Math.max(num(m, 'ImageWidth'), num(m, 'ImageHeight')) > id.larguraMax) return false;
  return true;
}

// Chave da captura: data/hora + subsegundos + série. Liga o CR3, o JPG do
// cartão e o JPG do tablet da mesma foto. Sem subsegundos, cai no nome do arquivo.
const chaveCaptura = (m) => {
  const dt = num(m, 'DateTimeOriginal');
  if (!dt) return `arquivo:${m.nome.replace(/\.[^.]+$/, '').toUpperCase()}`;
  return [dt, cru(m, 'SubSecTimeOriginal') ?? '', cru(m, 'SerialNumber') ?? ''].join('|');
};

const capturas = new Map(); // chave → { versões: {pasta/ext: meta} }
const pastasLidas = [];
for (const pasta of Object.keys(PASTAS)) {
  const dir = join(raiz, pasta);
  if (!existsSync(dir)) continue;
  const arquivos = readdirSync(dir).filter((f) => /\.(cr3|jpe?g)$/i.test(f));
  pastasLidas.push(`${pasta} (${arquivos.length})`);
  for (const f of arquivos) {
    const caminho = join(dir, f);
    let m;
    try { m = await ler(caminho); } catch (e) { console.error(e.message); continue; }
    m.bytes = statSync(caminho).size;
    m.pasta = pasta;
    m.tipo = extname(f).slice(1).toUpperCase().replace('JPEG', 'JPG');
    let chave = chaveCaptura(m);
    // O tablet pode perder subsegundos/série ou o EXIF inteiro: tenta casar
    // pela data/hora e, se houver empate (rajada) ou nada, pelo nome do arquivo.
    if (!capturas.has(chave) && pasta.startsWith('tablet')) {
      const dt = num(m, 'DateTimeOriginal');
      const raiz = m.nome.replace(/\.[^.]+$/, '').toUpperCase();
      const mesmoNome = (k) => Object.values(capturas.get(k).versoes)
        .some((v) => v.nome.replace(/\.[^.]+$/, '').toUpperCase() === raiz);
      let candidatas = dt ? [...capturas.keys()].filter((k) => k.startsWith(`${dt}|`)) : [];
      if (candidatas.length !== 1) candidatas = (candidatas.length ? candidatas : [...capturas.keys()]).filter(mesmoNome);
      if (candidatas.length === 1) chave = candidatas[0];
    }
    if (!capturas.has(chave)) capturas.set(chave, { versoes: {} });
    capturas.get(chave).versoes[`${pasta}/${m.tipo}`] = m;
    process.stdout.write('.');
  }
}
console.log();
if (!capturas.size) {
  console.log(`Nenhuma foto em ${raiz}/. Pastas esperadas: ${Object.keys(PASTAS).join(', ')}.`);
  process.exit(0);
}

// Identifica cada captura pelo melhor arquivo de referência (cartão primeiro).
const ordemRef = ['cartao/JPG', 'cartao/CR3', 'tablet/JPG', 'tablet-raw/CR3'];
const lista = [...capturas.values()].map((c) => {
  c.ref = ordemRef.map((k) => c.versoes[k]).find(Boolean) ?? Object.values(c.versoes)[0];
  c.temRaw = Boolean(c.versoes['cartao/CR3'] || c.versoes['tablet-raw/CR3']);
  c.quando = `${num(c.ref, 'DateTimeOriginal') ?? ''}.${cru(c.ref, 'SubSecTimeOriginal') ?? ''}`;
  c.candidatas = FOTOS.filter((f) => bate(f.id, c.ref, c.temRaw)).map((f) => f.codigo);
  return c;
}).sort((a, b) => a.quando.localeCompare(b.quando));

// Desempate (F08/F09): candidatos idênticos recebem os códigos na ordem de captura.
const usados = new Map();
for (const c of lista) {
  const grupo = c.candidatas.join('+');
  if (c.candidatas.length > 1) {
    const i = usados.get(grupo) ?? 0;
    c.codigo = c.candidatas[Math.min(i, c.candidatas.length - 1)];
    usados.set(grupo, i + 1);
  } else c.codigo = c.candidatas[0] ?? '??';
}

// ----- Relatório ------------------------------------------------------------
const L = [];
const agora = new Date().toLocaleString('pt-BR');
L.push(`# Relatório das amostras de calibração`, '', `Gerado em ${agora}. Pastas lidas: ${pastasLidas.join(', ')}.`, '');

L.push('## Cobertura do roteiro', '', '| Código | Foto | Encontrada | Versões |', '|---|---|---|---|');
for (const f of FOTOS) {
  const achadas = lista.filter((c) => c.codigo === f.codigo);
  const esperado = f.quantidade ?? 1;
  const status = achadas.length === 0 ? (f.opcional ? 'não (opcional)' : '**faltando**')
    : achadas.length < esperado ? `${achadas.length} de ${esperado}` : 'sim';
  const versoes = [...new Set(achadas.flatMap((c) => Object.keys(c.versoes)))].join(', ');
  L.push(`| ${f.codigo} | ${f.titulo} | ${status} | ${versoes || '—'} |`);
}
const soltas = lista.filter((c) => c.codigo === '??');
if (soltas.length) {
  L.push('', `**Não reconhecidas (${soltas.length}):** ${soltas.map((c) => Object.values(c.versoes).map((m) => `${m.pasta}/${m.nome}`).join(' + ')).join('; ')}`);
}

for (const c of lista) {
  const f = FOTOS.find((x) => x.codigo === c.codigo);
  L.push('', `## ${c.codigo} — ${f?.titulo ?? 'não reconhecida'} (${c.quando})`, '');
  if (f) L.push(`Gabarito: ${Object.entries(f.confere).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join('×') : v}`).join('; ')}`, '');
  const chaves = Object.keys(c.versoes).sort((a, b) => ordemRef.indexOf(a) - ordemRef.indexOf(b));
  L.push(`| Campo | ${chaves.map((k) => `${k}<br>${c.versoes[k].nome}`).join(' | ')} |`, `|---|${chaves.map(() => '---').join('|')}|`);
  L.push(`| Bytes | ${chaves.map((k) => c.versoes[k].bytes.toLocaleString('pt-BR')).join(' | ')} |`);
  L.push(`| Total de tags | ${chaves.map((k) => c.versoes[k].totalTags).join(' | ')} |`);
  L.push(`| Grupos | ${chaves.map((k) => [...c.versoes[k].grupos].filter((g) => !/^(ExifTool|System|File)$/.test(g)).join(', ')).join(' | ')} |`);
  for (const campo of CAMPOS) {
    const vals = chaves.map((k) => txt(c.versoes[k], campo));
    if (vals.every((v) => v === '—')) continue;
    L.push(`| ${campo} | ${vals.join(' | ')} |`);
  }
  const ref = c.versoes['cartao/JPG'];
  for (const k of chaves.filter((x) => x.startsWith('tablet') && x.endsWith('JPG'))) {
    if (!ref) break;
    const perdidos = Object.keys(ref.bruto).filter((t) => !(t in c.versoes[k].bruto) && !/^(System|File|ExifTool|Composite):/.test(t));
    const grupos = [...new Set(perdidos.map((t) => t.split(':')[0]))];
    L.push('', `**${k} vs cartão/JPG:** ${perdidos.length} tags ausentes${grupos.length ? ` (grupos: ${grupos.join(', ')})` : ''}.`);
  }
}

const saida = join(raiz, 'relatorio.md');
writeFileSync(saida, L.join('\n') + '\n');
const faltando = FOTOS.filter((f) => !f.opcional && !lista.some((c) => c.codigo === f.codigo)).map((f) => f.codigo);
console.log(`${lista.length} capturas lidas. Relatório: ${saida}`);
console.log(faltando.length ? `Faltando: ${faltando.join(', ')}` : 'Todas as fotos obrigatórias do roteiro foram encontradas.');
