import { createAccountClient } from './generated/account-client.cjs';
import { PRODUCTS, firstPartyAuthorization, trustedConsentRedirect } from './core.mjs';
import { createAccountView } from './account-view.mjs';
import { createGoogleAccess } from './google-auth.mjs';
import { createSignupConversion } from './social-signup-conversion.mjs';
import { createPortalSecurity, passwordProblem } from './portal-security.mjs';
const $ = id => document.getElementById(id);
const AUTH_LABELS = { login: '로그인', signup: '이메일로 가입', recover: '재설정 메일 보내기', reset: '새 비밀번호 저장' };
const RATE_ACTIONS = { login: '로그인', signup: '가입 메일', recover: '비밀번호 재설정 메일', reset: '비밀번호 변경', consent: '계정 연결' };
const RATE_CODES = new Set(['over_email_send_rate_limit', 'over_sms_send_rate_limit', 'over_request_rate_limit', 'rate_limit_exceeded']);
export function authErrorMessage(error) {
  if (error?.code === 'GOOGLE_CALLBACK_INCOMPLETE' && error.reason === 'identity_already_exists')
    return '이 Google 계정은 다른 SYNK 계정에 연결돼 있어요. 그 계정으로 로그인하거나 hello@synk.im으로 문의해 주세요.';
  const messages = {
    invalid_credentials: '이메일 또는 비밀번호가 맞지 않아요. 다시 입력해 주세요.',
    email_not_confirmed: '이메일 확인이 아직 끝나지 않았어요. 받은 메일의 확인 버튼을 누른 뒤 다시 로그인해 주세요.',
    weak_password: '비밀번호가 너무 단순해요. 8자 이상으로 영문·숫자·기호를 섞어 주세요.',
    same_password: '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.',
    email_address_invalid: '이메일 주소 형식이 맞지 않아요. 다시 입력해 주세요.',
    user_already_exists: '이미 가입한 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
    email_exists: '이미 가입한 이메일이에요. 로그인하거나 비밀번호 찾기를 이용해 주세요.',
    signup_disabled: '지금은 새 가입을 받지 않아요. 잠시 뒤 다시 시도해 주세요.',
    AUTH_RECOVERY_REQUIRED: '비밀번호 재설정 링크를 먼저 열어 주세요. 새 링크가 필요하면 가입한 이메일로 요청해 주세요.',
    AUTH_RECOVERY_CALLBACK: '이 재설정 링크는 만료됐거나 이 브라우저에서 열 수 없어요. 아래에서 재설정 메일을 다시 요청해 주세요.',
    GOOGLE_CALLBACK_INCOMPLETE: 'Google 로그인을 마치지 못했어요. 취소했다면 원할 때 「Google로 계속하기」를 다시 눌러 주세요.',
  };
  if (messages[error?.code]) return messages[error.code];
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier', 'AUTH_CALLBACK_INCOMPLETE'].includes(error?.code))
    return '확인 링크가 만료됐거나 이 브라우저에서 열 수 없어요. 가입을 시작한 브라우저에서 메일을 열어 주세요. 이메일 확인을 이미 마쳤다면 이메일과 비밀번호로 로그인해 주세요.';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/invalid login credentials/i.test(message)) return messages.invalid_credentials;
  if (/email not confirmed/i.test(message)) return messages.email_not_confirmed;
  if (/fetch|network|timeout|timed out/i.test(message)) return '인터넷 연결이 불안정해 응답을 못 받았어요. 연결되면 다시 시도해 주세요.';
  if (error?.status >= 500) return '계정 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요.';
  return /[가-힣]/.test(message) ? message : '요청을 마치지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.';
}
export function cleanAuthCallbackUrl(value) {
  const url = new URL(value);
  for (const key of ['code', 'sb_flow_id', 'error', 'error_code', 'error_description', 'google_flow', 'message']) url.searchParams.delete(key);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (['error', 'error_code', 'error_description', 'access_token', 'refresh_token', 'message'].some(key => fragment.has(key))) url.hash = '';
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
  if (!config.configured) { $('setup').hidden = false;notice('지금은 로그인할 수 없어요. 기본 학습은 로그인 없이 할 수 있어요.');return; }
  const requestedView = new URL(location.href).searchParams.get('view');
  let mode = requestedView === 'reset' ? 'reset' : requestedView === 'signup' ? 'signup' : 'login', session = null, generation = 0, entryId = 0, authOperation = false, consentOperation = null, view = null, details = null, subject = null, closed = false, initializing = true, authVersion = 0, callbackBlocked = false;
  // A reset mail's token-hash link works in any browser or device. Its one-time token is used only after a
  // tap here, so a mail scanner that opens links cannot use it up. The new-password form opens only after
  // such a link (or the SDK's own PASSWORD_RECOVERY) on this page; a plain signed-in ?view=reset gets the
  // 「로그인과 보안」 card, which asks for the current password.
  const linkParams = new URL(location.href).searchParams;
  let recoveryLink = mode === 'reset' && linkParams.get('type') === 'recovery' && /^[A-Za-z0-9_-]{16,200}$/.test(linkParams.get('token_hash') || '') ? linkParams.get('token_hash') : null;
  // The token stays in memory only: off the address bar, history and anything shared from this page.
  if (linkParams.has('token_hash')) { const clean = new URL(location.href);clean.searchParams.delete('token_hash');clean.searchParams.delete('type');window.history?.replaceState(window.history.state, '', clean.href); }
  // An e-mail change has two confirmations; the first returns here with only a message (query or fragment).
  const linkFragment = new URLSearchParams(new URL(location.href).hash.slice(1)), emailChangeHalf = requestedView === 'security' && (linkParams.has('message') || linkFragment.has('message')) && !linkParams.has('code');
  if (emailChangeHalf) { const clean = cleanAuthCallbackUrl(location.href);if (clean !== location.href) window.history?.replaceState(window.history.state, '', clean); }
  let recoveryReady = false, recoveredOver = null, focusSecurity = requestedView === 'security';
  let landingNotice = emailChangeHalf ? { text: '한 주소의 확인이 끝났어요. 다른 주소로 간 메일의 「변경 확인하기」도 눌러 주세요. 둘 다 누르면 로그인 이메일이 바뀌어요.', error: false } : null;
  const resetLinkStep = () => mode === 'reset' && !!recoveryLink && !recoveryReady;
  // After a confirmed reset link a reload keeps the new-password form for ten minutes, for that account only.
  const RECOVERY_KEY = 'synk.id.recovery.v1', RECOVERY_GRACE = 600000;
  let recoveryStorage = null;try { recoveryStorage = window.sessionStorage; } catch { /* The form then needs the link again. */ }
  const rememberRecovery = userId => { try { if (userId) recoveryStorage?.setItem(RECOVERY_KEY, JSON.stringify({ userId, until: Date.now() + RECOVERY_GRACE }));else recoveryStorage?.removeItem(RECOVERY_KEY); } catch { /* best effort */ } };
  const recoveryGrace = userId => { try { const value = JSON.parse(recoveryStorage?.getItem(RECOVERY_KEY) || 'null');return !!userId && value?.userId === userId && Number.isFinite(value.until) && value.until > Date.now(); } catch { return false; } };
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
    setText($('auth-submit'), callbackWaiting ? '확인 링크 처리 중…' : authOperation ? '요청을 보내고 있어요…' : authSeconds ? `${authSeconds}초 뒤 다시 요청` : resetLinkStep() ? '링크 확인하고 계속' : AUTH_LABELS[mode]);
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
  const bounded = async promise => { let timer;try { return await Promise.race([promise, new Promise((_, reject) => { timer = cooldownClock.setTimeout(() => reject(Object.assign(new Error('연결을 확인하는 데 시간이 걸려요. 페이지를 새로 고친 뒤 다시 시도해 주세요.'), { code: 'AUTH_TIMEOUT' })), 12000); })]); } finally { cooldownClock.clearTimeout(timer); } };
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
  const security = createPortalSecurity({ config, sdk, bounded, notice, preview, errorMessage: authErrorMessage, rateLimit: authRateLimit,
    setBusy: value => { authOperation = value;renderControls(); }, hostBusy: () => authOperation || hadCallback && !initializationFinished,
    onPasswordChanged: () => tidySessions(generation) });
  // Auth ends every other session when a password changes; the account server's list learns it here.
  async function tidySessions(token) {
    const stale = (view?.sessions?.() || []).filter(row => !row.current && !row.revoked);
    if (preview || !stale.length) return;
    try {
      const check = guarded(token), client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: 'platform', guard: check, getAccessToken: () => session?.access_token });
      for (const row of stale) { try { await client.revokeSession(row.id);check(); } catch (error) { if (error?.code === 'ACCOUNT_CHANGED') throw error; } }
      await view?.load({ preserveWorld: true });
    } catch { /* The list catches up on the next visit. */ }
  }
  // A used or expired reset link: a signed-in browser gets the card's own reset mail, anyone else the recover form.
  async function recoveryLinkFailed() {
    recoveryLink = null;feedbacks.delete('reset');
    if (session) { mode = 'login';focusSecurity = true;landingNotice = { text: `이 재설정 링크는 이미 썼거나 만료됐어요. 이 브라우저에는 ${session.user?.email || '다른'} 계정이 로그인돼 있어요 — 이 계정이면 아래 「로그인과 보안」에서 재설정 메일을 다시 받고, 다른 계정이면 로그아웃한 뒤 「비밀번호 찾기」로 새 메일을 받아 주세요.`, error: true };await enter();return; }
    setMode('recover');const text = '이 재설정 링크는 이미 썼거나 만료됐어요. 가입한 이메일을 넣으면 새 링크를 보내 드려요.';
    feedbacks.set('recover', { text, kind: 'error' });notice(text, true, true);renderControls();
  }
  // Provider discovery must not hold up email login or the SDK's PKCE callback.
  if (typeof loginSettings?.then === 'function') void Promise.resolve(loginSettings).then(
    value => { if (!closed) google.settings(preview ? { google: false, phone: false } : value); },
    () => { if (!closed) google.settings({ google: false, phone: false }); });
  const callbackWaitText = '확인 링크 처리 중… 잠시 기다려 주세요. 계속 같으면 페이지를 새로고침해 주세요.';
  const showCallbackWaiting = (reveal = false) => {
    feedbacks.set(mode, { text: callbackWaitText, kind: 'pending' });notice(callbackWaitText, false, reveal, 'pending');renderControls();
  };
  const resetCopy = () => {
    if (resetLinkStep()) return '메일에서 연 재설정 링크예요. 아래 단추를 누르면 링크를 확인하고 새 비밀번호 칸이 열려요.';
    const email = session?.user?.email;
    return `${email ? `${email} 계정의 새 비밀번호예요. ` : ''}${recoveredOver ? `이 브라우저에 로그인돼 있던 ${recoveredOver} 계정은 로그아웃했어요. ` : ''}저장하면 이 브라우저를 뺀 다른 기기와 앱에서는 로그아웃돼요.`;
  };
  const setMode = value => {
    mode = value;$('auth-heading').textContent = ({ login: '다시 만나서 반가워요.', signup: 'SYNK 계정을 만들어요.', recover: '비밀번호를 다시 정해요.', reset: '새 비밀번호를 정해 주세요.' })[mode];
    $('auth-copy').textContent = mode === 'recover' ? '가입한 이메일로 재설정 링크를 보내 드려요.' : mode === 'signup' ? '이메일과 비밀번호로 가입해요. 비밀번호는 8자 이상이에요.' : mode === 'reset' ? resetCopy() : '이메일과 비밀번호, 또는 Google 계정으로 로그인해요.';
    const linkStep = resetLinkStep(), newPassword = mode === 'reset' && !linkStep;
    $('password-label').hidden = mode === 'recover' || linkStep;$('password').required = mode !== 'recover' && !linkStep;$('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    // The label's own text node (the input sits inside the label).
    const labelText = $('password-label').firstChild;if (labelText?.nodeType === 3) labelText.textContent = newPassword ? '새 비밀번호' : '비밀번호';
    $('password-confirm-label').hidden = !newPassword;$('password-confirm').required = newPassword;if (!newPassword) $('password-confirm').value = '';
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
    $('consent').hidden = false;notice(preview ? '제품과 연결할 정보를 확인한 뒤 선택해 주세요.' : automaticAuthorizationAttempted ? '연결할 앱을 보고 「연결하기」나 「취소」를 눌러 주세요.' : '로그인한 계정으로 앱에 연결하고 있어요…');
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
    google?.showAccount(false);security?.hide();
    if ($('account-next')) $('account-next').hidden = true;
    const token = generation, entry = ++entryId;
    const check = () => { guarded(token)();if (entry !== entryId) throw Object.assign(new Error('로그인 화면이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
    // An old stored session cannot authorize a callback whose exchange is still unresolved.
    if (hadCallback && !initializationFinished) { callbackEntryPending = true;$('auth-panel').hidden = false;setMode(mode);return; }
    callbackEntryPending = false;
    if (mode === 'reset' && session && !recoveryLink && !recoveryReady) {
      if (recoveryGrace(session.user?.id)) recoveryReady = true;
      else { mode = 'login';focusSecurity = true; }
    }
    if (!session || mode === 'reset') {
      $('auth-panel').hidden = false;setMode(mode);
      if (mode !== 'reset' && landingNotice) { const { text, error } = landingNotice;landingNotice = null;notice(text + ' 이 기기에서 로그인하지 않아도 돼요.', error, true, error ? 'error' : 'success');return; }
      notice(mode !== 'reset' ? '로그인하거나, 처음이라면 회원가입해 주세요.' : resetLinkStep() ? '메일의 재설정 링크를 열었어요. 「링크 확인하고 계속」을 눌러 주세요.' : '두 칸에 같은 비밀번호를 넣고 새 비밀번호를 저장해 주세요.');
      return;
    }
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
      view = createAccountView({ client, product: 'platform', guard: check, notice, preview, logout: (note, request) => logout(note, request, check) });await view.load();check();notice(preview ? '합성 계정 화면 예시 · 실제 로그인이나 서버 연결이 아니에요.' : '로그인됐어요. 아래에서 내 계정을 관리할 수 있어요.', false, false, 'success');
      if ($('account-next')) $('account-next').hidden = preview || callbackBlocked;
      google.showAccount(!preview);
      security.show(checked.data.user, { focus: focusSecurity });focusSecurity = false;
      if (landingNotice) { const { text, error } = landingNotice;landingNotice = null;notice(text, error, true, error ? 'error' : 'success'); }
    } catch (error) {
      if (token !== generation || entry !== entryId || error.code === 'ACCOUNT_CHANGED') return;
      view?.stop();view = null;security.hide();mode = 'login';setMode(mode);$('auth-panel').hidden = false;report(error);
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
        if (!sdkSettled && current()) notice('현재 화면은 닫았지만 브라우저의 로그인 종료가 아직 끝나지 않았어요. 이 창을 닫았다가 다시 열어 로그아웃됐는지 봐 주세요.', true);
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
    else notice(({ signup: '가입할 이메일과 비밀번호를 넣어 주세요.', recover: '가입한 이메일을 넣으면 비밀번호 재설정 메일을 보내요.' })[mode] || '이메일과 비밀번호를 넣어 주세요.');
  }; });
  $('auth-form').onsubmit = async event => {
    event.preventDefault();if (closed || authOperation || remaining(mode) > 0) return;
    if (hadCallback && !initializationFinished) { showCallbackWaiting(true);return; }
    const requestMode = mode, token = ++generation, requestStartedAt = Date.now(), verifying = resetLinkStep(), previous = session?.user || null;
    authOperation = true;cooldowns.delete(requestMode);feedbacks.set(requestMode, { text: '요청을 보내고 있어요. 잠시만 기다려 주세요.', kind: 'pending' });renderControls();notice('요청을 보내고 있어요. 잠시만 기다려 주세요.', false, false, 'pending');
    try {
      let result;
      const email = $('email').value.trim(), password = $('password').value;
      const resetProblem = requestMode === 'reset' && !verifying ? passwordProblem({ next: password, confirm: $('password-confirm').value, needsCurrent: false }) : null;
      if (resetProblem) throw new Error(resetProblem);
      const callback = new URL(config.portalUrl);if (authorizationId) callback.searchParams.set('authorization_id', authorizationId);
      // The sign-up choices travel with the account (user_metadata.synk_signup): the account server starts
      // learning storage on the first sign-in only when the person ticked it here (SYNK-talk synk-auth.js).
      if (requestMode === 'signup' && !$('signup-age').checked) throw new Error('만 14세 이상만 가입할 수 있어요. 확인란을 선택해 주세요.');
      if (requestMode === 'signup') result = await sdk.auth.signUp({ email, password, options: { emailRedirectTo: callback.href,
        data: { synk_signup: { version: 'synk-signup-1', learning: $('signup-learning').checked, age14: true } } } });
      else if (requestMode === 'recover') { callback.searchParams.set('view', 'reset');result = await sdk.auth.resetPasswordForEmail(email, { redirectTo: callback.href }); }
      // This tab may have just signed this account out; its recovery link still opens it.
      else if (verifying) { signedOutSubject = null;result = await sdk.auth.verifyOtp({ type: 'recovery', token_hash: recoveryLink }); }
      else if (requestMode === 'reset') result = await sdk.auth.updateUser({ password });
      else result = await sdk.auth.signInWithPassword({ email, password });
      if (closed) return;
      if (mode !== requestMode || token !== generation && (!result.data?.session?.user?.id || result.data.session.user.id !== subject)) { await enter();return; }
      // An expired or used link ends here; a network failure keeps the link for another tap.
      if (verifying && result.error && !authRateLimit(result.error) && result.error.status >= 400 && result.error.status < 500) { await recoveryLinkFailed();return; }
      if (result.error) throw result.error;
      callbackBlocked = false;callbackError = null;google?.clearCallback();
      if (requestMode === 'signup') void signupConversion?.rememberEmail(result, requestStartedAt);
      $('password').value = '';$('password-confirm').value = '';
      if (verifying) {
        const recovered = result.data?.session?.user;
        if (result.data?.session?.access_token) { if (recovered?.id !== subject) generation++;session = result.data.session;subject = recovered?.id || null; }
        recoveryReady = true;recoveryLink = null;rememberRecovery(recovered?.id);feedbacks.delete('reset');
        recoveredOver = previous?.id && previous.id !== recovered?.id ? previous.email || '다른' : null;
        mode = 'reset';await enter();$('password').focus?.();
      }
      else if (requestMode === 'recover' || requestMode === 'signup' && !result.data?.session) {
        const text = `${requestMode === 'signup' ? '가입 확인 메일을 요청했어요.' : '비밀번호 재설정 메일을 요청했어요.'} 메일함에서 메일을 열고 안에 있는 단추를 눌러 주세요. 안 보이면 스팸함도 봐 주세요.`;
        feedbacks.set(requestMode, { text, kind: 'success' });notice(text, false, true, 'success');
      }
      else if (requestMode === 'reset') {
        mode = 'login';feedbacks.delete('reset');recoveryReady = false;recoveredOver = null;rememberRecovery(null);
        const clean = new URL(location.href);clean.searchParams.delete('view');window.history?.replaceState(window.history.state, '', clean.href);
        await enter();if (!$('account').hidden) notice('새 비밀번호를 저장했어요. 다른 기기와 앱(PC 앱·WORLD 포함)에서는 새 비밀번호로 다시 로그인해 주세요.', false, true, 'success');
        void tidySessions(generation);
      }
      else { signedOutSubject = null;session = result.data.session;generation++;subject = session?.user?.id;clearCooldowns();await enter(); }
    } catch (error) { if (token === generation && mode === requestMode) report(error, requestMode);else if (!closed) await enter(); }
    finally { authOperation = false;renderControls(); }
  };
  for (const [id, method] of [['approve', 'approveAuthorization'], ['deny', 'denyAuthorization']]) $(id).onclick = () => respondToAuthorization(method);
  window.addEventListener('pagehide', () => { closed = true;generation++;google?.stop();security.stop();view?.stop();consentOperation = null;clearCooldowns(); });
  window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });
  const showStartupError = error => {
    if (hadCallback && !initializationFinished) { showCallbackWaiting(true);return; }
    if ($('account-next')) $('account-next').hidden = true;
    const retained = !$('account').hidden;
    const text = error?.code === 'GOOGLE_CALLBACK_INCOMPLETE'
      ? authErrorMessage(error) + (retained ? ' 현재 로그인된 SYNK 계정은 유지했어요.' : '')
      : error?.code === 'AUTH_RECOVERY_CALLBACK' && retained
      ? '이 재설정 링크는 만료됐거나 다른 브라우저에서 요청한 링크예요. 아래 「로그인과 보안」에서 재설정 메일을 다시 받아 주세요.'
      : requestedView === 'security' && hadCallback
      ? '이메일 변경 확인 링크를 이 브라우저에서 마무리하지 못했어요. 두 메일의 단추를 모두 눌렀다면 변경은 이미 끝났을 수 있어요. 로그인해서 「로그인과 보안」의 이메일을 확인해 주세요.'
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
    if (changed) { generation++;subject = next;google?.reset();security.hide();view?.stop();consentOperation = null;clearCooldowns(); }session = value;
    if (event === 'PASSWORD_RECOVERY') { mode = 'reset';recoveryReady = true;rememberRecovery(next); }
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
      if (callbackError.code === 'AUTH_RECOVERY_CALLBACK' || requestedView === 'security') focusSecurity = true;
    }
    // The second e-mail-change confirmation returns here and signs this browser in with the changed address.
    else if (hadCallback && requestedView === 'security') landingNotice = { text: '이메일 변경 확인을 마쳤어요. 아래 「로그인과 보안」에서 지금 로그인 이메일을 확인해 주세요.', error: false };
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
  else if (mode === 'reset' && !session && !recoveryLink) { mode = 'recover';startupError = { code: 'AUTH_RECOVERY_REQUIRED' }; }
  initializing = false;setMode(mode);
  await enter().catch(report);
  if (startupError) showStartupError(startupError);
}
