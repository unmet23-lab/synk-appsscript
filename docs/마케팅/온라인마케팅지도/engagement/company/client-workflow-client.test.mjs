import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./public/client-projects.js',import.meta.url),'utf8');
const projectId='11111111-1111-4111-8111-111111111111',versionId='22222222-2222-4222-8222-222222222222',messageId='33333333-3333-4333-8333-333333333333';
function context(){
  const forms=[],elements=new Map(),events={};const sandbox={URL,URLSearchParams,location:{origin:'https://company.example',href:'https://company.example/'},state:{user:{id:'owner',role:'member'},tab:'workroom'},wr:{view:'clients'},document:{querySelectorAll:()=>forms,getElementById:id=>elements.get(id),addEventListener:(event,handler)=>{(events[event]||=[]).push(handler);}},requestAnimationFrame(){},escape:value=>String(value??'').replaceAll('<','&lt;').replaceAll('>','&gt;')};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);vm.runInContext(`clientDesk.userId='owner';clientDesk.id='${projectId}'`,sandbox);
  return {sandbox,forms,elements,events,run:code=>vm.runInContext(code,sandbox)};
}
test('scene links accept only same-origin project routes with finite bounds',()=>{
  const f=context(),valid=`/?tab=workroom&section=clients&project=${projectId}&version=${versionId}&message=${messageId}&seconds=12`;
  assert.equal(f.sandbox.cdReadTarget(valid).seconds,12);
  for(const href of ['https://evil.example'+valid,valid.replace('seconds=12','seconds=Infinity'),valid.replace('seconds=12','seconds=-1'),valid.replace('project='+projectId,'project=../../secret'),valid.replace('section=clients','section=tools')])assert.equal(f.sandbox.cdReadTarget(href),null);
});
test('rights reminder links accept only one explicit current source and preserve it through navigation',async()=>{
  const f=context(),target='material:reference:'+versionId,href=`/?tab=workroom&section=clients&project=${projectId}&rights=1&rightsTarget=${encodeURIComponent(target)}`;
  const parsed=f.sandbox.cdReadTarget(href);assert.equal(parsed.rights,true);assert.equal(parsed.rightsTarget,target);assert.equal(f.sandbox.cdReadTarget(href.replace(encodeURIComponent(target),'portfolio')).rightsTarget,'portfolio');
  for(const bad of [href+'&rights=1',href+'&delivery=1',href+'&message='+messageId,href+'&next=/admin',href+'#secret',href.replace('rights=1&',''),href.replace('rights=1','rights=0'),href.replace(encodeURIComponent(target),'material%3Aother%3A'+versionId),href.replace(encodeURIComponent(target),'../../private'),href.replace(encodeURIComponent(target),''),href.replace(projectId,'bad')])assert.equal(f.sandbox.cdReadTarget(bad),null,bad);
  let replaced='',loaded=0;f.sandbox.history={replaceState:(_state,_title,value)=>{replaced=value;}};f.sandbox.render=()=>{};f.sandbox.selectWorkspaceView=()=>{};f.sandbox.clientDeskLoad=async()=>{loaded++;};assert.equal(f.sandbox.openClientWorkflowLink(href),true);assert.equal(new URL(replaced,'https://company.example').searchParams.get('rightsTarget'),target);assert.equal(loaded,1);
  vm.runInContext(await readFile(new URL('./public/weekly-summary.js',import.meta.url),'utf8'),f.sandbox);assert.equal(f.sandbox.wksHref(href),href);assert.equal(f.sandbox.wksHref(href+'&delivery=1'),'');
});
test('rights deep links focus the actual source after its asynchronous panel content arrives',()=>{
  const f=context(),target='material:reference:'+versionId;let revealed=0,focused=0;
  f.run(`clientDesk.target={projectId:'${projectId}',versionId:null,messageId:null,seconds:null,rights:true,rightsTarget:'${target}'}`);
  f.sandbox.cdApplyTarget();assert.equal(f.run('clientDesk.targetApplied'),'');
  f.sandbox.clientProjectReveal=()=>{revealed++;};f.elements.set('client-rights-item-'+projectId+'-'+target,{scrollIntoView(options){assert.equal(options.block,'start');},focus(options){assert.equal(options.preventScroll,true);focused++;}});
  f.sandbox.cdApplyTarget();assert.equal(revealed,1);assert.equal(focused,1);f.sandbox.cdApplyTarget();assert.equal(focused,1);
});
test('drafts survive unrelated request refresh and clear on account reset',()=>{
  const f=context(),fields={summary:{value:'',disabled:false},title:{value:'server title',disabled:false}},form={dataset:{clientForm:'project'},elements:{namedItem:name=>fields[name]},closest:()=>null};
  f.forms.push(form);f.sandbox.cdRememberDraft({target:{name:'summary',value:'unsaved source change',closest:()=>form}});
  f.sandbox.cdRestoreDrafts();assert.equal(fields.summary.value,'unsaved source change');assert.equal(fields.title.value,'server title');
  fields.summary.value='new server value';f.sandbox.cdRestoreDrafts();assert.equal(fields.summary.value,'unsaved source change');
  f.run('clientDeskReset()');assert.equal(f.run('Object.keys(clientDesk.drafts).length'),0);
});
test('deep link applies actual media currentTime after metadata and ignores repeats',()=>{
  const f=context();let onMetadata,focused=false,scrolled=false;
  f.elements.set('client-version-'+versionId,{scrollIntoView(){scrolled=true},focus(){focused=true}});
  const video={isConnected:true,readyState:0,duration:30,currentTime:0,addEventListener(event,handler){assert.equal(event,'loadedmetadata');onMetadata=handler}};
  f.elements.set('client-video-'+versionId,video);f.run(`clientDesk.target={projectId:'${projectId}',versionId:'${versionId}',messageId:'${messageId}',seconds:12}`);
  f.sandbox.cdApplyTarget();assert.equal(focused,true);assert.equal(scrolled,true);assert.equal(video.currentTime,0);onMetadata();assert.equal(video.currentTime,12);
  video.currentTime=15;f.sandbox.cdApplyTarget();assert.equal(video.currentTime,15,'repeat render must not interrupt media playback');
});

test('old-session mutation failure cannot unlock or replace the current session state',async()=>{
  const f=context();let rejectOld;const notices=[];
  f.sandbox.api=()=>new Promise((_resolve,reject)=>{rejectOld=reject;});f.sandbox.notify=message=>notices.push(message);
  const pending=f.sandbox.cdMutate('/api/client-projects/'+projectId,{revision:1});
  f.run('clientDeskReset(); clientDesk.userId="owner"; clientDesk.busy=true; clientDesk.error="current session"');
  rejectOld(Object.assign(new Error('previous session changed'),{code:'SESSION_CHANGED'}));await pending;
  assert.equal(f.run('clientDesk.busy'),true);assert.equal(f.run('clientDesk.error'),'current session');assert.deepEqual(notices,[]);
});
test('upload finishing after same-account relogin preserves the new draft',async()=>{
  const f=context();let resolveUpload,loads=0;const notices=[];
  f.sandbox.fetch=()=>new Promise(resolve=>{resolveUpload=resolve;});f.sandbox.notify=message=>notices.push(message);
  f.sandbox.api=async()=>{loads++;return {projects:[],items:[]};};f.sandbox.render=()=>{};
  const file={size:1,type:'image/png',name:'test.png'},button={disabled:false,isConnected:false};
  f.sandbox.FormData=class {constructor(){return new Map([['file',file],['label','v1'],['kind','preview'],['guide','']]);}};
  f.run(`clientDesk.data={projects:[{id:'${projectId}',revision:1}]}`);
  const form={dataset:{clientForm:'version'},querySelector:()=>button};
  const pending=f.events.submit[0]({target:{closest:()=>form},preventDefault(){}});
  f.run(`clientDeskReset(); clientDesk.userId='owner';clientDesk.id='${projectId}';clientDesk.drafts['${projectId}:version:']={label:'new session draft'}`);
  resolveUpload({ok:true,json:async()=>({})});await pending;
  assert.equal(f.run(`clientDesk.drafts['${projectId}:version:'].label`),'new session draft');assert.equal(loads,0);assert.deepEqual(notices,[]);
});
test('current-session failed save retains the draft and allows retry',async()=>{
  const f=context(),notices=[];f.sandbox.notify=message=>notices.push(message);
  f.sandbox.api=async()=>{throw new Error('conflict');};f.run('clientDesk.drafts.edit={text:"keep"}');
  await f.sandbox.cdMutate('/api/client-projects/'+projectId,{revision:1},'edit');
  assert.equal(f.run('clientDesk.drafts.edit.text'),'keep');assert.equal(f.run('clientDesk.busy'),false);assert.deepEqual(notices,['conflict']);
});
test('current-session upload success clears only the saved draft and refreshes records',async()=>{
  const f=context();let loads=0;f.sandbox.fetch=async()=>({ok:true,json:async()=>({})});
  f.sandbox.api=async()=>{loads++;return {projects:[{id:projectId}],items:[]};};f.sandbox.render=()=>{};f.sandbox.notify=()=>{};
  const button={disabled:false,isConnected:true};f.sandbox.FormData=class {constructor(){return new Map([['file',{size:1,type:'image/png',name:'test.png'}],['label','v1'],['kind','preview'],['guide','']]);}};
  f.run(`clientDesk.data={projects:[{id:'${projectId}',revision:1}]};clientDesk.drafts['${projectId}:version:']={label:'saved'};clientDesk.drafts.other={text:'keep'}`);
  const form={dataset:{clientForm:'version'},querySelector:()=>button};await f.events.submit[0]({target:{closest:()=>form},preventDefault(){}});
  assert.equal(f.run(`clientDesk.drafts['${projectId}:version:']`),undefined);assert.equal(f.run('clientDesk.drafts.other.text'),'keep');assert.equal(loads,2);assert.equal(button.disabled,false);
});

test('typing a newer upload guide while the upload is pending must preserve that unsaved guide',async()=>{
  const f=context();let resolveUpload;
  f.sandbox.fetch=()=>new Promise(resolve=>{resolveUpload=resolve;});f.sandbox.notify=()=>{};
  f.sandbox.api=async()=>({projects:[{id:projectId}],items:[]});f.sandbox.render=()=>{};
  const button={disabled:false,isConnected:true};
  f.sandbox.FormData=class {constructor(){return new Map([['file',{size:1,type:'image/png',name:'synthetic.png'}],['label','v1'],['kind','preview'],['guide','submitted guide']]);}};
  f.run(`clientDesk.data={projects:[{id:'${projectId}',revision:1}]};clientDesk.drafts['${projectId}:version:']={guide:'submitted guide'}`);
  const form={dataset:{clientForm:'version'},querySelector:()=>button};
  const pending=f.events.submit[0]({target:{closest:()=>form},preventDefault(){}});
  f.sandbox.cdRememberDraft({target:{name:'guide',value:'new unsaved guide typed during upload',disabled:false,closest:()=>form}});
  assert.equal(f.run(`clientDesk.drafts['${projectId}:version:'].guide`),'new unsaved guide typed during upload');
  resolveUpload({ok:true,json:async()=>({})});await pending;
  assert.equal(f.run(`clientDesk.drafts['${projectId}:version:']?.guide`),'new unsaved guide typed during upload');
});
test('typing a newer project summary while the save is pending must preserve the new unsaved summary',async()=>{
  const f=context();let resolveSave;f.sandbox.notify=()=>{};f.sandbox.render=()=>{};
  f.sandbox.api=path=>path==='/api/client-projects/'+projectId?new Promise(resolve=>{resolveSave=resolve;}):Promise.resolve({projects:[{id:projectId}],items:[]});
  f.run(`clientDesk.drafts['${projectId}:project:']={summary:'submitted summary'}`);
  const pending=f.sandbox.cdMutate('/api/client-projects/'+projectId,{revision:1,summary:'submitted summary'},projectId+':project:');
  const form={dataset:{clientForm:'project'}};
  f.sandbox.cdRememberDraft({target:{name:'summary',value:'new unsaved summary typed during save',disabled:false,closest:()=>form}});
  resolveSave({project:{id:projectId}});await pending;
  assert.equal(f.run(`clientDesk.drafts['${projectId}:project:']?.summary`),'new unsaved summary typed during save');
});

test('new project creation carries later edits to the created project form',async()=>{
  const f=context();let resolveCreate;f.sandbox.notify=()=>{};f.sandbox.render=()=>{};
  f.sandbox.api=path=>path==='/api/client-projects'&&!resolveCreate?new Promise(resolve=>{resolveCreate=resolve;}):Promise.resolve({projects:[{id:projectId}],items:[]});
  f.run('clientDesk.id="new";clientDesk.drafts["new:project:"]={summary:"submitted summary"}');
  const pending=f.sandbox.cdMutate('/api/client-projects',{summary:'submitted summary'},'new:project:');
  const fields={summary:{value:'submitted summary',disabled:false}},form={dataset:{clientForm:'project'},elements:{namedItem:name=>fields[name]},closest:()=>null};
  f.sandbox.cdRememberDraft({target:{name:'summary',value:'later unsaved summary',disabled:false,closest:()=>form}});
  const revision=f.run('clientDesk.draftRevisions["new:project:"]');
  resolveCreate({project:{id:projectId}});await pending;
  assert.equal(f.run('clientDesk.id'),projectId);f.forms.push(form);f.sandbox.cdRestoreDrafts();
  assert.equal(fields.summary.value,'later unsaved summary');
  assert.equal(f.run(`clientDesk.draftRevisions['${projectId}:project:']`),revision);
  assert.equal(f.run('clientDesk.drafts["new:project:"]'),undefined);assert.equal(f.run('clientDesk.draftRevisions["new:project:"]'),undefined);
});

test('new project draft migration does not overwrite existing project drafts',async()=>{
  const f=context();let resolveCreate;f.sandbox.notify=()=>{};f.sandbox.render=()=>{};
  f.sandbox.api=path=>path==='/api/client-projects'&&!resolveCreate?new Promise(resolve=>{resolveCreate=resolve;}):Promise.resolve({projects:[{id:projectId}],items:[]});
  f.run(`clientDesk.id='new';clientDesk.drafts['new:project:']={summary:'submitted summary'};clientDesk.drafts['${projectId}:project:']={summary:'existing target draft'};clientDesk.draftRevisions['${projectId}:project:']=7;clientDesk.drafts.other={summary:'unrelated draft'}`);
  const pending=f.sandbox.cdMutate('/api/client-projects',{summary:'submitted summary'},'new:project:');
  const form={dataset:{clientForm:'project'}};
  f.sandbox.cdRememberDraft({target:{name:'summary',value:'later unsaved summary',disabled:false,closest:()=>form}});
  resolveCreate({project:{id:projectId}});await pending;
  assert.equal(f.run(`clientDesk.drafts['${projectId}:project:'].summary`),'existing target draft');
  assert.equal(f.run(`clientDesk.draftRevisions['${projectId}:project:']`),7);
  assert.equal(f.run('clientDesk.drafts["new:project:"].summary'),'later unsaved summary');
  assert.equal(f.run('clientDesk.drafts.other.summary'),'unrelated draft');
});
