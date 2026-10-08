// Server-to-server availability and terminal deletion. This is not a user login.
import { createHash, timingSafeEqual } from 'node:crypto';

const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const digest = value => createHash('sha256').update(value).digest();

export function createDatingLifecycleVerifier(config) {
  if (!exact(config, ['token', 'issuer', 'audience']) || typeof config.token !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(config.token)
    || config.issuer !== 'synk-account' || config.audience !== 'atlas-dating') throw new TypeError('Explicit server-only dating lifecycle configuration required.');
  const secret = digest(config.token);
  function authenticate(req) {
    if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) fail(403, 'lifecycle-browser-forbidden');
    if (req.socket?.encrypted !== true && !(loopback(req.socket?.remoteAddress) && loopback(req.socket?.localAddress))) fail(403, 'lifecycle-secure-transport-required');
    const match = /^Bearer ([\x21-\x7e]{1,4096})$/.exec(req.headers.authorization || '');
    if (!match || !timingSafeEqual(digest(match[1]), secret)) fail(401, 'lifecycle-authentication-required');
  }
  function event(input, at) {
    const deletion = input?.version === 1 && input?.type === 'account.deleted';
    const availability = input?.version === 2 && input?.type === 'account.availability';
    const keys = ['version', 'type', 'eventId', 'subjectId', 'occurredAt', 'issuer', 'audience'];
    if ((!deletion && !availability) || !exact(input, availability ? [...keys, 'status', 'sequence'] : keys)
      || availability && (!['active', 'deletion-requested', 'disabled'].includes(input.status) || !Number.isSafeInteger(input.sequence) || input.sequence < 1)
      || !uuid(input.eventId) || !uuid(input.subjectId)
      || input.issuer !== config.issuer || input.audience !== config.audience || typeof input.occurredAt !== 'string'
      || !Number.isFinite(Date.parse(input.occurredAt)) || new Date(input.occurredAt).toISOString() !== input.occurredAt)
      fail(400, 'invalid-lifecycle-event');
    if (!Number.isFinite(Date.parse(at)) || Date.parse(input.occurredAt) > Date.parse(at) + 5 * 60000) fail(400, 'lifecycle-future-event');
    // UUID casing is not a second identity or a second delivery.
    return { ...input, eventId: input.eventId.toLowerCase(), subjectId: input.subjectId.toLowerCase() };
  }
  return Object.freeze({ authenticate, event });
}
