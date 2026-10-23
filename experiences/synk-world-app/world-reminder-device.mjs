// WORLD 학습 알림 · 기기 쪽(1단 — 2026-10-19 결정 「WORLD 알림 · 주 1~2회 · 학습 일만」, 아틀라스 설계 §8-8). 무엇을 언제 알릴지는
// world-reminders.mjs(순수 계획기)가 정하고, 여기서는 이 기기에 저장하고 · 앱 안에서 먼저 묻고 · OS 권한을 청하고 · 그 시각에 띄우고 · 누르면 그 자리로 보낸다.
// - 웹은 서버 없이 닫힌 탭에서 정한 시각에 알림을 띄울 길이 없다(Notification Triggers는 나오지 않았다). 그래서 WORLD가 열려 있는 동안(다른 탭·창을
//   보는 중에도) 1분마다 확인해 때가 된 알림을 띄우고, 닫혀 있던 동안 지난 알림은 늦게 띄우지 않는다 — 밤사이·조용한 시간에 몰아서 울리지 않게.
//   닫혀 있으면 다음에 열 때까지 조용하다(설계 §8-8 「앱을 열지 않으면 저절로 조용해진다」). 설정 화면에 이 범위를 그대로 적는다.
// - 페이지에서 알림을 만들 수 없는 휴대폰 브라우저(안드로이드 크롬 등)와 알림이 없는 브라우저(아이폰 사파리 탭)에는 묻지 않는다 — 켜도 울릴 수 없다.
//   PC 앱(Electron)은 WORLD 창이 청한 알림만 허락한다(desktop/src/security.cjs worldNotificationAllowed).
// - 무엇을 알릴지는 호스트가 넘기는 read()에서 온다: 생활 복습이 돌아오는 때, ①의 이번 주 시험 계획(buildExamPlan)과 시험 정보, 공부한 시각(Trail 답 ·
//   생활 답 · 쓰기 점검), 한글 단계인지. 잠금 화면 글은 한국어 틀이고 한글 단계 학생에게만 고른 화면 언어(도움 언어) 글을 쓴다.
// - 보낸 것·누른 것은 이 기기의 알림 기록(world-reminders.mjs)에 남긴다.
// - 2단(10-22, 앱을 닫아도 받기 — world-push.mjs, 설계 qa/push-reminders-20261022/설계.md): 로그인한 계정 주인에게만 push를 넘긴다.
//   그 계정의 어느 기기에서든 2단이 켜져 있으면 1단은 쉬고(잡아 둔 예약 지움 · 띄우기 직전 10분 넘은 상태는 다시 묻기) 서버가 혼자 보낸다(§6).
//   켜져 있는 동안 1단 다시 잡기마다 계획기 입력 요약을 서버에 보내고(world-push가 바뀐 때만 모은다), 서버가 보낸 기록을 이 기기 1단 기록에 비춰 둔다.
//   설정의 「학습 알림」에 「앱을 닫아도 받기」 줄과 따로 받는 동의 상자를 두고, 1단을 띄울 수 없는 휴대폰에서는 그 줄 하나가 학습 알림 켜기다.
import {t,currentLang} from '../brand-opening/world-lang.mjs';
import {REMINDER_POLICY,planReminders,readReminderState,applyReminderPlan,markReminderDelivered,markReminderOpened,updateReminderSettings,
 answerReminderAsk,shouldAskReminders,noteReminderAsked,reminderHour,deviceOffset,dueReminder,handoverEntries,mergeReminderEntries,reminderDigest} from './world-reminders.mjs';
import {worldPushSupport,deviceTimeZone} from './world-push.mjs';

export const REMINDER_KEY='synk.world.reminders.v1';
export const PRIVACY_URL='https://synk.im/privacy/';
const TICK_MS=60000,MINUTE=60000,DAY=86400000,PUSH_FRESH_MS=10*60000;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 이 기기가 페이지에서 알림을 띄울 수 있는지. 휴대폰 브라우저는 페이지 알림이 없거나(아이폰 탭) 페이지에서 만들 수 없다(안드로이드 크롬 — 서비스 워커만).
export function reminderSupport(target=globalThis){
 const N=target.Notification,nav=target.navigator||{};
 // 아이패드 사파리는 맥 주소 꼴(Macintosh)을 내지만 터치 지점이 여럿이다 — 터치 맥은 없으므로 이 둘이 같이 있으면 태블릿으로 본다.
 const ipad=/Macintosh/i.test(nav.userAgent||'')&&Number(nav.maxTouchPoints)>1;
 const mobile=ipad||nav.userAgentData?.mobile===true||/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent||'');
 const supported=typeof N==='function'&&typeof N.requestPermission==='function'&&target.isSecureContext!==false&&!mobile;
 let permission='unsupported';if(supported){try{permission=N.permission||'default';}catch{permission='default';}}
 return {supported,permission};
}
// 시각 이름(그 기기 시각): 한국어 「저녁 7시」, 영어 「7 PM」, 몽골어 24시간 「19:00」.
export function reminderHourLabel(hour,lang=currentLang()){
 if(lang==='en'){const h=hour%12||12;return `${h} ${hour<12?'AM':'PM'}`;}
 if(lang==='mn')return `${String(hour).padStart(2,'0')}:00`;
 return hour<12?`오전 ${hour}시`:hour===12?'낮 12시':hour<18?`오후 ${hour-12}시`:`저녁 ${hour-12}시`;
}
// 다음 알림의 날짜(그 기기 달력). 한국어 「10월 23일」, 영어 「Oct 23」, 몽골어 「10-р сарын 23」.
export function reminderDateLabel(at,lang=currentLang(),offset=deviceOffset){
 const local=new Date(at+(typeof offset==='function'?offset(at):offset)*MINUTE),month=local.getUTCMonth()+1,day=local.getUTCDate();
 if(lang==='en'){try{return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(local);}catch{return `${month}/${day}`;}}
 if(lang==='mn')return `${month}-р сарын ${day}`;
 return `${month}월 ${day}일`;
}

// 학습 기록(Trail)에서 답한 시각을 읽는 읽기 전용 코치. make(host)가 코치를 만든다(계정이면 학습 호스트의 코치, 손님이면 기기 코치, 못 만들면 null).
// 계정 학습 호스트의 코치는 게임 판을 닫으면(closeRun) 세대가 바뀌어 그 뒤로 늘 던진다 — 던지면 끊고 다시 만든다(world-learning-ui.mjs coachFor와 같은 꼴).
// 게임 판 도중에는 다른 gameId 코치를 만들 수 없어 그때만 빈 목록이다(생활·쓰기 시각은 호스트가 따로 더한다).
export function createTrailTimes({host=()=>null,make=()=>null}={}){
 let coach=null,owner=null;
 const drop=()=>{try{coach?.disconnect?.();}catch{}coach=null;};
 return {read(){
  for(let attempt=0;attempt<2;attempt++){
   try{
    const now=host();
    if(!coach||owner!==now){drop();owner=now;coach=make(now)||null;}
    if(!coach)return [];
    return coach.events().filter(event=>event?.type==='practice.attempted').map(event=>Date.parse(event.at)).filter(Number.isFinite);
   }catch{drop();}
  }
  return [];
 },dispose(){drop();owner=null;}};
}

// 2단 실패 까닭 → 화면 글.
const PUSH_ERRORS=Object.freeze({PUSH_DENIED:'reminder.settings.blocked',PUSH_BLOCKED:'reminder.settings.blocked',PUSH_TIMEOUT:'reminder.push.timeout',
 PUSH_DEVICE_LIMIT:'reminder.push.limit',PUSH_DAILY_LIMIT:'reminder.push.limit',PUSH_LOCAL_CLEANUP:'reminder.push.cleanup'});
export const pushErrorKey=code=>PUSH_ERRORS[code]||'reminder.push.error';

// owner: 'guest' 또는 계정 id(기록은 주인마다 따로). read(): 위 머리글의 입력. open(kind): 알림이 가리키는 자리로(복습·계획·시험 점검).
// show(title, html): 시트 열기(시험 점검 카드·휴대폰의 2단 동의). toast(text). repaint(): 묻는 카드가 바뀌었을 때 배우기 판을 다시 그린다.
// canMock(): 시험 형식 연습(미니 모의, education.mock)을 열 수 있는 화면인지 — 시험 점검 카드의 단추 글이 그 판에 맞게 바뀐다.
// push: 2단 기기 쪽(world-push.mjs createWorldPush) — 로그인한 계정 주인일 때만, 손님은 null. close(): 열린 시트를 닫는다(휴대폰의 2단 동의 시트).
export function createWorldReminders({owner,storage=globalThis.localStorage,target=globalThis,read=()=>null,open=()=>{},show=()=>{},toast=()=>{},repaint=()=>{},
 canMock=()=>false,now=()=>Date.now(),offset=deviceOffset,push=null,pushFeature=false,close=()=>{}}){
 const key=`${REMINDER_KEY}.${owner}`;
 let stopped=false,timer=null,last=null,pending=null,confirming=false,settingsRoot=null,unwatch=null,settingsUpdate=null;
 const load=()=>{try{return readReminderState(JSON.parse(storage?.getItem(key)||'null'));}catch{return readReminderState(null);}};
 const save=state=>{try{storage?.setItem(key,JSON.stringify(state));return true;}catch{return false;}};
 const support=()=>reminderSupport(target);
 const inputs=()=>{try{const value=read();return value&&typeof value==='object'?value:{};}catch{return {};}};
 // 잠금 화면 글의 언어: 한국어. 한글 단계(아직 한글을 못 읽는다고 고른 학생)만 고른 화면 언어(설계 §8-2 도움 언어).
 const pushLang=input=>input.hangulStage&&currentLang()!=='ko'?currentLang():'ko';
 // ── 2단 상태(world-push.mjs) ──
 const remote=()=>{try{return push?.snapshot()||null;}catch{return null;}};
 // 그 계정의 어느 기기에서든 2단이 켜져 있다(서버 상태) — 1단은 쉰다.
 const pushActive=()=>remote()?.account?.active===true;
 // 이 브라우저가 2단을 받는다.
 const pushDevice=()=>remote()?.device?.subscribed===true;
 // 2단을 켤 수 있다: 서버 기능이 켜져 있고(상태로 확인) 이 브라우저가 받을 수 있다.
 const pushOffered=()=>{const value=remote();return !!value&&value.enabled===true&&value.support?.supported===true;};
 const digestOf=(input,time)=>reminderDigest({reviews:input.reviews,exam:input.exam,examPlan:input.examPlan,studyTimes:input.studyTimes,lang:pushLang(input),timeZone:deviceTimeZone(target)},{now:time,offset});

 // 다시 잡기: 앱이 열려 있는 동안 기록이 바뀌거나 창으로 돌아올 때마다. 보내지 않은 옛 계획은 지우고 새로 잡는다.
 // 그 전에 때가 된 알림부터 띄운다 — 잠들었던 기기가 깨어난 순간 다시 잡기가 먼저 돌면 막 때가 된 알림을 띄우지 않고 내일로 옮겨 버린다.
 function refresh(){
  if(stopped)return last;
  tick();
  const before=load(),time=now(),input=inputs(),{supported,permission}=support(),server=remote(),active=server?.account?.active===true;
  // 2단이 켜진 계정: 서버가 보낸 기록을 이 기기 1단 기록에 비춰 둔다 — 2단을 끄거나 다른 기기 1단으로 넘어가도 7일 창·물러남이 이어지게(설계 §6-3).
  const state=active&&Array.isArray(server.plan?.log)?mergeReminderEntries(before,server.plan.log,time):before;
  const plan=planReminders({now:time,settings:state,entries:state.entries,reviews:input.reviews,exam:input.exam,examPlan:input.examPlan,studyTimes:input.studyTimes,offset});
  const live=state.enabled&&supported&&permission==='granted'&&!active;
  const next=applyReminderPlan(state,live?plan.items:[],time);
  if(JSON.stringify(next)!==JSON.stringify(before))save(next);
  last={...plan,live,supported,permission,lang:pushLang(input),...(active?{remote:server.plan||null}:{})};
  // 2단이 켜진 계정이면 요약과 이 기기 1단이 보낸 줄을 보낸다(world-push가 바뀐 때만·5분에 한 번으로 모으고, 「오늘 공부함」·새 보낸 줄은 바로).
  if(active){try{push.sync({digest:digestOf(input,time),handover:handoverEntries(next,time)});}catch{}}
  arm(next);return last;
 }
 // 잦은 기록 변화(답 하나하나)를 한 번으로 모은다.
 function schedule(){if(stopped||pending)return;pending=setTimeout(()=>{pending=null;refresh();},400);}
 function arm(state){
  clearInterval(timer);timer=null;
  if(stopped||!state.enabled||!state.entries.some(row=>!Number.isFinite(row.deliveredAt)))return;
  timer=setInterval(tick,TICK_MS);
 }
 // 때가 된 알림 띄우기. 닫혀 있던 동안 45분 넘게 지난 알림은 띄우지 않는다(보낸 것으로 적지도 않는다 — 다음 계획이 다시 잡는다).
 // 무엇을 띄울지는 2단 서버와 같은 고르기(world-reminders.mjs dueReminder — 조용한 시간 · 45분 늦음 · 그날 공부함 · 그날 보냄)다.
 // 그날 이미 공부했으면(다른 기기에서 공부한 기록이 막 들어온 경우 포함) 띄우지 않는다 — 다음 다시 잡기가 다른 날로 옮긴다.
 function tick(){
  if(stopped||pushActive()||confirming)return;
  const time=now(),{supported,permission}=support();
  if(!supported||permission!=='granted')return;
  let input=null;const read=()=>(input||=inputs());
  const {entry:row}=dueReminder({state:load(),now:time,offset,studyTimes:()=>read().studyTimes});
  if(!row)return;
  // 하루 하나는 이 기기 기준이다 — 같은 기기의 다른 주인(손님 ↔ 계정)이 오늘 이미 띄웠으면 띄우지 않는다(주인을 바꿔도 하루 두 번 울리지 않게).
  const day=at=>Math.floor((at+offsetAt(at)*MINUTE)/DAY);
  if(deliveredElsewhere(day,day(time)))return;
  if(!push){deliverDue(row.id,time,read);return;}
  // 계정 주인: 마지막으로 안 2단 상태가 10분보다 오래됐으면 띄우기 직전에 다시 묻는다(그사이 다른 기기에서 2단을 켰을 수 있다 — 설계 §6-1).
  confirming=true;
  void Promise.resolve().then(()=>push.fresh(PUSH_FRESH_MS)).catch(()=>null).then(value=>{
   confirming=false;
   if(stopped)return;
   if(value?.account?.active){refresh();return;}
   deliverDue(row.id,time,read);
  });
 }
 // 다른 탭이 먼저 띄웠는지 다시 읽고, 적은 다음에 띄운다(같은 알림을 두 번 띄우지 않게 — 겹쳐도 같은 tag라 하나로 보인다).
 function deliverDue(id,time,read){
  const fresh=load(),entry=fresh.entries.find(item=>item.id===id);
  if(!entry||Number.isFinite(entry.deliveredAt)||!fresh.enabled)return;
  if(!save(markReminderDelivered(fresh,id,time)))return;
  deliver(entry,pushLang(read()));
 }
 // 이 기기의 다른 주인 기록(synk.world.reminders.v1.<다른 주인>)에 오늘 띄운 알림이 있는지. 못 읽으면 없는 것으로 본다.
 function deliveredElsewhere(day,today){
  try{
   for(let i=0;i<(storage?.length||0);i++){
    const name=storage.key(i);
    if(typeof name!=='string'||name===key||!name.startsWith(`${REMINDER_KEY}.`))continue;
    if(readReminderState(JSON.parse(storage.getItem(name)||'null')).entries.some(row=>Number.isFinite(row.deliveredAt)&&day(row.deliveredAt)===today))return true;
   }
  }catch{}
  return false;
 }
 // 글의 언어는 띄우는 그때의 학생 상태로 정한다(첫 다시 잡기 전에 띄워도 한글 단계 학생에게 고른 언어로).
 function deliver(entry,lang='ko'){
  try{
   const note=new target.Notification(t('reminder.push.title',undefined,lang),{body:t(entry.template||`reminder.push.${entry.kind}`,undefined,lang),tag:'synk-world-reminder',lang});
   note.onclick=()=>{try{target.focus?.();}catch{}try{note.close();}catch{}opened(entry.id);};
  }catch{/* 띄우지 못한 알림은 그대로 둔다(보낸 기록은 남았다 — 다시 띄우지 않는다) */}
 }
 // 누름: 기록에 남기고 그 자리로. 이 기기의 기록에 없는 알림(다른 주인·지운 기록)은 아무 데도 보내지 않는다.
 function opened(reminderId){
  if(stopped)return;
  const state=load(),entry=state.entries.find(row=>row.id===reminderId);if(!entry)return;
  save(markReminderOpened(state,reminderId,now()));
  openKind(entry.kind);
 }
 // 알림이 가리키는 자리(1단 누름 · 2단 알림을 눌러 들어온 주소 ?reminder=<종류>).
 function openKind(kind){
  if(stopped)return;
  if(kind==='exam')show(t('reminder.exam.heading'),examMarkup());else open(kind==='review'?'review':'plan');
 }

 // ── 앱 안에서 먼저 묻기(배우기 판 맨 아래의 안내 카드 한 장) ──
 function askMarkup(){
  if(stopped)return '';
  const state=load(),time=now(),input=inputs(),{supported,permission}=support();
  const plan=last||refresh();
  // 물러남으로 멈췄으면 그날 한 번만 계속 받을지 묻는다. 2단이 켜진 계정은 서버의 단계를 보고, 2단을 받는 기기에서만 묻는다.
  const paused=pushActive()?pushDevice()&&plan?.remote?.paused===true:state.enabled&&plan?.notes?.includes('paused');
  if(paused&&(!state.pauseAsked||sameDay(state.pauseAsked,time))){
   if(!state.pauseAsked)save({...state,pauseAsked:time});
   return `<div class="world-notice reminder-card" data-tone="check" data-label="REMINDERS" data-reminder-card="pause"><strong>${escape(t('reminder.pause.title'))}</strong><span>${escape(t('reminder.pause.body'))}</span><div class="world-actions reminder-actions"><button type="button" class="plain-button" data-world="reminder-keep">${escape(t('reminder.pause.keep'))}</button><button type="button" class="quiet-button" data-world="reminder-stop">${escape(t('reminder.pause.stop'))}</button></div></div>`;
  }
  if(pushActive())return '';
  // 1단을 띄울 수 없는 기기(휴대폰)에서 2단을 켤 수 있으면 같은 카드로 묻고, 「알려 주세요」는 2단 동의를 연다(설계 §3-1 ⑤).
  const pushOnly=!supported&&pushOffered();
  const asking=pushOnly?remote()?.support?.permission||'default':permission;
  if(!shouldAskReminders({state,now:time,offset,hasReturn:input.hasReturn===true,supported:supported||pushOnly,permission:asking}))return '';
  save(noteReminderAsked(state,time,offset));
  const exam=typeof input.exam?.date==='string'&&input.exam.date.length===10;
  return `<div class="world-notice reminder-card" data-tone="info" data-label="REMINDERS" data-reminder-card="ask"><strong>${escape(t(exam?'reminder.ask.titleExam':'reminder.ask.title'))}</strong><span>${escape(t(pushOnly?'reminder.ask.bodyPush':'reminder.ask.body'))}</span><div class="world-actions reminder-actions"><button type="button" class="plain-button" data-world="${pushOnly?'reminder-push-ask':'reminder-yes'}">${escape(t('reminder.ask.yes'))}</button><button type="button" class="quiet-button" data-world="reminder-no">${escape(t('reminder.ask.no'))}</button></div></div>`;
 }
 const sameDay=(a,b)=>Math.floor((a+offsetAt(a)*MINUTE)/DAY)===Math.floor((b+offsetAt(b)*MINUTE)/DAY);
 const offsetAt=at=>typeof offset==='function'?offset(at):offset;
 // 받아들이면 그 자리(누른 동작 안)에서 OS 권한을 청한다. 허락하면 켜고, 막히면 켜지 않고 설정에서 다시 켤 길을 알린다.
 function permit(){
  const N=target.Notification;if(!support().supported)return Promise.resolve('unsupported');
  try{const asked=N.requestPermission();return Promise.resolve(asked).catch(()=>N.permission||'default');}catch{return Promise.resolve(N.permission||'default');}
 }
 async function accept(){
  const answered=answerReminderAsk(load(),'yes',now());save(answered);
  const permission=await permit();if(stopped)return;
  if(permission==='granted'){save(updateReminderSettings(load(),{enabled:true},now()));const plan=refresh();toast(onMessage(plan));}
  else toast(t(permission==='denied'?'reminder.settings.blocked':permission==='unsupported'?'reminder.settings.unsupported':'reminder.dismissed'));
  repaint();
 }
 function decline(){save(answerReminderAsk(load(),'no',now()));toast(t('reminder.declined'));repaint();}
 const nextLabel=plan=>{const item=plan?.items?.[0];return item?t('reminder.when',{date:reminderDateLabel(item.at,currentLang(),offset),time:reminderHourLabel(plan.hour)}):null;};
 const onMessage=plan=>{const when=nextLabel(plan);return when?t('reminder.on',{when}):t('reminder.onIdle');};

 // ── 2단 켜기·끄기 ──
 // 동의 상자(설정 줄 아래 · 휴대폰 묻는 카드의 시트): 짧은 본문 + 「무엇을 두나요?」 접기. 「동의하고 켜기」는 서비스 워커가 준비될 때까지 잠근다
 // (그 동작 안에서 바로 subscribe를 불러야 사파리가 권한 창을 띄운다).
 function consentMarkup(place='settings'){
  const ready=!!remote()?.publicReady;
  // 시트는 머리에 같은 제목을 쓰므로 상자 안 제목은 설정 줄 아래에서만 쓴다.
  return `<div class="reminder-push-consent" data-push-consent="${place}">${place==='sheet'?'':`<strong>${escape(t('reminder.push.consent.title'))}</strong>`}<p>${escape(t('reminder.push.consent.body'))}</p>
   <details class="reminder-push-more"><summary>${escape(t('reminder.push.consent.more'))}</summary><ul><li>${escape(t('reminder.push.consent.keep'))}</li><li>${escape(t('reminder.push.consent.timing'))}</li><li>${escape(t('reminder.push.consent.never'))}</li><li>${escape(t('reminder.push.consent.delete'))}</li></ul><a href="${PRIVACY_URL}" target="_blank" rel="noopener">${escape(t('reminder.push.consent.privacy'))} <span aria-hidden="true">↗</span></a></details>
   <div class="world-actions reminder-actions"><button type="button" class="felt-button" data-world="reminder-push-yes" ${ready?'':'disabled aria-busy="true"'}>${escape(t('reminder.push.consent.yes'))}</button><button type="button" class="quiet-button" data-world="reminder-push-no">${escape(t('reminder.ask.no'))}</button></div>
   <p class="orientation-help" data-push-message role="status"></p></div>`;
 }
 // 열려 있는 동의 상자들의 단추·안내 글을 지금 상태에 맞춘다. 안내 글은 넘겨받은 글 → 권한 창 기다림 → 지난 켜기·준비의 실패 순이다
 // (실패를 상태에서 읽으므로 상자를 다시 그리거나 상태가 바뀌어도 까닭이 남는다. 준비 중 실패 — 서비스 워커 등록·12초 초과 — 는 권한 창 글이 아니라
 // 연결 실패로 말한다: 「동의하고 켜기」가 왜 잠겼는지 보이게, 10-23 화면 검수).
 function syncConsent(message=null){
  const value=remote(),doc=target.document;if(!doc)return;
  const ready=!!value?.publicReady,error=value?.error;
  const text=message??(value?.busy?t('reminder.push.waiting'):error?t(!ready&&error==='PUSH_TIMEOUT'?'reminder.push.error':pushErrorKey(error)):'');
  for(const box of doc.querySelectorAll?.('[data-push-consent]')||[]){
   const button=box.querySelector('[data-world="reminder-push-yes"]'),line=box.querySelector('[data-push-message]');
   if(button){button.disabled=!ready;if(ready)button.removeAttribute('aria-busy');else button.setAttribute('aria-busy','true');}
   if(line)line.textContent=text;
  }
 }
 // 누른 그 동작 안에서 부른다: world-push가 바로 subscribe를 부르고, 설정·요약·1단 보낸 기록(설계 §6-3)을 함께 넘긴다.
 function enablePush(){
  if(!push||stopped)return Promise.resolve(null);
  const time=now(),state=load(),input=inputs();
  const run=push.enable({settings:{frequency:state.frequency,hour:state.hour,since:state.since},digest:digestOf(input,time),handover:handoverEntries(state,time)});
  syncConsent();
  return Promise.resolve(run).then(value=>{
   if(stopped)return value;
   let message=null;
   if(value?.device?.subscribed){
    let next=load();if(!next.consent)next=answerReminderAsk(next,'yes',now());
    save({...next,enabled:true});
    closeConsent();if(target.document?.querySelector?.('[data-push-consent="sheet"]'))close();toast(t('reminder.push.on'));refresh();
   }else{message=t(pushErrorKey(value?.error));toast(message);}
   // 실패한 까닭은 상자 안 안내에 남긴다(토스트만 남지 않게).
   rerenderSettings(message);repaint();return value;
  });
 }
 // 2단이 켜진 계정의 설정(횟수·시각·「계속 받기」)을 서버에 보낸다. 서버의 다음 알림·줄임·멈춤은 답이 온 뒤에 바뀌므로 그때 다시 그린다
 // (멈춤 카드를 거두고 상태 줄을 새 값으로 — 10-22 화면 검수).
 function syncSettings(){
  const state=load();
  void Promise.resolve(push.sync({settings:{frequency:state.frequency,hour:state.hour}})).then(()=>{if(stopped)return;refresh();rerenderSettings();repaint();},()=>{});
 }
 // 이 기기 2단 끄기. 마지막 기기였으면 서버가 돌려준 보낸 기록·설정을 1단 기록에 넣는다(7일 창·물러남이 이어지게).
 async function disablePush({localOff=false}={}){
  if(!push)return null;
  const result=await push.disable();if(stopped)return result;
  // 다른 켜기·끄기가 도는 중이었다 — 아무것도 바꾸지 않았으니 줄만 지금 상태로 다시 그린다.
  if(!result){rerenderSettings();return null;}
  let state=load();
  if(Array.isArray(result?.handover))state=mergeReminderEntries(state,result.handover,now());
  if(result?.settings&&REMINDER_POLICY.frequencies.includes(result.settings.frequency))state={...state,frequency:result.settings.frequency,
   hour:REMINDER_POLICY.hours.includes(result.settings.hour)?result.settings.hour:null,since:Number.isFinite(result.settings.since)?result.settings.since:state.since};
  if(localOff)state=updateReminderSettings(state,{enabled:false},now());
  save(state);
  // PC에서 마지막 기기의 2단만 끄면 1단이 이어받는다(설계 §3-3) — 「껐어요」가 아니라 열려 있는 동안 이 기기에 알린다는 1단 글로 알린다(10-23 화면 검수).
  const value=remote(),plan=refresh();
  toast(t(value?.error?pushErrorKey(value.error):!localOff&&plan?.live?'reminder.settings.open':'reminder.push.off'));
  rerenderSettings();repaint();return result;
 }
 function closeConsent(){for(const box of target.document?.querySelectorAll?.('[data-push-consent]')||[])box.closest('[data-push-consent-slot]')?.setAttribute('hidden','');}
 // 휴대폰 묻는 카드의 「알려 주세요」: 동의 시트를 열고 그동안 서비스 워커를 준비한다.
 function askPush(){
  show(t('reminder.push.consent.title'),consentMarkup('sheet'));
  void push?.ready().then(()=>syncConsent(),()=>syncConsent());
 }
 // data-world="reminder-*" 단추(app-shell commands가 넘긴다).
 function command(name){
  if(stopped)return;
  if(name==='reminder-yes')return accept();
  if(name==='reminder-no')return decline();
  if(name==='reminder-push-ask')return askPush();
  if(name==='reminder-push-yes')return enablePush();
  // 「괜찮아요」: 휴대폰 묻는 카드에서 연 시트면 1단과 같이 거절로 적고 닫는다. 설정 줄 아래면 상자만 접는다.
  if(name==='reminder-push-no'){if(target.document?.querySelector?.('[data-push-consent="sheet"]')){close();return decline();}closeConsent();rerenderSettings();return;}
  if(name==='reminder-keep'){
   save(updateReminderSettings(load(),{enabled:true},now()));
   // 2단이 켜진 계정은 서버의 물러남도 그때부터 다시 센다.
   if(pushActive())syncSettings();
   toast(onMessage(refresh()));repaint();return;
  }
  if(name==='reminder-stop'){
   if(pushDevice())return disablePush({localOff:true});
   save(updateReminderSettings(load(),{enabled:false},now()));refresh();toast(t('reminder.off'));repaint();return;
  }
  if(name==='reminder-exam-start')return open('exam-start');
  if(name==='reminder-exam-plan')return open('plan');
 }
 // 시험일 점검을 누르면 여는 카드: 잠금 화면에는 일의 종류를 쓰지 않았으므로 여기서 무엇을 권하는지 말한다.
 // 주 단추는 시험 형식 연습(미니 모의)이 있는 화면이면 그것을, 없으면 짧은 진단을 연다(host open('exam-start')와 같은 고르기).
 function examMarkup(){
  let mock=false;try{mock=canMock()===true;}catch{mock=false;}
  return `<div class="reminder-exam"><div class="world-notice" data-tone="info" data-label="CHECK"><strong>${escape(t('reminder.exam.title'))}</strong><span>${escape(t('reminder.exam.body'))}</span></div><div class="world-actions"><button type="button" class="felt-button" data-world="reminder-exam-start">${escape(t(mock?'reminder.exam.mock':'reminder.exam.start'))} <span aria-hidden="true">→</span></button><button type="button" class="plain-button" data-world="reminder-exam-plan">${escape(t('reminder.exam.plan'))}</button></div></div>`;
 }

 // ── 설정 시트의 「학습 알림」 묶음(brand-opening/home.mjs가 설정을 그릴 때 넣는다) ──
 // 묶음의 줄 구성을 가르는 값. 이것이 같으면 다시 그리지 않고 제자리에서 맞춘다 — 설정을 연 뒤 2단 준비가 끝날 때마다 통째로 바꾸면
 // 그 사이 띄운 권한 창의 끝이 새 묶음을 못 맞추고, 펼친 「무엇을 두나요?」와 상자 안 안내가 지워진다(10-23 화면 검수).
 const settingsShape=()=>{const {supported,permission}=support();return [supported,permission,pushOffered(),pushDevice(),pushActive(),remote()?.support?.permission==='denied'].join('|');};
 function settingsMarkup(){
  const state=load(),{supported,permission}=support(),offered=pushOffered(),device=pushDevice(),active=pushActive();
  // 1단을 띄울 수 없는 기기(휴대폰)에서 2단을 켤 수 있으면 학습 알림 줄 하나가 곧 2단이다.
  const pushOnly=!supported&&offered;
  const on=(state.enabled&&supported&&permission==='granted')||device,blocked=remote()?.support?.permission==='denied';
  const hours=['auto',...REMINDER_POLICY.hours];
  const pill=(name,value,label,checked)=>`<label><input type="radio" name="${name}" value="${value}" ${checked?'checked':''}><span>${escape(label)}</span></label>`;
  const main=pushOnly
   ?`<label class="settings-row"><span><strong>${escape(t('reminder.settings.title'))}</strong><small>${escape(t('reminder.push.only.note'))}</small></span><input type="checkbox" data-push-enabled ${device?'checked':''} ${blocked?'disabled':''}></label>`
   :`<label class="settings-row"><span><strong>${escape(t('reminder.settings.title'))}</strong><small>${escape(t('reminder.settings.note'))}</small></span><input type="checkbox" data-reminder-enabled ${on?'checked':''} ${supported&&permission!=='denied'?'':'disabled'}></label>`;
  const row=offered&&!pushOnly?`<label class="settings-row reminder-push-row" data-push-row><span><strong>${escape(t('reminder.push.row.title'))}</strong><small>${escape(t('reminder.push.row.note'))}</small></span><input type="checkbox" data-push-enabled ${device?'checked':''} ${blocked?'disabled':''}></label>`:'';
  return `<section class="settings-group reminder-settings" aria-label="${escape(t('reminder.settings.group'))}" data-reminder-settings data-shape="${escape(settingsShape())}"><p class="eyebrow">REMINDERS</p>
   ${main}${row}<div class="reminder-push-slot" data-push-consent-slot hidden></div>
   <div class="reminder-choices" data-reminder-choices ${on||active?'':'hidden'}>
    <fieldset class="orientation-settings"><legend>${escape(t('reminder.settings.count'))}</legend><div class="orientation-options reminder-count">${REMINDER_POLICY.frequencies.map(n=>pill('reminder-count',n,t(`reminder.settings.count.${n}`),state.frequency===n)).join('')}</div></fieldset>
    <fieldset class="orientation-settings"><legend>${escape(t('reminder.settings.time'))}</legend><div class="orientation-options reminder-hours">${hours.map(value=>pill('reminder-hour',value,value==='auto'?t('reminder.settings.auto'):reminderHourLabel(value),value==='auto'?state.hour===null:state.hour===value)).join('')}</div><p class="orientation-help">${escape(t('reminder.settings.autoNote',{time:reminderHourLabel(REMINDER_POLICY.defaultHour)}))}</p></fieldset>
   </div>
   <p class="orientation-help reminder-status" data-reminder-status role="status">${statusMarkup()}</p></section>`;
 }
 // 상태 두 줄: 지금 상태(다음 알림 · 줄임 · 멈춤 · 막힘)와, 알리는 범위(WORLD가 열려 있는 동안 · 앱을 닫아도 이 기기로 · 다른 기기로).
 function status(){
  const state=load(),{supported,permission}=support(),value=remote(),active=value?.account?.active===true,device=value?.device?.subscribed===true;
  // 이 브라우저의 알림 권한이 막혀 있다(크롬 「차단」 등) — 여기서는 1단도 2단도 켤 수 없으니 막힘과 푸는 곳을 먼저 말한다(10-23 화면 검수).
  const pushBlocked=value?.support?.permission==='denied';
  if(active){
   const plan=value.plan||{},lead=[];
   if(!device&&pushBlocked)lead.push(t('reminder.settings.blocked'));
   if(plan.paused)lead.push(t('reminder.settings.paused'));
   else{
    if(plan.reduced)lead.push(t('reminder.settings.reduced'));
    lead.push(Number.isFinite(plan.next)?t('reminder.settings.next',{when:t('reminder.when',{date:reminderDateLabel(plan.next,currentLang(),offset),time:reminderHourLabel(plan.planHour??REMINDER_POLICY.defaultHour)})}):t('reminder.settings.none'));
   }
   // 이 기기로 온다 · 다른 기기로 간다(여기서도 켤 수 있으면 켜라는 말까지, 받을 수 없거나 막힌 기기면 거기까지만).
   return {lead:lead.join(' '),note:t(device?'reminder.push.status.device':pushOffered()&&!pushBlocked?'reminder.push.status.elsewhere':'reminder.push.status.away')};
  }
  if(!supported){
   if(pushOffered())return {lead:pushBlocked?t('reminder.settings.blocked'):'',note:''};
   // 휴대폰: 2단이 될 수 있는 기기인데 손님이면 로그인 안내, 아이폰은 아직 안 된다는 안내. 둘 다 서버에 묻지 않고 보이므로
   // 설정값 worldPush(pushFeature)가 켜졌을 때만 — 꺼져 있으면 로그인해도 켤 줄이 없어 지키지 못하는 말이 된다.
   const reason=(value?.support||worldPushSupport(target)).reason;
   if(pushFeature&&reason==='ios')return {lead:t('reminder.push.unsupported.ios'),note:''};
   if(pushFeature&&!push&&worldPushSupport(target).supported)return {lead:t('reminder.settings.unsupported'),note:t('reminder.push.guest')};
   return {lead:t('reminder.settings.unsupported'),note:''};
  }
  if(permission==='denied')return {lead:t('reminder.settings.blocked'),note:''};
  if(!state.enabled||permission!=='granted')return {lead:'',note:t('reminder.settings.open')};
  const plan=refresh(),lead=[];
  if(plan.notes.includes('paused'))lead.push(t('reminder.settings.paused'));
  else{if(plan.notes.includes('reduced'))lead.push(t('reminder.settings.reduced'));lead.push(nextLabel(plan)?t('reminder.settings.next',{when:nextLabel(plan)}):t('reminder.settings.none'));}
  return {lead:lead.join(' '),note:t('reminder.settings.open')};
 }
 const statusMarkup=()=>{const {lead,note}=status();return `${lead?`<span class="reminder-status-lead">${escape(lead)}</span>`:''}${note?`<span>${escape(note)}</span>`:''}`;};
 // 설정 묶음을 지금 상태로 맞춘다. 줄 구성(settingsShape)이 바뀌었을 때만 다시 그리고(줄이 생기거나 사라진다), 같으면 상태 줄·스위치·동의 상자만
 // 제자리에서 고친다. message는 동의 상자 안 안내(켜기 실패의 까닭)다.
 function rerenderSettings(message=null){
  const box=settingsRoot?.querySelector?.('[data-reminder-settings]');
  // 설정 묶음이 없는 화면(휴대폰 동의 시트)에서도 열린 동의 상자의 단추·안내는 맞춘다 — 켜기가 실패한 시트의 단추가 잠긴 채 남지 않게(10-23 화면 재확인).
  if(!box||!box.isConnected){syncConsent(message);return;}
  if(box.getAttribute?.('data-shape')===settingsShape()){settingsUpdate?.();syncConsent(message);return;}
  const open=!box.querySelector('[data-push-consent-slot]')?.hidden;
  box.outerHTML=settingsMarkup();wire(settingsRoot);
  if(open)showConsentSlot(message);
 }
 function showConsentSlot(message=null){
  const slot=settingsRoot?.querySelector?.('[data-push-consent-slot]');if(!slot)return;
  slot.innerHTML=consentMarkup();slot.hidden=false;syncConsent(message);
 }
 function bindSettings(root){
  settingsRoot=root;wire(root);
  // 설정을 여는 그때 2단을 준비한다(서비스 워커 등록·공개 키, 받을 수 없는 기기는 계정 상태만) — 다 읽으면 줄을 다시 그린다.
  // 2단 상태가 바뀌면(요약·설정 답, 다른 기기에서 켬·끔) 동의 상자 단추·안내와 상태 줄을 맞춘다 — 줄 구성은 처음 준비(ready) 뒤 한 번 다시 그린다.
  if(push){unwatch?.();unwatch=push.subscribe?.(()=>{syncConsent();settingsUpdate?.();})||null;void push.ready().then(()=>rerenderSettings(),()=>{});}
 }
 function wire(root){
  const box=root?.querySelector?.('[data-reminder-settings]');if(!box)return;
  // 지금 묶음을 그때그때 찾는다 — 다시 그린 뒤에도 앞 묶음에서 띄운 권한 창의 끝(permit().then)이 새 묶음을 맞추게(10-23 화면 검수).
  const update=()=>{
   const current=root.querySelector?.('[data-reminder-settings]');if(!current?.isConnected)return;
   const line=current.querySelector('[data-reminder-status]'),choices=current.querySelector('[data-reminder-choices]'),toggle=current.querySelector('[data-reminder-enabled]');
   const state=load(),{supported,permission}=support(),on=(state.enabled&&supported&&permission==='granted')||pushDevice();
   if(toggle){toggle.checked=on;if(!supported||permission==='denied')toggle.disabled=true;}
   if(choices)choices.hidden=!(on||pushActive());if(line)line.innerHTML=statusMarkup();
  };
  settingsUpdate=update;
  box.addEventListener('change',event=>{
   const control=event.target;if(stopped)return;
   if(control.matches?.('[data-push-enabled]')){
    // 2단 켜기는 바로 권한을 청하지 않고 동의 상자를 연다(「동의하고 켜기」가 권한을 청한다). 끄기는 이 기기 구독을 바로 지운다.
    if(control.checked){control.checked=false;showConsentSlot();return;}
    control.disabled=true;void disablePush({localOff:!support().supported});return;
   }
   if(control.matches?.('[data-reminder-enabled]')){
    if(!control.checked){
     save(updateReminderSettings(load(),{enabled:false},now()));refresh();
     // 학습 알림을 끄면 이 기기의 2단도 끈다.
     if(pushDevice()){void disablePush({localOff:true});return;}
     toast(t('reminder.off'));update();repaint();return;
    }
    // 켜기는 누른 그 자리에서 OS 권한을 청한다(처음 묻기를 건너뛰었거나 거절했던 사람도 여기서 켠다).
    control.disabled=true;
    void permit().then(permission=>{
     if(stopped)return;control.disabled=false;
     if(permission==='granted'){let state=load();if(!state.consent)state=answerReminderAsk(state,'yes',now());save(updateReminderSettings(state,{enabled:true},now()));toast(onMessage(refresh()));}
     else{control.checked=false;toast(t(permission==='denied'?'reminder.settings.blocked':permission==='unsupported'?'reminder.settings.unsupported':'reminder.dismissed'));if(permission==='denied')control.disabled=true;}
     update();repaint();
    });
    return;
   }
   const choose=values=>{save(updateReminderSettings(load(),values,now()));refresh();
    // 2단이 켜진 계정은 설정이 계정에 하나다 — 서버에도 바로 보낸다(물러남도 그때부터 다시 센다).
    if(pushActive())syncSettings();
    toast(t('reminder.saved'));update();};
   if(control.name==='reminder-count')choose({frequency:Number(control.value)});
   if(control.name==='reminder-hour')choose({hour:control.value==='auto'?null:Number(control.value)});
  });
 }
 // 창으로 돌아오면 다시 잡는다(focus와 visibilitychange가 잇달아 와도 한 번으로 모은다 — 다시 잡기가 먼저 때가 된 알림을 띄운다).
 const onVisible=()=>{if(target.document?.visibilityState!=='hidden')schedule();};
 target.addEventListener?.('focus',onVisible);target.document?.addEventListener?.('visibilitychange',onVisible);
 // 이 기기의 주인이 바뀔 때(손님 ↔ 계정): 보내지 않은 예약을 지운다 — 남겨 두면 다시 그 주인으로 돌아온 순간 45분 안의 옛 예약이 또 뜬다.
 // 그 주인이 돌아오면 다시 잡기가 새로 잡는다. 보낸 줄·누른 줄은 남긴다.
 function forgetPending(){
  clearInterval(timer);timer=null;
  const state=load(),entries=state.entries.filter(row=>Number.isFinite(row.deliveredAt));
  if(entries.length!==state.entries.length)save({...state,entries});
 }
 return {refresh,schedule,tick,askMarkup,examMarkup,consentMarkup,settingsMarkup,bindSettings,command,opened,openKind,forgetPending,
  metrics:()=>({owner,state:load(),plan:last,support:support(),push:remote(),hour:last?last.hour:reminderHour({hour:load().hour,now:now(),offset}).hour}),
  dispose(){stopped=true;clearInterval(timer);timer=null;clearTimeout(pending);pending=null;unwatch?.();unwatch=null;target.removeEventListener?.('focus',onVisible);target.document?.removeEventListener?.('visibilitychange',onVisible);}};
}
