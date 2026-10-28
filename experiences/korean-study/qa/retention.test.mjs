import test from 'node:test';
import assert from 'node:assert/strict';
import { readState, recordWrite, recordForm, addObs, markSeen, evidence, next } from '../src/tutor.mjs';

const DAY = 86400000;
const start = Date.parse('2026-10-28T01:00:00Z');
const item = n => ({ id: `retention-${n}`, type: 53, label: '학생 수', data: { tables: [
  { caption: '학생 수', columns: ['연도', '학생'], rows: [['2025', '20'], ['2026', '30']] },
] } });
const bank = { open53: Array.from({ length: 10 }, (_, n) => item(n + 1)), open54: [], pool: [], forms: [], finds: [] };
const correct = '학생 수가 증가한다. 학생 수는 20명이다. 학생 비율은 30퍼센트이다.';
const incorrect = '학생 수가 증가합니다. 학생 수는 20명입니다. 학생 비율은 30퍼센트입니다.';
const write = (state, n, text, at) => recordWrite(state, { item: item(n), text }, { now: at }).state;

test('an earlier completed check cannot replace a delayed check after new help', () => {
  let state = readState(null, { now: start });
  state = write(state, 1, correct, start);
  state = write(state, 2, correct, start + DAY);
  assert.equal(evidence(state, { now: start + DAY }).done, true, 'an already capable learner can finish without help');
  state = write(state, 3, incorrect, start + 2 * DAY);
  state = addObs(state, { kind: 'method', method: 'apply' }, { now: start + 2 * DAY + 1000 });
  state = write(state, 4, correct, start + 2 * DAY + 2000);
  assert.equal(evidence(state, { now: start + 2 * DAY + 2000 }).done, false, 'success one second after new help is not delayed evidence');
  state = write(state, 5, correct, start + 3 * DAY + 2000);
  assert.equal(evidence(state, { now: start + 3 * DAY + 2000 }).done, true, 'a later independent success can confirm the point again');
});

test('a due check with no fresh material reports exhaustion instead of promising another check', () => {
  let state = readState(null, { now: start });
  state = write(state, 1, correct, start);
  state = write(state, 2, correct, start + DAY);
  state = markSeen(state, bank.open53.map(it => it.id), { now: start + DAY });
  assert.equal(evidence(state, { now: start + 8 * DAY }).done, true, 'the historical achievement remains');
  assert.equal(next(state, bank, { now: start + 8 * DAY }).why, 'no-items');
});

test('help after an unassessed writing and a failed form probe also needs fresh delayed evidence', () => {
  let state = readState(null, { now: start });
  state = write(state, 1, correct, start);
  state = write(state, 2, correct, start + DAY);
  const at = start + 8 * DAY;
  state = write(state, 3, '학생 수가 급증하다. 학생 비율이 폭증하다. 학생 수가 격증하다.', at);
  assert.equal(evidence(state, { now: at }).lastWrite.verdict, 'unassessed');
  state = recordForm(state, { form: { id: 'retention-form', axis: 'verb', use: 'check' }, grade: false }, { now: at + 100 }).state;
  state = addObs(state, { kind: 'method', method: 'forms' }, { now: at + 1000 });
  state = recordWrite(state, { item: item(3), text: correct, support: 2, mode: 'revise' }, { now: at + 1500 }).state;
  state = write(state, 4, correct, at + 2000);
  assert.equal(evidence(state, { now: at + 2000 }).done, false, 'the earlier no-help successes cannot verify a newly taught point');
  state = write(state, 5, correct, at + DAY + 2000);
  assert.equal(evidence(state, { now: at + DAY + 2000 }).done, true);
});
