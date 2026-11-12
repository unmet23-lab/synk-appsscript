import {lifeTutorExpression} from './life-tutor-lines.mjs';
import {homeDayKey,homeTutorDays,homeTutorMemoryLine} from './home-tutor-days.mjs';

// 「방금」의 창: 레슨 · 복습을 막 마치고 홈에 돌아온 사람으로 읽는 30분. 인사(homeTutorLine)와 돌아온 복습의 「방금 만난 말」(fresh)이 같은 창을 쓴다.
const JUST_NOW=30*60000;
// Recommendations read the existing owner-scoped progress; they never grade it.
export function homeTutorRecommendation({owner,summary,snapshot,lessons=[],practised=new Map(),now=Date.now()}={}){
 if(!summary||summary.owner!==owner||snapshot?.owner!==owner||summary.status?.phase==='loading')return {kind:'loading'};
 if(['unreadable','conflict'].includes(summary.status?.phase)||summary.status?.rejected||summary.status?.code==='LIFE_PROGRESS_REJECTED')return {kind:'unavailable'};
 if(summary.education?.status==='unavailable')return {kind:'conditions',command:'study',label:'학습 조건 바꾸기',reason:'지금 조건에 맞는 활동이 없어요. 시간이나 도움 방식을 바꿀 수 있어요.'};
 if(summary.education?.selected){const next=summary.education.selected;return {kind:summary.education.resume?'resume':'start',title:next.label||next.title,command:'learn',label:next.route==='review'?'나의 복습 시작':'맞춤 연습 시작',reason:summary.education.reason};}
 const known=Object.values(snapshot.reviews||{}).flatMap(r=>{
  const lesson=lessons.find(l=>l.id===r.lessonId),q=lesson?.questions.find(q=>q.id===r.questionId&&q.review?.id===r.id);
  return q?[{...r,expressionId:q.expressionId,title:lifeTutorExpression(lesson,q),lessonTitle:lesson.title}]:[];
 });
 // 돌아온 복습: 새 길(atlasNext — 4-2, 단계4_계획 §19-1 ⑤)은 진도 요약에 넣은 판정(dueState · dueIds — 확인 중이면 없음), 지금 판은 진도의 dueAt.
 const dueIds=summary.dueState?new Set(Array.isArray(summary.dueIds)?summary.dueIds:[]):null,isBack=r=>dueIds?dueIds.has(r.id):r.dueAt<=now;
 const todayItems=snapshot.daily?.days?.[homeDayKey(now)]?.items||{};
 const practisedToday=r=>{
  const family=known.filter(k=>k.expressionId===r.expressionId).flatMap(k=>{const item=todayItems[k.questionId];return item?.lessonId===k.lessonId?[item]:[];});
  const guidedAt=Math.max(0,...family.map(item=>item.guidedAt<=now+60000?item.guidedAt||0:0));
  const wrongAt=Math.max(0,...family.map(item=>item.outcome==='retry'?item.observedAt||0:0));
  return guidedAt>0&&guidedAt>=wrongAt;
 };
 const days=homeTutorDays(snapshot,lessons,now),previous=days.previous?.items[0];
 const memory=previous?{...previous,when:days.when}:null;
 const returning=known.find(r=>r.questionId===previous?.id&&isBack(r)&&!practisedToday(r));
 if(returning&&['guided','assisted'].includes(previous.kind)&&!days.today.count){
  const run=snapshot.activeReview,firstPending=run?.ids.find(id=>!run.answers[id]);
  return {kind:'recall',id:returning.questionId,title:returning.title,command:'review',label:'오늘의 복습 시작',memory:{...memory,tryAlone:!firstPending||firstPending===returning.id&&!run.pendingHelp?.[returning.id]}};
 }
 const difficult=known.filter(r=>r.lapses>0&&r.streak===0&&practised.get(r.questionId)!==r.lastAt&&!practisedToday(r))
  .sort((a,b)=>Number(isBack(b))-Number(isBack(a))||b.lastAt-a.lastAt||a.id.localeCompare(b.id))[0];
 if(difficult)return {kind:'difficult',id:difficult.questionId,title:difficult.title,lessonTitle:difficult.lessonTitle,lastAt:difficult.lastAt,command:'practice',label:'이 표현 같이 연습',...(memory&&!days.today.count&&memory.id===difficult.questionId?{memory}:{})};
 // fresh: 돌아온 복습 가운데 30분 안에 답한 문제가 있다(레슨에서 틀린 말이 1분 뒤 돌아온 때) — 튜터가 「방금 만난 말」이라고 해도 되는 때만(끝 판 F2).
 // 오늘 기록만 보면 아침에 맞혀 둔 복습 문항이 저녁 레슨 직후 「방금」으로 읽힌다(끝 판 FA1).
 const back=known.filter(r=>isBack(r)&&!practisedToday(r));
 const metJustNow=r=>{const item=todayItems[r.questionId];return item?.lessonId===r.lessonId&&now-Math.max(item.observedAt||0,item.guidedAt||0)<JUST_NOW;};
 if(summary.dueCount&&back.length)return {kind:'review',command:'review',label:'오늘의 복습 열기',...(back.some(metJustNow)?{fresh:true}:{}),...(memory&&!days.today.count?{memory}:{})};
 if(summary.nextLesson)return {kind:summary.resume?'resume':'start',title:summary.nextLesson.title,command:'learn',label:summary.resume?'하던 학습 이어 하기':'오늘의 학습 시작',...(memory&&!days.today.count?{memory}:{})};
 return {kind:'complete',command:'packs',label:'생활 팩 둘러보기',...(memory&&!days.today.count?{memory}:{})};
}

// Keep immediate guided help available beside the selected activity, using the same owner and daily checks.
export function homeTutorPracticeRecommendation(input={}){
 const result=homeTutorRecommendation({...input,summary:input.summary?{...input.summary,education:null}:input.summary});
 return result.kind==='difficult'?result:null;
}

export function homeTutorLine(id,recommendation,{completed='',day=null}={}){
 const r=recommendation,expression=r.title?`「${r.title}」`:'';
 const lines={
  marin:{loading:'연결 확인 중. 네 학습 기록을 기다린다.',unavailable:'기록 확인 필요. 「내 계정」에서 저장 상태를 살핀다. …기다리겠다.',
   conditions:'학습 조건 확인. 지금 할 수 있는 활동을 함께 다시 고른다.',
   difficult:`복귀 확인. ${expression}, 다시 살필 표현이다. …오늘은 이것부터 함께한다.`,
   review:'복귀 확인. 오늘 복습할 표현이 돌아왔다. …하나씩 확인한다.',
   resume:`복귀 확인. ${expression}의 하던 자리를 남겨 뒀다. …이어서 간다.`,
   start:`준비 완료. 오늘은 ${expression}부터 시작한다. …옆에 있겠다.`,
   complete:'학습 기록 확인. 생활 팩을 모두 만났다. …다시 가고 싶은 곳을 고른다.'},
  kkamong:{loading:'이 몸이 네 기록을 확인 중이야. …잠깐만 기다려 봐.',unavailable:'이 몸이 기록을 아직 못 읽었어. 「내 계정」을 눌러서 한번 봐 줘.',
   conditions:'이 몸과 학습 조건을 다시 골라 볼까? 지금 할 수 있는 연습을 찾아보자.',
   difficult:`왔군! ${expression}, 다시 볼 말이지. 이 몸이 같이 봐 주지. …나도 한 번 더 볼게.`,
   review:'왔군! 이 몸과 전에 만난 말들이 돌아왔어. 오늘 복습부터 해 볼까?',
   resume:`왔군! ${expression}, 하던 자리는 내가 챙겨 뒀지. …같이 이어가자.`,
   start:`이 몸이 기다리고 있었지. 오늘은 ${expression}부터 가 보자!`,
   complete:'이 몸과 생활 팩을 다 만났군! …내가 또 같이 가 줄게. 어디로 갈까?'},
  mongle:{loading:'어? 우리 기록이 오고 있어! 조금만 같이 기다리자.',unavailable:'어? 기록을 아직 못 읽었대! 「내 계정」을 눌러서 같이 보자!',
   conditions:'어? 지금 조건에 맞는 연습이 없네. 시간이나 도움 방식을 같이 바꿔 볼까?',
   difficult:`어? 왔구나! ${expression}, 다시 만나 볼까? 나도… 헷갈릴 때 있어! 같이 해 보자!`,
   review:'우와, 왔구나! 전에 만난 말들이 오늘 돌아왔어! 같이 다시 만나 볼까?',
   resume:`오! ${expression}, 하던 자리가 여기 있어! 같이 이어가자!`,
   start:`어? 왔구나! 오늘은 ${expression}부터 같이 만나 볼까?`,
   complete:'우와! 생활 팩을 다 만났어! 어디에 다시 가 보고 싶어? 같이 가자!'}
 };
 if(['loading','unavailable','conditions'].includes(r.kind))return lines[id]?.[r.kind]||'';
 if(completed)return id==='marin'?'연습 확인. 새 상황에 맞는 말을 찾았다. …오늘 한 걸음 더 갔다.':id==='kkamong'?'역시 이 몸의… 아니, 네가 해낸 거지! 다음에도 내가 같이 봐 줄게.':'우와! 새 상황에서도 찾았어! 다음 표현도 같이 만나 보자!';
 if(day?.closed)return id==='marin'?'오늘의 마무리 확인. 돌아본 표현이 기록에 남아 있다. …쉬어도 된다.':id==='kkamong'?'오늘은 마무리까지 했군. …푹 쉬어. 더 하고 싶으면 이 몸도 같이 가 줄게.':'우와! 오늘의 기록도 다 정리했구나! 쉬었다가 또 만나자!';
 if(r.memory)return homeTutorMemoryLine(id,r.memory);
 // 방금(30분 안) 레슨 · 복습을 하고 홈에 돌아온 사람에게 「왔구나」는 처음 온 사람 인사로 읽힌다(11-08 프론트 검수 A3 · B4) — 이어 가는 말로.
 // 돌아온 복습이 오늘 답한 말일 때만(r.fresh) 「방금 만난 말」, 지난 복습이 밀려 있으면 「전에 만난 말」로 잇는다(끝 판 F2).
 const justNow=Number.isFinite(day?.latestAt)&&day.latestAt>0&&Date.now()-day.latestAt<JUST_NOW;
 if(justNow){
  const next={
   marin:{difficult:`방금 기록 확인. ${expression}, 다시 살필 표현이다. …이어서 함께한다.`,review:'복습 확인. 방금 만난 표현이 다른 장면으로 돌아왔다. …하나씩 확인한다.',reviewEarlier:'복습 확인. 전에 만난 표현도 돌아와 있다. …하나씩 확인한다.',start:`계속 확인. 다음은 ${expression}부터다. …옆에 있겠다.`},
   kkamong:{difficult:`방금 헷갈린 ${expression}, 이 몸이 다시 꺼내 왔지. …나도 같이 볼게.`,review:'벌써 돌아왔군. 이 몸과 방금 만난 말을 새 장면에서 다시 보자.',reviewEarlier:'아직 힘이 남았군. 이 몸과 전에 만난 말들부터 다시 보자.',start:`오늘 제법이군. 이 몸이 다음 것도 골라 뒀지. ${expression}부터 가 보자!`},
   mongle:{difficult:`방금 헷갈린 ${expression}, 다시 만나 볼까? 나도… 헷갈릴 때 있어!`,review:'우와, 방금 만난 말이 벌써 돌아왔어! 새 장면에서 같이 다시 만나 볼까?',reviewEarlier:'우와, 전에 만난 말들도 돌아와 있어! 이어서 같이 만나 볼까?',start:`좋았어! 이번엔 ${expression}부터 같이 이어가 볼까?`}
  }[id]?.[r.kind==='review'&&!r.fresh?'reviewEarlier':r.kind];
  if(next)return next;
 }
 return lines[id]?.[r.kind]||'';
}
