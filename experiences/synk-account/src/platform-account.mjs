import { createAccountClient } from './generated/account-client.cjs';
import { tokenRequest } from './core.mjs';

const SESSION_KEY = 'synk.oauth.session.platform';
const AUTH_ERRORS = new Set(['AUTH_REQUIRED', 'AUTH_SESSION_MISSING', 'SESSION_REVOKED']);
const changed = () => Object.assign(new Error('계정 연결이 바뀌었어요.'), { code: 'ACCOUNT_CHANGED' });

// Reuse the platform client's existing tab session. Tokens remain private.
export function createPlatformAccount({ config, storage, onStatus = () => {},
  accountFactory = createAccountClient, requestToken = tokenRequest, fetcher = globalThis.fetch } = {}) {
  let generation = 0, disposed = false, controller = null, inFlight = null;
  // learningSync: the account's release policy for writing learning memory (capabilities.learningSync).
  let accountId=null, authenticatedClient=null, learningSync=false;
  const listeners=new Set();
  const identity=()=>({configured:!!config?.configured,signedIn:snapshot.status==='signed-in',status:snapshot.status==='loading'?'restoring':snapshot.status,accountId,sessionGeneration:generation,learningSync:snapshot.status==='signed-in'&&learningSync,error:snapshot.status==='error'?{message:snapshot.message,retryable:true}:null});
  let snapshot = { status: 'loading', displayName: '', message: '로그인 상태를 확인하고 있어요.' };
  const status = () => ({ ...snapshot });
  const emit = (phase, message = '', displayName = '') => {
    snapshot = { status: phase, displayName, message };
    if (!disposed) onStatus(status());
    if (!disposed) for(const listener of listeners)listener(identity());
    return status();
  };
  function invalidate() {
    generation++;controller?.abort();controller = null;accountId=null;authenticatedClient=null;learningSync=false;
    if (!disposed) emit('loading', '로그인 상태를 확인하고 있어요.');
  }
  async function load() {
    if (disposed) return status();
    invalidate();const expected = generation;
    if (!config?.configured || !config.clients?.platform?.clientId || !config.clients.platform.redirectUri)
      return emit('unconfigured', '이 화면에는 로그인 설정이 아직 없어요. 앱과 혜택은 로그인 없이 볼 수 있어요.');
    let raw, session;
    try { raw = storage.getItem(SESSION_KEY);session = JSON.parse(raw || 'null'); }
    catch { return emit('error', '브라우저가 저장 공간을 막아 로그인 정보를 못 읽었어요. 사이트 데이터 저장을 허용한 뒤 다시 시도해 주세요.'); }
    if (!session?.access_token || typeof session.access_token !== 'string')
      return emit('signed-out', '로그인하면 즐겨찾기를 계정에 저장하고 내 성향 요약도 볼 수 있어요.');
    const abort = controller = new AbortController();
    const guard = () => {
      if (disposed || expected !== generation || storage.getItem(SESSION_KEY) !== raw) throw changed();
    };
    const guardedFetch = (url, options = {}) => {
      guard();return fetcher(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, abort.signal]) : abort.signal });
    };
    const renew = async () => {
      guard();if (!session.refresh_token) return null;
      const result = await requestToken(config, { grant_type: 'refresh_token', client_id: config.clients.platform.clientId, refresh_token: session.refresh_token }, guardedFetch);
      guard();if (typeof result?.access_token !== 'string' || !result.access_token) throw new Error('Invalid token response');
      const next = { ...result, refresh_token: result.refresh_token || session.refresh_token }, nextRaw = JSON.stringify(next);
      storage.setItem(SESSION_KEY, nextRaw);raw = nextRaw;session = next;return session.access_token;
    };
    try {
      const client = accountFactory({ url: config.accountApiUrl, anonKey: config.supabasePublishableKey,
        product: 'platform', guard, getAccessToken: () => session.access_token, refresh: renew, fetch: guardedFetch });
      const result = await client.load();guard();
      if (result?.ok !== true || typeof result.account?.synk_user_id !== 'string' || !result.account.synk_user_id)
        throw new Error('Invalid account response');
      const name = result.account.profile?.display_name;
      accountId=result.account.synk_user_id;authenticatedClient=client;learningSync=result.capabilities?.learningSync===true;
      return emit('signed-in', '「학습 기록 연결」은 「내 계정 관리」에서 켜고 꺼요.', typeof name === 'string' ? name.trim().slice(0, 80) : '');
    } catch (error) {
      if (disposed || expected !== generation) return status();
      // A logout or replacement in the same tab always wins over a late reply.
      if (error?.code === 'ACCOUNT_CHANGED') return load();
      if (AUTH_ERRORS.has(error?.code)) return emit('signed-out', '로그인이 끝났어요. 다시 로그인해 주세요.');
      // A failed read does not revoke or erase the existing session.
      return emit('error', '계정 서버에 닿지 못했어요. 로그인은 그대로이니 잠시 뒤 「다시 시도」를 눌러 주세요.');
    } finally { if (controller === abort) controller = null; }
  }
  function refresh() {
    if (disposed) return Promise.resolve(status());
    if (inFlight?.generation === generation) return inFlight.promise;
    const promise = load(), current = { generation, promise };inFlight = current;
    void promise.finally(() => { if (inFlight === current) inFlight = null; });
    return promise;
  }
  return Object.freeze({ status, identity, refresh, invalidate,
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
    async request(operation,params){
      if(!['platformLoad','platformSave','platformDelete','atlasSummary','insightLoad','insightSave','insightDelete','understandingLoad','understandingSave','understandingDelete','memoryGet','memoryPost'].includes(operation)||!authenticatedClient||snapshot.status!=='signed-in')throw changed();
      if(operation==='atlasSummary'&&params&&Object.keys(params).length)throw changed();
      // Learning memory (the chosen presentation 「내 성향」 saves): the same SDK routes WORLD uses.
      if(operation.startsWith('memory')&&(!Number.isSafeInteger(params?.revision)||operation==='memoryPost'&&(!Array.isArray(params.entries)||!params.entries.length||params.entries.length>100)))throw Object.assign(new Error('요청 형식이 맞지 않아요.'),{code:'INVALID_REQUEST'});
      const expected=generation,owner=accountId,result=await(operation==='memoryGet'?authenticatedClient.memory.get({revision:params.revision}):operation==='memoryPost'?authenticatedClient.memory.post({revision:params.revision,entries:params.entries}):authenticatedClient[operation](params));
      if(expected!==generation||disposed)throw changed();
      if(operation.startsWith('insight')&&result?.ok===true&&(result.scope!=='synk-personal'||result.resource!=='member-insight'||result.accountId!==owner)){invalidate();throw changed();}
      if(operation.startsWith('understanding')&&result?.ok===true&&(result.scope!=='synk-personal'||result.resource!=='member-understanding'||result.accountId!==owner)){invalidate();throw changed();}
      return result;
    },
    stop() { disposed = true;generation++;controller?.abort();controller = null;accountId=null;authenticatedClient=null;learningSync=false;listeners.clear();snapshot = { status: 'signed-out', displayName: '', message: '' }; } });
}
