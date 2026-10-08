import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const root=new URL('../../../../../',import.meta.url);
const shared=readFileSync(new URL('experiences/shift-workbench/model.mjs',root),'utf8');
const modelNames=[...shared.matchAll(/export (?:const|function) (\w+)/g)].map(m=>m[1]);
function fixture({crypto=webcrypto}={}){
  const storage=new Map(),reads=[],writes=[],handlers=new Map(),nodes=new Map();let renders=0,selected=null;
  const context=vm.createContext({console,URL,Blob,setTimeout,clearTimeout,Date,crypto,TextEncoder,location:{reload(){}},state:{user:{id:'member-A'},tab:'workroom'},wr:{view:'practice'},CSS:{escape:String},
    localStorage:{getItem(key){reads.push(key);return storage.get(key)||null;},setItem(key,value){writes.push(key);storage.set(key,value);},removeItem:key=>storage.delete(key)},
    document:{activeElement:null,addEventListener(type,handler){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);},getElementById:id=>nodes.get(id)||null,querySelector:()=>selected},
    render(){renders++;},escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),button:(label,action)=>`<button data-action="${action}">${label}</button>`});
  vm.runInContext(readFileSync(new URL('atlas/engine.js',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('atlas/domain.js',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('atlas/temper-outcomes.js',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('atlas/personalization.js',root),'utf8'),context);
  const upgrade=readFileSync(new URL('experiences/shift-workbench/storage-upgrade.mjs',root),'utf8').replaceAll('export ','');
  vm.runInContext(`(()=>{${upgrade}\n${shared.replace(/^import [^\n]+\n/,'').replaceAll('export ','')} globalThis.practiceModel={${modelNames.join(',')}};})()`,context);
  vm.runInContext(readFileSync(new URL('./public/workroom-practice-sync.js',import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('./public/workroom-practice.js',import.meta.url),'utf8'),context);
  const evaluate=code=>vm.runInContext(code,context);evaluate('wp.model=practiceModel;wpSyncIdentity();wpRestore()');
  const emit=(type,target)=>{for(const handler of handlers.get(type)||[])handler({target,preventDefault(){}});};
  const start=()=>emit('submit',{matches:selector=>selector==='[data-wp-setup]'});
  const action=name=>emit('click',{closest:()=>({disabled:false,dataset:{action:'practice-'+name}})});
  return {context,storage,reads,writes,nodes,emit,start,action,evaluate,get wp(){return evaluate('wp');},get renders(){return renders;},set selected(value){selected=value;}};
}

test('a practice decision is recorded as displayed only after its current DOM marker exists',()=>{
  const f=fixture();f.start();assert.equal(f.wp.value.evaluation.decisions.length,1);assert.equal(f.wp.value.evaluation.exposures.length,0);
  f.evaluate('wpRestoreEdit(null)');assert.equal(f.wp.value.evaluation.exposures.length,0);
  f.selected={};f.evaluate('wpRestoreEdit(null)');assert.equal(f.wp.value.evaluation.exposures.length,1);
  f.evaluate('wpRestoreEdit(null)');assert.equal(f.wp.value.evaluation.exposures.length,1);
  f.evaluate("wp.mode='setup'");f.selected=null;f.evaluate('wpRestoreEdit(null)');assert.equal(f.wp.value.evaluation.exposures.length,1);
});
test('practice reads only the active employee key and never imports the standalone visitor record',()=>{
  const f=fixture();f.storage.set('synk.shift.workbench.v1','visitor-record');f.evaluate('wpRestore()');
  assert.ok(f.reads.every(key=>key==='synk-workroom:ai-practice:v1:member-A'));assert.equal(f.wp.value.save,false);assert.equal(f.wp.value.profile,null);
  f.start();assert.equal(f.wp.value.profile.scope.personId,'member-A');assert.equal(f.wp.value.profile.scope.productId,'company');assert.equal(f.writes.length,0);
});
test('opt-in settings are not saved before a valid first profile; inputs then save only to the member key',()=>{
  const f=fixture();f.emit('change',{dataset:{wpField:'save'},checked:true});f.emit('change',{dataset:{wpField:'minutes'},value:'10'});
  assert.equal(f.writes.length,0);f.start();f.emit('input',{dataset:{wpField:'prompt'},value:'작성 중 요청문. 가상 자료의 근거와 기한을 모두 확인합니다.'});
  assert.ok(f.writes.length>0);assert.ok(f.writes.every(key=>key==='synk-workroom:ai-practice:v1:member-A'));
  const record=f.storage.get(f.writes[0]);f.evaluate('wpRestore()');assert.match(f.wp.value.run.prompt,/작성 중 요청문/);assert.equal(JSON.parse(record).profile.scope.personId,'member-A');
});
test('account switches and logout clear memory while retaining explicitly saved records in their own scopes',async()=>{
  const f=fixture();f.emit('change',{dataset:{wpField:'save'},checked:true});f.start();f.emit('input',{dataset:{wpField:'prompt'},value:'A 계정의 개인 실습 초안. 가상 자료와 근거를 확인합니다.'});
  const saved=f.storage.get('synk-workroom:ai-practice:v1:member-A');f.context.state.user={id:'member-B'};f.evaluate('wpSyncIdentity()');
  assert.equal(f.wp.value,null);assert.equal(f.wp.userId,'member-B');await f.evaluate('wpEnsure()');assert.equal(f.wp.value.run,null);assert.equal(f.wp.value.history.length,0);
  f.storage.set('synk-workroom:ai-practice:v1:member-B',saved);f.evaluate('wpRestore()');assert.equal(f.wp.value.profile,null);assert.match(f.wp.storageMessage,/불러오지 못했/);
  f.context.state.user=null;f.evaluate('wpSyncIdentity()');assert.equal(f.wp.value,null);assert.equal(f.wp.userId,null);assert.equal(f.storage.get('synk-workroom:ai-practice:v1:member-A'),saved);
  f.context.state.user={id:'member-A'};await f.evaluate('wpEnsure()');assert.match(f.wp.value.run.prompt,/A 계정/);
});
test('late input events from another account cannot mutate the previous account draft',()=>{
  const f=fixture();f.start();f.emit('input',{dataset:{wpField:'prompt'},value:'원래 초안'});f.context.state.user={id:'member-B'};
  f.emit('input',{dataset:{wpField:'prompt'},value:'다른 계정 내용'});assert.equal(f.wp.value.run.prompt,'원래 초안');
  f.evaluate('wpSyncIdentity()');assert.equal(f.wp.value,null);
});
test('blocked localStorage reads and writes degrade to visible in-memory practice without crashing',()=>{
  const f=fixture();Object.defineProperty(f.context,'localStorage',{get(){throw new Error('SecurityError');},configurable:true});
  assert.doesNotThrow(()=>f.evaluate('wpRestore()'));assert.equal(f.wp.value.save,false);f.start();f.emit('change',{dataset:{wpField:'save'},checked:true});
  assert.match(f.wp.storageMessage,/저장하지 못했/);assert.ok(f.wp.value.run);
  f.emit('change',{dataset:{wpField:'save'},checked:false});assert.equal(f.wp.value.save,true);assert.match(f.wp.error,/지우지 못했/);
});
test('module errors stay still until explicit retry and do not create a render retry loop',async()=>{
  const f=fixture();f.evaluate("wp.value=null;wp.error='load failed'");const before=f.renders;await f.evaluate('wpEnsure()');assert.equal(f.renders,before);assert.equal(f.wp.loading,false);
});
test('shell snapshots restore textarea caret and scroll only for the same active identity',()=>{
  const f=fixture();f.start();let focused=0,selection=[];const el={dataset:{wpField:'prompt'},value:'초안',selectionStart:1,selectionEnd:2,selectionDirection:'backward',scrollTop:37,closest:()=>true,matches:()=>true,focus(){focused++;},setSelectionRange(...args){selection=args;}};
  f.context.document.activeElement=el;f.selected=el;f.evaluate('wp.composing=true;globalThis.edit=wpCaptureEdit()');assert.equal(f.context.edit.composing,true);
  f.evaluate('wpRestoreEdit(edit)');assert.equal(focused,1);assert.deepEqual(selection,[1,2,'backward']);assert.equal(el.scrollTop,37);
  f.context.state.user={id:'member-B'};f.evaluate('wpRestoreEdit(edit)');assert.equal(focused,1);
});
test('draft edits clear the review acknowledgement and stored HTML renders as literal text',()=>{
  const f=fixture();f.start();f.evaluate('wp.value.run.reviewed=true');const box={checked:true};f.selected=box;
  f.emit('input',{dataset:{wpField:'draft'},value:'<img src=x onerror=alert(1)> 초안'});assert.equal(f.wp.value.run.reviewed,false);assert.equal(box.checked,false);
  f.emit('input',{dataset:{wpField:'prompt'},value:'<img src=x onerror=alert(1)> 요청문'});const html=f.evaluate('wpPanel()');assert.match(html,/&lt;img src=x/);assert.doesNotMatch(html,/<img src=x/);
});
test('practice navigation reuses existing desk and publishing tools without a company write request',()=>{
  const f=fixture();f.start();f.context.makerTools={view:'subtitles'};f.action('publish');assert.equal(f.context.wr.view,'tools');assert.equal(f.context.makerTools.view,'publish');
  f.context.wr.view='practice';f.action('desk');assert.equal(f.context.wr.view,'desk');
});
test('next practice offers an applicable missed focus and keeps the employee free to choose a different task',()=>{
  const f=fixture();f.emit('change',{dataset:{wpField:'minutes'},value:'10'});f.emit('change',{dataset:{wpField:'goal'},value:'work'});f.start();
  f.evaluate(`wp.value.run.prompt=practiceModel.TASKS.meeting.template;wp.value.run.draft='지안은 10월 8일까지 안내 초안을 작성합니다. 예산 승인은 대기 중이며 도윤은 10월 6일까지 접근성 항목을 전달합니다.';wp.value.run.reviewed=true;for(const c of practiceModel.TASKS.meeting.checks)wp.value.run.answers[c.id]={kind:c.id==='missing'?'match':c.answer,source:c.source};wp.value.run.result=practiceModel.evaluate(wp.value.run)`);
  f.action('complete');assert.equal(f.wp.value.run.step,'result');const html=f.evaluate('wpResult()');assert.ok(html.includes(f.evaluate('wp.model.nextTaskReason(wp.value)')));assert.match(html,/누락·성공 기준 확인 항목을 「기획을 검증하기」에서/);assert.match(html,/선택한 업무에 다시 확인할 유형이 있으면/);
  f.action('next');assert.equal(f.wp.value.settings.task,'planning');assert.equal(f.wp.mode,'setup');
  f.emit('change',{dataset:{wpField:'task'},value:'research'});f.start();assert.equal(f.wp.value.run.task,'research');assert.doesNotMatch(f.wp.value.run.reason,/누락·성공 기준/);
});

const savedWork=`({kind:'saved-work',scope:wpScope(wp.userId),sourceGeneration:0,task:'meeting',at:'2026-10-02T00:00:00.000Z',
  prompt:'<img src=x onerror=alert(1)> 이전 요청문',draft:'</pre><script>evil()</script> 이전 초안',status:'in-progress'})`;

test('saved work keeps requests and drafts readable without scores or an analytical reuse claim',()=>{
  const f=fixture();f.start();f.evaluate(`wp.value.history=[${savedWork},{...${savedWork},status:'completed'}]`);
  const practice=f.evaluate('wpExercise()');
  assert.match(practice,/현재 추천에 사용할 이전 검토·피드백은 없어요/);
  assert.doesNotMatch(practice,/이전 검토·피드백을 사용했어요/);
  f.action('history');const html=f.evaluate('wpPanel()');
  assert.equal((html.match(/추천·평가에 사용하지 않음/g)||[]).length,2);
  assert.match(html,/작성 중이던 내용/);assert.match(html,/완료한 실습의 작성물/);
  assert.match(html,/내 요청문/);assert.match(html,/직접 작성한 내용/);
  assert.match(html,/&lt;img src=x/);assert.match(html,/&lt;\/pre&gt;&lt;script&gt;/);
  assert.doesNotMatch(html,/<img src=x|<script>|undefined|NaN|첫 근거 확인/);
  f.evaluate(`wp.value.history.push({task:'research',at:'2026-10-03T00:00:00.000Z',correct:1,total:3,draft:'일반 완료 결과'})`);
  assert.match(f.evaluate('wpHistory()'),/첫 근거 확인 1\/3/);
});

test('turning storage off preserves in-memory saved work and clear erases it only for the current account',()=>{
  const f=fixture();f.emit('change',{dataset:{wpField:'save'},checked:true});f.start();
  f.evaluate(`wp.value.history=[${savedWork}];wp.value.run.prompt='현재 작성 중 내용';wpSave()`);
  const key='synk-workroom:ai-practice:v1:member-A',other='synk-workroom:ai-practice:v1:member-B';
  f.storage.set(other,'other-account');assert.ok(f.storage.has(key));
  f.emit('change',{dataset:{wpField:'save'},checked:false});
  assert.equal(f.storage.has(key),false);assert.equal(f.wp.value.history.length,1);assert.equal(f.wp.value.run.prompt,'현재 작성 중 내용');
  f.emit('change',{dataset:{wpField:'save'},checked:true});assert.ok(f.storage.has(key));
  f.action('clear');assert.equal(f.storage.has(key),false);assert.equal(f.wp.value.history.length,0);assert.equal(f.wp.value.run,null);
  assert.equal(f.storage.get(other),'other-account');
});

function syncTransport(f){
  let current={revision:0,status:'empty',updatedAt:null,state:null};const requests=[];
  f.context.fetch=async(path,options)=>{requests.push({path,...options});if(options.body){const body=JSON.parse(options.body);current={revision:current.revision+1,status:'active',updatedAt:new Date().toISOString(),state:body.state};}return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(current))};};
  return {requests,get remote(){return current;}};
}
function enableSync(f){
  // The UI intentionally discards enable's Promise. Observe that same operation
  // without estimating WebCrypto completion from event-loop iteration counts.
  const sync=f.wp.sync,enable=sync.enable;let pending;
  sync.enable=(...args)=>pending=enable(...args);
  try{f.emit('change',{dataset:{wpField:'sync'},checked:true});assert.ok(pending&&typeof pending.then==='function');return pending;}
  finally{sync.enable=enable;}
}
test('account sync opt-in is independent of device storage and does not upload before an actual profile',{timeout:10000},async()=>{
  const f=fixture(),transport=syncTransport(f);f.evaluate('wpCloudEnsure()');assert.equal(transport.requests.length,0);
  assert.match(f.evaluate('wpPanel()'),/회사 계정에 저장하고 다른 기기에서 이어가기/);await enableSync(f);
  assert.equal(f.wp.value.save,false);assert.equal(transport.remote.status,'empty');assert.equal(f.wp.sync.view().phase,'waiting');f.start();await f.evaluate('wp.sync.refresh()');
  assert.equal(transport.remote.state.profile.scope.personId,'member-A');assert.equal(transport.remote.state.save,true);assert.equal(f.storage.has('synk-workroom:ai-practice:v1:member-A'),false);
  assert.equal(JSON.parse(f.storage.get('synk-workroom:ai-practice-sync:v1:member-A')).enabled,true);f.wp.sync.dispose();
});
test('turning device storage off keeps account sync on, while turning sync off stops later uploads',{timeout:10000},async()=>{
  const f=fixture(),transport=syncTransport(f);f.start();f.evaluate('wpCloudEnsure()');await enableSync(f);
  f.emit('change',{dataset:{wpField:'save'},checked:true});f.emit('change',{dataset:{wpField:'save'},checked:false});assert.equal(f.wp.sync.view().enabled,true);assert.equal(f.wp.value.save,false);
  await f.evaluate('wp.sync.refresh()');const revision=transport.remote.revision;f.emit('change',{dataset:{wpField:'sync'},checked:false});f.emit('input',{dataset:{wpField:'prompt'},value:'이후에는 이 창에서만 수정하는 요청문입니다.'});await f.evaluate('wp.sync.refresh()');
  assert.equal(transport.remote.revision,revision);assert.equal(f.wp.value.run.prompt,'이후에는 이 창에서만 수정하는 요청문입니다.');assert.equal(f.storage.has('synk-workroom:ai-practice:v1:member-A'),false);f.wp.sync.dispose();
});

test('the sync UI test waits for the actual hash completion even after many immediate turns',{timeout:10000},async t=>{
  let release,started;
  const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
  const f=fixture({crypto:{subtle:{async digest(...args){started();await gate;return webcrypto.subtle.digest(...args);}}}}),transport=syncTransport(f);
  t.after(()=>{release();f.wp.sync?.dispose();});f.evaluate('wpCloudEnsure()');
  let settled=false;const pending=enableSync(f).then(()=>{settled=true;});await ready;
  for(let n=0;n<100;n++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(settled,false);assert.equal(f.wp.sync.view().busy,true);assert.equal(transport.remote.status,'empty');
  release();await pending;
  assert.equal(f.wp.sync.view().busy,false);assert.equal(f.wp.sync.view().phase,'waiting');assert.equal(transport.requests.length,1);
});
