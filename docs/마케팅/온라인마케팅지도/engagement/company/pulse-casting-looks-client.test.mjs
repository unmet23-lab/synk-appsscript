import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyAnswers,answersForServer} from './public/pulse-app/request-data.mjs';
import {roomModel,directionModel,draftModel,journalModel,deskModel,lookOf,lookLine} from './public/pulse-app/room-view.mjs';
import {directionView,roomView,draftView,roomRail} from './public/pulse-app/film-views.mjs';
import {deskView} from './public/pulse-app/desk-view.mjs';
import {castingSummary,castingView,normalizeDemoCasting,CASTING_KEYS} from './public/pulse-app/casting-view.mjs';

// 옷 · 머리 고르기(2026-11-10, docs/마케팅/PULSE_의뢰흐름_20261104/옷머리고르기_설계_20261110.md 4절)의 화면 약속.
// 화면 안의 눌러 고르기 · 모델을 바꾸면 그 모델 몫으로 접어 두고 돌아오면 되살림 · 펼침 높이는 브라우저 실측(검수 기록)으로 보고, 여기서는 그리는 조건 · 마크업 · 보낼 칸을 고정한다.
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
  assert.match(html,/<div class="sx-dp-look sx-small" data-dp-look data-model="F02"><p class="sx-dp-look-row"><span class="sx-dp-label">옷 · 머리<\/span><span class="sx-dp-look-say"><b data-dp-look-sum title="담당자에게 맡기기">담당자에게 맡기기<\/b><span class="sx-dp-look-hint" data-dp-look-hint > · 방향에 맞춰 골라 드려요<\/span><\/span><button type="button" class="sx-quiet sx-dp-look-open" data-dp-do="looks" aria-expanded="false" aria-controls="dp-looks">직접 고르기<\/button><\/p><div class="sx-dp-looks" id="dp-looks" data-dp-looks hidden>/);
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
  assert.match(seeded,/<span class="sx-dp-look-say is-picked"><b data-dp-look-sum title="옷 스트라이프 원피스 · 머리 맡김">옷 스트라이프 원피스 · 머리 맡김<\/b><span class="sx-dp-look-hint" data-dp-look-hint hidden>/,'the hint about leaving it to us goes away once something is picked');
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
  assert.ok(css.includes('@media (max-height:960px) and (min-width:821px) and (min-aspect-ratio:10001/10000){.sx-dp-pic img{height:clamp(72px,10vh,140px)}.sx-dp-pic>.sx-small{-webkit-line-clamp:1}}'),'names are cut to one line on low wide windows');
});

// 넘칠 때만 접기(11-11, Fable 5.2 화면 최종 F1 · F2): 창 크기 띠는 설명 칸 폭(두 안 400px · 세 안 420px)과 글 길이를 다 잡지 못했다
// (1440×961 98px · 세 안 1680×961 60px · 「왜」 세 줄 1440×1080 15px 넘침). 화면이 실제 넘침을 재서 넘치지 않을 때까지만 한 단계씩 접는다.
test('the direction sheet folds one step at a time only while it overflows, whatever the window, the number of options or the length of the text',()=>{
  const css=read('film.css'),views=read('film-views.mjs');
  assert.doesNotMatch(css,/max-width:1679px/,'no window-size band stands in for the real overflow');
  for(const rule of [
    '.sx-dp.is-fit-1 .sx-dp-lead{display:none}','.sx-dp.is-fit-1 .sx-dp-pic img{height:clamp(72px,10vh,140px)}','.sx-dp.is-fit-1 .sx-dp-pic>.sx-small{-webkit-line-clamp:1}',
    '.sx-dp.is-fit-2 .sx-dp-choose:has([data-dp-looks]:not([hidden])) :is(.sx-dp-flow,.sx-dp-taste,.sx-dp-incl,.sx-dp-more){display:none}',
    '.sx-dp.is-fit-3 .sx-dp-why{display:none}','.sx-dp.is-fit-4 .sx-dp-title{font-size:clamp(32px,3vw,42px)}','.sx-dp.is-fit-5 .sx-dp-look-note{display:none}',
  ])assert.ok(css.includes(rule),rule);
  // 재는 법: 고르기 칸의 내용이 칸을 넘는 몫이 설명 칸 아래 여백보다 클 때만(그때 설명 칸이 굴러간다), 휴대폰 · 세로 화면은 쓰지 않고, 「자세히」를 편 동안은 접은 채로 잰다.
  assert.ok(views.includes("const FIT=['is-fit-1','is-fit-2','is-fit-3','is-fit-4','is-fit-5'];"));
  assert.ok(views.includes("if(!box||box.hidden||matchMedia?.(JOURNAL_SHEET).matches){host.classList.remove(...FIT);return;}"),'phones, portrait windows and the 「neither」 view carry no steps');
  assert.ok(views.includes("const over=()=>box.scrollHeight-box.clientHeight-(parseFloat(getComputedStyle(sheet).paddingBottom)||0)>1;"));
  assert.ok(views.includes("const more=$('[data-dp-more]'),open=!!more&&!more.hidden;if(open)more.hidden=true;"));
  // 단계는 화면 하나로: 모든 안을 한 번씩 보여 재서 가장 많이 접어야 하는 안에 맞춘다(안을 넘길 때 윗부분이 63px 오르내렸다 — 다시 검수 FA3). 안을 넘길 때는 내리지 않는다.
  assert.ok(views.includes("let level=keep?FIT.filter(step=>host.classList.contains(step)).length:0;"));
  assert.ok(views.includes("for(const detail of details){details.forEach(el=>{el.hidden=el!==detail;});while(level<FIT.length&&over())host.classList.add(FIT[level++]);}"));
  assert.ok(views.includes("details.forEach((el,i)=>{el.hidden=shown[i];});"),'what was hidden for measuring is put back');
  // 「자세히」를 편 채 다시 재도 굴린 자리가 맨 위로 튀지 않는다(FA2).
  assert.ok(views.includes("const top=sheet.scrollTop;")&&views.includes("if(sheet.scrollTop!==top)sheet.scrollTop=top;"));
  // 다시 재는 때: 안을 바꿀 때(움직임을 걸기 전 · 단계 유지) · 펼침 · 모델 · 고름 · 보기 바꿈 · 사진을 못 받았을 때 · 창 크기 · 글꼴이 온 뒤. 떠날 때 창 크기 듣기를 거둔다.
  for(const call of ["drawWork();fit({keep:true});","if(['more','note','casting','looks'].includes(act))fit();","syncLooks();fit();return;}","fit();return;\r\n    }".replace(/\r\n/g,views.includes('\r\n')?'\r\n':'\n'),"img.hidden=true;fit();","window.addEventListener('resize',refit);","document.fonts?.ready?.then(()=>{if(host.isConnected)fit();});","window.removeEventListener('resize',refit);"])assert.ok(views.includes(call),call);
});

test('with nothing picked the summary stays on one line at any sheet width, picks show in full once folded, and the money row never lets two values touch',()=>{
  const css=read('film.css');
  // 「직접 고르기」의 왼쪽 여백이 뒤에 오는 단추 규칙(padding:2px 0)에 덮여 0이 됐고(칸 420px에서 요약과 1.7px), 여백을 살리면 줄이 꺾여 22px가 늘었다(F3).
  assert.ok(css.includes('.sx-dp-look-row{display:flex;flex-wrap:nowrap;align-items:baseline;margin:0}'));
  assert.ok(css.includes('.sx-dp-look-say{flex:1 1 0;min-width:0;display:flex;flex-wrap:wrap;max-height:1.6em;max-height:1lh;overflow:hidden;'),'the hint shows only when it fits on the line');
  assert.ok(css.includes('.sx-dp-look-say>b{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'));
  // 고른 뒤에는 요약이 둘째 줄까지 꺾여 옷 · 머리 이름이 다 보인다(좁은 칸 · 휴대폰에서 잘렸다 — FA4), 가운뎃점 앞 빈칸은 지워지지 않는다(FA5).
  assert.ok(css.includes('.sx-dp-look:has([data-dp-looks][hidden]) .sx-dp-look-say.is-picked{max-height:none;overflow:visible}'),'only while the panel is folded — open, the pressed cells show the picks');
  assert.ok(css.includes('.sx-dp-look:has([data-dp-looks][hidden]) .sx-dp-look-say.is-picked>b{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all}'));
  assert.ok(css.includes('.sx-dp-look-hint{white-space:pre}'));
  const views=read('film-views.mjs');
  assert.ok(views.includes("box.querySelector('.sx-dp-look-say')?.classList.toggle('is-picked',!!(now.outfit||now.hair));"));
  assert.ok(css.includes('.sx-dp-look-row>.sx-dp-look-open{flex:none;margin-left:8px}'),'the button keeps its gap whatever comes later in the file');
  // 값 줄: 칸이 글 너비보다 좁아지지 않고 늘 10px 띄운다(칸 400px · 글자 23.8px에서 「11월 21일」과 「2회」가 1px였다, F4).
  assert.ok(css.includes('.sx-dp-kv{display:grid;grid-template-columns:repeat(3,minmax(max-content,1fr));column-gap:10px;'));
});

// ── 사진 상품(2026-11-12, 설계 10절): 방향 제안이 없어 모델 제안 카드에서 고른다. ──
function photoProject({proposal={},answers={},flag=true,casting={}}={}){
  const p=project({answers:{package:'photo',...answers},casting});
  p.studio.request.modelProposal={modelId:'F02',note:'제품 색과 잘 맞아요',at:'2026-11-12T01:00:00.000Z',by:'김하늘',status:'open',...proposal};
  if(flag)p.studio.request.modelProposalLooks=true;
  return p;
}
const card=(extra,ui={})=>roomView(roomModel(photoProject(extra)),{ui});

test('a photo order draws the same two rows on the model proposal card, only where they can be taken',()=>{
  const m=roomModel(photoProject());
  assert.equal(m.state,'model');
  assert.deepEqual([m.proposal.looks,m.proposal.key,m.proposal.look],[true,'F02:2026-11-12T01:00:00.000Z',{outfit:'',hair:''}]);
  const none=extra=>{const info=roomModel(photoProject(extra));assert.equal('looks' in info.proposal,false,JSON.stringify(extra).slice(0,60));assert.doesNotMatch(roomView(info),/data-room-look|직접 고르기|sx-dp-look/);};
  none({flag:false});                                  // 옛 서버: 줄도 칸도 없다
  none({answers:{package:'s15'}});                     // 영상 상품은 방향 화면에서 고른다
  none({answers:{modelChoice:'custom'}});none({answers:{modelChoice:'persona'}});
  none({casting:{personaRef:{personaId:'11111111-1111-4111-8111-111111111111',revisionId:'22222222-2222-4222-8222-222222222222'}}});
  assert.equal(roomModel(photoProject({proposal:{status:'accepted'}})).proposal,null,'no card once answered');
  const html=card();
  assert.match(html,/<div class="sx-dp-look sx-small" data-room-look data-key="F02:2026-11-12T01:00:00\.000Z" data-model="F02"><p class="sx-dp-look-row"><span class="sx-dp-label">옷 · 머리<\/span><span class="sx-dp-look-say"><b data-room-look-sum title="담당자에게 맡기기">담당자에게 맡기기<\/b><span class="sx-dp-look-hint" data-room-look-hint > · 제품에 맞춰 골라 드려요<\/span><\/span><button type="button" class="sx-quiet sx-dp-look-open" data-room-do="looks" aria-expanded="false" aria-controls="room-looks">직접 고르기<\/button><\/p><div class="sx-dp-looks" id="room-looks" data-room-looks hidden>/);
  const cells=[...html.matchAll(/<button type="button" class="sx-dp-pic" aria-pressed="false" aria-label="([^"]+)" title="([^"]+)" data-room-look-pick="(outfit|hair)" data-value="([^"]+)"><img src="([^"]+)" alt="" loading="lazy" decoding="async"><span class="sx-small">([^<]+)<\/span><\/button>/g)].map(x=>[x[3],x[4],x[1]]);
  assert.deepEqual(cells,[['outfit','fullbody','기본 옷'],['outfit','look-1','파스텔 캐주얼'],['outfit','look-2','스트라이프 원피스'],['hair','original','기본 · 어깨 길이 레이어드'],['hair','look-2','하이 포니테일'],['hair','look-3','긴 웨이브']]);
  assert.match(html,/<p class="sx-dp-look-note">고른 옷 · 머리는 사진에서 이 모습 그대로 맞춰요\.<\/p>/,'photo wording — there are no scene images here');
  assert.doesNotMatch(html,/방향에 맞춰 골라 드려요|장면 이미지에서 이 사진 그대로/);
  // 줄은 모델 설명 아래, 「이 모델로 할게요」 위에 선다.
  assert.ok(html.indexOf('sx-propose-line')<html.indexOf('data-room-look ')&&html.indexOf('data-room-look ')<html.indexOf('data-room-do="model-accept"'));
  assert.doesNotMatch(html,/data-dp-look|id="dp-looks"/,'the direction screen names are not reused in the room');
});

test('the card keeps what was being picked across a redraw, and starts from the earlier picks for the same model',()=>{
  const redraw=card({}, {outfit:'look-2',hair:'',looks:true});
  assert.equal((redraw.match(/class="sx-dp-pic is-on" aria-pressed="true"/g)||[]).length,1);
  assert.match(redraw,/aria-pressed="true" aria-label="스트라이프 원피스" title="스트라이프 원피스" data-room-look-pick="outfit" data-value="look-2">/);
  assert.match(redraw,/<span class="sx-dp-look-say is-picked"><b data-room-look-sum title="옷 스트라이프 원피스 · 머리 맡김">옷 스트라이프 원피스 · 머리 맡김<\/b><span class="sx-dp-look-hint" data-room-look-hint hidden>/);
  assert.match(redraw,/aria-expanded="true" aria-controls="room-looks">접기<\/button><\/p><div class="sx-dp-looks" id="room-looks" data-room-looks >/);
  // 같은 모델로 앞서 정한 값이 있으면(다시 제안) 그 값에서 시작하고, 다른 모델의 값은 넘어오지 않는다.
  assert.deepEqual(roomModel(photoProject({answers:{models:['F02'],outfit:'look-1',hair:'look-3'}})).proposal.look,{outfit:'look-1',hair:'look-3'});
  assert.deepEqual(roomModel(photoProject({answers:{models:['M06'],outfit:'look-1',hair:'look-3'}})).proposal.look,{outfit:'',hair:''});
  assert.match(card({answers:{models:['F02'],outfit:'look-1',hair:''}}),/aria-pressed="true" aria-label="파스텔 캐주얼" title="파스텔 캐주얼" data-room-look-pick="outfit" data-value="look-1">/);
  // 다른 제안은 열쇠가 달라 고르던 값을 물려받지 않는다(app.mjs s.proposeUi).
  assert.notEqual(roomModel(photoProject({proposal:{at:'2026-11-12T02:00:00.000Z'}})).proposal.key,roomModel(photoProject()).proposal.key);
});

test('the room sends both fields with the accept only when the row is drawn, and keeps the picks in the app state',()=>{
  const views=read('film-views.mjs'),app=read('app.mjs');
  assert.match(views,/if\(what==='model-accept'\)onModel\?\.\(\{accept:true,\.\.\.\(lookBoxEl\?\(now=>\(\{outfit:now\.outfit,hair:now\.hair\}\)\)\(lookNow\(\)\):\{\}\)\}\);/);
  assert.match(views,/const lookBoxEl=host\.querySelector\('\[data-room-look\]'\)/);
  assert.match(views,/if\(lookPick\)\{const key=lookPick\.dataset\.roomLookPick;ui\[key\]=ui\[key\]===lookPick\.dataset\.value\?'':lookPick\.dataset\.value;syncRoomLooks\(\);return;\}/,'press again to leave it to us');
  assert.match(app,/const proposeKey=room\?main\.querySelector\('\[data-room-look\]'\)\?\.dataset\.key\|\|'':'';if\(proposeKey&&s\.proposeUi\?\.key!==proposeKey\)s\.proposeUi=\{key:proposeKey\};/);
  assert.match(app,/mountRoom\(main,\{animate,ui:proposeKey\?s\.proposeUi:\{\},/);
  assert.match(read('views.mjs'),/ui:info\.proposal\?\.key&&s\.proposeUi\?\.key===info\.proposal\.key\?s\.proposeUi:\{\}\}\);/);
  // 사진 상품은 글 콘티가 없다 — 정한 뒤 글이 「첫 장」을 말한다.
  assert.match(app,/photo\?t\('모델을 정했어요\. 첫 장을 준비해 보내 드릴게요\.'\):t\('모델을 정했어요\. 글 콘티를 준비해 보내 드릴게요\.'\)/);
  const en=read('i18n/en.mjs');
  for(const key of ['제품에 맞춰 골라 드려요','고른 옷 · 머리는 사진에서 이 모습 그대로 맞춰요.','모델 {name}{ro} 정했어요 · {look}','모델을 정했어요. 첫 장을 준비해 보내 드릴게요.'])assert.ok(en.includes(`"${key}":`),key);
  // 옷 · 머리 칸에 둔 자판 초점은 실시간 다시 그리기 뒤 같은 칸으로 돌아간다(F4).
  assert.match(app,/look:previousFocus\.dataset\.roomLookPick\?previousFocus\.dataset\.roomLookPick\+':'\+previousFocus\.dataset\.value:''\}:null;/);
  assert.match(app,/focusKey\.look\?node\.dataset\.roomLookPick\+':'\+node\.dataset\.value===focusKey\.look:focusKey\.room\?/);
  // 「다른 모델 보기」 벽이 뜨는 큰 사진 칸이 창에 온전히 보이지 않으면(휴대폰에서 옷 · 머리를 편 채 아래에서 누름) 칸째 보이게 굴린다(F3).
  // 벽 상자가 아니라 벽을 자르는 그 칸으로 잰다 — 벽 상자로 재면 띠만 보이는 자리에서 굴리지 않았다(다시 검수 FA1).
  assert.match(views,/const frame=box\.closest\('\.sx-room-screen'\)\|\|box,at=frame\.getBoundingClientRect\(\),seen=Math\.min\(at\.bottom,innerHeight\)-Math\.max\(at\.top,0\);if\(seen<Math\.min\(at\.height,innerHeight\)-1\)frame\.scrollIntoView\(\{block:'nearest',behavior:reduced\(\)\?'auto':'smooth'\}\);/);
});

test('a photo order does not speak of films on the model proposal screen',()=>{
  // 사진 상품의 고객 방은 「영상 전 확인 n/3」을 달지 않고, 모델 제안의 안내는 「첫 장을 만들기 전에」다(F5).
  const html=card();
  assert.doesNotMatch(html,/영상 전 확인|장면을 만들기 전에/);
  assert.match(html,/첫 장을 만들기 전에 모델부터 정해요\. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요\./);
  // 영상 상품의 모델 제안은 그대로다.
  const film=roomView(roomModel(photoProject({answers:{package:'s15'}})));
  assert.match(film,/<span>영상 전 확인 <b class="sx-no">1\/3<\/b><\/span>/);
  assert.match(film,/장면을 만들기 전에 모델부터 정해요\./);
  assert.ok(read('i18n/en.mjs').includes(`'첫 장을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.':`));
});

test('after the model is set, the journal and the desk show the picked outfit and hair; all left to us stays short',()=>{
  const set=look=>photoProject({proposal:{status:'accepted',answeredAt:'2026-11-12T02:00:00.000Z',...(look?{look}:{})},answers:{models:['F02'],...(look||{})}});
  const p=set({outfit:'look-2',hair:''});
  assert.equal(journalModel(p).items.find(item=>item.id==='o:2026-11-12T01:00:00.000Z:ok').what,'모델 하린으로 정했어요 · 옷 스트라이프 원피스 · 머리 맡김');
  assert.equal(journalModel(set({outfit:'',hair:''})).items.find(item=>item.id==='o:2026-11-12T01:00:00.000Z:ok').what,'모델 하린으로 정했어요');
  assert.equal(journalModel(set()).items.find(item=>item.id==='o:2026-11-12T01:00:00.000Z:ok').what,'모델 하린으로 정했어요','an older record has no look');
  // 그 뒤 모델이 바뀌었으면(다른 모델로 바꾸기) 옛 모델의 옷 · 머리를 새 모델 이름 옆에 적지 않는다.
  const moved=set({outfit:'look-2',hair:''});moved.studio.request.answers.models=['M06'];
  assert.doesNotMatch(journalModel(moved).items.find(item=>item.id==='o:2026-11-12T01:00:00.000Z:ok').what,/옷 /);
  assert.equal(deskModel(p).modelProposal.lookText,'옷 스트라이프 원피스 · 머리 맡김');
  assert.match(deskView({...deskModel(p),queue:[]}),/고객이 정했어요<\/p><p class="desk-sum" data-desk-model-look>옷 스트라이프 원피스 · 머리 맡김<\/p>/);
  assert.equal(deskModel(set({outfit:'',hair:''})).modelProposal.lookText,undefined);
  assert.doesNotMatch(deskView({...deskModel(set({outfit:'',hair:''})),queue:[]}),/data-desk-model-look/);
  assert.equal(deskModel(photoProject()).modelProposal.lookText,undefined,'an open proposal shows nothing yet');
  // 첫 장 카드: 고른 것이 있으면 사진 상품에도 같은 한 줄과 그 옷 사진(다 맡겼으면 줄이 없다 — 위 시험).
  const sheet=set({outfit:'look-2',hair:''});sheet.studio.strategy.data.castingSelection={modelId:'F02',outfit:'look-2',hair:''};
  sheet.studio.scenes=[{id:'s1',revision:1,title:'컷 1',description:'캔을 든 반신',duration:3}];sheet.studio.request.rounds=[{round:1,kind:'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:'x'}];
  assert.match(draftView(draftModel(sheet)),/<img src="\.\/assets\/casting\/photos\/f02-look-2\.webp" alt="" class="is-outfit"><span class="sx-small"><b>하린<\/b> [^<]*<span class="sx-draft-look">옷 스트라이프 원피스 · 머리 맡김<\/span>/);
});

test('the card row uses the card width and the shared look styles are not tied to the direction sheet',()=>{
  const css=read('film.css');
  // min-width:0 — 카드는 grid라 이것이 없으면 고른 이름(한 줄 글)만큼 줄이 넓어져 휴대폰 화면이 가로로 넘친다(Fable 5.2 F1 — 이름이 긴 모델, 390 폭에서 106px).
  assert.match(css,/\.sx-propose>\.sx-dp-look\{justify-self:stretch;width:100%;min-width:0;max-width:520px;margin-top:8px;padding-top:10px;border-top:1px solid var\(--sx-rule\)\}/);
  // 고른 뒤 접어 두면 카드에서도 요약이 꺾여 이름이 다 보인다(방향 화면 규칙은 그 화면의 펼침 칸 이름에 묶여 있다 — F2).
  assert.match(css,/\.sx-dp-look:has\(\[data-room-looks\]\[hidden\]\) \.sx-dp-look-say\.is-picked\{max-height:none;overflow:visible\}/);
  assert.match(css,/\.sx-dp-look:has\(\[data-room-looks\]\[hidden\]\) \.sx-dp-look-say\.is-picked>b\{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all\}/);
  for(const rule of ['.sx-dp-look-row{','.sx-dp-looks{','.sx-dp-look-set{','.sx-dp-pics{','.sx-dp-pic{'])assert.ok(css.includes('\n'+rule)||css.includes('\r\n'+rule),rule+' is a top-level rule');
});

// ── 사진 상품의 말 · 담당자 방향 칸(2026-11-12 후속 — 운영 시험이 찾은 것과 설계 10절의 남긴 글). ──
test('after the customer switches models, the desk no longer shows the outfit and hair picked for the old model',()=>{
  const chosen=open({status:'chosen',chosenId:'b',answeredAt:'2026-11-10T06:00:00.000Z',look:{outfit:'look-2',hair:'look-3'}});
  const same=project({direction:chosen,answers:{models:['F02'],outfit:'look-2',hair:'look-3'},casting:{modelId:'F02',outfit:'look-2',hair:'look-3'}});
  assert.equal(deskModel(same).direction.look,'옷 스트라이프 원피스 · 머리 긴 웨이브');
  // 글 콘티의 「다른 모델로 바꾸기」 뒤: 의뢰 기록의 모델이 그 방향의 모델과 다르다 — 옛 모델의 값은 지금 모델 옆에 서지 않는다.
  const moved=project({direction:chosen,answers:{models:['M06'],outfit:'',hair:''},casting:{modelId:'M06',outfit:'',hair:''}});
  assert.equal('look' in deskModel(moved).direction,false);
  assert.doesNotMatch(deskView({...deskModel(moved),queue:[]}),/data-desk-look/);
  // 바꿨다가 처음 모델로 되돌려도 값은 비워져 「맡김」이다 — 그때 고른 값이 지금 의뢰 기록의 값과 같을 때만 보인다(Fable F5).
  const back=project({direction:chosen,answers:{models:['F02'],outfit:'',hair:''},casting:{modelId:'F02',outfit:'',hair:''}});
  assert.equal('look' in deskModel(back).direction,false);
  const partly=project({direction:chosen,answers:{models:['F02'],outfit:'look-2',hair:''},casting:{modelId:'F02',outfit:'look-2',hair:''}});
  assert.equal('look' in deskModel(partly).direction,false,'a later answer changed one value: the old pair is not shown as current');
  // 일지의 그때 줄은 기록이라 그대로 남는다.
  assert.equal(journalModel(moved).items.find(item=>item.id==='d:1:ok').what,'「톡」으로 정했어요 · 옷 스트라이프 원피스 · 머리 긴 웨이브');
});

test('a photo order reads as photos from the stage line to the first sheet, and a film order is unchanged',()=>{
  const scenes=[{id:'s1',revision:1,title:'첫 장',description:'캔을 든 반신',duration:3,assetId:'img-a'}];
  const sheet=(pkg,extra={})=>{const p=project({answers:{package:pkg,models:['F02']},casting:{modelId:'F02'},scenes,rounds:[{round:1,kind:'images',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:'2026-11-12T03:00:00.000Z',...extra}]});p.studio.request.modelProposal={modelId:'F02',status:'accepted',at:'2026-11-12T01:00:00.000Z',answeredAt:'2026-11-12T02:00:00.000Z'};return p;};
  const photo=sheet('photo'),film=sheet('s15');
  // 머리 단계 줄.
  assert.match(roomRail(roomModel(photo)),/>사진 · 납품<\/button>/);assert.doesNotMatch(roomRail(roomModel(photo)),/영상 · 납품/);
  assert.match(roomRail(roomModel(film)),/>영상 · 납품<\/button>/);
  // 고객 방: 첫 장이 도착한 때 · 사진이 도착한 때.
  const info=roomModel(photo);assert.equal(info.state,'images');
  const room=roomView(info);
  assert.match(room,/첫 장이 도착했어요/);assert.match(room,/첫 장을 보고 의견을 남겨 주세요\. 방향이 맞으면 나머지 장을 만들어요\./);assert.match(room,/<span>첫 장 보기<\/span>/);
  assert.doesNotMatch(room,/장면 이미지가 도착했어요|영상 전 확인|장면 이미지 보기/);
  const arrived=roomView({...info,state:'review',stage:'review'});
  assert.match(arrived,/사진이 도착했어요/);assert.match(arrived,/<span>사진 보기<\/span>/);assert.doesNotMatch(arrived,/영상이 도착했어요|영상 보기/);
  assert.match(roomView(roomModel(film)),/장면 이미지가 도착했어요/);
  // 첫 장 화면.
  const d=draftModel(photo);assert.equal(d.photo,true);assert.equal('photo' in draftModel(film),false,'a film order keeps the earlier shape');
  const html=draftView(d);
  assert.match(html,/<div class="sx-draft sx-dr  is-photo" data-draft/);
  assert.match(html,/<p class="sx-small">첫 장 · 1판 · 1장<\/p>/);
  assert.match(html,/<span class="sx-small" data-cut-sec><\/span>/,'no seconds on a photo');
  assert.match(html,/첫 장으로 방향을 맞춰요\. 의견을 주시면 그 결로 나머지 장을 만들어요\./);
  assert.match(html,/data-decide-note>첫 장을 보고 의견을 남겨 주세요\.<\/p>/);
  assert.match(html,/data-draft-do="approve"><span>이 첫 장대로 진행<\/span>/);
  assert.match(html,/aria-label="사진 목록">/);assert.match(html,/aria-label="1번째 장"/);
  assert.match(html,/이 장에서 무엇을 바꾸면 좋을까요\?/);
  assert.doesNotMatch(html,/영상 전 확인|움직이는 동안|제작 시작|컷을 하나씩|장면 이미지/);
  const filmHtml=draftView(draftModel(film));
  assert.match(filmHtml,/<div class="sx-draft sx-dr " data-draft/);assert.match(filmHtml,/영상 전 확인 <b class="sx-no">3\/3<\/b>/);assert.match(filmHtml,/data-draft-do="approve"><span>이대로 제작 시작<\/span>/);assert.match(filmHtml,/aria-label="1번 컷, 3\.0초"/);
  // 일지: 사진 상품의 그림 판은 「장면 이미지」가 아니라 「첫 장」이다.
  assert.equal(journalModel(photo).items.find(item=>item.id==='r:1').what,'첫 장 1판을 보냈어요');
  const closed=journalModel(sheet('photo',{feedbackAt:'2026-11-12T03:30:00.000Z',changes:2,approvedAt:'2026-11-12T04:00:00.000Z'})).items;
  assert.equal(closed.find(item=>item.id==='r:1:fix').what,'첫 장 1판에 고칠 곳 2개를 보냈어요');assert.equal(closed.find(item=>item.id==='r:1:ok').what,'첫 장 1판을 확인했어요');
  assert.equal(journalModel(sheet('photo',{note:'색을 맞췄어요'})).items.find(item=>item.id==='r:1').what,'첫 장 1판');
  assert.equal(journalModel(film).items.find(item=>item.id==='r:1').what,'장면 이미지 1판을 보냈어요');
  // 듣개 · 승인 창 · 꾸밈 · 영어.
  const views=read('film-views.mjs'),app=read('app.mjs');
  assert.match(views,/\$\('\[data-cut-sec\]'\)\.textContent=d\.photo\?'':secs\(cut\.seconds\);/);
  assert.match(views,/d\.photo\?t\('다 확인하셨어요\. 이대로 괜찮으면 이 첫 장대로 진행해요\.'\):script\?/);
  // 사진 말은 그림이 붙은 판(첫 장)에만 — 글만 든 판은 방 · 일지 · 대본 장과 같이 「글 콘티」 말 그대로다(카본 A1 · Fable F4: 같은 판을 두 이름으로 부르지 않는다).
  const text=project({answers:{package:'photo',models:['F02']},casting:{modelId:'F02'},scenes:[{id:'s1',revision:1,title:'첫 장',description:'캔을 든 반신',duration:3}],rounds:[{round:1,kind:'script',oneLine:'한 줄',scenes:[{id:'s1',revision:1}],sentAt:'2026-11-12T03:00:00.000Z'}]});
  assert.equal('photo' in draftModel(text),false);
  const textHtml=draftView(draftModel(text));
  assert.match(textHtml,/<div class="sx-draft sx-dr is-script" data-draft/);assert.match(textHtml,/글 콘티 · 1판/);assert.match(textHtml,/<span>이대로 장면 이미지 만들기<\/span>/);assert.doesNotMatch(textHtml,/첫 장 · 1판|is-photo/);
  assert.equal(journalModel(text).items.find(item=>item.id==='r:1').what,'글 콘티 1판을 보냈어요');
  // 방의 큰 그림 칸 설명(F2): 사진 상품은 움직임 · 장면 이미지 · 완성 영상을 말하지 않는다.
  assert.match(room,/<p class="sx-small sx-room-cap">첫 장 1판 · 1장<\/p>/);assert.doesNotMatch(room,/움직이는 동안/);
  assert.match(roomView(roomModel(film)),/1판 · 1컷\. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요\./);
  const bare=project({answers:{package:'photo',models:['F02']},casting:{modelId:'F02'}}),bareFilm=project({answers:{package:'s15',models:['F02']},casting:{modelId:'F02'}});
  for(const state of ['prepare','make']){
    const shown=roomView({...roomModel(bare),state});
    assert.match(shown,/저희가 만든 광고의 한 장면이에요\. 「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품/,state);assert.doesNotMatch(shown,/완성 영상의 예시예요|다음에 받으실 장면 이미지의 예시예요/,state);
  }
  assert.match(roomView({...roomModel(bareFilm),state:'make'}),/완성 영상의 예시예요\./);assert.match(roomView({...roomModel(bareFilm),state:'prepare'}),/다음에 받으실 장면 이미지의 예시예요\./);
  // 일지의 작업 소식 줄 단계 낱말(F3)과 첫 장 승인 뒤 알림(F1).
  assert.equal(journalModel(photo).photo,true);assert.equal('photo' in journalModel(film),false);
  assert.match(views,/stageName\(item\.stage,j\.photo\)/);
  assert.match(app,/model\.photo\?\(s\.project\?\.studio\?\.request\?\.payment\?\.status==='confirmed'\?t\('첫 장을 확인했어요\. 이 결로 나머지 장을 만들어요\.'\):t\('첫 장을 확인했어요\. 결제가 확인되면 나머지 장을 만들어요\.'\)\):t\('장면 이미지를 확인했어요\. 이 컷으로 제작을 시작해요\.'\)/);
  for(const key of ['첫 장을 확인했어요. 결제가 확인되면 나머지 장을 만들어요.','첫 장을 확인했어요. 이 결로 나머지 장을 만들어요.','첫 장 {round}판 · {count}장','저희가 만든 광고의 한 장면이에요. 「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품'])assert.ok(read('i18n/en.mjs').includes(`"${key}":`),key);
  assert.doesNotMatch(read('i18n/en.mjs'),/이대로 첫 장 만들기|이대로 괜찮으면 첫 장을 만들어요/,'the half-renamed text sheet strings are gone');
  assert.match(app,/photo\?t\('아직 확인하지 않은 \{count\}장도 이대로 진행해요\.',\{count:rest\}\):t\('아직 확인하지 않은 컷 \{count\}개도 이대로 만들어요\.',\{count:rest\}\)/);
  assert.match(read('film.css'),/\.sx-draft\.is-photo \.sx-strip-tc\{display:none\}/);
  const en=read('i18n/en.mjs');
  for(const key of ['첫 장이 도착했어요','첫 장 보기','사진이 도착했어요','사진 보기','{n}번째 장','{total}장 중 {count}장을 확인하셨어요.','첫 장 · {round}판 · {count}장','이 첫 장대로 진행','사진 목록','아직 확인하지 않은 {count}장도 이대로 진행해요.'])assert.ok(en.includes(`'${key}':`)||en.includes(`"${key}":`),key);
  assert.ok(en.includes('[`stage${C}사진 · 납품`]:'));
});
