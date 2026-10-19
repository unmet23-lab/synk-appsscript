import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, recordAnswer } from '../experiences/path-vr/model.mjs';
import { PERSONAL_LIMITS, validatePersonalState, parsePersonalState, serializePersonalState, pathAccountState, pathDeviceState, personalWriteRequest, personalDeleteRequest, validatePersonalResponse } from '../experiences/synk-account/src/personal-data.mjs';

const now = '2026-10-06T03:00:00.000Z';
const response = (resource, state) => ({ ok: true, scope: 'synk-personal', resource, accountId: 'account-1', revision: 3, updatedAt: now, state });

test('PATH account roundtrip preserves current practice without enabling device storage', () => {
  const source = recordAnswer(initialState(), 'welcome', 0, 2, true, now);
  source.cursor = { step: 0, choice: 2, helped: true, showResults: false };
  const network = pathAccountState(source);
  assert.equal(Object.hasOwn(network, 'consent'), false);
  assert.deepEqual(pathDeviceState(network), source);
  assert.equal(pathDeviceState(network, { consent: true }).consent, true);
  assert.equal(source.consent, false);
  assert.throws(() => validatePersonalState('path', source));
  assert.throws(() => pathDeviceState(network, { consent: 'yes' }));
});

test('PATH canonical choices and count bounds apply to account records', () => {
  const good = pathAccountState(initialState());
  for (const mutate of [v => v.zone = 'invented', v => v.prefs.goal = 'admin', v => v.cursor.choice = 4, v => v.answers = Array.from({ length: 61 }, () => ({ zone: 'welcome', step: 0, choice: 0, helped: false, at: now })), v => v.role = 'teacher']) {
    const value = structuredClone(good); mutate(value); assert.throws(() => validatePersonalState('path', value));
  }
  assert.throws(() => parsePersonalState('path', ' '.repeat(PERSONAL_LIMITS.path + 1)), { code: 'PERSONAL_DATA_TOO_LARGE' });
});

test('JSON-only contract rejects silent data loss and does not invoke getters', () => {
  const good = pathAccountState(initialState());
  const cycle = structuredClone(good); cycle.cursor = cycle;
  const getter = structuredClone(good); let accessed = false;
  Object.defineProperty(getter, 'zone', { enumerable: true, get() { accessed = true; return 'welcome'; } });
  const hole = structuredClone(good); hole.answers = new Array(1);
  for (const value of [{ ...good, unknown: undefined }, { ...good, unknown: NaN }, { ...good, unknown: 1n }, { ...good, unknown: new Date() }, { ...good, [Symbol('hidden')]: 1 }, cycle, getter, hole]) assert.throws(() => validatePersonalState('path', value));
  assert.equal(accessed, false);
});

test('personal writes are resource-bound CAS commands with no caller supplied identity', () => {
  const source = pathAccountState(initialState()), request = personalWriteRequest('path', 4, source);
  assert.deepEqual(request, { action: 'save', resource: 'path', expected_revision: 4, state: source });
  request.state.zone = 'career'; assert.notEqual(request.state.zone, source.zone);
  assert.deepEqual(personalDeleteRequest('path', 0), { action: 'delete', resource: 'path', expected_revision: 0 });
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2']) assert.throws(() => personalWriteRequest('path', value, source));
  for (const resource of ['care', 'messenger', 'rehearsal', 'family-album', '__proto__', 'unknown']) assert.throws(() => personalDeleteRequest(resource, 0));
});

test('response checks account and resource before accepting records or deletion tombstone', () => {
  const source = response('path', pathAccountState(initialState())), scope = { resource: 'path', accountId: 'account-1' };
  assert.deepEqual(validatePersonalResponse(source, scope), source);
  assert.equal(validatePersonalResponse({ ...source, state: null, revision: 4 }, scope).state, null);
  assert.throws(() => validatePersonalResponse({ ...source, accountId: 'account-2' }, scope), { code: 'ACCOUNT_CHANGED' });
  for (const patch of [{ scope: 'synk-care' }, { resource: 'platform-library' }, { revision: -1 }, { updatedAt: 'never' }, { access_token: 'not-accepted' }]) assert.throws(() => validatePersonalResponse({ ...source, ...patch }, scope));
  assert.throws(() => validatePersonalResponse(source, { resource: 'path' }));
});
