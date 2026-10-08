// Real Chromium acceptance against disposable company data. Never uses a live session.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {resolve,join,sep,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {createCompanyApp} from '../../../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';

process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
process.env.SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED='0';
process.env.SYNK_COMPANY_WEB_PUSH_ENABLED='0';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=process.env.MESSENGER_QA_OUTPUT?resolve(process.env.MESSENGER_QA_OUTPUT):resolve(dirname(fileURLToPath(import.meta.url)),'../qa-output/send-recovery-20261009');
const startedAt=new Date().toISOString(),runDirectory=join(output,startedAt.replace(/[:.]/g,'-'));
await mkdir(runDirectory,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'synk-send-recovery-browser-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://localhost:${port}`,originalFetch=globalThis.fetch;
const checks=[],errors=[],externalRequests=[],expectedNetworkFailures=[],wire=[],committedBeforeAbort=[],screenshots=[];
const report={startedAt,checks,errors,externalRequests,expectedNetworkFailures,wire,committedBeforeAbort,screenshots,scope:'disposable company SQLite and local files, synthetic users, actual Chromium iframe; external browser/Node fetch blocked, no live data, push or paid calls'};
globalThis.fetch=async(input,options)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(new URL(url).origin!==base){externalRequests.push({surface:'node',url});throw Error('External request blocked by acceptance fixture');}
  return originalFetch(input,options);
};
let app,browser,context,page,room,admin,member,reviewer,adminCookie,memberCookie,boot,plan=null,deletePlan=null;
const intentionalAborts=new Set();
const expectedReceiptMisses=new Set();
const expectedRecoveryResponses=new Set();
const hangingRoutes=new Set();
const hash=value=>createHash('sha256').update(value).digest('hex');
async function runtimeHashes(){const result={};for(const file of ['../server.mjs','../public/app.js','../public/styles.css','../public/messenger-design.css'])result[file]=hash(await readFile(new URL(file,import.meta.url)));return result;}
const record=label=>{checks.push(label);console.log('PASS '+label);};
const frame=()=>page.frameLocator('#messenger-frame');
const db=()=>app.messenger.db;
const count=(table,where='',args=[])=>Number(db().prepare(`SELECT COUNT(*) AS n FROM ${table}${where?' WHERE '+where:''}`).get(...args).n);
async function request(path,body,method=body===undefined?'GET':'POST',memberRequest=false){
  const response=await fetch(base+path,{method,headers:{Origin:base,Cookie:memberRequest?memberCookie:adminCookie,'X-CSRF-Token':memberRequest?'csrf-member':'csrf-admin',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await response.json();assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;
}
async function selectRoom(target=room){
  const category=['self','dm'].includes(target.kind)?'personal':target.scope==='team'?'team':'all';
  await frame().locator(`[data-chat-category="${category}"]`).click();await frame().locator(`[data-channel="${target.id}"]`).click();
  await frame().locator('#composer-input').waitFor();
}
async function openRoom(target=room){
  await page.goto(base+'/?tab=messenger');await frame().locator('#personal-bell').waitFor();
  await selectRoom(target);
}
function loseNext(kind,stage){
  assert.equal(plan,null);let finish;const done=new Promise(resolve=>finish=resolve);plan={kind,stage,finish};return done;
}
async function settleNoAutomaticSend(label){
  const before=wire.filter(item=>item.method==='POST').length;
  await page.waitForTimeout(400);
  assert.equal(wire.filter(item=>item.method==='POST').length,before,label);record(label);
}
async function keyboardClick(locator){await locator.waitFor();await locator.click({trial:true});await locator.focus();await locator.press('Enter');}
async function expectActionFocus(selector,label){
  await page.waitForFunction(selector=>{const doc=document.querySelector('#messenger-frame').contentDocument,node=doc.querySelector(selector);return node&&!node.disabled&&doc.activeElement===node;},selector,{timeout:3000});
  (report.focusActions??=[]).push({label,selector,preserved:true});
}
async function screenshot(label,width,visibleSelector){
  await page.setViewportSize({width,height:width<700?844:960});
  await page.waitForFunction(expected=>{const f=document.querySelector('#messenger-frame'),rect=f.getBoundingClientRect(),inside=f.contentWindow.innerWidth;return innerWidth===expected&&Math.abs(inside-f.clientWidth)<=1&&Math.abs(rect.width-f.clientWidth)<=1&&(expected>=700||inside===expected);},width,{timeout:10000});
  const geometry=await page.evaluate(()=>{const f=document.querySelector('#messenger-frame'),rect=f.getBoundingClientRect();return{outerWidth:innerWidth,outerScroll:document.documentElement.scrollWidth,frameRectWidth:rect.width,frameClientWidth:f.clientWidth,frameX:rect.x,innerWidth:f.contentWindow.innerWidth,innerScroll:f.contentDocument.documentElement.scrollWidth};});
  if(width<700)assert.equal(geometry.innerWidth,width,`${width}px requires the actual iframe viewport to finish resizing`);
  assert.ok(geometry.outerScroll<=geometry.outerWidth+1,`${width}px company overflow: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.innerScroll<=geometry.innerWidth+1,`${width}px messenger overflow: ${JSON.stringify(geometry)}`);
  const visible=frame().locator(visibleSelector);await visible.scrollIntoViewIfNeeded();assert.ok(await visible.isVisible());
  const text=await visible.innerText();assert.match(text,/전송|확인|다시|실패/);assert.doesNotMatch(text,/undefined|NaN|null/);
  const file=join(runDirectory,`${label}-${width}.png`);await page.screenshot({animations:'disabled',path:file});screenshots.push({file,width,geometry,text});
}
async function mention(text,target='검증 수신'){
  await frame().locator('#composer-input').fill(text+' @'+target);
  await frame().locator('#mention-picker [data-mention-index]').first().waitFor();
  await frame().locator('#composer-input').press('Enter');
  assert.equal(await frame().locator('#mention-picker').isVisible(),false);
}
async function recoveredPanelGone(){await frame().locator('#send-recovery').waitFor({state:'hidden'});}
async function readyToSend(){await page.waitForFunction(()=>!document.querySelector('#messenger-frame').contentDocument.querySelector('#send-message').disabled);}
async function replyTo(message){const row=frame().locator(`#message-${message.id}`);await row.scrollIntoViewIfNeeded();await row.hover();await row.locator('[data-action="reply"]').click();assert.match(await frame().locator('#reply-context').innerText(),new RegExp(message.body));}
async function legacyUpload(name){
  const response=await fetch(base+`/messenger/api/channels/${room.id}/files`,{method:'POST',headers:{Origin:base,Cookie:adminCookie,'X-CSRF-Token':'csrf-admin','Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name)},body:Buffer.from('legacy upload without a request ID'),signal:AbortSignal.timeout(10000)});
  assert.equal(response.status,201);const {file}=await response.json();assert.equal(count('file_upload_requests','file_id=?',[file.id]),0);return file;
}
async function restoreLegacyQueue(file){await page.evaluate(({userId,channelId,file})=>localStorage.setItem(`synk-messenger:attachments:${userId}:${channelId}`,JSON.stringify([{key:'legacy-'+file.id,file}])),{userId:boot.user.id,channelId:room.id,file});await openRoom();await frame().locator('.upload-chip').waitFor();}
try{
  report.sourceBefore=await runtimeHashes();
  app=createCompanyApp({dataDir:directory,host:'127.0.0.1',port,origin:base,schedule:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  app.store.put('teams','qa-recovery-team',{id:'qa-recovery-team',name:'복구 검증팀',active:true});
  admin=app.store.createUser({name:'검증 발신자',email:'recovery-admin@example.test',role:'admin',teamId:'qa-recovery-team'});
  member=app.store.createUser({name:'검증 수신자',email:'recovery-member@example.test',role:'member',teamId:'qa-recovery-team'});
  reviewer=app.store.createUser({name:'검증 검토자',email:'recovery-reviewer@example.test',role:'member',teamId:'qa-recovery-team'});
  const adminSession=app.store.mint('session',admin.id,{csrfToken:'csrf-admin'},60),memberSession=app.store.mint('session',member.id,{csrfToken:'csrf-member'},60);
  adminCookie=`synk_company_session=${adminSession}`;memberCookie=`synk_company_session=${memberSession}`;
  await app.start();boot=await request('/messenger/api/bootstrap');await request('/messenger/api/bootstrap',undefined,'GET',true);
  assert.deepEqual(boot.sendRecovery,{messages:true,uploads:true});room=boot.channels.find(channel=>channel.systemKey==='social');assert.ok(room);
  const originalReply=(await request(`/messenger/api/channels/${room.id}/messages`,{body:'기존 답글의 원문'})).message,newReply=(await request(`/messenger/api/channels/${room.id}/messages`,{body:'수정 초안 답글의 원문'})).message;
  browser=await chromium.launch({executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
  await context.addCookies([{name:'synk_company_session',value:adminSession,url:base,httpOnly:true,sameSite:'Lax'}]);
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==base){externalRequests.push({surface:'browser',url:url.href});return route.abort('blockedbyclient');}
    if(deletePlan&&req.method()==='DELETE'&&url.pathname===`/messenger/api/files/${deletePlan.fileId}`){
      const selected=deletePlan;deletePlan=null;intentionalAborts.add(req.url());const response=await route.fetch();assert.equal(response.status(),200);assert.equal(count('files','id=?',[selected.fileId]),0);assert.equal(count('file_deletion_receipts','file_id=? AND user_id=?',[selected.fileId,boot.user.id]),1);await route.abort('failed');selected.finish();return;
    }
    const match=url.pathname.match(/^\/messenger\/api\/channels\/[^/]+\/(messages|files)$/),kind=match?.[1];
    if(req.method()!=='POST'||!kind)return route.continue();
    const bytes=req.postDataBuffer()||Buffer.alloc(0);wire.push({method:'POST',kind,bodySha256:hash(bytes),bytes:bytes.length,requestId:kind==='files'?req.headers()['x-upload-id']:(()=>{try{return JSON.parse(bytes).clientMessageId;}catch{return null;}})()});
    if(!plan||plan.kind!==kind)return route.continue();
    const selected=plan;plan=null;intentionalAborts.add(req.url());
    if(selected.stage==='before'){
      const receiptId=wire.at(-1).requestId;if(receiptId)expectedReceiptMisses.add(`${req.url()}/requests/${receiptId}`);
      await route.abort('failed');selected.finish({kind,stage:'before'});return;
    }
    if(selected.stage==='hang'){
      await new Promise(resolve=>{const release=async()=>{hangingRoutes.delete(release);await route.abort('failed').catch(()=>{});resolve();};hangingRoutes.add(release);selected.finish({kind,stage:'hang',release});});return;
    }
    if(selected.stage==='continue-later'){
      await new Promise(resolve=>{const release=async()=>{hangingRoutes.delete(release);await route.continue().catch(()=>{});resolve();};hangingRoutes.add(release);selected.finish({kind,stage:'continue-later',release});});return;
    }
    const response=await route.fetch();assert.ok(response.ok(),`Intercepted commit failed: ${response.status()} ${await response.text()}`);const data=await response.json(),entity=data.message||data.file;
    assert.ok(entity?.id);assert.equal(count(kind==='messages'?'messages':'files','id=?',[entity.id]),1);
    if(kind==='messages')assert.equal((await request(`/messenger/api/messages/${entity.id}`)).message.id,entity.id);
    else assert.equal(count('files','id=? AND message_id IS NULL',[entity.id]),1);
    const proof={kind,stage:'after',id:entity.id,httpStatus:response.status(),committedRows:1};committedBeforeAbort.push(proof);
    if(selected.stage==='delay-after'){
      await new Promise(resolve=>{const release=async()=>{hangingRoutes.delete(release);await route.fulfill({response}).catch(()=>{});resolve();};hangingRoutes.add(release);selected.finish({...proof,entity,release});});return;
    }
    await route.abort('failed');selected.finish({...proof,entity});
  });
  page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>errors.push({type:'pageerror',message:error.message}));
  page.on('console',message=>{if(message.type()!=='error')return;const entry={message:message.text(),url:message.location().url};if((intentionalAborts.has(entry.url)&&/ERR_FAILED|ERR_ABORTED|Failed to fetch|NetworkError/.test(entry.message))||(expectedReceiptMisses.has(entry.url)&&/status of 404/.test(entry.message))||(expectedRecoveryResponses.has(entry.url)&&/status of (403|409)/.test(entry.message)))expectedNetworkFailures.push(entry);else errors.push(entry);});
  await openRoom();record('isolated company session loads actual messenger iframe with both recovery capabilities');

  const firstBytes=Buffer.from('저장된 첨부 원본\nresponse-loss-after-commit','utf8');
  const uploadedLost=loseNext('files','after');
  await frame().locator('#file-input').setInputFiles({name:'응답 유실 첨부.txt',mimeType:'text/plain',buffer:firstBytes});
  const firstUpload=await uploadedLost;await frame().locator('[data-upload-retry]').waitFor();
  assert.equal(count('files','name=?',['응답 유실 첨부.txt']),1);await settleNoAutomaticSend('lost upload response does not automatically resend bytes');
  await keyboardClick(frame().locator('[data-upload-retry]'));
  await frame().locator('[data-upload-retry]').waitFor({state:'hidden'});
  await readyToSend();
  assert.equal(count('files','name=?',['응답 유실 첨부.txt']),1);
  assert.equal(wire.filter(item=>item.kind==='files').length,1,'manual result recovery must reuse committed upload');
  await expectActionFocus('#composer-input','upload result check success');
  record('upload committed before response abort is recovered by keyboard without selecting or uploading another file');

  await replyTo(originalReply);await mention('응답 유실 메시지');const firstText=(await frame().locator('#composer-input').inputValue()).trim();
  const sentLost=loseNext('messages','after');await frame().locator('#send-message').click();const firstMessage=await sentLost;
  await frame().locator('#send-recovery').waitFor();assert.equal(count('messages','body=?',[firstText]),1);assert.equal(firstMessage.entity.files.length,1);assert.equal(firstMessage.entity.files[0].id,firstUpload.id);
  assert.equal(count('notifications','message_id=?',[firstMessage.id]),1);await settleNoAutomaticSend('lost message response does not automatically send a second message');
  await frame().locator('[data-send-check]').focus();
  const focusBefore=await frame().locator('[data-send-check]').evaluate(button=>button.ownerDocument.activeElement===button);
  const focusRefresh=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname===`/messenger/api/channels/${room.id}/messages`);
  const focusMessage=(await request(`/messenger/api/channels/${room.id}/messages`,{body:'실시간 갱신 중 복구 버튼 초점 확인'},'POST',true)).message;await focusRefresh;await frame().locator(`#message-${focusMessage.id}`).waitFor({state:'attached'});
  const focusAfter=await frame().locator('[data-send-check]').evaluate(button=>({preserved:button.ownerDocument.activeElement===button,tag:button.ownerDocument.activeElement?.tagName,id:button.ownerDocument.activeElement?.id,action:button.ownerDocument.activeElement?.dataset?.sendCheck}));
  report.focusRecovery={scope:'actual member POST then active messenger SSE refresh without navigation',messageId:focusMessage.id,before:focusBefore,after:focusAfter};assert.equal(focusBefore,true);assert.equal(focusAfter.preserved,true,'SSE recovery-panel rerender must preserve the focused enabled action');
  record('actual incoming SSE refresh preserves the focused recovery action for keyboard activation');
  await replyTo(newReply);await mention('다음에 보낼 수정 초안','검증 검토');const editedText=await frame().locator('#composer-input').inputValue();
  assert.equal(await frame().locator('#composer-input').evaluate(input=>input.ownerDocument.activeElement===input),true);
  const composingRefresh=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname===`/messenger/api/channels/${room.id}/messages`);
  const composingMessage=(await request(`/messenger/api/channels/${room.id}/messages`,{body:'작성 중 입력창 초점 확인'},'POST',true)).message;await composingRefresh;await frame().locator(`#message-${composingMessage.id}`).waitFor({state:'attached'});
  const composingFocus=await frame().locator('#composer-input').evaluate(input=>({preserved:input.ownerDocument.activeElement===input,value:input.value}));report.focusComposer={scope:'actual incoming SSE during edited draft composition',messageId:composingMessage.id,...composingFocus};assert.equal(composingFocus.preserved,true);assert.equal(composingFocus.value,editedText);
  record('actual incoming SSE refresh preserves a separately focused composer and its edited text');
  const storedBefore=await page.evaluate(({userId,channelId})=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes(userId)&&key.endsWith(channelId))),{userId:boot.user.id,channelId:room.id});
  assert.ok(Object.keys(storedBefore).some(key=>key.includes('compose:')));assert.ok(JSON.stringify(storedBefore).includes('mentionIds'));
  const composeBefore=JSON.parse(Object.entries(storedBefore).find(([key])=>key.includes(':compose:'))[1]),reviewerMessengerId=db().prepare('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?').get(reviewer.id).messenger_user_id;assert.ok(composeBefore.mentionIds.includes(reviewerMessengerId));assert.equal(firstMessage.entity.replyToId,originalReply.id);
  await openRoom();await frame().locator('#send-recovery').waitFor();assert.equal(await frame().locator('#composer-input').inputValue(),editedText);
  await settleNoAutomaticSend('refresh restores uncertain request and edited draft without automatic transmission');
  for(const width of [1440,390,320])await screenshot('uncertain-message',width,'#send-recovery');
  await page.setViewportSize({width:1440,height:960});await keyboardClick(frame().locator('[data-send-check]'));await recoveredPanelGone();
  assert.equal(await frame().locator('#composer-input').inputValue(),editedText);
  const storedAfter=await page.evaluate(({userId,channelId})=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes(userId)&&key.endsWith(channelId))),{userId:boot.user.id,channelId:room.id});
  for(const [key,value]of Object.entries(storedBefore).filter(([key])=>key.includes(':draft:')||key.includes(':compose:')||key.includes(':reply:')))assert.equal(storedAfter[key],value,'recovery must preserve newer draft, extras and reply');
  assert.match(await frame().locator('#reply-context').innerText(),new RegExp(newReply.body));
  assert.equal(count('messages','body=?',[firstText]),1);assert.equal(count('files','id=?',[firstUpload.id]),1);assert.equal(count('notifications','message_id=?',[firstMessage.id]),1);assert.equal(await frame().locator('.upload-chip').count(),0);
  assert.equal(wire.filter(item=>item.kind==='messages').length,1);record('reload and explicit result check recover one message, attachment and notification while preserving edited draft, changed mentions and changed reply');

  const beforeCommitText='네트워크 복구 후 수동으로 보낼 원문';await frame().locator('#composer-input').fill(beforeCommitText);
  const unsent=loseNext('messages','before');await frame().locator('#send-message').click();await unsent;await frame().locator('#send-recovery').waitFor();
  assert.equal(count('messages','body=?',[beforeCommitText]),0);await settleNoAutomaticSend('pre-commit failure leaves zero messages until explicit retry');
  await keyboardClick(frame().locator('[data-send-retry]'));await recoveredPanelGone();
  assert.equal(count('messages','body=?',[beforeCommitText]),1);assert.equal(await frame().locator('#composer-input').inputValue(),'');
  const failedAndRetried=wire.filter(item=>item.kind==='messages').slice(-2);assert.equal(failedAndRetried[0].requestId,failedAndRetried[1].requestId);assert.ok(failedAndRetried[0].requestId);assert.equal(failedAndRetried[0].bodySha256,failedAndRetried[1].bodySha256);
  await expectActionFocus('#composer-input','message retry success');
  record('pre-commit failure retries original payload and request ID once through keyboard action');

  const retryBytes=Buffer.from('원래 File 객체로 다시 올릴 자료\nno-second-file-picker','utf8');const uploadBefore=loseNext('files','before');
  await frame().locator('#file-input').setInputFiles({name:'다시 시도할 파일.txt',mimeType:'text/plain',buffer:retryBytes});await uploadBefore;await frame().locator('[data-upload-retry]').waitFor();
  assert.equal(count('files','name=?',['다시 시도할 파일.txt']),0);await settleNoAutomaticSend('failed upload waits for a person before reusing its original File');
  for(const width of [1440,390,320])await screenshot('failed-upload',width,'.upload-chip');
  await page.setViewportSize({width:1440,height:960});await keyboardClick(frame().locator('[data-upload-retry]'));await frame().locator('[data-upload-retry]').waitFor({state:'hidden'});await readyToSend();
  assert.equal(count('files','name=?',['다시 시도할 파일.txt']),1);
  const fileRetries=wire.filter(item=>item.kind==='files').slice(-2);assert.ok(fileRetries[0].requestId);assert.equal(fileRetries[0].requestId,fileRetries[1].requestId);assert.equal(fileRetries[0].bodySha256,hash(retryBytes));assert.equal(fileRetries[1].bodySha256,hash(retryBytes));
  const retryFile=db().prepare('SELECT * FROM files WHERE name=?').get('다시 시도할 파일.txt');assert.deepEqual(await readFile(join(directory,'messenger','uploads',retryFile.disk_name)),retryBytes);
  await expectActionFocus('#composer-input','upload retry completes its actual XHR');
  record('failed upload retries exactly the original File bytes and request ID without reopening file selection');
  await frame().locator('#composer-input').fill('재시도한 첨부 보내기');await frame().locator('#composer-input').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#messenger-frame').contentDocument.querySelector('#composer-input').value==='');
  assert.equal(count('messages','body=?',['재시도한 첨부 보내기']),1);assert.equal(count('files','id=? AND message_id IS NOT NULL',[retryFile.id]),1);
  record('recovered upload sends one attached message using normal Enter');

  const cancelledText='취소할 아직 전송되지 않은 원문',replacementText='취소 뒤 남겨둘 수정 초안';
  await frame().locator('#composer-input').fill(cancelledText);const cancelBefore=loseNext('messages','before');await frame().locator('#send-message').click();await cancelBefore;await frame().locator('#send-recovery').waitFor();
  const cancelledRequest=wire.at(-1).requestId;await frame().locator('#composer-input').fill(replacementText);await keyboardClick(frame().locator('[data-send-cancel]'));await recoveredPanelGone();await readyToSend();
  assert.equal(await frame().locator('#composer-input').inputValue(),replacementText);assert.equal(count('messages','body=?',[cancelledText]),0);assert.equal(count('message_send_requests',"request_id=? AND state='cancelled'",[cancelledRequest]),1);
  await expectActionFocus('#composer-input','message cancel success');
  await settleNoAutomaticSend('cancelling a failed message keeps the edited draft and does not transmit it automatically');
  await frame().locator('#composer-input').press('Enter');await page.waitForFunction(()=>document.querySelector('#messenger-frame').contentDocument.querySelector('#composer-input').value==='');
  assert.equal(count('messages','body=?',[cancelledText]),0);assert.equal(count('messages','body=?',[replacementText]),1);record('explicit cancellation persists a tombstone, preserves the edited draft and enables a separate new send');

  const cancelFileLost=loseNext('files','after');await frame().locator('#file-input').setInputFiles({name:'응답 유실 뒤 취소할 첨부.txt',mimeType:'text/plain',buffer:Buffer.from('cancel this committed unattached file')});const cancelFile=await cancelFileLost;await frame().locator('[data-upload-retry]').waitFor();
  assert.equal(count('files','id=?',[cancelFile.id]),1);const removed=page.waitForResponse(response=>response.request().method()==='DELETE'&&response.url().includes('/files/requests/'));
  await keyboardClick(frame().locator('[data-upload-remove]'));const deleteResponse=await removed;assert.ok(deleteResponse.ok(),await deleteResponse.text());await frame().locator('.upload-chip').waitFor({state:'hidden'});assert.equal(count('files','id=?',[cancelFile.id]),0);
  await expectActionFocus('#composer-input','upload cancel success');
  record('removing an upload after a lost success response cancels its receipt and deletes the committed unattached file');

  const timeoutText='응답이 끝없이 멈춰도 직접 복구할 메시지';await frame().locator('#composer-input').fill(timeoutText);const timeoutStarted=Date.now(),hung=loseNext('messages','hang');await frame().locator('#send-message').click();const hungRequest=await hung;
  assert.equal(await frame().locator('[data-send-retry]').isDisabled(),true);
  await page.waitForFunction(()=>{const button=document.querySelector('#messenger-frame').contentDocument.querySelector('[data-send-retry]');return button&&!button.disabled;},undefined,{timeout:35000});
  report.messageTimeoutMs=Date.now()-timeoutStarted;assert.ok(report.messageTimeoutMs>=29000,'exercise the real 30-second browser deadline');await hungRequest.release();assert.equal(count('messages','body=?',[timeoutText]),0);assert.equal(await frame().locator('#composer-input').inputValue(),timeoutText);
  await settleNoAutomaticSend('real 30-second timeout releases busy state without an automatic resend');const timeoutRequestId=wire.at(-1).requestId;
  await keyboardClick(frame().locator('[data-send-retry]'));await recoveredPanelGone();assert.equal(count('messages','body=?',[timeoutText]),1);assert.equal(wire.at(-1).requestId,timeoutRequestId);
  record('a genuinely stalled fetch times out, preserves its draft and UUID, and allows one explicit retry');

  const missingFile=loseNext('files','before');await frame().locator('#file-input').setInputFiles({name:'새로고침 뒤 재선택.txt',mimeType:'text/plain',buffer:Buffer.from('memory-only File')});await missingFile;await frame().locator('[data-upload-retry]').waitFor();
  const uploadsBeforeRefresh=wire.filter(item=>item.kind==='files').length;await openRoom();
  await frame().locator('[data-upload-retry]').waitFor();assert.match(await frame().locator('[data-upload-retry]').innerText(),/확인/);await keyboardClick(frame().locator('[data-upload-retry]'));
  await page.waitForTimeout(150);assert.match(await frame().locator('.upload-chip').innerText(),/다시|선택|확인/);assert.equal(wire.filter(item=>item.kind==='files').length,uploadsBeforeRefresh);assert.equal(count('files','name=?',['새로고침 뒤 재선택.txt']),0);
  await expectActionFocus('[data-upload-retry]','missing File check returns to same action');
  record('refresh cannot resend a missing File and explicitly asks for reselection after checking the upload receipt');

  await keyboardClick(frame().locator('[data-upload-remove]'));await frame().locator('.upload-chip').waitFor({state:'hidden'});
  const memberMessengerId=db().prepare('SELECT messenger_user_id FROM company_identity_links WHERE company_user_id=?').get(member.id).messenger_user_id;
  const aclRoom=(await request('/messenger/api/dms',{userId:memberMessengerId})).channel;report.aclReceipts=[];
  for(const cause of ['recipient-acl-403','deleted-plan-404'])for(const action of ['check','retry','cancel']){
    // Leave this target before seeding the next old-browser draft, so beforeunload
    // persists the previous room instead of overwriting the fixture being restored.
    await selectRoom(room);
    const draftId=`qa-recovery-${cause}-${action}`,privateBody=`PRIVATE-RECEIPT-BODY-${cause}-${action}`,privateTitle=`PRIVATE-PLAN-TITLE-${cause}-${action}`;
    app.store.put('contentDrafts',draftId,{id:draftId,ownerId:member.id,title:privateTitle,status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),input:{topic:'synthetic ACL fixture'},plan:{privateFixture:true}});
    await page.evaluate(({userId,channelId,draftId,title,base})=>localStorage.setItem(`synk-messenger:compose:${userId}:${channelId}`,JSON.stringify({mentionIds:[],workspaceLink:{title,url:`${base}/#view=content&section=plan&draftId=${draftId}`,kind:'content-review'},ackRequired:false})),{userId:boot.user.id,channelId:aclRoom.id,draftId,title:privateTitle,base});
    await openRoom(aclRoom);assert.match(await frame().locator('#compose-extras').innerText(),new RegExp(privateTitle));
    await frame().locator('#file-input').setInputFiles({name:`${cause}-${action}.txt`,mimeType:'text/plain',buffer:Buffer.from('synthetic shared-plan attachment')});await readyToSend();await frame().locator('#composer-input').fill(privateBody);
    const lost=loseNext('messages','after');await frame().locator('#send-message').click();const sent=await lost;await frame().locator('#send-recovery').waitFor();
    const requestId=wire.at(-1).requestId,receiptPath=`/messenger/api/channels/${aclRoom.id}/messages/requests/${requestId}`;
    // Exercise real content service errors inside a still-authorized messenger room.
    if(cause==='recipient-acl-403'){const draft=app.store.get('contentDrafts',draftId);app.store.put('contentDrafts',draftId,{...draft,ownerId:reviewer.id});}
    else{app.store.remove('contentDrafts',draftId);const deletedPlan=await fetch(base+`/api/content-drafts/${draftId}`,{headers:{Cookie:adminCookie},signal:AbortSignal.timeout(10000)});assert.equal(deletedPlan.status,404);await deletedPlan.arrayBuffer();}
    const minimal=await request(receiptPath);assert.deepEqual(minimal,{status:'sent',unavailable:true});assert.doesNotMatch(JSON.stringify(minimal),/PRIVATE|message|file|body|title/);
    const edited=`${cause} 뒤 남긴 ${action} 수정 초안`;await frame().locator('#composer-input').fill(edited);
    const method=action==='check'?'GET':action==='retry'?'POST':'DELETE',responsePath=action==='retry'?`/messenger/api/channels/${aclRoom.id}/messages`:receiptPath;
    const recovery=page.waitForResponse(response=>new URL(response.url()).pathname===responsePath&&response.request().method()===method);
    await keyboardClick(frame().locator(`[data-send-${action}]`));const recovered=await recovery;assert.equal(recovered.status(),200);const payload=await recovered.json();assert.deepEqual(payload,{status:'sent',unavailable:true,...(action==='retry'?{replayed:true}:{})});assert.doesNotMatch(JSON.stringify(payload),/PRIVATE|message|file|body|title/);
    await recoveredPanelGone();assert.equal(await frame().locator('#composer-input').inputValue(),edited);assert.equal(await frame().locator('.upload-chip').count(),0);assert.equal(count('messages','id=?',[sent.id]),1);assert.equal(count('files','message_id=?',[sent.id]),1);
    await expectActionFocus('#composer-input',`ACL ${cause} ${action} completes`);
    report.aclReceipts.push({cause,action,scope:'actual company contentDrafts ownership change or deletion; no response substitution',linkedSourceStatus:cause==='deleted-plan-404'?404:403,response:payload,originalRows:1,consumedFiles:1,modifiedDraftPreserved:true});
    record(`actual linked plan ${cause} returns private completion metadata through ${action}, preserves the modified draft and clears only consumed attachments`);
  }

  const legacy=await legacyUpload('기존 버전 첨부.txt');await restoreLegacyQueue(legacy);
  const removedLegacy=page.waitForResponse(response=>new URL(response.url()).pathname===`/messenger/api/files/${legacy.id}`&&response.request().method()==='DELETE');await keyboardClick(frame().locator('[data-upload-remove]'));assert.equal((await removedLegacy).status(),200);await frame().locator('.upload-chip').waitFor({state:'hidden'});assert.equal(count('files','id=?',[legacy.id]),0);
  record('a restored pre-upgrade attachment with no upload request ID is deleted by its verified file ID');
  const legacyLost=await legacyUpload('기존 버전 취소 응답 유실.txt');await restoreLegacyQueue(legacyLost);let deleteFinished;const deletedBeforeAbort=new Promise(resolve=>deleteFinished=resolve);deletePlan={fileId:legacyLost.id,finish:deleteFinished};
  await keyboardClick(frame().locator('[data-upload-remove]'));await deletedBeforeAbort;await frame().locator('[data-upload-remove]').filter({hasText:'취소 확인'}).waitFor();assert.equal(count('files','id=?',[legacyLost.id]),0);
  await expectActionFocus('[data-upload-remove]','upload cancel response loss returns to same action');
  await openRoom();await frame().locator('[data-upload-remove]').filter({hasText:'취소 확인'}).waitFor();
  const restoredDeletion=await page.evaluate(({userId,channelId})=>JSON.parse(localStorage.getItem(`synk-messenger:attachments:${userId}:${channelId}`)),{userId:boot.user.id,channelId:room.id});assert.equal(restoredDeletion[0].file.id,legacyLost.id);assert.equal(restoredDeletion[0].cancelPending,true);
  expectedReceiptMisses.add(base+`/messenger/api/files/${legacyLost.id}`);const deletionProof=page.waitForResponse(response=>new URL(response.url()).pathname===`/messenger/api/files/${legacyLost.id}`&&response.request().method()==='DELETE');await keyboardClick(frame().locator('[data-upload-remove]'));const proofResponse=await deletionProof;assert.equal(proofResponse.status(),404);assert.equal((await proofResponse.json()).code,'UPLOAD_DELETED');await frame().locator('.upload-chip').waitFor({state:'hidden'});assert.equal(count('files','id=?',[legacyLost.id]),0);
  record('a lost legacy deletion response survives reload and only the owners deletion tombstone resolves cancellation');

  const inactiveText='응답을 기다리며 다음 첨부도 준비한 초안';await frame().locator('#composer-input').fill(inactiveText);const delayed=loseNext('messages','delay-after');await frame().locator('#send-message').click();const delayedMessage=await delayed;
  const nextUpload=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/messenger/api/channels/${room.id}/files`);await frame().locator('#file-input').setInputFiles({name:'다음 메시지의 새 첨부.txt',mimeType:'text/plain',buffer:Buffer.from('new attachment added while prior response waits')});const nextFile=(await (await nextUpload).json()).file;
  await page.waitForFunction(()=>{const chip=document.querySelector('#messenger-frame').contentDocument.querySelector('.upload-chip');return chip&&!chip.querySelector('progress')&&!chip.querySelector('[data-upload-retry]');});
  const self=boot.channels.find(channel=>channel.kind==='self');await selectRoom(self);await frame().locator('#composer-input').fill('다른 방에 남긴 초안');await delayedMessage.release();
  await page.waitForFunction(({userId,channelId})=>!localStorage.getItem(`synk-messenger:send:${userId}:${channelId}`),{userId:boot.user.id,channelId:room.id});assert.equal(await frame().locator('#composer-input').inputValue(),'다른 방에 남긴 초안');
  await selectRoom(room);assert.equal(await frame().locator('#composer-input').inputValue(),inactiveText);assert.match(await frame().locator('.upload-chip').innerText(),/다음 메시지의 새 첨부/);assert.equal(count('files','id=? AND message_id IS NULL',[nextFile.id]),1);assert.equal(count('messages','id=?',[delayedMessage.id]),1);assert.equal(await frame().locator('#send-recovery').isVisible(),false);
  record('a delayed success while another room is open preserves the original-room body and newly added attachment as well as the other-room draft');

  await keyboardClick(frame().locator('.upload-chip').filter({hasText:'다음 메시지의 새 첨부.txt'}).locator('[data-upload-remove]'));await frame().locator('.upload-chip').waitFor({state:'hidden'});
  const focusFileLost=loseNext('files','before');await frame().locator('#file-input').setInputFiles({name:'초점을 유지할 실패 첨부.txt',mimeType:'text/plain',buffer:Buffer.from('focused retry original file')});await focusFileLost;await frame().locator('[data-upload-retry]').waitFor();
  await page.locator('#messenger-frame').evaluate(iframe=>{const win=iframe.contentWindow;win.__qaOriginalXhrSend=win.XMLHttpRequest.prototype.send;win.__qaUploadProgress=[];win.XMLHttpRequest.prototype.send=function(body){this.upload.addEventListener('progress',event=>win.__qaUploadProgress.push({loaded:event.loaded,total:event.total,activeRetry:win.document.activeElement?.dataset?.uploadRetry||null}));return win.__qaOriginalXhrSend.call(this,body);};});
  const heldUpload=loseNext('files','continue-later');await frame().locator('#file-input').setInputFiles({name:'다른 첨부 진행 갱신.txt',mimeType:'text/plain',buffer:Buffer.alloc(128*1024,7)});const held=await heldUpload;
  const focusedRetry=frame().locator('.upload-chip').filter({hasText:'초점을 유지할 실패 첨부.txt'}).locator('[data-upload-retry]');await focusedRetry.focus();const retryKey=await focusedRetry.getAttribute('data-upload-retry');assert.equal(await focusedRetry.evaluate(button=>button.ownerDocument.activeElement===button),true);
  const uploadFinished=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/messenger/api/channels/${room.id}/files`);await held.release();const refreshedUpload=(await (await uploadFinished).json()).file;
  await page.waitForFunction(()=>{const chips=[...document.querySelector('#messenger-frame').contentDocument.querySelectorAll('.upload-chip')],chip=chips.find(item=>item.textContent.includes('다른 첨부 진행 갱신.txt'));return chip&&!chip.querySelector('progress')&&!chip.querySelector('[data-upload-retry]');});
  const uploadFocus=await focusedRetry.evaluate(button=>({preserved:button.ownerDocument.activeElement===button,key:button.ownerDocument.activeElement?.dataset?.uploadRetry||null})),progress=await page.locator('#messenger-frame').evaluate(iframe=>{const win=iframe.contentWindow;win.XMLHttpRequest.prototype.send=win.__qaOriginalXhrSend;return win.__qaUploadProgress;});
  report.focusUpload={scope:'actual secondary XHR upload progress and completion while first failed-file retry is focused',retryKey,...uploadFocus,progress};assert.ok(progress.some(event=>event.loaded>0),'observe real native XHR progress');assert.equal(uploadFocus.preserved,true);assert.equal(uploadFocus.key,retryKey);assert.equal(count('files','id=?',[refreshedUpload.id]),1);
  await keyboardClick(focusedRetry);await focusedRetry.waitFor({state:'hidden'});await readyToSend();assert.equal(count('files','name=?',['초점을 유지할 실패 첨부.txt']),1);
  record('real XHR progress and completion preserve the other failed attachments focused retry action and keyboard retry still works');


  // Exercise the initiating keyboard action through its own busy render, in addition
  // to the independent SSE/progress rerenders covered above.
  while(await frame().locator('[data-upload-remove]').count()){const before=await frame().locator('[data-upload-remove]').count();await keyboardClick(frame().locator('[data-upload-remove]').first());await page.waitForFunction(before=>document.querySelector('#messenger-frame').contentDocument.querySelectorAll('[data-upload-remove]').length<before,before);}
  await frame().locator('.upload-chip').waitFor({state:'hidden'});await frame().locator('#composer-input').fill('직접 복구 동작에서 초점 유지');
  const directFailure=loseNext('messages','before');await frame().locator('#send-message').click();await directFailure;await frame().locator('[data-send-check]').waitFor();
  const directRequestId=wire.at(-1).requestId,directReceiptPath='/messenger/api/channels/'+room.id+'/messages/requests/'+directRequestId;
  const check404=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname===directReceiptPath);await keyboardClick(frame().locator('[data-send-check]'));assert.equal((await check404).status(),404);await expectActionFocus('[data-send-check]','message check 404 returns to same action');
  const retryFailure=loseNext('messages','before');await keyboardClick(frame().locator('[data-send-retry]'));await retryFailure;await expectActionFocus('[data-send-retry]','message retry network failure returns to same action');
  const abortCancel=async route=>{intentionalAborts.add(route.request().url());await route.abort('failed');};
  await context.route(base+directReceiptPath,abortCancel);await keyboardClick(frame().locator('[data-send-cancel]'));await expectActionFocus('[data-send-cancel]','message cancel network failure returns to same action');await context.unroute(base+directReceiptPath,abortCancel);
  record('direct keyboard check, retry and cancel failures return focus to the same enabled action after the busy render');
  let heldCheckResolve;const heldCheck=new Promise(resolve=>heldCheckResolve=resolve);const delayCheck=async route=>{const response=await route.fetch();await new Promise(resolve=>{const release=async()=>{hangingRoutes.delete(release);await route.fulfill({response});resolve();};hangingRoutes.add(release);heldCheckResolve(release);});};
  await context.route(base+directReceiptPath,delayCheck);await keyboardClick(frame().locator('[data-send-check]'));const releaseCheck=await heldCheck;
  await frame().locator('#composer-input').focus();await frame().locator('#composer-input').fill('요청 중 사용자가 직접 고른 입력란');await releaseCheck();await context.unroute(base+directReceiptPath,delayCheck);await expectActionFocus('#composer-input','user selected composer during request stays focused');
  assert.equal(await frame().locator('#composer-input').inputValue(),'요청 중 사용자가 직접 고른 입력란');
  record('finishing a keyboard recovery request does not steal focus after the user chooses the composer');
  await page.locator('#messenger-frame').evaluate(iframe=>{const w=iframe.contentWindow;w.__recoveryMutations=0;w.__recoveryObserver=new w.MutationObserver(records=>{w.__recoveryMutations+=records.length;});w.__recoveryObserver.observe(w.document.querySelector('#send-recovery'),{childList:true,subtree:true,characterData:true});});
  await frame().locator('#composer-input').pressSequentially(' 계속 작성한 초안');
  const mutations=await page.locator('#messenger-frame').evaluate(iframe=>{const w=iframe.contentWindow;w.__recoveryObserver.disconnect();return w.__recoveryMutations;});assert.equal(mutations,0);report.unchangedRecoveryPanelMutations=mutations;
  record('typing an already modified draft does not rewrite the unchanged aria-live recovery panel');
  await keyboardClick(frame().locator('[data-send-cancel]'));await recoveredPanelGone();await expectActionFocus('#composer-input','message cancel after previous failures');

  // Materialize the exact durable state left by an interrupted process, without
  // creating any remote object or claiming that the synthetic outbox was drained.
  const pendingKey='55555555-5555-4555-8555-555555555555',cleanupKey='66666666-6666-4666-8666-666666666666',pendingCreatedAt=new Date().toISOString();
  db().prepare("INSERT INTO file_upload_requests(user_id,channel_id,request_id,payload_hash,state,created_at) VALUES(?,?,?,?,'pending',?)").run(boot.user.id,room.id,pendingKey,'synthetic-interrupted-upload',pendingCreatedAt);
  db().prepare('INSERT INTO drive_delete_outbox(file_id,connection_id,remote_id,created_at) VALUES(?,?,?,?)').run(cleanupKey,'synthetic-connection','synthetic-remote-cleanup-intent',pendingCreatedAt);
  const preservedCleanup=db().prepare('SELECT * FROM drive_delete_outbox').all();
  await selectRoom(boot.channels.find(c=>c.kind==='self'));await page.evaluate(({userId,channelId,key})=>localStorage.setItem('synk-messenger:attachments:'+userId+':'+channelId,JSON.stringify([{key,name:'결과가 불확실한 종료된 업로드.txt',size:10,userId,channelId,cancelPending:true,errorCode:'UPLOAD_UNCERTAIN'}])),{userId:boot.user.id,channelId:room.id,key:pendingKey});await openRoom();
  const pendingDelete=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith('/files/requests/'+pendingKey));await keyboardClick(frame().locator('[data-upload-remove]'));const pendingDeleted=await pendingDelete;assert.equal(pendingDeleted.status(),200);assert.deepEqual(await pendingDeleted.json(),{status:'cancelled'});await frame().locator('.upload-chip').waitFor({state:'hidden'});await expectActionFocus('#composer-input','uncertain upload cancellation releases chip');
  assert.equal(db().prepare('SELECT state FROM file_upload_requests WHERE request_id=?').get(pendingKey).state,'cancelled');assert.deepEqual(db().prepare('SELECT * FROM drive_delete_outbox').all(),preservedCleanup);await openRoom();assert.equal(await frame().locator('.upload-chip').count(),0);
  report.uncertainUploadCancellation={scope:'synthetic persisted pending receipt and existing remote cleanup intent; no real Drive request or remote deletion claim',receiptState:'cancelled',chipRows:0,remoteCleanupOutboxPreserved:true};
  record('cancelling an orphan pending upload removes the persisted chip while preserving the exact remote cleanup outbox');

  const consumedFile=await legacyUpload('다른 탭에서 소비한 파일.txt');await restoreLegacyQueue(consumedFile);const otherClientMessage=(await request('/messenger/api/channels/'+room.id+'/messages',{body:'다른 탭의 실제 첨부 전송',fileIds:[consumedFile.id]})).message;
  expectedRecoveryResponses.add(base+'/messenger/api/files/'+consumedFile.id);const consumedDelete=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith('/files/'+consumedFile.id));await keyboardClick(frame().locator('[data-upload-remove]'));const consumedResult=await consumedDelete;assert.equal(consumedResult.status(),409);assert.equal((await consumedResult.json()).code,'UPLOAD_CONSUMED');await frame().locator('.upload-chip').waitFor({state:'hidden'});await expectActionFocus('#composer-input','consumed upload cancel removes only stale chip');
  assert.equal(count('files','id=? AND message_id=?',[consumedFile.id,otherClientMessage.id]),1);assert.equal(count('messages','id=?',[otherClientMessage.id]),1);const consumedRow=db().prepare('SELECT disk_name FROM files WHERE id=?').get(consumedFile.id);assert.ok((await readFile(join(directory,'messenger','uploads',consumedRow.disk_name))).length>0);await openRoom();assert.equal(await frame().locator('.upload-chip').count(),0);
  report.consumedUploadCancellation={scope:'actual local upload consumed by another API client while browser retained the chip',status:409,code:'UPLOAD_CONSUMED',chipRows:0,fileRows:1,messageRows:1};
  record('cancelling a file consumed in another client removes only the stale chip and preserves the attached file and message');
  record('keyboard recovery success and failure paths restore the correct action or composer across message and upload actions');

  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);report.database={messages:count('messages'),files:count('files'),notifications:count('notifications'),messageReceipts:count('message_send_requests'),uploadReceipts:count('file_upload_requests')};report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;await page?.screenshot({animations:'disabled',path:join(runDirectory,'failure.png')}).catch(()=>{});console.error(error.stack);process.exitCode=1;}
finally{
  for(const release of [...hangingRoutes])await release();
  await browser?.close().catch(error=>errors.push({cleanup:'browser',message:error.message}));await app?.stop().catch(error=>errors.push({cleanup:'app',message:error.message}));globalThis.fetch=originalFetch;
  const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&basename(target).startsWith('synk-send-recovery-browser-'),'only delete this fixture directory');await rm(target,{recursive:true,force:true});
  report.finishedAt=new Date().toISOString();report.sourceSha256=await runtimeHashes();report.sourcesUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceSha256);if(!report.sourcesUnchanged){report.ok=false;report.sourceChange='Runtime sources changed during acceptance; rerun after implementation settles.';process.exitCode=1;}
  if(errors.length)report.ok=false;await writeFile(join(runDirectory,'report.json'),JSON.stringify(report,null,2));await writeFile(join(output,'report.json'),JSON.stringify({...report,runDirectory},null,2));
  console.log(JSON.stringify({ok:report.ok,checks:checks.length,report:join(runDirectory,'report.json'),externalRequests:externalRequests.length}));
}
