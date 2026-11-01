import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

const at='2026-11-01T03:00:00.000Z';
async function fixture(t){
 const nativeFetch=globalThis.fetch;t.mock.method(globalThis,'fetch',(url,...args)=>{assert.equal(new URL(url).hostname,'127.0.0.1','No external requests in this fixture');return nativeFetch(url,...args);});
 const dir=await mkdtemp(join(tmpdir(),'synk-api-followup-')),app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,clock:()=>at});
 t.after(async()=>{await app.stop();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('synk-api-followup-'));await rm(dir,{recursive:true,force:true});});
 const user=app.store.createUser({name:'Synthetic owner',email:'owner@followup.test',role:'admin'}),session=app.store.mint('session',user.id,{csrfToken:'synthetic-csrf'},30),cookie='synk_company_session='+session;
 for(let n=0;n<10;n++)app.creativeResearch.add(user,{source:'facebook',kind:'reel',title:'Synthetic '+n,sourceUrl:'https://www.facebook.com/reel/'+(123456789012345+n)+'/',hook:'합성 자료 '.repeat(200)});
 await app.start();return {app,user,cookie,base:'http://127.0.0.1:'+app.server.address().port};
}
test('research HTTP compression preserves JSON, private-cache headers and identity negotiation',async t=>{
 const f=await fixture(t),plain=await fetch(f.base+'/api/creative-research',{headers:{Cookie:f.cookie,'Accept-Encoding':'identity'}}),expected=await plain.json();
 const zipped=await fetch(f.base+'/api/creative-research',{headers:{Cookie:f.cookie,'Accept-Encoding':'gzip'}});assert.equal(zipped.status,200);assert.equal(zipped.headers.get('content-encoding'),'gzip');assert.equal(zipped.headers.get('vary'),'Accept-Encoding');assert.equal(zipped.headers.get('cache-control'),'no-store');assert.ok(Number(zipped.headers.get('content-length'))<Buffer.byteLength(JSON.stringify(expected))/3);assert.deepEqual(await zipped.json(),expected);
 const refused=await fetch(f.base+'/api/creative-research',{headers:{Cookie:f.cookie,'Accept-Encoding':'gzip;q=0, *;q=1'}});assert.equal(refused.headers.get('content-encoding'),null);assert.deepEqual(await refused.json(),expected);
});
test('logout during asynchronous compression cannot return the previously authorized body',async t=>{
 const f=await fixture(t),original=f.app.creativeResearch.workspace;
 t.mock.method(f.app.creativeResearch,'workspace',(...args)=>{const result=original(...args);queueMicrotask(()=>f.app.store.revokeUser(f.user.id));return result;});
 const response=await fetch(f.base+'/api/creative-research',{headers:{Cookie:f.cookie,'Accept-Encoding':'gzip'}});assert.equal(response.status,401);assert.equal(response.headers.get('content-encoding'),null);assert.ok(!(await response.text()).includes('Synthetic'));
});
test('role changes during compression rebuild the body and remove admin-only sync fields',async t=>{
 const f=await fixture(t),original=f.app.creativeResearch.workspace;let changed=false;
 t.mock.method(f.app.creativeResearch,'workspace',(...args)=>{const result=original(...args);if(!changed){changed=true;queueMicrotask(()=>f.app.store.put('users',f.user.id,{...f.user,role:'viewer'}));}return result;});
 const response=await fetch(f.base+'/api/creative-research',{headers:{Cookie:f.cookie,'Accept-Encoding':'gzip'}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.canCreate,false);assert.ok(body.entries.every(row=>row.canEdit===false));assert.ok(!Object.hasOwn(body.automation.sync,'documentId'));
});
test('source access revoked during compression cannot leak the earlier entries',async t=>{
 const f=await fixture(t),{app,user}=f,channel={id:'synthetic-context',platform:'facebook',active:true,ownerIds:[user.id]};app.store.put('channels',channel.id,channel);
 for(const row of app.store.all('creativeResearchEntries'))app.store.put('creativeResearchEntries',row.id,{...row,channelId:channel.id});
 const original=app.creativeResearch.workspace;let changed=false;
 t.mock.method(app.creativeResearch,'workspace',(...args)=>{const result=original(...args);if(!changed){assert.equal(result.entries.length,10);changed=true;queueMicrotask(()=>app.store.put('channels',channel.id,{...channel,active:false}));}return result;});
 const response=await fetch(f.base+'/api/creative-research',{headers:{Cookie:f.cookie,'Accept-Encoding':'gzip'}});assert.equal(response.status,200);assert.deepEqual((await response.json()).entries,[]);
});
test('messenger HTTP summary wires scoped live receipt projection through the read scope',async t=>{
 const f=await fixture(t),{app,user}=f;let scoped=0;
 app.store.put('automationNotificationStates','synthetic-scoped',{id:'synthetic-scoped',ownerId:user.id,state:'resolved',issueId:'synthetic-issue',automationId:'performance'});
 const original=app.automationHealth.getForNotifications;
 t.mock.method(app.automationHealth,'get',()=>{throw Error('Full health must not run for performance-only receipts');});
 t.mock.method(app.automationHealth,'getForNotifications',(u,ids)=>{scoped++;assert.deepEqual(ids,['performance']);return original(u,ids);});
 const response=await fetch(f.base+'/api/workspace-summary',{headers:{Cookie:f.cookie}});assert.equal(response.status,200);assert.equal((await response.json()).messenger.notificationUnread,0);assert.equal(scoped,1);
});

test('messenger summary reuses SQL reads within one request without changing counts',async t=>{
 let reads=0;const original=DatabaseSync.prototype.prepare;
 t.mock.method(DatabaseSync.prototype,'prepare',function(sql){const statement=original.call(this,sql);if(/FROM documents/i.test(sql))for(const method of ['all','get']){const native=statement[method];statement[method]=function(...args){reads++;return native.apply(this,args);};}return statement;});
 const f=await fixture(t),{app,user}=f;
 app.store.put('channels','synthetic-channel',{id:'synthetic-channel',platform:'facebook',displayName:'Synthetic',canonicalUrl:'https://www.facebook.com/synthetic',active:true,ownerIds:[user.id],teamId:null,metadata:'Synthetic '.repeat(200)});
 const template=app.postPerformance.register(user,{channelId:'synthetic-channel',url:'https://www.facebook.com/reel/123456789012345/',publishedAt:'2026-10-30T00:00:00.000Z'}).entry;
 app.store.transaction(()=>{for(let n=0;n<100;n++){const id=createHash('sha256').update('synthetic-'+n).digest('hex');app.store.put('postPerformanceEntries',id,{...template,id});}});
 app.store.put('automationNotificationStates','synthetic-trigger',{id:'synthetic-trigger',ownerId:user.id,state:'active',issueId:'synthetic-issue',automationId:'performance'});
 reads=0;const expected=app.messenger.summary({headers:{cookie:f.cookie}}),before=reads;
 reads=0;const response=await fetch(f.base+'/api/workspace-summary',{headers:{Cookie:f.cookie}}),actual=await response.json(),after=reads;
 assert.equal(response.status,200);assert.deepEqual(actual.messenger,expected);assert.ok(before>300,'Fixture must exercise repeated health source reads');assert.ok(after<before/2,`SQL reads ${before} -> ${after}`);t.diagnostic(JSON.stringify({before,after}));
});
