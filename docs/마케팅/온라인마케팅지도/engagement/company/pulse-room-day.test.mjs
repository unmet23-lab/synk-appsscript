import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomModel,roomWord,roomDue,ROOM_COPY} from './public/pulse-app/room-view.mjs';
import {projectView,headMore} from './public/pulse-app/views.mjs';
import {roomView,roomHead,briefView} from './public/pulse-app/film-views.mjs';
import {registerLocale,setLocale} from './public/pulse-app/i18n.mjs';
import en from './public/pulse-app/i18n/en.mjs';

// 낮 판(2026-11-20, 설계 docs/디자인/PULSE고객경험_20261120/운영설계.md)이 더한 자료 둘(담당자 한마디 word · 받으실 날 due)과 그 그리기는 그대로 남는다.
// 2판 ①(2026-11-24, docs/디자인/PULSE고객앱_다시짓기_20261124/방_설계.md)이 낮 판의 밝은 바탕 · 제목 강조 구절을 거두고 방을 시안 A의 검정으로 옮겼다.
// 여기서는 남은 자료와 그리기, 그리고 낮 판을 거둔 약속(sx-day · data-day가 어디에도 없고 걸이는 data-room-a로 옮겼다)을 지킨다.
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
// 무대 복도의 그림 이름표(inert 꾸밈)는 화면 글이 아니라 그림의 일부다.
const words=html=>html.replace(/<span class="sx-hall-tag">[^]*?<\/span><\/span>/g,'');

test('the room root keeps its pinned prefix and carries data-room-a; the screens that only watch keep their own root',()=>{
  const room=projectView(state(making()));
  assert.match(room,/<div class="sx-room" data-state="make" data-room-a>/);
  // 영상 확인 · 1차안은 방 뿌리(data-room-a)를 그리지 않는다.
  const review=projectView(state(project({status:'confirmed',approvedAt:at(-100),rounds:[round('images',{approvedAt:at(-100)})]},{stage:'review',versions:[video('v1','1차 시안')]}),{tab:'review'}));
  assert.doesNotMatch(review,/data-room-a|data-day/);
  const draft=projectView(state(project({status:'confirmed',rounds:[round('script')]}),{tab:'draft'}));
  assert.doesNotMatch(draft,/data-room-a|data-day/);
  // CSP(style-src 'self'): 그린 글에 style 속성이 없다.
  assert.doesNotMatch(room,/\sstyle="/);
});

test('roomWord is the latest posted update since the turn came to us, pictures or not, and only on our turn',()=>{
  const p=making();
  assert.deepEqual(roomWord(p),{id:'n2',at:at(-2),text:'내일은 끝 화면을 마무리해요.'});
  assert.equal(roomModel(p).word.id,'n2');
  // 무대의 소식(news)은 그대로 그림이 있는 최근 것.
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

test('room titles are plain words: the key-phrase table and its English marks are gone, the due line still speaks English',async()=>{
  const views=read('film-views.mjs');
  assert.doesNotMatch(views,/TITLE_MARKS|titleKey|markTitle/);
  // 그리는 글의 제목은 통짜 그대로다(자동 안내 시험이 읽는 머리 마크업).
  assert.match(roomView(roomModel(making()),{bar:false}),/<h1 class="sx-display" data-room-title>확인하신 컷으로 만들고 있어요<\/h1>/);
  for(const copy of Object.values(ROOM_COPY))assert.equal(en['mark\u0004'+copy.title],undefined,copy.title);
  // 다른 자리의 표식(1차안 화면의 초안 · 의견)은 남는다.
  assert.equal(en['mark\u0004초안'],'Draft');assert.equal(en['mark\u0004의견'],'Note');
  registerLocale('en',en);await setLocale('en');
  try{
    const html=roomView({...roomModel(making()),due:{date:'2026-11-23',left:3,changed:false}},{bar:false});
    assert.match(html,/<b>In 3 days<\/b> <span>Delivery on Monday, November 23<\/span>/);
    assert.match(html,/See it in messages/);
  }finally{await setLocale('ko');}
});

test('the stage caption keeps its link only when its pictures belong to another update than the word card',()=>{
  // 한마디와 무대의 그림이 같은 소식이면 캡션에 단추가 없다(같은 소식으로 가는 길은 한마디의 하나). 캡션은 어느 소식의 그림인지 적는다.
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
  assert.match(film,/data-state="done" data-room-a>/);
  assert.match(film,/<button type="button" class="sx-quiet" data-room-do="journal" data-journal-say="다음 편을 이어 만들고 싶어요\.">다음 편 묻기<\/button>/);
  const photo=done('photo');
  assert.match(photo,/data-journal-say="다음 사진을 이어 만들고 싶어요\.">다음 사진 묻기<\/button>/);
  assert.doesNotMatch(photo,/다음 편/);
  // 채우기는 묻기 칸이 비었거나 앞 단추가 채운 글 그대로일 때만(손님이 고친 글은 두고), input 사건으로 쓰던 글에 올린다(보내기는 손님이 누른다).
  const app=read('app.mjs');
  assert.match(app,/const say=ask\.dataset\.journalSay\|\|''/);
  assert.match(app,/if\(field&&\(!field\.value\.trim\(\)\|\|field\.value===journalSaid\)\)\{journalSaid=say;field\.value=say;field\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\);/);
});

test('the day look is gone everywhere, and its hooks (address bar colour, echo tidy, play mark) moved to the dark room root',()=>{
  const app=read('app.mjs'),views=read('film-views.mjs'),demo=read('demo-film.mjs'),css=read('film.css'),legacy=read('views.mjs');
  for(const [name,src] of Object.entries({app,views,demo,css,legacy}))assert.doesNotMatch(src,/sx-day|data-day|낮 판 시작/,name);
  // 앱: 그릴 때마다 판정한다(다른 화면으로 가면 바로 뗀다). 주소창 색은 방 바탕과 같은 검정.
  assert.match(app,/const roomA=!!main\.querySelector\('\.sx-room\[data-room-a\]'\);document\.querySelector\('meta\[name="theme-color"\]'\)\?\.setAttribute\('content',roomA\?'#060606':'#000000'\);/);
  assert.match(css,/\.sx-room\[data-room-a\]\{background:var\(--sx-room-bg\);/);
  // 방 붙이기: 같은 소식 접기와 무대는 새 방 뿌리에서만. 제목은 어절로 떠오른다(강조 구절이 없다).
  assert.match(views,/const roomA=host\.matches\('\.sx-room\[data-room-a\]'\)/);
  assert.match(views,/if\(roomA\)\{tidyEcho\(host\);mountStage\(host\);\}/);
  assert.match(views,/if\(roomTitle\)revealWords\(roomTitle,\{delay:60\}\);/);
  // 재생 표는 영상의 한가운데에(칸 기준이 아니라 영상 기준 — 가로 영상에서도 영상 위에 선다).
  assert.match(views,/playMark\.style\.setProperty\('--play-x',`\$\{printed\.offsetLeft\+printed\.offsetWidth\/2\}px`\);/);
  assert.match(css,/>\.sx-room-play::after\{content:'';position:absolute;left:var\(--play-x,50%\);top:var\(--play-y,44%\);/);
  // 예시는 장면을 지울 때 서랍 둘의 표식을 함께 걷는다.
  assert.match(demo,/classList\.remove\('view-dr','has-journal-open','has-brief-open'\);journalRelease\(\);briefRelease\(\);/);
  // 같은 소식은 한 번만: 무대에 선 그림은 나눈 말의 그 줄에서 접는다. 나눈 말이 서랍이라 한마디의 글을 한 줄로 접는 is-said는 없다.
  assert.doesNotMatch(views+css,/is-said/);
  assert.match(css,/\.sx-room\[data-room-a\] \.sx-j-row\.is-on-shelf \.sx-j-shots\{display:none\}/);
  assert.match(views,/export function keepWhole\(id\)\{if\(!id\)return;wholeRows\.add\(id\);for\(const row of document\.querySelectorAll\('\.sx-j-row'\)\)if\(row\.dataset\.journalId===id\)row\.classList\.remove\('is-on-shelf'\);\}/);
  assert.match(views,/if\(shelf&&!wholeRows\.has\(shelf\.dataset\.journalId\)\)shelf\.classList\.add\('is-on-shelf'\);/);
  assert.match(app,/function openJournal\(\{target='',opener=null\}=\{\}\)\{\s+if\(target\)keepWhole\(target\);/);
  // 캐시 판을 올렸다(바뀐 화면 모듈과 스타일을 새로 받게).
  assert.match(read('sw.js'),/const CACHE = 'synk-pulse-shell-v81-example-20261126';/);
});

// 처음 보는 사람용 낱말(11-21 「처음 보는 사람이 더 이해하기 좋게」): 맹검이 모른다고 짚은 말을 바꿨다.
test('a first-time customer reads plain words: stage names, the reference number, the journal filter and the SYNK work link',()=>{
  const p=project({status:'checking'});
  const html=projectView(state(p)),head=roomHead({...roomModel(p),films:true});
  // 단계 다섯: 02는 담당자가 하는 일, 03은 영상 전에 손님이 확인하는 단계라고 이름에 적는다.
  assert.match(head,/data-room-go="check">담당자 검토<\/button>/);assert.match(head,/data-room-go="draft">영상 전 확인<\/button>/);
  assert.doesNotMatch(head,/>확인<\/button>|>1차안<\/button>/);
  // 2판 ①: 크몽 「문의하기」로 보내는 번호는 머리에서 빠지고 의뢰서 서랍 맨 위에 이름표 · 복사 단추와 함께 선다.
  assert.doesNotMatch(head,/crumb-no|P-1120-AB12/);
  assert.match(briefView(roomModel(p)),/<p class="sx-brief-no"><span class="sx-small">접수 번호<\/span> <b class="sx-no">P-1120-AB12<\/b> <button type="button" class="sx-quiet" data-room-do="copy-number" data-number="P-1120-AB12">번호 복사<\/button><\/p>/);
  // 제작 중에도 서는 입구는 손님 광고가 아니라 SYNK 작품이다 — 이제 「더 보기」 차림에.
  assert.doesNotMatch(head,/data-room-go="films"/);
  assert.match(headMore(state(p)),/data-room-go="films">SYNK 작품<\/button>/);assert.doesNotMatch(words(html)+head,/>완성 광고</);
  // 손님에게 보이는 방 글에 「1차안」이 없다.
  for(const [name,copy] of Object.entries(ROOM_COPY))assert.doesNotMatch(copy.title+copy.text,/1차안/,name);
  const flow=read('request-flow.mjs')+read('request-data.mjs')+read('film-home.mjs');
  assert.doesNotMatch(flow.split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n'),/[kt]\('[^']*1차안/);
  // 나눈 말 거르개와 접기
  const views=read('film-views.mjs');
  assert.match(views,/t\('대화만 보기'\)/);assert.match(views,/t\('최근 것만 보기'\):t\('이전 기록 \{count\}개 더 보기',\{count:rest\}\)/);
  for(const key of ['대화만 보기','최근 것만 보기','이전 기록 {count}개 더 보기','SYNK 작품','접수 번호','번호 복사'])assert.ok(Object.hasOwn(en,key),key);
});
