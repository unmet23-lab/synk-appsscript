// Atlas 재설계 단계 4 ④ — 리허설 서버의 새 기록 길(rehearsal-trail.mjs)이 talk의 learning?view=trail과 같은 검사 · 같은 답을 내는가.
// 엔진은 패키지 원천(packages/atlas/src)과 진짜 지도 색인으로 연다 — 접기 · 요약은 talk가 쓰는 것과 같은 서버 접기다.
// talk 쪽 같은 뜻의 시험: SYNK-talk tests/atlas-trail-server.test.js(울타리 · gen · EVENT_CONFLICT ids · WRITES_DISABLED).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import os from 'node:os';
import path from 'node:path';
import {createRehearsalTrail,openRehearsalTrail} from '../rehearsal-trail.mjs';

const index=atlas.openMap({index:JSON.parse(fs.readFileSync(new URL('../../../packages/atlas/map/index.json',import.meta.url),'utf8'))}).foldIndex;
const T0=Date.parse('2026-11-12T00:00:00.000Z');
const GEN=/^[0-9]{13}\.[0-9a-z]{8}$/;
const HEADERS=new Headers({'x-synk-contract':'1','x-synk-product':'world'});
const A={id:'11111111-1111-4111-8111-111111111111'};

function setup(options={}){
 let now=T0;const warnings=[];
 const trail=createRehearsalTrail({atlas,index,now:()=>now,warn:message=>warnings.push(message),...options});
 const call=(path,{method='GET',query='',body,headers=HEADERS,account=A}={})=>trail.handle({account,path,method,query:new URLSearchParams(query),
  body:body===undefined?undefined:Buffer.from(typeof body==='string'?body:JSON.stringify(body)),headers});
 return {trail,call,warnings,tick:ms=>{now+=ms;}};
}
let n=0;
const stated=(revision=1,{unit='u-test',say='known',at=T0}={})=>{n+=1;return atlas.createEvent(atlas.EVENT_TYPES.stated,{unit,say},{id:atlas.eventId(at,n,'rehearse'),atMs:at,revision});};
const attempted=(presentationId,revision=1)=>{n+=1;return atlas.createEvent(atlas.EVENT_TYPES.attempted,{presentationId,attemptNo:1,verdict:'correct',errorTags:[]},
 {id:atlas.eventId(T0,n,'rehearse'),atMs:T0,revision});};

test('처음 계정의 GET — 판 울타리를 지나면 빈 요약(세대 표지 gen), 판이 다르거나 없으면 409 · 모르는 쿼리는 400',async()=>{
 const {call}=setup();
 const first=await call('trail',{query:'revision=1'});
 assert.equal(first.status,200);
 assert.equal(first.body.scope,'synk-atlas-trail');
 assert.equal(first.body.revision,1);
 assert.equal(first.body.serverTime,T0);
 assert.match(first.body.summary.gen,GEN);
 assert.equal(first.body.summary.full,true);
 assert.deepEqual(first.body.summary.lines,[]);
 for(const query of ['revision=2','','revision=','revision=01']){
  const reply=await call('trail',{query});
  assert.equal(reply.status,409,query);assert.equal(reply.body.error.code,'REVISION_CONFLICT');assert.equal(reply.body.revision,1);
 }
 assert.equal((await call('trail',{query:'revision=1&view=trail'})).body.error.code,'INVALID_QUERY');
 assert.equal((await call('trail',{query:'revision=1&revision=1'})).body.error.code,'INVALID_QUERY');
 // since는 판 묶음과 함께 — 비었거나 십진이 아니거나 판 묶음이 없으면 400.
 for(const query of ['revision=1&since=0','revision=1&edition=x&since=','revision=1&edition=x&since=-1','revision=1&edition=x&since=1&gen=zz'])
  assert.equal((await call('trail',{query})).body.error.code,'INVALID_SINCE',query);
});

test('POST — 받고 접어 요약을 싣는다, 같은 묶음 다시는 같은 차례, 바뀐 사건은 EVENT_CONFLICT · 다른 판 사건은 EVENT_REVISION(그 번호들)',async()=>{
 const {call}=setup();
 const one=stated(),two=stated(1,{unit:'u-other'});
 const reply=await call('trail',{method:'POST',body:{revision:1,events:[one,two]}});
 assert.equal(reply.status,200,JSON.stringify(reply.body));
 assert.deepEqual(reply.body.accepted.map(a=>a.id),[one.id,two.id]);
 assert.deepEqual(reply.body.accepted.map(a=>a.seq),[1,2]);
 assert.equal(reply.body.folded,true);
 assert.ok(reply.body.summary.lines.length>0,'본인 말이 줄로 접힌다');
 const again=await call('trail',{method:'POST',body:{revision:1,events:[one]}});
 assert.deepEqual(again.body.accepted,[{id:one.id,seq:1}],'같은 사건은 한 번만 들고 같은 차례를 돌려준다');
 const changed=await call('trail',{method:'POST',body:{revision:1,events:[{...one,say:'relearn'},stated()]}});
 assert.equal(changed.status,409);assert.equal(changed.body.error.code,'EVENT_CONFLICT');assert.deepEqual(changed.body.ids,[one.id]);
 const stale=stated(2);
 const wrong=await call('trail',{method:'POST',body:{revision:1,events:[stated(),stale]}});
 assert.equal(wrong.status,409);assert.equal(wrong.body.error.code,'EVENT_REVISION');assert.deepEqual(wrong.body.ids,[stale.id]);assert.equal(wrong.body.revision,1);
 // 꼴이 틀린 묶음 · 모르는 열쇠 · 빈 묶음 · 쿼리 · JSON이 아닌 본문
 assert.equal((await call('trail',{method:'POST',body:{revision:1,events:[]}})).body.error.code,'INVALID_EVENTS');
 assert.equal((await call('trail',{method:'POST',body:{revision:1,events:[{...stated(),say:'maybe'}]}})).body.error.code,'INVALID_EVENTS');
 assert.equal((await call('trail',{method:'POST',body:{revision:1,events:[stated()],extra:1}})).body.error.code,'INVALID_EVENTS');
 assert.equal((await call('trail',{method:'POST',query:'x=1',body:{revision:1,events:[stated()]}})).body.error.code,'INVALID_QUERY');
 assert.equal((await call('trail',{method:'POST',body:'{'})).body.error.code,'INVALID_JSON');
 assert.equal((await call('trail',{method:'POST',body:{revision:1,events:[stated()],since:{edition:['x'],seq:0}}})).body.error.code,'INVALID_SINCE');
});

test('since — 같은 판 묶음 · 같은 gen이면 달라진 줄만, gen이 다르거나 없으면 통째',async()=>{
 const {call}=setup();
 const reply=await call('trail',{method:'POST',body:{revision:1,events:[stated()]}});
 const {edition,lineSeq,gen}=reply.body.summary;
 const same=await call('trail',{query:`revision=1&edition=${encodeURIComponent(edition)}&since=${lineSeq}&gen=${gen}`});
 assert.equal(same.body.summary.full,false);assert.deepEqual(same.body.summary.lines,[]);
 const other=await call('trail',{query:`revision=1&edition=${encodeURIComponent(edition)}&since=${lineSeq}&gen=0000000000001.aaaaaaaa`});
 assert.equal(other.body.summary.full,true);assert.ok(other.body.summary.lines.length>0);
 const none=await call('trail',{query:`revision=1&edition=${encodeURIComponent(edition)}&since=${lineSeq}`});
 assert.equal(none.body.summary.full,true,'gen 없는 since는 gen 없는 머리하고만 같다');
 const posted=await call('trail',{method:'POST',body:{revision:1,events:[stated(1,{unit:'u-third'})],since:{edition,seq:lineSeq,gen}}});
 assert.equal(posted.body.summary.full,false);assert.ok(posted.body.summary.lines.every(line=>line.seq>lineSeq));
});

test('부모 없는 답은 EVENT_LINK로 빼고 나머지는 받는다(talk partitionLinks와 같다)',async()=>{
 const {call}=setup();
 const ok=stated(),orphan=attempted('a.0000000000001.0001.missing0');
 const reply=await call('trail',{method:'POST',body:{revision:1,events:[ok,orphan]}});
 assert.equal(reply.status,200);
 assert.deepEqual(reply.body.accepted.map(a=>a.id),[ok.id]);
 assert.deepEqual(reply.body.rejected,[orphan.id]);assert.equal(reply.body.rejectedCode,'EVENT_LINK');
});

test('손잡이 — 동의를 끄고 켜면 판이 오르고(403 LEARNING_DISABLED), 쓰기 문만 닫으면 POST만 WRITES_DISABLED, 스위치를 끄면 둘 다 FEATURE_DISABLED',async()=>{
 const {call}=setup();
 assert.deepEqual((await call('trail-account')).body,{ok:true,learning:{enabled:true,revision:1},capabilities:{learningSync:true}});
 let control=await call('trail-control',{method:'POST',body:{action:'consent',enabled:false}});
 assert.deepEqual(control.body.learning,{enabled:false,revision:2});
 const off=await call('trail',{query:'revision=2'});
 assert.equal(off.status,403);assert.equal(off.body.error.code,'LEARNING_DISABLED');assert.equal(off.body.revision,2);
 control=await call('trail-control',{method:'POST',body:{action:'consent',enabled:true}});
 assert.deepEqual(control.body.learning,{enabled:true,revision:3});
 await call('trail-control',{method:'POST',body:{action:'writes',enabled:false}});
 assert.equal((await call('trail',{query:'revision=3'})).status,200,'쓰기 문이 닫혀도 받기는 된다');
 const writes=await call('trail',{method:'POST',body:{revision:3,events:[stated(3)]}});
 assert.equal(writes.status,403);assert.equal(writes.body.error.code,'WRITES_DISABLED');
 assert.deepEqual((await call('trail-account')).body.capabilities,{learningSync:false});
 await call('trail-control',{method:'POST',body:{action:'writes',enabled:true}});
 await call('trail-control',{method:'POST',body:{action:'switch',enabled:false}});
 for(const request of [['trail',{query:'revision=3'}],['trail',{method:'POST',body:{revision:3,events:[stated(3)]}}],['trail-clear',{method:'POST',body:{revision:3}}]]){
  const reply=await call(...request);assert.equal(reply.status,403);assert.equal(reply.body.error.code,'FEATURE_DISABLED');
 }
 await call('trail-control',{method:'POST',body:{action:'switch',enabled:true}});
 control=await call('trail-control',{method:'POST',body:{action:'revision'}});
 assert.equal(control.body.learning.revision,4,'판만 올리기(다른 기기의 비우기 흉내)');
 for(const body of [{action:'consent'},{action:'switch',enabled:'no'},{action:'revision',enabled:true},{action:'nope',enabled:true}])
  assert.equal((await call('trail-control',{method:'POST',body})).body.error.code,'INVALID_ACTION',JSON.stringify(body));
 assert.equal((await call('trail-control')).status,405);
});

test('스위치 목록 — 합성 계정 이름이나 id로 적은 계정만 열린다, off는 모두 닫는다',async()=>{
 const keys={'player-a':A.id,'player-b':'22222222-2222-4222-8222-222222222222'};
 const listed=setup({trailSwitch:'player-a',keys});
 assert.equal((await listed.call('trail',{query:'revision=1'})).status,200);
 assert.equal((await listed.call('trail',{query:'revision=1',account:{id:keys['player-b']}})).body.error.code,'FEATURE_DISABLED');
 const off=setup({trailSwitch:'off',keys});
 assert.equal((await off.call('trail',{query:'revision=1'})).body.error.code,'FEATURE_DISABLED');
});

test('비우기 — 판이 오르고 기록이 비며, 다시 지은 머리는 새 gen이라 옛 since는 통째 답을 받는다',async()=>{
 const {call,tick}=setup();
 const first=await call('trail',{method:'POST',body:{revision:1,events:[stated(),stated(1,{unit:'u-other'})]}});
 const old=first.body.summary;
 assert.equal((await call('trail-clear',{method:'POST',body:{revision:2}})).body.error.code,'REVISION_CONFLICT');
 assert.equal((await call('trail-clear',{method:'POST',body:{revision:1,extra:true}})).body.error.code,'INVALID_ACTION');
 assert.equal((await call('trail-clear',{query:'revision=1'})).body.error.code,'INVALID_ACTION');
 tick(1000);
 const cleared=await call('trail-clear',{method:'POST',body:{revision:1}});
 assert.equal(cleared.status,200);
 assert.deepEqual(cleared.body,{ok:true,learning:{enabled:true,revision:2},revision:2,removed:2,kept:0});
 const after=await call('trail',{query:`revision=2&edition=${encodeURIComponent(old.edition)}&since=${old.lineSeq}&gen=${old.gen}`});
 assert.equal(after.status,200);
 assert.notEqual(after.body.summary.gen,old.gen);
 assert.equal(after.body.summary.full,true);assert.deepEqual(after.body.summary.lines,[]);
 // 바닥 아래(비운 사건)는 부모로 치지 않고, 같은 번호를 새 판으로 다시 보내도 받지 않는다(번호는 계정 안에서 하나) — 여기서는 비운 뒤라 새 사건.
 const again=await call('trail',{method:'POST',body:{revision:2,events:[stated(2)]}});
 assert.equal(again.status,200);assert.equal(again.body.accepted[0].seq,3,'차례는 비운 뒤에도 이어 센다');
});

test('입구 머리말 — 계약 판이 아니면 426, 제품이 world가 아니면 400, 다른 방법은 405, 모르는 길은 404',async()=>{
 const {call}=setup();
 assert.equal((await call('trail',{query:'revision=1',headers:new Headers({'x-synk-product':'world'})})).status,426);
 assert.equal((await call('trail',{query:'revision=1',headers:new Headers({'x-synk-contract':'1','x-synk-product':'messenger'})})).body.error.code,'PRODUCT_REQUIRED');
 assert.equal((await call('trail',{method:'PUT'})).status,405);
 assert.equal((await call('trail-account',{method:'POST',body:{}})).status,405);
 assert.equal((await call('trail-other')).status,404);
});

test('한 계정의 요청은 한 줄로(talk 계정 잠금) — 겹쳐 온 올리기도 하나씩 보낸 것과 같은 요약 · 같은 줄 차례',async()=>{
 const batches=Array.from({length:6},(_,i)=>[stated(1,{unit:`u-lane-${i}`}),stated(1,{unit:`u-lane-${i}b`})]);
 const together=setup();
 const replies=await Promise.all(batches.map(events=>together.call('trail',{method:'POST',body:{revision:1,events}})));
 assert.ok(replies.every(reply=>reply.status===200));
 const seqs=replies.flatMap(reply=>reply.body.accepted.map(a=>a.seq)).sort((a,b)=>a-b);
 assert.deepEqual(seqs,Array.from({length:12},(_,i)=>i+1));
 const one=setup();
 for(const events of batches)await one.call('trail',{method:'POST',body:{revision:1,events}});
 const shape=({gen,...summary})=>summary;
 const [a,b]=await Promise.all([together,one].map(side=>side.call('trail',{query:'revision=1'})));
 assert.equal(a.body.summary.foldedUntil,12);
 // 잠금이 없으면 여섯 접기가 같은 사건을 겹쳐 접어 줄 차례(lineSeq)가 부풀고 머리가 섞인다.
 assert.deepEqual(shape(a.body.summary),shape(b.body.summary));
});

test('판이 오른 뒤 같은 번호를 새 판으로 다시 찍어 보내면 EVENT_CONFLICT(그 번호) — 옛 사건은 그대로',async()=>{
 const {call}=setup();
 const one=stated();
 await call('trail',{method:'POST',body:{revision:1,events:[one]}});
 await call('trail-control',{method:'POST',body:{action:'revision'}});
 const fresh=stated(2);
 const reply=await call('trail',{method:'POST',body:{revision:2,events:[{...one,revision:2},fresh]}});
 assert.equal(reply.status,409);assert.equal(reply.body.error.code,'EVENT_CONFLICT');assert.deepEqual(reply.body.ids,[one.id]);
 assert.equal((await call('trail',{method:'POST',body:{revision:2,events:[fresh]}})).body.accepted[0].seq,2);
});

// 옛 꼴 사건 셋(지금 판 손님 기록의 꼴 — 결정 · 제시 · 첫 답).
function legacyTrio(tag,{at=T0}={}){
 const scope={domain:'LAB',workspace:'learning',subject:'device'},iso=ms=>new Date(ms).toISOString();
 const decision={schema:1,id:`${tag}-d`,scope,at:iso(at),recordedAt:iso(at),type:'decision.made',experienceId:'game',variant:'standard',policy:'x',evidence:[]};
 const presented={schema:1,id:`${tag}-p`,scope,at:iso(at+1000),recordedAt:iso(at+1000),type:'practice.presented',decisionId:decision.id,taskId:'task',taskVersion:'v1',
  itemKey:`legacy.${tag}`,conceptIds:['ko.reading.detail'],firstExposure:true,measure:{skillId:'ko.reading.detail',modality:'reading',difficulty:2,familyKey:`fam-${tag}`,audioRequired:false,confounded:false,responseFormat:'single-choice'}};
 const attempted={schema:1,id:`${tag}-a`,scope,at:iso(at+2000),recordedAt:iso(at+2000),type:'practice.attempted',presentationId:presented.id,attemptNo:1,verdict:'correct',errorTags:[]};
 return [decision,presented,attempted];
}

test('옛 POST 흉내(trail-legacy) — 옛 꼴 사건을 같은 기록에 더하고 서버 접기가 옛 꼴로 접는다, 스위치 뒤가 아니고 쓰기 문이 닫히면 옛 답(FEATURE_DISABLED)',async()=>{
 const {call}=setup();
 const trio=legacyTrio('g1');
 const posted=await call('trail-legacy',{method:'POST',body:{revision:1,events:trio}});
 assert.equal(posted.status,200,JSON.stringify(posted.body));
 assert.deepEqual(posted.body,{ok:true,accepted:trio.map(e=>e.id),revision:1});
 const read=await call('trail',{query:'revision=1'});
 assert.equal(read.body.summary.foldedUntil,3,'다음 읽기에서 옛 꼴 셋을 접는다');
 assert.ok(read.body.summary.lines.length>0);
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision:1,events:trio}})).status,200,'같은 사건은 다시 받아도 그대로');
 const changed=await call('trail-legacy',{method:'POST',body:{revision:1,events:[{...trio[2],verdict:'incorrect'}]}});
 assert.equal(changed.status,409);assert.equal(changed.body.error.code,'EVENT_CONFLICT');assert.equal(changed.body.ids,undefined,'옛 POST는 번호를 싣지 않는다');
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision:1,events:[{...legacyTrio('g2')[0],scope:{domain:'LAB',workspace:'learning',subject:'other'}}]}})).body.error.code,'INVALID_EVENTS');
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision:1,events:[stated()]}})).body.error.code,'INVALID_EVENTS','2판 사건은 옛 POST로 받지 않는다');
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision:2,events:legacyTrio('g3')}})).body.error.code,'REVISION_CONFLICT');
 await call('trail-control',{method:'POST',body:{action:'switch',enabled:false}});
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision:1,events:legacyTrio('g4')}})).status,200,'옛 POST는 새 길 스위치와 무관하다');
 await call('trail-control',{method:'POST',body:{action:'writes',enabled:false}});
 const closed=await call('trail-legacy',{method:'POST',body:{revision:1,events:legacyTrio('g5')}});
 assert.equal(closed.status,403);assert.equal(closed.body.error.code,'FEATURE_DISABLED');
});

test('옛 POST 흉내는 받은 판을 적는다 — 동의를 껐다 켜 판이 오른 뒤 같은 번호를 다시 보내면 talk처럼 409 EVENT_CONFLICT(번호 없음), 처음 판은 켤 때 정할 수 있다(Fable 5.2 끝 판 넘친 #8 ① · #9)',async()=>{
 const {call}=setup();
 const trio=legacyTrio('r1');
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision:1,events:trio}})).status,200);
 await call('trail-control',{method:'POST',body:{action:'consent',enabled:false}});
 await call('trail-control',{method:'POST',body:{action:'consent',enabled:true}});
 const revision=(await call('trail-account')).body.learning.revision;
 assert.ok(revision>1,'동의 왕복으로 판이 올랐다');
 const again=await call('trail-legacy',{method:'POST',body:{revision,events:trio}});
 assert.equal(again.status,409);assert.equal(again.body.error.code,'EVENT_CONFLICT');assert.equal(again.body.ids,undefined,'번호는 싣지 않는다(talk 그대로)');
 assert.equal((await call('trail-legacy',{method:'POST',body:{revision,events:legacyTrio('r2')}})).status,200,'새 번호는 새 판으로 받는다');
 const later=setup({firstRevision:1_762_900_000});
 assert.equal((await later.call('trail-account')).body.learning.revision,1_762_900_000,'켤 때 준 처음 판으로 합성 계정을 만든다');
});

test('켤 때의 처음 판(openRehearsalTrail) — 켠 시각 이상이고 그 판으로 GET · POST가 되며, 앞 서버에서 판을 올린 뒤 곧 다시 켜도 뒤로 가지 않는다(Fable 5.2 끝 판 둘째 넘친 #10 · #11)',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rehearsal-trail-'));
 const stateFile=path.join(dir,'revision.json');
 const root=new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const open=()=>openRehearsalTrail({root,devOut:null,stateFile});
 const ask=(trail,p,{method='GET',query='',body}={})=>trail.handle({account:A,path:p,method,query:new URLSearchParams(query),
  body:body===undefined?undefined:Buffer.from(JSON.stringify(body)),headers:HEADERS});
 try{
  const before=Math.floor(Date.now()/1000);
  const first=await open();
  const revision=(await ask(first,'trail-account')).body.learning.revision;
  assert.ok(revision>=before,'켠 시각의 초 이상');
  assert.equal((await ask(first,'trail',{query:`revision=${revision}`})).status,200,'그 판으로 받기');
  const post=await ask(first,'trail',{method:'POST',body:{revision,events:[stated(revision)]}});
  assert.equal(post.status,200,JSON.stringify(post.body));
  // 앞 서버에서 판을 여러 번 올린다(동의 왕복 +2 · 비우기 +1 · 판만 올리기 +1)
  await ask(first,'trail-control',{method:'POST',body:{action:'consent',enabled:false}});
  await ask(first,'trail-control',{method:'POST',body:{action:'consent',enabled:true}});
  for(let i=0;i<5;i+=1)await ask(first,'trail-control',{method:'POST',body:{action:'revision'}});
  const raised=(await ask(first,'trail-account')).body.learning.revision;
  assert.equal(raised,revision+7);
  // 곧 다시 켠다(같은 초 안) — 새 서버의 처음 판은 앞 서버가 내준 마지막 판보다 크다
  const second=await open();
  const again=(await ask(second,'trail-account')).body.learning.revision;
  assert.ok(again>raised,`다시 켠 서버의 처음 판(${again})이 앞 서버의 판(${raised})보다 크다`);
 }finally{
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('처음 판 파일 — 폴더가 없어도 만들어 적고, 한 번 못 쓰면 같은 판이 다시 와도 다시 쓴다(카본 합친 끝 판 B3)',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rehearsal-trail-b3-'));
 const stateFile=path.join(dir,'nested','revision.json');
 const root=new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const ask=(trail,account,p)=>trail.handle({account,path:p,method:'GET',query:new URLSearchParams(''),headers:HEADERS});
 try{
  // 적을 자리를 폴더로 막아 둔다 — 첫 계정의 판은 못 쓴다
  fs.mkdirSync(stateFile,{recursive:true});
  const trail=await openRehearsalTrail({root,devOut:null,stateFile});
  const first=(await ask(trail,{id:'acct-b3-1'},'trail-account')).body.learning.revision;
  assert.equal(fs.statSync(stateFile).isDirectory(),true,'못 썼다');
  fs.rmSync(path.dirname(stateFile),{recursive:true,force:true}); // 적을 폴더째 없앤다 — 쓸 때 만들어야 한다
  // 다음 계정도 같은 처음 판 — 이번에는 쓴다(앞에서 못 쓴 판을 「이미 적음」으로 막지 않는다)
  const second=(await ask(trail,{id:'acct-b3-2'},'trail-account')).body.learning.revision;
  assert.equal(second,first);
  assert.equal(JSON.parse(fs.readFileSync(stateFile,'utf8')).revision,first,'같은 판을 다시 적었다');
 }finally{
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('처음 판 파일 — 같은 파일을 쓰는 서버 둘이면 쓸 때 큰 판을 두어, 나중에 쓴 쪽의 낮은 판이 남지 않고 다시 켠 서버가 뒤로 가지 않는다 · 서버는 그 파일을 자료 폴더에 묶는다(Fable 5.2 합친 끝 판 넘친 #25)',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rehearsal-trail-two-'));
 const stateFile=path.join(dir,'revision.json');
 const root=new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const open=()=>openRehearsalTrail({root,devOut:null,stateFile});
 const ask=(trail,p,{method='GET',body}={})=>trail.handle({account:A,path:p,method,query:new URLSearchParams(''),
  body:body===undefined?undefined:Buffer.from(JSON.stringify(body)),headers:HEADERS});
 const revisionOf=async trail=>(await ask(trail,'trail-account')).body.learning.revision;
 const bump=async(trail,n)=>{for(let i=0;i<n;i+=1)await ask(trail,'trail-control',{method:'POST',body:{action:'revision'}});};
 try{
  const one=await open(),two=await open(); // 같은 파일로 함께 켠 리허설 서버 둘
  await revisionOf(one);await bump(one,6);const high=await revisionOf(one);
  await revisionOf(two);await bump(two,1); // 둘째가 나중에 더 낮은 판을 적으려 한다
  assert.equal(JSON.parse(fs.readFileSync(stateFile,'utf8')).revision,high,'파일에는 큰 판이 남는다');
  const again=await revisionOf(await open()); // 첫째를 다시 켠다
  assert.ok(again>high,`다시 켠 서버의 처음 판(${again})이 첫째가 내준 판(${high})보다 크다`);
 }finally{
  fs.rmSync(dir,{recursive:true,force:true});
 }
 // 서버(server.mjs)는 처음 판 파일을 자료 폴더(SYNK_WORLD_DATA_DIR)에 묶는다 — 저장소 폴더에 하나면 다른 자료 폴더로 켠 서버끼리 덮는다
 const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/stateFile:`\$\{dataDir\}-trail-revision\.json`/,'처음 판 파일은 자료 폴더에 묶는다');
 assert.doesNotMatch(server,/rehearsal-trail-revision\.json/,'저장소 폴더의 공용 파일을 쓰지 않는다');
});
