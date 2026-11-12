import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomModel,journalModel,deskModel,deskQueue} from './public/pulse-app/room-view.mjs';
import {projectView,dialogContent} from './public/pulse-app/views.mjs';
import {roomView,journalView} from './public/pulse-app/film-views.mjs';
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
  assert.match(html,/<div class="sx-dr-box" data-film-box><img src="[^"]*\/pulse\/api\/media\/v1" alt="1차 사진"><\/div>/,'the photo itself, no player');
  assert.doesNotMatch(html,VIDEO_WORDS);
  // 영상 상품은 그대로다.
  const film=projectView(state(project('s15',{versions:[clip('v1','1차 시안')]})));
  assert.match(film,/<p class="sx-small">영상 확인 · /);assert.match(film,/1차 시안이에요\. 바꿀 곳이 있으면 그 순간에 의견을 남겨 주세요\./);
  assert.match(film,/<div class="sx-say-row"><output class="sx-no sx-say-clock round-clock" data-live-clock>0:00<\/output><textarea name="text" rows="1" required maxlength="3000" placeholder="이 순간에 남길 의견" aria-label="이 순간에 남길 의견" data-grow>/);
  assert.match(film,/영상에서 고칠 곳은 <span class="is-wide">오른쪽<\/span><span class="is-phone">영상 아래<\/span> 의견 칸에, 그 장면에서 남겨 주세요\./);
  assert.match(film,/<p id="video-error" class="sx-small sx-review-error" hidden>영상을 재생하지 못했어요\./);assert.doesNotMatch(film,/data-photo-error|사진 확인|이 사진에/);
  // 영상 상품에 그림 판을 올린 경우도 전과 같다(사진 말은 사진 상품에만).
  const still=projectView(state(project('s15',{versions:[shot('v1','표지 시안')]})));
  assert.match(still,/영상 확인 · /);assert.match(still,/data-live-clock>0:00/);assert.match(still,/그 순간에 의견을 남겨 주세요/);assert.doesNotMatch(still,/data-photo-error|is-plain/);
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
  assert.match(room,/<div class="sx-room-files" data-count="1"><img src="\/pulse\/api\/media\/v2" alt="2차 사진" decoding="async"><\/div><button type="button" class="sx-room-play" data-room-go="review"><span class="sr">사진 보기<\/span><\/button><p class="sx-small sx-room-cap">2차 사진<\/p>/);
  assert.doesNotMatch(room,/저희가 만든 광고의 한 장면이에요|w-gift/);
  const finals=[shot('v1','1차 사진','preview',{approvedAt:at}),...[1,2,3,4,5].map(n=>shot('f'+n,'완성 사진 '+n,'final',{guide:'안내',approvedPreviewId:'v1'}))];
  const delivered=project('photo',{stage:'delivered',versions:finals,extra:{closeout:{deliveryKey:'k1',canConfirm:true,files:[]}}});
  const got=roomModel(delivered);assert.equal(got.state,'deliver');assert.equal(got.shots.length,5);
  assert.match(roomView(got),/<div class="sx-room-files" data-count="5">(<img src="\/pulse\/api\/media\/f\d" alt="완성 사진 \d" decoding="async">){5}<\/div>/);assert.match(roomView(got),/<p class="sx-small sx-room-cap">완성 사진 5장<\/p>/);
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
