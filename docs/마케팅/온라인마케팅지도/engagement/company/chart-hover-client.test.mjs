import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/chart-hover.js',import.meta.url),'utf8');
const historySource=readFileSync(new URL('./public/growth-history.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const keyboardStart=appSource.indexOf("document.addEventListener('keydown',event=>{",appSource.indexOf('function renderCommandResults'));
const originalKeyboard=appSource.slice(keyboardStart,appSource.indexOf('function dailySection',keyboardStart));
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
const response=(title='확인한 콘텐츠',value=12)=>({date:'2026-09-30',metric:'views',mode:'change',count:4,eligible:5,complete:false,items:[{rank:1,id:'post-1',title,value,creatorLabel:'당시 담당 크루',creatorBasis:'observed-owner',creatorNames:['민지']}]});

function fixture({history=false,width=1440,height=960}={}){
  const listeners=[],windowListeners=[],requests=[],timers=new Map(),points=[],nodes=new Map();let clock=0,timerId=0,openedDays=0;
  const state={user:{id:'user-a',role:'member',teamId:'team-a'},tab:history?'history':'analysis',scope:'team',teamId:'team-a',ownerId:'owner-a',platform:'youtube',channel:'channel-a',metric:'views',chartMode:'change',reportRequest:7,loading:false,start:'2026-09-24',end:'2026-09-30',historyRange:'all',historyGroup:'day',historyDate:'',data:{}};
  const rows=['2026-09-28','2026-09-29','2026-09-30'].map((date,index)=>({date,metrics:{views:{total:100+index,latest:999+index,complete:true,count:2,eligible:2,change:{delta:10+index,complete:true}},likes:{total:2+index,latest:20+index,change:{delta:-index}}}}));
  state.report={daily:rows,history:{start:rows[0].date,end:rows.at(-1).date,daily:rows}};
  function element(attrs={},rect={left:400,top:450,width:10,height:10}){
    const classes=new Set(),node={attributes:{...attrs},dataset:{},style:{},isConnected:true,hidden:false,innerHTML:'',children:[],rect,
      classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)},
      setAttribute(name,value){node.attributes[name]=String(value);},getAttribute:name=>node.attributes[name]??null,removeAttribute:name=>delete node.attributes[name],hasAttribute:name=>name in node.attributes,
      getBoundingClientRect:()=>({...node.rect,bottom:node.rect.top+node.rect.height,right:node.rect.left+node.rect.width}),
      querySelector:()=>null,querySelectorAll:()=>[],contains:other=>node===other||node.children.includes(other),
      closest(selector){if(selector==='[data-chart-point]'&&node.hasAttribute('data-chart-point'))return node;if(selector==='[data-history-chart]'&&node.hasAttribute('data-history-chart'))return node;if(selector==='svg')return node.svg||null;return null;},
      focus(){document.activeElement=node;emit('focusin',node);},dispatchEvent:event=>emit(event.type,node,event)};
    return node;
  }
  const document={hidden:false,activeElement:null,addEventListener:(type,fn,options)=>listeners.push({type,fn,capture:options===true||options?.capture===true}),querySelector:selector=>nodes.get(selector)||null,createElement:()=>element({}, {left:0,top:0,width:344,height:270}),body:{append:node=>{nodes.set('#'+node.id,node);}}};
  const window={innerWidth:width,innerHeight:height,addEventListener:(type,fn)=>windowListeners.push({type,fn})};
  function emit(type,target,extra={}){
    const event={type,target,relatedTarget:null,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
    for(const listener of listeners.filter(row=>row.type===type).sort((a,b)=>Number(b.capture)-Number(a.capture))){listener.fn(event);if(event.stopped)break;}
    return event;
  }
  function point(date=rows.at(-1).date){const item=element({'data-chart-point':'','aria-describedby':'existing-help'});item.dataset={date,action:'day'};points.push(item);item.svg={querySelectorAll:()=>points};return item;}
  const context=vm.createContext({state,document,window,location:{search:'',origin:'http://localhost'},Intl,URLSearchParams,Date,Map,Set,MouseEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},METRICS:[['views','조회수'],['likes','좋아요'],['followers','팔로워·구독자']],isDemoMode:()=>context.location.search.includes('demo=1'),render:()=>{},overlay:{children:[]},$:()=>null,
    setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,due:clock+delay});return id;},clearTimeout:id=>timers.delete(id),
    query:overrides=>new URLSearchParams(Object.entries({start:state.start,end:state.end,scope:state.scope,teamId:state.teamId,...(state.tab==='analysis'?{ownerId:state.ownerId,platform:state.platform,channel:state.channel}:{}),...overrides}).filter(([,value])=>value!=null&&value!=='')).toString(),
    api:path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}))});
  const run=code=>vm.runInContext(code,context);
  if(history){const chart=element({'data-history-chart':''},{left:0,top:400,width:820,height:310});nodes.set('[data-history-chart]',chart);run(historySource);}
  run(source);run(originalKeyboard);
  // This is the existing application's click contract; the hover capture listener must not consume desktop/keyboard actions.
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-chart-point]'))openedDays++;});
  async function advance(ms){clock+=ms;for(const[id,timer]of [...timers])if(timer.due<=clock){timers.delete(id);timer.fn();}await flush();}
  function show(anchor,date=anchor.dataset.date,options={}){context.options={anchor,date,metric:state.metric,mode:state.chartMode,value:12};context.showOptions=options;run('showChartLeaders(options,showOptions)');}
  return{state,context,requests,nodes,point,element,run,emit,show,advance,document,window,openedDays:()=>openedDays,popup:()=>nodes.get('#chart-content-leaders'),windowEvent:type=>windowListeners.filter(row=>row.type===type).forEach(row=>row.fn())};
}

test('hover debounces rapid date changes and requests the exact scoped compact day contract',async()=>{
  const f=fixture(),a=f.point('2026-09-28'),b=f.point('2026-09-29');
  f.emit('pointerover',a,{pointerType:'mouse'});assert.equal(f.popup().attributes.role,'tooltip');assert.equal(f.popup().hidden,false);assert.match(f.popup().innerHTML,/확인하고 있어요/);
  await f.advance(100);assert.equal(f.requests.length,0);
  f.emit('pointerover',b,{pointerType:'mouse'});await f.advance(129);assert.equal(f.requests.length,0);await f.advance(1);assert.equal(f.requests.length,1);
  const url=new URL(f.requests[0].path,'http://localhost');assert.equal(url.pathname,'/api/day');
  assert.deepEqual(Object.fromEntries(url.searchParams),{scope:'team',teamId:'team-a',ownerId:'owner-a',platform:'youtube',channel:'channel-a',date:'2026-09-29',leaders:'1',metric:'views',mode:'change'});
  f.requests[0].resolve(response());await flush();assert.match(f.popup().innerHTML,/확인한 콘텐츠/);assert.match(f.popup().innerHTML,/4\/5개 콘텐츠 기준 · 일부 기록/);
});

test('pending requests deduplicate across leave/re-enter and completed results cache without another request',async()=>{
  const f=fixture(),a=f.point();f.show(a,a.dataset.date,{immediate:true});assert.equal(f.requests.length,1);
  f.run('hideChartLeaders()');f.show(a,a.dataset.date,{immediate:true});assert.equal(f.requests.length,1);
  f.requests[0].resolve(response());await flush();assert.match(f.popup().innerHTML,/확인한 콘텐츠/);
  f.run('hideChartLeaders()');f.show(a,a.dataset.date,{immediate:true});assert.equal(f.requests.length,1);assert.equal(f.run('chartLeaders.cache.size'),1);
  assert.equal(f.run('chartLeaders.pending.size'),0);
});

test('late date responses and errors cannot overwrite the current tooltip',async()=>{
  const f=fixture(),a=f.point('2026-09-28'),b=f.point('2026-09-29');
  f.show(a,a.dataset.date,{immediate:true});f.show(b,b.dataset.date,{immediate:true});
  f.requests[1].resolve(response('새 날짜'));await flush();f.requests[0].resolve(response('이전 날짜'));await flush();assert.match(f.popup().innerHTML,/새 날짜/);assert.doesNotMatch(f.popup().innerHTML,/이전 날짜/);
  f.run('hideChartLeaders(true)');f.show(a,a.dataset.date,{immediate:true});f.show(b,b.dataset.date,{immediate:true});f.requests[3].resolve(response('정상 결과'));await flush();f.requests[2].reject(new Error('obsolete'));await flush();assert.match(f.popup().innerHTML,/정상 결과/);assert.doesNotMatch(f.popup().innerHTML,/재시도/);
});

test('context changes cannot reveal a pending result or reuse another context cache entry',async()=>{
  for(const mutate of [f=>f.state.user=null,f=>f.state.user.id='other',f=>f.state.user.role='viewer',f=>f.state.user.teamId='other-team',f=>f.state.scope='all',f=>f.state.teamId='other-team',f=>f.state.ownerId='other-owner',f=>f.state.platform='instagram',f=>f.state.channel='other-channel',f=>f.state.reportRequest++,f=>f.context.location.search='?demo=1&persona=other']){
    const f=fixture(),point=f.point();f.show(point,point.dataset.date,{immediate:true});mutate(f);f.requests[0].resolve(response('금지된 이전 결과'));await flush();
    assert.doesNotMatch(f.popup().innerHTML,/금지된 이전 결과/);assert.equal(f.run('chartLeaders.cache.size'),0);
    if(f.state.user){f.show(point,point.dataset.date,{immediate:true});assert.equal(f.requests.length,2);}
  }
});

test('metric and mode use separate cache keys and display exact observations instead of carried totals',async()=>{
  const f=fixture(),point=f.point();f.emit('focusin',point);f.requests[0].resolve(response());await flush();
  f.state.metric='likes';f.emit('focusin',point);assert.equal(f.requests.length,2);assert.match(f.requests[1].path,/metric=likes/);assert.match(f.popup().innerHTML,/좋아요 하루 증감/);
  f.state.chartMode='total';f.emit('focusin',point);assert.equal(f.requests.length,3);assert.match(f.requests[2].path,/mode=total/);assert.match(f.popup().innerHTML,/<b>4<small>/);assert.doesNotMatch(f.popup().innerHTML,/<b>22<small>/);
});

test('clear removes caches and descriptors and a logged-out response cannot repopulate them',async()=>{
  const f=fixture(),point=f.point();f.show(point,point.dataset.date,{immediate:true});assert.match(point.attributes['aria-describedby'],/existing-help chart-content-leaders/);
  f.run('hideChartLeaders(true)');f.state.user=null;assert.equal(point.attributes['aria-describedby'],'existing-help');assert.equal(point.classList.contains('has-content-leaders'),false);assert.equal(f.popup().hidden,true);
  f.requests[0].resolve(response('로그아웃 전 자료'));await flush();assert.equal(f.run('chartLeaders.cache.size'),0);assert.equal(f.run('chartLeaders.pending.size'),0);assert.equal(f.popup().hidden,true);
  f.show(point,point.dataset.date,{immediate:true});assert.equal(f.requests.length,1);
});

test('errors retry after re-entering and never become cached successful results',async()=>{
  const f=fixture(),point=f.point();f.show(point,point.dataset.date,{immediate:true});f.requests[0].reject(new Error('<secret request detail>'));await flush();assert.match(f.popup().innerHTML,/다시 가리키면 재시도/);assert.doesNotMatch(f.popup().innerHTML,/secret request/);assert.equal(f.run('chartLeaders.cache.size'),0);
  f.emit('pointerout',point);f.show(point,point.dataset.date,{immediate:true});assert.equal(f.requests.length,2);f.requests[1].resolve(response('복구 성공'));await flush();assert.match(f.popup().innerHTML,/복구 성공/);
});

test('cache is bounded at 64 date/context results',async()=>{
  const f=fixture(),point=f.point();
  for(let i=0;i<65;i++){const date=new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10);f.show(point,date,{immediate:true});f.requests.at(-1).resolve(response(`content-${i}`));await flush();}
  assert.equal(f.run('chartLeaders.cache.size'),64);assert.equal(f.run('chartLeaders.pending.size'),0);
  f.show(point,'2026-07-01',{immediate:true});assert.equal(f.requests.length,66,'oldest result must be fetched again after eviction');
});

test('titles and attribution are escaped, complete zero/decrease stay ranked, and missing data has no fabricated values',()=>{
  const f=fixture();f.context.options={date:'2026-09-30',metric:'views',mode:'change',value:0};f.context.result={count:3,eligible:3,complete:true,items:[{rank:1,title:'긴 제목 '.repeat(40)+'<img src=x onerror=alert(1)>',value:0,creatorLabel:'당시 담당 크루',creatorNames:['<script>크루</script>']},{rank:2,title:'감소 기록',value:-4,creatorLabel:'제작자 미등록',creatorNames:[]},{rank:3,title:'세 번째',value:-9},{rank:4,title:'네 번째 숨김',value:-10}]};
  const html=f.run('leadersMarkup(options,result)');assert.equal((html.match(/<li>/g)||[]).length,3);assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;크루/);assert.doesNotMatch(html,/<img|<script|네 번째 숨김|\+0|NaN|Infinity/);assert.match(html,/>-4<small>/);assert.match(html,/3\/3개 콘텐츠 기준/);assert.doesNotMatch(html,/일부 기록/);assert.ok(html.includes('긴 제목 '.repeat(40)),'full title remains in the DOM even if CSS limits visible lines');
  f.context.options.value=null;f.context.result={count:0,eligible:5,items:[]};assert.match(f.run('leadersMarkup(options,result)'),/이날 비교할 수 있는 콘텐츠 기록이 없어요/);assert.match(f.run('leadersMarkup(options,result)'),/<b>—/);
  f.context.options.metric='followers';f.context.result.emptyReason='account-metric';assert.match(f.run('leadersMarkup(options,result)'),/콘텐츠별 순위를 나눌 수 없어요/);
});

test('original analysis arrow-key navigation and Enter/Space day actions remain operable',()=>{
  const f=fixture(),first=f.point('2026-09-28'),second=f.point('2026-09-29');first.setAttribute('tabindex','0');second.setAttribute('tabindex','-1');
  first.focus();assert.equal(f.requests.length,1);assert.match(f.popup().innerHTML,/2026.09.28/);
  const arrow=f.emit('keydown',first,{key:'ArrowRight'});assert.equal(arrow.defaultPrevented,true);assert.equal(f.document.activeElement,second);assert.equal(second.attributes.tabindex,'0');assert.equal(first.attributes.tabindex,'-1');assert.equal(f.requests.length,2);
  f.emit('keydown',second,{key:'Enter'});assert.equal(f.openedDays(),1);assert.equal(f.popup().hidden,true);
  second.focus();f.emit('keydown',second,{key:' '});assert.equal(f.openedDays(),2);
});

test('keyboard focus retains a hovered tooltip when the pointer leaves, then blur dismisses it',async()=>{
  const f=fixture(),point=f.point();f.emit('pointerover',point,{pointerType:'mouse'});await f.advance(130);f.requests[0].resolve(response());await flush();
  point.focus();f.emit('pointerout',point);assert.equal(f.document.activeElement,point);assert.equal(f.popup().hidden,false,'focused tooltip must survive mouse departure');
  f.emit('focusout',point,{relatedTarget:f.element()});assert.equal(f.popup().hidden,true);
});

test('mobile first tap previews and the second tap invokes the original day action exactly once',()=>{
  const f=fixture({width:320}),point=f.point();f.emit('pointerover',point,{pointerType:'touch'});assert.equal(f.requests.length,0);
  f.emit('pointerdown',point,{pointerType:'touch'});point.focus();assert.equal(f.requests.length,1);const first=f.emit('click',point);assert.equal(first.defaultPrevented,true);assert.equal(first.stopped,true);assert.equal(f.openedDays(),0);assert.equal(f.popup().hidden,false);
  f.emit('pointerdown',point,{pointerType:'touch'});const second=f.emit('click',point);assert.equal(second.stopped,false);assert.equal(f.openedDays(),1);assert.equal(f.popup().hidden,true);
  f.emit('click',point);assert.equal(f.openedDays(),2,'an ordinary desktop click is never swallowed');
});

test('history hooks run after real date selection and rank the exact selected date, not carried-forward latest',()=>{
  const f=fixture({history:true}),chart=f.nodes.get('[data-history-chart]');
  f.emit('keydown',chart,{key:'Home'});assert.equal(f.state.historyDate,'2026-09-28');assert.equal(f.requests.length,1);assert.match(f.requests[0].path,/date=2026-09-28/);assert.match(f.requests[0].path,/mode=total/);assert.doesNotMatch(f.requests[0].path,/ownerId|platform|channel=/);assert.match(f.popup().innerHTML,/<b>100<small>/);assert.doesNotMatch(f.popup().innerHTML,/<b>999<small>/);
  f.emit('keydown',chart,{key:'ArrowRight'});assert.equal(f.state.historyDate,'2026-09-29');assert.match(f.requests[1].path,/date=2026-09-29/);
  f.emit('click',chart,{clientX:820});assert.equal(f.state.historyDate,'2026-09-30');assert.match(f.requests[2].path,/date=2026-09-30/);
});

test('Escape, scroll, resize, hidden documents and disconnected anchors dismiss the tooltip',()=>{
  const f=fixture(),point=f.point();
  for(const hide of [()=>f.emit('keydown',point,{key:'Escape'}),()=>f.windowEvent('scroll'),()=>f.windowEvent('resize'),()=>{f.document.hidden=true;f.emit('visibilitychange',f.document);},()=>{point.isConnected=false;f.run('leadersPosition()');}]){
    point.isConnected=true;f.document.hidden=false;f.show(point);hide();assert.equal(f.popup().hidden,true);assert.equal(f.run('chartLeaders.active'),null);
  }
});

test('keyboard auto-scroll repositions a visible focused tooltip without discarding its request',async()=>{
  const f=fixture(),point=f.point();point.rect={left:400,top:1100,width:10,height:10};point.focus();assert.equal(f.requests.length,1);
  const oldTop=f.popup().style.top;
  // Native focus may emit intermediate scroll events while the destination point is still outside the viewport.
  f.windowEvent('scroll');assert.equal(f.popup().hidden,true);assert.notEqual(f.run('chartLeaders.active'),null);assert.equal(f.run('chartLeaders.pending.size'),1);
  point.rect.top=500;f.windowEvent('scroll');assert.equal(f.document.activeElement,point);assert.equal(f.popup().hidden,false);assert.notEqual(f.popup().style.top,oldTop);assert.equal(f.requests.length,1);
  f.requests[0].resolve(response('스크롤 뒤 도착한 정상 결과'));await flush();assert.match(f.popup().innerHTML,/스크롤 뒤 도착한 정상 결과/);assert.equal(f.popup().hidden,false);
  point.rect.top=-100;f.windowEvent('scroll');assert.equal(f.popup().hidden,true,'an off-screen focused anchor temporarily hides its tooltip');assert.notEqual(f.run('chartLeaders.active'),null);
  point.rect.top=400;f.windowEvent('scroll');assert.equal(f.popup().hidden,false);assert.match(f.popup().innerHTML,/스크롤 뒤 도착한 정상 결과/);assert.equal(f.requests.length,1,'returning to view reuses the same result');
  f.emit('focusout',point,{relatedTarget:f.element()});assert.equal(f.popup().hidden,true);assert.equal(f.run('chartLeaders.active'),null,'blur fully dismisses the preserved keyboard tooltip');
  const touch=fixture(),touchPoint=touch.point();touch.emit('pointerdown',touchPoint,{pointerType:'touch'});touchPoint.focus();touch.windowEvent('scroll');assert.equal(touch.popup().hidden,true,'touch scrolling still dismisses the first-tap preview');
});

test('opening the existing app modal dismisses a tooltip and a pending response cannot revive it',async()=>{
  const f=fixture(),point=f.point();f.document.body.classList={add(){},remove(){}};f.context.overlay.querySelector=()=>null;f.context.icon=()=>'';f.context.requestAnimationFrame=callback=>callback();
  f.run(appSource.slice(appSource.indexOf('function modal('),appSource.indexOf('function closeModal(')));
  f.show(point,point.dataset.date,{immediate:true});f.run('modal("날짜 상세","","<p>상세 내용</p>")');assert.equal(f.popup().hidden,true);assert.match(f.context.overlay.innerHTML,/role="dialog"/);
  f.requests[0].resolve(response('늦은 팝업 응답'));await flush();assert.equal(f.popup().hidden,true);assert.equal(f.run('chartLeaders.cache.size'),0);
});

test('positioning clamps a 320px viewport and preserves a 12px safe edge',()=>{
  const f=fixture({width:320,height:600}),point=f.point();point.rect={left:0,top:10,width:10,height:10};f.show(point);
  const style=f.popup().style;assert.equal(style.width,'296px');assert.equal(style.left,'12px');assert.ok(parseFloat(style.top)>=12);assert.ok(parseFloat(style.top)+270<=588);
  point.rect={left:319,top:590,width:1,height:5};f.run('leadersPosition()');assert.equal(style.left,'12px');assert.ok(parseFloat(style.top)+270<=588);
});

test('auth/loading/detached/invalid-date calls cannot start a request',()=>{
  for(const mutate of [f=>f.state.user=null,f=>f.state.loading=true,f=>f.anchor.isConnected=false,f=>f.anchor.dataset.date='bad-date']){
    const f=fixture();f.anchor=f.point();mutate(f);f.show(f.anchor,f.anchor.dataset.date,{immediate:true});assert.equal(f.requests.length,0);assert.equal(f.popup(),undefined);
  }
});
