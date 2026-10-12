// Mede as amostras reais com o próprio site: envia as fotos de amostras/cartao
// a um navegador (Chromium do Playwright), espera a análise da v0.2 terminar
// e grava o que o site calculou: recortes a 100%, nitidez, ruído, qualidade
// JPEG, risco de tremido. Assim a calibração usa a mesma implementação das
// métricas que roda no tablet (regra 6 do CLAUDE.md).
//
// Uso: node tests/amostras/metricas.mjs [pasta]   (padrão: amostras)
// Antes: npm run vendor e node tests/amostras/conferir.mjs (dá o código F/T de
// cada foto). Saída, só local: <pasta>/metricas.md, <pasta>/metricas.json e
// <pasta>/recortes/<código>-<versão>-<af|uniforme>.png.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = process.argv[2] ?? 'amostras';
const PORTA = 8791;
const cartao = join(raiz, 'cartao');
if (!existsSync(cartao)) { console.error(`Falta a pasta ${cartao}.`); process.exit(1); }
if (!existsSync('site/vendor/zeroperl.wasm')) { console.error('Rode "npm run vendor" antes.'); process.exit(1); }

// Código do roteiro de cada arquivo, a partir do relatório do conferidor.
const codigos = new Map();
const relatorio = join(raiz, 'relatorio.md');
if (existsSync(relatorio)) {
  let atual = null;
  for (const linha of readFileSync(relatorio, 'utf8').split('\n')) {
    const h = linha.match(/^## (\S+) — (.*) \(/);
    if (h) { atual = { codigo: h[1], titulo: h[2] }; continue; }
    if (atual && linha.startsWith('| Campo |')) {
      for (const m of linha.matchAll(/<br>(IMG_\d+)\./g)) codigos.set(m[1], atual);
      atual = null;
    }
  }
} else console.warn('Sem relatorio.md: rode o conferidor antes para ter os códigos F/T.');

const arquivos = readdirSync(cartao).filter((f) => /\.(cr3|jpe?g)$/i.test(f)).sort();
// Em pares (JPG + CR3 do mesmo disparo) para não carregar tudo de uma vez.
const grupos = new Map();
for (const f of arquivos) {
  const base = f.replace(/\.[^.]+$/, '').toUpperCase();
  grupos.set(base, [...(grupos.get(base) || []), resolve(cartao, f)]);
}

const servidor = spawn(process.execPath, ['scripts/serve.mjs', String(PORTA)], { stdio: 'ignore' });
const fim = () => servidor.kill();
process.on('exit', fim);

const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 1400, height: 876 }, locale: 'pt-BR' });
  pagina.on('pageerror', (e) => console.error('erro na página:', e.message));
  for (let i = 0; i < 50; i++) {
    try { await pagina.goto(`http://localhost:${PORTA}/#/enviar`); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }

  let n = 0;
  for (const [base, caminhos] of grupos) {
    await pagina.getByTestId('input-files').setInputFiles(caminhos);
    await pagina.waitForFunction(() => !document.querySelector('[data-testid="queue-summary"]')?.textContent.includes('andamento'), null, { timeout: 180_000 });
    await esperarAnalise(pagina);
    process.stdout.write(`\r${++n}/${grupos.size} ${base}   `);
  }
  console.log();

  const fotos = await pagina.evaluate(lerBanco);
  const pastaRecortes = join(raiz, 'recortes');
  mkdirSync(pastaRecortes, { recursive: true });
  const linhas = [];
  for (const foto of fotos) {
    const nome = foto.variants.map((v) => v.file?.name).find(Boolean)?.replace(/\.[^.]+$/, '').toUpperCase();
    const ref = codigos.get(nome) || { codigo: '??', titulo: '' };
    for (const [chave, dataUrl] of Object.entries(foto.recortes)) {
      const [variante, qual] = chave.split('/');
      writeFileSync(join(pastaRecortes, `${ref.codigo}-${nome}-${variante}-${qual === 'af' ? 'af' : 'uniforme'}.png`),
        Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    linhas.push(resumo(foto, ref, nome));
  }
  linhas.sort((a, b) => a.quando.localeCompare(b.quando));
  writeFileSync(join(raiz, 'metricas.json'), JSON.stringify(linhas, null, 2));
  writeFileSync(join(raiz, 'metricas.md'), markdown(linhas));
  console.log(`${linhas.length} fotos medidas. Relatório: ${join(raiz, 'metricas.md')}; recortes em ${pastaRecortes}`);
} finally {
  await navegador.close();
  fim();
}

async function esperarAnalise(pagina) {
  await pagina.waitForFunction(async () => {
    const db = await new Promise((ok, erro) => { const r = indexedDB.open('evolucao-fotografia'); r.onsuccess = () => ok(r.result); r.onerror = erro; });
    const fotos = await new Promise((ok) => { const r = db.transaction('photos').objectStore('photos').getAll(); r.onsuccess = () => ok(r.result); });
    db.close();
    return fotos.length && fotos.every((f) => f.variants.every((v) => v.metadata_status !== 'pending' && v.metadata_status !== 'quick')
      && f.variants.every((v) => !v.pixels || v.analysis));
  }, null, { timeout: 300_000, polling: 1000 });
}

// Roda no navegador: fotos + recortes (PNG em data URL).
async function lerBanco() {
  const db = await new Promise((ok, erro) => { const r = indexedDB.open('evolucao-fotografia'); r.onsuccess = () => ok(r.result); r.onerror = erro; });
  const pegar = (loja, chave) => new Promise((ok) => { const r = db.transaction(loja).objectStore(loja).get(chave); r.onsuccess = () => ok(r.result); });
  const fotos = await new Promise((ok) => { const r = db.transaction('photos').objectStore('photos').getAll(); r.onsuccess = () => ok(r.result); });
  const { diagnosePhoto } = await import('/js/core/diagnosis.js');
  const comoDataUrl = (blob) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
  for (const f of fotos) {
    f.diagnostico = diagnosePhoto(f);
    f.recortes = {};
    for (const v of f.variants) {
      for (const qual of ['af', 'uniform']) {
        const blob = await pegar('blobs', `${f.id}/crop/${v.key}/${qual}`);
        if (blob) f.recortes[`${v.key}/${qual}`] = await comoDataUrl(blob);
      }
    }
  }
  db.close();
  return fotos;
}

function resumo(foto, ref, nome) {
  const c = foto.capture;
  const ind = foto.indicators;
  const versoes = foto.variants.map((v) => ({
    chave: v.key,
    pixels: v.pixels ? `${v.pixels.width}×${v.pixels.height}` : null,
    nitidez: v.analysis?.af?.laplacian_var ?? null,
    ruido: v.analysis?.uniform?.sigma ?? null,
    brilho_uniforme: v.analysis?.uniform?.mean_luma ?? null,
    qualidade_jpeg: v.analysis?.jpeg?.quality_estimate ?? null,
    amostragem: v.analysis?.jpeg?.sampling ?? null,
    erro: v.analysis?.error ?? null,
  }));
  return {
    codigo: ref.codigo, titulo: ref.titulo, arquivo: nome, quando: c.datetime_original,
    modo: c.exposure.program, tempo_s: c.exposure.shutter_s, abertura: c.exposure.aperture, iso: c.exposure.iso,
    focal_mm: c.lens.focal_length_mm, lente: c.lens.model, af: c.focus.af_area_mode,
    areas_af: c.focus.af_point?.areas?.length ?? null, em_foco: c.focus.af_point?.in_focus?.length ?? null,
    recorte_foco: foto.crops?.af?.source, recorte_uniforme: foto.crops?.uniform?.source,
    resolucao: ind.resolution.status, tremido: ind.shake.status, tremido_razao: ind.shake.ratio ?? null,
    nitidez: ind.sharpness.value ?? null, ruido: ind.noise.value ?? null, brilho_uniforme: ind.noise.mean_luma ?? null,
    cadeia: ind.chain?.status ?? null, cadeia_achados: ind.chain?.steps.flatMap((s) => s.findings.map((x) => x.text)) ?? [],
    versoes,
    // v0.5.0: desfoque (Crété-Roffet), trechos a 100%, histograma e diagnóstico.
    ...diagnosticoResumo(foto),
  };
}

function diagnosticoResumo(foto) {
  const a = foto.variants.find((v) => v.key === foto.indicators?.primary_variant)?.analysis;
  const d = foto.diagnostico;
  return {
    desfoque_foco: a?.af?.blur?.blur ?? null,
    detalhe_foco: a?.af?.blur?.detail ?? null,
    trechos: (a?.whole?.tiles || []).map((t) => ({ col: t.col, row: t.row, desfoque: t.blur?.blur ?? null, detalhe: t.blur?.detail ?? null })),
    estouro: a?.whole?.histogram?.clip_high ?? null,
    pretos: a?.whole?.histogram?.clip_low ?? null,
    brilho_mediano: a?.whole?.histogram?.p50 ?? null,
    luz_ev: d.light.ev, luz_fonte: d.light.source,
    veredito: d.verdict, manchete: d.headline,
    achados: d.findings.map((f) => `${f.key}:${f.severity}/${f.certainty}`),
    mao: d.possible ? `${tempoTxt(d.possible.hand.shutter)} f/${d.possible.hand.aperture} ISO ${d.possible.hand.iso}` : null,
  };
}

function tempoTxt(t) { return t == null ? '—' : t >= 1 ? `${t} s` : `1/${Math.round(1 / t)}`; }

function markdown(linhas) {
  const f1 = (x, d = 1) => (x == null ? '—' : x.toFixed(d).replace('.', ','));
  const tempo = (t) => (t == null ? '—' : t >= 1 ? `${t} s` : `1/${Math.round(1 / t)}`);
  const L = ['# Métricas das amostras reais (calculadas pelo site)', '',
    `Gerado em ${new Date().toLocaleString('pt-BR')} por \`tests/amostras/metricas.mjs\`. Valores da versão de maior resolução de cada foto.`, '',
    '| Código | Arquivo | Modo | Tempo | f/ | ISO | mm | AF (áreas/em foco) | Recorte | Tremido (razão) | Nitidez | Ruído (brilho) | JPEG cartão | JPEG do CR3 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const l of linhas) {
    const jpg = l.versoes.find((v) => v.chave.startsWith('jpeg'));
    const cr3 = l.versoes.find((v) => v.chave.startsWith('cr3'));
    L.push(`| ${l.codigo} | ${l.arquivo} | ${l.modo} | ${tempo(l.tempo_s)} | ${l.abertura} | ${l.iso} | ${l.focal_mm} | ${l.af} (${l.areas_af}/${l.em_foco}) | ${l.recorte_foco} | ${l.tremido} (${f1(l.tremido_razao, 2)}) | ${f1(l.nitidez, 0)} | ${f1(l.ruido, 2)} (${f1(l.brilho_uniforme, 0)}) | ${jpg ? `q${jpg.qualidade_jpeg} ${jpg.amostragem} nit. ${f1(jpg.nitidez, 0)}` : '—'} | ${cr3 ? `${cr3.pixels} q${cr3.qualidade_jpeg} nit. ${f1(cr3.nitidez, 0)}` : '—'} |`);
  }
  L.push('', '## Diagnóstico (v0.5.0)', '',
    'Desfoque de Crété-Roffet (0 = nítido; 1 = sem detalhe). Trechos: os 12 trechos a 100% (menor e maior desfoque, só os com detalhe).', '',
    '| Código | Tempo | f/ | ISO | mm | Desfoque foco (detalhe) | Trechos min–máx | Estouro | Pretos | Luz EV | Veredito | Manchete | Achados | À mão |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const l of linhas) {
    const tr = l.trechos.filter((t) => t.detalhe >= 1.2 && t.desfoque != null).map((t) => t.desfoque);
    L.push(`| ${l.codigo} | ${tempo(l.tempo_s)} | ${l.abertura} | ${l.iso} | ${l.focal_mm} | ${f1(l.desfoque_foco, 2)} (${f1(l.detalhe_foco, 2)}) | `
      + `${tr.length ? `${f1(Math.min(...tr), 2)}–${f1(Math.max(...tr), 2)}` : '—'} | ${l.estouro == null ? '—' : `${f1(l.estouro * 100, 1)}%`} | `
      + `${l.pretos == null ? '—' : `${f1(l.pretos * 100, 1)}%`} | ${f1(l.luz_ev, 1)} | ${l.veredito} | ${l.manchete} | ${l.achados.join(', ')} | ${l.mao ?? '—'} |`);
  }
  const achados = linhas.filter((l) => l.cadeia_achados.length);
  L.push('', '## Comparação entre versões (JPG do cartão × JPEG embutido no CR3)', '');
  if (!achados.length) L.push('Nenhuma perda apontada.');
  for (const l of achados) L.push(`- **${l.codigo} ${l.arquivo}** (${l.cadeia}): ${l.cadeia_achados.join(' ')}`);
  return L.join('\n') + '\n';
}
