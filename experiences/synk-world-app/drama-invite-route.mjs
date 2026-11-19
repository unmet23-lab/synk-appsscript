const INVITE_KEY = 'synk.world.drama.invite.v1';
const MAX_AGE = 30 * 60 * 1000;
const callbacks = new Set(['code', 'state', 'session_state', 'error', 'error_description', 'error_code']);

function supported(language) {
  return language === 'en' || language === 'mn';
}

// The invitation stores only a display language and an expiry in this tab.
export function createDramaInvite(search, getStorage, now = Date.now) {
  const query = new URLSearchParams(search);
  let storage;
  try { storage = getStorage(); } catch { /* Explicit URLs still work. */ }
  let language = null;
  function clear() {
    language = null;
    try { storage?.removeItem(INVITE_KEY); } catch { /* Storage may be disabled. */ }
  }
  const keys = [...query.keys()];
  const requested = query.get('lang');
  if (query.get('invite') === '1' && query.get('drama') === '1' && supported(requested)
      && keys.length === 3 && new Set(keys).size === 3) {
    language = requested;
    try { storage?.setItem(INVITE_KEY, JSON.stringify({language, at: now()})); } catch { /* Keep it in memory. */ }
  } else if (keys.every(key => callbacks.has(key))) {
    try {
      const saved = JSON.parse(storage?.getItem(INVITE_KEY) || 'null');
      const age = now() - saved?.at;
      if (supported(saved?.language) && Number.isFinite(saved.at) && age >= 0 && age < MAX_AGE) {
        language = saved.language;
      } else {
        clear();
      }
    } catch { clear(); }
  } else {
    clear();
  }
  return {get language() { return language; }, clear};
}
