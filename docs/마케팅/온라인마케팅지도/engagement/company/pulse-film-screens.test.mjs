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
  assert.match(sw,/const CACHE = 'synk-pulse-shell-v28-film-next-20261105';/);
});
test('customer screens name no tool and promise nothing the rules forbid',()=>{
  const words=/Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora|Veo|Omni|Suno|같은 얼굴|결제 전|무제한|납기|최고|최초|유일|1위|모루|MORU|드립백/;
  const body=source=>source.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
  for(const name of ['film-home.mjs','film-views.mjs','film-review.mjs','demo-film.mjs','request-flow.mjs','films-view.mjs','feedback-rounds-view.mjs','room-view.mjs'])assert.doesNotMatch(body(read(name)),words,name);
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
const scriptDraft={round:1,oneLine:'서리꽃이 피는 순간',ratio:'9:16',model:null,cuts:[{seconds:1.5,what:'결정이 자라요.',say:'',text:''},{seconds:2,what:'이름이 떠요.',say:'한번 발라 봐요',text:'유리결'}]};
test('the text script is one lit sheet that reads every cut, with no empty strip',()=>{
  const html=draftView(scriptDraft);
  assert.match(html,/^<div class="sx-draft sx-dr is-script"/);
  assert.doesNotMatch(html,/sx-dr-bottom|data-frame|data-blank/,'no empty strip and no empty picture frame');
  assert.equal(html.split('class="sx-strip-cut sx-sheet-row').length-1,2);
  assert.match(html,/data-cut="1"[^>]*>[\s\S]*0:01[\s\S]*이름이 떠요\.[\s\S]*한번 발라 봐요[\s\S]*유리결/,'a row carries the time, the action, the line and the on-screen words');
  // mountDraft가 찾는 칸은 모두 있어야 한다.
  for(const hook of ['data-strip','data-head','data-tc','data-tc-no','data-cut-no','data-cut-sec','data-cut-what','data-cut-say','data-cut-text','data-draft-do="play"','data-draft-do="approve"','data-comment-input'])assert.ok(html.includes(hook),hook);
  const pictures=draftView({...scriptDraft,cuts:scriptDraft.cuts.map(cut=>({...cut,src:'./a.webp'}))});
  assert.match(pictures,/<img data-frame src="\.\/a\.webp"/);assert.match(pictures,/sx-dr-bottom sx-draft-strip/);assert.doesNotMatch(pictures,/sx-sheet/,'once there are pictures the room shows pictures');
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
  assert.ok(flow.includes(`data-do="allmodels">21명 모두 보기`));assert.ok(flow.includes(`data-do="allmodels">넷만 보기`));
  assert.ok(flow.includes('monSwap(allModels?allWall(a):wall(a))'));
  assert.ok(flow.includes(`CASTING_MODELS.filter(fit),...CASTING_MODELS.filter(item=>!fit(item))`),'the full wall still holds all 21');
});
test('a customer is not shown empty scene fields, staff still are',()=>{
  const scene={id:'s1',title:'한 장면',description:'설명',duration:3,visibility:'customer',narration:'없음',screenText:''};
  const said={...scene,id:'s2',narration:'한번 발라 봐요',screenText:'유리결'};
  const build=mode=>projectView({mode,tab:'storyboard',canEdit:true,project:{id:'p',title:'편',ownerName:'담당',stage:'review',revision:1,versions:[],messages:[],studio:{scenes:[scene,said],sceneReviews:[],assets:[],comments:[]}}});
  const customer=build('customer');
  assert.doesNotMatch(customer,/<dd>없음<\/dd>/);assert.match(customer,/<dd>한번 발라 봐요<\/dd>/);assert.match(customer,/<dd>유리결<\/dd>/);
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
  assert.ok(flow.includes(`$('.sx-q-screen').setAttribute('aria-label',s.id==='model'?'모델 고르기':'미리 보기');`));
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
test('no public file of the customer app names an AI tool, comments included — a customer can read them with view-source',async()=>{
  const {readdirSync}=await import('node:fs');
  const dir=new URL('./public/pulse-app/',import.meta.url);
  const files=readdirSync(dir,{recursive:true}).map(String).filter(name=>/\.(mjs|js|css|html|webmanifest)$/.test(name));
  assert.ok(files.length>30,'공개 글 파일을 모두 읽는다');
  for(const name of files)assert.doesNotMatch(readFileSync(new URL(name.split('\\').join('/'),dir),'utf8'),/Claude|Fable|Seedance|Higgsfield|Gemini|GPT|Kling|Sora|아르곤|Argon|페이블|시댄스|힉스필드/,name);
});
