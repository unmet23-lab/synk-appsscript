import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.classList={add(){},remove(){}};}
  append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this[key]=value;} closest(){return this;} before(){} addEventListener(){} querySelector(){return null;}
}
const settled=async()=>{for(let n=0;n<5;n++)await new Promise(resolve=>setImmediate(resolve));};
test('first existing account GET carries verified signup attribution; slow tracking never adds or blocks an account request',async t=>{
  const ids=new Map(),events=new Map(),data=new Map(),calls=[],get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const user={id:'synthetic-user',created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString(),identities:[{provider:'email'}]},clickId='a'.repeat(32);
  const location={origin:'https://synk.im',href:'https://synk.im/id/?synk_ref='+clickId,assign(){},reload(){}};
  const original=['document','window','location','sessionStorage','fetch','crypto'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const window={location,sessionStorage:storage,history:{},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener(){},SynkSocialTracking:{getClickId:()=>clickId,track:()=>new Promise(()=>{})}};
  Object.assign(globalThis,{location,window,sessionStorage:storage,document:{body:new Element(),getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:()=>[]},fetch:async(url,options)=>{
    calls.push({url,options});return Response.json({ok:true,account:{synk_user_id:'synthetic-account',status:'active',profile:{}},learning:{enabled:false,revision:1},sessions:[]});
  }});
  t.after(()=>{events.get('pagehide')?.({});for(const[key,value]of original){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
  const {createSignupConversion}=await import('../src/social-signup-conversion.mjs');
  await createSignupConversion({storage,cryptoAPI:webcrypto}).rememberEmail({data:{user}},Date.now());
  let releaseDigest;const gate=new Promise(resolve=>releaseDigest=resolve);
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>webcrypto.randomUUID(),subtle:{digest:async(...args)=>{await gate;return webcrypto.subtle.digest(...args);}}}});
  const {mountPortal}=await import('../src/portal.mjs');
  const sdk={auth:{initialize:async()=>({}),onAuthStateChange(){},getSession:async()=>({data:{session:{user,access_token:'synthetic-access'}}}),getUser:async()=>({data:{user}})}};
  const mounting=mountPortal({config:{configured:true,portalUrl:'https://synk.im/id/',learningUrl:'/',accountApiUrl:'https://account.example.test',supabasePublishableKey:'synthetic-public'},sdk});
  await settled();assert.equal(calls.length,0);releaseDigest();await mounting;await settled();
  assert.equal(calls.filter(call=>!new URL(call.url).search&&new URL(call.url).pathname==='/functions/v1/synk-account').length,1);assert.equal(new URL(calls[0].url).pathname,'/functions/v1/synk-account');
  assert.equal(calls[0].options.headers['x-synk-social-click'],clickId);assert.match(calls[0].options.headers['x-synk-social-event'],/^[a-f0-9-]{36}$/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-access');assert.equal(get('account').hidden,false);
  for(const call of calls.slice(1))assert.equal(call.options.headers['x-synk-social-click'],undefined);
});
