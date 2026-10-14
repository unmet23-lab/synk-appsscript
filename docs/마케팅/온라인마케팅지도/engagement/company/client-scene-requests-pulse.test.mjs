import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {sceneRequestsSummary,sceneRequestView,sceneConfirmation} from './public/pulse-app/scene-requests-view.mjs';
import {projectView} from './public/pulse-app/views.mjs';
import {PulseError,parseInvite} from './public/pulse-app/api.mjs';

globalThis.location=new URL('http://127.0.0.1:64046/pulse-app/');
const id='01234567-89ab-cdef-0123-456789abcdef',sceneId='11234567-89ab-cdef-0123-456789abcdef';
const scene={id:sceneId,revision:3,title:'사용 방법',description:'새 설명',narration:'',screenText:'새 문구',duration:30,visibility:'customer'};
const request={id:'request-id',sceneId,title:scene.title,text:'화면 문구를 크게 해 주세요.',requestedRevision:1,currentRevision:3,resultRevision:3,status:'waiting_customer',statusLabel:'내부 표시',reason:'수정된 장면을 확인해 주세요.',createdAt:'2026-10-12T04:00:00.000Z',updatedAt:'2026-10-12T04:05:00.000Z',note:'PRIVATE-NOTE',history:[{actor:'PRIVATE-ACTOR'}],actions:[{label:'PRIVATE-ACTION'}]};
const project={id,revision:9,title:'장면 수정 시험',stage:'producing',versions:[],messages:[],studio:{preferences:{},references:[],assets:[],concepts:[],scenes:[scene],sceneReviews:[],comments:[]},sceneRequests:{items:[request],pendingCount:1,doneCount:0}};
const state=(patch={})=>({mode:'customer',project:structuredClone(project),tab:'storyboard',...patch});
const dataset=()=>({id:sceneId,revision:'3',projectRevision:'9',requestId:'request-id'});

test('request section follows its original scene and only appears on the storyboard with an explicit request',()=>{
  const s=state();assert.match(projectView(s),/요청한 수정과 확인 상태/);assert.match(projectView(s),/data-scene-request-id="request-id"/);
  assert.doesNotMatch(projectView({...s,tab:'strategy'}),/scene-request-list/);
  assert.equal(sceneRequestView(s,{...scene,id:'other'}),'');s.project.sceneRequests.items=[];assert.equal(sceneRequestsSummary(s),'');assert.equal(sceneRequestView(s,scene),'');
});

test('customer sees original request, request and submitted revisions while internal fields remain hidden',()=>{
  const s=state(),html=sceneRequestView(s,scene)+sceneRequestsSummary(s);assert.match(html,/화면 문구를 크게/);assert.match(html,/요청한 장면/);assert.match(html,/v1/);assert.match(html,/반영 제출한 장면/);assert.match(html,/위의 장면 확인 단추/);assert.doesNotMatch(html,/data-action="confirm-scene-request"/);assert.match(projectView(s),/수정된 장면 v3 확인/);assert.match(projectView(s),/data-project-revision="9"/);assert.doesNotMatch(html,/PRIVATE|내부 표시|requests=1/);
  s.project.sceneRequests.items.push({...request,id:'private',sceneId:'private-scene',text:'PRIVATE-SCENE'});assert.doesNotMatch(sceneRequestsSummary(s),/PRIVATE-SCENE|내 차례 2개/);
});

test('a new scene save or stale, unsubmitted and completed request does not fabricate completion or a confirmation action',()=>{
  for(const status of ['open','in_progress','review','changes_requested','stale','unavailable','archived']){const s=state();s.project.sceneRequests.items[0].status=status;s.project.sceneRequests.items[0].resultRevision=null;const html=sceneRequestView(s,scene);assert.match(html,/아직 제출 전/);assert.doesNotMatch(html,/data-action="confirm-scene-request"|수정된 장면을 확인했어요/);}
  const s=state();s.project.sceneRequests.items[0].status='done';s.project.sceneRequests.items[0].reason='수정된 장면을 확인했어요';const html=sceneRequestView(s,scene);assert.match(html,/수정된 장면을 확인했어요/);assert.doesNotMatch(html,/data-action="confirm-scene-request"/);
  const changed=state();changed.project.sceneRequests.items[0].resultRevision=2;assert.doesNotMatch(sceneRequestView(changed,scene),/data-action="confirm-scene-request"/);
});

test('staff summary links the exact project to existing request management and does not approve on behalf of customer',()=>{
  const s=state({mode:'staff',canEdit:true});s.project.sceneRequests.items.push({...request,id:'removed-request',sceneId:'removed',title:'제거된 장면',status:'unavailable'});const html=sceneRequestsSummary(s)+sceneRequestView(s,scene);assert.match(html,new RegExp('project='+id+'&amp;requests=1'));assert.match(html,/제거된 장면/);assert.doesNotMatch(html,/confirm-scene-request|data-mutate|data-form|PRIVATE/);
  const archived=state();archived.project.stage='archived';assert.doesNotMatch(sceneRequestView(archived,scene),/confirm-scene-request/);
});

test('request text and reason are escaped and confirmation binds both displayed project and scene revisions',()=>{
  const s=state();s.project.sceneRequests.items[0].text='<img src=x>';s.project.sceneRequests.items[0].reason='<script>bad</script>';const html=sceneRequestView(s,scene);assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img src=x>|<script>/);
  assert.deepEqual(sceneConfirmation(state(),dataset()),{sceneId,sceneRevision:3,status:'confirmed',text:''});
  for(const patch of [{revision:'2'},{projectRevision:'8'},{requestId:'unknown'},{id:'another'}])assert.throws(()=>sceneConfirmation(state(),{...dataset(),...patch}),error=>error.status===409);
  for(const status of ['done','stale','open','review']){const s=state();s.project.sceneRequests.items[0].status=status;assert.throws(()=>sceneConfirmation(s,dataset()),error=>error.status===409);}
  assert.throws(()=>sceneConfirmation(state({mode:'staff'}),dataset()),error=>error.status===409);
});

function fixture(){
  const requests=[],listeners={},notices=[];
  const element=()=>({innerHTML:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,setAttribute(){},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}});
  const nodes=new Map(['#main','#app-dialog','#notice','#header-actions','#pulse-live','#connection-banner'].map(key=>[key,element()]));
  // Production-specific actions are outside this fixture; preserve the app router's await boundary.
  const productionUI=()=>({submit:()=>false,click:()=>false,render(){},reset(){}});
  const context=vm.createContext({productionUI,URL,URLSearchParams,Map,Set,WeakSet,Date,Intl,Number,JSON,Object,Array,String,Promise,PulseError,parseInvite,sceneConfirmation,console,FormData:class{},setTimeout:()=>1,clearTimeout(){},location:new URL('http://127.0.0.1:64046/pulse-app/'),history:{replaceState(){}},navigator:{onLine:true},window:{addEventListener(){},isSecureContext:false},document:{visibilityState:'visible',documentElement:{classList:{toggle(){}}},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(name,fn){(listeners[name]||=[]).push(fn);}},header:()=>'',welcome:()=>'',login:()=>'',picker:()=>'',projectView:()=>'',liveView:()=>'',dialogContent:()=>'',networkRequest(path,settings){return new Promise((resolve,reject)=>requests.push({path,settings,resolve,reject}));},foregroundProjectOptions:(_path,settings)=>settings,createLiveConnection:()=>({stop(){}})});
  let source=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace("const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;",'const demo=null;');source=source.slice(0,source.indexOf("if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start"));vm.runInContext(source,context);context.seed=structuredClone(project);context.notes=notices;const run=code=>vm.runInContext(code,context);
  run("Object.assign(s,{mode:'customer',project:seed,csrf:'synthetic-csrf',user:null});render=()=>{};renderLive=()=>{};syncLive=()=>{};notice=value=>notes.push(value)");
  const click=async(data=dataset(),action='confirm-scene-request')=>{const button={disabled:false,dataset:{...data,action}};await listeners.click[0]({target:{closest:()=>button}});};
  return {run,requests,click,notices};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('actual confirmation uses existing customer review_scene endpoint and blocks duplicate in-flight actions',async()=>{
  const f=fixture(),first=f.click();await f.click();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/pulse/api/studio');assert.equal(f.requests[0].settings.csrf,'synthetic-csrf');assert.equal(f.requests[0].settings.staff,false);assert.deepEqual(plain(f.requests[0].settings.body),{sceneId,sceneRevision:3,status:'confirmed',text:'',action:'review_scene',revision:9});f.requests[0].resolve({project:{...project,revision:10}});await first;assert.equal(f.run('s.project.revision'),10);
});

test('actual confirmation refuses stale displayed project and scene revisions without sending a request',async()=>{
  for(const patch of [{projectRevision:'8'},{revision:'2'},{requestId:'missing'}]){const f=fixture();await f.click({...dataset(),...patch});assert.equal(f.requests.length,0);assert.equal(f.run('s.conflict'),true);assert.match(f.notices[0],/바뀌었어요/);}
});

test('a late response after account transition cannot restore the old project or claim completion',async()=>{
  const f=fixture(),pending=f.click();await Promise.resolve();f.run("resetContext();s.mode='staff';s.user={id:'replacement'};");f.requests[0].resolve({project:{...project,revision:10}});await pending;assert.equal(f.run('s.project'),null);assert.equal(f.run('s.user.id'),'replacement');assert.equal(f.notices.length,0);
});

test('a revision conflict preserves unrelated work and never changes request completion locally',async()=>{
  const f=fixture();f.run("drafts.set(identity()+':strategy:',{values:{product:'미저장 기획'},revision:1})");const pending=f.click();await Promise.resolve();f.requests[0].reject(new PulseError('새 장면을 확인해 주세요.',409));await pending;assert.equal(f.run('s.conflict'),true);assert.equal(f.run('s.project.sceneRequests.items[0].status'),'waiting_customer');assert.equal(f.run('drafts.size'),1);
});

test('ordinary scene confirmation also binds its rendered version and leaves request completion to the server',async()=>{
  const data=dataset();delete data.requestId;const f=fixture(),pending=f.click(data,'confirm-scene');await Promise.resolve();assert.equal(f.requests.length,1);assert.equal(f.run('s.project.sceneRequests.items[0].status'),'waiting_customer');f.requests[0].resolve({project:{...project,revision:10}});await pending;
  const stale=fixture();await stale.click({...data,revision:'2'},'confirm-scene');assert.equal(stale.requests.length,0);
});
