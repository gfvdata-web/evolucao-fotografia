// Versions of one shot that cover different parts of the sensor (calibration
// with the EOS RP samples): the JPEG inside a CR3 is always the whole sensor,
// while the camera JPEG may be 16:9 or the 1.6x crop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sensorField, PROFILES } from '../../site/js/core/camera-profiles.js';
import {
  mapRegion, mapPoint, clampRegion, afAreasOnPreview, afCenterOnPreview, frameVariant,
} from '../../site/js/core/af-geometry.js';
import { chainComparison, primaryVariant } from '../../site/js/core/indicators.js';
import { newPhotoRecord, newVariant, emptyCapture, refreshRecord } from '../../site/js/core/model.js';

const RP = PROFILES['Canon EOS RP'];
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('campo de visão: M e S mostram a mesma cena do L; 16:9 e recorte 1,6x são a parte central', () => {
  assert.deepEqual(sensorField(RP, 6240, 4160), { width: 6240, height: 4160 });
  assert.deepEqual(sensorField(RP, 4160, 2768), { width: 6240, height: 4160 }); // M1 3:2
  assert.deepEqual(sensorField(RP, 6240, 3504), { width: 6240, height: 3504 }); // L 16:9
  assert.deepEqual(sensorField(RP, 2400, 1344), { width: 6240, height: 3504 }); // S2 16:9
  assert.deepEqual(sensorField(RP, 3888, 2592), { width: 3888, height: 2592 }); // 1.6x crop
  assert.deepEqual(sensorField(RP, 3504, 6240), { width: 3504, height: 6240 }); // portrait
  assert.equal(sensorField(RP, 1200, 800), null); // resized somewhere: unknown
  assert.equal(sensorField(null, 6240, 4160), null);
});

test('região do JPEG 16:9 vai para o mesmo ponto da cena no CR3 (sensor inteiro)', () => {
  const jpeg = { width: 6240, height: 3504 };
  const cr3 = { width: 6240, height: 4160 };
  const r = mapRegion({ x: 0.4, y: 0, w: 0.1, h: 0.1 }, jpeg, cr3);
  assert.ok(near(r.x, 0.4) && near(r.w, 0.1));
  assert.ok(near(r.y, 328 / 4160)); // top of the 16:9 band = 328 px below the sensor top
  assert.ok(near(r.h, 350.4 / 4160));
  const back = mapRegion(r, cr3, jpeg);
  assert.ok(near(back.y, 0) && near(back.h, 0.1));
  // Unknown field (resized copy): same relative position.
  assert.deepEqual(mapRegion({ x: 0.2, y: 0.3, w: 0.1, h: 0.1 }, cr3, null), { x: 0.2, y: 0.3, w: 0.1, h: 0.1 });
  // A point outside the 16:9 band is clamped to its edge.
  assert.equal(mapPoint({ cx: 0.5, cy: 0.02 }, cr3, jpeg).cy, 0);
  assert.deepEqual(clampRegion({ x: -0.1, y: 0.95, w: 0.2, h: 0.1 }), { x: 0, y: 0.9, w: 0.2, h: 0.1 });
});

function variant(key, kind, w, h, af = null) {
  const v = newVariant({ kind, source: 'web', file: { name: `${key}.x`, size: 1, type: '', lastModified: 0 }, key });
  v.pixels = { width: w, height: h };
  v.capture = emptyCapture();
  v.capture.camera.model = 'Canon EOS RP';
  v.capture.image.orientation = 1;
  v.capture.focus.af_point = af;
  v.metadata_status = 'complete';
  v.missing = [];
  return v;
}

// F11 of the samples: 16:9 with RAW + JPEG, AF point at x = −450, y = −51.
function photo169(previewFrom) {
  const af = (h) => ({ af_image_width: 6240, af_image_height: h, y_axis: 'up', areas: [{ x: -450, y: -51, w: 480, h: 481 }], in_focus: [0], selected: [0] });
  const p = newPhotoRecord({ id: 'p', matchKey: 'k', now: 't' });
  p.variants.push(variant('cr3-web', 'cr3', 6240, 4160, af(4160)), variant('jpeg-web', 'jpeg', 6240, 3504, af(3504)));
  p.preview = { from_variant: previewFrom };
  refreshRecord(p, 't');
  return p;
}

test('AF na prévia usa o quadro da própria versão mostrada', () => {
  for (const from of ['jpeg-web', 'cr3-web']) {
    const p = photo169(from);
    const h = from === 'jpeg-web' ? 3504 : 4160;
    assert.equal(frameVariant(p).key, from);
    const c = afCenterOnPreview(p);
    assert.ok(near(c.cy, 0.5 + 51 / h), `${from}: ${c.cy}`);
  }
  // Preview without AF data (e.g. a JPEG without MakerNotes): mapped from the CR3.
  const p = photo169('jpeg-web');
  p.variants[1].capture.focus.af_point = null;
  const [a] = afAreasOnPreview(p);
  assert.ok(near(a.top + a.height / 2, 0.5 + 51 / 3504));
});

test('cadeia: 16:9 ao lado do JPEG do CR3 é escolha da câmera, não perda', () => {
  const p = photo169('jpeg-web');
  const c = chainComparison(p);
  const f = c.steps[0].findings.find((x) => x.kind === 'pixels');
  assert.equal(f.severity, 'info');
  assert.match(f.text, /L 16:9 escolhido na câmera/);
  assert.equal(c.status, 'ok');
});

test('versão principal: no empate de pixels, o JPEG da câmera (o do CR3 é uma prévia mais comprimida)', () => {
  const p = newPhotoRecord({ id: 'p', matchKey: 'k', now: 't' });
  p.variants.push(variant('cr3-web', 'cr3', 6240, 4160), variant('jpeg-web', 'jpeg', 6240, 4160));
  assert.equal(primaryVariant(p).key, 'jpeg-web');
  p.variants[1].pixels = { width: 4160, height: 2768 }; // JPEG M: the CR3 has more pixels
  assert.equal(primaryVariant(p).key, 'cr3-web');
});
