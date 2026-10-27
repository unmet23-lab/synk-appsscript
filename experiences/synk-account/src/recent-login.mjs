// 「지난번 이 기기 로그인」: which way (Google or e-mail) signed in last on this browser, so the SYNK ID page can say so
// and mark that button 「최근 사용」. It lives only in this browser's localStorage, is written only after a verified
// sign-in, holds no token and is never sent anywhere. The key carries the portal's path, so the rehearsal portal
// (/id-rehearsal/) on the same synk.im origin keeps its own. Only an e-mail sign-in keeps the whole address (to fill
// the field next time); a Google one keeps it masked. A sign-out keeps the hint — knowing the way back in is the
// point — while 「모든 SYNK 앱에서 로그아웃」 and 「이 기기에서 지우기」 remove it. A blocked storage means no hint.
export const RECENT_LOGIN_KEY = 'synk.id.recent-login.v1';
const METHODS = new Set(['google', 'email']);
const EMAIL = /^(?=.{3,254}$)[^\s@<>"']{1,64}@[^\s@<>"']+\.[^\s@<>"']+$/;
const MASKED = /^(?=.{3,254}$)[^\s@<>"']{1,8}@[^\s@<>"']+\.[^\s@<>"']+$/;
const key = realm => typeof realm === 'string' && /^\/[A-Za-z0-9/_-]{0,80}$/.test(realm) && realm !== '/id/' ? `${RECENT_LOGIN_KEY}:${realm}` : RECENT_LOGIN_KEY;
const store = storage => { if (storage !== undefined) return storage;try { return globalThis.localStorage || null; } catch { return null; } };

// 「un***@gmail.com」: enough to tell one's own addresses apart, not the whole address on a shared screen.
export function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  const letters = [...name], shown = letters.slice(0, letters.length <= 2 ? 1 : 2).join('');
  return `${shown}${'*'.repeat(Math.min(3, Math.max(1, letters.length - [...shown].length)))}@${domain}`;
}
export function readRecentLogin({ storage, realm } = {}) {
  try {
    const value = JSON.parse(store(storage)?.getItem(key(realm)) || 'null');
    if (value?.v !== 2 || !METHODS.has(value.method) || !Number.isFinite(value.at) || typeof value.masked !== 'string' || !MASKED.test(value.masked)) return null;
    const email = value.method === 'email' && typeof value.email === 'string' && EMAIL.test(value.email) ? value.email : null;
    if (value.method === 'email' && !email) return null;
    return { method: value.method, email, masked: value.masked, at: value.at };
  } catch { return null; }
}
export function writeRecentLogin(method, email, { storage, realm, now = Date.now() } = {}) {
  const address = String(email || '').trim();
  if (!METHODS.has(method) || !EMAIL.test(address)) return false;
  try {
    const target = store(storage);if (!target) return false;
    target.setItem(key(realm), JSON.stringify({ v: 2, method, ...(method === 'email' ? { email: address } : {}), masked: maskEmail(address), at: now }));return true;
  } catch { return false; }
}
export function forgetRecentLogin({ storage, realm } = {}) { try { store(storage)?.removeItem(key(realm)); } catch { /* nothing to forget */ } }
export const recentMethodName = method => method === 'google' ? 'Google' : '이메일';
