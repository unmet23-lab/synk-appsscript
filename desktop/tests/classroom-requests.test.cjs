'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {requestSpec}=require('../src/account-requests.cjs');
const spec=(params,product='world')=>requestSpec('classroom',params,'0.4.0',product);
test('classroom IPC maps every known action to a fixed endpoint and class query',()=>{
  const entries={classes:['classes',false],teacherOverview:['teacher/overview',false],care:['teacher/care',false],careSave:['teacher/care',true],townMembership:['world/town/membership',false],townSharing:['world/town/sharing',true],townActivity:['world/town/activity',true],workspace:['workspace',false],account:['world/account',false],student:['student',false],practice:['world/practice',false],practiceSubmit:['world/practice',true],submit:['submissions',true],sharing:['world/sharing',true],startRun:['world/runs/start',true],stopRun:['world/runs/stop',true],learningGet:['world/learning',false],learningPost:['world/learning',true],townRead:['world/town',false],townCommand:['world/town/command',true],assignments:['assignments',true],assignmentUpdate:['assignments/update',true],assignmentCancel:['assignments/cancel',true],observations:['observations',true]};
  for(const product of ['world','platform'])for(const [operation,[route,post]]of Object.entries(entries)){
    const unscoped=['classes','teacherOverview'].includes(operation),params={operation,...(unscoped?{}:{classId:'class-one'}),...(post?{body:{}}:{}),...(operation==='learningGet'?{query:{after:7,revision:2}}:{})};
    const value=spec(params,product),url=new URL(value.path,'https://synthetic.invalid/functions/v1/');
    assert.equal(url.pathname,'/functions/v1/synk-classroom/api/'+route);assert.equal(url.searchParams.get('classId'),unscoped?null:'class-one');assert.equal(value.body!==undefined,post);
    if(operation==='learningGet'){assert.equal(url.searchParams.get('after'),'7');assert.equal(url.searchParams.get('revision'),'2');}
  }
});
test('classroom rejects unknown routes, raw URLs, headers, method injection and foreign products',()=>{
  for(const params of [{operation:'https://evil.invalid'},{operation:'../synk-account'},{operation:'constructor'},{operation:'classes',url:'https://evil.invalid'},{operation:'classes',headers:{Authorization:'wrong'}},{operation:'classes',method:'POST'}])assert.throws(()=>spec(params),{code:'INVALID_REQUEST'});
  for(const product of ['messenger','teacher',undefined])assert.throws(()=>requestSpec('classroom',{operation:'classes'},'0.4.0',product),{code:'INVALID_REQUEST'});
});
test('class scope is required for reads and writes and cannot disagree with a model body',()=>{
  for(const classId of [undefined,null,'','../class','class&role=teacher','x'.repeat(129),2])assert.throws(()=>spec({operation:'student',classId}),{code:'INVALID_REQUEST'});
  assert.throws(()=>spec({operation:'classes',classId:'unexpected'}),{code:'INVALID_REQUEST'});
  assert.throws(()=>spec({operation:'teacherOverview',classId:'unexpected'}),{code:'INVALID_REQUEST'});
  assert.throws(()=>spec({operation:'assignments',classId:'a',body:{classId:'b'}}),{code:'INVALID_REQUEST'});
  assert.deepEqual(spec({operation:'assignments',classId:'a',body:{classId:'a',title:'숙제'}}),{path:'synk-classroom/api/assignments?classId=a',body:{classId:'a',title:'숙제'}});
});
test('only learning read accepts the two nonnegative integer query fields',()=>{
  for(const query of [undefined,{},[],{after:0,revision:-1},{after:'0',revision:1},{after:0,revision:1,url:'bad'},{after:Number.MAX_SAFE_INTEGER+1,revision:1}])assert.throws(()=>spec({operation:'learningGet',classId:'a',query}),{code:'INVALID_REQUEST'});
  assert.throws(()=>spec({operation:'student',classId:'a',query:{}}),{code:'INVALID_REQUEST'});
  assert.throws(()=>spec({operation:'student',classId:'a',body:{}}),{code:'INVALID_REQUEST'});
  assert.throws(()=>spec({operation:'submit',classId:'a'}),{code:'INVALID_REQUEST'});
});
test('classroom JSON keeps the run identifier, copies values and caps bytes',()=>{
  const body={revision:3,events:[{id:'event-one',detail:{correct:true}}],runId:'run-one'};
  const result=spec({operation:'learningPost',classId:'a',body});body.events[0].detail.correct=false;
  assert.equal(result.body.runId,'run-one');assert.equal(result.body.events[0].detail.correct,true);
  const exact={text:'x'.repeat(524288-11)};assert.equal(Buffer.byteLength(JSON.stringify(exact)),524288);assert.doesNotThrow(()=>spec({operation:'observations',classId:'a',body:exact}));
  assert.throws(()=>spec({operation:'observations',classId:'a',body:{text:exact.text+'x'}}),{code:'INVALID_REQUEST'});
});
test('classroom rejects values that JSON would drop or rewrite and recursive objects',()=>{
  const cycle={};cycle.child=cycle;let deep={};for(let i=0;i<33;i++)deep={child:deep};
  for(const body of [[],null,{value:undefined},{value:NaN},{value:Infinity},{value:1n},{value:()=>1},{value:new Date()},cycle,deep,JSON.parse('{"__proto__":{"polluted":true}}')])assert.throws(()=>spec({operation:'observations',classId:'a',body}),{code:'INVALID_REQUEST'});
});
