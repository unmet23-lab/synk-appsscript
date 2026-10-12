import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const entryId='a'.repeat(64),experimentId='opening-question';
const card={entryId,title:'카페에서 다시 말해 주세요',channelName:'로컬 예시',platform:'youtube',format:{id:'youtube-shorts',label:'YouTube Shorts'},status:'limited',statusLabel:'비교 자료 부족',summary:'확인한 72시간 기록을 바탕으로 실험을 고를 수 있어요.',dueAt:'2026-10-11T00:00:00.000Z',observedAt:'2026-10-11T00:05:00.000Z',missing:['도달'],limits:['같은 조건 3편 이상부터 비교합니다.'],facts:[{id:'views',label:'조회',value:0,unit:'count',observedAt:'2026-10-11T00:05:00.000Z',source:'manual',comparison:{sampleCount:2,median:null,deltaPercent:null,status:'insufficient'}}],source:{available:true,packageId:'11111111-1111-4111-8111-111111111111',productionId:'22222222-2222-4222-8222-222222222222',versionId:'33333333-3333-4333-8333-333333333333',title:'카페 대화 원본',versionLabel:'완성본 v1'},experiments:[{id:experimentId,title:'도입 질문 바꾸기',reason:'같은 주제로 한 가지를 바꿔 비교해 봅니다.',change:'첫 문장을 질문으로 바꾸기',measure:'72시간 조회와 평균 시청 시간'}],canPlan:true};
const learning={cards:[card],generatedAt:'2026-10-11T01:00:00.000Z'};
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(){
  const requests=[],plans=[],notices=[],timers=new Map(),handlers=new Map();let timerId=0,renders=0,writes=0,markup='';
  const evidence={open:true,dataset:{pfLearningEvidence:entryId}},time={textContent:''},status={textContent:''};
  const element={get innerHTML(){return markup;},set innerHTML(value){writes++;markup=value;},contains(node){return !!node?.insideLearning;},querySelector(selector){return selector==='[data-pf-learning-time]'?time:null;},querySelectorAll(selector){return selector==='[data-pf-learning-evidence]'?[evidence]:[];},focus(){context.document.activeElement=this;},nextElementSibling:null};
  const context=vm.createContext({console,URL,URLSearchParams,structuredClone,Date,Intl,escape,queueMicrotask,location:new URL('http://localhost:64046/?tab=workroom&section=tools&tool=publication'),state:{user:{id:'owner',role:'member'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'publication'},document:{visibilityState:'visible',activeElement:null,querySelector(selector){return selector==='[data-pf-learning]'?element:selector==='[data-pf-status]'?status:null;},addEventListener(type,callback){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(callback);}},window:{scrollX:0,scrollY:100,getSelection:()=>({isCollapsed:true}),getComputedStyle:()=>({overflowY:'auto'}),scrollTo(x,y){this.scrollX=x;this.scrollY=y;}},setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);},api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},openPublicationLearningPlan(id,experiment){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});plans.push({id,experiment,resolve,reject});return promise;},render(){renders++;},notify(){}});
  vm.runInContext(readFileSync(new URL('./public/publication-flow.js',import.meta.url),'utf8'),context);const run=code=>vm.runInContext(code,context);
  context.initial={learning,performance:{canWrite:true,channels:[],entries:[],metricDefinitions:[{id:'views',label:'조회'}]},studio:{productions:[]},packages:{packages:[]},catalog:{channels:[]}};context.card=structuredClone(card);context.entryId=entryId;context.experimentId=experimentId;
  run('pfIdentity();pf.data=structuredClone(initial);pf.view="performance";pf.attempted=true');element.innerHTML=run('pfLearningContents()');run('pf.learningPaint=pfLearningKey()');writes=0;
  context.notify=message=>notices.push(message);
  return {context,run,requests,plans,notices,timers,handlers,element,evidence,time,status,get writes(){return writes;},get renders(){return renders;},fire(type){for(const handler of handlers.get(type)||[])handler({});}};
}

test('learning cards preserve actual zero, observation provenance and insufficient comparison separately',()=>{
  const f=fixture(),html=f.run('pfLearningContents()');assert.match(html,/<dd>0 개<\/dd>/);assert.match(html,/직접 확인/);assert.match(html,/비교 자료 부족 · 이전 같은 조건 2편/);assert.match(html,/미확인: 도달/);assert.match(html,/카페 대화 원본 · 완성본 v1/);assert.match(html,/data-pf-action="learning-plan"/);
  f.run('card.facts[0].value=null');assert.match(f.run('pfLearningCard(card)'),/<dd>미확인<\/dd>/);
  f.run('card.facts[0].comparison={status:"ready",sampleCount:3,median:0,deltaPercent:null}');const zeroMedian=f.run('pfLearningCard(card)');assert.match(zeroMedian,/3편 중앙값 0/);assert.ok(!zeroMedian.includes('Infinity'));
});

test('all learning facts, source labels and experiment prose are escaped before insertion',()=>{
  const f=fixture(),bad='<img src=x onerror=alert(1)>';f.context.bad=bad;f.run('for(const key of ["title","channelName","summary","statusLabel"])card[key]=bad;card.missing=[bad];card.limits=[bad];card.source.title=bad;card.source.versionLabel=bad;card.facts[0].label=bad;card.facts[0].unit=bad;card.experiments=[{id:bad,title:bad,reason:bad,change:bad,measure:bad}]');const html=f.run('pfLearningCard(card)');assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('onclick='));
});

test('legacy metrics without source provenance are never labelled automatic observations',()=>{
  const f=fixture();f.run('card.facts[0].source="출처 미기록"');let html=f.run('pfLearningFact(card.facts[0])');assert.match(html,/출처 미기록/);assert.ok(!html.includes('자동 관측'));f.run('card.facts[0].source="api:youtube"');assert.match(f.run('pfLearningFact(card.facts[0])'),/자동 관측/);f.run('card.facts[0].source="<img src=x>"');html=f.run('pfLearningFact(card.facts[0])');assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
});

test('viewer, waiting, missing and non-plannable records never expose or invoke a plan action',async()=>{
  const f=fixture();for(const status of ['waiting','missing']){f.context.nextStatus=status;f.run('pf.data.learning.cards[0].status=nextStatus');assert.ok(!f.run('pfLearningContents()').includes('data-pf-action="learning-plan"'));await f.run('pfLearningPlan(entryId,experimentId)');}
  f.run('pf.data.learning.cards[0].status="limited";pf.data.learning.cards[0].canPlan=false');await f.run('pfLearningPlan(entryId,experimentId)');assert.ok(!f.run('pfLearningContents()').includes('data-pf-action="learning-plan"'));
  f.run('pf.data.learning.cards[0].canPlan=true');f.context.state.user.role='viewer';await f.run('pfLearningPlan(entryId,experimentId)');assert.ok(!f.run('pfLearningContents()').includes('data-pf-action="learning-plan"'));assert.equal(f.plans.length,0);assert.equal(f.requests.length,0);
});

test('workspace refresh supplies learning without a second request and supersedes an older poll',async()=>{
  const f=fixture(),old=f.run('pfLearningLoad()'),fresh=f.run('pfLoad()');f.requests[1].resolve({...f.context.initial,learning:{...learning,cards:[{...card,title:'현재 기록'}]}});await fresh;f.requests[0].resolve({...learning,cards:[{...card,title:'지난 기록'}]});await old;assert.equal(f.run('pfLearningCards()[0].title'),'현재 기록');assert.equal(f.requests.length,2);
});

test('automatic learning update leaves unsaved registration and metric input nodes, focus and details intact',async()=>{
  const f=fixture(),editor={value:'아직 저장하지 않은 근거',selectionStart:2,selectionEnd:6,closest:()=>true,getBoundingClientRect:()=>({top:320}),parentElement:null},metricDetails={open:true};f.context.editor=editor;f.context.metricDetails=metricDetails;f.context.document.activeElement=editor;f.run('pf.registration.title="등록 중인 제목";pf.manual[entryId+":72"]={metrics:{views:"12"},measuredAt:"2026-10-11T10:00",note:"미저장"}');const poll=f.run('pfLearningLoad()');assert.equal(f.requests[0].path,'/api/publication-learning');assert.equal(f.requests[0].body,undefined);f.requests[0].resolve({...learning,cards:[{...card,title:'자동 갱신한 회고'}]});await poll;
  assert.match(f.element.innerHTML,/자동 갱신한 회고/);assert.equal(f.renders,0);assert.equal(f.context.document.activeElement,editor);assert.equal(editor.value,'아직 저장하지 않은 근거');assert.equal(editor.selectionStart,2);assert.equal(editor.selectionEnd,6);assert.equal(metricDetails.open,true);assert.equal(f.evidence.open,true);assert.equal(f.run('pf.registration.title'),'등록 중인 제목');assert.equal(f.run('pf.manual[entryId+":72"].note'),'미저장');
});

test('unchanged cards update the timestamp without replacing their DOM',async()=>{
  const f=fixture(),poll=f.run('pfLearningLoad()');f.requests[0].resolve({...learning,generatedAt:'2026-10-11T01:10:00.000Z'});await poll;assert.equal(f.writes,0);assert.ok(f.time.textContent.includes('10:10'));assert.equal(f.renders,0);
});

test('selected learning prose and focused controls defer painting until selection or focus is released',async()=>{
  const f=fixture();f.context.window.getSelection=()=>({isCollapsed:false,rangeCount:1,getRangeAt:()=>({intersectsNode:()=>true})});const poll=f.run('pfLearningLoad()');f.requests[0].resolve({...learning,cards:[{...card,title:'변경 내용'}]});await poll;assert.equal(f.writes,0);f.context.window.getSelection=()=>({isCollapsed:true});f.context.document.activeElement={insideLearning:true};f.run('pfLearningPaint()');assert.equal(f.writes,0);f.context.document.activeElement=null;f.fire('selectionchange');assert.equal(f.writes,1);assert.match(f.element.innerHTML,/변경 내용/);
});

test('clicking a focused experiment that changed during polling refreshes its card and explains the change',async()=>{
  const f=fixture();f.context.document.activeElement={insideLearning:true,dataset:{pfAction:'learning-plan',entry:entryId,experiment:experimentId}};const poll=f.run('pfLearningLoad()');f.requests[0].resolve({...learning,cards:[{...card,experiments:[{...card.experiments[0],id:'new-example',title:'새 사례로 시험하기'}]}]});await poll;assert.equal(f.writes,0);assert.match(f.element.innerHTML,/도입 질문 바꾸기/);assert.equal(await f.run('pfLearningPlan(entryId,experimentId)'),false);assert.equal(f.plans.length,0);assert.match(f.element.innerHTML,/새 사례로 시험하기/);assert.ok(!f.element.innerHTML.includes('도입 질문 바꾸기'));assert.match(f.notices[0],/성과 기록이 바뀌었어요/);
});

test('actionable learning cards precede incomplete and waiting records without changing order within a status',()=>{
  const f=fixture();f.run('pf.data.learning.cards=[{...card,entryId:"waiting",status:"waiting"},{...card,entryId:"limited-first",status:"limited"},{...card,entryId:"missing",status:"missing"},{...card,entryId:"ready-first",status:"ready"},{...card,entryId:"limited-second",status:"limited"},{...card,entryId:"ready-second",status:"ready"}]');assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfLearningCards().map(row=>row.entryId))')),['ready-first','ready-second','limited-first','limited-second','missing','waiting']);assert.equal(f.run('pf.data.learning.cards[0].entryId'),'waiting');
});

test('polling runs once every ten seconds only in the visible performance view and leaves inbox timers independent',()=>{
  const f=fixture();f.run('pf.inboxTimer=setTimeout(()=>{},5000);pfLearningSchedule();pfLearningSchedule()');assert.equal([...f.timers.values()].filter(row=>row.delay===10000).length,1);assert.equal(f.timers.size,2);f.context.document.visibilityState='hidden';f.fire('visibilitychange');assert.equal(f.timers.size,0);f.context.document.visibilityState='visible';f.run('pf.view="prepare";pfLearningSchedule()');assert.equal(f.timers.size,0);f.run('pf.view="performance";pfLearningSchedule()');assert.equal(f.timers.size,1);f.run('publicationFlowReset()');assert.equal(f.timers.size,0);
});

test('a response arriving after hiding, navigation or account replacement cannot repopulate learning',async()=>{
  for(const mode of ['hidden','navigate','account']){const f=fixture(),pending=f.run('pfLearningLoad()');if(mode==='hidden'){f.context.document.visibilityState='hidden';f.fire('visibilitychange');}else if(mode==='navigate'){f.context.makerTools.view='content';f.run('pfLearningSchedule()');}else{f.context.state.user={id:'another',role:'member'};f.run('pfIdentity()');}f.requests[0].resolve({...learning,cards:[{...card,title:'이전 계정 응답'}]});await pending;assert.equal(f.writes,0);assert.ok(!f.run('JSON.stringify(pf.data)').includes('이전 계정 응답'));}
});

test('permissions errors clear stale private learning even while the old card has focus or a selection',async()=>{
  const f=fixture();f.context.document.activeElement={insideLearning:true,dataset:{pfAction:'learning-plan',entry:entryId,experiment:experimentId}};f.context.window.getSelection=()=>({isCollapsed:false,rangeCount:1,getRangeAt:()=>({intersectsNode:()=>true})});const pending=f.run('pfLearningLoad()');f.requests[0].reject(Object.assign(new Error('이 기록을 볼 권한이 없습니다.'),{status:403}));await pending;assert.equal(f.run('pf.data.learning'),null);assert.ok(!f.element.innerHTML.includes(card.title));assert.match(f.element.innerHTML,/볼 권한이 없습니다/);assert.ok(!f.element.innerHTML.includes('회고할 게시 기록이 아직 없어요'));
});

test('records filtered out by a permissions change disappear even while their previous content is selected',async()=>{
  const f=fixture();f.context.document.activeElement={insideLearning:true,dataset:{pfAction:'learning-plan',entry:entryId,experiment:experimentId}};f.context.window.getSelection=()=>({isCollapsed:false,rangeCount:1,getRangeAt:()=>({intersectsNode:()=>true})});const pending=f.run('pfLearningLoad()');f.requests[0].resolve({...learning,cards:[]});await pending;assert.ok(!f.element.innerHTML.includes(card.title));assert.match(f.element.innerHTML,/회고할 게시 기록이 아직 없어요/);
});

test('malformed or failed learning reads show a retryable error instead of a false empty state',async()=>{
  const f=fixture(),malformed=f.run('pfLearningLoad()');f.requests[0].resolve({generatedAt:learning.generatedAt});await malformed;assert.match(f.element.innerHTML,/정보를 확인할 수 없어요/);assert.ok(!f.element.innerHTML.includes('회고할 게시 기록이 아직 없어요'));const retry=f.run('pfLearningLoad()');f.requests[1].resolve(learning);await retry;assert.equal(f.run('pf.learningError'),'');assert.match(f.element.innerHTML,/카페에서 다시 말해 주세요/);
});

test('manual metrics save schedules learning immediately without waiting on or changing the write result',async()=>{
  const f=fixture();f.run('pf.data.performance.entries=[{id:entryId,canEdit:true,checkpoints:[{hours:72,metrics:{views:null}}]}];pf.manual[entryId+":72"]={metrics:{views:"0"},measuredAt:"2026-10-11T10:00",note:"확인"}');const save=f.run('pfSaveMetrics(entryId,72)');f.requests[0].resolve({entry:{id:entryId,canEdit:true,checkpoints:[{hours:72,metrics:{views:0}}]}});await save;assert.equal(f.run('pf.busy'),false);assert.equal(f.run('pf.manual[entryId+":72"]'),undefined);const timer=[...f.timers.values()].find(row=>row.delay===0);assert.ok(timer);timer.callback();assert.equal(f.requests[1].path,'/api/publication-learning');f.requests[1].resolve(learning);await new Promise(resolve=>setImmediate(resolve));assert.match(f.status.textContent,/확인한 숫자를 저장/);
});

test('plan actions invoke the existing planner once, retain drafts, and recover from failure',async()=>{
  const f=fixture();f.run('pf.registration.title="미저장 게시 기록"');const pending=f.run('pfLearningPlan(entryId,experimentId)');await f.run('pfLearningPlan(entryId,experimentId)');assert.equal(f.plans.length,1);assert.equal(f.plans[0].id,entryId);assert.equal(f.plans[0].experiment,experimentId);assert.equal(f.run('pf.learningBusy'),true);f.plans[0].reject(new Error('기획 연결을 확인해 주세요.'));assert.equal(await pending,false);assert.equal(f.run('pf.learningBusy'),false);assert.equal(f.run('pf.registration.title'),'미저장 게시 기록');assert.match(f.element.innerHTML,/기획 연결을 확인/);
  const retry=f.run('pfLearningPlan(entryId,experimentId)');f.plans[1].resolve(true);assert.equal(await retry,true);
});

test('invalid experiment and entry identifiers cannot invoke the planner, and late failures cannot cross sessions',async()=>{
  const f=fixture();await f.run('pfLearningPlan(entryId,"nonexistent")');await f.run('pfLearningPlan("11111111-1111-4111-8111-111111111111",experimentId)');assert.equal(f.plans.length,0);const pending=f.run('pfLearningPlan(entryId,experimentId)');f.context.state.user={id:'different',role:'member'};f.run('pfIdentity()');f.plans[0].reject(new Error('private old error'));await pending;assert.equal(f.run('pf.data'),null);assert.equal(f.run('pf.learningError'),'');
});

test('new learning cards compensate an edited field inside the workroom scroll container',async()=>{
  const f=fixture(),main={scrollTop:700,scrollLeft:0,scrollHeight:2400,clientHeight:800,parentElement:null};let added=0,html=f.element.innerHTML;const editor={value:'유지할 근거',selectionStart:1,selectionEnd:3,closest:()=>true,parentElement:main,getBoundingClientRect:()=>({top:280+added-(main.scrollTop-700)})};f.context.document.activeElement=editor;Object.defineProperty(f.element,'innerHTML',{get:()=>html,set:value=>{html=value;added=68;}});const pending=f.run('pfLearningLoad()');f.requests[0].resolve({...learning,cards:[...learning.cards,{...card,entryId:'b'.repeat(64)}]});await pending;assert.equal(editor.getBoundingClientRect().top,280);assert.equal(main.scrollTop,768);assert.equal(f.context.document.activeElement,editor);assert.equal(editor.selectionStart,1);assert.equal(f.context.window.scrollY,100);
});
