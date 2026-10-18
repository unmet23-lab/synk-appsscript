import test from 'node:test';
import assert from 'node:assert/strict';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';
import {PRODUCTION_PLANS,PRODUCTION_LIBRARY_URL} from './public/pulse-app/production-catalog.mjs';
import {castingProductionPlan,castingPortfolio,castingView,castingFromForm,castingVoices,refreshCasting} from './public/pulse-app/casting-view.mjs';
import {esc} from './public/pulse-app/api.mjs';

test('each known model opens its own production plan without presenting a film as produced',()=>{
  assert.equal(PRODUCTION_PLANS.length,7);
  assert.deepEqual(new Set(PRODUCTION_PLANS.map(plan=>plan.modelId)),new Set(CASTING_MODELS.map(model=>model.id)));
  for(const model of CASTING_MODELS){
    const plan=PRODUCTION_PLANS.find(item=>item.modelId===model.id),html=castingPortfolio({modelId:model.id});
    assert.ok(html.includes(esc(plan.title)),model.id+' plan title');
    assert.ok(html.includes(esc(plan.memory)),model.id+' memory hook');
    for(const value of plan.values)assert.ok(html.includes(esc(value)),model.id+' value');
    assert.match(html,/제작 예시 · 기획안/);
    assert.ok(html.includes(`href="${PRODUCTION_LIBRARY_URL}?model=${model.id}"`));
    assert.match(html,/광고 기획·콘티 보기/);
    assert.match(html,/7개 광고 기획 전체 보기/);
    assert.doesNotMatch(html,/<audio|src=""/);
    if(model.id==='F02'){
      assert.equal((html.match(/<video\b/g)||[]).length,2);
      assert.match(html,/5초 움직임 샘플/);
      assert.match(html,/광고·런웨이 본편은 별도 제작 예정입니다/);
    }else{
      assert.equal((html.match(/영상 준비 중/g)||[]).length,2);
      // A finished music video (M03 works) adds one excerpt player; ad/runway slots stay empty.
      assert.equal((html.match(/<video\b/g)||[]).length,model.works?.length?1:0);
      assert.equal(model.videos.every(video=>video.src===''),true,'other models keep ad and runway sources empty');
    }
    if(plan.board){
      assert.ok(html.includes(`src="${esc(plan.board)}"`));
      assert.match(html,/<img[^>]+loading="lazy"[^>]+decoding="async"/);
    }else assert.doesNotMatch(html,/<img/);
  }
});

test('missing and unknown selections keep the library entrance without substituting another model plan',()=>{
  for(const modelId of ['',undefined,'M99','<script>']){
    const html=castingPortfolio({modelId});
    assert.match(html,/모델을 고르면 포트폴리오/);
    assert.match(html,/7개 광고 기획 전체 보기/);
    assert.doesNotMatch(html,/casting-production-card|casting-video-grid|<img|<script>/);
    assert.equal(castingProductionPlan(modelId), '');
  }
  assert.equal(castingProductionPlan('F02',[]),'');
  assert.equal(castingProductionPlan('F02',[{modelId:'M01',title:'다른 모델'}]),'');
});

test('production copy and attributes are escaped and thumbnail paths cannot escape the public production folder',()=>{
  const unsafe='<img src=x onerror="alert(1)"> & "따옴표"';
  const plan={modelId:'F02',title:unsafe,product:unsafe,values:[unsafe],memory:unsafe,status:unsafe,url:'javascript:alert(1)',board:'./assets/production/harin.webp'};
  const html=castingProductionPlan('F02',[plan]);
  assert.ok(html.includes(esc(unsafe)));
  assert.doesNotMatch(html,/<img src=x|javascript:| onerror=["']/);
  assert.equal((html.match(/<img\b/g)||[]).length,1,'escaped copy does not add an image element');
  assert.match(html,/href="\.\/production-library\/\?model=F02"/);
  assert.match(html,/src="\.\/assets\/production\/harin\.webp"/);
  for(const board of ['javascript:alert(1)','https://example.test/board.webp','./assets/production/../private.webp','./assets/production/harin.webp" onerror="alert(1)','./assets/production/sub/board.webp']){
    assert.doesNotMatch(castingProductionPlan('F02',[{...plan,board}]),/<img /,'unsafe board: '+board);
  }
});

test('production links use new isolated tabs and rendering leaves the existing customer draft and restored audio intact',()=>{
  const selection={modelId:'F02',voice:'B',hair:'wave',makeup:'natural',jacket:'blazer',top:'shirt',bottom:'denim',earrings:'stud',ring:'simple',notes:'저장 전 고객 메모 <유지>'};
  const before=structuredClone(selection),portfolio=castingPortfolio(selection),html=castingView(selection);
  const anchors=Array.from(portfolio.matchAll(/<a\b[^>]*>/g),match=>match[0]);
  assert.ok(anchors.length>=2);
  for(const anchor of anchors){
    assert.match(anchor,/target="_blank"/);
    assert.match(anchor,/rel="noopener noreferrer"/);
    assert.doesNotMatch(anchor,/onclick|data-action|data-tab|data-mutate/);
  }
  assert.deepEqual(selection,before);
  assert.ok(html.includes(esc(selection.notes)));
  assert.match(html,/name="cast_voice" value="B" checked/);
  assert.equal((html.match(/<audio controls preload="none"/g)||[]).length,3);
  for(const voice of CASTING_MODELS.find(model=>model.id==='F02').voices)assert.ok(html.includes(`src="${voice.src}"`));
});

function draftForm(initial){
  const controls=CASTING_MODELS.map(model=>({name:'cast_modelId',type:'radio',value:model.id,checked:model.id===initial.modelId}));
  for(const [key,value]of Object.entries(initial))if(key!=='modelId'&&key!=='voice')controls.push({name:'cast_'+key,type:'textarea',value});
  let voiceFields=[],events=[];
  const makeNode=()=>({dataset:{},writes:0,_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.writes++;}});
  const portfolio=makeNode(),summary=makeNode(),voices=makeNode();
  Object.defineProperty(voices,'innerHTML',{get(){return this._html;},set(value){
    this._html=value;this.writes++;
    voiceFields=Array.from(value.matchAll(/<input type="radio" name="cast_voice" value="([^"]*)"([^>]*)>/g),match=>({name:'cast_voice',type:'radio',value:match[1],checked:/\bchecked\b/.test(match[2]),dispatchEvent(event){events.push({value:this.value,type:event.type,bubbles:event.bubbles});return true;}}));
  }});
  voices.innerHTML=castingVoices(initial);
  const elements={'[data-casting-portfolio]':portfolio,'[data-casting-summary]':summary,'[data-casting-voices]':voices};
  const root={querySelector(selector){return elements[selector]||null;},querySelectorAll(){return [];}};
  const form={get elements(){return [...controls,...voiceFields];},querySelector(selector){return selector==='.casting-configurator'?root:selector==='[name=cast_voice][value=""]'?voiceFields.find(field=>field.value===''):null;}};
  return {form,portfolio,summary,voices,events,selectModel(id){for(const field of controls)if(field.name==='cast_modelId')field.checked=field.value===id;},setNote(value){controls.find(field=>field.name==='cast_notes').value=value;}};
}

test('switching models refreshes the matching plan and clears only voice while keeping unsaved style and notes',()=>{
  const draft=draftForm({modelId:'F02',voice:'B',hair:'wave',jacket:'blazer',top:'shirt',bottom:'denim',earrings:'stud',ring:'simple',notes:'아직 저장하지 않은 고객 메모'});
  refreshCasting(draft.form);
  assert.ok(draft.portfolio.innerHTML.includes(esc(PRODUCTION_PLANS.find(plan=>plan.modelId==='F02').title)));
  const before=castingFromForm(draft.form);
  draft.selectModel('M01');
  refreshCasting(draft.form,{modelChanged:true});
  const after=castingFromForm(draft.form);
  assert.deepEqual(after,{...before,modelId:'M01',voice:''});
  assert.ok(draft.portfolio.innerHTML.includes(esc(PRODUCTION_PLANS.find(plan=>plan.modelId==='M01').title)));
  assert.equal(draft.portfolio.dataset.model,'M01');
  assert.ok(draft.voices.innerHTML.includes('./assets/casting/voice/M01-1.mp3'));
  assert.doesNotMatch(draft.voices.innerHTML,/voice\/F02-/);
  assert.ok(draft.events.some(event=>event.value===''&&event.type==='change'&&event.bubbles));
  const writes=draft.portfolio.writes;
  draft.setNote('모델 변경 뒤에도 이어 쓰는 메모');
  refreshCasting(draft.form);
  assert.equal(draft.portfolio.writes,writes,'editing notes does not remount the preview or navigate');
  assert.equal(castingFromForm(draft.form).notes,'모델 변경 뒤에도 이어 쓰는 메모');
  assert.equal(castingFromForm(draft.form).jacket,'blazer');
});
