import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';

const directory=new URL('../../../docs/마케팅/온라인마케팅지도/engagement/company/public/',import.meta.url),source=readFileSync(new URL('device-notifications.js',directory),'utf8'),workerSource=readFileSync(new URL('notification-sw.js',directory),'utf8');
const publicKey=Buffer.from([4,...Array(64).fill(1)]).toString('base64url');
// existing: this browser is already subscribed and the server lists it with these extra fields.
function fixture({permission='default',configured=true,ios=false,installed=false,secure=true,existing=null}={}){
  const calls=[],nodes=new Map();let dialog,registration=null,subscription=null,registers=0,prompts=0,subscribes=0,unsubscribes=0,serverRows=[];
  const make=()=>({value:'',disabled:false,isConnected:true,innerHTML:'',open:false,listeners:{},dataset:{},focus(){},setAttribute(){},addEventListener(name,callback){this.listeners[name]=callback;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},querySelector(selector){if(selector.startsWith('#')&&!this.innerHTML.includes(`id="${selector.slice(1)}"`))return null;if(!nodes.has(selector))nodes.set(selector,make());return nodes.get(selector);},querySelectorAll(selector){if(selector!=='[data-remove-device]')return [];return [...this.innerHTML.matchAll(/data-remove-device="([^"]+)"/g)].map(match=>({...make(),dataset:{removeDevice:match[1]}}));}});
  const endpoint='https://push.example.test/fake-only',sub={endpoint,toJSON:()=>({endpoint,keys:{p256dh:'fake-public-key',auth:'fake-auth-key'}}),unsubscribe:async()=>{unsubscribes++;subscription=null;return true;}};
  const registered=()=>({active:{scriptURL:'https://company.test/notification-sw.js'},pushManager:{getSubscription:async()=>subscription,subscribe:async options=>{subscribes++;assert.equal(options.userVisibleOnly,true);subscription=sub;return sub;}}});
  const sw={getRegistration:async()=>registration,register:async()=>{registers++;registration=registered();return registration;}};
  if(existing){registration=registered();subscription=sub;serverRows=[{id:'sub1',label:'회사 폰',endpointHash:createHash('sha256').update(endpoint).digest('hex'),enabled:true,currentSession:true,...existing}];}
  const Notification={permission,requestPermission:async()=>{prompts++;Notification.permission='granted';return 'granted';}};
  const context=vm.createContext({window:{isSecureContext:secure,PushManager:class{},Notification,matchMedia:()=>({matches:installed})},navigator:{userAgent:ios?'iPhone Safari':'Chrome Windows',platform:ios?'iPhone':'Win32',maxTouchPoints:ios?1:0,serviceWorker:sw},Notification,location:{origin:'https://company.test'},document:{activeElement:null,body:{append:value=>{dialog=value;}},createElement:make},crypto:webcrypto,TextEncoder,Uint8Array,URL,setTimeout,clearTimeout,atob:value=>Buffer.from(value,'base64').toString('binary'),fetch:async(path,options)=>{
    calls.push({path,options});if(context.intercept){const result=await context.intercept(path,options);if(result)return result;}
    let data;if(path==='/api/me')data={user:{id:context.userId||'u1'}};else if(options.method==='DELETE'){serverRows=[];data={ok:true};}else if(options.method==='POST'){const endpointHash=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint))).toString('hex');serverRows=[{id:'sub1',label:'내 기기',endpointHash,enabled:true,currentSession:true}];data={subscription:serverRows[0]};}else data={configured,publicKey:configured?publicKey:null,subscriptions:serverRows,defaultEnabled:false};return{ok:true,json:async()=>data};
  }});
  vm.runInContext(source,context);const api=context.window.SynkDeviceNotifications,ready=api.syncIdentity({userId:'u1',csrf:'csrf1',generation:1});
  return {api,context,calls,nodes,ready,get dialog(){return dialog;},get registers(){return registers;},get prompts(){return prompts;},get subscribes(){return subscribes;},get unsubscribes(){return unsubscribes;},get sw(){return sw;},get subscription(){return subscription;}};
}

test('opening device settings reads status without registering, subscribing or requesting permission',async()=>{
  const f=fixture();await f.api.open();assert.equal(f.registers,0);assert.equal(f.prompts,0);assert.equal(f.subscribes,0);assert.ok(f.dialog.innerHTML.includes('이 기기에서 켜기'));assert.ok(f.dialog.innerHTML.includes('자동으로 읽음 처리하지'));
});
test('iPhone browser installation, denied permission and unsupported server each avoid the opt-in prompt',async()=>{
  for(const options of [{ios:true},{permission:'denied'},{configured:false},{secure:false}]){const f=fixture(options);await f.api.open();assert.ok(!f.dialog.innerHTML.includes('id="enable-device-notifications"'));assert.equal(f.prompts,0);assert.equal(f.registers,0);}
  const f=fixture({ios:true,installed:true});await f.api.open();assert.ok(f.dialog.innerHTML.includes('id="enable-device-notifications"'));
});
test('explicit enable requests permission, registers the worker and posts subscription only to the company origin',async()=>{
  const f=fixture();await f.api.open();await f.nodes.get('#enable-device-notifications').listeners.click();assert.equal(f.prompts,1);assert.equal(f.registers,1);assert.equal(f.subscribes,1);const post=f.calls.find(call=>call.options.method==='POST');assert.equal(post.path,'/api/device-notifications');assert.equal(post.options.headers['X-CSRF-Token'],'csrf1');assert.ok(f.dialog.innerHTML.includes('이 기기에서 켜져 있어요'));assert.ok(f.calls.every(call=>call.path.startsWith('/')));
});
test('failed subscription persistence rolls back the newly created browser subscription',async()=>{
  const f=fixture();await f.api.open();f.context.intercept=async(_path,options)=>options.method==='POST'?{ok:false,status:503,json:async()=>({error:'등록 실패'})}:null;await f.nodes.get('#enable-device-notifications').listeners.click();assert.equal(f.unsubscribes,1);assert.equal(f.subscription,null);assert.ok(f.dialog.innerHTML.includes('등록 실패'));assert.ok(!f.dialog.innerHTML.includes('이 기기에서 켜져 있어요'));
});
test('failed server unsubscribe does not clear the browser subscription or claim removal',async()=>{
  const f=fixture();await f.api.open();await f.nodes.get('#enable-device-notifications').listeners.click();f.context.intercept=async(_path,options)=>options.method==='DELETE'?{ok:false,status:503,json:async()=>({error:'해제 실패'})}:null;
  await f.dialog.querySelectorAll('[data-remove-device]')[0]?.onclick?.(); // handlers are on the rendered controls, so logout exercises the same persisted delete guard.
  const result=await f.api.beforeLogout();assert.equal(result.ok,false);assert.equal(f.unsubscribes,0);assert.ok(f.subscription);
});
test('an account switch during permission grant prevents registration and stale subscription POST',async()=>{
  const f=fixture();await f.api.open();let finish;f.context.Notification.requestPermission=()=>new Promise(resolve=>{finish=resolve;});const enabling=f.nodes.get('#enable-device-notifications').listeners.click();f.api.syncIdentity({userId:'u2',csrf:'csrf2',generation:2});f.context.userId='u2';finish('granted');await enabling;assert.equal(f.registers,0);assert.equal(f.calls.filter(call=>call.options.method==='POST').length,0);assert.equal(f.dialog.open,false);
});
test('old servers return a safe unavailable status without permission or worker side effects',async()=>{
  const f=fixture();f.context.intercept=async path=>path==='/api/device-notifications'?{ok:false,status:404,json:async()=>({error:'없는 기능'})}:null;await f.api.open();assert.ok(f.dialog.innerHTML.includes('아직 준비되지'));assert.equal(f.prompts,0);assert.equal(f.registers,0);
});
test('worker messages require exact origin, message type and current registered worker identity',async()=>{
  const f=fixture();await f.api.open();await f.nodes.get('#enable-device-notifications').listeners.click();const registration=await f.sw.getRegistration();assert.equal(await f.api.isTrustedWorkerMessage({origin:'https://company.test',source:registration.active,data:{type:'synk:open-notifications'}}),true);assert.equal(await f.api.isTrustedWorkerMessage({origin:'https://outside.test',source:registration.active,data:{type:'synk:open-notifications'}}),false);assert.equal(await f.api.isTrustedWorkerMessage({origin:'https://company.test',source:{},data:{type:'synk:open-notifications'}}),false);
});
function workerFixture(windows=[]){
  const listeners={},shown=[],opened=[],posted=[];const self={location:{origin:'https://company.test'},addEventListener:(event,handler)=>listeners[event]=handler,skipWaiting:async()=>{},registration:{showNotification:async(...args)=>shown.push(args)},clients:{claim:async()=>{},matchAll:async()=>windows,openWindow:async url=>opened.push(url)}};vm.runInNewContext(workerSource,{self,URL});return{listeners,shown,opened,posted};
}
test('push workers show generic text even for empty or malicious payloads and never install a data cache',async()=>{
  const f=workerFixture();let work;f.listeners.push({data:{json:()=>({body:'PRIVATE CUSTOMER',url:'https://outside.test'})},waitUntil:value=>work=value});await work;assert.equal(f.shown[0][1].body,'확인할 새 업무가 있어요');assert.ok(!JSON.stringify(f.shown).includes('PRIVATE'));assert.equal(f.listeners.fetch,undefined);f.listeners.push({data:null,waitUntil:value=>work=value});await work;assert.equal(f.shown.length,2);
});
test('push click focuses only a same-origin company window or opens a fixed inbox URL without marking read',async()=>{
  const messages=[];let focused=0,work;const f=workerFixture([{url:'https://outside.test/',focus:async()=>assert.fail('outside focus')},{url:'https://company.test/pulse/',focus:async()=>assert.fail('customer lounge focus')},{url:'https://company.test/?tab=workroom',focus:async()=>focused++,postMessage:value=>messages.push(value)}]);f.listeners.notificationclick({notification:{close(){}},waitUntil:value=>work=value});await work;assert.equal(focused,1);assert.deepEqual(JSON.parse(JSON.stringify(messages)),[{type:'synk:open-notifications'}]);assert.equal(f.opened.length,0);
  const empty=workerFixture();empty.listeners.notificationclick({notification:{close(){}},waitUntil:value=>work=value});await work;assert.deepEqual(empty.opened,['/?tab=messenger&panel=notifications']);
});
test('a call marker rings with its own tag and renotify while every lock-screen field stays fixed',async()=>{
  const f=workerFixture();let work;const push=data=>{f.listeners.push({data,waitUntil:value=>work=value});return work;};
  await push({json:()=>({kind:'call'})});await push({json:()=>({kind:'call',body:'PRIVATE CALLER',title:'고객 이름',icon:'https://outside.test/x.png',tag:'other'})});
  for(const data of [null,{json:()=>({kind:'Call'})},{json:()=>({kind:['call']})},{json:()=>'call'},{json:()=>null},{json:()=>{throw new SyntaxError('not json');}}])await push(data);
  // Notification options are built in the worker's own realm; compare them as plain data.
  const shown=JSON.parse(JSON.stringify(f.shown.map(([title,options])=>({title,...options}))));
  const fixed={title:'SYNK',body:'확인할 새 업무가 있어요',icon:'/messenger-icon.png',badge:'/messenger-icon.png'};
  const call={...fixed,tag:'synk-call-invitations',renotify:true,vibrate:[300,150,300,150,300],data:{kind:'synk-call-invitations'}},work_={...fixed,tag:'synk-work-notifications',renotify:false,data:{kind:'synk-work-notifications'}};
  assert.deepEqual(shown,[call,call,work_,work_,work_,work_,work_,work_]);
});
test('a device subscribed before the server kept keys sends the same subscription once, with no prompt or new subscription',async()=>{
  const f=fixture({existing:{callAlerts:false}});await f.ready;
  const posts=f.calls.filter(call=>call.options.method==='POST');assert.equal(posts.length,1);
  assert.equal(posts[0].path,'/api/device-notifications');assert.equal(posts[0].options.headers['X-CSRF-Token'],'csrf1');
  // keysOnly: the server adds keys to this login's switched-on row and creates nothing if it is gone meanwhile.
  assert.deepEqual(JSON.parse(posts[0].options.body),{subscription:{endpoint:'https://push.example.test/fake-only',keys:{p256dh:'fake-public-key',auth:'fake-auth-key'}},label:'회사 폰',keysOnly:true});
  assert.equal(f.registers,0);assert.equal(f.subscribes,0);assert.equal(f.prompts,0);assert.equal(f.unsubscribes,0);
  // The same identity arriving again (the page re-assigns it often) sends nothing more.
  const before=f.calls.length;assert.equal(f.api.syncIdentity({userId:'u1',csrf:'csrf1',generation:1}),undefined);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.calls.length,before);
});
test('devices with keys, another login, a switched-off or unlisted row or an older server send nothing; unsubscribed browsers ask nothing',async()=>{
  for(const existing of [{callAlerts:true},{callAlerts:false,currentSession:false},{callAlerts:false,enabled:false},{callAlerts:false,endpointHash:'another-browser'},{}]){
    const f=fixture({existing});await f.ready;
    assert.equal(f.calls.filter(call=>call.options.method==='POST').length,0,JSON.stringify(existing));assert.equal(f.calls.filter(call=>call.path==='/api/device-notifications').length,1);
  }
  const none=fixture();await none.ready;assert.deepEqual(none.calls,[]);
  // A login change before the check, or while its GET is still out, drops it before anything is sent for the old account.
  const switching=fixture({existing:{callAlerts:false}});switching.api.syncIdentity({userId:null,csrf:'',generation:2});await switching.ready;
  assert.deepEqual(switching.calls,[]);
  const midway=fixture({existing:{callAlerts:false}});midway.context.intercept=async(path,options)=>{if(path==='/api/device-notifications'&&options.method==='GET')midway.api.syncIdentity({userId:null,csrf:'',generation:2});return null;};
  await midway.ready;assert.deepEqual(midway.calls.map(call=>call.options.method),['GET']);
});
