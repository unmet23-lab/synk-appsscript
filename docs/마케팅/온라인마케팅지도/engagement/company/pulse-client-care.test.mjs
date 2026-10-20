import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {groupCustomerNotifications} from './pulse-live.mjs';
import {clientNotificationTitle} from './client-notifications.mjs';
import {header,welcome,projectView,nextDecision,liveView} from './public/pulse-app/views.mjs';
import {createDemoSession} from './public/pulse-app/demo.mjs';
import {strategySaveMessage} from './public/pulse-app/strategy-view.mjs';

// Client-room care fixes from the 2026-10-19 customer review: coming back, keeping
// unsent writing, honest next steps and readable notifications.
globalThis.location=new URL('http://localhost/pulse-app/');
const DAY=86400000,appDir=new URL('./public/pulse-app/',import.meta.url);

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-care-'));let at=new Date().toISOString();
  const app=createCompanyApp({dataDir:directory,port:0,origin:'https://workspace.example.test',allowTestHost:true,schedule:false,backgroundJobsEnabled:'0',clock:()=>at,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,webPushEnabled:false});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const address=await app.start(),base='http://127.0.0.1:'+address.port,owner=app.store.createUser({name:'Synthetic maker',email:'care@pulse.test',role:'admin'}),staff=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},10),jar=new Map();let csrf='';
  async function call(path,input,{customer=false,cookies,headers={},method=input===undefined?'GET':'POST'}={}){
    const cookie=cookies??(customer?[...jar].map(([key,value])=>key+'='+value).join('; '):'synk_company_session='+staff);
    const response=await fetch(base+path,{method,headers:{Cookie:cookie,...(method==='GET'?{}:{'Content-Type':'application/json',Origin:app.origin,[customer?'X-Pulse-CSRF':'X-CSRF-Token']:customer?csrf:'staff-csrf'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
    const setCookies=response.headers.getSetCookie();if(customer&&cookies===undefined)for(const entry of setCookies){const [name,value]=entry.split(';')[0].split('=');if(value)jar.set(name,value);else jar.delete(name);}
    return {status:response.status,data:await response.json(),setCookies};
  }
  const created=await call('/api/client-projects',{title:'Synthetic care project',customerName:'Synthetic client'});assert.equal(created.status,201);
  const projectId=created.data.project.id,row=()=>app.store.get('clientProjects',projectId);
  const invited=await call(`/api/client-projects/${projectId}/invite`,{revision:row().revision});assert.equal(invited.status,200);
  const customer=(path,input,options={})=>call('/pulse/api/'+path,input,{customer:true,...options});
  const opened=await customer('open',{invite:invited.data.invite});assert.equal(opened.status,200);csrf=opened.data.csrf;
  const studio=async input=>{const result=await call(`/api/client-projects/${projectId}/studio`,{revision:row().revision,...input});assert.equal(result.status,200,JSON.stringify(result.data));return result.data.project;};
  const devices=()=>app.store.db.prepare("SELECT * FROM tokens WHERE purpose='pulse-device'").all();
  return {app,call,customer,studio,projectId,row,jar,devices,invite:invited.data.invite,clock:()=>at,advance:ms=>at=new Date(Date.parse(at)+ms).toISOString()};
}

test('「이 기기 기억하기」 needs the customer CSRF, never subscribes to push and carries the browser past the invitation deadline',async t=>{
  const f=await fixture(t);
  assert.deepEqual((await f.customer('device-notifications')).data.deviceConnection,{remembered:false,expiresAt:null,renewalDays:30});
  assert.equal((await f.customer('remember-device',{},{headers:{'X-Pulse-CSRF':'forged'}})).status,403);assert.equal(f.devices().length,0);
  assert.equal((await f.customer('remember-device',{remember:true})).status,400);assert.equal(f.devices().length,0);
  const remembered=await f.customer('remember-device',{});assert.equal(remembered.status,201);
  assert.equal(remembered.data.deviceConnection.remembered,true);assert.equal(Date.parse(remembered.data.deviceConnection.expiresAt)-Date.parse(f.clock()),30*DAY);
  assert.ok(remembered.setCookies.some(cookie=>/^synk_pulse_device=/.test(cookie)&&/HttpOnly/.test(cookie)&&/SameSite=Strict/.test(cookie)&&/Secure/.test(cookie)));
  const first=f.devices();assert.equal(first.length,1);
  assert.equal((await f.customer('remember-device',{})).status,201);assert.deepEqual(f.devices().map(device=>device.hash),first.map(device=>device.hash),'pressing again keeps one remembered device');
  assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS n FROM web_push_subscriptions').get().n,0,'remembering is not a push subscription');
  f.advance(29*DAY);assert.equal((await f.customer('project',undefined,{headers:{'X-Pulse-Active':'1'}})).status,200);
  f.advance(2*DAY);assert.ok(Date.parse(f.row().inviteExpiresAt)<=Date.parse(f.clock()),'the invitation deadline has passed');
  assert.equal((await f.customer('open',{invite:f.invite},{cookies:''})).status,401,'a new browser cannot use the expired link');
  assert.equal((await f.customer('project')).status,200,'the remembered browser still opens the project');
  assert.equal((await f.customer('logout',{})).status,200);assert.equal(f.devices().length,0,'closing the connection forgets the browser');
  assert.equal((await f.customer('project')).status,401);
});

test('customer notices name what arrived without project content and fold one concept edited twice into one row',async t=>{
  const f=await fixture(t);
  let project=await f.studio({action:'save_concept',title:'PRIVATE-CONCEPT-TITLE',description:'PRIVATE-DESCRIPTION',tagline:'',imageUrl:'',visibility:'customer'});
  const concept=project.studio.concepts[0];f.advance(1000);
  project=await f.studio({action:'save_concept',id:concept.id,title:'PRIVATE-CONCEPT-TITLE v2',description:'PRIVATE-DESCRIPTION',tagline:'',imageUrl:'',visibility:'customer'});f.advance(1000);
  const replied=await f.call(`/api/client-projects/${f.projectId}/messages`,{revision:f.row().revision,text:'PRIVATE-REPLY-TEXT',visibility:'customer'});assert.equal(replied.status,200);
  const live=(await f.customer('live')).data,[reply,cards]=live.notifications;
  assert.equal(live.notifications.length,2);assert.equal(live.unreadCount,2);
  assert.equal(reply.title,'제작팀이 답했어요');assert.equal(reply.body,'보낸 의견이나 문의에 대한 답을 확인해 주세요.');
  assert.equal(cards.title,'새 콘셉트가 도착했어요','one concept that arrived and then changed is still one new concept');assert.equal(cards.ids.length,2);assert.equal(cards.count,2);
  assert.equal(cards.body,'콘셉트를 나란히 비교하고 마음에 가까운 방향을 골라 주세요.');
  assert.doesNotMatch(JSON.stringify(live.notifications),/PRIVATE-/);
  const read=await f.customer('notifications/read',{ids:cards.ids});assert.equal(read.status,200);assert.equal(read.data.unreadCount,1);
  assert.equal(read.data.notifications.find(item=>item.type==='concept_ready').unread,false);
});

test('a requested plan keeps its notice when the customer only changes the model or style',async t=>{
  const f=await fixture(t),plan={objective:'brand',product:'합성 제품',audience:'합성 고객',channels:['instagram'],primaryPromise:'오래 쓰는 제품',value1:'편안함',evidence1:'합성 내구성 시험 장면',desiredAction:'자세히 보기'};
  await f.studio({action:'save_strategy',strategy:plan});await f.studio({action:'request_strategy_review'});
  const titles=async()=>(await f.customer('live')).data.notifications.map(item=>item.title);
  assert.ok((await titles()).includes('제작 설계를 확인해 주세요'));
  const before=(await f.customer('project')).data.project;
  const saved=await f.customer('studio',{revision:before.revision,action:'save_strategy',strategy:{...plan,castingSelection:{...before.studio.strategy.data.castingSelection,modelId:'F01'}}});assert.equal(saved.status,200,JSON.stringify(saved.data));
  const strategy=saved.data.project.studio.strategy;assert.equal(strategy.revision,2);assert.equal(strategy.request.strategyRevision,2);assert.equal(strategy.request.carriedFrom,1);
  assert.ok((await titles()).includes('제작 설계를 확인해 주세요'),'the carried request still asks the customer to confirm');
  const confirmed=await f.customer('studio',{revision:saved.data.project.revision,action:'confirm_strategy',strategyRevision:2});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
  assert.equal((await titles()).includes('제작 설계를 확인해 주세요'),false,'confirming clears it');
});

test('folded notices count cards, keep every id and never fold different kinds or read states',()=>{
  assert.equal(clientNotificationTitle('concept_ready',{cardRevision:1}),'새 콘셉트가 도착했어요');assert.equal(clientNotificationTitle('concept_ready',{cardRevision:2}),'콘셉트가 바뀌었어요');
  assert.equal(clientNotificationTitle('scene_ready',{cardRevision:1}),'새 장면이 도착했어요');assert.equal(clientNotificationTitle('scene_ready',{cardRevision:4}),'장면이 바뀌었어요');
  assert.equal(clientNotificationTitle('scene_ready'),'장면 구성이 바뀌었어요','older events keep their original title');
  const item=(id,type,extra={})=>({id,type,unread:true,title:clientNotificationTitle(type,extra),...extra}),preview=clientNotificationTitle('preview_ready');
  const folded=groupCustomerNotifications([
    item('c2','concept_ready',{cardRevision:2,conceptId:'A'}),item('c1','concept_ready',{cardRevision:1,conceptId:'A'}),
    item('p1','preview_ready'),
    item('s3','scene_ready',{cardRevision:1,sceneId:'X'}),item('s2','scene_ready',{cardRevision:1,sceneId:'Y'}),item('s1','scene_ready',{cardRevision:3,sceneId:'Z'}),
    {...item('s0','scene_ready',{cardRevision:1,sceneId:'W'}),unread:false},
    item('r2','reference_ready'),item('r1','reference_ready'),
    item('q2','preview_ready'),item('q1','preview_ready'),
    item('d2','scene_ready',{cardRevision:2,sceneId:'X'}),item('d1','scene_ready',{cardRevision:5,sceneId:'Y'}),
  ]);
  assert.deepEqual(folded.map(entry=>[entry.title,entry.ids||[entry.id]]),[
    ['새 콘셉트가 도착했어요',['c2','c1']],[preview,['p1']],['새 장면 2개 · 바뀐 장면 1개',['s3','s2','s1']],['새 장면이 도착했어요',['s0']],
    ['참고 자료가 바뀌었어요 · 2건',['r2','r1']],[preview,['q2']],[preview,['q1']],['장면 2개가 바뀌었어요',['d2','d1']],
  ]);
  assert.equal(folded[0].count,2);assert.ok(folded.every(entry=>!Object.hasOwn(entry,'cardRevision')));
});

const at='2026-10-19T00:00:00Z';
const confirmedStrategy={revision:2,data:{primaryPromise:'오래 쓰는 제품',evidence1:'시험 장면',desiredAction:'자세히 보기'},request:{strategyRevision:2},confirmation:{strategyRevision:2},history:[]};
const base=(studio={})=>({id:'p',revision:5,title:'고객 돌봄 시험',stage:'producing',versions:[],messages:[],studio:{preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[],strategy:structuredClone(confirmedStrategy),...studio}});
const view=(p,extra={})=>projectView({mode:'customer',tab:'overview',project:p,...extra});
const nextBanner=html=>(html.match(/<section class="next-decision">[^]*?<\/section>/)||[''])[0];

test('the next step follows the real stage: delivery specs, the team turn after confirmed scenes and after shared taste',()=>{
  const specs=base({deliverables:{revision:3,request:{deliverableRevision:3},confirmation:null}});
  assert.deepEqual(nextDecision(specs),{title:'납품 규격 확인을 부탁드려요',text:'받을 파일과 쓸 곳, 길이를 살펴보고 확인해 주세요.',tab:'strategy',button:'납품 규격 확인',scroll:'deliverables'});
  const specsBanner=nextBanner(view(specs));assert.match(specsBanner,/내 차례/);assert.match(specsBanner,/data-tab="strategy" data-scroll="deliverables"/);
  const scenes=base({scenes:[{id:'s1',title:'첫 장면',revision:1,visibility:'customer'},{id:'s2',title:'둘째 장면',revision:1,visibility:'customer'}],sceneReviews:[{id:'r1',sceneId:'s1',status:'confirmed',current:true,at},{id:'r2',sceneId:'s2',status:'confirmed',current:true,at}]});
  assert.equal(nextDecision(scenes).title,'장면 확인을 마쳤어요');const sceneBanner=nextBanner(view(scenes));assert.match(sceneBanner,/제작팀 차례/);assert.doesNotMatch(sceneBanner,/내 차례/);
  const taste=base({preferences:{mood:'따뜻한'}});assert.equal(nextDecision(taste).title,'보내 주신 취향으로 콘셉트를 준비하고 있어요');assert.match(nextBanner(view(taste)),/제작팀 차례/);
});

test('a staff note is shown as its own memo and never replaces the stage explanation; skipped stages read as passed',()=>{
  const p=base({scenes:[{id:'s1',title:'첫 장면',revision:1,visibility:'customer'}],sceneReviews:[{id:'r1',sceneId:'s1',status:'confirmed',current:true,at}],concepts:[{id:'c1',title:'콘셉트',revision:1,visibility:'customer'}]});
  p.nextStep='금요일까지 로고 원본을 보내 주세요';
  const next=nextDecision(p);assert.equal(next.text,'확인한 장면으로 시안 영상을 만들고 있어요. 시안이 오면 알려 드릴게요.');assert.equal(next.note,'금요일까지 로고 원본을 보내 주세요');
  const html=view(p);assert.match(html,/<p class="focus-memo"><span>담당자 안내<\/span>금요일까지 로고 원본을 보내 주세요<\/p>/);
  assert.match(html,/건너뜀/,'03 concepts were skipped once 04 scenes were confirmed');
  const shared=base({references:[{id:'ref',author:'staff',label:'제작팀 예시'}]});shared.studio.strategy={revision:0,data:{},history:[]};
  assert.doesNotMatch(view(shared),/건너뜀/,'material the team shared first does not skip the customer\'s plan');
  assert.equal(nextDecision({...p,nextStep:next.text}).note,undefined,'a note equal to the stage text is not repeated');
});

test('recent news on the overview counts what the team shared, not only messages',()=>{
  const p=base({concepts:[{id:'c1',title:'창가의 3분',revision:1,visibility:'customer',at:'2026-10-18T01:00:00Z'},{id:'c2',title:'INTERNAL-ONLY',revision:1,visibility:'internal',at:'2026-10-18T02:00:00Z'}],scenes:[{id:'s1',title:'첫 장면',revision:2,visibility:'customer',at:'2026-10-18T03:00:00Z'}]});
  p.versions=[{id:'v1',kind:'preview',label:'시안 v1',createdAt:'2026-10-18T04:00:00Z'}];
  const tile=(view(p).match(/<article class="tile feed-tile">[^]*?<\/article>/)||[''])[0];
  assert.doesNotMatch(tile,/아직 주고받은 소식이 없어요|INTERNAL-ONLY/);
  assert.deepEqual(Array.from(tile.matchAll(/<b>([^<]*)<\/b><small>/g),match=>match[1]),['새 시안 · 시안 v1','장면 구성 · 장면 1개','새 콘셉트 · 창가의 3분']);
  assert.match(tile,/<li class="new">/);
});

test('the entrance explains a failed or ended link in place, and only the customer header drops the logout button',()=>{
  const failed=welcome({entryError:{title:'이 초대 링크로는 열 수 없어요',text:'<담당자>에게 새 링크를 요청해 주세요.'}});
  assert.match(failed,/<div class="entry-alert" role="alert"><strong>이 초대 링크로는 열 수 없어요<\/strong><p>&lt;담당자&gt;에게 새 링크를 요청해 주세요\.<\/p><\/div>/);
  assert.doesNotMatch(welcome({}),/entry-alert/);
  assert.doesNotMatch(header({mode:'customer',project:{id:'p'},live:{}}),/data-action="logout"/);
  assert.match(header({mode:'staff',user:{name:'제작자'},live:{}}),/data-action="logout"/);
  const offered=view(base(),{rememberOffer:true});assert.match(offered,/class="remember-offer"/);assert.match(offered,/data-action="remember-device"/);assert.match(offered,/data-action="remember-dismiss"/);
  assert.match(offered,/초대 링크 없이 이 브라우저에서 프로젝트가 열려요/);assert.match(view(base(),{rememberOffer:true,desktopApp:true}),/초대 링크 없이 이 PC 앱에서 프로젝트가 열려요/);
  assert.doesNotMatch(view(base(),{rememberOffer:true,demo:true,demoGuide:{step:1,total:7,title:'체험',description:'체험 설명',tab:'direction',action:'taste',button:'열기'}}),/remember-offer/);assert.match(view(base(),{demo:true,demoPersistent:true,demoGuide:{step:1,total:7,title:'체험',description:'체험 설명',tab:'direction',action:'taste',button:'열기'}}),/실제 의뢰나 승인으로 이어지지 않아요/,'체험 안내 띠의 면책 한 줄');assert.doesNotMatch(view(base(),{rememberOffer:false}),/remember-offer/);
  const panel=remembered=>liveView({mode:'customer',live:{open:true,status:'connected',notifications:[],unreadCount:0,rememberKnown:true,remembered}});
  assert.match(panel(false),/class="button quiet small-button panel-logout is-customer" data-action="logout"/);
  const css=readFileSync(new URL('app.css',appDir),'utf8');assert.match(css,/\.panel-logout\.is-customer\{display:inline-flex\}/,'customers close the connection from the inbox at every width');
  assert.match(failed,/^<div class="welcome has-entry-error">/);assert.match(css,/\.welcome\.has-entry-error \.welcome-art\{display:none\}/);
  assert.match(panel(false),/data-action="remember-device"/);assert.match(panel(true),/이 기기는 기억돼 있어요/);assert.doesNotMatch(panel(true),/data-action="remember-device"/);
});

test('the quiet approval card never opens a second grid column on one-column screens',()=>{
  const css=readFileSync(new URL('app.css',appDir),'utf8').replace(/\r\n/g,'\n');
  const rule='@media (max-width:1023px){.approval-card:not(.is-floating){grid-column:auto}}';
  assert.ok(css.includes(rule));assert.ok(css.lastIndexOf(rule)>css.lastIndexOf('.approval-card:not(.is-floating){position:static'),'declared after the rule that puts it in column 2');
});

test('an ended connection keeps unsent writing in memory for the same project only',()=>{
  const source=readFileSync(new URL('app.mjs',appDir),'utf8'),line=name=>source.split('\n').find(text=>text.startsWith(`function ${name}(`));
  const context=vm.createContext({notices:[]});
  vm.runInContext(`let keptDrafts=null;const demo=null,drafts=new Map(),s={mode:'customer',project:{id:'p'}};
function resetContext(){drafts.clear();s.project=null;}function render(){}function notice(message){notices.push(message);}
${line('restoreKeptDrafts')}
${line('connectionExpired')}
globalThis.api={drafts,s,expire:()=>connectionExpired(),restore:()=>restoreKeptDrafts(),kept:()=>keptDrafts};`,context);
  const {api}=context;api.drafts.set('customer:customer:p:round-draft:new',{values:{text:'보내기 전 의견'}});
  api.expire();assert.equal(api.drafts.size,0);assert.match(api.s.entryError.text,/쓰던 글이 그대로 남아 있어요/);assert.equal(api.kept().projectId,'p');
  api.s.project={id:'other'};assert.equal(api.restore(),false,'another project never receives the writing');assert.equal(api.kept(),null);
  api.drafts.set('customer:customer:p:round-draft:new',{values:{text:'다시'}});api.s.project={id:'p'};api.expire();api.s.project={id:'p'};
  assert.equal(api.restore(),true);assert.equal(api.drafts.get('customer:customer:p:round-draft:new').values.text,'다시');
  api.drafts.clear();api.s.project={id:'p'};api.expire();assert.equal(api.kept(),null);assert.doesNotMatch(api.s.entryError.text,/쓰던 글/);
});

test('every button the client room renders has a handler',()=>{
  const files=readdirSync(appDir).filter(file=>file.endsWith('.mjs')),emitted=new Map();
  for(const file of files){const source=readFileSync(new URL(file,appDir),'utf8');
    for(const match of source.matchAll(/data-action="([a-z0-9-]+)"/g))emitted.set(match[1],file);
    for(const match of source.matchAll(/\b(?:btn|button)\(\s*(?:'[^']*'|`[^`]*`|[^,()]+),\s*'([a-z0-9-]+)'/g))emitted.set(match[1],file);
  }
  const handlers=['app.mjs','production-ui.mjs','animatic-player.mjs','casting-view.mjs'].map(file=>readFileSync(new URL(file,appDir),'utf8')).join('\n');
  const missing=[...emitted].filter(([action])=>!handlers.includes(`'${action}'`)&&!handlers.includes(`data-action=${action}]`));
  assert.ok(emitted.size>60);assert.deepEqual(missing,[]);
});

test('the plan save notice follows what the server kept',()=>{
  const confirmed={revision:1,data:{},request:{strategyRevision:1},confirmation:{strategyRevision:1}},requested={revision:1,data:{},request:{strategyRevision:1},confirmation:null};
  assert.equal(strategySaveMessage(confirmed,'customer',confirmed),'바뀐 내용이 없어 그대로 두었어요.');
  assert.equal(strategySaveMessage(confirmed,'customer',{revision:2,request:{strategyRevision:2,carriedFrom:1},confirmation:{strategyRevision:2,carriedFrom:1}}),'모델·스타일을 저장했어요. 확인한 제작 설계는 그대로예요.');
  assert.equal(strategySaveMessage(requested,'customer',{revision:2,request:{strategyRevision:2,carriedFrom:1},confirmation:null}),'모델·스타일을 저장했어요. 확인 요청은 그대로라 바로 확인할 수 있어요.');
  assert.match(strategySaveMessage(confirmed,'customer',{revision:2,request:null,confirmation:null}),/전에 받은 확인 요청은 끝났/);
  assert.match(strategySaveMessage(confirmed),/다시 요청하면 확인할 수 있어요/,'callers without the saved result keep the old notice');
});

test('the demo does not create a version for an unchanged plan and carries a confirmation across its own casting change',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const demo=createDemoSession({storage});let project=demo.snapshot().project;
  const studio=body=>demo.request('/pulse/api/studio',{method:'POST',body:{revision:demo.snapshot().project.revision,...body}});
  const strategy=()=>demo.snapshot().project.studio.strategy;
  await studio({action:'save_strategy',strategy:structuredClone(strategy().data)});
  assert.equal(demo.snapshot().project.revision,project.revision);assert.equal(strategy().revision,project.studio.strategy.revision);
  if(strategy().request?.strategyRevision!==strategy().revision)demo.advance();
  await studio({action:'confirm_strategy',strategyRevision:strategy().revision});const confirmed=strategy();assert.equal(confirmed.confirmation.strategyRevision,confirmed.revision);
  await studio({action:'save_strategy',strategy:{...structuredClone(confirmed.data),castingSelection:{...confirmed.data.castingSelection,modelId:'F02',voice:''}}});
  assert.equal(strategy().revision,confirmed.revision+1);assert.equal(strategy().confirmation.strategyRevision,strategy().revision);assert.equal(strategy().confirmation.carriedFrom,confirmed.revision);
  await studio({action:'save_strategy',strategy:{...structuredClone(strategy().data),primaryPromise:'바뀐 약속'}});assert.equal(strategy().confirmation,null);
});
