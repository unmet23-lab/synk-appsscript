// Anonymous SNS attribution. This observer never changes login or game state.
export const SOCIAL_COLLECTOR = 'https://workspace.synk.im';
const REF = /^[A-Za-z0-9_-]{20,100}$/;
const LOADER = Symbol.for('synk.social.tracking.loader');
export function createSocialConversion({ win = globalThis.window, doc = globalThis.document, now = () => Date.now() } = {}) {
  let loading = null;
  function attribution() {
    try {
      if (win.location.origin !== 'https://synk.im') return null;
      const query = new URL(win.location.href).searchParams.get('synk_ref');
      if (REF.test(query || '')) return query;
      const saved = JSON.parse(win.sessionStorage.getItem('synk-social-attribution:' + SOCIAL_COLLECTOR) || 'null');
      return saved?.until > now() && REF.test(saved.clickId || '') ? saved.clickId : null;
    } catch { return null; }
  }
  function ready() {
    if (!attribution()) return Promise.resolve(null);
    if (win.SynkSocialTracking?.track) return Promise.resolve(win.SynkSocialTracking);
    if (loading) return loading;
    if (win[LOADER]) return win[LOADER];
    loading = new Promise(resolve => {
      let settled = false;
      const done = value => { if (settled) return;settled = true;clearTimeout(timer);resolve(value); };
      const timer = setTimeout(() => done(null), 4000);
      try {
        const script = doc.createElement('script');
        script.src = SOCIAL_COLLECTOR + '/social-tracking.js';script.async = true;script.referrerPolicy = 'no-referrer';
        script.onload = () => done(win.SynkSocialTracking?.track ? win.SynkSocialTracking : null);
        script.onerror = () => done(null);doc.head.append(script);
      } catch { done(null); }
    });
    try { win[LOADER] = loading; } catch {}
    return loading;
  }
  async function record(event, { eventId, clickId } = {}) {
    try {
      if (!['trial_start', 'signup'].includes(event)) return { ok: false, reason: 'unsupported-completion' };
      const sdk = await ready();
      if (!sdk || clickId && sdk.getClickId() !== clickId) return { ok: false, reason: 'no-attribution' };
      return await sdk.track(event, { eventId });
    } catch { return { ok: false, reason: 'unavailable' }; }
  }
  return Object.freeze({ ready, record, attribution });
}
export const socialConversion = createSocialConversion();
void socialConversion.ready();
export function recordTrialStarted() { void socialConversion.record('trial_start'); }
