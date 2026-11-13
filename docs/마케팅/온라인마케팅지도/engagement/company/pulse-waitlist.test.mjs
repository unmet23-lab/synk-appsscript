// PULSE 알림 명단(2026-11-14 운영 조각 6-C, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2) — 등록 · 보내기 · 지우기(가짜 저장소 · 메일 · 자리).
// 실제 서버 길(같은 출처 · 접속 주소 문턱 · 공개 상태의 notify · 메일 한 통)은 pulse-presale-server.test.mjs 「운영 조각 6-C」가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPulseWaitlist,pulseWaitlistMail,PULSE_WAITLIST,PULSE_WAITLIST_LIMITS} from './pulse-waitlist.mjs';
import {openingsOf} from './pulse-capacity.mjs';

const START=Date.parse('2026-11-14T03:00:00.000Z');
function fixture({active=true,full=true,paused=false,openings=0}={}){
  const docs=new Map(),sent=[];let now=START;
  const store={all:kind=>[...(docs.get(kind)||new Map()).values()],get:(kind,id)=>docs.get(kind)?.get(id)||null,put:(kind,id,value)=>{if(!docs.has(kind))docs.set(kind,new Map());docs.get(kind).set(id,structuredClone(value));},remove:(kind,id)=>docs.get(kind)?.delete(id)};
  const mail={on:active,verdict:()=>({kind:'sent',code:'sent'}),active(){return this.on;},addressKey:email=>'h:'+email,async sendDirect(job){sent.push(job);return this.verdict(job);}};
  const cap={full,paused,openings,full(){return this.isFull;},paused(){return this.isPaused;},openings(){return this.open;}};cap.isFull=full;cap.isPaused=paused;cap.open=openings;
  const list=createPulseWaitlist({store,pulseMail:mail,capacity:cap,clock:()=>new Date(now).toISOString()});
  return {list,store,mail,cap,sent,rows:()=>store.all(PULSE_WAITLIST),advance:ms=>{now+=ms;}};
}

test('등록: 대기까지 찬 동안 · 메일이 켜져 있을 때만, 꼴을 보고 늘 같은 답 — 같은 주소는 한 줄, 손님이 적은 글은 받지 않는다',()=>{
  const f=fixture();
  assert.deepEqual(f.list.register({email:' Buyer@Pulse-Synthetic.TEST ',locale:'en'}),{ok:true});
  assert.deepEqual(f.list.register({email:'buyer@pulse-synthetic.test'}),{ok:true},'이미 있는 주소도 같은 답');
  assert.equal(f.rows().length,1);
  const [row]=f.rows();
  assert.deepEqual([row.email,row.locale,row.state,row.addressKey],['buyer@pulse-synthetic.test','en','waiting','h:buyer@pulse-synthetic.test']);
  assert.deepEqual(f.list.register({email:'bot@pulse-synthetic.test',website:'x'}),{ok:true},'덫 칸이 차 있으면 같은 답만');
  assert.equal(f.rows().length,1);
  assert.equal(f.list.register({email:'ko@pulse-synthetic.test',locale:'fr'})&&f.rows().find(item=>item.email==='ko@pulse-synthetic.test').locale,'ko','모르는 언어는 한국어');
  for(const bad of [null,[],{email:'x'},{email:'a@b.c',note:'메모'},{email:'no-at'}])assert.throws(()=>f.list.register(bad),{status:400});
});

test('등록을 받지 않는 때: 메일 꺼짐 409 · 대기까지 차지 않음 · 쉬는 중 409(화면이 다시 읽어 시작 단추) · 명단이 참 409',()=>{
  const off=fixture({active:false});
  assert.throws(()=>off.list.register({email:'a@pulse-synthetic.test'}),{status:409,code:'SYNK_PULSE_WAITLIST_OFF'});
  const open=fixture({full:false});
  assert.throws(()=>open.list.register({email:'a@pulse-synthetic.test'}),{status:409,code:'SYNK_PULSE_WAITLIST_OPEN'});
  const resting=fixture({paused:true});
  assert.throws(()=>resting.list.register({email:'a@pulse-synthetic.test'}),{status:409,code:'SYNK_PULSE_INTAKE_PAUSED',message:'지금은 잠시 접수를 쉬어요. 다시 열리면 이 화면에서 바로 시작하실 수 있어요.'},'쉬는 동안은 명단을 받지 않는다(쉬기 안내가 선다) — 「바로 시작」이라 하지 않는다');
  assert.throws(()=>open.list.register({email:'a@pulse-synthetic.test'}),{message:'그 사이 자리가 났어요. 이 화면에서 바로 시작하실 수 있어요.'});
  const f=fixture();
  for(let i=0;i<PULSE_WAITLIST_LIMITS.size;i++)f.list.register({email:`p${i}@pulse-synthetic.test`});
  assert.throws(()=>f.list.register({email:'late@pulse-synthetic.test'}),{status:409,code:'SYNK_PULSE_WAITLIST_FULL'});
  assert.throws(()=>f.list.register({email:'p0@pulse-synthetic.test'}),{status:409,code:'SYNK_PULSE_WAITLIST_FULL'},'명단이 찼으면 이미 있는 주소에도 같은 409 — 답으로 명단에 있는지 드러나지 않는다');
});

test('보내기: 자리가 난 만큼 남긴 차례로 한 통씩 · 보내면 주소 원문을 지움 · 이틀 안에 알린 수는 빼고 · 하루 스무 통까지',async()=>{
  const f=fixture();
  for(const name of ['first','second','third'])f.list.register({email:`${name}@pulse-synthetic.test`}),f.advance(1000);
  assert.deepEqual(await f.list.tick(),{sent:0,waiting:3},'아직 자리가 없으면 보내지 않는다');
  f.cap.isFull=false;f.cap.open=2;
  assert.deepEqual(await f.list.tick(),{sent:2,waiting:1});
  assert.deepEqual(f.sent.map(job=>job.to),['first@pulse-synthetic.test','second@pulse-synthetic.test'],'먼저 남긴 차례');
  assert.match(f.sent[0].key,/^waitlist:/);
  const done=f.rows().filter(row=>row.state==='sent');
  assert.equal(done.length,2);assert.ok(done.every(row=>!Object.hasOwn(row,'email')),'보낸 뒤에는 주소 원문이 없다');
  assert.deepEqual(await f.list.tick(),{sent:0,waiting:1},'같은 두 자리로 다시 부르지 않는다(이틀 안에 알린 둘을 뺀다)');
  f.cap.open=3;assert.deepEqual(await f.list.tick(),{sent:1,waiting:0},'자리가 하나 더 나면 다음 차례');
  f.advance(PULSE_WAITLIST_LIMITS.sentKeepMs+1000);await f.list.tick();
  assert.equal(f.rows().length,0,'알린 기록은 이틀 뒤에 지운다');
  // 하루 스무 통.
  const g=fixture();for(let i=0;i<30;i++)g.list.register({email:`d${i}@pulse-synthetic.test`});
  g.cap.isFull=false;g.cap.open=100;
  assert.equal((await g.list.tick()).sent,PULSE_WAITLIST_LIMITS.daily);
  assert.equal((await g.list.tick()).sent,0);
  // 주소당 하루 한 통: 오늘 알린 주소가 다시 남기면 그 줄은 두고(뒤 사람은 받는다) 하루가 지난 뒤에 보낸다.
  const h=fixture();h.list.register({email:'again@pulse-synthetic.test'});h.cap.isFull=false;h.cap.open=1;
  assert.equal((await h.list.tick()).sent,1);
  h.cap.isFull=true;h.list.register({email:'again@pulse-synthetic.test'});h.advance(1000);h.list.register({email:'next@pulse-synthetic.test'});h.cap.isFull=false;h.cap.open=5;
  assert.deepEqual(await h.list.tick(),{sent:1,waiting:1},'오늘 알린 주소는 다시 보내지 않고 다음 사람에게');
  assert.equal(h.sent.at(-1).to,'next@pulse-synthetic.test');
  h.advance(86400000);assert.deepEqual(await h.list.tick(),{sent:1,waiting:0},'하루가 지나면 보낸다');
  assert.equal(h.sent.at(-1).to,'again@pulse-synthetic.test');
});

test('못 보낸 때: 끊김은 그 차례를 지키고 다음 바퀴로(다섯 번이면 접음) · 받을 수 없는 주소는 지움 · 메일이 꺼지면 돌지 않음 · 90일 지나면 지움',async()=>{
  const f=fixture();
  f.list.register({email:'a@pulse-synthetic.test'});f.advance(1000);f.list.register({email:'b@pulse-synthetic.test'});
  f.cap.isFull=false;f.cap.open=2;
  f.mail.verdict=()=>({kind:'retry',code:'network'});
  assert.deepEqual(await f.list.tick(),{sent:0,waiting:2},'끊기면 멈추고 다음 바퀴');
  assert.equal(f.sent.length,1,'첫 차례에서 멈춘다(뒤 사람이 앞지르지 않게)');
  assert.equal(f.rows().find(row=>row.email==='a@pulse-synthetic.test').attempts,1);
  // 다시 보낼 때는 간격을 늘려 간다(5분 · 15분 · 1시간 · 3시간) — 그 전 바퀴는 묻지 않고, 뒤 사람도 기다린다(카본 다시 검수 A1).
  await f.list.tick();assert.equal(f.sent.length,1,'5분이 안 됐으면 묻지 않는다');
  f.advance(PULSE_WAITLIST_LIMITS.retryMs[0]);await f.list.tick();assert.equal(f.sent.length,2,'5분 뒤 다시');
  for(const wait of PULSE_WAITLIST_LIMITS.retryMs.slice(1)){
    f.advance(wait-1000);await f.list.tick();
    f.advance(1000);await f.list.tick();
  }
  assert.deepEqual(f.sent.map(job=>job.to),Array(5).fill('a@pulse-synthetic.test'),'간격 전에는 묻지 않고 뒤 사람이 앞지르지 않는다');
  assert.equal(f.rows().some(row=>row.email==='a@pulse-synthetic.test'),false,'다섯 번 못 보내면 접는다(네 시간 넘게 지나서)');
  f.mail.verdict=job=>job.to.startsWith('b@')?{kind:'failed',code:'to'}:{kind:'sent',code:'sent'};
  await f.list.tick();assert.equal(f.rows().length,0,'받을 수 없는 주소는 지운다');
  const g=fixture();g.list.register({email:'c@pulse-synthetic.test'});g.cap.isFull=false;g.cap.open=1;g.mail.on=false;
  assert.deepEqual(await g.list.tick(),{sent:0,waiting:1});assert.equal(g.sent.length,0);
  g.mail.on=true;g.cap.isFull=true;g.advance(PULSE_WAITLIST_LIMITS.keepDays*86400000+1000);g.list.register({email:'d@pulse-synthetic.test'});
  assert.deepEqual(g.rows().map(row=>row.email),['d@pulse-synthetic.test'],'90일 지난 줄은 지운다');
});

test('검수 고침(카본 서버): 중계 한도 · 꺼짐 · 연결 문제는 시도로 세지 않음 · 메일이 꺼져도 지우기는 돎 · 알린 줄은 남긴 날과 상관없이 이틀 · 보내는 사이 빈자리가 줄면 멈춤',async()=>{
  // A2: 중계 하루 한도(cap) · 꺼짐(off) · 연결 문제(broken)는 몇 바퀴를 돌아도 그 차례를 지우지 않는다.
  for(const kind of ['cap','off','broken']){
    const f=fixture();f.list.register({email:'a@pulse-synthetic.test'});f.advance(1000);f.list.register({email:'b@pulse-synthetic.test'});
    f.cap.isFull=false;f.cap.open=2;f.mail.verdict=()=>({kind,code:kind});
    for(let i=0;i<PULSE_WAITLIST_LIMITS.attempts+2;i++)assert.deepEqual(await f.list.tick(),{sent:0,waiting:2},kind);
    assert.equal(f.sent.length,kind==='cap'?1:PULSE_WAITLIST_LIMITS.attempts+2,`${kind}: 한 바퀴에 첫 차례 하나만 묻고 멈춘다(하루 한도면 한 시간은 묻지 않는다)`);
    assert.equal(f.rows().find(row=>row.email==='a@pulse-synthetic.test').attempts,0,`${kind}: 시도로 세지 않는다`);
    f.mail.verdict=()=>({kind:'sent',code:'sent'});
    if(kind==='cap'){f.advance(PULSE_WAITLIST_LIMITS.capHoldMs-1000);assert.deepEqual(await f.list.tick(),{sent:0,waiting:2},'한도 뒤 한 시간 안');f.advance(1000);}
    assert.deepEqual(await f.list.tick(),{sent:2,waiting:0},`${kind}: 풀리면 차례대로 보낸다`);
  }
  // A3: 메일이 꺼진 채여도 90일 지난 기다리는 줄 · 이틀 지난 알린 줄은 지운다.
  const g=fixture();g.list.register({email:'old@pulse-synthetic.test'});g.mail.on=false;
  g.advance(PULSE_WAITLIST_LIMITS.keepDays*86400000+1000);
  assert.deepEqual(await g.list.tick(),{sent:0,waiting:0});assert.equal(g.rows().length,0,'메일이 꺼져 있어도 지운다');
  // A4: 남긴 지 89일에 알린 줄도 알린 뒤 이틀은 남아 「이미 알린 수」 · 주소당 하루 한 통에 든다.
  const h=fixture();h.list.register({email:'late@pulse-synthetic.test'});h.advance(89*86400000);
  h.cap.isFull=false;h.cap.open=1;assert.equal((await h.list.tick()).sent,1);
  h.advance(36*3600000);await h.list.tick();
  assert.deepEqual(h.rows().map(row=>row.state),['sent'],'남긴 지 90일이 넘어도 알린 지 이틀이 안 됐으면 남긴다');
  h.advance(13*3600000);await h.list.tick();assert.equal(h.rows().length,0,'알린 지 이틀이면 지운다');
  // A5: 보내는 사이 빈자리가 줄면(쉬기 · 자리 줄임 · 다른 손님의 시작) 그 자리에서 멈춘다.
  const k=fixture();for(const name of ['one','two','three'])k.list.register({email:`${name}@pulse-synthetic.test`}),k.advance(1000);
  k.cap.isFull=false;k.cap.open=3;k.mail.verdict=()=>{k.cap.open=0;return {kind:'sent',code:'sent'};};
  assert.deepEqual(await k.list.tick(),{sent:1,waiting:2},'첫 통을 보내는 사이 자리가 0이 되면 둘째는 보내지 않는다');
  const m=fixture();m.list.register({email:'x@pulse-synthetic.test'});m.advance(1000);m.list.register({email:'y@pulse-synthetic.test'});
  m.cap.isFull=false;m.cap.open=2;m.mail.verdict=()=>{m.mail.on=false;return {kind:'sent',code:'sent'};};
  assert.deepEqual(await m.list.tick(),{sent:1,waiting:1},'보내는 사이 메일이 꺼지면 멈춘다');
});

test('메일 글: 한 · 영, 의뢰서를 바로 여는 주소 · 한 번만 보낸다는 말, 손님이 적은 글은 없다',()=>{
  const ko=pulseWaitlistMail('ko'),en=pulseWaitlistMail('en'),other=pulseWaitlistMail('fr');
  assert.equal(ko.subject,'〔SYNK PULSE〕 제작 자리가 났어요');
  assert.match(ko.body,/\nhttps:\/\/workspace\.synk\.im\/pulse-app\/\?start=request\n/);
  assert.match(ko.body,/이 알림은 한 번만 보내 드리고, 주소는 알림 명단에서 지웠어요\./);
  assert.equal(en.subject,'〔SYNK PULSE〕 A production spot just opened up');
  assert.match(en.body,/\nhttps:\/\/workspace\.synk\.im\/pulse-app\/\?start=request&lang=en\n/);
  assert.doesNotMatch(en.body,/[가-힣]/,'영어 메일에 한글이 남지 않는다');
  assert.deepEqual(other,ko);
});

test('부를 수 있는 사람 수(openingsOf): 대기까지 찬 종류만 있으면 0, 아니면 남은 대기 자리 + 빈 제작 자리',()=>{
  const kind=(state,used,total,waiting)=>({state,used,total,waiting});
  assert.equal(openingsOf({video:kind('full',3,3,1),photo:kind('full',5,5,0),queue:{used:6,total:6}}),0);
  assert.equal(openingsOf({video:kind('queue',3,3,1),photo:kind('full',5,5,0),queue:{used:5,total:6}}),1,'대기 자리 하나');
  assert.equal(openingsOf({video:kind('open',1,3,0),photo:kind('queue',5,5,1),queue:{used:1,total:6}}),7,'대기 다섯 + 영상 빈 자리 둘');
  assert.equal(openingsOf({video:kind('queue',1,3,2),photo:kind('open',0,5,0),queue:{used:2,total:6}}),9,'제작 자리를 기다리는 건이 쓸 빈자리는 세지 않는다(대기 넷 + 사진 다섯)');
});
