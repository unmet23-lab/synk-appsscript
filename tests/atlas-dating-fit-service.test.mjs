import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';

const ids=['fit-region:a','fit-region:b'];
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-fit-region-'));
  let now=Date.parse('2026-10-10T03:00:00.000Z');
  const server=createDatingServer({mode:'account',databasePath:path.join(dir,'account.sqlite'),verify:async accountId=>ids.includes(accountId)?{accountId}:null,clock:()=>new Date(now)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-fit-region-'));await fs.rm(dir,{recursive:true,force:true});});
  async function request(route,index,body){
    const response=await fetch(origin+'/api/atlas-dating'+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${ids[index]}`,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json()};
  }
  const state=async index=>{const result=await request('/state',index);assert.equal(result.status,200);return result.body.view;};
  const rawAction=async(index,action)=>request('/action',index,{requestId:randomUUID(),expectedRevision:(await state(index)).revision,action});
  const action=async(index,value)=>{const result=await rawAction(index,value);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;};
  async function seed(index,{publicRegions,privateRegions}={}){
    await action(index,{kind:'profile',profile:{nickname:`지역 검사 가상${index}`,region:'서울 강남이라는 자유 소개',intro:'로컬 합성 기록',values:{availability:'weekend',...(publicRegions?{'self.meetingRegions':publicRegions}:{})},required:[]}});
    await action(index,{kind:'adult',declared:true});
    await action(index,{kind:'consents',consents:{profilePublic:true,receiveInvitations:true,storePreferences:true}});
    await action(index,{kind:'discovery',action:{kind:'set',field:'consent',value:true}});
    await action(index,{kind:'discovery',action:{kind:'set',field:'availability',value:'weekend'}});
    if(privateRegions)await action(index,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:privateRegions,target:'baseline'}});
  }
  return {request,state,rawAction,action,seed,advance:milliseconds=>{now+=milliseconds;}};
}

test('region profile rejects empty duplicate oversized and free-text arrays without changing private or public state',async t=>{
  const f=await fixture(t);await f.seed(0);await f.seed(1);
  const before=await f.state(0);
  for(const values of [[],['busan','busan'],['서울 강남'],['seoul-center','busan','daegu','incheon','gwangju','daejeon','ulsan']]){
    const result=await f.rawAction(0,{kind:'profile',profile:{...before.profile,values:{...before.profile.values,'self.meetingRegions':values}}});assert.equal(result.status,400);
    assert.deepEqual((await f.state(0)).profile,before.profile);
  }
  assert.equal((await f.state(0)).discovery.fields.find(field=>field.id==='self.meetingRegions').value,null);
});

test('private region declaration and explicit baseline publication stay separate without enabling disclosure or invitations',async t=>{
  const f=await fixture(t);await f.seed(0,{privateRegions:['busan','seoul-center']});await f.seed(1);
  let own=await f.state(0);assert.equal(Object.hasOwn(own.profile.values,'self.meetingRegions'),false);
  assert.deepEqual(own.discovery.fields.find(field=>field.id==='self.meetingRegions').value,['seoul-center','busan']);
  await f.action(0,{kind:'consents',consents:{profilePublic:false,receiveInvitations:false,storePreferences:true}});
  await f.action(0,{kind:'publish-baseline',fields:['self.meetingRegions']});own=await f.state(0);
  assert.deepEqual(own.profile.values['self.meetingRegions'],['seoul-center','busan']);assert.equal(own.consents.profilePublic,false);assert.equal(own.consents.receiveInvitations,false);
  assert.equal((await f.state(1)).candidates.some(candidate=>candidate.accountId===ids[0]),false);
});

test('new introduction checks both private-to-current-public region directions without exposing the recipient private region',async t=>{
  const f=await fixture(t);await f.seed(0,{publicRegions:['seoul-center'],privateRegions:['seoul-center','busan']});await f.seed(1,{publicRegions:['seoul-center'],privateRegions:['busan']});
  const own=await f.state(0), candidate=own.discovery.candidates.find(candidate=>candidate.id===ids[1]);
  assert.equal(candidate.status,'eligible');assert.equal(candidate.canConnect,false);
  assert.deepEqual(own.candidates.find(candidate=>candidate.accountId===ids[1]).values['self.meetingRegions'],['seoul-center']);
  assert.equal(JSON.stringify(candidate).includes('부산'),false);
  const rejected=await f.rawAction(0,{kind:'connect',targetAccountId:ids[1]});assert.equal(rejected.status,403);assert.equal((await f.state(0)).pairs.length,0);
  await f.action(1,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:['seoul-center'],target:'baseline'}});
  assert.equal((await f.state(0)).discovery.candidates.find(candidate=>candidate.id===ids[1]).canConnect,true);
  const sent=await f.action(0,{kind:'connect',targetAccountId:ids[1]});assert.ok(sent.result.introductionId);
});

test('pending acceptance rechecks current regions while direct rejection remains available',async t=>{
  const f=await fixture(t);for(let index=0;index<2;index++)await f.seed(index,{publicRegions:['seoul-center'],privateRegions:['seoul-center']});
  const sent=await f.action(0,{kind:'connect',targetAccountId:ids[1]});
  await f.action(1,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:['busan'],target:'baseline'}});
  let pair=(await f.state(1)).pairs.find(pair=>pair.pairId===sent.result.pairId);assert.equal(pair.introduction.canRespond,false);assert.equal(pair.introduction.canDecline,true);
  const rejectAccept=await f.rawAction(1,{kind:'introduction',pairId:pair.pairId,expectedIntroductionRevision:pair.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});assert.equal(rejectAccept.status,403);
  pair=(await f.state(1)).pairs.find(pair=>pair.pairId===sent.result.pairId);
  await f.action(1,{kind:'introduction',pairId:pair.pairId,expectedIntroductionRevision:pair.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'decline'}});
  assert.equal((await f.state(1)).pairs.find(item=>item.pairId===sent.result.pairId)?.introduction.accepted,false);
});

test('a completed acceptance is not retroactively cancelled when the next recommendation region changes',async t=>{
  const f=await fixture(t);for(let index=0;index<2;index++)await f.seed(index,{publicRegions:['seoul-center'],privateRegions:['seoul-center']});
  const sent=await f.action(0,{kind:'connect',targetAccountId:ids[1]});let pair=(await f.state(1)).pairs.find(pair=>pair.pairId===sent.result.pairId);
  await f.action(1,{kind:'introduction',pairId:pair.pairId,expectedIntroductionRevision:pair.introduction.revision,action:{kind:'respond',introductionId:sent.result.introductionId,value:'accept'}});
  await f.action(1,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:['busan'],target:'baseline'}});
  pair=(await f.state(1)).pairs.find(pair=>pair.pairId===sent.result.pairId);assert.equal(pair.introduction.accepted,true);assert.equal(pair.status,'active');
});

test('exact private region expiry blocks a new introduction without copying an expired answer from public profile',async t=>{
  const f=await fixture(t);for(let index=0;index<2;index++)await f.seed(index,{publicRegions:['seoul-center'],privateRegions:['seoul-center']});
  await f.action(1,{kind:'discovery',action:{kind:'set',field:'self.meetingRegions',value:['seoul-center'],target:'baseline',until:'2026-10-10T03:01:00.000Z'}});
  assert.equal((await f.state(0)).discovery.candidates.find(candidate=>candidate.id===ids[1]).canConnect,true);
  f.advance(60000);assert.equal((await f.state(0)).discovery.candidates.find(candidate=>candidate.id===ids[1]).canConnect,false);
  assert.equal((await f.state(1)).discovery.fields.find(field=>field.id==='self.meetingRegions').value,null);
  assert.equal((await f.rawAction(0,{kind:'connect',targetAccountId:ids[1]})).status,403);
});
