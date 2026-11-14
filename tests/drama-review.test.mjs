// 드라마 말하기 — 틀린 장면 복습 · 3일 뒤 다시 만나기(설계 experiences/drama/qa/WORLD올리기-20261102/설계.md §18, 유호님 11-14).
// 실제 Atlas 게임 + 메모리 저장소로: 장면 첫 판정 실수 → 3일째 날 다시 만나기. 3일째 전의 통과(같은 날 복습 · 장면 다시)는 「고침」 표시만,
// 3일째부터 대사를 보지 않은 첫 판정 통과만 닫힘, 3일째부터의 고칠 점은 그 날로 다시 3일(설계 검토 1 · 4). C는 실수와 따로(설계 검토 2),
// 접힌 기록은 「모름」(설계 검토 3), 기록 불완전은 null.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {planRevisit,daysSince,revisitDue,REVISIT_DAYS,DAY_START_HOUR} from '../experiences/drama/pilot/takes.mjs';

const require=createRequire(import.meta.url);
const Drama=require('../experiences/drama/pilot/learning-entry.cjs');
const DAY=86400000;
const LINES=['s1e01-6','s1e01-7','s1e01-8'];
const SKILL={'s1e01-6':'ko.speaking.explain','s1e01-7':'ko.speaking.ask','s1e01-8':'ko.speaking.thank','s1e01-t9':'ko.speaking.ask','s1e01-t6':'ko.speaking.ask'};
const ASK={lineIds:LINES,transferId:'s1e01-t9',delayedId:'s1e01-t6'};

function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function account(){
  const win={};
  const host=Drama.createRehearsalHost({accountKey:randomUUID(),revision:1,connected:false,transport:null,storage:memoryStorage(),win});
  return {host,recorder:Drama.createRecorder({win})};
}
// 지난 시각의 기록 — 틀 시험 ?r=1과 같은 길(시계를 준 게임으로 보임 · 도움 · 시도를 남긴다). choices의 null은 판정 없는 시도(안 들림 등).
function past(host,ms,fn){
  const g=host.createGame({gameId:'drama-s1',clock:()=>new Date(ms).toISOString()},Drama.engine.createGame,Drama.engine.createLearningSync);
  fn((phase,lineId,choices,{correct=null,assessable=false,answerFirst=false,answerAfter=false}={})=>{
    const pid=g.present({id:`drama-s1.${phase}.${lineId}`,itemKey:lineId,familyKey:lineId,skillId:SKILL[lineId],modality:'speaking',difficulty:phase==='transfer'?2:1,responseFormat:'spoken',audioRequired:false});
    if(answerFirst)g.help(pid,'answer');
    choices.forEach((c,i)=>g.answer(pid,{correct:phase==='transfer'&&c?(c==='pass'?correct:false):null,assessable:i===0&&assessable,attemptNo:i+1,...(c?{choice:{selectedId:c,correctId:'pass'}}:{})}));
    if(answerAfter)g.help(pid,'answer');
  });
  g.dispose?.();
}
const result=(choice)=>({kind:'result',data:{status:'ok',transcript:'x',observation:choice==='pass'?{kind:'pass',sure:true}:{kind:'note',note:{kind:choice.slice(5)}},trail:{correct:null,assessable:false}}});
const plan=(recorder,now=Date.now())=>planRevisit(recorder.review(ASK),{now});
// 영상 흐름(틀 시험 ?r=1 씨앗과 같은 길): 장면 6번 줄 첫 판정 「요」 빠짐 → 되묻기 → 빈칸 열림 → 셋째도 빠짐(코치 노트) → 테이크 2 통과, 7 · 8번 통과, B(t9) 판정.
function firstDay(say){
  say('scene','s1e01-6',['note-ending','note-ending','note-ending']);
  say('retake','s1e01-6',['pass'],{answerFirst:true});
  say('scene','s1e01-7',[null,'hold','pass']);   // 안 들림 · 판정 보류는 건너뛰고 첫 판정은 통과
  say('scene','s1e01-8',['pass']);
  say('transfer','s1e01-t9',['pass'],{correct:true,assessable:true});
}

test('학습일(새벽 4시에 바뀜): 같은 학습일 0, 3일째 학습일부터 다시 만나기',()=>{
  const at=new Date(2026,10,13,21,30).getTime();
  assert.equal(DAY_START_HOUR,4);
  assert.equal(daysSince(at,new Date(2026,10,13,23,59).getTime()),0);
  assert.equal(daysSince(at,new Date(2026,10,14,3,59).getTime()),0,'새벽 4시 전은 전날 학습일');
  assert.equal(daysSince(at,new Date(2026,10,16,0,1).getTime()),2);
  assert.equal(daysSince(at,new Date(2026,10,16,4,1).getTime()),3);
  assert.equal(revisitDue(at,new Date(2026,10,16,3,59).getTime()),false);
  assert.equal(revisitDue(at,new Date(2026,10,16,4,1).getTime()),true);
  // 새벽 2시 실수는 그 전날 학습일 — 3일째는 그 전날에서 센다
  const late=new Date(2026,10,14,2,0).getTime();
  assert.equal(revisitDue(late,new Date(2026,10,16,4,1).getTime()),true);
  // 서머타임이 바뀌는 날도 현지 새벽 4시로 가른다(GPT 검수 GA1 — 절대 4시간 빼기는 하루 어긋났다).
  const tz=process.env.TZ;
  try {
    process.env.TZ='America/New_York';
    const fall=new Date(2026,9,29,21,30).getTime();
    assert.equal(daysSince(fall,new Date(2026,10,1,3,30).getTime()),2,'11-01(가을 바뀜) 03:30은 아직 10-31 학습일');
    assert.equal(daysSince(fall,new Date(2026,10,1,4,30).getTime()),3);
    const spring=new Date(2026,2,5,21,30).getTime();
    assert.equal(daysSince(spring,new Date(2026,2,8,4,30).getTime()),3,'03-08(봄 바뀜) 04:30은 3일째');
    assert.equal(daysSince(spring,new Date(2026,2,8,3,30).getTime()),2);
  } finally { if (tz===undefined) delete process.env.TZ; else process.env.TZ=tz; }
  assert.equal(REVISIT_DAYS,3);
});

test('장면 첫 판정이 끝맺음 실수면 테이크 2로 고쳐도 남고, 3일째 날 다시 만나기가 그 실수를 권한다 · C는 실수와 따로',()=>{
  const {host,recorder}=account();
  const t0=Date.now()-3.2*DAY;
  past(host,t0,firstDay);
  const facts=recorder.review(ASK);
  assert.deepEqual(Object.keys(facts.history).sort(),LINES,'세 줄 모두 첫 판정이 있다');
  assert.deepEqual(facts.unknown,[]);
  assert.ok(Math.abs(facts.transferAt-t0)<1000);
  const soon=planRevisit(facts,{now:t0+0.5*DAY});
  assert.equal(soon.due,null,'3일 전에는 다시 만나기 없음');
  assert.deepEqual(soon.mistakes.map(m=>[m.lineId,m.kind,m.fixed]),[['s1e01-6','ending',false]],'틀린 장면 줄은 언제든 · 테이크 2는 고침으로 세지 않음');
  assert.equal(soon.delayed,false,'C도 3일째부터');
  const later=plan(recorder);
  assert.equal(later.due.lineId,'s1e01-6');
  assert.ok(later.due.ago>=3,'3.2일 전 = 달력으로 3~4일 전');
  assert.equal(later.delayed,true,'C 자격은 실수와 상관없다 — 카드 차례만 실수 → C');
});

test('3일째 전의 통과(같은 날 복습 · 장면 다시)는 고침 표시만이고 다시 만나기는 그대로 온다',()=>{
  for(const phase of ['review','scene']){
    const {host,recorder}=account();
    const t0=Date.now()-3.3*DAY;
    past(host,t0,firstDay);
    past(host,t0+0.1*DAY,(say)=>say(phase,'s1e01-6',['pass']));
    assert.equal(plan(recorder).due.fixed,true,`${phase}: 고쳐 봄 표시`);
    past(host,t0+0.2*DAY,(say)=>say(phase,'s1e01-6',['note-ending']));   // 3일째 전의 고칠 점은 기준을 옮기지 않는다
    const p=plan(recorder);
    assert.equal(p.due?.lineId,'s1e01-6',phase);
    assert.equal(p.due.fixed,false,`${phase}: 그 뒤 다시 고칠 점이면 고쳐 봄 표시를 내린다(화면 검수 C1)`);
    assert.ok(Math.abs(p.due.at-t0)<1000,`${phase}: 기준은 첫 실수 그대로`);
    past(host,t0+0.3*DAY,(say)=>say(phase,'s1e01-6',['pass']));
    assert.equal(plan(recorder).due.fixed,true,`${phase}: 다시 통과하면 고쳐 봄`);
  }
});

test('3일째부터: 대사를 보지 않은 첫 판정 통과만 닫고, 대사를 보고 한 통과는 고침 표시, 고칠 점은 그 날로 다시 3일',()=>{
  const close=account(), helped=account(), again=account();
  for(const a of [close,helped,again])past(a.host,Date.now()-3.2*DAY,firstDay);
  // 닫힘: 복습 첫 판정 통과(둘째 시도의 노트는 상관없음)
  const r=close.recorder.open({lineId:'s1e01-6',skillId:SKILL['s1e01-6'],phase:'review'});
  r.help('text');r.take(result('pass'));r.help('answer');r.take(result('note-ending'));   // 결과 화면이 판정 바로 뒤(같은 ms일 수 있다) 대사 전체를 보인다
  assert.deepEqual(plan(close.recorder).mistakes,[]);
  // 같은 ms를 보장하려고 시계를 고정한 게임으로(코드 검수 -c GA1): 통과 → 대사 보기는 helped 아님 · 닫힘, 대사 보기 → 통과는 helped.
  const after=account(), first=account(), t=Date.now()-3.2*DAY, now=t+3.2*DAY;
  for(const a of [after,first])past(a.host,t,firstDay);
  past(after.host,now,(say)=>say('review','s1e01-6',['pass'],{answerAfter:true}));
  past(first.host,now,(say)=>say('review','s1e01-6',['pass'],{answerFirst:true}));
  assert.equal(after.recorder.review(ASK).history['s1e01-6'].at(-1).helped,false,'같은 ms의 통과 → 대사 보기');
  assert.deepEqual(plan(after.recorder,now).mistakes,[]);
  assert.equal(first.recorder.review(ASK).history['s1e01-6'].at(-1).helped,true,'같은 ms의 대사 보기 → 통과');
  assert.equal(plan(first.recorder,now).due?.fixed,true);
  // 빈칸을 열어 대사 전체를 본 뒤의 통과는 닫지 않는다(설계 검토 4)
  const h=helped.recorder.open({lineId:'s1e01-6',skillId:SKILL['s1e01-6'],phase:'review'});
  h.help('answer');h.take(result('pass'));
  const ph=plan(helped.recorder);
  assert.equal(ph.due?.lineId,'s1e01-6');assert.equal(ph.due.fixed,true);
  // 또 틀림: 그 시각으로 다시 3일 — 오늘은 다시 만나기가 아니고 틀린 장면 줄에는 남는다
  const n=again.recorder.open({lineId:'s1e01-6',skillId:SKILL['s1e01-6'],phase:'review'});
  n.take(result('note-ending'));
  const pn=plan(again.recorder);
  assert.equal(pn.due,null);
  assert.deepEqual(pn.mistakes.map(m=>[m.lineId,m.ago]),[['s1e01-6',0]]);
  assert.equal(planRevisit(again.recorder.review(ASK),{now:Date.now()+3.5*DAY}).due?.lineId,'s1e01-6','3일 뒤 다시');
});

test('여러 실수는 끝맺음 → 길이 → 빠진 말, 같은 갈래면 목표 줄 먼저',()=>{
  const {host,recorder}=account();
  past(host,Date.now()-4*DAY,(say)=>{say('scene','s1e01-6',['note-missing']);say('scene','s1e01-7',['note-missing']);say('scene','s1e01-8',['note-ending']);});
  const rank=(id)=>(id==='s1e01-7'?-1:LINES.indexOf(id));
  const p=planRevisit(recorder.review(ASK),{now:Date.now(),rank});
  assert.deepEqual(p.mistakes.map(m=>[m.lineId,m.kind]),[['s1e01-8','ending'],['s1e01-7','missing'],['s1e01-6','missing']]);
  assert.equal(p.due.lineId,'s1e01-8');
});

test('「제가 한 말과 달라요」로 뺀 시도는 세지 않는다 · 테이크 2만 있는 줄 · 판정 없는 복습은 실수가 아니다',()=>{
  const {recorder}=account();
  const scene=recorder.open({lineId:'s1e01-7',skillId:SKILL['s1e01-7'],phase:'scene'});
  scene.take(result('note-missing'));scene.excludeLast();
  const retake=recorder.open({lineId:'s1e01-8',skillId:SKILL['s1e01-8'],phase:'retake'});
  retake.take(result('note-ending'));
  const off=recorder.open({lineId:'s1e01-6',skillId:SKILL['s1e01-6'],phase:'review'});
  off.take({kind:'off'});
  const facts=recorder.review(ASK);
  assert.deepEqual(facts.history['s1e01-7']||[],[]);
  const p=planRevisit(facts,{now:Date.now()});
  assert.deepEqual(p.mistakes,[]);
  assert.equal(facts.transferAt,null);
  assert.equal(p.delayed,false,'t9 판정이 없으면 C 없음');
});

test('C 문항을 이미 봤으면 C는 없고, 접힌 기록은 모름, 기록이 덜 모였으면 null',()=>{
  const {host,recorder}=account();
  past(host,Date.now()-4*DAY,(say)=>{say('transfer','s1e01-t9',['pass'],{correct:true,assessable:true});say('transfer','s1e01-t6',['pass'],{correct:true,assessable:true});});
  assert.equal(plan(recorder).delayed,false);
  assert.equal(planRevisit(null),null);
  // 본 적은 있는데(exposure) 남은 사건에 보임이 없다 = 장부로 접힌 기록 — 「실수 없음」이 아니라 모름(설계 검토 3)
  const folded={createGame:()=>({summary:()=>({storage:{available:true},evidenceComplete:true}),events:()=>[],exposure:({itemKey})=>({seen:itemKey!=='s1e01-t6'})})};
  const f=Drama.createRecorder({win:null,owner:folded}).review(ASK);
  assert.deepEqual(f.unknown,LINES);
  assert.equal(f.transferAt,undefined);
  const pf=planRevisit(f,{now:Date.now()});
  assert.deepEqual(pf.unknown,LINES);
  assert.equal(pf.delayed,null,'B 기준을 모르면 C도 모름');
  // 계정 기록이 서버에서 다 오지 않은 호스트(connected · 동기화 전)는 모름 — summary의 evidenceComplete가 거짓
  const owner={createGame:()=>({summary:()=>({storage:{available:true},evidenceComplete:false}),events:()=>[],exposure:()=>({seen:null})})};
  assert.equal(Drama.createRecorder({win:null,owner}).review(ASK),null);
  const blocked={createGame:()=>({summary:()=>({storage:{available:false},evidenceComplete:true}),events:()=>[],exposure:()=>({seen:false})})};
  assert.equal(Drama.createRecorder({win:null,owner:blocked}).review(ASK),null,'저장할 수 없는 기기');
});

test('튜터 근거: 장면 학생 줄마다 세 갈래, 세 언어, 근거는 대본 칸 글 그대로, 강의에 명세 칸 이름이 없다',async()=>{
  const {default:PILOT}=await import('../experiences/drama/pilot/content.mjs');
  const {default:ep01}=await import('../experiences/drama/s1/ep01.mjs');
  const {publicLesson}=await import('../tools/lib/drama-pilot-service.mjs');
  const rows=ep01.촬영일.flatMap(d=>d.줄||[]);
  for(const line of PILOT.scene.filter(x=>x.type==='student')){
    const row=rows.find(r=>r.id===line.id);
    assert.deepEqual(Object.keys(line.tutor).sort(),['ending','length','missing'],line.id);
    for(const [kind,t] of Object.entries(line.tutor)){
      for(const l of ['ko','en','mn'])assert.ok(t.rule[l]&&t.rule[l].length>10,`${line.id} ${kind} ${l}`);
      if(t.source.kind==='배운것')assert.ok(ep01.배운것.includes(t.source.text));
      else if(t.source.kind==='문법')assert.ok(row.문법.includes(t.source.text),`${line.id} ${kind}`);
      else assert.equal(t.source.kind,'대사');
      if(kind==='ending'){assert.ok(line.text.includes(t.to));assert.ok(!line.text.includes(`${t.from} `)&&t.from!==t.to);}
    }
  }
  assert.deepEqual(PILOT.revisit,{days:3});
  const pub=JSON.stringify(publicLesson(PILOT));
  assert.match(pub,/"revisit":\{"days":3\}/);
  assert.doesNotMatch(pub,/"(?:spec|keys|alts|variants)"/);
});
