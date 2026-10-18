import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workspaceSource=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const demoSource=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const teamOverviewSource=readFileSync(new URL('./public/team-overview.js',import.meta.url),'utf8');
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
  let payload={user:{id:'u'},channels:[{id:'a',status:'running'}]},renders=0,backgrounds=0;
  const context=vm.createContext({state:{user:{id:'u'}},companyAuthSnapshot:()=>({userId:'u'}),companyAuthCurrent:()=>true,companyAuthChanged:()=>new Error('changed'),api:async()=>structuredClone(payload),isDemoMode:()=>false,clearCompanySessionView(){},initializeDemoRange(){},resetTeamOverview(){},resetTeamTrends(){},normalizeMarketingScope(){},render:()=>renders++,renderBackground:()=>backgrounds++});
  vm.runInContext(slice('async function loadState()','async function loadReport()'),context);const load=code=>vm.runInContext(code,context);
  assert.ok(await load('loadState()'));assert.equal(renders,1);const first=load('state.data');
  assert.equal(await load('loadState({quiet:true})'),null);assert.equal(renders,1);assert.equal(backgrounds,0);assert.equal(load('state.data'),first,'an unchanged answer leaves the screen data alone');
  payload={user:{id:'u'},channels:[{id:'a',status:'success'}]};assert.ok(await load('loadState({quiet:true})'));assert.equal(backgrounds,1);assert.equal(renders,1);
  assert.ok(await load('loadState()'));assert.equal(renders,2,'ordinary loads always repaint');
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
