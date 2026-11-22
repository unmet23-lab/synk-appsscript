import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {careOf,staffBoard,roomState,deskModel} from './public/pulse-app/room-view.mjs';
import {picker,dialogContent} from './public/pulse-app/views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';

// 담당자 돌봄 값(조각 B1 · 2026-11-21, 설계 docs/디자인/PULSE고객경험_20261120/운영설계.md 5절 · 9절):
// 제작 보드와 의뢰 확인 화면이 같은 값(careOf)으로 「답할 문의」와 「소식 없이 지난 평일」을 센다. 서버와 판단(roomState)은 그대로다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const NOW=Date.parse('2026-11-20T03:00:00.000Z'); // 한국 11-20 금요일 낮 12시
const at=offset=>new Date(NOW+offset*3600000).toISOString();
const studioOf=(r,patch={})=>({assets:[],scenes:[{id:'s1',revision:1,duration:2,description:'캔을 딴다',title:'첫 컷',visibility:'customer'}],comments:[],sceneReviews:[],strategy:{revision:1,data:{},request:null,confirmation:null},
  feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1},
  request:{status:'submitted',number:'P-1120-AB12',submittedAt:at(-200),answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[],...r},...patch});
const project=(r={},extra={},patch={})=>({id:'p1',title:'오미톡',customerName:'오미톡 상회',ownerName:'김하늘',stage:'received',revision:4,createdAt:at(-210),updatedAt:at(-2),versions:[],messages:[],requestFlow:true,studio:studioOf(r,patch),...extra});
const round=(kind,extra={})=>({round:1,kind,oneLine:'한 캔에 맛이 다섯 번',scenes:[{id:'s1',revision:1}],sentAt:at(-150),...extra});
const paid=(dueDate,extra={})=>({status:'confirmed',amount:390000,requestedAt:at(-140),confirmedAt:at(-130),dueDate,...extra});
// 제작 중(저희 차례): 장면 이미지 승인으로 차례가 넘어온 때 = -100시간(한국 11-16 월요일 08시).
const making=(r={},extra={},patch={})=>project({status:'confirmed',scriptApprovedAt:at(-150),payment:paid('2026-11-27'),approvedAt:at(-100),rounds:[round('script',{approvedAt:at(-150)}),round('images',{round:2,approvedAt:at(-100)})],...r},{stage:'producing',...extra},patch);
const video=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:at(-1),media:{url:'/pulse/api/media/'+id,mimeType:'video/mp4',fileName:id+'.mp4'},...extra});
const ask=(id,offset,extra={})=>({id,author:'customer',authorName:'손님',action:'support',visibility:'customer',text:'언제쯤 볼 수 있을까요?',at:at(offset),...extra});
const reply=(id,offset,extra={})=>({id,author:'staff',authorName:'김하늘',visibility:'customer',text:'내일 오전에 올려 드려요.',at:at(offset),...extra});

test('careOf counts a customer question until a person answers it where the customer can see',()=>{
  assert.equal(roomState(making()),'make');
  assert.deepEqual(careOf(making(),NOW),{asks:0,askSince:'',quiet:4,people:0});
  const one=making({},{messages:[ask('m1',-5)]});
  assert.equal(careOf(one,NOW).asks,1);assert.equal(careOf(one,NOW).askSince,at(-5));
  // 자동 안내만 달린 문의는 아직 답하지 않은 문의다.
  assert.equal(careOf(making({},{messages:[ask('m1',-5),reply('m2',-5,{automated:true,authorName:'자동 안내'})]}),NOW).asks,1);
  // 내부 메모는 답이 아니다.
  assert.equal(careOf(making({},{messages:[ask('m1',-5),reply('m2',-4,{visibility:'internal'})]}),NOW).asks,1);
  // 사람이 손님에게 보이게 쓴 답 뒤에는 0.
  assert.equal(careOf(making({},{messages:[ask('m1',-5),reply('m2',-4)]}),NOW).asks,0);
  // 손님에게 보이는 프로젝트 댓글도 답이다(내부 댓글 · 손님 댓글 · 장면 댓글은 아니다).
  const comment=(extra={})=>({id:'c1',targetType:'project',targetId:'p1',author:'staff',authorName:'김하늘',visibility:'customer',text:'내일 올려요.',at:at(-3),...extra});
  assert.equal(careOf(making({},{messages:[ask('m1',-5)]},{comments:[comment()]}),NOW).asks,0);
  assert.equal(careOf(making({},{messages:[ask('m1',-5)]},{comments:[comment({visibility:'internal'})]}),NOW).asks,1);
  assert.equal(careOf(making({},{messages:[ask('m1',-5)]},{comments:[comment({author:'customer'})]}),NOW).asks,1);
  assert.equal(careOf(making({},{messages:[ask('m1',-5)]},{comments:[comment({targetType:'scene',targetId:'s1'})]}),NOW).asks,1);
  // 답 뒤에 다시 온 문의만 센다. 가장 오래된 것의 때를 싣는다.
  const again=careOf(making({},{messages:[ask('m1',-30),reply('m2',-20),ask('m3',-6),ask('m4',-2)]}),NOW);
  assert.deepEqual([again.asks,again.askSince],[2,at(-6)]);
  // 처리 표시가 있으면 세지 않는다(「답 없이 닫기」).
  assert.equal(careOf(making({},{messages:[ask('m1',-5,{resolved:true}),ask('m2',-3)]}),NOW).asks,1);
  // 영상 의견(feedback)과 직원이 쓴 글은 문의가 아니다. 때를 못 읽는 글은 세지 않는다.
  assert.equal(careOf(making({},{messages:[ask('m1',-5,{action:'feedback'}),ask('m2',-4,{author:'staff'}),ask('m3',0,{at:'어제'})]}),NOW).asks,0);
});

test('careOf counts quiet weekdays in Korean dates only on our turn of a request project',()=>{
  // 차례가 넘어온 때가 월요일 08시, 지금이 금요일 → 화 · 수 · 목 · 금 = 4.
  assert.equal(careOf(making(),NOW).quiet,4);
  // 올린 소식(손님 보기 꼴 {at})이 수요일이면 목 · 금 = 2.
  assert.equal(careOf(making({progress:[{id:'n1',at:at(-50),stage:'make',text:'컷 둘을 마쳤어요.',assets:[]}]}),NOW).quiet,2);
  // 직원 원본 꼴: 올린 소식(posted · postedAt)만 센다. 초안과 거둔 소식은 세지 않는다.
  const raw=[{id:'n1',at:at(-50),state:'posted',postedAt:at(-26),text:'올린 소식'},{id:'n2',at:at(-3),state:'draft',text:'초안'},{id:'n3',at:at(-2),state:'withdrawn',postedAt:at(-2),withdrawnAt:at(-1),text:'거둔 소식'}];
  assert.equal(careOf(making({progress:raw}),NOW).quiet,1);
  assert.equal(careOf(making({},{},{progress:raw}),NOW).quiet,1);
  // 사람이 쓴 답도 손님에게 닿은 일이다(자동 안내 · 내부 메모는 아니다).
  assert.equal(careOf(making({},{messages:[reply('m1',-3)]}),NOW).quiet,0);
  assert.equal(careOf(making({},{messages:[reply('m1',-3,{automated:true}),reply('m2',-3,{visibility:'internal'})]}),NOW).quiet,4);
  // 주말은 세지 않는다: 금요일에 닿고 다음 월요일이면 1, 일요일이면 0.
  const friday=making({progress:[{id:'n1',at:at(-1),text:'금요일 소식',assets:[]}]});
  assert.equal(careOf(friday,Date.parse('2026-11-22T03:00:00.000Z')).quiet,0);
  assert.equal(careOf(friday,Date.parse('2026-11-23T03:00:00.000Z')).quiet,1);
  // 한국 날짜로 센다: UTC 11-20 15:30은 한국 11-21(토) 00:30이다.
  assert.equal(careOf(making({progress:[{id:'n1',at:'2026-11-19T15:30:00.000Z',text:'한국 금요일 00:30',assets:[]}]}),Date.parse('2026-11-20T15:30:00.000Z')).quiet,0);
  // 손님 차례(영상 확인) · 끝 · 옛 흐름 · 보관은 소식 빈 날을 세지 않는다. 문의는 그대로 센다.
  const review=making({},{stage:'review',versions:[video('v1','1차 시안')],messages:[ask('m1',-5)]});
  assert.equal(roomState(review),'review');assert.deepEqual(careOf(review,NOW),{asks:1,askSince:at(-5),quiet:null,people:0});
  const legacy={id:'p9',title:'옛 프로젝트',stage:'producing',createdAt:at(-300),updatedAt:at(-90),versions:[],messages:[ask('m1',-7)],studio:{comments:[]}};
  assert.deepEqual(careOf(legacy,NOW),{asks:1,askSince:at(-7),quiet:null,people:0});
  assert.equal(careOf(making({},{stage:'archived'}),NOW).quiet,null);
  assert.deepEqual(careOf(null,NOW),{asks:0,askSince:'',quiet:null,people:0});
});

test('the board carries the care values, puts questions first, and takes the promised date after payment',()=>{
  const a=making({},{id:'a',title:'가',dueDate:'2026-12-30'}),b=making({payment:paid('2026-11-24')},{id:'b',title:'나'}),c=making({},{id:'c',title:'다',messages:[ask('m1',-3)]}),d=making({},{id:'d',title:'라',messages:[ask('m1',-9)]});
  const waiting=making({},{id:'w',title:'마',stage:'review',versions:[video('v1','1차 시안')],updatedAt:at(-80)}),asked=making({},{id:'x',title:'바',stage:'review',versions:[video('v1','1차 시안')],updatedAt:at(-1),messages:[ask('m1',-1)]});
  const done=making({},{id:'z',title:'사',stage:'delivered',versions:[video('f1','최종본','final')],messages:[ask('m1',-2)],closeout:{deliveryKey:'k',receipt:{confirmedAt:at(-10)}}});
  const board=staffBoard([a,b,c,d,waiting,asked,done],NOW);
  // 결제를 확인하며 정한 날이 먼저다(프로젝트의 옛 날짜가 있어도).
  assert.deepEqual(board.ours.find(item=>item.id==='a').due,'2026-11-27');assert.equal(board.ours.find(item=>item.id==='a').left,7);
  // 우리 차례: 답할 문의가 있는 건이 맨 위(오래된 문의 먼저), 그다음은 남은 날 순.
  assert.deepEqual(board.ours.map(item=>item.id),['d','c','b','a']);
  assert.deepEqual(board.ours.map(item=>item.asks),[1,1,0,0]);
  assert.equal(board.ours[0].askSince,at(-9));assert.equal(board.ours[2].quiet,4);
  // 손님 차례에서도 답할 문의가 있는 건이 위. 단계 칸도 같다.
  assert.deepEqual(board.theirs.map(item=>item.id),['x','w']);
  assert.deepEqual(board.stages.find(stage=>stage.id==='make').items.map(item=>item.id),['d','c','b','a']);
  assert.deepEqual(board.stages.find(stage=>stage.id==='review').items.map(item=>item.id),['x','w']);
  // 머리 숫자: 끝난 건의 문의도 넣는다(보관은 뺀다).
  assert.equal(board.asks,4);assert.equal(board.asking.length,4);assert.equal(board.asking[0].id,'d');
  assert.equal(staffBoard([making({},{id:'q',stage:'archived',messages:[ask('m1',-2)]})],NOW).asks,0);
});

test('the board card and the head show the question and quiet tags',()=>{
  const projects=[making({},{id:'c',title:'다',messages:[ask('m1',-3),ask('m2',-1)]}),making({},{id:'b',title:'나'})];
  const html=picker({mode:'staff',workspace:{projects,canWrite:true},staffStage:'make'});
  assert.match(html,/<p class="staff-meter is-hot"><b>2<\/b><span>답할 문의<small>다<\/small><\/span><\/p>/);
  assert.match(html,/<span class="staff-care is-ask">답할 문의 2 · [^<]+<\/span>/);
  assert.match(html,/<span class="staff-care is-quiet">소식 없이 평일 \d+일째<\/span>/);
  // 꼬리표의 색은 직원 화면 CSS 한 곳에.
  assert.match(read('staff.css'),/\.staff-care\b/);
});

// ── 조각 B2: 의뢰 확인 화면의 「문의와 답」과 소식 쓰기 창의 미리 보기 ──
const talky=()=>making({},{messages:[ask('m0',-90,{text:'로고를 더 크게 넣을 수 있을까요?'}),reply('m1',-80,{text:'네, 끝 화면에 반영할게요.'}),reply('mi',-70,{visibility:'internal',text:'내부 메모 한 줄'}),ask('mf',-60,{action:'feedback',text:'영상 의견 한 줄'}),ask('m2',-5,{text:'언제쯤 볼 수 있을까요?',photos:['a9']}),reply('ma',-5,{automated:true,authorName:'자동 안내',text:'평일 10~19시에 확인해요.'}),ask('m3',-2,{text:'감사합니다!',resolved:true})]},
  {comments:[{id:'c1',targetType:'project',targetId:'p1',author:'staff',authorName:'김하늘',visibility:'customer',text:'댓글로 드린 답',at:at(-75)},{id:'c2',targetType:'project',targetId:'p1',author:'staff',authorName:'김하늘',visibility:'internal',text:'내부 댓글 한 줄',at:at(-74)}],
   assets:[{id:'a9',mimeType:'image/png',fileName:'a9.png',purpose:'message',author:'customer',media:{url:'/api/client-projects/p1/studio/media/a9'}}]});
const desk=(p,extra={})=>deskView({...deskModel(p),queue:[],canEdit:true,...extra},{bar:false});

test('the desk lists questions and the answers the customer can see, newest first, and marks what still waits',()=>{
  const p=talky(),talk=deskModel(p).talk;
  // 내부 메모 · 내부 댓글 · 영상 의견은 싣지 않는다. 새 것이 위.
  assert.deepEqual(talk.items.map(item=>item.id),['m3','m2','ma','c1','m1','m0']);
  assert.deepEqual(talk.items.map(item=>item.who),['customer','customer','auto','staff','staff','customer']);
  // 답하지 않은 문의(자동 안내만 달림)는 open, 답 없이 닫은 문의는 closed. 숫자는 제작 보드와 같다.
  assert.deepEqual(talk.items.filter(item=>item.open).map(item=>item.id),['m2']);
  assert.deepEqual(talk.items.filter(item=>item.closed).map(item=>item.id),['m3']);
  assert.equal(talk.open,1);assert.equal(careOf(p,NOW).asks,1);
  assert.deepEqual(talk.items.find(item=>item.id==='m2').pictures,['/api/client-projects/p1/studio/media/a9']);
  // 열두 줄까지만 싣고 앞선 글은 수만.
  const many=deskModel(making({},{messages:Array.from({length:14},(_,i)=>ask('q'+i,-40+i))})).talk;
  assert.equal(many.items.length,12);assert.equal(many.more,2);assert.equal(many.items[0].id,'q13');assert.equal(many.open,14);
});

test('the desk draws the talk block first in the side column with a reply box that says the customer sees it',()=>{
  const html=desk(talky());
  assert.match(html,/<aside class="desk-side">\s*<section class="desk-talk" data-desk-talk><h2>문의와 답 <span class="desk-talk-n">답할 문의 1<\/span><\/h2>/);
  assert.match(html,/<li data-message-id="m2" tabindex="-1"><i class="led is-wait"><\/i><div><b>손님 문의 · [^<]+ · 답을 기다려요<\/b>/);
  assert.match(html,/<img src="\/api\/client-projects\/p1\/studio\/media\/a9" alt="손님이 붙인 사진 1"/);
  // 답하지 않은 문의에만 「답 없이 닫기」(기존 처리 동작).
  assert.equal((html.match(/data-action="resolve"/g)||[]).length,1);
  assert.match(html,/<button type="button" class="btn-line" data-action="resolve" data-id="m2">답 없이 닫기<\/button>/);
  assert.match(html,/<li data-message-id="m3"[^>]*><i class="led is-ok"><\/i><div><b>손님 문의 · [^<]+ · 답 없이 닫음<\/b>/);
  assert.match(html,/<b>자동 안내 · /);assert.match(html,/<b>김하늘 · /);
  for(const hidden of ['내부 메모 한 줄','내부 댓글 한 줄','영상 의견 한 줄'])assert.ok(!html.includes(hidden),hidden);
  assert.match(html,/<form class="desk-talk-form" data-form="desk-reply"><label><span>손님에게 답하기<\/span><textarea name="text" rows="3" maxlength="3000" required/);
  assert.match(html,/손님에게 보여요\. 보내면 손님 방의 「담당자와 나눈 말」에 뜨고 알림이 가요\./);
  // 문의가 없으면 빈 줄과 답 칸만. 보기만 하는 사람에게는 답 칸과 닫기 단추가 없다. 손님 글은 글로만 그린다.
  const empty=desk(making());
  assert.match(empty,/<h2>문의와 답<\/h2><p class="desk-at">아직 문의가 없어요\.<\/p><form class="desk-talk-form"/);
  const readonly=desk(talky(),{canEdit:false});
  assert.ok(!readonly.includes('data-form="desk-reply"'));assert.ok(!readonly.includes('data-action="resolve"'));
  assert.ok(desk(making({},{messages:[ask('m1',-1,{text:'<img src=x onerror=1>'})]})).includes('&lt;img src=x onerror=1&gt;'));
});

test('the reply goes out as a customer-visible message and a question alert opens the desk',()=>{
  const app=read('app.mjs');
  assert.match(app,/if\(type==='desk-reply'\)\{const text=String\(values\.text\|\|''\)\.trim\(\);if\(!text\)\{notice\('답을 적어 주세요\.'\);return;\}await mutate\(\(\)=>request\(staffPath\('\/messages'\),\{\.\.\.options\(\),body:\{revision:s\.project\.revision,text,visibility:'customer'\}\}\),\{form,message:'손님에게 답을 보냈어요\.'\}\);return;\}/);
  // 자료를 지운 의뢰(retired)는 「문의와 답」을 그리지 않으므로 그 알림은 전처럼 간다.
  assert.match(app,/s\.mode==='staff'&&item\.type==='customer_support'&&s\.project\?\.studio\?\.request&&s\.project\.studio\.request\.status!=='retired'\?'desk':/);
  assert.equal(deskView({...deskModel(making({status:'retired'},{messages:[ask('m1',-1)]})),queue:[],canEdit:true},{bar:false}).includes('data-desk-talk'),false);
  assert.match(app,/node\.matches\('article'\)\|\|node\.matches\('\[data-desk-talk\] li'\)/);
});

test('the update dialog shows how the update will hang in the customer room, filled from the form only',()=>{
  const html=dialogContent('desk-progress',{owner:'김<b>하늘',stage:'make',used:3});
  assert.match(html,/<div class="desk-progress-grid"><form data-form="desk-progress" data-id="">/);
  assert.match(html,/<\/form><aside class="desk-preview" data-progress-preview aria-label="손님 방에 걸릴 모습">/);
  assert.match(html,/<blockquote data-preview-text><\/blockquote><p><b>김&lt;b&gt;하늘<\/b> · 올린 시각<\/p>/);
  assert.match(html,/<div class="desk-preview-shelf" data-preview-shelf data-count="0"><\/div>/);
  assert.match(html,/<p class="desk-preview-cap">작업 중인 화면이에요 · 완성본이 아니에요<\/p>/);
  const app=read('app.mjs');
  // 창을 열 때 한 번, 글은 쓸 때마다, 그림은 고를 때마다. 새로 고른 파일의 주소는 창을 닫으면 놓는다.
  assert.match(app,/dialog\.showModal\(\);if\(type==='desk-progress'\)progressPreview\(\);/);
  assert.match(app,/dialog\.addEventListener\('input',event=>\{if\(\['text','textTr'\]\.includes\(event\.target\?\.name\)&&event\.target\.closest\?\.\('form\[data-form="desk-progress"\]'\)\)progressPreview\(\{pictures:false\}\);\}\);/);
  assert.match(app,/dialog\.addEventListener\('change',event=>\{if\(\['keep','files'\]\.includes\(event\.target\?\.name\)/);
  assert.match(app,/dialog\.addEventListener\('close',dropPreviewUrls\);/);
  assert.match(app,/say\.textContent=text\|\|'쓴 글이 여기에 보여요\.'/);
  assert.match(read('slate-screens.css'),/\.app-dialog\.is-wide\{width:min\(980px,calc\(100vw - 24px\)\)\}/);
});

// ── 다듬기(11-21 · 최종 검수 P2 넷) ──
test('the head names what the columns show: open questions keep a finished project unfolded, and the soonest delivery leads',()=>{
  // 14일 넘게 움직임이 없는 끝난 건도 열린 문의가 있으면 접지 않는다(머리 「답할 문의」가 부르는 건이 칸에 보이게).
  const old=making({},{id:'old',title:'옛 납품 건',stage:'delivered',updatedAt:at(-24*20),versions:[video('f1','최종본','final')],messages:[ask('m1',-24*19)],closeout:{deliveryKey:'k',receipt:{confirmedAt:at(-24*20)}}});
  const quietOld=making({},{id:'gone',title:'조용한 옛 건',stage:'delivered',updatedAt:at(-24*20),versions:[video('f1','최종본','final')],closeout:{deliveryKey:'k',receipt:{confirmedAt:at(-24*20)}}});
  const html=picker({mode:'staff',workspace:{projects:[old,quietOld,making({},{id:'now',title:'제작 중 건',messages:[ask('m1',-2)]})],canWrite:true},staffStage:'deliver'});
  assert.match(html,/<b>2<\/b><span>답할 문의<small>옛 납품 건 외 1<\/small>/);
  assert.match(html,/class="project-tile staff-card is-done" data-action="open-project" data-id="old"/);
  assert.match(html,/class="project-tile staff-row" data-action="open-project" data-id="gone"/);
  // 「사흘 안 전달」은 남은 날 순이다 — 문의가 있는 건이 앞서 서도 이름은 가장 급한 건.
  const board=staffBoard([making({payment:paid('2026-11-23')},{id:'d3',title:'사흘 뒤 건',messages:[ask('m1',-2)]}),making({payment:paid('2026-11-20')},{id:'d0',title:'오늘 전달할 건'})],NOW);
  assert.deepEqual(board.ours.map(item=>item.id),['d3','d0']);
  assert.deepEqual(board.soon.map(item=>item.id),['d0','d3']);
});

test('closing a question says so, and a translated project previews the text the customer will read',()=>{
  const app=read('app.mjs');
  assert.match(app,/staffPath\('\/resolve'\),[^;]*\{message:'문의를 답 없이 닫았어요\.'/);
  assert.ok(!app.includes('의견을 처리했어요.'));
  // 번역 칸에 글이 있으면 그 글이 미리 보기에 걸린다. 번역 프로젝트의 창에는 그 안내가 있다.
  assert.match(app,/const translated=String\(form\.elements\.textTr\?\.value\|\|''\)\.trim\(\),text=translated\|\|String\(form\.elements\.text\?\.value\|\|''\)\.trim\(\)/);
  const tr={locale:'en',entries:{}};
  assert.match(dialogContent('desk-progress',{owner:'김하늘',tr}),/<p class="desk-at" data-preview-tr>[^<]+프로젝트예요\. 번역 칸에 글을 적으면 미리 보기도 그 글로 바뀌어요\./);
  assert.ok(!dialogContent('desk-progress',{owner:'김하늘'}).includes('data-preview-tr'));
});
