import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// 화면 그림을 실제 화소의 1.5배 넘게 늘리지 않는 장치(data-cap, 11-13)와 그것을 단 자리의 약속. 회사 원천만 읽는다.
// 손님 사진 · 내 모델 그림처럼 크기를 모르는 그림, 큰 판이 모자란 예시 그림(霜の肌理 15초의 장 — 원본 영상 폭 1080이 한계)은
// api.mjs capPixels가 받은 파일의 실제 화소를 --cap-w · --cap-h로 적고, film.css가 칸을 「실제 화소 × 화소비 띠의 몫」 안으로 줄인다.
// 첫 화면 3쪽 · 고객 방의 모델 장면 사진은 큰 판(폭 1600)을 srcset으로 받고, 그래도 모자란 화면(5K)만 같은 장치가 칸을 줄인다.
// 화면마다 몇 배인지는 저장소 시험 tests/pulse-pixel-cap-scale.test.mjs, 「추천해 주세요」 가리키기 되돌림은 아래 마지막 시험.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const {capPixels,watchPixelCaps,dropSrcset}=await import('./public/pulse-app/api.mjs');
const {emptyAnswers,sceneSet}=await import('./public/pulse-app/request-data.mjs');
const {roomModel}=await import('./public/pulse-app/room-view.mjs');
const {roomView,ROOM_SCENE_SIZES}=await import('./public/pulse-app/film-views.mjs');
const {entryView,HOME_SCENE_SIZES}=await import('./public/pulse-app/film-home.mjs');
const {myModelsView}=await import('./public/pulse-app/my-models.mjs');

const fakeImg=({currentSrc,srcset=null,naturalWidth,naturalHeight})=>{
  const props={},img={tagName:'IMG',currentSrc,src:currentSrc,srcset,naturalWidth,naturalHeight,complete:true,ownerDocument:{baseURI:'http://localhost/pulse-app/index.html'},props,
    getAttribute:name=>name==='srcset'?img.srcset:null,hasAttribute:name=>name==='data-cap'||(name==='srcset'&&img.srcset!=null),style:{setProperty(key,value){props[key]=value;}}};
  return img;
};

// 파일을 새로 열어 재는 길(앞서 srcset을 그린 img)은 Image가 있어야 한다 — 주소마다 실제 크기를 돌려주는 흉내. 몇 번 열었는지 센다.
const FILES=new Map([['blob:http://localhost/1',[1080,1350]],['blob:http://localhost/2',[640,800]]]);
let opened=0;
globalThis.Image=class{constructor(){opened++;}set src(value){const size=FILES.get(value);if(size){[this.naturalWidth,this.naturalHeight]=size;this.onload?.();}}};

test('capPixels writes the real pixels of the file the browser took, also out of a srcset where naturalWidth is divided by the density',()=>{
  // srcset을 그린 적 없는 img는 naturalWidth가 실제 화소다 — 파일을 다시 열지 않는다(서버 그림은 no-store라 다시 받을 수도 있었다, Fable 5.2 -b P3).
  opened=0;const own=fakeImg({currentSrc:'blob:http://localhost/1',naturalWidth:1080,naturalHeight:1350});
  capPixels(own);assert.deepEqual(own.props,{'--cap-w':'1080px','--cap-h':'1350px'},'a picture that never drew a srcset: its own naturalWidth');
  assert.equal(opened,0,'and the file is not opened a second time');
  // 같은 img가 앞서 srcset 그림을 그렸다가 src만 바꾸면 크롬은 naturalWidth를 앞 판의 밀도로 나눈 채 준다(Fable 5.2 F2 — 640이 328) — 그 값을 믿지 않는다.
  const back=Object.assign(fakeImg({currentSrc:'blob:http://localhost/2',naturalWidth:328,naturalHeight:410}),{__drewSet:true});
  capPixels(back);assert.deepEqual(back.props,{'--cap-w':'640px','--cap-h':'800px'},'a picture that had a srcset before keeps its real size');
  assert.equal(opened,1,'only that one is measured from the file itself');
  const set='./assets/request/model-scene-f02.webp 960w, ./assets/request/model-scene-f02-l.webp 1600w';
  const large=fakeImg({currentSrc:'http://localhost/pulse-app/assets/request/model-scene-f02-l.webp',srcset:set,naturalWidth:800,naturalHeight:993});
  capPixels(large);assert.deepEqual(large.props,{'--cap-w':'1600px','--cap-h':'1986px'},'the large cut is 1600 wide whatever density the browser chose it at');
  const small=fakeImg({currentSrc:'http://localhost/pulse-app/assets/request/model-scene-f02.webp',srcset:set,naturalWidth:1920,naturalHeight:2384});
  capPixels(small);assert.deepEqual(small.props,{'--cap-w':'960px','--cap-h':'1192px'},'the small cut is 960 wide even when the browser lays it out at a lower density');
  const none=fakeImg({currentSrc:'',naturalWidth:0,naturalHeight:0});capPixels(none);assert.deepEqual(none.props,{},'nothing loaded yet: no cap is written');
});

test('one capture listener on the document measures every data-cap picture as it loads, once, and does nothing without a document',()=>{
  const listeners=[];const root={addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture}),querySelectorAll:()=>[]};
  watchPixelCaps(root);watchPixelCaps(root);
  assert.equal(listeners.length,1,'registered once');assert.deepEqual([listeners[0].type,listeners[0].capture],['load',true],'load does not bubble, so it is heard on the way down');
  const img=fakeImg({currentSrc:'blob:http://localhost/2',naturalWidth:640,naturalHeight:800});listeners[0].fn({target:img});
  assert.deepEqual(img.props,{'--cap-w':'640px','--cap-h':'800px'});
  const plain={...fakeImg({currentSrc:'x',naturalWidth:1,naturalHeight:1}),hasAttribute:()=>false};listeners[0].fn({target:plain});assert.deepEqual(plain.props,{},'pictures without data-cap are left alone');
  // 큰 칸 그림 바꾸기의 길: data-cap 없이 srcset으로 받은 img를 표시해 두었다가, srcset을 떼고 손님 사진으로 바꾸면 그 파일을 새로 열어 잰다.
  const big=fakeImg({currentSrc:'http://localhost/pulse-app/assets/request/model-scene-f02-l.webp',srcset:'./assets/request/model-scene-f02.webp 960w, ./assets/request/model-scene-f02-l.webp 1600w',naturalWidth:800,naturalHeight:993});
  big.hasAttribute=name=>name==='srcset'&&big.srcset!=null;listeners[0].fn({target:big});
  assert.equal(big.__drewSet,true,'an img that loaded a srcset is marked even without data-cap');assert.deepEqual(big.props,{},'and is not capped');
  Object.assign(big,{srcset:null,currentSrc:'blob:http://localhost/2',src:'blob:http://localhost/2',naturalWidth:328,naturalHeight:410,hasAttribute:name=>name==='data-cap'});
  opened=0;listeners[0].fn({target:big});
  assert.deepEqual(big.props,{'--cap-w':'640px','--cap-h':'800px'},'after the srcset is taken off, the stale naturalWidth is not trusted');assert.equal(opened,1);
  // 밀도는 srcset 판을 고를 때 남는다 — 그 판이 아직 오는 중이거나 못 받아 load가 없었어도 떼는 순간(dropSrcset) 표시한다(11-13 크롬 실측: 손님 사진 1080이 607로).
  const late=fakeImg({currentSrc:'http://localhost/pulse-app/assets/request/model-scene-f02-l.webp',srcset:'./assets/request/model-scene-f02.webp 960w, ./assets/request/model-scene-f02-l.webp 1600w',naturalWidth:0,naturalHeight:0});
  const gone=[];late.removeAttribute=name=>{gone.push(name);if(name==='srcset')late.srcset=null;};
  dropSrcset(late);assert.equal(late.__drewSet,true,'marked when the srcset is taken off, with no load before');assert.deepEqual(gone,['srcset','sizes']);
  Object.assign(late,{currentSrc:'blob:http://localhost/1',src:'blob:http://localhost/1',naturalWidth:607,naturalHeight:759});
  opened=0;listeners[0].fn({target:late});
  assert.deepEqual(late.props,{'--cap-w':'1080px','--cap-h':'1350px'},'the customer photo keeps its real 1080 although naturalWidth says 607');assert.equal(opened,1);
  const plainDrop=fakeImg({currentSrc:'blob:http://localhost/2',naturalWidth:640,naturalHeight:800});plainDrop.removeAttribute=()=>{};
  dropSrcset(plainDrop);assert.equal(plainDrop.__drewSet,undefined,'an img without a srcset is not marked');
  assert.ok(read('request-flow.mjs').includes("else dropSrcset(img);"),'the big portrait takes its srcset off through dropSrcset');
  assert.doesNotThrow(()=>watchPixelCaps(undefined));
  assert.ok(read('api.mjs').includes('\nwatchPixelCaps();'),'api.mjs starts listening when it is read — every screen module reads it before it draws');
});

test('film.css keeps the cap box to the picture’s pixels times the pixel-ratio band share, and only where it would overflow',()=>{
  const css=read('film.css');
  assert.ok(css.includes('img[data-cap]{--cap-k:1.47;margin:auto;max-width:calc(var(--cap-w) * var(--cap-k));max-height:calc(var(--cap-h) * var(--cap-k))}'));
  const bands=re=>[...css.matchAll(re)].map(([,dppx,k])=>[Number(dppx),Number(k)]);
  const cap=bands(/@media not all and \(max-resolution:([\d.]+)dppx\)\{img\[data-cap\]\{--cap-k:([\d.]+)\}\}/g),shot=bands(/@media not all and \(max-resolution:([\d.]+)dppx\)\{\.sx-q-fill\[data-shot\]\{--shot-k:([\d.]+)\}\}/g);
  assert.deepEqual(cap,shot,'the same bands as the work pictures');
  assert.deepEqual(cap.map(([dppx])=>dppx),[1,1.25,1.5,2,2.5,3,4]);
  // 띠 [아래, 위]의 몫 k는 1.47 ÷ 위 — 띠 안의 어느 화소비에서도 k × 화소비 ≤ 1.47.
  const tops=[1.25,1.5,2,2.5,3,4,5];
  cap.forEach(([,k],i)=>assert.ok(Math.abs(k-1.47/tops[i])<0.001,`band above ${cap[i][0]}dppx: ${k} = 1.47 ÷ ${tops[i]}`));
  assert.ok(css.includes(':is(.sx-casting-lead,.sx-q-how figure,.sx-pane-cast figure,.sx-mm-face,.sx-casting .sx-cast)>img[data-cap]{position:absolute;inset:0}'),'pictures that filled their box in the flow sit over it, so a smaller box centres both ways');
  assert.doesNotMatch(css,/img\[data-cap\][^{]*\{[^}]*object-fit/,'the cap never changes how a picture fills its box');
});

function project({answers={},files=[],proposal=null,state=''}={}){
  const p={id:'p1',title:'오미톡',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,studio:{assets:files.map((url,i)=>({id:'a'+i,mimeType:'image/jpeg',fileName:`a${i}.jpg`,url})),scenes:[],strategy:{revision:1,data:{castingSelection:{modelId:'',hair:'',outfit:''}}},request:{status:'confirmed',number:'P-1110-ABCD',submittedAt:'2026-11-10T03:00:00.000Z',confirmedAt:'2026-11-10T04:00:00.000Z',answers:{...emptyAnswers(),name:'오미톡',kind:'food',channels:['shorts'],package:'s15',modelChoice:'ask',...answers},files:files.map((_,i)=>({id:'a'+i,slot:'product',fileName:`a${i}.jpg`})),asks:[],notes:[],rounds:[],castingLooks:true,paymentFlow:true}}};
  if(proposal)p.studio.request.modelProposal={modelId:proposal,note:'',at:'2026-11-12T01:00:00.000Z',by:'김하늘',status:'open'};
  const info=roomModel(p);if(state)info.state=state;return info;
}

test('the room screen: the model scene takes its large cut through srcset, and every picture there keeps to its pixels',()=>{
  const model=roomView(project({answers:{package:'photo'},proposal:'F02'}));
  assert.ok(model.includes(`<img class="sx-q-fill" src="./assets/request/model-scene-f02.webp" srcset="${sceneSet('./assets/request/model-scene-f02.webp')}" sizes="${ROOM_SCENE_SIZES}" data-cap alt="">`),'the proposed model: two cuts and the cap');
  // sizes = cover 폭 ÷ 1.47 — 넓은 창은 스크린 폭(54vw)과 창 높이 × 0.805 가운데 큰 쪽, 세로 창은 창 폭과 32vh × 0.805 가운데 큰 쪽.
  assert.equal(ROOM_SCENE_SIZES,'(max-width:820px) max(68.1vw,17.6vh), (max-aspect-ratio:1/1) max(68.1vw,17.6vh), max(36.8vw,54.8vh)');
  assert.ok(roomView(project()).includes('<img class="sx-q-fill" src="./assets/request/w-gift-snow.webp" data-cap alt="">'),'the example picture before any work arrives');
  assert.ok(roomView(project({state:'make'})).includes('<img class="sx-q-fill" src="./assets/request/w-gift.webp" data-cap alt="">'),'the example picture while the film is made');
  const files=roomView(project({files:['/m/a.jpg','/m/b.jpg']}));
  assert.match(files,/<div class="sx-room-files" data-count="2"><img src="\/m\/a\.jpg" data-cap alt="" decoding="async"><img src="\/m\/b\.jpg" data-cap alt="" decoding="async"><\/div>/,'the customer’s own photos');
  const views=read('film-views.mjs'),legacy=read('views.mjs'),persona=read('persona-view.mjs');
  assert.ok(views.includes('<img class="sx-q-fill" src="${esc(pics[0])}" data-cap alt="" decoding="async">')&&views.includes('<img class="sx-q-fill" src="${esc(p.direction.chosen.src)}" data-cap alt="" decoding="async">'),'work news and the chosen direction');
  assert.equal((legacy.match(/<img class="sx-q-fill" src="\.\/assets\/request\/w-gift(?:-snow)?\.webp" data-cap alt="" decoding="async">/g)||[]).length,3,'the older project screens’ example pictures');
  assert.equal((persona.match(/<img class="sx-q-fill" src="\$\{esc\(m\.reference\.assets\[0\]\.url\)\}" data-cap alt="" decoding="async">/g)||[]).length,2,'the persona card’s reference face');
  assert.doesNotMatch(views+legacy+persona,/<img class="sx-q-fill" src="[^"]*"(?![^>]*data-cap)[^>]*>/,'no screen picture left without the cap');
});

test('the first screen’s third page fetches the model scenes with their large cut where a small one would stretch, and caps what is left',()=>{
  const html=entryView({}),figures=[...html.matchAll(/<div class="sx-pane sx-pane-cast is-on">(.*?)<\/div>/g)][0][1];
  const imgs=[...figures.matchAll(/<img [^>]*>/g)].map(([tag])=>tag);
  assert.ok(imgs.length>=3);
  for(const tag of imgs){
    const src=tag.match(/data-src="([^"]+)"/)[1];
    assert.ok(tag.includes(`data-srcset="${sceneSet(src)}" sizes="${HOME_SCENE_SIZES}" data-cap`),tag);
    assert.doesNotMatch(tag,/ src=/,'still drawn lazily — nothing is fetched until the page comes near');
  }
  assert.equal(HOME_SCENE_SIZES,'(max-width:820px) max(68.1vw,17.6vh), (max-aspect-ratio:1/1) max(68.1vw,17.6vh), max(min(39.5vw,953px),54.8vh)');
  assert.ok(read('film-home.mjs').includes("for(const img of node.querySelectorAll('img[data-src]')){if(img.dataset.srcset){img.srcset=img.dataset.srcset;img.removeAttribute('data-srcset');}img.src=img.dataset.src;img.removeAttribute('data-src');}"),'the set goes on before the src, so a high-density screen fetches only the large cut');
});

test('the request form: customer photos, my-model pictures and the example pictures before a business is chosen keep to their pixels',()=>{
  const flow=read('request-flow.mjs');
  assert.ok(flow.includes("${shape?` data-shot=\"${shape}\"`:' data-cap'} alt=\"\"><div class=\"sx-q-copy"),'the ad frame of the words steps: a customer photo or the example picture');
  assert.ok(flow.includes('<div class="sx-q-how"><figure><img src="${esc(own||still(\'file-gift-set\'))}" data-cap alt="">'),'the files step: the customer’s photo or the example box');
  assert.ok(flow.includes('`<figure><img src="${still(name)}" data-cap alt=""><figcaption'),'the files step: the example scene and film pictures');
  const mm=myModelsView({view:'list',data:{workspaces:[{id:'w1',name:'가 브랜드',role:'admin',models:[{id:'11111111-1111-4111-8111-111111111111',name:'하루',kind:'virtual',status:'ready',usable:true,reason:null,revisionId:'22222222-2222-4222-8222-222222222222',image:'/api/customer/pulse/asset/x',reuse:true,until:'2027-11-10T14:59:59.999Z',lastUsedAt:'2026-11-10T03:00:00.000Z',deletionRequested:false}],pending:[]}]}});
  assert.match(mm,/<figure class="sx-mm-face "><img src="\/api\/customer\/pulse\/asset\/x" data-cap alt="" loading="lazy" decoding="async"><\/figure>/,'my models: the face');
  // 보관 동의 화면: 이름 줄은 얼굴 칸(3:4 · 넘침 자름) 밖 아래 — 칸 안이면 잘려 안 보였다(Fable 5.2 F3, 이 변경 전부터).
  assert.ok(read('my-models.mjs').includes('<div class="sx-mm-paper-main"><figure class="sx-mm-paper-face"><div class="sx-mm-face ${card.image?\'\':\'is-empty\'}">${face(card)}</div><figcaption class="sx-small">${esc(nameOf(card))}</figcaption></figure>'));
  // 좁은 창 후보 묶음은 폭을 스스로 정한다 — 후보 사진이 칸 위에 겹쳐 놓이면 내용 폭이 없어 가운데 맞춤에 3px로 줄었다(Fable 5.2 F1).
  assert.match(read('film.css'),/\n {2}\.sx-casting\{position:relative;inset:auto;width:100%;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);/);
});

test('the four candidates beside the big portrait add the scene photo’s cuts to their casting photo — the same picture — and only there',async()=>{
  const {castSet,CAST_SIZES}=await import('./public/pulse-app/request-flow.mjs');
  const {CASTING_MODELS}=await import('./public/pulse-app/casting-catalog.mjs');
  const webpWidth=bytes=>{const kind=bytes.toString('latin1',12,16);return kind==='VP8 '?bytes.readUInt16LE(26)&0x3fff:kind==='VP8L'?(bytes.readUInt32LE(21)&0x3fff)+1:bytes.readUIntLE(24,3)+1;};
  assert.equal(CASTING_MODELS.length,21);
  for(const item of CASTING_MODELS){
    const set=castSet(item);
    if(item.id==='F09'){assert.equal(set,'','F09’s casting photo is another take than its scene photo (11-13 pixel check) — it keeps its own photo and only the cap');continue;}
    const [context,small,large]=set.split(', ').map(part=>part.split(' '));
    const id=item.id.toLowerCase();
    assert.deepEqual([context[0],small,large],[`./assets/casting/photos/${id}-context.webp`,[`./assets/request/model-scene-${id}.webp`,'960w'],[`./assets/request/model-scene-${id}-l.webp`,'1600w']],item.id);
    assert.equal(context[1],`${webpWidth(readFileSync(new URL(context[0],appDir)))}w`,`${item.id}: the casting photo’s width descriptor is its real width`);
  }
  assert.equal(CAST_SIZES,'(max-width:820px) 18.3vw, (max-aspect-ratio:1/1) 18.3vw, max(14.7vw,calc(27.2vw - 185px),13.7vh)');
  const flow=read('request-flow.mjs');
  assert.ok(flow.includes("${picks.map(item=>castTile(a,item,!!MODEL_LINES[item.id]?.fits.includes(a.kind),true)).join('')}"),'the four beside the big portrait');
  assert.ok(flow.includes(".map(item=>castTile(a,item,fit(item))).join('')}"),'the 21-model wall keeps the casting photo alone — its boxes are small enough');
});

test('pointing at a candidate previews them; leaving the candidates puts back what was chosen (「추천해 주세요」 no longer stays on that person)',()=>{
  const flow=read('request-flow.mjs');
  assert.ok(flow.includes("const previewCast=event=>{const cast=event.target.closest?.('.sx-cast');if(cast){clearTimeout(castBack);showModel(cast.dataset.id);}};"),'pointing still previews, and cancels a pending way back');
  assert.ok(flow.includes("const leaveCast=event=>{if(!event.target.closest?.('.sx-cast')||event.relatedTarget?.closest?.('.sx-cast'))return;clearTimeout(castBack);if(!choiceText(a)&&!a.models.length)return;castBack=setTimeout(()=>{if(host.isConnected)showChoice();},160);};"),'leaving for anything but another candidate goes back to the choice — nothing chosen keeps the last person (browsing)');
  assert.ok(flow.includes("host.addEventListener('mouseout',leaveCast);host.addEventListener('focusout',leaveCast);"),'by pointer and by keyboard');
  assert.match(flow,/function showChoice\(\)\{const text=choiceText\(a\);if\(!text\)\{const first=a\.models\[0\]\|\|picksOf\(a\)\[0\]\?\.id;if\(first\)showModel\(first\);return;\}/,'with no choice text the way back is the first picked person');
});
