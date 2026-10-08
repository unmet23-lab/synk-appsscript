// Same-tab signup draft bookkeeping only. The server remains responsible for
// saving each step, adult checks and consent; this key never completes signup.
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const boolean = value => typeof value === 'boolean';
const instant = value => {
  if (typeof value !== 'string') return null;
  const at = Date.parse(value);
  return Number.isFinite(at) && new Date(at).toISOString() === value ? at : null;
};
const text = (value, maximum) => typeof value === 'string' && value.length <= maximum
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

/** Preserve an unfinished signup draft only against the same saved baseline. */
export function getOnboardingDraftBasis(view) {
  if (!plain(view)) return null;
  const profile = view.profile, onboarding = view.onboarding, steps = onboarding?.steps,
    adult = view.adult, verification = adult?.verification, consents = view.consents,
    central = view.centralAvailability, at = instant(view.asOf);
  if (typeof view.accountId !== 'string' || !view.accountId.trim() || view.status !== 'active'
    || !boolean(view.paused) || at === null || !plain(profile)
    || !text(profile.nickname, 60) || !text(profile.region, 80) || !text(profile.intro, 400)
    || !plain(onboarding) || onboarding.complete !== false || !plain(steps)
    || !['profile', 'adult', 'consents'].every(key => boolean(steps[key]))
    || !plain(consents) || !['profilePublic', 'receiveInvitations', 'storePreferences'].every(key => boolean(consents[key]))
    || !plain(adult) || !boolean(adult.selfDeclared) || !boolean(adult.verified)
    || !plain(verification) || !boolean(verification.required) || typeof verification.status !== 'string' || !verification.status
    || !boolean(verification.resumeRequired)
    || central != null && (!plain(central) || central.status !== 'active' || !boolean(central.resumeRequired))) return null;
  const validUntil = verification.validUntil, end = instant(validUntil);
  if (validUntil !== null && end === null) return null;

  return JSON.stringify([view.accountId, 'onboarding', view.status, view.paused,
    [onboarding.complete, steps.profile, steps.adult, steps.consents],
    [profile.nickname, profile.region, profile.intro],
    [consents.profilePublic, consents.receiveInvitations, consents.storePreferences],
    [adult.selfDeclared, adult.verified, verification.required, verification.status, validUntil,
      verification.resumeRequired, end !== null && end <= at],
    [central?.status ?? null, central?.resumeRequired ?? null]]);
}
