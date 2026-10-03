import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LISTENING_CHECKS, CHECK_GRAMMAR, checkMetadata, createListeningCheck, selectListeningChecks } from './listening-check.mjs';
import { instructionMetadata } from './learning.mjs';
const require = createRequire(import.meta.url), { createGame } = require('../../atlas/game-learning.js'), { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));
function fixture() { const rows = new Map(), coach = createGame({ gameId: 'korean-runner', map, storage: { getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v) } }); return { coach, check: createListeningCheck(coach) }; }
test('all twelve completed MP3 checks can produce independent correct/incorrect listening evidence', () => {
  const { coach, check } = fixture();
  for (const [i, item] of LISTENING_CHECKS.entries()) {
    const token = check.begin(item); assert.equal(check.answer(item.correct), null);
    check.delivery(token, 'completed'); const result = check.answer(i === 1 ? 1 : item.correct);
    assert.equal(result.independent, true); assert.equal(result.verdict, i === 1 ? 'incorrect' : 'correct');
    assert.equal(check.answer(item.correct), null);
  }
  assert.equal(coach.summary().independent, LISTENING_CHECKS.length);
});
test('a replay after a full listen is help; it cannot make the heard instruction unheard', () => {
  const { coach, check } = fixture(), item = LISTENING_CHECKS[0], token = check.begin(item);
  check.delivery(token, 'completed'); check.replay();
  // The replay was cut off (a hidden tab): the instruction was still heard, so the answer stays open.
  check.delivery(token, 'failed');
  const result = check.answer(item.correct);
  assert.equal(result.verdict, 'correct'); assert.equal(result.assisted, true); assert.equal(result.independent, false);
  assert.deepEqual(coach.events().filter(e => e.type === 'practice.delivery').map(e => e.audio), ['completed']);
});
test('a first listen after a failed load is the first listen, not help', () => {
  const { check } = fixture(), item = LISTENING_CHECKS[0], token = check.begin(item);
  check.delivery(token, 'failed'); assert.equal(check.answer(item.correct), null, 'nothing heard yet');
  check.replay(); check.delivery(token, 'completed');
  const result = check.answer(item.correct);
  assert.equal(result.assisted, false); assert.equal(result.independent, true);
});
test('closing after a full listen leaves the question unanswered, not an audio failure', () => {
  const { coach, check } = fixture(), token = check.begin(LISTENING_CHECKS[0]);
  check.delivery(token, 'completed'); check.cancel();
  assert.equal(coach.events().filter(e => e.type === 'practice.attempted').at(-1).reason, 'unanswered');
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
test('a check is a sentence the run never says: running and practising do not spend its first try', async () => {
  const { INSTRUCTIONS } = await import('./instructions.mjs');
  const { coach, check } = fixture();
  // Every run instruction heard and acted on, and its meaning shown in practice.
  for (const item of INSTRUCTIONS) {
    const run = coach.present(instructionMetadata(item)); coach.delivery(run, { audio: 'completed' });
    coach.answer(run, { correct: true, assessable: false, reason: 'visual' });
    coach.help(coach.present(instructionMetadata(item)), 'answer');
  }
  const item = LISTENING_CHECKS[0], token = check.begin(item); check.delivery(token, 'completed');
  assert.equal(check.answer(item.correct).independent, true, 'still a first try after running');
  const runFamilies = new Set(INSTRUCTIONS.map(x => instructionMetadata(x).familyKey)), runTexts = new Set(INSTRUCTIONS.map(x => x.text));
  for (const x of LISTENING_CHECKS) { assert.ok(!runFamilies.has(checkMetadata(x).familyKey), x.id); assert.ok(!runTexts.has(x.text), x.id); }
});

test('twelve authored checks: their own recorded clips and families, three choices, the answer in every place', async () => {
  const { stat, readFile } = await import('node:fs/promises');
  assert.equal(LISTENING_CHECKS.length, 12);
  const jobs = JSON.parse((await readFile(new URL('./assets/voice/jobs.json', import.meta.url), 'utf8')).replace(/^﻿/, ''));
  const counts = {}, places = [0, 0, 0];
  for (const item of LISTENING_CHECKS) {
    const m = checkMetadata(item); counts[m.skillId] = (counts[m.skillId] || 0) + 1; places[item.correct] += 1;
    assert.equal(m.familyKey, m.itemKey); assert.match(m.itemKey, /^korean-runner.listening-check.check-[a-z-]+.v1$/);
    assert.equal(jobs.find(j => j.id === item.id)?.text, item.text, `${item.id}: the clip says the check sentence`);
    assert.equal(new Set(item.choices).size, 3); assert.ok(item.choices[item.correct]);
    assert.ok((await stat(new URL(`./assets/voice/${item.id}.mp3`, import.meta.url))).size > 1000);
  }
  assert.deepEqual(counts, { 'ko.listening.detail': 4, 'ko.listening.negation': 4, 'ko.listening.sequence': 4 });
  assert.ok(places.every(n => n >= 3), `answers spread over the three places: ${places}`);
});
test('check sentences link the grammar Strata reads in them', async () => {
  const { grammarIn } = require('../../strata/topik-i-forms.js');
  assert.deepEqual(Object.keys(CHECK_GRAMMAR).sort(), LISTENING_CHECKS.map(x => x.id).sort());
  for (const item of LISTENING_CHECKS) {
    assert.deepEqual(CHECK_GRAMMAR[item.id], grammarIn(item.text), item.id);
    assert.deepEqual(checkMetadata(item).conceptIds, grammarIn(item.text), item.id);
  }
  for (const id of new Set(Object.values(CHECK_GRAMMAR).flat())) assert.equal(map.getNode(id)?.kind, 'grammar_point', id);
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
