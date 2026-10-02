import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {hash} from './store.mjs';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'synk-handoff-'));
 const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,collector:async()=>({channel:{externalId:'real-channel',displayName:'Channel',followers:10},posts:[],coverage:{status:'complete',ownerAuthorized:true},warnings:[]})});
 const addr=await app.start(),base=`http://127.0.0.1:${addr.port}`;
 t.after(async()=>{await app.stop();await rm(dir,{recursive:true,force:true});});
 const admin=app.store.createUser({name:'Admin',email:'admin@example.test',role:'admin'}),old=app.store.createUser({name:'Old',email:'old@example.test'}),next=app.store.createUser({name:'New',email:'new@example.test'});
 const sessions=new Map([admin,old,next].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'csrf'},10)]));
 const nativeFetch=globalThis.fetch;
 const call=async(user,path,body)=>{const r=await nativeFetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:`synk_company_session=${sessions.get(user.id)}`,Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'csrf'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 const c=(await call(admin,'/api/channels',{urls:'https://youtube.com/@handoff',ownerId:old.id})).data.added[0];
 app.store.setSecret('channel:'+c.id,{accessToken:'old-test-token',connectedBy:old.id});
 app.store.setSecret('provider:youtube',{clientId:'test-client',clientSecret:'test-secret'});
 app.store.put('channelSnapshots','preserved',{id:'preserved',channelId:c.id,date:'2026-01-01',followers:5,source:'api:youtube'});
 const callback=()=>{const state=app.store.mint('oauth',next.id,{channelId:c.id,sessionHash:hash(sessions.get(next.id)),platform:'youtube'},10);return nativeFetch(base+`/api/oauth/youtube/callback?state=${state}&code=test-code`,{headers:{Cookie:`synk_company_session=${sessions.get(next.id)}`},redirect:'manual'});};
 return{app,admin,old,next,call,c,callback,nativeFetch};
}
test('handoff keeps history and old access until the incoming owner connects, then commits atomically',async t=>{
 const f=await fixture(t);const {app,admin,old,next,call,c,callback}=f;
 const proposed=await call(admin,`/api/channels/${c.id}/owners`,{userIds:[next.id],reason:'Team handover'});assert.equal(proposed.data.requiresReconnect,true);
 assert.deepEqual(app.store.get('channels',c.id).ownerIds,[old.id]);assert.ok(app.store.get('channelSnapshots','preserved'));
 const incoming=(await call(next,'/api/state')).data.channels[0];assert.equal(incoming.canConnect,true);assert.equal(incoming.canEdit,false);
 assert.equal((await call(next,`/api/channels/${c.id}/collect`,{})).status,404);
 t.mock.method(globalThis,'fetch',async(url,options)=>String(url)==='https://oauth2.googleapis.com/token'?{ok:true,status:200,json:async()=>({access_token:'new-test-token',expires_in:3600})}:f.nativeFetch(url,options));
 const response=await callback();assert.match(response.headers.get('location'),/^\/\?connected=/);
 assert.deepEqual(app.store.get('channels',c.id).ownerIds,[next.id]);assert.equal(app.store.secret('channel:'+c.id).connectedBy,next.id);assert.ok(app.store.get('channelSnapshots','preserved'));
 assert.equal(app.store.all('handoffs')[0].status,'completed');assert.equal((await call(old,'/api/state')).data.channels.length,0);
 const history=(await call(next,`/api/channels/${c.id}/history`)).data;assert.equal(history.events.length,2);assert.deepEqual(history.events[1].beforeOwnerIds,[old.id]);assert.deepEqual(history.events[1].afterOwnerIds,[next.id]);
});
test('cancelling an in-flight incoming authorization keeps old credentials and assignment',async t=>{
 const f=await fixture(t);const {app,admin,old,next,call,c,callback}=f;let release,began;
 const held=new Promise(r=>release=r),started=new Promise(r=>began=r);t.after(()=>release());
 await call(admin,`/api/channels/${c.id}/owners`,{userIds:[next.id]});
 t.mock.method(globalThis,'fetch',async(url,options)=>{if(String(url)==='https://oauth2.googleapis.com/token'){began();await held;return{ok:true,status:200,json:async()=>({access_token:'new-test-token',expires_in:3600})};}return f.nativeFetch(url,options);});
 const pending=callback();await started;await call(admin,`/api/channels/${c.id}/handoff/cancel`,{});release();const response=await pending;
 assert.match(response.headers.get('location'),/^\/\?connectionError=/);assert.deepEqual(app.store.get('channels',c.id).ownerIds,[old.id]);assert.equal(app.store.secret('channel:'+c.id).connectedBy,old.id);assert.ok(app.store.get('channelSnapshots','preserved'));
});
test('a manager connection outside the owner list also requires the new owner to reconnect',async t=>{
 const {app,admin,old,next,call,c}=await fixture(t);
 app.store.setSecret('channel:'+c.id,{accessToken:'manager-test-token',connectedBy:admin.id});
 const unchanged=await call(admin,`/api/channels/${c.id}/owners`,{userIds:[old.id]});assert.equal(unchanged.data.requiresReconnect,false);
 const changed=await call(admin,`/api/channels/${c.id}/owners`,{userIds:[next.id]});assert.equal(changed.data.requiresReconnect,true);
 assert.deepEqual(app.store.get('channels',c.id).ownerIds,[old.id]);assert.equal(app.store.secret('channel:'+c.id).connectedBy,admin.id);
});
