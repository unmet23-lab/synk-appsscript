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
