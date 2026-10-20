import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createCreativeResearchService} from './creative-research.mjs';
import {createStudioService} from './studio-service.mjs';
import {createResearchProductionService} from './research-production.mjs';

const at='2026-10-20T01:00:00.000Z';
export function researchReport({id='weekly-fixture',count=2,visibility='company'}={}){
  return {schemaVersion:1,reportId:id,date:'2026-10-20',provider:'codex',visibility,shareConfirmed:true,
    entries:Array.from({length:count},(_,n)=>({
      source:'facebook',kind:'reel',title:`공개 사례 ${n+1}`,sourceUrl:`https://www.facebook.com/reel/12345678901234${n}/`,checkedAt:at,
      research:{summary:'영상으로 확인한 짧은 학습 사례',whyNow:'이번 주 학습 질문과 이어지는 사례',viewerReason:'직접 따라 해보며 배운다',
        brands:['SYNK'],priority:'high',evidenceLevel:'video-watched',limitations:'표본 한 편이며 학습 효과는 검증하지 않았다',
        observedFacts:[{text:'첫 장면에 질문을 보여준다',sourceUrl:`https://www.facebook.com/reel/12345678901234${n}/`}],
        applications:[{brand:'SYNK',idea:`학습 제안 ${n+1}`,zeroSecondHook:'어떤 표현을 고를까요?',action:'표현을 선택한다',reward:'짧은 해설',personalizationTool:'선택에 따른 해설',validation72h:'게시 후 72시간 반응과 실제 사용을 확인한다'}],
        productionGuide:{formatName:'선택하고 확인하기',brandAdaptation:'학습자 상황을 반영한다',appeal:'선택과 짧은 해설',requiredAssets:['원문 근거','상황별 대사'],estimatedMinutes:30,
          productionSteps:[{order:1,title:'상황 준비',instruction:'학습자 상황과 질문을 준비한다'},{order:2,title:'시안 제작',instruction:'선택지와 해설을 제작한다'},{order:3,title:'사용 확인',instruction:'실제 크기에서 선택과 해설을 확인한다'}]},
      },
    }))};
}
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-research-production-')),store=new Store(directory);
  const users=Object.fromEntries(['owner','peer','viewer'].map(id=>[id,store.createUser({name:id,email:id+'@example.test',role:id==='viewer'?'viewer':'member'})]));
  const research=createCreativeResearchService({store,clock:()=>at}),studio=createStudioService({store,clock:()=>at});
  const service=createResearchProductionService({store,research,studio,clock:()=>at});
  t.after(async()=>{await research.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  return {store,research,studio,service,...users,
    load:(options)=>research.importReport(users.owner,researchReport(options)),
    input:()=>{const w=service.workspace(users.owner);return {revision:w.revision,items:w.candidates.map(c=>({entryId:c.entryId,applicationIndex:0}))};}};
}

test('selected evidence, assets, steps and validation are atomically saved in real productions; retry is idempotent',async t=>{
  const f=await fixture(t);f.load();const input=f.input(),result=f.service.create(f.owner,input);
  assert.equal(result.productions.length,2);assert.equal(f.store.all('studioProductions').length,2);
  for(const production of result.productions){
    assert.equal(production.stage,'idea');assert.equal(production.assigneeId,f.owner.id);
    assert.match(production.versions[0].text,/원문 근거[\s\S]*상황별 대사[\s\S]*상황 준비[\s\S]*72시간/);
    assert.match(production.versions[0].text,/facebook.com\/reel/);
  }
  assert.equal(f.service.workspace(f.owner).candidates.every(c=>c.usage.isMine),true);
  assert.equal(f.service.create(f.owner,input).existing,true);
  assert.equal(f.store.all('researchProductionLinks').length,2);
  assert.equal(f.store.all('studioProductions').length,2);
});

test('a bad second selection rolls back the first production, link, and every guide reservation',async t=>{
  const f=await fixture(t);f.load();const input=f.input();input.items[1].applicationIndex=100;
  assert.throws(()=>f.service.create(f.owner,input),e=>e.status===409);
  assert.equal(f.store.all('studioProductions').length,0);assert.equal(f.store.all('researchProductionLinks').length,0);
  assert.equal(f.service.workspace(f.owner).candidates.every(c=>c.usage.status==='available'),true);
});

test('a changed research revision or another worker reservation cannot silently select outdated work',async t=>{
  const f=await fixture(t);f.load();const input=f.input();
  f.research.claim(f.peer,input.items[0].entryId);
  assert.throws(()=>f.service.create(f.owner,input),e=>e.status===409);
  const latest=f.input();assert.throws(()=>f.service.create(f.owner,latest),e=>e.status===409);
  assert.equal(f.store.all('studioProductions').length,0);
});

test('private material, revoked viewers, and inactive users cannot produce or replay protected work',async t=>{
  const f=await fixture(t);f.load({visibility:'private'});
  assert.equal(f.service.workspace(f.owner).candidates.length,0);
  const rows=f.research.workspace(f.owner);
  assert.throws(()=>f.service.create(f.owner,{revision:rows.revision,items:rows.entries.map(r=>({entryId:r.id,applicationIndex:0}))}),e=>e.status===409);
  for(const row of rows.entries)f.research.update(f.owner,row.id,{visibility:'company',shareConfirmed:true});
  const input=f.input();f.service.create(f.owner,input);
  f.store.put('users',f.owner.id,{...f.owner,role:'viewer'});
  assert.throws(()=>f.service.create(f.owner,input),e=>e.status===403);
  f.store.put('users',f.owner.id,{...f.owner,active:false});
  assert.throws(()=>f.service.create(f.owner,input),e=>e.status===401);
});

test('partial retries reuse prior productions and only create the remaining selection',async t=>{
  const f=await fixture(t);f.load();const input=f.input();
  f.service.create(f.owner,{...input,items:[input.items[0]]});
  const result=f.service.create(f.owner,f.input());
  assert.equal(result.productions.length,2);assert.equal(f.store.all('studioProductions').length,2);
});

test('production creation rejects accidental duplicate selection, oversized batches, and replacing saved evidence',async t=>{
  const f=await fixture(t);f.load();const input=f.input();
  assert.throws(()=>f.service.create(f.owner,{...input,items:[input.items[0],input.items[0]]}),e=>e.status===400);
  assert.throws(()=>f.service.create(f.owner,{...input,items:Array(8).fill(input.items[0])}),e=>e.status===400);
  const production=f.service.create(f.owner,input).productions[0];
  assert.throws(()=>f.studio.saveProduction(f.owner,{initialBrief:'replace'},production.id),e=>e.status===400);
  assert.throws(()=>f.studio.saveProduction(f.owner,{title:'too long',initialBrief:'x'.repeat(60001)}),e=>e.status===400);
  assert.equal(f.store.all('studioProductions').length,2);
});
