// WORLD 「짧은 연습」(2026-10-20 TOPIK 맞춤 재설계 · 최종 제안 §2-1 ①, 결정 표 10-20 「재설계 진행」 — 처음 이름은 「읽기 짧은 연습」).
// 약점이 실제 출제로 이어지는 고리: 약한 항목 → 그 항목의 새 문항 몇 개 → 답을 학습 기록(Trail)에 → 다음 추천(Core).
// 문항은 두 곳에서 온다 — (1) 짧은 진단 묶음(world-diagnostic-items.mjs)의 읽기 문항 가운데 문항 검수(experiences/topik-items/review/
// existing-verdicts.json, AI 2중 검수)가 통과(pass)로 판정하고 검수가 확인한 항목·난도·형식·계열이 문항 메타와 같은 것(허용 목록),
// (2) 10-21 ④부터 공개 TOPIK 은행(world-topik-items.json — 검수 통과 문항만)의 TOPIK I·II 읽기·듣기 문항.
// 문항을 새로 만들거나 고치지 않는다. 판정 목록에 없는 기존 문항은 내지 않는다.
// 순위는 Core가 정한다: 항목마다 후보(targets에 그 항목의 새 문항)를 넘기고 Core recommendActivities가 고른다.
// 이 모듈은 상태를 새로 계산하지 않고, 진단 선택기(항목마다 하나)와 달리 한 항목에서 새 문항 여러 개를 고른다.
// 세트 문항은 같은 세트의 다른 문항을 이미 봤으면 처음 보는 문항이 아니다(지문을 읽었다 — world-exam-form.mjs freshBySet).
// 지금은 WORLD 한 제품만 쓰므로 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion). 화면 글은 없다.
import {allowedPlays,nextPlay,presentCondition,freshBySet} from './world-exam-form.mjs';

export const PRACTICE_POLICY=Object.freeze({version:'world-practice-2',count:5,
 // 연습 기록을 남기는 코치(경험) 이름. 내 위치 근거 줄이 「짧은 연습」으로 읽는다(world-position-ui.mjs itemSource).
 gameId:'world-practice',
 // 보기 고르기에 가까운 형식부터(진단과 같은 순서).
 formats:Object.freeze(['single-choice','binary-choice','action','cup-compose','unknown'])});
const VERDICT_VERSION='topik-existing-verdicts-1';
const prRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const prToken=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const PRACTICE_SKILL=/^ko2?\.(listening|reading)\.[a-z]+$/;
const prListening=item=>item.audioRequired??item.modality==='listening';
const prChoices=item=>Array.isArray(item.choices)&&item.choices.length>=2&&item.choices.some(choice=>choice?.id===item.correctId);

// 기존 문항 가운데 검수를 통과한 것: 검수 통과 × 검수가 확인한 메타와 같음. 판정 목록을 읽지 못하면 하나도 내지 않는다.
// 같은 itemKey의 판정이 둘 이상이거나 서로 다르면 그 문항은 뺀다(어느 판정이 맞는지 모른다). modality: 받을 영역(기본 읽기만).
export function passedItems({items=[],verdicts=null,modalities=['reading']}={}){
 if(!Array.isArray(items)||!prRecord(verdicts)||verdicts.version!==VERDICT_VERSION||!Array.isArray(verdicts.items))return Object.freeze([]);
 const judged=new Map(),conflicted=new Set();
 for(const row of verdicts.items){
  if(!prRecord(row)||!prToken(row.itemKey))continue;
  if(judged.has(row.itemKey))conflicted.add(row.itemKey);
  judged.set(row.itemKey,row);
 }
 const pool=[];
 for(const item of items){
  if(!prRecord(item)||!modalities.includes(item.modality)||!PRACTICE_SKILL.test(item.skillId||'')||item.skillId.split('.')[1]!==item.modality)continue;
  if(item.modality==='reading'&&item.audioRequired===true)continue;
  const verdict=judged.get(item.itemKey);
  if(!verdict||conflicted.has(item.itemKey)||verdict.verdict!=='pass')continue;
  if(verdict.skillId!==item.skillId||verdict.difficulty!==item.difficulty||(verdict.responseFormat??'unknown')!==(item.responseFormat??'unknown')
   ||(verdict.familyKey??item.itemKey)!==(item.familyKey||item.itemKey))continue;
  if(!prChoices(item))continue;
  pool.push(item);
 }
 return Object.freeze(pool);
}
// 연습에 낼 수 있는 문항: 검수를 통과한 기존 읽기 문항 + 공개 TOPIK 은행 문항(이미 검수 통과만 실린다). 같은 문항 id는 한 번만.
export function practicePool({items=[],verdicts=null,bank=[]}={}){
 const pool=[...passedItems({items,verdicts})],ids=new Set(pool.map(item=>item.id));
 for(const item of Array.isArray(bank)?bank:[]){
  if(!prRecord(item)||ids.has(item.id)||!PRACTICE_SKILL.test(item.skillId||'')||item.skillId.split('.')[1]!==item.modality||!prChoices(item))continue;
  if(prListening(item)&&typeof item.audio!=='string')continue;
  ids.add(item.id);pool.push(item);
 }
 return Object.freeze(pool);
}

// 본 적 있음(true)·모름(null)은 둘 다 「처음 보는 문항」이 아니다(진단과 같은 규칙). 세트는 한 문항을 봤으면 세트 전체가 처음이 아니다.
const freshOf=(pool,seen)=>freshBySet(pool,seen);
// 같은 순서를 늘 같게: 문항 열쇠로 섞은 순서(정답 자리·출처가 한쪽으로 몰리지 않게).
function prOrder(key){let h=2166136261;for(const c of String(key))h=Math.imul(h^c.codePointAt(0),16777619)>>>0;return h;}
// 이 항목에서 처음 볼 난도: 아직 「최근 혼자 수행」이 아닌 가장 쉬운 난도(Core readyForHarder·진단과 같은 생각).
function prTarget(skill){
 for(const difficulty of [1,2,3])if(skill?.levels?.[difficulty]?.status!=='recent-independent')return difficulty;
 return 3;
}
function sortFor(items,skill){
 const target=prTarget(skill),format=item=>PRACTICE_POLICY.formats.indexOf(item.responseFormat??'unknown');
 return [...items].sort((a,b)=>Math.abs(a.difficulty-target)-Math.abs(b.difficulty-target)||a.difficulty-b.difficulty||format(a)-format(b)||prOrder(a.itemKey)-prOrder(b.itemKey)||a.id.localeCompare(b.id));
}

// 항목별 남은 새 문항 수(seen이 모르는 문항은 세지 않는다). 내 위치의 「이 항목 연습하기」와 계획의 숙제 묶음이 쓴다.
// audioAvailable이 거짓이면 듣기 문항은 세지 않는다(소리를 못 쓰는 날).
export function practiceSupply({pool=[],seen,audioAvailable=true}={}){
 if(typeof seen!=='function')throw TypeError('WORLD practice needs an exposure reader');
 const supply={};
 for(const item of freshOf(pool,seen))if(audioAvailable||!prListening(item))supply[item.skillId]=(supply[item.skillId]||0)+1;
 return supply;
}

// Core에 넘길 후보: 새 문항이 하나라도 남은 항목마다 하나. targets는 그 항목의 새 문항(Core 문항 정책이 형식·난도·노출을 본다).
// label은 한국어 이름(홈이 화면 언어로 바꾼다 · home.mjs planLabel). goals: 시험·영역 목표와 이어진다(exam·prepare는 한 목표의 두 표현,
// 이중 가산은 world-learning-plan.mjs worldLearningSettings가 막는다). 듣기 후보는 소리가 있어야 한다(audioRequired).
export function practiceCandidates({pool=[],seen,summary=null,presentation=null,labels={}}={}){
 if(typeof seen!=='function')throw TypeError('WORLD practice needs an exposure reader');
 const skills=new Map((prRecord(summary)&&Array.isArray(summary.skills)?summary.skills:[]).map(skill=>[skill.id,skill]));
 const bySkill=new Map();
 for(const item of freshOf(pool,seen)){if(!bySkill.has(item.skillId))bySkill.set(item.skillId,[]);bySkill.get(item.skillId).push(item);}
 return [...bySkill].sort(([a],[b])=>a.localeCompare(b)).map(([skillId,items])=>{
  const modality=skillId.split('.')[1],chosen=sortFor(items,skills.get(skillId)).slice(0,PRACTICE_POLICY.count),listening=modality==='listening';
  return {id:`world.practice.${skillId}`,label:`${listening?'듣기':'읽기'} 짧은 연습 · ${labels[skillId]||skills.get(skillId)?.label||skillId}`,route:'practice',skillId,
   minutes:Math.max(2,Math.ceil(chosen.length*(listening?.8:.5))),minutesEstimated:true,
   targets:items.map(item=>({id:item.id,skillIds:[item.skillId],difficulty:item.difficulty,modality,responseFormat:item.responseFormat??'unknown',
    familyKeys:[item.familyKey||item.itemKey],itemKey:item.itemKey,conceptIds:Array.isArray(item.conceptIds)?[...item.conceptIds]:[]})),
   goals:['exam','prepare',modality,'study'],supports:['choose','step','independent'],audioRequired:listening,modality,
   fresh:items.length,...(presentation?{presentation:{...presentation}}:{})};
 });
}

// 한 항목의 연습 묶음: 그 항목의 새 문항만 count개까지. 모자라면 있는 만큼, 없으면 'none'으로 돌려준다 —
// 다른 항목 문항으로 채워 그 약점 연습인 척하지 않는다(학습기준 §7-4 「검수된 문항이 없음」).
export function selectPractice({summary=null,pool=[],seen,skillId,count=PRACTICE_POLICY.count,audioAvailable=true}={}){
 if(typeof seen!=='function'||!PRACTICE_SKILL.test(skillId||'')||!Number.isInteger(count)||count<1)throw TypeError('WORLD practice needs a skill, a count and an exposure reader');
 const skill=(prRecord(summary)&&Array.isArray(summary.skills)?summary.skills:[]).find(row=>row.id===skillId)||null;
 const mine=pool.filter(item=>item.skillId===skillId);
 const common={policy:PRACTICE_POLICY.version,skillId,learningEffectClaim:false,grade:null};
 if(!prRecord(summary)||summary.evidenceComplete!==true)return {...common,status:'none',reason:'history.incomplete',items:[],fresh:0};
 if(!mine.length)return {...common,status:'none',reason:'no-item',items:[],fresh:0};
 if(!audioAvailable&&mine.every(prListening))return {...common,status:'none',reason:'audio',items:[],fresh:0};
 const fresh=freshOf(pool,seen).filter(item=>item.skillId===skillId&&(audioAvailable||!prListening(item)));
 if(!fresh.length)return {...common,status:'none',reason:'all-seen',items:[],fresh:0};
 // 한 묶음에 같은 세트에서 둘은 내지 않는다(한 지문을 두 번 처음처럼 내지 않게).
 const items=[],sets=new Set();
 for(const item of sortFor(fresh,skill)){if(items.length>=count)break;if(item.setId&&sets.has(item.setId))continue;if(item.setId)sets.add(item.setId);items.push(item);}
 return {...common,status:items.length<count?'short':'ready',reason:items.length<count?'few-items':null,items,fresh:fresh.length};
}

// 연습 한 바퀴. 진단 실행기와 같은 코치 계약(present → (듣기면) 끝까지 들음 → answer)으로 남기므로 답은 처음 본 문항에 혼자 낸 첫 시도다.
// 답한 뒤에 정답·해설을 보이는 것은 그 시도가 끝난 뒤라 첫 답의 독립성은 그대로이고, 보인 사실은 「정답 보기」 도움으로 남긴다
// (atlas/game-learning.js recheck가 그 뒤 새 문항 확인에서 「정정을 본 뒤」인지 읽는다). 건너뛰면 평가할 수 없는 답이다.
// 듣기: 끝까지 들은 뒤에만 답을 받고, 시험형 문항은 허용 재생 수까지 혼자·그 뒤는 도움(world-exam-form.mjs). 실제 재생은 매번 남긴다.
const prMeasure=item=>({id:item.id,itemKey:item.itemKey,familyKey:item.familyKey||item.itemKey,skillId:item.skillId,modality:item.modality,
 difficulty:item.difficulty,responseFormat:item.responseFormat??'unknown',audioRequired:prListening(item),confounded:false,
 ...(Array.isArray(item.conceptIds)?{conceptIds:[...item.conceptIds]}:{})});
export function createPracticeSession({coach,items}={}){
 if(!coach||['present','answer','help','delivery'].some(name=>typeof coach[name]!=='function')||!Array.isArray(items)||!items.length)throw TypeError('WORLD practice needs the learning coach and its items');
 const queue=items.map(item=>{
  if(!prRecord(item)||!PRACTICE_SKILL.test(item.skillId||'')||item.skillId.split('.')[1]!==item.modality||!prChoices(item)||prListening(item)&&typeof item.audio!=='string')throw TypeError('WORLD practice: an item needs its skill, choices and answer');
  return item;
 });
 const results=[];let index=-1,current=null,stopped=false;
 const view=()=>current&&{index,total:queue.length,item:current.item,answered:current.answered,feedback:current.feedback,heard:current.heard,audio:current.audio,
  plays:{...current.plays},next:nextPlay(current.plays,{heard:current.heard})};
 const close=(result,choiceId,skipped)=>{current.answered=true;const row={skillId:current.item.skillId,itemId:current.item.id,itemKey:current.item.itemKey,choiceId,skipped,
  verdict:result.verdict,independent:result.independent===true,assisted:result.assisted??null,eventId:result.eventId??null,plays:{...current.plays}};results.push(row);return {...row};};
 const skip=()=>{
  if(!current||current.answered)return null;
  return close(coach.answer(current.pid,{correct:null,assessable:false,reason:current.heard?'unanswered':'audio'}),null,true);
 };
 return Object.freeze({
  get total(){return queue.length;},
  get current(){return view();},
  results:()=>results.map(row=>({...row})),
  next(){
   if(stopped)return null;
   if(current&&!current.answered)throw Error('WORLD practice: answer or skip the current item first');
   index+=1;if(index>=queue.length){current=null;return null;}
   const item=queue[index],listening=prListening(item);
   current={item,pid:coach.present(prMeasure(item),presentCondition(item,{content:'world-practice'})),answered:false,feedback:null,heard:!listening,audio:listening?'pending':'none',
    plays:{allowed:allowedPlays(item),completed:0,extra:0}};
   return view();
  },
  // 듣기 한 번 시작: 'first' · 'allowed'(도움 아님) · 'extra'(도움). 진단 실행기와 같다.
  replay(){
   if(!current||current.answered||!prListening(current.item))return false;
   const kind=nextPlay(current.plays,{heard:current.heard});
   if(kind==='first'){current.audio='pending';coach.delivery(current.pid,{audio:'pending'});}
   else if(kind==='extra'){coach.help(current.pid,'replay');current.plays.extra+=1;}
   return kind;
  },
  // 실제 재생기의 결과만 받는다. 끝까지 들은 재생은 매번 남기고, 다 들은 뒤의 실패는 들은 사실을 지우지 않는다.
  delivery(status){
   if(!current||current.answered||!prListening(current.item))return false;
   if(!['pending','completed','failed'].includes(status))throw TypeError('WORLD practice: invalid audio state');
   if(current.heard){if(status==='completed'){current.plays.completed+=1;coach.delivery(current.pid,{audio:'completed'});}return true;}
   current.audio=status;if(status==='completed'){current.heard=true;current.plays.completed+=1;}coach.delivery(current.pid,{audio:status});return true;
  },
  // 답 → 기록 → 맞음·틀림과 정답. 정답·해설을 보인 사실은 그다음에 도움(answer)으로 남긴다.
  answer(choiceId){
   if(!current||current.answered||!current.heard)return null;
   if(!current.item.choices.some(choice=>choice.id===choiceId))throw TypeError('WORLD practice: unknown choice');
   const result=coach.answer(current.pid,{correct:choiceId===current.item.correctId,assessable:true,choice:{selectedId:choiceId,correctId:current.item.correctId}});
   const row=close(result,choiceId,false);
   try{coach.help(current.pid,'answer');}catch{/* The answer itself is already recorded. */}
   current.feedback={verdict:row.verdict,choiceId,correctId:current.item.correctId};
   return {...row,correctId:current.item.correctId};
  },
  skip,
  // 그만두면 보이던 문항은 건너뛴 것으로 남기고, 아직 안 보인 문항은 기록하지 않는다.
  stop(){if(stopped)return;skip();stopped=true;current=null;},
 });
}
