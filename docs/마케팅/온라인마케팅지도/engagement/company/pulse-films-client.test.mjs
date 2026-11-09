import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FINISHED_FILMS,filmsView,hasFinishedFilms,featuredFilmsView} from './public/pulse-app/films-view.mjs';
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

// 11-09 작품 최신화(docs/마케팅/PULSE_포트폴리오_제작준비_20261012/진열): 확정 · 맹검 통과 판만 잘 나온 차례로 맨 앞에 둔다 — 앞 넷(featured)은 첫 화면 쇼릴과 목록에 보인다.
// 霜の肌理(11-06 옛 이름 유리결 — id · 파일 이름은 옛 로마자 그대로)는 일곱째, 매진 임박은 11-05에 다시 구운 1분 15초 판으로 바이트를 바꿨다. 공모 작품이 아니라 가상 브랜드로 만든 자체 작품이다(캐스팅북 소개 영상만 우리 서비스 영상).
// [id, kind, title, 파일 이름, 길이, 세로, featured, 출연, 구분, 포스터 sha256, 본편 sha256]
const OWN=[
  ['dodam-heavy','film','이 아이를 보냅니다','dodam-heavy','1분 1초',undefined,true,'준호','가상 브랜드로 만든 자체 작품','6dc8a4c252880328743db47891922aabf6707650903fef7a9d9aa2df005d86c7','a65bbd6fc005abc2148422b4ce9c38620d305013e3dc103099d42a52c8638623'],
  ['omitok-court','ad','치익이 톡이 될 때까지','omitok-court','15초','portrait',true,'한결','가상 브랜드로 만든 자체 작품','30dc4fdc14b9c8feac86d6678d66741cad51ad046af86b25b64c688ffc044e49','c25364f84fff7670818bdf40b6f8b6a5c826fc3a859abc42bf7e437ae8a2256f'],
  ['maejin-imbak','ad','매진 임박','maejin-imbak','1분 15초',undefined,true,undefined,'가상 브랜드로 만든 자체 작품','aec527e98d8c198fa731b588aa1ec080b8ce742493a4e35daaac09cc105c8702','ffc6976851c90ed36935f6125db2ab40086512a19bd4566f5c5b33809616eaa0'],
  ['modu-course','ad','가는 데마다 또 그 사람','modu-course','39초','portrait',true,'유호','가상 브랜드로 만든 자체 작품','e5ace5e16f44285b268beb85708a2d2ca270dcd229f41343bda43d60b092c77a','1c3c64ce25d7ee012f2ebc3786a0c977287ea26b298a7876ead13f046e496b1c'],
  ['somchae-room','ad','연말 빈방','somchae-room','1분',undefined,undefined,'은정 · 지유','가상 브랜드로 만든 자체 작품','c3382687441f2cf543a9cd4d2e6249249c22219ab1287a0a3ec3f2ff771349d9','2fcedce422ce11c05f7315f23c8b3b76c8eebf4e0e645b01b73e27342cf23558'],
  ['cheombeong-dang','ad','첨벙댕','cheombeong-dang','26초','portrait',undefined,undefined,'가상 브랜드로 만든 자체 작품','619678febaeec97d24dd60e70ba1cd267832559d635152f60382f73e0c69862d','68027ff12f3d1e434ff3c48d55691d7257dd46848aea1282cf560809979095c1'],
  ['yurigyeol-holiday','ad','霜の肌理','yurigyeol-holiday','15초','portrait',undefined,undefined,'가상 브랜드로 만든 자체 작품','6347222fa25e92998a7f79e0a3284482c0533380c2af2dc4028dc4c04ca6482a','f0dc4ef3b0992ea7357964540d229b82d3a117e62bc9d6e5bcd4890b9233adf1'],
  ['neujimak-sniper','ad','블프 스나이퍼','neujimak-sniper','33초',undefined,undefined,'준호','가상 브랜드로 만든 자체 작품','58751409481c421eed6143bb6108be264aa04a96a91d205fd02fb7ef46f12756','59c4b798a27a8f9205da516442774624eea447c1c507e5778571250cd1f6f372'],
  ['himkkeot-sale','ad','오늘 자정까지 70%','himkkeot-sale','15초','portrait',undefined,'채원','가상 브랜드로 만든 자체 작품','637b35e5838b14db0596898483388565e29bbf35578f5216178820edd6c5c3be','40b89d3386ff8ae5798449dc61e4e6f0b6564c00029931f085285fb87169d3ac'],
  ['castingbook-intro','ad','손님을 부르는 모델','castingbook-intro','30초',undefined,undefined,undefined,'SYNK PULSE 캐스팅북 소개 영상','e167b6dd876ed4cd0a9730209142b4d797f51b2d757d151bd417adafab90077f','b9bd4298c6f6f97542979dc0bf875ab213ce88d334b625a272dd044f20906961'],
  ['omitok-pour','ad','오미톡','omitok-pour','13초','portrait',undefined,undefined,'가상 브랜드로 만든 자체 작품','ee9f678922bd3791e6db39dad172e546035e345c1ae159ab6b9024ee4b76f3da','b51be97c9442d64f71a70f6c7875e499a84d816158d3b88f6c70acccd1087bdf'],
];
const N=OWN.length;

test('the finished films list opens with our own films in their showing order, then the three Hwaseong films and the founder music video, with exact media paths and bytes',async t=>{
  assert.deepEqual(FINISHED_FILMS.map(film=>film.id),[...OWN.map(row=>row[0]),'hwaseong-light','hwaseong-first','hwaseong-koriyo','happy-happy-gangster']);
  const media=[];
  for(const [index,[id,kind,title,name,duration,orientation,featured,cast,origin,posterDigest,fullDigest]]of OWN.entries()){
    const film=FINISHED_FILMS[index];
    assert.deepEqual({id:film.id,kind:film.kind,title:film.title,orientation:film.orientation,featured:film.featured,poster:film.poster,excerpt:film.excerpt,full:film.full,entry:film.entry,cast:film.cast,origin:film.origin,finished:film.finished},{
      id,kind,title,orientation,featured,poster:`./assets/films/${name}-poster-v1.webp`,excerpt:undefined,full:{src:`./assets/films/${name}-v1.mp4`,duration},
      entry:undefined,cast,origin,finished:'2026년 11월',
    });
    media.push([film.poster,posterDigest],[film.full.src,fullDigest]);
  }
  for(const [index,[id,kind,title,name,duration,orientation,posterDigest,fullDigest]]of HWASEONG.entries()){
    const film=FINISHED_FILMS[index+N];
    assert.deepEqual({id:film.id,kind:film.kind,title:film.title,orientation:film.orientation,poster:film.poster,excerpt:film.excerpt,full:film.full,entry:film.entry,finished:film.finished},{
      id,kind,title,orientation,poster:`./assets/films/${name}-poster-v1.webp`,excerpt:undefined,full:{src:`./assets/films/${name}-v1.mp4`,duration},
      entry:'2026 별별화성 Awards(화성특례시 공모전)',finished:'2026년 10월',
    });
    media.push([film.poster,posterDigest],[film.full.src,fullDigest]);
  }
  assert.deepEqual(FINISHED_FILMS.slice(N,N+3).map(film=>film.credits),[[MARK],[MARK,'통계 화성시 인구현황(2026년 9월, 외국인 포함)'],['캐릭터 코리요 · 화성특례시(공공누리 제1유형)',MARK]]);
  const film=FINISHED_FILMS[N+3],base='./assets/casting/video/M03-mv-happy-gangster-';
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
  const html=filmsView(),films=FINISHED_FILMS,mv=films.at(-1);
  assert.equal((html.match(/<article class="film-card[ "]/g)||[]).length,films.length);
  const players=Array.from(html.matchAll(/<video\b[^>]*>/g),match=>match[0]);
  assert.deepEqual(players,[
    ...films.slice(0,-1).map(film=>`<video controls playsinline preload="none" data-film-player poster="${film.poster}" src="${film.full.src}" aria-label="${film.title} · ${film.full.duration}">`),
    `<video controls playsinline preload="none" data-film-player poster="${mv.poster}" src="${mv.excerpt.src}" aria-label="Happy, Happy Gangster · 20초 발췌">`,
  ]);
  // 세로 작품만 세로 카드로 그린다.
  assert.deepEqual(Array.from(html.matchAll(/<article class="([^"]+)" aria-labelledby="([^"]+)">/g),match=>[match[2],match[1]]),[
    ['film-dodam-heavy','film-card'],['film-omitok-court','film-card film-card--portrait'],['film-maejin-imbak','film-card'],['film-modu-course','film-card film-card--portrait'],['film-somchae-room','film-card'],['film-cheombeong-dang','film-card film-card--portrait'],['film-yurigyeol-holiday','film-card film-card--portrait'],['film-neujimak-sniper','film-card'],['film-himkkeot-sale','film-card film-card--portrait'],['film-castingbook-intro','film-card'],['film-omitok-pour','film-card film-card--portrait'],['film-hwaseong-light','film-card'],['film-hwaseong-first','film-card film-card--portrait'],['film-hwaseong-koriyo','film-card'],['film-happy-happy-gangster','film-card'],
  ]);
  assert.deepEqual(Array.from(html.matchAll(/<span class="eyebrow ko">([^<]+)<\/span><h2 id="([^"]+)">([^<]+)<\/h2>/g),match=>match.slice(1)),[
    ['브랜드 필름','film-dodam-heavy','이 아이를 보냅니다'],['광고','film-omitok-court','치익이 톡이 될 때까지'],['광고','film-maejin-imbak','매진 임박'],['광고','film-modu-course','가는 데마다 또 그 사람'],['광고','film-somchae-room','연말 빈방'],['광고','film-cheombeong-dang','첨벙댕'],['광고','film-yurigyeol-holiday','霜の肌理'],['광고','film-neujimak-sniper','블프 스나이퍼'],['광고','film-himkkeot-sale','오늘 자정까지 70%'],['광고','film-castingbook-intro','손님을 부르는 모델'],['광고','film-omitok-pour','오미톡'],['광고','film-hwaseong-light','1억 년의 빛'],['숏폼','film-hwaseong-first','화성에서 처음'],['CM송','film-hwaseong-koriyo','코리요와 화성 한 바퀴'],['뮤직비디오','film-happy-happy-gangster','Happy, Happy Gangster'],
  ]);
  for(const film of films)assert.ok(html.includes(`<p>${film.description}</p>`),film.id);
  assert.ok(html.includes('<dl class="film-facts"><div><dt>길이</dt><dd>15초</dd></div><div><dt>구분</dt><dd>가상 브랜드로 만든 자체 작품</dd></div><div><dt>완성</dt><dd>2026년 11월</dd></div></dl>'));
  assert.ok(html.includes('<dl class="film-facts"><div><dt>길이</dt><dd>1분 1초</dd></div><div><dt>출연</dt><dd>준호</dd></div><div><dt>구분</dt><dd>가상 브랜드로 만든 자체 작품</dd></div><div><dt>완성</dt><dd>2026년 11월</dd></div></dl>'));
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
  // 11-04 소개글: 「같은 얼굴」 약속을 쓰지 않는다(「같은 모델」).
  assert.doesNotMatch(html,/같은 얼굴/);assert.ok(mv.description.includes('같은 모델로 이어져요'));
});

test('the entry page shows only the four featured own films, playing in place with no autoplay, and only safe media paths',()=>{
  const html=featuredFilmsView();
  assert.deepEqual(Array.from(html.matchAll(/<article class="([^"]+)"><video controls playsinline preload="none" data-film-player poster="([^"]+)" src="([^"]+)" aria-label="([^"]+)"><\/video><h3>([^<]+)<\/h3>/g),match=>match.slice(1)),[
    ['welcome-work','./assets/films/dodam-heavy-poster-v1.webp','./assets/films/dodam-heavy-v1.mp4','이 아이를 보냅니다 · 1분 1초','이 아이를 보냅니다'],
    ['welcome-work welcome-work--portrait','./assets/films/omitok-court-poster-v1.webp','./assets/films/omitok-court-v1.mp4','치익이 톡이 될 때까지 · 15초','치익이 톡이 될 때까지'],
    ['welcome-work','./assets/films/maejin-imbak-poster-v1.webp','./assets/films/maejin-imbak-v1.mp4','매진 임박 · 1분 15초','매진 임박'],
    ['welcome-work welcome-work--portrait','./assets/films/modu-course-poster-v1.webp','./assets/films/modu-course-v1.mp4','가는 데마다 또 그 사람 · 39초','가는 데마다 또 그 사람'],
  ]);
  assert.doesNotMatch(html,/autoplay|\bloop\b|preload="auto"|hwaseong|gangster/i);
  assert.equal(featuredFilmsView([{...FINISHED_FILMS[0],full:{src:'javascript:alert(1)',duration:'1초'}}]),'<div class="welcome-work-grid"></div>');
  assert.equal(featuredFilmsView(FINISHED_FILMS.filter(film=>!film.featured)),'<div class="welcome-work-grid"></div>');
  assert.doesNotMatch(featuredFilmsView([{...FINISHED_FILMS[0],title:'<img src=x onerror=alert(1)>',description:'<script>'}]),/<img src=x|<script>/);
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
  return {id:'p',revision:3,title:'霜の肌理 15초 광고',customerName:'霜の肌理',ownerName:'김하늘',stage:'planning',dueDate:'2026-10-31',versions:[],messages:[{id:'m1',author:'staff',authorName:'김하늘',action:'reply',text:'안녕하세요.',at}],
    studio:{preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[],strategy:{revision:1,data:{castingSelection:{modelId:'F02'}}}}};
}
const state=(over={})=>({mode:'customer',tab:'overview',project:project(),workflow:[],...over});

test('the step line carries one finished films entry apart from the six steps',()=>{
  for(const tab of ['overview',...tabs.map(t=>t[0]),'films']){
    const customer=projectView(state({tab}));
    // 단계 줄 바깥에 하나 + 제작 설계에서는 모델·스타일 칸 머리의 「완성 광고 보기」 하나.
    assert.equal((customer.match(/data-action="tab" data-tab="films"/g)||[]).length,tab==='strategy'?2:1,tab);
    assert.match(customer,/<div class="sx-steps-foot sx-small"><button type="button" class="[^"]*" data-action="tab" data-tab="films"/,tab);
    assert.equal((customer.match(/class="sx-step[ "]/g)||[]).length,7,'현황과 여섯 단계만 센다: '+tab);
    const html=projectView(state({tab,mode:'staff',canEdit:true}));
    // 직원 화면: 레일·휴대폰 목록 둘 + 제작 설계에서는 모델·스타일 칸 머리의 「완성 광고 보기」 하나.
    assert.equal((html.match(/data-action="tab" data-tab="films"/g)||[]).length,tab==='strategy'?3:2,tab);
    assert.equal((html.match(/<p class="rail-label">SYNK 작품<\/p><button type="button" class="rail-home rail-films" data-action="tab" data-tab="films" aria-current="(?:page|false)">/g)||[]).length,2,tab);
    assert.match(html,new RegExp(`data-tab="films" aria-current="${tab==='films'?'page':'false'}"`),tab);
    // 진행 막대·단계 끝 수는 여섯 단계만 센다.
    assert.equal((html.match(/<span class="mstep-bar" aria-hidden="true">(?:<i[^>]*><\/i>){6}<\/span>/g)||[]).length,1,tab);
  }
});

test('the customer films page lists every film by name and opens it in the screening room, with no project tools, confirmation or schedule blocks',()=>{
  const customer=projectView(state({tab:'films'}));
  assert.match(customer,/<h1 class="sx-display">SYNK가 끝까지 만든 광고예요<\/h1>/);
  assert.equal((customer.match(/class="sx-film-row" data-film-open="/g)||[]).length,FINISHED_FILMS.length);
  assert.match(customer,/data-film-poster src="\.\/assets\/films\/dodam-heavy-poster-v1\.webp"/);
  assert.match(customer,/공모전 출품작/);assert.match(customer,/가상 브랜드로 만든 자체 작품/);
  assert.doesNotMatch(customer,/refresh-button|staff-note|confirmation-scope|schedule-|casting-configurator|<form/);
});
test('the staff films page has its own head, the next step and the film list, and no project tools, confirmation or schedule blocks',()=>{
  for(const mode of ['staff']){
    const html=projectView(state({tab:'films',mode,canEdit:true}));
    assert.match(html,/<section class="tab-panel" data-current-tab="films"/);
    assert.match(html,/<header class="canvas-head"><div class="canvas-copy"><p class="canvas-kicker">완성 광고<\/p><h1>SYNK가 끝까지 <span>만든 광고예요\.<\/span><\/h1><p class="canvas-lead">기획부터 마지막 편집까지 마친 작품만 모았어요\. 새 광고가 완성되면 여기에 더해요\.<\/p><\/div><\/header>/,mode);
    assert.equal((html.match(/<section class="next-decision">/g)||[]).length,1,mode);
    assert.equal((html.match(/<article class="film-card[ "]/g)||[]).length,FINISHED_FILMS.length,mode);
    assert.match(html,/<div class="stage-content" data-stage-content><div class="film-list">/,mode);
    assert.doesNotMatch(html,/refresh-button|staff-note|confirmation-scope|schedule-|casting-configurator|<form/,mode);
    // 휴대폰 단계 머리는 「현황」이 아니라 지금 있는 공간을 보인다.
    assert.match(html,/<summary><span class="mstep-no is-home"><svg[^>]*>[\s\S]*?<\/svg><\/span><span class="mstep-txt"><b>완성 광고<\/b><small>SYNK가 끝까지 만든 광고<\/small><\/span>/,mode);
  }
});

test('live refresh waits while a film excerpt plays, and the offline shell caches the films module instead of the withdrawn plan module',()=>{
  const app=readFileSync(new URL('app.mjs',appDir),'utf8'),sw=readFileSync(new URL('sw.js',appDir),'utf8');
  assert.match(app,/Array\.from\(document\.querySelectorAll\('\[data-preview-test\],\[data-film-player\]'\)\)\.some\(video=>!video\.paused&&!video\.ended\)/);
  assert.match(sw,/const CACHE = 'synk-pulse-shell-v33-i18n-20261109';/);
  assert.match(sw,/'casting-catalog\.mjs','films-view\.mjs',/);
  assert.doesNotMatch(sw,/production-catalog/);
});
