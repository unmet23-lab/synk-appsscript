// Focused real-browser QA for the existing Atlas lab consultation consumer.
// Run: node tests/atlas-lab-question-value-smoke.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from '../experiences/learning-hub/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')] }));
const output = fileURLToPath(new URL('../experiences/atlas-lab/qa/question-value/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { status: 'running', at: new Date().toISOString(), origin: base, errors: [], missing: [], screenshots: [] };
async function completeQuestions(page, choices) {
  const answered = [];
  for (let step = 0; step < 20; step += 1) {
    const question = await page.evaluate(() => window.synkAtlasLab.consult().question ?? null);
    if (!question) return answered;
    const optionId = choices[question.id];
    assert.ok(optionId, `unexpected required question ${question.id}`);
    const option = (question.displayOptions || question.options).find(item => item.id === optionId);
    assert.ok(option);
    await page.getByRole('button', { name: option.label, exact: true }).click();
    if (question.selection === 'multiple') await page.getByRole('button', { name: '선택한 작업으로 확인', exact: true }).click();
    answered.push({ question: question.id, answer: optionId });
  }
  throw new Error('Consultation did not finish within the available questions');
}
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport }), page = await context.newPage();
    await context.route('**/api/computer-interpretation', route => route.fulfill({ json: { available: false, reason: 'test-no-host' } }));
    await context.route('**/api/me', route => route.fulfill({ json: { user: null } }));
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) report.missing.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.goto(`${base}/atlas-lab/`);
    await page.waitForFunction(() => !!window.synkAtlasLab);
    assert.equal(await page.evaluate(() => globalThis.SynkLearning.Ask.VERSION), 'ask-1.1');
    await page.locator('#uses .chip', { hasText: '내 컴퓨터에 AI 설치하기' }).click();
    const first = await page.evaluate(() => { const c = window.synkAtlasLab.consult(); return { question: c.question.id, value: c.value, basis: c.basis }; });
    const timings = await page.evaluate(() => Array.from({ length: 10 }, () => { const start = performance.now(); window.synkAtlasLab.consult(); return performance.now() - start; }).sort((a, b) => a - b));
    assert.equal(first.question, 'localai');
    assert.equal(first.basis, 'declared-decision-value');
    assert.ok(first.value > 0);
    assert.match(await page.locator('.ask-card .mini').first().textContent(), /부족하거나 필요 이상/);
    assert.equal(await page.locator('.ask-card .chip').count(), 6, 'show choices, not all 63 combinations');
    const confirm = page.getByRole('button', { name: '선택한 작업으로 확인', exact: true });
    const large = page.getByRole('button', { name: '큰 대화 AI (27B~32B)', exact: true });
    const imageAI = page.getByRole('button', { name: '이미지 생성 AI', exact: true });
    assert.equal(await confirm.isDisabled(), true);
    await large.click();
    assert.equal(await large.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => Object.hasOwn(window.synkAtlasLab.answers(), 'localai')), false, 'no answer committed before confirmation');
    await large.click();
    assert.equal(await confirm.isDisabled(), true, 'deselecting every task cannot commit an empty answer');
    await large.click();
    await imageAI.click();
    assert.equal(await imageAI.getAttribute('aria-pressed'), 'true');
    const shot = path.join(output, `consultation-${viewport.width}.png`);
    await page.locator('#consult-title').locator('..').screenshot({ path: shot });
    report.screenshots.push(shot);
    await confirm.click();
    const combination = await page.evaluate(() => {
      const answers = window.synkAtlasLab.answers(), result = globalThis.SynkComputerRules.compute(answers);
      return { answers: answers.localai, os: result.os.pick, ram: result.ram.value, vram: result.gpu.vram, headline: result.headline.title };
    });
    assert.deepEqual(combination.answers, ['large', 'image']);
    assert.equal(combination.os, 'win'); assert.equal(combination.ram, 32); assert.equal(combination.vram, 24);
    assert.equal(await page.locator('#advice').textContent(), combination.headline);
    // Start a fresh session; direct choices now intentionally survive use edits.
    await page.reload();
    await page.waitForFunction(() => !!window.synkAtlasLab);
    await page.locator('#uses .chip', { hasText: '내 컴퓨터에 AI 설치하기' }).click();
    const choices = { localai: 'huge', owned: 'new', os: 'mac', place: 'home', budget: 'lt100', multitask: 'normal' };
    const answered = await completeQuestions(page, choices);
    assert.equal(await page.locator('.ask-card').count(), 0);
    assert.match(await page.locator('#advice-sub').textContent(), /모델을 한 단계 작게/);
    assert.match(await page.locator('#count').textContent(), /현재 기준에서 건너뛰어요/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    report[viewport.width === 1280 ? 'desktop' : 'mobile'] = { first, combination, chooserMs: { samples: timings.length, median: timings[5], max: timings.at(-1) }, answered, advice: await page.locator('#advice').textContent(), details: await page.locator('#advice-sub').textContent(), count: await page.locator('#count').textContent() };
    const actionPaths = [];
    for (const kind of ['mobile-development', 'laptop', 'desktop']) {
      await page.reload();
      await page.waitForFunction(() => !!window.synkAtlasLab);
      await page.locator('#uses .chip', { hasText: '내 컴퓨터에 AI 설치하기' }).click();
      if (kind === 'mobile-development') await page.locator('#uses .chip', { hasText: '코딩·앱 만들기' }).click();
      const pathChoices = kind === 'mobile-development' ? { ...choices, code: 'mobile', os: 'win' }
        : { ...choices, owned: 'have', 'current.ram': '4', 'current.kind': kind, 'current.os': 'win11', 'current.feel': 'untried' };
      const pathAnswers = await completeQuestions(page, pathChoices), details = await page.locator('#advice-sub').textContent();
      assert.ok(pathAnswers.some(answer => answer.question === (kind === 'mobile-development' ? 'code' : 'current.kind')));
      assert.match(details, kind === 'mobile-development' ? /Xcode/ : kind === 'laptop' ? /데스크톱을 더하세요/ : /램만 더 꽂는/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      actionPaths.push({ kind, answered: pathAnswers, details });
    }
    report[viewport.width === 1280 ? 'desktop' : 'mobile'].actionPaths = actionPaths;
    await context.close();
  }
  // The existing one-file build must include the new adapter rather than leaving
  // a module URL that breaks when a recipient opens the shared HTML locally.
  const share = path.join(output, 'share.html');
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../experiences/atlas-lab/build-share.mjs', import.meta.url)), share]);
  const shared = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  shared.on('pageerror', error => report.errors.push(error.message));
  await shared.goto(pathToFileURL(share).href);
  await shared.waitForFunction(() => !!window.synkAtlasLab);
  await shared.locator('#uses .chip', { hasText: '내 컴퓨터에 AI 설치하기' }).click();
  assert.equal(await shared.evaluate(() => window.synkAtlasLab.consult().question.id), 'localai');
  await shared.getByRole('button', { name: '큰 대화 AI (27B~32B)', exact: true }).click();
  await shared.getByRole('button', { name: '이미지 생성 AI', exact: true }).click();
  await shared.getByRole('button', { name: '선택한 작업으로 확인', exact: true }).click();
  assert.deepEqual(await shared.evaluate(() => window.synkAtlasLab.answers().localai), ['large', 'image']);
  report.share = share;
  await shared.close();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.message; process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
