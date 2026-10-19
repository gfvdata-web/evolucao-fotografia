// v0.5.0: diagnosis of one photo (core/diagnosis.js). Decision 0011: every
// piece of advice has a test with the case that triggers it and with the case
// of a field that was not read. Numbers come from the 1st calibration round.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCapture, newPhotoRecord, refreshRecord } from '../../site/js/core/model.js';
import {
  diagnosePhoto, sceneLightOf, possibleSettings, focusAssessment, diagnosisChip, stopsText, LIMITS,
} from '../../site/js/core/diagnosis.js';

const RF50 = { model: 'RF50mm F1.8 STM', focal_length_mm: 50, max_aperture: 1.834 };
const RF75_300 = { model: 'RF75-300mm F4-5.6', focal_length_mm: 300, max_aperture: 5.66 };

/** Tiles of a 4×3 grid away from the centre; blurOf(i) gives each one's blur. */
const tiles = (blurOf) => Array.from({ length: 12 }, (_, i) => ({
  col: i % 4, row: Math.floor(i / 4),
  rect: { x: (i % 4) / 4 + 0.02, y: Math.floor(i / 4) / 3 + 0.02, w: 0.04, h: 0.06 },
  blur: { blur: blurOf(i), x: blurOf(i), y: blurOf(i), detail: 2 },
}));
const analysis = ({ af = 0.33, detail = 2, tileBlur = () => 0.45, hist = { p50: 120, clip_high: 0, clip_low: 0 }, sigma = 0.3 } = {}) => ({
  metrics_version: 2,
  af: { rect: { x: 0.46, y: 0.44, w: 0.08, h: 0.12 }, blur: { blur: af, x: af, y: af, detail }, source: 'makernote', laplacian_var: 100 },
  uniform: { sigma, mean_luma: 120 },
  whole: { histogram: hist, signature: null, tiles: tiles(tileBlur) },
});

function photo({ lens = RF50, exposure = {}, focus = {}, an = analysis(), rating = null, width = 6240, height = 4160, nr = 'Low' } = {}) {
  const c = emptyCapture();
  c.datetime_original = '2026-10-12T10:00:00';
  c.camera.model = 'Canon EOS RP';
  Object.assign(c.lens, lens);
  Object.assign(c.exposure, { program: 'Aperture-priority AE', shutter_s: 1 / 200, aperture: 4, iso: 100, ev_comp: 0, measured_ev: 11, ...exposure });
  Object.assign(c.focus, { af_mode: 'One-shot AF', af_area_mode: 'Flexizone Single', ...focus });
  c.noise_reduction.high_iso = nr;
  const p = newPhotoRecord({ id: 'p', matchKey: 'k', now: 't' });
  p.variants = [{
    key: 'jpeg-web', kind: 'jpeg', pixels: { width, height }, capture: c, missing: [], metadata_status: 'complete',
    file: { name: 'IMG_1.JPG', size: 9e6 }, analysis: an,
  }];
  refreshRecord(p, 't');
  p.rating = rating;
  return p;
}
const keys = (d) => d.findings.map((f) => f.key);
const get = (d, key) => d.findings.find((f) => f.key === key);

// ------------------------------------------------------------------ light

test('luz da cena: fotômetro da câmera primeiro, ignorando a compensação (amostra F10)', () => {
  const p = photo({ exposure: { shutter_s: 1 / 80, aperture: 3.2, iso: 200, ev_comp: -1, measured_ev: 7.875, program: 'Program AE' } });
  const l = sceneLightOf(p);
  assert.equal(l.source, 'meter');
  assert.equal(l.ev, 7.875);
  assert.match(l.text, /fotômetro/);
});

test('luz da cena sem fotômetro: exposição usada com a compensação descontada', () => {
  const p = photo({ exposure: { shutter_s: 1 / 80, aperture: 3.2, iso: 200, ev_comp: -1, measured_ev: null, program: 'Program AE' } });
  const l = sceneLightOf(p);
  assert.equal(l.source, 'exposure');
  assert.ok(Math.abs(l.ev - 7.68) < 0.02, String(l.ev)); // 8,68 da exposição − 1
});

test('luz da cena no modo M sem fotômetro: corrigida pelo brilho da foto', () => {
  const dark = photo({ exposure: { program: 'Manual', measured_ev: null }, an: analysis({ hist: { p50: 30, clip_high: 0, clip_low: 0 } }) });
  const l = sceneLightOf(dark);
  assert.equal(l.source, 'brightness');
  const plain = sceneLightOf(photo({ exposure: { program: 'Manual', measured_ev: null }, an: null }));
  assert.ok(l.ev < plain.ev - 2, `${l.ev} × ${plain.ev}`); // foto escura = cena mais escura que a exposição sugeria
});

test('luz da cena: campo ausente aparece como não calculada (regra 5)', () => {
  const d = diagnosePhoto(photo({ exposure: { iso: null, measured_ev: null } }));
  assert.equal(d.light.ev, null);
  assert.equal(d.possible, null);
  assert.ok(d.missing.some((m) => /falta ISO/.test(m) && /combinações possíveis/.test(m)));
});

// ------------------------------------------------------------------ what was possible

test('o que era possível: F06 (300 mm, 1/100, EV 12,1) → 1/640 s · f/8 à mão, e tripé com ISO 100', () => {
  const p = photo({ lens: RF75_300, exposure: { shutter_s: 1 / 100, aperture: 7.1, iso: 100, measured_ev: 12.125, program: 'Shutter speed priority AE' } });
  const s = possibleSettings(p, sceneLightOf(p), { equivalentFocal: 300 });
  assert.equal(s.hand.shutter, 1 / 640);
  assert.equal(s.hand.aperture, 8); // calibração: f/8 é a mais nítida da RF 75-300 a 300 mm
  assert.equal(s.hand.iso, 1000);
  assert.equal(s.hand.over_iso_limit, false);
  assert.equal(s.tripod.iso, 100);
  assert.equal(s.reference_s, 1 / 300);
});

test('o que era possível: pouca luz abre a lente e aceita a velocidade mínima antes de passar do ISO aceitável', () => {
  const p = photo({ exposure: { measured_ev: 4 } });
  const s = possibleSettings(p, sceneLightOf(p), { equivalentFocal: 50 });
  assert.equal(s.hand.aperture, 1.8);
  assert.ok(s.hand.iso <= LIMITS.iso_ok, String(s.hand.iso));
  const darker = photo({ exposure: { measured_ev: 1 } });
  const t = possibleSettings(darker, sceneLightOf(darker), { equivalentFocal: 50 });
  assert.equal(t.hand.over_iso_limit, true);
  assert.equal(t.hand.shutter, 1 / 50);
});

test('o que era possível: assunto em movimento pede 1/500 s', () => {
  const p = photo({ exposure: { measured_ev: 9 } });
  const s = possibleSettings(p, sceneLightOf(p), { equivalentFocal: 50, moving: true });
  assert.equal(s.hand.shutter, 1 / 500);
});

test('o que era possível: sem abertura máxima nem perfil da lente, não calcula', () => {
  const p = photo({ lens: { model: 'Lente X', focal_length_mm: 35, max_aperture: null } });
  assert.equal(possibleSettings(p, sceneLightOf(p)), null);
  const d = diagnosePhoto(p);
  assert.ok(d.missing.some((m) => /Lente sem perfil/.test(m)));
});

// ------------------------------------------------------------------ shake

test('tremido: velocidade lenta + recorte mole = provável tremido, com a velocidade e o ISO para a próxima', () => {
  const d = diagnosePhoto(photo({
    lens: RF75_300, exposure: { shutter_s: 1 / 100, aperture: 7.1, iso: 100, measured_ev: 12.125 },
    an: analysis({ af: 0.559, tileBlur: () => 0.55 }),
  }));
  assert.equal(d.verdict, 'problem');
  assert.equal(d.headline, 'Provável tremido');
  const f = get(d, 'shake');
  assert.equal(f.severity, 'alert');
  assert.equal(f.certainty, 'high');
  assert.match(f.advice, /1\/640 s ou mais rápida/);
  assert.match(f.advice, /ISO 1000/);
  assert.ok(f.sources.includes('physics') && f.sources.includes('rule') && f.sources.includes('calibration'));
  assert.match(f.rule_note, /Rodada 2/);
});

test('tremido: logo acima da referência (1,2×) e mole = só "possível", com certeza baixa', () => {
  const d = diagnosePhoto(photo({ lens: RF75_300, exposure: { shutter_s: 1 / 250, aperture: 5.6, measured_ev: 13 }, an: analysis({ af: 0.52, tileBlur: () => 0.5 }) }));
  const f = get(d, 'shake');
  assert.equal(f.severity, 'attention');
  assert.equal(f.certainty, 'low');
  // T01: a abertura máxima a 300 mm vem antes (calibração)
  assert.equal(d.findings[0].key, 'wide_open');
  assert.match(get(d, 'wide_open').advice, /Feche para f\/8/);
});

test('tremido: velocidade lenta mas recorte nítido = houve apoio; não vira problema', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: 1 / 15 }, an: analysis({ af: 0.27 }) }));
  const f = get(d, 'shake');
  assert.equal(f.severity, 'info');
  assert.match(f.text, /apoio/);
  assert.equal(d.verdict, 'good');
});

test('tremido: sem velocidade ou focal, não avaliado (regra 5)', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: null } }));
  assert.equal(get(d, 'shake'), undefined);
  assert.ok(d.missing.some((m) => /risco de tremido não foi avaliado/.test(m)));
});

test('assunto em movimento (marcado na avaliação) a 1/125 s: pede 1/500 s e Servo AF', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: 1 / 125, measured_ev: 9 }, rating: { sharpness: 2, problem: 'motion_blur', subject: 'moving' } }));
  const f = get(d, 'motion');
  assert.ok(f);
  assert.match(f.advice, /1\/500 s/);
  assert.match(f.advice, /Servo AF/);
  assert.ok(f.evidence.some((e) => /arrastada/.test(e)));
});

// ------------------------------------------------------------------ focus

test('foco fora do ponto: recorte mole e um trecho nítido em outro lugar; profundidade de campo pela distância', () => {
  const d = diagnosePhoto(photo({
    exposure: { shutter_s: 1 / 200, aperture: 1.8, iso: 640, measured_ev: 6.75 },
    focus: { distance: { near_m: 1.09, far_m: 1.2, far_infinite: false } },
    an: analysis({ af: 0.52, tileBlur: (i) => (i === 0 ? 0.28 : 0.55) }),
  }));
  const f = get(d, 'missed_focus');
  assert.equal(f.severity, 'alert');
  assert.match(f.text, /no alto, à esquerda/);
  assert.ok(f.evidence.some((e) => /profundidade de campo é de ~5 cm/.test(e)));
  assert.match(f.advice, /Feche para f\/4/);
  assert.equal(get(d, 'shake'), undefined);
});

test('foco fora do ponto sem distância gravada (RF 75-300): diz o que faltou', () => {
  const d = diagnosePhoto(photo({ lens: { ...RF75_300 }, exposure: { shutter_s: 1 / 1000, aperture: 8, iso: 640, measured_ev: 12.5 }, an: analysis({ af: 0.55, tileBlur: (i) => (i === 3 ? 0.3 : 0.55) }) }));
  assert.ok(get(d, 'missed_focus'));
  assert.ok(d.missing.some((m) => /Distância de foco não gravada/.test(m)));
});

test('trecho que coincide com o recorte do foco não conta como "nítido em outro lugar"', () => {
  const p = photo({ an: analysis({ af: 0.5, tileBlur: () => 0.55 }) });
  p.variants[0].analysis.whole.tiles[5].rect = { x: 0.47, y: 0.45, w: 0.04, h: 0.06 };
  p.variants[0].analysis.whole.tiles[5].blur.blur = 0.25;
  assert.equal(focusAssessment(p).sharper_elsewhere, false);
});

test('mole sem velocidade lenta e sem trecho nítido: causas possíveis, certeza baixa', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: 1 / 500, aperture: 1.8, measured_ev: 10 }, an: analysis({ af: 0.5, tileBlur: () => 0.52 }) }));
  const f = get(d, 'soft_everywhere');
  assert.equal(f.certainty, 'low');
  assert.match(f.text, /Nenhum outro trecho medido está nítido/);
  assert.ok(f.evidence.some((e) => /abertura máxima/.test(e)));
});

test('recorte do foco sem detalhe: nitidez não julgada, e a ficha diz por quê', () => {
  const d = diagnosePhoto(photo({ an: analysis({ af: 0.6, detail: 0.8 }) }));
  assert.equal(d.focus.state, 'low_detail');
  assert.equal(d.verdict, 'unknown');
  assert.ok(d.missing.some((m) => /pouco detalhe/.test(m)));
});

test('sem análise de pixels: veredito sem dados e aviso', () => {
  const d = diagnosePhoto(photo({ an: null }));
  assert.equal(d.focus.state, 'unknown');
  assert.ok(d.missing.some((m) => /Pixels ainda não analisados/.test(m)));
});

test('análise de versão anterior (sem desfoque): diz que o original não está no aparelho', () => {
  const an = analysis();
  delete an.af.blur; delete an.whole;
  const d = diagnosePhoto(photo({ an }));
  assert.ok(d.missing.some((m) => /versão anterior/.test(m)));
});

// ------------------------------------------------------------------ lens

test('difração em f/16: em pixels da EOS RP, com o lembrete da calibração', () => {
  const d = diagnosePhoto(photo({ exposure: { aperture: 16 } }));
  const f = get(d, 'diffraction');
  assert.equal(f.severity, 'info');
  assert.match(f.text, /21 µm/);
  assert.match(f.text, /3,7 pixels/);
});

test('RF 50 em f/1,8 com a foto nítida: nenhuma nota (regra geral só aparece se ajudar a explicar)', () => {
  const d = diagnosePhoto(photo({ exposure: { aperture: 1.8 }, an: analysis({ af: 0.3 }) }));
  assert.equal(get(d, 'wide_open'), undefined);
});

// ------------------------------------------------------------------ noise

test('ISO 12800: dava para ISO menor sem passar da referência de tremido', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: 1 / 500, aperture: 1.8, iso: 12800, measured_ev: 3.875, program: 'Manual' }, an: analysis({ sigma: 1.68 }) }));
  const f = get(d, 'noise');
  assert.equal(f.severity, 'alert');
  assert.match(f.advice, /ISO 1250/);
  assert.ok(f.evidence.some((e) => /1,68/.test(e)));
  assert.ok(d.missing.some((m) => /o ruído conta como detalhe/.test(m)));
});

test('ISO alto com redução de ruído Forte: lembra a F08', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: 1 / 500, aperture: 1.8, iso: 12800, measured_ev: 3.875 }, nr: 'Strong' }));
  assert.ok(get(d, 'noise').evidence.some((e) => /Forte/.test(e)));
});

test('ISO alto que era o preço da luz: sugere apoio, não ISO menor', () => {
  const d = diagnosePhoto(photo({ exposure: { shutter_s: 1 / 50, aperture: 1.8, iso: 6400, measured_ev: 1 } }));
  assert.match(get(d, 'noise').advice, /o ISO alto era necessário/);
});

test('ISO alto sem luz calculada: não diz que ISO bastava (regra 5)', () => {
  const d = diagnosePhoto(photo({ exposure: { iso: 6400, measured_ev: null, shutter_s: null } }));
  assert.equal(get(d, 'noise').advice, null);
  assert.ok(d.missing.some((m) => /ISO que bastaria não foi calculado/.test(m)));
});

// ------------------------------------------------------------------ histogram

test('altas luzes: 15% estourado = alerta e compensação −1 EV', () => {
  const d = diagnosePhoto(photo({ an: analysis({ hist: { p50: 140, clip_high: 0.15, clip_low: 0 } }) }));
  const f = get(d, 'highlights');
  assert.equal(f.severity, 'alert');
  assert.match(f.text, /15%/);
  assert.match(f.advice, /−1 EV/);
});

test('céu estourado e sombras pretas juntos: contraste maior que a foto aguenta', () => {
  const d = diagnosePhoto(photo({ an: analysis({ hist: { p50: 100, clip_high: 0.05, clip_low: 0.08 } }) }));
  assert.equal(get(d, 'shadows').title, 'Contraste maior que a foto aguenta');
  assert.match(get(d, 'highlights').advice, /−2\/3 EV/);
});

test('foto escura: aviso de que clarear depois aumenta o grão', () => {
  const d = diagnosePhoto(photo({ an: analysis({ hist: { p50: 35, clip_high: 0, clip_low: 0.01 } }) }));
  assert.ok(get(d, 'dark'));
});

test('sem histograma (análise antiga): estouro não avaliado', () => {
  const an = analysis();
  delete an.whole;
  const d = diagnosePhoto(photo({ an }));
  assert.ok(d.missing.some((m) => /Histograma não medido/.test(m)));
});

// ------------------------------------------------------------------ way to the device

test('reduzida no caminho: alerta com a orientação do Camera Connect', () => {
  const d = diagnosePhoto(photo({ width: 3000, height: 2000 }));
  const p = photo({ width: 3000, height: 2000 });
  p.variants[0].capture.image.exif_width = 6240; p.variants[0].capture.image.exif_height = 4160;
  refreshRecord(p, 't');
  const f = get(diagnosePhoto(p), 'path_reduced');
  assert.equal(f.severity, 'alert');
  assert.match(f.advice, /Tam\. original/);
  assert.ok(get(d, 'path_reduced')); // 3000×2000 não é um tamanho que a EOS RP grava
});

test('tamanho S2 escolhido na câmera: nota para gravar em L', () => {
  const d = diagnosePhoto(photo({ width: 2400, height: 1600 }));
  assert.match(get(d, 'small_size').advice, /grave em L/);
});

// ------------------------------------------------------------------ rating

test('avaliação "nenhum problema" com nitidez 5 decide o veredito', () => {
  const d = diagnosePhoto(photo({ an: analysis({ af: 0.5, tileBlur: () => 0.5 }), rating: { sharpness: 5, problem: 'none' } }));
  assert.equal(d.verdict, 'good');
  assert.match(d.headline, /nitidez 5\/5/);
});

test('avaliação que bate com um achado aumenta a certeza dele', () => {
  const base = { exposure: { shutter_s: 1 / 30, measured_ev: 9 }, an: analysis({ af: 0.45, tileBlur: () => 0.5 }) };
  const before = get(diagnosePhoto(photo(base)), 'shake').certainty;
  const after = get(diagnosePhoto(photo({ ...base, rating: { sharpness: 2, problem: 'soft' } })), 'shake');
  assert.notEqual(before, after.certainty);
  assert.ok(after.sources.includes('rating'));
});

test('avaliação sem causa nos dados: diz isso e dá as causas que os dados não veem', () => {
  const d = diagnosePhoto(photo({ rating: { sharpness: 2, problem: 'soft' } }));
  const f = get(d, 'unexplained');
  assert.ok(f);
  assert.ok(f.evidence.some((e) => /vidro/.test(e)));
  assert.equal(d.verdict, 'problem');
});

// ------------------------------------------------------------------ verdict and chip

test('foto nítida sem achados: "Boa" e chip curto', () => {
  const d = diagnosePhoto(photo());
  assert.equal(d.verdict, 'good');
  assert.deepEqual(keys(d), []);
  assert.equal(diagnosisChip(d), 'Boa');
});

test('pontos em texto: 1 ponto, 1 1/3 ponto, 2/3 de ponto', () => {
  assert.equal(stopsText(1), '1 ponto');
  assert.equal(stopsText(4 / 3), '1 1/3 ponto');
  assert.equal(stopsText(2), '2 pontos');
  assert.equal(stopsText(0.66), '2/3 de ponto');
});

test('trecho só um pouco mais nítido que o foco (T02, T07): não acusa foco errado (margem da calibração)', () => {
  const d = diagnosePhoto(photo({ lens: RF75_300, exposure: { shutter_s: 1 / 640, aperture: 6.3, iso: 250, measured_ev: 13.3 }, an: analysis({ af: 0.49, tileBlur: (i) => (i === 2 ? 0.29 : 0.45) }) }));
  assert.equal(get(d, 'missed_focus'), undefined);
  assert.match(get(d, 'soft_everywhere').text, /pode ser só um assunto com mais contraste/);
});

test('velocidade bem lenta e um trecho um pouco mais nítido (F06): tremido, não foco errado', () => {
  const d = diagnosePhoto(photo({ lens: RF75_300, exposure: { shutter_s: 1 / 100, aperture: 7.1, iso: 100, measured_ev: 12.125 }, an: analysis({ af: 0.56, tileBlur: (i) => (i === 0 ? 0.39 : 0.6) }) }));
  assert.equal(get(d, 'missed_focus'), undefined);
  assert.equal(get(d, 'shake').severity, 'alert');
});

test('trecho com pouco detalhe não serve de comparação (F11)', () => {
  const p = photo({ an: analysis({ af: 0.5, tileBlur: () => 0.55 }) });
  p.variants[0].analysis.whole.tiles[0].blur = { blur: 0.2, x: 0.2, y: 0.2, detail: 1.0 };
  assert.equal(focusAssessment(p).sharper_elsewhere, false);
});

test('manchete: achado certo de atenção vem antes de alerta incerto', () => {
  const d = diagnosePhoto(photo({
    exposure: { shutter_s: 1 / 30, measured_ev: 9 },
    an: analysis({ af: 0.62, tileBlur: (i) => (i === 0 ? 0.3 : 0.6), hist: { p50: 120, clip_high: 0.03, clip_low: 0 } }),
  }));
  // missed_focus: alert with low certainty (slow-ish shutter); highlights: attention, high certainty.
  assert.equal(get(d, 'missed_focus').certainty, 'low');
  assert.equal(d.findings[0].key, 'highlights');
});

// ------------------------------------------------------------------ v2.0.1: numbers behind "Boa"

test('v2.0.1: foto "Boa" mostra o desfoque, a escala das amostras e o limite (regra 4)', () => {
  const d = diagnosePhoto(photo({ an: analysis({ af: 0.31 }) }));
  assert.equal(d.verdict, 'good');
  assert.equal(d.headline, 'Nítida no ponto de foco (desfoque 0,31; o limite é 0,40).');
  const blur = d.measures.find((m) => m.key === 'af_blur');
  assert.match(blur.value, /^0,31 \(abaixo de 0,40: nítida\)$/);
  assert.match(blur.note, /tripé 0,27/);
  assert.deepEqual(blur.sources, ['pixels', 'calibration']);
  const keysM = d.measures.map((m) => m.key);
  for (const k of ['af_detail', 'af_source', 'tiles', 'shake', 'iso', 'histogram']) assert.ok(keysM.includes(k), k);
  assert.match(d.measures.find((m) => m.key === 'tiles').value, /mais nítido 0,45 .* mais mole 0,45/);
  assert.match(d.measures.find((m) => m.key === 'shake').value, /folga de 4,0×/);
  assert.match(d.measures.find((m) => m.key === 'af_source').value, /ponto de AF gravado/);
});

test('v2.0.1: "nítida por pouco" entre 0,37 e 0,40, sem mudar o veredito', () => {
  const near = diagnosePhoto(photo({ an: analysis({ af: 0.39 }), exposure: { shutter_s: 1 / 60 } }));
  assert.equal(near.verdict, 'good');
  const f = get(near, 'low_margin');
  assert.equal(f.severity, 'info');
  assert.match(f.text, /0,39/);
  assert.match(f.advice, /1\/100|1\/125/);
  // With a 4× margin already, the advice is support, not a faster speed.
  assert.match(get(diagnosePhoto(photo({ an: analysis({ af: 0.39 }) })), 'low_margin').advice, /Apoiar/);
  assert.equal(get(diagnosePhoto(photo({ an: analysis({ af: 0.36 }) })), 'low_margin'), undefined);
  assert.equal(get(diagnosePhoto(photo({ an: analysis({ af: 0.44 }) })), 'low_margin'), undefined);
});

test('v2.0.1: sem análise, as medidas dizem "não medido" em vez de um número', () => {
  const d = diagnosePhoto(photo({ an: null }));
  const blur = d.measures.find((m) => m.key === 'af_blur');
  assert.equal(blur.value, 'não medido');
  assert.equal(d.measures.find((m) => m.key === 'histogram'), undefined);
});
