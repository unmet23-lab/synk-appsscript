import { validateState as validatePath } from '../../path-vr/model.mjs';
import { validatePlatformLibrary, PLATFORM_LIBRARY_LIMITS } from './platform-library-data.mjs';
import { validateMemberActivity, MEMBER_ACTIVITY_LIMITS } from './member-activity-data.mjs';
import { validateMemberUnderstanding, MEMBER_UNDERSTANDING_LIMITS } from './member-understanding-data.mjs';
import { validateTravelAccountDocument, TRAVEL_ACCOUNT_CONTRACT } from '../../path-travel/planner-account.mjs';
import { fail, invalid, jsonCopy, checkPersonalState } from './personal-state.mjs';

// Product state stays product-owned. This contract never grants roles, creates
// accounts, or treats a device's storage preference as account authorization.
// Every resource, for the account server; a screen passes only its own check.
export const PERSONAL_LIMITS = Object.freeze({ path: 64 * 1024, 'path-travel': TRAVEL_ACCOUNT_CONTRACT.maxBytes, 'platform-library': PLATFORM_LIBRARY_LIMITS.maxBytes, 'member-insight': MEMBER_ACTIVITY_LIMITS.maxBytes, 'member-understanding': MEMBER_UNDERSTANDING_LIMITS.maxBytes });
export const PERSONAL_RESOURCES = Object.freeze(Object.keys(PERSONAL_LIMITS));
const encoder = new TextEncoder();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));
const revision = value => Number.isSafeInteger(value) && value >= 0;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[\s\u0000-\u001f\u007f]/u.test(value);

function resourceLimit(resource) {
  if (!Object.hasOwn(PERSONAL_LIMITS, resource)) invalid();
  return PERSONAL_LIMITS[resource];
}

function pathDocument(value) {
  if (!fields(value, ['version', 'prefsConfirmed', 'prefs', 'zone', 'cursor', 'answers'])) invalid();
  const checked = validatePath({ ...value, consent: true });
  if (checked.answers.some(answer => answer.at.length > 40)) invalid();
  delete checked.consent;
  return checked;
}

export function validatePersonalState(resource, value, options) {
  return checkPersonalState(value, resourceLimit(resource), copy => resource === 'member-understanding' ? validateMemberUnderstanding(copy, options) : resource === 'member-insight' ? validateMemberActivity(copy, options) : resource === 'path-travel' ? validateTravelAccountDocument(copy) : resource === 'platform-library' ? validatePlatformLibrary(copy) : pathDocument(copy));
}

export function parsePersonalState(resource, source) {
  const limit = resourceLimit(resource);
  if (typeof source !== 'string') invalid();
  if (encoder.encode(source).length > limit) fail('PERSONAL_DATA_TOO_LARGE', '불러올 개인 기록이 허용 크기를 넘었어요.');
  let value;
  try { value = JSON.parse(source); } catch { invalid(); }
  return validatePersonalState(resource, value);
}

export function serializePersonalState(resource, value) {
  return JSON.stringify(validatePersonalState(resource, value));
}

export function pathAccountState(deviceState) {
  const copy = jsonCopy(deviceState, PERSONAL_LIMITS.path);
  if (!fields(copy, ['version', 'consent', 'prefsConfirmed', 'prefs', 'zone', 'cursor', 'answers']) || typeof copy.consent !== 'boolean') invalid();
  delete copy.consent;
  return validatePersonalState('path', copy);
}

export function pathDeviceState(accountState, { consent = false } = {}) {
  if (typeof consent !== 'boolean') invalid();
  return { ...validatePersonalState('path', accountState), consent };
}

export function personalWriteRequest(resource, expectedRevision, state) {
  if (!revision(expectedRevision)) invalid();
  return { action: 'save', resource, expected_revision: expectedRevision, state: validatePersonalState(resource, state) };
}

export function personalDeleteRequest(resource, expectedRevision) {
  resourceLimit(resource);
  if (!revision(expectedRevision)) invalid();
  return { action: 'delete', resource, expected_revision: expectedRevision };
}

export function validatePersonalResponse(value, { resource, accountId } = {}) {
  resourceLimit(resource);
  if (!identity(accountId)) invalid();
  if (!fields(value, ['ok', 'scope', 'resource', 'accountId', 'revision', 'updatedAt', 'state']) || value.ok !== true || value.scope !== 'synk-personal' || value.resource !== resource || !identity(value.accountId) || !revision(value.revision) || !Object.hasOwn(value, 'state') || !(value.updatedAt === null || typeof value.updatedAt === 'string' && value.updatedAt.length <= 40 && Number.isFinite(Date.parse(value.updatedAt)))) invalid();
  if (value.accountId !== accountId) fail('ACCOUNT_CHANGED', '로그인한 계정이 바뀌었어요. 현재 계정의 기록을 다시 불러와 주세요.');
  return { ok: true, scope: 'synk-personal', resource, accountId, revision: value.revision, updatedAt: value.updatedAt, state: value.state === null ? null : validatePersonalState(resource, value.state) };
}
