import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers} from './public/pulse-app/request-data.mjs';
import {roomState,roomStage,roomModel,directionModel,deskModel,CONFIRM_OF} from './public/pulse-app/room-view.mjs';
import {directionView,roomView} from './public/pulse-app/film-views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';

// 영상 전 확인 1/3 「방향과 모델」의 화면 약속(2026-11-07, docs/마케팅/PULSE_의뢰흐름_20261104/판1_설계.md 1b).
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const option=(id,name,extra={})=>({id,name,sentence:`${name} 한 문장`,flow:[{at:'0:00',text:'처음'},{at:'0:05',text:'끝'}],why:'왜',assetId:'img-'+id,recommended:false,...extra});
function project({direction,rounds=[],answers={},status='confirmed'}={}){
  return {id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,studio:{assets:[{id:'img-a',mimeType:'image/jpeg',fileName:'a.jpg',url:'/pulse/api/studio/media/img-a'},{id:'img-b',mimeType:'image/jpeg',fileName:'b.jpg',url:'/pulse/api/studio/media/img-b'},{id:'film-a',mimeType:'video/mp4',fileName:'a.mp4',url:'/pulse/api/studio/media/film-a'}],scenes:[],strategy:{revision:1,data:{}},request:{status,number:'P-2026-ABCD',submittedAt:'2026-11-07T03:00:00.000Z',confirmedAt:status==='confirmed'?'2026-11-07T04:00:00.000Z':'',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15',modelChoice:'ask',...answers},files:[],asks:[],notes:[],rounds,...(direction?{directionProposal:direction}:{})}}};
}
const open=(extra={})=>({round:1,status:'open',lead:'두 방향으로 나눴어요.',options:[option('a','아니, 잠깐',{recommended:true,filmAssetId:'film-a',filmNote:'12초',workId:'maejin-imbak'}),option('b','톡')],modelId:'M06',price:390000,dueDate:'2026-11-17',revisions:2,...extra});

test('an open proposal is the first of three checks; a declined one waits on us; a chosen one goes back to preparing the script',()=>{
  assert.equal(roomState(project({direction:open()})),'direction');
  assert.equal(CONFIRM_OF.direction,'1/3');assert.equal(roomStage('direction'),'draft');assert.equal(roomStage('redirect'),'draft');
  assert.equal(roomState(project({direction:open({status:'declined',answer:'더 고급스럽게'})})),'redirect');
  assert.equal(roomState(project({direction:open({status:'chosen',chosenId:'a'})})),'prepare');
  assert.equal(roomState(project({direction:open({status:'settled',chosenId:'b'})})),'prepare');
  assert.equal(roomState(project({direction:open(),rounds:[{round:1,kind:'script',scenes:[],sentAt:'x'}]})),'script','once a script is out, the direction screen stays shut');
});
test('the direction model carries the real price, the one agreed day and the pictures the customer may see',()=>{
  const d=directionModel(project({direction:open()}));
  assert.equal(d.price,'39만원');assert.equal(d.due,'11월 17일');assert.equal(d.revisions,2);
  assert.equal(d.options[0].src,'/pulse/api/studio/media/img-a');assert.equal(d.options[0].film,'/pulse/api/studio/media/film-a');
  assert.equal(d.model.id,'M06');assert.equal(d.canPick,true);assert.equal(d.last,false);
  assert.equal(directionModel(project({direction:open({price:290000})})).price,'29만원','a launch price shows as it is paid');
  assert.equal(directionModel(project({direction:open({price:395500})})).price,'395,500원');
  assert.equal(directionModel(project({direction:open({modelId:undefined}),answers:{modelChoice:'none'}})).noModel,true);
  assert.equal(directionModel(project()),null);
  const brief=roomModel(project({direction:open()})).brief;
  assert.deepEqual(brief.find(([key])=>key==='받으실 날'),['받으실 날','11월 17일 · 방향 제안에 적힌 날'],'one date on the page once a proposal is in');
});
test('the direction screen follows the mock: two pictures, the recommendation first, the plan, terms, and three answers',()=>{
  const p=roomModel(project({direction:open()})),html=directionView(p);
  assert.match(html,/^<div class="sx-room is-direction" data-state="direction">/);
  assert.equal(html.split('class="sx-dp-frame"').length-1,2);
  assert.match(html,/data-dp-pick="a"><span class="sx-no">01<\/span> 아니, 잠깐<span class="sx-dp-rec"> · 추천<\/span><\/button>/);
  assert.match(html,/영상 전 확인 <b class="sx-no">1\/3<\/b>/);
  assert.match(html,/<dd class="sx-serif">39만원<\/dd>[\s\S]*<dd class="sx-serif">11월 17일<\/dd>[\s\S]*<dd class="sx-serif">2회<\/dd>/);
  assert.match(html,/결제는 글 콘티를 보신 뒤에 해요/);assert.match(html,/결제 방법은 그때 담당자가 안내해 드려요/);
  assert.doesNotMatch(html,/메일/,'no mail promise before mail is on');
  assert.match(html,/<span data-dp-go>「아니, 잠깐」으로 정하고 글 콘티 받기<\/span>/);
  assert.match(html,/data-form="direction-pick"><input type="hidden" name="optionId" value="a"><input type="hidden" name="modelId" value=""><label class="sx-dp-note" data-dp-note hidden><span class="sr">덧붙일 말<\/span><input type="text" name="note"/,'the one-line note lives in a named form field so live redraws keep it');
  assert.match(html,/data-dp-do="neither">둘 다 아니에요<\/button>/);assert.match(html,/data-form="direction-neither" hidden>/);
  assert.match(html,/data-dp-film="taste"/);assert.match(html,/data-room-brief/);assert.match(html,/class="sx-dp-rail"><nav class="sx-steps"/);
  assert.equal((html.match(/data-dp-model=/g)||[]).length,4,'four hand-picked models, not the whole cast');
});
test('what the customer was looking at survives a redraw',()=>{
  const p=roomModel(project({direction:open()})),html=directionView(p,{ui:{focus:'b',casting:true,more:true,note:true,modelId:'F02',view:'choose'}});
  assert.match(html,/data-dp-frame="b" data-at="1" aria-pressed="true"/);assert.match(html,/data-dp-detail="a" hidden>/);assert.match(html,/data-dp-detail="b" >/);
  assert.match(html,/data-dp-casts >/);assert.match(html,/data-dp-more >/);assert.match(html,/data-dp-note >/);
  assert.match(html,/name="optionId" value="b"/);assert.match(html,/name="modelId" value="F02"/);assert.match(html,/data-dp-model-name>하린</);
  assert.match(html,/「톡」으로 정하고 글 콘티 받기/);
  const neither=directionView(p,{ui:{view:'neither'}});assert.match(neither,/data-view="neither"/);assert.match(neither,/class="sx-dp-choose" hidden>/);
  const last=directionView(roomModel(project({direction:open({round:2})})),{ui:{view:'neither'}});
  assert.match(last,/담당자가 직접 연락드려 함께 정해요/);assert.match(last,/담당자와 이야기하기/);assert.match(last,/다시 보내 드린 안/);
});
test('after picking, the room shows the chosen direction with terms and a way back until the script arrives',()=>{
  const p=roomModel(project({direction:open({status:'chosen',chosenId:'b',answer:'도망 좋아요'})})),html=roomView(p);
  assert.match(html,/<h1 class="sx-display" data-room-title>이 방향으로 정했어요<\/h1>/);
  assert.match(html,/<section class="sx-dp-chosen" data-room-in><p class="sx-small">고르신 방향<\/p><h2 class="sx-serif">톡<\/h2>/);
  assert.match(html,/덧붙이신 말: 도망 좋아요/);assert.match(html,/data-room-go="pick">다시 고르기/);
  assert.match(html,/<img class="sx-q-fill" src="\/pulse\/api\/studio\/media\/img-b"/);
  const settled=roomView(roomModel(project({direction:open({status:'settled',chosenId:'a'})})));
  assert.match(settled,/고르신 방향 · 담당자와 정함/);
  const waiting=roomView(roomModel(project({direction:open({round:2,status:'declined',answer:'아직'})})));
  assert.match(waiting,/담당자가 직접 연락드려요/);
});
test('the desk leads with the direction, settles after a second no, and opens the first draft only once a direction is decided',()=>{
  const desk=extra=>deskView({...deskModel(project(extra)),queue:[]});
  assert.match(desk(),/data-action="desk-direction"><span>방향 제안 보내기<\/span>/);
  assert.doesNotMatch(desk(),/desk-send|desk-propose/,'no draft and no separate model proposal before a direction');
  assert.match(desk({direction:open()}),/data-action="desk-direction" >방향 고쳐 보내기/);
  assert.match(desk({direction:open({status:'declined',answer:'x'})}),/두 번째 방향 보내기/);
  const settle=desk({direction:open({round:2,status:'declined',answer:'x'})});
  assert.match(settle,/data-action="desk-settle"><span>손님과 정한 안으로 정리<\/span>/);assert.doesNotMatch(settle,/desk-direction|desk-send/);
  const chosen=desk({direction:open({status:'chosen',chosenId:'b',answer:'도망 좋아요'})});
  assert.match(chosen,/data-action="desk-send"><span>1차안 보내기<\/span>/);assert.match(chosen,/고객이 「톡」 골랐어요/);
  assert.match(desk({answers:{package:'photo'}}),/data-action="desk-send"><span>1차안 보내기<\/span>/,'photo orders keep the old path');
  const views=read('views.mjs');assert.match(views,/if\(type==='desk-direction'\)return deskDirectionDialog\(item\);/);assert.match(views,/data-form="desk-settle"/);
});
test('the home page and the request words name the first check as direction and model',()=>{
  assert.match(read('film-home.mjs'),/const CHECK_THREE=\['방향과 모델 고르기','광고가 남길 한 문장과 글 콘티','컷마다 장면 이미지'\];/);
  const flow=read('request-flow.mjs');assert.match(flow,/방향 두 안과 값 · 받으실 날을 보내 드려요/);assert.match(flow,/<li><b>방향 두 안을 보내 드려요<\/b>/);
  const css=read('film.css');assert.match(css,/\.sx-dp\{--frame:min\(37vw,calc\(100dvh\*9\/16\),calc\(\(100vw - 400px\)\/2\)\)/);assert.match(css,/\.sx-dp-kv dd\{[^}]*white-space:nowrap/);
});
