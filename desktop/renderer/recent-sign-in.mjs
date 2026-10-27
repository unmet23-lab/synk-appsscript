// 「지난번 이 PC」: which address signed in to this platform app last, shown masked on the sign-in dialog so a member
// knows which account comes back. The app signs in through the browser's SYNK ID, so it never learns whether that time
// was Google or e-mail; it names the way only when the account has just one. Kept in this app's localStorage, no token.
export const RECENT_SIGN_IN_KEY = 'synk.platform.recent-sign-in.v1';
const EMAIL = /^(?=.{3,254}$)[^\s@<>"']{1,64}@[^\s@<>"']+\.[^\s@<>"']+$/;
const WAYS = { email: '이메일', google: 'Google' };

export function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  const letters = [...name], shown = letters.slice(0, letters.length <= 2 ? 1 : 2).join('');
  return `${shown}${'*'.repeat(Math.min(3, Math.max(1, letters.length - [...shown].length)))}@${domain}`;
}
// `identity` is the main process's own reading of Auth's user (email and identities[].provider).
export function rememberSignIn(storage, identity, now = Date.now()) {
  const email = String(identity?.email || '').trim();if (!EMAIL.test(email)) return false;
  const providers = [...new Set((identity?.identities || []).map(row => row?.provider).filter(id => WAYS[id]))];
  try { storage?.setItem(RECENT_SIGN_IN_KEY, JSON.stringify({ v: 1, masked: maskEmail(email), way: providers.length === 1 ? providers[0] : null, at: now }));return true; } catch { return false; }
}
export function recentSignIn(storage) {
  try {
    const value = JSON.parse(storage?.getItem(RECENT_SIGN_IN_KEY) || 'null');
    if (value?.v !== 1 || typeof value.masked !== 'string' || !/^[^\s<>"']{1,8}@[^\s<>"']+$/.test(value.masked) || !Number.isFinite(value.at)) return null;
    return { masked: value.masked, way: WAYS[value.way] ? value.way : null, at: value.at };
  } catch { return null; }
}
export function forgetSignIn(storage) { try { storage?.removeItem(RECENT_SIGN_IN_KEY); } catch { /* nothing kept */ } }
export function recentSignInText(recent) {
  if (!recent) return '';
  return `지난번 이 PC: ${recent.masked}${recent.way ? ` · ${WAYS[recent.way]}` : ''} — 브라우저의 SYNK ID에서 로그인했어요.`;
}
