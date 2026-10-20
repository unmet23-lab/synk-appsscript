import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCastingSelection,emptyStrategyData,normalizeCastingSelection,normalizeStrategyData,strategyOf,strategyView,strategyReadiness,applyStrategyAction} from './pulse-strategy.mjs';

const data={objective:'brand',product:'합성 제품',audience:'합성 고객',channels:['instagram'],primaryPromise:'오래 쓰는 제품',value1:'편안함',evidence1:'합성 내구성 시험 장면',value2:'튼튼함',memoryHook:'제품 이름',desiredAction:'자세히 보기'};
const selection={modelId:'F01',hair:'wave',makeup:'natural',jacket:'blazer',top:'shirt',bottom:'trousers',voice:'B',earrings:'stud',ring:'simple',notes:'밝은 분위기'};
const staff={author:'staff',authorId:'synthetic-staff',authorName:'합성 담당자',at:'2026-10-12T00:00:00.000Z'},customer={author:'customer',authorId:'synthetic-customer',authorName:'합성 고객',at:'2026-10-12T00:01:00.000Z'};
const save=(state,input,stamp=staff)=>applyStrategyAction(state,{action:'save_strategy',strategy:input},stamp);
const request=state=>applyStrategyAction(state,{action:'request_strategy_review'},staff);
const confirm=(state,revision=state.revision)=>applyStrategyAction(state,{action:'confirm_strategy',strategyRevision:revision},customer);
const rejects=run=>assert.throws(run,error=>error.status===400);

test('old strategies receive an optional, independent casting selection without changing the original row',()=>{
  const legacy={revision:1,data:{...data},request:null,confirmation:null,history:[]};
  const read=strategyOf(legacy),view=strategyView(legacy),empty=emptyCastingSelection();
  assert.deepEqual(read.data.castingSelection,empty);assert.deepEqual(view.data.castingSelection,empty);
  assert.equal(Object.hasOwn(legacy.data,'castingSelection'),false);
  assert.deepEqual(normalizeStrategyData(data).castingSelection,empty);
  assert.equal(strategyReadiness(normalizeStrategyData(data)).ready,true);
  assert.ok(request(save(null,data)).request,'casting is not required to request strategy review');
  read.data.castingSelection.modelId='M01';assert.deepEqual(view.data.castingSelection,empty);
  const first=emptyStrategyData(),second=emptyStrategyData();first.castingSelection.hair='short';assert.equal(second.castingSelection.hair,'');
  assert.deepEqual(strategyOf({data:{castingSelection:{modelId:'M01'}}}).data.castingSelection,{...empty,modelId:'M01'});
});

test('all prepared model, style and model-specific voice options normalize without loose coercion',()=>{
  const enums={modelId:['','M01','F01','F02','F03','M02','F04','M03'],hair:['','original','look-2','look-3','short','bob','long-straight','wave','updo','custom'],makeup:['','natural','clean','glow','smoky','custom'],jacket:['','none','blazer','casual','leather','custom'],top:['','tshirt','shirt','knit','blouse','custom'],bottom:['','trousers','denim','skirt','custom'],voice:['','A','B','C'],earrings:['','none','stud','hoop','drop','custom'],ring:['','none','simple','layered','custom']};
  for(const [key,values]of Object.entries(enums))for(const value of values){const input={modelId:'M01',[key]:value};assert.equal(normalizeCastingSelection(input)[key],value,key+': '+value);}
  assert.deepEqual(normalizeStrategyData({...data,castingSelection:selection}).castingSelection,selection);
  const normalized=normalizeCastingSelection({...selection,notes:'  요청\n사항\t확인  '});assert.equal(normalized.notes,'요청\n사항\t확인');
  assert.equal(normalizeCastingSelection({notes:'x'.repeat(1000)}).notes.length,1000);
});

test('invalid nested keys, types, options, control characters and voices without a model are rejected',()=>{
  for(const input of [undefined,null,[],false,7,'F01',{extra:'hidden'},{notes:{private:'hidden'}},{notes:null},{notes:undefined},{notes:'x'.repeat(1001)},{notes:'bad\u0000value'},{notes:'bad\u001fvalue'},{modelId:'M04'},{voice:'D'},{voice:'A'},{modelId:'',voice:'B'}])rejects(()=>normalizeStrategyData({castingSelection:input}));
  for(const key of ['modelId','hair','makeup','jacket','top','bottom','voice','earrings','ring'])for(const value of [null,undefined,0,false,[],{},'unknown'])rejects(()=>normalizeCastingSelection({modelId:'M01',[key]:value}));
  rejects(()=>save(null,{...data,castingSelection:{...selection,privateAssetUrl:'https://example.test/private'}}));
});

test('legacy clients preserve selections and explicit empty fields clear them',()=>{
  const first=save(null,{...data,castingSelection:selection},customer);
  const next=save(first,{...data,product:'수정 제품'});
  assert.deepEqual(next.data.castingSelection,selection);assert.deepEqual(next.history[0].data.castingSelection,selection);
  assert.notEqual(next.data.castingSelection,first.data.castingSelection);
  const cleared=save(next,{...data,castingSelection:emptyCastingSelection()},customer);
  assert.deepEqual(cleared.data.castingSelection,emptyCastingSelection());assert.deepEqual(cleared.history.at(-1).data.castingSelection,selection);
  assert.deepEqual(first.data.castingSelection,selection,'previous states remain unchanged');
  const emptyObject=save(first,{...data,castingSelection:{}});assert.deepEqual(emptyObject.data.castingSelection,emptyCastingSelection());
});

test('a customer casting change keeps the confirmed plan; staff casting changes and plan edits need a new confirmation',()=>{
  const confirmed=confirm(request(save(null,{...data,castingSelection:selection})));
  const changed={...selection,modelId:'M02',voice:'C',hair:'short'};
  // The confirmation covers the message, evidence, action and requests, so a customer's own model or style choice carries it to the new version.
  const next=save(confirmed,{...data,castingSelection:changed},customer);
  assert.equal(next.revision,2);assert.deepEqual(next.data.castingSelection,changed);
  assert.equal(next.request.strategyRevision,2);assert.equal(next.request.carriedFrom,1);
  assert.equal(next.confirmation.strategyRevision,2);assert.equal(next.confirmation.carriedFrom,1);assert.equal(next.confirmation.at,confirmed.confirmation.at);
  assert.deepEqual(next.history[0].data.castingSelection,selection);assert.equal(next.history[0].confirmation.strategyRevision,1);
  assert.equal(confirmed.confirmation.strategyRevision,1,'the previous state is unchanged');assert.equal(strategyView(next).confirmation.carriedFrom,1);
  const again=save(next,{...data,castingSelection:{...changed,notes:'다시 고름'}},customer);
  assert.equal(again.confirmation.strategyRevision,3);assert.equal(again.confirmation.carriedFrom,1,'names the version the customer actually confirmed');
  assert.throws(()=>confirm(again),error=>error.status===409);
  assert.equal(save(next,{...data,castingSelection:changed},customer),next,'saving unchanged content keeps the version, request and confirmation');
  // Staff casting edits and any plan edit go back to the customer for a new confirmation.
  for(const edited of [save(next,{...data,castingSelection:{...changed,modelId:'F03',voice:''}}),save(next,{...data,primaryPromise:'바뀐 약속',castingSelection:{...changed,modelId:'F03',voice:''}},customer)]){
    assert.equal(edited.revision,3);assert.equal(edited.request,null);assert.equal(edited.confirmation,null);
    assert.equal(edited.history.at(-1).confirmation.strategyRevision,2);
    assert.throws(()=>confirm(request(edited),2),error=>error.status===409);
    const updated=confirm(request(edited));assert.equal(updated.confirmation.strategyRevision,3);assert.equal(Object.hasOwn(updated.confirmation,'carriedFrom'),false);
  }
  let rolling=next;for(let i=0;i<24;i++)rolling=save(rolling,{...data,castingSelection:{...changed,notes:'선택 버전 '+i}});
  assert.equal(rolling.history.length,20);assert.equal(rolling.history.at(-1).data.castingSelection.notes,'선택 버전 22');
});

test('public current and historical selections expose only validated strings and no nested extensions',()=>{
  const stored=save(null,{...data,castingSelection:selection});
  stored.data.castingSelection.privateExtension={assetUrl:'never-expose'};
  assert.equal(save(stored,{...data}),stored,'an unchanged legacy save keeps the stored version');
  const next=save(stored,{...data,product:'수정 제품'});
  assert.deepEqual(next.data.castingSelection.privateExtension,{assetUrl:'never-expose'},'legacy saves preserve stored extensions internally');
  const view=strategyView(next);
  assert.deepEqual(view.data.castingSelection,selection);assert.deepEqual(view.history[0].data.castingSelection,selection);
  assert.doesNotMatch(JSON.stringify(view),/privateExtension|never-expose|authorId|synthetic-staff/);
  assert.deepEqual(Object.keys(view.data.castingSelection),Object.keys(emptyCastingSelection()));
  const malformed={revision:1,data:{castingSelection:{modelId:'M99',voice:'A',hair:{private:'never-expose'},notes:{private:'never-expose'},extra:{private:'never-expose'}}},history:[{revision:0,data:{castingSelection:{modelId:'F01',notes:'bad\u0000value',private:'never-expose'}}}]};
  const safe=strategyView(malformed);
  assert.deepEqual(safe.data.castingSelection,emptyCastingSelection());
  assert.deepEqual(safe.history[0].data.castingSelection,{...emptyCastingSelection(),modelId:'F01'});
  assert.doesNotMatch(JSON.stringify(safe),/never-expose|private|M99/);
});
