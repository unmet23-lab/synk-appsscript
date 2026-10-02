import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LISTENING_CHECKS, checkMetadata, createListeningCheck, selectListeningChecks } from './listening-check.mjs';
import { instructionMetadata } from './learning.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
function fixture() { const rows = new Map(), coach = createGame({ gameId: 'korean-runner', map, storage: { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } }); return { coach, check: createListeningCheck(coach) }; }
test('all sixteen completed MP3 checks can produce independent correct/incorrect listening evidence', () => {
  const { coach, check } = fixture();
  for (const [i, item] of LISTENING_CHECKS.entries()) {
    const token = check.begin(item); assert.equal(check.answer(item.correct), null);
    check.delivery(token, 'completed'); const result = check.answer(i === 1 ? 1 : item.correct);
    assert.equal(result.independent, true); assert.equal(result.verdict, i === 1 ? 'incorrect' : 'correct');
    assert.equal(check.answer(item.correct), null);
  }
  assert.equal(coach.summary().independent, LISTENING_CHECKS.length);
});
test('replaying is assisted and requires a newly completed audio delivery', () => {
  const { check } = fixture(), item = LISTENING_CHECKS[0], token = check.begin(item);
  check.delivery(token, 'completed'); check.replay(); assert.equal(check.answer(item.correct), null);
  check.delivery(token, 'completed'); const result = check.answer(item.correct); assert.equal(result.assisted, true); assert.equal(result.independent, false);
});
test('missing/interrupted audio and cancelled questions create no incorrect language evidence', () => {
  const { coach, check } = fixture(); const token = check.begin(LISTENING_CHECKS[0]); check.delivery(token, 'failed');
  assert.equal(check.answer(0), null); check.cancel(); assert.equal(coach.summary().independent, 0);
  assert.equal(coach.events().filter(event => event.type === 'practice.attempted').at(-1).verdict, 'unassessed');
});
test('stale audio completion cannot unlock the following question', () => {
  const { check } = fixture(); const token = check.begin(LISTENING_CHECKS[0]); check.begin(LISTENING_CHECKS[1]);
  assert.equal(check.delivery(token, 'completed'), false); assert.equal(check.answer(0), null);
});
test('a phrase already shown during running/practice cannot become a new independent listening fact', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0]; const pid = coach.present(instructionMetadata(item)); coach.help(pid, 'answer');
  const token = check.begin(item); check.delivery(token, 'completed'); assert.equal(check.answer(item.correct).independent, false);
  assert.equal(checkMetadata(item).familyKey, instructionMetadata(item).familyKey);
});

test('sixteen authored checks reuse exactly the sixteen recorded clips and original families', async () => {
  const { INSTRUCTIONS } = await import('./instructions.mjs');
  const { stat } = await import('node:fs/promises');
  assert.equal(LISTENING_CHECKS.length, 16); assert.deepEqual(new Set(LISTENING_CHECKS.map(x => x.id)), new Set(INSTRUCTIONS.map(x => x.id)));
  const counts = {};
  for (const item of LISTENING_CHECKS) {
    const m = checkMetadata(item); counts[m.skillId] = (counts[m.skillId] || 0) + 1;
    assert.equal(m.familyKey, instructionMetadata(item).familyKey); assert.equal(item.text, INSTRUCTIONS.find(x => x.id === item.id).text);
    assert.equal(new Set(item.choices).size, 3); assert.ok(item.choices[item.correct]);
    assert.ok((await stat(new URL(`./assets/voice/${item.id}.mp3`, import.meta.url))).size > 1000);
  }
  assert.deepEqual(counts, { 'ko.listening.detail': 5, 'ko.listening.negation': 4, 'ko.listening.sequence': 7 });
});
test('server assignment controls exact runner skill, level, modality and families without fallback', () => {
  const { coach } = fixture(), target = LISTENING_CHECKS.filter(x => checkMetadata(x).skillId === 'ko.listening.sequence').slice(-3);
  const m = checkMetadata(target[0]), assignment = { skillId:m.skillId,difficulty:m.difficulty,modality:m.modality,responseFormat:m.responseFormat,
    familyKeys:target.map(x=>checkMetadata(x).familyKey),itemKeys:target.map(x=>checkMetadata(x).itemKey),requiredAttempts:3 };
  const selected = selectListeningChecks(coach, { assignment });
  assert.deepEqual(new Set(selected.map(x=>x.id)), new Set(target.map(x=>x.id)));
  for (const change of [{skillId:'ko.reading.detail'},{difficulty:3},{modality:'reading'},{responseFormat:'action'},{familyKeys:[]},{itemKeys:[]}])
    assert.deepEqual(selectListeningChecks(coach,{assignment:{...assignment,...change}}),[]);
});
test('free runner rounds use Core exposure history and choose new phrases on return', () => {
  const { coach, check } = fixture(), first = selectListeningChecks(coach);
  assert.equal(first.length, 3);
  for(const item of first){const token=check.begin(item);check.delivery(token,'completed');check.answer(item.correct);}
  const next = selectListeningChecks(coach); assert.equal(next.length,3);
  assert.ok(next.every(item=>!first.some(old=>old.id===item.id)));
});
