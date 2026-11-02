import test from 'node:test';
import assert from 'node:assert/strict';
import {pageReady} from '../experiences/synk-world-app/qa/page-ready.mjs';

test('a slow functional navigation finishes within the test budget and a later abort cannot close it',async()=>{
 const control=new AbortController();let closed=0;
 const response={ok:()=>true,status:()=>200};
 const page={goto:async(_url,options)=>{
  assert.equal(options.waitUntil,'domcontentloaded');assert.equal(options.timeout,0);
  await new Promise(resolve=>setTimeout(resolve,30));return response;
 },close:async()=>{closed++;}};
 assert.equal(await pageReady(page,'http://127.0.0.1/',{signal:control.signal}),response);
 control.abort();assert.equal(closed,0);
});

test('a test deadline closes a stuck navigation and preserves the original abort reason',async()=>{
 const control=new AbortController(),reason=Error('test deadline');let closed=0;
 const page={goto:()=>new Promise(()=>{}),close:async()=>{closed++;}};
 const pending=pageReady(page,'http://127.0.0.1/',{signal:control.signal});
 control.abort(reason);await assert.rejects(pending,error=>error===reason);assert.equal(closed,1);
 await assert.rejects(pageReady(page,'http://127.0.0.1/',{signal:control.signal}),error=>error===reason);
 assert.equal(closed,1);
});

test('HTTP failures and browser navigation failures remain failures, without retrying',async()=>{
 const control=new AbortController();let attempts=0;
 const page={goto:async()=>{attempts++;return {ok:()=>false,status:()=>503};},close:async()=>assert.fail('no abort')};
 await assert.rejects(pageReady(page,'http://127.0.0.1/',{signal:control.signal}),/HTTP 503/);
 const failure=Error('connection refused');page.goto=async()=>{attempts++;throw failure;};
 await assert.rejects(pageReady(page,'http://127.0.0.1/',{signal:control.signal}),error=>error===failure);
 assert.equal(attempts,2);
 await assert.rejects(pageReady(page,'http://127.0.0.1/',{}),/t.signal/);
});
