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
  assert.deepEqual(sampleOf(row,NOW),{t:NOW,id:'r-a',s:'claude',p:'max_5x',w:14,wr:NOW+DAY,c:null});
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
