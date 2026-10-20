'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {requestSpec}=require('../src/account-requests.cjs');
const {WORLD_ROUTE_NAMES}=require('../src/world-requests.cjs');
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
test('native WORLD reads 「우리 반 수업」 with the student contract version and no body, class or query',()=>{
  assert.deepEqual(send({route:'classroom'}),{path:'classroom',contractVer:'c16'});
  for(const params of [{route:'classroom',body:{}},{route:'classroom',body:null},{route:'classroom',classId:uuid},{route:'classroom',query:{after:0}},{route:'classroom',method:'POST'},{route:'classroom?x=1'},{route:'classroom/'},{route:'Classroom'}])assert.throws(()=>send(params),{code:'INVALID_REQUEST'});
  assert.throws(()=>requestSpec('worldRequest',{route:'classroom'},'0.4.2','platform','platform'),{code:'INVALID_REQUEST'});
  // The WORLD page compares its own value with the student app's src/계약판.js (qa/classroom-lessons.test.mjs).
  const web=fs.readFileSync(path.join(__dirname,'../../experiences/synk-world-app/classroom-client.mjs'),'utf8').match(/export const CLASSROOM_CONTRACT_VER='(c\d+)';/);
  assert.ok(web);assert.equal(send({route:'classroom'}).contractVer,web[1]);
  // The WORLD page shows the section only when main advertises this route (old apps do not).
  assert.ok(Object.isFrozen(WORLD_ROUTE_NAMES));
  assert.deepEqual([...WORLD_ROUTE_NAMES],['bootstrap','play/start','play/complete','avatar/outfit','wardrobe/looks','town/entry','town/state','town/command','town/presence','town/sharing','enrollment/preview','enrollment/claim','classroom','homework','homework/submit','homework/key']);
});
test('native WORLD 「이번 주 과제」: a class-free read and a class-scoped submission with this week ids only',()=>{
  const version='v1-53795e0997f6',other='22222222-2222-4222-8222-222222222222';
  const body=(extra={})=>({classId:uuid,week:3,kind:'writing',requestId:uuid,expectedRevision:0,contentVersion:version,answers:{'W3-1.1':'합성 글'},...extra});
  assert.deepEqual(send({route:'homework'}),{path:'synk-classroom/api/world/homework'});
  const spec=send({route:'homework/submit',classId:uuid,body:body({retry:{'W2-1':'다시 쓴 문장'}})});
  assert.deepEqual(spec,{path:'synk-classroom/api/world/homework?classId='+uuid,method:'POST',body:body({retry:{'W2-1':'다시 쓴 문장'}})});
  assert.equal(send({route:'homework/submit',classId:uuid,body:body({kind:'reading',answers:{'R3-1':1,'R3-2':4}})}).method,'POST');
  assert.equal(send({route:'homework/submit',classId:uuid,body:body({week:5,answers:{'W5-1.1':[['서론','-지만'],['본론','우선']],'W5-1.2':'서론 글'}})}).method,'POST');
  for(const params of [{route:'homework',classId:uuid},{route:'homework',body:{}},{route:'homework',method:'POST'},{route:'homework/submit',body:body()},{route:'homework/submit',classId:other,body:body()},
    {route:'homework/submit',classId:uuid,body:body({answers:{'W2-1.1':'다른 주'}})},{route:'homework/submit',classId:uuid,body:body({answers:{'W3-1x1':'점 없음'}})},{route:'homework/submit',classId:uuid,body:body({answers:{'W3-1.1':'가'.repeat(4001)}})},
    {route:'homework/submit',classId:uuid,body:body({answers:{}})},{route:'homework/submit',classId:uuid,body:body({kind:'reading',answers:{'R3-1':5}})},{route:'homework/submit',classId:uuid,body:body({kind:'reading',answers:{'R3-1':1},retry:{'W2-1':'x'}})},
    {route:'homework/submit',classId:uuid,body:body({retry:{'W3-1':'같은 주'}})},{route:'homework/submit',classId:uuid,body:body({week:1,retry:{'W0-1':'x'}})},{route:'homework/submit',classId:uuid,body:body({contentVersion:'v2'})},
    {route:'homework/submit',classId:uuid,body:body({expectedRevision:-1})},{route:'homework/submit',classId:uuid,body:body({accountId:'other'})},{route:'homework/submit',classId:uuid,body:body({answers:{'W3-1.1':[['가','나','다','라','마','바']]}})}])
    assert.throws(()=>send(params),{code:'INVALID_REQUEST'},JSON.stringify(params).slice(0,90));
  assert.throws(()=>requestSpec('worldRequest',{route:'homework'},'0.4.2','platform','platform'),{code:'INVALID_REQUEST'});
  // The WORLD page builds the same body (experiences/synk-world-app/homework-client.mjs homeworkSubmission).
  const client=fs.readFileSync(path.join(__dirname,'../../experiences/synk-world-app/homework-client.mjs'),'utf8');
  assert.match(client,/return \{classId,week,kind,requestId,expectedRevision,contentVersion,answers:normalized/);
});
test('native WORLD bounds nested JSON and rejects prototype pollution before transport',()=>{
  const body={id:uuid,type:'test',expectedRevision:0,payload:{}};
  for(const payload of [JSON.parse('{"__proto__":{"polluted":true}}'),{x:Infinity},{x:'x'.repeat(524288)},new Date()])assert.throws(()=>send({route:'town/command',body:{...body,payload}}),{code:'INVALID_REQUEST'});
  const cycle={};cycle.self=cycle;assert.throws(()=>send({route:'town/command',body:{...body,payload:cycle}}),{code:'INVALID_REQUEST'});
  const deep={};let cur=deep;for(let i=0;i<25;i++)cur=cur.x={};assert.throws(()=>send({route:'town/command',body:{...body,payload:deep}}),{code:'INVALID_REQUEST'});
  assert.equal({}.polluted,undefined);
});
test('native homework keys bind a single class, week and kind without arbitrary payloads',()=>{
 const body={classId:uuid,week:1,kind:'reading'};
 assert.deepEqual(send({route:'homework/key',classId:uuid,body}),{path:'synk-classroom/api/world/homework/key?classId='+uuid,method:'POST',body});
 for(const params of [{route:'homework/key',body},{route:'homework/key',classId:uuid,body:{...body,week:0}},{route:'homework/key',classId:uuid,body:{...body,week:9}},{route:'homework/key',classId:uuid,body:{...body,kind:'all'}},{route:'homework/key',classId:uuid,body:{...body,accountId:'other'}},{route:'homework/key',classId:uuid,body:{...body,classId:'22222222-2222-4222-8222-222222222222'}}])assert.throws(()=>send(params),{code:'INVALID_REQUEST'});
});
