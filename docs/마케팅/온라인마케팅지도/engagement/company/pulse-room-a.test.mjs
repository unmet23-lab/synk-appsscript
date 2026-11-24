// 고객 앱 방 다시 짓기 2판 ①「방 틀과 머리」(2026-11-24, 설계 docs/디자인/PULSE고객앱_다시짓기_20261124/방_설계.md 「① 때 더할 시험」).
// 머리 다섯 칸 막대와 아이콘 셋, 「더 보기」 차림, 의뢰서 서랍, 상태마다의 무대, 모델 제안의 복도, 기기 기억 안내, 다시 그린 뒤 초점과 서랍 둘을 지킨다.
// 브라우저 동작(넘침 · 초점 이동 · 캡처)은 캡처 도구가 실제 서버로 본다 — 여기서는 그리는 글과 갈래를 잠근다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');
const {roomModel}=await import('./public/pulse-app/room-view.mjs');
const {roomRail,roomHead,roomView,briefView,exampleHead}=await import('./public/pulse-app/film-views.mjs');
const {header,headerCrumb,projectView,headMore,roomBriefView}=await import('./public/pulse-app/views.mjs');
const {CASTING_MODELS}=await import('./public/pulse-app/casting-catalog.mjs');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');

const at=n=>new Date(Date.UTC(2026,10,20,3,n)).toISOString();
const asset=(id,author='staff')=>({id,mimeType:'image/png',fileName:id+'.png',url:'/pulse/api/studio/media/'+id,author});
const video=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:at(30),media:{url:'/pulse/api/media/'+id,mimeType:'video/mp4',fileName:id+'.mp4'},...extra});
const scene=(id,extra={})=>({id,revision:1,title:'첫 컷',description:'벤치 위 캔',duration:3,visibility:'customer',...extra});
const NUMBER='P-2026-ABCD';
function project({r={},extra={},models=['F02'],pkg='s15',assets=[],scenes=[scene('s1')]}={}){
  return {id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',revision:4,versions:[],messages:[],requestFlow:true,...extra,
    studio:{assets,scenes,comments:[],sceneReviews:[],strategy:{revision:1,data:{castingSelection:{modelId:models[0]||'',outfit:'',hair:''}},request:null,confirmation:null},
      feedbackRounds:{drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1},
      request:{status:'submitted',number:NUMBER,submittedAt:at(1),answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:pkg,models},files:[],asks:[],notes:[],rounds:[],...r}}};
}
const state=(p,extra={})=>({mode:'customer',tab:'overview',live:{},versionId:'',desktopApp:false,project:p,...extra});
const script=(extra={})=>({round:1,kind:'script',oneLine:'한 캔에 맛이 다섯 번',scenes:[{id:'s1',revision:1}],sentAt:at(2),...extra});
const images=(extra={})=>({round:2,kind:'images',oneLine:'한 캔에 맛이 다섯 번',scenes:[{id:'s1',revision:1}],sentAt:at(4),...extra});
const pictured=(r={},extra={})=>project({r:{status:'confirmed',scriptApprovedAt:at(3),rounds:[script({approvedAt:at(3)}),images()],...r},scenes:[scene('s1',{assetId:'a1'})],assets:[asset('a1')],...extra});
const direction=(extra={})=>({round:1,status:'chosen',chosenId:'a',answeredAt:at(3),lead:'두 방향으로 나눴어요.',at:at(2),modelId:'F02',price:390000,dueDate:'2026-11-27',revisions:2,
  options:[{id:'a',name:'아니, 잠깐',sentence:'한 문장',flow:[{at:'0:00',text:'처음'}],why:'왜',assetId:'d1',recommended:true},{id:'b',name:'톡',sentence:'한 문장',flow:[{at:'0:00',text:'처음'}],why:'왜',assetId:'d2',recommended:false}],...extra});
const stageOf=html=>{const kind=(html.match(/<section class="sx-room-a" data-stage="([^"]*)">/)||[])[1];const body=(html.match(/<div class="sx-room-stage" data-room-stage>([\s\S]*?)<\/div>\n/)||[])[1]||'';return {kind,body,first:body.split('<template data-stage-next>')[0],next:body.split('<template data-stage-next>').slice(1)};};
const room=(p,patch={},options={})=>roomView({...roomModel(p),...patch},options);

test('the head bar: five stage buttons with the old lock rules and the name inside each button, one spoken-free stage line, and three icons',()=>{
  const cases=[
    ['check',project(),{now:'check',open:['request','check']}],
    ['script',project({r:{status:'confirmed',rounds:[script()]}}),{now:'draft',open:['request','check','draft']}],
    ['review',pictured({},{extra:{stage:'review',versions:[video('v1','1차 시안')]}}),{now:'review',open:['request','check','draft','make','review']}],
  ];
  for(const [name,p,{now,open}] of cases){
    const rail=roomRail(roomModel(p)),steps=[...rail.matchAll(/<button type="button" class="sx-step ([^"]*)" ([^>]*)data-room-go="(\w+)">([^<]+)<\/button>/g)];
    assert.deepEqual(steps.map(step=>step[3]),['request','check','draft','make','review'],name);
    assert.deepEqual(steps.map(step=>step[4]),['의뢰서','담당자 검토','영상 전 확인','제작','영상 · 납품'],name+': the stage name is plain text inside the button (auto reply facts read it)');
    assert.deepEqual(steps.filter(step=>!/disabled/.test(step[2])).map(step=>step[3]),open,name+': lock rules');
    assert.deepEqual(steps.filter(step=>/is-now/.test(step[1])).map(step=>step[3]),[now],name);
    assert.match(rail,new RegExp(`<span class="sx-head-stage" aria-hidden="true">${steps.find(step=>/is-now/.test(step[1]))[4]}</span></nav>$`),name+': the stage line beside the bar is decoration');
  }
  // 사진 상품은 셋째 · 다섯째 칸 이름이 사진 말이다.
  assert.match(roomRail(roomModel(project({pkg:'photo'}))),/data-room-go="draft">첫 장 확인<\/button>[^]*data-room-go="review">사진 · 납품<\/button>/);
  // 왼쪽은 로고 · 이름만(번호 없음), 줄 끝 입구 셋은 「더 보기」로 옮겼다.
  const s=state(project()),crumb=headerCrumb(s);
  assert.match(crumb,/^<button type="button" class="sx-head-title" data-room-go="room" title="고객 방으로"><b class="crumb-title">오미톡<\/b><\/button>/);
  assert.doesNotMatch(crumb,/crumb-no|sx-steps-foot|data-room-go="(films|marketing|people)"/);
  // 오른쪽: 아이콘 단추 셋(의뢰서 · 나눈 말 · 더 보기), 그림 아래 이름.
  const actions=header(s);
  const icons=[...actions.matchAll(/<button type="button" class="(?:sx-head-ask )?sx-head-icon"[^>]*data-room-do="(\w+)"[^>]*><svg class="sx-head-glyph[^"]*"[^>]*>[^]*?<\/svg><span>([^<]+)<\/span>/g)].map(match=>[match[1],match[2]]);
  assert.deepEqual(icons,[['brief','의뢰서'],['journal','나눈 말'],['more','더 보기']]);
  assert.match(actions,/data-room-do="brief" aria-controls="room-brief-box" aria-expanded="false"/);
  // 예시 머리도 같은 머리, 오른쪽은 의뢰서 · 나눈 말 둘.
  const demo=exampleHead({...roomModel(project()),films:true});
  assert.ok(demo.includes(roomHead({...roomModel(project()),films:true})));
  assert.deepEqual([...demo.matchAll(/data-room-do="(brief|journal|more)"/g)].map(match=>match[1]),['brief','journal']);
});

test('「더 보기」: the old entries under their old switches, a coral dot for something new, and it stays open across a redraw',()=>{
  const p=project({r:{status:'confirmed'},extra:{stage:'producing'}}),s=state(p);
  const items=html=>[...html.matchAll(/class="[^"]*\bsx-more-item\b[^"]*"(?:[^>]*data-room-(?:go|do)="([\w-]+)"|[^>]*data-action="([\w-]+)")/g)].map(match=>match[1]||match[2]);
  assert.deepEqual(items(headMore(s)),['films','notifications','install'],'SYNK 작품 · 알림 · 앱 설치');
  assert.deepEqual(items(headMore({...s,desktopApp:true})),['films','notifications'],'the PC app window has no install entry');
  const on={marketing:{projectId:'p1',on:true,status:'ready',heads:[],picks:{},reports:{}},people:{projectId:'p1',on:true},myModelsOn:true};
  const make=state(pictured({},{extra:{stage:'producing'}}),on);
  assert.equal(roomModel(make.project).stage,'make');
  assert.deepEqual(items(headMore(make)),['films','marketing','people','my-models','notifications','install']);
  assert.deepEqual(items(headMore({...make,marketing:{...on.marketing,projectId:'other'}})),['films','people','my-models','notifications','install'],'another project\'s switch is ignored');
  // 열림은 s.moreOpen — 머리를 통째로 다시 써도 열린 채로 그린다.
  assert.match(headMore(s),/data-room-do="more" aria-expanded="false" aria-controls="room-more">[^]*<div class="sx-more" id="room-more" hidden>/);
  assert.match(headMore({...s,moreOpen:true}),/data-room-do="more" aria-expanded="true" aria-controls="room-more">[^]*<div class="sx-more" id="room-more">/);
  assert.match(header({...s,moreOpen:true}),/<div class="sx-more" id="room-more">/);
  // 새 것(읽지 않은 알림 · 값 안내가 온 인플루언서 광고)이 있으면 아이콘에 점.
  assert.match(headMore(s),/<i class="sx-head-new" data-more-new aria-hidden="true" hidden><\/i>/);
  assert.match(headMore({...s,live:{unreadCount:2}}),/<i class="sx-head-new" data-more-new aria-hidden="true"><\/i>[^]*>알림 2</);
  const app=read('app.mjs');
  assert.match(app,/function setMore\(open,\{focus=false\}=\{\}\)\{\s*s\.moreOpen=!!open;/);
  assert.match(app,/if\(s\.moreOpen\)setMore\(false,\{focus:true\}\);\}\);/,'Esc closes it last and puts the focus back on its button');
});

test('the reference number sits only in the pay card and the brief drawer',()=>{
  const count=html=>html.split(NUMBER).length-1;
  const pay=project({r:{status:'confirmed',payment:{status:'requested',amount:390000,requestedAt:at(5)},rounds:[script({approvedAt:at(3)})],scriptApprovedAt:at(3)}});
  assert.equal(roomModel(pay).state,'pay');
  for(const [name,p] of [['check',project()],['script',project({r:{status:'confirmed',rounds:[script()]}})],['pay',pay],['review',pictured({},{extra:{stage:'review',versions:[video('v1','1차 시안')]}})]]){
    const s=state(p),page=projectView(s);
    assert.equal(count(header(s)+headerCrumb(s)),0,name+': not in the head');
    const card=page.match(/<ol class="sx-pay-steps[^]*?<\/ol>/)?.[0]||'';
    assert.equal(count(page.replace(card,'')),0,name+': not elsewhere in the room');
    assert.equal(count(card),name==='pay'?2:0,name+': the pay card shows it with its copy button');
    assert.match(roomBriefView(s),new RegExp(`<p class="sx-brief-no"><span class="sx-small">접수 번호</span> <b class="sx-no">${NUMBER}</b> <button type="button" class="sx-quiet" data-room-do="copy-number" data-number="${NUMBER}">번호 복사</button></p>`),name+': at the top of the brief drawer');
  }
});

test('the brief drawer is drawn for every customer room screen and the example, and the stage bar and paper buttons open it at that paper',()=>{
  const people=pictured({},{extra:{stage:'producing'}});
  const screens={
    room:state(project()),
    direction:state(project({r:{status:'confirmed',directionProposal:direction({status:'open',chosenId:'',answeredAt:''})}})),
    draft:state(project({r:{status:'confirmed',rounds:[script()]}}),{tab:'draft'}),
    review:state(pictured({},{extra:{stage:'review',versions:[video('v1','1차 시안')]}}),{tab:'review'}),
    films:state(project(),{tab:'films'}),
    marketing:state(project(),{tab:'marketing',marketing:{projectId:'p1',on:true,status:'loading',heads:[],picks:{},reports:{}}}),
    people:state(people,{tab:'people',people:{projectId:'p1',on:true,status:'ready',channels:[]}}),
  };
  for(const [name,s] of Object.entries(screens)){
    assert.match(header(s),/data-room-do="brief" aria-controls="room-brief-box"/,name+': the head icon');
    const box=roomBriefView(s);
    assert.match(box,/^<div class="sx-brief-scrim" data-brief-do="close" hidden><\/div><aside class="sx-brief" id="room-brief-box" data-brief role="dialog" aria-modal="true" aria-labelledby="room-brief-title">/,name);
    assert.match(roomBriefView({...s,briefOpen:true}),/<div class="sx-brief-scrim" data-brief-do="close"><\/div><aside class="sx-brief is-open"/,name+': open state survives a live redraw');
    assert.doesNotMatch(projectView(s),/id="room-brief-box"/,name+': drawn once, outside main');
  }
  assert.equal(roomBriefView({...screens.room,mode:'staff'}),'','not for staff');
  // 그리는 자리는 main 밖 한 곳, 듣개도 앱 한 곳.
  assert.match(read('index.html'),/<div id="room-brief"><\/div>/);
  const app=read('app.mjs');
  assert.match(app,/briefHost\.innerHTML=s\.project&&roomCustomer\(\)\?roomBriefView\(s\):''/);
  assert.match(app,/if\(stage==='request'\)\{if\(roomState\(s\.project\)==='write'\)openProjectRequest\(\);else openBrief\(\);return;\}/,'the first stage button opens the drawer (writing: the request form)');
  assert.match(app,/function showRoomPaper\(name\)\{openBrief\(\{paper:name\}\);\}/);
  assert.match(app,/if\(roomState\(s\.project\)==='write'\)\{openProjectRequest\(\);return;\}/,'the head icon in the writing state opens the request form');
  assert.match(read('film-views.mjs'),/const at=paper&&box\?\.querySelector\(`\[data-paper-for="\$\{CSS\.escape\(paper\)\}"\]`\);\s*if\(at\)\{at\.setAttribute\('tabindex','-1'\);at\.scrollIntoView/,'opened at that paper');
  assert.match(read('views.mjs'),/<div data-paper-for="\$\{key\}">/);
  // 예시: 같은 서랍을 화면 안에 그리고 연다.
  const demo=read('demo-film.mjs');
  assert.match(demo,/root\.innerHTML=projectView\(state\)\+exampleBrief\(\);/);
  assert.match(demo,/root\.innerHTML=draftView\(SCRIPT,\{head:draftHead,journal:sideJournal\('script'\)\}\)\+exampleBrief\(\);/);
  assert.match(demo,/onGo:to=>\{if\(to==='request'\)openExampleBrief\(root\);/);
  // 서랍 안: 의뢰서 칸과 받은 자료.
  const brief=briefView(roomModel(project({r:{files:[{id:'c1',slot:'front',fileName:'c1.png'}]},assets:[asset('c1','customer')]})));
  assert.match(brief,/<section class="sx-brief-doc">[^]*<h3>받은 자료 <span class="sx-no">1<\/span><\/h3>/);
});

test('the stage follows the table for every state: preview first, then the state picture, then the fallback order — it never folds',()=>{
  const walk=id=>new RegExp(`^<div class="sx-hall is-one" data-hall-one data-hall-key="one:${id}" role="img"`);
  const check=project();
  // 의뢰서 쓰기: 입장의 멈춘 복도(꾸밈이라 inert).
  const write=stageOf(room(project({r:{status:'writing',submittedAt:''}})));
  assert.equal(write.kind,'hall');assert.match(write.first,/^<div class="sx-room-hall" inert><div class="sx-hall" data-hall [^>]*data-hall-key="stopped"/);
  // 저희 차례 · 되묻기 · 결제 · 글 콘티: 고른 모델이 걷는 띠.
  for(const name of ['check','ask','redirect','prepare','make','pay','script']){
    const stage=stageOf(room(check,{state:name}));
    assert.equal(stage.kind,'fall',name);assert.match(stage.first,walk('F02'),name);assert.match(stage.first,/data-walk="/,name);
  }
  // 저희 차례에 그림이 든 소식이 있으면 그 그림과 「작업 중인 화면이에요」.
  const news=project({r:{status:'confirmed',progress:[{id:'n1',state:'posted',at:at(9),postedAt:at(9),stage:'make',text:'컷 둘을 마쳤어요.',assets:['a2']}]},assets:[asset('a2')]});
  const withNews=room(news,{state:'make',news:{id:'n1',at:at(9),pictures:['/pulse/api/studio/media/a2']}});
  assert.equal(stageOf(withNews).kind,'news');assert.match(withNews,/작업 중인 화면이에요 · 완성본이 아니에요/);
  // 장면 이미지 도착 · 의견 반영: 그 판의 컷 띠(읽기만). 글만 든 판(장면 이미지 준비 · 글 콘티 의견 반영)은 컷 카드.
  const cuts=stageOf(room(pictured()));assert.equal(cuts.kind,'cuts');assert.match(cuts.first,/^<ol class="sx-room-cutrow" data-count="1"/);
  assert.equal(stageOf(room(pictured(),{state:'revise'})).kind,'cuts');
  const written={'prepare-images':project({r:{status:'confirmed',scriptApprovedAt:at(3),payment:{status:'confirmed',amount:390000,requestedAt:at(4),confirmedAt:at(5)},rounds:[script({approvedAt:at(3)})]}}),revise:project({r:{status:'confirmed',rounds:[script({feedbackAt:at(3)})]}})};
  for(const [name,p] of Object.entries(written)){assert.equal(roomModel(p).state,name);const stage=stageOf(room(p));assert.equal(stage.kind,'script',name);assert.match(stage.first,/^<div class="sx-room-word"><p class="sx-serif">한 캔에 맛이 다섯 번<\/p><ol><li><span class="sx-no">01<\/span><span class="sx-small">벤치 위 캔<\/span><\/li><\/ol><\/div>$/,name);}
  // 영상 · 납품 · 끝: 시안 · 최종본 포스터. 올린 판은 어느 상태든 먼저(모델 제안 차례만 빼고).
  const reviewed=pictured({},{extra:{stage:'review',versions:[video('v1','1차 시안')]}});
  for(const name of ['review','deliver','done','make','check'])assert.equal(stageOf(room(reviewed,{state:name})).kind,'preview',name);
  // 모델 제안: 모든 모델의 복도(가운데는 제안 모델), 누르면 가운데로 온다는 안내.
  const proposed=project({r:{status:'confirmed',modelProposal:{modelId:'M06',status:'open',note:'',at:at(2)}}});
  const model=room(proposed);assert.equal(stageOf(model).kind,'models');
  for(const {id} of CASTING_MODELS)assert.ok(model.includes(`data-hall-id="${id}"`),id);
  assert.match(model,/data-hall-key="models:M06:[^"]+" role="group" aria-label="모델 고르기"/);assert.match(model,/<p class="sx-small sx-room-hint">사진을 누르면 그 모델이 가운데로 와요<\/p>/);
  assert.equal(stageOf(room(proposed,{film:{src:'/pulse/api/media/v1',label:'1차 시안'}})).kind,'models','the proposal turn keeps the corridor');
  // 사진 상품의 결제: 확인한 첫 장.
  const photoPay=project({pkg:'photo',r:{status:'confirmed',payment:{status:'requested',amount:1,requestedAt:at(5)},rounds:[images({round:1,approvedAt:at(5)})]},scenes:[scene('s1',{assetId:'a1'})],assets:[asset('a1')]});
  assert.equal(roomModel(photoPay).state,'pay');assert.match(stageOf(room(photoPay)).first,/^<img class="sx-q-fill" src="[^"]*\/pulse\/api\/studio\/media\/a1" data-cap alt="" decoding="async">$/);
  // 맞춤 인물이 지금 차례면 인물 그림 한 장.
  const persona={id:'11111111-1111-4111-8111-111111111111',kind:'virtual',status:'reference_review',step:4,turn:'customer',name:'',why:'',request:{look:'',use:'',keep:'once'},sources:{identity:0,mood:0,files:[]},canAddSources:false,quote:null,
    revision:{id:'r1',number:1,reference:{assets:[{id:'33333333-3333-4333-8333-333333333333',mimeType:'image/png',url:'/pulse/api/persona/media/33333333-3333-4333-8333-333333333333'}],note:'',at:at(6)},motion:null},usage:null,awaiting:{kind:'reference',revisionId:'r1',viewedHash:'a'.repeat(64)},events:[],approvals:[]};
  const turn=stageOf(room(project({extra:{persona}})));assert.equal(turn.kind,'persona');assert.match(turn.first,/^<img class="sx-q-fill" src="\/pulse\/api\/persona\/media\/33333333/);
  // 모델 없는 의뢰: 고른 모델이 없으니 멈춘 복도.
  const none=stageOf(room(project({models:[]})));assert.equal(none.kind,'fall');assert.match(none.first,/data-hall-key="stopped"/);assert.doesNotMatch(none.body,/data-hall-one/);
  // 1판 복도에 없는 모델(M03): 걷는 띠 대신 앱의 모델 사진(영상 없음).
  const m03=stageOf(room(project({models:['M03']})));
  assert.match(m03.first,walk('M03'));assert.match(m03.first,/<img src="\.\/assets\/casting\/m03\.webp"/);assert.doesNotMatch(m03.first,/data-walk|<video/);
  // 대체 순서: 고른 모델의 띠 → 받은 자료의 첫 사진 → 방향 그림 → 모델 장면 그림 → 멈춘 복도.
  const full=project({r:{status:'confirmed',files:[{id:'c1',slot:'front',fileName:'c1.png'}],directionProposal:direction()},assets:[asset('c1','customer'),asset('d1'),asset('d2')]});
  const chain=stageOf(room(full,{state:'make'}));
  assert.match(chain.first,walk('F02'));
  assert.deepEqual(chain.next.map(html=>html.match(/media\/(c1|d1)"|model-scene-f02|data-hall-key="stopped"/)?.[0]),['media/c1"','media/d1"','model-scene-f02','data-hall-key="stopped"']);
  // 어느 경우에도 무대를 접지 않는다.
  for(const html of [write.body,none.body,chain.body])assert.ok(html.length>0);
  assert.doesNotMatch(read('film-views.mjs'),/is-no-screen/);
});

test('the model proposal: a strip tap only brings that model to the centre, the main button sends, and the words go under the card',()=>{
  const proposed=project({r:{status:'confirmed',modelProposal:{modelId:'M06',status:'open',note:'',at:at(2)}}});
  const plain=room(proposed);
  assert.match(plain,/<div class="sx-room-go" data-room-in data-room-pick-go><button type="button" class="sx-go is-solid" data-room-do="model-accept"><span>이 모델로 할게요<\/span>/);
  const picked=room(proposed,{},{ui:{pick:'F02'}});
  assert.match(picked,/data-room-pick-go><button type="button" class="sx-go is-solid" data-room-model="F02"><span>하린으로 바꿀게요<\/span>/);
  assert.notEqual(plain.match(/data-first="(\d+)"/)[1],picked.match(/data-first="(\d+)"/)[1],'the corridor starts at the picked model after a redraw');
  // 「말로 알려 주기」는 카드 아래 폼을 펼친다(양식 이름 model-say 그대로).
  assert.match(plain,/data-room-do="model-say" aria-expanded="false" aria-controls="room-model-say"/);
  assert.match(plain,/<form class="sx-propose-say" id="room-model-say" data-form="model-say" data-model-say hidden>/);
  const views=read('film-views.mjs'),hall=read('hall.mjs');
  const handler=views.slice(views.indexOf("host.addEventListener('sx-hall-pick'"),views.indexOf('// 모델 제안 카드의 옷 · 머리'));
  assert.ok(handler.length>0);assert.doesNotMatch(handler,/onModel|studioAction|submit/,'a tap on the corridor never sends');
  assert.match(handler,/ui\.pick=id===proposal\?'':id;/);
  assert.match(hall,/const picked=\(\)=>box\.dispatchEvent\(new CustomEvent\('sx-hall-pick',\{bubbles:true,detail:\{id:strips\[cur\]\?\.dataset\.hallId\|\|''\}\}\)\);/);
  assert.match(views,/const model=event\.target\.closest\('\[data-room-model\]'\)\?\.dataset\.roomModel;if\(model\)\{onModel\?\.\(\{modelId:model\}\);return;\}/,'the main button sends the picked model');
  assert.match(views,/if\(what==='model-accept'\)onModel\?\.\(\{accept:true,/);
  assert.match(read('app.mjs'),/function answerModel\(values\)\{[^}]*studioAction\('answer_model',values\)/);
  // 실시간 다시 그리기에도 고르던 모델이 남는다(옷 · 머리 줄이 없는 제안도 같은 열쇠).
  assert.match(plain,/^<div class="sx-room" data-state="model" data-room-a data-propose-key="M06:[^"]+">/);
});

test('the remember-device notice keeps its full text and both buttons, below the stage on a wide window and at the end of the panel on a phone',()=>{
  const html=projectView(state(project(),{rememberOffer:true}));
  const tail=html.match(/<div class="sx-room-tail">([^]*?)<\/div>\s*<\/div>\s*<\/section>/)?.[1]||'';
  assert.match(tail,/<aside class="sx-offer remember-offer" aria-label="이 기기 기억하기"><strong>다음에도 이 기기에서 바로 열까요\?<\/strong><p class="sx-small">「이 기기 기억하기」를 누르면 30일 동안/);
  assert.match(tail,/data-action="remember-device">이 기기 기억하기<\/button><button type="button" class="sx-small sx-link" data-action="remember-dismiss">괜찮아요<\/button>/);
  assert.ok(html.indexOf('class="sx-room-stage"')<html.indexOf('class="sx-room-tail"')&&html.indexOf('class="sx-room-right"')<html.indexOf('class="sx-room-stage"'),'under the stage in the right column');
  assert.doesNotMatch(projectView(state(project())),/remember-offer/);
  const css=read('film.css'),phone=css.slice(css.indexOf('/* 휴대폰 · 세로 화면: 무대가 위'));
  assert.match(phone,/\.sx-room-right\{display:contents\}[^]*\.sx-room-stage\{order:-1;[^]*\.sx-room-side\{order:0;[^]*\.sx-room-tail\{order:1;/,'phone: stage, panel, then the notice');
});

test('after a redraw the focus stays where it was (head, drawer or room), and the two drawers never open together',()=>{
  const app=read('app.mjs');
  assert.match(app,/focusKey=previousFocus\?\{head:!!headBox\?\.contains\(previousFocus\),brief:!!briefHost\?\.contains\(previousFocus\),more:!!previousFocus\.closest\('#room-more'\),/);
  assert.match(app,/replacement=\(focusKey\.brief\?\[\.\.\.inBrief,\.\.\.inMain,\.\.\.inHead\]:focusKey\.head\?\[\.\.\.inHead,\.\.\.inMain\]:\[\.\.\.inMain,\.\.\.inHead\]\)/,'the same data-room-go lives in the head and in the room: search where the focus was first');
  assert.match(app,/else if\(focusKey\.more\)headBox\?\.querySelector\('\[data-room-do="more"\]'\)\?\.focus\(\{preventScroll:true\}\);/,'a closed menu hands the focus to its button');
  // 하나를 열면 다른 하나를 닫는다(앱 · 예시).
  assert.match(app,/function openJournal\(\{target='',opener=null\}=\{\}\)\{\s*if\(target\)keepWhole\(target\);\s*closeMore\(\);if\(s\.briefOpen\)\{s\.briefOpen=false;s\.briefAt='';setBriefOpen\(false\);/);
  assert.match(app,/closeMore\(\);if\(s\.journalOpen\)\{s\.journalOpen=false;setJournalOpen\(false\);opener=opener\|\|journalOpener;journalOpener=null;\}/);
  const demo=read('demo-film.mjs');
  assert.match(demo,/function openExampleBrief\(root,opener=null\)\{\s*const journal=root\.querySelector\('\[data-journal\]\.is-open'\);if\(journal\)\{journalSetOpen\(root,false\);/);
  assert.match(demo,/if\(root\.querySelector\('\[data-brief\]\.is-open'\)\)briefSetOpen\(root,false\);exampleOpener=opener;journalSetOpen\(root,true\);/);
  // 잠금 표식이 달라 한쪽을 풀어도 다른 쪽이 풀리지 않는다.
  const views=read('film-views.mjs');
  assert.match(views,/export function briefRelease\(\)\{for\(const node of document\.querySelectorAll\('\[data-brief-inert\]'\)\)\{node\.inert=false;/);
  assert.match(views,/export function journalRelease\(\)\{for\(const node of document\.querySelectorAll\('\[data-journal-inert\]'\)\)\{node\.inert=false;/);
  // Esc: 의견 시트 · 대화상자 → 일지 → 의뢰서 서랍 → 「더 보기」.
  assert.match(app,/if\(s\.journalOpen\)\{closeJournal\(\);return;\}if\(s\.briefOpen\)\{closeBrief\(\);return;\}if\(s\.moreOpen\)setMore\(false,\{focus:true\}\);/);
});

test('the new room keeps to the screen rules: no style attributes, every new word in the English dictionary, no internal names',async()=>{
  const en=(await import('./public/pulse-app/i18n/en.mjs')).default;
  for(const html of [projectView(state(project(),{rememberOffer:true})),header(state(project())),roomBriefView(state(project())),room(project({r:{status:'confirmed',modelProposal:{modelId:'M06',status:'open',note:'',at:at(2)}}}))])assert.doesNotMatch(html,/\sstyle="/);
  for(const key of ['더 보기','의뢰서','지난 결정','모델 고르기','사진을 누르면 그 모델이 가운데로 와요','말로 알려 주기','{name}{ro} 바꿀게요','보내 주신 의뢰서','번호 복사'])assert.ok(Object.hasOwn(en,key),key);
  for(const name of ['film-views.mjs','views.mjs','hall.mjs','room-view.mjs','film.css','demo-film.mjs'])assert.doesNotMatch(read(name),/유호님/,name);
});
