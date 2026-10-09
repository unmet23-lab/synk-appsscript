import { createAccountClient } from './generated/account-client.cjs';
import { PRODUCTS, readConfig, beginOAuth, consumeCallback, tokenRequest } from './core.mjs';
import { createAccountView } from './account-view.mjs';
import { createDesktopAccountClient, createDesktopClassroomClient, authMessage } from './desktop-account.mjs';
import { createClassroomTransport } from './classroom-client.mjs';
import { createAccountWorkspace } from './account-classroom.mjs';
import { rememberWorldPlayEntry } from './world-play-entry.mjs';
import { createPlatformEntry } from './platform-entry.mjs';
rememberWorldPlayEntry();
const $ = id => document.getElementById(id);
const notice = (text, error = false) => { $('notice').textContent = text;$('notice').className = `notice${error ? ' error' : ''}`; };
let generation = 0, session, view, closed = false, entry = 0;
let browserConfig = null, browserProduct = null, retryButton = null, recoveryNeeded = false, checking = false;
let callbackHandled = false, pendingExchange = null, verification = null;
let platformEntry = null;
const AUTH_ERRORS = new Set(['AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED']);
const accountChanged = () => Object.assign(new Error('계정 연결이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' });
// Register before configuration/authentication can await a network response.
window.addEventListener('pagehide', () => { closed = true;entry++;generation++;view?.stop();view = null;session = null;verification = null;pendingExchange = null; });
function recoveryControl() {
  if (!retryButton) { retryButton = document.createElement('button');retryButton.id = 'retry-connect';retryButton.type = 'button';retryButton.className = 'sb-btn soft';retryButton.textContent = '연결 다시 확인';retryButton.hidden = true;retryButton.onclick = () => { void reconnect(); };$('connect').before(retryButton); }
  return retryButton;
}
function reportConnectionError(error) {
  if (closed || error?.code === 'ACCOUNT_CHANGED') return;
  recoveryNeeded = true;let text = error.message || '계정 연결을 확인하지 못했어요. 다시 확인해 주세요.';
  const revoked = AUTH_ERRORS.has(error?.code);
  if (error?.code === 'PLATFORM_ACCOUNT_MISMATCH') {
    generation++;view?.stop();view = null;session = null;verification = null;pendingExchange = null;
  }
  if (revoked) {
    generation++;view?.stop();view = null;session = null;verification = null;pendingExchange = null;
    try { sessionStorage.removeItem(`synk.oauth.session.${browserProduct}`); }
    catch { text = '현재 화면의 연결은 종료했지만 브라우저 저장을 지우지 못했어요. 이 창을 닫아 주세요.'; }
  } else if (session?.access_token && error.retryable !== false) text += ' 로그인 정보는 유지했으니 연결을 다시 확인해 주세요.';
  notice(text, true);
  const configured = browserConfig?.configured && browserConfig.clients[browserProduct]?.clientId && browserConfig.clients[browserProduct]?.redirectUri;
  $('connect').hidden = !configured || !!session?.access_token;$('connect').disabled = false;
  if (browserProduct) recoveryControl().hidden = revoked;
}
async function startDesktop(product, bridge) {
  const environment = await bridge.getEnvironment();
  if (closed) return;
  if (environment.clientId !== product) throw new Error('이 앱에 맞는 계정 화면으로 이동해 주세요.');
  const accountLink = document.querySelector('footer a');
  accountLink.href = '#notice';accountLink.textContent = '이 앱의 SYNK ID';
  if (product === 'platform') {
    const worldLink = document.querySelector('header a[href="./client.html?product=world"]');
    worldLink.onclick = async event => {
      event.preventDefault();
      try { const result = await bridge.launch('world');notice(result.ok ? '별도 WORLD 앱을 열었어요.' : '플랫폼 라이브러리에서 WORLD 설치 상태를 확인해 주세요.', !result.ok); }
      catch { notice('WORLD 앱을 열지 못했어요. 플랫폼 라이브러리에서 확인해 주세요.', true); }
    };
  }
  let identity = null, activeSessionGeneration = null, unsubscribe, disposed = false, revision = 0;
  let nativeGeneration = -1, signedOutGeneration = -1, authEvents = 0, actionRevision = 0, latestState = null;
  const clear = () => { generation++;view?.stop();view = null;identity = null;activeSessionGeneration = null; };
  async function show(state) {
    if (disposed || closed) return;
    const stateGeneration = state.sessionGeneration;
    if (Number.isSafeInteger(stateGeneration)) {
      if (stateGeneration < nativeGeneration) return;
      nativeGeneration = stateGeneration;
    }
    latestState = state;
    // A refresh/focus snapshot cannot reopen the session this renderer just closed.
    // A new native sign-in creates a newer generation in the main process.
    if ((state.signedIn || state.status === 'restoring') && Number.isSafeInteger(stateGeneration) && stateGeneration <= signedOutGeneration) return;
    const entry = ++revision;
    $('setup').hidden = !!state.configured;
    const busy = ['restoring', 'signing-in'].includes(state.status);
    $('connect').hidden = !state.configured || state.signedIn;
    $('connect').disabled = busy;
    $('connect').textContent = busy ? '로그인 확인 중…' : 'SYNK ID로 로그인';
    $('cancel-connect').hidden = state.status !== 'signing-in';
    notice(authMessage(state), !!state.error);
    // Main refreshes the credentials inside the same authenticated session. Keep
    // its active game/learning host alive while that refresh is being verified.
    if (state.status === 'restoring' && !state.error && view && identity
      && Number.isSafeInteger(state.sessionGeneration) && state.sessionGeneration === activeSessionGeneration) {
      $('connect').hidden = true;return;
    }
    if (!state.signedIn || !state.account?.synk_user_id) { clear();return; }
    const identityKey = `${state.account.synk_user_id}:${state.sessionGeneration ?? 0}`;
    if (identity === identityKey && view) return;
    clear();identity = identityKey;activeSessionGeneration = state.sessionGeneration ?? null;
    const token = generation;
    const guard = () => { if (disposed || token !== generation || !identity) throw Object.assign(new Error('계정 연결이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
    const client = createDesktopAccountClient({ bridge, product, guard });
    const transport=product==='world'?createDesktopClassroomClient({bridge,product,guard}):null;
    view = (product==='world'?createAccountWorkspace:createAccountView)({ client, transport, product, guard, notice, logout: async (note, request = {}) => {
      guard();
      const intent = ++actionRevision, closingGeneration = activeSessionGeneration;
      const current = () => !disposed && !closed && intent === actionRevision;
      const newerLogin = () => latestState?.sessionGeneration !== closingGeneration && ['signed-in', 'signing-in', 'restoring', 'error'].includes(latestState?.status);
      if (Number.isSafeInteger(closingGeneration)) signedOutGeneration = Math.max(signedOutGeneration, closingGeneration);
      clear();$('connect').hidden = false;$('connect').disabled = true;$('cancel-connect').hidden = true;
      notice('현재 계정 화면을 닫았어요. 기기 로그인 저장과 서버의 연결 종료를 확인하고 있어요…');
      let result, allResult;
      try {
        if (request.scope === 'all') {
          try { allResult = await bridge.accountRequest('revokeAll', {}); } catch { allResult = { ok: false }; }
          if (!current() || newerLogin()) return;
          if (allResult.ok) result = { ok: true, serverRevoked: allResult.refreshRevoked === true && allResult.legacyAccessGuard === true };
          else {
            await readStatus();if (!current()) return;
            // Main still owns the credentials. Never let an old global request
            // fall back to signing out an account that arrived while it waited.
            if (latestState?.sessionGeneration !== closingGeneration) return;
            result = await bridge.authSignOut();
          }
        } else result = await bridge.authSignOut();
        if (!current() || newerLogin()) return;
        await readStatus();if (!current() || latestState?.signedIn || latestState?.status === 'signing-in') return;
        const incomplete = result.serverRevoked === false || request.scope === 'all' && !allResult?.ok;
        notice(note || result.message || (!result.ok ? '기기 로그인 저장을 지우지 못했어요. 다시 로그아웃해 주세요.' : incomplete ? '이 앱에서 로그아웃했어요. 서버의 로그인 종료는 연결 후 다시 확인해 주세요.' : request.scope === 'all' ? '모든 제품에 로그인 종료를 요청하고 이 앱에서 로그아웃했어요.' : '이 앱에서 로그아웃했어요.'), !result.ok || incomplete);
      } catch (error) {
        if (current()) notice('현재 화면은 닫았지만 기기의 로그인 종료를 확인하지 못했어요. 이 창을 닫고 다시 확인해 주세요.', true);
      } finally { if (current() && !newerLogin()) $('connect').disabled = false; }
    } });
    try { await view.load();guard();if (entry === revision) notice(`${PRODUCTS[product]}에 연결했어요. 모바일과 PC에서 같은 SYNK ID를 사용해요.`); }
    catch (error) { if (token === generation) { clear();notice(error.message, true);$('connect').hidden = false; } }
  }
  const report = error => { if (!disposed && !closed) notice(error.message || '연결을 확인하지 못했어요.', true); };
  async function readStatus() {
    const observed = authEvents, state = await bridge.authStatus();
    if (observed === authEvents) await show(state);
  }
  const authAction = async method => {
    if (disposed || closed) return;
    const intent = ++actionRevision, observed = authEvents;
    $('connect').disabled = true;
    try { const state = await bridge[method]();if (intent === actionRevision && observed === authEvents) await show(state); }
    catch (error) { if (intent === actionRevision && observed === authEvents) { report(error);$('connect').disabled = false; } }
  };
  $('connect').onclick = () => { if (!$('connect').disabled) return authAction('authSignIn'); };
  $('cancel-connect').onclick = () => authAction('authCancelSignIn');
  unsubscribe = bridge.onAuthChanged(state => { authEvents++;void show(state).catch(report); });
  window.addEventListener('pagehide', () => { disposed = true;actionRevision++;clear();unsubscribe?.(); });
  await readStatus();
}
async function start(attempt) {
  const checkEntry = () => { if (closed || attempt !== entry) throw accountChanged(); };
  checkEntry();generation++;view?.stop();view = null;session = null;verification = null;browserConfig = null;
  $('setup').hidden = true;$('connect').hidden = true;notice('계정 연결을 확인하고 있어요…');
  const product = new URL(location.href).searchParams.get('product') || 'platform';if (!PRODUCTS[product]) throw new Error('등록된 SYNK 제품 주소를 확인해 주세요.');
  $('product-label').textContent = PRODUCTS[product];$('product-copy').textContent = product === 'world' ? 'SYNK ID로 연결한 뒤 게임과 학습을 이어가요.' : 'SYNK ID로 연결한 뒤 내 소속과 이용 권한을 확인해요.';
  document.getElementById('app-manifest').href = product === 'world' ? './world.webmanifest' : './platform.webmanifest';
  document.querySelector('link[rel="apple-touch-icon"]').href = product === 'world' ? './assets/app-world.png' : './assets/app-platform.png';
  if (product === 'messenger') throw new Error('사내 메신저의 로그인 입구에서 연결해 주세요.');
  if (typeof window.synkDesktop?.authStatus === 'function') { await startDesktop(product, window.synkDesktop);return; }
  browserProduct = product;recoveryControl().hidden = true;
  if (product === 'world') {
    platformEntry ||= createPlatformEntry({ clientKey: 'world', getUrl: () => location.href, replaceUrl: url => history.replaceState(null, '', url) });
    platformEntry.capture(() => sessionStorage);platformEntry.restore(sessionStorage);
  }
  let raw;const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000);
  try {
    const response = await fetch('./config.json', { cache: 'no-store', credentials: 'omit', signal: abort.signal });checkEntry();
    if (response.ok) raw = await response.json();
    else if (response.status !== 404) throw new Error('Configuration unavailable');
    checkEntry();
  } catch (error) {
    checkEntry();throw Object.assign(new Error('계정 연결 설정을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'), { code: 'NETWORK', retryable: true });
  } finally { clearTimeout(timer); }
  const config = readConfig(raw || { version: 1 }, location.href), key = `synk.oauth.session.${product}`;
  browserConfig = config;
  $('learning-link').href = config.learningUrl;
  if (!config.configured || !config.clients[product].clientId || !config.clients[product].redirectUri) { $('setup').hidden = false;recoveryNeeded = true;recoveryControl().hidden = false;notice('제품 SSO 설정 전 · 실제 로그인 연결은 아직 시작하지 않아요.');return; }
  const connect = async (explicit = true) => {
    const intent = ++generation;view?.stop();view = null;session = null;verification = null;
    $('connect').disabled = true;recoveryControl().hidden = true;pendingExchange = null;
    notice('SYNK ID 로그인 화면으로 이동하고 있어요…');
    try { if (explicit) { platformEntry?.resume();platformEntry?.stop(); }const destination = await beginOAuth({ config, product, storage: sessionStorage });if (closed || attempt !== entry || intent !== generation) throw accountChanged();location.assign(destination); }
    catch (error) { if (!closed && attempt === entry && intent === generation) { notice(error.message, true);$('connect').hidden = false;$('connect').disabled = false; } }
  };
  $('connect').onclick = () => connect(true);
  if (platformEntry?.isCancelled()) { $('connect').hidden = false;$('connect').disabled = false;notice('WORLD 연결을 종료했어요. 다시 연결하려면 SYNK ID로 로그인해 주세요.');return; }
  const params = new URL(location.href).searchParams;
  if (!callbackHandled && (params.has('code') || params.has('error'))) {
    callbackHandled = true;
    try { pendingExchange = consumeCallback({ config, product, url: location.href, storage: sessionStorage }); }
    finally { const clean = new URL(location.href);for (const name of ['code', 'state', 'error', 'error_description']) clean.searchParams.delete(name);history.replaceState(null, '', clean); }
  }
  if (pendingExchange) { session = await tokenRequest(config, pendingExchange);checkEntry();sessionStorage.setItem(key, JSON.stringify(session));pendingExchange = null; }
  else { try { session = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { throw Object.assign(new Error('이 탭의 로그인 정보를 읽지 못했어요. 브라우저 저장 설정을 확인해 주세요.'), { code: 'STORAGE' }); } }
  if (!session?.access_token) { if (platformEntry?.beginAttempt()) { await connect(false);return; }$('connect').hidden = false;notice('SYNK ID에서 로그인하면 이 제품으로 돌아와요.');return; }
  const token = ++generation, guard = () => { if (closed || attempt !== entry || token !== generation || !session) throw accountChanged(); };
  async function logout(note, request = {}) {
    let logoutSession = session ? { ...session } : null;
    const logoutGeneration = ++generation, logoutEntry = entry;session = null;
    let complete = false, removed = true;
    // Close this device immediately; a slow revocation must not keep its screen,
    // game host or durable credentials open until the server answers.
    view?.stop();view = null;verification = null;recoveryControl().hidden = true;
    let cancellationError = null;
    try { platformEntry?.cancel(); } catch (error) { cancellationError = error; }
    try { sessionStorage.removeItem(key); } catch { removed = false; }
    $('connect').hidden = false;$('connect').disabled = false;
    notice(removed ? '이 기기에서 로그아웃했어요. 서버의 연결 종료를 확인하고 있어요…' : '현재 화면의 로그인은 종료했지만 브라우저 저장을 지우지 못했어요. 이 창을 닫아 주세요.', !removed);
    // Only the logout operation may use the captured credentials. All ordinary
    // account/record requests were fenced by the generation change above.
    const logoutGuard = () => { if (closed || logoutGeneration !== generation || logoutEntry !== entry || !logoutSession) throw accountChanged(); };
    const revoker = createAccountClient({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product,
      guard: logoutGuard, getAccessToken: () => logoutSession?.access_token,
      refresh: async () => { logoutGuard();if (!logoutSession.refresh_token) return null;const renewed = await tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients[product].clientId, refresh_token: logoutSession.refresh_token });logoutGuard();logoutSession = { ...renewed, refresh_token: renewed.refresh_token || logoutSession.refresh_token };return logoutSession.access_token; } });
    try {
      if (request.scope === 'all') { const result = await revoker.revokeAll();complete = result.refreshRevoked === true && result.legacyAccessGuard === true; }
      else if (request.sessionId) { const result = await revoker.revokeSession(request.sessionId);complete = result.refreshRevoked === true; }
    } catch {}
    finally { logoutSession = null; }
    if (closed || logoutGeneration !== generation || logoutEntry !== entry) return;
    if (!removed || cancellationError) { notice(cancellationError?.message || '현재 화면의 로그인은 종료했지만 브라우저 저장을 지우지 못했어요. 이 창을 닫아 주세요.', true);return; }
    $('connect').hidden = false;
    notice(note || (!complete ? '이 브라우저에서 로그아웃했어요. 서버의 로그인 종료는 연결 후 다시 확인해 주세요.' : request.scope === 'all' ? '모든 제품에 로그인 종료를 요청하고 이 브라우저에서 로그아웃했어요.' : '이 브라우저에서 로그아웃했어요.'), !complete);
  }
  let refreshing=null;
  const refresh=() => refreshing||= (async () => {
      guard();if (!session.refresh_token) return null;const renewed = await tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients[product].clientId, refresh_token: session.refresh_token });
      guard();session = { ...renewed, refresh_token: renewed.refresh_token || session.refresh_token };sessionStorage.setItem(key, JSON.stringify(session));return session.access_token;
    })().finally(()=>{refreshing=null;});
  const baseClient = createAccountClient({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product, guard,getAccessToken:()=>session?.access_token,refresh });
  const loadAccount = async () => { const result = await baseClient.load();guard();platformEntry?.assertAccount(result.account?.synk_user_id);return result; };
  let firstAccount = null;
  if (platformEntry?.accountId()) {
    try { firstAccount = await loadAccount(); }
    catch (error) { if ((error.code === 'PLATFORM_ACCOUNT_MISMATCH' || AUTH_ERRORS.has(error.code)) && platformEntry.beginAttempt()) { await connect(false);return; }throw error; }
  }
  const record = { attempt, token, guard, client: baseClient, signature: null, pending: false, viewLoads: 0 };
  const signature = data => JSON.stringify([data.account?.synk_user_id, data.account?.status, data.learning?.revision, data.learning?.enabled, data.capabilities?.learningSync]);
  record.signatureFor = signature;
  const client = { ...baseClient, load: async () => { record.viewLoads++;const result = firstAccount || await loadAccount();firstAccount = null;guard();record.signature = signature(result);return result; } };
  const transport=product==='world'?createClassroomTransport({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product,guard,getAccessToken:()=>session?.access_token,refresh}):null;
  view = (product==='world'?createAccountWorkspace:createAccountView)({ client, transport, product, guard, notice, logout });await view.load();guard();verification = record;recoveryNeeded = false;recoveryControl().hidden = true;$('connect').hidden = true;notice(`${PRODUCTS[product]}에서 서버가 확인한 계정으로 연결했어요.`);
}
async function reconnect() {
  if (closed || checking) return;checking = true;const attempt = ++entry;
  if (retryButton) retryButton.disabled = true;
  try { await start(attempt); }
  catch (error) { if (attempt === entry) reportConnectionError(error); }
  finally { if (attempt === entry) { checking = false;if (retryButton) retryButton.disabled = false; } }
}
document.addEventListener?.('visibilitychange', async () => {
  const record = verification;if (closed || checking || recoveryNeeded || document.visibilityState !== 'visible' || !record || record.pending) return;
  record.pending = true;const startedAfter = record.viewLoads;
  try {
    const result = await record.client.load();record.guard();
    // A newer explicit account read (for example after ending another session)
    // wins over an older visibility response, even when learning is unchanged.
    if (record.viewLoads !== startedAfter) return;
    platformEntry?.assertAccount(result.account?.synk_user_id);
    if (view?.applyAccount?.(result) === true) record.signature = record.signatureFor(result);
    else await reconnect();
  }
  catch (error) { if (!closed && record.attempt === entry && record.token === generation && record.viewLoads === startedAfter) reportConnectionError(error); }
  finally { record.pending = false; }
});
void reconnect();
// BFCache retained a stopped host; a fresh entry revalidates browser/native credentials.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
