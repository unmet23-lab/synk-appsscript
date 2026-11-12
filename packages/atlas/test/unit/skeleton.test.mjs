// 단계 0의 뼈대: 모듈 자리 여섯이 단계 표대로 있고, 코치 메서드 이름은 설계 §8의 표 그대로다.
// 단계 2가 채운 두뇌(memory · ability · select · reason)는 ts-fsrs를 부르므로 이 묶음(의존 없이 도는 unit)에서는 파일만 본다 —
// 바깥 입구의 내보내기는 test/build/entry.test.mjs가 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { subject, subjectPath } from '../support/subject.mjs';

// 설계 §8의 표 — 「그대로」 열여섯 + 「더함」 넷(ready는 메서드가 아니라 기다릴 약속이다, synced는 단계 4 §18-5-5 G4).
const DESIGN_METHODS = [
  'recommend',
  'present',
  'help',
  'delivery',
  'answer',
  'exclude',
  'recheck',
  'summary',
  'exposure',
  'finishSet',
  'feedback',
  'live',
  'today',
  'presentation',
  'reset',
  'dispose',
  'plan',
  'due',
  'tell',
  'synced',
  'guestRecords',
];

test('모듈 자리 여섯은 채울 단계와 함께 있다(설계 §11)', async () => {
  const waiting = { map: 1, record: 3 };
  for (const [slot, stage] of Object.entries(waiting)) {
    const module = await subject(`${slot}/index.mjs`);
    assert.equal(module.STAGE, stage, `${slot}은 단계 ${stage}이 채운다`);
  }
  for (const slot of ['memory', 'ability', 'select', 'reason', 'fold', 'coach', 'health']) {
    assert.ok(fs.existsSync(subjectPath('src', slot, 'index.mjs')), `${slot} 자리`);
  }
});

test('설계 §8의 코치 메서드 이름', async () => {
  const { COACH_METHODS } = await subject('coach/methods.mjs');
  assert.deepEqual([...COACH_METHODS], DESIGN_METHODS);
});

// 코치 본체(두뇌 · 기록을 부른다)의 시험은 test/coach/(묶음 coach)에 있다 — 단계 4.
