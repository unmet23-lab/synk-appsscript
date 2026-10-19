import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createTravelMemory, TRAVEL_STORAGE_KEY } from '../experiences/path-travel/planner-storage.mjs';
import { createTravelAccountSession } from '../experiences/path-travel/planner-account-session.mjs';
import { TRAVEL_ACCOUNT_CONTRACT, travelAccountDocument } from '../experiences/path-travel/planner-account.mjs';
import { createProductAccount } from '../experiences/synk-account/src/product-account.mjs';
import { planTravel } from '../experiences/path-travel/planner.mjs';
import { createTravelLoginHandoff, validateTravelLoginDraft, TRAVEL_LOGIN_DRAFT_KEY, TRAVEL_LOGIN_DRAFT_TTL } from '../experiences/path-travel/planner-login-draft.mjs';

const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,String(value)),removeItem:key=>rows.delete(key),key:i=>[...rows.keys()][i]??null,get length(){return rows.size;}};};
const draft=()=>({controls:{budget:{value:'',checked:false},'taste-coffee':{value:'false',checked:false}},companions:[],preferences:{},requiredFeatures:{},requiredCategories:[],origin:null,destination:null,formDirty:true,panels:{conditions:true,companions:false,schedule:false}});
const rawDraft=()=>{const value=draft();delete value.controls['taste-coffee'];value.controls['taste:coffee']={value:'false',checked:false};return value;};
const url='http://127.0.0.1:4303/';

test('login handoff is tab-local, bounded, value-only and does not grant guest consent',()=>{
 const session=storage(),guest=storage(),memory=createTravelMemory();memory.query.budget=123456;
 let time=Date.now();const options={storage:session,guestStorage:guest,getUrl:()=>url,now:()=>time};
 const handoff=createTravelLoginHandoff(options);assert.equal(handoff.read(),null);assert.equal(session.length,0);
 const original=rawDraft();original.companions=[{id:'friend',label:'',preferences:{},requiredFeatures:{indoor:false}}];
 handoff.save({memory,draft:original});assert.equal(guest.length,0);assert.equal(memory.consent,false);
 const returned=createTravelLoginHandoff(options).read();assert.deepEqual(returned,{memory,draft:original});
 assert.equal(createTravelLoginHandoff({...options,storage:storage()}).read(),null,'another tab has no handoff');
 assert.equal(createTravelLoginHandoff({...options,getUrl:()=>url+'other-app/'}).read(),null,'a different product path cannot restore it');
 handoff.save({memory,draft:original});time+=TRAVEL_LOGIN_DRAFT_TTL;
 assert.equal(handoff.read(),null);assert.equal(session.getItem(TRAVEL_LOGIN_DRAFT_KEY),null);
});

test('malformed markup, unknown controls, oversized data and storage refusal never become a login draft',()=>{
 const valid=rawDraft();
 for(const mutate of [v=>v.html='<img src=x onerror=alert(1)>',v=>v.controls['place-detail']={value:'<script>x</script>',checked:false},v=>v.controls.budget.checked='false',v=>v.companions=[{id:'a',label:'x',preferences:{invented:true},requiredFeatures:{}}],v=>v.destination={id:{},name:'x',lat:1,lon:1}]){const value=structuredClone(valid);mutate(value);assert.throws(()=>validateTravelLoginDraft(value),TypeError);}
 const store=storage(),memory=createTravelMemory(),handoff=createTravelLoginHandoff({storage:store,guestStorage:storage(),getUrl:()=>url});
 store.setItem(TRAVEL_LOGIN_DRAFT_KEY,'<html>');assert.equal(handoff.read(),null);
 assert.throws(()=>createTravelLoginHandoff({storage:{setItem(){throw Error('full');}},guestStorage:storage(),getUrl:()=>url}).save({memory,draft:valid}),/파일로 저장/);
 const big=structuredClone(valid);big.controls.budget.value='x'.repeat(201);assert.throws(()=>handoff.save({memory,draft:big}),TypeError);
});

test('another tab changing or deleting the guest record revokes only the returning snapshot consent',()=>{
 const store=storage(),guest=storage(),memory=createTravelMemory();memory.consent=true;guest.setItem(TRAVEL_STORAGE_KEY,JSON.stringify(memory));
 const handoff=createTravelLoginHandoff({storage:store,guestStorage:guest,getUrl:()=>url});handoff.save({memory,draft:null});
 assert.equal(handoff.read().memory.consent,true);
 guest.removeItem(TRAVEL_STORAGE_KEY);assert.equal(handoff.read().memory.consent,false);assert.equal(memory.consent,true);
 assert.equal(guest.length,0);handoff.revokeConsent();assert.equal(handoff.read().memory.consent,false);
});

class Element {
 constructor(){this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.selectors=new Map();this.listeners=new Map();this.classList={add(){}};}
 append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=[...nodes];}setAttribute(key,value){this[key]=value;}
 addEventListener(name,handler){this.listeners.set(name,handler);}closest(){return this;}
 querySelector(selector){const action=/^\[data-notebook="(.+)"\]$/.exec(selector)?.[1];const search=node=>node.children.find(c=>c.dataset.notebook===action)||node.children.map(search).find(Boolean);if(action){const found=search(this);if(found)return found;}if(!this.selectors.has(selector))this.selectors.set(selector,new Element());return this.selectors.get(selector);}
}
const settle=async (predicate,message=()=> 'asynchronous account event completed')=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(predicate(),message());};
function dom(t){const cleanups=[],keys=['document','addEventListener','removeEventListener','confirm'],saved=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);Object.assign(globalThis,{document:{createElement:()=>new Element()},addEventListener(){},removeEventListener(){},confirm:()=>true});t.after(()=>{for(const cleanup of cleanups)cleanup();for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});return api=>cleanups.push(()=>api.dispose());}

async function page({sessionStore,guestStore,memory=createTravelMemory(),inputDraft=null,href=url,refuseDraft=false,configFailure=false}){
 let visible=structuredClone(memory),formDraft=structuredClone(inputDraft),navigated=null,location=href,restored=0;const mount=new Element(),content=new Element();
 const remote=createTravelMemory();remote.query.budget=99999;const serverWrites=[];
 const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 const config={version:1,supabaseUrl:'https://auth.example.test',accountApiUrl:'https://api.example.test',supabasePublishableKey:'sb_publishable_fixture',portalUrl:'https://id.example.test',clients:{'path-travel':{clientId:'fixture-travel',redirectUri:url}}};
 const handoff=createTravelLoginHandoff({storage:refuseDraft?{getItem:()=>null,setItem(){throw Error('full');}}:sessionStore,guestStorage:guestStore,getUrl:()=>location});
 const api=await createTravelAccountSession({mount,content,contract:{...TRAVEL_ACCOUNT_CONTRACT,available:true,productionRegistered:true},loginHandoff:handoff,
  getState:()=>visible,applyState:value=>{visible=structuredClone(value);},captureLoginDraft:()=>formDraft,restoreLoginDraft:value=>{formDraft=structuredClone(value);},onLoginRestore:()=>restored++,
  captureGuestDraft:()=>formDraft,restoreGuestDraft:value=>{formDraft=structuredClone(value);},
  notebookOptions:{storage:guestStore,accountFactory:settings=>createProductAccount({...settings,configUrl:'./config.json',storage:sessionStore,getUrl:()=>location,replaceUrl:next=>{location=next;},navigate:next=>{navigated=next;},cryptoAPI:webcrypto,
   fetcher:async(input,options={})=>{const target=new URL(input);
    if(target.pathname==='/config.json'){if(configFailure)throw new TypeError('synthetic network failure');return response(config);}
    if(target.pathname==='/auth/v1/oauth/token')return response({access_token:'synthetic-access',expires_in:3600});
    if(target.pathname==='/auth/v1/logout')return new Response(null,{status:204});
    if(target.pathname==='/functions/v1/synk-account')return response({ok:true,sessions:[]});
    assert.equal(target.pathname,'/functions/v1/synk-personal');if(options.method==='POST')serverWrites.push(JSON.parse(options.body));
    return response({ok:true,scope:'synk-personal',resource:'path-travel',accountId:'synthetic-owner',revision:0,updatedAt:null,state:travelAccountDocument(remote)});
   }})}});
 return {api,mount,content,visible:()=>visible,draft:()=>formDraft,navigated:()=>navigated,restored:()=>restored,serverWrites,
  click(action){const target=new Element();target.dataset.notebook=action;mount.listeners.get('click')({target});}};
}

test('real PKCE navigation and a new page instance retain unsaved guest trip/draft through login and logout without automatic import',async t=>{
 const cleanup=dom(t);const sessionStore=storage(),guestStore=storage(),guest=createTravelMemory();guest.query.budget=123456;const form=rawDraft();
 const first=await page({sessionStore,guestStore,memory:guest,inputDraft:form});assert.equal(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY),null);
 first.click('signin');await settle(()=>first.navigated());assert.ok(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY));
 const state=new URL(first.navigated()).searchParams.get('state');first.api.dispose();
 const second=await page({sessionStore,guestStore,href:url+'?code=fixture-code&state='+encodeURIComponent(state)});cleanup(second.api);
 await settle(()=>second.visible().query.budget===99999,()=>second.mount.querySelector('[data-notebook-detail]').textContent);assert.equal(second.api.active,true);assert.equal(second.restored(),1);assert.deepEqual(second.serverWrites,[]);
 assert.equal(guestStore.getItem(TRAVEL_STORAGE_KEY),null,'no permanent guest consent was created');
 second.click('signout');await settle(()=>!second.api.active);
 assert.deepEqual(second.visible(),guest);assert.deepEqual(second.draft(),form);assert.equal(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY),null);assert.deepEqual(second.serverWrites,[]);
});

test('OAuth denial restores guest on the callback page; a failed temporary save prevents navigation',async t=>{
 const cleanup=dom(t);const sessionStore=storage(),guestStore=storage(),guest=createTravelMemory();guest.query.budget=123456;const form=rawDraft();
 const first=await page({sessionStore,guestStore,memory:guest,inputDraft:form});first.click('signin');await settle(()=>first.navigated());
 const state=new URL(first.navigated()).searchParams.get('state');first.api.dispose();
 const denied=await page({sessionStore,guestStore,href:url+'?error=access_denied&state='+encodeURIComponent(state)});assert.equal(denied.api.active,false);assert.deepEqual(denied.visible(),guest);assert.deepEqual(denied.draft(),form);assert.equal(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY),null);denied.api.dispose();
 const blocked=await page({sessionStore:storage(),guestStore:storage(),memory:guest,inputDraft:form,refuseDraft:true});cleanup(blocked.api);blocked.click('signin');
 await settle(()=>blocked.mount.querySelector('[data-notebook-detail]').textContent.includes('파일'));
 assert.equal(blocked.navigated(),null);assert.deepEqual(blocked.visible(),guest);
});

test('consented guest with a stored itinerary retains consent through OAuth approval, logout and denial',async t=>{
 const cleanup=dom(t);
 for(const denied of [false,true]){
  const sessionStore=storage(),guestStore=storage(),base=createTravelMemory();
  const result=planTravel({...base.query,date:'2026-10-10'},{now:'2026-10-09T02:00:00.000Z',ask:false});
  assert.ok(result.primary);
  const guest=createTravelMemory({query:result.input,plan:result.primary});guest.consent=true;
  guestStore.setItem(TRAVEL_STORAGE_KEY,JSON.stringify(guest));const saved=guestStore.getItem(TRAVEL_STORAGE_KEY);
  const first=await page({sessionStore,guestStore,memory:guest});first.click('signin');await settle(()=>first.navigated());
  const state=new URL(first.navigated()).searchParams.get('state');first.api.dispose();
  const second=await page({sessionStore,guestStore,memory:JSON.parse(saved),href:url+(denied?'?error=access_denied':'?code=fixture-code')+'&state='+encodeURIComponent(state)});cleanup(second.api);
  if(!denied){await settle(()=>second.api.active);second.click('signout');await settle(()=>!second.api.active);}
  assert.equal(second.visible().consent,true);assert.deepEqual(second.visible().plan,guest.plan);
  assert.equal(guestStore.getItem(TRAVEL_STORAGE_KEY),saved,'login never rewrites the consented guest record');
 }
});

test('failed sign-in and bfcache return discard the handoff so a later reload cannot restore an older guest draft',async t=>{
 const cleanup=dom(t);
 const sessionStore=storage(),guestStore=storage(),guest=createTravelMemory();guest.query.budget=123456;
 const failed=await page({sessionStore,guestStore,memory:guest,inputDraft:rawDraft(),configFailure:true});cleanup(failed.api);
 failed.click('signin');await settle(()=>failed.mount.querySelector('[data-notebook-detail]').textContent.length>0);
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(failed.navigated(),null);assert.equal(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY),null);
 const first=await page({sessionStore,guestStore,memory:guest,inputDraft:rawDraft()});cleanup(first.api);
 first.click('signin');await settle(()=>first.navigated());assert.ok(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY));
 first.api.suspend();await first.api.resume();assert.equal(sessionStore.getItem(TRAVEL_LOGIN_DRAFT_KEY),null);
 const newer=structuredClone(guest);newer.query.budget=234567;
 const reload=await page({sessionStore,guestStore,memory:newer});cleanup(reload.api);
 assert.equal(reload.restored(),0);assert.equal(reload.visible().query.budget,234567);
});
