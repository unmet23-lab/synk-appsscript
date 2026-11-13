// WORLD 「내 위치」의 「놓친 곳 카드」(2026-11-14, qa/놓친곳카드-20261114/설계.md) — 읽기 전용.
// 놓친 곳 하나를 좁혀 짚고(항목 → 안내문 줄 → 놓친 방향), 그 뒤 그 자리를 다시 만난 일과 앱이 잡아 둔 다음을 한 줄씩 나눈다
// (그 자리 → 나중에 다시 → 짧은 연습 · 이번 주 숙제 → 1 · 7 · 30일).
// 새 판정 · 새 저장 · 새 엔진 상태를 만들지 않는다: Core 요약(칸 상태 · 근거 id), Trail 사건(정오 · 고른 답 · 시각),
// 게임 원고(입장 검사 안내문 규칙), 이번 주 계획 숙제, Temper 다시 확인 줄만 읽는다. 급수 · 합격 · 점수 환산을 만들지 않는다.
// 「약점」이 아니라 「놓친 곳 · 다음에 볼 자리」다(학습기준 §7-3 — 학생의 영구 특성으로 만들지 않는다). 화면 글은 없다(world-strings.mjs의 position.missed.*).
// 사다리 칸은 기록에 남은 일(done)과 지금 기록 · 계획에 있는 다음(planned)만 쓴다 — 「앱이 알렸다 · 넣었다 · 올 것이다」는 쓰지 않는다
// (Fable 설계 검토 11-14 P1 ①②: 근무 · 안내는 Trail에 남지 않고, 맞춤 손님은 과제 · 근무지 · 잠금에 따라 안 올 수 있다).
//
// 카드 뼈대(두 종류 공용 — 드라마 「말하기 기록」은 같은 꼴로 옮긴다, 설계.md):
//  { policy, kind:'topik'|'speaking', target, narrow:[{layer,…,count?,of?}], again:[{step,state,at?,dueAt?,…}], evidence:[eventId], grade:null, abilityClaim:false }
//  again[].state: 'done'(기록에 있는 한 일 ●) · 'planned'(지금 기록 · 계획에 잡혀 있는 다음 ○). 말하기 종류는 'fixed' · 'unknown'을 더 쓸 수 있다.
import {VENUES} from '../entry-check/content.mjs';
import {caseMetadata,GAME_ID as ENTRY_GAME} from '../entry-check/learning.mjs';
import {activeRules,minutes} from '../entry-check/core.mjs';

export const MISSED_SPOT_POLICY=Object.freeze({version:'world-missed-spot-1',
 // 「그 자리」: Trail에는 근무 경계가 없어(손님마다 결정 하나) 근무지가 같고 · 손님 도착 시각이 늘고 · 이 사이 안에 이어진 제시만 같은 자리로 본다.
 sittingGapMs:30*60000,
 // 좁혀 짚기(안내문 줄 · 놓친 방향)는 서로 다른 문항에서 이만큼 이상 · 놓친 수의 과반일 때만(조작 실수와 언어 오답은 기록에서 안 갈린다 — kit/return-practice.mjs 머리).
 narrowMin:2,
 practiceGame:'world-practice'});

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const OPTION=/^(pass|reject-[a-z]+)$/;
// 입장 검사 손님: 문항 열쇠(판 올림 포함) · 계열 열쇠 → 근무지와 손님 원고.
const ENTRY=new Map();
for(const venue of VENUES)for(const item of venue.cases){const meta=caseMetadata(item),row={venue,item,meta};ENTRY.set(meta.itemKey,row);ENTRY.set(meta.familyKey,row);}
export const entryOf=key=>ENTRY.get(key)||null;

// 그 손님을 가를 안내문 줄: 정답이 거절이면 그 규칙, 통과면 원고의 근거 규칙 첫째. 그 시각에 적용되는 줄(알림으로 더해진 줄 포함)의 글.
export function entryRule(venue,item){
 const id=item.answer!=='pass'?item.answer:item.evidence?.[0];
 const rule=id?activeRules(venue,item.at).find(row=>row.id===id):null;
 return rule?{ruleId:rule.id,text:rule.text}:null;
}
// 놓친 방향(correction.mjs choiceCorrection과 같은 가름): 통과를 골랐는데 정답이 거절 · 거절을 골랐는데 정답이 통과 · 둘 다 거절인데 규칙이 다름.
export function missDirection(choice){
 if(!record(choice)||!OPTION.test(choice.selectedId||'')||!OPTION.test(choice.correctId||'')||choice.selectedId===choice.correctId)return null;
 if(choice.selectedId==='pass')return 'let-in';
 if(choice.correctId==='pass')return 'turned-away';
 return 'wrong-rule';
}

// Trail 사건 묶음: 제시 · 시도 · 첫 시도 · 결정의 경험 · 기록 순서 · 처음 본 제시.
function index(events){
 const list=Array.isArray(events)?events:[],shown=new Map(),first=new Map(),attempt=new Map(),experience=new Map(),order=new Map(),excluded=new Set();
 list.forEach((event,at)=>{
  if(!record(event))return;
  order.set(event.id,at);
  if(event.type==='decision.made')experience.set(event.id,event.experienceId);
  else if(event.type==='practice.presented')shown.set(event.id,event);
  else if(event.type==='record.excluded'&&event.targetId)excluded.add(event.targetId);
  else if(event.type==='practice.attempted'){attempt.set(event.id,event);if(event.attemptNo===1&&!first.has(event.presentationId))first.set(event.presentationId,event);}
 });
 const ordered=[...shown.values()].sort((a,b)=>order.get(a.id)-order.get(b.id)),firstSight=new Map();
 for(const presentation of ordered)for(const key of [presentation.itemKey,presentation.measure?.familyKey].filter(Boolean))if(!firstSight.has(key))firstSight.set(key,presentation.id);
 return {shown,first,attempt,excluded,order,ordered,expOf:presentation=>experience.get(presentation?.decisionId)??null,
  // 그 문항(또는 계열)을 이 제시보다 먼저 본 적이 없나 — 처음 보는 손님이었는지.
  fresh:presentation=>[presentation.itemKey,presentation.measure?.familyKey].filter(Boolean).every(key=>firstSight.get(key)===presentation.id)};
}

// 입장 검사 게임(경험 entry-check)의 제시를 기록 순서로. sitting: 근무지가 같고 · 손님 도착 시각(원고 at)이 늘고 · 30분 안에 이어진 묶음 번호.
// 근무 안의 손님은 도착 시각이 늘 는다(correction.mjs preservesShift) — 화면은 이 묶음을 「근무」라 부르지 않는다(Fable 설계 검토 P2 ④).
function entrySittings(ix,policy){
 const rows=[];let sitting=-1,prev=null;
 for(const presentation of ix.ordered){
  if(ix.expOf(presentation)!==ENTRY_GAME)continue;
  const entry=entryOf(presentation.itemKey);if(!entry)continue;
  const at=Date.parse(presentation.at);
  if(!prev||prev.entry.venue.id!==entry.venue.id||minutes(entry.item.at)<=minutes(prev.entry.item.at)||!Number.isFinite(at)||!Number.isFinite(prev.at)||at-prev.at>policy.sittingGapMs)sitting+=1;
  const row={presentation,entry,at,sitting,attempt:ix.first.get(presentation.id)||null};
  rows.push(row);prev=row;
 }
 return rows;
}

// Core가 이 항목에서 근거로 센 시도 id(모든 난도 · 형식 칸) — 도움 없이 처음 본 문항에 낸 첫 답(독립 근거)이다.
function coreEvidence(summary,skillId){
 const skill=(Array.isArray(summary?.skills)?summary.skills:[]).find(row=>row?.id===skillId),ids=new Set();
 if(!skill)return ids;
 for(const level of Object.values(record(skill.levels)?skill.levels:{}))for(const cell of Object.values(record(level?.formats)?level.formats:{}))for(const id of cell?.evidence||[])ids.add(id);
 if(skill.status!=='supported')for(const id of [...(skill.evidence||[]),...(skill.reasonEvidence||[])])ids.add(id);
 return ids;
}

// 가장 많은 값(같으면 가장 최근에 놓친 쪽 — rows는 최근 것부터). 서로 다른 문항 수가 문턱 이상이고 놓친 수의 과반일 때만.
function majority(rows,keyOf,{of,min}){
 const groups=new Map();
 rows.forEach((row,rank)=>{const key=keyOf(row);if(key==null)return;const hit=groups.get(key)||{key,rows:[],rank,items:new Set()};hit.rows.push(row);hit.items.add(row.itemKey);groups.set(key,hit);});
 const top=[...groups.values()].sort((a,b)=>b.rows.length-a.rows.length||a.rank-b.rank)[0];
 return top&&top.items.size>=min&&top.rows.length*2>of?top:null;
}

// ── 다시 만나기 ──
// 그 자리: 입장 검사에서 놓친 손님 바로 다음 손님이 같은 자리(근무지 · 시각 순서 · 30분) · 같은 항목이면 그 사실을 센다 — 바로잡기(immediateCheck)는
// 확인 손님을 놓친 손님 바로 뒤에 넣는다([...prefix, candidate, ...rest]). 이어서 또 놓치면 그 뒤 손님도 같은 길로 잇는다.
function spotStep({missed,rows,skillId,independent}){
 const at=new Map(rows.map((row,position)=>[row.presentation.id,position])),guests=new Map();
 for(const presentationId of missed){
  let position=at.get(presentationId);if(position==null)continue;
  let source=rows[position];
  while(position+1<rows.length){
   const next=rows[position+1];
   if(next.sitting!==source.sitting||next.entry.meta.skillId!==skillId||!next.attempt)break;
   if(!guests.has(next.presentation.id))guests.set(next.presentation.id,{row:next,sameRule:[...next.entry.item.evidence].sort().join('|')===[...source.entry.item.evidence].sort().join('|')});
   if(next.attempt.verdict!=='incorrect')break;
   position+=1;source=next;
  }
 }
 if(!guests.size)return null;
 const list=[...guests.values()];
 return {step:'spot',state:'done',guests:list.length,right:list.filter(({row})=>row.attempt.verdict==='correct'&&independent.has(row.attempt.id)).length,
  sameRule:list.every(row=>row.sameRule),at:list.at(-1).row.attempt.at,eventIds:list.map(({row})=>row.attempt.id)};
}

// 나중에 다시: 놓친 마지막 자리 뒤의 다른 자리에서 처음 만난 같은 항목의 정규 손님(바로잡기 전용 손님 아님)의 첫 답 — 기록에 있는 일만.
// 아직 없으면 원고에 아직 안 본 같은 항목 정규 손님 수(「올 것이다」가 아니라 남아 있다는 사실).
function laterGameStep({rows,missedSittings,skillId,independent,ix}){
 if(!rows.length||!missedSittings.length)return null;
 const last=Math.max(...missedSittings);
 const guest=rows.find(row=>row.sitting>last&&row.entry.meta.skillId===skillId&&!row.entry.item.followupOnly&&row.attempt&&ix.fresh(row.presentation));
 if(guest){
  const verdict=guest.attempt.verdict,alone=independent.has(guest.attempt.id);
  return {step:'again',state:'done',result:verdict==='correct'?alone?'correct':'assisted':verdict==='incorrect'?'incorrect':'other',
   answer:guest.entry.item.answer==='pass'?'pass':'reject',at:guest.attempt.at,eventIds:[guest.attempt.id]};
 }
 const seen=new Set();for(const presentation of ix.shown.values()){seen.add(presentation.itemKey);if(presentation.measure?.familyKey)seen.add(presentation.measure.familyKey);}
 const left=VENUES.reduce((n,venue)=>n+venue.cases.filter(item=>{const meta=caseMetadata(item);return !item.followupOnly&&item.skill===skillId&&!seen.has(meta.itemKey)&&!seen.has(meta.familyKey);}).length,0);
 return left?{step:'again',state:'planned',left}:null;
}

// 짧은 연습 · 이번 주 숙제: 놓친 뒤 짧은 연습(world-practice)에서 그 항목 새 문항에 혼자 낸 첫 답(한 일 — 숙제였는지는 가르지 않는다).
// 없으면 이번 주 계획 숙제에 그 항목이 있을 때만(시험 목표를 넣은 학생 — homework가 null이면 줄 없음).
function practiceStep({skillId,since,ix,independent,homework,policy}){
 const done=[];
 for(const [presentationId,attempt]of ix.first){
  const presentation=ix.shown.get(presentationId);
  if(ix.expOf(presentation)!==policy.practiceGame||presentation?.measure?.skillId!==skillId||!independent.has(attempt.id)||ix.excluded.has(attempt.id))continue;
  if(Date.parse(attempt.at)>since&&['correct','incorrect'].includes(attempt.verdict))done.push(attempt);
 }
 if(done.length)return {step:'practice',state:'done',n:done.length,right:done.filter(row=>row.verdict==='correct').length,at:done.map(row=>row.at).sort().at(-1),eventIds:done.map(row=>row.id)};
 const row=(Array.isArray(homework)?homework:[]).find(value=>value?.skillId===skillId);
 return row&&!row.shortage?{step:'homework',state:'planned'}:null;
}

// 1 · 7 · 30일: Temper 다시 확인(Core 요약의 followups 투영 — 짧은 연습 답만)의 그 항목 줄 한 칸 요약. 창은 그 칸의 짧은 연습 첫 답 기준이다
// (temper.js FOLLOWUP — 놓친 날 기준이 아니다). 판에 같은 줄의 1 · 7 · 30 카드가 따로 있으니 여기서는 지금 상태 한 칸만.
// 기준 답이 아직 없으면 그 항목 짧은 연습을 지금 열 수 있을 때만 「짧은 연습 첫 답부터」.
function delayedStep({skillId,projection,practiceOpen,now}){
 const all=(Array.isArray(projection?.items)?projection.items:[]).filter(row=>row?.gameId==='world-practice'&&row.measure?.skillId===skillId&&['d1','d7','d30'].includes(row.window));
 // 기준 답이 여럿이면(난도 · 형식 칸 또는 45일 뒤 새 주기) 가장 최근 기준 답의 세 창만.
 const latest=all.map(row=>row.sourceAt).filter(value=>Number.isFinite(Date.parse(value))).sort().at(-1);
 const rows=latest?all.filter(row=>row.sourceAt===latest):all;
 if(rows.length){
  const due=rows.find(row=>row.status==='due'),observed=rows.filter(row=>row.status==='observed').length;
  const upcoming=rows.filter(row=>row.status==='not_due'&&Number.isFinite(Date.parse(row.dueAt))&&Date.parse(row.dueAt)>=now).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt))[0];
  return {step:'delayed',state:observed?'done':'planned',observed,due:!!due,window:(due||upcoming)?.window??null,dueAt:upcoming?.dueAt??null};
 }
 return practiceOpen?{step:'delayed',state:'planned',observed:0,due:false,window:null,dueAt:null}:null;
}

/**
 * 「놓친 곳 카드」 한 장, 없으면 null.
 * map: buildPositionMap 결과(판과 같은 시험) · summary · events: 같은 코치의 Core 요약과 Trail 사건 ·
 * homework: 이번 주 계획 숙제 줄(시험 목표가 없으면 null) · projection: 짧은 연습 코치의 followups() 투영(없으면 null) ·
 * practiceOpen(skillId): 그 항목에 지금 낼 짧은 연습 새 문항이 있는지 · now: 지금(ms).
 */
export function buildMissedSpot({map,summary=null,events=[],homework=null,projection=null,practiceOpen=()=>false,now=Date.now(),policy=MISSED_SPOT_POLICY}={}){
 // 기록을 다 받지 못했으면 카드를 세우지 않는다(판은 열리고 「기록 일부」 줄을 단다 — 놓친 곳을 부분 기록으로 짚지 않는다).
 if(!record(map)||!Array.isArray(map.skills)||map.evidenceComplete!==true)return null;
 const skills=new Map(map.skills.map(skill=>[skill.id,skill]));
 // 고르기: 「먼저 볼 항목」(Core 우선순위 순서) 가운데 도움 없이 처음 본 문항에 낸 첫 답의 틀림이 근거에 있는 첫 항목.
 let skill=null,missed=[];
 for(const id of Array.isArray(map.attention)?map.attention:[]){
  const row=skills.get(id),misses=(row?.evidence||[]).filter(value=>value.verdict==='incorrect'&&value.independent);
  if(misses.length){skill=row;missed=misses;break;}
 }
 if(!skill)return null;
 const ix=index(events),independent=coreEvidence(summary,skill.id);
 for(const row of skill.evidence)if(row.independent)independent.add(row.eventId);
 const guests=!skill.folded&&skill.evidence.length>0&&skill.evidence.every(row=>entryOf(row.itemKey));
 const narrow=[{layer:'skill',skillId:skill.id,label:skill.label,domain:skill.domain,exam:map.exam,status:skill.status,count:skill.incorrect,of:skill.n,unit:guests?'guest':'try'}];
 // 좁혀 짚기: 놓친 근거 수(of)를 그대로 분모로 — 입장 검사 밖 근거 · 고른 답이 없는 근거는 그 값에 들지 않을 뿐 분모에서 빠지지 않는다(Fable P2 ⑥).
 const of=missed.length,detail=missed.map(row=>({...row,entry:entryOf(row.itemKey),choice:ix.attempt.get(row.eventId)?.choice}));
 const line=majority(detail,row=>row.entry?entryRule(row.entry.venue,row.entry.item)?.text??null:null,{of,min:policy.narrowMin});
 if(line){const top=line.rows[0],rule=entryRule(top.entry.venue,top.entry.item);narrow.push({layer:'line',venueId:top.entry.venue.id,venue:top.entry.venue.name,ruleId:rule.ruleId,text:rule.text,count:line.rows.length,of});}
 const way=majority(detail,row=>row.entry?missDirection(row.choice):null,{of,min:policy.narrowMin});
 if(way)narrow.push({layer:'direction',direction:way.key,count:way.rows.length,of});
 const rows=entrySittings(ix,policy),inGame=detail.filter(row=>row.experienceId===ENTRY_GAME).map(row=>ix.attempt.get(row.eventId)?.presentationId).filter(Boolean);
 const missedSittings=rows.filter(row=>inGame.includes(row.presentation.id)).map(row=>row.sitting);
 const firstMiss=Math.min(...missed.map(row=>Date.parse(row.at)).filter(Number.isFinite));
 let open=false;try{open=practiceOpen(skill.id)===true;}catch{open=false;}
 const again=[
  spotStep({missed:inGame,rows,skillId:skill.id,independent}),
  laterGameStep({rows,missedSittings,skillId:skill.id,independent,ix}),
  practiceStep({skillId:skill.id,since:Number.isFinite(firstMiss)?firstMiss:-Infinity,ix,independent,homework,policy}),
  delayedStep({skillId:skill.id,projection,practiceOpen:open,now}),
 ].filter(Boolean);
 return {policy:policy.version,kind:'topik',target:{skillId:skill.id,label:skill.label,domain:skill.domain,exam:map.exam,status:skill.status},narrow,again,
  evidence:missed.map(row=>row.eventId),grade:null,abilityClaim:false,learningEffectClaim:false};
}
