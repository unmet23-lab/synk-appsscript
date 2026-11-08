import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rangeFromDiffs,stripCount,holdPoster,POSTER_AT} from './public/pulse-app/film-review.mjs';
import {draftView} from './public/pulse-app/film-views.mjs';
import {entryView} from './public/pulse-app/film-home.mjs';
import {projectView} from './public/pulse-app/views.mjs';
import {FINISHED_FILMS,filmLine,filmNote} from './public/pulse-app/films-view.mjs';

// 시사실 판(2026-11-05 유호님 「A 시사실로」): 화면을 다시 그려도 지키는 약속. 화면 그림은 끝까지 눌러 보는 점검(docs/마케팅/PULSE_프론트재구성_20261104/README.md 10절)이 본다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const SCREEN_FILES=['film-home.mjs','film-views.mjs','film-review.mjs','request-flow.mjs','demo-film.mjs','films-view.mjs','feedback-rounds-view.mjs','room-view.mjs'];
// 손님 화면과 공개 파일에 쓰지 않는 도구 이름은 이 한 줄에서만 늘린다(검수 r2 FA1 — 시험마다 따로 두면 한쪽만 빠진다).
const TOOL_NAMES='Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora|Veo|Omni|Suno|아르곤|Argon|페이블|시댄스|힉스필드';

test('every new screen stays inside the content security policy: no style attributes in markup, no inline scripts',()=>{
  for(const name of SCREEN_FILES)assert.doesNotMatch(read(name),/\bstyle=["']|<style|setAttribute\('style'|\son[a-z]+=["']|javascript:/,name);
  const index=read('index.html');assert.doesNotMatch(index,/<style|\bstyle="|<script(?![^>]*type="module" src=)/);
});
test('the first screen reads only the new stylesheet; the old sheets stay served for staff and project screens',()=>{
  const index=read('index.html');
  assert.match(index,/<html lang="ko" class="sx">/);
  assert.equal((index.match(/rel="stylesheet"/g)||[]).length,1);assert.match(index,/href="\.\/film\.css" id="film-css"/);
  const app=read('app.mjs');
  assert.match(app,/const LEGACY_CSS=\['app\.css','casting\.css','production\.css','preview\.css','slate\.css','slate-screens\.css','slate-legacy\.css'\];/);
  assert.match(app,/if\(\(s\.mode==='staff'\|\|s\.project\)&&!legacyCssReady\)\{void ensureLegacyCss\(\)\.then\(\(\)=>render\(\{remote\}\)\);return;\}/,'project and staff screens wait for the old sheets instead of flashing unstyled');
  assert.match(app,/if\(staffMode\)\{document\.documentElement\?\.classList\?\.remove\?\.\('sx'\)/,'staff screens never take the dark theme');
});
test('the server serves every new file and the service worker caches the shell but not the films',()=>{
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8'),sw=read('sw.js');
  for(const name of ['film-home.mjs','film-review.mjs'])assert.ok(server.includes(`'${name}'`),name);
  for(const name of ["'film.css'","'film-legacy.css'","'reel-wide','reel-tall'","'reel-wide-poster','reel-tall-poster','shard','end'","'file-gift-set','file-gift-ampoule','file-gift-jar','still-shards','still-lid'","'sheet-gift-'","'model-scene-'","NotoSerifKR-300.woff2"])assert.ok(server.includes(name),name);
  for(const name of ['film.css','film-legacy.css','film-home.mjs','film-review.mjs','assets/NotoSerifKR-300.woff2'])assert.ok(sw.includes(name),name);
  assert.doesNotMatch(sw,/reel-(wide|tall)\.mp4/,'the reel is not stored on the device');
  assert.match(sw,/const CACHE = 'synk-pulse-shell-v31-i18n-20261109';/);
});
test('customer screens name no tool and promise nothing the rules forbid',()=>{
  const words=new RegExp(`${TOOL_NAMES}|같은 얼굴|결제 전|무제한|납기|최고|최초|유일|1위|모루|MORU|드립백`);
  const body=source=>source.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
  for(const name of ['film-home.mjs','film-views.mjs','film-review.mjs','demo-film.mjs','request-flow.mjs','films-view.mjs','feedback-rounds-view.mjs','room-view.mjs'])assert.doesNotMatch(body(read(name)),words,name);
  // 11-06 대표작 이름을 「霜の肌理」로 바꿨다(유호님 「이 판으로 바꿔」) — 손님이 읽는 글에 옛 이름 · 뺀 라인 이름(서리꽃 앰플 = 霜花)이 남지 않는다.
  for(const name of ['film-home.mjs','film-views.mjs','demo-film.mjs','demo.mjs','request-data.mjs','request-flow.mjs','films-view.mjs','views.mjs'])assert.doesNotMatch(body(read(name)),/유리결|YURIGYEOL|서리꽃 앰플|霜花/,name);
  // 명조 칸(제목 · 작품 이름)에 들어간 「霜の肌理」는 기기 명조가 아니라 고딕으로 그린다 — 앱 글꼴 줄인 판에는 이 네 글자가 없다.
  const css=read('film.css');assert.match(css,/@font-face\{font-family:'SX Name';src:local\('Malgun Gothic'\)[^}]*unicode-range:U\+306E,U\+7406,U\+808C,U\+971C\}/);assert.match(css,/--sx-serif:'SX Latin','Noto Serif KR','SX Name',serif/);
  const text=entryView({}).replace(/<[^>]+>/g,' ');
  assert.doesNotMatch(text,words);
  // 장면 이미지를 말하면 단서를 함께 둔다.
  assert.match(text,/장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요\./);
});
test('the reel credits every film it shows: own films as virtual brands, the contest film as a contest entry',()=>{
  for(const id of ['yurigyeol-holiday','maejin-imbak','hwaseong-light']){
    const film=FINISHED_FILMS.find(item=>item.id===id);assert.ok(filmLine(film),id);assert.ok(filmNote(film),id);
  }
  assert.equal(filmNote(FINISHED_FILMS.find(item=>item.id==='yurigyeol-holiday')),'가상 브랜드로 만든 자체 작품');
  assert.equal(filmNote(FINISHED_FILMS.find(item=>item.id==='hwaseong-light')),'공모전 출품작');
  assert.equal(entryView({}).split('data-work="').length-1,3);
});
test('changed places are marked only when one stretch clearly stands out; otherwise nothing is claimed',()=>{
  const quiet=Array(15).fill(3);
  assert.equal(rangeFromDiffs(quiet),null,'regenerated cuts differ a little everywhere: no claim');
  const stretch=[...Array(6).fill(3),40,50,45,44,38,42,41,...Array(2).fill(3)];
  assert.deepEqual(((({from,to})=>({from,to}))(rangeFromDiffs(stretch))),{from:6,to:13});
  assert.equal(rangeFromDiffs(Array(15).fill(60)),null,'everything changed: the median rises and nothing stands out');
  assert.equal(rangeFromDiffs([...Array(5).fill(3),...Array(10).fill(40)]),null,'more than a little over half: not a useful mark');
  assert.equal(rangeFromDiffs([]),null);
  assert.equal(stripCount(15),15);assert.equal(stripCount(3),6);assert.equal(stripCount(200),30);
});
const at='2026-11-05T01:00:00.000Z';
const version=(id,label,extra={})=>({id,label,kind:'preview',guide:'',createdAt:at,media:{url:`/pulse/api/studio/media/${id}`,mimeType:'video/mp4',fileName:`${id}.mp4`},...extra});
const reviewState=(extra={})=>({mode:'customer',tab:'review',versionId:'',project:{id:'p',title:'오미톡 15초',ownerName:'담당',stage:'review',revision:3,versions:[version('v1','1차 시안'),version('v2','2차 시안')],messages:[{id:'m1',author:'customer',authorName:'고객',action:'feedback',versionId:'v1',seconds:8,text:'더 크게',resolved:true,at}],studio:{preferences:{},references:[],concepts:[],scenes:[],comments:[],sceneReviews:[],feedbackRounds:{drafts:[],rounds:[{id:'r1',number:1,versionId:'v1',versionLabel:'1차 시안',representativeName:'고객',submittedAt:at,items:[{id:'i1',messageId:'m1',seconds:8,text:'더 크게',resolved:true}]}],latestVersionId:'v2',latestVersionLabel:'2차 시안',canDraft:true,maxItems:20,nextNumber:2}}},...extra});
test('the review room keeps every contract the app and notifications reach for',()=>{
  const html=projectView(reviewState());
  for(const hook of ['id="review-video"','data-version="v2"','id="video-error"','id="review-approval"','id="review-feedback"','class="review-form','data-form="round-draft"','data-form="feedback"','data-action="approve" data-id="v2"','data-action="version-pick"','data-action="compare"','data-action="review-panel"','data-message-id="m1"','data-feedback-round-id="r1"','data-action="seek"','download="','data-mutate'])assert.ok(html.includes(hook),hook);
  assert.match(html,/2차 시안이에요\. 지난 의견 1개 중 1개를 반영했어요\./,'the compare sentence counts real notes');
  assert.doesNotMatch(html,/\scontrols[\s>=]/,'the room draws its own play button and timeline');
  // 쓰던 글을 다시 채우는 초안 키는 data-form + data-id다. 새 의견 칸은 언제나 new:<최신 판>이다.
  assert.match(html,/data-form="round-draft" data-id="new:v2" data-item-id="" data-draft-id="" data-version-id="v2"/);
  const drafting=reviewState();drafting.project.studio.feedbackRounds.drafts=[{id:'d1',current:true,versionId:'v2',versionLabel:'2차 시안',items:[{id:'n1',seconds:4,text:'글자를 키워요'}]}];
  const two=projectView(drafting);
  assert.match(two,/data-action="open-round-submit"[^>]*><span>의견 1개 보내기/,'the main button sends what was collected');
  assert.doesNotMatch(two,/data-action="approve"/,'collected notes come before approval');
  assert.match(two,/class="round-submit sx-round-sheet"/);assert.match(two,/name="representativeName"[^>]*required/);assert.match(two,/name="confirmed" value="yes" required/);
  assert.match(two,/data-action="round-remove-item" data-draft-id="d1" data-id="n1"/);
  assert.match(two,/class="sx-mark is-draft"/);
});
test('an older cut of the film shows where the new one is and takes no new note',()=>{
  const html=projectView(reviewState({versionId:'v1'}));
  assert.doesNotMatch(html,/data-form="round-draft" data-id="new:/);
  assert.match(html,/data-action="latest-version"/);
  assert.match(html,/1차 시안이에요\. 지금 보고 계신 판은 수정 전이에요\./);
  assert.match(html,/최신 시안으로 돌아오면 새 의견을 모을 수 있어요\./);
});
test('side by side uses the shared compare group so playing one does not stop the other',()=>{
  const html=projectView(reviewState({compare:true}));
  assert.match(html,/class="sx-dr-films compare-grid"/);
  assert.equal(html.split('<video').length-1,2);
  const app=read('app.mjs');
  assert.ok(app.includes(".closest('.compare-grid')"),'the play listener lets the compare group play together');
  assert.ok(app.includes("Array.from(main.querySelectorAll('.compare-grid video'))"));
});
test('redraws keep the film playing: the review video node is kept on every render, not only live refreshes',()=>{
  const app=read('app.mjs');
  assert.ok(app.includes("const media=remote||main.querySelector('#review-video')?Array.from(main.querySelectorAll('video,audio'))"));
  assert.ok(app.includes("for(const fresh of media.length?main.querySelectorAll('video,audio'):[])"));
  assert.ok(app.includes(".sx-draft[data-playing=\"true\"]"),'a playing draft still holds back live refresh');
});
test('the reel does not hold back live refresh, and the first screen is never redrawn over itself',()=>{
  assert.doesNotMatch(read('film-home.mjs'),/data-film-player/);
  assert.doesNotMatch(read('film-views.mjs'),/data-room-film data-film-player/);
  const app=read('app.mjs');
  assert.ok(app.includes("const keepEntry=!!entryHandle&&!s.project&&s.mode!=='staff';if(keepEntry)entryHandle.update("));
  assert.ok(app.includes("function overlayState(open){if(open)entryHandle?.pause();else entryHandle?.resume();"));
});
// 심사가 가장 약하다고 본 그림이 영상의 첫 프레임이었다(2026-11-05 맹검 5차). 멈춘 영상은 끝 컷에 서서 기다리고, 재생은 처음부터다.
const fakeVideo=({duration=15,readyState=1,currentTime=0,dataset={}}={})=>{const handlers={};return {duration,readyState,currentTime,paused:true,dataset,addEventListener(type,fn){(handlers[type]??=[]).push(fn);},fire(type){for(const fn of handlers[type]||[])fn();}};};
test('a paused film waits on its end shot and plays from the start',()=>{
  const video=fakeVideo();holdPoster(video);
  assert.equal(video.currentTime,15*POSTER_AT);assert.equal(Number(video.dataset.holding),15*POSTER_AT);
  video.fire('play');
  assert.equal(video.currentTime,0,'the first play starts the film from the beginning');assert.equal(video.dataset.holding,undefined);
  const later=fakeVideo({readyState:0});holdPoster(later);assert.equal(later.currentTime,0,'it waits for the length');later.fire('loadedmetadata');assert.equal(later.currentTime,15*POSTER_AT);
  const unknown=fakeVideo({duration:NaN});holdPoster(unknown);assert.equal(unknown.currentTime,0,'a film whose length is unknown stays put');
});
test('a revised film waits where it changed, and plays on from there',()=>{
  const video=fakeVideo(),poster=holdPoster(video);
  poster.moveTo(6);
  assert.equal(video.currentTime,6);assert.equal(video.dataset.holding,undefined);
  video.fire('play');assert.equal(video.currentTime,6,'it keeps going from the changed part');
  poster.moveTo(9);assert.equal(video.currentTime,6,'once the viewer has the film, nothing moves it');
});
test('redrawing the screen around the same film node does not move it',()=>{
  const seen=fakeVideo({currentTime:4.5});holdPoster(seen);assert.equal(seen.currentTime,4.5,'a film someone already moved stays where they left it');assert.equal(seen.dataset.holding,undefined);
  const waiting=fakeVideo({currentTime:12.6,dataset:{holding:'12.6'}});holdPoster(waiting);assert.equal(waiting.currentTime,12.6);
  waiting.fire('play');assert.equal(waiting.currentTime,0,'a film still waiting on its end shot still plays from the start after a redraw');
  const seeked=fakeVideo();holdPoster(seeked).release();seeked.fire('play');assert.equal(seeked.currentTime,15*POSTER_AT,'after a seek, play continues from the seek');
  // 의견의 시간을 눌러 옮기는 것처럼 다른 데서 옮기면 기다림이 풀리고, 달라진 곳을 찾아도 끌려가지 않는다.
  const moved=fakeVideo(),hold=holdPoster(moved);moved.currentTime=3;moved.fire('seeking');assert.equal(moved.dataset.holding,undefined);
  hold.moveTo(6);assert.equal(moved.currentTime,3);moved.fire('play');assert.equal(moved.currentTime,3);
  const own=fakeVideo();holdPoster(own);own.fire('seeking');assert.ok(own.dataset.holding,'its own seek does not count');
  // 손님이 0초에 세워 둔 영상은 화면을 다시 그려도 끝 컷으로 안 간다.
  const atZero=fakeVideo();holdPoster(atZero).release();atZero.currentTime=0;holdPoster(atZero);assert.equal(atZero.currentTime,0);assert.equal(atZero.dataset.holding,undefined);
});
test('delivery draws its own player over the same film and keeps live refresh from interrupting it',()=>{
  const state=reviewState({tab:'history'});
  state.project.stage='delivered';state.project.versions=[...state.project.versions,{...version('f1','15초 최종본'),kind:'final'}];
  const html=projectView(state);
  assert.match(html,/class="sx-room-screen sx-final" data-final><video class="sx-q-fill" src="[^"]+f1" playsinline preload="metadata" data-film-player aria-label="15초 최종본">/);
  assert.doesNotMatch(html,/\scontrols[\s>=]/);
  for(const hook of ['data-film-toggle','data-final-time','data-final-line','role="slider"','data-final-sound','data-final-full'])assert.ok(html.includes(hook),hook);
  assert.match(html,/download="[^"]+"/,'the file can still be taken from the same place');
  const app=read('app.mjs');
  assert.ok(app.includes("if(main.querySelector('[data-final]'))finalHandle=mountFinal(main);"));
  assert.ok(app.includes("finalHandle?.unmount();finalHandle=null;"),'the old listeners go when the screen is redrawn');
});
const scriptDraft={round:1,oneLine:'서리꽃이 피는 순간',ratio:'9:16',model:null,cuts:[{seconds:1.5,what:'결정이 자라요.',say:'',text:''},{seconds:2,what:'이름이 떠요.',say:'한번 발라 봐요',text:'霜の肌理'}]};
test('the text script is one lit sheet that reads every cut, with no empty strip',()=>{
  const html=draftView(scriptDraft);
  assert.match(html,/^<div class="sx-draft sx-dr is-script"/);
  assert.doesNotMatch(html,/sx-dr-bottom|data-frame|data-blank/,'no empty strip and no empty picture frame');
  assert.equal(html.split('class="sx-strip-cut sx-sheet-row').length-1,2);
  assert.match(html,/data-cut="1"[^>]*>[\s\S]*0:01[\s\S]*이름이 떠요\.[\s\S]*한번 발라 봐요[\s\S]*霜の肌理/,'a row carries the time, the action, the line and the on-screen words');
  // mountDraft가 찾는 칸은 모두 있어야 한다.
  for(const hook of ['data-strip','data-head','data-tc','data-tc-no','data-cut-no','data-cut-sec','data-cut-what','data-cut-say','data-cut-text','data-draft-do="approve"','data-comment-input'])assert.ok(html.includes(hook),hook);
  // 글을 시간에 맞춰 넘기면 읽기에 방해라(의뢰 흐름 9절 5번) 글 콘티 판에는 「이어서 보기」가 없다. 장면 이미지 판은 그대로 있다.
  assert.doesNotMatch(html,/data-draft-do="play"|이어서 보기/);
  const pictures=draftView({...scriptDraft,cuts:scriptDraft.cuts.map(cut=>({...cut,src:'./a.webp'}))});
  assert.match(pictures,/<img data-frame src="\.\/a\.webp"/);assert.match(pictures,/data-draft-do="play"/);assert.match(pictures,/sx-dr-bottom sx-draft-strip/);assert.doesNotMatch(pictures,/sx-sheet/,'once there are pictures the room shows pictures');
});
// 맹검 6차: 21명 얼굴 격자는 「판매 목록」으로 읽혔다. 첫 판은 제작사가 고른 넷이고 21명은 손님이 열 때만 펼친다.
test('every kind offers four hand-picked models who fit that kind, and the whole cast stays one press away',async()=>{
  const {MODEL_PICKS,MODEL_LINES,KINDS}=await import('./public/pulse-app/request-data.mjs');
  const {CASTING_MODELS}=await import('./public/pulse-app/casting-catalog.mjs');
  for(const kind of KINDS){
    const picks=MODEL_PICKS[kind.id];
    assert.equal(picks?.length,4,kind.id);assert.equal(new Set(picks).size,4,kind.id);
    for(const id of picks){assert.ok(CASTING_MODELS.some(model=>model.id===id),id);assert.ok(MODEL_LINES[id].fits.includes(kind.id),`${id} fits ${kind.id}`);}
  }
  const flow=read('request-flow.mjs');
  // 다국어 판 1(11-09): 단추 글은 번역 틀을 지나고 인원수는 카탈로그에서 센다. 한국어 화면의 글자는 그대로 「21명 모두 보기」다.
  assert.ok(flow.includes("data-do=\"allmodels\">${esc(t('{count}명 모두 보기',{count:CASTING_MODELS.length}))}"));assert.ok(flow.includes("data-do=\"allmodels\">${esc(t('넷만 보기'))}"));
  const {t}=await import('./public/pulse-app/i18n.mjs');assert.equal(t('{count}명 모두 보기',{count:CASTING_MODELS.length}),'21명 모두 보기');
  assert.ok(flow.includes('monSwap(allModels?allWall(a):wall(a))'));
  assert.ok(flow.includes(`CASTING_MODELS.filter(fit),...CASTING_MODELS.filter(item=>!fit(item))`),'the full wall still holds all 21');
});
test('a customer is not shown empty scene fields, staff still are',()=>{
  const scene={id:'s1',title:'한 장면',description:'설명',duration:3,visibility:'customer',narration:'없음',screenText:''};
  const said={...scene,id:'s2',narration:'한번 발라 봐요',screenText:'霜の肌理'};
  const build=mode=>projectView({mode,tab:'storyboard',canEdit:true,project:{id:'p',title:'편',ownerName:'담당',stage:'review',revision:1,versions:[],messages:[],studio:{scenes:[scene,said],sceneReviews:[],assets:[],comments:[]}}});
  const customer=build('customer');
  assert.doesNotMatch(customer,/<dd>없음<\/dd>/);assert.match(customer,/<dd>한번 발라 봐요<\/dd>/);assert.match(customer,/<dd>霜の肌理<\/dd>/);
  assert.match(build('staff'),/<dd>없음<\/dd>/,'staff keep the full table');
});
// 11-05 밤 다음 판: 아르곤 H2 · M2, B3, B6, Fable F5, FA1 · FA2(r2), FA1(r3)과 운영에서 잰 쇼릴 이름 늦음.
// 브라우저처럼: src를 붙이거나 load()하면 시각 0 · readyState 0, loadedmetadata가 오면 readyState 1. once 듣개는 한 번 돌고 빠진다.
const reelVideo=()=>{const attrs=new Map(),handlers={},frames=[];let src='';
  return {muted:false,playsInline:false,loop:false,preload:'',poster:'',paused:true,currentTime:0,readyState:0,duration:17.7,loads:0,
    buffered:{length:0,start:()=>0,end:()=>0},
    get src(){return src;},set src(value){src=value;attrs.set('src',value);this.currentTime=0;this.readyState=0;},
    setAttribute(key,value){attrs.set(key,value);},removeAttribute(key){attrs.delete(key);if(key==='src')src='';},getAttribute(key){return attrs.get(key)??null;},
    load(){this.loads++;this.currentTime=0;this.readyState=0;},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
    addEventListener(type,fn,opts){(handlers[type]??=[]).push({fn,once:!!opts?.once});},removeEventListener(type,fn){handlers[type]=(handlers[type]||[]).filter(item=>item.fn!==fn);},
    listeners(type){return (handlers[type]||[]).length;},
    fire(type){if(type==='loadedmetadata')this.readyState=1;const list=handlers[type]||[];handlers[type]=list.filter(item=>!item.once);for(const item of list)item.fn();},
    requestVideoFrameCallback(fn){frames.push(fn);return frames.length;},cancelVideoFrameCallback(){},
    frame(mediaTime){for(const fn of frames.splice(0))fn(0,{mediaTime});}};};
test('the reel names each film on the frame it cuts, waits when held, and lets go of the file under the demo',async()=>{
  globalThis.requestAnimationFrame??=()=>0;globalThis.cancelAnimationFrame??=()=>{};
  const {mountReel}=await import('./public/pulse-app/film-home.mjs');
  const seen=[];
  const video=reelVideo(),api=mountReel(video,{held:true,onCut:film=>seen.push(film?.id)});
  assert.equal(video.getAttribute('src'),null,'붙잡은 쇼릴은 파일을 받지 않는다');
  api.focus(null);assert.equal(video.getAttribute('src'),null,'첫 쪽을 켜도 붙잡은 동안은 받지 않는다');
  api.play();assert.match(video.getAttribute('src'),/reel-(wide|tall)\.mp4$/);video.fire('loadedmetadata');
  // 작품 이름은 화면에 나간 프레임의 시간으로 바뀐다(2.6초 컷). timeupdate만 보면 최대 0.25초 늦는다.
  seen.length=0;video.frame(2.55);assert.deepEqual(seen,[]);video.frame(2.62);assert.deepEqual(seen,['hwaseong-light']);
  video.currentTime=4.9;video.fire('timeupdate');assert.deepEqual(seen,['hwaseong-light'],'프레임을 보는 브라우저에서는 timeupdate로 바꾸지 않는다');
  // 덮개가 열리면 멈추고, 다 받지 못한 파일은 놓는다. 다시 재생하면 그 자리에서 잇는다.
  video.currentTime=5.2;api.suspend();assert.equal(video.paused,true);assert.equal(video.getAttribute('src'),null);
  api.play();assert.match(video.getAttribute('src'),/reel-/);assert.equal(video.currentTime,0);video.fire('loadedmetadata');assert.equal(video.currentTime,5.2);
  // 아르곤 A1: 다시 붙인 뒤 메타데이터가 오기 전에 또 덮여도 떼던 자리를 잃지 않고, 자리를 되돌리는 듣개는 하나뿐이다.
  video.currentTime=7.4;api.suspend();api.play();assert.equal(video.listeners('loadedmetadata'),1);
  api.suspend();assert.equal(video.listeners('loadedmetadata'),0,'떼면 기다리던 듣개도 뗀다');
  api.play();assert.equal(video.listeners('loadedmetadata'),1);video.fire('loadedmetadata');assert.equal(video.currentTime,7.4);assert.equal(video.listeners('loadedmetadata'),0);
  // 다 받은 쇼릴은 놓지 않고 멈추기만 한다.
  const whole=reelVideo();whole.buffered={length:1,start:()=>0,end:()=>17.7};const wholeApi=mountReel(whole,{});
  wholeApi.play();wholeApi.suspend();assert.equal(whole.paused,true);assert.match(whole.getAttribute('src'),/reel-/);
  api.stop();wholeApi.stop();
});
test('the request form reads choose-then-next: back and next come after the screen, which is named for what it holds',()=>{
  const flow=read('request-flow.mjs');
  const aside=flow.indexOf('<aside class="sx-q-screen"'),asideEnd=flow.indexOf('</aside>'),foot=flow.indexOf('<footer class="sx-q-foot">');
  assert.ok(aside>0&&asideEnd>aside&&foot>asideEnd,'이전 · 다음은 화면 칸 뒤 — 모델 단계에서 Tab이 모델 칸을 먼저 지난다');
  assert.ok(flow.includes(`$('.sx-q-screen').setAttribute('aria-label',s.id==='model'?t('모델 고르기'):t('미리 보기'));`));
  assert.ok(flow.includes(`form.scrollTop=0;$('.sx-q-ask').scrollTop=0;$('.sx-q-stage').scrollTop=0;`),'휴대폰은 바깥 칸이 스크롤된다 — 단계를 바꾸면 맨 위에서 연다');
  const css=read('film.css');
  assert.match(css,/\.sx-q-foot\{grid-column:1;grid-row:2;/);assert.match(css,/\.sx-q-screen\{grid-column:2;grid-row:1\/3;/);assert.match(css,/  \.sx-q-foot\{order:3;position:sticky;bottom:0;/);
});
test('the invite door closes from inside, both openers follow it, and the first screen keeps to the rules it set itself',()=>{
  const html=entryView({});
  assert.match(html,/<form class="sx-invite"[^>]*>[\s\S]*<button type="button" class="sx-small sx-invite-close" data-entry="close">닫기<\/button><\/form>/);
  const home=read('film-home.mjs');
  assert.ok(home.includes(`if(what==='close'){setInvite(false);return;}`));
  assert.ok(home.includes(`$$('[data-entry="open"]').forEach(button=>button.setAttribute('aria-expanded',open?'true':'false'))`),'여는 단추 둘이 같은 상태');
  assert.ok(home.includes('let closed=false;\n  function close(){if(closed)return;closed=true;')||home.includes('let closed=false;\r\n  function close(){if(closed)return;closed=true;'),'상영 창은 한 번만 닫힌다');
  assert.ok(home.includes(`if(!host){listScreening?.close();return;}`),'완성 광고 목록이 사라지면 그 목록에서 연 상영도 닫는다');
  assert.ok(read('app.mjs').includes(`held:!!(filmDemo||startRequest)`),'예시 · 의뢰서가 곧바로 열리는 주소에서는 쇼릴을 받지 않는다');
  const css=read('film.css')+read('film-legacy.css');
  assert.doesNotMatch(css,/min-aspect-ratio:1\/1\)/,'넓은 화면 질의는 좁은 화면 질의((max-aspect-ratio:1/1))의 정확한 여집합');
  assert.doesNotMatch(css,/box-shadow:0 -22px/,'가리는 것은 그라데이션으로 — 그림자 없음');
  assert.doesNotMatch(read('film.css'),/font-size:14px/,'글자 크기는 넷(제목 · 준제목 · 본문 15 · 작은 글 13)');
  // Fable 최종(pulse-film-20261105-next) F1~F5.
  assert.ok(home.includes('back.focus({preventScroll:box.bottom<=0||box.top>=innerHeight})'),'F1 휴대폰에서 닫아도 첫 화면을 되감지 않는다');
  const legacy=read('film-legacy.css'),film=read('film.css'),flow=read('request-flow.mjs');
  assert.match(legacy,/@media \(min-width:821px\) and \(min-aspect-ratio:10001\/10000\)\{html\.has-demo-nav \.sx-room-hero\{min-height:calc\(100dvh - var\(--demo-bar\)\)\}/,'F2 예시 방 높이는 넓은 화면만');
  assert.doesNotMatch(legacy,/^html\.has-demo-nav \.sx-room-hero\{/m);
  assert.match(film,/  \.sx-q\.sheet-open \.sx-q-credits\{transform:none;visibility:visible;/,'F3 닫힌 시트는 초점 밖');assert.ok(flow.includes('sheet(){setSheet(!host.classList.contains(\'sheet-open\'));}'));
  assert.ok(legacy.includes('  html.has-demo-nav .sx-q-top{top:var(--demo-bar)}'),'F4 예시 안 의뢰서 머리 막대는 예시 막대 아래');
  assert.doesNotMatch(film,/^\.sx-q-credits:not\(:has\(\.sx-q-line\)\)\{background:none\}/m,'F5 투명 처리는 넓은 화면 크레딧에만');
});
test('on narrow screens the ratio label sits inside the frame, and the end page title comes back where it fits',()=>{
  const css=read('film.css');
  const narrowRequest=css.slice(css.indexOf('.sx-q{--ask:100%}'),css.indexOf('/* ── 머리 막대(프로젝트 화면) ── */'));
  assert.match(narrowRequest,/\.sx-q-finder \.sx-no\{top:6px;left:6px;padding:1px 6px;background:#000\}/,'above the frame it hides under the top bar and the box on the right');
  assert.match(css,/@media \(max-height:769\.98px\)\{\.sx-end \.sx-display\{display:none\}\}/,'only low phones hide the title');
  assert.equal((css.match(/\.sx-end \.sx-display\{display:none\}/g)||[]).length,1,'no other rule hides it on tall phones');
  assert.match(css,/\.sx-p\.is-end\{justify-content:flex-end\}\s*\.sx-end\{max-width:none\}/,'on a tablet the end page lines up with the logo and the first page, not pushed to the right');
});
// end.webp(1080×1920)에서 화소로 잰 자리: 로고 글자 위 405, 작은 줄(美容液とクリーム…) 아래 끝 658, 뚜껑 빛 678 · 뚜껑 위 693, 상자 바닥 1335, 병 왼쪽 165, 상자 오른쪽 895.
const END_PHOTO={logoTop:405,lineBottom:658,capGlow:678,capTop:693,boxBottom:1335,left:165,right:895};
const narrowBlock=css=>{const open=['\n','\r\n'].map(nl=>css.indexOf(`@media (max-width:820px),(max-aspect-ratio:1/1){${nl}`)).find(at=>at>=0);return css.slice(open,css.indexOf('/* 제목 어절 나타나기(motion.mjs) */'));};
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};
const maskStops=(rule,angle)=>{const found=rule.match(new RegExp(`mask-image:[^;]*linear-gradient\\(${angle},transparent 0,#000 ([\\d.]+)%,#000 ([\\d.]+)%,transparent 100%\\)`));return found?[Number(found[1])/100,Number(found[2])/100]:null;};
test('on a portrait tablet the end page shows the whole cap and box: one centred column from the logo to the box, while narrow landscape windows keep the base crop',()=>{
  const css=read('film.css');
  const narrow=narrowBlock(css);
  const base='  .sx-layer-end img{position:absolute;left:0;top:44px;right:0;width:100%;height:calc(44% - 44px);object-fit:cover;object-position:50% 62%;max-width:100%;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 16%,#000 82%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 16%,#000 82%,transparent 100%)}';
  assert.ok(narrow.includes(base),'the narrow base crop (what narrow landscape windows show, and what both frames build on) stays byte for byte');
  const tablet=narrow.match(/@media \(min-width:(\d+)px\) and \(max-aspect-ratio:1\/1\)\{\s*\.sx-layer-end img\{([^}]*)\}\s*\}/);
  assert.ok(tablet&&narrow.indexOf(tablet[0])>narrow.indexOf(base),'the tablet frame comes after the base crop inside the narrow block, so it wins only there');
  const from=Number(tablet[1]);
  assert.ok(from>440&&from<=600,'phones up to 440 wide take the phone frame; every tablet from 600 takes this one');
  const rule=tablet[2];
  assert.match(rule,/width:auto;margin:0 auto;/,'a column centred under the logo row, not a full-width strip');
  // 가로를 다 보이는 칸: 칸 비율 a/b면 원본 너비 전부와 높이 nw·b/a만큼의 띠가 보이고, 띠의 시작은 object-position 세로 값이 정한다.
  const [nw,nh]=webpSize(readFileSync(new URL('assets/request/end.webp',appDir)));
  assert.deepEqual([nw,nh],[1080,1920],'the measured places belong to this size; re-measure them if the end photo changes');
  const [,ratioW,ratioH]=rule.match(/aspect-ratio:(\d+)\/(\d+)/).map(Number);
  const band=nw*ratioH/ratioW,start=Number(rule.match(/object-position:50% ([\d.]+)%/)[1])/100*(nh-band);
  const vertical=maskStops(rule,'180deg'),horizontal=maskStops(rule,'90deg');
  assert.ok(vertical&&horizontal,'the fade above and below stays, and a thin one on the sides hides the edge of the warm light at the top');
  assert.ok(start+vertical[0]*band<=END_PHOTO.logoTop-8,'the logo lettering starts below the top fade');
  assert.ok(start+vertical[0]*band<=END_PHOTO.capTop-200,'so the cap is never faded');
  assert.ok(start+vertical[1]*band>=END_PHOTO.boxBottom+8,'the bottom of the box sits above the bottom fade');
  assert.ok(start+band<=nh&&start>=0,'the band stays inside the photo');
  assert.ok(horizontal[0]*nw<=END_PHOTO.left-60&&horizontal[1]*nw>=END_PHOTO.right+60,'the side fade stays clear of the bottle and the box');
  assert.match(rule,/-webkit-mask-composite:source-in;mask-image:[^;]*;mask-composite:intersect$/,'the two fades multiply in every engine instead of adding up');
  // 칸 높이는 제목 위 남는 자리: 아래 글 묶음(제목 두 줄 + 단추 · 고지 · 바닥 줄)을 뺀다.
  assert.match(rule,/height:calc\(100% - 422px - 2\.28\*var\(--sx-t1\)\)/);
  assert.match(css,/\.sx-display\{font-size:var\(--sx-t1\);line-height:1\.14;/,'two title lines are 2 × 1.14 = 2.28 title sizes');
  const end=entryView({}).match(/<div class="sx-end"><p class="sx-display">([\s\S]*?)<\/p>/);
  assert.equal((end[1].match(/class="sx-ln"/g)||[]).length,2,'the end title is two lines; the frame height counts on it');
  const hide=css.match(/@media \(max-height:([\d.]+)px\)\{\.sx-end \.sx-display\{display:none\}\}/)[1];
  assert.ok(narrow.includes(`@media (min-width:${from}px) and (max-aspect-ratio:1/1) and (max-height:${hide}px){.sx-layer-end img{height:calc(100% - 359px)}}`),'where the title hides, the frame takes the room down to the button');
});
test('on a portrait phone the end page shows the product from just under the small line: the whole cap and box, no ghost of the lettering, the reflection filling down to the title',()=>{
  const css=read('film.css');
  const narrow=narrowBlock(css);
  const tabletAt=narrow.indexOf('@media (min-width:520px) and (max-aspect-ratio:1/1){');
  const found=narrow.match(/@media \(max-width:([\d.]+)px\) and \(max-aspect-ratio:1\/1\)\{\s*\.sx-layer-end img\{([^}]*)\}\s*\}/);
  assert.ok(found&&tabletAt>0&&narrow.indexOf(found[0])>tabletAt,'the phone frame sits in the narrow block after the tablet frame');
  assert.equal(found[1],'519.98','phones are the portrait windows just under the tablet frame (520), so the two never overlap');
  const rule=found[2];
  for(const prop of ['height','width','object-position'])assert.match(rule,new RegExp(`${prop}:[^;]*100vh[^;]*;${prop}:[^;]*100dvh`),`${prop}: a vh value first, its dvh twin after it`);
  const top=Number(rule.match(/(?:^|;)top:(\d+)px/)[1]);
  const K=Number(rule.match(/height:calc\(100dvh - (\d+)px\)/)[1]);
  const ratioText=rule.match(/width:min\(100%,calc\(\(100dvh - \d+px\)\*([\d.]+)\)\)/)[1],ratio=Number(ratioText);
  const [,vwText,heightText]=rule.match(/object-position:50% max\(-([\d.]+)vw,calc\(\(\d+px - 100dvh\)\*([\d.]+)\)\)/);
  // 꽉 찬 너비: 그림이 너비의 662/1080만큼 올라간다(vw). 줄인 칸(비율 r): 칸 높이 × (662 × r / 1080)만큼 — 둘 다 같은 줄에서 띠가 시작한다.
  const [nw,nh]=webpSize(readFileSync(new URL('assets/request/end.webp',appDir)));
  const start=Number(vwText)/100*nw,band=nw/ratio;
  assert.ok(Math.abs(Number(heightText)*band-start)<1,'a shrunk frame starts the band at the same row as a full-width one');
  assert.ok(start>=END_PHOTO.lineBottom+2&&start<=END_PHOTO.capGlow-8,'the band starts in the dark gap under the small line: no ghost of the lettering, the cap glow comes in whole');
  const [,fadeTop,fadeVw,fadePct]=rule.match(/mask-image:linear-gradient\(180deg,transparent 0,#000 (\d+)px,#000 min\(([\d.]+)vw,([\d.]+)%\),transparent 100%\)/).map(Number);
  assert.ok(start+fadeTop/(270/nw)<=END_PHOTO.capTop-4,'the short top fade ends above the cap even in a 270px-wide frame');
  assert.ok(start+fadeVw/100*nw>=END_PHOTO.boxBottom+8,'full width: the bottom fade starts under the box');
  assert.ok(start+fadePct/100*band>=END_PHOTO.boxBottom+8,'shrunk: the bottom fade starts under the box');
  assert.ok(Math.abs(fadeVw/100*nw-fadePct/100*band)<2,'both fade starts point at the same row');
  assert.ok(start+band<=nh,'the shrunk band stays inside the photo');
  // 아래 글 묶음: 휴대폰 제목은 늘 36px(3.9vw가 36px을 넘지 않는다)라 두 줄 2.28 × 36 + 422px, 칸 위를 44px에서 내린 만큼 더 비운다.
  assert.match(css,/--sx-t1:clamp\(36px,3\.9vw,58px\)/);assert.ok(3.9*519.98/100<36);
  assert.equal(K,422+Math.round(2.28*36)+(top-44),'with the title showing, the frame stops above it');
  const hide=css.match(/@media \(max-height:([\d.]+)px\)\{\.sx-end \.sx-display\{display:none\}\}/)[1];
  const low=narrow.match(/@media \(max-width:519\.98px\) and \(max-aspect-ratio:1\/1\) and \(max-height:([\d.]+)px\)\{\.sx-layer-end img\{([^}]*)\}\}/);
  assert.ok(low&&low[1]===hide,'where the title hides (same height as the title rule), the phone frame takes the room down to the button');
  const K2=Number(low[2].match(/height:calc\(100dvh - (\d+)px\)/)[1]);
  assert.ok(K2<K&&K2>=330+(top-44),'the lower copy without the title still keeps the button clear');
  for(const text of [`height:calc(100vh - ${K2}px);height:calc(100dvh - ${K2}px)`,`width:min(100%,calc((100dvh - ${K2}px)*${ratioText}))`,`object-position:50% max(-${vwText}vw,calc((${K2}px - 100dvh)*${heightText}))`])assert.ok(low[2].includes(text),text);
});
test('no public file of the customer app quotes internal decisions by name — comments included, a customer can read them with view-source',async()=>{
  const {readdirSync}=await import('node:fs');
  const dir=new URL('./public/pulse-app/',import.meta.url);
  const files=readdirSync(dir,{recursive:true}).map(String).filter(name=>/\.(mjs|js|css|html|webmanifest)$/.test(name));
  assert.ok(files.length>30);
  for(const name of files)assert.doesNotMatch(readFileSync(new URL(name.split('\\').join('/'),dir),'utf8'),/유호님/,name);
});
test('no public file of the customer app names an AI tool, comments included — a customer can read them with view-source',async()=>{
  const {readdirSync}=await import('node:fs');
  const dir=new URL('./public/pulse-app/',import.meta.url);
  const files=readdirSync(dir,{recursive:true}).map(String).filter(name=>/\.(mjs|js|css|html|webmanifest)$/.test(name));
  assert.ok(files.length>30,'공개 글 파일을 모두 읽는다');
  const tools=new RegExp(TOOL_NAMES);
  for(const name of files)assert.doesNotMatch(readFileSync(new URL(name.split('\\').join('/'),dir),'utf8'),tools,name);
});
