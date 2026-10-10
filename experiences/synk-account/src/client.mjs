import { createAccountClient } from './generated/account-client.cjs';
import { PRODUCTS, readConfig, beginOAuth, consumeCallback, tokenRequest } from './core.mjs';
import { createAccountView } from './account-view.mjs';
const $ = id => document.getElementById(id);
const notice = (text, error = false) => { $('notice').textContent = text;$('notice').className = `notice${error ? ' error' : ''}`; };
let generation = 0, session, view;
async function start() {
  const product = new URL(location.href).searchParams.get('product') || 'platform';if (!PRODUCTS[product]) throw new Error('등록된 SYNK 제품 주소를 확인해 주세요.');
  $('product-label').textContent = PRODUCTS[product];$('product-copy').textContent = product === 'world' ? 'SYNK ID로 연결한 뒤 게임과 학습을 이어가요.' : 'SYNK ID로 연결한 뒤 내 소속과 이용 권한을 확인해요.';
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
  async function logout(note) { generation++;view?.stop();session = null;sessionStorage.removeItem(key);$('connect').hidden = false;notice(note || '이 제품에서 로그아웃했어요. 다른 제품의 로그인은 계정 관리에서 종료할 수 있어요.'); }
  const client = createAccountClient({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey, product, guard,
    getAccessToken: () => session?.access_token, refresh: async () => {
      guard();if (!session.refresh_token) return null;const renewed = await tokenRequest(config, { grant_type: 'refresh_token', client_id: config.clients[product].clientId, refresh_token: session.refresh_token });
      guard();session = { ...renewed, refresh_token: renewed.refresh_token || session.refresh_token };sessionStorage.setItem(key, JSON.stringify(session));return session.access_token;
    } });
  view = createAccountView({ client, product, guard, notice, logout });await view.load();guard();$('connect').hidden = true;notice(`${PRODUCTS[product]}에서 서버가 확인한 계정으로 연결했어요.`);
  window.addEventListener('pagehide', () => { generation++;view?.stop(); });
}
start().catch(error => { notice(error.message, true);$('connect').hidden = false; });
