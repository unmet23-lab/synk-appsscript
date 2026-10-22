import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {CASTING_OPTIONS,CASTING_BOOK_URL,castingFromForm,takeCastingValues,castingSummary,castingView,castingVoices,castingPhotos,normalizeDemoCasting} from './public/pulse-app/casting-view.mjs';
import {normalizeCastingSelection} from './pulse-strategy.mjs';
import {strategyView,strategyHistory} from './public/pulse-app/strategy-view.mjs';
import {createDemoSession} from './public/pulse-app/demo.mjs';


test('demo casting and server use matching options and reject invalid combinations',()=>{
  for(const model of CASTING_MODELS)for(const voice of ['','A','B','C']){
    const selection={modelId:model.id,voice};assert.deepEqual(normalizeDemoCasting(selection),normalizeCastingSelection(selection));
  }
  for(const [key,{values}]of Object.entries(CASTING_OPTIONS))for(const value of Object.keys(values))assert.deepEqual(normalizeDemoCasting({[key]:value}),normalizeCastingSelection({[key]:value}));
  for(const invalid of [{voice:'A'},{modelId:'unlisted'},{hair:'unknown'},{notes:'bad\u0000'},{notes:'x'.repeat(1001)},{unexpected:'secret'}])assert.throws(()=>normalizeDemoCasting(invalid));
});
test('read-only fields still produce an accurate selection and submission strips only casting UI keys',()=>{
  const form={elements:[{name:'cast_modelId',type:'radio',value:'F01',checked:true,disabled:true},{name:'cast_modelId',type:'radio',value:'M01',checked:false,disabled:true},{name:'cast_voice',type:'radio',value:'B',checked:true,disabled:true},{name:'cast_notes',type:'textarea',value:'메모',disabled:true}]};
  assert.equal(castingFromForm(form).modelId,'F01');assert.equal(castingFromForm(form).voice,'B');
  const values={product:'기존 제품',cast_modelId:'F01',cast_voice:'B',cast_notes:'메모'},selection=takeCastingValues(values);
  assert.deepEqual(values,{product:'기존 제품'});assert.equal(selection.modelId,'F01');assert.equal(selection.voice,'B');
});
test('seven model portraits, four photos of the chosen model, playable selected voices, no film slots and escaped notes appear in summaries',()=>{
  const selection=normalizeDemoCasting({modelId:'F01',voice:'B',jacket:'blazer',notes:'<img src=x onerror=alert(1)>'});
  const html=castingView(selection);assert.equal((html.match(/class="casting-model-card"/g)||[]).length,7);assert.equal((html.match(/alt="[^"]+ 대표 사진" loading="lazy"/g)||[]).length,7);assert.doesNotMatch(html,/대표 사진 준비 중|음성 샘플 준비 중/);assert.doesNotMatch(html,/영상 준비 중|casting-media-pending|영상은 만들고 있어요/);assert.equal((html.match(/class="casting-photo" data-action="image"/g)||[]).length,4);assert.equal((html.match(/<audio preload="none" src="[^"]+" hidden><\/audio>/g)||[]).length,3);assert.equal((html.match(/<button type="button" class="voice-play" data-action="voice-play" aria-label="[^"]+ 듣기">듣기<\/button>/g)||[]).length,3);assert.doesNotMatch(html,/<video|src=""/);assert.doesNotMatch(castingSummary(selection),/<img/);
  assert.match(castingVoices({}),/disabled/);assert.match(castingVoices({modelId:'M01'}),/부드럽고 차분한/);
  assert.doesNotMatch(html,/샘플 음원은 연결 준비 중/);assert.match(html,/샘플을 듣고 원하는 목소리/);
  assert.match(castingVoices({modelId:'M03'}),/실제 목소리 · 인터뷰 원음\(배경음악 포함\)/);assert.doesNotMatch(castingVoices({modelId:'F01'}),/인터뷰 원음/);
  const project={studio:{strategy:{revision:2,data:{castingSelection:selection},history:[{revision:1,data:{castingSelection:selection}}]}}};
  assert.match(strategyView({project,mode:'staff',canEdit:false}),/유나/);assert.match(strategyHistory(project),/블레이저/);assert.doesNotMatch(castingView(selection,{editable:false}),/type="submit"/);
});
test('demo saves casting without network, reloads it and keeps an earlier selection in history',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  let demo=createDemoSession({storage}),project=demo.snapshot().project;
  const selection=normalizeDemoCasting({modelId:'F02',voice:'B',hair:'wave',jacket:'blazer',notes:'합성 테스트'});
  await demo.request('/pulse/api/studio',{method:'POST',body:{action:'save_strategy',revision:project.revision,strategy:{...project.studio.strategy.data,castingSelection:selection}}});
  demo=createDemoSession({storage});project=demo.snapshot().project;assert.deepEqual(project.studio.strategy.data.castingSelection,selection);
  await demo.request('/pulse/api/studio',{method:'POST',body:{action:'save_strategy',revision:project.revision,strategy:{...project.studio.strategy.data,castingSelection:{...selection,modelId:'M01',voice:''}}}});
  assert.deepEqual(demo.snapshot().project.studio.strategy.history.at(-1).data.castingSelection,selection);
});

// Same bytes as the casting book's site/voice (copied 2026-10-19) so a client hears the voices the book plays;
// M03 keeps the interview originals and f04 the approved portrait. No cross-model substitutions or transcoding.
const RESTORED_MEDIA_SHA256={
  "assets/casting/f04.webp": "2e58b62ce8039865bc4ed2a6165300c7a1147d5aabd745079c134bbe1d75cdfb",
  "assets/casting/voice/F01-1.mp3": "0e1c1628659661857aaedcd29cae64e4dafdba61496ceb1270c467282ad18f7f",
  "assets/casting/voice/F01-2.mp3": "c42813e425ac708b90fcacdfce37f886bee88e94dbae888faa9b8bf6c96bdd26",
  "assets/casting/voice/F01-3.mp3": "4af0e37fc7e129e6c8e41c2b61850392b5f0e08087b1e8cf5de40bae7a052fd3",
  "assets/casting/voice/F02-1.mp3": "dfade28a7094250e592f218395ea792b883c9273bbc0e71d9c946456d4ff0356",
  "assets/casting/voice/F02-2.mp3": "16d041c0bfffdcd86c33205686fc5beaf1d3ab9454ad5219083742b249616a2a",
  "assets/casting/voice/F02-3.mp3": "8c846a468d582e4b69de6df2ced56a9ac8633bab14cfea1db5497f688449f6ba",
  "assets/casting/voice/F03-1.mp3": "51a6c9bf35e210cf3912bdd13b36dcd11f6be0de14dde2173996b0507357aaaa",
  "assets/casting/voice/F03-2.mp3": "05635d102dbafb1ea4ef48a146fdaa47c0dfc4c2b2e6d085298d98ff4fd5dff2",
  "assets/casting/voice/F03-3.mp3": "38ccb8c5787f7d0d42bc774a5ec4be8130f6e9b6aa66694b4525b0aedca64fda",
  "assets/casting/voice/F04-1.mp3": "6442cf3c05bee8f21d02ba2a9062cdc8e62730c2b2b190d496224492daaf2013",
  "assets/casting/voice/F04-2.mp3": "70d270adb302e52ac98c30648d6df6c58c76f80b518ad3024a16f9373bdf8bf0",
  "assets/casting/voice/F04-3.mp3": "967cb24f9cffc72ec923d1b64e1b175b3632c11f1ea91c7d5e82da27e64e89af",
  "assets/casting/voice/M01-1.mp3": "a24faa5f009d8c3aa7ecc447a22b23d0c47e57c036622f8bdba8c37b8b1d58cb",
  "assets/casting/voice/M01-2.mp3": "f65e20d4b56558875ed61137f526d020513d151b62276ab36d027bd647129368",
  "assets/casting/voice/M01-3.mp3": "717579033fcf4a001dbfe7391e46a405779c51b150305f5fe669e8bf9cf5d865",
  "assets/casting/voice/M02-1.mp3": "282fd2df19e52a275607c84db4df9b1234a086a4480805f188dcde18c2fba912",
  "assets/casting/voice/M02-2.mp3": "7f9a8b160b137c744f74867d778f21a5ecc55ca7e25a6bf5f55ca44db45f568d",
  "assets/casting/voice/M02-3.mp3": "18b1bf45fad1d73b166c9cde5ed0ed6fe166907f3c68d40a91916d84fb1ed835",
  "assets/casting/voice/M03-1.mp3": "417c1e652e70478c373a2c357ce1a7db1539b56e004ea5f582ddd558f40e24c8",
  "assets/casting/voice/M03-2.mp3": "44de06897bc9b3225c7c1907631f32c8f074b620934a4e040751fb82c4cdaaec",
  "assets/casting/voice/M03-3.mp3": "e2f3af34009c810bfaf9022ae002d8db3ab5cfa1e7c38cf9c0de2b8b5a3c1e94"
};

test('restored samples retain exact approved portrait and canonical per-model A/B/C audio bytes',async()=>{
  const urls=new Set();
  for(const model of CASTING_MODELS){
    assert.ok(model.image,model.id+' portrait');
    // 10-22 모델은 사진만: 광고·런웨이 영상 칸과 작품 칸이 없다(완성 광고는 films-view.mjs).
    assert.equal('videos' in model||'works' in model,false,model.id+' has no film slots');assert.equal(model.photos.length,4,model.id+' photos');
    assert.deepEqual(model.voices.map(v=>v.id),['A','B','C']);
    const html=castingVoices({modelId:model.id});
    for(const [i,voice]of model.voices.entries()){
      const src=`./assets/casting/voice/${model.id}-${i+1}.mp3`;
      assert.equal(voice.src,src);assert.equal(urls.has(src),false);urls.add(src);
      assert.ok(html.includes(`<button type="button" class="voice-play" data-action="voice-play" aria-label="${model.name} 목소리 ${voice.id} 듣기">듣기</button><audio preload="none" src="${src}" hidden></audio>`),src);
    }
    assert.doesNotMatch(html,/autoplay|preload="auto"|src=""/);
  }
  assert.equal(urls.size,21);
  assert.equal(CASTING_MODELS.find(m=>m.id==='F04').image,'./assets/casting/f04.webp');
  for(const [relative,expected]of Object.entries(RESTORED_MEDIA_SHA256)){
    const bytes=await readFile(new URL('./public/pulse-app/'+relative,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,relative);
  }
});

// 10-22 모델은 사진만(유호님): 모델 칸은 그 모델의 사진 넉 장(전신·룩 둘·장면)만 — 캐스팅북 빌드 site/img/<코드>/<컷>-s.webp와 같은 바이트.
const PHOTO_SHA256={
  "f01-context.webp": "e7db910f0f80f9015fb9985bcbae418b6c43ebe2d6cf8983ba33ebd1cf0ad1cb",
  "f01-fullbody.webp": "18ca3134c8a9218aafe3712b40758f89684f83da37143821ca180d4153df82fa",
  "f01-look-1.webp": "56319b3defc8071ba29de9f895d93f4af0a5de4e0a97f71da6de42f618d8ea5e",
  "f01-look-2.webp": "67f1bab1b529ce4ef7bb380d745cc89c3c1972b01437babfcfd821ba4a0ce3bf",
  "f02-context.webp": "a86e5a588e8afb228e1776bde76d867397f69d8be465a58f468b684047874248",
  "f02-fullbody.webp": "02bfe491d40b212149b29d97e6803d71218e91067f78004fe39dcaa798da3bbd",
  "f02-look-1.webp": "36a569de140b007a0df8a6ee99be842ada14fdfcabfce6239b7595082c75951b",
  "f02-look-2.webp": "77dd44fd6087ac4183a83496dc7449408f4fddd10e9678c2edccb4cc65449aff",
  "f03-context.webp": "bd6c87d04904dd48406cb9cc06471a463012273882a263a3ab75ca936e1b2218",
  "f03-fullbody.webp": "6597319016e652b2518f913d89e232a99bda75a2b46edbcfb90a8f558d34bf90",
  "f03-look-1.webp": "388d466be2e83f08d9eb2febed85f1f528a6d6146763b2e1a6382049d2bd49cf",
  "f03-look-2.webp": "61c0670fcb2fb14c45b5828f0298ee8e3fbf9d4cc02b152c9e6ffb55f2778076",
  "f04-context.webp": "eebabed827af3721af4170f1e004f5f7f1f15127d76f37c370282bbc6190b671",
  "f04-fullbody.webp": "c6325bd76849fb7219ef2485207bae03e3cf63900e458b851359ffef63fc109b",
  "f04-look-1.webp": "e0989a5904b601ed2aba42f0f86c232d8c61ebededda135ce13c29a8a57d9f14",
  "f04-look-2.webp": "17cf2ce44e2a8fc1659341136845148c3a26f4559b1c578bf738820381d61ded",
  "m01-context.webp": "138218c5a4347e1c80363bd6c487f76e1ece2ae604c24be0a94eb83b5500bc9d",
  "m01-fullbody.webp": "ef0712042cb93b81fae62b6e16f15e12f1afb5567e6bed7468ab6b1d52521f8e",
  "m01-look-1.webp": "0f35fc5714e597a6375df1fa6ee734f4478a0036db78aac96f5c6bf4d10a54f0",
  "m01-look-2.webp": "09a3b643623ba157379215216ade8d80684bf4e4dc68460b81e0596e8bf0f830",
  "m02-context.webp": "32f0f574bccafe350e08be549b1eebe5704939418c7eac8cd68656b2ec607391",
  "m02-fullbody.webp": "133f0bc2ba387db1d6bd2c8483fdbc52e051942099c9acd84c6b6737221cdd59",
  "m02-look-1.webp": "95fa7b853ec1be7080e84d94e49640629aa4df9530a90ed7af631f2d76788e07",
  "m02-look-2.webp": "af72d40372bd0b982c34af3179ed8ca9b425ce2e581f8ae59c657c4ec19b9d60",
  "m03-context.webp": "e827cbea8b4a7573a0075e93b3e1bc2ea37aa3d4316f5cfea188df9daba9a7f3",
  "m03-fullbody.webp": "ce9c979feabbf7feae2ce0573594a4ba3b68c46a0bce63b2a94e753cb864be53",
  "m03-look-1.webp": "bbb2abf98a24f60ce859613d9b806d88f92e1ff0f14623e851acaaacbf89fa88",
  "m03-look-2.webp": "2a9a136c96c719f1a1e2a6567ede5bbc70f87e44b5b1a375c584fa38b711da89"
};
const LOOKS={M01:['셔츠 오피스','레더 스트리트','창가 카페 · 커피잔'],F01:['슬립 드레스','트렌치 캐주얼','화장대 · 립스틱 바르기'],F02:['파스텔 캐주얼','스트라이프 원피스','카페 카운터 · 딸기 라떼'],F03:['네이비 수트','코트 포멀','회의실 · 발표'],M02:['차콜 수트','스웨이드 캐주얼','바 라운지 · 위스키'],F04:['린넨 내추럴','니트 스커트','바닷가 산책로 · 탄산수'],M03:['스트리트','세미 포멀','음악 작업실 · 믹싱 데스크']};

test('every model shows exactly its four casting-book photos as zoomable buttons with labels, sizes and a casting book link, in editable and saved views',async()=>{
  const seen=new Set();
  for(const model of CASTING_MODELS){
    const file=model.id.toLowerCase(),[look1,look2,scene]=LOOKS[model.id];
    assert.deepEqual(model.photos.map(({kind,label,src})=>({kind,label,src})),[
      {kind:'fullbody',label:'전신',src:`./assets/casting/photos/${file}-fullbody.webp`},
      {kind:'look',label:look1,src:`./assets/casting/photos/${file}-look-1.webp`},
      {kind:'look',label:look2,src:`./assets/casting/photos/${file}-look-2.webp`},
      {kind:'scene',label:scene,src:`./assets/casting/photos/${file}-context.webp`},
    ],model.id);
    const selection=normalizeDemoCasting({modelId:model.id,voice:'A',notes:'선택 유지'}),before=structuredClone(selection);
    for(const editable of [true,false]){
      const html=castingView(selection,{editable}),photos=castingPhotos(selection);
      assert.ok(html.includes(photos),model.id+' photos are part of the casting view');
      assert.match(photos,new RegExp(`<h4>${model.name}의 사진</h4>`));
      const buttons=Array.from(photos.matchAll(/<button type="button" class="casting-photo" data-action="image" data-src="([^"]+)" data-label="([^"]+)" aria-label="([^"]+)"><img src="([^"]+)" alt="([^"]+)" width="540" height="720" loading="lazy" decoding="async"><\/button><span>([^<]+)<\/span>/g));
      assert.equal(buttons.length,4,model.id);
      for(const [index,[,src,label,aria,img,alt,caption]]of buttons.entries()){
        const photo=model.photos[index];
        assert.equal(src,photo.src);assert.equal(img,photo.src);assert.equal(label,`${model.name} · ${photo.label}`);
        assert.equal(aria,`${model.name} · ${photo.label} 크게 보기`);assert.equal(alt,label);assert.equal(caption,photo.label);
        seen.add(photo.src);
      }
      assert.ok(photos.includes(`<a class="casting-photos-more" href="${CASTING_BOOK_URL}#m-${model.id}" target="_blank" rel="noopener noreferrer">캐스팅북에서 ${model.name} 사진 더 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`),model.id+' casting book link');
      assert.doesNotMatch(html,/<video\b|<audio[^>]+autoplay|뮤직비디오|표정 참고용|움직임 샘플|제작 예시|광고 기획|production-library|casting-production|casting-work/,model.id);
      assert.equal((html.match(/<audio preload="none" src="[^"]+" hidden><\/audio>/g)||[]).length,3);
    }
    assert.deepEqual(selection,before);
  }
  assert.equal(seen.size,28);
  assert.equal(CASTING_BOOK_URL,'https://synk.im/pulse/casting/');
  for(const [name,digest]of Object.entries(PHOTO_SHA256)){
    const bytes=await readFile(new URL('./public/pulse-app/assets/casting/photos/'+name,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'RIFF',name);assert.equal(bytes.subarray(8,12).toString(),'WEBP',name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,name);
    assert.ok(seen.has('./assets/casting/photos/'+name),name+' is shown');
  }
});

test('no model selected shows one quiet line, and unknown or tampered photo paths are never rendered',()=>{
  for(const modelId of ['',undefined,'M99','<script>']){
    const html=castingPhotos({modelId});
    assert.equal(html,'<p class="small casting-photos-empty">모델을 고르면 그 모델의 사진을 볼 수 있어요.</p>');
  }
  const model=CASTING_MODELS.find(item=>item.id==='F02'),original=model.photos;
  try{
    // 카탈로그가 잘못 고쳐져도 정해진 사진 폴더 밖 주소·다른 형식은 그리지 않는다.
    const unsafe=['javascript:alert(1)','https://example.test/x.webp','./assets/casting/photos/../private.webp','./assets/casting/photos/f02-look-1.webp" onerror="alert(1)','./assets/casting/f02.webp','./assets/casting/photos/F02-look-1.webp','./assets/casting/photos/f02-look-1.png'];
    Object.defineProperty(model,'photos',{value:unsafe.map(src=>({kind:'look',label:'<b>이름</b>',src})),configurable:true,writable:true});
    const html=castingPhotos({modelId:'F02'});
    assert.doesNotMatch(html,/<button|<img|javascript:|example\.test|onerror|<b>/);
  }finally{Object.defineProperty(model,'photos',{value:original,configurable:true,writable:true});}
  assert.equal(castingPhotos({modelId:'F02'}).match(/class="casting-photo"/g).length,4);
});

test('the casting intro points once to the finished films space instead of putting films on model cards',()=>{
  for(const modelId of ['',...CASTING_MODELS.map(model=>model.id)]){
    const html=castingView(normalizeDemoCasting({modelId}));
    assert.equal((html.match(/data-action="tab" data-tab="films"/g)||[]).length,1,modelId||'none');
    assert.match(html,/<p class="small casting-films-link">SYNK가 처음부터 끝까지 만든 광고는 「완성 광고」에서 볼 수 있어요\. <button type="button" class="casting-films-button" data-action="tab" data-tab="films">완성 광고 보기 <span aria-hidden="true">→<\/span><\/button><\/p>/);
  }
});

test('browser casting modules name no generation tools, even in comments',async()=>{
  // The browser downloads these modules as-is, so even comments must not name the generation tools.
  for(const file of ['casting-catalog.mjs','casting-view.mjs','casting.css','films-view.mjs']){
    const source=await readFile(new URL('./public/pulse-app/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\b(?:Kling|Wan ?\d|Seedance|Higgsfield|Nano ?Banana|Veo)\b/i,file);
  }
});
