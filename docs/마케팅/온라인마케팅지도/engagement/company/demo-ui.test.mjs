import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/demo-ui.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const helpers=['const escape =','const validNumber =','const numberFormatter =','const number ='].map(prefix=>appSource.split('\n').find(line=>line.startsWith(prefix))).join('\n');
function fixture(search='?demo=1&persona=crew-a'){
  const handlers=[],notifications=[],address=new URL('http://localhost:4191/'+search);
  const location={get href(){return address.href;},set href(value){address.href=new URL(value,address).href;},get origin(){return address.origin;},get search(){return address.search;},get searchParams(){return address.searchParams;},toString(){return address.href;}};
  const state={user:{id:'administrator',role:'admin'},data:{},start:'2026-09-23',end:'2026-09-29',range:'week'};
  const context=vm.createContext({state,location,URL,URLSearchParams,Intl,
    isAdmin:()=>state.user?.role==='admin',icon:()=>'',notify:message=>notifications.push(message),
    shiftDate:(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),
    document:{addEventListener(type,handler,capture=false){handlers.push({type,handler,capture});}},
  });
  vm.runInContext(helpers+'\n'+source,context,{filename:'demo-ui.js'});
  const run=code=>vm.runInContext(code,context);
  const dispatch=(type,target)=>{
    const event={target,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    for(const listener of handlers.filter(row=>row.type===type).sort((a,b)=>Number(b.capture)-Number(a.capture))){listener.handler(event);if(event.stopped)break;}
    return event;
  };
  const target=(action,extra={})=>({dataset:{action,...extra},closest(selector){return selector==='[data-action]'?this:null;}});
  return{state,location,context,notifications,run,dispatch,target,handlers};
}

test('company guidance leaves the graph demo and reloads the actual account destination',()=>{
  const f=fixture('?tab=overview&section=team&teamId=virtual-team&demo=1&persona=crew-a#view=history');
  const event=f.dispatch('click',f.target('tab',{tab:'handbook'}));
  assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(f.location.search,'?tab=handbook');assert.equal(new URL(f.location.href).hash,'');assert.equal(f.notifications.length,0);
});

test('demo routes only the exact supported GET endpoints and retains query filters with the selected persona',()=>{
  const f=fixture('?demo=1&persona=crew%20A');
  for(const name of ['state','analytics','day','team-overview','hype','export.csv']){
    for(const path of [`/api/${name}`,`/api/demo/${name}`]){
      f.context.path=path+'?start=2026-09-01&teamId=team-a&persona=forged';
      const url=new URL(f.run('demoApiUrl(path)'),f.location);
      assert.equal(url.pathname,'/api/demo/'+name);assert.equal(url.searchParams.get('start'),'2026-09-01');
      assert.equal(url.searchParams.get('teamId'),'team-a');assert.equal(url.searchParams.get('persona'),'crew A');
    }
  }
  for(const path of ['/api/state/','/api/states','/api/demo/demo/state','/api/channels','/api/workspace-summary','/messenger/api/bootstrap','/api/content-workspace','/state','/api/%73tate']){
    f.context.path=path;assert.throws(()=>f.run('demoApiUrl(path)'),/실제 데이터/);
  }
});

test('authentication stays on the real account API while every other mutation is blocked',()=>{
  const f=fixture();
  for(const path of ['/api/me','/api/login','/api/logout','/api/launch'])for(const method of ['GET','POST']){
    f.context.input={path:path+'?next=example',method};assert.equal(f.run('demoApiUrl(input.path,input.method)'),path+'?next=example');
  }
  for(const path of ['/api/analytics','/api/demo/state','/api/channels','/api/setup','/api/join','/api/login/'])for(const method of ['POST','PATCH','DELETE']){
    f.context.input={path,method};assert.throws(()=>f.run('demoApiUrl(input.path,input.method)'),/실제 자료를 변경하지 않아요/);
  }
});

test('outside demo mode routing and actions remain unchanged',()=>{
  for(const search of ['', '?demo=0','?demo=true']){
    const f=fixture(search);assert.equal(f.run('isDemoMode()'),false);
    f.context.path='/api/channels?original=1';assert.equal(f.run("demoApiUrl(path,'DELETE')"),f.context.path);
    assert.equal(f.run("demoAllowsAction('collect',{dataset:{}})"),true);
    const event=f.dispatch('click',f.target('collect'));assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,false);assert.equal(f.notifications.length,0);
  }
});

test('demo links preserve the valid overview scope while removing team filters and authentication fragments',()=>{
  for(const section of ['mine','team','all','channels','examples']){
    const f=fixture(`?tab=analysis&section=${section}&teamId=real-team&demo=1&persona=old#launch=discard-me`);
    const enabled=new URL(f.run("demoScreenUrl(true,'crew & new')"),f.location);
    assert.equal(enabled.searchParams.get('tab'),'overview');assert.equal(enabled.searchParams.get('section'),['mine','team','all'].includes(section)?section:'all');
    assert.equal(enabled.searchParams.get('teamId'),null);assert.equal(enabled.searchParams.get('demo'),'1');assert.equal(enabled.searchParams.get('persona'),'crew & new');assert.equal(enabled.hash,'');
    const disabled=new URL(f.run('demoScreenUrl(false)'),f.location);
    assert.equal(disabled.searchParams.has('demo'),false);assert.equal(disabled.searchParams.has('persona'),false);assert.equal(disabled.searchParams.has('teamId'),false);assert.equal(disabled.hash,'');
  }
});

test('changing the persona navigates to its demo overview without an old selected team',()=>{
  const f=fixture('?tab=analysis&section=team&teamId=old-team&demo=1&persona=crew-a');
  f.dispatch('change',{value:'crew-b',matches:selector=>selector==='[data-demo-persona]'});
  assert.equal(f.location.searchParams.get('persona'),'crew-b');assert.equal(f.location.searchParams.get('tab'),'overview');assert.equal(f.location.searchParams.get('section'),'team');assert.equal(f.location.searchParams.has('teamId'),false);
  const before=f.location.href;f.dispatch('change',{value:'unrelated',matches:()=>false});assert.equal(f.location.href,before);
});

test('the anchored four-week demo range is initialized once and does not overwrite subsequent date choices',()=>{
  const f=fixture();f.context.payload={demo:{enabled:false,anchorDate:'2026-08-31'}};f.run('initializeDemoRange(payload)');assert.equal(f.state.start,'2026-09-23');
  f.context.payload.demo.enabled=true;f.run('initializeDemoRange(payload)');assert.equal(f.state.start,'2026-08-04');assert.equal(f.state.end,'2026-08-31');assert.equal(f.state.range,'custom');
  f.state.start='2026-08-10';f.state.end='2026-08-16';f.state.range='week';f.context.payload.demo.anchorDate='2026-09-29';f.run('initializeDemoRange(payload)');
  assert.equal(f.state.start,'2026-08-10');assert.equal(f.state.end,'2026-08-16');assert.equal(f.state.range,'week');
});

test('the banner distinguishes demo data, escapes persona fields and shows crew, channel and post counts',()=>{
  const f=fixture();f.state.data={channels:Array(6).fill({}),demo:{enabled:true,personaId:'a" injected="x',channelCount:6,postCount:18,people:[
    {id:'a" injected="x',name:'<img src=x onerror=alert(1)>',teamName:'A & B'},
    {id:'b',name:'크루 둘',teamName:'디자인'}, {id:'c',name:'크루 셋',teamName:'마케팅'},
  ]}};
  const html=f.run('demoBanner()');
  assert.match(html,/크루 3명 · 채널 6개 · 가상 게시글 18개/);assert.match(html,/실제 업로드나 수집 기록이 아닙니다/);
  assert.match(html,/value="a&quot; injected=&quot;x" selected/);assert.match(html,/&lt;img/);assert.match(html,/A &amp; B/);assert.doesNotMatch(html,/<img| injected="x/);
  const information=html.match(/<details id="demo-information"[^>]*>/)?.[0];assert.ok(information);assert.doesNotMatch(information,/\bopen\b/,'the detailed demo explanation starts collapsed');
  assert.equal((html.match(/<option /g)||[]).length,3);assert.equal((html.match(/실제 데이터로 돌아가기/g)||[]).length,1);
  const off=fixture('');off.state.data.demoAvailable=true;assert.match(off.run('demoBanner()'),/그래프 데모 보기/);
  off.state.user.role='member';assert.equal(off.run('demoBanner()'),'');off.state.user.role='admin';off.state.data.demoAvailable=false;assert.equal(off.run('demoBanner()'),'');
});

test('demo action permissions retain graph exploration and reject editing or unrelated navigation',()=>{
  const f=fixture();
  for(const action of ['chart-mode','growth-metric','report-view','metric-focus','platform-focus','team-overview-select','team-overview-retry','range','move-range','comparison-more','channel-detail','member-filter','day','post-detail','close-modal','logout']){
    f.context.action=action;assert.equal(f.run('demoAllowsAction(action,{dataset:{}})'),true,action);
  }
  for(const tab of ['marketing','mine','team','all','overview','analysis','history'])for(const action of ['tab','marketing-section','command-tab']){
    f.context.target={dataset:{tab}};f.context.action=action;assert.equal(f.run('demoAllowsAction(action,target)'),true);
  }
  for(const tab of ['content','channels','messenger','members','settings']){f.context.target={dataset:{tab}};assert.equal(f.run("demoAllowsAction('tab',target)"),false);}
  for(const action of ['collect','collect-all','add-channel','connect','archive','invite','member-assignment','share-workspace','unknown']){
    f.context.action=action;assert.equal(f.run('demoAllowsAction(action,{dataset:{}})'),false,action);
  }
});

test('demo history preserves full-history query flags and lets read-only navigation reach its handler',()=>{
  const f=fixture('?demo=1&persona=crew-a');
  const url=new URL(f.run("demoApiUrl('/api/analytics?history=1&scope=team&teamId=demo-team&start=2026-09-30&end=2026-09-30')"),f.location);
  assert.equal(url.pathname,'/api/demo/analytics');assert.equal(url.searchParams.get('history'),'1');assert.equal(url.searchParams.get('scope'),'team');assert.equal(url.searchParams.get('teamId'),'demo-team');assert.equal(url.searchParams.get('end'),'2026-09-30');assert.equal(url.searchParams.get('persona'),'crew-a');
  const reached=[];f.handlers.push({type:'click',capture:false,handler:event=>reached.push(event.target.dataset)});
  for(const [action,extra]of[['report-view',{view:'history'}],['tab',{tab:'history'}],['marketing-section',{tab:'history'}],['command-tab',{tab:'history'}]]){
    const event=f.dispatch('click',f.target(action,extra));assert.equal(event.defaultPrevented,false);assert.equal(event.stopped,false);
  }
  assert.equal(reached.length,4);assert.equal(f.notifications.length,0);
  const edit=f.dispatch('click',f.target('collect'));assert.equal(edit.stopped,true);assert.equal(reached.length,4,'history exploration does not authorize a data mutation');
});

test('capture-phase gating stops actual edit handlers and synthetic external links but leaves chart clicks alone',()=>{
  const f=fixture();let actions=0;f.handlers.push({type:'click',capture:false,handler(){actions++;}});
  const denied=f.dispatch('click',f.target('collect'));assert.equal(denied.defaultPrevented,true);assert.equal(denied.stopped,true);assert.equal(actions,0);assert.equal(f.notifications.length,1);
  const allowed=f.dispatch('click',f.target('day'));assert.equal(allowed.defaultPrevented,false);assert.equal(actions,1);
  const external={href:'https://example.test/synthetic',closest(selector){return selector==='a[href]'?this:null;}};
  assert.equal(f.dispatch('click',external).defaultPrevented,true);assert.equal(actions,1);
  const local={href:'http://localhost:4191/?tab=overview',closest(selector){return selector==='a[href]'?this:null;}};
  assert.equal(f.dispatch('click',local).defaultPrevented,false);assert.equal(actions,2);
});

test('the demo summary uses the visible scope counts and escapes the displayed date range',()=>{
  const f=fixture();f.context.scopedChannels=()=>[{},{}];f.state.report={byPost:[{},{},{}]};f.state.start='<start>';f.state.end='"end"';
  const html=f.run('demoDataSummary()');assert.match(html,/현재 범위 채널<\/dt><dd>2개/);assert.match(html,/콘텐츠<\/dt><dd>3개/);
  assert.match(html,/&lt;start&gt;/);assert.match(html,/&quot;end&quot;/);assert.doesNotMatch(html,/<start>/);
});

test('the actual app API wrapper sends demo headers only to demo endpoints and cannot fetch a blocked mutation',async()=>{
  const f=fixture();const requests=[];
  f.context.fetch=async(path,options)=>{requests.push({path,options});return{ok:true,json:async()=>({ok:true})};};
  f.state.csrf='synthetic-csrf';
  f.run(appSource.slice(appSource.indexOf('async function api('),appSource.indexOf('function notify(')));
  await f.run("api('/api/analytics?scope=mine')");
  assert.equal(new URL(requests[0].path,'http://localhost').pathname,'/api/demo/analytics');assert.equal(requests[0].options.headers['X-Synk-Demo'],'1');
  for(const path of ['/api/me','/api/login','/api/logout','/api/launch']){
    f.context.authPath=path;await f.run("api(authPath,authPath==='/api/me'?undefined:{value:'synthetic'})");
    const sent=requests.at(-1);assert.equal(sent.path,path);assert.equal(sent.options.headers['X-Synk-Demo'],undefined);
    if(path!=='/api/me'){assert.equal(sent.options.method,'POST');assert.equal(sent.options.headers['X-CSRF-Token'],'synthetic-csrf');}
  }
  const count=requests.length;await assert.rejects(f.run("api('/api/channels',{name:'should never be sent'})"),/실제 자료를 변경하지 않아요/);assert.equal(requests.length,count);
});
