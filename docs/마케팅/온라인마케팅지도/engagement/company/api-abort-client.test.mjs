import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const apiSource=source.slice(source.indexOf('async function api('),source.indexOf('\n// Track every identity'));
function fixture({recovery,fetchImpl}={}){
  const calls=[];let cleared=0;
  const context=vm.createContext({
    state:{user:{id:'one'},csrf:'test-csrf'},companyAuthSnapshot:()=>({generation:1,userId:'one'}),companyAuthCurrent:()=>true,
    companyAuthChanged:()=>new Error('changed'),ensureNativeSynkCompanySession:()=>recovery,
    demoApiUrl:path=>path,isDemoMode:()=>false,clearCompanySessionView:()=>{cleared++;},
    fetch:async(path,options)=>{calls.push({path,options});return fetchImpl?fetchImpl(path,options):{ok:true,json:async()=>({ok:true})};}
  });
  vm.runInContext(apiSource+'\nthis.callApi=api;',context);
  return {call:context.callApi,calls,get cleared(){return cleared;}};
}

test('optional cancellation aborts the selected request without changing ordinary API calls',async()=>{
  const f=fixture();await f.call('/normal',{});
  assert.equal(f.calls[0].options.method,'POST');assert.equal(f.calls[0].options.headers['X-CSRF-Token'],'test-csrf');
  assert.equal(Object.hasOwn(f.calls[0].options,'signal'),false);
  const controller=new AbortController();controller.abort(new Error('cancelled'));
  await assert.rejects(f.call('/status',undefined,'GET',{signal:controller.signal}),/cancelled/);
  assert.equal(f.calls.length,1);
});

test('aborting a waiting consumer leaves the shared session recovery usable for another request',async()=>{
  let finish;const recovery=new Promise(resolve=>{finish=resolve;});
  const f=fixture({recovery}),controller=new AbortController();
  const abandoned=f.call('/status',undefined,'GET',{signal:controller.signal});
  const other=f.call('/normal');controller.abort(new Error('status timeout'));
  await assert.rejects(abandoned,/status timeout/);assert.equal(f.calls.length,0);
  finish();await other;assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/normal');assert.equal(f.cleared,0);
});

test('the status request signal reaches fetch and cancels a stalled response body without clearing the session',async()=>{
  const controller=new AbortController();let bodyStarted;
  const started=new Promise(resolve=>{bodyStarted=resolve;});
  const f=fixture({fetchImpl:async(_path,{signal})=>{
    assert.equal(signal,controller.signal);
    return {ok:true,json:()=>{bodyStarted();return new Promise(()=>{});}};
  }});
  const pending=f.call('/status',undefined,'GET',{signal:controller.signal});await started;
  controller.abort(new Error('body timeout'));await assert.rejects(pending,/body timeout/);
  assert.equal(f.cleared,0);
});
