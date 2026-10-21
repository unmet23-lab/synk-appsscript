import {t,tMessage,hasString,formatDate} from '../brand-opening/world-lang.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 화면 언어(10-19 1판): 이름·값과 순서는 그대로 두고 보이는 글만 표(goal.*)에서 읽는다.
const REASON_IDS=['travel','life','people','exam','study','work','career','culture','hobby','other'];
const reasons=()=>Object.fromEntries(REASON_IDS.map(id=>[id,t(`goal.reason.${id}`)]));
const supportNames=()=>({choose:[t('goal.support.choose'),t('goal.support.chooseNote')],step:[t('goal.support.step'),t('goal.support.stepNote')],independent:[t('goal.support.independent'),t('goal.support.independentNote')]});
// 고르기: 알약 묶음(고른 것은 흰 바탕). 이름·값 순서는 시험이 읽으므로 바꾸지 않는다.
const radios=(name,options,value,extra=()=>'')=>(Array.isArray(options)?options:Object.entries(options)).map(([id,label])=>`<label class="study-pill"${extra(id)}><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span>${label}</span></label>`).join('');
// 도움 방식: 목록 줄(제목 + 설명 한 줄 + 체크).
const rows=(name,options,value)=>Object.entries(options).map(([id,[label,note]])=>`<label class="study-option"><input type="radio" name="${name}" value="${id}" ${value===id?'checked':''}><span><strong>${label}</strong><small>${note}</small></span></label>`).join('');
// 시험 정보(계약 r2 「시험정보」 · 10-20 결정): 「시험·자격 준비」를 고른 사람에게만 묻고 모두 고르지 않아도 된다.
// 값은 Core 선택 응답 판(atlas/personalization.js FIELDS)에 그대로 저장되고, 계획(world-exam-plan.mjs)이 읽는다. 급수를 매기지 않는다.
const EXAM_TYPES=['topik1','topik2','unknown'],EXAM_MODES=['pbt','ibt','unknown'],EXAM_WEEKLY=['30','60','120','180'];
const EXAM_GRADES={topik1:[1,2],topik2:[3,4,5,6]};
const KST=9*3600000;
// 시험일 고르기: 이번 달부터 18달. 날은 몰라도 된다(월까지만).
function examMonths(now){
 const base=new Date(now+KST),list=[];
 for(let i=0;i<18;i++){const year=base.getUTCFullYear()+Math.floor((base.getUTCMonth()+i)/12),month=(base.getUTCMonth()+i)%12+1;
  list.push([`${year}-${String(month).padStart(2,'0')}`,formatDate(Date.UTC(year,month-1,15)-KST,{year:'numeric',month:'long'})]);}
 return list;
}

// WORLD supplies meaningful candidates; the existing Core decides among them.
// This controller owns no identity, grading, second event log, or server API.
// position: 「내 위치」 묶음(world-position-kit.mjs의 worldPosition — 계정 묶음·생활 묶음이 넘긴다). 없으면 그 판을 열지 않는다.
//  10-20부터 그 묶음에 읽기 짧은 연습(position.practice)과 시험 계획(position.exam)도 있다.
// audioUrl(path): 짧은 진단 듣기 문항의 녹음(게임 폴더 기준 경로, 예: korean-runner/assets/voice/…)을 이 화면에서 부를 주소로.
// readClasswork(): 온라인 반 「이번 주 과제」(교사 배정)의 이번 주 갈래 [{kind:'reading'|'writing', done}] — 계획이 그 주의 연습으로 먼저 센다.
// writingPractice: 쓰기 연습 후보(③ 세션의 world-writing-practice.mjs가 생기면 호스트가 넘긴다, 없으면 TOPIK II 계획에서 쓰기를 빼 둔다).
export function createWorldEducation({home,getProgress,engine,createPlan,launchGame,startLesson,startReview,prepare=async()=>{},position=null,audioUrl=path=>path,readHangulProgress=null,
 readClasswork=null,writingPractice=null,target=globalThis}){
 let stopped=false,coach=null,coachHost=null,practiceCoach=null,practiceHost=null,current=null,refreshing=false,classwork={at:0,rows:[],pending:null};
 const owner=getProgress().owner;
 const empty=engine.engine.createGame({gameId:'world-home-empty',storage:null,historyComplete:false}).summary();
 const view=position?position.createView({t,has:hasString,formatDate}):null;
 const check=()=>{if(stopped||getProgress()?.owner!==owner)throw Error('학습 계정이 바뀌었어요. 설정을 다시 열어 주세요.');};
 // 학습 기록 코치: 홈·짧은 진단은 'world-home', 읽기 짧은 연습은 'world-practice'(근거 줄이 어디서 낸 답인지 가른다).
 // 둘 다 같은 기기·계정 기록(같은 열쇠)을 쓰므로 노출과 상태는 서로의 답을 그대로 본다.
 function coachFor(gameId,held,setHeld){
  check();const source=target.SYNKLearningHost||null;
  if(!source&&owner!=='guest')return null;
  let [instance,host]=held();
  if(instance&&host===source){try{instance.summary();return instance;}catch{instance.disconnect?.();instance=null;}}
  if(host!==source){instance?.disconnect?.();instance=null;host=source;}
  if(!instance)instance=source?source.createGame({gameId},engine.engine.createGame,engine.createLearningSync):engine.engine.createGame({gameId,storage:target.localStorage});
  setHeld(instance,host);return instance;
 }
 const readCoach=()=>coachFor('world-home',()=>[coach,coachHost],(a,b)=>{coach=a;coachHost=b;});
 const readPracticeCoach=()=>coachFor(position?.practice?.PRACTICE_POLICY?.gameId||'world-practice',()=>[practiceCoach,practiceHost],(a,b)=>{practiceCoach=a;practiceHost=b;});
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
 // 노출을 모르면(null) 「처음 보는 문항」을 약속하지 않는다.
 const seenBy=coachNow=>item=>{try{return coachNow?coachNow.exposure(item).seen:null;}catch{return null;}};
 // TOPIK I 항목 수(Strata 지도 그대로 — 항목이 늘면 글도 따라간다).
 const topikTotal=()=>(engine.SKILLS||[]).filter(node=>node?.kind==='skill'&&/^ko\.(listening|reading)\.[a-z]+$/.test(node.id||'')).length||15;
 // 쓰기 연습 후보: 호스트가 함수(지금 열 수 있는 것)나 목록으로 넘긴다.
 const writingList=()=>{let value=null;try{value=typeof writingPractice?.candidates==='function'?writingPractice.candidates():writingPractice?.candidates;}catch{value=null;}return Array.isArray(value)?value.filter(row=>row&&typeof row.id==='string'&&typeof row.route==='string'&&Number.isFinite(row.minutes)):[];};
 // 쓰기 후보의 한국어 이름(홈이 화면 언어로 바꾼다 · home.mjs planLabel).
 const writingLabel=route=>{const type=String(route||'').split(':')[1],key=type==='mock'?'writing.mock.title':`writing.type.${type}`;return hasString(key)?`${t('writing.title',undefined,'ko')} · ${t(key,undefined,'ko')}`:String(route||'');};
 const skillLabel=id=>hasString(`position.skill.${id}`)?t(`position.skill.${id}`,undefined,'ko'):id;
 // 반 과제: 열 때마다 서버에 묻지 않고 10분 동안 같은 답을 쓴다. 못 읽으면 반 과제 없이 계획한다.
 function classworkRows(){
  if(typeof readClasswork!=='function')return [];
  if(!classwork.pending&&Date.now()-classwork.at>600000){
   classwork.pending=Promise.resolve().then(()=>readClasswork()).then(rows=>{if(stopped)return;classwork={at:Date.now(),rows:Array.isArray(rows)?rows:[],pending:null};queueMicrotask(()=>{refresh();if(panelNode('[data-plan-board]'))openPlan({keepScroll:true});});},
    ()=>{classwork={at:Date.now(),rows:[],pending:null};});
  }
  return classwork.rows;
 }
 // 추천 한 번: 읽기 짧은 연습·짧은 진단 후보를 더하고, 시험을 고른 사람은 이번 주 계획을 세워 그 초점을 Core에 넘긴다(순위는 Core).
 function planWith({summary,coachNow,progress,values,recommendActivities}){
  const seen=seenBy(coachNow),extra=[],now=Date.now();
  const practice=position?.practice;
  if(practice&&coachNow&&summary.evidenceComplete)extra.push(...practice.practiceCandidates({pool:practice.pool,seen,summary,labels:Object.fromEntries(practice.pool.map(item=>[item.skillId,skillLabel(item.skillId)]))}));
  const exam=position?.exam?.examInfo(values)||null;
  let diagnostic=null;
  if(exam&&position&&coachNow){try{diagnostic=position.selectDiagnostic({summary,items:position.items,seen,audioAvailable:values.audio!=='off'});}catch{diagnostic=null;}}
  if(exam&&diagnostic?.status==='ready'&&typeof position.checkCandidate==='function')extra.push(position.checkCandidate());
  // 쓰기 연습(③ world-writing-practice.mjs WRITING_CANDIDATES): TOPIK II를 고른 사람만. 쓰기 항목(ko2.writing.*)은 아직 WORLD의 Core 지도에 없어
  // 학습 항목을 겨누지 않는 후보로 넘긴다(관측하지 않은 쓰기를 약점으로 세지 않는다). 여는 길은 호스트의 openWriting(route)다.
  const writing=exam?.type==='topik2'?writingList().map(row=>({id:row.id,label:writingLabel(row.route),route:'writing',routeId:row.route,minutes:row.minutes,minutesEstimated:true,targets:[],goals:['exam','prepare','writing'],audioRequired:false,modality:'writing'})):[];
  extra.push(...writing);
  const base=createPlan({summary,progress:progress.exportSnapshot(),settings:values,now,recommendActivities,extra});
  if(!exam)return base;
  // 지금 열 수 있는 연습: 읽기는 항목별 새 문항 수, 듣기는 새 문항이 남은 게임(손님에게 닫힌 게임은 뺀다).
  const listening={};
  for(const candidate of base.candidates||[]){
   if(candidate.route!=='game'||candidate.modality!=='listening'||candidate.available===false)continue;
   for(const target of candidate.targets||[])if(seen({itemKey:target.itemKey||target.id,familyKey:target.familyKeys?.[0]})===false)for(const id of target.skillIds||[]){listening[id]=listening[id]||[];if(!listening[id].includes(candidate.id))listening[id].push(candidate.id);}
  }
  let events=[];try{events=coachNow?.events?.()||[];}catch{events=[];}
  const week=position.exam.examWeek(now);
  // 쓰기 과제마다 겨누는 항목(숙제는 그 항목을 겨누는 과제만)과, 다음 확인 간격을 잴 지난 다시 확인 시각.
  const writingAvailable=exam.type==='topik2'?writingList().map(row=>({id:row.id,routeId:row.route,skillIds:(Array.isArray(row.targets)?row.targets:[]).filter(id=>typeof id==='string')})):[];
  let lastCheckAt=null;try{lastCheckAt=position.exam.lastRecheck?.({events,before:week.start})??null;}catch{lastCheckAt=null;}
  // 쓰기 연습은 아직 Trail에 남지 않아 기기 기록의 규칙 점검 시각으로 센다(③ readWritingSummary times).
  let writingTimes=[];if(exam.type==='topik2'&&typeof writingPractice?.attempts==='function'){try{const times=writingPractice.attempts();writingTimes=Array.isArray(times)?times:[];}catch{writingTimes=[];}}
  const examPlan=position.exam.buildExamPlan({exam,summary,now,audioAvailable:values.audio!=='off',classwork:classworkRows(),lastCheckAt,
   done:position.exam.weekActivity({events,progress:progress.exportSnapshot(),week,extra:writingTimes.length?[{area:'writing',times:writingTimes}]:[]}),
   available:{reading:practice?practice.practiceSupply({pool:practice.pool,seen}):{},listening,recheck:diagnostic?.items?.length||0,life:true,
    writing:writingAvailable}});
  return createPlan({summary,progress:progress.exportSnapshot(),settings:values,now,recommendActivities,extra,examPlan});
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
   current=planWith({summary,coachNow:summary===empty?null:coachNow,progress,values:settingsFor(progress.learningProfileValues()),recommendActivities});
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
  return launch(selected);
 }
 // 고른 활동 열기: 게임·복습·레슨, 읽기 짧은 연습(그 항목), 짧은 진단(내 위치에서 바로 시작), 쓰기 연습(호스트가 연다).
 function launch(selected){
  if(selected.route==='game')return launchGame(selected.gameId);
  if(selected.route==='review')return startReview(selected.lessonId,selected.reviewIds);
  if(selected.route==='practice')return startPractice(selected.skillId);
  if(selected.route==='position')return openPosition({start:true});
  if(selected.route==='writing'&&typeof writingPractice?.open==='function')return writingPractice.open(selected.routeId);
  return startLesson(selected.lessonId);
 }
 function open({continueAfter=false}={}){
  check();const progress=getProgress(),saved=progress.learningProfile(),profile=saved.profile,values=settingsFor(progress.learningProfileValues());let revision=profile.revision;
  let summary=empty;try{summary=readCoach()?.summary()||empty;}catch{}
  // 「연습에서 본 것」 대신 「내 위치 보기」 한 줄(10-19 결정): 항목 지도의 세 칸 수를 미리 보이고, 누르면 내 위치 판이 열린다.
  let map=null;try{if(view&&summary.evidenceComplete)map=position.buildPositionMap({summary,policy:engine.POLICY});}catch{map=null;}
  const reason=values.primaryReason||values.reasons?.[0]||'';
  const scoped=progress.status().scoped,consentName=t(scoped?'goal.consent.account':'goal.consent.device');
  // 시험 칸: 지금 값과, 시험일이 지났으면 「시험은 어땠어요?」(다음 목표 묻기).
  const now=Date.now(),examDate=typeof values.examDate==='string'?values.examDate:'',month=examDate.slice(0,7),day=examDate.length>7?String(Number(examDate.slice(8))):'';
  const past=position?.exam&&examDate?position.exam.examPhase(examDate,now).phase==='past':false;
  const months=examMonths(now);if(month&&!months.some(([value])=>value===month))months.unshift([month,formatDate(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-1,15)-KST,{year:'numeric',month:'long'})]);
  const gradeOptions=[...EXAM_GRADES.topik1,...EXAM_GRADES.topik2].map(n=>[String(n),t('goal.exam.grade.n',{n})]);
  const gradeType=n=>EXAM_GRADES.topik1.includes(Number(n))?'topik1':'topik2';
  const examSection=position?.exam?`<section class="study-exam" data-study-exam${reason==='exam'?'':' hidden'}><p class="life-section-label">EXAM</p><p class="study-exam-note">${t('goal.exam.note')}</p>${past?`<p class="study-exam-past" data-study-exam-past>${t('goal.exam.past')}</p>`:''}
    <fieldset class="study-group"><legend>${t('goal.exam.type')}</legend><div class="study-pills study-wrap">${radios('examType',EXAM_TYPES.map(id=>[id,t(`goal.exam.type.${id}`)]),values.examType||'')}</div></fieldset>
    <fieldset class="study-group" data-study-grade${['topik1','topik2'].includes(values.examType)?'':' hidden'}><legend>${t('goal.exam.grade')}</legend><div class="study-pills study-wrap">${radios('targetGrade',[['',t('goal.exam.none')],...gradeOptions],values.targetGrade?String(values.targetGrade):'',id=>id&&gradeType(id)!==values.examType?` data-grade-type="${gradeType(id)}" hidden`:id?` data-grade-type="${gradeType(id)}"`:'')}</div></fieldset>
    <fieldset class="study-group"><legend>${t('goal.exam.date')}</legend><div class="study-date"><select name="examMonth" aria-label="${escape(t('goal.exam.month'))}"><option value="">${t('goal.exam.none')}</option>${months.map(([value,label])=>`<option value="${value}"${value===month?' selected':''}>${escape(label)}</option>`).join('')}</select><select name="examDay" aria-label="${escape(t('goal.exam.day'))}"><option value="">${t('goal.exam.dayUnknown')}</option>${Array.from({length:31},(_,i)=>String(i+1)).map(n=>`<option value="${n}"${n===day?' selected':''}>${escape(t('goal.exam.day.n',{n}))}</option>`).join('')}</select></div><p class="study-exam-hint">${t('goal.exam.dateNote')}</p></fieldset>
    <fieldset class="study-group"><legend>${t('goal.exam.mode')}</legend><div class="study-pills study-wrap">${radios('examMode',EXAM_MODES.map(id=>[id,t(`goal.exam.mode.${id}`)]),values.examMode||'')}</div></fieldset>
    <fieldset class="study-group"><legend>${t('goal.exam.weekly')}</legend><div class="study-pills study-wrap">${radios('weeklyMinutes',[['',t('goal.exam.none')],...EXAM_WEEKLY.map(n=>[n,t(`goal.exam.weekly.${n}`)])],values.weeklyMinutes?String(values.weeklyMinutes):'')}</div></fieldset>
   </section>`:'';
  // 폼 느낌을 걷어낸 목록: 알약 묶음(이유·설명·시간·소리) · 목록 줄(도움 방식) · 스위치(기억하기). 사진은 생활 화면이 심어 둔 나침반(--life-print-goals).
  // 저장 스위치는 「저장하기」 단추 바로 위에 두고, 켜 달라는 안내는 스위치 이름 그대로 부른다(10-20 검수 #15).
  home.showPanel(t('goal.title'),`<form id="world-study-form" class="study-form">
   <div class="life-poster study-poster"><span class="w-print study-print" aria-hidden="true"><i></i></span><small class="life-poster-label">MY GOALS</small><strong class="life-poster-word">${t('goal.poster')}</strong><p class="study-intro life-poster-sub">${t('goal.intro')}</p></div>
   <fieldset class="study-group"><legend>${t('goal.reason')}</legend><div class="study-pills study-wrap">${radios('reason',[['',t('goal.reason.none')],...Object.entries(reasons())],reason)}</div></fieldset>
   ${examSection}
   <fieldset class="study-group"><legend>${t('goal.support')}</legend><div class="study-options">${rows('support',supportNames(),values.support||'choose')}</div></fieldset>
   <fieldset class="study-group"><legend>${t('goal.explanation')}</legend><div class="study-pills study-segment">${radios('explanation',{brief:t('goal.explanation.brief'),standard:t('goal.explanation.standard'),detailed:t('goal.explanation.detailed')},values.explanation||'brief')}</div></fieldset>
   <div class="study-today"><p class="life-section-label">TODAY</p><p>${t('goal.today.note')}</p>
    <fieldset class="study-group"><legend>${t('goal.minutes')}</legend><div class="study-pills study-segment">${radios('minutes',[['',t('goal.minutes.any')],...['3','5','10'].map(n=>[n,t('goal.minutes.n',{n})])],values.minutes?String(values.minutes):'')}</div></fieldset>
    <fieldset class="study-group"><legend>${t('goal.audio')}</legend><div class="study-pills study-segment">${radios('audio',{available:t('goal.audio.available'),off:t('goal.audio.off')},values.audio==='off'?'off':'available')}</div></fieldset>
   </div>
   ${view?`<section class="study-position"><p class="life-section-label">MY POSITION</p><button type="button" class="life-row study-position-row" data-view="position"><span class="life-row-copy"><strong>${t('position.open')}</strong><small>${escape(map?t('position.summary',{...map.counts,total:map.total}):t('position.row',{total:map?.total||topikTotal()}))}</small></span></button></section>`:''}
   <p class="study-scope">${t(scoped?'goal.scope.account':'goal.scope.device')}</p>
   <label class="study-consent"><input type="checkbox" name="consent" ${profile.consent?'checked':''}><span><strong>${consentName}</strong><small>${t('goal.consent.note')}</small></span></label>
   <p class="study-save-status" role="status">${escape(tMessage(progress.status().message))}</p>
   <div class="life-actions"><button class="felt-button" type="submit">${t(continueAfter?'goal.saveStart':'goal.save')} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-study-skip>${t(profile.status==='new'?'goal.skip':'goal.close')}</button></div>
   ${profile.status==='active'?`<div class="study-controls"><button type="button" class="quiet-button" data-study-clear="disable">${t('goal.disable')}</button><button type="button" class="quiet-button" data-study-clear="delete">${t('goal.delete')}</button></div>`:''}
  </form>`,{type:'world-study',eyebrow:'GOALS',nav:'me'});
  const form=target.document.querySelector('#world-study-form');if(!form)return;
  const status=form.querySelector('.study-save-status');let busy=false;
  // 이유가 「시험·자격 준비」일 때만 시험 칸을 펼치고, 시험 종류에 맞는 목표 급만 보인다.
  const exam=form.querySelector('[data-study-exam]'),grade=form.querySelector('[data-study-grade]');
  const sync=()=>{
   if(exam)exam.hidden=form.elements.reason.value!=='exam';
   const monthValue=form.elements.examMonth?.value||'',daySelect=form.elements.examDay;
   if(daySelect){const last=/^\d{4}-\d{2}$/.test(monthValue)?new Date(Date.UTC(Number(monthValue.slice(0,4)),Number(monthValue.slice(5)),0)).getUTCDate():31;
    for(const option of daySelect.options){const off=Number(option.value)>last;option.disabled=off;option.hidden=off;}
    if(Number(daySelect.value)>last)daySelect.value='';}
   const type=form.elements.examType?.value||'';
   if(grade){grade.hidden=!['topik1','topik2'].includes(type);
    for(const pill of grade.querySelectorAll('[data-grade-type]')){const show=pill.dataset.gradeType===type;pill.hidden=!show;const input=pill.querySelector('input');if(!show&&input?.checked){input.checked=false;grade.querySelector('input[value=""]').checked=true;}}}
  };
  form.addEventListener('change',event=>{if(['reason','examType','examMonth'].includes(event.target?.name))sync();});sync();
  const valid=()=>{check();if(progress!==getProgress()||!form.isConnected)throw Error('설정을 다시 열어 주세요.');};
  const run=async operation=>{if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{valid();operation();revision=progress.learningProfile().profile.revision;await progress.flush();valid();if(progress.learningProfile().profile.status!=='skipped'){await prepare();valid();try{await target.SYNKLearningHost?.ready?.();}catch{/* the save still goes to this device */}valid();if(applyPreferences({explicit:true})===false)throw Error('도움 방식 저장을 다시 확인해 주세요.');}refresh();home.closePanel();if(continueAfter)await next();else home.toast(t('goal.saved'));}catch(error){if(form.isConnected)status.textContent=tMessage(error.message)||t('goal.retry');}finally{busy=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  // 고른 시험 정보: 시험을 고르지 않았으면 모두 지운다(다른 이유로 바꾸면 시험 계획도 끝난다). 날은 그 달에 있는 날만.
  const examValues=reason=>{
   if(reason!=='exam'||!exam)return {examType:null,targetGrade:null,examDate:null,examMode:null,weeklyMinutes:null};
   const type=form.elements.examType?.value||null,level=Number(form.elements.targetGrade?.value)||null,monthValue=form.elements.examMonth?.value||'',dayValue=form.elements.examDay?.value||'';
   const date=monthValue?dayValue&&position.exam.parseExamDate(`${monthValue}-${dayValue.padStart(2,'0')}`)?`${monthValue}-${dayValue.padStart(2,'0')}`:monthValue:null;
   const weekly=Number(form.elements.weeklyMinutes?.value)||null,mode=form.elements.examMode?.value||null;
   return {examType:type,targetGrade:type&&EXAM_GRADES[type]?.includes(level)?level:null,examDate:date,examMode:mode,weeklyMinutes:weekly};
  };
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.elements.consent.checked){status.textContent=t('goal.needConsent',{name:consentName});form.querySelector('.study-consent input')?.focus?.();return;}
   const reason=form.elements.reason.value,minutes=Number(form.elements.minutes.value);
   void run(()=>progress.updateLearningProfile({consent:true,expectedRevision:revision,values:{reasons:reason?[reason]:null,primaryReason:reason||null,goal:null,support:form.elements.support.value,explanation:form.elements.explanation.value,...examValues(reason)},today:{...(minutes?{minutes}:{}),audio:form.elements.audio.value}}));
  });
  form.querySelector('[data-study-skip]').addEventListener('click',()=>{if(profile.status==='new')void run(()=>progress.clearLearningProfile({mode:'skip',expectedRevision:revision}));else home.closePanel();});
  form.querySelectorAll('[data-study-clear]').forEach(button=>button.addEventListener('click',()=>void run(()=>progress.clearLearningProfile({mode:button.dataset.studyClear,expectedRevision:revision}))));
 }
 // ── 「내 위치」(10-19 결정 · 학습기준 §7-3) ──
 // 판: Core가 이미 읽은 TOPIK I 항목 상태를 세 칸(혼자 해냄·연습 중·아직)으로 보이고, 칸마다 그렇게 본 근거를 단다.
 // 짧은 진단은 이 화면의 코치(world-home)에 제시 → (듣기면) 끝까지 들음 → 첫 답 순서로 남긴다 — 처음 보는 문항에 혼자 낸 첫 시도다.
 // 예상 급수는 문턱(TOPIK 형식 근거 30·영역별 10·90일) 전에는 보이지 않는다. 「아직 못 읽어요」를 고른 사람은 한글 진도부터.
 let diagnosed=false,positionOpen=0;
 const PANEL={type:'life-position',eyebrow:'MY POSITION',nav:'packs'};
 const panelNode=selector=>target.document?.querySelector(`#panel-content ${selector}`)||null;
 const failed=error=>home.toast(tMessage(error?.message)||t('position.failed'));
 // 한글 만나기가 진도를 두는 자리(hangul-stage/learning.mjs progressKey): 손님은 이 기기, 계정은 그 계정·학습 동의 판의 구역.
 // 계정인데 학습 호스트가 아직 없으면 자리를 모른다(null) — 손님 자리를 대신 읽지 않는다.
 async function hangulStage(coachNow){
  // Read the private account record afresh, independently of optional learning sharing.
  // A failed account read must not fall back to an old device record or claim a new start.
  if(readHangulProgress){const raw=await readHangulProgress();check();return position.hangulStageProgress(raw?JSON.parse(raw):null,position.hangulLayer);}
  if(owner!=='guest'&&!coachNow)return null;
  try{
   const key=position.hangulProgressKey(target,coachNow);if(!key)return null;
   const raw=target.localStorage?.getItem(key);
   return position.hangulStageProgress(raw?JSON.parse(raw):null,position.hangulLayer);
  }catch{return null;}
 }
 // 「이 항목 연습하기」를 달 수 있는 항목: 읽기는 검수 통과 새 문항이 남은 항목, 듣기는 지금 추천 후보 가운데 그 항목의 새 문항이 남은 게임.
 function practiceRoutes(coachNow){
  const seen=seenBy(coachNow),routes=new Map();
  const practice=position?.practice;
  if(practice&&coachNow){let supply={};try{supply=practice.practiceSupply({pool:practice.pool,seen});}catch{supply={};}for(const [skillId,count]of Object.entries(supply))if(count>0)routes.set(skillId,{route:'practice',skillId});}
  let audio=true;try{audio=getProgress().learningProfileValues().audio!=='off';}catch{}
  for(const candidate of audio?current?.candidates||[]:[]){
   if(candidate.route!=='game'||candidate.modality!=='listening'||candidate.available===false)continue;
   for(const target of candidate.targets||[])if(seen({itemKey:target.itemKey||target.id,familyKey:target.familyKeys?.[0]})===false)for(const id of target.skillIds||[])if(!routes.has(id))routes.set(id,{route:'game',gameId:candidate.gameId});
  }
  return routes;
 }
 function bindPractice(root,routes){
  root?.querySelectorAll?.('[data-position-practice]').forEach(button=>button.addEventListener('click',()=>{
   try{check();const route=routes.get(button.dataset.positionPractice);if(!route)return;
    if(route.route==='practice')void Promise.resolve(startPractice(route.skillId)).catch(failed);else void Promise.resolve(launchGame(route.gameId)).catch(failed);}catch(error){failed(error);}
  }));
 }
 function positionData(coachNow,prefer=null){
  let summary=empty,events=[];
  try{summary=coachNow?.summary()||empty;events=coachNow?.events?.()||[];}catch{summary=empty;events=[];}
  const map=position.buildPositionMap({summary,events,policy:engine.POLICY,prefer});
  let audioAvailable=true;try{audioAvailable=getProgress().learningProfileValues().audio!=='off';}catch{}
  const seen=seenBy(coachNow);
  let plan=null;try{plan=position.selectDiagnostic({summary,items:position.items,seen,audioAvailable});}catch{plan=null;}
  // 지금 WORLD에는 TOPIK 형식(처음 보는 문항·실제 구성·시간 제한) 연습이 없어 근거는 빈 목록이다.
  const gate=position.estimateGate({evidence:[],asOf:new Date().toISOString()});
  return {map,plan,gate};
 }
 function showBoard(coachNow){
  check();
  // 듣기 항목의 「이 항목 연습하기」는 지금 추천 후보에서 찾으므로 판을 그리기 전에 추천을 새로 세운다(10-21 검수).
  refresh();
  const routes=practiceRoutes(coachNow),{map,plan,gate}=positionData(coachNow,id=>routes.has(id));
  let scope=null;try{scope=getProgress().status().scoped?'account':'device';}catch{}
  home.showPanel(t('position.title'),view.renderPositionBoard({map,plan,gate,catalog:position.label,diagnosed,scope,practice:id=>routes.get(id)||null}),PANEL);
  panelNode('[data-position-board]')?.focus?.({preventScroll:true});
  panelNode('[data-position-diagnostic]')?.addEventListener('click',()=>{try{startDiagnostic(coachNow,plan,map);}catch(error){failed(error);}},{once:true});
  bindPractice(panelNode('[data-position-board]'),routes);
  return {coachNow,plan,map};
 }
 function showHangul(stage){
  home.showPanel(t('position.title'),view.renderHangulBoard({stage}),PANEL);
  panelNode('[data-position-board]')?.focus?.({preventScroll:true});
  panelNode('[data-position-hangul]')?.addEventListener('click',()=>{try{void Promise.resolve(launchGame('hangul')).catch(failed);}catch(error){failed(error);}},{once:true});
 }
 // start: 홈의 추천이 짧은 진단이면 판을 거치지 않고 바로 시작한다(판에서 시작 단추를 누른 것과 같다).
 async function openPosition({start=false}={}){
  if(!position)return;
  check();const ticket=++positionOpen;
  // 계정의 학습 호스트를 먼저 세운다(다음 연습과 같다). 세우지 못해도 판은 열고, 기록이 덜 왔다고 알린다.
  try{await prepare();}catch{/* the board shows the records as incomplete */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still shows */}
  check();if(ticket!==positionOpen)return;
  let coachNow=null;try{coachNow=readCoach();}catch{coachNow=null;}
  let reading=null;try{reading=getProgress().hangulReading?.()||null;}catch{reading=null;}
  let stage;
  try{stage=await hangulStage(coachNow);}catch(error){check();if(ticket===positionOpen)failed(error);return;}
  check();if(ticket!==positionOpen)return;
  if(position.showsHangulBoard({reading,stage})){showHangul(stage);return;}
  const shown=showBoard(coachNow);
  if(start&&shown.plan?.status==='ready'&&shown.plan.items.length)startDiagnostic(shown.coachNow,shown.plan,shown.map);
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
   // 끝 화면의 「이 항목 연습하기」는 새 추천(refresh) 뒤의 후보로 고른다 — 방금 푼 진단 문항은 이제 본 문항이다.
   refresh();const routes=practiceRoutes(coachNow);
   let after=map;try{after=position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[],policy:engine.POLICY,prefer:id=>routes.has(id)});}catch{after=map;}
   box.innerHTML=view.renderDiagnosticDone({map:after,results,items:position.itemsById,practice:id=>routes.get(id)||null});
   bindPractice(box,routes);
   box.querySelector('[data-position-done]')?.focus?.({preventScroll:true});top();
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
 // ── 읽기 짧은 연습(10-20 검수 #1, world-reading-practice.mjs) ──
 // 한 항목의 새 문항 몇 개: 답 → 기록(Trail, 코치 'world-practice') → 맞음·정답·해설 → 다음. 끝에 그 항목의 바뀐 관측 한 줄.
 // 그 항목의 새 문항이 없으면 다른 항목 문항으로 채우지 않고, 모자람을 알리며 내 위치(다른 항목·다시 확인)로 이끈다.
 let practiceOpen=0;
 async function startPractice(skillId){
  if(!position?.practice)return;
  check();const ticket=++practiceOpen;
  try{await prepare();}catch{/* device-local practice still runs */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local practice still runs */}
  check();if(ticket!==practiceOpen)return;
  const coachNow=readPracticeCoach();if(!coachNow){home.toast(t('practice.unavailable'));return;}
  const summary=coachNow.summary(),seen=seenBy(coachNow);
  const selection=position.practice.selectPractice({summary,pool:position.practice.pool,seen,skillId});
  if(selection.status==='none'){home.toast(t(selection.reason==='history.incomplete'?'position.diagnostic.history':'practice.shortage'));void openPosition();return;}
  const session=position.practice.createPracticeSession({coach:coachNow,items:selection.items});
  const mapOf=()=>{try{return position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[],policy:engine.POLICY});}catch{return null;}};
  const before=mapOf()?.skills.find(skill=>skill.id===skillId)||null;
  let ended=false;
  const stop=()=>{if(ended)return;ended=true;try{session.stop();}catch{}try{coachNow.flush?.();}catch{}queueMicrotask(()=>refresh());};
  home.showPanel(t('practice.title'),'<div class="wpos-stage" data-practice-stage></div>',{...PANEL,eyebrow:'PRACTICE'});
  home.attachPanelResource?.({dispose:stop});
  const box=panelNode('[data-practice-stage]');if(!box){stop();return;}
  const skill={id:skillId,label:skillLabel(skillId)};
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  function paint(focus='.wpos-run-skill'){
   const now=session.current;if(!now){finish();return;}
   box.innerHTML=view.renderPracticeItem({view:now,skill,feedback:now.feedback});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  function advance(){if(!session.next()){finish();return;}paint();top();}
  function finish(){
   if(ended&&!box.isConnected)return;
   ended=true;try{coachNow.flush?.();}catch{}
   const after=mapOf()?.skills.find(row=>row.id===skillId)||null;
   const more=position.practice.practiceSupply({pool:position.practice.pool,seen:seenBy(coachNow)})[skillId]||0;
   box.innerHTML=view.renderPracticeDone({skill,before,after,results:session.results(),items:position.itemsById,more});
   box.querySelector('[data-practice-done]')?.focus?.({preventScroll:true});top();
   queueMicrotask(()=>refresh());
  }
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||button.disabled)return;
   try{
    check();
    if(button.dataset.practiceChoice){session.answer(button.dataset.practiceChoice);paint('[data-practice-feedback]');}
    else if(button.hasAttribute('data-practice-next'))advance();
    else if(button.hasAttribute('data-practice-skip')){session.skip();advance();}
    else if(button.hasAttribute('data-practice-stop')){stop();void openPosition();}
    else if(button.hasAttribute('data-practice-again'))void Promise.resolve(startPractice(skillId)).catch(failed);
    else if(button.hasAttribute('data-practice-position'))void openPosition();
    else if(button.hasAttribute('data-practice-home'))home.closePanel();
   }catch(error){stop();failed(error);}
  });
  advance();
 }
 // ── 이번 주 계획(10-20 결정, world-exam-plan.mjs) ──
 // 시험을 고른 사람에게만. 계획은 따로 저장하지 않고 열 때마다 기록·선언값·날짜로 다시 세운다(추천과 같은 계산).
 let planOpen=0;
 async function openPlan({keepScroll=false}={}){
  check();const ticket=++planOpen;
  if(!keepScroll){try{await prepare();}catch{/* the plan shows what this device has */}check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still counts */}check();}
  if(ticket!==planOpen)return;
  const plan=refresh(),examPlan=plan?.examPlan;
  if(!examPlan||!view){if(!keepScroll)open();return;}
  const scroller=keepScroll?panelNode('[data-plan-board]')?.closest?.('#panel-content'):null,scrollTop=scroller?.scrollTop||0;
  home.showPanel(t('plan.week.title'),view.renderExamPlan({plan:examPlan,next:plan.selected,reason:tMessage(plan.reason||'')}),{type:'life-position',eyebrow:'MY WEEK',nav:'packs'});
  const root=panelNode('[data-plan-board]');if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;}else root?.focus?.({preventScroll:true});
  root?.querySelector('[data-plan-next]')?.addEventListener('click',()=>{try{check();if(plan.selected)void Promise.resolve(launch(plan.selected)).catch(failed);}catch(error){failed(error);}});
  root?.querySelectorAll('[data-plan-practice]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(startPractice(button.dataset.planPractice)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelectorAll('[data-plan-game]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(launchGame(button.dataset.planGame)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelector('[data-plan-recheck]')?.addEventListener('click',()=>{try{check();void openPosition({start:true});}catch(error){failed(error);}});
  root?.querySelectorAll('[data-plan-writing]').forEach(button=>button.addEventListener('click',()=>{try{check();if(typeof writingPractice?.open==='function')void Promise.resolve(writingPractice.open(button.dataset.planWriting)).catch(failed);}catch(error){failed(error);}}));
 }
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 // 배우기 판의 「이번 주 계획」 줄(life-ui.mjs moreRows): 시험을 고른 사람에게만. print는 그 판의 인화지 그림.
 function planRow(print=()=>''){
  const plan=current?.examPlan;if(!plan)return '';
  const done=(plan.areas||[]).reduce((n,row)=>n+Math.min(row.done,row.planned),0),total=(plan.areas||[]).reduce((n,row)=>n+row.planned,0);
  return `<button class="life-row" data-view="plan">${print('goals','life-row-print')}<span class="life-row-copy"><strong>${t('plan.week.title')}</strong><small>${escape(t('plan.week.row',{done,total}))}</small></span></button>`;
 }
 return {next,open,refresh,applyPreferences,planRow,positionTotal:topikTotal,...(position?{position:openPosition,practice:startPractice,plan:openPlan}:{}),presentation(){check();const values=settingsFor(getProgress().learningProfileValues());return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),dispose(){stopped=true;coach?.disconnect?.();practiceCoach?.disconnect?.();target.removeEventListener?.('focus',onFocus);}};
}
