// v0.5.1: scenes inside a session (core/scenes.js) and the diagnosis of a
// scene and a session (core/scene-diagnosis.js). Times and framing distances
// follow the 1st calibration round (docs/CALIBRACAO-RESULTADOS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCapture, newPhotoRecord, refreshRecord } from '../../site/js/core/model.js';
import {
  autoSplit, boundary, captureMs, planMove, sessionScenes, signatureDistance, scenesAdjusted,
} from '../../site/js/core/scenes.js';
import { diagnoseScene, diagnoseSession, settingsDiff, settingsVariation } from '../../site/js/core/scene-diagnosis.js';

const RF50 = 'RF50mm F1.8 STM';
const RF75 = 'RF75-300mm F4-5.6';
const flatSig = (v = 120, rgb = [120, 120, 120]) => ({ grid: new Array(64).fill(v), rgb });
const skySig = () => ({ grid: Array.from({ length: 64 }, (_, i) => (i < 32 ? 230 : 40)), rgb: [140, 150, 170] });

let n = 0;
/** Photo at hh:mm:ss on 12/10/2026, with lens/focal/exposure and the pixel measures the diagnosis needs. */
function shot(time, { lens = RF50, focal = 50, sig = flatSig(), af = 0.33, exposure = {}, scene = null, name } = {}) {
  n += 1;
  const c = emptyCapture();
  c.datetime_original = `2026-10-12T${time}.00-03:00`;
  c.camera.model = 'Canon EOS RP';
  Object.assign(c.lens, { model: lens, focal_length_mm: focal, max_aperture: lens === RF50 ? 1.834 : 5.66 });
  Object.assign(c.exposure, { program: 'Aperture-priority AE', shutter_s: 1 / 250, aperture: 4, iso: 100, ev_comp: 0, measured_ev: 11, ...exposure });
  Object.assign(c.focus, { af_mode: 'One-shot AF', af_area_mode: 'Flexizone Single' });
  const p = newPhotoRecord({ id: `p${n}-${time}`, matchKey: 'k', now: 't' });
  p.variants = [{
    key: 'jpeg-web', kind: 'jpeg', pixels: { width: 6240, height: 4160 }, capture: c, missing: [], metadata_status: 'complete',
    file: { name: name || `IMG_${String(n).padStart(4, '0')}.JPG`, size: 9e6 },
    analysis: {
      metrics_version: 2,
      af: { rect: { x: 0.46, y: 0.44, w: 0.08, h: 0.12 }, blur: { blur: af, x: af, y: af, detail: 2 }, source: 'makernote' },
      uniform: { sigma: 0.3, mean_luma: 120 },
      whole: { histogram: { p50: 120, clip_high: 0, clip_low: 0 }, signature: sig, tiles: [] },
    },
  }];
  refreshRecord(p, 't');
  p.indicators = { primary_variant: 'jpeg-web' };
  p.session_id = 'ses-1';
  p.scene_id = scene;
  return p;
}

// ------------------------------------------------------------------ split

test('hora da captura em milissegundos, com subsegundos; sem data = null', () => {
  const p = shot('10:00:00');
  p.capture.datetime_original = '2026-10-12T10:00:01.45-03:00';
  assert.equal(captureMs(p) - Date.UTC(2026, 9, 12, 10, 0, 1), 450);
  p.capture.datetime_original = null;
  assert.equal(captureMs(p), null);
});

test('assinatura: mesma cena com outra exposição ≈ 0; outro enquadramento longe', () => {
  assert.equal(signatureDistance(flatSig(100), flatSig(200)), 0); // só ficou mais clara
  assert.ok(signatureDistance(flatSig(), skySig()) > 45);
  assert.equal(signatureDistance(null, flatSig()), null);
});

test('pausa longa (≥ 15 min) sempre separa; troca de lente também', () => {
  assert.deepEqual(boundary(shot('10:00:00'), shot('10:16:00')).keys, ['pause']);
  const cut = boundary(shot('10:00:00'), shot('10:00:30', { lens: RF75, focal: 300 }));
  assert.deepEqual(cut.keys, ['lens']);
  assert.match(cut.reasons[0], /RF 50 mm → RF 75-300 mm/);
});

test('dois sinais fracos separam (pausa de 2 min + zoom); um só não', () => {
  assert.equal(boundary(shot('10:00:00', { lens: RF75, focal: 100 }), shot('10:03:00', { lens: RF75, focal: 100 })), null);
  assert.equal(boundary(shot('10:00:00', { lens: RF75, focal: 100 }), shot('10:00:20', { lens: RF75, focal: 300 })), null);
  const cut = boundary(shot('10:00:00', { lens: RF75, focal: 100 }), shot('10:03:00', { lens: RF75, focal: 300 }));
  assert.deepEqual(cut.keys, ['pause', 'zoom']);
});

test('enquadramento muito diferente separa sozinho depois de 30 s, não numa rajada', () => {
  assert.ok(boundary(shot('10:00:00'), shot('10:00:40', { sig: skySig() })));
  assert.equal(boundary(shot('10:00:00'), shot('10:00:01', { sig: skySig() })), null);
});

test('série T da 1ª rodada: zoom 300 → 205 mm na mesma janela fica na mesma cena', () => {
  const photos = [shot('11:30:00', { lens: RF75, focal: 300 }), shot('11:30:35', { lens: RF75, focal: 205 }), shot('11:31:40', { lens: RF75, focal: 300 })];
  assert.equal(autoSplit(photos).length, 1);
});

test('sessão automática: grupos na ordem da captura, com o motivo de cada corte', () => {
  const photos = [shot('10:20:00'), shot('10:00:00'), shot('10:00:20'), shot('10:21:00', { lens: RF75, focal: 300 })];
  const scenes = sessionScenes(photos);
  assert.deepEqual(scenes.map((s) => s.photos.length), [2, 1, 1]);
  assert.deepEqual(scenes.map((s) => s.number), [1, 2, 3]);
  assert.ok(scenes.every((s) => s.auto));
  assert.deepEqual(scenes[0].reasons, []);
  assert.match(scenes[1].reasons[0], /pausa de 20 min/);
  assert.match(scenes[2].reasons[0], /troca de lente/);
  assert.equal(scenes[0].start.slice(11, 19), '10:00:00');
});

test('fotos sem data ficam juntas numa cena no fim', () => {
  const a = shot('10:00:00'); const b = shot('10:00:10'); const c = shot('10:00:20');
  b.capture.datetime_original = null; c.capture.datetime_original = null;
  const scenes = sessionScenes([b, a, c]);
  assert.equal(scenes.length, 2);
  assert.deepEqual(scenes[1].photos.map((p) => p.id).sort(), [b.id, c.id].sort());
});

// ------------------------------------------------------------------ manual adjustment

test('mover uma foto congela a separação: todas ganham cena, a movida vai para o destino', () => {
  const photos = [shot('10:00:00'), shot('10:00:20'), shot('10:30:00'), shot('10:30:20')];
  const scenes = sessionScenes(photos);
  let k = 0;
  const plan = planMove(scenes, [photos[1].id], scenes[1].id, () => `cena-${++k}`);
  assert.equal(plan.size, 4); // all frozen
  const ids = photos.map((p) => plan.get(p.id));
  assert.equal(ids[0], 'cena-1');
  assert.equal(ids[1], 'cena-2');
  assert.equal(ids[2], 'cena-2');
  for (const p of photos) p.scene_id = plan.get(p.id);
  const after = sessionScenes(photos);
  assert.deepEqual(after.map((s) => s.photos.length), [1, 3]);
  assert.ok(after.every((s) => !s.auto));
  assert.ok(scenesAdjusted(photos));
});

test('mover para "nova cena" cria uma cena só com a foto; congelada, só muda o que precisa', () => {
  const photos = [shot('10:00:00', { scene: 'cena-a' }), shot('10:00:20', { scene: 'cena-a' }), shot('10:00:40', { scene: 'cena-a' })];
  const plan = planMove(sessionScenes(photos), [photos[2].id], '__new', () => 'cena-b');
  assert.deepEqual([...plan], [[photos[2].id, 'cena-b']]);
  assert.throws(() => planMove(sessionScenes(photos), [photos[0].id], 'cena-x', () => 'y'), /cena desconhecida/);
});

test('foto nova numa sessão congelada entra na cena mais próxima no tempo; longe, vira cena automática', () => {
  const photos = [shot('10:00:00', { scene: 'cena-a' }), shot('10:30:00', { scene: 'cena-b' }), shot('10:02:00'), shot('11:30:00')];
  const scenes = sessionScenes(photos);
  assert.equal(scenes.length, 3);
  assert.equal(scenes[0].id, 'cena-a');
  assert.equal(scenes[0].photos.length, 2);
  assert.equal(scenes[2].auto, true);
});

// ------------------------------------------------------------------ settings

test('diferença de ajustes em pontos: velocidade, abertura, ISO, focal; modo traduzido', () => {
  const a = shot('10:00:00', { exposure: { shutter_s: 1 / 500, aperture: 4, iso: 400 } });
  const b = shot('10:00:10', { focal: 50, exposure: { shutter_s: 1 / 60, aperture: 8, iso: 400, program: 'Manual' } });
  const d = settingsDiff(a, b);
  const byKey = Object.fromEntries(d.map((x) => [x.key, x]));
  assert.ok(Math.abs(byKey.shutter.stops - Math.log2(500 / 60)) < 1e-9);
  assert.equal(byKey.aperture.stops, 2);
  assert.equal(byKey.iso, undefined);
  assert.equal(byKey.program.to, 'Manual (M)');
});

test('variação: faixa de valores e aviso quando dois ajustes controlados mudam juntos', () => {
  const photos = [
    shot('10:00:00', { exposure: { aperture: 4 } }),
    shot('10:00:10', { focal: 50, exposure: { aperture: 8 } }), // só a abertura
    shot('10:00:20', { lens: RF50, focal: 50, exposure: { aperture: 2.8, ev_comp: -1 } }), // abertura + compensação
  ];
  const v = settingsVariation(photos);
  const ap = v.rows.find((r) => r.key === 'aperture');
  assert.equal(ap.changed, true);
  assert.match(ap.text, /f\/2,8 a f\/8 \(3 pontos\) · 3 valores/);
  assert.equal(v.warnings.length, 1);
  assert.match(v.warnings[0].text, /mudaram 2 ajustes ao mesmo tempo/);
  assert.deepEqual(v.warnings[0].changes.map((c) => c.key).sort(), ['aperture', 'ev_comp']);
});

test('em Av a velocidade muda sozinha com a abertura: não conta como dois ajustes', () => {
  const v = settingsVariation([
    shot('10:00:00', { exposure: { aperture: 4, shutter_s: 1 / 250 } }),
    shot('10:00:10', { exposure: { aperture: 8, shutter_s: 1 / 60 } }),
  ]);
  assert.equal(v.warnings.length, 0);
});

test('ajuste não lido aparece como não lido, sem valor inventado', () => {
  const p = shot('10:00:00');
  p.capture.focus.af_area_mode = null;
  const v = settingsVariation([p]);
  assert.equal(v.rows.find((r) => r.key === 'af_area').text, 'não lido');
});

// ------------------------------------------------------------------ scene diagnosis

test('cena com tremido na maioria: problema e ajuste principal, mais nítida × mais mole', () => {
  const photos = [
    shot('10:00:00', { lens: RF75, focal: 300, af: 0.56, exposure: { shutter_s: 1 / 60, aperture: 8, measured_ev: 12 } }),
    shot('10:00:10', { lens: RF75, focal: 300, af: 0.55, exposure: { shutter_s: 1 / 60, aperture: 8, measured_ev: 12 } }),
    shot('10:00:20', { lens: RF75, focal: 300, af: 0.30, exposure: { shutter_s: 1 / 640, aperture: 8, iso: 1000, measured_ev: 12 } }),
  ];
  const sd = diagnoseScene(photos);
  assert.equal(sd.main_problem.key, 'shake');
  assert.equal(sd.main_problem.count, 2);
  assert.match(sd.main_problem.text, /2 de 3 fotos/);
  assert.match(sd.main_problem.advice, /1\/640/);
  assert.deepEqual(sd.verdicts, { good: 1, usable: 0, problem: 2, unknown: 0 });
  assert.equal(sd.verdict, 'problem');
  assert.equal(sd.comparison.best.id, photos[2].id);
  assert.match(sd.comparison.text, /velocidade 1\/640 s → 1\/60 s/);
  assert.equal(sd.light.min, 12);
});

test('cena com os mesmos ajustes: a comparação diz que a diferença não veio da configuração', () => {
  const photos = [shot('10:00:00', { af: 0.30 }), shot('10:00:05', { af: 0.45 })];
  assert.match(diagnoseScene(photos).comparison.text, /têm os mesmos ajustes/);
});

test('cena toda boa: sem problema principal e sem comparação forçada', () => {
  const sd = diagnoseScene([shot('10:00:00', { af: 0.3 }), shot('10:00:05', { af: 0.32 })]);
  assert.equal(sd.main_problem, null);
  assert.equal(sd.comparison, null);
  assert.equal(sd.verdict, 'good');
});

test('sessão: totais, problema que se repete em cenas diferentes e variação sem avisos entre cenas', () => {
  const slow = { lens: RF75, focal: 300, af: 0.56, exposure: { shutter_s: 1 / 60, aperture: 8, measured_ev: 12 } };
  const photos = [shot('10:00:00', slow), shot('10:00:10', slow), shot('11:00:00', slow), shot('11:00:10', { ...slow, exposure: { ...slow.exposure, aperture: 11, ev_comp: 1 } })];
  const sess = diagnoseSession(sessionScenes(photos));
  assert.equal(sess.scenes.length, 2);
  assert.equal(sess.totals.problem, 4);
  assert.deepEqual(sess.recurring, [{ title: 'Provável tremido', scenes: 2 }]);
  assert.equal(sess.variation.warnings.length, 0);
  assert.equal(sess.scenes[1].variation.warnings.length, 1);
});

test('mover a primeira foto da sessão para a cena seguinte não troca a numeração das cenas', () => {
  const photos = [shot('09:00:00'), shot('09:00:20'), shot('09:00:40'), shot('09:20:00', { lens: RF75, focal: 300 }), shot('09:20:15', { lens: RF75, focal: 300 })];
  const before = sessionScenes(photos);
  let k = 0;
  const plan = planMove(before, [photos[0].id], before[1].id, () => `cena-${++k}`);
  for (const p of photos) p.scene_id = plan.get(p.id) ?? p.scene_id;
  const after = sessionScenes(photos);
  assert.deepEqual(after.map((s) => s.photos.length), [2, 3]);
  assert.ok(after[1].photos.some((p) => p.id === photos[0].id));
  assert.match(after[1].start, /09:00:00/); // the range shows the moved photo honestly
});

test('trocar Av por A+ conta como um ajuste só (no A+ a câmera escolhe a área de AF)', () => {
  const a = shot('10:00:00');
  const b = shot('10:00:30');
  b.capture.exposure.program = 'Scene Intelligent Auto';
  b.capture.focus.af_area_mode = 'Face + Tracking';
  assert.equal(settingsVariation([a, b]).warnings.length, 0);
});

test('texto da diferença não repete o nome quando o valor já o traz', async () => {
  const { diffText } = await import('../../site/js/core/scene-diagnosis.js');
  const d = settingsDiff(shot('10:00:00', { exposure: { iso: 640 } }), shot('10:00:05', { exposure: { iso: 100, program: 'Manual' } }))
    .find((x) => x.key === 'iso');
  assert.equal(diffText(d), 'ISO 640 → ISO 100 (2 2/3 pontos)');
});

test('duas fotos nítidas na cena: sem comparação "mais nítida × mais mole"', () => {
  assert.equal(diagnoseScene([shot('10:00:00', { af: 0.26 }), shot('10:00:05', { af: 0.36 })]).comparison, null);
});
