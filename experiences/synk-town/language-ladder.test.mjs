import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLadder, validLadder, pickSceneLevel, closeScene, chooseLevel, markOffer, answerOffer, mergeLadders, mainEvidence } from './town/language-ladder.mjs';
import { openDialogue, helpDialogue, closeDialogue, dialogueLevel } from './dialogue.mjs';
import { createLanguageSettings } from './day-language.mjs';
const now = Date.parse('2026-10-28T12:00:00Z');
const start = () => initialLadder({ reading: 'L3', listening: 'L1' }, now);
const scene = { versions: ['L1', 'L2', 'L3', 'L4'], responseFormat: 'cup-compose' };

// W9: the widening question became the mascot's card (day-ask.mjs, view.ask kind widen — 「나중에」 closes it unanswered,
// tests/town-ask-screen.test.js). The notebook draws no offer of its own and asks the host only when it says one may stand.
test('the notebook draws no widening card and asks the host only when a question may stand', async () => {
  const original = globalThis.document;
  const nodes = [];
  const element = () => {
    const node = { children: [], handlers: {}, dataset: new Proxy({}, { set(target, key, value) { target[key] = String(value); return true; } }),
      append(...children) { this.children.push(...children); }, setAttribute() {}, addEventListener(name, fn) { this.handlers[name] = fn; } };
    nodes.push(node); return node;
  };
  globalThis.document = { createElement: element };
  try {
    const commands = [], settings = createLanguageSettings(element(), { command: async (...args) => commands.push(args) });
    const language = { version: 1, ladder: initialLadder({}, now) };
    language.ladder.reading.lastOffer = { at: now, answer: null };
    settings.update(language);
    assert.equal(nodes.some(node => node.dataset.kind === 'consent' || node.textContent === '나중에'), false);
    await settings.boundary(language, now, 'cup-compose'); assert.deepEqual(commands, []);
    await settings.boundary({ ...language, askReady: true }, now, 'cup-compose');
    assert.deepEqual(commands, [['LANGUAGE_OFFER', { channel: 'reading', format: 'cup-compose' }]]);
  } finally { globalThis.document = original; }
});
test('placement separates reading/listening; missing versions only fall down', () => {
  const ladder = start(); assert.equal(validLadder(ladder), true);
  assert.equal(pickSceneLevel({ ladder, channel: 'reading', scene: { versions: ['L1', 'L2'] } }).level, 'L2');
  assert.equal(pickSceneLevel({ ladder, channel: 'listening', scene }).level, 'L1');
});
test('help lowers one line, third telling lowers, two lower retells lower remaining turns', () => {
  let s = openDialogue({ id: 'scene1', level: 'L3' });
  s = helpDialogue(s, 'a', 'meaning'); assert.equal(dialogueLevel(s, 'a'), 'L2'); assert.equal(dialogueLevel(s, 'b'), 'L3');
  s = helpDialogue(s, 'b', 'repeat'); assert.equal(dialogueLevel(s, 'b'), 'L3');
  s = helpDialogue(s, 'b', 'repeat'); assert.equal(dialogueLevel(s, 'b'), 'L2'); assert.equal(dialogueLevel(s, 'c'), 'L2');
  assert.equal(closeDialogue(s).outcome, 'eased'); assert.equal(s.level, 'L3');
});
test('slower and stop do not produce difficulty evidence', () => {
  const s = helpDialogue(helpDialogue(openDialogue({ id: 's', level: 'L3' }), 'a', 'slower'), 'a', 'stop');
  assert.equal(s.sceneLevel, 'L3'); assert.equal(closeDialogue(s).outcome, 'stopped');
  assert.deepEqual(closeScene({ ladder: start(), channel: 'reading', level: 'L3', outcome: 'stopped', now }), start());
});
test('two eased scenes lower only their channel and reset both streaks', () => {
  const first = closeScene({ ladder: start(), channel: 'reading', level: 'L3', outcome: 'eased', now });
  const other = closeScene({ ladder: first, channel: 'listening', level: 'L1', outcome: 'smooth', now });
  const last = closeScene({ ladder: other, channel: 'reading', level: 'L3', outcome: 'eased', now });
  assert.equal(last.reading.stable, 'L2'); assert.equal(last.reading.easedStreak, 0); assert.equal(last.listening.smoothStreak, 1);
});
test('five smooth scenes only offer; fixed/low/asked/decline block; accept changes boundary', () => {
  let ladder = start(); for (let i=0;i<5;i++) ladder = closeScene({ ladder, channel: 'reading', level: 'L3', outcome: 'smooth', now: now+i });
  assert.equal(pickSceneLevel({ ladder, scene, now }).offer.to, 'L4'); assert.equal(ladder.reading.stable, 'L3');
  assert.equal(pickSceneLevel({ ladder, scene, now, today: { condition: 'low' } }).offer, null);
  assert.equal(pickSceneLevel({ ladder: chooseLevel(ladder, 'reading', 'easier', now), scene, now }).offer, null);
  ladder = markOffer(ladder, 'reading', now, ladder.reading.evidence);
  assert.equal(pickSceneLevel({ ladder, scene, now }).offer, null);
  const accepted = answerOffer(ladder, 'reading', 'accepted', now); assert.equal(accepted.reading.stable, 'L4');
  const declined = answerOffer(ladder, 'reading', 'declined', now);
  assert.equal(pickSceneLevel({ ladder: declined, scene, now: now+8*86400000 }).offer, null);
});
test('main evidence uses same format and complete history; tea does not open II', () => {
  const summary = { evidenceComplete: true, skills: ['detail','negation'].map(k => ({ id: `ko.reading.${k}`, levels: { 2: { formats: { 'cup-compose': { status: 'recent-independent' } } } } })) };
  assert.equal(mainEvidence(summary, { channel:'reading', level:'L2', responseFormat:'cup-compose' }), true);
  assert.equal(mainEvidence(summary, { channel:'reading', level:'L2', responseFormat:'single-choice' }), false);
  assert.equal(mainEvidence(summary, { channel:'reading', level:'L3', responseFormat:'cup-compose' }), false);
  assert.equal(mainEvidence({...summary,evidenceComplete:false}, { channel:'reading', level:'L2', responseFormat:'cup-compose' }), false);
});
test('merge selects later channel independently and lower at equal time', () => {
  const a = start(), b = chooseLevel(a, 'reading', 'easier', now);
  const c = chooseLevel(b, 'listening', 'broader', now+1), merged=mergeLadders(a,c);
  assert.equal(merged.reading.stable,'L2'); assert.equal(merged.listening.stable,'L2');
});
