import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/workroom.js',import.meta.url),'utf8');
function fixture({url='http://localhost:4191/?tab=workroom'}={}){
  const requests=[],storage=new Map(),handlers=new Map(),notifications=[],navigation=[],timers=new Map();let timerId=0;
  let renders=0;
  const context=vm.createContext({
    console,URL,URLSearchParams,location:new URL(url),Set,JSON,Promise,Intl,Date,
    state:{user:{id:'A',role:'member',name:'크루'},tab:'workroom',data:{channels:[]},modalRequest:0},
    document:{visibilityState:'visible',addEventListener(type,handler){handlers.set(type,handler);},querySelector(){return null;}},
    setTimeout(callback){const id=++timerId;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
    FormData:class{constructor(form){this.values=form.values;}has(key){return Boolean(this.values[key]);}get(key){return this.values[key]??null;}getAll(key){return this.values[key]||[];}},
    window:{scrollTo(){}},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    api(path,body){let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return pending;},
    render(){renders++;},notify:message=>notifications.push(message),
    escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    safeUrl:value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'#';}catch{return '#';}},
    icon:()=>'',button:label=>label,pageHeading:()=>'',platformMark:()=>'',platformLabel:value=>value,channelName:row=>row.displayName,
    isViewer:()=>context.state.user?.role==='viewer',isAdmin:()=>context.state.user?.role==='admin',
    cp:{error:'',data:{benchmark:{current:null}},input:{},draftId:'old',activeDraft:{id:'old'},results:{old:true}},
    cpBlank:()=>({seriesId:'default'}),cpSeries:()=>null,
    makerTools:{view:'publish'},makerToolsReset(){context.makerTools.view='publish';},
    async loadContentWorkspace(){},async cpNavigate(view){navigation.push(view);}
  });
  vm.runInContext(readFileSync(new URL('./public/benchmark.js',import.meta.url),'utf8'),context,{filename:'benchmark.js'});
  vm.runInContext(source,context,{filename:'workroom.js'});
  const evaluate=text=>vm.runInContext(text,context),wr=evaluate('wr');evaluate('wrIdentity()');
  return{context,requests,storage,handlers,notifications,navigation,timers,evaluate,wr,get renders(){return renders;}};
}

test('a disabled legacy collector never advertises a next run and explains the separate Gemini guide feed',()=>{
  const f=fixture();
  f.wr.daily={today:'2026-10-11',date:'2026-10-11',settings:{enabled:true},schedulerEnabled:false,nextRunAt:'2026-10-11T20:00:00.000Z',snapshot:null};
  const html=f.evaluate('wrTrends()');
  assert.match(html,/출처별 일일 트렌드/);
  assert.match(html,/이 출처 수집의 자동 실행은 꺼져 있습니다/);
  assert.match(html,/문서 자동 반영은 별도로 동작/);
  assert.doesNotMatch(html,/다음 수집|다음 수집을 기다려/);
  f.wr.daily.schedulerEnabled=true;
  assert.match(f.evaluate('wrTrends()'),/다음 수집/);
});

test('fresh workroom identities restore the requested production tool from the current URL',()=>{
  for(const tool of ['publish','subtitles','sources']){
    const f=fixture({url:`http://localhost:4191/?tab=workroom&section=tools&tool=${tool}`});
    assert.equal(f.wr.view,'tools');assert.equal(f.context.makerTools.view,tool);
    f.context.makerTools.view='different-prior-tool';f.context.state.user={id:'B',role:'member'};f.evaluate('wrIdentity()');
    assert.equal(f.wr.userId,'B');assert.equal(f.wr.view,'tools');assert.equal(f.context.makerTools.view,tool);
  }
});

test('workroom URL parsing accepts known sections and rejects unknown sections or tools',()=>{
  for(const section of ['desk','trends','tools','pages']){const f=fixture({url:`http://localhost:4191/?tab=workroom&section=${section}`});assert.equal(f.wr.view,section);}
  const retiredSection=fixture({url:'http://localhost:4191/?tab=workroom&section=practice'});assert.equal(retiredSection.wr.view,'desk');
  const unknownSection=fixture({url:'http://localhost:4191/?tab=workroom&section=unknown&tool=subtitles'});assert.equal(unknownSection.wr.view,'desk');assert.equal(unknownSection.context.makerTools.view,'publish');
  const unknownTool=fixture({url:'http://localhost:4191/?tab=workroom&section=tools&tool=unknown'});assert.equal(unknownTool.wr.view,'tools');assert.equal(unknownTool.context.makerTools.view,'publish');
});

test('a content API failure preserves useful guide data and a retry updates the missing section',async()=>{
  const f=fixture(),pending=f.evaluate('loadWorkroom()');
  f.requests[0].resolve({tips:[{title:'현재 제작 기준'}]});f.requests[1].reject(new Error('회사 자료를 불러오지 못했어요'));await pending;
  assert.equal(f.wr.guide.tips[0].title,'현재 제작 기준');assert.equal(f.wr.content,null);assert.match(f.wr.error,/회사 자료/);assert.equal(f.wr.loading,false);
  const retry=f.evaluate('loadWorkroom()');f.requests[2].resolve({tips:[]});f.requests[3].resolve({references:[{ownerId:'A'}]});await retry;
  assert.equal(f.wr.content.references.length,1);assert.equal(f.wr.error,'');
});

for(const user of ['A','B'])test(`late guide responses do not restore data after logout and a fresh ${user} login`,async()=>{
  const f=fixture(),pending=f.evaluate('loadWorkroom()');
  f.context.state.user=null;f.evaluate('resetWorkroom({clearStorage:true})');f.context.state.user={id:user,role:'member'};f.evaluate('wrIdentity()');
  const before=f.renders;f.requests[0].resolve({private:'old guide'});f.requests[1].resolve({references:[{title:'old private reference'}]});await pending;
  assert.equal(f.wr.userId,user);assert.equal(f.wr.guide,null);assert.equal(f.wr.content,null);assert.equal(f.renders,before);
});

test('own-page filtering, safe links and viewer restrictions survive permissive channel metadata',()=>{
  const f=fixture();f.context.state.user.role='viewer';f.wr.platform='tiktok';
  f.context.state.data.channels=[
    {id:'own',ownerIds:['A'],platform:'instagram',displayName:'<img onerror="boom">',canonicalUrl:'javascript:boom',canConnect:true,canEdit:true},
    {id:'other',ownerIds:['B'],platform:'tiktok',displayName:'other private page',canonicalUrl:'https://www.tiktok.com/@other'},
    {id:'archived',ownerIds:['A'],platform:'instagram',displayName:'old page',active:false}
  ];
  const html=f.evaluate('wrPages()');assert.equal(f.wr.platform,'all');assert.ok(html.includes('&lt;img'));assert.ok(html.includes('href="#"'));
  assert.ok(!html.includes('other private page'));assert.ok(!html.includes('old page'));assert.ok(!html.includes('내 페이지 등록'));assert.ok(!html.includes('페이지 정보'));assert.ok(!html.includes('href="javascript:'));
});

test('new planning templates ignore legacy completed reviews across identities and always copy nine empty checks',async()=>{
  const f=fixture(),guide=JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8')),copied=[];
  f.context.navigator={clipboard:{async writeText(value){copied.push(value);}}};
  f.storage.set('synk-workroom:review:A',JSON.stringify(guide.review.map(row=>row.id)));
  f.storage.set('synk-workroom:review:B','["reason"]');
  f.storage.set('unrelated-session-draft','keep');
  f.evaluate('resetWorkroom(); wrIdentity()');f.wr.guide=guide;
  assert.equal(Object.hasOwn(f.wr,'checks'),false);assert.equal(f.storage.has('synk-workroom:review:A'),false);
  assert.equal(f.storage.has('synk-workroom:review:B'),true);
  f.handlers.get('change')({target:{dataset:{workroomCheck:'reason'},checked:true}});
  assert.equal(f.storage.has('synk-workroom:review:A'),false);
  await f.evaluate('wrCopy()');
  f.context.state.user={id:'B',role:'member'};f.evaluate('wrIdentity()');f.wr.guide=guide;
  await f.evaluate('wrCopy()');
  assert.equal(f.storage.has('synk-workroom:review:B'),false);assert.equal(f.storage.get('unrelated-session-draft'),'keep');
  for(const text of copied){assert.equal((text.match(/^- \[ \]/gm)||[]).length,9);assert.doesNotMatch(text,/- \[x\]/);for(const row of guide.review)assert.ok(text.includes('- [ ] '+row.label));}
});

test('clipboard fallback also provides a blank canonical review template without restoring old marks',async()=>{
  const f=fixture(),guide=JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8'));let fallback;
  f.context.navigator={clipboard:{async writeText(){throw new Error('clipboard unavailable');}}};
  f.context.modal=(title,description,html)=>{fallback={title,description,html};};
  f.storage.set('synk-workroom:review:A',JSON.stringify(guide.review.map(row=>row.id)));
  f.evaluate('resetWorkroom(); wrIdentity()');f.wr.guide=guide;
  await f.evaluate('wrCopy()');
  assert.equal((fallback.html.match(/- \[ \]/g)||[]).length,9);assert.doesNotMatch(fallback.html,/- \[x\]/);
  assert.match(fallback.html,/readonly/);assert.equal(fallback.title,'기획·검토 양식');assert.equal(f.requests.length,0);
});

test('a chosen template opens a fresh existing plan without generating or saving a draft',async()=>{
  const f=fixture();f.wr.series='story';f.wr.guide={series:[{id:'story'}]};await f.evaluate('wrOpenContent("plan")');
  assert.equal(f.context.cp.input.seriesId,'story');assert.equal(f.context.cp.draftId,'');assert.equal(f.context.cp.activeDraft,null);assert.equal(f.context.cp.results,null);
  assert.deepEqual(f.navigation,['plan']);assert.equal(f.requests.length,0);
  f.context.cp.error='최신 기획함을 다시 확인해 주세요';await assert.rejects(f.evaluate('wrOpenContent("plan")'),/최신 기획함/);assert.equal(f.navigation.length,1);
});

test('desk resumes only current-user non-archived plans in newest order and escapes saved titles',()=>{
  const f=fixture();f.context.cp.userId='A';f.context.cp.data={drafts:[
    {id:'old',ownerId:'A',status:'draft',title:'older',updatedAt:'2026-10-07T00:00:00Z'},
    {id:'foreign',ownerId:'B',status:'ready',title:'other account private plan',updatedAt:'2026-10-09T00:00:00Z'},
    {id:'archived',ownerId:'A',status:'archived',title:'archived plan',updatedAt:'2026-10-09T00:00:00Z'},
    {id:'new',ownerId:'A',status:'review',title:'<img onerror=boom>',updatedAt:'2026-10-08T00:00:00Z'}
  ]};f.wr.guide={...JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8')),series:[{id:'synkbrief-use',name:'활용',format:'영상',concept:'실제 결과 보여주기',audience:'제작자',materials:[],guardrails:[],angles:[]}]};
  assert.deepEqual(Array.from(f.evaluate('wrDeskDrafts().map(row=>row.id)')),['new','old']);
  const html=f.evaluate('wrDesk()');assert.ok(html.includes('&lt;img onerror=boom&gt;'));assert.ok(!html.includes('other account private plan'));assert.ok(!html.includes('archived plan'));
});

test('desk new-plan choice preserves unsaved input and stale confirmation cannot replace another account',async()=>{
  const f=fixture();f.context.cpBlank=()=>({seriesId:'default',topic:'',audience:''});Object.assign(f.context.cp,{userId:'A',draftId:'',results:null,input:{seriesId:'story',topic:'내가 쓰던 이야기',audience:'시청자'}});f.wr.guide={series:[{id:'story'}]};let modal;
  f.context.modal=(title,description,html)=>{f.context.state.modalRequest++;modal={title,description,html};};f.context.closeModal=()=>{};
  await f.evaluate('wrOpenContent("plan","story")');assert.equal(f.context.cp.input.topic,'내가 쓰던 이야기');assert.equal(f.navigation.length,0);assert.match(modal.html,/아직 저장하지 않은 입력/);
  await f.evaluate('wrResumePlan()');assert.equal(f.context.cp.input.topic,'내가 쓰던 이야기');assert.deepEqual(f.navigation,['plan']);
  f.context.state.user={id:'B',role:'member'};await f.evaluate('wrReplacePlan()');assert.equal(f.context.cp.input.topic,'내가 쓰던 이야기');assert.equal(f.navigation.length,1);
});

test('desk publish action selects the named check without retaining another production tool',()=>{
  const f=fixture();f.context.makerTools.view='quality';f.evaluate('wrOpenPublish()');assert.equal(f.wr.view,'tools');assert.equal(f.context.makerTools.view,'publish');
});

test('reference search results are not a working plan and an old selected title does not hide current input',()=>{
  const f=fixture();f.context.cpBlank=()=>({seriesId:'default',topic:'',audience:''});Object.assign(f.context.cp,{userId:'A',draftId:'',input:{seriesId:'default',topic:'',audience:''},results:{items:[{title:'검색 결과'}]},activeDraft:{id:'old',title:'이전 기획 제목'}});
  assert.equal(f.evaluate('wrWorkingPlan()'),false);f.context.cp.input.topic='지금 작성 중인 이야기';
  f.wr.guide={...JSON.parse(readFileSync(new URL('./workroom-guide.json',import.meta.url),'utf8')),series:[{id:'default',name:'활용',format:'영상',concept:'실제 결과',audience:'제작자',materials:[],guardrails:[],angles:[]}]};
  const html=f.evaluate('wrDesk()');assert.match(html,/지금 작성 중인 이야기/);assert.doesNotMatch(html,/이전 기획 제목/);
});

test('changed input dismisses its confirmation without replacing the newer work',async()=>{
  const f=fixture();f.context.cpBlank=()=>({seriesId:'default',topic:''});Object.assign(f.context.cp,{userId:'A',draftId:'',results:null,input:{seriesId:'default',topic:'처음 내용'}});let closed=0;
  f.context.modal=()=>{f.context.state.modalRequest++;};f.context.closeModal=()=>{closed++;f.context.state.modalRequest++;};
  f.evaluate('wrConfirmPlanChoice({seriesId:"default"})');f.context.cp.input.topic='새로 고친 내용';await f.evaluate('wrReplacePlan()');
  assert.equal(closed,1);assert.equal(f.wr.planChoice,null);assert.equal(f.context.cp.input.topic,'새로 고친 내용');assert.equal(f.navigation.length,0);assert.match(f.notifications[0],/다시 선택/);
});

test('viewer may confirm navigation to an existing own plan while new planning stays restricted',async()=>{
  const f=fixture();f.context.state.user.role='viewer';f.context.cpBlank=()=>({seriesId:'default',topic:''});Object.assign(f.context.cp,{userId:'A',draftId:'',results:null,input:{seriesId:'default',topic:'창에 적은 내용'},data:{drafts:[{id:'own',ownerId:'A',status:'draft'}]}});const links=[];
  f.context.modal=()=>{f.context.state.modalRequest++;};f.context.closeModal=()=>{f.context.state.modalRequest++;};f.context.navigateWorkspaceLink=async value=>links.push(value);
  await f.evaluate('wrOpenDeskDraft("own")');await f.evaluate('wrReplacePlan()');assert.deepEqual(links,['/#view=content&section=plan&draftId=own']);
});

test('resuming reports a failed content load while preserving the current input',async()=>{
  const f=fixture();f.context.cpBlank=()=>({seriesId:'default',topic:''});Object.assign(f.context.cp,{userId:'A',draftId:'',results:null,input:{seriesId:'default',topic:'계속 쓸 내용'},data:null});f.context.loadContentWorkspace=async()=>{f.context.cp.error='기획함 연결을 다시 확인해 주세요';};
  await assert.rejects(f.evaluate('wrResumePlan()'),/기획함 연결/);assert.equal(f.context.cp.input.topic,'계속 쓸 내용');assert.equal(f.navigation.length,0);
});

test('workroom observation dates keep KST and unknown reactions do not become zero',()=>{
  const f=fixture();f.context.number=value=>value==null?'—':String(value);
  f.wr.guide={trendLinks:[],trendNotes:[]};f.wr.content={references:[{ownerId:'A',title:'내 참고',url:'https://example.test/',checkedAt:'2026-09-30T15:01:00Z'}],benchmark:{current:{title:'공유 조사',researchedAt:'2026-09-30T15:00:00Z',items:[{id:'one',title:'예시',url:'https://example.test/',publishedAt:'2026-09-30',checkedAt:'2026-09-30T15:00:00Z',metrics:{likes:null,shares:0}}]}}};
  const html=f.evaluate('wrTrends()');assert.ok(html.includes('관찰 2026.10.01'));assert.ok(html.includes('게시 2026.09.30'));assert.ok(html.includes('조사 2026.10.01'));assert.ok(html.includes('좋아요 — · 공유 0 · 저장 —'));
});

function dailyData(date='2026-10-02'){
  return {today:'2026-10-02',date,dates:['2026-10-02','2026-10-01'],settings:{enabled:true,hourKst:6,minuteKst:0,regions:['KR','US','CN']},running:false,nextRunAt:'2026-10-02T21:00:00Z',snapshot:{date,collectedAt:date+'T00:00:00Z',sources:[
    {id:'google-kr',platform:'Google',region:'KR',label:'한국 Google 검색',status:'ok',count:2},
    {id:'google-us',platform:'Google',region:'US',label:'미국 Google 검색',status:'ok',count:1},
    {id:'baidu-cn',platform:'Baidu',region:'CN',label:'중국 Baidu',status:'ok',count:1},
    {id:'tiktok-kr',platform:'TikTok',region:'KR',label:'한국 TikTok',status:'needs_connection',count:0,message:'공식 연결이 필요합니다.'}
  ],items:[
    {id:'kr-two',sourceId:'google-kr',platform:'Google',region:'KR',title:'한국 두 번째',url:'https://example.test/two',rank:2,metric:{label:'검색량',value:0,display:'0'},collectedAt:date+'T00:00:00Z'},
    {id:'kr-one',sourceId:'google-kr',platform:'Google',region:'KR',title:'<img src=x onerror=boom>',url:'javascript:boom',rank:1,metric:{label:'검색량',value:null},collectedAt:date+'T00:00:00Z',related:[{title:'위험 링크',url:'javascript:boom'},{title:'관련 & 뉴스',url:'https://example.test/news',source:'공식 매체'}]},
    {id:'us-one',sourceId:'google-us',platform:'Google',region:'US',title:'미국 소식',url:'https://example.test/us',rank:1,collectedAt:date+'T00:00:00Z'},
    {id:'cn-one',sourceId:'baidu-cn',platform:'Baidu',region:'CN',title:'중국 소식',url:'https://example.test/cn',rank:1,collectedAt:date+'T00:00:00Z'},
    {id:'report',sourceId:'culture',platform:'youtube-culture',region:'GLOBAL',category:'analysis',title:'2025 공식 문화 분석',url:'https://example.test/report',publishedAt:'2025-12-01T00:00:00Z',rank:null,metric:null,collectedAt:date+'T00:00:00Z'}
  ]}};
}

test('daily trends render collected local items and honest connection states without external launcher cards or combined rankings',()=>{
  const f=fixture();f.wr.daily=dailyData();f.wr.dailyDate='2026-10-02';
  const html=f.evaluate('wrTrends()');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('위험 링크'));assert.ok(html.includes('관련 &amp; 뉴스'));
  assert.ok(html.indexOf('&lt;img')<html.indexOf('한국 두 번째'),'source rank must sort within its own source');assert.ok(html.includes('검색량 0'));assert.ok(html.includes('검색량 미확인'));
  assert.ok(html.includes('연결 필요'));assert.ok(html.includes('공식 연결이 필요합니다.'));assert.ok(html.includes('한국 TikTok'));assert.ok(html.includes('일부 출처 수집'));
  assert.ok(!html.includes('미국 소식'));assert.ok(!html.includes('중국 소식'));assert.ok(!html.includes('wr-trend-links'));assert.ok(html.includes('플랫폼끼리 합산한 전체 인기 순위가 아니며'));
  assert.ok(html.includes('공식 문화 분석 보고서'));assert.ok(html.includes('2025. 12. 1.'));assert.ok(!html.includes('출처 순위 null'));
});

test('country and platform filters retain missing connection states while preventing unrelated country items from appearing',()=>{
  const f=fixture();f.wr.daily=dailyData();f.wr.dailyDate='2026-10-02';f.wr.dailyRegion='CN';
  let html=f.evaluate('wrTrends()');assert.ok(html.includes('중국 소식'));assert.ok(!html.includes('한국 두 번째'));assert.ok(html.includes('Baidu'));
  f.wr.dailyRegion='KR';f.wr.dailyPlatform='tiktok';html=f.evaluate('wrTrends()');assert.ok(html.includes('표시할 수집 항목이 없어요'));assert.ok(html.includes('연결 필요'));assert.ok(!html.includes('한국 두 번째'));
});

test('a daily response from an older date cannot replace the latest chosen date or clear its loading state',async()=>{
  const f=fixture(),older=f.evaluate('wrLoadDaily("2026-10-01")'),latest=f.evaluate('wrLoadDaily("2026-10-02")');
  assert.equal(f.requests[0].path,'/api/daily-trends?date=2026-10-01');assert.equal(f.requests[1].path,'/api/daily-trends?date=2026-10-02');
  f.requests[0].resolve(dailyData('2026-10-01'));await older;assert.equal(f.wr.daily,null);assert.equal(f.wr.dailyLoading,true);assert.equal(f.wr.dailyDate,'2026-10-02');
  f.requests[1].resolve(dailyData());await latest;assert.equal(f.wr.daily.snapshot.date,'2026-10-02');assert.equal(f.wr.dailyLoading,false);
});

for(const user of ['A','B'])test(`late daily responses are ignored after logout and fresh ${user} login`,async()=>{
  const f=fixture(),pending=f.evaluate('wrLoadDaily()');f.context.state.user=null;f.evaluate('resetWorkroom()');f.context.state.user={id:user,role:'member'};f.evaluate('wrIdentity()');
  f.requests[0].resolve(dailyData());await pending;assert.equal(f.wr.userId,user);assert.equal(f.wr.daily,null);assert.equal(f.wr.dailyLoading,false);
});

test('only admins can collect; duplicate force clicks stay locked and refresh only after collection completes',async()=>{
  const f=fixture();await f.evaluate('wrCollectDaily()');assert.equal(f.requests.length,0);f.context.state.user.role='admin';f.wr.dailyDate='2026-10-02';
  const pending=f.evaluate('wrCollectDaily()');await f.evaluate('wrCollectDaily()');assert.equal(f.requests.length,1);assert.equal(f.wr.dailyCollecting,true);assert.equal(f.requests[0].path,'/api/daily-trends/collect');assert.equal(f.requests[0].body.force,true);
  f.requests[0].resolve({ok:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/api/daily-trends?date=2026-10-02');assert.equal(f.wr.dailyCollecting,true);
  f.requests[1].resolve(dailyData());await pending;assert.equal(f.wr.dailyCollecting,false);assert.equal(f.wr.daily.snapshot.date,'2026-10-02');
});

test('an old collection completion cannot fetch or repaint after a same-user session reset',async()=>{
  const f=fixture();f.context.state.user.role='admin';const pending=f.evaluate('wrCollectDaily()');f.evaluate('resetWorkroom()');f.evaluate('wrIdentity()');const before=f.renders;
  f.requests[0].resolve({ok:true});await pending;assert.equal(f.requests.length,1);assert.equal(f.renders,before);assert.equal(f.wr.dailyCollecting,false);
});

test('daily settings validate KST time and at least one supported country without silently inventing scope',()=>{
  const f=fixture(),payload=f.evaluate('wrDailySettingsPayload({enabled:true,hourKst:"6",minuteKst:"0",regions:["KR","US","CN","KR"]})');
  assert.equal(payload.hourKst,6);assert.equal(payload.minuteKst,0);assert.deepEqual(Array.from(payload.regions),['KR','US','CN']);
  for(const input of ['{hourKst:"",minuteKst:"0",regions:["KR"]}','{hourKst:24,minuteKst:0,regions:["KR"]}','{hourKst:6,minuteKst:60,regions:["KR"]}','{hourKst:6,minuteKst:0,regions:[]}','{hourKst:6,minuteKst:0,regions:["MN"]}'])assert.throws(()=>f.evaluate('wrDailySettingsPayload('+input+')'));
});

test('a collected trend prepares a local fresh plan with exact subject and provenance without generating or saving',async()=>{
  const f=fixture();f.wr.daily=dailyData();f.wr.dailyDate='2026-10-02';f.wr.daily.snapshot.items.find(row=>row.id==='kr-two').metric={label:'대략 검색량',display:'1,000+',value:1000};await f.evaluate('wrOpenDailyPlan("kr-two")');
  assert.equal(f.context.cp.input.topic,'한국 두 번째');assert.ok(f.context.cp.input.proof.includes('https://example.test/two'));assert.ok(f.context.cp.input.proof.includes('대략 검색량 1,000+'));assert.ok(f.context.cp.input.proof.includes('Google 검색 · 한국'));assert.equal(f.context.cp.draftId,'');assert.equal(f.context.cp.activeDraft,null);assert.deepEqual(f.navigation,['plan']);assert.equal(f.requests.length,0);
  f.context.state.user.role='viewer';await f.evaluate('wrOpenDailyPlan("kr-two")');assert.equal(f.navigation.length,1);
});

test('switching date while a trend plan is loading cannot navigate with the old item',async()=>{
  const f=fixture();f.wr.daily=dailyData();let release;f.context.loadContentWorkspace=()=>new Promise(resolve=>{release=resolve;});const pending=f.evaluate('wrOpenDailyPlan("kr-two")');f.wr.dailyRequest++;release();await pending;
  assert.equal(f.navigation.length,0);assert.equal(f.context.cp.draftId,'old');
});

test('daily feed remains readable when company guide is missing and never presents fallback data as today',()=>{
  const f=fixture();f.wr.view='trends';f.wr.guide=null;f.wr.daily=dailyData('2026-10-01');f.wr.dailyDate='2026-10-02';f.wr.dailyError='오늘 수집에 실패했어요.';
  const html=f.evaluate('contentWorkroomPage()');assert.ok(html.includes('출처별 일일 트렌드'));assert.ok(html.includes('이전 자료'));assert.ok(html.includes('선택한 날짜의 최신 결과가 아닙니다.'));assert.ok(html.includes('2026-10-01'));assert.ok(html.includes('오늘 수집에 실패했어요.'));assert.ok(!html.includes('제작 자료를 꺼내고'));
});

test('a long source shows ten rows once and exposes one twenty-more control with truthful totals',()=>{
  const f=fixture();f.wr.daily=dailyData();f.wr.dailyRegion='CN';f.wr.dailyDate='2026-10-02';f.wr.daily.snapshot.items=Array.from({length:50},(_,index)=>({id:'cn-'+index,sourceId:'baidu-cn',platform:'baidu',region:'CN',title:'테스트 순위 '+(index+1),url:'https://example.test/'+index,rank:index+1,collectedAt:'2026-10-02T00:00:00Z'}));
  let html=f.evaluate('wrTrends()');assert.equal((html.match(/class="wr-daily-item"/g)||[]).length,10);assert.ok(html.includes('수집 50개 · 표시 10개'));assert.equal((html.match(/20개 더 보기/g)||[]).length,1);
  f.wr.dailyLimits.set('baidu-cn',30);html=f.evaluate('wrTrends()');assert.equal((html.match(/class="wr-daily-item"/g)||[]).length,30);assert.ok(html.includes('수집 50개 · 표시 30개'));
  f.handlers.get('change')({target:{dataset:{action:'workroom-daily-platform'},value:'all'}});assert.equal(f.wr.dailyLimits.size,0);
});

test('unranked search interest and retained timestamps do not masquerade as fresh ranked entries',()=>{
  const f=fixture();f.wr.daily=dailyData();f.wr.dailyDate='2026-10-02';f.wr.daily.snapshot.items=f.wr.daily.snapshot.items.filter(row=>row.region==='KR').map(row=>({...row,rank:null,collectedAt:null,retainedAt:'2026-10-01T00:00:00Z'}));f.wr.daily.snapshot.sources[0].retainedAt='2026-10-01T00:00:00Z';
  const html=f.evaluate('wrTrends()');assert.ok(html.includes('검색 관심'));assert.ok(html.includes('data-unranked'));assert.ok(html.includes('이전 자료 · 이전 수집 2026. 10. 1.'));assert.ok(html.includes('보존 자료 · 이전 수집'));assert.ok(!html.includes('출처별 순위 ·'));
});

test('running native collection polls only the visible trends panel and stops after completion',async()=>{
  const f=fixture();f.wr.view='trends';const pending=f.evaluate('wrLoadDaily()'),first=dailyData();first.running=true;f.requests[0].resolve(first);await pending;assert.equal(f.timers.size,1);
  const [timer,callback]=[...f.timers][0];f.timers.delete(timer);callback();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests.length,2);assert.equal(f.wr.dailyPollFetching,true);
  f.requests[1].resolve(dailyData());await new Promise(resolve=>setImmediate(resolve));assert.equal(f.timers.size,0);assert.equal(f.wr.daily.running,false);assert.equal(f.wr.dailyPollFetching,false);
});

test('hiding or leaving the trends panel cancels an in-flight poll and prevents its late repaint',async()=>{
  const f=fixture();f.wr.view='trends';f.wr.daily=dailyData();const pending=f.evaluate('wrLoadDaily("2026-10-02",{poll:true})');const previous=f.wr.daily;
  f.context.document.visibilityState='hidden';f.handlers.get('visibilitychange')();const before=f.renders;f.requests[0].resolve(dailyData('2026-10-01'));await pending;
  assert.equal(f.wr.daily,previous);assert.equal(f.wr.dailyLoading,false);assert.equal(f.renders,before);assert.equal(f.timers.size,0);
});

test('stale active data and a changed KST day automatically refetch without converting a chosen historical date to today',async()=>{
  const f=fixture();f.wr.view='trends';f.wr.daily=dailyData();f.wr.dailyDate='2026-10-01';f.wr.dailyAttempted=true;f.wr.dailyFetchedAt=0;f.wr.dailyLoadedDay='1999-01-01';
  f.evaluate('wrEnsureDaily()');assert.equal(f.requests[0].path,'/api/daily-trends?date=2026-10-01');f.requests[0].resolve(dailyData('2026-10-01'));await new Promise(resolve=>setImmediate(resolve));
  f.wr.dailyDate=f.wr.daily.today;f.wr.dailyLoadedDay='1999-01-01';f.evaluate('wrEnsureDaily()');assert.equal(f.requests[1].path,'/api/daily-trends');f.requests[1].resolve(dailyData());await new Promise(resolve=>setImmediate(resolve));
});

function settingsForm(){const submit={disabled:false,isConnected:true},error={textContent:'',isConnected:true};return {values:{enabled:true,hourKst:'6',minuteKst:'0',regions:['KR','US','CN']},isConnected:true,querySelector:selector=>selector==='[type="submit"]'?submit:error,submit,error};}
test('admin settings save sends validated fields once and refreshes after success while preserving an unrelated newer modal',async()=>{
  const f=fixture();f.context.state.user.role='admin';f.context.closeModal=()=>{throw new Error('newer modal must remain open');};f.context.form=settingsForm();const pending=f.evaluate('wrSaveDailySettings(form)');await f.evaluate('wrSaveDailySettings(form)');assert.equal(f.requests.length,1);
  const body=f.requests[0].body;assert.equal(f.requests[0].path,'/api/daily-trends/settings');assert.equal(body.enabled,true);assert.equal(body.hourKst,6);assert.deepEqual(Array.from(body.regions),['KR','US','CN']);f.context.state.modalRequest++;
  f.requests[0].resolve({ok:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests[1].path,'/api/daily-trends');f.requests[1].resolve(dailyData());await pending;assert.equal(f.wr.dailySaving,false);assert.ok(f.notifications.includes('매일 수집 설정을 저장했어요.'));
});

test('settings responses cannot close or populate another user session',async()=>{
  const f=fixture();f.context.state.user.role='admin';f.context.form=settingsForm();f.context.closeModal=()=>{throw new Error('stale close');};const pending=f.evaluate('wrSaveDailySettings(form)');
  f.context.state.user={id:'B',role:'admin'};f.evaluate('wrIdentity()');f.requests[0].resolve({ok:true});await pending;assert.equal(f.requests.length,1);assert.equal(f.wr.daily,null);assert.equal(f.wr.dailySaving,false);assert.equal(f.notifications.length,0);
});
