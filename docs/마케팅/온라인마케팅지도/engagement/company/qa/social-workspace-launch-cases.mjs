import assert from 'node:assert/strict';
import {join} from 'node:path';

// The real application, database and messenger are used. Only synthetic local
// users/content exist; the shared fixture blocks all off-origin browser traffic.
export async function verifySocialLaunch({page,browser,company,base,report,out,check,view,done,ready,focusedScreenshot,fit,getTime}){
  const start=report.checks.length,admin=company.store.all('users').find(u=>u.role==='admin'),viewer=company.store.all('users').find(u=>u.role==='viewer');
  const requests=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/social/')&&request.method()!=='GET')requests.push({path:new URL(request.url()).pathname,method:request.method()});});
  const observe=surface=>{surface.on('pageerror',error=>report.errors.push(error.message));surface.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});surface.on('response',response=>{if(response.status()>=400){const path=new URL(response.url()).pathname;if(['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({path,status:response.status()});if(path.startsWith('/api/social/'))report.socialErrors.push({path,status:response.status()});}});};
  const externalCalls=()=>JSON.stringify([report.providerSends,report.aiCalls,report.metaReadCalls,report.metaWriteCalls||[]]);
  const initialCalls=externalCalls();
  await view('overview');
  check('launch: setup describes local execution and no verified publication',await page.locator('[data-sw-setup]').innerText().then(t=>t.includes('개발 서버')&&t.includes('연결 필요')&&!t.includes('결과 확인됨')));
  await page.locator('[data-sw-setup-channel]').selectOption('manual');
  check('launch: selecting an account changes only its setup checklist',await page.locator('[data-sw-setup-channel]').inputValue()==='manual'&&await page.locator('[data-sw-setup-step=publishing]').innerText().then(t=>t.includes('합성 수동 계정')));
  const setupButtons=await page.locator('[data-sw-setup-step]').evaluateAll(rows=>rows.map(row=>({id:row.dataset.swSetupStep,view:row.querySelector('[data-sw-action]')?.dataset.value})));
  for(const step of setupButtons){await view('overview');await page.locator(`[data-sw-setup-step="${step.id}"] [data-sw-action=view]`).click();await ready();check('launch: setup '+step.id+' opens its existing screen without completing it',await page.evaluate(()=>socialWorkspaceState.view)===step.view);}
  check('launch: account selection and every setup button make no write or provider call',requests.length===0&&externalCalls()===initialCalls,{writes:requests.length});
  await view('overview');await focusedScreenshot('[data-sw-setup]','launch-setup-1440.png');

  await view('inbox');const create=page.locator('[data-sw-form=inbox]');
  const original='합성 문의 원문: 한국어 수업 상담 일정을 알고 싶어요.',action='가능한 상담 시간을 확인하고 안내문을 정리하기';
  await create.locator('[name=channelId]').selectOption('ig');await create.locator('[name=author]').fill('합성 고객');await create.locator('[name=text]').fill(original);await create.locator('button[type=submit]').click();await done();
  const inquiry=company.store.all('socialInbox').find(r=>r.text===original);assert.ok(inquiry);
  company.store.put('socialInbox','launch-other',{id:'launch-other',channelId:'ig',kind:'comment',author:'다른 합성 고객',text:'선택한 문의와 별개인 두 번째 문의',revision:1,status:'open',updatedAt:getTime()});
  await page.locator('[data-sw-action=refresh]').click();await done();
  check('launch: inquiry is created through the real UI and both source cards are available',await page.locator('[data-sw-inbox-card]').count()===2);
  await page.locator(`[data-sw-action=followup-open][data-value="${inquiry.id}"]`).click();await done();
  let form=page.locator(`[data-sw-form=followup][data-id="${inquiry.id}"]`);
  const options=await page.evaluate(id=>socialWorkspaceState.forms['followup-options:'+id],inquiry.id),room=options.targets.find(r=>r.kind==='self'&&r.assignees.some(a=>a.id===admin.id))||options.targets.find(r=>r.assignees.some(a=>a.id===admin.id));assert.ok(room);
  await form.locator('[name=roomId]').selectOption(room.id);await form.locator('[name=assigneeId]').selectOption(admin.id);await form.locator('[name=dueDate]').fill(options.date);await form.locator('[name=nextAction]').fill(action);
  // Render while the text field still has focus: no blur/change event can save it.
  await page.evaluate(()=>snswRender());
  check('launch: unblurred follow-up input survives an unrelated render',await form.locator('[name=nextAction]').inputValue()===action&&await form.locator('[name=dueDate]').inputValue()===options.date&&await form.locator('[name=assigneeId]').inputValue()===admin.id);
  await view('accounts');await view('inbox');
  check('launch: follow-up fields survive normal screen navigation',await form.locator('[name=nextAction]').inputValue()===action&&await form.locator('[name=roomId]').inputValue()===room.id);
  company.store.put('socialInbox',inquiry.id,{...company.store.get('socialInbox',inquiry.id),revision:inquiry.revision+1,replyDraft:'다른 창에서 확인한 답변 초안'});await page.locator('[data-sw-action=refresh]').click();await done();
  const staleWrites=requests.length;await form.locator('button[type=submit]').click();check('launch: a changed source blocks stale registration locally and preserves the exact action',requests.length===staleWrites&&await page.locator('.sw-error').innerText().then(t=>t.includes('문의가 바뀌었어요'))&&await form.locator('[name=nextAction]').inputValue()===action);
  await page.locator(`[data-sw-action=followup-open][data-value="${inquiry.id}"]`).click();await done();check('launch: explicitly rechecking the source renews revision without clearing the authored work',await form.getAttribute('data-revision')===String(inquiry.revision+1)&&await form.locator('[name=nextAction]').inputValue()===action);
  for(const width of [390,320]){await page.setViewportSize({width,height:width===390?844:568});await fit('launch follow-up form '+width);await focusedScreenshot(`[data-sw-followup="${inquiry.id}"]`,'launch-followup-form-'+width+'.png');await focusedScreenshot(`[data-sw-form=followup][data-id="${inquiry.id}"] button[type=submit]`,'launch-followup-submit-'+width+'.png');check('launch: explicit registration stays reachable at '+width,await form.locator('button[type=submit]').isVisible()&&await form.locator('[name=nextAction]').inputValue()===action);await view('overview');await fit('launch setup '+width);await focusedScreenshot('[data-sw-setup]','launch-setup-'+width+'.png');await view('inbox');}
  await page.setViewportSize({width:1440,height:1000});
  const beforeTasks=company.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n;
  const postCount=requests.filter(r=>r.path.endsWith('/followup')).length;
  // Two same-turn submit events exercise the real UI busy guard.
  await form.evaluate(el=>{el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await done();
  const linked=company.socialFollowups.list(admin).items.find(r=>r.inboxId===inquiry.id)?.followup;assert.ok(linked?.taskId);
  check('launch: double submit creates one existing messenger task with the chosen assignee and date',company.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n===beforeTasks+1&&requests.filter(r=>r.path.endsWith('/followup')).length===postCount+1&&linked.assigneeId===admin.id&&linked.dueDate===options.date);
  const message=company.messenger.db.prepare('SELECT body FROM messages WHERE id=?').get(linked.messageId);
  check('launch: task keeps explicit next action and internal source link without copying customer content',message.body.includes(action)&&message.body.includes(base+'/?tab=social&section=inbox&inboxId=')&&!message.body.includes(original)&&!message.body.includes('합성 고객'));
  check('launch: success replaces registration with one linked task and clears only the committed form',await page.locator(`[data-sw-followup="${inquiry.id}"]`).innerText().then(t=>t.includes(action)&&t.includes(options.date)&&t.includes(admin.name))&&await form.count()===0);
  await focusedScreenshot(`[data-sw-followup="${inquiry.id}"]`,'launch-followup-linked-1440.png');
  await page.reload();await ready();
  check('launch: reload preserves the link and offers no duplicate create',await page.locator(`[data-sw-action=followup-open][data-value="${inquiry.id}"]`).count()===0&&company.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n===beforeTasks+1);
  await page.locator(`[data-sw-followup="${inquiry.id}"] a`).click();
  const frame=page.frameLocator('#messenger-frame'),card=frame.locator(`[data-message-id="${linked.messageId}"]`).first();await card.waitFor();
  check('launch: linked task button opens the exact messenger source message',await card.innerText().then(t=>t.includes(action)&&t.includes('SNS 문의 후속 업무')));
  await card.locator('.message-task').click();await frame.locator('.task-detail').waitFor();
  check('launch: actual task detail shows current assignee deadline and next action',await frame.locator('.task-detail').innerText().then(t=>t.includes(admin.name)&&t.includes(options.date)&&t.includes(action)));
  await page.screenshot({path:join(out,'launch-task-detail-1440.png')});report.screenshots.push(join(out,'launch-task-detail-1440.png'));
  await frame.locator('#close-modal').click();await frame.locator('#personal-bell').click();await frame.locator(`[data-workday-task-id="${linked.taskId}"]`).waitFor();
  check('launch: the same task appears in the existing today-work panel',await frame.locator('#personal-body').innerText().then(t=>t.includes('SNS 문의 후속 업무')&&t.includes(options.date)));
  await page.screenshot({path:join(out,'launch-today-work-1440.png')});report.screenshots.push(join(out,'launch-today-work-1440.png'));
  await frame.locator('#close-drawer').click();
  const popupPromise=page.waitForEvent('popup');await card.locator('.message-text a').click();const sourcePage=await popupPromise;observe(sourcePage);
  await sourcePage.waitForSelector('[data-sw-inbox-selected]');await sourcePage.waitForFunction(()=>socialWorkspaceState.data&&!socialWorkspaceState.loading);
  check('launch: clicking the task source link returns to only its authorized inquiry',await sourcePage.locator('[data-sw-inbox-card]').count()===1&&await sourcePage.locator('[data-sw-inbox-selected]').innerText().then(t=>t.includes(original)));
  check('launch: source return focuses the selected inquiry for keyboard and screen-reader use',await sourcePage.evaluate(()=>document.activeElement?.hasAttribute('data-sw-inbox-selected')));
  for(const width of [390,320]){await sourcePage.setViewportSize({width,height:width===390?844:568});const size=await sourcePage.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,main:document.querySelector('#main')?.scrollWidth,client:document.querySelector('#main')?.clientWidth}));check('launch: selected source fits '+width,size.scroll<=width+1&&size.main<=size.client+1,size);await sourcePage.locator('[data-sw-inbox-selected]').scrollIntoViewIfNeeded();const path=join(out,'launch-source-return-'+width+'.png');await sourcePage.screenshot({path});report.screenshots.push(path);}
  await sourcePage.locator('[data-sw-action=inbox-all]').click();check('launch: returning to all inquiries clears the URL selection and shows both records',await sourcePage.locator('[data-sw-inbox-card]').count()===2&&!new URL(sourcePage.url()).searchParams.has('inboxId'));await sourcePage.close();

  company.store.put('channels','ig',{...company.store.get('channels','ig'),teamId:'launch-team'});company.store.put('users',viewer.id,{...company.store.get('users',viewer.id),teamId:'launch-team'});
  const readContext=await browser.newContext({viewport:{width:390,height:844}});await readContext.addCookies([{name:'synk_company_session',value:company.store.mint('session',viewer.id,{csrfToken:'launch-viewer'},60),url:base,httpOnly:true,sameSite:'Lax'}]);await readContext.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base||['data:','blob:'].includes(u.protocol))return route.continue();report.externalRequests.push(u.href);return route.abort();});
  const readPage=await readContext.newPage();observe(readPage);await readPage.goto(base+linked.sourceHref);await readPage.waitForSelector('[data-sw-inbox-selected]');
  check('launch: a source reader sees only permitted inquiry and no mutation form',await readPage.locator('[data-sw-inbox-card]').count()===1&&await readPage.locator('[data-sw-form=followup],[data-sw-action=followup-open],[data-sw-form=inbox-update],[data-sw-form=inbox]').count()===0);
  check('launch: a source reader without task-room access cannot see its private task details',await readPage.locator('[data-sw-followup]').innerText().then(t=>t.includes('대화방에 접근할 수 없어요')&&!t.includes(action)));
  company.store.put('channels','ig',{...company.store.get('channels','ig'),teamId:'other-team'});await readPage.locator('[data-sw-action=refresh]').click();await readPage.waitForFunction(()=>!socialWorkspaceState.loading&&!socialWorkspaceState.busy);
  check('launch: revoked source access removes the selected content and shows an honest unavailable state',await readPage.locator('[data-sw-inbox-card]').count()===0&&await readPage.locator('.sw-workspace').innerText().then(t=>t.includes('연결된 문의를 볼 수 없어요')&&!t.includes(original)&&!t.includes(action)));
  await readPage.locator('[data-sw-action=inbox-all]').click();check('launch: all-list escape remains available after source permission is revoked',await readPage.locator('[data-sw-action=inbox-all]').count()===0&&!new URL(readPage.url()).searchParams.has('inboxId'));await readContext.close();
  check('launch: setup and internal follow-up flows made no SNS AI or Meta call',externalCalls()===initialCalls,{publication:report.providerSends.length,ai:report.aiCalls.length,meta:report.metaReadCalls.length,replies:report.metaWriteCalls?.length||0});
  report.launch={checked:report.checks.length-start,passed:report.checks.slice(start).filter(r=>r.ok).length,synthetic:true,livePublication:false};
}
