import { createAccountClient } from './generated/account-client.cjs';
import { authorizationProduct, trustedConsentRedirect } from './core.mjs';
import { createAccountView } from './account-view.mjs';
const $ = id => document.getElementById(id);
export async function mountPortal({ config, sdk, accountFactory = createAccountClient, preview = false }) {
  const notice = (text, error = false) => { $('notice').textContent = text;$('notice').className = `notice${error ? ' error' : ''}`; };
  if (preview) $('preview-banner').hidden = false;
  $('learning-link').href = config.learningUrl;
  if (!config.configured) { $('setup').hidden = false;notice('계정 서비스 설정 전 · 기본 학습은 계속 사용할 수 있어요.');return; }
  let mode = new URL(location.href).searchParams.get('view') === 'reset' ? 'reset' : 'login', session = null, generation = 0, entryId = 0, authOperation = false, view = null, details = null, subject = null;
  const bounded = async promise => { let timer;try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('연결을 확인하는 데 시간이 걸려요. 다시 로그인해 주세요.')), 12000); })]); } finally { clearTimeout(timer); } };
  const report = error => { if (error.code !== 'ACCOUNT_CHANGED') notice(error.message || '지금은 요청을 마치지 못했어요.', true); };
  const authorizationId = new URL(location.href).searchParams.get('authorization_id');
  const setMode = value => {
    mode = value;$('auth-heading').textContent = ({ login: '다시 만나서 반가워요.', signup: '나만의 SYNK를 시작해요.', recover: '비밀번호를 다시 정해요.', reset: '새 비밀번호를 정해 주세요.' })[mode];
    $('auth-copy').textContent = mode === 'recover' ? '가입한 이메일로 재설정 링크를 보내 드려요.' : mode === 'signup' ? '이메일로 일반 계정을 만들어요. 학생 권한은 소속 확인 뒤 연결돼요.' : '이메일과 비밀번호로 내 계정에 들어가요.';
    $('password-label').hidden = mode === 'recover';$('password').required = mode !== 'recover';$('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('email').closest('label').hidden = mode === 'reset';$('email').required = mode !== 'reset';
    $('auth-submit').textContent = ({ login: '로그인', signup: '이메일로 가입', recover: '재설정 메일 보내기', reset: '새 비밀번호 저장' })[mode];
    document.querySelectorAll('[data-view]').forEach(button => { button.hidden = button.dataset.view === mode || mode === 'login' && button.dataset.view === 'login'; });
  };
  const guarded = token => () => { if (token !== generation || !session) throw Object.assign(new Error('로그인 상태가 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
  async function loadConsent(check) {
    const result = await bounded(sdk.auth.oauth.getAuthorizationDetails(authorizationId));check();
    if (result.error) throw result.error;
    if (result.data?.redirect_url) { location.assign(trustedConsentRedirect(result.data.redirect_url, config));return; }
    details = result.data;
    const product = authorizationProduct(details?.client?.id, config);
    if (!product) throw new Error('등록된 SYNK 제품의 연결 요청인지 확인하지 못했어요.');
    trustedConsentRedirect(details.redirect_uri, config);
    $('consent-name').textContent = details.client.name || (product === 'world' ? 'SYNK WORLD' : 'SYNK 플랫폼');
    $('consent-destination').textContent = details.redirect_uri;
    $('scopes').replaceChildren(...(details.scope || '').split(' ').filter(Boolean).map(scope => { const li = document.createElement('li');li.textContent = ({ openid: '계정을 구분하는 정보', email: '이메일 주소', profile: '기본 프로필' })[scope] || scope;return li; }));
    $('consent').hidden = false;notice('제품과 연결할 정보를 확인한 뒤 선택해 주세요.');
  }
  async function enter() {
    view?.stop();view = null;$('consent').hidden = true;$('account').hidden = true;
    const token = generation, entry = ++entryId;
    const check = () => { guarded(token)();if (entry !== entryId) throw Object.assign(new Error('로그인 화면이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
    if (!session || mode === 'reset') { $('auth-panel').hidden = false;setMode(mode);notice(mode === 'reset' ? '메일에서 확인한 계정의 새 비밀번호를 저장해 주세요.' : '이메일로 로그인하거나 처음이라면 가입해 주세요.');return; }
    $('auth-panel').hidden = true;
    try {
      const checked = await bounded(sdk.auth.getUser());check();if (checked.error || !checked.data?.user) throw new Error('로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.');
      if (authorizationId) { await loadConsent(check);return; }
      const client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product: 'platform', guard: check,
        getAccessToken: () => session?.access_token, refresh: async () => { const result = await bounded(sdk.auth.refreshSession());check();session = result.data?.session;return session?.access_token; } });
      view = createAccountView({ client, product: 'platform', guard: check, notice, preview, logout });await view.load();check();notice(preview ? '합성 계정 화면 예시 · 실제 로그인이나 서버 연결이 아닙니다.' : '서버에서 확인한 내 계정이에요.');
    } catch (error) {
      if (token !== generation || entry !== entryId || error.code === 'ACCOUNT_CHANGED') return;
      view?.stop();view = null;mode = 'login';setMode(mode);$('auth-panel').hidden = false;report(error);
    }
  }
  async function logout(note) { authOperation = true;try { generation++;view?.stop();session = null;subject = null;let result;try { result = await bounded(sdk.auth.signOut({ scope: 'local' })); } catch (error) { result = { error }; }mode = 'login';await enter();notice(result.error ? '이 화면에서 로그아웃했지만 인증 서버의 세션 종료는 확인하지 못했어요.' : note || '이 제품에서 로그아웃했어요.', !!result.error); } finally { authOperation = false; } }
  document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => setMode(button.dataset.view); });
  $('auth-form').onsubmit = async event => {
    event.preventDefault();$('auth-submit').disabled = true;authOperation = true;
    try {
      let result;
      const email = $('email').value.trim(), password = $('password').value;
      const callback = new URL(config.portalUrl);if (authorizationId) callback.searchParams.set('authorization_id', authorizationId);
      if (mode === 'signup') result = await sdk.auth.signUp({ email, password, options: { emailRedirectTo: callback.href } });
      else if (mode === 'recover') { callback.searchParams.set('view', 'reset');result = await sdk.auth.resetPasswordForEmail(email, { redirectTo: callback.href }); }
      else if (mode === 'reset') result = await sdk.auth.updateUser({ password });
      else result = await sdk.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      $('password').value = '';
      if (mode === 'recover' || mode === 'signup' && !result.data?.session) notice('메일함에서 안내를 확인해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.');
      else if (mode === 'reset') { mode = 'login';notice('새 비밀번호를 저장했어요.');await enter(); }
      else { session = result.data.session;generation++;subject = session?.user?.id;await enter(); }
    } catch (error) { report(error); }
    finally { $('auth-submit').disabled = false;authOperation = false; }
  };
  for (const [id, method] of [['approve', 'approveAuthorization'], ['deny', 'denyAuthorization']]) $(id).onclick = async () => {
    $('approve').disabled = $('deny').disabled = true;const token = generation;
    try { const result = await bounded(sdk.auth.oauth[method](authorizationId, { skipBrowserRedirect: true }));guarded(token)();if (result.error) throw result.error;location.assign(trustedConsentRedirect(result.data.redirect_url, config)); }
    catch (error) { report(error);$('approve').disabled = $('deny').disabled = false; }
  };
  sdk.auth.onAuthStateChange((event, value) => { queueMicrotask(() => {
    const next = value?.user?.id || null;if (next !== subject) { generation++;subject = next;view?.stop(); }session = value;
    if (event === 'PASSWORD_RECOVERY') mode = 'reset';
    if (!authOperation && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') void enter().catch(report);
  }); });
  const result = await bounded(sdk.auth.getSession());session = result.data?.session;subject = session?.user?.id || null;setMode(mode);
  await enter().catch(report);
  window.addEventListener('pagehide', () => { generation++;view?.stop(); });
}
