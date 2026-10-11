import {PACKS,LESSONS,lessonById,packById} from './life-content.mjs';
import {CAFE_LESSON_ID,CAFE_COMPOSE_ID,CAFE_LESSON_IDS,CAFE_VISITS,isCafeLesson,resumeCafe,chooseCafe,advanceCafe,chooseCafeSeat,cafeQuestion,updateCafeOrder,submitCafeOrder} from './cafe-activity.mjs';
import {cafeMarkup,cafeCompletionMarkup,createCafeSpeech} from './cafe-ui.mjs';
if(!document.querySelector('[data-life-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./life-ui.css',import.meta.url).href;style.dataset.lifeStyle='true';document.head.append(style);}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const friends={mongle:{name:'몽글',file:'friend-mongle.webp'},kkamong:{name:'까몽',file:'friend-kkamong.webp'},marine:{name:'마린',file:'friend-marine.webp'}};
const phaseNames={expressions:'표현 만나기',story:'세 친구 이야기',apply:'생활에서 써 보기',visit:'다음 카페 이야기',compose:'내 주문 만들기'};
const dayLabel=at=>Number.isFinite(at)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at)):'';
export function createLifeExperience({home,getProgress,show=(title,html,options)=>home.showPanel(title,html,options),asset,onSummary=()=>{}}){
 const panel=document.querySelector('#world-panel'),content=document.querySelector('#panel-content');
 for(const [variable,file]of Object.entries({'--cafe-room':'cafe-room-v1.webp','--cafe-drinks':'cafe-drinks-v2.png','--cafe-ice':'cafe-ice.webp'}))panel.style.setProperty(variable,`url("${asset('home/'+file)}")`);
 let context=null,shown=false,rendering=false,ended=false,reviewRun=null,lastFeedback=null,helped=false,generation=0,timer,cafeRun=null,companion=null,place='life';
 const practised=new Set();
 const exposedTransfers=new Set();
 const speech=createCafeSpeech({asset,onChange(){if(ended||!shown||context?.phase!=='cafe')return;const metrics=speech.metrics(),button=content.querySelector('[data-life-cafe-speech]'),status=content.querySelector('.cafe-speech-status');if(button)button.textContent=!metrics.available?'질문 소리 다시 준비하기':metrics.phase==='playing'?'질문 듣기 잠깐 멈추기':metrics.phase==='paused'?'질문 이어 듣기':cafeRun.listen?.heard?'직원 질문 다시 듣기':'직원 질문 듣기';if(status&&metrics.phase==='error')status.textContent='소리를 재생하지 못했어요. 다시 듣기를 눌러 주세요.';companion?.update(tutorState());}});
 void speech.prepare();
 const summary=()=>getProgress().summary(PACKS,LESSONS);
 const photo=(speaker,size='')=>friends[speaker]?`<img class="life-friend ${size}" src="${asset('home/'+friends[speaker].file)}" alt="${friends[speaker].name}" width="384" height="384">`:'';
 function updateHome(){if(ended)return;try{const value=summary();home.updateLearning?.(value,{snapshot:getProgress().exportSnapshot(),lessons:LESSONS,preparePractice:prepareHomePractice,completePractice:completeTutorPractice,finishDay:finishTutorDay});onSummary(value);}catch{}}
 function completeTutorPractice(questionId,tutorId){if(ended)throw Error('학습 연결이 바뀌었어요.');return getProgress().recordGuidedPractice({questionId,tutorId});}
 function finishTutorDay(){if(ended)throw Error('학습 연결이 바뀌었어요.');return getProgress().markDayComplete();}
 function prepareHomePractice(id){
  if(ended)return false;
  try{
   const p=getProgress(),s=p.status();if(['loading','conflict','unreadable'].includes(s.phase)||s.rejected)return false;
   const snapshot=p.exportSnapshot(),record=Object.values(snapshot.reviews).find(r=>r.questionId===id);
   if(!record||record.lapses<=0||record.streak!==0)return false;
   exposedTransfers.add(record.id);
   const run=record.dueAt<=Date.now()?p.startReview(6,record.id):snapshot.activeReview;
   // Seeing this same transfer before finishing an active review is assistance.
   if(run?.ids.includes(record.id)&&!run.answers[record.id])p.markReviewHelp(record.id);
   return true;
  }catch{return false;}
 }
 function statusLine(){const s=getProgress().status();return `<p class="life-save-status" data-save-phase="${escape(s.phase)}" role="status">${escape(s.message)}</p>`;}
 function tutorState(){
  const l=lessonById(context?.lessonId),cafe=context?.phase==='cafe';
  const original=context?.phase==='review'?l?.questions.find(q=>q.review.id===context.reviewQuestion?.id):l?.questions[context?.questionIndex];
  const q=context?.phase==='review'?context.reviewQuestion:original;
  const current=cafe?['choose','repair','response'].includes(cafeRun.phase):['questions','review'].includes(context?.phase);
  const requiresHearing=cafe&&current&&cafeRun.listen?.mode==='listen'&&!cafeRun.listen.heard&&!cafeRun.listen.textShown;
  return {scope:place,phase:cafe?cafeRun.phase:context?.phase,question:current?q:null,questionId:original?.id,answered:cafe?!!cafeRun.choiceId:!!lastFeedback,
   feedback:current&&!cafe?lastFeedback:null,helped,requiresHearing,listening:cafe&&speech.metrics().phase==='playing',compose:cafe&&context.lessonId===CAFE_COMPOSE_ID&&cafeRun.step===0};
 }
 function tutorHint(){
  speech.pause();if(!context)return;
  if(context.phase==='cafe'){
   if(tutorState().requiresHearing)cafeRun={...cafeRun,listen:{...cafeRun.listen,textShown:true}};
   helped=true;persistCafe();renderCafe();return;
  }
  if(!['questions','review'].includes(context.phase))return;
  // Asking after grading cannot revise the recorded first response.
  if(!lastFeedback){helped=true;if(context.phase==='questions')persistStage();else getProgress().markReviewHelp(context.reviewId);}
  const hint=content.querySelector('.life-hint');if(hint)hint.hidden=false;
  content.querySelector('[data-life-help]')?.setAttribute('aria-expanded','true');
  companion?.update({...tutorState(),hinting:true});
 }
 function prepareTutorPractice(id){
  const value=tutorState();if(value.questionId!==id||value.answered)return;
  helped=true;if(context.phase==='cafe')persistCafe();else if(context.phase==='questions')persistStage();else if(context.phase==='review')getProgress().markReviewHelp(context.reviewId);
 }
 const retryButton=q=>home.mountLifeTutor&&home.tutor?.().tutor?`<button class="life-tutor-retry" data-life-tutor-retry="${escape(q.id)}">튜터와 이 표현 다시 연습</button>`:'';
 function paint(title,html,{type='life-library',focus='.life-heading',eyebrow='LIFE IN KOREA'}={}){
  generation++;rendering=true;show(title,html+statusLine(),{type,eyebrow,nav:'play'});
  const tutor=home.mountLifeTutor?.({state:tutorState(),snapshot:getProgress().exportSnapshot(),lessons:LESSONS,practised:[...practised],onHint:tutorHint,onPause:()=>speech.pause(),onPreparePractice:prepareTutorPractice,onPracticeSuccess:id=>completeTutorPractice(id,home.tutor?.().tutor),onPracticeComplete:id=>{practised.add(id);companion?.update({...tutorState(),practiceCompleted:true});}});
  companion=tutor;
  home.attachPanelResource({dispose(){tutor?.dispose();if(companion===tutor)companion=null;if(!rendering){speech.stop();shown=false;generation++;try{void getProgress().flush().catch(()=>{});}catch{}context=null;reviewRun=null;lastFeedback=null;}}});
  rendering=false;shown=true;content.querySelector(focus)?.focus({preventScroll:true});updateHome();
 }
 function ensureReadable(){const s=getProgress().status();if(s.phase!=='unreadable')return true;paint('진도를 확인해 주세요',`<p class="panel-description">${escape(s.message)}</p><p class="dialog-note">기존 기록은 유지하고 있어요. 나의 공간에서 연결 상태를 확인해 주세요.</p>`);return false;}
 function packCard(pack,{story=false}={}){
  const p=getProgress(),done=pack.lessons.filter(l=>p.lessonState(l.id).status==='completed').length,episode=pack.lessons.find(l=>l.type==='story');
  return `<button class="life-pack-card" data-life-${story?'lesson':'pack'}="${story?episode.id:pack.id}"><span class="life-card-art">${photo(story?'kkamong':'mongle')}</span><span><small>${story?'세 친구 이야기':'생활 한국어 · '+pack.level}</small><strong>${escape(story?episode.title:pack.title)}</strong><span>${escape(story?episode.goal:pack.subtitle)}</span><em>${story?p.lessonState(episode.id).status==='completed'?'읽은 이야기 · 다시 보기':'함께 읽고 골라요':`${done} / ${pack.lessons.length} 단계`}</em></span><span class="life-card-arrow" aria-hidden="true">↗</span></button>`;
 }
 function packs(){if(!ensureReadable())return;place='life';context=null;paint('작은 말로 시작하는 한국 생활',`<div class="life-heading" tabindex="-1"><p>인사부터 약속까지, 친구들과 한 팩씩.</p><p class="life-library-note">${PACKS.length}개 생활 팩 · ${LESSONS.length}개 짧은 학습</p></div><div class="life-pack-grid">${PACKS.map(p=>packCard(p)).join('')}</div><div class="life-library-footer"><button class="plain-button" data-life-stories>세 친구 이야기 모아 보기</button><button class="plain-button" data-life-review>오늘의 복습</button></div>`);}
 function cafeVisitCards(){const p=getProgress();return CAFE_VISITS.map(visit=>{const state=p.lessonState(visit.id);return `<button data-life-lesson="${visit.id}" class="life-lesson-card cafe-visit-card"><span class="life-step-number">${String(visit.number).padStart(2,'0')}</span><span><small>${visit.number}번째 카페 방문</small><strong>${escape(visit.title)}</strong><span>${escape(visit.description)}</span></span><em>${state.status==='completed'?'다녀왔어요 · 다시 보기':state.status==='started'?'이어서 하기':'들르기'}</em></button>`;}).join('');}
 function stories(){if(!ensureReadable())return;place='life';context=null;paint('까몽·몽글·마린의 작은 하루',`<div class="life-heading" tabindex="-1"><div class="life-cast">${Object.keys(friends).map(f=>photo(f)).join('')}</div><p>주문하고, 길을 찾고, 약속을 지켜요.<br>세 친구와 읽고 고르는 생활 이야기.</p></div><div class="life-pack-grid">${PACKS.map(p=>packCard(p,{story:true})).join('')}</div><h3 class="cafe-library-title">내가 함께 만드는 카페 이야기</h3><div class="life-lesson-list">${cafeVisitCards()}</div>`);}
 function pack(id){if(!ensureReadable())return;const value=packById(id);if(!value)return;place=id==='cafe'?'cafe':'life';context=null;
  const p=getProgress(),activeId=p.exportSnapshot().activeLessonId,nextVisit=CAFE_VISITS.find(v=>v.id===activeId)||CAFE_VISITS.find(v=>p.lessonState(v.id).status==='started')||CAFE_VISITS.find(v=>p.lessonState(v.id).status!=='completed')||CAFE_VISITS[0],visited=CAFE_VISITS.filter(v=>p.lessonState(v.id).status==='completed').length;
  const cafe=id==='cafe'?`<div class="cafe-pack-preview"><img src="${asset('home/cafe-room-v1.webp')}" alt="햇살이 드는 동네 카페" width="1600" height="900"><div><small>우리의 카페 · ${visited} / ${CAFE_VISITS.length}번의 작은 하루</small><h3>${escape(nextVisit.title)}</h3><p>${escape(nextVisit.description)}</p><button class="felt-button" data-life-lesson="${nextVisit.id}">${p.lessonState(nextVisit.id).status==='started'?'카페에서 이어서 하기':nextVisit.number===1?'카페에 들어가기':'다음 카페 이야기'} <span aria-hidden="true">→</span></button></div></div><h3 class="cafe-library-title">다시 올 때마다 다른 하루</h3><div class="life-lesson-list cafe-visit-list">${cafeVisitCards()}</div>`:'';
  paint(value.title,`${cafe}<div class="life-heading" tabindex="-1"><p class="life-pack-description">${escape(value.subtitle)}</p><p class="life-library-note">${escape(value.level)} · ${id==='cafe'?'주문 전에 표현과 이야기도 만나 보세요.':'표현 → 이야기 → 생활 적용'}</p></div><div class="life-lesson-list">${value.lessons.filter(l=>id!=='cafe'||!isCafeLesson(l.id)).map((l,i)=>{const state=p.lessonState(l.id);return `<button data-life-lesson="${l.id}" class="life-lesson-card"><span class="life-step-number">${String(i+1).padStart(2,'0')}</span><span><small>${phaseNames[l.type]}</small><strong>${escape(l.title)}</strong><span>${escape(l.goal)}</span></span><em>${state.status==='completed'?'완료 · 다시 하기':state.status==='started'?'이어서 하기':'시작'}</em></button>`;}).join('')}</div><div class="life-library-footer"><button class="plain-button" data-life-packs>전체 생활 팩</button><button class="plain-button" data-life-review>복습 일정 보기</button></div>`);}
 function next(){if(!ensureReadable())return;const s=summary();if(s.nextLesson)return start(s.nextLesson.id);if(s.dueCount)return review();packs();}
 function start(id){if(!ensureReadable())return;const lesson=lessonById(id);if(!lesson)return;place=lesson.packId==='cafe'?'cafe':'life';
  speech.stop();
  const p=getProgress();p.summary(PACKS,LESSONS);const previous=p.lessonState(id),state=p.startLesson(lesson,{replay:previous.status==='completed'&&previous.cursor===previous.total});
  context={lessonId:id,phase:state.stage.phase,sceneIndex:state.stage.sceneIndex,questionIndex:state.cursor};reviewRun=null;lastFeedback=null;helped=state.stage.helped===true;
  cafeRun=null;
  if(isCafeLesson(id)){cafeRun=resumeCafe(state,id);if(!cafeRun.listen)cafeRun={...cafeRun,listen:{mode:cafeRun.phase==='welcome'&&speech.available()?'listen':'read',heard:false,textShown:false}};context.phase='cafe';if(cafeRun.phase==='complete')return finishCafe();persistCafe();return renderCafe();}
  if(state.cursor>=lesson.questions.length)return finish();
  if(state.cursor>0)context.phase='questions';
  renderLesson();
 }
 function cafeStage(value=cafeRun){return {phase:'questions',sceneIndex:value.step,questionIndex:value.step,helped,cafe:value};}
 function persistCafe(){getProgress().setStage(context.lessonId,cafeStage());}
 function renderCafe(){
  context.phase='cafe';context.questionIndex=cafeRun.step;
  const q=cafeQuestion(cafeRun.step,context.lessonId),first=q?getProgress().lessonState(context.lessonId).answers[q.id]:null;
  paint('구름 한 잔, 카페',cafeMarkup(cafeRun,{photo,helped,firstAnswer:first,retryButton,lessonId:context.lessonId,speechAvailable:speech.available(),speechPhase:speech.metrics().phase}),{type:'life-cafe',focus:'.cafe-focus',eyebrow:'LIFE IN KOREA · CAFE'});
 }
 function ensureHeard(){if(cafeRun.listen?.mode==='listen'&&!cafeRun.listen.heard&&!cafeRun.listen.textShown)throw Error('직원 질문을 끝까지 듣거나 글자 도움을 열어 주세요.');}
 function cafeChoose(choiceId){
  ensureHeard();speech.stop();
  const id=context.lessonId,next=chooseCafe(cafeRun,choiceId,id),p=getProgress(),q=cafeQuestion(cafeRun.step,id);
  if(!p.lessonState(id).answers[q.id])p.recordAnswer({lessonId:id,questionId:q.id,choiceId,correct:choiceId===q.answerId,helped,stage:cafeStage(next),input:cafeRun.listen});
  else p.setStage(id,cafeStage(next));
  cafeRun=next;renderCafe();
 }
 function cafeSubmit(){
  ensureHeard();const id=context.lessonId,next=submitCafeOrder(cafeRun),p=getProgress(),q=cafeQuestion(0,id);speech.stop();
  if(!p.lessonState(id).answers[q.id])p.recordAnswer({lessonId:id,questionId:q.id,choiceId:next.choiceId,correct:next.choiceId===q.answerId,helped,order:cafeRun.order,input:cafeRun.listen,stage:cafeStage(next)});else p.setStage(id,cafeStage(next));
  cafeRun=next;renderCafe();
 }
 async function cafeSpeech(){
  if(!speech.available()&&!await speech.prepare())throw Error('질문 소리를 준비하지 못했어요. 다시 준비하거나 글자 도움을 열어 주세요.');
  const state=speech.metrics();if(state.phase==='playing'){speech.pause();return;}
  const id=context.lessonId,step=cafeRun.step,lineId=`${id}-${step+1}`;
  await speech.play(lineId,()=>{if(ended||!shown||context?.phase!=='cafe'||context.lessonId!==id||cafeRun.step!==step)return;try{cafeRun={...cafeRun,listen:{...cafeRun.listen,heard:true}};persistCafe();renderCafe();}catch{speech.stop();}});
 }
 function cafeNext(){
  speech.stop();
  const next=advanceCafe(cafeRun,context.lessonId);helped=false;
  getProgress().setStage(context.lessonId,cafeStage(next));cafeRun=next;
  if(next.phase==='complete')finishCafe();else renderCafe();
 }
 function finishCafe(){
  const p=getProgress();p.finishLesson(context.lessonId);context.phase='complete';context.questionIndex=3;
  const nextId=CAFE_LESSON_IDS.find(id=>p.lessonState(id).status!=='completed'),nextLesson=nextId?lessonById(nextId):packById('cafe').lessons.find(l=>p.lessonState(l.id).status!=='completed');
  paint('오늘의 카페, 잘 다녀왔어요',cafeCompletionMarkup({photo,nextLesson,lessonId:context.lessonId,state:cafeRun}),{type:'life-cafe-complete',focus:'.cafe-focus',eyebrow:'LIFE IN KOREA · CAFE'});
  const ticket=generation;p.flush().catch(()=>{if(shown&&ticket===generation)home.toast('카페 기록을 저장하고 있어요. 화면의 진행은 유지돼요.');});
 }
 function persistStage(){const p=getProgress();if(context)p.setStage(context.lessonId,{phase:context.phase,sceneIndex:context.sceneIndex,questionIndex:context.questionIndex,helped});}
 function lessonHeader(l){const pack=packById(l.packId);return `<div class="life-session-meta" data-life-session="${escape(getProgress().lessonState(l.id).attemptId)}" data-life-lesson-id="${l.id}" data-life-phase="${context.phase}" data-life-step="${context.questionIndex}"><span>${escape(pack.title)} · ${phaseNames[l.type]}</span><span>${context.phase==='questions'?`${Math.min(context.questionIndex+1,l.questions.length)} / ${l.questions.length}`:'친구와 준비하기'}</span></div>`;}
 function renderLesson(){
  if(!context)return;const l=lessonById(context.lessonId);if(!l)return;const header=lessonHeader(l);
  if(context.phase==='intro'){
   const scene=l.scenes[0];
   paint(l.title,`${header}<div class="life-intro"><div class="life-heading" tabindex="-1">${photo('mongle','life-intro-friend')}<p class="life-goal">${escape(l.goal)}</p><p>읽고 고르는 기초 생활 한국어</p></div><div class="life-expression-list">${l.expressions.map(e=>`<article><strong>${escape(e.korean)}</strong><p>${escape(e.meaning)}</p></article>`).join('')}</div></div><div class="life-actions"><button class="felt-button" data-life-begin>${l.type==='story'?'이야기 읽기':'친구와 시작하기'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>마루에서 잠깐 쉬기</button></div>`,{type:'life-lesson'});return;
  }
  if(context.phase==='story'){
   const scene=l.scenes[context.sceneIndex];if(!scene){context.phase='questions';persistStage();renderLesson();return;}
   const friend=friends[scene.speaker];
   paint(l.title,`${header}<div class="life-story-stage"><div class="life-cast">${Object.keys(friends).map(f=>`<div class="${f===scene.speaker?'is-speaking':''}">${photo(f)}<small>${friends[f].name}</small></div>`).join('')}</div><div class="life-dialogue life-heading" tabindex="-1"><small>${friend?friend.name:'이야기'}</small><p>${escape(scene.text)}</p></div></div><div class="life-story-position">${context.sceneIndex+1} / ${l.scenes.length} 장면</div><div class="life-actions"><button class="felt-button" data-life-scene-next>${context.sceneIndex+1===l.scenes.length?'이제 내가 골라 볼게요':'다음 장면'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>이야기 저장하고 쉬기</button></div>`,{type:'life-story'});return;
  }
  renderQuestion();
 }
 function renderQuestion(){
  const l=lessonById(context.lessonId),q=l.questions[context.questionIndex];if(!q)return finish();
  const previous=getProgress().lessonState(l.id).answers[q.id];
  if(previous&&!lastFeedback)lastFeedback={correct:previous.correct,choiceId:previous.choiceId,question:q,helped:previous.helped};
  paint(l.title,`${lessonHeader(l)}${questionMarkup(q,lastFeedback,{lesson:l})}`,{type:'life-question',focus:'.life-question-title'});
 }
 function questionMarkup(q,feedback,{lesson=null,reviewIndex=0,reviewTotal=0}={}){
  const choiceButtons=q.choices.map(c=>`<button class="life-choice ${feedback&&c.id===feedback.choiceId?'is-chosen':''} ${feedback&&c.id===q.answerId?'is-correct':''}" data-life-choice="${c.id}" ${feedback?'disabled':''}><span>${escape(c.text)}</span></button>`).join('');
  return `<div class="life-question-layout"><section class="life-question-copy"><div class="life-question-title" tabindex="-1"><small>${lesson?'읽고 상황에 맞게 골라요':`다른 장면에서 다시 만나요 · ${reviewIndex+1} / ${reviewTotal}`}</small><h3>${escape(q.prompt)}</h3></div><p class="life-context">${escape(q.context||'')}</p><button class="quiet-button life-help" data-life-help ${feedback?'disabled':''}>표현 도움 보기</button><p class="life-hint" ${helped?'':'hidden'}>${escape(q.explanation)}</p></section><section class="life-answer-area" aria-label="답 고르기"><div class="life-choices">${choiceButtons}</div>${feedback?`<div class="life-feedback" role="status"><strong>${feedback.correct&&!feedback.helped?'잘 골랐어요.':'함께 확인해요.'}</strong><p>${escape(q.explanation)}</p>${!feedback.correct||feedback.helped?'<small>이 표현은 잠시 뒤 새 상황에서 다시 만나요.</small>'+retryButton(q):''}</div>`:''}</section></div><div class="life-actions"><button class="felt-button" data-life-question-next ${feedback?'':'disabled'}>${feedback?'다음으로':'답을 골라 주세요'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>진도 저장하고 쉬기</button></div>`;
 }
 function choose(choiceId){if(lastFeedback)return;
  const p=getProgress(),l=lessonById(context.lessonId),q=l.questions[context.questionIndex];
  const correct=choiceId===q.answerId;p.recordAnswer({lessonId:l.id,questionId:q.id,choiceId,correct,helped});lastFeedback={question:q,choiceId,correct,helped};renderQuestion();
 }
 function finish(){
  const p=getProgress(),l=lessonById(context.lessonId);p.finishLesson(l.id);const s=summary(),done=p.lessonState(l.id),right=Object.values(done.answers).filter(a=>a.correct&&!a.helped).length;
  context.phase='complete';
  const pack=packById(l.packId),packDone=s.packs.find(x=>x.id===pack.id),nextLesson=s.nextLesson;
  paint('작은 한 걸음이 쌓였어요',`<div class="life-complete life-heading" tabindex="-1"><div class="life-cast">${Object.keys(friends).map(f=>photo(f)).join('')}</div><h3>${escape(l.title)}</h3><p>${escape(pack.title)} · ${packDone.completed} / ${packDone.total} 단계 완료</p><p class="life-complete-score">처음에 도움 없이 고른 답 ${right} / ${l.questions.length}</p>${packDone.completed===packDone.total?'<p class="life-pack-stamp">이 생활 팩을 수집첩에 완성했어요.</p>':''}<p>배운 표현은 복습 일정에 남겨 두었어요.</p></div><div class="life-actions"><button class="felt-button" ${nextLesson?`data-life-lesson="${nextLesson.id}"`:'data-life-packs'}>${nextLesson?`${phaseNames[nextLesson.type]}로 이어가기`:'생활 팩 모두 보기'} <span aria-hidden="true">→</span></button><button class="plain-button" data-life-review>복습 일정 보기</button><button class="quiet-button" data-life-home>마루로 돌아가기</button></div>`,{type:'life-complete'});
  const ticket=generation;p.flush().catch(()=>{if(shown&&ticket===generation)home.toast('진도 저장을 기다리고 있어요. 복습 일정은 화면에 남겨 두었어요.');});
 }
 function review(){if(!ensureReadable())return;place='life';context=null;lastFeedback=null;helped=false;reviewRun=null;const s=summary(),future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'';
  paint('오늘 돌아온 표현',`<div class="life-review-summary life-heading" tabindex="-1">${photo('kkamong','life-intro-friend')}<h3>${s.dueCount?`${s.dueCount}개의 표현이 기다려요.`:future?'배운 표현이 잘 쉬고 있어요.':'첫 표현을 만나러 갈까요?'}</h3><p>${s.dueCount?'같은 답을 외우는 대신, 새로운 생활 장면에서 골라요.':future?`다음 복습은 ${escape(future)}부터 열려요.`:'생활 팩을 마치면 나에게 필요한 복습이 생겨요.'}</p></div>${s.dueCount?`<div class="life-review-topics">${s.dueReviews.map(r=>`<span>${escape(packById(r.packId)?.title||'생활 한국어')}</span>`).join('')}</div>`:''}<div class="life-actions">${s.dueCount?'<button class="felt-button" data-life-review-start>돌아온 표현 연습하기 <span aria-hidden="true">→</span></button>':''}<button class="plain-button" data-life-next>다음 학습 이어 하기</button><button class="quiet-button" data-life-home>마루로 돌아가기</button></div>`,{type:'life-review'});
 }
 function reviewStart(){const p=getProgress();reviewRun=p.startReview(6);if(!reviewRun)return review();for(const id of reviewRun.ids)if(exposedTransfers.has(id)&&!reviewRun.answers[id])p.markReviewHelp(id);lastFeedback=null;helped=false;renderReview();}
 function renderReview(){
  const run=getProgress().exportSnapshot().activeReview;if(!run)return review();reviewRun=run;
  const index=run.ids.findIndex(id=>!run.answers[id]);
  if(index<0){const s=summary();paint('오늘의 복습을 마쳤어요',`<div class="life-complete life-heading" tabindex="-1">${photo('mongle','life-intro-friend')}<h3>${run.ids.length}개 표현을 다시 만났어요.</h3><p>잘 익힌 표현은 더 긴 간격으로,<br>어려운 표현은 잠시 뒤 다시 돌아와요.</p></div><div class="life-actions"><button class="felt-button" data-life-next>다음 학습 이어 하기 <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-home>마루로 돌아가기</button></div>`,{type:'life-review-complete'});return;}
  const id=run.ids[index],record=getProgress().exportSnapshot().reviews[id],l=lessonById(record.lessonId),original=l.questions.find(q=>q.id===record.questionId),q=original.review;if(!lastFeedback)helped=run.pendingHelp?.[id]===true;
  context={lessonId:l.id,phase:'review',questionIndex:index,reviewId:id,reviewQuestion:q};
  paint('다른 장면에서 다시 만나요',`<div class="life-session-meta" data-life-review-id="${escape(id)}" data-life-phase="review" data-life-step="${index}"><span>${escape(packById(record.packId).title)}</span><span>${index+1} / ${run.ids.length}</span></div>${questionMarkup(q,lastFeedback,{reviewIndex:index,reviewTotal:run.ids.length})}`,{type:'life-question',focus:'.life-question-title'});
 }
 function chooseReview(id){if(lastFeedback)return;const q=context.reviewQuestion,p=getProgress();p.answerReview({id:context.reviewId,runId:reviewRun.id,correct:id===q.answerId,helped});helped=p.exportSnapshot().activeReview.answers[context.reviewId].helped;lastFeedback={question:q,choiceId:id,correct:id===q.answerId,helped};
  // Keep this question on screen for feedback before moving the review cursor.
  const html=questionMarkup(q,lastFeedback,{reviewIndex:context.questionIndex,reviewTotal:reviewRun.ids.length});
  paint('다른 장면에서 다시 만나요',`<div class="life-session-meta" data-life-review-id="${context.reviewId}" data-life-phase="review" data-life-step="${context.questionIndex}"><span>표현 복습</span><span>${context.questionIndex+1} / ${reviewRun.ids.length}</span></div>${html}`,{type:'life-question',focus:'.life-question-title'});
 }
 function pause(){if(context?.phase==='cafe')persistCafe();else if(context&&['intro','story','questions'].includes(context.phase))persistStage();home.closePanel();updateHome();home.toast('하던 자리와 복습 일정을 남겼어요.');}
 const handlers={
  packs,stories,review,next,home:()=>{home.closePanel();updateHome();},pack:el=>pack(el.dataset.lifePack),lesson:el=>start(el.dataset.lifeLesson),
  begin:()=>{context.phase='story';context.sceneIndex=0;persistStage();renderLesson();},
  'scene-next':()=>{context.sceneIndex++;if(context.sceneIndex>=lessonById(context.lessonId).scenes.length)context.phase='questions';persistStage();renderLesson();},
  choice:el=>context.phase==='review'?chooseReview(el.dataset.lifeChoice):choose(el.dataset.lifeChoice),
  'question-next':()=>{if(context.phase==='review'){lastFeedback=null;helped=false;renderReview();}else{context.questionIndex++;lastFeedback=null;helped=false;persistStage();renderLesson();}},
  'review-start':reviewStart,pause,
  'cafe-choice':el=>cafeChoose(el.dataset.lifeCafeChoice),'cafe-next':cafeNext,
  'cafe-word':el=>{const field=el.dataset.lifeCafeWord,value=field==='count'?Number(el.dataset.cafeValue):el.dataset.cafeValue;cafeRun=updateCafeOrder(cafeRun,field,value);persistCafe();renderCafe();content.querySelector(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`)?.focus({preventScroll:true});},
  'cafe-submit':cafeSubmit,'cafe-speech':()=>{void cafeSpeech().catch(error=>home.toast(error.message));},
  'cafe-mode':el=>{if(cafeRun.phase!=='welcome')return;cafeRun={...cafeRun,listen:{mode:el.dataset.lifeCafeMode,heard:false,textShown:false}};persistCafe();renderCafe();},
  'cafe-transcript':()=>{cafeRun={...cafeRun,listen:{...cafeRun.listen,textShown:true}};helped=true;persistCafe();renderCafe();content.querySelector('[data-life-cafe-transcript]')?.focus({preventScroll:true});},
  'cafe-seat':el=>{const next=chooseCafeSeat(cafeRun,el.dataset.lifeCafeSeat,context.lessonId);getProgress().setStage(context.lessonId,cafeStage(next));cafeRun=next;renderCafe();},
  'cafe-help':()=>{helped=true;persistCafe();renderCafe();content.querySelector('[data-life-cafe-help]')?.focus({preventScroll:true});},
  help:tutorHint,'tutor-retry':el=>companion?.openPractice(el.dataset.lifeTutorRetry)
 };
 function click(event){const button=event.target.closest('button');if(!button||!panel.open||!shown)return;
  const entry=Object.entries(handlers).find(([key])=>button.hasAttribute('data-life-'+key));if(!entry)return;
  event.preventDefault();event.stopPropagation();try{entry[1](button);}catch(error){home.toast(error.message||'진도를 확인한 뒤 다시 시작해 주세요.');}
 }
 document.addEventListener('click',click);
 timer=setInterval(updateHome,15000);updateHome();
 return {packs,stories,review,next,pack,start,cafe:()=>pack('cafe'),summary,refresh:updateHome,metrics:()=>({shown,lessonId:context?.lessonId||null,phase:context?.phase||null,step:context?.questionIndex??null,cafe:isCafeLesson(context?.lessonId)?cafeRun:null,speech:speech.metrics(),tutor:companion?.metrics()||null,owner:getProgress().owner,progress:getProgress().exportSnapshot()}),dispose(){ended=true;speech.dispose();clearInterval(timer);document.removeEventListener('click',click);if(shown)home.closePanel();}};
}
