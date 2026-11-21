/** Desk panel for the seated Quest view: a paper card that lies on the desk, never a head-locked
 * overlay. The page decides what it says (view.title, view.buttons); this file only lays the
 * buttons out, paints them and answers which one a controller ray hit. Any 2D context works. */
export const HUD = Object.freeze({ width: 1536, height: 720, metersWide: 1.1 });
// The families workday.css loads. The page waits for them (document.fonts.load) before the first paint.
export const CANVAS_FONT = '"PATH Sans UI", "PATH Sans Rest", system-ui, sans-serif';
const FONT = CANVAS_FONT;
const MAIN = Object.freeze({ top: 300, bottom: 612, gap: 12, left: 32, right: 1504 });
const SYSTEM = Object.freeze({ top: 632, height: 64, gap: 16, left: 32, right: 1504 });

/** view.buttons: [{ id, label, row: 'main' | 'system', primary?, pressed?, enabled? }].
 * Up to six main buttons (one column for three or fewer, two columns above) and four system ones. */
export function layoutHudButtons(buttons = []) {
  const main = buttons.filter((button) => button.row !== 'system').slice(0, 6);
  const system = buttons.filter((button) => button.row === 'system').slice(0, 4);
  const columns = main.length > 3 ? 2 : 1, rows = Math.ceil(main.length / columns) || 1;
  const width = (MAIN.right - MAIN.left - MAIN.gap * (columns - 1)) / columns;
  const height = Math.min(104, (MAIN.bottom - MAIN.top - MAIN.gap * (rows - 1)) / rows);
  const placed = main.map((button, index) => ({ ...button, x: MAIN.left + (index % columns) * (width + MAIN.gap), y: MAIN.top + Math.floor(index / columns) * (height + MAIN.gap), w: width, h: height }));
  const systemWidth = system.length ? (SYSTEM.right - SYSTEM.left - SYSTEM.gap * (system.length - 1)) / system.length : 0;
  system.forEach((button, index) => placed.push({ ...button, x: SYSTEM.left + index * (systemWidth + SYSTEM.gap), y: SYSTEM.top, w: systemWidth, h: SYSTEM.height }));
  return placed;
}

/** uv has its origin at the lower-left corner of the panel, as a ray hit reports it. */
export function pickHudButton(uv, buttons = []) {
  if (!uv || !Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return null;
  const x = uv.x * HUD.width, y = (1 - uv.y) * HUD.height;
  const hit = layoutHudButtons(buttons).find((button) => x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h);
  return hit && hit.enabled !== false ? hit.id : null;
}

function rows(context, text, maxWidth, maxRows) {
  const out = []; let row = '';
  for (const character of String(text || '')) {
    if (character === '\n' || (row && context.measureText(row + character).width > maxWidth)) { out.push(row); row = character === '\n' ? '' : character; if (out.length === maxRows) break; continue; }
    row += character;
  }
  if (out.length < maxRows && row) out.push(row);
  // Mark a cut text instead of dropping its end without a sign.
  if (out.length === maxRows && out.join('').length < String(text || '').replace(/\n/g, '').length) out[maxRows - 1] = `${out[maxRows - 1].slice(0, -1)}…`;
  return out;
}

export function paintHud(context, view = {}) {
  const buttons = layoutHudButtons(view.buttons);
  const pill = (x, y, w, h, fill, stroke, radius = Math.min(h, w) / 2) => {
    context.beginPath();
    if (typeof context.roundRect === 'function') context.roundRect(x, y, w, h, radius); else context.rect(x, y, w, h);
    if (fill) { context.fillStyle = fill; context.fill(); }
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = 2; context.stroke(); }
  };
  context.fillStyle = '#EDEDEB'; context.fillRect(0, 0, HUD.width, HUD.height);
  context.textAlign = 'left'; context.textBaseline = 'top';
  // Status: one filled dot and a line of text. The time is a number that does not blink.
  context.fillStyle = view.dot || '#8A8F98'; context.beginPath(); context.arc(46, 42, 8, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#5B5F66'; context.font = `600 28px ${FONT}`;
  context.fillText(String(view.status || ''), 66, 26, 1000);
  if (view.corner) { context.textAlign = 'right'; context.fillText(String(view.corner), HUD.width - 36, 26, 420); context.textAlign = 'left'; }
  context.fillStyle = '#08090C'; context.font = `700 40px ${FONT}`;
  const titleRows = rows(context, view.title, 1464, 3);
  titleRows.forEach((row, index) => context.fillText(row, 36, 78 + index * 52));
  context.fillStyle = '#4A4E55'; context.font = `500 30px ${FONT}`;
  rows(context, view.body, 1464, Math.max(1, 4 - titleRows.length)).forEach((row, index) => context.fillText(row, 36, 86 + titleRows.length * 52 + index * 40));
  for (const button of buttons) {
    const system = button.row === 'system', off = button.enabled === false;
    const radius = system ? button.h / 2 : 26;
    if (off) pill(button.x, button.y, button.w, button.h, '#E3E3E1', null, radius);
    else if (button.primary) pill(button.x, button.y, button.w, button.h, '#526956', null, radius);
    // Every button is a filled shape: no outline-only pill reads as a ring.
    else if (button.pressed) pill(button.x, button.y, button.w, button.h, '#BFD9A6', null, radius);
    else if (system) pill(button.x, button.y, button.w, button.h, '#D4D4D2', null, radius);
    else pill(button.x, button.y, button.w, button.h, '#DCDCDA', null, radius);
    context.fillStyle = off ? '#A3A6AB' : button.primary ? '#FFFFFF' : '#08090C';
    context.font = `700 ${system ? 28 : 32}px ${FONT}`; context.textAlign = 'center';
    const labelRows = rows(context, button.label, button.w - 44, system || button.h < 84 ? 1 : 2);
    const lineHeight = system ? 34 : 40, top = button.y + (button.h - labelRows.length * lineHeight) / 2 + 3;
    labelRows.forEach((row, index) => context.fillText(row, button.x + button.w / 2, top + index * lineHeight));
    context.textAlign = 'left';
  }
}

/** Repaint only when something shown changes: the canvas upload is the costly part in a headset. */
export function hudKey(view = {}) {
  return JSON.stringify([view.status, view.dot, view.corner, view.title, view.body, (view.buttons || []).map((button) => [button.id, button.label, button.row, !!button.primary, !!button.pressed, button.enabled !== false])]);
}
