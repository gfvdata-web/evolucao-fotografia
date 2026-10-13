// Calibração da etapa sensor (v0.6): importa no site o pacote das amostras
// (tests/amostras/pacote-amostras.py) e grava, por foto, o que o site mediu no
// RAW sem processamento × JPEG da câmera, nos mesmos recortes a 100%. Usa a
// implementação do site (regra 6). Saída local: <pasta>/sensor.md e sensor.json.
//
// Uso: node tests/amostras/sensor.mjs [pasta]   (padrão: amostras)
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const raiz = process.argv[2] ?? 'amostras';
const PORTA = 8794;
const pacotes = join(raiz, 'pacote');
if (!existsSync(pacotes)) { console.error(`Falta ${pacotes}: rode tests/amostras/pacote-amostras.py antes.`); process.exit(1); }
const pasta = resolve(pacotes, readdirSync(pacotes).find((d) => d.endsWith('.efsessao')));

const servidor = spawn(process.execPath, ['scripts/serve.mjs', String(PORTA)], { stdio: 'ignore' });
process.on('exit', () => servidor.kill());
const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 1400, height: 876 }, locale: 'pt-BR' });
  pagina.on('pageerror', (e) => console.error('erro na página:', e.message));
  for (let i = 0; i < 50; i++) {
    try { await pagina.goto(`http://localhost:${PORTA}/#/enviar`); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  const inicio = Date.now();
  await pagina.getByTestId('input-package').setInputFiles(pasta);
  const progresso = setInterval(async () => {
    const t = await pagina.getByTestId('queue-summary').textContent().catch(() => '?');
    console.log(`${Math.round((Date.now() - inicio) / 1000)} s: ${t}`);
  }, 15_000);
  await pagina.waitForFunction(() => /prontas/.test(document.querySelector('[data-testid="queue-summary"]')?.textContent || '')
    && !document.querySelector('[data-testid="queue-summary"]').textContent.includes('andamento'), null, { timeout: 30 * 60_000, polling: 2000 });
  clearInterval(progresso);
  console.log(`importado e medido em ${Math.round((Date.now() - inicio) / 1000)} s`);
  const fotos = await pagina.evaluate(() => new Promise((ok) => {
    const req = indexedDB.open('evolucao-fotografia');
    req.onsuccess = () => {
      const all = req.result.transaction('photos').objectStore('photos').getAll();
      all.onsuccess = () => ok(all.result);
    };
  }));
  const linhas = [];
  for (const f of fotos) {
    const n = f.variants.find((v) => v.kind === 'raw_neutral');
    const p = f.variants.find((v) => v.key === f.indicators?.primary_variant);
    if (!n?.analysis?.af || !p?.analysis?.af) continue;
    const passo = f.indicators.chain?.steps?.find((s) => s.sensor);
    linhas.push({
      arquivo: p.file.name, iso: f.capture.exposure.iso, nr: f.capture.noise_reduction.high_iso, estilo: f.capture.picture_style,
      pixels: `${p.pixels.width}×${p.pixels.height}`,
      nitidez_raw: n.analysis.af.laplacian_var, nitidez_jpeg: p.analysis.af.laplacian_var,
      ruido_raw: n.analysis.uniform?.sigma ?? null, ruido_jpeg: p.analysis.uniform?.sigma ?? null,
      brilho_foco: [n.analysis.af.mean_luma, p.analysis.af.mean_luma],
      brilho_uniforme: [n.analysis.uniform?.mean_luma ?? null, p.analysis.uniform?.mean_luma ?? null],
      achados: passo?.findings.map((x) => x.kind) ?? [],
    });
  }
  linhas.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
  writeFileSync(join(raiz, 'sensor.json'), JSON.stringify(linhas, null, 2));
  const r = (x, d = 0) => (x == null ? '—' : x.toFixed(d));
  const pct = (a, b) => (a && b != null ? `${b / a >= 1 ? '+' : ''}${Math.round((b / a - 1) * 100)}%` : '—');
  const md = ['| Arquivo | ISO | NR | Estilo | Nitidez RAW → JPEG | Ruído RAW → JPEG | Brilho foco | Achados |', '|---|---|---|---|---|---|---|---|',
    ...linhas.map((l) => `| ${l.arquivo} | ${l.iso} | ${l.nr} | ${l.estilo} | ${r(l.nitidez_raw)} → ${r(l.nitidez_jpeg)} (${pct(l.nitidez_raw, l.nitidez_jpeg)}) `
      + `| ${r(l.ruido_raw, 2)} → ${r(l.ruido_jpeg, 2)} (${pct(l.ruido_raw, l.ruido_jpeg)}) | ${r(l.brilho_foco[0])} / ${r(l.brilho_foco[1])} | ${l.achados.join(', ') || '—'} |`)];
  writeFileSync(join(raiz, 'sensor.md'), `${md.join('\n')}\n`);
  console.log(md.join('\n'));
} finally {
  await navegador.close();
}
