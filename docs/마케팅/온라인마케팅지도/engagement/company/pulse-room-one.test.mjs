import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomTab,roomRoute,roomModel,roomStage,ROOM_STAGES} from './public/pulse-app/room-view.mjs';
import {projectView,header,headerCrumb} from './public/pulse-app/views.mjs';
import {roomView} from './public/pulse-app/film-views.mjs';

// 판 3a 「고객 방 하나로」(2026-11-08, docs/마케팅/PULSE_의뢰흐름_20261104/판3_설계.md 끝 절 「11-08 고침」):
// 머리 하나 · 묻기 하나 · 영상과 납품 한 화면 · 옛 탭 길 닫기 · 알림 대응표 · 옛 투영 호환. 옛 프로젝트 · 체험 · 직원 화면은 옛 시험이 그대로 지킨다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const at='2026-11-08T03:00:00.000Z';
const video=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:at,media:{url:'/pulse/api/media/'+id,mimeType:'video/mp4',fileName:id+'.mp4'},...extra});
const studioOf=(r,patch={})=>({assets:[],scenes:[{id:'s1',revision:1,duration:2,description:'벤치 위 캔',title:'첫 컷',visibility:'customer'},{id:'s2',revision:1,duration:3,description:'한 모금',title:'둘째 컷',visibility:'customer'}],comments:[],sceneReviews:[],strategy:{revision:1,data:{},request:null,confirmation:null},
  feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1},
  request:{status:'submitted',number:'P-2026-ABCD',submittedAt:at,answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15'},files:[],asks:[],notes:[],rounds:[],...r},...patch});
const roomProject=(r={},extra={},patch={})=>({id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',revision:4,versions:[],messages:[],requestFlow:true,studio:studioOf(r,patch),...extra});
const state=(p,extra={})=>({mode:'customer',tab:'overview',live:{},versionId:'',project:p,...extra});
const round=(kind='script')=>({round:1,kind,oneLine:'한 캔에 맛이 다섯 번',scenes:[{id:'s1',revision:1},{id:'s2',revision:1}],sentAt:at});
const direction={round:1,status:'open',lead:'두 방향으로 나눴어요.',price:390000,dueDate:'2026-11-17',revisions:2,at,options:[{id:'a',name:'아니, 잠깐',sentence:'한 문장',flow:[{at:'0:00',text:'캔을 딴다'}],recommended:true,assetId:'img-a'},{id:'b',name:'톡',sentence:'둘째 문장',flow:[{at:'0:00',text:'톡'}],assetId:'img-b'}]};
const preview=video('v1','1차 시안');
const approved=video('v1','1차 시안','preview',{approvedAt:at});
const delivered=(extra={})=>roomProject({status:'confirmed',approvedAt:at,rounds:[round('images')]},{stage:'delivered',versions:[approved,video('f1','15초 최종본','final',{guide:'릴스에 그대로 올리세요.',approvedPreviewId:'v1'}),video('f2','세로 30초','final',{approvedPreviewId:'v1'})],closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:true,files:[{id:'f1',label:'15초 최종본'},{id:'f2',label:'세로 30초'}]},...extra});

test('roomTab folds stage ids and old tab names into one room screen, and the stages are five',()=>{
  for(const id of ['request','check','make','room','overview','strategy','direction','concepts','storyboard','desk','manage','아무거나'])assert.equal(roomTab(id),'overview',id);
  assert.equal(roomTab('review'),'review');assert.equal(roomTab('history'),'review','video and delivery are one screen');
  for(const id of ['draft','films','contact','pick'])assert.equal(roomTab(id),id);
  assert.deepEqual(ROOM_STAGES.map(stage=>stage.id),['request','check','draft','make','review']);
  assert.equal(ROOM_STAGES.at(-1).name,'영상 · 납품');assert.equal(roomStage('deliver'),'review');assert.equal(roomStage('review'),'review');
});

test('one table sends every customer notification to its place in the room (D10)',()=>{
  const drafted=roomProject({status:'confirmed',rounds:[round()]}),done=delivered();
  const rows=[
    [{tab:'overview'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'direction'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'strategy'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'strategy',target:'kickoff'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'strategy',target:'deliverables'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'storyboard',commentId:'c',sceneId:'s1'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'concepts',commentId:'c'},roomProject(),{tab:'overview',versionId:''}],
    [{tab:'draft'},drafted,{tab:'draft',versionId:''}],
    [{tab:'draft'},roomProject(),{tab:'overview',versionId:''}],
    // 의견 분류는 messageId도 함께 오지만 의견 칸(그 판)으로 — feedbackRoundId가 먼저다.
    [{tab:'review',feedbackRoundId:'r1',feedbackItemId:'i1',messageId:'m1',versionId:'v1'},done,{tab:'review',versionId:'v1'}],
    [{tab:'review',target:'approval',versionId:'v1'},done,{tab:'review',versionId:'v1'}],
    [{tab:'review',versionId:'v1'},done,{tab:'review',versionId:'v1'}],
    [{tab:'review',messageId:'staff-reply'},roomProject(),{tab:'contact',versionId:''}],
    [{tab:'review',commentId:'project-reply'},roomProject(),{tab:'contact',versionId:''}],
    [{tab:'history',versionId:'f1'},done,{tab:'review',versionId:'f1',focus:'delivery'}],
    [{tab:'history'},done,{tab:'review',versionId:'f2',focus:'delivery'}],
    [{tab:'desk'},roomProject(),{tab:'overview',versionId:''}],
    [{},roomProject(),{tab:'overview',versionId:''}],
  ];
  for(const [item,p,want] of rows)assert.deepEqual(roomRoute(item,p),want,JSON.stringify(item));
  const app=read('app.mjs');
  assert.match(app,/const routed=roomCustomer\(\)\?roomRoute\(item,s\.project\):null;/);
  assert.match(app,/\|\|routed\?\.focus==='delivery'&&main\.querySelector\('#review-delivery'\);/);
  assert.match(app,/else if\(routed\)window\.scrollTo\?\.\(0,0\);else main\.querySelector\('\[data-stage-content\]'\)/,'the room has no stage content to fall back on');
});

const ROOM_TABS={
  check:state(roomProject()),
  ask:state(roomProject({asks:[{id:'a',label:'로고 파일',why:'끝 화면에 얹어요',status:'open'}]})),
  direction:state(roomProject({status:'confirmed',directionProposal:direction})),
  model:state(roomProject({status:'confirmed',modelProposal:{modelId:'M06',status:'open',note:'잘 어울려요'}})),
  script:state(roomProject({status:'confirmed',rounds:[round()]}),{tab:'draft'}),
  images:state(roomProject({status:'confirmed',rounds:[round('images')]}),{tab:'draft'}),
  review:state(roomProject({status:'confirmed',approvedAt:at,rounds:[round('images')]},{stage:'review',versions:[preview]}),{tab:'review'}),
  deliver:state(delivered(),{tab:'history'}),
  contact:state(roomProject(),{tab:'contact'}),
  films:state(roomProject(),{tab:'films'}),
};

test('one head: the name leads back to the room, the number and five steps sit in the app header, and screens draw no step line (D1)',()=>{
  for(const [name,s] of Object.entries(ROOM_TABS)){
    const html=projectView(s),head=headerCrumb(s),actions=header({...s,desktopApp:false});
    assert.doesNotMatch(html,/class="sx-steps|sx-room-project|sx-dp-rail|sx-dr-back|sx-dr-left-foot|sx-room-bar/,name+': no second head or step line inside the screen');
    assert.match(head,/^<button type="button" class="sx-head-title" data-room-go="room" title="고객 방으로"><b class="crumb-title">오미톡<\/b><\/button><span class="crumb-no mono">P-2026-ABCD<\/span>/,name);
    assert.equal(head.split('class="sx-step ').length-1,5,name);assert.equal((head.match(/aria-current="page"/g)||[]).length<=1,true,name);
    assert.equal(actions.split('data-room-do="contact"').length-1,1,name+': one way to ask');assert.match(actions,/data-action="notifications"/,name+': notifications stay apart from asking');
  }
  assert.match(headerCrumb(ROOM_TABS.contact),/class="sx-step is-now"\s+data-room-go="check"/,'asking keeps the stage lit without claiming it');
  assert.match(header({...ROOM_TABS.contact,desktopApp:false}),/class="sx-head-ask is-now" data-room-do="contact" aria-current="page"/);
  assert.match(headerCrumb(ROOM_TABS.deliver),/class="sx-step is-now" aria-current="page"\s+data-room-go="review">영상 · 납품</);
  // 옛 프로젝트 머리는 그대로: 단계 낱말 · 전달일, 묻기 단추 없음.
  const old={mode:'customer',tab:'overview',live:{},project:{id:'old',title:'옛',stage:'review',versions:[],messages:[],studio:{scenes:[],concepts:[],references:[],assets:[],comments:[],sceneReviews:[]}}};
  assert.match(headerCrumb(old),/crumb-stage/);assert.doesNotMatch(header(old),/sx-head-ask/);assert.doesNotMatch(headerCrumb(old),/sx-head-steps/);
  const app=read('app.mjs');
  assert.match(app,/document\.documentElement\.classList\.toggle\('has-room-head',roomCustomer\(\)\)/,'the head look follows every render, so it never outlives the project');
  assert.match(app,/document\.querySelector\('\.app-header'\)\?\.addEventListener\('click',event=>\{if\(!roomCustomer\(\)\)return;/,'the head sits outside main, so it has its own listener');
  assert.match(app,/previousFocus=remote&&\(main\.contains\(document\.activeElement\)\|\|headBox\?\.contains\(document\.activeElement\)\)/,'live refresh keeps keyboard focus in the head (Fable N2)');
  const legacyCss=read('film-legacy.css'),css=read('film.css');
  assert.match(legacyCss,/html\.view-dr:not\(\.has-room-head\) \.app-header>\.header-crumb/,'the example head inside the screen keeps its name and steps');assert.match(legacyCss,/html\.has-room-head \.sx-dr-left,\.sx-dr:has\(>\.sx-room-bar\.is-head\) \.sx-dr-left\{padding-top:12px\}/,'no 56px gap under the in-flow phone head (Fable N4), in the example too');
  assert.match(css,/\.sx-head-steps\{flex:none;flex-wrap:nowrap/,'the wide head stays one line so it never covers the version picker (Fable N3)');
});

test('one place to ask: a contact screen with its own support form and the whole thread, from any screen (D6)',()=>{
  const p=roomProject({status:'confirmed',approvedAt:at,rounds:[round('images')]},{stage:'review',versions:[preview],messages:[{id:'q1',author:'customer',authorName:'나',action:'support',text:'언제 와요?',at},{id:'a1',author:'staff',authorName:'김하늘',text:'내일 보내 드려요',at},{id:'f1',author:'customer',authorName:'나',action:'feedback',versionId:'v1',seconds:2,text:'더 크게',at}]},{comments:[{id:'c1',targetType:'project',targetId:null,text:'프로젝트 답변이에요',author:'staff',authorName:'김하늘',at}]});
  const contact=projectView(state(p,{tab:'contact'}));
  assert.equal(contact.split('data-form="support"').length-1,1);assert.doesNotMatch(contact,/data-form="feedback"/,'typing a question never pins a video version');
  assert.match(contact,/언제 와요\?/);assert.match(contact,/내일 보내 드려요/);assert.match(contact,/프로젝트 답변이에요/);assert.doesNotMatch(contact,/더 크게/,'video notes stay on the video');
  assert.match(contact,/<article class="sx-thread-row" data-author="staff" data-message-id="a1"/,'a reply notification finds its line');
  assert.match(projectView(state(p,{tab:'contact',error:'그사이 답이 왔어요',conflict:true})),/role="alert"[\s\S]*data-action="refresh"/,'a stale send can be refreshed right there (Fable N5)');
  const review=projectView(state(p,{tab:'review',reviewPanel:'ask'}));
  assert.doesNotMatch(review,/data-panel="ask"|id="review-feedback"/,'the video screen has no second ask box');
  assert.match(review,/<div class="sx-panel" data-panel="note" >/,'a leftover ask panel state never hides the notes (Fable N8)');
  assert.match(review,/class="sx-small sx-link" data-room-do="contact">담당자에게 묻기</);
  const app=read('app.mjs');
  assert.match(app,/if\(type==='support'\)\{const text=String\(values\.text\|\|''\)\.trim\(\);if\(!text\)\{form\.elements\.text\.focus\(\);return;\}await mutate\(\(\)=>projectAction\('support',\{text\}\)/);
  assert.match(app,/if\(view==='contact'\)\{[^}]*main\.querySelector\('\[data-form="support"\] textarea'\)/);
  assert.doesNotMatch(app,/s\.tab='review';s\.reviewPanel='ask'/,'asking no longer borrows the video screen');
});

test('video and delivery are one screen: one player, the final first, files and the receipt in the pillar (D5 · D7 · D8)',()=>{
  for(const tab of ['history','review']){
    const html=projectView(state(delivered(),{tab}));
    assert.match(html,/^<div class="sx-review sx-dr sx-shell"/,tab);assert.match(html,/<video id="review-video" playsinline preload="metadata" src="[^"]*\/pulse\/api\/media\/f2" data-version="f2"/,tab+': the last final first');
    assert.doesNotMatch(html,/data-final|\scontrols[\s>=]/,tab+': no second player');assert.equal(html.split('data-film-toggle').length-1,1);assert.equal(html.split('data-review-full').length-1,1);
    assert.match(html,/<section class="sx-review-deliver" id="review-delivery" tabindex="-1" aria-label="납품">/);assert.doesNotMatch(html,/data-panel="note"|id="review-approval"/,tab+': no notes or approval on a final');
    assert.equal(html.split('>파일 받기<').length-1,2,'one row per final');assert.match(html,/<p class="sx-small sx-deliver-guide">릴스에 그대로 올리세요\.<\/p>/,'the guide is open before the receipt button');
    assert.match(html,/<p class="sx-review-line sx-serif">완성본을 받으세요<\/p>/);assert.ok(html.indexOf('>15초 최종본</span>')<html.indexOf('>세로 30초</span>'),'files in the same order as the version picker');
    assert.match(html,/data-action="confirm-delivery"/);
  }
  const first=projectView(state(delivered(),{tab:'review',versionId:'f1'}));assert.match(first,/data-version="f1"/);
  const looking=projectView(state(delivered(),{tab:'review',versionId:'v1'}));
  assert.match(looking,/최종본이 도착했어요[\s\S]*data-action="version-pick" data-id="f2"><span>최종본 보기/);assert.doesNotMatch(looking,/>파일 받기</,'the approved preview is not offered as the deliverable');
  const waiting=projectView(state(roomProject({status:'confirmed',approvedAt:at,rounds:[round('images')]},{stage:'review',versions:[approved]}),{tab:'review'}));
  assert.match(waiting,/시안 승인을 마쳤어요[\s\S]*최종 파일을 준비하고 있어요/);assert.doesNotMatch(waiting,/>파일 받기</,'D7a');
  const open=projectView(state(roomProject({status:'confirmed',rounds:[round('images')]},{stage:'review',versions:[preview]}),{tab:'review'}));
  assert.match(open,/>파일 받기</,'before approval a preview can still be taken');assert.match(open,/data-action="approve" data-id="v1"/);
  const got=projectView(state(delivered({closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:false,receipt:{confirmedAt:at},files:[]}}),{tab:'history'}));
  assert.match(got,/<b>수령 확인 완료<\/b>/);assert.doesNotMatch(got,/data-action="confirm-delivery"/);
  const early=projectView(state(delivered({stage:'review',closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:false,files:[]}}),{tab:'history'}));
  assert.doesNotMatch(early,/data-action="confirm-delivery"/,'the receipt waits for the server (D7b)');
  const specs=projectView(state(delivered({}),{tab:'history'}));assert.doesNotMatch(specs,/data-paper="deliverables"/);
  const review=read('film-review.mjs');
  assert.match(review,/video\.addEventListener\('click',\(\)=>\{if\(document\.fullscreenElement!==video\)toggle\(\);\},\{signal\}\);/,'Fable N1');
  assert.match(review,/if\(!video\|\|keysAreBusy\(\)\|\|withModifier\(event\)\|\|document\.fullscreenElement===video\)return;/,'Fable N1');
});

test('old tab roads close: strategy is the room, and changes, preparation and specs sit below it without links to absent screens (D9)',()=>{
  const p=roomProject({status:'confirmed'},{changes:{enabled:true,status:'changed',changes:[]},kickoff:{enabled:true,status:'waiting'}},{deliverables:{revision:2,request:{deliverableRevision:2},confirmation:null,items:[],history:[]}});
  const html=projectView(state(p,{tab:'strategy'}));
  assert.match(html,/^<div class="sx-room" data-state="prepare">/);assert.doesNotMatch(html,/data-form="strategy"/);
  for(const key of ['changes','kickoff','deliverables']){assert.match(html,new RegExp(`data-room-do="paper" data-paper="${key}"`),key);assert.match(html,new RegExp(`<div data-paper-for="${key}">`),key);}
  assert.doesNotMatch(html,/data-action="(changes-strategy|kickoff-reference|kickoff-strategy|tab)"/,'nothing leads to a screen this customer does not have');
  assert.match(html,/자료 더 보내기」로, 링크는 「담당자에게 묻기」로/,'Fable N6');assert.match(html,/class="section-gap panel-card deliverables-panel"/);
  const withSpecs=delivered();withSpecs.studio.deliverables={revision:2,items:[],history:[]};
  const specs=projectView(state(withSpecs,{tab:'history'}));
  assert.match(specs,/data-room-do="paper" data-paper="deliverables">납품 규격 보기/);
  const app=read('app.mjs');
  assert.match(app,/if\(action==='changes-strategy'\)\{if\(busy\|\|loading\)return;if\(roomCustomer\(\)\)\{showRoomPaper\('changes'\);return;\}/);
  assert.match(app,/onPaper:showRoomPaper/);
});

test('old projections (before 1b, before the mail step) draw every room tab with no error or empty words (D21)',()=>{
  const before1b=r=>roomProject({status:'confirmed',modelProposal:{modelId:'M06',status:'open'},...r});
  const projections={
    'model before 1b':before1b(),
    'script before 1b':before1b({modelProposal:{modelId:'M06',status:'accepted'},rounds:[round()]}),
    'direction before mail':roomProject({status:'confirmed',directionProposal:{...direction,at:undefined}}),
    'chosen before mail':roomProject({status:'confirmed',directionProposal:{...direction,status:'chosen',chosenId:'b',answer:''}}),
    'review before mail':roomProject({status:'confirmed',approvedAt:at,rounds:[round('images')]},{stage:'review',versions:[preview]}),
    'delivered without closeout':delivered({closeout:undefined}),
    'delivered without receipt':delivered({closeout:{deliveryKey:'k1',files:[]}}),
  };
  for(const [name,p] of Object.entries(projections))for(const tab of ['overview','draft','pick','review','history','contact','films','strategy','direction']){
    let html='';assert.doesNotThrow(()=>{html=projectView(state(p,{tab}));},`${name} · ${tab}`);
    assert.doesNotMatch(html,/undefined|NaN|>null</,`${name} · ${tab}`);
    assert.equal(headerCrumb(state(p,{tab})).split('class="sx-step ').length-1,5,`${name} · ${tab}`);
  }
});

test('the example (?demo=film) takes the customer road: one review screen for both scenes, one player, the same head (D11)',()=>{
  const demo=read('demo-film.mjs');
  assert.doesNotMatch(demo,/mountFinal/);assert.match(demo,/handle=mountReview\(root,\{previous:prior\}\);/);
  assert.match(demo,/onContact:\(\)=>say\(NOT_REAL\)/);assert.match(demo,/go\(state\.project\.stage==='delivered'\?'history':'review'\)/);
  assert.match(read('views.mjs'),/\$\{s\.example\?exampleHead\(roomInfo\(s\),\{tab:s\.tab\}\):''\}/);
  const room=roomView({...roomModel(roomProject()),title:'霜の肌理',number:'P-1104-7F3A'});
  assert.match(room,/<header class="sx-room-bar is-head"><a class="sx-logo"[^>]*>[\s\S]*<div class="header-crumb"><button type="button" class="sx-head-title" data-room-go="room"/);
});

test('photo orders say photo words while we prepare and make (판 2 Fable FA2)',()=>{
  const photo=r=>roomModel(roomProject({status:'confirmed',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'photo'},...r}));
  const prepare=roomView(photo({}));assert.match(prepare,/첫 장을 만들고 있어요/);assert.doesNotMatch(prepare,/글 콘티/);
  const make=roomView(photo({approvedAt:at}));assert.match(make,/확인하신 첫 장대로 만들고 있어요/);assert.doesNotMatch(make,/목소리와 음악/);
});

test('argon 3a: the example draft scenes keep the head, the ask hint only while a preview is open, the wide-tablet films road, the delivery words',()=>{
  const demo=read('demo-film.mjs');
  assert.match(demo,/root\.innerHTML=draftView\(SCRIPT,\{head:draftHead\}\);mountRoom\(root,/);assert.match(demo,/root\.innerHTML=draftView\(DRAFT,\{head:draftHead\}\);mountRoom\(root,/);
  assert.match(read('film-views.mjs'),/const host=root\.querySelector\('\.sx-room,\.sx-shell,\.sx-draft'\)/);
  const open=projectView(state(roomProject({status:'confirmed',rounds:[round('images')]},{stage:'review',versions:[preview]}),{tab:'contact'}));
  assert.match(open,/영상에서 고칠 곳은 「영상 · 납품」에서/);
  for(const p of [roomProject({status:'confirmed',approvedAt:at,rounds:[round('images')]},{stage:'review',versions:[approved]}),delivered()])assert.doesNotMatch(projectView(state(p,{tab:'contact'})),/영상에서 고칠 곳은/,'no notes can be left after approval');
  assert.match(read('film.css'),/\(min-width:821px\) and \(max-width:1000px\) and \(min-aspect-ratio:10001\/10000\)\{\.sx-head-steps \.sx-steps-foot\{display:none\}\.sx-room>\.sx-room-films\{display:block\}\}/);
  const done=projectView(state(delivered(),{tab:'history'}));
  // Fable 최종(11-08) P2: 1366×650 기둥에 들게 단추는 문장 뒤 같은 줄, 수령 확인 뒤에는 「언제든 다시」를 확인 줄에 합친다.
  assert.match(done,/파일은 여기서 언제든 다시 받으실 수 있어요\. 다른 형식이나 길이가 필요하면 담당자에게 알려 주세요\. <span class="sx-deliver-links"><button type="button" class="sx-link" data-room-do="contact">담당자에게 묻기<\/button><\/span><\/p>/);
  const got=projectView(state(delivered({closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:false,receipt:{confirmedAt:at},files:[]}}),{tab:'history'}));
  assert.match(got,/<\/time> · 파일은 여기서 언제든 다시 받으실 수 있어요\.<\/p>/);assert.match(got,/<p class="sx-small sx-deliver-foot">다른 형식이나 길이가/);
  // Fable 최종 P3: 지운 예시 머리 상수를 옛 납품 화면이 부르지 않는다(예시가 옛 길로 가면 화면이 비던 지뢰).
  assert.doesNotMatch(read('views.mjs'),/EXAMPLE_LOGO/);
  assert.match(read('film.css'),/\.sx-room-bar\.is-head::before\{content:'';position:absolute;z-index:-1;left:calc\(-1\*var\(--sx-m\)\)/,'the example head shade starts at the screen edge, not as a box (Fable -c FA2)');
  assert.match(read('film-legacy.css'),/html\.has-room-head \.sx-draft:not\(\[data-ratio="16:9"\]\) \.sx-dr-films,\.sx-draft:not\(\[data-ratio="16:9"\]\):has\(>\.sx-room-bar\.is-head\) \.sx-dr-films\{height:calc\(40vh - 50px\)/,'16:9 orders keep the picture height (Fable -c FA1)');
});
