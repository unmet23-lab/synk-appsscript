import { fail, invalid, checkPersonalState } from './personal-state.mjs';

const encoder = new TextEncoder();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));
const revision = value => Number.isSafeInteger(value) && value >= 0;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[\s\u0000-\u001f\u007f]/u.test(value);

// A server may retain an existing resource after its screen retires. Register its
// validator here without reintroducing that resource into the client product list.
// This factory validates data only; authorization remains in the account server.
export function createPersonalContract(resources) {
  const registry = Object.freeze({ ...resources });
  const PERSONAL_LIMITS = Object.freeze(Object.fromEntries(Object.entries(registry).map(([key, value]) => [key, value.maxBytes])));
  const PERSONAL_RESOURCES = Object.freeze(Object.keys(PERSONAL_LIMITS));
  function resourceLimit(resource) {
    if (!Object.hasOwn(PERSONAL_LIMITS, resource)) invalid();
    return PERSONAL_LIMITS[resource];
  }
  function validatePersonalState(resource, value, options) {
    return checkPersonalState(value, resourceLimit(resource), copy => registry[resource].validate(copy, options));
  }
  function parsePersonalState(resource, source) {
    const limit = resourceLimit(resource);
    if (typeof source !== 'string') invalid();
    if (encoder.encode(source).length > limit) fail('PERSONAL_DATA_TOO_LARGE', '불러올 개인 기록이 허용 크기를 넘었어요.');
    let value;
    try { value = JSON.parse(source); } catch { invalid(); }
    return validatePersonalState(resource, value);
  }
  function serializePersonalState(resource, value) {
    return JSON.stringify(validatePersonalState(resource, value));
  }
  function personalWriteRequest(resource, expectedRevision, state) {
    if (!revision(expectedRevision)) invalid();
    return { action: 'save', resource, expected_revision: expectedRevision, state: validatePersonalState(resource, state) };
  }
  function personalDeleteRequest(resource, expectedRevision) {
    resourceLimit(resource);
    if (!revision(expectedRevision)) invalid();
    return { action: 'delete', resource, expected_revision: expectedRevision };
  }
  function validatePersonalResponse(value, { resource, accountId } = {}) {
    resourceLimit(resource);
    if (!identity(accountId)) invalid();
    if (!fields(value, ['ok', 'scope', 'resource', 'accountId', 'revision', 'updatedAt', 'state']) || value.ok !== true || value.scope !== 'synk-personal' || value.resource !== resource || !identity(value.accountId) || !revision(value.revision) || !Object.hasOwn(value, 'state') || !(value.updatedAt === null || typeof value.updatedAt === 'string' && value.updatedAt.length <= 40 && Number.isFinite(Date.parse(value.updatedAt)))) invalid();
    if (value.accountId !== accountId) fail('ACCOUNT_CHANGED', '로그인한 계정이 바뀌었어요. 현재 계정의 기록을 다시 불러와 주세요.');
    return { ok: true, scope: 'synk-personal', resource, accountId, revision: value.revision, updatedAt: value.updatedAt, state: value.state === null ? null : validatePersonalState(resource, value.state) };
  }
  return Object.freeze({ PERSONAL_LIMITS, PERSONAL_RESOURCES, validatePersonalState, parsePersonalState, serializePersonalState, personalWriteRequest, personalDeleteRequest, validatePersonalResponse });
}
