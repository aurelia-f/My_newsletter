// ============================================================
//  ARRANGING A PAGE BY HAND
//
//  The old editor used the HTML5 drag-and-drop API
//  (`draggable`, `dragstart`): it does not work with a finger on
//  a telephone, and it only ever moved a node in a list — the
//  browser still decided where things ended up.
//
//  Here it is POINTER EVENTS (mouse, finger and stylus alike)
//  and the person decides: each piece keeps the box she gives
//  it. Nothing is pushed by its neighbour, nothing is realigned.
//
//  Three rules, which are hers:
//    - a light magnet: within six pixels of a neighbour's edge,
//      the box lines up on it;
//    - overlapping is allowed, but flagged — never prevented;
//    - no automatic shrinking: what goes past the bottom of the
//      sheet goes onto the next sheet, under a grey rule.
//
//  Units, as in `pieces.js`: `x` and `w` are a share of the
//  sheet's width (%), `y` and `h` are pixels of the A4 body.
// ============================================================
import { ref, computed } from 'vue';

const MAGNET = 6;      // px — how close before it lines up
const MIN_WIDTH = 8;   // %
const MIN_HEIGHT = 40; // px
const STEP = 4;        // px — one press of an arrow key

/**
 * @param {Ref<Array>} pieces  the pieces, each with its `box`
 * @param {Function} canvasEl  () => the `.np-canvas` element
 * @param {Function} limit     () => the usable height of the
 *   sheet, in px. NOTHING may be placed below it: the sheet is
 *   an A4 and stays an A4, so a box pushed past the bottom edge
 *   would not be printed at all. The gesture stops at the edge
 *   rather than letting her lose a block without knowing.
 */
export function useArrange(pieces, canvasEl, limit = () => 0) {
  const chosenId = ref('');
  const draggingId = ref('');
  const changed = ref(false);

  let mode = '';            // 'move' or 'resize'
  let fromX = 0, fromY = 0; // where the pointer started
  let fromBox = null;       // the box before the gesture
  let width = 794;          // the canvas, in pixels

  const chosen = computed(() => pieces.value.find(p => p.id === chosenId.value));

  // ----------------------------------------------------------
  //  Overlapping: flagged, never prevented.
  // ----------------------------------------------------------
  const overlapping = computed(() => {
    const flagged = new Set();
    const list = pieces.value;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (hit(list[i].box, list[j].box)) {
          flagged.add(list[i].id);
          flagged.add(list[j].id);
        }
      }
    }
    return flagged;
  });

  function hit(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w
        && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // ----------------------------------------------------------
  //  The gesture
  // ----------------------------------------------------------
  function grab(id, event, how = 'move') {
    const piece = pieces.value.find(p => p.id === id);
    if (!piece || event.button > 0) return;

    chosenId.value = id;
    draggingId.value = id;
    mode = how;
    fromX = event.clientX;
    fromY = event.clientY;
    fromBox = { ...piece.box };
    width = canvasEl()?.clientWidth || 794;

    event.preventDefault();
    event.stopPropagation();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onMove(event) {
    const piece = pieces.value.find(p => p.id === draggingId.value);
    if (!piece || !fromBox) return;

    const dx = ((event.clientX - fromX) / width) * 100;  // in %
    const dy = event.clientY - fromY;                    // in px

    piece.box = mode === 'resize'
      ? resized(fromBox, dx, dy)
      : moved(fromBox, dx, dy);

    magnetise(piece);
  }

  function onUp() {
    if (draggingId.value) changed.value = true;
    draggingId.value = '';
    fromBox = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  function moved(box, dx, dy) {
    const floor = limit();
    const highest = floor ? Math.max(0, floor - box.h) : Infinity;
    return {
      ...box,
      x: round(clamp(box.x + dx, 0, 100 - box.w)),
      y: clamp(Math.round(box.y + dy), 0, highest)
    };
  }

  function resized(box, dx, dy) {
    const floor = limit();
    const tallest = floor ? Math.max(MIN_HEIGHT, floor - box.y) : Infinity;
    return {
      ...box,
      w: round(clamp(box.w + dx, MIN_WIDTH, 100 - box.x)),
      h: clamp(Math.round(box.h + dy), MIN_HEIGHT, tallest)
    };
  }

  // ----------------------------------------------------------
  //  The light magnet
  //  The edges of the OTHER pieces, plus the three verticals of
  //  the sheet, are what a box lines up on.
  // ----------------------------------------------------------
  function magnetise(piece) {
    const pull = (MAGNET / width) * 100;   // the radius, in %
    const verticals = [0, 50, 100];
    const horizontals = [0];
    if (limit()) horizontals.push(limit());   // the bottom of the A4

    for (const other of pieces.value) {
      if (other.id === piece.id) continue;
      verticals.push(other.box.x, other.box.x + other.box.w);
      horizontals.push(other.box.y, other.box.y + other.box.h);
    }

    const box = { ...piece.box };

    if (mode === 'resize') {
      const right = nearest(box.x + box.w, verticals, pull);
      if (right !== null) box.w = round(clamp(right - box.x, MIN_WIDTH, 100 - box.x));

      const bottom = nearest(box.y + box.h, horizontals, MAGNET);
      if (bottom !== null) box.h = clamp(bottom - box.y, MIN_HEIGHT,
        limit() ? Math.max(MIN_HEIGHT, limit() - box.y) : Infinity);
    } else {
      const left = nearest(box.x, verticals, pull);
      if (left !== null) box.x = round(clamp(left, 0, 100 - box.w));

      const top = nearest(box.y, horizontals, MAGNET);
      if (top !== null) {
        box.y = clamp(top, 0,
          limit() ? Math.max(0, limit() - box.h) : Infinity);
      }
    }

    piece.box = box;
  }

  function nearest(value, candidates, radius) {
    let best = null, gap = radius;
    for (const c of candidates) {
      const d = Math.abs(c - value);
      if (d <= gap) { gap = d; best = c; }
    }
    return best;
  }

  // ----------------------------------------------------------
  //  The keyboard: for the last four pixels
  // ----------------------------------------------------------
  function nudge(event) {
    const piece = chosen.value;
    if (!piece) return;

    const moves = {
      ArrowLeft:  { dx: -STEP, dy: 0 },
      ArrowRight: { dx:  STEP, dy: 0 },
      ArrowUp:    { dx: 0, dy: -STEP },
      ArrowDown:  { dx: 0, dy:  STEP }
    };
    const m = moves[event.key];
    if (!m) return;

    event.preventDefault();
    width = canvasEl()?.clientWidth || 794;
    const dx = (m.dx / width) * 100;

    piece.box = event.shiftKey
      ? resized(piece.box, dx, m.dy)
      : moved(piece.box, dx, m.dy);

    changed.value = true;
  }

  // ----------------------------------------------------------
  //  The size of the text inside one piece
  //  The stylesheet reads `--np-text`; photos are left alone.
  // ----------------------------------------------------------
  function scaleText(by) {
    const piece = chosen.value;
    if (!piece) return;
    const now = piece.box.text ?? 1;
    piece.box = { ...piece.box, text: round(clamp(now + by, 0.7, 1.6)) };
    changed.value = true;
  }

  function choose(id) { chosenId.value = id; }
  function forget() { chosenId.value = ''; }
  function saved() { changed.value = false; }

  function stop() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  return { chosenId, chosen, draggingId, overlapping, changed,
           grab, nudge, scaleText, choose, forget, saved, stop };
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function round(v) { return Math.round(v * 100) / 100; }