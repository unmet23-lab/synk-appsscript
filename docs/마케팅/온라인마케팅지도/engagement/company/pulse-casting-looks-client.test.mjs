import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers,answersForServer} from './public/pulse-app/request-data.mjs';
import {roomModel,directionModel,draftModel,journalModel,deskModel,lookOf,lookLine} from './public/pulse-app/room-view.mjs';
import {directionView,roomView,draftView} from './public/pulse-app/film-views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';
import {castingSummary,castingView,normalizeDemoCasting,CASTING_KEYS} from './public/pulse-app/casting-view.mjs';

// 옷 · 머리 고르기(2026-11-10, docs/마케팅/PULSE_의뢰흐름_20261104/옷머리고르기_설계_20261110.md 4절)의 화면 약속.
// 화면 안의 눌러 고르기 · 모델 바꾸면 지움 · 펼침 높이는 브라우저 실측(검수 기록)으로 보고, 여기서는 그리는 조건 · 마크업 · 보낼 칸을 고정한다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const option=(id,name,extra={})=>({id,name,sentence:`${name} 한 문장`,flow:[{at:'0:00',text:'처음'},{at:'0:05',text:'끝'}],why:'왜',assetId:'img-'+id,recommended:false,...extra});
function project({direction,rounds=[],answers={},casting={},flag=true,scenes=[]}={}){
  return {id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,studio:{assets:[{id:'img-a',mimeType:'image/jpeg',fileName:'a.jpg',url:'/m/img-a'},{id:'img-b',mimeType:'image/jpeg',fileName:'b.jpg',url:'/m/img-b'}],scenes,strategy:{revision:1,data:{castingSelection:{modelId:'',hair:'',outfit:'',...casting}}},request:{status:'confirmed',number:'P-1110-ABCD',submittedAt:'2026-11-10T03:00:00.000Z',confirmedAt:'2026-11-10T04:00:00.000Z',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15',modelChoice:'ask',...answers},files:[],asks:[],notes:[],rounds,...(flag?{castingLooks:true,paymentFlow:true}:{}),...(direction?{directionProposal:direction}:{})}}};
}
const open=(extra={})=>({round:1,status:'open',lead:'두 방향으로 나눴어요.',at:'2026-11-10T05:00:00.000Z',options:[option('a','아니, 잠깐',{recommended:true}),option('b','톡')],modelId:'F02',price:390000,dueDate:'2026-11-17',revisions:2,...extra});
const view=(extra,ui={})=>directionView(roomModel(project(extra)),{ui});

test('the outfit and hair line is drawn only for a pickable catalog model on a server that takes it',()=>{
  assert.equal(directionModel(project({direction:open()})).looks,true);
  assert.equal(directionModel(project({direction:open(),flag:false})).looks,false,'an older server: no line, no fields');
  assert.equal(directionModel(project({direction:open({modelId:undefined}),answers:{modelChoice:'none'}})).looks,false,'no model');
  assert.equal(directionModel(project({direction:open(),answers:{modelChoice:'custom'}})).looks,false,'a custom persona request');
  assert.equal(directionModel(project({direction:open(),answers:{modelChoice:'persona'}})).looks,false,'a dedicated persona');
  assert.equal(directionModel(project({direction:open(),casting:{personaRef:{personaId:'11111111-1111-4111-8111-111111111111',revisionId:'22222222-2222-4222-8222-222222222222'}}})).looks,false,'a persona already attached');
  assert.equal(directionModel(project({direction:open({status:'declined'})})).looks,false,'not pickable');
  assert.equal(directionModel(project({direction:open(),rounds:[{round:1,kind:'script',scenes:[],sentAt:'x'}]})).looks,false,'after the script');
  for(const extra of [{flag:false},{direction:open({modelId:undefined}),answers:{modelChoice:'none'}}]){
    const html=view({direction:open(),...extra});
    assert.doesNotMatch(html,/data-dp-look|name="outfit"|name="hair"|직접 고르기/,JSON.stringify(extra).slice(0,40));
  }
});

test('folded, the line says leave it to us; unfolded, two labelled groups of three photo buttons with names and pressed states',()=>{
  const html=view({direction:open()});
  assert.match(html,/<div class="sx-dp-look sx-small" data-dp-look data-model="F02"><p class="sx-dp-look-row"><span class="sx-dp-label">옷 · 머리<\/span><b data-dp-look-sum>담당자에게 맡기기 · 방향에 맞춰 골라 드려요<\/b><button type="button" class="sx-quiet sx-dp-look-open" data-dp-do="looks" aria-expanded="false" aria-controls="dp-looks">직접 고르기<\/button><\/p><div class="sx-dp-looks" id="dp-looks" data-dp-looks hidden>/);
  // 모델 줄(flex 한 줄) 안이 아니라 「크게 보기」 칸처럼 형제 블록.
  assert.ok(html.indexOf('data-dp-casts')<html.indexOf('data-dp-look '),'after the big model photos');assert.doesNotMatch(html,/<div class="sx-dp-model[^"]*">(?:(?!<\/div><div class="sx-dp-casts").)*data-dp-look/s);
  const groups=[...html.matchAll(/<div class="sx-dp-look-set is-(outfit|hair)" role="group" aria-label="([^"]+)">/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual(groups,[['outfit','옷'],['hair','머리']]);
  const cells=[...html.matchAll(/<button type="button" class="sx-dp-pic" aria-pressed="false" aria-label="([^"]+)" title="([^"]+)" data-dp-look-pick="(outfit|hair)" data-value="([^"]+)"><img src="([^"]+)" alt="" loading="lazy" decoding="async"><span class="sx-small">([^<]+)<\/span><\/button>/g)].map(m=>({label:m[1],title:m[2],key:m[3],value:m[4],src:m[5],caption:m[6]}));
  assert.deepEqual(cells.map(cell=>[cell.key,cell.value,cell.label]),[['outfit','fullbody','기본 옷'],['outfit','look-1','파스텔 캐주얼'],['outfit','look-2','스트라이프 원피스'],['hair','original','기본 · 어깨 길이 레이어드'],['hair','look-2','하이 포니테일'],['hair','look-3','긴 웨이브']]);
  assert.deepEqual(cells.map(cell=>cell.src),['./assets/casting/photos/f02-fullbody.webp','./assets/casting/photos/f02-look-1.webp','./assets/casting/photos/f02-look-2.webp','./assets/casting/f02.webp','./assets/casting/photos/f02-hair-2.webp','./assets/casting/photos/f02-hair-3.webp']);
  for(const cell of cells){assert.equal(cell.caption,cell.label);assert.equal(cell.title,cell.label,'the whole name shows on hover even when the caption is cut');}
  assert.match(html,/<p class="sx-dp-look-note">고른 옷 · 머리는 장면 이미지에서 이 사진 그대로 맞춰요\.<\/p>/);
  // 보낼 칸: 줄을 그렸으면 빈 값(맡김)이라도 늘 둔다.
  assert.match(html,/<input type="hidden" name="modelId" value=""><input type="hidden" name="outfit" value=""><input type="hidden" name="hair" value=""><label class="sx-dp-note"/);
  const unfolded=view({direction:open()},{looks:true});
  assert.match(unfolded,/aria-expanded="true" aria-controls="dp-looks">접기<\/button><\/p><div class="sx-dp-looks" id="dp-looks" data-dp-looks >/);
});

test('the first values are the earlier picks for the same model; another model starts at leave it to us; a redraw keeps what was pressed',()=>{
  const seeded=view({direction:open({status:'chosen',chosenId:'a',look:{outfit:'look-2',hair:''}}),answers:{models:['F02'],outfit:'look-2',hair:''}});
  assert.match(seeded,/aria-pressed="true" aria-label="스트라이프 원피스" title="스트라이프 원피스" data-dp-look-pick="outfit" data-value="look-2">/);
  assert.match(seeded,/class="sx-dp-pic is-on" aria-pressed="true"/);assert.equal((seeded.match(/aria-pressed="true" aria-label="[^"]+" title="[^"]+" data-dp-look-pick/g)||[]).length,1);
  assert.match(seeded,/<b data-dp-look-sum>옷 스트라이프 원피스 · 머리 맡김<\/b>/);
  assert.match(seeded,/name="outfit" value="look-2"><input type="hidden" name="hair" value="">/,'repicking a direction does not wipe the earlier pick');
  // 2회차 제안(기록 없음)도 같은 모델이면 앞서 고른 값에서 시작한다(의뢰 기록에서 읽음).
  assert.match(view({direction:open({round:2}),answers:{models:['F02'],outfit:'',hair:'look-3'}}),/name="outfit" value=""><input type="hidden" name="hair" value="look-3">/);
  assert.match(view({direction:open(),answers:{models:['M06'],outfit:'look-2',hair:'look-3'}}),/name="outfit" value=""><input type="hidden" name="hair" value="">/,'values of another model are not carried over');
  // 다시 그리기: ui에 남은 값이 이긴다. 다른 얼굴을 골라 둔 상태면 그 모델의 사진으로 그린다.
  const kept=view({direction:open()},{outfit:'fullbody',hair:'look-2'});
  assert.match(kept,/name="outfit" value="fullbody"><input type="hidden" name="hair" value="look-2">/);
  const other=view({direction:open()},{modelId:'F01',outfit:'',hair:''});
  assert.match(other,/data-dp-look data-model="F01"/);assert.match(other,/src="\.\/assets\/casting\/photos\/f01-hair-2\.webp"/);assert.doesNotMatch(other,/photos\/f02-hair/);
  assert.match(view({direction:open()},{modelId:'F01',outfit:'look-9',hair:'wave'}),/name="outfit" value=""><input type="hidden" name="hair" value="">/,'a value the model does not have is never sent');
});

test('after picking, the chosen card, the script card, the journal and the desk show the same outfit and hair',()=>{
  const chosen=open({status:'chosen',chosenId:'b',answeredAt:'2026-11-10T06:00:00.000Z',look:{outfit:'look-2',hair:''}});
  const p=project({direction:chosen,answers:{models:['F02'],outfit:'look-2'},casting:{modelId:'F02',outfit:'look-2'}});
  assert.match(roomView(roomModel(p)),/<h2 class="sx-serif">톡<\/h2><p class="sx-body">톡 한 문장<\/p><p class="sx-small sx-dp-chosen-look">모델 하린 · 옷 스트라이프 원피스 · 머리 맡김<\/p>/);
  assert.doesNotMatch(roomView(roomModel(project({direction:open({status:'chosen',chosenId:'b'})}))),/sx-dp-chosen-look/,'no record (older server): the card is as before');
  const journal=journalModel(p).items.find(item=>item.id==='d:1:ok');
  assert.equal(journal.what,'「톡」으로 정했어요 · 옷 스트라이프 원피스 · 머리 맡김');
  assert.equal(journalModel(project({direction:open({status:'chosen',chosenId:'b',answeredAt:'2026-11-10T06:00:00.000Z',look:{outfit:'',hair:''}})})).items.find(item=>item.id==='d:1:ok').what,'「톡」으로 정했어요','all left to us: the line stays short');
  assert.equal(deskModel(p).direction.look,'옷 스트라이프 원피스 · 머리 맡김');
  assert.match(deskView({...deskModel(p),queue:[]}),/<p class="desk-sum" data-desk-look>옷 스트라이프 원피스 · 머리 맡김<\/p>/);
  assert.equal(deskModel(project({direction:open()})).direction.look,undefined,'open proposals show nothing yet');
  // 글 콘티: 정본(제작 설계) 값, 고른 옷이 있으면 그 옷 사진.
  const scenes=[{id:'s1',revision:1,title:'컷 1',description:'벤치 위 캔',duration:3}];
  const script=project({direction:chosen,answers:{models:['F02'],outfit:'look-2'},casting:{modelId:'F02',outfit:'look-1',hair:'look-3'},scenes,rounds:[{round:1,kind:'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:'x'}]});
  const d=draftModel(script);
  assert.deepEqual([d.look.outfit,d.look.hair,d.look.outfitSrc],['look-1','look-3','./assets/casting/photos/f02-look-1.webp'],'the production plan wins over the request record');
  const html=draftView(d);
  assert.match(html,/<div class="sx-draft-cast"><img src="\.\/assets\/casting\/photos\/f02-look-1\.webp" alt="" class="is-outfit"><span class="sx-small"><b>하린<\/b> [^<]*<span class="sx-draft-look">옷 파스텔 캐주얼 · 머리 긴 웨이브<\/span>/);
  const plain=draftModel(project({answers:{models:['F02']},casting:{modelId:'F02'},scenes,rounds:[{round:1,kind:'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:'x'}]}));
  assert.equal('look' in plain,false,'nothing picked and no direction step (a photo order): no line');
  assert.equal('look' in draftModel(project({flag:false,direction:chosen,casting:{modelId:'F02',outfit:'look-1'},scenes,rounds:[{round:1,kind:'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:'x'}]})),false,'an older server: as before');
});

test('the line reads the catalog names, and an unknown or foreign value reads as left to us',()=>{
  assert.equal(lookLine(lookOf('F02',{outfit:'fullbody',hair:'look-2'})),'옷 기본 옷 · 머리 하이 포니테일');
  assert.equal(lookLine(lookOf('F02',{outfit:'look-3',hair:'wave'})),'옷 맡김 · 머리 맡김');
  assert.equal(lookLine(lookOf('M99',{outfit:'look-1'})),'옷 맡김 · 머리 맡김');
});

test('the staff plan summary and the style form know the outfit by the model outfit names',()=>{
  assert.ok(CASTING_KEYS.includes('outfit'));
  assert.equal(normalizeDemoCasting({modelId:'F02',outfit:'look-2'}).outfit,'look-2');
  assert.throws(()=>normalizeDemoCasting({modelId:'F02',outfit:'original'}));
  assert.match(castingSummary({modelId:'F02',outfit:'look-2'}),/<dt>옷<\/dt><dd>스트라이프 원피스<\/dd>/);
  assert.match(castingSummary({modelId:'',outfit:''}),/<dt>옷<\/dt><dd>미정<\/dd>/);
  const form=castingView({modelId:'F02',outfit:'look-1'});
  assert.match(form,/<fieldset class="casting-options" data-casting-choice="outfit"><legend>옷<\/legend><div class="casting-chips"><label><input type="radio" name="cast_outfit" value="" ><span>미정<\/span><\/label><label><input type="radio" name="cast_outfit" value="fullbody" ><span>기본 옷<\/span><\/label><label><input type="radio" name="cast_outfit" value="look-1" checked><span>파스텔 캐주얼<\/span><\/label><label><input type="radio" name="cast_outfit" value="look-2" ><span>스트라이프 원피스<\/span><\/label><\/div><\/fieldset>/);
});

test('the request form never sends an empty outfit, and the screen sends both fields only on a server that takes them',()=>{
  assert.equal('outfit' in answersForServer({...emptyAnswers()}),false);
  assert.equal(answersForServer({...emptyAnswers(),outfit:'look-1'}).outfit,'look-1');
  const app=read('app.mjs');
  assert.match(app,/look=s\.project\.studio\?\.request\?\.castingLooks&&form\.elements\?\.outfit&&form\.elements\?\.hair\?\{outfit:String\(values\.outfit\|\|''\),hair:String\(values\.hair\|\|''\)\}:\{\}/);
  assert.match(app,/studioAction\('answer_direction',\{optionId:values\.optionId,\.\.\.\(values\.modelId\?\{modelId:values\.modelId\}:\{\}\),\.\.\.look,/);
  assert.match(read('demo-film.mjs'),/rounds:\[\],castingLooks:true\};/,'the example carries the same flag');
});

test('the CSS keeps the direction screen first: outfits uncropped, cells at most 124px, the plan text folds while open, one panel at a time',()=>{
  const css=read('film.css'),views=read('film-views.mjs');
  assert.ok(css.includes('.is-outfit .sx-dp-pic img{object-fit:contain;'),'full-body photos of different widths are not cropped');
  assert.ok(css.includes('.sx-dp-pics{display:grid;grid-template-columns:repeat(3,minmax(0,124px));'),'a 538px photo is never stretched past 1.5x (124px × 3 dppx = 372)');
  assert.ok(css.includes('.sx-dp-choose:has([data-dp-looks]:not([hidden])) :is(.sx-dp-why,.sx-dp-lead){display:none}'));
  assert.ok(css.includes('.sx-dp-sheet:has([data-dp-looks]:not([hidden])) .sx-dp-lead{display:none}'));
  assert.doesNotMatch(css,/\.sx-dp-pic[^{]*\{[^}]*outline:\s*(?:none|0)/,'focus rings stay on');
  assert.ok(views.includes("if(act==='casting'){toggle('casting',$('[data-dp-casts]'),what,[t('접기'),t('크게 보기')]);if(ui.casting)fold('looks');}"));
  assert.ok(views.includes("if(act==='looks'){toggle('looks',$('[data-dp-looks]'),what,[t('접기'),t('직접 고르기')]);if(ui.looks)fold('casting');}"));
  // 모델을 바꾸면 옛 모델 몫은 접어 두고 새 모델은 그 모델에서 고르던 값(처음이면 맡김, 방향의 모델로 돌아오면 앞서 고른 값)으로 다시 그린다(Fable 최종 F2).
  assert.ok(views.includes("if(box&&now!==was){ui.picks={...ui.picks,[was]:{outfit:ui.outfit,hair:ui.hair}};const back=ui.picks[now]||(now===d.model?.id?d.look:null);ui.outfit=back?.outfit||'';ui.hair=back?.hair||'';box.outerHTML=dpLooks(d,ui);bindPics();syncLooks();}"),'changing the model never carries one model picks to another, and coming back restores them');
  assert.ok(css.includes('@media (max-height:960px) and (min-width:821px) and (min-aspect-ratio:10001/10000){.sx-dp-pic img{height:clamp(72px,10vh,140px)}.sx-dp-pic>.sx-small{-webkit-line-clamp:1}}'),'names are cut to one line only on low wide windows');
});
