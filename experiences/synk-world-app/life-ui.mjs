import {PACKS,LESSONS,lessonById,packById} from './life-content.mjs';
import {CAFE_LESSON_ID,CAFE_COMPOSE_ID,CAFE_LESSON_IDS,CAFE_VISITS,isCafeLesson,resumeCafe,chooseCafe,advanceCafe,chooseCafeSeat,cafeQuestion,updateCafeOrder,submitCafeOrder} from './cafe-activity.mjs';
import {cafeMarkup,cafeCompletionMarkup,createCafeSpeech} from './cafe-ui.mjs';
if(!document.querySelector('[data-life-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./life-ui.css',import.meta.url).href;style.dataset.lifeStyle='true';document.head.append(style);}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const friends={mongle:{name:'몽글',file:'friend-mongle.webp'},kkamong:{name:'까몽',file:'friend-kkamong.webp'},marine:{name:'마린',file:'friend-marine.webp'}};
const phaseNames={expressions:'표현 만나기',story:'세 친구 이야기',apply:'생활에서 써 보기',visit:'다음 카페 이야기',compose:'내 주문 만들기'};
const dayLabel=at=>Number.isFinite(at)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at)):'';
// 배우기 허브 포스터: 팩마다 그 팩을 설명하는 펠트 사진 한 장과 짧은 한 낱말(시그널 게임판, 2026-10-14).
const packWords={greetings:['인사','GREETINGS'],cafe:['카페','CAFE'],store:['편의점','STORE'],directions:['길 찾기','DIRECTIONS'],transit:['버스','TRANSIT'],plans:['약속','PLANS']};
const pad=value=>String(value).padStart(2,'0');
const percent=(done,total)=>total?Math.round(Math.max(0,Math.min(1,done/total))*100):0;
const progressLine=(done,total)=>`<span class="life-progress" aria-hidden="true"><i style="width:${percent(done,total)}%"></i></span>`;
const meter=(done,total,label=`${done} / ${total}`)=>`<span class="life-meter" aria-hidden="true"><span><i style="width:${percent(done,total)}%"></i></span><b>${label}</b></span>`;
export function createLifeExperience({home,getProgress,show=(title,html,options)=>home.showPanel(title,html,options),asset,onSummary=()=>{},onNext=null}){
 const panel=document.querySelector('#world-panel'),content=document.querySelector('#panel-content');
 for(const [variable,file]of Object.entries({'--cafe-room':'home/cafe-room-v1.webp','--cafe-drinks':'home/cafe-drinks-v2.png','--cafe-ice':'home/cafe-ice.webp','--life-print-goals':'world-felt/goals.webp'}))panel.style.setProperty(variable,`url("${asset(file)}")`);
 // 흰 인화지에 붙인 펠트 사진(assets/world-felt). 한 화면에 같은 사진은 한 번만 쓴다.
 const print=(name,className='')=>`<span class="w-print ${className}" aria-hidden="true"><img src="${asset('world-felt/'+name+'.webp')}" alt="" width="640" height="640" decoding="async"></span>`;
 let context=null,shown=false,rendering=false,ended=false,reviewRun=null,lastFeedback=null,helped=false,generation=0,timer,cafeRun=null,cafeView='',companion=null,place='life';
 const practised=new Set();
 const exposedTransfers=new Set();
 const speech=createCafeSpeech({asset,onChange(){if(ended||!shown||context?.phase!=='cafe')return;const metrics=speech.metrics(),button=content.querySelector('[data-life-cafe-speech]'),status=content.querySelector('.cafe-speech-status');if(button){button.textContent=!metrics.available?'질문 소리 다시 준비하기':metrics.phase==='playing'?'질문 듣기 잠깐 멈추기':metrics.phase==='paused'?'질문 이어 듣기':cafeRun.listen?.heard?'직원 질문 다시 듣기':'직원 질문 듣기';button.dataset.phase=!metrics.available?'unavailable':metrics.phase;}if(status&&metrics.phase==='error')status.textContent='소리를 재생하지 못했어요. 다시 듣기를 눌러 주세요.';companion?.update(tutorState());}});
 void speech.prepare();
 const summary=()=>getProgress().summary(PACKS,LESSONS);
 const preferences=()=>{try{return getProgress().learningProfileValues?.()||{};}catch{return {};}};
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
 function paint(title,html,{type='life-library',focus='.life-heading',eyebrow='LIFE IN KOREA',keepScroll=false}={}){
  // 집중 판은 내용 영역이 스크롤된다. 같은 장면을 다시 그릴 때(낱말 고르기 등)만 자리를 지키고, 새 장면은 맨 위에서 시작한다.
  const scroll=keepScroll&&shown?content.scrollTop:0;
  generation++;rendering=true;show(title,html+statusLine(),{type,eyebrow,nav:'play'});
  const tutor=home.mountLifeTutor?.({state:tutorState(),snapshot:getProgress().exportSnapshot(),lessons:LESSONS,practised:[...practised],onHint:tutorHint,onPause:()=>speech.pause(),onPreparePractice:prepareTutorPractice,onPracticeSuccess:id=>completeTutorPractice(id,home.tutor?.().tutor),onPracticeComplete:id=>{practised.add(id);companion?.update({...tutorState(),practiceCompleted:true});}});
  companion=tutor;
  home.attachPanelResource({dispose(){tutor?.dispose();if(companion===tutor)companion=null;if(!rendering){speech.stop();shown=false;generation++;try{void getProgress().flush().catch(()=>{});}catch{}context=null;reviewRun=null;lastFeedback=null;}}});
  rendering=false;shown=true;content.scrollTop=scroll;content.dataset.reduced=String(!!home.state?.reduced);content.querySelector(focus)?.focus({preventScroll:true});updateHome();
 }
 // 답을 고른 뒤에는 판정 띠가 보이도록 내용 영역만 살짝 내린다. 단, 고른 답과 맞는 답이 있는 선택지 맨 위는 가리지 않는다.
 function revealFeedback(){
  const feedback=content.querySelector('.life-feedback'),choices=content.querySelector('.life-choices');if(!feedback)return;
  const view=content.getBoundingClientRect(),style=getComputedStyle(content),padTop=parseFloat(style.scrollPaddingTop)||0,padBottom=parseFloat(style.scrollPaddingBottom)||0;
  const need=feedback.getBoundingClientRect().bottom-(view.bottom-padBottom);if(need<=0)return;
  const room=choices?choices.getBoundingClientRect().top-(view.top+padTop):need;
  content.scrollTop+=Math.max(0,Math.min(need,room));
 }
 function ensureReadable(){const s=getProgress().status();if(s.phase!=='unreadable')return true;paint('진도를 확인해 주세요',`<p class="panel-description">${escape(s.message)}</p><p class="dialog-note">기존 기록은 유지하고 있어요. 나의 공간에서 연결 상태를 확인해 주세요.</p>`);return false;}
 const stateOf=id=>{const status=getProgress().lessonState(id).status;return status==='completed'?'completed':status==='started'?'started':'new';};
 const packDone=pack=>pack.lessons.filter(l=>getProgress().lessonState(l.id).status==='completed').length;
 // 허브의 팩 포스터: 코랄 면 + 팩 사진 + 큰 한 낱말 + 1px 진행 막대.
 function packPoster(pack,index,current=null){
  const done=packDone(pack),total=pack.lessons.length,started=pack.lessons.some(l=>stateOf(l.id)==='started'),[word,label]=packWords[pack.id]||[pack.title,pack.id.toUpperCase()];
  const state=done===total?'done':done||started?'active':'new';
  return `<button class="life-pack-card" data-life-pack="${pack.id}" data-state="${state}"${pack.id===current?' data-current="true"':''} aria-label="${escape(`${pack.title} · ${pack.subtitle} · ${done} / ${total} 단계${state==='done'?' 완료':''}`)}">${print(pack.id,'life-pack-print')}${pack.id===current?'<span class="life-pack-now" aria-hidden="true"><i class="w-led ok"></i>지금</span>':''}<span class="life-pack-copy"><small class="life-poster-label">${pad(index+1)} · ${label}</small><strong class="life-pack-word" style="--len:${[...word].length}">${escape(word)}</strong><span class="life-pack-title">${escape(pack.title)}</span></span>${meter(done,total)}</button>`;
 }
 // 「지금 할 일」: 하던 레슨 → 돌아온 복습 → 다음 레슨 순서. 단추는 흰 알약 하나.
 function nowPoster(s){
  const lesson=s.nextLesson;
  if(lesson&&(s.resume||!s.dueCount)){
   const pack=packById(lesson.packId),index=Math.max(0,pack.lessons.findIndex(l=>l.id===lesson.id)),total=pack.lessons.length,started=s.resume||stateOf(lesson.id)==='started';
   return {kind:'lesson',html:`<section class="life-poster life-now" aria-label="지금 할 일">${print(pack.id)}<small class="life-poster-label">${started?'CONTINUE':'UP NEXT'}</small><strong class="life-poster-word">${escape(lesson.title)}</strong><span class="life-poster-sub">${escape(pack.title)} · ${phaseNames[lesson.type]}</span>${meter(index,total,`${pad(index+1)} / ${pad(total)}`)}<button class="felt-button" data-life-lesson="${lesson.id}">${started?'이어서 하기':'시작하기'} <span aria-hidden="true">→</span></button></section>`};
  }
  if(s.dueCount)return {kind:'review',html:`<section class="life-poster life-now" aria-label="지금 할 일">${print('review')}<small class="life-poster-label">REVIEW · ${pad(s.dueCount)}</small><strong class="life-poster-word">돌아온 표현</strong><span class="life-poster-sub">${s.dueCount}개의 표현이 새 장면에서 기다려요.</span><button class="felt-button" data-life-review>돌아온 표현 만나기 <span aria-hidden="true">→</span></button></section>`};
  const future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'';
  return {kind:'rest',html:`<section class="life-poster life-now" aria-label="지금 할 일">${print('complete')}<small class="life-poster-label">ALL PACKS · ${s.completed} / ${s.total}</small><strong class="life-poster-word">모두 마쳤어요</strong><span class="life-poster-sub">${future?`다음 복습은 ${escape(future)}부터 열려요.`:'마음에 드는 팩을 골라 다시 연습해요.'}</span><button class="felt-button" data-life-review>복습 일정 보기 <span aria-hidden="true">→</span></button></section>`};
 }
 function reviewRow(s){
  const future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'';
  return `<button class="life-row" data-life-review>${print('review','life-row-print')}<span class="life-row-copy"><strong>나의 복습</strong><small>${s.dueCount?`${s.dueCount}개의 표현이 기다려요.`:future?`다음 복습 ${escape(future)}`:'생활 팩을 마치면 복습이 생겨요.'}</small></span>${s.dueCount?`<span class="life-row-state"><i class="w-led check"></i>${s.dueCount}개</span>`:''}</button>`;
 }
 function packs(){if(!ensureReadable())return;place='life';context=null;const s=summary(),now=nowPoster(s);
  paint('작은 말로 시작하는 한국 생활',`<div class="life-hub"><div class="life-heading" tabindex="-1"><p>인사부터 약속까지, 친구들과 한 팩씩.</p></div>${now.html}<section class="life-pack-section" aria-label="생활 팩"><div class="life-section-head"><p class="life-section-label">LIFE PACKS</p><small class="life-library-note">${PACKS.length}개 생활 팩 · ${LESSONS.length}개 짧은 학습</small></div><div class="life-pack-grid">${PACKS.map((p,i)=>packPoster(p,i,now.kind==='lesson'?s.nextLesson?.packId:null)).join('')}</div></section><section class="life-rows" aria-label="더 둘러보기"><p class="life-section-label">MORE</p><button class="life-row" data-life-stories>${print('stories','life-row-print')}<span class="life-row-copy"><strong>세 친구 이야기</strong><small>까몽·몽글·마린의 작은 하루</small></span></button>${now.kind==='lesson'?reviewRow(s):''}</section></div>`);}
 // 목록 줄: 번호(또는 사진) → 단계 이름·제목·목표 → 상태. 「지금」 줄만 코랄 표시.
 function lessonRow(l,number,{nowId=null,className='',lead=null,kicker=phaseNames[l.type],labels=['완료 · 다시 하기','이어서 하기','시작']}={}){
  const state=stateOf(l.id);
  return `<button data-life-lesson="${l.id}" class="life-lesson-card ${className}" data-state="${state}"${l.id===nowId?' data-now':''}>${lead??`<span class="life-step-number">${pad(number)}</span>`}<span><small>${escape(kicker)}</small><strong>${escape(l.title)}</strong><span>${escape(l.goal)}</span></span><em>${state==='completed'?labels[0]:state==='started'?labels[1]:labels[2]}</em></button>`;
 }
 const nowIn=lessons=>(lessons.find(l=>stateOf(l.id)==='started')||lessons.find(l=>stateOf(l.id)!=='completed'))?.id||null;
 function cafeVisitCards(nowId=null){return CAFE_VISITS.map(visit=>{const state=stateOf(visit.id);return `<button data-life-lesson="${visit.id}" class="life-lesson-card cafe-visit-card" data-state="${state}"${visit.id===nowId?' data-now':''}><span class="life-step-number">${pad(visit.number)}</span><span><small>${visit.number}번째 카페 방문</small><strong>${escape(visit.title)}</strong><span>${escape(visit.description)}</span></span><em>${state==='completed'?'다녀왔어요 · 다시 보기':state==='started'?'이어서 하기':'들르기'}</em></button>`;}).join('');}
 function stories(){if(!ensureReadable())return;place='life';context=null;
  const episodes=PACKS.map(p=>({pack:p,episode:p.lessons.find(l=>l.type==='story')})).filter(e=>e.episode);
  paint('까몽·몽글·마린의 작은 하루',`<div class="life-heading" tabindex="-1"><section class="life-poster life-stories-poster">${print('stories')}<small class="life-poster-label">STORIES · ${pad(episodes.length)}</small><strong class="life-poster-word">세 친구 이야기</strong><span class="life-poster-sub">주문하고, 길을 찾고, 약속을 지켜요. 세 친구와 읽고 고르는 생활 이야기.</span></section></div><section class="life-list" aria-label="세 친구 이야기"><p class="life-section-label">EPISODES</p><div class="life-lesson-list">${episodes.map(({pack,episode})=>lessonRow(episode,0,{className:'life-story-card',lead:print(pack.id,'life-row-print'),kicker:pack.title,labels:['읽은 이야기 · 다시 보기','함께 읽고 골라요','함께 읽고 골라요']})).join('')}</div></section><section class="life-list" aria-label="카페 이야기"><p class="life-section-label">CAFE VISITS</p><h3 class="cafe-library-title">내가 함께 만드는 카페 이야기</h3><div class="life-lesson-list">${cafeVisitCards()}</div></section>`);}
 function pack(id){if(!ensureReadable())return;const value=packById(id);if(!value)return;place=id==='cafe'?'cafe':'life';context=null;
  const p=getProgress(),activeId=p.exportSnapshot().activeLessonId,nextVisit=CAFE_VISITS.find(v=>v.id===activeId)||CAFE_VISITS.find(v=>p.lessonState(v.id).status==='started')||CAFE_VISITS.find(v=>p.lessonState(v.id).status!=='completed')||CAFE_VISITS[0],visited=CAFE_VISITS.filter(v=>p.lessonState(v.id).status==='completed').length;
  const lessons=value.lessons.filter(l=>id!=='cafe'||!isCafeLesson(l.id)),index=PACKS.findIndex(p=>p.id===id),[word,label]=packWords[id]||[value.title,id.toUpperCase()],done=packDone(value);
  const cafe=id==='cafe'?`<section class="cafe-pack-preview"><img src="${asset('home/cafe-room-v1.webp')}" alt="햇살이 드는 동네 카페" width="1600" height="900"><div><small>우리의 카페 · ${visited} / ${CAFE_VISITS.length}번의 작은 하루</small><h3>${escape(nextVisit.title)}</h3><p>${escape(nextVisit.description)}</p><button class="felt-button" data-life-lesson="${nextVisit.id}">${p.lessonState(nextVisit.id).status==='started'?'카페에서 이어서 하기':nextVisit.number===1?'카페에 들어가기':'다음 카페 이야기'} <span aria-hidden="true">→</span></button></div></section><section class="life-list" aria-label="카페 방문"><div class="life-section-head"><p class="life-section-label">VISITS</p><small class="life-library-note">${visited} / ${CAFE_VISITS.length}번 다녀왔어요</small></div><h3 class="cafe-library-title">다시 올 때마다 다른 하루</h3><div class="life-lesson-list cafe-visit-list">${cafeVisitCards(nextVisit.id)}</div></section>`:'';
  const heading=id==='cafe'?`<div class="life-heading life-pack-head" tabindex="-1"><p class="life-section-label">LESSONS</p><p class="life-pack-description">${escape(value.subtitle)}</p><p class="life-library-note">${escape(value.level)} · 주문 전에 표현과 이야기도 만나 보세요.</p></div>`
   :`<div class="life-heading life-pack-head" tabindex="-1"><section class="life-poster life-pack-poster">${print(id)}<small class="life-poster-label">${pad(index+1)} · ${label}</small><strong class="life-poster-word" style="--len:${[...word].length}">${escape(word)}</strong><span class="life-poster-sub life-pack-description">${escape(value.subtitle)}</span>${meter(done,value.lessons.length)}</section><p class="life-library-note">${escape(value.level)} · 표현 → 이야기 → 생활 적용</p></div>`;
  const nowId=id==='cafe'?null:nowIn(lessons);
  paint(value.title,`${cafe}${heading}<div class="life-lesson-list">${lessons.map((l,i)=>lessonRow(l,i+1,{nowId})).join('')}</div><div class="life-library-footer"><button class="quiet-button" data-life-packs>전체 생활 팩</button><button class="quiet-button" data-life-review>복습 일정 보기</button></div>`);}
 function next(){if(!ensureReadable())return;if(onNext)return onNext();const s=summary();if(s.nextLesson)return start(s.nextLesson.id);if(s.dueCount)return review();packs();}
 function start(id){if(!ensureReadable())return;const lesson=lessonById(id);if(!lesson)return;place=lesson.packId==='cafe'?'cafe':'life';
  speech.stop();
  const p=getProgress();p.summary(PACKS,LESSONS);const previous=p.lessonState(id),state=p.startLesson(lesson,{replay:previous.status==='completed'&&previous.cursor===previous.total});
  context={lessonId:id,phase:state.stage.phase,sceneIndex:state.stage.sceneIndex,questionIndex:state.cursor};reviewRun=null;lastFeedback=null;helped=state.stage.helped===true;
  cafeRun=null;cafeView='';
  if(isCafeLesson(id)){cafeRun=resumeCafe(state,id);if(!cafeRun.listen)cafeRun={...cafeRun,listen:{mode:preferences().audio!=='off'&&cafeRun.phase==='welcome'&&speech.available()?'listen':'read',heard:false,textShown:false}};if(preferences().audio==='off')cafeRun={...cafeRun,listen:{...cafeRun.listen,mode:'read'}};context.phase='cafe';if(cafeRun.phase==='complete')return finishCafe();persistCafe();return renderCafe();}
  if(state.cursor>=lesson.questions.length)return finish();
  if(state.cursor>0)context.phase='questions';
  renderLesson();
 }
 function cafeStage(value=cafeRun){return {phase:'questions',sceneIndex:value.step,questionIndex:value.step,helped,cafe:value};}
 function persistCafe(){getProgress().setStage(context.lessonId,cafeStage());}
 function renderCafe(){
  context.phase='cafe';context.questionIndex=cafeRun.step;
  const q=cafeQuestion(cafeRun.step,context.lessonId),first=q?getProgress().lessonState(context.lessonId).answers[q.id]:null;
  if(!first&&!helped&&preferences().support==='step'&&['choose','repair','response'].includes(cafeRun.phase)){
   helped=true;if(cafeRun.listen?.mode==='listen')cafeRun={...cafeRun,listen:{...cafeRun.listen,textShown:true}};persistCafe();
  }
  // 같은 단계에서 낱말·자리·도움을 고를 때는 보던 자리를 지킨다.
  const view=`${context.lessonId}:${cafeRun.step}:${['welcome','break'].includes(cafeRun.phase)?cafeRun.phase:'talk'}`,keepScroll=view===cafeView;cafeView=view;
  paint('구름 한 잔, 카페',cafeMarkup(cafeRun,{photo,print,helped,firstAnswer:first,retryButton,lessonId:context.lessonId,speechAvailable:speech.available(),speechPhase:speech.metrics().phase}),{type:'life-cafe',focus:'.cafe-focus',eyebrow:'LIFE IN KOREA · CAFE',keepScroll});
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
  cafeView='';
  paint('오늘의 카페, 잘 다녀왔어요',cafeCompletionMarkup({photo,print,nextLesson,lessonId:context.lessonId,state:cafeRun,adaptive:!!onNext}),{type:'life-cafe-complete',focus:'.cafe-focus',eyebrow:'LIFE IN KOREA · CAFE'});
  const ticket=generation;p.flush().catch(()=>{if(shown&&ticket===generation)home.toast('카페 기록을 저장하고 있어요. 화면의 진행은 유지돼요.');});
 }
 function persistStage(){const p=getProgress();if(context)p.setStage(context.lessonId,{phase:context.phase,sceneIndex:context.sceneIndex,questionIndex:context.questionIndex,helped});}
 // 집중 판 맨 위: 진행 막대(장면 + 문제를 한 줄로) · 팩과 단계 · 「2 / 9」.
 function lessonHeader(l){
  const pack=packById(l.packId),scenes=l.scenes.length,questions=l.questions.length,phase=context.phase;
  const done=phase==='story'?context.sceneIndex+1:phase==='questions'?scenes+Math.min(context.questionIndex+(lastFeedback?1:0),questions):0;
  const count=phase==='questions'?`${Math.min(context.questionIndex+1,questions)} / ${questions}`:phase==='story'?`${Math.min(context.sceneIndex+1,scenes)} / ${scenes}`:'';
  return `<div class="life-session-meta" data-life-session="${escape(getProgress().lessonState(l.id).attemptId)}" data-life-lesson-id="${l.id}" data-life-phase="${phase}" data-life-step="${context.questionIndex}">${progressLine(done,scenes+questions)}<span>${escape(pack.title)} · ${phaseNames[l.type]}</span><span>${count?`<b class="life-count">${count}</b>`:'친구와 준비하기'}</span></div>`;
 }
 const expressionList=(l,label='EXPRESSIONS')=>`<section class="life-expression-list" aria-label="${label==='EXPRESSIONS'?'오늘 만날 표현':'이번에 만난 표현'}"><p class="life-section-label">${label}</p>${l.expressions.map((e,i)=>`<article><span class="life-expression-index" aria-hidden="true">${pad(i+1)}</span><div><strong>${escape(e.korean)}</strong><p>${escape(e.meaning)}</p></div></article>`).join('')}</section>`;
 function renderLesson(){
  if(!context)return;const l=lessonById(context.lessonId);if(!l)return;const header=lessonHeader(l);
  if(context.phase==='intro'){
   paint(l.title,`${header}<div class="life-intro"><div class="life-heading" tabindex="-1"><small class="life-kicker">읽고 고르는 기초 생활 한국어</small><p class="life-goal">${escape(l.goal)}</p></div>${expressionList(l)}</div><div class="life-actions"><button class="felt-button" data-life-begin>${l.type==='story'?'이야기 읽기':'친구와 시작하기'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>마루에서 잠깐 쉬기</button></div>`,{type:'life-lesson'});return;
  }
  if(context.phase==='story'){
   const scene=l.scenes[context.sceneIndex];if(!scene){context.phase='questions';persistStage();renderLesson();return;}
   const friend=friends[scene.speaker],speaker=friend?scene.speaker:'narrator';
   // 세 친구는 그대로 무대에 두고, 말하는 친구만 밝게. 대사는 그 친구를 가리키는 흰 말풍선.
   paint(l.title,`${header}<div class="life-story-stage" data-speaker="${speaker}"><div class="life-cast">${Object.keys(friends).map(f=>`<div class="${f===scene.speaker?'is-speaking':''}">${photo(f)}<small>${friends[f].name}</small></div>`).join('')}</div><div class="life-dialogue life-heading" tabindex="-1" data-speaker="${speaker}"><small>${friend?friend.name:'이야기'}</small><p>${escape(scene.text)}</p></div></div><div class="life-actions"><button class="felt-button" data-life-scene-next>${context.sceneIndex+1===l.scenes.length?'이제 내가 골라 볼게요':'다음 장면'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>이야기 저장하고 쉬기</button></div>`,{type:'life-story'});return;
  }
  renderQuestion();
 }
 function renderQuestion(){
  const l=lessonById(context.lessonId),q=l.questions[context.questionIndex];if(!q)return finish();
  const previous=getProgress().lessonState(l.id).answers[q.id];
  if(previous&&!lastFeedback)lastFeedback={correct:previous.correct,choiceId:previous.choiceId,question:q,helped:previous.helped};
  if(!lastFeedback&&!helped&&preferences().support==='step'){helped=true;persistStage();}
  paint(l.title,`${lessonHeader(l)}${questionMarkup(q,lastFeedback,{lesson:l})}`,{type:'life-question',focus:'.life-question-title'});
  if(lastFeedback)revealFeedback();
 }
 function questionMarkup(q,feedback,{lesson=null,reviewIndex=0,reviewTotal=0}={}){
  const choiceButtons=q.choices.map(c=>`<button class="life-choice ${feedback&&c.id===feedback.choiceId?'is-chosen':''} ${feedback&&c.id===q.answerId?'is-correct':''}" data-life-choice="${c.id}" ${feedback?'disabled':''}><span>${escape(c.text)}</span></button>`).join('');
  // 판정은 어두운 띠 하나: LED(맞음 메도우 · 도움 버터 · 다시 코랄) + 짧은 제목 + 이유.
  const result=feedback?feedback.correct&&!feedback.helped?'ok':feedback.correct?'assisted':'retry':'';
  return `<div class="life-question-layout"><section class="life-question-copy"><div class="life-question-title" tabindex="-1"><small>${lesson?'읽고 상황에 맞게 골라요':`다른 장면에서 다시 만나요 · ${reviewIndex+1} / ${reviewTotal}`}</small><h3>${escape(q.prompt)}</h3></div><p class="life-context">${escape(q.context||'')}</p><button class="quiet-button life-help" data-life-help ${feedback?'disabled':''}>표현 도움 보기</button><p class="life-hint" ${helped?'':'hidden'}>${escape(q.explanation)}</p></section><section class="life-answer-area" aria-label="답 고르기"><div class="life-choices">${choiceButtons}</div>${feedback?`<div class="life-feedback" role="status" data-result="${result}"><strong>${feedback.correct&&!feedback.helped?'잘 골랐어요.':'함께 확인해요.'}</strong><details class="life-explanation" ${preferences().explanation==='brief'?'':'open'}><summary>이유 더 보기</summary><p>${escape(q.explanation)}</p></details>${!feedback.correct||feedback.helped?'<small>이 표현은 잠시 뒤 새 상황에서 다시 만나요.</small>'+retryButton(q):''}</div>`:''}</section></div><div class="life-actions"><button class="felt-button" data-life-question-next ${feedback?'':'disabled'}>${feedback?'다음으로':'답을 골라 주세요'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>진도 저장하고 쉬기</button></div>`;
 }
 function choose(choiceId){if(lastFeedback)return;
  const p=getProgress(),l=lessonById(context.lessonId),q=l.questions[context.questionIndex];
  const correct=choiceId===q.answerId;p.recordAnswer({lessonId:l.id,questionId:q.id,choiceId,correct,helped});lastFeedback={question:q,choiceId,correct,helped};renderQuestion();
 }
 function finish(){
  const p=getProgress(),l=lessonById(context.lessonId);p.finishLesson(l.id);const s=summary(),done=p.lessonState(l.id),right=Object.values(done.answers).filter(a=>a.correct&&!a.helped).length;
  context.phase='complete';
  const pack=packById(l.packId),packDone=s.packs.find(x=>x.id===pack.id),nextLesson=s.nextLesson;
  // 완료는 포스터 한 장(도장 카드 사진 + 큰 한글) → 만난 표현 → 흰 알약 하나(마루로).
  paint('작은 한 걸음이 쌓였어요',`<div class="life-complete life-heading" tabindex="-1"><section class="life-poster life-complete-poster">${print('complete')}<small class="life-poster-label">LESSON COMPLETE</small><strong class="life-poster-word" aria-hidden="true">작은 한 걸음이 쌓였어요</strong><span class="life-poster-sub">${escape(pack.title)} · ${packDone.completed} / ${packDone.total} 단계 완료</span></section><div class="life-complete-copy"><h3>${escape(l.title)}</h3><p class="life-complete-score">처음에 도움 없이 고른 답 <b>${right} / ${l.questions.length}</b></p>${packDone.completed===packDone.total?'<p class="life-pack-stamp">이 생활 팩을 수집첩에 완성했어요.</p>':''}</div>${expressionList(l,'LEARNED')}<p class="life-complete-note">배운 표현은 복습 일정에 남겨 두었어요.</p></div><div class="life-actions"><button class="felt-button" data-life-home>마루로 돌아가기 <span aria-hidden="true">→</span></button><button class="plain-button" ${onNext?'data-life-next':nextLesson?`data-life-lesson="${nextLesson.id}"`:'data-life-packs'}>${onNext?'나에게 맞는 다음 연습':nextLesson?`${phaseNames[nextLesson.type]}로 이어가기`:'생활 팩 모두 보기'}</button><button class="quiet-button" data-life-review>복습 일정 보기</button></div>`,{type:'life-complete'});
  const ticket=generation;p.flush().catch(()=>{if(shown&&ticket===generation)home.toast('진도 저장을 기다리고 있어요. 복습 일정은 화면에 남겨 두었어요.');});
 }
 function review(){if(!ensureReadable())return;place='life';context=null;lastFeedback=null;helped=false;reviewRun=null;const s=summary(),future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'';
  const topics=new Map();for(const r of s.dueReviews){const title=packById(r.packId)?.title||'생활 한국어';topics.set(title,(topics.get(title)||0)+1);}
  paint('오늘 돌아온 표현',`<div class="life-review-summary life-heading" tabindex="-1"><section class="life-poster life-review-poster">${print('review')}<small class="life-poster-label">REVIEW${s.dueCount?` · ${pad(s.dueCount)}`:''}</small><h3 class="life-poster-word">${s.dueCount?`${s.dueCount}개의 표현이 기다려요.`:future?'배운 표현이 잘 쉬고 있어요.':'첫 표현을 만나러 갈까요?'}</h3><p class="life-poster-sub">${s.dueCount?'같은 답을 외우는 대신, 새로운 생활 장면에서 골라요.':future?`다음 복습은 ${escape(future)}부터 열려요.`:'생활 팩을 마치면 나에게 필요한 복습이 생겨요.'}</p></section>${s.dueCount?`<div class="life-review-topics" aria-label="돌아온 표현의 팩">${[...topics].map(([title,count])=>`<span>${escape(title)}${count>1?` <b>${count}</b>`:''}</span>`).join('')}</div>`:''}</div><div class="life-actions">${s.dueCount?'<button class="felt-button" data-life-review-start>돌아온 표현 연습하기 <span aria-hidden="true">→</span></button><button class="plain-button" data-life-next>다음 학습 이어 하기</button>':'<button class="felt-button" data-life-next>다음 학습 이어 하기 <span aria-hidden="true">→</span></button>'}<button class="quiet-button" data-life-home>마루로 돌아가기</button></div>`,{type:'life-review'});
 }
 function reviewStart(lessonId=null,requestedIds=null){const p=getProgress(),ids=Array.isArray(requestedIds)?requestedIds:null;reviewRun=p.startReview(ids?Math.min(6,ids.length):6,ids?.[0]||null,ids);if(!reviewRun)return review();for(const id of reviewRun.ids)if(exposedTransfers.has(id)&&!reviewRun.answers[id])p.markReviewHelp(id);lastFeedback=null;helped=false;renderReview();}
 function renderReview(){
  const run=getProgress().exportSnapshot().activeReview;if(!run)return review();reviewRun=run;
  const index=run.ids.findIndex(id=>!run.answers[id]);
  if(index<0){summary();paint('오늘의 복습을 마쳤어요',`<div class="life-complete life-heading" tabindex="-1"><section class="life-poster life-complete-poster">${print('complete')}<small class="life-poster-label">REVIEW COMPLETE</small><strong class="life-poster-word" aria-hidden="true">오늘의 복습을 마쳤어요</strong><h3 class="life-poster-sub">${run.ids.length}개 표현을 다시 만났어요.</h3></section><p class="life-complete-note">잘 익힌 표현은 더 긴 간격으로,<br>어려운 표현은 잠시 뒤 다시 돌아와요.</p></div><div class="life-actions"><button class="felt-button" data-life-home>마루로 돌아가기 <span aria-hidden="true">→</span></button><button class="plain-button" data-life-next>다음 학습 이어 하기</button></div>`,{type:'life-review-complete'});return;}
  const id=run.ids[index],record=getProgress().exportSnapshot().reviews[id],l=lessonById(record.lessonId),original=l.questions.find(q=>q.id===record.questionId),q=original.review;if(!lastFeedback)helped=run.pendingHelp?.[id]===true;
  context={lessonId:l.id,phase:'review',questionIndex:index,reviewId:id,reviewQuestion:q};
  if(!lastFeedback&&!helped&&preferences().support==='step'){helped=true;getProgress().markReviewHelp(id);}
  paint('다른 장면에서 다시 만나요',`<div class="life-session-meta" data-life-review-id="${escape(id)}" data-life-phase="review" data-life-step="${index}">${progressLine(index+(lastFeedback?1:0),run.ids.length)}<span>${escape(packById(record.packId).title)} · 새 장면 복습</span><span><b class="life-count">${index+1} / ${run.ids.length}</b></span></div>${questionMarkup(q,lastFeedback,{reviewIndex:index,reviewTotal:run.ids.length})}`,{type:'life-question',focus:'.life-question-title'});
  if(lastFeedback)revealFeedback();
 }
 function chooseReview(id){if(lastFeedback)return;const q=context.reviewQuestion,p=getProgress();p.answerReview({id:context.reviewId,runId:reviewRun.id,correct:id===q.answerId,helped});helped=p.exportSnapshot().activeReview.answers[context.reviewId].helped;lastFeedback={question:q,choiceId:id,correct:id===q.answerId,helped};
  // Keep this question on screen for feedback before moving the review cursor.
  const html=questionMarkup(q,lastFeedback,{reviewIndex:context.questionIndex,reviewTotal:reviewRun.ids.length});
  paint('다른 장면에서 다시 만나요',`<div class="life-session-meta" data-life-review-id="${context.reviewId}" data-life-phase="review" data-life-step="${context.questionIndex}">${progressLine(context.questionIndex+1,reviewRun.ids.length)}<span>표현 복습</span><span><b class="life-count">${context.questionIndex+1} / ${reviewRun.ids.length}</b></span></div>${html}`,{type:'life-question',focus:'.life-question-title'});
  revealFeedback();
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
 return {packs,stories,review,reviewStart,next,pack,start,cafe:()=>pack('cafe'),summary,refresh:updateHome,metrics:()=>({shown,lessonId:context?.lessonId||null,phase:context?.phase||null,step:context?.questionIndex??null,cafe:isCafeLesson(context?.lessonId)?cafeRun:null,speech:speech.metrics(),tutor:companion?.metrics()||null,owner:getProgress().owner,progress:getProgress().exportSnapshot()}),dispose(){ended=true;speech.dispose();clearInterval(timer);document.removeEventListener('click',click);if(shown)home.closePanel();}};
}
