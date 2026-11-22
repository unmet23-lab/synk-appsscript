/** Draws 체험 기록 한 장 on A4 canvases (200 dpi). Any 2D context works, so the layout is checked
 * in Node with a measuring context. The same recordLines() rows feed the on-screen paper.
 * A usual record is one sheet. The body first shrinks a little; if the learner wrote so much that
 * it still does not fit, it continues on a second sheet instead of becoming too small to read. */
export const SHEET = Object.freeze({ width: 1654, height: 2339, margin: 130 });
export const SHEET_FONT = '"PATH Sans UI", "PATH Sans Rest", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif';
const INK = '#16181C', SOFT = '#5B5F66', LINE = '#C9C6BC', PAPER = '#FFFFFF', GREEN = '#526956';
const SCALES = Object.freeze([1, 0.92, 0.85]);

// Split by what a reader sees as one letter, so combining marks and emoji never break apart.
const letters = typeof Intl !== 'undefined' && Intl.Segmenter
  ? (word) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word), (part) => part.segment)
  : (word) => Array.from(word);

/** Breaks at spaces when it can and inside a word when it must, so no row leaves the page. */
export function wrapText(context, text, maxWidth) {
  const rows = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let row = '';
    for (const word of paragraph.split(' ')) {
      const candidate = row ? `${row} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) { row = candidate; continue; }
      if (row) rows.push(row);
      row = '';
      for (const letter of letters(word)) {
        if (row && context.measureText(row + letter).width > maxWidth) { rows.push(row); row = ''; }
        row += letter;
      }
    }
    rows.push(row);
  }
  return rows;
}

function compose(context, lines, scale, limit) {
  const { width, margin } = SHEET, inner = width - margin * 2;
  const size = (value) => Math.round(value * scale);
  const pages = [[]];
  let y = margin;
  const font = (px, weight) => `${weight} ${size(px)}px ${SHEET_FONT}`;
  const step = (px, leading) => Math.round(size(px) * leading);
  const rect = (x, top, w, h, color) => pages.at(-1).push({ rect: [x, top, w, h], color });
  function turn() {
    pages.push([]); y = margin;
    put(`${lines.heading} (이어서)`, 28, 600, SOFT); y += size(8);
    rect(margin, y, inner, 2, LINE); y += size(28);
  }
  function put(value, px, weight, color, { x = margin, maxWidth = inner, leading = 1.5, bullet = false } = {}) {
    context.font = font(px, weight);
    const rows = wrapText(context, value, maxWidth), height = step(px, leading);
    rows.forEach((row, index) => {
      if (y + height > limit && pages.at(-1).length) turn();
      if (bullet && index === 0) rect(margin + 6, y + size(17), size(10), size(10), GREEN);
      pages.at(-1).push({ text: row, x, y, font: font(px, weight), color });
      y += height;
    });
  }
  rect(margin, y, 96, 12, GREEN); y += 40;
  put('SYNK PATH · 일터 체험', 28, 600, SOFT); y += size(10);
  put(lines.heading, 64, 800, INK, { leading: 1.25 }); y += size(8);
  put(lines.edition, 30, 600, SOFT); y += size(24);
  rect(margin, y, inner, 3, INK); y += size(28);
  put(lines.meta.join('   ·   '), 30, 500, INK); y += size(24);
  rect(margin, y, inner, 2, LINE); y += size(40);
  for (const section of lines.sections) {
    // A section title never sits alone at the foot of a sheet.
    if (y + step(34, 1.5) + size(8) + step(30, 1.55) > limit) turn();
    put(section.title, 34, 800, INK); y += size(8);
    for (const row of section.rows) { put(row, 30, 500, INK, { x: margin + 40, maxWidth: inner - 40, leading: 1.55, bullet: true }); y += size(4); }
    y += size(30);
  }
  return pages;
}

/** Decide the scale and the sheets once; paintRecordSheet() then draws any one of them. */
export function planRecordSheet(context, lines) {
  const { height, margin, width } = SHEET, inner = width - margin * 2;
  const serialY = height - margin - 40, cutY = serialY - 50;
  context.font = `500 26px ${SHEET_FONT}`;
  const noticeRows = lines.notice.flatMap((value) => wrapText(context, value, inner));
  const noticeTop = cutY - 36 - noticeRows.length * 42, limit = noticeTop - 24;
  let scale = SCALES.at(-1), pages = null;
  for (const candidate of SCALES) {
    const tried = compose(context, lines, candidate, limit);
    if (tried.length === 1) { scale = candidate; pages = tried; break; }
  }
  pages ||= compose(context, lines, scale, limit);
  return { scale, pages, noticeRows, noticeTop, cutY, serialY, limit };
}

export function paintRecordSheet(context, plan, lines, pageIndex = 0) {
  const { width, height, margin } = SHEET;
  context.textBaseline = 'top'; context.textAlign = 'left';
  context.fillStyle = PAPER; context.fillRect(0, 0, width, height);
  for (const item of plan.pages[pageIndex] || []) {
    context.fillStyle = item.color;
    if (item.rect) context.fillRect(...item.rect);
    else { context.font = item.font; context.fillText(item.text, item.x, item.y); }
  }
  // Foot on every sheet: the fixed notice above a cut line, the record number below it.
  context.font = `500 26px ${SHEET_FONT}`; context.fillStyle = SOFT;
  plan.noticeRows.forEach((row, index) => context.fillText(row, margin, plan.noticeTop + index * 42));
  context.fillStyle = LINE;
  for (let x = margin; x < width - margin; x += 28) context.fillRect(x, plan.cutY, 16, 2);
  context.font = `600 26px ${SHEET_FONT}`; context.fillStyle = INK;
  context.fillText(lines.serial, margin, plan.serialY);
  context.textAlign = 'right'; context.fillStyle = SOFT;
  context.fillText(plan.pages.length > 1 ? `synk.im/path/workday · ${pageIndex + 1}/${plan.pages.length}` : 'synk.im/path/workday', width - margin, plan.serialY);
  context.textAlign = 'left';
}

/** Every text the sheet may draw, for loading fonts before the canvas is painted. */
export function sheetText(lines) {
  return [lines.heading, lines.edition, ...lines.meta, ...lines.sections.flatMap((section) => [section.title, ...section.rows]), ...lines.notice, lines.serial, '(이어서) synk.im/path/workday 0123456789/·'].join(' ');
}
