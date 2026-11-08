import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {journalModel,journalNew,roomRoute,roomTab} from './public/pulse-app/room-view.mjs';
import {projectView,header} from './public/pulse-app/views.mjs';
import {journalView,JOURNAL_SHOWN} from './public/pulse-app/film-views.mjs';

// 판 3b 「일지 하나」(2026-11-08, docs/마케팅/PULSE_의뢰흐름_20261104/판3_설계.md 끝 절 E1~E13):
// 담당자가 한 말과 손님이 한 일을 어느 화면에서든 같은 한 줄기로, 묻는 칸은 그 위 하나. 손님 보기에 이미 오는 필드만 쓴다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const T=hour=>new Date(Date.UTC(2026,10,7,hour)).toISOString();
const video=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:T(20),media:{url:'/pulse/api/media/'+id,mimeType:'video/mp4',fileName:id+'.mp4'},...extra});
const studioOf=(r,patch={})=>({assets:[],scenes:[{id:'s1',revision:1,duration:2,description:'벤치 위 캔',title:'첫 컷',visibility:'customer'},{id:'s2',revision:1,duration:3,description:'한 모금',title:'둘째 컷',visibility:'customer'}],comments:[],sceneReviews:[],strategy:{revision:1,data:{},request:null,confirmation:null},
  feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1},
  request:{status:'submitted',number:'P-2026-ABCD',submittedAt:T(1),answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[],...r},...patch});
const roomProject=(r={},extra={},patch={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',revision:4,versions:[],messages:[],requestFlow:true,studio:studioOf(r,patch),...extra});
const state=(p,extra={})=>({mode:'customer',tab:'overview',live:{},versionId:'',project:p,...extra});
const round=(kind='script',extra={})=>({round:1,kind,oneLine:'한 캔에 맛이 다섯 번',scenes:[{id:'s1',revision:1},{id:'s2',revision:1}],sentAt:T(8),by:'김하늘',...extra});
const direction={round:1,status:'open',at:T(6),by:'김하늘',lead:'두 방향으로 나눴어요.',price:390000,dueDate:'2026-11-17',revisions:2,options:[{id:'a',name:'아니, 잠깐',sentence:'한 문장',flow:[{at:'0:00',text:'캔을 딴다'}],recommended:true,assetId:'img-a'},{id:'b',name:'톡',sentence:'둘째 문장',flow:[{at:'0:00',text:'톡'}],assetId:'img-b'}]};
// 하루치 이야기: 의뢰서 → 되묻기 답 → 확인 → 방향 → 고름 → 글 콘티(메모) → 확인 → 장면 이미지 → 고칠 곳 → 영상(안내) → 의견 → 문의 · 답 · 자동 안내 · 프로젝트 답변 → 승인 → 최종본 → 수령.
const full=()=>roomProject({status:'confirmed',confirmedAt:T(4),confirmedBy:'김하늘',approvedAt:T(12),
  asks:[{id:'q1',label:'로고 파일',why:'끝 화면',status:'answered',answer:'드라이브로 보낼게요',at:T(2),answeredAt:T(3)},{id:'q2',label:'출시일',status:'open',at:T(21)}],
  directionProposal:{...direction,status:'chosen',chosenId:'a',answer:'「쌉쌀」은 빼 주세요',answeredAt:T(7)},
  rounds:[round('script',{note:'첫 컷을 조금 길게 잡았어요.',approvedAt:T(9)}),round('images',{round:2,sentAt:T(10),feedbackAt:T(11),changes:2})]},
  {stage:'delivered',nextStep:'로고 원본을 기다리고 있어요',versions:[video('v1','1차 영상','preview',{guide:'소리까지 들어간 첫 판',createdAt:T(13),approvedAt:T(18)}),video('f1','15초','final',{createdAt:T(19)})],
   messages:[{id:'m1',author:'customer',authorName:'합성',action:'support',text:'로고는 언제까지요?',at:T(15)},{id:'m2',author:'staff',authorName:'자동 안내',automated:true,text:'평일 10~19시에 답해요.',at:T(15)},{id:'m3',author:'staff',authorName:'김하늘',text:'월요일까지요.',at:T(16)},{id:'m4',author:'customer',action:'feedback',versionId:'v1',seconds:2,text:'더 크게',at:T(14)}],
   closeout:{deliveryKey:'k1',receipt:{confirmedAt:T(20)},canConfirm:false,files:[{id:'f1',label:'15초'}]}},
  {comments:[{id:'c1',targetType:'project',targetId:null,author:'staff',authorName:'김하늘',text:'프로젝트 답변이에요',at:T(17)}],feedbackRounds:{drafts:[],rounds:[{id:'fr1',number:1,versionId:'v1',versionLabel:'1차 영상',submittedAt:T(14),items:[{id:'i1'},{id:'i2'}]}],latestVersionId:'v1',latestVersionLabel:'1차 영상',canDraft:false,maxItems:20,nextNumber:2}});

test('journalModel: every source becomes one line, newest first, open asks pinned apart (E3)',()=>{
  const j=journalModel(full()),ids=j.items.map(item=>item.id);
  assert.deepEqual(ids,['k:k1','v:f1','v:v1:ok','c:c1','m:m3','m:m2','m:m1','f:fr1','v:v1','r:2:fix','r:2','r:1:ok','r:1','d:1:ok','d:1','q:ok','a:q1','q:sent']);
  const by=id=>j.items.find(item=>item.id===id);
  assert.deepEqual([by('m:m3').who,by('m:m3').kind,by('m:m3').name,by('m:m3').text],['staff','talk','김하늘','월요일까지요.']);
  assert.deepEqual([by('m:m2').who,by('m:m2').name],['auto','자동 안내']);assert.deepEqual([by('m:m1').who,by('m:m1').name,by('m:m1').what],['me','나','문의']);
  assert.ok(!ids.includes('m:m4'),'video notes stay on the video screen');assert.equal(by('f:fr1').what,'1차 영상에 의견 2개를 보냈어요');
  assert.deepEqual([by('d:1').kind,by('d:1').text,by('d:1').go],['quote','두 방향으로 나눴어요.',null],'a proposal is quoted; after a round it can no longer be picked again');
  assert.deepEqual([by('d:1:ok').what,by('d:1:ok').text],['「아니, 잠깐」으로 정했어요','덧붙인 말 · 「쌉쌀」은 빼 주세요']);
  assert.deepEqual([by('r:1').kind,by('r:1').text,by('r:1').go],['quote','첫 컷을 조금 길게 잡았어요.',null],'only the last round opens');
  assert.deepEqual([by('r:2').kind,by('r:2').what,by('r:2').go],['event','장면 이미지 2판을 보냈어요',{tab:'draft'}]);
  assert.equal(by('r:2:fix').what,'장면 이미지 2판에 고칠 곳 2개를 보냈어요');
  assert.deepEqual([by('v:v1').kind,by('v:v1').text,by('v:v1').go],['quote','소리까지 들어간 첫 판',{tab:'review',versionId:'v1'}]);
  assert.deepEqual([by('v:f1').kind,by('v:f1').what],['event','최종본 15초가 도착했어요']);
  assert.equal(by('a:q1').text,'드라이브로 보낼게요');assert.equal(by('k:k1').what,'파일과 안내를 확인했어요');
  assert.deepEqual(j.pinned,{asks:[{id:'q2',label:'출시일',why:'',at:T(21),t:Date.parse(T(21))}],next:'로고 원본을 기다리고 있어요'});
  assert.equal(j.latestAt,Date.parse(T(21)));
});

test('journalModel: an earlier direction answer with no time sits right before the new proposal; old projections draw without gaps (E3 · D21)',()=>{
  const again=journalModel(roomProject({status:'confirmed',directionProposal:{...direction,round:2,prior:{round:1,names:['가','나'],answer:'더 고급스럽게'}}}));
  assert.deepEqual(again.items.map(item=>item.id),['d:2','d:1:no','q:sent']);
  assert.deepEqual([again.items[1].at,again.items[1].what,again.items[1].text],['','방향 제안 1판 · 「가」 「나」 둘 다 아니에요','더 고급스럽게']);
  // 판 3c: 서버가 앞 판의 시각을 내려 주면 1판을 보낸 줄 · 답한 줄이 제자리에 선다(옛 기록은 위처럼 시각 없이).
  const timed=journalModel(roomProject({status:'confirmed',directionProposal:{...direction,round:2,at:T(9),prior:{round:1,names:['가','나'],answer:'더 고급스럽게',at:T(5),by:'박담당',answeredAt:T(7)}},asks:[{id:'q1',label:'로고',status:'answered',answer:'네',at:T(6),answeredAt:T(8)}]}));
  assert.deepEqual(timed.items.map(item=>item.id),['d:2','a:q1','d:1:no','d:1','q:sent']);
  assert.deepEqual([timed.items[2].at,timed.items[3].who,timed.items[3].name,timed.items[3].what],[T(7),'staff','박담당','방향 제안 1판을 보냈어요']);
  // 1b 전(방향 제안 없음 · 열린 모델 제안) · 판 2 전(mail 없음) · closeout 없음 · 빈 프로젝트
  const old=journalModel(roomProject({status:'confirmed',modelProposal:{modelId:'M06',status:'open',note:'',at:T(5)}}));
  assert.deepEqual(old.items.map(item=>item.what),['모델 한결을 제안했어요','의뢰서를 보냈어요']);
  for(const p of [null,{},{studio:{}},roomProject({},{versions:[{id:'x',kind:'preview',label:'1차'}]})]){const j=journalModel(p);assert.doesNotMatch(JSON.stringify(j),/undefined|NaN/);assert.doesNotMatch(journalView(j),/undefined|null|NaN/);}
});

test('new lines are the ones from staff after this device last saw the journal; the first visit starts at zero (E5)',()=>{
  const j=journalModel(full());
  assert.equal(journalNew(j,NaN),0,'no stored time yet → the app stores the latest and starts at zero');
  assert.equal(journalNew(j,j.latestAt),0);
  // T(15) 뒤: 담당자 답 · 프로젝트 답변 · 최종본 + 열린 되묻기(자동 안내 m2는 T(15) 그 시각이라 아님, 내 줄은 세지 않는다)
  assert.equal(journalNew(j,Date.parse(T(15))),4);
  const html=header({...state(full()),journalSeen:Date.parse(T(15)),desktopApp:false});
  assert.match(html,/<button type="button" class="sx-head-ask" data-room-do="journal" aria-controls="room-journal" data-journal-count>나눈 말 <b class="sx-no">4<\/b><span class="sr">개 새 말<\/span><i class="sx-head-dot" aria-hidden="true"><\/i><span class="sr">, 답할 것이 있어요<\/span><\/button>/);
  assert.match(header({...state(roomProject()),journalSeen:NaN,desktopApp:false}),/data-journal-count>나눈 말<\/button>/,'nothing new, nothing to answer');
  const app=read('app.mjs');
  assert.match(app,/const seenKey=\(\)=>'pulse-journal-seen:'\+identity\(\);/,'stored per device and per project');
  assert.match(app,/try\{const raw=localStorage\.getItem\(seenKey\(\)\);/,'a blocked storage never breaks the room');
  assert.match(app,/if\(!Number\.isFinite\(seen\)\)\{seen=journalModel\(s\.project\)\.latestAt;/,'first visit starts at zero');
});

test('one journal per screen, in its place: the room column, the dark rooms side, the direction and films drawer (E1)',()=>{
  const cases={
    check:[state(roomProject()),'column'],
    ask:[state(roomProject({asks:[{id:'a',label:'로고 파일',why:'끝 화면에 얹어요',status:'open',at:T(2)}]})),'column'],
    direction:[state(roomProject({status:'confirmed',directionProposal:direction})),'drawer'],
    pick:[state(roomProject({status:'confirmed',directionProposal:{...direction,status:'chosen',chosenId:'a',answeredAt:T(7)}}),{tab:'pick'}),'drawer'],
    script:[state(roomProject({status:'confirmed',rounds:[round()]}),{tab:'draft'}),'side'],
    images:[state(roomProject({status:'confirmed',rounds:[round('images')]}),{tab:'draft'}),'side'],
    review:[state(roomProject({status:'confirmed',approvedAt:T(12),rounds:[round('images')]},{stage:'review',versions:[video('v1','1차 영상')]}),{tab:'review'}),'side'],
    deliver:[state(full(),{tab:'history'}),'side'],
    films:[state(roomProject(),{tab:'films'}),'drawer'],
    contact:[state(roomProject(),{tab:'contact'}),'column'],
  };
  for(const [name,[s,place]] of Object.entries(cases)){
    const html=projectView(s);
    assert.equal(html.split('data-journal ').length-1,1,name+': one journal');assert.equal(html.split('data-form="support"').length-1,1,name+': one ask box');
    assert.match(html,new RegExp(`id="room-journal" data-journal data-place="${place}"`),name);
    assert.doesNotMatch(html,/data-state="contact"|class="sx-note"|class="sx-asks"/,name+': the old ask screen, staff note and ask list live in the journal now');
    assert.equal((html.match(/data-form="ask"/g)||[]).length,['ask','deliver'].includes(name)?1:0,name+': an open ask is answered right in the journal');
  }
  // 영상 화면: 승인 전 시안을 볼 때만 「의견 칸으로」 한 줄(D4), 넓은 화면 묻기 링크는 걷고 휴대폰 시트 단추만
  const review=projectView(cases.review[0]);
  assert.match(review,/<p class="sx-j-hint" data-when="typing">영상에서 고칠 곳은 <span class="is-wide">오른쪽<\/span><span class="is-phone">영상 아래<\/span> 의견 칸에, 그 장면에서 남겨 주세요\.<\/p>/);
  assert.match(review,/<button type="button" class="sx-quiet sx-j-ask-open " data-room-do="journal">담당자에게 묻기<\/button>/);assert.doesNotMatch(review,/data-room-do="contact"/);
  assert.doesNotMatch(projectView(cases.deliver[0]),/sx-j-hint/,'no notes to leave on a final');
  // 최종본을 볼 때는 납품 칸이 최종본 모두와 안내를 보이므로 최종본 줄은 모두 「이 화면」(같은 안내가 두 번 서지 않게), 시안 줄은 「열기」.
  const deliverAll=projectView(state(full(),{tab:'history',journalAll:true}));
  assert.match(deliverAll,/data-journal-id="v:f1" tabindex="-1"><p class="sx-j-meta">[^]*?<\/p><span class="sx-j-here">지금 화면<\/span><\/li>/);
  assert.match(deliverAll,/data-journal-id="v:v1"[^]*?data-journal-go="review" data-version="v1">열기/);
  // 인용: 지금 화면의 일감이면 「이 화면」, 아니면 「열기」
  assert.match(review,/data-journal-id="v:v1"[^]*?<span class="sx-j-here">지금 화면<\/span>/);
  assert.match(projectView(state(full(),{journalAll:true})),/data-journal-id="v:v1"[^]*?<button type="button" class="sx-quiet" data-journal-go="review" data-version="v1">열기<\/button>/);
});

test('the journal reads top to bottom: pinned asks, the staff note, the ask box, then five lines and a quiet more (E2)',()=>{
  const html=projectView(state(full()));
  const order=['class="sx-j-head"','class="sx-j-pin"','class="sx-j-next"','data-form="support"','class="sx-j-list"','data-journal-do="more"'].map(mark=>html.indexOf(mark));
  assert.ok(order.every((at,i)=>at>0&&(i===0||at>order[i-1])),JSON.stringify(order));
  const list=html.slice(html.indexOf('class="sx-j-list"'),html.indexOf('data-journal-do="more"'));
  assert.equal((list.match(/class="sx-j-row /g)||[]).length,JOURNAL_SHOWN);
  assert.match(html,/이전 말 13개 더 보기/);assert.equal((projectView(state(full(),{journalAll:true})).match(/class="sx-j-row /g)||[]).length,18);
  // 기기 기억 띠는 방 맨 아래 — 대화와 의뢰서 사이에 끼지 않는다(맹검 2 · 7 · 9).
  const offered=projectView(state(full(),{rememberOffer:true}));
  assert.ok(offered.indexOf('remember-offer')>offered.indexOf('data-room-brief'),'the device offer sits below the brief');
  // 일지 안에는 밑줄 링크가 없다(E8) — 열기 · 더 보기 · 닫기 · 파일 고르기는 조용한 단추.
  const box=journalView(journalModel(full()),{place:'drawer'});assert.doesNotMatch(box,/sx-link/);assert.match(box,/data-journal-do="close"/);
});

test('notifications: a reply opens the journal line on the screen you are on (E7)',()=>{
  assert.deepEqual(roomRoute({tab:'review',messageId:'m3'},full()),{tab:'',versionId:'',journal:'m:m3'});
  assert.deepEqual(roomRoute({tab:'review',commentId:'c1'},full()),{tab:'',versionId:'',journal:'c:c1'});
  assert.equal(roomTab('contact'),'overview','the old ask screen name opens the room');
  const app=read('app.mjs');
  assert.match(app,/s\.tab=routed\?\(routed\.tab\|\|roomTab\(s\.tab\)\):/,'an empty tab keeps the current screen');
  assert.match(app,/if\(routed\?\.journal\)\{openJournal\(\{target:routed\.journal\}\);return;\}/);
  assert.match(app,/if\(at>=JOURNAL_SHOWN\)s\.journalAll=true;/,'an older line is unfolded before the move');
});

test('the drawer and sheet: one opener, Esc and the scrim close, focus returns, the video keys stay off while open (E6)',()=>{
  const app=read('app.mjs'),review=read('film-review.mjs'),views=read('film-views.mjs');
  assert.match(views,/export const journalOverlay=box=>!!box&&\(box\.dataset\.place==='drawer'\|\|box\.dataset\.place==='side'&&/,'one rule, shared by the app and the example');
  assert.match(read('demo-film.mjs'),/journalOverlay,journalSetOpen,journalFocus,journalRelease(?:,JOURNAL_SHEET)?\} from '\.\/film-views\.mjs'/);
  assert.match(views,/export const journalFocus=box=>\{const title=box\?\.querySelector\('#room-journal-title'\)/,'opening focuses the title, not the box — no phone keyboard over the lines, no released video still (Fable G3)');
  // 판 3c(Fable F2 · FA1): 머리 · 시각 · 이 순간 시계는 보이는 그림의 자리 하나, 레일 채움만 멈춰 선 동안 비운다. 기다림을 풀면 다시 그린다 — 일지 안 초점은 여전히 풀지 않는다.
  assert.match(review,/const t=video\.currentTime\|\|0,total=duration\(\);/);assert.match(review,/line\?\.style\.setProperty\('--f',String\(total&&!video\.dataset\.holding\?t\/total:0\)\);/);assert.match(review,/if\(clock&&seconds&&seconds\.value===''\)clock\.textContent=short\(t\);/);assert.match(read('film-legacy.css'),/\.sx-line::before\{[^}]*calc\(var\(--f,0\)\*100%\)/);
  assert.match(review,/if\(event\.target\.matches\?\.\('textarea,input'\)&&!event\.target\.closest\?\.\('\[data-journal\]'\)\)\{poster\?\.release\(\);paintTime\(\);\}/);
  assert.match(app,/if\(animate&&s\.journalOpen\)\{s\.journalOpen=false;journalOpener=null;\}/,'a new screen starts with the drawer closed (Fable G9)');
  assert.match(app,/journalTop=main\.querySelector\('\[data-journal\]'\)\?\.scrollTop\|\|0/,'a live refresh keeps where you read (Fable G8)');
  assert.match(app,/document\.addEventListener\('keydown',event=>\{if\(event\.key!=='Escape'\|\|!s\.journalOpen\|\|document\.querySelector\('\.sx-round-sheet\[open\],dialog\[open\]'\)\)return;closeJournal\(\);\}\);/,'the notes sheet closes first');
  assert.match(app,/s\.tab=view;s\.error='';s\.journalOpen=false;/,'moving to another screen closes it');
  assert.match(app,/\(back\?\.isConnected\?back:document\.querySelector\('\.app-header \[data-room-do="journal"\]'\)\)\?\.focus/,'focus goes back to the opener');
  assert.match(review,/document\.querySelector\('dialog\[open\],\.sx-round-sheet\[open\],\[data-journal\]\.is-open'\)/,'space and arrows do not move the video behind the sheet');
  assert.match(review,/!document\.activeElement\?\.closest\?\.\('\[data-journal\]'\)/,'the room does not dim while typing in the journal');
  const css=read('film.css');
  assert.match(css,/\.sx-journal\[data-place=drawer\]\{position:fixed;z-index:55;/);assert.match(css,/\.sx-j-scrim\{position:fixed;inset:0;z-index:54;/);
  assert.match(css,/@media \(max-width:820px\),\(max-aspect-ratio:1\/1\)\{\s*\.sx-journal:is\(\[data-place=side\],\[data-place=drawer\]\)\{position:fixed;z-index:55;left:0;right:0;top:auto;bottom:0;/);
  // Fable 최종: 떠 있는 동안은 대화상자 — aria-modal · 뒤 내용 inert(가림막 · 알림 토스트 빼고), 닫으면 푼다(F2).
  assert.match(views,/if\(modal\)\{box\.setAttribute\('role','dialog'\);box\.setAttribute\('aria-modal','true'\);for\(let at=box;/);
  assert.match(views,/export function journalRelease\(\)\{for\(const node of document\.querySelectorAll\('\[data-journal-inert\]'\)\)\{node\.inert=false;/);
  // 다시 검수(-b): <dialog>는 스스로 뒤를 잠그니 일지가 잠그지 않는다(FA1), 연 채 다시 그릴 때는 창을 볼 때만 「봤다」(FA2), 예시 장면을 바꾸면 표식을 걷는다(FA3).
  assert.match(views,/!node\.matches\('\.sx-j-scrim,\.notice,#notice,dialog,script,style,link'\)/);
  assert.match(app,/if\(journalOverlay\(box\)\)\{if\(s\.journalOpen\)markJournalSeen\(\);return;\}/);
  assert.match(read('demo-film.mjs'),/classList\.remove\('view-dr','has-journal-open'\);journalRelease\(\);/);
  // 창 폭 · 방향이 바뀌어 시트가 단이 되면 연 상태를 푼다(F3). 「봤다」(짝 알림 읽음)는 창을 보고 있을 때만, 직접 연 것은 늘(F5).
  assert.match(app,/window\.matchMedia\?\.\(JOURNAL_SHEET\)\?\.addEventListener\?\.\('change',\(\)=>\{if\(s\.journalOpen&&!journalOverlay\(journalBox\(\)\)\)/);
  assert.match(app,/if\(!opened&&\(document\.hidden\|\|document\.hasFocus\?\.\(\)===false\)\)\{journalSeenLater=true;return;\}/);
  // 예시의 되묻기 답은 전처럼 다음 장면으로(F4), 알림 줄 강조는 옛 분홍 테두리를 이긴다(F1).
  assert.match(read('demo-film.mjs'),/if\(!event\.target\.closest\?\.\('\[data-journal\]'\)\|\|event\.target\.dataset\?\.form==='ask'\)return;/);
  assert.match(css,/:is\(\.sx-j-row,\.sx-j-ask\)\.notification-target\{[^}]*!important;border-radius:0;/);
  // 방향 화면 서랍은 움직임이 걸리는 .sx-dp 밖에 있다(fixed가 상자에 갇히지 않게).
  const html=projectView(state(roomProject({status:'confirmed',directionProposal:direction})));
  assert.ok(html.indexOf('data-journal ')>html.lastIndexOf('</section>'),'the drawer sits outside the moving direction box');
});

test('the wide video screen: the band under the film is as wide as the film, the side columns reach the bottom; the script sheet is as tall as its lines (E9)',()=>{
  const css=read('film.css');
  assert.match(css,/:is\(html\.sx\.has-room-head:not\(\.is-staff\) \.sx-review,\.sx-review:has\(>\.sx-room-bar\.is-head\)\):not\(\.is-compare\) \.sx-dr-bottom\{left:calc\(var\(--col\) \+ 2\*var\(--dr-m\)\);right:calc\(var\(--col\) \+ 2\*var\(--dr-m\)\)\}/);
  assert.match(css,/\.sx-draft\.is-script:has\(>\.sx-room-bar\.is-head\)\) \.sx-sheet\{height:auto;max-height:100%\}/);
  // 821~1180 가로 창: 머리 단계 줄이 방 그림 위로 뻗어도 읽히게 그늘(3a 남은 것).
  assert.match(css,/@media \(min-width:821px\) and \(max-width:1180px\) and \(min-aspect-ratio:10001\/10000\)\{html\.sx\.has-room-head:not\(\.is-staff\) \.app-header::before\{/);
  // 넓은 가로 창 전부: 머리가 방 그림 위에 얹혀도(운영 확인 1440 · 1366×650) 읽히게 짙은 그늘은 그림 칸 안 위쪽에만 — 머리 그늘 꼬리는 그대로 짧아 머리 아래 글 · 판은 어두워지지 않는다.
  assert.match(css,/@media \(min-width:821px\) and \(min-aspect-ratio:10001\/10000\)\{\.sx-room-screen:not\(\.sx-ask-thread\)::before\{content:'';position:absolute;left:0;right:0;top:0;height:200px;background:linear-gradient\(180deg,rgba\(0,0,0,\.76\),rgba\(0,0,0,\.62\) 36%,rgba\(0,0,0,\.2\) 72%,rgba\(0,0,0,0\)\);z-index:1;pointer-events:none\}\}/);
  assert.match(css,/\.sx-room-bar\.is-head::before\{[^}]*bottom:-14px;background:linear-gradient\(180deg,rgba\(0,0,0,\.72\),rgba\(0,0,0,0\)\)/);
  assert.match(css,/\.app-header::before\{[^}]*bottom:-18px;background:linear-gradient\(180deg,rgba\(0,0,0,\.66\),rgba\(0,0,0,0\)\)/);
  assert.doesNotMatch(css,/bottom:-56px/);
});

test('the example opens the scene its tail names, then drops the tail so the address never points at a stale scene',()=>{
  const app=read('app.mjs');
  assert.match(app,/filmDemo\?'\?demo=film'\+\(\/\^#\[a-z\]\{2,12\}\$\/\.test\(location\.hash\)\?location\.hash:''\)/);
  // 초대 꼬리(#invite=…)는 낱말 하나가 아니라 남지 않는다.
  assert.equal(/^#[a-z]{2,12}$/.test('#invite=abc'),false);
  const demo=read('demo-film.mjs');
  // 꼬리는 첫 장면을 고른 뒤, 그 장면을 열기 전에 지운다(의뢰서 덫 칸이 꼬리 없는 주소로 쌓이게) — 장면을 옮길 때는 기록을 건드리지 않는다.
  assert.match(demo,/const tailed=!internal&&!start&&\/\[\?&\]demo=film\(\?:&\|\$\)\/\.test\(location\.search\),untail=\(\)=>\{if\(tailed&&location\.hash\)history\.replaceState\(history\.state,'',location\.pathname\+location\.search\);\};/);
  assert.match(demo,/const first=start\|\|location\.hash\.slice\(1\);\r?\n\s*untail\(\);\r?\n\s*go\(scenes\.some\(item=>item\[0\]===first\)\?first:scenes\[0\]\[0\]\);/);
  // 판 3c(-g FA2): 주소줄에 직접 친 꼬리도 읽은 뒤 그 장면을 열기 전에 지운다.
  assert.match(demo,/addEventListener\('hashchange',\(\)=>\{const id=location\.hash\.slice\(1\);if\(!scenes\.some\(item=>item\[0\]===id\)\)return;untail\(\);go\(id\);\}\);/);
  // 장면을 옮길 때는 기록을 만지지 않는다(-f P1 — 덫과 엉킴). 기록에 손대는 곳은 꼬리 지우기와, 뒤로 가기에 답하는 지나가기 하나뿐이다.
  const goBody=demo.slice(demo.indexOf('  function go(id){'),demo.indexOf('  nav.addEventListener('));
  assert.ok(goBody.length>500);assert.doesNotMatch(goBody,/history\./);assert.doesNotMatch(demo,/syncTail|pushState/);
  assert.equal(demo.match(/history\.back\(\)/g).length,1);
  assert.match(demo,/if\(!internal\)addEventListener\('popstate',\(\)=>\{if\(scene!=='request'&&!location\.hash\)history\.back\(\);\}\);/);
});

// 판 3c(-g FA1): 의뢰서 덫은 이미 덫 칸 위면 더 쌓지 않는다 — 예시에서 의뢰서 장면을 거듭 열어도 한 겹.
test('the request back-trap is one layer: it never stacks on a trap entry it already pushed',()=>{
  const flow=read('request-flow.mjs');
  assert.match(flow,/const trap=\(\)=>\{try\{if\(!history\.state\?\.requestFlow\)history\.pushState\(\{requestFlow:true\},''\);\}catch\{\}\};/);
  assert.equal(flow.match(/pushState/g).length,1);
  // 작은 기록 흉내: 의뢰서를 두 번 열어도 칸은 하나만 는다.
  const stack=[{}];const history={get state(){return stack.at(-1);},pushState(state){stack.push(state);}};
  const trap=new Function('history','return '+flow.match(/const trap=(\(\)=>\{try\{.*?\}catch\{\}\});/)[1])(history);
  trap();trap();assert.equal(stack.length,2,'a second mount reuses the trap entry');
});
// 판 3c: 휴대폰 시트를 연 채 창을 넓히면 앱처럼 연 상태를 푼다(가림막 · 잠금이 남지 않게).
test('the example closes an open sheet when the window widens past the sheet rule, like the app',()=>{
  const demo=read('demo-film.mjs');
  assert.match(demo,/globalThis\.matchMedia\?\.\(JOURNAL_SHEET\)\?\.addEventListener\?\.\('change',\(\)=>\{const box=host\.querySelector\('\[data-journal\]'\);if\(box\?\.classList\.contains\('is-open'\)&&!journalOverlay\(box\)\)\{exampleOpener=null;journalSetOpen\(host,false\);\}\}\);/);
  assert.match(read('app.mjs'),/matchMedia\?\.\(JOURNAL_SHEET\)\?\.addEventListener\?\.\('change'/);
});

test('small grey words and underlined links stay counted: outside the journal under the old caps, inside none (E8 · D17 · Fable G10)',()=>{
  const screens={
    check:[state(roomProject()),16,2],ask:[state(roomProject({asks:[{id:'a',label:'로고 파일',why:'끝 화면에 얹어요',status:'open',at:T(2)}]})),16,2],
    direction:[state(roomProject({status:'confirmed',directionProposal:direction})),14,4],
    prepare:[state(roomProject({status:'confirmed',directionProposal:{...direction,status:'chosen',chosenId:'a',answer:'「쌉쌀」은 빼 주세요',answeredAt:T(7)}})),16,2],
    script:[state(roomProject({status:'confirmed',rounds:[round()]}),{tab:'draft'}),16,2],
    images:[state(roomProject({status:'confirmed',rounds:[round('images')]}),{tab:'draft'}),16,2],
    review:[state(roomProject({status:'confirmed',approvedAt:T(12),rounds:[round('images')]},{stage:'review',versions:[video('v1','1차 영상')]}),{tab:'review'}),16,2],
    deliver:[state(full(),{tab:'history'}),16,2],room:[state(full()),16,2],
  };
  for(const [name,[s,small,links]] of Object.entries(screens)){
    const html=projectView(s),at=html.indexOf('<aside class="sx-journal'),end=html.indexOf('</aside>',at)+8,inside=html.slice(at,end),outside=html.slice(0,at)+html.slice(end);
    const n=(text,re)=>(text.match(re)||[]).length;
    assert.ok(n(outside,/\bsx-small\b/g)<=small,`${name}: small outside ${n(outside,/\bsx-small\b/g)}`);assert.ok(n(outside,/\bsx-link\b/g)<=links,`${name}: links outside ${n(outside,/\bsx-link\b/g)}`);
    assert.equal(n(inside,/\bsx-(small|link)\b/g),0,name+': the journal has one meta line per row and quiet buttons only');
    assert.ok(n(inside,/class="sx-j-(why|hint|next)"/g)<=4,name+': at most four other small lines in the journal');
  }
});
