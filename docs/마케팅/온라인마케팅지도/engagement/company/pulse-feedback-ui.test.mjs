import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {productionUI,feedbackDraftChanged,addProductionDraftReset} from './public/pulse-app/production-ui.mjs';
import {projectView} from './public/pulse-app/views.mjs';

const project=()=>({id:'p',versions:[{id:'v1',kind:'preview'}],studio:{feedbackRounds:{drafts:[{id:'d',versionId:'v1',items:[{id:'i',text:'저장된 의견',seconds:3.5}]}]}}});
const entry=(values={},bound={})=>({boundData:{form:'round-draft',id:'i',itemId:'i',draftId:'d',versionId:'v1',...bound},values,revision:1});
function context(overrides={}){const calls=[],notices=[];const ctx={s:{project:project(),mode:'customer'},notice:value=>notices.push(value),studioAction:async(action,values)=>{calls.push({action,values});return {};},mutate:async(operation,options)=>{const result=await operation();calls.push({options});return result;},...overrides};return {ctx,calls,notices,ui:productionUI(ctx)};}
const appSource=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');

function mutationHarness(){
  const drafts=new Map([['feedback',{values:{text:'보존할 작성 내용'},revision:1}],['other',{values:{text:'다른 입력'},revision:1}]]),rendered=[],notices=[];
  const s={mode:'customer',tab:'review',versionId:'v2',error:'',conflict:false,workflow:[],project:{id:'p',revision:2,title:'승인 안내 시험',versions:[{id:'v2',kind:'preview',label:'수정본 2'}],messages:[],studio:{preferences:{},references:[],concepts:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[]}}}};
  let focused=null;const dialog={open:true,dataset:{},children:[],querySelector(){return this.children.find(node=>node.dataset.mutationError)||null;},prepend(node){this.children.unshift(node);},close(){this.open=false;},showModal(){this.open=true;},set innerHTML(value){this.children=[];this.content=value;}};
  const document={createElement:()=>({dataset:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;},focus(){focused=this;},scrollIntoView(){this.scrolled=true;},remove(){dialog.children=dialog.children.filter(node=>node!==this);}})};
  const sandbox={s,drafts,dialog,document,busy:false,loading:false,epoch:1,demo:null,editable:()=>true,projectStamp:()=>({epoch:1}),current:()=>true,draftKey:()=> 'feedback',setBusy:value=>{sandbox.busy=value;},accept(){},clearDraft:(key,revision)=>{if(drafts.get(key)?.revision===revision)drafts.delete(key);},notice:message=>notices.push(message),scheduleApply(){},restore(){},dialogContent:()=>'<h2>새 승인 확인</h2>',render:()=>{const previous=globalThis.location;globalThis.location={origin:'https://pulse.example.test'};try{rendered.push(projectView(s));}finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}}};
  vm.createContext(sandbox);
  const dialogCode=appSource.slice(appSource.indexOf('function openDialog('),appSource.indexOf('function installEnvironment('));
  const mutateCode=appSource.slice(appSource.indexOf('async function mutate('),appSource.indexOf('function studioAction('));
  vm.runInContext(dialogCode+'\n'+mutateCode,sandbox);
  const reject=message=>sandbox.mutate(async()=>{throw Object.assign(new Error(message),{status:409});},{form:{}});
  return {sandbox,s,drafts,dialog,rendered,notices,reject,get focused(){return focused;}};
}

test('approval guard errors are visible inside the open dialog, never duplicate, and clear for a new dialog or successful retry',async()=>{
  const f=mutationHarness(),drafts=JSON.stringify([...f.drafts]),reason='이전 시안의 수정 의견을 담당자가 최신 수정본에 연결하고 검토를 마친 뒤 승인할 수 있습니다. 담당자 확인을 기다려 주세요.';
  assert.equal(await f.reject(reason),false);assert.equal(f.dialog.open,true);assert.equal(f.dialog.children.length,1);
  const alert=f.dialog.children[0];assert.equal(alert.textContent,reason);assert.equal(alert.attributes.role,'alert');assert.equal(alert.tabIndex,-1);assert.equal(f.focused,alert);assert.equal(alert.scrolled,true);
  assert.equal(JSON.stringify([...f.drafts]),drafts);assert.match(f.rendered.at(-1),/요청을 진행하지 못했어요/);assert.doesNotMatch(f.rendered.at(-1),/다른 변경 사항이 먼저 저장/);
  await f.reject('<img src=x onerror=alert(1)>');assert.equal(f.dialog.children.length,1);assert.equal(f.dialog.children[0].textContent,'<img src=x onerror=alert(1)>');assert.equal(f.dialog.children[0].innerHTML,undefined);
  f.sandbox.openDialog('approve');assert.equal(f.dialog.children.length,0);assert.equal(JSON.stringify([...f.drafts]),drafts);
  await f.reject(reason);assert.equal(await f.sandbox.mutate(async()=>({})),true);assert.equal(f.dialog.children.length,0);assert.equal(f.s.error,'');assert.equal(f.s.conflict,false);assert.equal(JSON.stringify([...f.drafts]),drafts);
});

test('revision conflicts preserve every draft and the existing refresh action while showing the exact reason in the modal',async()=>{
  const f=mutationHarness(),drafts=JSON.stringify([...f.drafts]),reason='다른 창이나 고객이 내용을 변경했습니다. 새로 불러온 뒤 다시 저장해 주세요.';
  assert.equal(await f.reject(reason),false);assert.equal(f.s.conflict,true);assert.equal(f.s.error,reason);assert.equal(f.dialog.children[0].textContent,reason);
  assert.match(f.rendered.at(-1),/최신 내용 불러오기 · 작성 내용 유지/);assert.equal(JSON.stringify([...f.drafts]),drafts);assert.equal(f.s.project.revision,2);
});


test('empty new feedback forms and values returned to the saved state do not count as unsaved feedback',()=>{
  const p=project();assert.equal(feedbackDraftChanged(p,entry()),false);assert.equal(feedbackDraftChanged(p,entry({text:'저장된 의견',seconds:'3.50'})),false);assert.equal(feedbackDraftChanged(p,entry({text:'  저장된 의견  '})),false);
  for(const values of [{},{text:''},{text:'   '},{text:'',seconds:'12.5'}])assert.equal(feedbackDraftChanged(p,entry(values,{id:'new:v1',itemId:'',draftId:''})),false);
  assert.equal(feedbackDraftChanged(p,entry({text:'새 의견'},{id:'new:v1',itemId:'',draftId:''})),true);
});

test('actual text or time changes are detected even when the draft map stores only the field that changed',()=>{
  const p=project();assert.equal(feedbackDraftChanged(p,entry({text:'바뀐 의견'})),true);assert.equal(feedbackDraftChanged(p,entry({text:''})),true);assert.equal(feedbackDraftChanged(p,entry({seconds:'0'})),true);assert.equal(feedbackDraftChanged(p,entry({seconds:''})),true);
  p.studio.feedbackRounds.drafts[0].items[0].seconds=null;assert.equal(feedbackDraftChanged(p,entry({seconds:''})),false);
});

test('older-preview or deleted-item local drafts cannot block an unrelated current preview',()=>{
  const p=project();assert.equal(feedbackDraftChanged(p,entry({text:'보관 입력'},{versionId:'v0'})),false);assert.equal(feedbackDraftChanged(p,entry({text:'삭제된 항목 입력'},{itemId:'missing',id:'missing'})),false);
  p.versions.push({id:'v2',kind:'preview'});assert.equal(feedbackDraftChanged(p,entry({text:'v1에 작성 중'})),false);
});

test('deleting a draft item passes its exact form to the existing successful-mutation cleanup',async()=>{
  const f=context(),form={dataset:{form:'round-draft',id:'i'}};
  await f.ui.click({dataset:{action:'round-remove-item',draftId:'d',id:'i'},closest:selector=>selector==='form'?form:null});
  assert.deepEqual(f.calls[0],{action:'remove_feedback_draft_item',values:{draftId:'d',itemId:'i'}});assert.equal(f.calls[1].options.form,form);
});

test('the main video time shortcut targets a new feedback form instead of changing the first saved item',async()=>{
  const original=globalThis.document,seen=[];let paused=0,focused=0,inputs=0;
  const old={elements:{seconds:{value:'3.5'}}},fresh={elements:{seconds:{value:'',dispatchEvent:()=>inputs++},text:{focus:()=>focused++}}},video={currentTime:12.34,pause:()=>paused++};
  globalThis.document={querySelector:selector=>{seen.push(selector);if(selector==='#review-video')return video;if(selector==='[data-form="round-draft"][data-item-id=""]')return fresh;if(selector==='[data-form=round-draft]')return old;return null;}};
  try{await context().ui.click({dataset:{action:'round-use-time'},closest:()=>null});assert.equal(fresh.elements.seconds.value,'12.3');assert.equal(old.elements.seconds.value,'3.5');assert.equal(paused,1);assert.equal(focused,1);assert.equal(inputs,1);assert.ok(seen.includes('[data-form="round-draft"][data-item-id=""]'));}finally{globalThis.document=original;}
});

test('an item-local time button updates only its own form and no available new form never retargets a saved item',async()=>{
  const original=globalThis.document;let writes=0;const form={elements:{seconds:{value:'4',dispatchEvent:()=>writes++},text:{focus(){}}}};globalThis.document={querySelector:selector=>selector==='#review-video'?{currentTime:9,pause(){}}:null};
  try{await context().ui.click({dataset:{action:'round-use-time'},closest:()=>form});assert.equal(form.elements.seconds.value,'9');assert.equal(writes,1);await context().ui.click({dataset:{action:'round-use-time'},closest:()=>null});assert.equal(writes,1);}finally{globalThis.document=original;}
});

test('round submission blocks real edits but accepts a cleared new form, leaving other form draft policies unchanged',async()=>{
  const Original=globalThis.FormData;globalThis.FormData=class{constructor(form){return new Map(Object.entries(form.values));}};
  try{
    const p=project(),form={dataset:{form:'round-submit',id:'d',versionId:'v1'},values:{representativeName:'취합 담당자',confirmed:'yes'}};
    const dirty=context({hasDraft:type=>type==='round-draft'&&feedbackDraftChanged(p,entry({text:'바뀐 의견'}))});await dirty.ui.submit(form);assert.equal(dirty.calls.length,0);assert.match(dirty.notices[0],/초안에 저장/);
    const cleared=context({hasDraft:type=>type==='round-draft'&&feedbackDraftChanged(p,entry({text:''},{id:'new:v1',itemId:''}))});await cleared.ui.submit(form);assert.equal(cleared.calls[0].action,'submit_feedback_round');
    const other=context({hasDraft:type=>type==='deliverables'});await other.ui.click({dataset:{action:'deliverable-confirm',revision:'1'}});assert.equal(other.calls.length,0);assert.match(other.notices[0],/납품 규격/);
  }finally{globalThis.FormData=Original;}
});

test('the reset control is explicit, form local and added only once',()=>{
  const original=globalThis.document,children=[];globalThis.document={createElement:()=>({dataset:{}})};
  try{const form={querySelector:()=>children[0]||null,append:node=>children.push(node)};addProductionDraftReset(form);addProductionDraftReset(form);assert.equal(children.length,1);assert.equal(children[0].type,'button');assert.equal(children[0].dataset.action,'reset-production-draft');assert.match(children[0].textContent,/작성 내용 지우고/);}finally{globalThis.document=original;}
});

test('explicit stale-preview reset clears only that local draft and restores new binding and unchecked confirmation',async()=>{
  const restoreSource=appSource.slice(appSource.indexOf('function restore('),appSource.indexOf('function clearDraft('));
  const clickStart=appSource.indexOf("document.addEventListener('click',async event=>{"),clickSource=appSource.slice(clickStart,appSource.indexOf('\n});',clickStart)+4);
  for(const type of ['preview-confirm','preview-choice']){
    const data=type==='preview-confirm'?{form:type,id:'flow',signature:'new-signature'}:{form:type,id:'sample',revision:'2'},oldBound=type==='preview-confirm'?{...data,signature:'old-signature'}:{...data,revision:'1'};
    const check={name:type==='preview-confirm'?'confirmed':'liked',type:'checkbox',value:type==='preview-confirm'?'yes':'color',checked:false,closest:()=>null},note={name:'note',type:'textarea',value:'',closest:()=>null};
    const form={dataset:{...data},elements:[check,note],closest:()=>null},key=type+':'+data.id,drafts=new Map([[key,{boundData:oldBound,values:{[check.name]:[check.value],note:'이전 내용의 메모'},revision:1}],['other-form',{values:{text:'다른 작성 내용'}}]]);
    let click,refreshes=0,resets=0;const notices=[];
    const sandbox={drafts,draftKey:form=>form.dataset.form+':'+form.dataset.id,addProductionDraftReset:()=>resets++,document:{addEventListener:(name,handler)=>{if(name==='click')click=handler;}},busy:false,loading:false,s:{error:''},projectStamp:()=>({id:'p'}),current:()=>true,notice:text=>notices.push(text),refresh:async()=>{refreshes++;form.dataset={...data};check.checked=false;note.value='';vm.runInContext('restore(scope)',sandbox);},scope:{querySelectorAll:()=>[form]}};
    vm.createContext(sandbox);vm.runInContext(restoreSource+'\n'+clickSource,sandbox);vm.runInContext('restore(scope)',sandbox);
    assert.deepEqual(form.dataset,oldBound);assert.equal(check.checked,true);assert.equal(note.value,'이전 내용의 메모');assert.equal(resets,1);
    const button={dataset:{action:'reset-production-draft'},closest:()=>form};await click({target:{closest:()=>button}});
    assert.equal(drafts.has(key),false);assert.equal(drafts.get('other-form').values.text,'다른 작성 내용');assert.deepEqual(form.dataset,data);assert.equal(check.checked,false);assert.equal(note.value,'');assert.equal(refreshes,1);assert.match(notices[0],/최신 내용/);
  }
});

test('busy state prevents draft disposal while a save is in flight',async()=>{
  const clickStart=appSource.indexOf("document.addEventListener('click',async event=>{"),clickSource=appSource.slice(clickStart,appSource.indexOf('\n});',clickStart)+4);let click,cleared=false,refreshed=false;
  const sandbox={document:{addEventListener:(_,handler)=>{click=handler;}},busy:true,loading:false,drafts:{delete:()=>{cleared=true;}},refresh:()=>{refreshed=true;}};vm.createContext(sandbox);vm.runInContext(clickSource,sandbox);
  await click({target:{closest:()=>({dataset:{action:'reset-production-draft'}})}});assert.equal(cleared,false);assert.equal(refreshed,false);
});

test('stale deliverable reset releases the old revision and edited rows while preserving unrelated local drafts',async()=>{
  const restoreSource=appSource.slice(appSource.indexOf('function restore('),appSource.indexOf('function clearDraft('));
  const clickStart=appSource.indexOf("document.addEventListener('click',async event=>{"),clickSource=appSource.slice(clickStart,appSource.indexOf('\n});',clickStart)+4);
  const freshRows=[{label:'서버의 최신 규격',durationSeconds:30}],oldRows=[{label:'이전 버전에서 편집한 규격',durationSeconds:15}],revision={name:'deliverableRevision',type:'hidden',value:'2',closest:()=>null};
  const form={dataset:{form:'deliverables'},elements:[revision],rows:structuredClone(freshRows),closest:()=>null},drafts=new Map([['deliverables',{values:{deliverableRevision:'1'},deliverableRows:oldRows,revision:1}],['round-draft:other',{values:{text:'다른 작성 내용'}}]]);
  let click,refreshes=0,resets=0;const notices=[];
  const sandbox={drafts,draftKey:form=>form.dataset.form,addProductionDraftReset:()=>resets++,restoreDeliverableRows:(form,rows)=>{form.rows=structuredClone(rows);},document:{addEventListener:(name,handler)=>{if(name==='click')click=handler;}},busy:false,loading:false,s:{error:''},projectStamp:()=>({id:'p'}),current:()=>true,notice:text=>notices.push(text),refresh:async()=>{refreshes++;form.rows=structuredClone(freshRows);revision.value='2';vm.runInContext('restore(scope)',sandbox);},scope:{querySelectorAll:()=>[form]}};
  vm.createContext(sandbox);vm.runInContext(restoreSource+'\n'+clickSource,sandbox);vm.runInContext('restore(scope)',sandbox);
  assert.equal(revision.value,'1');assert.deepEqual(form.rows,oldRows);assert.equal(resets,1);
  const button={dataset:{action:'reset-production-draft'},closest:()=>form};await click({target:{closest:()=>button}});
  assert.equal(drafts.has('deliverables'),false);assert.equal(drafts.get('round-draft:other').values.text,'다른 작성 내용');assert.equal(revision.value,'2');assert.deepEqual(form.rows,freshRows);assert.equal(refreshes,1);assert.match(notices[0],/최신 내용/);
});
