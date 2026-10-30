import {t,tMessage,hasString,formatDate,currentLang} from '../brand-opening/world-lang.mjs';
import {followupRows,advisoryRows} from './world-learning-followups.mjs';
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
// speakingPractice: 말하기 연습(10-21 시범, world-speaking-practice.mjs — 호스트가 그 모듈을 불렀을 때만 넘긴다). 함수 묶음
//  {available(), candidates(), chosen(owner), choose(owner,on), week(owner,{start,end}), open(route)}: 시험 정보 칸의 「말하기 평가도 준비해요」(이 기기에만 저장)를
//  읽고 쓰고, 고른 TOPIK I·II 학생의 이번 주 계획에 말하기 영역과 추천 후보를 넣는다. 없으면 시험 정보·계획이 지금과 같다.
// topikBankUrl: 공개 TOPIK 은행(world-topik-items.json — 검수 통과 문항)의 주소. 없으면 audioUrl로 WORLD 자리에서 찾는다(10-21 ④).
// town: 싱크타운 「마을 준비 확인」(학습·개인화 다리 §4-2). {kit: 계정 묶음의 worldTownCheck, check(body): 서버 입장 확인(town/check),
//  open(): 마을 열기, passed(result): 통과를 알림, evidence(): 진단·연습·시험 형식 연습이 끝났다고 알림(호스트의 조용한 확인)}. 없으면 그 판을 열지 않는다.
// responses: 학습자 응답(설정값 worldFeedback, WORLD 학습자 응답 설계 — 기본 꺼짐). 켜지면 로그인한 학습자의 연습 끝 화면에 「이번 연습 어땠어요?」를 두고,
//  짧은 연습의 길이(3·5·7)를 그 응답으로 정하고, 「내 계정」이 응답 목록(responses()·removeResponse())을 읽는다. 꺼지면 판 기록(finishSet)도 남기지 않는다.
export function createWorldEducation({home,getProgress,engine,createPlan,launchGame,startLesson,startReview,prepare=async()=>{},position=null,audioUrl=path=>path,readHangulProgress=null,
 readClasswork=null,writingPractice=null,speakingPractice=null,topikBankUrl=null,town=null,responses=false,target=globalThis}){
 let stopped=false,coach=null,coachHost=null,practiceCoach=null,practiceHost=null,mockCoach=null,mockHost=null,current=null,refreshing=false,classwork={at:0,rows:[],pending:null};
 const owner=getProgress().owner;
 const empty=engine.engine.createGame({gameId:'world-home-empty',storage:null,historyComplete:false}).summary();
 const view=position?position.createView({t,has:hasString,formatDate,lang:currentLang}):null;
 const check=()=>{if(stopped||getProgress()?.owner!==owner)throw Error('학습 계정이 바뀌었어요. 설정을 다시 열어 주세요.');};
 // 학습 기록 코치: 홈·짧은 진단은 'world-home', 읽기 짧은 연습은 'world-practice'(근거 줄이 어디서 낸 답인지 가른다).
 // 둘 다 같은 기기·계정 기록(같은 열쇠)을 쓰므로 노출과 상태는 서로의 답을 그대로 본다.
 function coachFor(gameId,held,setHeld){
  check();const source=target.SYNKLearningHost||null;
  if(!source&&owner!=='guest')return null;
  let [instance,host]=held();
  if(instance&&host===source){try{instance.summary();return instance;}catch{instance.disconnect?.();instance=null;}}
  if(host!==source){instance?.disconnect?.();instance=null;host=source;}
  if(!instance)instance=source?source.createGame({gameId,followups:true},engine.engine.createGame,engine.createLearningSync):engine.engine.createGame({gameId,storage:target.localStorage,followups:true});
  setHeld(instance,host);return instance;
 }
 const readCoach=()=>coachFor('world-home',()=>[coach,coachHost],(a,b)=>{coach=a;coachHost=b;});
 const readPracticeCoach=()=>coachFor(position?.practice?.PRACTICE_POLICY?.gameId||'world-practice',()=>[practiceCoach,practiceHost],(a,b)=>{practiceCoach=a;practiceHost=b;});
 // 시험 형식 연습(미니 모의)은 'world-mock' — 근거 집계(world-exam-form.mjs mockEvidence)가 이 경험의 결정 기록만 읽는다.
 const readMockCoach=()=>coachFor(position?.mock?.MOCK_POLICY?.gameId||'world-mock',()=>[mockCoach,mockHost],(a,b)=>{mockCoach=a;mockHost=b;});
 // ── 연습 한 판의 응답(WORLD 학습자 응답 설계 §2·§3·§5) ──
 // 기능이 꺼졌거나 손님이면 응답 줄도 판 기록(finishSet)도 없다 — 손님은 「내 계정」을 열 수 없어 본인이 보고 뺄 자리가 없다.
 const answering=()=>responses===true&&owner!=='guest';
 // 판 하나를 마칠 때 그 판의 결정·마침 한 쌍(코치 finishSet — 응답은 그 판에 붙는다). 남기지 못하면(옛 코치·저장 실패) 응답 줄을 그리지 않는다.
 function finishSet(coachNow,kind){
  if(!answering()||typeof coachNow?.finishSet!=='function'||typeof view?.renderSetResponse!=='function')return null;
  try{return coachNow.finishSet({kind});}catch{return null;}
 }
 // 짧은 연습 한 판의 문항 수: 짧은 연습(코치 world-practice)에 남긴 마지막 응답 하나로 — 많았어요 3, 더 하고 싶어요 7, 그 밖·없음은 연습 규칙 그대로(5).
 // 따로 저장하는 상태가 없다(Core 분량 규칙과 같은 절대 규칙) — 응답을 빼거나 30일이 지나면 효과도 빠진다. 진단·시험 형식 응답은 길이를 움직이지 않는다.
 const PRACTICE_LENGTH=Object.freeze({too_much:3,want_more:7});
 function practiceLength(){
  const base=position?.practice?.PRACTICE_POLICY?.count||5;
  if(!answering())return base;
  try{const last=(readPracticeCoach()?.setFeedback?.()||[]).filter(row=>row.kind==='short').at(-1);return PRACTICE_LENGTH[last?.value]||base;}catch{return base;}
 }
 // 끝 화면의 응답 줄 잇기: 고르면 코치에 남기고(같은 값은 그대로, 다른 값은 앞 응답을 대신한다) 그 줄만 다시 그린다.
 // 짧은 연습이면 길이가 바뀌므로 「새 문항 n개 더 하기」의 n도 고친다(more: 그 항목에 남은 새 문항 수).
 function bindResponse({box,coachNow,set,kind,more=0}){
  if(!set||!box?.querySelector?.('[data-set-response-box]'))return;
  let chosen=null;
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-set-response]');if(!button||!box.contains(button))return;
   const value=button.dataset.setResponse;let failed=false;
   try{check();coachNow.feedback(set,value);chosen=value;}catch{failed=true;}
   const node=box.querySelector('[data-set-response-box]');if(!node)return;
   // 글과 눌림만 바꾼다(줄을 새로 그리면 role=status 안내가 보조기기에 안 읽힌다). 옛 묶음이면 줄을 새로 그린다.
   const text=typeof view.setResponseText==='function'?view.setResponseText({kind,value:chosen,failed}):null;
   const ask=node.querySelector?.('#wpos-response-ask'),status=node.querySelector?.('[data-set-response-status]');
   if(text&&ask&&status){ask.textContent=text.ask;status.textContent=text.status;for(const pill of node.querySelectorAll('[data-set-response]'))pill.setAttribute('aria-pressed',pill.dataset.setResponse===chosen?'true':'false');}
   else{node.outerHTML=view.renderSetResponse({kind,value:chosen,failed});box.querySelector(`[data-set-response="${value}"]`)?.focus?.({preventScroll:true});}
   const again=kind==='short'?box.querySelector('[data-practice-again]'):null;
   if(again)again.innerHTML=`${escape(t('practice.again',{n:Math.min(more,practiceLength())}))} <span aria-hidden="true">→</span>`;
  });
 }
 const responseView=(set,kind)=>set?{kind,value:null}:null;
 // 「내 계정」의 「내가 남긴 응답」: 세 연습(짧은 연습·짧은 진단·시험 형식)의 판 응답(30일 안·뺀 것 제외)을 새것부터. 기능이 꺼졌거나 손님이면 null.
 // 각 줄 {id, kind, value}. 시각은 보이지 않는다(설계 §3). removeResponse(id): 그 응답을 뺀다(record.excluded — 목록과 쓰임에서 빠진다).
 const RESPONSE_COACHES=[()=>readPracticeCoach(),()=>readCoach(),()=>readMockCoach()];
 function responseList(){
  if(!answering())return null;
  const rows=[];
  for(const read of RESPONSE_COACHES){const coach=read();for(const row of coach?.setFeedback?.()||[])rows.push(row);}
  return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map(row=>({id:row.id,kind:row.kind,value:row.value}));
 }
 function removeResponse(id){
  if(!answering())return false;
  for(const read of RESPONSE_COACHES){const coach=read();if((coach?.setFeedback?.()||[]).some(row=>row.id===id)){coach.exclude(id);return true;}}
  return false;
 }
 // 공개 TOPIK 은행: 처음 추천·판을 열 때 한 번 불러오고(실패하면 다음에 다시), 다 불러오면 추천과 열려 있는 판을 다시 그린다.
 const bankUrl=topikBankUrl||audioUrl('world-topik-items.json');
 let bankWait=null,bankFailedAt=-Infinity;
 function loadBank(){
  const bank=position?.topik;if(!bank||bank.ready)return Promise.resolve();
  // 못 불러왔으면 1분 동안은 다시 묻지 않는다 — refresh(초점·답)마다 요청이 되풀이되지 않게.
  if(!bankWait&&Date.now()-bankFailedAt<60000)return Promise.resolve();
  bankWait||=Promise.resolve().then(()=>bank.load(bankUrl)).then(()=>{if(stopped)return;queueMicrotask(()=>{refresh();repaint();});},()=>{bankWait=null;bankFailedAt=Date.now();});
  return bankWait;
 }
 // 은행을 기다리되 오래 붙잡지 않는다(못 불러와도 판은 기존 문항으로 연다).
 const bankReady=(ms=4000)=>Promise.race([loadBank(),new Promise(resolve=>setTimeout(resolve,ms))]);
 let followupWait=null,followupFailedAt=-Infinity;
 function loadFollowupBank(){
  if(!position?.followups||position.followups.bank.ready||Date.now()-followupFailedAt<60000)return Promise.resolve();
  followupWait||=position.followups.bank.load(audioUrl('world-followup-items.json')).then(()=>{if(!stopped)repaint();},()=>{followupWait=null;followupFailedAt=Date.now();});
  return followupWait;
 }
 function delayedRows(){
  const c=readPracticeCoach(),seen=seenBy(c);let projection=null;try{projection=c?.followups?.();}catch{}
  return followupRows({projection,pool:[...(position?.practice?.pool||[]),...(position?.followups?.pool(seen)||[])],seen,
   taskVersion:c?.mapVersion,audioAvailable:getProgress().learningProfileValues().audio!=='off'});
 }
 // 판이 읽는 시험: 학생이 고른 시험(TOPIK II면 TOPIK II 지도), 판에서 바꾸면 그 판.
 let boardExam=null;
 const studentExam=values=>values?.examType==='topik2'?'topik2':'topik1';
 const examOf=values=>boardExam||studentExam(values);
 const formOf=exam=>exam==='topik2'?'topik-ii':'topik-i';
 const skillExam=id=>/^ko2\./.test(String(id||''))?'topik2':'topik1';
 // 이 학생에게 낼 짧은 연습 문항: TOPIK II를 고른 사람은 TOPIK II 문항이 있는 영역은 TOPIK II, 아직 없는 영역은 TOPIK I(계획의 다리와 같다).
 // 그 밖의 사람은 TOPIK I 문항만 — 처음 온 사람에게 TOPIK II를 「아직 안 본 항목」으로 내밀지 않는다.
 function practiceFor(values){
  const pool=position?.practice?.pool||[];
  if(studentExam(values)!=='topik2')return pool.filter(item=>skillExam(item.skillId)==='topik1');
  const two=new Set(pool.filter(item=>skillExam(item.skillId)==='topik2').map(item=>item.modality));
  return pool.filter(item=>two.has(item.modality)?skillExam(item.skillId)==='topik2':skillExam(item.skillId)==='topik1');
 }
 const topik2Domains=()=>{const pool=position?.practice?.pool||[];return {listening:pool.some(item=>item.modality==='listening'&&skillExam(item.skillId)==='topik2'),reading:pool.some(item=>item.modality==='reading'&&skillExam(item.skillId)==='topik2')};};
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
 const topikTotal=()=>(engine.SKILLS||[]).filter(node=>node?.kind==='skill'&&/^ko\.(listening|reading)\.[a-z]+$/.test(node.id||'')).length||16;
 // 쓰기 연습 후보: 호스트가 함수(지금 열 수 있는 것)나 목록으로 넘긴다.
 const writingList=()=>{let value=null;try{value=typeof writingPractice?.candidates==='function'?writingPractice.candidates():writingPractice?.candidates;}catch{value=null;}return Array.isArray(value)?value.filter(row=>row&&typeof row.id==='string'&&typeof row.route==='string'&&Number.isFinite(row.minutes)):[];};
 // 쓰기 후보의 한국어 이름(홈이 화면 언어로 바꾼다 · home.mjs planLabel).
 const writingLabel=route=>{const type=String(route||'').split(':')[1],key=type==='mock'?'writing.mock.title':`writing.type.${type}`;return hasString(key)?`${t('writing.title',undefined,'ko')} · ${t(key,undefined,'ko')}`:String(route||'');};
 const skillLabel=id=>hasString(`position.skill.${id}`)?t(`position.skill.${id}`,undefined,'ko'):id;
 // 말하기 연습(10-21): 호스트 함수가 없거나 던지면 말하기를 없는 것으로 본다(시험 정보·계획이 지금과 같다).
 const speakingCall=(name,...args)=>{try{return typeof speakingPractice?.[name]==='function'?speakingPractice[name](...args):null;}catch{return null;}};
 const speakingType=route=>{const type=Number(String(route||'').split(':')[1]);return Number.isInteger(type)?type:null;};
 // 시험 유형 후보만(route 'speaking:N') — 카페 역할극은 이번 주 계획에 넣지 않는다.
 const speakingList=()=>{const value=speakingCall('candidates');return Array.isArray(value)?value.filter(row=>row&&typeof row.id==='string'&&speakingType(row.route)&&Number.isFinite(row.minutes)):[];};
 // 말하기 후보의 한국어 이름(홈·계획 판이 화면 언어로 바꾼다 · home.mjs planLabel, world-position-ui.mjs planTitle).
 const speakingLabel=route=>{const key=`speaking.type.${speakingType(route)}`;return hasString(key)?`${t('speaking.title',undefined,'ko')} · ${t(key,undefined,'ko')}`:t('speaking.title',undefined,'ko');};
 const speakingChosen=()=>speakingCall('chosen',owner)===true;
 // 이번 주(계획의 주) 말하기: 열 수 있는 유형 후보 · 센 시도 시각 · 아직 안 해 본 유형 수, 그리고 Core에 넘길 추천 후보(아직 안 해 본 유형, 다 해 봤으면 모두).
 function speakingThisWeek(now){
  const list=speakingList(),state=speakingCall('week',owner,position.exam.examWeek(now))||{};
  const tried=new Set(Array.isArray(state.tried)?state.tried:[]),fresh=list.filter(row=>!tried.has(speakingType(row.route)));
  return {list,times:Array.isArray(state.times)?state.times:[],untried:fresh.length,
   recommend:(fresh.length?fresh:list).map(row=>({id:row.id,label:speakingLabel(row.route),route:'speaking',routeId:row.route,minutes:row.minutes,minutesEstimated:true,targets:[],goals:['exam','prepare','speaking'],audioRequired:true,modality:'speaking'}))};
 }
 // 반 과제: 열 때마다 서버에 묻지 않고 10분 동안 같은 답을 쓴다. 못 읽으면 반 과제 없이 계획한다.
 function classworkRows(){
  if(typeof readClasswork!=='function')return [];
  if(!classwork.pending&&Date.now()-classwork.at>600000){
   classwork.pending=Promise.resolve().then(()=>readClasswork()).then(rows=>{if(stopped)return;classwork={at:Date.now(),rows:Array.isArray(rows)?rows:[],pending:null};queueMicrotask(()=>{refresh();if(panelNode('[data-plan-board]'))openPlan({keepScroll:true});});},
    ()=>{classwork={at:Date.now(),rows:[],pending:null};});
  }
  return classwork.rows;
 }
 // 시험 형식 연습(미니 모의) 고르기: 학생의 시험(TOPIK I·II)으로, 소리를 끈 날은 읽기만. 문항 풀은 묶음이 은행·빈칸 베기로 만든다.
 function mockPlan({coachNow,values,exam=studentExam(values)}){
  const mock=position?.mock;if(!mock||!coachNow)return null;
  try{return mock.selectMock({forms:mock.forms,exam,pool:mock.pool,seen:seenBy(coachNow),audioAvailable:values?.audio!=='off'});}catch{return null;}
 }
 // 추천 한 번: 짧은 연습(읽기·듣기)·짧은 진단·시험 형식 연습 후보를 더하고, 시험을 고른 사람은 이번 주 계획을 세워 그 초점을 Core에 넘긴다(순위는 Core).
 function planWith({summary,coachNow,progress,values,recommendActivities}){
  const seen=seenBy(coachNow),extra=[],now=Date.now(),audioAvailable=values.audio!=='off';
  const practice=position?.practice,pool=practiceFor(values);
  if(practice&&coachNow&&summary.evidenceComplete)extra.push(...practice.practiceCandidates({pool,seen,summary,labels:Object.fromEntries(pool.map(item=>[item.skillId,skillLabel(item.skillId)])),count:practiceLength()}));
  const exam=position?.exam?.examInfo(values)||null;
  let diagnostic=null;
  if(exam&&position&&coachNow){try{diagnostic=position.selectDiagnostic({summary,items:position.items,seen,audioAvailable,exam:studentExam(values)});}catch{diagnostic=null;}}
  if(exam&&diagnostic?.status==='ready'&&typeof position.checkCandidate==='function')extra.push(position.checkCandidate());
  // 시험 형식 연습: 시험을 고른 사람에게만, 열 수 있을 때. 학습 항목을 겨누지 않는 넓은 연습이라 targets를 비운다(짧은 진단과 같다).
  const mock=exam&&summary.evidenceComplete?mockPlan({coachNow,values}):null;
  if(mock?.status==='ready')extra.push({id:'world.mock',label:'시험 형식 연습',route:'mock',minutes:mock.minutes,minutesEstimated:false,targets:[],goals:['exam','prepare'],
   audioRequired:mock.sections.some(row=>row.section==='listening'&&row.status==='ready'),modality:'reading'});
  // 쓰기 연습(③ world-writing-practice.mjs writingCandidates): TOPIK II를 고른 사람만. 쓰기 시도는 Trail에 「채점 안 함」으로만 남아(코치 지도의
  // ko2.writing.*) 능력 근거가 없으므로 학습 항목을 겨누지 않는 후보로 넘긴다. 여는 길은 호스트의 openWriting(route)다.
  // 「한 가지 고치기」(10-27)가 열려 있으면 53번 후보에 호스트 사실 practiceNeed가 온다 — Core가 급한 줄로 올린다. 계획 시각보다 늦은 사실은 넘기지 않는다(Core가 거절한다).
  const need=row=>row.practiceNeed&&Date.parse(row.practiceNeed.at)<=now?{practiceNeed:row.practiceNeed}:{};
  const writing=exam?.type==='topik2'?writingList().map(row=>({id:row.id,label:writingLabel(row.route),route:'writing',routeId:row.route,minutes:row.minutes,minutesEstimated:true,targets:[],goals:['exam','prepare','writing'],audioRequired:false,modality:'writing',...need(row)})):[];
  extra.push(...writing);
  // 말하기 연습(10-21): TOPIK I·II를 고르고 시험 정보에서 「말하기 평가도 준비해요」를 켠 학생만(이 기기 기록, 계정·손님마다). 말하기 항목은 Core 지도에
  // 없어 학습 항목을 겨누지 않는 후보로 넘기고(소리가 필요하다 — 소리를 끈 날은 Core가 뺀다), 계획에는 이번 주 시각과 아직 안 해 본 유형 수를 넘긴다.
  const speaking=exam&&['topik1','topik2'].includes(exam.type)&&speakingChosen()?speakingThisWeek(now):null;
  if(speaking)extra.push(...speaking.recommend);
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
  // 쓰기 연습은 Trail에 「채점 안 함」으로만 남고 게스트·지도 밖 기록도 있어, 기기 기록의 규칙 점검 시각으로 센다(③ readWritingSummary times).
  let writingTimes=[];if(exam.type==='topik2'&&typeof writingPractice?.attempts==='function'){try{const times=writingPractice.attempts();writingTimes=Array.isArray(times)?times:[];}catch{writingTimes=[];}}
  // 말하기를 고른 학생만 시험 정보에 speaking:true · 말하기 후보 · 필요 · 이번 주 시각이 더해진다(고르지 않은 학생의 계획 입력은 그대로다).
  const examPlan=position.exam.buildExamPlan({exam:speaking?{...exam,speaking:true}:exam,summary,now,audioAvailable,classwork:classworkRows(),lastCheckAt,...(speaking?{speakingNeeds:speaking.untried}:{}),
   done:position.exam.weekActivity({events,progress:progress.exportSnapshot(),week,extra:[...(writingTimes.length?[{area:'writing',times:writingTimes}]:[]),...(speaking?.times.length?[{area:'speaking',times:speaking.times}]:[])]}),
   available:{practice:practice?practice.practiceSupply({pool,seen,audioAvailable}):{},listening,recheck:diagnostic?.items?.length||0,life:true,
    writing:writingAvailable,topik2:topik2Domains(),...(speaking?{speaking:speaking.list}:{})}});
  if(examPlan&&mock)examPlan.mock={status:mock.status,minutes:mock.minutes,total:mock.total,sections:mock.sections.map(row=>({section:row.section,status:row.status,count:row.items.length,minutes:row.minutes}))};
  return createPlan({summary,progress:progress.exportSnapshot(),settings:values,now,recommendActivities,extra,examPlan});
 }
 function refresh(){
  if(stopped||refreshing)return current;refreshing=true;
  try{
   check();void loadBank();const progress=getProgress(),save=progress.status();
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
  if(applyPreferences()===false){home.toast('도움 방식을 저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');return;}
  return launch(selected);
 }
 // 고른 활동 열기: 게임·복습·레슨, 짧은 연습(그 항목), 짧은 진단(내 위치에서 바로 시작), 시험 형식 연습, 쓰기·말하기 연습(호스트가 연다).
 function launch(selected){
  if(selected.route==='game')return launchGame(selected.gameId);
  if(selected.route==='review')return startReview(selected.lessonId,selected.reviewIds);
  if(selected.route==='practice')return startPractice(selected.skillId);
  if(selected.route==='position')return openPosition({start:true});
  if(selected.route==='mock')return openMock();
  if(selected.route==='writing'&&typeof writingPractice?.open==='function')return writingPractice.open(selected.routeId);
  if(selected.route==='speaking'&&typeof speakingPractice?.open==='function')return speakingPractice.open(selected.routeId);
  return startLesson(selected.lessonId);
 }
 // presetExam(주소의 ?exam=, 아래 examLink): 「시험·자격 준비 → 그 시험」을 이 창에만 채워 둔다. 저장은 학생이 저장 스위치를 켜고 누를 때만이고,
 // 저장하면 이번 주 계획으로 간다. 이미 고른 목표 급이 그 시험의 급이 아니면 비운다.
 function open({continueAfter=false,presetExam=null}={}){
  check();const progress=getProgress(),saved=progress.learningProfile(),profile=saved.profile,stored=settingsFor(progress.learningProfileValues());let revision=profile.revision;
  const preset=position?.exam&&Object.hasOwn(EXAM_GRADES,presetExam)?presetExam:null;
  const values=preset?{...stored,primaryReason:'exam',examType:preset,targetGrade:EXAM_GRADES[preset].includes(stored.targetGrade)?stored.targetGrade:null}:stored;
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
  // 「말하기 평가도 준비해요」(10-21): 말하기 연습을 쓸 수 있을 때만, TOPIK I·II를 고르면 보인다. 이 기기에만 저장하는 선택이라 글이 그렇게 밝힌다.
  const speakingOffer=speakingCall('available')===true,speakingRow=speakingOffer?`<label class="study-consent study-speaking" data-study-speaking${['topik1','topik2'].includes(values.examType)?'':' hidden'}><input type="checkbox" name="speakingExam" ${speakingChosen()?'checked':''}><span><strong>${t('goal.exam.speaking')}</strong><small>${t('goal.exam.speakingNote')}</small></span></label>`:'';
  const examSection=position?.exam?`<section class="study-exam" data-study-exam${reason==='exam'?'':' hidden'}><p class="life-section-label">EXAM</p><p class="study-exam-note">${t('goal.exam.note')}</p>${past?`<p class="study-exam-past" data-study-exam-past>${t('goal.exam.past')}</p>`:''}
    <fieldset class="study-group"><legend>${t('goal.exam.type')}</legend><div class="study-pills study-wrap">${radios('examType',EXAM_TYPES.map(id=>[id,t(`goal.exam.type.${id}`)]),values.examType||'')}</div></fieldset>
    <fieldset class="study-group" data-study-grade${['topik1','topik2'].includes(values.examType)?'':' hidden'}><legend>${t('goal.exam.grade')}</legend><div class="study-pills study-wrap">${radios('targetGrade',[['',t('goal.exam.none')],...gradeOptions],values.targetGrade?String(values.targetGrade):'',id=>id&&gradeType(id)!==values.examType?` data-grade-type="${gradeType(id)}" hidden`:id?` data-grade-type="${gradeType(id)}"`:'')}</div></fieldset>
    ${speakingRow}
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
   <div class="life-actions"><button class="felt-button" type="submit">${t(continueAfter||preset?'goal.saveStart':'goal.save')} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-study-skip>${t(profile.status==='new'?'goal.skip':'goal.close')}</button></div>
   ${profile.status==='active'?`<div class="study-controls"><button type="button" class="quiet-button" data-study-clear="disable">${t('goal.disable')}</button><button type="button" class="quiet-button" data-study-clear="delete">${t('goal.delete')}</button></div>`:''}
  </form>`,{type:'world-study',eyebrow:'GOALS',nav:'me'});
  const form=target.document.querySelector('#world-study-form');if(!form)return;
  const status=form.querySelector('.study-save-status');let busy=false;
  // 이유가 「시험·자격 준비」일 때만 시험 칸을 펼치고, 시험 종류에 맞는 목표 급만 보인다.
  const exam=form.querySelector('[data-study-exam]'),grade=form.querySelector('[data-study-grade]'),speakingBox=form.querySelector('[data-study-speaking]');
  const sync=()=>{
   if(exam)exam.hidden=form.elements.reason.value!=='exam';
   const monthValue=form.elements.examMonth?.value||'',daySelect=form.elements.examDay;
   if(daySelect){const last=/^\d{4}-\d{2}$/.test(monthValue)?new Date(Date.UTC(Number(monthValue.slice(0,4)),Number(monthValue.slice(5)),0)).getUTCDate():31;
    for(const option of daySelect.options){const off=Number(option.value)>last;option.disabled=off;option.hidden=off;}
    if(Number(daySelect.value)>last)daySelect.value='';}
   const type=form.elements.examType?.value||'';
   if(speakingBox)speakingBox.hidden=!['topik1','topik2'].includes(type);
   if(grade){grade.hidden=!['topik1','topik2'].includes(type);
    for(const pill of grade.querySelectorAll('[data-grade-type]')){const show=pill.dataset.gradeType===type;pill.hidden=!show;const input=pill.querySelector('input');if(!show&&input?.checked){input.checked=false;grade.querySelector('input[value=""]').checked=true;}}}
  };
  form.addEventListener('change',event=>{if(['reason','examType','examMonth'].includes(event.target?.name))sync();});sync();
  const valid=()=>{check();if(progress!==getProgress()||!form.isConnected)throw Error('설정을 다시 열어 주세요.');};
  // after: 저장한 뒤 갈 곳(주소로 연 창의 「저장하고 시작하기」만 넘긴다). 없으면 처음 실행은 다음 연습, 그 밖에는 저장 알림.
  const run=async(operation,after=null)=>{if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{valid();operation();boardExam=null;revision=progress.learningProfile().profile.revision;await progress.flush();valid();if(progress.learningProfile().profile.status!=='skipped'){await prepare();valid();try{await target.SYNKLearningHost?.ready?.();}catch{/* the save still goes to this device */}valid();if(applyPreferences({explicit:true})===false)throw Error('도움 방식을 저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');}refresh();home.closePanel();if(after)await after();else if(continueAfter)await next();else home.toast(t('goal.saved'));}catch(error){if(form.isConnected)status.textContent=tMessage(error.message)||t('goal.retry');}finally{busy=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
  // 고른 시험 정보: 시험을 고르지 않았으면 모두 지운다(다른 이유로 바꾸면 시험 계획도 끝난다). 날은 그 달에 있는 날만.
  const examValues=reason=>{
   if(reason!=='exam'||!exam)return {examType:null,targetGrade:null,examDate:null,examMode:null,weeklyMinutes:null};
   const type=form.elements.examType?.value||null,level=Number(form.elements.targetGrade?.value)||null,monthValue=form.elements.examMonth?.value||'',dayValue=form.elements.examDay?.value||'';
   const date=monthValue?dayValue&&position.exam.parseExamDate(`${monthValue}-${dayValue.padStart(2,'0')}`)?`${monthValue}-${dayValue.padStart(2,'0')}`:monthValue:null;
   const weekly=Number(form.elements.weeklyMinutes?.value)||null,mode=form.elements.examMode?.value||null;
   return {examType:type,targetGrade:type&&EXAM_GRADES[type]?.includes(level)?level:null,examDate:date,examMode:mode,weeklyMinutes:weekly};
  };
  // 「말하기 평가도 준비해요」는 학습 목표를 저장한 뒤 이 기기에만 쓴다(계정·손님마다). 시험을 고르지 않았거나 TOPIK I·II가 아니면 끈다.
  // 그 칸이 없던 창(말하기 연습을 아직 못 쓰는 때)의 저장은 이 기기 선택을 건드리지 않는다.
  const saveSpeaking=reason=>{const box=form.elements.speakingExam;if(!box)return;speakingCall('choose',owner,reason==='exam'&&['topik1','topik2'].includes(form.elements.examType?.value||'')&&box.checked);};
  // 저장 스위치가 둘(말하기 평가 · 기억하기)이라 이름으로 찾는다.
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.elements.consent.checked){status.textContent=t('goal.needConsent',{name:consentName});form.elements.consent?.focus?.();return;}
   const reason=form.elements.reason.value,minutes=Number(form.elements.minutes.value);
   void run(()=>{progress.updateLearningProfile({consent:true,expectedRevision:revision,values:{reasons:reason?[reason]:null,primaryReason:reason||null,goal:null,support:form.elements.support.value,explanation:form.elements.explanation.value,...examValues(reason)},today:{...(minutes?{minutes}:{}),audio:form.elements.audio.value}});saveSpeaking(reason);},
    // 주소로 연 창의 「저장하고 시작하기」: 시험을 고른 채 저장했으면 이번 주 계획, 학생이 이유를 시험 밖으로 바꿨으면 첫 실행처럼 다음 연습.
    // 계획을 띄우지 못하면(그사이 다른 판을 열었거나 계획이 없음) 저장 알림만, 그사이 계정이 바뀌어 이 화면이 닫혔으면 아무것도.
    preset?async()=>{if(!position.exam.examInfo(progress.learningProfileValues()))return next();
     let shown='missing';try{shown=await openPlan({quiet:true});}catch{if(stopped)return;}
     if(shown!=='shown')home.toast(t('goal.saved'));}:null);
  });
  // 처음 온 사람의 「건너뛰기」: 주소로 연 창도 단추가 「저장하고 시작하기」라 첫 실행 창처럼 건너뛴 뒤 다음 연습을 연다.
  form.querySelector('[data-study-skip]').addEventListener('click',()=>{if(profile.status==='new')void run(()=>progress.clearLearningProfile({mode:'skip',expectedRevision:revision}),preset?next:null);else home.closePanel();});
  // 목표를 지우면 이 기기의 말하기 선택도 끈다(끄기만 하면 다시 켤 때 그대로 둔다).
  form.querySelectorAll('[data-study-clear]').forEach(button=>button.addEventListener('click',()=>void run(()=>{progress.clearLearningProfile({mode:button.dataset.studyClear,expectedRevision:revision});if(button.dataset.studyClear==='delete'&&speakingChosen())speakingCall('choose',owner,false);})));
 }
 // 주소의 ?exam=topik1|topik2(10-22, 메일·신청 페이지의 무료 연습 링크 — 앱 셸이 첫 실행을 마치고 들어온 뒤 한 번 부른다):
 // 그 시험을 이미 목표로 저장한 사람은 이번 주 계획(계획을 세우지 못하면 목표 창), 아니면 그 시험을 채워 둔 학습 목표 창. 묻지 않고 저장하지 않는다.
 // 「아직 못 읽어요」를 고른 사람에게는 열지 않는다 — 한글 만나기가 먼저다(next와 같은 규칙). 이미 열린 판이나 기다리는 사이 학생이 연 판은 덮지 않는다.
 async function examLink(type){
  check();if(!position?.exam||!Object.hasOwn(EXAM_GRADES,type)||home.openPanel?.())return false;
  const progress=getProgress();let reading=null;try{reading=progress.hangulReading?.()?.answer||null;}catch{}
  if(reading==='new')return false;
  if(progress.learningProfile().profile.status==='active'&&position.exam.examInfo(settingsFor(progress.learningProfileValues()))?.type===type){
   const shown=await openPlan({quiet:true});if(shown!=='missing')return shown==='shown';
  }
  open({presetExam:type});return true;
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
 // 「이 항목 연습하기」를 달 수 있는 항목: 검수 통과 새 문항이 남은 항목(짧은 연습 — 읽기·듣기, TOPIK I·II), 그다음 듣기는 지금 추천 후보
 // 가운데 그 항목의 새 문항이 남은 게임. 소리를 끈 날은 듣기를 달지 않는다.
 function practiceRoutes(coachNow){
  const seen=seenBy(coachNow),routes=new Map();
  const practice=position?.practice;
  let audio=true;try{audio=getProgress().learningProfileValues().audio!=='off';}catch{}
  if(practice&&coachNow){let supply={};try{supply=practice.practiceSupply({pool:practice.pool,seen,audioAvailable:audio});}catch{supply={};}for(const [skillId,count]of Object.entries(supply))if(count>0)routes.set(skillId,{route:'practice',skillId});}
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
  let summary=empty,events=[],values={};
  try{summary=coachNow?.summary()||empty;events=coachNow?.events?.()||[];}catch{summary=empty;events=[];}
  try{values=getProgress().learningProfileValues()||{};}catch{values={};}
  const exam=examOf(values),audioAvailable=values.audio!=='off';
  const map=position.buildPositionMap({summary,events,policy:engine.POLICY,prefer,exam});
  const seen=seenBy(coachNow);
  let plan=null;try{plan=position.selectDiagnostic({summary,items:position.items,seen,audioAvailable,exam});}catch{plan=null;}
  // 예상 급수 문턱: 시험 형식 연습(미니 모의)에서 처음 본 문항에 혼자 낸 첫 답만 근거로 센다(PBT 판, 그 시험만). 추정 방법이 검증되기
  // 전이라 문턱을 넘어도 범위는 보이지 않는다. 학생이 IBT로 본다고 했으면 PBT 연습의 답으로 IBT 범위를 읽지 않는다고 알린다.
  let evidence=[];try{evidence=position.mock?.mockEvidence?.({events,asOf:new Date().toISOString()})||[];}catch{evidence=[];}
  const gate=position.estimateGate({evidence,asOf:new Date().toISOString(),form:formOf(exam),mode:values.examMode||null});
  const mock=summary.evidenceComplete?mockPlan({coachNow,values,exam}):null;
  // TOPIK II 판에서는 쓰기 연습(③)으로 가는 줄을 함께 둔다 — 쓰기는 자동 판정이 없어 항목 칸에 넣지 않는다.
  const writing=exam==='topik2'&&writingList().length>0;
  // 판에서 고를 수 있는 시험: TOPIK II를 고른 사람이거나 검수 통과 TOPIK II 문항이 있을 때 TOPIK I·II 둘 다.
  const two=topik2Domains(),exams=studentExam(values)==='topik2'||two.listening||two.reading?['topik1','topik2']:null;
  // TOPIK II 판: TOPIK II 문항이 아직 없는 영역은 이번 주 계획이 TOPIK I 항목으로 센다(계획의 available.topik2와 같은 판단) — 판이 그 영역에 알린다.
  const bridged=exam==='topik2'?['listening','reading'].filter(domain=>!two[domain]):[];
  return {map,plan,gate,mock,exam,writing,exams,bridged,summary};
 }
 function showBoard(coachNow,{keepScroll=false}={}){
  check();
  // 듣기 항목의 「이 항목 연습하기」는 지금 추천 후보에서 찾으므로 판을 그리기 전에 추천을 새로 세운다(10-21 검수).
  refresh();
  const scroller=keepScroll?panelNode('[data-position-board]')?.closest?.('#panel-content'):null,scrollTop=scroller?.scrollTop||0;
  const routes=practiceRoutes(coachNow),{map,plan,gate,mock,exam,writing,exams,bridged,summary}=positionData(coachNow,id=>routes.has(id));
  let scope=null;try{scope=getProgress().status().scoped?'account':'device';}catch{}
  home.showPanel(t('position.title'),view.renderPositionBoard({map,plan,gate,mock,exams,writing,bridged,catalog:position.label,diagnosed,scope,practice:id=>routes.get(id)||null}),PANEL);
  const root=panelNode('[data-position-board]');
  if(root&&position.followups){
   void loadFollowupBank();const delayed=delayedRows();
   const rows=delayed.rows.map(row=>`<li><strong>${escape(t(`position.skill.${row.measure.skillId}`))}</strong> · ${escape(t(`followup.window.${row.window}`))}<p>${escape(t(`followup.status.${row.status}`))}${row.status==='not_due'?` · ${escape(formatDate(Date.parse(row.dueAt),{month:'short',day:'numeric'}))}`:''}${row.outcome?` · ${escape(t(`followup.outcome.${row.outcome}`))}`:''}</p>${row.status==='due'?(row.available?`<button class="quiet-button" data-followup="${escape(row.id)}">${escape(t('followup.open'))}</button>`:`<p>${escape(t('followup.noSupply'))}</p>`):''}</li>`).join('');
   root.insertAdjacentHTML('beforeend',`<section class="wpos-followups"><h3>${escape(t('followup.title'))}</h3><p>${escape(t('followup.note'))}</p>${delayed.limited?`<p role="status">${escape(t('followup.incomplete'))}</p>`:''}${rows?`<ul>${rows}</ul>`:`<p>${escape(t('followup.empty'))}</p>`}</section>`);
   root.querySelectorAll('[data-followup]').forEach(button=>button.addEventListener('click',()=>{void startPractice(null,{followupId:button.dataset.followup}).catch(failed);}));
   const supply=position.practice.practiceSupply({pool:position.practice.pool,seen:seenBy(coachNow)});
   const targets=map.skills.filter(row=>['practice','supported','review'].includes(row.status)||row.incorrect>0).map(row=>row.id);
   const advisory=advisoryRows({targets,summary,lookup:position.recommendedBefore,supply});
   if(advisory.length){root.insertAdjacentHTML('beforeend',`<section class="wpos-advisory"><h3>${escape(t('followup.advisory'))}</h3><p>${escape(t('followup.optional'))}</p>${advisory.map(row=>`<p><button class="quiet-button" data-advisory="${escape(row.id)}">${escape(t(`position.skill.${row.id}`))}</button> → ${escape(t(`position.skill.${row.target}`))}</p>`).join('')}</section>`);
    root.querySelectorAll('[data-advisory]').forEach(button=>button.addEventListener('click',()=>{void startPractice(button.dataset.advisory).catch(failed);}));}
  }
  if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;}else root?.focus?.({preventScroll:true});
  panelNode('[data-position-diagnostic]')?.addEventListener('click',()=>{try{startDiagnostic(coachNow,plan,map);}catch(error){failed(error);}},{once:true});
  root?.querySelectorAll?.('[data-position-exam]').forEach(button=>button.addEventListener('click',()=>{try{check();boardExam=button.dataset.positionExam==='topik2'?'topik2':'topik1';showBoard(readCoach(),{keepScroll:true});}catch(error){failed(error);}}));
  root?.querySelector?.('[data-position-mock]')?.addEventListener('click',()=>{try{check();void Promise.resolve(openMock({exam})).catch(failed);}catch(error){failed(error);}});
  root?.querySelector?.('[data-position-writing]')?.addEventListener('click',()=>{try{check();const first=writingList()[0];if(first&&typeof writingPractice?.open==='function')void Promise.resolve(writingPractice.open(first.route)).catch(failed);}catch(error){failed(error);}});
  bindPractice(root,routes);
  return {coachNow,plan,map};
 }
 // 은행을 다 불러오면 열려 있는 판을 새 문항으로 다시 그린다(진단·연습·모의가 진행 중일 때는 건드리지 않는다).
 function repaint(){
  try{
   if(home.openPanel?.()==='')return;
   if(panelNode('[data-position-board]')&&!panelNode('[data-position-board="hangul"]'))showBoard(readCoach(),{keepScroll:true});
   else if(panelNode('[data-plan-board]'))void openPlan({keepScroll:true});
  }catch{/* the next open draws it */}
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
  // 기다리는 동안 판을 닫거나 다른 판을 열면 이 표만 무효로 한다. 정상으로 그리기 직전에 settled가 되어 showPanel의 정리는 무시된다.
  let settled=false;
  home.attachPanelResource?.({dispose(){if(!settled&&ticket===positionOpen)positionOpen++;}});
  // 계정의 학습 호스트를 먼저 세운다(다음 연습과 같다). 세우지 못해도 판은 열고, 기록이 덜 왔다고 알린다.
  try{await prepare();}catch{/* the board shows the records as incomplete */}
  check();if(ticket!==positionOpen)return;
  try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still shows */}
  check();if(ticket!==positionOpen)return;
  try{await bankReady();}catch{/* the board opens with the reviewed game items */}
  check();if(ticket!==positionOpen)return;
  let coachNow=null;try{coachNow=readCoach();}catch{coachNow=null;}
  let reading=null;try{reading=getProgress().hangulReading?.()||null;}catch{reading=null;}
  let stage;
  try{stage=await hangulStage(coachNow);}catch(error){check();if(ticket===positionOpen)failed(error);return;}
  check();if(ticket!==positionOpen)return;
  settled=true;
  if(position.showsHangulBoard({reading,stage})){showHangul(stage);return;}
  const shown=showBoard(coachNow);
  if(start&&shown.plan?.status==='ready'&&shown.plan.items.length)startDiagnostic(shown.coachNow,shown.plan,shown.map);
 }
 // 진단 한 바퀴는 한 판 안에서 문항만 바꿔 그린다. 판을 닫거나 다른 판이 열리면(attachPanelResource) 보이던 문항은 건너뛴 것으로 남긴다.
 function startDiagnostic(coachNow,plan,map){
  check();
  if(!coachNow||plan?.status!=='ready'||!plan.items.length)return;
  runDiagnostic({coachNow,items:plan.items,map,title:t('position.diagnostic.title'),eyebrow:'QUICK CHECK',done:({box,results})=>{
   const set=finishSet(coachNow,'diagnostic');
   // 끝 화면의 「이 항목 연습하기」는 새 추천(refresh) 뒤의 후보로 고른다 — 방금 푼 진단 문항은 이제 본 문항이다.
   refresh();const routes=practiceRoutes(coachNow);
   let after=map;try{after=position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[],policy:engine.POLICY,prefer:id=>routes.has(id),exam:map.exam});}catch{after=map;}
   box.innerHTML=view.renderDiagnosticDone({map:after,results,items:position.itemsById,practice:id=>routes.get(id)||null,response:responseView(set,'diagnostic')});
   bindPractice(box,routes);bindResponse({box,coachNow,set,kind:'diagnostic'});
   box.querySelector('[data-position-done]')?.focus?.({preventScroll:true});
   evidenced();
  }});
 }
 // 진단 판 한 바퀴(「내 위치」 짧은 진단과 마을 준비 확인이 함께 쓴다). done({box,results,top}): 끝 화면을 그린다.
 // stopLabel·onStop: 그만두기 단추의 글과 그 뒤에 열 판(없으면 진단 글과 「내 위치」 판).
 function runDiagnostic({coachNow,items,map,title,eyebrow,done,stopLabel=null,onStop=null}){
  const session=position.createDiagnosticSession({coach:coachNow,items});
  const skillOf=id=>map.skills.find(skill=>skill.id===id)||{id};
  let clip=null,playing=false,notice='',ended=false;
  const silence=()=>{const sound=clip;clip=null;playing=false;try{sound?.pause();}catch{}};
  const stop=()=>{if(ended)return;ended=true;silence();try{session.stop();}catch{}try{coachNow.flush?.();}catch{}if(session.results().length)diagnosed=true;queueMicrotask(()=>refresh());};
  home.showPanel(title,'<div class="wpos-stage" data-position-stage></div>',{...PANEL,eyebrow});
  home.attachPanelResource?.({dispose:stop});
  const box=panelNode('[data-position-stage]');if(!box){stop();return;}
  // 배우기 판(life-*)은 내용 칸(#panel-content)이 스크롤되고, 다른 시트는 판 자체가 스크롤된다. 둘 다 맨 위로.
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  // focus: 새 문항이면 항목 이름으로, 같은 문항을 다시 그릴 때(듣기 시작·끝)는 고른 곳으로 초점을 옮긴다.
  function paint(focus='.wpos-run-skill'){
   const now=session.current;if(!now){finish();return;}
   box.innerHTML=view.renderDiagnosticItem({view:now,skill:skillOf(now.item.skillId),notice,playing,stopLabel});
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
   done({box,results,top});top();
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
    else if(button.hasAttribute('data-position-stop')){stop();if(onStop)onStop();else showBoard(readCoach());}
    else if(button.hasAttribute('data-position-back'))showBoard(readCoach());
   }catch(error){stop();failed(error);}
  });
  advance('');
 }
 // ── 마을 준비 확인(싱크타운 학습·개인화 다리 §4-2 · world-town-check.mjs) ──
 // 판정은 서버(town/check)가 한다. 시트의 시작 단추 → 이미 낸 첫 답으로 먼저 확인(동기화를 끈 학습자는 그 답을 그때 한 번 보낸다 —
 // 시트가 그렇게 알린다) → 아직이면 모자란 영역만 처음 보는 계열로 진단과 같은 판 → 다시 확인 → 끝 한 장. 다시 하는 횟수에 제한이 없다.
 const evidenced=()=>{try{town?.evidence?.();}catch{/* the town check is optional */}};
 let townOpen=0;
 async function townCheck(){
  if(!position||!view||!town?.kit||typeof town.check!=='function')return;
  check();const ticket=++townOpen;
  try{await prepare();}catch{/* checked below */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* checked below */}
  check();try{await bankReady(8000);}catch{/* the check says what is missing */}
  check();if(ticket!==townOpen)return;
  const coachNow=readCoach();if(!coachNow){home.toast(t('practice.unavailable'));return;}
  // 기록이 덜 왔으면 「처음 보는 문항」을 약속할 수 없어 열지 않는다(「내 위치」 진단과 같다).
  if(!coachNow.summary().evidenceComplete){home.toast(t('position.diagnostic.history'));return;}
  home.showPanel('마을 준비 확인','<div class="wpos-stage" data-town-stage></div>',{...PANEL,eyebrow:'TOWN CHECK'});
  const box=panelNode('[data-town-stage]');if(!box)return;
  box.innerHTML=view.renderTownCheckWait();box.querySelector('[data-town-wait]')?.focus?.({preventScroll:true});
  // 첫 확인은 30초 규칙을 기다리지 않는다 — 시트를 연 직후라면 서버가 지난 결과(retryAfterMs)를 주고, 그 모자란 영역으로 바로 문항을 낸다(검수 F1).
  let first;try{first=await townSend(coachNow,{wait:false});}catch(error){if(ticket===townOpen)failed(error);return;}
  if(ticket!==townOpen||!box.isConnected)return;
  // 열렸거나, 확인은 마쳤는데 체험·이용권이 없거나(access — 문항을 더 내지 않는다), 미룸·보류면 바로 끝 화면.
  if(town.kit.townOutcome({result:first})!=='not-yet'){townDone({box,coachNow,result:first,results:[]});return;}
  let audioAvailable=true;try{audioAvailable=getProgress().learningProfileValues().audio!=='off';}catch{}
  const missing=Array.isArray(first?.missing)&&first.missing.length?first.missing:['reading','listening'];
  let plan=null;try{plan=town.kit.selectTownCheck({summary:coachNow.summary(),items:position.topik?.items||[],seen:seenBy(coachNow),audioAvailable,missing});}catch{plan=null;}
  if(plan?.status!=='ready'){townDone({box,coachNow,result:first,results:[],short:true});return;}
  let map;try{map=position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[],policy:engine.POLICY});}catch{map={skills:[]};}
  // 새 문항이 창보다 적어도(short) 낸다 — 서버 창은 앞서 낸 첫 답과 합쳐 세어 통과할 수 있다. 그래도 아직이면 끝 화면이 모자람을 알린다.
  runDiagnostic({coachNow,items:plan.items,map,title:'마을 준비 확인',eyebrow:'TOWN CHECK',stopLabel:'확인 그만하기',onStop:()=>{try{town.open?.();}catch(error){failed(error);}},done:({box:stage,results,top})=>{
   stage.innerHTML=view.renderTownCheckWait({after:true});stage.querySelector('[data-town-wait]')?.focus?.({preventScroll:true});
   void (async()=>{
    let result;try{result=await townSend(coachNow);}catch{result={outcome:'later'};}
    if(!stage.isConnected)return;
    // 방금 서버가 판정했으니 조용한 확인(evidenced)은 부르지 않는다.
    townDone({box:stage,coachNow,result,results,map,short:plan.short===true});top();
   })();
  }});
 }
 // 서버 입장 확인 한 번. 보낼 답은 판정 창의 첫 답(Trail 사건, 글 없음) — 동기화를 켠 계정은 서버에 이미 있어 같은 id면 서버 것을 쓴다.
 // wait: 30초 안에 다시 물어 서버가 지난 결과와 retryAfterMs를 주면 그만큼 기다려 한 번 더 묻는다(문항을 다 푼 뒤의 확인).
async function townSend(coachNow,{wait=true}={}){
  const byKey=new Map((position.items||[]).map(item=>[item.itemKey,item]));
  let answers=[];try{answers=town.kit.townCheckAnswers({events:coachNow.events?.()||[],items:byKey,now:Date.now()});}catch{answers=[];}
  let sound=true;try{sound=getProgress().learningProfileValues().audio!=='off';}catch{}
  const body={bankHash:position.topik?.hash||null,sound,answers};
  let result=await town.check(body);check();
  // 30초 안에 다시 물었으면 서버가 지난 결과와 다시 볼 수 있는 때를 준다 — 그때 한 번만 다시 묻는다.
  if(wait&&Number.isFinite(result?.retryAfterMs)&&result.retryAfterMs>0&&result.retryAfterMs<=30000){await new Promise(resolve=>setTimeout(resolve,result.retryAfterMs+300));check();result=await town.check(body);check();}
  return result;
 }
 function townDone({box,coachNow,result,results,map=null,short=false}){
  const outcome=town.kit.townOutcome({result,short});
  refresh();const routes=practiceRoutes(coachNow);
  // 연습 추천 하나: 이번에 틀린 문항의 항목 먼저, 없으면 모자란 영역에서 지금 낼 새 문항이 있는 항목.
  const wrong=results.find(row=>!row.skipped&&row.verdict==='incorrect'&&routes.has(row.skillId));
  const area=(result?.missing||[])[0],other=[...routes.keys()].find(id=>/^ko\./.test(id)&&(!area||id.split('.')[1]===area));
  const recommend=['passed','access','held','deferred','later'].includes(outcome)?null:wrong?{skillId:wrong.skillId}:other?{skillId:other}:null;
  box.innerHTML=view.renderTownCheckDone({outcome,results,map,items:position.itemsById,recommend,practice:id=>routes.get(id)||null});
  bindPractice(box,routes);
  box.querySelector('[data-town-open]')?.addEventListener('click',()=>{try{check();town.open?.();}catch(error){failed(error);}},{once:true});
  box.querySelector('[data-town-recheck]')?.addEventListener('click',()=>{try{check();void Promise.resolve(townCheck()).catch(failed);}catch(error){failed(error);}},{once:true});
  box.querySelector('[data-town-position]')?.addEventListener('click',()=>{try{check();void openPosition();}catch(error){failed(error);}},{once:true});
  box.querySelector('[data-town-done]')?.focus?.({preventScroll:true});
  if(outcome==='passed'||outcome==='access'){try{town.passed?.(result);}catch{/* the sheet reads the gate again */}}
 }
 // 첫 장면 배치(다리 §4-3)의 재료: 이 계정 학습 기록(내 기기)과 다 읽혔는지. 타운이 첫 대화 전에 묻는다(호스트 placement()).
 function townEvidence(){
  check();const coachNow=readCoach();if(!coachNow)return null;
  try{const summary=coachNow.summary();return {events:coachNow.events?.()||[],evidenceComplete:summary?.evidenceComplete===true};}catch{return null;}
 }
 // ── 짧은 연습(10-20 검수 #1 읽기 · 10-21 ④ 듣기·TOPIK II, world-reading-practice.mjs) ──
 // 한 항목의 새 문항 몇 개: (듣기면 끝까지 들음) → 답 → 기록(Trail, 코치 'world-practice') → 맞음·정답·해설 → 다음. 끝에 그 항목의 바뀐 관측 한 줄.
 // 그 항목의 새 문항이 없으면 다른 항목 문항으로 채우지 않고, 모자람을 알리며 내 위치(다른 항목·다시 확인)로 이끈다.
 // 소리는 실제 재생기의 끝(ended)·실패(error)만 알린다(진단과 같다). 시험형 듣기는 허용 횟수까지 혼자, 그 뒤는 도움.
 function soundPlayer({session,url,onChange}){
  let clip=null,playing=false;
  const silence=()=>{const sound=clip;clip=null;playing=false;try{sound?.pause();}catch{}};
  function play(){
   const now=session.current;if(!now||now.answered||playing||!now.item.audio)return null;
   const kind=session.replay();if(!kind||kind==='closed')return kind;
   // 재생기를 못 만들면 늘 실패를 알린다 — 세션이 「소리 나는 중」으로 남지 않게(들은 뒤의 실패는 세션이 기록하지 않는다).
   let sound;try{sound=new target.Audio(url(now.item.audio));}catch{try{session.delivery('failed');}catch{}onChange('failed');return kind;}
   clip=sound;playing=true;onChange('playing');
   const done=status=>{if(clip!==sound)return;clip=null;playing=false;try{session.delivery(status);}catch{}onChange(status);};
   sound.addEventListener('ended',()=>done('completed'),{once:true});
   sound.addEventListener('error',()=>done('failed'),{once:true});
   Promise.resolve(sound.play()).catch(()=>done('failed'));
   return kind;
  }
  return {play,silence,get playing(){return playing;}};
 }
 let practiceOpen=0;
 async function startPractice(skillId,{followupId=null}={}){
  if(!position?.practice)return;
  check();const ticket=++practiceOpen;
  try{await prepare();}catch{/* device-local practice still runs */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local practice still runs */}
  check();try{await bankReady();}catch{/* reviewed game items still run */}
  if(followupId){await Promise.race([loadFollowupBank(),new Promise(resolve=>setTimeout(resolve,4000))]);check();}
  check();if(ticket!==practiceOpen)return;
  const coachNow=readPracticeCoach();if(!coachNow){home.toast(t('practice.unavailable'));return;}
  let audioAvailable=true;try{audioAvailable=getProgress().learningProfileValues().audio!=='off';}catch{}
  const followup=followupId?delayedRows().rows.find(row=>row.id===followupId&&row.status==='due'&&row.available):null;
  if(followupId&&!followup){home.toast(t('followup.noSupply'));return;}
  if(followup)skillId=followup.measure.skillId;
  const summary=coachNow.summary(),seen=seenBy(coachNow),exam=skillExam(skillId),listening=String(skillId).split('.')[1]==='listening';
  const selection=followup?{status:'ready',items:[followup.item]}:position.practice.selectPractice({summary,pool:position.practice.pool,seen,skillId,audioAvailable,count:practiceLength()});
  if(selection.status==='none'){home.toast(t(selection.reason==='history.incomplete'?'position.diagnostic.history':selection.reason==='audio'?'practice.audioOff':'practice.shortage'));void openPosition();return;}
  const session=position.practice.createPracticeSession({coach:coachNow,items:selection.items});
  const mapOf=()=>{try{return position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[],policy:engine.POLICY,exam});}catch{return null;}};
  const before=mapOf()?.skills.find(skill=>skill.id===skillId)||null;
  let ended=false,notice='';
  // 아직 못 들은 문항의 재생 실패는 듣기 칸 한 줄(listenNote)이 알린다 — 상태 줄에는 이미 들은 뒤 다시 듣기가 실패했을 때만.
  const player=soundPlayer({session,url:audioUrl,onChange:state=>{if(ended)return;notice=state==='failed'&&session.current?.heard?t('position.diagnostic.audioFailed'):'';paint(state==='completed'?'.wpos-choice:not([disabled])':'[data-practice-listen]');}});
  const stop=()=>{if(ended)return;ended=true;player.silence();try{session.stop();}catch{}try{coachNow.flush?.();}catch{}queueMicrotask(()=>refresh());};
  home.showPanel(t(listening?'practice.title.listening':'practice.title'),'<div class="wpos-stage" data-practice-stage></div>',{...PANEL,eyebrow:'PRACTICE'});
  home.attachPanelResource?.({dispose:stop});
  const box=panelNode('[data-practice-stage]');if(!box){stop();return;}
  const skill={id:skillId,label:skillLabel(skillId)};
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  function paint(focus='.wpos-run-skill'){
   const now=session.current;if(!now){finish();return;}
   box.innerHTML=view.renderPracticeItem({view:now,skill,feedback:now.feedback,playing:player.playing,notice});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  function advance(){player.silence();notice='';if(!session.next()){finish();return;}paint();top();}
  function finish(){
   if(ended&&!box.isConnected)return;
   ended=true;player.silence();try{coachNow.flush?.();}catch{}
   const after=mapOf()?.skills.find(row=>row.id===skillId)||null;
   const more=position.practice.practiceSupply({pool:position.practice.pool,seen:seenBy(coachNow),audioAvailable})[skillId]||0;
   const set=finishSet(coachNow,'short');
   box.innerHTML=view.renderPracticeDone({skill,before,after,results:session.results(),items:new Map([...position.itemsById,...selection.items.map(item=>[item.id,item])]),more:followup?0:more,listening,count:followup?1:practiceLength(),response:responseView(set,'short'),followup:!!followup});
   bindResponse({box,coachNow,set,kind:'short',more});
   box.querySelector('[data-practice-done]')?.focus?.({preventScroll:true});top();
   queueMicrotask(()=>refresh());evidenced();
  }
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||button.disabled)return;
   try{
    check();
    if(button.dataset.practiceChoice){player.silence();notice='';session.answer(button.dataset.practiceChoice);paint('[data-practice-feedback]');}
    else if(button.hasAttribute('data-practice-listen'))player.play();
    else if(button.hasAttribute('data-practice-next'))advance();
    else if(button.hasAttribute('data-practice-skip')){player.silence();session.skip();advance();}
    else if(button.hasAttribute('data-practice-stop')){stop();void openPosition();}
    else if(button.hasAttribute('data-practice-again'))void Promise.resolve(startPractice(skillId)).catch(failed);
    else if(button.hasAttribute('data-practice-position'))void openPosition();
    else if(button.hasAttribute('data-practice-home'))home.closePanel();
   }catch(error){stop();failed(error);}
  });
  advance();
 }
 // ── 시험 형식 연습(미니 모의 · 10-21 ④, world-exam-form.mjs) ──
 // 학생의 시험(TOPIK I·II)으로 실제 구성을 줄인 판을 처음 보는 문항으로 짜고, 영역마다 시간을 잰다(실제 시험의 문항당 시간).
 // 안내 → 영역(듣기 → 읽기, 실제 시험 순서) → 영역 사이 → 끝 한 장(영역별 맞힘·틀림·답하지 않음, 틀린 문항 해설, 다음 연습).
 // 고른 답은 바로 첫 답으로 기록되고 바꾸지 않는다. 정답·해설은 끝난 뒤에만. 급수·점수로 바꾸지 않는다.
 let mockOpen=0;
 async function openMock({exam=null}={}){
  if(!position?.mock)return;
  check();const ticket=++mockOpen;
  try{await prepare();}catch{/* device-local practice still runs */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local practice still runs */}
  check();try{await bankReady();}catch{/* the intro says what is missing */}
  check();if(ticket!==mockOpen)return;
  const coachNow=readMockCoach();if(!coachNow){home.toast(t('practice.unavailable'));return;}
  let values={};try{values=getProgress().learningProfileValues()||{};}catch{values={};}
  const which=exam||studentExam(values);
  const plan=coachNow.summary().evidenceComplete?mockPlan({coachNow,values,exam:which}):null;
  if(!plan||plan.status!=='ready'){home.toast(t(plan?'mock.unavailable':'position.diagnostic.history'));void openPosition();return;}
  const sections=plan.sections.filter(row=>row.status==='ready');
  home.showPanel(t('mock.title'),'<div class="wpos-stage" data-mock-stage></div>',{...PANEL,eyebrow:'EXAM FORM'});
  const box=panelNode('[data-mock-stage]');if(!box)return;
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  box.innerHTML=view.renderMockIntro({plan,exam:which,mode:values.examMode||null});
  box.querySelector('[data-mock-intro]')?.focus?.({preventScroll:true});top();
  box.querySelector('[data-mock-start]')?.addEventListener('click',()=>{try{check();runMock({coachNow,plan,sections,exam:which,mode:values.examMode||null,box,top});}catch(error){failed(error);}},{once:true});
  box.querySelector('[data-mock-later]')?.addEventListener('click',()=>{try{void openPosition();}catch(error){failed(error);}},{once:true});
 }
 function runMock({coachNow,plan,sections,exam,mode=null,box,top}){
  const session=position.mock.createMockSession({coach:coachNow,sections,exam});
  let ended=false,notice='',ticker=null,confirm=false;
  const cell=()=>session.current;
  // finishedAt: 방금 끝난(또는 실패한) 소리의 문항 — 다른 문항을 보고 있을 때 끝나면 초점을 옮기지 않고, 실패는 그 번호로 알린다.
  let finishedAt=null;
  const proxy={get current(){const now=cell();return now&&!now.between?{...now,heard:now.heard}:null;},replay:()=>session.play(),
   delivery:status=>{finishedAt=cell()?.sounding??null;return session.delivery(status);}};
  const player=soundPlayer({session:proxy,url:audioUrl,onChange:state=>{
   if(ended)return;const now=cell(),other=state!=='playing'&&Number.isInteger(finishedAt)&&!!now&&!now.between&&finishedAt!==now.index;
   notice=state!=='failed'?'':other?t('mock.failedOther',{n:finishedAt+1}):now?.heard?t('position.diagnostic.audioFailed'):'';
   paint(state==='playing'?'[data-mock-listen]':other?'.wpos-run-skill':state==='completed'?'.wpos-choice:not([disabled])':'[data-mock-listen]');}});
  const stopTick=()=>{if(ticker){clearInterval(ticker);ticker=null;}};
  const stop=()=>{if(ended)return;ended=true;stopTick();player.silence();try{session.stop();}catch{}try{coachNow.flush?.();}catch{}queueMicrotask(()=>refresh());};
  home.attachPanelResource?.({dispose:stop});
  function paint(focus='.wpos-run-skill'){
   if(ended)return;
   const now=session.current;
   if(!now||session.finished){finish();return;}
   if(now.between){stopTick();player.silence();box.innerHTML=view.renderMockBetween({view:now,parts:session.parts});box.querySelector('[data-mock-between]')?.focus?.({preventScroll:true});top();return;}
   box.innerHTML=view.renderMockItem({view:now,playing:player.playing,notice,confirm,parts:session.parts});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  // 시계: 남은 시간 칸만 1초마다 고치고, 시간이 다 되면 그 영역을 닫는다(session.current가 확인한다).
  function tick(){
   if(ended)return;
   const now=session.current;
   if(!now||now.between){paint();return;}
   const clock=box.querySelector('[data-mock-clock]');if(clock)clock.textContent=view.mockClock(now.remainingMs);
  }
  function startSection(){stopTick();notice='';confirm=false;session.start();ticker=setInterval(tick,1000);paint();top();}
  function finish(){
   if(ended&&!box.isConnected)return;
   ended=true;stopTick();player.silence();try{coachNow.flush?.();}catch{}
   const set=finishSet(coachNow,'mock');
   refresh();const routes=practiceRoutes(readCoach());
   box.innerHTML=view.renderMockDone({results:session.results(),items:position.itemsById,plan,exam,mode,practice:id=>routes.get(id)||null,response:responseView(set,'mock')});
   bindPractice(box,routes);bindResponse({box,coachNow,set,kind:'mock'});
   box.querySelector('[data-mock-done]')?.focus?.({preventScroll:true});top();evidenced();
  }
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||button.disabled)return;
   try{
    check();
    // 영역 안에서 답하거나 다른 번호로 옮겨도 듣던 소리는 끊지 않는다 — 실제 시험처럼 소리는 끝까지 흐르고, 끝난 재생은 시작한 문항의 대본 셈이 된다
    // (끊었다 처음부터 다시 듣는 길이 없다). 소리는 영역이 끝날 때·그만둘 때만 멈춘다.
    if(button.dataset.mockChoice){confirm=false;session.answer(button.dataset.mockChoice);notice=t('position.diagnostic.saved');paint('[data-mock-status]');}
    else if(button.hasAttribute('data-mock-listen'))player.play();
    else if(button.dataset.mockGo){notice='';confirm=false;session.go(Number(button.dataset.mockGo));paint();}
    else if(button.hasAttribute('data-mock-submit')){
     const now=session.current,left=now&&!now.between?now.marks.filter(mark=>mark!=='answered').length:0;
     if(left&&!confirm){confirm=true;paint('[data-mock-confirm]');return;}
     player.silence();confirm=false;const next=session.finishSection();if(!next||session.finished)finish();else paint();
    }
    else if(button.hasAttribute('data-mock-keep')){confirm=false;paint();}
    // 영역 사이의 「다음」: 시간이 다 돼 닫힌 영역이면 먼저 넘기고, 남은 영역이 있으면 그 영역의 시계를 켠다.
    else if(button.hasAttribute('data-mock-next-section')){const now=session.current;if(now?.between&&now.started)session.finishSection();if(session.finished||!session.current)finish();else startSection();}
    else if(button.hasAttribute('data-mock-stop')){player.silence();try{session.stop();}catch{}finish();}
    else if(button.hasAttribute('data-mock-position'))void openPosition();
    else if(button.hasAttribute('data-mock-home'))home.closePanel();
   }catch(error){stop();failed(error);}
  });
  startSection();
 }
 // ── 이번 주 계획(10-20 결정, world-exam-plan.mjs) ──
 // 시험을 고른 사람에게만. 계획은 따로 저장하지 않고 열 때마다 기록·선언값·날짜로 다시 세운다(추천과 같은 계산).
 // quiet: 학생이 누르지 않은 열기(주소 바로가기·저장 뒤) — 기다리는 사이 학생이 다른 판을 열었으면 덮지 않고, 계획이 없어도 목표 창을 열지 않는다.
 // 돌려주는 값: 'shown' · 'skipped'(뒤에 다른 열기가 왔거나 quiet인데 다른 판이 열려 있음) · 'missing'(시험 계획이 없음).
 let planOpen=0;
 async function openPlan({keepScroll=false,quiet=false}={}){
  check();const ticket=++planOpen;
  if(!keepScroll){try{await prepare();}catch{/* the plan shows what this device has */}check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still counts */}check();}
  if(ticket!==planOpen||quiet&&home.openPanel?.())return 'skipped';
  const plan=refresh(),examPlan=plan?.examPlan;
  if(!examPlan||!view){if(!keepScroll&&!quiet)open();return 'missing';}
  const scroller=keepScroll?panelNode('[data-plan-board]')?.closest?.('#panel-content'):null,scrollTop=scroller?.scrollTop||0;
  home.showPanel(t('plan.week.title'),view.renderExamPlan({plan:examPlan,next:plan.selected,reason:tMessage(plan.reason||''),count:practiceLength()}),{type:'life-position',eyebrow:'MY WEEK',nav:'packs'});
  const root=panelNode('[data-plan-board]');if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;}else root?.focus?.({preventScroll:true});
  root?.querySelector('[data-plan-next]')?.addEventListener('click',()=>{try{check();if(plan.selected)void Promise.resolve(launch(plan.selected)).catch(failed);}catch(error){failed(error);}});
  root?.querySelectorAll('[data-plan-practice]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(startPractice(button.dataset.planPractice)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelectorAll('[data-plan-game]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(launchGame(button.dataset.planGame)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelector('[data-plan-recheck]')?.addEventListener('click',()=>{try{check();void openPosition({start:true});}catch(error){failed(error);}});
  root?.querySelectorAll('[data-plan-writing]').forEach(button=>button.addEventListener('click',()=>{try{check();if(typeof writingPractice?.open==='function')void Promise.resolve(writingPractice.open(button.dataset.planWriting)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelector('[data-plan-mock]')?.addEventListener('click',()=>{try{check();void Promise.resolve(openMock()).catch(failed);}catch(error){failed(error);}});
  // 말하기 칸의 「말하기 연습 열기」: 유형 목록을 연다(어느 유형을 할지는 학생이 고른다 — 「지금 할 것」은 아직 안 해 본 유형을 바로 연다).
  root?.querySelector('[data-plan-speaking]')?.addEventListener('click',()=>{try{check();if(typeof speakingPractice?.open==='function')void Promise.resolve(speakingPractice.open('speaking')).catch(failed);}catch(error){failed(error);}});
  return 'shown';
 }
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 // 배우기 판의 「이번 주 계획」 줄(life-ui.mjs moreRows): 시험을 고른 사람에게만. print는 그 판의 인화지 그림.
 function planRow(print=()=>''){
  const plan=current?.examPlan;if(!plan)return '';
  const done=(plan.areas||[]).reduce((n,row)=>n+Math.min(row.done,row.planned),0),total=(plan.areas||[]).reduce((n,row)=>n+row.planned,0);
  return `<button class="life-row" data-view="plan">${print('goals','life-row-print')}<span class="life-row-copy"><strong>${t('plan.week.title')}</strong><small>${escape(t('plan.week.row',{done,total}))}</small></span></button>`;
 }
 // 이번 주 계획의 시험(배우기 판이 TOPIK II 학생의 쓰기 연습 줄을 위로 올릴 때 읽는다). 시험 계획이 없으면 null.
 const examType=()=>current?.examPlan?.exam?.type||null;
 return {next,open,examLink,refresh,repaint,applyPreferences,planRow,examType,positionTotal:topikTotal,responses:responseList,removeResponse,...(position?{position:openPosition,practice:startPractice,plan:openPlan,mock:openMock,townCheck,townEvidence}:{}),presentation(){check();const values=settingsFor(getProgress().learningProfileValues());return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),dispose(){stopped=true;coach?.disconnect?.();practiceCoach?.disconnect?.();mockCoach?.disconnect?.();target.removeEventListener?.('focus',onFocus);}};
}
