import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPortal } from '../src/portal.mjs';
import { beginOAuth } from '../src/core.mjs';
import { rememberPlatformLogin } from '../src/platform-login-return.mjs';
import { webcrypto } from 'node:crypto';

// Synthetic DOM and SDK only: no network, real credentials, storage or bundled output.
class Element {
  constructor(tag = 'div') { this.tagName = tag;this.children = [];this.beforeNodes = [];this.dataset = {};this.hidden = false;this.disabled = false;this.value = '';this.textContent = '';this.checked = false;this.focusCount = 0;this.scrollCount = 0;this.classList = { add() {}, remove() {}, toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  closest() { return this; }
  before(node) { this.beforeNodes.push(node); }
  addEventListener() {}
  focus() { if (!this.disabled) this.focusCount++; } // like a browser: a disabled control takes no focus
  scrollIntoView() { this.scrollCount++; }
  querySelector() { return null; }
  get textContent() { return this.text || ''; }
  set textContent(value) { this.text = value;this.textWrites = (this.textWrites || 0) + 1; }
}
function clock() {
  let now = 1800000000000, id = 0;const timers = new Map();
  return { now: () => now, setTimeout: (fn, ms) => { timers.set(++id, { at: now + (Number.isFinite(ms) && ms <= 2147483647 ? ms : 0), fn });return id; } /* like a browser: a delay no timer can hold fires at once */, clearTimeout: id => timers.delete(id),
    pending: () => timers.size, advance(ms) { const end = now + ms;let next, same = 0;
      while ((next = [...timers].sort((a, b) => a[1].at - b[1].at)[0]) && next[1].at <= end) {
        // A timer that keeps re-arming itself with no delay fails here instead of hanging the run.
        same = next[1].at === now ? same + 1 : 0;if (same > 1000) throw new Error('the fake clock fired over 1000 timers at one instant: a timer keeps re-arming itself with no delay');
        now = next[1].at;timers.delete(next[0]);next[1].fn();
      }
      now = end;
    } };
}
const waitError = seconds => ({ code: 'over_email_send_rate_limit', status: 429, message: `For security purposes, you can only request this after ${seconds} seconds.` });
const settled = async () => { for (let n = 0; n < 4; n++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve;const promise = new Promise(done => { resolve = done; });return { promise, resolve }; }
async function fixture(t, { initial = null, reset = false, consent = false, preview = consent, redirectUri = 'https://app.example.test/', consentDetails = null, consentError = null, authorizationClients = [], initialReplies = {}, verifiedUser = null, defaultClock = false, callbackQuery = '', initializeError = null, sessionError = null, accountResponse = null, onInitialize = null, duringGetSession = null, beforeMountComplete = null, sessionStorage = undefined, localStorage = undefined, deviceWait = undefined, framed = false, loginSettings = undefined } = {}) {
  // Older manual-consent/rate-limit cases use the retained synthetic preview.
  // Automatic first-party login cases below explicitly exercise production mode.
  const ids = new Map(), events = new Map(), calls = [], replies = { ...initialReplies }, modes = ['login', 'signup', 'recover'].map(value => Object.assign(new Element('button'), { dataset: { view: value } })), time = clock();
  const get = id => { if (!ids.has(id)) ids.set(id, new Element());return ids.get(id); };
  const document = { body: new Element(), getElementById: get, createElement: tag => new Element(tag), querySelectorAll: () => modes };
  for (const id of ['auth-panel', 'consent', 'account', 'setup', 'signup-choices']) get(id).hidden = true;
  get('email').value = 'synthetic@example.test';get('password').value = 'synthetic-password';
  get('signup-age').checked = true;get('signup-learning').checked = true;
  let saved = initial, listener;const destinations = [], historyUrls = [], metrics = { consentLoads: 0, accountLoads: 0, userChecks: 0, checkedUsers: [] };
  const original = ['document', 'window', 'location', ...(defaultClock ? ['setTimeout', 'clearTimeout'] : [])].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]), originalNow = Date.now;
  const receivers = [];
  if (defaultClock) {
    Date.now = time.now;
    for (const method of ['setTimeout', 'clearTimeout']) globalThis[method] = function (...args) {
      receivers.push(this);if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return time[method](...args);
    };
  }
  Object.assign(globalThis, { document, window: { addEventListener: (type, fn) => events.set(type, fn), removeEventListener: (type, fn) => { if (events.get(type) === fn) events.delete(type); }, ...(sessionStorage ? { sessionStorage } : {}), ...(localStorage ? { localStorage } : {}), ...(framed ? { top: {}, self: {} } : {}), history: { state: null, replaceState(_state, _title, url) { historyUrls.push(url);location.href = url; } } }, location: {
    href: `https://id.example.test/?${reset ? 'view=reset' : consent ? 'authorization_id=synthetic-authorization' : ''}${callbackQuery}`,
    assign: value => destinations.push(value), reload() {},
  } });
  t.after(() => { events.get('pagehide')?.({});for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor);else delete globalThis[key]; }if (defaultClock) Date.now = originalNow; });
  const invoke = async (method, args) => { calls.push({ method, args });return typeof replies[method] === 'function' ? replies[method](args) : replies[method] || { data: { session: null }, error: null }; };
  const sdk = { auth: {
    initialize: async () => { await onInitialize?.({ emit: (event, value) => { saved = value;listener(event, value); }, setUrl: url => { location.href = url; } });return { error: initializeError }; },
    getSession: async () => { if(replies.getSession) return replies.getSession();const snapshot = saved;await duringGetSession?.({ emit: (event, value) => { saved = value;listener(event, value); } });return { data: { session: snapshot }, error: sessionError }; },
    getUser: async () => { metrics.userChecks++;metrics.checkedUsers.push(saved?.user?.id || null);if(replies.getUser)return replies.getUser();return { data: { user: verifiedUser || saved?.user } }; },
    onAuthStateChange: fn => { listener = fn;return {}; },
    signOut: args => invoke('signOut', args), signInWithOAuth: args => invoke('signInWithOAuth', args),
    signUp: args => invoke('signUp', args), signInWithPassword: args => invoke('signInWithPassword', args),
    resetPasswordForEmail: (...args) => invoke('resetPasswordForEmail', args), updateUser: (attributes, options) => invoke('updateUser', options === undefined ? attributes : [attributes, options]), verifyOtp: args => invoke('verifyOtp', args),
    oauth: { getAuthorizationDetails: async () => { metrics.consentLoads++;if (consentError) return { error: consentError };return { data: consentDetails || { client: { id: 'synthetic-client', name: '합성 앱' }, redirect_uri: redirectUri, scope: 'openid email profile' } }; },
      approveAuthorization: (...args) => invoke('approveAuthorization', args), denyAuthorization: (...args) => invoke('denyAuthorization', args) },
  } };
  const mounting = mountPortal({ config: { configured: true, learningUrl: '/', portalUrl: 'https://id.example.test/', supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'synthetic-public-only',
    clients: { platform: { clientId: 'synthetic-client', redirectUri } }, authorizationClients }, sdk, preview, ...(loginSettings ? {loginSettings,googleStorage:sessionStorage} : {}), ...(deviceWait === undefined ? {} : { deviceWait }), ...(defaultClock ? {} : { cooldownClock: time }), ...(accountResponse ? { accountFactory: () => ({ load: async () => { metrics.accountLoads++;return accountResponse; } }) } : {}) });
  await beforeMountComplete?.({ time, get, metrics, historyUrls, mounting, calls, events, replies, emit: (event, value) => { saved = value;listener(event, value); } });await mounting;
  return { get, calls, replies, time, receivers, events, destinations, historyUrls, metrics, notice: get('notice'), feedback: get('auth-submit').beforeNodes[0], consentFeedback: get('approve').beforeNodes[0],
    buttons: modes, mode: name => modes.find(button => button.dataset.view === name).onclick(), submit: () => get('auth-form').onsubmit({ preventDefault() {} }),
    emit: async (event, value) => { saved = value;listener(event, value);await settled(); }, emitNow: (event, value) => { saved = value;listener(event, value); } };
}


const syntheticSession = id => ({ user: { id, email: id + '@example.test' }, access_token: 'synthetic-' + id });
async function boundFixture(t, { preauthorized = false, ...options } = {}) {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const redirectUri = 'https://app.example.test/account/client.html?product=platform';
  const config = { configured:true,supabaseUrl:'https://auth.example.test',clients:{platform:{clientId:'synthetic-client',redirectUri}} };
  await beginOAuth({config,product:'platform',storage,now:1800000000000,cryptoAPI:webcrypto});
  const intent=rememberPlatformLogin(storage,{config,method:'email',returnHash:'#solio',now:1800000000000});
  const target=new URL(redirectUri);target.searchParams.set('state',intent.state);target.searchParams.set('code','synthetic-A-bound-code');
  const consentDetails=preauthorized?{redirect_url:target.href}:{client:{id:'synthetic-client',name:'SYNK 플랫폼'},redirect_uri:redirectUri,scope:'openid email profile',state:intent.state};
  const page=await fixture(t,{consent:true,preview:false,initial:syntheticSession('account-a'),redirectUri,consentDetails,sessionStorage:storage,...options});
  return {...page,intent,storage};
}
for (const preauthorized of [false,true]) test('platform account switch confirms local signout before a validated cancel callback '+preauthorized,async t=>{
 const p=await boundFixture(t,{preauthorized}),wait=deferred();assert.equal(p.get('consent-switch').hidden,false);
 p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);await wait.promise;return {};};
 const first=p.get('consent-switch').onclick();await settled();const joined=p.get('consent-switch').onclick();await settled();
 assert.equal(p.get('consent').hidden,false);assert.equal(p.destinations.length,0);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);
 wait.resolve();await first;await joined;await settled();assert.equal(p.destinations.length,1);const u=new URL(p.destinations[0]);assert.equal(u.searchParams.get('state'),p.intent.state);assert.equal(u.searchParams.get('error'),'access_denied');assert.equal(u.searchParams.has('code'),false);
 assert.deepEqual(p.calls.filter(c=>c.method==='signOut').map(c=>c.args),[{scope:'local'}]);assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization|revoke/.test(c.method)),false);
});
for(const kind of ['throw','error','residual'])test('platform account switch retains consent for manual retry when session remains after '+kind,async t=>{
 const p=await boundFixture(t);
 p.replies.signOut=async()=>{if(kind==='throw')throw Error('synthetic');if(kind==='error')return {error:Error('synthetic')};return {};};
 await p.get('consent-switch').onclick();await settled();
 assert.equal(p.destinations.length,0);assert.equal(p.get('consent').hidden,false);assert.equal(p.get('consent-switch').hidden,false);assert.equal(p.get('consent-switch').disabled,false);assert.equal(p.notice['data-kind'],'error');
 p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);return {};};await p.get('consent-switch').onclick();await settled();assert.equal(p.destinations.length,1);assert.equal(new URL(p.destinations[0]).searchParams.get('error'),'access_denied');
});
test('ordinary cancel never invokes SDK signout',async t=>{const p=await boundFixture(t);p.replies.denyAuthorization={data:{redirect_url:'https://app.example.test/account/client.html?product=platform&error=access_denied&state='+p.intent.state}};await p.get('deny').onclick();await settled();assert.equal(p.calls.some(c=>c.method==='signOut'),false);assert.equal(p.destinations.length,1);});
for(const options of [{preview:true},{framed:true},{sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}}}])test('platform switching is absent outside a live bound top-level request '+Object.keys(options)[0],async t=>{const p=await boundFixture(t,options);assert.equal(p.get('consent-switch').hidden,true);await p.get('consent-switch').onclick();assert.equal(p.calls.some(c=>c.method==='signOut'),false);});

for (const preauthorized of [false,true]) test('a logout error after actual local session removal still returns through verified cancellation '+preauthorized, async t=>{
 const p=await boundFixture(t,{preauthorized});
 p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);return {error:Object.assign(new Error('synthetic HTTP 500'),{status:500})};};
 await p.get('consent-switch').onclick();await settled();
 assert.equal(p.destinations.length,1,'SDK removes its local session even when remote logout returns an error');
 const u=new URL(p.destinations[0]);assert.equal(u.searchParams.get('state'),p.intent.state);assert.equal(u.searchParams.get('error'),'access_denied');assert.equal(u.searchParams.has('code'),false);
 assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization|revoke/.test(c.method)),false);
});
for (const preauthorized of [false,true]) test('a late SDK signout after the UI timeout cannot reopen an A-bound request for B '+preauthorized, async t=>{
 const p=await boundFixture(t,{preauthorized}),pending=deferred();
 p.replies.signOut=async()=>{await pending.promise;p.emitNow('SIGNED_OUT',null);return {};};
 const first=p.get('consent-switch').onclick();await settled();p.time.advance(12000);await settled();
 assert.equal(p.destinations.length,0);assert.equal(p.get('auth-panel').hidden,true);
 // Waiting for the late SDK response must retain single ownership of the switch.
 p.get('consent-switch').onclick();await settled();assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);
 pending.resolve();await first;await settled();
 assert.equal(p.destinations.length,1,'late local removal must complete the bound cancellation instead of reusing the old authorization');
 assert.equal(new URL(p.destinations[0]).searchParams.get('state'),p.intent.state);assert.equal(new URL(p.destinations[0]).searchParams.get('error'),'access_denied');
 assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization|revoke/.test(c.method)),false);
});

test('leaving the ID page invalidates a pending account switch completion',async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>pending.promise;
 const first=p.get('consent-switch').onclick();await settled();p.events.get('pagehide')({});pending.resolve({});await first;await settled();
 assert.equal(p.destinations.length,0);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
});
test('a third account event invalidates the old switch completion without signing the new account out',async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>pending.promise;
 const first=p.get('consent-switch').onclick();await settled();await p.emit('SIGNED_IN',syntheticSession('account-c'));pending.resolve({});await first;await settled();
 assert.equal(p.destinations.length,0);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
});

test('a rejection after local removal follows verified cancellation',async t=>{
 const p=await boundFixture(t);p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);throw Error('synthetic subscriber failure after removal');};
 await p.get('consent-switch').onclick();await settled();assert.equal(p.destinations.length,1);assert.equal(new URL(p.destinations[0]).searchParams.get('error'),'access_denied');assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);
});
test('a session check error locks approval and retries checking without a second signout',async t=>{
 const p=await boundFixture(t);p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);return {};};p.replies.getSession=async()=>({error:Error('synthetic check error'),data:{session:null}});
 await p.get('consent-switch').onclick();await settled();assert.equal(p.destinations.length,0);assert.equal(p.get('approve').disabled,true);assert.equal(p.get('auth-panel').hidden,true);
 p.replies.getSession=null;await p.get('consent-switch').onclick();await settled();assert.equal(p.destinations.length,1);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);
});
test('a session check timeout remains recoverable without repeating SDK signout',async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);return {};};p.replies.getSession=async()=>pending.promise;
 const first=p.get('consent-switch').onclick();await settled();p.time.advance(12000);await settled();assert.equal(p.destinations.length,0);assert.equal(p.get('approve').disabled,true);assert.equal(p.get('auth-panel').hidden,true);
 p.replies.getSession=null;const retry=p.get('consent-switch').onclick();await settled();assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);assert.equal(p.destinations.length,1);
 pending.resolve({data:{session:syntheticSession('account-a')},error:null});await first;await retry;await settled();assert.equal(p.destinations.length,1,'late stale check cannot navigate twice');
});

test('an expired bound intent cannot restore the old authorization login after late signout',async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>{await pending.promise;p.emitNow('SIGNED_OUT',null);return {};};
 const first=p.get('consent-switch').onclick();await settled();p.time.advance(600001);await settled();pending.resolve();await first;await settled();
 assert.equal(p.destinations.length,0);assert.equal(p.get('auth-panel').hidden,true);assert.equal(new URL(location.href).searchParams.has('authorization_id'),false);
 assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
});
for(const afterTimeout of [false,true])test('another account never loads the abandoned authorization during switching '+afterTimeout,async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>pending.promise;
 const first=p.get('consent-switch').onclick();await settled();const beforeLoads=p.metrics.consentLoads;if(afterTimeout){p.time.advance(12000);await settled();}
 await p.emit('SIGNED_IN',syntheticSession('account-b'));assert.equal(p.metrics.consentLoads,beforeLoads);assert.equal(p.get('auth-panel').hidden,true);
 pending.resolve({});await first;await settled();assert.equal(p.destinations.length,0);assert.equal(p.metrics.consentLoads,beforeLoads);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);
});


test('explicit cancel retires an in-flight switch and ignores its late completion',async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>{await pending.promise;p.emitNow('SIGNED_OUT',null);return {};};
 const first=p.get('consent-switch').onclick();await settled();await p.get('deny').onclick();await settled();
 assert.equal(p.destinations.length,1);assert.equal(new URL(p.destinations[0]).searchParams.get('state'),p.intent.state);assert.equal(new URL(p.destinations[0]).searchParams.get('error'),'access_denied');
 pending.resolve();await first;await settled();assert.equal(p.destinations.length,1);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
});
test('explicit cancel can leave an uncertain session check without approving the old account',async t=>{
 const p=await boundFixture(t);p.replies.signOut=async()=>{p.emitNow('SIGNED_OUT',null);return {};};p.replies.getSession=async()=>({error:Error('synthetic check failure')});
 await p.get('consent-switch').onclick();await settled();assert.equal(p.get('approve').disabled,true);assert.equal(p.get('deny').disabled,false);
 await p.get('deny').onclick();await settled();assert.equal(p.destinations.length,1);assert.equal(new URL(p.destinations[0]).searchParams.get('error'),'access_denied');assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
});
test('replaced login intent survives the old logout completion without reusing its authorization',async t=>{
 const p=await boundFixture(t),pending=deferred();p.replies.signOut=async()=>{await pending.promise;p.emitNow('SIGNED_OUT',null);return {};};
 const first=p.get('consent-switch').onclick();await settled();
 const config={configured:true,supabaseUrl:'https://auth.example.test',clients:{platform:{clientId:'synthetic-client',redirectUri:'https://app.example.test/account/client.html?product=platform'}}};
 await beginOAuth({config,product:'platform',storage:p.storage,now:p.time.now(),cryptoAPI:webcrypto});const next=rememberPlatformLogin(p.storage,{config,method:'email',returnHash:'#solio',now:p.time.now()});assert.notEqual(next.state,p.intent.state);
 const preserved=[...['synk.oauth.pending.platform','synk.platform.login.intent']].map(key=>[key,p.storage.getItem(key)]);
 pending.resolve();await first;await settled();assert.equal(p.destinations.length,0);assert.equal(p.get('auth-panel').hidden,true);assert.equal(new URL(location.href).searchParams.has('authorization_id'),false);
 for(const [key,value] of preserved)assert.equal(p.storage.getItem(key),value);assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
});

for (const preauthorized of [false,true]) test('abandoned authorization cannot escape through Google after another-tab login and late removal '+preauthorized,async t=>{
 const p=await boundFixture(t,{preauthorized,loginSettings:{google:true,phone:false}}),pending=deferred();
 p.replies.signOut=async()=>{await pending.promise;p.emitNow('SIGNED_OUT',null);return {};};
 p.replies.signInWithOAuth={error:new Error('synthetic stop after redirect capture')};
 const first=p.get('consent-switch').onclick();await settled();await p.emit('SIGNED_IN',syntheticSession('account-b'));
 pending.resolve();await first;await settled();
 assert.equal(new URL(location.href).searchParams.has('authorization_id'),false);
 assert.equal(p.get('auth-panel').hidden,true,'abandoned pages retain a restart/terminal view after late removal');
 assert(p.notice.textContent.trim(),'terminal notice must be visible instead of a blank page');
 await p.get('google-login').onclick();await settled();
 const starts=p.calls.filter(c=>c.method==='signInWithOAuth');
 for(const call of starts)assert.equal(new URL(call.args.options.redirectTo).searchParams.has('authorization_id'),false,'Google must not resurrect the abandoned A-bound authorization');
 assert.equal(p.calls.some(c=>/approveAuthorization|denyAuthorization/.test(c.method)),false);
 assert.equal(p.destinations.length,0);
});

for(const preauthorized of [false,true])test('a replacement account retires the URL before any stalled user verification '+preauthorized,async t=>{
 const p=await boundFixture(t,{preauthorized,loginSettings:{google:true,phone:false}}),logout=deferred(),verification=deferred();
 t.after(()=>{verification.resolve({error:new Error('synthetic verification failure')});logout.resolve({});});
 p.replies.signOut=()=>logout.promise;const first=p.get('consent-switch').onclick();await settled();p.replies.getUser=()=>verification.promise;
 p.emitNow('SIGNED_IN',syntheticSession('account-b'));await settled();const containsOldId=new URL(location.href).searchParams.has('authorization_id');
 await p.get('google-login').onclick();p.mode('signup');await p.submit();await p.get('resend-confirm').onclick();p.mode('recover');await p.submit();
 assert.equal(p.calls.some(c=>['signInWithOAuth','signUp','resetPasswordForEmail','resend'].includes(c.method)),false,'retired UI exits cannot start a new request with the old id');
 verification.resolve({error:new Error('synthetic verification failure')});logout.resolve({});await first;await settled();
 assert.equal(containsOldId,false,'retire before the first await so reload cannot resurrect A');assert.equal(p.get('auth-panel').hidden,true);assert(p.notice.textContent.trim());assert.equal(p.destinations.length,0);
});
test('abandoned requests keep visible terminal and restart views through repeated account events',async t=>{
 const p=await boundFixture(t,{loginSettings:{google:true,phone:false}}),pending=deferred();p.replies.signOut=()=>pending.promise;
 const first=p.get('consent-switch').onclick();await settled();const beforeLoads=p.metrics.consentLoads;
 for(const id of ['account-b','account-c']){await p.emit('SIGNED_IN',syntheticSession(id));assert.equal(p.get('auth-panel').hidden,true);assert.equal(p.get('connection-restart').hidden,false);await p.emit('SIGNED_OUT',null);assert.equal(p.get('auth-panel').hidden,true);assert(p.notice.textContent.trim());await p.emit('PASSWORD_RECOVERY',null);assert.equal(p.get('auth-panel').hidden,true);}
 pending.resolve({});await first;await settled();assert.equal(p.metrics.consentLoads,beforeLoads);assert.equal(p.calls.filter(c=>c.method==='signOut').length,1);assert.equal(p.destinations.length,0);
});
