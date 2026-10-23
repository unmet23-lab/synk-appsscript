// WORLD 학습 알림 2단(앱을 닫아도 받기 · qa/push-reminders-20261022/설계.md §5) — 계획기에 더한 순수 함수.
// 기기가 보내는 요약(reminderDigest)을 서버가 되살려(digestInputs) 세운 계획이 기기 계획과 같은지 무작위 300벌로 보고,
// 기기 tick과 서버 보내기가 같이 쓰는 「지금 띄울 것」(dueReminder), 1단 ↔ 2단을 오갈 때의 기록 넘기기(handoverEntries·mergeReminderEntries)를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {REMINDER_POLICY,planReminders,reminderHour,dueReminder,handoverEntries,mergeReminderEntries,reminderDigest,digestInputs,
 readReminderState,applyReminderPlan,markReminderDelivered,markReminderOpened,emptyReminderState,backoffLevel} from '../world-reminders.mjs';
import {examWeek} from '../world-exam-plan.mjs';

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR,SEOUL=540;
const MONDAY=Date.UTC(2026,9,18,15); // 2026-10-19(월) 0시 서울
const at=(day,hour,minute=0)=>MONDAY+day*DAY+hour*HOUR+minute*MINUTE;
const ON={enabled:true,frequency:2,hour:null};
const sent=(kind,ref,time,opened=false)=>({id:`${kind}:${ref}`,kind,ref,at:time,plannedAt:time-DAY,deliveredAt:time,...(opened?{openedAt:time+MINUTE}:{})});
// 뉴욕(서머타임이 11-01 06:00 UTC에 끝난다): 그 전 -240, 그 뒤 -300.
const NEW_YORK=time=>time<Date.UTC(2026,10,1,6)?-240:-300;
// 시험이 다시 돌아도 같은 수가 나오게 고정 씨앗 난수(mulberry32).
function random(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

test('studyHour: 서버가 받은 공부 시간대를 「확인된 시간대」로 쓴다 — 고른 시각이 먼저이고, 조용한 시간 안의 값은 버린다',()=>{
 const now=at(0,8);
 assert.deepEqual(reminderHour({now,studyHour:15,offset:SEOUL}),{hour:15,source:'observed'});
 assert.deepEqual(reminderHour({now,hour:9,studyHour:15,offset:SEOUL}),{hour:9,source:'chosen'});
 for(const bad of [8,21,3,15.5,'15',null])assert.deepEqual(reminderHour({now,studyHour:bad,offset:SEOUL}),{hour:19,source:'default'},String(bad));
 // 계획기도 같은 값을 쓴다(기기는 넘기지 않아 1단과 같다).
 const plan=planReminders({now,settings:ON,reviews:[at(1,10)],studyHour:15,offset:SEOUL});
 assert.equal(plan.hour,15);assert.equal(plan.hourSource,'observed');assert.equal(plan.items[0].at,at(1,15));
});

test('dueReminder: 보내는 그때의 물러남·한도를 다시 본다 — 잡은 뒤 「줄임」이 되면 그 주 한도를 넘는 알림은 띄우지 않는다(10-22 아르곤 A3)',()=>{
 // 안 연 알림: 1일 복습 · 2일 시험 점검(14일 전) · 9일 저녁 7시 시험 점검(7일 전). 10일 저녁 7시 복습을 아침에 잡을 때는 9일 것이 아직 하루가
 // 안 지나 「안 연 알림 둘」(단계 0, 한 주 두 번)이었고, 보낼 때는 하루가 지나 「셋」(단계 1, 한 주 한 번)이 된다.
 const pending={id:'review:9',kind:'review',ref:'9',at:at(10,19),plannedAt:at(10,9)};
 const rows=[sent('review','1',at(1,19)),sent('exam','2026-11-02:14',at(2,19)),sent('exam','2026-11-02:7',at(9,19)),pending];
 const state=readReminderState({...emptyReminderState(),...ON,entries:rows});
 assert.equal(backoffLevel({entries:rows,now:at(10,9)}),0,'아침에는 단계 0');
 const morning=planReminders({now:at(10,9),settings:state,entries:rows.filter(row=>row.deliveredAt),reviews:[at(9,10)],offset:SEOUL,leadMs:0});
 assert.deepEqual(morning.items.map(row=>row.at),[at(10,19)],'아침 계획에는 든다');
 assert.equal(backoffLevel({entries:rows,now:at(10,19)}),1,'보낼 때는 단계 1');
 assert.deepEqual(dueReminder({state,now:at(10,19),offset:SEOUL}),{entry:null,skip:'cap'});
 // 그 사이 하나라도 열었으면(이어진 수가 끊긴다) 그대로 보낸다.
 const opened=readReminderState({...state,entries:rows.map(row=>row.id==='exam:2026-11-02:7'?{...row,openedAt:at(9,20)}:row)});
 assert.equal(dueReminder({state:opened,now:at(10,19),offset:SEOUL}).entry.id,'review:9');
 // 안 연 알림이 다시 셋 이어지면(모두 하루가 지나) 멈춤 — 띄우지 않는다.
 const paused=readReminderState({...state,entries:[...['1','3','5','8','10','12'].map((ref,i)=>sent('review',ref,at(i*2,19))),{...pending,at:at(13,19)}]});
 assert.deepEqual(dueReminder({state:paused,now:at(13,19),offset:SEOUL}),{entry:null,skip:'paused'});
});

test('주 한 번으로 줄여도(직접·물러남) 7일 밖의 지난 기록은 새 알림을 막지 않는다 — 새 알림을 품는 창만 센다(10-22 GPT GA1)',()=>{
 // 10-12 시험 점검 · 10-13 복습(주 두 번이던 때, 둘 다 열었다) → 10-22에 주 한 번으로 바꿈 → 10-23 저녁 7시 복습이 잡힌다.
 const rows=[sent('exam','2026-10-26:14',at(-7,19),true),sent('review','x',at(-6,19),true)];
 const plan=planReminders({now:at(3,10),settings:{enabled:true,frequency:1,hour:null},entries:rows,reviews:[at(4,10)],offset:SEOUL});
 assert.deepEqual(plan.items.map(row=>[row.kind,row.at]),[['review',at(4,19)]]);
 // 7일 안이면 여전히 막는다(주 한 번): 10-17 복습을 열었어도 10-23은 7일 안.
 const near=planReminders({now:at(3,10),settings:{enabled:true,frequency:1,hour:null},entries:[sent('review','y',at(-2,19),true)],reviews:[at(4,10)],offset:SEOUL});
 assert.deepEqual(near.items.map(row=>row.at),[at(5,19)],'정확히 7일 뒤(창은 반열림)');
 // 보낼 때 다시 보는 한도도 같다.
 const state=readReminderState({...emptyReminderState(),enabled:true,frequency:1,entries:[...rows,{id:'review:4',kind:'review',ref:'4',at:at(4,19),plannedAt:at(3,10)}]});
 assert.equal(dueReminder({state,now:at(4,19),offset:SEOUL}).entry?.id,'review:4');
});

test('요약에는 지난 시험일을 싣지 않는다 — 서버가 오래된 날을 거절해 켜기가 막히지 않게, 계획은 같다(10-22 GPT GA3)',()=>{
 const now=at(3,10),inputs={reviews:[at(4,10)],studyTimes:[at(2,9)],lang:'ko',timeZone:'Asia/Seoul'};
 assert.equal(reminderDigest({...inputs,exam:{date:'2026-08-01'}},{now,offset:SEOUL}).examDate,null);
 assert.equal(reminderDigest({...inputs,exam:{date:'2026-10-21'}},{now,offset:SEOUL}).examDate,null,'어제');
 assert.equal(reminderDigest({...inputs,exam:{date:'2026-10-22'}},{now,offset:SEOUL}).examDate,'2026-10-22','오늘은 싣는다');
 assert.equal(reminderDigest({...inputs,exam:{date:'2026-11-05'}},{now,offset:SEOUL}).examDate,'2026-11-05');
 for(const date of ['2026-08-01','2026-10-21','2026-10-22','2026-10-27']){
  const full=planReminders({now,settings:ON,reviews:inputs.reviews,exam:{date},studyTimes:inputs.studyTimes,offset:SEOUL});
  const back=digestInputs(reminderDigest({...inputs,exam:{date}},{now,offset:SEOUL}),{offset:SEOUL});
  const server=planReminders({now,settings:ON,...back,offset:SEOUL});
  assert.deepEqual(server.items.map(row=>[row.kind,row.at]),full.items.map(row=>[row.kind,row.at]),date);
 }
});

test('mergeReminderEntries: 다른 쪽 시계가 조금 앞선 보낸 줄도 받아 지금으로 줄인다 — 하루 넘게 앞선 줄은 받지 않는다(10-22 아르곤 A1)',()=>{
 const now=at(3,19),state=readReminderState({...emptyReminderState(),...ON});
 const ahead={...sent('review','5',now+5*MINUTE),openedAt:now+6*MINUTE};
 const merged=mergeReminderEntries(state,[ahead,sent('review','6',now+2*DAY)],now);
 assert.deepEqual(merged.entries.map(row=>[row.id,row.deliveredAt,row.openedAt]),[['review:5',now,now]]);
 // 그날 보낸 것으로 센다(하루 하나).
 const later=readReminderState({...merged,entries:[...merged.entries,{id:'plan:1',kind:'plan',ref:'1',at:now+HOUR,plannedAt:now}]});
 assert.equal(dueReminder({state:later,now:now+HOUR,offset:SEOUL}).skip,'today');
});

test('dueReminder: 때가 된 것 하나 — 꺼짐·조용한 시간·45분 넘게 늦음·그날 공부함·그날 보냄이면 없다',()=>{
 const planned=(time,kind='review',ref=String(time/MINUTE))=>({id:`${kind}:${ref}`,kind,ref,at:time,plannedAt:time-HOUR});
 const state={...emptyReminderState(),enabled:true,entries:[planned(at(1,19)),planned(at(2,19),'plan','w')]};
 assert.deepEqual(dueReminder({state,now:at(1,18,59),offset:SEOUL}),{entry:null,skip:'none'});
 assert.equal(dueReminder({state,now:at(1,19),offset:SEOUL}).entry.id,`review:${at(1,19)/MINUTE}`);
 assert.equal(dueReminder({state,now:at(1,19,45),offset:SEOUL}).entry.id,`review:${at(1,19)/MINUTE}`,'45분까지는 늦어도 띄운다');
 assert.equal(dueReminder({state,now:at(1,19,46),offset:SEOUL}).skip,'none','45분 넘게 늦으면 띄우지 않는다');
 assert.equal(dueReminder({state:{...state,enabled:false},now:at(1,19),offset:SEOUL}).skip,'off');
 // 조용한 시간(기기 시각 21시~9시)에는 계획이 있어도 띄우지 않는다.
 const night={...state,entries:[planned(at(1,20,50))]};
 assert.equal(dueReminder({state:night,now:at(1,21,5),offset:SEOUL}).skip,'quiet');
 // 그날 공부했으면 쉰다(공부 시각은 때가 된 알림이 있을 때만 읽는다).
 let reads=0;const times=()=>{reads+=1;return [at(1,8)];};
 assert.equal(dueReminder({state,now:at(1,18),offset:SEOUL,studyTimes:times}).skip,'none');assert.equal(reads,0);
 assert.equal(dueReminder({state,now:at(1,19),offset:SEOUL,studyTimes:times}).skip,'studied');assert.equal(reads,1);
 assert.equal(dueReminder({state,now:at(1,19),offset:SEOUL,studyTimes:[at(0,22)]}).entry?.kind,'review','어제 공부는 상관없다');
 // 그날 이미 보냈으면 둘째는 없다(하루 하나).
 const busy={...state,entries:[...state.entries,sent('exam','2026-11-03:14',at(1,9))]};
 assert.equal(dueReminder({state:busy,now:at(1,19),offset:SEOUL}).skip,'today');
 // 두 나라 시각: 같은 순간이 서울은 저녁 7시, 뉴욕은 아침 6시(조용한 시간).
 assert.equal(dueReminder({state,now:at(1,19),offset:NEW_YORK}).skip,'quiet');
});

test('기록 넘기기: 보낸 줄 전부가 넘어가고, 같은 알림은 하나 — 누른 때는 채우고, 보내지 않은 계획은 보낸 줄로 바뀐다',()=>{
 const now=at(20,12);
 const device={...emptyReminderState(),enabled:true,entries:[sent('review','1',at(1,19),true),sent('plan','w1',at(9,19)),sent('review','2',at(16,19)),
  {id:'exam:2026-11-30:14',kind:'exam',ref:'2026-11-30:14',at:at(22,19),plannedAt:now}]};
 const rows=handoverEntries(device,now);
 assert.deepEqual(rows.map(row=>row.id),['review:1','plan:w1','review:2'],'계획만 있는 줄은 넘기지 않는다');
 assert.ok(rows.every(row=>Object.keys(row).every(key=>['id','kind','ref','at','plannedAt','deliveredAt','openedAt'].includes(key))),'줄에는 id·종류·ref·때만');
 const server=mergeReminderEntries({...emptyReminderState(),enabled:true,entries:[{id:'review:2',kind:'review',ref:'2',at:at(16,19),plannedAt:at(15,10)}]},rows,now);
 assert.deepEqual(server.entries.map(row=>[row.id,Number.isFinite(row.deliveredAt)]),[['review:1',true],['plan:w1',true],['review:2',true]]);
 // 다시 넘겨도 늘지 않고, 늦게 안 누름은 채운다.
 const again=mergeReminderEntries(server,[{...rows[2],openedAt:at(17,8)}],now);
 assert.equal(again.entries.length,3);assert.equal(again.entries[2].openedAt,at(17,8));
 // 시계 오차(하루)보다 앞선 줄·12주 넘은 줄·모양이 틀린 줄은 받지 않는다.
 const odd=mergeReminderEntries(emptyReminderState(),[sent('review','f',now+REMINDER_POLICY.skewMs+HOUR),sent('review','o',now-90*DAY),{id:'x',kind:'secret'},null],now);
 assert.equal(odd.entries.length,0);
 // 넘겨받은 쪽의 물러남·7일 창이 넘긴 쪽과 같다.
 const settings={enabled:true,frequency:2,hour:null,since:null};
 assert.equal(backoffLevel({entries:mergeReminderEntries(emptyReminderState(),handoverEntries(device,now),now).entries,now}),backoffLevel({entries:device.entries,now}));
 const plan=state=>planReminders({now,settings,entries:state.entries,reviews:[at(19,10)],offset:SEOUL}).items.map(({kind,at:time})=>[kind,time]);
 assert.deepEqual(plan(mergeReminderEntries(emptyReminderState(),handoverEntries(device,now),now)),plan(device));
});

test('요약에는 정해진 칸만 있고 크기가 정해져 있다 — 배운 내용·점수·남은 수·영역은 싣지 않는다',()=>{
 const now=at(3,12),reviews=[...Array(200)].map((_,i)=>at(-40+i*0.4,10,i%60));
 const examPlan={week:examWeek(now),phase:'near',areas:[{area:'reading',planned:3,done:1,remaining:2,classwork:[{title:'읽기 과제 3주차'}]}],reach:{confirmed:4},homework:[{skillId:'ko.reading.main'}]};
 const digest=reminderDigest({reviews,exam:{date:'2026-11-29',type:'topik1',grade:2},examPlan,studyTimes:[at(2,19),at(1,19),at(0,19),now+HOUR],lang:'mn',timeZone:'Asia/Ulaanbaatar'},{now,offset:480});
 assert.deepEqual(Object.keys(digest).sort(),['examDate','lang','lastStudyDay','planWeek','reviews','studyHour','timeZone']);
 assert.ok(digest.reviews.length<=REMINDER_POLICY.digest.reviews);
 assert.equal(digest.reviews.filter(time=>time<=now).length,1,'지난 복습은 가장 늦은 하나만');
 assert.ok(digest.reviews.every(time=>time%(15*MINUTE)===0),'15분 단위');
 assert.deepEqual(digest.planWeek,examWeek(now));assert.equal(digest.examDate,'2026-11-29');
 assert.equal(digest.lastStudyDay,'2026-10-21','앞날의 공부 시각은 버리고, 날짜만(울란바토르 달력)');assert.equal(digest.lang,'mn');
 assert.equal(JSON.stringify(digest).match(/topik|grade|reading|읽기|confirmed|skill/i),null);
 // 남은 연습이 없거나 시험이 지났으면 그 주를 보내지 않는다. 월만 아는 시험일도 보내지 않는다.
 assert.equal(reminderDigest({examPlan:{...examPlan,areas:[{remaining:0}]}},{now,offset:SEOUL}).planWeek,null);
 assert.equal(reminderDigest({examPlan:{...examPlan,phase:'past'}},{now,offset:SEOUL}).planWeek,null);
 assert.equal(reminderDigest({exam:{date:'2026-12'}},{now,offset:SEOUL}).examDate,null);
 assert.equal(reminderDigest({lang:'ja'},{now,offset:SEOUL}).lang,'ko');
 // 되살리기는 틀린 칸을 비운다.
 assert.deepEqual(digestInputs({reviews:['x',1],examDate:'2026-13',planWeek:{start:5,end:1},lastStudyDay:'21-10-2026',studyHour:23},{offset:SEOUL}),{reviews:[1],exam:null,examPlan:null,studyTimes:[],studyHour:null});
 // 마지막으로 공부한 날은 그 지역 그날 0시로 되살린다.
 assert.deepEqual(digestInputs({lastStudyDay:'2026-10-21'},{offset:SEOUL}).studyTimes,[at(2,0)]);
});

test('요약으로 세운 서버 계획 = 기기 계획 — 무작위 600벌(서울·울란바토르·카트만두·뉴욕 서머타임), 때·종류·시각·한도·물러남이 같다',()=>{
 const next=random(20261022),pick=list=>list[Math.floor(next()*list.length)],int=(a,b)=>a+Math.floor(next()*(b-a+1));
 const offsets=[SEOUL,480,345,NEW_YORK];
 const offsetAt=(offset,time)=>typeof offset==='function'?offset(time):offset;
 // 그 지역 정시(보낼 자리)에서 앞뒤 몇십 초 — 자리 바로 뒤에 돌아온 복습이 그 자리를 못 잡는 경계를 일부러 많이 만든다(Fable 설계 검토 P1-1b).
 const nearSlot=(offset,now)=>{const local=now+offsetAt(offset,now)*MINUTE,day=Math.floor(local/DAY)+int(-10,8),hour=pick([9,12,15,18,19,20]);
  const time=day*DAY+hour*HOUR;return time-offsetAt(offset,time)*MINUTE+int(-90,90)*1000;};
 let checked=0,withItems=0,kinds=new Set();
 for(let round=0;round<600;round++){
  // 뉴욕 서머타임이 끝나는 11-01 앞뒤도 지나게 지금을 10-19~11-08에서 고른다.
  const offset=pick(offsets),now=MONDAY+int(0,20)*DAY+int(0,23)*HOUR+int(0,59)*MINUTE+int(0,59)*1000;
  // 복습이 없는 판도 섞는다(보통 알림 자리는 하나라 복습이 있으면 「이번 주 연습」이 거의 나오지 않는다). 7일 넘게 지난 복습·60개 넘는 목록·자리 경계도.
  const reviews=next()<0.3?[]:[...Array(int(1,140))].map(()=>next()<0.4?nearSlot(offset,now):now+Math.round((next()*70-40)*DAY));
  const examDay=new Date(now+int(-5,40)*DAY).toISOString().slice(0,10);
  const exam=next()<0.5?{date:examDay}:next()<0.5?{date:examDay.slice(0,7)}:null;
  const examPlan=next()<0.6?{week:examWeek(now),phase:pick(['near','far','mid','past','none']),areas:[{remaining:int(0,2)},{remaining:int(0,1)}]}:null;
  // 공부 시각: 몇 시각에 몰아서(공부 시간대가 생기게) + 흩어진 것 + 앞날 것.
  const favourite=int(6,22),studyTimes=[...Array(int(0,40))].map(()=>next()<0.6?now-int(0,30)*DAY+(favourite-new Date(now+(typeof offset==='function'?offset(now):offset)*MINUTE).getUTCHours())*HOUR:now-Math.round(next()*35*DAY))
   .concat(next()<0.3?[now+HOUR]:[]);
  const entries=[];
  for(let i=0;i<int(0,6);i++){
   // 지난 복습 알림이 어떤 복습과 몇 초 차이로 보내진 경우도 섞는다(「이미 알린 복습」의 경계).
   const near=reviews.length&&next()<0.3?reviews[int(0,reviews.length-1)]+int(-30,30)*1000:null;
   const time=near!==null&&near<now?near:now-Math.round(next()*30*DAY)-HOUR,kind=near!==null&&near<now?'review':pick(['review','plan','exam']);
   entries.push(sent(kind,kind==='review'?String(Math.floor(time/MINUTE)):kind==='plan'?String(examWeek(time).start):`${examDay}:${pick([14,7])}`,time,next()<0.3));}
  const settings={enabled:true,frequency:pick([1,2]),hour:pick([null,null,9,12,15,18,20]),since:next()<0.3?now-int(1,20)*DAY:null};
  const device=planReminders({now,settings,entries,reviews,exam,examPlan,studyTimes,offset});
  const digest=reminderDigest({reviews,exam,examPlan,studyTimes,lang:'ko'},{now,offset});
  const server=planReminders({now,settings,entries,...digestInputs(JSON.parse(JSON.stringify(digest)),{offset}),offset});
  const shape=plan=>plan.items.map(item=>({kind:item.kind,at:item.at,template:item.template,...(item.kind==='review'?{}:{ref:item.ref})}));
  assert.deepEqual(shape(server),shape(device),`round ${round}`);
  for(const key of ['cap','level','hour','hourSource'])assert.equal(server[key],device[key],`round ${round} ${key}`);
  assert.deepEqual(server.notes,device.notes,`round ${round} notes`);
  checked+=1;if(device.items.length)withItems+=1;for(const item of device.items)kinds.add(item.kind);
 }
 assert.equal(checked,600);assert.ok(withItems>=200,`계획이 있는 판이 충분하다(${withItems})`);
 assert.deepEqual([...kinds].sort(),['exam','plan','review']);
});

test('복습 때 15분 정규화: 정시 바로 뒤에 돌아온 복습은 기기·서버 모두 그 정시를 못 잡는다 · 켠 날은 내일부터(notBefore)',()=>{
 const now=at(1,9);
 // 화요일 19:00:30에 돌아오는 복습 — 1단도 요약도 수요일 저녁 7시다(전에는 요약이 분으로 내려 화요일 7시를 잡을 수 있었다).
 const reviews=[at(1,19)+30000];
 const device=planReminders({now,settings:ON,reviews,offset:SEOUL});
 const server=planReminders({now,settings:ON,...digestInputs(reminderDigest({reviews},{now,offset:SEOUL}),{offset:SEOUL}),offset:SEOUL});
 assert.equal(device.items[0].at,at(2,19));assert.equal(server.items[0].at,at(2,19));
 // 정확히 정시에 돌아온 복습은 그 정시를 잡는다(정규화로 바뀌지 않는다).
 assert.equal(planReminders({now,settings:ON,reviews:[at(1,19)],offset:SEOUL}).items[0].at,at(1,19));
 // notBefore: 그때 전의 자리는 쓰지 않는다(시험 점검 자리도).
 const tomorrow=at(2,0);
 const later=planReminders({now,settings:ON,reviews:[at(1,10)],notBefore:tomorrow,offset:SEOUL});
 assert.equal(later.items[0].at,at(2,19));
 assert.equal(planReminders({now,settings:ON,reviews:[at(1,10)],offset:SEOUL}).items[0].at,at(1,19),'notBefore가 없으면 1단 그대로');
});

test('넘긴 뒤에도 같은 규칙: 2단으로 넘어간 다음 서버가 보내고 다시 1단으로 돌아와도 어떤 7일 창에도 셋째가 없고 하루 하나다',()=>{
 // 기기 1단이 한 번 보낸 뒤 2단을 켜고(기록 넘김), 서버가 30일을 15분마다 돌며 보낸 다음, 끄고 1단으로 돌아와 2주를 더 돈다.
 const offset=SEOUL,settings={...ON};
 let device=readReminderState({...emptyReminderState(),...settings,entries:[sent('review',String(at(0,19)/MINUTE),at(0,19))]});
 const reviews=[...Array(40)].map((_,i)=>at(i,10)),examDay='2026-11-23';
 const inputs=now=>({reviews,exam:{date:examDay},examPlan:{week:examWeek(now),phase:'near',areas:[{remaining:1}]},studyTimes:[]});
 const run=(state,from,days,{digest})=>{
  for(let now=from;now<from+days*DAY;now+=15*MINUTE){
   const input=digest?digestInputs(reminderDigest(inputs(now),{now,offset}),{offset}):inputs(now);
   const due=dueReminder({state,now,offset,studyTimes:input.studyTimes});
   if(due.entry)state=markReminderDelivered(state,due.entry.id,now);
   state=applyReminderPlan(state,planReminders({now,settings:state,entries:state.entries,...input,offset}).items,now);
  }
  return state;
 };
 let server=mergeReminderEntries(readReminderState({...emptyReminderState(),...settings}),handoverEntries(device,at(1,8)),at(1,8));
 server=run(server,at(1,8),30,{digest:true});
 device=mergeReminderEntries(device,handoverEntries(server,at(31,8)),at(31,8));
 device=run(device,at(31,8),14,{digest:false});
 const times=device.entries.filter(row=>Number.isFinite(row.deliveredAt)).map(row=>row.deliveredAt).sort((a,b)=>a-b);
 assert.ok(times.length>=4,`보낸 수 ${times.length}`);
 for(const start of times)assert.ok(times.filter(time=>time>=start&&time<start+7*DAY).length<=2,'7일 창에 둘까지');
 const days=times.map(time=>Math.floor((time+offset*MINUTE)/DAY));assert.equal(new Set(days).size,days.length,'하루 하나');
 for(const time of times){const hour=new Date(time+offset*MINUTE).getUTCHours();assert.ok(hour>=9&&hour<21,'조용한 시간 밖');}
 // 시험 점검은 한 번씩만.
 for(const before of [14,7])assert.ok(device.entries.filter(row=>row.id===`exam:${examDay}:${before}`&&Number.isFinite(row.deliveredAt)).length<=1);
});
