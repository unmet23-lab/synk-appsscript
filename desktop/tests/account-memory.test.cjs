'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {requestSpec}=require('../src/account-requests.cjs');
test('native WORLD personalization uses canonical account memory routes and immutable revision',()=>{
  const entry={key:'flow:korean-rhythm',value:{help:'more'},version:1};
  assert.deepEqual(requestSpec('memoryGet',{revision:3},'1.0.0','world'),{path:'synk-learning?view=memory&revision=3'});
  assert.deepEqual(requestSpec('memoryPost',{revision:3,entries:[entry]},'1.0.0','world'),{path:'synk-learning',body:{revision:3,memory:[entry]}});
  assert.deepEqual(requestSpec('atlasSummary',{},'1.0.0','world'),{path:'synk-account?view=atlas'});
});
test('native memory cannot override route, identity, query, class or revision and bounds payload',()=>{
  for(const [op,params]of [['memoryGet',{revision:-1}],['memoryGet',{revision:1,url:'https://untrusted.invalid'}],['memoryPost',{revision:1,entries:[],classId:'other'}],['memoryPost',{revision:1,entries:{}}],['memoryPost',{revision:1,entries:Array(257).fill({})}],['memoryPost',{revision:1,entries:[{value:'x'.repeat(262144)}]}],['atlasSummary',{accountId:'other'}]])assert.throws(()=>requestSpec(op,params,'1.0.0','world'),{code:'INVALID_REQUEST'});
});
