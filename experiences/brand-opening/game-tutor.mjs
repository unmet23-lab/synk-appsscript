import {GAME_GUIDES,getTutor,tutorLine,tutorFace} from './game-tutor-lines.mjs';
import {acceptTutorEvent,TUTOR_GAME_COMMAND} from './game-tutor-contract.mjs';
import {createTutorPractice} from './tutor-practice.mjs';
import {readPractice,practiceKey} from './tutor-practice-core.mjs';
import {createSupportLedger,supportLabel,supportLine} from './game-tutor-support.mjs';
import {createTutorReview} from './tutor-review.mjs';
import {getPref} from './world-sound.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=path=>new URL(path,import.meta.url).href;
const delays={marin:260,kkamong:130,mongle:0};
const practicedHere=new Set();
const labels={ready:'함께하는 튜터',playing:'함께하는 튜터',paused:'쉬는 중',listening:'같이 듣는 중',picked:'고른 답',success:'맞았어요',combo:'연속으로 맞았어요',retry:'다시 해 봐요',unanswered:'답을 고르지 않았어요',obstacle:'부딪혔어요',timing:'박자',finish:'놀이 끝',rest:'쉬어도 돼요'};
// 정·오답에 튜터가 자세를 한 번 바꾸는 반응(설정의 「친구들의 반응」이 꺼지면 가만히 있다). 말풍선 글은 반응과 따로 늘 바뀐다.
const REACTIONS=new Set(['success','combo','retry','unanswered','obstacle','timing','finish','rest']);
const reactionsOn=()=>getPref('reactions');
export function gameTutorPresentation(value){
 return Object.freeze({support:['choose','step','independent'].includes(value?.support)?value.support:'choose',
  explanation:['brief','standard','detailed'].includes(value?.explanation)?value.explanation:'standard'});
}
export function createGameTutor({tutorId,game,container,frame=null,reduced=()=>false,owner='guest',onExit=()=>{},practiceEnabled=true,presentation=null}){
 const tutor=getTutor(tutorId),guide=GAME_GUIDES[game];if(!tutor||!guide||!container)return null;
 // The WORLD owner supplies verified preferences. Snapshot only these display
 // choices; a later account change disposes this companion through its host.
 const preferences=gameTutorPresentation(presentation),independent=preferences.support==='independent';
 let disposed=false,phase='lobby',kind='ready',counts={},streak=0,misses=0,lastKind='',lastAt=0,sound=false,clip=null,guideOpen=false;
 const timers=new Set();
 let answerUntil=0;
 const practiceScope=practiceKey(owner,tutorId,game);
 let practice=null,review=null,channelReady=!frame,pendingStart=false,practiced=practicedHere.has(practiceScope);
 let supportStorage;try{supportStorage=localStorage;}catch{}
 const ledger=createSupportLedger({storage:supportStorage,owner,tutor:tutorId,game});
 try{practiced=practiced||readPractice(localStorage,owner,tutorId,game);}catch{}
 const guideKey=`synk.world.tutor.instructions.v1:${encodeURIComponent(owner)}:${tutorId}:${game}`;
 let guideSeen=false;try{guideSeen=sessionStorage.getItem(guideKey)==='true';}catch{}
 try{sound=localStorage.getItem('synk.world.tutor.sound')==='true';}catch{}
 const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!disposed&&!document.hidden)fn();},ms);timers.add(id);};
 const stopSound=()=>{clip?.pause();clip=null;};
 const clear=()=>{timers.forEach(clearTimeout);timers.clear();stopSound();};
 const portrait=()=>`<span class="game-tutor-portrait" data-character="${tutor.id}"><img class="game-tutor-body" src="${asset('assets/tutors/'+tutor.images.기본)}" alt="${tutor.name}" width="480" height="480"><img class="game-tutor-face" src="${asset('assets/tutors/'+tutor.images.기본)}" alt="" aria-hidden="true" width="480" height="480"></span>`;
 const element=document.createElement('aside');element.className='game-tutor';element.dataset.tutor=tutor.id;element.dataset.tutorGame=game;element.dataset.phase=phase;
 element.setAttribute('aria-label',`${tutor.name} · 함께하는 AI 튜터`);
 element.innerHTML=`${portrait()}<div class="game-tutor-message"><small><b>${tutor.name}</b> · <span class="game-tutor-label">함께하는 튜터</span></small><p class="game-tutor-line" role="status" aria-live="polite">${escape(tutorLine(tutor.id,'ready'))}</p></div><button class="game-tutor-help" type="button" aria-label="${tutor.name}에게 조작법 다시 보기">조작법</button>`;
 container.classList.add('has-game-tutor');container.prepend(element);
 const help=document.createElement('dialog');help.className='game-tutor-guide';help.setAttribute('aria-label',`${tutor.name}과 ${guide.title} 조작법`);
 help.dataset.explanation=preferences.explanation;
 const instruction=text=>preferences.explanation==='standard'?`<p>${escape(text)}</p>`:`<details class="game-tutor-explanation" ${preferences.explanation==='detailed'?'open':''}><summary>조작 설명 더 보기</summary><p>${escape(text)}</p></details>`;
 help.innerHTML=`<div class="game-tutor-guide-top">${portrait()}<div><small>${tutor.name} · ${escape(guide.title)}</small><h3>${escape(guide.title)} 조작법</h3><p>${escape(tutorLine(tutor.id,'hint'))}</p></div></div><ol>${guide.steps.map(s=>`<li><span class="game-tutor-key">${escape(s.keys)}</span><div><h4>${escape(s.title)}</h4>${instruction(s.text[tutor.id])}</div></li>`).join('')}</ol><div class="game-tutor-guide-footer"><button class="game-tutor-continue" type="button">이어서 하기</button><button class="game-tutor-practice" type="button">조작 연습하기</button><button class="game-tutor-sound" type="button" aria-pressed="${sound}">튜터 소리 ${sound?'켜짐':'꺼짐'}</button><small>놀이 중에는 듣기에 집중하도록 튜터 소리가 멈춰요.</small></div>`;
 container.append(help);
 const supportList=document.createElement('section');supportList.className='tutor-support-list';supportList.setAttribute('aria-label','최근 어려웠던 곳과 힌트');help.querySelector('ol').before(supportList);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='tutor-guide-toggle';toggle.textContent='조작법도 보기';help.querySelector('.game-tutor-guide-footer').prepend(toggle);
 toggle.addEventListener('click',()=>{const ol=help.querySelector('ol');ol.hidden=!ol.hidden;toggle.textContent=ol.hidden?'조작법도 보기':'조작법 접기';});
 function refreshSupport(){
  const list=ledger.list();supportList.hidden=!list.length;toggle.hidden=!list.length;help.querySelector('ol').hidden=!!list.length;
  help.querySelector('h3').textContent=list.length?'힌트':`${guide.title} 조작법`;
  const button=element.querySelector('.game-tutor-help');button.textContent=list.length?(ledger.pending()?'힌트':'복습'):'조작법';button.dataset.support=list.length?(ledger.pending()?'pending':'done'):'none';button.setAttribute('aria-label',`${tutor.name}에게 ${list.length?'힌트와 어려웠던 곳 다시 연습':'조작법 다시 보기'}`);
  supportList.replaceChildren();
  for(const entry of [...list].reverse()){
   const row=document.createElement('article');row.className='tutor-support-item';row.dataset.practised=String(entry.practised);row.dataset.supportType=entry.type;row.dataset.supportId=entry.id;
   const label=document.createElement('span');label.className='support-label';label.dataset.kind=entry.type;label.textContent=supportLabel(entry,game)+(entry.practised?' · 연습함':'');
   const title=document.createElement('h4');title.textContent=entry.title;
   const hint=document.createElement('p');hint.textContent=supportLine(tutor.id,entry);
   const fact=document.createElement('p');fact.className='tutor-support-fact';fact.textContent=entry.hint;
   const retry=document.createElement('button');retry.type='button';retry.className='tutor-support-retry';retry.textContent=entry.step?'이 동작 연습하기':'이 문제 다시 풀기';retry.addEventListener('click',()=>entry.step?openPractice({entry}):openReview(entry));
   row.append(label,title,hint);
   let detail=row;
   if(preferences.explanation!=='standard'){
    detail=document.createElement('details');detail.className='game-tutor-explanation';detail.open=preferences.explanation==='detailed';
    const summary=document.createElement('summary');summary.textContent='힌트와 근거 더 보기';detail.append(summary);row.append(detail);
   }
   detail.append(fact);
   if(entry.review){const quote=document.createElement('blockquote');quote.textContent=entry.review.prompt;detail.append(quote);}
   row.append(retry);supportList.append(row);
  }
 }
 // 힌트를 눌러 열었을 때만: 아직 연습하지 않은 첫 줄(맨 위)에 「다음에 누를 곳」 정지 표시를 한 번 둔다. 움직이지 않는다.
 function markNext(){
  const rows=[...supportList.querySelectorAll('.tutor-support-item')];rows.forEach(row=>delete row.dataset.next);
  const next=rows.find(row=>row.dataset.practised!=='true');if(!next)return null;
  next.dataset.next='true';return next.querySelector('.tutor-support-retry');
 }
 const face=element.querySelector('.game-tutor-face'),line=element.querySelector('.game-tutor-line'),label=element.querySelector('.game-tutor-label');
 const body=element.querySelector('.game-tutor-portrait');
 const setFace=emotion=>{face.src=asset('assets/tutors/'+(tutor.images[emotion]||tutor.images.기본));element.dataset.face=emotion;};
 // 대기 중에는 스스로 움직이지 않는다(조사 ⑤ · 유호님 멀미 기준) — 예전의 눈 깜빡임 반복은 뺐다. 이름은 부르는 곳을 위해 남긴다.
 function idle(){}
 function playSound(emotion){
  stopSound();if(!sound||phase==='playing'||practice||review||document.hidden||!reactionsOn())return;
  const pool=tutor.sounds[emotion]||tutor.sounds.기본;if(!pool?.length)return;
  const voice=new Audio(asset('assets/tutors/'+pool[Math.floor(Math.random()*pool.length)]));clip=voice;voice.volume=.28;voice.play().catch(()=>{if(clip===voice)stopSound();});
 }
 function renderReaction(next,support=null){
  clear();kind=next;element.dataset.reaction=next;element.dataset.reduced=String(reduced());delete body.dataset.reaction;
  const index=counts[next]||0;counts[next]=index+1;
  // 자세는 정·오답 순간에 한 번만 바꾼다(회전 없음, 220ms). 「친구들의 반응」이 꺼져 있으면 기본 얼굴 그대로.
  const pose=REACTIONS.has(next)&&reactionsOn();
  if(pose){setFace(tutorFace(tutor.id,next));if(!reduced())body.dataset.reaction=next;}
  else if(!REACTIONS.has(next))setFace(tutorFace(tutor.id,next));
  later(()=>{line.textContent=support?supportLine(tutor.id,support):tutorLine(tutor.id,next,index);label.textContent=support?supportLabel(support,game):labels[next]||labels.ready;playSound(['success','combo','finish'].includes(next)?'기쁨':next==='retry'?'안심':'기본');},reduced()?0:delays[tutor.id]);
  if(pose)later(()=>{setFace('기본');delete body.dataset.reaction;},1800);
 }
 function react(event,detail={}){
  if(disposed)return;
  const added=ledger.add(detail.support);if(added.length)refreshSupport();
  const now=performance.now();let next=event;
  if(phase==='playing'&&!detail.answer&&['success','retry'].includes(event)&&now<answerUntil)return;
  if(detail.answer)answerUntil=now+2200;
  if(event==='success'){streak++;misses=0;if(streak>=3)next='combo';}
  else if(event==='retry'){streak=0;misses++;if(detail.reason)next=detail.reason;}
  else if(event==='finish')next=detail.completed===false?'rest':'finish';
  // Notes can arrive at the same beat. Answer feedback always has priority.
  if(!detail.answer&&['success','combo','timing'].includes(next)&&next===lastKind&&now-lastAt<1200)return;
  const support=added.find(e=>['language','audio','unanswered'].includes(e.type))||added[0];
  if(support)next=support.type==='timing'?'timing':support.type==='unanswered'?'unanswered':'retry';
  lastKind=next;lastAt=now;renderReaction(next,support);
 }
 function command(action){if(frame?.isConnected)frame.contentWindow?.postMessage({type:TUTOR_GAME_COMMAND,version:1,game,action,tutor:tutor.id},location.origin);}
 function endPractice({keepPaused=false}={}){practice?.dispose();practice=null;review?.dispose();review=null;if(!keepPaused){command('help-close');if(frame){frame.inert=false;frame.focus({preventScroll:true});}}}
 function openPractice({entry=null}={}){
  if(disposed||practice||review)return;
  if(guideOpen)closeGuide({keepPaused:true});command('help');clear();if(frame)frame.inert=true;
  practice=createTutorPractice({tutor,game,container,reduced,getSound:()=>sound,owner,replay:practiced||!!entry||independent,focusSteps:entry?[entry.step]:null,timed:entry?.timed===true,
   onComplete:()=>{
    if(entry){ledger.mark(entry);refreshSupport();endPractice();command('help-resume');return;}
    practiced=true;practicedHere.add(practiceScope);guideSeen=true;try{sessionStorage.setItem(guideKey,'true');}catch{}
    endPractice();if(frame){if(channelReady)command('practice-complete');else pendingStart=true;}
   },
   // 연습의 닫기(×)는 연습만 닫고 그 게임의 시작 화면으로 돌아간다(10-14 리드 — 예전에는 처음 연습을 닫으면 놀이 판까지 닫혔다).
   // 완료 기록은 남기지 않으므로 다음에 이 게임을 열면 연습이 다시 먼저 나온다. 시작 화면에서는 튜터 띠의 「조작법」으로 다시 열 수 있다.
   onCancel:()=>{if(entry){endPractice({keepPaused:true});openGuide();return;}endPractice();element.querySelector('.game-tutor-help').focus({preventScroll:true});}
  });
 }
 function openReview(entry){
  if(disposed||practice||review)return;
  if(guideOpen)closeGuide({keepPaused:true});command('help');clear();if(frame)frame.inert=true;
  review=createTutorReview({tutor,game,entry,container,reduced,onComplete:()=>{ledger.mark(entry);refreshSupport();endPractice();command('help-resume');},onCancel:()=>{endPractice({keepPaused:true});openGuide();}});
 }
 function closeGuide({keepPaused=false}={}){
  if(!guideOpen)return;guideOpen=false;guideSeen=true;try{sessionStorage.setItem(guideKey,'true');}catch{}
  help.close();if(!keepPaused)command('help-close');if(frame){if(!keepPaused){frame.inert=false;frame.focus({preventScroll:true});}}else element.querySelector('.game-tutor-help').focus({preventScroll:true});
 }
 function openGuide(){
  if(disposed||guideOpen||practice||review)return;refreshSupport();command('help');stopSound();guideOpen=true;if(frame)frame.inert=true;
  const next=markNext();
  help.dataset.reduced=String(reduced());help.showModal();(next||help.querySelector('.game-tutor-continue')).focus({preventScroll:true});
 }
 function setPhase(next){
  if(disposed)return;const previous=phase;clear();phase=next;element.dataset.phase=phase;
  if(next==='lobby'){counts={};streak=0;misses=0;react('ready');}
  else if(next==='playing'){if(previous!=='paused'){counts={};streak=0;misses=0;answerUntil=0;}react('playing');if(guideOpen||practice||review)command('help');}
  else if(next==='paused'){react('paused');}
 }
 const message=event=>{
  const data=acceptTutorEvent(event,{source:frame?.contentWindow,origin:location.origin,game});if(!data||disposed)return;
  if(data.kind==='ready'){channelReady=true;command('configure');if(practice||review||guideOpen)command('help');if(pendingStart){pendingStart=false;command('practice-complete');}return;}
  if(['lobby','playing','paused'].includes(data.kind))setPhase(data.kind);
  else {if(data.kind==='finish')phase='results';else if(data.kind==='listening')phase='playing';element.dataset.phase=phase;react(data.kind,data);}
 };
 element.querySelector('.game-tutor-help').addEventListener('click',openGuide);
 help.querySelector('.game-tutor-continue').addEventListener('click',closeGuide);
 help.querySelector('.game-tutor-practice').addEventListener('click',openPractice);
 help.querySelector('.game-tutor-sound').addEventListener('click',event=>{sound=!sound;try{localStorage.setItem('synk.world.tutor.sound',String(sound));}catch{}event.currentTarget.textContent=`튜터 소리 ${sound?'켜짐':'꺼짐'}`;event.currentTarget.setAttribute('aria-pressed',String(sound));if(sound)playSound('기본');else stopSound();});
 help.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();closeGuide();});
 const visibility=()=>{clear();setFace('기본');if(!document.hidden)idle();};
 const motion=matchMedia('(prefers-reduced-motion:reduce)');
 document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',visibility);
 if(frame)window.addEventListener('message',message);
 refreshSupport();setFace('기본');idle();
 // Independent learners use the game's normal start button. Skipping this
 // optional companion introduction must never mark a practice as completed.
 if(!independent)queueMicrotask(()=>{if(disposed||phase!=='lobby')return;if(practiceEnabled&&!practiced)openPractice();else if(!guideSeen)openGuide();});
 return Object.freeze({element,react,setPhase,openGuide,openPractice,metrics:()=>({tutor:tutor.id,game,phase,kind,streak,misses,guideOpen,sound,practiced,presentation:{...preferences},difficulties:ledger.list(),review:review?.metrics()||null,practice:practice?.metrics()||null,reactionAudioPlaying:clip?.paused===false}),dispose(){
  if(disposed)return;disposed=true;clear();if(help.open)help.close();
  practice?.dispose();practice=null;review?.dispose();review=null;
  if(frame)window.removeEventListener('message',message);document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',visibility);
  help.remove();element.remove();container.classList.remove('has-game-tutor');
 }});
}
