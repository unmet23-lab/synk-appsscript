// WORLD 학습 알림 · 기기 쪽(1단 — 2026-10-19 결정 「WORLD 알림 · 주 1~2회 · 학습 일만」, 아틀라스 설계 §8-8). 무엇을 언제 알릴지는
// world-reminders.mjs(순수 계획기)가 정하고, 여기서는 이 기기에 저장하고 · 앱 안에서 먼저 묻고 · OS 권한을 청하고 · 그 시각에 띄우고 · 누르면 그 자리로 보낸다.
// - 웹은 서버 없이 닫힌 탭에서 정한 시각에 알림을 띄울 길이 없다(Notification Triggers는 나오지 않았다). 그래서 WORLD가 열려 있는 동안(다른 탭·창을
//   보는 중에도) 1분마다 확인해 때가 된 알림을 띄우고, 닫혀 있던 동안 지난 알림은 늦게 띄우지 않는다 — 밤사이·조용한 시간에 몰아서 울리지 않게.
//   닫혀 있으면 다음에 열 때까지 조용하다(설계 §8-8 「앱을 열지 않으면 저절로 조용해진다」). 설정 화면에 이 범위를 그대로 적는다.
// - 페이지에서 알림을 만들 수 없는 휴대폰 브라우저(안드로이드 크롬 등)와 알림이 없는 브라우저(아이폰 사파리 탭)에는 묻지 않는다 — 켜도 울릴 수 없다.
//   PC 앱(Electron)은 WORLD 창이 청한 알림만 허락한다(desktop/src/security.cjs worldNotificationAllowed).
// - 무엇을 알릴지는 호스트가 넘기는 read()에서 온다: 생활 복습이 돌아오는 때, ①의 이번 주 시험 계획(buildExamPlan)과 시험 정보, 공부한 시각(Trail 답 ·
//   생활 답 · 쓰기 점검), 한글 단계인지. 잠금 화면 글은 한국어 틀이고 한글 단계 학생에게만 고른 화면 언어(도움 언어) 글을 쓴다.
// - 보낸 것·누른 것은 이 기기의 알림 기록(world-reminders.mjs)에 남긴다. 서버로 보내지 않는다.
import {t,currentLang} from '../brand-opening/world-lang.mjs';
import {REMINDER_POLICY,planReminders,readReminderState,applyReminderPlan,markReminderDelivered,markReminderOpened,updateReminderSettings,
 answerReminderAsk,shouldAskReminders,noteReminderAsked,reminderHour,deviceOffset} from './world-reminders.mjs';

export const REMINDER_KEY='synk.world.reminders.v1';
const TICK_MS=60000,LATE_MS=45*60000,MINUTE=60000,DAY=86400000;
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

// owner: 'guest' 또는 계정 id(기록은 주인마다 따로). read(): 위 머리글의 입력. open(kind): 알림이 가리키는 자리로(복습·계획·시험 점검).
// show(title, html): 시트 열기(시험 점검 카드). toast(text). repaint(): 묻는 카드가 바뀌었을 때 배우기 판을 다시 그린다.
// canMock(): 시험 형식 연습(미니 모의, education.mock)을 열 수 있는 화면인지 — 시험 점검 카드의 단추 글이 그 판에 맞게 바뀐다.
export function createWorldReminders({owner,storage=globalThis.localStorage,target=globalThis,read=()=>null,open=()=>{},show=()=>{},toast=()=>{},repaint=()=>{},
 canMock=()=>false,now=()=>Date.now(),offset=deviceOffset}){
 const key=`${REMINDER_KEY}.${owner}`;
 let stopped=false,timer=null,last=null,pending=null;
 const load=()=>{try{return readReminderState(JSON.parse(storage?.getItem(key)||'null'));}catch{return readReminderState(null);}};
 const save=state=>{try{storage?.setItem(key,JSON.stringify(state));return true;}catch{return false;}};
 const support=()=>reminderSupport(target);
 const inputs=()=>{try{const value=read();return value&&typeof value==='object'?value:{};}catch{return {};}};
 // 잠금 화면 글의 언어: 한국어. 한글 단계(아직 한글을 못 읽는다고 고른 학생)만 고른 화면 언어(설계 §8-2 도움 언어).
 const pushLang=input=>input.hangulStage&&currentLang()!=='ko'?currentLang():'ko';

 // 다시 잡기: 앱이 열려 있는 동안 기록이 바뀌거나 창으로 돌아올 때마다. 보내지 않은 옛 계획은 지우고 새로 잡는다.
 // 그 전에 때가 된 알림부터 띄운다 — 잠들었던 기기가 깨어난 순간 다시 잡기가 먼저 돌면 막 때가 된 알림을 띄우지 않고 내일로 옮겨 버린다.
 function refresh(){
  if(stopped)return last;
  tick();
  const state=load(),time=now(),input=inputs(),{supported,permission}=support();
  const plan=planReminders({now:time,settings:state,entries:state.entries,reviews:input.reviews,exam:input.exam,examPlan:input.examPlan,studyTimes:input.studyTimes,offset});
  const live=state.enabled&&supported&&permission==='granted';
  const next=applyReminderPlan(state,live?plan.items:[],time);
  if(JSON.stringify(next)!==JSON.stringify(state))save(next);
  last={...plan,live,supported,permission,lang:pushLang(input)};
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
 function tick(){
  if(stopped)return;
  const time=now(),{supported,permission}=support();
  if(!supported||permission!=='granted')return;
  const day=at=>Math.floor((at+offsetAt(at)*MINUTE)/DAY),hour=Math.floor(((time+offsetAt(time)*MINUTE)%DAY+DAY)%DAY/(60*MINUTE));
  if(hour<REMINDER_POLICY.quiet.to||hour>=REMINDER_POLICY.quiet.from)return;
  const due=load().entries.filter(row=>!Number.isFinite(row.deliveredAt)&&row.at<=time&&time-row.at<=LATE_MS);
  if(!due.length)return;
  // 그날 이미 공부했으면(다른 기기에서 공부한 기록이 막 들어온 경우 포함) 잡아 둔 알림을 띄우지 않는다 — 다음 다시 잡기가 다른 날로 옮긴다.
  const input=inputs(),today=day(time);
  if((Array.isArray(input.studyTimes)?input.studyTimes:[]).some(at=>Number.isFinite(at)&&at<=time&&day(at)===today))return;
  // 하루 하나는 이 기기 기준이다 — 같은 기기의 다른 주인(손님 ↔ 계정)이 오늘 이미 띄웠으면 띄우지 않는다(주인을 바꿔도 하루 두 번 울리지 않게).
  if(deliveredElsewhere(day,today))return;
  for(const row of due){
   // 다른 탭이 먼저 띄웠는지 다시 읽고, 적은 다음에 띄운다(같은 알림을 두 번 띄우지 않게 — 겹쳐도 같은 tag라 하나로 보인다).
   const fresh=load(),entry=fresh.entries.find(item=>item.id===row.id);
   if(!entry||Number.isFinite(entry.deliveredAt)||!fresh.enabled)continue;
   if(!save(markReminderDelivered(fresh,row.id,time)))continue;
   deliver(entry,pushLang(input));
  }
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
  if(entry.kind==='exam')show(t('reminder.exam.heading'),examMarkup());else open(entry.kind);
 }

 // ── 앱 안에서 먼저 묻기(배우기 판 맨 아래의 안내 카드 한 장) ──
 function askMarkup(){
  if(stopped)return '';
  const state=load(),time=now(),input=inputs(),{supported,permission}=support();
  // 물러남으로 멈췄으면 그날 한 번만 계속 받을지 묻는다.
  const plan=last||refresh();
  if(state.enabled&&plan?.notes?.includes('paused')&&(!state.pauseAsked||sameDay(state.pauseAsked,time))){
   if(!state.pauseAsked)save({...state,pauseAsked:time});
   return `<div class="world-notice reminder-card" data-tone="check" data-label="REMINDERS" data-reminder-card="pause"><strong>${escape(t('reminder.pause.title'))}</strong><span>${escape(t('reminder.pause.body'))}</span><div class="world-actions reminder-actions"><button type="button" class="plain-button" data-world="reminder-keep">${escape(t('reminder.pause.keep'))}</button><button type="button" class="quiet-button" data-world="reminder-stop">${escape(t('reminder.pause.stop'))}</button></div></div>`;
  }
  if(!shouldAskReminders({state,now:time,offset,hasReturn:input.hasReturn===true,supported,permission}))return '';
  save(noteReminderAsked(state,time,offset));
  const exam=typeof input.exam?.date==='string'&&input.exam.date.length===10;
  return `<div class="world-notice reminder-card" data-tone="info" data-label="REMINDERS" data-reminder-card="ask"><strong>${escape(t(exam?'reminder.ask.titleExam':'reminder.ask.title'))}</strong><span>${escape(t('reminder.ask.body'))}</span><div class="world-actions reminder-actions"><button type="button" class="plain-button" data-world="reminder-yes">${escape(t('reminder.ask.yes'))}</button><button type="button" class="quiet-button" data-world="reminder-no">${escape(t('reminder.ask.no'))}</button></div></div>`;
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
 // data-world="reminder-*" 단추(app-shell commands가 넘긴다).
 function command(name){
  if(stopped)return;
  if(name==='reminder-yes')return accept();
  if(name==='reminder-no')return decline();
  if(name==='reminder-keep'){save(updateReminderSettings(load(),{enabled:true},now()));toast(onMessage(refresh()));repaint();return;}
  if(name==='reminder-stop'){save(updateReminderSettings(load(),{enabled:false},now()));refresh();toast(t('reminder.off'));repaint();return;}
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
 function settingsMarkup(){
  const state=load(),{supported,permission}=support(),on=state.enabled&&supported&&permission==='granted';
  const hours=['auto',...REMINDER_POLICY.hours];
  const pill=(name,value,label,checked)=>`<label><input type="radio" name="${name}" value="${value}" ${checked?'checked':''}><span>${escape(label)}</span></label>`;
  return `<section class="settings-group reminder-settings" aria-label="${escape(t('reminder.settings.group'))}" data-reminder-settings><p class="eyebrow">REMINDERS</p>
   <label class="settings-row"><span><strong>${escape(t('reminder.settings.title'))}</strong><small>${escape(t('reminder.settings.note'))}</small></span><input type="checkbox" data-reminder-enabled ${on?'checked':''} ${supported&&permission!=='denied'?'':'disabled'}></label>
   <div class="reminder-choices" data-reminder-choices ${on?'':'hidden'}>
    <fieldset class="orientation-settings"><legend>${escape(t('reminder.settings.count'))}</legend><div class="orientation-options reminder-count">${REMINDER_POLICY.frequencies.map(n=>pill('reminder-count',n,t(`reminder.settings.count.${n}`),state.frequency===n)).join('')}</div></fieldset>
    <fieldset class="orientation-settings"><legend>${escape(t('reminder.settings.time'))}</legend><div class="orientation-options reminder-hours">${hours.map(value=>pill('reminder-hour',value,value==='auto'?t('reminder.settings.auto'):reminderHourLabel(value),value==='auto'?state.hour===null:state.hour===value)).join('')}</div><p class="orientation-help">${escape(t('reminder.settings.autoNote',{time:reminderHourLabel(REMINDER_POLICY.defaultHour)}))}</p></fieldset>
   </div>
   <p class="orientation-help reminder-status" data-reminder-status role="status">${statusMarkup()}</p></section>`;
 }
 // 상태 두 줄: 지금 상태(다음 알림 · 줄임 · 멈춤 · 막힘)와, 켤 수 있는 기기에서는 알리는 범위(WORLD가 열려 있는 동안).
 function status(){
  const state=load(),{supported,permission}=support();
  if(!supported)return {lead:t('reminder.settings.unsupported'),note:''};
  if(permission==='denied')return {lead:t('reminder.settings.blocked'),note:''};
  if(!state.enabled||permission!=='granted')return {lead:'',note:t('reminder.settings.open')};
  const plan=refresh(),lead=[];
  if(plan.notes.includes('paused'))lead.push(t('reminder.settings.paused'));
  else{if(plan.notes.includes('reduced'))lead.push(t('reminder.settings.reduced'));lead.push(nextLabel(plan)?t('reminder.settings.next',{when:nextLabel(plan)}):t('reminder.settings.none'));}
  return {lead:lead.join(' '),note:t('reminder.settings.open')};
 }
 const statusMarkup=()=>{const {lead,note}=status();return `${lead?`<span class="reminder-status-lead">${escape(lead)}</span>`:''}${note?`<span>${escape(note)}</span>`:''}`;};
 function bindSettings(root){
  const box=root?.querySelector?.('[data-reminder-settings]');if(!box)return;
  const line=box.querySelector('[data-reminder-status]'),choices=box.querySelector('[data-reminder-choices]'),toggle=box.querySelector('[data-reminder-enabled]');
  const update=()=>{const state=load(),on=state.enabled&&support().permission==='granted';if(toggle)toggle.checked=on;if(choices)choices.hidden=!on;if(line)line.innerHTML=statusMarkup();};
  box.addEventListener('change',event=>{
   const control=event.target;if(stopped)return;
   if(control.matches?.('[data-reminder-enabled]')){
    if(!control.checked){save(updateReminderSettings(load(),{enabled:false},now()));refresh();toast(t('reminder.off'));update();repaint();return;}
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
   if(control.name==='reminder-count'){save(updateReminderSettings(load(),{frequency:Number(control.value)},now()));refresh();toast(t('reminder.saved'));update();return;}
   if(control.name==='reminder-hour'){save(updateReminderSettings(load(),{hour:control.value==='auto'?null:Number(control.value)},now()));refresh();toast(t('reminder.saved'));update();}
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
 return {refresh,schedule,tick,askMarkup,examMarkup,settingsMarkup,bindSettings,command,opened,forgetPending,
  metrics:()=>({owner,state:load(),plan:last,support:support(),hour:last?last.hour:reminderHour({hour:load().hour,now:now(),offset}).hour}),
  dispose(){stopped=true;clearInterval(timer);timer=null;clearTimeout(pending);pending=null;target.removeEventListener?.('focus',onVisible);target.document?.removeEventListener?.('visibilitychange',onVisible);}};
}
