import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

// 의뢰서 모델 단계의 4초(11-10 유호님 「영상 넣고」): 고객 앱은 캐스팅북(synk.im/pulse/casting) 모델 벽의 사람별 한 컷을 그 주소에서 받는다.
// 이 시험은 회사 원천만 읽는다 — 회사 이미지 판의 격리 QA 사본에는 회사 폴더만 있다. 캐스팅북 빌드 규칙(wall.json · build-site.cjs)과의 대조는
// 저장소 시험 tests/pulse-model-films-book.test.mjs, 배율(1.5배 이하)은 tests/pulse-model-film-scale.test.mjs.
globalThis.location??=new URL('http://localhost/pulse-app/');
const {MODEL_FILM_BASE,MOVING_MODELS,modelFilm}=await import('./public/pulse-app/request-flow.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=(base,name)=>readFileSync(new URL(name,base),'utf8');

test('every moving model is a catalog model, and each points at its casting book clip and first-frame poster',()=>{
  const ids=CASTING_MODELS.map(model=>model.id);
  assert.equal(new Set(MOVING_MODELS).size,MOVING_MODELS.length,'no one twice');
  for(const id of MOVING_MODELS)assert.ok(ids.includes(id),`${id} is in the catalog`);
  assert.ok(!MOVING_MODELS.includes('M03'),'M03 has no clip on the book wall');
  assert.equal(MODEL_FILM_BASE,'https://synk.im/pulse/casting/');
  assert.deepEqual(modelFilm({id:'F02'}),{src:'https://synk.im/pulse/casting/video/F02-wall.mp4',poster:'https://synk.im/pulse/casting/img/F02/wall.webp'});
  assert.equal(modelFilm({id:'M03'}),null);
  assert.equal(modelFilm(undefined),null);
});

test('the page may load the book’s clips and posters, and the shell cache leaves them alone',()=>{
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.ok(server.includes("img-src 'self' https: data: blob:; media-src 'self' https: blob:"),'the customer app policy takes https images and media');
  assert.match(read(appDir,'sw.js'),/url\.origin!==self\.location\.origin/,'the service worker does not touch other origins');
});

test('the big portrait plays the clip over the scene photo, without enlarging it, and steps aside for the choices',()=>{
  const flow=read(appDir,'request-flow.mjs'),css=read(appDir,'film.css');
  assert.ok(flow.includes('<figure class="sx-casting-lead" role="presentation">${portraitImg(choiceText(a)?choiceShot(a):bigScene(lead))}<video data-portrait-film muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true"></video><figcaption class="sx-small" data-portrait-name aria-hidden="true">'),'the photo, clip and name strip stay out of the reading order — the left column already says who it is');
  assert.ok(flow.includes('return `<img data-portrait src="${esc(src)}"${set?` srcset="${esc(set)}" sizes="${SCENE_SIZES}"`:\'\'}${shape?` data-shot="${shape}"`:\'\'} alt="" decoding="async">`;'),'the photo itself is still empty alt text');
  assert.ok(flow.includes('const stillOnly=()=>reduced()||!!globalThis.navigator?.connection?.saveData;'),'reduced motion and data saver keep the photos');
  assert.match(flow,/function showChoice\(\)\{[^\n]*return;\}leadFilm\(null\);/,'「recommend」 and 「no model」 take the clip away');
  assert.ok(flow.includes("crossfade($('[data-portrait]'),bigScene(item),sceneSet(bigScene(item)));leadFilm(item);"),'picking or pointing at a person swaps the clip with the photo (and the photo’s large cut with it)');
  assert.ok(flow.includes("if(id==='model'){monSwap(allModels?allWall(a):wall(a));if(!allModels&&!choiceText(a))leadFilm(modelOf(a.models[0])||picksOf(a)[0]);return;}"),'the first paint plays the lead person');
  assert.ok(flow.includes("const still=new Image();still.src=next.poster;(still.decode?still.decode():Promise.reject()).then(show,()=>{if(film.readyState>=2)show();else film.addEventListener('loadeddata',show,{once:true});});"),'the clip covers the photo only once its first-frame poster (or first frame) is in — no black box first, and a poster that fails after the first frame still lets the clip show');
  assert.ok(flow.includes("const show=()=>{if(film.isConnected&&film.dataset.src===src&&!film.error)box.classList.add('has-film');};"),'a late poster of a person already left behind does not cover the photo, and neither does a poster that arrives after the clip itself failed (no dead 「재생」 over a still)');
  assert.ok(css.includes('.sx-casting-lead{container-type:size}'));
  assert.match(css,/\.sx-casting-lead video\{[^}]*object-fit:contain;[^}]*background:#000;/,'a box wider than 9:16 fits the clip by its height on black instead of cropping and enlarging it');
  assert.ok(css.includes('@container (max-aspect-ratio:9/16){.sx-casting-lead video,.sx-casting-lead img[data-shot=tall]{object-fit:cover}}'),'a box narrower than 9:16 is always filled — its height sets the scale either way');
  assert.ok(css.includes('@media (max-resolution:1dppx){@container (max-width:1056px){.sx-casting-lead video,.sx-casting-lead img[data-shot=tall]{object-fit:cover}}}'),'a wider box is filled only while its width × pixel ratio keeps the clip under the limit (1440 · 1366 · 1920 windows); 2560 and phones keep black sides — the scale itself is tests/pulse-model-film-scale.test.mjs');
  assert.ok(css.includes('@media not all and (max-resolution:1.25dppx){@media (max-resolution:1.5dppx){@container (min-height:1255px){.sx-casting-lead video,.sx-casting-lead img[data-shot=tall]{object-fit:contain;padding-block:calc((100cqh - 1254px)/2)}}}}'),'a box too tall for its pixel ratio letterboxes the clip on its own black padding instead of stretching it (4K at 150%) — every band is tests/pulse-model-film-scale.test.mjs');
  assert.ok(css.includes('.sx-casting-lead.has-film video{opacity:1;'));
});

test('the all-21 wall plays a clip only under a hovering pointer, and drops it on leaving',()=>{
  const flow=read(appDir,'request-flow.mjs');
  assert.ok(flow.includes("const canHover=()=>typeof matchMedia==='function'&&matchMedia('(hover:hover)').matches;"));
  assert.ok(flow.includes('!stillOnly()&&canHover()?modelFilm(modelOf(tile.dataset.id)):null'),'touch screens, reduced motion and data saver keep the wall still');
  assert.ok(flow.includes("mon.querySelectorAll('.sx-wall video').forEach(stopTile);"),'one tile moves at a time');
  assert.ok(flow.includes("host.addEventListener('mouseout',event=>{const tile=event.target.closest?.('.sx-wall .sx-cast');if(!tile||tile.contains(event.relatedTarget))return;clearTimeout(tileTimer);tile.querySelectorAll('video').forEach(stopTile);});"));
  assert.ok(flow.includes("film.matches?.('[data-portrait-film]')&&film.dataset.src&&film.dataset.src===film.getAttribute('src'))film.parentElement.classList.remove('has-film')"),'a clip that fails to load gives the photo back');
});

test('looping clips can be paused, and the big portrait stays paused across people once the customer pauses it',()=>{
  const flow=read(appDir,'request-flow.mjs'),css=read(appDir,'film.css');
  assert.ok(flow.includes("const holdName=(kind,paused)=>kind==='lead'?(paused?t('모델 영상 재생'):t('모델 영상 멈춤')):(paused?t('예시 작품 영상 재생'):t('예시 작품 영상 멈춤'));"),'the button’s accessible name says what it stops, and keeps the visible word');
  assert.ok(flow.includes('data-do="filmhold" data-hold="${kind}"${paused?\' data-paused\':\'\'} aria-label="${esc(holdName(kind,paused))}">${esc(paused?t(\'재생\'):t(\'멈춤\'))}</button>'),'one maker for both buttons: kind, paused mark, name and word');
  assert.ok(flow.includes("${holdButton('lead',false)}</figure>"),'the big portrait carries a pause button');
  assert.ok(flow.includes("></video>`)}${holdButton('win',reduced())}<p class=\"sx-small sx-q-cap\">"),'the example film of the 「what lasts」 step gets the same handle (starting it under reduced motion) — outside the frame, whose fade-in makes it a stacking context that trapped the button under the phone shade and caption');
  assert.ok(flow.includes("filmhold(el){const lead=el.dataset.hold==='lead',film=$(lead?'[data-portrait-film]':'[data-win-film]');if(!film)return;if(lead)filmHeld=!film.paused;if(film.paused)film.play().catch(()=>{});else film.pause();},"));
  assert.ok(flow.includes("film.preload=filmHeld?'auto':'none';film.poster=next.poster;film.src=src;"),'a paused portrait still fetches the next person’s first frame — without it a failed poster left the button hidden and the hold stuck');
  assert.ok(flow.includes('if(!filmHeld)film.play().catch(()=>{}).finally(()=>syncHold(film));else syncHold(film);'),'a paused portrait shows the next person’s first frame instead of playing, and a refused autoplay leaves 「재생」 on the button');
  assert.ok(flow.includes("function syncHold(film){const kind=film?.matches?.('[data-portrait-film]')?'lead':film?.matches?.('[data-win-film]')?'win':'',hold=kind&&$(`[data-hold=\"${kind}\"]`);if(!hold)return;hold.textContent=film.paused?t('재생'):t('멈춤');hold.toggleAttribute('data-paused',film.paused);hold.setAttribute('aria-label',holdName(kind,film.paused));}"),'the button reads the clip’s state, not only its events — word, mark and name together');
  assert.ok(flow.includes("if(!reduced())film.play().catch(()=>{}).finally(()=>syncHold(film));else syncHold(film);play(film,"),'swapping the example film (which pauses it without an event) re-reads the state');
  assert.ok(flow.includes("const film=$('[data-win-film]');if(film&&!reduced())film.play().catch(()=>{}).finally(()=>syncHold(film));return;}"),'the example film’s first paint re-reads the state too (blocked autoplay)');
  assert.ok(flow.includes("mon.addEventListener('play',holdLabel,true);mon.addEventListener('pause',holdLabel,true);"),'the button names what it will do next, whatever started or stopped the clip');
  assert.ok(css.includes('.sx-casting-lead:not(.has-film) .sx-film-hold{display:none}'),'no pause button over a photo');
  assert.ok(css.includes('.sx-casting-lead.has-film figcaption{max-width:calc(100% - 104px)}'),'the name strip wraps before it reaches the button (long English names on 320–360 phones)');
  assert.match(css,/\.sx-film-hold\{position:absolute;right:10px;bottom:10px;z-index:3;[^}]*border:1px solid var\(--sx-faint\);/,'the button stands off the corner with a frame, so it does not read as the next tile’s name label');
  assert.ok(css.includes('.sx-film-hold[data-paused]::before{border:0;width:9px;background:currentColor;clip-path:polygon(0 0,100% 50%,0 100%)}'),'pause bars turn into a play mark');
  assert.ok(css.includes('.sx-q-view>.sx-film-hold{right:var(--sx-m);bottom:var(--sx-m)}'));
  assert.ok(css.includes('  .sx-q[data-step=feel] .sx-q-cap{max-width:calc(100% - 2*var(--sx-m) - 96px)}'),'on phones the example caption folds before the button on the same row instead of covering it');
});

test('public app files name no internal checklist or repository tool — a customer can read them with view-source',async()=>{
  const {readdirSync}=await import('node:fs');
  const files=readdirSync(appDir,{recursive:true}).map(String).filter(name=>/\.(mjs|js|css|html|webmanifest)$/.test(name));
  assert.ok(files.length>30);
  for(const name of files)assert.doesNotMatch(read(appDir,name.split('\\').join('/')),/슬롭 점검표|점검표 \d|tools\/[^\s'"`]+\.(?:mjs|js|cjs|py)/,name);
});
