// ============================================================
//  THE PIECES OF A PAGE
//
//  The old site had to CONVERT. The template's HTML already
//  existed in the page, so `enGrille()` went hunting for each
//  bit with querySelector, wrapped it in a box, emptied the
//  body and glued the boxes back in flat. The ids had to be
//  invented from the titles, because the HTML had none.
//
//  Here nothing is converted. A piece is a piece of DATA, read
//  straight from the entry, and every piece already carries a
//  stable id of its own (the question's id). The two renderings
//  — the template (Newspaper.vue) and the free canvas
//  (NewspaperCanvas.vue) — are two VIEWS of the same list.
//  No DOM surgery, no innerHTML, no slug made out of a title.
// ============================================================

// A4 at 96 dpi, the sheet the newspaper is printed on.
export const SHEET_WIDTH = 794;
export const SHEET_HEIGHT = 1123;

// The size a piece is given when nobody has arranged the page
// yet. Widths as a share of the sheet (%), heights in pixels:
// a page runs onto several sheets, so there is no total height
// to be a percentage of.
const DEFAULT_BOX = {
  photo:      { w: 50,    h: 260 },
  standfirst: { w: 50,    h: 120 },
  quote:      { w: 100,   h: 90  },
  block:      { w: 33.33, h: 160 },
  asked:      { w: 33.33, h: 160 },
  gallery:    { w: 100,   h: 210 }
};

// The sections already shown elsewhere on the page.
const USED = new Set(['summary', 'photos', 'cover_photo']);

// The question types that are rendered inside a frame.
const FRAMED = new Set(['choice', 'emojis', 'word', 'rating', 'slider']);

export function filled(v) {
  return !(v == null || v === '' || (Array.isArray(v) && !v.length));
}

export function asArray(v) {
  return Array.isArray(v) ? v : [v];
}

export function stars(v) {
  const n = Math.max(0, Math.min(5, Number(v) || 0));
  return { full: '★'.repeat(n), empty: '★'.repeat(5 - n) };
}

export function percent(question, v) {
  const min = question.min ?? 0;
  const max = question.max ?? 10;
  return Math.round(((Number(v) - min) / (max - min)) * 100);
}

/** Turns a Spotify or YouTube link into an embedded player. */
export function player(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (u.hostname.includes('spotify')) {
      return { kind: 'spotify', src: 'https://open.spotify.com/embed' +
        u.pathname.replace(/^\/(intl-[a-z]+\/)?/, '/') };
    }
    if (u.hostname.includes('youtu')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v');
      if (id && /^[\w-]{6,20}$/.test(id)) {
        return { kind: 'youtube', src: 'https://www.youtube.com/embed/' + id };
      }
    }
    return { kind: 'link', src: link };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
//  THE LIST
// ------------------------------------------------------------
/**
 * All the pieces of one page, in reading order.
 *
 * @param {Object} entry  the person's entry (content, media, author)
 * @param {Object} issue  the issue (questions, number, month)
 * @param {Array}  asked  the questions put by friends
 * @returns {Array} pieces, each `{ id, kind, ...payload }`
 */
export function piecesOf(entry, issue, asked = []) {
  const content = entry?.content || {};
  const media = entry?.media || [];
  const author = entry?.author || {};
  const images = media.filter(m => m.type !== 'video');

  const pieces = [];

  // 1. The photo of the month. The profile picture is the
  //    fallback. No photo at all and there is NO piece: an empty
  //    frame is not content, it is clutter in the way.
  const url = images[0]?.url || author.avatar_url || null;
  if (url) {
    pieces.push({
      id: 'photo',
      kind: 'photo',
      url,
      caption: [author.occupation, author.city].filter(Boolean).join(' · ')
        || `${author.first_name || 'A friend'}, this month`
    });
  }

  // 2. The standfirst.
  if (filled(content.summary)) {
    pieces.push({ id: 'summary', kind: 'standfirst', text: content.summary });
  }

  // 3. The quote.
  const quote = author.motto || content.win || '';
  if (filled(quote)) {
    pieces.push({ id: 'quote', kind: 'quote', text: quote });
  }

  // 4. The sections of the questionnaire. `question.id` is the
  //    stable id the old code had to manufacture.
  (issue?.questions || [])
    .filter(q => !USED.has(q.id) && filled(content[q.id]))
    .forEach(q => pieces.push({
      id: q.id,
      kind: 'block',
      question: q,
      value: content[q.id],
      label: content[q.id + '_label'] || q.label,
      link: content[q.id + '_link'],
      framed: FRAMED.has(q.type)
    }));

  // 5. The questions put by friends, with the answer.
  (asked || [])
    .filter(q => filled(content['q_' + q.id]))
    .forEach(q => pieces.push({
      id: 'q_' + q.id,
      kind: 'asked',
      text: q.text,
      value: content['q_' + q.id],
      byline: q.target_id
        ? `${q.author?.first_name || 'A friend'} asks her`
        : `${q.author?.first_name || 'A friend'} asks the group`
    }));

  // 6. The remaining photos and the videos.
  const skip = images.length && url === images[0]?.url ? 1 : 0;
  const gallery = media.slice(skip);
  if (gallery.length) {
    pieces.push({ id: 'gallery', kind: 'gallery', media: gallery });
  }

  return pieces;
}

// ------------------------------------------------------------
//  THE DEFAULT ARRANGEMENT
// ------------------------------------------------------------
/**
 * Gives every piece a box, by filling one shelf after another
 * from left to right. This is what the person sees the first
 * time she arranges her page: the same reading order, already
 * laid out, nothing on top of anything else.
 */
export function defaultBoxes(pieces) {
  let x = 0, y = 0, shelf = 0;

  return pieces.map(p => {
    const size = DEFAULT_BOX[p.kind] || DEFAULT_BOX.block;

    // Not enough room left on this shelf: start a new one.
    if (x > 0 && x + size.w > 100.5) {
      y += shelf;
      x = 0;
      shelf = 0;
    }

    const box = { x: round(x), y, w: size.w, h: size.h, text: 1 };
    x += size.w;
    shelf = Math.max(shelf, size.h + 14);   // 14 px of gutter

    return { ...p, box };
  });
}

/**
 * Squeezes an arrangement into ONE sheet.
 *
 * The sheet is an A4 and stays an A4: nothing is allowed to sit
 * below its bottom edge, because what is below it would simply
 * not be printed. So the first time a page is laid out — and
 * whenever what comes back from the database is too tall — every
 * box is brought up and shortened by the same factor. The words
 * inside are untouched: that is what A− and A+ are for.
 *
 * @param {Array} pieces  pieces that already have a `box`
 * @param {Number} limit  the usable height of the sheet, in px
 */
export function fitInto(pieces, limit) {
  if (!limit || !pieces.length) return pieces;

  const low = pieces.reduce((b, p) => Math.max(b, p.box.y + p.box.h), 0);
  if (low <= limit) return pieces;

  const k = limit / low;
  return pieces.map(p => ({
    ...p,
    box: {
      ...p.box,
      y: Math.round(p.box.y * k),
      h: Math.max(40, Math.round(p.box.h * k))
    }
  }));
}

// ------------------------------------------------------------
//  READING BACK A SAVED ARRANGEMENT
// ------------------------------------------------------------
/**
 * Marries the pieces of THIS month with the arrangement saved
 * LAST month. Two things matter, and neither is a detail:
 *
 *  - a saved box whose piece no longer exists (a question
 *    dropped, a photo removed) is ignored, silently;
 *  - a piece with no saved box (a new question this month) is
 *    not lost: it is stacked underneath, where it can be seen
 *    and moved, rather than disappearing.
 *
 * @param {Array} pieces  from `piecesOf()`
 * @param {Object} layout `entry.layout` — `{ free, cells }`
 */
export function mergeLayout(pieces, layout) {
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  if (!cells.length) return defaultBoxes(pieces);

  const byId = new Map(pieces.map(p => [p.id, p]));
  const placed = [];
  const seen = new Set();

  for (const cell of cells) {
    const piece = byId.get(cell.id);
    if (!piece || seen.has(cell.id)) continue;   // gone, or a duplicate
    seen.add(cell.id);
    placed.push({ ...piece, box: sane(cell) });
  }

  // What is new this month goes underneath, in reading order.
  const newcomers = pieces.filter(p => !seen.has(p.id));
  if (newcomers.length) {
    const bottom = placed.reduce((b, p) => Math.max(b, p.box.y + p.box.h), 0);
    defaultBoxes(newcomers).forEach(p => {
      placed.push({ ...p, box: { ...p.box, y: p.box.y + bottom + 20 } });
    });
  }

  return placed;
}

/** What comes out of the database is not to be trusted blindly. */
function sane(cell) {
  const w = clamp(Number(cell.w) || DEFAULT_BOX.block.w, 5, 100);
  return {
    x: round(clamp(Number(cell.x) || 0, 0, 100 - w)),
    y: Math.max(0, Math.round(Number(cell.y) || 0)),
    w: round(w),
    h: clamp(Math.round(Number(cell.h) || DEFAULT_BOX.block.h), 40, 4000),
    text: clamp(Number(cell.text) || 1, 0.7, 1.6)
  };
}

/** The shape to save: the boxes, and nothing but the boxes.
 *  `text` is the size of the words inside a piece (the A− / A+
 *  buttons); the photos ignore it, the stylesheet sees to that. */
export function toLayout(pieces) {
  return {
    free: true,
    cells: pieces.map(p => ({ id: p.id, ...p.box }))
  };
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function round(v) { return Math.round(v * 100) / 100; }