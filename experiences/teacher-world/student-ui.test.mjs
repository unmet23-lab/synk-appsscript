import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./student.mjs',import.meta.url),'utf8').replace("import {createPersonalizationUI} from './personalization-ui.mjs';",'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
const workspace=(id,{assignments=[]}={})=>({learner:{id,name:id==='demo-nara'?'나래':'보라'},assignments,_token:`token-${id}`});
const task={id:'assignment-1',title:'도서관 읽기',status:'active',completed:false,dueAt:'2026-10-04T12:00:00Z',content:{passage:'도서관은 9시에 문을 엽니다.',questions:[{id:'question-1',prompt:'몇 시에 문을 엽니까?',options:[{id:'a',text:'9시'},{id:'b',text:'10시'}]}]}};

// Runs the real student UI module with controlled fetch ordering; no browser or real student account is involved.
function fixture(){
  const nodes=new Map(),events=new Map(),requests=[],pending=[];let key=0;
  const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',dataset:{},addEventListener(){}});return nodes.get(id);};
  const fetch=(url,options={})=>{
    requests.push({url,options});
    if(url==='/api/workspace')return Promise.resolve(response({classes:[{learners:[{id:'demo-nara',name:'나래'},{id:'demo-bora',name:'보라'}]}]}));
    return new Promise((resolve,reject)=>pending.push({url,resolve,reject}));
  };
  const document={getElementById:element,documentElement:element('html'),addEventListener:(name,callback)=>events.set(name,callback)};
  const context={document,createPersonalizationUI:()=>({set(){},invalidate(){}}),location:{href:'http://127.0.0.1:4290/student?learner=demo-nara'},history:{replaceState(){}},URL,fetch,
    crypto:{randomUUID:()=>`submission-key-${++key}`},FormData:class{constructor(form){this.entries=form.entries||[];}[Symbol.iterator](){return this.entries[Symbol.iterator]();}}};
  vm.createContext(context);vm.runInContext(source,context,{filename:'student.mjs'});
  return {element,requests,pending,
    resolve(url,body,status=200){const index=pending.findIndex(item=>item.url===url);assert.notEqual(index,-1,`pending request ${url}`);pending.splice(index,1)[0].resolve(response(body,status));},
    reject(url){const index=pending.findIndex(item=>item.url===url);assert.notEqual(index,-1);pending.splice(index,1)[0].reject(Error('network error'));},
    select(id){element('learner-select').value=id;element('learner-select').onchange();},
    clickStart(id){events.get('click')({target:{closest:()=>({dataset:{start:id}})}});},
    submitEvent(){return {preventDefault(){},submitter:{disabled:false},target:{entries:[['question-1','a']]}};}
  };
}

test('late success for the prior student cannot replace the newly selected student',async()=>{
  const f=fixture();await tick();f.select('demo-bora');
  assert.match(f.element('student-content').innerHTML,/불러오고/);
  f.resolve('/api/student?learnerId=demo-bora',workspace('demo-bora'));await tick();
  f.resolve('/api/student?learnerId=demo-nara',workspace('demo-nara'));await tick();
  assert.equal(f.element('learner-select').value,'demo-bora');
  assert.match(f.element('student-content').innerHTML,/보라의 과제/);
  assert.doesNotMatch(f.element('student-content').innerHTML,/나래의 과제/);
});

test('late error for the prior student cannot erase the current student screen',async()=>{
  const f=fixture();await tick();f.select('demo-bora');
  f.resolve('/api/student?learnerId=demo-bora',workspace('demo-bora'));await tick();
  f.reject('/api/student?learnerId=demo-nara');await tick();
  assert.match(f.element('student-content').innerHTML,/보라의 과제/);
  assert.equal(f.element('html').dataset.ready,'true');
});

test('a mismatched server learner identity never renders assignments or enables submission',async()=>{
  const f=fixture();await tick();f.resolve('/api/student?learnerId=demo-nara',workspace('demo-bora',{assignments:[task]}));await tick();
  assert.match(f.element('student-content').innerHTML,/선택한 학생의 과제를 확인하지 못했어요/);
  assert.equal(f.element('html').dataset.ready,'error');
  f.clickStart(task.id);assert.equal(f.element('answer-form').onsubmit,undefined);
});

test('a stale form handler cannot submit as the newly selected learner',async()=>{
  const f=fixture();await tick();f.resolve('/api/student?learnerId=demo-nara',workspace('demo-nara',{assignments:[task]}));await tick();
  f.clickStart(task.id);const stale=f.element('answer-form').onsubmit;
  f.select('demo-bora');await stale(f.submitEvent());
  assert.equal(f.requests.filter(row=>row.url==='/api/submissions').length,0);
});

test('in-flight submission keeps its original actor and does not refresh or overwrite a new learner',async()=>{
  const f=fixture();await tick();f.resolve('/api/student?learnerId=demo-nara',workspace('demo-nara',{assignments:[task]}));await tick();
  f.clickStart(task.id);const submitting=f.element('answer-form').onsubmit(f.submitEvent());
  const post=f.requests.find(row=>row.url==='/api/submissions');
  assert.equal(JSON.parse(post.options.body).learnerId,'demo-nara');
  assert.equal(post.options.headers['X-SYNK-Preview-Token'],'token-demo-nara');
  f.select('demo-bora');f.resolve('/api/student?learnerId=demo-bora',workspace('demo-bora'));await tick();
  const before=f.requests.length;f.resolve('/api/submissions',{ok:true});await submitting;
  assert.equal(f.requests.length,before);assert.match(f.element('student-content').innerHTML,/보라의 과제/);
});

test('retry after transport failure preserves submission identity and captured learner',async()=>{
  const f=fixture();await tick();f.resolve('/api/student?learnerId=demo-nara',workspace('demo-nara',{assignments:[task]}));await tick();
  f.clickStart(task.id);const handler=f.element('answer-form').onsubmit,firstEvent=f.submitEvent(),first=handler(firstEvent);
  f.reject('/api/submissions');await first;assert.equal(firstEvent.submitter.disabled,false);
  const second=handler(f.submitEvent());f.reject('/api/submissions');await second;
  const bodies=f.requests.filter(row=>row.url==='/api/submissions').map(row=>JSON.parse(row.options.body));
  assert.equal(bodies.length,2);assert.equal(bodies[0].idempotencyKey,bodies[1].idempotencyKey);assert.equal(bodies[1].learnerId,'demo-nara');
});
