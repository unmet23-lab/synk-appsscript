import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {changesView} from './public/pulse-app/changes-view.mjs';
import {projectView} from './public/pulse-app/views.mjs';
import {PulseError,parseInvite} from './public/pulse-app/api.mjs';

globalThis.location=new URL('http://127.0.0.1:64046/pulse-app/');
const projectId='01234567-89ab-cdef-0123-456789abcdef',sceneId='11234567-89ab-cdef-0123-456789abcdef';
const project={id:projectId,revision:9,title:'변경 비교 시험',stage:'production',versions:[],messages:[],studio:{preferences:{},references:[],assets:[],concepts:[],scenes:[{id:sceneId,title:'제품 설명',revision:1,duration:30}],comments:[]},changes:{enabled:true,status:'pending',statusLabel:'내부 상태 라벨',canEdit:true,canCapture:true,captureBlockers:['내부 누락'],baseline:{id:'private-baseline',strategyRevision:1,at:'2026-10-12T01:00:00.000Z'},currentStrategyRevision:2,currentStrategyConfirmed:false,changeKey:'private-change-key',changes:[{id:'durationSeconds',kind:'strategy',label:'희망 영상 길이',before:'30초',after:'60초'},{id:'screenCopy',kind:'strategy',label:'화면 문구',before:'이전 문구',after:'새 문구'}],impacts:[{id:'scene:'+sceneId,kind:'scene',label:'제품 설명 재검토',reason:'길이 변경',sceneId,checked:false,note:'검토 메모'},{id:'terms',kind:'terms',label:'제작 조건',reason:'내부 원가 판단',checked:true,note:'개별 금액 메모'}],pendingCount:2,canAdvance:false,requestText:'내부 요청 초안',history:[{actor:'내부 담당자',at:'2026-10-12',strategyRevision:1,changeCount:2}]}};
const state=(patch={})=>({mode:'customer',project:structuredClone(project),tab:'strategy',...patch});

test('change comparison appears only for enabled projects on the strategy tab',()=>{
  assert.equal(changesView(state({project:{...project,changes:null}})),'');
  assert.equal(changesView(state({project:{...project,changes:{enabled:false}}})),'');
  assert.match(projectView(state()),/확정 이후 달라진 내용/);
  assert.doesNotMatch(projectView(state({tab:'history'})),/changes-card/);
});

test('customer comparison shows the exact before and after but never internal impacts or metadata',()=>{
  const html=changesView(state());
  assert.match(html,/30초/);assert.match(html,/60초/);assert.match(html,/이전 문구/);assert.match(html,/새 문구/);
  assert.match(html,/현재 제작 설계 확인 필요/);assert.match(html,/data-action="changes-strategy"/);
  assert.doesNotMatch(html,/내부|private-|개별 금액|changes-scene|data-mutate|data-form|changes=1/);
  const s=state();s.project.changes.currentStrategyConfirmed=true;assert.match(changesView(s),/현재 제작 설계 확인 완료/);
});

test('diff values are escaped as plain content and empty values stay explicit',()=>{
  const s=state();s.project.changes.changes=[{label:'<img src=x>',before:'<script>bad</script>',after:'" onmouseover="bad'},{label:'삭제한 문구',before:['첫 줄','둘째 줄'],after:null}];
  const html=changesView(s);assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/&lt;script&gt;/);assert.match(html,/정한 내용 없음/);assert.match(html,/첫 줄 · 둘째 줄/);assert.doesNotMatch(html,/<script>|<img src=x>| onmouseover="bad/);
});

test('staff impact summary stays read-only and links only to scenes present in the loaded project',()=>{
  const s=state({mode:'staff',canEdit:false});s.project.changes.impacts.push({id:'other',kind:'scene',sceneId:'other-project-scene',label:'삭제된 장면',reason:'이전 장면',checked:false});
  const html=changesView(s);assert.match(html,/검토 메모/);assert.match(html,/검토 완료/);assert.match(html,/data-action="changes-scene" data-id="11234567/);assert.doesNotMatch(html,/data-id="other-project-scene"|data-mutate|data-form/);assert.match(html,new RegExp('section=clients&amp;project='+projectId+'&amp;changes=1'));assert.doesNotMatch(html,/private-change-key|private-baseline/);
});

test('archived and unchanged comparisons preserve readable records without a new confirmation action',()=>{
  const s=state();s.project.stage='archived';s.project.changes.status='archived';s.project.changes.changes=[];
  const html=changesView(s);assert.match(html,/보관된 프로젝트/);assert.match(html,/달라진 항목이 없습니다/);assert.doesNotMatch(html,/data-action="changes-strategy"|confirm-strategy|data-mutate/);
});

function fixture({url=`http://127.0.0.1:64046/pulse-app/?mode=staff&project=${projectId}&tab=storyboard&scene=${sceneId}`}={}){
  const requests=[],listeners={},notices=[],cards=new Map(),focuses=[];
  const element=()=>({innerHTML:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,setAttribute(){},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}});
  const nodes=new Map(['#main','#app-dialog','#notice','#header-actions','#pulse-live','#connection-banner'].map(key=>[key,element()]));
  for(const id of ['scene-'+sceneId,'agreement'])cards.set(id,{id,setAttribute(){},focus(){focuses.push(id);},scrollIntoView(){}});
  nodes.get('#main').querySelector=selector=>selector==='.strategy-agreement'?cards.get('agreement'):cards.get(selector.slice(1))||null;
  nodes.get('#main').querySelectorAll=selector=>selector==='.scene-card'?[cards.get('scene-'+sceneId)]:[];
  // Production-specific actions are outside this fixture; preserve the app router's await boundary.
  const productionUI=()=>({submit:()=>false,click:()=>false,render(){},reset(){}});
  const context=vm.createContext({productionUI,URL,URLSearchParams,Map,Set,WeakSet,Date,Intl,Number,JSON,Object,Array,String,Promise,PulseError,parseInvite,console,FormData:class{},setTimeout:()=>1,clearTimeout(){},location:new URL(url),history:{replaceState(){}},navigator:{onLine:true},window:{addEventListener(){},isSecureContext:false},document:{visibilityState:'visible',documentElement:{classList:{toggle(){}}},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(name,fn){(listeners[name]||=[]).push(fn);}},header:()=>'',welcome:()=>'',login:()=>'',picker:()=>'',projectView:()=>'',liveView:()=>'',dialogContent:()=>'',networkRequest(path,settings){requests.push({path,settings});return Promise.resolve({});},foregroundProjectOptions:(_path,settings)=>settings,createLiveConnection:()=>({stop(){}})});
  let source=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace("const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;",'const demo=null;');
  source=source.slice(0,source.indexOf("if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start"));
  vm.runInContext(source,context);context.seed=structuredClone(project);context.notes=notices;const run=code=>vm.runInContext(code,context);
  run("Object.assign(s,{mode:'staff',project:seed,csrf:'synthetic-csrf',user:{id:'staff'},workspace:{projects:[{id:seed.id}]}});render=()=>{};renderLive=()=>{};syncLive=()=>{};notice=value=>notes.push(value);loads=[];loadProject=async id=>{loads.push(id);}");
  const click=async(action,id)=>{const button={disabled:false,dataset:{action,id}};await listeners.click[0]({target:{closest:()=>button}});};
  return {context,run,requests,notices,focuses,click};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('authorized staff scene deeplink selects the correct tab and focuses the exact scene once',async()=>{
  const f=fixture();await f.run('openInitialStaffProject()');f.run('focusInitialStaffScene()');await f.run('openInitialStaffProject()');f.run('focusInitialStaffScene()');
  assert.deepEqual(plain(f.run('loads')),[projectId]);assert.equal(f.run('s.tab'),'storyboard');assert.deepEqual(f.focuses,['scene-'+sceneId]);
});

test('an inaccessible project deeplink never issues an arbitrary project request',async()=>{
  const f=fixture();f.run('s.workspace={projects:[]}');await f.run('openInitialStaffProject()');assert.equal(f.run('loads.length'),0);assert.equal(f.requests.length,0);assert.match(f.notices[0],/열람 권한/);assert.equal(f.run('pendingInitialScene'),'');
});

test('source deeplinks open reference, concept, video review and delivery history only for an accessible project',async()=>{
  for(const tab of ['direction','concepts','review','history']){
    const url=`http://127.0.0.1:64046/pulse-app/?mode=staff&project=${projectId}&tab=${tab}`;
    const f=fixture({url});await f.run('openInitialStaffProject()');assert.deepEqual(plain(f.run('loads')),[projectId]);assert.equal(f.run('s.tab'),tab);assert.equal(f.run('pendingInitialScene'),'');await f.run('openInitialStaffProject()');assert.equal(f.run('loads.length'),1);
    const inaccessible=fixture({url});inaccessible.run('s.workspace={projects:[]}');await inaccessible.run('openInitialStaffProject()');assert.equal(inaccessible.run('loads.length'),0);assert.equal(inaccessible.run('s.tab'),'strategy');assert.match(inaccessible.notices[0],/열람 권한/);
  }
});

test('unknown or malformed scene links fall back to the project scene list and unsafe tabs to strategy',async()=>{
  for(const scene of ['<script>','21234567-89ab-cdef-0123-456789abcdef']){const f=fixture({url:`http://127.0.0.1:64046/pulse-app/?mode=staff&project=${projectId}&tab=scenes&scene=${encodeURIComponent(scene)}`});await f.run('openInitialStaffProject()');f.run('focusInitialStaffScene()');assert.equal(f.run('s.tab'),'storyboard');assert.equal(f.focuses.length,0);assert.match(f.notices[0],/장면을 찾지 못했어요/);}
  const g=fixture({url:`http://127.0.0.1:64046/pulse-app/?mode=staff&project=${projectId}&tab=javascript:bad&scene=${sceneId}`});await g.run('openInitialStaffProject()');assert.equal(g.run('s.tab'),'strategy');assert.equal(g.run('pendingInitialScene'),'');
});

test('account or context change during project loading cannot navigate the replacement context',async()=>{
  const f=fixture();f.run('loadProject=()=>new Promise(resolve=>{finishLoad=resolve;})');const pending=f.run('openInitialStaffProject()');f.run("resetContext();s.user={id:'another'};s.tab='history';finishLoad()");await pending;assert.equal(f.run('s.tab'),'history');assert.equal(f.run('pendingInitialScene'),'');assert.equal(f.run('s.project'),null);
});

test('comparison navigation preserves drafts and uses existing confirmation UI without posting an action',async()=>{
  const f=fixture();f.run("drafts.set(identity()+':strategy:',{values:{product:'미저장 문구'},revision:1})");await f.click('changes-strategy');assert.equal(f.run('s.tab'),'strategy');assert.deepEqual(f.focuses,['agreement']);assert.equal(f.run('drafts.size'),1);await f.click('changes-scene',sceneId);assert.equal(f.run('s.tab'),'storyboard');assert.equal(f.focuses.at(-1),'scene-'+sceneId);assert.equal(f.requests.length,0);
  f.run("s.mode='customer';s.tab='strategy'");await f.click('changes-scene',sceneId);assert.equal(f.run('s.tab'),'strategy');assert.equal(f.requests.length,0);
});
