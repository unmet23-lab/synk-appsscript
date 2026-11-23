import {t,tMessage,hasString,formatDate,currentLang} from '../brand-opening/world-lang.mjs';
import {followupRows,advisoryRows} from './world-learning-followups.mjs';
import {buildMissedSpot,renderMissedSpot,placeMissedSpot} from './world-missed-spot.mjs';
import {renderPositionPage} from './world-position-page.mjs';
import {lifeFollowupRows} from './life-followups.mjs';
import {lessonById} from './life-content.mjs';
import {lifeTutorExpression} from '../brand-opening/life-tutor-lines.mjs';
import {createMonthAnswers,createMonthAsker,FIRST_KIND,FIRST_GAME,FIRST_DAYS} from './world-month-answer.mjs';

// 「시간을 두고 다시 확인」 카드(11-08 프론트 검수 A2 · B6): Temper 재확인 줄(TOPIK 연습 · 생활 한국어)을 기준 답(sourceAttemptId)마다 카드 하나로
// 묶고 창은 1 · 7 · 30일 차례로 둔다. 지금 확인할 칸이 있는 카드가 먼저, 그다음 아직 안 온 가장 가까운 날짜 차례(다 지난 카드는 뒤).
// 같은 항목 카드가 둘 이상이면(난도가 다른 기준 답) twin을 켜 화면이 난도를 붙여 가른다. 줄은 바꾸지 않는다.
const FOLLOWUP_WINDOWS=['d1','d7','d30'];
export function followupCards(delayed=[],life=[]){
 const cards=new Map();
 for(const [row,isLife] of [...(Array.isArray(delayed)?delayed:[]).map(row=>[row,false]),...(Array.isArray(life)?life:[]).map(row=>[row,true])]){
  if(!row||typeof row.measure?.skillId!=='string')continue;
  const key=`${isLife?'life':'topik'}|${row.sourceAttemptId||row.id}`;
  if(!cards.has(key))cards.set(key,{life:isLife,skillId:row.measure.skillId,difficulty:row.measure.difficulty??null,rows:[],twin:false});
  cards.get(key).rows.push(row);
 }
 const list=[...cards.values()],count=new Map();
 for(const card of list){const name=`${card.life}|${card.skillId}`;count.set(name,(count.get(name)||0)+1);}
 for(const card of list){card.twin=count.get(`${card.life}|${card.skillId}`)>1;card.rows.sort((a,b)=>FOLLOWUP_WINDOWS.indexOf(a.window)-FOLLOWUP_WINDOWS.indexOf(b.window)||Date.parse(a.dueAt)-Date.parse(b.dueAt));}
 const due=card=>card.rows.some(row=>row.status==='due');
 const next=card=>Math.min(Infinity,...card.rows.filter(row=>row.status==='not_due').map(row=>Date.parse(row.dueAt)).filter(Number.isFinite));
 return list.sort((a,b)=>Number(due(b))-Number(due(a))||next(a)-next(b));
}
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
 readClasswork=null,writingPractice=null,speakingPractice=null,topikBankUrl=null,town=null,responses=false,target=globalThis,atlasNext=null,homeNext=null,mockChanged=null}){
 let stopped=false,coach=null,coachHost=null,practiceCoach=null,practiceHost=null,mockCoach=null,mockHost=null,lifeCoachNow=null,lifeHost=null,current=null,refreshing=false,classwork={at:0,rows:[],pending:null};
 // 새 길 홈(Atlas 재설계 단계 4-3 — 단계4_계획 §20): 셸이 넘긴 홈 입구(homeNext — 생활 판정이 있을 때만)가 있으면 판 셋(지금 판 · 확인 중 · 엔진)을 들고,
 // 지금 판이 아니면 세 줄을 짓는다(입구가 준 플래너 — world-today.mjs). 차례 표시(이번 학습일에 이 문서에서 연 칸)는 저장하지 않고 학습일 · 주인이
 // 바뀌면 비운다(§20-8 · 설계 주인 11-15 답 5). 플래너를 못 받으면(엔진을 못 받음) 지금 판이다.
 let homePlanner=null,homeWatch=null,homeFailed=false,homeBare=false;const opened={key:'',kinds:new Set()};
 // 새 길 「내 위치」(4-4a — 단계4_계획 §21-2): 입구가 준 최소 그림, 서버 길 계정의 「기록이 다 왔는가」가 읽는 이 문서의 첫 받기 답(홈 코치마다 한 번),
 // 확인 중 판을 다시 보는 중인가(refresh ↔ 다시 그리기가 서로를 부르지 않게).
 let nextView=null,nextSync={coach:null,value:null,asking:null},redrawingNext=false;
 // 첫 받기가 한도(4초)를 넘겨 시간 초과로 답했을 때 받기가 끝나기를 한 번 더 기다리는 한도(끝 판 GB1).
 const SYNC_LATE_MS=60000;
 // 새 길 진단 끝 화면이 기기 기록부(손님 · 동의를 끈 계정)의 다시 접기(finishSet의 folded)를 기다리는 한도 — 접기는 기기 안이라 짧다(끝 판 F3).
 const FOLD_WAIT_MS=4000;
 // 받기 알림(§21-20 — hearHome): 듣는 코치 · 되돌림 · 미룬 알림 둘(홈 몫 · 열린 판 몫 — 설계 검토 D4) · 다음 틱 타이머.
 let heard={coach:null,off:null,home:false,panel:false,timer:null};
 // 타이머 — target의 시계(창의 setTimeout · clearTimeout, 시험은 가짜 시계)를 쓴다. 없으면 전역 시계.
 const watchClock={set:(fn,ms)=>typeof target.setTimeout==='function'?target.setTimeout(fn,ms):setTimeout(fn,ms),clear:id=>{if(id==null)return;if(typeof target.clearTimeout==='function')target.clearTimeout(id);else clearTimeout(id);}};
 // 새 길 홈이 확인 중일 때 연 이번 주 계획이 판이 서기를 기다리는 한도와 기다리는 쪽(4-4b 끝 판 F1 — openPlan · settledHome).
 const PLAN_WAIT_MS=8000;const planWaits=new Set();
 const owner=getProgress().owner;
 const empty=engine.engine.createGame({gameId:'world-home-empty',storage:null,historyComplete:false}).summary();
 const view=position?position.createView({t,has:hasString,formatDate,lang:currentLang}):null;
 const check=()=>{if(stopped||getProgress()?.owner!==owner)throw Error('학습 계정이 바뀌었어요. 설정을 다시 열어 주세요.');};
 // 학습 기록 코치: 홈·짧은 진단은 'world-home', 읽기 짧은 연습은 'world-practice'(근거 줄이 어디서 낸 답인지 가른다).
 // 둘 다 같은 기기·계정 기록(같은 열쇠)을 쓰므로 노출과 상태는 서로의 답을 그대로 본다.
 // 끝난 코치는 놓는다 — 계정 통로의 코치는 disconnect, 기기 코치(엔진 api)는 dispose만 있다(기기 코치를 놓지 않으면 그 탭이 기기 기록 임대를 쥔 채 남는다).
 // 여기서 놓는 기기 코치는 모두 재확인을 지키며 접는다(followups) — 놓을 때의 마지막 저장이 장부를 접어도 재확인이 남는다.
 const release=instance=>{try{(instance?.disconnect||instance?.dispose)?.();}catch{}};
 function coachFor(gameId,held,setHeld){
  check();const source=target.SYNKLearningHost||null;
  if(!source&&owner!=='guest')return null;
  let [instance,host]=held();
  if(instance&&host===source){try{instance.summary();return instance;}catch{release(instance);instance=null;}}
  if(host!==source){release(instance);instance=null;host=source;}
  if(!instance)instance=source?source.createGame({gameId,followups:true},engine.engine.createGame,engine.createLearningSync):engine.engine.createGame({gameId,storage:target.localStorage,followups:true});
  setHeld(instance,host);return instance;
 }
 const readCoach=()=>coachFor('world-home',()=>[coach,coachHost],(a,b)=>{coach=a;coachHost=b;});
 const readPracticeCoach=()=>coachFor(position?.practice?.PRACTICE_POLICY?.gameId||'world-practice',()=>[practiceCoach,practiceHost],(a,b)=>{practiceCoach=a;practiceHost=b;});
 // 시험 형식 연습(미니 모의)은 'world-mock' — 근거 집계(world-exam-form.mjs mockEvidence)가 이 경험의 결정 기록만 읽는다.
 const readMockCoach=()=>coachFor(position?.mock?.MOCK_POLICY?.gameId||'world-mock',()=>[mockCoach,mockHost],(a,b)=>{mockCoach=a;mockHost=b;});
 // 생활 한국어의 거울 코치는 'world-life'(Atlas × WORLD D, 11-08 — life-trail.mjs). 같은 기기 · 계정 기록 열쇠를 나눠 노출 · 상태를 함께 본다.
 // 계정 통로가 아직 없으면 null(거울은 다음 도움 · 답 때 다시 묻는다). 주인이 바뀌었으면 check가 던지고 거울은 그 사건을 건너뛴다.
 const readLifeCoach=()=>coachFor('world-life',()=>[lifeCoachNow,lifeHost],(a,b)=>{lifeCoachNow=a;lifeHost=b;});
 // ── 연습 한 판의 응답(WORLD 학습자 응답 설계 §2·§3·§5) ──
 // 기능이 꺼졌거나 손님이면 응답 줄도 판 기록(finishSet)도 없다 — 손님은 「내 계정」을 열 수 없어 본인이 보고 뺄 자리가 없다.
 const answering=()=>responses===true&&owner!=='guest';
 // 새 길 판 응답을 읽을 코치(아래 nextCoach — 홈 코치가 없을 때 이 화면에서 마지막으로 응답을 남긴 새 길 코치)와 이름을 붙일 수 있는 판 종류.
 let responseCoach=null,responseCoachOff=null;
 // 그 코치를 판을 다시 정해(비우기 · 409 · 403 · 계정) 닫으면 잊는다 — 닫힌 코치를 들고 있으면 확인 중에 연 「내 계정」이 홈 코치를 기다리지 않고
 // 닫힌 코치로 읽어 서버의 판 응답을 끝내 읽지 못했다(4-5 끝 판 C1).
 function holdResponseCoach(coachNow){
  if(responseCoach===coachNow)return;
  responseCoachOff?.();responseCoach=coachNow;responseCoachOff=null;
  try{responseCoachOff=atlasNext?.retired?.(coachNow,()=>{if(responseCoach===coachNow){responseCoach=null;responseCoachOff=null;}})??null;}catch{responseCoachOff=null;}
 }
 const NEXT_KINDS=new Set(['short','diagnostic','mock']);
 // 판 하나를 마칠 때 그 판의 결정·마침 한 쌍(코치 finishSet — 응답은 그 판에 붙는다). 남기지 못하면(옛 코치·저장 실패) 응답 줄을 그리지 않는다.
 function finishSet(coachNow,kind){
  if(!answering()||typeof coachNow?.finishSet!=='function'||typeof view?.renderSetResponse!=='function')return null;
  try{return coachNow.finishSet({kind});}catch{return null;}
 }
 // 짧은 연습 한 판의 문항 수: 짧은 연습(코치 world-practice)에 남긴 마지막 응답 하나로 — 많았어요 3, 더 하고 싶어요 7, 그 밖·없음은 연습 규칙 그대로(5).
 // 따로 저장하는 상태가 없다(Core 분량 규칙과 같은 절대 규칙) — 응답을 빼거나 30일이 지나면 효과도 빠진다. 진단·시험 형식 응답은 길이를 움직이지 않는다.
 const PRACTICE_LENGTH=Object.freeze({too_much:3,want_more:7});
 // 새 판(Atlas 새 길)의 판 응답도 같은 셈으로 읽는다(4-5 — 단계4_계획 §22-5): 지금 판 짧은 연습 코치의 응답과 새 길 코치의 판 응답 가운데 가장 새
 // 「짧은 연습」 응답 하나로 정한다. 새 길 코치의 목록은 저장 중인 내 응답도 바로 들어, 끝 화면에서 고른 값이 「n문항 더 하기」에 곧바로 선다.
 // 올리는 계정의 다른 기기 응답 · 30일 규칙은 「내 계정」을 열 때 읽은 서버 값(readResponses)이 더한다.
 // prefer: 판을 여는 새 길 코치 — 홈 코치가 아직 서지 않았어도 그 코치의 판 응답으로 센다(4-5 코드 검수 — 홈 코치보다 먼저 연 짧은 연습이
 // 「많았어요」를 두고도 5문항으로 열리던 것).
 function practiceLength(prefer=null){
  const base=position?.practice?.PRACTICE_POLICY?.count||5;
  if(!answering())return base;
  try{
   const rows=[...(readPracticeCoach()?.setFeedback?.()||[]),...nextRows(prefer)].filter(row=>row.kind==='short');
   const last=rows.reduce((best,row)=>!best||Date.parse(row.at)>=Date.parse(best.at)?row:best,null);
   return PRACTICE_LENGTH[last?.value]||base;
  }catch{return base;}
 }
 // 끝 화면의 응답 줄 잇기: 고르면 코치에 남기고(같은 값은 그대로, 다른 값은 앞 응답을 대신한다) 그 줄만 다시 그린다.
 // 짧은 연습이면 길이가 바뀌므로 「새 문항 n개 더 하기」의 n도 고친다(more: 그 항목에 남은 새 문항 수).
 // next: 새 판(Atlas 새 길)의 끝 화면 — 단추는 「최대 n문항 더 하기」(n = 다음 판의 길이)이고, 고른 응답이 다음 새 판 길이가 된다(④e).
 function bindResponse({box,coachNow,set,kind,more=0,next=false}){
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
   // 새 길 코치에 남긴 응답은 그 코치의 판 응답에 바로 든다 — 홈 코치가 없을 때 목록 · 길이가 읽을 코치로 둔다. 지금 판과 새 길 응답은 시각으로
   // 가려 가장 새 것이 길이를 정한다(앞 새 판 응답이 방금 지금 판에서 고른 것을 가리지 않는다 — 끝 판 둘째 C).
   if(!failed&&typeof coachNow?.responses==='function')holdResponseCoach(coachNow);
   const again=kind==='short'?box.querySelector('[data-practice-again]'):null;
   if(again)again.innerHTML=next?`${escape(t('practice.next.again',{n:practiceLength()}))} <span aria-hidden="true">→</span>`
    :`${escape(t('practice.again',{n:Math.min(more,practiceLength())}))} <span aria-hidden="true">→</span>`;
  });
 }
 const responseView=(set,kind)=>set?{kind,value:null}:null;
 // ── 「나」 칸(4-5 — 단계4_계획 §22-6) ──
 // 새 길 홈 코치가 엔진 판일 때만 — 흔들리는 말 · 또렷한 말 · 내가 안다고 한 말(홈 플래너의 meUnits, 이름은 「내 위치」와 같은 단위 길 unitRoutes).
 // 확인 중이거나 지금 판이거나 플래너를 못 받았으면 null(셸은 칸을 그리지 않는다).
 function meCoach(){if(stopped)return null;try{return homePhase()==='engine'?homeWatch?.coach?.()??null:null;}catch{return null;}}
 function meNow(){
  const coachNow=meCoach(),P=homePlanner?.position;if(!coachNow||typeof P?.meUnits!=='function')return null;
  let life=[];try{life=engine.life?.lifeItems?.()||[];}catch{life=[];}
  let routes=new Map();try{routes=P.unitRoutes({itemUnits:item=>coachNow.itemUnits(item),practice:position?.practice?.pool||[],diagnostic:position?.items||[],life});}catch{routes=new Map();}
  try{return P.meUnits(coachNow.summary(),routes);}catch{return null;}
 }
 // 본인 말(「이미 알아요」 · 「다시 배울래요」 — 코치의 tell). 그 사건 번호를 준다(되돌리기가 그 사건을 뺀다). 못 적으면 null.
 function tellMe(unit,kind){if(kind!=='known'&&kind!=='relearn')return null;const coachNow=meCoach();if(!coachNow)return null;try{return coachNow.tell(unit,kind)?.id??null;}catch{return null;}}
 // 되돌리기(설계 주인 I) — tell이 돌려준 사건을 코치의 untell로 뺀다(계정이면 그 빼기도 올라간다). 뺀 효과는 저장된 뒤에 요약에 서므로 저장이
 // 끝나면 참으로 풀린다. 못 빼면(던짐 · 저장 실패) 거짓이다(4-5 끝 판 GB4 · 설계 주인 11-19 새벽).
 async function undoMe(eventId){if(!eventId)return false;const coachNow=meCoach();if(typeof coachNow?.untell!=='function')return false;try{return (await coachNow.untell(eventId).stored)===true;}catch{return false;}}
 // 연습 기록 비우기(§22-4) — 입구의 clearPractice(한 번 더 묻기는 셸이 했다). 결과를 그대로 준다. 입구가 없으면 null.
 async function clearPractice(options){if(stopped||typeof atlasNext?.clearPractice!=='function')return null;return atlasNext.clearPractice(options);}
 // 「내 계정」의 「내가 남긴 응답」: 세 연습(짧은 연습·짧은 진단·시험 형식)의 판 응답(30일 안·뺀 것 제외)을 새것부터. 기능이 꺼졌거나 손님이면 null.
 // 각 줄 {id, kind, value}. 시각은 보이지 않는다(설계 §3). removeResponse(id): 그 응답을 뺀다(record.excluded — 목록과 쓰임에서 빠진다).
 const RESPONSE_COACHES=[()=>readPracticeCoach(),()=>readCoach(),()=>readMockCoach()];
 // 새 길(4-5 — 단계4_계획 §22-5): 새 길 홈 코치(없으면 이 화면에서 마지막으로 응답을 남긴 새 길 코치 — 같은 판이면 같은 저장소라 목록이 같다)의
 // 판 응답(코치 responses() — 30일 · 뺀 것 제외 · 판마다 가장 새 것)을 옛 코치 셋의 응답과 합친다. 판 종류를 모르는 줄은 이름을 붙일 수 없어
 // 그리지 않는다. 줄마다 온 곳(from)을 들고, 빼기도 온 곳으로 보낸다(옛 줄은 그 옛 코치의 exclude, 새 줄은 판 응답을 빼는 문 excludeResponse).
 // prefer: 지금 여는 판의 새 길 코치 — 홈 코치가 없으면 이 화면에서 마지막으로 응답을 남긴 코치보다 앞세운다(그 코치는 판을 다시 정해 닫혔을 수 있다).
 function nextCoach(prefer=null){
  let home=null;try{home=homePhase()==='engine'?homeWatch?.coach?.()??null:null;}catch{home=null;}
  if(typeof home?.responses==='function')return home;
  return typeof prefer?.responses==='function'?prefer:responseCoach;
 }
 function nextRows(prefer=null){
  const coach=nextCoach(prefer);if(typeof coach?.responses!=='function')return [];
  try{return coach.responses().rows.filter(row=>NEXT_KINDS.has(row.kind)).map(row=>({...row,from:coach,next:true}));}catch{return [];}
 }
 function responseRows(){
  const rows=[];
  for(const read of RESPONSE_COACHES){const coach=read();for(const row of coach?.setFeedback?.()||[])rows.push({...row,from:coach});}
  rows.push(...nextRows());
  return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 }
 function responseList(){
  if(!answering())return null;
  return responseRows().map(row=>({id:row.id,kind:row.kind,value:row.value}));
 }
 function removeResponse(id){
  if(!answering())return false;
  const row=responseRows().find(entry=>entry.id===id);if(!row)return false;
  if(row.next)row.from.excludeResponse(id);else row.from.exclude(id);
  return true;
 }
 // 「내 계정」을 열 때: 새 길 올리는 계정이면 서버의 판 응답(다른 기기에서 남긴 것 · 30일)을 다시 읽어 코치에 넘긴다(입구 readResponses). 목록이
 // 바뀌었으면 참 — 셸이 그 칸만 다시 그린다.
 // 홈 코치가 아직 서지 않아 읽을 코치가 없으면 코치가 설 때(판 감시의 알림) 한 번 읽고 그 결과를 준다 — 준비 중에 연 시트가 서버 응답을 끝내
 // 읽지 못하던 것(4-5 코드 검수). 기다리는 사이 다시 부르면 같은 약속이다. 그사이 시트를 닫았으면 셸이 그리지 않는다. 기다린 읽기는 시트가
 // 그린 목록(기다리기 시작한 때의 목록)과 견준다 — 코치가 선 때의 목록과 견주면, 코치가 낸 기기 응답이 서버 값과 같을 때 빈 채로 그린 시트를
 // 다시 그리지 않았다(4-5 코드 다시 검수 GA7).
 let responsesWaiting=null,responsesDone=null,responsesShown=null;
 async function readResponses(shown=null,again=0){
  if(!answering()||typeof atlasNext?.readResponses!=='function')return false;
  const coach=nextCoach();
  if(!coach){
   // 홈 코치가 설 수 있을 때(확인 중)만 기다린다 — 지금 판이면 읽을 새 길 코치가 없다.
   if(homePhase()!=='checking')return false;
   if(!responsesWaiting){responsesShown=shown??JSON.stringify(responseList());responsesWaiting=new Promise(resolve=>{responsesDone=resolve;});}
   return responsesWaiting;
  }
  const before=shown??JSON.stringify(responseList());
  let read=null;
  try{read=await atlasNext.readResponses(coach);}catch{if(shown==null)return false;}
  // 읽는 사이 판을 다시 정해 그 코치가 닫혔으면(입구가 null을 준다 — 409 · 403 · 비우기 · 계정) 새 코치로 다시 읽는다. 새 홈 코치가 아직 서지
  // 않았으면 설 때 읽는다(4-5 끝 판 GC5 — 시트를 다시 열기 전까지 다른 기기의 응답을 읽지 않았다). 견주는 목록은 처음 그린 목록이다.
  if(read==null&&!stopped&&again<2&&nextCoach()!==coach)return readResponses(before,again+1);
  return !stopped&&JSON.stringify(responseList())!==before;
 }
 // 판 감시가 알릴 때 · 홈 플래너를 못 받았을 때 · 화면을 다시 맞출 때(refresh) · 닫을 때: 기다리던 읽기를 코치가 섰으면 하고, 지금 판으로
 // 정해졌거나 닫았으면 읽지 않고 끝낸다. 생활 판정이 지금 판으로 서면 홈 코치를 열지 않아 판 감시는 알리지 않는다 — 셸이 다시 그리며 부르는
 // refresh와 dispose가 끝낸다(4-5 코드 다시 검수 GA2).
 // 「내 계정」을 확인 중에 열었을 때 — 홈 코치가 서면(판 감시의 알림) 「나」 칸을 그릴 수 있는지 한 번 알린다. 셸이 그때 칸을 넣는다(4-5 끝 판
 // GB5). 지금 판으로 정해졌거나 닫았으면 거짓이다. 기다리는 사이 다시 부르면 같은 약속이다. 깨우는 때는 아래 판 응답 읽기의 기다림과 같다.
 let meWaiting=null,meDone=null;
 function meReady(){
  if(stopped)return Promise.resolve(false);
  if(homePhase()!=='checking')return Promise.resolve(meNow()!=null);
  if(!meWaiting)meWaiting=new Promise(resolve=>{meDone=resolve;});
  return meWaiting;
 }
 function wakeMe(){
  if(!meWaiting||(!stopped&&homePhase()==='checking'))return;
  const done=meDone;meWaiting=null;meDone=null;
  let ready=false;try{ready=!stopped&&meNow()!=null;}catch{ready=false;}
  done(ready);
 }
 function readWaitingResponses(){
  wakeMe();
  if(!responsesWaiting)return;
  const done=responsesDone,shown=responsesShown;
  if(stopped||homePhase()==='old'){responsesWaiting=null;responsesDone=null;responsesShown=null;done(false);return;}
  if(!nextCoach())return;
  responsesWaiting=null;responsesDone=null;responsesShown=null;
  void readResponses(shown).then(done,()=>done(false));
 }
 // 공개 TOPIK 은행: 처음 추천·판을 열 때 한 번 불러오고(실패하면 다음에 다시), 다 불러오면 추천과 열려 있는 판을 다시 그린다.
 const bankUrl=topikBankUrl||audioUrl('world-topik-items.json');
 let bankWait=null,bankFailedAt=-Infinity;
 function loadBank(){
  const bank=position?.topik;if(!bank||bank.ready)return Promise.resolve();
  // 못 불러왔으면 1분 동안은 다시 묻지 않는다 — refresh(초점·답)마다 요청이 되풀이되지 않게.
  if(!bankWait&&Date.now()-bankFailedAt<60000)return Promise.resolve();
  bankWait||=Promise.resolve().then(()=>bank.load(bankUrl)).then(()=>{if(stopped)return;if(homeBare){homeBare=false;homeWatch?.reopen?.();}queueMicrotask(()=>{refresh();repaint();});},()=>{bankWait=null;bankFailedAt=Date.now();});
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
 // 생활 한국어 재확인(Atlas × WORLD D, 11-08): 같은 기록의 Temper 줄 가운데 생활 칸 — 확인은 제품 길(돌아온 복습 · 다음 레슨)로 연다.
 function lifeDelayedRows(){
  const c=readPracticeCoach(),seen=seenBy(c);let projection=null,snapshot=null;try{projection=c?.followups?.();}catch{}try{snapshot=getProgress().exportSnapshot();}catch{}
  return lifeFollowupRows({projection,seen,snapshot,life:engine.life,taskVersion:c?.mapVersion});
 }
 function openLifeFollowup(id){
  const row=lifeDelayedRows().rows.find(value=>value.id===id&&value.status==='due'&&value.available);
  if(!row){home.toast(t('followup.noSupply'));return;}
  return row.route.route==='review'?startReview(row.route.lessonId,row.route.reviewIds):startLesson(row.route.lessonId);
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
 // 읽기 실패는 이용 불가로 보되, 선택 저장 실패는 목표 창이 성공으로 닫히지 않게 전한다.
 const speakingCall=(name,...args)=>{try{return typeof speakingPractice?.[name]==='function'?speakingPractice[name](...args):null;}catch(error){if(name==='choose')throw error;return null;}};
 const speakingType=route=>{const type=Number(String(route||'').split(':')[1]);return Number.isInteger(type)?type:null;};
 // 시험 유형 후보만(route 'speaking:N') — 카페 역할극은 이번 주 계획에 넣지 않는다.
 const speakingList=()=>{const value=speakingCall('candidates');return Array.isArray(value)?value.filter(row=>row&&typeof row.id==='string'&&speakingType(row.route)&&Number.isFinite(row.minutes)):[];};
 // 말하기 후보의 한국어 이름(홈·계획 판이 화면 언어로 바꾼다 · home.mjs planLabel, world-position-ui.mjs planTitle).
 const speakingLabel=route=>{const key=`speaking.type.${speakingType(route)}`;return hasString(key)?`${t('speaking.title',undefined,'ko')} · ${t(key,undefined,'ko')}`:t('speaking.title',undefined,'ko');};
 const speakingChosen=()=>speakingCall('chosen',owner)===true;
 // 이번 주(계획의 주) 말하기: 열 수 있는 유형 후보 · 센 시도 시각 · 아직 안 해 본 유형 수, 그리고 Core에 넘길 추천 후보(아직 안 해 본 유형, 다 해 봤으면 모두).
 // events(홈 코치 사건): 이 기기 기록에 계정의 Trail 시도를 더해 센다(Atlas × WORLD E §4-5 — 옛 앱 셸은 이 인자를 버려 이 기기만 센다).
 // 후보의 coreTargets(그 유형이 열 문항의 Core target — 말하기 모듈이 Strata 조회로 만든다)를 그대로 넘긴다: Core는 이 능력을 늘 「모름」으로 읽어
 // 상태 대신 노출 이력만 쓴다(방금 한 유형은 뒤로 · 덜 만난 유형 먼저, §4-4). 없으면 지금처럼 학습 항목을 겨누지 않는 후보다.
 function speakingThisWeek(now,events=null){
  const list=speakingList(),state=speakingCall('week',owner,position.exam.examWeek(now),events)||{};
  const tried=new Set(Array.isArray(state.tried)?state.tried:[]),fresh=list.filter(row=>!tried.has(speakingType(row.route)));
  const targets=row=>Array.isArray(row.coreTargets)?row.coreTargets.filter(target=>target&&typeof target.id==='string').map(target=>({...target,skillIds:[...target.skillIds],conceptIds:[...(target.conceptIds||[])]})):[];
  return {list,times:Array.isArray(state.times)?state.times:[],untried:fresh.length,
   recommend:(fresh.length?fresh:list).map(row=>({id:row.id,label:speakingLabel(row.route),route:'speaking',routeId:row.route,minutes:row.minutes,minutesEstimated:true,targets:targets(row),goals:['exam','prepare','speaking'],audioRequired:true,modality:'speaking'}))};
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
  // 말하기 연습(10-21): TOPIK I·II를 고르고 시험 정보에서 「말하기 평가도 준비해요」를 켠 학생만(이 기기 선택, 계정·손님마다). 말하기 시도는 Trail에
  // 「채점 안 함」으로만 남아 능력 근거가 없다(Atlas × WORLD E) — 후보는 문항 열쇠만 Core에 넘기고(소리가 필요하다 — 소리를 끈 날은 Core가 뺀다),
  // 계획에는 이번 주 시각(이 기기 기록 + 계정의 Trail 시도)과 아직 안 해 본 유형 수를 넘긴다.
  let events=[];try{events=coachNow?.events?.()||[];}catch{events=[];}
  const speaking=exam&&['topik1','topik2'].includes(exam.type)&&speakingChosen()?speakingThisWeek(now,events):null;
  if(speaking)extra.push(...speaking.recommend);
  const base=createPlan({summary,progress:progress.exportSnapshot(),settings:values,now,recommendActivities,extra});
  if(!exam)return base;
  // 지금 열 수 있는 연습: 읽기는 항목별 새 문항 수, 듣기는 새 문항이 남은 게임(손님에게 닫힌 게임은 뺀다).
  const listening={};
  for(const candidate of base.candidates||[]){
   if(candidate.route!=='game'||candidate.modality!=='listening'||candidate.available===false)continue;
   for(const target of candidate.targets||[])if(seen({itemKey:target.itemKey||target.id,familyKey:target.familyKeys?.[0]})===false)for(const id of target.skillIds||[]){listening[id]=listening[id]||[];if(!listening[id].includes(candidate.id))listening[id].push(candidate.id);}
  }
  const week=position.exam.examWeek(now);
  // 쓰기 과제마다 겨누는 항목(숙제는 그 항목을 겨누는 과제만)과, 다음 확인 간격을 잴 지난 다시 확인 시각.
  const writingAvailable=exam.type==='topik2'?writingList().map(row=>({id:row.id,routeId:row.route,skillIds:(Array.isArray(row.targets)?row.targets:[]).filter(id=>typeof id==='string')})):[];
  let lastCheckAt=null;try{lastCheckAt=position.exam.lastRecheck?.({events,before:week.start})??null;}catch{lastCheckAt=null;}
  // 쓰기 연습은 Trail에 「채점 안 함」으로만 남고 게스트·지도 밖 기록도 있어, 기기 기록의 규칙 점검 시각으로 센다(③ readWritingSummary times).
  let writingTimes=[];if(exam.type==='topik2'&&typeof writingPractice?.attempts==='function'){try{const times=writingPractice.attempts();writingTimes=Array.isArray(times)?times:[];}catch{writingTimes=[];}}
  // 말하기를 고른 학생만 시험 정보에 speaking:true · 말하기 후보 · 필요 · 이번 주 시각이 더해진다(고르지 않은 학생의 계획 입력은 그대로다).
  // 시작점(짧은 진단부터)은 생활 거울이 아닌 연습의 답으로만 가린다(world-exam-plan examEvidenceSkills · 11-08 프론트 검수). 옛 묶음에 없으면 예전 그대로.
  let examSkills=null;try{examSkills=position.exam.examEvidenceSkills?.(events)??null;}catch{examSkills=null;}
  const examPlan=position.exam.buildExamPlan({exam:speaking?{...exam,speaking:true}:exam,summary,now,audioAvailable,classwork:classworkRows(),lastCheckAt,examSkills,...(speaking?{speakingNeeds:speaking.untried}:{}),
   done:position.exam.weekActivity({events,progress:progress.exportSnapshot(),week,extra:[...(writingTimes.length?[{area:'writing',times:writingTimes}]:[]),...(speaking?.times.length?[{area:'speaking',times:speaking.times}]:[])]}),
   available:{practice:practice?practice.practiceSupply({pool,seen,audioAvailable}):{},listening,recheck:diagnostic?.items?.length||0,life:true,
    writing:writingAvailable,topik2:topik2Domains(),...(speaking?{speaking:speaking.list}:{})}});
  if(examPlan&&mock)examPlan.mock={status:mock.status,minutes:mock.minutes,total:mock.total,sections:mock.sections.map(row=>({section:row.section,status:row.status,count:row.items.length,minutes:row.minutes}))};
  return createPlan({summary,progress:progress.exportSnapshot(),settings:values,now,recommendActivities,extra,examPlan});
 }
 // 홈 계획 한 번(drawHome) 뒤 열린 배우기 허브를 맞춘다(painted → 허브 syncToday). 맞춤은 잠금을 푼 뒤에 부른다 — 허브가 다시 그리며 부르는
 // refresh(onSummary)가 잠금에 걸려 버려지면 홈에 마지막으로 닿는 것이 허브의 updateLearning(지금 판 규칙의 단추 제목 · 튜터)이 된다(엔진급
 // 끝 판 F1). 다시 그린 허브가 부른 refresh가 current를 새로 짓고, 세 줄이 그대로면 허브는 다시 그리지 않아 되풀이가 멈춘다. 홈 입구가 없는
 // 판(스위치 꺼짐)은 맞춤을 부르지 않는다.
 function refresh(){
  if(stopped||refreshing)return current;
  if(drawHome()&&homeNext){try{homeNext.painted?.();}catch{/* 허브는 다음에 열 때 맞춘다 */}}
  wakePlanWaits();
  // 받기 알림(§21-20): 지금 홈 코치에 듣기를 맞추고, 이 그리기가 홈 몫의 미룬 알림을 비췄으니 비운다(판을 닫으며 부르는 refresh가 그 한 번이다).
  // 열린 판 몫은 판을 그릴 때 비운다(설계 검토 D4).
  hearHome();heard.home=false;
  // 새 길 「내 위치」가 확인 중 판이면 판이 섰는지 다시 본다(§21-2 — 생활 판정이 서면 셸이 홈을 다시 그린다). 엔진 판은 판 감시가 알릴 때만 다시 그린다.
  try{if(homeNext&&panelNode('[data-position-next="checking"]'))redrawNext();}catch{/* the next open draws it */}
  // 시험 점검 카드의 판정이 바뀌었을 수 있다(판 · 은행 · 기록이 다 왔는가 — 4-4d §21-23의 5). 앱이 열린 카드만 맞춘다.
  if(typeof mockChanged==='function')try{mockChanged();}catch{/* 알림 카드는 다음에 열 때 맞춘다 */}
  // 기다리던 「내 계정」 판 응답 읽기 — 생활 판정이 지금 판으로 서면 판 감시가 알리지 않으므로 여기서 끝낸다(GA2).
  readWaitingResponses();
  return current;
 }
 function drawHome(){
  refreshing=true;
  try{
   check();void loadBank();const progress=getProgress(),save=progress.status();
   if(['unreadable','conflict','loading'].includes(save.phase)||save.rejected){current=null;home.updateStudy?.(null);return false;}
   // 새 길 홈(§20-4): 판이 지금 판이 아니면 세 줄 — 옛 코치의 요약을 읽지 않는다(§20-9 4).
   const phase=homePhase();
   if(phase!=='old'){current=todayWith({phase,progress,values:settingsFor(progress.learningProfileValues())});home.updateStudy?.(current);return true;}
   let summary=empty,coachNow=null;
   try{coachNow=readCoach();summary=coachNow?.summary()||empty;applyPreferences();}catch{/* Unavailable account evidence remains unknown. */}
   // The coach's own call also hands Core what was already presented, so an activity whose items are
   // all used (practice.spent) is told apart from one that still has new items. Any failure keeps the plain call.
   const recommendActivities=input=>{if(summary!==empty&&typeof coachNow?.recommendActivities==='function'){try{return coachNow.recommendActivities(input.candidates,{settings:input.settings,at:input.at});}catch{}}return engine.recommendActivities(input);};
   current=planWith({summary,coachNow:summary===empty?null:coachNow,progress,values:settingsFor(progress.learningProfileValues()),recommendActivities});
   // 새 길 홈에서 지금 판으로 내려온 때(플래너를 못 받음 · 생활 판정이 지금 판)도 열린 배우기 허브를 맞춘다 — 확인 중 · 새 길 포스터에 굳지 않게
   // (엔진급 끝 판 B3). 맞춤은 refresh가 잠금을 푼 뒤에 한다(위).
   home.updateStudy?.(current);return true;
  }catch{current=null;home.updateStudy?.(null);return false;}finally{refreshing=false;}
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
  // 새 길 홈(§20-4): 단추를 누를 때 판을 다시 묻는다 — 생활 판정이 지금 판이면 입구에 다시 묻는다(refresh마다 묻지 않는다, 설계 검토 H10).
  if(homeNext){try{await homeNext.ask();}catch{/* 지금 판 그대로 */}check();}
  check();const plan=refresh(),selected=plan?.selected;
  // 새 길에서 줄이 없는 날(§20-4 · §20-8): 확인 중이면 기다리라는 말, 다 한 날 · 상한 날이면 생활 팩으로 간다. 조건에 걸린 날은 지금 판처럼 조건 안내다.
  const empty=plan?.today?.empty?.code;
  if(!selected&&empty==='checking'){home.toast(t('home.today.checking'));return;}
  if(!selected&&(empty==='done'||empty==='day.capped')&&typeof homeNext?.packs==='function'){homeNext.packs();return;}
  if(!selected){home.toast(plan?.reason||'지금 조건에 맞는 연습이 없어요. 학습 목표에서 시간과 소리를 바꿔 보세요.');return;}
  if(applyPreferences()===false){home.toast('도움 방식을 저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');return;}
  // 차례 표시(§20-8): 홈의 단추와 결과 화면의 「다음 연습」으로 연 줄을 모두 연 칸으로 센다.
  if(plan.today&&plan.selectedKind)opened.kinds.add(plan.selectedKind);
  return launch(selected);
 }
 // 새 길 홈의 판(§20-4): 홈 입구가 없거나 플래너를 못 받았거나 생활 판정이 지금 판이면 지금 판, 플래너를 받기 전이면 확인 중, 그 뒤는 감시가 정한다.
 function homePhase(){
  if(!homeNext||homeFailed||stopped)return 'old';
  let life='checking';try{life=homeNext.life();}catch{life='checking';}
  if(life==='old'||life==='disposed')return 'old';
  return homeWatch?homeWatch.phase():'checking';
 }
 // 플래너를 받기 전의 확인 중 판 — 줄 없이 「확인 중」이다(§20-4).
 const checkingPlan=()=>({status:'checking',selected:null,selectedKind:null,reason:'',resume:null,candidates:[],examPlan:null,
  today:{items:[],minutes:0,line:null,empty:{code:'checking',text:null},capped:false,cappedText:null,firstDay:false,state:'checking',redrawAt:null},learningEffectClaim:false,abilityClaim:false,grade:null});
 // 새 길 홈의 계획 한 번(§20-9 4): 생활 판정(셸의 lifeDue)과 홈 코치(엔진일 때만)로 세 줄을 짓는다. 다음에 다시 그릴 때(①이 열림 · 새벽 4시)를 걸어 둔다.
 function todayWith({phase,progress,values}){
  if(!homePlanner)return checkingPlan();
  const now=Date.now(),key=`${owner}|${homePlanner.todayKey(now)}`;
  if(opened.key!==key){opened.key=key;opened.kinds.clear();}
  let judged=null,answers=null,openGames=null;
  try{judged=homeNext.judge(progress.exportSnapshot(),now);}catch{judged=null;}
  try{answers=homeNext.answers();openGames=homeNext.openGames();}catch{answers=null;openGames=null;}
  const lang=currentLang(),coachNow=phase==='engine'?homeWatch.coach():null;
  // 이번 주 계획(4-4b): 시험을 고른 학생만 — 못 지으면 계획 없이 세 줄을 그린다(4-3과 같다).
  let week=null;if(coachNow){try{week=weekNext(coachNow,values,now);}catch{week=null;}}
  const plan=homePlanner.createWorldTodayPlan({coach:coachNow,progress,judged,settings:values,now,answers,openGames,pool:practiceFor(values),practiceLength:practiceLength(),
   labels:id=>skillLabel(id),opened:opened.kinds,lang,say:(why,names)=>homePlanner.say(why,lang,names),week});
  homeWatch.redrawAt(plan.today.redrawAt);
  return plan;
 }
 // 고른 활동 열기: 게임·복습·레슨, 짧은 연습(그 항목), 짧은 진단(내 위치에서 바로 시작), 시험 형식 연습, 쓰기·말하기 연습(호스트가 연다).
 function launch(selected){
  if(selected.route==='game')return launchGame(selected.gameId);
  if(selected.route==='review')return startReview(selected.lessonId,selected.reviewIds);
  if(selected.route==='practice')return startPractice(selected.skillId);
  if(selected.route==='position')return openMyPosition({start:true});
  if(selected.route==='mock')return openMock();
  if(selected.route==='writing'&&typeof writingPractice?.open==='function')return writingPractice.open(selected.routeId);
  if(selected.route==='speaking'&&typeof speakingPractice?.open==='function')return speakingPractice.open(selected.routeId);
  return startLesson(selected.lessonId);
 }
 // 목표 창 「내 위치 보기」 줄의 수(단계4_계획 §22-1 5b · 설계 주인 11-18): 「내 위치」 판과 같은 자리에서 짓는다. 지금 판 문서는 옛 world-home
 // 요약으로(근거가 다 왔을 때만), 새 길 문서는 엔진 판일 때만 새 요약(nextData의 판 — 기록이 다 왔을 때만)으로 짓는다. 새 길 문서는 옛 요약을
 // 읽지 않는다. 확인 중이거나 판을 못 지으면 null이다(수 없이 그린다).
 function positionRowMap(){
  if(!view)return null;
  const phase=homePhase();
  if(phase==='old'){let summary=empty;try{summary=readCoach()?.summary()||empty;}catch{}try{return summary.evidenceComplete?position.buildPositionMap({summary,policy:engine.POLICY}):null;}catch{return null;}}
  const P=homePlanner?.position,coachNow=phase==='engine'?homeWatch?.coach?.()??null:null;
  if(!coachNow||!P)return null;
  try{const board=nextData(coachNow,P).board;return board?.complete?board:null;}catch{return null;}
 }
 // presetExam(주소의 ?exam=, 아래 examLink): 「시험·자격 준비 → 그 시험」을 이 창에만 채워 둔다. 저장은 학생이 저장 스위치를 켜고 누를 때만이고,
 // 저장하면 이번 주 계획으로 간다. 이미 고른 목표 급이 그 시험의 급이 아니면 비운다.
 function open({continueAfter=false,presetExam=null}={}){
  check();const progress=getProgress(),saved=progress.learningProfile(),profile=saved.profile,stored=settingsFor(progress.learningProfileValues());let revision=profile.revision;
  const preset=position?.exam&&Object.hasOwn(EXAM_GRADES,presetExam)?presetExam:null;
  const values=preset?{...stored,primaryReason:'exam',examType:preset,targetGrade:EXAM_GRADES[preset].includes(stored.targetGrade)?stored.targetGrade:null}:stored;
  // 「연습에서 본 것」 대신 「내 위치 보기」 한 줄(10-19 결정): 항목 지도의 세 칸 수를 미리 보이고, 누르면 내 위치 판이 열린다(수는 positionRowMap).
  const map=positionRowMap();
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
   ${view?`<section class="study-position"><p class="life-section-label">MY POSITION</p><button type="button" class="life-row study-position-row" data-view="position"><span class="life-row-copy"><strong>${t('position.open')}</strong><small>${escape(map?t(map.exam==='topik2'?'position.summary.topik2':'position.summary',{...map.counts,total:map.total}):t('position.row',{total:topikTotal()}))}</small></span></button></section>`:''}
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
  const run=async(operation,after=null)=>{if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);try{valid();const afterWrite=operation();boardExam=null;revision=progress.learningProfile().profile.revision;let afterWriteFailure;try{if(typeof afterWrite==='function')afterWrite();}catch(error){afterWriteFailure={error};}await progress.flush();valid();if(progress.learningProfile().profile.status!=='skipped'){await prepare();valid();try{await target.SYNKLearningHost?.ready?.();}catch{/* the save still goes to this device */}valid();if(applyPreferences({explicit:true})===false)throw Error('도움 방식을 저장하지 못했어요. 잠시 뒤 다시 저장해 주세요.');}refresh();if(afterWriteFailure)throw afterWriteFailure.error;home.closePanel();if(after)await after();else if(continueAfter)await next();else home.toast(t('goal.saved'));}catch(error){if(form.isConnected)status.textContent=tMessage(error.message)||t('goal.retry');}finally{busy=false;if(form.isConnected)form.querySelectorAll('button').forEach(b=>b.disabled=false);}};
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
   void run(()=>{progress.updateLearningProfile({consent:true,expectedRevision:revision,values:{reasons:reason?[reason]:null,primaryReason:reason||null,goal:null,support:form.elements.support.value,explanation:form.elements.explanation.value,...examValues(reason)},today:{...(minutes?{minutes}:{}),audio:form.elements.audio.value}});return()=>saveSpeaking(reason);},
    // 주소로 연 창의 「저장하고 시작하기」: 시험을 고른 채 저장했으면 이번 주 계획, 학생이 이유를 시험 밖으로 바꿨으면 첫 실행처럼 다음 연습.
    // 계획을 띄우지 못하면(그사이 다른 판을 열었거나 계획이 없음) 저장 알림만, 그사이 계정이 바뀌어 이 화면이 닫혔으면 아무것도.
    preset?async()=>{if(!position.exam.examInfo(progress.learningProfileValues()))return next();
     let shown='missing';try{shown=await openPlan({quiet:true});}catch{if(stopped)return;}
     if(shown!=='shown')home.toast(t('goal.saved'));}:null);
  });
  // 처음 온 사람의 「건너뛰기」: 주소로 연 창도 단추가 「저장하고 시작하기」라 첫 실행 창처럼 건너뛴 뒤 다음 연습을 연다.
  form.querySelector('[data-study-skip]').addEventListener('click',()=>{if(profile.status==='new')void run(()=>progress.clearLearningProfile({mode:'skip',expectedRevision:revision}),preset?next:null);else home.closePanel();});
  // 목표를 지우면 이 기기의 말하기 선택도 끈다(끄기만 하면 다시 켤 때 그대로 둔다).
  form.querySelectorAll('[data-study-clear]').forEach(button=>button.addEventListener('click',()=>void run(()=>{progress.clearLearningProfile({mode:button.dataset.studyClear,expectedRevision:revision});return()=>{if(button.dataset.studyClear==='delete'&&speakingChosen())speakingCall('choose',owner,false);};})));
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
  return {map,plan,gate,mock,exam,writing,exams,bridged,summary,events};
 }
 // 근거 줄의 생활 문항: 문항 첫머리(그 문항의 표현)와 판정 자격 — 문항 묶음(position.label)에 없는 문항이다. 생활 부품이 없는 옛 묶음이면 둘 다 없다.
 let lifeItemIndex=null;
 function lifeItemOf(itemKey){
  if(!lifeItemIndex){lifeItemIndex=new Map();try{for(const item of engine.life?.lifeItems?.()||[])lifeItemIndex.set(item.itemKey,item);}catch{}}
  return lifeItemIndex.get(itemKey)||null;
 }
 function itemExcerpt(itemKey){
  const known=position.label(itemKey);if(known)return known;
  const item=lifeItemOf(itemKey),lesson=item&&lessonById(item.lessonId);
  return lesson?lifeTutorExpression(lesson,lesson.questions.find(q=>q.id===item.questionId)):'';
 }
 function itemAssessable(itemKey){
  const item=lifeItemOf(itemKey);if(!item)return null;
  try{return engine.life.lifeAssessable(item)===true;}catch{return null;}
 }
 function showBoard(coachNow,{keepScroll=false}={}){
  check();
  // 듣기 항목의 「이 항목 연습하기」는 지금 추천 후보에서 찾으므로 판을 그리기 전에 추천을 새로 세운다(10-21 검수).
  refresh();
  const scroller=keepScroll?panelNode('[data-position-board]')?.closest?.('#panel-content'):null,scrollTop=scroller?.scrollTop||0;
  const routes=practiceRoutes(coachNow),{map,plan,gate,mock,exam,writing,exams,bridged,summary,events}=positionData(coachNow,id=>routes.has(id));
  let scope=null;try{scope=getProgress().status().scoped?'account':'device';}catch{}
  const practiceOf=id=>routes.get(id)||null;
  const legacy=view.renderPositionBoard({map,plan,gate,mock,exams,writing,bridged,catalog:itemExcerpt,assessable:itemAssessable,diagnosed,scope,practice:practiceOf});
  // 놓친 곳 카드(11-14, world-missed-spot.mjs): 같은 기록(Core 요약 · Trail)과 이번 주 계획 숙제(시험 목표가 있을 때) · 짧은 연습의 다시 확인 투영만 읽는다.
  let missed=null;
  try{
   let projection=null;try{projection=readPracticeCoach()?.followups?.()||null;}catch{projection=null;}
   let delayed=null;try{delayed=delayedRows();}catch{delayed=null;}
   missed=buildMissedSpot({map,summary,events,homework:current?.examPlan?.homework??null,projection,practiceOpen:id=>routes.get(id)?.route==='practice',
    followupOpen:id=>{const row=delayed?.rows?.find(value=>value.id===id);return row?row.status==='due'&&row.available===true:null;},now:Date.now()});
  }catch{missed=null;/* the board opens without the card */}
  // 「내 위치」 2판(11-16, world-position-page.mjs): 놓친 곳 이야기 → 항목 지도 → 그 밖의 묶음 차례로 판을 새로 짠다. 옛 판(계정 묶음)의 묶음은 그대로 옮겨 담는다.
  // 새 판을 못 그리면 옛 판에 놓친 곳 카드를 끼워 연다(11-14 판).
  let board;
  try{board=renderPositionPage({map,legacy,card:missed,practice:practiceOf,t,has:hasString,formatDate});}
  catch{board=legacy;try{if(missed)board=placeMissedSpot(legacy,renderMissedSpot(missed,{t,has:hasString,formatDate,practice:practiceOf}),missed.target.skillId);}catch{board=legacy;}}
  home.showPanel(t('position.title'),board,PANEL);
  const root=panelNode('[data-position-board]');
  if(root&&position.followups){
   void loadFollowupBank();const delayed=delayedRows(),life=lifeDelayedRows();
   // 기준 답(Temper 앵커)마다 카드 한 장: 항목 이름(생활이면 · 생활 한국어) 아래 1 · 7 · 30일 세 칸 — 아직이면 날짜만, 지금 확인할 수 있으면
   // 그 칸에 불이 켜지고 카드 아래 단추(생활은 제품 길로 연다). 같은 꼴의 줄을 창마다 되풀이하지 않고, 지금 확인할 카드가 먼저 · 그다음 가까운 날짜 차례다.
   // 카드가 있으면 짧은 진단 · 항목 판 앞에 둔다(판 끝에서 찾기 어렵다). 없으면 예전처럼 판 끝에 한 줄(11-08 프론트 검수 A2 · B6).
   // 칸 글은 좁은 폭(390 · 세 칸 각 95px쯤)에서도 두 줄 안으로: 지금이면 「지금 확인」, 창이 지났으면 「기간 지남」, 확인했으면 결과의 짧은 꼴
   // (「혼자 맞힘」 · 「다시 연습」), 제외 · 판단 보류도 짧게 — 긴 문장(결과 · 상태)은 칸의 title로만(끝 판 F1).
   // 생활 카드의 단추는 실제로 열리는 곳을 말한다(다음 레슨 · 새 장면 복습 — life-followups route). TOPIK 카드는 그대로 「새 문항으로 확인하기」.
   const LED={due:'check',observed:'ok'},SHORT={due:'followup.step.due',missed:'followup.step.missed',invalidated:'followup.step.invalidated',unavailable:'followup.step.unavailable'};
   const OUTCOMES=new Set(['independent-correct','independent-incorrect','assisted-correct','assisted-incorrect']),list=followupCards(delayed.rows,life.rows);
   const stepText=row=>row.status==='not_due'?formatDate(Date.parse(row.dueAt),{month:'short',day:'numeric'}):row.outcome?t(OUTCOMES.has(row.outcome)?`followup.step.${row.outcome}`:`followup.outcome.${row.outcome}`):t(SHORT[row.status]||`followup.status.${row.status}`);
   const stepTitle=row=>row.status==='not_due'?'':row.outcome?t(`followup.outcome.${row.outcome}`):SHORT[row.status]?t(`followup.status.${row.status}`):'';
   const step=row=>{const title=stepTitle(row);return `<li data-status="${escape(row.status)}"${title?` title="${escape(title)}"`:''}><span class="wfol-window">${escape(t(`followup.window.${row.window}`))}</span><span class="wfol-state">${LED[row.status]?`<i class="w-led ${LED[row.status]}" aria-hidden="true"></i>`:''}<span>${escape(stepText(row))}</span></span></li>`;};
   const openLabel=(value,row)=>!value.life?t('followup.open'):row.route?.route==='lesson'?t('followup.openLesson'):row.route?.route==='review'?t('followup.openReview'):t('followup.open');
   const card=value=>{
    const sub=[value.life?t('position.source.life'):'',value.twin&&value.difficulty?t('position.evidence.level',{n:value.difficulty}):''].filter(Boolean).join(' · ');
    const open=value.rows.find(row=>row.status==='due'),attr=value.life?'data-followup-life':'data-followup';
    const steps=value.rows.map(step).join('');
    return `<li class="wfol-card"${open?' data-due':''}><p class="wfol-head"><strong>${escape(t(`position.skill.${value.skillId}`))}</strong>${sub?`<small>${escape(sub)}</small>`:''}</p><ol class="wfol-steps">${steps}</ol>${open?(open.available?`<button class="quiet-button wfol-open" type="button" ${attr}="${escape(open.id)}">${escape(openLabel(value,open))} <span aria-hidden="true">→</span></button>`:`<p class="wfol-note">${escape(t('followup.noSupply'))}</p>`):''}</li>`;
   };
   const incomplete=delayed.limited||life.available&&life.limited?`<p class="wfol-note" role="status">${escape(t('followup.incomplete'))}</p>`:'';
   const section=`<section class="wpos-followups"${list.length?' data-cards':''}><p class="life-section-label">CHECK AGAIN</p><h3>${escape(t('followup.title'))}</h3><p>${escape(t('followup.note'))}</p>${incomplete}${list.length?`<ul class="wfol-list">${list.map(card).join('')}</ul>`:`<p>${escape(t('followup.empty'))}</p>`}</section>`;
   // 2판은 판이 자리([data-position-followups])를 내준다 — 카드가 있든 없든 그 자리. 옛 판은 카드가 있으면 짧은 진단 · 항목 판 앞, 없으면 판 끝 한 줄.
   const slot=root.querySelector('[data-position-followups]');
   const before=slot||(list.length?root.querySelector('.wpos-diagnostic')||root.querySelector('.wpos-group'):null);
   if(before)before.insertAdjacentHTML('beforebegin',section);else root.insertAdjacentHTML('beforeend',section);
   slot?.remove?.();
   root.querySelectorAll('[data-followup]').forEach(button=>button.addEventListener('click',()=>{void startPractice(null,{followupId:button.dataset.followup}).catch(failed);}));
   root.querySelectorAll('[data-followup-life]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(openLifeFollowup(button.dataset.followupLife)).catch(failed);}catch(error){failed(error);}}));
   const supply=position.practice.practiceSupply({pool:position.practice.pool,seen:seenBy(coachNow)});
   const targets=map.skills.filter(row=>['practice','supported','review'].includes(row.status)||row.incorrect>0).map(row=>row.id);
   const advisory=advisoryRows({targets,summary,lookup:position.recommendedBefore,supply});
   if(advisory.length){root.insertAdjacentHTML('beforeend',`<section class="wpos-advisory"><h3>${escape(t('followup.advisory'))}</h3><p>${escape(t('followup.optional'))}</p>${advisory.map(row=>`<p><button class="quiet-button" data-advisory="${escape(row.id)}">${escape(t(`position.skill.${row.id}`))}</button> → ${escape(t(`position.skill.${row.target}`))}</p>`).join('')}</section>`);
    root.querySelectorAll('[data-advisory]').forEach(button=>button.addEventListener('click',()=>{void startPractice(button.dataset.advisory).catch(failed);}));}
   // 2판: 기록 범위 한 줄(어디 기록인지)은 판의 맨 끝에 둔다 — 권장 연습이 그 뒤에 붙지 않게.
   const scopeNote=root.querySelector?.('.wpv>.wpos-scope');if(scopeNote)root.append?.(scopeNote);
  }
  if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;}else root?.focus?.({preventScroll:true});
  panelNode('[data-position-diagnostic]')?.addEventListener('click',()=>{try{startDiagnostic(coachNow,plan,map);}catch(error){failed(error);}},{once:true});
  root?.querySelectorAll?.('[data-position-exam]').forEach(button=>button.addEventListener('click',()=>{try{check();boardExam=button.dataset.positionExam==='topik2'?'topik2':'topik1';showBoard(readCoach(),{keepScroll:true});}catch(error){failed(error);}}));
  root?.querySelector?.('[data-position-mock]')?.addEventListener('click',()=>{try{check();void Promise.resolve(openMock({exam})).catch(failed);}catch(error){failed(error);}});
  root?.querySelector?.('[data-position-writing]')?.addEventListener('click',()=>{try{check();const first=writingList()[0];if(first&&typeof writingPractice?.open==='function')void Promise.resolve(writingPractice.open(first.route)).catch(failed);}catch(error){failed(error);}});
  bindPractice(root,routes);
  return {coachNow,plan,map};
 }
 // 내 위치 · 새 길 시험 형식을 여는 중이면 열린 판을 뒤에서 다시 그리지 않는다(끝 판 F6 — 다시 그리기도 판 자원을 정리해 그 열기를 끊는다).
 // 시험 형식 열기 중에 건너뛴 다시 그리기는 적어 두었다가, 그 열기가 판을 그리지 않고 끝나면(확인 중 · 코치를 못 받음 · 오류) 열린 판이 그대로
 // 남으므로 끝에 한 번 다시 그린다(끝 판 B1). 내 위치 열기는 오류가 아니면 끝에 판을 새로 그리므로 적지 않는다 — 그래서 막이마다 내 위치
 // 열기(openPosition.pending)를 먼저 보고, 시험 형식 열기는 그 뒤에 이것으로 본다(루트 시험 world-position-lifecycle이 세 함수만 떼어 돌린다).
 function heldMock(){if(!openMockNext.pending)return false;openMockNext.skipped=true;return true;}
 // 은행을 다 불러오면 열려 있는 판을 새 문항으로 다시 그린다(진단·연습·모의가 진행 중일 때는 건드리지 않는다).
 function repaint(){
  try{
   if(home.openPanel?.()===''||openPosition.pending||heldMock())return;
   // 새 길 「내 위치」 판은 새 길로 다시 그린다(옛 코치를 읽지 않는다 — §6).
   if(panelNode('[data-position-next]')){showNext({keepScroll:true});return;}
   if(panelNode('[data-position-board]')&&!panelNode('[data-position-board="hangul"]'))showBoard(readCoach(),{keepScroll:true});
   else if(panelNode('[data-plan-board]'))void openPlan({keepScroll:true});
  }catch{/* the next open draws it */}
 }
 function showHangul(stage){
  home.showPanel(t('position.title'),view.renderHangulBoard({stage}),PANEL);
  panelNode('[data-position-board]')?.focus?.({preventScroll:true});
  panelNode('[data-position-hangul]')?.addEventListener('click',()=>{try{void Promise.resolve(launchGame('hangul')).catch(failed);}catch(error){failed(error);}},{once:true});
 }
 // ── 새 길 「내 위치」(Atlas 재설계 단계 4-4a — 단계4_계획 §21-2 ~ 21-5) ──
 // 홈과 같은 판 셋(지금 판 · 확인 중 · 엔진 — homePhase)을 따른다. 엔진 판은 홈 코치(같은 경험 · 같은 은행 · 같은 객체) 하나로 계약을 짓고 입구가 준
 // 최소 그림으로 그린다 — 옛 요약 · 옛 Trail은 읽지 않는다(§6). 화면 글과 화면 검수는 리디자인에서 한다(유호님 11-15 · 21-12).
 // 한글 열쇠(21-2 — 설계 주인 11-15): 이 화면이 이미 만들어 든 옛 코치(지금 호스트의 것)만 빌린다. 없으면 새로 만들지 않는다 — 열쇠 하나 때문에 옛
 // 저장소를 열지 않는다. 열쇠만 짓고 그 코치의 기록은 읽지 않는다(hangulProgressKey는 assignment가 있는가와 호스트 status()만 본다).
 function heldCoach(){
  const source=target.SYNKLearningHost||null;
  for(const [instance,host] of [[coach,coachHost],[practiceCoach,practiceHost],[mockCoach,mockHost],[lifeCoachNow,lifeHost]])if(instance&&host===source)return instance;
  return null;
 }
 // 서버 길 계정의 「기록이 다 왔는가」(21-3 A3)가 읽는 첫 받기 답 — 홈 코치마다 묻는다(코치 synced — 한도 4초, 손님 · 기기 길은 곧 답한다).
 // 된 답(ok)만 그 코치 동안 든다. 시간 초과면 받기가 끝날 때까지 한 번 더 길게(SYNC_LATE_MS) 기다린다 — 받기가 4초를 넘겨 끝나도 판이 「기록 일부」와
 // 닫힌 진단에 굳지 않게(끝 판 GB1). 실패면 다음에 판을 그릴 때 다시 묻고, 뒤의 받기는 받기 알림(receive — hearHome, §21-20)으로 본다(끝 판 F1).
 // 판은 답이 된 답으로 바뀔 때만 다시 그린다(되풀이해 묻지 않는다).
 function syncedNext(coachNow,wait=null){
  if(!coachNow||typeof coachNow.synced!=='function')return Promise.resolve(null);
  const same=nextSync.coach===coachNow;
  if(same&&(nextSync.asking||nextSync.value?.ok===true))return nextSync.asking||Promise.resolve(nextSync.value);
  const asking=Promise.resolve().then(()=>wait==null?coachNow.synced():coachNow.synced(wait)).catch(()=>null).then(value=>{
   if(nextSync.coach!==coachNow||nextSync.asking!==asking)return value;
   nextSync.value=value;nextSync.asking=null;
   if(value?.ok===true)redrawNext();
   else if(value?.kind==='timeout'&&wait==null)void syncedNext(coachNow,SYNC_LATE_MS);
   return value;
  });
  nextSync={coach:coachNow,value:same?nextSync.value:null,asking};
  return asking;
 }
 // 받기 알림을 듣는다(설계 주인 11-16 오후 — 단계4_계획 §21-20). 엔진의 호스트 알림 가운데 문서 밖의 답이 들어왔다는 두 가지(receive — 받기 ·
 // 첫 받기 · 올리기 답, refresh — 다른 탭의 쓰기 · 다른 저장소에서 옮겨 옴)를 홈 코치의 watch 하나로 듣는다. 홈과 내 위치 판이 같은 알림에 겹쳐
 // 두 번 그리지 않게 화면에 듣는 곳은 하나다. 11-16 새벽의 다시 보기 셋(내 위치 판의 pulled 다시 보기 · 홈의 받기 기다림 · 깨어난 뒤 30초
 // 지켜보기)을 이것으로 바꿨다 — 다시 보기는 같은 자리에서 P1이 두 회차 이어졌고 빈틈 셋이 남았다(§21-18). 엔진의 받기 사다리와 다시 받기는
 // 그대로다(알림은 받기가 실제로 돌아야 난다).
 // 알림을 받은 자리에서는 이번 주 계획의 묶음 만남만 버린다(건너뛰기만 한 판의 만남은 요약 모양에 비치지 않는다 — FA1). 그리기는 다음 틱으로
 // 미뤄 잇달아 온 알림을 한 번으로 묶는다. 미룬 것은 둘로 든다 — 홈 몫(refresh가 그리면 비운다)과 열린 판 몫(내 위치 엔진 판 · 이번 주 계획 판을
 // 그리면 비운다). 그 사이 다른 까닭의 refresh가 홈만 그렸어도 열린 판은 타이머가 그린다(설계 검토 D4). 진단 · 짧은 연습 · 시험 형식 · 마을 확인
 // 판과 생활 레슨 · 복습 · 카페 판이 열려 있으면 그리지 않고 미뤄 둔다 — 그 판들은 닫힐 때 홈을 새로 그리고(판의 stop이 부르는 refresh, 홈의
 // closePanel이 다음 마이크로태스크에 부르는 refresh), 그 한 번이 홈 몫을 비춘다. 판 자원(attachPanelResource)은 판마다 하나라 여기서 붙이지
 // 않는다 — 붙이면 그 판의 stop이 닫혀 연습이 멈춘다. 홈 코치가 바뀌면 옛 코치의 듣기를 되돌리고 새 코치에 건다(refresh가 맞춘다). 문서가
 // 닫히면 되돌린다.
 const SESSION_PANELS=Object.freeze(['[data-position-stage]','[data-practice-stage]','[data-mock-stage]','[data-town-stage]']);
 // 같은 호스트에 답을 쓰는 생활 판(life-ui.mjs의 판 종류) — 답마다 올리기 답의 receive가 와도 판 뒤의 홈과 묶음 만남을 다시 짓지 않는다(설계 검토 D8).
 const LIFE_SESSIONS=new Set(['life-cafe','life-cafe-complete','life-lesson','life-story','life-question','life-complete','life-review','life-review-complete']);
 // 열린 판의 종류(home.mjs openPanel) — 판을 닫으면 곧 빈 값이 된다. 닫으며 흐려지는 동안(160ms)에는 판 조각이 DOM에 남으므로 판 종류로도 본다
 // (설계 검토 D1). 판 종류를 모르는 홈이면(null) 조각만 본다.
 const panelKind=()=>{try{return home.openPanel?.()??null;}catch{return null;}};
 const panelOpen=()=>panelKind()!=='';
 const sessionPanel=()=>{const kind=panelKind();if(kind==='')return false;return LIFE_SESSIONS.has(kind)||SESSION_PANELS.some(selector=>panelNode(selector));};
 function hearHome(){
  const coachNow=!stopped&&homePhase()==='engine'?homeWatch?.coach?.()??null:null;
  if(heard.coach===coachNow)return;
  try{heard.off?.();}catch{/* 닫힌 코치 */}
  heard={...heard,coach:null,off:null};
  if(!coachNow)return;
  // 겉에 watch가 아예 없는 코치(받기 알림 앞의 입구 판이 실린 때)도 아래 TypeError와 같이 지금 판으로 내린다. 조용히 듣지 않으면 새 길 홈이
  // 다른 기기의 답을 놓친다(4-4b 다시 검수 -d P3).
  if(typeof coachNow.watch!=='function'){unheard();return;}
  try{heard={...heard,coach:coachNow,off:coachNow.watch(()=>heardHome(coachNow))};}
  catch(error){
   // 입구의 겉은 메서드 이름마다 함수를 짓는다 — 실린 엔진 판에 watch가 없으면(엔진만 앞 판으로 되돌린 때) 부를 때 TypeError다. 받기 알림 없이는
   // 새 길 홈이 다른 기기의 답을 놓치므로 이 문서는 지금 판으로 내린다(설계 검토 D5). 닫힌 코치(DISPOSED)면 다음 refresh가 다시 건다.
   if(error instanceof TypeError)unheard();
  }
 }
 // 받기 알림을 걸 수 없는 엔진 판 — 이 문서를 지금 판으로 내리고 홈과 열린 판을 다시 그린다(한 번만).
 function unheard(){
  if(homeFailed)return;
  homeFailed=true;queueMicrotask(()=>{if(!stopped){refresh();redrawNext();}});
 }
 function heardHome(coachNow){
  if(stopped||heard.coach!==coachNow)return;
  if(weekMet.coach===coachNow)weekMet={coach:null,key:null,met:null};
  heard.home=true;heard.panel=true;
  if(heard.timer==null)heard.timer=watchClock.set(drawHeard,0);
 }
 function drawHeard(){
  heard.timer=null;
  if(stopped||!heard.home&&!heard.panel||sessionPanel())return;
  // 닫으며 흐려지는 판은 열린 판이 아니다 — 다시 그리면 닫은 판이 다시 열린다(설계 검토 D1).
  const open=panelOpen(),engineOpen=open&&Boolean(panelNode('[data-position-next="engine"]')),planOpen=open&&Boolean(panelNode('[data-plan-board]'));
  // 열린 이번 주 계획 판은 계획 열기가 홈까지 새로 그린다(설계 검토 D3). 아니면 홈만 — 확인 중 내 위치 판은 refresh가 다시 그린다.
  if(planOpen&&heard.panel)void openPlan({keepScroll:true}).catch(()=>{});
  if(heard.home)refresh();
  if(engineOpen&&heard.panel)redrawNext();
  heard.panel=false;
 }
 function stopHearing(){watchClock.clear(heard.timer);try{heard.off?.();}catch{/* 닫힌 코치 */}heard={coach:null,off:null,home:false,panel:false,timer:null};}
 const nextViewOf=()=>nextView||=homePlanner?.position?.createView?.({t,has:hasString,formatDate})||null;
 // 확인 중 판 — 판을 아직 못 정했거나(플래너를 받기 전 · 생활 판정이 확인 중) 홈 코치의 요약이 자리를 잡기 전. 줄 없이 「기록 확인 중」(21-2).
 const nextChecking=()=>`<div class="wpos life-heading" data-position-next="checking" tabindex="-1" aria-busy="true"><div class="life-poster wpos-poster"><span class="w-print wpos-print" data-print="position" aria-hidden="true"><i></i></span><small class="life-poster-label">MY POSITION</small><strong class="life-poster-word">${escape(t('position.title'))}</strong><p class="life-poster-sub">${escape(t('homeTutor.checking'))}</p></div></div>`;
 // 엔진 판 한 장의 자료(계약): 칸 셋 · 짧은 진단 · 다시 확인 카드. 묶음 만남은 한 번만 묻는다(진단 풀 + 짧은 연습 풀 — 21-3, 판을 열 때 · 판 끝에 한 번).
 function nextData(coachNow,P){
  let values={};try{values=getProgress().learningProfileValues()||{};}catch{values={};}
  const exam=examOf(values),audioAvailable=values.audio!=='off',listening=item=>item.audioRequired??item.modality==='listening';
  const summary=coachNow.summary(),diagnostic=position.items,practice=position.practice.pool;
  // 시험 형식 풀(4-4d — 내 위치의 시험 형식 단추)도 같은 묶음 만남 한 번에 묻는다(21-3 — 판을 그릴 때 한 번).
  const mockPool=Array.isArray(position.mock?.pool)?position.mock.pool:[];
  const met=coachNow.exposures([...diagnostic,...practice,...mockPool]);
  // 「이 항목 연습하기」 · 먼저 볼 항목의 「지금 낼 새 문항」: 그 소리 조건에서 처음 보는(seen false) 짧은 연습 문항이 남은 능력.
  const fresh=new Set();
  practice.forEach((item,i)=>{if(met[diagnostic.length+i]?.seen===false&&(audioAvailable||!listening(item)))fresh.add(item.skillId);});
  const synced=nextSync.coach===coachNow?nextSync.value:null;
  // 칸 규칙 다의 길이 읽는 F(21-3 「지금 규칙」): 새 길이 낼 수 있는 풀(진단 풀 — 뺀 레이싱 문항 제외 · 짧은 연습 풀)의 칸마다 처음 보는 계열 수.
  const unseen=P.unseenFamilies([{items:diagnostic,exposures:met.slice(0,diagnostic.length)},{items:practice,exposures:met.slice(diagnostic.length,diagnostic.length+practice.length)}],item=>P.withheldItem(item));
  const board=P.buildPositionNext({exam,skills:P.examSkills(engine.SKILLS,exam),summary,prefer:id=>fresh.has(id),synced,unseen});
  const plan=P.selectDiagnosticNext({position:board,items:diagnostic,exposures:met.slice(0,diagnostic.length),audioAvailable});
  let life=[];try{life=engine.life?.lifeItems?.()||[];}catch{life=[];}
  const routes=P.unitRoutes({itemUnits:item=>coachNow.itemUnits(item),practice,diagnostic,life});
  // 생활 카드가 지금 열리나: 생활 판정(셸의 lifeDue — 홈 「복습」 줄과 같은 목록)이 그 단위로 낸 복습이 있는가. 판정이 엔진이 아니면 모른다(null).
  let judged=null;try{judged=homeNext.judge(getProgress().exportSnapshot(),Date.now());}catch{judged=null;}
  const lifeOpen=unit=>judged?.state==='engine'&&Array.isArray(judged.items)?judged.items.some(row=>row.unit===unit):null;
  const cards=P.recheckCards({due:coachNow.due(),units:summary.units,routes,capped:current?.today?.capped===true,audioAvailable,lifeOpen});
  // 어디 기록인지 한 줄: 손님은 이 기기, 서버 길 계정은 계정. 동의를 끈 계정(기기에만 두는 계정 기록)은 맞는 글이 없어 두지 않는다(글은 리디자인).
  const scope=owner==='guest'?'device':summary.storage?.guest===false?'account':null;
  return {values,exam,board,plan,cards,fresh,judged,scope,month:monthOf(coachNow,P,routes),estimate:estimateOf(coachNow,P,exam,values),
   mock:mockOf(coachNow,values,exam,met.slice(diagnostic.length+practice.length))};
 }
 // 예상 급수 칸(4-4d — 단계4_계획 §21-23의 2): 새 길의 근거 수. 손님과 동의를 끈 계정은 코치가 센다(coach.firstAnswers — 기록이 다 오지 않았으면
 // null). 서버 길 계정은 코치가 null을 내므로 근거 상자(evidenceAsker)의 쓸 수 있는 답이 있을 때만 수를 그린다. 수를 모르면 「확인 중」 표지만 둔다
 // (상자가 그 자리에서 묻기를 그만두었으면 — 실패 · 완결되지 않은 답 뒤의 상한 — 「확인 중」 대신 읽지 못함으로 상태 줄 없이 그린다)
 // — 빈 근거로 문턱을 세지 않는다. 묶음과 문턱은 제품이 센다(P.estimateNext — 지금 판 ESTIMATE_POLICY). 손님의 근거는 접혀 돌아오지 않은 내 사건이
 // 있어도 숨지 않는다(코치가 저장이 끝난 든 사건으로 센다 — 상자는 손님이면 칸을 보기 전에 null, B4).
 function estimateOf(coachNow,P,exam,values){
  if(typeof P?.estimateNext!=='function'||!position.ESTIMATE_POLICY)return null;
  let counts=null;
  try{counts=typeof coachNow.firstAnswers==='function'?coachNow.firstAnswers({game:FIRST_GAME,days:FIRST_DAYS}):null;}catch{counts=null;}
  // 근거 상자도 try 안에서 묻는다 — 상자가 던져도(깨진 저장 값 · 닫힌 코치) 판은 수를 모르는 채로 그린다(끝 판 F12). 상자가 이 자리에서
  // 묻기를 그만두었으면 읽지 못함이다(설계 주인 11-17 저녁 답 4 나 — 실패 뒤 「기록 확인 중」을 남기지 않는다).
  let unread=false;
  if(!counts){try{counts=evidenceAsker.answer(coachNow);unread=!counts&&evidenceAsker.missed(coachNow);}catch{counts=null;}}
  try{return P.estimateNext({bySkill:counts?.bySkill??null,unread,form:formOf(exam),mode:values.examMode||null,policy:position.ESTIMATE_POLICY});}catch{return null;}
 }
 // 내 위치의 시험 형식 단추(4-4d — §21-23의 1 · 2): 새 길 고르기가 ready일 때만 그 판의 분을 싣는다. 시험 은행이 준비되지 않았으면 없다.
 function mockOf(coachNow,values,exam,met){
  if(position.topik?.ready===false)return null;
  const plan=mockNextPlan(coachNow,values,exam,met);
  return plan?.status==='ready'&&Number.isSafeInteger(plan.minutes)?{minutes:plan.minutes}:null;
 }
 // 30일째 문장(4-4c — 단계4_계획 §21-7): 손님과 동의를 끈 계정은 코치가 센다(coach.lookback). 서버 길 계정은 코치가 null을 내므로 서버의 돌아보기
 // 읽기로 묻고 학습일 답을 쓴다(4-4c 둘째 묶음 — §21-22, monthAsker). 쓸 수 있는 답이 없으면 묻거나 받기를 한 번 부르고 문장 없이 그린다. 고르기는
 // 이름이 서는 단위에서(routes — 다시 확인 카드와 같은 이름), 문장은 Vellum이 짓는다(그 화면 언어의 줄이 없으면 null — 문장을 비운다). 못 읽으면
 // 문장 없이 판을 그린다.
 function monthOf(coachNow,P,routes){
  let counts=null;try{counts=typeof coachNow.lookback==='function'?coachNow.lookback():null;}catch{return null;}
  if(!counts)counts=monthAsker.month(coachNow);
  if(!counts||typeof P.pickMonth!=='function')return null;
  const pick=P.pickMonth({month:counts.month,routes,day:homePlanner.todayKey(Date.now())});
  let text=null;try{text=pick?homePlanner.say(P.monthWhy(pick),currentLang()):null;}catch{text=null;}
  return pick&&typeof text==='string'&&text?{text,unit:pick.unit,misses:pick.misses,reviews:pick.reviews}:null;
 }
 // 새 길의 이번 주 계획(4-4b — 단계4_계획 §21-6): 시험을 고른 학생만, 홈 코치가 자리를 잡은 엔진 판에서. 묶음 만남(진단 풀 + 짧은 연습 풀)은 학습일 ·
 // 판 끝 · 목표 시험 · 기록이 다 온 상태가 바뀔 때만 다시 묻는다 — 홈이 다시 그릴 때마다 풀 전체를 훑지 않게, 그러나 시험을 바꾸거나 계정의 첫 받기가
 // 온 뒤에 옛 판정이 그날 내내 굳지 않게(설계 검토 A8). 칸 · 숙제 · 공급은 그 만남과 지금 요약으로 그릴 때마다 짓는다(요약은 보기에서 바로 오른다).
 // 내 위치 판(nextData)은 이 만남을 쓰지 않는다 — 판을 열 때마다 새로 묻는다(21-3).
 let planEnds=0,weekMet={coach:null,key:null,met:null};
 // 30일째 문장의 계정 길(4-4c 둘째 묶음 — 단계4_계획 §21-22): 학습일 답은 계정마다 열쇠 하나(world-month-answer.mjs). 묻기 · 받기(coach.pull) ·
 // 다시 그리기의 상한은 그 모듈에 있다. 묻는 줄은 그 코치를 연 판(homeNext.lookback — 입구가 연 코치가 아니면 null), 다시 그리기는 열린 내 위치
 // 판만, 완결되지 않은 답의 까닭은 계기(load)에 남긴다. 답이 오면 이 셸이 그대로이고 그 계정일 때만 적는다.
 const monthAsker=createMonthAsker({answers:createMonthAnswers({storage:(()=>{try{return target?.localStorage??null;}catch{return null;}})()}),
  account:()=>owner==='guest'?null:owner,lineOf:coachNow=>homeNext?.lookback?.(coachNow)||null,dayOf:()=>homePlanner?homePlanner.todayKey(Date.now()):null,
  offsetOf:()=>-new Date().getTimezoneOffset(),redraw:()=>redrawNext(),note:code=>homeNext?.note?.('load',{ok:false,code}),
  alive:account=>!stopped&&getProgress()?.owner===account});
 // 예상 급수의 근거 상자(4-4d — 단계4_계획 §21-23의 2): 서버 길 계정의 근거 수는 서버의 근거 읽기로 묻는다. 학습일 답과 같은 상자(묻기 · 받기 ·
 // 다시 그리기의 상한)이고 종류만 다르다(FIRST_KIND — 열쇠 머리 · 값의 꼴 · 받은 답 읽기). 묻는 줄은 그 코치를 연 판의 근거 읽기(homeNext.firstAnswers).
 // 지우는 길(로그아웃 · 동의 바꿈)의 clearMonthAnswer가 두 열쇠를 함께 지운다.
 const evidenceAsker=createMonthAsker({kind:FIRST_KIND,answers:createMonthAnswers({kind:FIRST_KIND,storage:(()=>{try{return target?.localStorage??null;}catch{return null;}})()}),
  account:()=>owner==='guest'?null:owner,lineOf:coachNow=>homeNext?.firstAnswers?.(coachNow)||null,dayOf:()=>homePlanner?homePlanner.todayKey(Date.now()):null,
  offsetOf:()=>-new Date().getTimezoneOffset(),redraw:()=>redrawNext(),note:code=>homeNext?.note?.('load',{ok:false,code}),
  alive:account=>!stopped&&getProgress()?.owner===account});
 // 요약의 모양 — 능력 줄 수 · 측정 답 수 · 칸의 첫 답 수 · 단위 줄 수 · 만난 자리 수 · 놓친 자리 수. 다른 기기나 다른 탭의 답이 받기로 접혀 오면 바뀐다.
 // 묶음 만남의 열쇠에 넣는다 — 학습일 · 판 끝 · 시험 · 기록이 다 왔는가만 보면, 기록이 다 온 탭이 열린 채 다른 기기에서 한 진단이 접혀 와도 그날
 // 내내 옛 만남(시작점 · 처음 보는 문항)으로 계획을 지었다(4-4b 끝 판 C2). 요약이 그대로면 다시 묻지 않는다(A8).
 const summaryShape=summary=>{let n=0,cells=0,sittings=0,lapses=0;for(const skill of summary?.skills||[]){n+=skill.n||0;for(const cell of skill.cells||[])cells+=(cell.independent||0)+(cell.helped||0);}
  for(const unit of summary?.units||[]){sittings+=unit.sittings||0;lapses+=unit.lapses||0;}return [summary?.skills?.length||0,n,cells,summary?.units?.length||0,sittings,lapses].join('.');};
 function weekNext(coachNow,values,now){
  const N=homePlanner?.plan,P=homePlanner?.position;
  const info=position?.exam?.examInfo?.(values)||null;
  if(!N||!P||!coachNow||!info||typeof coachNow.exposures!=='function')return null;
  const exam=examOf(values),audioAvailable=values?.audio!=='off',listening=item=>item.audioRequired??item.modality==='listening';
  const summary=coachNow.summary(),diagnostic=position.items,practice=position.practice.pool;
  const synced=nextSync.coach===coachNow?nextSync.value:null;
  const complete=N.recordsComplete(summary.storage,synced);
  const key=[homePlanner.todayKey(now),planEnds,info.type,complete,summaryShape(summary)].join('|');
  // 시험 형식 풀(4-4d — 점검 칸의 시험 형식 줄)도 같은 묶음 만남 한 번에 묻는다 — 다시 그릴 때마다 따로 묻지 않는다(A8과 같은 막이).
  const mockPool=Array.isArray(position.mock?.pool)?position.mock.pool:[];
  if(weekMet.coach!==coachNow||weekMet.key!==key)weekMet={coach:coachNow,key,met:coachNow.exposures([...diagnostic,...practice,...mockPool])};
  const metDiag=weekMet.met.slice(0,diagnostic.length),metPractice=weekMet.met.slice(diagnostic.length,diagnostic.length+practice.length),metMock=weekMet.met.slice(diagnostic.length+practice.length);
  const at=new Map(practice.map((item,i)=>[item,i])),seenOf=item=>{const row=metPractice[at.get(item)];return row?row.seen:null;};
  const fresh=new Set();practice.forEach((item,i)=>{if(metPractice[i]?.seen===false&&(audioAvailable||!listening(item)))fresh.add(item.skillId);});
  const pools=[{items:diagnostic,exposures:metDiag},{items:practice,exposures:metPractice}],skip=item=>P.withheldItem(item);
  const unseen=P.unseenFamilies(pools,skip),prefer=id=>fresh.has(id);
  // 점검 칸의 진단은 내 위치 판과 같은 시험의 칸으로 고른다. 계획의 읽개는 두 시험의 칸으로 짓는다(TOPIK II 학생의 다리 — planBoard).
  const board=P.buildPositionNext({exam,skills:P.examSkills(engine.SKILLS,exam),summary,prefer,synced,unseen});
  const diag=P.selectDiagnosticNext({position:board,items:diagnostic,exposures:metDiag,audioAvailable});
  const reader=N.planReader({board:N.planBoard({nodes:engine.SKILLS,summary,prefer,synced,unseen}),nodes:engine.SKILLS,start:ids=>N.planStart({ids,pools,skip})});
  const writingAvailable=info.type==='topik2'?writingList().map(row=>({id:row.id,routeId:row.route,skillIds:(Array.isArray(row.targets)?row.targets:[]).filter(id=>typeof id==='string')})):[];
  let writingTimes=[];if(info.type==='topik2'&&typeof writingPractice?.attempts==='function'){try{const times=writingPractice.attempts();writingTimes=Array.isArray(times)?times:[];}catch{writingTimes=[];}}
  // 말하기는 이 기기 기록만 센다(계정의 Trail 시도는 옛 판의 기록이라 읽지 않는다 — §21-6 「말하기」).
  const speaking=['topik1','topik2'].includes(info.type)&&speakingChosen()?speakingThisWeek(now,[]):null;
  let progress=null;try{progress=getProgress().exportSnapshot();}catch{progress=null;}
  const ready=diag.status==='ready'&&diag.items.length>0;
  // 지금 열 수 있는 연습: 짧은 연습은 이 학생의 시험 풀(practiceFor)에서 처음 보는 문항 수다. 듣기 게임은 4-6까지 새 길의 후보가 아니다(§21-6).
  const examPlan=N.buildPlanNext({examPlan:position.exam,info,reader,log:homeNext?.planLog?.(coachNow)??null,progress,now,classwork:classworkRows(),audioAvailable,
   available:{practice:position.practice.practiceSupply({pool:practiceFor(values),seen:seenOf,audioAvailable}),listening:{},recheck:ready?diag.items.length:0,life:true,
    writing:writingAvailable,topik2:topik2Domains(),...(speaking?{speaking:speaking.list}:{})},writingTimes,speaking});
  if(!examPlan)return null;
  // 점검 칸의 시험 형식 · 쓰기 · 말하기(4-4d — §21-23의 3). 값만 넘기고 줄은 홈 플래너가 짓는다(world-today.mjs). 시험 형식은 고르기가 ready일 때만
  // 그 판의 분 · 소리와 이번 주에 한 판이 있는가(이 기기의 판 기록 — 문항을 하나라도 낸 판은 그만두었어도 센다). 쓰기는 TOPIK II 학생의 53번과 그
  // 한 가지 고치기(열려 있고 계획 시각 앞일 때만), 말하기는 「말하기 평가도 준비해요」를 켠 학생의 이번 주에 아직 안 해 본 유형(이 기기 기록) 가운데
  // 첫 유형이다. 유형 열쇠는 그 말하기 항목의 능력 이름 끝 마디다(ko.speaking.answer → answer).
  // 시험 형식은 학생의 시험으로 고른다 — 홈 줄 · 이번 주 계획 단추가 여는 판(openMock)과 알림 시트(mockReady)가 고르는 시험이다. 내 위치 판에서
  // 누른 시험 단추(boardExam)로 고르면 그 시험 판의 분이 홈에 서고, 두 시험의 풀이 다르게 남은 날에는 줄이 섰는데 누르면 열 수 없었다(끝
  // 판 F5 · F9). 짧은 진단은 여는 길도 판의 시험을 따르므로 그대로 둔다(위 exam).
  const mockNow=position.topik?.ready===false?null:mockNextPlan(coachNow,values,studentExam(values),metMock),examWeek=position.exam.examWeek(now);
  // 이번 주에 한 판의 수(이 기기의 판 기록) — 점검 칸의 시험 형식 줄과 차례 돌리기의 한 수(world-today.mjs checkShift)가 함께 읽는다. 판 기록을
  // 읽지 못하면 null이다(돌리지 않는다 — 설계 주인 11-17 저녁 답 1).
  let mockDone=null;try{const times=homeNext?.planLog?.(coachNow)?.times?.('mock');if(Array.isArray(times))mockDone=times.filter(at=>at>=examWeek.start&&at<examWeek.end).length;}catch{mockDone=null;}
  const mock=mockNow?.status==='ready'?{minutes:mockNow.minutes,audioRequired:(mockNow.sections||[]).some(row=>row.section==='listening'&&row.status==='ready'),
   done:mockDone>0}:null;
  // 이번 주 계획 판의 시험 형식 칸(끝 판 F8 · 설계 주인 11-17 저녁 답 3): 지금 판(planWith)과 같은 꼴 · 같은 조건으로 고르기 결과를 싣는다 —
  // 계획 판(renderExamPlan)은 ready일 때만 그 칸을 그린다. 고르기가 홈 줄 · 알림 시트와 같아 칸과 여는 판이 어긋나지 않는다.
  if(mockNow)examPlan.mock={status:mockNow.status,minutes:mockNow.minutes,total:mockNow.total,sections:mockNow.sections.map(row=>({section:row.section,status:row.status,count:row.items.length,minutes:row.minutes}))};
  const row53=info.type==='topik2'?writingList().find(row=>row.route==='writing:53')||null:null;
  const need=row53?.practiceNeed&&Date.parse(row53.practiceNeed.at)<=now?row53.practiceNeed:null;
  // needAt — 그 고치기의 마지막 사건 시각. 홈 플래너가 이번 주 쓰기에서 열린 고치기인지 보고 보탬 줄을 세운다(설계 주인 11-17 다시 여쭘의 답 2).
  const needKind=['retry','assisted'].includes(need?.kind)?need.kind:null;
  const writing=row53?{label:writingLabel(row53.route),routeId:row53.route,minutes:row53.minutes,focus:'ending-53',need:needKind,needAt:needKind?need.at:null}:null;
  const first=speaking?.recommend?.[0]||null,listed=first?speaking.list.find(row=>row.route===first.routeId)||null:null;
  const type=typeof listed?.targets?.[0]==='string'?listed.targets[0].split('.').pop():null;
  const speakingNow=first&&type?{label:first.label,routeId:first.routeId,minutes:first.minutes,type,untried:speaking.untried}:null;
  return {examPlan,fresh:item=>seenOf(item)===false,diagnostic:{ready},mock,mockDone,writing,speaking:speakingNow};
 }
 // 새 길 판 끝(4-4b — 단계4_계획 §21-6 가): 채점된 첫 답이 하나라도 있으면 이 기기의 판 기록에 영역과 시각을 적는다(지금 판 weekActivity의 「처음 낸
 // 답」과 같은 기준 — 건너뛴 문항뿐이면 세지 않는다). 이번 주 계획의 묶음 만남도 다음에 다시 묻는다(판 끝). 한 판에 한 번만 센다(그만둔 뒤 끝이 이어 와도).
 function planOnce(coachNow,area){
  let done=false;
  return results=>{
   if(done)return;done=true;planEnds+=1;
   if(!(Array.isArray(results)?results:[]).some(row=>row&&!row.skipped&&(row.verdict==='correct'||row.verdict==='incorrect')))return;
   try{homeNext?.planLog?.(coachNow)?.record(area,Date.now());}catch{/* 이 기기에서 세지 못할 뿐이다 */}
  };
 }
 // 다시 그릴 때 펴 둔 능력 줄(details[data-skill])을 다시 편다(다시 검수). 다시 그린 판의 줄은 모두 접힌 채로 서는데, 닫힌 줄 안의 단추에는
 // 초점이 가지 않고 접힌 만큼 스크롤 자리도 어긋난다. 그래서 스크롤과 초점을 되돌리기 전에 줄부터 다시 편다.
 function openRowsOf(root){try{return[...(root?.querySelectorAll?.('details[data-skill]')||[])].filter(el=>el.open===true).map(el=>el.getAttribute('data-skill'));}catch{return[];}}
 function reopenRows(root,skills){if(!root||!skills?.length)return;try{for(const el of root.querySelectorAll?.('details[data-skill]')||[])if(skills.includes(el.getAttribute('data-skill')))el.open=true;}catch{/* 펴 둔 줄은 덤이다 */}}
 // 다시 그릴 때 판 안에 있던 초점을 같은 단추로 되돌린다(설계 주인 11-16 조건 3 — 다시 그리기는 스크롤과 초점을 지킨다. 생활 판 paint의 keepFocus와 같은 뜻).
 // 판 밖에 있던 초점은 건드리지 않는다. 같은 단추가 여럿이면 몇 번째였는지로 찾고, 그 단추가 없어졌으면 판 머리에 둔다. 능력 줄을 펴는 summary에
 // 있던 초점은 그 능력 줄(details[data-skill])의 summary로 되돌린다.
 const NEXT_FOCUS=['data-position-diagnostic','data-position-exam','data-position-practice','data-position-recheck','data-position-writing'];
 // 이번 주 계획 판의 단추 — 알림으로 열린 계획 판을 다시 그릴 때(D3)도 판 안의 초점을 같은 단추로 되돌린다. 홈의 판 보이기는 부를 때마다 닫기 단추에
 // 초점을 두므로, 되돌리지 않으면 초점을 잃는다(4-4b 다시 검수 -d GA1).
 const PLAN_FOCUS=['data-plan-next','data-plan-practice','data-plan-game','data-plan-recheck','data-plan-writing','data-plan-speaking','data-plan-mock','data-view'];
 function nextFocusOf(root,names=NEXT_FOCUS){
  try{
   const active=target.document?.activeElement;
   if(!root||!active||typeof root.contains!=='function'||!root.contains(active))return null;
   const name=names.find(key=>active.hasAttribute?.(key))??null;
   if(!name){const row=String(active.tagName||'').toUpperCase()==='SUMMARY'?active.closest?.('details[data-skill]'):null;return row?{name:null,skill:row.getAttribute('data-skill')}:{name:null};}
   const value=active.getAttribute(name);
   const same=[...(root.querySelectorAll?.(`[${name}]`)||[])].filter(el=>el.getAttribute?.(name)===value);
   return{name,value,index:Math.max(0,same.indexOf(active))};
  }catch{return null;}
 }
 function refocusNext(root,key){
  if(!root||!key)return;
  try{
   const same=key.name?[...(root.querySelectorAll?.(`[${key.name}]`)||[])].filter(el=>el.getAttribute?.(key.name)===key.value):[];
   const row=key.skill!=null?[...(root.querySelectorAll?.('details[data-skill]')||[])].find(el=>el.getAttribute?.('data-skill')===key.skill)?.querySelector?.('summary')??null:null;
   (same[key.index]??same[0]??row??root).focus?.({preventScroll:true});
  }catch{/* 초점은 덤이다 */}
 }
 // 새 길 판 그리기(21-2): 지금 판으로 내려왔으면 지금 판 판(그 문서 전체가 지금 판이다), 확인 중이면 확인 중 판, 엔진이면 엔진 판.
 // fresh: 방금 홈을 다시 그렸다(판 감시의 알림 — refresh를 또 부르지 않는다). start: 진단이 낼 문항이 있으면 바로 시작한다(홈 추천 · 계획의 다시 확인).
 function showNext({start=false,keepScroll=false,fresh=false}={}){
  check();
  const phase=homePhase();
  if(phase==='old'){const shown=showBoard(readCoach(),{keepScroll});if(start&&shown.plan?.status==='ready'&&shown.plan.items.length)startDiagnostic(shown.coachNow,shown.plan,shown.map);return;}
  if(!fresh){const was=redrawingNext;redrawingNext=true;try{refresh();}finally{redrawingNext=was;}}
  const P=homePlanner?.position,draw=nextViewOf(),coachNow=phase==='engine'?homeWatch?.coach?.()??null:null;
  let data=null;
  // 닫힌 코치(판이 막 다시 정해짐)는 던진다 — 확인 중 판으로 두고 판 감시의 알림에서 다시 그린다.
  if(coachNow&&P&&draw){try{data=nextData(coachNow,P);}catch{data=null;}}
  const scroller=keepScroll?panelNode('[data-position-next]')?.closest?.('#panel-content'):null,scrollTop=scroller?.scrollTop||0,focusKey=keepScroll?nextFocusOf(panelNode('[data-position-next]')):null,openRows=keepScroll?openRowsOf(panelNode('[data-position-next]')):[];
  if(!data){home.showPanel(t('position.title'),nextChecking(),PANEL);panelNode('[data-position-next]')?.focus?.({preventScroll:true});return;}
  const two=topik2Domains(),exams=studentExam(data.values)==='topik2'||two.listening||two.reading?['topik1','topik2']:null;
  home.showPanel(t('position.title'),draw.board({board:data.board,plan:data.plan,cards:data.cards,exams,practice:id=>data.fresh.has(id),scope:data.scope,diagnosed,writing:data.exam==='topik2'&&writingList().length>0,month:data.month,estimate:data.estimate,mock:data.mock}),PANEL);heard.panel=false;
  const root=panelNode('[data-position-next]');
  if(keepScroll){reopenRows(root,openRows);const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}else root?.focus?.({preventScroll:true});
  // 첫 받기의 된 답이 아직 없으면(새로 연 코치 · 시간 초과 · 실패) 다시 묻는다 — 된 답이 오면 syncedNext가 다시 그린다(끝 판 GB1).
  void syncedNext(coachNow);
  root?.querySelector?.('[data-position-diagnostic]')?.addEventListener('click',()=>{try{startDiagnosticNext(coachNow,data);}catch(error){failed(error);}},{once:true});
  root?.querySelectorAll?.('[data-position-exam]').forEach(button=>button.addEventListener('click',()=>{try{check();boardExam=button.dataset.positionExam==='topik2'?'topik2':'topik1';showNext({keepScroll:true});}catch(error){failed(error);}}));
  root?.querySelectorAll?.('[data-position-practice]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(startPractice(button.dataset.positionPractice)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelectorAll?.('[data-position-recheck]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(openRecheck(button.dataset.positionRecheck,data)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelector?.('[data-position-writing]')?.addEventListener('click',()=>{try{check();const first=writingList()[0];if(first&&typeof writingPractice?.open==='function')void Promise.resolve(writingPractice.open(first.route)).catch(failed);}catch(error){failed(error);}});
  // 시험 형식 단추(4-4d) — openMock이 판 셋을 가른다(엔진이면 새 코치의 연습, §21-23의 1).
  root?.querySelector?.('[data-position-mock]')?.addEventListener('click',()=>{try{check();void Promise.resolve(openMock({exam:data.exam})).catch(failed);}catch(error){failed(error);}});
  if(start&&data.plan.status==='ready'&&data.plan.items.length)startDiagnosticNext(coachNow,data);
 }
 // 열린 새 길 판을 다시 그린다 — 판이 다시 정해짐(retired → 확인 중) · 홈 코치가 섬 · 첫 받기 답이 옴 · 플래너가 옴(21-2). 진단 중(판 대신 문항 판)이거나
 // 내 위치 · 새 길 시험 형식을 여는 중이면 두고(끝 판 F6), 다시 그리는 동안 refresh가 이것을 또 부르지 않게 막는다. 닫으며 흐려지는 판(판
 // 종류가 빈 값)은 다시 그리지 않는다 —
 // 닫은 판이 다시 열린다(설계 검토 D1).
 function redrawNext(){
  if(redrawingNext||stopped||openPosition.pending||heldMock())return;
  redrawingNext=true;
  try{if(panelOpen()&&panelNode('[data-position-next]'))showNext({keepScroll:true,fresh:true});}catch{/* the next open draws it */}finally{redrawingNext=false;}
 }
 // 다시 확인 카드 열기(21-4): 생활 단위는 생활 판정이 그 단위로 낸 복습을, 짧은 연습 단위는 그 단위가 든 문항만 후보로 넘긴 새 판 짧은 연습을 연다.
 function openRecheck(unit,data){
  const card=data.cards.find(row=>row.unit===unit&&row.open);
  if(!card){home.toast(t('followup.noSupply'));return;}
  if(card.source==='life'){
   const ids=(data.judged?.items||[]).filter(row=>row.unit===unit).map(row=>row.id);
   let open=null;try{open=homePlanner.position.lifeReview(ids,getProgress().exportSnapshot(),data.values,Date.now());}catch{open=null;}
   if(!open){home.toast(t('followup.noSupply'));return;}
   return startReview(open.lessonId,open.reviewIds);
  }
  return startPractice(null,{only:card.items});
 }
 // 새 길의 짧은 진단 한 바퀴(21-5): 문항 차례는 제품이 정하고(present), 듣기 재생 규칙은 셸이 넘긴다(지금 판과 같은 allowedPlays · nextPlay).
 // 판이 다시 정해져 코치가 닫히면 안내 한 줄과 함께 닫는다(검토 C4). 끝 화면은 답이 다 저장된 뒤의 evidence로 그린다(칸이 아직 모를 수 있다 — 21-3).
 // 문항 판과 끝 화면은 지금 판 그림을 쓴다(계약의 꼴이 같다 — 끝 화면의 map 자리에 새 판 한 장을 넘긴다: exam · counts · total · skills[].id).
 function startDiagnosticNext(coachNow,data){
  check();
  const P=homePlanner?.position;
  if(!P||data?.plan?.status!=='ready'||!data.plan.items.length)return;
  const session=P.createDiagnosticNextSession({coach:coachNow,items:data.plan.items.map(row=>row.item),plays:{allowedPlays:position.mock.allowedPlays,nextPlay:position.mock.nextPlay}});
  const counted=planOnce(coachNow,'recheck'); // 이번 주 계획의 다시 확인(4-4b)
  let clip=null,playing=false,notice='',ended=false,finishing=false,unwatch=()=>{};
  const silence=()=>{const sound=clip;clip=null;playing=false;try{sound?.pause();}catch{}};
  // 그만두면 세션이 판을 기록 없이 닫는다(끝 판 F2). 손님 요약이 그 답으로 다 접히면 열린 내 위치 판을 한 번 다시 그린다 — 판은 접히기 전 칸(따라오는 중)으로 먼저 선다.
  const stop=()=>{unwatch();if(ended)return;ended=true;silence();let set=null;try{set=session.stop();}catch{set=null;}if(session.results().length)diagnosed=true;counted(session.results());queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});};
  // 코치가 닫혔다(판을 다시 정함 — DISPOSED · retired) — 안내 한 줄과 함께 진단을 닫고 내 위치를 다시 연다(그 판으로).
  const closed=()=>{if(ended&&!finishing)return;finishing=false;stop();home.toast(t('practice.next.changed'));void openMyPosition();};
  home.showPanel(t('position.diagnostic.title'),'<div class="wpos-stage" data-position-stage></div>',{...PANEL,eyebrow:'QUICK CHECK'});
  home.attachPanelResource?.({dispose:stop});
  const box=panelNode('[data-position-stage]');if(!box){stop();return;}
  unwatch=homeNext?.retired?.(coachNow,closed)??(()=>{});
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  function paint(focus='.wpos-run-skill'){
   if(session.disposed){closed();return;}
   const now=session.current;if(!now){void finish();return;}
   box.innerHTML=view.renderDiagnosticItem({view:now,skill:{id:now.item.skillId},notice,playing});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  function advance(message=''){
   notice=message;
   if(!session.next()){if(session.disposed)closed();else void finish();return;}
   paint();top();
  }
  async function finish(){
   if(finishing||ended)return;
   finishing=true;ended=true;silence();
   try{await session.settled();}catch{/* 저장에 실패한 답은 혼자 맞힘이 아니다 */}
   counted(session.results());
   // 저장을 기다리는 사이 판이 닫혔거나(패널을 닫음) 코치가 닫혔다 — 판 기록 없이 닫는다(닫힌 코치면 session.finish가 null). 닫지 않으면 손님
   // 칸이 그 답으로 다시 접히지 않고 다음 진단이 같은 기본 판으로 묶였다(끝 판 F2). 끝내기가 판을 끝난 것으로 두어 판을 닫을 때의 정리(stop)가
   // 아무것도 하지 않으므로, 판만 닫혔으면 여기서 stop처럼 홈을 다시 그리고 요약이 접히면 열린 내 위치 판을 다시 그린다. 코치가 닫혔으면 closed가
   // 내 위치를 이미 열었다(시험 형식 판의 끝 판 검수 E1과 같은 막이).
   if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){if(session.results().length)diagnosed=true;queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}
   finishing=false;unwatch();
   const results=session.results();if(results.length)diagnosed=true;
   // 기기 기록부(손님 · 동의를 끈 계정 — storage.guest)는 판을 닫으면 요약이 그 판의 답으로 다시 접힌다. 접힌 뒤의 칸으로 끝 화면을 그린다(21-3 판 끝
   // 칸 견주기 · 끝 판 F3). 계정은 서버가 접어 칸이 아직 모를 수 있으니 기다리지 않는다(문항 줄은 답의 evidence로 그린다). 기록부는 판을
   // 닫기 전에 읽는다 — 닫은 뒤 첫 요약 읽기가 접힌 칸이게.
   let local=false;try{local=coachNow.summary()?.storage?.guest===true;}catch{local=false;}
   // 판 기록은 학습자 응답이 켜진 계정만(지금 판 finishSet과 같은 규칙) — 그 밖에는 닫기만 한다(손님 요약이 그 판의 답으로 다시 접힌다).
   // 접기를 기다리는 사이 판이 닫혔으면 끝 화면은 그리지 않되, 끝낸 판이라 홈과 열린 내 위치 판은 그 답으로 다시 그린다(E1과 같은 막이).
   const set=session.finish({record:answering()});
   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});return;}}
   refresh();
   let after=data;try{after=nextData(coachNow,P);}catch{after=data;}
   const routes=new Map([...after.fresh].map(id=>[id,{route:'practice',skillId:id}]));
   const response=answering()&&set?.completionId?set:null;
   box.innerHTML=view.renderDiagnosticDone({map:after.board,results,items:position.itemsById,practice:id=>routes.get(id)||null,response:responseView(response,'diagnostic')});
   bindPractice(box,routes);bindResponse({box,coachNow,set:response,kind:'diagnostic'});
   box.querySelector('[data-position-done]')?.focus?.({preventScroll:true});top();
   evidenced();
  }
  // 소리는 실제 재생기의 끝(ended) · 실패(error)만 진단에 알린다(지금 판과 같다).
  function listen(){
   const now=session.current;if(!now||now.answered||playing||!now.item.audio)return;
   if(session.replay()===false){if(session.disposed)closed();return;}
   notice='';
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
    else if(button.hasAttribute('data-position-stop')){stop();showNext();}
    else if(button.hasAttribute('data-position-back'))showNext();
   }catch(error){stop();failed(error);}
  });
  advance('');
 }
 // start: 홈의 추천이 짧은 진단이면 판을 거치지 않고 바로 시작한다(판에서 시작 단추를 누른 것과 같다).
 async function openPosition({start=false}={}){
  if(!position)return;
  check();const ticket=++positionOpen;
  openPosition.pending=ticket;
  try{
  // 기다리는 동안 판을 닫거나 다른 판을 열면 이 표만 무효로 한다. 정상으로 그리기 직전에 settled가 되어 showPanel의 정리는 무시된다.
  let settled=false;
  home.attachPanelResource?.({dispose(){if(!settled&&ticket===positionOpen){positionOpen++;if(openPosition.pending===ticket)openPosition.pending=0;}}});
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
  }finally{if(openPosition.pending===ticket)openPosition.pending=0;}
 }
 // 새 길 「내 위치」 열기(4-4a — 단계4_계획 §21-2): 지금 판 열기(openPosition — 손대지 않는다)와 같은 차례(학습 호스트 · 은행 · 한글 갈림)를 따르되
 // 옛 코치를 열지 않는다. 한글 열쇠는 이미 든 옛 코치만 빌리고(heldCoach), 판은 홈 코치로 그린다(showNext). 엔진 판이면 홈 코치의 첫 받기 답을 한도
 // (4초) 안에서 기다린다(서버 길 계정의 「기록이 다 왔는가」 — 21-3 A3). 기다리는 사이 이 문서가 지금 판으로 내려오면 지금 판 열기로 넘긴다.
 async function openPositionNext({start=false}={}){
  if(!position)return;
  check();const ticket=++positionOpen;
  openPosition.pending=ticket;
  try{
  let settled=false;
  home.attachPanelResource?.({dispose(){if(!settled&&ticket===positionOpen){positionOpen++;if(openPosition.pending===ticket)openPosition.pending=0;}}});
  try{await prepare();}catch{/* the board shows the records as incomplete */}
  check();if(ticket!==positionOpen)return;
  try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still shows */}
  check();if(ticket!==positionOpen)return;
  try{await bankReady();}catch{/* the board opens with the reviewed game items */}
  check();if(ticket!==positionOpen)return;
  if(homePhase()==='engine'){try{await syncedNext(homeWatch.coach());}catch{/* 답이 없으면 기록 일부로 그린다 */}check();if(ticket!==positionOpen)return;}
  if(homePhase()==='old'){settled=true;return openPosition({start});}
  let reading=null;try{reading=getProgress().hangulReading?.()||null;}catch{reading=null;}
  let stage;
  try{stage=await hangulStage(heldCoach());}catch(error){check();if(ticket===positionOpen)failed(error);return;}
  check();if(ticket!==positionOpen)return;
  settled=true;
  if(position.showsHangulBoard({reading,stage})){showHangul(stage);return;}
  showNext({start});
  }finally{if(openPosition.pending===ticket)openPosition.pending=0;}
 }
 // 「내 위치」를 여는 곳은 모두 이것을 부른다 — 새 길 홈 입구가 있고 판이 지금 판이 아니면 새 길 열기, 아니면(꺼진 판 포함) 지금 판 열기.
 const openMyPosition=options=>homePhase()==='old'?openPosition(options):openPositionNext(options);
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
  box.querySelector('[data-town-position]')?.addEventListener('click',()=>{try{check();void openMyPosition();}catch(error){failed(error);}},{once:true});
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
 // only: 새 길 다시 확인 카드(4-4a — 21-4)가 넘기는 문항 열쇠들 — 그 단위가 든 문항만 후보로 새 판을 연다(지금 판 코치로는 그 단위를 겨눠 낼 수 없어
 // 새 길을 못 받으면 열지 않는다).
 async function startPractice(skillId,{followupId=null,more=false,only=null}={}){
  if(!position?.practice)return;
  check();const ticket=++practiceOpen;
  let launching=true;
  home.attachPanelResource?.({dispose(){if(launching&&ticket===practiceOpen)practiceOpen++;}});
  const active=()=>{check();return ticket===practiceOpen;};
  try{await prepare();}catch{/* device-local practice still runs */}
  if(!active())return;try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local practice still runs */}
  if(!active())return;try{await bankReady();}catch{/* reviewed game items still run */}
  if(!active())return;
  if(followupId){await Promise.race([loadFollowupBank(),new Promise(resolve=>setTimeout(resolve,4000))]);if(!active())return;}
  if(!active())return;
  // Atlas 새 길(재설계 단계 4-1, 기능 atlasNext — 리허설만): 엔진이 다음 문항을 고르는 판. 엔진이 준비되지 못하면 지금 판으로 간다.
  if(atlasNext&&!followupId){let next=null;try{next=await atlasNext.practiceCoach(position.practice.pool);}catch{next=null;}if(!active())return;if(next){launching=false;return runPracticeNext({next,skillId,more,only});}}
  if(only){home.toast(t('practice.unavailable'));return;}
  const coachNow=readPracticeCoach();if(!coachNow){home.toast(t('practice.unavailable'));return;}
  let audioAvailable=true;try{audioAvailable=getProgress().learningProfileValues().audio!=='off';}catch{}
  const followup=followupId?delayedRows().rows.find(row=>row.id===followupId&&row.status==='due'&&row.available):null;
  if(followupId&&!followup){home.toast(t('followup.noSupply'));return;}
  if(followup)skillId=followup.measure.skillId;
  const summary=coachNow.summary(),seen=seenBy(coachNow),exam=skillExam(skillId),listening=String(skillId).split('.')[1]==='listening';
  const selection=followup?{status:'ready',items:[followup.item]}:position.practice.selectPractice({summary,pool:position.practice.pool,seen,skillId,audioAvailable,count:practiceLength()});
  if(selection.status==='none'){home.toast(t(selection.reason==='history.incomplete'?'position.diagnostic.history':selection.reason==='audio'?'practice.audioOff':'practice.shortage'));void openMyPosition();return;}
  const session=position.practice.createPracticeSession({coach:coachNow,items:selection.items});
  const mapOf=()=>{try{return position.buildPositionMap({summary:coachNow.summary(),events:coachNow.events?.()||[],policy:engine.POLICY,exam});}catch{return null;}};
  const before=mapOf()?.skills.find(skill=>skill.id===skillId)||null;
  let ended=false,notice='';
  // 아직 못 들은 문항의 재생 실패는 듣기 칸 한 줄(listenNote)이 알린다 — 상태 줄에는 이미 들은 뒤 다시 듣기가 실패했을 때만.
  const player=soundPlayer({session,url:audioUrl,onChange:state=>{if(ended)return;notice=state==='failed'&&session.current?.heard?t('position.diagnostic.audioFailed'):'';paint(state==='completed'?'.wpos-choice:not([disabled])':'[data-practice-listen]');}});
  const stop=()=>{if(ended)return;ended=true;player.silence();try{session.stop();}catch{}try{coachNow.flush?.();}catch{}queueMicrotask(()=>refresh());};
  launching=false;home.showPanel(t(listening?'practice.title.listening':'practice.title'),'<div class="wpos-stage" data-practice-stage></div>',{...PANEL,eyebrow:'PRACTICE'});
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
    else if(button.hasAttribute('data-practice-stop')){stop();void openMyPosition();}
    else if(button.hasAttribute('data-practice-again'))void Promise.resolve(startPractice(skillId)).catch(failed);
    else if(button.hasAttribute('data-practice-position'))void openMyPosition();
    else if(button.hasAttribute('data-practice-home'))home.closePanel();
   }catch(error){stop();failed(error);}
  });
  advance();
 }
 // 짧은 연습의 새 판(Atlas 재설계 단계 4-1 — 단계4_계획 §7): 다음 문항은 엔진이 고르고(world-practice-next.mjs), 문항 위에 이유 한 줄,
 // 끈질긴 단위는 힌트 먼저, 「모르겠어요」는 그 표지가 있는 문항에만. 판 끝은 답이 다 저장된 뒤(혼자 맞힘은 저장 뒤 값) 끝난 까닭과 함께 그린다.
 function runPracticeNext({next,skillId,more=false,only=null}){
  let audioAvailable=true;try{audioAvailable=getProgress().learningProfileValues().audio!=='off';}catch{}
  const all=position.practice.pool,fits=item=>audioAvailable||!(item.audioRequired??item.modality==='listening');
  // 다시 확인 카드(only)는 그 단위가 든 문항만 — 판의 항목 이름은 그 첫 문항의 능력이다.
  const pool=Array.isArray(only)?all.filter(item=>only.includes(item.itemKey)&&fits(item)):all.filter(item=>item.skillId===skillId&&fits(item));
  if(Array.isArray(only)&&pool.length)skillId=pool[0].skillId;
  const listening=String(skillId).split('.')[1]==='listening';
  if(!pool.length){home.toast(t(audioAvailable?'practice.shortage':'practice.audioOff'));void openMyPosition();return;}
  const count=practiceLength(next),skill={id:skillId,label:skillLabel(skillId)};
  const session=atlasNext.createPracticeNextSession({coach:next,pool,setPool:all,length:count,audioAvailable,more,lang:currentLang(),plays:{allowedPlays:position.mock.allowedPlays,nextPlay:position.mock.nextPlay}});
  const counted=planOnce(next,listening?'listening':'reading'); // 이번 주 계획의 영역(4-4b)
  // finishing: 판 끝이 답 저장을 기다리는 중 · changedWhileFinishing: 그 사이 판이 바뀌었다(아래 지켜보는 함수 — 넘친 #10).
  let ended=false,notice='',unwatch=()=>{},finishing=false,changedWhileFinishing=false;
  const player=soundPlayer({session,url:audioUrl,onChange:state=>{if(ended)return;notice=state==='failed'&&session.current?.heard?t('position.diagnostic.audioFailed'):'';paint(state==='completed'?'.wpos-choice:not([disabled])':'[data-practice-listen]');}});
  const stop=()=>{unwatch();if(ended)return;ended=true;player.silence();try{session.stop();}catch{}counted(session.results());queueMicrotask(()=>refresh());};
  home.showPanel(t(listening?'practice.title.listening':'practice.title'),'<div class="wpos-stage" data-practice-stage></div>',{...PANEL,eyebrow:'PRACTICE'});
  home.attachPanelResource?.({dispose:stop});
  // 판을 다시 정해 이 코치가 닫히면(동의 판이 오름 · 동의 꺼짐 · 서버 스위치 꺼짐 — 단계4_계획 §18-5-5 G4) 안내 한 줄과 함께 연습을 닫는다.
  // 끝 화면은 그대로 둔다(이미 저장을 기다려 셈을 보였다). 다음 연습은 입구가 계정을 다시 읽어 정한 판으로 연다.
  // 판 끝이 저장을 기다리는 사이 바뀌면 표시만 남긴다 — 끝내는 함수가 기다림 뒤에 안내 한 줄과 함께 닫는다(넘친 #10 — 끝 화면도 안내도 없이
  // 마지막 문항 화면에 멈추고 닫힌 코치의 거절이 새던 것).
  unwatch=atlasNext.retired?.(next,()=>{if(finishing){changedWhileFinishing=true;return;}if(ended)return;stop();home.toast(t('practice.next.changed'));void openMyPosition();})??(()=>{});
  const box=panelNode('[data-practice-stage]');if(!box){stop();return;}
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  function paint(focus='.wpos-run-skill'){
   const now=session.current;if(!now){void finish();return;}
   // 듣기 문항은 듣기 전 화면에 찾아볼 글이 없다 — 「들으면서 먼저 찾아보세요」 꼴(4-1 화면 최종 F2).
   const heard=now.item.audioRequired??now.item.modality==='listening';
   const cue=now.stubborn&&now.targetLabel?t(heard?'practice.next.cue.listen':'practice.next.cue',{name:now.targetLabel}):null;
   box.innerHTML=view.renderPracticeItem({view:{...now,cue},skill,feedback:now.feedback,playing:player.playing,notice});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  // 힌트를 실제로 보일 때만 도움으로 남긴다 — 이름이 없어 힌트 줄을 못 그리는 끈질긴 단위 문항에 보이지 않은 도움이 적히지 않게(A3).
  function advance(){player.silence();notice='';const now=session.next();if(!now){void finish();return;}if(now.stubborn&&now.targetLabel)session.preHelp();paint();top();}
  // 판 끝은 한 번만 — 마지막 문항에서 저장을 기다리는 사이 「다음」 · 「건너뛰기」를 거듭 눌러도 판 기록 · 응답이 두 번 서지 않게(A4).
  async function finish(){
   if(finishing||(ended&&!box.isConnected))return;
   finishing=true;ended=true;player.silence();
   let results=session.results();try{results=await session.settled();}catch{/* 저장에 실패한 답은 혼자 맞힘이 아니다 */}
   counted(results);
   if(!box.isConnected)return;
   if(changedWhileFinishing){unwatch();home.toast(t('practice.next.changed'));void openMyPosition();return;}
   // 닫힌 코치(판이 바뀐 직후)는 남은 수를 못 센다 — 「더 하기」 없이 그린다.
   let more=null;try{more=session.freshLeft();}catch{more=null;}
   const set=finishSet(next,'short');
   box.innerHTML=view.renderPracticeNextDone({skill,results,items:new Map([...position.itemsById,...all.map(item=>[item.id,item])]),listening,count,more,ending:session.ending,response:responseView(set,'short')});
   bindResponse({box,coachNow:next,set,kind:'short',next:true});
   box.querySelector('[data-practice-done]')?.focus?.({preventScroll:true});top();
   queueMicrotask(()=>refresh());evidenced();
  }
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||button.disabled)return;
   try{
    check();
    if(button.dataset.practiceChoice){player.silence();notice='';session.answer(button.dataset.practiceChoice);paint('[data-practice-feedback]');}
    else if(button.hasAttribute('data-practice-unknown')){player.silence();notice='';session.unknown();paint('[data-practice-feedback]');}
    else if(button.hasAttribute('data-practice-listen'))player.play();
    else if(button.hasAttribute('data-practice-next'))advance();
    else if(button.hasAttribute('data-practice-skip')){player.silence();session.skip();advance();}
    else if(button.hasAttribute('data-practice-stop')){stop();void openMyPosition();}
    // 「새 말 더 배우기」로 연 판 뒤의 「N문항 더 하기」는 같은 방문 안에서 more를 이어 넘긴다 — 오늘 더 배우겠다고 고른 사람이 판마다
    // 0문항 「여기까지」를 거쳐 두 번 누르지 않게(4-1 화면 최종 P1). 내 위치로 나갔다 다시 들어오면 처음부터.
    else if(button.hasAttribute('data-practice-again'))void Promise.resolve(startPractice(skillId,{more})).catch(failed);
    else if(button.hasAttribute('data-practice-more'))void Promise.resolve(startPractice(skillId,{more:true})).catch(failed);
    else if(button.hasAttribute('data-practice-position'))void openMyPosition();
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
 // 판 셋(4-4d — 단계4_계획 §21-23의 1 · 설계 검토 F7): 여는 곳 넷(알림 시트 · 홈 줄 · 내 위치 단추 · 이번 주 계획 단추)이 모두 이 검사를 지난다.
 // 지금 판이면 지금 판 연습(openMockOld — 손대지 않는다), 아니면 새 길 연습(openMockNext — 새 길 문서에서는 옛 코치 'world-mock'을 열지 않는다).
 function openMock(options){
  if(!position?.mock)return;
  return homePhase()==='old'?openMockOld(options):openMockNext(options);
 }
 async function openMockOld({exam=null}={}){
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
  if(!plan||plan.status!=='ready'){home.toast(t(plan?'mock.unavailable':'position.diagnostic.history'));void openMyPosition();return;}
  const sections=plan.sections.filter(row=>row.status==='ready');
  home.showPanel(t('mock.title'),'<div class="wpos-stage" data-mock-stage></div>',{...PANEL,eyebrow:'EXAM FORM'});
  const box=panelNode('[data-mock-stage]');if(!box)return;
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  box.innerHTML=view.renderMockIntro({plan,exam:which,mode:values.examMode||null});
  box.querySelector('[data-mock-intro]')?.focus?.({preventScroll:true});top();
  box.querySelector('[data-mock-start]')?.addEventListener('click',()=>{try{check();runMock({coachNow,plan,sections,exam:which,mode:values.examMode||null,box,top});}catch(error){failed(error);}},{once:true});
  box.querySelector('[data-mock-later]')?.addEventListener('click',()=>{try{void openMyPosition();}catch(error){failed(error);}},{once:true});
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
    else if(button.hasAttribute('data-mock-position'))void openMyPosition();
    else if(button.hasAttribute('data-mock-home'))home.closePanel();
   }catch(error){stop();failed(error);}
  });
  startSection();
 }
 // 새 길 시험 형식 고르기(4-4d — §21-23의 1 · 5): 홈 코치의 묶음 만남과 「기록이 다 왔는가」(내 위치 판과 같은 첫 받기 답 — 21-3)로 지금 판 구성
 // (selectMock)을 고른다. 시험 형식 풀의 은행(topik-items · blank-slice)은 홈 은행 안에 있고 같은 판의 코치들은 한 호스트를 나눠 쓰므로, 어느 코치로
 // 보아도 만남이 같다. 알림 시트의 판정(canMock)과 여는 길(openMockNext)이 이 고르기 하나를 쓴다 — 단추 글과 여는 것이 어긋나지 않게. 못 고르면 null.
 function mockNextPlan(coachNow,values,exam,met=null){
  const P=homePlanner?.position,N=homePlanner?.plan,mock=position?.mock;
  if(!mock||typeof P?.selectMockNext!=='function'||typeof N?.recordsComplete!=='function'||typeof coachNow?.exposures!=='function')return null;
  const synced=nextSync.coach===coachNow?nextSync.value:null;
  try{return P.selectMockNext({select:mock.selectMock,forms:mock.forms,exam,pool:mock.pool,exposures:met&&met.length===mock.pool.length?met:coachNow.exposures(mock.pool),complete:N.recordsComplete(coachNow.summary().storage,synced),audioAvailable:values?.audio!=='off'});}catch{return null;}
 }
 // 알림 시트 「시험 점검」의 판정(4-4d — §21-23의 5): 지금 판이면 지금처럼 참이다(열 수 없으면 openMock이 알린다). 새 길이면 그 자리에서 홈 코치로
 // 판정한다 — 엔진 판이고, 홈 코치와 시험 은행이 준비됐고, 기록이 다 왔고, 고르기가 홈 코치의 묶음 만남으로 ready일 때만 참이다. 시험 형식 코치를
 // 따로 만들지 않는다(같은 호스트의 만남이라 어느 코치로 보아도 같다). 하나라도 모르면 거짓이다.
 function mockReady(){
  if(stopped||!position?.mock)return false;
  const phase=homePhase();
  if(phase==='old')return true;
  if(phase!=='engine'||position.topik?.ready===false)return false;
  const coachNow=homeWatch?.coach?.()??null;if(!coachNow)return false;
  let values={};try{values=getProgress().learningProfileValues()||{};}catch{return false;}
  return mockNextPlan(coachNow,values,studentExam(values))?.status==='ready';
 }
 // 새 길 시험 형식 연습 열기(§21-23의 1): 지금 판 열기와 같은 차례(학습 호스트 · 은행)를 따른다. 확인 중이면 판이 설 때까지 한도(PLAN_WAIT_MS) 안에서
 // 기다리고(이번 주 계획과 같은 기다림 — settledHome), 넘기면 「확인 중」으로 알린다 — 옛 코치를 열지 않는다. 기다리는 사이 이 문서가 지금 판으로
 // 내려오면 지금 판 열기로 넘긴다(내 위치와 같다). 엔진 판이면 홈 코치의 첫 받기 답을 한도 안에서 기다린 뒤 고르고, 열 수 없으면(처음 보는 문항이
 // 모자람 · 기록이 다 오지 않음) 지금처럼 알리고 내 위치로 간다. 연습은 입구가 연 'world-mock' 코치로 한다(판 번호 set.world-mock.…이 예상 급수
 // 근거의 판을 가린다 — §21-23의 2). 그 코치를 못 받으면(입구가 지금 판으로 정함 · 엔진을 못 받음) 지금 판의 안내 한 줄이다. 기다림(판이 서기 ·
 // 첫 받기 · 코치 받기)이 길 수 있어, 그 사이 학생이 다른 판을 열거나 닫았으면 덮지 않는다(이번 주 계획과 같은 막이 — 4-4b 다시 검수 FA2).
 // 열 수 없는 날에는 시험 형식 코치를 열지 않는다(고르기는 홈 코치로 한다).
 async function openMockNext({exam=null}={}){
  check();const ticket=++mockOpen,panel=home.openPanel?.()??'';
  openMockNext.pending=ticket;
  let settled=false;
  try{
  // 기다리는 동안 판 종류가 바뀌었거나, 판을 닫거나 다른 판을 열어 판 자원이 정리되면 이 표만 무효로 한다(내 위치 열기와 같은 판 자원 — 끝
  // 판 F6). 판 종류로만 가리면 내 위치 · 짧은 진단 · 이번 주 계획처럼 종류가 같은 판을 그 사이 열어도 늦게 온 안내가 그 판을 덮고 연습을 닫았다.
  // 기다리는 동안은 열린 판을 뒤에서 다시 그리지 않는다(pending — 다시 그리기도 판 자원을 정리하므로, 첫 받기 답이 내 위치 판을 다시 그리면 이
  // 열기가 끊긴다). 판을 보이기 직전에 settled가 되어 그 판의 정리는 무시된다. 판이 바뀌면 건너뛴 다시 그리기도 지운다(새 판은 새로 그려졌다).
  home.attachPanelResource?.({dispose(){if(!settled&&ticket===mockOpen){mockOpen++;if(openMockNext.pending===ticket){openMockNext.pending=0;openMockNext.skipped=false;}}}});
  const moved=()=>ticket!==mockOpen||(home.openPanel?.()??'')!==panel;
  try{await prepare();}catch{/* device-local practice still runs */}
  check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local practice still runs */}
  check();try{await bankReady();}catch{/* the intro says what is missing */}
  check();if(ticket!==mockOpen)return;
  if(homePhase()==='checking'){await settledHome();check();if(moved())return;}
  if(homePhase()==='old'){settled=true;return openMockOld({exam});}
  const homeCoach=homePhase()==='engine'?homeWatch?.coach?.()??null:null;
  if(!homeCoach){home.toast(t('homeTutor.checking'));return;}
  try{await syncedNext(homeCoach);}catch{/* 답이 없으면 기록이 덜 왔다 — 아래 고르기가 열지 않는다 */}
  check();if(moved())return;
  let values={};try{values=getProgress().learningProfileValues()||{};}catch{values={};}
  const which=exam||studentExam(values),plan=mockNextPlan(homeCoach,values,which);
  if(!plan||plan.status!=='ready'){settled=true;home.toast(t(plan?.reason==='history.incomplete'?'position.diagnostic.history':'mock.unavailable'));void openMyPosition();return;}
  let next=null;try{next=await atlasNext?.mockCoach?.(position.mock.pool)??null;}catch{next=null;}
  check();if(moved())return;
  if(homePhase()==='old'){settled=true;return openMockOld({exam});}
  if(!next){home.toast(t('practice.unavailable'));return;}
  const sections=plan.sections.filter(row=>row.status==='ready');
  settled=true;
  home.showPanel(t('mock.title'),'<div class="wpos-stage" data-mock-stage></div>',{...PANEL,eyebrow:'EXAM FORM'});
  const box=panelNode('[data-mock-stage]');if(!box)return;
  const top=()=>{for(const node of [box.closest?.('#panel-content'),box.closest?.('dialog')])if(node)node.scrollTop=0;};
  box.innerHTML=view.renderMockIntro({plan,exam:which,mode:values.examMode||null});
  box.querySelector('[data-mock-intro]')?.focus?.({preventScroll:true});top();
  box.querySelector('[data-mock-start]')?.addEventListener('click',()=>{try{check();runMockNext({next,plan,sections,exam:which,mode:values.examMode||null,audioAvailable:values.audio!=='off',box,top});}catch(error){failed(error);}},{once:true});
  box.querySelector('[data-mock-later]')?.addEventListener('click',()=>{try{void openMyPosition();}catch(error){failed(error);}},{once:true});
  }finally{if(openMockNext.pending===ticket){openMockNext.pending=0;const skipped=openMockNext.skipped;openMockNext.skipped=false;if(skipped&&!settled&&!stopped)repaint();}}
 }
 // 새 길 시험 형식 연습 한 번(§21-23의 1): 겉(영역 · 이동 · 재생 · 답 · 영역 사이 · 끝 한 장)은 지금 판 runMock과 같고, 새 코치를 다룬다
 // (world-mock-next.mjs createMockNextSession). 판을 다시 정해 코치가 닫히면(DISPOSED · retired) 안내 한 줄과 함께 닫고 내 위치를 연다(진단 새 길과
 // 같다). 끝 한 장은 답이 다 저장된 뒤의 evidence로 그린다. 판은 끝까지 하면 판 기록(학습자 응답이 켜진 계정만 — 지금 판 finishSet과 같은 규칙)과
 // 함께, 그만두거나 판이 닫히면 기록 없이 닫는다 — 닫지 않으면 손님 요약이 그 판의 답으로 다시 접히지 않는다(진단 끝 판 F2). 기기 기록부(손님 ·
 // 동의를 끈 계정)는 접힌 뒤의 칸으로 끝 한 장을 그린다(진단 끝 판 F3).
 function runMockNext({next,plan,sections,exam,mode=null,audioAvailable=true,box,top}){
  const session=homePlanner.position.createMockNextSession({coach:next,sections,exam,plays:{allowedPlays:position.mock.allowedPlays,nextPlay:position.mock.nextPlay}});
  // finishing: 끝 한 장이 답 저장을 기다리는 중 · drawn: 끝 한 장을 그렸다(한 번만).
  let ended=false,finishing=false,drawn=false,notice='',ticker=null,confirm=false,unwatch=()=>{};
  const cell=()=>session.current;
  let finishedAt=null;
  const proxy={get current(){const now=cell();return now&&!now.between?{...now,heard:now.heard}:null;},replay:()=>session.play(),
   delivery:status=>{finishedAt=cell()?.sounding??null;return session.delivery(status);}};
  const player=soundPlayer({session:proxy,url:audioUrl,onChange:state=>{
   if(ended)return;if(session.disposed){closed();return;}
   const now=cell(),other=state!=='playing'&&Number.isInteger(finishedAt)&&!!now&&!now.between&&finishedAt!==now.index;
   notice=state!=='failed'?'':other?t('mock.failedOther',{n:finishedAt+1}):now?.heard?t('position.diagnostic.audioFailed'):'';
   paint(state==='playing'?'[data-mock-listen]':other?'.wpos-run-skill':state==='completed'?'.wpos-choice:not([disabled])':'[data-mock-listen]');}});
  const stopTick=()=>{if(ticker){clearInterval(ticker);ticker=null;}};
  // 판을 닫거나 다른 판이 열리면 판을 기록 없이 닫는다. 손님 요약이 그 답으로 다 접히면 열린 내 위치 판을 한 번 다시 그린다.
  const stop=()=>{unwatch();if(ended)return;ended=true;stopTick();player.silence();let set=null;try{set=session.stop();}catch{set=null;}queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});};
  // 코치가 닫혔다(판을 다시 정함) — 안내 한 줄과 함께 연습을 닫고 내 위치를 다시 연다(그 판으로).
  const closed=()=>{if(ended&&!finishing||drawn)return;finishing=false;stop();home.toast(t('practice.next.changed'));void openMyPosition();};
  home.attachPanelResource?.({dispose:stop});
  unwatch=atlasNext?.retired?.(next,closed)??(()=>{});
  // 이 기기의 판 기록(4-4d — §21-23의 3): 문항을 하나라도 낸 판은 그만두거나 판이 닫혀도 한 판으로 센다 — 연 문항은 제시와 「답하지 않음」 답으로
  // 남아 처음 보는 문항과 하루 새 단위 한도를 쓴다. 그래서 처음 낸 때 한 번 적는다(점검 칸의 시험 형식 줄이 이번 주에 다시 서지 않는다).
  let logged=false;
  const markPlan=()=>{if(logged||!session.presented)return;logged=true;try{homeNext?.planLog?.(next)?.record('mock',Date.now());}catch{/* 이 기기에서 세지 못할 뿐이다 */}};
  function paint(focus='.wpos-run-skill'){
   if(ended)return;
   if(session.disposed){closed();return;}
   markPlan();
   const now=session.current;
   if(!now||session.finished){void finish();return;}
   if(now.between){stopTick();player.silence();box.innerHTML=view.renderMockBetween({view:now,parts:session.parts});box.querySelector('[data-mock-between]')?.focus?.({preventScroll:true});top();return;}
   box.innerHTML=view.renderMockItem({view:now,playing:player.playing,notice,confirm,parts:session.parts});
   if(focus)box.querySelector(focus)?.focus?.({preventScroll:true});
  }
  // 시계: 남은 시간 칸만 1초마다 고치고, 시간이 다 되면 그 영역을 닫는다(session.current가 확인한다).
  function tick(){
   if(ended)return;
   if(session.disposed){closed();return;}
   const now=session.current;
   if(!now||now.between){paint();return;}
   const clock=box.querySelector('[data-mock-clock]');if(clock)clock.textContent=view.mockClock(now.remainingMs);
  }
  function startSection(){stopTick();notice='';confirm=false;session.start();ticker=setInterval(tick,1000);paint();top();}
  async function finish(){
   if(finishing||drawn||ended&&!box.isConnected)return;
   finishing=true;ended=true;stopTick();player.silence();
   try{await session.settled();}catch{/* 저장에 실패한 답은 혼자 맞힘이 아니다 */}
   // 저장을 기다리는 사이 판이 닫혔거나(패널을 닫음) 코치가 닫혔다 — 판 기록 없이 닫는다(닫힌 코치면 null). 끝내기가 판을 끝난 것으로 두어 판을 닫을
   // 때의 정리(stop)가 아무것도 하지 않으므로, 판만 닫혔으면 여기서 stop처럼 홈을 다시 그리고 요약이 그 판의 답으로 접히면 열린 내 위치 판을 다시
   // 그린다. 코치가 닫혔으면 closed가 내 위치를 이미 열었다(끝 판 검수 E1).
   if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}
   finishing=false;drawn=true;unwatch();
   // 기기 기록부는 판을 닫으면 요약이 그 판의 답으로 다시 접힌다 — 접힌 뒤의 칸으로 끝 한 장을 그린다. 기록부는 판을 닫기 전에 읽는다. 접기를 기다리는
   // 사이 판이 닫혔으면 끝 한 장은 그리지 않되, 끝낸 판이라 홈과 열린 내 위치 판은 그 답으로 다시 그린다(E1).
   let local=false;try{local=next.summary()?.storage?.guest===true;}catch{local=false;}
   let set=null;try{set=session.finish({record:answering()});}catch{set=null;}
   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});return;}}
   refresh();
   // 「다음 연습」은 그날 낼 것이 있는 짧은 연습만(world-mock-next.mjs todayPractice). 홈 코치로 센다 — 짧은 연습 풀의 은행은 홈 코치만 다 받는다(같은
   // 호스트라 만남과 하루 한도는 같다). 못 셈하면 잇지 않는다.
   let routes=new Map();try{routes=homePlanner.position.todayPractice({coach:homePhase()==='engine'?homeWatch?.coach?.()??null:null,pool:position.practice.pool,audioAvailable});}catch{routes=new Map();}
   const response=answering()&&set?.completionId?set:null;
   box.innerHTML=view.renderMockDone({results:session.results(),items:position.itemsById,plan,exam,mode,practice:id=>routes.get(id)||null,response:responseView(response,'mock')});
   bindPractice(box,routes);bindResponse({box,coachNow:next,set:response,kind:'mock'});
   box.querySelector('[data-mock-done]')?.focus?.({preventScroll:true});top();evidenced();
  }
  box.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||button.disabled)return;
   try{
    // 끝 한 장이 답 저장을 기다리는 동안(finishing)의 누름은 받지 않는다 — 그 사이 「그만두기」가 판을 기록 없이 먼저 닫아 끝까지 마친 판의 판
    // 기록과 응답 줄이 사라졌다(끝 판 F7 · 짧은 진단의 ended 막이와 같다). 끝 한 장의 단추(내 위치 · 홈)는 그린 뒤라 그대로 받는다.
    if(finishing)return;
    check();
    // 영역 안에서 답하거나 다른 번호로 옮겨도 듣던 소리는 끊지 않는다(지금 판과 같다). 소리는 영역이 끝날 때 · 그만둘 때만 멈춘다.
    if(button.dataset.mockChoice){confirm=false;session.answer(button.dataset.mockChoice);notice=t('position.diagnostic.saved');paint('[data-mock-status]');}
    else if(button.hasAttribute('data-mock-listen'))player.play();
    else if(button.dataset.mockGo){notice='';confirm=false;session.go(Number(button.dataset.mockGo));paint();}
    else if(button.hasAttribute('data-mock-submit')){
     const now=session.current,left=now&&!now.between?now.marks.filter(mark=>mark!=='answered').length:0;
     if(left&&!confirm){confirm=true;paint('[data-mock-confirm]');return;}
     player.silence();confirm=false;const after=session.finishSection();if(session.disposed)closed();else if(!after||session.finished)void finish();else paint();
    }
    else if(button.hasAttribute('data-mock-keep')){confirm=false;paint();}
    else if(button.hasAttribute('data-mock-next-section')){const now=session.current;if(now?.between&&now.started)session.finishSection();if(session.disposed)closed();else if(session.finished||!session.current)void finish();else startSection();}
    // 그만두기: 판을 기록 없이 닫고(남은 영역은 시작하지 않는다) 지금까지의 끝 한 장을 그린다(지금 판과 같은 화면 — 응답 줄은 없다).
    else if(button.hasAttribute('data-mock-stop')){player.silence();try{session.stop();}catch{}void finish();}
    else if(button.hasAttribute('data-mock-position'))void openMyPosition();
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
 // 새 길 홈이 확인 중이면(홈 코치 · 플래너가 서기 전) 홈 계획에 이번 주 계획이 실리지 않는다(world-today — 엔진 판일 때만). 그대로 읽으면 시험을 저장한
 // 학생을 「계획 없는 학생」으로 보고 목표 창을 열었다 — 주소의 ?exam= 바로가기, 알림의 「이번 주 연습」, 확인 중으로 돌아간 사이의 계획 단추(4-4b 끝 판
 // F1). 그래서 시험을 고른 학생이면 판이 설 때까지(엔진 · 지금 판) 한도 안에서 기다리고, 넘기면 목표 창 대신 「확인 중」이다.
 const examChosen=()=>{try{return Boolean(position?.exam?.examInfo?.(settingsFor(getProgress().learningProfileValues())));}catch{return false;}};
 // 판이 서거나(엔진 · 지금 판) 문서가 닫히면 기다림을 모두 깨운다 — 닫히면 판 상태가 지금 판이 되지만, 그 규칙에 기대지 않고 닫힘을 먼저 본다(4-4b 다시 검수 A1).
 function wakePlanWaits(){if(!stopped&&homePhase()==='checking')return;for(const done of [...planWaits])done();}
 function settledHome(){
  if(homePhase()!=='checking')return Promise.resolve();
  return new Promise(resolve=>{let timer=null;const done=()=>{watchClock.clear(timer);planWaits.delete(done);resolve();};planWaits.add(done);timer=watchClock.set(done,PLAN_WAIT_MS);timer?.unref?.();});
 }
 async function openPlan({keepScroll=false,quiet=false}={}){
  if(keepScroll&&(openPosition.pending||heldMock()))return 'skipped';
  check();const ticket=++planOpen;
  if(!keepScroll){try{await prepare();}catch{/* the plan shows what this device has */}check();try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still counts */}check();
   // 기다린 사이 학생이 다른 판을 열었으면 덮지 않는다 — 기다림이 8초까지 길어서 학생이 누른 열기도 본다(4-4b 다시 검수 FA2).
   if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}
  if(ticket!==planOpen||quiet&&home.openPanel?.())return 'skipped';
  const plan=refresh(),examPlan=plan?.examPlan;
  // 한도를 넘겨도 확인 중이면 계획이 없는 것이 아니라 아직 모르는 것이다 — 목표 창을 열지 않는다(학생이 누른 열기에만 한 줄 알린다).
  if(!examPlan&&homePhase()==='checking'&&examChosen()){if(!keepScroll&&!quiet)home.toast(t('home.today.checking'));return 'skipped';}
  if(!examPlan||!view){if(!keepScroll&&!quiet)open();return 'missing';}
  const scroller=keepScroll?panelNode('[data-plan-board]')?.closest?.('#panel-content'):null,scrollTop=scroller?.scrollTop||0,focusKey=keepScroll?nextFocusOf(panelNode('[data-plan-board]'),PLAN_FOCUS):null;
  home.showPanel(t('plan.week.title'),view.renderExamPlan({plan:examPlan,next:plan.selected,reason:tMessage(plan.reason||''),count:practiceLength()}),{type:'life-position',eyebrow:'MY WEEK',nav:'packs'});heard.panel=false;
  const root=panelNode('[data-plan-board]');if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}else root?.focus?.({preventScroll:true});
  root?.querySelector('[data-plan-next]')?.addEventListener('click',()=>{try{check();if(plan.selected)void Promise.resolve(launch(plan.selected)).catch(failed);}catch(error){failed(error);}});
  root?.querySelectorAll('[data-plan-practice]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(startPractice(button.dataset.planPractice)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelectorAll('[data-plan-game]').forEach(button=>button.addEventListener('click',()=>{try{check();void Promise.resolve(launchGame(button.dataset.planGame)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelector('[data-plan-recheck]')?.addEventListener('click',()=>{try{check();void openMyPosition({start:true});}catch(error){failed(error);}});
  root?.querySelectorAll('[data-plan-writing]').forEach(button=>button.addEventListener('click',()=>{try{check();if(typeof writingPractice?.open==='function')void Promise.resolve(writingPractice.open(button.dataset.planWriting)).catch(failed);}catch(error){failed(error);}}));
  root?.querySelector('[data-plan-mock]')?.addEventListener('click',()=>{try{check();void Promise.resolve(openMock()).catch(failed);}catch(error){failed(error);}});
  // 말하기 칸의 「말하기 연습 열기」: 유형 목록을 연다(어느 유형을 할지는 학생이 고른다 — 「지금 할 것」은 아직 안 해 본 유형을 바로 연다).
  root?.querySelector('[data-plan-speaking]')?.addEventListener('click',()=>{try{check();if(typeof speakingPractice?.open==='function')void Promise.resolve(speakingPractice.open('speaking')).catch(failed);}catch(error){failed(error);}});
  return 'shown';
 }
 // 새 길 홈의 플래너 · 감시(§20-4) — 입구가 엔진을 받아야 선다. 홈 코치는 짧은 연습 문항 풀 전체의 은행으로 연다(학생의 수준으로 거르기 전 — 설계 검토 H24).
 // 공개 TOPIK 은행은 짧은 연습을 열 때처럼 잠깐 기다린다(bankReady). 그래도 은행 없이 열었으면 은행이 온 뒤 한 번 다시 연다(loadBank → reopen) —
 // 은행 없이 연 코치는 그 은행 문항의 단위를 몰라 짧은 연습 줄이 그 문서에서 끝까지 서지 않는다(엔진급 끝 판 F2).
 async function openHome(){
  try{await bankReady();}catch{/* 은행 없이 열고, 오면 다시 연다 */}
  homeBare=Boolean(position?.topik)&&!position.topik.ready;
  return homeNext.coach(position?.practice?.pool||[]);
 }
 // 판 감시가 알리면(코치가 섬 · 판이 다시 정해짐 · 요약이 자리를 잡음) 홈과 열린 새 길 「내 위치」 판을 다시 그린다(21-2). 플래너를 받거나 못 받아도 같다.
 if(homeNext)Promise.resolve().then(()=>homeNext.planner()).then(planner=>{
  if(stopped)return;
  if(!planner){homeFailed=true;refresh();redrawNext();readWaitingResponses();return;}
  homePlanner=planner;
  homeWatch=planner.watchHomePlan({open:openHome,retired:(made,fn)=>homeNext.retired(made,fn),lifeState:()=>homeNext.life(),onChange:()=>{if(!stopped){refresh();redrawNext();readWaitingResponses();}}});
  refresh();redrawNext();
 },()=>{if(stopped)return;homeFailed=true;refresh();redrawNext();readWaitingResponses();});
 const onFocus=()=>refresh();target.addEventListener?.('focus',onFocus);
 // 배우기 판의 「이번 주 계획」 줄(life-ui.mjs moreRows): 시험을 고른 사람에게만. print는 그 판의 인화지 그림.
 function planRow(print=()=>''){
  const plan=current?.examPlan;if(!plan)return '';
  const done=(plan.areas||[]).reduce((n,row)=>n+Math.min(row.done,row.planned),0),total=(plan.areas||[]).reduce((n,row)=>n+row.planned,0);
  return `<button class="life-row" data-view="plan">${print('goals','life-row-print')}<span class="life-row-copy"><strong>${t('plan.week.title')}</strong><small>${escape(t('plan.week.row',{done,total}))}</small></span></button>`;
 }
 // 이번 주 계획의 시험(배우기 판이 TOPIK II 학생의 쓰기 연습 줄을 위로 올릴 때 읽는다). 시험 계획이 없으면 null.
 const examType=()=>current?.examPlan?.exam?.type||null;
 // 생활 화면의 거울(life-ui.mjs learning): 코치를 읽고, 레슨 · 복습을 열 때 계정 통로를 준비한다(「다음 할 일」과 같은 prepare).
 // 생활 화면(life-ui.mjs)의 learning 인자 한 벌 — 코치 · 준비 · 거울 부품(engine.life). 셸은 생활 화면을 먼저 세워 늦게 읽는다(app-shell · life-standalone-entry).
 const lifeLearning=Object.freeze({coach:()=>{try{return readLifeCoach();}catch{return null;}},prepare:()=>{try{check();return Promise.resolve(prepare()).catch(()=>{});}catch{return Promise.resolve();}},life:engine.life||null});
 return {next,open,examLink,refresh,repaint,applyPreferences,planRow,examType,positionTotal:topikTotal,responses:responseList,removeResponse,readResponses,me:meNow,meReady,tellMe,undoMe,clearPractice,lifeLearning,...(position?{position:openMyPosition,practice:startPractice,plan:openPlan,mock:openMock,mockReady,townCheck,townEvidence}:{}),presentation(){check();const values=settingsFor(getProgress().learningProfileValues());return Object.fromEntries(['support','explanation'].filter(k=>values[k]).map(k=>[k,values[k]]));},metrics:()=>({owner,plan:current}),today:()=>current?.today?{...current.today,selected:current.selected,selectedKind:current.selectedKind,reason:current.reason}:null,dispose(){stopped=true;wakePlanWaits();readWaitingResponses();responseCoachOff?.();stopHearing();homeWatch?.dispose();release(coach);release(practiceCoach);release(mockCoach);release(lifeCoachNow);target.removeEventListener?.('focus',onFocus);}};
}
