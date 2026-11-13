import {CAFE_COMPOSE_ID,CAFE_LESSON_IDS,isCafeLesson,isCafeCheckpoint,isCafeOrder,isCafeListen} from './cafe-activity.mjs';
import {readWorldLearningProfile,updateWorldLearningProfile,clearWorldLearningProfile,worldLearningProfileValues} from './world-learning-profile.mjs';
import {readArrival} from './seoul-record.mjs';
// One bounded record owns the life-Korean curriculum. The official PlayHost can
// supply its storage port; guest/device records remain in their owner's namespace.
export const LIFE_PROGRESS_KEY='synk.life-korean.progress.v1';
export const LIFE_PROGRESS_VERSION=1;
const MINUTE=60000,DAY=86400000,INTERVALS=[1,3,7,14,30],HELP_FRESH=30*MINUTE;
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message)=>Object.assign(new Error(message||code),{code});
const safeId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const time=value=>Number.isSafeInteger(value)&&value>=0;
const empty=owner=>({version:LIFE_PROGRESS_VERSION,owner,revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{}});
const TUTORS=new Set(['marin','kkamong','mongle']),OUTCOMES=new Set(['independent','assisted','retry']),DISPLAY_LANGS=new Set(['en','mn','ko']);
// 첫 실행의 「한글을 읽을 수 있어요?」 답(10-19). 능력 판정이 아니라 고른 출발점이고, 한글 만나기를 마치거나 건너뛰면 바뀐다.
const HANGUL_ANSWERS=new Set(['new','reads']),HANGUL_VIA=new Set(['question','graduation','skip','unskip']);
const dailyId=value=>safeId(value)&&!['constructor','prototype'].includes(value);
const DAILY_MAX_TIME=253402268399999;
const dailyTime=value=>time(value)&&value<=DAILY_MAX_TIME;
// The learning day stays the same across browser/device time zones.
export function lifeDayKey(at){if(!dailyTime(at))throw TypeError('Invalid learning time');return new Date(at+9*3600000).toISOString().slice(0,10);}
const dailyLatest=item=>Math.max(item.observedAt??0,item.guidedAt??0);
function trimDaily(daily){
 const keys=Object.keys(daily.days).sort();for(const key of keys.slice(0,-30))delete daily.days[key];
 for(const day of Object.values(daily.days)){
  const ids=Object.keys(day.items).sort((a,b)=>dailyLatest(day.items[b])-dailyLatest(day.items[a])||(a<b?-1:a>b?1:0));
  for(const id of ids.slice(100))delete day.items[id];
 }
}
const RECORD_FIT_BYTES=480000;
function fitDailyRecord(value){
 if(!value.daily)return;
 // Preserve the original answer/checkpoint payload and stay below both the
 // reader's 500k character limit and the account port's 512 KiB value limit.
 const bytes=()=>new TextEncoder().encode(JSON.stringify(value)).length;
 while(bytes()>RECORD_FIT_BYTES){
  const oldest=Object.keys(value.daily.days).sort()[0];if(!oldest)break;
  delete value.daily.days[oldest];
 }
}
function validateDaily(daily){
 const invalid=()=>{throw fail('LIFE_PROGRESS_UNREADABLE');};
 if(!object(daily)||daily.version!==1||!object(daily.days)||Object.keys(daily).some(key=>!['version','days'].includes(key))||Object.keys(daily.days).length>30)invalid();
 for(const [key,day]of Object.entries(daily.days)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!object(day)||Object.keys(day).some(key=>!['items','closedAt'].includes(key))||!object(day.items)||!Object.keys(day.items).length||Object.keys(day.items).length>100)invalid();
  const sameDay=at=>dailyTime(at)&&lifeDayKey(at)===key;
  if(day.closedAt!==undefined&&!sameDay(day.closedAt))invalid();
  for(const [id,item]of Object.entries(day.items)){
   if(!dailyId(id)||!object(item)||Object.keys(item).some(key=>!['lessonId','observedAt','outcome','guidedAt','tutorId'].includes(key))||!dailyId(item.lessonId))invalid();
   if(item.observedAt===undefined?item.outcome!==undefined:item.outcome===undefined||!sameDay(item.observedAt)||!OUTCOMES.has(item.outcome))invalid();
   if(item.guidedAt===undefined?item.tutorId!==undefined:!sameDay(item.guidedAt)||!TUTORS.has(item.tutorId))invalid();
   if(item.observedAt===undefined&&item.guidedAt===undefined)invalid();
  }
 }
}
function dailyObservation(next,{questionId,lessonId,at,correct,helped},migrating=false){
 if(!dailyTime(at)||!dailyId(questionId)||!dailyId(lessonId))return;
 const dayKey=lifeDayKey(at),daily=next.daily??={version:1,days:{}},day=daily.days[dayKey]??={items:{}},old=day.items[questionId];
 if(migrating&&old?.observedAt>=at)return;
 const observedAt=migrating?at:dailyEventTime(day,old,at);
 day.items[questionId]={...old,lessonId,observedAt,outcome:correct?(helped?'assisted':'independent'):'retry'};trimDaily(daily);
}
function dailyEventTime(day,item,at){
 const end=Date.parse(lifeDayKey(at)+'T23:59:59.999+09:00');
 const value=Math.min(end,Math.max(at,dailyLatest(item||{})+1,(day.closedAt??-1)+1));
 // At the day's last millisecond there is no later representable time.
 if(day.closedAt!==undefined&&value<=day.closedAt)delete day.closedAt;
 return value;
}
function backfillDaily(value){
 if(value.daily!==undefined)return;
 // Only surviving first-answer evidence can be recovered. Past guided practice
 // and replaced review sessions were never recorded and must not be invented.
 for(const [lessonId,lesson]of Object.entries(value.lessons))for(const [questionId,answer]of Object.entries(lesson.answers))dailyObservation(value,{lessonId,questionId,...answer},true);
 for(const [reviewId,answer]of Object.entries(value.activeReview?.answers||{})){
  const review=value.reviews[reviewId];if(review)dailyObservation(value,{lessonId:review.lessonId,questionId:review.questionId,...answer},true);
 }
 fitDailyRecord(value);
}

function validate(raw,owner){
 if(typeof raw!=='string'||raw.length>500000)throw fail('LIFE_PROGRESS_UNREADABLE');
 let value;try{value=JSON.parse(raw);}catch{throw fail('LIFE_PROGRESS_UNREADABLE');}
 if(!object(value)||value.version!==1||value.owner!==owner||!time(value.revision)||!object(value.lessons)||!object(value.reviews)||Object.keys(value.lessons).length>100||Object.keys(value.reviews).length>400)throw fail('LIFE_PROGRESS_UNREADABLE');
 if(value.activeLessonId!==null&&!safeId(value.activeLessonId))throw fail('LIFE_PROGRESS_UNREADABLE');
 for(const [id,lesson]of Object.entries(value.lessons)){
  if(!safeId(id)||!object(lesson)||!safeId(lesson.attemptId)||!time(lesson.startedAt)||lesson.completedAt!==null&&!time(lesson.completedAt)||!object(lesson.answers)||Object.keys(lesson.answers).length>100||!Array.isArray(lesson.questionIds)||lesson.questionIds.length>100||!lesson.questionIds.every(safeId)||new Set(lesson.questionIds).size!==lesson.questionIds.length)throw fail('LIFE_PROGRESS_UNREADABLE');
  if(lesson.questionIds.some(id=>!safeId(id))||Object.keys(lesson.answers).some(id=>!lesson.questionIds.includes(id)))throw fail('LIFE_PROGRESS_UNREADABLE');
  for(const [qid,answer]of Object.entries(lesson.answers))if(!object(answer)||typeof answer.correct!=='boolean'||typeof answer.helped!=='boolean'||!time(answer.at)||answer.choiceId!==null&&!safeId(answer.choiceId)||answer.helpSource!==undefined&&(answer.helpSource!=='setting'||answer.helped!==true)||answer.order!==undefined&&(id!==CAFE_COMPOSE_ID||qid!=='cafe-compose-order'||!isCafeOrder(answer.order,{complete:true}))||answer.input!==undefined&&(!isCafeLesson(id)||!isCafeListen(answer.input)))throw fail('LIFE_PROGRESS_UNREADABLE');
  if(lesson.stage!==undefined&&(!object(lesson.stage)||!['intro','story','questions'].includes(lesson.stage.phase)||!time(lesson.stage.sceneIndex)||!time(lesson.stage.questionIndex)||lesson.stage.sceneIndex>100||lesson.stage.questionIndex>100||lesson.stage.helped!==undefined&&typeof lesson.stage.helped!=='boolean'||lesson.stage.helpSource!==undefined&&(lesson.stage.helpSource!=='setting'||lesson.stage.helped!==true)))throw fail('LIFE_PROGRESS_UNREADABLE');
  if(lesson.stage?.cafe!==undefined&&(!isCafeLesson(id)||lesson.stage.phase!=='questions'||!isCafeCheckpoint(lesson.stage.cafe,id)||lesson.stage.questionIndex!==lesson.stage.cafe.step||lesson.stage.sceneIndex!==lesson.stage.cafe.step||lesson.stage.cafe.phase==='complete'&&lesson.questionIds.some(qid=>!lesson.answers[qid])))throw fail('LIFE_PROGRESS_UNREADABLE');
 }
 for(const [id,review]of Object.entries(value.reviews)){
  if(!safeId(id)||!object(review)||review.id!==id||!safeId(review.questionId)||!safeId(review.lessonId)||!safeId(review.packId)||!safeId(review.skillId)||!time(review.dueAt)||!time(review.lastAt)||!time(review.streak)||review.streak>1000||!time(review.lapses)||!time(review.intervalDays)||review.intervalDays>30)throw fail('LIFE_PROGRESS_UNREADABLE');
 }
 if(value.activeReview!==null){const run=value.activeReview;
  if(!object(run)||!safeId(run.id)||!time(run.startedAt)||!Array.isArray(run.ids)||run.ids.length>100||!run.ids.every(id=>safeId(id)&&value.reviews[id])||!object(run.answers)||Object.keys(run.answers).some(id=>!run.ids.includes(id)))throw fail('LIFE_PROGRESS_UNREADABLE');
  for(const answer of Object.values(run.answers))if(!object(answer)||typeof answer.correct!=='boolean'||typeof answer.helped!=='boolean'||!time(answer.at))throw fail('LIFE_PROGRESS_UNREADABLE');
  if(run.pendingHelp!==undefined&&(!object(run.pendingHelp)||Object.entries(run.pendingHelp).some(([id,value])=>!run.ids.includes(id)||value!==true)))throw fail('LIFE_PROGRESS_UNREADABLE');
 }
 if(value.daily!==undefined)validateDaily(value.daily);
 if(value.tutor!==undefined&&(!object(value.tutor)||value.tutor.version!==1||!TUTORS.has(value.tutor.selected)||Object.keys(value.tutor).some(key=>!['version','selected'].includes(key))))throw fail('LIFE_PROGRESS_UNREADABLE');
 if(value.hangul!==undefined&&(!object(value.hangul)||value.hangul.version!==1||!HANGUL_ANSWERS.has(value.hangul.answer)||!time(value.hangul.at)||!HANGUL_VIA.has(value.hangul.via)||Object.keys(value.hangul).some(key=>!['version','answer','at','via'].includes(key))))throw fail('LIFE_PROGRESS_UNREADABLE');
 return value;
}

export function createLifeProgress({storage=globalThis.localStorage,owner='guest',now=Date.now,uuid=()=>crypto.randomUUID(),onChange=()=>{},guard=()=>{},mode='local',scoped=mode==='account',save=null,getSaveStatus=null}={}){
 if(typeof owner!=='string'||!owner||owner.length>200)throw TypeError('Life progress owner required');
 const key=scoped?LIFE_PROGRESS_KEY:`${LIFE_PROGRESS_KEY}:${encodeURIComponent(owner)}`;
 let state=empty(owner),stopped=false,readError=null,writeError=null,saving=null;
 const lessons=new Map(),questions=new Map();
 const check=()=>{guard();if(stopped)throw fail('ACCOUNT_CHANGED','로그인이 끝나 생활 한국어 진도를 저장할 수 없어요.');};
 try{const raw=storage.getItem(key);if(raw!==null){state=validate(raw,owner);backfillDaily(state);}}catch(error){readError=error?.code?error:fail('LIFE_PROGRESS_UNREADABLE','이 기기의 진도를 확인하지 못했어요. 기존 기록은 보존했어요.');}
 function status(){
  let transport=null;try{transport=getSaveStatus?.();}catch{}
  const phase=readError?'unreadable':writeError?'unsaved':scoped?(transport?.rejected?'unsaved':transport?.phase||'saving'):'device';
  return {owner,phase,scoped,saved:phase==='device'||phase==='synced',pending:transport?.pending||0,rejected:transport?.rejected||0,code:readError?.code||writeError?.code||transport?.code,
   message:readError?'기존 진도를 읽지 못했어요. 원본 기록은 보존했어요.':writeError?'진도를 저장하지 못했어요. 화면의 진행은 유지하고 있어요.':scoped?(transport?.message||'계정에 생활 한국어 진도를 저장하고 있어요.'):'이 기기에 저장돼요.'};
 }
 const emit=()=>{try{onChange(api);}catch{/* Views cannot change ownership. */}};
 function checkDailyWrite(){
  check();if(readError)throw readError;
  const value=status();let transport;try{transport=getSaveStatus?.();}catch{}
  if(transport?.phase)value.phase=transport.phase;
  if(value.rejected)throw fail('LIFE_PROGRESS_REJECTED','저장하지 못한 진도가 있어요. 이어 갈 기록을 먼저 골라 주세요.');
  if(value.phase==='loading')throw fail('LIFE_PROGRESS_LOADING','진도를 불러오고 있어요.');
  if(value.phase==='conflict')throw fail('REVISION_CONFLICT','진도가 두 곳에서 달라요. 이어 갈 기록을 먼저 골라 주세요.');
  if(value.phase==='unreadable')throw fail('LIFE_PROGRESS_UNREADABLE','기존 진도를 읽지 못해 지금은 저장할 수 없어요. 잠시 뒤 다시 열어 주세요.');
  if(value.phase==='stopped')throw fail('ACCOUNT_CHANGED','로그인이 끝나 생활 한국어 진도를 저장할 수 없어요.');
 }
 function commit(next,{preserveDaily=false}={}){
  check();if(readError)throw fail('LIFE_PROGRESS_UNREADABLE','기존 진도를 확인하지 못했어요. 원본을 덮어쓰지 않았어요.');
  next.revision=state.revision+1;
  if(!preserveDaily)fitDailyRecord(next);
  const raw=JSON.stringify(next);
  if(preserveDaily&&(raw.length>500000||new TextEncoder().encode(raw).length>512*1024))throw fail('PLAY_DATA_TOO_LARGE','튜터 선택을 저장할 공간이 부족해요. 기존 학습 기록은 보존했어요.');
  try{storage.setItem(key,raw);writeError=null;state=next;}
  catch(error){
   // A conflict must retain the host's two alternatives. Device/quota failures
   // keep this view's draft available for an explicit retry/export.
   if(['REVISION_CONFLICT','ACCOUNT_CHANGED','PLAY_SESSION_ENDED'].includes(error.code))throw error;
   state=next;writeError=error?.code?error:fail('LIFE_STORAGE_UNAVAILABLE');
  }
  emit();return status();
 }
 function register(lesson){
  if(!object(lesson)||!safeId(lesson.id)||!safeId(lesson.packId)||!Array.isArray(lesson.questions)||!lesson.questions.length)throw TypeError('Life lesson required');
  if(lesson.questions.some(q=>!safeId(q.id)||!safeId(q.skillId)||!safeId(q.review?.id)))throw TypeError('Stable question and review ids required');
  lessons.set(lesson.id,lesson);for(const question of lesson.questions)questions.set(question.id,{...question,lessonId:lesson.id,packId:lesson.packId});return lesson;
 }
 function catalog(packs=[],flat=[]){
  for(const lesson of flat)register(lesson);
  for(const pack of packs)for(const lesson of pack.lessons||[])if(object(lesson))register({...lesson,packId:lesson.packId||pack.id});
 }
 function lessonState(id){
  check();const saved=state.lessons[id],lesson=lessons.get(id),ids=lesson?.questions.map(q=>q.id)||saved?.questionIds||[];
  const cursor=ids.findIndex(qid=>!saved?.answers[qid]);
  const position=cursor<0?ids.length:cursor,stage=clone(saved?.stage||{phase:'intro',sceneIndex:0,questionIndex:0,helped:false});
  if(!stage.cafe&&stage.phase==='questions'&&stage.questionIndex!==position){stage.helped=false;delete stage.helpSource;}
  return {id,status:!saved?'new':saved.completedAt!==null?'completed':'started',cursor:position,total:ids.length,answers:clone(saved?.answers||{}),stage,attemptId:saved?.attemptId||null,completedAt:saved?.completedAt??null};
 }
 function startLesson(value,{replay=false}={}){
  check();const lesson=object(value)?register(value):lessons.get(value);if(!lesson)throw TypeError('Unknown life lesson');
  const previous=state.lessons[lesson.id];
  if(!previous||replay){const next=clone(state);next.lessons[lesson.id]={attemptId:uuid(),startedAt:now(),completedAt:previous?.completedAt??null,stage:{phase:'intro',sceneIndex:0,questionIndex:0},questionIds:lesson.questions.map(q=>q.id),answers:{}};next.activeLessonId=lesson.id;commit(next);}
  else if(state.activeLessonId!==lesson.id){const next=clone(state);next.activeLessonId=lesson.id;commit(next);}
  return lessonState(lesson.id);
 }
 function stageValue(id,run,{phase,sceneIndex=0,questionIndex=0,helped=false,helpSource,cafe}={}){
  if(!run||!['intro','story','questions'].includes(phase)||!time(sceneIndex)||!time(questionIndex)||sceneIndex>100||questionIndex>run.questionIds.length||typeof helped!=='boolean'||helpSource!==undefined&&helpSource!==null&&!['setting','user'].includes(helpSource))throw TypeError('Invalid lesson stage');
  if(cafe!==undefined&&(!isCafeLesson(id)||phase!=='questions'||!isCafeCheckpoint(cafe,id)||questionIndex!==cafe.step||sceneIndex!==cafe.step||cafe.phase==='complete'&&run.questionIds.some(qid=>!run.answers[qid])))throw TypeError('Invalid cafe stage');
  // Only help the 「한 단계씩」 setting opened on its own is marked; a missing source means the person asked.
  return {phase,sceneIndex,questionIndex,helped,...(helped&&helpSource==='setting'?{helpSource:'setting'}:{}),...(cafe!==undefined?{cafe:clone(cafe)}:{})};
 }
 function setStage(id,value={}){
  check();const next=clone(state);next.lessons[id].stage=stageValue(id,next.lessons[id],value);commit(next);return lessonState(id);
 }
 function recordAnswer({lessonId,questionId,question,correct,helped=false,helpSource,choiceId=null,stage,order,input}={}){
  check();if(question)questionId=question.id;
  const run=state.lessons[lessonId],q=questions.get(questionId)||question;
  if(!run||!q||!safeId(q.skillId)||!safeId(q.review?.id)||!run.questionIds.includes(questionId)||q.lessonId&&q.lessonId!==lessonId||typeof correct!=='boolean'||typeof helped!=='boolean'||helpSource!==undefined&&helpSource!==null&&!['setting','user'].includes(helpSource)||choiceId!==null&&!safeId(choiceId))throw TypeError('Invalid life answer');
  if(order!==undefined&&(lessonId!==CAFE_COMPOSE_ID||questionId!=='cafe-compose-order'||!isCafeOrder(order,{complete:true}))||input!==undefined&&(!isCafeLesson(lessonId)||!isCafeListen(input)||input.mode==='listen'&&!input.heard&&!input.textShown))throw TypeError('Invalid cafe response');
  if(run.answers[questionId])return {...lessonState(lessonId),duplicate:true};
  const staged=run.stage?.phase==='questions'&&run.stage?.questionIndex===run.questionIds.indexOf(questionId)&&run.stage?.helped===true;
  helped=helped||input?.mode==='listen'&&input.textShown||staged;
  // Help stays in the record either way (honest evidence). Help the 「한 단계씩」 setting opened by itself
  // is not a difficulty, so it no longer pulls the review back to a minute; help the person asked for still does.
  // Without a stated source, the saved stage's source decides, and unknown help counts as asked.
  const source=!helped?null:helpSource==='setting'||helpSource==null&&staged&&run.stage.helpSource==='setting'?'setting':'user';
  const at=now(),next=clone(state),id=q.review.id,old=next.reviews[id];
  next.lessons[lessonId].answers[questionId]={correct,helped,choiceId,at,...(source==='setting'?{helpSource:'setting'}:{}),...(order!==undefined?{order:clone(order)}:{}),...(input!==undefined?{input:clone(input)}:{})};
  // The first response and its physical cafe state share one storage write.
  if(stage!==undefined)next.lessons[lessonId].stage=stageValue(lessonId,next.lessons[lessonId],stage);
  const difficult=!correct||helped&&source!=='setting';
  // Lesson replay cannot reschedule a transfer review. A new difficult answer
  // may only pull its appointment forward; spacing grows in answerReview alone.
  const dueAt=old?(difficult?Math.min(old.dueAt,at+MINUTE):old.dueAt):at+(difficult?MINUTE:DAY);
  next.reviews[id]={id,questionId,lessonId,packId:q.packId||lessons.get(lessonId)?.packId,skillId:q.skillId,dueAt,lastAt:at,
   streak:difficult?0:old?.streak??0,lapses:(old?.lapses||0)+(difficult?1:0),intervalDays:difficult?0:old?.intervalDays??1};
  dailyObservation(next,{questionId,lessonId,at,correct,helped});
  commit(next);return {...lessonState(lessonId),duplicate:false};
 }
 function finishLesson(id){
  check();const run=state.lessons[id];if(!run)throw TypeError('Unknown started lesson');
  if(run.questionIds.some(qid=>!run.answers[qid]))throw fail('LIFE_LESSON_INCOMPLETE','아직 남은 문제가 있어요.');
  if(run.stage?.cafe&&run.stage.cafe.phase!=='complete')throw fail('LIFE_CAFE_NOT_RECEIVED','아직 음료를 받지 않았어요. 컵을 받고 이어가 주세요.');
  const duplicate=run.completedAt!==null,next=clone(state);
  if(!duplicate)next.lessons[id].completedAt=now();
  if(next.activeLessonId===id)next.activeLessonId=null;
  if(!duplicate||state.activeLessonId===id)commit(next);
  return {id,completed:true,duplicate,completedAt:next.lessons[id].completedAt,totalCompleted:Object.values(state.lessons).filter(v=>v.completedAt!==null).length};
 }
 // 새 길(atlasNext)의 「돌아온 복습」 판정(단계 4 §19-1 ⑤ — world-life-next.mjs lifeDue). 넣은 것이 없으면 null — 지금 판(dueAt 간격표) 그대로.
 // 판정은 { state:'checking' }(코치가 아직 없거나 보기가 얹지 못함 — 수 · 날짜를 그리지 않는다) 또는 { state:'engine', ids, nextAt, times, upcoming }.
 let dueSource=null;
 // 판정이 null이면 지금 판(이 문서는 지금 판으로 정해짐 · 판정을 거둠), 던지거나 엔진 꼴이 아니면 확인 중.
 function judged(){if(!dueSource)return null;let value;try{value=dueSource(state,now());}catch{value=undefined;}if(value===null)return null;if(value?.state==='engine'&&Array.isArray(value.ids))return {...value,ids:value.ids.filter(id=>state.reviews[id])};return {state:'checking',ids:[],nextAt:null,times:[],upcoming:[]};}
 // given: 이미 잰 판정(summary — 한 요약 안에서 판정을 한 번만 잰다, 두 번 재면 그 사이 경계 · 상태가 바뀌어 수와 목록이 갈렸다, 카본 합친 끝 판 B4).
 function dueReviews(limit=100,horizon=now(),given=undefined){check();const engine=given===undefined?judged():given;if(engine)return engine.ids.slice(0,Math.max(0,Math.min(100,limit))).map(id=>clone(state.reviews[id]));return Object.values(state.reviews).filter(v=>v.dueAt<=horizon).sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id)).slice(0,Math.max(0,Math.min(100,limit))).map(clone);}
 // 복습 판의 도움 표시(pendingHelp)가 지금 답의 도움인가. 판정이 없거나 null이면 표시가 있으면 도움이다(4-2 앞). 새 길은 표시마다 든 때(pendingHelpAt)가
 // 같은 학습일이거나 30분 안일 때만 도움이고, 때가 없는 표시(판정 없이 단 것)는 도움으로 친다 — 판의 날 하나로 가르면 하던 판을 버리거나 오늘 본
 // 도움을 지웠다(Fable 5.2 합친 끝 판 F3 → GPT GA1 → Fable 확인 검수, 같은 자리 세 회차 뒤 설계를 다시).
 const freshHelp=(marked,at)=>dailyTime(marked)&&dailyTime(at)&&(lifeDayKey(marked)===lifeDayKey(at)||Math.abs(at-marked)<=HELP_FRESH);
 const helpTimes=run=>{const value=run?.pendingHelpAt;return value&&typeof value==='object'&&!Array.isArray(value)?value:null;};
 function helpNow(run,id,at=now(),engine=judged()){if(run?.pendingHelp?.[id]!==true)return false;if(!engine)return true;const marked=helpTimes(run)?.[id];return !dailyTime(marked)||freshHelp(marked,at);}
 // 첫 남은 복습의 도움 표시가 지금 도움이 아니다(앞선 때의 표시) — 홈 튜터가 「오늘은 네가 먼저」를 고를 때 읽는다.
 function helpExpired(run,engine){const first=run?.ids.find(id=>!run.answers[id]);return !!first&&run.pendingHelp?.[first]===true&&!helpNow(run,first,now(),engine);}
 function reviewHelped(id){check();const run=state.activeReview;return !!run&&run.ids.includes(id)&&helpNow(run,id);}
 // soon: a lesson result may open its just-missed expressions in a new scene right away. Those are
 // due at most a minute after the answer, so only reviews coming due within that minute are added.
 // ids(새 길): 고른 복습을 그대로 연다 — 간격 거르기를 건너뛴다(튜터 「이 표현 같이 연습」 · 레슨 결과의 「새 장면으로 다시 보기」).
 function startReview(limit=6,preferredId=null,allowedIds=null,{soon=false,ids:chosen=null}={}){
  check();const existing=state.activeReview;
  if(existing&&existing.ids.some(id=>!existing.answers[id]))return clone(existing);
  if(allowedIds!==null&&(!Array.isArray(allowedIds)||allowedIds.length>100||new Set(allowedIds).size!==allowedIds.length||allowedIds.some(id=>!safeId(id)||!state.reviews[id])))throw TypeError('Invalid review selection');
  if(chosen!==null&&(!Array.isArray(chosen)||!chosen.length||chosen.length>100||new Set(chosen).size!==chosen.length||chosen.some(id=>!safeId(id)||!state.reviews[id])))throw TypeError('Invalid review selection');
  if(soon&&allowedIds===null&&chosen===null)throw TypeError('An early review needs its expressions');
  const engine=chosen===null?judged():null;
  const due=chosen!==null?chosen.map(id=>clone(state.reviews[id])):engine?(soon&&allowedIds!==null?allowedIds.map(id=>clone(state.reviews[id])):dueReviews(100).filter(row=>allowedIds===null||allowedIds.includes(row.id))):dueReviews(100,now()+(soon?MINUTE:0)).filter(row=>allowedIds===null||allowedIds.includes(row.id));if(preferredId){const index=due.findIndex(r=>r.id===preferredId);if(index>0)due.unshift(...due.splice(index,1));}
  const next=clone(state),ids=due.slice(0,Math.max(0,Math.min(100,limit))).map(v=>v.id);if(!ids.length)return null;
  next.activeReview={id:uuid(),startedAt:now(),ids,answers:{},pendingHelp:{}};commit(next);return clone(next.activeReview);
 }
 // seenAt: 화면이 그 표현을 보여 준 때(life-ui exposedTransfers). 도움 표시는 판정이 있을 때(새 길)만 표시마다 때를 든다(pendingHelpAt — 판의 startedAt은 그대로).
 // · 판정이 없거나 null(지금 판): 표시가 있으면 도움이다(4-2 앞). 새 길을 거쳐 때가 든 표시를 다시 보면 그 때를 걷어 「때 없는 표시 = 도움」으로 되돌린다 —
 //   새 길 → 지금 판 → 새 길로 오가면 오늘 본 도움이 앞선 때로 읽혔다(Fable 5.2 다시 지음 다시 검수 F1 · GPT GA1). 때 칸은 새 길을 거친 기록에만 있어
 //   라이브의 쓰기는 4-2 앞 그대로다.
 // · 새 길: 표시의 때는 그 도움을 마지막으로 본 때다 — 본 표현은 그 본 때(seenAt)로, 그 밖에는 지금으로 든다. 같은 날 다시 봐도 때를 새로 들어야 자정 30분
 //   보호가 선다(10:00 표시 → 23:55 다시 봄 → 다음 날 00:03 답, GPT GA2). 이미 든 때가 지금 도움이고 새 때의 30분 너머까지 같은 학습일로 덮으면 쓰지 않는다.
 //   같은 학습일이거나 30분 안이 아닌 본 표현은 달지 않는다(문서를 연 채 날을 넘긴 차례, Fable 5.2 합친 끝 판 F3).
 function markReviewHelp(id,{seenAt}={}){
  check();const run=state.activeReview;if(!run||!run.ids.includes(id))throw TypeError('Invalid review help');
  if(run.answers[id])return clone(run);
  const engine=judged(),at=now(),marked=run.pendingHelp?.[id]===true,before=helpTimes(run)?.[id];
  if(!engine){
   if(marked&&before===undefined)return clone(run);
   const next=clone(state);next.activeReview.pendingHelp={...(next.activeReview.pendingHelp||{}),[id]:true};
   if(before!==undefined)delete helpTimes(next.activeReview)[id];
   commit(next);return clone(next.activeReview);
  }
  if(seenAt!==undefined&&!freshHelp(seenAt,at))return clone(run);
  const seen=seenAt!==undefined?seenAt:at,kept=marked&&dailyTime(before)&&freshHelp(before,at),last=kept?Math.max(before,seen):seen;
  if(kept&&(last===before||lifeDayKey(before)===lifeDayKey(last+HELP_FRESH)))return clone(run);
  const next=clone(state);next.activeReview.pendingHelp={...(next.activeReview.pendingHelp||{}),[id]:true};
  next.activeReview.pendingHelpAt={...(helpTimes(next.activeReview)||{}),[id]:last};
  commit(next);return clone(next.activeReview);
 }
 // 새 길: 지금 도움이 아닌 표시(앞선 때)를 걷는다 — 화면이 그 복습 문항을 보일 때 부르고, 걷었으면 기록부의 앞 칸(그 도움이 붙은 제시)을 놓아
 // 제품 · Atlas가 함께 「도움 없음」에서 다시 시작한다 — 문서를 연 채 날을 넘겨 이은 판은 같은 run.id라 기록부 칸을 다시 써, 제품은 혼자 맞힘인데
 // Atlas에는 어제 해설이 붙은 답으로 남았다(GPT 다시 검수 GA3). 판정이 없거나 null이면 표시는 늘 도움이라 걷지 않는다(4-2 앞). 걷었으면 참.
 function dropStaleHelp(id){
  check();const run=state.activeReview;if(!run||!run.ids.includes(id)||run.answers[id]||run.pendingHelp?.[id]!==true)return false;
  const engine=judged();if(!engine||helpNow(run,id,now(),engine))return false;
  const next=clone(state);delete next.activeReview.pendingHelp[id];const times=helpTimes(next.activeReview);if(times)delete times[id];
  commit(next);return true;
 }
 function answerReview({id,reviewId,questionId,correct,helped=false,runId}={}){
  check();const run=state.activeReview,keyId=id||reviewId||run?.ids.find(id=>state.reviews[id].questionId===questionId);
  if(!run||runId&&run.id!==runId||!run.ids.includes(keyId)||typeof correct!=='boolean'||typeof helped!=='boolean')throw TypeError('Invalid review answer');
  if(run.answers[keyId])return {duplicate:true,done:run.ids.every(id=>run.answers[id]),remaining:run.ids.filter(id=>!run.answers[id]).length};
  const at=now(),guided=dailyTime(at)&&state.daily?.days[lifeDayKey(at)]?.items[state.reviews[keyId].questionId]?.guidedAt!==undefined;
  helped=helped||helpNow(run,keyId,at)||guided;
  const next=clone(state),review=next.reviews[keyId],difficult=!correct||helped;
  review.streak=difficult?0:review.streak+1;review.lapses+=difficult?1:0;review.intervalDays=difficult?0:INTERVALS[Math.min(review.streak-1,INTERVALS.length-1)];review.dueAt=at+(difficult?MINUTE:review.intervalDays*DAY);review.lastAt=at;
  next.activeReview.answers[keyId]={correct,helped,at};const remaining=next.activeReview.ids.filter(id=>!next.activeReview.answers[id]).length;
  dailyObservation(next,{questionId:review.questionId,lessonId:review.lessonId,at,correct,helped});
  commit(next);return {duplicate:false,done:remaining===0,remaining,dueAt:review.dueAt,intervalDays:review.intervalDays};
 }
 function recordGuidedPractice({questionId,tutorId}={}){
  checkDailyWrite();const q=questions.get(questionId),review=q&&state.reviews[q.review.id];
  if(!q||!dailyId(questionId)||!dailyId(q.lessonId)||!TUTORS.has(tutorId)||!(state.lessons[q.lessonId]?.questionIds.includes(questionId)||review?.questionId===questionId&&review.lessonId===q.lessonId))throw TypeError('Invalid guided life practice');
  const at=now(),dayKey=lifeDayKey(at),existing=state.daily?.days[dayKey]?.items[questionId];
  if(existing?.guidedAt!==undefined&&existing.guidedAt>=Math.max(existing.observedAt??0,review?.lastAt??0))return {dayKey,item:clone(existing),duplicate:true,status:status()};
  const next=clone(state),daily=next.daily??={version:1,days:{}},day=daily.days[dayKey]??={items:{}};
  const item={...day.items[questionId],lessonId:q.lessonId,guidedAt:dailyEventTime(day,day.items[questionId],at),tutorId};
  day.items[questionId]=item;trimDaily(daily);commit(next);return {dayKey,item:clone(item),duplicate:false,status:status()};
 }
 function markDayComplete(){
  checkDailyWrite();const at=now(),dayKey=lifeDayKey(at),day=state.daily?.days[dayKey];
  if(!day||!Object.keys(day.items).length)return {dayKey,closedAt:null,duplicate:false,empty:true,status:status()};
  const latest=Math.max(...Object.values(day.items).map(dailyLatest));
  if(day.closedAt!==undefined&&day.closedAt>=latest)return {dayKey,closedAt:day.closedAt,duplicate:true,empty:false,status:status()};
  const next=clone(state),closedAt=Math.max(at,latest);next.daily.days[dayKey].closedAt=closedAt;commit(next);
  return {dayKey,closedAt,duplicate:false,empty:false,status:status()};
 }
 function selectedTutor(){check();if(readError)throw readError;return state.tutor?.selected??null;}
 function selectTutor(tutor){
  checkDailyWrite();if(!TUTORS.has(tutor))throw TypeError('Invalid selected tutor');
  if(state.tutor?.selected===tutor)return {tutor,duplicate:true,status:status()};
  // Selecting a companion must not trim or reattribute any learning evidence.
  const next=clone(state);next.tutor={version:1,selected:tutor};commit(next,{preserveDaily:true});
  return {tutor,duplicate:false,status:status()};
 }
 // 「한글을 읽을 수 있어요?」의 답. 튜터 선택처럼 이 진도 기록(계정이면 계정, 손님이면 이 기기)에 둔다.
 function hangulReading(){check();if(readError)throw readError;return state.hangul?clone(state.hangul):null;}
 function setHangulReading(answer,{via='question'}={}){
  checkDailyWrite();if(!HANGUL_ANSWERS.has(answer)||!HANGUL_VIA.has(via))throw TypeError('Invalid Hangul reading answer');
  if(state.hangul?.answer===answer)return {hangul:clone(state.hangul),duplicate:true,status:status()};
  // A first-run answer must not trim or reattribute any learning evidence.
  const next=clone(state);next.hangul={version:1,answer,at:now(),via};commit(next,{preserveDaily:true});
  return {hangul:clone(next.hangul),duplicate:false,status:status()};
 }
 // 화면 언어(10-19 1판): 튜터 선택처럼 이 기록의 선택 칸(display)에 둔다. 모르는 언어·모양은 없는 것으로 읽고 기록 전체를 거절하지 않는다
 // (2판에서 언어가 늘어도 옛 판이 진도를 못 읽게 되지 않게). 옛 판은 이 칸을 몰라도 그대로 보존한다.
 function displayLanguage(){check();if(readError)throw readError;const value=state.display;return object(value)&&value.version===1&&DISPLAY_LANGS.has(value.language)?value.language:null;}
 function setDisplayLanguage(language){
  checkDailyWrite();if(!DISPLAY_LANGS.has(language))throw TypeError('Invalid display language');
  if(displayLanguage()===language)return {language,duplicate:true,status:status()};
  const next=clone(state);next.display={version:1,language};commit(next,{preserveDaily:true});
  return {language,duplicate:false,status:status()};
 }
 function arrival(){check();if(readError)throw readError;return readArrival(state.arrival);}
 function setArrival(patch){
  checkDailyWrite();
  const value=readArrival({...(object(state.arrival)?state.arrival:{}),...patch,version:1,updatedAt:now()});
  const next=clone(state);next.arrival=value;commit(next,{preserveDaily:true});
  return {arrival:clone(value),status:status()};
 }
 function learningProfile(){check();if(readError)throw readError;return readWorldLearningProfile(state.learningProfile,{owner,at:now()});}
 function learningProfileValues(){check();if(readError)throw readError;return worldLearningProfileValues(state.learningProfile,{owner,at:now()});}
 function updateLearningProfile(options={}){
  checkDailyWrite();const next=clone(state);
  next.learningProfile=updateWorldLearningProfile(state.learningProfile,{...options,owner,at:now()});
  // Settings share the existing CAS/outbox record and must not trim learning facts.
  commit(next,{preserveDaily:true});return {...learningProfile(),status:status()};
 }
 function clearLearningProfile(options={}){
  checkDailyWrite();const next=clone(state);
  next.learningProfile=clearWorldLearningProfile(state.learningProfile,{...options,owner,at:now()});
  commit(next,{preserveDaily:true});return {...learningProfile(),status:status()};
 }
 // 손님 기기 기록 옮기기(10-20, device-records.mjs guestLifeRecords): 학생이 「옮기기」를 고른 뒤에만.
 // 이 기록에 없는 레슨·복습·날(하루 기록의 문항)만 더하고, 이미 있는 것은 이 기록 것을 그대로 둔다(덮지 않는다).
 // 학습 목표는 이 계정에 아직 아무것도 정하지 않았을 때(처음 상태)만 그 값을 이 계정의 선언으로 다시 남긴다.
 // 옮긴 출처는 imports에 남긴다(최근 20번). 더한 것이 없으면 아무것도 쓰지 않는다.
 function importRecords({lessons={},reviews={},days={},profile=null}={},{from='guest-device'}={}){
  checkDailyWrite();const next=clone(state),added={lessons:0,reviews:0,days:0,profile:false};
  // Capacity omissions are separate from duplicates; the offer must not call
  // them all moved or advance its cutoff past the records still on the device.
  const capacitySkipped={lessons:0,reviews:0,days:0,questions:0},skippedLessons=new Set();
  const result=()=>({...added,...(Object.values(capacitySkipped).some(Boolean)?{capacitySkipped}:{}),status:status()});
  for(const [id,lesson]of Object.entries(object(lessons)?lessons:{})){
   if(next.lessons[id])continue;
   if(Object.keys(next.lessons).length>=100){capacitySkipped.lessons++;skippedLessons.add(id);continue;}
   next.lessons[id]=clone(lesson);added.lessons++;
  }
  for(const [id,review]of Object.entries(object(reviews)?reviews:{})){
   if(next.reviews[id])continue;
   if(!next.lessons[review?.lessonId]){if(skippedLessons.has(review?.lessonId))capacitySkipped.reviews++;continue;}
   if(Object.keys(next.reviews).length>=400){capacitySkipped.reviews++;continue;}
   next.reviews[id]=clone(review);added.reviews++;
  }
  // 날: 계정에 없는 날은 통째로, 있는 날은 그 날에 없는 문항만 — 문항을 더한 날도 더한 날로 센다(옮긴 결과가 「이미 있음」으로 보이지 않게, 10-21 백엔드 검수).
  // 레슨·복습처럼 남은 자리(날 30·하루 문항 100)에만 더한다 — 계정의 날·문항을 밀어내지 않고, 못 들어간 것은 손님 기록에 그대로 남는다(10-26 GQ1).
  for(const [day,value]of Object.entries(object(days)?days:{})){
   const daily=next.daily??={version:1,days:{}},mine=daily.days[day];
   if(!mine){if(Object.keys(daily.days).length<30){daily.days[day]=clone(value);added.days+=1;}else capacitySkipped.days++;continue;}
   let got=0;
   for(const [questionId,item]of Object.entries(object(value?.items)?value.items:{})){
    if(object(mine.items)&&mine.items[questionId])continue;
    if(object(mine.items)&&Object.keys(mine.items).length>=100){capacitySkipped.questions++;continue;}
    (mine.items??={})[questionId]=clone(item);got++;
   }
   if(got)added.days+=1;
  }
  if(object(profile?.values)&&readWorldLearningProfile(next.learningProfile,{owner,at:now()}).profile.status==='new'){
   next.learningProfile=updateWorldLearningProfile(next.learningProfile,{owner,at:now(),values:clone(profile.values),consent:true,expectedRevision:0});added.profile=true;
  }
  if(!added.lessons&&!added.reviews&&!added.days&&!added.profile)return result();
  next.imports=[...(Array.isArray(state.imports)?state.imports:[]),{from,at:now(),lessons:added.lessons,reviews:added.reviews,days:added.days,profile:added.profile}].slice(-20);
  // 옮기기는 계정 기록을 지우지 않는다: 더한 결과가 저장 상한(fitDailyRecord와 같은 바이트)을 넘으면 계정의 지난 날을 잘라 맞추지 않고
  // 아무것도 쓰지 않고 거절한다(10-26 GQ1). 계정·손님 원본은 그대로이고, 옮기기 판은 기존 「옮기지 못했어요」로 남는다.
  next.revision=state.revision+1;
  if(new TextEncoder().encode(JSON.stringify(next)).length>RECORD_FIT_BYTES)throw fail('PLAY_DATA_TOO_LARGE','옮길 기록을 저장할 공간이 부족해요. 계정과 이 기기의 기록은 그대로 두었어요.');
  commit(next,{preserveDaily:true});return result();
 }
 // 돌아온 복습이 묻는 표현(화면 글자 기준). 같은 표현이 레슨 · 이야기에서 따로 잡혀 여러 장면으로 돌아와도 하나다. dueCount는 장면 수 그대로다(11-09).
 function reviewExpression(record){
  const lesson=lessons.get(record.lessonId),question=lesson?.questions?.find(value=>value.id===record.questionId);
  return lesson?.expressions?.find(value=>value.id===question?.expressionId)?.korean||question?.choices?.find(value=>value.id===question.answerId)?.text||'';
 }
 // 글이 없는 복습은 화면 목록에도 없어 세지 않는다. 다 글이 없으면(표현 정보가 없는 묶음) 복습이 있는데 0으로 보이지 않게 장면 수로 돌아간다.
 function dueExpressionCount(due){return new Set(due.map(reviewExpression).filter(Boolean)).size||due.length;}
 function summary(packs=[],flat=[]){
  check();catalog(packs,flat);const ordered=packs.flatMap(pack=>(pack.lessons||[]).map(value=>typeof value==='string'?lessons.get(value):lessons.get(value.id)).filter(Boolean));
  if(!ordered.length)ordered.push(...flat);
  const active=state.activeLessonId&&lessons.get(state.activeLessonId);
  const visits=CAFE_LESSON_IDS.map(id=>ordered.find(l=>l.id===id)).filter(Boolean),nextVisit=visits.find(l=>state.lessons[l.id]?.completedAt==null);
  const latest=Object.entries(state.lessons).filter(([id,run])=>lessons.has(id)&&run.completedAt!==null).reduce((last,[id,run])=>!last||run.completedAt>=last.at?{id,at:run.completedAt}:last,null);
  // A cafe visit opened directly should continue its own stories before sending
  // the player back to the first untouched pack. Existing record IDs stay intact.
  const cafeNext=latest&&isCafeLesson(latest.id)?nextVisit||ordered.find(l=>l.packId==='cafe'&&state.lessons[l.id]?.completedAt==null):null;
  const next=active||cafeNext||ordered.find(lesson=>state.lessons[lesson.id]?.completedAt==null)||null;
  const engine=judged(),due=dueReviews(100,now(),engine),total=ordered.length,completed=ordered.filter(lesson=>state.lessons[lesson.id]?.completedAt!=null).length;
  // Only a lesson with an answered question is 「하던 자리」. One merely opened stays the next lesson,
  // but a returned review is not hidden behind it.
  const resume=!!active&&Object.keys(state.lessons[active.id]?.answers||{}).length>0;
  return {owner,completed,total,allCompleted:total>0&&completed===total,nextLesson:next?{...next,progress:lessonState(next.id)}:null,resume,
   cafe:{completed:visits.filter(l=>state.lessons[l.id]?.completedAt!=null).length,total:visits.length,nextNumber:next&&isCafeLesson(next.id)?CAFE_LESSON_IDS.indexOf(next.id)+1:null},
   // 화면이 말하는 「돌아온 표현 N개」는 새 길에서도 표현 글로 묶은 수다 — 같은 표현을 두 레슨에서 놓치면 장면(문항)은 둘이어도 목록 줄 · 표현은 하나(Fable 5.2 합친 끝 판 F5).
   dueCount:due.length,dueExpressions:dueExpressionCount(due),dueReviews:due.slice(0,6),nextReviewAt:engine?engine.nextAt??null:Object.values(state.reviews).length?Math.min(...Object.values(state.reviews).map(v=>v.dueAt)):null,
   ...(engine?{dueState:engine.state,dueIds:[...engine.ids],dueTimes:[...(engine.times??[])],dueUpcoming:(engine.upcoming??[]).map(row=>({...row})),helpExpired:helpExpired(state.activeReview,engine)}:{}),
   packs:packs.map(pack=>{const ids=(pack.lessons||[]).map(value=>typeof value==='string'?value:value.id);return {id:pack.id,completed:ids.filter(id=>state.lessons[id]?.completedAt!=null).length,total:ids.length};}),status:status()};
 }
 async function flush(){
  check();if(readError)throw readError;if(saving)return saving;
  saving=(async()=>{check();if(writeError){storage.setItem(key,JSON.stringify(state));writeError=null;}const result=save?await save():status();check();emit();return result;})().finally(()=>{saving=null;});return saving;
 }
 const api=Object.freeze({arrival,setArrival,key,owner,status,summary,lessonState,startLesson,setStage,recordAnswer,finishLesson,dueReviews,startReview,markReviewHelp,reviewHelped,dropStaleHelp,answerReview,recordGuidedPractice,markDayComplete,selectedTutor,selectTutor,hangulReading,setHangulReading,displayLanguage,setDisplayLanguage,importRecords,learningProfile,learningProfileValues,updateLearningProfile,clearLearningProfile,flush,
  exportSnapshot(){check();return clone(state);},stop(){stopped=true;},registerLesson:register,
  // 새 길의 판정을 넣는다(app-shell — 깃발이 켜진 문서만). null이면 지금 판으로 돌아간다. 판정이 바뀌면 화면에 알린다.
  setDueSource(source){dueSource=typeof source==='function'?source:null;emit();}});
 return api;
}
