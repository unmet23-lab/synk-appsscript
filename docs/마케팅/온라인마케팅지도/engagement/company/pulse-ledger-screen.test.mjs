// PULSE 직원 「운영판」 화면(2026-11-14 운영 조각 8-A) — 화면 쪽 약속. 장부 숫자는 pulse-ledger.test.mjs, 서버 길은 pulse-presale-server.test.mjs가 본다.
// 위 한 줄 숫자 넷 · 여섯 달 빗금 막대(고른 달만 베리) · 4주 일정 띠(칸 밖은 자르고 오늘 선) · 건별 표(좁은 화면 카드 이름표) · 결제 확인 창의 받은 곳 · 금액 · 실수령 칸.
// 실제 그림(1440 · 390 넘침, 달 바꾸기, CSV 내려받기)은 브라우저 확인이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pulseLedger} from './pulse-ledger.mjs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {ledgerDesk,placeLedger}=await import('./public/pulse-app/ledger-view.mjs');
const {header,dialogContent}=await import('./public/pulse-app/views.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const NOW='2026-11-14T03:00:00.000Z';
let n=0;
function project({stage='producing',payment,log,title=''}={}){
  n++;
  return {id:`p${n}`,title:title||`광고 ${n}`,customerName:`손님 ${n}`,stage,updatedAt:'2026-11-01T00:00:00.000Z',versions:[],
    studio:{request:{schemaVersion:1,number:`P-1114-${String(n).padStart(4,'0')}`,status:'confirmed',submittedAt:'2026-10-01T00:00:00.000Z',confirmedAt:'2026-10-01T01:00:00.000Z',answers:{package:'s30'},asks:[],notes:[],rounds:[],...(payment?{payment}:{}),...(log?{paymentLog:log}:{})}}};
}
const ROWS=[
  project({title:'<b>봄 광고</b>',payment:{status:'confirmed',confirmedAt:'2026-10-20T00:00:00.000Z',amount:290000,dueDate:'2026-11-12',channel:'direct',net:250000}}),
  project({title:'다음 건',payment:{status:'confirmed',confirmedAt:'2026-11-05T00:00:00.000Z',amount:390000,dueDate:'2026-12-20'}}),
  project({stage:'planning',payment:{status:'requested',requestedAt:'2026-11-01T00:00:00.000Z',amount:290000},log:[{kind:'requested',at:'2026-11-01T00:00:00.000Z',amount:290000}]}),
];
const LEDGER=pulseLedger(ROWS,{now:NOW});
const SEATS={video:{used:2,total:3},photo:{used:0,total:2},queue:{used:1,total:5}};

test('위 한 줄: 매출 · 받을 돈 · 제작 자리 · 가장 가까운 받으실 날, 오래 기다린 받을 돈과 지난 날은 베리',()=>{
  const html=ledgerDesk({data:LEDGER},{seatsNow:SEATS});
  const figures=[...html.matchAll(/<p class="ledger-figure( is-hot| is-seats)?"><span class="ledger-figure-label">([^<]*)<\/span><b>(.*?)<\/b><small>([^<]*)<\/small><\/p>/g)].map(m=>({hot:m[1]===' is-hot',label:m[2],value:m[3].replace(/<[^>]+>/g,''),sub:m[4]}));
  assert.match(html,/<p class="ledger-figure is-seats"><span class="ledger-figure-label">제작 자리<\/span><b><span class="ledger-nowrap">영상 2\/3<\/span><span class="ledger-sep" aria-hidden="true"> · <\/span><span class="ledger-nowrap">사진 0\/2<\/span><span class="ledger-sep" aria-hidden="true"> · <\/span><span class="ledger-nowrap">대기 1\/5<\/span><\/b>/,'자리 숫자는 덩이째로만 줄을 바꾼다');
  assert.deepEqual(figures.map(f=>f.label),['11월 매출','받을 돈','제작 자리','가장 가까운 받으실 날']);
  // 지난 달을 고르면 매출만 그 달 — 받을 돈 · 가장 가까운 날 · 4주 일정은 「지금」이라고 이름에 적는다(화면 검수 F2).
  const past=ledgerDesk({data:pulseLedger(ROWS,{month:'2026-10',now:NOW})});
  assert.deepEqual([...past.matchAll(/<span class="ledger-figure-label">([^<]*)<\/span>/g)].map(m=>m[1]),['10월 매출','받을 돈 · 지금','제작 자리','가장 가까운 받으실 날 · 지금']);
  assert.match(past,/<h2 id="ledger-band-h">4주 일정 · 지금 기준<\/h2>/);assert.match(html,/<h2 id="ledger-band-h">4주 일정<\/h2>/);
  assert.deepEqual(figures.map(f=>f.value),['390,000원','290,000원','영상 2/3 · 사진 0/2 · 대기 1/5','11월 12일 (목)']);
  assert.match(figures[0].sub,/확인 1건/);
  assert.equal(figures[1].sub,'요청 1건 · 가장 오래된 것 13일 지남');assert.equal(figures[1].hot,true,'7일 넘게 받지 못한 돈');
  assert.equal(figures[3].hot,true);assert.match(figures[3].sub,/^지났어요 · /);
  assert.ok(figures[3].sub.includes('&lt;b&gt;봄 광고&lt;/b&gt;'),'이름은 글로만');
  // 자리 몫을 못 읽으면 대시와 안내, 받을 돈이 없으면 그 말.
  const bare=ledgerDesk({data:pulseLedger([],{now:NOW})});
  assert.match(text(bare),/제작 자리 — 자리 수를 읽지 못했어요/);assert.match(text(bare),/받을 돈 0원 결제 요청한 건이 없어요/);assert.match(text(bare),/ 11월 매출 0원 /);assert.match(text(bare),/가장 가까운 받으실 날 — 납품 전 건이 없어요/);
  assert.doesNotMatch(bare,/is-hot/);
});

test('여섯 달 막대: 0부터 세는 빗금 막대, 고른 달만 베리(is-pick · aria-pressed), 누르면 그 달로 — 매출 0인 달은 높이 0',()=>{
  const html=ledgerDesk({data:LEDGER});
  const bars=[...html.matchAll(/<li class="ledger-bar( is-pick)?"><button type="button" data-action="ledger-month" data-month="(\d{4}-\d{2})" aria-pressed="(true|false)" aria-label="([^"]*)"><span class="ledger-bar-v">([^<]*)<\/span><span class="ledger-bar-track"><span class="ledger-bar-fill" data-h="(\d+)"><\/span><\/span><span class="ledger-bar-m">([^<]*)<\/span><\/button><\/li>/g)];
  assert.deepEqual(bars.map(m=>m[2]),['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']);
  assert.deepEqual(bars.map(m=>!!m[1]),[false,false,false,false,false,true]);assert.deepEqual(bars.map(m=>m[3]),['false','false','false','false','false','true']);
  assert.deepEqual(bars.map(m=>Number(m[6])),[0,0,0,0,74,100],'가장 큰 달이 100%, 나머지는 그 비율');
  assert.deepEqual(bars.map(m=>m[5]),['0','0','0','0','29만','39만']);assert.equal(bars[5][4],'2026년 11월 매출 390,000원');
  const october=ledgerDesk({data:pulseLedger(ROWS,{month:'2026-10',now:NOW})});
  assert.match(october,/<li class="ledger-bar is-pick"><button type="button" data-action="ledger-month" data-month="2026-10" aria-pressed="true"/);
  // 앞뒤 달 단추: 이번 달이면 다음 달 단추가 없다, 지난달이면 있다. CSV는 같은 달.
  assert.match(html,/data-month="2026-10" aria-label="2026년 10월로">‹ 10월<\/button><h1 tabindex="-1">2026년 11월<\/h1><span class="ledger-step is-off" aria-hidden="true"><\/span>/);
  assert.match(october,/<h1 tabindex="-1">2026년 10월<\/h1><button type="button" class="ledger-step" data-action="ledger-month" data-month="2026-11"/);
  assert.match(html,/<a class="ledger-csv" href="\/api\/pulse\/ledger\.csv\?month=2026-11" download="pulse-ledger-2026-11\.csv">월 CSV 내려받기<\/a>/);
  assert.match(october,/href="\/api\/pulse\/ledger\.csv\?month=2026-10"/);
});

test('4주 띠: 결제 확인 ~ 받으실 날, 칸 밖은 끝에서 자르고 오늘 선을 둔다 — 저희 차례 · 늦음 표시, 납품 전 건이 없으면 빈 줄',()=>{
  const html=ledgerDesk({data:LEDGER});
  assert.equal(LEDGER.band.from,'2026-11-07');assert.equal(LEDGER.band.to,'2026-12-04');
  assert.match(html,/<div class="ledger-band-body" data-today="26\.79">/,'7일째 칸의 가운데(7.5/28)');
  const rows=[...html.matchAll(/<li class="ledger-row ([^"]*)"><button type="button" class="ledger-row-t" data-action="open-project" data-id="([^"]+)">([^<]*)<small>([^<]*)<\/small><span class="sr"> · ([^<]*)<\/span><\/button><span class="ledger-track"><span class="ledger-span([^"]*)" data-left="([\d.]+)" data-width="([\d.]+)"><\/span><\/span><\/li>/g)];
  assert.deepEqual(rows.map(m=>m[2]),['p1','p2'],'늦은 건이 먼저');
  assert.equal(rows[0][1],'is-us is-late');assert.equal(rows[0][3],'&lt;b&gt;봄 광고&lt;/b&gt;');assert.equal(rows[0][4],'10.20 → 11.12 · 늦음');
  assert.deepEqual(rows.map(m=>m[5]),['저희 차례','저희 차례'],'차례는 색만이 아니라 화면 읽기 글로도(카본 A3)');
  assert.equal(rows[0][7],'0.00','칸 앞에서 시작한 건은 왼쪽 끝에서');assert.equal(rows[0][8],'21.43','11-07 ~ 11-12 여섯 칸');
  assert.equal(rows[1][7],'0.00');assert.equal(Number(rows[1][8]),100,'칸 뒤로 넘는 건은 오른쪽 끝까지');
  const ticks=[...html.matchAll(/<span data-x="([\d.]+)">([^<]*)<\/span>/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual(ticks,[['0.00','11.7'],['25.00','11.14'],['50.00','11.21'],['75.00','11.28']]);
  assert.match(html,/<p class="ledger-key" aria-hidden="true"><span class="is-us">저희 차례<\/span><span class="is-you">손님 차례<\/span><span class="is-today">오늘<\/span><\/p>/);
  assert.match(ledgerDesk({data:pulseLedger([],{now:NOW})}),/<li class="ledger-empty">결제를 확인하고 납품 전인 건이 없어요\.<\/li>/);
});

test('CSP: 작업실은 style 속성을 막는다 — 운영판 꼬리표에는 style이 없고, 높이 · 자리는 그린 뒤 placeLedger가 CSS 변수로 넣는다(0~100 밖 · 숫자 아님은 버림)',()=>{
  const html=ledgerDesk({data:LEDGER},{seatsNow:SEATS});
  assert.doesNotMatch(html,/\sstyle=/,'style 속성은 CSP(style-src \'self\')에 막혀 그려지지 않는다');
  // 꼬리표에서 data-* 숫자를 읽는 작은 가짜 DOM.
  const nodes=[...html.matchAll(/<(\w+) ([^>]*?(?:data-h|data-x|data-left|data-today)=[^>]*)>/g)].map(m=>{const attrs=Object.fromEntries([...m[2].matchAll(/data-([a-z]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])),cls=(m[2].match(/class="([^"]*)"/)||[])[1]||'',props={};
    return {cls,dataset:attrs,props,style:{setProperty:(name,value)=>{props[name]=value;}}};});
  nodes.push({cls:'ledger-span',dataset:{left:'abc',width:'140'},props:{},style:{setProperty(name,value){this.owner.props[name]=value;}}});nodes.at(-1).style.owner=nodes.at(-1);
  const pick=selector=>selector==='[data-h]'?nodes.filter(n=>'h' in n.dataset):selector==='[data-x]'?nodes.filter(n=>'x' in n.dataset):selector==='.ledger-span'?nodes.filter(n=>n.cls.split(' ').includes('ledger-span')):selector==='[data-today]'?nodes.filter(n=>'today' in n.dataset):[];
  placeLedger({querySelector:selector=>selector==='.staff-ledger'?{querySelectorAll:pick}:null});
  assert.deepEqual(nodes.filter(n=>'h' in n.dataset).map(n=>n.props['--h']),['0','0','0','0','74','100']);
  assert.deepEqual(nodes.filter(n=>'x' in n.dataset).map(n=>n.props['--x']),['0','25','50','75']);
  assert.deepEqual(nodes.filter(n=>n.cls==='ledger-span').map(n=>[n.props['--l'],n.props['--w']]),[['0','21.43'],['0','100'],[undefined,'100']],'숫자 아님은 넣지 않고 100 넘는 폭은 100');
  assert.deepEqual(nodes.filter(n=>'today' in n.dataset).map(n=>n.props['--today']),['26.79%']);
  assert.doesNotThrow(()=>placeLedger({querySelector:()=>null}),'운영판이 없으면 아무것도 안 한다');
});

test('건별 표: 칸마다 이름표(좁은 화면 카드), 결제 상태 · 며칠째 · 받은 곳 · 실수령, 이름을 누르면 그 프로젝트',()=>{
  const html=ledgerDesk({data:LEDGER});
  assert.match(html,/<thead><tr><th scope="col">이름<\/th><th scope="col">상품<\/th><th scope="col">금액<\/th><th scope="col">결제<\/th><th scope="col">단계<\/th><th scope="col">받으실 날<\/th><th scope="col">다음 행동<\/th><\/tr><\/thead>/);
  const trs=[...html.matchAll(/<tr class="[^"]*">(.*?)<\/tr>/g)].map(m=>m[1]);
  assert.equal(trs.length,2,'11월에 이력이 있는 확인 건 + 지금 기다리는 요청 건');
  for(const tr of trs)assert.deepEqual([...tr.matchAll(/<td data-label="([^"]+)"/g)].map(m=>m[1]),['이름','상품','금액','결제','단계','받으실 날','다음 행동']);
  const waiting=trs.find(tr=>tr.includes('data-id="p3"'));
  assert.match(waiting,/<span class="ledger-pay is-wait">결제 요청함<\/span><small>13일 지남<\/small>/);assert.match(waiting,/<span class="ledger-turn is-you">손님 차례<\/span>/);
  assert.match(waiting,/<button type="button" class="ledger-open" data-action="open-project" data-id="p3"><b>광고 3<\/b><small>P-1114-0003 · 손님 3<\/small><\/button>/);
  const paid=pulseLedger(ROWS,{month:'2026-10',now:NOW}),october=ledgerDesk({data:paid});
  assert.match(october,/<td data-label="금액" class="ledger-num">290,000원<small>실수령 250,000원<\/small><\/td>/);assert.match(october,/<small>직접<\/small>/);
  assert.match(october,/이 달에 결제 이력이 있는 건 · 1건/);assert.match(html,/이 달에 결제 이력이 있는 건과 지금 결제를 기다리는 건 · 2건/);
  assert.match(ledgerDesk({data:pulseLedger([],{now:NOW})}),/<p class="ledger-empty">이 달에는 결제 이력이 있는 건이 없어요\.<\/p>/);
  const refund=ledgerDesk({data:pulseLedger([project({title:'환불 건',payment:{status:'cancelled',confirmedAt:'2026-11-02T00:00:00.000Z',cancelledAt:'2026-11-06T00:00:00.000Z',amount:290000},log:[{kind:'confirmed',at:'2026-11-02T00:00:00.000Z',amount:290000},{kind:'cancelled',at:'2026-11-06T00:00:00.000Z',was:'confirmed'}]})],{now:NOW})});
  assert.match(refund,/<td data-label="금액" class="ledger-num">290,000원<\/td><td data-label="결제"><span class="ledger-pay is-refund">환불<\/span><\/td>/,'환불 건(화면 검수 F3)');
  // 불러오는 중: 장부가 오기 전엔 머리 · 숫자 없이 안내 한 줄.
  const loading=ledgerDesk({data:null},{top:'<div class="sx-alert">x</div>'});
  assert.match(loading,/<section class="staff-home staff-ledger" aria-label="운영판"><div class="sx-alert">x<\/div><div class="loading" role="status">/);assert.doesNotMatch(loading,/ledger-figures/);
  // 처음 불러오기가 실패하면 「불러오는 중」 대신 다시 불러오기(카본 A1), 다른 달을 읽는 동안은 앞 달을 흐리게 두고 aria-busy(카본 A2).
  const failed=ledgerDesk({data:null},{top:'<div class="sx-alert">x</div>',failed:true});
  assert.match(failed,/<div class="sx-alert">x<\/div><div class="ledger-retry"><button type="button" class="button" data-action="ledger">운영판 다시 불러오기<\/button><\/div><\/section>$/);assert.doesNotMatch(failed,/loading/);
  const busy=ledgerDesk({month:'2026-10',data:LEDGER});
  assert.match(busy,/^<section class="staff-home staff-ledger is-busy" aria-label="운영판" aria-busy="true"><p class="sr" role="status">2026년 10월을 불러오는 중이에요\.<\/p><header class="ledger-head">/);
  assert.doesNotMatch(ledgerDesk({month:'',data:LEDGER}),/is-busy|aria-busy/);assert.doesNotMatch(ledgerDesk({month:'2026-11',data:LEDGER}),/is-busy|aria-busy/);
  // 요청 당일은 「오늘 요청」(서버 날수는 지난 날수 — 카본 A4), 머리 안내는 해요체(A5).
  const fresh=ledgerDesk({data:pulseLedger([project({stage:'planning',payment:{status:'requested',requestedAt:'2026-11-14T01:00:00.000Z',amount:290000},log:[{kind:'requested',at:'2026-11-14T01:00:00.000Z',amount:290000}]})],{now:NOW})});
  assert.match(fresh,/가장 오래된 것 오늘 요청/);assert.match(fresh,/<span class="ledger-pay is-wait">결제 요청함<\/span><small>오늘 요청<\/small>/);assert.doesNotMatch(fresh,/0일/);
  assert.match(html,/<p class="ledger-note">볼 수 있는 프로젝트만 세어요 · 오늘 11월 14일 \(토\)<\/p>/);
});

test('직원 머리의 「운영판」 탭: 열면 aria-current가 운영판으로 옮고 제작 보드는 풀린다',()=>{
  const base={mode:'staff',user:{id:'u1',name:'담당자'},workspace:{projects:[],canWrite:true}};
  const tabs=html=>[...html.matchAll(/<button type="button" class="button quiet staff-tab" data-action="(\w+)" ([^>]*)>([^<]*)<\/button>/g)].map(m=>[m[1],m[2].includes('aria-current="page"'),m[3]]);
  assert.deepEqual(tabs(header(base)),[['projects',true,'제작 보드'],['ledger',false,'운영판'],['brands',false,'고객 브랜드']]);
  assert.deepEqual(tabs(header({...base,ledger:{month:'',data:null}})),[['projects',false,'제작 보드'],['ledger',true,'운영판'],['brands',false,'고객 브랜드']]);
  assert.equal(header({mode:'customer'}).includes('data-action="ledger"'),false,'손님 머리에는 없다');
});

test('결제 확인 창: 서버가 장부를 알면(ledger) 받은 곳 · 금액 · 실수령 칸, 요청한 금액이 있으면 그 금액으로 채운 칸(다르게 받았으면 고침) — 모르면 옛 창 그대로',()=>{
  const old=dialogContent('desk-pay-confirm',{dueDate:'2026-11-30'});
  assert.match(old,/<h2 id="dialog-title">크몽 결제를 확인했나요\?<\/h2>/);assert.doesNotMatch(old,/name="channel"|name="amount"|name="net"/);
  assert.match(old,/크몽 주문 번호 · 선택/);
  const requested=dialogContent('desk-pay-confirm',{ledger:true,requested:290000,dueDate:'2026-11-30'});
  assert.match(requested,/<span class="eyebrow ko">결제<\/span><h2 id="dialog-title">결제를 확인했나요\?<\/h2><p>크몽이나 계좌로 결제가 들어온 것을/);
  assert.match(requested,/<legend>받은 곳<\/legend><label class="desk-check"><input type="radio" name="channel" value="kmong" checked><span>크몽<\/span><\/label><label class="desk-check"><input type="radio" name="channel" value="direct"><span>직접\(계좌 등\)<\/span><\/label>/);
  assert.match(requested,/<label class="field">받은 금액\(원\) · 요청한 290,000원과 다르게 받았으면 고쳐 주세요<input name="amount" type="number" value="290000" maxlength="3000" placeholder="" required min="10000" max="100000000" step="1" inputmode="numeric">/,'요청 금액으로 채우고 고칠 수 있다(화면 검수 F6)');
  assert.match(requested,/name="net" type="number"/);
  const free=dialogContent('desk-pay-confirm',{ledger:true,requested:null,amount:390000});
  assert.match(free,/name="amount" type="number" value="390000"[^>]*min="10000" max="100000000" step="1" inputmode="numeric"/);assert.doesNotMatch(free,/요청한|required/,'요청 없이 확인하면 비워도 된다(금액 없음)');
  assert.match(free,/크몽 주문 번호 · 입금 메모 · 선택/);
  assert.match(dialogContent('desk-pay-confirm',{ledger:true,photo:true}),/<p>크몽이나 계좌로 결제가 들어온 것을 본 뒤 눌러 주세요\. 시안을/);
});

test('앱 연결: 운영판은 직원만 늦게 불러오고(목록 밖), 결제 확인은 장부 표시가 있을 때만 새 칸을 보낸다',()=>{
  const app=read('app.mjs'),sw=read('sw.js'),css=read('staff.css');
  assert.match(app,/if\(action==='ledger'&&s\.mode==='staff'\)\{const retry=!!button\.closest\('\.ledger-retry'\);withLeave\(async\(\)=>\{resetContext\(\);await openLedger\('',\{focus:retry\}\);\}\);return;\}/);
  // 키보드 초점(화면 검수 F5): 달을 바꾸면 읽는 중 · 읽은 뒤 모두 고른 달 막대로(없으면 머리 · 다시 불러오기).
  assert.match(app,/const focusLedger=\(month,step=false\)=>\{\(\(step&&main\.querySelector\(`\.ledger-step\[data-month="\$\{month\}"\]`\)\)\|\|main\.querySelector\(`\.ledger-bar \[data-month="\$\{month\}"\]`\)\|\|main\.querySelector\('\.ledger-month h1'\)\|\|main\.querySelector\('\.ledger-retry button'\)\)\?\.focus\(\{preventScroll:true\}\);\};/);
  assert.match(app,/s\.ledger=ask;s\.error='';render\(\);if\(focus\)focusLedger\(month\);/);assert.match(app,/if\(s\.ledger\)\{render\(\);if\(focus\)focusLedger\(month\);\}/);
  assert.match(app,/void openLedger\(button\.dataset\.month,\{focus:true\}\)/);
  // 켜 둔 운영판(화면 검수 F4): 실시간 갱신 · 화면 복귀에 보던 달을 다시 읽고, 바뀐 것만 그리며, 보는 사이 다른 달로 갔으면 버린다.
  assert.match(app,/render\(\{remote:true\}\);if\(s\.ledger\)void recheckLedger\(\{force:true\}\);\}/);assert.match(app,/document\.addEventListener\('visibilitychange',\(\)=>\{if\(!document\.hidden\)void recheckLedger\(\);\}\);/);
  assert.match(app,/if\(!data\|\|s\.ledger!==seen\|\|JSON\.stringify\(data\)===JSON\.stringify\(seen\.data\)\)return;\r?\n  if\(!canApplyRemote\(\)\)\{ledgerAt=0;return;\}\r?\n  const at=document\.activeElement,keep=at&&main\.querySelector\('\.staff-ledger'\)\?\.contains\(at\)\?at\.dataset\?\.month\?\?\(at\.matches\?\.\('\.ledger-month h1'\)\?'':null\):null;\r?\n  s\.ledger=\{month:data\.month,data\};render\(\{remote:true\}\);if\(keep!==null&&keep!==undefined\)focusLedger\(keep,!!at\.matches\?\.\('\.ledger-step'\)\);/,'조용히 다시 그려도 보던 달 단추(앞 · 다음 달 단추는 그 단추) · 머리에 초점(다시 검수 FB1 · FC1)');
  assert.doesNotMatch(css,/data-pay-requested/,'쓰지 않는 규칙은 남기지 않는다(FB2)');
  // 쉬기(화면 검수 F1): 운영판에서도 첫 화면으로 돌아가 쉬는 칸을 연다.
  assert.ok(app.includes('if(s.project||s.brands||s.ledger)withLeave(async()=>{resetContext();'));
  assert.match(app,/if\(action==='ledger-month'&&s\.ledger&&\/\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$\/\.test\(button\.dataset\.month\|\|''\)\)/);
  assert.match(app,/ledgerViewLoading\|\|=import\('\.\/ledger-view\.mjs'\)\.then\(module=>\{s\.ledgerView=module\.ledgerDesk;s\.ledgerPlace=module\.placeLedger;\},error=>\{ledgerViewLoading=null;throw error;\}\);/,'모듈을 못 받으면 다음에 다시 받는다(카본 A1)');
  assert.match(app,/:s\.error\?`<section class="staff-home staff-ledger" aria-label="운영판">\$\{ledgerAlert\(\)\}<div class="ledger-retry"><button type="button" class="button" data-action="ledger">운영판 다시 불러오기<\/button><\/div><\/section>`:/,'모듈 없이도 오류 · 다시 불러오기');
  assert.match(app,/if\(s\.ledger===ask\)\{s\.error=error\.message;if\(ask\.data\)s\.ledger=\{month:ask\.data\.month,data:ask\.data\};\}/,'다른 달이 실패하면 보던 달로 되돌린다(카본 A2)');
  assert.match(app,/mountScreens\(\);placeTimeline\(\);if\(s\.ledger\)s\.ledgerPlace\?\.\(main\);/,'그릴 때마다 막대 · 띠 자리를 넣는다');
  assert.match(app,/request\('\/api\/pulse\/ledger'\+\(month\?'\?month='\+encodeURIComponent\(month\):''\)\)/);
  assert.match(app,/if\(s\.ledger!==ask\)return;/,'늦게 온 앞 달 답은 버린다');
  assert.match(app,/\(s\.brands\?brandsView\(\):s\.ledger\?ledgerView\(\):picker\(s\)\)/);
  assert.match(app,/function resetContext\([^)]*\)\{[^\n]*s\.ledger=null;/);
  assert.match(app,/const ledger=!!s\.project\?\.studio\?\.request\?\.paymentLedger&&!!form\.querySelector\('\[name=channel\]'\)/);
  assert.match(app,/if\(ledger&&\(amount!==null&&!Number\.isSafeInteger\(amount\)\|\|net!==null&&!Number\.isSafeInteger\(net\)\)\)\{showMutationError\('금액은 원 단위 숫자로 적어 주세요\.'\);return;\}/,'소수 · 너무 큰 수는 보내기 전에 막는다');
  assert.match(app,/\.\.\.\(ledger\?\{channel:values\.channel==='direct'\?'direct':'kmong',\.\.\.\(amount!==null\?\{amount\}:\{\}\),\.\.\.\(net!==null\?\{net\}:\{\}\)\}:\{\}\)/);
  assert.equal(sw.includes("'ledger-view.mjs'"),false,'손님 오프라인 목록에 넣지 않는다');
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/'locale-menu\.mjs','ledger-view\.mjs','persona-view\.mjs'/,'정적 허용 목록에는 있다');
  // 운영판 CSS: 직원 화면 문법 — 둥근 모서리 없음, 빗금 1.2px/4px, 좁은 화면은 표가 카드.
  const block=css.slice(css.indexOf('/* ── 운영판'),css.indexOf('@media (prefers-reduced-motion:reduce){html.is-staff .staff-pic'));
  assert.ok(block.length>1000);assert.doesNotMatch(block,/border-radius|linear-gradient\(to|box-shadow/);
  assert.match(block,/repeating-linear-gradient\(135deg,var\(--st-berry\) 0 1\.2px,transparent 1\.2px 4px\)/);
  for(const rule of [/\.ledger-bar-fill\{[^}]*height:calc\(var\(--h,0\) \* 1%\)/,/\.ledger-ticks-in span\{[^}]*left:calc\(var\(--x,0\) \* 1%\)/,/\.ledger-span\{[^}]*left:calc\(var\(--l,0\) \* 1%\);width:calc\(var\(--w,0\) \* 1%\)/,/\.ledger-track::after\{[^}]*left:var\(--today,0%\)/,/@media \(max-width:820px\)\{[\s\S]*\.ledger-track::after\{top:-4px;bottom:-4px\}/,/\.ledger-bar-fill\[data-h="0"\]\{display:none\}/,/\.ledger-pay\.is-refund\{color:var\(--st-ink-56\)\}/,/@media \(max-width:820px\)\{[\s\S]*\.ledger-figure\.is-seats \.ledger-nowrap\{display:block\}[\s\S]*\.ledger-figure\.is-seats \.ledger-sep\{display:none\}/])assert.match(block,rule);
  assert.match(block,/@media \(max-width:820px\)\{[\s\S]*html\.is-staff \.ledger-table thead\{display:none\}[\s\S]*td::before\{content:attr\(data-label\)/);
});
