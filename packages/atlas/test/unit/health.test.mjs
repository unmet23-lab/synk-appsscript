// 계기(src/health): 다른 탭의 정상 대기는 실패가 아니고, 이어진 실패만 「엔진이 꺼진」 것이며, 요약에 문장 · 신원이 없다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { createHealth, HEALTH_VERSION } = await subject('health/index.mjs');
const clockFrom = start => {
  let now = start;
  return () => (now += 1000);
};

test('저장이 세 번 이어서 실패하면 꺼진 것이고, 한 번 되면 이어진 수가 0으로 돌아간다', () => {
  const health = createHealth({ clock: clockFrom(0) });
  health.note('save', { ok: false, code: 'STORAGE_ERROR' });
  health.note('save', { ok: false, code: 'STORAGE_ERROR' });
  assert.equal(health.snapshot().engineOff, false);
  health.note('save', { ok: false, code: 'HISTORY_CAPACITY' });
  const off = health.snapshot();
  assert.equal(off.engineOff, true);
  assert.deepEqual(off.offReasons, ['save-streak']);
  assert.deepEqual(off.save.codes, { STORAGE_ERROR: 2, HISTORY_CAPACITY: 1 });
  assert.equal(off.save.firstFailureAt, 1000);
  assert.equal(off.save.lastFailureAt, 3000);
  health.note('save', { ok: true });
  const back = health.snapshot();
  assert.equal(back.engineOff, false);
  assert.equal(back.save.streak, 0);
  assert.equal(back.save.longestStreak, 3);
  assert.equal(back.save.attempts, 4);
});

test('다른 탭 · 틀이 쓰기 잠금을 쥔 대기는 시도도 실패도 아니다 — 저장이 되면 대기가 닫힌다', () => {
  const health = createHealth();
  for (let i = 0; i < 5; i += 1)
    health.note('save', { ok: false, code: 'STORAGE_BUSY', waiting: true });
  health.observeStorage(false);
  const waiting = health.snapshot();
  assert.equal(waiting.engineOff, false, '잠금 대기만으로 꺼진 것이 아니다');
  assert.equal(waiting.save.attempts, 0);
  assert.equal(waiting.save.failures, 0);
  assert.equal(waiting.save.waits, 5);
  assert.equal(waiting.save.waiting, true);
  assert.equal(waiting.storageAvailable, false);
  health.note('save', { ok: true });
  assert.equal(health.snapshot().save.waiting, false);
});

test('추천: 던짐만 실패다. 고르지 않음(empty)은 세되 실패가 아니다', () => {
  const health = createHealth({ offAfter: 2 });
  health.note('recommend', { ok: true, empty: true });
  health.note('recommend', { ok: true, empty: true });
  health.note('recommend', { ok: true, empty: true });
  assert.equal(health.snapshot().engineOff, false);
  assert.equal(health.snapshot().recommend.empty, 3);
  health.note('recommend', { ok: false, code: 'THROWN' });
  health.note('recommend', { ok: false });
  const off = health.snapshot();
  assert.deepEqual(off.offReasons, ['recommend-streak']);
  assert.deepEqual(off.recommend.codes, { THROWN: 1, UNKNOWN: 1 });
});

test('엔진 묶음을 못 받은 것은 그 뒤 받을 때까지 꺼진 것이다', () => {
  const health = createHealth();
  health.note('load', { ok: false, code: 'LOAD_FAILED' });
  assert.deepEqual(health.snapshot().offReasons, ['load-failed']);
  health.note('load', { ok: true });
  assert.equal(health.snapshot().engineOff, false);
});

test('요약에는 수 · 코드 · 시각만 — 메시지와 낯선 코드는 남기지 않고, 코드 가짓수에 상한이 있다', () => {
  const health = createHealth();
  health.note('save', { ok: false, code: '기록을 저장하지 못했어요' });
  health.note('save', { ok: false, code: 'lowercase_code' });
  for (let i = 0; i < 40; i += 1) health.note('recommend', { ok: false, code: `CODE_${i}` });
  const snap = health.snapshot();
  assert.equal(snap.version, HEALTH_VERSION);
  assert.deepEqual(snap.save.codes, { UNKNOWN: 2 });
  assert.equal(Object.keys(snap.recommend.codes).length, 17, '열여섯 가지 + OTHER');
  assert.equal(snap.recommend.codes.OTHER, 24);
  assert.deepEqual(Object.keys(snap).sort(), [
    'engineOff',
    'load',
    'offAfter',
    'offReasons',
    'recommend',
    'save',
    'storageAvailable',
    'version',
  ]);
  snap.save.codes.UNKNOWN = 99;
  assert.equal(health.snapshot().save.codes.UNKNOWN, 2, '요약은 사본이다');
});

test('잘못 부르면 바로 알린다', () => {
  const health = createHealth();
  assert.throws(() => health.note('sync', { ok: true }), TypeError);
  assert.throws(() => health.note('save', {}), TypeError);
  assert.throws(() => createHealth({ offAfter: 0 }), TypeError);
  assert.throws(() => createHealth({ clock: 1 }), TypeError);
});
