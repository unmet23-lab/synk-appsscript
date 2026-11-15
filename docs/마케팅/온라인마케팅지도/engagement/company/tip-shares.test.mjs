import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createTipSharesService,tipRow,tipLink,TIP_SHARE_KINDS,TIP_SHARE_LIMITS} from './tip-shares.mjs';
import {createTipShareRoutes} from './tip-share-routes.mjs';

const ORIGIN='https://workspace.example.test';
function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-tips-')),store=new Store(directory);
  let now=Date.parse('2026-11-16T05:00:00.000Z');
  const service=createTipSharesService({store,clock:()=>new Date(now).toISOString()});
  const admin=store.createUser({email:'admin@example.test',name:'Admin',role:'admin'}),robot=store.createUser({email:'robot@example.test',name:'Automation',role:'admin'}),member=store.createUser({email:'member@example.test',name:'Member',role:'member'});
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  return {store,service,admin,robot,member,advance:ms=>{now+=ms;},iso:()=>new Date(now).toISOString()};
}
const row=(overrides={})=>({row:52,postId:'DfoqrQ7yf3k',sharedAt:'2026-11-16 10:12',url:'https://www.instagram.com/reel/DfoqrQ7yf3k/',summary:'포인트 색 하나로 사이트가 살아나는 전후',kind:'디자인 참고',target:'홈페이지',verdict:'시안',note:'채운 단추 하나에만 포인트 색',status:'새로',stage:'시안 나옴',stageNote:'',draft:{url:'https://claude.ai/artifact/abc'},...overrides});
// 자료는 자동화 계정(robot)이 올리고, 고르기는 사람 관리자(admin)가 한다.
const snapshot=(f,rows,results=[],generatedAt=f.iso())=>f.service.snapshot(f.robot,{version:1,generatedAt,rows,results});
const claim=f=>{f.advance(91000);return f.service.sync(f.robot,{version:1});};

test('row validation keeps only http(s) links, known values and bounded text',()=>{
  assert.deepEqual(tipRow(row()).draft,{url:'https://claude.ai/artifact/abc'});
  assert.equal(tipLink(''),'');
  for(const bad of ['javascript:alert(1)','data:text/html,x','ftp://example.test/x','https://user:pw@example.test/','not a url'])assert.throws(()=>tipLink(bad),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({status:'시험 중'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({stage:'시안 대기'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({stage:'시안 나옴',draft:null})),{code:'SYNK_TIP_INVALID'},'a shown draft needs a link');
  assert.throws(()=>tipRow(row({verdict:'기록',stage:'시안 차례',draft:null})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({stageNote:'두\n줄'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({verdict:'지금'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({summary:'가'.repeat(TIP_SHARE_LIMITS.summary+1)})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({target:'홈\n페이지'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({note:'a\u0007b'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({postId:'../x'})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({row:1})),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow({...row(),memo:'유호님 메모'}),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>tipRow(row({verdict:'기록',stage:'기록'})),{code:'SYNK_TIP_INVALID'},'only a 시안 row carries a draft');
  assert.deepEqual(tipRow(row({draft:{text:'.tmp/시안/포인트색.html'}})).draft,{text:'.tmp/시안/포인트색.html'});
  assert.throws(()=>tipRow(row({draft:{url:'https://a.test/',text:'x'}})),{code:'SYNK_TIP_INVALID'});
});

test('only admins read or write, and a member never sees ledger rows',t=>{
  const f=fixture(t);
  assert.throws(()=>f.service.workspace(f.member),{status:403,code:'SYNK_TIP_ADMIN'});
  assert.throws(()=>f.service.workspace(null),{status:401});
  assert.throws(()=>f.service.snapshot(f.member,{version:1,generatedAt:f.iso(),rows:[],results:[]}),{status:403});
  assert.throws(()=>f.service.sync(f.member,{version:1}),{status:403});
  assert.deepEqual(f.service.workspace(f.admin),{ready:false,generatedAt:null,receivedAt:null,canDecide:false,waiting:0,rows:[]});
});

test('snapshot stores rows newest first, counts decidable drafts and keeps the content when only the time changes',t=>{
  const f=fixture(t);
  const rows=[row({row:40,verdict:'기록',stage:'기록',draft:null,note:'가져올 것'}),row(),row({row:41,verdict:'기각',stage:'기각',draft:null,note:'이미 있는 기능'}),row({row:50,stage:'적용함'}),row({row:51,status:'적용 중',stage:'적용 중'}),row({row:53,draft:null,stage:'시안 만드는 중'}),row({row:54,draft:null,stage:'시안 차례'})];
  assert.deepEqual(snapshot(f,rows),{stored:true,changed:true,settled:0,open:0});
  const view=f.service.workspace(f.admin);
  assert.deepEqual(view.rows.map(r=>r.row),[54,53,52,51,50,41,40]);
  assert.deepEqual(view.rows.filter(r=>r.decidable).map(r=>r.row),[52]);
  assert.equal(view.waiting,1);
  f.advance(300000);
  assert.equal(snapshot(f,rows).changed,false);
  assert.equal(f.service.workspace(f.admin).receivedAt,f.iso());
});

test('an older snapshot never replaces a newer one, but its results still settle requests',t=>{
  const f=fixture(t);
  const early=f.iso();f.advance(60000);
  snapshot(f,[row()]);
  f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'});
  const [request]=claim(f).requests;
  const result=snapshot(f,[row({summary:'늦게 읽은 판'})],[{id:request.id,outcome:'applied',current:'적용 중'}],early);
  assert.deepEqual(result,{stored:false,changed:false,settled:1,open:0});
  assert.equal(f.service.workspace(f.admin).rows[0].summary,row().summary);
});

test('a decision needs a decidable row, the same post id and no open request',t=>{
  const f=fixture(t);
  assert.throws(()=>f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}),{status:409,code:'SYNK_TIP_ROW_CHANGED'});
  snapshot(f,[row(),row({row:51,status:'적용 중',stage:'적용 중'}),row({row:50,verdict:'기록',stage:'기록',draft:null})]);
  assert.throws(()=>f.service.decide(f.admin,{row:52,postId:'other',to:'적용 중'}),{status:409,code:'SYNK_TIP_ROW_CHANGED'});
  assert.throws(()=>f.service.decide(f.admin,{row:51,postId:'DfoqrQ7yf3k',to:'버림'}),{status:409,code:'SYNK_TIP_NOT_DECIDABLE'});
  assert.throws(()=>f.service.decide(f.admin,{row:50,postId:'DfoqrQ7yf3k',to:'버림'}),{status:409,code:'SYNK_TIP_NOT_DECIDABLE'});
  assert.throws(()=>f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용함'}),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'버림',extra:1}),{code:'SYNK_TIP_INVALID'});
  const view=f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'버림'});
  assert.deepEqual(view.rows.find(r=>r.row===52).pending,{to:'버림',requestedAt:f.iso(),claimed:false});
  assert.equal(view.waiting,0);
  assert.throws(()=>f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}),{status:409,code:'SYNK_TIP_ALREADY_DECIDED'});
});

test('undo works until the PC claims the request, and claimed requests come back until settled',t=>{
  const f=fixture(t);
  snapshot(f,[row()]);
  f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'});
  assert.equal(f.service.cancel(f.admin,{row:52,postId:'DfoqrQ7yf3k'}).rows[0].pending,null);
  assert.throws(()=>f.service.cancel(f.admin,{row:52,postId:'DfoqrQ7yf3k'}),{status:404,code:'SYNK_TIP_NO_REQUEST'});
  f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'});
  assert.deepEqual(f.service.sync(f.robot,{version:1}).requests,[],'a fresh request waits 90 seconds so it can still be undone');
  const first=claim(f);
  assert.deepEqual(first.requests.map(({row,postId,from,to})=>({row,postId,from,to})),[{row:52,postId:'DfoqrQ7yf3k',from:'새로',to:'적용 중'}]);
  assert.throws(()=>f.service.cancel(f.admin,{row:52,postId:'DfoqrQ7yf3k'}),{status:409,code:'SYNK_TIP_CLAIMED'});
  assert.equal(f.service.workspace(f.admin).rows[0].pending.claimed,true);
  // 앞 회차가 결과를 못 돌려주고 끝나면 다음 회차가 같은 요청을 다시 받는다.
  assert.deepEqual(f.service.sync(f.robot,{version:1}).requests.map(r=>r.id),first.requests.map(r=>r.id));
  assert.deepEqual(snapshot(f,[row({status:'적용 중',stage:'적용 중'})],[{id:first.requests[0].id,outcome:'applied',current:'적용 중'}]),{stored:true,changed:true,settled:1,open:0});
  const after=f.service.workspace(f.admin).rows[0];
  assert.equal(after.status,'적용 중');assert.equal(after.pending,null);assert.equal(after.decidable,false);
  assert.deepEqual(after.decision,{to:'적용 중',requestedAt:first.requests[0].requestedAt,outcome:'applied'});
});

test('requests on rows that left 새로 are cleared, unclaimed ones too, and rows missing from the snapshot keep theirs',t=>{
  const f=fixture(t);
  snapshot(f,[row(),row({row:60,postId:'A'}),row({row:61,postId:'B'})]);
  for(const [r,postId] of [[52,'DfoqrQ7yf3k'],[60,'A'],[61,'B']])f.service.decide(f.admin,{row:r,postId,to:'적용 중'});
  // 52행은 사람이 장부에서 버림으로 바꿨고, 60행은 판에서 빠졌고(새 줄이 늘어 300줄 밖으로 밀렸을 수 있다), 61행은 그대로다.
  const result=snapshot(f,[row({status:'버림',stage:'버림'}),row({row:61,postId:'B'})]);
  assert.equal(result.settled,1);assert.equal(result.open,2);
  assert.deepEqual(f.store.all(TIP_SHARE_KINDS.request).map(r=>r.row).sort(),[60,61]);
  assert.equal(f.store.get(TIP_SHARE_KINDS.decision,'52').outcome,'conflict');
  // 판 밖의 60행 요청도 PC가 가져가 장부에 쓰고, 그 결과로 정리된다.
  const claimed=claim(f);assert.deepEqual(claimed.requests.map(r=>r.row).sort(),[60,61]);
  const sixty=claimed.requests.find(r=>r.row===60);
  assert.equal(snapshot(f,[row({status:'버림',stage:'버림'}),row({row:61,postId:'B'})],[{id:sixty.id,outcome:'applied',current:'적용 중'}]).settled,1);
  assert.equal(f.store.get(TIP_SHARE_KINDS.decision,'60').outcome,'applied');
});

test('accounts kept in the earlier snapshot.pushers field stay blocked and move to the separate list',t=>{
  const f=fixture(t);
  snapshot(f,[row()]);
  // 앞 판 꼴: 목록이 스냅숏 안에 있고 따로 둔 목록은 없다.
  const old=f.store.get(TIP_SHARE_KINDS.snapshot,'snapshot');
  f.store.remove(TIP_SHARE_KINDS.snapshot,'pushers');f.store.put(TIP_SHARE_KINDS.snapshot,'snapshot',{...old,pushers:[f.robot.id]});
  assert.equal(f.service.workspace(f.robot).canDecide,false);
  assert.throws(()=>f.service.decide(f.robot,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}),{code:'SYNK_TIP_PUSHER'});
  // 다른 계정이 판을 올려 스냅숏의 옛 칸이 없어져도 robot은 계속 막힌다.
  const other=f.store.createUser({email:'other@example.test',name:'Other',role:'admin'});
  f.service.snapshot(other,{version:1,generatedAt:f.iso(),rows:[row()],results:[]});
  assert.equal(Object.hasOwn(f.store.get(TIP_SHARE_KINDS.snapshot,'snapshot'),'pushers'),false);
  assert.deepEqual(f.store.get(TIP_SHARE_KINDS.snapshot,'pushers').ids.sort(),[f.robot.id,other.id].sort());
  assert.throws(()=>f.service.decide(f.robot,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}),{code:'SYNK_TIP_PUSHER'});
  assert.equal(f.service.workspace(f.admin).canDecide,true);
});

test('the pushing account cannot undo a choice, and choices it made before enrolling are dropped',t=>{
  const f=fixture(t);
  snapshot(f,[row()]);
  f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'});
  assert.throws(()=>f.service.cancel(f.robot,{row:52,postId:'DfoqrQ7yf3k'}),{status:403,code:'SYNK_TIP_PUSHER'});
  assert.equal(f.store.all(TIP_SHARE_KINDS.request).length,1);
  f.service.cancel(f.admin,{row:52,postId:'DfoqrQ7yf3k'});
  // 아직 sync · snapshot을 부르지 않은 새 자동화 계정이 먼저 고르고, 90초 뒤 sync로 스스로 가져가려 한다.
  const fresh=f.store.createUser({email:'fresh-robot@example.test',name:'New automation',role:'admin'});
  f.service.decide(fresh,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'});
  f.advance(91000);
  assert.deepEqual(f.service.sync(fresh,{version:1}).requests,[],'its own earlier choice is not handed to it');
  assert.equal(f.store.all(TIP_SHARE_KINDS.request).length,0);
  assert.equal(f.service.workspace(f.admin).rows[0].decidable,true);
});

test('a request left on a moved row does not block the row that now has that number',t=>{
  const f=fixture(t);
  snapshot(f,[row()]);
  f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'버림'});
  // 장부에서 줄이 지워져 52행에 다른 게시물이 올라왔다. 옛 요청은 PC가 정리할 때까지 남는다.
  snapshot(f,[row({postId:'Other1'})]);
  assert.equal(f.store.all(TIP_SHARE_KINDS.request).length,1);
  const view=f.service.workspace(f.admin).rows[0];assert.equal(view.pending,null);assert.equal(view.decidable,true);
  assert.equal(f.service.decide(f.admin,{row:52,postId:'Other1',to:'적용 중'}).rows[0].pending.to,'적용 중');
});

test('a row without a post id is never decidable',t=>{
  const f=fixture(t);
  snapshot(f,[row({postId:''})]);
  const view=f.service.workspace(f.admin);
  assert.equal(view.rows[0].decidable,false);assert.equal(view.waiting,0);
  assert.throws(()=>f.service.decide(f.admin,{row:52,postId:'',to:'적용 중'}),{code:'SYNK_TIP_NOT_DECIDABLE'});
  assert.equal(f.store.all(TIP_SHARE_KINDS.request).length,0);
});

test('snapshot input rejects duplicates, future times, unknown results and oversized lists',t=>{
  const f=fixture(t);
  assert.throws(()=>snapshot(f,[row(),row()]),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>snapshot(f,[row()],[],new Date(Date.parse(f.iso())+10*60000).toISOString()),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>snapshot(f,[row()],[{id:'x',outcome:'applied'}]),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>snapshot(f,[row()],[{id:'00000000-0000-4000-8000-000000000000',outcome:'done'}]),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>snapshot(f,Array.from({length:TIP_SHARE_LIMITS.rows+1},(_,i)=>row({row:i+2}))),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>f.service.snapshot(f.admin,{version:2,generatedAt:f.iso(),rows:[],results:[]}),{code:'SYNK_TIP_INVALID'});
  assert.throws(()=>f.service.sync(f.robot,{}),{code:'SYNK_TIP_INVALID'});
  assert.deepEqual(snapshot(f,[row()],[{id:'00000000-0000-4000-8000-000000000000',outcome:'conflict',current:'버림'}]).settled,0,'unknown ids are ignored');
});

test('the account that pushes ledger rows can never approve a draft itself',t=>{
  const f=fixture(t);
  snapshot(f,[row()]);
  assert.equal(f.service.workspace(f.robot).canDecide,false);assert.equal(f.service.workspace(f.admin).canDecide,true);
  assert.throws(()=>f.service.decide(f.robot,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}),{status:403,code:'SYNK_TIP_PUSHER'});
  // 동기만 부른 계정도 같다(줄을 올리기 전에 요청을 가져가는 첫 단계).
  const other=f.store.createUser({email:'other@example.test',name:'Other',role:'admin'});
  f.service.sync(other,{version:1});
  assert.throws(()=>f.service.decide(other,{row:52,postId:'DfoqrQ7yf3k',to:'버림'}),{code:'SYNK_TIP_PUSHER'});
  assert.equal(f.service.decide(f.admin,{row:52,postId:'DfoqrQ7yf3k',to:'버림'}).rows[0].pending.to,'버림');
  // 다른 관리자 계정이 아무리 sync를 불러도 먼저 오른 계정이 목록에서 밀려나지 않는다. 자리가 차면 새 계정을 거절한다.
  for(let i=0;i<TIP_SHARE_LIMITS.pushers-2;i++)f.service.sync(f.store.createUser({email:`extra${i}@example.test`,name:'Extra',role:'admin'}),{version:1});
  assert.throws(()=>f.service.decide(f.robot,{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}),{code:'SYNK_TIP_PUSHER'});
  const late=f.store.createUser({email:'late@example.test',name:'Late',role:'admin'});
  assert.throws(()=>f.service.sync(late,{version:1}),{status:403,code:'SYNK_TIP_PUSHERS_FULL'});
  assert.throws(()=>f.service.snapshot(late,{version:1,generatedAt:f.iso(),rows:[row()],results:[]}),{status:403,code:'SYNK_TIP_PUSHERS_FULL'});
  assert.equal(f.service.workspace(f.robot).canDecide,false);assert.equal(f.service.workspace(f.admin).canDecide,true);
  assert.equal(f.service.sync(f.robot,{version:1}).requests.length,0,'an enrolled account still syncs once the list is full');
});

// 경로: 로그인 · 관리자 · 데모 · 쿼리 · 출처 · CSRF · 본문 뒤 세션 다시 보기
function routeHarness(t){
  const f=fixture(t);
  const sessions=new Map([['admin',{hash:'h-admin',user:f.admin,body:{csrfToken:'csrf-admin'}}],['member',{hash:'h-member',user:f.member,body:{csrfToken:'csrf-member'}}],['robot',{hash:'h-robot',user:f.robot,body:{csrfToken:'csrf-robot'}}]]);
  let revokeDuringBody=false;
  const session=req=>sessions.get(req.who)||null;
  const body=async req=>{if(revokeDuringBody)sessions.delete(req.who);return req.payload;};
  const sent=[];const send=(res,status,payload)=>{sent.push({status,payload});};
  const routes=createTipShareRoutes({service:f.service,body,send,session,origin:ORIGIN});
  const call=async({who='admin',method='GET',path='/api/tip-shares',search='',headers={},payload}={})=>{
    const res={headers:{},setHeader(k,v){this.headers[k]=v;}};
    const req={who,method,headers:{origin:ORIGIN,'x-csrf-token':sessions.get(who)?.body.csrfToken,...headers},payload};
    try{const handled=await routes(req,res,{url:new URL(path+search,ORIGIN),demoRequest:headers['x-synk-demo']==='1'});return {handled,...sent.at(-1),cache:res.headers['Cache-Control']};}
    catch(error){return {error};}
  };
  return {f,call,revoke:()=>{revokeDuringBody=true;}};
}

test('routes ask for an admin session and refuse demo, queries and wrong methods',async t=>{
  const {call}=routeHarness(t);
  assert.equal((await call({path:'/api/other'})).handled,false);
  assert.equal((await call({who:'nobody'})).error.status,401);
  assert.equal((await call({who:'member'})).error.status,403);
  assert.equal((await call({headers:{'x-synk-demo':'1'}})).error.code,'SYNK_TIP_DEMO');
  assert.equal((await call({search:'?limit=5'})).error.status,400);
  assert.equal((await call({method:'POST'})).error.status,405);
  assert.equal((await call({path:'/api/tip-shares/decision'})).error.status,405);
  assert.equal((await call({method:'POST',path:'/api/tip-shares/nope'})).error.status,404);
  const ok=await call();assert.equal(ok.status,200);assert.equal(ok.cache,'no-store');assert.equal(ok.payload.ready,false);
});

test('posts need the same origin and the session CSRF token, and a session lost while reading the body is refused',async t=>{
  const {f,call,revoke}=routeHarness(t);
  const payload={version:1,generatedAt:f.iso(),rows:[row()],results:[]};
  assert.equal((await call({method:'POST',path:'/api/tip-shares/snapshot',headers:{origin:'https://evil.example'},payload})).error.code,'SYNK_TIP_CSRF');
  assert.equal((await call({method:'POST',path:'/api/tip-shares/snapshot',headers:{'x-csrf-token':'wrong'},payload})).error.code,'SYNK_TIP_CSRF');
  const stored=await call({who:'robot',method:'POST',path:'/api/tip-shares/snapshot',payload});
  assert.equal(stored.status,200);assert.equal(stored.payload.stored,true);
  const decided=await call({method:'POST',path:'/api/tip-shares/decision',payload:{row:52,postId:'DfoqrQ7yf3k',to:'적용 중'}});
  assert.equal(decided.payload.rows[0].pending.to,'적용 중');
  revoke();
  assert.equal((await call({method:'POST',path:'/api/tip-shares/decision/cancel',payload:{row:52,postId:'DfoqrQ7yf3k'}})).error.status,401);
  assert.equal(f.store.all(TIP_SHARE_KINDS.request).length,1,'the request survives the refused undo');
  // 세션에 CSRF 토큰이 없으면 머리에 토큰을 빼도 같아지지 않는다.
  const bare=routeHarness(t);
  const noToken=createTipShareRoutes({service:bare.f.service,body:async req=>req.payload,send:()=>{},session:()=>({hash:'h',user:bare.f.admin,body:{}}),origin:ORIGIN});
  await assert.rejects(noToken({method:'POST',headers:{origin:ORIGIN},payload:{row:52,postId:'DfoqrQ7yf3k'}},{setHeader(){}},{url:new URL('/api/tip-shares/decision/cancel',ORIGIN)}),{code:'SYNK_TIP_CSRF'});
  const noOrigin=createTipShareRoutes({service:bare.f.service,body:async req=>req.payload,send:()=>{},session:()=>({hash:'h',user:bare.f.admin,body:{csrfToken:'c'}}),origin:undefined});
  await assert.rejects(noOrigin({method:'POST',headers:{'x-csrf-token':'c'},payload:{row:52,postId:'DfoqrQ7yf3k'}},{setHeader(){}},{url:new URL('/api/tip-shares/decision/cancel',ORIGIN)}),{code:'SYNK_TIP_CSRF'});
});
