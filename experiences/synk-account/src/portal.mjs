import { createAccountClient } from './generated/account-client.cjs';
import { PRODUCTS, firstPartyAuthorization, trustedConsentRedirect } from './core.mjs';
import { createAccountView } from './account-view.mjs';
import { createGoogleAccess } from './google-auth.mjs';
import { createSignupConversion } from './social-signup-conversion.mjs';
const $ = id => document.getElementById(id);
const AUTH_LABELS = { login: '로그인', signup: '이메일로 가입', recover: '재설정 메일 보내기', reset: '새 비밀번호 저장' };
const RATE_ACTIONS = { login: '로그인', signup: '가입 메일', recover: '비밀번호 재설정 메일', reset: '비밀번호 변경', consent: '계정 연결' };
const RATE_CODES = new Set(['over_email_send_rate_limit', 'over_sms_send_rate_limit', 'over_request_rate_limit', 'rate_limit_exceeded']);
export function authErrorMessage(error) {
  if (error?.code === 'GOOGLE_CALLBACK_INCOMPLETE' && error.reason === 'identity_already_exists')
    return '이 Google 계정은 다른 SYNK 계정에 연결되어 있어요. 사용하던 계정으로 로그인하거나 계정 지원에 문의해 주세요.';
  const messages = {
    invalid_credentials: '이메일 또는 비밀번호가 맞지 않아요. 입력 내용을 확인해 주세요.',
    email_not_confirmed: '이메일 확인이 아직 끝나지 않았어요. 받은 메일의 확인 버튼을 누른 뒤 다시 로그인해 주세요.',
    weak_password: '비밀번호가 너무 단순해요. 8자 이상으로 영문·숫자·기호를 섞어 주세요.',
    same_password: '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.',
    email_address_invalid: '이메일 주소의 형식을 확인해 주세요.',
    user_already_exists: '이미 가입한 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
    email_exists: '이미 가입한 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
    signup_disabled: '지금은 새 계정 가입을 받지 못하고 있어요. 잠시 후 다시 확인해 주세요.',
    AUTH_RECOVERY_REQUIRED: '비밀번호 재설정 링크를 먼저 열어 주세요. 새 링크가 필요하면 가입한 이메일로 요청해 주세요.',
    AUTH_RECOVERY_CALLBACK: '이 재설정 링크는 만료됐거나 이 브라우저에서 열 수 없어요. 아래에서 재설정 메일을 다시 요청해 주세요.',
    GOOGLE_CALLBACK_INCOMPLETE: 'Google 로그인을 완료하지 못했어요. 취소했다면 원할 때 Google로 다시 계속해 주세요.',
  };
  if (messages[error?.code]) return messages[error.code];
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier', 'AUTH_CALLBACK_INCOMPLETE'].includes(error?.code))
    return '확인 링크가 만료되었거나 이 브라우저에서 처리할 수 없어요. 가입을 시작한 브라우저에서 메일을 열어 주세요. 이메일 확인을 이미 마쳤다면 이메일과 비밀번호로 로그인해 주세요.';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/invalid login credentials/i.test(message)) return messages.invalid_credentials;
  if (/email not confirmed/i.test(message)) return messages.email_not_confirmed;
  if (/fetch|network|timeout|timed out/i.test(message)) return '연결 응답을 받지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (error?.status >= 500) return '계정 서버가 잠시 응답하지 못하고 있어요. 잠시 후 다시 시도해 주세요.';
  return /[가-힣]/.test(message) ? message : '요청을 마치지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.';
}
export function cleanAuthCallbackUrl(value) {
  const url = new URL(value);
  for (const key of ['code', 'sb_flow_id', 'error', 'error_code', 'error_description', 'google_flow']) url.searchParams.delete(key);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (['error', 'error_code', 'error_description', 'access_token', 'refresh_token'].some(key => fragment.has(key))) url.hash = '';
  return url.href;
}
export function authRateLimit(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const seconds = message.match(/(?:request this after|try again (?:after|in)|retry (?:after|in))\s+(\d+)\s+seconds?\b/i)?.[1];
  if (!RATE_CODES.has(error?.code) && error?.status !== 429 && !/rate.?limit|too many requests/i.test(message)
    && !/for security purposes, you can only request this after \d+ seconds?/i.test(message)) return null;
  const value = error?.retryAfter ?? error?.retry_after ?? seconds;
  const wait = typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return { waitSeconds: Number.isSafeInteger(wait) && wait > 0 && wait <= 86400 ? wait : null };
}
export async function mountPortal({ config, sdk, accountFactory = createAccountClient, preview = false, loginSettings = { google: false, phone: false }, googleStorage,
  cooldownClock = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) } }) {
  let noticeScope = null;
  const signupConversion = preview ? null : createSignupConversion();
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const notice = (text, error = false, reveal = false, kind = error ? 'error' : 'info') => {
    noticeScope = null;const node = $('notice');setText(node, text);node.className = `notice${error ? ' error' : ''}`;node.setAttribute('data-kind', kind);
    if (reveal) { node.setAttribute('tabindex', '-1');node.focus?.({ preventScroll: true });node.scrollIntoView?.({ block: 'center' }); }
  };
  if (preview) $('preview-banner').hidden = false;
  $('learning-link').href = config.learningUrl;
  if (!config.configured) { $('setup').hidden = false;notice('계정 서비스 설정 전 · 기본 학습은 계속 사용할 수 있어요.');return; }
  let mode = new URL(location.href).searchParams.get('view') === 'reset' ? 'reset' : 'login', session = null, generation = 0, entryId = 0, authOperation = false, consentOperation = null, view = null, details = null, subject = null, closed = false, initializing = true, authVersion = 0, callbackBlocked = false;
  const cooldowns = new Map(), feedbacks = new Map();let cooldownTimer = null, logoutPending = null, signedOutSubject = null;
  let automaticAuthorizationAttempted = false;
  let google = null;
  // This copy keeps the instruction beside its button without another live region.
  const feedback = target => { const node = document.createElement('p');node.className = 'notice error';node.hidden = true;target.before(node);return node; };
  const authFeedback = feedback($('auth-submit')), consentFeedback = feedback($('approve').closest('.actions'));
  const remaining = scope => Math.max(0, Math.ceil(((cooldowns.get(scope)?.until || 0) - cooldownClock.now()) / 1000));
  const scopeVisible = scope => scope === 'consent' ? !$('consent').hidden : !$('auth-panel').hidden && scope === mode;
  const cooldownText = (scope, waiting) => waiting
    ? `${RATE_ACTIONS[scope]} 요청이 잠시 제한됐어요. 버튼의 남은 시간이 지나면 다시 눌러 주세요. 자동으로 다시 보내지 않아요.`
    : '대기 시간이 지났어요. 입력 내용을 확인한 뒤 버튼을 눌러 다시 요청해 주세요. 자동으로 다시 보내지 않아요.';
  const cooldownMessage = scope => { const record = cooldowns.get(scope);return record.until ? cooldownText(scope, remaining(scope) > 0) : record.message; };
  function renderControls() {
    const authSeconds = remaining(mode), consentSeconds = remaining('consent'), callbackWaiting = hadCallback && !initializationFinished;
    $('auth-submit').disabled = callbackWaiting || authOperation || authSeconds > 0;
    setText($('auth-submit'), callbackWaiting ? '확인 링크 처리 중…' : authOperation ? '요청을 보내고 있어요…' : authSeconds ? `${authSeconds}초 뒤 다시 요청` : AUTH_LABELS[mode]);
    document.querySelectorAll('[data-view]').forEach(button => { button.disabled = authOperation; });
    $('approve').disabled = $('deny').disabled = !!consentOperation || consentSeconds > 0;
    setText($('approve'), consentSeconds ? `${consentSeconds}초 뒤 다시 요청` : '연결하기');
    for (const [scope, node] of [[mode, authFeedback], ['consent', consentFeedback]]) {
      const record = cooldowns.get(scope), feedback = feedbacks.get(scope);node.hidden = !(record || feedback) || !scopeVisible(scope);
      if (record || feedback) { setText(node, record ? cooldownMessage(scope) : feedback.text);node.setAttribute('data-kind', record ? 'error' : feedback.kind);node.className = `notice${record || feedback.kind === 'error' ? ' error' : ''}`; }
    }
    google?.refreshControls();
  }
  function tickCooldowns() {
    if (cooldownTimer !== null) cooldownClock.clearTimeout(cooldownTimer);cooldownTimer = null;if (closed) return;
    renderControls();
    if (noticeScope && scopeVisible(noticeScope) && cooldowns.has(noticeScope)) setText($('notice'), cooldownMessage(noticeScope));
    if ([...cooldowns.keys()].some(scope => remaining(scope) > 0)) cooldownTimer = cooldownClock.setTimeout(tickCooldowns, 1000);
  }
  function clearCooldowns() { if (cooldownTimer !== null) cooldownClock.clearTimeout(cooldownTimer);cooldownTimer = null;cooldowns.clear();feedbacks.clear();noticeScope = null;authFeedback.hidden = consentFeedback.hidden = true;renderControls(); }
  const bounded = async promise => { let timer;try { return await Promise.race([promise, new Promise((_, reject) => { timer = cooldownClock.setTimeout(() => reject(Object.assign(new Error('연결을 확인하는 데 시간이 걸려요. 페이지를 새로고침한 뒤 다시 확인해 주세요.'), { code: 'AUTH_TIMEOUT' })), 12000); })]); } finally { cooldownClock.clearTimeout(timer); } };
  const report = (error, scope = mode) => {
    if (closed || error?.code === 'ACCOUNT_CHANGED') return;
    const limited = authRateLimit(error);
    if (!limited) { const text = authErrorMessage(error);feedbacks.set(scope, { text, kind: 'error' });notice(text, true, true);renderControls();return; }
    const message = `${RATE_ACTIONS[scope]} 요청이 잠시 제한됐어요. 서버가 대기 시간을 알려 주지 않았어요. 잠시 후 직접 다시 시도해 주세요.`;
    cooldowns.set(scope, { until: limited.waitSeconds ? cooldownClock.now() + limited.waitSeconds * 1000 : null, message });
    feedbacks.delete(scope);notice(cooldownMessage(scope), true, true);noticeScope = scope;
    if (cooldownTimer !== null) cooldownClock.clearTimeout(cooldownTimer);tickCooldowns();
  };
  const authorizationId = new URL(location.href).searchParams.get('authorization_id');
  const initialUrl = new URL(location.href), initialFragment = new URLSearchParams(initialUrl.hash.slice(1));
  const recoveryRequested = initialUrl.searchParams.get('view') === 'reset';
  const hadCallback = initialUrl.searchParams.has('code') || initialUrl.searchParams.has('error') || initialFragment.has('error') || initialUrl.searchParams.has('google_flow');
  let initializationPromise, initializationFinished = false, callbackError = null, callbackEntryPending = false;
  let pendingGoogleStorage = googleStorage;
  if (pendingGoogleStorage === undefined) { try { pendingGoogleStorage = window.sessionStorage; } catch { /* Google fails closed; email stays usable. */ } }
  google = createGoogleAccess({ config, sdk, enabled: !preview && loginSettings.google, phoneEnabled: !preview && loginSettings.phone,
    storage: pendingGoogleStorage, getSession: () => session, generation: () => generation,
    setBusy: value => { authOperation = value;renderControls(); }, hostBusy: () => authOperation || hadCallback && !initializationFinished, notice, bounded, authorizationId,
    continuePortal: () => enter(), registrationHeaders: () => signupConversion?.registrationHeaders() || {}, onRegistrationCompleted: result => signupConversion?.googleCompleted(result), endSession: async () => { authOperation = false;await logout('가입을 완료하지 않고 이 브라우저에서 로그아웃했어요.', {}, guarded(generation)); } });
  // Provider discovery must not hold up email login or the SDK's PKCE callback.
  if (typeof loginSettings?.then === 'function') void Promise.resolve(loginSettings).then(
    value => { if (!closed) google.settings(preview ? { google: false, phone: false } : value); },
    () => { if (!closed) google.settings({ google: false, phone: false }); });
  const callbackWaitText = '확인 링크 처리 중… 잠시 기다려 주세요. 계속 같으면 페이지를 새로고침해 주세요.';
  const showCallbackWaiting = (reveal = false) => {
    feedbacks.set(mode, { text: callbackWaitText, kind: 'pending' });notice(callbackWaitText, false, reveal, 'pending');renderControls();
  };
  const setMode = value => {
    mode = value;$('auth-heading').textContent = ({ login: '다시 만나서 반가워요.', signup: '나만의 SYNK를 시작해요.', recover: '비밀번호를 다시 정해요.', reset: '새 비밀번호를 정해 주세요.' })[mode];
    $('auth-copy').textContent = mode === 'recover' ? '가입한 이메일로 재설정 링크를 보내 드려요.' : mode === 'signup' ? '이메일로 일반 계정을 만들어요. 학생 권한은 소속 확인 뒤 연결돼요.' : mode === 'reset' ? '새 비밀번호를 저장하면 내 계정으로 계속 이용할 수 있어요.' : '한 번 로그인하면 등록된 SYNK 서비스에 같은 계정으로 연결해요. 서비스별 이용 권한은 따로 확인해요.';
    $('password-label').hidden = mode === 'recover';$('password').required = mode !== 'recover';$('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('email').closest('label').hidden = mode === 'reset';$('email').required = mode !== 'reset';$('signup-choices').hidden = mode !== 'signup';
    google?.authMode(mode);
    renderControls();
    document.querySelectorAll('[data-view]').forEach(button => { button.hidden = button.dataset.view === mode || mode === 'login' && button.dataset.view === 'login'; });
  };
  const guarded = token => () => { if (token !== generation || !session) throw Object.assign(new Error('로그인 상태가 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
  async function loadConsent(check) {
    const result = await bounded(sdk.auth.oauth.getAuthorizationDetails(authorizationId));check();
    if (result.error) throw result.error;
    if (result.data?.redirect_url) { location.assign(trustedConsentRedirect(result.data.redirect_url, config));return; }
    details = result.data;
    const authorization = firstPartyAuthorization(details, config), product = authorization.product;
    const destination = new URL(authorization.destination);
    // The production Care client was registered under the shared platform product.
    $('consent-name').textContent = destination.origin === 'https://synk.im' && destination.pathname === '/care/' ? 'SYNK 플레저' : PRODUCTS[product] || 'SYNK 서비스';
    $('consent-destination').textContent = details.redirect_uri;
    $('scopes').replaceChildren(...(details.scope || '').split(' ').filter(Boolean).map(scope => { const li = document.createElement('li');li.textContent = ({ openid: '계정을 구분하는 정보', email: '이메일 주소', profile: '기본 프로필' })[scope] || scope;return li; }));
    $('consent').hidden = false;notice(preview ? '제품과 연결할 정보를 확인한 뒤 선택해 주세요.' : automaticAuthorizationAttempted ? '계정과 연결할 서비스를 확인한 뒤 다시 연결하거나 취소해 주세요.' : '로그인한 SYNK 계정으로 서비스를 연결하고 있어요…');
    // Only the registered first-party request may proceed without a second click.
    // A failure, account change or duplicate SDK event never starts an auto-retry.
    if (!preview && !automaticAuthorizationAttempted) {
      automaticAuthorizationAttempted = true;
      await respondToAuthorization('approveAuthorization', check);
    }
  }
  async function respondToAuthorization(method, check = () => {}) {
    if (closed || consentOperation || remaining('consent') > 0) return;
    check();
    const authorization = firstPartyAuthorization(details, config);
    const operation = { redirecting: false }, token = generation;
    consentOperation = operation;cooldowns.delete('consent');renderControls();
    try {
      const result = await bounded(sdk.auth.oauth[method](authorizationId, { skipBrowserRedirect: true }));
      guarded(token)();check();if (closed || consentOperation !== operation) return;
      if (result.error) throw result.error;
      const target = trustedConsentRedirect(result.data.redirect_url, config, authorization.clientId);
      operation.redirecting = true;location.assign(target);
    } catch (error) { operation.redirecting = false;if (!closed && token === generation) report(error, 'consent'); }
    finally { if (consentOperation === operation && !operation.redirecting) { consentOperation = null;renderControls(); } }
  }
  async function enter() {
    if (closed) return;
    view?.stop();view = null;$('consent').hidden = true;$('account').hidden = true;
    google?.showAccount(false);
    if ($('account-next')) $('account-next').hidden = true;
    const token = generation, entry = ++entryId;
    const check = () => { guarded(token)();if (entry !== entryId) throw Object.assign(new Error('로그인 화면이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
    // An old stored session cannot authorize a callback whose exchange is still unresolved.
    if (hadCallback && !initializationFinished) { callbackEntryPending = true;$('auth-panel').hidden = false;setMode(mode);return; }
    callbackEntryPending = false;
    if (!session || mode === 'reset') { $('auth-panel').hidden = false;setMode(mode);notice(mode === 'reset' ? '메일에서 확인한 계정의 새 비밀번호를 저장해 주세요.' : '이메일로 로그인하거나 처음이라면 가입해 주세요.');return; }
    $('auth-panel').hidden = true;
    notice('로그인 정보를 확인하고 내 계정을 불러오고 있어요…', false, false, 'pending');
    try {
      const checked = await bounded(sdk.auth.getUser());check();if (checked.error || typeof checked.data?.user?.id !== 'string' || !checked.data.user.id || checked.data.user.id !== session?.user?.id) throw new Error('로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.');
      if (!await google.check(checked.data.user, check)) { $('auth-panel').hidden = true;return; }check();
      // Only local pending-owner validation is awaited. Tracking never adds an authentication request.
      const conversionHeaders=await signupConversion?.confirmedHeaders(checked.data.user)||{};check();
      void signupConversion?.confirmedUser(checked.data.user);
      if (authorizationId && !callbackBlocked) { await loadConsent(check);return; }
      const client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: 'platform', guard: check,
        getAccessToken: () => session?.access_token, refresh: async () => { const result = await bounded(sdk.auth.refreshSession());check();session = result.data?.session;return session?.access_token; },
        fetch: (url,options) => {
          const target=new URL(url),expected=new URL(config.accountApiUrl);
          const accountGet=target.origin===expected.origin&&target.pathname==='/functions/v1/synk-account'&&!target.search&&(!options.method||options.method==='GET');
          return fetch(url,accountGet?{...options,headers:{...options.headers,...conversionHeaders}}:options);
        } });
      view = createAccountView({ client, product: 'platform', guard: check, notice, preview, logout: (note, request) => logout(note, request, check) });await view.load();check();notice(preview ? '합성 계정 화면 예시 · 실제 로그인이나 서버 연결이 아닙니다.' : '로그인됐어요. 아래에서 서비스를 이어 쓰거나 내 계정을 관리할 수 있어요.', false, false, 'success');
      if ($('account-next')) $('account-next').hidden = preview || callbackBlocked;
      google.showAccount(!preview);
    } catch (error) {
      if (token !== generation || entry !== entryId || error.code === 'ACCOUNT_CHANGED') return;
      view?.stop();view = null;mode = 'login';setMode(mode);$('auth-panel').hidden = false;report(error);
    }
  }
  async function logout(note, request = {}, check) {
    check();if (authOperation || closed) return;
    const serverTerminationRequested = request.scope === 'all' || !!request.sessionId;
    let accessToken = session?.access_token;
    const operation = { generation: ++generation };
    logoutPending = operation;signedOutSubject = subject;authOperation = true;
    const current = () => !closed && operation.generation === generation;
    // Fence ordinary requests before either remote revocation or SDK storage cleanup can await.
    view?.stop();view = null;session = null;subject = null;consentOperation = null;clearCooldowns();
    google?.reset();
    authOperation = true;
    mode = 'login';void enter();
    notice('현재 계정 화면을 닫았어요. 브라우저 로그인 저장과 서버의 연결 종료를 확인하고 있어요…', false, false, 'pending');
    const revoke = (async () => {
      try {
        const revoker = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: 'platform',
          guard: () => { if (!current() || !accessToken) throw Object.assign(new Error('로그인 상태가 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); },
          getAccessToken: () => accessToken });
        // Never refresh the SDK session while signing it out.
        if (request.scope === 'all') { const result = await revoker.revokeAll();return result.refreshRevoked === true && result.legacyAccessGuard === true; }
        if (request.sessionId) { const result = await revoker.revokeSession(request.sessionId);return result.refreshRevoked === true; }
      } catch { /* Local cleanup is independent of the server result. */ }
      finally { accessToken = null; }
      return false;
    })();
    let cleared = false, complete = false;
    try {
      // Preserve the credential until the central fence and provider revocation have a result.
      // A failed or stalled server request must still proceed to this browser's SDK cleanup.
      try { complete = await bounded(revoke); } catch { /* Report incomplete server revocation below. */ }
      if (!current()) return;
      let sdkSettled = false;
      const sdkCleanup = (async () => sdk.auth.signOut({ scope: 'local' }))().then(
        result => { sdkSettled = true;return result; }, error => { sdkSettled = true;throw error; });
      // Keep this tab's sign-in locked until the actual SDK promise settles, even after a timeout.
      try { await bounded(sdkCleanup); } catch {
        if (!sdkSettled && current()) notice('현재 화면은 닫았지만 브라우저의 로그인 종료가 아직 끝나지 않았어요. 이 창을 닫고 연결 후 다시 확인해 주세요.', true);
        await sdkCleanup.catch(() => {});
      }
      if (current()) {
        const version = authVersion;
        try { const result = await bounded(sdk.auth.getSession());if (current() && version === authVersion) cleared = !result.error && result.data?.session === null; } catch {}
      }
    } finally {
      if (logoutPending === operation) {
        logoutPending = null;authOperation = false;
        if (!closed) { if (!current()) await enter();renderControls(); }
      }
    }
    // A different account or a new login intent owns its own screen and notice.
    if (!current()) return;
    notice(!cleared ? '현재 화면은 닫았지만 브라우저의 로그인 저장이 지워졌는지 확인하지 못했어요. 창을 닫고 연결 후 다시 확인해 주세요.'
      : note || (preview ? '예시 계정을 닫았어요. 실제 다른 제품의 로그인은 종료하지 않았어요.'
        : serverTerminationRequested && !complete ? '이 브라우저에서 로그아웃했어요. 서버의 로그인 종료는 연결 후 다시 확인해 주세요.'
        : request.scope === 'all' ? '모든 제품에 로그인 종료를 요청하고 이 브라우저에서 로그아웃했어요.' : '이 브라우저에서 로그아웃했어요.'), !cleared || !preview && serverTerminationRequested && !complete);
  }
  document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => {
    if (closed || authOperation) return;
    setMode(button.dataset.view);
    if (hadCallback && !initializationFinished) { showCallbackWaiting();return; }
    if (cooldowns.has(mode)) { notice(cooldownMessage(mode), true);noticeScope = mode;tickCooldowns(); }
    else notice('입력 내용을 확인한 뒤 원하는 요청을 선택해 주세요.');
  }; });
  $('auth-form').onsubmit = async event => {
    event.preventDefault();if (closed || authOperation || remaining(mode) > 0) return;
    if (hadCallback && !initializationFinished) { showCallbackWaiting(true);return; }
    const requestMode = mode, token = ++generation, requestStartedAt = Date.now();
    authOperation = true;cooldowns.delete(requestMode);feedbacks.set(requestMode, { text: '요청을 보내고 있어요. 잠시만 기다려 주세요.', kind: 'pending' });renderControls();notice('요청을 보내고 있어요. 잠시만 기다려 주세요.', false, false, 'pending');
    try {
      let result;
      const email = $('email').value.trim(), password = $('password').value;
      const callback = new URL(config.portalUrl);if (authorizationId) callback.searchParams.set('authorization_id', authorizationId);
      // The sign-up choices travel with the account (user_metadata.synk_signup): the account server starts
      // learning storage on the first sign-in only when the person ticked it here (SYNK-talk synk-auth.js).
      if (requestMode === 'signup' && !$('signup-age').checked) throw new Error('만 14세 이상만 가입할 수 있어요. 확인란을 선택해 주세요.');
      if (requestMode === 'signup') result = await sdk.auth.signUp({ email, password, options: { emailRedirectTo: callback.href,
        data: { synk_signup: { version: 'synk-signup-1', learning: $('signup-learning').checked, age14: true } } } });
      else if (requestMode === 'recover') { callback.searchParams.set('view', 'reset');result = await sdk.auth.resetPasswordForEmail(email, { redirectTo: callback.href }); }
      else if (requestMode === 'reset') result = await sdk.auth.updateUser({ password });
      else result = await sdk.auth.signInWithPassword({ email, password });
      if (closed) return;
      if (mode !== requestMode || token !== generation && (!result.data?.session?.user?.id || result.data.session.user.id !== subject)) { await enter();return; }
      if (result.error) throw result.error;
      callbackBlocked = false;callbackError = null;google?.clearCallback();
      if (requestMode === 'signup') void signupConversion?.rememberEmail(result, requestStartedAt);
      $('password').value = '';
      if (requestMode === 'recover' || requestMode === 'signup' && !result.data?.session) {
        const text = `${requestMode === 'signup' ? '가입 확인 메일을 요청했어요.' : '비밀번호 재설정 메일을 요청했어요.'} 메일함에서 안내를 확인해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.`;
        feedbacks.set(requestMode, { text, kind: 'success' });notice(text, false, true, 'success');
      }
      else if (requestMode === 'reset') {
        mode = 'login';feedbacks.delete('reset');
        const clean = new URL(location.href);clean.searchParams.delete('view');window.history?.replaceState(window.history.state, '', clean.href);
        await enter();if (!$('account').hidden) notice('새 비밀번호를 저장했어요. 내 계정으로 계속 이용할 수 있어요.', false, true, 'success');
      }
      else { signedOutSubject = null;session = result.data.session;generation++;subject = session?.user?.id;clearCooldowns();await enter(); }
    } catch (error) { if (token === generation && mode === requestMode) report(error, requestMode);else if (!closed) await enter(); }
    finally { authOperation = false;renderControls(); }
  };
  for (const [id, method] of [['approve', 'approveAuthorization'], ['deny', 'denyAuthorization']]) $(id).onclick = () => respondToAuthorization(method);
  window.addEventListener('pagehide', () => { closed = true;generation++;google?.stop();view?.stop();consentOperation = null;clearCooldowns(); });
  window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });
  const showStartupError = error => {
    if (hadCallback && !initializationFinished) { showCallbackWaiting(true);return; }
    if ($('account-next')) $('account-next').hidden = true;
    const retained = !$('account').hidden;
    const text = error?.code === 'GOOGLE_CALLBACK_INCOMPLETE'
      ? authErrorMessage(error) + (retained ? ' 현재 로그인된 SYNK 계정은 유지했어요.' : '')
      : hadCallback && retained
      ? '확인 링크가 만료되었거나 이 브라우저에서 처리할 수 없어요. 현재 로그인된 계정을 확인해 주세요. 다른 계정으로 로그인하려면 아래에서 먼저 로그아웃해 주세요.'
      : authErrorMessage(error) + (retained ? ' 현재 로그인된 계정은 유지했어요.' : '');
    feedbacks.set(mode, { text, kind: 'error' });notice(text, true, true);renderControls();
  };
  async function applyAuthEvent(event, value) {
    if (closed) return;
    // Even when storage cleanup fails, focus/refresh cannot undo this tab's explicit logout.
    // A successful new sign-in request can authorize this account again.
    if (signedOutSubject && value?.user?.id === signedOutSubject) return;
    authVersion++;const next = value?.user?.id || null, changed = next !== subject;
    if (changed) { generation++;subject = next;google?.reset();view?.stop();consentOperation = null;clearCooldowns(); }session = value;
    if (event === 'PASSWORD_RECOVERY') mode = 'reset';
    const version = authVersion, token = generation, awaitingCallback = hadCallback && !initializationFinished;
    // SIGNED_IN may precede the SDK's URL cleanup. Judge only its final initialize result.
    if (awaitingCallback) await initializationPromise;
    if (closed || version !== authVersion || token !== generation) return;
    // SIGNED_IN also fires when a signed-in tab regains focus. Keep the current screen and notice.
    if (!initializing && !authOperation && (changed || event === 'PASSWORD_RECOVERY' || awaitingCallback || callbackEntryPending)) {
      if (callbackError) setMode(recoveryRequested && !session ? 'recover' : 'login');
      await enter();
      if (!closed && token === generation && callbackError) showStartupError(callbackError);
    }
  }
  sdk.auth.onAuthStateChange((event, value) => { queueMicrotask(() => { void applyAuthEvent(event, value).catch(report); }); });
  initializationPromise = Promise.resolve().then(() => sdk.auth.initialize?.()).then(result => result, error => ({ error })).then(result => {
    if (closed) return result;
    initializationFinished = true;
    if (hadCallback && (result?.error || new URL(location.href).searchParams.has('code') || initialUrl.searchParams.has('error') || initialFragment.has('error'))) {
      callbackBlocked = true;callbackError = { code: initialUrl.searchParams.has('google_flow') ? 'GOOGLE_CALLBACK_INCOMPLETE' : recoveryRequested ? 'AUTH_RECOVERY_CALLBACK' : 'AUTH_CALLBACK_INCOMPLETE',
        reason: initialUrl.searchParams.get('error_code') || initialFragment.get('error_code') || result?.error?.code };
      // An explicit failed exchange cannot authorize an app. Keep a separately
      // verified existing session usable; successful callbacks still validate the nonce/owner.
      if (callbackError.code === 'GOOGLE_CALLBACK_INCOMPLETE') google.clearCallback();
    }
    if (hadCallback) {
      const clean = cleanAuthCallbackUrl(location.href);if (clean !== location.href) window.history?.replaceState(window.history.state, '', clean);
      for (const [scope, feedback] of feedbacks) if (feedback.text === callbackWaitText) feedbacks.delete(scope);
    }
    renderControls();
    return callbackError ? { ...result, error: callbackError } : result;
  });
  if (hadCallback) showCallbackWaiting();
  let startupError = null;
  try {
    const initialized = await bounded(initializationPromise);
    startupError = initialized?.error || null;
    const version = authVersion, result = await bounded(sdk.auth.getSession());
    if (version === authVersion) { session = result.data?.session;subject = session?.user?.id || null; }
    startupError ||= result.error;
  } catch (error) { startupError = error; }
  if (closed) return;
  if (startupError) mode = recoveryRequested && callbackBlocked && !session ? 'recover' : 'login';
  else if (mode === 'reset' && !session) { mode = 'recover';startupError = { code: 'AUTH_RECOVERY_REQUIRED' }; }
  initializing = false;setMode(mode);
  await enter().catch(report);
  if (startupError) showStartupError(startupError);
}
