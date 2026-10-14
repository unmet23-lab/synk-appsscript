import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';
import { today } from './store.mjs';
import { shiftDate } from '../analytics.mjs';
import { request as httpRequest } from 'node:http';

async function fixture(t,collector,extra={}){
 const dir=await mkdtemp(join(tmpdir(),'synk-company-test-'));
 const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,collector,...extra});
 const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
 t.after(async()=>{await app.stop();await rm(dir,{recursive:true,force:true});});
 const admin=app.store.createUser({name:'Test Admin',email:'admin@example.test',password:'a-valid-test-password',role:'admin'});
 async function client(email='admin@example.test',password='a-valid-test-password'){
   let cookie='',csrf='';
   const request=async(path,body,overrides={})=>{const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':csrf}),Cookie:cookie,...overrides},...(body===undefined?{}:{body:JSON.stringify(body)})});const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];let data;try{data=await res.json();}catch{}if(data?.csrfToken)csrf=data.csrfToken;return{status:res.status,data,res};};
   if(email)assert.equal((await request('/api/login',{email,password})).status,200);
   return request;
 }
 return{app,base,dir,admin,client};
}
test('invite only signup, one use tokens, staff isolation and forged requests',async t=>{
 const {app,client}=await fixture(t);const a=await client();
 const invite=await a('/api/members/invite',{name:'Employee',email:'staff@example.test'});assert.equal(invite.status,201);
 const joinToken=new URL(invite.data.inviteUrl).hash.slice('#invite='.length);
 const m=await client(null);assert.equal((await m('/api/join',{token:joinToken,name:'Employee',password:'staff-valid-password'})).status,201);
 assert.equal((await m('/api/join',{token:joinToken,name:'x',password:'staff-valid-password'})).status,403);
 const ca=(await a('/api/channels',{urls:'https://www.youtube.com/@company'})).data.added[0];
 assert.equal((await m('/api/channels/'+ca.id+'/collect',{})).status,404);
 assert.equal((await m('/api/state')).data.channels.length,0);
 assert.equal((await m('/api/channels',{urls:'https://www.youtube.com/@company'})).data.errors.length,1);
 const mine=await m('/api/channels',{urls:'https://www.instagram.com/staffpage/',ownerId:app.store.all('users')[0].id});assert.equal(mine.data.added[0].owners[0].name,'Employee');
 assert.equal((await m('/api/settings',{hourKst:1,enabled:true})).status,403);
 assert.equal((await a('/api/channels',{urls:'https://youtube.com/@evil'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await a('/api/channels',{urls:'https://youtube.com/@evil'},{'X-CSRF-Token':'wrong'})).status,403);
});
test('bulk URL validation, duplicates, shared ownership and deactivation',async t=>{
 const {app,client}=await fixture(t);const a=await client();const u=app.store.createUser({email:'staff2@example.test',name:'Employee 2',password:'staff-valid-password'});
 const r=await a('/api/channels',{urls:'https://youtube.com/@hello\nhttps://www.youtube.com/@hello/\nhttp://127.0.0.1/private\nhttps://youtube.com.evil.test/@x'});
 assert.equal(r.data.added.length,1);assert.equal(r.data.existing.length,1);assert.equal(r.data.errors.length,2);
 const c=r.data.added[0];assert.equal((await a(`/api/channels/${c.id}/owners`,{userIds:[app.store.all('users')[0].id,u.id]})).status,200);
 const m=await client('staff2@example.test','staff-valid-password');assert.equal((await m('/api/state')).data.channels.length,1);
 assert.equal((await a('/api/analytics')).data.channels.length,1);
 await a(`/api/members/${u.id}/status`,{active:false});assert.equal((await m('/api/state')).status,401);
});
test('collector stores real zero/null, no first-observation growth, day drilldown and idempotency',async t=>{
 let views=100;const collect=async()=>({channel:{externalId:'channel1',displayName:'Channel One',followers:0,views:views},posts:[{externalId:'video1',url:'https://www.youtube.com/watch?v=video1',title:'One',publishedAt:'2026-01-01T00:00:00Z',metrics:{views,likes:0,comments:3,shares:null,saves:null,reach:null}}],coverage:{status:'complete',ownerAuthorized:false},warnings:[]});
 const {app,client}=await fixture(t,collect);const a=await client();const c=(await a('/api/channels',{urls:'https://youtube.com/@hello'})).data.added[0];
 await a(`/api/channels/${c.id}/connection`,{apiKey:'test-private-key'});
 await a(`/api/channels/${c.id}/collect`,{});await app.waitForIdle();
 let r=(await a('/api/day?date='+today())).data;assert.equal(r.byPost.length,1);assert.equal(r.metrics.views.latest,100);assert.equal(r.metrics.views.day.delta,null);assert.equal(r.metrics.likes.latest,0);assert.equal(r.metrics.shares.latest,null);
 const post=app.store.all('posts')[0],previous=shiftDate(today(),-1);app.store.put('snapshots','previous',{id:'previous',postId:post.id,date:previous,views:120,likes:0,comments:1,shares:null});
 views=110;await a(`/api/channels/${c.id}/collect`,{});await app.waitForIdle();
 r=(await a('/api/day?date='+today())).data;assert.equal(r.metrics.views.day.delta,-10);assert.equal(r.byPost[0].metrics.views.day.delta,-10);assert.equal(app.store.all('posts').length,1);assert.equal(app.store.all('snapshots').length,2);
 assert.equal((await a('/api/state')).data.channels[0].status,'success');
});
test('no secrets in state/database text; failed collection preserves last observation and reveals failure',async t=>{
 const {app,client,dir}=await fixture(t,async()=>{throw new Error('연결 권한이 만료됐습니다.');},{metaConnectionFetch:async raw=>{const path=new URL(raw).pathname;return new Response(JSON.stringify(path.endsWith('/me')?{id:'456',user_id:'123',username:'company'}:path.endsWith('/123/media')?{data:[{id:'789'}]}:path.endsWith('/789')?{id:'789',owner:{id:'456'}}:{data:[]}));}});const a=await client();const c=(await a('/api/channels',{urls:'https://instagram.com/company/'})).data.added[0];
 assert.equal((await a(`/api/channels/${c.id}/connection`,{accessToken:'super-secret-access-token',authType:'instagram-login',accountId:'123'})).status,200);
 const state=await a('/api/state');assert.ok(!JSON.stringify(state.data).includes('super-secret'));assert.ok(!JSON.stringify(app.store.all('users').map(u=>u.name)).includes('password'));
 const cipher=app.store.db.prepare('SELECT ciphertext FROM credentials').get().ciphertext;assert.ok(!cipher.includes('super-secret'));assert.equal(app.store.secret('channel:'+c.id).accessToken,'super-secret-access-token');
 await a(`/api/channels/${c.id}/collect`,{});await app.waitForIdle();assert.equal((await a('/api/state')).data.channels[0].status,'error');assert.equal(app.store.all('snapshots').length,0);
});
test('unauthenticated reads and unsafe hosts fail; empty ranges stay unknown',async t=>{
 const {app,base,client}=await fixture(t);assert.equal((await fetch(base+'/api/state')).status,401);
 const status=await new Promise((resolve,reject)=>{const req=httpRequest(base+'/api/state',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(status,403);
 const a=await client();const report=await a('/api/analytics');assert.equal(report.data.metrics.views.latest,null);assert.equal(report.data.overview.channelCount,0);assert.equal((await a('/api/analytics?start=2026-02-30&end=2026-03-01')).status,400);
});
test('disconnect during collection cannot restore deleted API data',async t=>{
 let release,started;const began=new Promise(r=>{started=r;});const hold=new Promise(r=>{release=r;});
 const {app,client}=await fixture(t,async()=>{started();await hold;return {channel:{externalId:'x'},posts:[],coverage:{status:'complete'},warnings:[]};});
 const a=await client();const c=(await a('/api/channels',{urls:'https://youtube.com/@example'})).data.added[0];await a(`/api/channels/${c.id}/connection`,{apiKey:'test-key'});
 await a(`/api/channels/${c.id}/collect`,{});await began;await a(`/api/channels/${c.id}/disconnect`,{});release();await app.waitForIdle();
 assert.equal(app.store.all('channelSnapshots').length,0);assert.equal(app.store.secret('channel:'+c.id),null);
});
