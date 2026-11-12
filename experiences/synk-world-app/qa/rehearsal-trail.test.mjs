// Atlas 재설계 단계 4 ④ — 리허설 서버의 새 기록 길(rehearsal-trail.mjs)이 talk의 learning?view=trail과 같은 검사 · 같은 답을 내는가.
// 엔진은 패키지 원천(packages/atlas/src)과 진짜 지도 색인으로 연다 — 접기 · 요약은 talk가 쓰는 것과 같은 서버 접기다.
// talk 쪽 같은 뜻의 시험: SYNK-talk tests/atlas-trail-server.test.js(울타리 · gen · EVENT_CONFLICT ids · WRITES_DISABLED).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import {createRehearsalTrail} from '../rehearsal-trail.mjs';

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
