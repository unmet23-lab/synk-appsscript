// Same-tab draft bookkeeping only. This key does not authorize saving,
// publish an answer, or contribute to recommendation or engine state.
import { DISCOVERY_FIELDS } from './discovery.mjs';

const fields = new Map(DISCOVERY_FIELDS.filter(field => field.id !== 'consent').map(field => [field.id, field]));
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

/** A draft survives only while its account, editing scope and saved source do. */
export function getProfileEditingBasis(view, key) {
  const profile = view?.profile, adult = view?.adult, central = view?.centralAvailability;
  if (typeof view?.accountId !== 'string' || !view.accountId || !plain(profile)
    || view.status !== 'active' || adult?.selfDeclared !== true
    || central != null && central.status !== 'active') return null;
  const at = instant(view.asOf);
  if (at === null) return null;

  let source;
  if (key === 'profile') source = [profile.nickname, profile.region, profile.intro];
  else {
    const field = fields.get(key), values = profile.values;
    if (!field || !plain(values) || field.legacy && !Object.hasOwn(values, key)) return null;
    const until = profile.expirations?.[key] ?? null, end = instant(until);
    source = [Object.hasOwn(values, key), values[key], profile.required?.includes(key) === true,
      until, end !== null && end <= at, view.publicAnswers?.expiredFields?.includes(key) === true];
  }

  const verification = adult.verification, validUntil = verification?.validUntil ?? null, end = instant(validUntil);
  return JSON.stringify([view.accountId, key, view.status, view.paused,
    [view.consents?.profilePublic, view.consents?.receiveInvitations, view.consents?.storePreferences],
    [adult.selfDeclared, adult.verified, verification?.required, verification?.status, validUntil,
      verification?.resumeRequired, end !== null && end <= at],
    [central?.status, central?.resumeRequired], source]);
}
