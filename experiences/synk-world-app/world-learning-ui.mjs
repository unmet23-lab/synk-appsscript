import {t,tMessage,hasString,formatDate} from '../brand-opening/world-lang.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 화면 언어(10-19 1판): 이름·값과 순서는 그대로 두고 보이는 글만 표(goal.*)에서 읽는다.
const REASON_IDS=['travel','life','people','exam','study','work','career','culture','hobby','other'];
const reasons=()=>Object.fromEntries(REASON_IDS.map(id=>[id,t(`goal.reason.${id}`)]));
const supportNames=()=>({choose:[t('goal.support.choose'),t('goal.support.chooseNote')],step:[t('goal.support.step'),t('goal.support.stepNote')],independent:[t('goal.support.independent'),t('goal.support.independentNote')]});
// 고르기: 알약 묶음(고른 것은 흰 바탕). 이름·값 순서는 시험이 읽으므로 바꾸지 않는다.
const radios=(name,options,value)=>(Array.isArray(options)?options:Object.entries(options)).map(([id,label])=>`<label class="study-pill"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span>${label}</span></label>`).join('');
// 도움 방식: 목록 줄(제목 + 설명 한 줄 + 체크).
const rows=(name,options,value)=>Object.entries(options).map(([id,[label,note]])=>`<label class="study-option"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('');

// WORLD supplies meaningful candidates; the existing Core decides among them.
// This controller owns no identity, grading, second event log, or server API.
// position: 「내 위치」 묶음(world-position-kit.mjs의 worldPosition — 계정 묶음·생활 묶음이 넘긴다). 없으면 그 판을 열지 않는다.
// audioUrl(path): 짧은 진단 듣기 문항의 녹음(게임 폴더 기준 경로, 예: korean-runner/assets/voice/…)을 이 화면에서 부를 주소로.
export function createWorldEducation({home,getProgress,engine,createPlan,launchGame,startLesson,startReview,prepare=async()=>{},position=null,audioUrl=path=>path,target=globalThis}){
 let stopped=false,coach=null,coachHost=null,current=null,refreshing=false;
 const owner=getProgress().owner;
 const empty=engine.engine.createGame({gameId:'world-home-empty',storage:null,historyComplete:false}).summary();
 const view=position?position.createView({t,has:hasString,formatDate}):null;
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
  // 「연습에서 본 것」 대신 「내 위치 보기」 한 줄(10-19 결정): 항목 지도의 세 칸 수를 미리 보이고, 누르면 내 위치 판이 열린다.
  let counts=null;try{if(view&&summary.evidenceComplete)counts=position.buildPositionMap({summary}).counts;}catch{counts=null;}
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
   ${view?`<section class="study-position"><p class="life-section-label">MY POSITION</p><button type="button" class="life-row study-position-row" data-view="position"><span class="life-row-copy"><strong>${t('position.open')}</strong><small>${escape(counts?t('position.summary',counts):t('position.row'))}</small></span></button></section>`:''}
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
 // ── 「내 위치」(10-19 결정 · 학습기준 §7-3) ──
 // 판: Core가 이미 읽은 TOPIK I 15개 항목 상태를 세 칸(혼자 해냄·연습 중·아직)으로 보이고, 칸마다 그렇게 본 근거를 단다.
 // 짧은 진단은 이 화면의 코치(world-home)에 제시 → (듣기면) 끝까지 들음 → 첫 답 순서로 남긴다 — 처음 보는 문항에 혼자 낸 첫 시도다.
 // 예상 급수는 문턱(TOPIK 형식 근거 30·영역별 10·90일) 전에는 보이지 않는다. 「아직 못 읽어요」를 고른 사람은 한글 진도부터.
 let diagnosed=false,positionOpen=0;
 const PANEL={type:'life-position',eyebrow:'MY POSITION',nav:'packs'};
 const panelNode=selector=>target.document?.querySelector(`#panel-content ${selector}`)||null;
 const failed=error=>home.toast(tMessage(error?.message)||t('position.failed'));
 // 한글 만나기가 진도를 두는 자리(hangul-stage/learning.mjs progressKey): 손님은 이 기기, 계정은 그 계정·학습 동의 판의 구역.
 // 계정인데 학습 호스트가 아직 없으면 자리를 모른다(null) — 손님 자리를 대신 읽지 않는다.
 function hangulStage(coachNow){
  if(owner!=='guest'&&!coachNow)return null;
  try{
   const key=position.hangulProgressKey(target,coachNow);if(!key)return null;
   const raw=target.localStorage?.getItem(key);
   return position.hangulStageProgress(raw?JSON.parse(raw):null,position.hangulLayer);
  }catch{return null;}
 }
 function positionData(coachNow){
  let summary=empty,events=[];
  try{summary=coachNow?.summary()||empty;events=coachNow?.events?.()||[];}catch{summary=empty;events=[];}
  const map=position.buildPositionMap({summary,events});
  let audioAvailable=true;try{audioAvailable=getProgress().learningProfileValues().audio!=='off';}catch{}
  // 노출을 모르면(null) 「처음 보는 문항」을 약속하지 않는다.
  const seen=item=>{try{return coachNow?coachNow.exposure(item).seen:null;}catch{return null;}};
  let plan=null;try{plan=position.selectDiagnostic({summary,items:position.items,seen,audioAvailable});}catch{plan=null;}
  // 지금 WORLD에는 TOPIK 형식(처음 보는 문항·실제 구성·시간 제한) 연습이 없어 근거는 빈 목록이다.
  const gate=position.estimateGate({evidence:[],asOf:new Date().toISOString()});
  return {map,plan,gate};
 }
 function showBoard(coachNow){
  check();
  const {map,plan,gate}=positionData(coachNow);
  let scope=null;try{scope=getProgress().status().scoped?'account':'device';}catch{}
  home.showPanel(t('position.title'),view.renderPositionBoard({map,plan,gate,catalog:position.label,diagnosed,scope}),PANEL);
  panelNode('[data-position-board]')?.focus?.({preventScroll:true});
  panelNode('[data-position-diagnostic]')?.addEventListener('click',()=>{try{startDiagnostic(coachNow,plan,map);}catch(error){failed(error);}},{once:true});
 }
 function showHangul(stage){
  home.showPanel(t('position.title'),view.renderHangulBoard({stage}),PANEL);
  panelNode('[data-position-board]')?.focus?.({preventScroll:true});
  panelNode('[data-position-hangul]')?.addEventListener('click',()=>{try{void Promise.resolve(launchGame('hangul')).catch(failed);}catch(error){failed(error);}},{once:true});
 }
 async function openPosition(){
  if(!position)return;
  check();const ticket=++positionOpen;
  // 계정의 학습 호스트를 먼저 세운다(다음 연습과 같다). 세우지 못해도 판은 열고, 기록이 덜 왔다고 알린다.
  try{await prepare();}catch{/* the board shows the records as incomplete */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still shows */}
  check();if(ticket!==positionOpen)return;
  let coachNow=null;try{coachNow=readCoach();}catch{coachNow=null;}
  let reading=null;try{reading=getProgress().hangulReading?.()||null;}catch{reading=null;}
  const stage=hangulStage(coachNow);
  if(position.showsHangulBoard({reading,stage})){showHangul(stage);return;}
  showBoard(coachNow);
 }
 // 진단 한 바퀴는 한 판 안에서 문항만 바꿔 그린다. 판을 닫거나 다른 판이 열리면(attachPanelResource) 보이던 문항은 건너뛴 것으로 남긴다.
 function startDiagnostic(coachNow,plan,map){
  check();
  if(!coachNow||plan?.status!=='ready'||!plan.items.length)return;
  const session=position.createDiagnosticSession({coach:coachNow,items:plan.items});
  const skillOf=id=>map.skills.find(skill=>skill.id===id)||{id};
  let clip=null,playing=false,notice='',ended=false;
  const silence=()=>{const sound=clip;clip=null;playing=false;try{sound?.pause();}catch{}};
  const stop=()=>{if(ended)return;ended=true;silence();try{session.stop();}catch{}try{coachNow.flush?.();}catch{}if(session.results().length)diagnosed=true;queueMicrotask(()=>refresh());};
  home.showPanel(t('position.diagnostic.title'),'<div class="wpos-stage" data-position-stage></div>',{...PANEL,eyebrow:'QUICK CHECK'});
  home.attachPanelResource?.({dispose:stop});
  const box=panelNode('[data-position-stage]');if(!box){stop();return;}
  // 배우기 판(life-*)은 내용 칸(#panel-content)이 스크롤되고, 다른 시트는 판 자체가 스크롤된다. 둘 다 맨 위로.
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  // focus: 새 문항이면 항목 이름으로, 같은 문항을 다시 그릴 때(듣기 시작·끝)는 고른 곳으로 초점을 옮긴다.
  function paint(focus='.wpos-run-skill'){
   const now=session.current;if(!now){finish();return;}
   box.innerHTML=view.renderDiagnosticItem({view:now,skill:skillOf(now.item.skillId),notice,playing});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  function advance(message=''){
   notice=message;
   if(!session.next()){finish();return;}
   paint();top();
  }
  function finish(){
   if(ended&&!box.isConnected)return;
   ended=true;silence();try{coachNow.flush?.();}catch{}
   const results=session.results();if(results.length)diagnosed=true;
   let after=map;try{after=position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[]});}catch{after=map;}
   box.innerHTML=view.renderDiagnosticDone({map:after,results});
   box.querySelector('[data-position-done]')?.focus?.({preventScroll:true});top();
   queueMicrotask(()=>refresh());
  }
  // 소리는 실제 재생기의 끝(ended)·실패(error)만 진단에 알린다(재생을 눌렀다는 것만으로 들었다고 하지 않는다).
  function listen(){
   const now=session.current;if(!now||now.answered||playing||!now.item.audio)return;
   session.replay();notice='';
   let sound;try{sound=new target.Audio(audioUrl(now.item.audio));}catch{session.delivery('failed');paint('[data-position-listen]');return;}
   clip=sound;playing=true;paint('[data-position-listen]');
   const done=status=>{if(clip!==sound)return;clip=null;playing=false;if(ended)return;try{session.delivery(status);}catch{}paint(status==='completed'?'.wpos-choice:not([disabled])':'[data-position-listen]');};
   sound.addEventListener('ended',()=>done('completed'),{once:true});
   sound.addEventListener('error',()=>done('failed'),{once:true});
   Promise.resolve(sound.play()).catch(()=>done('failed'));
  }
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||button.disabled||ended&&!button.hasAttribute('data-position-back'))return;
   try{
    check();
    if(button.dataset.positionChoice){silence();if(session.answer(button.dataset.positionChoice))advance(t('position.diagnostic.saved'));else paint();}
    else if(button.hasAttribute('data-position-listen'))listen();
    else if(button.hasAttribute('data-position-skip')){silence();session.skip();advance('');}
    else if(button.hasAttribute('data-position-stop')){stop();showBoard(readCoach());}
    else if(button.hasAttribute('data-position-back'))showBoard(readCoach());
   }catch(error){stop();failed(error);}
  });
  advance('');
 }
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 return {next,open,refresh,applyPreferences,...(position?{position:openPosition}:{}),presentation(){check();const values=settingsFor(getProgress().learningProfileValues());return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),dispose(){stopped=true;coach?.disconnect?.();target.removeEventListener?.('focus',onFocus);}};
}
