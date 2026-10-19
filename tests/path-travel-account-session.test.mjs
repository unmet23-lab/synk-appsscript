import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createTravelAccountSession } from '../experiences/path-travel/planner-account-session.mjs';
import { createTravelMemory, importTravelMemory, exportTravelMemory, TRAVEL_MAX_BYTES } from '../experiences/path-travel/planner-storage.mjs';
import { travelAccountDocument, TRAVEL_ACCOUNT_CONTRACT } from '../experiences/path-travel/planner-account.mjs';

// Real shared notebook, synthetic account/sync transport. No service calls.
class Element {
  constructor(){this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.selectors=new Map();this.listeners=new Map();this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(key,value){this[key]=value;}
  addEventListener(name,handler){this.listeners.set(name,handler);}
  closest(){return this;}
  querySelector(selector){
    const action=/^\[data-notebook="(.+)"\]$/.exec(selector)?.[1];
    const search=node=>node.children.find(child=>child.dataset.notebook===action)||node.children.map(search).find(Boolean);
    if(action){const node=search(this);if(node)return node;}
    if(!this.selectors.has(selector))this.selectors.set(selector,new Element());
    return this.selectors.get(selector);
  }
}
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const signedIn=(id='synthetic-a',generation=1)=>({status:'signed-in',configured:true,signedIn:true,accountId:id,sessionGeneration:generation});
const signedOut=()=>({status:'signed-out',configured:true,signedIn:false,accountId:null,sessionGeneration:3});
const copy=value=>JSON.parse(JSON.stringify(value));

async function fixture(t){
  const originals=['document','addEventListener','removeEventListener','confirm'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  Object.assign(globalThis,{document:{createElement:()=>new Element()},addEventListener(){},removeEventListener(){},confirm:()=>true});
  const mount=new Element(),content=new Element(),guest=createTravelMemory();guest.consent=true;guest.query.budget=123456;
  const remote=createTravelMemory();remote.query.budget=77777;
  let visible=copy(guest),authOptions,syncOptions,closed=0,dialogOpen=true,draft=null,session;
  const drafts=[],applied=[],changes=[];
  session=await createTravelAccountSession({mount,content,contract:{...TRAVEL_ACCOUNT_CONTRACT,available:true,productionRegistered:true},
    getState:()=>visible,applyState:(value,meta)=>{visible=copy(value);applied.push({value:copy(value),meta});if(session)void session.persist(value);},
    captureGuestDraft:()=>({budget:'아직 입력 중',origin:{name:'게스트 숙소 편집',lat:'37.'},dialogOpen}),
    restoreGuestDraft:value=>{draft=copy(value);drafts.push(draft);dialogOpen=value.dialogOpen;},
    closeDialogs:()=>{closed++;dialogOpen=false;},
    notebookOptions:{accountFactory:options=>{authOptions=options;return {start:async()=>options.onStatus(signedOut()),request:()=>{throw Error('Remote access forbidden');},signOut:async()=>{options.onStatus(signedOut());return {ok:true,serverRevoked:true};},dispose(){}};},
      syncFactory:options=>{syncOptions=options;return {localRecords:()=>({count:0}),close:()=>options.onStatus({status:'closed',pending:false}),
        open:async()=>{await options.onState(travelAccountDocument(remote));options.onStatus({status:'synced',pending:false});},
        change:document=>{changes.push(copy(document));options.onStatus({status:'synced',pending:false});},flush:async()=>true};}},
  });
  t.after(()=>{session.dispose();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {session,mount,content,guest,remote,changes,applied,drafts,visible:()=>visible,draft:()=>draft,closed:()=>closed,
    setVisible:value=>{visible=value;},auth:async next=>{authOptions.onStatus(next);await settle();},
    receive:async value=>{await syncOptions.onState(travelAccountDocument(value));await settle();},
    click:async action=>{const target=new Element();target.dataset.notebook=action;mount.listeners.get('click')({target});await settle();}};
}

test('배포 gate는 설정이 있어도 notebook·설정 읽기·원격 호출 전 단계에서 닫힌다',async()=>{
  for(const flags of [{available:false,productionRegistered:false},{available:false,productionRegistered:true},{available:true,productionRegistered:false}]){
    let factories=0;const mount=new Element();
    const session=await createTravelAccountSession({mount,content:new Element(),getState:createTravelMemory,applyState(){},
      contract:{...TRAVEL_ACCOUNT_CONTRACT,...flags},notebookOptions:{configUrl:'https://configured.example.test/config.json'},notebookFactory:()=>{factories++;throw Error('not allowed');}});
    assert.equal(factories,0);assert.equal(session.enabled,false);assert.equal(mount.dataset.accountMode,'local');
    assert.equal(mount.textContent,TRAVEL_ACCOUNT_CONTRACT.reason);assert.deepEqual(await session.persist(createTravelMemory()),{destination:'guest',stored:false});
  }
});

test('실제 notebook 수신은 consent 없이 snapshot만 적용하고 쓰기 반향 없이 계정/게스트 초안을 왕복한다',async t=>{
  const f=await fixture(t);await f.auth(signedIn());
  assert.equal(f.session.active,true);assert.equal(f.visible().query.budget,77777);assert.equal(f.visible().consent,false);
  assert.equal(f.changes.length,0);assert.ok(f.applied.every(row=>row.meta.snapshot===true));
  const edited=copy(f.visible());edited.query.budget=99999;edited.consent=true;f.setVisible(edited);
  assert.deepEqual(await f.session.persist(edited),{destination:'account',stored:true});
  assert.equal(f.changes.length,1);assert.equal(Object.hasOwn(f.changes[0],'consent'),false);
  const updated=copy(f.remote);updated.query.budget=88888;await f.receive(updated);
  assert.equal(f.visible().query.budget,88888);assert.equal(f.changes.length,1,'hydration must not echo a save');
  await f.auth(signedIn('synthetic-b',2));assert.equal(f.drafts.length,0,'account switch cannot replace the original guest draft');
  await f.auth(signedOut());assert.deepEqual(f.visible(),f.guest);assert.equal(f.session.active,false);
  assert.deepEqual(f.draft(),{budget:'아직 입력 중',origin:{name:'게스트 숙소 편집',lat:'37.'},dialogOpen:true});
});

test('notebook의 명시적 기기 기록 가져오기도 계정 화면의 브라우저 동의를 false로 유지한다',async t=>{
  const f=await fixture(t);await f.auth(signedIn());await f.click('import');
  assert.equal(f.visible().query.budget,f.guest.query.budget);assert.equal(f.visible().consent,false);
  assert.equal(f.changes.length,1);assert.equal(Object.hasOwn(f.changes[0],'consent'),false);
  await f.click('signout');assert.deepEqual(f.visible(),f.guest);assert.equal(f.visible().consent,true);
});

test('계정 사용 중 다른 탭의 guest 저장 변경은 로그아웃 때 예전 자동 저장 동의를 되살리지 않는다',async t=>{
  const f=await fixture(t);await f.auth(signedIn());const accountBefore=copy(f.visible());
  assert.equal(f.session.invalidateGuestConsent(),true);assert.deepEqual(f.visible(),accountBefore);assert.equal(f.changes.length,0);
  await f.auth(signedOut());assert.equal(f.visible().consent,false);assert.equal(f.visible().query.budget,f.guest.query.budget);
  assert.equal(f.guest.consent,true,'captured source was not mutated');assert.equal(f.session.invalidateGuestConsent(),false);
});

test('인증 재확인 중에는 본문을 숨기고 대화상자를 닫으며 계정 쓰기를 멈춘다',async t=>{
  const f=await fixture(t);await f.auth(signedIn());const before=f.closed();
  await f.auth({status:'error',configured:true,signedIn:false,accountId:null,sessionGeneration:2,error:{retryable:true,message:'합성 인증 중단'}});
  assert.equal(f.content.hidden,true);assert.equal(f.content.inert,true);assert.equal(f.session.locked,true);assert.ok(f.closed()>before);
  assert.deepEqual(await f.session.persist(f.visible()),{destination:'none',stored:false});assert.equal(f.changes.length,0);
  await f.auth(signedIn('synthetic-a',3));assert.equal(f.content.hidden,false);assert.equal(f.session.locked,false);
});

const source=readFileSync(new URL('../experiences/path-travel/planner-ui.mjs',import.meta.url),'utf8');
function controller(name){const text=source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`,'m'))?.[0];assert.ok(text,name);return text;}
function uiFixture(active=false){
  const state=createTravelMemory();state.consent=true;const writes=[],clears=[],notices=[],controls=new Map();
  const get=key=>{if(!controls.has(key))controls.set(key,{hidden:false,inert:false,close(){},value:''});return controls.get(key);};
  const context=vm.createContext({memory:copy(state),accountApplying:false,accountSession:{active,hydrating:false,locked:false,generation:1,persist:async value=>{writes.push(copy(value));return {stored:true};}},
    accountLocked:()=>context.accountSession.locked,$:get,now:()=>new Date().toISOString(),toast:value=>notices.push(value),saveTravelMemory:value=>writes.push(copy(value)),clearTravelMemory:()=>clears.push(true),TRAVEL_MAX_BYTES,
    importTravelMemory:value=>importTravelMemory(value),applyAccountState:(value,meta)=>{context.memory=copy(value);context.lastApply=meta;},
  });
  vm.runInContext(['persist','importFile'].map(controller).join('\n'),context);
  return {context,get,writes,clears,notices,run:code=>vm.runInContext(code,context)};
}

test('계정 파일 가져오기와 자동 저장은 guest 저장/삭제를 호출하지 않는다',async()=>{
  const h=uiFixture(true),incoming=createTravelMemory();incoming.query.budget=50000;
  h.context.file={size:100,text:async()=>exportTravelMemory(incoming)};
  await h.run('importFile(file)');assert.equal(h.context.memory.query.budget,50000);assert.equal(h.context.memory.consent,false);
  assert.equal(h.writes.length,1);assert.equal(h.clears.length,0);assert.equal(h.context.lastApply.guest,false);
  h.context.accountApplying=true;h.run('persist()');assert.equal(h.writes.length,1);
  h.context.accountApplying=false;h.context.accountSession.locked=true;h.run('persist()');assert.equal(h.writes.length,1);
});

test('가져오기 파일 읽기 도중 계정이 바뀌면 늦은 성공과 실패 모두 새 소유자의 기록을 건드리지 않는다',async()=>{
  for(const reject of [false,true]){
    const h=uiFixture(true);let done,fail;h.context.file={size:100,text:()=>new Promise((resolve,reject)=>{done=resolve;fail=reject;})};
    const work=h.run('importFile(file)');h.context.accountSession.generation++;h.context.memory.query.budget=22222;
    if(reject)fail(Error('late failure'));else done(exportTravelMemory(createTravelMemory()));await work;
    assert.equal(h.context.memory.query.budget,22222);assert.equal(h.writes.length,0);assert.equal(h.clears.length,0);assert.equal(h.notices.length,0);
  }
});

test('세션 start가 아직 끝나지 않았어도 product DOM 잠금으로 외부 버튼을 막는다',()=>{
  const content={inert:true,hidden:false};const fn=source.match(/function accountLocked\(\)\{[^\n]+\}/)?.[0];assert.ok(fn);
  const context=vm.createContext({accountSession:null,$:()=>content});vm.runInContext(fn,context);
  assert.equal(vm.runInContext('accountLocked()',context),true);content.inert=false;content.hidden=true;assert.equal(vm.runInContext('accountLocked()',context),true);
  content.hidden=false;assert.equal(vm.runInContext('accountLocked()',context),false);
});

test('계정 동의 체크는 오래 남은 DOM 이벤트여도 guest 동의/키를 바꾸지 않는다',()=>{
  const branch=source.match(/if\(event.target.id==='save-consent'\)\{[^]*?\n if\(event.target.id==='import-file'/)?.[0];assert.ok(branch);
  const body=branch.slice(0,branch.lastIndexOf('\n if('));let called=0;
  const context=vm.createContext({accountSession:{active:true},event:{target:{id:'save-consent',checked:true}},renderMemory:()=>called++,setTravelConsent:()=>assert.fail('guest consent'),clearTravelMemory:()=>assert.fail('guest storage')});
  vm.runInContext(`function change(){${body}}change()`,context);assert.equal(called,1);
});

test('전체 초기화는 계정에서 guest 키를 지우지 않고 오래된 복구안과 출발지 선택을 폐기한다',()=>{
  const branch=source.match(/case 'reset-all':([^]*?);break;/)?.[1];assert.ok(branch);
  for(const active of [false,true]){
    const h=uiFixture(active);let originResets=0,recoveryClears=0;
    Object.assign(h.context,{createTravelMemory,clearRecovery:()=>recoveryClears++,resetOriginChoices:()=>originResets++,
      outcome:{},pending:{},formDirty:true,activeDecision:'old',editingVisit:'old',exposureObserver:null,
      writeInput(){},picksFromQuery(){},document:{body:{classList:{remove(){}}}},renderProgressSummary(){},renderMemory(){}});
    h.run(branch);assert.equal(h.clears.length,active?0:1);assert.equal(h.writes.length,active?1:0);
    assert.equal(h.context.pending,null);assert.equal(h.context.outcome,null);assert.equal(h.context.formDirty,false);
    assert.equal(h.get('#plan-change').hidden,true);assert.equal(originResets,1);assert.equal(recoveryClears,1);
  }
});
