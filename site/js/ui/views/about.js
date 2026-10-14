// "Sobre" screen: version, device diagnostics and local data controls.
// Useful to check, on the tablet, what the browser supports and how much
// space the app is using.
import { h, mount } from '../dom.js';
import { APP_VERSION } from '../../version.js';
import { exifToolStatus, onExifToolStatus } from '../../metadata/exiftool-client.js';
import { formatBytes } from '../../core/format.js';
import { clearAll } from '../../storage/idb.js';
import { listPhotos } from '../../storage/photos-repo.js';
import { analyzeAllStale } from '../../pipeline/analyze.js';
import { METRICS_VERSION, needsAnalysis } from '../../core/indicators.js';
import { loadPerf } from '../../pipeline/perf.js';
import { perfRows } from '../../core/perf.js';
import { compatRows, compatSummary, compatReport, browserLabel } from '../../core/compat.js';
import { probeCompat } from '../../pipeline/compat-probe.js';

const EXIFTOOL_STATE = {
  idle: 'ainda não usado nesta visita',
  loading: 'carregando (primeira vez: ~7 MB)',
  busy: 'lendo',
  ready: 'pronto',
  error: 'com erro',
};

const row = (label, value, testId) => h('div', { class: 'setting-row' },
  h('dt', {}, label), h('dd', { 'data-testid': testId }, h('span', { class: 'value' }, value ?? '—')));

async function diagnostics() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => null);
  let versions = {};
  try { versions = await (await fetch(new URL('../../../vendor/versions.json', import.meta.url))).json(); } catch { /* offline */ }
  const photos = await listPhotos();
  return { est, persisted, versions, photoCount: photos.length, stale: photos.filter(needsAnalysis).length, perf: await loadPerf() };
}

function compatCard() {
  const result = h('div', { 'aria-live': 'polite', 'data-testid': 'compat-result' });
  const run = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    mount(result, h('p', { class: 'muted' }, 'Conferindo…'));
    const results = await probeCompat();
    const summary = compatSummary(results);
    mount(result,
      h('p', { class: 'value', 'data-testid': 'compat-summary' }, `${summary.text} (${summary.ok} ok, ${summary.fail} falha(s), ${summary.unknown} sem resposta)`),
      h('p', { class: 'small', 'data-testid': 'compat-browser' }, `Navegador: ${browserLabel(navigator.userAgent)}`),
      h('ul', { class: 'compat-list' }, compatRows(results).map((r) => h('li', { class: `compat-row compat-${r.state}`, 'data-testid': `compat-${r.id}`, 'data-state': r.state },
        h('span', { class: 'compat-state' }, r.label),
        ' ',
        h('strong', {}, r.name),
        h('span', { class: 'small muted' }, ` ${r.purpose}`),
        r.advice ? h('span', { class: 'small compat-advice' }, ` ${r.advice}`) : null))),
      h('p', { class: 'small muted' }, 'Copie ou fotografe esta lista e mande ao Claude.'),
      h('button', {
        class: 'btn btn-small', type: 'button', 'data-testid': 'compat-copy',
        onclick: async (ev) => {
          const b = ev.currentTarget;
          try { await navigator.clipboard.writeText(compatReport(results, navigator.userAgent)); b.textContent = 'Copiado'; } catch { b.textContent = 'Não consegui copiar: fotografe a lista'; }
        },
      }, 'Copiar a lista'));
    btn.disabled = false;
    btn.textContent = 'Conferir de novo';
  };
  return h('section', { class: 'card', 'data-testid': 'compat-card' },
    h('h3', {}, 'Compatibilidade do navegador'),
    h('p', { class: 'small' }, 'Testa, neste navegador, cada recurso que o app usa. Toque no Chrome e no Samsung Internet do tablet.'),
    h('button', { class: 'btn', type: 'button', 'data-testid': 'compat-run', onclick: run }, 'Conferir compatibilidade'),
    result);
}

export function aboutView(root) {
  const exifEl = h('span', { class: 'value', 'data-testid': 'exiftool-status' });
  const paintExif = (s) => mount(exifEl, `${EXIFTOOL_STATE[s.state] || s.state}`,
    s.lastMs ? ` · última leitura ${s.lastMs} ms` : '', s.error ? ` · ${s.error}` : '');
  paintExif(exifToolStatus);
  const off = onExifToolStatus(paintExif);

  const body = h('dl', { class: 'settings' }, h('p', { class: 'muted' }, 'Carregando…'));
  diagnostics().then(({ est, persisted, versions, photoCount, stale, perf }) => {
    const portrait = matchMedia('(orientation: portrait)').matches;
    mount(body,
      row('Versão do app', APP_VERSION, 'app-version'),
      h('div', { class: 'setting-row', 'data-testid': 'device-perf' },
        h('dt', {}, 'Desempenho deste aparelho'),
        h('dd', {}, perfRows(perf).map((r) => h('div', { class: 'value', 'data-testid': `perf-${r.kind}` }, `${r.label}: ${r.text}`)))),
      row('Leitores de metadados', Object.entries(versions).map(([k, v]) => `${k} ${v}`).join(' · ') || 'indisponível'),
      h('div', { class: 'setting-row' }, h('dt', {}, 'Leitor completo (ExifTool)'), h('dd', {}, exifEl)),
      row('Fotos neste aparelho', String(photoCount), 'photo-count'),
      row('Versão das métricas', `${METRICS_VERSION}${stale ? ` · ${stale} foto(s) a recalcular` : ' · todas atualizadas'}`, 'metrics-version'),
      row('Espaço usado pelo app', est ? `${formatBytes(est.usage)} de ${formatBytes(est.quota)} disponíveis` : 'indisponível'),
      row('Armazenamento protegido', persisted === null ? 'indisponível' : persisted ? 'sim' : 'não (o navegador pode limpar se faltar espaço)'),
      row('Tela', `${innerWidth} × ${innerHeight} px · densidade ${devicePixelRatio} · ${portrait ? 'retrato' : 'paisagem'}`, 'viewport'),
      row('Toque', navigator.maxTouchPoints > 0 ? `sim (${navigator.maxTouchPoints} pontos)` : 'não'),
      row('Navegador', navigator.userAgent));
  });

  mount(root,
    h('section', { class: 'card' }, h('h2', {}, 'Sobre este app'),
      h('p', {}, 'Evolução Fotografia analisa a qualidade da captura das suas fotos antes da edição. ',
        'As fotos ficam neste aparelho e, com o Google Drive conectado (aba Drive), também numa pasta sua no Drive.'),
      body),
    compatCard(),
    h('section', { class: 'card', 'data-testid': 'about-raw' },
      h('h3', {}, 'JPEG, CR3 e o RAW sem processamento'),
      h('p', { class: 'small' }, 'O JPEG L que chega pelo Camera Connect basta para o diagnóstico: é a foto que você usa. ',
        'Mas ele já vem processado pela câmera: redução de ruído, realce de nitidez do estilo de imagem (Picture Style) e ',
        'correções da lente (Digital Lens Optimizer).'),
      h('p', { class: 'small' }, 'O CR3 guarda o que o sensor captou. O importador, no computador, revela o CR3 sem nada disso e o site ',
        'compara as duas versões nos mesmos recortes a 100%: a ficha mostra quanto ruído a câmera tirou, quanta nitidez acrescentou ',
        'e se apagou detalhe. Serve para decidir, por exemplo, se vale mudar a redução de ruído ou a nitidez na câmera.'),
      h('p', { class: 'small muted' }, 'Para usar: fotografe em RAW + JPEG, passe o cartão pelo importador no computador e, no site aberto no ',
        'computador, use Enviar → Importar pacote do PC. Passo a passo no guia de uso.')),
    h('section', { class: 'card' },
      h('h3', {}, 'Recalcular indicadores'),
      h('p', { class: 'small' }, 'Quando as métricas mudam (por exemplo, depois da calibração), as fotos são recalculadas ao abrir a ficha. ',
        'Este botão recalcula todas de uma vez, a partir dos originais guardados neste aparelho.'),
      h('button', {
        class: 'btn', type: 'button', 'data-testid': 'recalc-all',
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Recalculando…';
          const n = await analyzeAllStale();
          btn.textContent = n ? `${n} foto(s) recalculada(s)` : 'Nada a recalcular';
        },
      }, 'Recalcular desatualizadas'),
      h('p', { class: 'small muted' }, 'Fotos cujo original está só no Drive, com progresso e a lista do que não deu para refazer: ',
        h('a', { href: '#/reprocessar', 'data-testid': 'about-reprocess' }, 'Reprocessar'), '.')),
    h('section', { class: 'card danger-zone' },
      h('h3', {}, 'Dados locais'),
      h('p', { class: 'small' }, 'Apaga todas as fotos e dados guardados pelo app neste navegador. Não afeta as fotos do cartão nem da galeria.'),
      h('button', {
        class: 'btn btn-danger', type: 'button', 'data-testid': 'clear-all',
        onclick: async () => {
          if (!confirm('Apagar todas as fotos e dados do app neste aparelho?')) return;
          await clearAll();
          location.reload();
        },
      }, 'Apagar dados locais')));
  return off;
}
