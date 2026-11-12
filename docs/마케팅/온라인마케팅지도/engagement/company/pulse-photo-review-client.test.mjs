import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomModel,journalModel,deskModel,deskQueue} from './public/pulse-app/room-view.mjs';
import {projectView,dialogContent} from './public/pulse-app/views.mjs';
import {roomView,journalView} from './public/pulse-app/film-views.mjs';
import {installationEnvironment,installationGuide} from './public/pulse-app/install.mjs';
import {loadLocale,setLocale} from './public/pulse-app/i18n.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';

// 사진 상품(모델이 제품을 든 사진 5장)의 「사진이 도착한 뒤」(2026-11-12, docs/마케팅/PULSE_의뢰흐름_20261104/옷머리고르기_설계_20261110.md 12절):
// 확인 · 납품 화면과 고객 방 · 일지 · 담당자 화면이 사진 말을 쓰고, 영상 상품은 한 글자도 달라지지 않는다.
// 사진 말은 보이는 판이 영상이 아닐 때만 — 사진 상품에 영상 파일을 올린 드문 판은 시각 · 재생이 살아 있어 영상 말 그대로다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const at='2026-11-12T03:00:00.000Z';
const shot=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:at,media:{url:'/pulse/api/media/'+id,mimeType:'image/jpeg',fileName:id+'.jpg'},...extra});
const clip=(id,label,kind='preview',extra={})=>({id,kind,label,createdAt:at,media:{url:'/pulse/api/media/'+id,mimeType:'video/mp4',fileName:id+'.mp4'},...extra});
const rounds=(extra={})=>({drafts:[],rounds:[],latestVersionId:'',latestVersionLabel:'',canDraft:true,maxItems:20,nextNumber:1,...extra});
function project(pkg,{versions=[],stage='review',feedback={},request={},extra={}}={}){
  return {id:'p1',title:'오미톡',ownerName:'김하늘',stage,revision:4,versions,messages:[],requestFlow:true,...extra,
    studio:{assets:[],scenes:[{id:'s1',revision:1,duration:3,description:'캔을 든 반신',title:'첫 장',visibility:'customer',assetId:'img-a'}],comments:[],sceneReviews:[],strategy:{revision:1,data:{castingSelection:{modelId:'F02'}},request:null,confirmation:null},
      feedbackRounds:rounds({latestVersionId:versions.filter(v=>v.kind==='preview').at(-1)?.id||'',...feedback}),
      request:{status:'confirmed',number:'P-1112-ABCD',submittedAt:at,confirmedAt:at,approvedAt:at,approvedRound:1,paymentFlow:true,payment:{status:'confirmed',confirmedAt:at},answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:pkg,models:['F02'],contactName:'김합성'},files:[],asks:[],notes:[],rounds:[{round:1,kind:'images',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:at,approvedAt:at}],...request}}};
}
const state=(p,extra={})=>({mode:'customer',tab:'review',live:{},versionId:'',project:p,...extra});
const VIDEO_WORDS=/영상|장면 이미지|순간|재생|길이가|자막|다음 편|data-live-clock/;

test('the photo review screen speaks of photos: tag, sentence, note box without a clock, and nothing about films',()=>{
  const p=project('photo',{versions:[shot('v1','1차 사진')]}),html=projectView(state(p));
  assert.match(html,/<p class="sx-small">사진 확인 · /);
  assert.match(html,/<p class="sx-review-line sx-serif">1차 사진이에요\. 바꿀 곳이 있으면 의견을 남겨 주세요\.<\/p>/);
  assert.match(html,/<div class="sx-say-row"><textarea name="text" rows="1" required maxlength="3000" placeholder="이 사진에 남길 의견" aria-label="이 사진에 남길 의견" data-grow>/,'no clock in front of the note box');
  assert.match(html,/<input type="hidden" name="seconds" value="">/,'the form still sends an empty time');
  assert.match(html,/<p class="sx-j-hint" data-when="typing">사진에서 고칠 곳은 <span class="is-wide">오른쪽<\/span><span class="is-phone">사진 아래<\/span> 의견 칸에 남겨 주세요\.<\/p>/);
  assert.match(html,/<p id="video-error" class="sx-small sx-review-error" data-photo-error hidden>사진을 불러오지 못했어요\. 인터넷 연결을 확인하고, 계속 안 되면 담당자에게 알려 주세요\.<\/p>/);
  assert.match(html,/<div class="sx-dr-box" data-film-box><button type="button" class="sx-dr-zoom" data-action="image" data-src="[^"]*\/pulse\/api\/media\/v1" data-label="1차 사진" data-close="닫기" aria-label="1차 사진 크게 보기"><img src="[^"]*\/pulse\/api\/media\/v1" alt="1차 사진" data-photo-shot><\/button><\/div>/,'the photo itself, no player — press it to see it larger');
  assert.doesNotMatch(html,VIDEO_WORDS);
  // 영상 상품은 그대로다.
  const film=projectView(state(project('s15',{versions:[clip('v1','1차 시안')]})));
  assert.match(film,/<p class="sx-small">영상 확인 · /);assert.match(film,/1차 시안이에요\. 바꿀 곳이 있으면 그 순간에 의견을 남겨 주세요\./);
  assert.match(film,/<div class="sx-say-row"><output class="sx-no sx-say-clock round-clock" data-live-clock>0:00<\/output><textarea name="text" rows="1" required maxlength="3000" placeholder="이 순간에 남길 의견" aria-label="이 순간에 남길 의견" data-grow>/);
  assert.match(film,/영상에서 고칠 곳은 <span class="is-wide">오른쪽<\/span><span class="is-phone">영상 아래<\/span> 의견 칸에, 그 장면에서 남겨 주세요\./);
  assert.match(film,/<p id="video-error" class="sx-small sx-review-error" hidden>영상을 재생하지 못했어요\./);assert.doesNotMatch(film,/data-photo-error|사진 확인|이 사진에/);
  // 영상 상품에 그림 판을 올린 경우도 전과 같다(사진 말은 사진 상품에만).
  const still=projectView(state(project('s15',{versions:[shot('v1','표지 시안')]})));
  assert.match(still,/영상 확인 · /);assert.match(still,/data-live-clock>0:00/);assert.match(still,/그 순간에 의견을 남겨 주세요/);assert.doesNotMatch(still,/data-photo-error|is-plain|data-photo-shot|sx-dr-zoom/);assert.match(still,/<div class="sx-dr-box" data-film-box><img src="[^"]*\/pulse\/api\/media\/v1" alt="표지 시안"><\/div>/,'a still on a film order stays a plain picture');
});

test('notes on a photo carry no time column, drafts and sent alike; a film keeps the time or 「전체」',()=>{
  const feedback={drafts:[{id:'d1',current:true,versionId:'v2',versionLabel:'2차 사진',items:[{id:'i1',text:'라벨을 또렷하게',seconds:null}]},{id:'d0',current:false,versionId:'v1',versionLabel:'1차 사진',items:[{id:'i0',text:'옛 초안',seconds:null}]}],rounds:[{id:'r1',number:1,versionId:'v1',versionLabel:'1차 사진',representativeName:'김합성',submittedAt:at,items:[{id:'x1',text:'배경을 밝게',seconds:null,resolved:false}]}],nextNumber:2};
  const html=projectView(state(project('photo',{versions:[shot('v1','1차 사진'),shot('v2','2차 사진')],feedback})));
  assert.match(html,/<article class="sx-note-row is-draft is-plain" ><div><p class="sx-body">라벨을 또렷하게<\/p>/);
  assert.match(html,/<article class="sx-note-row is-plain"><div><p class="sx-body">옛 초안<\/p>/);
  assert.match(html,/<article class="sx-note-row is-plain"  data-message-id="" data-feedback-round-id="r1" data-feedback-item-id="x1" tabindex="-1"><div><p class="sx-small">1차 · 김합성 · 반영 중<\/p>/);
  assert.doesNotMatch(html,/>전체<\/span>/);
  assert.match(html,/2차 사진이에요\. 바꿀 곳이 있으면 의견을 남겨 주세요\./,'no customer notes on the earlier preview in messages — the open sentence');
  assert.match(read('film-legacy.css'),/\.sx-note-row\.is-plain\{grid-template-columns:minmax\(0,1fr\)\}/);
  const film=projectView(state(project('s15',{versions:[clip('v1','1차 시안'),clip('v2','2차 시안')],feedback})));
  assert.match(film,/<article class="sx-note-row is-draft" ><span class="sx-no sx-ko">전체<\/span><div>/);
  assert.match(film,/<article class="sx-note-row"><span class="sx-no">전체<\/span><div>/);
  assert.match(film,/<article class="sx-note-row"  data-message-id="" data-feedback-round-id="r1" data-feedback-item-id="x1" tabindex="-1"><span class="sx-no sx-ko">전체<\/span><div>/);
  assert.doesNotMatch(film,/is-plain/);
  // 사진 상품에 영상 파일을 올린 판: 시각이 살아 있어 시계 · 시각 줄 · 영상 말 그대로(시각 없는 의견만 칸 없이).
  const mixed=projectView(state(project('photo',{versions:[clip('v1','움직이는 시안')],feedback:{drafts:[{id:'d1',current:true,versionId:'v1',versionLabel:'움직이는 시안',items:[{id:'i1',text:'3초쯤',seconds:3},{id:'i2',text:'전체로',seconds:null}]}]}})));
  assert.match(mixed,/영상 확인 · /);assert.match(mixed,/data-live-clock>0:00/);assert.match(mixed,/placeholder="이 순간에 남길 의견"/);assert.match(mixed,/data-action="seek" data-version="v1" data-seconds="3">0:03<\/button>/);
  assert.match(mixed,/<article class="sx-note-row is-draft is-plain" ><div><p class="sx-body">전체로<\/p>/);
});

test('an earlier photo says the new one is here without speaking of a film, and delivery asks about size, not length',()=>{
  const p=project('photo',{versions:[shot('v1','1차 사진'),shot('v2','2차 사진')]});
  const old=projectView(state(p,{versionId:'v1'}));
  assert.match(old,/새 시안이 도착했어요\. 보던 사진과 쓰던 의견은 그대로 있어요\./);assert.doesNotMatch(old,/보던 영상과/);
  assert.match(projectView(state(project('s15',{versions:[clip('v1','1차 시안'),clip('v2','2차 시안')]}),{versionId:'v1'})),/새 시안이 도착했어요\. 보던 영상과 쓰던 의견은 그대로 있어요\./);
  const done=(pkg,make)=>project(pkg,{stage:'delivered',versions:[make('v1','1차','preview',{approvedAt:at}),make('f1','완성 1','final',{guide:'온라인 광고에 쓰세요.',approvedPreviewId:'v1'}),make('f2','완성 2','final',{guide:'SNS에 쓰세요.',approvedPreviewId:'v1'})],extra:{closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:true,files:[{id:'f1',label:'완성 1'},{id:'f2',label:'완성 2'}]}}});
  const delivery=projectView(state(done('photo',shot)));
  assert.match(delivery,/<p class="sx-small">최종본 · /);assert.match(delivery,/다른 형식이나 크기가 필요하면 담당자에게 알려 주세요\./);assert.doesNotMatch(delivery,VIDEO_WORDS);
  assert.match(projectView(state(done('s15',clip))),/다른 형식이나 길이가 필요하면 담당자에게 알려 주세요\./);
});

test('the room hangs the arrived photos where a film order plays its film, and the closing card speaks of the next photos',()=>{
  const review=project('photo',{versions:[shot('v1','1차 사진'),shot('v2','2차 사진')]}),info=roomModel(review);
  assert.equal(info.state,'review');assert.deepEqual(info.shots,[{src:'/pulse/api/media/v2',label:'2차 사진'}],'the latest preview only');assert.equal(info.film,null);
  const room=roomView(info);
  assert.match(room,/<div class="sx-room-files is-shots" data-count="1"><img src="\/pulse\/api\/media\/v2" alt="2차 사진" decoding="async"><\/div><button type="button" class="sx-room-play" data-room-go="review"><span class="sr">사진 보기<\/span><\/button><p class="sx-small sx-room-cap">2차 사진<\/p>/);
  assert.doesNotMatch(room,/저희가 만든 광고의 한 장면이에요|w-gift/);
  const finals=[shot('v1','1차 사진','preview',{approvedAt:at}),...[1,2,3,4,5].map(n=>shot('f'+n,'완성 사진 '+n,'final',{guide:'안내',approvedPreviewId:'v1'}))];
  const delivered=project('photo',{stage:'delivered',versions:finals,extra:{closeout:{deliveryKey:'k1',canConfirm:true,files:[]}}});
  const got=roomModel(delivered);assert.equal(got.state,'deliver');assert.equal(got.shots.length,5);
  assert.match(roomView(got),/<div class="sx-room-files is-shots" data-count="5">(<img src="\/pulse\/api\/media\/f\d" alt="완성 사진 \d" decoding="async">){5}<\/div>/);assert.match(roomView(got),/<p class="sx-small sx-room-cap">완성 사진 5장<\/p>/);
  const closed=roomView(roomModel({...delivered,closeout:{deliveryKey:'k1',receipt:{confirmedAt:at},files:[]}}));
  assert.match(closed,/data-state="done"/);assert.match(closed,/같은 모델로 다음 사진을 이어 만들 수 있어요\. 담당자에게 알려 주세요/);assert.match(closed,/완성 사진 5장/);assert.doesNotMatch(closed,/자막 규격|다음 편/);
  // 그림 파일이 아닌 판(묶음 파일 · 링크)만 왔으면 걸 사진이 없다 — 전처럼 저희 작품의 한 장면.
  const zip=roomModel(project('photo',{versions:[{id:'v1',kind:'preview',label:'1차 묶음',createdAt:at,media:{url:'/pulse/api/media/v1',mimeType:'application/zip',fileName:'a.zip'}}]}));
  assert.equal('shots' in zip,false);assert.match(roomView(zip),/저희가 만든 광고의 한 장면이에요/);
  // 영상 상품의 방은 모양이 전과 같다(키가 없다).
  const film=roomModel(project('s15',{versions:[clip('v1','1차 시안')]}));assert.equal('shots' in film,false);assert.equal(film.film.src,'/pulse/api/media/v1');
  const filmStill=roomModel(project('s15',{versions:[shot('v1','표지')]}));assert.equal('shots' in filmStill,false);
  const filmDone=roomView(roomModel({...project('s15',{stage:'delivered',versions:[clip('v1','1차','preview',{approvedAt:at}),clip('f1','최종','final',{approvedPreviewId:'v1'})]}),closeout:{deliveryKey:'k1',receipt:{confirmedAt:at},files:[]}}));
  assert.match(filmDone,/같은 모델 · 같은 자막 규격으로 다음 편을 이어 만들 수 있어요\. 담당자에게 알려 주세요/);
});

test('the journal says notes went to the photo, and the ask box hint follows the product only while a preview is open',()=>{
  const sent=pkg=>project(pkg,{versions:[pkg==='photo'?shot('v1','1차 사진'):clip('v1','1차 시안')],feedback:{rounds:[{id:'r1',number:1,versionId:'v1',versionLabel:'',representativeName:'김합성',submittedAt:at,items:[{id:'x1',text:'a',seconds:null},{id:'x2',text:'b',seconds:null}]}]}});
  assert.equal(journalModel(sent('photo')).items.find(item=>item.id==='f:r1').what,'사진에 의견 2개를 보냈어요');
  assert.equal(journalModel(sent('s15')).items.find(item=>item.id==='f:r1').what,'영상에 의견 2개를 보냈어요');
  const j=journalModel(sent('photo'));
  assert.match(journalView(j,{place:'side',video:true,photo:true}),/사진에서 고칠 곳은/);
  assert.match(journalView(j,{place:'side',video:true}),/영상에서 고칠 곳은/);
  assert.doesNotMatch(journalView(j,{place:'side',photo:true}),/sx-j-hint/,'no hint once the preview is approved or final');
});

test('the staff desk names a photo order in photo words, and a film order as before',()=>{
  const photo=project('photo',{versions:[shot('v1','1차 사진')]}),film=project('s15',{versions:[clip('v1','1차 시안')]});
  const queue=list=>deskQueue(list).map(item=>item.state);
  const waiting=pkg=>{const p=project(pkg,{stage:'planning'});p.studio.request={...p.studio.request,approvedAt:'',approvedRound:null,rounds:[{round:1,kind:'images',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:at}]};return p;};
  const scripted=pkg=>{const p=waiting(pkg);p.studio.request={...p.studio.request,scriptApprovedAt:at,rounds:[{round:1,kind:'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:at,approvedAt:at}]};return p;};
  assert.deepEqual(queue([photo,waiting('photo'),scripted('photo')]),['사진 확인 중','첫 장을 보는 중','첫 장 준비 중']);
  assert.deepEqual(queue([film,waiting('s15'),scripted('s15')]),['영상 확인 중','장면 이미지를 보는 중','장면 이미지 준비 중']);
  const made=project('photo',{stage:'producing'});assert.deepEqual(queue([made,project('s15',{stage:'producing'})]),['제작 중','제작 중'],'the shared words stay shared');
  const model=deskModel({...photo,studio:{...photo.studio,request:{...photo.studio.request,progressFeed:true,progress:[{id:'n1',state:'posted',stage:'review',text:'고르는 중이에요',at,postedAt:at,assets:[]}]}},mail:{connection:'on',recipient:'set',moments:{images_ready:{state:'sent',at},preview_ready:{state:'pending'}}}});
  assert.equal(model.photo,true);assert.equal('photo' in deskModel(film),false,'a film order keeps the earlier shape');
  const desk=deskView({...model,queue:[],canEdit:true},{bar:false});
  assert.match(desk,/<b>1판 · 첫 장<\/b>/);
  assert.match(desk,/<p class="desk-at">첫 장은 결제 전에도 보내요\. 첫 장을 승인받은 뒤의 판과 시안은 결제를 확인한 뒤에 보내요\. 크몽에서는/);
  assert.match(desk,/손님에게 올림 · [^<]* · 사진 · 납품<\/b>/);
  assert.match(desk,/<li>첫 장 · Gmail에 넘김 [^<]*<\/li><li>사진 확인 · 보낼 차례<\/li>/);
  assert.doesNotMatch(desk.replace(/data-tab="review">영상 확인</,''),/장면 이미지|영상 · 납품|영상 확인/,'only the staff tab keeps its tool name');
  const filmDesk=deskView({...deskModel({...film,studio:{...film.studio,request:{...film.studio.request,progressFeed:true,progress:[{id:'n1',state:'posted',stage:'review',text:'고르는 중이에요',at,postedAt:at,assets:[]}]}},mail:{connection:'on',recipient:'set',moments:{images_ready:{state:'sent',at},preview_ready:{state:'pending'}}}}),queue:[],canEdit:true},{bar:false});
  assert.match(filmDesk,/<b>1판 · 장면 이미지<\/b>/);assert.match(filmDesk,/<p class="desk-at">장면 이미지 판과 시안은 결제를 확인한 뒤에 보내요\. 크몽에서는/);assert.match(filmDesk,/ · 영상 · 납품<\/b>/);assert.match(filmDesk,/<li>장면 이미지 · Gmail에 넘김 [^<]*<\/li><li>영상 확인 · 보낼 차례<\/li>/);
  // 담당자 창: 작업 소식의 단계 이름 · 결제 확인 · 결제 취소.
  assert.match(dialogContent('desk-progress',{photo:true,stage:'review'}),/<option value="review" selected>사진 · 납품<\/option>/);
  assert.match(dialogContent('desk-progress',{stage:'review'}),/<option value="review" selected>영상 · 납품<\/option>/);
  assert.match(dialogContent('desk-pay-confirm',{photo:true}),/시안을 보낼 수 있게 되고\(첫 장을 이미 승인받았으면 이때 제작이 시작돼요\), 받으실 날은/);
  assert.match(dialogContent('desk-pay-confirm',{}),/장면 이미지 판을 보낼 수 있게 되고, 받으실 날은/);
  assert.match(dialogContent('desk-pay-cancel',{photo:true}),/첫 장 뒤의 판 · 시안을 다시 보내려면/);assert.match(dialogContent('desk-pay-cancel',{}),/장면 이미지 · 시안을 다시 보내려면/);
  const app=read('app.mjs');
  assert.match(app,/openDialog\('desk-progress',\{\.\.\.trOf\(\),\.\.\.\(model\.photo\?\{photo:true\}:\{\}\),/);
  assert.match(app,/dueDate:model\.payDays\?kst\.toISOString\(\)\.slice\(0,10\):'',\.\.\.\(model\.photo\?\{photo:true\}:\{\}\)\}\);/);
});

test('the first sheet dialog does not wait for a payment that is already confirmed; a photo that fails to load says so; English is in place',()=>{
  const app=read('app.mjs');
  assert.match(app,/photo\?\(s\.project\?\.studio\?\.request\?\.payment\?\.status==='confirmed'\?t\('이 첫 장과 같은 결로 나머지 장을 만들어요\. 결제가 확인돼 있어 바로 시작해요\.'\):t\('이 첫 장과 같은 결로 나머지 장을 만들어요\. 결제가 확인되면 시작해요\.'\)\):t\('이 장면 이미지로 소리와 영상을 만들어요\./);
  // 사진을 못 불러오면 그림을 숨기고 사진 상품의 안내만 연다(영상 상품의 그림 판은 전과 같이 조용히 숨는다).
  assert.match(app,/media\.hidden=true;if\(media\.closest\('\[data-film-box\]'\)\)\{const error=document\.querySelector\('#video-error\[data-photo-error\]'\);if\(error\)error\.hidden=false;\}/);
  const en=read('i18n/en.mjs');
  for(const key of ['사진 확인','{name}{josa}. 바꿀 곳이 있으면 의견을 남겨 주세요.','새 시안이 도착했어요. 보던 사진과 쓰던 의견은 그대로 있어요.','사진을 불러오지 못했어요. 인터넷 연결을 확인하고, 계속 안 되면 담당자에게 알려 주세요.','다른 형식이나 크기가 필요하면 담당자에게 알려 주세요.','이 사진에 남길 의견','사진에서 고칠 곳은 {where} 의견 칸에 남겨 주세요.','완성 사진 {count}장','사진에 의견 {count}개를 보냈어요','같은 모델로 다음 사진을 이어 만들 수 있어요. 담당자에게 알려 주세요','이 첫 장과 같은 결로 나머지 장을 만들어요. 결제가 확인돼 있어 바로 시작해요.'])assert.ok(en.includes(`"${key}":`),key);
  assert.ok(en.includes('[`where${C}사진 아래`]:'));
});

// ── 검수 반영(2026-11-13): 사진의 비율 · 크게 보기 · 다섯 장 격자 · 영어 판 · 남은 글 ──
test('a photo takes its own shape and opens larger; five finished photos fill the room without an empty cell',()=>{
  // 상자: 불러와진 사진의 비율로 --r · data-shape를 맞춘다(영상의 규칙과 같은 문턱). 영상 줄은 그대로다.
  const review=read('film-review.mjs');
  assert.match(review,/const shot=\$\('\[data-film-box\] img\[data-photo-shot\]'\);\s*if\(shot\)\{const fit=\(\)=>\{if\(!shot\.naturalWidth\|\|!shot\.naturalHeight\)return;const ratio=shot\.naturalWidth\/shot\.naturalHeight;host\.style\.setProperty\('--r',String\(ratio\)\);host\.dataset\.shape=ratio>1\.1\?'wide':ratio<\.9\?'tall':'square';\};shot\.addEventListener\('load',fit,\{signal\}\);fit\(\);\}/);
  assert.match(review,/const setShape=\(\)=>\{if\(!video\|\|!box\|\|!video\.videoWidth\)return;const ratio=video\.videoWidth\/video\.videoHeight;host\.style\.setProperty\('--r',String\(ratio\)\);host\.dataset\.shape=ratio>1\.1\?'wide':ratio<\.9\?'tall':'square';\};/);
  const legacy=read('film-legacy.css');
  assert.match(legacy,/\.sx-dr-zoom\{display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in\}/);
  assert.match(legacy,/\.sx-dr-zoom:focus-visible\{outline:2px solid var\(--sx-ink\);outline-offset:2px\}/);
  // 크게 보기: 기존 그림 창을 쓰고, 닫기 이름표만 화면 언어로 넘긴다(다른 화면이 여는 그림 창은 전과 같다).
  assert.match(dialogContent('image',{src:'/pulse/api/media/v1',label:'1차 사진',closeLabel:'닫기'}),/^<button class="dialog-close" type="button" data-action="close-dialog" aria-label="닫기">×<\/button><img src="\/pulse\/api\/media\/v1" alt="1차 사진" /);
  assert.match(dialogContent('image',{src:'/pulse/api/media/v1',label:'참고'}),/aria-label="이미지 닫기">×<\/button>/);
  assert.match(read('app.mjs'),/if\(action==='image'\)\{openDialog\('image',\{src:button\.dataset\.src,label:button\.dataset\.label,\.\.\.\(button\.dataset\.close\?\{closeLabel:button\.dataset\.close\}:\{\}\)\}\);if\(button\.dataset\.close\)dialog\.classList\.add\('is-photo'\);return;\}/);
  assert.ok(legacy.includes('html.sx #app-dialog.image-dialog.is-photo .dialog-close{text-shadow:0 0 6px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.8)}'),'the close mark stays visible over a bright photo');
  // 휴대폰 폭: 사진 창은 화면 폭을 다 쓴다(상자 안의 사진보다 작아지지 않게). 다른 그림 창은 표식이 없어 그대로다.
  assert.match(legacy,/@media \(max-width:820px\)\{html\.sx #app-dialog\.image-dialog\.is-photo\{width:100vw;max-width:100vw;max-height:100dvh;margin-inline:0\}html\.sx #app-dialog\.image-dialog\.is-photo img\{width:100%;max-height:calc\(100dvh - 44px\)\}\}/);
  // 최종본도 같은 단추다(납품 화면).
  const done=project('photo',{stage:'delivered',versions:[shot('v1','1차','preview',{approvedAt:at}),shot('f1','완성 1','final',{approvedPreviewId:'v1'})],extra:{closeout:{deliveryKey:'k1',approvedPreviewId:'v1',canConfirm:true,files:[{id:'f1',label:'완성 1'}]}}});
  assert.match(projectView(state(done)),/<button type="button" class="sx-dr-zoom" data-action="image" data-src="[^"]*\/pulse\/api\/media\/f1" data-label="완성 1" data-close="닫기" aria-label="완성 1 크게 보기"><img /);
  // 다섯 장: 6열 격자에 윗줄 두 장(3열씩) · 아랫줄 석 장(2열씩). 받은 자료 칸(표식 없음)의 격자는 그대로다.
  const film=read('film.css');
  assert.match(film,/\.sx-room-files\.is-shots\[data-count="5"\]\{grid-template-columns:repeat\(6,1fr\)\}\s*\.sx-room-files\.is-shots\[data-count="5"\] img\{grid-column:span 2\}\s*\.sx-room-files\.is-shots\[data-count="5"\] img:nth-child\(-n\+2\)\{grid-column:span 3\}/);
  assert.match(film,/\.sx-room-files:is\(\[data-count="5"\],\[data-count="6"\]\)\{grid-template-columns:repeat\(3,1fr\);grid-template-rows:repeat\(2,1fr\)\}/);
  assert.equal((read('film-views.mjs').match(/sx-room-files is-shots/g)||[]).length,1,'only the photo order\'s own photos carry the mark');
});

test('the leftover film words on a photo order: install note, the send dialog, the news example, a cancelled payment',()=>{
  const env=installationEnvironment({userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36'});
  const notes=options=>installationGuide(env,{connected:true,...options}).notes.join(' ');
  assert.match(notes({photo:true}),/설치하지 않아도 브라우저에서 사진 확인, 수정 의견, 승인을 할 수 있어요\./);assert.doesNotMatch(notes({photo:true}),/영상/);
  assert.match(notes({}),/설치하지 않아도 브라우저에서 영상 확인, 수정 의견, 승인을 할 수 있어요\./);
  const app=read('app.mjs');
  assert.match(app,/canPrompt:!!s\.installPrompt,\.\.\.\(s\.project\?\.studio\?\.request\?\.answers\?\.package==='photo'\?\{photo:true\}:\{\}\)\}\)/);
  assert.match(app,/openDialog\('desk-send',\{\.\.\.trOf\(\),\.\.\.\(st\.request\?\.answers\?\.package==='photo'\?\{photo:true,confirmed:st\.request\?\.payment\?\.status==='confirmed'\}:\{\}\),flow:/);
  // 새 판 보내기 창: 사진 의뢰는 「첫 장 · n장」, 다음 걸음은 결제 전 · 뒤에 맞게(결제 전 승인은 제작을 시작하지 않는다 — 서버 approve_draft).
  const send=item=>dialogContent('desk-send',{count:1,oneLine:'한 줄',flow:true,...item});
  assert.match(send({photo:true,kind:'images',paid:true,confirmed:false}),/<h2 id="dialog-title">고객에게 첫 장을 보낼까요\?<\/h2><p>1장을 보내요\. 모든 장에 그림이 있어요\. 고객이 승인해도 제작은 크몽 결제를 확인한 뒤에 시작해요\.<\/p>/);
  assert.match(send({photo:true,kind:'images',paid:true,confirmed:true}),/<p>1장을 보내요\. 모든 장에 그림이 있어요\. 고객이 승인하면 제작을 시작해요\.<\/p>/);
  assert.match(send({photo:true,kind:'images',paid:false,confirmed:false}),/첫 장을 승인받은 뒤의 판은 크몽 결제를 확인한 뒤에 보낼 수 있어요 — 지금은 글 콘티 판으로 보내요\.<\/p>/);
  assert.match(send({photo:true,kind:'script',paid:true}),/<h2 id="dialog-title">고객에게 글 콘티를 보낼까요\?<\/h2><p>1장을 보내요\. 그림이 빠진 장이 있어 글 콘티로 보내요\. 고객이 확인하면 첫 장을 준비해요\.<\/p>/);
  for(const item of [{kind:'images',paid:true,confirmed:false},{kind:'images',paid:true,confirmed:true},{kind:'images',paid:false},{kind:'script',paid:true}])assert.doesNotMatch(send({photo:true,...item}).split('<form')[0],/장면 이미지|컷/);
  assert.match(send({kind:'images',paid:true}),/<h2 id="dialog-title">고객에게 장면 이미지를 보낼까요\?<\/h2><p>1컷을 보내요\. 모든 컷에 장면 이미지가 있어요\. 고객이 확인하면 제작 단계로 넘어가요\.<\/p>/);
  assert.match(send({kind:'images',paid:false}),/장면 이미지 판은 크몽 결제를 확인한 뒤에 보낼 수 있어요 — 지금은 글 콘티 판으로 보내요\.<\/p>/);
  assert.match(send({kind:'script',paid:true}),/<h2 id="dialog-title">고객에게 글 콘티를 보낼까요\?<\/h2><p>1컷을 보내요\. 그림이 빠진 컷이 있어 글 콘티로 보내요\. 고객이 확인하면 장면 이미지를 준비해요\.<\/p>/);
  // 시안 · 최종본 올리기 양식: 사진 의뢰에만 올리는 법 한 줄(판 하나에 파일 하나 — 서버 addVersion).
  const views=read('views.mjs');
  assert.match(views,/\$\{isPhoto\(s\.project\)\?'<p class="small" data-photo-upload-note>사진 의뢰: 판 하나에 파일 하나예요\. 시안을 장마다 따로 올리면 마지막 장만 최신 시안이 되고 앞 장은 수정 전 판으로 보여요 — 시안은 한 장에 모아 올리고, 최종본은 장마다 따로 올려요\(고객 방에 여섯 장까지 나란히 걸려요\)\.<\/p>':''\}<div class="button-row">\$\{submit\('고객에게 보내기'\)\}/);
  // 작업 소식 창의 예시 글.
  assert.match(dialogContent('desk-progress',{photo:true}),/placeholder="예\) 둘째 장을 만들고 있어요\. 손 모양을 다듬는 중이에요\."/);
  assert.match(dialogContent('desk-progress',{}),/placeholder="예\) 2번 컷 장면 이미지를 그리고 있어요\. 손 모양을 다듬는 중이에요\."/);
  // 결제가 취소된 방: 사진 의뢰에는 글 콘티가 없다.
  const cancelled=pkg=>{const p=project(pkg,{stage:'planning'});p.studio.request={...p.studio.request,approvedAt:'',approvedRound:null,scriptApprovedAt:pkg==='photo'?'':at,rounds:[{round:1,kind:pkg==='photo'?'images':'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:at,approvedAt:at}],payment:{status:'cancelled',requestedAt:at,cancelledAt:at,amount:150000}};return roomView(roomModel(p));};
  assert.match(cancelled('photo'),/다시 진행하시려면 담당자에게 알려 주세요\. 보내 주신 자료는 그대로 있어요\./);assert.doesNotMatch(cancelled('photo'),/글 콘티/);
  assert.match(cancelled('s15'),/다시 진행하시려면 담당자에게 알려 주세요\. 보내 주신 자료와 글 콘티는 그대로 있어요\./);
});

test('in English a photo order never reads film or watch on the review, approval and delivery screens',async()=>{
  const approve=item=>dialogContent('approve',{id:'v1',label:'1차 사진',revision:3,...item});
  const stale={drafts:[{id:'d0',current:false,versionId:'v1',versionLabel:'1차 사진',items:[{id:'i0',text:'NOTE',seconds:null}]}],nextNumber:1};
  const finals=make=>[make('v2','2차','preview',{approvedAt:at}),make('f1','F1','final',{guide:'G',approvedPreviewId:'v2'})];
  const screens=(pkg,make)=>{
    const review=project(pkg,{versions:[make('v1','V1'),make('v2','V2')],feedback:stale});
    const ready=project(pkg,{versions:[make('v1','V1')]});
    const done=project(pkg,{stage:'delivered',versions:finals(make),feedback:{canDraft:false},extra:{closeout:{deliveryKey:'k1',approvedPreviewId:'v2',canConfirm:true,files:[{id:'f1',label:'F1'}]}}});
    return [projectView(state(ready)),projectView(state(review)),projectView(state(review,{versionId:'v1'})),projectView(state(done)),projectView(state(done,{versionId:'v2'})),roomView(roomModel(done)),approve(pkg==='photo'?{photo:true}:{})].join('\n');
  };
  // 한국어는 문맥이 붙어도 글자가 같다.
  const ko=screens('photo',shot);
  for(const text of ['이 시안으로 최종본을 만들까요?','최종본이 도착했어요','최종본 보기','<p class="sx-small">최종본 · ','이 시안대로 최종본을 만드는 데 동의합니다.','이 초안은 지금 시안으로 보내지지 않아요. 새 시안을 본 뒤 필요한 의견을 다시 적어 주세요.'])assert.ok(ko.includes(text),text);
  assert.equal(await loadLocale('en'),true);
  try{
    await setLocale('en');
    const photo=screens('photo',shot),words=photo.replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/g,' ').replace(/<[^>]*?(?:aria-label|placeholder|alt|title)="([^"]*)"[^>]*>/g,' $1 ').replace(/<[^>]+>/g,' ');
    assert.doesNotMatch(words,/\b(?:films?|watch(?:ing|ed)?|videos?|clips?|footage)\b/i);
    for(const text of ['Photo review · ','Make the final photos from this preview?','Your final photos are here','See the final photos','Final photos · ','I agree to have the final photos made as shown.','After looking at the new one, write down any notes you still need.','aria-label="View V1 larger"','data-close="Close"'])assert.ok(photo.includes(text),text);
    const film=screens('s15',clip);
    for(const text of ['Film review · ','Make the final film from this preview?','Your final film is here','See the final film','Final film · ','I agree to have the final film made as shown.','After watching the new one, write down any notes you still need.'])assert.ok(film.includes(text),text);
    assert.match(installationGuide(installationEnvironment({userAgent:'Chrome/130.0'}),{connected:true,photo:true}).notes.join(' '),/you can review photos, leave notes and approve in your browser\./);
  }finally{await setLocale('ko');}
  // 승인 창 · 승인 알림은 사진 판일 때만 사진 문맥으로 부른다.
  const app=read('app.mjs');
  // 사진 상품이고 그 판이 영상이 아닐 때만(views.mjs reviewRoom의 photo와 같은 규칙).
  assert.match(app,/openDialog\('approve',\{\.\.\.latest,revision:s\.project\.revision,\.\.\.\(s\.project\.studio\?\.request\?\.answers\?\.package==='photo'&&!latest\.media\?\.mimeType\?\.startsWith\('video\/'\)\?\{photo:true\}:\{\}\)\}\);/);
  assert.match(app,/const still=s\.project\.studio\?\.request\?\.answers\?\.package==='photo'&&!latestPreview\(\)\?\.media\?\.mimeType\?\.startsWith\('video\/'\);if\(id!==latestPreview\(\)\?\.id\)/);
  assert.match(app,/message:still\?t\('시안을 승인했어요\. 이 시안으로 최종본을 만들어요\.',null,'photo'\):t\('시안을 승인했어요\. 이 시안으로 최종본을 만들어요\.'\),after:closeDialog/);
  assert.match(app,/notice\(still\?t\('새 시안이 왔어요\. 최신 시안을 보고 승인해 주세요\.',null,'photo'\):t\('새 시안이 왔어요\. 최신 시안을 보고 승인해 주세요\.'\)\);/);
  const en=read('i18n/en.mjs'),TICK=String.fromCharCode(96);
  for(const key of ['최종본','이 시안으로 최종본을 만들까요?','최종본이 도착했어요','최종본 보기','이 시안의 내용과 표현을 확인했고, 이 시안대로 최종본을 만드는 데 동의합니다.','이 초안은 지금 시안으로 보내지지 않아요. 새 시안을 본 뒤 필요한 의견을 다시 적어 주세요.','새 시안이 왔어요. 최신 시안을 보고 승인해 주세요.','시안을 승인했어요. 이 시안으로 최종본을 만들어요.'])assert.ok(en.includes('['+TICK+'photo$'+'{C}'+key+TICK+']:'),key);
  for(const key of ['{name} 크게 보기','설치하지 않아도 브라우저에서 사진 확인, 수정 의견, 승인을 할 수 있어요.','다시 진행하시려면 담당자에게 알려 주세요. 보내 주신 자료는 그대로 있어요.'])assert.ok(en.includes('"'+key+'":'),key);
});
