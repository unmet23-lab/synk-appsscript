import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {CASTING_OPTIONS,CASTING_BOOK_URL,CASTING_VOICE_NOTE,castingFromForm,takeCastingValues,castingSummary,castingView,castingPhotos,normalizeDemoCasting} from './public/pulse-app/casting-view.mjs';
import {normalizeCastingSelection} from './pulse-strategy.mjs';
import {strategyView,strategyHistory} from './public/pulse-app/strategy-view.mjs';
import {createDemoSession} from './public/pulse-app/demo.mjs';


// 11-03 목소리는 뺐다(유호님 「둘 다 전부 빼기」): 옛 화면·저장본이 보내는 목소리 A·B·C는 서버와 체험판 모두 받되 빈 값으로 둔다.
test('demo casting and server use matching options, drop a legacy voice the same way and reject invalid combinations',()=>{
  for(const model of CASTING_MODELS)for(const voice of ['','A','B','C']){
    const selection={modelId:model.id,voice};assert.deepEqual(normalizeDemoCasting(selection),normalizeCastingSelection(selection));assert.equal(normalizeDemoCasting(selection).voice,'');
  }
  assert.deepEqual(normalizeDemoCasting({voice:'A'}),normalizeCastingSelection({voice:'A'}),'a legacy voice without a model is dropped, not refused');assert.equal(normalizeCastingSelection({voice:'A'}).voice,'');
  for(const [key,{values}]of Object.entries(CASTING_OPTIONS))for(const value of Object.keys(values))assert.deepEqual(normalizeDemoCasting({[key]:value}),normalizeCastingSelection({[key]:value}));
  for(const invalid of [{voice:'D'},{voice:7},{modelId:'unlisted'},{hair:'unknown'},{notes:'bad\u0000'},{notes:'x'.repeat(1001)},{unexpected:'secret'}]){assert.throws(()=>normalizeDemoCasting(invalid));assert.throws(()=>normalizeCastingSelection(invalid));}
});
test('read-only fields still produce an accurate selection and submission strips only casting UI keys',()=>{
  const form={elements:[{name:'cast_modelId',type:'radio',value:'F01',checked:true,disabled:true},{name:'cast_modelId',type:'radio',value:'M01',checked:false,disabled:true},{name:'cast_voice',type:'radio',value:'B',checked:true,disabled:true},{name:'cast_notes',type:'textarea',value:'메모',disabled:true}]};
  assert.equal(castingFromForm(form).modelId,'F01');assert.equal(castingFromForm(form).voice,'B');
  const values={product:'기존 제품',cast_modelId:'F01',cast_voice:'B',cast_notes:'메모'},selection=takeCastingValues(values);
  assert.deepEqual(values,{product:'기존 제품'});assert.equal(selection.modelId,'F01');assert.equal(selection.voice,'B');
});
test('every casting-book model portrait (twenty-one), four photos of the chosen model, no voices, no film slots and escaped notes appear in summaries',()=>{
  const selection=normalizeDemoCasting({modelId:'F01',voice:'B',jacket:'blazer',notes:'<img src=x onerror=alert(1)>'});
  const html=castingView(selection);assert.equal((html.match(/class="casting-model-card"/g)||[]).length,21);assert.equal(CASTING_MODELS.length,21);assert.equal((html.match(/alt="[^"]+ 대표 사진" loading="lazy"/g)||[]).length,21);assert.match(html,/모델 선택 <small>21명<\/small>/);assert.doesNotMatch(html,/대표 사진 준비 중|음성 샘플 준비 중/);assert.doesNotMatch(html,/영상 준비 중|casting-media-pending|영상은 만들고 있어요/);assert.equal((html.match(/class="casting-photo" data-action="image"/g)||[]).length,4);assert.doesNotMatch(html,/<audio|voice-play|cast_voice|인터뷰 원음/);assert.doesNotMatch(html,/<video|src=""/);assert.doesNotMatch(castingSummary(selection),/<img/);
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

// 11-03 목소리 단계(04 목소리 · A/B/C · 듣기)를 거두고 그 자리에 한 줄만 둔다. 단계 번호는 01~04로 이어지고, 옛 저장본에 목소리 값이 있어도
// 요약 · 저장한 선택 · 고객 확인 화면 · 이전 판 어디에도 목소리 줄이 나오지 않는다.
test('the voice step is replaced by one line, the steps run 01 to 04, and no summary or review screen shows a voice row',()=>{
  assert.equal(CASTING_VOICE_NOTE,'목소리는 광고 장면에 맞춰 연기로 만들고, 시안 단계에서 들려 드려요.');
  for(const modelId of ['',...CASTING_MODELS.map(model=>model.id)])for(const editable of [true,false]){
    const html=castingView(normalizeDemoCasting({modelId,voice:modelId?'C':''}),{editable}),label=(modelId||'none')+(editable?'':' saved');
    assert.deepEqual(Array.from(html.matchAll(/<span>(0\d)<\/span>/g),match=>match[1]),['01','02','03','04'],label);
    assert.equal(html.split(CASTING_VOICE_NOTE).length-1,1,label);
    assert.match(html,/<p class="small casting-voice-note">목소리는 광고 장면에 맞춰 연기로 만들고, 시안 단계에서 들려 드려요\.<\/p>\s*<section class="casting-step"><h4><span>04<\/span> 액세서리<\/h4>/,label);
    assert.doesNotMatch(html,/목소리 A · B · C|목소리는 나중에|data-casting-voices|casting-voice-options|cast_voice|<audio|voice-play|<dt>목소리<\/dt>|undefined/,label);
  }
  // 옛 저장본: 목소리 B가 남은 선택도 요약에는 목소리 줄 없이 나온다.
  const legacy={modelId:'F02',hair:'look-2',makeup:'natural',jacket:'none',top:'tshirt',bottom:'denim',voice:'B',earrings:'none',ring:'none',notes:''};
  const summary=castingSummary(legacy);assert.match(summary,/<dt>헤어<\/dt><dd>하이 포니테일<\/dd>/);assert.doesNotMatch(summary,/목소리|undefined/);
  assert.deepEqual(Array.from(summary.matchAll(/<dt>([^<]+)<\/dt>/g),match=>match[1]),['모델','헤어','메이크업','자켓','상의','하의','귀걸이','반지']);
  const project={studio:{strategy:{revision:2,data:{castingSelection:legacy},request:{strategyRevision:2},confirmation:null,history:[{revision:1,data:{castingSelection:legacy}}]}}};
  for(const view of [strategyView({project,mode:'customer'}),strategyView({project,mode:'staff',canEdit:false}),strategyView({project,mode:'staff',canEdit:true}),strategyHistory(project)]){
    assert.doesNotMatch(view,/<dt>목소리<\/dt>|목소리 A · B · C|cast_voice|<audio|voice-play|의상 · 목소리|undefined/);
  }
});

// Portraits: f04 is the approved restored portrait; the later six (F05 · M04 · F06 · F07 · M05 · M06, 11-02) are the casting
// book's site/img/<code>/hero-s.webp, and so are the two idol teams (F08~F11 · M07~M10, 11-03). No cross-model substitutions or transcoding.
const PORTRAIT_SHA256={
  "assets/casting/f04.webp": "2e58b62ce8039865bc4ed2a6165300c7a1147d5aabd745079c134bbe1d75cdfb",
  "assets/casting/f05.webp": "a9684afff3c8809e87d08aee4ff2e07317981eef6c3c3499cd6095761c59c510",
  "assets/casting/m04.webp": "5358bc8215ff9c7498f363dfaa3f8f833d7861a2d732c2eb27a8c627936fda2b",
  "assets/casting/f06.webp": "4bd53a238cf35bb0085e9a965137368086257a4607ef504a8a923dbaeff63a70",
  "assets/casting/f07.webp": "86aa5743d6b69c3bc1617b72487b1ccdad4c9edf291910f627f953cc5127dc94",
  "assets/casting/m05.webp": "494d073a8dfb8244ef0d491604737f09ff5fdf039d9984332bfcf1ebaaf37309",
  "assets/casting/m06.webp": "c54d656635aced652fb80f714330ba0f8645604f3eee05a1b7d9de3347b7f15c",
  "assets/casting/f08.webp": "6683edca4def7433dfb282f9b4224ffa9d2cfec398d14245ed1de17121919050",
  "assets/casting/f09.webp": "21ea31b184dcba783d08f0e107ecd4651aa11282a8b0b5785a295658bffbda32",
  "assets/casting/f10.webp": "3c4f4ab199ca8b1ff7dd339438b492e86031b1bfb7453e0c554b9d8651b1f7ba",
  "assets/casting/f11.webp": "b6eb83a6824e4fb13971e691434031356734c5ad144243f1ac4169d2022fb04b",
  "assets/casting/m07.webp": "6da3ad5bc01209ddf655b6a39242d5b9e5a88dcabffbc271e28117cb0488ff69",
  "assets/casting/m08.webp": "ab23ecc4f1a6367de758212a37262c06fb918f0be4a471453eb0e41f3fcb1ec5",
  "assets/casting/m09.webp": "b3236cb582b8b98f295b6e1cd8d25fe92a5b027917273055a4b1fe7c9514e243",
  "assets/casting/m10.webp": "e97dff1deb2313f919b255a737284c691a445d1bdeda8d40049a025dca72d990"
};
// 11-03 목소리는 뺐다(유호님 「둘 다 전부 빼기」): 고객 앱의 목소리 A·B·C 샘플(13명 × 3, M03은 유호님 인터뷰 원음)은 지우지 않고
// 공개 폴더 밖 archive/casting-voice-20261103/로 옮겼다. 옮기기 전과 같은 바이트인지, 공개 폴더에는 남지 않았는지 본다.
const ARCHIVED_VOICE_SHA256={
  "F01-1.mp3": "0e1c1628659661857aaedcd29cae64e4dafdba61496ceb1270c467282ad18f7f",
  "F01-2.mp3": "c42813e425ac708b90fcacdfce37f886bee88e94dbae888faa9b8bf6c96bdd26",
  "F01-3.mp3": "4af0e37fc7e129e6c8e41c2b61850392b5f0e08087b1e8cf5de40bae7a052fd3",
  "F02-1.mp3": "dfade28a7094250e592f218395ea792b883c9273bbc0e71d9c946456d4ff0356",
  "F02-2.mp3": "16d041c0bfffdcd86c33205686fc5beaf1d3ab9454ad5219083742b249616a2a",
  "F02-3.mp3": "8c846a468d582e4b69de6df2ced56a9ac8633bab14cfea1db5497f688449f6ba",
  "F03-1.mp3": "51a6c9bf35e210cf3912bdd13b36dcd11f6be0de14dde2173996b0507357aaaa",
  "F03-2.mp3": "05635d102dbafb1ea4ef48a146fdaa47c0dfc4c2b2e6d085298d98ff4fd5dff2",
  "F03-3.mp3": "38ccb8c5787f7d0d42bc774a5ec4be8130f6e9b6aa66694b4525b0aedca64fda",
  "F04-1.mp3": "6442cf3c05bee8f21d02ba2a9062cdc8e62730c2b2b190d496224492daaf2013",
  "F04-2.mp3": "70d270adb302e52ac98c30648d6df6c58c76f80b518ad3024a16f9373bdf8bf0",
  "F04-3.mp3": "967cb24f9cffc72ec923d1b64e1b175b3632c11f1ea91c7d5e82da27e64e89af",
  "M01-1.mp3": "a24faa5f009d8c3aa7ecc447a22b23d0c47e57c036622f8bdba8c37b8b1d58cb",
  "M01-2.mp3": "f65e20d4b56558875ed61137f526d020513d151b62276ab36d027bd647129368",
  "M01-3.mp3": "717579033fcf4a001dbfe7391e46a405779c51b150305f5fe669e8bf9cf5d865",
  "M02-1.mp3": "282fd2df19e52a275607c84db4df9b1234a086a4480805f188dcde18c2fba912",
  "M02-2.mp3": "7f9a8b160b137c744f74867d778f21a5ecc55ca7e25a6bf5f55ca44db45f568d",
  "M02-3.mp3": "18b1bf45fad1d73b166c9cde5ed0ed6fe166907f3c68d40a91916d84fb1ed835",
  "M03-1.mp3": "417c1e652e70478c373a2c357ce1a7db1539b56e004ea5f582ddd558f40e24c8",
  "M03-2.mp3": "44de06897bc9b3225c7c1907631f32c8f074b620934a4e040751fb82c4cdaaec",
  "M03-3.mp3": "e2f3af34009c810bfaf9022ae002d8db3ab5cfa1e7c38cf9c0de2b8b5a3c1e94",
  "F05-1.mp3": "d1cafcd70deea0d6962687005794869df9819051257d105aacb7f207596f285a",
  "F05-2.mp3": "3ef39d7dfda8c0e5661029bed5f63287a5ed7ac6b57046b7a78fcb6e9b7579ac",
  "F05-3.mp3": "f28e00a028ce9def2b9f204f9f2e6a22bbca83b6a72fdae9bbabedb9ce80f598",
  "M04-1.mp3": "08551d6a4a1f729b218e833ac91a5652137c4d0e18b39b46e5286d59c13364c2",
  "M04-2.mp3": "d4813633dbd40c3000b72e5871b61985c7850e0faa47d5fcad9f4d34ba985c5f",
  "M04-3.mp3": "8f39e619c8ded952bf8c055b039eb3e02344abfd8ced53f610355fe37c31cb3c",
  "F06-1.mp3": "1d7203780107881b8f226761dc9dc23da52bc87fab4004ae869ba18eda4cc4f8",
  "F06-2.mp3": "9f13c79673b3de0176743b7e34ca3ad193dd614c6b78ca0c7069e327425c971c",
  "F06-3.mp3": "ed0d1b91843789b88a465e350d2110ec04fb8d91bf6ae6e75ca0e56ae02097a6",
  "F07-1.mp3": "e9d1a4c114f6f82af9eaa7e1697d47f1403c62235c18e757048ac224f3e9911d",
  "F07-2.mp3": "450d95706dc8ffcd412ecb7d372a4107d772d095728fc1e76f54c690000cbdb6",
  "F07-3.mp3": "81a7d29be539aacfd07d6607bf9df3fa5cfd4eeedfacb3fe81458db9ab361534",
  "M05-1.mp3": "49474dd0fc9bb033688391976aa443ab9cbc398dcfe76bbb04cc66a7b9a9a6f0",
  "M05-2.mp3": "4c7fc3d145f7af70ed7858ad16f09f4ac7f849dc059647afa3bc8406e9a46621",
  "M05-3.mp3": "4bc832b1c86dcd542091b78fa5031770f58081e6a37b44e382976a07789e8c14",
  "M06-1.mp3": "9799ef9012afb040cdcc0a109598c64372fa4795ac47638adde4eea08832bb38",
  "M06-2.mp3": "105ab3512f0f6e4bf5424c6e463fbef443116748739c78e617a9d010dba85baf",
  "M06-3.mp3": "14e3d9cf13f59d75ad77f6efc0f893dd07c87a514e5bc8a12764ade031038155"
};
const VOICE_ARCHIVE=new URL('./archive/casting-voice-20261103/',import.meta.url);

test('portraits keep their approved bytes, no model carries voices, and the old voice samples are kept byte-for-byte outside the public folder',async()=>{
  for(const model of CASTING_MODELS){
    assert.ok(model.image,model.id+' portrait');
    // 10-22 모델은 사진만: 광고·런웨이 영상 칸과 작품 칸이 없다(완성 광고는 films-view.mjs). 11-03부터 목소리 칸도 없다.
    assert.equal('videos' in model||'works' in model,false,model.id+' has no film slots');assert.equal(model.photos.length,4,model.id+' photos');
    assert.equal('voices' in model||'voiceNote' in model,false,model.id+' has no voices');
    const html=castingView(normalizeDemoCasting({modelId:model.id}));
    assert.doesNotMatch(html,/<audio|voice-play|cast_voice|casting\/voice\/|autoplay/,model.id);
  }
  assert.equal(CASTING_MODELS.find(m=>m.id==='F04').image,'./assets/casting/f04.webp');
  for(const [relative,expected]of Object.entries(PORTRAIT_SHA256)){
    const bytes=await readFile(new URL('./public/pulse-app/'+relative,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,relative);
  }
  assert.equal(Object.keys(ARCHIVED_VOICE_SHA256).length,39);
  assert.deepEqual((await readdir(VOICE_ARCHIVE)).sort(),[...Object.keys(ARCHIVED_VOICE_SHA256),'README.md'].sort(),'the archive holds every old sample and its note');
  for(const [name,expected]of Object.entries(ARCHIVED_VOICE_SHA256)){
    const bytes=await readFile(new URL(name,VOICE_ARCHIVE));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,name);
    assert.equal(existsSync(new URL('./public/pulse-app/assets/casting/voice/'+name,import.meta.url)),false,name+' is not in the public folder');
  }
  assert.equal(existsSync(new URL('./public/pulse-app/assets/casting/voice/',import.meta.url)),false,'no public voice folder');
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
  "m03-look-2.webp": "2a9a136c96c719f1a1e2a6567ede5bbc70f87e44b5b1a375c584fa38b711da89",
  "f05-context.webp": "74cf4ee9a1421bbfb69f939db1ca2f44992950385420cd121dabf7cd0c0f30d2",
  "f05-fullbody.webp": "c6776a0fe37a88ed0e3cf298c6b4063c5ba2a3c4ac58663351c33236db2e961e",
  "f05-look-1.webp": "aeb43ee560662f4b21bd509ae8cca680d002cd6626d01a0a00f607c974880642",
  "f05-look-2.webp": "443187371697d48da3b07f16cda0e7100b59aa6f22c0b66ae2f04fa56c6ea781",
  "m04-context.webp": "fef781c7c71bd47ef033376ea523dd0e262f761c6bf9a6ee5ca3a984ffac8cf2",
  "m04-fullbody.webp": "7717ab1a2ffa564f9b9d4a0c1f09f852bf317ae3b1f1cc936c970ec0025d3110",
  "m04-look-1.webp": "d14cbb08f0c288f468b154c27840c7019baa1b210cb6f8f36a2a3a51ce57ffb2",
  "m04-look-2.webp": "a4f9d85c353c56aaaf6989d2c1391eed690f5ee272a529c02b9eaa4becf81ad5",
  "f06-context.webp": "57b39619dd8301b70207b5e5b630aabb3b68f0c64ca00f4a834d601978597bf8",
  "f06-fullbody.webp": "565494f1d180a0da9e85a46febbdadc2a1bb2f85e584d7e76fbcfc7fd6a38005",
  "f06-look-1.webp": "0991b5b722d03b73abe5c0e5f455bf45c4c3b42772a61e5532a249f74e8089d1",
  "f06-look-2.webp": "5c506306b24314b5be3a5477aeba21daa97bc99fa5ed9befff726c7bd736e16c",
  "f07-context.webp": "72c089af32c029f4b1422f1bf50361800b6fd3f18010359d130c895ae3fb7601",
  "f07-fullbody.webp": "be058fbccc32a278c8202432cc7634f606e39f645c5c2055700380a1269e6792",
  "f07-look-1.webp": "89027c57676f47ad0abc698b957900db904fd96057394f23c261ca57cc8eea58",
  "f07-look-2.webp": "334ea63eb83154247c06b4e316c8828450e91a6d1d97a909007e84712e40795e",
  "m05-context.webp": "50a68a58633b424c58a47eebdaf53b15a954dd106def49b431fcf98bfb52cf72",
  "m05-fullbody.webp": "b01b463c5eb9b5aaea5d9ba19667fe9b7ab7fb533209e4f6394fdd2ebb3b3639",
  "m05-look-1.webp": "ad59e3cdb9e4f594b4d1b4346aa18afa147e30097c7e1b6d2578e679afd33f94",
  "m05-look-2.webp": "410d2faa524f828e31c79260be0be8e88a650f7f4f2ec241e21d12c3369ec82a",
  "m06-context.webp": "bb23adefacc6720560692cd7cfdebf7fcbdc5ca277a431e9bb153ce3ab0b5b0d",
  "m06-fullbody.webp": "8a40706e05589a9b615f0980a32a90d60557154b138e06aba34d4bbf8239bd6c",
  "m06-look-1.webp": "5be6c78f06df17fb6c48a6cdcf8110fa403c60ca824c387c56e739b75b6e5546",
  "m06-look-2.webp": "297f8166a949b64bbc9e11f3d19bb07844130936c91a71f316f5f17970c1c04d",
  "f08-context.webp": "ba6afde313d45a0150d1b9d40abdb3b5509b7cd9232a09be0df865c49b8ccf48",
  "f08-fullbody.webp": "a4a19e1c7d3f6a3e19072d8d67bf7c78ee8fcd32554c574f28765cc2492842f0",
  "f08-look-1.webp": "33ea144cf928c4b4e4b9302008179c901e5cdcb858ac2838d5453397eb9596a7",
  "f08-look-2.webp": "cf79dfe613665c766f148ff791493f28de30db645b75dd48b4cea842d7008337",
  "f09-context.webp": "e26b4c128bef9fc8e5daa439bb22385c71cce325694f684e60e331612f6fc5c4",
  "f09-fullbody.webp": "d9139cb79facaa7487ca8732ec539205ba8ddc583d58c3780107fd12fc22959e",
  "f09-look-1.webp": "710b788601b76ec7ccc1cd43349c89ac5eded87c71cbe53e612c348750bab5c2",
  "f09-look-2.webp": "8b5248c8672a0ef9567f16ffaa70d2f3873dea59a7a175149970c12fe690ed0f",
  "f10-context.webp": "b34731c3f169d38a738b987c719f5e5a192a5bda30347a1c2281d8277440de3f",
  "f10-fullbody.webp": "f4b0879fa0abd0eb5f8b741aae8412d2a32eb747d72f465bf4d8a264004ab3ab",
  "f10-look-1.webp": "8bd9a113c285cf368ae9a367941c54f8338aceeaffd0eb550a593fbdb9a75f07",
  "f10-look-2.webp": "f3ac525f0170885b976750f838bb0e14f90f69c6213bc07504ba5b0572e853fc",
  "f11-context.webp": "e1b466c96b19c18752c4c8fa61466548631883ddee3da0c1584ae0b61de31d8c",
  "f11-fullbody.webp": "6e2dc021936cdbfd6ec688d4028192d3565272c1bbd40610c8a07e3b4c0291d0",
  "f11-look-1.webp": "a133593389bd26d442ec8bd7049e1603dbd393f26b2aea4fc1d213be9f4cc920",
  "f11-look-2.webp": "4d3c9545e66d1bcc4ff6df206412f8d737d8a61da058ac8ee74ec5db11feca5d",
  "m07-context.webp": "d4fa2c4eb80da49fe9b28b2bc85592fb6f527d27f584572b71236cc0613b2402",
  "m07-fullbody.webp": "72086f178fceb818c3b37594733f07052f98fafc8ffa3870f9139a65ee5514bb",
  "m07-look-1.webp": "0b5379cd0501c5927b6ebde85f8b486650bb6bc72684a524fd12f1c5bae87031",
  "m07-look-2.webp": "6ee51e11e298f841a7bdfcc2cd9a3b0a706755327361f471e07a660beee92ebf",
  "m08-context.webp": "16e900cf63977207d114f88a675a9ebdb66579109564d34f713ac7ba3704eeb5",
  "m08-fullbody.webp": "9b299d7269e00f221ad9fab9c710e0bd2701c430a9551f7745f93725abdd9bca",
  "m08-look-1.webp": "9803dc903af028404ef4b6a8c8f33da88de0de32ee890c4d8acfc41b3e11ff52",
  "m08-look-2.webp": "6c36d9a922ec7f0cdaaf4accfb00d758e9764d16b56ab9ffd88326bc3e8ff772",
  "m09-context.webp": "82fa9340ee6d89094f303a2ccbb25ab9b08ff28bff788ec8431c1d5b59630cdf",
  "m09-fullbody.webp": "a226a2b47e80d175cd67d220780e13412b30273a4662bdf87820753145f2f018",
  "m09-look-1.webp": "ea605262739a6fb630549550ef4e68c725588941ef4d98098c3277300a5c9c83",
  "m09-look-2.webp": "589f886adc43f15104612a253c9e7947d26836d0d4e30661d1cea0ce596d1d09",
  "m10-context.webp": "10bf34d803fd08f528705ad8333374df518c6c95a956c4a5672b5702b9fbfa88",
  "m10-fullbody.webp": "8e52f36d20bcade01a4a14385d52de75c26a5fc20396d9571b1f9b583100b3a1",
  "m10-look-1.webp": "82ccd96198c580bfbf4983b71e24d52a2e4cfaae284aeb414161b9f52548e25b",
  "m10-look-2.webp": "3861ac1e42b0e7c25efbc6c329ae175cce24f3430fa2dfa157e243cfee23596b"
};
const LOOKS={M01:['셔츠 오피스','레더 스트리트','창가 카페 · 커피잔'],F01:['슬립 드레스','트렌치 캐주얼','화장대 · 립스틱 바르기'],F02:['파스텔 캐주얼','스트라이프 원피스','카페 카운터 · 딸기 라떼'],F03:['네이비 수트','코트 포멀','회의실 · 발표'],M02:['차콜 수트','스웨이드 캐주얼','바 라운지 · 위스키'],F04:['린넨 내추럴','니트 스커트','바닷가 산책로 · 탄산수'],M03:['스트리트','세미 포멀','음악 작업실 · 믹싱 데스크'],F05:['카디건 · 줄무늬 티','샴브레이 셔츠 · 앞치마','아침 주방 · 요리'],M04:['후드 집업 · 조거 팬츠','옥스퍼드 셔츠 · 치노(첫 출근)','원룸 · 택배 상자 열기'],F06:['캐멀 코트 · 터틀넥','실크 블라우스 · 진주 목걸이','창가 카페 · 책과 차'],F07:['크롭 스웻셔츠 · 레깅스','윈드브레이커 · 러닝 쇼츠','강변 러닝 뒤 · 스트레칭'],M05:['옥스퍼드 셔츠 · 치노(평일)','퀼팅 조끼 · 헨리넥(캠핑)','캠핑장 아침 · 커피 물 붓기'],M06:['러닝 윈드브레이커 · 쇼츠(운동)','오버핏 후드 · 카고 팬츠(캠퍼스)','농구장 벤치 · 경기 뒤 물 한 병'],F08:['검정 라이더 · 새틴 스커트(시티)','포플린 셔츠 · 체리 카디건 · 생지 데님(일상)','카페 창가 · 커피 한 잔'],F09:['프릴 블라우스 · 쉬폰 스커트 · 슬라우치 부츠(로맨틱)','자수 바시티 · 크림 쉬폰 원피스(스트리트)','꽃집 · 작은 꽃다발'],F10:['남색 니트 · 크림 셔츠 · 베이지 와이드(프레피)','애플 그린 바람막이 · 연청 와이드(스트리트)','연습실 · 쉬는 시간 물 한 병'],F11:['카키 필드 재킷 · 레이스 미디 · 레이스업 부츠','오간자 트렌치 · 포플린 셔츠 · 크링클 와이드','공원 피크닉 · 레모네이드'],M07:['스웨이드 초어 재킷 · 스트라이프 셔츠 · 에크루 치노','스웨이드 모토 재킷 · 빈티지 티 · 생지 데님','강변 벤치 · 아이스커피'],M08:['보틀 그린 항공 재킷 · 블루 니트 · 빈티지 데님','시어링 코트 · 하이넥 · 벨트 두 줄 데님','스튜디오 앞 계단 · 물 한 병'],M09:['멀티 스트라이프 니트 · 버건디 글로시 팬츠','케이프 차콜 블레이저 · 스카프 · 크림 팬츠','책방 창가 · 책 읽기'],M10:['코듀로이 블루종 · 레트로 저지 · 배기 데님 · 캡','크링클 수트 재킷 · 딥 틸 후드 · 골반에 걸친 팬츠','농구장 벤치 · 농구공']};

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
      assert.doesNotMatch(html,/<audio|voice-play|cast_voice/,model.id+' has no voice controls');
    }
    assert.deepEqual(selection,before);
  }
  assert.equal(seen.size,84);
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
    assert.doesNotMatch(source,/\b(?:Kling|Wan ?\d|Seedance|Higgsfield|Nano ?Banana|Veo|Suno|Typecast|Omni)\b|타입캐스트/i,file);
  }
});
