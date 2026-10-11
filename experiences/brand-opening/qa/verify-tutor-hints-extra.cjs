const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {finishPractice}=require('./practice-browser-helpers.cjs');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4314',output=path.join(__dirname,'tutor-hints-20261010');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],httpErrors=[],external=[];let browser,page;
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name);};
async function choose(id){await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();await page.locator('[data-tutor-action="finish"]').click();}
async function setup(tutor='marin',viewport={width:390,height:844}){
 const ctx=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:true,reducedMotion:'reduce'});
 ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))httpErrors.push({url:r.url(),status:r.status()});});});
 await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith(base)||/^(data|blob):/.test(u))return r.continue();external.push(u);return r.abort();});
 page=await ctx.newPage();await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);await choose(tutor);return ctx;
}
async function open(game){await page.locator('[data-view="play"]').click();await page.locator(`[data-game="${game}"]`).click();await page.locator('.tutor-practice[open]').waitFor();await page.locator('.game-frame').evaluate(f=>{const u=new URL(f.src);u.searchParams.set('qa','1');f.src=u.href;});await finishPractice(page);await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');return page.frameLocator('.game-frame');}
async function help(){await page.locator('.game-tutor-help').click();await page.locator('.game-tutor-guide[open]').waitFor();}
async function row(entry){return page.locator(`[data-support-type="${entry.type}"][data-support-id="${entry.id}"] .tutor-support-retry`);}
(async()=>{try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 {
  const ctx=await setup(),frame=await open('runner');
  await frame.locator('body').evaluate(async()=>{window.__runner.auto();window.__runner.fast(6);const at=performance.now();while(!(window.__runner.state().current?.steps.length===1&&window.__runner.state().current.steps[0]==='jump')){if(performance.now()-at>30000||window.__runner.state().finished)throw Error('No jump mission reached');await new Promise(r=>setTimeout(r,15));}window.__runner.auto(false);window.__runner.fast(3);});
  await frame.locator('body').evaluate(async()=>{const at=performance.now();let slow=false;for(;;){const ratio=parseFloat(document.querySelector('#say-near').style.transform.match(/scaleX\(([^)]+)/)?.[1]);if(Number.isFinite(ratio)&&ratio<=.015)break;if(!slow&&Number.isFinite(ratio)&&ratio<.2){window.__runner.fast(.1);slow=true;}if(performance.now()-at>45000)throw Error('Jump marker not reached');await new Promise(r=>setTimeout(r,15));}window.__runner.fast(0);});
  await page.locator('.game-frame').focus();await page.keyboard.press('ArrowUp');await frame.locator('body').evaluate(()=>window.__runner.fast(40));
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().difficulties.some(e=>e.type==='timing'&&e.step==='jump'));
  await help();const entry=await page.evaluate(()=>window.__synkGameTutor.metrics().difficulties.find(e=>e.type==='timing'&&e.step==='jump'));
  check('a real jump input at the late marker becomes a timing hint',!!entry&&entry.timed);check('runner timing still is not a language diagnosis',await page.evaluate(()=>!window.__synkGameTutor.metrics().difficulties.some(e=>e.type==='language')));
  await page.screenshot({path:path.join(output,'marin-jump-timing.png')});const before=await frame.locator('body').evaluate(()=>JSON.stringify(window.__runner.state().answers));await (await row(entry)).click();
  check('the focused jump rehearsal includes its marker timing',await page.evaluate(()=>window.__synkGameTutor.metrics().practice.steps.join()==='jump'&&window.__synkGameTutor.metrics().practice.cueInMs!==null));
  await finishPractice(page);check('jump rehearsal does not replace the original timing miss',before===await frame.locator('body').evaluate(()=>JSON.stringify(window.__runner.state().answers)));await page.locator('#panel-close').click();await ctx.close();
 }
 {
  const ctx=await setup('kkamong'),frame=await open('rhythm');
  const note=await frame.locator('body').evaluate(()=>window.synkRhythm.snapshot().notes.find(n=>n.duration>0&&n.state==='pending'));
  check('the real chart has a held note for the control check',!!note);await frame.locator('body').evaluate((el,t)=>window.__rhythm.seek(t),note.time-.05);await page.locator('.game-frame').focus();const key=note.lane===1?'j':'f';await page.keyboard.down(key);await page.waitForTimeout(60);await page.keyboard.up(key);
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().difficulties.some(e=>e.step.startsWith('hold-')));await help();const entry=await page.evaluate(()=>window.__synkGameTutor.metrics().difficulties.find(e=>e.step.startsWith('hold-')));
  check('early release of an actual held note gets control help',entry.type==='control');await (await row(entry)).click();await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice.phase==='try');
  await page.keyboard.press(entry.step==='hold-right'?'j':'f');check('a quick press cannot pass the held-note rehearsal',await page.evaluate(()=>window.__synkGameTutor.metrics().practice.phase==='try'));
  await finishPractice(page);check('holding through the required duration finishes only the focus exercise',await page.evaluate(value=>window.__synkGameTutor.metrics().difficulties.find(e=>e.id===value.id&&e.type===value.type).practised,entry));await page.locator('#panel-close').click();await ctx.close();
 }
 for(const viewport of [{width:320,height:568},{width:740,height:320}]){
  const ctx=await setup('mongle',viewport),frame=await open('runner');await frame.locator('body').evaluate(()=>{window.__runner.auto();window.__runner.plan(Array(12).fill('miss'));window.__runner.fast(5);});await page.waitForFunction(()=>window.__synkGameTutor.metrics().difficulties.length>0);await help();
  const bounds=await page.locator('.game-tutor-guide').evaluate(d=>({overflow:d.scrollWidth-d.clientWidth,controls:[...d.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))}));
  check(`${viewport.width}x${viewport.height}: support fits without horizontal overflow`,bounds.overflow<=1);check(`${viewport.width}x${viewport.height}: support controls remain touch sized`,bounds.controls.every(b=>b.w>=44&&b.h>=44));await page.screenshot({path:path.join(output,`support-${viewport.width}x${viewport.height}.png`)});
  await page.locator('.game-tutor-continue').click();await page.locator('#panel-close').click();await ctx.close();
 }
 {
  const ctx=await setup(),frame=await open('runner');await frame.locator('#pause-button').click();await frame.locator('#back-home').click();await frame.locator('#listening-check').click();await frame.locator('#check-choices button').first().evaluate(async b=>{while(b.disabled)await new Promise(r=>setTimeout(r,40));});
  const state=await frame.locator('body').evaluate(()=>window.__runner.check());await frame.locator('#check-choices button').nth((state.correct+1)%3).click();await page.waitForFunction(()=>window.__synkGameTutor.metrics().difficulties.some(e=>e.type==='language'&&e.mode==='check'));await help();const entry=await page.evaluate(()=>window.__synkGameTutor.metrics().difficulties.find(e=>e.type==='language'&&e.mode==='check'));
  check('untimed runner listening choice can produce an actual sentence hint',!!entry);await (await row(entry)).click();const block='**/korean-runner/assets/voice/check-*.mp3';await ctx.route(block,r=>r.abort());await page.locator('.tutor-review-listen').click();await page.waitForFunction(()=>document.querySelector('.tutor-review-status')?.textContent.includes('불러오지'));
  check('failed review audio cannot unlock an answer or a success',await page.locator('.tutor-review-option').first().isDisabled()&&!await page.evaluate(()=>window.__synkGameTutor.metrics().review.correct));await ctx.unroute(block);await page.locator('.tutor-review-listen').click();await page.waitForFunction(()=>window.__synkGameTutor.metrics().review.heard);await page.locator('.tutor-review-option').nth(entry.review.correct).click();await page.locator('.tutor-review-return').click();
  check('a guided listening review cannot regrade the original check',await frame.locator('body').evaluate(()=>window.__runner.check().rightCount===0));check('a review from the lobby does not start a new runner round',await frame.locator('body').evaluate(()=>window.__runner.state().screen==='lobby'));await page.locator('#panel-close').click();await ctx.close();
 }
 check('no extra browser exceptions',errors.length===0,errors);check('no failed assets apart from the deliberate blocked audio',httpErrors.length===0,httpErrors);check('no external requests',external.length===0,external);
 fs.writeFileSync(path.join(output,'extra-result.json'),JSON.stringify({at:new Date().toISOString(),base,pass:checks.length,fail:0,checks,errors,httpErrors,external},null,2));console.log(`DONE ${checks.length} extra checks`);
 }catch(error){console.error(error);if(page)await page.screenshot({path:path.join(output,'extra-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'extra-failure.json'),JSON.stringify({at:new Date().toISOString(),error:String(error),checks,errors,httpErrors,external},null,2));throw error;}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
