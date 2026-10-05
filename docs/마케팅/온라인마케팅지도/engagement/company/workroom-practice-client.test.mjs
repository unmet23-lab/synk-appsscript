import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../../../../../',import.meta.url);
const shared=readFileSync(new URL('experiences/shift-workbench/model.mjs',root),'utf8');
const modelNames=[...shared.matchAll(/export (?:const|function) (\w+)/g)].map(m=>m[1]);
function fixture(){
  const storage=new Map(),reads=[],writes=[],handlers=new Map(),nodes=new Map();let renders=0,selected=null;
  const context=vm.createContext({console,URL,Blob,setTimeout,clearTimeout,Date,location:{reload(){}},state:{user:{id:'member-A'},tab:'workroom'},wr:{view:'practice'},CSS:{escape:String},
    localStorage:{getItem(key){reads.push(key);return storage.get(key)||null;},setItem(key,value){writes.push(key);storage.set(key,value);},removeItem:key=>storage.delete(key)},
    document:{activeElement:null,addEventListener(type,handler){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);},getElementById:id=>nodes.get(id)||null,querySelector:()=>selected},
    render(){renders++;},escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),button:(label,action)=>`<button data-action="${action}">${label}</button>`});
  vm.runInContext(readFileSync(new URL('atlas/engine.js',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('atlas/domain.js',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('atlas/temper-outcomes.js',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('atlas/personalization.js',root),'utf8'),context);
  vm.runInContext(`(()=>{${shared.replaceAll('export ','')} globalThis.practiceModel={${modelNames.join(',')}};})()`,context);
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
  f.action('complete');assert.equal(f.wp.value.run.step,'result');const html=f.evaluate('wpResult()');assert.match(html,/최근 실습에서 다시 확인이 필요했던 유형을 「기획을 검증하기」 실습에서 먼저 확인하도록 제안합니다/);assert.match(html,/선택한 업무에 그 유형이 있을 때/);
  f.action('next');assert.equal(f.wp.value.settings.task,'planning');assert.equal(f.wp.mode,'setup');
  f.emit('change',{dataset:{wpField:'task'},value:'research'});f.start();assert.equal(f.wp.value.run.task,'research');assert.doesNotMatch(f.wp.value.run.reason,/누락·성공 기준/);
});
