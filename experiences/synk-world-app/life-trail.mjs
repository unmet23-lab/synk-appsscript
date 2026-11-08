// 생활 한국어의 배움을 Trail practice로 거울 기록한다(Atlas × WORLD 2단계 D, 2026-11-08 · 설계 docs/_ops/qa/atlas-world-engine-20261108/D_생활한국어.md §4-2).
// 제품 기록(life-progress.mjs)은 그대로 두고, 같은 순간에 같은 사실을 WORLD 코치(경험 world-life)의 present → delivery → help → answer로 남긴다.
// 판정 · 정답은 제품이 정한 것 그대로이고, 독립 · 도움 · 첫 노출 판정은 Trail이 한다. 이 모듈은 기록을 새로 계산하거나 화면을 바꾸지 않는다.
// 거울이 실패해도 레슨은 막히지 않는다(모든 코치 호출은 삼킨다). 판(slot) 하나 = 한 화면 실행 안의 「레슨 시도 · 복습 회차 · 문항」.
import {lifeItem,lifeItems,lifeAssessable,lifeMeasureItem,lifeFamilyMembers} from './life-items.mjs';

// 제품 진도가 이 문항의 계열을 이미 만났는가(설계 §4-2 ⑦). 거울이 빠졌던 문항을 다시 보일 때 Trail이 「처음」으로 읽어도
// 근거로 세지 않게 한다 — 근거를 지우는 쪽으로만 틀린다. snapshot은 life-progress exportSnapshot().
export function productMet(item,snapshot){
 if(!item||!snapshot||typeof snapshot!=='object')return true;
 const lessons=snapshot.lessons||{},reviews=snapshot.reviews||{},days=Object.values(snapshot.daily?.days||{});
 const guided=questionId=>days.some(day=>day?.items?.[questionId]?.guidedAt!==undefined);
 for(const member of lifeFamilyMembers(item.familyKey)){
  const run=lessons[member.lessonId],main=run?.answers?.[member.questionId];
  // 다시 하기 판: 이미 마친 레슨을 다시 열면 시작 시각이 처음 마친 시각보다 뒤다(제품은 다시 마쳐도 처음 마친 시각을 지킨다).
  const replay=!!run&&run.completedAt!=null&&Number.isFinite(run.startedAt)&&run.startedAt>run.completedAt;
  if(!member.review){
   // 본문항: 지금 판에 답이 있거나, 이미 마친 레슨이면(그 레슨의 모든 문항을 이미 풀었다) 만났다.
   if(main||run&&run.completedAt!=null)return true;
   continue;
  }
  const record=reviews[`${member.questionId}-transfer`];
  if(snapshot.activeReview?.answers?.[`${member.questionId}-transfer`])return true;
  // 튜터 「이 표현 같이 연습」은 레슨 도중(본문항 답 · 복습 기록 전)에도 열려 복습 원고와 해설을 보인다 — 기록이 없어도 만났다.
  if(guided(member.questionId))return true;
  if(!record)continue;
  // 새 상황 복습: 맞힌 적 있음 · 본문항 답보다 뒤에 갱신됨 · 본문항 답 기록 없이 복습 기록만 남음 · 다시 하기 판(본문항을 다시 풀면
  // 제품이 복습의 마지막 시각을 그 답 시각으로 덮어 그 앞의 복습 풀이가 안 보인다 — 다시 검수 GPT Q4) — 하나라도 맞으면 만났다.
  if(record.streak>0||!main||replay||Number.isFinite(record.lastAt)&&record.lastAt>main.at)return true;
 }
 return false;
}

// assessable: 판정 자격(기본은 AI 2중 검수 목록 — life-items.mjs lifeAssessable). 시험이 판정 목록 없이 계약을 볼 때만 바꾼다.
export function createLifeTrail({coach=()=>null,snapshot=()=>null,onError=null,assessable=lifeAssessable}={}){
 const slots=new Map();let disposed=false;
 const quiet=fn=>{try{return fn();}catch(error){try{onError?.(error);}catch{/* reporting cannot break a lesson */}return null;}};
 // 판을 코치에 처음 보이는 자리. 코치가 아직 없으면(계정 통로 준비 전) 다음 보임 · 도움 · 소리 · 답 때 다시 시도한다.
 function ensure(slot){
  if(disposed||!slot)return null;
  if(slot.pid)return slot.pid;
  const c=quiet(()=>coach());
  if(!c||typeof c.present!=='function')return null;
  // 코치가 없을 때 연 튜터 안내 연습(guided)은 코치가 생긴 첫 자리에서 먼저 보인다 — 그 복습 원고 · 해설을 본 일이
  // 뒤의 보임 · 답보다 앞에 남게(끝 판 검수 Fable F2 — 안내 연습을 끝내지 않으면 제품에도 guidedAt이 없다).
  if(!slot.guided)for(const other of slots.values())if(other.guided&&!other.pid)present(other,c);
  return present(slot,c);
 }
 function present(slot,c){
  // 제품 이력 대조는 문항이 보인 순간(shown · guided)에 잰 값을 쓴다 — 늦게 준비된 코치로 답할 때 이어 적으면
  // 그때의 진도에는 방금 낸 답이 들어 있어 「이미 만남」으로 잘못 읽힌다.
  // 대조는 Trail이 이 문항 · 계열을 처음으로 볼 때만 건다 — Trail이 이미 그 계열을 봤으면 Trail 판정(반복)이 맞고,
  // 같은 표현 계열의 다른 문항까지 근거에서 빼면 안 된다(다시 검수 그록 KA1). 노출을 모르면(null) 대조를 그대로 건다.
  const trailSeen=quiet(()=>c.exposure?.({itemKey:slot.item.itemKey,familyKey:slot.item.familyKey})?.seen);
  slot.assessable=quiet(()=>assessable(slot.item))===true&&(slot.met===false||trailSeen===true);
  const pid=quiet(()=>c.present(lifeMeasureItem(slot.item)));
  if(!pid)return null;
  slot.coach=c;slot.pid=pid;
  if(slot.pendingHelp){const kind=slot.pendingHelp;slot.pendingHelp=null;give(slot,kind);}
  return pid;
 }
 function give(slot,kind){
  if(!slot.pid){slot.pendingHelp||=kind;return;}
  if(quiet(()=>slot.coach.help(slot.pid,kind))!==null)slot.helped=true;
 }
 const slotOf=key=>typeof key==='string'?slots.get(key)||null:null;
 return Object.freeze({
  // 문항이 보였다 — 판을 열고 그 자리에서 코치에 보인다(그 순간의 제품 이력 대조와 도움 상태를 잰다). item: lifeItem(...) 결과.
  // 보인 순간에 적는다(설계 §4-2 ② 4판 — 끝 판 검수 GPT GB1 · Fable F1): 엔진 노출 계약을 따른다. 코치 노출(atlas/game-learning.js exposure)은
  // 답하지 않고 보인 문항도 처음 보는 문항이 아니라고 보고, Temper 짝(temper.js fresh)은 그 문항 · 계열의 첫 보임 판의 답만 고른다 — 그래서 흘끗 본 문항은
  // 재확인 공급(life-followups.mjs)에서 빠지고, 흘끗 보고 새로고침한 뒤의 첫 답은 Temper 짝이 못 된다(2판이 늦은 보임으로 지키려던 것을 버린다).
  // Trail 근거의 「처음」(trail.js firstExposure)은 답 · 정답 보임으로만 깨지므로 그 답도 근거 · 앵커로는 남는다. 같은 판을 다시 그려도 보임은 하나다.
  // 코치가 아직 없으면(계정 통로 준비 전) 다음 도움 · 소리 · 답 때 다시 보인다.
  // helped: 제품이 이 문항의 도움을 이미 펼쳤다(설정 · 새로고침 뒤 이어 하기) — 보이자마자 도움으로 적는다.
  shown(key,item,{helped=false}={}){
   if(disposed||typeof key!=='string'||!item)return null;
   let slot=slots.get(key);
   if(!slot){slot={key,item,pid:null,coach:null,helped:false,answered:false,assessable:false,met:quiet(()=>productMet(item,snapshot())),pendingHelp:null};slots.set(key,slot);}
   ensure(slot);
   if(helped&&!slot.helped)give(slot,'explanation');
   return slot.pid;
  },
  // 답하기 전에 연 도움(해설 펼침 'explanation' · 카페 힌트 'hint' · 글자로 보기 'text' · 느리게 'replay').
  help(key,kind='explanation'){
   const slot=slotOf(key);if(!slot||slot.answered||!['explanation','hint','text','replay'].includes(kind))return;
   ensure(slot);give(slot,kind);
  },
  // 실제 재생기의 결과(카페 직원 말). 장면 문항이라 판정에 쓰이지 않지만 들린 사실은 그대로 남긴다.
  delivery(key,audio){
   const slot=slotOf(key);if(!slot||slot.answered||!['pending','completed','failed'].includes(audio))return;
   if(ensure(slot))quiet(()=>slot.coach.delivery(slot.pid,{audio}));
  },
  // 첫 답. helped: 제품이 그 답을 도움 받은 답으로 적었는가(진도 단계에 남아 새로고침을 지난다) — 이 판에 도움이 없으면 먼저 적는다.
  answer(key,{correct,choiceId=null,correctId=null,helped=false}={}){
   const slot=slotOf(key);if(!slot||slot.answered||typeof correct!=='boolean')return null;
   if(!ensure(slot))return null;
   if(helped&&!slot.helped)give(slot,'explanation');
   const choice=typeof choiceId==='string'&&typeof correctId==='string'?{choice:{selectedId:choiceId,correctId}}:{};
   const result=quiet(()=>slot.coach.answer(slot.pid,{correct,assessable:slot.assessable,...choice}));
   slot.answered=true;
   // 판정 띠가 정답 · 해설을 보인다 — 정답을 본 사실(그 뒤 다른 판의 같은 계열은 처음이 아니다).
   quiet(()=>slot.coach.help(slot.pid,'answer'));
   return result;
  },
  // 튜터 「이 표현 같이 연습」: 복습 원고를 미리 보인다. 보임 + 도움만 남기고 답은 남기지 않는다(실패 · 취소가 제품에 오지 않는다).
  guided(item){
   if(disposed||!item)return;
   const key=`guided:${item.itemKey}`;let slot=slots.get(key);
   if(!slot){slot={key,item,pid:null,coach:null,helped:false,answered:false,assessable:false,met:true,pendingHelp:'explanation',guided:true};slots.set(key,slot);}
   // 코치가 아직 없으면 판을 남겨 두고, 코치가 생긴 첫 보임 · 도움 · 소리 · 답 자리에서 먼저 보인다(ensure).
   if(!slot.pid)ensure(slot);
  },
  // 지금 화면의 판을 놓는다(같은 문항을 새 판으로 다시 보일 때). 보이고 답하지 않은 판은 그대로 「보임」으로 남는다.
  release(key){slots.delete(key);},
  metrics:()=>({slots:slots.size,presented:[...slots.values()].filter(slot=>slot.pid).length,answered:[...slots.values()].filter(slot=>slot.answered).length}),
  dispose(){disposed=true;slots.clear();},
 });
}

// 화면이 쓰는 이름표: 레슨 문항 · 복습 문항의 판 열쇠와 그 문항의 엔진 정체.
export const lessonSlot=(attemptId,questionId)=>`lesson:${attemptId}:${questionId}`;
export const reviewSlot=(runId,reviewId)=>`review:${runId}:${reviewId}`;
export {lifeItem};
// 계정 · 생활 묶음이 화면 모듈에 넘기는 부품 한 벌(worldLearning.life). 화면 모듈(life-ui · world-learning-ui · life-followups)은
// 브라우저가 바로 읽어 Strata · 판정 목록을 직접 부를 수 없다.
export const lifeEngine=Object.freeze({createLifeTrail,lifeItem,lifeItems,lifeAssessable,productMet,lessonSlot,reviewSlot});
