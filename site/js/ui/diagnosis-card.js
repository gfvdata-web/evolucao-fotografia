// "Diagnóstico" card of the photo sheet: verdict, what happened, what to do
// next time and, for each finding, why (numbers, source, certainty). Built
// from core/diagnosis.js; nothing here decides anything.
import { h } from './dom.js';
import { CERTAINTY_LABELS, SOURCE_LABELS, comboText } from '../core/diagnosis.js';
import { apertureAtLeast } from '../core/exposure.js';
import { formatAperture, formatIso, formatShutter } from '../core/format.js';

const SEVERITY_CHIP = { alert: 'alert', attention: 'attention', info: 'info' };
const VERDICT_STATUS = { good: 'ok', usable: 'attention', problem: 'alert', unknown: 'unknown' };

/** `asHeadline`: the card's headline already shows this title, so only the chip stays. */
function findingItem(f, asHeadline = false) {
  return h('li', { class: `diag-finding sev-${f.severity}`, 'data-testid': 'diag-finding', 'data-key': f.key },
    h('div', { class: 'diag-finding-head' },
      h('span', { class: `chip st-${SEVERITY_CHIP[f.severity]}` }, f.severity === 'alert' ? 'problema' : f.severity === 'attention' ? 'atenção' : 'nota'),
      asHeadline ? null : h('strong', {}, f.title)),
    h('p', { class: 'diag-text' }, f.text),
    f.advice ? h('p', { class: 'diag-advice', 'data-testid': 'diag-advice' }, h('strong', {}, 'Na próxima: '), f.advice) : null,
    h('details', { class: 'diag-why' },
      h('summary', {}, `Por quê · certeza ${CERTAINTY_LABELS[f.certainty]}`),
      f.evidence.length ? h('ul', { class: 'small' }, f.evidence.filter(Boolean).map((x) => h('li', {}, x))) : null,
      f.rule_note ? h('p', { class: 'small muted' }, f.rule_note) : null,
      h('p', { class: 'small', 'data-testid': 'diag-sources' }, 'De onde vem: ', f.sources.map((s) => SOURCE_LABELS[s] || s).join(' · '), '.')));
}

function possibleBlock(p) {
  if (!p) return null;
  const actual = p.actual.shutter && p.actual.aperture && p.actual.iso
    ? `${formatShutter(p.actual.shutter)} · ${formatAperture(p.actual.aperture)} · ${formatIso(p.actual.iso)}` : 'não lido';
  const rows = [
    ['Você usou', actual, null],
    ['À mão, sem tremido', comboText(p.hand),
      p.hand.over_iso_limit ? 'ISO acima do aceitável: pouca luz para a mão' : p.moving ? 'velocidade para assunto em movimento' : 'velocidade com folga de 2× sobre a referência'],
    p.tripod ? ['Com apoio ou tripé (assunto parado)', comboText(p.tripod), 'menor ISO, menos grão'] : null,
  ].filter(Boolean);
  return h('div', { class: 'diag-possible', 'data-testid': 'diag-possible' },
    h('h4', {}, 'O que dava para fazer com esta luz'),
    h('table', { class: 'diag-table' }, h('tbody', {}, rows.map(([label, value, note]) => h('tr', {},
      h('th', { scope: 'row' }, label), h('td', {}, h('strong', {}, value), note ? h('div', { class: 'small muted' }, note) : null))))),
    h('p', { class: 'small muted' },
      `Referência de tremido sem estabilização: ${formatShutter(p.reference_s)} (1/distância focal de ${Math.round(p.equivalent_focal)} mm, regra geral). `,
      `Abertura máxima a ${Math.round(p.focal)} mm: ${formatAperture(apertureAtLeast(p.max_aperture.value))} (${p.max_aperture.source === 'file' ? 'gravada pela câmera' : 'tabela da lente'}). `,
      'Física da exposição: cada ponto a mais de luz numa coisa é um ponto a menos em outra.'));
}

/** @param {object} d result of diagnosePhoto */
export function diagnosisCard(d) {
  const main = d.findings.filter((f) => f.severity !== 'info');
  const notes = d.findings.filter((f) => f.severity === 'info');
  return h('section', { class: 'card diag', 'data-testid': 'diagnosis', 'data-verdict': d.verdict },
    h('div', { class: 'card-head' },
      h('h3', {}, 'Diagnóstico'),
      h('span', { class: `chip verdict st-${VERDICT_STATUS[d.verdict]}`, 'data-testid': 'diag-verdict' }, d.verdict_label)),
    // The headline is the first finding's title when there is one: shown once, as the summary.
    h('p', { class: 'diag-headline', 'data-testid': 'diag-headline' }, d.headline),
    h('p', { class: 'small', 'data-testid': 'diag-light' }, d.light.text),
    main.length ? h('ul', { class: 'diag-findings' }, main.map((f, i) => findingItem(f, i === 0 && f.title === d.headline))) : null,
    notes.length ? h('ul', { class: 'diag-findings diag-notes' }, notes.map(findingItem)) : null,
    possibleBlock(d.possible),
    d.missing.length ? h('div', { class: 'diag-missing', 'data-testid': 'diag-missing' },
      h('h4', {}, 'O que faltou para diagnosticar'),
      h('ul', { class: 'small' }, d.missing.map((m) => h('li', {}, m)))) : null,
    h('p', { class: 'small muted' },
      'Sem inteligência artificial: física da exposição, perfil da câmera e da lente, pixels desta foto e a sua avaliação. ',
      'Onde aparece "regra geral", a Rodada 2 de amostras vai trocar o número pelo do seu equipamento.'));
}
