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

// 10-22 화성 세 편(부모 세션 전달, 유호님이 꼽은 화성 홍보영상): 「2026 별별화성 Awards」 제출본의 웹판 — 끝 출처 카드 대신 로고 장면, 소리는 그대로.
const HWASEONG=[
  ['hwaseong-light','ad','1억 년의 빛','hwaseong-cf-light','55초',undefined,'2529893f1b7b95c519eb290782454d4c04c93dd83f97a8363ef4c4e827568e03','5ce2d88259c184cb668d5454bbb6f618432b95dec7ad0a7e10e0d03fd057c443'],
  ['hwaseong-first','short','화성에서 처음','hwaseong-short-first','40초','portrait','56a3763ef400ae50ee8b5e5189441146d2b38bfacdb6b8c1f5b06af96aa3fe3c','9da7a150cd747f74973b06177c42d94f426ec01c7bf1f1ebc1865b2a173b4f74'],
  ['hwaseong-koriyo','song','코리요와 화성 한 바퀴','hwaseong-cm-song','51초',undefined,'0e5bb5d1f300e386af90f0666d7f96fefbfdd98c46657e3a5735ce5eecfa20a4','13761813e14bea4b6211953db1912ea832f84a8afd802eb9f792852ba65da69c'],
];
const MARK='로고·슬로건 화성특례시 「화성의 상징」(공공누리 제4유형)';

test('the finished films list holds the three Hwaseong films and the founder music video, with exact media paths and bytes',async t=>{
  assert.deepEqual(FINISHED_FILMS.map(film=>film.id),['hwaseong-light','hwaseong-first','hwaseong-koriyo','happy-happy-gangster']);
  const media=[];
  for(const [index,[id,kind,title,name,duration,orientation,posterDigest,fullDigest]]of HWASEONG.entries()){
    const film=FINISHED_FILMS[index];
    assert.deepEqual({id:film.id,kind:film.kind,title:film.title,orientation:film.orientation,poster:film.poster,excerpt:film.excerpt,full:film.full,entry:film.entry,finished:film.finished},{
      id,kind,title,orientation,poster:`./assets/films/${name}-poster-v1.webp`,excerpt:undefined,full:{src:`./assets/films/${name}-v1.mp4`,duration},
      entry:'2026 별별화성 Awards(화성특례시 공모전)',finished:'2026년 10월',
    });
    media.push([film.poster,posterDigest],[film.full.src,fullDigest]);
  }
  assert.deepEqual(FINISHED_FILMS.slice(0,3).map(film=>film.credits),[[MARK],[MARK,'통계 화성시 인구현황(2026년 9월, 외국인 포함)'],['캐릭터 코리요 · 화성특례시(공공누리 제1유형)',MARK]]);
  const film=FINISHED_FILMS[3],base='./assets/casting/video/M03-mv-happy-gangster-';
  assert.deepEqual({id:film.id,kind:film.kind,title:film.title,poster:film.poster,excerpt:film.excerpt,full:film.full,cast:film.cast,finished:film.finished},{
    id:'happy-happy-gangster',kind:'music-video',title:'Happy, Happy Gangster',poster:base+'poster-v1.webp',
    excerpt:{src:base+'excerpt-20s-v1.mp4',duration:'20초'},full:{src:base+'full-v1.mp4',duration:'3분 18초'},cast:'유호 · M03',finished:'2026년 10월',
  });
  media.push([film.poster,'cab9f663ca559534948325e96b80ccc41e840ae5665472e39bdbc19f6fd46e50'],[film.excerpt.src,'76c4e87d6002e3d0aa328a12b57d2601b792c980f0814e30fdf6d48689354dba'],[film.full.src,'583b940e21845b621a68a68730074be181b1bb4e0d57844a48da602192ac4c6d']);
  assert.equal(hasFinishedFilms(),true);
  for(const [src,digest]of media.filter(([src])=>present(t,src))){
    const bytes=await readFile(new URL(src,appDir));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,src);
  }
});

test('short films play in full inside their card and only the long music video keeps an excerpt with a new-tab full film, with no autoplay or empty slots',()=>{
  const html=filmsView(),films=FINISHED_FILMS,mv=films[3];
  assert.equal((html.match(/<article class="film-card[ "]/g)||[]).length,4);
  const players=Array.from(html.matchAll(/<video\b[^>]*>/g),match=>match[0]);
  assert.deepEqual(players,[
    ...films.slice(0,3).map(film=>`<video controls playsinline preload="none" data-film-player poster="${film.poster}" src="${film.full.src}" aria-label="${film.title} · ${film.full.duration}">`),
    `<video controls playsinline preload="none" data-film-player poster="${mv.poster}" src="${mv.excerpt.src}" aria-label="Happy, Happy Gangster · 20초 발췌">`,
  ]);
  // 세로 숏폼만 세로 카드로 그린다.
  assert.deepEqual(Array.from(html.matchAll(/<article class="([^"]+)" aria-labelledby="([^"]+)">/g),match=>[match[2],match[1]]),[
    ['film-hwaseong-light','film-card'],['film-hwaseong-first','film-card film-card--portrait'],['film-hwaseong-koriyo','film-card'],['film-happy-happy-gangster','film-card'],
  ]);
  assert.deepEqual(Array.from(html.matchAll(/<span class="eyebrow ko">([^<]+)<\/span><h2 id="([^"]+)">([^<]+)<\/h2>/g),match=>match.slice(1)),[
    ['광고','film-hwaseong-light','1억 년의 빛'],['숏폼','film-hwaseong-first','화성에서 처음'],['CM송','film-hwaseong-koriyo','코리요와 화성 한 바퀴'],['뮤직비디오','film-happy-happy-gangster','Happy, Happy Gangster'],
  ]);
  for(const film of films)assert.ok(html.includes(`<p>${film.description}</p>`),film.id);
  assert.ok(html.includes('<dl class="film-facts"><div><dt>길이</dt><dd>55초</dd></div><div><dt>출품</dt><dd>2026 별별화성 Awards(화성특례시 공모전)</dd></div><div><dt>완성</dt><dd>2026년 10월</dd></div></dl>'));
  assert.ok(html.includes('<div class="film-credits"><span>출처</span><ul><li>캐릭터 코리요 · 화성특례시(공공누리 제1유형)</li><li>로고·슬로건 화성특례시 「화성의 상징」(공공누리 제4유형)</li></ul></div>'));
  assert.match(html,/<dl class="film-facts"><div><dt>본편<\/dt><dd>3분 18초<\/dd><\/div><div><dt>출연<\/dt><dd>유호 · M03<\/dd><\/div><div><dt>완성<\/dt><dd>2026년 10월<\/dd><\/div><\/dl>/);
  assert.equal((html.match(/<div class="film-credits">/g)||[]).length,3);
  const links=Array.from(html.matchAll(/<a\b[^>]*>/g),match=>match[0]);
  assert.deepEqual(links,[`<a class="film-full" href="${mv.full.src}" target="_blank" rel="noopener noreferrer">`]);
  assert.ok(html.includes('본편 보기 · 3분 18초 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>'));
  assert.doesNotMatch(html,/autoplay|\bloop\b|preload="auto"|src=""|곧 공개|준비 중|제작 중|coming soon/i);
  // 공모 제출본의 끝 출처 카드에 있던 제작 도구 이름은 카드 글로 옮기지 않는다(사이트에 도구 이름 없음, 10-02).
  assert.doesNotMatch(html,/Suno|타입캐스트|Typecast|Veo|Flow|Nano ?Banana|Omni|Google|AI 생성|AI 음성/i);
});

test('only finished films with safe media paths are drawn; an empty list hides the space',()=>{
  const film=FINISHED_FILMS.find(item=>item.id==='happy-happy-gangster');
  // 본편만 있는 작품은 그 본편을 카드에서 바로 튼다. 세로 표시는 'portrait'만 받고, 출처 글도 이스케이프한다.
  const short=filmsView([{...film,excerpt:undefined,orientation:'portrait" onclick="x',credits:['<b>출처</b>',7,'']}]);
  assert.match(short,/<article class="film-card" aria-labelledby="film-happy-happy-gangster"><div class="film-media"><video [^>]*src="\.\/assets\/casting\/video\/M03-mv-happy-gangster-full-v1\.mp4" aria-label="Happy, Happy Gangster · 3분 18초"><\/video>/);
  assert.match(short,/<div class="film-credits"><span>출처<\/span><ul><li>&lt;b&gt;출처&lt;\/b&gt;<\/li><\/ul><\/div>/);
  assert.doesNotMatch(short,/<a |onclick|<b>/);
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

// 10-31 완성 광고 규칙(app.css — a656e8705·445c1d521): 회사 이미지 안의 선택 시험이 그 규칙 바이트를 직접 읽어 단언한다. 그전에는 어떤 시험도
// .film-* 규칙을 읽지 않아 규칙 하나를 깨도 통과했다(사슬 27 도구 검수 Fable P2). 운영 판 app.css는 CRLF로 실렸다 — 줄끝만 맞춰 읽는다.
// 장면 띠의 .film·.film-empty는 제작 설계 화면(views.mjs) 몫이라 뺀다.
function cssDeclarations(body){
  const decls=new Map(),bad=[];let depth=0,quote='',from=0;
  // 한 규칙 안에 같은 속성이 두 번이면 뒤 값만 보는 단언이 앞의 !important를 놓친다 — 겹친 선언도 틀린 꼴로 센다(GPT GA1).
  const take=end=>{const part=body.slice(from,end).trim();if(!part)return;const colon=part.indexOf(':'),name=part.slice(0,colon).trim();if(colon>0&&!decls.has(name))decls.set(name,part.slice(colon+1).trim());else bad.push(part);};
  for(let i=0;i<body.length;i++){
    const c=body[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'")quote=c;else if(c==='(')depth++;else if(c===')')depth--;else if(c===';'&&!depth){take(i);from=i+1;}
  }
  take(body.length);return {decls,bad};
}
function cssRules(source){
  const css=source.replace(/\r\n/g,'\n').replace(/\/\*[\s\S]*?\*\//g,''),rules=[],open=[],tidy=text=>text.trim().replace(/\s+/g,' ').replace(/ ?> ?/g,'>');let mark=0,quote='';
  for(let i=0;i<css.length;i++){
    const c=css[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'")quote=c;
    else if(c==='{'){if(open.length)open.at(-1).nested=true;open.push({prelude:tidy(css.slice(mark,i)),from:i+1,nested:false});mark=i+1;}
    else if(c==='}'){const block=open.pop();assert.ok(block,'app.css에 짝 없는 } — '+i);if(!block.nested)rules.push({at:open.map(item=>item.prelude).join(' '),selector:block.prelude,...cssDeclarations(css.slice(block.from,i))});mark=i+1;}
    else if(c===';'&&!open.length)mark=i+1;
  }
  assert.equal(open.length,0,'app.css에 닫히지 않은 {');
  return rules;
}
// filmsView()가 그린 마크업을 요소 나무로 — 규칙마다 실제로 고르는 요소가 있는지 본다(자손 ' '·자식 '>' 결합자와 태그·클래스만).
function htmlTree(html){
  const root={tag:'#root',classes:[],children:[],parent:null},VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);let node=root;
  for(const [,close,tag,attrs]of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/g)){
    if(close){assert.equal(node.tag,tag,'닫는 태그 짝 '+tag);node=node.parent;continue;}
    const child={tag,classes:(/\bclass="([^"]*)"/.exec(attrs)?.[1]||'').split(/\s+/).filter(Boolean),children:[],parent:node};
    node.children.push(child);if(!VOID.has(tag))node=child;
  }
  assert.equal(node,root,'닫히지 않은 태그');
  return root;
}
const descendants=function*(node){for(const child of node.children){yield child;yield* descendants(child);}};
function selects(node,selector){
  const parts=selector.replace(/>/g,' > ').trim().split(/\s+/);
  const compound=(item,text)=>{const match=/^([a-z][a-z0-9]*)?((?:\.[A-Za-z0-9_-]+)*)$/.exec(text);assert.ok(match&&text,'이 시험이 읽지 못하는 선택자 '+selector);return (!match[1]||item.tag===match[1])&&match[2].split('.').filter(Boolean).every(name=>item.classes.includes(name));};
  const from=(item,index)=>{
    if(!compound(item,parts[index]))return false;if(index===0)return true;
    if(parts[index-1]==='>')return Boolean(item.parent)&&from(item.parent,index-2);
    for(let up=item.parent;up;up=up.parent)if(from(up,index-1))return true;return false;
  };
  return from(node,parts.length-1);
}
const classesIn=selector=>Array.from(selector.matchAll(/\.([A-Za-z0-9_-]+)/g),match=>match[1]);
const filmClass=name=>name.startsWith('film-')&&name!=='film-empty';

test('the finished films rules in app.css pair one to one with the cards films-view draws, keep the card layout and resolve their tokens',()=>{
  const rules=cssRules(readFileSync(new URL('app.css',appDir),'utf8')),phone='@media (max-width:860px)';
  const own=rules.filter(rule=>classesIn(rule.selector).some(filmClass));
  // 완성 광고 규칙의 목록과 순서(넓은 화면 16 · 휴대폰 3). 규칙 하나를 지우거나 선택자를 바꾸면 여기서 걸린다.
  assert.deepEqual(own.map(rule=>[rule.at,rule.selector]),[
    ...['.film-list','.film-card','.film-media video','.film-copy','.film-copy h2','.film-copy p','.film-facts','.film-facts>div','.film-facts dt','.film-facts dd','.film-full',
      '.film-credits','.film-credits>span','.film-credits ul','.film-card--portrait','.film-card--portrait .film-media video'].map(selector=>['',selector]),
    ...['.film-card','.film-full','.film-card--portrait .film-media'].map(selector=>[phone,selector]),
  ]);
  // 선언은 한 속성에 한 번씩, !important 없이 — 아래 값 단언이 실제로 이기는 값을 본다.
  for(const rule of own){assert.deepEqual(rule.bad,[],'선언 꼴이 아니거나 겹친 선언 — '+rule.selector);for(const [property,text]of rule.decls)assert.doesNotMatch(text,/!\s*important/i,`${rule.selector} ${property}`);}
  // 짝: 규칙마다 기본 목록(세로 카드·출처·본편 단추가 다 든다)에서 고르는 요소가 있고, 그리는 film- 클래스마다 규칙이 있다.
  const nodes=[...descendants(htmlTree(filmsView()))];
  for(const rule of own)assert.ok(nodes.some(node=>selects(node,rule.selector)),'그리는 요소가 없는 규칙 '+rule.selector);
  const drawn=[...new Set(nodes.flatMap(node=>node.classes))];
  assert.deepEqual(drawn.filter(filmClass).sort(),[...new Set(own.flatMap(rule=>classesIn(rule.selector)))].sort());
  // 함께 쓰는 클래스(eyebrow · ko · sr-only)도 app.css 어딘가에 규칙이 있다.
  for(const name of drawn.filter(name=>!filmClass(name)))assert.ok(rules.some(rule=>classesIn(rule.selector).includes(name)),'규칙이 없는 클래스 '+name);
  // 배치의 뼈대: 영상 큰 칸 + 글 칸, 16:9 · 세로 숏폼 300px 칸에 9:16, 860px 아래는 한 칸 · 세로 영상은 340px 안쪽 가운데 · 본편 단추는 꽉 찬 폭.
  const value=(at,selector,property)=>own.find(rule=>rule.at===at&&rule.selector===selector)?.decls.get(property);
  for(const [at,selector,property,expected]of [
    ['','.film-list','display','grid'],['','.film-card','display','grid'],['','.film-card','grid-template-columns','minmax(0,1.6fr) minmax(0,1fr)'],
    ['','.film-media video','width','100%'],['','.film-media video','aspect-ratio','16/9'],['','.film-copy','min-width','0'],
    ['','.film-credits ul','list-style','none'],['','.film-full','min-height','42px'],
    ['','.film-card--portrait','grid-template-columns','minmax(0,300px) minmax(0,1fr)'],['','.film-card--portrait .film-media video','aspect-ratio','9/16'],
    [phone,'.film-card','grid-template-columns','minmax(0,1fr)'],[phone,'.film-full','width','100%'],
    [phone,'.film-card--portrait .film-media','width','min(100%,340px)'],[phone,'.film-card--portrait .film-media','justify-self','center'],
  ])assert.equal(value(at,selector,property),expected,`${at||'넓은 화면'} ${selector} ${property}`);
  // 구체성이 같은 세 규칙은 뒤가 이긴다: 세로 카드는 기본 카드 뒤, 휴대폰 한 칸은 세로 카드 뒤 — 그래야 세로 카드도 휴대폰에서 한 칸이 된다.
  const index=(at,selector)=>rules.findIndex(rule=>rule.at===at&&rule.selector===selector);
  assert.ok(index('','.film-card')<index('','.film-card--portrait')&&index('','.film-card--portrait')<index(phone,'.film-card'));
  // 규칙이 쓰는 색·글자 토큰은 모두 app.css에 정의돼 있다(토큰 이름 한 글자가 틀리면 그 칸은 말없이 빈 값이 된다).
  const tokens=new Set(rules.flatMap(rule=>[...rule.decls.keys()].filter(name=>name.startsWith('--'))));
  for(const rule of own)for(const [property,text]of rule.decls){
    assert.match(property,/^[a-z]+(?:-[a-z]+)*$/,rule.selector);
    for(const [,token]of text.matchAll(/var\((--[A-Za-z0-9_-]+)/g))assert.ok(tokens.has(token),`${rule.selector} ${property} — 정의 없는 ${token}`);
  }
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
    assert.equal((html.match(/<article class="film-card[ "]/g)||[]).length,4,mode);
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
