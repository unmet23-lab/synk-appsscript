import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgressSync,progressSnapshot} from '../src/progress-sync.mjs';
import {readState,recordDecision} from '../src/tutor.mjs';
import {recordSemantic} from '../src/semantic.mjs';
import {feedbackFixture} from './semantic-fixture.mjs';
const fresh=()=>({v:2,seq:0,obs:[],trail:[],seen:{},recentCards:[],drafts:{a:{text:'private'}},scene:{id:'write'}});
const learned=n=>({...fresh(),seq:n,obs:[{n,kind:'cycle',at:'2026-10-28T00:00:00Z'}],seen:{a:'2026-10-28T00:00:00Z'}});
const disk=()=>{const map=new Map();return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
function setup({local=fresh(),saved=null,version=0,storage=disk(),get=null,post=null}={}){
 let state=local,server=saved,v=version,calls=0;const transport={get:get||(async()=>({version:v,study:server})),post:post||(async body=>{calls++;if(body.baseVersion!==v)throw Object.assign(Error('conflict'),{code:'STUDY_PROGRESS_CONFLICT'});server=body.study;v++;return {version:v,study:server};})};
 const sync=createProgressSync({transport,storage,key:'account.r2',read:()=>state,apply:s=>{state=s;}});
 return {sync,storage,state:()=>state,set:s=>{state=s;sync.changed();},server:()=>server,calls:()=>calls};
}
test('new device restores progress, preserving local private draft and restarting its scene',async()=>{
 const a=setup({saved:progressSnapshot(learned(3)),version:4});assert.equal((await a.sync.init()).phase,'synced');assert.equal(a.state().seq,3);assert.equal(a.state().drafts.a.text,'private');assert.equal(a.state().scene,null);assert.equal(a.calls(),0);
});
test('initial empty server is distinct from failed read; only known base can be uploaded',async()=>{
 const a=setup({local:learned(3)});assert.equal((await a.sync.init()).phase,'pending');await a.sync.flush();assert.equal(a.calls(),1);assert.equal(a.server().drafts,undefined);assert.equal(a.server().scene,undefined);
 const b=setup({local:learned(3),get:async()=>{throw Error('offline');}});assert.equal((await b.sync.init()).phase,'blocked');await b.sync.flush();assert.equal(b.calls(),0);
});
test('divergent histories remain local until explicit server choice saves a full backup',async()=>{
 const a=setup({local:learned(4),saved:progressSnapshot(learned(3)),version:1});assert.equal((await a.sync.init()).phase,'conflict');await a.sync.flush();assert.equal(a.calls(),0);assert.equal(a.state().seq,4);
 const result=await a.sync.useServer();assert.equal(result.phase,'synced');assert.equal(JSON.parse(a.storage.getItem(result.backupKey)).seq,4);assert.equal(a.state().seq,3);
});
test('stale response after account stop cannot replace state or write metadata',async()=>{
 let done;const a=setup({get:()=>new Promise(resolve=>{done=resolve;})});const p=a.sync.init();a.sync.stop();done({version:4,study:progressSnapshot(learned(3))});await p;assert.equal(a.state().seq,0);assert.equal(a.storage.map.size,0);
});
test('edits during acknowledgement remain pending and conflict never retries in a loop',async()=>{
 let ack;const a=setup({local:learned(3),post:body=>new Promise(resolve=>{ack=()=>resolve({version:1,study:body.study});})});await a.sync.init();const p=a.sync.flush();a.set(learned(4));ack();assert.equal((await p).phase,'pending');assert.equal(a.state().seq,4);
 const b=setup({local:learned(3),post:async()=>{throw Object.assign(Error('stale'),{code:'STUDY_PROGRESS_CONFLICT'});}});await b.sync.init();assert.equal((await b.sync.flush()).phase,'conflict');assert.equal((await b.sync.flush()).phase,'conflict');
});
test('backup quota failure never replaces local progress',async()=>{
 const a=setup({local:learned(4),saved:progressSnapshot(learned(3)),version:1});await a.sync.init();a.storage.setItem=()=>{throw Error('quota');};assert.equal((await a.sync.useServer()).phase,'blocked');assert.equal(a.state().seq,4);
});

function semanticProgress(){
 const now=Date.parse('2026-10-28T00:00:00Z'),feedback=feedbackFixture();
 let state=recordSemantic(readState(null,{now}),{feedback,itemId:'w53-resale',stage:'check',pick:'b'},{now});
 // Local detail/target shape from the independently published learner-response update.
 state.obs.at(-1).detail={itemId:'w53-resale',attempt:new Date(now).toISOString(),target:'trend',prompt:feedback.check.prompt,selected:feedback.check.options[1].text,expected:feedback.check.options[1].text,explanation:feedback.check.why};
 state=recordDecision(state,{scene:'write',why:'semantic',source:'ai-reference',skill:'data.accuracy',target:'trend'},{now:now+1}).state;
 return {...state,drafts:fresh().drafts,scene:{id:'write'}};
}

test('semantic detail and local plan target stay local while minimized progress is sent',async()=>{
 const local=semanticProgress(),before=structuredClone(local),a=setup({local});
 assert.equal((await a.sync.init()).phase,'pending');assert.equal((await a.sync.flush()).phase,'synced');
 const saved=a.server(),observation=saved.obs.at(-1);
 assert.deepEqual(Object.keys(observation).sort(),['at','ev','kind','n','result','skill','source','stage']);
 assert.deepEqual(saved.trail.at(-1).plan,{scene:'write',why:'semantic',source:'ai-reference',skill:'data.accuracy'});
 for(const value of Object.values(local.obs.at(-1).detail))assert.ok(!JSON.stringify(saved).includes(value)||value==='w53-resale'||value===local.obs.at(-1).at);
 assert.deepEqual(a.state(),before,'projection and acknowledgement do not rewrite the local observations');
 saved.obs.at(-1).skill='changed';saved.trail.at(-1).plan.skill='changed';assert.deepEqual(local,before,'payload mutations cannot reach local state');
});
test('automatic refresh retains private semantic detail only for identical linked evidence',async()=>{
 const local=semanticProgress(),a=setup({local});await a.sync.init();await a.sync.flush();const remote=structuredClone(a.server());remote.seq+=1;
 const checkpoint=[...a.storage.map],store=()=>{const d=disk();for(const [k,v]of checkpoint)d.setItem(k,v);return d;};
 const b=setup({local,storage:store(),saved:remote,version:2});assert.equal((await b.sync.init()).phase,'synced');assert.deepEqual(b.state().obs.at(-1).detail,local.obs.at(-1).detail);assert.equal(b.state().seq,remote.seq);assert.equal(b.state().scene,null);assert.ok(progressSnapshot(b.state()).obs.every(o=>!o.detail));
 const changed=structuredClone(remote);changed.trail.find(e=>e.type==='practice.presented').itemKey='w53-other';const c=setup({local,storage:store(),saved:changed,version:3});assert.equal((await c.sync.init()).phase,'synced');assert.equal(c.state().obs.at(-1).detail,undefined,'Matching observation IDs cannot override a different causal presentation');
});

test('Trail projection drops raw extensions but preserves IDs and verdicts for server validation',()=>{
 const local=semanticProgress();for(const event of local.trail){event.rawText='private event prose';event.scope.note='private scope prose';}
 const attempt=local.trail.find(e=>e.type==='practice.attempted');attempt.choice.selectedText='private choice prose';
 attempt.presentationId='missing';attempt.verdict='correct';
 const before=structuredClone(local),wire=progressSnapshot(local),projected=wire.trail.find(e=>e.id===attempt.id);
 assert.ok(!JSON.stringify(wire).includes('private '));
 assert.deepEqual(projected.choice,{selectedId:'b',correctId:'b'});
 assert.equal(projected.presentationId,'missing');assert.equal(projected.verdict,'correct');
 assert.deepEqual(wire.trail.map(e=>e.id),local.trail.map(e=>e.id));assert.deepEqual(local,before);
});

test('another device restores minimized semantic progress without inventing local AI detail',async()=>{
 const saved=progressSnapshot(semanticProgress()),a=setup({saved,version:2});
 assert.equal((await a.sync.init()).phase,'synced');
 assert.equal(a.state().obs.at(-1).result,'selected-right');assert.equal(a.state().obs.at(-1).detail,undefined);
 assert.equal(a.state().trail.at(-1).plan.target,undefined);assert.equal(a.state().drafts.a.text,'private');assert.equal(a.state().scene,null);
 assert.doesNotThrow(()=>readState(a.state(),{now:Date.parse('2026-10-28T00:01:00Z')}));
});

test('explicit server choice preserves full local detail in backup without merging it into restored progress',async()=>{
 const local=semanticProgress(),saved=progressSnapshot({...local,seq:local.seq+1}),a=setup({local,saved,version:2});
 assert.equal((await a.sync.init()).phase,'conflict');const result=await a.sync.useServer();assert.equal(result.phase,'synced');
 assert.deepEqual(JSON.parse(a.storage.getItem(result.backupKey)),local);
 assert.equal(a.state().obs.at(-1).detail,undefined);assert.equal(a.state().drafts.a.text,'private');assert.equal(a.state().scene,null);
});
