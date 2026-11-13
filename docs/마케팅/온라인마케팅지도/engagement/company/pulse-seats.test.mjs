// PULSE 제작 자리 · 대기(2026-11-13 운영 조각 6-B, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2) — 세는 법 · 상태 · 언제쯤 · 저장(순수 함수 · 가짜 저장소).
// 실제 서버 길(새 초안 막기 · 방향 제안 굳히기 · 손님 · 직원 보기 · 설정 길)은 pulse-presale-server.test.mjs 「운영 조각 6-B」 시험이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityState,projectSeat,readSeats,seatKind,createPulseCapacity,SEAT_DEFAULTS,SEAT_LIMITS} from './pulse-capacity.mjs';

const NOW='2026-11-13T03:00:00.000Z',TODAY='2026-11-13';
const DEFAULT={seats:{...SEAT_DEFAULTS},held:[]};
let n=0;
// 프로젝트 한 줄: kind video|photo, paid(결제 확인) · due(받으실 날) · confirmed(담당자 확인) · quiet(마지막 움직임 일수) · stage · retired · submitted.
function row({kind='video',paid=false,due='',confirmed=true,confirmedAt=null,quiet=0,stage='planning',retired=false,submitted=true,cancelled=false,refunded=false}={}){
  const id='p'+(++n);
  const request={answers:{package:kind==='photo'?'photo':'s15'},...(submitted?{submittedAt:'2026-11-01T00:00:00.000Z'}:{}),status:retired?'retired':'confirmed',...(confirmed?{confirmedAt:confirmedAt||`2026-11-${String(10+(n%10)).padStart(2,'0')}T0${n%10}:00:00.000Z`}:{}),
    ...(paid?{payment:{status:'confirmed',confirmedAt:'2026-11-05T00:00:00.000Z',...(due?{dueDate:due}:{})}}:refunded?{payment:{status:'cancelled',confirmedAt:'2026-11-05T00:00:00.000Z',cancelledAt:'2026-11-12T00:00:00.000Z'}}:cancelled?{payment:{status:'cancelled'}}:{})};
  return {id,stage,updatedAt:new Date(Date.parse(NOW)-quiet*86400000).toISOString(),studio:{request}};
}
const state=(rows,setting=DEFAULT)=>capacityState(rows,setting,NOW);

test('세는 법: 결제 확인한 건이 제작 중, 영상과 사진은 따로, 납품 · 보관 · 거둠 · 취소 · 옛 흐름은 세지 않고, 손으로 잡은 자리는 제작 중',()=>{
  const rows=[row({paid:true,due:'2026-11-20'}),row({kind:'photo',paid:true,due:'2026-11-16'}),row({paid:true,stage:'delivered'}),row({paid:true,stage:'archived'}),row({paid:true,retired:true}),
    row({cancelled:true}),row({refunded:true}),{id:'old',stage:'producing',updatedAt:NOW,studio:{}},{id:'none',stage:'planning',updatedAt:NOW}];
  const s=state(rows,{seats:{...SEAT_DEFAULTS},held:[{id:'aaaaaaaaaaaa',kind:'video',note:'옛 흐름 건'}]});
  assert.deepEqual([s.video.used,s.photo.used],[2,1]);
  assert.equal(s.video.waiting,1,'결제 요청만 취소한 건은 결제 전 확인된 건으로 대기에 들고, 확인했던 결제를 취소(환불)한 건은 대기에도 들지 않는다(끝판 카본 A2)');
});

test('대기: 담당자가 확인했고 결제 전이며 14일 안에 움직인 건만 — 접수만 한 건 · 오래 멈춘 건은 세지 않는다',()=>{
  const rows=[row(),row({kind:'photo'}),row({confirmed:false}),row({quiet:SEAT_LIMITS.quietDays+1}),row({quiet:SEAT_LIMITS.quietDays}),row({submitted:false})];
  const s=state(rows);
  assert.deepEqual([s.video.waiting,s.photo.waiting,s.queue.used],[2,1,3]);
});

test('상태: 제작 중 + 앞선 대기가 자리보다 적으면 open, 아니면 대기 자리(영상 · 사진 함께)가 남으면 queue, 다 차면 full',()=>{
  const paid=k=>Array.from({length:k},(_,i)=>row({paid:true,due:`2026-11-${20+i}`}));
  assert.equal(state(paid(2)).video.state,'open');
  assert.equal(state([...paid(2),row()]).video.state,'queue','남은 한 자리는 앞선 대기 건 몫');
  assert.equal(state(paid(3)).video.state,'queue');
  assert.equal(state(paid(3)).photo.state,'open','사진은 따로 센다');
  const fullRows=[...paid(3),...Array.from({length:6},()=>row({kind:'photo'}))];
  const s=state(fullRows);
  assert.deepEqual([s.video.state,s.photo.state],['full','full'],'사진 대기가 대기 자리를 채우면 영상도 full · 사진도 자리가 대기에 밀려 full');
  assert.equal(state(paid(3),{seats:{video:3,photo:5,queue:0},held:[]}).video.state,'full');
});

test('언제쯤: 제작 중 받으실 날을 이른 순으로(지난 날은 오늘), 받으실 날이 빈 건 · 손으로 잡은 자리 차례면 날짜 없이, 대기 순번이 제작 중보다 뒤면 날짜 없이',()=>{
  const busy=[row({paid:true,due:'2026-11-25'}),row({paid:true,due:'2026-11-01'}),row({paid:true,due:'2026-11-19'})];
  let s=state(busy);
  assert.equal(s.video.noticeDate,TODAY,'새 손님은 첫 빈자리 — 지난 받으실 날은 오늘로');
  const one=row({confirmedAt:'2026-11-10T00:00:00.000Z'}),two=row({confirmedAt:'2026-11-11T00:00:00.000Z'});
  s=state([...busy,one,two]);
  assert.deepEqual([projectSeat(s,one),projectSeat(s,two)],[{state:'queue',noticeDate:TODAY},{state:'queue',noticeDate:'2026-11-19'}]);
  assert.equal(s.video.noticeDate,'2026-11-25','새 손님은 대기 둘 뒤');
  const noDue=state([row({paid:true,due:'2026-11-20'}),row({paid:true}),row({paid:true,due:'2026-11-22'}),row(),row()]);
  assert.equal(noDue.video.noticeDate,'','세 번째 빈자리는 받으실 날이 빈 건 차례(이른 순 20 · 22 뒤)');
  assert.equal(state([row({paid:true,due:'2026-11-20'}),row({paid:true}),row({paid:true,due:'2026-11-22'}),row()]).video.noticeDate,'2026-11-22');
  const held=state([row({paid:true,due:'2026-11-20'}),row({paid:true,due:'2026-11-22'})],{seats:{...SEAT_DEFAULTS},held:[{id:'aaaaaaaaaaaa',kind:'video',note:'옛 건'}]});
  assert.deepEqual([held.video.state,held.video.noticeDate],['queue','2026-11-20'],'손으로 잡은 자리는 맨 뒤(날짜 모름)');
  const beyond=state([row({paid:true,due:'2026-11-20'})],{seats:{video:1,photo:5,queue:6},held:[]}),a=row(),b=row();
  const s2=state([row({paid:true,due:'2026-11-20'}),a,b],{seats:{video:1,photo:5,queue:6},held:[]});
  assert.equal(beyond.video.noticeDate,'2026-11-20');
  assert.deepEqual(projectSeat(s2,b),{state:'queue',noticeDate:''},'제작 중 하나뒤의 두 번째 대기는 날짜를 셀 재료가 없다');
});

test('프로젝트 자리: 자리가 있는 대기는 null, 모자라면 queue, 결제한 건 · 확인 전 건 · 세지 않는 건은 null, 먼저 확인한 건이 앞',()=>{
  const busy=[row({paid:true,due:'2026-11-20'}),row({paid:true,due:'2026-11-21'})];
  const first=row({confirmedAt:'2026-11-10T00:00:00.000Z'}),second=row({confirmedAt:'2026-11-11T00:00:00.000Z'}),paid=busy[0],fresh=row({confirmed:false}),quiet=row({quiet:30});
  const s=state([...busy,second,first,fresh,quiet]);
  assert.equal(projectSeat(s,first),null,'남은 한 자리를 먼저 확인한 건이 받는다');
  assert.deepEqual(projectSeat(s,second),{state:'queue',noticeDate:'2026-11-20'});
  for(const other of [paid,fresh])assert.equal(projectSeat(s,other),null);
  // 14일 넘게 조용한 건: 남의 대기 수에는 안 들지만 자리가 없으면 자기도 대기 — 지금 대기 뒤 차례(끝판 카본 A1).
  assert.deepEqual(projectSeat(s,quiet),{state:'queue',noticeDate:'2026-11-21'});
  const roomy=state([quiet,row({paid:true,due:'2026-11-20'})]);assert.equal(projectSeat(roomy,quiet),null,'자리가 있으면 조용한 건도 자리 있음');
  assert.equal(projectSeat(s,row({submitted:false})),null,'보내기 전 의뢰서는 자리를 말하지 않는다');
  assert.equal(seatKind({answers:{package:'photo'}}),'photo');assert.equal(seatKind({answers:{package:'corp'}}),'video');assert.equal(seatKind(null),'video');
});

test('환불(끝판 카본 A2): 제작 중 셋 · 대기 하나에서 하나를 환불하면 그 자리는 대기 1번이 받는다 — 환불한 건이 앞선 확인 시각으로 도로 차지하지 않는다',()=>{
  const a=row({paid:true,due:'2026-11-20',confirmedAt:'2026-11-01T00:00:00.000Z'}),b=row({paid:true,due:'2026-11-21'}),c=row({paid:true,due:'2026-11-22'}),d=row({confirmedAt:'2026-11-09T00:00:00.000Z'});
  assert.deepEqual(projectSeat(state([a,b,c,d]),d),{state:'queue',noticeDate:'2026-11-20'});
  const refundedA={...a,studio:{request:{...a.studio.request,payment:{...a.studio.request.payment,status:'cancelled',cancelledAt:'2026-11-12T00:00:00.000Z'}}}};
  const s=state([refundedA,b,c,d]);
  assert.deepEqual([s.video.used,s.video.waiting,s.video.order],[2,1,[d.id]]);
  assert.equal(projectSeat(s,d),null,'대기 1번이 비운 자리를 받는다');assert.equal(projectSeat(s,refundedA),null,'환불한 건은 자리 말이 없다');
  // 결제 요청만 취소한 건은 그대로 자기 차례(앞선 확인 시각)로 대기에 남는다.
  const reqCancelled={...a,studio:{request:{...a.studio.request,payment:{status:'cancelled',cancelledAt:'2026-11-12T00:00:00.000Z'}}}};
  assert.deepEqual(state([reqCancelled,b,c,d]).video.order,[reqCancelled.id,d.id]);
});

test('저장 읽기: 자리 수는 0 ~ 50 정수만(아니면 기본), 손으로 잡은 자리는 꼴이 맞는 것만 스물까지',()=>{
  assert.deepEqual(readSeats(null),{seats:{video:3,photo:5,queue:6},held:[]});
  assert.deepEqual(readSeats({seats:{video:0,photo:51,queue:'6'}}).seats,{video:0,photo:5,queue:6});
  const many=Array.from({length:25},(_,i)=>({id:i.toString(16).padStart(12,'0'),kind:i%2?'photo':'video',note:'건 '+i}));
  const held=readSeats({held:[...many,{id:'bad',kind:'video'},{id:'cccccccccccc',kind:'audio'},null]}).held;
  assert.equal(held.length,SEAT_LIMITS.held);assert.ok(held.every(item=>/^[0-9a-f]{12}$/.test(item.id)&&['video','photo'].includes(item.kind)));
});

// 가짜 저장소: 사용자 둘(관리자 · 크루) + 프로젝트 목록.
function fakeStore(rows=[]){
  const docs=new Map([['users:admin',{id:'admin',active:true,role:'admin'}],['users:crew',{id:'crew',active:true,role:'member'}]]);
  return {docs,get:(kind,id)=>docs.get(kind+':'+id)||null,put:(kind,id,value)=>{docs.set(kind+':'+id,value);},all:kind=>kind==='clientProjects'?rows:[]};
}
const ADMIN={id:'admin'},CREW={id:'crew'};

test('저장: 쉬기와 자리 몫은 서로 지우지 않고, 자리 수 · 손으로 잡은 자리는 관리자만 · 값 검사',()=>{
  const store=fakeStore(),cap=createPulseCapacity({store,clock:()=>NOW});
  assert.equal(cap.configureSeats(ADMIN,{video:2,photo:4,queue:3}).seats.video,2);
  cap.configure(ADMIN,{open:false,pauseNote:'쉬어요'});
  assert.deepEqual(readSeats(store.get('pulseCapacity','main')).seats,{video:2,photo:4,queue:3},'쉬기를 저장해도 자리 수가 남는다');
  const held=cap.configureHeld(ADMIN,{add:{kind:'video',note:'옛 흐름 촬영 건'}}).held;
  assert.equal(held.length,1);assert.match(held[0].id,/^[0-9a-f]{12}$/);
  assert.equal(cap.configureSeats(ADMIN,{video:3,photo:5,queue:6}).held.length,1,'자리 수를 바꿔도 잡은 자리가 남는다');
  assert.equal(cap.settings(ADMIN).state,'paused','자리 수를 바꿔도 쉬기가 남는다');
  cap.configure(ADMIN,{open:true});
  assert.equal(readSeats(store.get('pulseCapacity','main')).held.length,1,'다시 받기를 저장해도 잡은 자리가 남는다');
  assert.equal(cap.configureHeld(ADMIN,{remove:held[0].id}).held.length,0);
  for(const call of [()=>cap.configureSeats(CREW,{video:1,photo:1,queue:1}),()=>cap.configureHeld(CREW,{add:{kind:'video',note:'x'}})])assert.throws(call,error=>error.status===403);
  const bad=[{},{video:1,photo:1},{video:1,photo:1,queue:1,extra:1},{video:-1,photo:1,queue:1},{video:51,photo:1,queue:1},{video:1.5,photo:1,queue:1},{video:'1',photo:1,queue:1},null,[1,2,3]];
  for(const input of bad)assert.throws(()=>cap.configureSeats(ADMIN,input),error=>error.status===400,JSON.stringify(input));
  const badHeld=[{},{add:{kind:'audio',note:'x'}},{add:{kind:'video'}},{add:{kind:'video',note:''}},{add:{kind:'video',note:'가'.repeat(SEAT_LIMITS.heldNote+1)}},{add:{kind:'video',note:'줄\n바꿈'}},{add:{kind:'video',note:'x',extra:1}},{add:{kind:'video',note:'x'},remove:'a'}];
  for(const input of badHeld)assert.throws(()=>cap.configureHeld(ADMIN,input),error=>error.status===400,JSON.stringify(input));
  assert.throws(()=>cap.configureHeld(ADMIN,{remove:'000000000000'}),error=>error.status===404);
  for(let i=0;i<SEAT_LIMITS.held;i++)cap.configureHeld(ADMIN,{add:{kind:'photo',note:'건 '+i}});
  assert.throws(()=>cap.configureHeld(ADMIN,{add:{kind:'photo',note:'하나 더'}}),error=>error.status===409);
});

test('공개 응답: 열림은 상태 하나, 찬 종류와 결제 안내 예정일(둘이면 늦은 쪽 · 하나라도 모르면 없음), 둘 다 full일 때만 full, 쉬기가 앞서고 건수는 없다',()=>{
  const view=(rows,seats)=>{const store=fakeStore(rows);if(seats)store.put('pulseCapacity','main',{seats});return createPulseCapacity({store,clock:()=>NOW});};
  assert.deepEqual(view([]).publicView(),{state:'open'});
  const busy=[row({paid:true,due:'2026-11-20'}),row({paid:true,due:'2026-11-21'}),row({paid:true,due:'2026-11-22'})];
  assert.deepEqual(view(busy).publicView(),{state:'queue',kinds:['video'],noticeDate:'2026-11-20'});
  const photos=[row({kind:'photo',paid:true,due:'2026-11-25'})];
  assert.deepEqual(view([...busy,...photos],{video:3,photo:1,queue:6}).publicView(),{state:'queue',kinds:['video','photo'],noticeDate:'2026-11-25'});
  assert.deepEqual(view([...busy,row({kind:'photo',paid:true})],{video:3,photo:1,queue:6}).publicView(),{state:'queue',kinds:['video','photo'],noticeDate:''});
  const cap=view([],{video:0,photo:0,queue:0});
  assert.deepEqual(cap.publicView(),{state:'full',kinds:['video','photo'],noticeDate:''});assert.equal(cap.full(),true);
  assert.equal(view(busy,{video:3,photo:5,queue:0}).full(),false,'사진 자리가 있으면 새 의뢰서 시작은 연다');
  const both=view([],{video:0,photo:0,queue:0});both.configure(ADMIN,{open:false});
  assert.equal(both.publicView().state,'paused','쉬기가 앞선다');
  const text=JSON.stringify(view(busy).publicView());
  assert.doesNotMatch(text,/used|total|waiting|order|dues|\b3\b/,'건수 · 자리 수 · 순번을 내리지 않는다');
  // 직원 설정은 종류마다 상태 · 제작 중 · 자리 · 대기를 본다(손님에게 내리지 않는 값).
  assert.deepEqual(view(busy).settings(CREW).seatsNow.video,{state:'queue',used:3,total:3,waiting:0});
});
