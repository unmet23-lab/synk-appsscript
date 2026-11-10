import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CASTING_MODELS,modelLooks} from './public/pulse-app/casting-catalog.mjs';
import {PRODUCTION_PLANS} from './public/pulse-app/production-catalog.mjs';
import {CASTING_BOOK_URL,castingPhotos,castingView,castingFromForm,refreshCasting} from './public/pulse-app/casting-view.mjs';
import {esc} from './public/pulse-app/api.mjs';

// 10-22 모델은 사진만(유호님): 모델 칸에서 광고 기획안(10-12 「7개 광고 기획」)·영상을 거두고 사진 넉 장만 둔다.
test('withdrawn production plans and the library page never reach a model card',async()=>{
  for(const model of CASTING_MODELS){
    // 10-12 기획안은 처음 일곱 명에게만 있었다 — 11-02에 더한 여섯 명은 처음부터 사진만이다.
    const plan=PRODUCTION_PLANS.find(item=>item.modelId===model.id),html=castingView({modelId:model.id});
    if(plan){
      assert.equal(html.includes(esc(plan.title)),false,model.id+' plan title');
      assert.equal(html.includes(esc(plan.memory)),false,model.id+' memory hook');
    }
    assert.doesNotMatch(html,/production-library|assets\/production\/|제작 예시 · 기획안|광고 기획·콘티 보기|7개 광고 기획|<video\b/,model.id);
  }
  assert.deepEqual(PRODUCTION_PLANS.map(item=>item.modelId).sort(),['F01','F02','F03','F04','M01','M02','M03'],'the withdrawn plans still exist in their own module');
  const view=await readFile(new URL('./public/pulse-app/casting-view.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(view,/production-catalog|PRODUCTION_|castingProductionPlan|castingPortfolio|mediaCard|workCard/);
});

// 11-03 목소리는 뺐다(유호님 「둘 다 전부 빼기」): 옛 초안에 목소리 값이 남아 있어도 목소리 칸·소리는 그리지 않는다.
test('the photo link opens the public casting book in an isolated new tab and rendering leaves the customer draft intact without any voice controls',()=>{
  const selection={modelId:'F02',voice:'B',hair:'wave',makeup:'natural',jacket:'blazer',top:'shirt',bottom:'denim',earrings:'stud',ring:'simple',notes:'저장 전 고객 메모 <유지>'};
  const before=structuredClone(selection),photos=castingPhotos(selection),html=castingView(selection);
  const anchors=Array.from(photos.matchAll(/<a\b[^>]*>/g),match=>match[0]);
  assert.equal(anchors.length,1);
  assert.equal(anchors[0],`<a class="casting-photos-more" href="${CASTING_BOOK_URL}#m-F02" target="_blank" rel="noopener noreferrer">`);
  assert.doesNotMatch(photos,/onclick|data-mutate|data-tab/);
  assert.deepEqual(selection,before);
  assert.ok(html.includes(esc(selection.notes)));
  assert.doesNotMatch(html,/cast_voice|<audio|voice-play|casting\/voice\/|data-casting-voices/);
});

function draftForm(initial){
  const controls=CASTING_MODELS.map(model=>({name:'cast_modelId',type:'radio',value:model.id,checked:model.id===initial.modelId}));
  for(const [key,value]of Object.entries(initial))if(key!=='modelId'&&key!=='voice')controls.push({name:'cast_'+key,type:'textarea',value});
  const makeNode=()=>({dataset:{},writes:0,_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.writes++;}});
  const photos=makeNode(),summary=makeNode();
  const elements={'[data-casting-photos]':photos,'[data-casting-summary]':summary};
  const root={querySelector(selector){return elements[selector]||null;},querySelectorAll(){return [];}};
  const form={get elements(){return controls;},querySelector(selector){return selector==='.casting-configurator'?root:null;}};
  return {form,photos,summary,selectModel(id){for(const field of controls)if(field.name==='cast_modelId')field.checked=field.value===id;},setNote(value){controls.find(field=>field.name==='cast_notes').value=value;}};
}

test('switching models refreshes the matching photos while keeping unsaved style and notes, with no voice part to touch',()=>{
  const draft=draftForm({modelId:'F02',voice:'B',hair:'wave',jacket:'blazer',top:'shirt',bottom:'denim',earrings:'stud',ring:'simple',notes:'아직 저장하지 않은 고객 메모'});
  refreshCasting(draft.form);
  assert.ok(draft.photos.innerHTML.includes('./assets/casting/photos/f02-look-1.webp'));
  assert.match(draft.photos.innerHTML,/<h4>하린의 사진<\/h4>/);
  const before=castingFromForm(draft.form);
  draft.selectModel('M01');
  refreshCasting(draft.form,{modelChanged:true});
  const after=castingFromForm(draft.form);
  assert.deepEqual(after,{...before,modelId:'M01'});assert.equal(after.voice,'');
  assert.ok(draft.photos.innerHTML.includes('./assets/casting/photos/m01-look-1.webp'));
  assert.doesNotMatch(draft.photos.innerHTML,/photos\/f02-/);
  assert.equal(draft.photos.dataset.model,'M01');
  assert.match(draft.summary.innerHTML,/이안 · M01/);assert.doesNotMatch(draft.summary.innerHTML,/목소리|undefined/);
  const writes=draft.photos.writes;
  draft.setNote('모델 변경 뒤에도 이어 쓰는 메모');
  refreshCasting(draft.form);
  assert.equal(draft.photos.writes,writes,'editing notes does not reload the photos');
  assert.equal(castingFromForm(draft.form).notes,'모델 변경 뒤에도 이어 쓰는 메모');
  assert.equal(castingFromForm(draft.form).jacket,'blazer');
});

// 11-10 옷 · 머리 고르기: 머리 2 · 3(스물한 명)과 F04 머리 1은 캐스팅북 빌드 site/img/<코드>/hair-2-s · hair-3-s · hero-s.webp의 바이트 복사다
// (그 빌드와의 대조는 저장소 시험 tests/pulse-casting-hair-photos.test.mjs — 빌드는 git 밖이라 회사 판에는 없다). 여기서는 회사 판이 가진 바이트를 고정한다.
const HAIR_SHA256={
  "f01-hair-2.webp": "c049cfdc3ef512195656e67867629380974204e4669ea2039f762b10454eafdb",
  "f01-hair-3.webp": "7ee244e7c53de6a76985bedc0ef3dff9c51f1d6f128463094d764e6b9ae68814",
  "f02-hair-2.webp": "1f36e058c05ef5ad933de7172b62f43efac10da7d72c3143f12223d88a001227",
  "f02-hair-3.webp": "3c35f14fed9c0cb68e24e88027e85719d54ad4f2d9208b3a3521685fb1f9698c",
  "f03-hair-2.webp": "563265d75708fc5313bf8e9ee6d56237c2373748b5ee31a24557a0cb6e2113f3",
  "f03-hair-3.webp": "55a5a6dc2dc18bc97ab7485731f864aa572fd26ef523d9fdabc1b323499ef3f3",
  "f04-hair-1.webp": "51ae31263c8b887a1461807cafe0fd7a46a905d2cc6d171f5985864261a7db04",
  "f04-hair-2.webp": "9dad7e25a0304da3a2d9300618d841a156464b6adb15e084cadbef7afc24f658",
  "f04-hair-3.webp": "9b54ec675b28a02ef2943a9b6f4b7e50e3307cf72ced25db15da6d8ed4388ca6",
  "f05-hair-2.webp": "051729ddcbd1454db43f281dc938978ef60ad2cf70087e618352d83f057c0dd5",
  "f05-hair-3.webp": "076b1042c5750f876a75a66dc00c453dddd12ef9c43d1010c90462402128d3aa",
  "f06-hair-2.webp": "c2a12c4c20243c84f728b55382154b58418f6ec6990eb09d80f7ee5f0f177ed2",
  "f06-hair-3.webp": "31db59a2623856a67b211648e5cd24801b0948e3544cfd429ff6ae410cdb8b92",
  "f07-hair-2.webp": "635d3ef560107813087aecf40c9d592fba5c165f17f2d84aa2e480d8a70fe551",
  "f07-hair-3.webp": "a66d3a919ba44e48955e42ec9a718a8ddfd676690168fb43cf2c0b4dde747347",
  "f08-hair-2.webp": "12231661d1cae5b8a1d2f057b3ab2dc55f64069adf94672b5c20e0855d6a02fe",
  "f08-hair-3.webp": "afabc432bb28cc86422861338366c1eb114a8175af44553f11d3e4df32df73d8",
  "f09-hair-2.webp": "b5f2276d5b9f024f442e1b2b143000d2323ce9d59db59d541008307ace9c13ab",
  "f09-hair-3.webp": "9cfb1ca75cb55b047c6dc8904c1e369d8de397051bcff24807b6501fef027c71",
  "f10-hair-2.webp": "a9a1f3a30e37d0fcb55ae7d79ab1b4784251d58d10f5b75589438803b0671a55",
  "f10-hair-3.webp": "5b540ef8910935d61a0351e6391a3c9859c20773b3e0bade0ea85284a6a2a57e",
  "f11-hair-2.webp": "6696ebda8cab2b8de25743fe4b2fba1ed98b9e7511850ade9ab491d88ec578ff",
  "f11-hair-3.webp": "f0c6e81a4933414d1ad513a615764361efc3471aafab741c948b25b81f88df57",
  "m01-hair-2.webp": "3914c3ccd7772d03d1a5e9c4c6a0b5cb8ff392d3a111b51d7365317e4ff29c1e",
  "m01-hair-3.webp": "137e506fccdbae7f56eefc21686cd921b911cbc4d0094f17ab3ae2f89ccb9f6e",
  "m02-hair-2.webp": "d7974d5b24a194256b8e5348ebfd588db936e64e0d4cd690653d2d6494f67e78",
  "m02-hair-3.webp": "f2a9d23e702c27608c3bb3f7154c0a968b8aa9e1e09d5d42105cb502283ced66",
  "m03-hair-2.webp": "c4634ea41e14443f659be2814dbee58f2e837da68fb68d104457472f7243a6ff",
  "m03-hair-3.webp": "5a74043c9d417bdd3a6c502d0e20dc9719d6036590d7080fa871b111f262d8c3",
  "m04-hair-2.webp": "1e64860c99aa7459e0a43d262bb93cfc2b36016141715ed1b58e74f5a2b0947e",
  "m04-hair-3.webp": "322259fe5de0f7e4f5c41dead4ec85b5acd9393bb0c9e962e0dc9c861f9dfe90",
  "m05-hair-2.webp": "79d0768c9458bdcf2c9e6211fc89eaefa696ed9e59b348c82fef490125fa91ea",
  "m05-hair-3.webp": "33902df44910fc66940908c8124d28b15fb16f3d6c5257259021ebc30b808f36",
  "m06-hair-2.webp": "fe7410f4a557821d612bff32149305ce57810075560bc581dfa7ece06eb7c628",
  "m06-hair-3.webp": "a3426c7f4940adc616655b887a98a981224dcd1720d86b32638d0fb9b36e6782",
  "m07-hair-2.webp": "a7fef081dc1018af3b5f0c9d91098264bbc47474ccf0bda971778d8d4d95fcb1",
  "m07-hair-3.webp": "15deaea5f7d2c4aeb670852140d2659401a6b7b7188716e87defe846c5d95814",
  "m08-hair-2.webp": "8f3d270cfed8c37b6e9c2bda50a95d0ee41fbb5b35ff3f1302a573816787f2c1",
  "m08-hair-3.webp": "47ca351a9a8e5dbdd5535bc3af304f652862570f555bad2538327a5764a06cdf",
  "m09-hair-2.webp": "d670923f66b27b32811d6e613b08dd1037da08ea893888d6142b6cd8c5b2b517",
  "m09-hair-3.webp": "c4270089478eb2a710c3fa5cea40ef4a47444a67d8b7181b38335c8c4f76b613",
  "m10-hair-2.webp": "608054cd8b1e3ed8ca2cedc913667ee23aa78cdd7b9ad68a868c8bc73fdd08b3",
  "m10-hair-3.webp": "8156a90e32bfd4759bfa68620924fdf38b0afcb6f05138c1dfa8470597dc5b9a"
};
test('every model shows three hair photos from this app, byte for byte the approved copies',async()=>{
  const seen=new Set();
  for(const model of CASTING_MODELS)for(const hair of modelLooks(model.id).hairs){
    assert.match(hair.src,/^\.\/assets\/casting\/(?:photos\/[a-z]\d\d-hair-[123]|[a-z]\d\d)\.webp$/,model.id+' '+hair.id);
    if(hair.src.includes('/photos/'))seen.add(hair.src.split('/').pop());
  }
  assert.deepEqual([...seen].sort(),Object.keys(HAIR_SHA256).sort(),'the catalog points at exactly the copied hair photos');
  for(const [name,digest]of Object.entries(HAIR_SHA256)){
    const bytes=await readFile(new URL('./public/pulse-app/assets/casting/photos/'+name,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'RIFF',name);assert.equal(bytes.subarray(8,12).toString(),'WEBP',name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,name);
  }
});
