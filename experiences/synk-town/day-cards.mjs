/** The small need cards, the pairs and what the residents tell, on the screen (vertical slice design §8·§9·§20, W5b).
 * The server decides everything — which card waits, who solves it how, what a resident knows and has not told yet,
 * whether an offer stands; this module only words and draws it: the line a resident says while it solves a card or
 * talks with its pair, the offer by its owner's name (「같이 할래요?」 with 「…」 — something else today, suggest less
 * often), the choosing panel of 「나와 함께」 and the result with its 「…」 feedback, the cards and the greeting in the
 * place's panel, and the news note by the door. No numbers, dates or counts show (G2·G3).
 * Screen-only module; every line comes from the reviewed lines (town/data/lines) through the generated data.
 * W10: a line with seasons (R5's need, its news) speaks in the season of its life day, and a resident with nothing to
 * tell greets the player in its own words, then says what it is doing (greetLine · routineLine).
 */
import * as generated from './town/data.gen.mjs';
import * as mood from './day-mood.mjs';
import { authoredLevel } from './town/language-ladder.mjs';
import { civilFromDays, dayKindOf, seasonOfMonth } from './town/clock.mjs';
import { SPOT_BY_ID } from './town/places.mjs';

// Read through the namespace: for up to the cache's ten minutes after a publish a browser may still hold the generated
// data from before the cards existed (then no card line shows and the town still opens — a named import would stop it).
const LINES = new Map([...(generated.MOOD_LINES || []), ...(generated.TOWN_LINES || [])].map(line => [line.id, line]));
// A line's seasonal variants (W10): `.1` is autumn's, the others carry when.season.
const SEASONAL = new Map((generated.TOWN_LINES || []).filter(line => line.when?.season).map(line => [`${line.id.replace(/\.\d+$/, '')}:${line.when.season}`, line.id]));
const inSeason = (id, season) => SEASONAL.get(`${id.replace(/\.\d+$/, '')}:${season}`) ?? id;
/** The season of a life day (the clock's, by its month), or null. */
export const seasonOf = lifeDay => Number.isSafeInteger(lifeDay) ? seasonOfMonth(civilFromDays(lifeDay).month) : null;
// A card's news and hearsay carry the life day it happened as the head of their ref (`<lifeDay>.<band>.<card>`).
const dayOfRef = ref => /^-?\d+\./.test(ref ?? '') ? Number(ref.split('.')[0]) : null;
export const CARD_BY_ID = new Map((generated.CARDS || []).map(card => [card.id, card]));
const PAIR_LIST = generated.PAIRS || [];
export const NAMES = Object.freeze({ 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원' });
export const LEVEL = 'L2';

/** What each choice of 「나와 함께」 is called on its button (the cards' own choice ids, §8-4). */
export const CHOICE_LABELS = Object.freeze({
  C1: { inside: '찻집 안에서', outside: '바깥 자리에서', watch: '구경할게요' },
  C2: { 'eaves-left': '처마 왼쪽', 'eaves-right': '처마 오른쪽' },
  C3: { mild: '순한 향', deep: '진한 향' },
  C4: { 'sweet-0': '꿀 없이 만든 새 차', 'sweet-1': '꿀 한 숟가락 새 차', 'sweet-2': '꿀 두 숟가락 새 차' },
  C6: { 'eaves-left': '처마 왼쪽 자리', 'eaves-right': '처마 오른쪽 자리' },
  W1: { near: '가까이 보이게', clear: '통로 넓게' },
  W2: { 'garden-right': '정원 오른쪽', 'eaves-right': '처마 오른쪽', 'my-seat': '내가 만든 자리' },
  W3: { cafe: '찻집 앞부터', workshop: '공방 앞부터' },
  W4: { inside: '공방 안에', door: '문 앞에' },
  W5: { slowly: '「천천히 해요」' },
  W6: { 'my-seat': '내가 만든 자리', 'garden-right': '정원 오른쪽', eaves: '처마 밑' },
  R1: { stone: '돌', wood: '나무' },
  R2: { greenhouse: '온실 안', eaves: '찻집 처마' },
  R3: { light: '밝은 쪽 그림', shade: '그늘 쪽 그림' },
  R4: { watch: '같이 볼게요' },
  R5: { left: '왼쪽 잎', right: '오른쪽 잎' },
});
export const choiceLabel = (card, choice) => CHOICE_LABELS[card]?.[choice] ?? choice;
/** The picture by a card's lines (the mood lines' pictures — one per card). */
export const CARD_ICONS = Object.freeze({ C1: 'wobble', C2: 'umbrella', C3: 'leaf', C4: 'cup', C5: 'guests', C6: 'seat', W1: 'board', W2: 'quiet',
  W3: 'puddle', W4: 'orders', W5: 'sparkle', W6: 'sun', R1: 'board', R2: 'rain', R3: 'pages', R4: 'moon', R5: 'leaf', R6: 'tired' });
/** Where a told thing came from (§9-4): seen (an eye), heard (an ear) or the village news (a note). */
const HOW_ICONS = Object.freeze({
  direct: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  heard: '<path d="M7 9a5 5 0 0 1 10 0c0 3.5-3 4.5-3 7.5a2.5 2.5 0 0 1-5 0"/><path d="M10 10a2 2 0 0 1 4 0"/>',
  news: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3M9 11h6M9 15h6"/>',
});
const svgOf = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
export const iconSvg = name => svgOf(HOW_ICONS[name] || mood.ICONS?.[name] || mood.ICONS?.sparkle || '');

/** An authored line at its scene's reading level; a missing version falls to the nearest lower one. */
export function lineText(id, level = LEVEL) { const line = LINES.get(id); return line ? line.levels[authoredLevel(level, line.levels)] ?? null : null; }
export const hasLine = id => LINES.has(id);
const cardLine = (npc, card, part, season = null) => inSeason(`${npc}.card.${card}-${part}.1`, season);
/** A card's news line, in the season of the life day its ref names. */
export const newsLine = (card, ref = null) => inSeason(`village.news.${card}.1`, seasonOf(dayOfRef(ref)));
const pairOf = (a, b) => PAIR_LIST.find(p => p.members.includes(a) && p.members.includes(b) && a !== b) ?? null;
/** The pairs' small differences as the band started (state.village.band.pairs): { PAIR01: step, … }. */
export function pairSteps(bandPairs) {
  return Object.fromEntries(PAIR_LIST.map(p => [p.scene, Math.max(0, Math.min(2, bandPairs?.[p.key]?.friction?.step ?? 0))]));
}
const here = (s, t) => s.startMs <= t && t < s.endMs;
const arrived = (s, t) => t >= (s.arriveMs ?? s.startMs);

/** The line a resident says at server time t, from what the plan has it doing (§8-4·§9-1): solving a card (alone, or
 * asking its pair / come to help), talking with its pair (the pair's line for their small difference's step), or — when
 * its card waits for it — that card's need (one talked about at one place, TALK_AT, only while it is there). Only once
 * it is where it does it; a pair line only when both are there (a resident alone never talks to the air — review F14).
 * Returns { id, icon, seen: [keys] } or null. waiting: the view's
 * cards still waiting ({ card, owner, status }); season: today's (a card line with seasons speaks in it, W10). */
export function sceneLine(segments, npc, t, { steps = {}, waiting = [], season = null } = {}) {
  const seg = segments.find(s => s.npc === npc && here(s, t));
  if (seg && arrived(seg, t) && seg.card && CARD_BY_ID.has(seg.card)) {
    const card = CARD_BY_ID.get(seg.card), together = seg.cardRole === 'partner'
      || segments.some(s => s.cardRole === 'partner' && s.card === seg.card && s.key === seg.key);
    const id = cardLine(npc, seg.card, together ? 'pair' : 'self', season);
    if (!LINES.has(id)) return null;
    const scene = together && card.paths?.pair?.scene, seen = [`line:${id}`, `card:${seg.card}:${together ? 'pair' : 'self'}`];
    if (scene && Object.hasOwn(steps, scene)) seen.push(`pair:${scene}:${steps[scene]}`);
    return { id, icon: CARD_ICONS[seg.card] || 'sparkle', seen, occurrence: `${seg.card}:${seg.key}:${together ? 'pair' : 'self'}` };
  }
  if (seg && arrived(seg, t) && seg.with) {
    const pair = pairOf(npc, seg.with), mate = segments.find(s => s.npc === seg.with && s.with === npc && here(s, t) && arrived(s, t));
    if (!pair || !mate) return null;
    const step = steps[pair.scene] ?? 0, id = `${npc}.pair.${pair.scene}-${step}.1`;
    return LINES.has(id) ? { id, icon: 'together', seen: [`line:${id}`, `pair:${pair.scene}:${step}`], occurrence: `${pair.scene}:${Math.min(seg.startMs, mate.startMs)}` } : null;
  }
  // C4's first waits for the player for days: away from the cafe its owner keeps her own lines (the mood layer), since the
  // player could not answer it there (screen review F2).
  const at = seg && arrived(seg, t) ? SPOT_BY_ID[seg.spot]?.place ?? null : null;
  const need = waiting.find(c => c.owner === npc && c.status === 'triggered' && (!TALK_AT[c.card] || TALK_AT[c.card] === at));
  // Lingering by the menu board over it once a day (§8-4 ③), she says why in her mood line — the card's own reason (§7-3 new-menu,
  // the view's segment carries its mood line only) — and the need waits.
  if (need && TALK_AT[need.card] && seg?.mood && seg.mood.startsWith(`${npc}.mood.${CARD_MOOD[npc]?.[need.card] ?? '-'}.`)) return null;
  if (need) { const id = cardLine(npc, need.card, 'trigger', season); if (LINES.has(id)) return { id, icon: CARD_ICONS[need.card] || 'sparkle', seen: [`line:${id}`], occurrence: `${need.card}:${need.key}:trigger` }; }
  return null;
}

// What a resident's own greeting reads from what it is doing (W10, §16 인사): its work at a push — the cafe's guests, the
// workshop's orders, the researcher's notes — is busy (a delivery, the quiet night cups and night carving greet by the band
// and the weather, whose night lines are theirs — W10 screen review); a rest archetype is resting (a doze greets no one).
const BUSY = Object.freeze({ 'cafe-owner': ['serve'], 'workshop-owner': ['craft'], researcher: ['notes'] });
const REST = new Set((generated.ARCHETYPES || []).filter(a => a.kind === 'rest').map(a => a.id));
const LATE_FROM = 23 * 60 + 30, LATE_TO = 5 * 60 + 30, WORKSHOP_LATE_FROM = 3 * 60;
/** A resident's own greeting when it has nothing to tell (W10): late at night (23:30–05:30 in my time — the workshop
 * owner's is its early waking, so only from 03:00, before that its night one; the researcher's counts night flowers,
 * which close in the rain, so a rainy night is its night-rain one), busy at its work, resting, else the band and the
 * weather. now: { band, weather, minute (my time, or null), archetype }. Returns the line's ID or null. */
export function greetLine(npc, { band = null, weather = null, minute = null, archetype = null } = {}) {
  if (archetype === 'doze') return null;
  const late = Number.isSafeInteger(minute) && !(npc === 'researcher' && weather === 'rain')
    && (npc === 'workshop-owner' ? minute >= WORKSHOP_LATE_FROM && minute < LATE_TO : minute >= LATE_FROM || minute < LATE_TO);
  const key = late ? 'late' : BUSY[npc]?.includes(archetype) ? 'busy' : REST.has(archetype) ? 'resting' : `${band}-${weather === 'rain' ? 'rain' : 'clear'}`;
  const id = `${npc}.greet.${key}.1`;
  return LINES.has(id) ? id : null;
}
const OFF_WEEKDAY = Object.fromEntries((generated.RESIDENTS || []).map(r => [r.id, r.offWeekday ?? null]));
/** Each resident's mood reason that is a card's own (§7-3 — C4 → new-menu): npc → { card: tag }. */
const CARD_MOOD = Object.fromEntries((generated.RESIDENTS || []).map(r => [r.id, Object.fromEntries((r.moods || []).filter(m => /^[CWR][1-6]$/.test(m.factor)).map(m => [m.factor, m.tag]))]));
/** What a resident is doing, in one line of its own (W10, §16 일과): its pair scene's while both are at it, the workshop
 * owner's waking on its day off in the morning, else its archetype's. now: { segments, t, band, lifeDay }. */
export function routineLine(npc, { segments = [], t = null, band = null, lifeDay = null } = {}) {
  const seg = segments.find(s => s.npc === npc && here(s, t));
  if (!seg) return null;
  const pair = seg.with && arrived(seg, t) && segments.some(s => s.npc === seg.with && s.with === npc && here(s, t) && arrived(s, t)) ? pairOf(npc, seg.with) : null;
  const off = band === 'morning' && Number.isSafeInteger(lifeDay) && dayKindOf(lifeDay, OFF_WEEKDAY[npc]) === 'off';
  const id = `${npc}.routine.${pair ? `pair-${pair.scene}` : off && LINES.has(`${npc}.routine.holiday-wake.1`) ? 'holiday-wake' : seg.archetype}.1`;
  return LINES.has(id) ? id : null;
}

/** The greeting's words (§9-4): the resident's hearsay frame for how it knows, filled with the card's news line and who
 * told it. null when the lines are missing (an old cache) — then nothing is said and nothing is marked told. */
export function hearsayText(npc, entry, level = LEVEL) {
  if (!entry) return null;
  const how = entry.how === 'direct' ? 'seen' : entry.how === 'heard' ? 'heard' : 'news', frame = `${npc}.hearsay.${how}.1`;
  const words = lineText(frame, level), news = lineText(newsLine(entry.card, entry.ref), level);
  if (!words || !news || how === 'heard' && !NAMES[entry.from]) return null;
  return { id: frame, text: words.replace('{news}', news).replace('{from}', NAMES[entry.from] || ''), icon: entry.how === 'direct' ? 'direct' : entry.how === 'heard' ? 'heard' : 'news',
    seen: [`line:${frame}`, `line:${newsLine(entry.card, entry.ref)}`] };
}

/** Whether a card waiting for its owner may be taken now by the player (W5: every card but the locked one and the two
 * that need the tea order). */
export const takeable = c => !!c && ['triggered', 'paused'].includes(c.status) && c.ready !== false && CARD_BY_ID.get(c.card)?.paths?.player?.ready === true && !CARD_BY_ID.get(c.card)?.locked;
/** A card talked about at one place (§12-1 — C4 at the menu board; the server's town/cards.mjs talkPlaceOf): its need shows there. */
export const TALK_AT = Object.freeze({ C4: 'cafe' });
/** Where such a card is taken up, as the notebook and the card's note say it (「찻집에서 」), or ''. */
export const talkWhere = card => (TALK_AT[card] === 'cafe' ? '찻집에서 ' : '');
/** The town's refusals of a card's answer (409) in its own words (core.mjs commandCard · life.mjs cardContactFor). Through
 * a WORLD account the error keeps only its code — the town's answer nests the words under error, as the gathering board
 * found — so the screen says these then; a code with no words here says nothing (the town is read again). */
const REFUSAL_WORDS = Object.freeze({ 'card-not-waiting': '그 일은 지금 함께할 수 없어요. 주인이 하는 일을 지켜봐 주세요.',
  'card-busy': '하던 생활을 먼저 닫아 주세요.', 'card-not-open': '함께하던 생활을 다시 열어 주세요.', 'card-choice-first': '먼저 하나 골라 주세요.',
  'stale-life-contact': '이 제안은 현재 화면에서 다시 확인해 주세요. 주인에게 직접 말을 걸면 언제든 열 수 있어요.',
  'conflicting-command': '같은 요청의 내용이 달라요.' });
/** A refusal's words: the town's own when they came, else these — naming whom the server names, as the screen has the
 * residents (places: where each is now, none asleep; holds: who a scene holds) and the player (location). */
export function refusalWords(code, message, { card = null, places = {}, holds = {}, location = null } = {}) {
  if (message && message !== code) return message;
  const c = CARD_BY_ID.get(card), owner = c?.owner, all = owner ? [owner, ...(c.paths?.player?.with || [])] : [];
  if (owner && code === 'resident-asleep') return `${NAMES[all.find(npc => !places[npc]) || owner]}은 지금 자고 있어요. 아침에 다시 만나요.`;
  if (owner && code === 'card-owner-busy') return `${NAMES[all.find(npc => holds[npc]) || owner]}이 하던 장면을 마친 뒤 함께할 수 있어요.`;
  // Beside her somewhere else, a card talked about at its own place is turned down for that place; else for being far.
  if (owner && code === 'card-too-far') return places[owner]?.to === location && TALK_AT[card] && TALK_AT[card] !== location
    ? `${NAMES[owner]}에게는 찻집에서 말을 걸어 주세요.` : `${NAMES[owner]} 가까이 가서 말을 걸어 주세요.`;
  return REFUSAL_WORDS[code] ?? null;
}

/** What the place's panel shows of the cards and the residents here (§8-3·§9-4): the resident who greets the player
 * with what it heard (one, once — the newest it may tell), the cards whose owner is here (its need, and 「같이 해요」 or
 * the paused one to go on with — or, a card talked about at another place, away: its owner's line saying where), and at
 * home the news note (the newest three, never their days).
 * W10: season is today's (a need with seasons speaks in it); with nothing heard to tell, own(npc) names the line a resident
 * here says of itself (its greeting, or what it is doing — the app's choice) and the first one with words is own. */
export function placeModel({ location, residentsHere = [], hearsay = {}, cards = [], news = [], take = null, level = LEVEL, season = null, own = null }) {
  const greet = residentsHere.map(npc => ({ npc, line: hearsayText(npc, hearsay[npc], level) })).find(g => g.line) ?? null;
  const open = take && ['with', 'resolved'].includes(take.status) ? take : null;
  const needs = open ? [] : cards.filter(c => takeable(c) && residentsHere.includes(c.owner) && (!TALK_AT[c.card] || TALK_AT[c.card] === location))
    .map(c => ({ card: c.card, key: c.key, owner: c.owner, paused: c.status === 'paused',
    title: CARD_BY_ID.get(c.card).title, line: lineText(cardLine(c.owner, c.card, c.status === 'paused' ? 'offer' : 'trigger', season), level) }));
  // Its owner here but the card opened only at its own place (C4 at the cafe's menu board): one line of hers says so, no
  // button — the server takes it up only there (screen review F3).
  const away = open ? [] : cards.filter(c => takeable(c) && residentsHere.includes(c.owner) && TALK_AT[c.card] && TALK_AT[c.card] !== location)
    .map(c => ({ card: c.card, key: c.key, owner: c.owner, line: lineText(cardLine(c.owner, c.card, 'away'), level) })).filter(a => a.line);
  const note = location === 'home' ? news.slice(0, 3).map(n => ({ ref: n.ref, card: n.card, lineId: newsLine(n.card, n.ref), text: lineText(newsLine(n.card, n.ref), level) })).filter(n => n.text) : [];
  const mine = !greet && typeof own === 'function' ? residentsHere.map(npc => ({ npc, id: own(npc) })).find(o => o.id && lineText(o.id, level)) ?? null : null;
  return { greet: greet && { npc: greet.npc, ref: hearsay[greet.npc].ref, ...greet.line },
    own: mine && { npc: mine.npc, id: mine.id, kind: LINES.get(mine.id).kind, text: lineText(mine.id, level), icon: 'quiet', seen: [`line:${mine.id}`] }, needs, away, note, open };
}

/** The offer standing for this window (§8-3): a card's contact issued here that the screen may still show — the owner's
 * line, and which card. */
export function offerModel(contact, { surfaceId, fence, level = LEVEL }) {
  if (!contact || !['issued', 'delivered'].includes(contact.state) || contact.issuedSurfaceId !== surfaceId || contact.issuedFence !== fence) return null;
  const card = CARD_BY_ID.get(contact.card);
  if (!card) return null;
  const id = cardLine(card.owner, card.id, 'offer');
  return { id: contact.id, card: card.id, key: contact.key, owner: card.owner, lineId: id, text: lineText(id, level) || '같이 할래요?', icon: CARD_ICONS[card.id] || 'sparkle' };
}

/** The choosing panel's model (§8-3 나와 함께): the card, its owner's words, the choices (only those the server allows
 * now), the one chosen, and after it is done the result line with its feedback. */
export function takeModel(take) {
  const card = take && CARD_BY_ID.get(take.card);
  if (!card) return null;
  const done = take.status === 'resolved';
  return { card: card.id, title: card.title, owner: card.owner, done,
    line: take.newTea?.line ?? lineText(cardLine(card.owner, card.id, done ? 'result' : 'offer'), take.level || LEVEL), lineId: cardLine(card.owner, card.id, done ? 'result' : 'offer'),
    choices: take.newTea ? take.newTea.choices.map(c => ({ ...c, chosen: take.choice === c.id }))
      : (take.choices || []).map(choice => ({ id: choice, label: choiceLabel(card.id, choice), chosen: take.choice === choice })),
    ...(take.newTea ? { newTea: take.newTea } : {}),
    chosen: take.choice ?? null, eventId: take.eventId ?? null, activity: `card.${card.id}`, icon: CARD_ICONS[card.id] || 'sparkle' };
}
/** Atlas's four answers (§20-3 — never new words), as the 「…」 under a result shows them. */
export const FEEDBACK = Object.freeze([['helpful', '좋았어요'], ['not_fit', '안 맞았어요'], ['too_much', '많았어요'], ['want_more', '더 하고 싶어요']]);

/** The offer by its owner's name: one small card with the owner's words and three answers. update() runs each frame with
 * { offer, labelAt, blocked }; the card hangs over the owner's name (docked at the scene's foot when the name is off
 * screen), the owner gestures for its first 8 seconds and the card goes after 20 (§8-3, NPC:229). Returns
 * { shown, gesture } so the scene can pose the owner. */
export function createOffer(container, { onAccept, onLater, onToday, onLess, live } = {}) {
  if (!container) return { update: () => ({ shown: false, gesture: false }), close() {} };
  let el = null, current = null, shownAt = 0, menu = false;
  const GESTURE_MS = 8000, LINE_MS = 20000, GAP = 14;
  // An answered or timed-out offer stays gone for its id, however long the server still lists it.
  const done = new Set();
  function build(offer) {
    el = document.createElement('div'); el.className = 'offer-card'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${NAMES[offer.owner]}의 제안`);
    el.innerHTML = '<p class="offer-head"><span class="offer-icon"></span><span class="offer-name"></span></p><p class="offer-text"></p>'
      + '<div class="offer-actions"><button type="button" class="felt primary offer-accept">같이 해요</button><button type="button" class="felt offer-later">다음에요</button>'
      + '<button type="button" class="felt subtle offer-more" aria-expanded="false" aria-label="다른 답 보기">…</button></div>'
      + '<div class="offer-menu" hidden><button type="button" class="felt offer-today">오늘은 다른 일</button><button type="button" class="felt offer-less">이런 일은 덜 추천</button></div>';
    el.querySelector('.offer-icon').innerHTML = iconSvg(offer.icon);
    el.querySelector('.offer-name').textContent = NAMES[offer.owner];
    el.querySelector('.offer-text').textContent = offer.text;
    const act = fn => () => { const o = current; if (o) { done.add(o.id); close(); current = null; fn?.(o); } };
    el.querySelector('.offer-accept').addEventListener('click', act(onAccept));
    el.querySelector('.offer-later').addEventListener('click', act(onLater));
    el.querySelector('.offer-today').addEventListener('click', act(onToday));
    el.querySelector('.offer-less').addEventListener('click', act(onLess));
    el.querySelector('.offer-more').addEventListener('click', () => { menu = !menu; el.querySelector('.offer-menu').hidden = !menu; el.querySelector('.offer-more').setAttribute('aria-expanded', String(menu)); });
    container.append(el);
    if (live) live.textContent = `${NAMES[offer.owner]}: ${offer.text}`;
  }
  function close() {
    if (el?.contains(document.activeElement)) container.closest?.('[tabindex]')?.focus?.();
    el?.remove(); el = null; menu = false;
  }
  function update({ offer = null, labelAt = () => null, blocked = false, now = performance.now() } = {}) {
    if (!offer || done.has(offer.id)) { if (el) close(); current = null; return { shown: false, gesture: false }; }
    if (current?.id !== offer.id) { close(); current = offer; shownAt = now; }
    if (now - shownAt >= LINE_MS) { done.add(offer.id); close(); current = null; return { shown: false, gesture: false }; }
    if (blocked) { if (el) el.hidden = true; return { shown: false, gesture: now - shownAt < GESTURE_MS }; }
    if (!el) build(offer);
    el.hidden = false;
    const at = labelAt(offer.owner), box = container.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, gutter = 16;
    el.classList.toggle('is-docked', !at);
    if (at) {
      const x = Math.max(gutter, Math.min(box.width - w - gutter, at.x - w / 2)), over = at.y - GAP - h, y = over >= gutter ? over : at.y + GAP;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    } else el.style.transform = '';
    return { shown: true, gesture: now - shownAt < GESTURE_MS, element: el };
  }
  // The answer sent: the offer goes from the screen at once (the server marks it at that command).
  return { update, close: id => { if (id) done.add(id); close(); current = null; } };
}
