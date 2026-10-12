import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {kickoffView,kickoffSubmission} from './public/pulse-app/kickoff-view.mjs';
import {projectView} from './public/pulse-app/views.mjs';
import {PulseError,parseInvite} from './public/pulse-app/api.mjs';

globalThis.location=new URL('http://127.0.0.1:64046/pulse-app/');
const project={id:'p',revision:7,title:'준비 시험',stage:'planning',versions:[],messages:[],studio:{preferences:{},references:[],assets:[],concepts:[],scenes:[],comments:[]},kickoff:{enabled:true,dueDate:'2026-10-13',requestedDeadline:'2026-10-20',confirmedDeadline:'',status:'waiting',statusLabel:'준비 확인 중',requirements:[{id:'logo',label:'로고 원본',required:true,status:'missing',sourceKey:'',sourceLabel:''},{id:'copy',label:'최종 문구',required:true,status:'received',sourceKey:'strategy:screenCopy',sourceLabel:'화면 문구'},{id:'reference',label:'참고자료',required:false,status:'ready',sourceKey:'reference:old',sourceLabel:'기존 참고'}],sources:[{key:'asset:new',kind:'asset',label:'logo.png',url:'/pulse/media/logo'},{key:'reference:old',kind:'reference',label:'기존 참고',url:'https://example.com/ref'},{key:'reference:new',kind:'reference',label:'새 참고',url:'https://example.com/new'},{key:'strategy:screenCopy',kind:'strategy',label:'화면 문구'}],checks:[{id:'strategy',label:'기획 확인',status:'ready',text:'현재 설계 확인 완료'},{id:'deadline',label:'확정 전달일',status:'missing',text:'담당자와 일정을 정해 주세요.'}],missingCount:2}};
const state=(patch={})=>({mode:'customer',project:structuredClone(project),tab:'strategy',...patch});

test('kickoff opt-in card is integrated on strategy and absent when disabled or unrelated',()=>{
  assert.equal(kickoffView(state({project:{...project,kickoff:{enabled:false}}})), '');
  assert.equal(kickoffView(state({project:{...project,kickoff:null}})), '');
  assert.match(projectView(state()),/제작 시작 전 준비/);
  assert.doesNotMatch(projectView(state({tab:'history'})),/kickoff-card/);
});

test('customer sees received vs usable and separate requested, confirmed and readiness dates',()=>{
  const html=kickoffView(state());
  for(const text of ['도착 · 담당자 확인 대기','사용 가능','준비 확인일','2026-10-13','희망 전달일','2026-10-20','확정 전달일','아직 미확정','기획 확인','자료 바꾸기','담당자가 새 자료'])assert.ok(html.includes(text),text);
  assert.match(html,/data-form="kickoff-source" data-id="logo" data-revision="7"/);
  assert.match(html,/data-action="kickoff-reference"/);assert.match(html,/data-action="kickoff-strategy"/);
});

test('staff, demo, archived and waived records provide no customer mutation form',()=>{
  for(const s of [state({mode:'staff'}),state({demo:true}),state({project:{...project,stage:'archived'}}),state({project:{...project,kickoff:{...project.kickoff,status:'archived'}}})])assert.doesNotMatch(kickoffView(s),/data-form="kickoff-source"/);
  assert.match(kickoffView(state({mode:'staff'})),/section=clients&amp;project=p&amp;kickoff=1/);
  const s=state();s.project.kickoff.requirements.forEach(row=>row.status='waived');assert.doesNotMatch(kickoffView(s),/data-form="kickoff-source"/);
});

test('customer renderer escapes content, rejects unsafe source URLs and omits internal intake options',()=>{
  const s=state();s.project.kickoff.requirements[0].label='<img src=x>';s.project.kickoff.requirements[0].sourceLabel='<script>bad</script>';s.project.kickoff.requirements[0].sourceKey='asset:new';s.project.kickoff.sources[0].url='javascript:alert(1)';s.project.kickoff.sources[0].label='"><b>new</b>';s.project.kickoff.sources.push({key:'intake:secret',kind:'intake',label:'internal'});
  const html=kickoffView(s);assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<img src=x>|javascript:|intake:secret|>internal</);
});

test('submission binds requirement and exact project revision and rejects stale, disabled and inaccessible choices',()=>{
  assert.deepEqual(kickoffSubmission(state(),{id:'logo',revision:'7'},'asset:new'),{action:'submit_kickoff_source',revision:7,requirementId:'logo',sourceKey:'asset:new'});
  assert.throws(()=>kickoffSubmission(state(),{id:'logo',revision:6},'asset:new'),error=>error.status===409);
  for(const s of [state({mode:'staff'}),state({demo:true}),state({project:{...project,kickoff:{...project.kickoff,enabled:false}}}),state({project:{...project,stage:'archived'}})])assert.throws(()=>kickoffSubmission(s,{id:'logo',revision:7},'asset:new'));
  assert.throws(()=>kickoffSubmission(state(),{id:'missing',revision:7},'asset:new'),error=>error.status===409);
  for(const key of ['','intake:secret','asset:not-shared'])assert.throws(()=>kickoffSubmission(state(),{id:'logo',revision:7},key));
  assert.throws(()=>kickoffSubmission(state(),{id:'copy',revision:7},'strategy:screenCopy'),/이미 이 항목/);
});

function fixture({url='http://127.0.0.1:64046/pulse-app/'}={}){
  const requests=[],listeners={},notices=[];
  const element=()=>({innerHTML:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,setAttribute(){},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}});
  const nodes=new Map(['#main','#app-dialog','#notice','#header-actions','#pulse-live','#connection-banner'].map(key=>[key,element()]));
  // Production-specific actions are outside this fixture; preserve the app router's await boundary.
  const productionUI=()=>({submit:()=>false,click:()=>false,render(){},reset(){}});
  const context=vm.createContext({productionUI,URL,URLSearchParams,Map,Set,WeakSet,Date,Intl,Number,JSON,Object,Array,String,Promise,PulseError,parseInvite,kickoffSubmission,console,FormData:class {constructor(form){this.form=form;}*[Symbol.iterator](){yield*Object.entries(this.form.values);}getAll(name){return [this.form.values[name]].filter(Boolean);}},setTimeout:()=>1,clearTimeout(){},location:new URL(url),history:{replaceState(){}},navigator:{onLine:true},window:{addEventListener(){},isSecureContext:false},document:{visibilityState:'visible',documentElement:{classList:{toggle(){}}},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(name,fn){(listeners[name]||=[]).push(fn);}},header:()=>'',welcome:()=>'',login:()=>'',picker:()=>'',projectView:()=>'',liveView:()=>'',dialogContent:()=>'',networkRequest(path,settings){return new Promise((resolve,reject)=>requests.push({path,settings,resolve,reject}));},foregroundProjectOptions:(_path,settings)=>settings,createLiveConnection:()=>({stop(){}})});
  let source=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace("const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;",'const demo=null;');
  source=source.slice(0,source.indexOf("if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start"));
  vm.runInContext(source,context);context.seed=structuredClone(project);const run=code=>vm.runInContext(code,context);
  run("Object.assign(s,{mode:'customer',project:seed,csrf:'local-synthetic',user:null});render=()=>{};renderLive=()=>{};syncLive=()=>{};notice=value=>notes.push(value)");context.notes=notices;
  const form={dataset:{form:'kickoff-source',id:'logo',revision:'7'},values:{sourceKey:'asset:new'},closest(){return this;},elements:[]};
  const submit=()=>listeners.submit[0]({target:form,preventDefault(){}});
  return {context,run,requests,form,submit,notices};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('actual submit handler posts customer CSRF, blocks duplicate in-flight submits and preserves unrelated drafts',async()=>{
  const f=fixture();f.run("drafts.set(identity()+':strategy:',{revision:1,values:{product:'미저장 기획'}})");
  const first=f.submit();await f.submit();assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].path,'/pulse/api/action');assert.equal(f.requests[0].settings.csrf,'local-synthetic');assert.equal(f.requests[0].settings.staff,false);
  assert.deepEqual(plain(f.requests[0].settings.body),{action:'submit_kickoff_source',revision:7,requirementId:'logo',sourceKey:'asset:new'});
  f.requests[0].resolve({project:{...project,revision:8}});await first;assert.equal(f.run('s.project.revision'),8);assert.equal(f.run("drafts.get(identity()+':strategy:').values.product"),'미저장 기획');
});

test('actual 409 response keeps chosen source and drafts, while stale form sends no request',async()=>{
  const f=fixture();f.run("drafts.set(identity()+':kickoff-source:logo',{revision:1,values:{sourceKey:'asset:new'}})");const pending=f.submit();await Promise.resolve();f.requests[0].reject(new PulseError('다른 변경',409));await pending;
  assert.equal(f.run('s.conflict'),true);assert.equal(f.run("drafts.get(identity()+':kickoff-source:logo').values.sourceKey"),'asset:new');
  const g=fixture();g.form.dataset.revision='6';await g.submit();assert.equal(g.requests.length,0);assert.equal(g.run('s.conflict'),true);
});

test('account or project transition ignores a late successful customer submission',async()=>{
  const f=fixture(),pending=f.submit();await Promise.resolve();f.run("resetContext();s.user={id:'another'};s.mode='staff';");f.requests[0].resolve({project:{...project,revision:8}});await pending;
  assert.equal(f.run('s.project'),null);assert.equal(f.run('s.user.id'),'another');assert.equal(f.notices.length,0);
});

test('staff deeplink selects only an accessible project and applies once',async()=>{
  const f=fixture({url:'http://127.0.0.1:64046/pulse-app/?mode=staff&project=p&tab=strategy'});f.run("s.mode='staff';s.user={id:'staff'};s.workspace={projects:[{id:'p'}]};loads=[];loadProject=async id=>{loads.push(id);};");await f.run('openInitialStaffProject()');await f.run('openInitialStaffProject()');assert.deepEqual(plain(f.run('loads')),['p']);assert.equal(f.run('s.tab'),'strategy');
  const g=fixture({url:'http://127.0.0.1:64046/pulse-app/?mode=staff&project=private&tab=strategy'});g.run("s.mode='staff';s.user={id:'staff'};s.workspace={projects:[{id:'p'}]};loads=[];loadProject=async id=>{loads.push(id);};");await g.run('openInitialStaffProject()');assert.equal(g.run('loads.length'),0);assert.match(g.notices[0],/열람 권한/);
});
