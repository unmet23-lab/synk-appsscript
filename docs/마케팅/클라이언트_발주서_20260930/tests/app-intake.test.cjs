'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../src/core.js');
const H=require('../src/handoff.js');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const fieldsSource=fs.readFileSync(path.join(__dirname,'../src/client-fields.js'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const received={ok:true,status:'received',submissionId:'PULSE-receipt-1',fileCount:0,receivedAt:'2026-10-01T00:00:00.000Z'};

function setup({send=async()=>received,config=async()=>({enabled:true}),online=true}={}){
  const nodes=new Map(),handlers={},calls=[],configCalls=[],timers=new Map();
  let timerId=0;
  function node(key){
    if(nodes.has(key))return nodes.get(key);
    const item={dataset:{},style:{},disabled:false,hidden:false,checked:false,isConnected:true,textContent:'',_html:'',
      classList:{add(){},remove(){}},querySelectorAll:()=>[],addEventListener(){},focus(){},scrollIntoView(){},showModal(){},close(){},
      get innerHTML(){return this._html;},
      set innerHTML(html){this._html=html;if(key==='#page'){const start=html.indexOf('<section id="delivery-box"');if(start>=0)node('#delivery-box').outerHTML=html.slice(start);}},
      get outerHTML(){return this._html;},
      set outerHTML(html){this._html=html;this.dataset.receiptState=html.match(/data-receipt-state="([^"]+)"/)?.[1];}
    };
    nodes.set(key,item);return item;
  }
  const controls=[node('#contact'),node('#scheduleNotes'),node('#submission-consent'),node('#submit-brief')];
  const initial={version:1,layout:2,step:5,visited:[0,1,2,3,4,5],data:C.sanitize({subject:'시험 브랜드',goal:'purchase',contact:'원래 담당자'})};
  const storage=new Map([['synk-video-brief-v1',JSON.stringify(initial)]]);
  const context=vm.createContext({
    SynkBriefCore:C,SynkBriefHandoff:H,SynkBriefIntake:{available:()=>online,config:()=>{configCalls.push(true);return config();},send:async(...args)=>{calls.push(clone(args[0]));return send(...args);}},
    document:{querySelector:node,getElementById:id=>node('#'+id),querySelectorAll:s=>s.startsWith('#page input')?controls:[],addEventListener:(type,handler)=>{handlers[type]=handler;}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},navigator:{},
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
    addEventListener(){},scrollTo(){},URL:{revokeObjectURL(){}},console
  });
  context.window=context;
  vm.runInContext(fieldsSource,context,{filename:'client-fields.js'});
  // This test-only seam simulates an out-of-band state change while the RPC is pending.
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.__mutateForTest=patch=>Object.assign(data,patch);})();'),context,{filename:'app.js'});
  const click=async(id,dataset={})=>{const button={id,dataset,closest:()=>button};return handlers.click({target:button});};
  const input=(key,value)=>handlers.input({target:{dataset:{field:key},value}});
  const change=(key,value)=>handlers.change({target:{dataset:{field:key},value}});
  async function settle(){await Promise.resolve();await Promise.resolve();}
  async function submit(){await settle();node('#submission-consent').checked=true;await click('submit-brief');}
  return {node,calls,configCalls,controls,context,handlers,click,input,change,submit,settle,storage,html:()=>node('#delivery-box').outerHTML};
}

test('editing received answers immediately marks the changed copy unsent and keeps the previous receipt',async()=>{
  const app=setup();
  await app.submit();
  assert.match(app.html(),/접수가 완료됐어요/);
  assert.doesNotMatch(app.html(),/id="submit-brief"/);
  app.input('contact','변경한 담당자');
  assert.match(app.node('#review-details').innerHTML,/변경한 담당자/);
  assert.match(app.html(),/수정한 내용은 아직 전송되지 않았어요/);
  assert.match(app.html(),/PULSE-receipt-1/);
  assert.match(app.html(),/새 접수 링크를 요청해주세요/);
  assert.doesNotMatch(app.html(),/접수가 완료됐어요|id="submit-brief"|id="submission-consent"/);
  await app.click('submit-brief');
  assert.equal(app.calls.length,1,'a stale submit event must not send a second intake');
});

test('reverting an edit restores the received state without allowing a second submission',async()=>{
  const app=setup();await app.submit();
  app.input('contact','바뀐 담당자');
  app.input('contact','원래 담당자');
  assert.match(app.html(),/접수가 완료됐어요/);
  assert.doesNotMatch(app.html(),/수정한 내용은 아직|id="submit-brief"/);
  assert.equal(app.calls.length,1);
});

test('change events and optional notes also invalidate the displayed receipt',async()=>{
  for(const edit of [app=>app.change('scheduleNotes','10월 20일 공개'),app=>app.handlers.input({target:{dataset:{fieldNote:'budget'},value:'일정에 맞춰 재협의'}})]){
    const app=setup();await app.submit();await edit(app);
    assert.match(app.html(),/수정한 내용은 아직 전송되지 않았어요/);
    assert.doesNotMatch(app.html(),/id="submit-brief"/);
  }
});

test('draft edits before submission preserve the existing consent checkbox',()=>{
  const app=setup(),box=app.node('#delivery-box');
  app.node('#submission-consent').checked=true;
  const original=box.outerHTML;
  app.input('contact','새 담당자');
  assert.equal(box.outerHTML,original);
  assert.equal(app.node('#submission-consent').checked,true);
});

test('input and change events cannot change submitted answers while the RPC is pending',async()=>{
  let finish;const app=setup({send:()=>new Promise(resolve=>{finish=resolve;})});
  const pending=app.submit();
  await app.settle();
  assert(app.controls.every(control=>control.disabled));
  app.input('contact','전송 중 다른 담당자');
  await app.change('scheduleNotes','전송 중 일정');
  finish(received);await pending;
  assert.equal(app.calls[0].data.contact,'원래 담당자');
  assert.equal(app.calls[0].data.scheduleNotes,'');
  assert.match(app.html(),/접수가 완료됐어요/);
  assert.doesNotMatch(app.node('#page').innerHTML,/전송 중 다른 담당자|전송 중 일정/);
  assert(app.controls.every(control=>!control.disabled));
});

test('a late acknowledgement is tied to the sent snapshot, not subsequently changed state',async()=>{
  let finish;const app=setup({send:()=>new Promise(resolve=>{finish=resolve;})});
  const pending=app.submit();
  await app.settle();
  app.context.__mutateForTest({contact:'다른 경로에서 바뀐 담당자'});
  finish(received);await pending;
  assert.equal(app.calls[0].data.contact,'원래 담당자');
  assert.match(app.html(),/수정한 내용은 아직 전송되지 않았어요/);
  assert.match(app.html(),/PULSE-receipt-1/);
  assert.doesNotMatch(app.html(),/접수가 완료됐어요|id="submit-brief"/);
});

test('reset and imported drafts retain the used-link receipt within the current page',async()=>{
  for(const action of ['reset','import']){
    const app=setup();await app.submit();
    if(action==='reset')await app.click('reset-btn');
    else await app.handlers.change({target:{id:'import-file',dataset:{},value:'draft.json',files:[{size:100,text:async()=>JSON.stringify({schema:'synk-video-brief',version:1,data:{subject:'새 발주서',goal:'purchase'}})}]}});
    await app.click('dialog-confirm');
    await app.click('',{goto:'5'});
    assert.match(app.html(),/수정한 내용은 아직 전송되지 않았어요/);
    assert.match(app.html(),/PULSE-receipt-1/);
    assert.doesNotMatch(app.html(),/id="submit-brief"/);
  }
});

test('initial link check blocks sending and enables it only after positive configuration',async()=>{
  let confirm;const app=setup({config:()=>new Promise(resolve=>{confirm=resolve;})});
  assert.equal(app.configCalls.length,1);
  assert.match(app.node('#intake-notice').outerHTML,/접수 링크를 확인하고 있어요/);
  assert.match(app.html(),/id="submit-brief" disabled/);
  app.input('contact','확인 중 작성한 담당자');
  await app.click('submit-brief');
  assert.equal(app.calls.length,0);
  confirm({enabled:true,analysisAutomatic:false});await app.settle();
  assert.match(app.node('#intake-notice').outerHTML,/hidden/);
  assert.match(app.html(),/id="submission-consent"/);
  assert.doesNotMatch(app.html(),/id="submit-brief" disabled|분석 완료/);
  await app.submit();
  assert.equal(app.calls[0].data.contact,'확인 중 작성한 담당자');
});

test('expired, disabled or malformed link configuration cannot send and is visible before the final step',async()=>{
  for(const config of [{enabled:false},{enabled:'true'},null]){
    const app=setup({config:async()=>config});await app.settle();
    assert.match(app.html(),/id="submit-brief" disabled/);
    await app.submit();assert.equal(app.calls.length,0);
    await app.click('',{goto:'0'});
    assert.match(app.node('#page').innerHTML,/링크가 만료됐거나 접수가 중지됐을 수 있어요/);
    assert.match(app.node('#page').innerHTML,/새 접수 링크를 요청해주세요/);
  }
});

test('configuration connection failure offers a guarded retry while keeping the draft',async()=>{
  let attempt=0;const app=setup({config:async()=>{if(++attempt===1)throw Error('network failure');return {enabled:true};}});
  await app.settle();
  assert.match(app.node('#intake-notice').outerHTML,/접수 링크를 확인하지 못했어요/);
  assert.match(app.node('#intake-notice').outerHTML,/id="intake-recheck"/);
  assert.match(app.html(),/id="submit-brief" disabled/);
  app.input('contact','연결 복구 전 작성한 담당자');
  await app.click('intake-recheck');
  assert.equal(app.configCalls.length,2);
  assert.doesNotMatch(app.html(),/id="submit-brief" disabled/);
  await app.submit();assert.equal(app.calls[0].data.contact,'연결 복구 전 작성한 담당자');
});

test('offline copy does not request online config or offer submission',async()=>{
  const app=setup({online:false});await app.settle();
  assert.equal(app.configCalls.length,0);
  assert.match(app.html(),/오프라인 보관본/);
  assert.doesNotMatch(app.html(),/id="submit-brief"|id="submission-consent"/);
  await app.submit();assert.equal(app.calls.length,0);
});
