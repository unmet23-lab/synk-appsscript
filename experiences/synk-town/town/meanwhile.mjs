/** What changed while the player was away (vertical slice design §10-2, W6). A band's close keeps what it changed that a
 * returning player can see — a trace still on screen (the tray's shim, the observation board, today's tea, a new tea),
 * a resident resting at a spot the player made, a pair's small difference one step further — in the village's newest
 * few, with the time it happened and the end of its band. Only what the residents did is kept: nothing the player took
 * part in (they did it themself, and it never spreads — G6), so a village left alone and one visited without doing
 * anything keep the same changes (§15-2). A new visit's lines come from the changes of the bands that closed before it
 * began and happened after the last visit ended: at most a few, a trace first, then a habit, then a pair, the newest
 * first, one line a resident, and nothing at all when nothing changed (never 「nothing happened」). The lines speak of
 * the result as it stands now, never of the time between (G3 — the checker's forbidden words). Plain module; every
 * 〔초기값〕 comes from the parameter version's meanwhile section.
 */
import { paramsFor } from './params.mjs';

const M = params => (params ?? paramsFor()).meanwhile;
/** The traces that make a line, by the card's trace object and field (null: any field of the object). */
export const TRACE_FRAMES = Object.freeze([
  Object.freeze({ object: 'cafe-tray', field: 'shim', frame: 'tray' }),
  Object.freeze({ object: 'observation-board', field: null, frame: 'board' }), // every field: 「손봐 두었어요」 is true of each (design review F6)
  Object.freeze({ object: 'leaf-jar', field: 'tea', frame: 'today-tea' }),
  Object.freeze({ object: 'leaf-jar', field: 'menu', frame: 'new-tea' }),
]);
export const FRAMES = Object.freeze([...TRACE_FRAMES.map(t => t.frame), 'habit', 'pair']);
const RANK = Object.freeze({ trace: 0, habit: 1, pair: 2 });
export const lineId = frame => `village.changes.${frame}.1`;
const frameOf = trace => trace && TRACE_FRAMES.find(t => t.object === trace.object && (t.field === null || t.field === trace.field)) || null;

/** One closed band's changes, in time order. resolved: the band's results ({ ref, card, path, public, actors, atMs }),
 * cardOf(id) its card; uses: the habit uses ({ npc, spot, atMs }); steps: the pair steps ({ pair, members, atMs }).
 * A result the player was in is not public, so it never comes in. */
export function bandChanges({ bandEndMs, resolved = [], cardOf, uses = [], steps = [] }) {
  const out = [];
  for (const line of resolved) {
    const frame = line.public ? frameOf(cardOf(line.card)?.trace) : null;
    if (frame) out.push({ kind: 'trace', frame: frame.frame, card: line.card, ref: line.ref, actors: [...line.actors],
      object: cardOf(line.card).trace.object, field: cardOf(line.card).trace.field, at: line.atMs, bandEnd: bandEndMs });
  }
  for (const use of uses) out.push({ kind: 'habit', frame: 'habit', actors: [use.npc], spot: use.spot, at: use.atMs, bandEnd: bandEndMs });
  for (const step of steps) out.push({ kind: 'pair', frame: 'pair', pair: step.pair, actors: [...step.members], at: step.atMs, bandEnd: bandEndMs });
  return out.sort((a, b) => a.at - b.at || RANK[a.kind] - RANK[b.kind]);
}
/** The village keeps its newest few changes; past the bound the lowest rank goes first — a pair's step, then a habit, then
 * the oldest trace — so a trace still on screen is never pushed out by later small things (design review F4). */
export function keepChanges(village, changes, params) {
  if (!changes.length) return;
  const kept = [...(village.changes || []), ...changes], max = M(params).changesKept;
  for (const kind of ['pair', 'habit', 'trace']) {
    while (kept.length > max) {
      const i = kept.findIndex(c => c.kind === kind);
      if (i < 0) break;
      kept.splice(i, 1);
    }
  }
  village.changes = kept;
}

/** A visit's lines (§10-2): visit is { startAt, since } (since null on the first visit or an old world: none).
 * tracesNow is the village's traces at the time of asking ({ object: { field: { value, path } } }): a trace line is
 * kept only while the residents' trace still stands. Each line is { id, npc, npc2? } — the screen fills the names. */
export function meanwhileLines(changes, visit, tracesNow, params) {
  if (!visit || !Number.isSafeInteger(visit.since) || !Number.isSafeInteger(visit.startAt)) return [];
  const stands = c => c.kind !== 'trace' || (tracesNow?.[c.object]?.[c.field] && tracesNow[c.object][c.field].path !== 'player');
  const found = (changes || []).filter(c => c.bandEnd <= visit.startAt && c.at >= visit.since && c.at < visit.startAt && stands(c))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.at - a.at);
  const told = new Set(), lines = [];
  for (const c of found) {
    if (lines.length >= M(params).lines) break;
    if (c.actors.some(npc => told.has(npc))) continue;
    for (const npc of c.actors) told.add(npc);
    lines.push({ id: lineId(c.frame), npc: c.actors.at(-1), ...(c.kind === 'pair' ? { npc: c.actors[0], npc2: c.actors[1] } : {}) });
  }
  return lines;
}

const plainId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value);
const ms = Number.isSafeInteger;
// A pair's key is its two residents' ids (town/data/pairs.json).
const pairKey = value => typeof value === 'string' && /^[a-z][a-z-]{0,39}\|[a-z][a-z-]{0,39}$/.test(value);
/** Whether stored changes are whole: the newest few, known kinds and frames, times and actors only. */
export function validChanges(changes, params) {
  return changes === undefined || Array.isArray(changes) && changes.length <= M(params).changesKept && changes.every(c => !!c && RANK[c.kind] !== undefined
    && FRAMES.includes(c.frame) && ms(c.at) && ms(c.bandEnd) && Array.isArray(c.actors) && c.actors.length >= 1 && c.actors.length <= 2 && c.actors.every(plainId)
    && (c.kind !== 'trace' || plainId(c.card) && plainId(c.ref) && plainId(c.object) && plainId(c.field))
    && (c.kind !== 'habit' || plainId(c.spot)) && (c.kind !== 'pair' || pairKey(c.pair) && c.actors.length === 2));
}
