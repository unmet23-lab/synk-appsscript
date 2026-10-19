import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const modules=['workspace.js','workroom.js','client-project-news.js','client-projects.js','client-schedule.js','publication-flow.js','weekly-summary.js','automation-health.js','creative-research.js'];
const sources=new Map(modules.map(name=>[name,readFileSync(new URL('./public/'+name,import.meta.url),'utf8')]));
const projectId='10000000-0000-4000-8000-000000000001';
function fixture(){
  const handlers={document:new Map(),window:new Map()},timers=new Map(),requests=[],streams=[];let timerId=0;
  const add=kind=>(event,fn)=>handlers[kind].set(event,[...(handlers[kind].get(event)||[]),fn]);
  const document={hidden:false,visibilityState:'visible',activeElement:null,body:{},documentElement:{},addEventListener:add('document'),getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];}};
  const schedule=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};
  const context=vm.createContext({URL,URLSearchParams,location:new URL('http://127.0.0.1/'),document,
    window:{addEventListener:add('window'),scrollTo(){},scrollX:0,scrollY:0},navigator:{onLine:true},MutationObserver:class{observe(){}},
    setTimeout:schedule,clearTimeout:id=>timers.delete(id),setInterval:schedule,clearInterval:id=>timers.delete(id),
    EventSource:class{constructor(url){this.url=url;this.readyState=0;this.listeners=new Map();streams.push(this);}addEventListener(name,fn){this.listeners.set(name,fn);}close(){this.closed=true;}},
    api(...args){requests.push(args);return new Promise(()=>{});},render(){},queueMicrotask,makerTools:{view:''}});
  const run=source=>vm.runInContext(source,context,{timeout:5000});
  for(const [name,source]of sources)vm.runInContext(source,context,{filename:name,timeout:5000});
  function fire(kind,event,payload={}){const errors=[];for(const fn of handlers[kind].get(event)||[])try{fn(payload);}catch(error){errors.push(error);}return errors;}
  return {context,document,timers,requests,streams,run,fire,visible(hidden=false){document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';assert.deepEqual(fire('document','visibilitychange'),[]);},
    init(tab='workroom'){run(`const state={user:{id:'u',role:'admin',teamId:'team'},tab:${JSON.stringify(tab)},csrf:'synthetic'};`);},
    clients(){run(`wr.view='clients';clientDesk.userId='u';clientDesk.id='${projectId}';clientDesk.data={canWrite:true,projects:[{id:'${projectId}',revision:1,stage:'active',ownerId:'u',schedule:{canEdit:true}}]};`);},
    fireTimer(id){const timer=timers.get(id);assert.ok(timer,'Expected scheduled timer');timers.delete(id);timer.fn();return timer.ms;}};
}
const requested=(f,path)=>f.requests.some(([url])=>url===path||url.startsWith(path+'?'));

test('pre-app visible, hidden, focus, online and persisted pageshow events are harmless before the state binding exists',()=>{
  const html=readFileSync(new URL('./public/index.html',import.meta.url),'utf8'),scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(m=>m[1]);
  assert.ok(modules.every(name=>scripts.indexOf('/'+name)>=0&&scripts.indexOf('/'+name)<scripts.indexOf('/app.js')),'Exercise the real pre-app script order');
  const f=fixture();assert.equal(f.run('typeof state'),'undefined');const errors=[];
  for(const hidden of [false,true,false]){f.document.hidden=hidden;f.document.visibilityState=hidden?'hidden':'visible';errors.push(...f.fire('document','visibilitychange'));errors.push(...f.fire('window','focus'));}
  errors.push(...f.fire('window','online'),...f.fire('window','pageshow',{persisted:true}));
  assert.deepEqual(errors.map(e=>e.message),[]);assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);assert.equal(f.streams.length,0);
});
test('the same events stay idle after initialization for a signed-out user',()=>{
  const f=fixture();f.run("const state={user:null,tab:'home'};");f.visible();assert.deepEqual(f.fire('window','focus'),[]);assert.deepEqual(f.fire('window','online'),[]);assert.deepEqual(f.fire('window','pageshow',{persisted:true}),[]);assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);assert.equal(f.streams.length,0);
});
test('workspace visibility still refreshes unread summary and online/pageshow resume the same frame recovery',()=>{
  const f=fixture();f.init('messenger');f.run('workspaceModule.frame={contentWindow:{postMessage(){}},contentDocument:null};');f.visible();
  assert.ok(requested(f,'/api/workspace-summary'));assert.equal(f.timers.get(f.run('workspaceModule.loadTimer')).ms,0);
  f.visible(true);assert.equal(f.run('workspaceModule.loadTimer'),null);
  f.document.hidden=false;f.document.visibilityState='visible';assert.deepEqual(f.fire('window','online'),[]);assert.equal(f.timers.get(f.run('workspaceModule.loadTimer')).ms,0);
  f.run('stopWorkspaceModuleLoading();');assert.deepEqual(f.fire('window','pageshow',{persisted:true}),[]);assert.equal(f.timers.get(f.run('workspaceModule.loadTimer')).ms,0);
});
test('workspace resume events keep an active voice call frame intact',()=>{
  const f=fixture();f.init('messenger');f.run("workspaceModule.frame={src:'/messenger/',contentWindow:{postMessage(){}},contentDocument:null};workspaceModule.voice={call:{id:'active-call'}};");f.visible();assert.deepEqual(f.fire('window','online'),[]);assert.deepEqual(f.fire('window','pageshow',{persisted:true}),[]);
  assert.equal(f.run('workspaceModule.loadTimer'),null);assert.equal(f.run('workspaceModule.frame.src'),'/messenger/');assert.equal(f.run('workspaceModule.voice.call.id'),'active-call');assert.ok(requested(f,'/api/workspace-summary'));
});
test('workroom visibility resumes a running daily poll and hiding cancels it',()=>{
  const f=fixture();f.init();f.run("Object.assign(wr,{userId:'u',view:'trends',dailyAttempted:true,daily:{running:true},dailyFetchedAt:Date.now(),dailyLoadedDay:wrDailyToday()});");f.visible();const id=f.run('wr.dailyPollTimer');assert.equal(f.timers.get(id).ms,2500);f.visible(true);assert.equal(f.run('wr.dailyPollTimer'),null);assert.equal(f.timers.has(id),false);
});
test('project news focus after initialization requests the selected project news',()=>{
  const f=fixture();f.init();f.clients();assert.deepEqual(f.fire('window','focus'),[]);assert.ok(requested(f,'/api/client-projects/'+projectId+'/news'));assert.equal(f.run(`cnewsRecord('${projectId}').loading`),true);
});
test('project follow-up visibility schedules the next Korean midnight and hiding cancels it',()=>{
  const f=fixture();f.init();f.clients();f.visible();const id=f.run('clientDesk.followUpTimer'),ms=f.timers.get(id).ms;assert.ok(ms>=1000&&ms<=86400050);f.visible(true);assert.equal(f.run('clientDesk.followUpTimer'),null);assert.equal(f.timers.has(id),false);
});
test('client schedule visibility preserves the selected project poll and hides without a pending timer',()=>{
  const f=fixture();f.init();f.clients();f.visible();const id=f.run('clientSchedule.timer');assert.equal(f.timers.get(id).ms,60000);assert.equal(f.run('clientSchedule.timerProject'),projectId);f.visible(true);assert.equal(f.run('clientSchedule.timer'),null);assert.equal(f.timers.has(id),false);
});
test('publication visibility resumes the inbox poll and its timer requests the inbox',()=>{
  const f=fixture();f.init();f.run("wr.view='tools';makerTools.view='publication';pf.userId='u';pf.view='prepare';pf.data={inbox:{available:true,active:true},performance:{entries:[]}};");f.visible();const id=f.run('pf.inboxTimer');assert.equal(f.timers.get(id).ms,5000);f.fireTimer(id);assert.ok(requested(f,'/api/publication-inbox'));f.visible(true);assert.equal(f.run('pf.inboxTimer'),null);
});
test('publication performance visibility still requests an immediate learning refresh and hiding invalidates it',()=>{
  const f=fixture();f.init();f.run("wr.view='tools';makerTools.view='publication';pf.userId='u';pf.view='performance';pf.data={performance:{entries:[]}};");f.visible();const id=f.run('pf.learningTimer');assert.equal(f.timers.get(id).ms,0);const request=f.run('pf.learningRequest');f.visible(true);assert.equal(f.run('pf.learningTimer'),null);assert.ok(f.run('pf.learningRequest')>request);assert.equal(f.timers.has(id),false);
});
test('weekly summary visibility resumes its refresh timer and the timer reads the summary',()=>{
  const f=fixture();f.init();f.run("wr.view='tools';makerTools.view='weekly';Object.assign(weeklySummaryState,{userId:'u',attempted:true,lastAttemptAt:Date.now()});");f.visible();const id=f.run('weeklySummaryState.timer');assert.equal(f.timers.get(id).ms,60000);f.fireTimer(id);assert.ok(requested(f,'/api/weekly-summary'));f.visible(true);assert.equal(f.run('weeklySummaryState.timer'),null);
});
test('automation health visibility resumes refresh and the timer reads current automation status',()=>{
  const f=fixture();f.init();f.run("wr.view='tools';makerTools.view='automation';Object.assign(automationHealthState,{identity:ahUserKey(),attempted:true,lastAttemptAt:Date.now()});");f.visible();const id=f.run('automationHealthState.timer');assert.equal(f.timers.get(id).ms,60000);f.fireTimer(id);assert.ok(requested(f,'/api/automation-health'));f.visible(true);assert.equal(f.run('automationHealthState.timer'),null);
});
test('creative research visibility reconnects its event stream and hiding closes it and cancels refreshes',()=>{
  const f=fixture();f.init();f.run("wr.view='trends';cr.userId='u';cr.data={};");f.visible();assert.equal(f.streams.length,1);assert.equal(f.streams[0].url,'/api/creative-research/events');assert.equal(f.timers.get(f.run('cr.syncStatusTimer')).ms,60000);assert.equal(f.timers.get(f.run('cr.refreshTimer')).ms,60000);
  f.visible(true);assert.equal(f.streams[0].closed,true);assert.equal(f.run('cr.stream'),null);assert.equal(f.run('cr.syncStatusTimer'),null);assert.equal(f.run('cr.refreshTimer'),null);
});
