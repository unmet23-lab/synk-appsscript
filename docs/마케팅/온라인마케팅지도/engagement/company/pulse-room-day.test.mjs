import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomModel,roomWord,roomDue,ROOM_COPY} from './public/pulse-app/room-view.mjs';
import {projectView} from './public/pulse-app/views.mjs';
import {roomView,roomHead,titleKey} from './public/pulse-app/film-views.mjs';
import {registerLocale,setLocale} from './public/pulse-app/i18n.mjs';
import en from './public/pulse-app/i18n/en.mjs';

// 낮 판(2026-11-20 · 유호님 「이 결로 진행」, 설계 docs/디자인/PULSE고객경험_20261120/운영설계.md):
// 고객 방(roomView)만 밝은 작업실로 그린다. 방 첫 화면에 담당자 한마디와 받으실 날을 올리고, 제목에 강조 구절 하나를 둔다.
// 서버와 판단(roomState)은 그대로다 — 여기서는 새로 더한 자료 둘(word · due)과 그리기, 낮 판을 켜고 끄는 자리를 지킨다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const NOW=Date.parse('2026-11-20T03:00:00.000Z'); // 한국 11-20 낮 12시
const at=offset=>new Date(NOW+offset*3600000).toISOString();
const video=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:at(-1),media:{url:'/pulse/api/media/'+id,mimeType:'video/mp4',fileName:id+'.mp4'},...extra});
const asset=id=>({id,mimeType:'image/png',fileName:id+'.png',url:'/pulse/api/studio/media/'+id});
const studioOf=(r,patch={})=>({assets:[asset('a1'),asset('a2')],scenes:[{id:'s1',revision:1,duration:2,description:'캔을 딴다',title:'첫 컷',visibility:'customer'}],comments:[],sceneReviews:[],strategy:{revision:1,data:{},request:null,confirmation:null},
  feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1},
  request:{status:'submitted',number:'P-1120-AB12',submittedAt:at(-200),answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[],...r},...patch});
const project=(r={},extra={},patch={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',revision:4,versions:[],messages:[],requestFlow:true,studio:studioOf(r,patch),...extra});
const state=(p,extra={})=>({mode:'customer',tab:'overview',live:{},versionId:'',project:p,...extra});
const round=(kind,extra={})=>({round:1,kind,oneLine:'한 캔에 맛이 다섯 번',scenes:[{id:'s1',revision:1}],sentAt:at(-150),...extra});
const paid=(dueDate,extra={})=>({status:'confirmed',amount:390000,requestedAt:at(-140),confirmedAt:at(-130),dueDate,...extra});
// 제작 중(저희 차례): 결제 확인 → 장면 이미지 승인(차례가 넘어온 때 = -100시간) → 그 뒤 소식 둘.
const making=(r={},extra={})=>project({status:'confirmed',scriptApprovedAt:at(-150),payment:paid('2026-11-23'),approvedAt:at(-100),rounds:[round('script',{approvedAt:at(-150)}),round('images',{round:2,approvedAt:at(-100)})],
  progress:[{id:'n0',at:at(-120),stage:'draft',text:'차례가 넘어오기 전의 소식',assets:['a1']},{id:'n1',at:at(-30),stage:'make',text:'컷 둘을 마쳤어요.',assets:['a1','a2']},{id:'n2',at:at(-2),stage:'make',text:'  내일은 끝 화면을 마무리해요.  ',assets:[]}],...r},{stage:'producing',...extra});

test('the room root keeps its pinned prefix and carries data-day; the screens that only watch stay dark',()=>{
  const room=projectView(state(making()));
  assert.match(room,/<div class="sx-room" data-state="make" data-day>/);
  // 영상 확인 · 1차안은 방 뿌리(data-day)를 그리지 않는다.
  const review=projectView(state(project({status:'confirmed',approvedAt:at(-100),rounds:[round('images',{approvedAt:at(-100)})]},{stage:'review',versions:[video('v1','1차 시안')]}),{tab:'review'}));
  assert.doesNotMatch(review,/data-day/);
  const draft=projectView(state(project({status:'confirmed',rounds:[round('script')]}),{tab:'draft'}));
  assert.doesNotMatch(draft,/data-day/);
  // CSP(style-src 'self'): 그린 글에 style 속성이 없다.
  assert.doesNotMatch(room,/\sstyle="/);
});

test('roomWord is the latest posted update since the turn came to us, pictures or not, and only on our turn',()=>{
  const p=making();
  assert.deepEqual(roomWord(p),{id:'n2',at:at(-2),text:'내일은 끝 화면을 마무리해요.'});
  assert.equal(roomModel(p).word.id,'n2');
  // 큰 그림 칸의 소식(news)은 그대로 그림이 있는 최근 것.
  assert.equal(roomModel(p).news.id,'n1');
  // 차례가 넘어오기 전의 소식만 있으면 없다.
  assert.equal(roomWord(making({progress:[{id:'n0',at:at(-120),stage:'draft',text:'앞 차례의 소식',assets:[]}]})),null);
  // 손님 차례(영상 확인)에는 없다.
  const review=making({},{stage:'review',versions:[video('v1','1차 시안')]});
  assert.equal(roomModel(review).state,'review');assert.equal(roomWord(review),null);assert.equal(roomModel(review).word,null);
  // 빈 글 · 꼴이 틀린 줄은 고르지 않는다.
  assert.equal(roomWord(making({progress:[{id:'x',at:at(-1),text:'   ',assets:[]},{id:'y',at:'어제',text:'날짜가 틀린 줄',assets:[]}]})),null);
});

test('roomDue shows only a date the payment confirmed, counts days in Korean time on our turn, and hides a past date',()=>{
  const p=making();
  assert.deepEqual(roomDue(p,'make',NOW),{date:'2026-11-23',left:3,changed:false});
  assert.deepEqual(roomDue(making({payment:paid('2026-11-23',{dueChangedAt:at(-5)})}),'make',NOW),{date:'2026-11-23',left:3,changed:true});
  // 한국 날짜로 센다: UTC 11-20 15:30은 한국 11-21 00:30이라 11-21은 오늘이다.
  assert.equal(roomDue(making({payment:paid('2026-11-21')}),'make',Date.parse('2026-11-20T15:30:00.000Z')).left,0);
  assert.equal(roomDue(making({payment:paid('2026-11-21')}),'make',Date.parse('2026-11-20T14:30:00.000Z')).left,1);
  // 손님 차례에는 날짜만(남은 날 없음).
  assert.deepEqual(roomDue(p,'review',NOW),{date:'2026-11-23',left:null,changed:false});
  // 지난 날 · 납품 · 끝 · 결제 확인 전 · 꼴이 틀린 날은 싣지 않는다.
  assert.equal(roomDue(making({payment:paid('2026-11-19')}),'make',NOW),null);
  assert.equal(roomDue(p,'deliver',NOW),null);assert.equal(roomDue(p,'done',NOW),null);
  assert.equal(roomDue(making({payment:{status:'requested',dueDate:'2026-11-23'}}),'make',NOW),null);
  assert.equal(roomDue(making({payment:paid('11월 23일')}),'make',NOW),null);
  assert.equal(roomDue(project(),'check',NOW),null);
});

test('the room draws the word as an excerpt that points to its journal row, and the due line',()=>{
  const info=roomModel(making());
  const html=roomView({...info,due:{date:'2026-11-23',left:3,changed:false}},{bar:false});
  assert.match(html,/<figure class="sx-room-say" data-room-in data-room-say><blockquote class="sx-body">내일은 끝 화면을 마무리해요\.<\/blockquote>/);
  assert.match(html,/<b>김하늘<\/b>[^]*?<button type="button" class="sx-link" data-room-do="journal" data-journal-target="n:n2">나눈 말에서 보기<\/button>/);
  assert.match(html,/<p class="sx-room-due" data-room-in data-room-due><b>3일 뒤<\/b> <span>11월 23일 월요일에 받으세요<\/span><\/p>/);
  // 오늘 · 손님 차례 · 다시 정한 날.
  assert.match(roomView({...info,due:{date:'2026-11-23',left:0,changed:true}},{bar:false}),/<b>오늘<\/b> <span>11월 23일 월요일에 받으세요<\/span> <span class="sx-small">담당자가 다시 정한 날<\/span>/);
  assert.match(roomView({...info,due:{date:'2026-11-23',left:null,changed:false}},{bar:false}),/data-room-due><span>받으실 날 11월 23일 월요일<\/span>/);
  // 없으면 그 줄을 그리지 않는다.
  const bare=roomView({...info,word:null,due:null},{bar:false});
  assert.doesNotMatch(bare,/data-room-say|data-room-due/);
  // 일지는 그 소식의 전문을 그대로 둔다(알림과 「소식 보기」가 가는 자리).
  const page=projectView(state(making()));
  assert.match(page,/data-journal-id="n:n2"[^]*?내일은 끝 화면을 마무리해요\./);
});

test('every room title has one key phrase, in Korean and in English, and it sits inside the title',async()=>{
  const table=/const TITLE_MARKS=\{([\s\S]*?)\};\r?\n\/\/ i18n-skip-end/.exec(read('film-views.mjs'))[1];
  const pairs=[...table.matchAll(/'([^']+)':'([^']+)'/g)].map(match=>[match[1],match[2]]);
  assert.ok(pairs.length>=25);
  // 상태 글 표의 제목은 모두 표에 있다(방향 고르기는 방이 아니라 방향 화면이 그린다).
  for(const [name,copy] of Object.entries(ROOM_COPY))if(name!=='direction')assert.ok(pairs.some(([title])=>title===copy.title),copy.title);
  for(const [title,mark] of pairs){assert.ok(title.includes(mark),title);assert.equal(titleKey(title),mark,title);}
  // 그리는 글의 제목은 통짜 그대로다(강조 구절은 화면에 붙일 때 감싼다 — mountRoom).
  assert.match(roomView(roomModel(making()),{bar:false}),/<h1 class="sx-display" data-room-title>확인하신 컷으로 만들고 있어요<\/h1>/);
  registerLocale('en',en);await setLocale('en');
  try{
    for(const [title] of pairs){
      const text=en[title],mark=en['mark\u0004'+title];
      assert.equal(typeof text,'string',title);assert.equal(typeof mark,'string',title);
      assert.ok(text.includes(mark),`${text} ⊅ ${mark}`);
      assert.equal(titleKey(text),mark,title);
    }
    // 표에 없는 제목에는 강조 구절이 없다.
    assert.equal(titleKey('A title that is not in the table'),'');
    // 영어 방: 받으실 날 줄이 그 언어로.
    const html=roomView({...roomModel(making()),due:{date:'2026-11-23',left:3,changed:false}},{bar:false});
    assert.match(html,/<b>In 3 days<\/b> <span>Delivery on Monday, November 23<\/span>/);
    assert.match(html,/See it in messages/);
  }finally{await setLocale('ko');}
  assert.equal(titleKey('표에 없는 제목'),'');
});

test('the shelf caption keeps its link only when its pictures belong to another update than the word card',()=>{
  // 한마디와 선반의 그림이 같은 소식이면 캡션에 단추가 없다(같은 소식으로 가는 길은 한마디의 하나). 캡션은 어느 소식의 그림인지 적는다.
  const same=projectView(state(making({progress:[{id:'n1',at:at(-30),stage:'make',text:'컷 둘을 마쳤어요.',assets:['a1','a2']}]})));
  assert.match(same,/<p class="sx-small sx-room-cap" data-room-news="n:n1"><b>작업 중인 화면이에요 · 완성본이 아니에요<\/b><\/p>/);
  assert.equal((same.match(/data-journal-target="n:n1"/g)||[]).length,1);
  assert.match(same,/data-room-say>[^]*data-journal-target="n:n1">나눈 말에서 보기<\/button>/);
  // 그림이 앞선 소식의 것이면(가장 최근 소식에는 그림이 없다) 캡션의 단추가 그 소식으로 간다.
  const other=projectView(state(making()));
  assert.match(other,/data-room-news="n:n1"><b>[^<]+<\/b> <button type="button" class="sx-link" data-room-do="journal" data-journal-target="n:n1">소식 보기<\/button><\/p>/);
  assert.match(other,/data-room-say>[^]*data-journal-target="n:n2">나눈 말에서 보기<\/button>/);
});

test('the closing card offers to ask about the next piece in the words of that product',()=>{
  const done=(pkg)=>{const p=making({answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:pkg}},{stage:'delivered',versions:[video('v1','1차 시안','preview',{approvedAt:at(-10)}),video('f1','최종본','final',{approvedPreviewId:'v1'})],closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:false,receipt:{confirmedAt:at(-1)},files:[{id:'f1',label:'최종본'}]}});return projectView(state(p));};
  const film=done('s15');
  assert.match(film,/data-state="done" data-day>/);
  assert.match(film,/<button type="button" class="sx-quiet" data-room-do="journal" data-journal-say="다음 편을 이어 만들고 싶어요\.">다음 편 묻기<\/button>/);
  const photo=done('photo');
  assert.match(photo,/data-journal-say="다음 사진을 이어 만들고 싶어요\.">다음 사진 묻기<\/button>/);
  assert.doesNotMatch(photo,/다음 편/);
  // 채우기는 묻기 칸이 비었거나 앞 단추가 채운 글 그대로일 때만(손님이 고친 글은 두고), input 사건으로 쓰던 글에 올린다(보내기는 손님이 누른다).
  const app=read('app.mjs');
  assert.match(app,/const say=ask\.dataset\.journalSay\|\|''/);
  assert.match(app,/if\(field&&\(!field\.value\.trim\(\)\|\|field\.value===journalSaid\)\)\{journalSaid=say;field\.value=say;field\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\);/);
});

test('the day look is switched on and off in one place and never leaks to other screens',()=>{
  const app=read('app.mjs'),views=read('film-views.mjs'),demo=read('demo-film.mjs'),css=read('film.css');
  // 앱: 그릴 때마다 판정한다(다른 화면으로 가면 바로 뗀다). 주소창 색도 함께.
  assert.match(app,/const day=!!main\.querySelector\('\.sx-room\[data-day\]'\);classes\.toggle\('sx-day',day\);document\.querySelector\('meta\[name="theme-color"\]'\)\?\.setAttribute\('content',day\?'#ffffff':'#000000'\);/);
  // 붙이는 화면이 방이면 달고 아니면 뗀다(예시가 같은 프로젝트 안에서 어두운 화면으로 옮겨 그릴 때도 남지 않게). 예시는 장면을 지울 때도 뗀다.
  assert.match(views,/document\.documentElement\.classList\.toggle\('sx-day',host\.matches\('\.sx-room\[data-day\]'\)\);/);
  // 재생 표는 영상 인화지의 한가운데에(칸 기준이 아니라 영상 기준 — 가로 영상에서도 영상 위에 선다).
  assert.match(views,/playMark\.style\.setProperty\('--play-x',`\$\{printed\.offsetLeft\+printed\.offsetWidth\/2\}px`\);/);
  assert.match(css,/\.sx-room-play::after\{content:'';position:absolute;left:var\(--play-x,50%\);top:var\(--play-y,44%\);/);
  assert.match(demo,/journalRelease\(\);document\.documentElement\.classList\.remove\('sx-day'\);/);
  // 강조 구절이 든 제목은 어절로 쪼개지 않는다(쪼개면 구절 표시가 지워진다).
  assert.match(views,/const roomTitle=host\.matches\('\.sx-room'\)\?host\.querySelector\('\[data-room-title\]'\):null,keyed=!!roomTitle&&host\.matches\('\[data-day\]'\)&&markTitle\(roomTitle\);/);
  assert.match(views,/if\(roomTitle\)\{if\(keyed\)rise\(roomTitle,\{delay:60\}\);else revealWords\(roomTitle,\{delay:60\}\);\}/);
  const start=css.indexOf('/* ── 낮 판 시작'),end=css.indexOf('/* ── 낮 판 끝 ── */');
  assert.ok(start>0&&end>start);
  const day=css.slice(start,end);
  // 토큰은 짝으로 바꾸고(글 · 먹색 면 위의 글), 방과 머리의 글자 칸에서만 바꾼다 — html 전체의 토큰을 바꾸지 않는다.
  assert.match(day,/\.sx-room\[data-day\],html\.sx\.sx-day:not\(\.is-staff\) :is\(\.header-crumb,\.header-actions\)\{--sx-ink:#1d1d1f;[^}]*--sx-on:#fff;/);
  assert.doesNotMatch(day,/html\.sx\.sx-day(?:,html\.sx\.sx-day body)?\{[^}]*--sx-/);
  // 종이 섬은 원래 값으로 되돌린다. 먹색 면의 굳은 글색은 덮는다.
  assert.match(day,/\.sx-room\[data-day\] \.sx-legacy\{--sx-ink:#f4f1ea;[^}]*--sx-on:#0b0b0b;/);
  assert.match(day,/\.sx-room\[data-day\] \.sx-go\.is-solid\{color:#fff\}/);
  // color-scheme은 html이 아니라 방에 둔다(방 위에 뜨는 검은 덮개의 입력 칸이 밝아지지 않게).
  assert.match(day,/\.sx-room\[data-day\]\{background:#fff;color:var\(--sx-ink\);color-scheme:light\}/);
  assert.doesNotMatch(day,/html\.sx\.sx-day[^{]*\{[^}]*color-scheme/);
  // 낮 판 규칙은 모두 방(data-day)이나 html.sx-day 아래에 있다 — 다른 화면의 규칙을 건드리지 않는다. 방 밖에서도 쓰는 새 칸(한마디 · 받으실 날 · 다음 편)만 예외.
  // 최종 검수 반영: 좁은 화면의 방 안 머리 띠는 흰색이다(먹색 글과 로고가 검은 띠 위에 놓이지 않게). 821~1180 가로 창의 머리 그늘은 없앤다.
  assert.match(day,/@media \(max-width:820px\),\(max-aspect-ratio:1\/1\)\{[^]*\.sx-room\[data-day\] \.sx-room-bar\{background:#fff\}/);
  assert.match(day,/html\.sx\.sx-day:not\(\.is-staff\) \.app-header::before\{content:none\}/);
  // 컷 인화지의 폭은 선반 위에 남는 높이에서 거꾸로 계산한다(줄 수 · 칸 수) — 낮은 창에서 그림이 캡션을 덮지 않게.
  assert.match(day,/\.sx-room\[data-day\] \.sx-room-cuts\{--cut-c:3;--cut-r:1;--cut-h:calc\(100vh - [^;]+;width:min\(100%,560px,calc\(\(var\(--cut-h\) - 24px - \(var\(--cut-r\) - 1\)\*6px\)\/var\(--cut-r\)\*9\/16\*var\(--cut-c\) \+ \(var\(--cut-c\) - 1\)\*6px \+ 24px\)\);grid-template-columns:repeat\(var\(--cut-c\),1fr\);/);
  assert.match(day,/\.sx-room\[data-day\] \.sx-room-cuts:is\(\[data-count="9"\],\[data-count="10"\],\[data-count="11"\],\[data-count="12"\]\)\{--cut-c:4;--cut-r:3\}/);
  // 데려간 줄의 강조와 자리 글은 흰 방에서 보이는 색이다.
  assert.match(day,/\.sx-room\[data-day\] :is\(\.sx-j-row,\.sx-j-ask\)\.notification-target\{background:rgba\(29,29,31,\.08\);/);
  assert.match(day,/\.sx-room\[data-day\] \.sx-field ::placeholder\{color:var\(--sx-faint\)\}/);
  // 휴대폰의 보는 차례(선반이 글보다 먼저 선다): 선반이 어두운 판의 높이(44dvh)를 넘지 않아 제목과 주 단추가 첫 화면에 남는다.
  assert.match(day,/\.sx-room\[data-day\] \.sx-room-hero\.is-preview-first>\.sx-room-screen>\.sx-q-fill\{max-height:calc\(44vh - 96px\);max-height:calc\(44dvh - 96px\)\}/);
  assert.match(day,/\.sx-room\[data-day\] \.sx-room-files:is\(\[data-count="5"\],\[data-count="6"\]\)>img\{max-height:min\(17vh,150px\);max-width:calc\(\(100% - 24px\)\/3\)\}/);
  // 다듬기(11-21): 눕힌 작은 휴대폰(가로 · 높이 480px 이하)에서만 인화지에 하한을 둔다. 세로 작은 휴대폰은 주 단추가 첫 화면에 남게 앞 값 그대로.
  const land=day.slice(day.indexOf('@media (max-width:820px) and (orientation:landscape) and (max-height:480px){'));
  assert.ok(land.length<day.length);
  assert.match(land,/\.sx-room\[data-day\] \.sx-room-cuts\{--cut-h:max\(64vh,420px\)\}/);
  assert.match(land,/>\.sx-q-fill\{max-height:max\(calc\(44vh - 96px\),170px\);max-height:max\(calc\(44dvh - 96px\),170px\)\}/);
  assert.match(land,/>img\{max-height:clamp\(110px,17vh,150px\)\}/);
  assert.doesNotMatch(day.slice(0,day.length-land.length),/96px\),170px\)|max\(64vh,420px\)|clamp\(110px/);
  // 판 안 그림 칸의 자리 색은 판(#f6f4f1)과 다르다(그림이 늦게 와도 칸이 보이게).
  assert.match(day,/\.sx-room\[data-day\] \.sx-j-shots img\{background:#ebe7e1\}/);
  // 재생 표는 먹색 판 위의 흰 세모다(밝은 영상 위에서도 보이게). 흰 방 옆 창 스크롤바는 색만 밝게 맞춘다(html의 색 구성은 그대로).
  assert.match(day,/\.sx-room-play::before\{content:'';position:absolute;left:var\(--play-x,50%\);top:var\(--play-y,44%\);width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:2px;background:rgba\(29,29,31,\.74\)\}/);
  assert.match(day,/html\.sx\.sx-day\{scrollbar-color:rgba\(29,29,31,\.34\) #fff\}\s+html\.sx\.sx-day body\{scrollbar-color:auto\}/);
  // 나눈 말: 담당자의 말과 소식은 옅은 판 위에, 누르는 것은 가는 테. 데려간 줄의 강조가 판의 바탕에 지지 않게 판 규칙은 :where로 낮춘다.
  assert.match(day,/\.sx-room\[data-day\] \.sx-journal \.sx-j-row:where\(\[data-who=staff\],\[data-who=auto\]\):where\(\.is-talk,\.is-progress\)\{margin:8px 0;padding:12px 14px;border-top:0;background:#f6f4f1;box-shadow:none\}/);
  assert.match(day,/\.sx-room\[data-day\] \.sx-journal :is\(\[data-journal-go\],\.sx-j-more,\.sx-j-filter\)\{display:inline-flex;align-items:center;min-height:32px;padding:2px 13px;border:1px solid rgba\(29,29,31,\.5\);text-decoration:none;/);
  assert.ok(day.indexOf('.sx-j-row:where([data-who=staff]')<day.indexOf(':is(.sx-j-row,.sx-j-ask).notification-target'));
  // 같은 소식은 한 번만: 선반에 선 그림은 그 줄에서 접고, 한마디가 글을 끝까지 보이면 그 줄의 글은 한 줄로.
  assert.match(day,/\.sx-room\[data-day\] \.sx-j-row\.is-on-shelf \.sx-j-shots\{display:none\}/);
  assert.match(day,/\.sx-room\[data-day\] \.sx-j-row\.is-said \.sx-j-text\{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;line-clamp:1;overflow:hidden;white-space:normal;color:var\(--sx-dim\)\}/);
  assert.match(views,/if\(host\.matches\('\.sx-room\[data-day\]'\)\)tidyEcho\(host\);/);
  // 손님이 그 줄로 가자고 한 소식(나눈 말에서 보기 · 소식 보기 · 알림)은 접지 않는다(운영설계 9절 물음 3).
  assert.match(views,/export function keepWhole\(id\)\{if\(!id\)return;wholeRows\.add\(id\);for\(const row of document\.querySelectorAll\('\.sx-j-row'\)\)if\(row\.dataset\.journalId===id\)row\.classList\.remove\('is-said','is-on-shelf'\);\}/);
  assert.match(views,/if\(shelf&&!wholeRows\.has\(shelf\.dataset\.journalId\)\)shelf\.classList\.add\('is-on-shelf'\);/);
  assert.match(app,/function openJournal\(\{target='',opener=null\}=\{\}\)\{\s+if\(target\)keepWhole\(target\);/);
  assert.match(views,/const mark=\(\)=>\{const whole=quote\.scrollHeight-quote\.clientHeight<=1&&!wholeRows\.has\(row\.dataset\.journalId\);row\.classList\.toggle\('is-said',whole\);link\.hidden=whole&&\(!row\.querySelector\('\.sx-j-shots'\)\|\|row\.classList\.contains\('is-on-shelf'\)\);\};/);
  const body=day.replace(/\/\*[^]*?\*\//g,'').replace(/@(?:media|supports)[^{]*\{/g,'').replace(/^\s*\}\s*$/gm,'');
  for(const rule of body.split('}').map(part=>part.trim()).filter(Boolean)){
    const selector=rule.slice(0,rule.indexOf('{')).trim();
    for(const one of selector.split(/,(?![^(]*\))/).map(part=>part.trim()).filter(Boolean))assert.ok(/\[data-day\]|sx-day|^\.sx-room-(due|say)\b|^\.sx-done-next\b/.test(one),one);
  }
  // 캐시 판을 올렸다(바뀐 화면 모듈과 스타일을 새로 받게).
  assert.match(read('sw.js'),/const CACHE = 'synk-pulse-shell-v77-people-requests-20261123';/);
});

// 처음 보는 사람용 낱말(유호님 11-21 「처음 보는 사람이 더 이해하기 좋게」): 맹검이 모른다고 짚은 말을 바꿨다.
test('a first-time customer reads plain words: stage names, the reference number, the journal filter and the SYNK work link',()=>{
  const p=project({status:'checking'});
  const html=projectView(state(p)),head=roomHead({...roomModel(p),films:true});
  // 단계 다섯: 02는 담당자가 하는 일, 03은 영상 전에 손님이 확인하는 단계라고 이름에 적는다.
  assert.match(head,/data-room-go="check">담당자 검토<\/button>/);assert.match(head,/data-room-go="draft">영상 전 확인<\/button>/);
  assert.doesNotMatch(head,/>확인<\/button>|>1차안<\/button>/);
  // 머리의 번호는 크몽 「문의하기」로 보내는 그 번호라 이름표를 단다.
  assert.match(head,/<span class="crumb-no">접수 번호 <span class="mono">P-1120-AB12<\/span><\/span>/);
  // 이름표는 본문 글꼴, 번호만 고정폭 — 옛 규칙(film-legacy.css, 고정폭 · 자간)을 더 구체적인 선택자로 덮는다(Fable F2). 좁은 화면에서 숨기는 규칙은 건드리지 않는다.
  const css=read('film.css');assert.match(css,/html\.sx\.has-room-head:not\(\.is-staff\) \.header-crumb \.crumb-no,html\.sx \.sx-room-bar\.is-head \.crumb-no\{font-family:var\(--sx-sans\);letter-spacing:normal\}/);assert.match(css,/\.crumb-no>\.mono\{font-family:var\(--sx-mono\)\}/);
  // 제작 중에도 서는 칸은 손님 광고가 아니라 SYNK 작품이다.
  assert.match(head,/data-room-go="films">SYNK 작품<\/button>/);assert.doesNotMatch(html+head,/>완성 광고</);
  // 손님에게 보이는 방 글에 「1차안」이 없다.
  for(const [state,copy] of Object.entries(ROOM_COPY))assert.doesNotMatch(copy.title+copy.text,/1차안/,state);
  const flow=read('request-flow.mjs')+read('request-data.mjs')+read('film-home.mjs');
  assert.doesNotMatch(flow.split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n'),/[kt]\('[^']*1차안/);
  // 나눈 말 거르개와 접기
  const views=read('film-views.mjs');
  assert.match(views,/t\('대화만 보기'\)/);assert.match(views,/t\('최근 것만 보기'\):t\('이전 기록 \{count\}개 더 보기',\{count:rest\}\)/);
  for(const key of ['대화만 보기','최근 것만 보기','이전 기록 {count}개 더 보기','SYNK 작품','SYNK가 만든 다른 광고 보기','접수 번호'])assert.ok(Object.hasOwn(en,key),key);
});
