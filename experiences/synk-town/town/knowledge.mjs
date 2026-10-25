/** What residents know of each other's doings (vertical slice design §9-2·§9-3, W5). Only public events spread — the
 * cards the residents solved alone or together; anything the player took part in stays with the residents in it, as their
 * private knowledge (G6). Three ways, all at a band's close in time order so the result never depends on when or how
 * often the world is settled (§15-3): seeing it happen (direct — the residents at that place when it was confirmed, the
 * doers aside), hearing it at a pair scene (heard — each tells the other the newest the other does not know, at most a
 * few a life day each, never to its doer), and the village news (news — when a new life day opens, the last day's
 * newsworthy cards, a visible trace first). Each resident keeps its newest few; the news keeps its own. A greeting
 * tells the player the newest a resident knows and has not told yet (told is the player's side, like the seen ledger).
 * Entries copy what they say (review F10): { ref, card, path, actors, place, how, from? }. Plain module; every
 * 〔초기값〕 comes from the parameter version's knowledge section.
 */
import { CARD_BY_ID } from './cards.mjs';
import { paramsFor } from './params.mjs';

const K = params => (params ?? paramsFor()).knowledge;
export const HOWS = Object.freeze(['direct', 'heard', 'news', 'private']);
export const initialKnowledge = () => ({ lifeDay: null, heard: {}, known: {} });

const entryOf = (line, how, from = null) => ({ ref: line.ref, card: line.card, path: line.path, actors: [...line.actors], place: line.place, how, ...(from ? { from } : {}) });
const knows = (k, npc, ref) => (k.known[npc] || []).some(e => e.ref === ref);
/** A resident learns one thing (once; its newest few are kept). */
function learn(k, npc, entry, params) {
  if (knows(k, npc, entry.ref)) return false;
  k.known[npc] = [...(k.known[npc] || []), entry].slice(-K(params).kept);
  return true;
}
const residentActors = line => line.actors.filter(a => a !== 'player');

/** A band's close (§9-3): its public results are kept for the news and seen by whoever was at that place, and its pair
 * scenes pass on what each knows. where(npc, ms) is the place a resident is at then (arrived, or still at the one it
 * is leaving) or null asleep. village: { happened, knowledge } — changed in place. */
export function learnBand(village, { lifeDay, resolved, scenes }, where, params) {
  const p = K(params), k = (village.knowledge ||= initialKnowledge());
  if (k.lifeDay !== lifeDay) { k.lifeDay = lifeDay; k.heard = {}; }
  const items = [...resolved.filter(line => line.public).map(line => ({ at: line.atMs, line })), ...scenes.map(scene => ({ at: scene.atMs, scene }))]
    .sort((a, b) => a.at - b.at || (a.line ? 0 : 1) - (b.line ? 0 : 1));
  for (const item of items) {
    if (item.line) {
      const line = item.line;
      village.happened = [...(village.happened || []), { ...entryOf(line, 'direct'), lifeDay, atMs: line.atMs }].slice(-p.happenedKept);
      for (const npc of Object.keys(ROLE)) if (!line.actors.includes(npc) && where(npc, line.atMs) === line.place) learn(k, npc, entryOf(line, 'direct'), params);
      continue;
    }
    // A pair scene: each tells the other the newest public thing the other does not know and did not do.
    const [a, b] = item.scene.members;
    for (const [teller, hearer] of [[a, b], [b, a]]) {
      if ((k.heard[hearer] || 0) >= p.heardPerDay) continue;
      const tale = [...(k.known[teller] || [])].reverse().find(e => e.how !== 'private' && !knows(k, hearer, e.ref) && !e.actors.includes(hearer));
      if (tale && learn(k, hearer, { ...tale, how: 'heard', from: teller }, params)) k.heard[hearer] = (k.heard[hearer] || 0) + 1;
    }
  }
}
const ROLE = Object.freeze({ 'cafe-owner': true, 'workshop-owner': true, researcher: true });

/** A new life day's news (§9-3 마을 소식): the last day's public results whose card is news — a visible trace before a new
 * tea before an agreement, then in time order — a few of them, to the village's news and to every resident but the doers. */
export function morningNews(village, lastDay, params) {
  const p = K(params), k = (village.knowledge ||= initialKnowledge());
  // A day's news is told once, however often its morning is reached.
  if ((village.news || []).some(n => n.lifeDay === lastDay)) return 0;
  const rank = line => CARD_BY_ID[line.card]?.news ?? null;
  const fresh = (village.happened || []).filter(line => line.lifeDay === lastDay && rank(line) !== null
    && (!CARD_BY_ID[line.card].newsPaths || CARD_BY_ID[line.card].newsPaths.includes(line.path)) && !(village.news || []).some(n => n.ref === line.ref))
    .sort((a, b) => rank(a) - rank(b) || a.atMs - b.atMs).slice(0, p.newsPerDay);
  for (const line of fresh) {
    village.news = [...(village.news || []), { ref: line.ref, card: line.card, path: line.path, actors: [...line.actors], place: line.place, lifeDay: lastDay }].slice(-p.newsKept);
    for (const npc of Object.keys(ROLE)) if (!line.actors.includes(npc)) learn(k, npc, entryOf(line, 'news'), params);
  }
  return fresh.length;
}

/** A card done with the player: those in it know it, privately (§9-2, G6) — it never spreads. */
export function learnPrivate(village, line, params) {
  const k = (village.knowledge ||= initialKnowledge());
  for (const npc of residentActors(line)) learn(k, npc, entryOf(line, 'private'), params);
}

/** Whether a known thing can be told as hearsay: the greeting's words are its card's news line (§9-4), so only a card
 * that makes news, by a path that does (W5b — the others still spread among the residents, they are just not told). */
export const tellable = e => CARD_BY_ID[e.card]?.news != null && (!CARD_BY_ID[e.card].newsPaths || CARD_BY_ID[e.card].newsPaths.includes(e.path));
/** What a resident would tell the player when greeted (§9-4): the newest public thing it knows, can tell and has not
 * told yet, that it did not do itself — or null. Forgetting never touches public things; private ones are not hearsay. */
export function hearsayFor(village, npc) {
  const told = new Set(village.told?.[npc] || []);
  return [...(village.knowledge?.known?.[npc] || [])].reverse().find(e => e.how !== 'private' && tellable(e) && !told.has(e.ref) && !e.actors.includes(npc)) ?? null;
}
/** A resident told the player one thing (the greeting showed it): never again by that resident. */
export function tell(village, npc, ref, params) {
  if ((village.told?.[npc] || []).includes(ref)) return false;
  village.told = { ...(village.told || {}), [npc]: [...(village.told?.[npc] || []), ref].slice(-K(params).toldKept) };
  return true;
}
/** The things done with the player a resident knows (the notebook's 「주민이 아는 나」), without what it was asked to forget. */
export function privateOf(village, npc, forgotten = []) {
  const gone = new Set(forgotten.filter(item => item.npc === npc).map(item => item.target));
  return (village.knowledge?.known?.[npc] || []).filter(e => e.how === 'private' && !gone.has(e.ref));
}
/** The news a note shows (§9-3): the newest few, newest first, never their days (G3). */
export const noteOf = (village, params) => [...(village.news || [])].reverse().slice(0, K(params).noteShows)
  .map(({ ref, card, path, actors, place }) => ({ ref, card, path, actors: [...actors], place }));

const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const entryOk = e => !!e && id(e.ref) && Object.hasOwn(CARD_BY_ID, e.card) && ['self', 'pair', 'player'].includes(e.path)
  && Array.isArray(e.actors) && e.actors.every(id) && typeof e.place === 'string' && HOWS.includes(e.how) && (e.from === undefined || Object.hasOwn(ROLE, e.from));
/** Whether the stored knowledge, news, happenings and what was told are whole. */
export function validKnowledge(village, params) {
  const p = K(params), k = village.knowledge;
  if (k !== undefined && !(k && (k.lifeDay === null || Number.isSafeInteger(k.lifeDay)) && k.heard && typeof k.heard === 'object'
    && Object.entries(k.heard).every(([npc, n]) => Object.hasOwn(ROLE, npc) && Number.isSafeInteger(n) && n >= 0)
    && k.known && Object.entries(k.known).every(([npc, list]) => Object.hasOwn(ROLE, npc) && Array.isArray(list) && list.length <= p.kept && list.every(entryOk)))) return false;
  if (village.happened !== undefined && !(Array.isArray(village.happened) && village.happened.length <= p.happenedKept
    && village.happened.every(e => entryOk(e) && Number.isSafeInteger(e.lifeDay) && Number.isSafeInteger(e.atMs)))) return false;
  if (village.news !== undefined && !(Array.isArray(village.news) && village.news.length <= p.newsKept && village.news.every(e => entryOk({ ...e, how: 'news' }) && Number.isSafeInteger(e.lifeDay)))) return false;
  return village.told === undefined || !!village.told && Object.entries(village.told).every(([npc, list]) => Object.hasOwn(ROLE, npc) && Array.isArray(list) && list.length <= p.toldKept && list.every(id));
}
