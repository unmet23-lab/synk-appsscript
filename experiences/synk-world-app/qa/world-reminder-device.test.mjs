// WORLD 학습 알림 · 기기 쪽 제어기(world-reminder-device.mjs): 가짜 창·가짜 OS 알림·메모리 저장소로 돌린다.
// 앱 안 묻기 → 권한, 거절, 그 시각에 띄우기, 그날 공부했으면 띄우지 않기, 한글 단계 학생의 글 언어, 휴대폰·태블릿 판정(10-21 아르곤 지적 셋 포함).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldReminders,createTrailTimes,reminderSupport,reminderHourLabel,reminderDateLabel} from '../world-reminder-device.mjs';
import {setLang} from '../../brand-opening/world-lang.mjs';

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR,SEOUL=540;
const MONDAY=Date.UTC(2026,9,18,15); // 2026-10-19(월) 0시 서울
const at=(day,hour,minute=0)=>MONDAY+day*DAY+hour*HOUR+minute*MINUTE;
const DESKTOP='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};};
// 가짜 창: 알림을 만든 것과 권한을 청한 것을 적는다.
function fakeWindow({answer='granted',userAgent=DESKTOP,maxTouchPoints=0,permission='default'}={}){
 const notes=[],asks=[];let state=permission;
 class FakeNotification{constructor(title,options={}){this.title=title;this.body=options.body;this.tag=options.tag;this.lang=options.lang;notes.push(this);}close(){}}
 Object.defineProperty(FakeNotification,'permission',{get:()=>state});
 FakeNotification.requestPermission=()=>{asks.push(true);state=answer;return Promise.resolve(answer);};
 return {Notification:FakeNotification,navigator:{userAgent,maxTouchPoints},isSecureContext:true,addEventListener(){},removeEventListener(){},notes,asks};
}
function controller({read,answer,clock}={}){
 const target=fakeWindow({answer}),toasts=[],opened=[];
 const reminders=createWorldReminders({owner:'guest',storage:memory(),target,read,now:()=>clock.now,offset:SEOUL,toast:text=>toasts.push(text),open:kind=>opened.push(kind)});
 return {reminders,target,toasts,opened};
}

test('휴대폰·태블릿·알림 없는 브라우저에는 묻지 않는다 — 아이패드 사파리(맥 꼴 + 터치)도 태블릿으로 본다',()=>{
 assert.equal(reminderSupport(fakeWindow()).supported,true);
 for(const userAgent of ['Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile Safari/537.36','Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile/15E148'])assert.equal(reminderSupport(fakeWindow({userAgent})).supported,false,userAgent);
 const mac='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15';
 assert.equal(reminderSupport(fakeWindow({userAgent:mac,maxTouchPoints:5})).supported,false,'아이패드 사파리');
 assert.equal(reminderSupport(fakeWindow({userAgent:mac,maxTouchPoints:0})).supported,true,'맥 사파리');
 assert.equal(reminderSupport({...fakeWindow(),Notification:undefined}).supported,false);
 assert.equal(reminderSupport({...fakeWindow(),isSecureContext:false}).supported,false);
 const electron={...fakeWindow(),navigator:{userAgent:DESKTOP+' SYNKWorld/0.4.35 Electron/44.5.1',maxTouchPoints:0}};
 assert.equal(reminderSupport(electron).supported,true,'PC 앱');
});

test('「알려 주세요」를 누른 뒤에만 권한을 청하고, 그 시각에 띄우고, 누르면 그 자리로 간다',async()=>{
 const clock={now:at(0,10)};
 const {reminders,target,toasts,opened}=controller({clock,read:()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hasReturn:true})});
 try{
  assert.match(reminders.askMarkup(),/data-reminder-card="ask"/);assert.equal(target.asks.length,0,'묻는 카드만으로는 청하지 않는다');
  await reminders.command('reminder-yes');
  assert.equal(target.asks.length,1);assert.equal(toasts.at(-1),'알림을 켰어요. 다음 알림은 10월 20일 저녁 7시예요.');
  assert.equal(reminders.askMarkup(),'','답한 뒤에는 카드가 없다');
  clock.now=at(1,19,0)+30000;reminders.tick();
  assert.deepEqual(target.notes.map(n=>[n.title,n.body,n.tag,n.lang]),[['SYNK WORLD','다시 만날 표현이 돌아왔어요.','synk-world-reminder','ko']]);
  reminders.tick();assert.equal(target.notes.length,1,'같은 알림을 두 번 띄우지 않는다');
  target.notes[0].onclick();assert.deepEqual(opened,['review']);
  assert.ok(reminders.metrics().state.entries[0].openedAt>=reminders.metrics().state.entries[0].deliveredAt);
 }finally{reminders.dispose();}
});

test('거절하면 권한을 청하지 않고 다시 묻지 않는다',async()=>{
 const clock={now:at(0,10)};
 const {reminders,target,toasts}=controller({clock,read:()=>({reviews:[at(1,10)],hasReturn:true})});
 try{
  await reminders.command('reminder-no');
  assert.equal(target.asks.length,0);assert.match(toasts.at(-1),/설정의 「학습 알림」에서 언제든 켤 수 있어요/);
  clock.now=at(1,10);assert.equal(reminders.askMarkup(),'');
  assert.equal(reminders.metrics().state.enabled,false);
 }finally{reminders.dispose();}
});

test('그날 이미 공부한 기록이 들어오면(다른 기기에서 공부해 동기화된 경우 포함) 잡아 둔 알림을 띄우지 않고 다음 날로 옮긴다',async()=>{
 const clock={now:at(0,10)};let studyTimes=[at(0,9)];
 const {reminders,target}=controller({clock,read:()=>({reviews:[at(1,10)],studyTimes,hasReturn:true})});
 try{
  await reminders.command('reminder-yes');
  assert.equal(reminders.metrics().state.entries[0].at,at(1,19));
  // 화요일 낮에 다른 기기에서 공부한 기록이 들어왔고, 이 기기는 저녁 7시 10분에 깨어났다.
  studyTimes=[at(0,9),at(1,14)];clock.now=at(1,19,10);
  reminders.tick();assert.equal(target.notes.length,0,'1분 확인도 그날 공부를 본다');
  reminders.refresh();assert.equal(target.notes.length,0,'깨어난 뒤의 다시 잡기도 띄우지 않는다');
  assert.deepEqual(reminders.metrics().state.entries.map(row=>[row.at,row.deliveredAt??null]),[[at(2,19),null]],'다음 날 저녁으로 옮긴다');
 }finally{reminders.dispose();}
});

test('한글 단계 학생에게는 첫 다시 잡기 전에 띄워도 고른 화면 언어로 띄운다',async()=>{
 const clock={now:at(0,10)};
 const {reminders,target}=controller({clock,read:()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hangulStage:true,hasReturn:true})});
 try{
  await reminders.command('reminder-yes');
  setLang('mn',{save:false});
  // 새로 연 앱처럼: 아직 다시 잡지 않은 상태에서 바로 1분 확인이 돈다.
  const fresh=createWorldReminders({owner:'guest',storage:{getItem:()=>JSON.stringify(reminders.metrics().state),setItem(){},removeItem(){}},target,read:()=>({reviews:[at(1,10)],studyTimes:[],hangulStage:true}),now:()=>at(1,19,5),offset:SEOUL});
  try{fresh.tick();}finally{fresh.dispose();}
  assert.deepEqual(target.notes.map(n=>[n.body,n.lang]),[['Давтах хэллэгүүд дахин гарч ирлээ.','mn']]);
 }finally{setLang('ko',{save:false});reminders.dispose();}
});

test('학습 기록 시각: 게임 판이 닫혀 계정 코치가 끊기면 다시 만들어 읽고, 게임 판 도중에는 빈 목록이다(10-21 Fable P1)',()=>{
 // 계정 학습 호스트 흉내: 판이 닫히면(closeRun) 세대가 바뀌어 그 전에 만든 코치는 늘 던지고, 판 도중에는 다른 gameId 코치를 만들 수 없다.
 let generation=0,running=false,made=0,disconnected=0;
 const events=[{type:'decision.made',at:'2026-10-20T09:00:00.000Z'},{type:'practice.attempted',at:'2026-10-20T09:00:05.000Z'},{type:'practice.attempted',at:'2026-10-20T09:01:00.000Z'}];
 const host={createGame(){if(running)throw Error('WORLD game does not match its run');made++;const opened=generation;return {events(){if(opened!==generation)throw Object.assign(Error('WORLD game run ended'),{code:'RUN_ENDED'});return events;},disconnect(){disconnected++;}};},closeRun(){generation++;}};
 const trail=createTrailTimes({host:()=>host,make:source=>source.createGame({gameId:'world-reminders'})});
 assert.deepEqual(trail.read(),[Date.parse('2026-10-20T09:00:05.000Z'),Date.parse('2026-10-20T09:01:00.000Z')]);
 host.closeRun();
 assert.equal(trail.read().length,2,'판이 닫힌 뒤에도 다시 만들어 읽는다');assert.equal(made,2);assert.equal(disconnected,1);
 host.closeRun();running=true;
 assert.deepEqual(trail.read(),[],'판 도중에는 빈 목록(호스트가 생활·쓰기 시각을 더한다)');
 running=false;assert.equal(trail.read().length,2,'판이 끝나면 다시 읽힌다');
 trail.dispose();
 // 코치를 만들 수 없는 주인(계정인데 학습 호스트가 아직 없음)은 빈 목록.
 assert.deepEqual(createTrailTimes({host:()=>null,make:()=>null}).read(),[]);
});

test('주인이 바뀌면 옛 주인의 보내지 않은 예약만 지운다 — 다시 돌아온 순간 옛 예약이 또 뜨지 않는다(10-21 Fable P3)',async()=>{
 const clock={now:at(0,10)},storage=memory(),target=fakeWindow();
 const make=()=>createWorldReminders({owner:'guest',storage,target,read:()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hasReturn:true}),now:()=>clock.now,offset:SEOUL});
 const guest=make();
 try{await guest.command('reminder-yes');assert.equal(guest.metrics().state.entries.filter(row=>!row.deliveredAt).length,1);
  guest.forgetPending();assert.deepEqual(guest.metrics().state.entries,[]);assert.equal(guest.metrics().state.enabled,true,'설정은 그대로');
 }finally{guest.dispose();}
 // 계정으로 지낸 뒤 그 예약 시각 20분 뒤에 손님으로 돌아와도 옛 예약을 띄우지 않는다(다시 잡기는 다음 때를 잡는다).
 clock.now=at(1,19,20);const back=make();
 try{back.refresh();assert.equal(target.notes.length,0);assert.ok(back.metrics().state.entries.every(row=>row.at>clock.now));}finally{back.dispose();}
});

test('하루 하나는 이 기기 기준이다 — 계정이 오늘 띄운 뒤 손님으로 돌아오면 손님의 옛 예약은 띄우지 않는다(10-21 Fable 재확인 P3)',async()=>{
 const clock={now:at(0,10)},storage=memory(),target=fakeWindow();
 const make=owner=>createWorldReminders({owner,storage,target,read:()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hasReturn:true}),now:()=>clock.now,offset:SEOUL});
 // 앞선 탭에서 손님이 화요일 저녁 7시 알림을 잡아 두고 닫았다(주인 전환이 없었으니 forgetPending도 없었다).
 const guest=make('guest');
 try{await guest.command('reminder-yes');}finally{guest.dispose();}
 const account=make('account-1');
 try{await account.command('reminder-yes');clock.now=at(1,19,0)+30000;account.tick();assert.equal(target.notes.length,1,'계정 알림');}finally{account.dispose();}
 // 저녁 7시 20분에 로그아웃해 손님 기록이 다시 섰다.
 clock.now=at(1,19,20);const back=make('guest');
 try{
  back.tick();back.refresh();assert.equal(target.notes.length,1,'같은 날 두 번 울리지 않는다');
  assert.ok(back.metrics().state.entries.every(row=>row.at>clock.now&&!Number.isFinite(row.deliveredAt)),'손님 예약은 다음 때로 옮긴다');
 }finally{back.dispose();}
 // 다음 날 손님 알림은 그대로 뜬다.
 clock.now=at(2,19,0)+30000;const next=make('guest');
 try{next.tick();assert.equal(target.notes.length,2);}finally{next.dispose();}
});

test('시험 점검 시트의 주 단추: 시험 형식 연습이 있는 화면이면 그 글, 없으면 짧은 진단',()=>{
 const base={owner:'guest',storage:memory(),target:fakeWindow(),offset:SEOUL};
 const withMock=createWorldReminders({...base,canMock:()=>true}),without=createWorldReminders({...base});
 try{
  assert.match(withMock.examMarkup(),/시험 형식 연습 시작하기/);assert.doesNotMatch(withMock.examMarkup(),/짧은 진단 시작하기/);
  assert.match(without.examMarkup(),/짧은 진단 시작하기/);
  for(const markup of [withMock.examMarkup(),without.examMarkup()])assert.equal((markup.match(/class="felt-button"/g)||[]).length,1,'흰 알약 하나');
 }finally{withMock.dispose();without.dispose();}
});

test('시각·날짜 이름은 기기 달력·시각으로, 세 언어로 쓴다',()=>{
 assert.deepEqual([9,12,15,18,19,20].map(h=>reminderHourLabel(h,'ko')),['오전 9시','낮 12시','오후 3시','저녁 6시','저녁 7시','저녁 8시']);
 assert.deepEqual([9,12,19].map(h=>reminderHourLabel(h,'en')),['9 AM','12 PM','7 PM']);
 assert.deepEqual([9,19].map(h=>reminderHourLabel(h,'mn')),['09:00','19:00']);
 // 몽골(+480) 학생의 저녁 7시는 그 지역 날짜로 읽는다.
 assert.equal(reminderDateLabel(at(1,19),'ko',SEOUL),'10월 20일');assert.equal(reminderDateLabel(at(1,19),'en',SEOUL),'Oct 20');assert.equal(reminderDateLabel(at(1,19),'mn',480),'10-р сарын 20');
});
