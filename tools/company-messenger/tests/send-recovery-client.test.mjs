import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(storage=new Map()){
  const nodes=new Map(),requests=[],toasts=[],xhrs=[];
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',innerHTML:'',textContent:'',disabled:false,style:{},dataset:{},scrollHeight:100,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},close(){},insertAdjacentHTML(){},querySelector:get,querySelectorAll:()=>[]});return nodes.get(selector);};
  class XHR{constructor(){this.upload={};this.headers={};xhrs.push(this);}open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}send(file){this.sent=file;}abort(){this.aborted=true;this.onabort?.();}}
  const context=vm.createContext({document:{body:get('body'),querySelector:get,querySelectorAll:()=>[],addEventListener(){},hidden:false},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/messenger/',origin:'http://localhost'},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID},XMLHttpRequest:XHR,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimeout(){},clearTimeout(){}});
  const run=code=>vm.runInContext(code,context);run(source);context.originalApi=run('api');
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.recordToast=(message)=>toasts.push(message);
  run("Object.assign(state,{user:{id:'u1',name:'유호',role:'owner'},integrated:{canWrite:true,csrfToken:'test-csrf'},sendRecovery:{messages:true,uploads:true},channels:[{id:'c1',kind:'self',name:'메모',memberIds:['u1'],canPost:true},{id:'c2',kind:'self',name:'다른 방',memberIds:['u1'],canPost:true}],channelId:'c1',chatCategory:'personal',members:[{id:'u1',name:'유호'}]});api=request;toast=recordToast;renderMessages=()=>{};refreshChannels=async()=>{};markRead=async()=>{};renderReplyContext=()=>{};renderComposeExtras=()=>{};closeMentionPicker=()=>{};");
  get('#composer-input').value='보낼 원문';run('updateSend()');
  return{context,run,get,nodes,storage,requests,toasts,xhrs,state:run('state')};
}
function clockFixture(f){let now=0,next=0;const timers=new Map();f.context.setTimeout=(callback,delay)=>{timers.set(++next,{at:now+delay,callback});return next;};f.context.clearTimeout=key=>timers.delete(key);return{advance(ms){const end=now+ms;while(true){const due=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].callback();}now=end;},get size(){return timers.size;}};}
function focusFixture(f,kind){
  const document=f.context.document,wrap=f.get(kind==='send'?'#send-recovery':'#upload-queue'),prefix=kind==='send'?'data-send-':'data-upload-';let content=wrap.innerHTML,writes=0,controls=[];
  const originalQuery=document.querySelector;document.querySelector=selector=>selector.startsWith('['+prefix)?controls.find(button=>button.matches(selector))||null:originalQuery(selector);
  wrap.contains=button=>controls.includes(button);wrap.querySelector=selector=>controls.find(button=>button.matches(selector))||null;
  Object.defineProperty(wrap,'innerHTML',{get:()=>content,set:value=>{writes++;content=value;for(const button of controls){button.isConnected=false;if(document.activeElement===button)document.activeElement=document.body;}controls=[];for(const match of value.matchAll(/<button\b([^>]*)>/g)){const attrs=match[1],entry=attrs.match(/\b(data-(?:send|upload)-[a-z]+)(?:="([^"]*)")?/);if(!entry)continue;const attribute=entry[1],dataValue=entry[2]||'',dataName=attribute.slice(5).replace(/-([a-z])/g,(_,char)=>char.toUpperCase());const button={disabled:/\bdisabled\b/.test(attrs),isConnected:true,dataset:{[dataName]:dataValue},hasAttribute:name=>name===attribute,matches:selector=>selector===`[${attribute}]`||selector===`[${attribute}="${dataValue}"]`,focus(){document.activeElement=this;f.state.transferFocusRevision++;}};controls.push(button);}}});
  delete wrap.dataset.recoveryContent;f.run(kind==='send'?'renderSendRecovery()':'renderQueue()');
  const composer=f.get('#composer-input');composer.focus=()=>{document.activeElement=composer;f.state.transferFocusRevision++;};
  return{focus(selector){const button=wrap.querySelector(selector);assert.ok(button,selector);button.focus();return button;},active:()=>document.activeElement,get writes(){return writes;},wrap,composer};
}
const send=f=>f.run('sendMessage({preventDefault(){}})');
const response=(body='보낼 원문')=>({message:{id:'10',body,channelId:'c1',user:{id:'u1'}}});
const fail=(request,status,code)=>request.reject(Object.assign(new Error('fixture failure'),{status,code}));
const file={name:'자료.txt',size:12,privateBytes:'never serialize'};
const uploaded={id:'f1',name:'자료.txt',size:12,channelId:'c1',uploaderId:'u1'};

test('response loss preserves the original send key across reload and explicit retry sends only the original payload',async()=>{
  const f=fixture(),sending=send(f);const first=f.requests[0].options.body,key=first.clientMessageId;assert.match(key,/^[0-9a-f-]{36}$/);fail(f.requests[0]);await sending;
  f.get('#composer-input').value='새로 고친 초안';f.run('saveDraft();updateSend()');assert.equal(f.get('#send-message').disabled,true);
  const restored=fixture(f.storage);restored.get('#composer-input').value='새로 고친 초안';restored.run('updateSend()');assert.equal(restored.requests.length,0,'restoring state never sends automatically');
  const retry=restored.run('retrySendAttempt()');assert.deepEqual(JSON.parse(JSON.stringify(restored.requests[0].options.body)),JSON.parse(JSON.stringify(first)));restored.requests[0].resolve(response());await retry;
  assert.equal(restored.get('#composer-input').value,'새로 고친 초안');assert.equal(restored.run('sendAttempt()'),null);assert.equal(restored.state.messages.length,1);
});

test('a status lookup never posts and no receipt keeps the original key for a delayed server commit',async()=>{
  const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const key=f.run('sendAttempt().clientMessageId');
  const check=f.run('checkSendAttempt()');assert.equal(f.requests[1].options.method,undefined);assert.equal(f.requests[1].path,`/api/channels/c1/messages/requests/${key}`);fail(f.requests[1],404);await check;
  assert.equal(f.run('sendAttempt().clientMessageId'),key);assert.equal(f.get('#send-message').disabled,true);assert.match(f.get('#send-recovery').innerHTML,/아직 전송 완료/);
});

test('completed lookup clears unchanged draft and attachments while preserving a modified reply and compose extras',async()=>{
  const f=fixture();f.context.file=uploaded;f.run("state.queues.set('c1',[{key:'upload',status:'done',file}]);state.replyTarget={id:'r1'};state.workspaceLink={title:'자료',url:'http://localhost/#view=content'};state.mentionIds=['u1'];updateSend()");
  f.get('#composer-input').value='@유호 원문';const sending=send(f);fail(f.requests[0]);await sending;
  f.run("state.replyTarget={id:'r2'};state.workspaceLink={title:'새 자료',url:'http://localhost/#view=studio'};state.ackRequired=true");f.get('#composer-input').value='@유호 새 초안';
  const check=f.run('checkSendAttempt()');f.requests[1].resolve(response());await check;
  assert.equal(f.get('#composer-input').value,'@유호 새 초안');assert.equal(f.state.replyTarget.id,'r2');assert.equal(f.state.workspaceLink.title,'새 자료');assert.equal(f.state.ackRequired,true);assert.deepEqual(Array.from(f.state.mentionIds),['u1']);assert.equal(f.run('queue().length'),0);
  f.get('#composer-input').value='다음 메시지';f.run('updateSend()');const next=send(f);f.requests[2].resolve(response('다음 메시지'));await next;assert.equal(f.get('#composer-input').value,'');assert.equal(f.state.replyTarget,null);
});

test('late send completion updates the original room without clearing another room draft or reply',async()=>{
  const f=fixture(),sending=send(f);f.run("state.channelId='c2';state.replyTarget={id:'other'};state.messages=[]");f.get('#composer-input').value='다른 방의 초안';f.requests[0].resolve(response());await sending;
  assert.equal(f.get('#composer-input').value,'다른 방의 초안');assert.equal(f.state.replyTarget.id,'other');assert.equal(f.state.messages.length,0);assert.equal(f.storage.has('synk-messenger:send:u1:c1'),false);assert.equal(f.storage.has('synk-messenger:draft:u1:c1'),false);
});

test('logout and same-user re-login isolate late send callbacks without discarding recoverable request state',async()=>{
  for(const userId of ['u1','u2']){const f=fixture(),sending=send(f);f.context.newUser=userId;f.run("resetTransfers();state.user={id:newUser};state.messages=[]");f.get('#composer-input').value='새 로그인 초안';f.requests[0].resolve(response());await sending;
    assert.equal(f.get('#composer-input').value,'새 로그인 초안');assert.equal(f.state.messages.length,0);assert.equal(f.storage.has('synk-messenger:send:u1:c1'),true);assert.equal(f.storage.has(`synk-messenger:send:${userId}:c1`),userId==='u1');}
});

test('concurrent retry clicks issue one request and deleted messages are never sent again',async()=>{
  const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const retry=f.run('retrySendAttempt()');await f.run('retrySendAttempt()');await f.run('checkSendAttempt()');assert.equal(f.requests.length,2);fail(f.requests[1],409,'MESSAGE_DELETED');await retry;assert.equal(f.run('sendAttempt()'),null);assert.equal(f.get('#composer-input').value,'');assert.match(f.toasts.at(-1),/삭제됐어요/);
});

test('storage failure blocks a new send before network while leaving the draft intact',async()=>{
  const f=fixture();f.run("localStorage.setItem=()=>{throw new Error('quota')}");await send(f);assert.equal(f.requests.length,0);assert.equal(f.get('#composer-input').value,'보낼 원문');assert.match(f.toasts.at(-1),/저장 공간/);
});

test('upload failure retries the same in-memory File and upload key, without serializing file bytes',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');const first=f.xhrs[0],key=first.headers['X-Upload-Id'];assert.equal(first.sent,file);first.onerror();assert.equal(f.run('queue()[0].rawFile'),file);
  assert.ok(!Array.from(f.storage.values()).join('').includes('privateBytes'));f.context.uploadKey=key;const retry=f.run('retryUpload(uploadKey)');await f.run('retryUpload(uploadKey)');assert.equal(f.requests.length,1);assert.equal(f.xhrs.length,1);fail(f.requests[0],404);await retry;
  assert.equal(f.xhrs.length,2);assert.equal(f.xhrs[1].sent,file);assert.equal(f.xhrs[1].headers['X-Upload-Id'],key);f.xhrs[1].status=200;f.xhrs[1].responseText=JSON.stringify({file:uploaded});f.xhrs[1].onload();assert.equal(f.run('queue()[0].status'),'done');assert.equal(f.run('queue()[0].rawFile'),null);
});

test('upload response loss is recovered by status lookup without uploading bytes a second time',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');f.xhrs[0].onerror();const retry=f.run('retryUpload(queue()[0].key)');f.requests[0].resolve({status:'uploaded',file:uploaded});await retry;assert.equal(f.xhrs.length,1);assert.equal(f.run('queue()[0].file.id'),'f1');assert.equal(f.run('queue()[0].rawFile'),null);
});

test('reload preserves failed upload metadata and asks for reselection when the original File is unavailable',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');f.xhrs[0].onerror();const restored=fixture(f.storage);restored.run('renderQueue()');assert.equal(restored.run('queue()[0].rawFile'),null);assert.match(restored.get('#upload-queue').innerHTML,/업로드 확인/);
  const checking=restored.run('retryUpload(queue()[0].key)');fail(restored.requests[0],404);await checking;assert.equal(restored.xhrs.length,0);assert.match(restored.get('#upload-queue').innerHTML,/파일을 다시 골라/);
});

test('cancelled or revoked uploads cannot reappear after a late callback, and account switches do not delete another account file',async()=>{
  for(const mode of ['cancel','revoke','logout']){const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');const xhr=f.xhrs[0];
    if(mode==='cancel'){const removing=f.run('removeUpload(queue()[0].key)');assert.equal(f.requests[0].options.method,'DELETE');f.requests[0].resolve({status:'cancelled'});await removing;}
    if(mode==='revoke'){f.run("state.unavailableChannels.add('c1');state.queues.delete('c1')");}
    if(mode==='logout'){f.run("resetTransfers();state.user={id:'u2'}");}
    xhr.status=200;xhr.responseText=JSON.stringify({file:uploaded});xhr.onload();assert.equal(f.run('queue().length'),0);if(mode==='logout')assert.equal(f.requests.length,0);if(mode==='cancel')assert.equal(f.requests.length,1);}
});

test('late callbacks from an earlier upload retry do not change the active retry',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');const old=f.xhrs[0];old.onerror();const retry=f.run('retryUpload(queue()[0].key)');fail(f.requests[0],404);await retry;old.status=201;old.responseText=JSON.stringify({file:uploaded});old.onload();assert.equal(f.run('queue()[0].status'),'uploading');assert.equal(f.run('queue()[0].file'),undefined);
});

test('safe cancellation requires a server tombstone before allowing the modified draft to send',async()=>{
  const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const original=f.requests[0].options.body.clientMessageId;f.get('#composer-input').value='원문 대신 보낼 초안';
  const cancelling=f.run('cancelSendAttempt()');assert.equal(f.requests[1].options.method,'DELETE');assert.ok(f.requests[1].path.endsWith(original));assert.equal(f.get('#send-message').disabled,true);f.requests[1].resolve({status:'cancelled'});await cancelling;
  assert.equal(f.run('sendAttempt()'),null);assert.equal(f.get('#composer-input').value,'원문 대신 보낼 초안');assert.equal(f.get('#send-message').disabled,false);
  const next=send(f);assert.notEqual(f.requests[2].options.body.clientMessageId,original);assert.equal(f.requests[2].options.body.body,'원문 대신 보낼 초안');f.requests[2].resolve(response());await next;
});

test('cancelling an already committed message reports the existing message and never deletes it',async()=>{
  const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;f.get('#composer-input').value='수정 초안';const cancelling=f.run('cancelSendAttempt()');f.requests[1].resolve({status:'sent',...response()});await cancelling;assert.equal(f.state.messages.length,1);assert.equal(f.get('#composer-input').value,'수정 초안');assert.match(f.toasts.at(-1),/이미 전송/);assert.equal(f.requests.length,2);
});

test('uncertain cancellation and replay validation failures retain the original send key',async()=>{
  for(const status of [400,403,404]){const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const key=f.run('sendAttempt().clientMessageId');const retry=f.run('retrySendAttempt()');fail(f.requests[1],status);await retry;assert.equal(f.run('sendAttempt().clientMessageId'),key);const cancelling=f.run('cancelSendAttempt()');fail(f.requests[2]);await cancelling;assert.equal(f.run('sendAttempt().clientMessageId'),key);assert.equal(f.get('#send-message').disabled,true);}
});

test('an upload cancellation with a lost response remains recoverable after reload and releases the raw file',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');const key=f.run('queue()[0].key');const cancelling=f.run('removeUpload(queue()[0].key)');assert.equal(f.run('queue()[0].rawFile'),null);assert.equal(f.xhrs[0].aborted,true);fail(f.requests[0]);await cancelling;assert.equal(f.run('queue()[0].cancelPending'),true);assert.match(f.get('#upload-queue').innerHTML,/취소 확인/);assert.equal(f.get('#send-message').disabled,false,'cancelled files do not block unrelated text');
  const restored=fixture(f.storage);assert.equal(restored.run('queue()[0].cancelPending'),true);restored.context.key=key;const retry=restored.run('removeUpload(key)');assert.equal(restored.requests[0].options.method,'DELETE');restored.requests[0].resolve({status:'cancelled'});await retry;assert.equal(restored.run('queue().length'),0);assert.equal(restored.xhrs.length,0);
});

test('a cancelled upload callback cannot change a different account or revive pending cleanup',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');const xhr=f.xhrs[0],cancel=f.run('removeUpload(queue()[0].key)');f.run("resetTransfers();state.user={id:'u2'}");f.requests[0].resolve({status:'cancelled'});await cancel;xhr.status=200;xhr.responseText=JSON.stringify({file:uploaded});xhr.onload();assert.equal(f.state.queues.size,0);assert.equal(f.requests.length,1);assert.equal(f.storage.has('synk-messenger:attachments:u2:c1'),false);
});

test('a hanging request times out without forgetting its send key or automatically resending',async()=>{
  const f=fixture();let timeout,cleared=false;f.context.AbortController=AbortController;f.context.setTimeout=(callback,delay)=>{assert.equal(delay,30000);timeout=callback;return 1;};f.context.clearTimeout=()=>{cleared=true;};f.context.fetch=(path,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));f.run('api=originalApi');const sending=send(f);const key=f.run('sendAttempt().clientMessageId');timeout();await sending;
  assert.equal(cleared,true);assert.equal(f.run('sendAttempt().clientMessageId'),key);assert.equal(f.run('sendAttempt().busy'),false);assert.equal(f.requests.length,0);assert.match(f.get('#send-recovery').innerHTML,/같은 내용 다시 보내기/);
});

test('an old session HTTP 401 cannot log out a different current account',async()=>{
  const f=fixture();let finish;f.context.fetch=()=>new Promise(resolve=>finish=resolve);f.run('api=originalApi');const sending=send(f);f.run("resetTransfers();state.user={id:'u2'}");finish({ok:false,status:401,json:async()=>({error:'old session'})});await sending;assert.equal(f.state.user.id,'u2');assert.equal(f.state.messages.length,0);assert.equal(f.storage.has('synk-messenger:send:u1:c1'),true);
});

test('owned sent status without restricted content resolves post, lookup and cancellation while preserving modified drafts',async()=>{
  for(const action of ['retrySendAttempt()','checkSendAttempt()','cancelSendAttempt()']){
    const f=fixture();f.context.file=uploaded;f.run("state.queues.set('c1',[{key:'legacy-upload',status:'done',file}]);state.replyTarget={id:'1'};state.workspaceLink={title:'기획',url:'http://localhost/#view=content'};updateSend()");const sending=send(f);fail(f.requests[0]);await sending;
    f.get('#composer-input').value='공유 내용 대신 새로 작성한 초안';f.run("state.replyTarget={id:'2'};state.workspaceLink={title:'새 기획',url:'http://localhost/#view=studio'}");const completing=f.run(action);f.requests[1].resolve({status:'sent',unavailable:true,...(action==='retrySendAttempt()'?{replayed:true}:{})});await completing;
    assert.equal(f.run('sendAttempt()'),null);assert.equal(f.run('queue().length'),0);assert.equal(f.get('#composer-input').value,'공유 내용 대신 새로 작성한 초안');assert.equal(f.state.replyTarget.id,'2');assert.equal(f.state.workspaceLink.title,'새 기획');assert.equal(f.get('#send-message').disabled,false);assert.equal(f.state.messages.length,0);assert.equal(f.requests.length,2);assert.match(f.toasts.at(-1),/전송은 완료됐어요/);
  }
});

test('a completed legacy attachment is removed by its verified file id even without an upload receipt',async()=>{
  const f=fixture();f.storage.set('synk-messenger:attachments:u1:c1',JSON.stringify([{key:'legacy-key',file:uploaded}]));f.state.queues.clear();assert.equal(f.run('queue()[0].file.id'),'f1');const deleting=f.run('removeUpload(queue()[0].key)');assert.equal(f.requests[0].path,'/api/files/f1');assert.equal(f.requests[0].options.method,'DELETE');f.requests[0].resolve({ok:true});await deleting;assert.equal(f.run('queue().length'),0);assert.equal(f.storage.has('synk-messenger:attachments:u1:c1'),false);
});

test('known attachment deletion keeps the file id through response loss and reload before its absence is confirmed',async()=>{
  const f=fixture();f.context.file=uploaded;f.run("state.queues.set('c1',[{key:'legacy-key',status:'done',file}]);persistQueue()");const deleting=f.run('removeUpload(queue()[0].key)');fail(f.requests[0]);await deleting;assert.equal(f.run('queue()[0].cancelPending'),true);
  const restored=fixture(f.storage);assert.equal(restored.run('queue()[0].file.id'),'f1');assert.equal(restored.run('queue()[0].cancelPending'),true);assert.equal(restored.run('queue()[0].cancelled'),true);const retry=restored.run('removeUpload(queue()[0].key)');assert.equal(restored.requests[0].path,'/api/files/f1');fail(restored.requests[0],404,'UPLOAD_DELETED');await retry;assert.equal(restored.run('queue().length'),0);assert.equal(restored.storage.has('synk-messenger:attachments:u1:c1'),false);
});

test('generic channel denial cannot be mistaken for confirmed deletion of a known attachment',async()=>{
  const f=fixture();f.context.file=uploaded;f.run("state.queues.set('c1',[{key:'legacy-key',status:'done',file}])");const deleting=f.run('removeUpload(queue()[0].key)');fail(f.requests[0],404);await deleting;assert.equal(f.run('queue()[0].cancelPending'),true);assert.equal(f.run('queue()[0].file.id'),'f1');assert.equal(f.requests.length,1);
});

test('a late send preserves original room text and newly added attachments after navigating away',async()=>{
  for(const uploadedAlready of [true,false]){
    const f=fixture(),sending=send(f);f.context.newUpload=uploadedAlready?{key:'new-upload',status:'done',file:{...uploaded,id:'f-new'}}:{key:'new-upload',status:'uploading',name:file.name,size:file.size,rawFile:file};
    f.run("queue().push(newUpload);persistQueue();saveDraft();state.channelId='c2';state.replyTarget={id:'other-reply'}");f.get('#composer-input').value='다른 방 초안';f.requests[0].resolve(response());await sending;
    assert.equal(f.storage.get('synk-messenger:draft:u1:c1'),'보낼 원문');assert.equal(f.state.queues.get('c1').length,1);assert.equal(f.state.queues.get('c1')[0].key,'new-upload');assert.equal(f.get('#composer-input').value,'다른 방 초안');assert.equal(f.state.replyTarget.id,'other-reply');assert.equal(f.run("sendAttempt('c1')"),null);
  }
});

test('a new upload still in progress counts as an edited draft while an earlier message completes',async()=>{
  const f=fixture(),sending=send(f);f.context.inputFile=file;f.run('addFiles([inputFile])');f.requests[0].resolve(response());await sending;assert.equal(f.get('#composer-input').value,'보낼 원문');assert.equal(f.run('queue().length'),1);assert.equal(f.run('queue()[0].status'),'uploading');assert.equal(f.run('queue()[0].rawFile'),file);assert.equal(f.run('sendAttempt()'),null);
});

test('recovery repaint restores only the focused enabled action and leaves external composer focus alone',async()=>{
  const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const wrap=f.get('#send-recovery'),document=f.context.document;
  for(const action of ['data-send-check','data-send-retry','data-send-cancel']){
    const old={hasAttribute:name=>name===action},replacement={disabled:false,focus(options){assert.equal(options.preventScroll,true);document.activeElement=this;}};wrap.contains=node=>node===old;wrap.querySelector=selector=>selector===`[${action}]`?replacement:null;document.activeElement=old;f.run('renderSendRecovery()');assert.equal(document.activeElement,replacement);
    replacement.disabled=true;document.activeElement=old;f.run('renderSendRecovery()');assert.equal(document.activeElement,old,'a disabled action must not receive restored focus');
    document.activeElement=f.get('#composer-input');f.run('renderSendRecovery()');assert.equal(document.activeElement,f.get('#composer-input'));
  }
});

test('upload progress repaint restores the same file action without focusing a disabled or different file button',()=>{
  const f=fixture(),wrap=f.get('#upload-queue'),document=f.context.document;f.context.inputFile=file;f.run('addFiles([inputFile])');const key=f.run('queue()[0].key');
  for(const [action,attribute]of [['uploadRetry','data-upload-retry'],['uploadRemove','data-upload-remove']]){
    const old={dataset:{[action]:key}},replacement={disabled:false,focus(options){assert.equal(options.preventScroll,true);document.activeElement=this;}};wrap.contains=node=>node===old;wrap.querySelector=selector=>selector===`[${attribute}="${key}"]`?replacement:null;document.activeElement=old;f.run('renderQueue()');assert.equal(document.activeElement,replacement);
    replacement.disabled=true;document.activeElement=old;f.run('renderQueue()');assert.equal(document.activeElement,old);
    wrap.querySelector=()=>null;document.activeElement=old;f.run('renderQueue()');assert.equal(document.activeElement,old,'a missing action cannot transfer focus to another file');
    document.activeElement=f.get('#composer-input');f.run('renderQueue()');assert.equal(document.activeElement,f.get('#composer-input'));
  }
});

test('progress keeps a slow upload alive beyond two minutes while a genuine stall permits manual recovery',()=>{
  const f=fixture(),clock=clockFixture(f);f.context.inputFile=file;f.run('addFiles([inputFile])');const xhr=f.xhrs[0];assert.equal(xhr.timeout,0);
  for(let step=1;step<=5;step++){clock.advance(60000);xhr.upload.onprogress({loaded:step,total:10,lengthComputable:true});assert.notEqual(xhr.aborted,true);assert.equal(f.run('queue()[0].status'),'uploading');}
  clock.advance(119999);assert.notEqual(xhr.aborted,true);clock.advance(1);assert.equal(xhr.aborted,true);assert.equal(f.run('queue()[0].status'),'error');assert.equal(f.run('queue()[0].rawFile'),file);assert.equal(f.xhrs.length,1);assert.equal(f.requests.length,0);assert.match(f.get('#upload-queue').innerHTML,/업로드가 멈췄어요/);
});

test('completed body upload gets five minutes for server processing and cancellation clears the watchdog',async()=>{
  const f=fixture(),clock=clockFixture(f);f.context.inputFile=file;f.run('addFiles([inputFile])');const xhr=f.xhrs[0];xhr.upload.onload();clock.advance(299999);assert.notEqual(xhr.aborted,true);xhr.status=201;xhr.responseText=JSON.stringify({file:uploaded});xhr.onload();assert.equal(clock.size,0);assert.equal(f.run('queue()[0].status'),'done');
  f.run('addFiles([inputFile])');const next=f.xhrs[1],cancel=f.run('removeUpload(queue()[1].key)');assert.equal(next.aborted,true);assert.equal(clock.size,0);f.requests[0].resolve({status:'cancelled',cleanupPending:true});await cancel;assert.equal(f.run('queue().length'),1);
});

test('message recovery restores action focus after failure, composer after success, and respects user focus moves',async()=>{
  for(const [action,selector]of [['checkSendAttempt()','[data-send-check]'],['retrySendAttempt()','[data-send-retry]'],['cancelSendAttempt()','[data-send-cancel]']]){
    const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const focus=focusFixture(f,'send');focus.focus(selector);const request=f.run(action);assert.equal(focus.active(),f.context.document.body);fail(f.requests[1]);await request;assert.equal(focus.active(),focus.wrap.querySelector(selector));
    focus.focus(selector);const success=f.run(action);f.requests[2].resolve(action==='cancelSendAttempt()'?{status:'cancelled'}:response());await success;assert.equal(focus.active(),focus.composer);
    f.get('#composer-input').value='다음 초안';f.run('updateSend()');const again=send(f);fail(f.requests[3]);await again;focus.focus(selector);const moved=f.run(action);focus.composer.focus();fail(f.requests[4]);await moved;assert.equal(focus.active(),focus.composer);
  }
});

test('upload retry retains focus through receipt lookup and XHR completion, while cancel restores composer',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');f.xhrs[0].onerror();const key=f.run('queue()[0].key'),retrySelector=`[data-upload-retry="${key}"]`,removeSelector=`[data-upload-remove="${key}"]`,focus=focusFixture(f,'upload');focus.focus(retrySelector);
  const lookup=f.run('retryUpload(queue()[0].key)');fail(f.requests[0],404);await lookup;assert.equal(focus.active(),f.context.document.body);f.xhrs[1].onerror();assert.equal(focus.active(),focus.wrap.querySelector(retrySelector));
  focus.focus(retrySelector);const next=f.run('retryUpload(queue()[0].key)');fail(f.requests[1],404);await next;f.xhrs[2].status=200;f.xhrs[2].responseText=JSON.stringify({file:uploaded});f.xhrs[2].onload();assert.equal(focus.active(),focus.composer);
  focus.focus(removeSelector);const deleting=f.run('removeUpload(queue()[0].key)');fail(f.requests[2]);await deleting;assert.equal(focus.active(),focus.wrap.querySelector(removeSelector));focus.focus(removeSelector);const complete=f.run('removeUpload(queue()[0].key)');f.requests[3].resolve({ok:true});await complete;assert.equal(focus.active(),focus.composer);
});

test('unchanged recovery content avoids repeated live-region writes, and identical later attempts render again',async()=>{
  const f=fixture(),sending=send(f);fail(f.requests[0]);await sending;const focus=focusFixture(f,'send');f.get('#composer-input').value='수정 첫 글자';f.run('updateSend()');const writes=focus.writes;for(const suffix of ['가','가나','가나다']){f.get('#composer-input').value=suffix;f.run('updateSend()');}assert.equal(focus.writes,writes);
  const cancel=f.run('cancelSendAttempt()');f.requests[1].resolve({status:'cancelled'});await cancel;assert.equal(focus.wrap.innerHTML,'');f.get('#composer-input').value='보낼 원문';f.run('updateSend()');const repeated=send(f);fail(f.requests[2]);await repeated;assert.match(focus.wrap.innerHTML,/전송 결과를 확인해 주세요/);assert.ok(focus.wrap.querySelector('[data-send-check]'));
});

test('uncertain upload cancellation releases its slot without claiming remote deletion or sending again',async()=>{
  const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');f.xhrs[0].onerror();const lookup=f.run('retryUpload(queue()[0].key)');fail(f.requests[0],409,'UPLOAD_UNCERTAIN');await lookup;assert.match(f.get('#upload-queue').innerHTML,/첨부를 취소하고 다시 골라/);
  const deleting=f.run('removeUpload(queue()[0].key)');f.requests[1].resolve({status:'cancelled',cleanupPending:true});await deleting;assert.equal(f.run('queue().length'),0);assert.equal(f.xhrs.length,1);assert.equal(f.requests.length,2);assert.ok(!f.toasts.some(message=>/Drive.*삭제.*완료|원격.*삭제.*완료/.test(message)));
});

test('another tab consuming a known file removes only the stale local chip',async()=>{
  const f=fixture();f.context.file=uploaded;f.run("state.queues.set('c1',[{key:'uploaded-key',status:'done',file}])");const deleting=f.run('removeUpload(queue()[0].key)');assert.equal(f.requests[0].path,'/api/files/f1');fail(f.requests[0],409,'UPLOAD_CONSUMED');await deleting;assert.equal(f.run('queue().length'),0);assert.equal(f.requests.length,1);assert.match(f.toasts.at(-1),/대화에 그대로/);
});

test('upload completion never takes focus back after the user chooses the composer or leaves the frame',async()=>{
  for(const moved of ['composer','frame']){const f=fixture();f.context.inputFile=file;f.run('addFiles([inputFile])');f.xhrs[0].onerror();const key=f.run('queue()[0].key'),focus=focusFixture(f,'upload');focus.focus(`[data-upload-retry="${key}"]`);const retry=f.run('retryUpload(queue()[0].key)');fail(f.requests[0],404);await retry;if(moved==='composer')focus.composer.focus();else f.state.transferFocusRevision++;f.xhrs[1].onerror();assert.equal(focus.active(),moved==='composer'?focus.composer:f.context.document.body);}
});
