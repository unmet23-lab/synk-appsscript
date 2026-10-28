/** The gathering board (vertical slice W8b, design §20-8 · W8b note §2-8 · §2-9 · design review F3 · F9): a small sparkle
 * over each of the player's three spots where something grows now (within a few steps of it), 「E · 잎 따기」 in the right
 * column by one, and the board under the scene — one branch with three or four leaves, where the bright young ones are
 * what is left today (leaves, never a number — G2) and the dark ones only sway. A young leaf pressed flies to the basket at
 * once with a short 「톡」 a step higher each leaf, the basket gives back a soft 「폭」, the branch rustles once when it is
 * bare; the server confirms each pick (GATHER_PICK) behind it, and only a refusal of its own (too far, all picked, the
 * basket full) puts the leaf back, swaying, with no sound (nothing is wrong — 경제:479). Reduced motion or 「간단히 만들기」
 * shows 「바로 따기」 instead of the branch. Near the cafe owner, awake and standing, the basket's leaves are given to her
 * (GATHER_GIVE) and her word hangs over her head once. The hand's state is gather.mjs start/input/finish (run in node by
 * tests/town-gather.test.js); the words, the pictures and the moves are here, the look is day-gather.css. A browser holding
 * an older data.gen.mjs simply has no board.
 * Where the photo-background town comes (10-26) three things change: the sparkle's point (the 3D projection → the place
 * photo's mark), the approach (walking within reach → pressing the mark) and the owner's bubble (it keeps the 3D resident's
 * head). The board, the basket and the field book stay as they are.
 */
import { GATHER, GATHER_LINES, ITEM_BY_ID, start, input, finish, quickPick } from './town/activities/gather.mjs';
import { createTeaSfx } from './day-sfx.mjs';

// 「간단히 만들기」 on this device — the tea board's switch (day-tea.mjs SIMPLE_KEY), which gathering follows too (W8b §2-8).
export const SIMPLE_KEY = 'synk.world.town-tea-simple';

// Within OPEN_M of a spot the board can be opened; past CLOSE_M it folds by itself (the server picks within 1.6m — the
// walk it sees may lag the screen a little). The sparkles show within SHOW_M; leaves are given within GIVE_M of the owner
// (the server's 2.5m).
const OPEN_M = 1.2, CLOSE_M = 1.5, SHOW_M = 4, GIVE_M = 2.3;
const BUBBLE_MS = 4500, FOUND_MS = 1600, TOAST_MS = 2200, FLY_MS = 360;
// Where a spot's sparkle hangs over its plants (metres above the ground — the bed's leaves, the herb pot hung on the cafe's
// pier, the petals at the wall's foot).
const MARK_Y = Object.freeze({ 'greenhouse.bed-edge': .75, 'cafe.pots': 2.05, 'lane.wall': .3 });
// The town's own refusals: the leaf goes back (or the gift stays in the basket) and nothing is wrong with the connection.
export const REFUSALS = Object.freeze(['gather-too-far', 'gather-not-now', 'gather-done', 'gather-full', 'gather-spot', 'gather-item',
  'gather-owner-asleep', 'gather-owner-walking', 'gather-none']);
// Their words, the town's own (activities/gather.mjs). Through a WORLD account the error keeps only its code (the town's
// answer nests the words under error), so the board says these instead of the bare code (pub review).
const REFUSAL_WORDS = Object.freeze({ 'gather-spot': '딸 것을 다시 골라 주세요.', 'gather-too-far': '조금 더 가까이 가서 따 주세요.',
  'gather-not-now': '지금은 여기서 딸 것이 없어요.', 'gather-done': '여기는 오늘 다 땄어요.', 'gather-full': '바구니가 가득 찼어요.',
  'gather-item': '드릴 것을 다시 골라 주세요.', 'gather-owner-asleep': '찻집 주인은 지금 자고 있어요. 아침에 다시 만나요.',
  'gather-owner-walking': '찻집 주인이 자리에 닿으면 드려 주세요.', 'gather-none': '바구니에 그 잎이 없어요.' });
export const refusalWords = (type, code, message) => message && message !== code ? message
  : code === 'gather-too-far' && type === 'GATHER_GIVE' ? '찻집 주인 가까이 가서 드려 주세요.' : REFUSAL_WORDS[code] ?? message ?? null;
const LINES = new Map(GATHER_LINES.map(line => [line.id, line]));
const DARK = Object.freeze({ tea: '#56703f', pot: '#4f6b44', wall: '#4b6650' });
const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); node.append(...children.filter(c => c !== null && c !== undefined)); return node; };

/* ── words ── */
export const itemName = id => GATHER?.items?.[id]?.name ?? '';
export const spotLabel = id => GATHER?.spots?.[id]?.label ?? '';
/** A gathering line (lines/gather.json) at a level — the reading seat's stable L2 by default (§13-1). */
export const lineWords = (id, level = 'L2') => { const line = LINES.get(id); return line ? line.levels[level] ?? line.levels.L2 ?? null : null; };
/** 을/를 by the word's last syllable. */
export const object = word => { const code = String(word).trim().charCodeAt(String(word).trim().length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '을' : '를'; };
const verb = item => item === 'petal-rain' ? '줍기' : '따기';
const picked = item => `${itemName(item)}${object(itemName(item))} ${item === 'petal-rain' ? '주웠어요' : '땄어요'}.`;
/** The tea a gift made (the tea board's third jar shows it under 「오늘의 차」): 「박하차」, 「꽃잎을 띄운 국화차」 — or null. */
export function todayTeaWords(today) {
  if (!today || !GATHER) return null;
  const tea = today.tea ? GATHER.teas[today.tea]?.name ?? null : null;
  if (!tea && !today.petal) return null;
  return today.petal ? `${GATHER.petal.label} ${tea ?? '오늘의 차'}` : tea;
}
export const todayTeaColor = today => (today?.tea && GATHER?.teas?.[today.tea]?.color) || null;

/* ── what the screen reads of the view ── */
const distance = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity);
/** The nearest of the spots within reach of a point (metres), or null. */
export function nearestSpot(spots, point, within = OPEN_M) {
  let best = null, bestD = within;
  for (const spot of spots || []) { const d = distance(point, spot.at); if (d <= bestD) { best = spot; bestD = d; } }
  return best;
}
/** Whether something grows at a spot now and is left today. */
export const pickableNow = spot => !!spot?.items?.some(i => i.grows && i.left > 0);
/** The board's one line under the spot's name: none while something is left; when all is picked, where something still is
 * (no dead end — W8b note §2-15); when nothing grows now, when it does. Never a number or a time of day in figures. */
export function boardLine(spot, spots = []) {
  if (!spot || pickableNow(spot)) return '';
  const other = (spots || []).find(s => s.id !== spot.id && pickableNow(s));
  const elsewhere = other ? ` ${spotLabel(other.id)}에서 ${other.id === 'lane.wall' ? '주울' : '딸'} 수 있어요.` : '';
  if (spot.items.some(i => i.grows)) return `여기는 오늘 다 ${spot.id === 'lane.wall' ? '주웠어요' : '땄어요'}.${elsewhere}`;
  const hint = GATHER?.items?.[spot.items[0]?.item]?.hint;
  return `지금은 여기서 ${spot.id === 'lane.wall' ? '주울' : '딸'} 것이 없어요.${hint ? ` ${hint}.` : ''}${elsewhere}`;
}
/** The basket's pictures: each thing in it once, a second and third picture laid over it when there are more — never a
 * number (G2). */
export const basketPictures = basket => (basket || []).filter(b => ITEM_BY_ID.has(b.item) && b.qty > 0).flatMap(b => Array.from({ length: Math.min(3, b.qty) }, (_, i) => ({ item: b.item, layer: i })));
/** The field book's five cells (§20-8 도감): a thing gathered once shows its picture, name and line (L2); one not yet, its
 * silhouette and when it is found. No count, no share, no 「몇 개 모음」 (G2). */
export function bookCells(book) {
  const found = new Set(book || []);
  return Object.keys(GATHER?.items || {}).map(item => found.has(item)
    ? { item, found: true, name: itemName(item), text: lineWords(`village.gather.desc-${item}.1`) || '' }
    : { item, found: false, name: '아직 모르는 것', text: `${GATHER.items[item].hint}.` });
}
/** What the basket can give the jar in 「잎 통이 비어 가요」 (C3): the things that fill it (petals float on the tea instead). */
export function jarFillers(basket, relief = {}) {
  return (basket || []).filter(b => b.qty > 0 && ITEM_BY_ID.has(b.item) && (relief[b.item] ?? 0) > 0).map(b => b.item);
}

/* ── pictures (hand-drawn SVG: each leaf sways and flies by itself; felt stitches as a dashed vein) ── */
const SHAPES = {
  leaf: 'M24 4C37 12 38 31 24 44C10 31 11 12 24 4Z',
  dew: 'M24 4C37 12 38 31 24 44C10 31 11 12 24 4Z',
  mint: 'M24 5C39 9 41 29 24 43C7 29 9 9 24 5Z',
  petal: 'M24 13C20 6 10 9 12 20C14 30 24 41 24 41C24 41 34 30 36 20C38 9 28 6 24 13Z',
};
/** One thing's picture as SVG markup: its own shape and colour (gather.json look), a dark leaf, or the silhouette the field
 * book shows of a thing not yet found. */
export function itemPicture(item, { dark = false, plant = 'tea', silhouette = false } = {}) {
  const look = dark ? { shape: 'leaf', color: DARK[plant] || DARK.tea } : GATHER?.items?.[item]?.look || { shape: 'leaf', color: '#a6cf6b' };
  const fill = silhouette ? 'currentColor' : look.color, stitch = silhouette ? '' : 'stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-dasharray="2.4 2.6" stroke-linecap="round" fill="none"';
  let body;
  if (look.shape === 'flower') {
    const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="24" cy="12.5" rx="3.6" ry="9" transform="rotate(${i * 30} 24 24)"/>`).join('');
    body = `<g fill="${fill}"${silhouette ? '' : ' stroke="rgba(120,80,10,.25)" stroke-width=".8"'}>${petals}</g><circle cx="24" cy="24" r="5.6" fill="${silhouette ? 'currentColor' : '#c98d16'}"/>`
      + (silhouette ? '' : `<circle cx="24" cy="24" r="8.5" ${stitch}/>`);
  } else {
    body = `<path d="${SHAPES[look.shape] || SHAPES.leaf}" fill="${fill}"${silhouette ? '' : ' stroke="rgba(0,0,0,.2)" stroke-width="1"'}/>`;
    if (!silhouette) {
      body += look.shape === 'petal' ? `<path d="M24 17C22 24 23 31 24 36" ${stitch}/>` : `<path d="M24 9V39" ${stitch}/>`;
      if (look.shape === 'mint' || dark) body += `<path d="M24 18L16 13M24 26L15 21M24 18L32 13M24 26L33 21" ${stitch}/>`;
      if (look.shape === 'dew') body += '<circle cx="18.5" cy="21" r="3.1" fill="#eef8ff" opacity=".92"/><circle cx="29" cy="29.5" r="2.3" fill="#eef8ff" opacity=".85"/>';
    }
  }
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;
}
const BASKET_SVG = '<svg viewBox="0 0 96 64" aria-hidden="true" focusable="false"><path d="M10 26H86L77 58H19Z" fill="#b48857"/><path d="M14 34H82M17 44H79M20 53H76" stroke="#8e6a40" stroke-width="2" stroke-dasharray="4 3" fill="none"/>'
  + '<path d="M30 26L28 58M48 26V58M66 26L68 58" stroke="#9c7748" stroke-width="2" fill="none"/><rect x="6" y="20" width="84" height="9" rx="4.5" fill="#9a7146"/><path d="M10 24.5H86" stroke="rgba(255,255,255,.45)" stroke-width="1.4" stroke-dasharray="3 3"/></svg>';

/** Where a branch's leaves sit on the board (percent of its box): along the stem, above and below in turn. */
export function leafSpots(count) {
  const xs = count <= 3 ? [22, 50, 78] : [15, 38, 62, 85], ys = [30, 66, 28, 64];
  return Array.from({ length: count }, (_, i) => ({ x: xs[i], y: ys[i], side: i % 2 ? 1 : -1 }));
}
function branchSvg(count) {
  const spots = leafSpots(count), stemY = x => 58 - (x - 50) * .18;
  const stalks = spots.map(s => `<path d="M${s.x * 3.2} ${stemY(s.x) * 1.5} L${s.x * 3.2 + s.side * -4} ${s.y * 1.5 + (s.side < 0 ? 14 : -14)}" stroke="#7d5c3b" stroke-width="3" stroke-linecap="round"/>`).join('');
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 ${stemY(1) * 1.5 + 6}C80 ${stemY(25) * 1.5}, 220 ${stemY(70) * 1.5}, 316 ${stemY(99) * 1.5 - 4}" stroke="#7d5c3b" stroke-width="7" stroke-linecap="round" fill="none"/>`
    + `<path d="M8 ${stemY(1) * 1.5 + 4}C82 ${stemY(25) * 1.5 - 2}, 222 ${stemY(70) * 1.5 - 2}, 312 ${stemY(99) * 1.5 - 6}" stroke="rgba(255,255,255,.35)" stroke-width="1.4" stroke-dasharray="3 4" fill="none"/>${stalks}</svg>`;
}

const readSimple = reduced => { try { const raw = localStorage.getItem(SIMPLE_KEY); if (raw === 'true') return true; if (raw === 'false') return false; } catch {} return !!reduced; };

/**
 * The board. scene: the #scene element; hud: the walking HUD. command(type, payload) → Promise<{ ok, code, message, id }>
 * is the town's gathering command → Promise<{ ok, id, revision, code, message }> (day-app's own line — each in turn at the revision then, the walk sent first, a stale
 * revision sent again: design review F3); beforeCommand() sends the walk now; pointAt({x,y,z}) → a town point on the
 * scene's box (null off screen); labelAt(id) → a resident's head there. sfx: the tea board's sound player (one audio context).
 */
export function createGatherBoard({ scene, hud, command, beforeCommand = async () => {}, pointAt = () => null, labelAt = () => null, onInputMode = () => {}, sfx: shared = null, reduced = matchMedia('(prefers-reduced-motion: reduce)') }) {
  if (!scene || !GATHER) return null;
  if (!document.querySelector('link[data-gather-style]')) { const link = el('link', { rel: 'stylesheet', href: new URL('./day-gather.css', import.meta.url).href }); link.dataset.gatherStyle = ''; document.head.append(link); }
  const sfx = shared || createTeaSfx(), played = [];
  const sound = (name, opts) => { if (sfx.play(name, opts)) { played.push(name); if (played.length > 40) played.shift(); return true; } return false; };
  let gv = null, ctx = {}, nearId = null, hand = null, simple = false, disposed = false, opener = null, lastSig = '', lastAnnounce = '';
  let giveOpen = false, pending = [], quickBusy = false, giving = false, bubble = null, found = null, toast = null, withShown = null, lineNote = null, padPrev = {}, placedBoardH = -1;
  // The leaves still in the air: each goes into the basket's picture when it lands, not when it is pressed (pub review F3).
  let inAir = [];
  const timers = new Set(), flights = new Map();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!disposed) fn(); }, ms); timers.add(t); return t; };

  // The right column's gathering actions: 「E · 잎 따기」 by a spot, 「찻집 주인에게 드리기」 by the owner (W8b §2-8).
  const openButton = el('button', { type: 'button', id: 'gather-open', className: 'felt gather-open-walk', hidden: true });
  const giveButton = el('button', { type: 'button', id: 'gather-give', className: 'felt gather-give', hidden: true });
  giveButton.setAttribute('aria-keyshortcuts', 'G');
  const giveChoices = el('div', { className: 'gather-give-choices', hidden: true }); giveChoices.setAttribute('role', 'group'); giveChoices.setAttribute('aria-label', '찻집 주인에게 드릴 것');
  const actions = el('div', { className: 'gather-actions' }, giveChoices, giveButton, openButton);
  hud?.append(actions);
  openButton.addEventListener('click', event => { sfx.unlock(); opener = event.currentTarget; open(); });
  giveButton.addEventListener('click', () => { sfx.unlock(); giveStart(); });

  // Over the scene: the sparkles, the board, the owner's word, the field book's note.
  const marks = el('div', { className: 'gather-marks' });
  const markFor = new Map();
  for (const id of Object.keys(GATHER.spots)) {
    const mark = el('button', { type: 'button', className: 'gather-mark', hidden: true, tabIndex: -1 }, el('i'), el('i'));
    mark.dataset.spot = id; mark.setAttribute('aria-hidden', 'true');
    mark.addEventListener('click', () => { if (id === nearId && !hand) { sfx.unlock(); opener = null; open(); } });
    markFor.set(id, mark); marks.append(mark);
  }
  const live = el('p', { className: 'visually-hidden' }); live.setAttribute('aria-live', 'polite');
  const place = el('p', { className: 'gather-place' });
  const closeButton = el('button', { type: 'button', className: 'gather-close', textContent: '닫기' }); closeButton.setAttribute('aria-keyshortcuts', 'Escape');
  const line = el('p', { className: 'gather-line' });
  const basketBox = el('div', { className: 'gather-basket' }); basketBox.innerHTML = BASKET_SVG;
  const basketLeaves = el('div', { className: 'gather-basket-leaves' }); basketBox.append(basketLeaves); basketBox.setAttribute('aria-hidden', 'true');
  const branch = el('div', { className: 'gather-branch' }); branch.setAttribute('role', 'group'); branch.setAttribute('aria-label', '가지');
  const quick = el('button', { type: 'button', className: 'felt primary gather-quick', hidden: true });
  const body = el('div', { className: 'gather-body' }, basketBox, branch, quick);
  const board = el('section', { id: 'gather-board', className: 'gather-board', hidden: true, tabIndex: -1 }, el('div', { className: 'gather-head' }, place, closeButton), line, body);
  board.setAttribute('role', 'group');
  const bubbleBox = el('div', { className: 'gather-bubble', hidden: true }); bubbleBox.setAttribute('role', 'status');
  const foundBox = el('div', { className: 'gather-found', hidden: true }); foundBox.setAttribute('role', 'status');
  const toastBox = el('p', { className: 'gather-toast', hidden: true }); toastBox.setAttribute('role', 'status');
  scene.append(marks, board, bubbleBox, foundBox, toastBox, live);
  closeButton.addEventListener('click', () => close(true));
  quick.addEventListener('click', () => quickPress());
  board.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
  for (const node of [openButton, giveButton, closeButton, quick, ...marks.children]) node.dataset.sound = 'none';

  const spots = () => gv?.spots || [];
  const spotView = id => spots().find(s => s.id === id) ?? null;
  const able = () => !!gv && ctx.walking && ctx.connected && !ctx.seated && !ctx.dialog && !ctx.teaShown && !!ctx.point;
  const ownerNear = () => !!ctx.owner?.up && !ctx.owner.walking && distance(ctx.point, ctx.owner) <= GIVE_M;
  const basket = () => (gv?.basket || []).filter(b => b.qty > 0 && ITEM_BY_ID.has(b.item));
  const held = item => basket().find(b => b.item === item)?.qty ?? 0;
  /** A pick sent and not yet in the view: each carries the basket count it will make, so once the server's answer is in the
   * view (accepted before the command's promise settles) it is no longer counted — never twice (screen review A3). */
  const sendPick = item => { const entry = { item, expect: held(item) + pending.filter(p => p.item === item).length + 1 }; pending.push(entry); return entry; };
  const settle = entry => { const at = pending.indexOf(entry); if (at >= 0) pending.splice(at, 1); };
  const unseen = () => pending.filter(p => held(p.item) < p.expect).map(p => p.item);
  const giveShown = () => able() && !hand && !ctx.panel && ownerNear() && basket().length > 0;
  function say(words) { if (!words) return; if (words !== lastAnnounce) { live.textContent = words; lastAnnounce = words; } else { live.textContent = ''; requestAnimationFrame(() => { live.textContent = words; }); } }

  /* ── the board ── */
  function open() {
    const spot = spotView(nearId);
    if (!spot || hand || !able()) return;
    hand = start(spot); simple = readSimple(reduced.matches); pending = []; lineNote = null; giveOpen = false;
    hand = { ...hand, focus: firstLeaf() };
    // The cafe owner picking beside the player (§20-8 함께 따기): her word once a life day in this window — the server keeps
    // the thing done together with the first pick.
    if (gv.alongside && spot.id === Object.keys(GATHER.spots)[0] && withShown !== (ctx.lifeDay ?? 'day')) {
      withShown = ctx.lifeDay ?? 'day';
      const words = lineWords('cafe-owner.gather.with.1');
      if (words) { lineNote = words; showBubble(words); }
    }
    buildBoard(spot);
    // The server measures the reach from where it saw the player: the walk goes now, before the first pick (F3).
    Promise.resolve(beforeCommand()).catch(() => {});
    render(true);
    requestAnimationFrame(() => focusLeaf(hand?.focus ?? 0));
    say(`${spotLabel(spot.id)}. ${simple ? '바로 따기를 눌러요.' : '밝은 잎을 골라 따요.'}`);
  }
  function close(focusBack) {
    if (!hand) return;
    hand = null; pending = []; lineNote = null; branch.replaceChildren(); board.hidden = true; document.body.classList.remove('gather-mode');
    render(true);
    if (focusBack) (opener?.isConnected && !opener.closest('[hidden]') ? opener : !openButton.hidden ? openButton : scene).focus({ preventScroll: true });
  }
  function buildBoard(spot) {
    const plant = GATHER.spots[spot.id]?.plant || 'tea', where = leafSpots(hand.leaves.length);
    branch.innerHTML = branchSvg(hand.leaves.length);
    hand.leaves.forEach((leaf, i) => {
      const b = el('button', { type: 'button', className: `gather-leaf${leaf.item ? ' young' : ' dark'}` });
      b.innerHTML = itemPicture(leaf.item, { dark: !leaf.item, plant });
      b.dataset.index = String(leaf.index); b.dataset.sound = 'none'; b.dataset.focus = `leaf:${leaf.index}`;
      b.style.left = `${where[i].x}%`; b.style.top = `${where[i].y}%`; b.style.setProperty('--tilt', `${leaf.tilt + where[i].side * 18}deg`);
      b.setAttribute('aria-label', leaf.item ? itemName(leaf.item) : '짙은 잎'); b.setAttribute('aria-keyshortcuts', String(i + 1));
      b.addEventListener('click', () => press(leaf.index));
      branch.append(b);
    });
  }
  const leafButton = index => branch.querySelector(`.gather-leaf[data-index="${index}"]`);
  const firstLeaf = () => hand ? (hand.leaves.find(l => l.item && !hand.picked.includes(l.index)) ?? hand.leaves[0])?.index ?? 0 : 0;
  /** The keys to a leaf — or, for a gamepad (whose buttons the walk reads while the scene holds the focus), a ring on it. */
  function focusLeaf(index) {
    if (!hand || board.hidden) return;
    for (const b of branch.querySelectorAll('.gather-leaf.cursor')) b.classList.remove('cursor');
    if (ctx.inputMode === 'gamepad') { leafButton(index)?.classList.add('cursor'); return; }
    if (simple) { (quick.hidden || quick.disabled ? closeButton : quick).focus({ preventScroll: true }); return; }
    (leafButton(index) || closeButton).focus({ preventScroll: true });
  }
  /** After a pick the keys go on to the next leaf on the branch (a young one first), else to 닫기 — never lost with the
   * leaf that flew (its button hides). */
  function afterPick(index) {
    if (!hand) return;
    const had = document.activeElement?.closest?.('.gather-leaf')?.dataset.index, left = hand.leaves.filter(l => !hand.picked.includes(l.index));
    const next = left.find(l => l.item && l.index > index) ?? left.find(l => l.item) ?? left.find(l => l.index > index) ?? left[0];
    hand = { ...hand, focus: next?.index ?? hand.focus };
    if (ctx.inputMode === 'gamepad' || had === String(index) || !board.contains(document.activeElement)) { if (next) focusLeaf(next.index); else if (ctx.inputMode !== 'gamepad') closeButton.focus({ preventScroll: true }); }
  }

  /** One leaf pressed: the cue sounds and moves at once; a young leaf's pick goes to the server behind it (F3). */
  function press(index) {
    if (!hand || simple) return;
    lineNote = null;
    const out = input(hand, { type: 'press', index }); hand = out.state;
    for (const cue of out.cues) {
      if (cue.type === 'sway') { sound('sway'); swayLeaf(cue.index); say('짙은 잎은 그대로 둬요.'); }
      if (cue.type === 'leaf') {
        sound('leaf', { step: cue.step, last: cue.last });
        const body = finish(hand, cue.index), firstFind = !(gv?.book || []).includes(cue.item), entry = sendPick(cue.item);
        fly(cue.index, cue.last, cue.item);
        say(`${picked(cue.item)} 바구니에 담았어요.`);
        afterPick(cue.index);
        send(body, cue.index, firstFind, entry);
      }
    }
    render(true);
  }
  async function send(body, index, firstFind, entry) {
    const answer = await command('GATHER_PICK', body);
    settle(entry);
    if (disposed) return;
    if (answer?.ok) { if (firstFind && (gv?.book || []).includes(body.item)) later(() => showFound(body.item), reduced.matches ? 0 : FLY_MS + 140); render(true); return; }
    // A refusal of the town's own: the leaf back on the branch, swaying, no sound — and the reason in the board's line.
    if (hand && hand.spot === body.spot) {
      flights.get(index)?.();
      if (answer?.code === 'gather-done' || answer?.code === 'gather-not-now') { hand = start(spotView(hand.spot) || { id: hand.spot, items: [], branch: hand.leaves.length }); buildBoard(spotView(hand.spot) || { id: hand.spot }); }
      else {
        hand = input(hand, { type: 'refused', index }).state;
        // The leaf back on its branch and pressable again; one still in the air stopped short of the basket (review A1).
        const b = leafButton(index); if (b) { b.classList.remove('gone'); b.disabled = false; } swayLeaf(index);
      }
      lineNote = answer?.message || null;
    }
    render(true);
  }
  /** What is left of each thing here once the picks still waiting for the server are taken off. */
  const leftNow = spot => (spot?.items || []).map(i => ({ ...i, left: Math.max(0, i.left - unseen().filter(p => p === i.item).length) }));
  /** 「바로 따기」: the first thing left that grows here, picked at once — no flight, the sound and the basket stay. A press
   * while one is out queues like a leaf (review F8): it counts what is still waiting. */
  async function quickPress() {
    const spot = hand && spotView(hand.spot), body = spot ? quickPick({ ...spot, items: leftNow(spot) }) : null;
    if (!body) return;
    quickBusy = true; lineNote = null; const firstFind = !(gv?.book || []).includes(body.item), step = hand.picked.length;
    hand = { ...hand, picked: [...hand.picked, -1 - step] };
    const rest = leftNow(spot).filter(i => i.grows && i.left > 0);
    sound('leaf', { step, last: rest.length === 1 && rest[0].left <= 1 });
    const entry = sendPick(body.item); render(true); later(() => sound('basket'), 120);
    say(`${picked(body.item)} 바구니에 담았어요.`);
    const had = document.activeElement === quick;
    const answer = await command('GATHER_PICK', body);
    settle(entry); quickBusy = pending.length > 0;
    if (answer?.ok && firstFind && (gv?.book || []).includes(body.item)) showFound(body.item);
    else if (!answer?.ok) lineNote = answer?.message || null;
    render(true);
    // The keys stay on 「바로 따기」 while something is left, else go to 닫기 — never to the page (review A2).
    if (hand && !board.hidden && ctx.inputMode !== 'gamepad' && (had || document.activeElement === document.body)) (quick.hidden || quick.disabled ? closeButton : quick).focus({ preventScroll: true });
  }
  function swayLeaf(index) { const b = leafButton(index); if (!b || reduced.matches) return; b.classList.remove('sway'); void b.offsetWidth; b.classList.add('sway'); }
  /** The leaf off the branch in a small arc to the basket (the stem gives a 40ms tug first — W8b §2-9). */
  function fly(index, last, item) {
    const b = leafButton(index); if (!b) return;
    b.classList.add('gone'); b.disabled = true;
    const arrive = () => { bounceBasket(); sound('basket'); if (last) rustle(); render(true); };
    if (reduced.matches || !b.animate) { arrive(); return; }
    inAir.push(item);
    const land = () => { const at = inAir.indexOf(item); if (at >= 0) inAir.splice(at, 1); };
    branch.classList.remove('tug'); void branch.offsetWidth; branch.classList.add('tug');
    // The flyer starts where the leaf is, the same size and turn (its box is the leaf's own, not the turned one's bounds).
    const from = b.getBoundingClientRect(), to = basketBox.getBoundingClientRect(), own = board.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight;
    const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
    const flyer = el('span', { className: 'gather-flyer' }); flyer.innerHTML = b.innerHTML;
    flyer.style.left = `${cx - own.left - w / 2}px`; flyer.style.top = `${cy - own.top - h / 2}px`; flyer.style.width = `${w}px`; flyer.style.height = `${h}px`;
    board.append(flyer);
    const dx = to.left + to.width / 2 - cx, dy = to.top + to.height * .35 - cy, tilt = (getComputedStyle(b).getPropertyValue('--tilt') || '0deg').trim() || '0deg';
    // A refusal while the leaf is still in the air stops it short of the basket (review A1).
    const stop = () => { flights.delete(index); land(); motion.onfinish = null; motion.cancel(); flyer.remove(); };
    flights.set(index, stop);
    const motion = flyer.animate([
      { transform: `translate(0,0) rotate(${tilt}) scale(1)`, opacity: 1 },
      { transform: `translate(${dx * .45}px, ${dy * .45 - 46}px) rotate(calc(${tilt} - 70deg)) scale(.82)`, opacity: 1, offset: .5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(calc(${tilt} - 140deg)) scale(.46)`, opacity: .9 }], { duration: FLY_MS, delay: 40, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    motion.onfinish = () => { flights.delete(index); flyer.remove(); land(); arrive(); };
    later(() => { if (flyer.isConnected) { flights.delete(index); flyer.remove(); land(); arrive(); } }, FLY_MS + 400);
  }
  function bounceBasket() { if (reduced.matches) return; basketBox.classList.remove('bounce'); void basketBox.offsetWidth; basketBox.classList.add('bounce'); }
  function rustle() { if (reduced.matches) return; branch.classList.remove('rustle'); void branch.offsetWidth; branch.classList.add('rustle'); }

  /* ── giving ── */
  function giveStart() {
    if (!giveShown() || giving) return;
    const things = basket();
    if (things.length === 1) { give(things[0].item); return; }
    giveOpen = !giveOpen; render(true);
    if (giveOpen) giveChoices.querySelector('button')?.focus({ preventScroll: true });
  }
  async function give(item) {
    if (giving) return;
    giving = true; giveOpen = false; sound('give'); flyToOwner(item); render(true);
    const answer = await command('GATHER_GIVE', { item });
    giving = false;
    if (disposed) return;
    if (answer?.ok) {
      const reply = gv?.reply;
      // Her word over her head once, for this gift (the reply is named for the revision the command made — T-<revision>);
      // a later gift the same day goes into the jar with no word.
      if (reply && reply.id === `T-${answer.revision}` && reply.line) showBubble(lineWords(reply.line));
      else showToast('잎 통에 넣었어요.');
      say(`${itemName(item)}${object(itemName(item))} 찻집 주인에게 드렸어요.`);
    } else if (answer?.message) showToast(answer.message);
    render(true);
    if (!giveButton.hidden) giveButton.focus({ preventScroll: true });
  }
  function flyToOwner(item) {
    if (reduced.matches || !giveButton.animate) return;
    const from = giveButton.getBoundingClientRect(), own = scene.getBoundingClientRect(), head = labelAt(GATHER.owner);
    const to = head ? { x: head.x, y: head.y + 20 } : { x: from.left - own.left + from.width / 2, y: from.top - own.top - 120 };
    for (let i = 0; i < 3; i++) {
      const flyer = el('span', { className: 'gather-flyer small' }); flyer.innerHTML = itemPicture(item);
      const x0 = from.left - own.left + from.width / 2 - 14 + (i - 1) * 10, y0 = from.top - own.top;
      flyer.style.left = `${x0}px`; flyer.style.top = `${y0}px`; scene.append(flyer);
      const motion = flyer.animate([{ transform: 'translate(0,0) scale(.9)', opacity: 0 }, { transform: `translate(${(to.x - x0) * .5}px, ${(to.y - y0) * .5 - 40}px) scale(1)`, opacity: 1, offset: .45 },
        { transform: `translate(${to.x - x0}px, ${to.y - y0}px) scale(.5)`, opacity: 0 }], { duration: 520, delay: i * 70, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
      motion.onfinish = () => flyer.remove(); later(() => flyer.remove(), 1200);
    }
  }

  /* ── the owner's word, the field book's note, a short word ── */
  function showBubble(words) { if (!words) return; bubble = { words, until: performance.now() + BUBBLE_MS }; say(`찻집 주인: ${words}`); later(() => render(true), BUBBLE_MS + 30); render(true); }
  function showFound(item) {
    found = { item, until: performance.now() + FOUND_MS }; sound('discover'); say(`도감에 적었어요. ${itemName(item)}.`);
    later(() => render(true), FOUND_MS + 30); render(true);
  }
  function showToast(words) { toast = { words, until: performance.now() + TOAST_MS }; later(() => render(true), TOAST_MS + 30); render(true); }

  /* ── drawing ── */
  function render(force = false) {
    if (disposed) return;
    const now = performance.now(), ok = able();
    if (bubble && now > bubble.until) bubble = null;
    if (found && now > found.until) found = null;
    if (toast && now > toast.until) toast = null;
    const near = ok ? spotView(nearId) : null, spot = hand ? spotView(hand.spot) : null;
    const sig = JSON.stringify([gv, ok, nearId, !!hand && [hand.spot, hand.picked, hand.focus], simple, giveOpen, giving, quickBusy, unseen(), inAir, lineNote, bubble?.words, found?.item, toast?.words,
      ctx.inputMode, ctx.busy, ownerNear(), ctx.panel]);
    if (!force && sig === lastSig) return; lastSig = sig;
    // 「E · 잎 따기」 by a spot (the board closed, the place's panel not open over it).
    openButton.hidden = !(near && !hand && !ctx.panel);
    if (!openButton.hidden) {
      const item = near.items.find(i => i.grows && i.left > 0)?.item ?? near.items[0]?.item;
      const label = `${ctx.inputMode === 'gamepad' ? 'A · ' : ctx.inputMode === 'touch' ? '' : 'E · '}${item === 'petal-rain' ? '꽃잎 줍기' : '잎 따기'}`;
      if (openButton.textContent !== label) openButton.textContent = label;
      openButton.setAttribute('aria-label', `${spotLabel(near.id)} · ${item === 'petal-rain' ? '꽃잎 줍기' : '잎 따기'}`);
    }
    document.body.classList.toggle('gather-entry', !openButton.hidden);
    // 「찻집 주인에게 드리기」: the pictures of what the basket holds, never how many.
    const giveNow = giveShown();
    giveButton.hidden = !giveNow; giveButton.disabled = giving;
    if (giveNow) {
      giveButton.replaceChildren(el('span', { className: 'gather-give-pics' }, ...basket().slice(0, 4).map(b => { const s = el('span', { className: 'gather-pic' }); s.innerHTML = itemPicture(b.item); return s; })),
        el('span', { textContent: `${ctx.inputMode === 'gamepad' ? 'RB · ' : ctx.inputMode === 'touch' ? '' : 'G · '}찻집 주인에게 드리기` }));
      giveButton.setAttribute('aria-label', `찻집 주인에게 드리기 — 바구니에 ${basket().map(b => itemName(b.item)).join(', ')}`);
    }
    giveChoices.hidden = !(giveNow && giveOpen);
    if (giveNow && giveOpen) giveChoices.replaceChildren(...basket().map(b => {
      const c = el('button', { type: 'button', className: 'felt gather-give-one', disabled: giving }); c.dataset.sound = 'none'; c.dataset.item = b.item;
      const pic = el('span', { className: 'gather-pic' }); pic.innerHTML = itemPicture(b.item);
      c.append(pic, el('span', { textContent: `${itemName(b.item)} 드리기` })); c.addEventListener('click', () => give(b.item)); return c; }));
    if (!giveNow) giveOpen = false;
    // The board.
    board.hidden = !hand; document.body.classList.toggle('gather-mode', !!hand);
    if (hand) {
      const name = spotLabel(hand.spot);
      board.setAttribute('aria-label', hand.spot === 'lane.wall' ? '꽃잎 줍기' : '잎 따기');
      if (place.textContent !== name) place.textContent = name;
      const waiting = unseen(), left = spot ? spot.items.some(i => i.grows && i.left > waiting.filter(p => p === i.item).length) : false;
      // The one line once nothing is left to pick here (「바로 따기」 counts what the server says is left, the branch its leaves).
      line.textContent = lineNote || ((simple ? left : hand.leaves.some(l => l.item && !hand.picked.includes(l.index))) ? '' : boardLine(spot ? { ...spot, items: spot.items.map(i => ({ ...i, left: Math.max(0, i.left - waiting.filter(p => p === i.item).length) })) } : null, spots()));
      line.hidden = !line.textContent;
      branch.hidden = simple; quick.hidden = !simple || !left;
      if (simple) { const item = spot ? quickPick({ ...spot, items: leftNow(spot) })?.item : null; quick.textContent = item ? `바로 ${verb(item)} · ${itemName(item)}` : '바로 따기'; quick.disabled = !item; }
      // The town's basket and the picks on their way, but a leaf still in the air goes in only when it lands (pub review F3).
      basketLeaves.replaceChildren(...basketPictures([...basket(), ...waiting.map(item => ({ item, qty: 1 })), ...inAir.map(item => ({ item, qty: -1 }))].reduce((all, b) => { const had = all.find(x => x.item === b.item); if (had) had.qty += b.qty; else all.push({ ...b }); return all; }, []))
        .slice(0, 7).map((p, i) => { const s = el('span', { className: 'gather-basket-leaf' }); s.innerHTML = itemPicture(p.item); s.style.setProperty('--i', String(i)); return s; }));
    }
    bubbleBox.hidden = !bubble;
    if (bubble) bubbleBox.replaceChildren(el('p', { className: 'gather-who', textContent: '찻집 주인' }), el('p', { className: 'gather-words', textContent: bubble.words }));
    foundBox.hidden = !found;
    if (found) { const pic = el('span', { className: 'gather-pic big' }); pic.innerHTML = itemPicture(found.item); foundBox.replaceChildren(pic, el('span', {}, el('span', { className: 'gather-found-head', textContent: '도감에 적었어요' }), el('strong', { textContent: itemName(found.item) }))); }
    toastBox.hidden = !toast; if (toast) toastBox.textContent = toast.words;
    placeFloating();
  }
  /** Each frame: the sparkles over their spots (only the near one takes a press), the owner's word over her head (docked
   * over the board or the right column when her head is off screen), and the board's height for the layers above it. */
  function placeFloating() {
    const boardH = board.hidden ? 0 : board.offsetHeight + 8; if (boardH !== placedBoardH) { placedBoardH = boardH; scene.style.setProperty('--gather-board-h', `${boardH}px`); }
    const ok = able() && !hand;
    for (const [id, mark] of markFor) {
      const spot = spotView(id), show = ok && !!spot && pickableNow(spot) && distance(ctx.point, spot.at) <= SHOW_M;
      const p = show ? pointAt({ x: spot.at.x, y: MARK_Y[id] ?? .6, z: spot.at.z }) : null;
      mark.hidden = !p; if (!p) continue;
      mark.classList.toggle('near', id === nearId);
      const transform = `translate(${Math.round(p.x - 17)}px, ${Math.round(p.y - 17)}px)`; if (mark.style.transform !== transform) mark.style.transform = transform;
    }
    if (!bubbleBox.hidden) {
      // Above whichever board is up — this one or the tea board (screen review F4).
      const teaBoard = document.getElementById('tea-board'), teaTop = teaBoard && !teaBoard.hidden && teaBoard.offsetHeight ? teaBoard.offsetTop - 12 : Infinity;
      const head = labelAt(GATHER.owner), w = bubbleBox.offsetWidth || 240, h = bubbleBox.offsetHeight || 70, width = scene.clientWidth, floor = Math.min(board.hidden ? scene.clientHeight - 210 : board.offsetTop - 12, teaTop);
      const x = head && head.x > 8 && head.x < width - 8 && head.y - h - 14 > 60 ? Math.max(8, Math.min(width - w - 8, head.x - w / 2)) : Math.max(8, Math.min(width - w - 8, width / 2 - w / 2));
      const y = head && head.x > 8 && head.x < width - 8 && head.y - h - 14 > 60 ? Math.min(head.y - h - 14, floor - h) : floor - h;
      const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; if (bubbleBox.style.transform !== transform) bubbleBox.style.transform = transform;
    }
  }

  /* ── keys and the pad ── */
  const typing = () => document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]');
  const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
  function step(by) {
    if (!hand || simple) return;
    const order = hand.leaves.filter(l => !hand.picked.includes(l.index)).map(l => l.index); if (!order.length) return;
    const focused = Number(document.activeElement?.closest?.('.gather-leaf')?.dataset.index ?? hand.focus);
    const at = order.indexOf(focused), next = order[((at < 0 ? 0 : at + by) % order.length + order.length) % order.length];
    hand = { ...hand, focus: next }; focusLeaf(next);
  }
  function keydown(event) {
    if (disposed || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || typing()) return;
    if (event.code === 'KeyG' && giveShown() && !giving) { event.preventDefault(); sfx.unlock(); giveStart(); return; }
    if (!hand || board.hidden) return;
    if (event.code in DIGITS && !simple) { const leaf = leafSpotsOrder()[DIGITS[event.code]]; if (leaf !== undefined) { event.preventDefault(); sfx.unlock(); onInputMode('keyboard'); press(leaf); } return; }
    // ←→ move between the leaves while one has the keys (not the walk — the board takes them; WASD still walks).
    if ((event.code === 'ArrowLeft' || event.code === 'ArrowRight') && board.contains(document.activeElement) && !simple) { event.preventDefault(); event.stopPropagation(); step(event.code === 'ArrowLeft' ? -1 : 1); }
  }
  const leafSpotsOrder = () => hand ? hand.leaves.map(l => l.index) : [];
  addEventListener('keydown', keydown, true);

  return {
    /** The answer's view.gather and the window's state now: { walking, point, connected, busy, seated, dialog, panel (the
     * place's panel open), teaShown (the tea board or its folded pieces on screen), inputMode, lifeDay, owner ({ up, x, z,
     * walking } at the server's time) }. The board folds by itself once the player walks off its spot. */
    update(next, nextCtx = ctx) {
      gv = next ?? null; ctx = nextCtx;
      nearId = able() ? nearestSpot(spots(), ctx.point, OPEN_M)?.id ?? null : null;
      if (hand && (!able() || ctx.panel || distance(ctx.point, spotView(hand.spot)?.at) > CLOSE_M)) close(document.activeElement && board.contains(document.activeElement));
      render();
    },
    /** Each frame: the sparkles and the owner's word follow the scene; a pad's LB · RB move between the leaves, RB gives by the owner. */
    frame() {
      if (disposed) return;
      placeFloating();
      if (bubble || found || toast) { const now = performance.now(); if (bubble && now > bubble.until || found && now > found.until || toast && now > toast.until) render(true); }
      const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected && p.mapping === 'standard'); if (!pad) return;
      const pressed = i => !!pad.buttons[i]?.pressed, edge = i => pressed(i) && !padPrev[i];
      if ([4, 5].some(edge) && ctx.inputMode !== 'gamepad') { ctx = { ...ctx, inputMode: 'gamepad' }; onInputMode('gamepad'); }
      if (hand && !simple) { if (edge(4)) step(-1); if (edge(5)) step(1); }
      else if (!hand && edge(5) && giveShown()) giveStart();
      for (let i = 0; i < 16; i++) padPrev[i] = pressed(i);
    },
    /** E · A: on the board, the leaf in focus (or 「바로 따기」); by a spot, open the board. Says whether it took the press. */
    interact() {
      if (hand) {
        if (simple) { if (!quick.hidden && !quick.disabled) quickPress(); return true; }
        const focused = document.activeElement?.closest?.('.gather-leaf');
        press(focused ? Number(focused.dataset.index) : hand.focus); return true;
      }
      if (!openButton.hidden) { opener = openButton; sfx.unlock(); open(); return true; }
      return false;
    },
    /** Esc · B: close the give choices, else the board. */
    cancel() {
      if (giveOpen) { giveOpen = false; render(true); giveButton.focus({ preventScroll: true }); return true; }
      if (hand) { close(true); return true; }
      return false;
    },
    active: () => !!hand,
    /** A hand sound of the board's family played for a press elsewhere (the card panel's 「내가 딴 잎 드리기」). */
    play: (name, opts) => { sfx.unlock(); return sound(name, opts); },
    /** Whether 「E · 잎 따기」 holds the E key now (the walk's talk button then shows no key). */
    holdsKey: () => !openButton.hidden || !!hand,
    metrics: () => ({ open: !!hand, spot: hand?.spot ?? null, near: nearId, simple, leaves: hand?.leaves ?? null, picked: hand?.picked ?? null, focus: hand?.focus ?? null,
      entry: !openButton.hidden, give: !giveButton.hidden, giveChoices: giveOpen, line: board.hidden ? null : line.textContent, bubble: bubble?.words ?? null, found: found?.item ?? null, toast: toast?.words ?? null,
      marks: [...markFor].filter(([, m]) => !m.hidden).map(([id, m]) => ({ id, near: m.classList.contains('near') })), pending: pending.map(p => p.item), sounds: [...played], sound: sfx.stats() }),
    dispose() {
      disposed = true; removeEventListener('keydown', keydown, true); for (const t of timers) clearTimeout(t);
      if (!shared) sfx.dispose();
      for (const node of [actions, marks, board, bubbleBox, foundBox, toastBox, live]) node.remove();
      document.body.classList.remove('gather-mode', 'gather-entry');
    },
  };
}
