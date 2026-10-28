/** The tea order's board (vertical slice W8, design §11-4 · §22): the guests' words over their heads, the board under the
 * scene where a hand makes the cup (cup, tea, honey, 「다 됐어요」), the tray, and the cup carried in the hand to a guest.
 * Every press answers at once — a sound from day-sfx.mjs, a small move of the cup, the words read aloud — and nothing
 * waits on the server but the cup served (TEA_SERVE); the hand's state machine is the activity's own (tea-order.mjs
 * start/input/finish, run in node by tests/town-tea.test.js). No numbers, no score, no clock, no count of cups (G2·G9):
 * honey shows as spoons, guests by where they stand. A cup a guest wants changed comes back as it was, with no sound.
 * Reduced motion keeps every state change and drops the moves; 「간단히 만들기」 picks one of a few finished cups instead.
 * The controls are made here, not in day.html, and their look is day-tea.css: a browser still holding an older day.html
 * or data.gen.mjs simply has no board (the server then never offers the life cards to it — caps 'tea').
 * Where the photo-background town comes (10-26), the board, the chip and the bubbles stay as they are (DOM over the
 * scene); only the guests' stand points (TEA.stand) become the place photo's marks.
 */
import * as generated from './town/data.gen.mjs';
import { start, input, finish, previewCups, lineWords, keyWords, easier, VALUES } from './town/activities/tea-order.mjs';
import * as teaSource from './town/activities/tea-order.mjs';
import { createTeaSfx } from './day-sfx.mjs';
import { SPOT_BY_ID } from './town/places.mjs';
import { todayTeaWords, todayTeaColor, lineWords as gatherLine } from './day-gather.mjs';

const TEA = generated.TEA ?? null;
const LINES = new Map([...(generated.TOWN_LINES || [])].map(line => [line.id, line]));
export const SIMPLE_KEY = 'synk.world.town-tea-simple';
const TEA_NAMES = Object.freeze({ barley: '보리차', yuzu: '유자차', today: '오늘의 차' });
const CUP_NAMES = Object.freeze({ warm: '따뜻한 잔', cold: '찬 잔' });
const SPOONS = Object.freeze(['꿀 없이', '꿀 한 숟가락', '꿀 두 숟가락']);
const KEYS = Object.freeze({ Digit1: ['cup', 'warm'], Digit2: ['cup', 'cold'], Digit3: ['pour', 'barley'], Digit4: ['pour', 'yuzu'], Digit5: ['pour', 'today'],
  Numpad1: ['cup', 'warm'], Numpad2: ['cup', 'cold'], Numpad3: ['pour', 'barley'], Numpad4: ['pour', 'yuzu'], Numpad5: ['pour', 'today'] });
const REACT_MS = 450, NEAR_GUEST = 1.6, FOUND_MS = 6000;
// The hand actions that change the board's cup — done only at the cafe (picking up, putting down and serving go anywhere).
const BOARD_ACTIONS = new Set(['cup', 'pour', 'honey', 'done', 'empty', 'place']);
const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); node.append(...children.filter(c => c !== null && c !== undefined)); return node; };
const teaColor = tea => TEA?.axes?.tea?.[tea]?.color || '#b8763a';

/** Who a guest is on the screen — by where the guest stands, never by a number (review F8). */
export function guestName(order, g) {
  if (order?.kind === 'one-cup') return '연구원';
  if (g.regular) return '단골손님';
  return g.slot === 'a' ? '앞 손님' : '뒤 손님';
}
/** The board's cup in words (the live line, §11-4 접근성): 「따뜻한 잔에 유자차, 꿀 한 숟가락」. */
export function boardWords(board) {
  if (!board?.vessel && !board?.tea && !board?.honey) return '빈 판이에요';
  const cup = board.vessel ? CUP_NAMES[board.vessel] : '잔 없이', tea = board.tea ? TEA_NAMES[board.tea] : '차 없이';
  return `${cup}${board.vessel && board.tea ? '에' : ','} ${tea}, ${SPOONS[board.honey] ?? SPOONS[0]}`;
}
/** A finished cup's short name: 「따뜻한 유자차 · 꿀 한 숟가락」. */
export function cupWords(cup) {
  if (!cup) return '';
  return `${cup.vessel === 'cold' ? '차가운' : '따뜻한'} ${TEA_NAMES[cup.tea] || ''} · ${SPOONS[cup.honey] ?? SPOONS[0]}`;
}
/** 「천천히 말해 주세요」: the words in small groups of two 어절, shown one group at a time on each press. */
export function chunks(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < words.length; i += 2) out.push(words.slice(i, i + 2).join(' '));
  return out;
}
/** The key words of a request to underline (「다시 말해 주세요」): [{ text, key }] in order. */
export function marked(text, keys = keyWords()) {
  const source = String(text || ''); if (!keys.length) return [{ text: source, key: false }];
  const pattern = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return source.split(pattern).filter(Boolean).map(part => ({ text: part, key: keys.includes(part) }));
}
/** The line a resident says (the reviewed TOWN_LINES — the cards' result lines) at L2. */
const townLine = id => { const line = LINES.get(id); return line ? line.levels.L2 ?? line.levels.L1 ?? null : null; };

const readSimple = reduced => { try { const raw = localStorage.getItem(SIMPLE_KEY); if (raw === 'true') return true; if (raw === 'false') return false; } catch {} return !!reduced; };
const writeSimple = value => { try { localStorage.setItem(SIMPLE_KEY, String(value)); } catch {} };

/** A small cup drawn in CSS: the vessel, the tea's colour and level, steam or ice, the spoons of honey. */
function cupFigure(className = 'tea-figure') {
  const figure = el('span', { className }); figure.setAttribute('aria-hidden', 'true');
  figure.append(el('span', { className: 'tea-steam' }), el('span', { className: 'tea-glass' }, el('span', { className: 'tea-liquid' }), el('span', { className: 'tea-ice' })),
    el('span', { className: 'tea-handle' }), el('span', { className: 'tea-spoons' }, el('i'), el('i')));
  return figure;
}
function paintCup(figure, cup) {
  figure.dataset.vessel = cup?.vessel || ''; figure.dataset.filled = String(!!cup?.tea); figure.dataset.honey = String(cup?.honey ?? 0);
  figure.style.setProperty('--tea', cup?.tea ? teaColor(cup.tea) : 'transparent');
}

/**
 * The board. scene: the #scene element; hud: the walking HUD; nearby: the place panel; settings: the 「내 속도」 dialog.
 * command(type, payload) → Promise<boolean> is the town's command (TEA_ goes through the window's fence); beforeCommand()
 * sends the walk first (DAY_INTERACT's rule — the server sees where the player is, review F15);
 * labelAt(id) → a guest's head on screen; noteSeen(keys, occurrence) reports a shown request frame (W9's first exposure).
 */
export function createTeaBoard({ scene, hud, nearby, settings, command, beforeCommand = async () => {}, labelAt = () => null, noteSeen = () => {}, onInputMode = () => {}, reduced = matchMedia('(prefers-reduced-motion: reduce)') }) {
  if (!scene || !TEA) return null;
  if (!document.querySelector('link[data-tea-style]')) { const link = el('link', { rel: 'stylesheet', href: new URL('./day-tea.css', import.meta.url).href }); link.dataset.teaStyle = ''; document.head.append(link); }
  const sfx = createTeaSfx(), played = [];
  // Every sound this board made (the QA reads the newest few — a press sounds, a cup a guest wants changed does not).
  const sound = (name, opts) => { if (sfx.play(name, opts)) { played.push(name); if (played.length > 40) played.shift(); return true; } return false; };
  let order = null, tea = null, hand = null, ctx = {}, folded = false, simple = readSimple(reduced.matches), inflight = false, opener = null, disposed = false;
  let listen = {}, reacts = {}, padPrev = {}, jarIndex = 0, feedbackOpen = false, lastSig = '', lastAnnounce = '', placedBoardH = -1;
  // The owner's 「손님이 오늘의 차를 찾았어요」 (W8b): once an order, from the moment its 「오늘의 차」 guest is heard.
  let foundAt = { order: null, at: 0 };
  // The control to give the keys back to once its part is drawn again (its data-focus key — review A3, as the notebook does).
  let focusNext = null;

  // The entry: 「주문 같이 받기」 by the talk button while walking near the cafe, and in the place's panel otherwise.
  const openWalk = el('button', { type: 'button', id: 'tea-open', className: 'felt tea-open-walk', hidden: true, textContent: '주문 같이 받기' });
  const openPanel = el('button', { type: 'button', className: 'felt primary', textContent: '주문 같이 받기' });
  const panel = el('section', { id: 'tea-panel', className: 'cafe-first tea-panel', hidden: true }, el('p', { className: 'eyebrow', textContent: '찻집 주문' }),
    el('p', { className: 'field-note', textContent: '손님 말을 듣고 차를 만들어 내요. 언제든 그만할 수 있어요.' }), openPanel);
  panel.setAttribute('aria-label', '찻집 주문');
  for (const b of [openWalk, openPanel]) { b.dataset.sound = 'none'; b.addEventListener('click', event => { sfx.unlock(); opener = event.currentTarget; act('TEA_OPEN', {}); }); }
  hud?.append(openWalk); nearby?.querySelector('.permission-note')?.before(panel);

  // Over the scene: the guests' bubbles, the board and the hand.
  const bubbles = el('div', { className: 'tea-bubbles' });
  const live = el('p', { className: 'visually-hidden' }); live.setAttribute('aria-live', 'polite');
  const tray = el('div', { className: 'tea-tray' }); tray.setAttribute('role', 'group'); tray.setAttribute('aria-label', '쟁반');
  const notes = el('div', { className: 'tea-notes' });
  const foldButton = el('button', { type: 'button', className: 'tea-fold', textContent: '접기' }); foldButton.setAttribute('aria-label', '차 만들기 판 접기'); foldButton.setAttribute('aria-keyshortcuts', 'Escape'); foldButton.dataset.focus = 'fold';
  const band = el('div', { className: 'tea-band' }, tray, notes, foldButton);
  const mug = cupFigure('tea-figure tea-mug'), stream = el('span', { className: 'tea-stream' }); stream.setAttribute('aria-hidden', 'true');
  const cupButtons = Object.keys(CUP_NAMES).map((vessel, i) => { const b = el('button', { type: 'button', className: 'tea-pick tea-cup-pick', textContent: CUP_NAMES[vessel] });
    b.dataset.vessel = vessel; b.dataset.focus = `make:cup:${vessel}`; b.setAttribute('aria-keyshortcuts', String(i + 1)); b.prepend(cupFigure('tea-figure tea-mini')); paintCup(b.firstChild, { vessel }); return b; });
  const jarButtons = Object.keys(TEA_NAMES).map((name, i) => { const b = el('button', { type: 'button', className: 'tea-pick tea-jar', textContent: TEA_NAMES[name] });
    b.dataset.tea = name; b.dataset.focus = `make:jar:${name}`; b.style.setProperty('--tea', teaColor(name)); b.setAttribute('aria-keyshortcuts', String(i + 3)); b.prepend(el('span', { className: 'tea-jar-body' })); return b; });
  const honeyButton = el('button', { type: 'button', className: 'tea-pick tea-honey', textContent: '꿀' }); honeyButton.setAttribute('aria-keyshortcuts', 'H'); honeyButton.dataset.focus = 'make:honey';
  honeyButton.prepend(el('span', { className: 'tea-honey-pot' }));
  const doneButton = el('button', { type: 'button', className: 'felt primary tea-done', textContent: '다 됐어요' }); doneButton.setAttribute('aria-keyshortcuts', 'Enter'); doneButton.dataset.focus = 'make:done';
  const emptyButton = el('button', { type: 'button', className: 'felt subtle tea-empty', textContent: '잔 비우기' }); emptyButton.setAttribute('aria-keyshortcuts', 'Backspace'); emptyButton.dataset.focus = 'make:empty';
  const stopButton = el('button', { type: 'button', className: 'text-button tea-stop', textContent: '그만할래요' }); stopButton.dataset.focus = 'make:stop';
  const make = el('div', { className: 'tea-make' }, el('div', { className: 'tea-cups' }, ...cupButtons), el('div', { className: 'tea-stage' }, stream, mug),
    el('div', { className: 'tea-jars' }, ...jarButtons, honeyButton));
  make.querySelector('.tea-cups').setAttribute('role', 'group'); make.querySelector('.tea-cups').setAttribute('aria-label', '잔');
  make.querySelector('.tea-jars').setAttribute('role', 'group'); make.querySelector('.tea-jars').setAttribute('aria-label', '차와 꿀');
  const simpleRows = el('div', { className: 'tea-simple', hidden: true });
  const hint = el('p', { className: 'tea-hint' });
  const actionsRow = el('div', { className: 'tea-actions' }, doneButton, emptyButton, stopButton);
  const result = el('div', { className: 'tea-result', hidden: true });
  const board = el('section', { id: 'tea-board', className: 'tea-board', hidden: true, tabIndex: -1 }, band, hint, make, simpleRows, actionsRow, result);
  board.setAttribute('role', 'group'); board.setAttribute('aria-label', '차 만들기');
  const unfold = el('button', { type: 'button', className: 'felt tea-unfold', hidden: true, textContent: '차 만들기 펼치기' });
  const handFigure = cupFigure('tea-figure tea-hand-cup'), handLabel = el('span', { className: 'tea-hand-label' }), handActions = el('div', { className: 'tea-hand-actions' });
  const handChip = el('div', { id: 'tea-hand', className: 'tea-hand', hidden: true }, handFigure, handLabel, handActions);
  handChip.setAttribute('role', 'group'); handChip.setAttribute('aria-label', '손에 든 잔');
  scene.append(bubbles, board, unfold, handChip, live);
  for (const node of scene.querySelectorAll('.tea-board button, .tea-hand button, .tea-unfold, .tea-bubbles button')) node.dataset.sound = 'none';

  // 「내 속도」: 간단히 만들기 — on this device, first on where motion is reduced.
  const simpleSwitch = el('button', { type: 'button', className: 'stay-switch tea-simple-switch' }, el('span', { className: 'stay-switch-title', textContent: '간단히 만들기' }), el('span', { className: 'stay-switch-state' }));
  simpleSwitch.setAttribute('role', 'switch'); simpleSwitch.setAttribute('aria-describedby', 'tea-simple-note');
  simpleSwitch.addEventListener('click', () => { simple = !simple; writeSimple(simple); paintSimpleSwitch(); render(true); });
  settings?.append(el('fieldset', { className: 'sound-settings tea-settings' }, el('legend', { textContent: '찻집 주문' }), simpleSwitch,
    el('p', { className: 'field-note', id: 'tea-simple-note', textContent: '손으로 담는 대신 다 만든 잔 가운데 하나를 골라 내요. 잎은 「바로 따기」로 따요. 이 기기에 기억해요.' })));
  function paintSimpleSwitch() { simpleSwitch.setAttribute('aria-checked', String(simple)); simpleSwitch.querySelector('.stay-switch-state').textContent = simple ? '켜짐' : '꺼짐'; }
  paintSimpleSwitch();

  /* ── hand actions ── */
  const cuesFor = { cup: c => ['cup', { vessel: c.vessel }], pour: c => ['pour', { tea: c.tea }], spoon: c => ['spoon', { honey: c.honey }], done: () => ['done'], empty: () => ['empty'], pick: () => ['pick'] };
  function play(cues) {
    for (const c of cues) {
      const cue = cuesFor[c.type]?.(c); if (cue) sound(...cue);
      if (!reduced.matches) moveFor(c);
      if (c.type === 'need') say(c.missing.includes('vessel') ? '먼저 잔을 놓아요.' : '차를 따라 주세요.');
      if (c.type === 'tray-full') say('쟁반이 다 찼어요. 잔을 손님에게 내요.');
    }
  }
  function moveFor(c) {
    const kind = { cup: 'drop', pour: 'pour', spoon: 'spoon', done: 'done', empty: 'empty' }[c.type]; if (!kind) return;
    mug.classList.remove(kind); stream.classList.remove('flow'); void mug.offsetWidth; mug.classList.add(kind);
    if (kind === 'pour') { stream.style.setProperty('--tea', teaColor(c.tea)); stream.classList.add('flow'); }
    if (kind === 'done') { const slot = tray.children[c.index]; slot?.classList.remove('arrive'); void slot?.offsetWidth; slot?.classList.add('arrive'); }
  }
  function apply(action) {
    if (!hand || !order) return;
    // The board is filled only at the cafe — keys, pad, a dropped jar and the buttons alike (review A1).
    if (BOARD_ACTIONS.has(action.type) && !atMaking()) return;
    const out = input(hand, action); hand = out.state; play(out.cues);
    if (['cup', 'pour', 'honey', 'empty'].includes(action.type)) say(boardWords(hand.board));
    if (action.type === 'done' && out.cues.some(c => c.type === 'done')) say('다 만든 잔을 쟁반에 올렸어요.');
    if (action.type === 'pick' && out.cues.some(c => c.type === 'pick')) say(`${cupWords(hand.tray[hand.hand])} 잔을 들었어요.`);
    render(true);
  }
  function say(words) { if (words && words !== lastAnnounce) { live.textContent = words; lastAnnounce = words; } else if (words) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = words; }); } }
  async function act(type, payload) {
    if (inflight) return false;
    inflight = true; render(true);
    try { if (type === 'TEA_OPEN') await beforeCommand(); return await command(type, payload); } finally { inflight = false; render(true); }
  }
  const asks = () => hand ? structuredClone(hand.asks) : undefined;
  async function owner(slot, choice) {
    if (!order) return;
    const ok = await act('TEA_OWNER', { order: order.id, guest: slot, choice, asks: asks() });
    if (ok && hand) hand = input(hand, { type: 'sent' }).state;
    // The owner's word over the owner (「이 잔은 이렇게 만들면 돼요」) once she has served the guest.
    if (ok && choice === 'owner') reacts[slot] = { shownAt: performance.now() };
    render(true);
  }
  async function close() {
    if (!order) return;
    const ok = await act('TEA_CLOSE', { order: order.id, ...(hand ? { asks: asks() } : {}) });
    if (ok) { hand = null; listen = {}; reacts = {}; folded = false; (opener?.isConnected && !opener.closest('[hidden]') ? opener : scene).focus({ preventScroll: true }); }
  }
  /** The cup in hand (or the picked finished cup) to a guest: the set-down sound at once; the guest's sip, then the
   * answer, REACT_MS later — or when the server answers, if it is later (§2-4 「낸 순간」). */
  async function serve(slot, mode = 'make') {
    if (!order || inflight) return false;
    // Served by the guest only — the order at the cafe, the one-cup board by the researcher (the server refuses it elsewhere, F15).
    if (ctx.location !== (order.kind === 'one-cup' ? ctx.ownerPlace : 'cafe')) return false;
    const body = finish(hand, order, slot, { mode }); if (!body) return false;
    const sentAt = performance.now(); sfx.unlock(); sound('serve');
    if (!reduced.matches) { handChip.classList.remove('slide'); void handChip.offsetWidth; handChip.classList.add('slide'); }
    inflight = true; render(true);
    let ok = false;
    try { await beforeCommand(); ok = await command('TEA_SERVE', body); } finally { inflight = false; }
    if (!ok) { render(true); return false; }
    // Accepted: the asks went with it (review F11 — a refused command keeps them for the next).
    hand = input(hand, { type: 'sent' }).state;
    const g = order?.guests.find(x => x.slot === slot), pleased = !!g?.done;
    hand = input(hand, { type: pleased ? 'served' : 'returned' }).state;
    if (mode === 'preview' && hand) delete hand.simple[slot];
    const wait = Math.max(0, REACT_MS - (performance.now() - sentAt));
    setTimeout(() => {
      if (disposed) return;
      reacts[slot] = { shownAt: performance.now() };
      if (pleased) { sound('match'); if (order?.done) setTimeout(() => sound('final'), 260); }
      if (g?.react?.line) say(`${guestName(order, g)}: ${lineWords(g.react.line, order?.level || 'L2', g.react.values || {}) || ''}`);
      render(true);
    }, wait);
    render(true);
    return true;
  }

  /* ── listening ── */
  function bubbleFor(g) {
    const state = listen[g.slot] ||= { level: order.level, repeat: 0, slow: null, open: !hand?.heard?.[g.slot] };
    if (tea?.language && g.lineLevel) state.level = g.lineLevel;
    // The regular's 「늘 마시던 걸로요」: her note, opened again, shows the first request she made (§11-5).
    const frame = hand?.heard?.[g.slot] && g.note ? g.note : g.frame, words = lineWords(frame, state.level, g.request) || '';
    const card = el('div', { className: 'tea-bubble' }); card.dataset.slot = g.slot; card.setAttribute('role', 'group'); card.setAttribute('aria-label', `${guestName(order, g)}의 말`);
    const said = el('p', { className: 'tea-words' });
    if (state.slow) { const parts = chunks(words); said.textContent = parts.slice(0, state.slow).join(' '); if (state.slow < parts.length) said.append(el('span', { className: 'tea-more', textContent: ' …' })); }
    else if (state.repeat > 0) for (const part of marked(words)) said.append(part.key ? el('u', { textContent: part.text }) : document.createTextNode(part.text));
    else said.textContent = words;
    // 「무슨 뜻이에요?」 at the first level: the cup, the jar and the spoons beside the words.
    if (state.level === 'L1' && state.meaning) said.append(el('span', { className: 'tea-picture' }, ...pictureOf(g.request)));
    const askButton = (label, kind) => { const b = el('button', { type: 'button', className: 'tea-ask', textContent: label }); b.dataset.sound = 'none'; b.dataset.focus = `${g.slot}:ask:${kind}`;
      b.addEventListener('click', () => ask(g, kind)); return b; };
    const slowNext = state.slow && state.slow < chunks(words).length;
    const heard = el('button', { type: 'button', className: 'felt primary tea-heard', textContent: '네, 알겠어요' }); heard.dataset.sound = 'none'; heard.dataset.focus = `${g.slot}:heard`;
    heard.addEventListener('click', () => fold(g.slot));
    const ownerAsk = el('button', { type: 'button', className: 'text-button tea-owner-ask', textContent: '주인에게 부탁하기' }); ownerAsk.dataset.sound = 'none'; ownerAsk.dataset.focus = `${g.slot}:owner-ask`;
    ownerAsk.addEventListener('click', () => owner(g.slot, 'owner'));
    card.append(el('p', { className: 'tea-who', textContent: guestName(order, g) }), said,
      el('div', { className: 'tea-asks' }, askButton('다시 말해 주세요', 'repeat'), askButton(slowNext ? '다음 말' : '천천히 말해 주세요', 'slower'), askButton('무슨 뜻이에요?', 'meaning')),
      el('div', { className: 'tea-bubble-foot' }, heard, order.kind === 'order' ? ownerAsk : null));
    return card;
  }
  function pictureOf(request) {
    const out = [];
    if (request.temp) { const f = cupFigure('tea-figure tea-mini'); paintCup(f, { vessel: request.temp }); out.push(f); }
    if (request.tea) out.push(Object.assign(el('span', { className: 'tea-dot' }), { title: TEA_NAMES[request.tea] }));
    if (request.tea) out.at(-1).style.setProperty('--tea', teaColor(request.tea));
    if (Object.hasOwn(request, 'sweet')) out.push(el('span', { className: 'tea-spoon-row' }, ...Array.from({ length: Math.max(1, request.sweet) }, (_, i) => el('i', { className: request.sweet ? '' : 'none' }))));
    return out;
  }
  async function ask(g, kind) {
    const state = listen[g.slot];
    const frame = hand?.heard?.[g.slot] && g.note ? g.note : g.frame;
    if (kind === 'slower' && state.slow && state.slow < chunks(lineWords(frame, state.level, g.request)).length) { state.slow += 1; render(true); return; }
    if (tea?.language) {
      if (!(await ensurePresented(g))) return;
      if (!(await act('TEA_HELP', { order: order.id, guest: g.slot, kind }))) return;
    } else hand = input(hand, { type: 'ask', slot: g.slot, kind }).state;
    if (kind === 'repeat') { state.repeat += 1; state.slow = null; if (!tea?.language && state.repeat > 1) state.level = easier(state.level); }
    if (kind === 'slower') state.slow = 1;
    if (kind === 'meaning') { if (!tea?.language) state.level = easier(state.level); state.meaning = true; state.slow = null; }
    render(true);
  }
  function fold(slot) {
    if (!hand) return;
    const state = listen[slot]; if (state) state.open = false;
    if (!hand.heard[slot]) hand = input(hand, { type: 'fold', slot }).state;
    // The keys go on to the next guest's words (review A3) — or, once the last request is folded, to the board.
    const next = waiting().find(g => !hand.heard[g.slot]);
    if (next && ctx.inputMode !== 'gamepad') focusNext = `${next.slot}:heard`;
    render(true);
    if (hand.phase === 'make' && !Object.values(listen).some(s => s.open)) focusBoard();
  }
  async function reopen(slot) {
    const g = order?.guests.find(x => x.slot === slot); if (!g || g.done || !hand) return;
    if (tea?.language) { if (!(await act('TEA_HELP', { order: order.id, guest: slot, kind: 'reopen' }))) return; }
    hand = input(hand, { type: 'reopen', slot }).state;
    if (tea?.language) hand = input(hand, { type: 'sent' }).state;
    listen[slot] = { ...(listen[slot] || { level: order.level, repeat: 0, slow: null }), open: true };
    render(true);
    bubbles.querySelector(`[data-slot="${slot}"] .tea-heard`)?.focus({ preventScroll: true });
  }
  const focusBoard = () => { if (!board.hidden && !folded) (board.querySelector('.tea-pick:not(:disabled)') || board).focus({ preventScroll: true }); };
  // A server open is not display evidence. A visible request acknowledges its own task once;
  // a lost response can be retried, and the server retains the first acknowledged presentation.
  const presentationSent = new Set();
  function requestVisible(g) {
    if (document.hidden || document.querySelector('dialog[open]') || bubbles.hidden) return false;
    const words = bubbles.querySelector(`[data-slot="${g.slot}"] .tea-words`);
    if (!words || words.closest('[hidden]') || !words.getClientRects().length) return false;
    const rect = words.getBoundingClientRect(), style = getComputedStyle(words);
    // A request partly above the phone viewport is not yet a delivered task. Controls may
    // extend below it; the complete request itself must be visible before acknowledgement.
    return style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
      && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
  }
  async function ensurePresented(g) {
    if (!tea?.language || order?.kind !== 'order' || g.presented || presentationSent.has(`${order.id}:${g.slot}`)) return true;
    if (!ctx.connected || ctx.busy || inflight || !requestVisible(g)) return false;
    const contentKey = teaSource.presentationKey?.(g.frame, g.lineLevel || order.level);
    const key = `${order.id}:${g.slot}`, ok = await act('TEA_PRESENT', { order: order.id, guest: g.slot, visible: true, ...(contentKey ? { contentKey } : {}) });
    if (ok) presentationSent.add(key); return ok;
  }

  /* ── drawing ── */
  const waiting = () => order ? order.guests.filter(g => !g.done) : [];
  // The board is the cafe's: the one-cup board's cup is made there too and carried in the hand (review A1).
  const atMaking = () => !!order && ctx.location === 'cafe';
  /** Gives the keys back after a part is drawn again (review A3): to the control with the same data-focus key — after its
   * command answers if it is out — else, if the keys were lost with it, to the next thing to press. Not for a gamepad. */
  function restoreFocus(had) {
    const want = focusNext ?? had; if (want === null) return;
    if (ctx.inputMode === 'gamepad') { focusNext = null; return; }
    const again = ownParts().flatMap(part => [...part.querySelectorAll('[data-focus]')]).find(x => x.dataset.focus === want), now = document.activeElement;
    const usable = again && !again.disabled && !again.closest('[hidden]');
    if (again && !usable && (ctx.busy || inflight)) { focusNext = want; return; }
    focusNext = null;
    const lost = !now || now === document.body;
    if (usable) { if (now !== again && (lost || isOwn(now))) again.focus({ preventScroll: true }); return; }
    if (lost) [...bubbles.querySelectorAll('button'), ...board.querySelectorAll('button')].find(b => !b.disabled && !b.closest('[hidden]'))?.focus({ preventScroll: true });
  }
  // This board's own parts over the scene — the keys it gives back stay among them (other layers share #scene).
  const ownParts = () => [bubbles, board, handChip];
  const isOwn = node => !!node && ownParts().some(part => part.contains(node));
  function render(force = false) {
    if (disposed) return;
    const tv = tea, o = tv?.open ?? null, show = !!o && ctx.connected && !ctx.seated && (o.kind === 'one-cup' || ctx.location === 'cafe');
    const entry = !o && ctx.connected && !ctx.seated && ctx.location === 'cafe' && ctx.ownerAwake && !ctx.cafeBusy;
    openWalk.hidden = !(entry && ctx.walking && !ctx.panel);
    // On a phone the walking status line makes room for it (day-tea.css — the W6b · W8 merged screen).
    document.body.classList.toggle('tea-entry', !openWalk.hidden);
    const label = `${ctx.inputMode === 'gamepad' ? 'Y · ' : ctx.inputMode === 'touch' ? '' : 'T · '}주문 같이 받기`; if (openWalk.textContent !== label) openWalk.textContent = label; openPanel.disabled = ctx.busy || inflight; openWalk.disabled = ctx.busy || inflight;
    panel.hidden = !(entry && (!ctx.walking || ctx.panel));
    const holding = !!o && hand?.hand !== null && hand?.hand !== undefined && !!hand?.tray?.[hand.hand];
    const sig = JSON.stringify([o, hand, folded, simple, inflight, ctx.busy, ctx.location, ctx.connected, ctx.seated, listen, Object.keys(reacts), feedbackOpen, tv?.together, tv?.nextFirst, ctx.today,
      foundAt.order === o?.id && performance.now() - foundAt.at < FOUND_MS]);
    if (!force && sig === lastSig) return; lastSig = sig;
    const focused = document.activeElement, had = isOwn(focused) ? focused.closest('[data-focus]')?.dataset.focus ?? null : null;
    document.body.classList.toggle('tea-mode', show && !folded);
    // Folded, the hand chip sits above 「차 만들기 펼치기」, never over it (screen review F1).
    document.body.classList.toggle('tea-folded', show && folded);
    board.hidden = !show || folded; unfold.hidden = !show || !folded; handChip.hidden = !holding || !o;
    bubbles.hidden = !show;
    if (!o) { bubbles.replaceChildren(); focusNext = null; return; }
    const off = ctx.busy || inflight;
    // The result (every guest done): the owner's word, 「다음 손님」 · 「오늘은 여기까지」 and 「…」 (§20-3).
    result.hidden = !o.done; hint.hidden = o.done; make.hidden = o.done || simple; simpleRows.hidden = o.done || !simple; actionsRow.hidden = o.done; band.hidden = o.done;
    if (o.done) drawResult(o, tv, off);
    else {
      drawBand(o, off); drawMake(off); drawSimple(o, off);
      // 간단히 만들기 picks finished cups: the empty tray, 「다 됐어요」 and 「잔 비우기」 stay out of its way (a cup already on the tray stays).
      tray.hidden = simple && !hand?.tray?.some(Boolean); doneButton.hidden = simple; emptyButton.hidden = simple;
      doneButton.disabled = off || !atMaking() || !hand?.board?.vessel || !hand?.board?.tea || !hand.tray.includes(null);
      emptyButton.disabled = off || !atMaking() || !(hand?.board?.vessel || hand?.board?.tea || hand?.board?.honey);
      stopButton.disabled = off;
      hint.textContent = hintFor(o);
    }
    drawHand(o, off);
    drawBubbles(o, off);
    restoreFocus(had);
  }
  function hintFor(o) {
    if (o.kind === 'one-cup') {
      // In 간단히 만들기 the one-cup board's cup is picked at the cafe and carried as the hand's cup is (review A2).
      const carried = hand?.tray?.some(Boolean) || simple && waiting().some(g => hand?.simple?.[g.slot] !== undefined);
      if (carried) return '잔을 들고 연구원 곁에서 드려요.';
      return ctx.location !== 'cafe' ? '찻집에서 한 잔 만들어 가요.' : simple ? '마음에 드는 잔을 골라 들고 가요.' : '마음에 드는 대로 한 잔 만들어요.';
    }
    if (hand?.phase === 'listen') return '손님 말을 끝까지 들어요.';
    if (simple) return '손님마다 알맞은 잔을 골라 내요.';
    if (hand?.tray?.some(Boolean)) return '다 만든 잔은 쟁반에서 집어 손님에게 내요.';
    return '잔을 놓고, 차를 따르고, 꿀을 넣어요.';
  }
  function drawBand(o, off) {
    tray.replaceChildren(...(hand?.tray || []).map((cup, i) => {
      const b = el('button', { type: 'button', className: 'tea-slot', disabled: off || !cup }); b.dataset.sound = 'none'; b.dataset.index = String(i); b.dataset.focus = `tray:${i}`;
      b.setAttribute('aria-keyshortcuts', String(i + 6)); b.setAttribute('aria-label', cup ? `쟁반의 ${cupWords(cup)} 잔 들기` : '쟁반 빈자리');
      b.setAttribute('aria-pressed', String(hand.hand === i));
      const f = cupFigure('tea-figure tea-mini'); paintCup(f, cup); b.append(f);
      b.addEventListener('click', () => apply({ type: 'pick', index: i })); return b; }));
    // The one-cup board has no request to fold, so no note (screen review F7).
    notes.replaceChildren(...(o.kind === 'one-cup' ? [] : waiting()).map(g => {
      const b = el('button', { type: 'button', className: 'tea-note', textContent: `${guestName(o, g)} 쪽지` }); b.dataset.sound = 'none'; b.dataset.slot = g.slot; b.dataset.focus = `note:${g.slot}`;
      b.disabled = o.kind === 'one-cup' || !hand?.heard?.[g.slot] || listen[g.slot]?.open; b.addEventListener('click', () => reopen(g.slot)); return b; }));
  }
  function drawMake(off) {
    const b = hand?.board || { vessel: null, tea: null, honey: 0 }, can = !off && atMaking();
    for (const button of cupButtons) { button.setAttribute('aria-pressed', String(b.vessel === button.dataset.vessel)); button.disabled = !can; }
    for (const button of jarButtons) { button.setAttribute('aria-pressed', String(b.tea === button.dataset.tea)); button.disabled = !can; }
    // The third jar shows the tea of the day the player gave (W8b): its name under 「오늘의 차」 and its colour.
    const todayJar = jarButtons.find(button => button.dataset.tea === 'today'), words = todayTeaWords(ctx.today);
    if (todayJar) {
      let sub = todayJar.querySelector('.tea-jar-sub');
      if (words) { if (!sub) { sub = el('span', { className: 'tea-jar-sub' }); todayJar.append(sub); } if (sub.textContent !== words) sub.textContent = words; } else sub?.remove();
      todayJar.style.setProperty('--tea', todayTeaColor(ctx.today) || teaColor('today'));
      todayJar.setAttribute('aria-label', words ? `오늘의 차 — ${words}` : '오늘의 차');
    }
    honeyButton.disabled = !can; honeyButton.dataset.honey = String(b.honey); honeyButton.setAttribute('aria-label', `꿀 넣기 — 지금 ${SPOONS[b.honey]}`);
    paintCup(mug, b); mug.dataset.empty = String(!b.vessel);
  }
  function drawSimple(o, off) {
    if (!simple) return;
    // The one-cup board's cup is picked at the cafe and given by the researcher (review A2 — as the hand's cup is made and
    // carried); an order is drawn only at the cafe, where its guests are.
    const oneCup = o.kind === 'one-cup', there = ctx.location === (oneCup ? ctx.ownerPlace : 'cafe');
    simpleRows.replaceChildren(...waiting().map(g => {
      const cups = previewCups(o, g), chosen = hand?.simple?.[g.slot];
      const row = el('div', { className: 'tea-simple-row' }); row.setAttribute('role', 'group'); row.setAttribute('aria-label', `${guestName(o, g)}에게 낼 잔`);
      row.append(el('p', { className: 'tea-who', textContent: guestName(o, g) }), el('div', { className: 'tea-simple-cups' }, ...cups.map((cup, i) => {
        const b = el('button', { type: 'button', className: 'tea-pick tea-simple-cup', disabled: off || !hand?.heard?.[g.slot] || !atMaking() }, cupFigure('tea-figure tea-mini'), el('span', { textContent: cupWords(cup) }));
        b.dataset.sound = 'none'; b.dataset.focus = `simple:${g.slot}:${i}`; paintCup(b.firstChild, cup); b.setAttribute('aria-pressed', String(chosen === i));
        b.addEventListener('click', () => { if (!atMaking()) return; hand = input(hand, { type: 'choose', slot: g.slot, index: i }).state; sound('cup', { vessel: cup.vessel }); render(true); }); return b; })));
      const go = el('button', { type: 'button', className: 'felt primary', textContent: oneCup ? '연구원에게 드리기' : '이대로 낼게요', disabled: off || chosen === undefined || !there });
      go.dataset.sound = 'none'; go.dataset.focus = `simple:${g.slot}:go`;
      go.addEventListener('click', () => serve(g.slot, 'preview')); row.append(go); return row; }));
  }
  function drawHand(o, off) {
    const cup = hand?.hand !== null && hand?.hand !== undefined ? hand.tray[hand.hand] : null; if (!cup) return;
    paintCup(handFigure, cup); handLabel.textContent = cupWords(cup);
    // Served where the guest is: the order at the cafe, the one-cup board by the researcher (the server checks it too, review F15).
    const there = ctx.location === (o.kind === 'one-cup' ? ctx.ownerPlace : 'cafe');
    const targets = waiting().map(g => { const b = el('button', { type: 'button', className: 'felt primary', textContent: o.kind === 'one-cup' ? '연구원에게 드리기' : `${guestName(o, g)}에게 내기`, disabled: off || !there });
      b.dataset.sound = 'none'; b.dataset.focus = `hand:serve:${g.slot}`; b.addEventListener('click', () => serve(g.slot)); return b; });
    const place = el('button', { type: 'button', className: 'felt subtle', textContent: '판에 놓기', disabled: off || !!(hand.board.vessel || hand.board.tea || hand.board.honey) || !atMaking() });
    place.dataset.sound = 'none'; place.dataset.focus = 'hand:place'; place.addEventListener('click', () => apply({ type: 'place' }));
    const put = el('button', { type: 'button', className: 'felt subtle', textContent: '쟁반에 두기', disabled: off }); put.dataset.sound = 'none'; put.dataset.focus = 'hand:put';
    put.addEventListener('click', () => apply({ type: 'put' }));
    handActions.replaceChildren(...targets, place, put);
  }
  function drawResult(o, tv, off) {
    const card = o.card, line = card ? townLine(`${o.kind === 'one-cup' ? 'researcher' : 'cafe-owner'}.card.${card.id}-result.1`) : lineWords('cafe-owner.tea.owner-done.1', 'L2');
    const head = el('p', { className: 'tea-result-line', textContent: `${o.kind === 'one-cup' ? '연구원' : '찻집 주인'}: ${line || '고마워요.'}` });
    const next = el('button', { type: 'button', className: 'felt primary', textContent: '다음 손님', disabled: off }); next.dataset.sound = 'none'; next.dataset.focus = 'result:next';
    next.addEventListener('click', () => { reacts = {}; listen = {}; act('TEA_OPEN', {}); });
    const stop = el('button', { type: 'button', className: 'felt', textContent: o.kind === 'one-cup' ? '닫기' : '오늘은 여기까지', disabled: off }); stop.dataset.sound = 'none'; stop.dataset.focus = 'result:stop';
    stop.addEventListener('click', close);
    // The amount lever (§20-3 nextFirst): the button the person likely wants first.
    const buttons = o.kind === 'one-cup' ? [stop] : tv?.nextFirst === false ? [stop, next] : [next, stop];
    const parts = [head, el('div', { className: 'tea-result-actions' }, ...buttons)];
    const completion = card ? feedbackOf(card) : tv?.together ? { id: tv.together, activity: 'tea-order' } : null;
    if (completion) parts.push(feedbackRow(completion, off));
    result.replaceChildren(...parts);
  }
  function feedbackOf(card) { const take = ctx.take; return take?.card === card.id && take.eventId ? { id: take.eventId, activity: `card.${card.id}` } : null; }
  function feedbackRow({ id, activity }, off) {
    const given = (ctx.feedback || []).find(f => f.completionId === id)?.value ?? null;
    const more = el('button', { type: 'button', className: 'felt subtle feedback-more', textContent: '…' }); more.dataset.sound = 'none'; more.dataset.focus = 'result:more';
    more.setAttribute('aria-expanded', String(feedbackOpen)); more.setAttribute('aria-label', '이 생활에 응답 남기기');
    more.addEventListener('click', () => { feedbackOpen = !feedbackOpen; render(true); });
    const options = el('div', { className: 'feedback-options', hidden: !feedbackOpen }); options.setAttribute('role', 'group'); options.setAttribute('aria-label', '응답');
    for (const [value, label] of [['helpful', '좋았어요'], ['not_fit', '안 맞았어요'], ['too_much', '많았어요'], ['want_more', '더 하고 싶어요']]) {
      const b = el('button', { type: 'button', className: 'felt', textContent: label, disabled: off }); b.dataset.sound = 'none'; b.dataset.focus = `result:feedback:${value}`; b.setAttribute('aria-pressed', String(given === value));
      b.addEventListener('click', async () => { feedbackOpen = false; await act('FEEDBACK_GIVE', { completionId: id, value, canonicalActivityId: activity }); }); options.append(b);
    }
    return el('div', { className: 'tea-feedback' }, more, options);
  }
  function drawBubbles(o, off) {
    const nodes = [];
    for (const g of o.guests) {
      if (g.done) {
        const shown = reacts[g.slot] && g.react?.line;
        if (shown) nodes.push(reactBubble(o, g, g.react));
        continue;
      }
      if (o.kind === 'one-cup') { if (reacts[g.slot] && g.react?.line) nodes.push(reactBubble(o, g, g.react)); continue; }
      // Listening goes one guest at a time (A, then B); a folded request opens again from its note.
      const first = waiting().find(x => !hand?.heard?.[x.slot]);
      const open = listen[g.slot]?.open ?? (!hand?.heard?.[g.slot] && first?.slot === g.slot);
      if (open && (hand?.heard?.[g.slot] || first?.slot === g.slot)) { listen[g.slot] = { ...(listen[g.slot] || { level: o.level, repeat: 0, slow: null }), open: true }; nodes.push(bubbleFor(g)); const shown = hand?.heard?.[g.slot] && g.note ? g.note : g.frame; if (shown) noteSeen([`tea:${shown}`], `${o.id}:${g.slot}:${shown}`); }
      else if (reacts[g.slot] && g.react?.line) nodes.push(reactBubble(o, g, g.react));
      if (g.owner === 'asked') nodes.push(ownerBubble(o, g, off));
    }
    // A guest asked for the tea of the day the player gave (W8b, design review F6): the owner says so once, over her head.
    const asking = o.found ? o.guests.find(g => g.request?.tea === 'today') : null;
    if (asking && hand?.heard?.[asking.slot] && foundAt.order !== o.id) { foundAt = { order: o.id, at: performance.now() }; setTimeout(() => render(true), FOUND_MS + 30); }
    if (foundAt.order === o.id && performance.now() - foundAt.at < FOUND_MS) {
      const words = gatherLine('cafe-owner.gather.found.1', o.level || 'L2');
      if (words) { const card = el('div', { className: 'tea-bubble tea-react' }, el('p', { className: 'tea-who', textContent: '찻집 주인' }), el('p', { className: 'tea-words', textContent: words }));
        card.dataset.slot = 'found'; card.dataset.anchor = 'cafe-owner'; card.setAttribute('role', 'status'); nodes.push(card); }
    }
    bubbles.replaceChildren(...nodes);
    for (const b of bubbles.querySelectorAll('button')) { b.dataset.sound = 'none'; if (off) b.disabled = true; }
    place();
  }
  function reactBubble(o, g, react) {
    const words = react.by === 'owner' ? lineWords(react.line, 'L2') : lineWords(react.line, o.level, react.values || {});
    const card = el('div', { className: `tea-bubble tea-react${g.done ? ' pleased' : ''}` }, el('p', { className: 'tea-who', textContent: react.by === 'owner' ? '찻집 주인' : guestName(o, g) }), el('p', { className: 'tea-words', textContent: words || '' }));
    card.dataset.slot = g.slot; card.setAttribute('role', 'status'); if (react.by === 'owner') card.dataset.anchor = 'cafe-owner';
    if (g.done && !reduced.matches) card.append(el('span', { className: 'tea-sparks' }, el('i'), el('i'), el('i')));
    return card;
  }
  function ownerBubble(o, g, off) {
    const yes = el('button', { type: 'button', className: 'felt primary', textContent: '부탁해요', disabled: off }), no = el('button', { type: 'button', className: 'felt', textContent: '제가 다시 해 볼게요', disabled: off });
    yes.dataset.focus = `owner-${g.slot}:yes`; no.dataset.focus = `owner-${g.slot}:no`;
    yes.addEventListener('click', () => owner(g.slot, 'owner')); no.addEventListener('click', () => owner(g.slot, 'self'));
    const card = el('div', { className: 'tea-bubble tea-owner' }, el('p', { className: 'tea-who', textContent: '찻집 주인' }), el('p', { className: 'tea-words', textContent: lineWords('cafe-owner.tea.owner-offer.1', 'L2') || '' }),
      el('div', { className: 'tea-bubble-foot' }, yes, no));
    card.dataset.slot = `owner-${g.slot}`; card.dataset.anchor = 'cafe-owner';
    return card;
  }
  /** Each bubble over its speaker's head (docked over the board when the head is off screen) — every frame while open.
   * labelAt gives a head's point in the scene's own box. The hand chip keeps above the open board (--tea-board-h). */
  function place() {
    const boardH = board.hidden ? 0 : board.offsetHeight + 8; if (boardH !== placedBoardH) { placedBoardH = boardH; scene.style.setProperty('--tea-board-h', `${boardH}px`); }
    if (bubbles.hidden || !bubbles.children.length) return;
    const box = { width: scene.clientWidth, height: scene.clientHeight }, taken = [];
    // The top bar's brand · 수첩 · 내 속도 sit over the scene: a bubble under one of them starts below it (a docked one on a phone).
    const own = scene.getBoundingClientRect(), bar = [...document.querySelectorAll('.topbar .brand, #journal-open, #settings-open')].map(n => n.getBoundingClientRect())
      .filter(r => r.height).map(r => ({ left: r.left - own.left, right: r.right - own.left, bottom: r.bottom - own.top }));
    const floorAt = (x, w) => bar.reduce((top, r) => r.left < x + w && r.right > x ? Math.max(top, r.bottom + 8) : top, 8);
    for (const card of bubbles.children) {
      const slot = card.dataset.slot, g = order?.guests.find(x => x.slot === slot), id = card.dataset.anchor || (order?.kind === 'one-cup' ? 'researcher' : g?.who);
      const at = id ? labelAt(id) : null, w = card.offsetWidth || 240, h = card.offsetHeight || 80, fit = v => Math.max(8, Math.min(box.width - w - 8, v));
      let x, y;
      // Over the speaker's head while it shows above the board and below the top bar; a head behind the board docks over it (screen review F5).
      if (at && at.x > 8 && at.x < box.width - 8 && (board.hidden || at.y <= board.offsetTop) && at.y - h - 14 >= floorAt(fit(at.x - w / 2), w)) { x = fit(at.x - w / 2); y = at.y - h - 14; }
      else { x = fit(box.width / 2 - w / 2); y = Math.max(floorAt(x, w), (board.hidden ? box.height - 140 : board.offsetTop) - h - 12); }
      for (const t of taken) if (Math.abs(t.x - x) < w * .9 && Math.abs(t.y - y) < h) y = t.y - h - 8;
      taken.push({ x, y });
      const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; if (card.style.transform !== transform) card.style.transform = transform;
    }
  }

  /* ── keys and the pad ── */
  const typing = () => document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]');
  const boardOpen = () => !board.hidden && !folded && !!order && !order.done && !ctx.busy && !inflight;
  const entryShown = () => !openWalk.hidden || !panel.hidden;
  function keydown(event) {
    // A held key sounds once: one press, one sound (screen review F8 — the pad reads edges already).
    if (disposed || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || typing()) return;
    // T opens an order where 「주문 같이 받기」 shows (as F sits where a seat is near).
    if (!order) { if (event.code === 'KeyT' && !event.repeat && entryShown() && !ctx.busy && !inflight) { event.preventDefault(); sfx.unlock(); opener = openWalk.hidden ? openPanel : openWalk; act('TEA_OPEN', {}); } return; }
    sfx.unlock();
    // T opens the folded board again (screen review F1 — its button may sit under the walking controls on a phone).
    if (folded && event.code === 'KeyT' && !unfold.hidden) { event.preventDefault(); setFolded(false); return; }
    if (!boardOpen()) return;
    const key = KEYS[event.code];
    if (key && !simple && atMaking()) { event.preventDefault(); apply(key[0] === 'cup' ? { type: 'cup', vessel: key[1] } : { type: 'pour', tea: key[1] }); return; }
    if (event.code === 'KeyH' && !simple && atMaking()) { event.preventDefault(); apply({ type: 'honey' }); return; }
    if ((event.code === 'Digit6' || event.code === 'Digit7') && !simple) { event.preventDefault(); apply({ type: 'pick', index: event.code === 'Digit6' ? 0 : 1 }); return; }
    if (event.code === 'Backspace' && !simple && atMaking()) { event.preventDefault(); apply({ type: 'empty' }); return; }
    if (event.code === 'Enter' && !simple && !document.activeElement?.matches('button, a') && !doneButton.disabled) { event.preventDefault(); apply({ type: 'done' }); }
  }
  addEventListener('keydown', keydown, true);
  board.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
  doneButton.addEventListener('click', () => apply({ type: 'done' })); emptyButton.addEventListener('click', () => apply({ type: 'empty' }));
  stopButton.addEventListener('click', close);
  for (const b of cupButtons) b.addEventListener('click', () => apply({ type: 'cup', vessel: b.dataset.vessel }));
  for (const b of jarButtons) b.addEventListener('click', () => apply({ type: 'pour', tea: b.dataset.tea }));
  honeyButton.addEventListener('click', () => apply({ type: 'honey' }));
  foldButton.addEventListener('click', () => setFolded(true)); unfold.addEventListener('click', () => setFolded(false));
  // A jar dragged onto the cup pours too (a press is the main way — §2-16 ④).
  for (const b of jarButtons) { b.draggable = true; b.addEventListener('dragstart', event => { event.dataTransfer?.setData('text/plain', b.dataset.tea); }); }
  mug.addEventListener('dragover', event => event.preventDefault());
  mug.addEventListener('drop', event => { event.preventDefault(); const name = event.dataTransfer?.getData('text/plain'); if (VALUES.tea.includes(name) && boardOpen() && !simple) apply({ type: 'pour', tea: name }); });
  function setFolded(value) {
    folded = value; render(true);
    (folded ? unfold : (board.querySelector('.tea-pick:not(:disabled)') || board)).focus({ preventScroll: true });
  }
  /** The nearest waiting guest the player stands by (the pad's A and E serve there — review F7). */
  function nearGuest() {
    if (!order || !ctx.point) return null;
    if (order.kind === 'one-cup') return ctx.location === ctx.ownerPlace ? waiting()[0] ?? null : null;
    // The server serves an order only by the cafe (its walk radius) — a guest nearer than that from outside it is not near.
    if (ctx.location !== 'cafe') return null;
    let best = null, bestD = NEAR_GUEST;
    for (const g of waiting()) { const p = TEA.stand?.[g.slot]; if (!p) continue; const d = Math.hypot(ctx.point.x - p.x, ctx.point.z - p.z); if (d < bestD) { best = g; bestD = d; } }
    return best;
  }

  return {
    /** The answer's view.tea and the window's state now: { walking, panel, location (the place the player stands by), point,
     * connected, busy, seated, ownerAwake, cafeBusy, ownerPlace (the one-cup board's guest's place), take, feedback }. A new order starts the hand; the same order keeps it. */
    update(next, nextCtx = ctx) {
      tea = next ?? null; ctx = nextCtx;
      const o = tea?.open ?? null;
      if (!o) { order = null; hand = null; listen = {}; reacts = {}; feedbackOpen = false; }
      else if (o.id !== order?.id) { order = o; hand = start(o); listen = {}; reacts = {}; folded = false; feedbackOpen = false; jarIndex = 0;
        // A new order puts the keys on the first bubble (or the board, for the one-cup board) — not for a gamepad, whose
        // buttons the walking controls read while the scene holds the focus.
        if (ctx.inputMode !== 'gamepad') requestAnimationFrame(() => { (bubbles.querySelector('.tea-heard') || board.querySelector('.tea-pick:not(:disabled)'))?.focus({ preventScroll: true }); }); }
      else order = o;
      render();
    },
    /** Each frame: the bubbles follow the heads; a standard pad's board buttons (LB·LT cups, the right stick or RB jars,
     * Y honey, RT the tray, the left stick's press empties). A and B come through the walking controls (interact · cancel). */
    frame() {
      if (disposed) return false;
      place();
      if (tea?.language && !document.hidden && !document.querySelector('dialog[open]') && !inflight && order?.kind === 'order') {
        const g = waiting().find(guest => !guest.presented && !presentationSent.has(`${order.id}:${guest.slot}`) && requestVisible(guest));
        if (g && !bubbles.hidden && bubbles.getBoundingClientRect().width > 0) ensurePresented(g).catch(() => {});
      }
      const pad = [...(navigator.getGamepads?.() || [])].find(p => p?.connected && p.mapping === 'standard'); if (!pad) return false;
      const pressed = i => !!pad.buttons[i]?.pressed, edge = i => pressed(i) && !padPrev[i];
      // A board button pressed on the pad makes the pad the input (its labels and where the keys go — the walking controls
      // only see the sticks, A and B).
      if ([3, 4, 5, 6, 7, 10].some(edge) && ctx.inputMode !== 'gamepad') { ctx = { ...ctx, inputMode: 'gamepad' }; onInputMode('gamepad'); }
      // Y opens an order where 「주문 같이 받기」 shows (the board's honey once it is up).
      if (!order && edge(3) && entryShown() && !ctx.busy && !inflight) { sfx.unlock(); opener = openWalk.hidden ? openPanel : openWalk; act('TEA_OPEN', {}); }
      // Y opens a folded board again, as T does (screen review F1).
      else if (order && folded && edge(3) && !unfold.hidden) { setFolded(false); for (let i = 0; i < 16; i++) padPrev[i] = pressed(i); return true; }
      const stick = { x: pad.axes[2] || 0, y: pad.axes[3] || 0 }, flick = Math.hypot(stick.x, stick.y) > .7 ? (stick.y < -.6 ? 'yuzu' : stick.x < 0 ? 'barley' : 'today') : null;
      if (boardOpen() && !simple && atMaking()) {
        if (edge(4)) apply({ type: 'cup', vessel: 'warm' });
        if (edge(6)) apply({ type: 'cup', vessel: 'cold' });
        if (edge(5)) { jarIndex = (jarIndex + 1) % VALUES.tea.length; apply({ type: 'pour', tea: VALUES.tea[jarIndex] }); }
        if (flick && flick !== padPrev.flick) apply({ type: 'pour', tea: flick });
        if (edge(3)) apply({ type: 'honey' });
        if (edge(10)) apply({ type: 'empty' });
      }
      if (boardOpen() && !simple && edge(7) && hand) { const cups = hand.tray.map((c, i) => c ? i : -1).filter(i => i >= 0); if (cups.length) apply({ type: 'pick', index: cups[(cups.indexOf(hand.hand) + 1) % cups.length] }); }
      for (let i = 0; i < 16; i++) padPrev[i] = pressed(i);
      padPrev.flick = flick;
      return true;
    },
    /** E · A while the board is up (review F7): a cup in hand by a guest → serve; else a cup with tea on the board →
     * 「다 됐어요」. Says whether it took the press (otherwise the walk's talk goes on). */
    interact() {
      if (!order || order.done || ctx.busy || inflight || !hand) return false;
      const holding = hand.hand !== null && hand.tray[hand.hand], near = holding ? nearGuest() : null;
      if (near) { serve(near.slot); return true; }
      if (boardOpen() && !simple && hand.board.vessel && hand.board.tea && !doneButton.disabled) { apply({ type: 'done' }); return true; }
      return false;
    },
    /** Esc · B: fold the board (the cup stays); a second press closes nothing else here. */
    cancel() {
      if (!order || board.hidden || folded) return false;
      if (Object.values(listen).some(s => s.open) && hand) { const open = Object.entries(listen).find(([, s]) => s.open)?.[0]; if (open) { fold(open); return true; } }
      setFolded(true); return true;
    },
    active: () => !!order,
    caps: 'tea',
    metrics: () => ({ order: order?.id ?? null, kind: order?.kind ?? null, phase: hand?.phase ?? null, board: hand?.board ?? null, tray: hand?.tray ?? null, hand: hand?.hand ?? null,
      folded, simple, sounds: [...played], boardShown: !board.hidden, chip: !handChip.hidden, bubbles: [...bubbles.children].map(c => c.dataset.slot), entry: !openWalk.hidden || !panel.hidden, sound: sfx.stats() }),
    sound: () => sfx,
    dispose() { disposed = true; removeEventListener('keydown', keydown, true); sfx.dispose(); for (const node of [bubbles, board, unfold, handChip, live, openWalk, panel]) node.remove(); document.body.classList.remove('tea-mode', 'tea-folded', 'tea-entry'); },
  };
}

/** The guests to draw in the scene (day-scene.mjs teaGuests): the order's waiting guests at their stand points (A by the
 * counter, B waiting behind), and the seated ones at their seats — one body per look (three in the town: the regular
 * reader and two passers-by), so a seated guest whose look a waiting guest wears is left out (review F2). */
export function teaGuests(tv) {
  if (!TEA || !tv) return [];
  const out = [], used = new Set(), o = tv.open;
  if (o?.kind === 'order') for (const g of o.guests) {
    if (used.has(g.who)) continue;
    if (!g.done) { const p = TEA.stand?.[g.slot]; if (p) { out.push({ id: g.who, x: p.x, z: p.z, pose: 'standing', tea: true }); used.add(g.who); } }
  }
  for (const s of [...(tv.seated || [])].reverse()) {
    if (used.has(s.who)) continue;
    const spot = SPOT_BY_ID[s.spot];
    if (!spot?.at) continue;
    out.push({ id: s.who, x: spot.at.x, z: spot.at.z, pose: s.who === 'visitor-tea-reader' ? 'sit' : 'resting', tea: true }); used.add(s.who);
  }
  return out;
}
