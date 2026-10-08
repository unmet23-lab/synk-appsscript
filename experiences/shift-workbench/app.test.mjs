import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../../',import.meta.url);
function fixture(){
  const nodes=new Map(),storage=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false,value:'',checked:false,handlers:new Map(),
      addEventListener(type,handler){this.handlers.set(type,handler);},focus(){},scrollIntoView(){},showModal(){},close(){}});
    return nodes.get(id);
  };
  const context=vm.createContext({console,Date,URL,Blob,setTimeout,clearTimeout,
    document:{getElementById:node,querySelector:node,querySelectorAll:()=>[],documentElement:{dataset:{}}},window:{scrollTo(){}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    FormData:class {constructor(target){this.target=target;}get(key){return this.target.fields[key];}}});
  for(const file of ['engine.js','domain.js','temper-outcomes.js','personalization.js'])vm.runInContext(readFileSync(new URL('atlas/'+file,root),'utf8'),context);
  const model=readFileSync(new URL('./model.mjs',import.meta.url),'utf8');
  const names=[...model.matchAll(/export (?:const|function) (\w+)/g)].map(match=>match[1]);
  const upgrade=readFileSync(new URL('./storage-upgrade.mjs',import.meta.url),'utf8').replaceAll('export ','');
  vm.runInContext(`(()=>{${upgrade}\n${model.replace(/^import [^\n]+\n/,'').replaceAll('export ','')}globalThis.practiceModel={${names.join(',')}};})()`,context);
  const app=readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace(/^import \{([^\n]+)\} from '\.\/model\.mjs';/,(_line,imports)=>`const {${imports.replace('escapeHTML as esc','escapeHTML:esc')}}=practiceModel;`);
  vm.runInContext(app,context);
  const evaluate=code=>vm.runInContext(code,context);
  const emit=(id,type,extra={})=>node(id).handlers.get(type)?.({preventDefault(){},currentTarget:node(id),...extra});
  const start=()=>{node('setup-form').fields={task:'meeting',goal:'clarity',minutes:'5',support:'step'};emit('setup-form','submit');};
  return {node,storage,evaluate,emit,start,get state(){return evaluate('state');}};
}

const savedWork=`({kind:'saved-work',scope:{...practiceModel.SCOPE},sourceGeneration:0,task:'meeting',at:'2026-10-02T00:00:00.000Z',
  prompt:'<img src=x onerror=alert(1)> 이전 요청문',draft:'</pre><script>evil()</script> 이전 초안',status:'in-progress'})`;

test('saved writing renders without review scores and escapes both request and draft',()=>{
  const f=fixture();f.evaluate(`state.history=[${savedWork},{...${savedWork},status:'completed'}]`);
  f.emit('history-open','click');
  const html=f.node('history-list').innerHTML;
  assert.equal((html.match(/추천·평가에 사용하지 않음/g)||[]).length,2);
  assert.match(html,/작성 중이던 내용/);assert.match(html,/완료한 실습의 작성물/);
  assert.match(html,/내 요청문/);assert.match(html,/직접 작성한 내용/);
  assert.match(html,/&lt;img src=x/);assert.match(html,/&lt;\/pre&gt;&lt;script&gt;/);
  assert.doesNotMatch(html,/<img src=x|<script>|undefined|NaN|첫 근거 확인|다음 확인/);
  assert.equal(f.node('history-count').textContent,'2');
});

test('saved writing is not described as current recommendation evidence, while normal reviews keep their display',()=>{
  const f=fixture();f.start();f.evaluate(`state.history=[${savedWork}];renderPractice()`);
  assert.match(f.node('practice').innerHTML,/현재 추천에 사용할 이전 검토·피드백은 없어요/);
  assert.doesNotMatch(f.node('practice').innerHTML,/이전 검토·피드백을 사용해/);
  f.evaluate(`state.history.push({task:'research',at:'2026-10-03T00:00:00.000Z',correct:1,total:3,assisted:true,missed:['numbers'],draft:'일반 완료 결과'})`);
  f.emit('history-open','click');const html=f.node('history-list').innerHTML;
  assert.match(html,/첫 근거 확인 1\/3 · 안내 사용/);assert.match(html,/다음 확인: 숫자·기한 대조/);
  assert.match(html,/일반 완료 결과/);assert.match(html,/추천·평가에 사용하지 않음/);
});

test('save off keeps writing in this window and reset removes both saved work and persistent data',()=>{
  const f=fixture();f.node('save-choice').checked=true;f.start();
  f.evaluate(`state.history=[${savedWork}];save();restart()`);
  assert.equal(f.storage.size,1);
  f.node('save-choice').checked=false;f.start();
  assert.equal(f.storage.size,0);assert.equal(f.state.save,false);assert.equal(f.state.history.length,1);
  f.node('save-choice').checked=true;f.evaluate('state.save=true;save()');assert.equal(f.storage.size,1);
  f.emit('reset-confirm','click');
  assert.equal(f.storage.size,0);assert.equal(f.state.history.length,0);assert.equal(f.state.run,null);assert.equal(f.state.profile,null);
});
