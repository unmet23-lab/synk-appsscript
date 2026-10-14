const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reasons={travel:'여행',life:'한국 생활',people:'사람들과 대화',exam:'TOPIK 기초',study:'학교 공부',work:'직장',career:'진로 준비',culture:'한국 문화',hobby:'취미',other:'아직 찾는 중'};
const supportNames={choose:['골라 보며 익히기','먼저 골라 보고, 틀리면 이유를 봐요.'],step:['한 단계씩 도움받기','문제마다 표현 도움을 먼저 펼쳐 둬요.'],independent:['먼저 혼자 풀기','도움은 내가 누를 때만 열려요.']};
const stateNames={practice:'다시 연습할 부분',supported:'도움을 받아 연습한 부분',review:'다시 확인할 때',checking:'새 문제로 확인하는 중','recent-independent':'최근 새 문제를 혼자 풀었어요'};
// 고르기: 알약 묶음(고른 것은 흰 바탕). 이름·값 순서는 시험이 읽으므로 바꾸지 않는다.
const radios=(name,options,value)=>(Array.isArray(options)?options:Object.entries(options)).map(([id,label])=>`<label class="study-pill"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span>${label}</span></label>`).join('');
// 도움 방식: 목록 줄(제목 + 설명 한 줄 + 체크).
const rows=(name,options,value)=>Object.entries(options).map(([id,[label,note]])=>`<label class="study-option"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('');

// WORLD supplies meaningful candidates; the existing Core decides among them.
// This controller owns no identity, grading, second event log, or server API.
export function createWorldEducation({home,getProgress,engine,createPlan,launchGame,startLesson,startReview,prepare=async()=>{},target=globalThis}){
 let stopped=false,coach=null,coachHost=null,current=null,refreshing=false,applied=null;
 const owner=getProgress().owner;
 const empty=engine.engine.createGame({gameId:'world-home-empty',storage:null,historyComplete:false}).summary();
 const check=()=>{if(stopped||getProgress()?.owner!==owner)throw Error('학습 계정이 바뀌었어요. 설정을 다시 열어 주세요.');};
 function readCoach(){
  check();const source=target.SYNKLearningHost||null;
  if(!source&&owner!=='guest')return null;
  if(coach&&coachHost===source){try{coach.summary();return coach;}catch{coach.disconnect?.();coach=null;}}
  if(coachHost!==source){coach?.disconnect?.();coach=null;coachHost=source;applied=null;}
  if(!coach)coach=source?source.createGame({gameId:'world-home'},engine.engine.createGame,engine.createLearningSync):engine.engine.createGame({gameId:'world-home',storage:target.localStorage});
  return coach;
 }
 function applyPreferences(){
  check();const progress=getProgress(),profile=progress.learningProfile().profile;
  if(['new','skipped'].includes(profile.status))return;
  const values=progress.learningProfileValues(),source=target.SYNKLearningHost||null;
  const presentation=Object.fromEntries(['support','explanation','textSize','motion'].filter(k=>values[k]).map(k=>[k,values[k]]));
  const signature=JSON.stringify(presentation);
  if(applied?.source===source&&applied.signature===signature)return;
  const preferences=source?.preferences?.()||readCoach();
  if(preferences){if(preferences.setPresentation(Object.keys(presentation).length?presentation:null)===false)return false;applied={source,signature};}
  return true;
 }
 function refresh(){
  if(stopped||refreshing)return current;refreshing=true;
  try{
   check();const progress=getProgress(),save=progress.status();
   if(['unreadable','conflict','loading'].includes(save.phase)||save.rejected){current=null;home.updateStudy?.(null);return null;}
   let summary=empty;
   try{summary=readCoach()?.summary()||empty;applyPreferences();}catch{/* Unavailable account evidence remains unknown. */}
   current=createPlan({summary,progress:progress.exportSnapshot(),settings:progress.learningProfileValues(),now:Date.now(),recommendActivities:engine.recommendActivities});
   home.updateStudy?.(current);return current;
  }catch{current=null;home.updateStudy?.(null);return null;}finally{refreshing=false;}
 }
 async function next(){
  check();const profile=getProgress().learningProfile().profile;
  if(profile.status==='new'){open({continueAfter:true});return;}
  await prepare();check();const plan=refresh(),selected=plan?.selected;
  if(!selected){home.toast(plan?.reason||'지금 조건에 맞는 연습이 없어요. 학습 목표에서 시간과 소리를 바꿔 보세요.');return;}
  if(applyPreferences()===false){home.toast('도움 방식 저장을 다시 확인해 주세요.');return;}
  if(selected.route==='game')return launchGame(selected.gameId);
  if(selected.route==='review')return startReview(selected.lessonId,selected.reviewIds);
  return startLesson(selected.lessonId);
 }
 function open({continueAfter=false}={}){
  check();const progress=getProgress(),saved=progress.learningProfile(),profile=saved.profile,values=progress.learningProfileValues();let revision=profile.revision;
  let summary=empty;try{summary=readCoach()?.summary()||empty;}catch{}
  const observed=summary.evidenceComplete?summary.skills.filter(s=>stateNames[s.status]).slice(0,4):[];
  const reason=values.primaryReason||values.reasons?.[0]||'';
  // 폼 느낌을 걷어낸 목록: 알약 묶음(이유·설명·시간·소리) · 목록 줄(도움 방식) · 스위치(기억하기). 사진은 생활 화면이 심어 둔 나침반(--life-print-goals).
  home.showPanel('학습 목표',`<form id="world-study-form" class="study-form">
   <div class="life-poster study-poster"><span class="w-print study-print" aria-hidden="true"><i></i></span><small class="life-poster-label">MY GOALS</small><strong class="life-poster-word">학습 목표</strong><p class="study-intro life-poster-sub">정해 두면 다음 연습을 여기에 맞춰 골라요. 건너뛰어도 배울 수 있고, 언제든 바꿀 수 있어요.</p></div>
   <fieldset class="study-group"><legend>배우는 이유</legend><div class="study-pills study-wrap">${radios('reason',[['','안 정함'],...Object.entries(reasons)],reason)}</div></fieldset>
   <fieldset class="study-group"><legend>도움 방식</legend><div class="study-options">${rows('support',supportNames,values.support||'choose')}</div></fieldset>
   <fieldset class="study-group"><legend>설명 길이</legend><div class="study-pills study-segment">${radios('explanation',{brief:'짧게',standard:'보통',detailed:'자세히'},values.explanation||'brief')}</div></fieldset>
   <div class="study-today"><p class="life-section-label">TODAY</p><p>시간과 소리는 오늘만 적용돼요.</p>
    <fieldset class="study-group"><legend>공부할 시간</legend><div class="study-pills study-segment">${radios('minutes',[['','상관없음'],['3','3분'],['5','5분'],['10','10분']],values.minutes?String(values.minutes):'')}</div></fieldset>
    <fieldset class="study-group"><legend>소리</legend><div class="study-pills study-segment">${radios('audio',{available:'들을 수 있어요',off:'지금은 못 들어요'},values.audio==='off'?'off':'available')}</div></fieldset>
   </div>
   <label class="study-consent"><input type="checkbox" name="consent" ${profile.consent?'checked':''}><span><strong>${progress.status().scoped?'내 계정':'이 기기'}에 저장하기</strong><small>목표와 도움 방식을 기억해 추천에 써요.</small></span></label>
   <p class="study-scope">급수나 성격을 판정하지 않아요. 설정을 지워도 진도와 복습 기록은 남아요.</p>
   <p class="study-save-status" role="status">${escape(progress.status().message)}</p>
   <div class="life-actions"><button class="felt-button" type="submit">${continueAfter?'저장하고 시작하기':'저장하기'} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-study-skip>${profile.status==='new'?'건너뛰기':'닫기'}</button></div>
   ${profile.status==='active'?'<div class="study-controls"><button type="button" class="quiet-button" data-study-clear="disable">추천에 쓰지 않기</button><button type="button" class="quiet-button" data-study-clear="delete">목표 지우기</button></div>':''}
   <section class="study-understanding"><h3>연습에서 본 것</h3>${observed.length?`<ul>${observed.map(s=>`<li><strong>${escape(s.label)}</strong><span>${stateNames[s.status]}</span></li>`).join('')}</ul>`:'<p>새 문제를 풀면서 조금씩 알아가요. 기록이 없다고 약하다고 보지 않아요.</p>'}<p>혼자 푼 답, 도움을 받은 답, 조작·소리 문제를 나눠서 다음 연습에 반영해요.</p></section>
  </form>`,{type:'world-study',eyebrow:'GOALS',nav:'me'});
  const form=target.document.querySelector('#world-study-form');if(!form)return;
  const status=form.querySelector('.study-save-status');let busy=false;
  const valid=()=>{check();if(progress!==getProgress()||!form.isConnected)throw Error('설정을 다시 열어 주세요.');};
  const run=async operation=>{if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{valid();operation();revision=progress.learningProfile().profile.revision;await progress.flush();valid();if(applyPreferences()===false)throw Error('도움 방식 저장을 다시 확인해 주세요.');refresh();home.closePanel();if(continueAfter)await next();else home.toast('목표에 맞춰 다음 연습을 바꿨어요.');}catch(error){if(form.isConnected)status.textContent=error.message||'저장을 확인한 뒤 다시 시도해 주세요.';}finally{busy=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.elements.consent.checked){status.textContent='저장하려면 「저장하기」 스위치를 켜 주세요. 건너뛰어도 기본 연습은 할 수 있어요.';return;}
   const reason=form.elements.reason.value,minutes=Number(form.elements.minutes.value);
   void run(()=>progress.updateLearningProfile({consent:true,expectedRevision:revision,values:{reasons:reason?[reason]:null,primaryReason:reason||null,goal:null,support:form.elements.support.value,explanation:form.elements.explanation.value},today:{...(minutes?{minutes}:{}),audio:form.elements.audio.value}}));
  });
  form.querySelector('[data-study-skip]').addEventListener('click',()=>{if(profile.status==='new')void run(()=>progress.clearLearningProfile({mode:'skip',expectedRevision:revision}));else home.closePanel();});
  form.querySelectorAll('[data-study-clear]').forEach(button=>button.addEventListener('click',()=>void run(()=>progress.clearLearningProfile({mode:button.dataset.studyClear,expectedRevision:revision}))));
 }
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 return {next,open,refresh,applyPreferences,presentation(){check();const values=getProgress().learningProfileValues();return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),dispose(){stopped=true;coach?.disconnect?.();target.removeEventListener?.('focus',onFocus);}};
}
