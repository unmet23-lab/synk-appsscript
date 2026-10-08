// Independent deadlines for directly published dating answers. This module
// neither copies private deadlines nor authorizes disclosure or invitations.
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const own = (value, key) => Object.hasOwn(value, key);
const copy = value => JSON.parse(JSON.stringify(value));
const fail = () => { throw new TypeError('Public profile: invalid explicit answer expiration'); };
const canonical = value => JSON.stringify(value, (_key, item) => plain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
const instant = value => { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(); return Date.parse(value); };

/**
 * Missing keys preserve the existing public deadline, including after it ends.
 * Explicit null alone removes a deadline. A past deadline may round-trip only
 * with the unchanged saved answer and exact unchanged saved deadline.
 */
export function normalizePublicExpirations(input, { values, previousValues = {}, previousExpirations = {}, at } = {}) {
  const now = instant(at);
  if (!plain(values) || !plain(previousValues) || !plain(previousExpirations) || input !== undefined && !plain(input)) fail();
  if (input !== undefined && Object.keys(input).some(field => !own(values, field))) fail();
  const result = {};
  for (const field of Object.keys(values)) {
    const provided = input !== undefined && own(input, field);
    const slot = provided ? Object.getOwnPropertyDescriptor(input, field) : Object.getOwnPropertyDescriptor(previousExpirations, field);
    if (!slot) continue;
    if (!own(slot, 'value')) fail();
    const deadline = slot.value;
    if (deadline !== null) {
      const end = instant(deadline);
      if (provided && end <= now && !(own(previousValues, field) && previousExpirations[field] === deadline
        && canonical(previousValues[field]) === canonical(values[field]))) fail();
    }
    result[field] = deadline;
  }
  return result;
}

/** Raw owner declarations stay in storage; only current values are comparable. */
export function projectPublicAnswers(profile, at) {
  const now = instant(at), values = {}, expiredFields = [];
  if (!plain(profile) || !plain(profile.values) || !Array.isArray(profile.required)) fail();
  const expirations = profile.expirations || {};
  if (!plain(expirations)) fail();
  for (const field of Object.keys(profile.values)) {
    const deadline = own(expirations, field) ? expirations[field] : null;
    if (deadline !== null && now >= instant(deadline)) expiredFields.push(field);
    else values[field] = copy(profile.values[field]);
  }
  return { values, required: copy(profile.required), expiredFields };
}
