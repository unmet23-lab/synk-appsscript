// Product UI policy for an owner's explicit temporary preference choice.
// Uses the host's current server projection time; never the device clock.
// Authentication, current source authority, persistence and final revalidation
// belong to the existing product host. This is not an additional Atlas engine.
export const PREFERENCE_DEADLINE_VERSION = 'preference-deadline-1';
const DAY = 86400000, KOREA_OFFSET = 9 * 3600000;
const TARGETS = ['baseline', 'context'];
const MODES = ['scope', 'today', 'context', 'custom'];
const KEYS = ['mode', 'target', 'at', 'until', 'contextExpiresAt', 'answerUntil', 'priorityUntil', 'allowedTargets'];
const own = (value, key) => Object.hasOwn(value, key);
const fail = (message, code) => { throw Object.assign(new TypeError(message), { code }); };
const invalid = () => fail('기한 선택과 사용할 범위를 다시 확인해 주세요.', 'deadline-invalid-input');

function canonicalTime(value) {
  if (typeof value !== 'string' || value.length > 32) fail('종료 시점과 현재 서버 기준 시각을 다시 확인해 주세요.', 'deadline-invalid-time');
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value)
    fail('종료 시점과 현재 서버 기준 시각을 다시 확인해 주세요.', 'deadline-invalid-time');
  return epoch;
}
function koreanTime(epoch) {
  const date = new Date(epoch + KOREA_OFFSET), pad = number => String(number).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
    + (date.getUTCMilliseconds() ? `.${String(date.getUTCMilliseconds()).padStart(3, '0')}` : '');
}
const endText = epoch => `한국시간 ${koreanTime(epoch)}부터 적용하지 않아요.`;

/**
 * `until` is the explicit field to send. `effectiveUntil` also includes current
 * inherited limits, so a scope-only selection can show its real boundary without
 * manufacturing a new until declaration. Limits must be authorized current own
 * answer/importance/context limits. Omit expired importance history.
 */
export function resolvePreferenceDeadline(input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype
    || !['mode', 'target', 'at'].every(key => own(input, key))
    || Reflect.ownKeys(input).some(key => typeof key !== 'string' || !KEYS.includes(key)
      || !own(Object.getOwnPropertyDescriptor(input, key), 'value'))) invalid();
  const { mode, target: requestedTarget, at } = input;
  if (!MODES.includes(mode) || !TARGETS.includes(requestedTarget)) invalid();
  const allowed = own(input, 'allowedTargets') ? input.allowedTargets : TARGETS;
  if (!Array.isArray(allowed) || allowed.length < 1 || allowed.length > 2 || new Set(allowed).size !== allowed.length
    || [...allowed].some(value => !TARGETS.includes(value)) || !allowed.includes(requestedTarget)) invalid();
  const now = canonicalTime(at), target = mode === 'context' ? 'context' : requestedTarget;
  if (!allowed.includes(target)) fail('이 답은 이번 추천에만 사용하는 범위를 지원하지 않아요.', 'deadline-context-unavailable');
  if (mode === 'custom' ? !own(input, 'until') : own(input, 'until')) invalid();

  const limits = [];
  for (const [key, label] of [['answerUntil', '원래 답'], ['priorityUntil', '현재 중요도'], ['contextExpiresAt', '이번 추천']]) {
    if (!own(input, key) || input[key] == null) continue;
    const epoch = canonicalTime(input[key]);
    // A baseline choice does not inherit the current recommendation's lifetime.
    if (key === 'contextExpiresAt' && target !== 'context') continue;
    if (epoch <= now) fail(key === 'contextExpiresAt' ? '이번 추천이 끝났어요. 새 추천을 시작한 뒤 다시 확인해 주세요.'
      : `${label}의 기한이 끝났어요. 사용할 기준을 먼저 다시 확인해 주세요.`, 'deadline-limit-expired');
    limits.push({ epoch, label });
  }
  const maximum = limits.length ? Math.min(...limits.map(limit => limit.epoch)) : null;
  const boundaryLabels = maximum === null ? [] : limits.filter(limit => limit.epoch === maximum).map(limit => limit.label);
  let requested = null, explicit = null, clamped = false;
  if (mode === 'today') {
    // Next Korean midnight is exclusive. No rounding of the server as-of time,
    // local browser timezone, daylight-saving setting or current device clock.
    requested = (Math.floor((now + KOREA_OFFSET) / DAY) + 1) * DAY - KOREA_OFFSET;
    if (!Number.isFinite(new Date(requested).getTime())) fail('현재 서버 기준 시각을 다시 확인해 주세요.', 'deadline-invalid-time');
    explicit = maximum === null ? requested : Math.min(requested, maximum);
    clamped = explicit !== requested;
  } else if (mode === 'custom') {
    requested = canonicalTime(input.until);
    if (requested <= now) fail('끝나는 시각은 현재 확인된 시각보다 뒤로 골라 주세요.', 'deadline-not-future');
    if (maximum !== null && requested > maximum)
      fail(`직접 정한 기한이 ${boundaryLabels.join('·')}의 기한을 넘어요. 더 이른 종료 시점을 골라 주세요.`, 'deadline-custom-exceeds-limit');
    explicit = requested;
  }
  const effective = explicit === null ? maximum : explicit;
  let summary;
  if (mode === 'today') summary = '오늘까지만 사용해요. '
    + (clamped ? `${boundaryLabels.join('·')}의 기한이 더 빨리 끝나요. ` : '') + endText(effective);
  else if (mode === 'custom') summary = `직접 정한 기한까지 사용해요. ${endText(effective)}`;
  else {
    summary = mode === 'context' && requestedTarget !== target ? '사용 범위를 ‘이번 추천에서만’으로 바꿔요. '
      : target === 'context' ? '이번 추천에서만 사용해요. ' : '고른 ‘앞으로도’ 범위로 사용해요. ';
    summary += effective !== null ? `${boundaryLabels.join('·')}의 기한이 먼저 끝나면 함께 끝나요. ${endText(effective)}`
      : target === 'context' ? '이번 추천이 끝나면 함께 끝나요. 별도 종료 시점은 정하지 않았어요.'
        : '별도 종료 시점은 정하지 않았어요.';
  }
  return { target, until: explicit === null ? null : new Date(explicit).toISOString(),
    effectiveUntil: effective === null ? null : new Date(effective).toISOString(),
    ...(requested === null ? {} : { requestedUntil: new Date(requested).toISOString() }), clamped, summary };
}
