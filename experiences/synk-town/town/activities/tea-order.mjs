/** The tea order (vertical slice design §11, W8) — the first life activity in the town's slot (§20-7 ②). Two guests
 * ask for a cup in words at the scene's reading level; the player makes it by hand on the board under the screen
 * (cup, tea, honey, 「다 됐어요」), carries it and serves it. Only the axes a guest asked for are judged: every cup that
 * keeps them is right, and none is set as a trap. A cup that misses goes back to the board as it was and the guest
 * names one axis softly; nothing is used up, nothing is scored, nothing waits on a clock (G2·G9). Card C5 opens this
 * order and card R6 its one-cup board (§8-4).
 *
 * apply() is the confirm rule — the server's, the same function a device reads; view() is what a screen draws.
 * start/input/finish are the hand's state machine on the device, pure so node runs it, ending in a TEA_SERVE body.
 * A request comes from a seed of (village seed, 'tea', life day, band, the band's order number) — never the clock,
 * and never who read it. Its words are filled on the device from this table's values only (G5); the server keeps
 * ids and values, never names or free text (G7).
 */
import * as DATA from '../data.gen.mjs';
import { createRng } from '../rng.mjs';
import { MINUTE } from '../clock.mjs';
import { paramsFor } from '../params.mjs';
import { SPOT_BY_ID, SPOT_GROUPS } from '../places.mjs';

// Read by name space: a browser holding an older data.gen.mjs links this module and only finds the order missing.
const TEA = DATA.TEA ?? null;
export const TEA_LINES = Object.freeze(DATA.TEA_LINES ?? []);
const LINE_BY_ID = new Map(TEA_LINES.map(line => [line.id, line]));
const P = paramsVer => paramsFor(paramsVer).tea;
export const AXES = Object.freeze(['tea', 'temp', 'sweet']);
export const VALUES = Object.freeze(TEA ? { tea: Object.keys(TEA.axes.tea), temp: Object.keys(TEA.axes.temp), sweet: Object.keys(TEA.axes.sweet).map(Number) }
  : { tea: [], temp: [], sweet: [] });
export const LEVELS = Object.freeze(['L1', 'L2', 'L3', 'L4']);
const ASK_KINDS = Object.freeze(['repeat', 'slower', 'meaning', 'reopen']);
export const USUAL = 'guest.tea.regular-usual.1';
const SLOTS = Object.freeze(['a', 'b']);
const ONE = 'r';
const FRAMES = TEA_LINES.filter(line => line.when?.part === 'request');
const line = (part, test = () => true) => TEA_LINES.find(l => l.when?.part === part && test(l.when))?.id ?? null;

/* ── words ── */
/** A line's words at a level with its blanks filled from the table (G5): {tea} {temp.adn} {temp.adv} {sweet.adn} … */
export function fillLine(text, values = {}) {
  return String(text || '').replace(/\{(tea|temp|sweet)(?:\.(adn|adv|honey))?\}/g, (_, axis, form) => {
    const entry = TEA?.axes?.[axis]?.[String(values[axis])];
    return entry ? entry[axis === 'tea' ? 'name' : form] ?? '' : '';
  });
}
/** The words a line says at a level (null when the line is unknown). */
export function lineWords(id, level, values = {}) {
  const l = LINE_BY_ID.get(id); if (!l) return null;
  return fillLine(l.levels[level] ?? l.levels.L2 ?? l.levels.L1, values);
}
/** The key words of a request — every axis value it names, in any of its forms — for 「다시 말해 주세요」's underline. */
export function keyWords() {
  if (!TEA) return [];
  return [...new Set(AXES.flatMap(axis => Object.values(TEA.axes[axis]).flatMap(entry => [entry.name, entry.adn, entry.adv, entry.honey].filter(Boolean))))]
    .sort((a, b) => b.length - a.length);
}
export const easier = level => LEVELS[Math.max(0, LEVELS.indexOf(level) - 1)];

/* ── a request ── */
const zeroAsks = () => Object.fromEntries(ASK_KINDS.map(kind => [kind, 0]));
const sameRequest = (a, b) => AXES.every(axis => a[axis] === b[axis]);
function requestOf(frame, rng, prior) {
  const out = {}, w = frame.when;
  for (const axis of w.axes) {
    if (w.fixed && Object.hasOwn(w.fixed, axis)) out[axis] = w.fixed[axis];
    else if (w.same === axis) out[axis] = prior.request[axis];
    else {
      // 「같은 걸로」 keeps the guest before's tea and changes the axis it names, so that axis differs from theirs.
      const options = VALUES[axis].filter(value => !(w.same && prior && Object.hasOwn(prior.request, axis) && value === prior.request[axis]));
      out[axis] = options[rng.below(options.length)];
    }
  }
  return out;
}
const framesAt = (level, prior) => {
  const home = FRAMES.filter(f => f.when.home === level);
  return (home.length ? home : FRAMES.filter(f => f.when.home === 'L1')).filter(f => !f.when.same || prior && Object.hasOwn(prior.request, f.when.same));
};
const guest = (slot, who, extra) => ({ slot, who, regular: false, frame: null, note: null, request: {}, asks: zeroAsks(), tries: 0, owner: null, react: null, done: null, ...extra });

/** The two guests of the band's next order and what each asks for (§11-2, §11-5). */
export function orderGuests(slot, { villageSeed, lifeDay, band, level, paramsVer }) {
  const p = P(paramsVer), n = slot.seq && slot.seq.lifeDay === lifeDay && slot.seq.band === band ? slot.seq.n + 1 : 1;
  const rng = createRng(villageSeed, 'tea', lifeDay, band, n), walkers = TEA.guests.walkers;
  // The regular comes as guest A at the village's first order (their first meeting), then once in four (§11-5).
  const regularNow = !slot.regular.met || slot.regular.since >= p.regularEvery;
  const whoA = regularNow ? TEA.guests.regular : walkers[rng.below(walkers.length)];
  const whoB = regularNow ? walkers[rng.below(walkers.length)] : walkers.find(w => w !== whoA);
  let a;
  if (regularNow && slot.regular.pref) {
    // 「늘 마시던 걸로요」 above L1; at L1 the first request again. The folded note shows the first request (§11-5).
    const pref = slot.regular.pref;
    a = guest('a', whoA, { regular: true, frame: level === 'L1' ? pref.frame : USUAL, note: pref.frame, request: { ...pref.request } });
  } else {
    const frames = framesAt(level, null), frame = frames[rng.below(frames.length)];
    a = guest('a', whoA, { regular: regularNow, frame: frame.id, request: requestOf(frame, rng, null) });
  }
  // Guest B differs from A on at least one axis (§11-2); a draw that repeats A tries again, a last one turns an axis.
  const frames = framesAt(level, a);
  let b = null;
  for (let i = 0; i <= FRAMES.length && !b; i++) {
    const frame = frames[rng.below(frames.length)], request = requestOf(frame, rng, a);
    if (!sameRequest(request, a.request)) b = guest('b', whoB, { frame: frame.id, request });
  }
  if (!b) {
    const frame = frames[0], request = requestOf(frame, rng, a), axis = frame.when.axes.find(x => !(frame.when.fixed && Object.hasOwn(frame.when.fixed, x)) && frame.when.same !== x) ?? frame.when.axes[0];
    request[axis] = VALUES[axis].find(value => value !== request[axis]);
    b = guest('b', whoB, { frame: frame.id, request });
  }
  return { n, regularNow, guests: [a, b] };
}

/* ── judging and the guest's word ── */
/** The axes a cup misses, in the order a request says them (tea, temperature, sweetness). */
export function judge(request, cup) {
  const got = { tea: cup.tea, temp: cup.vessel, sweet: cup.honey };
  return AXES.filter(axis => Object.hasOwn(request, axis) && request[axis] !== got[axis]);
}
/** The line a guest answers a served cup with, and what fills it (§11-3 reacting). */
export function reactFor(g, cup, missed) {
  if (!missed.length) {
    if (g.regular && g.note) return { line: line('regular', w => w.is === 'match'), values: {} };
    if (!Object.hasOwn(g.request, 'sweet')) return { line: line('react', w => w.is === 'match' && w.free === 'sweet' && w.value === cup.honey), values: {} };
    if (!Object.hasOwn(g.request, 'temp')) return { line: line('react', w => w.is === 'match' && w.free === 'temp' && w.value === cup.vessel), values: {} };
    return { line: line('react', w => w.is === 'match' && !w.free), values: {} };
  }
  const axis = missed[0];
  if (axis === 'tea') return { line: line('react', w => w.is === 'differ' && w.axis === 'tea'), values: { tea: g.request.tea }, axis };
  if (axis === 'temp') return { line: line('react', w => w.is === 'differ' && w.axis === 'temp' && w.want === g.request.temp), values: {}, axis };
  return { line: line('react', w => w.is === 'differ' && w.axis === 'sweet' && w.dir === (cup.honey > g.request.sweet ? 'less' : 'more')), values: {}, axis };
}
const okCup = cup => !!cup && typeof cup === 'object' && Object.keys(cup).length === AXES.length
  && VALUES.temp.includes(cup.vessel) && VALUES.tea.includes(cup.tea) && VALUES.sweet.includes(cup.honey);

/** The seat a pleased guest goes to (§11-3): the regular back to the player's own seat (she is the reader who sits there —
 * review F2), anyone else to the cafe's seats (under the eaves when it rains), the first that no resident's plan and no
 * seated guest takes for the guest's stay. None → the
 * guest takes the cup along. Seated guests are not planner input — a resident re-planned onto one sends the guest off
 * first on the screen (a drawing rule; nothing in the world changes). */
export function seatFor(slot, { nowMs, raining, playerSeat = null, busy = () => false, paramsVer, regular = false }) {
  const toMs = nowMs + P(paramsVer).stayMinutes * MINUTE;
  const taken = new Set(slot.seated.filter(s => s.toMs > nowMs).map(s => s.spot));
  const seats = [...(regular && playerSeat ? [playerSeat] : []), ...SPOT_GROUPS['cafe.seats'].filter(id => id !== playerSeat)];
  return seats.find(id => SPOT_BY_ID[id] && (!raining || SPOT_BY_ID[id].sheltered) && !taken.has(id) && !busy(id, nowMs, toMs)) ?? null;
}

/* ── the world slot ── */
export const initial = () => ({ seq: null, open: null, last: null, regular: { met: false, since: 0, pref: null }, seated: [], day: null });
const isId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value);
const nat = value => Number.isSafeInteger(value) && value >= 0;
const okRequest = r => !!r && typeof r === 'object' && Object.entries(r).every(([axis, value]) => AXES.includes(axis) && VALUES[axis].includes(value));
const okGuest = g => !!g && [...SLOTS, ONE].includes(g.slot) && isId(g.who) && typeof g.regular === 'boolean' && (g.frame === null || isId(g.frame))
  && (g.note === null || isId(g.note)) && okRequest(g.request) && ASK_KINDS.every(k => nat(g.asks?.[k])) && nat(g.tries)
  && [null, 'asked', 'declined'].includes(g.owner) && (g.react === null || typeof g.react === 'object')
  && (g.done === null || ['player', 'owner'].includes(g.done.by) && Number.isSafeInteger(g.done.atMs));
const okSession = s => !!s && isId(s.id) && ['order', 'one-cup'].includes(s.kind) && LEVELS.includes(s.level) && nat(s.lifeDay)
  && (s.card === null || isId(s.card?.id) && isId(s.card?.key)) && Array.isArray(s.guests) && s.guests.length >= 1 && s.guests.every(okGuest)
  && (s.completed === null || Number.isSafeInteger(s.completed));
export function valid(slot) {
  return !!slot && (slot.seq === null || nat(slot.seq.lifeDay) && typeof slot.seq.band === 'string' && nat(slot.seq.n))
    && (slot.open === null || okSession(slot.open)) && (slot.last === null || isId(slot.last.id) && nat(slot.last.served))
    && !!slot.regular && typeof slot.regular.met === 'boolean' && nat(slot.regular.since)
    && (slot.regular.pref === null || isId(slot.regular.pref.frame) && okRequest(slot.regular.pref.request))
    && Array.isArray(slot.seated) && slot.seated.every(s => isId(s.who) && isId(s.spot) && Number.isSafeInteger(s.fromMs) && Number.isSafeInteger(s.toMs))
    && (slot.day === null || nat(slot.day.lifeDay) && nat(slot.day.requests) && (slot.day.together === null || isId(slot.day.together)));
}
export const restore = raw => (raw && valid(raw) ? raw : initial());

/* ── the confirm rule ── */
const fail = (code, message, status = 409) => ({ error: [code, message, status] });
const served = s => s.guests.filter(g => g.done?.by === 'player').length;
const allDone = s => s.guests.every(g => g.done);
/** One guest finished: the result place W9 turns into the learning record (§13-2) — ids and values only, no words. */
function requestEvent(slot, s, g, ctx, result) {
  const p = P(ctx.paramsVer), day = slot.day?.lifeDay === s.lifeDay ? slot.day : { lifeDay: s.lifeDay, requests: 0, together: null };
  slot.day = day;
  if (s.kind !== 'order' || day.requests >= p.requestsPerDay) return [];
  day.requests += 1;
  return [{ kind: 'tea.request', order: s.id, guest: g.slot, who: g.who, frame: g.frame, level: s.level, request: { ...g.request }, asks: { ...g.asks },
    tries: g.tries, by: g.done.by, result, mode: g.done.mode ?? null, regular: g.regular, lifeDay: s.lifeDay, band: s.band, atMs: ctx.nowMs }];
}
function finishGuest(slot, s, g, ctx, { by, cup = null, mode = null, result }) {
  const spot = s.kind === 'order' ? seatFor(slot, { ...ctx, regular: g.regular }) : null;
  g.done = { by, cup, mode, atMs: ctx.nowMs, spot };
  if (spot) slot.seated = [...slot.seated.filter(x => x.toMs > ctx.nowMs), { who: g.who, spot, fromMs: ctx.nowMs, toMs: ctx.nowMs + P(ctx.paramsVer).stayMinutes * MINUTE }]
    .slice(-P(ctx.paramsVer).seatedKept);
  // The regular remembers the first cup she was given as hers — her own taste, not a memory of the player (§11-5, G6).
  if (g.regular && !slot.regular.pref) slot.regular.pref = { frame: g.frame, request: { ...g.request }, lifeDay: s.lifeDay };
  return requestEvent(slot, s, g, ctx, result);
}
/** The session reached its result now (every guest done): the runtime resolves its card, or writes the day's one
 * 「찻집 일을 같이 했다」 when the player served someone (§11-6). */
const completeIf = (s, ctx) => { if (s.completed === null && allDone(s)) { s.completed = ctx.nowMs; return { id: s.id, card: s.card, served: served(s) }; } return null; };
function close(slot, ctx, why) {
  const s = slot.open, events = [];
  for (const g of s.guests) if (!g.done) {
    if (why === 'visit-end' && s.kind === 'one-cup') continue;
    events.push(...finishGuest(slot, s, g, ctx, { by: 'owner', result: 'stopped' }));
  }
  const completed = completeIf(s, ctx);
  slot.last = { id: s.id, served: served(s), card: s.card, help: s.kind === 'order' ? served(s) * P(ctx.paramsVer).helpPerGuest : 0 };
  slot.open = null;
  return { events, completed, closed: { id: s.id, card: s.card } };
}
function open(slot, ctx) {
  if (ctx.card?.cup === 'one') {
    slot.open = { id: ctx.id, kind: 'one-cup', card: { id: ctx.card.id, key: ctx.card.key }, level: ctx.level, lifeDay: ctx.lifeDay, band: ctx.band,
      openedAt: ctx.nowMs, completed: null, guests: [guest(ONE, ctx.card.owner, {})] };
    return;
  }
  const { n, regularNow, guests } = orderGuests(slot, ctx);
  slot.seq = { lifeDay: ctx.lifeDay, band: ctx.band, n };
  slot.regular = regularNow ? { ...slot.regular, met: true, since: 0 } : { ...slot.regular, since: slot.regular.since + 1 };
  slot.open = { id: ctx.id, kind: 'order', card: ctx.card ? { id: ctx.card.id, key: ctx.card.key } : null, level: ctx.level, lifeDay: ctx.lifeDay, band: ctx.band,
    openedAt: ctx.nowMs, completed: null, guests };
}
function addAsks(s, asks) {
  if (asks === undefined) return true;
  if (!asks || typeof asks !== 'object') return false;
  for (const [slot, counts] of Object.entries(asks)) {
    const g = s.guests.find(x => x.slot === slot);
    if (!g || !counts || typeof counts !== 'object' || !Object.entries(counts).every(([k, v]) => ASK_KINDS.includes(k) && nat(v))) return false;
  }
  // Counted up to a ceiling per guest (review GA2): a long look at one request is still a request, never a refused cup.
  for (const [slot, counts] of Object.entries(asks)) { const g = s.guests.find(x => x.slot === slot); for (const [k, v] of Object.entries(counts)) g.asks[k] = Math.min(P().asksMax, g.asks[k] + v); }
  return true;
}

/**
 * The confirm rule. ctx (the runtime's): { id, nowMs, villageSeed, lifeDay, band, level, paramsVer, location, raining,
 * playerSeat, busy(spot, fromMs, toMs), card? }. Returns { slot, events, completed } or { error: [code, message, status] }.
 * The slot is a copy — a refused command changes nothing.
 */
export function apply(current, command, ctx) {
  const slot = structuredClone(current), p = command.payload || {}, s = slot.open;
  switch (command.type) {
    case 'TEA_OPEN': {
      let events = [], completed = null;
      if (s) {
        // 「다음 손님」: an order whose guests are all done closes as the next opens; one still going does not.
        if (!allDone(s)) return fail('tea-open', '하던 주문을 먼저 마쳐 주세요.');
        ({ events, completed } = close(slot, ctx, 'next'));
      }
      open(slot, ctx);
      return { slot, events, completed };
    }
    case 'TEA_SERVE': {
      if (!s || p.order !== s.id) return fail('tea-not-open', '주문을 다시 열어 주세요.');
      const g = s.guests.find(x => x.slot === p.guest);
      if (!g || g.done) return fail('tea-guest-done', '그 손님은 벌써 차를 받았어요.');
      if (!okCup(p.cup) || !['make', 'preview'].includes(p.mode)) return fail('tea-cup', '잔을 다시 만들어 주세요.', 400);
      if (!addAsks(s, p.asks)) return fail('tea-asks', '주문을 다시 열어 주세요.', 400);
      const where = s.kind === 'one-cup' ? ctx.ownerPlace : 'cafe';
      if (ctx.location !== where) return fail('tea-too-far', s.kind === 'one-cup' ? '잔을 들고 가까이 가서 드려 주세요.' : '찻집에서 내 주세요.');
      const missed = s.kind === 'one-cup' ? [] : judge(g.request, p.cup);
      g.react = reactFor(g, p.cup, missed);
      if (missed.length) {
        g.tries += 1;
        if (g.tries >= P(ctx.paramsVer).ownerAfter && g.owner === null) g.owner = 'asked';
        return { slot, events: [], completed: null };
      }
      const events = finishGuest(slot, s, g, ctx, { by: 'player', cup: { ...p.cup }, mode: p.mode, result: 'made' });
      return { slot, events, completed: completeIf(s, ctx) };
    }
    case 'TEA_OWNER': {
      if (!s || p.order !== s.id) return fail('tea-not-open', '주문을 다시 열어 주세요.');
      const g = s.guests.find(x => x.slot === p.guest);
      if (!g || g.done || s.kind === 'one-cup' || !['owner', 'self'].includes(p.choice) || p.choice === 'self' && g.owner !== 'asked') return fail('tea-owner', '지금은 고를 것이 없어요.');
      if (!addAsks(s, p.asks)) return fail('tea-asks', '주문을 다시 열어 주세요.', 400);
      if (p.choice === 'self') { g.owner = 'declined'; return { slot, events: [], completed: null }; }
      g.react = { line: line('owner', w => w.is === 'took'), values: {}, by: 'owner' };
      const events = finishGuest(slot, s, g, ctx, { by: 'owner', result: 'owner' });
      return { slot, events, completed: completeIf(s, ctx) };
    }
    case 'TEA_CLOSE': {
      if (!s) return { slot, events: [], completed: null };
      if (p.order !== undefined && p.order !== s.id) return fail('tea-not-open', '주문을 다시 열어 주세요.');
      if (!addAsks(s, p.asks)) return fail('tea-asks', '주문을 다시 열어 주세요.', 400);
      return { slot, ...close(slot, ctx, 'close') };
    }
    default: return fail('unknown-command', '지금은 할 수 없는 일이에요.', 400);
  }
}
/** A visit that ended closes its order as 「그만할래요」 would (the owner serves who is left); a one-cup board ends unserved. */
export function endVisit(current, ctx) {
  if (!current.open) return { slot: current, events: [], completed: null };
  const slot = structuredClone(current);
  return { slot, ...close(slot, ctx, 'visit-end') };
}
/** Who the open order holds: the cafe owner at the counter while the player is at the cafe (a card's order is held by
 * the card's take instead). */
export function held(slot, { location }) {
  const s = slot.open;
  return s && !s.card && location === 'cafe' ? [{ npc: 'cafe-owner', by: `tea:${s.id}`, spot: 'cafe.counter' }] : [];
}
/** What the player finished with the cafe owner, for the hold that says so (§7-2): the guests the player served
 * lighten her chores one each. A card's order speaks through its card's hold. */
export function results(slot) {
  const out = [];
  for (const s of [slot.open, slot.last]) {
    if (!s) continue;
    const n = s.guests ? served(s) : s.served;
    if (!n) continue;
    const help = s.guests ? (s.kind === 'order' ? n * P().helpPerGuest : 0) : s.help;
    out.push([s.card ? `card:${s.card.id}:${s.card.key}` : `tea:${s.id}`, help]);
  }
  return out;
}
/** What a screen draws: the order, its guests' lines and state, who sits where now. Words are the device's. */
export function view(slot, { nowMs, nextFirst = true } = {}) {
  const s = slot.open;
  return {
    open: s ? { id: s.id, kind: s.kind, card: s.card, level: s.level, done: s.completed !== null,
      guests: s.guests.map(g => ({ slot: g.slot, who: g.who, regular: g.regular, frame: g.frame, note: g.note, request: { ...g.request },
        tries: g.tries, owner: g.owner, react: g.react, done: g.done && { by: g.done.by, spot: g.done.spot, takeaway: g.done.by === 'player' && s.kind === 'order' && !g.done.spot } })) } : null,
    seated: slot.seated.filter(x => x.toMs > nowMs).map(x => ({ who: x.who, spot: x.spot })),
    together: slot.day?.together ?? null, nextFirst,
  };
}

/* ── the hand (device) ── */
/** Cups to pick from in 「간단히 만들기」 (§11-4): one that keeps the request, and up to two that change one asked axis
 * each — plain drinks, not traps; the order is the seed's. A one-cup board offers three different cups, all right. */
export function previewCups(order, g, paramsVer) {
  const rng = createRng(order.id, g.slot, 'preview'), want = P(paramsVer).previewCups;
  const pickOf = axis => VALUES[axis][rng.below(VALUES[axis].length)];
  const base = { vessel: g.request.temp ?? pickOf('temp'), tea: g.request.tea ?? pickOf('tea'), honey: g.request.sweet ?? pickOf('sweet') };
  const key = { temp: 'vessel', tea: 'tea', sweet: 'honey' }, cups = [base], seen = new Set([JSON.stringify(base)]);
  const turn = AXES.filter(axis => Object.hasOwn(g.request, axis));
  for (const axis of turn.length ? turn : AXES) for (const value of VALUES[axis]) {
    if (cups.length >= want) break;
    const cup = { ...base, [key[axis]]: value }, id = JSON.stringify(cup);
    if (!seen.has(id)) { seen.add(id); cups.push(cup); }
  }
  for (let i = cups.length - 1; i > 0; i--) { const j = rng.below(i + 1); [cups[i], cups[j]] = [cups[j], cups[i]]; }
  return cups;
}
const emptyBoard = () => ({ vessel: null, tea: null, honey: 0 });
/** The hand's state for an open order: who is still to be heard, the board's cup, the tray, the cup in hand. */
export function start(order) {
  const waiting = order.guests.filter(g => !g.done);
  return { phase: order.kind === 'one-cup' ? 'make' : 'listen', heard: Object.fromEntries(waiting.map(g => [g.slot, order.kind === 'one-cup'])),
    board: emptyBoard(), tray: waiting.map(() => null), hand: null, asks: Object.fromEntries(waiting.map(g => [g.slot, zeroAsks()])), simple: {} };
}
/** One hand action → the next state and the cues the screen sounds and moves by. Nothing here blocks: any order works,
 * a second cup or jar replaces the first, honey goes round 0 → 1 → 2 → 0 (§2-16 ⑤⑥). */
export function input(state, action) {
  const st = structuredClone(state), cues = [];
  const cue = (type, extra = {}) => cues.push({ type, ...extra });
  switch (action.type) {
    case 'fold': if (Object.hasOwn(st.heard, action.slot)) { st.heard[action.slot] = true; if (Object.values(st.heard).every(Boolean)) st.phase = 'make'; } break;
    case 'reopen': if (st.heard[action.slot]) st.asks[action.slot].reopen = Math.min(P().asksMax, st.asks[action.slot].reopen + 1); break;
    case 'ask': if (st.asks[action.slot] && ['repeat', 'slower', 'meaning'].includes(action.kind)) st.asks[action.slot][action.kind] = Math.min(P().asksMax, st.asks[action.slot][action.kind] + 1); break;
    case 'cup': if (VALUES.temp.includes(action.vessel)) { st.board.vessel = action.vessel; cue('cup', { vessel: action.vessel }); } break;
    case 'pour': if (VALUES.tea.includes(action.tea)) { st.board.tea = action.tea; cue('pour', { tea: action.tea }); } break;
    case 'honey': st.board.honey = (st.board.honey + 1) % VALUES.sweet.length; cue('spoon', { honey: st.board.honey }); break;
    case 'done': {
      const missing = ['vessel', 'tea'].filter(k => !st.board[k]), free = st.tray.indexOf(null);
      if (missing.length) { cue('need', { missing }); break; }
      if (free < 0) { cue('tray-full'); break; }
      st.tray[free] = { ...st.board }; st.board = emptyBoard(); cue('done', { index: free }); break;
    }
    case 'empty': if (st.board.vessel || st.board.tea || st.board.honey) { st.board = emptyBoard(); cue('empty'); } break;
    case 'pick': if (st.tray[action.index]) { st.hand = action.index; cue('pick', { index: action.index }); } break;
    case 'put': st.hand = null; break;
    case 'choose': if (Number.isSafeInteger(action.index) && action.index >= 0) st.simple[action.slot] = action.index; break;
    // The server's answer: a pleased guest keeps the cup; a cup that missed comes back to the board as it was.
    case 'served': if (st.hand !== null) { st.tray[st.hand] = null; st.hand = null; cue('served'); } break;
    case 'returned': if (st.hand !== null) {
      if (!st.board.vessel && !st.board.tea && !st.board.honey) { st.board = { ...st.tray[st.hand] }; st.tray[st.hand] = null; }
      st.hand = null; cue('returned'); } break;
    case 'place': if (st.hand !== null && !st.board.vessel && !st.board.tea && !st.board.honey) { st.board = { ...st.tray[st.hand] }; st.tray[st.hand] = null; st.hand = null; cue('cup', { vessel: st.board.vessel }); } break;
    case 'sent': for (const slot of Object.keys(st.asks)) st.asks[slot] = zeroAsks(); break;
    default: break;
  }
  return { state: st, cues };
}
/** The TEA_SERVE body for the cup in hand (or the cup picked in 「간단히 만들기」), or null when there is none. */
export function finish(state, order, guestSlot, { mode = 'make', paramsVer } = {}) {
  const g = order.guests.find(x => x.slot === guestSlot); if (!g || g.done) return null;
  const cup = mode === 'preview' ? previewCups(order, g, paramsVer)[state.simple[guestSlot]] : state.hand !== null ? state.tray[state.hand] : null;
  if (!cup) return null;
  return { order: order.id, guest: guestSlot, cup: { vessel: cup.vessel, tea: cup.tea, honey: cup.honey }, mode, asks: structuredClone(state.asks) };
}

export default Object.freeze({
  id: 'tea-order', canonicalActivityId: 'tea-order', storyFamily: 'cafe-life', title: '찻집 주문',
  places: Object.freeze(['cafe.counter']), reserves: Object.freeze(['cafe-owner']), reading: true, cap: 'tea',
  commands: Object.freeze({ TEA_OPEN: 'first-chapter', TEA_SERVE: 'first-chapter', TEA_OWNER: 'first-chapter', TEA_CLOSE: 'base' }),
  opens: 'TEA_OPEN', closes: 'TEA_CLOSE',
  // The day's one thing done together (§11-6): its event and the player's roles in it.
  together: Object.freeze({ kind: 'tea.together', roles: Object.freeze(['make', 'deliver']) }),
  initial, restore, valid, apply, endVisit, held, results, view, start, input, finish,
});
