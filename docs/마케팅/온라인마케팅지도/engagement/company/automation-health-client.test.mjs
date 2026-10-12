import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createAutomationHealthService} from './automation-health.mjs';

const source=readFileSync(new URL('./public/automation-health.js',import.meta.url),'utf8');
const weeklySource=readFileSync(new URL('./public/weekly-summary.js',import.meta.url),'utf8');
const numbers={package:1,performance:2,inbox:3,today:4,learning:5,review:6,client:7,links:8,weekly:9,delivery:11,closeout:12,kickoff:13,changes:14,requests:15,schedule:16,deliveryCheck:17,rights:34};
const ids=Object.keys(numbers);
const report=()=>({refreshedAt:'2026-10-12T01:00:00.000Z',cards:ids.map((id,index)=>({id,number:numbers[id],title:'자동화 '+numbers[id],mode:(numbers[id]>=11&&numbers[id]<=16)||id==='rights'?'on-demand':'scheduled',status:'idle',statusLabel:'할 일 없음',text:'현재 처리할 대상이 없습니다.',href:'/?tab=workroom&section=tools&tool=publication',checkedAt:'2026-10-12T01:00:00.000Z',lastAttemptAt:null,lastSuccessAt:null,lastSuccessLabel:'최근 정상 점검',lastResultAt:null,nextRunAt:null,nextDueAt:null,counts:{targets:0,issues:0,manual:0,paused:0}})),issues:[],manual:[],counts:{issues:0,manual:0,running:0,paused:0,partial:0},note:'현재 열람할 수 있는 작업만 확인합니다.'});
const item=(id='issue',automationId='links')=>({id,automationId,kind:'publication_link',status:'failed',statusLabel:'접속 오류',title:'자료 링크',text:'오류 응답을 확인했습니다.',href:'/?tab=workroom&section=tools&tool=publication&publicationAction=link&packageId=owned-package',occurredAt:'2026-10-12T00:00:00Z',dueAt:null});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function projectGroup({waitingOnly=false}={}){
  const projectId='owned-project',items=[{id:'project-request',projectId,group:waitingOnly?'waiting':'reply',title:'장면별 수정 확인',statusLabel:'수정 의견 확인',href:'/?tab=workroom&section=clients&project=owned-project&version=owned-version&message=owned-message&seconds=62.5'},{id:'project-waiting',projectId,group:'waiting',title:'고객 답변 대기',statusLabel:'고객 확인 대기',href:'/?tab=workroom&section=clients&project=owned-project&schedule=1'}];
  return {projectId,projectTitle:'봄 캠페인',primary:waitingOnly?null:items[0],reason:waitingOnly?'고객 또는 내부 담당자의 확인을 기다려요. 지금 처리할 일은 없어요.':'수정 확인 기한이 지나 먼저 확인하세요.',urgency:waitingOnly?'waiting':'overdue',dueDate:'2026-10-11',counts:{total:2,actionable:waitingOnly?0:1,waiting:waitingOnly?2:1,customerWaiting:1,staffWaiting:waitingOnly?1:0},items};
}
function fixture(api=async()=>report()){
  const listeners={},links=[],timers=new Map();let now=Date.parse('2026-10-12T01:00:00Z'),timerId=0,main={scrollTop:0,scrollLeft:0},renders=0;
  const context=vm.createContext({state:{user:{id:'one',role:'member',teamId:'team'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'automation'},document:{hidden:false,activeElement:null,addEventListener(type,fn){(listeners[type]||=[]).push(fn);},getElementById(id){return id==='main'?main:null;},querySelectorAll(){return [];}},window:{scrollX:0,scrollY:0,scrollTo(){}},location:{origin:'https://workspace.test'},URL,URLSearchParams,queueMicrotask,setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},api,render(){renders++;},notify(){},escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),Date:class extends Date{static now(){return now;}},cdReadTarget:value=>new URL(value).searchParams.get('project')==='owned-project',pfReadTarget:value=>new URL(value).searchParams.get('packageId')==='owned-package',workspaceLinkDestination:value=>new URL(value,'https://workspace.test').hash==='#view=content&section=plan&draftId=owned-plan',openClientWorkflowLink:value=>{links.push(['client',value]);return true;},openPublicationWorkflowLink:value=>{links.push(['publication',value]);return true;},navigateWorkspaceLink:value=>{links.push(['content',value]);return true;},openWorkspaceDestination:value=>{links.push(['messenger',value]);return true;},selectWorkspaceView(...args){links.push(['workspace',...args]);context.state.tab=args[0];if(args[1])context.wr.view=args[1];},makerToolsEnsure(){}});
  vm.runInContext(weeklySource,context);vm.runInContext(source,context);
  return {context,links,timers,get renders(){return renders;},get main(){return main;},set main(value){main=value;},advance(ms){now+=ms;},run:code=>vm.runInContext(code,context),set(data){context.report=data;vm.runInContext('ahIdentity();automationHealthState.data=report',context);},async event(type,event={}){for(const listener of listeners[type]||[])await listener(event);},async timer(){const [id,value]=[...timers][0];timers.delete(id);value.fn();await tick();}};
}

test('the status tool only reads one API and repeated renders or refresh clicks do not duplicate an in-flight request',async()=>{
  const calls=[];let resolve;const f=fixture((...args)=>{calls.push(args);return new Promise(done=>resolve=done);});f.run('automationHealthEnsure()');f.run('automationHealthEnsure();ahLoad()');assert.deepEqual(calls,[['/api/automation-health']]);resolve(report());await tick();assert.equal(f.run('automationHealthState.loading'),false);f.run('automationHealthEnsure()');assert.equal(calls.length,1);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,60000);
});

test('missing sections, duplicate cards, unsupported states or absent counts are errors instead of an all-clear',async()=>{
  for(const change of [data=>data.cards.pop(),data=>data.cards[9].number=10,data=>data.cards[1]=data.cards[0],data=>data.cards[0].status='success',data=>delete data.counts.partial,data=>data.cards[0].counts.customerWaiting=-1,data=>data.cards[0].counts.targets=null,data=>data.refreshedAt='invalid',data=>data.issues.push({...item(),automationId:'unknown'})]){const data=report();change(data);const f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.data'),null);assert.match(f.run('automationHealthState.error'),/형식/);assert.doesNotMatch(f.run('automationHealthPanel()'),/현재 조치할 문제로 표시된 항목이 없어요/);}
});

test('late old-account results cannot replace another account or survive a reset',async()=>{
  const pending=[],f=fixture(()=>new Promise(resolve=>pending.push(resolve)));const first=f.run('ahLoad()');f.run('state.user={id:"two",role:"member"};automationHealthReset()');const second=f.run('ahLoad()'),fresh=report();fresh.note='new account';pending[1](fresh);await second;const old=report();old.note='PRIVATE OLD ACCOUNT';pending[0](old);await first;assert.equal(f.run('automationHealthState.data.note'),'new account');assert.doesNotMatch(f.run('automationHealthPanel()'),/PRIVATE OLD ACCOUNT/);
});

test('a role or team change invalidates an old response even when the account id stays the same',async()=>{
  for(const change of ['state.user.role="viewer"','state.user.teamId="another"']){let resolve;const f=fixture(()=>new Promise(done=>resolve=done));const pending=f.run('ahLoad()');f.run(change+';automationHealthSync()');resolve(report());await pending;assert.equal(f.run('automationHealthState.data'),null);assert.equal(f.run('automationHealthState.loading'),false);}
});

test('permission loss removes cached titles, links and counts while transient failures mark an older snapshot honestly',async()=>{
  for(const status of [401,403,404,500]){const f=fixture(async()=>{throw Object.assign(new Error('load failed'),{status});}),data=report();data.issues=[{...item(),title:'PRIVATE RECORD'}];f.set(data);await f.run('ahLoad()');const html=f.run('automationHealthPanel()');if(status===500){assert.match(html,/PRIVATE RECORD/);assert.match(html,/마지막으로 불러온 상태/);}else{assert.equal(f.run('automationHealthState.data'),null);assert.doesNotMatch(html,/PRIVATE RECORD/);}}
});

test('visible polling runs every minute, stops on hide/navigation, and refreshes a stale view when it returns',async()=>{
  const calls=[],f=fixture(async(...args)=>{calls.push(args);return report();});f.run('automationHealthEnsure()');await tick();f.advance(60000);await f.timer();assert.equal(calls.length,2);f.context.document.hidden=true;await f.event('visibilitychange');assert.equal(f.timers.size,0);f.advance(60000);f.run('automationHealthEnsure()');assert.equal(calls.length,2);f.context.document.hidden=false;await f.event('visibilitychange');await tick();assert.equal(calls.length,3);f.run('makerTools.view="weekly";automationHealthSync()');assert.equal(f.timers.size,0);f.advance(60000);f.run('makerTools.view="automation";automationHealthEnsure()');await tick();assert.equal(calls.length,4);assert.ok(calls.every(args=>args.length===1));
});

test('leaving or hiding during a load discards the late response and permits an immediate fresh load',async()=>{
  for(const hide of [true,false]){const pending=[],f=fixture(()=>new Promise(resolve=>pending.push(resolve)));const first=f.run('ahLoad()');if(hide){f.context.document.hidden=true;await f.event('visibilitychange');}else f.run('makerTools.view="publication";automationHealthSync()');pending[0](report());await first;assert.equal(f.run('automationHealthState.data'),null);assert.equal(f.run('automationHealthState.loading'),false);f.context.document.hidden=false;f.run('makerTools.view="automation";automationHealthEnsure()');assert.equal(pending.length,2);pending[1](report());await tick();assert.ok(f.run('automationHealthState.data'));}
});

test('resolved issues disappear on the next snapshot and each current issue is listed only once',async()=>{
  const f=fixture(),data=report();data.issues=[item(),item(),item('second')];data.manual=[item(),{...item('manual'),status:'manual'}];f.set(data);let html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-item="links:issue"/g)||[]).length,1);assert.match(html,/data-ah-item="links:manual"/);await f.run('ahLoad()');html=f.run('automationHealthPanel()');assert.doesNotMatch(html,/data-ah-item=/);assert.match(html,/현재 조치할 문제로 표시된 항목이 없어요/);
});

test('manual work, idle work, disabled schedules and partial data do not imply successful automation',()=>{
  const f=fixture(),data=report();data.cards[0].mode='on-demand';data.cards[0].status='ready';data.cards[1].status='paused';data.cards[1].nextRunAt='2026-10-12T02:00:00Z';data.cards[2].mode='manual';data.cards[2].status='manual';data.cards[3].status='partial';data.counts.partial=1;f.set(data);const html=f.run('automationHealthPanel()');assert.match(html,/실행 시점/);assert.match(html,/조회·요청할 때/);assert.match(html,/예약 꺼짐/);assert.match(html,/직접 확인할 때/);assert.match(html,/등록된 예정 없음/);assert.match(html,/기록 없음/);assert.match(html,/표시된 문제가 전체가 아닐 수/);assert.doesNotMatch(html,/모두 정상|전체 성공/);assert.doesNotMatch(f.run('ahCard(automationHealthState.data.cards[1])'),/2026\. 10\. 12\. 오전 11:00/);
});

test('scan success, result time, poll schedule and target due date remain separate evidence',()=>{
  const f=fixture(),data=report(),card=data.cards[1];Object.assign(card,{lastAttemptAt:'2026-10-12T01:00:00Z',lastSuccessAt:'2026-10-12T01:01:00Z',lastResultAt:'2026-10-11T22:00:00Z',nextRunAt:'2026-10-12T01:02:00Z',nextDueAt:'2026-10-13T01:00:00Z'});f.set(data);const html=f.run('ahCard(automationHealthState.data.cards[1])');for(const label of ['최근 시도','최근 정상 점검','최근 내 결과','다음 점검','대상 처리 예정'])assert.match(html,new RegExp(label));assert.equal((html.match(/<dt>/g)||[]).length,5);assert.match(f.run('automationHealthPanel()'),/최근 정상 점검은 개별 결과의 성공과 다릅니다/);
});

test('untrusted text is escaped in issue details, cards, labels and notes',()=>{
  const f=fixture(),data=report();data.issues=[{...item(),title:'<img src=x onerror=bad()>',text:'<script>secret</script>',statusLabel:'<svg onload=bad()>',href:'javascript:bad()'}];data.cards[0].title='<img src=x>';data.cards[0].lastSuccessLabel='<script>label</script>';data.note='<svg onload=bad()>';f.set(data);const html=f.run('automationHealthPanel()');assert.doesNotMatch(html,/<script>|<img src=x|<svg onload|href="javascript:/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;label/);
});

test('source link validation permits exact existing views and rejects arbitrary URLs, APIs and mixed parameters',()=>{
  const f=fixture();for(const href of ['https://workspace.test/?tab=home','//evil.test/','/\\evil.test/','/api/logout','javascript:bad()','/?tab=home&token=secret','/?tab=workroom&section=tools&tool=weekly&run=1','/?tab=workroom&section=tools&tool=quality','/?tab=home&tab=messenger','/?tab=messenger&panel=admin','/?tab=messenger&messageId=1','/?tab=workroom&section=clients&project=other','/?tab=home#view=messenger']){f.context.href=href;assert.equal(f.run('ahHref(href)'),'',href);}
  for(const href of ['/?tab=home','/?tab=workroom&section=clients','/?tab=workroom&section=tools&tool=weekly','/?tab=workroom&section=tools&tool=publication','/?tab=messenger&panel=tasks','/#view=content&section=plan&draftId=owned-plan']){f.context.href=href;assert.equal(f.run('ahHref(href)'),href);}
});

test('source navigation preserves package, client and message identifiers and never reruns a job',async()=>{
  const calls=[],f=fixture(async(...args)=>{calls.push(args);return report();});for(const href of ['/?tab=workroom&section=clients&project=owned-project&followUp=1','/?tab=workroom&section=tools&tool=publication&publicationAction=link&packageId=owned-package','/?tab=messenger&panel=tasks&channelId=channel-1&messageId=123','/#view=content&section=plan&draftId=owned-plan','/?tab=workroom&section=tools&tool=weekly','/?tab=workroom&section=clients','/?tab=home']){f.context.href=href;await f.run('ahOpenSource(href)');}assert.deepEqual(f.links.map(link=>link[0]),['client','publication','messenger','content','workspace','workspace','workspace']);assert.equal(f.links[2][1].messageId,'123');assert.equal(f.links[4][1],'workroom');assert.equal(f.links[5][2],'clients');assert.equal(f.links[6][1],'home');assert.deepEqual(calls,[]);
});

test('manual refresh preserves the main scroll and focused source across both loading and completion renders',async()=>{
  let resolve,focused=0;const f=fixture(()=>new Promise(done=>resolve=done));f.set(report());f.main={scrollTop:1680.5,scrollLeft:3.5};f.context.window.scrollX=2;f.context.window.scrollY=600;const scroll=[];f.context.window.scrollTo=(...args)=>scroll.push(args);f.context.document.activeElement={dataset:{ahFocus:'card:links'}};f.context.document.querySelectorAll=()=>[{dataset:{ahFocus:'card:links'},focus(options){assert.equal(options.preventScroll,true);focused++;}}];f.context.render=()=>{f.main={scrollTop:0,scrollLeft:0};};const pending=f.run('ahLoad()');assert.deepEqual(f.main,{scrollTop:1680.5,scrollLeft:3.5});resolve(report());await pending;assert.deepEqual(f.main,{scrollTop:1680.5,scrollLeft:3.5});assert.equal(focused,2);assert.deepEqual(scroll,[[2,600],[2,600]]);
});

test('mounted refresh keeps existing cards during loading and replaces only the automation panel with focus, details and scroll intact',async()=>{
  let resolve,focused=0,replacements=0,html='',removedErrors=0;const f=fixture(()=>new Promise(done=>resolve=done)),data=report();data.manual=Array.from({length:5},(_,i)=>({...item('manual-'+i),status:'manual'}));f.set(data);f.run('automationHealthState.expanded.manual=true');
  f.main={scrollTop:1680.5,scrollLeft:3.5};const sidebar={identity:'unchanged sidebar'},main=f.main,button={disabled:false,textContent:'새로고침'},attributes={},panel={setAttribute(name,value){attributes[name]=value;},querySelector(selector){return selector==='[data-ah-action="refresh"]'?button:selector==='.ah-error'?{remove(){removedErrors++;}}:null;},set outerHTML(value){html=value;replacements++;f.main.scrollTop=0;f.main.scrollLeft=0;}};
  const target={dataset:{ahFocus:'card:links'},focus(options){assert.equal(options.preventScroll,true);focused++;}};f.context.document.activeElement=target;f.context.document.querySelector=selector=>selector==='.ah-panel'?panel:sidebar;f.context.document.querySelectorAll=()=>[target];f.context.render=()=>assert.fail('must not replace the workspace');
  const pending=f.run('ahLoad()');assert.equal(replacements,0);assert.equal(button.disabled,true);assert.equal(button.textContent,'불러오는 중…');assert.equal(attributes['aria-busy'],'true');assert.equal(removedErrors,1);assert.equal(f.context.document.activeElement,target);assert.equal(f.main,main);assert.equal(focused,0);
  resolve(data);await pending;assert.equal(replacements,1);assert.equal(focused,1);assert.equal(f.main,main);assert.deepEqual(f.main,{scrollTop:1680.5,scrollLeft:3.5});assert.match(html,/aria-busy="false"/);assert.match(html,/data-ah-group="manual" open/);assert.match(html,/data-ah-action="refresh" data-ah-focus="refresh" >새로고침/);assert.equal(f.context.document.querySelector('#sidebar'),sidebar);
});

test('refresh-button focus is restored after disabling blurs it, but another focused control is respected',async()=>{
  for(const moveFocus of [false,true]){
    let resolve,focused=0;const f=fixture(()=>new Promise(done=>resolve=done));f.set(report());const body={},elsewhere={dataset:{}},refresh={dataset:{ahFocus:'refresh'},focus(){focused++;}},button={set disabled(value){if(value)f.context.document.activeElement=body;}};
    const panel={setAttribute(){},querySelector:selector=>selector==='[data-ah-action="refresh"]'?button:null,set outerHTML(value){assert.match(value,/aria-busy="false"/);}};
    f.context.document.body=body;f.context.document.activeElement=refresh;f.context.document.querySelector=()=>panel;f.context.document.querySelectorAll=()=>[refresh];f.context.render=()=>assert.fail('global render');
    const pending=f.run('ahLoad()');if(moveFocus)f.context.document.activeElement=elsewhere;resolve(report());await pending;assert.equal(focused,moveFocus?0:1);assert.equal(f.run('automationHealthState.refreshFocus'),false);
  }
});

test('panel-only error rendering clears revoked data and labels transient snapshots without an app render',async()=>{
  for(const status of [403,500]){let html='';const f=fixture(async()=>{throw Object.assign(Error('load failed'),{status});}),data=report();data.issues=[{...item(),title:'PRIVATE RECORD'}];f.set(data);const button={},panel={setAttribute(){},querySelector:selector=>selector==='[data-ah-action="refresh"]'?button:null,set outerHTML(value){html=value;}};f.context.document.querySelector=()=>panel;f.context.render=()=>assert.fail('global render');await f.run('ahLoad()');assert.match(html,/role="alert"/);assert.match(html,/aria-busy="false"/);if(status===403)assert.doesNotMatch(html,/PRIVATE RECORD/);else{assert.match(html,/PRIVATE RECORD/);assert.match(html,/마지막으로 불러온 상태/);}}
});

test('reused date formatter preserves the Korean timezone text and invalid-date fallback',()=>{
  const f=fixture();for(const value of ['2026-10-12T00:00:00Z','2026-10-12T15:59:00Z','2026-01-01T00:00:00+09:00']){f.context.value=value;assert.equal(f.run('ahDate(value)'),new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)));}for(const value of ['',null,'bad date']){f.context.value=value;assert.equal(f.run('ahDate(value)'),'시각 미확인');}
});

test('reset cancels the visible timer and the panel clears data before an account switch is painted',async()=>{
  const f=fixture();await f.run('ahLoad()');assert.equal(f.timers.size,1);f.run('state.user={id:"two",role:"member"};automationHealthPanel()');assert.equal(f.timers.size,0);assert.equal(f.run('automationHealthState.data'),null);assert.equal(f.run('automationHealthState.attempted'),false);
});

test('expanded manual items survive polling but are cleared for another account',async()=>{
  const data=report();data.manual=Array.from({length:6},(_,i)=>({...item('manual-'+i),status:'manual'}));const f=fixture(async()=>data);f.set(data);
  assert.match(f.run('automationHealthPanel()'),/나머지 3건 보기/);
  await f.event('toggle',{target:{dataset:{ahGroup:'manual'},open:true}});await f.run('ahLoad()');assert.equal(f.run('automationHealthState.expanded.manual'),true);assert.match(f.run('automationHealthPanel()'),/data-ah-group="manual" open/);
  f.run('state.user={id:"two",role:"member"};automationHealthPanel()');assert.equal(f.run('automationHealthState.expanded.manual'),undefined);
});

test('disabled, failed and absent alert monitoring are not shown as enabled',()=>{
  const f=fixture();for(const monitor of [undefined,{enabled:false,status:'disabled'},{enabled:true,status:'error'}]){const data=report();data.monitor=monitor;f.set(data);assert.doesNotMatch(f.run('automationHealthPanel()'),/서버 실행 중 1분마다 점검/);}
  const data=report();data.monitor={enabled:true,status:'enabled',lastScanAt:'2026-10-12T01:00:00Z'};f.set(data);assert.match(f.run('automationHealthPanel()'),/서버 실행 중 1분마다 점검/);assert.match(f.run('automationHealthPanel()'),/작업실 안에서만 알림/);
});

test('menu, direct URL, desk shortcut and assets all connect to the same status tool',()=>{
  const maker=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8'),workroom=readFileSync(new URL('./public/workroom.js',import.meta.url),'utf8'),index=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');assert.match(maker,/\['automation','자동화 상태'/);assert.match(maker,/automationHealthEnsure\(\)/);assert.match(maker,/automationHealthReset\(\)/);assert.match(maker,/automationHealthSync\(\)/);assert.match(workroom,/'automation'\]\.includes\(params.get\('tool'\)\)/);assert.match(workroom,/wrButton\('자동화 상태 보기','automation'/);assert.match(index,/src="\/automation-health.js"/);assert.match(index,/href="\/automation-health.css"/);
});

test('the real service response including no-target and paused cards matches the client contract',async()=>{
  const user={id:'one',role:'member',active:true},store={get:(kind,id)=>kind==='users'&&id===user.id?user:null,all:()=>[],put:()=>assert.fail('status reads must not write')};
  const service=createAutomationHealthService({store,clock:()=> '2026-10-12T01:00:00.000Z',runtime:()=>({performance:{enabled:false},inbox:{enabled:false},links:{enabled:false},weekly:{enabled:false},deliveryCheck:{enabled:false}}),studio:{production:()=>assert.fail()},publicationPackages:{get:()=>assert.fail()},postPerformance:{list:()=>({entries:[],channels:[]})},publicationInbox:{state:()=>({available:false,active:false,entries:[]})},publicationWorkflow:{workspace:()=>({items:[]})},publicationLearning:{workspace:()=>({cards:[]})},clientProjects:{workspace:()=>({projects:[]})},clientWorkflow:{workspace:()=>({items:[]})},publicationLinks:{get:()=>assert.fail()},weeklySummary:{get:()=>({sections:[]})}});
  const data=service.get(user),f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.error'),'');assert.equal(f.run('automationHealthState.data.cards.length'),17);for(const card of data.cards){f.context.href=card.href;assert.equal(f.run('ahHref(href)'),card.href);}const html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.match(html,/예약 꺼짐/);assert.match(html,/조회·요청할 때/);assert.match(html,/직접 확인할 때/);assert.equal(data.cards.find(card=>card.id==='deliveryCheck').status,'paused');
});


test('all seventeen linked automations keep original numbers while on-demand source checks are distinct from stored results',()=>{
  const f=fixture(),data=report();for(const id of ['delivery','closeout','kickoff','changes','requests','schedule']){const card=data.cards.find(row=>row.id===id);Object.assign(card,{checkedAt:'2026-10-12T01:00:00Z',lastSuccessAt:'2026-10-12T01:00:00Z',lastResultAt:null,lastResultLabel:'최근 원문 기록',status:'manual',statusLabel:'고객 확인 대기'});}f.set(data);
  const html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.match(html,/연결된 자동화 17개/);assert.match(html,/11번 · 조회·요청 시/);assert.match(html,/17번 · 예약 점검/);assert.match(html,/34번 · 조회·요청 시/);assert.doesNotMatch(html,/10번 ·/);
  const card=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="schedule"))');for(const text of ['최근 상태 조회','최근 원문 기록','결과 기록 없음','조회·요청할 때','고객 확인 대기','다음 확인 기한'])assert.ok(card.includes(text),text);assert.doesNotMatch(card,/최근 정상 점검|다음 점검|실패/);assert.equal((card.match(/2026\. 10\. 12\./g)||[]).length,1);
  f.run('automationHealthState.data.cards.find(row=>row.id==="schedule").lastResultAt="2026-10-10T03:00:00Z"');const updated=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="schedule"))');assert.match(updated,/2026\. 10\. 12\./);assert.match(updated,/2026\. 10\. 10\./);
});

test('delivery inspection keeps scheduled runtime evidence separate from technical or human findings',()=>{
  const f=fixture(),data=report(),card=data.cards.find(row=>row.id==='deliveryCheck');Object.assign(card,{status:'manual',statusLabel:'담당자 확인 필요',lastAttemptAt:'2026-10-12T01:00:00Z',lastSuccessAt:'2026-10-12T01:01:00Z',lastResultAt:'2026-10-11T23:00:00Z',lastResultLabel:'최근 파일 검사 결과',nextRunAt:'2026-10-12T01:02:00Z',counts:{targets:2,issues:0,manual:2,paused:0}});data.manual=[{...item('files','deliveryCheck'),status:'manual',statusLabel:'파일 규격 확인',text:'길이 불일치가 있어 담당자가 파일을 확인합니다.'}];f.set(data);const html=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="deliveryCheck"))');for(const label of ['최근 시도','최근 정상 점검','최근 파일 검사 결과','다음 점검','문제 0','직접 확인 2'])assert.ok(html.includes(label),label);assert.match(f.run('automationHealthPanel()'),/시스템 실행 실패와 구분합니다/);
});

test('new client findings use the real exact project-card parser and never turn source navigation into a mutation',async()=>{
  const f=fixture(()=>assert.fail('source links must not submit automation actions')),clientSource=readFileSync(new URL('./public/client-projects.js',import.meta.url),'utf8');vm.runInContext(clientSource.slice(clientSource.indexOf('function cdReadTarget('),clientSource.indexOf('function cdDraftKey(')),f.context);const projectId='11111111-1111-4111-8111-111111111111';
  for(const context of ['delivery','closeout','kickoff','changes','requests','schedule','rights']){const href='/?tab=workroom&section=clients&project='+projectId+'&'+context+'=1'+(context==='rights'?'&rightsTarget=portfolio':'');f.context.href=href;assert.equal(f.run('ahHref(href)'),href);assert.equal(await f.run('ahOpenSource(href)'),true);assert.equal(f.links.at(-1)[0],'client');assert.equal(f.links.at(-1)[1],href);for(const suffix of ['&'+context+'=1','&version='+projectId,'&run=1','#bad']){f.context.bad=href+suffix;assert.equal(f.run('ahHref(bad)'),'');}}
  assert.equal(f.links.length,7);
});


test('customer and staff waiting counts are visible without being added to system failures',()=>{
  const f=fixture(),data=report(),card=data.cards.find(row=>row.id==='delivery');Object.assign(card,{status:'manual',statusLabel:'고객·담당자 확인 필요',counts:{targets:2,issues:0,manual:2,paused:0,customerWaiting:1,staffWaiting:2}});f.set(data);const html=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="delivery"))');assert.match(html,/문제 0/);assert.match(html,/직접 확인 2/);assert.match(html,/고객 확인 대기 1/);assert.match(html,/담당자 확인 2/);assert.match(html,/같은 프로젝트가 고객과 담당자의 확인을 함께/);assert.doesNotMatch(html,/실패/);
});


test('project groups keep all original automation cards, independent totals and every source item',()=>{
  const f=fixture(),data=report();data.projectGroups=[projectGroup()];f.set(data);const html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.equal((html.match(/data-ah-project=/g)||[]).length,1);assert.equal((html.match(/data-ah-project-item=/g)||[]).length,2);assert.match(html,/1개 프로젝트 · 할 일 항목 2개/);assert.match(html,/집계 범위가 다릅니다/);assert.match(html,/수정 확인 기한이 지나/);assert.match(html,/같은 프로젝트의 나머지 1개 항목/);assert.match(html,/답변·확인 대기 1개/);assert.match(html,/message=owned-message&amp;seconds=62.5/);assert.ok(html.indexOf('class="ah-summary"')<html.indexOf('id="ah-projects-title"'));assert.ok(html.indexOf('id="ah-issues-title"')<html.indexOf('id="ah-projects-title"'));assert.ok(html.indexOf('id="ah-manual-title"')<html.indexOf('id="ah-projects-title"'));assert.ok(html.indexOf('id="ah-projects-title"')<html.indexOf('id="ah-all-title"'));
});

test('waiting-only project groups do not fabricate a primary task and absent groups preserve the legacy panel',()=>{
  const f=fixture(),data=report();f.set(data);assert.doesNotMatch(f.run('automationHealthPanel()'),/data-ah-project=/);data.projectGroups=[projectGroup({waitingOnly:true})];f.set(data);const html=f.run('automationHealthPanel()');assert.match(html,/지금 처리할 일은 없어요/);assert.match(html,/대기 중인 2개 항목/);assert.doesNotMatch(html,/<strong>먼저 할 일<\/strong>/);assert.equal((html.match(/data-ah-project-item=/g)||[]).length,2);
});

test('project source failure stays explicitly unknown while other automation evidence remains available',async()=>{
  const data=report();data.projectGroups=null;data.projectGroupsError='프로젝트별 할 일을 불러오지 못했습니다. 다시 확인해 주세요.';const f=fixture(async()=>data);await f.run('ahLoad()');const html=f.run('automationHealthPanel()');assert.equal(f.run('automationHealthState.error'),'');assert.match(html,/할 일이 없는 상태와는 달라요/);assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.doesNotMatch(html,/고객 프로젝트 업무가 없어요/);
});

test('malformed project groups cannot produce empty or incomplete successful reports',async()=>{
  for(const mutate of [data=>data.projectGroups=null,data=>data.projectGroups[0].counts.total=1,data=>data.projectGroups[0].primary=null,data=>data.projectGroups[0].items.push(data.projectGroups[0].items[0]),data=>data.projectGroups.push(data.projectGroups[0]),data=>data.projectGroups[0].items[0].projectId='other',data=>data.projectGroups[0].urgency='done']){const data=report();data.projectGroups=[projectGroup()];mutate(data);const f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.data'),null);assert.match(f.run('automationHealthState.error'),/형식/);}
});

test('project expansions survive refresh and clear on identity changes without admitting arbitrary toggle keys',async()=>{
  const data=report();data.projectGroups=[projectGroup()];const f=fixture(async()=>data);f.set(data);await f.event('toggle',{target:{dataset:{ahGroup:'project:owned-project'},open:true}});await f.event('toggle',{target:{dataset:{ahGroup:'__proto__'},open:true}});await f.run('ahLoad()');assert.match(f.run('automationHealthPanel()'),/data-ah-group="project:owned-project" open/);assert.equal(f.run('Object.hasOwn(automationHealthState.expanded,"__proto__")'),false);f.run('state.user={id:"two",role:"member"};automationHealthPanel()');assert.equal(f.run('automationHealthState.expanded["project:owned-project"]'),undefined);
});

test('project source text is escaped and optional private text is not required by the client contract',async()=>{
  const data=report();data.projectGroups=[projectGroup()];const group=data.projectGroups[0];group.projectTitle='<script>private</script>';group.reason='<img src=x>';group.items[0].title='<svg onload=bad()>';group.items[0].href='javascript:bad()';const f=fixture(async()=>data);await f.run('ahLoad()');const html=f.run('automationHealthPanel()');assert.equal(f.run('automationHealthState.error'),'');assert.doesNotMatch(html,/<script>|<img|<svg|href="javascript/);assert.match(html,/&lt;script&gt;private/);assert.match(html,/&lt;img src=x/);
});
