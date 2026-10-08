// Free, isolated local browser proof. No provider calls, real accounts or real users.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const out = fileURLToPath(new URL('../experiences/atlas-lab/qa/dating-insights/', import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-browser-'));
let time = Date.now(), server, browser, origin;
const report = { at: new Date().toISOString(), status: 'running', modelCalls: 0, actualUsers: 0, paths: [], errors: [], externalRequests: [], screenshots: [] };
const shot = async (page, name) => { await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflow`); assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)), [], `${name} missing image`); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); report.screenshots.push(`${name}.png`); };
const click = (page, key) => page.locator(`[data-action="${key}"]`).click();
const snap = page => page.evaluate(() => window.synkDating.snapshot());
async function wait(page, fn, arg) { await page.waitForFunction(fn, arg); await page.waitForFunction(() => !document.getElementById('content').hasAttribute('aria-busy')); }
async function opened(page, text) { const summary = page.locator('summary').filter({ hasText: text }).last(), d = summary.locator('..'); if (!await d.evaluate(n => n.open)) await summary.click(); return d; }
const local = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
async function pageFor(role, width) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== origin) { report.externalRequests.push(url.href); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${origin}/atlas-lab/dating.html${role ? `?demo=${role}` : ''}`); await page.waitForFunction(() => window.synkDating);
  if (role) await wait(page, () => !!window.synkDating.snapshot().view);
  return page;
}
async function onboard(page, nickname) {
  await page.getByLabel('사용할 이름', { exact: true }).fill(nickname);
  await page.getByLabel('만나기 편한 지역 (선택)', { exact: true }).fill('서울');
  await page.getByLabel('짧은 소개 (선택)', { exact: true }).fill('가상 역할로 기능을 확인하고 있어요.');
  for (const name of ['adult', 'public', 'invites', 'save']) await page.locator(`input[name="${name}"]`).check();
  await click(page, 'onboard'); await wait(page, () => window.synkDating.snapshot().view?.consents?.storePreferences === true);
}
async function edit(page, id, value) {
  await click(page, 'nav-profile');
  const d=page.locator('[data-preference-field="'+id+'"]'); if(!await d.evaluate(n=>n.open))await d.locator('summary').click();
  await d.locator('[name="value"]').selectOption(value);await d.locator('[name="scope"]').selectOption('baseline');await d.locator('[data-action="edit-'+id+'"]').click();
  await page.waitForSelector('[data-preview="pending"]');await click(page,'preview-apply');await wait(page,({id,value})=>{const field=window.synkDating.snapshot().view.discovery.fields.find(f=>f.id===id);return field.source==='baseline'&&String(field.value)===value;},{id,value});
}
async function sceneRow(page,id){await opened(page,'내 취향이 잘 모르겠다면');const row=page.locator('[data-scene="'+id+'"]');if(!await row.evaluate(n=>n.open))await row.locator('summary').click();return row;}
try {
  await fs.mkdir(out,{recursive:true});server=createDatingServer({databasePath:path.join(tmp,'demo.sqlite'),clock:()=>new Date(time)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const a=await pageFor('adult-a',390),b=await pageFor('adult-b',1280);await onboard(a,'가상 비교 하나');await onboard(b,'가상 비교 둘');
  await click(a,'answer-true');await wait(a,()=>window.synkDating.snapshot().view.discovery.question?.field==='availability');await click(a,'answer-weekend');
  for(let i=0;i<14;i++){await a.waitForFunction(()=>!document.getElementById('content').hasAttribute('aria-busy'));const d=(await snap(a)).view.discovery;if(!d.question||d.question.optional)break;await a.locator('[data-question] .choices button').first().click();}
  await wait(a,()=>window.synkDating.snapshot().view.discovery.status==='ready');
  const insights=await opened(a,'지금 추천에서 확인된 것과 남은 것');assert.match(await insights.innerText(),/미확인|확인|바꿔/);assert.ok((await snap(a)).view.discovery.insights.coverage);await shot(a,'recommendation-evidence-390');
  report.paths.push('evidence coverage and bounded single-answer stability are visible without a compatibility probability');
  const mode=await opened(a,'질문은 내 속도로');await mode.locator('[name="question-mode"]').selectOption('thorough');await mode.locator('[data-action="question-mode-save"]').click();await wait(a,()=>window.synkDating.snapshot().view.discovery.questionControl.mode==='thorough');
  const scene=(await snap(a)).view.discovery.scenes.find(s=>s.canRespond);assert.ok(scene);const before=(await snap(a)).view.discovery.fields.find(f=>f.id===scene.field).value;
  let row=await sceneRow(a,scene.id);await row.locator('[data-action="scene-a"]').click();await wait(a,id=>!!window.synkDating.snapshot().view.discovery.scenes.find(s=>s.id===id).response,scene.id);
  assert.equal((await snap(a)).view.discovery.fields.find(f=>f.id===scene.field).value,before);row=await sceneRow(a,scene.id);await shot(a,'scene-choice-390');await row.screenshot({path:path.join(out,'scene-detail-390.png')});report.screenshots.push('scene-detail-390.png');await row.locator('[data-action="scene-preview"]').click();await a.waitForSelector('[data-preview="pending"]');await click(a,'preview-cancel');assert.equal((await snap(a)).view.discovery.fields.find(f=>f.id===scene.field).value,before);
  row=await sceneRow(a,scene.id);const suggested=(await snap(a)).view.discovery.scenes.find(s=>s.id===scene.id).suggestion.value;await row.locator('[data-action="scene-preview"]').click();await a.waitForSelector('[data-preview="pending"]');await click(a,'preview-apply');await wait(a,({field,value})=>window.synkDating.snapshot().view.discovery.fields.find(f=>f.id===field).value===value,{field:scene.field,value:suggested});
  row=await sceneRow(a,scene.id);await row.locator('[data-action="scene-withdraw"]').click();await wait(a,id=>!window.synkDating.snapshot().view.discovery.scenes.find(s=>s.id===id).response,scene.id);assert.equal((await snap(a)).view.discovery.fields.find(f=>f.id===scene.field).value,suggested);
  report.paths.push('scene choice stays private and changes no criterion until preview apply; cancel and response withdrawal preserve independent preferences');
  await edit(a,'wants.pace','lead');await edit(a,'wants.plan','planned');await click(a,'nav-discover');
  const comparison=await opened(a,'두 사람, 내 기준에서 무엇이 다를까요?');await comparison.locator('[name="compare-first"]').selectOption('demo:sample-2');await comparison.locator('[name="compare-second"]').selectOption('demo:sample-3');await comparison.locator('[name="compare-wants.pace"]').check();await comparison.locator('[name="compare-wants.plan"]').check();const revision=(await snap(a)).view.revision;await comparison.locator('[data-action="compare-candidates"]').click();assert.equal(await comparison.locator('.comparison-row').count(),2);assert.equal((await snap(a)).view.revision,revision);await shot(a,'candidate-comparison-390');await comparison.locator('.comparison-row').first().screenshot({path:path.join(out,'comparison-detail-390.png')});report.screenshots.push('comparison-detail-390.png');assert.match(await comparison.innerText(),/다른 점/);
  report.paths.push('two authorized candidates compare on selected criteria without storing priorities or scoring people');
  await edit(a,'self.pace','lead');let disclosure=await opened(a,'상대에게 보여줄 답 정하기');await disclosure.locator('[name="sync-self.pace"]').check();await disclosure.locator('[data-action="publish-review"]').click();const beforePublish=(await snap(a)).view.revision;await shot(a,'disclosure-review-390');await disclosure.locator('[data-action="publish-cancel"]').click();assert.equal((await snap(a)).view.revision,beforePublish);assert.equal((await snap(a)).view.profile.values['self.pace'],undefined);
  await disclosure.locator('[data-action="publish-review"]').click();await disclosure.locator('[data-action="publish-baseline"]').click();await wait(a,()=>window.synkDating.snapshot().view.profile.values['self.pace']==='lead');assert.equal((await snap(a)).view.profile.values[scene.field],undefined);
  await click(a,'nav-settings');await a.locator('[name="public"]').uncheck();await click(a,'consents');await wait(a,()=>window.synkDating.snapshot().view.consents.profilePublic===false);
  await edit(a,'self.pace','listen');disclosure=await opened(a,'상대에게 보여줄 답 정하기');await disclosure.locator('[name="sync-self.pace"]').check();await disclosure.locator('[data-action="publish-review"]').click();await disclosure.locator('[data-action="publish-baseline"]').click();await wait(a,()=>window.synkDating.snapshot().view.profile.values['self.pace']==='listen');assert.equal((await snap(a)).view.consents.profilePublic,false);
  report.paths.push('selected baseline self answer is reviewed before publishing; cancellation, other private answers and profile visibility are preserved');
  await click(a,'nav-settings');await a.locator('[name="public"]').check();await click(a,'consents');await wait(a,()=>window.synkDating.snapshot().view.consents.profilePublic===true&&window.synkDating.snapshot().view.discovery.status==='ready');
  await click(a,'nav-discover');let experience=await opened(a,'추천이 내 방향에 맞았나요?');await experience.locator('[data-action="experience-start"]').click();await wait(a,()=>window.synkDating.snapshot().view.experience.records.length===1);
  experience=await opened(a,'추천이 내 방향에 맞았나요?');await experience.locator('[name="intent-response"]').selectOption('partly');await experience.locator('[data-action="experience-respond"]').click();await wait(a,()=>window.synkDating.snapshot().view.experience.records[0].responses.intent?.value==='partly');
  experience=await opened(a,'추천이 내 방향에 맞았나요?');await experience.locator('[data-action="experience-correct"]').click();const correctionSource=(await snap(a)).view.experience.records[0].id;
  await edit(a,'wants.plan','spontaneous');await click(a,'nav-discover');experience=await opened(a,'추천이 내 방향에 맞았나요?');await experience.locator('[data-action="experience-start"]').click();await wait(a,()=>window.synkDating.snapshot().view.experience.records.length===2);assert.equal((await snap(a)).view.experience.records[1].followup.sourceDecisionId,correctionSource);
  experience=await opened(a,'추천이 내 방향에 맞았나요?');await experience.locator('[name="followup-response"]').selectOption('better');await experience.locator('[data-action="followup-save"]').click();await wait(a,()=>window.synkDating.snapshot().view.experience.records[1].responses.followup?.value==='better');experience=await opened(a,'추천이 내 방향에 맞았나요?');await shot(a,'correction-followup-390');await experience.locator('[data-followup]').screenshot({path:path.join(out,'followup-detail-390.png')});report.screenshots.push('followup-detail-390.png');
  await b.evaluate(()=>window.synkDating.reload());assert.equal((await snap(b)).view.experience.records.length,0);await a.reload();await wait(a,()=>!!window.synkDating.snapshot().view);assert.equal((await snap(a)).view.experience.records[1].responses.followup.value,'better');
  await click(a,'nav-settings');const history=await opened(a,'나만 보는 경험 기록');await history.locator('[data-action="experience-history-withdraw"]').last().click();await wait(a,()=>!window.synkDating.snapshot().view.experience.records[0].responses.intent);assert.equal((await snap(a)).view.experience.records[1].followup.valid,false);assert.equal((await snap(a)).view.discovery.fields.find(f=>f.id==='wants.plan').value,'spontaneous');
  await click(a,'nav-discover');experience=await opened(a,'추천이 내 방향에 맞았나요?');await experience.locator('[data-action="followup-withdraw"]').click();await wait(a,()=>!window.synkDating.snapshot().view.experience.records[1].responses.followup);
  report.paths.push('source experience links explicit correction and next recommendation; private followup persists, source withdrawal invalidates comparison and response withdrawal remains available');
  await a.setViewportSize({width:320,height:950});await shot(a,'final-320');assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(report,null,2));}
