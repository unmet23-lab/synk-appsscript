import {PACKS,LESSONS,lessonById,packById} from './life-content.mjs';
import {CAFE_LESSON_ID,CAFE_COMPOSE_ID,CAFE_LESSON_IDS,CAFE_VISITS,isCafeLesson,resumeCafe,chooseCafe,advanceCafe,chooseCafeSeat,cafeQuestion,updateCafeOrder,submitCafeOrder} from './cafe-activity.mjs';
import {cafeMarkup,cafeCompletionMarkup,createCafeSpeech,cafeSpeechLabel} from './cafe-ui.mjs';
import {play,haptic,verdict,getPref} from '../brand-opening/world-sound.mjs';
if(!document.querySelector('[data-life-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./life-ui.css',import.meta.url).href;style.dataset.lifeStyle='true';document.head.append(style);}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 세 친구: 카페 장면은 방 사진 속 작은 친구(home/friend-*), 이야기 무대는 정본 컷(assets/tutors).
const friends={mongle:{name:'몽글',file:'friend-mongle.webp',cut:'mongle'},kkamong:{name:'까몽',file:'friend-kkamong.webp',cut:'kkamong'},marine:{name:'마린',file:'friend-marine.webp',cut:'marin'}};
const phaseNames={expressions:'표현 익히기',story:'이야기 읽기',apply:'생활에서 써 보기',visit:'카페 방문',compose:'내 주문 만들기'};
const phaseLabels={expressions:'EXPRESSIONS',story:'STORY',apply:'PRACTICE',visit:'CAFE VISIT',compose:'MY ORDER'};
const dayLabel=at=>Number.isFinite(at)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at)):'';
// 복습에서 「언제 · 어디서」 배운 표현인지 붙인다. 시각은 그때그때 계산한다.
const ago=at=>{if(!Number.isFinite(at))return '';const minutes=Math.floor(Math.max(0,Date.now()-at)/60000);if(minutes<1)return '방금 전';if(minutes<60)return `${minutes}분 전`;const hours=Math.floor(minutes/60);return hours<24?`${hours}시간 전`:`${Math.floor(hours/24)}일 전`;};
const placeAt={greetings:'첫 모임에서',cafe:'카페에서',store:'편의점에서',directions:'길에서',transit:'버스에서',plans:'약속을 정하며'};
// 팩마다 그 팩을 설명하는 펠트 사진 한 장과 짧은 한 낱말.
const packWords={greetings:['인사','GREETINGS'],cafe:['카페','CAFE'],store:['편의점','STORE'],directions:['길 찾기','DIRECTIONS'],transit:['버스','TRANSIT'],plans:['약속','PLANS']};
// 허브의 팩 카드 모양: 넓은 카드 → 키 큰 카드 둘 → 넓은 카드(사진 왼쪽) → 키 큰 카드 둘. 같은 틀이 줄줄이 반복되지 않게.
const packShapes=['wide','tall','low','wide-left','tall','low'];
const pad=value=>String(value).padStart(2,'0');
const percent=(done,total)=>total?Math.round(Math.max(0,Math.min(1,done/total))*100):0;
const progressLine=(done,total)=>`<span class="life-progress" aria-hidden="true"><i style="width:${percent(done,total)}%"></i></span>`;
const meter=(done,total,label=`${done} / ${total}`)=>`<span class="life-meter" aria-hidden="true"><span><i style="width:${percent(done,total)}%"></i></span><b>${label}</b></span>`;
// 문제의 표현: 문제가 가리키는 레슨 표현(없으면 정답 문장).
const expressionOf=(lesson,q)=>lesson?.expressions.find(e=>e.id===q?.expressionId)||{korean:q?.choices?.find(c=>c.id===q.answerId)?.text||'',meaning:''};
export function createLifeExperience({home,getProgress,show=(title,html,options)=>home.showPanel(title,html,options),asset,onSummary=()=>{},onNext=null}){
 const panel=document.querySelector('#world-panel'),content=document.querySelector('#panel-content');
 for(const [variable,file]of Object.entries({'--cafe-room':'home/cafe-room-v1.webp','--cafe-drinks':'home/cafe-drinks-v2.png','--cafe-ice':'home/cafe-ice.webp','--life-print-goals':'world-felt/goals.webp'}))panel.style.setProperty(variable,`url("${asset(file)}")`);
 // 흰 인화지에 붙인 펠트 사진(assets/world-felt). 한 화면에 같은 사진은 한 번만 쓴다.
 const print=(name,className='')=>`<span class="w-print ${className}" aria-hidden="true"><img src="${asset('world-felt/'+name+'.webp')}" alt="" width="640" height="640" decoding="async"></span>`;
 let context=null,shown=false,rendering=false,ended=false,reviewRun=null,lastFeedback=null,helped=false,generation=0,timer,cafeRun=null,cafeView='',companion=null,place='life';
 const practised=new Set();
 const exposedTransfers=new Set();
 // 한 자리에서 한 시간을 넘기면 「잠깐 쉬어도 돼요」를 한 번만 보여 준다(10분 넘게 자리를 비우면 다시 센다).
 let sittingSince=Date.now(),hiddenSince=0,restKey=null;
 const sitting=()=>{if(document.hidden){hiddenSince=Date.now();return;}if(hiddenSince&&Date.now()-hiddenSince>600000){sittingSince=Date.now();restKey=null;}hiddenSince=0;};
 document.addEventListener('visibilitychange',sitting);
 function restLine(key){
  if(restKey===null&&Date.now()-sittingSince>=3600000)restKey=key;
  return restKey===key?'<p class="life-rest" role="status">한 시간 넘게 했어요. 잠깐 쉬어도 돼요. 하던 자리는 그대로 남아요.</p>':'';
 }
 const speech=createCafeSpeech({asset,onChange(){if(ended||!shown||context?.phase!=='cafe')return;const metrics=speech.metrics(),button=content.querySelector('[data-life-cafe-speech]'),status=content.querySelector('.cafe-speech-status');if(button){button.textContent=cafeSpeechLabel({available:metrics.available,phase:metrics.phase,heard:cafeRun.listen?.heard});button.dataset.phase=!metrics.available?'unavailable':metrics.phase;}if(status&&metrics.phase==='error')status.textContent='소리를 재생하지 못했어요. 다시 눌러 주세요.';companion?.update(tutorState());}});
 void speech.prepare();
 const summary=()=>getProgress().summary(PACKS,LESSONS);
 const preferences=()=>{try{return getProgress().learningProfileValues?.()||{};}catch{return {};}};
 const photo=(speaker,size='')=>friends[speaker]?`<img class="life-friend ${size}" src="${asset('home/'+friends[speaker].file)}" alt="${friends[speaker].name}" width="384" height="384">`:'';
 const cut=speaker=>friends[speaker]?`<img class="life-friend" src="${asset('tutors/'+friends[speaker].cut+'-기본.webp')}" alt="${friends[speaker].name}" width="480" height="480" decoding="async">`:'';
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
 const retryButton=q=>home.mountLifeTutor&&home.tutor?.().tutor?`<button class="life-tutor-retry" data-life-tutor-retry="${escape(q.id)}">튜터와 다시 연습하기</button>`:'';
 function paint(title,html,{type='life-library',focus='.life-heading',eyebrow='LIFE IN KOREA',keepScroll=false}={}){
  // 집중 판은 내용 영역이 스크롤된다. 같은 장면을 다시 그릴 때(낱말 고르기 등)만 자리를 지키고, 새 장면은 맨 위에서 시작한다.
  const scroll=keepScroll&&shown?content.scrollTop:0;
  generation++;rendering=true;show(title,html+statusLine(),{type,eyebrow,nav:'play'});
  const tutor=home.mountLifeTutor?.({state:tutorState(),snapshot:getProgress().exportSnapshot(),lessons:LESSONS,practised:[...practised],onHint:tutorHint,onPause:()=>speech.pause(),onPreparePractice:prepareTutorPractice,onPracticeSuccess:id=>completeTutorPractice(id,home.tutor?.().tutor),onPracticeComplete:id=>{practised.add(id);companion?.update({...tutorState(),practiceCompleted:true});}});
  companion=tutor;
  home.attachPanelResource({dispose(){tutor?.dispose();if(companion===tutor)companion=null;if(!rendering){speech.stop();shown=false;generation++;try{void getProgress().flush().catch(()=>{});}catch{}context=null;reviewRun=null;lastFeedback=null;}}});
  rendering=false;shown=true;content.scrollTop=scroll;content.dataset.reduced=String(!!home.state?.reduced);content.querySelector(focus)?.focus({preventScroll:true});updateHome();
 }
 // 판정 한 번: 소리 + 진동 + (「친구들의 반응」이 켜져 있으면) 튜터 자세 한 번.
 const judge=correct=>verdict(correct,{react:value=>companion?.react?.(value)});
 // 결과 한 장: 「보상 연출」이 켜져 있으면 200ms 페이드와 완료 소리 한 번, 꺼져 있으면 결과만.
 function celebrate(){
  const result=content.querySelector('.life-result'),on=getPref('celebrate');
  if(result&&on&&!home.state?.reduced)result.classList.add('is-arriving');
  if(on)play('done');haptic('done');
 }
 // 답을 고른 뒤: 아래 판정 띠에 가리지 않게 맞는 표현까지 보이도록 내용 영역만 내린다. 위 진행 막대 밑으로는 올리지 않는다.
 function revealFeedback(){
  const marked=[...content.querySelectorAll('.life-choice.is-correct,.life-choice.is-chosen')],actions=content.querySelector('.life-actions'),target=marked[marked.length-1]||content.querySelector('.life-choices');if(!actions||!target)return;
  const box=target.getBoundingClientRect(),need=box.bottom+10-actions.getBoundingClientRect().top;if(need<=0)return;
  const top=(content.querySelector('.life-session-meta')||content).getBoundingClientRect().bottom;
  content.scrollTop+=Math.max(0,Math.min(need,box.top-top-10));
 }
 function ensureReadable(){const s=getProgress().status();if(s.phase!=='unreadable')return true;paint('진도를 확인해 주세요',`<p class="panel-description">${escape(s.message)}</p><p class="dialog-note">기록은 지우지 않았어요. 내 계정에서 연결 상태를 확인해 주세요.</p>`);return false;}
 const stateOf=id=>{const status=getProgress().lessonState(id).status;return status==='completed'?'completed':status==='started'?'started':'new';};
 const packDone=pack=>pack.lessons.filter(l=>getProgress().lessonState(l.id).status==='completed').length;
 // 허브의 팩 카드: 어두운 카드 + 흰 인화지 + 큰 한 낱말 + 1px 진행선. 시작 전에는 진행선 대신 레슨 수만.
 function packCard(pack,index,current=null){
  const done=packDone(pack),total=pack.lessons.length,started=pack.lessons.some(l=>stateOf(l.id)==='started'),[word,label]=packWords[pack.id]||[pack.title,pack.id.toUpperCase()];
  const state=done===total?'done':done||started?'active':'new',now=pack.id===current;
  const foot=state==='new'?`<span class="life-pack-count">${pad(total)} LESSONS</span>`:state==='done'?'<span class="life-pack-done"><i class="w-led ok"></i>다 마쳤어요</span>':meter(done,total);
  // 「지금 할 일」 포스터와 같은 팩은 사진을 두 번 쓰지 않고 「지금」 표시로 잇는다.
  return `<button class="life-pack-card" data-life-pack="${pack.id}" data-state="${state}" data-shape="${packShapes[index%packShapes.length]}"${now?' data-current="true"':''} aria-label="${escape(`${pack.title} · ${pack.subtitle} · ${done} / ${total} 레슨${state==='done'?' 완료':''}`)}">${now?'<span class="life-pack-now"><i class="w-led ok"></i>지금 하는 팩</span>':print(pack.id,'life-pack-print')}<span class="life-pack-copy"><small class="life-pack-label">${pad(index+1)} · ${label}</small><strong class="life-pack-word">${escape(word)}</strong><span class="life-pack-title">${escape(pack.title)}</span></span><span class="life-pack-foot">${foot}</span></button>`;
 }
 // 「지금 할 일」: 하던 레슨 → 돌아온 복습 → 다음 레슨 순서. 코랄 포스터는 허브에 이것 하나.
 function nowPoster(s){
  const lesson=s.nextLesson;
  if(lesson&&(s.resume||!s.dueCount)){
   const pack=packById(lesson.packId),packIndex=PACKS.indexOf(pack),index=Math.max(0,pack.lessons.findIndex(l=>l.id===lesson.id)),total=pack.lessons.length,started=s.resume||stateOf(lesson.id)==='started';
   return {kind:'lesson',packId:pack.id,html:`<section class="life-poster life-now" aria-label="지금 할 일">${print(pack.id)}<small class="life-poster-label">${started?'CONTINUE':'UP NEXT'} · PACK ${pad(packIndex+1)}</small><strong class="life-poster-word">${escape(lesson.title)}</strong><span class="life-poster-sub">${escape(pack.title)} · ${phaseNames[lesson.type]}</span>${meter(index,total,`${pad(index+1)} / ${pad(total)}`)}<button class="felt-button" data-life-lesson="${lesson.id}">${started?'이어서 하기':'시작하기'} <span aria-hidden="true">→</span></button></section>`};
  }
  if(s.dueCount)return {kind:'review',html:`<section class="life-poster life-now" aria-label="지금 할 일">${print('review')}<small class="life-poster-label">REVIEW · ${pad(s.dueCount)}</small><strong class="life-poster-word">돌아온 표현</strong><span class="life-poster-sub">배운 표현 ${s.dueCount}개가 새 장면으로 돌아왔어요.</span><button class="felt-button" data-life-review>복습하기 <span aria-hidden="true">→</span></button></section>`};
  const future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'';
  return {kind:'rest',html:`<section class="life-poster life-now" aria-label="지금 할 일">${print('complete')}<small class="life-poster-label">ALL PACKS · ${s.completed} / ${s.total}</small><strong class="life-poster-word">팩을 모두 마쳤어요</strong><span class="life-poster-sub">${future?`다음 복습은 ${escape(future)}에 열려요.`:'다시 하고 싶은 팩을 골라요.'}</span><button class="felt-button" data-life-review>복습 일정 보기 <span aria-hidden="true">→</span></button></section>`};
 }
 function reviewRow(s){
  const future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'';
  return `<button class="life-row" data-life-review>${print('review','life-row-print')}<span class="life-row-copy"><strong>복습</strong><small>${s.dueCount?`표현 ${s.dueCount}개가 돌아왔어요.`:`다음 복습 ${escape(future)}`}</small></span>${s.dueCount?`<span class="life-row-state"><i class="w-led check"></i>${s.dueCount}개</span>`:''}</button>`;
 }
 function packs(){if(!ensureReadable())return;place='life';context=null;const s=summary(),now=nowPoster(s),hasReviews=s.dueCount>0||Number.isFinite(s.nextReviewAt);
  const episodes=PACKS.filter(p=>p.lessons.some(l=>l.type==='story')).length;
  // 처음 쓰는 사람에게는 복습 줄·완료 표시처럼 아직 쓸모없는 것을 두지 않는다.
  const rows=[`<button class="life-row" data-life-stories>${print('stories','life-row-print')}<span class="life-row-copy"><strong>세 친구 이야기</strong><small>까몽·몽글·마린이 나오는 이야기 ${episodes}편</small></span></button>`];
  if(now.kind==='lesson'&&hasReviews)rows.push(reviewRow(s));
  paint('배우기',`<div class="life-hub life-heading" tabindex="-1">${now.html}<section class="life-pack-section" aria-label="생활 팩"><div class="life-section-head"><p class="life-section-label">LIFE PACKS</p><small class="life-library-note">${s.completed?`레슨 ${s.total}개 중 ${s.completed}개 마쳤어요`:`팩 ${PACKS.length}개 · 레슨 ${LESSONS.length}개`}</small></div><div class="life-pack-grid">${PACKS.map((p,i)=>packCard(p,i,now.kind==='lesson'?now.packId:null)).join('')}</div></section><section class="life-rows" aria-label="더 보기"><p class="life-section-label">MORE</p>${rows.join('')}</section></div>`);}
 // 레슨 목록 줄: 번호 → 단계·제목·한 줄 설명 → 상태 LED. 시작 전 레슨은 상태 글 없이, 「지금」 줄만 코랄.
 function lessonRow(l,number,{nowId=null,className='',lead=null,kicker=phaseNames[l.type],labels=['완료','하는 중','']}={}){
  const state=stateOf(l.id),now=l.id===nowId,text=state==='completed'?labels[0]:state==='started'?labels[1]:now?'지금':labels[2];
  return `<button data-life-lesson="${l.id}" class="life-lesson-card ${className}" data-state="${state}"${now?' data-now':''}>${lead??`<span class="life-step-number">${pad(number)}</span>`}<span><small>${escape(kicker)}</small><strong>${escape(l.title)}</strong><span>${escape(l.goal)}</span></span>${text?`<em>${escape(text)}</em>`:''}</button>`;
 }
 const nowIn=lessons=>(lessons.find(l=>stateOf(l.id)==='started')||lessons.find(l=>stateOf(l.id)!=='completed'))?.id||null;
 function cafeVisitCards(nowId=null){return CAFE_VISITS.map(visit=>{const state=stateOf(visit.id),now=visit.id===nowId,text=state==='completed'?'완료':state==='started'?'하는 중':now?'지금':'';return `<button data-life-lesson="${visit.id}" class="life-lesson-card cafe-visit-card" data-state="${state}"${now?' data-now':''}><span class="life-step-number">${pad(visit.number)}</span><span><small>${visit.number}번째 방문</small><strong>${escape(visit.title)}</strong><span>${escape(visit.description)}</span></span>${text?`<em>${text}</em>`:''}</button>`;}).join('');}
 function stories(){if(!ensureReadable())return;place='life';context=null;
  const episodes=PACKS.map(p=>({pack:p,episode:p.lessons.find(l=>l.type==='story')})).filter(e=>e.episode);
  paint('세 친구 이야기',`<div class="life-heading" tabindex="-1"><section class="life-poster life-stories-poster">${print('stories')}<small class="life-poster-label">STORIES · ${pad(episodes.length)}</small><strong class="life-poster-word">세 친구 이야기</strong><span class="life-poster-sub">이야기를 읽고, 이야기 속 표현을 골라요.</span></section></div><section class="life-list" aria-label="세 친구 이야기"><p class="life-section-label">EPISODES</p><div class="life-lesson-list">${episodes.map(({pack,episode})=>lessonRow(episode,0,{className:'life-story-card',lead:print(pack.id,'life-row-print'),kicker:pack.title,labels:['다시 읽기','읽는 중','']})).join('')}</div></section><section class="life-list" aria-label="카페 방문"><div class="life-section-head"><p class="life-section-label">CAFE VISITS</p><small class="life-library-note">방문 ${CAFE_VISITS.length}번</small></div><div class="life-lesson-list">${cafeVisitCards()}</div></section>`);}
 function pack(id){if(!ensureReadable())return;const value=packById(id);if(!value)return;place=id==='cafe'?'cafe':'life';context=null;
  const p=getProgress(),s=summary(),hasReviews=s.dueCount>0||Number.isFinite(s.nextReviewAt),activeId=p.exportSnapshot().activeLessonId,nextVisit=CAFE_VISITS.find(v=>v.id===activeId)||CAFE_VISITS.find(v=>p.lessonState(v.id).status==='started')||CAFE_VISITS.find(v=>p.lessonState(v.id).status!=='completed')||CAFE_VISITS[0],visited=CAFE_VISITS.filter(v=>p.lessonState(v.id).status==='completed').length;
  const lessons=value.lessons.filter(l=>id!=='cafe'||!isCafeLesson(l.id)),index=PACKS.findIndex(p=>p.id===id),[word,label]=packWords[id]||[value.title,id.toUpperCase()],done=packDone(value);
  const cafe=id==='cafe'?`<section class="cafe-pack-preview"><img src="${asset('home/cafe-room-v1.webp')}" alt="햇살이 드는 동네 카페" width="1600" height="900"><div><small class="life-section-label">VISIT ${pad(nextVisit.number)} / ${pad(CAFE_VISITS.length)}</small><h3>${escape(nextVisit.title)}</h3><p>${escape(nextVisit.description)}</p><button class="felt-button" data-life-lesson="${nextVisit.id}">${p.lessonState(nextVisit.id).status==='started'?'이어서 하기':nextVisit.number===1?'카페에 들어가기':'다음 방문 시작하기'} <span aria-hidden="true">→</span></button></div></section><section class="life-list" aria-label="카페 방문"><div class="life-section-head"><p class="life-section-label">VISITS</p><small class="life-library-note">${visited?`${visited} / ${CAFE_VISITS.length}번 다녀왔어요`:`방문 ${CAFE_VISITS.length}번`}</small></div><div class="life-lesson-list cafe-visit-list">${cafeVisitCards(nextVisit.id)}</div></section>`:'';
  const heading=id==='cafe'?`<div class="life-heading life-pack-head" tabindex="-1"><div class="life-section-head"><p class="life-section-label">LESSONS</p><small class="life-library-note">주문 전에 먼저 봐도 좋아요</small></div><p class="life-pack-description">${escape(value.subtitle)}</p></div>`
   :`<div class="life-heading life-pack-head" tabindex="-1"><section class="life-poster life-pack-poster">${print(id)}<small class="life-poster-label">PACK ${pad(index+1)} · ${label}</small><strong class="life-poster-word" style="--len:${[...word].length}">${escape(word)}</strong><span class="life-poster-sub life-pack-description">${escape(value.title)} · ${escape(value.subtitle)}</span>${done?meter(done,value.lessons.length):`<span class="life-poster-count">${pad(value.lessons.length)} LESSONS</span>`}</section></div>`;
  const nowId=id==='cafe'?null:nowIn(lessons);
  paint(value.title,`${cafe}${heading}<div class="life-lesson-list">${lessons.map((l,i)=>lessonRow(l,i+1,{nowId})).join('')}</div><div class="life-library-footer"><button class="quiet-button" data-life-packs>팩 목록으로</button>${hasReviews?'<button class="quiet-button" data-life-review>복습 보기</button>':''}</div>`);}
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
 function ensureHeard(){if(cafeRun.listen?.mode==='listen'&&!cafeRun.listen.heard&&!cafeRun.listen.textShown)throw Error('직원 말을 끝까지 듣거나 「글자로 보기」를 눌러 주세요.');}
 function cafeChoose(choiceId){
  ensureHeard();speech.stop();
  const id=context.lessonId,next=chooseCafe(cafeRun,choiceId,id),p=getProgress(),q=cafeQuestion(cafeRun.step,id),correct=choiceId===q.answerId;
  if(!p.lessonState(id).answers[q.id])p.recordAnswer({lessonId:id,questionId:q.id,choiceId,correct,helped,stage:cafeStage(next),input:cafeRun.listen});
  else p.setStage(id,cafeStage(next));
  cafeRun=next;renderCafe();judge(correct);
 }
 function cafeSubmit(){
  ensureHeard();const id=context.lessonId,next=submitCafeOrder(cafeRun),p=getProgress(),q=cafeQuestion(0,id);speech.stop();
  if(!p.lessonState(id).answers[q.id])p.recordAnswer({lessonId:id,questionId:q.id,choiceId:next.choiceId,correct:next.choiceId===q.answerId,helped,order:cafeRun.order,input:cafeRun.listen,stage:cafeStage(next)});else p.setStage(id,cafeStage(next));
  cafeRun=next;renderCafe();judge(next.choiceId===q.answerId);
 }
 // 직원 말 듣기: 보통 빠르기는 멈춤·이어 듣기, 「느리게」는 처음부터 0.75배로.
 async function cafeSpeech({slow=false}={}){
  if(!speech.available()&&!await speech.prepare())throw Error('직원 말 소리를 준비하지 못했어요. 다시 누르거나 「글자로 보기」를 눌러 주세요.');
  const state=speech.metrics();if(!slow&&state.phase==='playing'){speech.pause();return;}
  const id=context.lessonId,step=cafeRun.step,lineId=`${id}-${step+1}`;
  await speech.play(lineId,()=>{if(ended||!shown||context?.phase!=='cafe'||context.lessonId!==id||cafeRun.step!==step)return;try{cafeRun={...cafeRun,listen:{...cafeRun.listen,heard:true}};persistCafe();renderCafe();}catch{speech.stop();}},slow?{rate:.75,restart:true}:{});
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
  paint('카페 방문 결과',cafeCompletionMarkup({photo,print,nextLesson,lessonId:context.lessonId,state:cafeRun,adaptive:!!onNext,answers:p.lessonState(context.lessonId).answers}),{type:'life-cafe-complete',focus:'.cafe-focus',eyebrow:'LIFE IN KOREA · CAFE'});
  celebrate();
  const ticket=generation;p.flush().catch(()=>{if(shown&&ticket===generation)home.toast('카페 기록을 저장하고 있어요. 화면의 진행은 그대로예요.');});
 }
 function persistStage(){const p=getProgress();if(context)p.setStage(context.lessonId,{phase:context.phase,sceneIndex:context.sceneIndex,questionIndex:context.questionIndex,helped});}
 // 집중 판 맨 위: 진행 막대(장면 + 문제를 한 줄로) · 팩과 단계 · 「2 / 9」.
 function lessonHeader(l){
  const pack=packById(l.packId),scenes=l.scenes.length,questions=l.questions.length,phase=context.phase;
  const done=phase==='story'?context.sceneIndex+1:phase==='questions'?scenes+Math.min(context.questionIndex+(lastFeedback?1:0),questions):0;
  const count=phase==='questions'?`${Math.min(context.questionIndex+1,questions)} / ${questions}`:phase==='story'?`${Math.min(context.sceneIndex+1,scenes)} / ${scenes}`:'';
  return `<div class="life-session-meta" data-life-session="${escape(getProgress().lessonState(l.id).attemptId)}" data-life-lesson-id="${l.id}" data-life-phase="${phase}" data-life-step="${context.questionIndex}">${progressLine(done,scenes+questions)}<span>${escape(pack.title)} · ${phaseNames[l.type]}</span><span>${count?`<b class="life-count">${count}</b>`:'<b class="life-count">START</b>'}</span></div>`;
 }
 const expressionList=(l,label='EXPRESSIONS')=>`<section class="life-expression-list" aria-label="${label==='EXPRESSIONS'?'이번에 배울 표현':'배운 표현'}"><p class="life-section-label">${label}</p>${l.expressions.map((e,i)=>`<article><span class="life-expression-index" aria-hidden="true">${pad(i+1)}</span><div><strong>${escape(e.korean)}</strong><p>${escape(e.meaning)}</p></div></article>`).join('')}</section>`;
 // 결과 한 장에 들어가는 「배운 표현」: 표현 + 작은 뜻.
 const learnedList=(expressions,label='LEARNED')=>`<section class="life-result-learned" aria-label="배운 표현"><p class="life-section-label">${label}</p><ul>${expressions.map(e=>`<li><strong>${escape(e.korean)}</strong>${e.note?`<small>${escape(e.note)}</small>`:''}</li>`).join('')}</ul></section>`;
 // 결과의 큰 한 줄: 마지막 낱말과 「끝!」은 한 줄에 붙여 둔다(줄바꿈이 「세 / 마디」처럼 끊기지 않게).
 const doneWord=title=>{const words=String(title).split(' '),tail=words.pop();return `${escape(words.join(' '))}${words.length?' ':''}<span class="life-nowrap">${escape(tail)}, 끝!</span>`;};
 function renderLesson(){
  if(!context)return;const l=lessonById(context.lessonId);if(!l)return;const header=lessonHeader(l);
  if(context.phase==='intro'){
   paint(l.title,`${header}<div class="life-intro"><div class="life-heading life-intro-head" tabindex="-1">${print(l.packId,'life-intro-print')}<div><p class="life-section-label">${phaseLabels[l.type]}</p><p class="life-goal">${escape(l.goal)}</p></div></div>${expressionList(l)}</div><div class="life-actions"><button class="felt-button" data-life-begin>${l.type==='story'?'이야기 읽기':'시작하기'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>나중에 하기</button></div>`,{type:'life-lesson'});return;
  }
  if(context.phase==='story'){
   const scene=l.scenes[context.sceneIndex];if(!scene){context.phase='questions';persistStage();renderLesson();return;}
   const friend=friends[scene.speaker],speaker=friend?scene.speaker:'narrator',last=context.sceneIndex+1===l.scenes.length;
   // 말하는 친구는 가운데 크게(정본 컷), 나머지 둘은 옆에 작게. 대사는 그 친구를 가리키는 흰 말풍선. 저절로 넘어가지 않는다.
   paint(l.title,`${header}<div class="life-story-stage" data-speaker="${speaker}"><div class="life-cast">${Object.keys(friends).map(f=>`<div class="${f===scene.speaker?'is-speaking':''}">${cut(f)}<small>${friends[f].name}</small></div>`).join('')}</div><div class="life-dialogue life-heading" tabindex="-1" data-speaker="${speaker}"><small>${friend?friend.name:'이야기'}</small><p>${escape(scene.text)}</p></div></div>${restLine(`story:${l.id}`)}<div class="life-actions"><button class="felt-button" data-life-scene-next>${last?'문제 풀기':'다음'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>나중에 하기</button></div>`,{type:'life-story'});return;
  }
  renderQuestion();
 }
 function renderQuestion(){
  const l=lessonById(context.lessonId),q=l.questions[context.questionIndex];if(!q)return finish();
  const previous=getProgress().lessonState(l.id).answers[q.id];
  if(previous&&!lastFeedback)lastFeedback={correct:previous.correct,choiceId:previous.choiceId,question:q,helped:previous.helped};
  if(!lastFeedback&&!helped&&preferences().support==='step'){helped=true;persistStage();}
  paint(l.title,`${lessonHeader(l)}${questionMarkup(q,lastFeedback,{lesson:l,packId:l.packId,rest:restLine(`question:${l.id}`)})}`,{type:'life-question',focus:'.life-question-title'});
  if(lastFeedback)revealFeedback();
 }
 // 문제: 장면(팩 사진 + 상황) → 묻는 말 → 큰 선택지(56px+, 고르면 흰 바탕). 판정은 아래 흰 알약 위에 붙는 어두운 띠 하나.
 function questionMarkup(q,feedback,{lesson=null,packId=null,origin='',rest=''}={}){
  const choiceButtons=q.choices.map(c=>`<button class="life-choice ${feedback&&c.id===feedback.choiceId?'is-chosen':''} ${feedback&&c.id===q.answerId?'is-correct':''}" data-life-choice="${c.id}" ${feedback?'disabled':''}><span>${escape(c.text)}</span></button>`).join('');
  const result=feedback?feedback.correct&&!feedback.helped?'ok':feedback.correct?'assisted':'retry':'';
  const answer=q.choices.find(c=>c.id===q.answerId)?.text||'';
  const band=feedback?`<div class="life-feedback" role="status" data-result="${result}"><strong>${result==='ok'?'맞아요':result==='assisted'?'도움을 받아 맞혔어요':'이렇게 말해요'}</strong>${result==='retry'?`<p class="life-feedback-answer">${escape(answer)}</p>`:''}<details class="life-explanation" ${result==='ok'&&preferences().explanation==='brief'?'':'open'}><summary>이유</summary><p>${escape(q.explanation)}</p></details>${result!=='ok'?`<div class="life-feedback-foot"><small>조금 뒤 새 장면에서 다시 나와요.</small>${retryButton(q)}</div>`:''}</div>`:'';
  const scene=packId?`<div class="life-scene">${print(packId,'life-scene-print')}<p class="life-context">${escape(q.context||lesson?.title||'')}</p></div>`:'';
  return `<div class="life-question-layout"><section class="life-question-copy">${scene}<div class="life-question-title" tabindex="-1">${origin?`<small>${escape(origin)}</small>`:''}<h3>${escape(q.prompt)}</h3></div><button class="quiet-button life-help" data-life-help aria-expanded="${helped}" ${feedback?'disabled':''}>표현 도움 보기</button><p class="life-hint" ${helped?'':'hidden'}>${escape(q.explanation)}</p>${rest}</section><section class="life-answer-area" aria-label="답 고르기"><div class="life-choices">${choiceButtons}</div></section></div><div class="life-actions">${band}<button class="felt-button" data-life-question-next ${feedback?'':'disabled'}>${feedback?'다음':'답을 골라 주세요'} <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-pause>나중에 하기</button></div>`;
 }
 function choose(choiceId){if(lastFeedback)return;
  const p=getProgress(),l=lessonById(context.lessonId),q=l.questions[context.questionIndex];
  const correct=choiceId===q.answerId;p.recordAnswer({lessonId:l.id,questionId:q.id,choiceId,correct,helped});lastFeedback={question:q,choiceId,correct,helped};renderQuestion();judge(correct);
 }
 // 다음 레슨으로 가는 조용한 링크(맞춤 추천이 있으면 그쪽).
 const nextLink=nextLesson=>`<button class="quiet-button" ${onNext?'data-life-next':nextLesson?`data-life-lesson="${nextLesson.id}"`:'data-life-packs'}>${onNext?'다음 연습':nextLesson?'다음 레슨':'팩 목록 보기'}</button>`;
 function finish(){
  const p=getProgress(),l=lessonById(context.lessonId);p.finishLesson(l.id);const s=summary(),done=p.lessonState(l.id);
  context.phase='complete';
  const pack=packById(l.packId),packState=s.packs.find(x=>x.id===pack.id),complete=packState.completed===packState.total,[word]=packWords[pack.id]||[pack.title];
  const missed=l.questions.find(q=>{const a=done.answers[q.id];return a&&(!a.correct||a.helped);}),again=missed?expressionOf(l,missed):null;
  // 결과 한 장: 큰 한 줄 + 이 레슨의 사진 → 배운 표현 → 다시 볼 표현 하나 → 얻은 것 → 흰 알약 하나(우리 동네로) + 조용한 링크(다음 레슨).
  paint('레슨 결과',`<div class="life-complete life-result life-heading" tabindex="-1"><section class="life-poster life-complete-poster">${print(l.packId)}<small class="life-poster-label">RESULT · ${phaseLabels[l.type]}</small><strong class="life-poster-word">${doneWord(l.title)}</strong><span class="life-poster-sub">${escape(pack.title)} · ${phaseNames[l.type]}</span></section>${learnedList(l.expressions)}${again?`<section class="life-result-again"><p class="life-section-label">AGAIN</p><strong>${escape(again.korean)}</strong><div><small>조금 뒤 새 장면에서 다시 나와요.</small><button class="quiet-button" data-life-review>복습 일정</button></div></section>`:''}<section class="life-result-got"><p class="life-section-label">GOT</p><div><i class="w-led ${complete?'ok':'info'}"></i><strong>${complete?`${escape(word)} 팩 도장`:`${escape(word)} 팩 ${packState.completed} / ${packState.total}`}</strong><small>${complete?'팩 하나를 다 마쳤어요.':'레슨을 마칠 때마다 한 칸씩 차요.'}</small></div></section></div><div class="life-actions"><button class="felt-button" data-life-home>우리 동네로 <span aria-hidden="true">→</span></button>${nextLink(s.nextLesson)}</div>`,{type:'life-complete'});
  celebrate();
  const ticket=generation;p.flush().catch(()=>{if(shown&&ticket===generation)home.toast('진도를 저장하고 있어요. 복습 일정은 그대로 남아요.');});
 }
 // 돌아온 표현마다 「언제 · 어디서」 배웠는지 붙인다(정본 대사를 더하지 않고 화면 글로만).
 function reviewOrigin(record,snapshot=getProgress().exportSnapshot()){
  const at=snapshot.lessons[record.lessonId]?.answers?.[record.questionId]?.at??record.lastAt;
  return [ago(at),placeAt[record.packId]].filter(Boolean).join(' · ');
 }
 function review(){if(!ensureReadable())return;place='life';context=null;lastFeedback=null;helped=false;reviewRun=null;const s=summary(),future=Number.isFinite(s.nextReviewAt)?dayLabel(s.nextReviewAt):'',snapshot=getProgress().exportSnapshot();
  const items=s.dueReviews.map(r=>{const l=lessonById(r.lessonId),q=l?.questions.find(x=>x.id===r.questionId);return {korean:expressionOf(l,q).korean,origin:reviewOrigin(r,snapshot)};}).filter(i=>i.korean);
  paint('복습',`<div class="life-review-summary life-heading" tabindex="-1"><section class="life-poster life-review-poster">${print('review')}<small class="life-poster-label">REVIEW${s.dueCount?` · ${pad(s.dueCount)}`:''}</small><h3 class="life-poster-word">${s.dueCount?`돌아온 표현 ${s.dueCount}개`:future?'다음 복습':'아직 복습이 없어요'}</h3><p class="life-poster-sub">${s.dueCount?'같은 문제가 아니라 새 장면에서 다시 골라요.':future?`${escape(future)}에 열려요.`:'레슨을 하나 마치면 복습할 표현이 생겨요.'}</p></section>${items.length?`<section class="life-review-list" aria-label="돌아온 표현"><p class="life-section-label">BACK AGAIN</p><ul>${items.map(i=>`<li><strong>${escape(i.korean)}</strong><small>${escape(i.origin)}</small></li>`).join('')}</ul></section>`:''}${restLine('review')}</div><div class="life-actions">${s.dueCount?'<button class="felt-button" data-life-review-start>복습 시작하기 <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-next>다음 레슨 하기</button>':'<button class="felt-button" data-life-next>다음 레슨 하기 <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-home>우리 동네로</button>'}</div>`,{type:'life-review'});
 }
 function reviewStart(lessonId=null,requestedIds=null){const p=getProgress(),ids=Array.isArray(requestedIds)?requestedIds:null;reviewRun=p.startReview(ids?Math.min(6,ids.length):6,ids?.[0]||null,ids);if(!reviewRun)return review();for(const id of reviewRun.ids)if(exposedTransfers.has(id)&&!reviewRun.answers[id])p.markReviewHelp(id);lastFeedback=null;helped=false;renderReview();}
 function renderReview(){
  const run=getProgress().exportSnapshot().activeReview;if(!run)return review();reviewRun=run;
  const index=run.ids.findIndex(id=>!run.answers[id]);
  if(index<0){
   summary();const snapshot=getProgress().exportSnapshot(),items=run.ids.map(id=>{const r=snapshot.reviews[id],l=lessonById(r?.lessonId),q=l?.questions.find(x=>x.id===r.questionId),a=run.answers[id];return {korean:expressionOf(l,q).korean,note:a&&a.correct&&!a.helped?'잘 기억했어요. 다음에는 더 오래 있다가 나와요.':'조금 뒤 다시 나와요.'};}).filter(i=>i.korean);
   paint('복습 결과',`<div class="life-complete life-result life-heading" tabindex="-1"><section class="life-poster life-complete-poster">${print('review')}<small class="life-poster-label">RESULT · REVIEW</small><strong class="life-poster-word">복습, 끝!</strong><h3 class="life-poster-sub">표현 ${run.ids.length}개를 다시 만났어요.</h3></section>${learnedList(items,'BACK AGAIN')}</div><div class="life-actions"><button class="felt-button" data-life-home>우리 동네로 <span aria-hidden="true">→</span></button><button class="quiet-button" data-life-next>다음 레슨</button></div>`,{type:'life-review-complete'});
   celebrate();return;
  }
  const id=run.ids[index],record=getProgress().exportSnapshot().reviews[id],l=lessonById(record.lessonId),original=l.questions.find(q=>q.id===record.questionId),q=original.review;if(!lastFeedback)helped=run.pendingHelp?.[id]===true;
  context={lessonId:l.id,phase:'review',questionIndex:index,reviewId:id,reviewQuestion:q};
  if(!lastFeedback&&!helped&&preferences().support==='step'){helped=true;getProgress().markReviewHelp(id);}
  paint('복습',`<div class="life-session-meta" data-life-review-id="${escape(id)}" data-life-phase="review" data-life-step="${index}">${progressLine(index+(lastFeedback?1:0),run.ids.length)}<span>${escape(packById(record.packId).title)} · 새 장면 복습</span><span><b class="life-count">${index+1} / ${run.ids.length}</b></span></div>${questionMarkup(q,lastFeedback,{packId:record.packId,origin:`${reviewOrigin(record)} 배운 표현`,rest:restLine(`review:${id}`)})}`,{type:'life-question',focus:'.life-question-title'});
  if(lastFeedback)revealFeedback();
 }
 function chooseReview(id){if(lastFeedback)return;const q=context.reviewQuestion,p=getProgress(),correct=id===q.answerId;p.answerReview({id:context.reviewId,runId:reviewRun.id,correct,helped});helped=p.exportSnapshot().activeReview.answers[context.reviewId].helped;lastFeedback={question:q,choiceId:id,correct,helped};
  // Keep this question on screen for feedback before moving the review cursor.
  const record=p.exportSnapshot().reviews[context.reviewId],html=questionMarkup(q,lastFeedback,{packId:record?.packId,origin:record?`${reviewOrigin(record)} 배운 표현`:'',rest:restLine(`review:${context.reviewId}`)});
  paint('복습',`<div class="life-session-meta" data-life-review-id="${context.reviewId}" data-life-phase="review" data-life-step="${context.questionIndex}">${progressLine(context.questionIndex+1,reviewRun.ids.length)}<span>${escape(packById(record?.packId)?.title||'생활 한국어')} · 새 장면 복습</span><span><b class="life-count">${context.questionIndex+1} / ${reviewRun.ids.length}</b></span></div>${html}`,{type:'life-question',focus:'.life-question-title'});
  revealFeedback();judge(correct);
 }
 function pause(){if(context?.phase==='cafe')persistCafe();else if(context&&['intro','story','questions'].includes(context.phase))persistStage();home.closePanel();updateHome();home.toast('하던 자리를 저장했어요.');}
 const handlers={
  packs,stories,review,next,home:()=>{home.closePanel();home.goTown?.();updateHome();},pack:el=>pack(el.dataset.lifePack),lesson:el=>start(el.dataset.lifeLesson),
  begin:()=>{context.phase='story';context.sceneIndex=0;persistStage();renderLesson();},
  'scene-next':()=>{context.sceneIndex++;if(context.sceneIndex>=lessonById(context.lessonId).scenes.length)context.phase='questions';persistStage();renderLesson();},
  choice:el=>context.phase==='review'?chooseReview(el.dataset.lifeChoice):choose(el.dataset.lifeChoice),
  'question-next':()=>{if(context.phase==='review'){lastFeedback=null;helped=false;renderReview();}else{context.questionIndex++;lastFeedback=null;helped=false;persistStage();renderLesson();}},
  'review-start':reviewStart,pause,
  'cafe-choice':el=>cafeChoose(el.dataset.lifeCafeChoice),'cafe-next':cafeNext,
  'cafe-word':el=>{const field=el.dataset.lifeCafeWord,value=field==='count'?Number(el.dataset.cafeValue):el.dataset.cafeValue;cafeRun=updateCafeOrder(cafeRun,field,value);persistCafe();renderCafe();play('select');content.querySelector(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`)?.focus({preventScroll:true});},
  'cafe-submit':cafeSubmit,'cafe-speech':()=>{void cafeSpeech().catch(error=>home.toast(error.message));},'cafe-slow':()=>{void cafeSpeech({slow:true}).catch(error=>home.toast(error.message));},
  'cafe-mode':el=>{if(cafeRun.phase!=='welcome')return;cafeRun={...cafeRun,listen:{mode:el.dataset.lifeCafeMode,heard:false,textShown:false}};persistCafe();renderCafe();play('select');},
  'cafe-transcript':()=>{cafeRun={...cafeRun,listen:{...cafeRun.listen,textShown:true}};helped=true;persistCafe();renderCafe();content.querySelector('.cafe-staff>p')?.focus({preventScroll:true});},
  'cafe-seat':el=>{const next=chooseCafeSeat(cafeRun,el.dataset.lifeCafeSeat,context.lessonId);getProgress().setStage(context.lessonId,cafeStage(next));cafeRun=next;renderCafe();play('select');},
  'cafe-help':()=>{helped=true;persistCafe();renderCafe();content.querySelector('[data-life-cafe-help]')?.focus({preventScroll:true});},
  help:tutorHint,'tutor-retry':el=>companion?.openPractice(el.dataset.lifeTutorRetry)
 };
 function click(event){const button=event.target.closest('button');if(!button||!panel.open||!shown)return;
  const entry=Object.entries(handlers).find(([key])=>button.hasAttribute('data-life-'+key));if(!entry)return;
  event.preventDefault();event.stopPropagation();try{entry[1](button);}catch(error){home.toast(error.message||'진도를 확인한 뒤 다시 시작해 주세요.');}
 }
 document.addEventListener('click',click);
 timer=setInterval(updateHome,15000);updateHome();
 return {packs,stories,review,reviewStart,next,pack,start,cafe:()=>pack('cafe'),summary,refresh:updateHome,metrics:()=>({shown,lessonId:context?.lessonId||null,phase:context?.phase||null,step:context?.questionIndex??null,cafe:isCafeLesson(context?.lessonId)?cafeRun:null,speech:speech.metrics(),tutor:companion?.metrics()||null,owner:getProgress().owner,progress:getProgress().exportSnapshot()}),dispose(){ended=true;speech.dispose();clearInterval(timer);document.removeEventListener('click',click);document.removeEventListener('visibilitychange',sitting);if(shown)home.closePanel();}};
}
