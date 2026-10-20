// WORLD 「읽기 짧은 연습」(2026-10-20 TOPIK 맞춤 재설계 · 최종 제안 §2-1 ①, 결정 표 10-20 「재설계 진행」).
// 읽기 약점이 실제 읽기 출제로 이어지는 고리: 약한 항목 → 그 항목의 새 문항 몇 개 → 답을 학습 기록(Trail)에 → 다음 추천(Core).
// 문항은 짧은 진단 묶음(world-diagnostic-items.mjs)의 읽기 문항 가운데, 문항 검수(experiences/topik-items/review/
// existing-verdicts.json, AI 2중 검수)가 통과(pass)로 판정하고 검수가 확인한 항목·난도·형식·계열이 문항 메타와 같은 것만 쓴다.
// 문항을 새로 만들거나 고치지 않는다. 판정 목록에 없는 문항은 내지 않는다(허용 목록).
// 순위는 Core가 정한다: 항목마다 후보(targets에 그 항목의 새 문항)를 넘기고 Core recommendActivities가 고른다.
// 이 모듈은 상태를 새로 계산하지 않고, 진단 선택기(항목마다 하나)와 달리 한 항목에서 새 문항 여러 개를 고른다.
// 지금은 WORLD 한 제품만 쓰므로 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion). 화면 글은 없다.

export const PRACTICE_POLICY=Object.freeze({version:'world-reading-practice-1',count:5,
 // 연습 기록을 남기는 코치(경험) 이름. 내 위치 근거 줄이 「읽기 짧은 연습」으로 읽는다(world-position-ui.mjs itemSource).
 gameId:'world-practice',
 // 보기 고르기에 가까운 형식부터(진단과 같은 순서).
 formats:Object.freeze(['single-choice','binary-choice','action','cup-compose','unknown'])});
const VERDICT_VERSION='topik-existing-verdicts-1';
const prRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const prToken=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const READING_SKILL=/^ko\.reading\.[a-z]+$/;

// 연습에 낼 수 있는 문항: 읽기 문항 × 검수 통과 × 검수가 확인한 메타와 같음. 판정 목록을 읽지 못하면 하나도 내지 않는다.
// 같은 itemKey의 판정이 둘 이상이거나 서로 다르면 그 문항은 뺀다(어느 판정이 맞는지 모른다).
export function practicePool({items=[],verdicts=null}={}){
 if(!Array.isArray(items)||!prRecord(verdicts)||verdicts.version!==VERDICT_VERSION||!Array.isArray(verdicts.items))return Object.freeze([]);
 const judged=new Map(),conflicted=new Set();
 for(const row of verdicts.items){
  if(!prRecord(row)||!prToken(row.itemKey))continue;
  if(judged.has(row.itemKey))conflicted.add(row.itemKey);
  judged.set(row.itemKey,row);
 }
 const pool=[];
 for(const item of items){
  if(!prRecord(item)||item.modality!=='reading'||!READING_SKILL.test(item.skillId||'')||item.audioRequired===true)continue;
  const verdict=judged.get(item.itemKey);
  if(!verdict||conflicted.has(item.itemKey)||verdict.verdict!=='pass')continue;
  if(verdict.skillId!==item.skillId||verdict.difficulty!==item.difficulty||(verdict.responseFormat??'unknown')!==(item.responseFormat??'unknown')
   ||(verdict.familyKey??item.itemKey)!==(item.familyKey||item.itemKey))continue;
  if(!Array.isArray(item.choices)||item.choices.length<2||!item.choices.some(choice=>choice?.id===item.correctId))continue;
  pool.push(item);
 }
 return Object.freeze(pool);
}

// 본 적 있음(true)·모름(null)은 둘 다 「처음 보는 문항」이 아니다(진단과 같은 규칙).
function freshOf(pool,seen){
 const fresh=[];
 for(const item of pool){let value=null;try{value=seen(item);}catch{value=null;}if(value===false)fresh.push(item);}
 return fresh;
}
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
export function practiceSupply({pool=[],seen}={}){
 if(typeof seen!=='function')throw TypeError('WORLD practice needs an exposure reader');
 const supply={};
 for(const item of freshOf(pool,seen))supply[item.skillId]=(supply[item.skillId]||0)+1;
 return supply;
}

// Core에 넘길 후보: 새 문항이 하나라도 남은 읽기 항목마다 하나. targets는 그 항목의 새 문항(Core 문항 정책이 형식·난도·노출을 본다).
// label은 한국어 이름(홈이 화면 언어로 바꾼다 · home.mjs planLabel). goals: 시험·읽기 목표와 이어진다(exam·prepare는 한 목표의 두 표현,
// 이중 가산은 world-learning-plan.mjs worldLearningSettings가 막는다).
export function practiceCandidates({pool=[],seen,summary=null,presentation=null,labels={}}={}){
 if(typeof seen!=='function')throw TypeError('WORLD practice needs an exposure reader');
 const skills=new Map((prRecord(summary)&&Array.isArray(summary.skills)?summary.skills:[]).map(skill=>[skill.id,skill]));
 const bySkill=new Map();
 for(const item of freshOf(pool,seen)){if(!bySkill.has(item.skillId))bySkill.set(item.skillId,[]);bySkill.get(item.skillId).push(item);}
 return [...bySkill].sort(([a],[b])=>a.localeCompare(b)).map(([skillId,items])=>{
  const chosen=sortFor(items,skills.get(skillId)).slice(0,PRACTICE_POLICY.count);
  return {id:`world.practice.${skillId}`,label:`읽기 짧은 연습 · ${labels[skillId]||skills.get(skillId)?.label||skillId}`,route:'practice',skillId,
   minutes:Math.max(2,Math.ceil(chosen.length/2)),minutesEstimated:true,
   targets:items.map(item=>({id:item.id,skillIds:[item.skillId],difficulty:item.difficulty,modality:'reading',responseFormat:item.responseFormat??'unknown',
    familyKeys:[item.familyKey||item.itemKey],itemKey:item.itemKey,conceptIds:Array.isArray(item.conceptIds)?[...item.conceptIds]:[]})),
   goals:['exam','prepare','reading','study'],supports:['choose','step','independent'],audioRequired:false,modality:'reading',
   fresh:items.length,...(presentation?{presentation:{...presentation}}:{})};
 });
}

// 한 항목의 연습 묶음: 그 항목의 새 문항만 count개까지. 모자라면 있는 만큼, 없으면 'none'으로 돌려준다 —
// 다른 항목 문항으로 채워 그 약점 연습인 척하지 않는다(학습기준 §7-4 「검수된 문항이 없음」).
export function selectPractice({summary=null,pool=[],seen,skillId,count=PRACTICE_POLICY.count}={}){
 if(typeof seen!=='function'||!READING_SKILL.test(skillId||'')||!Number.isInteger(count)||count<1)throw TypeError('WORLD practice needs a reading skill, a count and an exposure reader');
 const skill=(prRecord(summary)&&Array.isArray(summary.skills)?summary.skills:[]).find(row=>row.id===skillId)||null;
 const mine=pool.filter(item=>item.skillId===skillId);
 const common={policy:PRACTICE_POLICY.version,skillId,learningEffectClaim:false,grade:null};
 if(!prRecord(summary)||summary.evidenceComplete!==true)return {...common,status:'none',reason:'history.incomplete',items:[],fresh:0};
 if(!mine.length)return {...common,status:'none',reason:'no-item',items:[],fresh:0};
 const fresh=freshOf(mine,seen);
 if(!fresh.length)return {...common,status:'none',reason:'all-seen',items:[],fresh:0};
 const items=sortFor(fresh,skill).slice(0,count);
 return {...common,status:items.length<count?'short':'ready',reason:items.length<count?'few-items':null,items,fresh:fresh.length};
}

// 연습 한 바퀴. 진단 실행기와 같은 코치 계약(present → answer)으로 남기므로 답은 처음 본 문항에 혼자 낸 첫 시도다.
// 답한 뒤에 정답·해설을 보이는 것은 그 시도가 끝난 뒤라 첫 답의 독립성은 그대로이고, 보인 사실은 「정답 보기」 도움으로 남긴다
// (atlas/game-learning.js recheck가 그 뒤 새 문항 확인에서 「정정을 본 뒤」인지 읽는다). 건너뛰면 평가할 수 없는 답이다.
// 읽기 문항만 받는다(듣기는 녹음 규칙이 다르다 — 진단 실행기를 쓴다).
const prMeasure=item=>({id:item.id,itemKey:item.itemKey,familyKey:item.familyKey||item.itemKey,skillId:item.skillId,modality:item.modality,
 difficulty:item.difficulty,responseFormat:item.responseFormat??'unknown',audioRequired:false,confounded:false,
 ...(Array.isArray(item.conceptIds)?{conceptIds:[...item.conceptIds]}:{})});
export function createPracticeSession({coach,items}={}){
 if(!coach||['present','answer','help'].some(name=>typeof coach[name]!=='function')||!Array.isArray(items)||!items.length)throw TypeError('WORLD practice needs the learning coach and its items');
 const queue=items.map(item=>{
  if(!prRecord(item)||item.modality!=='reading'||!READING_SKILL.test(item.skillId||'')||!Array.isArray(item.choices)||!item.choices.some(choice=>choice?.id===item.correctId))throw TypeError('WORLD practice: an item needs its reading skill, choices and answer');
  return item;
 });
 const results=[];let index=-1,current=null,stopped=false;
 const view=()=>current&&{index,total:queue.length,item:current.item,answered:current.answered,feedback:current.feedback};
 const close=(result,choiceId,skipped)=>{current.answered=true;const row={skillId:current.item.skillId,itemId:current.item.id,itemKey:current.item.itemKey,choiceId,skipped,
  verdict:result.verdict,independent:result.independent===true,assisted:result.assisted??null,eventId:result.eventId??null};results.push(row);return {...row};};
 const skip=()=>{
  if(!current||current.answered)return null;
  return close(coach.answer(current.pid,{correct:null,assessable:false,reason:'unanswered'}),null,true);
 };
 return Object.freeze({
  get total(){return queue.length;},
  get current(){return view();},
  results:()=>results.map(row=>({...row})),
  next(){
   if(stopped)return null;
   if(current&&!current.answered)throw Error('WORLD practice: answer or skip the current item first');
   index+=1;if(index>=queue.length){current=null;return null;}
   current={item:queue[index],pid:coach.present(prMeasure(queue[index])),answered:false,feedback:null};
   return view();
  },
  // 답 → 기록 → 맞음·틀림과 정답. 정답·해설을 보인 사실은 그다음에 도움(answer)으로 남긴다.
  answer(choiceId){
   if(!current||current.answered)return null;
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
