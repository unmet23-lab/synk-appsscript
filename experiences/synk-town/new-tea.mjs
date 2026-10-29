// C4's authored preference scene (§12). Every choice is valid; none is a learning answer.
import { openDialogue, helpDialogue, dialogueLevel } from './dialogue.mjs';
import * as generated from './town/data.gen.mjs';
const LEVELS = ['L1', 'L2', 'L3', 'L4'];
// W10: the words live in the authored scene (town/data/lines/new-tea.json → SCENES), checked like every other line. Read
// through the namespace: for the cache's ten minutes after a publish a browser may still hold the generated data from
// before the scene — then this module still loads (the town opens) and only this talk has no words to show.
const SCENE = generated.SCENES?.['cafe-alley.day.new-tea'] ?? null;
const per = pick => Object.fromEntries(LEVELS.map(level => [level, SCENE ? pick(SCENE.versions[level]) : null]));
const turnOf = (version, key) => version.turns.find(t => t.key === key);
const SCRIPT = SCENE ? Object.fromEntries(SCENE.versions.L1.turns.map(({ key, choices }) => [key, { lines: per(v => turnOf(v, key).line),
  choices: choices.map(({ id }) => ({ id, labels: per(v => turnOf(v, key).choices.find(c => c.id === id).text) })) }])) : {};
const SMELL = per(v => v.aroma), RESULT = per(v => v.result), RESULT_AROMA = per(v => v.resultAroma), MANUAL = per(v => v.manual), GOODBYE = per(v => v.stop);
// At L1 「무슨 뜻이에요?」 shows a picture card with the line cut short (§12-2 · §16-1) — only when the turn was at L1 when it
// was pressed (a higher level goes one level down first, bridge §10-1), and it stays for the turn through 「다시 말해 주세요」·
// 「천천히 말해 주세요」 (W10 screen review).
const PICTURES = SCENE?.versions.L1.pictures ?? {};
export const goodbye = level => GOODBYE[level] || GOODBYE.L2;
/** The goodbye as a line the screen hangs by the cafe owner's name after 「그만할래요」 (W10 — W9 screen review F2). */
export const GOODBYE_LINE = !SCENE ? null : Object.freeze({ id: 'cafe-alley.day.new-tea.stop', npc: 'cafe-owner', icon: 'cup', levels: Object.freeze({ ...GOODBYE }) });
const keyOf = state => state.turn === 0 ? 'offer' : state.turn === 1 ? 'taste' : state.taste;
export function startNewTea(level) {
  return { turn: 0, first: null, taste: null, final: null, honey: null, manual: false, done: false, lastHelp: null, picture: false,
    dialogue: openDialogue({ id: 'cafe-alley.day.new-tea', level }) };
}
export function validNewTea(state) {
  const d = state?.dialogue;
  return !!state && [0, 1, 2].includes(state.turn) && [null, 'sip', 'smell'].includes(state.first)
    && [null, 'less', 'same', 'aroma'].includes(state.taste) && [null, 'agree', 'pour', 'menu', 'serve', 'more', 'thanks'].includes(state.final)
    && [null, 0, 1, 2].includes(state.honey) && typeof state.manual === 'boolean' && typeof state.done === 'boolean'
    && (state.turn === 0 ? state.first === null && state.taste === null : state.first !== null)
    && (state.turn < 2 ? state.taste === null && state.final === null && !state.done && !state.manual : state.taste !== null)
    && (!state.manual || state.taste === 'less' && state.final === 'pour') && (!state.done || state.final !== null && state.honey !== null)
    && [null, 'repeat', 'slower', 'meaning'].includes(state.lastHelp) && [undefined, false, true].includes(state.picture) && d?.id === 'cafe-alley.day.new-tea'
    && LEVELS.includes(d.level) && LEVELS.includes(d.sceneLevel) && Number.isSafeInteger(d.lowerRetells) && d.lowerRetells >= 0
    && d.help && ['meaning', 'repeat', 'slower', 'reopen'].every(k => Number.isSafeInteger(d.help[k]) && d.help[k] >= 0 && d.help[k] <= 1000)
    && typeof d.stopped === 'boolean' && d.turns && !Array.isArray(d.turns)
    && Object.entries(d.turns).every(([key, t]) => ['offer', 'taste', 'less', 'same', 'aroma'].includes(key)
      && LEVELS.includes(t.level) && Number.isSafeInteger(t.repeats) && t.repeats >= 0 && t.repeats <= 1000);
}
export function newTeaView(state) {
  const key = keyOf(state), level = dialogueLevel(state.dialogue, key), page = SCRIPT[key];
  // An older cached generated data without the scene (see above): no words, no choices — nothing breaks.
  if (!page) return { turn: key, level, line: null, aside: null, choices: [], help: state.lastHelp, manual: state.manual, done: state.done, picture: null };
  const choices = state.manual ? [0, 1, 2].map(n => ({ id: `honey-${n}`, label: SCENE.honey[n] }))
    : page.choices.map(c => ({ id: c.id, label: c.labels[level] }));
  // The picture card's short line stands for the turn's own line; the honey prompt keeps its words under the honey picture.
  const card = level === 'L1' && state.picture === true ? PICTURES[key] : null;
  return { turn: key, level, line: state.done ? (state.taste === 'aroma' ? RESULT_AROMA : RESULT)[level] : state.manual ? MANUAL[level] : card ? card.line : page.lines[level],
    aside: state.turn === 1 && state.first === 'smell' ? SMELL[level] : null,
    choices: state.done ? [] : choices, help: state.lastHelp, manual: state.manual, done: state.done,
    picture: card?.picture ?? null };
}
export function helpNewTea(state, kind) {
  if (state.done || !['repeat', 'slower', 'meaning'].includes(kind) || state.dialogue.help[kind] >= 1000) throw new TypeError('Invalid new tea help');
  const atL1 = dialogueLevel(state.dialogue, keyOf(state)) === 'L1';
  return { ...state, lastHelp: kind, picture: kind === 'meaning' ? atL1 : state.picture === true, dialogue: helpDialogue(state.dialogue, keyOf(state), kind) };
}
export function chooseNewTea(state, choice) {
  if (state.done || !newTeaView(state).choices.some(c => c.id === choice)) throw new TypeError('Invalid new tea choice');
  const next = structuredClone(state); next.lastHelp = null; next.picture = false;
  if (state.manual) { next.honey = Number(choice.slice(-1)); next.done = true; }
  else if (state.turn === 0) { next.first = choice; next.turn = 1; }
  else if (state.turn === 1) { next.taste = choice; next.turn = 2; }
  else { next.final = choice; next.manual = choice === 'pour'; next.honey = state.taste === 'less' ? 1 : 2; next.done = !next.manual; }
  return next;
}
