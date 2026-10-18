import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workspaceSource=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const demoSource=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const teamOverviewSource=readFileSync(new URL('./public/team-overview.js',import.meta.url),'utf8');
const teamTrendsSource=readFileSync(new URL('./public/team-trends.js',import.meta.url),'utf8');
const slice=(from,to)=>appSource.slice(appSource.indexOf(from),appSource.indexOf(to));

function matchOne(node,part){if(part==='[id]')return 'id' in node.attrs;if(part==='[contenteditable]')return 'contenteditable' in node.attrs;const tag=/^[a-z]+/.exec(part)?.[0],pairs=[...part.matchAll(/\[([^=\]]+)="([^"]*)"\]/g)];return (!tag||node.tagName===tag.toUpperCase())&&pairs.every(([,name,value])=>node.attrs[name]===value);}
const matchAny=(node,selector)=>selector.split(',').some(part=>matchOne(node,part.trim()));
function element(tag,attrs={},extra={}){const node={tagName:tag.toUpperCase(),attrs,...('id' in attrs?{id:attrs.id}:{}),attributes:Object.entries(attrs).map(([name,value])=>({name,value})),getAttribute(name){return attrs[name]??null;},matches(selector){return matchAny(node,selector);},scrollTop:0,scrollLeft:0,isConnected:true,closest:()=>null,...extra};return node;}
function page(){
  const timers=new Map(),documentHandlers=new Map(),windowHandlers=new Map(),renders=[];let nodes=[],timerId=0;
  const root={contains:node=>nodes.includes(node),querySelectorAll:selector=>nodes.filter(node=>matchAny(node,selector))};
  const document={activeElement:null,addEventListener(type,handler){documentHandlers.set(type,[...(documentHandlers.get(type)||[]),handler]);},getElementById:id=>nodes.find(node=>node.attrs.id===id)||null};
  const state={user:{id:'tester',role:'admin'},tab:'workroom',marketingView:'summary',scope:'mine',teamId:'',reportRequest:0};
  const context=vm.createContext({state,cp:{view:'library'},wr:{view:'tools'},makerTools:{view:'publication'},pf:{view:'performance'},location:new URL('http://localhost:4191/?tab=workroom&section=tools&tool=publication'),URL,URLSearchParams,CSS:{escape:value=>String(value)},
    canManageTeam:()=>true,isAdmin:()=>true,isViewer:()=>false,icon:()=>'',window:{addEventListener(type,handler){windowHandlers.set(type,[...(windowHandlers.get(type)||[]),handler]);},scrollTo(){}},document,MutationObserver:class{observe(){}},history:{replaceState(){}},crypto:{randomUUID:()=> 'id'},
    setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);},
    render(){renders.push(context.__repaint.background);}});
  vm.runInContext(workspaceSource+'\n'+demoSource+'\nglobalThis.__repaint=workspaceRepaint;',context);
  const run=code=>vm.runInContext(code,context);
  const fire=(type,event={})=>(documentHandlers.get(type)||[]).forEach(handler=>handler(event));
  const due=()=>{const entries=[...timers.entries()];timers.clear();for(const [,timer] of entries)timer.callback();return entries.map(([,timer])=>timer.delay);};
  return {context,run,root,document,timers,renders,due,fire,windowFire:type=>(windowHandlers.get(type)||[]).forEach(handler=>handler({})),set nodes(list){nodes=list;},get nodes(){return nodes;}};
}
const field=(attrs,value,extra={})=>element('input',{type:'text',...attrs},{type:attrs.type||'text',value,defaultValue:value,selectionStart:value.length,selectionEnd:value.length,selectionDirection:'none',focus(){},setSelectionRange(start,end){this.selection=[start,end];},...extra});
const capture=p=>{p.run('workspaceRepaint.background=true');const saved=p.context.workspaceRepaintCapture(p.root,false);p.run('workspaceRepaint.background=false');return saved;};

test('only marked background repaints of the same view keep scroll, focus and caret',()=>{
  const p=page(),main=element('main',{id:'main'},{scrollTop:600}),list=element('div',{id:'inbox-list'},{scrollTop:40}),query=field({name:'query'},'검증');query.selectionStart=1;query.selectionEnd=1;p.nodes=[main,list,query];p.document.activeElement=query;
  p.run('workspaceRepaintDone()');
  assert.equal(p.context.workspaceRepaintCapture(p.root,false),null,'an unmarked repaint keeps today\'s behaviour');
  const saved=capture(p);
  assert.equal(saved.main,600);assert.deepEqual(JSON.parse(JSON.stringify(saved.scrolls)),[['inbox-list',40,0]]);assert.equal(saved.focus.selector,'input[name="query"]');
  const next={main:element('main',{id:'main'}),list:element('div',{id:'inbox-list'}),query:field({name:'query'},'검증')};next.query.focus=function(){p.document.activeElement=this;};p.nodes=[next.main,next.list,next.query];p.document.activeElement=null;
  p.context.workspaceRepaintRestore(p.root,saved);
  assert.equal(next.main.scrollTop,600);assert.equal(next.list.scrollTop,40);assert.equal(p.document.activeElement,next.query);assert.deepEqual(next.query.selection,[1,1]);
  p.run('workspaceRepaint.background=true');
  assert.equal(p.context.workspaceRepaintCapture(p.root,true),null,'entering a tab still starts at the top');
  p.context.wr.view='desk';assert.equal(p.context.workspaceRepaintCapture(p.root,false),null,'another section still starts at the top');
  p.context.wr.view='tools';p.context.pf.view='prepare';assert.equal(p.context.workspaceRepaintCapture(p.root,false),null,'a sub-view change still starts at the top');
});

test('focus returns to the same-numbered field when several share a selector',()=>{
  const p=page(),main=element('main',{id:'main'}),repaint=(build,focusIndex)=>{const before=build();p.nodes=[main,...before];p.document.activeElement=before[focusIndex];p.run('workspaceRepaintDone()');const saved=capture(p);const after=build();for(const node of after)node.focus=function(){p.document.activeElement=this;};p.nodes=[main,...after];p.document.activeElement=null;p.context.workspaceRepaintRestore(p.root,saved);return after;};
  let after=repaint(()=>[field({name:'note'},''),field({name:'note'},'')],1);assert.equal(p.document.activeElement,after[1]);
  after=repaint(()=>[field({name:'count',type:'number'},'3')],0);assert.equal(p.document.activeElement,after[0]);assert.equal(after[0].selection,undefined,'number fields only get focus back');
});

test('typed-in input the screen has not taken back holds background repaints, retried every two seconds',()=>{
  const p=page(),main=element('main',{id:'main'}),title=field({name:'title'},'SYNK'),filled=field({name:'publishedAt'},'');p.nodes=[main,title,filled];p.run('workspaceRepaintDone()');
  filled.value='2026-10-18T16:13';assert.equal(capture(p)?.deferred,undefined,'a value the program filled in does not hold repaints');
  title.value='SYNK 검증';p.fire('input',{target:title});p.document.activeElement=null;
  assert.equal(capture(p)?.deferred,true,'typed text would be lost or committed by a swap, even after leaving the field');
  assert.deepEqual([...p.timers.values()].map(timer=>timer.delay),[2000]);assert.equal(capture(p)?.deferred,true);assert.equal(p.timers.size,1,'one retry at a time');
  assert.deepEqual(p.due(),[2000]);assert.deepEqual(p.renders,[],'still typed-in, so the retry waits again');assert.equal(p.timers.size,1);
  title.value='SYNK';assert.deepEqual(p.due(),[2000]);assert.deepEqual(p.renders,[true],'once the field matches the screen again the retry repaints in the background');
  title.value='SYNK 다시';assert.equal(capture(p)?.deferred,true);p.run('workspaceRepaintDone()');assert.equal(p.timers.size,0,'any repaint that happened clears the retry');
});

test('a held pointer holds background repaints so the click is not swallowed',()=>{
  const p=page(),main=element('main',{id:'main'});p.nodes=[main];p.run('workspaceRepaintDone()');
  p.fire('pointerdown');assert.equal(capture(p)?.deferred,true);p.fire('pointerup');assert.deepEqual(p.due(),[2000]);assert.deepEqual(p.renders,[true]);
  p.fire('pointerdown');p.windowFire('blur');assert.notEqual(capture(p)?.deferred,true,'leaving the window releases the hold');
});

test('a background repaint waits while Korean text is being composed',()=>{
  const p=page(),main=element('main',{id:'main'}),input=field({name:'query'},'');p.nodes=[main,input];p.document.activeElement=input;p.run('workspaceRepaintDone()');
  p.fire('compositionstart',{target:input});assert.equal(capture(p)?.deferred,true);assert.deepEqual(p.due(),[2000]);assert.deepEqual(p.renders,[],'still composing');
  p.fire('compositionend',{target:input});assert.deepEqual(p.due(),[2000]);assert.deepEqual(p.renders,[true]);
  p.fire('compositionstart',{target:Object.assign(field({name:'gone'},''),{isConnected:false})});assert.notEqual(capture(p)?.deferred,true,'a detached field never holds repaints');
});

test('renderBackground marks only its own repaint, even when it throws',()=>{
  const p=page();p.run('renderBackground()');assert.deepEqual(p.renders,[true]);assert.equal(p.run('workspaceRepaint.background'),false);
  p.context.render=()=>{throw new Error('paint failed');};assert.throws(()=>p.run('renderBackground()'),/paint failed/);assert.equal(p.run('workspaceRepaint.background'),false);
});

test('collection polling repaints only when the state answer changed, and then in the background',async()=>{
  let payload={user:{id:'u'},channels:[{id:'a',status:'running'}]},renders=0,backgrounds=0;const trendResets=[];
  const context=vm.createContext({state:{user:{id:'u'}},companyAuthSnapshot:()=>({userId:'u'}),companyAuthCurrent:()=>true,companyAuthChanged:()=>new Error('changed'),api:async()=>structuredClone(payload),isDemoMode:()=>false,clearCompanySessionView(){},initializeDemoRange(){},resetTeamOverview(){},resetTeamTrends:keep=>trendResets.push(keep),normalizeMarketingScope(){},render:()=>renders++,renderBackground:()=>backgrounds++});
  vm.runInContext(slice('async function loadState()','async function loadReport()'),context);const load=code=>vm.runInContext(code,context);
  assert.ok(await load('loadState()'));assert.equal(renders,1);const first=load('state.data');
  assert.equal(await load('loadState({quiet:true})'),null);assert.equal(renders,1);assert.equal(backgrounds,0);assert.equal(load('state.data'),first,'an unchanged answer leaves the screen data alone');
  payload={user:{id:'u'},channels:[{id:'a',status:'success'}]};assert.ok(await load('loadState({quiet:true})'));assert.equal(backgrounds,1);assert.equal(renders,1);
  assert.ok(await load('loadState()'));assert.equal(renders,2,'ordinary loads always repaint');
  assert.deepEqual(trendResets,[false,true,false],'only a changed poll keeps the team chart on screen while it refreshes');
});

test('a quiet report reload skips loading paints, also for the team overview it starts',async()=>{
  let renders=0,backgrounds=0;const overview=[];
  const context=vm.createContext({state:{tab:'analysis',scope:'all',marketingView:'summary',reportRequest:0},query:()=>'',api:async()=>({ok:true}),loadTeamOverview:(force,options)=>{overview.push(options?.quiet===true);},loadHype(){},isDemoMode:()=>false,reportToday:()=> '2026-10-18',shiftDate:date=>date,render:()=>renders++,renderBackground:()=>backgrounds++});
  vm.runInContext(slice('async function loadReport()','function startPolling()'),context);
  await vm.runInContext('loadReport()',context);assert.equal(renders,2);assert.equal(backgrounds,0);
  await vm.runInContext('loadReport({quiet:true})',context);assert.equal(renders,2);assert.equal(backgrounds,1);assert.deepEqual(vm.runInContext('state.report',context),{ok:true});assert.equal(vm.runInContext('state.loading',context),false);
  assert.deepEqual(overview,[false,true]);
  let teamRenders=0,teamBackgrounds=0;const team=vm.createContext({state:{user:{id:'u'},tab:'analysis',scope:'all',marketingView:'summary',start:'2026-10-12',end:'2026-10-18'},URLSearchParams,api:async()=>({teams:[]}),render:()=>teamRenders++,renderBackground:()=>teamBackgrounds++});
  vm.runInContext(teamOverviewSource,team);await vm.runInContext('loadTeamOverview(false,{quiet:true})',team);assert.equal(teamRenders,0);assert.equal(teamBackgrounds,1);
  await vm.runInContext('resetTeamOverview();loadTeamOverview()',team);assert.equal(teamRenders,2,'ordinary team loads keep their loading paint');
});

test('the team comparison page passes a quiet reload on to its trend chart',async()=>{
  const calls=[];const context=vm.createContext({state:{tab:'overview',scope:'team',marketingView:'summary',reportRequest:0},loadTeamTrends:async(force,options)=>{calls.push([force,options?.quiet===true]);},render(){},renderBackground(){}});
  vm.runInContext(slice('async function loadReport()','function startPolling()'),context);
  await vm.runInContext('loadReport({quiet:true})',context);await vm.runInContext('loadReport()',context);
  assert.deepEqual(calls,[[false,true],[false,false]]);
});

function trendPage(){
  const requests=[],paints=[],slider={value:'0',defaultValue:'0',setAttribute(){}};
  const state={user:{id:'u',role:'member',teamId:'alpha'},data:{},scope:'team',tab:'overview',marketingView:'summary'};
  const context=vm.createContext({state,URLSearchParams,document:{addEventListener(){},querySelector:selector=>selector==='[data-team-trend-date]'?slider:null,querySelectorAll:()=>[]},reportToday:()=> '2026-10-18',shiftDate:(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10),isDemoMode:()=>false,isAdmin:()=>false,
    render:()=>paints.push('render'),renderBackground:()=>paints.push('background'),api(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({resolve,reject});return promise;}});
  vm.runInContext(teamTrendsSource,context);
  const answer=(...values)=>({start:'2026-10-16',end:'2026-10-18',ownTeamId:'alpha',teams:[{id:'alpha',name:'우리 팀',isOwn:true,summary:{latest:values.at(-1),count:1,eligible:1,period:{delta:0,count:1,eligible:1,complete:true}},series:values.map((latest,index)=>({date:`2026-10-1${index+6}`,latest,count:1,latestCount:1,eligible:1,complete:true,change:{delta:0,complete:true}}))}]});
  return {state,requests,paints,slider,answer,run:code=>vm.runInContext(code,context)};
}

test('a quiet team trend refresh keeps the chart and the chosen date on screen, then repaints in the background',async()=>{
  const {state,requests,paints,slider,answer,run}=trendPage(),warning=/이전 숫자를 보여 주고 있어요/;
  let loading=run('loadTeamTrends()');requests[0].resolve(answer(1,2,3));await loading;assert.deepEqual(paints,['render','render']);
  run('ttPaintDate(1)');assert.equal(slider.defaultValue,'1','the chosen date is saved state, not unsaved input');
  paints.length=0;run('resetTeamTrends(true)');assert.match(run('teamTrendsSection()'),/tt-stats/,'the chart stays while the refresh is pending');assert.doesNotMatch(run('teamTrendsSection()'),warning,'a pending refresh is not a warning');
  loading=run('loadTeamTrends(false,{quiet:true})');assert.deepEqual(paints,[],'no loading paint');assert.match(run('teamTrendsSection()'),/tt-stats/);
  requests[1].resolve(answer(1,2,5));await loading;assert.deepEqual(paints,['background']);assert.equal(run('teamTrends.date'),'2026-10-17','the chosen date survives the refresh');assert.equal(run('teamTrends.result.teams[0].summary.latest'),5);
  run('resetTeamTrends(true)');loading=run('loadTeamTrends(false,{quiet:true})');requests[2].reject(new Error('잠깐 끊김'));await loading;
  assert.equal(run('teamTrends.error'),'','a failed quiet refresh keeps the chart instead of an error box');assert.equal(run('teamTrends.stale'),true);assert.equal(run('teamTrends.result.teams[0].summary.latest'),5);
  assert.match(run('teamTrendsSection()'),/이전 숫자를 보여 주고 있어요[\s\S]*data-team-trend-action="retry"/,'the kept chart says it is not the newest and offers a retry');
  paints.length=0;loading=run('loadTeamTrends()');assert.deepEqual(paints,['render'],'a stale chart still refreshes on an ordinary load, with its loading paint');assert.equal(run('teamTrends.result'),null);requests[3].resolve(answer(1));await loading;
  assert.doesNotMatch(run('teamTrendsSection()'),warning,'a successful load clears the warning');
  state.tab='analysis';run('resetTeamTrends(true)');assert.equal(run('teamTrends.result'),null,'off screen, a quiet reset drops the chart as before');
});

test('leaving the team page during a quiet refresh still fetches the newer numbers on return',async()=>{
  for(const fails of [false,true]){
    const {state,requests,answer,run}=trendPage();
    let loading=run('loadTeamTrends()');requests[0].resolve(answer(1,2,3));await loading;
    run('resetTeamTrends(true)');loading=run('loadTeamTrends(false,{quiet:true})');state.tab='analysis';
    if(fails)requests[1].reject(new Error('잠깐 끊김'));else requests[1].resolve(answer(1,2,9));await loading;
    assert.equal(run('teamTrends.result.teams[0].summary.latest'),3,'an answer that arrives off screen is not applied');assert.equal(run('teamTrends.stale'),true);
    state.tab='overview';loading=run('loadTeamTrends()');assert.equal(requests.length,3,'coming back fetches again');requests[2].resolve(answer(1,2,9));await loading;
    assert.equal(run('teamTrends.result.teams[0].summary.latest'),9);assert.equal(run('teamTrends.stale'),false);
  }
});

test('background repaints reopen opened sections before the scroll comes back',()=>{
  const p=page(),records=open=>element('details',{},{className:'tt-records',open}),custom=open=>element('details',{},{className:'tt-custom',open});
  p.nodes=[element('main',{id:'main'},{scrollTop:900}),records(true),custom(false)];p.run('workspaceRepaintDone()');const saved=capture(p);
  const after={main:element('main',{id:'main'}),records:records(false),custom:custom(true)};let top=0;
  Object.defineProperty(after.main,'scrollTop',{get:()=>top,set:value=>{top=Math.min(value,after.records.open?2000:300);}});
  p.nodes=[after.main,after.records,after.custom];p.context.workspaceRepaintRestore(p.root,saved);
  assert.equal(after.records.open,true);assert.equal(after.custom.open,false,'a section the reader closed stays closed');assert.equal(after.main.scrollTop,900,'the table opens before the page scrolls back');
  const variant=open=>element('details',{},{className:'sw-variant',open});
  p.nodes=[element('main',{id:'main'}),variant(false),variant(true)];p.run('workspaceRepaintDone()');const list=capture(p);
  const grown=[variant(false),variant(false),variant(false)];p.nodes=[element('main',{id:'main'}),...grown];p.context.workspaceRepaintRestore(p.root,list);
  assert.deepEqual(grown.map(node=>node.open),[false,false,false],'a list that grew is left as rendered instead of opening the neighbour');
});
