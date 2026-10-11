// Authored companion speech. Curriculum answers and scheduling stay in life-progress.
const LINES={
 marin:{
  library:'임무 확인. 생활 속 짧은 표현부터 만난다. …네가 고른 자리에서 함께하겠다.',
  cafe:'카페 임무. 음료·온도·잔 수를 확인한다. …주문은 천천히 해도 된다.',
  intro:'준비 기록. 표현을 읽고, 친구들의 상황을 확인한다. 그다음 네가 고른다.',
  story:'장면 확인. 누가, 어디서, 무엇을 원하는지 살핀다. …다음 장면도 함께 읽겠다.',
  question:'수칙. 상황을 읽고 알맞은 말을 하나 고른다. 필요하면 표현 도움을 연다.',
  listen:'듣기 수칙. 직원의 질문을 끝까지 듣는다. …지금은 네 귀에 맡기겠다.',
  compose:'주문 수칙. 음료·온도·잔 수를 하나씩 고른다. 마지막에 만든 문장을 확인한다.',
  success:'응답 확인. 상황에 맞게 골랐다. …방금 잘했다.',
  assisted:'확인 완료. 도움을 함께 보고 골랐다. …다음 장면에서도 연습하겠다.',
  retry:'재확인. 상황과 고른 말이 다르다. 표현 도움에서 함께 다시 살핀다.',
  break:'휴식 기록. 우리 자리까지 왔다. …컵은 천천히 내려놓아라.',
  complete:'임무 완료. 오늘 만난 표현은 복습 일정에 남았다. …잘 다녀왔다.',
  review:'복습 수칙. 전에 만난 표현을 다른 상황에서 고른다. 서두르지 마라.',
  help:'도움 기록. 헷갈린 표현을 골라 다른 장면에서 다시 연습한다.',
  practice:'연습 수칙. 새 상황을 읽고 알맞은 말을 고른다. …같은 자리로 돌아갈 수 있다.',
  practiceSuccess:'연습 확인. 새 상황에 맞는 말을 찾았다. …차근차근 해냈다.',
  practiceRetry:'재확인. 장소·수량·부탁을 다시 살핀다. …다시 골라도 된다.',
  hint:'표현 확인. 아래 설명을 함께 살핀다. …처음부터 알아야 하는 것은 아니다.'
 },
 kkamong:{
  library:'이 몸이 생활 한국어도 같이 봐 주지. 짧은 말 하나부터 시작해 봐. …내 옆자리 비었어.',
  cafe:'이 몸은 카페 주문도 자신 있지. 음료랑 온도, 몇 잔인지부터 봐. …나도 끝까지 확인해.',
  intro:'내 비법은 먼저 읽어 보는 거야. 표현을 보고, 친구들의 이야기로 가 보자.',
  story:'이 몸도 이 이야기 알아. 누가 어디서 뭘 원했는지 봐 둬. …내가 또 놓치진 않겠지.',
  question:'이 몸처럼 상황부터 봐. 알맞은 말 하나를 골라. 헷갈리면 나한테 표현 도움을 열어.',
  listen:'이 몸도 직원 말을 끝까지 들어. 먼저 누르지 말고. …내가 조용히 있어 줄게.',
  compose:'내 주문 비법. 음료, 온도, 몇 잔인지 하나씩 골라. 마지막 문장도 내가 같이 봐 주지.',
  success:'역시, 이 몸과 함께하니 잘 고르는군. …방금은 네가 해낸 거야.',
  assisted:'내 도움도 꽤 쓸 만하지. …네가 다시 확인한 것도 잘한 거야.',
  retry:'나도 헷갈렸ㅇ… 아니! 상황이랑 고른 말부터 다시 보자. 이 몸이 옆에서 봐 줄게.',
  break:'이 몸 자리도 챙겨 줬군. …여기 잠깐 앉을게.',
  complete:'이 몸과 한 바퀴 잘 다녀왔군. 헷갈린 말은 또 만나면 돼. …오늘 꽤 잘했어.',
  review:'이 몸이 본 말인데 장면이 달라졌네. 이번 상황부터 읽어. …나도 다시 볼게.',
  help:'이 몸이 헷갈린 표현부터 골라 줄게. …아니, 네가 고르면 내가 같이 봐 주지.',
  practice:'이 몸의 특별 연습. 다른 상황에서 같은 표현을 써 봐. 끝나면 하던 자리로 돌아가자.',
  practiceSuccess:'역시 내… 아니, 네가 찾아낸 말이지. 이제 하던 자리로 가자.',
  practiceRetry:'나도 처음에 틀렸ㅇ… 아니! 아래 설명을 보고 다시 골라. 이 몸이 기다릴게.',
  hint:'내가 보는 건 이 부분이야. 아래 설명을 읽어 봐. …나도 처음엔 헷갈렸어.'
 },
 mongle:{
  library:'우와, 생활 속 말이 이렇게 많아! 짧은 표현부터 같이 만나 보자!',
  cafe:'오! 오늘은 카페야! 뭘 마실지, 따뜻한지, 몇 잔인지 같이 찾아보자!',
  intro:'어? 이 말은 언제 쓰는 걸까? 표현을 읽고 친구들의 이야기로 같이 가 보자!',
  story:'오! 다음엔 무슨 일이 생길까? 누가 어디서 뭘 원하는지 같이 읽어 보자!',
  question:'어떤 말이 이 상황에 어울릴까? 하나씩 읽고 같이 골라 보자!',
  listen:'어? 직원이 뭐라고 물을까? 끝까지 듣고 같이 골라 보자!',
  compose:'우와, 우리가 주문을 만드는 거야! 음료랑 온도, 잔 수를 같이 골라 보자!',
  success:'우와! 상황에 맞는 말을 찾았어! 같이 하니까 좋다!',
  assisted:'오! 도움을 보고 잘 찾았어! 다음 장면에서도 같이 해 보자!',
  retry:'나도… 조금 헷갈려! 상황을 다시 보고 같이 찾아보자!',
  break:'우와, 우리 자리야! 같이 한 모금 쉬어 가자!',
  complete:'우와! 오늘도 같이 다녀왔어! 헷갈린 말은 다음에 같이 또 만나자!',
  review:'어? 전에 만난 말인데 장면이 달라! 이번에는 어떻게 말할지 같이 찾아보자!',
  help:'어떤 표현이 헷갈렸어? 새 장면에서 같이 다시 만나 보자!',
  practice:'오! 다른 장면에서도 이 말을 쓸 수 있을까? 같이 읽고 골라 보자!',
  practiceSuccess:'우와! 새로운 장면에서도 찾았어! 하던 자리로 같이 돌아가자!',
  practiceRetry:'나도… 어렵네! 아래 설명을 보고 같이 한 번 더 골라 보자!',
  hint:'어? 여기가 힌트야! 아래 설명을 읽고 같이 확인해 보자!'
 }
};
export function lifeTutorKind(state={}){
 if(state.listening)return 'listen';
 if(state.practiceCompleted)return 'practiceSuccess';
 if(state.hinting)return 'hint';
 if(state.feedback)return state.feedback.correct?(state.feedback.helped?'assisted':'success'):'retry';
 if(state.phase==='repair')return 'retry';
 if(state.phase==='response')return state.helped?'assisted':'success';
 if(state.phase==='choose')return state.compose?'compose':state.requiresHearing?'listen':'question';
 if(state.phase==='welcome')return 'cafe';
 if(['intro','story','break','complete','review'].includes(state.phase))return state.phase;
 if(state.phase==='questions')return 'question';
 return state.scope==='cafe'?'cafe':'library';
}
const cues={
 'cafe-order':'음료 종류·온도·잔 수를 함께', 'cafe-compose':'음료 종류·온도·잔 수를 함께',
 'cafe-here':'안에서 마시는지, 밖으로 가져가는지', 'cafe-takeout':'안에서 마시는지, 밖으로 가져가는지',
 'cafe-preference':'친구가 원하는 음료와 온도를', 'cafe-soldout':'품절된 음료와 주문할 수 있는 음료를',
 'cafe-change':'바꾸려는 음료의 종류와 온도를', 'cafe-add':'원래 잔 수에 몇 잔을 더하는지',
 'greet-hello':'누구를 처음 만났는지', 'greet-thanks':'어떤 도움을 받았는지', 'greet-name':'소개하는 사람의 이름을',
 'plans-time':'날짜와 시간을 함께', 'plans-place':'만날 장소를', 'plans-delay':'도착이 늦어진다는 말을',
 'directions-right':'왼쪽과 오른쪽을', 'directions-beside':'장소의 옆과 안을', 'directions-where':'찾고 있는 장소를',
 'transit-alight':'지금과 다음 정류장을', 'transit-destination':'버스의 목적지를', 'transit-card':'카드를 어디에 대는지',
 'store-price':'가격을 묻는 말을', 'store-bag':'봉투가 필요한 상황을', 'store-card':'계산하는 방법을'
};
export function lifeTutorLine(id,kind,state={}){
 const cue=cues[state.question?.expressionId];
 if(cue&&['retry','hint'].includes(kind))return id==='marin'?`재확인. ${cue} 살핀다. …다시 골라도 된다.`
  :id==='kkamong'?`나도 헷갈렸ㅇ… 아니! ${cue} 다시 봐. 이 몸이 옆에서 봐 줄게.`
  :id==='mongle'?`나도… 헷갈려! ${cue} 같이 확인해 보자!`:'';
 return LINES[id]?.[kind]||'';
}
export function lifeTutorExpression(lesson,question){return lesson?.expressions.find(e=>e.id===question?.expressionId)?.korean||lesson?.title||'생활 표현';}
export function lifeTutorDifficulties(snapshot,lessons,scope='life'){
 const byId=new Map(lessons.map(l=>[l.id,l]));
 return Object.values(snapshot?.reviews||{}).filter(r=>r.lapses>0&&(scope!=='cafe'||r.packId==='cafe')).sort((a,b)=>b.lastAt-a.lastAt||a.id.localeCompare(b.id)).flatMap(record=>{
  const lesson=byId.get(record.lessonId),question=lesson?.questions.find(q=>q.id===record.questionId);
  return question?.review?[{id:question.id,lessonId:lesson.id,title:lifeTutorExpression(lesson,question),lessonTitle:lesson.title}]:[];
 }).slice(0,12);
}
export function lifeTutorExercise(lesson,questionId){
 const original=lesson?.questions.find(q=>q.id===questionId||q.review.id===questionId),q=original?.review;
 if(!q||!q.choices.some(c=>c.id===q.answerId))return null;
 return {id:original.id,lessonId:lesson.id,title:lifeTutorExpression(lesson,original),prompt:q.prompt,context:q.context,choices:q.choices.map(c=>({...c})),answerId:q.answerId,explanation:q.explanation};
}
