// 여러 목소리로 듣고 고르기(HVPT)의 목소리 고르기 시험. node --test experiences/hangul-stage/audio.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { voicesFor, pickTalker } from './audio.mjs';

const MAIN = { 가: 'a.mp3', 나: 'b.mp3' };
const TALKERS = [{ name: '진희', clips: { 가: 'talkers/jinhee/a.mp3' } }, { name: '효은', clips: { 가: 'talkers/hyoeun/a.mp3' } },
  { name: '재영', clips: { 가: 'talkers/jaeyoung/a.mp3', 카: 'talkers/jaeyoung/k.mp3' } }];

test('그 음절을 가진 목소리만 고른다 — 기본 목소리는 0번', () => {
  assert.deepEqual(voicesFor('가', MAIN, TALKERS), [0, 1, 2, 3]);
  assert.deepEqual(voicesFor('나', MAIN, TALKERS), [0]);
  assert.deepEqual(voicesFor('카', MAIN, TALKERS), [3]);
  assert.deepEqual(voicesFor('가', MAIN, null), [0]);
});

test('목소리가 하나뿐이거나 여러 목소리가 승인 전이면 늘 기본(0)', () => {
  assert.equal(pickTalker('나', 'hg-1', MAIN, TALKERS), 0);
  assert.equal(pickTalker('가', 'hg-1', MAIN, null), 0);
  assert.equal(pickTalker('카', 'hg-1', MAIN, TALKERS), 0);
});

test('같은 문항은 다시 들어도 같은 목소리, 문항이 바뀌면 목소리가 돈다', () => {
  const keys = Array.from({ length: 40 }, (_, i) => `hg-x-${i}`);
  const picked = keys.map(k => pickTalker('가', k, MAIN, TALKERS));
  assert.deepEqual(keys.map(k => pickTalker('가', k, MAIN, TALKERS)), picked);
  assert.ok(picked.every(v => [0, 1, 2, 3].includes(v)));
  assert.equal(new Set(picked).size, 4, '마흔 문항이면 네 목소리가 다 나온다');
});
