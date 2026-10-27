/** The gathering loop (vertical slice design §20-8, W8b) — the second life activity in the town's slot (§20-7 ②). At three
 * spots of the player's own the player opens a branch under the screen and picks its bright young leaves by hand (a dark
 * leaf only sways — nothing is wrong, nothing is used up); a picked leaf flies to the basket, and the server grants it to
 * the account's ledger. Given to the cafe owner the basket's leaves go into her leaf jar: that day's 「오늘의 차」 is the
 * tea they make, the jar wears that much less (so 「잎 통이 비어 가요」 comes later), and while that card waits for the
 * player the gift settles it with the player (§8-4 C3 · deliver). The field book fills with each first gathered thing.
 *
 * What grows is the clock's alone — the band in my time, the weather now, the Korean date's weather shape, the season, the
 * span after a rain stops — never a chance (경제:479). Each item has a life day's quota (params gather.quota): what is left
 * shows as leaves still on the branch, never a number (G2); a day not come to leaves nothing owed and nothing lost (G3).
 *
 * apply() is the confirm rule: it never touches the ledger, the cards or the village itself — it says what should happen
 * (ledger · together · resolve · gives) and the runtime (core.mjs) does it, the same for every activity. view() is what
 * a screen draws; boardOf/start/input/finish are the hand on the device, pure so node runs them.
 */
import * as DATA from '../data.gen.mjs';
import { createRng, seedKey, hashString } from '../rng.mjs';
import { paramsFor } from '../params.mjs';
import { SPOT_BY_ID } from '../places.mjs';

// Read by name space: a browser holding an older data.gen.mjs links this module and only finds the loop missing.
export const GATHER = DATA.GATHER ?? null;
export const GATHER_LINES = Object.freeze(DATA.GATHER_LINES ?? []);
const ITEMS = Object.freeze((DATA.ITEMS ?? []).filter(item => item.sources?.includes('gather')));
export const ITEM_BY_ID = new Map(ITEMS.map(item => [item.id, item]));
export const SPOTS = Object.freeze(GATHER ? Object.keys(GATHER.spots) : []);
const TEAS = Object.freeze(GATHER ? Object.keys(GATHER.teas) : []);
const P = paramsVer => paramsFor(paramsVer).gather;
export const lineId = is => `cafe-owner.gather.${is}.1`;
export const bookLine = item => `village.gather.desc-${item}.1`;
export const itemsAt = spot => ITEMS.filter(item => item.spot === spot).map(item => item.id);

/* ── what grows ── */
/** Whether an item grows now. clock: { band, season, weatherNow, weatherDay, afterRain } — the runtime's, from the server's
 * clock only (afterRain: from a rain's end until the next band after the one it stopped in is over). */
export function grows(itemId, clock) {
  const g = GATHER?.items?.[itemId]?.grows;
  if (!g || !clock) return false;
  return (!g.bands || g.bands.includes(clock.band)) && (!g.seasons || g.seasons.includes(clock.season))
    && (!g.weatherNow || clock.weatherNow === g.weatherNow) && (!g.weatherDay || clock.weatherDay === g.weatherDay)
    && (!g.afterRain || clock.afterRain === true);
}
const dayOf = (slot, lifeDay) => (slot.day?.lifeDay === lifeDay ? slot.day : { lifeDay, picked: {}, given: null, with: null });
/** What is left of an item's quota on a life day. */
export const leftOf = (day, itemId, params) => Math.max(0, (params.quota[itemId] ?? 0) - (day?.picked?.[itemId] ?? 0));
/** The seed of a spot's branch on a life day (§20-8 해시(마을 씨앗, "gather", 생활일, 자리)): a number, so the screen never
 * holds the village seed (the account in the host). */
export const boardSeed = (villageSeed, lifeDay, spot) => hashString(seedKey('gather', villageSeed, lifeDay, spot));

/* ── the world slot ── */
export const initial = () => ({ day: null, today: null, reply: null });
const isId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value);
const nat = value => Number.isSafeInteger(value) && value >= 0;
const event = value => value === null || typeof value === 'string' && /^E-\d+$/.test(value);
export function valid(slot) {
  return !!slot && typeof slot === 'object'
    && (slot.day === null || !!slot.day && nat(slot.day.lifeDay) && !!slot.day.picked && typeof slot.day.picked === 'object'
      && Object.entries(slot.day.picked).every(([item, n]) => ITEM_BY_ID.has(item) && nat(n)) && event(slot.day.given) && event(slot.day.with))
    && (slot.today === null || !!slot.today && nat(slot.today.lifeDay) && (slot.today.tea === null || TEAS.includes(slot.today.tea))
      && typeof slot.today.petal === 'boolean' && (slot.today.item === null || ITEM_BY_ID.has(slot.today.item)))
    && (slot.reply === null || !!slot.reply && isId(slot.reply.id) && (slot.reply.line === null || isId(slot.reply.line)) && ITEM_BY_ID.has(slot.reply.item)
      && Number.isSafeInteger(slot.reply.atMs));
}
export const restore = raw => (raw && valid(raw) ? raw : initial());

/* ── the confirm rule ── */
const fail = (code, message, status = 409) => ({ error: [code, message, status] });
const far = (walk, at, cm) => !walk || !at || Math.hypot(walk.x - at.x, walk.z - at.z) * 100 > cm;
/** The cafe owner picking leaves where the player is picking (§20-8 함께 따기): her segment now, arrived, and beside the
 * player (within the reach a gift has — backend review GA1); without a walk only the place is read (the screen's view). */
const alongsideOf = (owner, spot, walk = null, params = P()) => !!owner && !!GATHER && owner.archetype === GATHER.picking.archetype && !owner.walking
  && owner.place === GATHER.picking.place && SPOT_BY_ID[spot]?.place === GATHER.picking.place && (!walk || !far(walk, owner, params.giveReachCm));

/**
 * The confirm rule. ctx (the runtime's): { id, nowMs, villageSeed, lifeDay, band, paramsVer, clock, walk, resident(npc),
 * takeable(card), holding(item), room(item) }. Returns { slot, events, completed, ledger?, together?, resolve?, gives?, use? }
 * or { error: [code, message, status] }. The slot is a copy — a refused command changes nothing.
 *  - ledger: [{ grant: { itemId, qty, cause } } | { transfer: { itemId, qty: 'all', to } }] — the runtime confirms them with
 *    the command (a grant's cause is the index of the event that caused it; its id is the grant's cause).
 *  - together: the life day's one thing done with a resident — { kind, day, actors, place, roles, help }; its event id goes
 *    to slot.day[day].
 *  - resolve: { card, choice, day } — that card, while it waits for the player, is settled with the player by this.
 *  - gives: [{ object, relief, npc }] — a village thing (whose) worn that much less from now (a time-ordered input, like a take).
 *  - use: the activity was used (the player's habit, §10-3 — once a life day however often).
 */
export function apply(current, command, ctx) {
  if (!GATHER) return fail('unknown-command', '지금은 할 수 없는 일이에요.', 400);
  const slot = structuredClone(current), p = command.payload || {}, params = P(ctx.paramsVer);
  const day = dayOf(slot, ctx.lifeDay);
  switch (command.type) {
    case 'GATHER_PICK': {
      const spot = SPOT_BY_ID[p.spot], item = ITEM_BY_ID.get(p.item);
      if (typeof p.spot !== 'string' || !Object.hasOwn(GATHER.spots, p.spot) || !spot || typeof p.item !== 'string' || !item || item.spot !== p.spot) return fail('gather-spot', '딸 것을 다시 골라 주세요.', 400);
      if (far(ctx.walk, spot.at, params.reachCm)) return fail('gather-too-far', '조금 더 가까이 가서 따 주세요.');
      if (!grows(p.item, ctx.clock)) return fail('gather-not-now', '지금은 여기서 딸 것이 없어요.');
      if (leftOf(day, p.item, params) < 1) return fail('gather-done', '여기는 오늘 다 땄어요.');
      if (ctx.room(p.item) < 1) return fail('gather-full', '바구니가 가득 찼어요.');
      slot.day = { ...day, picked: { ...day.picked, [p.item]: (day.picked[p.item] ?? 0) + 1 } };
      const alongside = alongsideOf(ctx.resident(GATHER.owner), p.spot, ctx.walk, params);
      const out = { slot, completed: null, use: true,
        events: [{ kind: 'gather.picked', spot: p.spot, item: p.item, lifeDay: ctx.lifeDay, band: ctx.band, atMs: ctx.nowMs, alongside }],
        ledger: [{ grant: { itemId: p.item, qty: 1, cause: 0 } }] };
      // Picking beside the cafe owner while she picks (§20-8): she shows which leaves are young, once a life day — no hold,
      // and no one else there learns of it (G6).
      if (alongside && !day.with) out.together = { kind: 'gather.together', day: 'with', actors: [GATHER.owner, 'player'], place: spot.place,
        roles: ['make'], help: { by: GATHER.owner, to: ['player'] } };
      return out;
    }
    case 'GATHER_GIVE': {
      const item = ITEM_BY_ID.get(p.item);
      if (typeof p.item !== 'string' || !item) return fail('gather-item', '드릴 것을 다시 골라 주세요.', 400);
      const owner = ctx.resident(GATHER.owner);
      if (!owner?.up) return fail('gather-owner-asleep', '찻집 주인은 지금 자고 있어요. 아침에 다시 만나요.');
      // Where she stands, not a place's name (design review F1): beside her in the greenhouse or the lane is near too.
      if (owner.walking) return fail('gather-owner-walking', '찻집 주인이 자리에 닿으면 드려 주세요.');
      if (far(ctx.walk, owner, params.giveReachCm)) return fail('gather-too-far', '찻집 주인 가까이 가서 드려 주세요.');
      const qty = ctx.holding(p.item);
      if (qty < 1) return fail('gather-none', '바구니에 그 잎이 없어요.');
      const relief = (params.tinRelief[p.item] ?? 0) * qty, prior = slot.today?.lifeDay === ctx.lifeDay ? slot.today : null;
      // The tea of the day is the last one given that day; petals float on it and change no tea (§20-8).
      slot.today = item.tea === 'petal' ? { lifeDay: ctx.lifeDay, tea: prior?.tea ?? null, petal: true, item: prior?.item ?? null }
        : { lifeDay: ctx.lifeDay, tea: item.tea, petal: prior?.petal ?? false, item: p.item };
      slot.day = day;
      const out = { slot, completed: null, use: true, events: [], ledger: [{ transfer: { itemId: p.item, qty: 'all', to: GATHER.tin } }],
        gives: relief > 0 ? [{ object: GATHER.tin, relief, npc: GATHER.owner }] : [] };
      let is = null;
      // While 「잎 통이 비어 가요」 waits for the player, leaves that fill the jar settle it with the player (§8-4 · deliver) —
      // that card's result is the day's gift; otherwise the day's first gift is a thing done with the owner (§11-6 rule).
      // The take's choice is 'give' (the plan then sends no one glad to pick more — design review F2); the tea itself is the
      // day's tea here, the one place it is read.
      if (relief > 0 && ctx.takeable(GATHER.tinCard)) { out.resolve = { card: GATHER.tinCard, choice: 'give', day: 'given' }; is = 'c3'; }
      else if (!day.given) {
        out.together = { kind: 'gather.given', day: 'given', actors: [GATHER.owner, 'player'], place: owner.place, roles: ['deliver'], help: { by: 'player', to: [GATHER.owner] } };
        is = 'gift';
      }
      slot.reply = { id: ctx.id, line: is ? lineId(is) : null, item: p.item, atMs: ctx.nowMs };
      return out;
    }
    default: return fail('unknown-command', '지금은 할 수 없는 일이에요.', 400);
  }
}
/** Nothing of gathering stays open past a visit: the branch is the device's, a gift is done at once. */
export const endVisit = current => ({ slot: current, events: [], completed: null });
/** Gathering holds no one (§20-8 「주민 예약은 하지 않는다」). */
export const held = () => [];
/** Nothing lightens a resident's chores: a gift wears the jar less, picking beside her is her own work (G4). */
export const results = () => [];

/** The tea of the day the player gave, for a life day (the tea order reads it — §20-8 「오늘의 차」), or null. */
export function todayOf(slot, lifeDay) {
  const t = slot?.today;
  return t && t.lifeDay === lifeDay ? { tea: t.tea, petal: t.petal, item: t.item, gift: slot.day?.lifeDay === lifeDay ? slot.day.given : null } : null;
}
/** What a screen draws (ctx: the runtime's view context — the clock now, the owner now, the basket and the field book
 * from the ledger). Words are the device's. */
export function view(slot, ctx) {
  const params = P(ctx.paramsVer), day = slot.day?.lifeDay === ctx.lifeDay ? slot.day : null, owner = ctx.resident?.(GATHER?.owner) ?? null;
  return {
    spots: SPOTS.map(id => ({ id, place: SPOT_BY_ID[id].place, at: { ...SPOT_BY_ID[id].at }, board: boardSeed(ctx.villageSeed, ctx.lifeDay, id),
      branch: params.branch, items: itemsAt(id).map(item => ({ item, grows: grows(item, ctx.clock), left: leftOf(day, item, params) })) })),
    basket: ctx.basket ?? [], book: ctx.book ?? [],
    today: todayOf(slot, ctx.lifeDay), reply: slot.reply,
    alongside: alongsideOf(owner, SPOTS[0]) && !day?.with,
    owner: owner ? { up: owner.up, x: owner.x, z: owner.z, place: owner.place } : null,
    together: { given: day?.given ?? null, with: day?.with ?? null },
  };
}

/* ── the hand (device) ── */
/** A spot's branch now: its young leaves (what is left today of what grows now — leaves, never a number) and dark ones
 * around them, one short of the branch's leaves (params gather.branch — 「가지 하나와 잎 서넛」) up to all of them, laid in
 * the order the day's seed gives (the same branch however often it is drawn). */
export function boardOf(spotView) {
  const branch = spotView?.branch ?? P().branch;
  const young = (spotView?.items || []).filter(i => i.grows).flatMap(i => Array.from({ length: Math.min(i.left, branch) }, () => i.item)).slice(0, branch);
  const total = Math.min(branch, Math.max(branch - 1, young.length + 1));
  const rng = createRng('gather-board', String(spotView?.board ?? 0));
  const leaves = [...young, ...Array.from({ length: total - young.length }, () => null)];
  for (let i = leaves.length - 1; i > 0; i--) { const j = rng.below(i + 1); [leaves[i], leaves[j]] = [leaves[j], leaves[i]]; }
  return leaves.map((item, index) => ({ index, item, tilt: rng.below(31) - 15 }));
}
/** The hand's state on a branch: the leaves, those picked (in flight to the basket or gone), the one in focus. */
export const start = spotView => ({ spot: spotView.id, leaves: boardOf(spotView), picked: [], focus: 0 });
/** One hand action → the next state and the cues the screen sounds and moves by. A dark leaf only sways; nothing blocks. */
export function input(state, action) {
  const st = structuredClone(state), cues = [];
  const cue = (type, extra = {}) => cues.push({ type, ...extra });
  const youngLeft = () => st.leaves.filter(l => l.item && !st.picked.includes(l.index)).length;
  switch (action.type) {
    case 'press': {
      const leaf = st.leaves[action.index];
      if (!leaf || st.picked.includes(leaf.index)) break;
      st.focus = leaf.index;
      if (!leaf.item) { cue('sway', { index: leaf.index }); break; }
      st.picked.push(leaf.index);
      cue('leaf', { index: leaf.index, item: leaf.item, step: st.picked.length - 1, last: youngLeft() === 0 });
      break;
    }
    case 'focus': st.focus = (st.focus + (action.step ?? 1) + st.leaves.length) % st.leaves.length; break;
    // The server's answer: a refused pick puts its leaf back on the branch (it sways — no sound of failing).
    case 'refused': if (st.picked.includes(action.index)) { st.picked = st.picked.filter(i => i !== action.index); cue('back', { index: action.index }); } break;
    default: break;
  }
  return { state: st, cues };
}
/** The GATHER_PICK body for a picked leaf, or null. */
export function finish(state, index) {
  const leaf = state.leaves[index];
  return leaf?.item ? { spot: state.spot, item: leaf.item } : null;
}
/** 「바로 따기」 (reduced motion · 간단히): the first thing left that grows at the spot now, or null. */
export function quickPick(spotView) {
  const found = (spotView?.items || []).find(i => i.grows && i.left > 0);
  return found ? { spot: spotView.id, item: found.item } : null;
}

export default Object.freeze({
  id: 'gather', canonicalActivityId: 'gather', storyFamily: 'gather', title: '모으기',
  places: Object.freeze([...SPOTS]), reserves: Object.freeze([]), reading: false, cap: 'gather',
  // The amount lever feedback may move (§20-3): how many spots the screen points out. Read later, as the tea order's.
  amountLever: Object.freeze({ id: 'spotsShown', options: Object.freeze([1, SPOTS.length]), default: SPOTS.length }),
  commands: Object.freeze({ GATHER_PICK: 'first-chapter', GATHER_GIVE: 'first-chapter' }),
  initial, restore, valid, apply, endVisit, held, results, view, start, input, finish,
  // What the other activities read of this one (the runtime's ctx.facts.gather): the tea of the day the player gave.
  facts: (slot, lifeDay) => ({ today: todayOf(slot, lifeDay) }),
});
