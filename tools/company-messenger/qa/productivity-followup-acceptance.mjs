// Real Chromium acceptance on disposable company data; never connects to the live server.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {resolve,join,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {createCompanyApp} from '../../../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';

process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='1';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=process.env.MESSENGER_QA_OUTPUT?resolve(process.env.MESSENGER_QA_OUTPUT):resolve(dirname(fileURLToPath(import.meta.url)),'../qa-output/followup-20261008');await mkdir(output,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'synk-followup-browser-'));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const base=`http://localhost:${port}`,app=createCompanyApp({dataDir:directory,host:'127.0.0.1',port,origin:base,schedule:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
const browser=await chromium.launch({executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const users={},sessions={},boot={},pages={},contexts={},checks=[],errors=[],externalRequests=[];
const report={checks,errors,externalRequests,scope:'disposable company server with background jobs enabled, fake Drive, synthetic users/video, real Chromium; no live data or paid calls'};
const record=label=>{checks.push(label);console.log('PASS '+label);};
async function request(key,path,body,method=body===undefined?'GET':'POST',headers={}){
  const response=await fetch(base+path,{method,headers:{Origin:base,Cookie:`synk_company_session=${sessions[key]}`,'X-CSRF-Token':`csrf-${key}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)});
  const data=await response.json();assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;
}
const frame=key=>pages[key].frameLocator('#messenger-frame');
let room,source,result;
async function openMessenger(key){await pages[key].goto(base+'/?tab=messenger');await frame(key).locator('#personal-bell').waitFor();await frame(key).locator('[data-chat-category="all"]').click();await frame(key).locator(`[data-channel="${room.id}"]`).click();}
async function openNotifications(key){await frame(key).locator('#personal-bell').click();await frame(key).locator('[data-personal-tab="notifications"]').click();await frame(key).locator('#notifications-read-all').waitFor();}
async function screenshot(key,name,width=1440){await pages[key].setViewportSize({width,height:width<700?844:960});assert.ok(await pages[key].evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await pages[key].locator('#messenger-frame').evaluate(iframe=>iframe.contentDocument.documentElement.scrollWidth<=iframe.contentWindow.innerWidth+1));await pages[key].screenshot({animations:'disabled',path:join(output,`${name}-${width}.png`)});}
try{
  app.store.put('teams','qa-team',{id:'qa-team',name:'후속 검증팀',active:true});
  for(const [key,name,role] of [['admin','검증 요청자','admin'],['worker','검증 담당자','member'],['former','이전 검토자','member'],['replacement','새 검토자','member']]){
    users[key]=app.store.createUser({name,email:`${key}@example.test`,role,teamId:'qa-team'});sessions[key]=app.store.mint('session',users[key].id,{csrfToken:`csrf-${key}`},60);
    if(key==='former')continue;
    contexts[key]=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});await contexts[key].addCookies([{name:'synk_company_session',value:sessions[key],url:base,httpOnly:true,sameSite:'Lax'}]);pages[key]=await contexts[key].newPage();pages[key].on('pageerror',error=>errors.push(error.message));pages[key].on('console',message=>{if(message.type()==='error')errors.push(message.text());});pages[key].on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('data:'))externalRequests.push(request.url());});
  }
  await app.start();for(const key of Object.keys(users))boot[key]=await request(key,'/messenger/api/bootstrap');room=boot.admin.channels.find(channel=>channel.systemKey==='social');
  await request('worker','/messenger/api/workday/notifications',{enabled:false,includeWeekends:true},'PATCH');
  source=(await request('admin',`/messenger/api/channels/${room.id}/messages`,{body:'검토자 이탈 복구를 확인할 요청'})).message;
  result=(await request('worker',`/messenger/api/channels/${room.id}/messages`,{body:'같은 결과물로 재검토할 시안'})).message;
  let task=(await request('admin',`/messenger/api/messages/${source.id}/task`,{title:'캠페인 시안 검토',assigneeId:boot.worker.user.id,reviewerId:boot.former.user.id})).task;
  for(const stage of ['accepted','doing','review'])task=(await request('worker',`/messenger/api/messages/${source.id}/task`,{revision:task.revision,stage,...(stage==='review'?{resultMessageId:result.id}:{})},'PATCH')).task;
  await request('admin',`/api/members/${users.former.id}/status`,{active:false});
  await openMessenger('admin');const a=frame('admin');await a.locator(`#message-${source.id} .message-task`).click();await a.locator('#reassign-reviewer').waitFor();
  assert.equal(await a.locator(`#replacement-reviewer option[value="${boot.worker.user.id}"]`).count(),0);assert.equal(await a.locator('#task-result-picker [data-picker-search]').count(),0);
  await a.locator('#replacement-reviewer').selectOption(boot.replacement.user.id);await a.locator('#reviewer-recovery-confirm').check();
  for(const width of [1440,390,320])await screenshot('admin','reviewer-recovery',width);
  await a.locator('#reassign-reviewer').click();await a.locator('#reassign-reviewer').waitFor({state:'hidden'});task=(await request('admin',`/messenger/api/messages/${source.id}`)).message.task;
  assert.equal(task.stage,'review');assert.equal(task.resultMessageId,result.id);assert.equal(task.reviewer.id,boot.replacement.user.id);record('requester UI replaces an inactive reviewer, excludes assignee, preserves result and review stage');
  await openMessenger('replacement');const r=frame('replacement');await r.locator(`#message-${source.id} .message-task`).click();await r.locator('#task-form select[name=stage]').selectOption('done');await r.locator('#task-form button[type=submit]').click();await r.locator('#task-form').waitFor({state:'hidden'});assert.equal((await request('replacement',`/messenger/api/messages/${source.id}`)).message.task.stage,'done');record('new reviewer explicitly approves the unchanged result');

  const videoPath=join(directory,'scene.mp4');execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x180:r=10:d=16','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',videoPath],{windowsHide:true});
  let project=(await request('admin','/api/client-projects',{title:'고객 알림 검증 영상',customerName:'합성 고객',ownerId:users.worker.id,reviewerId:users.admin.id,stage:'received',summary:'즉시 알림·장면 이동 검증'})).project;
  project=(await request('worker',`/api/client-projects/${project.id}/media`,await readFile(videoPath),'POST',{'Content-Type':'video/mp4','X-File-Name':'scene.mp4','X-Version-Label':encodeURIComponent('시안 1'),'X-Version-Kind':'preview','X-Project-Revision':String(project.revision)})).project;
  const invite=await request('worker',`/api/client-projects/${project.id}/invite`,{revision:project.revision}),opened=await fetch(base+'/pulse/api/open',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({invite:invite.invite})});
  const customer={...(await opened.json()),cookie:opened.headers.getSetCookie()[0]?.split(';')[0]};assert.ok(opened.ok);const preview=customer.project.versions.at(-1);
  await openMessenger('worker');await openNotifications('worker');const w=frame('worker');assert.equal(await w.locator('.workflow-notification').filter({hasText:'즉시 알림 검증'}).count(),0);
  const feedbackResponse=await fetch(base+'/pulse/api/action',{method:'POST',headers:{Origin:base,Cookie:customer.cookie,'Content-Type':'application/json','X-Pulse-CSRF':customer.csrf},body:JSON.stringify({revision:customer.project.revision,action:'feedback',versionId:preview.id,seconds:12,text:'즉시 알림 검증: 12초 자막을 수정해주세요'})});assert.ok(feedbackResponse.ok,await feedbackResponse.text());
  const feedbackCard=w.locator('.workflow-notification').filter({hasText:'즉시 알림 검증'});await feedbackCard.waitFor({timeout:20000});assert.match(await feedbackCard.innerText(),/0:12/);assert.ok((await w.locator('#personal-unread').textContent()).length>0);record('new customer feedback arrives through SSE in the already-open notification panel and badge');
  await screenshot('worker','notifications');await feedbackCard.locator('button').click();await pages.worker.locator('#client-video-'+preview.id).waitFor();await pages.worker.waitForFunction(id=>Math.abs(document.getElementById('client-video-'+id).currentTime-12)<.1,preview.id);
  const feedbackNotice=(await request('worker','/messenger/api/notifications?limit=100')).items.find(item=>item.kind==='client_workflow'&&(item.body||item.text||'').includes('즉시 알림 검증'));assert.ok(feedbackNotice.readAt);record('opening customer notification marks it read and opens the exact preview at 12 seconds');

  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),previous=new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),due=[];
  for(const [title,dueDate] of [['오늘 납품 확인',today],['지난 마감 확인',previous]]){const message=(await request('admin',`/messenger/api/channels/${room.id}/messages`,{body:title})).message;due.push((await request('admin',`/messenger/api/messages/${message.id}/task`,{title,assigneeId:boot.worker.user.id,dueDate})).task);}
  await request('worker','/messenger/api/workday/notifications',{enabled:true,includeWeekends:true},'PATCH');
  let inbox=await request('worker','/messenger/api/notifications?limit=100'),digests=inbox.items.filter(item=>item.kind==='due_digest');assert.equal(digests.length,1);assert.equal(digests[0].digest.taskCount,2);assert.equal(digests[0].digest.overdueCount,1);
  await openMessenger('worker');await openNotifications('worker');const dueCard=w.locator('.workflow-notification').filter({hasText:'마감 업무 2개'});await dueCard.waitFor();await dueCard.locator('button').click();await w.locator('#digest-today').waitFor();assert.equal(await w.locator('.deadline-digest-list [data-source-message]').count(),2);
  for(const width of [1440,390,320])await screenshot('worker','deadline-digest',width);
  await w.locator(`.deadline-digest-list [data-source-message="${due[1].messageId}"]`).click();await w.locator(`#message-${due[1].messageId}`).waitFor();record('two due tasks form one digest, with exact original-message navigation and no horizontal overflow');
  await openNotifications('worker');await w.locator('#deadline-settings').click();await w.locator('#deadline-settings-form input[name=enabled]').uncheck();await w.locator('#deadline-settings-form button[type=submit]').click();await w.locator('#deadline-settings-form').waitFor({state:'hidden'});assert.equal((await request('worker','/messenger/api/workday/notifications')).enabled,false);
  await w.locator('#deadline-settings').click();await w.locator('#deadline-settings-form input[name=enabled]').check();await w.locator('#deadline-settings-form button[type=submit]').click();await w.locator('#deadline-settings-form').waitFor({state:'hidden'});assert.equal((await request('worker','/messenger/api/workday/notifications')).enabled,true);inbox=await request('worker','/messenger/api/notifications?limit=100');assert.equal(inbox.items.filter(item=>item.kind==='due_digest').length,1);record('deadline settings turn off and back on through the UI without creating another daily digest');
  await w.locator('#toasts .toast').last().waitFor({state:'hidden'});
  for(const width of [390,320])await screenshot('worker','notifications-mobile',width);
  await w.locator('#notifications-read-all').click();await pages.worker.waitForFunction(()=>document.querySelector('#messenger-frame').contentDocument.querySelector('#personal-unread').hidden);assert.equal((await request('worker','/messenger/api/notifications?unread=1')).unreadCount,0);record('read-all clears customer, deadline and chat unread counts together');
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;for(const [key,page]of Object.entries(pages))await page.screenshot({animations:'disabled',path:join(output,`failure-${key}.png`)}).catch(()=>{});throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await app.stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('synk-followup-browser-'));await rm(target,{recursive:true,force:true});}
