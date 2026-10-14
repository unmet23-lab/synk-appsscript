const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reasons={travel:'여행에서 말하기',life:'한국 생활에 적응하기',people:'사람들과 이야기하기',exam:'TOPIK 기초 준비',study:'학교에서 공부하기',work:'직장에서 말하기',career:'진로 준비하기',culture:'한국 문화 즐기기',hobby:'취미로 배우기',other:'아직 찾아보는 중'};
const supportNames={choose:'해 보면서 맞추기',step:'한 단계씩 도움받기',independent:'먼저 혼자 해 보기'};
const stateNames={practice:'다시 연습할 부분',supported:'도움과 함께 연습한 부분',review:'다시 확인할 때',checking:'새 문제로 확인하는 중','recent-independent':'최근 새 문제를 혼자 풀었어요'};
const radios=(name,options,value)=>Object.entries(options).map(([id,label])=>`<label class="study-option"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span>${label}</span></label>`).join('');

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
  if(!selected){home.toast(plan?.reason||'지금 조건에 맞는 연습을 찾지 못했어요. 학습 설정에서 시간과 소리를 바꿀 수 있어요.');return;}
  if(applyPreferences()===false){home.toast('도움 방식 저장을 다시 확인해 주세요.');return;}
  if(selected.route==='game')return launchGame(selected.gameId);
  if(selected.route==='review')return startReview(selected.lessonId,selected.reviewIds);
  return startLesson(selected.lessonId);
 }
 function open({continueAfter=false}={}){
  check();const progress=getProgress(),saved=progress.learningProfile(),profile=saved.profile,values=progress.learningProfileValues();let revision=profile.revision;
  let summary=empty;try{summary=readCoach()?.summary()||empty;}catch{}
  const observed=summary.evidenceComplete?summary.skills.filter(s=>stateNames[s.status]).slice(0,4):[];
  const option=(id,label)=>`<option value="${id}" ${values.primaryReason===id||!values.primaryReason&&values.reasons?.[0]===id?'selected':''}>${label}</option>`;
  // 나침반 펠트 사진은 생활 화면이 판에 심어 둔 --life-print-goals를 쓴다(자산 경로를 이 모듈이 따로 풀지 않는다).
  home.showPanel('나에게 맞는 한국어',`<form id="world-study-form" class="study-form">
   <div class="life-poster study-poster"><span class="w-print study-print" aria-hidden="true"><i></i></span><small class="life-poster-label">MY GOALS</small><strong class="life-poster-word">학습 목표</strong><p class="study-intro life-poster-sub">지금 필요한 한국어부터 시작해요. 언제든 바꿀 수 있고, 건너뛰어도 배울 수 있어요.</p></div>
   <label class="study-field"><strong>지금 가장 배우고 싶은 이유</strong><select name="reason"><option value="">아직 고르지 않을게요</option>${Object.entries(reasons).map(([id,label])=>option(id,label)).join('')}</select></label>
   <fieldset><legend>어떻게 도와줄까요?</legend><div class="study-options">${radios('support',supportNames,values.support||'choose')}</div></fieldset>
   <fieldset><legend>설명은 어느 정도가 편해요?</legend><div class="study-options">${radios('explanation',{brief:'짧게 보고, 필요하면 더 보기',standard:'기본 설명 보기',detailed:'이유도 펼쳐서 보기'},values.explanation||'brief')}</div></fieldset>
   <div class="study-today"><strong>오늘의 상황</strong><p>시간과 소리 설정은 오늘만 반영해요.</p><div class="study-two-fields"><label>공부할 시간<select name="minutes"><option value="">정하지 않았어요</option>${[3,5,10].map(n=>`<option value="${n}" ${values.minutes===n?'selected':''}>${n}분 정도</option>`).join('')}</select></label><label>소리 듣기<select name="audio"><option value="available" ${values.audio!=='off'?'selected':''}>들을 수 있어요</option><option value="off" ${values.audio==='off'?'selected':''}>지금은 어려워요</option></select></label></div></div>
   <label class="study-consent"><input type="checkbox" name="consent" ${profile.consent?'checked':''}><span>목표와 도움 선호를 ${progress.status().scoped?'내 계정':'이 기기'}에 기억하고 맞춤 추천에 사용하기</span></label>
   <p class="study-scope">성격이나 급수를 판정하지 않아요. 설정을 지워도 기존 학습 진도와 복습 기록은 남아요.</p>
   <p class="study-save-status" role="status">${escape(progress.status().message)}</p>
   <div class="life-actions"><button class="felt-button" type="submit">저장하고 ${continueAfter?'시작하기':'추천 보기'} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-study-skip>${profile.status==='new'?'지금은 건너뛰기':'돌아가기'}</button></div>
   ${profile.status==='active'?'<div class="study-controls"><button type="button" class="quiet-button" data-study-clear="disable">목표·선호 사용 끄기</button><button type="button" class="quiet-button" data-study-clear="delete">목표와 선호 지우기</button></div>':''}
   <section class="study-understanding"><h3>연습에서 확인한 것</h3>${observed.length?`<ul>${observed.map(s=>`<li><strong>${escape(s.label)}</strong><span>${stateNames[s.status]}</span></li>`).join('')}</ul>`:'<p>새 문제를 풀면서 조금씩 확인해요. 기록이 없다는 이유로 약하다고 판단하지 않아요.</p>'}<p>혼자 푼 답과 도움받은 답, 조작·소리 문제를 구분해서 다음 연습에 반영해요.</p></section>
  </form>`,{type:'world-study',eyebrow:'MY KOREAN',nav:'me'});
  const form=target.document.querySelector('#world-study-form');if(!form)return;
  const status=form.querySelector('.study-save-status');let busy=false;
  const valid=()=>{check();if(progress!==getProgress()||!form.isConnected)throw Error('설정을 다시 열어 주세요.');};
  const run=async operation=>{if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{valid();operation();revision=progress.learningProfile().profile.revision;await progress.flush();valid();if(applyPreferences()===false)throw Error('도움 방식 저장을 다시 확인해 주세요.');refresh();home.closePanel();if(continueAfter)await next();else home.toast('지금 목표와 학습 기록으로 추천을 바꿨어요.');}catch(error){if(form.isConnected)status.textContent=error.message||'저장을 확인한 뒤 다시 시도해 주세요.';}finally{busy=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.elements.consent.checked){status.textContent='기억해도 괜찮다면 선택해 주세요. 건너뛰어도 기본 연습을 할 수 있어요.';return;}
   const reason=form.elements.reason.value,minutes=Number(form.elements.minutes.value);
   void run(()=>progress.updateLearningProfile({consent:true,expectedRevision:revision,values:{reasons:reason?[reason]:null,primaryReason:reason||null,goal:null,support:form.elements.support.value,explanation:form.elements.explanation.value},today:{...(minutes?{minutes}:{}),audio:form.elements.audio.value}}));
  });
  form.querySelector('[data-study-skip]').addEventListener('click',()=>{if(profile.status==='new')void run(()=>progress.clearLearningProfile({mode:'skip',expectedRevision:revision}));else home.closePanel();});
  form.querySelectorAll('[data-study-clear]').forEach(button=>button.addEventListener('click',()=>void run(()=>progress.clearLearningProfile({mode:button.dataset.studyClear,expectedRevision:revision}))));
 }
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 return {next,open,refresh,applyPreferences,presentation(){check();const values=getProgress().learningProfileValues();return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),dispose(){stopped=true;coach?.disconnect?.();target.removeEventListener?.('focus',onFocus);}};
}
