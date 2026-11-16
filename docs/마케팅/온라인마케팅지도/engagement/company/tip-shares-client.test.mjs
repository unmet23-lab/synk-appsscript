import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/tip-shares.js',import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=(over={})=>({row:52,postId:'AbC',sharedAt:'2026-11-16 10:12',url:'https://www.instagram.com/reel/AbC/',summary:'포인트 색 전후',kind:'디자인 참고',target:'홈페이지',verdict:'시안',note:'채운 단추 하나에만',status:'새로',stage:'시안 나옴',stageNote:'',draft:{url:'https://claude.ai/artifact/abc'},decidable:true,pending:null,decision:null,...over});
const data=(rows=[row()],over={})=>({ready:true,generatedAt:'2026-11-16T05:00:00.000Z',receivedAt:new Date().toISOString(),canDecide:true,waiting:rows.filter(r=>r.decidable&&!r.pending).length,rows,...over});

function fixture({api=async()=>data(),user={id:'u1',role:'admin'},tab='tips'}={}){
  const listeners={},calls=[],notices=[],timers=[];
  const root={innerHTML:'',dataset:{},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false};
  const context=vm.createContext({
    state:{user,tab},escape,icon:name=>`<svg data-icon="${name}"></svg>`,notify:m=>notices.push(m),isAdmin:()=>user?.role==='admin',isDemoMode:()=>false,
    api:async(...args)=>{calls.push(args);return api(...args);},
    queueMicrotask,requestAnimationFrame:fn=>setImmediate(fn),cancelAnimationFrame:()=>{},setTimeout,clearTimeout,setInterval:fn=>{timers.push(fn);return timers.length;},CSS:{escape:s=>s},Intl,URL,Date,
    window:{addEventListener(){}},
    document:{activeElement:null,visibilityState:'visible',fonts:{ready:Promise.resolve()},addEventListener(type,fn){(listeners[type]||=[]).push(fn);},querySelector:()=>null},
  });
  vm.runInContext(source,context);
  const click=attrs=>{const target={disabled:false,dataset:attrs,closest:()=>target};for(const fn of listeners.click||[])fn({target});};
  return {context,calls,notices,click,timers,run:code=>vm.runInContext(code,context),root};
}

test('only admins outside the demo get the page and its single read',async()=>{
  const member=fixture({user:{id:'m',role:'member'}});
  assert.equal(member.run('tipSharesPage()'),'');assert.equal(member.run('tipSharesBadge()'),'');
  await tick();assert.equal(member.calls.length,0);
  const f=fixture();
  const html=f.run('tipSharesPage()');
  assert.match(html,/<h1 id="tip-shares-title">공유한 게시물<\/h1>/);
  f.run('tipSharesPage()');await tick();await tick();
  assert.deepEqual(f.calls.map(c=>c[0]),['/api/tip-shares'],'repeated renders do not repeat the read');
});

test('a decidable draft becomes a card with the two buttons and links that open safely',async()=>{
  const f=fixture();await f.run('tipSharesLoad()');
  const body=f.run('tipSharesBody()');
  assert.match(body,/<h2 id="ts-pick-title">고르실 시안<\/h2><span class="ts-section-count"><span aria-hidden="true">1<\/span><span class="ts-sr">아직 고르지 않은 시안 1개<\/span><\/span>/);
  assert.equal(body.includes('aria-label="아직'),false,'counts carry their meaning as hidden text, not aria-label on a span');
  assert.match(body,/data-tip-action="decide" data-tip-to="적용 중" data-tip-row="52"[^>]*>적용해</);
  assert.match(body,/data-tip-action="decide" data-tip-to="버림" data-tip-row="52"[^>]*>버림</);
  assert.match(body,/<a class="ts-link ts-draft-link" href="https:\/\/claude.ai\/artifact\/abc" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">시안 보기/);
  assert.match(f.run('tipSharesBadge()'),/<b class="nav-badge"><span aria-hidden="true">1<\/span><span class="ts-sr">고르실 시안 1개<\/span><\/b>/);
});

test('text is escaped, and links that are not http(s) are never drawn',async()=>{
  const evil=row({summary:'<img src=x onerror=alert(1)>',note:'"><script>x</script>',target:'<b>',url:'javascript:alert(1)',draft:{url:'javascript:alert(2)'}});
  const f=fixture({api:async()=>data([evil])});await f.run('tipSharesLoad()');
  const body=f.run('tipSharesBody()');
  assert.equal(body.includes('<img src=x'),false);assert.equal(body.includes('<script>'),false);assert.equal(body.includes('<b>'),false);
  assert.equal(body.includes('javascript:'),false);
  assert.match(body,/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('pressing 적용해 posts the row and post id, then shows the undo until the PC claims it',async()=>{
  let current=data();
  const f=fixture({api:async(path,body)=>{
    if(path==='/api/tip-shares/decision'){current=data([row({decidable:true,pending:{to:body.to,requestedAt:'2026-11-16T05:01:00.000Z',claimed:false}})],{waiting:0});return current;}
    if(path==='/api/tip-shares/decision/cancel'){current=data();return current;}
    return current;
  }});
  await f.run('tipSharesLoad()');
  f.click({tipAction:'decide',tipTo:'적용 중',tipRow:'52'});await tick();await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))),['/api/tip-shares/decision',{row:52,postId:'AbC',to:'적용 중'}]);
  let body=f.run('tipSharesBody()');
  assert.match(body,/<b>적용하기로<\/b> 정했어요\. 곧 장부에 옮겨요\./);
  // 목록 줄은 「고르실 차례」 대신 고른 것을 보인다.
  assert.match(body,/<span class="ts-row-pending">적용하기로 정했어요<\/span><span class="ts-row-when">곧 장부에 옮겨요<\/span>/);
  assert.equal(body.includes('고르실 차례'),false);
  assert.match(body,/data-tip-action="undo"/);
  assert.equal(f.run('tipShares.focus'),'undo:52','after 적용해 the focus goes to 되돌리기 on the next paint');
  f.click({tipAction:'undo',tipRow:'52'});await tick();await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))),['/api/tip-shares/decision/cancel',{row:52,postId:'AbC'}]);
  body=f.run('tipSharesBody()');assert.match(body,/>적용해</);
});

test('a claimed request has no undo, and the automation account sees no buttons',async()=>{
  const claimed=fixture({api:async()=>data([row({pending:{to:'버림',requestedAt:'2026-11-16T05:01:00.000Z',claimed:true}})])});
  await claimed.run('tipSharesLoad()');
  const body=claimed.run('tipSharesBody()');
  assert.match(body,/<b>버리기로<\/b> 정했어요\. 장부에 옮기는 중이에요\./);assert.equal(body.includes('data-tip-action="undo"'),false);
  const robot=fixture({api:async()=>data([row()],{canDecide:false})});await robot.run('tipSharesLoad()');
  const robotBody=robot.run('tipSharesBody()');
  assert.equal(robotBody.includes('data-tip-action="decide"'),false);assert.match(robotBody,/자동화 계정이라 고를 수 없어요/);
});

test('a 409 reloads the list and tells why, without keeping the row busy',async()=>{
  let first=true;
  const f=fixture({api:async path=>{if(path==='/api/tip-shares/decision'){const e=new Error('장부가 바뀌었어요. 새로 고침한 뒤 다시 골라 주세요.');e.status=409;throw e;}if(first){first=false;return data();}return data([row({status:'버림',stage:'버림',decidable:false})]);}});
  await f.run('tipSharesLoad()');
  f.click({tipAction:'decide',tipTo:'버림',tipRow:'52'});for(let i=0;i<6;i++)await tick();
  assert.deepEqual(f.notices,['장부가 바뀌었어요. 새로 고침한 뒤 다시 골라 주세요.']);
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,2);
  assert.equal(f.run('tipShares.busy.size'),0);
  assert.equal(f.run('tipSharesBody()').includes('ts-pick-title'),false);
});

test('the list shows verdict, stage, the 보류 reason, the 기각 reason and the decision date in Korea time',async()=>{
  const rows=[
    row({row:60,verdict:'기각',stage:'기각',draft:null,decidable:false,note:'우리와 맞지 않음'}),
    row({row:59,stage:'보류',stageNote:'유호님 차례: 채널 이름 정하기',decidable:false}),
    row({row:58,status:'적용 중',stage:'적용 중',decidable:false,decision:{to:'적용 중',requestedAt:'2026-11-15T18:30:00.000Z',outcome:'applied'}}),
    row({row:57,verdict:'',stage:'판단 전',draft:null,decidable:false,note:''}),
  ];
  const f=fixture({api:async()=>data(rows)});await f.run('tipSharesLoad()');
  const body=f.run('tipSharesBody()');
  assert.match(body,/<span>사유<\/span> 우리와 맞지 않음/);
  assert.match(body,/<span>멈춘 까닭<\/span> 유호님 차례: 채널 이름 정하기/);
  // 보류 까닭이 비어 있는 줄은 가져올 것을 「멈춘 까닭」으로 보이지 않는다.
  const bare=fixture({api:async()=>data([row({row:61,stage:'보류',stageNote:'',note:'채운 단추 하나에만',decidable:false})])});await bare.run('tipSharesLoad()');
  const bareBody=bare.run('tipSharesBody()');
  assert.match(bareBody,/<span>가져올 것<\/span> 채운 단추 하나에만/);assert.equal(bareBody.includes('멈춘 까닭'),false);
  assert.match(body,/11월 16일에 적용하기로 정했어요/,'18:30 UTC on the 15th is the 16th in Korea');
  assert.match(body,/<span class="ts-verdict is-wait">판단 중<\/span>/);
  assert.match(body,/data-tip-filter="기각"[^>]*>기각<span class="ts-filter-count">1<\/span>/);
  const noId=fixture({api:async()=>data([row({postId:'',decidable:false})])});await noId.run('tipSharesLoad()');
  const noIdBody=noId.run('tipSharesBody()');
  assert.match(noIdBody,/게시물 번호가 없어 여기서는 고를 수 없어요/);assert.equal(noIdBody.includes('data-tip-action="decide"'),false);
  // 아직 판단 전인 줄이 있으면 「판단 중」 걸러 보기가 생겨 판단별 수를 더하면 전체와 같다.
  assert.match(body,/data-tip-filter="판단 중"[^>]*>판단 중<span class="ts-filter-count">1<\/span>/);
  f.click({tipAction:'filter',tipFilter:'기각'});
  const filtered=f.run('tipSharesBody()');
  assert.equal((filtered.match(/<li class="ts-row/g)||[]).length,1);
  f.click({tipAction:'filter',tipFilter:'판단 중'});
  assert.match(f.run('tipSharesBody()'),/<li class="ts-row is-wait/);
  const quiet=fixture({api:async()=>data([row()])});await quiet.run('tipSharesLoad()');
  assert.equal(quiet.run('tipSharesBody()').includes('data-tip-filter="판단 중"'),false,'no 판단 중 filter when every row is judged');
});

test('a draft written as a place shows in full on the card and in the list, and rows show 시안 보기',async()=>{
  const place='docs/마케팅/PULSE_유호감독_고양이누아르_20261115 · 남은 일: S2 다시 굽기';
  const f=fixture({api:async()=>data([row({draft:{text:place}}),row({row:51})])});await f.run('tipSharesLoad()');
  const body=f.run('tipSharesBody()');
  assert.equal((body.match(/<span>시안이 있는 곳<\/span> docs\/마케팅/g)||[]).length,2,'once on the card, once in the list');
  assert.match(body,/<p class="ts-row-note ts-row-place"><span>시안이 있는 곳<\/span> docs\/마케팅/);
  assert.match(body,/열어 볼 링크가 없는 시안이에요\. 아래 적힌 곳에서 확인해 주세요\./);
  assert.match(body,/<a class="ts-link " href="https:\/\/claude.ai\/artifact\/abc"[^>]*>시안 보기/);
  assert.match(body,/<span class="ts-stage is-pick">고르실 차례<\/span>/);
  const later=fixture({api:async()=>data([row({stage:'시안 차례',draft:null,decidable:false})])});await later.run('tipSharesLoad()');
  assert.match(later.run('tipSharesBody()'),/<span class="ts-stage ">시안 만들 예정<\/span>/);
});

test('a decision that lands during a background read still ends the loading state',async()=>{
  let release;const slow=new Promise(resolve=>{release=resolve;});
  const f=fixture({api:async path=>{if(path==='/api/tip-shares/decision')return data([row({pending:{to:'적용 중',requestedAt:'2026-11-16T05:01:00.000Z',claimed:false}})],{waiting:0});if(f&&f.slowNext){f.slowNext=false;await slow;}return data();}});
  await f.run('tipSharesLoad()');
  f.slowNext=true;const background=f.run('tipSharesLoad({quiet:true})');await tick();
  assert.equal(f.run('tipShares.loading'),true);
  f.click({tipAction:'decide',tipTo:'적용 중',tipRow:'52'});for(let i=0;i<4;i++)await tick();
  assert.equal(f.run('tipShares.loading'),false,'the answer to the click replaces the read and clears loading');
  release();await background;
  assert.equal(f.run('tipShares.loading'),false);assert.equal(f.run('tipShares.data.rows[0].pending.to'),'적용 중','the late read does not undo the decision');
});

test('cards fold long text behind 자세히 of their own, and a conflict shows whatever the stage',async()=>{
  const f=fixture({api:async()=>data([row(),row({row:60,status:'버림',stage:'버림',decidable:false,decision:{to:'적용 중',requestedAt:'2026-11-15T18:30:00.000Z',outcome:'conflict'}})])});
  await f.run('tipSharesLoad()');
  let body=f.run('tipSharesBody()');
  assert.match(body,/data-tip-action="toggle-card" data-tip-row="52" data-tip-key="card:52" aria-expanded="false" hidden>자세히/);
  f.click({tipAction:'toggle-card',tipRow:'52'});
  body=f.run('tipSharesBody()');
  assert.match(body,/<article class="ts-card is-open"/);assert.match(body,/data-tip-key="card:52" aria-expanded="true" >접기/);
  assert.equal(body.includes('class="ts-row is-draft is-open"'),false,'opening the card does not open the list row');
  // 장부가 먼저 「버림」이 되어 「적용해」가 옮겨지지 않았으면, 지난 선택 대신 어긋남을 알린다.
  assert.match(body,/장부가 먼저 바뀌어 옮기지 않았어요/);
  assert.equal(body.includes('적용하기로 정했어요</span>'),false);
});

test('the open page and the drawer count read again when they get old',async()=>{
  const f=fixture();await f.run('tipSharesLoad()');
  assert.equal(f.timers.length,1,'one timer for the open page');
  f.run('tipShares.loadedAt=tipShares.triedAt=Date.now()-61000');f.timers[0]();await tick();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,2,'the open page reads again after a minute');
  f.run("state.tab='home'");f.run('tipShares.loadedAt=tipShares.triedAt=Date.now()-61000');f.timers[0]();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,2,'not while another screen is open');
  f.run('tipSharesBadge()');await tick();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,2,'a one-minute-old count is still fine for the drawer');
  f.run('tipShares.loadedAt=tipShares.triedAt=Date.now()-130000');f.run('tipSharesBadge()');await tick();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,3,'an old drawer count reads again');
});

test('a conflict that ended the chosen way shows the choice, and old conflicts fade',async()=>{
  const old=new Date(Date.now()-4*24*3600000).toISOString(),recent=new Date(Date.now()-3600000).toISOString();
  const rows=[
    row({row:70,status:'적용함',stage:'적용함',decidable:false,decision:{to:'적용 중',requestedAt:recent,outcome:'conflict'}}),
    row({row:71,status:'버림',stage:'버림',decidable:false,decision:{to:'적용 중',requestedAt:old,outcome:'conflict'}}),
    row({row:72,status:'버림',stage:'버림',decidable:false,decision:{to:'적용 중',requestedAt:recent,outcome:'conflict'}}),
    row({row:73,status:'적용함',stage:'적용함',decidable:false,decision:{to:'버림',requestedAt:recent,outcome:'applied'}}),
  ];
  const f=fixture({api:async()=>data(rows)});await f.run('tipSharesLoad()');
  const items=f.run('tipSharesBody()').split('<li ').slice(1);
  assert.match(items[0],/적용하기로 정했어요/);assert.equal(items[0].includes('장부가 먼저 바뀌어'),false);
  assert.equal(items[1].includes('장부가 먼저 바뀌어'),false,'a conflict older than three days is no longer shown');
  assert.match(items[2],/장부가 먼저 바뀌어 옮기지 않았어요/);
  assert.equal(items[3].includes('버리기로 정했어요'),false,'a choice the ledger later reversed by hand is not shown next to the new stage');
});

test('a failing quiet read is marked, keeps the minute between tries and does not blame the PC',async()=>{
  let fail=false;
  const f=fixture({api:async()=>{if(fail)throw new Error('서버 오류');return data([row()],{receivedAt:new Date(Date.now()-40*60000).toISOString()});}});
  await f.run('tipSharesLoad()');
  fail=true;f.run('tipShares.loadedAt=tipShares.triedAt=Date.now()-61000');f.timers[0]();await tick();await tick();
  assert.equal(f.run('tipShares.readFailed'),true);
  assert.match(f.run('tipSharesFresh()'),/다시 읽지 못했어요/);
  const body=f.run('tipSharesBody()');
  assert.match(body,/화면이 장부를 다시 읽지 못하고 있어요/);assert.equal(body.includes('PC가 꺼져 있는 것 같아요'),false);
  const reads=f.calls.filter(c=>c[0]==='/api/tip-shares').length;
  f.timers[0]();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,reads,'a failed try still waits a minute before the next');
  // 장부를 아직 한 번도 받지 못했어도 다시 읽지 못한 것은 보인다.
  let first=true;
  const empty=fixture({api:async()=>{if(first){first=false;return {ready:false,generatedAt:null,receivedAt:null,canDecide:false,waiting:0,rows:[]};}throw new Error('서버 오류');}});
  await empty.run('tipSharesLoad()');await empty.run('tipSharesLoad({quiet:true})');
  assert.match(empty.run('tipSharesFresh()'),/다시 읽지 못했어요/);
});

test('a failed first drawer read is not an error: the drawer tries again later and the page still loads on its own',async()=>{
  let n=0;
  const failOnce=async()=>{n++;if(n===1)throw new Error('서버 오류');return data();};
  const f=fixture({api:failOnce,tab:'home'});
  f.run('tipSharesBadge()');await tick();await tick();
  assert.equal(f.run('tipShares.error'),'','a quiet read from the drawer does not leave an error behind');
  assert.equal(f.run('tipShares.readFailed'),true);
  assert.equal(f.run('tipSharesFresh()'),'','nothing was ever received, so the head does not say it could not read again');
  f.run('tipSharesBadge()');await tick();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,1,'the drawer waits before the next try');
  f.run('tipShares.triedAt=Date.now()-130000');f.run('tipSharesBadge()');await tick();await tick();
  assert.equal(f.calls.filter(c=>c[0]==='/api/tip-shares').length,2,'the drawer tries again later');
  assert.match(f.run('tipSharesBadge()'),/nav-badge/);
  n=0;
  const g=fixture({api:failOnce,tab:'home'});
  g.run('tipSharesBadge()');await tick();await tick();
  g.run("state.tab='tips'");g.run('tipSharesPage()');await tick();await tick();
  assert.equal(g.calls.filter(c=>c[0]==='/api/tip-shares').length,2,'opening the page reads again instead of showing the drawer failure');
  assert.equal(g.run('tipSharesBody()').includes('role="alert"'),false);
  // 받은 것이 없는 채로 이 화면에서 조용한 읽기가 실패하면 다시 불러오기 단추를 보인다.
  const h=fixture({api:async()=>{throw new Error('서버 오류');}});
  await h.run('tipSharesLoad({quiet:true})');
  assert.match(h.run('tipSharesBody()'),/role="alert"><p>서버 오류<\/p><button[^>]*data-tip-action="refresh"/);
});

test('no snapshot yet, a stale snapshot and a failed read each say so',async()=>{
  const empty=fixture({api:async()=>({ready:false,generatedAt:null,receivedAt:null,canDecide:false,waiting:0,rows:[]})});await empty.run('tipSharesLoad()');
  assert.match(empty.run('tipSharesBody()'),/아직 장부를 받지 못했어요/);
  const stale=fixture({api:async()=>data([row()],{receivedAt:new Date(Date.now()-3*3600000).toISOString()})});await stale.run('tipSharesLoad()');
  assert.match(stale.run('tipSharesBody()'),/PC가 꺼져 있는 것 같아요/);assert.match(stale.run('tipSharesFresh()'),/3시간 전에 받은 장부예요/);
  const broken=fixture({api:async()=>{throw new Error('관리자만 볼 수 있어요.');}});await broken.run('tipSharesLoad()');
  assert.match(broken.run('tipSharesBody()'),/role="alert"><p>관리자만 볼 수 있어요\.<\/p>/);
});

test('switching accounts drops the previous account data',async()=>{
  const f=fixture();await f.run('tipSharesLoad()');
  f.run("state.user={id:'u2',role:'admin'}");f.run('tipSharesIdentity()');
  assert.equal(f.run('tipShares.data'),null);
});
