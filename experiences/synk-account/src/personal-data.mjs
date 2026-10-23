import { validateState as validatePath } from '../../path-vr/model.mjs';
import { validatePlatformLibrary, PLATFORM_LIBRARY_LIMITS } from './platform-library-data.mjs';
import { validateMemberActivity, MEMBER_ACTIVITY_LIMITS } from './member-activity-data.mjs';
import { validateMemberUnderstanding, MEMBER_UNDERSTANDING_LIMITS } from './member-understanding-data.mjs';
import { validateTravelAccountDocument, TRAVEL_ACCOUNT_CONTRACT } from '../../path-travel/planner-account.mjs';
import { invalid, jsonCopy } from './personal-state.mjs';
import { createPersonalContract } from './personal-contract.mjs';

// Product state stays product-owned. This contract never grants roles, creates
// accounts, or treats a device's storage preference as account authorization.
// Every resource, for the account server; a screen passes only its own check.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));

function pathDocument(value) {
  if (!fields(value, ['version', 'prefsConfirmed', 'prefs', 'zone', 'cursor', 'answers'])) invalid();
  const checked = validatePath({ ...value, consent: true });
  if (checked.answers.some(answer => answer.at.length > 40)) invalid();
  delete checked.consent;
  return checked;
}

export const PERSONAL_VALIDATORS = Object.freeze({
  path: { maxBytes: 64 * 1024, validate: pathDocument },
  'path-travel': { maxBytes: TRAVEL_ACCOUNT_CONTRACT.maxBytes, validate: validateTravelAccountDocument },
  'platform-library': { maxBytes: PLATFORM_LIBRARY_LIMITS.maxBytes, validate: validatePlatformLibrary },
  'member-insight': { maxBytes: MEMBER_ACTIVITY_LIMITS.maxBytes, validate: validateMemberActivity },
  'member-understanding': { maxBytes: MEMBER_UNDERSTANDING_LIMITS.maxBytes, validate: validateMemberUnderstanding },
});
export const { PERSONAL_LIMITS, PERSONAL_RESOURCES, validatePersonalState, parsePersonalState, serializePersonalState, personalWriteRequest, personalDeleteRequest, validatePersonalResponse } = createPersonalContract(PERSONAL_VALIDATORS);

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

