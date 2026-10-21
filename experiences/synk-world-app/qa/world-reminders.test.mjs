// WORLD 학습 알림 계획기(world-reminders.mjs · 2026-10-19 결정 「WORLD 알림 · 주 1~2회 · 학습 일만」, 구현 명세 §4-14 인수 기준 WP29).
// 합성 학생의 복습 일정·시험 계획·공부 시각을 넣고 계획기만 돌린다(화면·OS 알림은 world-reminders-device 시험과 브라우저 확인이 본다).
// 기기 시간대는 서울(+540분)로 고정하고, 몽골(+480)·뉴욕(-300) 경우는 따로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {REMINDER_POLICY,planReminders,reminderHour,backoffLevel,readReminderState,applyReminderPlan,markReminderDelivered,markReminderOpened,
 updateReminderSettings,answerReminderAsk,shouldAskReminders,noteReminderAsked,reminderDayKey,emptyReminderState} from '../world-reminders.mjs';
import * as exam from '../world-exam-plan.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR,SEOUL=540;
// 2026-10-19(월) 0시 서울 = 10-18 15:00 UTC.
const MONDAY=Date.UTC(2026,9,18,15);
const at=(day,hour,minute=0)=>MONDAY+day*DAY+hour*HOUR+minute*MINUTE; // 서울 시각으로 월요일부터 day일 뒤 hour시
const ON={enabled:true,frequency:2,hour:null};
const localHour=(time,offset=SEOUL)=>new Date(time+offset*MINUTE).getUTCHours();
// 보낸 줄 하나(기록 꼴).
const sent=(kind,ref,time,opened=false)=>({id:`${kind}:${ref}`,kind,ref,at:time,plannedAt:time-DAY,deliveredAt:time,...(opened?{openedAt:time+MINUTE}:{})});
// 어떤 7일 창에서도 n개를 넘지 않는지(보낸 것 + 계획).
function maxInWindow(times){const sorted=[...times].sort((a,b)=>a-b);let best=0;for(let i=0;i<sorted.length;i++){let n=0;for(const t of sorted)if(t>=sorted[i]&&t<sorted[i]+7*DAY)n++;best=Math.max(best,n);}return best;}

test('꺼져 있으면 아무것도 잡지 않는다 — 기본값은 꺼짐이고 읽지 못한 기록도 꺼짐이다',()=>{
 const reviews=[at(1,10)];
 assert.deepEqual(planReminders({now:at(0,8),settings:{},reviews,offset:SEOUL}).items,[]);
 assert.deepEqual(planReminders({now:at(0,8),settings:{...ON,enabled:false},reviews,offset:SEOUL}).items,[]);
 assert.equal(readReminderState(null).enabled,false);
 assert.equal(readReminderState({version:2,enabled:true}).enabled,false);
 assert.equal(readReminderState('{"version":1,"enabled":true}').enabled,false);
});

test('돌아온 복습: 복습이 돌아온 뒤 첫 「보낼 때」에 한 번, 글은 학습 일만(잠금 화면 글 키)',()=>{
 const plan=planReminders({now:at(0,8),settings:ON,reviews:[at(1,10,30),at(3,9)],offset:SEOUL});
 assert.equal(plan.items.length,1);
 const [item]=plan.items;
 assert.equal(item.kind,'review');assert.equal(item.template,'reminder.push.review');
 // 화요일 10:30에 돌아오니 화요일 저녁 7시(기본값).
 assert.equal(item.at,at(1,19));assert.equal(plan.hourSource,'default');
 assert.equal(plan.learningEffectClaim,false);
});

test('어떤 7일 창에서도 두 번을 넘지 않고, 둘째는 그 주에만 있는 일(시험 점검)일 때만이다',()=>{
 // 복습과 계획이 모두 있어도 보통 알림은 하나다.
 const examPlan={week:exam.examWeek(at(0,8)),phase:'mid',areas:[{area:'reading',planned:3,done:0,remaining:3}]};
 const both=planReminders({now:at(0,8),settings:ON,reviews:[at(0,12)],examPlan,offset:SEOUL});
 assert.equal(both.items.length,1);assert.equal(both.items[0].kind,'review');
 // 시험일이 2주 뒤 수요일이면 시험 점검 + 보통 알림 하나 = 두 번.
 const date=reminderDayKey(at(16,12),SEOUL);
 const withExam=planReminders({now:at(0,8),settings:ON,reviews:[at(0,12)],exam:{date},examPlan,offset:SEOUL});
 assert.deepEqual(withExam.items.map(row=>row.kind).sort(),['exam','review']);
 const examItem=withExam.items.find(row=>row.kind==='exam');
 assert.equal(examItem.ref,`${date}:14`);assert.equal(examItem.template,'reminder.push.exam');
 assert.equal(examItem.at,at(2,19)); // 시험 14일 전 수요일 저녁 7시
 // 시험 점검과 복습이 같은 날에 걸리면 한꺼번에 울리지 않고 복습이 다음 날로 간다(하루에 하나).
 const sameDay=planReminders({now:at(0,8),settings:ON,reviews:[at(1,10)],exam:{date:reminderDayKey(at(15,12),SEOUL)},offset:SEOUL});
 assert.deepEqual(sameDay.items.map(row=>[row.kind,row.at]),[['exam',at(1,19)],['review',at(2,19)]]);
 // 주 한 번으로 줄인 학생은 시험 점검 하나만(그 주에만 있는 일이 먼저다).
 const once=planReminders({now:at(0,8),settings:{...ON,frequency:1},reviews:[at(0,12)],exam:{date},examPlan,offset:SEOUL});
 assert.deepEqual(once.items.map(row=>row.kind),['exam']);
 // 이미 이번 창에 보낸 두 번이 있으면 셋째는 없다 — 다음 알림은 그 창이 끝난 뒤의 첫 때다.
 const delivered=[sent('review','x',at(1,19)),sent('exam',`${date}:14`,at(2,19))];
 const busy=planReminders({now:at(3,8),settings:ON,reviews:[at(3,12)],exam:{date},examPlan,entries:delivered,offset:SEOUL});
 assert.deepEqual(busy.items.map(row=>[row.kind,row.at]),[['review',at(8,19)],['exam',at(9,19)]]);
 assert.ok(maxInWindow([...delivered.map(row=>row.deliveredAt),...busy.items.map(row=>row.at)])<=2);
});

test('합성 8주: 매주 복습이 돌아오고 시험이 있어도 어떤 7일 창에서도 세 번째 알림이 없다(WP29 ①)',()=>{
 let entries=[];const delivered=[],date=reminderDayKey(at(30,12),SEOUL);
 for(let day=0;day<56;day++){
  const now=at(day,8);
  // 생활 복습: 1·3·7일 간격처럼 매일 무언가 돌아온다(가장 바쁜 학생).
  const reviews=[now+4*HOUR,now+DAY+4*HOUR];
  const examPlan={week:exam.examWeek(now),phase:'mid',areas:[{area:'reading',planned:3,done:0,remaining:3}]};
  const plan=planReminders({now,settings:ON,reviews,exam:{date},examPlan,entries,offset:SEOUL});
  entries=applyReminderPlan({version:1,enabled:true,entries},plan.items,now).entries;
  // 오늘 안에 울릴 것만 보냈다고 적고, 학생이 눌렀다고 둔다(물러남이 끼지 않게 — 물러남은 아래 시험이 따로 본다).
  for(const item of plan.items.filter(row=>row.at<now+DAY)){entries=markReminderDelivered({version:1,entries},item.id,item.at).entries;entries=markReminderOpened({version:1,entries},item.id,item.at+HOUR).entries;delivered.push(item);}
 }
 assert.ok(delivered.length>=8,'8주 동안 알림이 온다');
 assert.ok(maxInWindow(delivered.map(row=>row.at))<=2,'7일 창 두 번');
 // 보통 알림(복습·계획)은 어떤 7일 창에서도 하나, 하루에는 하나.
 assert.ok(maxInWindow(delivered.filter(row=>row.kind!=='exam').map(row=>row.at))<=1);
 assert.equal(new Set(delivered.map(row=>reminderDayKey(row.at,SEOUL))).size,delivered.length,'하루에 두 번 울리지 않는다');
 // 시험 점검 둘은 각각 한 번씩만.
 assert.equal(delivered.filter(row=>row.kind==='exam').length,2);
 for(const row of delivered){const hour=localHour(row.at);assert.ok(hour>=9&&hour<21,'조용한 시간 밖');}
});

test('조용한 시간(밤 9시~아침 9시)에는 잡지 않는다 — 고른 시각·확인된 공부 시간대·기본값 모두(WP29 ②)',()=>{
 for(const hour of REMINDER_POLICY.hours){const plan=planReminders({now:at(0,6),settings:{...ON,hour},reviews:[at(0,7)],offset:SEOUL});assert.equal(localHour(plan.items[0].at),hour);}
 // 늘 새벽 1시에 공부한 학생: 공부 시간대는 조용한 시간 밖(아침 9시)으로 당긴다.
 const night=[...Array(6)].map((_,i)=>at(-i-1,1,10));
 assert.deepEqual(reminderHour({studyTimes:night,now:at(0,8),offset:SEOUL}),{hour:9,source:'observed'});
 // 밤 11시에 공부한 학생은 저녁 8시.
 const late=[...Array(4)].map((_,i)=>at(-i-1,23,5));
 assert.deepEqual(reminderHour({studyTimes:late,now:at(0,8),offset:SEOUL}),{hour:20,source:'observed'});
 // 사흘이 안 되면 기본값.
 assert.deepEqual(reminderHour({studyTimes:late.slice(0,2),now:at(0,8),offset:SEOUL}),{hour:19,source:'default'});
 // 몰라서 생긴 시각은 없다: 시각이 고를 수 있는 목록 밖이면 무시한다.
 assert.equal(reminderHour({hour:22,now:at(0,8),offset:SEOUL}).hour,19);
});

test('확인된 공부 시간대: 최근 28일에 같은 시각에 공부한 날이 사흘 이상이면 그 시각에 보낸다',()=>{
 const studyTimes=[at(-2,15,20),at(-3,15,40),at(-5,15,5),at(-6,20,10)];
 const plan=planReminders({now:at(0,8),settings:ON,reviews:[at(1,10)],studyTimes,offset:SEOUL});
 assert.equal(plan.hourSource,'observed');assert.equal(localHour(plan.items[0].at),15);
});

test('그날 이미 공부했으면 그날은 보내지 않는다 — 다음 날로 넘어간다(WP29 ⑤)',()=>{
 const reviews=[at(0,9)];
 const before=planReminders({now:at(0,10),settings:ON,reviews,offset:SEOUL});
 assert.equal(before.items[0].at,at(0,19));
 const after=planReminders({now:at(0,11),settings:ON,reviews,studyTimes:[at(0,10,30)],offset:SEOUL});
 assert.equal(after.items[0].at,at(1,19));assert.ok(after.notes.includes('studied-today'));
 // 지금 막 「보낼 때」를 지났으면(10분 안) 오늘은 없다.
 const passed=planReminders({now:at(0,18,55),settings:ON,reviews,offset:SEOUL});
 assert.equal(passed.items[0].at,at(1,19));
});

test('이미 알린 복습은 다시 알리지 않는다 — 새로 돌아오는 복습이 있어야 다음 복습 알림이 온다(재촉 없음)',()=>{
 const entries=[sent('review','r1',at(1,19))];
 // 화요일에 알린 뒤 아직 안 한 복습(그 전에 돌아온 것)만 있으면 없다.
 assert.deepEqual(planReminders({now:at(2,8),settings:ON,reviews:[at(1,10)],entries,offset:SEOUL}).items,[]);
 // 그 뒤에 새로 돌아오는 복습이 있으면, 보통 알림은 7일 창에 하나라 화요일 저녁 7시로부터 7일이 지난 첫 때에.
 const next=planReminders({now:at(2,8),settings:ON,reviews:[at(1,10),at(4,9)],entries,offset:SEOUL});
 assert.deepEqual(next.items.map(row=>[row.kind,row.at]),[['review',at(8,19)]]);
});

test('이번 주 계획: 남은 연습이 있으면 마지막 공부에서 이틀 뒤부터 그 주 안에서 한 번, 다 했으면 없다',()=>{
 const week=exam.examWeek(at(0,8)),examPlan=areas=>({week,phase:'mid',areas});
 const open=planReminders({now:at(0,8),settings:ON,examPlan:examPlan([{area:'reading',planned:3,done:1,remaining:2}]),studyTimes:[at(-1,20)],offset:SEOUL});
 assert.equal(open.items[0].kind,'plan');assert.equal(open.items[0].template,'reminder.push.plan');
 assert.equal(open.items[0].at,at(1,19)); // 일요일 밤 8시 공부 → 이틀 뒤인 화요일 저녁 7시
 assert.equal(open.items[0].ref,String(week.start));
 assert.deepEqual(planReminders({now:at(0,8),settings:ON,examPlan:examPlan([{area:'reading',planned:3,done:3,remaining:0}]),offset:SEOUL}).items,[]);
 // 그 주에 이미 보냈으면 다시 없다.
 assert.deepEqual(planReminders({now:at(3,8),settings:ON,examPlan:examPlan([{area:'reading',planned:3,done:1,remaining:2}]),entries:[sent('plan',String(week.start),at(1,19))],offset:SEOUL}).items,[]);
 // 일요일 밤에는 다음 주로 넘기지 않는다(그 주의 계획 이야기다).
 assert.deepEqual(planReminders({now:at(6,20),settings:ON,examPlan:examPlan([{area:'reading',planned:3,done:0,remaining:3}]),offset:SEOUL}).items,[]);
 // 시험이 지난 계획은 알리지 않는다.
 assert.deepEqual(planReminders({now:at(0,8),settings:ON,examPlan:{week,phase:'past',areas:[{area:'reading',planned:3,done:0,remaining:3}]},offset:SEOUL}).items,[]);
});

test('시험일 2주·1주 전 점검: 날까지 정한 시험만, 한 번씩, 그날 막히면 다음 날까지만, 지난 시험은 없다',()=>{
 const date=reminderDayKey(at(15,12),SEOUL); // 3주차 화요일
 const two=planReminders({now:at(0,8),settings:ON,exam:{date},offset:SEOUL});
 assert.deepEqual(two.items.map(row=>[row.kind,row.ref,row.at]),[['exam',`${date}:14`,at(1,19)]]);
 const one=planReminders({now:at(7,8),settings:ON,exam:{date},entries:[sent('exam',`${date}:14`,at(1,19))],offset:SEOUL});
 assert.deepEqual(one.items.map(row=>[row.ref,row.at]),[[`${date}:7`,at(8,19)]]);
 // 그날 공부했으면 다음 날 저녁.
 const studied=planReminders({now:at(1,12),settings:ON,exam:{date},studyTimes:[at(1,11)],offset:SEOUL});
 assert.equal(studied.items[0].at,at(2,19));
 // 다음 날도 지나면 2주 전 점검은 건너뛰고(늦게 말하지 않는다), 1주 전 점검만 남는다.
 assert.deepEqual(planReminders({now:at(2,20),settings:ON,exam:{date},offset:SEOUL}).items.map(row=>[row.ref,row.at]),[[`${date}:7`,at(8,19)]]);
 // 달만 정한 시험은 2주 전을 모르므로 없다.
 assert.deepEqual(planReminders({now:at(0,8),settings:ON,exam:{date:date.slice(0,7)},offset:SEOUL}).items,[]);
 // 시험 뒤에는 없다.
 assert.deepEqual(planReminders({now:at(16,8),settings:ON,exam:{date},offset:SEOUL}).items,[]);
});

test('시험 점검 둘 사이에 보통 알림 하나: 첫 점검이 몇 분 늦게 떠도 자리는 그대로이고, 7일 밖의 점검도 미리 자리를 잡는다',()=>{
 const date=reminderDayKey(at(15,12),SEOUL); // 2주 전 = 화요일(1일), 1주 전 = 다음 화요일(8일)
 // 첫 점검이 30초 늦게 떴어도(앱이 잠깐 잠듦) 그 사이 복습 하나는 들어간다 — 창은 잡았던 때(저녁 7시 정각)로 센다.
 const late=planReminders({now:at(1,20),settings:ON,reviews:[at(1,10)],exam:{date},entries:[{...sent('exam',`${date}:14`,at(1,19)+30000),at:at(1,19)}],offset:SEOUL});
 assert.deepEqual(late.items.map(row=>[row.kind,row.at]),[['review',at(2,19)],['exam',at(8,19)]]);
 // 1주 전 점검이 아직 7일 밖이어도 자리를 잡아 두어, 보통 알림이 그 창을 넘지 않게 한다(잡았다가 나중에 거두지 않는다).
 // 2주 전 점검이 하루 밀려(그날 공부함) 1주 전 점검과 6일 간격이면, 그 사이에는 보통 알림이 들어가지 않는다.
 const moved=planReminders({now:at(1,12),settings:ON,reviews:[at(1,10)],exam:{date},studyTimes:[at(1,11)],offset:SEOUL});
 assert.deepEqual(moved.items.map(row=>[row.kind,row.at]),[['exam',at(2,19)]]);assert.ok(moved.notes.includes('cap.review'));
 const after=planReminders({now:at(8,20),settings:ON,reviews:[at(1,10)],exam:{date},entries:[{...sent('exam',`${date}:14`,at(2,19)),at:at(2,19)},{...sent('exam',`${date}:7`,at(8,19)),at:at(8,19)}],offset:SEOUL});
 assert.deepEqual(after.items.map(row=>[row.kind,row.at]),[['review',at(9,19)]],'둘째 점검 다음 날부터는 복습이 온다');
});

test('기기 시간대를 따른다: 몽골·뉴욕 학생도 그 지역의 저녁 7시, 조용한 시간 밖',()=>{
 for(const offset of [480,-300,0]){
  const plan=planReminders({now:at(0,8),settings:ON,reviews:[at(1,10)],offset});
  assert.equal(plan.items.length,1);assert.equal(localHour(plan.items[0].at,offset),19);
 }
});

test('물러남: 열지 않은 알림이 이어서 셋이면 주 한 번, 다시 셋이면 멈춘다 — 누르면 이어진 수를 다시 센다',()=>{
 const week=n=>at(n*7+1,19);
 const unopened=[0,1,2].map(n=>sent('review',`u${n}`,week(n)));
 assert.equal(backoffLevel({entries:unopened.slice(0,2),now:week(3)}),0);
 assert.equal(backoffLevel({entries:unopened,now:week(3)}),1);
 // 줄이면 주 두 번을 고른 학생도 시험 점검과 복습이 겹친 주에 하나만 받는다.
 const date=reminderDayKey(at(37,12),SEOUL);
 const reduced=planReminders({now:at(21,8),settings:ON,entries:unopened,reviews:[at(21,12)],exam:{date},offset:SEOUL});
 assert.equal(reduced.cap,1);assert.equal(reduced.items.length,1);assert.ok(reduced.notes.includes('reduced'));
 const six=[...unopened,...[3,4,5].map(n=>sent('review',`u${n}`,week(n)))];
 assert.equal(backoffLevel({entries:six,now:week(6)}),2);
 const paused=planReminders({now:week(6),settings:ON,entries:six,reviews:[week(6)+DAY],offset:SEOUL});
 assert.deepEqual(paused.items,[]);assert.ok(paused.notes.includes('paused'));
 // 중간에 하나를 눌렀으면 이어진 수가 끊긴다.
 const mixed=[sent('review','a',week(0)),sent('review','b',week(1),true),sent('review','c',week(2)),sent('review','d',week(3))];
 assert.equal(backoffLevel({entries:mixed,now:week(4)}),0);
 // 보낸 지 하루가 안 된 알림은 아직 「열지 않음」으로 세지 않는다.
 assert.equal(backoffLevel({entries:unopened,now:week(2)+HOUR}),0);
 // 설정을 다시 고르면 그때부터 센다.
 assert.equal(backoffLevel({entries:six,now:week(6),since:week(5)+HOUR}),0);
});

test('알림 기록: 보낸 것·누른 것만 남고, 보내지 않은 옛 계획은 다시 잡을 때 지운다',()=>{
 const now=at(0,8);
 let state=applyReminderPlan(emptyReminderState(),[{id:'review:1',kind:'review',ref:'1',at:at(1,19)}],now);
 assert.equal(state.entries.length,1);assert.equal(state.entries[0].plannedAt,now);
 // 새 계획이 바뀌면 옛 계획은 사라진다.
 state=applyReminderPlan(state,[{id:'review:2',kind:'review',ref:'2',at:at(2,19)}],now+HOUR);
 assert.deepEqual(state.entries.map(row=>row.id),['review:2']);
 state=markReminderDelivered(state,'review:2',at(2,19));
 state=markReminderDelivered(state,'review:2',at(2,19)+5*MINUTE);
 assert.equal(state.entries[0].deliveredAt,at(2,19),'두 번 적지 않는다');
 state=markReminderOpened(state,'review:2',at(2,20));
 assert.equal(state.entries[0].openedAt,at(2,20));
 // 다음 계획이 와도 보낸 줄은 남는다.
 state=applyReminderPlan(state,[],at(3,8));
 assert.deepEqual(state.entries.map(row=>[row.id,row.deliveredAt,row.openedAt]),[['review:2',at(2,19),at(2,20)]]);
 // 기록에 없는 알림을 눌렀다고 적지 않는다.
 assert.deepEqual(markReminderOpened(state,'review:9',at(4,8)).entries,state.entries);
 // 끄면 남은 예약이 바로 지워진다(WP29 ④).
 const planned=applyReminderPlan(state,[{id:'plan:9',kind:'plan',ref:'9',at:at(4,19)}],at(3,9));
 assert.deepEqual(updateReminderSettings(planned,{enabled:false},at(3,10)).entries.map(row=>row.id),['review:2']);
});

test('앱 안에서 묻기: 돌아올 것이 있을 때만, 사흘까지, 거절하면 다시 묻지 않고 설정에서 켠다',()=>{
 const now=at(0,10),base={now,offset:SEOUL,hasReturn:true,supported:true,permission:'default'};
 let state=emptyReminderState();
 assert.equal(shouldAskReminders({...base,state}),true);
 assert.equal(shouldAskReminders({...base,state,hasReturn:false}),false,'돌아올 것이 없으면 묻지 않는다');
 assert.equal(shouldAskReminders({...base,state,supported:false}),false,'알림을 못 띄우는 기기');
 assert.equal(shouldAskReminders({...base,state,permission:'denied'}),false,'OS에서 막힌 기기');
 for(const day of [0,1,2])state=noteReminderAsked(state,at(day,10),SEOUL);
 assert.equal(shouldAskReminders({...base,state,now:at(2,15)}),true,'같은 날은 계속 보인다');
 assert.equal(shouldAskReminders({...base,state,now:at(3,10)}),false,'나흘째는 묻지 않는다');
 const declined=answerReminderAsk(emptyReminderState(),'no',now);
 assert.equal(shouldAskReminders({...base,state:declined}),false);
 assert.equal(declined.enabled,false);
 // 거절한 뒤에도 설정에서 켜면 켜진다.
 const turnedOn=updateReminderSettings(declined,{enabled:true},at(5,10));
 assert.equal(planReminders({now:at(5,10),settings:turnedOn,reviews:[at(6,9)],offset:SEOUL}).items.length,1);
});

test('잠금 화면 글: 세 언어가 있고, 일의 종류·약점·급수·점수·이름·남은 수·연속 기록이 없다(WP29 ③)',()=>{
 for(const key of ['reminder.push.review','reminder.push.plan','reminder.push.exam','reminder.push.title']){
  const entry=STRINGS[key];assert.ok(entry,key);
  for(const lang of ['ko','en','mn']){
   const text=entry[lang];assert.ok(typeof text==='string'&&text.trim(),`${key} ${lang}`);
   assert.doesNotMatch(text,/\{|\d/,'값 자리·숫자 없음(점수·급수·남은 수·날짜)');
   assert.doesNotMatch(text,/시험|TOPIK|토픽|급|점수|약점|틀린|놓친|연속|며칠|빠진|test|exam|level|score|weak|streak|missed|шалгалт|түвшин|оноо|сул/i,'일의 종류·급수·점수·약점·연속 기록 없음');
  }
 }
 // 한국어 틀은 학습 일만 말한다(10-19 결정의 예문 그대로).
 assert.equal(STRINGS['reminder.push.review'].ko,'다시 만날 표현이 돌아왔어요.');
});
