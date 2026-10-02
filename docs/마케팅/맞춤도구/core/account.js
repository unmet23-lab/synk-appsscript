/* SYNK 맞춤 도구 — SYNK 계정에서 고른 설정 불러오기(누를 때만).
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/core/account.js
 * 누르면 SYNK 로그인(synk.im/id/)을 거쳐 이 페이지로 돌아와, 계정의 아틀라스 요약(synk-account ?view=atlas)에서
 * 본인이 고른 설정(도움 방식·설명 길이·글씨 크기·움직임)만 읽는다. 이 도구의 답·체크·기록은 보내지 않는다.
 * 받은 로그인 토큰은 설정을 읽은 즉시 로그아웃하고 버린다(어디에도 저장하지 않는다). 읽은 설정만 이 기기에 둔다.
 * 로그인 없이 쓰는 도구의 기본 동작은 그대로다.
 */
(function (root) {
  'use strict';
  // 공개 값(운영 Synk Core의 주소·공개 키, 맞춤 도구의 공개 PKCE 클라이언트). 비밀이 아니다.
  const CONFIG = Object.freeze({
    supabaseUrl: 'https://qiwxeddwwnzkwalpsuty.supabase.co',
    publishableKey: 'sb_publishable_g_T9VApp7f7L3girlJW8hA_j__pZjED',
    clientId: '291a98a7-4fa8-44fe-b5de-8acb790bea21',
    redirects: ['https://synk.im/brief/computer/', 'https://synk.im/brief/meeting/'],
  });
  const PENDING = 'synk.tool.account.pending', SAVED = 'synk.tool.account.settings';
  // 계정이 저장하는 고른 설정의 어휘(atlas/flow.js PRESENTATION, talk lib/atlas-memory-rules.js와 같다).
  const VOCAB = Object.freeze({ support: ['choose', 'step', 'independent'], textSize: ['standard', 'large'],
    explanation: ['brief', 'standard', 'detailed'], motion: ['full', 'reduced'], audio: ['off', 'available'] });
  const WORDS = Object.freeze({ support: { step: '단계별 도움', choose: '그때그때 고르기', independent: '혼자 먼저' },
    textSize: { large: '큰 글씨', standard: '보통 글씨' }, explanation: { brief: '짧은 설명', standard: '보통 설명', detailed: '자세한 설명' },
    motion: { reduced: '움직임 줄이기', full: '움직임 그대로' } });
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const clean = value => {
    if (!object(value)) return null;
    const out = {};
    for (const [key, choice] of Object.entries(value)) if (Object.hasOwn(VOCAB, key) && VOCAB[key].includes(choice)) out[key] = choice;
    return Object.keys(out).length ? out : null;
  };
  const store = {
    get(area, key) { try { const raw = root[area].getItem(key); return raw == null ? null : JSON.parse(raw); } catch { return null; } },
    set(area, key, value) { try { root[area].setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
    del(area, key) { try { root[area].removeItem(key); } catch { /* 저장이 막힌 브라우저 */ } },
  };
  const here = () => { try { return `${root.location.origin}${root.location.pathname}`; } catch { return ''; } };
  // 등록한 주소(synk.im의 도구 페이지)에서만 연다. 미리보기·다른 주소에서는 단추를 숨긴다.
  const available = () => CONFIG.redirects.includes(here()) && !!root.crypto?.subtle && !!root.sessionStorage;
  const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  async function begin() {
    if (!available()) throw new Error('이 주소에서는 SYNK 계정을 불러올 수 없어요.');
    const random = () => b64url(root.crypto.getRandomValues(new Uint8Array(32)));
    const verifier = random(), state = random();
    const challenge = b64url(new Uint8Array(await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    store.set('sessionStorage', PENDING, { verifier, state, redirectUri: here(), createdAt: Date.now() });
    const url = new URL('/auth/v1/oauth/authorize', CONFIG.supabaseUrl);
    url.search = new URLSearchParams({ response_type: 'code', client_id: CONFIG.clientId, redirect_uri: here(), state,
      code_challenge: challenge, code_challenge_method: 'S256', scope: 'openid' }).toString();
    root.location.assign(url.href);
  }

  // 돌아온 주소에 로그인 결과가 있으면 끝맺는다. 없으면 null. 주소창의 결과 값은 바로 지운다.
  async function finish({ fetcher = root.fetch, now = Date.now() } = {}) {
    let params;
    try { params = new URL(root.location.href).searchParams; } catch { return null; }
    if (!params.has('state') || !(params.has('code') || params.has('error'))) return null;
    const pending = store.get('sessionStorage', PENDING);
    store.del('sessionStorage', PENDING);
    try { root.history.replaceState(null, '', root.location.pathname + root.location.hash); } catch { /* 주소를 못 바꿔도 결과는 쓴다 */ }
    if (!pending || pending.state !== params.get('state') || pending.redirectUri !== here() || !(now - pending.createdAt <= 600000 && now >= pending.createdAt)) {
      return { status: 'failed', message: '이 브라우저에서 시작한 불러오기가 아니거나 시간이 지났어요. 다시 눌러 주세요.' };
    }
    if (params.has('error')) return { status: params.get('error') === 'access_denied' ? 'denied' : 'failed', message: params.get('error') === 'access_denied' ? 'SYNK 계정 연결을 취소했어요.' : 'SYNK 로그인을 마치지 못했어요.' };
    let token;
    try {
      const response = await fetcher(new URL('/auth/v1/oauth/token', CONFIG.supabaseUrl).href, { method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: CONFIG.clientId, redirect_uri: here(), code: params.get('code'), code_verifier: pending.verifier }).toString() });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.access_token !== 'string') return { status: 'failed', message: 'SYNK 로그인을 마치지 못했어요. 다시 눌러 주세요.' };
      token = data.access_token;
      const summary = await fetcher(new URL('/functions/v1/synk-account?view=atlas', CONFIG.supabaseUrl).href, { credentials: 'omit', cache: 'no-store',
        headers: { apikey: CONFIG.publishableKey, Authorization: `Bearer ${token}`, 'X-SYNK-Product': 'platform', 'X-SYNK-Contract': '1', 'X-SYNK-App-Version': '0.2.0' } });
      const body = await summary.json().catch(() => null);
      if (!summary.ok || body?.ok !== true) return { status: 'failed', message: '계정의 설정을 읽지 못했어요. 잠시 뒤 다시 눌러 주세요.' };
      const presentation = clean(body.summary?.presentation);
      store.set('localStorage', SAVED, { v: 1, presentation, shared: body.shared === 'practice-and-settings', at: now });
      return { status: 'loaded', presentation, shared: body.shared === 'practice-and-settings' };
    } catch {
      return { status: 'failed', message: '연결을 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.' };
    } finally {
      // 설정만 읽으면 끝이다. 이 도구는 로그인을 이어 가지 않는다.
      if (token) {
        try { await fetcher(new URL('/auth/v1/logout?scope=local', CONFIG.supabaseUrl).href, { method: 'POST', credentials: 'omit',
          headers: { apikey: CONFIG.publishableKey, Authorization: `Bearer ${token}` } }); } catch { /* 토큰은 곧 만료된다 */ }
        token = null;
      }
    }
  }

  function read() {
    const saved = store.get('localStorage', SAVED);
    return saved && saved.v === 1 ? { presentation: clean(saved.presentation), shared: saved.shared === true, at: saved.at } : null;
  }
  const forget = () => store.del('localStorage', SAVED);
  const describe = presentation => Object.entries(presentation || {}).map(([key, value]) => WORDS[key]?.[value]).filter(Boolean);

  root.SynkToolAccount = Object.freeze({ available, begin, finish, read, forget, describe, CONFIG });
})(typeof globalThis !== 'undefined' ? globalThis : this);
