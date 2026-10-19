import {lifeTutorExpression} from './life-tutor-lines.mjs';
import {getTutor} from './game-tutor-lines.mjs';
import {josa} from './kit/josa.mjs';
export const homeDayKey=at=>new Date(at+9*3600000).toISOString().slice(0,10);
const activity=item=>Math.max(item.observedAt||0,item.guidedAt||0);

export function homeTutorDays(snapshot,lessons=[],now=Date.now()){
 const date=homeDayKey(now),catalog=new Map(lessons.flatMap(l=>l.questions.map(q=>[q.id,{lesson:l,question:q}])));
 const days=Object.entries(snapshot?.daily?.days||{}).filter(([key])=>/^\d{4}-\d{2}-\d{2}$/.test(key)&&key<=date).map(([key,day])=>{
  const byExpression=new Map();
  for(const [id,item]of Object.entries(day.items||{})){
   const source=catalog.get(id);if(!source||item.lessonId!==source.lesson.id||!activity(item)||activity(item)>now+60000)continue;
   const kind=item.guidedAt&&item.guidedAt>=(item.observedAt||0)?'guided':item.outcome;
   if(!['independent','assisted','retry','guided'].includes(kind))continue;
   const entry={id,lessonId:item.lessonId,expressionId:source.question.expressionId,title:lifeTutorExpression(source.lesson,source.question),kind,at:activity(item),guidedAt:item.guidedAt||0,observedAt:item.observedAt||0};
   // Only the latest guided event records who actually accompanied this practice.
   if(kind==='guided'&&getTutor(item.tutorId))entry.tutorId=item.tutorId;
   const prior=byExpression.get(entry.expressionId);if(!prior||entry.at>prior.at)byExpression.set(entry.expressionId,entry);
  }
  const items=[...byExpression.values()].sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)),latestAt=Math.max(0,...items.map(item=>item.at));
  return {date:key,items,count:items.length,latestAt,closedAt:day.closedAt||0,closed:!!items.length&&(day.closedAt||0)>=latestAt&&day.closedAt<=now+60000,
   independent:items.filter(i=>i.kind==='independent'),together:items.filter(i=>['assisted','guided'].includes(i.kind)),retry:items.filter(i=>i.kind==='retry')};
 }).filter(day=>day.count).sort((a,b)=>b.date.localeCompare(a.date));
 const today=days.find(day=>day.date===date)||{date,items:[],count:0,latestAt:0,closedAt:0,closed:false,independent:[],together:[],retry:[]};
 const previous=days.find(day=>day.date<date)||null;
 return {date,today,previous,when:previous?(Date.parse(date)-Date.parse(previous.date)===86400000?'어제':'지난번'):null};
}

export function homeTutorDayLine(id,day,{finished=false}={}){
 if(!day.count)return id==='marin'?'기록 대기. 오늘의 첫 표현부터 만나 본다. …서두르지 마라.':id==='kkamong'?'이 몸도 아직 준비 중이야. 오늘의 첫 표현부터 같이 만나자.':'어? 오늘은 어떤 말을 만나게 될까? 첫 표현부터 같이 가 보자!';
 if(finished)return id==='marin'?'오늘의 마무리 확인. 오늘 만난 표현을 하나씩 살폈다. …쉬는 시간도 필요하다.':id==='kkamong'?'오늘 기록을 다 확인했군. …이 몸도 네 끈기는 인정하지. 푹 쉬어!':'우와! 오늘 만난 말들을 같이 돌아봤어! 우리 잠깐 쉬었다 또 만나자!';
 const own=day.independent.length,together=day.together.length,retry=day.retry.length;
 if(id==='marin')return `오늘의 기록. ${own?`혼자 찾은 말 ${own}개. `:''}${together?`함께 확인한 말 ${together}개. `:''}${retry?`다시 살필 말 ${retry}개. `:''}…한 걸음씩 갔다.`;
 if(id==='kkamong')return `오늘 ${day.count}개 표현을 만났군! ${own?'혼자 찾은 말도 있네. …내 덕이라고 하려다 말았어.':together?'다시 확인하는 끈기는 인정하지. …이 몸도 기록을 봤어.':'나도 처음엔 헷갈렸ㅇ… 아니! 다음에도 내가 같이 볼게.'}`;
 return `우와! 오늘 ${day.count}개 표현을 만났어! ${own?'혼자 찾은 말도 있구나! ':''}${together?'같이 확인한 말도 있어! ':''}${retry?'어려웠던 말은 다음에 같이 또 만나자!':'어떤 말이 제일 기억나?'}`;
}

export function homeTutorMemoryLine(id,memory){
 if(!memory)return '';
 // 받침에 맞춰 「안녕하세요.」를 · 「감사합니다.」를 · 「저는 몽글이에요.」를 — 끝 문장부호·낫표는 건너뛰고 앞 글자를 본다(kit/josa.mjs).
 const {when,title,kind}=memory,word=`「${title}」`,eul=josa(title,'을','를'),together=['guided','assisted'].includes(kind);
 const previous=kind==='guided'?getTutor(memory.tutorId):null;
 const partner=previous&&previous.id!==id?`${previous.name}과 `:'';
 const marinHelp=previous?`${partner}함께 확인했다`:'도움과 함께 확인했다';
 const kkamongHelp=previous?`${partner||'나랑 '}같이 봤지`:'도움과 함께 확인했지';
 const mongleHelp=previous?`${partner}같이 확인했지`:'도움과 함께 확인했지';
 if(memory.tryAlone)return id==='marin'?`복귀 확인. ${when} ${word}${eul} ${marinHelp}. 오늘은 네가 먼저 고른다. …옆에 있겠다.`:id==='kkamong'?`${when} ${word}, ${kkamongHelp}? 오늘은 네가 먼저 골라 봐. 이 몸은 여기 있을게.`:`${when} ${word}, ${mongleHelp}? 오늘은 네가 먼저 골라 볼까? 같이 확인하자!`;
 if(id==='marin')return `${when}의 기록. ${word}${eul}${together?` ${marinHelp}`:kind==='independent'?' 혼자 찾았다':' 다시 살피기로 했다'}. …오늘도 이어 간다.`;
 if(id==='kkamong')return `${when} ${word}, ${together?kkamongHelp:kind==='independent'?'네가 혼자 찾았지':'다시 볼 말로 남아 있지'}? …오늘도 내 옆자리 비었어.`;
 return `${when} ${word}, ${together?mongleHelp:kind==='independent'?'혼자 찾아냈지':'다시 만나 보기로 했지'}? 오늘도 같이 해 보자!`;
}
