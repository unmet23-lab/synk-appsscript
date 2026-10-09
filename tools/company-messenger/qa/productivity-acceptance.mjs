// Real browser flows using disposable users, databases, and a generated test video.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {resolve,join,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {createCompanyApp} from '../../../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output=process.env.MESSENGER_QA_OUTPUT?resolve(process.env.MESSENGER_QA_OUTPUT):resolve(dirname(fileURLToPath(import.meta.url)),'../qa-output/productivity-20261008');
await mkdir(output,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'synk-productivity-ui-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base=`http://localhost:${port}`;
const app=createCompanyApp({dataDir:directory,host:'127.0.0.1',port,origin:base,schedule:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
const browser=await chromium.launch({executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],checks=[],contexts={},pages={},users={},sessions={},boot={};
const record=label=>{checks.push(label);console.log('PASS '+label);};
const report={checks,errors,scope:'disposable company server, real Chromium desktop and mobile interaction; no live user data or paid calls'};
async function request(key,path,body,method=body===undefined?'GET':'POST',headers={}){
  const response=await fetch(base+path,{method,headers:{Origin:base,Cookie:`synk_company_session=${sessions[key]}`,'X-CSRF-Token':`csrf-${key}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)});
  const data=await response.json();assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);return data;
}
const frame=key=>pages[key].frameLocator('#messenger-frame');
let room,message,result1,result2,project,customer;
async function openMessenger(key){
  await pages[key].goto(base+'/?tab=messenger');
  await frame(key).locator('#personal-bell').waitFor();
  await frame(key).locator('[data-chat-category="all"]').click();
  await frame(key).locator(`[data-channel="${room.id}"]`).click();
  await frame(key).locator(`#message-${message.id}`).waitFor();
}
async function taskStage(key,stage,result,reviewer){
  const f=frame(key);await f.locator(`#message-${message.id} .message-task`).click();
  if(reviewer)await f.locator('#task-form select[name=reviewerId]').selectOption(reviewer);
  await f.locator('#task-form select[name=stage]').selectOption(stage);
  if(result)await f.locator(`#task-result-picker [data-picker-message="${result.id}"]`).click();
  await f.locator('#task-form button[type=submit]').click();
  await f.locator('#task-form').waitFor({state:'hidden'});
  assert.equal((await request(key,`/messenger/api/messages/${message.id}`)).message.task.stage,stage);
}
try{
  app.store.put('teams','qa-team',{id:'qa-team',name:'검증 제작팀',active:true});
  for(const [key,name,role] of [['admin','검증 검토자','admin'],['worker','검증 담당자','member']]){
    users[key]=app.store.createUser({name,email:`${key}@example.test`,role,teamId:'qa-team'});
    sessions[key]=app.store.mint('session',users[key].id,{csrfToken:`csrf-${key}`},60);
    contexts[key]=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
    await contexts[key].addCookies([{name:'synk_company_session',value:sessions[key],url:base,httpOnly:true,sameSite:'Lax'}]);
    pages[key]=await contexts[key].newPage();pages[key].on('pageerror',error=>errors.push(error.message));
  }
  await app.start();
  for(const key of Object.keys(users))boot[key]=await request(key,'/messenger/api/bootstrap');
  room=boot.admin.channels.find(channel=>channel.systemKey==='social');
  message=(await request('admin',`/messenger/api/channels/${room.id}/messages`,{body:'가을 캠페인 표지 수정 요청'})).message;
  const file=(await request('worker',`/messenger/api/channels/${room.id}/files`,Buffer.from('synthetic artwork deliverable'), 'POST', {'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent('표지-시안.txt')})).file;
  result1=(await request('worker',`/messenger/api/channels/${room.id}/messages`,{body:'표지 첫 수정본',fileIds:[file.id]})).message;
  result2=(await request('worker',`/messenger/api/channels/${room.id}/messages`,{body:'표지 재검토 최종본',replyToId:message.id})).message;
  await openMessenger('admin');
  const a=frame('admin'),w=frame('worker');
  await a.locator(`#message-${message.id}`).hover();
  await a.locator(`#message-${message.id} [aria-label="할 일로 만들기"]`).click();
  await a.locator('#task-form input[name=title]').fill('가을 표지 최종 확정');
  await a.locator('#task-form select[name=assigneeId]').selectOption(boot.worker.user.id);
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
  await a.locator('#task-form input[name=dueDate]').fill(today);
  await a.locator('#task-form button[type=submit]').click();await a.locator('#task-form').waitFor({state:'hidden'});
  record('UI creates request with assignee and KST due date, leaving the reviewer initially optional');
  await openMessenger('worker');await w.locator('#personal-bell').click();
  await w.locator('[data-workday-task]').first().waitFor();
  assert.match(await w.locator('#personal-body').innerText(),/가을 표지 최종 확정/);
  await pages.worker.screenshot({animations:'disabled',path:join(output,'workday-desktop.png')});
  await pages.worker.setViewportSize({width:320,height:844});
  await pages.worker.screenshot({animations:'disabled',path:join(output,'active-workday-mobile-320.png')});
  await w.locator('[data-workday-task]').first().click();await w.locator('#task-form').waitFor();
  await pages.worker.screenshot({animations:'disabled',path:join(output,'task-mobile-320.png')});
  await w.locator('#task-form').press('Escape');
  await pages.worker.setViewportSize({width:1440,height:960});
  await w.locator('#close-drawer').click();
  await taskStage('worker','accepted');await taskStage('worker','doing');await taskStage('worker','review',result1,boot.admin.user.id);
  record('assignee accepts, starts, first assigns a reviewer and submits a real attached result for review');
  await openMessenger('admin');await taskStage('admin','changes');
  await openMessenger('worker');await taskStage('worker','review',result2);
  await openMessenger('admin');await taskStage('admin','done');
  record('reviewer requests changes, assignee resubmits, reviewer approves completion');
  await a.locator(`#message-${message.id}`).hover();await a.locator(`#message-${message.id} [data-action="decision"]`).click();
  await a.locator('#decision-form textarea[name=summary]').fill('가을 캠페인 표지 최종본 확정');
  await a.locator('#decision-form select[name=kind]').selectOption('final');
  await a.locator(`#decision-result-picker [data-picker-message="${result2.id}"]`).click();
  await a.locator('#decision-form button[type=submit]').click();await a.locator('#decision-form').waitFor({state:'hidden'});
  await a.locator('#personal-bell').click();await a.locator('[data-personal-tab="decisions"]').click();
  await a.locator('.decision-item').first().waitFor();assert.match(await a.locator('#personal-body').innerText(),/가을 캠페인 표지 최종본 확정/);
  await pages.admin.screenshot({animations:'disabled',path:join(output,'decisions-desktop.png')});
  record('UI records and retrieves a confirmed final with source and result links');
  await a.locator('[data-personal-tab="catchup"]').click();await a.locator('#catchup-read').waitFor();
  assert.match(await a.locator('#personal-body').innerText(),/검토|진행/);
  await pages.admin.screenshot({animations:'disabled',path:join(output,'catchup-desktop.png')});
  await a.locator('#catchup-read').click();await a.locator('#personal-body').getByText('모두 확인했어요',{exact:true}).waitFor();
  assert.equal((await request('admin','/messenger/api/catch-up')).events.length,0);
  record('change recap links actual events and explicit confirmation advances only the personal cursor');
  const videoPath=join(directory,'scene.mp4');
  execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x180:r=10:d=16','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',videoPath],{windowsHide:true});
  project=(await request('admin','/api/client-projects',{title:process.env.MESSENGER_QA_PROJECT_TITLE||'고객 영상 수정 검증',customerName:'합성 고객',ownerId:users.worker.id,reviewerId:users.admin.id,stage:'received',summary:'장면 의견 왕복'})).project;
  project=(await request('worker',`/api/client-projects/${project.id}/media`,await readFile(videoPath),'POST',{'Content-Type':'video/mp4','X-File-Name':'scene.mp4','X-Version-Label':encodeURIComponent('시안 1'),'X-Version-Kind':'preview','X-Project-Revision':String(project.revision)})).project;
  const invite=await request('worker',`/api/client-projects/${project.id}/invite`,{revision:project.revision});
  const customerResponse=await fetch(base+'/pulse/api/open',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({invite:invite.invite})});
  customer={...(await customerResponse.json()),cookie:customerResponse.headers.getSetCookie()[0]?.split(';')[0]};assert.ok(customerResponse.ok);
  async function customerAction(body){const response=await fetch(base+'/pulse/api/action',{method:'POST',headers:{Origin:base,Cookie:customer.cookie,'Content-Type':'application/json','X-Pulse-CSRF':customer.csrf},body:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;}
  let preview=customer.project.versions.at(-1);
  await customerAction({revision:customer.project.revision,action:'feedback',versionId:preview.id,seconds:12,text:'12초 자막을 수정해주세요'});
  await openMessenger('worker');await w.locator('#personal-bell').click();await w.locator('.customer-work .workday-item').filter({hasText:'12초 자막'}).waitFor();
  await w.locator('.customer-work .workday-item').filter({hasText:'12초 자막'}).locator('[data-client-open]').click();
  await pages.worker.locator('#client-video-'+preview.id).waitFor();
  await pages.worker.waitForFunction(id=>Math.abs(document.getElementById('client-video-'+id).currentTime-12)<.1,preview.id);
  await pages.worker.screenshot({animations:'disabled',path:join(output,'customer-scene-desktop.png')});
  record('customer feedback appears once in owner workday and opens the correct video at 12 seconds');
  project=(await request('worker','/api/client-projects')).projects.find(row=>row.id===project.id);
  const feedback=project.messages.find(row=>row.action==='feedback');
  await pages.worker.locator(`[data-client="workflow"][data-id="${feedback.id}"][data-workflow="start"]`).click();
  project=(await request('worker','/api/client-projects')).projects.find(row=>row.id===project.id);
  project=(await request('worker',`/api/client-projects/${project.id}/media`,await readFile(videoPath),'POST',{'Content-Type':'video/mp4','X-File-Name':'scene2.mp4','X-Version-Label':encodeURIComponent('수정 시안 2'),'X-Version-Kind':'preview','X-Project-Revision':String(project.revision)})).project;
  preview=project.versions.at(-1);
  await pages.worker.locator('[data-client="refresh"]').click();
  const reviewForm=pages.worker.locator(`[data-client-form="workflow"][data-message-id="${feedback.id}"]`);
  await reviewForm.locator('..').locator('summary').click();await reviewForm.locator('select[name=versionId]').selectOption(preview.id);
  await reviewForm.locator('textarea[name=note]').fill('12초 자막 수정 확인 부탁드립니다');await reviewForm.locator('button[type=submit]').click();
  await openMessenger('admin');await a.locator('#personal-bell').click();
  await a.locator('.customer-work .workday-item').filter({hasText:'12초 자막'}).locator('[data-client-open]').click();
  await pages.admin.locator(`[data-client="workflow"][data-id="${feedback.id}"][data-workflow="accept"]`).click();
  project=(await request('worker','/api/client-projects')).projects.find(row=>row.id===project.id);
  await customerAction({revision:project.revision,action:'approve',versionId:preview.id});
  let work=await request('worker','/api/client-workflow');assert.equal(work.items.filter(row=>row.projectId===project.id&&row.kind==='feedback').length,0);assert.equal(work.items.filter(row=>row.projectId===project.id&&row.kind==='delivery').length,1);
  record('customer revision moves through internal review and real customer approval into one delivery action');
  await pages.worker.goto(base+'/?tab=home');await pages.worker.locator('[data-action="marin-suggest"]').filter({hasText:'자리 비운 동안 바뀐 것'}).click();await pages.worker.locator('#marin-send').click();
  await pages.worker.locator('[data-action="marin-action"]').filter({hasText:'바뀐 것과 할 행동 보기'}).click();await w.locator('[data-personal-tab="catchup"][aria-pressed="true"]').waitFor();
  record('Marin summarizes changes from records and opens the integrated catch-up panel');
  for(const width of [390,320]){
    await pages.worker.setViewportSize({width,height:844});await w.locator('[data-personal-tab="workday"]').click();await w.locator('.customer-work').waitFor();
    assert.ok(await pages.worker.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.ok(await pages.worker.locator('#messenger-frame').evaluate(iframe=>iframe.contentDocument.documentElement.scrollWidth<=iframe.contentWindow.innerWidth+1));
    await pages.worker.screenshot({animations:'disabled',path:join(output,`workday-mobile-${width}.png`)});
    for(const tab of ['catchup','decisions']){
      await w.locator(`[data-personal-tab="${tab}"]`).click();
      await w.locator(tab==='decisions'?'.decision-item':'#catchup-read').waitFor();
      await pages.worker.screenshot({animations:'disabled',path:join(output,`${tab}-mobile-${width}.png`)});
      assert.ok(await pages.worker.locator('#messenger-frame').evaluate(iframe=>iframe.contentDocument.documentElement.scrollWidth<=iframe.contentWindow.innerWidth+1));
    }
  }
  record('320 and 390 pixel mobile workday remains readable without horizontal overflow');
  assert.deepEqual(errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;for(const [key,page]of Object.entries(pages))await page.screenshot({animations:'disabled',path:join(output,`failure-${key}.png`)}).catch(()=>{});throw error;}
finally{
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();await app.stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('synk-productivity-ui-'));await rm(target,{recursive:true,force:true});
}
