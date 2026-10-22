import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {PRODUCTION_PLANS} from './public/pulse-app/production-catalog.mjs';
import {CASTING_BOOK_URL,castingPhotos,castingView,castingFromForm,castingVoices,refreshCasting} from './public/pulse-app/casting-view.mjs';
import {esc} from './public/pulse-app/api.mjs';

// 10-22 모델은 사진만(유호님): 모델 칸에서 광고 기획안(10-12 「7개 광고 기획」)·영상을 거두고 사진 넉 장만 둔다.
test('withdrawn production plans and the library page never reach a model card',async()=>{
  for(const model of CASTING_MODELS){
    const plan=PRODUCTION_PLANS.find(item=>item.modelId===model.id),html=castingView({modelId:model.id});
    assert.ok(plan,model.id+' plan still exists in its own module');
    assert.equal(html.includes(esc(plan.title)),false,model.id+' plan title');
    assert.equal(html.includes(esc(plan.memory)),false,model.id+' memory hook');
    assert.doesNotMatch(html,/production-library|assets\/production\/|제작 예시 · 기획안|광고 기획·콘티 보기|7개 광고 기획|<video\b/,model.id);
  }
  const view=await readFile(new URL('./public/pulse-app/casting-view.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(view,/production-catalog|PRODUCTION_|castingProductionPlan|castingPortfolio|mediaCard|workCard/);
});

test('the photo link opens the public casting book in an isolated new tab and rendering leaves the customer draft and restored audio intact',()=>{
  const selection={modelId:'F02',voice:'B',hair:'wave',makeup:'natural',jacket:'blazer',top:'shirt',bottom:'denim',earrings:'stud',ring:'simple',notes:'저장 전 고객 메모 <유지>'};
  const before=structuredClone(selection),photos=castingPhotos(selection),html=castingView(selection);
  const anchors=Array.from(photos.matchAll(/<a\b[^>]*>/g),match=>match[0]);
  assert.equal(anchors.length,1);
  assert.equal(anchors[0],`<a class="casting-photos-more" href="${CASTING_BOOK_URL}#m-F02" target="_blank" rel="noopener noreferrer">`);
  assert.doesNotMatch(photos,/onclick|data-mutate|data-tab/);
  assert.deepEqual(selection,before);
  assert.ok(html.includes(esc(selection.notes)));
  assert.match(html,/name="cast_voice" value="B" checked/);
  assert.equal((html.match(/<audio preload="none" src="[^"]+" hidden><\/audio>/g)||[]).length,3);
  assert.equal((html.match(/class="voice-play" data-action="voice-play"/g)||[]).length,3);
  for(const voice of CASTING_MODELS.find(model=>model.id==='F02').voices)assert.ok(html.includes(`src="${voice.src}"`));
});

function draftForm(initial){
  const controls=CASTING_MODELS.map(model=>({name:'cast_modelId',type:'radio',value:model.id,checked:model.id===initial.modelId}));
  for(const [key,value]of Object.entries(initial))if(key!=='modelId'&&key!=='voice')controls.push({name:'cast_'+key,type:'textarea',value});
  let voiceFields=[],events=[];
  const makeNode=()=>({dataset:{},writes:0,_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.writes++;}});
  const photos=makeNode(),summary=makeNode(),voices=makeNode();
  Object.defineProperty(voices,'innerHTML',{get(){return this._html;},set(value){
    this._html=value;this.writes++;
    voiceFields=Array.from(value.matchAll(/<input type="radio" name="cast_voice" value="([^"]*)"([^>]*)>/g),match=>({name:'cast_voice',type:'radio',value:match[1],checked:/\bchecked\b/.test(match[2]),dispatchEvent(event){events.push({value:this.value,type:event.type,bubbles:event.bubbles});return true;}}));
  }});
  voices.innerHTML=castingVoices(initial);
  const elements={'[data-casting-photos]':photos,'[data-casting-summary]':summary,'[data-casting-voices]':voices};
  const root={querySelector(selector){return elements[selector]||null;},querySelectorAll(){return [];}};
  const form={get elements(){return [...controls,...voiceFields];},querySelector(selector){return selector==='.casting-configurator'?root:selector==='[name=cast_voice][value=""]'?voiceFields.find(field=>field.value===''):null;}};
  return {form,photos,summary,voices,events,selectModel(id){for(const field of controls)if(field.name==='cast_modelId')field.checked=field.value===id;},setNote(value){controls.find(field=>field.name==='cast_notes').value=value;}};
}

test('switching models refreshes the matching photos and clears only voice while keeping unsaved style and notes',()=>{
  const draft=draftForm({modelId:'F02',voice:'B',hair:'wave',jacket:'blazer',top:'shirt',bottom:'denim',earrings:'stud',ring:'simple',notes:'아직 저장하지 않은 고객 메모'});
  refreshCasting(draft.form);
  assert.ok(draft.photos.innerHTML.includes('./assets/casting/photos/f02-look-1.webp'));
  assert.match(draft.photos.innerHTML,/<h4>하린의 사진<\/h4>/);
  const before=castingFromForm(draft.form);
  draft.selectModel('M01');
  refreshCasting(draft.form,{modelChanged:true});
  const after=castingFromForm(draft.form);
  assert.deepEqual(after,{...before,modelId:'M01',voice:''});
  assert.ok(draft.photos.innerHTML.includes('./assets/casting/photos/m01-look-1.webp'));
  assert.doesNotMatch(draft.photos.innerHTML,/photos\/f02-/);
  assert.equal(draft.photos.dataset.model,'M01');
  assert.ok(draft.voices.innerHTML.includes('./assets/casting/voice/M01-1.mp3'));
  assert.doesNotMatch(draft.voices.innerHTML,/voice\/F02-/);
  assert.ok(draft.events.some(event=>event.value===''&&event.type==='change'&&event.bubbles));
  const writes=draft.photos.writes;
  draft.setNote('모델 변경 뒤에도 이어 쓰는 메모');
  refreshCasting(draft.form);
  assert.equal(draft.photos.writes,writes,'editing notes does not reload the photos');
  assert.equal(castingFromForm(draft.form).notes,'모델 변경 뒤에도 이어 쓰는 메모');
  assert.equal(castingFromForm(draft.form).jacket,'blazer');
});
