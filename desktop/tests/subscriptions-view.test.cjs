'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

const NOW=new Date(2026,9,17,10,0).getTime();
const row=(extra)=>({id:'r-'+Math.random().toString(36).slice(2,8),service:'claude',source:'auto',label:'Claude',kind:'weekly',state:'ok',email:'member@example.com',price:null,currency:'KRW',billDay:null,credits:null,creditsAt:null,lowAt:null,resetDay:null,resetHour:null,resetMinute:null,usedUpAt:null,note:'',live:null,...extra});

test('only problems reach the top layer, ordered by urgency',async()=>{
  const {attention}=await import('../renderer/subscriptions.mjs');
  const rows=[
    row({label:'GPT',service:'gpt',email:'synk@example.com',resetDay:5,resetHour:17,resetMinute:4,usedUpAt:NOW-3600e3}),
    row({live:{readAt:NOW,weekly:{usedPercent:93,resetsAt:NOW+2*864e5},session:{usedPercent:20,resetsAt:NOW+3600e3}}}),
    row({service:'higgsfield',label:'Higgsfield',kind:'credit',live:{readAt:NOW,credits:0.22},credits:0.22,creditsAt:NOW}),
    row({service:'suno',source:'manual',label:'Suno',kind:'credit',email:null,price:30,currency:'USD',billDay:new Date(NOW).getDate()+2,credits:2350,creditsAt:NOW}),
    row({state:'needs-login',email:'old@example.com'}),
    row({email:'calm@example.com',live:{readAt:NOW,weekly:{usedPercent:10,resetsAt:NOW+864e5}}}),
  ];
  const items=attention(rows,NOW);
  assert.deepEqual(items.map(i=>i.text.split(' · ')[0]),['다시 로그인 필요','소진','주간 93%','크레딧 부족','결제 D-2']);
  assert.ok(!items.some(i=>i.text.includes('calm')));
});

test('a reset week no longer counts as used up and live reset times win',async()=>{
  const {isUsedUp,nextReset}=await import('../renderer/subscriptions.mjs');
  const r=row({resetDay:4,resetHour:11,resetMinute:0,usedUpAt:new Date(2026,9,15,12,0).getTime()});
  assert.equal(isUsedUp(r,NOW),true);
  assert.equal(isUsedUp(r,new Date(2026,9,22,11,1).getTime()),false);
  const live=row({resetDay:4,resetHour:11,resetMinute:0,live:{weekly:{usedPercent:5,resetsAt:NOW+5*3600e3}}});
  assert.equal(nextReset(live,NOW),NOW+5*3600e3);
});

test('monthly cost adds won and dollars separately and estimates the total',async()=>{
  const {costSummary,money}=await import('../renderer/subscriptions.mjs');
  const today=new Date(NOW).getDate();
  const sum=costSummary([row({price:200,currency:'USD',billDay:today}),row({price:29000,currency:'KRW',billDay:((today+20)%28)+1}),row({price:null})],NOW,1400);
  assert.equal(sum.krw,29000);assert.equal(sum.usd,200);assert.equal(sum.count,2);assert.equal(sum.approx,309000);assert.equal(sum.soon,1);
  assert.equal(money(1234.5,'USD'),'$1,234.5');assert.equal(money(29000,'KRW'),'₩29,000');
});

test('the 7-day agenda groups resets and payments by day',async()=>{
  const {agenda}=await import('../renderer/subscriptions.mjs');
  const today=new Date(NOW).getDate();
  const days=agenda([row({resetDay:1,resetHour:12,resetMinute:0}),row({source:'manual',kind:'plan',label:'Gemini',price:29000,billDay:today+2})],NOW);
  assert.deepEqual(days.map(d=>d.index),[2]);
  assert.deepEqual(days[0].items.map(i=>i.time),['결제','12:00']);
});

test('platform navigation keeps the board route instead of dropping it',async()=>{
  const {normalizeRoute}=await import('../renderer/convenience-state.mjs');
  assert.equal(normalizeRoute({view:'benefits',benefitId:'subscriptions'}).benefitId,'subscriptions');
  assert.equal(normalizeRoute({view:'benefits',benefitId:'unknown'}).benefitId,null);
});

/* ---------- 화면 묶음 ---------- */
function fakeContainer(){
  const handlers=new Map();
  return {dataset:{},innerHTML:'',handlers,addEventListener:(name,cb)=>handlers.set(name,cb),querySelector:()=>null,contains:()=>false};
}
test('the board asks members to sign in, then guides first-time users before showing tables',async()=>{
  globalThis.document=globalThis.document||{activeElement:null,hidden:false};
  globalThis.CSS=globalThis.CSS||{escape:value=>String(value)};
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  let snapshot={ok:true,tools:{claude:{installed:false},gpt:{installed:true,version:'codex-cli 0.163.0'},higgsfield:{installed:false,npm:false}},rows:[],settings:{usdKrw:1400},check:null,login:null,checking:false};
  const calls=[];const listeners=[];
  const bridge={subscriptions:{snapshot:async()=>{calls.push('snapshot');return snapshot;},check:async()=>{calls.push('check');return snapshot;},onChanged:cb=>{listeners.push(cb);return ()=>{};},install:async s=>{calls.push('install:'+s);return {ok:true};},useExisting:async()=>({ok:false,code:'NOT_LOGGED_IN'}),login:async()=>({ok:true,id:'l-1'}),save:async()=>snapshot,help:async()=>({ok:true}),submitCode:async()=>({ok:true}),cancel:async()=>({ok:true}),openLoginUrl:async()=>({ok:true})}};
  const toasts=[];const board=createSubscriptionsBoard({bridge,toast:m=>toasts.push(m)});
  const el=fakeContainer();
  board.render(el,{signedIn:false,native:true});
  assert.match(el.innerHTML,/로그인하고 시작해요/);assert.match(el.innerHTML,/data-insight-action="account"/);assert.equal(calls.length,0);
  board.render(el,{signedIn:true,native:true});
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(calls,['snapshot']);
  assert.match(el.innerHTML,/Claude 연결 가이드/);assert.match(el.innerHTML,/설치 창 열기/);assert.match(el.innerHTML,/irm https:\/\/claude\.ai\/install\.ps1 \| iex/);
  await el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:{subs:'install',service:'claude'}})}});
  await new Promise(r=>setImmediate(r));
  assert.ok(calls.includes('install:claude'));assert.match(toasts.at(-1),/설치 창을 열었어요/);
  // 계정이 생기면 세 층 화면으로 바뀐다.
  snapshot={...snapshot,rows:[row({live:{readAt:NOW,weekly:{usedPercent:96,resetsAt:Date.now()+864e5}}})],check:{at:Date.now(),total:1,ok:1}};
  listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/지금 볼 것/);assert.match(el.innerHTML,/주간 96%/);assert.match(el.innerHTML,/앞으로 7일/);assert.match(el.innerHTML,/마지막 확인/);
  assert.ok(!el.innerHTML.includes('<script'));
  board.render(el,{signedIn:true,native:false});
  assert.match(el.innerHTML,/PC 앱에서 쓰는 혜택이에요/);
  board.dispose();
});
