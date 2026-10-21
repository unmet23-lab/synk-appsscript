// WORLD 학습 알림 · 일주일에 한두 번(2026-10-19 결정 「WORLD 알림 · 주 1~2회 · 학습 일만 · 다음 묶음」, 아틀라스 설계 §8-8, 구현 명세 §4-14).
// Vellum이 맡는 「알림을 보내는 때」다. 규칙으로만 정하고, 돌아오는 비율을 높이려고 고치지 않는다(설계 §7-4 — 누른 기록으로 배우지 않는다).
// WORLD 한 제품만 쓰므로 제품 폴더에 둔다(docs/아틀라스_설계.md#common-capability-promotion). 화면·저장·OS 예약은 world-reminder-device.mjs가 한다.
// - 계획기(planReminders)는 순수 함수다: 학생이 정한 설정 · 이 기기의 알림 기록 · 생활 복습이 돌아오는 때 · 이번 주 시험 계획(world-exam-plan.mjs) ·
//   공부한 시각 · 지금 시각 → 앞으로 7일의 알림 0~2개(종류 · 글 키 · 보낼 시각). 같은 입력이면 늘 같은 계획이다.
// - 어떤 7일 창에서도 최대 두 번(학생이 한 번으로 줄일 수 있다). 둘째는 그 주에만 있는 일(시험일 2주·1주 전 점검)이 있을 때만 쓴다.
// - 조용한 시간(밤 9시~아침 9시, 기기 시각)에는 잡지 않는다. 그날 이미 공부했으면 그날은 잡지 않는다.
// - 문장은 학습 일만 말한다. 재촉·연속 기록·빠진 날·남은 횟수를 쓰지 않고, 잠금 화면 글에는 일의 종류·약점·급수·점수·이름이 없다.
// - 열지 않은 알림이 이어서 셋이면 주 한 번으로 줄이고, 그 뒤 다시 셋이면 멈추고 앱 안에서 한 번 묻는다.
// - 보낸 것·누른 것은 이 기기의 알림 기록(계획·보냄·누름)에 남기고 효과를 주장하지 않는다. 1단(기기 예약)이라 서버로 보내지 않는다 —
//   서버 기록(새 어휘 notification.planned·opened)과 2단 푸시는 구현 명세 §2·§4-14의 사용자 확인 자리다.

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR;
export const REMINDER_POLICY=Object.freeze({version:'world-reminders-1',
 // 한 창의 길이와 앞으로 잡는 범위: 7일. 앱을 열 때마다 기존 예약을 지우고 다시 잡는다(앱을 열지 않으면 잡힌 것만 울린 뒤 조용해진다).
 // 시험일 점검처럼 날이 정해진 알림은 14일 앞까지 미리 자리를 잡아 둔다(보통 알림을 잡았다가 나중에 거두지 않게 — 잡은 것은 7일 안의 것만).
 windowMs:7*DAY,horizonMs:7*DAY,reserveMs:14*DAY,
 // 학생이 고르는 횟수(한 7일 창): 1 · 2(기본 — 「일주일에 한두 번」). 끄기는 enabled:false다.
 frequencies:Object.freeze([1,2]),defaultFrequency:2,
 // 보낼 수 있는 때(기기 시각): 아침 9시부터 밤 9시 전까지. 고를 수 있는 시각과, 고르지 않았을 때의 기본값(저녁 7시).
 quiet:Object.freeze({from:21,to:9}),hours:Object.freeze([9,12,15,18,20]),defaultHour:19,
 // 확인된 공부 시간대: 최근 28일에 같은 시각에 공부한 날이 사흘 이상이면 그 시각(조용한 시간 밖으로 당긴다).
 band:Object.freeze({days:28,minDays:3}),
 // 지금부터 이 시간 안의 때는 잡지 않는다(앱을 쓰는 중에 바로 울리지 않게).
 leadMs:10*MINUTE,
 // 시험일 점검: 2주 전·1주 전. 그날이 막히면(그날 공부함·이미 지남) 다음 날까지만 본다.
 examDays:Object.freeze([14,7]),examSlack:1,
 // 이번 주 계획의 연습: 마지막으로 공부한 날에서 이틀 뒤의 날부터, 그 주(월요일 0시, 한국 시각 — 시험 계획과 같은 주) 안에서 한 번.
 planRestDays:2,
 // 물러남: 열지 않은 알림이 이어서 셋 → 주 한 번, 다시 셋 → 멈춤. 보낸 뒤 하루가 지나야 「열지 않음」으로 센다.
 backoff:Object.freeze({reduceAfter:3,stopAfter:3,graceMs:DAY}),
 // 이 기기의 알림 기록: 12주 · 60줄까지.
 keepMs:84*DAY,keepRows:60,
 // 앱 안에서 묻기: 보인 날 사흘까지(답하지 않으면 그만 묻는다). 거절하면 다시 묻지 않고, 켜기는 설정에서 한다.
 askDays:3});
export const REMINDER_KINDS=Object.freeze(['exam','review','plan']);
// 잠금 화면 글(world-strings.mjs의 reminder.push.*): 한국어 틀이고, 한글 단계의 학생에게만 도움 언어 글을 쓴다(설계 §8-2).
export const REMINDER_TEMPLATES=Object.freeze({exam:'reminder.push.exam',review:'reminder.push.review',plan:'reminder.push.plan'});

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
// 기기 시간대: 그 순간 UTC보다 빠른 분(서울 +540). 시험은 고정값이나 함수를 넘긴다.
export const deviceOffset=at=>-new Date(at).getTimezoneOffset();
const offsetOf=offset=>typeof offset==='function'?offset:finite(offset)?()=>offset:deviceOffset;
// 그 지역의 날 번호(그 지역 달력 날짜의 UTC 날 번호와 같다)와 시각.
const localDay=(at,offset)=>Math.floor((at+offset(at)*MINUTE)/DAY);
const localHour=(at,offset)=>Math.floor((((at+offset(at)*MINUTE)%DAY)+DAY)%DAY/HOUR);
export const reminderDayKey=(at,offset=deviceOffset)=>new Date(localDay(at,offsetOf(offset))*DAY).toISOString().slice(0,10);
// 그 지역 날의 hour시 정각을 UTC ms로. 서머타임이 바뀌는 날은 그 시각의 오프셋으로 한 번 더 맞춘다.
function slotAt(day,hour,offset){const local=day*DAY+hour*HOUR;let at=local-offset(local)*MINUTE;at=local-offset(at)*MINUTE;return at;}
const allowedHour=hour=>Number.isInteger(hour)&&hour>=REMINDER_POLICY.quiet.to&&hour<REMINDER_POLICY.quiet.from;

// 보낼 시각: 학생이 고른 시각 → 확인된 공부 시간대 → 기본값(저녁 7시).
export function reminderHour({hour=null,studyTimes=[],now,offset}={}){
 const policy=REMINDER_POLICY,off=offsetOf(offset);
 if(policy.hours.includes(hour))return {hour,source:'chosen'};
 if(finite(now)){
  const since=now-policy.band.days*DAY,days=new Map();
  for(const at of Array.isArray(studyTimes)?studyTimes:[])if(finite(at)&&at>=since&&at<=now){const h=localHour(at,off);if(!days.has(h))days.set(h,new Set());days.get(h).add(localDay(at,off));}
  let best=null;for(const [h,set]of days)if(set.size>=policy.band.minDays&&(!best||set.size>best.n||set.size===best.n&&h<best.h))best={h,n:set.size};
  if(best)return {hour:Math.min(policy.quiet.from-1,Math.max(policy.quiet.to,best.h)),source:'observed'};
 }
 return {hour:policy.defaultHour,source:'default'};
}

// 물러남 단계: 0 보통 · 1 줄임(주 한 번) · 2 멈춤. 학생이 설정을 다시 고르면(since) 그 뒤에 보낸 것부터 센다.
// 누른 알림은 이어진 수를 처음부터 다시 세게 하지만, 줄인 것을 저절로 되돌리지는 않는다(되돌리기는 학생이 설정에서 한다).
export function backoffLevel({entries=[],now,since=null}={}){
 const {reduceAfter,stopAfter,graceMs}=REMINDER_POLICY.backoff;
 const sent=(Array.isArray(entries)?entries:[]).filter(row=>finite(row?.deliveredAt)&&(!finite(since)||row.deliveredAt>since)).sort((a,b)=>a.deliveredAt-b.deliveredAt);
 let level=0,run=0;
 for(const row of sent){
  if(finite(row.openedAt)){run=0;continue;}
  if(!finite(now)||row.deliveredAt>now-graceMs)continue;
  run+=1;
  if(level===0&&run>=reduceAfter){level=1;run=0;}else if(level===1&&run>=stopAfter)return 2;
 }
 return level;
}

// 7일 창 검사: 정렬한 시각들에서 7일 안에 든 수의 최댓값(정확히 7일 떨어진 둘은 같은 창이 아니다).
function windowMax(times){
 const sorted=[...times].sort((a,b)=>a-b);let best=0;
 for(let i=0,j=0;i<sorted.length;i++){while(sorted[i]-sorted[j]>=REMINDER_POLICY.windowMs)j++;best=Math.max(best,i-j+1);}
 return best;
}

// 앞으로 7일의 알림. settings: {enabled, frequency, hour, since}. entries: 이 기기의 알림 기록(보낸 것만 창에 센다).
// reviews: 생활 복습이 돌아오는 때(ms, life-progress reviews[].dueAt). exam: 학생이 밝힌 시험({date}). examPlan: 이번 주 시험 계획(buildExamPlan).
// studyTimes: 공부한 시각(Trail 첫 답·생활 답·쓰기 점검, ms). offset: 기기 시간대(분, 함수도 된다).
export function planReminders({now,settings={},entries=[],reviews=[],exam=null,examPlan=null,studyTimes=[],offset}={}){
 if(!finite(now))throw TypeError('WORLD reminders need a time');
 const policy=REMINDER_POLICY,off=offsetOf(offset),base={policy:policy.version,learningEffectClaim:false};
 if(settings?.enabled!==true)return {...base,cap:0,level:0,items:[],notes:['off']};
 const rows=Array.isArray(entries)?entries.filter(record):[];
 const level=backoffLevel({entries:rows,now,since:settings.since??null});
 if(level===2)return {...base,cap:0,level,items:[],notes:['paused']};
 const frequency=policy.frequencies.includes(settings.frequency)?settings.frequency:policy.defaultFrequency;
 const cap=level===1?1:frequency,notes=level===1?['reduced']:[];
 const times=(Array.isArray(studyTimes)?studyTimes:[]).filter(finite);
 const {hour,source}=reminderHour({hour:settings.hour??null,studyTimes:times,now,offset:off});
 const today=localDay(now,off),studiedToday=times.some(at=>at<=now&&localDay(at,off)===today);
 const earliest=now+policy.leadMs,horizon=now+policy.horizonMs;
 // 그 지역 날의 보낼 때: 오늘 공부했으면 오늘은 없고, 지난 때·범위(기본 7일) 밖도 없다.
 const slot=(day,limit=horizon)=>{if(day===today&&studiedToday)return null;const at=slotAt(day,hour,off);return at>=earliest&&at<=limit?at:null;};
 const slotsFrom=(from,until=horizon)=>{const list=[],start=Math.max(from,earliest),end=Math.min(until,horizon);for(let day=localDay(start,off);day<=localDay(end,off);day++){const at=slot(day);if(at!==null&&at>=start&&at<=end)list.push(at);}return list;};
 const sent=rows.filter(row=>finite(row.deliveredAt)&&REMINDER_KINDS.includes(row.kind));
 const delivered=(kind,ref)=>sent.some(row=>row.kind===kind&&row.ref===ref);
 const candidates=[];
 // ① 시험일 점검(그 주에만 있는 일): 날까지 정한 시험만(달만 알면 2주 전을 모른다). 시험이 지났으면 없다.
 const date=typeof exam?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(exam.date)?exam.date:null;
 if(date){
  const examDay=Math.floor(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7))-1,Number(date.slice(8,10)))/DAY);
  for(const before of policy.examDays){
   const ref=`${date}:${before}`;if(delivered('exam',ref))continue;
   const list=[];for(let day=examDay-before;day<=examDay-before+policy.examSlack;day++){const at=slot(day,now+policy.reserveMs);if(at!==null)list.push(at);}
   if(list.length)candidates.push({kind:'exam',ref,slots:list,extra:true});
  }
 }
 // ② 돌아온 복습: 지난 복습 알림 뒤에 돌아오는 복습이 있으면, 그것이 돌아온 뒤의 첫 때. 이미 알린 복습을 다시 알리지 않는다.
 const lastReview=sent.filter(row=>row.kind==='review').reduce((n,row)=>Math.max(n,row.deliveredAt),-Infinity);
 const fresh=(Array.isArray(reviews)?reviews:[]).filter(at=>finite(at)&&at>lastReview).sort((a,b)=>a-b);
 if(fresh.length){const list=slotsFrom(fresh[0]);if(list.length)candidates.push({kind:'review',ref:String(Math.floor(fresh[0]/MINUTE)),slots:list,extra:false});}
 // ③ 이번 주 계획에 준비된 연습: 시험 계획에 이번 주 남은 연습이 있을 때, 마지막으로 공부한 날의 이틀 뒤부터 그 주 안에서 한 번. 남은 수는 글에 쓰지 않는다.
 if(record(examPlan)&&record(examPlan.week)&&finite(examPlan.week.start)&&finite(examPlan.week.end)&&examPlan.phase!=='past'){
  const left=(Array.isArray(examPlan.areas)?examPlan.areas:[]).reduce((n,row)=>n+Math.max(0,Number(row?.remaining)||0),0),ref=String(examPlan.week.start);
  if(left>0&&!delivered('plan',ref)){
   const last=times.filter(at=>at<=now).reduce((n,at)=>Math.max(n,at),-Infinity);
   const from=finite(last)?slotAt(localDay(last,off)+policy.planRestDays,0,off):now;
   const list=slotsFrom(from,examPlan.week.end-1);
   if(list.length)candidates.push({kind:'plan',ref,slots:list,extra:false});
  }
 }
 // 한도: 시험 점검을 먼저 놓고(7일 밖의 점검은 자리만), 복습 → 계획 순으로 보통 알림 하나. 어떤 7일 창에서도 모두 cap 이하, 보통 알림은 하나 이하,
 // 그리고 하루에 하나(두 알림이 한꺼번에 울리지 않게 — 겹치면 뒤의 것이 다음 날로 간다). 보낸 알림은 실제로 뜬 때가 아니라 잡았던 때로 센다
 // (앱이 잠깐 잠들어 몇 분 늦게 뜬 알림 때문에 정확히 한 주 간격인 두 점검 사이의 자리가 사라지지 않게).
 const placed=sent.map(row=>({at:row.at,extra:row.kind==='exam'}));
 const fits=list=>windowMax(list.map(row=>row.at))<=cap&&windowMax(list.filter(row=>!row.extra).map(row=>row.at))<=1;
 const freeDay=time=>!placed.some(row=>localDay(row.at,off)===localDay(time,off));
 const items=[];let ordinary=false;
 for(const candidate of [...candidates.filter(row=>row.extra),...candidates.filter(row=>!row.extra)]){
  if(!candidate.extra&&ordinary)continue;
  const at=candidate.slots.find(time=>freeDay(time)&&fits([...placed,{at:time,extra:candidate.extra}]));
  if(at===undefined){notes.push(`cap.${candidate.kind}`);continue;}
  placed.push({at,extra:candidate.extra});if(!candidate.extra)ordinary=true;
  if(at>horizon)continue;
  items.push({id:`${candidate.kind}:${candidate.ref}`,kind:candidate.kind,ref:candidate.ref,at,template:REMINDER_TEMPLATES[candidate.kind]});
 }
 if(studiedToday)notes.push('studied-today');
 items.sort((a,b)=>a.at-b.at);
 return {...base,cap,level,hour,hourSource:source,items,notes};
}

// ── 이 기기의 알림 기록(Trail 꼴: 계획 · 보냄 · 누름) ──
// state: {version:1, consent:{answer:'yes'|'no', at}|null, asked:[날 키], enabled, frequency, hour, since, pauseAsked, entries:[...]}.
// entries 한 줄: {id, kind, ref, at(보낼 때), plannedAt, deliveredAt?, openedAt?}. 보낸 적 없는 계획은 다시 잡을 때 지운다(보내지 않은 것은 남길 사실이 아니다).
export function emptyReminderState(){return {version:1,consent:null,asked:[],enabled:false,frequency:REMINDER_POLICY.defaultFrequency,hour:null,since:null,pauseAsked:null,entries:[]};}
function entryOf(row){
 if(!record(row)||!id(row.id)||!REMINDER_KINDS.includes(row.kind)||typeof row.ref!=='string'||row.ref.length>40||!finite(row.at)||!finite(row.plannedAt))return null;
 return {id:row.id,kind:row.kind,ref:row.ref,at:row.at,plannedAt:row.plannedAt,...(finite(row.deliveredAt)?{deliveredAt:row.deliveredAt}:{}),...(finite(row.openedAt)?{openedAt:row.openedAt}:{})};
}
// 저장된 값을 읽는다. 틀린 칸은 그 칸만 기본값으로 둔다(기록을 읽지 못해 알림이 늘어나는 일은 없다 — 꺼짐이 기본이다).
export function readReminderState(value){
 const state=emptyReminderState();if(!record(value)||value.version!==1)return state;
 if(record(value.consent)&&['yes','no'].includes(value.consent.answer)&&finite(value.consent.at))state.consent={answer:value.consent.answer,at:value.consent.at};
 if(Array.isArray(value.asked))state.asked=[...new Set(value.asked.filter(key=>typeof key==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(key)))].slice(-REMINDER_POLICY.askDays);
 state.enabled=value.enabled===true;
 if(REMINDER_POLICY.frequencies.includes(value.frequency))state.frequency=value.frequency;
 if(REMINDER_POLICY.hours.includes(value.hour))state.hour=value.hour;
 if(finite(value.since))state.since=value.since;
 if(finite(value.pauseAsked))state.pauseAsked=value.pauseAsked;
 const seen=new Set();state.entries=(Array.isArray(value.entries)?value.entries:[]).map(entryOf).filter(row=>row&&!seen.has(row.id)&&seen.add(row.id));
 return state;
}
function prune(entries,now){
 const keep=entries.filter(row=>finite(row.deliveredAt)?row.deliveredAt>now-REMINDER_POLICY.keepMs:row.at>now-DAY);
 return keep.sort((a,b)=>(a.deliveredAt??a.at)-(b.deliveredAt??b.at)).slice(-REMINDER_POLICY.keepRows);
}
// 새 계획으로 바꾼다: 보낸 줄은 그대로, 보내지 않은 옛 계획은 지우고 새 계획을 적는다.
export function applyReminderPlan(state,items,now){
 const current=readReminderState(state),planned=new Map(current.entries.filter(row=>!finite(row.deliveredAt)).map(row=>[row.id,row]));
 const kept=current.entries.filter(row=>finite(row.deliveredAt));
 for(const item of Array.isArray(items)?items:[]){
  if(!id(item?.id)||kept.some(row=>row.id===item.id&&row.at===item.at))continue;
  const before=planned.get(item.id);
  kept.push({id:item.id,kind:item.kind,ref:item.ref,at:item.at,plannedAt:before&&before.at===item.at?before.plannedAt:now});
 }
 return {...current,entries:prune(kept,now)};
}
// 보냄: 그 줄에 보낸 때를 적는다(같은 알림을 두 번 적지 않는다).
export function markReminderDelivered(state,reminderId,at){
 const current=readReminderState(state);let changed=false;
 const entries=current.entries.map(row=>row.id===reminderId&&!finite(row.deliveredAt)?(changed=true,{...row,deliveredAt:at}):row);
 return changed?{...current,entries:prune(entries,at)}:current;
}
// 누름: 보낸 줄에 누른 때를 적는다. 기록에 없는 알림(다른 기기·지운 기록)은 적지 않는다.
export function markReminderOpened(state,reminderId,at){
 const current=readReminderState(state);let changed=false;
 const entries=current.entries.map(row=>row.id===reminderId&&!finite(row.openedAt)?(changed=true,{...row,deliveredAt:finite(row.deliveredAt)?row.deliveredAt:Math.min(at,row.at),openedAt:at}):row);
 return changed?{...current,entries}:current;
}
// 설정을 바꾼다. 횟수·시각을 다시 고르면 물러남을 그때부터 다시 센다(since).
export function updateReminderSettings(state,{enabled,frequency,hour}={},now){
 const current=readReminderState(state),next={...current};
 if(typeof enabled==='boolean')next.enabled=enabled;
 if(REMINDER_POLICY.frequencies.includes(frequency))next.frequency=frequency;
 if(hour===null||REMINDER_POLICY.hours.includes(hour))next.hour=hour??null;
 if(finite(now)){next.since=now;next.pauseAsked=null;}
 if(!next.enabled)next.entries=current.entries.filter(row=>finite(row.deliveredAt));
 return next;
}
// 앱 안에서 처음 묻는 답: yes면 켤 준비(OS 권한은 기기 쪽이 그 자리에서 청한다), no면 다시 묻지 않는다.
export function answerReminderAsk(state,answer,now){
 const current=readReminderState(state);if(!['yes','no'].includes(answer)||!finite(now))return current;
 return {...current,consent:{answer,at:now},...(answer==='no'?{enabled:false}:{})};
}
// 묻는 카드를 보일지: 아직 답하지 않았고, 묻는 날이 사흘을 넘지 않았고, 돌아올 것(복습 일정이나 날짜까지 정한 시험)이 있을 때만.
// 기기가 알림을 못 띄우거나 OS에서 막혀 있으면 묻지 않는다(눌러도 켤 수 없는 질문을 하지 않는다).
export function shouldAskReminders({state,now,offset,hasReturn=false,supported=false,permission='default'}={}){
 const current=readReminderState(state);
 if(!supported||permission==='denied'||current.consent||current.enabled||!hasReturn||!finite(now))return false;
 const today=reminderDayKey(now,offset);
 return current.asked.includes(today)||current.asked.length<REMINDER_POLICY.askDays;
}
export function noteReminderAsked(state,now,offset){
 const current=readReminderState(state),today=reminderDayKey(now,offset);
 return current.asked.includes(today)?current:{...current,asked:[...current.asked,today].slice(-REMINDER_POLICY.askDays)};
}
