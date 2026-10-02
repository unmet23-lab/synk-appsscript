import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {workroomGuide,workroomSource} from './workroom-guide.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-workroom-test-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false}),address=await app.start(),base=`http://127.0.0.1:${address.port}`,users={},cookies={};
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  for(const role of ['admin','member','viewer']){const user=app.store.createUser({name:role,email:role+'@example.test',role});users[role]=user;cookies[role]=`synk_company_session=${app.store.mint('session',user.id,{csrfToken:'fixture'},10)}`;}
  const request=async(role,path,body,csrf='fixture')=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(role?{Cookie:cookies[role]}:{}),Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};};
  return{app,users,cookies,request};
}
test('workroom guidance uses the existing ten series and fourteen readable canonical sources without exposing arbitrary files',()=>{
  const guide=workroomGuide('2026-10-01T12:00:00Z');assert.equal(guide.tips.length,18);assert.equal(guide.series.length,10);assert.equal(guide.sources.length,14);assert.equal(guide.review.length,9);
  for(const source of guide.sources)assert.ok(workroomSource(source.id).text.trim());
  for(const id of ['../store.mjs','../../data/encryption.key','file:///C:/secret','unknown'])assert.throws(()=>workroomSource(id),error=>error.status===404);
  assert.equal(guide.trendNotes[0].needsRefresh,false);assert.equal(workroomGuide('2026-10-10T12:00:00Z').trendNotes[0].needsRefresh,true);
});
test('all active crews can read guidance; unauthenticated and revoked accounts cannot read canonical source text',async t=>{
  const f=await fixture(t);assert.equal((await f.request(null,'/api/workroom-guide')).status,401);
  for(const role of ['admin','member','viewer']){const result=await f.request(role,'/api/workroom-guide');assert.equal(result.status,200);assert.equal(result.body.series.length,10);assert.equal((await f.request(role,'/api/workroom-source/common')).status,200);}
  assert.equal((await f.request('member','/api/workroom-source/unknown')).status,404);
  f.app.store.put('users',f.users.member.id,{...f.users.member,active:false});assert.equal((await f.request('member','/api/workroom-source/common')).status,401);
});
test('an unassigned employee registers multiple platforms under their own ownership and preserves duplicate ownership',async t=>{
  const f=await fixture(t),urls=['instagram.com/employee.one/?utm_source=test','https://www.facebook.com/employee-page','https://www.tiktok.com/@employee.one','https://www.youtube.com/@employee-one'];
  const result=await f.request('member','/api/channels',{urls,ownerId:f.users.admin.id});assert.equal(result.status,201);assert.equal(result.body.added.length,4);assert.equal(result.body.errors.length,0);
  for(const channel of result.body.added){assert.deepEqual(channel.ownerIds,[f.users.member.id]);assert.equal(channel.teamId,null);assert.equal(channel.connected,false);assert.ok(channel.canConnect);}
  assert.deepEqual(result.body.added.map(row=>row.platform),['instagram','facebook','tiktok','youtube']);assert.equal(result.body.added[0].canonicalUrl,'https://www.instagram.com/employee.one/');
  const again=await f.request('admin','/api/channels',{urls:[urls[0]],ownerId:f.users.admin.id});assert.equal(again.body.added.length,0);assert.deepEqual(again.body.existing[0].ownerIds,[f.users.member.id]);
  const own=await f.request('member','/api/state');assert.equal(own.body.channels.length,4);assert.ok(own.body.channels.every(row=>row.ownerIds.includes(f.users.member.id)));
});
test('page registration keeps CSRF and viewer write limits and rejects local, unsafe and post URLs without making channels',async t=>{
  const f=await fixture(t);assert.equal((await f.request('viewer','/api/channels',{urls:['instagram.com/reader']})).status,403);assert.equal((await f.request('member','/api/channels',{urls:['instagram.com/crew']},'bad')).status,403);
  const result=await f.request('member','/api/channels',{urls:['http://127.0.0.1/private','javascript:alert(1)','https://instagram.com/p/postid','https://instagram.com.evil.test/user']});assert.equal(result.body.added.length,0);assert.equal(result.body.errors.length,4);assert.equal(f.app.store.all('channels').length,0);
});
