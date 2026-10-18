const PARAM = 'synk-platform-account';
const CANCEL = 'synk-platform-cancelled';
const validId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const mismatch = () => Object.assign(new Error('플랫폼에서 선택한 SYNK ID와 로그인 계정이 달라요. 플랫폼 계정을 확인한 뒤 다시 열어 주세요.'), { code: 'PLATFORM_ACCOUNT_MISMATCH' });

// This is a tab-local account match condition, never a credential or permission.
// Only the existing OAuth exchange and server response establish identity.
export function createPlatformEntry({ clientKey, getUrl, replaceUrl }) {
  const key = `synk.platform.entry.${clientKey}`;
  let captured = false, restored = false, invalid = false, cancelled = false, intent = null, storage;
  function capture(value) {
    if (captured) return;
    const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
    if (params.get(CANCEL) === clientKey) { cancelled = true;captured = true;return; }
    if (!params.has(PARAM)) { captured = true;return; }
    const values = params.getAll(PARAM), next = values.length === 1 && validId(values[0])
      ? { version: 1, accountId: values[0], attempted: false } : { version: 1, invalid: true };
    // Preserve the match condition before any await, HTTP, or URL cleanup. A
    // storage failure leaves the fragment for a fail-closed reload; malformed
    // input becomes a durable rejection instead of disappearing on reload.
    try { storage = typeof value === 'function' ? value() : value;storage.setItem(key, JSON.stringify(next)); }
    catch { throw Object.assign(new Error('플랫폼의 계정 연결을 이 탭에 보관하지 못했어요. 브라우저 저장 설정을 확인한 뒤 다시 시도해 주세요.'), { code: 'PLATFORM_ENTRY_STORAGE', retryable: true }); }
    intent = next;invalid = next.invalid === true;
    params.delete(PARAM);url.hash = params.toString();replaceUrl(url.href);
    captured = true;
  }
  function persist() { storage.setItem(key, JSON.stringify(intent)); }
  return {
    capture,
    restore(value) {
      if (invalid) throw mismatch();
      if (restored) return;
      storage = value;
      const text = storage.getItem(key);
      if (text) {
        try { if (text.length > 1024) throw mismatch();intent = JSON.parse(text); } catch { throw mismatch(); }
        if (intent?.version !== 1 || (!validId(intent.accountId) && !(intent.cancelled === true && intent.accountId === undefined)) || typeof intent.attempted !== 'boolean' || (intent.cancelled !== undefined && typeof intent.cancelled !== 'boolean')) throw mismatch();
        cancelled ||= intent.cancelled === true;
      }
      restored = true;
    },
    accountId: () => intent?.accountId || null,
    assertAccount(id) { if (intent?.accountId && id !== intent.accountId) throw mismatch(); },
    isCancelled: () => cancelled,
    resume() {
      if (!cancelled) return;
      if (intent?.accountId) { intent.cancelled = false;intent.attempted = true;persist(); }
      else { storage.removeItem(key);if (storage.getItem(key) !== null) throw mismatch();intent = null; }
      const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
      params.delete(CANCEL);url.hash = params.toString();replaceUrl(url.href);cancelled = false;
    },
    beginAttempt() {
      if (cancelled || !intent || intent.attempted) return false;
      intent.attempted = true;persist();return true;
    },
    stop() { if (intent) { intent.attempted = true;persist(); } },
    cancel() {
      if (!intent && !cancelled && !new URLSearchParams(new URL(getUrl()).hash.slice(1)).has(PARAM)) return;
      cancelled = true;
      let durable = false;
      try {
        intent ||= { version: 1, attempted: true };intent.cancelled = true;intent.attempted = true;
        persist();durable = true;
      } catch { /* Only explicit sign-out may remove the account condition. */ }
      if (!durable) {
        try { storage.removeItem(key);if (storage.getItem(key) !== null) throw mismatch(); } catch {}
      }
      // If a cancellation record cannot be written, retain it in the URL even
      // after successful intent removal: the login-token removal may also fail.
      const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
      params.delete(PARAM);
      if (!durable) params.set(CANCEL, clientKey);
      url.hash = params.toString();
      try { if (url.href !== getUrl()) replaceUrl(url.href); }
      catch { throw Object.assign(new Error('화면의 로그인은 종료했지만 자동 연결 취소를 저장하지 못했어요. 이 창을 닫아 주세요.'), { code: 'PLATFORM_ENTRY_STORAGE', retryable: false }); }
    },
  };
}

const PUBLIC = Object.freeze({ world: 'https://synk.im/account/client.html?product=world&play=learning-hub', care: 'https://synk.im/care/', fortune: 'https://synk.im/fortune/' });
const COMPANY = 'https://workspace.synk.im/';
export function platformCompanyEntry(href, identity) {
  let url;try { url = new URL(href); } catch { return href; }
  if (url.origin !== new URL(COMPANY).origin || url.pathname !== '/' || url.username || url.password || [...url.searchParams].some(([key, value]) => key !== 'tab' || !['home', 'messenger'].includes(value)) || url.searchParams.getAll('tab').length > 1) return href;
  const fragment = new URLSearchParams(url.hash.slice(1));
  if ([...fragment.keys()].some(key => key !== PARAM)) return href;
  url.hash = '';
  if (identity?.signedIn === true && identity.status === 'signed-in' && validId(identity.accountId)) url.hash = new URLSearchParams({ [PARAM]: identity.accountId.toLowerCase() }).toString();
  return url.href;
}
export function platformPublicEntry(id, identity) {
  if (!Object.hasOwn(PUBLIC, id)) return null;
  const url = new URL(PUBLIC[id]);
  if (identity?.signedIn === true && identity.status === 'signed-in' && validId(identity.accountId)) url.hash = new URLSearchParams({ [PARAM]: identity.accountId }).toString();
  return url.href;
}
