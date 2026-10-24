import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createAutomationHealthService} from './automation-health.mjs';

const source=readFileSync(new URL('./public/automation-health.js',import.meta.url),'utf8');
const weeklySource=readFileSync(new URL('./public/weekly-summary.js',import.meta.url),'utf8');
// 제작 도구 공통 그리기 도우미(maker-tools.js 앞 절반)를 탭 파일보다 먼저 읽는다 — escape만 쓴다.
const kit=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8'),kitHelpers=kit.slice(0,kit.indexOf('\n// ── 상태와 화면 바꾸기'));
const numbers={package:1,performance:2,inbox:3,today:4,learning:5,review:6,client:7,links:8,weekly:9,delivery:11,closeout:12,kickoff:13,changes:14,requests:15,schedule:16,deliveryCheck:17,rights:34};
const ids=Object.keys(numbers);
const report=()=>({refreshedAt:'2026-10-12T01:00:00.000Z',cards:ids.map((id,index)=>({id,number:numbers[id],title:'자동화 '+numbers[id],mode:(numbers[id]>=11&&numbers[id]<=16)||id==='rights'?'on-demand':'scheduled',status:'idle',statusLabel:'할 일 없음',text:'현재 처리할 대상이 없습니다.',href:'/?tab=workroom&section=tools&tool=publication',checkedAt:'2026-10-12T01:00:00.000Z',lastAttemptAt:null,lastSuccessAt:null,lastSuccessLabel:'최근 성공',lastResultAt:null,nextRunAt:null,nextDueAt:null,counts:{targets:0,issues:0,manual:0,paused:0}})),issues:[],manual:[],counts:{issues:0,manual:0,running:0,paused:0,partial:0},note:'현재 열람할 수 있는 작업만 확인합니다.'});
const item=(id='issue',automationId='links')=>({id,automationId,kind:'publication_link',status:'failed',statusLabel:'접속 오류',title:'자료 링크',text:'오류 응답을 확인했습니다.',href:'/?tab=workroom&section=tools&tool=publication&publicationAction=link&packageId=owned-package',occurredAt:'2026-10-12T00:00:00Z',dueAt:null});
// The issue automation-health.mjs adds when the post-performance collector has not finished after a due observation.
const stale=(extra={})=>({id:'performance:collector-stale:current',automationId:'performance',kind:'collector-stale',status:'delayed',statusLabel:'늦음',title:'게시 숫자 자동 수집 멈춤',text:'게시물 2편이 읽을 시각을 지났는데 자동 수집이 끝나지 않았어요. 서버의 자동 수집을 살펴보고, 급한 숫자는 게시 준비·성과에서 직접 넣어 주세요.',href:'/?tab=workroom&section=tools&tool=publication',occurredAt:'2026-10-12T00:30:00.000Z',dueAt:'2026-10-12T00:30:00.000Z',code:'post-performance-collector-stale',since:'2026-10-12T00:30:00.000Z',affectedEntries:['post-1','post-2'],...extra});
const staleRow=html=>html.match(/<article class="mt-job is-alert ah-stale"[\s\S]*?<\/article>/)?.[0]||'';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function projectGroup({waitingOnly=false}={}){
  const projectId='owned-project',items=[{id:'project-request',projectId,group:waitingOnly?'waiting':'reply',title:'장면별 수정 확인',statusLabel:'수정 의견 확인',href:'/?tab=workroom&section=clients&project=owned-project&version=owned-version&message=owned-message&seconds=62.5'},{id:'project-waiting',projectId,group:'waiting',title:'고객 답변 대기',statusLabel:'고객 확인 대기',href:'/?tab=workroom&section=clients&project=owned-project&schedule=1'}];
  return {projectId,projectTitle:'봄 캠페인',primary:waitingOnly?null:items[0],reason:waitingOnly?'고객 또는 내부 담당자의 확인을 기다려요. 지금 처리할 일은 없어요.':'수정 확인 기한이 지나 먼저 확인하세요.',urgency:waitingOnly?'waiting':'overdue',dueDate:'2026-10-11',counts:{total:2,actionable:waitingOnly?0:1,waiting:waitingOnly?2:1,customerWaiting:1,staffWaiting:waitingOnly?1:0},items};
}
function fixture(api=async()=>report()){
  const listeners={},links=[],timers=new Map();let now=Date.parse('2026-10-12T01:00:00Z'),timerId=0,main={scrollTop:0,scrollLeft:0},renders=0;
  const context=vm.createContext({state:{user:{id:'one',role:'member',teamId:'team'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'automation'},document:{hidden:false,activeElement:null,addEventListener(type,fn){(listeners[type]||=[]).push(fn);},getElementById(id){return id==='main'?main:null;},querySelectorAll(){return [];}},window:{scrollX:0,scrollY:0,scrollTo(){}},location:{origin:'https://workspace.test'},URL,URLSearchParams,queueMicrotask,setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},api,render(){renders++;},notify(){},escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),Date:class extends Date{static now(){return now;}},cdReadTarget:value=>new URL(value).searchParams.get('project')==='owned-project',pfReadTarget:value=>new URL(value).searchParams.get('packageId')==='owned-package',workspaceLinkDestination:value=>new URL(value,'https://workspace.test').hash==='#view=content&section=plan&draftId=owned-plan',openClientWorkflowLink:value=>{links.push(['client',value]);return true;},openPublicationWorkflowLink:value=>{links.push(['publication',value]);return true;},navigateWorkspaceLink:value=>{links.push(['content',value]);return true;},openWorkspaceDestination:value=>{links.push(['messenger',value]);return true;},selectWorkspaceView(...args){links.push(['workspace',...args]);context.state.tab=args[0];if(args[1])context.wr.view=args[1];},makerToolsEnsure(){}});
  vm.runInContext(kitHelpers,context);vm.runInContext(weeklySource,context);vm.runInContext(source,context);
  return {context,links,timers,get renders(){return renders;},get main(){return main;},set main(value){main=value;},advance(ms){now+=ms;},run:code=>vm.runInContext(code,context),set(data){context.report=data;vm.runInContext('ahIdentity();automationHealthState.data=report',context);},async event(type,event={}){for(const listener of listeners[type]||[])await listener(event);},async timer(){const [id,value]=[...timers][0];timers.delete(id);value.fn();await tick();}};
}
const meterCell=(label,value)=>new RegExp(`<span>${label}</span><strong>${value}<small>개</small></strong>`);
const whenCell=(html,id)=>html.match(new RegExp(`<tr class="ah-row[^"]*" data-ah-card="${id}">[\\s\\S]*?<td class="ah-c-when ah-x-sm">([^<]*)</td>`))?.[1];

test('the status tool only reads one API and repeated renders or refresh clicks do not duplicate an in-flight request',async()=>{
  const calls=[];let resolve;const f=fixture((...args)=>{calls.push(args);return new Promise(done=>resolve=done);});f.run('automationHealthEnsure()');f.run('automationHealthEnsure();ahLoad()');assert.deepEqual(calls,[['/api/automation-health']]);resolve(report());await tick();assert.equal(f.run('automationHealthState.loading'),false);f.run('automationHealthEnsure()');assert.equal(calls.length,1);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,60000);
});

test('missing sections, duplicate cards, unsupported states or absent counts are errors instead of an all-clear',async()=>{
  for(const change of [data=>data.cards.pop(),data=>data.cards[9].number=10,data=>data.cards[1]=data.cards[0],data=>data.cards[0].status='success',data=>delete data.counts.partial,data=>data.cards[0].counts.customerWaiting=-1,data=>data.cards[0].counts.targets=null,data=>data.refreshedAt='invalid',data=>data.issues.push({...item(),automationId:'unknown'})]){const data=report();change(data);const f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.data'),null);assert.match(f.run('automationHealthState.error'),/형식/);const html=f.run('automationHealthPanel()');assert.doesNotMatch(html,/조치할 문제가 없어요|사람이 할 일이 없어요|<span>이상 없음<\/span><strong>\d/);assert.equal((html.match(/<strong class="is-none">—<\/strong>/g)||[]).length,4);assert.match(html,/문제가 없다는 뜻은 아니에요/);}
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
  const f=fixture(),data=report();data.issues=[item(),item(),item('second')];data.manual=[item(),{...item('manual'),status:'manual'}];f.set(data);let html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-item="links:issue"/g)||[]).length,1);assert.match(html,/data-ah-item="links:manual"/);await f.run('ahLoad()');html=f.run('automationHealthPanel()');assert.doesNotMatch(html,/data-ah-item=/);assert.match(html,/조치할 문제가 없어요 · 10:00 확인/);
});

test('manual work, idle work, disabled schedules and partial data do not imply successful automation',()=>{
  const f=fixture(),data=report();data.cards[0].mode='on-demand';data.cards[0].status='ready';data.cards[1].status='paused';data.cards[1].nextRunAt='2026-10-12T02:00:00Z';data.cards[2].mode='manual';data.cards[2].status='manual';data.cards[3].status='partial';data.counts.partial=1;f.set(data);const html=f.run('automationHealthPanel()');
  assert.equal(whenCell(html,'package'),'열 때');assert.equal(whenCell(html,'performance'),'꺼짐');assert.equal(whenCell(html,'inbox'),'직접 확인');assert.equal(whenCell(html,'weekly'),'매주 월요일');
  assert.match(html,meterCell('이상 없음',14));assert.match(html,meterCell('직접 확인',1));assert.match(html,meterCell('일부만 확인',1));assert.match(html,meterCell('꺼짐',1));assert.match(html,meterCell('멈춤',0));
  assert.match(html,/정한 기한 없음/);assert.match(html,/기록 없음/);assert.match(html,/표시된 문제가 전부가 아닐 수 있어요/);assert.doesNotMatch(html,/모두 정상|전체 성공/);
  const paused=f.run('ahCard(automationHealthState.data.cards[1])');assert.doesNotMatch(paused,/11:00|2026\. 10\. 12\. 오전 11:00/);
});

test('scan success, result time, poll schedule and target due date remain separate evidence',()=>{
  const f=fixture(),data=report(),card=data.cards[1];Object.assign(card,{lastAttemptAt:'2026-10-12T01:00:00Z',lastSuccessAt:'2026-10-12T01:01:00Z',lastResultAt:'2026-10-11T22:00:00Z',nextRunAt:'2026-10-12T01:02:00Z',nextDueAt:'2026-10-13T01:00:00Z'});data.note='「최근 성공」은 자동 실행이 끝났다는 뜻이지, 항목이 다 처리됐다는 뜻은 아니에요.';f.set(data);const html=f.run('ahCard(automationHealthState.data.cards[1])');
  for(const label of ['최근 시도','최근 성공','최근 결과','다음 기한'])assert.match(html,new RegExp('<dt>'+label+'</dt>'));assert.equal((html.match(/<dt>/g)||[]).length,4);
  for(const value of ['<dd title="[^"]+">10:00</dd>','<dd title="[^"]+">10:01</dd>','<dd title="[^"]+">07:00</dd>','<dd title="[^"]+">10월 13일 10:00</dd>'])assert.match(html,new RegExp(value));
  assert.doesNotMatch(html,/10:02/);assert.match(f.run('automationHealthPanel()'),/항목이 다 처리됐다는 뜻은 아니에요/);
});

test('untrusted text is escaped in issue details, cards, labels and notes',()=>{
  const f=fixture(),data=report();data.issues=[{...item(),title:'<img src=x onerror=bad()>',text:'<script>secret</script>',statusLabel:'<svg onload=bad()>',href:'javascript:bad()'}];data.cards[0].title='<img src=x>';data.cards[0].lastSuccessLabel='<script>label</script>';data.note='<svg onload=bad()>';f.set(data);const html=f.run('automationHealthPanel()');assert.doesNotMatch(html,/<script>|<img src=x|<svg onload|href="javascript:/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;label/);
});

test('source link validation permits exact existing views and rejects arbitrary URLs, APIs and mixed parameters',()=>{
  const f=fixture();for(const href of ['https://workspace.test/?tab=home','//evil.test/','/\\evil.test/','/api/logout','javascript:bad()','/?tab=home&token=secret','/?tab=workroom&section=tools&tool=weekly&run=1','/?tab=workroom&section=tools&tool=quality','/?tab=home&tab=messenger','/?tab=messenger&panel=admin','/?tab=messenger&messageId=1','/?tab=workroom&section=clients&project=other','/?tab=home#view=messenger']){f.context.href=href;assert.equal(f.run('ahHref(href)'),'',href);}
  for(const href of ['/?tab=home','/?tab=workroom&section=clients','/?tab=workroom&section=tools&tool=weekly','/?tab=workroom&section=tools&tool=publication','/?tab=messenger&panel=tasks','/#view=content&section=plan&draftId=owned-plan']){f.context.href=href;assert.equal(f.run('ahHref(href)'),href);}
});

test('source navigation preserves package, client and message identifiers and never reruns a job',async()=>{
  const calls=[],f=fixture(async(...args)=>{calls.push(args);return report();});for(const href of ['/?tab=workroom&section=clients&project=owned-project&followUp=1','/?tab=workroom&section=tools&tool=publication&publicationAction=link&packageId=owned-package','/?tab=messenger&panel=tasks&channelId=channel-1&messageId=123','/#view=content&section=plan&draftId=owned-plan','/?tab=workroom&section=tools&tool=weekly','/?tab=workroom&section=clients','/?tab=home']){f.context.href=href;await f.run('ahOpenSource(href)');}assert.deepEqual(f.links.map(link=>link[0]),['client','workspace','messenger','content','workspace','workspace','workspace']);assert.deepEqual(f.links[1].slice(1),['social','results'],'게시 준비·성과는 SNS 성과로(10-24)');assert.deepEqual(f.links[4].slice(1),['social','results'],'주간 정리도 SNS 성과로');assert.equal(f.links[2][1].messageId,'123');assert.equal(f.links[5][2],'clients');assert.equal(f.links[6][1],'home');assert.deepEqual(calls,[]);
});

test('manual refresh preserves the main scroll and focused source across both loading and completion renders',async()=>{
  let resolve,focused=0;const f=fixture(()=>new Promise(done=>resolve=done));f.set(report());f.main={scrollTop:1680.5,scrollLeft:3.5};f.context.window.scrollX=2;f.context.window.scrollY=600;const scroll=[];f.context.window.scrollTo=(...args)=>scroll.push(args);f.context.document.activeElement={dataset:{ahFocus:'card:links'}};f.context.document.querySelectorAll=()=>[{dataset:{ahFocus:'card:links'},focus(options){assert.equal(options.preventScroll,true);focused++;}}];f.context.render=()=>{f.main={scrollTop:0,scrollLeft:0};};const pending=f.run('ahLoad()');assert.deepEqual(f.main,{scrollTop:1680.5,scrollLeft:3.5});resolve(report());await pending;assert.deepEqual(f.main,{scrollTop:1680.5,scrollLeft:3.5});assert.equal(focused,2);assert.deepEqual(scroll,[[2,600],[2,600]]);
});

test('mounted refresh keeps existing cards during loading and replaces only the automation panel with focus, details and scroll intact',async()=>{
  let resolve,focused=0,replacements=0,html='',removedErrors=0;const f=fixture(()=>new Promise(done=>resolve=done)),data=report();data.manual=Array.from({length:5},(_,i)=>({...item('manual-'+i),status:'manual'}));f.set(data);f.run('automationHealthState.expanded.manual=true');
  f.main={scrollTop:1680.5,scrollLeft:3.5};const sidebar={identity:'unchanged sidebar'},main=f.main,button={disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;}},stamp={textContent:'10:00에 확인'},attributes={},panel={setAttribute(name,value){attributes[name]=value;},querySelector(selector){return selector==='[data-ah-action="refresh"]'?button:selector==='[data-ah-checked]'?stamp:selector==='.mt-error'?{remove(){removedErrors++;}}:null;},set outerHTML(value){html=value;replacements++;f.main.scrollTop=0;f.main.scrollLeft=0;}};
  const target={dataset:{ahFocus:'card:links'},focus(options){assert.equal(options.preventScroll,true);focused++;}};f.context.document.activeElement=target;f.context.document.querySelector=selector=>selector==='.ah-panel'?panel:sidebar;f.context.document.querySelectorAll=()=>[target];f.context.render=()=>assert.fail('must not replace the workspace');
  const pending=f.run('ahLoad()');assert.equal(replacements,0);assert.equal(button.disabled,true);assert.equal(button.attributes['aria-label'],'불러오는 중');assert.equal(stamp.textContent,'불러오는 중…');assert.equal(attributes['aria-busy'],'true');assert.equal(removedErrors,1);assert.equal(f.context.document.activeElement,target);assert.equal(f.main,main);assert.equal(focused,0);
  resolve(data);await pending;assert.equal(replacements,1);assert.equal(focused,1);assert.equal(f.main,main);assert.deepEqual(f.main,{scrollTop:1680.5,scrollLeft:3.5});assert.match(html,/aria-busy="false"/);assert.match(html,/data-ah-group="manual" open/);assert.match(html,/data-ah-action="refresh" data-ah-focus="refresh" aria-label="새로고침" title="새로고침">/);assert.match(html,/data-ah-checked>10:00에 확인</);assert.equal(f.context.document.querySelector('#sidebar'),sidebar);
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

test('short times read the Korean day, show only the clock on the snapshot day and drop midnight for date-only values',()=>{
  const f=fixture();f.set(report());for(const [value,text] of [['2026-10-12T05:07:00Z','14:07'],['2026-10-12T15:30:00Z','10월 13일 00:30'],['2026-10-11T23:00:00Z','08:00'],['2026-10-20T00:00:00+09:00','10월 20일'],['2025-12-31T03:00:00Z','2025년 12월 31일 12:00'],['bad','']]){f.context.value=value;assert.equal(f.run('ahWhen(value)'),text,value);}
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

test('a short people list stays whole and customer waiting rows follow the rows that are mine',()=>{
  const f=fixture(),data=report();data.manual=[{...item('customer','delivery'),status:'manual',waitingFor:'customer',title:'봄 캠페인',statusLabel:'고객 승인 전'},{...item('mine','review'),status:'manual',title:'첫날 편',statusLabel:'점검 남음'}];f.set(data);const html=f.run('automationHealthPanel()');
  assert.doesNotMatch(html,/나머지 \d+건 보기/);assert.ok(html.indexOf('data-ah-item="review:mine"')<html.indexOf('data-ah-item="delivery:customer"'));assert.match(html,/「첫날 편」 점검 남음/);assert.match(html,/aria-label="고객 차례"/);
});

test('disabled, failed and absent alert monitoring are not shown as enabled',()=>{
  const f=fixture();for(const monitor of [undefined,{enabled:false,status:'disabled'},{enabled:true,status:'error'}]){const data=report();data.monitor=monitor;f.set(data);assert.doesNotMatch(f.run('automationHealthPanel()'),/알림 켜짐/);}
  const data=report();data.monitor={enabled:true,status:'enabled',lastScanAt:'2026-10-12T01:00:00Z',intervalMs:60000,inAppOnly:true};f.set(data);const html=f.run('automationHealthPanel()');assert.match(html,/알림 켜짐 · 1분마다 확인/);assert.match(html,/같은 문제는 메신저에 한 번만 알려요/);
  data.monitor={enabled:true,status:'pending',intervalMs:60000};f.set(data);assert.match(f.run('automationHealthPanel()'),/첫 확인을 기다리는 중이에요/);
});

test('menu, direct URL, desk shortcut and assets all connect to the same status tool',()=>{
  const maker=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8'),workroom=readFileSync(new URL('./public/workroom.js',import.meta.url),'utf8'),index=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');assert.match(maker,/\['automation','자동화 상태'/);assert.match(maker,/automationHealthEnsure\(\)/);assert.match(maker,/automationHealthReset\(\)/);assert.match(maker,/automationHealthSync\(\)/);assert.match(workroom,/'automation'\]\.includes\(params.get\('tool'\)\)/);assert.match(workroom,/wrButton\('자동화 상태 보기','automation'/);assert.match(index,/src="\/automation-health.js"/);assert.match(index,/href="\/automation-health.css"/);
});

test('the real service response including no-target and paused cards matches the client contract',async()=>{
  const user={id:'one',role:'member',active:true},store={get:(kind,id)=>kind==='users'&&id===user.id?user:null,all:()=>[],put:()=>assert.fail('status reads must not write')};
  const service=createAutomationHealthService({store,clock:()=> '2026-10-12T01:00:00.000Z',runtime:()=>({performance:{enabled:false},inbox:{enabled:false},links:{enabled:false},weekly:{enabled:false},deliveryCheck:{enabled:false}}),studio:{production:()=>assert.fail()},publicationPackages:{get:()=>assert.fail()},postPerformance:{list:()=>({entries:[],channels:[]})},publicationInbox:{state:()=>({available:false,active:false,entries:[]})},publicationWorkflow:{workspace:()=>({items:[]})},publicationLearning:{workspace:()=>({cards:[]})},clientProjects:{workspace:()=>({projects:[]})},clientWorkflow:{workspace:()=>({items:[]})},publicationLinks:{get:()=>assert.fail()},weeklySummary:{get:()=>({sections:[]})}});
  const data=service.get(user),f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.error'),'');assert.equal(f.run('automationHealthState.data.cards.length'),17);for(const card of data.cards){f.context.href=card.href;assert.equal(f.run('ahHref(href)'),card.href);}const html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.equal(whenCell(html,'performance'),'꺼짐');assert.equal(whenCell(html,'package'),'열 때');assert.equal(whenCell(html,'review'),'직접 확인');assert.equal(data.cards.find(card=>card.id==='deliveryCheck').status,'paused');assert.equal(whenCell(html,'deliveryCheck'),'꺼짐');
});


test('all seventeen linked automations are listed without internal numbers while on-demand source checks are distinct from stored results',()=>{
  const f=fixture(),data=report();for(const id of ['delivery','closeout','kickoff','changes','requests','schedule']){const card=data.cards.find(row=>row.id===id);Object.assign(card,{checkedAt:'2026-10-12T01:00:00Z',lastSuccessAt:'2026-10-12T01:00:00Z',lastResultAt:null,lastResultLabel:'최근 원문 기록',status:'manual',statusLabel:'고객 확인 대기'});}f.set(data);
  const html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.match(html,/자동화 17개/);assert.doesNotMatch(html,/\d+번 ·|10번|34번|조회·요청 시|예약 점검/);
  const card=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="schedule"))');for(const text of ['<dt>도는 때</dt><dd>열 때</dd>','<dt>최근 원문 기록</dt><dd>기록 없음</dd>','고객 확인 대기','<dt>다음 기한</dt>'])assert.ok(card.includes(text),text);assert.doesNotMatch(card,/최근 성공|최근 시도|실패/);assert.doesNotMatch(card,/10월 10일|2026\. 10\. 10\./);
  f.run('automationHealthState.data.cards.find(row=>row.id==="schedule").lastResultAt="2026-10-10T03:00:00Z"');const updated=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="schedule"))');assert.match(updated,/<dt>최근 원문 기록<\/dt><dd title="2026\. 10\. 10\.[^"]*">10월 10일 12:00<\/dd>/);
});

test('delivery inspection keeps scheduled runtime evidence separate from technical or human findings',()=>{
  const f=fixture(),data=report(),card=data.cards.find(row=>row.id==='deliveryCheck');Object.assign(card,{status:'manual',statusLabel:'담당자 확인 필요',lastAttemptAt:'2026-10-12T01:00:00Z',lastSuccessAt:'2026-10-12T01:01:00Z',lastResultAt:'2026-10-11T23:00:00Z',lastResultLabel:'최근 파일 검사 결과',nextRunAt:'2026-10-12T01:02:00Z',counts:{targets:2,issues:0,manual:2,paused:0}});data.manual=[{...item('files','deliveryCheck'),status:'manual',statusLabel:'파일 규격 확인',text:'길이 불일치가 있어 담당자가 파일을 확인합니다.'}];f.set(data);const html=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="deliveryCheck"))');for(const label of ['최근 시도','최근 성공','최근 파일 검사 결과','다음 기한','문제 0','사람 차례 2'])assert.ok(html.includes(label),label);
  assert.equal(whenCell(html,'deliveryCheck'),'1분마다 확인');const panel=f.run('automationHealthPanel()');assert.ok(panel.indexOf('data-ah-block="manual"')<panel.indexOf('data-ah-item="deliveryCheck:files"'));assert.match(panel,/조치할 문제가 없어요/);assert.match(panel,meterCell('직접 확인',1));
});

test('new client findings use the real exact project-card parser and never turn source navigation into a mutation',async()=>{
  const f=fixture(()=>assert.fail('source links must not submit automation actions')),clientSource=readFileSync(new URL('./public/client-projects.js',import.meta.url),'utf8');vm.runInContext(clientSource.slice(clientSource.indexOf('function cdReadTarget('),clientSource.indexOf('function cdDraftKey(')),f.context);const projectId='11111111-1111-4111-8111-111111111111';
  for(const context of ['delivery','closeout','kickoff','changes','requests','schedule','rights']){const href='/?tab=workroom&section=clients&project='+projectId+'&'+context+'=1'+(context==='rights'?'&rightsTarget=portfolio':'');f.context.href=href;assert.equal(f.run('ahHref(href)'),href);assert.equal(await f.run('ahOpenSource(href)'),true);assert.equal(f.links.at(-1)[0],'client');assert.equal(f.links.at(-1)[1],href);for(const suffix of ['&'+context+'=1','&version='+projectId,'&run=1','#bad']){f.context.bad=href+suffix;assert.equal(f.run('ahHref(bad)'),'');}}
  assert.equal(f.links.length,7);
});


test('customer and staff waiting counts are visible without being added to system failures',()=>{
  const f=fixture(),data=report(),card=data.cards.find(row=>row.id==='delivery');Object.assign(card,{status:'manual',statusLabel:'고객·담당자 확인 필요',counts:{targets:2,issues:0,manual:2,paused:0,customerWaiting:1,staffWaiting:2}});f.set(data);const html=f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="delivery"))');assert.match(html,/문제 0/);assert.match(html,/사람 차례 2/);assert.match(html,/고객 차례 1/);assert.match(html,/담당자 차례 2/);assert.match(html,/같은 프로젝트가 고객과 담당자를 함께 기다릴 수 있어요/);assert.doesNotMatch(html,/실패/);assert.match(f.run('automationHealthPanel()'),meterCell('멈춤',0));
});


test('project groups keep all original automation cards, independent totals and every source item',()=>{
  const f=fixture(),data=report();data.projectGroups=[projectGroup()];f.set(data);const html=f.run('automationHealthPanel()');assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.equal((html.match(/data-ah-project=/g)||[]).length,1);assert.equal((html.match(/data-ah-project-item=/g)||[]).length,2);assert.match(html,/프로젝트 1개 · 할 일 2개/);assert.match(html,/자동화 목록과 세는 기준이 달라요/);assert.match(html,/수정 확인 기한이 지나/);assert.match(html,/같은 프로젝트의 나머지 1개/);assert.match(html,/답을 기다리는 일 1개/);assert.match(html,/기한 지남/);assert.match(html,/message=owned-message&amp;seconds=62.5/);
  const at=marker=>html.indexOf(marker);assert.ok(at('class="mt-meter"')<at('data-ah-block="projects"'));assert.ok(at('data-ah-block="issues"')<at('data-ah-block="projects"'));assert.ok(at('data-ah-block="manual"')<at('data-ah-block="projects"'));assert.ok(at('data-ah-block="projects"')<at('data-ah-block="all"'));assert.match(html,/<span class="mt-num">03<\/span><h2>프로젝트별 먼저 할 일<\/h2>/);assert.match(html,/<span class="mt-num">04<\/span><h2>자동화 17개<\/h2>/);
});

test('waiting-only project groups do not fabricate a primary task and absent groups preserve the board',()=>{
  const f=fixture(),data=report();f.set(data);let html=f.run('automationHealthPanel()');assert.doesNotMatch(html,/data-ah-project=|data-ah-block="projects"/);assert.match(html,/<span class="mt-num">03<\/span><h2>자동화 17개<\/h2>/);data.projectGroups=[projectGroup({waitingOnly:true})];f.set(data);html=f.run('automationHealthPanel()');assert.match(html,/지금 처리할 일은 없어요/);assert.match(html,/기다리는 일 2개/);assert.doesNotMatch(html,/is-primary/);assert.equal((html.match(/data-ah-project-item=/g)||[]).length,2);
});

test('project source failure stays explicitly unknown while other automation evidence remains available',async()=>{
  const data=report();data.projectGroups=null;data.projectGroupsError='프로젝트별 할 일을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.';const f=fixture(async()=>data);await f.run('ahLoad()');const html=f.run('automationHealthPanel()');assert.equal(f.run('automationHealthState.error'),'');assert.match(html,/data-ah-block="projects"[\s\S]*role="alert"[^>]*>프로젝트별 할 일을 불러오지 못했어요\. 잠시 뒤 새로고침해 주세요\. 할 일이 없다는 뜻은 아니에요\./);assert.equal((html.match(/data-ah-card=/g)||[]).length,17);assert.doesNotMatch(html,/data-ah-project=/);
});

test('malformed project groups cannot produce empty or incomplete successful reports',async()=>{
  for(const mutate of [data=>data.projectGroups=null,data=>data.projectGroups[0].counts.total=1,data=>data.projectGroups[0].primary=null,data=>data.projectGroups[0].items.push(data.projectGroups[0].items[0]),data=>data.projectGroups.push(data.projectGroups[0]),data=>data.projectGroups[0].items[0].projectId='other',data=>data.projectGroups[0].urgency='done']){const data=report();data.projectGroups=[projectGroup()];mutate(data);const f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.data'),null);assert.match(f.run('automationHealthState.error'),/형식/);}
});

test('project expansions survive refresh and clear on identity changes without admitting arbitrary toggle keys',async()=>{
  const data=report();data.projectGroups=[projectGroup()];const f=fixture(async()=>data);f.set(data);await f.event('toggle',{target:{dataset:{ahGroup:'project:owned-project'},open:true}});await f.event('toggle',{target:{dataset:{ahGroup:'__proto__'},open:true}});await f.run('ahLoad()');assert.match(f.run('automationHealthPanel()'),/data-ah-group="project:owned-project" open/);assert.equal(f.run('Object.hasOwn(automationHealthState.expanded,"__proto__")'),false);f.run('state.user={id:"two",role:"member"};automationHealthPanel()');assert.equal(f.run('automationHealthState.expanded["project:owned-project"]'),undefined);
});

test('project source text is escaped and optional private text is not required by the client contract',async()=>{
  const data=report();data.projectGroups=[projectGroup()];const group=data.projectGroups[0];group.projectTitle='<script>private</script>';group.reason='<img src=x>';group.items[0].title='<svg onload=bad()>';group.items[0].href='javascript:bad()';const f=fixture(async()=>data);await f.run('ahLoad()');const html=f.run('automationHealthPanel()');assert.equal(f.run('automationHealthState.error'),'');assert.doesNotMatch(html,/<script>|<img src=x|<svg onload|href="javascript/);assert.match(html,/&lt;script&gt;private/);assert.match(html,/&lt;img src=x/);assert.match(html,/&lt;svg onload=bad\(\)&gt;/);
});

test('a stopped post-performance collector is listed first in Korean with its start time, affected posts and the performance link',async()=>{
  const data=report();data.issues=[item('first'),item('second'),{...item('late','performance'),status:'delayed',statusLabel:'늦음',dueAt:'2026-10-12T00:30:00Z'},stale({affectedEntries:['post-1','post-2','post-1',' ']})];data.counts.issues=4;
  const f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.error'),'');
  const html=f.run('automationHealthPanel()'),row=staleRow(html),order=[...html.matchAll(/data-ah-item="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(order,['performance:performance:collector-stale:current','links:first','links:second','performance:late']);assert.ok(html.indexOf('collector-stale')<html.indexOf('나머지 1건 보기'));assert.match(html,/<dt>조치할 문제<\/dt><dd>4<\/dd>/);
  assert.match(row,/<span class="mt-badge" data-tone="alert">멈춤<\/span>/);assert.ok(row.includes('게시 성과 자동 수집이 09:30부터 멈춰 있어요'));assert.ok(row.includes('영향 받은 편 2'));assert.ok(row.includes('09:30 뒤로 자동 수집이 끝난 기록이 없어요.'));assert.match(row,/class="btn small primary" href="\/\?tab=workroom&amp;section=tools&amp;tool=publication" data-ah-source="\/\?tab=workroom&amp;section=tools&amp;tool=publication" data-ah-view="performance"/);assert.match(row,/게시 준비·성과 열기/);
  assert.doesNotMatch(row,/예정|원문|확인 지연|늦음|post-1/);assert.equal((html.match(/btn small primary/g)||[]).length,1);
});

test('missing, invalid or empty stopped-collector fields keep the warning without inventing a time or count',async()=>{
  const cases=[[value=>{delete value.since;},'time'],[value=>{value.since=null;},'time'],[value=>{value.since='not-a-time';},'time'],[value=>{value.since='';},'time'],[value=>{delete value.affectedEntries;},'count'],[value=>{value.affectedEntries=[];},'count'],[value=>{value.affectedEntries='post-1';},'count'],[value=>{value.affectedEntries=[null,'',' ',5,{}];},'count'],[value=>{for(const key of ['since','affectedEntries','title','text','href','dueAt','occurredAt','statusLabel'])delete value[key];},'both']];
  for(const [change,missing] of cases){
    const value=stale();change(value);const data=report();data.issues=[value];const f=fixture(async()=>data);await f.run('ahLoad()');assert.equal(f.run('automationHealthState.error'),'',change.toString());
    const row=staleRow(f.run('automationHealthPanel()'));assert.match(row,/>멈춤<\/span>/,change.toString());assert.match(row,/data-ah-view="performance"/);assert.doesNotMatch(row,/undefined|null|NaN|시각 미확인|편 0/,change.toString());
    if(missing==='count')assert.ok(row.includes('09:30부터 멈춰 있어요'),change.toString());else{assert.match(row,/게시 성과 자동 수집이 멈춰 있어요/,change.toString());assert.match(row,/>자동 수집이 끝난 기록이 없어요\./,change.toString());}
    if(missing==='time')assert.match(row,/영향 받은 편 2/,change.toString());else assert.doesNotMatch(row,/영향 받은 편/,change.toString());
  }
});

test('publication and weekly source links open SNS results without touching the removed publication view',async()=>{
  const f=fixture(),calls=[];f.context.pf={view:'prepare'};f.context.pfIdentity=()=>{calls.push('identity');f.context.pf.view='prepare';};
  const click=dataset=>f.event('click',{target:{closest:selector=>selector==='[data-ah-source]'?{dataset}:null},preventDefault(){},button:0});
  await click({ahSource:'/?tab=workroom&section=tools&tool=publication',ahView:'performance'});assert.equal(f.run('makerTools.view'),'automation');assert.equal(f.context.pf.view,'prepare');assert.deepEqual(calls,[]);assert.deepEqual(f.links.at(-1),['workspace','social','results']);
  await click({ahSource:'/?tab=workroom&section=tools&tool=weekly',ahView:'performance'});assert.equal(f.run('makerTools.view'),'automation');assert.deepEqual(f.links.at(-1),['workspace','social','results']);
  delete f.context.pf;assert.equal(await f.run('ahOpenSource("/?tab=workroom&section=tools&tool=publication","performance")'),true);assert.deepEqual(f.links.at(-1),['workspace','social','results']);
  assert.equal(f.run('ahDest("/?tab=workroom&section=tools&tool=weekly")'),'SNS 성과');
});

test('a row click opens its facts below, keeps them open across refreshes and ignores unknown rows',async()=>{
  const f=fixture(),detail={hidden:true},classes=new Set(),button={attributes:{},setAttribute(name,value){this.attributes[name]=value;},closest:()=>({classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}})};f.set(report());
  f.context.document.getElementById=id=>id==='ah-detail-links'?detail:null;f.context.document.querySelector=selector=>selector==='[data-ah-toggle="links"]'?button:null;
  const click=(target)=>f.event('click',{target:{closest:selector=>selector==='[data-ah-toggle],tr[data-ah-card]'?target:null},preventDefault(){},button:0});
  assert.match(f.run('ahCard(automationHealthState.data.cards.find(row=>row.id==="links"))'),/<tr class="ah-detail" id="ah-detail-links" data-ah-detail="links" hidden>/);
  await click({dataset:{ahCard:'links'}});assert.equal(detail.hidden,false);assert.equal(button.attributes['aria-expanded'],'true');assert.ok(classes.has('is-open'));assert.equal(f.run('automationHealthState.expanded["row:links"]'),true);
  const html=f.run('automationHealthPanel()');assert.match(html,/<tr class="ah-row is-open" data-ah-card="links">/);assert.match(html,/data-ah-toggle="links" aria-expanded="true"/);assert.match(html,/<tr class="ah-detail" id="ah-detail-links" data-ah-detail="links">/);
  await click({dataset:{ahToggle:'links'}});assert.equal(detail.hidden,true);assert.equal(f.run('automationHealthState.expanded["row:links"]'),false);
  await click({dataset:{ahCard:'__proto__'}});assert.equal(f.run('Object.hasOwn(automationHealthState.expanded,"row:__proto__")'),false);
});

test('healthy automations fold below the table and the fold stays open across refreshes',async()=>{
  const f=fixture(),data=report();data.cards.find(row=>row.id==='inbox').status='scheduled';f.set(data);let html=f.run('automationHealthPanel()');
  assert.match(html,meterCell('이상 없음',17));assert.match(html,/<tbody data-ah-rows="ok">[\s\S]*data-ah-card="inbox"[\s\S]*?<\/tbody>/);assert.match(html,/<tbody class="ah-folded" id="ah-folded" data-ah-rows="ok-more" hidden>/);assert.equal((html.match(/<tbody class="ah-folded"[\s\S]*?<\/tbody>/)[0].match(/data-ah-card=/g)||[]).length,16);assert.match(html,/이상 없음 <b>16개 더<\/b>/);
  const rows={hidden:true};f.context.document.getElementById=id=>id==='ah-folded'?rows:null;await f.event('toggle',{target:{dataset:{ahGroup:'ok'},open:true}});assert.equal(rows.hidden,false);html=f.run('automationHealthPanel()');assert.match(html,/<tbody class="ah-folded" id="ah-folded" data-ah-rows="ok-more">/);assert.match(html,/data-ah-group="ok" open/);
});

test('the status board keeps one black button, no inline styles and the left-menu count rules',async()=>{
  const f=fixture(),data=report();assert.equal(f.run('automationHealthNavCount()'),null);f.set(data);assert.equal(f.run('automationHealthNavCount()'),null);
  data.manual=[{...item('manual'),status:'manual'}];f.set(data);assert.deepEqual(JSON.parse(f.run('JSON.stringify(automationHealthNavCount())')),{value:1,tone:'',label:'사람 차례'});
  data.issues=[item('one'),item('two')];f.set(data);assert.deepEqual(JSON.parse(f.run('JSON.stringify(automationHealthNavCount())')),{value:2,tone:'alert',label:'조치할 문제'});
  // 화면이 쓰는 글만 보도록 서버가 주는 글(카드 설명 · 문제 문장 · 바닥 안내)은 비운다.
  for(const card of data.cards)card.text='';data.note='';for(const row of [...data.issues,...data.manual])row.text='';f.set(data);
  const html=f.run('automationHealthPanel()');assert.equal((html.match(/btn small primary/g)||[]).length,1);assert.doesNotMatch(html,/\sstyle=/);assert.match(html,/이 화면은 상태만 보여 줘요\. 고치는 일은 그 도구 화면에서 해요\./);assert.doesNotMatch(html,/합니다|습니다|입니다|원문 바로가기|관측|수집기/);
  f.run('state.user={id:"one",role:"viewer",teamId:"team"}');assert.equal(f.run('automationHealthNavCount()'),null);
});

test('date-only values keep their day, server dates at Korean midnight show only the day and real runs near midnight keep their time',()=>{
  const f=fixture();f.set(report());for(const [value,text] of [['2026-10-20','10월 20일'],['2026-02-30',''],['2026-10-19T15:00:00.000Z','10월 20일'],['2026-10-19T15:00:41.120Z','10월 20일 00:00'],['2026-10-11T15:00:41.120Z','00:00']]){f.context.value=value;assert.equal(f.run('ahWhen(value)'),text,value);}
});
