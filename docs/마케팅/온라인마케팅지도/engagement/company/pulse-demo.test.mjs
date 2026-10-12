import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDemoSession,DEMO_STORAGE_KEY} from './public/pulse-app/demo.mjs';

function storage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
function setup(store=storage()){let tick=0;return {store,demo:createDemoSession({storage:store,clock:()=>new Date(Date.UTC(2026,9,11,14,0,tick++)).toISOString()})};}
const project=demo=>demo.snapshot().project;
const post=(demo,path,body)=>demo.request(path,{body:{...body,revision:project(demo).revision}});
const studio=(demo,body)=>post(demo,'/pulse/api/studio',body);
const action=(demo,body)=>post(demo,'/pulse/api/action',body);
async function throughScenes(demo){
  await studio(demo,{action:'save_preferences',preferences:{...project(demo).studio.preferences,mood:'따뜻한, 차분한'}});
  await studio(demo,{action:'confirm_strategy',strategyRevision:project(demo).studio.strategy.revision});
  const concept=project(demo).studio.concepts[0];await studio(demo,{action:'select_concept',conceptId:concept.id,conceptRevision:concept.revision,text:'이 분위기가 좋아요.'});
  for(const [index,scene]of project(demo).studio.scenes.entries())await studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:index===0?'changes':'confirmed',text:index===0?'문구를 잘 보이게 해 주세요.':''});
}

test('seed uses fictional planning, local media and no pre-recorded customer choices',()=>{
  const {demo}=setup(),p=project(demo),s=p.studio;
  assert.equal(demo.guide().action,'taste');assert.equal(p.stage,'planning');assert.equal(s.references.length,3);assert.equal(s.concepts.length,2);assert.equal(s.scenes.length,4);assert.equal(s.scenes.reduce((n,s)=>n+s.duration,0),15);
  assert.equal(s.strategy.data.aspectRatio,'16:9');assert.equal(s.strategy.request.strategyRevision,1);assert.equal(s.strategy.confirmation,null);assert.equal(s.selectedConcept,null);assert.equal(s.sceneReviews.length,0);assert.equal(p.versions.length,0);
  assert.match(p.terms,/실제 발주/);assert.match(s.strategy.data.voice,/무음/);assert.equal(s.strategy.data.budgetProduction,null);assert.equal(s.strategy.data.budgetMedia,null);
  assert.ok(s.assets.every(a=>a.url.startsWith('/pulse-app/demo-assets/')));
});

test('full customer flow preserves time/version feedback and explicit approval before delivery',async()=>{
  const {demo,store}=setup();await throughScenes(demo);assert.equal(demo.guide().action,'publish_preview');demo.advance();
  const v1=project(demo).versions.at(-1);assert.equal(v1.media.url,'/pulse-app/demo-assets/preview-v1.mp4');assert.equal(demo.guide().action,'feedback');
  await action(demo,{action:'feedback',versionId:v1.id,seconds:12.4,text:'마지막 행동 문구를 더 크게 보여 주세요.'});
  let feedback=project(demo).messages.find(m=>m.action==='feedback');assert.equal(feedback.seconds,12.4);assert.equal(feedback.versionId,v1.id);assert.equal(feedback.resolved,false);
  await assert.rejects(action(demo,{action:'approve',versionId:v1.id}),{status:409});assert.equal(demo.guide().action,'publish_correction');demo.advance();
  const v2=project(demo).versions.at(-1);assert.equal(v2.media.url,'/pulse-app/demo-assets/preview-v2.mp4');assert.notEqual(v1.id,v2.id);assert.equal(project(demo).messages.find(m=>m.id===feedback.id).resolved,false);assert.match(project(demo).messages.at(-1).text,/자동 반영한 결과는 아닙니다/);
  await assert.rejects(action(demo,{action:'approve',versionId:v1.id}),{status:409});await action(demo,{action:'approve',versionId:v2.id});
  feedback=project(demo).messages.find(m=>m.id===feedback.id);assert.equal(feedback.resolved,true);assert.ok(project(demo).versions.at(-1).approvedAt);assert.equal(demo.guide().action,'deliver');demo.advance();
  const final=project(demo).versions.at(-1);assert.equal(final.kind,'final');assert.equal(final.approvedPreviewId,v2.id);assert.equal(final.media.url,v2.media.url);assert.match(final.guide,/960×540/);assert.equal(project(demo).stage,'delivered');assert.equal(demo.guide().complete,true);
  assert.deepEqual([...store.values.keys()],[DEMO_STORAGE_KEY]);assert.equal(createDemoSession({storage:store}).guide().complete,true);
});

test('advance cannot fabricate customer taste, confirmations, selections or reviews',async()=>{
  const {demo}=setup();const before=project(demo);for(let i=0;i<5;i++)assert.equal(demo.advance().tab,'direction');assert.deepEqual(project(demo),before);
  await studio(demo,{action:'save_preferences',preferences:before.studio.preferences});const planBefore=project(demo);assert.equal(demo.advance().tab,'strategy');assert.deepEqual(project(demo),planBefore);
});

test('strategy edits invalidate current confirmation and keep snapshots; stale confirmation rejected',async()=>{
  const {demo}=setup();await throughScenes(demo);const original=project(demo).studio.strategy;
  await studio(demo,{action:'save_strategy',strategy:{...original.data,mood:'선명한'}});
  let plan=project(demo).studio.strategy;assert.equal(plan.revision,2);assert.equal(plan.request,null);assert.equal(plan.confirmation,null);assert.equal(plan.history[0].confirmation.strategyRevision,1);assert.equal(demo.guide().action,'request_strategy_review');
  await assert.rejects(studio(demo,{action:'confirm_strategy',strategyRevision:1}),{status:409});demo.advance();plan=project(demo).studio.strategy;assert.equal(plan.request.strategyRevision,2);
  await assert.rejects(studio(demo,{action:'confirm_strategy',strategyRevision:1}),{status:409});await studio(demo,{action:'confirm_strategy',strategyRevision:2});assert.equal(project(demo).studio.strategy.confirmation.strategyRevision,2);
  await assert.rejects(studio(demo,{action:'confirm_strategy',strategyRevision:2}),{status:409});
});

test('incomplete edited strategy cannot be advanced into a confirmation request',async()=>{
  const {demo}=setup();await studio(demo,{action:'save_preferences',preferences:project(demo).studio.preferences});await studio(demo,{action:'save_strategy',strategy:{...project(demo).studio.strategy.data,evidence1:''}});
  assert.equal(demo.guide().action,'request_strategy_review');assert.equal(demo.guide().canAdvance,false);demo.advance();assert.equal(project(demo).studio.strategy.request,null);
});

test('demo accepts message proof and action without extra values and keeps omitted legacy fields',async()=>{
  const {demo}=setup(),original=project(demo).studio.strategy.data;
  await studio(demo,{action:'save_preferences',preferences:project(demo).studio.preferences});
  await studio(demo,{action:'save_strategy',strategy:{primaryPromise:'수정한 한 가지 메시지',value1:'',value2:'',value3:''}});
  const plan=project(demo).studio.strategy;
  assert.equal(plan.data.evidence1,original.evidence1);assert.equal(plan.data.desiredAction,original.desiredAction);assert.equal(plan.data.mood,original.mood);
  assert.equal(demo.guide().canAdvance,true);demo.advance();assert.equal(project(demo).studio.strategy.request.strategyRevision,2);
});

test('prepared correction can be revisited after further feedback without claiming automatic edits',async()=>{
  const {demo}=setup();await throughScenes(demo);demo.advance();let v=project(demo).versions.at(-1);
  await action(demo,{action:'feedback',versionId:v.id,text:'더 크게',seconds:12});demo.advance();v=project(demo).versions.at(-1);
  await action(demo,{action:'feedback',versionId:v.id,text:'색도 바꿔 주세요.',seconds:13});await assert.rejects(action(demo,{action:'approve',versionId:v.id}),{status:409});assert.match(demo.guide().description,/같은 개선 영상/);demo.advance();
  const v3=project(demo).versions.at(-1);assert.notEqual(v.id,v3.id);assert.equal(v.media.url,v3.media.url);assert.match(v3.label,/같은 CTA 개선본 재확인/);await action(demo,{action:'approve',versionId:v3.id});assert.ok(project(demo).messages.filter(m=>m.action==='feedback').every(m=>m.resolved));demo.advance();assert.equal(demo.guide().complete,true);
});

test('reference opinion counts as taste while preserving prepared reference originals',async()=>{
  const {demo}=setup(),r=project(demo).studio.references[0];await studio(demo,{action:'save_reference',id:r.id,label:r.label,url:r.url,assetId:r.assetId,preference:'like',reason:'색감이 편안해요.'});assert.equal(demo.guide().action,'confirm_strategy');assert.equal(project(demo).studio.references[0].preference,'like');
  await assert.rejects(studio(demo,{action:'save_reference',id:r.id,label:'원본 바꾸기',url:r.url,assetId:r.assetId,preference:'like',reason:''}));await assert.rejects(studio(demo,{action:'remove_reference',id:r.id}));
});

test('stale project revision, obsolete card version and empty change notes do not commit',async()=>{
  const {demo}=setup(),before=project(demo),scene=before.studio.scenes[0];
  await assert.rejects(demo.request('/pulse/api/studio',{body:{action:'save_preferences',revision:0,preferences:{}}}),{status:409});
  await assert.rejects(studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:0,status:'confirmed',text:''}),{status:409});
  await assert.rejects(studio(demo,{action:'review_scene',sceneId:scene.id,sceneRevision:1,status:'changes',text:''}));assert.deepEqual(project(demo),before);
});

test('separate tabs re-read persisted state before accepting revision writes',async()=>{
  const {demo,store}=setup(),other=createDemoSession({storage:store}),old=project(other);await studio(demo,{action:'save_preferences',preferences:{...project(demo).studio.preferences,mood:'따뜻한'}});
  await assert.rejects(other.request('/pulse/api/studio',{body:{action:'save_preferences',revision:old.revision,preferences:{}}}),{status:409});assert.equal(project(other).studio.preferences.mood,'따뜻한');
});

test('read snapshots are detached and reset touches only the demo storage key',async()=>{
  const {demo,store}=setup();store.setItem('unrelated-real-project','keep');const copy=project(demo);copy.title='changed';assert.notEqual(project(demo).title,'changed');await throughScenes(demo);demo.advance();demo.reset();assert.equal(project(demo).versions.length,0);assert.equal(project(demo).studio.sceneReviews.length,0);assert.equal(demo.guide().action,'taste');assert.equal(store.getItem('unrelated-real-project'),'keep');
});

test('storage-disabled and quota cases remain explicitly memory-only with no network fallback',async()=>{
  const blocked=setup({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}).demo;assert.equal(blocked.snapshot().demo.persistent,false);await studio(blocked,{action:'save_preferences',preferences:{mood:'감각적인'}});assert.equal(project(blocked).studio.preferences.mood,'감각적인');
  const quota=setup({getItem(){return null;},setItem(){throw Error('quota');}}).demo;await studio(quota,{action:'save_preferences',preferences:{mood:'따뜻한'}});assert.equal(quota.snapshot().demo.persistent,false);assert.equal(project(quota).studio.preferences.mood,'따뜻한');
});

test('corrupt or manipulated local records never render server media or turn into real projects',()=>{
  const store=storage();store.setItem(DEMO_STORAGE_KEY,'{invalid');let demo=createDemoSession({storage:store});assert.equal(demo.guide().action,'taste');demo.reset();assert.equal(JSON.parse(store.getItem(DEMO_STORAGE_KEY)).schema,1);
  for(const mutate of [s=>{s.project.id='real-project';},s=>{s.project.studio.assets[0].url='/api/client-media/secret';},s=>{s.project.studio.concepts[0].imageUrl='https://example.com/tracking.png';},s=>{s.project.studio.scenes=[null];},s=>{s.project.studio.strategy.data.channels='invalid';}]){const record=JSON.parse(store.getItem(DEMO_STORAGE_KEY));mutate(record);store.setItem(DEMO_STORAGE_KEY,JSON.stringify(record));demo=createDemoSession({storage:store});assert.equal(project(demo).id,'00000000-0000-4000-8000-000000000001');assert.equal(demo.guide().action,'taste');assert.equal(project(demo).studio.assets[0].url,'/pulse-app/demo-assets/reference-warm.png');demo.reset();}
});

test('staff endpoints, invites, uploads and unknown actions fail closed without network calls',async()=>{
  const {demo}=setup();const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('network forbidden');};try{
    for(const path of ['/api/me','/api/client-projects','/pulse/api/open','/pulse/api/studio/media','https://example.com','/pulse/api/anything'])await assert.rejects(demo.request(path,{body:{invite:'real-token'}}),{status:400});
    await assert.rejects(demo.request('/pulse/api/studio',{file:{size:1},body:{}}));await assert.rejects(studio(demo,{action:'request_strategy_review'}));await assert.rejects(studio(demo,{action:'save_scene'}));assert.equal(calls,0);
  }finally{globalThis.fetch=oldFetch;}
  const source=await readFile(new URL('./public/pulse-app/demo.mjs',import.meta.url),'utf8');assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(source));assert.deepEqual([...source.matchAll(/^import .* from ['"](.+)['"];$/gm)].map(m=>m[1]),['./api.mjs','./casting-view.mjs']);
});

test('approved preview rejects duplicate approval and new revision feedback',async()=>{
  const {demo}=setup();await throughScenes(demo);demo.advance();const v=project(demo).versions.at(-1);await action(demo,{action:'approve',versionId:v.id});await assert.rejects(action(demo,{action:'approve',versionId:v.id}),{status:409});await assert.rejects(action(demo,{action:'feedback',versionId:v.id,text:'나중 변경'}),{status:409});await action(demo,{action:'support',text:'기타 문의 체험'});assert.equal(project(demo).messages.at(-1).action,'support');
});
