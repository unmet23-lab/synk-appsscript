import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {emptyStrategyData,applyStrategyAction} from './pulse-strategy.mjs';
import {buildClientKickoff,customerClientKickoff} from './client-kickoff.mjs';
import {applyClientChangesAction,customerClientChanges,buildClientChanges} from './client-changes.mjs';
import {strategyView,strategySaveMessage,strategyUnsavedReviewMessage} from './public/pulse-app/strategy-view.mjs';
import {kickoffView} from './public/pulse-app/kickoff-view.mjs';
import {changesView} from './public/pulse-app/changes-view.mjs';
import {deliverablesView} from './public/pulse-app/deliverables-view.mjs';
import {PulseError,parseInvite} from './public/pulse-app/api.mjs';
import {takeCastingValues} from './public/pulse-app/casting-view.mjs';

const at='2026-10-14T02:00:00.000Z';
const staff={author:'staff',authorId:'private-staff',authorName:'담당자',at};
const customer={author:'customer',authorId:'customer',authorName:'확인자',at};
const data=()=>({...emptyStrategyData(),primaryPromise:'간단한 아침 준비',evidence1:'제품 조리법',desiredAction:'제품 보기',channels:['website']});
const save=(strategy=null,patch={})=>applyStrategyAction(strategy,{action:'save_strategy',strategy:{...data(),...patch}},staff);
const request=strategy=>applyStrategyAction(strategy,{action:'request_strategy_review'},staff);
const confirm=strategy=>applyStrategyAction(strategy,{action:'confirm_strategy',strategyRevision:strategy.revision},customer);
const raw=strategy=>({id:'synthetic-copy-project',title:'고객 화면 검수',stage:'planning',dueDate:'2026-10-22',terms:'영상 한 편',versions:[],messages:[],history:[],kickoffPlan:{enabled:true,requirements:[]},studio:{strategy,assets:[],references:[],concepts:[],scenes:[]}});

test('customer kickoff projects actionable customer copy while staff retains setup instructions',()=>{
  const row=raw(save(null,{primaryPromise:'',evidence1:'',desiredAction:''}));row.dueDate='';row.terms='';
  const internal=buildClientKickoff(row),publicView=customerClientKickoff(row),html=kickoffView({mode:'customer',project:{...row,kickoff:publicView}});
  assert.equal(publicView.missingCount,internal.missingCount);
  assert.deepEqual(publicView.checks.map(x=>[x.id,x.status]),internal.checks.map(x=>[x.id,x.status]));
  assert.match(internal.checks.find(x=>x.id==='deadline').text,/프로젝트 기록에 적어/);
  for(const text of ['기억하게 할 메시지 하나','이 메시지를 믿을 근거','시청 후 유도할 행동 하나','전달일을 담당자와 협의 중','담당자가 현재 제작 설계의 확인을 요청하면'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(JSON.stringify(publicView),/프로젝트 기록에|고객이 지금|고객 희망일|핵심 약속|기대 행동/);
  row.studio.strategy=request(save());let checks=customerClientKickoff(row).checks;
  assert.match(checks.find(x=>x.id==='confirmation').text,/살펴보고 확인해/);
  row.studio.strategy=confirm(row.studio.strategy);checks=customerClientKickoff(row).checks;
  assert.match(checks.find(x=>x.id==='confirmation').text,/지금 제작 설계를 확인했어요/);
});

test('customer changes use the field names in the form without rewriting the staff report',()=>{
  const row=raw(confirm(request(save())));
  row.changeControl=applyClientChangesAction(row,{action:'capture',confirmed:true},{actor:'private-staff',at});
  row.studio.strategy=save(row.studio.strategy,{primaryPromise:'바쁜 아침의 한 끼',desiredAction:'구성 확인',channels:['instagram']});
  const customerChanges=customerClientChanges(row),html=changesView({mode:'customer',project:{...row,changes:customerChanges}}),form=strategyView({mode:'customer',project:row});
  for(const label of ['기억하게 할 메시지 하나','시청 후 유도할 행동 하나','어디에서 보여줄 예정인가요?']){assert.ok(html.includes(label));assert.ok(form.includes(label));}
  assert.doesNotMatch(html,/핵심 약속|기대 행동|게재 채널/);
  assert.equal(buildClientChanges(row).changes.find(x=>x.id==='strategy:primaryPromise').label,'핵심 약속');
});

test('request editing explains cancellation before save and waiting for a renewed request after save',()=>{
  const requested=request(save()),before=strategyView({mode:'customer',project:raw(requested)});
  assert.match(before,/수정 내용을 저장하면 지금 확인 요청은 취소돼요/);
  assert.match(before,/data-action="strategy-discard"/);assert.match(before,/data-action="confirm-strategy"/);
  assert.doesNotMatch(before,/고객 확인 대기|먼저 고쳐서 저장/);
  assert.match(strategyUnsavedReviewMessage(requested),/입력 되돌리기/);
  assert.match(strategySaveMessage(requested),/다시 요청하면 확인할 수 있어요/);
  const changed=applyStrategyAction(requested,{action:'save_strategy',strategy:{primaryPromise:'고친 메시지'}},customer);
  assert.equal(changed.request,null);assert.equal(changed.history.at(-1).request.strategyRevision,1);
  const after=strategyView({mode:'customer',project:raw(changed)});
  assert.match(after,/고친 내용의 확인 요청을 기다리고 있어요/);assert.doesNotMatch(after,/data-action="confirm-strategy"/);
  const requestedAgain=request(changed),again=strategyView({mode:'customer',project:raw(requestedAgain)});
  assert.match(again,/data-action="confirm-strategy" data-revision="2"/);assert.doesNotMatch(again,/고친 내용의 확인 요청을 기다리고/);
});

test('deliverable status speaks to the reader while staff still sees customer waiting',()=>{
  const project=raw(save());project.studio.deliverables={revision:1,items:[],request:{deliverableRevision:1},confirmation:null,history:[]};
  assert.match(deliverablesView({mode:'customer',project}),/확인해 주세요/);
  assert.doesNotMatch(deliverablesView({mode:'customer',project}),/고객 확인 대기|고객 확인 완료/);
  assert.match(deliverablesView({mode:'staff',project}),/고객 확인 대기/);
  project.studio.deliverables.confirmation={deliverableRevision:1};assert.match(deliverablesView({mode:'customer',project}),/확인했어요/);
});

test('customer service saves a requested edit with preserved history and permits confirmation only after a new staff request',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-customer-copy-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=store.createUser({name:'합성 담당자',email:'copy@example.test',role:'member',teamId:'copy-team'});
  const projects=createClientProjectsService({store}),studio=createPulseStudioService({store,clientProjects:projects});
  let project=projects.save(owner,{title:'합성 고객 확인',customerName:'합성 고객',stage:'planning'}).project;
  const staffAction=input=>studio.staffMutate(owner,project.id,{revision:store.get('clientProjects',project.id).revision,...input});
  staffAction({action:'save_strategy',strategy:data()});staffAction({action:'request_strategy_review'});
  const invitation=projects.invite(owner,project.id,{revision:store.get('clientProjects',project.id).revision}),opened=projects.open(invitation.invite);
  const customerAction=input=>studio.customerMutate(opened.session,opened.csrf,{revision:store.get('clientProjects',project.id).revision,...input});
  const edited=customerAction({action:'save_strategy',strategy:{primaryPromise:'새 메시지'}}).project;
  assert.equal(edited.studio.strategy.revision,2);assert.equal(edited.studio.strategy.request,null);
  assert.equal(edited.studio.strategy.history[0].request.strategyRevision,1);
  assert.doesNotMatch(JSON.stringify(edited.studio.strategy),/authorId|private-staff/);
  assert.throws(()=>customerAction({action:'confirm_strategy',strategyRevision:2}),error=>error.status===409);
  staffAction({action:'request_strategy_review'});
  const confirmed=customerAction({action:'confirm_strategy',strategyRevision:2}).project;
  assert.equal(confirmed.studio.strategy.confirmation.strategyRevision,2);
});

function eventFixture(project,csrf,dispatch){
  const requests=[],listeners={},notices=[];
  const element=()=>({innerHTML:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,setAttribute(){},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}});
  const nodes=new Map(['#main','#app-dialog','#notice','#header-actions','#pulse-live','#connection-banner'].map(key=>[key,element()]));
  const form={dataset:{form:'strategy',revision:String(project.studio.strategy.revision)},closest(){return this;},elements:[],querySelector:()=>null};
  form.elements=['primaryPromise','evidence1','desiredAction'].map(name=>({name,type:'textarea',value:project.studio.strategy.data[name],closest:selector=>selector==='details'?null:form}));
  const context=vm.createContext({URL,URLSearchParams,Map,Set,WeakSet,Date,Intl,Number,JSON,Object,Array,String,Promise,PulseError,parseInvite,takeCastingValues,strategySaveMessage,strategyUnsavedReviewMessage,console,
    LOCALE_EVENT:'pulse-locale',chooseLocale(){},storedLocale:()=>null,setOfferedLocales(){},
    FormData:class{constructor(value){this.form=value;}*[Symbol.iterator](){for(const field of this.form.elements)yield [field.name,field.value];}getAll(){return [];}},
    setTimeout:()=>1,clearTimeout(){},location:new URL('http://127.0.0.1:64046/pulse-app/'),history:{replaceState(){}},navigator:{onLine:true},window:{addEventListener(){},isSecureContext:false},
    document:{visibilityState:'visible',documentElement:{classList:{toggle(){}}},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(name,fn){(listeners[name]||=[]).push(fn);}},
    productionUI:()=>({submit:()=>false,click:()=>false,render(){},reset(){}}),header:()=>'',welcome:()=>'',login:()=>'',picker:()=>'',projectView:()=>'',liveView:()=>'',dialogContent:()=>'',
    async networkRequest(path,settings){requests.push({path,settings});return dispatch(path,settings);},foregroundProjectOptions:(_path,settings)=>settings,createLiveConnection:()=>({stop(){}})});
  let source=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace("const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;",'const demo=null;');
  source=source.slice(0,source.indexOf("if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start"));
  vm.runInContext(source,context);context.seed=structuredClone(project);context.testCsrf=csrf;context.notes=notices;context.testForm=form;
  const run=code=>vm.runInContext(code,context);
  run("Object.assign(s,{mode:'customer',project:seed,csrf:testCsrf});render=()=>{for(const field of testForm.elements)field.value=s.project.studio.strategy.data[field.name];restore({querySelectorAll:()=>[testForm]});};renderLive=()=>{};syncLive=()=>{};notice=value=>notes.push(value)");
  const input=async(name,value)=>{const field=form.elements.find(field=>field.name===name);field.value=value;for(const listener of listeners.input||[])await listener({target:field});};
  const click=async(action,revision)=>{const button={disabled:false,dataset:{action,revision:String(revision)}};for(const listener of listeners.click||[])await listener({target:{closest:selector=>selector==='[data-set-locale]'?null:button}});};
  const submit=async()=>{for(const listener of listeners.submit||[])await listener({target:form,preventDefault(){}});};
  return {input,click,submit,run,requests,notices,form,dialog:nodes.get('#app-dialog')};
}

test('actual strategy events keep unsaved edits, discard only that draft, confirm the saved server version and explain a requested save',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-customer-copy-events-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=store.createUser({name:'합성 담당자',email:'copy-events@example.test',role:'member',teamId:'copy-team'}),projects=createClientProjectsService({store}),studio=createPulseStudioService({store,clientProjects:projects});
  const setup=()=>{
    const project=projects.save(owner,{title:'합성 이벤트 검수',customerName:'합성 고객',stage:'planning'}).project;
    const staffAction=input=>studio.staffMutate(owner,project.id,{revision:store.get('clientProjects',project.id).revision,...input});
    staffAction({action:'save_strategy',strategy:data()});staffAction({action:'request_strategy_review'});
    const invitation=projects.invite(owner,project.id,{revision:store.get('clientProjects',project.id).revision}),opened=projects.open(invitation.invite),snapshot=studio.customerState(opened.session);
    return {project,opened,snapshot};
  };
  const setupEvent=fixture=>eventFixture(fixture.snapshot.project,fixture.opened.csrf,(path,settings)=>{
    assert.equal(path,'/pulse/api/studio');assert.equal(settings.staff,false);assert.equal(settings.csrf,fixture.opened.csrf);
    return studio.customerMutate(fixture.opened.session,settings.csrf,JSON.parse(JSON.stringify(settings.body)));
  });
  const first=setup(),f=setupEvent(first);
  f.run("drafts.set([identity(),'reference',''].join(':'),{values:{reason:'다른 양식 메모'},revision:1})");
  await f.input('primaryPromise','아직 저장하지 않은 새 메시지');
  await f.click('confirm-strategy',1);
  assert.equal(f.requests.length,0);assert.equal(f.dialog.open,false);
  assert.equal(f.form.elements.find(field=>field.name==='primaryPromise').value,'아직 저장하지 않은 새 메시지');
  assert.match(f.notices.at(-1),/저장하면 지금 확인 요청이 취소/);assert.match(f.notices.at(-1),/입력 되돌리기/);
  assert.equal(store.get('clientProjects',first.project.id).studio.strategy.data.primaryPromise,data().primaryPromise);
  await f.click('strategy-discard');
  assert.equal(f.form.elements.find(field=>field.name==='primaryPromise').value,data().primaryPromise);
  assert.equal(f.run("drafts.has([identity(),'strategy',''].join(':'))"),false);
  assert.equal(f.run("drafts.get([identity(),'reference',''].join(':')).values.reason"),'다른 양식 메모');
  await f.click('confirm-strategy',1);assert.equal(f.dialog.open,true);await f.click('confirm-strategy-save',1);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].settings.body.action,'confirm_strategy');
  assert.equal(store.get('clientProjects',first.project.id).studio.strategy.confirmation.strategyRevision,1);
  assert.equal(f.dialog.open,false);
  const second=setup(),g=setupEvent(second);
  await g.input('primaryPromise','저장할 새 메시지');await g.submit();
  assert.equal(g.requests.length,1);assert.equal(g.requests[0].settings.body.action,'save_strategy');
  const stored=store.get('clientProjects',second.project.id).studio.strategy;
  assert.equal(stored.revision,2);assert.equal(stored.request,null);assert.equal(stored.history.at(-1).request.strategyRevision,1);
  assert.equal(g.run("drafts.has([identity(),'strategy',''].join(':'))"),false);
  assert.match(g.notices.at(-1),/전에 받은 확인 요청은 끝났/);assert.match(g.notices.at(-1),/다시 요청하면 확인할 수 있어요/);
});
