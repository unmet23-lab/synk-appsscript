import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
async function fixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synk-conditional-service-')),filename=path.join(dir,'demo.sqlite');
  let store,service,server,origin,time=Date.parse('2026-10-07T03:00:00.000Z'),a,b;
  const start=async()=>{store=createDatingStore({path:filename,mode:'demo'});service=createDatingService({store,clock:()=>time});server=http.createServer((req,res)=>service.handle(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;};
  const close=async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));service.close();store.close();};
  await start();t.after(close);
  const call=async(route,token,json)=>{const response=await fetch(origin+'/api/atlas-dating'+route,{method:json?'POST':'GET',headers:{Origin:origin,...(token?{Authorization:`Bearer ${token}`} :{}),...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:{})});return{status:response.status,...await response.json()};};
  const login=async role=>(await call('/demo/session',null,{role})).token;
  const get=async token=>{const r=await call('/state',token);assert.equal(r.status,200);return r.view;};
  const act=async(token,action)=>call('/action',token,{requestId:randomUUID(),expectedRevision:(await get(token)).revision,action});
  const ok=async(token,action)=>{const r=await act(token,action);assert.equal(r.status,200,JSON.stringify(r));return r;};
  const preview=async(token,action)=>call('/preview',token,{expectedRevision:(await get(token)).revision,action});
  const apply=async(token,p)=>ok(token,{kind:'apply-preview',preview:p.preview.token});
  a=await login('sample-1');b=await login('sample-3');
  for(let i=0;i<18;i++){const q=(await get(a)).discovery.question;if(!q||q.optional)break;const values={consent:true,availability:'weekend','self.pace':'lead','self.plan':'planned'};await ok(a,{kind:'discovery',action:{kind:'set',field:q.field,value:values[q.field]??q.options[0].value,target:'baseline'}});}
  await ok(a,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',target:'baseline'}});
  const profile=(await get(b)).profile;await ok(b,{kind:'profile',profile:{...profile,values:{...profile.values,'self.contact':'few-days','self.notice':'advance'}}});
  const rule={kind:'conditional-set',ruleId:'contact-with-notice',target:'baseline'};
  return{call,get,act,ok,preview,apply,rule,get a(){return a;},get b(){return b;},advance:milliseconds=>{time+=milliseconds;},restart:async()=>{await close();await start();a=await login('sample-1');b=await login('sample-3');}};
}
test('only explicit preview application persists the private rule and server restart preserves it',async t=>{
  const f=await fixture(t), before=await f.get(f.a),p=await f.preview(f.a,f.rule);assert.equal(p.status,200);
  assert.equal((await f.get(f.a)).revision,before.revision);assert.equal((await f.get(f.a)).discovery.conditionalPreference.effective.status,'none');
  assert.ok(p.preview.changes.some(c=>c.field==='conditional.contact'));await f.apply(f.a,p);
  let v=await f.get(f.a);assert.equal(v.discovery.conditionalPreference.effective.status,'active');assert.deepEqual(v.profile,before.profile);
  assert.equal(v.discovery.fields.find(x=>x.id==='wants.contact').value,'daily');
  const peer=await f.get(f.b);assert.equal(peer.discovery.conditionalPreference.effective.status,'none');
  const disclosed=peer.candidates.find(person=>person.accountId==='demo:sample-1');
  assert.equal(disclosed.conditionalPreference,undefined);assert.equal(disclosed.discovery,undefined);
  assert.equal(disclosed.values['wants.contact'],'any');
  await f.restart();assert.equal((await f.get(f.a)).discovery.conditionalPreference.effective.status,'active');
});
test('public condition changes invalidate a reviewed preview and withdrawn notice cannot earn conditional credit',async t=>{
  const f=await fixture(t),p=await f.preview(f.a,f.rule),peer=await f.get(f.b),values={...peer.profile.values};delete values['self.notice'];
  await f.ok(f.b,{kind:'profile',profile:{...peer.profile,values}});
  const stale=await f.act(f.a,{kind:'apply-preview',preview:p.preview.token});assert.equal(stale.status,409);assert.equal(stale.error.code,'preview-stale');
  const fresh=await f.preview(f.a,f.rule);await f.apply(f.a,fresh);const v=await f.get(f.a),reason=v.discovery.candidates.find(c=>c.id==='demo:sample-3').reasonDetails.find(r=>r.owner==='self'&&r.field==='wants.contact');
  assert.equal(reason.comparison,'different');assert.equal(reason.conditionStatus,'unknown');
});
test('direct writes and forged rule content are rejected; hard primary criterion remains strict',async t=>{
  const f=await fixture(t),before=(await f.get(f.a)).revision;
  assert.equal((await f.act(f.a,{kind:'discovery',action:f.rule})).status,400);assert.equal((await f.get(f.a)).revision,before);
  assert.equal((await f.preview(f.a,{...f.rule,rule:{primary:'few-days'}})).status,400);
  await f.apply(f.a,await f.preview(f.a,f.rule));await f.ok(f.a,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',target:'baseline',required:true}});
  let v=await f.get(f.a);assert.equal(v.discovery.conditionalPreference.effective.status,'inactive');assert.equal(v.discovery.candidates.find(c=>c.id==='demo:sample-3').status,'excluded');
  assert.equal((await f.preview(f.a,f.rule)).status,400);
  await f.ok(f.a,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',target:'baseline',required:false}});
  assert.equal((await f.get(f.a)).discovery.conditionalPreference.effective.status,'inactive');
});
test('a source deadline during preview invalidates application and storage withdrawal erases rule events',async t=>{
  const f=await fixture(t);await f.ok(f.a,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',target:'baseline',until:'2026-10-07T03:02:00.000Z'}});
  const p=await f.preview(f.a,f.rule);assert.equal(p.status,200);f.advance(3*60000);
  const stale=await f.act(f.a,{kind:'apply-preview',preview:p.preview.token});assert.equal(stale.status,409);
  const v=await f.get(f.a);await f.ok(f.a,{kind:'consents',consents:{...v.consents,storePreferences:false}});
  const cleared=await f.get(f.a);assert.equal(cleared.discovery,null);assert.equal(cleared.conditionalPreference,undefined);
});
test('explicit rule withdrawal uses its own preview and leaves the primary declaration untouched',async t=>{
  const f=await fixture(t);await f.apply(f.a,await f.preview(f.a,f.rule));const before=await f.get(f.a);
  const p=await f.preview(f.a,{kind:'conditional-clear',target:'baseline'});assert.equal((await f.get(f.a)).revision,before.revision);
  await f.apply(f.a,p);const after=await f.get(f.a);assert.equal(after.discovery.conditionalPreference.effective.status,'none');
  assert.equal(after.discovery.fields.find(x=>x.id==='wants.contact').value,'daily');assert.deepEqual(after.profile,before.profile);
});

test('withdrawing the shadowed baseline allowance is explained even when the current context and candidate order stay unchanged',async t=>{
  const f=await fixture(t);await f.apply(f.a,await f.preview(f.a,f.rule));
  await f.apply(f.a,await f.preview(f.a,{...f.rule,target:'context'}));
  const before=await f.get(f.a),p=await f.preview(f.a,{kind:'conditional-clear',target:'baseline'});
  assert.equal(p.status,200);assert.deepEqual(p.preview.after.eligibleIds,p.preview.before.eligibleIds);
  assert.equal(p.preview.after.topCandidateId,p.preview.before.topCandidateId);
  const change=p.preview.changes.find(c=>c.field==='conditional.contact');assert.ok(change);
  assert.match(change.before,/평소 허용\(앞으로도\): 사용 가능/);
  assert.match(change.after,/평소 허용\(앞으로도\): 없음/);
  for(const text of [change.before,change.after]) {
    assert.match(text,/이번 허용\(이번 추천에서만\): 사용 가능/);
    assert.match(text,/현재 비교: 이번 허용 사용/);
  }
  assert.match(change.after,/현재 사용하는 허용 조건은 그대로/);assert.match(change.after,/원래 연락 답은 바뀌지 않아요/);
  assert.equal((await f.get(f.a)).revision,before.revision);
  await f.apply(f.a,p);const after=await f.get(f.a);assert.deepEqual(after.profile,before.profile);
  assert.equal(after.discovery.fields.find(x=>x.id==='wants.contact').value,'daily');
  assert.equal(after.discovery.conditionalPreference.baseline.status,'none');assert.equal(after.discovery.conditionalPreference.context.status,'active');
  await f.ok(f.a,{kind:'discovery',action:{kind:'start-context'}});
  assert.equal((await f.get(f.a)).discovery.conditionalPreference.effective.status,'none');
});

test('a valid allowance deadline change is visible in Korea time and expiry is explained before withdrawal',async t=>{
  const f=await fixture(t);await f.apply(f.a,await f.preview(f.a,{...f.rule,until:'2026-10-07T03:04:00.000Z'}));
  const p=await f.preview(f.a,{...f.rule,until:'2026-10-07T03:03:00.000Z'});
  const change=p.preview.changes.find(c=>c.field==='conditional.contact');assert.ok(change);
  assert.match(change.before,/12:04:00 \(한국 시간\)까지 · 허용 조건 기한/);
  assert.match(change.after,/12:03:00 \(한국 시간\)까지 · 허용 조건 기한/);
  assert.doesNotMatch(change.after,/T03:03/);assert.match(change.after,/원래 연락 답은 바뀌지 않아요/);
  await f.apply(f.a,p);f.advance(4*60000);
  const clear=await f.preview(f.a,{kind:'conditional-clear',target:'baseline'});
  const expired=clear.preview.changes.find(c=>c.field==='conditional.contact');
  assert.match(expired.before,/허용 기한이 지나 사용 안 함/);assert.match(expired.after,/평소 허용\(앞으로도\): 없음/);
});

test('caption reports source and context deadline limits even when the allowance has no separate deadline',async t=>{
  const f=await fixture(t);
  await f.ok(f.a,{kind:'discovery',action:{kind:'set',field:'wants.contact',value:'daily',target:'baseline',until:'2026-10-07T03:05:00.000Z'}});
  const baseline=await f.preview(f.a,f.rule);
  assert.match(baseline.preview.changes.find(c=>c.field==='conditional.contact').after,/12:05:00 \(한국 시간\)까지 · 원래 연락 답 기한/);
  await f.apply(f.a,baseline);
  await f.ok(f.a,{kind:'discovery',action:{kind:'start-context',expiresAt:'2026-10-07T03:03:00.000Z'}});
  const p=await f.preview(f.a,{...f.rule,target:'context'}),change=p.preview.changes.find(c=>c.field==='conditional.contact');
  assert.match(change.after,/평소 허용\(앞으로도\): 사용 가능, .*12:05:00 \(한국 시간\)까지 · 원래 연락 답 기한/);
  assert.match(change.after,/이번 허용\(이번 추천에서만\): 사용 가능, .*12:03:00 \(한국 시간\)까지 · 이번 회차 기한/);
  assert.match(change.after,/회차가 먼저 끝나면 함께 종료/);
});

test('reconfirming the original answer explains source invalidation instead of implying the saved allowance is still active',async t=>{
  const f=await fixture(t);await f.apply(f.a,await f.preview(f.a,f.rule));
  const p=await f.preview(f.a,{kind:'set',field:'wants.contact',value:'daily',target:'baseline'});
  const change=p.preview.changes.find(c=>c.field==='conditional.contact');assert.ok(change);
  assert.match(change.before,/평소 허용\(앞으로도\): 사용 가능/);
  assert.match(change.after,/원래 답을 다시 확인하거나 바꾸어 사용 안 함/);
  assert.match(change.after,/현재 비교: 조건부 허용 없이 원래 연락 기준으로 비교/);
  assert.match(change.after,/원래 연락 답은 바뀌지 않아요/);
  await f.apply(f.a,p);assert.equal((await f.get(f.a)).discovery.conditionalPreference.effective.status,'inactive');
});
