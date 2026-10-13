// Drag and drop of photos between scenes, made for the tablet (v0.5.1).
//
// Hold a photo for HOLD_MS without moving: it lifts (a copy follows the finger)
// and the screen stops scrolling; drop it on another scene, or on the "new
// scene" area. Moving the finger before that scrolls as usual, and a quick tap
// still opens the photo. Works with mouse and pen through pointer events.
// Near the top or bottom edge the page scrolls by itself, so a photo can reach
// a scene that is off screen. "Mover para…" (selection bar) does the same
// without dragging.
//
// Markup: draggable cards carry data-photo-id; drop areas carry data-scene-drop
// (a scene id, or "__new").

export const HOLD_MS = 450;
const MOVE_TOLERANCE_PX = 10;
const CLICK_AFTER_DROP_MS = 80; // the click a mouse release fires comes right away
const EDGE_PX = 80; // auto-scroll zone at the top and bottom of the window
const MAX_SCROLL_PX = 18; // per frame, at the very edge

/**
 * @param {HTMLElement} root container of the scenes
 * @param {{onDrop: (photoId: string, target: string) => void, enabled?: () => boolean}} opts
 * @returns {() => void} detach
 */
export function attachSceneDrag(root, { onDrop, enabled = () => true }) {
  let press = null; // { id, x, y, card, timer, pointerId }
  let drag = null; // { id, ghost, card, over, dx, dy, x, y, raf }
  let droppedAt = -Infinity; // time of the last drop (performance.now)

  const targetAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-scene-drop]') || null;

  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  function begin() {
    const { card, x, y, id } = press;
    const r = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.removeAttribute('data-testid');
    Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
    document.body.append(ghost);
    card.classList.add('drag-source');
    document.body.classList.add('scene-dragging');
    drag = { id, ghost, card, over: null, dx: x - r.left, dy: y - r.top, x, y, raf: 0 };
    press = null;
    drag.raf = requestAnimationFrame(autoScroll);
    globalThis.navigator?.vibrate?.(25);
  }

  /** Scrolls while the finger rests near an edge; the target under it is found again. */
  function autoScroll() {
    if (!drag) return;
    const h = window.innerHeight;
    let v = 0;
    if (drag.y > h - EDGE_PX) v = ((drag.y - (h - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_PX;
    else if (drag.y < EDGE_PX) v = -((EDGE_PX - drag.y) / EDGE_PX) * MAX_SCROLL_PX;
    if (v) {
      const before = window.scrollY;
      window.scrollBy(0, Math.round(v));
      if (window.scrollY !== before) moveGhost(drag.x, drag.y);
    }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function moveGhost(x, y) {
    drag.x = x;
    drag.y = y;
    drag.ghost.style.left = `${x - drag.dx}px`;
    drag.ghost.style.top = `${y - drag.dy}px`;
    const over = targetAt(x, y);
    if (over !== drag.over) {
      drag.over?.classList.remove('drop-over');
      over?.classList.add('drop-over');
      drag.over = over;
    }
  }

  function finish(drop) {
    const { id, ghost, card, over } = drag;
    cancelAnimationFrame(drag.raf);
    ghost.remove();
    card.classList.remove('drag-source');
    over?.classList.remove('drop-over');
    document.body.classList.remove('scene-dragging');
    drag = null;
    // The release itself may produce a click (mouse): ignore only that one, so a
    // quick tap on a button right after the drop still works.
    droppedAt = performance.now();
    const target = over?.dataset.sceneDrop;
    if (drop && target && target !== card.closest('[data-scene-drop]')?.dataset.sceneDrop) onDrop(id, target);
  }

  const onDown = (e) => {
    if (drag || !enabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const card = e.target.closest('[data-photo-id]');
    if (!card || !root.contains(card)) return;
    press = { id: card.dataset.photoId, card, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    press.timer = setTimeout(begin, HOLD_MS);
  };
  const onMove = (e) => {
    if (drag) { e.preventDefault(); moveGhost(e.clientX, e.clientY); return; }
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE_PX) cancelPress();
  };
  const onUp = () => { if (drag) finish(true); else cancelPress(); };
  const onCancel = () => { if (drag) finish(false); else cancelPress(); };
  // Once lifted, the finger must not scroll the page (needs a non-passive listener).
  const onTouchMove = (e) => { if (drag) e.preventDefault(); };
  // No "open link / save image" menu on a long press, no native drag of the link.
  const onContext = (e) => { if (press || drag) e.preventDefault(); };
  const onNativeDrag = (e) => { if (e.target.closest?.('[data-photo-id]')) e.preventDefault(); };
  const onClick = (e) => {
    if (performance.now() - droppedAt < CLICK_AFTER_DROP_MS) { e.preventDefault(); e.stopPropagation(); }
  };
  const onKey = (e) => { if (e.key === 'Escape' && drag) finish(false); };

  root.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  root.addEventListener('contextmenu', onContext);
  root.addEventListener('dragstart', onNativeDrag);
  root.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey);
  return () => {
    cancelPress();
    if (drag) finish(false);
    root.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('touchmove', onTouchMove);
    root.removeEventListener('contextmenu', onContext);
    root.removeEventListener('dragstart', onNativeDrag);
    root.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey);
  };
}
