'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

const NOW=new Date(2026,9,17,10,0).getTime();
const row=(extra)=>({id:'r-'+Math.random().toString(36).slice(2,8),service:'claude',source:'auto',label:'Claude',kind:'weekly',state:'ok',email:'member@example.com',price:null,currency:'KRW',billDay:null,credits:null,creditsAt:null,lowAt:null,resetDay:null,resetHour:null,resetMinute:null,usedUpAt:null,note:'',live:null,...extra});
const tick=()=>new Promise(r=>setImmediate(r));

test('each account lands in one state and each service recommends its roomiest confirmed account',async()=>{
  const {accountState,serviceGroups,planName}=await import('../renderer/subscriptions.mjs');
  // Claude Max는 등급까지(본체가 max_5x·max_20x로 준다), 같은 %면 20x를 먼저 추천한다.
  assert.deepEqual([planName('max_20x'),planName('max_5x'),planName('max'),planName('prolite')],['Max 20x','Max 5x','Max','Pro Lite']);
  const five=row({id:'five',email:'five@example.com',plan:'max_5x',live:{readAt:NOW,weekly:{usedPercent:30,resetsAt:NOW+864e5}}}),twenty=row({id:'twenty',email:'twenty@example.com',plan:'max_20x',live:{readAt:NOW,weekly:{usedPercent:30,resetsAt:NOW+864e5}}});
  assert.equal(serviceGroups([five,twenty],NOW)[0].best.row.id,'twenty');
  const rows=[
    row({id:'out',email:'out@example.com',live:{readAt:NOW,session:{usedPercent:100,resetsAt:NOW+36*60e3},weekly:{usedPercent:51,resetsAt:NOW+115*3600e3}}}),
    row({id:'low',email:'low@example.com',live:{readAt:NOW,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:99,resetsAt:NOW+51*3600e3}}}),
    row({id:'roomy',email:'roomy@example.com',plan:'max',live:{readAt:NOW,weekly:{usedPercent:78,resetsAt:NOW+44*3600e3}}}),
    row({id:'login',email:'old@example.com',state:'needs-login',live:{readAt:NOW,weekly:{usedPercent:0,resetsAt:null}}}),
    row({id:'err',email:'err@example.com',state:'error',stateMessage:'읽지 못했어요.',live:{readAt:NOW-3600e3,weekly:{usedPercent:10,resetsAt:NOW+864e5}}}),
    row({id:'new',email:'new@example.com',live:null}),
    row({id:'gpt-a',service:'gpt',label:'ChatGPT · Codex',email:'a@example.com',plan:'prolite',live:{readAt:NOW,weekly:{usedPercent:0,resetsAt:null}}}),
    row({id:'gpt-b',service:'gpt',label:'ChatGPT · Codex',email:'b@example.com',plan:'pro',live:{readAt:NOW,weekly:{usedPercent:0,resetsAt:null}}}),
    row({id:'h-low',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'h1@example.com',live:{readAt:NOW,credits:0.22},credits:0.22,creditsAt:NOW}),
    row({id:'h-ok',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'h2@example.com',live:{readAt:NOW,credits:1026.84},credits:1026.84,creditsAt:NOW}),
    row({id:'suno',service:'suno',source:'manual',label:'Suno',kind:'plan',email:null,price:30,currency:'USD',billDay:3}),
  ];
  assert.deepEqual(rows.slice(0,6).map(r=>accountState(r,NOW).state),['out','low','ok','login','error','unknown']);
  assert.equal(accountState(rows[0],NOW).unblock,NOW+36*60e3);
  const groups=serviceGroups(rows,NOW);
  // 월 구독만 넣은 Suno는 한도가 없어 한눈에 줄에 없다(요금·결제일에만 보인다).
  assert.deepEqual(groups.map(g=>g.key),['claude','gpt','higgsfield']);
  const claude=groups[0];
  assert.deepEqual([claude.best.row.id,claude.usable.map(a=>a.row.id),claude.out.map(a=>a.row.id),claude.login.length,claude.error.length,claude.pending.length],['roomy',['roomy','low'],['out'],1,1,1]);
  // 남은 %가 같으면 큰 요금제(Pro > Pro Lite)를 먼저 추천한다.
  assert.equal(groups[1].best.row.id,'gpt-b');
  // 크레딧은 부족한 계정을 「넉넉」에서 빼고, 가장 많이 남은 계정을 추천한다.
  assert.deepEqual([groups[2].best.row.id,groups[2].ready.map(a=>a.row.id)],['h-ok',['h-ok']]);
  // 이번 확인보다 12시간 넘게 오래된 값만 남은 계정은 「못 읽음」이다.
  assert.equal(accountState(row({live:{readAt:NOW-13*3600e3,weekly:{usedPercent:5,resetsAt:NOW+864e5}}}),NOW,NOW).state,'error');
  // 읽은 뒤 5시간 창이 풀린 계정은 「풀렸을 거예요」(추정)로 따로 두고, 확인한 값이 있으면 그쪽을 추천한다.
  const passed=row({id:'passed',email:'p@example.com',live:{readAt:NOW-3*3600e3,session:{usedPercent:100,resetsAt:NOW-3600e3},weekly:{usedPercent:20,resetsAt:NOW+3*864e5}}});
  const p=accountState(passed,NOW);
  assert.deepEqual([p.state,p.projected,p.focus,p.left],['ok',NOW-3600e3,'weekly',80]);
  const mixed=serviceGroups([passed,rows[2]],NOW)[0];
  assert.deepEqual([mixed.best.row.id,mixed.projected.map(a=>a.row.id),mixed.ready.map(a=>a.row.id)],['roomy',['passed'],['roomy']]);
  assert.equal(serviceGroups([passed],NOW)[0].best.row.id,'passed');
  // 1%만 남은 확인값보다 창이 풀려 다시 찼을 계정을 먼저 추천하고, 거의 다 쓴 계정뿐이면 그 계정을 추천한다.
  const almost=row({id:'almost',email:'almost@example.com',live:{readAt:NOW,weekly:{usedPercent:99,resetsAt:NOW+864e5}}});
  assert.equal(serviceGroups([almost,passed],NOW)[0].best.row.id,'passed');
  assert.equal(serviceGroups([almost,rows[0]],NOW)[0].best.row.id,'almost');
});

test('the limit follows whichever window has less left, and past windows count as full again',async()=>{
  const {limitGauge,gaugeLevel,leftPercent,usedShown}=await import('../renderer/subscriptions.mjs');
  // 실제 계정판 세 상태(10-17): 5시간 소진 · 주간 99% · 여유.
  const out=row({id:'out',live:{readAt:NOW,session:{usedPercent:100,resetsAt:NOW+36*60e3},weekly:{usedPercent:51,resetsAt:NOW+115*3600e3}}});
  const low=row({id:'low',live:{readAt:NOW,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:99,resetsAt:NOW+51*3600e3}}});
  const roomy=row({id:'roomy',live:{readAt:NOW,session:{usedPercent:100,resetsAt:NOW-24*60e3},weekly:{usedPercent:78,resetsAt:NOW+44*3600e3}}});
  const a=limitGauge(out,NOW),b=limitGauge(low,NOW),c=limitGauge(roomy,NOW);
  assert.deepEqual([a.focus,a.left,a.resetsAt,gaugeLevel(a.session),gaugeLevel(a.weekly)],['session',0,NOW+36*60e3,'out','ok']);
  assert.deepEqual([b.focus,b.left,gaugeLevel(b.weekly),b.session.left],['weekly',1,'low',100]);
  assert.deepEqual([c.focus,c.left,c.session.left,c.session.resetsAt],['weekly',22,100,null]);
  // 주간 창만 있는 계정(Codex)은 창 하나, 크레딧·월 구독은 한도 창이 없다.
  const gpt=limitGauge(row({service:'gpt',live:{readAt:NOW,weekly:{usedPercent:49,resetsAt:NOW+145*3600e3}}}),NOW);
  assert.deepEqual([gpt.session,gpt.focus,gpt.left],[null,'weekly',51]);
  assert.equal(limitGauge(row({kind:'credit',live:{credits:3}}),NOW),null);
  // 직접 넣은 주간 구독은 「다 씀 표시」만 한도로 보인다.
  const manual=row({source:'manual',email:null,resetDay:5,resetHour:17,resetMinute:0,usedUpAt:NOW-3600e3});
  assert.deepEqual([limitGauge(manual,NOW).left,limitGauge({...manual,usedUpAt:null},NOW)],[0,null]);
  assert.deepEqual([leftPercent(99.6),leftPercent(0.5),leftPercent(48.7)],[0,99,51]);
  // 화면의 쓴 %는 남은 %와 늘 합이 100이다(꽉 차면 다 씀과 같은 기준).
  assert.deepEqual([usedShown(99.6),usedShown(0.5),usedShown(48.7),usedShown(0)],[100,1,49,0]);
});

test('the glance board shows one row per service and rolls each number only when it first shows or new values arrive',async()=>{
  const prior={document:globalThis.document,matchMedia:globalThis.matchMedia,CSS:globalThis.CSS,setInterval:globalThis.setInterval};
  const drawn=[];let reduced=false,everyMinute=null;
  globalThis.document={activeElement:null,hidden:false,documentElement:{dataset:{}},createDocumentFragment:()=>({append(){}}),createElement:()=>({style:{setProperty(){}},setAttribute(){},append(){}})};
  globalThis.matchMedia=()=>({matches:reduced});globalThis.CSS={escape:value=>String(value)};
  globalThis.setInterval=fn=>{everyMinute=fn;return {unref(){}};};
  try{
    const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
    const fresh=Date.now();
    const claude=[row({email:'out@example.com',live:{readAt:fresh,session:{usedPercent:100,resetsAt:fresh+36*60e3+30e3},weekly:{usedPercent:51,resetsAt:fresh+115*3600e3}}}),row({email:'roomy@example.com',plan:'max',live:{readAt:fresh,weekly:{usedPercent:78,resetsAt:fresh+44*3600e3+60e3}}})];
    const gpt=row({service:'gpt',label:'ChatGPT · Codex',email:'gpt@example.com',live:{readAt:fresh,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:49,resetsAt:fresh+145*3600e3}}});
    const gemini=row({service:'gemini',label:'Gemini',email:null,live:{readAt:fresh,weekly:{usedPercent:0,resetsAt:null},session:{usedPercent:0,resetsAt:null}}});
    const credit=row({service:'higgsfield',label:'Higgsfield',kind:'credit',live:{readAt:fresh,credits:1373},credits:1373,creditsAt:fresh});
    let snapshot={ok:true,tools:{},rows:[...claude,gpt,gemini,credit],settings:{usdKrw:1400},check:{at:fresh,total:5,ok:5},login:null,checking:false};
    const listeners=[];
    const bridge={subscriptions:{snapshot:async()=>snapshot,onChanged:cb=>{listeners.push(cb);return ()=>{};}}};
    // 그려진 HTML에서 굴리는 숫자 칸을 찾아 가짜 요소로 돌려준다.
    const el={dataset:{},innerHTML:'',handlers:new Map(),addEventListener(name,cb){this.handlers.set(name,cb);},querySelector:()=>null,contains:()=>false,
      querySelectorAll(){return [...this.innerHTML.matchAll(/data-roll="([^"]+)">([\d,.]+)/g)].map(([,key,value])=>({dataset:{roll:key},textContent:value,childNodes:[],closest:()=>({classList:{add:name=>drawn.push(key+':'+name)}})}));}};
    const board=createSubscriptionsBoard({bridge});
    board.render(el,{signedIn:true,native:true});
    await tick();
    // 서비스마다 한 줄: 추천 계정 이름, 개수 글, 덜 남은 창의 고리 하나.
    assert.equal((el.innerHTML.match(/class="ms-svc /g)||[]).length,4);
    assert.match(el.innerHTML,/<span class="ms-pick-label">추천<\/span><span class="ms-pick-name"><span>roomy<\/span><small>Max<\/small>/);
    assert.match(el.innerHTML,/2개 중 <em>1개<\/em> 바로 써요 <span class="ms-soft">1개 다 씀<\/span>/);
    // 숫자·고리는 쓴 만큼(다른 AI처럼 꽉 차면 그 창은 다 씀).
    assert.match(el.innerHTML,/data-roll="r-claude">78<small>%<\/small><\/b><span>주간 사용<\/span>/);
    assert.match(el.innerHTML,/data-roll="r-gpt">49<small>%/);
    assert.match(el.innerHTML,/data-roll="c-higgsfield">1,373<\/b><span>크레딧<\/span>/);
    assert.match(el.innerHTML,/<span class="ms-pick-label">연결한 계정<\/span><span class="ms-pick-name"><span>이 PC 로그인<\/span>/);
    // 78% 쓴 고리는 12시에서 78%까지 차고, 아직 안 쓴 Gemini는 채운 호가 없는 빈 원이다.
    assert.match(el.innerHTML,/<circle class="ms-arc" data-level="ok" cx="30" cy="30" r="25" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="22" transform="rotate\(-90 30 30\)"\/>/);
    assert.match(el.innerHTML,/<circle class="ms-track" data-level="ok" cx="30" cy="30" r="25" stroke-width="7"\/><\/svg><span class="ms-big"><b class="ms-big-num" data-roll="r-gemini">0<small>%/);
    // 02는 다 쓴 계정이 풀리는 때와 그 계정의 주간 사용량.
    assert.match(el.innerHTML,/<span class="ms-next-rel">36분 뒤<\/span><span class="ms-next-who"><b>out<\/b> Claude · 5시간 한도 · 주간\s51%\s사용/);
    assert.deepEqual(drawn.sort(),['c-higgsfield:is-drawing','r-claude:is-drawing','r-gemini:is-drawing','r-gpt:is-drawing']);
    // 새 스냅숏이 와도 값이 같으면 가만히 있다.
    drawn.length=0;listeners.forEach(cb=>cb(snapshot));assert.deepEqual(drawn,[]);
    // 펼친 줄은 계정 전체: 오른쪽 값에 창 이름, 보조 글은 나머지 창과 주간 초기화 때. 숫자는 굴리지 않는다.
    await el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:{subs:'toggle',id:'g-claude'}})}});
    assert.deepEqual(drawn,[]);
    assert.match(el.innerHTML,/<h3>바로 쓸 수 있어요<\/h3><div class="ms-acc"[^>]*><i class="ms-dot" data-state="ok" aria-hidden="true"><\/i><span class="ms-acc-name">roomy<small>Max<\/small><\/span><span class="ms-acc-sub">[^<]*주간 초기화<\/span>/);
    assert.match(el.innerHTML,/<span class="ms-bar" data-state="ok" aria-hidden="true"><i style="width:78%"><\/i><\/span><span class="ms-acc-val"><b class="ms-num">78%<\/b><small>주간 사용<\/small><\/span>/);
    // 「주간 51% 사용」 한 덩이는 줄바꿈 없는 빈칸으로 붙어 좁은 창에서도 갈라지지 않는다.
    assert.match(el.innerHTML,/<h3>막혀 있어요<\/h3>.*5시간 한도 · <b>[^<]+<\/b>에 풀려요\(36분 뒤\) · 주간\u00a051%\u00a0사용 · [^<]+ 주간 초기화<\/span>/);
    // 새로 읽은 값이 바뀌면 그 숫자만 다시 굴린다.
    drawn.length=0;snapshot={...snapshot,rows:[claude[0],claude[1],{...gpt,live:{...gpt.live,weekly:{usedPercent:60,resetsAt:fresh+145*3600e3}}},gemini,credit]};listeners.forEach(cb=>cb(snapshot));
    assert.deepEqual(drawn,['r-gpt:is-drawing']);
    // 1분마다 다시 그릴 때는 값이 바뀌어 있어도 굴리지 않는다(저절로 움직이는 효과 없음).
    drawn.length=0;snapshot.rows[2]={...snapshot.rows[2],live:{...gpt.live,weekly:{usedPercent:70,resetsAt:fresh+145*3600e3}}};everyMinute();
    assert.match(el.innerHTML,/data-roll="r-gpt">70<small>%/);assert.deepEqual(drawn,[]);
    // 본체의 자동 읽기(quiet) 알림으로 값이 바뀌어도 굴리지 않는다(저절로 움직이는 효과 없음).
    drawn.length=0;snapshot={...snapshot,quiet:true,rows:snapshot.rows.map((r,i)=>i===2?{...r,live:{...gpt.live,weekly:{usedPercent:75,resetsAt:fresh+145*3600e3}}}:r)};listeners.forEach(cb=>cb(snapshot));
    assert.match(el.innerHTML,/data-roll="r-gpt">75<small>%/);assert.deepEqual(drawn,[]);
    // 움직임 줄이기(기기·SYNK 설정)에서는 숫자도 고리도 그대로 보인다.
    board.setVisible(false);reduced=true;drawn.length=0;board.render(el,{signedIn:true,native:true});assert.deepEqual(drawn,[]);
    reduced=false;document.documentElement.dataset.motion='reduced';board.setVisible(false);board.render(el,{signedIn:true,native:true});assert.deepEqual(drawn,[]);
    board.dispose();
  }finally{Object.assign(globalThis,prior);}
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

test('this week lists unblocks, weekly resets of usable accounts and payments in time order',async()=>{
  const {upcoming}=await import('../renderer/subscriptions.mjs');
  const today=new Date(NOW).getDate();
  const items=upcoming([
    row({id:'out',live:{readAt:NOW,session:{usedPercent:100,resetsAt:NOW+2*3600e3},weekly:{usedPercent:40,resetsAt:NOW+3*864e5}}}),
    row({id:'ok',live:{readAt:NOW,weekly:{usedPercent:10,resetsAt:NOW+864e5}}}),
    row({id:'far',live:{readAt:NOW,weekly:{usedPercent:10,resetsAt:NOW+9*864e5}}}),
    row({id:'bill',source:'manual',kind:'plan',label:'Gemini',price:29000,billDay:today+2}),
  ],NOW);
  assert.deepEqual(items.map(i=>[i.row.id,i.type]),[['out','unblock'],['ok','reset'],['bill','bill']]);
  // 5시간 창이 막힌 계정은 풀리면 남는 주간 한도를 함께 알려 준다.
  assert.equal(items[0].after,60);
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
const prepare=()=>{globalThis.document=globalThis.document||{activeElement:null,hidden:false};globalThis.CSS=globalThis.CSS||{escape:value=>String(value)};};
const driver=el=>({
  click:async data=>{await el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:data})}});await tick();},
  submit:async (name,dataset={})=>{await el.handlers.get('submit')({preventDefault(){},target:{closest:()=>({dataset:{subsForm:name,...dataset},querySelector:()=>null})}});await tick();await tick();},
});

test('the board asks members to sign in, then starts first-time members from one empty card',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  let snapshot={ok:true,tools:{claude:{installed:false},gpt:{installed:true,version:'codex-cli 0.163.0'},higgsfield:{installed:false,npm:false}},rows:[],settings:{usdKrw:1400},check:null,login:null,checking:false};
  const calls=[];const listeners=[];
  const bridge={subscriptions:{snapshot:async()=>{calls.push('snapshot');return snapshot;},check:async()=>{calls.push('check');return snapshot;},onChanged:cb=>{listeners.push(cb);return ()=>{};},install:async s=>{calls.push('install:'+s);return {ok:true};},useExisting:async()=>({ok:false,code:'NOT_LOGGED_IN'}),login:async()=>({ok:true,id:'l-1'}),save:async()=>snapshot,help:async()=>({ok:true}),submitCode:async()=>({ok:true}),cancel:async()=>({ok:true}),openLoginUrl:async()=>({ok:true})}};
  const toasts=[];const board=createSubscriptionsBoard({bridge,toast:m=>toasts.push(m)});
  const el=fakeContainer(),{click}=driver(el);
  board.render(el,{signedIn:false,native:true});
  assert.match(el.innerHTML,/로그인하고 시작해요/);assert.match(el.innerHTML,/data-insight-action="account"/);assert.equal(calls.length,0);
  board.render(el,{signedIn:true,native:true});
  await tick();
  assert.deepEqual(calls,['snapshot']);
  // 계정이 없으면 한눈에 보기는 빈 카드 하나와 계정 관리 입구만 보인다.
  assert.match(el.innerHTML,/아직 연결한 계정이 없어요/);assert.match(el.innerHTML,/연결한 계정 0개/);assert.ok(!el.innerHTML.includes('ms-foot'));assert.ok(!el.innerHTML.includes('다음에 풀려요'));
  // 계정이 없어도 포스터의 「계정 관리」는 남고(다른 혜택 포스터와 같은 틀), 「지금 확인」은 읽을 계정이 생긴 뒤에만 보인다.
  assert.match(el.innerHTML,/class="ms-hero-actions"><button type="button" class="ms-button" data-subs="manage">계정 관리<\/button>/);assert.ok(!el.innerHTML.includes('data-subs="check"'));
  await click({subs:'manage'});
  // 계정 관리는 첫 서비스(Claude) 가이드를 펼쳐 두고, 설치 안 된 서비스는 머리에 알린다.
  assert.match(el.innerHTML,/계정 관리<\/h1>/);assert.match(el.innerHTML,/Claude 연결 가이드/);assert.match(el.innerHTML,/설치 창 열기/);assert.match(el.innerHTML,/irm https:\/\/claude\.ai\/install\.ps1 \| iex/);
  assert.match(el.innerHTML,/<span class="ms-tag">Claude<\/span><span class="ms-mtool">Claude Code<\/span><span class="ms-chip ms-chip-warn">설치 안 됨<\/span>/);
  assert.match(el.innerHTML,/<span class="ms-mtool">Codex · <span class="ms-num">0\.163\.0<\/span><\/span>/);
  await click({subs:'install',service:'claude'});
  assert.ok(calls.includes('install:claude'));assert.match(toasts.at(-1),/설치 창을 열었어요/);
  // 계정이 생긴 뒤 한눈에 보기로 돌아가면 쓴 한도가 보인다.
  snapshot={...snapshot,rows:[row({live:{readAt:Date.now(),weekly:{usedPercent:96,resetsAt:Date.now()+864e5}}})],check:{at:Date.now(),total:1,ok:1}};
  listeners.forEach(cb=>cb(snapshot));
  await click({subs:'glance'});
  assert.match(el.innerHTML,/지금 쓸 계정/);assert.match(el.innerHTML,/data-roll="r-claude">96<small>%/);assert.match(el.innerHTML,/계정 1개 <span class="ms-soft">거의 다 씀<\/span>/);assert.match(el.innerHTML,/마지막 확인/);
  assert.ok(!el.innerHTML.includes('<script'));
  board.render(el,{signedIn:true,native:false});
  assert.match(el.innerHTML,/PC 앱에서 쓰는 혜택이에요/);
  board.dispose();
});

test('the Gemini row shows both quota groups and its guide walks through the console sign-in',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const gemini=row({service:'gemini',label:'Gemini',email:null,live:{readAt:Date.now(),weekly:{usedPercent:36,resetsAt:Date.now()+3*864e5},session:{usedPercent:10,resetsAt:Date.now()+3600e3},models:[{name:'Claude·GPT 모델',usedPercent:0,resetsAt:Date.now()+3*864e5}]}});
  let snapshot={ok:true,tools:{claude:{installed:true},gpt:{installed:true},higgsfield:{installed:true,npm:true},gemini:{installed:true,version:'1.4.0'}},rows:[gemini],settings:{usdKrw:1400},check:{at:Date.now(),total:1,ok:1},login:null,checking:false};
  const listeners=[],logins=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,check:async()=>snapshot,onChanged:cb=>{listeners.push(cb);return ()=>{};},install:async()=>({ok:true}),useExisting:async()=>({ok:true}),login:async(service,options)=>{logins.push([service,options]);return {ok:true,id:'l-1'};},save:async()=>snapshot,help:async()=>({ok:true}),submitCode:async()=>({ok:true}),cancel:async()=>({ok:true}),openLoginUrl:async()=>({ok:true})}};
  const board=createSubscriptionsBoard({bridge});
  const el=fakeContainer(),{click}=driver(el);
  board.render(el,{signedIn:true,native:true});
  await tick();
  assert.match(el.innerHTML,/ms-s-gemini/);assert.match(el.innerHTML,/<span class="ms-tag">Gemini<\/span>/);
  assert.match(el.innerHTML,/data-roll="r-gemini">36<small>%<\/small><\/b><span>주간 사용/);
  await click({subs:'toggle',id:'g-gemini'});
  // 모델 이름이 이미 「모델」로 끝나면 두 번 붙이지 않는다.
  assert.match(el.innerHTML,/Claude·GPT 모델\s0%\s사용 · 5시간\s10%\s사용 · [^<]*주간 초기화/);
  // 하나도 안 쓴 한도는 0%로 보이고, 밀리는 초기화 시각을 만들지 않는다.
  snapshot={...snapshot,rows:[{...gemini,live:{readAt:Date.now(),weekly:{usedPercent:0,resetsAt:null},session:{usedPercent:0,resetsAt:null},models:[]}}]};listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/data-roll="r-gemini">0<small>%/);assert.doesNotMatch(el.innerHTML,/1분.안.뒤/);assert.doesNotMatch(el.innerHTML,/초기화 시각 없음/);
  snapshot={...snapshot,rows:[gemini]};listeners.forEach(cb=>cb(snapshot));
  // 계정 하나만 되는 Gemini는 머리 단추가 경고처럼 읽히지 않게 「계정 바꾸기」다.
  await click({subs:'manage'});
  assert.match(el.innerHTML,/data-subs="guide" data-service="gemini" aria-expanded="false">계정 바꾸기</);
  await click({subs:'guide',service:'gemini'});
  assert.match(el.innerHTML,/Gemini 연결 가이드/);assert.match(el.innerHTML,/Gemini 로그인/);assert.ok(!el.innerHTML.includes('>새 계정 연결</button>'));
  await click({subs:'login',service:'gemini'});
  assert.deepEqual(logins,[['gemini',{email:undefined}]]);
  snapshot={...snapshot,login:{id:'l-1',service:'gemini',stage:'console',console:true,message:'',needsCode:false,url:null}};
  listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/1\. Google OAuth/);assert.match(el.innerHTML,/오른쪽 클릭/);
  board.dispose();
});

test('Typecast connects with a pasted API key and Higgsfield can add more accounts through a private window',async()=>{
  prepare();
  // Node에는 읽기 전용 navigator가 있어 clipboard만 가짜로 붙인다.
  const copied=[];
  Object.defineProperty(globalThis.navigator,'clipboard',{value:{writeText:async text=>{copied.push(text);}},configurable:true});
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const higgs=row({service:'higgsfield',label:'Higgsfield',kind:'credit',email:'77@example.com',live:{readAt:Date.now(),credits:0.22},credits:0.22,creditsAt:Date.now()});
  const typecast=row({service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'…7890',plan:'lite',live:{readAt:Date.now(),credits:126416},credits:126416,creditsAt:Date.now()});
  let snapshot={ok:true,tools:{claude:{installed:true},gpt:{installed:true},higgsfield:{installed:true,npm:true},gemini:{installed:true},typecast:{installed:true,api:true}},rows:[higgs],settings:{usdKrw:1400},check:{at:Date.now(),total:1,ok:1},login:null,checking:false};
  const listeners=[],keys=[],logins=[];const toasts=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,check:async()=>snapshot,onChanged:cb=>{listeners.push(cb);return ()=>{};},install:async()=>({ok:true}),useExisting:async()=>({ok:true}),login:async(service,options)=>{logins.push([service,options]);return {ok:true,id:'l-1'};},save:async()=>snapshot,help:async()=>({ok:true}),submitCode:async()=>({ok:true}),cancel:async()=>({ok:true}),openLoginUrl:async()=>({ok:true}),
    connectKey:async(service,key)=>{keys.push([service,key]);if(key!=='tc-good-key-1234567890')return {ok:false,code:'INVALID_KEY'};snapshot={...snapshot,rows:[higgs,typecast]};return {ok:true,id:typecast.id,snapshot};}}};
  const board=createSubscriptionsBoard({bridge,toast:m=>toasts.push(m)});
  const el=fakeContainer(),{click,submit}=driver(el);
  board.render(el,{signedIn:true,native:true});
  await tick();
  // 아직 연결하지 않은 서비스는 목록 아래 한 줄로만 알린다.
  assert.match(el.innerHTML,/Claude · GPT · Gemini · Typecast도 연결할 수 있어요/);
  // Typecast 블록은 설치가 필요 없고, 가이드는 키 페이지 → 붙여 넣기 순서다.
  await click({subs:'manage'});
  assert.match(el.innerHTML,/ms-s-typecast/);assert.match(el.innerHTML,/Typecast API 키<small class="ms-mtool-note"> · 설치 필요 없음<\/small>/);
  await click({subs:'guide',service:'typecast'});
  assert.match(el.innerHTML,/Typecast 연결 가이드/);assert.match(el.innerHTML,/data-link="typecast-api"/);assert.match(el.innerHTML,/type="password"/);assert.ok(!el.innerHTML.includes('설치 창 열기'));
  el.handlers.get('input')({target:{id:'ms-key',value:'tc-wrong-key-000000'}});
  await submit('key',{service:'typecast'});
  assert.deepEqual(keys.at(-1),['typecast','tc-wrong-key-000000']);assert.match(toasts.at(-1),/키를 받지 않았어요/);
  el.handlers.get('input')({target:{id:'ms-key',value:' tc-good-key-1234567890 '}});
  await submit('key',{service:'typecast'});
  assert.deepEqual(keys.at(-1),['typecast','tc-good-key-1234567890']);assert.match(toasts.at(-1),/키를 연결했어요/);
  assert.ok(!el.innerHTML.includes('tc-good-key'));
  // 한눈에 줄은 키 끝 네 글자와 100 넘는 크레딧을 소수 없이, 펼친 줄은 요금제와 함께.
  await click({subs:'glance'});
  assert.match(el.innerHTML,/<span class="ms-pick-label">연결한 키<\/span><span class="ms-pick-name"><span>…7890<\/span><small>Lite<\/small>/);assert.match(el.innerHTML,/data-roll="c-typecast">126,416<\/b>/);
  await click({subs:'toggle',id:'g-typecast'});
  assert.match(el.innerHTML,/<span class="ms-acc-name">…7890<small>Lite<\/small><\/span><span class="ms-acc-sub"><\/span>/);
  // Higgsfield는 계정 여러 개: 기존 로그인 쓰기와 새 계정 연결이 함께 있다.
  await click({subs:'guide',service:'higgsfield'});
  assert.match(el.innerHTML,/>새 계정 연결<\/button>/);assert.match(el.innerHTML,/계정 여러 개/);
  await click({subs:'login',service:'higgsfield'});
  assert.deepEqual(logins.at(-1),['higgsfield',{email:undefined}]);
  snapshot={...snapshot,login:{id:'l-1',service:'higgsfield',stage:'browser',url:'https://clerk.higgsfield.ai/oauth/authorize?state=abc',needsCode:false,message:'브라우저에서 로그인을 마치면 자동으로 넘어가요.',console:false}};
  listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/data-subs="copy-url"/);assert.match(el.innerHTML,/시크릿 창/);
  await click({subs:'copy-url'});
  assert.deepEqual(copied,['https://clerk.higgsfield.ai/oauth/authorize?state=abc']);assert.match(toasts.at(-1),/시크릿 창/);
  board.dispose();
});

test('a late reply from the check button does not put a finished board back to checking',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const base={ok:true,tools:{claude:{installed:true}},rows:[row({live:{readAt:Date.now(),weekly:{usedPercent:20,resetsAt:Date.now()+864e5}}})],settings:{usdKrw:1400},login:null};
  const idle={...base,seq:1,check:{at:Date.now()-30*60e3,total:1,ok:1},checking:false};
  const running={...base,seq:3,check:idle.check,checking:true,progress:{done:0,total:1}},stale={...running,seq:6},done={...base,seq:7,check:{at:Date.now(),total:1,ok:1},checking:false};
  const listeners=[];
  // 알림(3·7)이 먼저 오고, 그보다 먼저 만든 응답(6)이 늦게 도착하는 순서를 흉내 낸다.
  const bridge={subscriptions:{snapshot:async()=>idle,check:async()=>{for(const s of [running,done])listeners.forEach(cb=>cb(s));return stale;},onChanged:cb=>{listeners.push(cb);return ()=>{};}}};
  const el=fakeContainer();
  const board=createSubscriptionsBoard({bridge});
  board.render(el,{signedIn:true,native:true});
  await tick();
  assert.match(el.innerHTML,/data-subs="check" >지금 확인</);
  el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:{subs:'check'}})}});
  for(let i=0;i<3;i++)await tick();
  assert.ok(!el.innerHTML.includes('확인 중…'));assert.ok(!el.innerHTML.includes('읽는 중이에요'));
  assert.match(el.innerHTML,/data-subs="check" >지금 확인</);
  board.dispose();
});

test('re-connecting a Typecast row from the fix band replaces that row key',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const typecast=row({service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'…7890',state:'needs-login',stateMessage:'Typecast API 키가 더 이상 맞지 않아요. 새 키로 다시 연결해 주세요.',live:{readAt:Date.now(),credits:900},credits:900,creditsAt:Date.now()});
  const snapshot={ok:true,tools:{typecast:{installed:true,api:true}},rows:[typecast],settings:{usdKrw:1400},check:{at:Date.now(),total:1,ok:0},login:null,checking:false};
  const calls=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{},connectKey:async(service,key,options)=>{calls.push([service,key,options]);return {ok:true,id:typecast.id,snapshot};}}};
  const board=createSubscriptionsBoard({bridge}),el=fakeContainer(),{click,submit}=driver(el);
  board.render(el,{signedIn:true,native:true});
  await tick();
  assert.match(el.innerHTML,/다시 로그인 필요 · <b>…7890<\/b>\(Typecast\)<\/span><button type="button" class="ms-button ms-button-small" data-subs="relogin" data-id="[^"]+">키 다시 넣기</);
  await click({subs:'relogin',id:typecast.id});
  assert.match(el.innerHTML,/Typecast 연결 가이드/);
  el.handlers.get('input')({target:{id:'ms-key',value:'tc-new-key-0987654321'}});
  await submit('key',{service:'typecast'});
  assert.deepEqual(calls.at(-1),['typecast','tc-new-key-0987654321',{replace:typecast.id}]);
  // 가이드에서 새로 넣는 키는 어느 줄도 바꾸지 않는다.
  await click({subs:'guide',service:'typecast'});
  el.handlers.get('input')({target:{id:'ms-key',value:'tc-other-key-1111111111'}});
  await submit('key',{service:'typecast'});
  assert.deepEqual(calls.at(-1),['typecast','tc-other-key-1111111111',{}]);
  board.dispose();
});

test('old values say when they were read and step back in tone, and a running check shows its progress',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const at=Date.now()-3*3600e3-60e3;
  const claude=row({live:{readAt:at,weekly:{usedPercent:20,resetsAt:Date.now()+3*864e5}}});
  let snapshot={ok:true,seq:1,tools:{claude:{installed:true}},rows:[claude],settings:{usdKrw:1400},check:{at,total:1,ok:1},login:null,checking:false};
  const listeners=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,check:async()=>snapshot,onChanged:cb=>{listeners.push(cb);return ()=>{};}}};
  const board=createSubscriptionsBoard({bridge}),el=fakeContainer();
  board.render(el,{signedIn:true,native:true});
  await tick();
  assert.match(el.innerHTML,/에 읽은 값이에요\(3시간 1분 전\) · 지금과 다를 수 있어요/);
  assert.match(el.innerHTML,/class="member-subs is-stale"/);
  assert.match(el.innerHTML,/class="ms-stale-note">.*에 읽은 값 · <button type="button" class="ms-link" data-subs="check" >지금 확인/);
  assert.match(el.innerHTML,/<span>주간 사용 · [\d/: ]+<\/span>/);
  // 20분~1시간은 몇 분 전인지만 붙이고 톤은 그대로, 못 읽은 계정이 있으면 그 수만 붙인다.
  const aging=Date.now()-40*60e3;
  snapshot={...snapshot,seq:2,rows:[{...claude,live:{...claude.live,readAt:aging}}],check:{at:aging,total:2,ok:1}};listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/마지막 확인 \d\d:\d\d\(40분 전\)/);assert.match(el.innerHTML,/1개 못 읽음/);assert.doesNotMatch(el.innerHTML,/is-stale/);
  snapshot={...snapshot,seq:3,checking:true,progress:{done:3,total:16}};listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/공식 프로그램으로 읽는 중이에요… <b class="ms-num">3\/16<\/b>/);assert.match(el.innerHTML,/확인 중…/);
  board.dispose();
});

test('the fix band gives each account its own action and rereads just that account',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const now=Date.now();
  const bad=[row({id:'a',email:'a@example.com',state:'needs-login'}),row({id:'b',email:'b@example.com',state:'error',stateMessage:'Claude Code가 응답하지 않았어요.',live:{readAt:now-3600e3,weekly:{usedPercent:10,resetsAt:now+864e5}}}),row({id:'c',email:'c@example.com',state:'error'}),row({id:'d',email:'d@example.com',state:'needs-login'})];
  const ok=row({id:'ok',email:'ok@example.com',live:{readAt:now,weekly:{usedPercent:10,resetsAt:now+864e5}}});
  let snapshot={ok:true,tools:{claude:{installed:true}},rows:[...bad,ok],settings:{usdKrw:1400},check:{at:now,total:5,ok:1},login:null,checking:false};
  const checks=[],listeners=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,check:async ids=>{checks.push(ids);return snapshot;},onChanged:cb=>{listeners.push(cb);return ()=>{};}}};
  const board=createSubscriptionsBoard({bridge}),el=fakeContainer(),{click}=driver(el);
  board.render(el,{signedIn:true,native:true});
  await tick();
  // 넷이면 둘만 보이고 나머지는 계정 관리로.
  assert.equal((el.innerHTML.match(/class="ms-fix-row"/g)||[]).length,3);
  assert.match(el.innerHTML,/손볼 계정이 2개 더 있어요<\/span><button type="button" class="ms-button ms-button-small" data-subs="manage">계정 관리에서 모두 보기/);
  assert.match(el.innerHTML,/5개 중 <em>1개<\/em> 바로 써요 <span class="ms-soft">2개 못 읽음 · 2개 다시 로그인<\/span>/);
  snapshot={...snapshot,rows:[bad[1],ok]};listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/읽지 못함 · <b>b<\/b>\(Claude\) · [\d/: ]+ 값<\/span><button type="button" class="ms-button ms-button-small" data-subs="reread" data-id="b" >다시 읽기/);
  await click({subs:'reread',id:'b'});
  assert.deepEqual(checks,[['b']]);
  // 펼친 줄도 같은 행동: 못 읽은 이유와 다시 읽기.
  await click({subs:'toggle',id:'g-claude'});
  assert.match(el.innerHTML,/<h3>손볼 것<\/h3>.*Claude Code가 응답하지 않았어요\./);
  board.dispose();
});

test('when only nearly used accounts are left the pick says so',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const now=Date.now(),rows=[row({email:'almost@example.com',live:{readAt:now,weekly:{usedPercent:99,resetsAt:now+864e5}}}),row({email:'out@example.com',live:{readAt:now,session:{usedPercent:100,resetsAt:now+3600e3+30e3},weekly:{usedPercent:10,resetsAt:now+3*864e5}}}),row({email:'weekly@example.com',live:{readAt:now,weekly:{usedPercent:100,resetsAt:now+20*3600e3+30e3}}})];
  const snapshot={ok:true,tools:{},rows,settings:{usdKrw:1400},check:{at:now,total:3,ok:3},login:null,checking:false};
  const board=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{}}}}),el=fakeContainer(),{click}=driver(el);
  board.render(el,{signedIn:true,native:true});
  await tick();
  assert.match(el.innerHTML,/<span class="ms-pick-label">남은 건 이것뿐<\/span><span class="ms-pick-name"><span>almost<\/span>/);
  assert.match(el.innerHTML,/3개 중 <em>1개<\/em> 바로 써요 <span class="ms-soft">1개 거의 다 씀 · 2개 다 씀<\/span>/);
  // 99% 쓴 고리는 거의 꽉 찬 노란 고리다(각진 끝이라 틈이 남는다).
  assert.match(el.innerHTML,/data-roll="r-claude">99<small>%<\/small><\/b><span>주간 사용<\/span>/);
  assert.match(el.innerHTML,/<circle class="ms-arc" data-level="low" cx="30" cy="30" r="25" stroke-width="7" stroke-linecap="butt" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="1" transform="rotate\(-90 30 30\)"\/>/);
  // 둥근 끝이 틈을 메워 닫혀 보이는 94%부터 각진 끝이다(93%는 둥근 끝).
  for (const [used,cap] of [[93,'round'],[94,'butt']]) {
    const one={ok:true,tools:{},rows:[row({email:'edge@example.com',live:{readAt:now,weekly:{usedPercent:used,resetsAt:now+864e5}}})],settings:{usdKrw:1400},check:{at:now,total:1,ok:1},login:null,checking:false};
    const b=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>one,onChanged:()=>()=>{}}}}),e=fakeContainer();
    b.render(e,{signedIn:true,native:true});
    await tick();
    assert.match(e.innerHTML,new RegExp(`stroke-linecap="${cap}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="${100-used}"`));
    b.dispose();
  }
  // 막힌 계정은 모두 주간 초기화 때를 보인다: 5시간이 막혔으면 따로, 주간이 막혔으면 풀리는 때가 곧 주간 초기화다.
  await click({subs:'toggle',id:'g-claude'});
  assert.match(el.innerHTML,/5시간 한도 · <b>[^<]+<\/b>에 풀려요\(1시간 뒤\) · 주간\s10%\s사용 · [^<]+ 주간 초기화<\/span>/);
  assert.match(el.innerHTML,/주간 한도 · <b>[^<]+<\/b> 주간 초기화에 풀려요\(20시간 뒤\)/);
  board.dispose();
});

test('account management keeps healthy rows quiet and opens each row menu in place',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const now=Date.now(),today=new Date(now).getDate();
  const healthy=row({id:'fine',email:'fine@example.com',plan:'max',live:{readAt:now,weekly:{usedPercent:10,resetsAt:now+864e5}}});
  const expired=row({id:'gone',email:'gone@example.com',state:'needs-login',stateMessage:'로그인이 풀렸어요.'});
  const paid=row({id:'paid',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'h@example.com',price:29000,billDay:((today+1)%28)+1,live:{readAt:now,credits:500},credits:500,creditsAt:now});
  const suno=row({id:'suno',service:'suno',source:'manual',label:'Suno',kind:'plan',email:null,price:10,currency:'USD',billDay:3});
  let snapshot={ok:true,tools:{claude:{installed:true,version:'2.1.302 (Claude Code)'},higgsfield:{installed:true,npm:true}},rows:[healthy,expired,paid,suno],settings:{usdKrw:1400},check:{at:now,total:3,ok:2},login:null,checking:false};
  const saves=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,check:async()=>snapshot,onChanged:()=>()=>{},save:async patch=>{saves.push(patch);return snapshot;}}};
  const board=createSubscriptionsBoard({bridge}),el=fakeContainer(),{click}=driver(el);
  board.render(el,{signedIn:true,native:true});
  await tick();
  // 아래 입구의 요금·결제일은 넣은 값이 있으면 단추로, 다음 결제와 함께 보인다.
  assert.match(el.innerHTML,/class="ms-button ms-foot-button" data-subs="manage" data-to="ms-cost"><b>요금·결제일<\/b><span>한 달 약 ₩43,000 · 다음 결제 /);
  await click({subs:'manage',to:'ms-cost'});
  // 정상 계정은 점만, 문제 계정만 칩. 확인 때 읽은 계정은 시각을 줄마다 쓰지 않는다.
  assert.match(el.innerHTML,/<span class="ms-mname">fine@example.com<\/span><span class="ms-mplan">Max<\/span><span class="ms-ok-mark">/);
  assert.match(el.innerHTML,/<span class="ms-mname">gone@example.com<\/span><span class="ms-mplan"><\/span><span class="ms-chip ms-chip-alert">다시 로그인<\/span>/);
  assert.ok(!el.innerHTML.includes('에 읽음'));assert.match(el.innerHTML,/<span class="ms-mtool">Claude Code · <span class="ms-num">2\.1\.302<\/span><\/span>/);
  assert.match(el.innerHTML,/id="ms-cost"/);assert.match(el.innerHTML,/한 달 구독료/);assert.match(el.innerHTML,/<span class="ms-tag">Suno<\/span><span class="ms-bill-name">월 구독만<\/span>/);
  await click({subs:'menu',id:'gone'});
  assert.match(el.innerHTML,/<p class="ms-warn-text">로그인이 풀렸어요\.<\/p>/);
  assert.match(el.innerHTML,/class="ms-button ms-button-small ms-button-primary" data-subs="relogin" data-id="gone">다시 로그인</);
  await click({subs:'edit',id:'gone'});
  assert.match(el.innerHTML,/data-subs-form="edit" data-id="gone"/);
  await click({subs:'remove',id:'gone'});
  assert.match(el.innerHTML,/한 번 더 누르면 지워요/);assert.equal(saves.length,0);
  await click({subs:'remove',id:'gone'});
  assert.deepEqual(saves,[{remove:'gone'}]);
  // 막혔을 때는 질문을 누르면 그 자리에서 답이 펼쳐진다.
  await click({subs:'help-item',id:'8'});
  assert.match(el.innerHTML,/aria-expanded="true"><span>연결을 끊고 싶어요<\/span>.*<p class="ms-help-a">계정 줄의 ⋯을 누르고/);
  // 혜택을 떠났다 돌아오면 펼친 줄 없이 한눈에 보기부터.
  await click({subs:'glance'});await click({subs:'toggle',id:'g-claude'});assert.match(el.innerHTML,/class="ms-svc open ms-s-claude"/);
  board.setVisible(false);board.render(el,{signedIn:true,native:true});
  assert.match(el.innerHTML,/지금 쓸 계정/);assert.doesNotMatch(el.innerHTML,/ms-svc open/);
  board.dispose();
});

/* ---------- 오늘은 이 계정부터 · 지난 7일 사용량 · 아끼는 팁(10-19) ---------- */
test('the account whose week resets within a day and still has room goes first today',async()=>{
  const {serviceGroups}=await import('../renderer/subscriptions.mjs');
  const H=3600e3;
  const soon=row({id:'soon',email:'soon@example.com',plan:'max_5x',live:{readAt:NOW,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:14,resetsAt:NOW+23*H}}});
  const roomy=row({id:'roomy',email:'roomy@example.com',plan:'max_20x',live:{readAt:NOW,weekly:{usedPercent:5,resetsAt:NOW+5*24*H}}});
  const g=serviceGroups([roomy,soon],NOW,NOW)[0];
  assert.deepEqual([g.best.row.id,g.today.row.id],['soon','soon']);
  // 초기화가 하루 넘게 남았거나, 주간을 80% 넘게 썼거나, 5시간 창이 80% 넘게 찼거나, 읽은 지 1시간이 넘으면 평소대로 가장 많이 남은 계정.
  const later={...soon,live:{...soon.live,weekly:{usedPercent:14,resetsAt:NOW+25*H}}};
  const used={...soon,live:{...soon.live,weekly:{usedPercent:81,resetsAt:NOW+23*H}}};
  const busy={...soon,live:{...soon.live,session:{usedPercent:85,resetsAt:NOW+2*H}}};
  for(const r of [later,used,busy]){const x=serviceGroups([roomy,r],NOW,NOW)[0];assert.deepEqual([x.today,x.best.row.id],[null,'roomy']);}
  const old={...soon,live:{...soon.live,readAt:NOW-2*H}};
  assert.equal(serviceGroups([roomy,old],NOW,NOW)[0].today,null);
});

function usageFixture({withOut=true,usage,tips={}}={}){
  const D=864e5,H=3600e3,fresh=Date.now();
  const soon=row({id:'soon',email:'soon@example.com',plan:'max_5x',live:{readAt:fresh,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:14,resetsAt:fresh+23*H}}});
  const roomy=row({id:'roomy',email:'roomy@example.com',plan:'max_20x',live:{readAt:fresh,weekly:{usedPercent:5,resetsAt:fresh+5*D}}});
  const out=row({id:'out',email:'out@example.com',plan:'max_5x',live:{readAt:fresh,weekly:{usedPercent:100,resetsAt:fresh+2*H}}});
  const founder=row({id:'founder',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'founder@example.com',plan:'ultra',live:{readAt:fresh,credits:1026.84},credits:1026.84,creditsAt:fresh});
  const low=row({id:'h-low',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'h1@example.com',plan:'ultra',live:{readAt:fresh,credits:0.22},credits:0.22,creditsAt:fresh});
  const buckets=[0,1,2,3,4].map(i=>({start:fresh-(5-i)*7*D,end:fresh-(4-i)*7*D}));
  const full=values=>values.map(v=>({v,partial:false}));
  const filled={since:fresh-40*D,buckets,services:{claude:{kind:'pct',accounts:3,bars:full([62,68,74,83,79]),base:72,baseWeeks:4,mixed:true},higgsfield:{kind:'credit',accounts:2,bars:full([620,540,710,650,1450]),base:630,baseWeeks:4,mixed:false}},accounts:{founder:{since:fresh-40*D,used7:1450,rate3:null,perDay:207.14,refillAt:fresh-21*D}}};
  const snapshot={ok:true,seq:1,tools:{},rows:[soon,roomy,...(withOut?[out]:[]),founder,low],settings:{usdKrw:1400,tips},check:{at:fresh,total:5,ok:5},login:null,checking:false,usage:usage===undefined?filled:usage(buckets,fresh)};
  const saves=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{},save:async patch=>{saves.push(patch);return {...snapshot,seq:snapshot.seq+1};},help:async()=>({ok:true})}};
  return {snapshot,saves,bridge};
}

test('the glance board puts today\'s account first and shows the last 7 days after the unblock list',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const f=usageFixture(),el=fakeContainer(),board=createSubscriptionsBoard({bridge:f.bridge});
  board.render(el,{signedIn:true,native:true});await tick();
  const html=el.innerHTML;
  // 01: 초기화가 하루 안인 계정을 먼저, 고리와 같은 쓴 % 하나로(「남음」 없음).
  assert.match(html,/<span class="ms-pick-label is-today">오늘은 이 계정부터<\/span><span class="ms-pick-name"><span>soon<\/span><small>Max 5x<\/small><\/span><span class="ms-pick-note">[^<]*초기화 · 아직\u00a014%만\u00a0썼어요<\/span>/);
  // 01 → 02 다음에 풀려요 → 03 지난 7일 사용량.
  const order=['01</span>지금 쓸 계정','02</span>다음에 풀려요','03</span>지난 7일 사용량'].map(t=>html.indexOf(t));
  assert.ok(order.every(i=>i>0)&&order[0]<order[1]&&order[1]<order[2]);
  // 막대 다섯(마지막이 지난 7일)과 그 전 4주 평균·차이. 큰 숫자 열은 없다.
  assert.match(html,/<em>79%<\/em><span class="mu-bar"><i style="height:79%" data-level="ok"><\/i><\/span><small>지난 7일<\/small>/);
  assert.match(html,/<span class="mu-cmp"><span>그 전 4주 평균 72%<\/span><b class="ms-num">\+7%p<\/b><\/span>/);
  assert.match(html,/<span class="mu-cmp"><span>그 전 4주 평균 630<\/span><b class="ms-num">\+820<\/b><\/span>/);
  assert.ok(!html.slice(html.indexOf('id="ms-usage"')).includes('ms-big-num'));
  // 요금제가 섞인 Claude에만 「왜 이 숫자?」.
  assert.match(html,/계정 3개 · 주간 한도 대비<\/small><button type="button" class="ms-link mu-why" data-subs="why"/);
  assert.ok(!html.slice(html.indexOf('mu-row ms-s-higgsfield')).includes('mu-why'));
  // 크레딧 팁 한 줄(기본 접힘): 평소의 2.3배, 잔액이 줄고 있는 계정의 바닥 예측과 다음 충전.
  assert.match(html,/Higgsfield를 지난 7일 동안 평소의 <b class="ms-num">2\.3배<\/b>\(1,450크레딧\) 썼어요\. 이 속도면 founder 계정이 <b class="ms-num">\d+\/\d+쯤<\/b> 바닥나요 · 다음 충전 \d+\/\d+쯤\./);
  assert.match(html,/data-subs="tip-open" data-key="spike:higgsfield" aria-expanded="false">자세히<\/button><\/div>/);
  assert.equal((html.match(/<div class="ms-tip[ "]/g)||[]).length,1);
  board.dispose();
});

test('a tip opens in place, takes one answer and stays quiet once answered',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const f=usageFixture(),el=fakeContainer(),board=createSubscriptionsBoard({bridge:f.bridge}),d=driver(el);
  board.render(el,{signedIn:true,native:true});await tick();
  await d.click({subs:'tip-open',key:'spike:higgsfield'});
  assert.match(el.innerHTML,/<ol><li>시안은 싼 모델·낮은 화질로 먼저 잡고, 마지막 한 번만 높은 화질로 뽑아 보세요\.<\/li>/);
  assert.match(el.innerHTML,/CLI·MCP로 만들면 늘 나가요\.<\/li>/);
  assert.match(el.innerHTML,/<b>왜 이 팁\?<\/b> 지난 7일 1,450 · 그 전 4주 평균 630 · founder 남은 크레딧 1,027 · 하루 약 207<br>기준: 읽은 잔액이 준 만큼을 쓴 양으로 보고, 그 전 4주 평균의 1\.5배를 넘고 300크레딧 이상일 때 · 다음 충전은 지난 충전\(\d+\/\d+\) 기준 · 사실 확인 10\/19/);
  assert.match(el.innerHTML,/data-subs="help" data-link="higgsfield-credits">공식 안내<\/button>/);
  await d.click({subs:'tip',key:'spike:higgsfield',act:'helpful'});
  assert.deepEqual(f.saves,[{tip:{key:'spike:higgsfield',action:'helpful'}}]);
  assert.match(el.innerHTML,/<p class="ms-tip-done">고마워요 · 이런 팁은 7일에 한 번만 보여 드려요<\/p>/);
  board.dispose();
  // 반응한 팁은 쉬는 동안 뜨지 않는다.
  const quiet=usageFixture({tips:{'spike:higgsfield':{helpful:1,until:Date.now()+864e5}}}),el2=fakeContainer(),b2=createSubscriptionsBoard({bridge:quiet.bridge});
  b2.render(el2,{signedIn:true,native:true});await tick();
  assert.equal((el2.innerHTML.match(/<div class="ms-tip[ "]/g)||[]).length,0);
  b2.dispose();
});

test('a new board says it is collecting records and numbers the section by what is above it',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const f=usageFixture({withOut:false,usage:buckets=>({since:null,buckets,services:{},accounts:{}})}),el=fakeContainer(),board=createSubscriptionsBoard({bridge:f.bridge});
  board.render(el,{signedIn:true,native:true});await tick();
  assert.ok(!el.innerHTML.includes('다음에 풀려요'));
  assert.match(el.innerHTML,/<span class="ms-section-number">02<\/span>지난 7일 사용량/);
  assert.equal((el.innerHTML.match(/<span class="mu-cmp is-empty"><span>기록 모으는 중<\/span><span>\d+\/\d+부터<\/span><\/span>/g)||[]).length,2);
  assert.equal((el.innerHTML.match(/class="mu-bar[^"]*is-empty"/g)||[]).length,10);
  assert.ok(!el.innerHTML.includes('왜 이 숫자'));
  assert.equal((el.innerHTML.match(/<div class="ms-tip[ "]/g)||[]).length,0);
  board.dispose();
});

test('a weekly service warns only when every usable account would run out before the first one comes back',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const D=864e5,fresh=Date.now();
  const a=row({id:'g-a',service:'gpt',label:'ChatGPT · Codex',email:'a@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:60,resetsAt:fresh+4*D}}});
  const b=row({id:'g-b',service:'gpt',label:'ChatGPT · Codex',email:'b@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:70,resetsAt:fresh+5*D}}});
  const draw=async rate=>{
    const buckets=[0,1,2,3,4].map(i=>({start:fresh-(5-i)*7*D,end:fresh-(4-i)*7*D}));
    const usage={since:fresh-10*D,buckets,services:{gpt:{kind:'pct',accounts:2,bars:[null,null,{v:40,partial:true},{v:50,partial:false},{v:65,partial:false}],base:50,baseWeeks:1,mixed:false}},accounts:{'g-a':{since:fresh-10*D,used7:40,rate3:rate,perDay:6,refillAt:null},'g-b':{since:fresh-10*D,used7:40,rate3:rate,perDay:6,refillAt:null}}};
    const snapshot={ok:true,seq:1,tools:{},rows:[a,b],settings:{usdKrw:1400},check:{at:fresh,total:2,ok:2},login:null,checking:false,usage};
    const el=fakeContainer(),board=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{}}}});
    board.render(el,{signedIn:true,native:true});await tick();board.dispose();return el.innerHTML;
  };
  // 남은 40%+30%를 하루 20%p씩 두 계정이 쓰면 이틀이 안 돼 다 막히는데, 먼저 풀리는 건 나흘 뒤다.
  assert.match(await draw(20),/이 속도면 <b class="ms-num">[^<]+(오전|오후)쯤<\/b> GPT 계정이 모두 막혀요\. 가장 먼저 풀리는 건 [^<]+예요\./);
  // 하루 5%p씩이면 풀리기 전에 막히지 않아 말하지 않는다. 그 전 7일 하나로 비교하면 「그 전 7일」.
  const calm=await draw(5);
  assert.equal((calm.match(/<div class="ms-tip[ "]/g)||[]).length,0);
  assert.match(calm,/<span class="mu-cmp"><span>그 전 7일 50%<\/span><b class="ms-num">\+15%p<\/b><\/span>/);
});

test('rested tips leave one line to bring them back',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const f=usageFixture({tips:{'spike:higgsfield':{stops:1,until:Date.now()+28*864e5}}}),el=fakeContainer(),board=createSubscriptionsBoard({bridge:f.bridge}),d=driver(el);
  board.render(el,{signedIn:true,native:true});await tick();
  assert.match(el.innerHTML,/<p class="mu-rest">쉬고 있는 팁 1개 · <button type="button" class="ms-link" data-subs="tip-reset">다시 보기<\/button><\/p>/);
  await d.click({subs:'tip-reset'});
  assert.deepEqual(f.saves,[{tip:{action:'reset'}}]);
  board.dispose();
});

test('the two most urgent tips show first and Typecast needs a bigger jump',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const D=864e5,fresh=Date.now(),buckets=[0,1,2,3,4].map(i=>({start:fresh-(5-i)*7*D,end:fresh-(4-i)*7*D}));
  const full=values=>values.map(v=>({v,partial:false}));
  const a=row({id:'g-a',service:'gpt',label:'ChatGPT · Codex',email:'a@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:60,resetsAt:fresh+4*D}}});
  const b=row({id:'g-b',service:'gpt',label:'ChatGPT · Codex',email:'b@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:70,resetsAt:fresh+5*D}}});
  const founder=row({id:'founder',service:'higgsfield',label:'Higgsfield',kind:'credit',email:'founder@example.com',plan:'ultra',live:{readAt:fresh,credits:1026.84},credits:1026.84,creditsAt:fresh});
  const key=row({id:'tc',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'FjrE',plan:'lite',live:{readAt:fresh,credits:900000},credits:900000,creditsAt:fresh});
  const draw=async typecast=>{
    const usage={since:fresh-40*D,buckets,services:{gpt:{kind:'pct',accounts:2,since:fresh-40*D,bars:full([40,45,50,55,65]),base:50,baseWeeks:4,mixed:false},higgsfield:{kind:'credit',accounts:1,since:fresh-40*D,bars:full([620,540,710,650,1450]),base:630,baseWeeks:4,mixed:false},typecast:{kind:'credit',accounts:1,since:fresh-40*D,bars:full(typecast),base:Math.round(typecast.slice(0,4).reduce((x,y)=>x+y,0)/4),baseWeeks:4,mixed:false}},
      accounts:{'g-a':{since:fresh-40*D,used7:40,rate3:20,perDay:6,refillAt:null},'g-b':{since:fresh-40*D,used7:40,rate3:20,perDay:6,refillAt:null},founder:{since:fresh-40*D,used7:1450,rate3:null,perDay:207.14,refillAt:fresh-21*D},tc:{since:fresh-40*D,used7:typecast[4],rate3:null,perDay:typecast[4]/7,refillAt:null}}};
    const snapshot={ok:true,seq:1,tools:{},rows:[a,b,founder,key],settings:{usdKrw:1400},check:{at:fresh,total:4,ok:4},login:null,checking:false,usage};
    const el=fakeContainer(),board=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{}}}});
    board.render(el,{signedIn:true,native:true});await tick();board.dispose();return el.innerHTML;
  };
  // Typecast 지난 7일 540·평소 350은 1.5배를 넘어도 3,000크레딧이 안 돼 말하지 않는다.
  const small=await draw([300,350,400,350,540]);
  assert.ok(!small.includes('data-key="spike:typecast"'));
  // 셋이 다 걸리면 일이 먼저 닥치는 둘(GPT 이틀 안 · Higgsfield 닷새 안)만, 예측 없는 Typecast는 뒤로.
  const three=await draw([2000,2000,2000,2000,9000]);
  assert.equal((three.match(/<div class="ms-tip[ "]/g)||[]).length,2);
  assert.ok(three.includes('data-key="pace:gpt"')&&three.includes('data-key="spike:higgsfield"')&&!three.includes('data-key="spike:typecast"'));
});

test('right after "stop" the line to bring tips back is already there',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const f=usageFixture(),el=fakeContainer(),d=driver(el);
  // 본체처럼 반응을 판 설정에 남기고 새 스냅숏을 돌려준다.
  f.bridge.subscriptions.save=async patch=>{f.saves.push(patch);f.snapshot.settings.tips={[patch.tip.key]:{stops:1,until:Date.now()+28*864e5}};return {...f.snapshot,seq:2};};
  const board=createSubscriptionsBoard({bridge:f.bridge});
  board.render(el,{signedIn:true,native:true});await tick();
  await d.click({subs:'tip-open',key:'spike:higgsfield'});
  await d.click({subs:'tip',key:'spike:higgsfield',act:'stop'});
  assert.match(el.innerHTML,/<p class="ms-tip-done">알겠어요 · 이 종류는 4주 동안 쉬어요\(칸 아래 「다시 보기」로 되돌릴 수 있어요\)<\/p>/);
  assert.match(el.innerHTML,/<p class="mu-rest">쉬고 있는 팁 1개 · <button type="button" class="ms-link" data-subs="tip-reset">다시 보기<\/button><\/p>/);
  board.dispose();
});

/* ---------- 초기화권(10-19) ---------- */
test('reset passes come from Codex for GPT and from the member for Claude, and expired ones drop out',async()=>{
  const {passesOf}=await import('../renderer/subscriptions.mjs');
  const D=864e5;
  const gpt=row({service:'gpt',label:'ChatGPT · Codex',live:{readAt:NOW,weekly:{usedPercent:100,resetsAt:NOW+5*D},resets:{count:2,until:[NOW+D,NOW+4*D]}}});
  assert.deepEqual(passesOf(gpt,NOW),{count:2,until:NOW+D,manual:false});
  // 읽은 뒤 하나가 만료되면 한 장만, 다음 만료일로. 개수만 아는 응답은 만료일 없이.
  assert.deepEqual(passesOf(gpt,NOW+2*D),{count:1,until:NOW+4*D,manual:false});
  assert.deepEqual(passesOf({...gpt,live:{...gpt.live,resets:{count:1,until:null}}},NOW),{count:1,until:null,manual:false});
  assert.equal(passesOf({...gpt,live:{...gpt.live,resets:{count:0,until:[]}}},NOW),null);
  assert.equal(passesOf({...gpt,live:{...gpt.live,resets:null}},NOW),null);
  // Claude는 넣은 값. 만료가 지나면 없음.
  const claude=row({passCount:1,passUntil:NOW+3*D});
  assert.deepEqual(passesOf(claude,NOW),{count:1,until:NOW+3*D,manual:true});
  assert.equal(passesOf(claude,NOW+4*D),null);
  assert.deepEqual(passesOf(row({passCount:2,passUntil:null}),NOW),{count:2,until:null,manual:true});
  assert.equal(passesOf(row({service:'gemini',passCount:1}),NOW),null);
  assert.equal(passesOf(row({source:'manual',passCount:1}),NOW),null);
});

test('a blocked account with a reset pass says whether to use it now or keep it',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const D=864e5,H=3600e3,fresh=Date.now();
  const gpt=(id,live)=>row({id,service:'gpt',label:'ChatGPT · Codex',email:`${id}@example.com`,plan:'pro',live:{readAt:fresh,...live}});
  const draw=async rows=>{
    const snapshot={ok:true,seq:1,tools:{},rows,settings:{usdKrw:1400},check:{at:fresh,total:rows.length,ok:rows.length},login:null,checking:false,usage:{since:fresh,buckets:[],services:{},accounts:{}}};
    const el=fakeContainer(),board=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{}}}}),d=driver(el);
    board.render(el,{signedIn:true,native:true});await tick();
    await d.click({subs:'toggle',id:'g-gpt'});
    const html=el.innerHTML;board.dispose();return html;
  };
  const withPass=gpt('a',{weekly:{usedPercent:100,resetsAt:fresh+5*D},resets:{count:1,until:[fresh+10*D]}});
  // 둘 다 막혔고 먼저 풀리는 게 나흘 뒤: 서비스 줄에 장수, 「쓰면 지금 풀려요」 팁과 줄 안의 안내, 02에도.
  let html=await draw([withPass,gpt('b',{weekly:{usedPercent:100,resetsAt:fresh+4*D}})]);
  assert.match(html,/2개 중 <em>0개<\/em> 바로 써요 <span class="ms-soft">2개 다 씀 · 초기화권 1장<\/span>/);
  assert.match(html,/GPT 계정이 모두 막혔어요\. 가장 먼저 풀리는 건 <b class="ms-num">[^<]+<\/b>예요\. <b>a<\/b> 계정의 초기화권을 쓰면 지금 풀려요\./);
  assert.match(html,/<span class="ms-pass">초기화권\u00a01장 · [^<]+까지<\/span> · 지금 쓰면 풀려요<\/span><span class="ms-acc-act"><button type="button" class="ms-button ms-button-small" data-subs="help" data-link="codex-resets">쓰는 법<\/button>/);
  assert.match(html,/<b>a<\/b> GPT · 주간 한도 · <span class="ms-pass">초기화권\u00a01장/);
  // 같은 서비스에 넉넉한 계정이 있으면 아껴 두라고만 하고 팁은 없다.
  html=await draw([withPass,gpt('c',{weekly:{usedPercent:20,resetsAt:fresh+3*D}})]);
  assert.match(html,/ · 다른 계정이 넉넉해 아껴 둬도 돼요<\/span>/);
  assert.ok(!html.includes('data-key="pass:gpt"'));
  // 하루 안에 풀리면 아껴 둔다(30초는 그리는 사이 시간이 흘러도 시간 단위로 읽히게 둔 여유).
  html=await draw([gpt('a',{weekly:{usedPercent:100,resetsAt:fresh+3*H+30e3},resets:{count:1,until:[fresh+10*D]}})]);
  assert.match(html,/ · 3시간 뒤 풀려서 아껴 둬도 돼요<\/span>/);
  assert.ok(!html.includes('data-key="pass:gpt"'));
  // 줄 안내와 팁은 같은 기준: 다른 계정이 20시간 뒤 풀리면 초기화권 계정 줄도 그때까지 기다리라고 한다.
  html=await draw([withPass,gpt('b',{weekly:{usedPercent:100,resetsAt:fresh+20*H+30e3}})]);
  assert.match(html,/ · 20시간 뒤 b 계정이 풀려서 아껴 둬도 돼요<\/span>/);
  assert.ok(!html.includes('data-key="pass:gpt"'));
  // 못 읽은 계정이 섞이면 「모두 막혔어요」라고 하지 않고 그 계정부터 보게 한다.
  html=await draw([withPass,row({id:'e',service:'gpt',label:'ChatGPT · Codex',email:'e@example.com',plan:'pro',state:'error',live:{readAt:fresh-3*H,weekly:{usedPercent:10,resetsAt:fresh+3*D}}})]);
  assert.match(html,/ · 못 읽은 계정부터 확인해 보세요<\/span>/);
  assert.ok(!html.includes('data-key="pass:gpt"'));
  // 다시 로그인할 계정이면 손볼 것 띠와 같은 낱말로.
  html=await draw([withPass,row({id:'l',service:'gpt',label:'ChatGPT · Codex',email:'l@example.com',plan:'pro',state:'needs-login',live:null})]);
  assert.match(html,/ · 다시 로그인할 계정부터 확인해 보세요<\/span>/);
});

test('an expiring GPT pass warns that using it moves the weekly reset, and old values of unread accounts stay out of tips',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const D=864e5,H=3600e3,fresh=Date.now();
  const draw=async rows=>{
    const snapshot={ok:true,seq:1,tools:{},rows,settings:{usdKrw:1400},check:{at:fresh,total:rows.length,ok:rows.length},login:null,checking:false,usage:{since:fresh,buckets:[],services:{},accounts:{}}};
    const el=fakeContainer(),board=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{}}}});
    board.render(el,{signedIn:true,native:true});await tick();const html=el.innerHTML;board.dispose();return html;
  };
  const gpt=extra=>row({id:'g',service:'gpt',label:'ChatGPT · Codex',email:'g@example.com',plan:'pro',...extra});
  // 주간 초기화(10시간 뒤)가 만료(이틀 뒤)보다 먼저 오면 지금 쓰지 말라고 한다 — GPT는 쓰면 그 초기화가 사라진다(공식).
  let html=await draw([gpt({live:{readAt:fresh,weekly:{usedPercent:70,resetsAt:fresh+10*H},resets:{count:1,until:[fresh+2*D]}}})]);
  assert.match(html,/GPT 초기화권이 <b class="ms-num">[^<]+<\/b>에 만료돼요\. 그 전에 [^<]+에 주간 초기화가 와요 · 지금 쓰면 그 초기화가 사라지니 초기화 뒤 많이 쓴 다음 만료 전에 써요\./);
  // 주간 초기화가 만료 뒤면 쓴 만큼 채워지되 주간 초기화 날짜가 바뀐다고 말한다.
  html=await draw([gpt({live:{readAt:fresh,weekly:{usedPercent:70,resetsAt:fresh+5*D},resets:{count:1,until:[fresh+2*D]}}})]);
  assert.match(html,/에 만료돼요\. 지금 주간 70% 썼어요 · 쓰면 쓴 만큼 다시 채워지고, 주간 초기화는 다시 쓰기 시작한 날부터 일주일쯤 뒤로 바뀌어요\./);
  // 못 읽은 계정의 옛 값(그사이 썼을 수 있다)으로는 팁을 띄우지 않는다. 줄의 장수는 남는다.
  html=await draw([gpt({state:'error',live:{readAt:fresh-3*H,weekly:{usedPercent:70,resetsAt:fresh+5*D},resets:{count:1,until:[fresh+2*D]}}})]);
  assert.ok(!html.includes('data-key="pass:gpt"'));
  assert.match(html,/계정 1개 <span class="ms-soft">못 읽음 · 초기화권 1장<\/span>/);
});

test('a reset pass about to expire gets one tip, and the full week list shows when it goes',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const D=864e5,fresh=Date.now();
  const keep=row({id:'keep',email:'keep@example.com',plan:'max_5x',passCount:1,passUntil:fresh+2*D,live:{readAt:fresh,weekly:{usedPercent:70,resetsAt:fresh+4*D}}});
  const out=row({id:'out',email:'out@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:100,resetsAt:fresh+D/2}}});
  const snapshot={ok:true,seq:1,tools:{},rows:[keep,out],settings:{usdKrw:1400},check:{at:fresh,total:2,ok:2},login:null,checking:false,usage:{since:fresh,buckets:[],services:{},accounts:{}}};
  const el=fakeContainer(),board=createSubscriptionsBoard({bridge:{subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{},help:async()=>({ok:true})}}}),d=driver(el);
  board.render(el,{signedIn:true,native:true});await tick();
  assert.match(el.innerHTML,/<b>keep<\/b> 계정의 초기화권이 <b class="ms-num">[^<]+<\/b>에 만료돼요\. 지금 주간 70% 썼어요 · 지금 쓰면 쓴 만큼 다시 채워지고, 주간 초기화도 원래대로 와요\./);
  await d.click({subs:'tip-open',key:'pass:claude'});
  assert.match(el.innerHTML,/<li>그 계정으로 로그인한 claude\.ai 웹이나 Claude 데스크톱의 설정 › 사용량에서 「Reset for free」를 눌러 써요\. Claude Code와 휴대폰 앱에서는 못 써요\.<\/li>/);
  assert.match(el.innerHTML,/기준: 만료까지 3일 안 · 사실 확인 10\/19/);
  assert.match(el.innerHTML,/data-subs="help" data-link="claude-usage">사용량 설정 열기<\/button><button type="button" class="ms-link ms-tip-more" data-subs="help" data-link="claude-resets">공식 안내<\/button>/);
  // 앞으로 7일 일정을 펼치면 초기화권 만료도 날짜순으로.
  await d.click({subs:'more'});
  assert.match(el.innerHTML,/<b>keep<\/b> Claude · 초기화권 1장 만료/);
  board.dispose();
});

test('Claude reset passes are typed in from the account menu and counted down after use',async()=>{
  prepare();
  const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
  const D=864e5,fresh=Date.now();
  const claude=row({id:'cl',email:'cl@example.com',plan:'max_5x',live:{readAt:fresh,weekly:{usedPercent:30,resetsAt:fresh+4*D}}});
  const gpt=row({id:'gp',service:'gpt',label:'ChatGPT · Codex',email:'gp@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:30,resetsAt:fresh+4*D},resets:{count:1,until:[fresh+6*D]}}});
  const none=row({id:'g0',service:'gpt',label:'ChatGPT · Codex',email:'g0@example.com',plan:'plus',live:{readAt:fresh,weekly:{usedPercent:30,resetsAt:fresh+4*D},resets:{count:0,until:[]}}});
  const gone=row({id:'gx',service:'gpt',label:'ChatGPT · Codex',email:'gx@example.com',plan:'plus',live:{readAt:fresh-2*D,weekly:{usedPercent:30,resetsAt:fresh+4*D},resets:{count:1,until:[fresh-D]}}});
  const snapshot={ok:true,seq:1,tools:{},rows:[claude,gpt,none,gone],settings:{usdKrw:1400},check:{at:fresh,total:4,ok:4},login:null,checking:false,usage:{since:fresh,buckets:[],services:{},accounts:{}}};
  const saves=[],toasts=[],checks=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{},help:async()=>({ok:true}),check:async ids=>{checks.push(ids);return {...snapshot,seq:snapshot.seq+saves.length+checks.length};},save:async patch=>{saves.push(patch);const r=snapshot.rows.find(x=>x.id===patch.row?.id);if(r)Object.assign(r,patch.row);return {...snapshot,seq:snapshot.seq+saves.length};}}};
  const el=fakeContainer(),board=createSubscriptionsBoard({bridge,toast:m=>toasts.push(m)}),d=driver(el);
  board.render(el,{signedIn:true,native:true});await tick();
  await d.click({subs:'manage'});
  // GPT 줄은 Codex가 알려 준 장수를 이름 옆에, ⋯에서 만료 때까지. 직접 넣는 칸은 없다.
  assert.match(el.innerHTML,/<span class="ms-mname">gp@example\.com<small class="ms-pass-mark">초기화권 1장<\/small><\/span>/);
  await d.click({subs:'menu',id:'gp'});
  assert.match(el.innerHTML,/<p>초기화권 1장 · [^<]+까지 · Codex가 알려 준 값이에요<\/p>/);
  assert.ok(!el.innerHTML.includes('data-subs="pass-edit" data-id="gp"'));
  // 읽었는데 없는 0장은 「없음」으로 말한다(모름과 다르다).
  await d.click({subs:'menu',id:'g0'});
  assert.match(el.innerHTML,/<p class="ms-soft">초기화권 없음 · Codex가 알려 준 값이에요<\/p>/);
  // 읽은 뒤 하나뿐인 초기화권이 만료된 줄은 그렇게 말한다.
  await d.click({subs:'menu',id:'gx'});
  assert.match(el.innerHTML,/<p class="ms-soft">읽은 뒤 초기화권이 만료됐어요 · 다시 확인하면 정확해요<\/p>/);
  // Claude 줄은 ⋯ → 「초기화권」으로 넣는다. claude.ai는 브라우저에 로그인된 계정을 열어서 그 계정 이름을 적는다.
  await d.click({subs:'menu',id:'cl'});
  await d.click({subs:'pass-edit',id:'cl'});
  assert.match(el.innerHTML,/<form class="ms-form ms-pass-form" data-subs-form="pass" data-id="cl">/);
  assert.match(el.innerHTML,/<b>cl<\/b> 계정으로 로그인한 브라우저에서 claude\.ai 설정 › 사용량을 열고, Resets에 보이는 주간 초기화권 수와 만료 때를 넣어 주세요\(5시간용은 넣지 않아요\)\./);
  assert.match(el.innerHTML,/data-subs="help" data-link="claude-usage">사용량 설정 열기<\/button>/);
  const submit=async values=>{await el.handlers.get('submit')({preventDefault(){},target:{closest:()=>({dataset:{subsForm:'pass',id:'cl'},querySelector:sel=>{const m=/\[name="([^"]+)"\]/.exec(sel);return m&&Object.hasOwn(values,m[1])?{value:values[m[1]]}:null;}})}});await tick();await tick();};
  // 지난 날짜는 받지 않는다.
  await submit({passCount:'1',passDate:'2020-01-01',passTime:''});
  assert.equal(saves.length,0);assert.match(toasts.at(-1),/만료 때가 이미 지났어요/);
  // 시각을 비우면 그날 23:59로 넣는다.
  const day=new Date(fresh+10*D),date=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  await submit({passCount:'2',passDate:date,passTime:''});
  assert.deepEqual(saves.at(-1),{row:{id:'cl',passCount:2,passUntil:new Date(day.getFullYear(),day.getMonth(),day.getDate(),23,59,0,0).getTime()}});
  assert.match(toasts.at(-1),/초기화권 2장을 넣었어요/);
  // 쓴 뒤에는 한 장씩 줄이고 그 계정만 다시 읽는다. 다 쓰면 만료 때도 비운다.
  await d.click({subs:'pass-used',id:'cl'});
  assert.deepEqual(saves.at(-1),{row:{id:'cl',passCount:1}});
  assert.deepEqual(checks,[['cl']]);
  await d.click({subs:'pass-used',id:'cl'});
  assert.deepEqual(saves.at(-1),{row:{id:'cl',passCount:0,passUntil:null}});
  assert.match(toasts.at(-1),/초기화권을 다 썼어요/);
  assert.deepEqual(checks,[['cl'],['cl']]);
  board.dispose();
});

/* ---------- 2차(10-19): 목표 묻기 · 요금제 맞추기 · 안 쓰는 구독 · 팁 끄기 ---------- */
// 지난 4주 통계(본체 ai-usage가 주는 모양) — weeks: 7일씩 쓴 양·읽은 가장 높은 주간 %·읽은 횟수, known: 놓친 틈 없음, hPeak: 읽은 5시간 % 최고.
const four=(values,extra={})=>({cover:true,known:true,hCover:true,hPeak:10,weeks:values.map(v=>({used:v,peak:v,reads:2})),...extra});
function phase2(rows,accounts,settings={},services={}){
  const fresh=Date.now(),D=864e5,buckets=[0,1,2,3,4].map(i=>({start:fresh-(5-i)*7*D,end:fresh-(4-i)*7*D}));
  const snapshot={ok:true,seq:1,tools:{},rows,settings:{usdKrw:1400,...settings},check:{at:fresh,total:rows.length,ok:rows.length},login:null,checking:false,usage:{since:fresh-40*D,buckets,services,accounts}};
  const saves=[],toasts=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,onChanged:()=>()=>{},help:async()=>({ok:true}),save:async patch=>{saves.push(patch);if(patch.settings)Object.assign(snapshot.settings,patch.settings);return {...snapshot,seq:snapshot.seq+saves.length};}}};
  return {snapshot,saves,toasts,bridge};
}
const draw2=async f=>{const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');const el=fakeContainer(),board=createSubscriptionsBoard({bridge:f.bridge,toast:m=>f.toasts.push(m)});board.render(el,{signedIn:true,native:true});await tick();return {el,board,d:driver(el)};};

test('the board asks which way tips should lean, keeps the answer and can turn every tip off',async()=>{
  prepare();
  const D=864e5,fresh=Date.now();
  const g=row({id:'g',service:'gpt',label:'ChatGPT · Codex',email:'g@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:40,resetsAt:fresh+4*D}}});
  const f=phase2([g],{}),{el,board,d}=await draw2(f);
  // 고르기 전: 칸 아래 한 줄 카드(세 가지), 그 아래 「팁 끄기」.
  assert.match(el.innerHTML,/<div class="mu-goal"><div class="mu-goal-text"><b>팁을 어느 쪽으로 드릴까요\?<\/b><span>고르신 쪽 팁을 먼저 드려요\. 언제든 바꿀 수 있어요\.<\/span><\/div>/);
  assert.equal((el.innerHTML.match(/data-subs="goal" data-goal="(save|smooth|unsure)"/g)||[]).length,3);
  await d.click({subs:'goal',goal:'save'});
  assert.deepEqual(f.saves.at(-1),{settings:{goal:'save'}});assert.match(f.toasts.at(-1),/팁을 「아끼기」 쪽으로 드릴게요/);
  // 고른 뒤: 카드는 접히고 「팁: 아끼기 쪽 · 바꾸기 · 팁 끄기」. 「바꾸기」는 카드를 다시 연다(고른 단추가 눌린 채).
  assert.ok(!el.innerHTML.includes('<div class="mu-goal">'));
  assert.match(el.innerHTML,/<p class="mu-goal-line">팁: 아끼기 쪽 · <button type="button" class="ms-link" data-subs="goal-change">바꾸기<\/button> · <button type="button" class="ms-link" data-subs="tips-off">팁 끄기<\/button><\/p>/);
  await d.click({subs:'goal-change'});
  assert.match(el.innerHTML,/class="ms-button ms-button-small is-on" data-subs="goal" data-goal="save" aria-pressed="true">아끼기<\/button>/);
  // 모르는 목표는 저장하지 않는다.
  const before=f.saves.length;await d.click({subs:'goal',goal:'upsell'});assert.equal(f.saves.length,before);
  // 팁 끄기 → 칸 아래 「팁을 꺼 두었어요 · 다시 켜기」만, 다시 켜기 → 끈 값을 푼다.
  await d.click({subs:'tips-off'});
  assert.deepEqual(f.saves.at(-1),{settings:{tipsOff:true}});
  assert.match(el.innerHTML,/<p class="mu-goal-line">팁을 꺼 두었어요 · <button type="button" class="ms-link" data-subs="tips-on">다시 켜기<\/button><\/p>/);
  assert.ok(!el.innerHTML.includes('<div class="mu-goal">'));
  await d.click({subs:'tips-on'});
  assert.deepEqual(f.saves.at(-1),{settings:{tipsOff:false}});
  // 「아직 몰라요」는 급한 순서 그대로라 그렇게 말한다(「아직 몰라요 쪽」이라고 하지 않는다).
  await d.click({subs:'goal-change'});await d.click({subs:'goal',goal:'unsure'});
  assert.deepEqual(f.saves.at(-1),{settings:{goal:'unsure'}});assert.equal(f.toasts.at(-1),'알겠어요. 급한 순서대로 드릴게요.');
  assert.match(el.innerHTML,/<p class="mu-goal-line">팁: 급한 순서 · <button type="button" class="ms-link" data-subs="goal-change">바꾸기<\/button> · <button type="button" class="ms-link" data-subs="tips-off">팁 끄기<\/button><\/p>/);
  board.dispose();
});

test('a Max account that stayed low for four weeks without a 5-hour block is offered one plan down',async()=>{
  prepare();
  const D=864e5,fresh=Date.now();
  const big=row({id:'big',email:'big@example.com',plan:'max_20x',live:{readAt:fresh,weekly:{usedPercent:11,resetsAt:fresh+3*D}}});
  const five=row({id:'five',email:'five@example.com',plan:'max_5x',live:{readAt:fresh,weekly:{usedPercent:14,resetsAt:fresh+2*D}}});
  const priced=fresh-new Date(2026,9,19).getTime()<=60*D;
  // 20x는 4주 모두 20% 이하, 5x는 16% 이하 — 덜 내는 액수가 큰 20x를 먼저 권한다.
  let f=phase2([big,five],{big:{weeks4:four([12,15,9,11],{hPeak:18})},five:{weeks4:four([10,12,14,8])}},{goal:'save'}),{el,board,d}=await draw2(f);
  assert.match(el.innerHTML,new RegExp(`<b>big<\\/b> 계정\\(Max 20x\\)은 4주 내내 주간 한도를 20%도 안 썼어요\\. Max 5x로 낮춰도 넉넉할 가능성이 커요${priced?' · 공식 요금으로 한 달 \\$100 덜 내요':''}\\.`));
  await d.click({subs:'tip-open',key:'size:claude'});
  // 공식 배수는 5시간 창 기준이라 그렇게 말하고, 주간은 공식 자료가 없다고 밝힌다. 결제 주기는 요금과 같이 확인한 지 60일 안에만.
  assert.match(el.innerHTML,new RegExp(`<li>Max 5x는 5시간마다 쓸 수 있는 양이 Max 20x의 1\\/4이에요\\(공식 배수 5배 대 20배\\)\\. 한 번에 길게 쓰는 날이 있으면 그날 막힐 수 있어요\\.<\\/li><li>주간 한도가 얼마나 줄어드는지는 공식 자료에 없어요\\. 그래서 4주 모두 20% 이하일 때만 알려 드려요\\.<\\/li>${priced?'<li>Max 요금제는 월 결제만 있어요\\.<\\/li>':''}<\\/ol>`));
  assert.match(el.innerHTML,/<b>왜 이 팁\?<\/b> 지난 4주 7일씩 12% · 15% · 9% · 11% · 읽은 5시간 창 최고 18%\(Max 5x로 치면 72%\)<br>기준: 4주 모두 20% 이하이고 읽을 때마다 5시간 창이 25% 미만이었을 때/);
  assert.match(el.innerHTML,/data-subs="help" data-link="claude-plans">공식 안내<\/button>/);
  board.dispose();
  // 한 주라도 기준을 넘거나, 읽은 5시간 창이 낮춘 요금제에 안 들어가거나(20x → 5x는 25% 이상), 5시간 기록이 4주를 못 덮었거나,
  // 놓친 틈이 있거나, 못 읽은 주가 있거나, 지금 다시 로그인해야 하거나, 「막힘 없이 쓰기」를 고르면 권하지 않는다.
  for (const [accounts,settings,state] of [[{big:{weeks4:four([12,25,9,11])}},{}],[{big:{weeks4:four([12,15,9,11],{hPeak:25})}},{}],[{big:{weeks4:four([12,15,9,11],{hCover:false})}},{}],
    [{big:{weeks4:four([12,15,9,11],{known:false})}},{}],[{big:{weeks4:{...four([12,15,9,11]),weeks:[12,0,0,0].map((v,i)=>({used:v,peak:i?null:v,reads:i?0:2}))}}},{}],
    [{big:{weeks4:four([12,15,9,11])}},{},'needs-login'],[{big:{weeks4:four([12,15,9,11])}},{goal:'smooth'}]]){
    f=phase2([{...big,state:state||'ok'}],accounts,settings);({el,board}=await draw2(f));
    assert.ok(!el.innerHTML.includes('data-key="size:claude"'));board.dispose();
  }
  // 5x는 16% 이하이고 5시간 창이 20% 미만일 때만 Pro를 권한다.
  f=phase2([five],{five:{weeks4:four([10,12,14,8])}});({el,board}=await draw2(f));
  assert.match(el.innerHTML,/<b>five<\/b> 계정\(Max 5x\)은 4주 내내 주간 한도를 16%도 안 썼어요\. Pro로 낮춰도 넉넉할 가능성이 커요/);board.dispose();
  for (const w4 of [four([10,17,14,8]),four([10,12,14,8],{hPeak:20})]){
    f=phase2([five],{five:{weeks4:w4}});({el,board}=await draw2(f));
    assert.ok(!el.innerHTML.includes('data-key="size:claude"'));board.dispose();
  }
});

test('an unused subscription is pointed out only in the five days before its bill, and the goal decides which tips come first',async()=>{
  prepare();
  const D=864e5,H=3600e3,fresh=Date.now(),bill=new Date(fresh+3*D).getDate();
  // Claude 계정의 주간 %는 대화와 Claude Code가 같이 쓰는 한도라 구독 전체를 말할 수 있다.
  const idle=row({id:'ci',email:'ci@example.com',plan:'pro',billDay:bill,price:29000,currency:'KRW',live:{readAt:fresh,weekly:{usedPercent:2,resetsAt:fresh+4*D}}});
  const key=row({id:'tc',service:'typecast',label:'Typecast',kind:'credit',email:null,keyHint:'FjrE',plan:'lite',billDay:bill,live:{readAt:fresh,credits:114647},credits:114647,creditsAt:fresh});
  const tcIdle={weeks4:{cover:true,known:true,hCover:false,hPeak:null,weeks:[0,0,0,0].map(v=>({used:v,peak:null,reads:4}))}};
  let f=phase2([idle,key],{ci:{weeks4:four([2,0,4,1])},tc:tcIdle}),{el,board}=await draw2(f);
  const when=new RegExp('(내일|\\d+\\/\\d+)');
  assert.match(el.innerHTML,new RegExp(`<b>ci<\\/b> 계정은 4주 동안 주간 한도를 5%도 안 썼어요\\. ${when.source} 결제\\(₩29,000\\) 전에 계속 쓸지 정해 보세요\\.`));
  assert.match(el.innerHTML,new RegExp(`<b>FjrE<\\/b> 키는 4주 동안 크레딧을 쓰지 않았어요\\. ${when.source} 결제 전에 계속 쓸지 정해 보세요\\.`));
  board.dispose();
  // 결제일 당일은 이미 결제됐을 수 있어 「결제 전에」라고 하지 않는다.
  f=phase2([{...idle,billDay:new Date(fresh).getDate()}],{ci:{weeks4:four([2,0,4,1])}});({el,board}=await draw2(f));
  assert.match(el.innerHTML,/<b>ci<\/b> 계정은 4주 동안 주간 한도를 5%도 안 썼어요\. 오늘이 결제일\(₩29,000\)이에요\. 계속 쓸지 정해 보세요\./);board.dispose();
  // 결제일이 5일보다 멀거나, 한 주라도 5%를 넘었거나, 4주를 덮지 못했거나, 놓친 틈·못 읽은 주가 있거나, 다시 로그인해야 하면 말하지 않는다.
  const far=new Date(fresh+12*D).getDate();
  for (const [r,a] of [[{...idle,billDay:far},four([2,0,4,1])],[idle,four([2,0,6,1])],[idle,four([2,0,4,1],{cover:false})],[idle,four([2,0,4,1],{known:false})],
    [idle,{...four([2,0,4,1]),weeks:[2,0,0,0].map((v,i)=>({used:v,peak:i?null:v,reads:i?0:2}))}],[{...idle,state:'needs-login'},four([2,0,4,1])]]){
    f=phase2([r],{ci:{weeks4:a}});({el,board}=await draw2(f));
    assert.ok(!el.innerHTML.includes('data-key="idle:claude"'));board.dispose();
  }
  // GPT·Gemini의 %는 Codex·Antigravity 한도라 구독 전체를 안 썼다고 말하지 않는다(대화는 여기 안 보인다).
  for (const service of ['gpt','gemini']){
    f=phase2([{...idle,id:'x',service,label:service,plan:'plus'}],{x:{weeks4:four([2,0,4,1])}});({el,board}=await draw2(f));
    assert.ok(!el.innerHTML.includes(`data-key="idle:${service}"`));board.dispose();
  }
  // 목표가 순서를 정한다: 급한 속도 경고(GPT)와 안 쓰는 키(Typecast)·요금제 맞추기(Claude)가 함께 걸리면
  // 「아끼기」는 아끼는 둘을, 고르기 전에는 일이 먼저 닥치는 둘(속도 경고 → 결제)을 보인다.
  const a=row({id:'g-a',service:'gpt',label:'ChatGPT · Codex',email:'a@example.com',plan:'pro',live:{readAt:fresh,weekly:{usedPercent:60,resetsAt:fresh+4*D}}});
  const big=row({id:'big',email:'big@example.com',plan:'max_20x',live:{readAt:fresh,weekly:{usedPercent:11,resetsAt:fresh+3*D}}});
  const accounts={'g-a':{since:fresh-40*D,used7:40,rate3:30,perDay:6,refillAt:null},big:{weeks4:four([12,15,9,11])},tc:tcIdle};
  // 속도 경고는 그 서비스의 7일 요약이 있어야 센다.
  const services={gpt:{kind:'pct',accounts:1,since:fresh-40*D,bars:[null,null,null,null,{v:40,partial:false}],base:null,baseWeeks:0,mixed:false}};
  f=phase2([a,big,key],accounts,{goal:'save'},services);({el,board}=await draw2(f));
  assert.ok(el.innerHTML.includes('data-key="idle:typecast"')&&el.innerHTML.includes('data-key="size:claude"')&&!el.innerHTML.includes('data-key="pace:gpt"'));board.dispose();
  f=phase2([a,big,key],accounts,{},services);({el,board}=await draw2(f));
  assert.ok(el.innerHTML.includes('data-key="pace:gpt"')&&el.innerHTML.includes('data-key="idle:typecast"')&&!el.innerHTML.includes('data-key="size:claude"'));board.dispose();
  // 결제일을 넣어 둔 Claude 계정이면 요금제 맞추기도 그 결제일 순서로 선다(내일 결제면 고르기 전에도 보인다).
  f=phase2([a,{...big,billDay:new Date(fresh+D).getDate()},key],accounts,{},services);({el,board}=await draw2(f));
  assert.ok(el.innerHTML.includes('data-key="size:claude"'));assert.equal([...el.innerHTML.matchAll(/data-key="[^"]+" aria-expanded/g)].length,2);board.dispose();
});
