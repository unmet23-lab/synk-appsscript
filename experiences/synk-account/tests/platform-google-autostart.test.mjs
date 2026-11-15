import test from 'node:test';
import assert from 'node:assert/strict';
import { claimGoogleAutostart, hasGoogleAutostartMark, readGoogleAutostartMark, GOOGLE_AUTOSTART_KEY } from '../src/google-auth.mjs';

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const first = { state: 'synthetic_platform_state_000000001', authorizationId: 'synthetic_authorization_a', now: 1794660000000 };

test('Google 자동 시작은 이동 전에 한 번 기록하고 같은 요청의 재진입을 막는다', () => {
  const memory = storage();
  assert.equal(claimGoogleAutostart({ ...first, storage: memory }).ok, true);
  assert.deepEqual(readGoogleAutostartMark(memory), { state: first.state, authorizationId: first.authorizationId, createdAt: first.now });
  assert.equal(hasGoogleAutostartMark({ storage: memory, ...first }), true);
  const saved = memory.getItem(GOOGLE_AUTOSTART_KEY);
  assert.deepEqual(claimGoogleAutostart({ ...first, storage: memory }), { ok: false, reason: 'already-started', mark: readGoogleAutostartMark(memory) });
  assert.equal(memory.getItem(GOOGLE_AUTOSTART_KEY), saved);
});

test('같은 state의 다른 승인 요청과 같은 승인 요청의 다른 state는 자동 시작하지 않는다', () => {
  const memory = storage();
  claimGoogleAutostart({ ...first, storage: memory });
  const saved = memory.getItem(GOOGLE_AUTOSTART_KEY);
  assert.equal(claimGoogleAutostart({ ...first, storage: memory, authorizationId: 'synthetic_authorization_b' }).reason, 'different-authorization');
  assert.equal(claimGoogleAutostart({ ...first, storage: memory, state: 'synthetic_platform_state_000000002' }).reason, 'already-started');
  assert.equal(memory.getItem(GOOGLE_AUTOSTART_KEY), saved);
});

test('새 로그인 요청 뒤에도 앞 요청의 늦은 재진입을 차단한다', () => {
  const memory = storage();
  claimGoogleAutostart({ ...first, storage: memory });
  const second = { state: 'synthetic_platform_state_000000002', authorizationId: 'synthetic_authorization_b', now: first.now + 1000 };
  assert.equal(claimGoogleAutostart({ ...second, storage: memory }).ok, true);
  assert.equal(claimGoogleAutostart({ ...first, storage: memory }).ok, false);
  assert.equal(readGoogleAutostartMark(memory).state, second.state);
  assert.equal(hasGoogleAutostartMark({ storage: memory, state: first.state }), true);
});

test('표지 저장을 확인할 수 없거나 요청 결속이 잘못됐으면 자동 시작을 허용하지 않는다', () => {
  const throwing = { getItem() { return null; }, setItem() { throw new Error('storage denied'); } };
  const notStored = { getItem() { return null; }, setItem() {} };
  for (const memory of [undefined, throwing, notStored]) assert.equal(claimGoogleAutostart({ ...first, storage: memory }).ok, false);
  for (const patch of [{ state: 'short' }, { authorizationId: 'invalid value' }, { now: NaN }]) {
    const memory = storage();
    assert.equal(claimGoogleAutostart({ ...first, ...patch, storage: memory }).ok, false);
    assert.equal(memory.values.size, 0);
  }
});
