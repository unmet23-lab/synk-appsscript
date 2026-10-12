import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStrategy,normalizeStrategyData,strategyOf,strategyView,strategyReadiness,applyStrategyAction,sceneStrategy} from './pulse-strategy.mjs';

const data={objective:'both',product:'합성 제품',audience:'합성 고객',channels:['instagram','youtube'],primaryPromise:'쉽게 이해하는 제품',evidence1:'제품 설명서와 실제 사용 장면',value1:'편리함',value2:'가벼움',memoryHook:'마지막 제품 이름',desiredAction:'제품 페이지 확인'};
const staff={author:'staff',authorId:'private-staff-id',authorName:'합성 담당자',at:'2026-10-11T00:00:00.000Z'},customer={author:'customer',authorId:'customer',authorName:'합성 고객',at:'2026-10-11T00:01:00.000Z'};
const rejects=(run,status)=>assert.throws(run,error=>error.status===status);
const save=(state,strategy=data)=>applyStrategyAction(state,{action:'save_strategy',strategy},staff);
const request=state=>applyStrategyAction(state,{action:'request_strategy_review'},staff);
const confirm=(state,revision=state.revision)=>applyStrategyAction(state,{action:'confirm_strategy',strategyRevision:revision},customer);

test('empty strategy remains schema-one compatible and optional estimates are genuinely optional',()=>{
 const empty=emptyStrategy();assert.equal(empty.revision,0);assert.deepEqual(empty.history,[]);assert.equal(empty.request,null);assert.equal(empty.confirmation,null);
 assert.equal(empty.data.durationSeconds,null);assert.equal(empty.data.budgetProduction,null);assert.equal(empty.data.budgetMedia,null);assert.equal(empty.data.proposedDeadline,'');assert.equal(empty.data.planInterest,'');assert.equal(empty.data.revisionNotes,'');
 const normalized=normalizeStrategyData({...data,durationSeconds:1,budgetProduction:0,budgetMedia:1e12,proposedDeadline:'2028-02-29',destinationUrl:'https://example.test/path'});
 assert.equal(normalized.budgetMedia,1e12);assert.equal(normalized.proposedDeadline,'2028-02-29');assert.deepEqual(strategyReadiness(normalized),{ready:true,missing:[]});
 assert.equal(strategyReadiness(normalizeStrategyData({})).ready,false);
});

test('strategy rejects invalid fields, loose types, control characters, unsafe links and impossible dates',()=>{
 const invalid=[{unexpected:'x'},{objective:'leads'},{distribution:'ads'},{aspectRatio:'4:3'},{planInterest:'guaranteed'},{channels:['instagram','instagram']},{channels:['unknown']},{channels:'youtube'},{durationSeconds:0},{durationSeconds:601},{durationSeconds:'15'},{durationSeconds:NaN},{budgetMedia:-1},{budgetProduction:Infinity},{budgetProduction:1e12+1},{notes:'x'.repeat(3001)},{product:'x'.repeat(1001)},{audience:'bad\u0000value'},{destinationUrl:'http://example.test'},{destinationUrl:'https://user:password@example.test'},{destinationUrl:'javascript:alert(1)'},{proposedDeadline:'2026-02-29'},{proposedDeadline:'2026-2-01'}];
 for(const input of invalid)rejects(()=>normalizeStrategyData(input),400);
 const normalized=normalizeStrategyData({notes:'x'.repeat(3000),product:'  product  ',durationSeconds:600});assert.equal(normalized.product,'product');assert.equal(normalized.notes.length,3000);
});

test('review readiness needs one message, evidence and action without forcing extra strategy questions',()=>{
 for(const key of ['primaryPromise','evidence1','desiredAction']){const incomplete={...data,[key]:'  '};assert.equal(strategyReadiness(normalizeStrategyData(incomplete)).ready,false,key);rejects(()=>request(save(null,incomplete)),409);}
 const minimal={primaryPromise:data.primaryPromise,evidence1:data.evidence1,desiredAction:data.desiredAction};
 assert.deepEqual(strategyReadiness(normalizeStrategyData(minimal)),{ready:true,missing:[]});
 assert.ok(request(save(null,minimal)).request);
 assert.ok(request(save(null,{...data,value1:'',value2:'',value3:''})).request);
 const ready=request(save(null,data));assert.equal(ready.data.budgetProduction,null);assert.equal(ready.data.casting,'');assert.equal(ready.data.proposedDeadline,'');
});

test('partial strategy edits preserve legacy values and unknown stored fields while explicit blanks clear choices',()=>{
 const previous=save();previous.data.legacyExtension={keep:true};previous.data.evidence2='기존 가치의 근거';
 const revised=applyStrategyAction(previous,{action:'save_strategy',strategy:{primaryPromise:'한 가지 수정한 메시지'}},staff);
 assert.equal(revised.data.value1,data.value1);assert.equal(revised.data.value2,data.value2);assert.equal(revised.data.evidence2,'기존 가치의 근거');assert.deepEqual(revised.data.legacyExtension,{keep:true});
 const cleared=applyStrategyAction(revised,{action:'save_strategy',strategy:{value2:'',evidence2:''}},staff);
 assert.equal(cleared.data.value2,'');assert.equal(cleared.data.evidence2,'');assert.equal(revised.data.value2,data.value2);
 assert.doesNotMatch(JSON.stringify(strategyView(revised)),/legacyExtension/);
});

test('only staff requests and only the customer confirms the exact live requested strategy',()=>{
 let state=save();rejects(()=>confirm(state),409);rejects(()=>applyStrategyAction(state,{action:'request_strategy_review'},customer),403);
 state=request(state);assert.equal(state.revision,1);assert.equal(state.request.strategyRevision,1);rejects(()=>request(state),409);
 rejects(()=>applyStrategyAction(state,{action:'confirm_strategy',strategyRevision:1},staff),403);rejects(()=>confirm(state,0),409);rejects(()=>confirm(state,'1'),409);
 state=confirm(state);assert.equal(state.confirmation.strategyRevision,1);assert.equal(state.confirmation.author,'customer');rejects(()=>confirm(state),409);
 const next=save(state,{...data,primaryPromise:'수정 약속'});assert.equal(next.revision,2);assert.equal(next.request,null);assert.equal(next.confirmation,null);assert.equal(next.history[0].confirmation.strategyRevision,1);assert.equal(next.history[0].data.primaryPromise,data.primaryPromise);rejects(()=>confirm(request(next),1),409);
 assert.equal(state.data.primaryPromise,data.primaryPromise,'prior state is immutable');
});

test('twenty complete previous versions survive with safe public metadata and no recursive history',()=>{
 let state=confirm(request(save()));state.legacyExtension={preserve:true};state.data.privateUnknown='never project';
 for(let i=2;i<=25;i++)state=save(state,{...data,product:'버전 '+i});
 assert.equal(state.revision,25);assert.equal(state.history.length,20);assert.equal(state.history[0].revision,5);assert.equal(state.history.at(-1).revision,24);assert.ok(state.legacyExtension.preserve);
 const projected=strategyView(state);assert.equal(projected.history.length,20);assert.doesNotMatch(JSON.stringify(projected),/authorId|private-staff-id|legacyExtension|privateUnknown/);assert.equal(projected.history.some(entry=>Object.hasOwn(entry,'history')),false);
 const original={revision:1,data:{...data,extension:{keep:true}},request:null,confirmation:null,history:[],opaque:{keep:true}};const read=strategyOf(original);read.data.extension.keep=false;assert.equal(original.data.extension.keep,true);assert.equal(strategyView(original).data.extension,undefined);
});

test('scene value mapping records actual labels and rejects missing or forged references',()=>{
 const state=save(),mapping=sceneStrategy({purpose:'proof',valueNumbers:[2,1]},null,state);
 assert.deepEqual(mapping,{purpose:'proof',valueNumbers:[2,1],strategyRevision:1,valueLabels:[{number:2,text:'가벼움'},{number:1,text:'편리함'}]});
 for(const input of [{purpose:'sales'},{valueNumbers:[0]},{valueNumbers:[4]},{valueNumbers:[1,1]},{valueNumbers:['1']},{valueNumbers:[1.5]},{valueNumbers:[3]},{valueNumbers:'1'}])rejects(()=>sceneStrategy(input,null,state),400);
 const next=save(state,{...data,value1:'바뀐 가치',value2:''});
 const preserved=sceneStrategy({title:'기존 폼 수정'},mapping,next);assert.deepEqual(preserved,mapping);assert.notEqual(preserved.valueLabels,mapping.valueLabels);
 assert.deepEqual(sceneStrategy({purpose:'value',valueNumbers:[1]},mapping,next),{purpose:'value',valueNumbers:[1],strategyRevision:2,valueLabels:[{number:1,text:'바뀐 가치'}]});
 assert.deepEqual(sceneStrategy({valueNumbers:[],purpose:''},mapping,next),{purpose:'',valueNumbers:[],strategyRevision:2,valueLabels:[]});
 assert.deepEqual(sceneStrategy({},null,emptyStrategy()),{purpose:'',valueNumbers:[],strategyRevision:0,valueLabels:[]});
});
