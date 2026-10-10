// Converts Canon AF areas (relative to the image centre, in AF coordinates,
// Y positive upwards for EOS bodies) into rectangles normalized to 0..1 over
// the image as displayed (after the EXIF orientation is applied). Pure.

/** Sensor-frame point (u, v in 0..1, v downwards) → displayed frame. */
function orientPoint(u, v, orientation) {
  switch (orientation) {
    case 3: return [1 - u, 1 - v]; // rotated 180°
    case 6: return [1 - v, u]; // rotate 90° clockwise to display
    case 8: return [v, 1 - u]; // rotate 270° clockwise to display
    default: return [u, v];
  }
}

/**
 * @param {object} afPoint capture.focus.af_point
 * @param {number|null} orientation EXIF orientation (1, 3, 6, 8)
 * @returns {Array<{left:number, top:number, width:number, height:number, inFocus:boolean, selected:boolean}>}
 */
export function afAreasForDisplay(afPoint, orientation = 1) {
  if (!afPoint?.areas?.length) return [];
  const W = afPoint.af_image_width;
  const H = afPoint.af_image_height;
  const ySign = afPoint.y_axis === 'down' ? 1 : -1;
  const rotated = orientation === 6 || orientation === 8;
  return afPoint.areas.map((a, i) => {
    const cu = 0.5 + a.x / W;
    const cv = 0.5 + (ySign * a.y) / H;
    const [du, dv] = orientPoint(cu, cv, orientation);
    const w = (a.w || 0) / W;
    const h = (a.h || 0) / H;
    const width = rotated ? h : w;
    const height = rotated ? w : h;
    return {
      left: du - width / 2, top: dv - height / 2, width, height,
      inFocus: afPoint.in_focus.includes(i), selected: afPoint.selected.includes(i),
    };
  });
}

/** Short pt-BR description of where the AF areas are, e.g. "à esquerda e acima do centro". */
export function describeAfPosition(afPoint) {
  if (!afPoint?.areas?.length) return null;
  const focus = afPoint.in_focus.length ? afPoint.in_focus.map((i) => afPoint.areas[i]).filter(Boolean) : afPoint.areas;
  const cx = focus.reduce((s, a) => s + a.x, 0) / focus.length / afPoint.af_image_width;
  const cy = focus.reduce((s, a) => s + a.y, 0) / focus.length / afPoint.af_image_height;
  const ySign = afPoint.y_axis === 'down' ? -1 : 1;
  const horiz = cx < -1 / 6 ? 'à esquerda' : cx > 1 / 6 ? 'à direita' : null;
  const vert = ySign * cy > 1 / 6 ? 'acima' : ySign * cy < -1 / 6 ? 'abaixo' : null;
  const n = afPoint.areas.length;
  const count = n === 1 ? '1 área' : `${n} áreas${afPoint.in_focus.length ? `, ${afPoint.in_focus.length} em foco` : ''}`;
  if (!horiz && !vert) return `${count}, no centro`;
  return `${count}, ${[horiz, vert].filter(Boolean).join(' e ')} do centro`;
}
