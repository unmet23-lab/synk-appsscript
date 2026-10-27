/** 「그동안 달라진 것」 on the screen (vertical slice design §10-2, W6b): when a visit begins and the settlement left something
 * the residents did since the player's last play, one board shows it once — the first line large, the rest in a list the
 * player opens. The host chose the lines (town/meanwhile.mjs — at most three, one a resident) and keeps them for the whole
 * visit (view.day.scene.village.meanwhile); this module only words and draws them, once a visit in this window, and counts a
 * line as seen only once it really stood in sight (§20-2). Nothing here says how long the player was away (G3): the lines
 * carry no period words (the lines check), and an empty settlement shows no board at all.
 * Screen-only module. Its look is day-meanwhile.css, linked from here, so a browser still holding an older day.html for the
 * cache's ten minutes simply shows no board.
 */
import { NAMES, lineText, iconSvg } from './day-cards.mjs';

/** Each frame's picture (the mood lines' pictures): the tray shim, the observation board, the day's tea, the new tea, the
 * player's own spot, the pair's small difference. */
export const FRAME_ICONS = Object.freeze({ tray: 'wobble', board: 'board', 'today-tea': 'leaf', 'new-tea': 'menu', habit: 'seat', pair: 'together' });
/** A visit begun this long before the window's first pulse was another window's arrival (design review F1 — W6a closes the
 * question; the screen does not show a board that belonged to an earlier window of a long visit). */
export const STALE_MS = 30 * 60 * 1000;
const SEEN_AFTER_MS = 1200;

const frameOf = id => /^village\.changes\.([a-z-]+)\.\d+$/.exec(id || '')?.[1] ?? null;
const fill = (text, line) => text.replace(/\{npc\}/g, NAMES[line.npc] || '').replace(/\{npc2\}/g, NAMES[line.npc2] || '');

/** The board's lines for meanwhile = { visit, lines: [{ id, npc, npc2? }] } — the words filled with the residents' role
 * names — or null when there is nothing to show (no lines, words this browser does not have yet, an earlier window's visit). */
export function meanwhileModel(meanwhile, { firstPulseAt = null } = {}) {
  if (!meanwhile || !Number.isSafeInteger(meanwhile.visit) || !Array.isArray(meanwhile.lines)) return null;
  if (Number.isSafeInteger(firstPulseAt) && meanwhile.visit < firstPulseAt - STALE_MS) return null;
  const lines = meanwhile.lines.map(line => {
    const frame = frameOf(line?.id), text = frame ? lineText(line.id) : null;
    return text ? { id: line.id, frame, icon: FRAME_ICONS[frame] || 'sparkle', text: fill(text, line) } : null;
  }).filter(Boolean);
  return lines.length ? { visit: meanwhile.visit, lines } : null;
}

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

/** The board in host (the notices over the scene). update({ meanwhile, firstPulseAt, blocked }) each frame: it shows the
 * visit's board unless this window already showed and closed it, hides it while blocked (a panel, a dialog, the seat), and
 * reports each line that stood in sight a moment through onSeen(keys, occurrence). */
export function createMeanwhile(host, { live, onSeen = () => {} } = {}) {
  if (!host) return { update: () => ({ shown: false }), metrics: () => null };
  if (!document.querySelector('link[data-meanwhile-style]')) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('./day-meanwhile.css', import.meta.url).href });
    link.dataset.meanwhileStyle = ''; document.head.append(link);
  }
  const card = el('section', 'meanwhile-card'); card.id = 'meanwhile-card'; card.hidden = true; card.setAttribute('aria-labelledby', 'meanwhile-title');
  const title = el('p', 'eyebrow meanwhile-title', '그동안 달라진 것'); title.id = 'meanwhile-title';
  const first = el('p', 'meanwhile-first'), rest = el('ul', 'meanwhile-rest'); rest.hidden = true; rest.id = 'meanwhile-rest';
  const more = el('button', 'text-button meanwhile-more', '더 보기'); more.type = 'button'; more.setAttribute('aria-controls', 'meanwhile-rest'); more.setAttribute('aria-expanded', 'false');
  const close = el('button', 'felt subtle meanwhile-close', '닫기'); close.type = 'button';
  const foot = el('div', 'meanwhile-foot'); foot.append(more, close);
  card.append(title, first, rest, foot); host.append(card);
  // What this window did with each visit's board: shown (drawn once) and closed. Window memory only — the next window of a
  // long visit shows it again unless the visit began more than STALE_MS before that window's first pulse.
  let model = null, drawn = '', opened = false, announced = null;
  const closed = new Set(), seenSince = new Map();
  more.addEventListener('click', () => { opened = !opened; paint(); });
  close.addEventListener('click', () => { if (model) closed.add(model.visit); card.hidden = true; seenSince.clear(); });
  card.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close.click(); } });
  const line = item => { const row = el('span', 'meanwhile-line'); const icon = el('span', 'meanwhile-icon'); icon.innerHTML = iconSvg(item.icon); row.append(icon, el('span', '', item.text)); row.dataset.line = item.id; return row; };
  function paint() {
    const sig = JSON.stringify([model?.visit, model?.lines.map(l => [l.id, l.text]), opened]);
    if (sig === drawn) return; drawn = sig;
    first.replaceChildren(line(model.lines[0]));
    rest.replaceChildren(...model.lines.slice(1).map(item => { const li = el('li'); li.append(line(item)); return li; }));
    more.hidden = model.lines.length < 2; rest.hidden = !opened || model.lines.length < 2;
    more.textContent = opened ? '접기' : '더 보기'; more.setAttribute('aria-expanded', String(opened));
  }
  /** A line counts as seen once it stood wholly in the window and the board a moment (§20-2). */
  function inSight(node, now) {
    const r = node.getBoundingClientRect(), box = card.getBoundingClientRect(), key = node.dataset.line;
    const whole = r.height > 0 && r.top >= Math.max(0, box.top) - 1 && r.bottom <= Math.min(innerHeight, box.bottom) + 1 && r.left >= 0 && r.right <= innerWidth + 1;
    if (!whole) { seenSince.delete(key); return false; }
    if (!seenSince.has(key)) seenSince.set(key, now);
    return now - seenSince.get(key) >= SEEN_AFTER_MS;
  }
  function update({ meanwhile, firstPulseAt = null, blocked = false, now = performance.now() } = {}) {
    model = meanwhileModel(meanwhile, { firstPulseAt });
    const shown = !!model && !closed.has(model.visit) && !blocked && !document.hidden;
    if (!shown) { if (!card.hidden) card.hidden = true; seenSince.clear(); return { shown: false }; }
    if (announced !== model.visit) { announced = model.visit; opened = false; if (live) live.textContent = `그동안 달라진 것: ${model.lines[0].text}`; }
    paint(); if (card.hidden) card.hidden = false;
    for (const node of card.querySelectorAll('.meanwhile-line')) if (!node.closest('[hidden]') && inSight(node, now)) onSeen([`line:${node.dataset.line}`], `meanwhile:${model.visit}`);
    return { shown: true };
  }
  return { update, metrics: () => (card.hidden ? null : { visit: model?.visit ?? null, lines: [...card.querySelectorAll('.meanwhile-line')].filter(n => !n.closest('[hidden]')).map(n => n.dataset.line), opened, rect: card.getBoundingClientRect().toJSON() }) };
}
