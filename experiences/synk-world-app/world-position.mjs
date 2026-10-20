// WORLD 「내 위치」 (2026-10-19 확정, docs/미니게임_TOPIK_I_학습기준.md §7-3 「학습자에게 보이는 위치」).
// Core가 이미 계산한 학습 항목 상태(atlas/learning.js summarizeLearning)를 세 칸으로 읽고, 짧은 진단에 낼 새 문항을
// 고르고, 예상 급수를 보여도 되는지 문턱만 판단한다. 상태를 새로 계산하거나 급수·합격·점수 환산을 만들지 않는다(§1).
// 지금은 WORLD 한 제품만 쓰므로 atlas/가 아니라 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion).
// 화면 글은 없다. 칸·이유는 코드로만 돌려주고 글은 화면 쪽 문자열 표가 맡는다.

export const POSITION_POLICY=Object.freeze({version:'world-position-1',
 // 학습기준 §7-3의 여섯 상태 → 학습자에게 보이는 세 칸. 시험이 이 대응을 고정한다.
 cells:Object.freeze({'recent-independent':'independent',practice:'practicing',checking:'practicing',supported:'practicing',review:'practicing',unseen:'notyet'})});
export const POSITION_CELLS=Object.freeze(['independent','practicing','notyet']);
const posRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const posOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const posTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const TOPIK_SKILL=/^ko\.(listening|reading)\.[a-z]+$/;

export function positionCell(status){
 if(typeof status!=='string'||!posOwn(POSITION_POLICY.cells,status))throw TypeError(`WORLD position: unknown Core state ${status}`);
 return POSITION_POLICY.cells[status];
}
function posProfile(summary){
 if(!posRecord(summary)||!Array.isArray(summary.skills)||typeof summary.evidenceComplete!=='boolean')throw TypeError('WORLD position needs a Core learning summary');
 return summary;
}
// Strata의 TOPIK I 항목(듣기 7·읽기 8)만, 지도에 나온 순서대로.
const posTopikSkills=summary=>posProfile(summary).skills.filter(skill=>TOPIK_SKILL.test(skill?.id||'')&&['listening','reading'].includes(skill.domain));

// Trail 로그에서 Core가 근거로 든 시도(eventId)의 사실만 찾는다: 정오·시각·문항·어느 경험에서 냈는지. 도움·첫 노출의 해석은 Core 상태가 이미 했다.
// experienceId: 그 문항을 낸 결정의 경험(게임이면 그 게임, WORLD 짧은 진단이면 진단을 낸 코치 'world-home').
function posAttemptIndex(events){
 const presented=new Map(),attempts=new Map(),decisions=new Map();
 for(const event of Array.isArray(events)?events:[]){
  if(event?.type==='practice.presented')presented.set(event.id,event);
  else if(event?.type==='practice.attempted')attempts.set(event.id,event);
  else if(event?.type==='decision.made')decisions.set(event.id,event.experienceId);
 }
 return id=>{
  const attempt=attempts.get(id),shown=attempt&&presented.get(attempt.presentationId);
  if(!attempt||!shown)return null;
  return {eventId:id,at:attempt.at,verdict:attempt.verdict,attemptNo:attempt.attemptNo,itemKey:shown.itemKey,taskId:shown.taskId,
   experienceId:decisions.get(shown.decisionId)??null,difficulty:shown.measure?.difficulty??null,responseFormat:shown.measure?.responseFormat||'unknown'};
 };
}

// 도움과 함께 낸 첫 답(10-20 검수 N1): Core는 도움 받고 맞힌 답만 'supported'로 세고, 도움 받고 틀린 답은 어느 칸에도
// 넣지 않는다(독립 근거가 아니므로 맞다). 판에서는 그 시도가 무기록처럼 사라지지 않게 사실(정오·날짜)만 따로 모은다.
// 도움: 그 제시에 첫 답보다 먼저 남은 도움(글·힌트·정답·다시 듣기). 빼기(record.excluded)로 지운 시도와 평가할 수 없는 답은 넣지 않는다.
function posHelpedTries(events,{asOf,days=30}={}){
 const now=Date.parse(asOf),shown=new Map(),helped=new Set(),excluded=new Set(),rows=new Map(),decisions=new Map();
 const list=Array.isArray(events)?events:[];
 for(const event of list){if(event?.type==='record.excluded'&&event.targetId)excluded.add(event.targetId);else if(event?.type==='decision.made')decisions.set(event.id,event.experienceId);}
 for(const event of list){
  if(event?.type==='practice.presented')shown.set(event.id,event);
  else if(event?.type==='practice.helped'&&event.presentationId)helped.add(event.presentationId);
  else if(event?.type==='practice.attempted'&&event.attemptNo===1&&helped.has(event.presentationId)&&!excluded.has(event.id)&&['correct','incorrect'].includes(event.verdict)){
   const at=Date.parse(event.at),skillId=shown.get(event.presentationId)?.measure?.skillId;
   if(!skillId||!Number.isFinite(at)||Number.isFinite(now)&&(at>now||now-at>days*86400000))continue;
   if(!rows.has(skillId))rows.set(skillId,[]);
   const presentation=shown.get(event.presentationId);
   rows.get(skillId).push({eventId:event.id,at:event.at,verdict:event.verdict,itemKey:presentation.itemKey,experienceId:decisions.get(presentation.decisionId)??null,difficulty:presentation.measure?.difficulty??null});
  }
 }
 for(const tries of rows.values())tries.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.eventId.localeCompare(b.eventId));
 return rows;
}
// Core 판정 문턱(atlas/learning.js POLICY의 sample·stableRatio). 판이 「다시 확인할 때 · ○월 ○일 혼자 해냄」처럼 지난 성취를
// 말해도 되는지만 이 수로 읽는다 — 칸·순위는 Core 상태 그대로다. 시험이 Core의 값과 같은지 대조한다.
export const POSITION_CORE_POLICY=Object.freeze({sample:4,stableRatio:.8});
// 칸 아래 한 줄(10-20 검수 #2·N1·N2·C): Core 상태를 바꾸지 않고, 같은 칸에 접힌 사실을 갈라 보인다.
// 「한 번 틀림 · 확인 중」과 「한 번 맞음 · 확인 중」, 도움과 함께 한 시도, 난도별 이력, 7일 지난 「다시 확인할 때」의 지난 기록.
function posNote(skill,{found,tries,levels,policy}){
 const n=skill.n||0,correct=skill.correct||0,incorrect=skill.incorrect||0;
 const latest=found.find(row=>!row.assisted)?.at||skill.lastAt||null;
 let note;
 if(skill.status==='practice')note={kind:'practice',n,wrong:incorrect};
 else if(skill.status==='checking')note={kind:'checking',n,right:correct,wrong:incorrect};
 else if(skill.status==='supported')note={kind:'supported',at:found[0]?.at||null};
 else if(skill.status==='review')note={kind:'review',at:skill.lastAt||latest,done:n>=policy.sample&&n>0&&correct/n>=policy.stableRatio};
 else if(skill.status==='recent-independent')note={kind:'independent',at:skill.lastAt||latest};
 else if(tries.length)note={kind:'helped',at:tries[0].at,tries:tries.length};
 else if(skill.unassessed)note={kind:'unassessed',n:skill.unassessed};
 else note={kind:'none'};
 // 난도가 둘 이상 보였고 상태가 다르면 난도별로 함께 적는다(숙달률을 합치지 않는다 · N2).
 const seen=levels.filter(level=>level.status!=='unseen');
 if(seen.length>1&&new Set(seen.map(level=>level.status)).size>1)note.levels=seen.map(level=>({difficulty:level.difficulty,status:level.status}));
 return note;
}
// 「먼저 볼 항목」(최대 3): 보충 후보·도움으로만 해낸 항목·다시 확인할 때·틀린 답이 있는 확인 중. 약점 판정이 아니라 다음에 볼 자리다.
// 순서는 Core의 우선순위(learning.js formatEvidence의 priority) 그대로, 같으면 지금 낼 새 문항이 연결된 항목(prefer) 먼저, 그다음 최근 것부터
// (이번 주 계획의 숙제 묶음과 같은 규칙 — 10-21 검수).
const POS_ATTENTION=new Set(['practice','supported','review']);
function posAttention(skills,prefer=null){
 const ready=id=>{try{return typeof prefer==='function'&&prefer(id)?1:0;}catch{return 0;}};
 return skills.filter(skill=>POS_ATTENTION.has(skill.status)||skill.status==='checking'&&skill.incorrect>0)
  .sort((a,b)=>(b.priority??0)-(a.priority??0)||ready(b.id)-ready(a.id)||(Date.parse(b.lastAt||0)||0)-(Date.parse(a.lastAt||0)||0)||a.id.localeCompare(b.id)).slice(0,3).map(skill=>skill.id);
}

// 칸 하나가 그렇게 보인 근거: Core가 그 상태를 정할 때 읽은 시도(reasonEvidence). 'supported'는 도움을 받아 맞힌 답이고,
// 나머지 상태의 근거는 도움 없이 처음 본 문항에 낸 첫 답이다(learning.js formatEvidence). 로그에서 접혀(learning-ledger)
// 자세한 사실이 없는 근거는 개수로만 남긴다.
// policy: Core의 판정 문턱(엔진 묶음의 POLICY). 없으면 POSITION_CORE_POLICY.
// prefer(skillId): 그 항목에 지금 낼 새 문항이 있으면 참 — 「먼저 볼 항목」에서 같은 우선순위끼리만 앞세운다(판정은 바꾸지 않는다).
export function buildPositionMap({summary,events=[],policy=POSITION_CORE_POLICY,prefer=null}={}){
 const profile=posProfile(summary),find=posAttemptIndex(events),counts={independent:0,practicing:0,notyet:0};
 const rules={sample:Number.isInteger(policy?.sample)?policy.sample:POSITION_CORE_POLICY.sample,stableRatio:Number.isFinite(policy?.stableRatio)?policy.stableRatio:POSITION_CORE_POLICY.stableRatio};
 const helped=posHelpedTries(events,{asOf:profile.asOf});
 const skills=posTopikSkills(profile).map(skill=>{
  const cell=positionCell(skill.status),ids=Array.isArray(skill.reasonEvidence)?skill.reasonEvidence:Array.isArray(skill.evidence)?skill.evidence:[];
  const assisted=skill.status==='supported',found=[],folded=[];
  for(const id of ids){const row=find(id);if(row)found.push({...row,assisted,independent:!assisted});else folded.push(id);}
  found.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.eventId.localeCompare(b.eventId));
  counts[cell]+=1;
  // 난도별 이력: Core가 난도마다 고른 대표 칸(levels[d])의 상태. 본 적 없는 난도는 빼고, 판정은 다시 하지 않는다.
  const levels=[1,2,3].map(difficulty=>skill.levels?.[difficulty]).filter(level=>posRecord(level)&&(level.lastAt||level.assisted))
   .map(level=>({difficulty:level.difficulty,status:level.status,n:level.n||0,correct:level.correct||0,incorrect:level.incorrect||0,lastAt:posTime(level.lastAt)?level.lastAt:null,responseFormat:level.responseFormat||'unknown'}));
  const tries=helped.get(skill.id)||[];
  const row={id:skill.id,label:skill.label,domain:skill.domain,cell,status:skill.status,priority:Number.isFinite(skill.priority)?skill.priority:null,lastAt:posTime(skill.lastAt)?skill.lastAt:null,
   n:skill.n||0,correct:skill.correct||0,incorrect:skill.incorrect||0,assisted:skill.assisted||0,unassessed:skill.unassessed||0,
   difficulty:skill.difficulty??null,responseFormat:skill.responseFormat||'unknown',evidence:found,folded:folded.length,levels,helped:tries};
  row.note=posNote(row,{found,tries,levels,policy:rules});
  return row;
 });
 return {policy:POSITION_POLICY.version,corePolicy:profile.policy??null,asOf:profile.asOf??null,evidenceComplete:profile.evidenceComplete,
  total:skills.length,counts,skills,attention:posAttention(skills,prefer),learningEffectClaim:false,abilityClaim:false,grade:null};
}

// 짧은 진단: 15개 항목에 하나씩, 이 사람이 아직 본 적 없는 계열(familyKey)의 문항. 문항은 제품이 이미 가진
// TOPIK형 문항에서만 고르고 새로 만들지 않는다. 기록이 불완전하면 「처음 보는 문항」을 약속할 수 없어 열지 않는다.
export const DIAGNOSTIC_POLICY=Object.freeze({version:'world-diagnostic-1',perSkill:1,
 // TOPIK 보기 고르기에 가까운 형식부터. 같은 형식이면 문항 id 순서로 늘 같은 것을 고른다.
 formats:Object.freeze(['single-choice','binary-choice','action','cup-compose','unknown'])});
const POS_FORMATS=new Set(['binary-choice','single-choice','cup-compose','action','unknown']);
const posToken=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
function posDiagnosticItem(item){
 if(!posRecord(item)||!posToken(item.id)||!posToken(item.itemKey)||!posToken(item.familyKey||item.itemKey)||!TOPIK_SKILL.test(item.skillId||'')
  ||!['listening','reading'].includes(item.modality)||item.skillId.split('.')[1]!==item.modality||![1,2,3].includes(item.difficulty)
  ||!POS_FORMATS.has(item.responseFormat??'unknown')||item.audioRequired!=null&&typeof item.audioRequired!=='boolean')throw TypeError('WORLD diagnostic: invalid item');
 return item;
}
// 이 항목에서 처음 볼 난도: 아직 「최근 혼자 수행」이 아닌 가장 쉬운 난도(Core의 readyForHarder와 같은 생각).
function posTargetDifficulty(skill){
 for(const difficulty of [1,2,3])if(skill.levels?.[difficulty]?.status!=='recent-independent')return difficulty;
 return 3;
}
export function selectDiagnostic({summary,items=[],seen,audioAvailable=true}={}){
 const profile=posProfile(summary);
 if(!Array.isArray(items)||typeof seen!=='function'||typeof audioAvailable!=='boolean')throw TypeError('WORLD diagnostic needs items, an exposure reader and the sound condition');
 const pool=items.map(posDiagnosticItem),ids=new Set();
 for(const item of pool){if(ids.has(item.id))throw TypeError('WORLD diagnostic: duplicate item');ids.add(item.id);}
 const skills=posTopikSkills(profile),common={policy:DIAGNOSTIC_POLICY.version,total:skills.length,learningEffectClaim:false,grade:null};
 if(!profile.evidenceComplete)return {...common,status:'unavailable',reason:'history.incomplete',items:[],missing:skills.map(skill=>({skillId:skill.id,reason:'history'}))};
 const chosen=[],missing=[];
 for(const skill of skills){
  const mine=pool.filter(item=>item.skillId===skill.id);
  if(!mine.length){missing.push({skillId:skill.id,reason:'no-item'});continue;}
  const playable=audioAvailable?mine:mine.filter(item=>!(item.audioRequired??item.modality==='listening'));
  if(!playable.length){missing.push({skillId:skill.id,reason:'audio'});continue;}
  // 본 적 있음(true)과 모름(null)은 둘 다 「처음 보는 문항」이 아니다.
  const read=playable.map(item=>{let value=null;try{value=seen(item);}catch{value=null;}return {item,seen:value===true||value===false?value:null};});
  const fresh=read.filter(row=>row.seen===false).map(row=>row.item);
  if(!fresh.length){missing.push({skillId:skill.id,reason:read.some(row=>row.seen===null)?'unknown':'all-seen'});continue;}
  const target=posTargetDifficulty(skill),format=item=>DIAGNOSTIC_POLICY.formats.indexOf(item.responseFormat??'unknown');
  fresh.sort((a,b)=>Math.abs(a.difficulty-target)-Math.abs(b.difficulty-target)||a.difficulty-b.difficulty||format(a)-format(b)||a.id.localeCompare(b.id));
  chosen.push({skillId:skill.id,target,item:fresh[0]});
 }
 return {...common,status:chosen.length?'ready':'unavailable',reason:chosen.length?null:'diagnostic.none',items:chosen,missing};
}

// 진단 한 바퀴. 문항마다 제시 → (듣기면) 끝까지 들음 → 첫 답, 이 순서로만 기존 코치 계약(atlas/game-learning.js의
// present·delivery·help·answer)에 남긴다. 그래서 기록은 Trail의 처음 본 문항에 낸 혼자 푼 첫 시도가 된다.
// 끝까지 듣기 전에는 답을 받지 않고, 다 들은 뒤 다시 듣기는 도움이다(바람길 듣기 확인과 같은 규칙).
// 건너뛰거나 그만두면 그 문항은 평가할 수 없는 답으로 남는다(본 것은 본 것이다). 이미 낸 답은 그대로다.
const posMeasureOf=item=>({id:item.id,itemKey:item.itemKey,familyKey:item.familyKey||item.itemKey,skillId:item.skillId,modality:item.modality,
 difficulty:item.difficulty,responseFormat:item.responseFormat??'unknown',audioRequired:item.audioRequired??item.modality==='listening',confounded:false,
 ...(Array.isArray(item.conceptIds)?{conceptIds:[...item.conceptIds]}:{})});
function posPlayableItem(row){
 const item=posDiagnosticItem(row?.item??row);
 if(!Array.isArray(item.choices)||item.choices.length<2||item.choices.some(choice=>!posRecord(choice)||!posToken(choice.id)||typeof choice.label!=='string'||!choice.label)
  ||new Set(item.choices.map(choice=>choice.id)).size!==item.choices.length||!item.choices.some(choice=>choice.id===item.correctId))throw TypeError('WORLD diagnostic: an item needs its choices and answer');
 return item;
}
export function createDiagnosticSession({coach,items}={}){
 if(!coach||['present','delivery','help','answer'].some(name=>typeof coach[name]!=='function')||!Array.isArray(items))throw TypeError('WORLD diagnostic needs the learning coach and its items');
 const queue=items.map(posPlayableItem),results=[];let index=-1,current=null,stopped=false;
 const listening=item=>item.audioRequired??item.modality==='listening';
 const view=()=>current&&{index,total:queue.length,item:current.item,heard:current.heard,answered:current.answered,replayed:current.replayed,audio:current.audio};
 const close=(result,choiceId,skipped)=>{current.answered=true;const row={skillId:current.item.skillId,itemId:current.item.id,itemKey:current.item.itemKey,choiceId,skipped,
  verdict:result.verdict,independent:result.independent===true,assisted:result.assisted??null,eventId:result.eventId??null};results.push(row);return {...row};};
 const skip=()=>{
  if(!current||current.answered)return null;
  return close(coach.answer(current.pid,{correct:null,assessable:false,reason:current.heard?'unanswered':'audio'}),null,true);
 };
 return Object.freeze({
  get total(){return queue.length;},
  get current(){return view();},
  results:()=>results.map(row=>({...row})),
  // 다음 문항을 제시한다. 앞 문항을 답하거나 건너뛰기 전에는 넘어가지 않는다.
  next(){
   if(stopped)return null;
   if(current&&!current.answered)throw Error('WORLD diagnostic: answer or skip the current item first');
   index+=1;if(index>=queue.length){current=null;return null;}
   const item=queue[index];current={item,pid:coach.present(posMeasureOf(item)),audio:listening(item)?'pending':'none',heard:!listening(item),answered:false,replayed:false};
   return view();
  },
  // 실제 재생기의 결과만 받는다(재생을 불렀다는 것만으로 들었다고 하지 않는다).
  delivery(status){
   if(!current||current.answered||!listening(current.item))return false;
   if(!['pending','completed','failed'].includes(status))throw TypeError('WORLD diagnostic: invalid audio state');
   if(current.heard)return true;
   current.audio=status;if(status==='completed')current.heard=true;coach.delivery(current.pid,{audio:status});return true;
  },
  replay(){
   if(!current||current.answered||!listening(current.item))return false;
   if(current.heard){coach.help(current.pid,'replay');current.replayed=true;return true;}
   current.audio='pending';coach.delivery(current.pid,{audio:'pending'});return true;
  },
  answer(choiceId){
   if(!current||current.answered||!current.heard)return null;
   if(!current.item.choices.some(choice=>choice.id===choiceId))throw TypeError('WORLD diagnostic: unknown choice');
   const result=coach.answer(current.pid,{correct:choiceId===current.item.correctId,assessable:true,choice:{selectedId:choiceId,correctId:current.item.correctId}});
   return close(result,choiceId,false);
  },
  skip,
  // 진단을 그만둔다. 보이던 문항은 건너뛴 것으로 남기고, 아직 안 보인 문항은 기록하지 않는다.
  stop(){if(stopped)return;skip();stopped=true;current=null;},
 });
}

// 한글 만나기를 마치기 전에는 항목 지도 대신 한글 진도를 보인다(10-19 지시 4). 그 게임이 저장한 진도 JSON
// (hangul-stage/core.mjs의 꼴)에서 판에 보일 숫자만 꺼낸다. 글자 상태·졸업의 판단은 그 게임이 한다.
// layer: Strata 한글 층(strata/hangul.json) — 49글자, 핵심 단원(U1~U7, core:false가 아닌 것)이 졸업 조건이다.
export function hangulStageProgress(raw,layer){
 if(!posRecord(layer)||!Array.isArray(layer.letters)||!Array.isArray(layer.units))throw TypeError('WORLD position needs the Strata Hangul layer');
 const progress=posRecord(raw)&&raw.v===1?raw:null,letters=posRecord(progress?.letters)?progress.letters:{};
 const ids=layer.letters.map(row=>Array.isArray(row)?row[0]:row?.id).filter(posToken);
 const state=id=>posRecord(letters[id])&&typeof letters[id].state==='string'?letters[id].state:'unmet';
 const best=id=>posRecord(letters[id])&&typeof letters[id].best==='string'?letters[id].best:state(id);
 const core=layer.units.filter(unit=>unit?.core!==false&&Array.isArray(unit.letters));
 const met=ids.filter(id=>state(id)!=='unmet').length;
 return {started:met>0,met,total:ids.length,mastered:ids.filter(id=>best(id)==='mastered').length,
  units:core.length,unitsDone:core.filter(unit=>unit.letters.every(id=>best(id)==='mastered')).length,
  graduated:!!(posRecord(progress?.graduated)&&posTime(progress.graduated.at)),skipped:progress?.skipped===true};
}
// 한글 판을 보일지: 첫 실행에서 「아직 못 읽어요」를 고른 사람(생활 기록 hangul.answer === 'new')이고 아직
// 졸업하지 않았을 때만. 답이 없거나 읽는다고 고른 사람·졸업한 사람·건너뛴 사람은 항목 지도를 본다.
export function showsHangulBoard({reading=null,stage=null}={}){
 return posRecord(reading)&&reading.answer==='new'&&!(stage?.graduated)&&!(stage?.skipped);
}

// 예상 급수의 문턱. 「1급 근처 · 근거 30문항 · 갱신일」처럼 범위를 보이려면 TOPIK 형식 연습(처음 보는 문항 · 실제 구성 ·
// 시간 제한)의 근거가 이 수만큼 쌓여야 한다. 게임 기록·정답률은 근거가 아니다(§1). 근거 수는 판이 있는 정책 설정이고
// 실제 자료로 조정한다(§7-3). 점수에서 범위를 읽는 검수된 방법이 아직 없어, 문턱을 넘어도 급수는 만들지 않는다.
export const ESTIMATE_POLICY=Object.freeze({version:'world-topik-estimate-1',minEvidence:30,minPerDomain:10,recentDays:90,
 forms:Object.freeze(['topik-i']),compositions:Object.freeze(['official-blueprint'])});
const POS_DAY=86400000;
// evidence: 호스트가 내놓는 TOPIK 형식 연습의 첫 답. 지금 WORLD에는 이런 연습이 없어 빈 목록이다.
export function estimateGate({evidence=[],asOf,policy=ESTIMATE_POLICY}={}){
 if(!Array.isArray(evidence)||!posTime(asOf)||!posRecord(policy)||!Number.isInteger(policy.minEvidence)||policy.minEvidence<1)throw TypeError('WORLD estimate gate needs evidence, a time and a policy');
 const now=Date.parse(asOf),counted=new Map();
 for(const row of evidence){
  if(!posRecord(row)||!posToken(row.eventId)||!posTime(row.at)||!['listening','reading'].includes(row.domain))continue;
  const at=Date.parse(row.at);
  if(at>now||now-at>policy.recentDays*POS_DAY)continue;
  if(row.firstExposure!==true||row.independent!==true||row.timed!==true||!['correct','incorrect'].includes(row.verdict))continue;
  if(!policy.forms.includes(row.form)||!policy.compositions.includes(row.composition))continue;
  if(!counted.has(row.eventId))counted.set(row.eventId,row);
 }
 const rows=[...counted.values()],perDomain={listening:rows.filter(row=>row.domain==='listening').length,reading:rows.filter(row=>row.domain==='reading').length};
 const enough=rows.length>=policy.minEvidence&&perDomain.listening>=policy.minPerDomain&&perDomain.reading>=policy.minPerDomain;
 const updatedAt=rows.length?rows.map(row=>row.at).sort().at(-1):null;
 return {policy:policy.version,status:enough?'no-estimator':'too-early',visible:false,evidence:rows.length,needed:policy.minEvidence,
  perDomain,neededPerDomain:policy.minPerDomain,updatedAt,range:null,grade:null,passClaim:false};
}
