/** The consent to evaluation-only signals (vertical slice design §20-4): its state lives in the world
 * (consents) and changes only through the EVAL_CONSENT command, which leaves a consent.changed event.
 * This is the part the authority reads; the visit lines themselves stay in town/eval.mjs, which nothing
 * in the town's own computation imports (G11). Academy-linked accounts are never asked and cannot turn it
 * on; withdrawing is always accepted.
 */
export const CONSENT_VER = 'town-eval-signals-1';
export const CONSENT_STATES = Object.freeze(['unasked', 'granted', 'declined', 'withdrawn']);
export const initialConsents = () => ({ evalSignals: { state: 'unasked', ver: CONSENT_VER } });
const id = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value);

/** A consent change, checked: an academy account cannot grant; withdrawing is always taken. */
export function changeConsent(consents, { state, ver = CONSENT_VER, academy = false }) {
  if (!['granted', 'declined', 'withdrawn'].includes(state)) throw new TypeError('granted, declined or withdrawn');
  if (state === 'granted' && academy) throw Object.assign(new Error('academy accounts are not asked'), { code: 'eval-consent-academy' });
  if (state !== 'withdrawn' && ver !== CONSENT_VER) throw Object.assign(new Error('another consent version'), { code: 'eval-consent-version' });
  return { ...consents, evalSignals: { state, ver: state === 'withdrawn' ? consents.evalSignals.ver : ver } };
}
export const mayWrite = consents => consents?.evalSignals?.state === 'granted' && consents.evalSignals.ver === CONSENT_VER;
export const validConsents = consents => !!consents?.evalSignals && CONSENT_STATES.includes(consents.evalSignals.state) && id(consents.evalSignals.ver);
