/** Town language, bridge design §3-3/§10. This is a presentation preference, never a skill,
 * relationship, reward or a resident's memory. All time and evidence come from the host. */
export const LEVELS = Object.freeze(['L1', 'L2', 'L3', 'L4']);
export const CHANNELS = Object.freeze(['reading', 'listening']);
export const RULE = 'town-ladder-r1';
const DAY = 86400000;
const index = level => Math.max(0, LEVELS.indexOf(level));
export const lowerLevel = level => LEVELS[Math.max(0, index(level) - 1)];
const upper = level => LEVELS[Math.min(3, index(level) + 1)];
const count = value => Number.isSafeInteger(value) && value >= 0;
const stamp = at => { if(!Number.isSafeInteger(at))throw new TypeError('Language time must be epoch milliseconds');return at; };
const time = value => Number.isSafeInteger(value) ? value : 0;
export const basicReadingDifficulty = level => level === 'L1' ? 1 : 2;
const channelOf = channel => { if (!CHANNELS.includes(channel)) throw new TypeError('Unknown language channel'); return channel; };
const seat = (level, at) => ({ stable: LEVELS.includes(level) ? level : 'L1', source: 'placement', easedStreak: 0,
  smoothStreak: 0, fixed: false, lastOffer: null, evidence: 0, at: stamp(at) });
export function initialLadder(placement = {}, at = 0) {
  return { rule: RULE, reading: seat(placement.reading, at), listening: seat(placement.listening, at) };
}
export function validLadder(value) {
  return value?.rule === RULE && CHANNELS.every(channel => {
    const row = value[channel];
    return row && LEVELS.includes(row.stable) && ['placement', 'offer', 'eased', 'self'].includes(row.source)
      && count(row.easedStreak) && count(row.smoothStreak) && typeof row.fixed === 'boolean'
      && Number.isSafeInteger(row.at) && (row.evidence === undefined || count(row.evidence))
      && (row.lastOffer === null || Number.isSafeInteger(row.lastOffer?.at)
        && ['accepted', 'declined', null].includes(row.lastOffer.answer) && count(row.lastOffer.evidence)
        && (row.lastOffer.day === undefined || Number.isSafeInteger(row.lastOffer.day)));
  });
}
/** An older snapshot gains the ladder once. Later placement changes cannot overwrite a choice. */
export const restoreLadder = (value, placement, at = 0) => validLadder(value) ? structuredClone(value) : initialLadder(placement, at);
/** The host's placement (bridge §4-3) reaches a seat the ladder has not moved itself — still on its placement, never fixed:
 * the player may answer 「처음 이야기는 이 말로 해 볼까요?」 after the ladder stood (any first command makes it, W9
 * design review P1). Scenes counted on the old placement do not carry over; an offer, an easing or the player's choice
 * ends the following. Returns the same ladder when nothing moved. */
export function followPlacement(ladder, placement, now = 0) {
  const next = restoreLadder(ladder);
  let moved = false;
  for (const channel of CHANNELS) {
    const row = next[channel], level = placement?.[channel];
    if (!LEVELS.includes(level) || row.source !== 'placement' || row.fixed || row.stable === level) continue;
    Object.assign(row, { stable: level, easedStreak: 0, smoothStreak: 0, lastOffer: null, at: stamp(now) }); moved = true;
  }
  return moved ? next : ladder;
}
export function authoredLevel(level, versions) {
  const available = Array.isArray(versions) ? versions : Object.keys(versions || {});
  if (!available.includes('L1')) throw new TypeError('Every Town scene needs L1');
  return LEVELS.slice(0, index(level) + 1).reverse().find(l => available.includes(l));
}
// TOPIK I 1 -> L1, I 2/3 -> L2, II 1 -> L3, II 2 -> L4. Tea never supplies II evidence.
const inBand = (skill, difficulty, level, channel) => skill.startsWith(`${index(level) < 2 ? 'ko' : 'ko2'}.${channel}.`)
  && (level === 'L1' ? difficulty === 1 : level === 'L2' ? difficulty >= 2 : level === 'L3' ? difficulty === 1 : difficulty === 2);
export function mainEvidence(summary, { channel, level, responseFormat }) {
  if (summary?.evidenceComplete !== true || responseFormat === 'cup-compose' && index(level) >= 2) return false;
  const skills = (summary.skills || []).filter(skill => Object.entries(skill.levels || {}).some(([difficulty]) => inBand(skill.id || skill.skillId || '', Number(difficulty), level, channel)));
  const passed = skills.filter(skill => Object.entries(skill.levels || {}).some(([difficulty, cell]) =>
    inBand(skill.id || skill.skillId || '', Number(difficulty), level, channel) && cell.formats?.[responseFormat]?.status === 'recent-independent'));
  return skills.length > 0 && passed.length >= Math.min(2, skills.length);
}
/** Deterministic, called at a scene boundary only. Seeing an offer is recorded separately. */
export function pickSceneLevel({ channel = 'reading', ladder, summary = null, settings = {}, today = {}, scene, now = 0, day = null }) {
  const row = restoreLadder(ladder)[channelOf(channel)], stable = settings.easyLanguage === true ? 'L1' : row.stable;
  const level = authoredLevel(stable, scene.versions), last = row.lastOffer;
  const evidence = (Number.isSafeInteger(summary?.evidenceRevision) ? summary.evidenceRevision : 0) + (row.evidence || 0);
  const askedToday = last && (Number.isSafeInteger(day) && Number.isSafeInteger(last.day)
    ? day === last.day : Math.floor(last.at / DAY) === Math.floor(stamp(now) / DAY));
  const declined = last?.answer === 'declined' && (now - time(last.at) < 7 * DAY || evidence <= last.evidence);
  const basis = mainEvidence(summary, { channel, level: row.stable, responseFormat: scene.responseFormat || 'single-choice' }) ? 'main'
    : row.smoothStreak >= 5 ? 'town' : null;
  const blocked = row.fixed || settings.easyLanguage === true || ['low', 'tired', 'no_time'].includes(today.condition) || today.energy === 'low'
    || row.stable === 'L4' || askedToday || declined;
  return { level, offer: basis && !blocked ? { to: upper(row.stable), basis } : null,
    why: settings.easyLanguage === true ? 'self-easy' : level !== stable ? 'authored-fallback' : 'stable' };
}
/** The same line's third telling is lower. Slower and stop never change language level. */
export function onHelp({ sceneLevel, lineLevel = sceneLevel, help, repeatsOnLine = 0, lowerRetellsInScene = 0 }) {
  if (!['meaning', 'repeat', 'slower', 'stop', 'reopen'].includes(help)) throw new TypeError('Unknown language help');
  const lowers = help === 'meaning' || help === 'repeat' && repeatsOnLine === 2;
  const retells = lowerRetellsInScene + Number(lowers);
  return { lineLevel: lowers ? lowerLevel(lineLevel) : lineLevel,
    sceneLevel: lowers && retells === 2 ? lowerLevel(sceneLevel) : sceneLevel, lowerRetellsInScene: retells };
}
export function markOffer(ladder, channel, now, evidence = 0, day = null) {
  const next = restoreLadder(ladder), row = next[channelOf(channel)];
  row.lastOffer = { at: stamp(now), answer: null, evidence, ...(Number.isSafeInteger(day) ? { day } : {}) }; row.at = stamp(now); return next;
}
export function answerOffer(ladder, channel, answer, now) {
  const next = restoreLadder(ladder), row = next[channelOf(channel)];
  if (!row.lastOffer || row.lastOffer.answer !== null || !['accepted', 'declined'].includes(answer)) throw new TypeError('No language offer to answer');
  row.lastOffer.answer = answer; row.at = stamp(now);
  if (answer === 'accepted' && !row.fixed) Object.assign(row, { stable: upper(row.stable), source: 'offer', easedStreak: 0, smoothStreak: 0 });
  return next;
}
export function closeScene({ ladder, channel, level, outcome, now = 0 }) {
  const next = restoreLadder(ladder), row = next[channelOf(channel)];
  if (!['smooth', 'helped-once', 'eased', 'stopped'].includes(outcome)) throw new TypeError('Unknown scene outcome');
  // Stopping is not difficulty evidence. A fixed preference and an older in-flight scene cannot move a new stable L.
  if (outcome === 'stopped' || row.fixed || level !== row.stable) return next;
  row.at = stamp(now); row.evidence = (row.evidence || 0) + 1;
  row.smoothStreak = outcome === 'smooth' ? row.smoothStreak + 1 : 0;
  row.easedStreak = outcome === 'eased' ? row.easedStreak + 1 : 0;
  if (row.easedStreak >= 2) Object.assign(row, { stable: lowerLevel(row.stable), source: 'eased', easedStreak: 0, smoothStreak: 0, lastOffer: null });
  return next;
}
export function chooseLevel(ladder, channel, choice, now = 0) {
  const next = restoreLadder(ladder), row = next[channelOf(channel)];
  if (!['easier', 'broader', 'always-easy', 'auto'].includes(choice)) throw new TypeError('Unknown language preference');
  Object.assign(row, { stable: choice === 'always-easy' ? 'L1' : choice === 'easier' ? lowerLevel(row.stable) : choice === 'broader' ? upper(row.stable) : row.stable,
    fixed: choice !== 'auto', source: 'self', easedStreak: 0, smoothStreak: 0, lastOffer: null, at: stamp(now) }); return next;
}
/** Per-channel last-write merge; equal timestamps choose the lower level. */
export function mergeLadders(a, b) {
  const left = restoreLadder(a), right = restoreLadder(b), out = { rule: RULE };
  for (const channel of CHANNELS) {
    const x = left[channel], y = right[channel], delta = time(x.at) - time(y.at);
    out[channel] = structuredClone(delta > 0 ? x : delta < 0 ? y : index(x.stable) <= index(y.stable) ? x : y);
  }
  return out;
}
