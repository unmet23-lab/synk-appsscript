import {t,tMessage} from '../brand-opening/world-lang.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 화면 언어(10-19 1판): 이름·값과 순서는 그대로 두고 보이는 글만 표(goal.*)에서 읽는다.
const REASON_IDS=['travel','life','people','exam','study','work','career','culture','hobby','other'];
const reasons=()=>Object.fromEntries(REASON_IDS.map(id=>[id,t(`goal.reason.${id}`)]));
const supportNames=()=>({choose:[t('goal.support.choose'),t('goal.support.chooseNote')],step:[t('goal.support.step'),t('goal.support.stepNote')],independent:[t('goal.support.independent'),t('goal.support.independentNote')]});
const STATES=new Set(['practice','supported','review','checking','recent-independent']);
const stateName=status=>STATES.has(status)?t(`goal.state.${status}`):'';
// 고르기: 알약 묶음(고른 것은 흰 바탕). 이름·값 순서는 시험이 읽으므로 바꾸지 않는다.
const radios=(name,options,value)=>(Array.isArray(options)?options:Object.entries(options)).map(([id,label])=>`<label class="study-pill"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span>${label}</span></label>`).join('');
// 도움 방식: 목록 줄(제목 + 설명 한 줄 + 체크).
const rows=(name,options,value)=>Object.entries(options).map(([id,[label,note]])=>`<label class="study-option"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('');

// WORLD supplies meaningful candidates; the existing Core decides among them.
// This controller owns no identity, grading, second event log, or server API.
export function createWorldEducation({home,getProgress,engine,createPlan,launchGame,startLesson,startReview,prepare=async()=>{},target=globalThis}){
 let stopped=false,coach=null,coachHost=null,current=null,refreshing=false;
 const owner=getProgress().owner;
 const empty=engine.engine.createGame({gameId:'world-home-empty',storage:null,historyComplete:false}).summary();
 const check=()=>{if(stopped||getProgress()?.owner!==owner)throw Error('학습 계정이 바뀌었어요. 설정을 다시 열어 주세요.');};
 function readCoach(){
  check();const source=target.SYNKLearningHost||null;
  if(!source&&owner!=='guest')return null;
  if(coach&&coachHost===source){try{coach.summary();return coach;}catch{coach.disconnect?.();coach=null;}}
  if(coachHost!==source){coach?.disconnect?.();coach=null;coachHost=source;}
  if(!coach)coach=source?source.createGame({gameId:'world-home'},engine.engine.createGame,engine.createLearningSync):engine.engine.createGame({gameId:'world-home',storage:target.localStorage});
  return coach;
 }
 // Restoring a product profile is a read, not a new account-wide choice.
 // Launchers keep this hook; only the form's explicit save/clear may write Core.
 function applyPreferences({explicit=false}={}){
  if(!explicit){check();return true;}
  check();const progress=getProgress(),profile=progress.learningProfile().profile;
  if(['new','skipped'].includes(profile.status))return true;
  const values=progress.learningProfileValues(),source=target.SYNKLearningHost||null;
  const presentation=Object.fromEntries(['support','explanation','textSize','motion'].filter(k=>values[k]).map(k=>[k,values[k]]));
  const preferences=source?.preferences?.()||readCoach();
  if(!preferences)return true;
  // The account's presentation is shared with 「내 성향」 and the games: a save puts this form's
  // choices over it, and clearing the goals forgets only the help style and explanation this form
  // shows. Text size, motion and sound chosen elsewhere stay as they are.
  const current=preferences.presentation?.()||{};
  const next=Object.keys(presentation).length?{...current,...presentation}:Object.fromEntries(Object.entries(current).filter(([k])=>!['support','explanation'].includes(k)));
  if(preferences.setPresentation(Object.keys(next).length?next:null)===false)return false;
  return true;
 }
 // Help style and explanation length are account-wide choices: the learning memory's presentation,
 // which this form and the account's 「내 성향」 both save, leads. WORLD's own answers stand in only
 // where nothing is chosen there, so a choice made elsewhere is what lessons, plans and this form use.
 function settingsFor(values){
  let chosen=null;
  try{const source=target.SYNKLearningHost||null;chosen=(source?.preferences?.()||readCoach())?.presentation?.()||null;}catch{chosen=null;}
  const pick=(key,list)=>chosen&&list.includes(chosen[key])?{[key]:chosen[key]}:{};
  return {...values,...pick('support',['choose','step','independent']),...pick('explanation',['brief','standard','detailed'])};
 }
 function refresh(){
  if(stopped||refreshing)return current;refreshing=true;
  try{
   check();const progress=getProgress(),save=progress.status();
   if(['unreadable','conflict','loading'].includes(save.phase)||save.rejected){current=null;home.updateStudy?.(null);return null;}
   let summary=empty,coachNow=null;
   try{coachNow=readCoach();summary=coachNow?.summary()||empty;applyPreferences();}catch{/* Unavailable account evidence remains unknown. */}
   // The coach's own call also hands Core what was already presented, so an activity whose items are
   // all used (practice.spent) is told apart from one that still has new items. Any failure keeps the plain call.
   const recommendActivities=input=>{if(summary!==empty&&typeof coachNow?.recommendActivities==='function'){try{return coachNow.recommendActivities(input.candidates,{settings:input.settings,at:input.at});}catch{}}return engine.recommendActivities(input);};
   current=createPlan({summary,progress:progress.exportSnapshot(),settings:settingsFor(progress.learningProfileValues()),now:Date.now(),recommendActivities});
   home.updateStudy?.(current);return current;
  }catch{current=null;home.updateStudy?.(null);return null;}finally{refreshing=false;}
 }
 async function next(){
  check();const profile=getProgress().learningProfile().profile;
  // 첫 실행에 「아직 못 읽어요」를 고른 사람에게 한국어 글로 된 목표 창을 먼저 내밀지 않는다. 한글 만나기가 먼저다(10-19).
  let reading=null;try{reading=getProgress().hangulReading?.()?.answer||null;}catch{}
  if(profile.status==='new'&&reading!=='new'){open({continueAfter:true});return;}
  await prepare();check();
  // The account's first memory read is bounded; wait for it so a help style chosen on another
  // screen or device is the one this plan uses. Device-local practice still starts without it.
  try{await target.SYNKLearningHost?.ready?.();}catch{/* the launcher reports account problems */}
  check();const plan=refresh(),selected=plan?.selected;
  if(!selected){home.toast(plan?.reason||'지금 조건에 맞는 연습이 없어요. 학습 목표에서 시간과 소리를 바꿔 보세요.');return;}
  if(applyPreferences()===false){home.toast('도움 방식 저장을 다시 확인해 주세요.');return;}
  if(selected.route==='game')return launchGame(selected.gameId);
  if(selected.route==='review')return startReview(selected.lessonId,selected.reviewIds);
  return startLesson(selected.lessonId);
 }
 function open({continueAfter=false}={}){
  check();const progress=getProgress(),saved=progress.learningProfile(),profile=saved.profile,values=settingsFor(progress.learningProfileValues());let revision=profile.revision;
  let summary=empty;try{summary=readCoach()?.summary()||empty;}catch{}
  const observed=summary.evidenceComplete?summary.skills.filter(s=>STATES.has(s.status)).slice(0,4):[];
  const reason=values.primaryReason||values.reasons?.[0]||'';
  // 폼 느낌을 걷어낸 목록: 알약 묶음(이유·설명·시간·소리) · 목록 줄(도움 방식) · 스위치(기억하기). 사진은 생활 화면이 심어 둔 나침반(--life-print-goals).
  home.showPanel(t('goal.title'),`<form id="world-study-form" class="study-form">
   <div class="life-poster study-poster"><span class="w-print study-print" aria-hidden="true"><i></i></span><small class="life-poster-label">MY GOALS</small><strong class="life-poster-word">${t('goal.poster')}</strong><p class="study-intro life-poster-sub">${t('goal.intro')}</p></div>
   <fieldset class="study-group"><legend>${t('goal.reason')}</legend><div class="study-pills study-wrap">${radios('reason',[['',t('goal.reason.none')],...Object.entries(reasons())],reason)}</div></fieldset>
   <fieldset class="study-group"><legend>${t('goal.support')}</legend><div class="study-options">${rows('support',supportNames(),values.support||'choose')}</div></fieldset>
   <fieldset class="study-group"><legend>${t('goal.explanation')}</legend><div class="study-pills study-segment">${radios('explanation',{brief:t('goal.explanation.brief'),standard:t('goal.explanation.standard'),detailed:t('goal.explanation.detailed')},values.explanation||'brief')}</div></fieldset>
   <div class="study-today"><p class="life-section-label">TODAY</p><p>${t('goal.today.note')}</p>
    <fieldset class="study-group"><legend>${t('goal.minutes')}</legend><div class="study-pills study-segment">${radios('minutes',[['',t('goal.minutes.any')],...['3','5','10'].map(n=>[n,t('goal.minutes.n',{n})])],values.minutes?String(values.minutes):'')}</div></fieldset>
    <fieldset class="study-group"><legend>${t('goal.audio')}</legend><div class="study-pills study-segment">${radios('audio',{available:t('goal.audio.available'),off:t('goal.audio.off')},values.audio==='off'?'off':'available')}</div></fieldset>
   </div>
   <label class="study-consent"><input type="checkbox" name="consent" ${profile.consent?'checked':''}><span><strong>${t(progress.status().scoped?'goal.consent.account':'goal.consent.device')}</strong><small>${t('goal.consent.note')}</small></span></label>
   <p class="study-scope">${t(progress.status().scoped?'goal.scope.account':'goal.scope.device')}</p>
   <p class="study-save-status" role="status">${escape(tMessage(progress.status().message))}</p>
   <div class="life-actions"><button class="felt-button" type="submit">${t(continueAfter?'goal.saveStart':'goal.save')} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-study-skip>${t(profile.status==='new'?'goal.skip':'goal.close')}</button></div>
   ${profile.status==='active'?`<div class="study-controls"><button type="button" class="quiet-button" data-study-clear="disable">${t('goal.disable')}</button><button type="button" class="quiet-button" data-study-clear="delete">${t('goal.delete')}</button></div>`:''}
   <section class="study-understanding"><h3>${t('goal.seen')}</h3>${observed.length?`<ul>${observed.map(s=>`<li><strong>${escape(s.label)}</strong><span>${stateName(s.status)}</span></li>`).join('')}</ul>`:`<p>${t('goal.seen.empty')}</p>`}<p>${t('goal.seen.note')}</p></section>
  </form>`,{type:'world-study',eyebrow:'GOALS',nav:'me'});
  const form=target.document.querySelector('#world-study-form');if(!form)return;
  const status=form.querySelector('.study-save-status');let busy=false;
  const valid=()=>{check();if(progress!==getProgress()||!form.isConnected)throw Error('설정을 다시 열어 주세요.');};
  const run=async operation=>{if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{valid();operation();revision=progress.learningProfile().profile.revision;await progress.flush();valid();if(progress.learningProfile().profile.status!=='skipped'){await prepare();valid();try{await target.SYNKLearningHost?.ready?.();}catch{/* the save still goes to this device */}valid();if(applyPreferences({explicit:true})===false)throw Error('도움 방식 저장을 다시 확인해 주세요.');}refresh();home.closePanel();if(continueAfter)await next();else home.toast(t('goal.saved'));}catch(error){if(form.isConnected)status.textContent=tMessage(error.message)||t('goal.retry');}finally{busy=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.elements.consent.checked){status.textContent=t('goal.needConsent');return;}
   const reason=form.elements.reason.value,minutes=Number(form.elements.minutes.value);
   void run(()=>progress.updateLearningProfile({consent:true,expectedRevision:revision,values:{reasons:reason?[reason]:null,primaryReason:reason||null,goal:null,support:form.elements.support.value,explanation:form.elements.explanation.value},today:{...(minutes?{minutes}:{}),audio:form.elements.audio.value}}));
  });
  form.querySelector('[data-study-skip]').addEventListener('click',()=>{if(profile.status==='new')void run(()=>progress.clearLearningProfile({mode:'skip',expectedRevision:revision}));else home.closePanel();});
  form.querySelectorAll('[data-study-clear]').forEach(button=>button.addEventListener('click',()=>void run(()=>progress.clearLearningProfile({mode:button.dataset.studyClear,expectedRevision:revision}))));
 }
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 return {next,open,refresh,applyPreferences,presentation(){check();const values=settingsFor(getProgress().learningProfileValues());return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),dispose(){stopped=true;coach?.disconnect?.();target.removeEventListener?.('focus',onFocus);}};
}
