// WORLD 학습 알림 · 기기 쪽 제어기(world-reminder-device.mjs)와 2단(앱을 닫아도 받기, world-push.mjs)을 잇는 곳. 설계 qa/push-reminders-20261022/설계.md §3·§6.
// 가짜 2단(world-push의 겉모양만)과 가짜 창으로 돌린다: 2단이 켜진 계정이면 1단이 쉬고 · 띄우기 직전에 상태를 다시 묻고 · 서버 기록을 이어 두고 ·
// 휴대폰에서는 묻는 카드가 동의 시트를 열고 · 켜기·끄기가 1단 기록·설정을 잇고 · 설정 줄과 상태 글이 기기·계정 상태에 맞는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldReminders,PRIVACY_URL,pushErrorKey} from '../world-reminder-device.mjs';
import {setLang} from '../../brand-opening/world-lang.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR,SEOUL=540;
const MONDAY=Date.UTC(2026,9,18,15); // 2026-10-19(월) 0시 서울
const at=(day,hour,minute=0)=>MONDAY+day*DAY+hour*HOUR+minute*MINUTE;
const DESKTOP='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const ANDROID='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const ko=key=>STRINGS[key].ko;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};};
function fakeWindow({userAgent=DESKTOP,permission='granted',sheet=false}={}){
 const notes=[];let state=permission;
 class FakeNotification{constructor(title,options={}){this.title=title;this.body=options.body;this.tag=options.tag;this.lang=options.lang;notes.push(this);}close(){}}
 Object.defineProperty(FakeNotification,'permission',{get:()=>state});
 FakeNotification.requestPermission=()=>Promise.resolve(state);
 // 휴대폰 동의 시트가 열려 있는지만 묻는 문서(설정 화면 DOM은 브라우저 시험이 본다).
 const document={querySelector:selector=>sheet&&selector==='[data-push-consent="sheet"]'?{}:null,querySelectorAll:()=>[]};
 return {Notification:FakeNotification,navigator:{userAgent,maxTouchPoints:0},isSecureContext:true,addEventListener(){},removeEventListener(){},document,notes};
}
// 가짜 2단: world-push createWorldPush가 내주는 겉모양(snapshot·fresh·ready·enable·disable·sync·subscribe)만. 부른 것을 적는다.
function fakePush({enabled=true,supported=true,reason='ok',permission='default',device=false,active=false,plan=null,checkedAt=at(0,10)}={}){
 const calls=[],listeners=new Set();
 let state={phase:'ready',enabled,support:{supported,reason,permission},owner:'acc-1',device:{subscribed:device},account:{active,devices:active?1:0},plan,checkedAt,publicReady:false,busy:false,error:null};
 const push={calls,answers:{fresh:null,enable:null,disable:null,sync:null},
  set(patch){state={...state,...patch};for(const listener of listeners)listener(state);return state;},
  snapshot:()=>state,
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  ready(){calls.push(['ready']);return Promise.resolve(push.set({publicReady:true}));},
  fresh(maxAge){calls.push(['fresh',maxAge]);if(push.answers.fresh)push.set(push.answers.fresh);return Promise.resolve(state);},
  enable(body){calls.push(['enable',body]);const answer=push.answers.enable||{device:{subscribed:true},account:{active:true,devices:1},plan:{next:null,log:[]}};return Promise.resolve(push.set(answer));},
  disable(){calls.push(['disable']);const answer=push.answers.disable;if(answer===null)return Promise.resolve(null);push.set({device:{subscribed:false},account:{active:false,devices:0},plan:null});return Promise.resolve(answer||{removed:true});},
  sync(body){calls.push(['sync',body]);if(push.answers.sync)push.set(push.answers.sync);return Promise.resolve(state);},
 };
 return push;
}
// pushFeature: 공개 설정값 worldPush(기본 켬 — 이 파일은 2단을 켠 공개본을 본다. 꺼진 공개본은 아래 「설정값 worldPush 꺼짐」).
function controller({push,target=fakeWindow(),read=()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hasReturn:true}),clock={now:at(0,10)},storage=memory(),pushFeature=true}={}){
 const toasts=[],opened=[],sheets=[],closed=[],repaints=[];
 const reminders=createWorldReminders({owner:'acc-1',storage,target,read,now:()=>clock.now,offset:SEOUL,push,pushFeature,toast:text=>toasts.push(text),open:kind=>opened.push(kind),
  show:(title,html)=>sheets.push({title,html}),close:()=>closed.push(true),repaint:()=>repaints.push(true)});
 return {reminders,target,toasts,opened,sheets,closed,clock,storage};
}
const enable1=async c=>{await c.reminders.command('reminder-yes');return c.reminders.metrics().state;};

test('2단이 켜진 계정(다른 기기에서 켬): 1단은 잡아 둔 예약을 지우고 쉬며, 서버가 보낸 기록을 이어 두고 요약·보낸 줄을 보낸다',async()=>{
 const push=fakePush(),c=controller({push});
 try{
  const before=await enable1(c);
  assert.deepEqual(before.entries.map(row=>[row.kind,row.at]),[['review',at(1,19)]],'1단 예약');
  // 다른 기기에서 2단을 켰다 — 서버가 어제 보낸 줄(시험 점검)이 기록에 실려 온다.
  const sent={id:'exam:2026-11-03:14',kind:'exam',ref:'2026-11-03:14',at:at(0,9),plannedAt:at(0,8),deliveredAt:at(0,9)};
  push.set({account:{active:true,devices:1},plan:{next:at(2,19),log:[sent],planHour:19}});
  const plan=c.reminders.refresh();
  assert.equal(plan.live,false);
  const state=c.reminders.metrics().state;
  assert.deepEqual(state.entries.map(row=>row.id),[sent.id],'1단 예약은 지우고 서버 줄은 남긴다');
  const sync=push.calls.filter(call=>call[0]==='sync').at(-1)[1];
  assert.deepEqual(Object.keys(sync).sort(),['digest','handover']);
  assert.deepEqual(sync.handover.map(row=>row.id),[sent.id]);
  assert.deepEqual(Object.keys(sync.digest).sort(),['examDate','lang','lastStudyDay','planWeek','reviews','studyHour','timeZone']);
  assert.equal(sync.digest.lang,'ko');assert.equal(sync.digest.lastStudyDay,'2026-10-19');
  // 그 시각이 와도 이 기기는 띄우지 않는다.
  c.clock.now=at(1,19,0)+30000;c.reminders.tick();await flush();
  assert.equal(c.target.notes.length,0);assert.equal(push.calls.some(call=>call[0]==='fresh'),false,'켜진 것을 알면 묻지도 않는다');
 }finally{c.reminders.dispose();}
});

test('띄우기 직전: 마지막으로 안 상태가 10분보다 오래됐으면 다시 묻고, 그사이 2단이 켜졌으면 띄우지 않는다 — 꺼져 있으면 띄운다',async()=>{
 for(const meanwhile of [true,false]){
  const push=fakePush(),c=controller({push});
  try{
   await enable1(c);
   if(meanwhile)push.answers.fresh={account:{active:true,devices:1},plan:{next:at(2,19),log:[]}};
   c.clock.now=at(1,19,0)+30000;c.reminders.tick();
   assert.equal(c.target.notes.length,0,'묻는 동안은 띄우지 않는다');
   c.reminders.tick();await flush();await flush();
   assert.deepEqual(push.calls.filter(call=>call[0]==='fresh'),[['fresh',10*MINUTE]],'한 번만 묻는다');
   if(meanwhile){assert.equal(c.target.notes.length,0);assert.equal(c.reminders.metrics().state.entries.filter(row=>!Number.isFinite(row.deliveredAt)).length,0,'예약도 지웠다');}
   else assert.deepEqual(c.target.notes.map(note=>note.body),[ko('reminder.push.review')]);
  }finally{c.reminders.dispose();}
 }
 // 손님(2단 없음)은 묻지 않고 그대로 띄운다.
 const guest=createWorldReminders({owner:'guest',storage:memory(),target:fakeWindow(),read:()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hasReturn:true}),now:()=>at(0,10),offset:SEOUL});
 guest.dispose();
});

test('휴대폰(1단을 띄울 수 없음): 2단을 켤 수 있으면 같은 묻는 카드가 동의 시트를 열고, 「동의하고 켜기」가 설정·요약·1단 기록과 함께 켠다',async()=>{
 const push=fakePush(),target=fakeWindow({userAgent:ANDROID,permission:'default',sheet:true}),c=controller({push,target});
 try{
  const card=c.reminders.askMarkup();
  assert.match(card,/data-world="reminder-push-ask"/);assert.ok(card.includes(ko('reminder.ask.bodyPush')));assert.doesNotMatch(card,/data-world="reminder-yes"/);
  c.reminders.command('reminder-push-ask');await flush();
  assert.equal(c.sheets.length,1);assert.equal(c.sheets[0].title,ko('reminder.push.consent.title'));
  assert.match(c.sheets[0].html,/data-push-consent="sheet"/);assert.match(c.sheets[0].html,/data-world="reminder-push-yes" disabled aria-busy="true"/,'준비 전에는 잠근다');
  assert.ok(push.calls.some(call=>call[0]==='ready'),'시트를 열 때 서비스 워커를 준비한다');
  await c.reminders.command('reminder-push-yes');
  const body=push.calls.find(call=>call[0]==='enable')[1];
  assert.deepEqual(body.settings,{frequency:2,hour:null,since:null});assert.equal(body.digest.timeZone.length>0,true);assert.deepEqual(body.handover,[]);
  const state=c.reminders.metrics().state;
  assert.equal(state.enabled,true);assert.equal(state.consent.answer,'yes');
  assert.equal(c.toasts.at(-1),ko('reminder.push.on'));assert.equal(c.closed.length,1,'시트를 닫는다');
  // 켠 뒤에는 묻는 카드가 없다(2단이 켜진 계정).
  assert.equal(c.reminders.askMarkup(),'');
 }finally{c.reminders.dispose();}
 // 손님·서버 꺼짐·아이폰에는 2단 카드가 없다(1단도 못 띄우니 아무 카드도 없다).
 for(const push of [null,fakePush({enabled:false}),fakePush({supported:false,reason:'ios'})]){
  const quiet=controller({push,target:fakeWindow({userAgent:ANDROID,permission:'default'})});
  try{assert.equal(quiet.reminders.askMarkup(),'');}finally{quiet.reminders.dispose();}
 }
});

test('켜기 실패는 까닭에 맞는 글로 알리고 켜지 않는다 · 「괜찮아요」는 시트면 거절로 적고 닫는다',async()=>{
 const push=fakePush(),target=fakeWindow({userAgent:ANDROID,permission:'default',sheet:true}),c=controller({push,target});
 try{
  push.answers.enable={device:{subscribed:false},error:'PUSH_DEVICE_LIMIT'};
  await c.reminders.command('reminder-push-yes');
  assert.equal(c.toasts.at(-1),ko('reminder.push.limit'));assert.equal(c.reminders.metrics().state.enabled,false);assert.equal(c.closed.length,0);
  for(const [code,key] of [['PUSH_DENIED','reminder.settings.blocked'],['PUSH_TIMEOUT','reminder.push.timeout'],['PUSH_LOCAL_CLEANUP','reminder.push.cleanup'],['SERVER_UNAVAILABLE','reminder.push.error'],[undefined,'reminder.push.error']])assert.equal(pushErrorKey(code),key);
  c.reminders.command('reminder-push-no');
  assert.equal(c.closed.length,1);assert.equal(c.reminders.metrics().state.consent.answer,'no');assert.equal(c.toasts.at(-1),ko('reminder.declined'));
 }finally{c.reminders.dispose();}
});

test('끄기: 마지막 기기면 서버가 돌려준 보낸 줄·설정을 1단 기록에 넣는다 — 휴대폰에서는 학습 알림이 꺼지고, PC에서는 1단으로 돌아간다',async()=>{
 const row={id:'review:1',kind:'review',ref:'1',at:at(1,19),plannedAt:at(0,10),deliveredAt:at(1,19)};
 for(const phone of [true,false]){
  const push=fakePush({device:true,active:true}),c=controller({push,target:fakeWindow(phone?{userAgent:ANDROID,permission:'default'}:{}),clock:{now:at(2,10)}});
  try{
   push.answers.disable={removed:true,handover:[row],settings:{frequency:1,hour:18,since:null},account:{active:false,devices:0}};
   c.reminders.command('reminder-keep');
   const keep=push.calls.filter(call=>call[0]==='sync'&&call[1].settings).map(call=>call[1]);
   assert.deepEqual(keep,[{settings:{frequency:2,hour:null}}],'「계속 받기」는 서버의 물러남도 다시 센다');
   await c.reminders.command('reminder-stop');
   const state=c.reminders.metrics().state;
   assert.ok(state.entries.some(entry=>entry.id===row.id&&entry.deliveredAt===row.deliveredAt),'보낸 줄을 이어 둔다');
   assert.equal(state.frequency,1);assert.equal(state.hour,18);
   assert.equal(state.enabled,false,'「그만 받기」는 학습 알림을 끈다');
   assert.equal(c.toasts.at(-1),ko('reminder.push.off'));
  }finally{c.reminders.dispose();}
 }
 // 다른 켜기·끄기가 도는 중이면(null) 아무것도 바꾸지 않고 알리지도 않는다.
 const push=fakePush({device:true,active:true}),c=controller({push,clock:{now:at(2,10)}});
 try{push.answers.disable=null;const before=JSON.stringify(c.reminders.metrics().state);await c.reminders.command('reminder-stop');
  assert.equal(JSON.stringify(c.reminders.metrics().state),before);assert.deepEqual(c.toasts,[]);}finally{c.reminders.dispose();}
});

test('물러남으로 멈춘 계정: 2단을 받는 기기에서만 「계속 받을까요?」를 그날 묻는다',()=>{
 for(const [device,shown] of [[true,true],[false,false]]){
  const push=fakePush({device,active:true,plan:{paused:true,next:null,log:[]}}),c=controller({push});
  try{c.reminders.refresh();const card=c.reminders.askMarkup();assert.equal(/data-reminder-card="pause"/.test(card),shown,String(device));if(!shown)assert.equal(card,'');}finally{c.reminders.dispose();}
 }
});

test('「계속 받기」·설정 바꾸기는 서버 답이 온 뒤 다시 그린다 — 멈춤 카드가 걷히고 상태 줄이 새 값이다(10-22 아르곤 화면 A2)',async()=>{
 const push=fakePush({device:true,active:true,plan:{paused:true,next:null,log:[]}}),c=controller({push});
 try{
  c.reminders.refresh();assert.match(c.reminders.askMarkup(),/data-reminder-card="pause"/);
  push.answers.sync={plan:{paused:false,next:at(2,19),planHour:19,log:[]}};
  const before=c.reminders.metrics().state.pauseAsked;
  c.reminders.command('reminder-keep');
  await flush();
  assert.equal(c.reminders.askMarkup(),'','서버 답 뒤에는 멈춤 카드가 없다');
  assert.ok(Number.isFinite(before));
 }finally{c.reminders.dispose();}
});

test('설정 줄: PC는 1단 줄 + 「앱을 닫아도 받기」 줄, 휴대폰은 2단이 곧 학습 알림 줄, 받을 수 없는 기기·꺼진 서버·손님은 2단 줄이 없다',()=>{
 const rows=markup=>({main:/data-reminder-enabled/.test(markup),push:/data-push-row/.test(markup),pushOnly:/data-push-enabled/.test(markup)&&!/data-push-row/.test(markup)&&!/data-reminder-enabled/.test(markup)});
 const view=(push,target=fakeWindow())=>{const c=controller({push,target});try{return c.reminders.settingsMarkup();}finally{c.reminders.dispose();}};
 assert.deepEqual(rows(view(fakePush())),{main:true,push:true,pushOnly:false},'PC');
 const phone=view(fakePush(),fakeWindow({userAgent:ANDROID,permission:'default'}));
 assert.deepEqual(rows(phone),{main:false,push:false,pushOnly:true},'휴대폰');assert.ok(phone.includes(ko('reminder.push.only.note')));
 assert.deepEqual(rows(view(fakePush({enabled:false}))),{main:true,push:false,pushOnly:false},'서버 기능 꺼짐');
 assert.deepEqual(rows(view(fakePush({supported:false,reason:'unsupported'}))),{main:true,push:false,pushOnly:false},'푸시 없는 브라우저');
 assert.deepEqual(rows(view(null)),{main:true,push:false,pushOnly:false},'손님');
 // 막힌 권한이면 2단 칸을 잠근다. 동의 상자는 줄 아래 빈 자리로 시작한다.
 assert.match(view(fakePush({permission:'denied'})),/data-push-enabled\s+disabled/);
 assert.match(view(fakePush()),/data-push-consent-slot hidden/);
 // 휴대폰 상태 글: 아이폰은 아직 안 된다는 말, 손님 안드로이드는 로그인 안내.
 assert.ok(view(fakePush({supported:false,reason:'ios'}),fakeWindow({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile/15E148',permission:'default'})).includes(ko('reminder.push.unsupported.ios')));
 const guestPhone=createWorldReminders({owner:'guest',storage:memory(),target:{...fakeWindow({userAgent:ANDROID,permission:'default'}),PushManager:function(){},navigator:{userAgent:ANDROID,maxTouchPoints:0,serviceWorker:{}}},offset:SEOUL,pushFeature:true});
 try{assert.ok(guestPhone.settingsMarkup().includes(ko('reminder.push.guest')));}finally{guestPhone.dispose();}
});

test('막힌 권한(크롬 「차단」): 휴대폰 2단 줄 아래 막힘 안내, 다른 기기 2단이 켜진 계정은 「여기서도 켜 주세요」 대신 막힘과 「그 기기로 알려요」',()=>{
 const status=(push,target=fakeWindow())=>{const c=controller({push,target});try{return c.reminders.settingsMarkup().match(/data-reminder-status role="status">([\s\S]*?)<\/p>/)[1];}finally{c.reminders.dispose();}};
 const plan={next:at(1,19),planHour:19,level:0,reduced:false,paused:false,log:[]};
 // 안드로이드(1단 없음 · 2단 줄 하나가 잠김): 왜 못 켜는지·어디서 푸는지.
 const phone=status(fakePush({permission:'denied',reason:'blocked'}),fakeWindow({userAgent:ANDROID,permission:'denied'}));
 assert.ok(phone.includes(ko('reminder.settings.blocked')),phone);
 // 다른 기기에서 2단이 켜진 계정 · 이 PC 권한 막힘: 1단·2단 줄이 다 잠겼으니 켜라고 하지 않는다.
 const desk=status(fakePush({permission:'denied',reason:'blocked',active:true,plan}),fakeWindow({permission:'denied'}));
 assert.ok(desk.includes(ko('reminder.settings.blocked')),desk);
 assert.ok(desk.includes(ko('reminder.push.status.away'))&&!desk.includes(ko('reminder.push.status.elsewhere')),desk);
 // 막히지 않았으면 그대로 「이 기기에서도 받으려면 켜 주세요」.
 const open=status(fakePush({active:true,plan}));
 assert.ok(open.includes(ko('reminder.push.status.elsewhere'))&&!open.includes(ko('reminder.settings.blocked')),open);
});

test('휴대폰 동의 시트(설정 묶음 없는 화면)에서 켜기가 실패하면 시트의 단추가 다시 눌리고 안내 글이 까닭을 말한다',async()=>{
 // 시트 상자 하나만 있는 문서: 「동의하고 켜기」 단추와 안내 줄.
 const button={disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},line={textContent:''};
 const sheet={querySelector:s=>s==='[data-world="reminder-push-yes"]'?button:s==='[data-push-message]'?line:null};
 const target={...fakeWindow({userAgent:ANDROID,permission:'default'}),document:{querySelector:s=>s==='[data-push-consent="sheet"]'?sheet:null,querySelectorAll:s=>s==='[data-push-consent]'?[sheet]:[]}};
 const push=fakePush({});push.set({publicReady:true});
 // 진짜 world-push처럼: 켜는 동안 busy(단추 잠김) → 거절로 끝남. 시트 화면에는 상태 청취자가 없다(설정을 열지 않았다).
 push.enable=()=>{push.calls.push(['enable']);push.set({busy:true,publicReady:false});return Promise.resolve().then(()=>push.set({busy:false,publicReady:true,error:'PUSH_DENIED'}));};
 const c=controller({push,target});
 try{
  const run=c.reminders.command('reminder-push-yes');
  assert.equal(button.disabled,true,'켜는 동안 잠근다');assert.equal(line.textContent,ko('reminder.push.waiting'));
  await run;
  assert.equal(button.disabled,false,'실패하면 다시 누를 수 있다');assert.equal(button.attrs['aria-busy'],undefined);
  assert.equal(line.textContent,ko('reminder.settings.blocked'),'까닭이 시트에 남는다');
 }finally{c.reminders.dispose();}
});

test('설정값 worldPush 꺼짐(켜기 전 공개본): 서버에 묻지 않고 보이는 2단 글(아이폰 안내·손님 로그인 안내)도 없고 1단 글 그대로',()=>{
 const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile/15E148';
 const status=markup=>markup.match(/data-reminder-status role="status">([\s\S]*?)<\/p>/)[1];
 // 2단 글: reminder.push.* 가운데 1단부터 있던 잠금 화면 글 넷(title·review·plan·exam)을 뺀 것.
 const pushKeys=Object.keys(STRINGS).filter(key=>key.startsWith('reminder.push.')&&!/^reminder\.push\.(?:title|review|plan|exam)$/.test(key)).map(key=>ko(key));
 assert.ok(pushKeys.length>=20,String(pushKeys.length));
 // 앱 셸은 설정값이 꺼져 있으면 2단 모듈을 만들지 않는다(push 없음) — 로그인한 아이폰·손님 안드로이드 모두 일반 안내뿐.
 for(const [name,owner,target] of [['아이폰 로그인','acc-1',fakeWindow({userAgent:IPHONE_UA,permission:'default'})],
  ['안드로이드 손님','guest',{...fakeWindow({userAgent:ANDROID,permission:'default'}),PushManager:function(){},navigator:{userAgent:ANDROID,maxTouchPoints:0,serviceWorker:{}}}]]){
  const reminders=createWorldReminders({owner,storage:memory(),target,offset:SEOUL});
  try{
   const markup=reminders.settingsMarkup();
   assert.ok(status(markup).includes(ko('reminder.settings.unsupported')),`${name}: ${status(markup)}`);
   for(const text of pushKeys)assert.ok(!markup.includes(text),`${name}: 2단 글이 보인다 — ${text}`);
   assert.doesNotMatch(markup,/data-push-(?:row|enabled)/,name);
  }finally{reminders.dispose();}
 }
});

test('설정 상태 글: 이 기기로 옴 · 다른 기기로 감(여기서도 켤 수 있으면 그 말까지) · 줄임·멈춤 — 서버의 다음 알림 시각으로',()=>{
 const status=(push,target=fakeWindow())=>{const c=controller({push,target});try{return c.reminders.settingsMarkup().match(/data-reminder-status role="status">([\s\S]*?)<\/p>/)[1];}finally{c.reminders.dispose();}};
 const here=status(fakePush({device:true,active:true,plan:{next:at(1,19),planHour:19,log:[]}}));
 assert.ok(here.includes('10월 20일 저녁 7시'),here);assert.ok(here.includes(ko('reminder.push.status.device')));
 assert.ok(status(fakePush({active:true,plan:{next:at(1,19),planHour:19,log:[]}})).includes(ko('reminder.push.status.elsewhere')));
 const away=status(fakePush({supported:false,reason:'ios',active:true,plan:{next:at(1,19),planHour:19,log:[]}}),fakeWindow({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile/15E148',permission:'default'}));
 assert.ok(away.includes(ko('reminder.push.status.away')));assert.ok(!away.includes(ko('reminder.push.status.elsewhere')),'켤 수 없는 기기에 켜라고 하지 않는다');
 assert.ok(status(fakePush({device:true,active:true,plan:{paused:true,next:null,log:[]}})).includes(ko('reminder.settings.paused')));
 assert.ok(status(fakePush({device:true,active:true,plan:{reduced:true,next:at(3,19),planHour:19,log:[]}})).includes(ko('reminder.settings.reduced')));
});

test('동의 상자: 짧은 본문 + 「무엇을 두나요?」 접기(두는 것·때를 정하는 것·보내지 않는 것·지우는 때·처리방침) — 세 언어',()=>{
 const c=controller({push:fakePush()});
 try{
  for(const lang of ['ko','en','mn']){
   setLang(lang,{save:false});
   const html=c.reminders.consentMarkup();
   for(const key of ['reminder.push.consent.title','reminder.push.consent.body','reminder.push.consent.more','reminder.push.consent.keep','reminder.push.consent.timing','reminder.push.consent.never','reminder.push.consent.delete','reminder.push.consent.privacy','reminder.push.consent.yes'])
    assert.ok(html.includes(STRINGS[key][lang].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')),`${lang} ${key}`);
   assert.ok(html.includes(`href="${PRIVACY_URL}"`));assert.equal(PRIVACY_URL,'https://synk.im/privacy/');
   assert.match(html,/<details class="reminder-push-more">/);
  }
 }finally{setLang('ko',{save:false});c.reminders.dispose();}
});

test('잠금 화면 글 언어: 한국어 틀 — 한글 단계 학생만 고른 화면 언어로 요약을 보낸다',()=>{
 for(const [hangulStage,lang,expected] of [[false,'mn','ko'],[true,'mn','mn'],[true,'ko','ko']]){
  setLang(lang,{save:false});
  const push=fakePush({device:true,active:true,plan:{next:null,log:[]}}),c=controller({push,read:()=>({reviews:[at(1,10)],studyTimes:[at(0,9)],hangulStage})});
  try{c.reminders.refresh();assert.equal(push.calls.filter(call=>call[0]==='sync').at(-1)[1].digest.lang,expected,`${hangulStage} ${lang}`);}finally{c.reminders.dispose();setLang('ko',{save:false});}
 }
});
