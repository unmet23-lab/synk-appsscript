import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
test('reused formatters retain Korean number output and Seoul calendar boundaries',()=>{
  const numberCode=source.slice(source.indexOf('const validNumber ='),source.indexOf('const deltaText ='));
  const dateCode=source.slice(source.indexOf('const todayFormatter ='),source.indexOf('const safeUrl ='));
  const context=vm.createContext({Intl,Date,Number});vm.runInContext(numberCode+'\n'+dateCode,context);
  for(const input of [0,0.05,1,1234.56,-9876.5,Number.MAX_SAFE_INTEGER,NaN,Infinity,null,'1']){
    const expected=typeof input==='number'&&Number.isFinite(input)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(input):'—';context.input=input;assert.equal(vm.runInContext('number(input)',context),expected);
  }
  assert.equal(vm.runInContext("todayFormatter.format(new Date('2026-10-01T15:00:00Z'))",context),'2026-10-02');
  for(const input of ['',null,'invalid','2026-10-01T15:01:00Z','2026-10-02T01:11:00Z']){
    context.input=input;const date=new Date(input),expected=!input?'수집 전':Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date):'—';assert.equal(vm.runInContext('time(input)',context),expected);
  }
});
test('slow collection polling cannot issue overlapping state or analytics requests and retries after errors',async()=>{
  const pollingCode=source.slice(source.indexOf('async function pollCollectionState()'),source.indexOf('const hypeScopeKey ='));
  let loads=0,reports=0,release,pending=new Promise(resolve=>{release=resolve;});
  const context=vm.createContext({state:{user:{id:'one'}},document:{hidden:false},overlay:{children:[]},busyRuns:()=>true,reportTabs:()=>true,loadState:async()=>{loads++;await pending;},loadReport:async()=>{reports++;}});vm.runInContext('let collectionPollPending=false;\n'+pollingCode,context);
  const first=vm.runInContext('pollCollectionState()',context);await vm.runInContext('pollCollectionState()',context);assert.equal(loads,1);assert.equal(reports,0);
  release();await first;assert.equal(reports,1);await vm.runInContext('pollCollectionState()',context);assert.equal(loads,2);assert.equal(reports,2);
  context.loadState=async()=>{loads++;throw new Error('temporary');};await vm.runInContext('pollCollectionState()',context);await vm.runInContext('pollCollectionState()',context);assert.equal(loads,4);
  context.state.user=null;await vm.runInContext('pollCollectionState()',context);assert.equal(loads,4);context.state.user={id:'one'};context.document.hidden=true;await vm.runInContext('pollCollectionState()',context);assert.equal(loads,4);
});
