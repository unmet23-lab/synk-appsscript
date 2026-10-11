import {getTutor,tutorFace} from './game-tutor-lines.mjs';
import {lifeTutorKind,lifeTutorLine,lifeTutorDifficulties,lifeTutorExercise} from './life-tutor-lines.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=path=>new URL('assets/tutors/'+path,import.meta.url).href;
export function createLifeTutor({tutorId,container,state={},snapshot,lessons=[],practised=[],getExercise,onHint=()=>{},onPause=()=>{},onPreparePractice=()=>{},onPracticeSuccess=null,onPracticeComplete=()=>{},onHelp=null,lineForState=lifeTutorLine,reduced=()=>false}){
 const tutor=getTutor(tutorId);if(!tutor||!container)return null;
 const difficulties=lifeTutorDifficulties(snapshot,lessons,state.scope);
 getExercise ||= id=>lifeTutorExercise(lessons.find(l=>l.questions.some(q=>q.id===id||q.review.id===id)),id);
 let disposed=false,active=true,kind='',guide=null,practice=null,clip=null,timer=null,blink=null,sound=false,exercise=null,selected=null,correct=false;
 try{sound=localStorage.getItem('synk.world.tutor.sound')==='true';}catch{}
 const portrait=(face='기본')=>`<span class="game-tutor-portrait" data-character="${tutor.id}"><img class="game-tutor-body" src="${asset(tutor.images.기본)}" alt="${tutor.name}" width="480" height="480"><img class="game-tutor-face" src="${asset(tutor.images[face]||tutor.images.기본)}" alt="" aria-hidden="true" width="480" height="480"></span>`;
 const element=document.createElement('aside');element.className='game-tutor life-tutor';element.dataset.tutor=tutor.id;
 element.setAttribute('aria-label',`${tutor.name} · 함께하는 AI 튜터`);
 element.innerHTML=`${portrait()}<div class="game-tutor-message"><small><b>${tutor.name}</b> · 함께하는 AI 튜터</small><p class="game-tutor-line" role="status" aria-live="polite"></p></div><button class="game-tutor-help life-tutor-help" type="button">표현 도움</button>`;
 container.prepend(element);
 const helpButton=element.querySelector('.life-tutor-help'),face=element.querySelector('.game-tutor-face'),line=element.querySelector('.game-tutor-line'),body=element.querySelector('.game-tutor-portrait');
 const motion=matchMedia('(prefers-reduced-motion:reduce)'),isReduced=()=>reduced()||motion.matches;
 const stopSound=()=>{clip?.pause();clip=null;};
 function restFace(){face.src=asset(tutor.images.기본);element.dataset.face='기본';element.dataset.reduced=String(isReduced());delete body.dataset.reaction;}
 function quiet(){clearTimeout(timer);clearTimeout(blink);stopSound();restFace();}
 function idle(){
  clearTimeout(timer);clearTimeout(blink);restFace();
  if(disposed||!active||document.hidden||isReduced()||guide||practice)return;
  timer=setTimeout(()=>{if(disposed||!active||document.hidden||isReduced()||guide||practice)return;face.src=asset(tutor.images.잔잔감음||tutor.images.기본);element.dataset.face=tutor.images.잔잔감음?'잔잔감음':'기본';blink=setTimeout(()=>{if(disposed||!active)return;idle();},130);},5600+Math.random()*1200);
 }
 function playReaction(emotion){
  stopSound();if(!sound||!active||state.listening||state.requiresHearing||practice||guide||document.hidden)return;
  const bank=tutor.sounds[emotion]||tutor.sounds.기본;if(!bank?.length)return;
  clip=new Audio(asset(bank[0]));clip.volume=.25;clip.play().catch(stopSound);
 }
 function update(next){
  if(disposed)return;state=next;const nextKind=lifeTutorKind(state);element.dataset.scope=state.scope||'life';
  const text=lineForState(tutor.id,nextKind,state);if(state.listening)stopSound();if(kind===nextKind&&line.textContent===text){if(element.dataset.reduced!==String(isReduced()))idle();return;}
  quiet();kind=nextKind;const reaction=['success','assisted','complete','practiceSuccess'].includes(kind)?'success':kind==='retry'?'retry':kind==='listen'?'listening':'ready';
  const emotion=tutorFace(tutor.id,reaction);element.dataset.reaction=reaction;element.dataset.face=emotion;element.dataset.reduced=String(isReduced());body.dataset.reaction=reaction;
  face.src=asset(tutor.images[emotion]||tutor.images.기본);line.textContent=text;
  if(reaction==='success')playReaction('기쁨');else if(reaction==='retry')playReaction('안심');
  if(!active||document.hidden||guide||practice){quiet();return;}
  timer=setTimeout(()=>{if(disposed||!active||document.hidden)return;idle();},tutor.id==='kkamong'?2800:2300);
 }
 function closeGuide({focus=true,resume=true}={}){if(!guide)return;if(guide.open)guide.close();guide.remove();guide=null;if(focus&&!disposed)helpButton.focus({preventScroll:true});if(resume&&!disposed)idle();}
 function openGuide(){
  if(disposed||practice||guide)return;onPause();quiet();
  guide=document.createElement('dialog');guide.className='game-tutor-guide life-tutor-guide';guide.setAttribute('aria-label',`${tutor.name}과 표현 도움`);
  const current=state.question;
  guide.innerHTML=`<div class="game-tutor-guide-top">${portrait()}<div><small>${tutor.name} · 나의 AI 튜터</small><h3>헷갈린 표현, 같이 다시</h3><p>${esc(lifeTutorLine(tutor.id,'help'))}</p></div></div>${current?`<section class="life-tutor-current"><h4>지금 만난 표현</h4><p>${esc(state.requiresHearing?'직원 질문을 듣고 주문해요.':current.prompt)}</p><button type="button" class="game-tutor-sound life-tutor-hint">${state.requiresHearing?'글자 도움으로 같이 보기':'이번 표현 힌트 열기'}</button>${state.answered?`<button class="tutor-support-retry" type="button" data-life-expression="${esc(state.questionId)}">이 표현, 다른 상황에서 연습</button>`:''}</section>`:''}<section class="tutor-support-list life-tutor-difficulties"><h4>함께 다시 볼 표현</h4>${difficulties.length?difficulties.map(item=>`<article class="tutor-support-item"><small>${esc(item.lessonTitle)}${practised.includes(item.id)?' · 함께 연습했어요':''}</small><h4>${esc(item.title)}</h4><button class="tutor-support-retry" type="button" data-life-expression="${esc(item.id)}">다른 상황에서 연습</button></article>`).join(''):'<p>헷갈렸거나 도움을 본 표현이 여기에 모여요.</p>'}</section><div class="game-tutor-guide-footer"><button type="button" class="game-tutor-continue life-tutor-resume">하던 자리로 돌아가기</button><button type="button" class="game-tutor-sound life-tutor-sound" aria-pressed="${sound}">반응 소리 ${sound?'켜짐':'꺼짐'}</button><small>카페 질문을 들을 때는 튜터 소리를 쉬어요.</small></div>`;
  container.append(guide);guide.addEventListener('cancel',event=>{event.preventDefault();closeGuide();});
  guide.querySelector('.life-tutor-resume').addEventListener('click',()=>closeGuide());
  guide.querySelector('.life-tutor-hint')?.addEventListener('click',()=>{closeGuide({focus:false});onHint();});
  guide.querySelectorAll('[data-life-expression]').forEach(button=>button.addEventListener('click',()=>openPractice(button.dataset.lifeExpression)));
  guide.querySelector('.life-tutor-sound').addEventListener('click',event=>{sound=!sound;try{localStorage.setItem('synk.world.tutor.sound',String(sound));}catch{}event.currentTarget.textContent=`반응 소리 ${sound?'켜짐':'꺼짐'}`;event.currentTarget.setAttribute('aria-pressed',String(sound));});
  guide.showModal();guide.querySelector('.life-tutor-resume').focus({preventScroll:true});
 }
 function closePractice({completed=false,focus=true}={}){
  if(!practice)return;const id=exercise.id;
  if(practice.open)practice.close();practice.remove();practice=null;exercise=null;selected=null;correct=false;
  if(completed){if(!practised.includes(id))practised.push(id);onPracticeComplete(id);}
  if(focus&&!disposed)helpButton.focus({preventScroll:true});if(!completed)idle();
 }
 function openPractice(id){
  if(disposed||!active||practice)return;const value=getExercise?.(id);if(!value)return;
  // Guided transfer is a rehearsal; only the scheduled life-review flow grades it.
  if(onPreparePractice(id)===false||disposed)return;onPause();quiet();closeGuide({focus:false,resume:false});exercise=value;selected=null;correct=false;
  practice=document.createElement('dialog');practice.className='game-tutor-guide life-expression-practice';practice.setAttribute('aria-label',`${tutor.name}과 표현 다시 연습`);
  practice.innerHTML=`<div class="game-tutor-guide-top">${portrait()}<div><small>${tutor.name}과 · 다른 상황을 읽고 골라요</small><h3>다른 상황에서 써 보기</h3><p class="life-expression-tutor" role="status">${esc(lifeTutorLine(tutor.id,'practice'))}</p></div></div><section class="life-expression-question"><h4>${esc(value.prompt)}</h4><p>${esc(value.context)}</p><div class="life-expression-options">${value.choices.map(c=>`<button class="life-choice" type="button" data-expression-choice="${esc(c.id)}">${esc(c.text)}</button>`).join('')}</div><div class="life-expression-feedback" hidden><p></p></div></section><div class="game-tutor-guide-footer"><button class="game-tutor-continue life-expression-return" type="button" disabled>연습을 마치고 돌아가기</button><button class="game-tutor-sound life-expression-cancel" type="button">연습은 나중에 할게요</button></div>`;
  container.append(practice);practice.addEventListener('cancel',event=>{event.preventDefault();closePractice();});
  practice.querySelector('.life-expression-cancel').addEventListener('click',()=>closePractice());
  practice.querySelector('.life-expression-return').addEventListener('click',()=>{if(correct)closePractice({completed:true});});
  practice.querySelectorAll('[data-expression-choice]').forEach(button=>button.addEventListener('click',()=>{
   if(correct||disposed)return;selected=button.dataset.expressionChoice;correct=selected===exercise.answerId;
   practice.dataset.correct=String(correct);practice.dataset.selected=selected;
   const emotion=tutorFace(tutor.id,correct?'success':'retry');practice.querySelector('.game-tutor-face').src=asset(tutor.images[emotion]||tutor.images.기본);practice.dataset.face=emotion;
   practice.querySelector('.life-expression-tutor').textContent=lifeTutorLine(tutor.id,correct?'practiceSuccess':'practiceRetry');
   const feedback=practice.querySelector('.life-expression-feedback');feedback.hidden=false;feedback.querySelector('p').textContent=exercise.explanation;
   practice.querySelectorAll('[data-expression-choice]').forEach(b=>{b.classList.toggle('is-chosen',b===button);b.disabled=correct;});
   const back=practice.querySelector('.life-expression-return');back.disabled=!correct;if(correct)back.focus({preventScroll:true});
   if(correct&&onPracticeSuccess){
    let message;try{const result=onPracticeSuccess(exercise.id);message=result?.status?.message;}catch{message='연습 결과를 저장하지 못했어요. 연결 상태를 확인해 주세요.';}
    if(message&&practice){const notice=document.createElement('p');notice.className='life-expression-save';notice.setAttribute('role','status');notice.textContent=message;practice.querySelector('.life-expression-feedback').append(notice);}
   }
  }));
  practice.showModal();practice.querySelector('[data-expression-choice]')?.focus({preventScroll:true});
 }
 helpButton.addEventListener('click',()=>{if(onHelp)onHelp();else openGuide();});
 const visibility=()=>{quiet();if(!document.hidden)idle();};document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',visibility);
 update(state);
 return {element,update,openGuide,openPractice,setActive(value){if(active===!!value&&element.dataset.reduced===String(isReduced()))return;active=!!value;if(!active)quiet();else idle();},metrics:()=>({tutor:tutor.id,scope:state.scope,kind,face:element.dataset.face,guideOpen:!!guide,practice:exercise?{id:exercise.id,selected,correct}:null,practised:[...practised],reactionAudioPlaying:!!clip&&!clip.paused}),dispose(){disposed=true;quiet();closeGuide({focus:false});closePractice({focus:false});element.remove();document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',visibility);}};
}
