// 지금 판 코치(atlas/game-learning.js)에 계기를 붙였을 때 — 엔진 파일은 그대로 두고 공개 표면만 읽는다(단계0_계획.md §4).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';

const require = createRequire(import.meta.url);
const REPO = path.resolve(PACKAGE_ROOT, '..', '..');
const { createGame } = require(path.join(REPO, 'atlas', 'game-learning.js'));
const { createMap } = require(path.join(REPO, 'strata'));
const map = createMap(require(path.join(REPO, 'strata', 'maps', 'topik-i.json')));
const { createHealth } = await subject('health/index.mjs');
const { attachLegacyCoach } = await subject('health/legacy.mjs');

function memoryStorage(failing = () => false) {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      if (failing()) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      data.set(key, String(value));
    },
    removeItem: key => data.delete(key),
  };
}

function legacyGame(storage) {
  let tick = Date.parse('2026-11-10T00:00:00Z');
  return createGame({
    gameId: 'stage0-health',
    map,
    storage,
    clock: () => new Date((tick += 1000)).toISOString(),
  });
}

const item = i => ({
  id: `item-${i}`,
  itemKey: `item-${i}`,
  skillId: 'ko.listening.detail',
  modality: 'listening',
  difficulty: 1,
  responseFormat: 'single-choice',
});

function play(coach, i) {
  const pid = coach.present(item(i));
  coach.delivery(pid, { audio: 'completed' });
  return coach.answer(pid, { correct: true, assessable: true });
}

test('지금 판: 저장이 되면 성공으로 센다', () => {
  const health = createHealth();
  const { coach, detach } = attachLegacyCoach(legacyGame(memoryStorage()), health);
  assert.equal(play(coach, 0).independent, true);
  play(coach, 1);
  const snap = health.snapshot();
  assert.ok(snap.save.attempts >= 2, `저장 시도 ${snap.save.attempts}`);
  assert.equal(snap.save.failures, 0);
  assert.equal(snap.engineOff, false);
  detach();
});

test('지금 판: 저장소가 쓰기를 거절하면 저장 실패로 세고, 이어지면 꺼진 것이다', () => {
  let failing = false;
  const health = createHealth();
  const { coach } = attachLegacyCoach(legacyGame(memoryStorage(() => failing)), health);
  play(coach, 0);
  failing = true;
  assert.equal(
    play(coach, 1).independent,
    false,
    '저장하지 못한 답은 근거가 아니다(지금 판의 계약 그대로)',
  );
  const snap = health.snapshot();
  assert.ok(snap.save.failures >= 3, `실패 ${snap.save.failures}`);
  assert.ok(snap.save.codes.STORAGE_ERROR >= 3);
  assert.deepEqual(snap.offReasons, ['save-streak']);
});

test('지금 판: 추천이 던지면 실패, 고를 것이 없으면(unavailable) 실패가 아니다 — 결과는 그대로 돌려준다', () => {
  const health = createHealth();
  const raw = legacyGame(memoryStorage());
  const { coach } = attachLegacyCoach(raw, health);
  const none = coach.recommend([]);
  assert.equal(none.status, 'unavailable');
  assert.throws(() => coach.recommend(null));
  const snap = health.snapshot();
  assert.equal(snap.recommend.attempts, 2);
  assert.equal(snap.recommend.empty, 1);
  assert.equal(snap.recommend.failures, 1);
  assert.equal(snap.storageAvailable, true, '추천 결과의 storage.available을 관측한다');
  assert.equal(coach.syncPort, raw.syncPort, '나머지 표면은 지금 판 그대로 넘긴다');
  assert.equal(coach.present, raw.present);
});

test('알림 표: 다른 탭의 잠금 대기는 실패가 아니고, 잠금을 얻어 저장되면 닫힌다 · 떼면 더 세지 않는다', () => {
  let listener = null;
  const fake = {
    recommend: () => ({ status: 'ready', storage: { available: false } }),
    syncPort: {
      subscribe: fn => {
        listener = fn;
        return () => {
          listener = null;
        };
      },
    },
  };
  const health = createHealth();
  const { coach, detach } = attachLegacyCoach(fake, health);
  listener({ kind: 'storage-wait', code: 'STORAGE_BUSY' });
  listener({ kind: 'storage-wait', code: 'STORAGE_BUSY' });
  assert.equal(health.snapshot().save.waiting, true);
  assert.equal(health.snapshot().engineOff, false);
  listener({ kind: 'storage-ready' });
  listener({ kind: 'settle' });
  const snap = health.snapshot();
  assert.equal(snap.save.waiting, false);
  assert.equal(snap.save.waits, 2);
  assert.equal(snap.save.attempts, 1, '모르는 알림(settle)은 세지 않는다');
  const result = coach.recommend();
  assert.equal(result.status, 'ready');
  assert.equal(health.snapshot().storageAvailable, false);
  detach();
  assert.equal(listener, null);
});

test('지금 판 코치가 아니면 붙이지 않는다', () => {
  assert.throws(() => attachLegacyCoach({}, createHealth()), TypeError);
  assert.throws(() => attachLegacyCoach({ recommend() {} }, null), TypeError);
});
