// 「로그인과 보안」 on the SYNK ID page (synk.im/id/). The signed-in browser shows which account it is,
// changes the password after checking the current one, sends a reset mail when the current password is
// unknown or the account signs in with Google only, and starts an e-mail change. Passwords go to Supabase
// Auth only, never to the SYNK account server. The current-password check guards a browser left signed in;
// Auth itself accepts a change from any valid session (production: require_current_password off).
// Changing a password ends every other session of the account (GoTrue keeps only the one that asked), so
// the form says so before the button.
const $ = id => document.getElementById(id);
export const PASSWORD_MIN = 8;
// bcrypt, which Auth hashes passwords with, reads at most 72 bytes.
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_FIELDS = ['current-password', 'new-password', 'new-password-confirm'];
const SECURITY_MESSAGES = {
  invalid_credentials: '현재 비밀번호가 맞지 않아요. 다시 입력해 주세요.',
  same_password: '지금 비밀번호와 다른 새 비밀번호를 정해 주세요.',
  reauthentication_needed: '보안을 위해 메일로 비밀번호를 다시 정해 주세요. 아래 「재설정 메일 보내기」를 눌러 주세요.',
  email_exists: '다른 SYNK 계정이 쓰는 이메일이에요. 다른 주소를 넣어 주세요.',
  user_already_exists: '다른 SYNK 계정이 쓰는 이메일이에요. 다른 주소를 넣어 주세요.',
  email_address_invalid: '이메일 주소 형식이 맞지 않아요. 다시 입력해 주세요.',
  ACCOUNT_CHANGED: '이 브라우저의 로그인 계정이 바뀌었어요. 페이지를 새로 고친 뒤 다시 해 주세요.',
};
const fault = (code, message) => Object.assign(new Error(message || code), { code });
export function passwordProblem({ current = '', next = '', confirm = '', needsCurrent = true }) {
  if (needsCurrent && !current) return '현재 비밀번호를 넣어 주세요.';
  if (next.length < PASSWORD_MIN) return `새 비밀번호는 ${PASSWORD_MIN}자 이상으로 정해 주세요.`;
  if (new TextEncoder().encode(next).length > PASSWORD_MAX_BYTES) return '새 비밀번호가 너무 길어요. 영문 기준 72자 안으로 줄여 주세요.';
  if (next !== confirm) return '새 비밀번호 두 칸이 서로 달라요. 다시 입력해 주세요.';
  if (needsCurrent && next === current) return SECURITY_MESSAGES.same_password;
  return null;
}
export function emailProblem(next, currentEmail) {
  const value = String(next || '').trim();
  if (!value) return '새 이메일을 넣어 주세요.';
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return SECURITY_MESSAGES.email_address_invalid;
  if (currentEmail && value.toLowerCase() === currentEmail.toLowerCase()) return '지금 로그인 이메일과 같아요. 바꿀 주소를 넣어 주세요.';
  return null;
}
// Which sign-in methods the Auth user has. A Google-only account has no e-mail identity; it may still have set
// a password through a reset mail, which Auth does not mark on the user, so the form stays one tap away.
export function signInMethods(user) {
  const providers = [...new Set((Array.isArray(user?.identities) ? user.identities : []).map(row => row?.provider).filter(value => typeof value === 'string'))];
  return { email: providers.includes('email'), google: providers.includes('google'), providers };
}
export function createPortalSecurity({ config, sdk, bounded, notice, errorMessage, rateLimit, preview = false,
  setBusy = () => {}, hostBusy = () => false, onPasswordChanged = () => {}, fetcher = (...args) => globalThis.fetch(...args) }) {
  // Both forms start folded under their buttons (10-27): the card reads as three lines — e-mail, ways, password.
  let user = null, generation = 0, busy = false, formOpen = false, emailOpen = false, closed = false;
  const status = (text, kind = 'info') => { const node = $('security-status');node.textContent = text;node.setAttribute('data-kind', kind);node.className = `small security-status${kind === 'error' ? ' error' : ''}`; };
  const message = error => {
    const code = error?.code || error?.error_code;
    if (SECURITY_MESSAGES[code]) return SECURITY_MESSAGES[code];
    // An Auth reply whose code the browser could not read still says it in words.
    if (/already (?:been registered|exists)/i.test(error?.message || '')) return SECURITY_MESSAGES.email_exists;
    if (/invalid login credentials/i.test(error?.message || '')) return SECURITY_MESSAGES.invalid_credentials;
    if (/should be different from the old password/i.test(error?.message || '')) return SECURITY_MESSAGES.same_password;
    const limited = rateLimit?.(error);
    if (limited) return limited.waitSeconds ? `요청이 잠시 제한됐어요. ${limited.waitSeconds}초 뒤에 다시 눌러 주세요.` : '요청이 잠시 제한됐어요. 잠시 뒤 다시 눌러 주세요.';
    return errorMessage(error);
  };
  const current = token => () => { if (closed || token !== generation || !user) throw fault('ACCOUNT_CHANGED'); };
  const clearFields = () => { for (const id of [...PASSWORD_FIELDS, 'new-email']) $(id).value = '';for (const id of PASSWORD_FIELDS) $(id).type = 'password';$('password-visible').checked = false; };
  function lock(value) {
    busy = value;setBusy(value);
    for (const id of ['password-change-submit', 'password-mail', 'password-form-toggle', 'email-change-submit', 'email-form-toggle']) { const node = $(id);if (node) node.disabled = value; }
  }
  // Starts one operation at a time, never while the page signs in or out; returns its account check.
  function begin(pending) {
    if (closed || busy || !user || hostBusy()) return null;
    if (preview) { status('예시 화면이라 실제로 바꾸지 않아요.');return null; }
    const check = current(generation);lock(true);status(pending, 'pending');return check;
  }
  function render() {
    const section = $('account-security');
    if (!user) { section.hidden = true;return; }
    const methods = signInMethods(user);
    section.hidden = false;
    $('security-email').textContent = user.email || '이메일 없음';
    $('security-methods').textContent = [methods.email ? '이메일·비밀번호' : null, methods.google ? 'Google' : null].filter(Boolean).join(' · ') || '이메일·비밀번호';
    const pending = typeof user.new_email === 'string' && user.new_email ? user.new_email : '';
    $('security-pending-email').hidden = !pending;
    $('security-pending-email').textContent = pending ? `새 이메일 ${pending} 확인을 기다리고 있어요. 두 주소로 간 메일의 「변경 확인하기」를 모두 누르면 바뀌어요.` : '';
    // A Google-only account starts from the mail that sets a password; the current-password form stays one tap away.
    $('password-change-form').hidden = !formOpen;
    $('password-form-toggle').textContent = formOpen ? '접기' : methods.email ? '비밀번호 바꾸기' : '이미 만든 비밀번호 바꾸기';
    $('password-form-toggle').setAttribute('aria-expanded', String(formOpen));
    $('email-change-form').hidden = !emailOpen;
    $('email-form-toggle').textContent = emailOpen ? '접기' : '이메일 바꾸기';
    $('email-form-toggle').setAttribute('aria-expanded', String(emailOpen));
    $('password-mail-heading').textContent = methods.email ? '현재 비밀번호를 모르겠어요' : 'Google로 가입한 계정이에요';
    $('password-mail-copy').textContent = methods.email
      ? `${user.email || '가입한 이메일'}로 재설정 메일을 보내요.`
      : `이메일과 비밀번호로도 로그인하려면 ${user.email || '가입한 이메일'}로 메일을 받아 비밀번호를 정해 주세요.`;
    $('password-mail').textContent = methods.email ? '재설정 메일 보내기' : '비밀번호 정하는 메일 받기';
  }
  // The current password is checked with a separate, immediately ended Auth session, so this browser's own
  // session (with its PKCE and refresh state) stays untouched until the change itself. Nothing from that
  // response is kept.
  async function checkCurrent(email, password, check) {
    const base = config.supabaseUrl.replace(/\/$/, ''), headers = { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json' };
    let response, data = null;
    try { response = await bounded(fetcher(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers, body: JSON.stringify({ email, password }), credentials: 'omit', cache: 'no-store' })); }
    catch (error) { throw error?.code === 'AUTH_TIMEOUT' ? error : fault('NETWORK', 'network'); }
    try { data = await response.json(); } catch { data = null; }
    const token = typeof data?.access_token === 'string' ? data.access_token : null;
    // End the checking session whatever happens next; a failed sign-out only leaves an unused session.
    if (token) void Promise.resolve().then(() => fetcher(`${base}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}` }, credentials: 'omit', cache: 'no-store' })).catch(() => {});
    check();
    if (!response.ok) {
      const text = data?.msg || data?.error_description || data?.message || '';
      const code = data?.error_code || (typeof data?.code === 'string' ? data.code : null) || (/invalid login credentials/i.test(text) || data?.error === 'invalid_grant' ? 'invalid_credentials' : undefined);
      throw Object.assign(new Error(text || 'auth'), { code, status: response.status });
    }
    if (!token || data?.user?.id !== user.id) throw fault('ACCOUNT_CHANGED');
  }
  async function changePassword(event) {
    event?.preventDefault?.();
    const values = { current: $('current-password').value, next: $('new-password').value, confirm: $('new-password-confirm').value };
    const problem = !closed && user ? passwordProblem(values) : null;
    if (problem) { status(problem, 'error');return; }
    if (user && !user.email) { status('이 계정에는 로그인 이메일이 없어 비밀번호를 바꿀 수 없어요. hello@synk.im으로 알려 주세요.', 'error');return; }
    const check = begin('현재 비밀번호를 확인하고 있어요…');if (!check) return;
    let collapsed = false;
    try {
      await checkCurrent(user.email, values.current, check);
      status('새 비밀번호를 저장하고 있어요…', 'pending');
      const result = await bounded(sdk.auth.updateUser({ password: values.next }));check();
      if (result.error) throw result.error;
      clearFields();formOpen = false;render();collapsed = true;
      status('비밀번호를 바꿨어요. 다른 기기와 앱(PC 앱·WORLD 포함)에서는 새 비밀번호로 다시 로그인해 주세요.', 'success');
      notice('비밀번호를 바꿨어요. 이 브라우저는 로그인된 채예요.', false, false, 'success');
      onPasswordChanged();
    } catch (error) { if (!closed) status(message(error), 'error'); }
    // The submit button left with the folded form; the toggle takes focus only once unlocked (a disabled control cannot).
    finally { lock(false);if (collapsed && !closed) $('password-form-toggle').focus?.(); }
  }
  async function sendReset() {
    if (user && !user.email) { status('이 계정에는 로그인 이메일이 없어 메일을 보낼 수 없어요. hello@synk.im으로 알려 주세요.', 'error');return; }
    const check = begin('메일을 보내고 있어요…');if (!check) return;
    const callback = new URL(config.portalUrl);callback.search = '';callback.hash = '';callback.searchParams.set('view', 'reset');
    try {
      const result = await bounded(sdk.auth.resetPasswordForEmail(user.email, { redirectTo: callback.href }));check();
      if (result.error) throw result.error;
      status(`${user.email}로 메일을 보냈어요. 메일의 「새 비밀번호 정하기」 단추를 누르면 새 비밀번호를 정할 수 있어요. 안 보이면 스팸함도 봐 주세요.`, 'success');
    } catch (error) { if (!closed) status(message(error), 'error'); }
    finally { lock(false); }
  }
  async function changeEmail(event) {
    event?.preventDefault?.();
    const next = $('new-email').value.trim(), problem = !closed && user ? emailProblem(next, user.email) : null;
    if (problem) { status(problem, 'error');return; }
    const check = begin('확인 메일을 보내고 있어요…');if (!check) return;
    const callback = new URL(config.portalUrl);callback.search = '';callback.hash = '';callback.searchParams.set('view', 'security');
    let collapsed = false;
    try {
      const result = await bounded(sdk.auth.updateUser({ email: next }, { emailRedirectTo: callback.href }));check();
      if (result.error) throw result.error;
      if (result.data?.user?.id === user.id) user = result.data.user;
      $('new-email').value = '';emailOpen = false;render();collapsed = true;
      // The mails' token-hash links open on any device (10-23), each with one more tap on the page.
      status(`${user.email}, ${next} 두 주소로 확인 메일을 보냈어요. 두 메일의 「변경 확인하기」를 모두 눌러야 바뀌어요. 메일은 어느 기기에서 열어도 되고, 열린 화면에서 「이메일 변경 확인하기」를 눌러 주세요.`, 'success');
    } catch (error) { if (!closed) status(message(error), 'error'); }
    finally { lock(false);if (collapsed && !closed) $('email-form-toggle').focus?.(); }
  }
  $('password-change-form').onsubmit = event => { void changePassword(event); };
  $('email-change-form').onsubmit = event => { void changeEmail(event); };
  $('password-mail').onclick = () => { void sendReset(); };
  $('password-form-toggle').onclick = () => { formOpen = !formOpen;if (!formOpen) for (const id of PASSWORD_FIELDS) $(id).value = '';render();if (formOpen) $('current-password').focus?.(); };
  $('email-form-toggle').onclick = () => { emailOpen = !emailOpen;if (!emailOpen) $('new-email').value = '';render();if (emailOpen) $('new-email').focus?.(); };
  $('password-visible').onchange = () => { for (const id of PASSWORD_FIELDS) $(id).type = $('password-visible').checked ? 'text' : 'password'; };
  return Object.freeze({
    // `value` is the Auth user this page verified (sdk.auth.getUser), never one read from storage alone. `section`
    // (password · email · google, from ?view=security&focus=…, e.g. the PC app's buttons) opens that line.
    show(value, { focus = false, section = null } = {}) {
      if (closed) return;
      if (user?.id !== value?.id) { generation++;formOpen = false;emailOpen = false;status('');clearFields(); }
      user = value?.id ? value : null;
      if (focus && user && section === 'password') formOpen = true;
      if (focus && user && section === 'email') emailOpen = true;
      render();
      if (focus && user) {
        $('account-security').scrollIntoView?.({ block: 'start' });
        const target = section === 'password' ? $('current-password') : section === 'email' ? $('new-email') : section === 'google' && !$('google-link')?.hidden ? $('google-link') : null;
        (target || $('account-security-heading')).focus?.({ preventScroll: true });
      }
    },
    hide() { generation++;user = null;formOpen = false;emailOpen = false;status('');clearFields();render(); },
    // The page is going away: forget the account without touching the document.
    stop() { closed = true;generation++;user = null; },
  });
}
