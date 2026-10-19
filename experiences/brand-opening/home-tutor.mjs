import {createLifeTutor} from './life-tutor.mjs';
import {lifeTutorExercise} from './life-tutor-lines.mjs';
import {homeTutorRecommendation,homeTutorPracticeRecommendation,homeTutorLine} from './home-tutor-lines.mjs';
import {homeTutorDays} from './home-tutor-days.mjs';
import {createHomeTutorRecap} from './home-tutor-recap.mjs';

export function createHomeTutor({container,getTutor,learn,choose,profile,reduced=()=>false}){
 let data=null,companion=null,identity='',recommendation={kind:'loading'},practiceRecommendation=null,completed='',active=true,practiceRecord=null,recap=null,days=homeTutorDays(null),dayButton=null,practiceButton=null,reviewButton=null;
 const practised=new Map();
 const note=document.createElement('p');note.className='home-tutor-context';
 function openPractice(candidate){
  if(!active||recap||!companion||companion.metrics().practice||candidate?.kind!=='difficult'||getTutor().owner!==data?.snapshot?.owner)return;
  practiceRecord={id:candidate.id,lastAt:candidate.lastAt,owner:getTutor().owner};
  companion.openPractice(candidate.id);
  if(!companion.metrics().practice)practiceRecord=null;
 }
 function closeRecap({focus=true}={}){recap?.dispose();recap=null;companion?.setActive(active);if(focus)dayButton?.focus({preventScroll:true});}
 function openRecap(){
  if(recap||!data||['loading','unavailable'].includes(recommendation.kind))return;
  const owner=getTutor().owner;companion?.setActive(false);
  recap=createHomeTutorRecap({container,tutorId:getTutor().tutor,days,status:data.summary.status,reduced,
   onClose:closeRecap,onFinish(){if(getTutor().owner!==owner||data.snapshot?.owner!==owner)return;return data.finishDay?.();}});
 }
 function refresh(){
  const selected=getTutor(),key=`${selected.owner}:${selected.tutor||''}`;
  if(identity!==key){closeRecap({focus:false});companion?.dispose();companion=null;dayButton=null;practiceButton=null;reviewButton=null;container.replaceChildren();identity=key;practised.clear();completed='';practiceRecord=null;}
  const ownsData=data?.snapshot?.owner===selected.owner&&data?.summary?.owner===selected.owner;
  const nextDays=homeTutorDays(ownsData?data.snapshot:null,data?.lessons);if(nextDays.date!==days.date){practised.clear();completed='';}days=nextDays;
  recommendation=homeTutorRecommendation({owner:selected.owner,summary:data?.summary,snapshot:data?.snapshot,lessons:data?.lessons,practised});
  practiceRecommendation=homeTutorPracticeRecommendation({owner:selected.owner,summary:data?.summary,snapshot:data?.snapshot,lessons:data?.lessons,practised});
  if(!selected.tutor){
   if(!container.querySelector('.home-tutor-choose')){
    container.innerHTML='<p class="home-tutor-invitation">아직 AI 튜터를 고르지 않았어요.</p><button type="button" class="home-tutor-choose">AI 튜터 고르기 <span aria-hidden="true">→</span></button>';
    container.querySelector('button').addEventListener('click',choose);
   }
   return;
  }
  // A newly unreadable/conflicting source must close any old practice immediately.
  if(['loading','unavailable'].includes(recommendation.kind)){closeRecap({focus:false});if(companion?.metrics().practice){companion.dispose();companion=null;practiceRecord=null;completed='';}}
  if(!companion){
   container.replaceChildren();
   companion=createLifeTutor({tutorId:selected.tutor,container,state:{scope:'home'},reduced,
    lineForState:()=>homeTutorLine(selected.tutor,recommendation,{completed,day:days.today}),
    onHelp(){
     if(recommendation.command==='practice')openPractice(recommendation);
     else if(recommendation.kind==='unavailable')profile();
     else if(recommendation.command){completed='';learn(recommendation.command);}
    },
    getExercise(id){
     if(getTutor().owner!==data?.snapshot?.owner||practiceRecord?.owner!==getTutor().owner||id!==practiceRecord?.id)return null;
     return lifeTutorExercise(data.lessons.find(l=>l.questions.some(q=>q.id===id)),id);
    },
    onPreparePractice(id){return practiceRecord?.owner===getTutor().owner&&practiceRecord?.id===id&&data?.preparePractice?.(id)===true;},
    onPracticeSuccess(id){if(practiceRecord?.owner===getTutor().owner&&practiceRecord?.id===id)return data?.completePractice?.(id,selected.tutor);},
    onPracticeComplete(id){
     if(practiceRecord?.id!==id||practiceRecord?.owner!==getTutor().owner)return;
     practised.set(id,practiceRecord.lastAt);completed=id;practiceRecord=null;refresh();
    }
   });
   companion.element.classList.add('home-tutor-companion');
   companion.element.classList.remove('life-tutor');
   companion.element.querySelector('.life-tutor-help').classList.replace('life-tutor-help','home-tutor-action');
   companion.element.querySelector('.game-tutor-message').append(note);
   practiceButton=document.createElement('button');practiceButton.type='button';practiceButton.className='home-tutor-practice';practiceButton.textContent='헷갈린 표현 연습하기';practiceButton.addEventListener('click',()=>openPractice(practiceRecommendation));container.append(practiceButton);
   // 하던 레슨을 이어 갈 때도 돌아온 복습은 같이 보인다(이어 하기가 복습을 가리지 않게).
   reviewButton=document.createElement('button');reviewButton.type='button';reviewButton.className='home-tutor-practice home-tutor-review';reviewButton.addEventListener('click',()=>{completed='';learn('review');});container.append(reviewButton);
   dayButton=document.createElement('button');dayButton.type='button';dayButton.className='home-tutor-day';dayButton.addEventListener('click',openRecap);container.append(dayButton);
   companion.setActive(active);
  }
  companion.update({scope:'home',practiceCompleted:!!completed||days.today.closed});
  const button=companion.element.querySelector('.game-tutor-help');
  button.textContent=recommendation.label||(recommendation.kind==='loading'?'기록 확인 중':'연결 상태 보기');button.disabled=recommendation.kind==='loading';
  container.dataset.recommendation=recommendation.kind;
  practiceButton.hidden=!practiceRecommendation||recommendation.command==='practice';
  practiceButton.setAttribute('aria-label',practiceRecommendation?`헷갈린 표현 연습하기 · ${practiceRecommendation.title}`:'헷갈린 표현 연습하기');
  const due=recommendation.kind==='resume'&&data?.summary?.owner===selected.owner?data.summary.dueCount||0:0;
  reviewButton.hidden=!due||!practiceButton.hidden;reviewButton.textContent=`돌아온 표현 ${due}개 복습하기`;
  const pending=data?.summary.status?.phase==='unsaved';
  note.textContent=(completed?'방금 함께 연습했어요':recommendation.reason|| (recommendation.kind==='difficult'?`지난 학습에서 다시 볼 말 · ${recommendation.lessonTitle}`:recommendation.kind==='review'?'다시 볼 표현이 있어요':recommendation.kind==='resume'?'하던 곳에서 이어서':recommendation.kind==='start'?'다음 레슨':''))+(pending?' · 저장 대기 중':'');
  dayButton.hidden=!days.today.count||['loading','unavailable'].includes(recommendation.kind);dayButton.textContent=days.today.closed?'오늘 기록 다시 보기':`오늘 배운 표현 ${days.today.count}개 정리하기`;
  recap?.update(days,data.summary.status);
 }
 return {
  update(summary,details={}){if(data?.snapshot?.revision!==details.snapshot?.revision)completed='';data={summary,...details};refresh();},
  refresh,openRecap,
  setActive(value){const changed=active!==!!value;active=!!value;if(changed)companion?.setActive(active&&!recap);},
  metrics:()=>({owner:getTutor().owner,tutor:getTutor().tutor,recommendation:{...recommendation},practiceRecommendation:practiceRecommendation?{...practiceRecommendation}:null,completed,days,recapOpen:!!recap,companion:companion?.metrics()||null}),
  dispose(){closeRecap({focus:false});companion?.dispose();container.replaceChildren();}
 };
}
