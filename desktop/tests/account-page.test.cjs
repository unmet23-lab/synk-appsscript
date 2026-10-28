'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const loaded=import('../renderer/account-page.mjs');
const settle=async()=>{for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));};
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',SESSION='33333333-3333-4333-8333-333333333333',CURRENT='44444444-4444-4444-8444-444444444444';
const signedIn=(id=ID,generation=1,name='합성 회원')=>({status:'signed-in',signedIn:true,sessionGeneration:generation,account:{synk_user_id:id,display_name:name}});
const accountView=(overrides={})=>({ok:true,account:{synk_user_id:ID,status:'active',profile:{display_name:'합성 회원',locale:'ko',time_zone:'Asia/Seoul'},profile_revision:3,providers:['email']},
  memberships:[{kind:'learner',role:'student',student_code:'S-01'}],learning:{enabled:false,revision:2},capabilities:{learningSync:true},
  sessions:[{id:SESSION,product:'world',label:'',last_seen:'2026-10-21T00:12:00Z',current:false,revoked:false},{id:CURRENT,product:'platform',last_seen:'2026-10-22T05:00:00Z',current:true,revoked:false},{id:'55555555-5555-4555-8555-555555555555',product:'world',current:false,revoked:true}],
  dataRequests:[],...overrides});
const identity=(overrides={})=>({ok:true,accountId:ID,email:'member@synthetic.invalid',newEmail:null,createdAt:'2026-10-01T00:00:00Z',identities:[{provider:'email'}],...overrides});
function harness({auth=signedIn(),appIds=['world'],replies={}}={}){
  const calls=[],handlers={},dialogs=[],state={auth,appIds},hooks={back:0,signIn:0,signOut:0,workspace:0,changed:0},toasts=[];
  const doc={body:{append(node){dialogs.push(node);}},createElement(tag){const node={tagName:tag,className:'',innerHTML:'',listeners:{},setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(value){this.returnValue=value;this.open=false;this.listeners.close?.();},remove(){this.removed=true;},click(){this.clicked=true;}};return node;},activeElement:null};
  const root={innerHTML:'',ownerDocument:doc,addEventListener(type,fn){handlers[type]=fn;},contains:()=>true};
  const reply=(operation,params)=>{calls.push({operation,params});const value=replies[operation];return Promise.resolve(typeof value==='function'?value(params):value??{ok:true});};
  const bridge={accountRequest:reply,accountIdentity:()=>reply('identity'),authSecurity:()=>reply('authSecurity')};
  return {calls,handlers,dialogs,state,hooks,toasts,root,bridge,doc,replies,
    click:async(action,data={})=>{handlers.click({target:{closest:()=>({dataset:{accountAction:action,...data},disabled:false})}});await settle();},
    confirmNext:value=>{const last=dialogs.at(-1);last.returnValue=value;last.listeners.close();}};
}
async function mount(h,extra={}){const {mountAccountPage}=await loaded;return mountAccountPage(h.root,{bridge:h.bridge,getIdentity:()=>h.state.auth,getAppIds:()=>h.state.appIds,onBack:()=>h.hooks.back++,onSignIn:()=>h.hooks.signIn++,onSignOut:()=>h.hooks.signOut++,onWorkspace:()=>h.hooks.workspace++,onAccountChanged:()=>h.hooks.changed++,toast:text=>h.toasts.push(text),randomId:()=>'66666666-6666-4666-8666-666666666666',...extra});}

test('names follow the account server limits and a change keeps the saved language and time zone',async()=>{
  const {nameProblem,profileChange,NAME_MAX}=await loaded;
  assert.equal(nameProblem('  '),'이름을 넣어 주세요.');assert.equal(nameProblem('유호'),null);assert.equal(nameProblem('가'.repeat(NAME_MAX)),null);
  assert.match(nameProblem('가'.repeat(NAME_MAX+1)),/60자/);assert.match(nameProblem('😀'.repeat(31)),/60자/,'UTF-16 length is what the server counts');assert.match(nameProblem('a\u0007b'),/쓸 수 없는 글자/);
  assert.deepEqual(profileChange(accountView().account,'  새 이름  '),{profile:{display_name:'새 이름',locale:'ko',time_zone:'Asia/Seoul'},expected_profile_revision:3});
  assert.deepEqual(profileChange({profile:{},profile_revision:0},'이름'),{profile:{display_name:'이름'},expected_profile_revision:0});
  assert.throws(()=>profileChange({profile:{}},'이름'),{code:'PROFILE_REVISION_MISSING'});
});

test('the screen reads accountView and identity, never the library-resetting load, and shows what the member owns',async()=>{
  const h=harness({replies:{accountView:accountView(),identity:identity()}}),page=await mount(h);page.show();await settle();
  assert.deepEqual(h.calls.map(row=>row.operation).sort(),['accountView','identity','townRecords']);
  const html=h.root.innerHTML;
  for(const text of ['내 계정','합성 회원','member@synthetic.invalid','2026년 10월 1일','학생 · S-01','이메일·비밀번호','SYNK 플랫폼','이 PC','SYNK WORLD','모두 로그아웃','학습 기록 연결','내려받기','지우기 요청…','비밀번호 바꾸기','Google 연결하기'])assert.ok(html.includes(text),text);
  assert.ok(html.indexOf('이 PC')<html.indexOf('SYNK WORLD'),'this PC comes first');assert.equal((html.match(/data-session=/g)||[]).length,2,'ended sessions are not listed');
  assert.ok(!html.includes('연결된 서비스'),'Workspace note only for accounts with Workspace');assert.ok(html.includes('문의할 때 쓰는 계정 번호'));
});

test('a saved name merges the profile, reports conflicts and drops replies after an account switch',async()=>{
  const h=harness({replies:{accountView:accountView(),identity:identity(),updateProfile:{ok:false,error:{code:'PROFILE_CONFLICT'}}}}),page=await mount(h);page.show();await settle();
  await h.click('name-edit');assert.ok(h.root.innerHTML.includes('account-name-input'));
  h.handlers.input({target:{id:'account-name-input',value:'새 이름'}});h.handlers.submit({target:{dataset:{accountForm:'name'}},preventDefault(){}});await settle();
  assert.deepEqual(h.calls.find(row=>row.operation==='updateProfile').params,{profile:{display_name:'새 이름',locale:'ko',time_zone:'Asia/Seoul'},expected_profile_revision:3});
  assert.match(h.root.innerHTML,/다른 곳에서 먼저 이름을 바꿨어요/);assert.equal(h.calls.filter(row=>row.operation==='accountView').length,2,'a conflict reloads the account');
  h.replies.updateProfile={ok:true,account:{synk_user_id:ID}};h.handlers.submit({target:{dataset:{accountForm:'name'}},preventDefault(){}});await settle();
  assert.match(h.root.innerHTML,/이름을 바꿨어요/);assert.ok(!h.root.innerHTML.includes('account-name-input'));
  h.handlers.input({target:{id:'account-name-input',value:'   '}});await h.click('name-edit');h.handlers.input({target:{id:'account-name-input',value:'   '}});h.handlers.submit({target:{dataset:{accountForm:'name'}},preventDefault(){}});await settle();
  assert.match(h.root.innerHTML,/이름을 넣어 주세요/);
  let release;h.replies.accountView=()=>new Promise(resolve=>{release=()=>resolve(accountView({account:{...accountView().account,profile:{display_name:'옛 계정 이름'}}}));});
  await h.click('retry');h.state.auth=signedIn(OTHER,2,'다른 회원');page.authChanged();release();await settle();
  assert.ok(!h.root.innerHTML.includes('옛 계정 이름'),'a reply for the previous account never reaches the next one');
});

test('signed out, offline, Google-only and Workspace states read correctly',async()=>{
  const out=harness({auth:{status:'signed-out',signedIn:false,sessionGeneration:3}}),outPage=await mount(out);outPage.show();await settle();
  assert.match(out.root.innerHTML,/로그인하면 회원정보를 볼 수 있어요/);assert.equal(out.calls.length,0);await out.click('sign-in');assert.equal(out.hooks.signIn,1);
  const failed=harness({replies:{accountView:{ok:false,error:{code:'SERVICE_UNAVAILABLE',retryable:true}},identity:{ok:false,error:{code:'AUTH_SERVER_UNAVAILABLE',retryable:true}}}}),failedPage=await mount(failed);failedPage.show();await settle();
  assert.match(failed.root.innerHTML,/계정 정보를 불러오지 못했어요/);assert.match(failed.root.innerHTML,/다시 불러오기/);assert.match(failed.root.innerHTML,/로그인 이메일을 불러오지 못했어요/);
  const google=harness({appIds:['messenger'],replies:{accountView:accountView(),identity:identity({identities:[{provider:'google'}]})}}),googlePage=await mount(google);googlePage.show();await settle();
  assert.match(google.root.innerHTML,/비밀번호 만들기/);assert.ok(!google.root.innerHTML.includes('Google 연결하기'));
  assert.match(google.root.innerHTML,/작업실의 「설정 → 내 로그인 비밀번호」/);await google.click('workspace');assert.equal(google.hooks.workspace,1);
});

test('deletion is one confirmation away, keeps one request id on retry, and can be cancelled within its grace',async()=>{
  const h=harness({replies:{accountView:accountView(),identity:identity(),requestDeletion:{ok:false,error:{code:'SERVICE_UNAVAILABLE',retryable:true}}}}),page=await mount(h);page.show();await settle();
  const confirmAndSettle=async()=>{await h.click('delete-request');h.confirmNext('confirm');await settle();};
  await h.click('delete-request');h.confirmNext('cancel');await settle();assert.equal(h.calls.filter(row=>row.operation==='requestDeletion').length,0);
  await confirmAndSettle();await confirmAndSettle();
  const requests=h.calls.filter(row=>row.operation==='requestDeletion');assert.equal(requests.length,2);assert.equal(requests[0].params.request_id,requests[1].params.request_id);
  assert.match(h.dialogs[1].innerHTML,/7일 동안은/);assert.match(h.dialogs[1].innerHTML,/되돌릴 수 없어요/);
  h.replies.accountView=accountView({account:{...accountView().account,status:'deletion-requested'},dataRequests:[{request_id:'77777777-7777-4777-8777-777777777777',kind:'delete',status:'pending',due_at:'2026-10-29T18:17:00Z'}],learning:{enabled:false,revision:3}});
  h.replies.requestDeletion={ok:true,request:{due_at:'2026-10-29T18:17:00Z'}};await confirmAndSettle();
  assert.equal(h.hooks.changed,1);assert.match(h.root.innerHTML,/삭제 요청 취소/);assert.match(h.root.innerHTML,/삭제 요청됨/);assert.match(h.root.innerHTML,/계정 삭제를 요청해서 켤 수 없어요/);
  h.replies.cancelDeletion={ok:true};h.replies.accountView=accountView();await h.click('delete-cancel');
  assert.deepEqual(h.calls.find(row=>row.operation==='cancelDeletion').params,{request_id:'77777777-7777-4777-8777-777777777777'});assert.match(h.root.innerHTML,/삭제 요청을 취소했어요/);assert.equal(h.hooks.changed,2);
});

test('sessions, sign-out, browser security and learning use their own routes',async()=>{
  let clock=1000000;const h=harness({replies:{accountView:accountView(),identity:identity(),revokeSession:{ok:true},setLearning:{ok:true},revokeAll:{ok:true},authSecurity:{ok:true}}}),page=await mount(h,{now:()=>clock});page.show();await settle();
  await h.click('revoke',{session:SESSION});assert.deepEqual(h.calls.find(row=>row.operation==='revokeSession').params,{session_id:SESSION});assert.match(h.root.innerHTML,/그 기기의 로그인을 끝냈어요/);
  await h.click('sign-out');assert.equal(h.hooks.signOut,1);
  await h.click('learning');assert.deepEqual(h.calls.find(row=>row.operation==='setLearning').params,{enabled:true,expected_revision:2});
  await h.click('security');assert.equal(h.calls.filter(row=>row.operation==='authSecurity').length,1);assert.match(h.root.innerHTML,/새 비밀번호로 다시 로그인/);assert.equal(page.securityVisitedRecently(),true);
  h.state.auth={status:'signed-out',signedIn:false,sessionGeneration:2,error:{code:'AUTH_REQUIRED'}};page.authChanged();assert.match(h.root.innerHTML,/비밀번호를 바꿨다면 새 비밀번호로 다시 로그인/);
  clock+=31*60000;assert.equal(page.securityVisitedRecently(),false);
  h.state.auth=signedIn();page.authChanged();await settle();await h.click('revoke-all');h.confirmNext('confirm');await settle();
  assert.equal(h.calls.filter(row=>row.operation==='revokeAll').length,1);assert.deepEqual(h.toasts,['모든 SYNK 앱에서 로그아웃했어요.']);
  await h.click('back');assert.equal(h.hooks.back,1);
});

test('a confirmation left open while the account changes closes and never acts on the next account',async()=>{
  const h=harness({replies:{accountView:accountView(),identity:identity()}}),page=await mount(h);page.show();await settle();
  await h.click('delete-request');assert.equal(h.dialogs[0].open,true);
  h.state.auth=signedIn(OTHER,2,'다른 회원');page.authChanged();await settle();
  assert.equal(h.dialogs[0].open,false);assert.equal(h.calls.filter(row=>row.operation==='requestDeletion').length,0);
  await h.click('revoke-all');h.dialogs[1].returnValue='confirm';h.state.auth=signedIn(ID,3);page.authChanged();h.dialogs[1].listeners.close();await settle();
  assert.equal(h.calls.filter(row=>row.operation==='revokeAll').length,0,'a confirm that outlived its account is ignored');
});

test('no native bridge renders a pointer to the PC app or synk.im/id without requests',async()=>{
  const {renderAccountPage}=await loaded;
  assert.match(renderAccountPage({native:false,signedIn:false}),/PC 앱에서 볼 수 있어요/);
});

// SYNK TOWN's 「마을 기록」 (W6c): the card the town's records route sends, drawn under the records; only rights commands go out.
const townCard=(revision=5,extra={})=>({ok:true,scope:'synk-town-records',accountId:ID,records:{available:true,started:true,revision,sections:[
  {id:'known',title:'주민이 아는 나',empty:'주민이 기억하는, 같이 한 일이 아직 없어요.',rows:[{text:'찻집 주인 · 찻집 일 — 같이 했어요',action:{type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},label:'잊어 주세요'}}]},
  {id:'clear',title:'맞춤 기록 모두 비우기',lines:['요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요.'],actions:[{type:'MEMORY_CLEAR',payload:{},label:'비우기',confirm:'맞춤 기록을 모두 비울까요?'}]}],...extra}});
const pressTown=async(h,key)=>{h.handlers.click({target:{closest:selector=>selector==='[data-town]'?{dataset:{town:key},disabled:false}:null}});await settle();};
test('the town records card sits under the records as 05 TOWN, sends rights commands at its revision and asks once more before clearing',async()=>{
  const h=harness({replies:{accountView:accountView(),identity:identity(),townRecords:townCard(5),townRights:params=>townCard(6)}}),page=await mount(h);page.show();await settle();
  const html=h.root.innerHTML;
  assert.ok(html.includes('05 / TOWN')&&html.includes('마을 기록')&&html.includes('찻집 주인 · 찻집 일 — 같이 했어요'),'the card under the records');
  assert.ok(html.indexOf('04 / RECORDS')<html.indexOf('05 / TOWN')&&html.indexOf('05 / TOWN')<html.indexOf('06 / DELETE'),'the sections count on');
  await pressTown(h,'known.r0');
  const sent=h.calls.filter(row=>row.operation==='townRights');assert.equal(sent.length,1);
  assert.deepEqual({...sent[0].params,id:undefined},{id:undefined,type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},expectedRevision:5});
  assert.ok(h.root.innerHTML.includes('그 주민의 기억에서 뺐어요.'));
  // Clearing asks once more; cancelling sends nothing.
  await pressTown(h,'clear.a0');assert.equal(h.dialogs.length,1);h.confirmNext('cancel');await settle();
  assert.equal(h.calls.filter(row=>row.operation==='townRights').length,1,'cancelled: nothing sent');
  await pressTown(h,'clear.a0');h.confirmNext('confirm');await settle();
  const cleared=h.calls.filter(row=>row.operation==='townRights');assert.equal(cleared.length,2);assert.equal(cleared[1].params.type,'MEMORY_CLEAR');assert.equal(cleared[1].params.expectedRevision,6);
});
test('the town card: not entered yet, not ready, a stale revision reloads, a reply after an account switch is dropped',async()=>{
  const empty=harness({replies:{accountView:accountView(),identity:identity(),townRecords:{ok:true,scope:'synk-town-records',accountId:ID,records:{available:true,started:false}}}}),p1=await mount(empty);p1.show();await settle();
  assert.ok(empty.root.innerHTML.includes('싱크타운에 들어가면')&&!empty.root.innerHTML.includes('data-town='),'no buttons before the town');
  const off=harness({replies:{accountView:accountView(),identity:identity(),townRecords:{ok:true,scope:'synk-town-records',accountId:ID,records:{available:false}}}}),p2=await mount(off);p2.show();await settle();
  assert.ok(off.root.innerHTML.includes('마을 기록은 아직 쓸 수 없어요.'));
  let reads=0;const stale=harness({replies:{accountView:accountView(),identity:identity(),townRecords:()=>townCard(5+reads++),townRights:{ok:false,error:{code:'stale-command'}}}}),p3=await mount(stale);p3.show();await settle();
  await pressTown(stale,'known.r0');
  assert.equal(stale.calls.filter(row=>row.operation==='townRecords').length,2,'reloaded after the conflict');assert.ok(stale.root.innerHTML.includes('다른 곳에서 먼저 바뀌었어요.'));
  let release;const late=harness({replies:{accountView:accountView(),identity:identity(),townRecords:()=>new Promise(resolve=>{release=resolve;})}}),p4=await mount(late);p4.show();await settle();
  late.state.auth=signedIn(OTHER,2);p4.authChanged();release(townCard(5));await settle();
  assert.ok(!late.root.innerHTML.includes('찻집 주인 · 찻집 일'),'the other account never sees the town of the first');
});
test('the town card closes while a deletion request stands and reads again once it is cancelled',async()=>{
  const deleting=accountView({account:{...accountView().account,status:'deletion-requested'},dataRequests:[{request_id:'77777777-7777-4777-8777-777777777777',kind:'delete',status:'pending',due_at:'2026-10-29T18:17:00Z'}],learning:{enabled:false,revision:3}});
  let status='active';
  const h=harness({replies:{accountView:()=>status==='active'?accountView():deleting,identity:identity(),townRecords:()=>status==='active'?townCard(5):{ok:false,error:{code:'ACCOUNT_UNAVAILABLE'}},
    requestDeletion:{ok:true,request:{due_at:'2026-10-29T18:17:00Z'}},cancelDeletion:{ok:true}}}),page=await mount(h);page.show();await settle();
  assert.ok(h.root.innerHTML.includes('찻집 주인 · 찻집 일 — 같이 했어요'));
  status='deleting';await h.click('delete-request');h.confirmNext('confirm');await settle();
  assert.ok(h.root.innerHTML.includes('계정 삭제를 요청한 동안에는 마을 기록을 볼 수 없어요.')&&!h.root.innerHTML.includes('data-town="known.r0"'),'the card closes over the rows it showed');
  status='active';await h.click('delete-cancel');
  assert.ok(h.root.innerHTML.includes('찻집 주인 · 찻집 일 — 같이 했어요'),'cancelling opens the card again');
  assert.equal(h.calls.filter(row=>row.operation==='townRecords').length,3);
});
