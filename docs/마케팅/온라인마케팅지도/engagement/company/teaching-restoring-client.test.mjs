import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./public/teaching.js',import.meta.url),'utf8');

// 10-31 지어 싣는 교사 연결 묶음(public/teaching-host.js): 회사 이미지 안의 선택 시험이 그 바이트를 고정하고 실제로 돌려 본다. 그전에는 선택 시험이
// /teaching-host.js 200만 봐서 바이트가 바뀌어도 통과했다(사슬 27 도구 검수 Fable P2). 원천은 experiences/synk-account/src(messenger-teacher.mjs 진입),
// 짓는 도구는 tools/build-messenger-teaching.cjs이고, 원천에서 다시 지은 바이트와 같은지는 CI(npm run check:account-bundles)가 본다 — 이 시험은
// 원천이 없는 회사 이미지에서도 그 바이트를 지킨다. 원천을 고쳐 다시 지었으면 새 sha와 그 판을 여기에 더하고, 운영에서 내려간 판은 지운다.
const TEACHING_HOST_BUILDS=new Map([
  // master: 28dfe3234(공유 상태 안내)와 b4b28e17a(10-22 로그인 글)까지 든 원천으로 지은 판.
  ['81c825a4a5688b7ec642b23d022bdab921302f69eff8f7ae1db15929ba5566b2','master 28dfe3234'],
  // 회사 운영(사슬 27~): a85da04a6 원천에 28dfe3234 고침만 얹어 지은 판 — b4b28e17a 글은 10-31 현재 회사에 나가지 않았다.
  ['143eb4b84073d70b388bbe37e9913678cd6db28cac12aebbe9071e45f53fe395','운영 사슬 27'],
]);
function teachingHostBytes(){
  const raw=readFileSync(new URL('./public/teaching-host.js',import.meta.url)),text=raw.toString('latin1');
  // Windows autocrlf 작업본은 git의 LF 묶음을 줄마다 CRLF로 풀어 둔다 — 모든 줄끝이 CRLF인 그 꼴만 LF로 되돌려 잰다(섞인 줄끝·외톨이 CR은 그대로 재서 걸린다).
  return text.includes('\r')&&!/(?:^|[^\r])\n|\r(?!\n)/.test(text)?Buffer.from(text.replace(/\r\n/g,'\n'),'latin1'):raw;
}
test('the built teaching host bundle is one of the reviewed builds, byte for byte',()=>{
  const sha=createHash('sha256').update(teachingHostBytes()).digest('hex');
  assert.ok(TEACHING_HOST_BUILDS.has(sha),`public/teaching-host.js sha256 ${sha}는 검수한 판이 아니다 — 원천을 고쳐 다시 지은 것이면(node tools/check-account-bundles.js --build) 그 판을 검수하고 이 표에 더한다`);
});
test('the teaching host bundle runs the browser teacher bridge the company boundary wraps: same-origin teaching API, CSRF on writes, unknown requests refused offline',async()=>{
  // 잰 바이트 그대로 돌린다(묶음은 import가 없는 한 덩어리 ES 모듈이다).
  const host=await import('data:text/javascript;base64,'+teachingHostBytes().toString('base64'));
  assert.deepEqual(Object.keys(host).sort(),['createBrowserTeacherBridge','startTeacherClient']);assert.equal(typeof host.startTeacherClient,'function');
  const signedIn=id=>({status:200,body:{ok:true,configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:id},csrfToken:'csrf-1',sessionGeneration:4}});
  const replies={status:signedIn('teacher-a'),request:{status:200,body:{ok:true,classes:[]}}},calls=[],listeners=[];
  const fetcher=async(url,init)=>{calls.push([url,init]);const {status,body}=replies[url.slice('/api/teaching/'.length)];return {ok:status<400,status,json:async()=>body};};
  const windowObject={document:{hidden:false},addEventListener:(type,fn)=>listeners.push(['add',type,fn]),removeEventListener:(type,fn)=>listeners.push(['remove',type,fn])};
  const bridge=host.createBrowserTeacherBridge({fetcher,windowObject,navigate:()=>assert.fail('이 시험은 로그인 이동을 하지 않는다'),pollMs:60000});
  assert.deepEqual(await bridge.getEnvironment(),{clientId:'teacher',authProduct:'world',embedded:true,hostClientId:'messenger'});
  // 지원하지 않는 요청은 서버에 가지 않는다.
  for(const [kind,params]of [['classroom',{operation:'deleteClass'}],['profile',{operation:'classes'}]])assert.equal((await bridge.accountRequest(kind,params)).error.code,'INVALID_REQUEST',kind);
  assert.equal(calls.length,0);
  // 상태는 같은 출처 GET, 수업 요청은 상태가 준 CSRF를 단 POST다.
  assert.deepEqual(await bridge.authStatus(),{configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:'teacher-a'},sessionGeneration:1,canSignOut:true});
  assert.deepEqual(await bridge.accountRequest('classroom',{operation:'classes'}),{ok:true,classes:[]});
  const same={credentials:'same-origin',cache:'no-store',redirect:'error'};
  assert.deepEqual(calls,[['/api/teaching/status',{method:'GET',...same,headers:{}}],['/api/teaching/request',{method:'POST',...same,headers:{'Content-Type':'application/json','X-CSRF-Token':'csrf-1'},body:'{"operation":"classes"}'}]]);
  replies.request={status:503,body:{ok:false,error:{code:'CLASSROOM_UNAVAILABLE',message:'잠시 뒤 다시 해 주세요.'}}};
  assert.deepEqual(await bridge.accountRequest('classroom',{operation:'workspace'}),{ok:false,error:{code:'CLASSROOM_UNAVAILABLE',message:'잠시 뒤 다시 해 주세요.',status:503,retryable:true}});
  // 회사 경계(teaching.js)가 이 실제 다리를 감싸면: 회사 로그인과 같은 SYNK ID는 지나가고, 다른 SYNK ID는 수업 요청 없이 막는다.
  const context=vm.createContext({state:{user:{id:'company-a'},synkUserId:'teacher-a'},window:{addEventListener(){}},bridge});
  vm.runInContext(source,context);const scoped=vm.runInContext('teachingBridgeForCompany(bridge,teachingOwner())',context);
  replies.request={status:200,body:{ok:true,overview:{students:2}}};calls.length=0;
  assert.deepEqual(await scoped.accountRequest('classroom',{operation:'teacherOverview'}),{ok:true,overview:{students:2}});
  assert.deepEqual(calls.map(([url])=>url),['/api/teaching/status','/api/teaching/request']);
  replies.status=signedIn('teacher-b');calls.length=0;
  const other=await scoped.accountRequest('classroom',{operation:'teacherOverview'});
  assert.equal(other.ok,false);assert.equal(other.error.code,'ACCOUNT_MISMATCH');assert.equal(other.error.status,401);
  assert.deepEqual(calls.map(([url])=>url),['/api/teaching/status']);
  // 닫으면 focus 듣기를 거두고, 그 뒤 요청은 서버에 가지 않는다.
  bridge.dispose();calls.length=0;
  assert.deepEqual(listeners.map(([kind,type])=>kind+' '+type),['add focus','remove focus']);assert.equal(listeners[0][2],listeners[1][2]);
  assert.equal((await bridge.accountRequest('classroom',{operation:'classes'})).error.message,'내 수업 연결이 끊겼어요. 다시 열어 주세요.');
  assert.equal(calls.length,0);
});
test('company teaching boundary suspends temporary verification while retaining terminal logout semantics',async()=>{
 let state={signedIn:false,status:'restoring',account:{synk_user_id:'teacher-a'},error:{code:'ACCOUNT_VERIFY_UNAVAILABLE',message:'retry',retryable:true}},requests=0;
 const bridge={authStatus:async()=>state,accountRequest:async()=>{requests++;return {ok:true};}};
 const context=vm.createContext({state:{user:{id:'company-a'},synkUserId:'teacher-a'},window:{addEventListener(){}},bridge});
 vm.runInContext(source,context);const scoped=vm.runInContext('teachingBridgeForCompany(bridge,teachingOwner())',context);
 let result=await scoped.accountRequest('classroom',{operation:'classes'});assert.equal(result.error.status,503);assert.equal(result.error.retryable,true);assert.equal(requests,0);
 state={signedIn:false,status:'signed-out'};result=await scoped.accountRequest('classroom',{operation:'classes'});assert.equal(result.error.status,401);assert.equal(result.error.retryable,false);
 state={signedIn:true,status:'signed-in',account:{synk_user_id:'other'}};result=await scoped.accountRequest('classroom',{operation:'classes'});assert.equal(result.error.code,'ACCOUNT_MISMATCH');assert.equal(result.error.status,401);assert.equal(requests,0);
 state={signedIn:true,status:'signed-in',account:{synk_user_id:'teacher-a'}};assert.equal((await scoped.accountRequest('classroom',{operation:'classes'})).ok,true);assert.equal(requests,1);
});
