import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)),input=process.env.SYNK_LOGOUT_INPUT||path.resolve(out,'..');
const {mountPortal}=await import(pathToFileURL(path.join(input,'src/portal.mjs')).href);
const account=(id='synthetic-a')=>({ok:true,account:{synk_user_id:id,status:'active',profile:{}},learning:{enabled:false,revision:1},capabilities:{},sessions:[{id:'00000000-0000-4000-8000-000000000456',current:true,revoked:false}],dataRequests:[]});
const session=id=>({user:{id,identities:[{provider:'email'}]},access_token:'synthetic-access-'+id});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const settle=async()=>{for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));};
class Element{
 constructor(tag='div'){Object.assign(this,{tagName:tag,children:[],dataset:{},hidden:false,disabled:false,value:'',textContent:'',classList:{add(){},remove(){}}});}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(key,value){this[key]=value;}closest(){return this;}before(){}querySelector(){return null;}addEventListener(){}
}
async function fixture(t){
 const nodes=new Map(),events=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const modes=['login','signup','recover'].map(view=>Object.assign(new Element('button'),{dataset:{view}}));
 let saved=session('synthetic-a'),listener,authActive=true,now=0,timerId=0;const timers=new Map(),calls=[],replies={};
 const clock={now:()=>now,setTimeout(fn,ms){timers.set(++timerId,{at:now+ms,fn});return timerId;},clearTimeout(id){timers.delete(id);},advance(ms){now+=ms;for(const[id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}};
 const emit=(event,value)=>{saved=value;listener(event,value);};
 const old=['document','window','location','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
 Object.assign(globalThis,{document:{body:new Element(),getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:()=>modes},window:{addEventListener:(name,fn)=>events.set(name,fn),history:{}},location:{href:'https://synthetic-id.invalid/id/',assign(){},reload(){}},fetch:async(url,options)=>{
  const target=new URL(url);assert.equal(target.origin,'https://synthetic-auth.invalid');assert.equal(target.pathname,'/functions/v1/synk-account');
  if(options.method==='POST'){
   const body=JSON.parse(options.body);assert.deepEqual(body,body.action==='revoke-all-sessions'?{action:'revoke-all-sessions'}:{action:'revoke-session',session_id:'00000000-0000-4000-8000-000000000456'});
   assert.equal(options.headers.Authorization,'Bearer synthetic-access-synthetic-a');assert.equal(options.headers.apikey,'synthetic-public-only');assert.equal(options.headers['X-SYNK-Product'],'platform');assert.equal(options.headers['X-SYNK-Contract'],'1');assert.equal(options.headers['X-SYNK-App-Version'],'0.2.0');assert.equal(options.headers['Content-Type'],'application/json');
   calls.push({method:'central-revoke',authActive});if(replies.revoke)return replies.revoke();
   if(!authActive)return new Response(JSON.stringify({ok:false,error:{code:'AUTH_REQUIRED'}}),{status:401});
   authActive=false;return new Response(JSON.stringify({ok:true,current:true,refreshRevoked:true,...(body.action==='revoke-all-sessions'?{legacyAccessGuard:true}:{})}));
  }
  if(target.searchParams.get('view')==='atlas')return new Response(JSON.stringify({ok:true,shared:'declared-only',learning:{enabled:false,revision:1},summary:{reasons:[],presentation:null,practice:{answered:0},forReasons:[]}}));
  return new Response(JSON.stringify(account(saved?.user?.id)));
 }});
 const sdk={auth:{initialize:async()=>({}),onAuthStateChange:fn=>{listener=fn;},getSession:async()=>({data:{session:saved}}),getUser:async()=>({data:{user:saved?.user}}),signOut:async options=>{assert.equal(options.scope,'local');calls.push({method:'sdk-local-cleanup'});authActive=false;if(replies.cleanup)await replies.cleanup();emit('SIGNED_OUT',null);return {};}}};
 await mountPortal({config:{configured:true,supabaseUrl:'https://synthetic-auth.invalid',accountApiUrl:'https://synthetic-auth.invalid',supabasePublishableKey:'synthetic-public-only',portalUrl:'https://synthetic-id.invalid/id/',learningUrl:'/'},sdk,cooldownClock:clock,loginSettings:{google:false,phone:false}});
 t.after(()=>{events.get('pagehide')?.({});for(const[key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const walk=node=>[node,...node.children.flatMap(walk)];
 const button=text=>walk(get('account')).find(node=>node.tagName==='button'&&node.textContent===text),logout=button('이 제품에서 로그아웃'),allLogout=button('모든 제품의 로그인 종료');
 return {get,calls,replies,events,clock,logout:()=>logout.onclick(),allLogout:()=>allLogout.onclick(),emit:async(event,value)=>{if(value)authActive=true;emit(event,value);await settle();}};
}
test('central revocation is authenticated before SDK logout invalidates the shared session',async t=>{
 const f=await fixture(t);f.logout();await settle();
 assert.deepEqual(f.calls,[{method:'central-revoke',authActive:true},{method:'sdk-local-cleanup'}]);
 assert.equal(f.get('account').hidden,true);assert.equal(f.get('auth-submit').disabled,false);assert.equal(f.get('notice').className,'notice');assert.equal(f.get('notice').textContent,'이 브라우저에서 로그아웃했어요.');
});
test('remote revocation failure still attempts local cleanup and retains the incomplete-server error',async t=>{
 const f=await fixture(t);f.replies.revoke=async()=>new Response(JSON.stringify({ok:false,error:{code:'SERVER_UNAVAILABLE'}}),{status:503});f.logout();await settle();
 assert.equal(f.calls.filter(row=>row.method==='sdk-local-cleanup').length,1);assert.equal(f.get('auth-submit').disabled,false);assert.equal(f.get('notice').className,'notice error');assert.match(f.get('notice').textContent,/서버의 로그인 종료는 연결 후/);
});
test('a stalled remote response falls through to local cleanup after the bounded wait',async t=>{
 const f=await fixture(t),wait=deferred();f.replies.revoke=()=>wait.promise;f.logout();await settle();
 assert.equal(f.calls.some(row=>row.method==='sdk-local-cleanup'),false);assert.equal(f.get('auth-submit').disabled,true);
 f.clock.advance(12000);await settle();assert.equal(f.calls.filter(row=>row.method==='sdk-local-cleanup').length,1);assert.equal(f.get('auth-submit').disabled,false);assert.equal(f.get('notice').className,'notice error');
 wait.resolve(new Response(JSON.stringify({ok:true,current:true,refreshRevoked:true})));await settle();assert.equal(f.get('notice').className,'notice error');
});
test('SDK cleanup hangs keep sign-in locked even after successful remote revocation and timeout',async t=>{
 const f=await fixture(t),wait=deferred();f.replies.cleanup=()=>wait.promise;f.logout();await settle();assert.equal(f.get('auth-submit').disabled,true);
 f.clock.advance(12000);await settle();assert.equal(f.get('auth-submit').disabled,true);assert.match(f.get('notice').textContent,/브라우저의 로그인 종료가 아직 끝나지/);
 wait.resolve();await settle();assert.equal(f.get('auth-submit').disabled,false);assert.equal(f.get('notice').className,'notice');
});
test('an account arriving during remote revocation is preserved instead of being signed out',async t=>{
 const f=await fixture(t),wait=deferred();f.replies.revoke=()=>wait.promise;f.logout();await settle();await f.emit('SIGNED_IN',session('synthetic-b'));
 wait.resolve(new Response(JSON.stringify({ok:true,current:true,refreshRevoked:true})));await settle();
 assert.equal(f.calls.some(row=>row.method==='sdk-local-cleanup'),false,'new account must not be signed out');assert.equal(f.get('account').hidden,false,'new account must be restored');assert.equal(f.get('auth-submit').disabled,false,'login controls must unlock');assert.match(f.get('notice').textContent,/로그인됐어요/);
});
test('leaving during remote revocation avoids late SDK cleanup and notice changes',async t=>{
 const f=await fixture(t),wait=deferred();f.replies.revoke=()=>wait.promise;f.logout();await settle();const text=f.get('notice').textContent;f.events.get('pagehide')({});wait.resolve(new Response(JSON.stringify({ok:true,current:true,refreshRevoked:true})));await settle();
 assert.equal(f.calls.some(row=>row.method==='sdk-local-cleanup'),false);assert.equal(f.get('notice').textContent,text);
});
test('offline transport still proceeds to SDK cleanup without claiming server completion',async t=>{
 const f=await fixture(t);f.replies.revoke=async()=>{throw new TypeError('synthetic offline');};f.logout();await settle();
 assert.equal(f.calls.filter(row=>row.method==='sdk-local-cleanup').length,1);assert.equal(f.get('notice').className,'notice error');assert.match(f.get('notice').textContent,/서버의 로그인 종료는 연결 후/);
});
test('duplicate logout actions cannot start another central revoke or SDK cleanup',async t=>{
 const f=await fixture(t),wait=deferred();f.replies.revoke=()=>wait.promise;f.logout();f.logout();await settle();assert.equal(f.calls.filter(row=>row.method==='central-revoke').length,1);
 wait.resolve(new Response(JSON.stringify({ok:true,current:true,refreshRevoked:true})));await settle();assert.equal(f.calls.filter(row=>row.method==='sdk-local-cleanup').length,1);
});
test('all-product logout requires successful central revocation and the legacy access guard',async t=>{
 const f=await fixture(t);f.allLogout();await settle();assert.deepEqual(f.calls,[{method:'central-revoke',authActive:true},{method:'sdk-local-cleanup'}]);assert.equal(f.get('notice').className,'notice');assert.match(f.get('notice').textContent,/모든 제품에 로그인 종료를 요청/);
});
