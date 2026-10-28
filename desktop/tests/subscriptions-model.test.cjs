'use strict';
// 구독 계정판 계산(subscriptions-model.mjs, 10-23 감사 C10) — DOM 없이 스냅숏과 고정 시각만 넣어 숫자·기간·기준을 본다.
// 숫자는 화면 시험(subscriptions-view.test.cjs)이 그린 글과 같은 값이다($44 · $360 · ₩1,727,600 · 약 ₩1,183,000 · 68% · $110 · $88 · 2.3배).
const test=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULT_PRICES}=require('../src/ai-prices.cjs');
const model=import('../renderer/subscriptions-model.mjs');

const D=864e5,H=3600e3;
// 금요일 오전 10시. 결제일·달 경계는 시험마다 따로 고정한다.
const NOW=new Date(2026,9,23,10,0).getTime();
let serial=0;
const row=extra=>({id:'r'+(++serial),service:'claude',source:'auto',label:'Claude',kind:'weekly',state:'ok',email:'member@example.com',price:null,currency:'KRW',billDay:null,credits:null,creditsAt:null,lowAt:null,resetDay:null,resetHour:null,resetMinute:null,usedUpAt:null,note:'',live:null,...extra});
const gpt=(id,live,extra={})=>row({id,service:'gpt',label:'ChatGPT · Codex',email:`${id}@example.com`,plan:'pro',live:{readAt:NOW,...live},...extra});
const dayText=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const priceBook=(checkedAt=NOW,deals=[])=>({services:Object.fromEntries(Object.entries(DEFAULT_PRICES.services).map(([k,v])=>[k,{...v,checked:dayText(checkedAt)}])),deals});
const four=(values,extra={})=>({cover:true,known:true,hCover:true,hPeak:10,weeks:values.map(v=>({used:v,peak:v,reads:2})),...extra});
const twelve=(values,extra={})=>({cover:true,samePlan:true,weeks:values.map(v=>({used:v,reads:3})),...extra});
const credit4=v=>({cover:true,known:true,hCover:false,hPeak:null,weeks:v.map(x=>({used:x,peak:null,reads:9}))});
const snap=(rows,accounts={},{settings={},prices=priceBook(),services={},now=NOW}={})=>({ok:true,rows,settings:{usdKrw:1400,...settings},usage:{since:now-40*D,buckets:[],services,accounts},prices});
const won1000=v=>Math.round(v/1000)*1000;

test('the screen module re-exports every moved calculation as the same function',async()=>{
  const m=await model,screen=await import('../renderer/subscriptions.mjs');
  for(const name of ['hasReset','nextReset','isUsedUp','nextBill','balance','isLow','leftPercent','usedShown','limitGauge','gaugeLevel','planName','nameOf','accountState','passesOf','serviceGroups','upcoming','costSummary','freshness'])assert.equal(screen[name],m[name],name);
  // 한눈에 순서와 짧은 이름은 같은 다섯 서비스다(화면의 AUTO 표도 이 이름을 쓴다).
  assert.deepEqual([...m.ORDER].sort(),Object.keys(m.SHORT).sort());
  assert.deepEqual(m.GOAL_KEYS,['save','smooth','unsure']);
});

test('the price table is trusted for 60 days, adds Korean VAT to the cent and prices only unpriced auto rows',async()=>{
  const {priceTable,planPrice,officialPrice}=await model;
  // 확인한 날 0시부터 60일까지(<=). 60일째 날짜에 시각이 지나면 문 밖이다.
  const midnight=new Date(2026,9,23).getTime();
  assert.ok(priceTable(priceBook(midnight-60*D),'claude',midnight));
  assert.ok(priceTable(priceBook(NOW-59*D),'claude',NOW));
  assert.equal(priceTable(priceBook(NOW-60*D),'claude',NOW),null);
  assert.equal(priceTable({services:{claude:{checked:'2026-10-19'}}},'claude',NOW),null);
  assert.equal(priceTable(null,'claude',NOW),null);
  // 한국 결제 값: Claude 기본값 $20 · $200 · $100 · $200에 부가세 10%. Higgsfield는 세금 별도라 그대로.
  const claude=priceTable(priceBook(),'claude',NOW),higgs=priceTable(priceBook(),'higgsfield',NOW);
  assert.deepEqual([planPrice(claude,'pro'),planPrice(claude,'max5x'),planPrice(claude,'max20x'),planPrice(claude,'team')],[{month:22,year:220},{month:110,year:null},{month:220,year:null},null]);
  assert.deepEqual(planPrice(higgs,'ultra'),{month:129,year:1188});
  assert.equal(claude.at,new Date(2026,9,23).getTime());
  assert.deepEqual(planPrice({krVat:0.1,plans:{x:{month:19.99,year:199.99}}},'x'),{month:21.99,year:219.99});
  // 공식 요금은 요금을 넣지 않은 자동 연결 줄만. 연간으로 표시한 줄은 1년 치의 12분의 1, 30일 넘게 못 읽힌 줄은 끊었을 수 있어 비운다.
  const prices=priceBook(),max5=row({plan:'max_5x',live:{readAt:NOW}});
  assert.deepEqual([officialPrice(prices,max5,NOW).price,officialPrice(prices,max5,NOW).currency],[110,'USD']);
  assert.equal(officialPrice(prices,{...max5,price:150000},NOW),null);
  assert.equal(officialPrice(prices,{...max5,source:'manual'},NOW),null);
  assert.equal(officialPrice(prices,row({plan:'pro',cycle:'annual'}),NOW).price,220/12);
  assert.equal(officialPrice(prices,row({plan:'max_5x',state:'needs-login',live:{readAt:NOW-31*D}}),NOW),null);
  assert.equal(officialPrice(prices,row({plan:'max_5x',state:'error',live:{readAt:NOW-29*D}}),NOW).price,110);
  assert.equal(officialPrice(prices,row({service:'gpt',plan:'pro'}),NOW),null);
  assert.equal(officialPrice(priceBook(NOW-61*D),max5,NOW),null);
});

test('bills: month-end days clamp to the last day, yearly rows never count as a monthly bill, and the list keeps undated rows last',async()=>{
  const {nextBill,nextMonthlyBill,billList,monthlyBill}=await model;
  const nov20=new Date(2026,10,20,10,0).getTime(),nov30=new Date(2026,10,30,23,0).getTime(),feb28=new Date(2027,1,28,0,20).getTime();
  assert.deepEqual([nextBill(31,nov20),nextBill(31,nov30),nextBill(31,feb28),nextBill(30,feb28),nextBill(1,nov30),nextBill(null,nov20)],[10,0,0,0,1,null]);
  assert.equal(monthlyBill(row({billDay:3,cycle:'annual'}),NOW),null);
  const rows=[row({id:'y',billDay:24,cycle:'annual',price:200,currency:'USD'}),row({id:'far',billDay:3,price:9900}),row({id:'soon',billDay:25,price:29000}),row({id:'tbl',plan:'max_5x'}),row({id:'none'})];
  const next=nextMonthlyBill(rows,NOW);
  assert.deepEqual([next.row.id,next.days,next.at],['soon',2,new Date(2026,9,25).getTime()]);
  // 결제일 없는 공식 요금 줄과 연간 줄은 맨 뒤(99로 센다), 요금도 결제일도 없는 줄은 빠진다.
  assert.deepEqual(billList(priceBook(),rows,NOW).map(x=>[x.row.id,x.days,x.official?.price??null]),[['soon',2,null],['far',11,null],['y',null,null],['tbl',null,110]]);
  assert.equal(nextMonthlyBill([row({billDay:3,cycle:'annual'})],NOW),null);
});

test('the captured scene adds up: 1,727,600 a month, about 1,183,000 used, 68%, room on u27',async()=>{
  const {costOf,monthSummary,annualTips}=await model;
  const NOW3=new Date(2026,10,20,16,0).getTime();
  const c=(id,plan)=>row({id,email:`${id}@example.com`,plan,live:{readAt:NOW3,weekly:{usedPercent:20,resetsAt:NOW3+3*D}}});
  const h=(id,plan)=>row({id,service:'higgsfield',label:'Higgsfield',kind:'credit',email:`${id}@example.com`,plan,live:{readAt:NOW3,credits:500},credits:500,creditsAt:NOW3});
  const rows=[c('synk','max_20x'),c('founder','max_20x'),c('u23','max_5x'),c('u25','max_5x'),c('u27','max_5x'),c('y77','max_5x'),c('u29','pro'),h('h77','ultra'),h('h23','plus'),h('hf','ultra'),
    row({id:'tc',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'FjrE',plan:'lite',price:21000,currency:'KRW',live:{readAt:NOW3,credits:114647,planCredits:200000},credits:114647,creditsAt:NOW3})];
  const W4={synk:[62,70,81,75],founder:[88,92,95,90],u23:[40,55,48,52],u25:[30,35,28,40],u27:[2,0,4,1],y77:[60,66,58,70],u29:[55,61,48,66]},C4={hf:[700,820,760,690],h77:[600,700,650,500],h23:[300,250,280,260],tc:[30000,25000,41000,22000]};
  const accounts={};
  for(const [id,v] of Object.entries(W4))accounts[id]={weeks4:four(v)};
  for(const [id,v] of Object.entries(C4))accounts[id]={weeks4:credit4(v)};
  accounts.u29.weeks12=twelve([45,52,48,55,60,58,62,57,66,61,59,64]);accounts.hf.weeks12=twelve([700,820,760,690,720,800,750,710,690,760,820,700]);
  const s=snap(rows,accounts,{now:NOW3,prices:priceBook(new Date(2026,9,19).getTime(),[{service:'higgsfield',plans:['plus','ultra'],cycle:'year',from:'2026-11-27',until:'2026-12-01',checked:'2026-11-10',source:'higgsfield-pricing',off:30}])});
  const cost=costOf(s,rows,NOW3);
  assert.deepEqual([cost.approx,cost.krw,cost.usd,cost.count,cost.official,cost.unknown],[1727600,21000,1219,11,10,0]);
  const sum=monthSummary(s,rows,NOW3);
  assert.deepEqual([sum.total,won1000(sum.worth),sum.pct,sum.items.length,sum.priced.length,sum.room.row.id,Math.round(sum.room.share*100)],[1727600,1183000,68,11,11,'u27',2]);
  assert.deepEqual([sum.hasMoney,sum.rate,sum.usd,sum.guessed,sum.unpriced,sum.tables.map(t=>t.service)],[true,1400,true,true,0,['claude','higgsfield']]);
  // 계정별 목록은 쓴 몫이 작은 계정부터, 같은 몫이면 비싼 계정 먼저. 계정 하나의 쓴 만큼 값은 요금 × 몫.
  assert.equal(sum.list[0].row.id,'u27');
  assert.ok(sum.list.every((x,i)=>!i||sum.list[i-1].share<=x.share));
  assert.equal(won1000(sum.list[0].worth),3000);
  // 연간 결제: Claude Pro 1년에 $44(월 $22 × 12 − $220), Higgsfield Ultra $360(월 $129 × 12 − $1,188)에 11/27 할인(30%)을 기다려 보라고.
  const [first,second]=annualTips(s,rows,NOW3);
  assert.deepEqual([first.key,first.saving,first.upcoming,first.deal.off,first.at],['annual:higgsfield',360,true,30,new Date(2026,10,27).getTime()]);
  assert.deepEqual([second.key,second.saving,second.at],['annual:claude',44,NOW3+30*D]);
});

test('the monthly summary says why it waits: a date four weeks after the first record, no record yet, missing weeks, or an unknown credit size',async()=>{
  const {monthSummary,summaryOn}=await model;
  const a=row({id:'a',email:'a@example.com',plan:'max_5x',live:{readAt:NOW,weekly:{usedPercent:10,resetsAt:NOW+3*D}}});
  let s=monthSummary(snap([a],{a:{since:NOW-3*D,weeks4:{...four([10,10,10,10]),cover:false}}}),[a],NOW);
  assert.deepEqual([s.items.length,s.waiting,s.wait,s.waitAt],[0,1,'until',NOW+25*D]);
  // 첫 기록에서 28일이 이미 지났는데 4주를 못 덮었으면 「읽지 못한 주」.
  s=monthSummary(snap([a],{a:{since:NOW-28*D,weeks4:{...four([10,10,10,10]),cover:false}}}),[a],NOW);
  assert.deepEqual([s.wait,s.waitAt],['gaps',NOW]);
  s=monthSummary(snap([a],{}),[a],NOW);
  assert.deepEqual([s.wait,s.fresh,s.since],['first',true,null]);
  s=monthSummary(snap([a],{a:{since:NOW-60*D,weeks4:four([10,10,10,10],{known:false})}}),[a],NOW);
  assert.equal(s.wait,'gaps');
  const odd=row({id:'odd',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'odd@example.com',plan:'creator',live:{readAt:NOW,credits:300},credits:300,creditsAt:NOW});
  s=monthSummary(snap([odd],{odd:{since:NOW-60*D,weeks4:credit4([270,270,270,270])}}),[odd],NOW);
  assert.deepEqual([s.wait,s.noCredits,s.waiting],['credits',1,0]);
  // 셈할 계정이 하나도 없고 기다리는 계정도 없으면(GPT·Gemini·무료 요금제뿐) 요약 자체가 없다.
  const free=row({id:'free',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'Free',plan:'free',live:{readAt:NOW,credits:15000,planCredits:15000},credits:15000,creditsAt:NOW});
  assert.equal(monthSummary(snap([free,gpt('g',{weekly:{usedPercent:3,resetsAt:NOW+D}})],{g:{weeks4:four([1,1,1,1])}}),[free],NOW),null);
  // 요금표가 60일 지나고 넣은 요금도 없으면 금액 없이 계정 평균 %만. 한 달 크레딧은 요금제 사실이라 60일 문 밖이다.
  const h=row({id:'h',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'h@example.com',plan:'plus',live:{readAt:NOW,credits:300},credits:300,creditsAt:NOW});
  s=monthSummary(snap([a,h],{a:{since:NOW-60*D,weeks4:four([10,10,10,10])},h:{since:NOW-60*D,weeks4:credit4([270,270,270,270])}},{prices:priceBook(NOW-61*D)}),[a,h],NOW);
  const hShare=Math.min(1,1080/(1200*28/(365.25/12)));
  assert.deepEqual([s.hasMoney,s.total,s.pct,s.tables.length,s.usd],[false,0,Math.round((0.1+hShare)/2*100),0,false]);
  // 환율은 회원이 넣은 값(1달러 = 1,350원)으로, 넣은 달러 요금도 원으로 어림한다. 넣은 요금이 공식 요금보다 먼저다.
  const busy=row({id:'busy',email:'busy@example.com',plan:'max_20x',price:250,currency:'USD',live:{readAt:NOW}});
  s=monthSummary(snap([busy],{busy:{weeks4:four([50,50,50,50])}},{settings:{usdKrw:1350}}),[busy],NOW);
  assert.deepEqual([s.total,s.worth,s.pct,s.usd,s.rate,s.list[0].price.official],[337500,168750,50,true,1350,false]);
  assert.deepEqual([summaryOn({summaryOff:true}),summaryOn({}),summaryOn(undefined)],[false,true,true]);
});

test('yearly billing needs twelve steady weeks on one plan, and a dated sale only inside 45 days',async()=>{
  const {annualTips,shownAnnual}=await model;
  const pro=row({id:'pro',email:'pro@example.com',plan:'pro',live:{readAt:NOW,weekly:{usedPercent:50,resetsAt:NOW+3*D}}});
  const max=row({id:'max',email:'max@example.com',plan:'max_5x',live:{readAt:NOW,weekly:{usedPercent:90,resetsAt:NOW+3*D}}});
  const steady=twelve([45,52,48,55,60,58,62,57,66,61,59,64]);
  let tips=annualTips(snap([pro,max],{pro:{weeks12:steady},max:{weeks12:twelve(Array(12).fill(95))}}),[pro,max],NOW);
  assert.equal(tips.length,1);
  const t=tips[0];
  assert.deepEqual([t.key,t.rowId,t.saving,t.plan,t.perMonth,t.blocks,t.averages,t.line,t.lock,t.deal,t.at],['annual:claude','pro',44,{month:22,year:220},220/12,[200,237,250],[50,59.25,62.5],40,false,null,NOW+30*D]);
  // 4주 한 덩이가 평균 40%(넘지 않음), 못 읽은 주, 12주 미달(11주), 요금제 바꿈, 못 덮음, 지금 못 읽힘, 연간 표시, 한 주 150%는 100%로 자름 → 없음. 41%면 있음.
  const none=w12=>annualTips(snap([pro],{pro:{weeks12:w12}}),[pro],NOW).length;
  assert.deepEqual([twelve(Array(12).fill(40)),{...steady,weeks:steady.weeks.map((w,i)=>(i===5?{...w,reads:0}:w))},{...steady,weeks:steady.weeks.slice(1)},{...steady,samePlan:false},{...steady,cover:false},twelve([150,10,10,10,60,58,62,57,66,61,59,64])].map(none),[0,0,0,0,0,0]);
  assert.equal(none(twelve(Array(12).fill(41))),1);
  assert.equal(annualTips(snap([{...pro,state:'error'}],{pro:{weeks12:steady}}),[{...pro,state:'error'}],NOW).length,0);
  assert.equal(annualTips(snap([{...pro,cycle:'annual'}],{pro:{weeks12:steady}}),[{...pro,cycle:'annual'}],NOW).length,0);
  assert.equal(annualTips(snap([pro],{pro:{weeks12:steady}},{prices:priceBook(NOW-61*D)}),[pro],NOW).length,0);
  // Higgsfield: 4주씩 한 달 크레딧(Ultra 3,000으로 어림)의 50%(4주에 1,379.9) 넘게 — 4주 1,376(주 344)은 못 넘고 1,380(주 345)은 넘는다. Starter는 연간이 월간과 같아 말하지 않는다.
  const h=(id,plan,extra={})=>row({id,service:'higgsfield',label:'Higgsfield',kind:'credit',email:`${id}@example.com`,plan,live:{readAt:NOW,credits:500},credits:500,creditsAt:NOW,...extra});
  const heavy=twelve([700,820,760,690,720,800,750,710,690,760,820,700]);
  tips=annualTips(snap([h('ultra','ultra'),h('starter','starter')],{ultra:{weeks12:heavy},starter:{weeks12:twelve(Array(12).fill(200))}}),[h('ultra','ultra'),h('starter','starter')],NOW);
  assert.deepEqual(tips.map(x=>[x.key,x.saving,x.perMonth,x.blocks,x.allot,x.guess,x.lock,x.line]),[['annual:higgsfield',360,99,[2970,2980,2970],{credits:3000,own:false},true,true,50]]);
  assert.equal(annualTips(snap([h('ultra','ultra')],{ultra:{weeks12:twelve(Array(12).fill(344))}}),[h('ultra','ultra')],NOW).length,0);
  assert.equal(annualTips(snap([h('ultra','ultra')],{ultra:{weeks12:twelve(Array(12).fill(345))}}),[h('ultra','ultra')],NOW).length,1);
  // 등급을 아는 Ultra(6,000)는 그 크레딧으로 센다.
  assert.deepEqual(annualTips(snap([h('ultra','ultra',{live:{readAt:NOW,credits:500,planCredits:6000}})],{ultra:{weeks12:twelve(Array(12).fill(700))}}),[h('ultra','ultra',{live:{readAt:NOW,credits:500,planCredits:6000}})],NOW).map(x=>[x.allot,x.guess]),[[{credits:6000,own:true},false]]);
  // 할인 시기: 시작 0시가 45일 안이거나 진행 중(끝나는 날 끝까지)일 때만, 확인한 지 60일 안, 그 요금제·전체 요금제, 가장 먼저 시작하는 것.
  const deal=(from,until,extra={})=>({service:'higgsfield',plans:['ultra'],cycle:'year',from:dayText(from),until:dayText(until),checked:dayText(NOW),source:'higgsfield-pricing',off:30,...extra});
  const dealOf=deals=>annualTips(snap([h('ultra','ultra')],{ultra:{weeks12:heavy}},{prices:priceBook(NOW,deals)}),[h('ultra','ultra')],NOW)[0];
  let x=dealOf([deal(NOW+10*D,NOW+14*D)]);
  assert.deepEqual([x.upcoming,x.at,x.deal.fromAt,x.deal.checkedAt],[true,new Date(2026,10,2).getTime(),new Date(2026,10,2).getTime(),new Date(2026,9,23).getTime()]);
  x=dealOf([deal(NOW-D,NOW+2*D)]);
  assert.deepEqual([x.upcoming,x.at],[false,new Date(2026,9,26).getTime()-1]);
  assert.equal(dealOf([deal(NOW-3*D,NOW)]).deal.untilAt,new Date(2026,9,24).getTime()-1);
  assert.equal(dealOf([deal(NOW-3*D,NOW-D)]).deal,null);
  assert.ok(dealOf([deal(NOW+45*D,NOW+50*D)]).deal);
  assert.equal(dealOf([deal(NOW+46*D,NOW+50*D)]).deal,null);
  assert.equal(dealOf([{...deal(NOW+5*D,NOW+7*D),checked:dayText(NOW-61*D)}]).deal,null);
  assert.equal(dealOf([{...deal(NOW+5*D,NOW+7*D),plans:['plus']}]).deal,null);
  assert.ok(dealOf([{...deal(NOW+5*D,NOW+7*D),plans:undefined}]).deal);
  assert.equal(dealOf([deal(NOW+20*D,NOW+22*D,{off:20}),deal(NOW+3*D,NOW+4*D,{off:40})]).deal.off,40);
  // 요금·결제일 칸: 「팁 끄기」면 없고, 쉬는 팁은 빠지되 이 화면에서 방금 반응한 팁은 남는다.
  const rest={tips:{'annual:claude':{stops:1,until:NOW+5*D}}};
  const quiet=settings=>shownAnnual(snap([pro],{pro:{weeks12:steady}},{settings}),[pro],NOW).length;
  assert.deepEqual([quiet({}),quiet({tipsOff:true}),quiet(rest)],[1,0,0]);
  assert.equal(shownAnnual(snap([pro],{pro:{weeks12:steady}},{settings:rest}),[pro],NOW,{'annual:claude':'stop'}).length,1);
});

test('a credit spike needs 1.5 times the usual and a service floor, and forecasts the empty day against the next refill',async()=>{
  const {serviceGroups,spikeTip,nextRefill}=await model;
  const founder=row({id:'founder',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'founder@example.com',plan:'ultra',live:{readAt:NOW,credits:1026.84},credits:1026.84,creditsAt:NOW});
  const low=row({id:'h-low',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'h1@example.com',plan:'ultra',live:{readAt:NOW,credits:0.22},credits:0.22,creditsAt:NOW});
  const g=serviceGroups([founder,low],NOW)[0];
  const u=s7=>({bars:[{v:620},{v:540},{v:710},{v:650},{v:s7}],base:630,baseWeeks:4});
  const s=snap([founder,low],{founder:{since:NOW-40*D,used7:1450,rate3:null,perDay:207.14,refillAt:NOW-21*D}});
  const t=spikeTip(s,g,u(1450),NOW),emptyAt=NOW+(1026.84/207.14)*D;
  assert.deepEqual([t.key,t.kind,t.ratio,t.s7,t.base,t.min,t.at],['spike:higgsfield','save',2.3,1450,630,300,emptyAt]);
  assert.deepEqual(t.forecast,{name:'founder',emptyAt,refill:NOW+9*D,credits:1026.84,perDay:207.14,refillAt:NOW-21*D,basis:'last'});
  // 1.5배 딱 그 값(945)은 말하고, 940은 말하지 않는다. 300크레딧이 안 되면 배수가 커도 말하지 않는다.
  assert.equal(spikeTip(s,g,u(945),NOW).ratio,1.5);
  assert.equal(spikeTip(s,g,u(940),NOW),null);
  assert.equal(spikeTip(s,g,{bars:[null,null,null,null,{v:299}],base:100,baseWeeks:4},NOW),null);
  assert.equal(spikeTip(s,g,{bars:[null,null,null,null,{v:900}],base:null,baseWeeks:0},NOW),null);
  // 그 전 평균이 0이면 배수 대신 「평소보다 많이」(ratio null).
  assert.equal(spikeTip(s,g,{bars:[{v:0},{v:0},{v:0},{v:0},{v:400}],base:0,baseWeeks:4},NOW).ratio,null);
  // 충전 전에 바닥나지 않으면 예측 없이 7일 뒤로 줄을 선다.
  const slow=snap([founder],{founder:{since:NOW-40*D,used7:1450,rate3:null,perDay:20,refillAt:NOW-21*D}});
  assert.deepEqual([spikeTip(slow,serviceGroups([founder],NOW)[0],u(1450),NOW).forecast,spikeTip(slow,serviceGroups([founder],NOW)[0],u(1450),NOW).at],[null,NOW+7*D]);
  // Typecast는 3,000크레딧부터, 충전은 한 달씩 — 1/31 충전 기록이면 날짜 넘침 그대로(2/31 → 3/3) 이어 센다. 기록이 없으면 넣어 둔 결제일(31일은 그달 끝).
  const tc=row({id:'tc',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'FjrE',plan:'lite',billDay:31,live:{readAt:NOW,credits:5000},credits:5000,creditsAt:NOW});
  const tg=serviceGroups([tc],NOW)[0],tu={bars:[{v:1000},{v:1000},{v:1000},{v:1000},{v:9000}],base:1000,baseWeeks:4};
  assert.equal(spikeTip(snap([tc]),tg,{...tu,bars:[...tu.bars.slice(0,4),{v:2999}],base:100},NOW),null);
  const jan31=new Date(2026,0,31,9,0).getTime();
  assert.equal(nextRefill('typecast',tc,jan31,NOW),new Date(2026,10,3,9,0).getTime());
  assert.equal(spikeTip(snap([tc],{tc:{used7:9000,perDay:2000,refillAt:jan31}}),tg,tu,NOW).forecast.basis,'last');
  const byBill=spikeTip(snap([tc],{tc:{used7:9000,perDay:2000,refillAt:null}}),tg,tu,NOW).forecast;
  assert.deepEqual([byBill.basis,byBill.refill],['bill',new Date(2026,9,31).getTime()]);
  assert.equal(nextRefill('higgsfield',row({billDay:5}),null,NOW),null);
  assert.equal(nextRefill('higgsfield',row(),NOW-30*D,NOW),NOW+30*D);
});

test('a weekly service warns only when every usable account runs out three hours before the first comes back',async()=>{
  const {serviceGroups,paceTip}=await model;
  const a=gpt('g-a',{weekly:{usedPercent:60,resetsAt:NOW+4*D}}),b=gpt('g-b',{weekly:{usedPercent:70,resetsAt:NOW+5*D}});
  const pace=(rows,rates)=>paceTip(snap(rows,Object.fromEntries(rows.map((r,i)=>[r.id,{rate3:rates[i]}]))),serviceGroups(rows,NOW)[0],NOW);
  // 남은 40%+30%를 하루 20%p씩 쓰면 1.75일 뒤 다 막히고, 먼저 풀리는 건 나흘 뒤다.
  const t=pace([a,b],[20,20]);
  assert.deepEqual([t.key,t.kind,t.at,t.release,t.many,t.live,t.used,t.rate],['pace:gpt','smooth',NOW+1.75*D,NOW+4*D,true,2,65,20]);
  assert.deepEqual([pace([a,b],[5,5]),pace([a,b],[0,0]),pace([a,b],[20,null])],[null,null,null]);
  // 3시간 여유의 경계: 30% 남은 계정이 하루 16%p면 정확히 「풀리기 3시간 전」이라 말하고, 15.9%p면 말하지 않는다.
  const edge=gpt('e',{weekly:{usedPercent:70,resetsAt:NOW+2*D}});
  assert.ok(pace([edge],[16]));
  assert.equal(pace([edge],[15.9]),null);
  // Claude는 요금제 배수로 무게를 준다(20x 계정 하나가 Pro 스무 개 몫).
  const big=row({id:'big',plan:'max_20x',live:{readAt:NOW,weekly:{usedPercent:50,resetsAt:NOW+3*D}}}),small=row({id:'small',plan:'pro',live:{readAt:NOW,weekly:{usedPercent:90,resetsAt:NOW+3*D}}});
  const w=pace([big,small],[40,10]);
  assert.deepEqual([w.used,w.rate],[100-Math.round((50*20+10)/21),Math.round((40*20+10)/21)]);
  // 풀렸을 계정이 있으면 남은 양을 몰라 말하지 않는다.
  const passed=gpt('p',{readAt:NOW-3*H,session:{usedPercent:100,resetsAt:NOW-H},weekly:{usedPercent:20,resetsAt:NOW+3*D}});
  assert.equal(pace([a,passed],[20,20]),null);
});

test('reset passes: use now only when every account is blocked for more than a day, otherwise warn three days before they expire',async()=>{
  const {serviceGroups,passPlan,passTip,passExpiry}=await model;
  const group=rows=>serviceGroups(rows,NOW)[0];
  const withPass=gpt('a',{weekly:{usedPercent:100,resetsAt:NOW+5*D},resets:{count:1,until:[NOW+10*D]}});
  let g=group([withPass,gpt('b',{weekly:{usedPercent:100,resetsAt:NOW+4*D}})]);
  assert.deepEqual([passPlan(g,NOW).use,passPlan(g,NOW).why,passPlan(g,NOW).first.row.id],[true,'all','b']);
  let t=passTip(g,NOW);
  assert.deepEqual([t.key,t.mode,t.kind,t.at,t.name,t.total,t.until,t.release,t.many],['pass:gpt','now','smooth',NOW,'a',1,NOW+10*D,NOW+4*D,true]);
  const why=rows=>passPlan(group(rows),NOW).why;
  assert.equal(why([withPass,gpt('c',{weekly:{usedPercent:20,resetsAt:NOW+3*D}})]),'roomy');
  assert.equal(why([withPass,gpt('l',{weekly:{usedPercent:95,resetsAt:NOW+3*D}})]),'low');
  assert.equal(why([withPass,gpt('b',{weekly:{usedPercent:100,resetsAt:NOW+20*H}})]),'soon');
  assert.equal(why([withPass,gpt('e',{},{state:'error',live:{readAt:NOW-3*H,weekly:{usedPercent:10,resetsAt:NOW+3*D}}})]),'unread');
  // 하루가 딱 남으면 기다리지 않는다(하루보다 적게 남았을 때만 「곧 풀려요」).
  assert.equal(why([withPass,gpt('b',{weekly:{usedPercent:100,resetsAt:NOW+D}})]),'all');
  assert.equal(passTip(group([withPass,gpt('c',{weekly:{usedPercent:20,resetsAt:NOW+3*D}})]),NOW),null);
  // 곧 만료: 3일째까지(<=). GPT는 주간 초기화가 만료보다 먼저면 reset, 아니면 50% 넘게 썼는지.
  const expiring=(weekly,until,extra={})=>passTip(group([gpt('g',{weekly,resets:{count:1,until:[until]}},extra)]),NOW);
  t=expiring({usedPercent:70,resetsAt:NOW+10*H},NOW+2*D);
  assert.deepEqual([t.mode,t.kind,t.at,t.count,t.manual,t.many,t.hint],['expiry','save',NOW+2*D,1,false,false,{gpt:true,hint:'reset',reset:NOW+10*H,used:70}]);
  assert.equal(expiring({usedPercent:70,resetsAt:NOW+5*D},NOW+2*D).hint.hint,'used');
  assert.equal(expiring({usedPercent:20,resetsAt:NOW+5*D},NOW+3*D).hint.hint,'later');
  assert.equal(expiring({usedPercent:20,resetsAt:NOW+5*D},NOW+3*D+1),null);
  // 못 읽은 GPT 계정의 옛 값으로는 팁을 띄우지 않는다.
  assert.equal(passTip(group([gpt('g',{},{state:'error',live:{readAt:NOW-3*H,weekly:{usedPercent:70,resetsAt:NOW+5*D},resets:{count:1,until:[NOW+2*D]}}})]),NOW),null);
  // Claude(직접 넣은 장수): 주간 초기화가 만료 전이고 하루 안일 때만 reset. 다시 로그인할 계정은 장수만 남고 %는 쓰지 않는다(later).
  const claude=(weekly,extra={})=>row({id:'keep',email:'keep@example.com',plan:'max_5x',passCount:2,passUntil:NOW+2*D,live:{readAt:NOW,weekly},...extra});
  assert.deepEqual(passTip(group([claude({usedPercent:30,resetsAt:NOW+20*H})]),NOW).hint,{gpt:false,hint:'reset',reset:NOW+20*H,used:30});
  assert.equal(passTip(group([claude({usedPercent:70,resetsAt:NOW+30*H})]),NOW).hint.hint,'used');
  const login=passTip(group([claude({usedPercent:80,resetsAt:NOW+4*D},{state:'needs-login'})]),NOW);
  assert.deepEqual([login.manual,login.count,login.hint.hint,login.hint.used],[true,2,'later',null]);
  const a=group([claude({usedPercent:30,resetsAt:NOW+20*H})]).accounts[0];
  assert.deepEqual(passExpiry({service:'claude'},a,NOW),{gpt:false,hint:'reset',reset:NOW+20*H,used:30});
  // 초기화권이 없는 서비스는 묶음이 어떻든 팁이 없다.
  assert.equal(passTip(group([row({service:'gemini',label:'Gemini',passCount:1,live:{readAt:NOW,weekly:{usedPercent:100,resetsAt:NOW+5*D}}})]),NOW),null);
});

test('one plan down for a Max account that stayed low for four weeks, with the saving from a fresh price table',async()=>{
  const {serviceGroups,sizeTip}=await model;
  const big=row({id:'big',email:'big@example.com',plan:'max_20x',live:{readAt:NOW,weekly:{usedPercent:11,resetsAt:NOW+3*D}}});
  const five=row({id:'five',email:'five@example.com',plan:'max_5x',live:{readAt:NOW,weekly:{usedPercent:14,resetsAt:NOW+2*D}}});
  const size=(rows,accounts,opts)=>sizeTip(snap(rows,accounts,opts),serviceGroups(rows,NOW)[0],NOW);
  // 20x → 5x는 한 달 $110 덜(= $220 − $110), 5x → Pro는 $88(= $110 − $22). 덜 내는 액수가 큰 20x가 먼저.
  let t=size([big,five],{big:{weeks4:four([12,15,9,11],{hPeak:18})},five:{weeks4:four([10,12,14,8])}});
  assert.deepEqual([t.key,t.name,t.plan,t.rule.to,t.saving,t.highs,t.hPeak,t.hScaled,t.maxMonthly,t.at],['size:claude','big','max_20x','max5x',110,[12,15,9,11],18,72,true,NOW+10*D]);
  t=size([{...five,billDay:new Date(NOW+D).getDate()}],{five:{weeks4:four([10,12,14,8],{hPeak:19.6})}});
  assert.deepEqual([t.rule.to,t.saving,t.proYear,t.proMonth,t.hPeak,t.hScaled,t.at],['pro',88,220,220/12,20,100,new Date(2026,9,24).getTime()]);
  // 요금표가 60일 지나면 금액·「월 결제만」 없이 팁만.
  t=size([big],{big:{weeks4:four([12,15,9,11],{hPeak:18})}},{prices:priceBook(NOW-61*D)});
  assert.deepEqual([t.saving,t.table,t.maxMonthly,t.proYear],[null,null,false,null]);
  // 한 주라도 넘음 · 5시간 창이 낮춘 요금제에 안 들어감(25% 이상) · 5시간 기록 미달 · 틈 · 다시 로그인 → 없음.
  for(const [r,w4] of [[big,four([12,25,9,11])],[big,four([12,15,9,11],{hPeak:25})],[big,four([12,15,9,11],{hCover:false})],[big,four([12,15,9,11],{known:false})],[{...big,state:'needs-login'},four([12,15,9,11])],[five,four([10,17,14,8])],[five,four([10,12,14,8],{hPeak:20})]])
    assert.equal(size([r],{[r.id]:{weeks4:w4}}),null);
  assert.equal(sizeTip(snap([gpt('g',{weekly:{usedPercent:5,resetsAt:NOW+D}})],{}),serviceGroups([gpt('g',{weekly:{usedPercent:5,resetsAt:NOW+D}})],NOW)[0],NOW),null);
});

test('an unused subscription is pointed out only within five days of its monthly bill',async()=>{
  const {serviceGroups,idleTip}=await model;
  const idle=(extra={})=>row({id:'ci',email:'ci@example.com',plan:'pro',billDay:new Date(NOW+3*D).getDate(),price:29000,currency:'KRW',live:{readAt:NOW,weekly:{usedPercent:2,resetsAt:NOW+4*D}},...extra});
  const tip=(r,w4)=>idleTip(snap([r],{[r.id]:{weeks4:w4}}),serviceGroups([r],NOW)[0],NOW);
  let t=tip(idle(),four([2,0,4,1]));
  assert.deepEqual([t.key,t.kind,t.days,t.billAt,t.at,t.price,t.highs,t.credit,t.name],['idle:claude','save',3,new Date(2026,9,26).getTime(),new Date(2026,9,26).getTime(),{amount:29000,currency:'KRW'},[2,0,4,1],false,'ci']);
  assert.equal(tip(idle({billDay:23}),four([2,0,4,1])).days,0);
  assert.equal(tip(idle({billDay:28}),four([2,0,4,1])).days,5);
  assert.equal(tip(idle({billDay:29}),four([2,0,4,1])),null);
  assert.equal(tip(idle({cycle:'annual'}),four([2,0,4,1])),null);
  assert.equal(tip(idle(),four([2,0,6,1])),null);
  assert.equal(tip(idle({price:null}),four([2,0,4,1])).price,null);
  assert.equal(tip({...idle(),id:'x',service:'gpt',label:'gpt',plan:'plus'},four([2,0,4,1])),null);
  // 크레딧형은 4주 동안 0이어야 한다. 31일 결제일은 그달 끝(10/31).
  const key=row({id:'tc',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'FjrE',plan:'lite',billDay:31,live:{readAt:NOW+0,credits:114647},credits:114647,creditsAt:NOW});
  const zero={cover:true,known:true,hCover:false,hPeak:null,weeks:[0,0,0,0].map(v=>({used:v,peak:null,reads:4}))};
  const late=new Date(2026,9,28,10,0).getTime();
  t=idleTip(snap([key],{tc:{weeks4:zero}},{now:late}),serviceGroups([key],late)[0],late);
  assert.deepEqual([t.key,t.credit,t.days,t.billAt],['idle:typecast',true,3,new Date(2026,9,31).getTime()]);
  assert.equal(idleTip(snap([key],{tc:{weeks4:{...zero,weeks:[0,0,1,0].map(v=>({used:v,peak:null,reads:4}))}}},{now:late}),serviceGroups([key],late)[0],late),null);
});

test('the usage section picks one tip per service by goal, skips resting ones and shows two at most',async()=>{
  const {serviceGroups,pickUsageTips,restWeeks,restingCount}=await model;
  const a=gpt('g-a',{weekly:{usedPercent:60,resetsAt:NOW+4*D}}),big=row({id:'big',email:'big@example.com',plan:'max_20x',live:{readAt:NOW,weekly:{usedPercent:11,resetsAt:NOW+3*D}}});
  const key=row({id:'tc',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'FjrE',plan:'lite',billDay:new Date(NOW+3*D).getDate(),live:{readAt:NOW,credits:114647},credits:114647,creditsAt:NOW});
  const accounts={'g-a':{rate3:30},big:{weeks4:four([12,15,9,11])},tc:{weeks4:{cover:true,known:true,hCover:false,hPeak:null,weeks:[0,0,0,0].map(v=>({used:v,peak:null,reads:4}))}}};
  const services={gpt:{kind:'pct',accounts:1,bars:[null,null,null,null,{v:40}],base:null,baseWeeks:0}};
  const pick=(settings,answered,rows=[a,big,key])=>{const s=snap(rows,accounts,{settings,services});return pickUsageTips(s,serviceGroups(rows,NOW),NOW,answered);};
  const keys=r=>[...r.tips.values()].map(t=>t.key).sort();
  // 아끼기: 아끼는 둘(안 쓰는 키 · 요금제 맞추기). 고르기 전: 일이 먼저 닥치는 둘(속도 경고 · 결제).
  assert.deepEqual(keys(pick({goal:'save'})),['idle:typecast','size:claude']);
  assert.deepEqual(keys(pick({})),['idle:typecast','pace:gpt']);
  assert.deepEqual(keys(pick({goal:'unsure'})),['idle:typecast','pace:gpt']);
  // 막힘 없이: 요금제를 낮추자는 팁은 아예 고르지 않는다(속도 경고가 먼저).
  const smooth=pick({goal:'smooth'});
  assert.deepEqual([smooth.goal,keys(smooth)],['smooth',['idle:typecast','pace:gpt']]);
  assert.equal(pick({goal:'smooth'},{},[big]).tips.size,0);
  assert.equal(pick({goal:'upsell'}).goal,null);
  // 팁 끄기면 하나도 고르지 않는다. 쉬는 팁은 빠지고 다음 팁이 오르되, 이 화면에서 방금 반응한 팁은 그대로 남는다.
  const off=pick({tipsOff:true});
  assert.deepEqual([off.off,off.tips.size],[true,0]);
  const resting={tips:{'pace:gpt':{stops:1,until:NOW+D},'idle:typecast':{helpful:1,until:NOW-1}}};
  assert.deepEqual([keys(pick(resting)),pick(resting).resting],[['idle:typecast','size:claude'],1]);
  assert.deepEqual(keys(pick(resting,{'pace:gpt':'stop'})),['idle:typecast','pace:gpt']);
  // 「그만」 쉬는 기간: 처음 4주, 두 번째부터 12주. 쉬는 수는 갈래(prefix)로도 센다.
  assert.deepEqual([restWeeks({tips:{k:{stops:1}}},'k'),restWeeks({tips:{k:{stops:2}}},'k'),restWeeks({},'k'),restWeeks(undefined,'k')],[4,12,4,4]);
  const settings={tips:{'annual:claude':{until:NOW+D},'annual:higgsfield':{until:NOW},'spike:higgsfield':{until:NOW+5*D}}};
  assert.deepEqual([restingCount(settings,NOW),restingCount(settings,NOW,'annual:'),restingCount(undefined,NOW)],[2,1,0]);
});

test('usage bars scale to 100% or the busiest week, keep a sliver for tiny use and compare with the earlier average',async()=>{
  const {usageBars}=await model;
  const pct=usageBars({services:{claude:{bars:[62,68,74,95,79].map(v=>({v,partial:false})),base:72,baseWeeks:4}},buckets:[{start:1,end:2}]},{service:'claude',kind:'weekly'});
  assert.deepEqual([pct.kind,pct.bars.map(b=>b.height),pct.bars.map(b=>b.level),pct.has,pct.diff,pct.buckets.length],['pct',[62,68,74,95,79],['ok','ok','ok','low','ok'],true,7,1]);
  const credit=usageBars({services:{higgsfield:{bars:[620,540,710,650,1450].map(v=>({v})),base:630}}},{service:'higgsfield',kind:'credit'});
  assert.deepEqual([credit.kind,credit.bars.map(b=>b.height),credit.bars.map(b=>b.level),credit.diff],['credit',[43,37,49,45,100],['ok','ok','ok','ok','ok'],820]);
  const tiny=usageBars({services:{typecast:{bars:[{v:1},{v:0},null,{v:1000,partial:true},null],base:null}}},{service:'typecast',kind:'credit'});
  assert.deepEqual([tiny.bars.map(b=>b&&b.height),tiny.bars[3].partial,tiny.has,tiny.diff],[[3,0,null,100,null],true,false,0]);
  const none=usageBars(undefined,{service:'gpt',kind:'weekly'});
  assert.deepEqual([none.u,none.bars,none.has,none.buckets],[null,[null,null,null,null,null],false,[]]);
});

test('Claude API credits: the price table says what arrives each month, the member says what is left until the expiry day',async()=>{
  const {apiGrant,apiCreditOf,apiCredits,upcoming}=await model;
  const prices=priceBook(),max20=extra=>row({plan:'max_20x',...extra});
  // 들어오는 금액은 요금표의 등급을 아는 Max만(공식 Max 5x $100 · Max 20x $200). 등급을 못 읽은 Max·Pro·다른 서비스·직접 넣은 줄은 말하지 않는다.
  assert.deepEqual([max20(),row({plan:'max_5x'}),row({plan:'max'}),row({plan:'pro'}),gpt('g',{}),row({source:'manual',plan:'max_20x'})].map(r=>apiGrant(prices,r,NOW)),[200,100,null,null,null,null]);
  // 요금표를 확인한 지 60일이 지나면 금액처럼 들어오는 금액도 말하지 않는다.
  assert.equal(apiGrant(priceBook(NOW-61*D),max20(),NOW),null);assert.equal(apiGrant(null,max20(),NOW),null);
  // 안 넣은 Max는 들어오는 금액만, 안 넣은 Pro는 셀 것이 없다. 등급을 못 읽은 Max는 「모름」 표시만(설명 줄·칸이 나오게).
  assert.deepEqual(apiCreditOf(prices,max20(),NOW),{grant:200,left:null});
  assert.equal(apiCreditOf(prices,row({plan:'pro'}),NOW),null);
  assert.deepEqual(apiCreditOf(prices,row({plan:'max'}),NOW),{grant:null,left:null,unknown:true});
  assert.equal(apiCreditOf(priceBook(NOW-61*D),row({plan:'max'}),NOW),null);
  // 공식 요금처럼, 30일 넘게 못 읽힌 줄(구독을 끊었을 수 있다)은 들어오는 금액으로 세지 않는다. 그 안이면 못 읽혀도 센다.
  assert.equal(apiGrant(prices,max20({state:'error',live:{readAt:NOW-31*D}}),NOW),null);
  assert.equal(apiGrant(prices,max20({state:'error',live:{readAt:NOW-29*D}}),NOW),200);
  // 넣은 값은 만료일 0시 전까지. 그날 0시가 되면 「만료됨」으로 남은 금액을 세지 않는다. Pro에 넣은 값(다른 프로모 크레딧)도 센다.
  const until=new Date(2026,9,27).getTime();
  assert.deepEqual(apiCreditOf(prices,max20({apiCredit:199,apiCreditUntil:until,apiCreditAt:NOW-D}),NOW),{grant:200,left:199,until,at:NOW-D});
  assert.deepEqual(apiCreditOf(prices,max20({apiCredit:199,apiCreditUntil:until,apiCreditAt:NOW-D}),until),{grant:200,left:null,expired:until,at:NOW-D});
  assert.deepEqual(apiCreditOf(prices,row({plan:'pro',apiCredit:12.5,apiCreditUntil:null}),NOW),{grant:null,left:12.5,until:null,at:null});
  // 판 합계: 만료 전 넣은 값만 더하고(센트까지) 넣은 때의 처음·끝을 같이, 매달 들어오는 금액은 등급을 아는 Max 계정마다(등급 모르는 Max는 따로 센다).
  // 가장 먼저 사라지는 것은 남은 금액이 있는 계정 가운데서.
  const rows=[
    max20({id:'a',email:'a@example.com',apiCredit:199,apiCreditUntil:NOW+5*D,apiCreditAt:NOW-2*D}),
    max20({id:'b',email:'b@example.com',apiCredit:0,apiCreditUntil:NOW+2*D,apiCreditAt:NOW-D}),
    max20({id:'c',email:'c@example.com',apiCredit:150.25,apiCreditUntil:NOW+9*D,apiCreditAt:NOW-3*H}),
    max20({id:'d',email:'d@example.com',apiCredit:80,apiCreditUntil:NOW-D,apiCreditAt:NOW-20*D}),
    row({id:'e',email:'e@example.com',plan:'max_5x'}),
    row({id:'f',email:'f@example.com',plan:'max'}),
    gpt('g',{}),
  ];
  const sum=apiCredits(prices,rows,NOW);
  assert.deepEqual({...sum,first:{id:sum.first.row.id,until:sum.first.until,left:sum.first.left}},{left:349.25,entered:3,oldest:NOW-2*D,newest:NOW-3*H,monthly:900,granted:5,unknown:1,first:{id:'a',until:NOW+5*D,left:199}});
  assert.equal(apiCredits(prices,[gpt('g',{}),row({plan:'pro'})],NOW),null);
  // 등급 모르는 Max뿐이어도 칸은 나온다(금액 없이 그 수만). 30일 넘게 못 읽힌 줄은 들어오는 금액에서 빠진다.
  assert.deepEqual(apiCredits(prices,[row({plan:'max'})],NOW),{left:0,entered:0,oldest:null,newest:null,monthly:0,granted:0,unknown:1,first:null});
  assert.deepEqual([apiCredits(prices,[max20(),max20({state:'error',live:{readAt:NOW-40*D}})],NOW)].map(s=>[s.monthly,s.granted]),[[200,1]]);
  // 요금표가 오래되면 넣은 값만 센다(들어오는 금액은 0).
  assert.deepEqual([apiCredits(priceBook(NOW-61*D),rows,NOW).monthly,apiCredits(priceBook(NOW-61*D),rows,NOW).left],[0,349.25]);
  // 일정: 남은 금액이 있고 7일 안에 사라지는 것만(0달러·9일 뒤·이미 지남은 빼고).
  assert.deepEqual(upcoming(rows,NOW).filter(i=>i.type==='api').map(i=>[i.row.id,i.t,i.amount]),[['a',NOW+5*D,199]]);
  // 그 계정의 결제일과 같은 날이면 따로 줄을 세우지 않고 결제 줄에 붙인다.
  const day=new Date(NOW+5*D),billed=max20({id:'h',email:'h@example.com',billDay:day.getDate(),apiCredit:40,apiCreditUntil:new Date(day.getFullYear(),day.getMonth(),day.getDate()).getTime()});
  assert.deepEqual(upcoming([billed],NOW).map(i=>[i.type,i.days,i.api]),[['bill',5,40]]);
});
