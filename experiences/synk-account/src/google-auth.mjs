// Google authenticates the person; SYNK owns registration and its stable account.
// OAuth tokens/OTP/profile fields are never copied to the pending-flow storage.
export const COUNTRY_CODES = Object.freeze(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));
const FLOW_KEY = 'synk.google.pending.v1', MAX_AGE = 600000;
const fault = (code, message) => Object.assign(new Error(message), { code });
export function normalizePhone(value) {
  const phone = String(value || '').trim().replace(/[ ()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw fault('PHONE_INVALID', '국가번호를 포함해 입력해 주세요. 예: +821012345678');
  return phone;
}
export function registrationFields(value) {
  if (!COUNTRY_CODES.includes(value.country)) throw fault('COUNTRY_REQUIRED', '국가를 선택해 주세요.');
  const age = typeof value.age === 'string' && /^\d{1,3}$/.test(value.age) ? Number(value.age) : value.age;
  if (!Number.isInteger(age) || age < 14 || age > 120) throw fault('AGE_INVALID', '만 나이를 14세 이상 120세 이하로 입력해 주세요.');
  if (!['female', 'male', 'other', 'unspecified'].includes(value.gender)) throw fault('GENDER_REQUIRED', '성별을 선택해 주세요. 응답하지 않음도 선택할 수 있어요.');
  const genderText = value.gender === 'other' ? String(value.genderText || '').trim() : '';
  if (value.gender === 'other' && (!genderText || genderText.length > 60 || /[\u0000-\u001f\u007f]/.test(genderText))) throw fault('GENDER_INVALID', '직접 입력하는 성별은 60자 이내로 적어 주세요.');
  if (value.privacyAccepted !== true) throw fault('PRIVACY_REQUIRED', '가입 정보의 수집·이용 안내를 확인해 주세요.');
  return { action: 'complete-google-registration', country: value.country, age, gender: value.gender, genderText,
    privacyAccepted: true, privacyVersion: 'google-registration-1', learning: value.learning === true };
}
export function beginGoogleFlow({ config, storage, authorizationId = null, subject = null, action = 'login', now = Date.now(), nonce = crypto.randomUUID() }) {
  if (!['login', 'link'].includes(action) || !/^[a-zA-Z0-9_-]{20,100}$/.test(nonce) || action === 'link' && !subject) throw fault('GOOGLE_FLOW_INVALID', 'Google 연결 요청을 확인하지 못했어요.');
  const callback = new URL(config.portalUrl);
  if (callback.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(callback.hostname) || callback.username || callback.password) throw fault('GOOGLE_FLOW_INVALID', '로그인 복귀 주소를 확인해 주세요.');
  callback.search = '';callback.hash = '';
  if (authorizationId) callback.searchParams.set('authorization_id', authorizationId);
  callback.searchParams.set('google_flow', nonce);
  const pending = { version: 1, action, nonce, createdAt: now, authorizationId, subject: action === 'link' ? subject : null };
  try { storage.setItem(FLOW_KEY, JSON.stringify(pending));if (storage.getItem(FLOW_KEY) !== JSON.stringify(pending)) throw new Error('storage'); }
  catch { throw fault('GOOGLE_STORAGE_UNAVAILABLE', '이 브라우저에 로그인 요청을 보관할 수 없어요. 브라우저의 저장 설정을 확인해 주세요.'); }
  return { pending, redirectTo: callback.href };
}
export function consumeGoogleFlow({ storage, url, now = Date.now() }) {
  const parsed = new URL(url), nonce = parsed.searchParams.get('google_flow');
  if (!nonce) return null;
  let value;
  try { const raw = storage.getItem(FLOW_KEY);value = JSON.parse(raw);storage.removeItem(FLOW_KEY); }
  catch { throw fault('GOOGLE_FLOW_INVALID', 'Google 로그인 요청을 복원하지 못했어요. 다시 시작해 주세요.'); }
  if (!value || value.version !== 1 || value.nonce !== nonce || parsed.searchParams.getAll('google_flow').length !== 1
    || !['login', 'link'].includes(value.action) || !Number.isSafeInteger(value.createdAt) || now < value.createdAt || now - value.createdAt > MAX_AGE
    || (parsed.searchParams.get('authorization_id') || null) !== value.authorizationId || value.action === 'link' && typeof value.subject !== 'string')
    throw fault('GOOGLE_FLOW_INVALID', 'Google 로그인 요청이 만료되었거나 달라졌어요. 다시 시작해 주세요.');
  return value;
}
export function verifiedGoogleUser(user, flow = null) {
  if (!user?.id || !user.identities?.some(identity => identity.provider === 'google')) throw fault('GOOGLE_IDENTITY_REQUIRED', 'Google 계정 연결을 확인하지 못했어요.');
  if (flow?.action === 'link' && flow.subject !== user.id) throw fault('GOOGLE_ACCOUNT_CHANGED', 'Google을 연결하던 SYNK 계정이 바뀌었어요. 원래 계정에서 다시 연결해 주세요.');
  return user;
}
export function googleDestination(value, config) {
  const url = new URL(value), origin = new URL(config.supabaseUrl).origin;
  if (url.protocol !== 'https:' || url.username || url.password || url.hash
    || !(url.origin === origin && ['/auth/v1/authorize', '/auth/v1/user/identities/authorize'].includes(url.pathname)
      || url.origin === 'https://accounts.google.com' && ['/o/oauth2/v2/auth', '/o/oauth2/auth'].includes(url.pathname)))
    throw fault('GOOGLE_REDIRECT_INVALID', 'Google 로그인 도착 주소를 확인하지 못했어요.');
  return url.href;
}
export async function publicLoginSettings(config, fetcher = fetch) {
  try {
    const response = await fetcher(new URL('/auth/v1/settings', config.supabaseUrl), { headers: { apikey: config.supabasePublishableKey }, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { google: false, phone: false };
    // Google availability is independent of standalone phone login. The account
    // server decides whether registration currently requires phone verification.
    const data = await response.json();return { google: data.external?.google === true, phone: data.external?.google === true };
  } catch { return { google: false, phone: false }; }
}
export function createGoogleAccess({ config, sdk, enabled = false, phoneEnabled = false, storage, getSession, generation, setBusy, hostBusy = () => false,
  notice, bounded = promise => promise, continuePortal, endSession, onRegistrationCompleted = () => {}, registrationHeaders = () => ({}), authorizationId = null, fetcher = fetch, now = () => Date.now(), initialUrl = location.href }) {
  const node = id => document.getElementById(id), button = node('google-login'), link = node('google-link'), section = node('google-onboarding');
  let closed = false, busy = false, operationSequence = 0, user = null, required = false, phoneRequired = true, accountVisible = false, confirmedPhone = null, sentPhone = null, sendAfter = 0, flow = null, flowError = null, checkedSubject = null;
  try { flow = consumeGoogleFlow({ storage, url: initialUrl, now: now() }); } catch (error) { flowError = error; }
  const check = (token, subject) => { if (closed || generation() !== token || getSession()?.user?.id !== subject) throw fault('ACCOUNT_CHANGED', '로그인 상태가 바뀌었어요.'); };
  const errorMessage = error => ({ ONBOARDING_REQUIRED: phoneRequired ? '휴대폰 인증과 가입 정보를 먼저 완료해 주세요.' : '가입 정보를 먼저 완료해 주세요.', PHONE_UNVERIFIED: '휴대폰 번호를 먼저 인증해 주세요.', PHONE_VERIFICATION_REQUIRED: '서버에서 휴대폰 인증을 확인하지 못했어요. 번호를 다시 인증해 주세요.', INVALID_REGISTRATION: '국가·나이·성별과 개인정보 안내 확인을 다시 확인해 주세요.', GOOGLE_FLOW_INVALID: error?.message,
    phone_exists: '다른 계정에서 사용하는 휴대폰 번호예요. 사용하던 SYNK 계정으로 로그인하거나 계정 지원에 문의해 주세요.', over_sms_send_rate_limit: '인증번호 요청이 잠시 제한됐어요. 잠시 뒤 직접 다시 요청해 주세요.', otp_expired: '인증번호가 만료되었거나 맞지 않아요. 확인한 뒤 다시 입력해 주세요.', manual_linking_disabled: 'Google 계정 연결 설정을 준비하고 있어요.', REGISTRATION_CONFLICT: '이미 가입을 마친 계정이에요. 계정을 다시 확인해 주세요.' }[error?.code] || (/[가-힣]/.test(error?.message || '') ? error.message : '요청을 완료하지 못했어요. 입력 내용과 연결 상태를 확인해 주세요.'));
  const text = (id, value) => { const target = node(id);if (target && target.textContent !== value) target.textContent = value; };
  const confirmedNumber = owner => {
    // Auth/server time is authoritative; a slow device clock must not require a paid re-send.
    if (!owner?.phone_confirmed_at || !Number.isFinite(Date.parse(owner.phone_confirmed_at)) || owner.new_phone) return null;
    try { return normalizePhone('+' + String(owner.phone || '').replace(/^\+/, '')); } catch { return null; }
  };
  function render() {
    if (button) { button.disabled = !enabled || busy || hostBusy();text('google-login-label', busy ? 'Google 연결을 확인하고 있어요…' : 'Google로 계속하기'); }
    text('google-availability', enabled ? '처음이라면 Google 계정으로 가입할 수 있어요.' : 'Google 로그인·가입을 준비하고 있어요. 이메일 로그인은 계속 사용할 수 있어요.');
    if (node('google-linking')) node('google-linking').hidden = !enabled || !accountVisible || required;
    if (link) link.disabled = !enabled || busy || hostBusy() || !user;
    for (const id of ['google-phone-send', 'google-phone-verify']) if (node(id)) node(id).disabled = busy || hostBusy() || !phoneRequired || !phoneEnabled;
    if (node('google-complete')) node('google-complete').disabled = busy || hostBusy() || phoneRequired && !phoneEnabled;
    if (node('google-cancel')) node('google-cancel').disabled = busy || hostBusy();
    for (const id of ['google-country', 'google-age', 'google-gender', 'google-privacy', 'google-learning']) if (node(id)) node(id).disabled = busy;
    if (node('google-phone-fields')) { node('google-phone-fields').hidden = !phoneRequired;node('google-phone-fields').disabled = !phoneRequired; }
    if (node('google-phone')) { node('google-phone').disabled = busy || !phoneRequired;node('google-phone').required = phoneRequired; }
    const otherGender = node('google-gender')?.value === 'other';
    if (node('google-gender-text-label')) node('google-gender-text-label').hidden = !otherGender;
    if (node('google-gender-text')) { node('google-gender-text').required = otherGender;node('google-gender-text').disabled = busy || !otherGender; }
    if (node('google-phone-code')) { node('google-phone-code').required = false;node('google-phone-code').disabled = busy || !phoneRequired || !!confirmedPhone; }
    text('google-onboarding-copy', phoneRequired ? '휴대폰을 인증하고 기본 정보를 입력해 주세요. 아이디와 비밀번호는 따로 만들지 않아요.' : '기본 정보를 입력하면 Google 계정으로 SYNK를 시작할 수 있어요. 아이디와 비밀번호는 따로 만들지 않아요.');
    text('google-privacy-fields', phoneRequired ? '휴대폰 번호·국가·나이·성별' : '국가·나이·성별');
    text('google-privacy-action-note', phoneRequired ? '번호를 보내기 전에' : '가입을 완료하기 전에');
    if (node('google-cancel-phone-note')) node('google-cancel-phone-note').hidden = !phoneRequired;
    text('google-phone-status', !phoneEnabled ? '문자 인증 서비스 연결을 준비하고 있어요.' : confirmedPhone ? '휴대폰 번호 인증을 확인했어요.' : sentPhone ? '문자로 받은 인증번호를 입력해 주세요.' : '국가번호를 포함한 휴대폰 번호로 인증번호를 보내 주세요.');
    text('google-link-status', user?.identities?.some(identity => identity.provider === 'google') ? '이 SYNK 계정에 Google이 연결되어 있어요.' : '사용하던 SYNK 계정에 Google 로그인을 추가해요. 기존 기록은 유지돼요.');
    if (link) link.hidden = !!user?.identities?.some(identity => identity.provider === 'google');
  }
  const countries = node('google-country');
  if (countries) {
    const names = new Intl.DisplayNames(['ko'], { type: 'region' });
    for (const code of [...COUNTRY_CODES].sort((a, b) => names.of(a).localeCompare(names.of(b), 'ko'))) { const option = document.createElement('option');option.value = code;option.textContent = names.of(code);countries.append(option); }
  }
  if (node('google-gender')) node('google-gender').onchange = () => { if (node('google-gender').value !== 'other' && node('google-gender-text')) node('google-gender-text').value = '';render(); };
  async function request(body = null) {
    const active = getSession(), token = generation(), subject = active?.user?.id;
    if (!active?.access_token || !subject) throw fault('AUTH_REQUIRED', '먼저 로그인해 주세요.');
    const url = new URL('/functions/v1/synk-account', config.accountApiUrl || config.supabaseUrl);if (!body) url.searchParams.set('view', 'registration');
    let attribution={};try { if(body?.action==='complete-google-registration')attribution=registrationHeaders(); } catch {}
    const response = await bounded(fetcher(url, { method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', headers: { ...attribution, apikey: config.supabasePublishableKey, Authorization: `Bearer ${active.access_token}`, 'x-synk-contract': '1', 'x-synk-product': 'platform', 'x-synk-app-version': '0.2.0', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));check(token, subject);
    const value = await bounded(response.json());check(token, subject);
    if (!response.ok || value?.ok !== true) throw fault(value?.error?.code || 'REGISTRATION_UNAVAILABLE', '가입 정보를 확인하지 못했어요. 연결 후 다시 시도해 주세요.');
    return value;
  }
  async function action(operation) {
    if (closed || busy || hostBusy()) return;const sequence = ++operationSequence;busy = true;setBusy(true);render();
    try { await operation(); } catch (error) { if (error?.code !== 'ACCOUNT_CHANGED' && !closed && sequence === operationSequence) notice(errorMessage(error), true, true); }
    finally { if (!closed && sequence === operationSequence) { busy = false;setBusy(false);render(); } }
  }
  async function start(actionName) {
    if (!enabled) return;
    const current = getSession(), token = generation(), subject = current?.user?.id || null;
    const { redirectTo } = beginGoogleFlow({ config, storage, authorizationId, subject, action: actionName, now: now() });
    const options = { redirectTo, skipBrowserRedirect: true, scopes: 'openid email profile', queryParams: { prompt: 'select_account' } };
    const result = await bounded(actionName === 'link' ? sdk.auth.linkIdentity({ provider: 'google', options }) : sdk.auth.signInWithOAuth({ provider: 'google', options }));
    if (closed || token !== generation() || actionName === 'link' && getSession()?.user?.id !== subject) return;
    if (result.error) throw result.error;
    location.assign(googleDestination(result.data?.url, config));
  }
  if (button) button.onclick = () => action(() => start('login'));
  if (link) link.onclick = () => action(() => start('link'));
  if (node('google-phone')) node('google-phone').oninput = () => {
    let phone;try { phone = normalizePhone(node('google-phone').value); } catch { phone = null; }
    if (phone !== confirmedPhone) confirmedPhone = phone && phone === confirmedNumber(user) ? phone : null;
    // Verification already compares the entered number with the last sent number.
    // Keep that number while editing so restoring it never forces another paid SMS.
    render();
  };
  if (node('google-phone-send')) node('google-phone-send').onclick = () => action(async () => {
    if (!required || !phoneRequired || !phoneEnabled) return;
    const phone = normalizePhone(node('google-phone').value), token = generation(), subject = user.id;
    if (!node('google-privacy').checked) throw fault('PRIVACY_REQUIRED', '번호를 보내기 전에 개인정보 수집·이용 안내를 확인해 주세요.');
    if (phone === confirmedPhone || phone === confirmedNumber(user)) { confirmedPhone = phone;node('google-phone').value = phone;notice('이미 인증한 휴대폰 번호예요. 가입 정보를 입력해 주세요.');return; }
    if (now() < sendAfter) throw fault('PHONE_WAIT', '인증번호를 이미 요청했어요. 1분 뒤 직접 다시 요청해 주세요.');
    const result = await bounded(sdk.auth.updateUser({ phone }));check(token, subject);if (result.error) throw result.error;
    const owner = result.data?.user;
    if (owner?.id === subject) user = verifiedGoogleUser(owner, flow);
    if (owner?.id === subject && confirmedNumber(owner) === phone) { confirmedPhone = phone;node('google-phone').value = phone;notice('이미 인증한 휴대폰 번호예요. 가입 정보를 입력해 주세요.');return; }
    if (owner?.id === subject && owner.new_phone && '+' + String(owner.phone || '').replace(/^\+/, '') === phone)
      throw fault('PHONE_CHANGE_PENDING', '다른 번호의 인증이 진행 중이에요. 인증번호를 요청했던 번호로 확인하거나 계정 지원에 문의해 주세요.');
    node('google-phone').value = phone;sentPhone = phone;confirmedPhone = null;sendAfter = now() + 60000;notice('인증번호를 요청했어요. 문자를 확인한 뒤 입력해 주세요.');
  });
  if (node('google-phone-verify')) node('google-phone-verify').onclick = () => action(async () => {
    if (!required || !phoneRequired || !phoneEnabled) return;
    const phone = normalizePhone(node('google-phone').value), code = node('google-phone-code').value.trim(), token = generation(), subject = user.id;
    if (phone !== sentPhone || !/^\d{6}$/.test(code)) throw fault('PHONE_CODE_REQUIRED', '인증번호를 요청한 번호와 문자로 받은 6자리 번호를 확인해 주세요.');
    try {
      const result = await bounded(sdk.auth.verifyOtp({ phone, token: code, type: 'phone_change' }));check(token, subject);if (result.error) throw result.error;
      const verified = await bounded(sdk.auth.getUser());check(token, subject);if (verified.error) throw verified.error;
      const owner = verifiedGoogleUser(verified.data?.user, flow);
      if (owner.id !== subject || confirmedNumber(owner) !== phone) throw fault('PHONE_UNVERIFIED', '휴대폰 인증 결과를 확인하지 못했어요. 다시 확인해 주세요.');
      user = owner;confirmedPhone = phone;notice('휴대폰 번호 인증을 확인했어요. 가입 정보를 입력해 주세요.');
    } finally { if (!closed && token === generation() && getSession()?.user?.id === subject) node('google-phone-code').value = ''; }
  });
  if (node('google-onboarding-form')) node('google-onboarding-form').onsubmit = event => { event.preventDefault();return action(async () => {
    if (!required) return;
    if (phoneRequired && (!phoneEnabled || !confirmedPhone || normalizePhone(node('google-phone').value) !== confirmedPhone)) throw fault('PHONE_UNVERIFIED', '휴대폰 번호를 먼저 인증해 주세요.');
    const body = registrationFields({ country: node('google-country').value, age: node('google-age').value, gender: node('google-gender').value, genderText: node('google-gender-text').value, privacyAccepted: node('google-privacy').checked, learning: node('google-learning').checked });
    const token = generation(), subject = user.id;const completed = await request(body);check(token, subject);
    // A successful account-server completion is observed separately; tracking never delays or fails signup.
    void Promise.resolve().then(() => onRegistrationCompleted(completed)).catch(() => {});
    required = false;section.hidden = true;notice('SYNK 가입을 마쳤어요. 내 계정으로 연결하고 있어요…');await continuePortal();
  }); };
  if (node('google-cancel')) node('google-cancel').onclick = () => action(async () => { required = false;section.hidden = true;confirmedPhone = sentPhone = null;await endSession(); });
  render();
  return {
    async check(verified, guard) {
      guard();user = verified;render();
      if (flowError) throw flowError;
      if (flow && checkedSubject !== verified.id) { verifiedGoogleUser(verified, flow);checkedSubject = verified.id;flow = null; }
      if (!verified.identities?.some(identity => identity.provider === 'google')) { required = false;if (section) section.hidden = true;return true; }
      const result = await request();guard();
      if (typeof result.registration?.required !== 'boolean') throw fault('REGISTRATION_UNAVAILABLE', '가입 연결을 확인하지 못했어요. 다시 시도해 주세요.');
      required = result.registration.required;
      // Only an explicit policy from the authenticated server may defer SMS.
      // Missing/malformed policy remains strict for older servers and callers.
      phoneRequired = result.registration.phoneVerificationRequired !== false;
      // Auth confirms the same account on reload, so do not charge for another OTP.
      if (required && phoneRequired && confirmedNumber(verified)) { confirmedPhone = confirmedNumber(verified);node('google-phone').value = confirmedPhone; }
      if (section) section.hidden = !required;
      if (required) { if (node('google-linking')) node('google-linking').hidden = true;notice(phoneRequired ? 'Google 계정을 확인했어요. 휴대폰 인증과 가입 정보를 완료해 주세요.' : 'Google 계정을 확인했어요. 기본 가입 정보를 입력해 주세요.');render();return false; }
      return true;
    },
    showAccount(show) { accountVisible = show;render(); },
    refreshControls: render,
    settings(value) { enabled = value?.google === true;phoneEnabled = value?.phone === true;render(); },
    clearCallback() { flow = null;flowError = null; },
    reset() { operationSequence++;if (busy) { busy = false;setBusy(false); }required = false;phoneRequired = true;accountVisible = false;user = null;confirmedPhone = sentPhone = null;sendAfter = 0;if (section) section.hidden = true;if (node('google-linking')) node('google-linking').hidden = true;
      for (const id of ['google-phone', 'google-phone-code', 'google-age', 'google-gender-text']) if (node(id)) node(id).value = '';
      for (const id of ['google-country', 'google-gender']) if (node(id)) node(id).value = '';
      for (const id of ['google-privacy', 'google-learning']) if (node(id)) node(id).checked = false;
      if (node('google-gender-text-label')) node('google-gender-text-label').hidden = true;render(); },
    authMode(mode) { if (node('google-signin')) node('google-signin').hidden = !['login', 'signup'].includes(mode);if (node('email-divider')) node('email-divider').hidden = !['login', 'signup'].includes(mode); },
    stop() { closed = true;operationSequence++;user = null;confirmedPhone = sentPhone = null;for (const id of ['google-phone-code', 'google-phone', 'google-gender-text']) if (node(id)) node(id).value = ''; },
  };
}
