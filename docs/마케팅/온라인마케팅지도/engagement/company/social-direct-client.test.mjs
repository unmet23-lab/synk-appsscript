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
  assert.match(html,/Postiz 구독 없이/);
  assert.match(html,/Instagram 사진·캐러셀·Reels/);
  assert.match(html,/Facebook 페이지 글·링크·사진/);
  assert.match(html,/YouTube MP4 동영상·쇼츠/);
  assert.doesNotMatch(html,/name="apiKey"|name="baseUrl"|Postiz 연결 필요|Postiz 연결 확인됨/);
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
  assert.doesNotMatch(direct,/Postiz 접수 ID|data-sw-form="provider-job"/);
  assert.match(direct,/결과 확인 필요/);
  f.run('socialWorkspaceState.data.provider={configured:true,integrations:[]}');
  assert.match(f.run('snswJobCard(socialWorkspaceState.data.jobs[0])'),/Postiz 접수 ID/);
});

test('publishing OAuth returns to account setup and clears only callback parameters',()=>{
  const start=app.indexOf('    const status = new URLSearchParams(location.search);');
  const end=app.indexOf("  } catch (err) { if(err.code==='SESSION_CHANGED')",start);
  const location=new URL('https://workspace.test/?connected=ig&connectionPurpose=publishing&keep=value');
  const selected=[],notices=[];
  const context=vm.createContext({URL,URLSearchParams,location,state:{},notify:text=>notices.push(text),selectWorkspaceView:(...args)=>selected.push(args),render(){},history:{replaceState(_state,_title,url){location.href=new URL(url,location).href;}}});
  vm.runInContext(app.slice(start,end),context);
  assert.deepEqual(selected,[['social','accounts']]);
  assert.match(notices[0],/자동 게시를 켜 주세요/);
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
    assert.match(html,/권한 동의만으로 예약 게시를 시작하지 않아요/);
  }
});
