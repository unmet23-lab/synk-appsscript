import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',key='synk.company.platform-entry.v1';
const source=readFileSync(new URL('./public/synk-id.js',import.meta.url),'utf8'),appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const initialize=appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()'));
function fixture({fragment=`synk-platform-account=${id}`,saved,status={},me={user:null},storageFailure=false}={}){
  const calls=[],moves=[],values=new Map(saved?[[key,JSON.stringify(saved)]]:[]),state={user:null,csrf:'',authMode:'login'},location={href:'https://workspace.synk.im/?tab=messenger'+(fragment?'#'+fragment:''),pathname:'/',search:'?tab=messenger',hash:fragment?'#'+fragment:'',assign:value=>moves.push(value)};
  let loads=0,polls=0;
  const context=vm.createContext({window:{},document:{addEventListener(){},querySelector:()=>null},location,history:{replaceState(_state,_title,href){location.href=new URL(href,location.href).href;location.hash=new URL(location.href).hash;}},URL,URLSearchParams,state,sessionStorage:{getItem:k=>values.get(k)||null,setItem(k,value){if(storageFailure)throw Error('storage blocked');values.set(k,value);}},
    fetch:async(path,options)=>{calls.push({path,body:options.body?JSON.parse(options.body):null,hash:location.hash});return {ok:true,json:async()=>path.endsWith('/status')?{enabled:true,browserEnabled:true,session:'company',...status}:{authorizationUrl:'https://identity.example.invalid/authorize'}};},
    api:async path=>{calls.push({path});return me;},isDemoMode:()=>false,selectWorkspaceView(){},loadState:async()=>{loads++;},reportTabs:()=>false,startPolling:()=>{polls++;},renderAuth(){},app:{innerHTML:''},escape:String,button:()=>'',notify(){}});
  vm.runInContext(source+'\n'+initialize,context);
  return {calls,moves,values,state,location,context,run:code=>vm.runInContext(code,context),counts:()=>({loads,polls})};
}
test('web Platform expectation is removed before HTTP and starts existing OAuth without loading company data',async()=>{
  const f=fixture({me:{user:{id:'old-company'}}});await f.run('initialize()');
  assert.deepEqual(f.calls.map(v=>v.path),['/api/me','/api/synk-id/status','/api/synk-id/start']);
  assert.deepEqual(f.calls[2].body,{action:'login',expectedAccountId:id});assert.equal(f.calls[1].hash,'');
  assert.equal(f.state.user,null);assert.equal(f.counts().loads,0);assert.equal(f.moves.length,1);
  assert.deepEqual(JSON.parse(f.values.get(key)),{version:1,accountId:id,attempted:true});
});
test('callback restores expectation and admits only a server verified matching company identity',async()=>{
  const f=fixture({fragment:'',saved:{version:1,accountId:id,attempted:true},status:{session:'synk',synkUserId:id},me:{user:{id:'linked-company'},synkUserId:id,csrfToken:'synthetic-csrf'}});
  await f.run('initialize()');assert.equal(f.state.user.id,'linked-company');assert.deepEqual(f.counts(),{loads:1,polls:1});assert.equal(f.moves.length,0);
});
test('an existing different company session after a failed callback stays hidden and never loops OAuth',async()=>{
  const f=fixture({fragment:'',saved:{version:1,accountId:id,attempted:true},status:{session:'synk',synkUserId:other},me:{user:{id:'other-company'},synkUserId:other}});
  await f.run('initialize()');await f.run('initialize()');assert.equal(f.state.user,null);assert.equal(f.counts().loads,0);assert.equal(f.moves.length,0);assert.ok(f.calls.every(v=>v.path==='/api/me'));
});
test('a different restored session cannot install identity or load company data',async()=>{
  const f=fixture({fragment:'',saved:{version:1,accountId:id,attempted:true},status:{session:'synk',synkUserId:id},me:{user:{id:'other-company'},synkUserId:other}});await f.run('initialize()');
  assert.equal(f.state.user,null);assert.equal(f.state.csrf,'');assert.equal(f.counts().loads,0);assert.equal(f.moves.length,0);
});
test('invalid and duplicate expectations fail before any HTTP or identity assignment',async()=>{
  for(const fragment of ['synk-platform-account=invalid',`synk-platform-account=${id}&synk-platform-account=${other}`]){const f=fixture({fragment});await f.run('initialize()');assert.equal(f.calls.length,0);assert.equal(f.state.user,null);assert.equal(f.location.hash,'');}
});
test('failure to persist an automatic attempt cannot begin OAuth',async()=>{
  const f=fixture({storageFailure:true});await f.run('initialize()');await f.run('initialize()');assert.equal(f.calls.length,0);assert.equal(f.moves.length,0);assert.match(f.location.hash,/synk-platform-account/);
});
test('invalid fragment stays blocked after a reload and a verified restored session needs no raw status shortcut',async()=>{
  const f=fixture({fragment:'synk-platform-account=invalid'});await f.run('initialize()');
  const restored=fixture({fragment:'',saved:JSON.parse(f.values.get(key)),me:{user:{id:'other-company'},synkUserId:other}});await restored.run('initialize()');assert.equal(restored.calls.length,0);
  const valid=fixture({fragment:'',saved:{version:1,accountId:id,attempted:true},status:{session:'synk',synkUserId:null},me:{user:{id:'linked-company'},synkUserId:id}});await valid.run('initialize()');assert.equal(valid.state.user.id,'linked-company');assert.deepEqual(valid.calls.map(v=>v.path),['/api/me']);
});
test('ordinary company visits preserve the current password-session startup',async()=>{
  const f=fixture({fragment:'',me:{user:{id:'legacy'},csrfToken:'csrf'}});await f.run('initialize()');assert.equal(f.state.user.id,'legacy');assert.deepEqual(f.calls.map(v=>v.path),['/api/me']);assert.equal(f.counts().loads,1);
});
