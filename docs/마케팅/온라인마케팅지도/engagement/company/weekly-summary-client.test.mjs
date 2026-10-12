import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/weekly-summary.js',import.meta.url),'utf8');
const report=(week='2026-10-05')=>({period:{startDate:week,endDate:week==='2026-10-05'?'2026-10-11':'2026-10-04',label:'10월 5일~10월 11일'},generatedAt:'2026-10-12T00:00:00Z',refreshedAt:'2026-10-12T01:00:00Z',sections:['completed','performance','attention','upcoming'].map(id=>({id,title:id,items:[],total:0,status:'empty'})),schedule:{enabled:true,latestWeek:'2026-10-05',oldestWeek:'2025-10-13'}});
const marinSource=readFileSync(new URL('./public/marin-home.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(api=async()=>report()){
  const listeners={},links=[],timers=new Map();let now=Date.parse('2026-10-12T00:01:00Z'),timerId=0;
  const context=vm.createContext({state:{user:{id:'one',role:'member'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'weekly'},document:{hidden:false,addEventListener(type,fn){listeners[type]=fn;}},window:{scrollTo(){}},location:{origin:'https://workspace.test'},URL,URLSearchParams,queueMicrotask,setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},api,render(){},notify(){},escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),Date:class extends Date{static now(){return now;}},cdReadTarget:value=>new URL(value).searchParams.get('project')==='owned-project',pfReadTarget:value=>new URL(value).searchParams.get('packageId')==='owned-package',workspaceLinkDestination:value=>new URL(value,'https://workspace.test').hash==='#view=content&section=plan&draftId=owned-plan',openClientWorkflowLink:value=>links.push(['client',value]),openPublicationWorkflowLink:value=>links.push(['publication',value]),navigateWorkspaceLink:value=>links.push(['content',value]),openWorkspaceDestination:value=>{const action=vm.runInContext('safeMarinAction',context)(value);if(!action)return false;links.push(['messenger',action]);return true;},selectWorkspaceView(){},makerToolsEnsure(){}});
  vm.runInContext(marinSource.slice(marinSource.indexOf('function safeMarinAction('),marinSource.indexOf('function resetMarinHome(')),context);
  vm.runInContext(source,context);
  return {context,listeners,links,timers,advance(ms){now+=ms;},run:code=>vm.runInContext(code,context),set(data){context.report=data;vm.runInContext('wksIdentity();weeklySummaryState.data=report;weeklySummaryState.week=report.period.startDate',context);}};
}
test('default load requests last completed week and is not repeated on render',async()=>{
  const calls=[],f=fixture(async path=>{calls.push(path);return report();});f.run('weeklySummaryEnsure()');await tick();f.run('weeklySummaryEnsure()');assert.deepEqual(calls,['/api/weekly-summary']);assert.equal(f.run('weeklySummaryState.week'),'2026-10-05');assert.match(f.run('weeklySummaryPanel()'),/value="2026-10-05"/);
});
test('week picker uses KST completed week boundaries and normalizes weekdays',async()=>{
  const calls=[],f=fixture(async path=>{calls.push(path);return report();});assert.equal(f.run('wksBounds().latest'),'2026-10-05');assert.equal(f.run('wksMonday("2026-10-11")'),'2026-10-05');await f.run('wksLoad("2026-10-09")');assert.deepEqual(calls,['/api/weekly-summary?week=2026-10-05']);
  assert.equal(f.run('wksMonday("2026-02-30")'),'');assert.equal(f.run('wksShift("2026-01-05",-7)'),'2025-12-29');
});
test('future, unfinished, invalid and expired dates do not reach the API',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;return report();});for(const value of ['2026-10-12','2026-11-01','2026-02-30','2020-01-01','bad'])await f.run(`wksLoad(${JSON.stringify(value)})`);assert.equal(calls,0);assert.match(f.run('weeklySummaryState.error'),/52/);
});
test('late old-week response cannot replace a newer selection',async()=>{
  const pending=[];const f=fixture(()=>new Promise(resolve=>pending.push(resolve)));const first=f.run('wksLoad("2026-09-28")'),second=f.run('wksLoad("2026-10-05")');pending[1](report());await second;pending[0](report('2026-09-28'));await first;assert.equal(f.run('weeklySummaryState.week'),'2026-10-05');assert.equal(f.run('weeklySummaryState.data.period.startDate'),'2026-10-05');
});
test('logout prevents an inflight private report from returning',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>resolve=done));const pending=f.run('wksLoad()');f.run('state.user=null;weeklySummaryReset()');resolve(report());await pending;assert.equal(f.run('weeklySummaryState.data'),null);assert.equal(f.run('weeklySummaryState.userId'),null);
});
test('switching accounts clears records before rendering or a late request',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>resolve=done));f.set(report());const pending=f.run('wksLoad("2026-09-28")');f.run('state.user={id:"two"}');assert.doesNotMatch(f.run('weeklySummaryPanel()'),/집계/);resolve(report('2026-09-28'));await pending;assert.equal(f.run('weeklySummaryState.data'),null);assert.equal(f.run('weeklySummaryState.userId'),'two');
});
test('failed initial requests stay errors and do not retry forever',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;throw new Error('저장소 연결 실패');});f.run('weeklySummaryEnsure()');await tick();f.run('weeklySummaryEnsure()');assert.equal(calls,1);const html=f.run('weeklySummaryPanel()');assert.match(html,/저장소 연결 실패/);assert.match(html,/기록이 없는 상태와는 달라요/);assert.doesNotMatch(html,/현재 확인할 문제가 없어요/);
});
test('refresh failures label cached records and authorization failures clear them',async()=>{
  let status=500;const f=fixture(async()=>{throw Object.assign(new Error('읽기 실패'),{status});});f.set(report());await f.run('wksLoad("2026-10-05")');assert.match(f.run('weeklySummaryPanel()'),/마지막으로 불러온 기록/);status=403;await f.run('wksLoad("2026-10-05")');assert.equal(f.run('weeklySummaryState.data'),null);
});
test('mismatched week or missing section responses are not treated as empty records',async()=>{
  const f=fixture(async()=>({...report(),sections:[]}));await f.run('wksLoad()');assert.equal(f.run('weeklySummaryState.data'),null);assert.match(f.run('weeklySummaryState.error'),/형식/);
  const wrong=fixture(async()=>report('2026-09-28'));await wrong.run('wksLoad("2026-10-05")');assert.equal(wrong.run('weeklySummaryState.data'),null);
});
test('section scope and partial/error/empty counts remain distinct',()=>{
  const f=fixture(),data=report();data.sections[0].status='partial';data.sections[0].note='일부 원문을 불러오지 못했어요.';data.sections[2].status='unavailable';data.sections[2].note='문제 목록 조회 실패';f.set(data);const html=f.run('weeklySummaryPanel()');assert.match(html,/선택한 주의 기록/);assert.match(html,/지금 상태 기준/);assert.match(html,/건 · 일부 확인/);assert.match(html,/전체 여부를 확인할 수 없어요/);assert.match(html,/문제 목록 조회 실패/);assert.doesNotMatch(html,/현재 확인할 문제가 없어요/);
});
test('long sections show three records first and fold the remaining items without losing links',()=>{
  const f=fixture(),data=report();data.sections[0].items=Array.from({length:5},(_,index)=>({id:String(index),title:'record '+index,href:'/?tab=messenger&panel=tasks'}));data.sections[0].total=5;f.set(data);const html=f.run('wksSection(weeklySummaryState.data.sections[0])');assert.match(html,/나머지 2건 보기/);assert.equal((html.slice(0,html.indexOf('<details')).match(/<li>/g)||[]).length,3);assert.equal((html.match(/data-wks-source=/g)||[]).length,5);assert.doesNotMatch(html,/<details[^>]* open/);
});
test('completed records show completion time rather than their old due date',()=>{
  const f=fixture();f.context.item={title:'completed task',occurredAt:'2026-10-06T00:00:00Z',dueDate:'2026-10-07'};assert.doesNotMatch(f.run('wksItem(item,"completed")'),/예정 2026-10-07/);assert.match(f.run('wksItem(item,"completed")'),/10[. ]+6/);assert.match(f.run('wksItem(item,"upcoming")'),/예정 2026-10-07/);
});
test('saved titles, notes, dates and HTML payloads are escaped',()=>{
  const f=fixture(),data=report();data.period.label='<script>period</script>';data.sections[0].items=[{id:'one',title:'<img src=x onerror=alert(1)>',text:'<svg onload=alert(1)>',statusLabel:'<script>bad</script>',dueDate:'" onclick="bad',href:'javascript:alert(1)'}];data.sections[0].note='<script>note</script>';data.schedule.note='<img src=x>';f.set(data);const html=f.run('weeklySummaryPanel()');assert.doesNotMatch(html,/<script>|<img src=x|<svg onload|href="javascript:/);assert.match(html,/&lt;img/);
});
test('only supported local source links are accepted',()=>{
  const f=fixture();for(const href of ['javascript:alert(1)','//evil.test/','/\\evil.test/','https://workspace.test/?tab=messenger','/api/logout','/?tab=messenger&panel=admin','/?tab=messenger&messageId=one','/?tab=messenger&channelId=two&channelId=one','/?tab=workroom&section=tools&tool=brand','/?tab=content&draftId=unknown','/?tab=messenger&token=secret']){f.context.href=href;assert.equal(f.run('wksHref(href)'),'',href);}
  for(const href of ['/?tab=workroom&section=tools&tool=publication','/?tab=messenger&channelId=channel-1&messageId=123&panel=tasks','/#view=content&section=plan&draftId=owned-plan']){f.context.href=href;assert.equal(f.run('wksHref(href)'),href);}
});
test('source actions preserve the exact existing publication, client, plan and task destinations',async()=>{
  const f=fixture();await f.run('wksOpenSource("/?tab=workroom&section=clients&project=owned-project")');await f.run('wksOpenSource("/?tab=workroom&section=tools&tool=publication&publicationAction=link&packageId=owned-package")');await f.run('wksOpenSource("/#view=content&section=plan&draftId=owned-plan")');await f.run('wksOpenSource("/?tab=messenger&channelId=channel-1&messageId=123&panel=tasks")');assert.deepEqual(f.links.map(link=>link[0]),['client','publication','content','messenger']);assert.equal(f.links[3][1].channelId,'channel-1');assert.equal(f.links[3][1].messageId,'123');
});
test('schedule disabled and schedule error states never claim active scheduling',()=>{
  const f=fixture(),data=report();data.schedule.enabled=false;f.set(data);assert.match(f.run('weeklySummaryPanel()'),/예약 정리 꺼짐/);assert.doesNotMatch(f.run('weeklySummaryPanel()'),/매주 월요일 자동 정리/);data.schedule.enabled=true;data.schedule.status='error';f.set(data);assert.match(f.run('weeklySummaryPanel()'),/자동 정리 상태 확인 필요/);assert.match(f.run('weeklySummaryPanel()'),/예약 정리에 실패/);
});
test('visible summaries refresh once per minute and hide or navigation cancels polling',async()=>{
  const calls=[],f=fixture(async path=>{calls.push(path);return report();});f.run('weeklySummaryEnsure()');await tick();assert.equal(f.timers.size,1);
  f.advance(60000);const [id,callback]=[...f.timers][0];f.timers.delete(id);callback();await tick();assert.equal(calls.length,2);assert.equal(f.timers.size,1);
  f.context.document.hidden=true;f.listeners.visibilitychange();assert.equal(f.timers.size,0);f.advance(60000);f.run('weeklySummaryEnsure()');await tick();assert.equal(calls.length,2);
  f.context.document.hidden=false;f.listeners.visibilitychange();await tick();assert.equal(calls.length,3);
  f.run('makerTools.view="publication";weeklySummarySync()');assert.equal(f.timers.size,0);f.advance(60000);f.run('makerTools.view="weekly";weeklySummaryEnsure()');await tick();assert.equal(calls.length,4);
});
test('automatic refresh rolls the default view to the newest completed week on Monday',async()=>{
  const calls=[],initial=report();initial.schedule.nextRunAt='2026-10-18T15:00:00Z';const next=report('2026-10-12');next.schedule.latestWeek='2026-10-12';next.schedule.nextRunAt='2026-10-25T15:00:00Z';
  const f=fixture(async path=>{calls.push(path);return calls.length===1?initial:next;});await f.run('wksLoad()');f.advance(7*86400000);f.run('weeklySummaryEnsure()');await tick();assert.deepEqual(calls,['/api/weekly-summary','/api/weekly-summary']);assert.equal(f.run('weeklySummaryState.week'),'2026-10-12');
});
test('automatic refresh keeps a deliberately selected older week after Monday',async()=>{
  const calls=[],older=report('2026-09-28');older.schedule.nextRunAt='2026-10-18T15:00:00Z';const f=fixture(async path=>{calls.push(path);return older;});await f.run('wksLoad("2026-09-28")');f.advance(7*86400000);f.run('weeklySummaryEnsure()');await tick();assert.deepEqual(calls,['/api/weekly-summary?week=2026-09-28','/api/weekly-summary?week=2026-09-28']);assert.equal(f.run('weeklySummaryState.followLatest'),false);
});
test('reset cancels polling and rejects an already running automatic response',async()=>{
  let pending;const f=fixture(()=>new Promise(resolve=>pending=resolve));f.set(report());f.run('weeklySummarySync()');assert.equal(f.timers.size,1);f.run('weeklySummaryReset()');assert.equal(f.timers.size,0);
  const load=f.run('wksLoad("2026-10-05",{automatic:true})');f.run('state.user={id:"two"};weeklySummaryReset()');pending(report());await load;assert.equal(f.run('weeklySummaryState.data'),null);assert.equal(f.timers.size,0);
});
test('an expanded section stays open while the same week refreshes',async()=>{
  const f=fixture(),data=report();data.sections[0].items=Array.from({length:4},(_,index)=>({id:String(index),title:'record '+index}));f.set(data);f.run('weeklySummaryState.expanded.completed=true');assert.match(f.run('weeklySummaryPanel()'),/<details class="wks-more" open>/);f.context.report=data;f.context.api=async()=>data;await f.run('wksLoad("2026-10-05",{automatic:true})');assert.match(f.run('weeklySummaryPanel()'),/<details class="wks-more" open>/);
});
test('automatic and refresh renders preserve the replaced main scroll container while explicit week navigation resets it',async()=>{
  let resolve,main={scrollTop:1641.5,scrollLeft:7.5},renders=0;const f=fixture(()=>new Promise(done=>resolve=done));f.set(report());f.context.document.getElementById=id=>id==='main'?main:null;f.context.render=()=>{renders++;main={scrollTop:0,scrollLeft:0};};
  const pending=f.run('wksLoad("2026-10-05",{automatic:true})');assert.deepEqual(main,{scrollTop:1641.5,scrollLeft:7.5});resolve(report());await pending;assert.deepEqual(main,{scrollTop:1641.5,scrollLeft:7.5});assert.equal(renders,2);
  const next=f.run('wksLoad("2026-09-28")');assert.deepEqual(main,{scrollTop:0,scrollLeft:0});resolve(report('2026-09-28'));await next;assert.deepEqual(main,{scrollTop:0,scrollLeft:0});
});
test('menu entry, direct URL identity and reset are connected to the same weekly tool',()=>{
  const maker=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8'),workroom=readFileSync(new URL('./public/workroom.js',import.meta.url),'utf8'),index=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');assert.match(maker,/\['weekly','주간 정리'/);assert.match(maker,/weeklySummaryEnsure\(\)/);assert.match(maker,/weeklySummaryReset\(\)/);assert.match(workroom,/\['weekly','publication','publish'/);assert.match(index,/src="\/weekly-summary.js"/);assert.match(index,/href="\/weekly-summary.css"/);
});
