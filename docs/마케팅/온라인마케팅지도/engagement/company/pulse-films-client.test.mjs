import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FINISHED_FILMS,filmsView,hasFinishedFilms} from './public/pulse-app/films-view.mjs';
import {projectView,tabs} from './public/pulse-app/views.mjs';

// 10-22 완성 광고(유호님): 모델별 참고 영상을 거두고, SYNK가 끝까지 만든 광고만 모델과 따로 앱 안 공간(레일 「완성 광고」)에 모은다.
globalThis.location=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
// 출시 영상(*.mp4)은 .gitignore라 공용 작업본에만 있다 — CI 체크아웃에서는 그 파일만 빼고 재고, 뺀 것을 진단으로 남긴다.
const present=(t,src)=>{if(!process.env.CI||!/\.mp4$/.test(src)||existsSync(new URL(src,appDir)))return true;t.diagnostic(`CI 체크아웃에는 없다 — public/pulse-app/${src.slice(2)} (git 밖 출시 영상)`);return false;};

test('the finished films list holds only the founder music video, with the moved media paths and exact bytes',async t=>{
  assert.equal(FINISHED_FILMS.length,1);
  const [film]=FINISHED_FILMS,base='./assets/casting/video/M03-mv-happy-gangster-';
  assert.deepEqual({id:film.id,kind:film.kind,title:film.title,poster:film.poster,excerpt:film.excerpt,full:film.full,cast:film.cast,finished:film.finished},{
    id:'happy-happy-gangster',kind:'music-video',title:'Happy, Happy Gangster',poster:base+'poster-v1.webp',
    excerpt:{src:base+'excerpt-20s-v1.mp4',duration:'20초'},full:{src:base+'full-v1.mp4',duration:'3분 18초'},cast:'유호 · M03',finished:'2026년 10월',
  });
  assert.equal(hasFinishedFilms(),true);
  for(const [src,digest]of [[film.poster,'cab9f663ca559534948325e96b80ccc41e840ae5665472e39bdbc19f6fd46e50'],[film.excerpt.src,'76c4e87d6002e3d0aa328a12b57d2601b792c980f0814e30fdf6d48689354dba'],[film.full.src,'583b940e21845b621a68a68730074be181b1bb4e0d57844a48da602192ac4c6d']].filter(([src])=>present(t,src))){
    const bytes=await readFile(new URL(src,appDir));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,src);
  }
});

test('a film card plays a poster-first excerpt on click and opens the full film in a new tab, with no autoplay or empty slots',()=>{
  const html=filmsView(),[film]=FINISHED_FILMS;
  assert.equal((html.match(/<article class="film-card"/g)||[]).length,1);
  const players=Array.from(html.matchAll(/<video\b[^>]*>/g),match=>match[0]);
  assert.deepEqual(players,[`<video controls playsinline preload="none" data-film-player poster="${film.poster}" src="${film.excerpt.src}" aria-label="Happy, Happy Gangster · 20초 발췌">`]);
  assert.match(html,/<article class="film-card" aria-labelledby="film-happy-happy-gangster">/);
  assert.match(html,/<span class="eyebrow ko">뮤직비디오<\/span><h2 id="film-happy-happy-gangster">Happy, Happy Gangster<\/h2>/);
  assert.ok(html.includes(`<p>${film.description}</p>`));
  assert.match(html,/<dl class="film-facts"><div><dt>본편<\/dt><dd>3분 18초<\/dd><\/div><div><dt>출연<\/dt><dd>유호 · M03<\/dd><\/div><div><dt>완성<\/dt><dd>2026년 10월<\/dd><\/div><\/dl>/);
  assert.ok(html.includes(`<a class="film-full" href="${film.full.src}" target="_blank" rel="noopener noreferrer">본편 보기 · 3분 18초 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`));
  assert.doesNotMatch(html,/autoplay|\bloop\b|preload="auto"|src=""|곧 공개|준비 중|제작 중|coming soon/i);
});

test('only finished films with safe media paths are drawn; an empty list hides the space',()=>{
  const film=FINISHED_FILMS[0];
  for(const bad of ['javascript:alert(1)','https://example.test/a.mp4','./assets/casting/video/../private.mp4','./assets/casting/video/a.mp4" onerror="alert(1)','./assets/films/sub/a.mp4','./assets/casting/a.mp4']){
    const html=filmsView([{...film,poster:bad,excerpt:{src:bad,duration:'20초'},full:{src:bad,duration:'3분'}}]);
    assert.doesNotMatch(html,/<article|<video|<a |javascript:|example\.test|onerror/,bad);
  }
  assert.match(filmsView([{...film,poster:'./assets/films/new-poster.webp',excerpt:{src:'./assets/films/new-excerpt.mp4',duration:'15초'},full:{src:'./assets/films/new-full.mp4',duration:'1분'}}]),/src="\.\/assets\/films\/new-excerpt\.mp4"/);
  assert.equal(filmsView([]),'<div class="film-list"></div>');
  assert.equal(hasFinishedFilms([]),false);
  assert.equal(hasFinishedFilms([{...film,excerpt:{src:'javascript:x'},full:{src:'javascript:x'}}]),false);
  const unsafeTitle=filmsView([{...film,id:'x"><b',title:'<img src=x onerror=alert(1)>',description:'<script>',cast:'<i>'}]);
  assert.doesNotMatch(unsafeTitle,/<img src=x|<script>|<i>|"><b/);
});

const at='2026-10-16T09:00:00Z';
function project(){
  return {id:'p',revision:3,title:'모루 드립백 15초 광고',customerName:'모루 커피',ownerName:'김하늘',stage:'planning',dueDate:'2026-10-31',versions:[],messages:[{id:'m1',author:'staff',authorName:'김하늘',action:'reply',text:'안녕하세요.',at}],
    studio:{preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[],strategy:{revision:1,data:{castingSelection:{modelId:'F02'}}}}};
}
const state=(over={})=>({mode:'customer',tab:'overview',project:project(),workflow:[],...over});

test('the rail and the folding phone list carry one finished films entry below the six steps, outside step progress',()=>{
  for(const tab of ['overview',...tabs.map(t=>t[0]),'films']){
    const html=projectView(state({tab}));
    // 레일·휴대폰 목록 둘 + 제작 설계에서는 모델·스타일 칸 머리의 「완성 광고 보기」 하나.
    assert.equal((html.match(/data-action="tab" data-tab="films"/g)||[]).length,tab==='strategy'?3:2,tab);
    assert.equal((html.match(/<p class="rail-label">SYNK 작품<\/p><button type="button" class="rail-home rail-films" data-action="tab" data-tab="films" aria-current="(?:page|false)">/g)||[]).length,2,tab);
    assert.match(html,new RegExp(`data-tab="films" aria-current="${tab==='films'?'page':'false'}"`),tab);
    // 진행 막대·단계 끝 수는 여섯 단계만 센다.
    assert.equal((html.match(/<span class="mstep-bar" aria-hidden="true">(?:<i[^>]*><\/i>){6}<\/span>/g)||[]).length,1,tab);
  }
});

test('the films page has its own head, the next step and the film list, and no project tools, confirmation or schedule blocks',()=>{
  for(const mode of ['customer','staff']){
    const html=projectView(state({tab:'films',mode,canEdit:true}));
    assert.match(html,/<section class="tab-panel" data-current-tab="films"/);
    assert.match(html,/<header class="canvas-head"><div class="canvas-copy"><p class="canvas-kicker">완성 광고<\/p><h1>SYNK가 끝까지 <span>만든 광고예요\.<\/span><\/h1><p class="canvas-lead">기획부터 마지막 편집까지 마친 작품만 모았어요\. 새 광고가 완성되면 여기에 더해요\.<\/p><\/div><\/header>/,mode);
    assert.equal((html.match(/<section class="next-decision">/g)||[]).length,1,mode);
    assert.equal((html.match(/<article class="film-card"/g)||[]).length,1,mode);
    assert.match(html,/<div class="stage-content" data-stage-content><div class="film-list">/,mode);
    assert.doesNotMatch(html,/refresh-button|staff-note|confirmation-scope|schedule-|casting-configurator|<form/,mode);
    // 휴대폰 단계 머리는 「현황」이 아니라 지금 있는 공간을 보인다.
    assert.match(html,/<summary><span class="mstep-no is-home"><svg[^>]*>[\s\S]*?<\/svg><\/span><span class="mstep-txt"><b>완성 광고<\/b><small>SYNK가 끝까지 만든 광고<\/small><\/span>/,mode);
  }
});

test('live refresh waits while a film excerpt plays, and the offline shell caches the films module instead of the withdrawn plan module',()=>{
  const app=readFileSync(new URL('app.mjs',appDir),'utf8'),sw=readFileSync(new URL('sw.js',appDir),'utf8');
  assert.match(app,/Array\.from\(document\.querySelectorAll\('\[data-preview-test\],\[data-film-player\]'\)\)\.some\(video=>!video\.paused&&!video\.ended\)/);
  assert.match(sw,/const CACHE = 'synk-pulse-shell-v21-photos-films-20261022';/);
  assert.match(sw,/'casting-catalog\.mjs','films-view\.mjs',/);
  assert.doesNotMatch(sw,/production-catalog/);
});
