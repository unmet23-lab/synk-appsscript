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
  assert.deepEqual(items.map(i=>i.text.split(' · ')[0]),['다시 로그인 필요','소진','거의 소진','크레딧 부족','결제 D-2']);
  assert.ok(!items.some(i=>i.text.includes('calm')));
  // 5시간 한도를 다 쓴 계정은 「5시간 소진」과 풀리는 때로 올라온다.
  const session=attention([row({email:'busy@example.com',live:{readAt:NOW,weekly:{usedPercent:51,resetsAt:NOW+4*864e5},session:{usedPercent:100,resetsAt:NOW+36*60e3}}})],NOW);
  assert.deepEqual([session[0].text,session[0].level],['5시간 소진 · busy Claude · 36분 뒤 풀림',0]);
  // 주간이 거의 다 찼어도 5시간을 다 썼으면 「지금 못 씀」이 먼저다.
  const both=attention([row({email:'both@example.com',live:{readAt:NOW,weekly:{usedPercent:95,resetsAt:NOW+864e5},session:{usedPercent:100,resetsAt:NOW+3600e3}}})],NOW);
  assert.equal(both[0].text,'5시간 소진 · both Claude · 1시간 뒤 풀림');
});

test('the limit rings follow whichever window has less left, and past windows count as full again',async()=>{
  const {limitGauge,roomiest,gaugeLevel,leftPercent}=await import('../renderer/subscriptions.mjs');
  // 실제 계정판 세 상태(10-17): 5시간 소진 · 주간 99% · 여유.
  const out=row({id:'out',live:{readAt:NOW,session:{usedPercent:100,resetsAt:NOW+36*60e3},weekly:{usedPercent:51,resetsAt:NOW+115*3600e3}}});
  const low=row({id:'low',live:{readAt:NOW,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:99,resetsAt:NOW+51*3600e3}}});
  const roomy=row({id:'roomy',live:{readAt:NOW,session:{usedPercent:100,resetsAt:NOW-24*60e3},weekly:{usedPercent:78,resetsAt:NOW+44*3600e3}}});
  const a=limitGauge(out,NOW),b=limitGauge(low,NOW),c=limitGauge(roomy,NOW);
  assert.deepEqual([a.focus,a.left,a.resetsAt,gaugeLevel(a.session),gaugeLevel(a.weekly)],['session',0,NOW+36*60e3,'out','ok']);
  assert.deepEqual([b.focus,b.left,gaugeLevel(b.weekly),b.session.left],['weekly',1,'low',100]);
  assert.deepEqual([c.focus,c.left,c.session.left,c.session.resetsAt],['weekly',22,100,null]);
  assert.equal(roomiest([out,low,roomy],NOW).id,'roomy');
  // 다시 로그인이 필요한 계정은 숫자가 커도 뒤로 간다.
  assert.equal(roomiest([{...roomy,state:'needs-login'},low],NOW).id,'low');
  // 주간 창만 있는 계정(Codex)은 고리 하나, 크레딧·월 구독은 고리가 없다.
  const gpt=limitGauge(row({service:'gpt',live:{readAt:NOW,weekly:{usedPercent:49,resetsAt:NOW+145*3600e3}}}),NOW);
  assert.deepEqual([gpt.session,gpt.focus,gpt.left],[null,'weekly',51]);
  assert.equal(limitGauge(row({kind:'credit',live:{credits:3}}),NOW),null);
  // 직접 넣은 주간 구독은 「소진 표시」만 고리로 보인다.
  const manual=row({source:'manual',email:null,resetDay:5,resetHour:17,resetMinute:0,usedUpAt:NOW-3600e3});
  assert.deepEqual([limitGauge(manual,NOW).left,limitGauge({...manual,usedUpAt:null},NOW)],[0,null]);
  assert.deepEqual([leftPercent(99.6),leftPercent(0.5),leftPercent(48.7)],[0,99,51]);
});

test('the board draws one ring per service and rolls the number only when it first shows or changes',async()=>{
  const prior={document:globalThis.document,matchMedia:globalThis.matchMedia,CSS:globalThis.CSS};
  const drawn=[],rolledText=[];let reduced=false;
  globalThis.document={activeElement:null,hidden:false,documentElement:{dataset:{}},createDocumentFragment:()=>({append(){}}),createElement:()=>({style:{setProperty(){}},setAttribute(){},append(){}})};
  globalThis.matchMedia=()=>({matches:reduced});globalThis.CSS={escape:value=>String(value)};
  try{
    const {createSubscriptionsBoard}=await import('../renderer/subscriptions.mjs');
    const fresh=Date.now();
    const claude=[row({email:'out@example.com',live:{readAt:fresh,session:{usedPercent:100,resetsAt:fresh+36*60e3+30e3},weekly:{usedPercent:51,resetsAt:fresh+115*3600e3}}}),row({email:'roomy@example.com',live:{readAt:fresh,weekly:{usedPercent:78,resetsAt:fresh+44*3600e3+60e3}}})];
    const gpt=row({service:'gpt',label:'ChatGPT · Codex',email:'gpt@example.com',live:{readAt:fresh,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:49,resetsAt:fresh+145*3600e3}}});
    const credit=row({service:'higgsfield',label:'Higgsfield',kind:'credit',live:{readAt:fresh,credits:1373},credits:1373,creditsAt:fresh});
    let snapshot={ok:true,tools:{},rows:[...claude,gpt,credit],settings:{usdKrw:1400},check:{at:fresh,total:4,ok:4},login:null,checking:false};
    const listeners=[];
    const bridge={subscriptions:{snapshot:async()=>snapshot,onChanged:cb=>{listeners.push(cb);return ()=>{};}}};
    // 그려진 HTML에서 고리 숫자 칸을 찾아 가짜 요소로 돌려준다.
    const el={dataset:{},innerHTML:'',handlers:new Map(),addEventListener(name,cb){this.handlers.set(name,cb);},querySelector:()=>null,contains:()=>false,
      querySelectorAll(){return [...this.innerHTML.matchAll(/data-roll="([^"]+)">(\d+)<small>/g)].map(([,key,value])=>({dataset:{roll:key},textContent:value+'%',childNodes:[],closest:()=>({classList:{add:name=>drawn.push(key+':'+name)}})}));}};
    const board=createSubscriptionsBoard({bridge});
    board.render(el,{signedIn:true,native:true});
    await new Promise(r=>setImmediate(r));
    // 주간 한도가 있는 서비스마다 고리 하나(가장 여유 있는 계정), 크레딧 서비스는 없다. 옛 막대는 없다.
    assert.equal((el.innerHTML.match(/class="ms-meter /g)||[]).length,2);
    assert.match(el.innerHTML,/<strong>roomy<\/strong><\/span><span class="ms-meter-note">계정 2개 중 가장 여유<\/span>/);
    assert.match(el.innerHTML,/data-roll="m-claude">22<small>%<\/small><\/b><span>주간 남음<\/span>/);
    assert.match(el.innerHTML,/data-roll="m-gpt">51<small>%/);assert.match(el.innerHTML,/주간 초기화까지 <b>1일 20시간<\/b>/);
    assert.ok(!el.innerHTML.includes('ms-bar'));
    // 다 남은 고리(아직 안 쓴 5시간)는 이음매 없는 닫힌 원이다(대시 없음).
    assert.match(el.innerHTML,/<circle class="ms-arc" data-ring="session" data-level="ok" cx="60" cy="60" r="43" stroke-width="8" data-full\/>/);
    // 서비스 줄은 「주간 한도」 구획이라 작은 고리와 글 모두 주간 기준이다.
    assert.match(el.innerHTML,/<b>roomy<\/b> <span class="ms-gauge ms-gauge-mini" data-level="ok">.*?<\/span>주간 <b class="ms-num">22%<\/b> 남음/);
    assert.deepEqual(drawn.sort(),['m-claude:is-drawing','m-gpt:is-drawing']);
    // 1분마다 다시 그려도 값이 같으면 가만히 있다.
    drawn.length=0;listeners.forEach(cb=>cb(snapshot));assert.deepEqual(drawn,[]);
    // 펼친 계정 고리는 처음 보일 때 한 번, 소진 계정은 0%로 코랄이다.
    await el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:{subs:'toggle',id:'g-claude'}})}});
    assert.equal(drawn.length,2);assert.match(el.innerHTML,/class="ms-gauge" data-level="out">/);
    assert.match(el.innerHTML,/5시간 <b class="ms-alert-text">소진<\/b> <span class="ms-soft">·\u00a036분\u00a0뒤\u00a0풀림/);
    // 값이 바뀌면 그 고리만 다시 굴린다.
    drawn.length=0;snapshot={...snapshot,rows:[claude[0],claude[1],{...gpt,live:{...gpt.live,weekly:{usedPercent:60,resetsAt:fresh+145*3600e3}}},credit]};listeners.forEach(cb=>cb(snapshot));
    assert.deepEqual(drawn,['m-gpt:is-drawing']);
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
  assert.match(el.innerHTML,/지금 볼 것/);assert.match(el.innerHTML,/거의 소진 · 주간 4% 남음/);assert.match(el.innerHTML,/앞으로 7일/);assert.match(el.innerHTML,/마지막 확인/);
  assert.ok(!el.innerHTML.includes('<script'));
  board.render(el,{signedIn:true,native:false});
  assert.match(el.innerHTML,/PC 앱에서 쓰는 혜택이에요/);
  board.dispose();
});

test('the Gemini guide walks through the console sign-in and the row shows both quota groups',async()=>{
  globalThis.document=globalThis.document||{activeElement:null,hidden:false};
  globalThis.CSS=globalThis.CSS||{escape:value=>String(value)};
  const {createSubscriptionsBoard,attention}=await import('../renderer/subscriptions.mjs');
  const gemini=row({service:'gemini',label:'Gemini',email:null,live:{readAt:Date.now(),weekly:{usedPercent:36,resetsAt:Date.now()+3*864e5},session:{usedPercent:10,resetsAt:Date.now()+3600e3},models:[{name:'Claude·GPT 모델',usedPercent:0,resetsAt:Date.now()+3*864e5}]}});
  let snapshot={ok:true,tools:{claude:{installed:true},gpt:{installed:true},higgsfield:{installed:true,npm:true},gemini:{installed:true,version:'1.4.0'}},rows:[gemini],settings:{usdKrw:1400},check:{at:Date.now(),total:1,ok:1},login:null,checking:false};
  const listeners=[],logins=[];
  const bridge={subscriptions:{snapshot:async()=>snapshot,check:async()=>snapshot,onChanged:cb=>{listeners.push(cb);return ()=>{};},install:async()=>({ok:true}),useExisting:async()=>({ok:true}),login:async(service,options)=>{logins.push([service,options]);return {ok:true,id:'l-1'};},save:async()=>snapshot,help:async()=>({ok:true}),submitCode:async()=>({ok:true}),cancel:async()=>({ok:true}),openLoginUrl:async()=>({ok:true})}};
  const board=createSubscriptionsBoard({bridge});
  const el=fakeContainer();
  board.render(el,{signedIn:true,native:true});
  await new Promise(r=>setImmediate(r));
  assert.match(el.innerHTML,/ms-s-gemini/);assert.match(el.innerHTML,/Antigravity CLI/);
  const click=async data=>{await el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:data})}});await new Promise(r=>setImmediate(r));};
  await click({subs:'toggle',id:'g-gemini'});
  assert.match(el.innerHTML,/Claude·GPT 모델 주간 <b class="ms-num">100%<\/b> 남음/);assert.match(el.innerHTML,/<strong>Gemini<\/strong>/);
  // 하나도 안 쓴 한도는 밀리는 초기화 시각 대신 「아직 안 씀」으로 보인다.
  snapshot={...snapshot,rows:[{...gemini,live:{readAt:Date.now(),weekly:{usedPercent:0,resetsAt:null},session:{usedPercent:0,resetsAt:null},models:[]}}]};listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/아직 안 씀/);assert.doesNotMatch(el.innerHTML,/1분.안.뒤.풀림/);
  snapshot={...snapshot,rows:[gemini]};listeners.forEach(cb=>cb(snapshot));
  await click({subs:'guide',service:'gemini'});
  assert.match(el.innerHTML,/Gemini 연결 가이드/);assert.match(el.innerHTML,/Gemini 로그인/);assert.ok(!el.innerHTML.includes('>새 계정 연결</button>'));
  await click({subs:'login',service:'gemini'});
  assert.deepEqual(logins,[['gemini',{email:undefined}]]);
  snapshot={...snapshot,login:{id:'l-1',service:'gemini',stage:'console',console:true,message:'',needsCode:false,url:null}};
  listeners.forEach(cb=>cb(snapshot));
  assert.match(el.innerHTML,/1\. Google OAuth/);assert.match(el.innerHTML,/오른쪽 클릭/);
  // 이메일이 없는 계정은 이름을 두 번 쓰지 않는다.
  assert.ok(attention([{...gemini,state:'needs-login'}],Date.now()).some(i=>i.text==='다시 로그인 필요 · Gemini'));
  board.dispose();
});

test('Typecast connects with a pasted API key and Higgsfield can add more accounts through a private window',async()=>{
  globalThis.document=globalThis.document||{activeElement:null,hidden:false};
  globalThis.CSS=globalThis.CSS||{escape:value=>String(value)};
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
  const el=fakeContainer();
  board.render(el,{signedIn:true,native:true});
  await new Promise(r=>setImmediate(r));
  const click=async data=>{await el.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:data})}});await new Promise(r=>setImmediate(r));};
  const submit=async (name,dataset={})=>{await el.handlers.get('submit')({preventDefault(){},target:{closest:()=>({dataset:{subsForm:name,...dataset},querySelector:()=>null})}});await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
  // Typecast 카드는 설치가 필요 없고, 가이드는 키 페이지 → 붙여 넣기 순서다.
  assert.match(el.innerHTML,/ms-s-typecast/);assert.match(el.innerHTML,/설치 필요 없음/);
  await click({subs:'guide',service:'typecast'});
  assert.match(el.innerHTML,/Typecast 연결 가이드/);assert.match(el.innerHTML,/data-link="typecast-api"/);assert.match(el.innerHTML,/type="password"/);assert.ok(!el.innerHTML.includes('설치 창 열기'));
  el.handlers.get('input')({target:{id:'ms-key',value:'tc-wrong-key-000000'}});
  await submit('key',{service:'typecast'});
  assert.deepEqual(keys.at(-1),['typecast','tc-wrong-key-000000']);assert.match(toasts.at(-1),/키를 받지 않았어요/);
  el.handlers.get('input')({target:{id:'ms-key',value:' tc-good-key-1234567890 '}});
  await submit('key',{service:'typecast'});
  assert.deepEqual(keys.at(-1),['typecast','tc-good-key-1234567890']);assert.match(toasts.at(-1),/키를 연결했어요/);
  assert.ok(!el.innerHTML.includes('tc-good-key'));
  await click({subs:'toggle',id:'g-typecast'});
  assert.match(el.innerHTML,/Typecast · 키 …7890/);assert.match(el.innerHTML,/126,416/);
  // Higgsfield는 이제 여러 계정: 기존 로그인 쓰기와 새 계정 연결이 함께 있다.
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
