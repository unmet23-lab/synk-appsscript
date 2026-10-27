// 「내 계정」: the member's own SYNK ID inside the platform app. Name, sign-in methods, where the account is
// signed in, the learning-record link, the records download and account deletion happen here; password and
// login e-mail change open the browser's SYNK ID (「로그인과 보안」, synk.im/id/?view=security), because this
// app never takes a password. Reads use `accountView` (not `load`, which empties the verified library while it
// runs) and `accountIdentity` (Auth's own e-mail and providers; the account server never returns e-mail).
// Everything is bound to the signed-in SYNK ID and session generation: another account or a sign-out drops
// what was shown and any reply still on its way.
const PRODUCT_NAMES = Object.freeze({ platform: 'SYNK 플랫폼', world: 'SYNK WORLD', messenger: 'SYNK Workspace' });
const ROLE_NAMES = Object.freeze({ student: '학생', teacher: '강사', director: '원장', reviewer: '검수 담당' });
const PROVIDER_NAMES = Object.freeze({ email: '이메일·비밀번호', google: 'Google' });
export const NAME_MAX = 60;
const SESSIONS_SHOWN = 6;
const SECURITY_HINT_MS = 30 * 60000;
const MESSAGES = Object.freeze({
  PROFILE_CONFLICT: '다른 곳에서 먼저 이름을 바꿨어요. 지금 이름을 확인한 뒤 다시 저장해 주세요.',
  REVISION_CONFLICT: '다른 곳에서 학습 기록 연결을 먼저 바꿨어요. 지금 상태를 확인한 뒤 다시 해 주세요.',
  LEARNING_DISABLED: '지금은 학습 기록 연결을 켤 수 없어요.',
  FEATURE_DISABLED: '지금은 학습 기록 연결을 켤 수 없어요.',
  ACCOUNT_UNAVAILABLE: '지금 이 계정 상태에서는 할 수 없어요.',
  DELETION_NOT_CANCELLABLE: '이미 처리하기 시작해 삭제 요청을 취소할 수 없어요. hello@synk.im으로 알려 주세요.',
  REQUEST_NOT_FOUND: '취소할 삭제 요청을 찾지 못했어요. 화면을 새로 불러왔어요.',
  SESSION_NOT_FOUND: '이미 끝난 로그인이에요. 목록을 새로 불러왔어요.',
  AUTH_REQUIRED: 'SYNK ID로 다시 로그인해 주세요.',
  AUTH_CHANGED: '로그인 상태가 바뀌었어요. 다시 해 주세요.',
  SUITE_UNAVAILABLE: '로그인 기록을 읽지 못했어요. 플랫폼을 다시 시작한 뒤 해 주세요.',
});
const failure = (code, message) => Object.assign(new Error(message || code), { code });
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const instant = value => { const time = typeof value === 'string' ? Date.parse(value) : NaN;return Number.isFinite(time) ? new Date(time) : null; };
const dayText = value => { const date = instant(value);return date ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date) : ''; };
const momentText = value => { const date = instant(value);return date ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) : ''; };
const errorText = error => MESSAGES[error?.code] || (error?.retryable || ['NETWORK', 'SERVICE_UNAVAILABLE', 'AUTH_SERVER_UNAVAILABLE'].includes(error?.code) ? '계정 서버에 닿지 못했어요. 인터넷 연결을 확인한 뒤 다시 해 주세요.' : '처리하지 못했어요. 잠시 뒤 다시 해 주세요.');

export function nameProblem(value) {
  const name = String(value ?? '').trim();
  if (!name) return '이름을 넣어 주세요.';
  // The account server counts UTF-16 units, this app's bridge code points; both stay within 60.
  if (name.length > NAME_MAX || [...name].length > NAME_MAX) return `이름은 ${NAME_MAX}자 안으로 적어 주세요.`;
  if (/[\u0000-\u001f\u007f]/.test(name)) return '이름에 쓸 수 없는 글자가 들어 있어요.';
  return null;
}
// The server replaces the whole profile, so the saved language and time zone travel with a new name.
export function profileChange(account, name) {
  const profile = account?.profile || {}, next = { display_name: String(name).trim() };
  for (const key of ['locale', 'time_zone']) if (typeof profile[key] === 'string' && profile[key]) next[key] = profile[key];
  if (!Number.isSafeInteger(account?.profile_revision)) throw failure('PROFILE_REVISION_MISSING', '이 계정 서버 판에서는 여기서 이름을 바꿀 수 없어요.');
  return { profile: next, expected_profile_revision: account.profile_revision };
}
export function pendingDeletion(data) {
  if (data?.account?.status !== 'deletion-requested') return null;
  return (data.dataRequests || []).find(row => row?.kind === 'delete' && row.status === 'pending') || null;
}
export function membershipLines(data) {
  return (data?.memberships || []).map(row => `${ROLE_NAMES[row?.role] || (row?.kind === 'staff' ? '교직원' : '회원')}${row?.student_code ? ` · ${row.student_code}` : ''}`);
}
export function sessionRows(data) {
  return (data?.sessions || []).filter(row => row && !row.revoked && typeof row.id === 'string')
    .sort((a, b) => (b.current === true) - (a.current === true) || (Date.parse(b.last_seen) || 0) - (Date.parse(a.last_seen) || 0))
    .map(row => ({ id: row.id, current: row.current === true, name: PRODUCT_NAMES[row.product] || 'SYNK 앱', label: typeof row.label === 'string' ? row.label.slice(0, 80) : '', seen: momentText(row.last_seen) }));
}
export function signInMethods(identity) {
  const providers = [...new Set((identity?.identities || []).map(row => row?.provider).filter(Boolean))];
  return { providers, email: providers.includes('email'), google: providers.includes('google'), names: providers.map(id => PROVIDER_NAMES[id] || id) };
}

// Pure view of one state; the controller below owns requests and events.
export function renderAccountPage(state) {
  const { signedIn, native, auth = {}, data, identity, loadError, identityError, loading, message, editingName, nameDraft = '', busy = new Set(), allSessions, workspace, securityHint } = state;
  const head = `<div class="section-title ap-title"><div><button class="text-link ap-back" type="button" data-account-action="back"><svg class="i" aria-hidden="true"><use href="#i-arrow-left"/></svg>설정</button><span class="label">MY SYNK ID</span><h1 id="account-page-title" tabindex="-1">내 계정</h1><p>SYNK ID 하나로 쓰는 모든 SYNK 앱의 회원정보예요.</p></div>${signedIn ? '<button class="ghost-button" type="button" data-account-action="sign-out">로그아웃</button>' : ''}</div>`;
  if (!native) return `${head}<div class="quiet-note"><strong>PC 앱에서 볼 수 있어요</strong><p>회원정보는 SYNK Platform PC 앱이나 synk.im/id에서 보고 바꿔요.</p></div>`;
  if (!signedIn) return `${head}<div class="quiet-note"><strong>로그인하면 회원정보를 볼 수 있어요</strong><p>${securityHint ? '비밀번호를 바꿨다면 새 비밀번호로 다시 로그인해 주세요. ' : ''}이름, 로그인 방법, 로그인한 곳, 계정 지우기를 여기서 해요.</p><button class="solid-button" type="button" data-account-action="sign-in">로그인</button></div>`;
  const account = data?.account, name = account?.profile?.display_name || auth.account?.display_name || 'SYNK 회원', deletion = pendingDeletion(data), deleting = account?.status === 'deletion-requested';
  const email = identity?.email || '', methods = signInMethods(identity), sessions = sessionRows(data), shown = allSessions ? sessions : sessions.slice(0, SESSIONS_SHOWN);
  const due = deletion ? momentText(deletion.due_at) : '', disabled = key => busy.has(key) || loading ? ' disabled' : '';
  const status = deleting ? `<span class="ap-status" data-tone="alert"><span class="led" aria-hidden="true"></span>${deletion ? `삭제 요청됨 · ${esc(due || '7일 안에')}${due ? '까지' : ''} 취소할 수 있어요` : '삭제를 처리하고 있어요'}</span>`
    : account ? '<span class="ap-status" data-tone="ok"><span class="led" aria-hidden="true"></span>사용 중</span>' : '';
  const hero = `<section class="ap-hero" aria-label="계정 요약"><span class="ap-avatar" aria-hidden="true">${esc([...name][0] || 'S')}</span><div class="ap-hero-copy"><strong class="ap-name">${esc(name)}</strong><span class="ap-email">${email ? esc(email) : identityError ? '로그인 이메일을 불러오지 못했어요' : '로그인 이메일을 불러오는 중'}</span>${status}</div></section>`;
  const note = message?.text ? `<p class="ap-message${message.tone === 'error' ? ' is-error' : ''}">${esc(message.text)}</p>` : '';
  const failed = loadError ? `<div class="quiet-note ap-failed"><strong>계정 정보를 불러오지 못했어요</strong><p>${esc(loadError)}</p><button class="ghost-button" type="button" data-account-action="retry"${disabled('load')}>다시 불러오기</button></div>` : '';
  const section = (number, english, title) => `<div class="ap-section-head"><span class="label">${number} / ${english}</span><h2>${title}</h2></div>`;
  const nameRow = editingName
    ? `<form class="ap-name-form" data-account-form="name"><input id="account-name-input" name="name" aria-label="새 이름" value="${esc(nameDraft)}" maxlength="60" autocomplete="nickname" required><button class="solid-button" type="submit"${disabled('name')}>${busy.has('name') ? '저장 중…' : '저장'}</button><button class="ghost-button" type="button" data-account-action="name-cancel"${disabled('name')}>취소</button></form>`
    : `<div class="ap-actions"><strong class="ap-value">${esc(name)}</strong><button class="ghost-button" type="button" aria-label="이름 바꾸기" data-account-action="name-edit"${account && !deleting ? '' : ' disabled'}>바꾸기</button></div>`;
  const memberships = membershipLines(data);
  const profile = `${section('01', 'PROFILE', '프로필')}<div class="settings-group">`
    + `<div class="setting-row"><div><h3>이름</h3><p>WORLD·Workspace 같은 SYNK 앱에서 보이는 이름이에요.</p></div>${nameRow}</div>`
    + `<div class="setting-row"><div><h3>로그인 이메일</h3><p>로그인과 SYNK ID 메일을 받는 주소예요.${identity?.newEmail ? ` 새 이메일 ${esc(identity.newEmail)} 확인을 기다리고 있어요.` : ''}</p></div><div class="ap-actions"><strong class="ap-value">${esc(email || (identityError ? '불러오지 못함' : '불러오는 중'))}</strong><button class="ghost-button" type="button" aria-label="로그인 이메일 바꾸기, 브라우저에서 열려요" data-account-action="security" data-section="email"${disabled('security')}>바꾸기<svg class="i" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></button></div></div>`
    + (identity?.createdAt ? `<div class="setting-row"><div><h3>가입한 날</h3></div><span class="ap-value">${esc(dayText(identity.createdAt))}</span></div>` : '')
    + `<div class="setting-row"><div><h3>소속</h3><p>${memberships.length ? esc(memberships.join(' / ')) : '학교·회사와 연결된 소속이 없어요.'}</p></div></div></div>`;
  const security = `${section('02', 'SIGN-IN', '로그인과 보안')}<div class="settings-group">`
    + `<div class="setting-row"><div><h3>로그인 방법</h3><p>${methods.google && methods.email ? '이메일과 비밀번호, 또는 Google로 로그인해요.' : methods.google ? 'Google로 로그인해요. 비밀번호를 만들면 이메일로도 로그인할 수 있어요.' : 'Google 계정도 연결하면 Google로 로그인할 수 있어요.'}</p></div><div class="ap-chips">${methods.names.length ? methods.names.map(text => `<span class="ap-chip">${esc(text)}</span>`).join('') : `<span class="ap-chip">${identityError ? '불러오지 못함' : '불러오는 중'}</span>`}</div></div>`
    + `<div class="setting-row"><div><h3>비밀번호</h3><p>${methods.email || !methods.google ? '바꾸면 이 PC 앱을 포함해 다른 기기와 앱에서는 로그아웃돼요. 새 비밀번호로 다시 로그인해 주세요.' : 'Google로 가입한 계정이에요. 비밀번호를 만들면 이메일과 비밀번호로도 로그인할 수 있어요.'}</p></div><button class="ghost-button" type="button" aria-label="${methods.email || !methods.google ? '비밀번호 바꾸기' : '비밀번호 만들기'}, 브라우저에서 열려요" data-account-action="security" data-section="password"${disabled('security')}>${methods.email || !methods.google ? '비밀번호 바꾸기' : '비밀번호 만들기'}<svg class="i" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></button></div>`
    + (methods.google || !identity ? '' : `<div class="setting-row"><div><h3>Google</h3><p>연결하면 다음부터 Google로 로그인해도 이 계정이 열려요.</p></div><button class="ghost-button" type="button" aria-label="Google 연결하기, 브라우저에서 열려요" data-account-action="security" data-section="google"${disabled('security')}>Google 연결하기<svg class="i" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></button></div>`)
    + `</div><div class="quiet-note ap-browser-note"><strong>비밀번호와 로그인 이메일은 브라우저에서 바꿔요</strong><p>기본 브라우저의 SYNK ID 「로그인과 보안」이 열려요. PC 앱은 비밀번호를 받지 않아요.${email ? ` 브라우저에 다른 계정이 로그인돼 있을 수 있으니, 그 화면의 로그인 이메일이 ${esc(email)}인지 확인해 주세요.` : ''}</p></div>`;
  const rows = shown.map(row => `<div class="setting-row ap-session"><div><h3>${esc(row.name)}${row.current ? ' <span class="ap-current">이 PC</span>' : ''}</h3><p>${esc([row.label, row.seen ? `${row.seen}에 사용` : ''].filter(Boolean).join(' · ') || '사용 기록 없음')}</p></div><button class="ghost-button" type="button" data-account-action="${row.current ? 'sign-out' : 'revoke'}" data-session="${esc(row.id)}"${disabled('session:' + row.id)}>${row.current ? '로그아웃' : '로그아웃시키기'}</button></div>`).join('');
  const sessionsBlock = `${section('03', 'SESSIONS', '로그인한 곳')}<div class="settings-group">${rows || '<div class="setting-row"><p>표시할 로그인 기록이 없어요.</p></div>'}${sessions.length > SESSIONS_SHOWN ? `<div class="setting-row"><button class="text-link" type="button" data-account-action="sessions-toggle">${allSessions ? '줄여 보기' : `${sessions.length - SESSIONS_SHOWN}곳 더 보기`}</button></div>` : ''}<div class="setting-row"><div><h3>모든 SYNK 앱에서 로그아웃</h3><p>이 PC와 다른 기기, 브라우저의 SYNK 로그인을 한 번에 끝내요.</p></div><button class="ghost-button" type="button" data-account-action="revoke-all"${disabled('revoke-all')}>모두 로그아웃</button></div></div>`;
  const learningOn = data?.learning?.enabled === true, canEnable = data?.capabilities?.learningSync === true && !deleting;
  const dataBlock = `${section('04', 'RECORDS', '학습 기록과 내 데이터')}<div class="settings-group">`
    + `<div class="setting-row"><div><h3>학습 기록 연결</h3><p>${learningOn ? '켜져 있어요. 연습 기록을 계정에 저장해 다른 기기에서도 이어 가요.' : canEnable ? '꺼져 있어요. 켜면 연습 기록을 계정에 저장해 다른 기기에서도 이어 가요.' : deleting ? '계정 삭제를 요청해서 켤 수 없어요. 요청을 취소하면 다시 켤 수 있어요.' : '지금은 켤 수 없어요. 이 기기에서 하는 연습은 그대로 할 수 있어요.'}</p></div><button class="ghost-button ap-switch" type="button" role="switch" aria-checked="${learningOn}" aria-label="학습 기록 연결" data-account-action="learning"${account && (learningOn || canEnable) ? disabled('learning') : ' disabled'}>${learningOn ? '켜짐' : '꺼짐'}</button></div>`
    + `<div class="setting-row"><div><h3>연습 기록 내려받기</h3><p>계정에 저장한 연습 기록을 파일(JSON)로 받아요. 과제와 AI 기록은 들어 있지 않아요.</p></div><button class="ghost-button" type="button" data-account-action="export"${account ? disabled('export') : ' disabled'}>${busy.has('export') ? '준비 중…' : '내려받기'}</button></div></div>`;
  const workspaceBlock = workspace ? `${section('05', 'WORKSPACE', '연결된 서비스')}<div class="settings-group"><div class="setting-row"><div><h3>SYNK Workspace(작업실)</h3><p>작업실 계정은 SYNK ID와 따로예요. 작업실 로그인 비밀번호는 작업실의 「설정 → 내 로그인 비밀번호」에서 바꿔요.</p></div><button class="ghost-button" type="button" data-account-action="workspace">작업실 열기</button></div></div>` : '';
  const removal = `${section(workspace ? '06' : '05', 'DELETE', '계정 지우기')}<div class="settings-group ap-danger-group">${deletion
    ? `<div class="setting-row"><div><h3>삭제 요청을 받았어요</h3><p>${due ? `${esc(due)}까지는 ` : '7일 동안은 '}여기서 취소할 수 있고, 그 뒤에 계정과 기록을 지워요(늦어도 요청 후 30일 안).</p></div><button class="solid-button" type="button" data-account-action="delete-cancel"${disabled('delete')}>삭제 요청 취소</button></div>`
    : deleting ? '<div class="setting-row"><div><h3>삭제를 처리하고 있어요</h3><p>늦어도 요청 후 30일 안에 계정과 기록을 지워요.</p></div></div>'
    : `<div class="setting-row"><div><h3>계정 지우기 요청</h3><p>요청하면 7일 동안은 취소할 수 있고, 그 뒤 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지워요.</p></div><button class="ghost-button ap-danger" type="button" data-account-action="delete-request"${account ? disabled('delete') : ' disabled'}>지우기 요청…</button></div>`}</div>`;
  const support = account ? `<details class="ap-support"><summary>문의할 때 쓰는 계정 번호</summary><p>hello@synk.im에 문의할 때 이 번호를 같이 적어 주세요.</p><code class="mono">${esc(account.synk_user_id)}</code></details>` : '';
  return head + hero + note + failed + profile + security + sessionsBlock + dataBlock + workspaceBlock + removal + support;
}

export function mountAccountPage(root, { bridge, getIdentity, getAppIds = () => [], onBack, onSignIn, onSignOut, onWorkspace, onAccountChanged = () => {}, toast = () => {}, now = Date.now, randomId = () => globalThis.crypto.randomUUID(), timeoutMs = 15000 } = {}) {
  let binding = '', epoch = 0, data = null, identity = null, loadError = '', identityError = false, loading = false, visible = false;
  let editingName = false, nameDraft = '', message = null, allSessions = false, deleteRequestId = null, securityOpenedAt = 0, openConfirm = null;
  const busy = new Set();
  const native = typeof bridge?.accountRequest === 'function';
  const owner = () => { const auth = getIdentity() || {};return { auth, id: auth.account?.synk_user_id || null, signedIn: auth.signedIn === true && !!auth.account?.synk_user_id }; };
  const keyOf = value => JSON.stringify([value.signedIn, value.id, value.auth.sessionGeneration]);
  function sync() {
    const current = owner(), next = keyOf(current);
    // A confirmation opened for the previous account must not act on the next one.
    if (next !== binding) { if (openConfirm?.open) openConfirm.close('cancel');binding = next;epoch++;data = null;identity = null;loadError = '';identityError = false;loading = false;editingName = false;nameDraft = '';message = null;allSessions = false;deleteRequestId = null;busy.clear(); }
    return current;
  }
  // One request for the bound account; a later sign-in, sign-out or switch drops its reply.
  async function call(operation, params, token) {
    const live = () => token === epoch;let timer;
    try {
      const raw = await Promise.race([Promise.resolve().then(() => { if (!live()) throw failure('changed');return operation === 'identity' ? bridge.accountIdentity() : bridge.accountRequest(operation, params); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(failure('NETWORK')), timeoutMs); })]);
      if (!live()) throw failure('changed');
      if (raw?.ok !== true) throw Object.assign(failure(raw?.error?.code || raw?.code || 'REQUEST_FAILED'), { retryable: raw?.error?.retryable === true });
      return raw;
    } finally { clearTimeout(timer); }
  }
  const say = (text, tone = 'ok') => { message = { text, tone };render(); };
  // One status region outside the re-rendered markup, so a message is announced once and not rebuilt.
  const live = root.ownerDocument?.createElement?.('p');if (live) { live.className = 'ap-live';live.setAttribute('role', 'status');live.setAttribute('aria-live', 'polite'); }
  function render() {
    const current = sync(), doc = root.ownerDocument, active = doc?.activeElement, inside = !!active && root.contains?.(active) && active !== root;
    const focusKey = inside ? [active.dataset?.accountAction, active.dataset?.session, active.id] : null;
    root.innerHTML = renderAccountPage({ native, signedIn: current.signedIn, auth: current.auth, data, identity, loadError, identityError, loading, message, editingName, nameDraft, busy, allSessions,
      workspace: current.signedIn && getAppIds().includes('messenger'), securityHint: !current.signedIn && securityOpenedAt && now() - securityOpenedAt < SECURITY_HINT_MS });
    if (live) { root.append?.(live);const text = message?.text || '';if (live.textContent !== text) live.textContent = text; }
    if (editingName) { const input = root.querySelector?.('#account-name-input');if (input && root.ownerDocument?.activeElement !== input) { input.focus();input.setSelectionRange?.(input.value.length, input.value.length); } }
    else if (focusKey) {
      const [action, session, id] = focusKey, same = [...(root.querySelectorAll?.('[data-account-action]') || [])].find(node => node.dataset.accountAction === action && (node.dataset.session || undefined) === session);
      (same || (id && root.querySelector?.('#' + id)) || root.querySelector?.('#account-page-title'))?.focus?.({ preventScroll: true });
    }
  }
  async function refresh({ quiet = false } = {}) {
    const current = sync();if (!native || !current.signedIn || loading) { render();return; }
    const token = epoch;loading = true;if (!quiet) loadError = '';render();
    const [view, who] = await Promise.allSettled([call('accountView', {}, token), call('identity', {}, token)]);
    if (token !== epoch) return;
    loading = false;
    if (view.status === 'fulfilled') { data = view.value;loadError = ''; } else if (view.reason?.code !== 'changed') loadError = errorText(view.reason);
    if (who.status === 'fulfilled') { identity = who.value;identityError = false; } else if (who.reason?.code !== 'changed') identityError = true;
    render();
  }
  // Runs one change for the bound account, then reloads the screen.
  async function act(key, run, { reload = true } = {}) {
    if (busy.has(key) || loading) return;
    const token = epoch;busy.add(key);message = null;render();
    try { await run(token);if (token !== epoch) return;if (reload) await refresh({ quiet: true }); }
    catch (error) {
      if (token !== epoch || error?.code === 'changed') return;
      if (['PROFILE_CONFLICT', 'REQUEST_NOT_FOUND', 'SESSION_NOT_FOUND', 'REVISION_CONFLICT'].includes(error?.code)) await refresh({ quiet: true });
      say(/[가-힣]/.test(error?.message || '') ? error.message : errorText(error), 'error');
    }
    finally { if (token === epoch) { busy.delete(key);render(); } }
  }
  const confirmDialog = ({ title, body, confirm, danger = false }) => new Promise(resolve => {
    const doc = root.ownerDocument, dialog = doc.createElement('dialog');
    dialog.className = 'account-dialog leave-dialog ap-confirm';dialog.setAttribute('aria-labelledby', 'ap-confirm-title');
    dialog.innerHTML = `<h2 id="ap-confirm-title">${esc(title)}</h2>${body.map(line => `<p>${esc(line)}</p>`).join('')}<form method="dialog" class="leave-actions"><button class="solid-button${danger ? ' ap-danger-solid' : ''}" value="confirm">${esc(confirm)}</button><button class="ghost-button" value="cancel" autofocus>취소</button></form>`;
    const token = epoch;openConfirm = dialog;
    dialog.addEventListener('close', () => { if (openConfirm === dialog) openConfirm = null;resolve(dialog.returnValue === 'confirm' && token === epoch);dialog.remove(); }, { once: true });
    doc.body.append(dialog);dialog.showModal();
  });
  async function download(token) {
    const events = [], meta = [];let after = 0, until, memory, account;
    for (let page = 0; page < 1000; page++) {
      const result = await call('exportPage', until == null ? { after } : { after, until }, token);
      if (after === 0 && Array.isArray(result.atlasMemory)) memory = result.atlasMemory;
      if (!Array.isArray(result.events) || !Number.isSafeInteger(result.cursor) || result.cursor < after || result.hasMore && result.cursor <= after) throw failure('EXPORT_BROKEN', '내려받기가 중간에 멈췄어요. 다시 해 주세요.');
      until ??= result.until;account ??= result.account;events.push(...result.events);if (Array.isArray(result.eventMeta)) meta.push(...result.eventMeta);after = result.cursor;
      if (!result.hasMore) {
        const doc = root.ownerDocument, blob = new Blob([JSON.stringify({ scope: 'connected-learning-records', account: account || data?.account, ...(memory ? { atlasMemory: memory } : {}), until, events, eventMeta: meta }, null, 2)], { type: 'application/json' });
        const link = doc.createElement('a');link.href = URL.createObjectURL(blob);link.download = 'synk-connected-learning.json';doc.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        say('연습 기록 파일을 준비했어요. 저장할 곳을 골라 주세요.');return;
      }
    }
    throw failure('EXPORT_TOO_LARGE', '기록이 많아 한 번에 마치지 못했어요. 잠시 뒤 다시 해 주세요.');
  }
  const actions = {
    back: () => onBack?.(),
    'sign-in': () => onSignIn?.(),
    'sign-out': () => onSignOut?.(),
    retry: () => refresh(),
    'sessions-toggle': () => { allSessions = !allSessions;render(); },
    workspace: () => onWorkspace?.(),
    'name-edit': () => { editingName = true;nameDraft = data?.account?.profile?.display_name || getIdentity()?.account?.display_name || '';message = null;render(); },
    'name-cancel': () => { editingName = false;nameDraft = '';render(); },
    // Each 「바꾸기↗」 opens its own line of 「로그인과 보안」 (?view=security&focus=password|email|google).
    security: button => act('security', async token => {
      const result = typeof bridge.authSecurity === 'function' ? await bridge.authSecurity(button?.dataset?.section) : { ok: false };if (token !== epoch) return;
      if (result?.ok !== true) throw failure('SECURITY_OPEN_FAILED', '브라우저를 열지 못했어요. synk.im/id에서 로그인한 뒤 「로그인과 보안」을 열어 주세요.');
      securityOpenedAt = now();say('기본 브라우저에서 SYNK ID 「로그인과 보안」을 열었어요. 비밀번호를 바꾸면 이 PC 앱도 로그아웃되니 새 비밀번호로 다시 로그인해 주세요.');
    }, { reload: false }),
    revoke: button => act('session:' + button.dataset.session, async token => { await call('revokeSession', { session_id: button.dataset.session }, token);say('그 기기의 로그인을 끝냈어요.'); }),
    'revoke-all': async () => {
      if (!await confirmDialog({ title: '모든 SYNK 앱에서 로그아웃할까요?', body: ['이 PC를 포함해 다른 기기와 브라우저의 SYNK 로그인을 모두 끝내요.', '저장하지 않은 메모가 있으면 먼저 저장해 주세요.'], confirm: '모두 로그아웃' })) return;
      await act('revoke-all', async token => { await call('revokeAll', {}, token);toast('모든 SYNK 앱에서 로그아웃했어요.'); }, { reload: false });
    },
    learning: () => act('learning', async token => {
      const enabled = data?.learning?.enabled !== true;
      await call('setLearning', { enabled, expected_revision: data.learning.revision }, token);
      say(enabled ? '학습 기록 연결을 켰어요.' : '학습 기록 연결을 껐어요.');onAccountChanged();
    }),
    export: () => act('export', token => download(token), { reload: false }),
    'delete-request': async () => {
      if (!await confirmDialog({ title: '계정 삭제를 요청할까요?', danger: true, confirm: '삭제 요청 보내기', body: [
        '요청하면 학습 기록 연결을 바로 멈춰요.',
        '7일 동안은 이 화면에서 요청을 취소할 수 있어요. 그 뒤 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지우고(늦어도 요청 후 30일 안), 지운 뒤에는 되돌릴 수 없어요.',
        '회사 작업실 자료와 학교 소속 기록은 그곳에서 따로 정리해요.',
      ] })) return;
      await act('delete', async token => {
        deleteRequestId ||= randomId();
        const result = await call('requestDeletion', { request_id: deleteRequestId }, token), due = momentText(result?.request?.due_at);
        say(`삭제 요청을 받았어요. ${due ? `${due}까지는` : '7일 동안은'} 여기서 취소할 수 있어요.`);onAccountChanged();
      });
    },
    'delete-cancel': () => act('delete', async token => {
      const pending = pendingDeletion(data);if (!pending) throw failure('REQUEST_NOT_FOUND');
      await call('cancelDeletion', { request_id: pending.request_id }, token);deleteRequestId = null;
      say('삭제 요청을 취소했어요. 학습 기록 연결은 꺼 둔 채예요. 다시 쓰려면 아래에서 켜 주세요.');onAccountChanged();
    }),
  };
  root.addEventListener('click', event => {
    const button = event.target.closest?.('[data-account-action]');if (!button || !root.contains(button) || button.disabled) return;
    const run = actions[button.dataset.accountAction];if (run) void run(button);
  });
  root.addEventListener('input', event => { if (event.target.id === 'account-name-input') nameDraft = event.target.value; });
  root.addEventListener('submit', event => {
    if (event.target.dataset?.accountForm !== 'name') return;
    event.preventDefault();
    const value = root.querySelector?.('#account-name-input')?.value ?? nameDraft, problem = nameProblem(value);
    if (problem) { nameDraft = value;say(problem, 'error');return; }
    void act('name', async token => {
      if (value.trim() === (data?.account?.profile?.display_name || '')) { editingName = false;return; }
      await call('updateProfile', profileChange(data?.account, value), token);editingName = false;nameDraft = '';say('이름을 바꿨어요. SYNK 앱마다 다음에 열 때 새 이름이 보여요.');
    });
  });
  return Object.freeze({
    show() { visible = true;sync();render();root.querySelector?.('#account-page-title')?.focus({ preventScroll: true });void refresh(); },
    hide() { visible = false;editingName = false;nameDraft = '';if (openConfirm?.open) openConfirm.close('cancel'); },
    // Called on every auth change; a different account or sign-out clears the screen.
    authChanged() { const before = binding;sync();if (visible) { if (before !== binding) void refresh();else render(); } },
    securityVisitedRecently: () => !!securityOpenedAt && now() - securityOpenedAt < SECURITY_HINT_MS,
    read: () => ({ binding, data, identity, loadError, identityError, loading, message, editingName, busy: [...busy] }),
  });
}
