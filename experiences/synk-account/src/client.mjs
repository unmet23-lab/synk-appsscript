import { createAccountClient } from './generated/account-client.cjs';
import { PRODUCTS, readConfig, beginOAuth, consumeCallback, tokenRequest } from './core.mjs';
import { createAccountView } from './account-view.mjs';
import { createDesktopAccountClient, createDesktopClassroomClient, authMessage } from './desktop-account.mjs';
import { createClassroomTransport } from './classroom-client.mjs';
import { createAccountWorkspace } from './account-classroom.mjs';
const $ = id => document.getElementById(id);
const notice = (text, error = false) => { $('notice').textContent = text;$('notice').className = `notice${error ? ' error' : ''}`; };
let generation = 0, session, view;
async function startDesktop(product, bridge) {
  const environment = await bridge.getEnvironment();
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
  const clear = () => { generation++;view?.stop();view = null;identity = null;activeSessionGeneration = null; };
  async function show(state) {
    if (disposed) return;
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
      let result, allResult;
      if (request.scope === 'all') {
        try { allResult = await bridge.accountRequest('revokeAll', {}); } catch { allResult = { ok: false }; }
        if (allResult.ok) result = { ok: true, serverRevoked: allResult.refreshRevoked === true && allResult.legacyAccessGuard === true };
        else { guard();result = await bridge.authSignOut(); }
      } else result = await bridge.authSignOut();
      const latest = await bridge.authStatus();await show(latest);
      if (latest.signedIn || latest.status === 'signing-in') return;
      const incomplete = result.serverRevoked === false || request.scope === 'all' && !allResult?.ok;
      notice(note || result.message || (!result.ok ? '기기 로그인 저장을 지우지 못했어요. 다시 로그아웃해 주세요.' : incomplete ? '이 앱에서 로그아웃했어요. 서버의 로그인 종료는 연결 후 다시 확인해 주세요.' : request.scope === 'all' ? '모든 제품에 로그인 종료를 요청하고 이 앱에서 로그아웃했어요.' : '이 앱에서 로그아웃했어요.'), !result.ok || incomplete);
    } });
    try { await view.load();guard();if (entry === revision) notice(`${PRODUCTS[product]}에 연결했어요. 모바일과 PC에서 같은 SYNK ID를 사용해요.`); }
    catch (error) { if (token === generation) { clear();notice(error.message, true);$('connect').hidden = false; } }
  }
  const report = error => { if (!disposed) notice(error.message || '연결을 확인하지 못했어요.', true); };
  $('connect').onclick = async () => { $('connect').disabled = true;try { await show(await bridge.authSignIn()); } catch (error) { report(error);$('connect').disabled = false; } };
  $('cancel-connect').onclick = async () => { try { await show(await bridge.authCancelSignIn()); } catch (error) { report(error); } };
  unsubscribe = bridge.onAuthChanged(state => { void show(state).catch(report); });
  await show(await bridge.authStatus());
  window.addEventListener('pagehide', () => { disposed = true;clear();unsubscribe?.(); });
}
async function start() {
  const product = new URL(location.href).searchParams.get('product') || 'platform';if (!PRODUCTS[product]) throw new Error('등록된 SYNK 제품 주소를 확인해 주세요.');
  $('product-label').textContent = PRODUCTS[product];$('product-copy').textContent = product === 'world' ? 'SYNK ID로 연결한 뒤 게임과 학습을 이어가요.' : 'SYNK ID로 연결한 뒤 내 소속과 이용 권한을 확인해요.';
  document.getElementById('app-manifest').href = product === 'world' ? './world.webmanifest' : './platform.webmanifest';
  document.querySelector('link[rel="apple-touch-icon"]').href = product === 'world' ? './assets/app-world.png' : './assets/app-platform.png';
  if (product === 'messenger') throw new Error('사내 메신저의 로그인 입구에서 연결해 주세요.');
  if (typeof window.synkDesktop?.authStatus === 'function') { await startDesktop(product, window.synkDesktop);return; }
  let raw;try { const response = await fetch('./config.json', { cache: 'no-store' });if (response.ok) raw = await response.json(); } catch {}
  const config = readConfig(raw || { version: 1 }, location.href), key = `synk.oauth.session.${product}`;
  $('learning-link').href = config.learningUrl;
  if (!config.configured || !config.clients[product].clientId || !config.clients[product].redirectUri) { $('setup').hidden = false;notice('제품 SSO 설정 전 · 실제 로그인 연결은 아직 시작하지 않아요.');return; }
  $('connect').onclick = async () => { $('connect').disabled = true;try { location.assign(await beginOAuth({ config, product, storage: sessionStorage })); } catch (error) { notice(error.message, true);$('connect').disabled = false; } };
  const params = new URL(location.href).searchParams;
  if (params.has('code') || params.has('error')) {
    let fields;try { fields = consumeCallback({ config, product, url: location.href, storage: sessionStorage }); }
    finally { const clean = new URL(location.href);for (const name of ['code', 'state', 'error', 'error_description']) clean.searchParams.delete(name);history.replaceState(null, '', clean); }
    session = await tokenRequest(config, fields);sessionStorage.setItem(key, JSON.stringify(session));
  } else { try { session = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { sessionStorage.removeItem(key); } }
  if (!session?.access_token) { $('connect').hidden = false;notice('SYNK ID에서 로그인하면 이 제품으로 돌아와요.');return; }
  const token = ++generation, guard = () => { if (token !== generation || !session) throw Object.assign(new Error('계정 연결이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' }); };
  async function logout(note, request = {}) {
    let complete = false;
    try {
      if (request.scope === 'all') { const result = await client.revokeAll();complete = result.refreshRevoked === true && result.legacyAccessGuard === true; }
      else if (request.sessionId) { const result = await client.revokeSession(request.sessionId);complete = result.refreshRevoked === true; }
    } catch {}
    generation++;view?.stop();session = null;
    try { sessionStorage.removeItem(key); } catch { notice('현재 화면의 로그인은 종료했지만 브라우저 저장을 지우지 못했어요. 이 창을 닫아 주세요.', true);$('connect').hidden = false;return; }
    $('connect').hidden = false;
    notice(note || (!complete ? '이 브라우저에서 로그아웃했어요. 서버의 로그인 종료는 연결 후 다시 확인해 주세요.' : request.scope === 'all' ? '모든 제품에 로그인 종료를 요청하고 이 브라우저에서 로그아웃했어요.' : '이 브라우저에서 로그아웃했어요.'), !complete);
  }
  let refreshing=null;
  const refresh=() => refreshing||= (async () => {
      guard();if (!session.refresh_token) return null;const renewed = await tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients[product].clientId, refresh_token: session.refresh_token });
      guard();session = { ...renewed, refresh_token: renewed.refresh_token || session.refresh_token };sessionStorage.setItem(key, JSON.stringify(session));return session.access_token;
    })().finally(()=>{refreshing=null;});
  const client = createAccountClient({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product, guard,getAccessToken:()=>session?.access_token,refresh });
  const transport=product==='world'?createClassroomTransport({url:config.accountApiUrl,anonKey:config.supabasePublishableKey,product,guard,getAccessToken:()=>session?.access_token,refresh}):null;
  view = (product==='world'?createAccountWorkspace:createAccountView)({ client, transport, product, guard, notice, logout });await view.load();guard();$('connect').hidden = true;notice(`${PRODUCTS[product]}에서 서버가 확인한 계정으로 연결했어요.`);
  window.addEventListener('pagehide', () => { generation++;view?.stop(); });
}
start().catch(error => { notice(error.message, true);$('connect').hidden = false; });
// BFCache retained a stopped host; a fresh entry revalidates browser/native credentials.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
