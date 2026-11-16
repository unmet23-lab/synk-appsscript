import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/social-workspace.js',import.meta.url),'utf8');
const app=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
function fixture(){
  const requests=[];
  const context=vm.createContext({URL,Date,Intl,console,location:new URL('https://workspace.test/?tab=social'),state:{user:{id:'u',role:'admin'},tab:'social'},document:{addEventListener(){},querySelector(){return null;}},window:{addEventListener(){}},render(){}});
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  context.mutate=async(path,input)=>{requests.push({path,input:JSON.parse(JSON.stringify(input))});};
  run(`snswIdentity();snswMutate=mutate;socialWorkspaceState.data={canWrite:true,posts:[],jobs:[],channels:[{id:'ig',name:'회사 Instagram',platform:'instagram',canEdit:true,capability:{mode:'manual',canPublish:false,formats:['image','carousel','reel']}}],settings:{brands:[],channels:[]},provider:{mode:'direct',provider:'direct',configured:true,enabled:true,channels:[{channelId:'ig',supported:true,canConfigure:true,connected:false,enabled:false,reason:'게시 권한을 연결해 주세요.',connectUrl:'/api/oauth/instagram/start?channelId=ig&publishing=1'}]},connectionHealth:{provider:'direct',api:{state:'connected',message:'SNS 공식 API에 직접 연결해요.',checkedAt:null},canCheck:true,channels:[]},insights:{},campaigns:[],accounts:[]};`);
  return {context,run,requests};
}

test('direct settings require account consent and opt-in without a Postiz credential form or a fabricated connection badge',()=>{
  const f=fixture(),html=f.run('snswSettings()');
  assert.match(html,/발행 서비스를 따로 쓰지 않고/);
  assert.match(html,/Instagram 사진·캐러셀·Reels/);
  assert.match(html,/Facebook 페이지 글·링크·사진/);
  assert.match(html,/YouTube MP4 동영상·쇼츠/);
  assert.doesNotMatch(html,/name="apiKey"|name="baseUrl"|발행 서비스 연결 전|발행 서비스 연결됨/);
  assert.match(f.run('snswAccounts()'),/자동 게시 꺼짐/);
  assert.match(f.run('snswDirectSettings()'),/켜진 계정 0개/);
  assert.doesNotMatch(f.run('snswHealthPanel()'),/연결 확인<\/span>|성공한 검사 시각 미확인/);
});

test('account consent and publishing enable are separate and only writable supported rows can enable',async()=>{
  const f=fixture(),html=f.run('snswAccounts()');
  assert.match(html,/channelId=ig&amp;publishing=1/);
  assert.match(html,/권한 확인 후 자동 게시 켜기/);
  assert.doesNotMatch(html,/name="integrationId"/);
  assert.equal(f.requests.length,0);
  await f.run('snswAction("direct-connect","ig")');
  assert.deepEqual(f.requests,[{path:'provider/connect',input:{channelId:'ig'}}]);
  f.run('socialWorkspaceState.data.provider.channels[0].canConfigure=false');
  assert.doesNotMatch(f.run('snswAccounts()'),/data-sw-action="direct-connect"|publishing=1/);
  await f.run('snswAction("direct-connect","ig")');
  assert.equal(f.requests.length,1);
});

test('an enabled direct account offers publishing-only disable while unsupported channels remain manual',async()=>{
  const f=fixture();
  f.run('Object.assign(socialWorkspaceState.data.provider.channels[0],{enabled:true,connected:true})');
  const html=f.run('snswAccounts()');
  assert.match(html,/자동 게시 켜짐/);
  assert.match(html,/자동 게시 끄기/);
  assert.match(html,/댓글 연결은 유지/);
  assert.doesNotMatch(html,/data-sw-action="direct-connect"/);
  f.run('socialWorkspaceState.data.channels[0].platform="tiktok";socialWorkspaceState.data.provider.channels[0].supported=false');
  const unsupported=f.run('snswAccounts()');
  assert.match(unsupported,/앱에서 직접 마무리/);
  assert.doesNotMatch(unsupported,/data-sw-action="direct-connect"|publishing=1/);
});

test('direct OAuth links reject external origins, other accounts and wrong purposes',()=>{
  const f=fixture();
  for(const url of ['https://other.test/api/oauth/instagram/start?channelId=ig&publishing=1','/api/oauth/instagram/start?channelId=other&publishing=1','/api/oauth/instagram/start?channelId=ig&comments=1','javascript:alert(1)']){
    f.context.badUrl=url;f.run('socialWorkspaceState.data.provider.channels[0].connectUrl=badUrl');
    assert.doesNotMatch(f.run('snswDirectAccount(snswChannel("ig"))'),/<a class="btn"/);
  }
});

test('a channel-specific health check preserves the channel ID',async()=>{
  const f=fixture();await f.run('snswFourAction("health-provider","ig")');
  assert.deepEqual(f.requests,[{path:'provider/health',input:{channelId:'ig'}}]);
  assert.equal(f.run('socialWorkspaceState.forms.healthChecking'),undefined);
});

test('unknown direct publication hides the Postiz receipt form but keeps result actions and legacy mode',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.posts=[{id:"p",title:"게시물",canPublish:true,variants:[]}];socialWorkspaceState.data.jobs=[{id:"j",postId:"p",channelId:"ig",status:"unknown"}]');
  const direct=f.run('snswJobCard(socialWorkspaceState.data.jobs[0])');
  assert.doesNotMatch(direct,/접수 코드|data-sw-form="provider-job"/);
  assert.match(direct,/결과 확인 필요/);
  f.run('socialWorkspaceState.data.provider={configured:true,integrations:[]}');
  assert.match(f.run('snswJobCard(socialWorkspaceState.data.jobs[0])'),/접수 코드/);
});

test('publishing OAuth returns to account setup and clears only callback parameters',()=>{
  const start=app.indexOf('    const status = new URLSearchParams(location.search);');
  const end=app.indexOf("  } catch (err) { if(err.code==='SESSION_CHANGED')",start);
  const location=new URL('https://workspace.test/?connected=ig&connectionPurpose=publishing&keep=value');
  const selected=[],notices=[];
  const context=vm.createContext({URL,URLSearchParams,location,state:{},notify:text=>notices.push(text),selectWorkspaceView:(...args)=>selected.push(args),render(){},history:{replaceState(_state,_title,url){location.href=new URL(url,location).href;}}});
  const focused=[];context.snsSimpleFocus=id=>focused.push(id);
  vm.runInContext(app.slice(start,end),context);
  assert.deepEqual(selected,[['social','accounts']]);
  assert.match(notices[0],/자동 게시는 아직 꺼져 있어요/);
  assert.match(notices[0],/「권한 확인 후 자동 게시 켜기」를 눌러 주세요/,'안내 글은 계정 줄의 켜기 단추를 가리킨다(11-16)');
  assert.deepEqual(focused,['ig'],'돌아온 계정 줄을 계정 화면에서 펼쳐 보인다');
  assert.equal(location.searchParams.get('tab'),'social');
  assert.equal(location.searchParams.get('section'),'accounts');
  assert.equal(location.searchParams.get('keep'),'value');
  assert.equal(location.searchParams.has('connected'),false);
  assert.equal(location.searchParams.has('connectionPurpose'),false);
});

test('the channel connection modal offers publishing permission separately from comments',()=>{
  const modalSource=app.slice(app.indexOf('function connectModal('),app.indexOf('function providerModal('));
  for(const platform of ['instagram','facebook','youtube']){
    let html='';const context=vm.createContext({state:{data:{channels:[{id:'ig',platform}]}},autoSupported:()=>true,providerFor:()=>({configured:true}),capabilityFor:()=>({}),requirementText:()=>[],platformKey:v=>v,platformLabel:v=>v,channelName:()=>'',escape:String,statusBadge:()=>'',icon:()=>'',button:()=>'',isAdmin:()=>false,canEditChannel:()=>true,modal:(_title,_description,body)=>{html=body;}});
    vm.runInContext(modalSource+'\nconnectModal("ig");',context);
    assert.match(html,/channelId=ig&amp;publishing=1/);
    if(platform!=='youtube')assert.match(html,/channelId=ig&amp;comments=1/);
    assert.match(html,/권한만 연결해서는 예약 게시가 시작되지 않아요/);
    assert.match(html,/「권한 확인 후 자동 게시 켜기」/);
  }
});

// ── 간편판 계정 줄의 자동 게시 켜기 · 끄기(11-16) ──
// 계정 보기는 social-simple.js의 간편판으로 그려져 옛 카드(snswDirectAccount)의 단추가 보이지 않았다. @synklab.uz를 이을 때
// 개발자 도구로 snswMutate('provider/connect')를 직접 불러야 했다(현장 노트 · 브라우저_게시 「Business Suite에 없는 나라 인스타」 11-16 저녁).
const simpleSource=readFileSync(new URL('./public/social-simple.js',import.meta.url),'utf8');
const simpleAccounts=()=>[
  {channelId:'uz',platform:'instagram',handle:'@synklab.uz',name:'',brand:'LAB',country:true,publish:'안 켬',collect:'수집 안 함',posts30:0,views30:null,lastPost:null,fix:null,direct:{canConfigure:true,enabled:false,connected:false,ready:true,connectUrl:'/api/oauth/instagram/start?channelId=uz&publishing=1'}},
  {channelId:'yt',platform:'youtube',handle:'@synkkorean',name:'SYNK LAB',brand:'LAB',country:false,publish:'자동 게시',collect:'수집 중',posts30:3,views30:120,lastPost:'2026-11-15',fix:null,direct:{canConfigure:true,enabled:true,connected:true,ready:true,connectUrl:null}},
  {channelId:'tt',platform:'tiktok',handle:'@synklab.mm',name:'',brand:'LAB',country:true,publish:'앱에서 직접',collect:'수집 안 함',posts30:0,views30:null,lastPost:null,fix:null,direct:null},
  {channelId:'fb',platform:'facebook',handle:'synkworld',name:'SYNK',brand:'LAB',country:false,publish:'안 켬',collect:'수집 중',posts30:0,views30:null,lastPost:null,fix:null,direct:{canConfigure:false,enabled:false,connected:false,ready:false,connectUrl:'/api/oauth/facebook/start?channelId=fb&publishing=1'}},
];
function simpleFixture({role='admin'}={}){
  const requests=[],handlers=new Map(),f={requests,hold:null,fail:null,accounts:simpleAccounts()};
  const context=vm.createContext({URL,URLSearchParams,Date,Intl,console,location:new URL('https://workspace.test/?tab=social&section=accounts'),state:{user:{id:'u',role},tab:'social'},
    document:{addEventListener(kind,handler){const list=handlers.get(kind)||[];list.push(handler);handlers.set(kind,list);},querySelector(){return null;},querySelectorAll(){return [];}},window:{addEventListener(){}},render(){},
    api:async(path,body)=>{requests.push({path,body:body===undefined?undefined:JSON.parse(JSON.stringify(body))});if(path==='/api/social/simple')return {today:'2026-11-16',accounts:JSON.parse(JSON.stringify(f.accounts))};if(f.hold)await f.hold;if(f.fail)throw f.fail;return {channelId:body?.channelId};}});
  vm.runInContext(source,context);vm.runInContext(simpleSource,context);
  const run=code=>vm.runInContext(code,context);
  run("socialWorkspaceSetView('accounts');snsSimpleIdentity();");
  context.initialAccounts=JSON.parse(JSON.stringify(f.accounts));run("snsSimple.data={today:'2026-11-16',accounts:initialAccounts};snsSimple.attempted=true;snsSimple.attemptedAt=Date.now()");
  const click=(action,value)=>{const target={dataset:{ssAction:action,value},disabled:false};for(const handler of handlers.get('click')||[])handler({target:{closest:selector=>selector==='.sw-simple [data-ss-action]'?target:null}});};
  const row=id=>{const html=run('snsSimpleRender("accounts")'),start=html.indexOf(`data-ss-channel="${id}"`);assert.ok(start>0,'계정 줄 '+id);const next=html.indexOf('data-ss-channel="',start+20);return html.slice(start,next>0?next:undefined);};
  return Object.assign(f,{context,run,click,row,provider:()=>requests.filter(r=>r.path.startsWith('/api/social/provider/'))});
}
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};

test('the simple account row offers the old card enable and disable only to managers of supported accounts',()=>{
  const f=simpleFixture();
  const uz=f.row('uz');
  assert.match(uz,/data-ss-action="direct-connect" data-value="uz"[^>]*>권한 확인 후 자동 게시 켜기</);
  assert.match(uz,/게시 권한은 연결돼 있어요/);
  assert.doesNotMatch(uz,/publishing=1|direct-off|tab=channels/,'권한이 이미 확인된 계정에는 연결 링크를 두지 않는다');
  const yt=f.row('yt');
  assert.match(yt,/data-ss-action="direct-off" data-value="yt"[^>]*>자동 게시 끄기</);
  assert.match(yt,/ss-st green">.*자동 게시/);
  assert.doesNotMatch(yt,/direct-connect/);
  assert.doesNotMatch(f.row('tt'),/data-ss-action="direct-/,'직접 게시를 지원하지 않는 계정은 앱에서 마무리한다');
  assert.doesNotMatch(f.row('fb'),/data-ss-action="direct-|publishing=1/,'관리 권한이 없는 계정에는 단추를 두지 않는다');
  f.run("snsSimple.data.accounts[0].direct.ready=false");
  const notConnected=f.row('uz');
  assert.match(notConnected,/게시 권한을 연결한 뒤 자동 게시를 켜야/);
  assert.match(notConnected,/<a class="ss-link" href="\/api\/oauth\/instagram\/start\?channelId=uz&amp;publishing=1">게시 권한 연결<\/a>/);
  assert.match(notConnected,/권한 확인 후 자동 게시 켜기/);
  f.run("snsSimple.data.accounts[0].direct.connectUrl='https://other.test/api/oauth/instagram/start?channelId=uz&publishing=1'");
  const outside=f.row('uz');
  assert.doesNotMatch(outside,/other\.test/,'바깥 주소는 링크로 만들지 않는다');
  assert.match(outside,/href="\/\?tab=channels">플랫폼 앱 연결 준비 확인/,'연결 주소가 없으면 옛 카드처럼 채널 화면을 가리킨다');
  // 카본 끝 판 B2: 인자 경계 없이 「publishing=1」 글자만 보던 검사를 주소 풀이로 바꿨다.
  for(const bad of ['/api/oauth/instagram/start?channelId=uz&not_publishing=1','/api/oauth/instagram/start?channelId=uz&publishing=10','/api/oauth/instagram/start/x?publishing=1','//other.test/api/oauth/instagram/start?publishing=1']){
    f.context.badUrl=bad;f.run('snsSimple.data.accounts[0].direct.connectUrl=badUrl');assert.doesNotMatch(f.row('uz'),/publishing=1/,bad);
  }
  f.run("snsSimple.data.accounts[0].direct.connectUrl='/api/oauth/instagram/start?channelId=uz&publishing=1&x=\"y'");
  assert.match(f.row('uz'),/href="\/api\/oauth\/instagram\/start\?channelId=uz&amp;publishing=1&amp;x=%22y">게시 권한 연결/,'따옴표는 주소 안에서 풀린 채로만 남는다');
  f.run("Object.assign(snsSimple.data.accounts[1],{publish:'안 켬',direct:{canConfigure:true,enabled:true,connected:false,connectUrl:null}})");
  assert.match(f.row('yt'),/ss-st coral">.*권한 확인 필요.*자동 게시 끄기/,'켜 두었는데 권한이 끊긴 계정을 「안 켬」으로 보이지 않는다');
  const viewer=simpleFixture({role:'viewer'});
  for(const id of ['uz','yt'])assert.doesNotMatch(viewer.row(id),/data-ss-action="direct-/,'열람 계정은 켜고 끌 수 없다');
});

test('the row enable button calls provider/connect once, then rereads the simple view and shows the result in that row',async()=>{
  const f=simpleFixture();let release;f.hold=new Promise(resolve=>{release=resolve;});
  f.click('direct-connect','uz');f.click('direct-connect','uz');await settle();
  assert.deepEqual(f.provider(),[{path:'/api/social/provider/connect',body:{channelId:'uz'}}],'두 번 눌러도 한 번만 보낸다');
  assert.match(f.row('uz'),/권한 확인하는 중…/);assert.match(f.row('uz'),/ disabled/);
  f.accounts[0]={...f.accounts[0],publish:'자동 게시',direct:{...f.accounts[0].direct,enabled:true,connected:true}};
  release();await settle();
  assert.equal(f.requests.at(-1).path,'/api/social/simple','켠 뒤 간편판 자료를 다시 읽는다');
  const after=f.row('uz');
  assert.match(after,/게시 권한을 확인하고 이 계정의 자동 게시를 켰어요/);
  assert.match(after,/자동 게시 끄기/);assert.doesNotMatch(after,/direct-connect/);
  f.click('direct-connect','uz');await settle();
  assert.equal(f.provider().length,1,'이미 켠 계정은 켜기를 다시 보내지 않는다');
});

test('a failed enable keeps the account off and shows the server reason inside the row',async()=>{
  const f=simpleFixture();f.fail=Object.assign(new Error('게시 권한을 확인해 주세요.'),{status:409});
  f.click('direct-connect','uz');await settle();
  const uz=f.row('uz');
  assert.match(uz,/role="alert">게시 권한을 확인해 주세요\./);
  assert.match(uz,/권한 확인 후 자동 게시 켜기/);
  assert.equal(f.requests.filter(r=>r.path==='/api/social/simple').length,0,'실패하면 상태를 지어내지 않는다');
});

test('disabling asks once more inside the row and only then calls provider/disconnect',async()=>{
  const f=simpleFixture();
  f.click('direct-disconnect','yt');await settle();
  assert.equal(f.provider().length,0,'확인 없이 바로 끄지 않는다');
  f.click('direct-off','yt');await settle();
  assert.equal(f.provider().length,0);
  const confirm=f.row('yt');
  assert.match(confirm,/자동 게시를 끄면 승인된 예약이 이 계정에 자동으로 올라가지 않아요/);
  assert.match(confirm,/data-ss-action="direct-disconnect" data-value="yt">자동 게시 끄기</,'확인 줄에 실제로 끄는 단추가 그려진다(카본 끝 판 C1)');
  assert.match(confirm,/data-ss-action="direct-keep" data-value="yt"/);
  f.click('direct-keep','yt');assert.doesNotMatch(f.row('yt'),/자동 게시를 끄면/);
  f.click('direct-off','yt');f.accounts[1]={...f.accounts[1],publish:'안 켬',direct:{...f.accounts[1].direct,enabled:false}};
  f.click('direct-disconnect','yt');await settle();
  assert.deepEqual(f.provider(),[{path:'/api/social/provider/disconnect',body:{channelId:'yt'}}]);
  assert.match(f.row('yt'),/이 계정의 자동 게시를 껐어요/);
  assert.match(f.row('yt'),/권한 확인 후 자동 게시 켜기/);
});

test('returning from publishing consent opens the fold around that row, focuses its enable button and the highlight leaves with the screen',()=>{
  const f=simpleFixture();
  assert.doesNotMatch(f.run('snsSimpleRender("accounts")'),/is-focus/,'돌아오기 전에는 강조가 없다');
  f.run("snsSimpleFocus('uz')");
  f.run('snsSimpleRender("today")');
  assert.match(f.run('snsSimpleRender("accounts")'),/class="ss-acc is-focus" data-ss-channel="uz"/,'그 줄로 옮기기 전에 다른 화면이 먼저 그려져도 강조가 남는다(카본 끝 판 B1)');
  // 그린 뒤 ssFocusRow가 하는 일을 가짜 DOM으로 본다(카본 끝 판 C2): 그 줄의 접힘을 열고, 줄로 옮기고, 켜기 단추에 초점을 둔다.
  const seen={scrolled:0,focused:0},fold={open:false},button={focus(){seen.focused++;}};
  const rows=['yh','uz'].map(id=>({dataset:{ssChannel:id},closest:sel=>sel==='details'&&id==='uz'?fold:null,scrollIntoView(){if(id==='uz')seen.scrolled++;},querySelector:sel=>sel==='[data-ss-action="direct-connect"]'&&id==='uz'?button:null}));
  f.context.document.querySelectorAll=selector=>selector==='.sw-simple [data-ss-channel]'?rows:[];
  f.run('ssFocusRow()');
  assert.deepEqual([fold.open,seen.scrolled,seen.focused],[true,1,1]);
  assert.equal(f.run('snsSimple.direct.focus'),'','한 번만 옮긴다');
  f.run('ssFocusRow()');assert.equal(seen.scrolled,1);
  f.run('snsSimpleRender("today")');
  assert.doesNotMatch(f.run('snsSimpleRender("accounts")'),/is-focus/);
});

test('an enabled account whose binding went stale after a new consent offers the same enable again instead of a dead end (카본 끝 판 A1)',async()=>{
  const f=simpleFixture();
  const stale={canConfigure:true,enabled:true,connected:false,ready:true,connectUrl:null};
  f.run(`Object.assign(snsSimple.data.accounts[1],{publish:'안 켬',direct:${JSON.stringify(stale)}})`);
  const yt=f.row('yt');
  assert.match(yt,/ss-st coral">.*권한 확인 필요/);
  assert.match(yt,/계정 연결이 바뀌어 지금은 예약이 올라가지 않아요/);
  assert.match(yt,/data-ss-action="direct-connect" data-value="yt"[^>]*>권한 확인 후 자동 게시 켜기</);
  assert.match(yt,/data-ss-action="direct-off" data-value="yt"/,'끄기도 그대로 둔다');
  f.accounts[1]={...f.accounts[1],publish:'자동 게시',direct:{...stale,connected:true}};
  f.click('direct-connect','yt');await settle();
  assert.deepEqual(f.provider(),[{path:'/api/social/provider/connect',body:{channelId:'yt'}}]);
  assert.doesNotMatch(f.row('yt'),/계정 연결이 바뀌어/);
  f.run(`snsSimple.data.accounts[1].direct=${JSON.stringify({...stale,ready:false})}`);
  assert.doesNotMatch(f.row('yt'),/direct-connect/,'권한이 끊긴 계정(ready 거짓)은 권한을 다시 연결하는 길만 남긴다');
  f.click('direct-connect','yt');await settle();
  assert.equal(f.provider().length,1);
});

test('the simple server sends the direct publishing state only for supported accounts',async()=>{
  const {buildSocialSimple}=await import('./social-simple.mjs');
  const channels=[{id:'uz',platform:'instagram',handle:'synklab.uz',displayName:'SYNK LAB Uzbekistan',status:'success'},{id:'yt',platform:'youtube',handle:'synkkorean',displayName:'SYNK LAB',status:'success'},{id:'tt',platform:'tiktok',handle:'synklab.mm',displayName:'',status:'success'},{id:'re',platform:'instagram',handle:'yuhobuilds',displayName:'유호',status:'success'}];
  const providerRows=[{channelId:'uz',supported:true,canConfigure:true,enabled:false,connected:false,errorCode:'NOT_CONFIGURED',connectUrl:'/api/oauth/instagram/start?channelId=uz&publishing=1'},{channelId:'yt',supported:true,canConfigure:false,enabled:true,connected:true,errorCode:null,connectUrl:null},{channelId:'tt',supported:false,canConfigure:false,enabled:false,connected:false,connectUrl:null},{channelId:'re',supported:true,canConfigure:true,enabled:true,connected:false,errorCode:'SCOPES_REQUIRED',connectUrl:'https://other.test/api/oauth/instagram/start?channelId=re&publishing=1'}];
  const by=Object.fromEntries(buildSocialSimple({now:'2026-11-16T10:00:00.000Z',channels,providerRows}).accounts.map(a=>[a.channelId,a]));
  assert.deepEqual(by.uz.direct,{canConfigure:true,enabled:false,connected:false,ready:true,connectUrl:'/api/oauth/instagram/start?channelId=uz&publishing=1'},'켜기 전 메타 계정은 권한이 있어도 connected가 거짓이고 NOT_CONFIGURED만 남는다');
  assert.deepEqual(by.yt.direct,{canConfigure:false,enabled:true,connected:true,ready:true,connectUrl:null});
  assert.equal(by.tt.direct,null);
  assert.deepEqual(by.re.direct,{canConfigure:true,enabled:true,connected:false,ready:false,connectUrl:null},'바깥 주소는 보내지 않는다');
  assert.equal(by.re.fix.kind,'publish');
});

test('HTTP: a consented Instagram account reads ready in the simple view, and the row actions turn publishing on and off',async t=>{
  const [{createCompanyApp},{mkdtempSync,rmSync},{tmpdir},{join,dirname,resolve}]=await Promise.all([import('./server.mjs'),import('node:fs'),import('node:os'),import('node:path')]);
  const directory=mkdtempSync(join(tmpdir(),'synk-simple-direct-')),at='2026-11-16T11:00:00.000Z';
  const fakeFetch=async raw=>{const path=new URL(raw).pathname.replace(/^\/v[\d.]+\//,'');if(path==='me'||path==='100')return new Response(JSON.stringify({id:'101',user_id:'100',username:'synklab.uz'}),{status:200,headers:{'content-type':'application/json'}});throw Error('Unexpected mocked endpoint: '+path);};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'https://workspace.synk.im',schedule:false,clock:()=>at,socialProviderOptions:{fetchImpl:fakeFetch,wait:()=>Promise.resolve()},synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@simple-direct.test',name:'합성 관리자',role:'admin'}),viewer=app.store.createUser({email:'viewer@simple-direct.test',name:'합성 열람',role:'viewer',teamId:'a'});
  app.store.put('channels','uz',{id:'uz',platform:'instagram',handle:'synklab.uz',displayName:'SYNK LAB Uzbekistan',externalId:'100',ownerIds:[admin.id],teamId:'a',active:true,connectionVersion:1});
  app.store.setSecret('channel:uz',{accessToken:'private-synthetic-token',accountId:'100',appScopedId:'101',authType:'instagram-login',apiVersion:'v26.0',metaIdentityVersion:1,permissionsVerifiedAt:at,expiresAt:null,scope:'instagram_business_basic instagram_business_content_publish'});
  const tokens=new Map([admin,viewer].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'test-csrf'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  const api=async(user,path,input)=>{const r=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'test-csrf',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,data:await r.json()};};
  const row=async(user=admin)=>(await api(user,'/api/social/simple')).data.accounts.find(a=>a.channelId==='uz');
  let uz=await row();
  assert.deepEqual([uz.publish,uz.direct.enabled,uz.direct.connected,uz.direct.ready,uz.direct.canConfigure],['안 켬',false,false,true,true],'권한만 있는 계정은 켜기만 남았다고 읽힌다');
  assert.ok(!JSON.stringify(uz).includes('private-synthetic-token'));
  assert.equal((await row(viewer)).direct.canConfigure,false,'같은 팀 열람 계정은 줄을 보지만 켤 권한은 없다');
  assert.equal((await api(viewer,'/api/social/provider/connect',{channelId:'uz'})).status,403);
  assert.equal((await api(admin,'/api/social/provider/connect',{channelId:'uz'})).status,200);
  uz=await row();
  assert.deepEqual([uz.publish,uz.direct.enabled,uz.direct.connected,uz.fix],['자동 게시',true,true,null]);
  assert.equal((await api(admin,'/api/social/provider/disconnect',{channelId:'uz'})).status,200);
  uz=await row();
  assert.deepEqual([uz.publish,uz.direct.enabled,uz.direct.ready],['안 켬',false,true],'끈 뒤에도 권한은 그대로라 다시 켤 수 있다');
  // 켜 둔 계정이 OAuth를 다시 마치면 서버가 connectionVersion을 올려 연결 기록이 어긋난다(카본 끝 판 A1) — 같은 켜기로 다시 묶인다.
  assert.equal((await api(admin,'/api/social/provider/connect',{channelId:'uz'})).status,200);
  app.store.put('channels','uz',{...app.store.get('channels','uz'),connectionVersion:2});
  uz=await row();
  assert.deepEqual([uz.publish,uz.direct.enabled,uz.direct.connected,uz.direct.ready,uz.fix],['안 켬',true,false,true,null],'권한을 다시 연결해도 또 어긋나므로 「게시 권한 다시 연결」 안내를 내지 않는다');
  assert.equal((await api(admin,'/api/social/provider/connect',{channelId:'uz'})).status,200);
  uz=await row();
  assert.deepEqual([uz.publish,uz.direct.enabled,uz.direct.connected],['자동 게시',true,true]);
});
