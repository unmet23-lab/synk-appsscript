// PULSE 접수 멈춤 스위치(2026-11-11 운영 조각 3) — 화면 쪽 약속. 서버는 pulse-capacity-server.test.mjs가 본다.
// 열려 있으면 첫 화면에 아무것도 더하지 않고, 쉬는 중이고 쓰던 의뢰서가 없을 때만 「광고 의뢰하기」 자리에 안내가 선다(한국어 · 영어).
// 직원 첫 화면의 스위치는 서버가 이 설정을 알 때만, 바꾸는 단추는 관리자에게만 보인다. 실제 그림(1440 · 390 넘침)은 브라우저 확인이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {entryView,applyEntryIntake}=await import('./public/pulse-app/film-home.mjs');
const {picker,header,welcome}=await import('./public/pulse-app/views.mjs');
const {setLocale}=await import('./public/pulse-app/i18n.mjs');
const {publicBackend,resumableDraft}=await import('./public/pulse-app/request-backend.mjs');
const {emptyRequestAnswers}=await import('./pulse-requests.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const PAUSED={state:'paused',until:'',note:'11월 셋째 주까지 제작 일정이 찼어요.',noteEn:'We are fully booked until late November.'};
const HEAD='지금은 잠시 접수를 쉬어요';
// 꼬리표 하나(여는 꼬리표부터 닫는 꼬리표까지)를 떼어 본다 — 안내 칸과 단추.
const slots=html=>[...html.matchAll(/<div class="sx-paused" data-paused( data-paused-works)? data-in tabindex="-1" data-key="[^"]*"( hidden)?>(.*?)<\/div>/gs)].map(m=>({works:!!m[1],hidden:!!m[2],inner:m[3]}));
const starts=html=>[...html.matchAll(/<button type="button" class="sx-go is-solid[^"]*" data-entry="start" data-in( hidden)?>/g)].map(m=>!!m[1]);
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');

test('열려 있으면 첫 화면에 아무것도 더하지 않는다 — 안내 칸은 비어 숨고 단추는 그대로다',()=>{
  for(const html of [entryView({}),entryView({paused:null}),welcome({entryError:null,requestResume:false,intake:{state:'open'}}),welcome({})]){
    assert.deepEqual(slots(html),[{works:true,hidden:true,inner:''},{works:false,hidden:true,inner:''}]);
    assert.deepEqual(starts(html),[false,false]);
    assert.equal(html.includes(HEAD),false);
    assert.match(html,/<p class="sx-small" data-start-note data-in>/,'끝 쪽의 한 줄 안내도 그대로');
    // 화면 읽기 알림 칸은 늘 하나, 비어 있다. 숨었다 나타나는 안내 칸에는 aria-live를 걸지 않는다(첫 알림이 빠지거나 두 번 읽힌다).
    assert.equal(html.split('data-paused-say').length-1,1);assert.match(html,/<p class="sr" role="status" data-paused-say><\/p>/);assert.doesNotMatch(html,/data-paused[^>]*aria-live/);
  }
});

test('쉬는 중이면 「광고 의뢰하기」 두 자리에 안내가 서고 단추는 숨는다 — 다시 여는 날 · 담당자 안내 · 작품 보기',()=>{
  const html=entryView({paused:{...PAUSED,until:'2026-11-20'}}),found=slots(html);
  assert.deepEqual(starts(html),[true,true],'쉬는 동안 시작 단추는 둘 다 숨는다');
  assert.equal(found.length,2);assert.equal(found.every(slot=>!slot.hidden),true);
  for(const slot of found){
    assert.match(slot.inner,/<p class="sx-paused-head">지금은 잠시 접수를 쉬어요<\/p>/);
    assert.match(text(slot.inner),/11월 20일 \(금\)부터 다시 받아요\./,'다시 여는 날을 읽는 말로');
    assert.match(text(slot.inner),/11월 셋째 주까지 제작 일정이 찼어요\./);
    assert.equal(slot.inner.includes(PAUSED.noteEn),false,'한국어 화면에 영어 안내를 겹쳐 내지 않는다');
  }
  assert.match(found[0].inner,/data-entry="works"/,'1쪽 안내에는 완성 광고로 가는 줄이 있다');
  assert.doesNotMatch(found[1].inner,/data-entry="works"/);
  assert.match(html,/<p class="sx-small" data-start-note data-in hidden>/,'시작을 권하는 한 줄은 쉬는 동안 숨는다');
  assert.match(html,/data-watch-now/,'완성 광고 보기(쇼릴 · 작품 쪽)는 그대로다');assert.equal(html.split('data-work="').length-1,4);
  // 다시 여는 날이 없으면 그 자리에서 다시 시작할 수 있다는 말을, 담당자 안내가 없으면 그 줄을 두지 않는다.
  const bare=slots(entryView({paused:{state:'paused',until:'',note:'',noteEn:''}}))[1].inner;
  assert.match(bare,/다시 열리면 이 화면에서 바로 시작하실 수 있어요\./);assert.doesNotMatch(bare,/sx-paused-note/);
  // welcome은 앱이 읽어 둔 접수 상태를 그대로 넘긴다.
  assert.equal(slots(welcome({intake:PAUSED})).every(slot=>!slot.hidden),true);
});

test('쓰던 의뢰서가 있으면 쉬는 중이어도 이어 쓰기 단추가 선다(보내기는 쉬는 동안에도 된다)',()=>{
  const html=entryView({paused:PAUSED,resume:true});
  assert.deepEqual(starts(html),[false,false]);assert.equal(slots(html).every(slot=>slot.hidden&&!slot.inner),true);
  assert.equal(html.includes(HEAD),false);assert.match(html,/쓰던 의뢰서 이어 쓰기/);
  assert.equal(slots(welcome({intake:PAUSED,requestResume:true})).every(slot=>slot.hidden),true);
});

test('담당자가 적은 글은 글자 그대로만 그린다(꼬리표로 읽히지 않는다)',()=>{
  const inner=slots(entryView({paused:{state:'paused',until:'<b>x</b>',note:'<img src=x onerror=alert(1)>&"\'',noteEn:''}}))[0].inner;
  assert.equal(inner.includes('<img'),false);assert.equal(inner.includes('<b>'),false);
  assert.match(inner,/&lt;img src=x onerror=alert\(1\)&gt;&amp;&quot;&#39;/);
});

test('영어 화면: 고정 문장은 영어로, 담당자 글은 영어로 적은 것만 보인다',async()=>{
  await setLocale('en');
  try{
    const found=slots(entryView({paused:{...PAUSED,until:'2026-11-20'}}));
    for(const slot of found){
      assert.match(slot.inner,/We’ve paused new briefs for now/);assert.match(text(slot.inner),/We’ll be taking new briefs again starting \w{3}, Nov 20\./);
      assert.match(slot.inner,/We are fully booked until late November\./);
      assert.doesNotMatch(slot.inner,/[가-힣]/,'영어 화면의 안내에 한글이 없다');
    }
    assert.match(found[0].inner,/See finished ads/);
    const koOnly=slots(entryView({paused:{...PAUSED,noteEn:''}}))[0].inner;
    assert.doesNotMatch(koOnly,/[가-힣]/,'영어 안내를 안 적었으면 한국어 글을 대신 내지 않는다');assert.doesNotMatch(koOnly,/sx-paused-note/);
    assert.match(koOnly,/Once we resume, you can start right here\./);
  }finally{await setLocale('ko');}
});

test('이미 그려진 첫 화면: 접수 상태가 뒤늦게 와도 단추 · 안내가 바뀌고, 같은 안내는 다시 그리지 않는다',()=>{
  const node=(attrs=[])=>{let html='',writes=0,focused=0;return {hidden:false,textContent:'',hasAttribute:name=>attrs.includes(name),contains:()=>false,focus(){focused++;},get focused(){return focused;},get innerHTML(){return html;},set innerHTML(value){html=value;writes++;},get writes(){return writes;}};};
  const nodes={starts:[node(),node()],notes:[node()],slots:[node(['data-paused-works']),node()],say:node()},state={resume:false,paused:null,key:null};
  nodes.slots.forEach(slot=>{slot.hidden=true;});
  applyEntryIntake(nodes,state);
  assert.deepEqual(nodes.starts.map(n=>n.hidden),[false,false]);assert.deepEqual(nodes.slots.map(n=>n.hidden),[true,true]);
  state.paused=PAUSED;applyEntryIntake(nodes,state);
  assert.deepEqual(nodes.starts.map(n=>n.hidden),[true,true]);assert.equal(nodes.notes[0].hidden,true);assert.deepEqual(nodes.slots.map(n=>n.hidden),[false,false]);
  assert.match(nodes.slots[0].innerHTML,/data-entry="works"/);assert.doesNotMatch(nodes.slots[1].innerHTML,/data-entry="works"/);assert.match(nodes.slots[1].innerHTML,/지금은 잠시 접수를 쉬어요/);
  assert.equal(nodes.say.textContent,'지금은 잠시 접수를 쉬어요. 다시 열리면 이 화면에서 바로 시작하실 수 있어요.','화면 읽기에는 늘 있는 칸 하나가 한 번 알린다');
  const writes=nodes.slots.map(n=>n.writes);
  applyEntryIntake(nodes,state);applyEntryIntake(nodes,state);
  assert.deepEqual(nodes.slots.map(n=>n.writes),writes,'화면을 다시 그릴 때마다 안내를 새로 쓰지 않는다(초점 · 읽어 주기를 지킨다)');
  // 안내가 바뀌면 새로 쓴다.
  state.paused={...PAUSED,note:'바뀐 안내'};applyEntryIntake(nodes,state);assert.match(nodes.slots[1].innerHTML,/바뀐 안내/);
  // 쓰던 의뢰서를 찾으면 단추로 돌아온다.
  state.resume=true;applyEntryIntake(nodes,state);
  assert.deepEqual(nodes.starts.map(n=>n.hidden),[false,false]);assert.equal(nodes.notes[0].hidden,false);assert.deepEqual(nodes.slots.map(n=>[n.hidden,n.innerHTML]),[[true,''],[true,'']]);
  assert.equal(nodes.say.textContent,'','안내가 사라지면 알림 칸도 비운다');
  // 다시 열리면 안내가 사라진다.
  state.resume=false;state.paused=null;applyEntryIntake(nodes,state);
  assert.deepEqual(nodes.starts.map(n=>n.hidden),[false,false]);assert.deepEqual(nodes.slots.map(n=>n.hidden),[true,true]);
  // 초점: 사라지는 단추에 초점이 있었으면 같은 자리의 안내로, 사라지는 안내(그 안의 작품 줄)에 있었으면 그 자리의 단추로 옮긴다.
  const had=globalThis.document;
  try{
    globalThis.document={activeElement:nodes.starts[1]};
    state.paused=PAUSED;applyEntryIntake(nodes,state);
    assert.deepEqual([nodes.slots[0].focused,nodes.slots[1].focused],[0,1],'끝 쪽 단추에 있던 초점은 끝 쪽 안내로');
    const inside={};nodes.slots[0].contains=target=>target===inside;globalThis.document={activeElement:inside};
    state.paused=null;applyEntryIntake(nodes,state);
    assert.deepEqual([nodes.starts[0].focused,nodes.starts[1].focused],[1,0],'1쪽 안내 안에 있던 초점은 1쪽 단추로');
    // 초점이 다른 곳에 있으면 건드리지 않는다.
    globalThis.document={activeElement:{}};state.paused=PAUSED;applyEntryIntake(nodes,state);
    assert.deepEqual([nodes.slots[0].focused,nodes.slots[1].focused],[0,1]);
  }finally{if(had===undefined)delete globalThis.document;else globalThis.document=had;}
});

test('처음부터 쉬는 채로 그려진 화면은 그린 안내의 열쇠를 적어 두고, 앱은 거기서 시작한다',()=>{
  const home=read('film-home.mjs');
  assert.match(home,/const intake=\{resume:false,paused:null,key:\$\('\[data-paused\]'\)\?\.dataset\.key\?\?null\};/);
  const keyOf=html=>html.match(/data-paused data-paused-works data-in tabindex="-1" data-key="([^"]*)"/)[1];
  assert.equal(keyOf(entryView({})),'');assert.equal(keyOf(entryView({paused:PAUSED,resume:true})),'');
  const key=keyOf(entryView({paused:PAUSED})).replaceAll('&quot;','"');
  assert.deepEqual(JSON.parse(key),['',PAUSED.note,PAUSED.noteEn,'ko']);
  // 같은 열쇠로 시작한 화면에 같은 안내가 오면 다시 쓰지 않는다.
  const slot={hidden:false,writes:0,hasAttribute:()=>false,set innerHTML(value){this.writes++;}},state={resume:false,paused:PAUSED,key};
  applyEntryIntake({starts:[],notes:[],slots:[slot]},state);assert.equal(slot.writes,0);
});

test('「쓰던 의뢰서」는 무엇이라도 적힌 초안이다 — 첫 화면의 이어 쓰기와 쉬는 동안 의뢰서를 여는 판정이 같은 식을 쓴다',async()=>{
  const draft=(extra={})=>({id:'d1',status:'draft',step:'',answers:emptyRequestAnswers(),files:[],csrf:'c',number:'',...extra});
  const cases=[[null,false,false],[draft(),false,false],[draft({step:'brand'}),true,true],[draft({answers:{...emptyRequestAnswers(),name:'합성 탄산수'}}),true,true],[draft({files:[{id:'f1',slot:'front',fileName:'a.png',mimeType:'image/png',byteSize:1,inline:true}]}),true,true],
    // 보낸 직후 응답을 못 받은 초안(10분 재전송) · 보내는 중인 초안은 이어 쓰기 단추는 아니지만 쉬는 동안에도 그대로 잇는다.
    [draft({status:'submitted',number:'P-1111-01'}),false,true],[draft({status:'sending'}),false,true]];
  const had=globalThis.fetch;
  try{
    for(const [value,resume,opens] of cases){
      globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({draft:value,features:null})});
      assert.equal(resumableDraft(value),resume,JSON.stringify(value?.status)+' 이어 쓰기');
      assert.equal((await publicBackend()).hasDraft,opens,JSON.stringify([value?.status,value?.step])+' 쉬는 동안 열기');
    }
  }finally{globalThis.fetch=had;}
  const app=read('app.mjs');
  assert.match(app,/resume=resumableDraft\(draft\);/,'첫 화면도 같은 식으로 본다');
});

test('앱: 접수 상태는 공개 주소에서 읽고, 쉬는 중에 쓰던 초안이 없으면 의뢰서를 열지 않는다',()=>{
  const app=read('app.mjs'),backend=read('request-backend.mjs'),css=read('film.css'),api=read('api.mjs');
  assert.match(app,/networkRequest\('\/pulse\/api\/availability'\)/);
  assert.match(app,/Promise\.all\(\[networkRequest\('\/pulse\/api\/request'\),readIntake\(\)\]\)/,'이어 쓰기와 접수 상태를 함께 받아 한 번에 그린다(안내가 떴다가 단추로 바뀌지 않게)');
  assert.match(app,/\(\)=>\{if\(intakeRead===read\)intakeRead=null;return null;\}/,'못 읽으면 열린 것으로 두고 다음에 다시 읽는다 — 막는 것은 서버다');
  assert.match(app,/function openPublicRequest\(settings\)\{return openFlow\(\(\)=>openBackend\(settings\),/);
  assert.match(app,/readIntake\(\{fresh:true\}\)/,'의뢰서를 열 때는 새로 묻는다(오래 열어 둔 화면)');
  assert.match(app,/if\(intake\?\.state==='paused'&&!backend\.hasDraft\)\{.*?throw new PulseError\(t\('지금은 잠시 접수를 쉬어요\. 다시 열리면 이 화면에서 바로 시작하실 수 있어요\.'\),409,'SYNK_PULSE_INTAKE_PAUSED'\);\}/);
  assert.match(backend,/hasDraft:!!draft&&\(draft\.status!=='draft'\|\|resumableDraft\(draft\)\),/);
  // 바로 의뢰 주소(?start=request&lang=en)는 화면 언어가 정해지기 전에 여기까지 온다 — 알림도 그 응답의 허락 언어로 말한다.
  assert.match(app,/if\(intake\?\.state==='paused'&&!backend\.hasDraft\)\{if\(backend\.features\)await applyLocale\(backend\.features\);/);
  assert.match(app,/entryHandle\.update\(\{resume:!!s\.requestResume,paused:s\.intake\?\.state==='paused'\?s\.intake:null,/);
  assert.match(api,/SYNK_PULSE_INTAKE_PAUSED:k\('지금은 잠시 접수를 쉬어요\. 다시 열리면 이 화면에서 바로 시작하실 수 있어요\.'\)/);
  // .sx-go의 display가 hidden 속성을 이기므로(같은 무게 · 뒤에 적힘) 숨김을 따로 적어야 단추가 사라진다.
  assert.ok(css.includes('.sx-home [data-entry="start"][hidden]{display:none}'));
  assert.ok(css.includes('.sx-paused[hidden]{display:none}'));
  // 직원: 스위치 상태는 프로젝트 목록과 함께 읽고, 옛 서버 · 실패면 그리지 않는다.
  assert.match(app,/request\('\/api\/settings\/pulse-capacity'\)\.catch\(\(\)=>null\)/);
  assert.match(app,/s\.staffIntake=\['open','paused'\]\.includes\(intake\?\.state\)\?intake:null;/);
});

test('직원 첫 화면의 스위치: 서버가 알 때만 그리고, 바꾸는 단추 · 폼은 관리자에게만',()=>{
  const base={mode:'staff',user:{id:'u1',name:'담당자'},workspace:{projects:[],canWrite:true}};
  assert.doesNotMatch(picker(base),/data-intake/,'옛 서버 · 못 읽음이면 스위치가 없다');
  const open=picker({...base,staffIntake:{state:'open',open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',reopened:'',canEdit:true}});
  assert.match(open,/data-intake/);assert.match(open,/새 의뢰를 받는 중/);assert.match(open,/<form data-form="intake-pause">/);assert.doesNotMatch(open,/data-action="intake-open"/);
  for(const name of ['pauseNote','pauseNoteEn','pausedUntil'])assert.match(open,new RegExp(`name="${name}"`));
  assert.match(open,/name="pauseNote" type="text" value="" maxlength="200"/);assert.match(open,/name="pausedUntil" type="date"[^>]* min="\d{4}-\d{2}-\d{2}"/);
  const paused=picker({...base,staffIntake:{state:'paused',open:false,pausedUntil:'2026-11-20',pauseNote:'일정이 <찼어요>',pauseNoteEn:'Fully booked',reopened:'',canEdit:true}});
  assert.match(paused,/새 의뢰를 쉬는 중 · 11월 20일에 저절로 다시 열려요/);assert.match(paused,/data-action="intake-open"/);assert.doesNotMatch(paused,/data-form="intake-pause"/);
  assert.match(paused,/일정이 &lt;찼어요&gt;/);assert.match(paused,/영어 화면: Fully booked/);
  const crew=picker({...base,staffIntake:{state:'paused',open:false,pausedUntil:'',pauseNote:'',pauseNoteEn:'',reopened:'',canEdit:false}});
  assert.match(crew,/새 의뢰를 쉬는 중 · 다시 열 때까지 쉬어요/);assert.match(crew,/따로 적지 않았어요\(기본 문장 「지금은 잠시 접수를 쉬어요」와 다시 여는 날만 보여요\)/,'안내를 안 적어도 다시 여는 날은 손님에게 보인다고 말한다');assert.match(crew,/바꾸기는 관리자만/);assert.doesNotMatch(crew,/data-action="intake-open"|data-form="intake-pause"/);
  const crewOpen=picker({...base,staffIntake:{state:'open',open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',reopened:'',canEdit:false}});
  assert.doesNotMatch(crewOpen,/data-action="intake-open"|data-form="intake-pause"/);
  assert.match(picker({...base,staffIntake:{state:'open',open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',reopened:'2026-11-13',canEdit:true}}),/11월 13일에 저절로 다시 열렸어요/);
  // 머리 줄: 쉬는 동안 어느 직원 화면에서나 보인다(잊고 닫아 둔 채 판매가 멈추지 않게). 손님 머리 줄에는 없다.
  assert.match(header({...base,staffIntake:{state:'paused'}}),/intake-chip">접수 쉬는 중</);
  assert.doesNotMatch(header({...base,staffIntake:{state:'open'}}),/intake-chip/);
  assert.doesNotMatch(header({mode:'customer',staffIntake:{state:'paused'},intake:PAUSED}),/intake-chip/);
});

// Fable 5.2 최종 검수(11-11) P2 다섯 — 브라우저 동작(글 묶음 윗변 · 화면으로 돌아올 때 다시 묻기 · 직원 표시 · 폼 글 · 커서)은 손으로 돌린 확인이 보고, 여기서는 그 약속이 코드에 남아 있는지 본다.
test('좁은 화면 1쪽의 쉬는 안내는 굵은 단추와 같은 높이 안 두 줄이다 — 글 묶음이 올라가 세로 쇼릴의 얼굴을 덮지 않게',()=>{
  const css=read('film.css'),narrow=css.slice(css.indexOf('@media (max-width:820px),(max-aspect-ratio:1/1){'));
  assert.ok(narrow.includes('.sx-hero-act .sx-paused{padding:0;background:none;gap:4px;height:52px;align-content:center;overflow:hidden}'),'단추(52px)와 같은 높이');
  assert.ok(narrow.includes('.sx-hero-act .sx-paused-note,.sx-hero-act .sx-paused-works{display:none}'),'담당자 안내 · 작품 줄은 좁은 화면 1쪽에서 뺀다(끝 쪽 안내 · 위 작품 줄이 맡는다)');
  assert.ok(narrow.includes('.sx-hero-act .sx-paused-head{padding:0;margin:0;border:0}'));
  assert.ok(narrow.includes('@media (max-width:379.98px){.sx-hero-act .sx-paused{height:auto;min-height:52px}.sx-hero-act .sx-paused .sx-small{white-space:normal}}'),'폭 380 미만에서는 날짜를 자르지 않고 줄을 바꾼다(영어 · 내년 날짜는 폭 360에 한 줄로 안 든다)');
  // 굵은 단추의 높이가 바뀌면 이 값도 함께 바뀌어야 한다: 글 15px × 줄 1.2 + 위아래 17px씩 = 52px.
  assert.ok(css.includes('.sx-go{display:inline-flex;align-items:center;justify-content:space-between;gap:14px;font-family:var(--sx-sans);font-weight:600;font-size:15px;letter-spacing:-.02em;line-height:1.2;padding:14px 0;'));
  assert.ok(css.includes('.sx-go.is-solid{background:var(--sx-ink);color:#0a0a0a;padding:17px 22px;'));
});

test('넓은 화면 1쪽의 안내 판은 「쇼릴 위 빈 곳」이 아니다 — 눌러도 상영하지 않고 커서 글을 띄우지 않는다',()=>{
  const home=read('film-home.mjs');
  assert.ok(home.includes("!event.target.closest('button,a,input,form,.sx-hero-copy,.sx-paused'))watch(reelApi.current());"));
  assert.ok(home.includes("!event.target.closest?.('button,a,input,form,.sx-hero-copy,.sx-paused,.sx-nums,.sx-top'));"));
});

test('쉬는 안내가 선 채 열려 있던 화면은 다시 열렸는지 스스로 다시 묻는다(화면으로 돌아올 때 · 첫 화면을 다시 붙일 때 · 보이는 동안 1분마다)',()=>{
  const app=read('app.mjs');
  assert.match(app,/async function recheckIntake\(\)\{\r?\n  if\(s\.mode!=='customer'\|\|demo\|\|filmDemo\|\|s\.project\|\|!entryHandle\|\|s\.intake\?\.state!=='paused'\)return;/,'안내가 서 있을 때만 묻는다(열려 있는 화면은 아무것도 묻지 않는다)');
  assert.ok(app.includes('if(intake&&intakeKey(intake)!==intakeKey(s.intake)&&!s.project&&canApplyRemote()){s.intake=intake;render();}'),'그릴 수 있을 때만 상태를 바꾼다(못 그리면 쉬는 상태로 둔 채 다음 물음에 맡긴다 — 다시 묻기가 멈추지 않게)');
  assert.match(app,/function watchIntake\(\)\{clearTimeout\(intakeTimer\);intakeTimer=0;if\(s\.mode==='customer'&&!demo&&!filmDemo&&!s\.project&&s\.intake\?\.state==='paused'\)intakeTimer=setTimeout\(\(\)=>\{intakeTimer=0;void recheckIntake\(\);\},60000\);\}/,'타이머는 안내가 서 있는 동안에만 돈다');
  assert.ok(app.includes('mailOpenCheck();modelsEntry();void recheckIntake();}checkResume();watchIntake();}'),'첫 화면을 다시 붙일 때도 묻는다');
  assert.ok(app.includes("window.addEventListener('focus',()=>{if(journalSeenLater)markJournalSeen();void recheckIntake();void recheckStaffIntake();});"));
  assert.ok(app.includes("document.addEventListener('visibilitychange',()=>{if(!document.hidden&&journalSeenLater)markJournalSeen();if(!document.hidden){void recheckIntake();void recheckStaffIntake();}});"));
});

test('직원: 스위치 상태는 화면으로 돌아올 때 · 새로 불러올 때 다시 읽고, 「접수 쉬기」를 낸 뒤 폼 글을 쓰던 글로 남기지 않고, 휴대폰에서도 쉬는 중 표시가 보인다',()=>{
  const app=read('app.mjs'),css=read('app.css');
  assert.match(app,/async function recheckStaffIntake\(\{force=false\}=\{\}\)\{\r?\n  if\(s\.mode!=='staff'\|\|!s\.user\|\|demo\|\|!s\.staffIntake\|\|!force&&\(busy\|\|loading\|\|Date\.now\(\)-staffIntakeAt<30000\)\)return;/);
  assert.ok(app.includes('if(s.project){await loadProject(s.project.id);await recheckStaffIntake({force:true});}else if(s.user)await loadWorkspace();'),'프로젝트를 연 채 새로 불러올 때도 읽는다');
  assert.match(app,/async function intakeSave\(body,message,form=null\)\{if\(busy\|\|loading\|\|s\.mode!=='staff'\)return;const key=form\?draftKey\(form\):'',revision=drafts\.get\(key\)\?\.revision;/);
  assert.ok(app.includes('staffIntakeAt=Date.now();if(key)clearDraft(key,revision);render();notice(message);'),'성공하면 폼 글을 지운다');
  assert.match(app,/if\(type==='intake-pause'\)\{await intakeSave\(\{open:false,[^}]*\},'[^']*',form\);return;\}/);
  assert.ok(css.includes('@media (max-width:640px){.header-actions .intake-chip{position:absolute;top:calc(100% - 10px);right:8px;z-index:1;pointer-events:none;'),'휴대폰 폭에서는 숨기지 않고 머리 줄 아랫선에 건다(단계 줄 화살표에 닿지 않게)');
  assert.ok(app.includes('if(canApplyRemote()){s.staffIntake=intake;render({remote:true});}else staffIntakeAt=0;'),'직원 화면도 그릴 수 있을 때만 바꾼다');
  assert.doesNotMatch(css,/\.intake-chip\{display:none\}/);
});
