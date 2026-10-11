'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {requestSpec}=require('../src/account-requests.cjs');
const uuid='11111111-1111-4111-8111-111111111111';
const send=params=>requestSpec('worldRequest',params,'0.4.2','world','world');
test('native WORLD names fixed methods and routes, including PUT CAS and classroom scope',()=>{
  assert.deepEqual(send({route:'bootstrap'}),{path:'synk-world-v1/bootstrap'});
  assert.deepEqual(send({route:'town/state',classId:uuid}),{path:'synk-town/state?classId='+uuid});
  const body={slots:{body:'coat',neck:''},dyes:{coat:'#abcdef'},expectedRevision:3,requestId:uuid};
  const spec=send({route:'avatar/outfit',body});assert.deepEqual(spec,{path:'synk-world-v1/avatar/outfit',method:'PUT',body});assert.notEqual(spec.body,body);
  for(const [route,body,method] of [['play/start',{requestId:uuid},'POST'],['play/complete',{runId:uuid,requestId:uuid,answers:[{questionId:'q1',optionId:'a1'}]},'POST'],['wardrobe/looks',{looks:[{id:'look1',name:'내 옷',slots:{body:'',neck:''}}],expectedRevision:0,requestId:uuid},'PUT'],['town/command',{id:uuid,type:'harvest',payload:{plotId:'garden'},expectedRevision:0},'POST'],['town/presence',{surfaceId:'world-main',surface:'town',foreground:true,safe:true},'POST'],['town/sharing',{enabled:true,revision:0},'POST'],['enrollment/preview',{token:'s'.repeat(24)},'POST'],['enrollment/claim',{token:'s'.repeat(24),confirm:true},'POST']])assert.equal(send({route,body,...(route==='town/sharing'?{classId:uuid}:{})}).method,method,route);
});
test('native WORLD rejects alternate credentials, URL paths, methods, unexpected bodies and other clients',()=>{
  for(const params of [{route:'https://evil.invalid'},{route:'../synk-account'},{route:'bootstrap',method:'DELETE'},{route:'bootstrap',headers:{authorization:'secret'}},{route:'bootstrap',body:{}},{route:'bootstrap',classId:uuid},{route:'town/state',classId:'../other'},{route:'town/sharing',body:{enabled:true,revision:0}},{route:'town/sharing',classId:uuid,body:{enabled:true,expectedRevision:0}},{route:'play/start',body:{requestId:uuid,accountId:'other'}},{route:'play/complete',body:{runId:uuid,requestId:uuid,answers:[{questionId:'q1',optionId:'a1',correct:true}]}},{route:'avatar/outfit',body:{slots:{body:'',neck:''},expectedRevision:-1,requestId:uuid}},{route:'wardrobe/looks',body:{looks:[],expectedRevision:0,requestId:'not-uuid'}},{route:'enrollment/claim',body:{token:'s'.repeat(24),confirm:false}}])assert.throws(()=>send(params),{code:'INVALID_REQUEST'});
  for(const [product,key] of [['platform','platform'],['world','messenger'],['platform','world']])assert.throws(()=>requestSpec('worldRequest',{route:'bootstrap'},'0.4.2',product,key),{code:'INVALID_REQUEST'});
});
test('native WORLD bounds nested JSON and rejects prototype pollution before transport',()=>{
  const body={id:uuid,type:'test',expectedRevision:0,payload:{}};
  for(const payload of [JSON.parse('{"__proto__":{"polluted":true}}'),{x:Infinity},{x:'x'.repeat(524288)},new Date()])assert.throws(()=>send({route:'town/command',body:{...body,payload}}),{code:'INVALID_REQUEST'});
  const cycle={};cycle.self=cycle;assert.throws(()=>send({route:'town/command',body:{...body,payload:cycle}}),{code:'INVALID_REQUEST'});
  const deep={};let cur=deep;for(let i=0;i<25;i++)cur=cur.x={};assert.throws(()=>send({route:'town/command',body:{...body,payload:deep}}),{code:'INVALID_REQUEST'});
  assert.equal({}.polluted,undefined);
});
