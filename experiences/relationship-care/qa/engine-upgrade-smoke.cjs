"use strict";
// Isolated Chrome + synthetic notebooks. No paid API, real login, external send or deployment.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'engine-upgrade-20261006'),report={at:new Date().toISOString(),checks:[],errors:[],missing:[],screenshots:[]};
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,detail});assert.ok(passed,name+': '+JSON.stringify(detail));};
const day=(offset=0)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
async function downloadBytes(download){const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
async function capture(page,name){await page.evaluate(()=>{document.getElementById('toast').hidden=true;scrollTo(0,0)});await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});report.screenshots.push(name);check(name+' fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
(async()=>{
 const model=await import('../model.mjs'),{createServer}=await import('../server.mjs');await fs.mkdir(out,{recursive:true});
 const server=createServer({port:0});await server.start();const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const who=model.makePerson({id:'person_test_jimin',name:'가상 지민',relationship:'친구',recipientPreference:{confirmed:true,allowEmoji:true,avoidPhrases:['힘내']}}),other=model.makePerson({id:'person_test_seoyeon',name:'가상 서연'});
  const event=model.makeEvent({id:'event_wedding',personId:who.id,type:'wedding',date:day(4),time:'14:30',location:'서울 예시홀',title:'지민 결혼식'}),quiet=model.makeEvent({id:'event_quiet',personId:who.id,type:'memorial',date:day(1),title:'기억할 날'});
  let seed={...model.emptyState(),people:[who,other],events:[event,quiet]};
  seed=model.captureSource(seed,{personId:who.id,title:'선택한 예시 대화',kind:'text',text:'지난번 함께 걸었던 강변이 좋았어. 커피보다 차를 좋아해요. 이 원문 전체는 카드에 담지 않아요.',memories:[{kind:'memory',text:'함께 걸었던 강변의 기억',sourceQuote:'지난번 함께 걸었던 강변이 좋았어.'},{kind:'preference',text:'커피보다 차를 좋아해요.',sourceQuote:'커피보다 차를 좋아해요.'}]});
  seed=model.recordCareAction(seed,{personId:who.id,kind:'contact',occurredOn:day(),note:'다음 산책을 함께 약속한 날'});
  for(const title of ['안부를 다시 물어보기','일정을 한번 더 확인하기','이제 멈출 안부'])seed=model.addFollowup(seed,{personId:who.id,title,dueOn:day()});
  const context=await browser.newContext({viewport:{width:375,height:900},permissions:['clipboard-read','clipboard-write'],timezoneId:'Asia/Seoul'}),page=await context.newPage();
  await page.addInitScript(seed=>localStorage.setItem('synk.care.local.v1',JSON.stringify(seed)),seed);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))report.missing.push(response.status()+': '+response.url());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  check('home exposes due followups before schedule',await page.locator('#followup-list .followup-card').count()===3);
  await capture(page,'home-375');
  await page.locator('[data-home-draft="event_wedding"]').click();
  const asked=[];for(let i=0;i<5&&await page.locator('#prepare-form').isVisible();i++){
   const select=page.locator('[data-preparation-field]'),field=await select.getAttribute('data-preparation-field');
   asked.push(field);
   if(field==='timeMinutes')await select.selectOption('2');else if(field==='attendance')await select.selectOption('1');else if(field==='budgetWon')await page.locator('#preparation-budget').fill('50000');else throw Error('Unexpected preparation field '+field);
   await page.locator('#prepare-form button[type=submit]').click();
  }
  check('target event is ready before the first answer and no answer is discarded',JSON.stringify(asked)===JSON.stringify(['timeMinutes','attendance','budgetWon']),asked);
  check('declared preparation budget and concrete steps reach user',await page.locator('#preparation-result').innerText().then(text=>text.includes('50,000')&&text.includes('배송비')));
  check('no internal engine names in preparation product copy',!(await page.locator('#care-preparation').innerText()).match(/Core|Ask|Atlas/));
  check('alternatives and recommendation evidence start collapsed',await page.locator('.preparation-alternatives').count()>0&&await page.locator('.preparation-alternatives[open],.preparation-reasons[open]').count()===0&&await page.locator('[data-use-preparation="0"]').isVisible());
  await capture(page,'preparation-375');
  await page.setViewportSize({width:1440,height:1000});await page.locator('#care-preparation').scrollIntoViewIfNeeded();await page.evaluate(()=>{document.getElementById('toast').hidden=true;document.getElementById('workspace').scrollIntoView({behavior:'instant',block:'start'})});await page.screenshot({path:path.join(out,'prepare-ready-desktop.png')});report.screenshots.push('prepare-ready-desktop');await page.setViewportSize({width:375,height:900});
  await page.locator('[data-use-preparation="0"]').click();await page.locator('[data-preparation-rating="4"]').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.care.local.v1')));
  check('explicit selected plan and direct rating are saved separately from actual care',saved.events.find(e=>e.id==='event_wedding').carePlan.amountWon===50000&&saved.preparations.length===1&&saved.preparations[0].satisfaction===4&&saved.activities.length===1);
  check('selection duration measures shown-to-selected wall time',Number.isInteger(saved.preparations[0].elapsedSeconds)&&saved.preparations[0].elapsedSeconds===Math.floor((Date.parse(saved.preparations[0].selectedAt)-Date.parse(saved.preparations[0].shownAt))/1000));
  await page.locator('[data-reset-preparation]').click();check('preparation conditions can be restarted after choosing',await page.locator('[data-preparation-field]').getAttribute('data-preparation-field')==='timeMinutes');await page.locator('[data-preparation-field]').selectOption('0');await page.locator('#prepare-form button[type=submit]').click();
  check('restarted short preparation does not retain previous budget',!(await page.locator('#preparation-result').innerText()).includes('50,000'));
  await page.locator('#draft-text').fill('가상 서연님, 2099-01-01 꼭 찾아갈게. 힘내.');await page.locator('#review-message').click();
  const issues=await page.locator('#message-review').innerText();check('message review identifies other recipient date promise and avoided phrase',issues.includes('다른 사람 이름')&&issues.includes('다른 날짜')&&issues.includes('약속 표현')&&issues.includes('피할 표현'),issues);
  const preferenceBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.care.local.v1')).people[0].recipientPreference);
  await page.locator('#draft-text').fill('지민아, 축하해.');await page.locator('#review-message').click();
  check('edit preference remains a proposal until confirmed',await page.locator('[data-remember-preference]').count()>0&&await page.evaluate(before=>JSON.stringify(JSON.parse(localStorage.getItem('synk.care.local.v1')).people[0].recipientPreference)===JSON.stringify(before),preferenceBefore));
  await page.locator('#draft-preference-review article').filter({hasText:'다음에도 짧게 쓰기'}).locator('button').click();
  check('confirmed edited style is stored explicitly',await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.care.local.v1')).people[0].recipientPreference.length==='short'));
  await page.setViewportSize({width:320,height:850});await capture(page,'expression-320');
  await page.locator('#show-home').click();await page.locator(`#followup-list [data-followup-now="${seed.followups[0].id}"]`).click();
  check('now opens actual care input without claiming completion',await page.locator('#care-log-note').inputValue()==='안부를 다시 물어보기'&&await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.care.local.v1')).followups.every(x=>x.status==='pending')));
  await page.locator('#show-home').click();await page.locator(`#followup-list [data-followup-later="${seed.followups[0].id}"]`).click();const delay=page.locator('.followup-delay:visible');await delay.locator('input').fill(day(2));await delay.locator('button').click();
  check('later leaves home today queue and retains scheduled date',await page.locator('#followup-list .followup-card').count()===2&&await page.evaluate(date=>JSON.parse(localStorage.getItem('synk.care.local.v1')).followups.some(x=>x.dueOn===date&&x.status==='pending'),day(2)));
  await page.locator('#followup-list [data-followup-stop]').last().click();await page.locator('#confirm-dialog [value=cancel]').click();check('stopping followup can be cancelled',await page.locator('#followup-list .followup-card').count()===2);
  await page.locator('#followup-list [data-followup-stop]').last().click();await page.locator('#confirm-dialog [value=confirm]').click();await page.waitForFunction(()=>document.querySelectorAll('#followup-list .followup-card').length===1);
  await page.locator('#followup-list [data-followup-done]').first().click();check('done and stop are distinct persisted states',await page.evaluate(()=>{const f=JSON.parse(localStorage.getItem('synk.care.local.v1')).followups;return f.some(x=>x.status==='done')&&f.some(x=>x.status==='dismissed')&&f.some(x=>x.status==='pending')}));
  await page.locator('#capture-person').selectOption(who.id);await page.locator('#capture-source').fill(day(3)+' 다시 안부 연락할게.');await page.locator('#capture-extract').click();
  check('explicit source followup remains unchecked before review',await page.locator('[data-capture-followup]').count()>0&&await page.locator('[data-capture-followup] input[type=checkbox]:checked').count()===0);
  await page.locator('[data-capture-followup] input[type=checkbox]').first().check();await page.locator('#capture-save').click();
  check('confirmed source followup keeps source link and quote',await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('synk.care.local.v1')).followups.at(-1);return x.sourceId&&x.sourceQuote.includes('안부')}));
  await page.locator('#tab-history').click();await page.locator('#memory-card-builder>summary').click();
  check('card starts with no private items selected',await page.locator('[data-card-selected]:checked').count()===0);
  await page.locator('[data-card-selected]').first().check();await page.locator('[data-card-excerpt]').first().fill('우리가 함께 걸은 길을 오래 기억해.');await page.locator('#memory-card-title').fill('우리의 산책');await page.locator('#memory-card-message').fill('다음에도 천천히 함께 걸어 보자.');
  await page.locator('#preview-memory-card').click();await page.locator('#memory-card-dialog').waitFor({state:'visible'});check('memory card renders full PNG preview',await page.locator('#memory-card-preview').evaluate(img=>img.complete&&img.naturalWidth===1080));
  const downloaded=page.waitForEvent('download');await page.locator('#download-memory-card').click();const bytes=await downloadBytes(await downloaded);await fs.writeFile(path.join(out,'selected-memory.png'),bytes);
  check('memory card download is PNG and excludes original source serialization',bytes.subarray(1,4).toString()==='PNG'&&!bytes.includes(Buffer.from('이 원문 전체는 카드에 담지 않아요.')));
  check('card excerpt does not mutate notebook original memory',await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.care.local.v1')).memories[0].text==='함께 걸었던 강변의 기억'));
  await capture(page,'memory-card-320');await page.locator('#close-memory-card').click();
  const beforePhoto=await page.evaluate(()=>localStorage.getItem('synk.care.local.v1')),photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle='#ECF1D3';ctx.fillRect(0,0,320,240);ctx.fillStyle='#466BA8';ctx.fillRect(50,40,220,160);return c.toDataURL('image/png').split(',')[1]});
  await page.locator('#memory-card-photo').setInputFiles({name:'synthetic-local-photo.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});await page.locator('#preview-memory-card').click();await page.locator('#memory-card-dialog').waitFor({state:'visible'});
  const photoDownload=page.waitForEvent('download');await page.locator('#download-memory-card').click();const photoBytes=await downloadBytes(await photoDownload);await fs.writeFile(path.join(out,'selected-memory-photo.png'),photoBytes);
  check('optional local photo renders without storing file in notebook',photoBytes.subarray(1,4).toString()==='PNG'&&!photoBytes.equals(bytes)&&await page.evaluate(before=>localStorage.getItem('synk.care.local.v1')===before,beforePhoto));await page.locator('#close-memory-card').click();
  await page.locator('#tab-events').click();await page.locator('[data-draft-event="event_quiet"]').click();await page.setViewportSize({width:375,height:900});await capture(page,'quiet-375');
  await page.setViewportSize({width:1440,height:1000});await page.locator('#show-home').click();await capture(page,'home-1440');
  await page.locator('[data-home-draft="event_wedding"]').click();await capture(page,'preparation-1440');
  await page.locator('#tab-events').click();await page.locator('[data-edit-event="event_wedding"]').click();await page.locator('#event-type').selectOption('condolence');await page.locator('#event-title').fill('조심스럽게 챙길 날');await page.locator('#event-form button[type=submit]').click();await page.locator('#tab-message').click();await page.locator('[data-preparation-field]').selectOption('1');await page.locator('#prepare-form button[type=submit]').click();
  check('editing an event refreshes preparation and removes celebratory suggestions',await page.locator('[data-use-preparation="0"]').isVisible()&&!(await page.locator('#preparation-result').innerText()).includes('선물 준비하기')&&await page.locator('body').getAttribute('data-mood')==='quiet');
  let history=model.recordPreparation(seed,{personId:who.id,eventId:event.id,recommendedAction:'contact'});const first=history.preparations[0];history={...history,preparations:Array.from({length:500},(_,i)=>({...first,id:'prep_limit_'+i}))};history=model.importBackup(history);
  const capContext=await browser.newContext({viewport:{width:320,height:850},timezoneId:'Asia/Seoul'}),cap=await capContext.newPage();cap.on('pageerror',error=>report.errors.push(error.message));await cap.addInitScript(value=>localStorage.setItem('synk.care.local.v1',JSON.stringify(value)),history);await cap.goto('http://127.0.0.1:'+server.address().port);await cap.waitForFunction(()=>document.documentElement.dataset.ready==='true');await cap.locator('[data-home-draft="event_wedding"]').click();await cap.locator('[data-preparation-field]').selectOption('1');await cap.locator('#prepare-form button[type=submit]').click();await cap.screenshot({path:path.join(out,'statistics-cap-320.png'),fullPage:true});
  check('statistics cap leaves actionable preparation visible',await cap.locator('#preparation-log-status').innerText().then(text=>text.includes('500개'))&&await cap.locator('[data-use-preparation="0"]').isVisible(),await cap.evaluate(()=>({status:document.getElementById('preparation-log-status').textContent,count:JSON.parse(localStorage.getItem('synk.care.local.v1')).preparations.length,toast:document.getElementById('toast').textContent})));await cap.locator('[data-use-preparation="0"]').click();check('plan saves at statistics cap without deleting prior records',await cap.evaluate(()=>{const s=JSON.parse(localStorage.getItem('synk.care.local.v1'));return s.preparations.length===500&&s.events[0].carePlan.note.length>0})&&await cap.locator('[data-preparation-rating]').count()===0);await capContext.close();
  const futureContext=await browser.newContext(),future=await futureContext.newPage();future.on('pageerror',error=>report.errors.push(error.message));await future.addInitScript(value=>localStorage.setItem('synk.care.local.v1',JSON.stringify(value)),{...seed,preparations:[{...first,shownAt:new Date(Date.now()+86400000).toISOString()}]});await future.goto('http://127.0.0.1:'+server.address().port);await future.waitForFunction(()=>document.documentElement.dataset.ready==='true');check('future clock history remains usable with visible statistics caveat',await future.locator('#preparation-summary').isVisible()&&await future.locator('#preparation-summary').innerText().then(text=>text.includes('시간 확인이 필요한 기록 1개')));await futureContext.close();
  check('no uncaught browser errors or missing resources',!report.errors.length&&!report.missing.length,{errors:report.errors,missing:report.missing});report.ok=true;await context.close();
 }catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
 finally{await browser.close();await server.stop();await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
