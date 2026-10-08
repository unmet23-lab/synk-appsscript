import test from 'node:test';
import assert from 'node:assert/strict';
import { PREFERENCE_DEADLINE_VERSION, resolvePreferenceDeadline } from '../experiences/atlas-lab/preference-deadline.mjs';

const at = '2026-10-07T03:00:00.000Z'; // Korean noon.
const resolve = (patch = {}) => resolvePreferenceDeadline({ mode: 'today', target: 'baseline', at, ...patch });
const code = expected => error => error instanceof TypeError && error.code === expected;

test('today uses the next Korean midnight and an exclusive ISO boundary', () => {
  assert.equal(PREFERENCE_DEADLINE_VERSION, 'preference-deadline-1');
  const result = resolve();
  assert.equal(result.target, 'baseline');
  assert.equal(result.until, '2026-10-07T15:00:00.000Z');
  assert.equal(result.requestedUntil, result.until); assert.equal(result.effectiveUntil, result.until);
  assert.equal(result.clamped, false);
  assert.match(result.summary, /한국시간 2026-10-08 00:00:00부터 적용하지 않아요/);
});

test('Korean midnight is a new today while the preceding millisecond ends the previous today', () => {
  assert.equal(resolve({ at: '2026-10-07T14:59:59.999Z' }).until, '2026-10-07T15:00:00.000Z');
  assert.equal(resolve({ at: '2026-10-07T15:00:00.000Z' }).until, '2026-10-08T15:00:00.000Z');
  assert.equal(resolve({ at: '2026-10-07T15:00:00.001Z' }).until, '2026-10-08T15:00:00.000Z');
});

test('Korean day arithmetic handles month, year and leap-day rollover', () => {
  for (const [clock, expected] of [
    ['2026-10-31T14:59:59.999Z', '2026-10-31T15:00:00.000Z'],
    ['2026-12-31T15:00:00.000Z', '2027-01-01T15:00:00.000Z'],
    ['2028-02-28T15:00:00.000Z', '2028-02-29T15:00:00.000Z'],
    ['2028-02-29T15:00:00.000Z', '2028-03-01T15:00:00.000Z'],
  ]) assert.equal(resolve({ at: clock }).until, expected);
});

test('server as-of determines today independently of device clock skew', () => {
  const original = Date.now;
  try {
    Date.now = () => Date.parse('1999-01-01T00:00:00.000Z'); const slow = resolve();
    Date.now = () => Date.parse('2099-12-31T23:59:59.999Z'); const fast = resolve();
    assert.deepEqual(fast, slow);
  } finally { Date.now = original; }
});

test('the device timezone and daylight-saving settings do not alter the Korean boundary or explanation', () => {
  const original = process.env.TZ, expected = resolve();
  try {
    for (const zone of ['UTC', 'America/New_York', 'Pacific/Honolulu', 'Asia/Seoul']) {
      process.env.TZ = zone;
      assert.deepEqual(resolve(), expected);
      assert.equal(resolve({ at: '2026-03-08T15:00:00.000Z' }).until, '2026-03-09T15:00:00.000Z');
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('today clamps to the shortest applicable answer, current importance or context limit', () => {
  const result = resolve({ target: 'context', answerUntil: '2026-10-07T13:00:00.000Z',
    priorityUntil: '2026-10-07T12:00:00.000Z', contextExpiresAt: '2026-10-07T11:00:00.000Z' });
  assert.equal(result.until, '2026-10-07T11:00:00.000Z'); assert.equal(result.effectiveUntil, result.until);
  assert.equal(result.requestedUntil, '2026-10-07T15:00:00.000Z'); assert.equal(result.clamped, true);
  assert.match(result.summary, /이번 추천의 기한이 더 빨리 끝나요/);
  assert.match(result.summary, /한국시간 2026-10-07 20:00:00부터/);
  assert.equal(resolve({ priorityUntil: '2026-10-07T04:00:00.000Z' }).until, '2026-10-07T04:00:00.000Z');
  assert.equal(resolve({ answerUntil: '2026-10-07T05:00:00.000Z' }).until, '2026-10-07T05:00:00.000Z');
});

test('equal limits do not falsely clamp and ties explain both current constraints', () => {
  const equal = resolve({ answerUntil: '2026-10-07T15:00:00.000Z' });
  assert.equal(equal.clamped, false);
  const tied = resolve({ answerUntil: '2026-10-07T04:00:00.000Z', priorityUntil: '2026-10-07T04:00:00.000Z' });
  assert.match(tied.summary, /원래 답·현재 중요도의 기한/);
});

test('baseline choices do not inherit or revive the current context lifetime', () => {
  assert.equal(resolve({ contextExpiresAt: '2026-10-07T04:00:00.000Z' }).until, '2026-10-07T15:00:00.000Z');
  assert.equal(resolve({ contextExpiresAt: '2026-10-07T02:00:00.000Z' }).until, '2026-10-07T15:00:00.000Z');
  assert.equal(resolve({ mode: 'scope', contextExpiresAt: '2026-10-07T04:00:00.000Z' }).effectiveUntil, null);
  assert.throws(() => resolve({ contextExpiresAt: '2026-10-07T04:00:00+00:00' }), code('deadline-invalid-time'));
});

test('context quick selection explicitly narrows baseline to context without a new timestamp declaration', () => {
  const result = resolve({ mode: 'context', contextExpiresAt: '2026-10-07T10:00:00.000Z' });
  assert.equal(result.target, 'context'); assert.equal(result.until, null);
  assert.equal(result.effectiveUntil, '2026-10-07T10:00:00.000Z');
  assert.equal(Object.hasOwn(result, 'requestedUntil'), false); assert.equal(result.clamped, false);
  assert.match(result.summary, /사용 범위를 ‘이번 추천에서만’으로 바꿔요/);
  assert.match(result.summary, /한국시간 2026-10-07 19:00:00부터/);
});

test('context mode never promotes a temporary choice to baseline and honors earlier source limits', () => {
  const result = resolve({ mode: 'context', target: 'context', allowedTargets: ['context'],
    contextExpiresAt: '2026-10-07T11:00:00.000Z', answerUntil: '2026-10-07T04:00:00.000Z' });
  assert.equal(result.target, 'context'); assert.equal(result.until, null);
  assert.equal(result.effectiveUntil, '2026-10-07T04:00:00.000Z');
  assert.match(result.summary, /원래 답의 기한/);
  assert.throws(() => resolve({ mode: 'context', allowedTargets: ['baseline'] }), code('deadline-context-unavailable'));
});

test('context without a fixed current end stays tied to the recommendation rather than inventing a date', () => {
  const result = resolve({ mode: 'context' });
  assert.equal(result.target, 'context'); assert.equal(result.until, null); assert.equal(result.effectiveUntil, null);
  assert.match(result.summary, /이번 추천이 끝나면 함께 끝나요/);
  assert.equal(result.summary.includes('2026'), false);
});

test('scope mode preserves existing selected scope and distinguishes explicit from inherited lifetime', () => {
  const baseline = resolve({ mode: 'scope' });
  assert.equal(baseline.target, 'baseline'); assert.equal(baseline.until, null); assert.equal(baseline.effectiveUntil, null);
  const context = resolve({ mode: 'scope', target: 'context', priorityUntil: '2026-10-07T04:00:00.000Z' });
  assert.equal(context.target, 'context'); assert.equal(context.until, null);
  assert.equal(context.effectiveUntil, '2026-10-07T04:00:00.000Z');
  assert.match(context.summary, /현재 중요도의 기한/);
  assert.equal(Object.hasOwn(context, 'requestedUntil'), false);
});

test('custom requires a canonical future ISO instant and keeps an allowed explicit boundary', () => {
  const result = resolve({ mode: 'custom', until: '2026-10-07T06:00:00.000Z', answerUntil: '2026-10-07T07:00:00.000Z' });
  assert.equal(result.until, '2026-10-07T06:00:00.000Z'); assert.equal(result.effectiveUntil, result.until);
  assert.equal(result.requestedUntil, result.until); assert.equal(result.clamped, false);
  assert.match(result.summary, /직접 정한 기한/);
  assert.throws(() => resolve({ mode: 'custom', until: at }), code('deadline-not-future'));
  assert.throws(() => resolve({ mode: 'custom', until: '2026-10-07T02:59:59.999Z' }), code('deadline-not-future'));
});

test('custom rejects exceeding any applicable upper bound instead of silently changing the owner choice', () => {
  for (const limit of ['answerUntil', 'priorityUntil', 'contextExpiresAt']) {
    assert.throws(() => resolve({ mode: 'custom', target: 'context', until: '2026-10-07T05:00:00.000Z',
      [limit]: '2026-10-07T04:00:00.000Z' }), code('deadline-custom-exceeds-limit'));
    const equal = resolve({ mode: 'custom', target: 'context', until: '2026-10-07T04:00:00.000Z', [limit]: '2026-10-07T04:00:00.000Z' });
    assert.equal(equal.until, '2026-10-07T04:00:00.000Z'); assert.equal(equal.clamped, false);
  }
});

test('expired current source limits require reconfirmation instead of generating past or extended deadlines', () => {
  for (const limit of ['answerUntil', 'priorityUntil', 'contextExpiresAt']) for (const mode of ['today', 'scope', 'context', 'custom'])
    for (const expired of [at, '2026-10-07T02:59:59.999Z'])
      assert.throws(() => resolve({ mode, target: 'context', [limit]: expired,
        ...(mode === 'custom' ? { until: '2026-10-07T04:00:00.000Z' } : {}) }), code('deadline-limit-expired'));
});

test('timestamps do not accept datetime-local, offsets, rounding, invalid calendar dates or non-string coercion', () => {
  const invalid = ['', '2026-10-07T04:00', '2026-10-07T04:00:00Z', '2026-10-07T04:00:00.000+00:00',
    '2026-10-07T13:00:00.000+09:00', '2026-02-30T04:00:00.000Z', ' 2026-10-07T04:00:00.000Z',
    '2026-10-07T04:00:00.000Z ', 1791345600000, new Date(at), null, undefined];
  for (const value of invalid) {
    assert.throws(() => resolve({ at: value }), code('deadline-invalid-time'));
    assert.throws(() => resolve({ mode: 'custom', until: value }), code('deadline-invalid-time'));
    if (value != null) assert.throws(() => resolve({ answerUntil: value }), code('deadline-invalid-time'));
  }
});

test('precision in inherited end times is shown honestly and absent limits remain absent', () => {
  const result = resolve({ answerUntil: '2026-10-07T04:00:00.501Z', priorityUntil: null, contextExpiresAt: undefined });
  assert.equal(result.until, '2026-10-07T04:00:00.501Z');
  assert.match(result.summary, /13:00:00\.501부터/);
  assert.equal(resolve({ mode: 'scope', answerUntil: null, priorityUntil: undefined }).effectiveUntil, null);
});

test('unrecognized modes, unsupported scopes, duplicate targets and unnecessary until fields are rejected', () => {
  for (const patch of [{ mode: 'tomorrow' }, { mode: null }, { target: 'ongoing' }, { allowedTargets: [] },
    { allowedTargets: ['baseline', 'baseline'] }, { allowedTargets: ['baseline', 'context', 'other'] },
    { allowedTargets: ['baseline', undefined] }, { allowedTargets: 'baseline' }, { allowedTargets: ['context'] },
    { mode: 'today', until: null }, { mode: 'scope', until: undefined }, { mode: 'context', until: '2026-10-07T04:00:00.000Z' },
    { mode: 'custom' }, { userTime: '2026-10-07T04:00:00.000Z' }])
    assert.throws(() => resolve(patch), code('deadline-invalid-input'));
});

test('the helper accepts no private profiles, peer data or executable accessors and returns only own deadline policy', () => {
  const value = { mode: 'today', target: 'baseline', at }, before = structuredClone(value);
  const result = resolvePreferenceDeadline(value);
  assert.deepEqual(value, before);
  assert.deepEqual(Object.keys(result).sort(), ['clamped', 'effectiveUntil', 'requestedUntil', 'summary', 'target', 'until']);
  for (const patch of [{ peer: { region: 'busan' } }, { profile: { nickname: 'private' } }, { inferredTrait: true }])
    assert.throws(() => resolve(patch), code('deadline-invalid-input'));
  const accessor = { mode: 'today', target: 'baseline', at };
  Object.defineProperty(accessor, 'until', { get() { throw new Error('do not read'); }, enumerable: true });
  assert.throws(() => resolvePreferenceDeadline(accessor), code('deadline-invalid-input'));
  assert.throws(() => resolvePreferenceDeadline(Object.create({ mode: 'today', target: 'baseline', at })), code('deadline-invalid-input'));
  assert.throws(() => resolvePreferenceDeadline(undefined), code('deadline-invalid-input'));
  assert.throws(() => resolvePreferenceDeadline([]), code('deadline-invalid-input'));
});

test('historical prototype pollution cannot create an inherited clock or hidden answer lifetime', () => {
  const oldAt = Object.getOwnPropertyDescriptor(Object.prototype, 'at');
  const oldUntil = Object.getOwnPropertyDescriptor(Object.prototype, 'answerUntil');
  try {
    Object.defineProperty(Object.prototype, 'at', { configurable: true, value: at });
    Object.defineProperty(Object.prototype, 'answerUntil', { configurable: true, value: '2026-10-07T04:00:00.000Z' });
    assert.throws(() => resolvePreferenceDeadline({ mode: 'today', target: 'baseline' }), code('deadline-invalid-input'));
    assert.equal(resolve().until, '2026-10-07T15:00:00.000Z');
  } finally {
    if (oldAt) Object.defineProperty(Object.prototype, 'at', oldAt); else delete Object.prototype.at;
    if (oldUntil) Object.defineProperty(Object.prototype, 'answerUntil', oldUntil); else delete Object.prototype.answerUntil;
  }
});
