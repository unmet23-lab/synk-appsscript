import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {literalSyllables,SKIP_DIRS} from './pulse-ui-text.mjs';

// PULSE 첫 방문 무게(2026-11-11): 판 6 점검 E(지연 400ms · 50KB/s, 서비스 워커 없는 첫 방문)에서 의뢰서가 34초 뒤에 떴다.
// 통째 글꼴 미리 받기(902KB)와 의뢰서 밑 첫 화면 그림(1.4MB) · 쇼릴이 화면 모듈과 대역을 나눴다. 글자 모양 · 그림 · 영상은 그대로 두고 받는 때만 바꾼 약속을 지킨다.
// 글꼴 조각은 저장소 tools/build-pulse-fonts.py가 만든다 — 이 시험은 그 도구를 부르지 않고 결과(film.css 범위 · 파일)만 본다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const parseRange=text=>{const set=new Set();for(const part of text.split(',')){const [a,b]=part.trim().slice(2).split('-');for(let c=parseInt(a,16);c<=parseInt(b||a,16);c++)set.add(c);}return set;};
const faces=(css,family)=>[...css.matchAll(/@font-face\{font-family:([^;]+);src:url\('\.\/assets\/([^']+)'\) format\('woff2'\);font-weight:([^;]+);font-display:swap;unicode-range:([^}]+)\}/g)].filter(m=>m[1].replace(/'/g,'')===family).map(m=>({file:m[2],weight:m[3],range:parseRange(m[4])}));
const SYLLABLE=c=>c>=0xAC00&&c<=0xD7A3;
const SANS=['SYNKSans-pulse-rest.woff2','SYNKSans-pulse-ui.woff2','SYNKSans-pulse-first.woff2','SYNKSans-pulse-latin.woff2'];
const SERIF=['NotoSerifKR-300-rest.woff2','NotoSerifKR-300-ui.woff2','NotoSerifKR-300-sym.woff2'];

// 화면 원문: pulse-app 모듈의 문자열 · 템플릿 글(주석 제외) + index.html — 도구가 ui 조각을 만들 때와 같은 훑개(pulse-ui-text.mjs)로 센다.
// 회사 이미지는 npm 패키지 없이 company/*.mjs만 싣는다 — 이 시험은 node 기본 모듈과 같은 폴더 도우미만 import한다(조율 11-11, acorn을 쓰면 이미지 시험이 ERR_MODULE_NOT_FOUND).
function uiSyllables(){
  const sources=[],walk=dir=>{for(const e of readdirSync(dir,{withFileTypes:true})){const p=new URL(e.name+(e.isDirectory()?'/':''),dir);if(e.isDirectory()){if(!SKIP_DIRS.includes(e.name))walk(p);}else if(/\.(mjs|js)$/.test(e.name))sources.push(readFileSync(p,'utf8'));}};
  walk(appDir);
  const out=literalSyllables(sources);
  for(const ch of read('index.html')){const c=ch.codePointAt(0);if(SYLLABLE(c))out.add(c);}
  return out;
}

test('the app no longer preloads the whole fonts and draws text from glyph slices declared lowest-priority first',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/rel="preload"[^>]*\.woff2/,'통째 SUIT(610KB) · 명조(292KB)를 미리 받지 않는다 — 느린 연결에서 film.css · 화면 모듈과 대역을 나눴다');
  const css=read('film.css');
  assert.deepEqual(faces(css,'SYNK Sans').map(f=>f.file),SANS,'뒤에 선언한 면을 먼저 본다(CSS Fonts 4 §4.5) — rest → ui → first → latin');
  assert.deepEqual(faces(css,'Noto Serif KR').map(f=>f.file),SERIF);
  for(const file of [...SANS,...SERIF]){const bytes=readFileSync(new URL('assets/'+file,appDir));assert.equal(bytes.toString('latin1',0,4),'wOF2',file);}
  assert.match(css,/--sx-sans:'SYNK Sans',/);assert.match(css,/--sx-mono:'DM Mono','SYNK Sans',/);
  assert.match(css,/font-family:'SX Latin';src:url\('\.\/assets\/SYNKSans-pulse-latin\.woff2'\)/);assert.match(css,/font-family:'SX Latin Wide';src:url\('\.\/assets\/SYNKSans-pulse-latin\.woff2'\)/);
  const code=css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(code,/SUIT\.woff2|NotoSerifKR-300\.woff2'|\bSUIT\b/,'고객 화면 CSS는 통째 글꼴을 부르지 않는다(SUIT는 OFL 예약 이름이라 줄인 판은 SYNK Sans)');
});

test('slices never overlap where a page would fetch two files for one glyph, and every screen syllable avoids the rest slice',()=>{
  const css=read('film.css'),[sRest,sUi,sFirst,sLatin]=faces(css,'SYNK Sans'),[nRest,nUi,nSym]=faces(css,'Noto Serif KR');
  const meet=(a,b)=>[...a.range].filter(c=>b.range.has(c));
  // 범위가 겹치면 앞 조각을 받는 동안 크롬이 뒤 조각까지 받는다 — 겹쳐도 되는 곳은 ui 범위(음절 칸 통째)와 rest의 「ui에 없는 음절」뿐이다.
  assert.deepEqual(meet(sFirst,sUi),[],'첫 글자는 ui 범위에서 뺀다 — 영어 화면은 latin · first만 받는다');
  assert.deepEqual(meet(sFirst,sRest),[]);assert.deepEqual(meet(sLatin,sUi),[]);assert.deepEqual(meet(sLatin,sRest),[]);assert.deepEqual(meet(sLatin,sFirst),[]);
  assert.deepEqual(meet(nSym,nUi),[]);assert.deepEqual(meet(nSym,nRest),[]);
  assert.ok(sFirst.range.size>0&&sFirst.range.size<120,`첫 글자 조각은 작게(${sFirst.range.size}자)`);
  // 언어를 정하기 전 첫 render()의 머리 단추 · 불러오는 글도 — 영어 화면이 이 글자 때문에 ui 조각(148KB)을 받았다(11-11 실측).
  for(const word of ['한국어','본문으로 건너뛰기','프로젝트를 확인하고 있어요','앱 설치','제작자 공간'])for(const ch of word.replace(/\s/g,''))assert.ok(sFirst.range.has(ch.codePointAt(0)),`첫 글자 조각에 「${ch}」`);
  // 회사 이미지 안에서도 돈다 — 이 시험과 훑개는 node 기본 모듈과 같은 폴더 파일만 import한다(npm 패키지 없음).
  // 따옴표 둘 다 · from 있는 import와 다시 내보내기 · 이름 없는 import · 동적 import를 다 센다(검수 -c B2 — 작은따옴표 꼴만 보면 큰따옴표 import가 지나갔다).
  for(const file of ['pulse-first-load.test.mjs','pulse-ui-text.mjs']){
    const src=readFileSync(new URL('./'+file,import.meta.url),'utf8');
    const specs=[...src.matchAll(/^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/gm),...src.matchAll(/^\s*import\s*(['"])([^'"]+)\1/gm),...src.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)].map(m=>m[2]);
    assert.ok(specs.length>=(file==='pulse-first-load.test.mjs'?4:0),`${file}의 import를 못 셌다(${specs.length})`);
    for(const from of specs)assert.match(from,/^(node:|\.\/)/,`${file}가 ${from}을 import한다`);
  }
  const ui=uiSyllables();assert.ok(ui.size>400,`화면 원문 음절 ${ui.size}자`);
  const strayRest=[...ui].filter(c=>sRest.range.has(c)).map(c=>String.fromCodePoint(c));
  assert.deepEqual(strayRest,[],'화면 글이 바뀌었다 — python -X utf8 tools/build-pulse-fonts.py를 다시 돌린다(안 돌리면 첫 화면에서 나머지 조각 461KB까지 받는다)');
  const strayRestSerif=[...ui].filter(c=>nRest.range.has(c)).map(c=>String.fromCodePoint(c));
  assert.deepEqual(strayRestSerif,[],'명조 나머지 조각(225KB)도 마찬가지 — 도구를 다시 돌린다');
  assert.ok([...ui].every(c=>sUi.range.has(c)||sFirst.range.has(c)),'화면 음절은 ui 또는 first 범위 안');
});

test('the server serves every slice and the shell precaches only what the first screens draw',()=>{
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8'),sw=read('sw.js');
  assert.match(server,/for\(const name of \['SYNKSans-pulse-latin','SYNKSans-pulse-first','SYNKSans-pulse-ui','SYNKSans-pulse-rest','NotoSerifKR-300-sym','NotoSerifKR-300-ui','NotoSerifKR-300-rest'\]\)files\['\/pulse-app\/assets\/'\+name\+'\.woff2'\]=\['public\/pulse-app\/assets\/'\+name\+'\.woff2','font\/woff2'\];/);
  for(const file of [...SANS,...SERIF])assert.ok(existsSync(new URL('assets/'+file,appDir)),file);
  // 통째 글꼴은 직원 화면(app.css 'SUIT Variable')과 옛 탭을 위해 그대로 둔다.
  assert.ok(server.includes("files['/pulse-app/assets/NotoSerifKR-300.woff2']")&&server.includes("'SUIT.woff2'"));
  const precache=sw.slice(0,sw.indexOf('const RUNTIME'));
  for(const name of ['SYNKSans-pulse-latin','SYNKSans-pulse-first','SYNKSans-pulse-ui','NotoSerifKR-300-sym','NotoSerifKR-300-ui'])assert.ok(precache.includes(`'${name}'`),name);
  assert.doesNotMatch(precache,/'assets\/SUIT\.woff2'|NotoSerifKR-300\.woff2|pulse-rest|300-rest/,'통째 글꼴 · 나머지 조각은 첫 방문 셸 받기에서 뺐다');
  assert.match(sw,/const RUNTIME = \['assets\/SUIT\.woff2','assets\/NotoSerifKR-300\.woff2','assets\/SYNKSans-pulse-rest\.woff2','assets\/NotoSerifKR-300-rest\.woff2'\]\.map\(name=>BASE\+name\);/);
  assert.match(sw,/const ALLOWED = new Set\(\[\.\.\.FILES,\.\.\.RUNTIME\]\);/,'받을 때 담아 두면 끊겨도 쓴다');
  assert.match(sw,/cache\.addAll\(FILES\)/);
});

test('the shell worker waits until the page has loaded and gone idle, and the rest of the font waits for a visitor who types',()=>{
  const app=read('app.mjs');
  // 등록은 한 곳뿐이고, 그 한 곳이 load 뒤 쉴 때 부르는 콜백의 몸 그대로다(검수 pulse-first-load-backend A1 — 앞뒤 위치만 보면 콜백 밖 등록도 통과했다).
  assert.equal(app.match(/navigator\.serviceWorker\.register\('\.\/sw\.js'/g).length,1);
  assert.equal(app.match(/afterLoadIdle\(/g).length,1,'콜백을 받는 곳은 하나');
  assert.ok(app.includes("\nafterLoadIdle(()=>{if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'/pulse-app/'}).catch(()=>{});});"),'서비스 워커 등록은 load 뒤 쉴 때 — 콜백 안에만');
  assert.doesNotMatch(app,/afterLoadIdle\(\(\)=>\{[^\n]*face\.load/,'쉴 때 글꼴을 미리 받지는 않는다');
  assert.ok(app.includes("const afterLoadIdle=fn=>{const go=()=>setTimeout(()=>typeof requestIdleCallback==='function'?requestIdleCallback(fn,{timeout:5000}):fn(),1500);if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});};"));
  // 나머지 조각(461KB)은 보기만 하는 손님에게 보내지 않는다 — 한국어 화면에서 글 칸에 들어올 때만(데이터 절약 · 2G 빼고).
  assert.ok(app.includes(`document.addEventListener('focusin',event=>{if(restFontAsked||locale()!=='ko'||leanData()||!navigator.onLine||!document.fonts||!event.target?.matches?.('textarea,input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])'))return;restFontAsked=true;for(const face of document.fonts)if(face.family.replace(/["']/g,'')==='SYNK Sans'&&face.status==='unloaded')face.load().catch(()=>{});});`));
  assert.equal(app.match(/face\.load\(\)/g).length,1,'글꼴을 미리 받는 곳은 글 칸 focusin 하나');
});

test('first-screen pictures behind later pages are attached only when the visitor comes near them',async()=>{
  const {entryView}=await import('./public/pulse-app/film-home.mjs');
  const html=entryView({});
  for(const name of ['shard','end'])assert.match(html,new RegExp(`<div class="sx-layer sx-layer-${name}" data-layer="${name}"><img data-src="\\./assets/request/${name}\\.webp" alt="" decoding="async">`),name);
  assert.equal((html.match(/<img data-src="\.\/assets\/request\/model-scene-/g)||[]).length,4);
  assert.equal((html.match(/<img data-src="\.\/assets\/request\/sheet-gift-\d\d\.webp" alt="" loading="lazy"/g)||[]).length,12);
  assert.doesNotMatch(html,/<img src="\.\/assets\/request\/(shard|end|model-scene-|sheet-gift-)/,'뒤쪽 그림은 처음 그릴 때 받지 않는다');
  assert.match(html,/<img src="\.\/assets\/request\/logo-paper\.webp"/,'로고는 그대로');
  assert.match(read('film.css'),/^\.sx-home img\[data-src\]\{visibility:hidden\}\r?$/m,'아직 붙이지 않은 빈 그림은 자리 그대로 숨긴다 — 판 6 점검이 「깨짐 18」로 셌다');
  const home=read('film-home.mjs');
  assert.ok(home.includes('const warm=i=>{if(hold||i<0)return;for(let k=i;k<=i+2&&k<list.length;k++)hydrate(layers.get(list[k].layer));hydrate(sections[i]);hydrate(sections[i+1]);};'),'지금 쪽부터 두 쪽 앞 무대 그림 · 다음 쪽 안 그림');
  assert.ok(home.includes('if(i===current)return;current=i;\n    warm(i);')||home.includes('if(i===current)return;current=i;\r\n    warm(i);'));
  assert.ok(home.includes("resume(){hold=false;warm(current);later();"),'덮개가 닫히면 그때 붙인다');
  assert.ok(home.includes('const warmAll=()=>{if(!hold&&!slowData())hydrate(host);};'),'느리지 않은 연결은 load 뒤 쉴 때 다 붙인다 — 빠른 연결에서 보이는 것은 그대로');
});

// 브라우저처럼: src를 붙이면 readyState 0. 창의 load를 흉내 낸다.
const fakeVideo=()=>{const attrs=new Map(),handlers={};let src='';
  return {muted:false,playsInline:false,loop:false,preload:'',poster:'',paused:true,currentTime:0,readyState:0,duration:12.33,seeking:false,buffered:{length:0,start:()=>0,end:()=>0},
    get src(){return src;},set src(value){src=value;attrs.set('src',value);},setAttribute(key,value){attrs.set(key,value);},removeAttribute(key){attrs.delete(key);if(key==='src')src='';},getAttribute(key){return attrs.get(key)??null;},
    load(){},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
    addEventListener(type,fn){(handlers[type]??=[]).push(fn);},removeEventListener(type,fn){handlers[type]=(handlers[type]||[]).filter(item=>item!==fn);}};};
function fakeWindow({readyState='loading',connection}={}){
  const saved={document:Object.getOwnPropertyDescriptor(globalThis,'document'),add:globalThis.addEventListener,remove:globalThis.removeEventListener,nav:Object.getOwnPropertyDescriptor(globalThis.navigator||{},'connection')};
  const loads=new Set();
  globalThis.document={readyState};
  globalThis.addEventListener=(type,fn)=>{if(type==='load')loads.add(fn);};globalThis.removeEventListener=(type,fn)=>{if(type==='load')loads.delete(fn);};
  if(globalThis.navigator)Object.defineProperty(globalThis.navigator,'connection',{value:connection,configurable:true});
  globalThis.requestAnimationFrame??=()=>0;globalThis.cancelAnimationFrame??=()=>{};
  return {loads,fireLoad(){globalThis.document.readyState='complete';for(const fn of [...loads]){loads.delete(fn);fn();}},
    restore(){if(saved.document)Object.defineProperty(globalThis,'document',saved.document);else delete globalThis.document;globalThis.addEventListener=saved.add;globalThis.removeEventListener=saved.remove;if(globalThis.navigator){if(saved.nav)Object.defineProperty(globalThis.navigator,'connection',saved.nav);else delete globalThis.navigator.connection;}}};
}

test('the reel file waits for the page load, a held reel fetches not even its poster, and data saver keeps the poster until a film is chosen',async()=>{
  const {mountReel}=await import('./public/pulse-app/film-home.mjs');
  let w=fakeWindow();
  try{
    const video=fakeVideo(),api=mountReel(video,{});
    assert.match(video.poster,/reel-(wide|tall)-poster\.webp$/,'포스터(같은 첫 장면)는 바로');
    api.play();assert.equal(video.getAttribute('src'),null,'문서를 불러오는 동안은 쇼릴 파일을 붙이지 않는다');
    assert.equal(w.loads.size,1,'load 기다림은 하나');api.play();assert.equal(w.loads.size,1);
    w.fireLoad();assert.match(video.getAttribute('src'),/reel-(wide|tall)\.mp4$/,'load 뒤에 붙이고');assert.equal(video.paused,false,'틀어 달라던 대로 튼다');
    // load 전에 덮개가 열리면 기다림도 거둔다.
    w.restore();w=fakeWindow();
    const early=fakeVideo(),earlyApi=mountReel(early,{});earlyApi.play();earlyApi.suspend();assert.equal(w.loads.size,0);w.fireLoad();assert.equal(early.getAttribute('src'),null);
    earlyApi.stop();api.stop();
    // 붙잡힌 쇼릴(의뢰서 · 예시가 곧바로 열림)은 포스터도 받지 않고, 처음 재생할 때 포스터와 파일을 함께 붙인다.
    w.restore();w=fakeWindow({readyState:'complete'});
    const held=fakeVideo(),heldApi=mountReel(held,{held:true});
    assert.equal(held.poster,'');assert.equal(held.getAttribute('src'),null);
    heldApi.play();assert.match(held.poster,/-poster\.webp$/);assert.match(held.getAttribute('src'),/\.mp4$/);heldApi.stop();
    // 데이터 절약: 저절로는 받지 않고, 작품 이름을 고르면(ask) 그때 받는다. 쪽이 넘어가며 부르는 focus는 고름이 아니다.
    w.restore();w=fakeWindow({readyState:'complete',connection:{saveData:true,effectiveType:'4g'}});
    const lean=fakeVideo(),leanApi=mountReel(lean,{});leanApi.play();leanApi.focus('maejin-imbak');
    assert.equal(lean.getAttribute('src'),null,'데이터 절약이면 포스터로 둔다');assert.match(lean.poster,/-poster\.webp$/);
    leanApi.focus('omitok-court',{ask:true});assert.match(lean.getAttribute('src'),/\.mp4$/,'손님이 작품을 고르면 받는다');leanApi.stop();
    w.restore();w=fakeWindow({readyState:'complete',connection:{saveData:false,effectiveType:'2g'}});
    const slow=fakeVideo(),slowApi=mountReel(slow,{});slowApi.play();assert.equal(slow.getAttribute('src'),null,'2G도 포스터로');slowApi.stop();
    w.restore();w=fakeWindow({readyState:'complete',connection:{saveData:false,effectiveType:'3g'}});
    const mid=fakeVideo(),midApi=mountReel(mid,{});midApi.play();assert.match(mid.getAttribute('src'),/\.mp4$/,'3G는 load 뒤 받는다(무대 그림만 가까이 올 때)');midApi.stop();
  }finally{w.restore();}
});
