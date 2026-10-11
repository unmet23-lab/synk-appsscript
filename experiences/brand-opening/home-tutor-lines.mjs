import {lifeTutorExpression} from './life-tutor-lines.mjs';
import {homeDayKey,homeTutorDays,homeTutorMemoryLine} from './home-tutor-days.mjs';

// Recommendations read the existing owner-scoped progress; they never grade it.
export function homeTutorRecommendation({owner,summary,snapshot,lessons=[],practised=new Map(),now=Date.now()}={}){
 if(!summary||summary.owner!==owner||snapshot?.owner!==owner||summary.status?.phase==='loading')return {kind:'loading'};
 if(['unreadable','conflict'].includes(summary.status?.phase)||summary.status?.rejected||summary.status?.code==='LIFE_PROGRESS_REJECTED')return {kind:'unavailable'};
 const known=Object.values(snapshot.reviews||{}).flatMap(r=>{
  const lesson=lessons.find(l=>l.id===r.lessonId),q=lesson?.questions.find(q=>q.id===r.questionId&&q.review?.id===r.id);
  return q?[{...r,expressionId:q.expressionId,title:lifeTutorExpression(lesson,q),lessonTitle:lesson.title}]:[];
 });
 const todayItems=snapshot.daily?.days?.[homeDayKey(now)]?.items||{};
 const practisedToday=r=>{
  const family=known.filter(k=>k.expressionId===r.expressionId).flatMap(k=>{const item=todayItems[k.questionId];return item?.lessonId===k.lessonId?[item]:[];});
  const guidedAt=Math.max(0,...family.map(item=>item.guidedAt<=now+60000?item.guidedAt||0:0));
  const wrongAt=Math.max(0,...family.map(item=>item.outcome==='retry'?item.observedAt||0:0));
  return guidedAt>0&&guidedAt>=wrongAt;
 };
 const days=homeTutorDays(snapshot,lessons,now),previous=days.previous?.items[0];
 const memory=previous?{...previous,when:days.when}:null;
 const returning=known.find(r=>r.questionId===previous?.id&&r.dueAt<=now&&!practisedToday(r));
 if(returning&&['guided','assisted'].includes(previous.kind)&&!days.today.count){
  const run=snapshot.activeReview,firstPending=run?.ids.find(id=>!run.answers[id]);
  return {kind:'recall',id:returning.questionId,title:returning.title,command:'review',label:'오늘의 복습 시작',memory:{...memory,tryAlone:!firstPending||firstPending===returning.id&&!run.pendingHelp?.[returning.id]}};
 }
 const difficult=known.filter(r=>r.lapses>0&&r.streak===0&&practised.get(r.questionId)!==r.lastAt&&!practisedToday(r))
  .sort((a,b)=>Number(b.dueAt<=now)-Number(a.dueAt<=now)||b.lastAt-a.lastAt||a.id.localeCompare(b.id))[0];
 if(difficult)return {kind:'difficult',id:difficult.questionId,title:difficult.title,lessonTitle:difficult.lessonTitle,lastAt:difficult.lastAt,command:'practice',label:'이 표현 같이 연습',...(memory&&!days.today.count&&memory.id===difficult.questionId?{memory}:{})};
 if(summary.dueCount&&known.some(r=>r.dueAt<=now&&!practisedToday(r)))return {kind:'review',command:'review',label:'오늘의 복습 열기',...(memory&&!days.today.count?{memory}:{})};
 if(summary.nextLesson)return {kind:summary.resume?'resume':'start',title:summary.nextLesson.title,command:'learn',label:summary.resume?'하던 학습 이어 하기':'오늘의 학습 시작',...(memory&&!days.today.count?{memory}:{})};
 return {kind:'complete',command:'packs',label:'생활 팩 둘러보기',...(memory&&!days.today.count?{memory}:{})};
}

export function homeTutorLine(id,recommendation,{completed='',day=null}={}){
 const r=recommendation,expression=r.title?`「${r.title}」`:'';
 const lines={
  marin:{loading:'연결 확인 중. 네 학습 기록을 기다린다.',unavailable:'기록 확인 필요. 연결 상태를 먼저 살핀다. …기다리겠다.',
   difficult:`복귀 확인. ${expression}, 다시 살필 표현이다. …오늘은 이것부터 함께한다.`,
   review:'복귀 확인. 오늘 복습할 표현이 돌아왔다. …하나씩 확인한다.',
   resume:`복귀 확인. ${expression}의 하던 자리를 남겨 뒀다. …이어서 간다.`,
   start:`준비 완료. 오늘은 ${expression}부터 시작한다. …옆에 있겠다.`,
   complete:'학습 기록 확인. 생활 팩을 모두 만났다. …다시 가고 싶은 곳을 고른다.'},
  kkamong:{loading:'이 몸이 네 기록을 확인 중이야. …잠깐만 기다려 봐.',unavailable:'내가 기록부터 확인할게. 나의 공간에서 연결을 한번 봐 줘.',
   difficult:`왔군! ${expression}, 다시 볼 말이지. 이 몸이 같이 봐 주지. …나도 한 번 더 볼게.`,
   review:'왔군! 이 몸과 전에 만난 말들이 돌아왔어. 오늘 복습부터 해 볼까?',
   resume:`왔군! ${expression}, 하던 자리는 내가 챙겨 뒀지. …같이 이어 가자.`,
   start:`이 몸이 기다리고 있었지. 오늘은 ${expression}부터 가 보자!`,
   complete:'이 몸과 생활 팩을 다 만났군! …내가 또 같이 가 줄게. 어디로 갈까?'},
  mongle:{loading:'어? 우리 기록이 오고 있어! 조금만 같이 기다리자.',unavailable:'어? 기록을 확인해야 한대. 나의 공간에서 연결부터 같이 보자!',
   difficult:`어? 왔구나! ${expression}, 다시 만나 볼까? 나도… 헷갈릴 때 있어! 같이 해 보자!`,
   review:'우와, 왔구나! 전에 만난 말들이 오늘 돌아왔어! 같이 다시 만나 볼까?',
   resume:`오! ${expression}, 하던 자리가 여기 있어! 같이 이어 가자!`,
   start:`어? 왔구나! 오늘은 ${expression}부터 같이 만나 볼까?`,
   complete:'우와! 생활 팩을 다 만났어! 어디에 다시 가 보고 싶어? 같이 가자!'}
 };
 if(['loading','unavailable'].includes(r.kind))return lines[id]?.[r.kind]||'';
 if(completed)return id==='marin'?'연습 확인. 새 상황에 맞는 말을 찾았다. …오늘 한 걸음 더 갔다.':id==='kkamong'?'역시 이 몸의… 아니, 네가 해낸 거지! 다음에도 내가 같이 봐 줄게.':'우와! 새 상황에서도 찾았어! 다음 표현도 같이 만나 보자!';
 if(day?.closed)return id==='marin'?'오늘의 마무리 확인. 돌아본 표현이 기록에 남아 있다. …쉬어도 된다.':id==='kkamong'?'오늘은 마무리까지 했군. …푹 쉬어. 더 하고 싶으면 이 몸도 같이 가 줄게.':'우와! 오늘의 기록도 다 정리했구나! 쉬었다가 또 만나자!';
 if(r.memory)return homeTutorMemoryLine(id,r.memory);
 return lines[id]?.[r.kind]||'';
}
