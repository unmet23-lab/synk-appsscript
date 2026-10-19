'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {usageSummary,sampleOf,parseHistory,accountEvents,weightOf}=require('../src/ai-usage.cjs');

const NOW=new Date(2026,9,19,8,0).getTime(),DAY=864e5,WEEK=7*DAY,HOUR=3600e3;
const auto=(id,service,plan)=>({id,service,source:'auto',plan,kind:service==='higgsfield'||service==='typecast'?'credit':'weekly'});
// 구간마다 새 주간 창을 하나씩 두고, 창이 끝나기 한 시간 전에 그 구간 값만큼 쓴 기록(구간 0 → 지난 7일 순).
function weeklyHistory(id,service,plan,values){
  const out=[];
  values.forEach((v,k)=>{
    const start=NOW-(5-k)*WEEK,reset=k===4?NOW+HOUR:start+WEEK;
    out.push({t:start+HOUR,id,s:service,p:plan,w:0,wr:reset,c:null});
    out.push({t:(k===4?NOW:reset)-HOUR,id,s:service,p:plan,w:v,wr:reset,c:null});
  });
  return out;
}

test('keeps only the numbers of one read, never names or tokens',()=>{
  const row={...auto('r-a','claude','max_5x'),email:'someone@example.com',live:{readAt:NOW,weekly:{usedPercent:14,resetsAt:NOW+DAY},session:{usedPercent:100}}};
  // h: 한도형의 5시간 창 %(10-19 2차부터 — 요금제 맞추기가 5시간 막힘을 센다). 크레딧형에는 없다.
  assert.deepEqual(sampleOf(row,NOW),{t:NOW,id:'r-a',s:'claude',p:'max_5x',w:14,wr:NOW+DAY,c:null,h:100});
  assert.deepEqual(sampleOf({...auto('r-h','higgsfield','ultra'),live:{credits:1026.84}},NOW),{t:NOW,id:'r-h',s:'higgsfield',p:'ultra',w:null,wr:null,c:1026.84});
  // 직접 넣은 구독·숫자가 없는 읽기는 남기지 않는다.
  assert.equal(sampleOf({id:'m-1',service:'suno',live:{credits:5}},NOW),null);
  assert.equal(sampleOf({...auto('r-g','gpt','pro'),live:{}},NOW),null);
});

test('drops broken, foreign and expired history lines',()=>{
  const text=[JSON.stringify({t:NOW,id:'r-a',s:'claude',w:10,wr:NOW+DAY}),'{broken',JSON.stringify({t:NOW-200*DAY,id:'r-a',s:'claude',w:1}),JSON.stringify({t:NOW-DAY,id:'r-a',s:'evil',w:1}),''].join('\n');
  const h=parseHistory(text,NOW-180*DAY);
  assert.equal(h.length,1);assert.equal(h[0].w,10);assert.equal(h[0].c,null);
});

test('counts weekly use as growth inside a window and the new window after a reset',()=>{
  const s=(t,w,wr)=>({t,id:'r-a',s:'claude',p:'max_5x',w,wr,c:null});
  const {events,firstAt,coverFrom}=accountEvents([
    s(NOW-5*DAY,40,NOW-2*DAY),            // 첫 읽기: 그 창(NOW-9일부터)에서 쓴 40%
    s(NOW-4*DAY,55,NOW-2*DAY+60e3),       // 같은 창(초기화 시각이 1분 흔들림) → +15
    s(NOW-3*DAY,55,NOW-2*DAY),            // 그대로 → 없음
    s(NOW-DAY,10,NOW+5*DAY),              // 그사이 초기화 → 새 창의 10%
    s(NOW-HOUR,25,NOW+5*DAY),             // +15
  ]);
  assert.deepEqual(events.map(e=>e.v),[40,15,10,15]);
  assert.equal(events[0].first,true);assert.equal(firstAt,NOW-5*DAY);assert.equal(coverFrom,NOW-9*DAY);
  // 안 쓴 창(0%, 시각 없음) → 쓰기 시작한 창은 그 %만큼.
  const idle=accountEvents([s(NOW-2*DAY,0,null),s(NOW-DAY,0,null),s(NOW-HOUR,5,NOW+6*DAY)]);
  assert.deepEqual(idle.events.map(e=>e.v),[5]);
});

test('counts credits spent as balance drops and keeps refills apart',()=>{
  const s=(t,c)=>({t,id:'r-h',s:'higgsfield',p:'ultra',w:null,wr:null,c});
  const {events,refills}=accountEvents([s(NOW-3*DAY,1000),s(NOW-2*DAY,800),s(NOW-DAY,3000),s(NOW-HOUR,2900)]);
  assert.deepEqual(events.map(e=>e.v),[200,100]);
  assert.deepEqual(refills,[NOW-DAY]);
});

test('weighs Claude plans by the official multiples and averages the five 7-day bars',()=>{
  assert.equal(weightOf('claude','max_20x'),20);assert.equal(weightOf('claude','max_5x'),5);assert.equal(weightOf('claude','pro'),1);
  assert.equal(weightOf('gpt','pro'),1);
  const rows=[auto('r-a','claude','max_5x'),auto('r-b','claude','max_20x')];
  const history=[...weeklyHistory('r-a','claude','max_5x',[60,70,80,90,50]),...weeklyHistory('r-b','claude','max_20x',[20,40,40,60,80])];
  const u=usageSummary({rows,history,now:NOW});
  const c=u.services.claude;
  assert.equal(c.kind,'pct');assert.equal(c.accounts,2);assert.equal(c.mixed,true);
  // (5×A + 20×B) / 25
  assert.deepEqual(c.bars.map(b=>b.v),[28,46,48,66,74]);
  assert.ok(c.bars.every(b=>!b.partial));
  assert.equal(c.base,47);assert.equal(c.baseWeeks,4);
  assert.equal(u.buckets[4].end,NOW);assert.equal(u.buckets[0].start,NOW-5*WEEK);
  assert.equal(u.accounts['r-a'].used7,50);
  assert.equal(u.accounts['r-a'].rate3,Math.round(50/3*100)/100);
  // 지운 계정의 기록은 세지 않는다.
  const one=usageSummary({rows:[rows[0]],history,now:NOW}).services.claude;
  assert.deepEqual(one.bars.map(b=>b.v),[60,70,80,90,50]);assert.equal(one.mixed,false);
});

test('shows only what the record covers while it is young',()=>{
  const rows=[auto('r-a','claude','max_5x')];
  const s=(t,w,wr)=>({t,id:'r-a',s:'claude',p:'max_5x',w,wr,c:null});
  // 오늘 처음 읽음: 지금 창(이틀 전 시작)의 30%가 지난 7일에 들어가고, 그 앞 구간은 비고, 비교와 속도는 아직 없다.
  const first=usageSummary({rows,history:[s(NOW-HOUR,30,NOW+5*DAY)],now:NOW});
  const c=first.services.claude;
  assert.deepEqual(c.bars.slice(0,4),[null,null,null,null]);
  assert.deepEqual(c.bars[4],{v:30,partial:true});
  assert.equal(c.base,null);assert.equal(first.accounts['r-a'].rate3,null);assert.equal(first.since,NOW-HOUR);
  // 첫 창이 13일 전에 시작: 바로 앞 구간이 아직 덜 차 비교는 없다. 15일 전 시작: 앞 구간이 차서 「그 전 7일」 하나로 비교한다.
  const young=usageSummary({rows,history:[s(NOW-12*DAY,0,NOW-6*DAY),s(NOW-8*DAY,20,NOW-6*DAY),s(NOW-HOUR,40,NOW+DAY)],now:NOW}).services.claude;
  assert.deepEqual(young.bars[3],{v:20,partial:true});assert.equal(young.bars[4].v,40);
  assert.equal(young.base,null);
  const older=usageSummary({rows,history:[s(NOW-15*DAY,0,NOW-8*DAY+HOUR),s(NOW-9*DAY,50,NOW-8*DAY+HOUR),s(NOW-HOUR,40,NOW+6*DAY)],now:NOW}).services.claude;
  assert.equal(older.bars[3].partial,false);assert.equal(older.bars[2].partial,true);
  assert.equal(older.base,older.bars[3].v);assert.equal(older.baseWeeks,1);
});

test('sums credits across accounts and remembers the last refill',()=>{
  const rows=[auto('r-h','higgsfield','ultra'),auto('r-i','higgsfield','plus')];
  const s=(id,t,c)=>({t,id,s:'higgsfield',p:'ultra',w:null,wr:null,c});
  const history=[s('r-h',NOW-30*DAY,5000),s('r-h',NOW-20*DAY,4000),s('r-h',NOW-10*DAY,9000),s('r-h',NOW-5*DAY,8000),s('r-h',NOW-HOUR,7550),
    s('r-i',NOW-30*DAY,100),s('r-i',NOW-2*DAY,40)];
  const u=usageSummary({rows,history,now:NOW});
  const h=u.services.higgsfield;
  assert.equal(h.kind,'credit');assert.equal(h.accounts,2);
  assert.equal(h.bars[4].v,1000+450+60);
  assert.equal(u.accounts['r-h'].refillAt,NOW-10*DAY);
  assert.equal(u.accounts['r-h'].used7,1450);
  assert.equal(u.accounts['r-h'].perDay,Math.round(1450/7*100)/100);
});

test('a drop or a plan change inside one window is not counted as new use',()=>{
  const R=NOW+3*DAY,s=(t,w,p='max_5x')=>({t,id:'r-a',s:'claude',p,w,wr:R,c:null});
  // 같은 창에서 62% → 61%(공급자 보정)는 새 소비가 아니다.
  assert.deepEqual(accountEvents([s(NOW-3*DAY,62),s(NOW-2*DAY,61),s(NOW-DAY,70)]).events.map(e=>e.v),[62,9]);
  // 창 중간에 요금제를 올리면 %의 기준이 달라져 그 사이 소비는 모르는 것으로 둔다(80% → 20%를 20% 새 소비로 세지 않는다).
  assert.deepEqual(accountEvents([s(NOW-3*DAY,80),s(NOW-2*DAY,20,'max_20x'),s(NOW-DAY,30,'max_20x')]).events.map(e=>e.v),[80,10]);
});

test('an account connected in the middle of a week does not pull the weekly average down',()=>{
  const rows=[auto('r-a','claude','max_5x'),auto('r-b','claude','max_5x')];
  const old=weeklyHistory('r-a','claude','max_5x',[60,60,60,60,60]);
  // B는 지난 7일 구간 중간(사흘 전)에 연결해 그 창에서 10%만 썼다.
  const b=[{t:NOW-3*DAY,id:'r-b',s:'claude',p:'max_5x',w:0,wr:NOW-3*DAY+WEEK,c:null},{t:NOW-HOUR,id:'r-b',s:'claude',p:'max_5x',w:10,wr:NOW-3*DAY+WEEK,c:null}];
  const u=usageSummary({rows,history:[...old,...b],now:NOW});
  assert.deepEqual(u.services.claude.bars[4],{v:60,partial:false});
  assert.equal(u.services.claude.since,NOW-5*WEEK+HOUR);
  // 그 서비스 기록이 막 시작됐으면 그 서비스의 시작일을 따로 준다.
  const fresh=usageSummary({rows:[auto('r-t','typecast',null)],history:[{t:NOW-HOUR,id:'r-t',s:'typecast',p:null,w:null,wr:null,c:5000}],now:NOW});
  assert.equal(fresh.services.typecast.since,NOW-HOUR);
});

test('a plan read once without its tier still counts as the same plan',()=>{
  const R=NOW+3*DAY,s=(t,w,p)=>({t,id:'r-a',s:'claude',p,w,wr:R,c:null});
  // 등급을 한 번 못 읽어 max_5x가 max로 읽혀도 같은 5배라 늘어난 만큼 센다.
  assert.deepEqual(accountEvents([s(NOW-2*DAY,20,'max_5x'),s(NOW-DAY,35,'max'),s(NOW-HOUR,40,'max_5x')]).events.map(e=>e.v),[20,15,5]);
});

test('an account that changed plan weighs its older weeks by the plan it had then',()=>{
  // A는 3주 동안 Max 5x였다가 Max 20x로 올렸고, B는 내내 Pro다. 옛 구간을 지금 무게(20)로 세면 첫 막대가 42%로 줄어든다.
  const a=weeklyHistory('r-a','claude','max_5x',[40,40,40,40,40]).map(s=>s.t>=NOW-2*WEEK?{...s,p:'max_20x'}:s);
  const b=weeklyHistory('r-b','claude','pro',[80,80,80,80,80]);
  const u=usageSummary({rows:[auto('r-a','claude','max_20x'),auto('r-b','claude','pro')],history:[...a,...b],now:NOW});
  assert.equal(u.services.claude.bars[0].v,47);   // (40×5 + 80×1) ÷ (5 + 1)
  assert.equal(u.services.claude.bars[4].v,42);   // (40×20 + 80×1) ÷ (20 + 1)
  assert.equal(u.services.claude.mixed,true);
  // 한 계정이 요금제만 바꿔도 「왜 이 숫자?」가 뜨게 섞인 것으로 본다.
  assert.equal(usageSummary({rows:[auto('r-a','claude','max_20x')],history:a,now:NOW}).services.claude.mixed,true);
});

test('keeps four weeks per account for plan fitting and idle subscriptions',()=>{
  const withH=(list,h)=>list.map(s=>({...s,h}));
  const big=withH(weeklyHistory('r-big','claude','max_20x',[10,12,15,9,11]),30);
  // 셋째 주(구간 3)에 5시간 창이 꽉 찬 읽기가 한 번 있었다.
  big.push({t:NOW-WEEK-DAY,id:'r-big',s:'claude',p:'max_20x',w:5,wr:NOW-WEEK,c:null,h:100});
  const late=weeklyHistory('r-late','claude','max_5x',[0,0,0,3,4]).filter(s=>s.t>=NOW-10*DAY);
  const key=[0,1,2,3,4].map(k=>({t:NOW-(5-k)*WEEK+HOUR,id:'r-tc',s:'typecast',p:'lite',w:null,wr:null,c:114647}));
  // 실제 기록처럼 시간순으로(parseHistory가 정렬한다).
  const u=usageSummary({rows:[auto('r-big','claude','max_20x'),auto('r-late','claude','max_5x'),auto('r-tc','typecast','lite')],history:[...big,...late,...key].sort((x,y)=>x.t-y.t),now:NOW});
  const four=u.accounts['r-big'].weeks4;
  // 창마다 시작 직후와 끝나기 한 시간 전에 읽었다 — 같은 창 안의 긴 틈은 누적 %가 메우므로 4주 소비를 다 안다.
  assert.equal(four.cover,true);assert.equal(four.known,true);assert.equal(four.hCover,true);assert.equal(four.hPeak,100);
  assert.deepEqual(four.weeks.map(w=>w.used),[12,15,9,11]);
  assert.deepEqual(four.weeks.map(w=>w.peak),[12,15,9,11]);
  assert.deepEqual(four.weeks.map(w=>w.reads),[2,2,3,2]);
  // 10일 전에 연결한 계정은 4주를 덮지 못한다. 5시간 %가 없는 옛 기록은 5시간 창을 모르는 것으로 둔다.
  assert.equal(u.accounts['r-late'].weeks4.cover,false);assert.equal(u.accounts['r-late'].weeks4.hCover,false);assert.equal(u.accounts['r-late'].weeks4.hPeak,null);
  // 크레딧형: 4주 동안 잔액이 그대로면 쓴 양 0, 주간 %는 없음. 다만 일주일에 한 번 읽어서는 그 사이 충전에 가린 소비를 모른다.
  assert.deepEqual(u.accounts['r-tc'].weeks4.weeks.map(w=>[w.used,w.peak,w.reads]),[[0,null,1],[0,null,1],[0,null,1],[0,null,1]]);
  assert.equal(u.accounts['r-tc'].weeks4.cover,true);assert.equal(u.accounts['r-tc'].weeks4.known,false);
});

test('four weeks with unread stretches are not taken as unused',()=>{
  const four=(id,service,plan,history)=>usageSummary({rows:[auto(id,service,plan)],history,now:NOW}).accounts[id].weeks4;
  // 매주 15% 쓰던 20x 계정이 3주 전부터 읽기가 없다(다시 로그인·PC 꺼짐) → 그 주들은 읽은 횟수 0이고 「앎」이 아니다(Fable 2차 P1-2).
  let w4=four('r-a','claude','max_20x',weeklyHistory('r-a','claude','max_20x',[15,15,15,15,15]).filter(s=>s.t<NOW-3*WEEK));
  assert.deepEqual(w4.weeks.map(w=>w.reads),[2,0,0,0]);assert.equal(w4.known,false);
  // 창의 마지막 읽기가 끝나기 이틀 전이면 끝 무렵 소비를 모른다.
  w4=four('r-b','claude','max_20x',weeklyHistory('r-b','claude','max_20x',[10,10,10,10,10]).map(s=>(s.t===NOW-2*WEEK-HOUR?{...s,t:NOW-2*WEEK-2*DAY}:s)));
  assert.equal(w4.known,false);
  // 창 하나를 통째로 못 읽으면 앞뒤 창을 끝나기 직전에 읽었어도 모른다.
  w4=four('r-c','claude','max_20x',weeklyHistory('r-c','claude','max_20x',[10,10,10,10,10]).filter(s=>!(s.t>NOW-3*WEEK&&s.t<NOW-2*WEEK)));
  assert.equal(w4.known,false);assert.equal(w4.weeks[1].reads,0);
  // 크레딧형은 읽기 사이가 모두 이틀 안이면 안다.
  w4=four('r-tc','typecast','lite',[...Array(30)].map((_,i)=>({t:NOW-(29-i)*DAY,id:'r-tc',s:'typecast',p:'lite',w:null,wr:null,c:5000})));
  assert.equal(w4.known,true);assert.deepEqual(w4.weeks.map(w=>w.used),[0,0,0,0]);
  // 창이 없던 읽기(안 씀) 뒤 12일을 못 읽으면 그 사이에 창 하나가 통째로 시작하고 끝났을 수 있다(Fable 2차 반영 확인 P2).
  const idle=(id,points)=>points.map(([t,w,wr])=>({t,id,s:'claude',p:'max_5x',w,wr,c:null}));
  const daily=k=>[...Array(k)].map((_,i)=>i);
  w4=four('r-n','claude','max_5x',idle('r-n',[...daily(14).map(i=>[NOW-(29-i)*DAY,0,null]),...daily(14).map(i=>[NOW-(13-i)*DAY,0,null])]));
  assert.equal(w4.known,true);
  w4=four('r-n','claude','max_5x',idle('r-n',[...daily(10).map(i=>[NOW-(29-i)*DAY,0,null]),[NOW-8*DAY,2,NOW-2*DAY],...daily(3).map(i=>[NOW-(2-i)*DAY,0,null])]));
  assert.equal(w4.known,false);
  // 창이 끝난 뒤 다음 읽기에 창이 없어도, 옛 창이 끝나고 7일 넘게 지난 읽기면 그 사이 창을 모른다.
  w4=four('r-e','claude','max_5x',idle('r-e',[[NOW-29*DAY,0,null],[NOW-24*DAY,3,NOW-20*DAY],[NOW-20*DAY-HOUR,4,NOW-20*DAY],[NOW-10*DAY,0,null],...daily(10).map(i=>[NOW-(9-i)*DAY,0,null])]));
  assert.equal(w4.known,false);
});

test('weighs the four weeks by the plan of the time and ignores a read that lost its Max tier',()=>{
  // Max 5x에서 40%씩 쓰다가 2주 전 Max 20x로 올리고 10%씩 — 지금(20x) 기준으로는 4주 모두 10%.
  const moved=weeklyHistory('r-m','claude','max_5x',[40,40,40,10,10]).map(s=>(s.t>=NOW-2*WEEK?{...s,p:'max_20x'}:s));
  let u=usageSummary({rows:[auto('r-m','claude','max_20x')],history:moved,now:NOW});
  assert.deepEqual(u.accounts['r-m'].weeks4.weeks.map(w=>[w.used,w.peak]),[[10,10],[10,10],[10,10],[10,10]]);
  // 등급을 한 번 못 읽어 「max」로 남은 읽기는 앞뒤 등급을 따른다 — 막대가 120%로 부풀지 않고 「왜 이 숫자?」도 켜지지 않는다(Fable 2차 P1-4).
  const b=weeklyHistory('r-b','claude','max_20x',[40,40,40,40,40]);
  b.splice(b.length-1,0,{...b[b.length-1],t:b[b.length-1].t-2*DAY,w:30});
  u=usageSummary({rows:[auto('r-b','claude','max_20x')],history:b.map((s,i)=>(i===b.length-1?{...s,p:'max'}:s)),now:NOW});
  assert.deepEqual(u.services.claude.bars.map(x=>x.v),[40,40,40,40,40]);assert.equal(u.services.claude.mixed,false);
  // 요금제를 보이는 다섯 구간보다 앞(6주 전)에 바꿨으면 「왜 이 숫자?」를 켜지 않는다(Fable 2차 P2-3).
  u=usageSummary({rows:[auto('r-o','claude','max_20x')],history:[{t:NOW-6*WEEK,id:'r-o',s:'claude',p:'max_5x',w:10,wr:NOW-6*WEEK+DAY,c:null},...weeklyHistory('r-o','claude','max_20x',[10,10,10,10,10])],now:NOW});
  assert.equal(u.services.claude.mixed,false);
});

/* ---------- 3차(10-19): 지난 12주 — 연간 결제 팁의 「12주 내내 꾸준히」 ---------- */
// 12주 동안 주마다 새 창을 열고 끝나기 한 시간 전에 그 주 값을 읽은 기록(맨 앞은 12주보다 하루 이른 첫 읽기).
function twelveWeeks(id,service,plan,values){
  const out=[{t:NOW-12*WEEK-DAY,id,s:service,p:plan,w:0,wr:NOW-12*WEEK+HOUR,c:null}];
  values.forEach((v,k)=>{
    const start=NOW-(12-k)*WEEK,reset=k===11?NOW+HOUR:start+WEEK;
    out.push({t:start+2*HOUR,id,s:service,p:plan,w:0,wr:reset,c:null});
    out.push({t:(k===11?NOW:reset)-HOUR,id,s:service,p:plan,w:v,wr:reset,c:null});
  });
  return out;
}
test('keeps twelve weeks of plain use per account for the yearly-billing tip',()=>{
  const values=[45,52,48,55,60,58,62,57,66,61,59,64];
  let u=usageSummary({rows:[auto('r-p','claude','pro')],history:twelveWeeks('r-p','claude','pro',values),now:NOW});
  const w12=u.accounts['r-p'].weeks12;
  assert.equal(w12.cover,true);assert.equal(w12.samePlan,true);assert.equal(w12.weeks.length,12);
  assert.deepEqual(w12.weeks.map(w=>w.used),values);assert.ok(w12.weeks.every(w=>w.reads>=1));
  // 첫 읽기가 12주 안이면 덮지 못한 것으로 본다(첫 읽기의 누적 %가 12주 안 소비로 들어오지 않게).
  u=usageSummary({rows:[auto('r-p','claude','pro')],history:twelveWeeks('r-p','claude','pro',values).slice(3),now:NOW});
  assert.equal(u.accounts['r-p'].weeks12.cover,false);
  // 읽지 못한 주는 0으로 남고 읽은 횟수도 0 — 「많이 썼다」를 부풀리지 않는 쪽이다.
  const gap=twelveWeeks('r-p','claude','pro',values).filter(s=>!(s.t>=NOW-8*WEEK&&s.t<NOW-7*WEEK));
  u=usageSummary({rows:[auto('r-p','claude','pro')],history:gap,now:NOW});
  assert.deepEqual([u.accounts['r-p'].weeks12.weeks[4].reads,u.accounts['r-p'].weeks12.weeks[4].used],[0,0]);
  // 12주 안에 Max에서 Pro로 내린 계정은 옛 구간이 지금 무게로 부풀어 보이므로 같은 요금제가 아니라고 알린다(Fable 3차 시안 P3-3).
  const moved=twelveWeeks('r-p','claude','pro',values).map(s=>(s.t<NOW-6*WEEK?{...s,p:'max_5x'}:s));
  u=usageSummary({rows:[auto('r-p','claude','pro')],history:moved,now:NOW});
  assert.equal(u.accounts['r-p'].weeks12.samePlan,false);assert.ok(u.accounts['r-p'].weeks12.weeks[0].used>100);
  // 크레딧형은 잔액이 준 만큼, 지금 요금제 기준(Claude 무게는 1배인 Pro라 그대로).
  const credit=[{t:NOW-12*WEEK-DAY,id:'r-h',s:'higgsfield',p:'ultra',w:null,wr:null,c:9000}];
  for(let k=0,c=9000;k<12;k++){c-=700;credit.push({t:NOW-(11-k)*WEEK-HOUR,id:'r-h',s:'higgsfield',p:'ultra',w:null,wr:null,c});}
  u=usageSummary({rows:[auto('r-h','higgsfield','ultra')],history:credit,now:NOW});
  assert.equal(u.accounts['r-h'].weeks12.cover,true);assert.equal(u.accounts['r-h'].weeks12.samePlan,true);assert.deepEqual(u.accounts['r-h'].weeks12.weeks.map(w=>w.used),Array(12).fill(700));
  // 크레딧형은 무게가 늘 1이라 요금제 이름으로 견준다 — Ultra에서 Plus로 내린 계정은 같은 요금제가 아니다(구현 검수 P3-A).
  u=usageSummary({rows:[auto('r-h','higgsfield','plus')],history:credit.map(s=>(s.t>=NOW-4*WEEK?{...s,p:'plus'}:s)),now:NOW});
  assert.equal(u.accounts['r-h'].weeks12.samePlan,false);
});
