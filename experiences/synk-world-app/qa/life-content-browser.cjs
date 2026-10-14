// Local-only browser acceptance checks for the life-Korean curriculum.
// Run against the dedicated rehearsal server/database. Real view interactions
// complete the content; this script does not manufacture completion API calls.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const base = process.env.SYNK_WORLD_QA_URL || 'http://127.0.0.1:4312';
const origin = new URL(base).origin;
const output = path.join(__dirname, 'life-content-20261010', process.env.SYNK_LIFE_QA_RUN || 'source');
const checks = [], errors = [], blocked = [], resources = [], observations = [], screenshots = [];
const coverage = { lessons: [], stories: [], originalQuestions: [], reviewQuestions: [] };
let browser, page;
let catalog, questions, reviews;
fs.mkdirSync(output, { recursive: true });

function check(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  assert.ok(passed, name);
}

function report(error) {
  const result = {
    checkedAt: new Date().toISOString(), base,
    passed: checks.filter(x => x.passed).length, failed: checks.filter(x => !x.passed).length,
    checks, errors, blocked, resources, observations, screenshots, coverage,
    ...(error ? { error: error.stack } : {}),
    limits: [
      'Isolated Edge browser contexts; physical phones and native apps are not covered.',
      'Dedicated local rehearsal database and synthetic accounts; no real OAuth, remote publication, AI, or paid calls.',
      'Prepared reading-and-choice content is verified here; spoken audio or student learning effects are not inferred.'
    ]
  };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

async function context(width = 390, height = 844, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'no-preference', ...extra });
  ctx.setDefaultTimeout(20000);
  await ctx.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || (!['GET', 'HEAD'].includes(request.method()) && !url.pathname.startsWith('/api/world/'))) {
      blocked.push({ url: request.url(), method: request.method() });
      return route.abort();
    }
    return route.continue();
  });
  const p = await ctx.newPage();
  p.on('pageerror', error => errors.push({ page: p.url(), message: error.message }));
  p.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (response.status() >= 400 && !(response.status() === 401 && pathname === '/api/world/bootstrap')) {
      resources.push({ url: response.url(), status: response.status() });
    }
  });
  return { ctx, page: p };
}

async function launch() {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  return browser;
}

async function snap(name, target = page) {
  const file = path.join(output, name + '.jpg');
  await target.screenshot({ path: file, type: 'jpeg', quality: 85 });
  screenshots.push(file);
}

async function ready(target = page) {
  await target.waitForFunction(() => window.__synkWorld && window.__synkHome && window.__synkOpening, null, { timeout: 30000 });
  if (await target.locator('.synk-opening').count()) {
    await target.waitForFunction(() => document.querySelector('.synk-opening')?.dataset.stage === 'title');
    await target.locator('.opening-enter').click();
  }
  await target.waitForFunction(() => !document.querySelector('.synk-opening'));
}

async function homePlaying(target = page) {
  await target.waitForFunction(() => {
    const film = document.querySelector('.scene-video');
    return film && !film.paused && film.currentTime > 0.05 && film.readyState >= 2 && !document.querySelector('#world-panel').open;
  }, null, { timeout: 20000 });
}

async function closePanel(target = page) {
  await target.locator('#panel-close').click();
  await target.waitForFunction(() => !document.querySelector('#world-panel').open);
  await homePlaying(target);
}

async function hit(selector, target = page) {
  return target.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width, height: rect.height,
      inside: rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= innerWidth + 0.5 && rect.bottom <= innerHeight + 0.5,
      hit: element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))
    };
  });
}

async function rotate(width, height, name, target = page) {
  await target.setViewportSize({ width, height });
  await target.waitForTimeout(260);
  const result = await target.evaluate(() => ({
    layout: document.documentElement.dataset.layout,
    width: innerWidth, height: innerHeight,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    open: document.querySelector('#world-panel').open,
    videoPaused: document.querySelector('.scene-video').paused,
    screen: window.__synkWorld.screen(),
    title: document.querySelector('#panel-title').textContent
  }));
  observations.push({ name, ...result });
  check(`${name}: orientation follows viewport without horizontal overflow`, result.layout === (width > height ? 'landscape' : 'portrait') && result.overflow <= 1, result);
  const back = await hit('#panel-close', target);
  if (result.open) check(`${name}: close stays visible and at least 44px`, back.inside && back.hit && back.width >= 44 && back.height >= 44, back);
  return result;
}

async function login(which = 'login-a', target = page) {
  await target.locator('[data-view="me"]').first().click();
  await target.locator(`[data-world="${which}"]`).click();
  await target.waitForFunction(() => window.__synkWorld.client.snapshot && !document.querySelector('#world-panel').open);
  await homePlaying(target);
}

async function metrics(target = page) {
  return target.evaluate(() => window.__synkWorld.life());
}

async function lifeReady(target = page) {
  await target.waitForFunction(() => { try { return !!window.__synkWorld.life()?.progress; } catch { return false; } });
}

async function nextHome(target = page) {
  await target.locator('[data-life-next]').first().click();
  await target.locator('.life-session-meta').waitFor();
}

async function openLesson(id, target = page) {
  const lesson = catalog.LESSONS.find(x => x.id === id);
  if (await target.locator('#world-panel').evaluate(el => el.open)) await closePanel(target);
  await target.locator('[data-life-library],[data-life-packs]').first().click();
  await target.locator(`[data-life-pack="${lesson.packId}"]`).click();
  await target.locator(`[data-life-lesson="${id}"]`).click();
  await target.locator('.life-session-meta').waitFor();
}

async function advanceToQuestion(target = page) {
  for (let guard = 0; guard < 35; guard++) {
    if (await target.locator('[data-life-choice]').count()) return;
    if (await target.locator('[data-life-begin]').count()) await target.locator('[data-life-begin]').click();
    else if (await target.locator('[data-life-scene-next]').count()) await target.locator('[data-life-scene-next]').click();
    else throw Error('Lesson stopped before its question: ' + await target.locator('#panel-content').textContent());
  }
  throw Error('Lesson scenes did not reach a question');
}

async function currentQuestion(target = page) {
  const meta = await target.locator('.life-session-meta').evaluate(el => ({ lessonId: el.dataset.lifeLessonId, reviewId: el.dataset.lifeReviewId, step: Number(el.dataset.lifeStep), phase: el.dataset.lifePhase }));
  const question = meta.reviewId ? reviews.get(meta.reviewId) : catalog.LESSONS.find(l => l.id === meta.lessonId)?.questions[meta.step];
  assert.ok(question, 'The visible question belongs to the prepared curriculum');
  return { meta, question };
}

async function chooseCorrect(target = page) {
  const { meta, question } = await currentQuestion(target);
  await target.locator(`[data-life-choice="${question.answerId}"]`).click();
  await target.locator('.life-feedback').waitFor();
  if (meta.reviewId) coverage.reviewQuestions.push(meta.reviewId);
  else coverage.originalQuestions.push(question.id);
  return { meta, question };
}

async function finishVisibleLesson(expectedId, target = page) {
  await advanceToQuestion(target);
  while (await target.locator('[data-life-choice]').count()) {
    const { meta } = await currentQuestion(target);
    assert.equal(meta.lessonId, expectedId, 'The intended lesson stays open');
    if (!await target.locator('.life-feedback').count()) await chooseCorrect(target);
    await target.locator('[data-life-question-next]').click();
  }
  await target.locator('.life-complete').waitFor();
  const state = await metrics(target);
  check(`${expectedId}: all real choices complete the prepared lesson`, state.progress.lessons[expectedId].completedAt !== null && Object.keys(state.progress.lessons[expectedId].answers).length === 3);
  coverage.lessons.push(expectedId);
  if (catalog.LESSONS.find(l => l.id === expectedId).type === 'story') coverage.stories.push(expectedId);
}

async function choiceTouchCheck(name, target = page) {
  const result = await target.locator('[data-life-choice]').evaluateAll(elements => elements.map(element => {
    const r = element.getBoundingClientRect();
    return { width: r.width, height: r.height, text: element.textContent, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, hit: element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) };
  }));
  check(`${name}: all answer targets are at least 44px`, result.length === 3 && result.every(x => x.width >= 44 && x.height >= 44), result);
  // Content can scroll, but scrolling must actually reveal each target.
  for (const [index] of result.entries()) {
    await target.locator('[data-life-choice]').nth(index).scrollIntoViewIfNeeded();
    const rect = await target.locator('[data-life-choice]').nth(index).evaluate(el => { const r = el.getBoundingClientRect(); return { visible: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, hit: el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
    check(`${name}: answer ${index + 1} can be reached and tapped`, rect.visible && rect.hit, rect);
  }
}

async function questionRotation(name, target = page) {
  const before = await metrics(target), timeOrigin = await target.evaluate(() => performance.timeOrigin);
  for (const [w, h] of [[740, 320], [320, 740], [844, 390], [390, 844]]) {
    await rotate(w, h, `${name}/${w}x${h}`, target);
    const after = await metrics(target);
    check(`${name}/${w}x${h}: learning phase, step, attempt, and answers survive rotation`, JSON.stringify(after.progress) === JSON.stringify(before.progress) && after.phase === before.phase && after.step === before.step && await target.evaluate(t => performance.timeOrigin === t, timeOrigin));
    await choiceTouchCheck(`${name}/${w}x${h}`, target);
    if (w === 740 || w === 390) await snap(`${name}-${w}x${h}`, target);
  }
}

async function returnHome(target = page) {
  await target.locator('[data-life-home]').click();
  await homePlaying(target);
}

async function logout(target = page) {
  if (await target.locator('#world-panel').evaluate(el => el.open)) await closePanel(target);
  await target.locator('[data-view="me"]').first().click();
  await target.locator('[data-world="logout"]').click();
  await target.waitForFunction(() => window.__synkWorld.client.snapshot === null);
  if (await target.locator('[data-world="guest"]').isVisible()) await target.locator('[data-world="guest"]').click();
  else if (await target.locator('#world-panel').evaluate(el => el.open)) await closePanel(target);
  await lifeReady(target); await homePlaying(target);
}

async function finishReview(target = page) {
  const ids = [];
  while (await target.locator('[data-life-choice]').count()) {
    const { meta, question } = await currentQuestion(target);
    check(`${meta.reviewId}: transformed review prompt is visible`, (await target.locator('.life-question-title h3').textContent()) === question.prompt);
    if (!await target.locator('.life-feedback').count()) await chooseCorrect(target);
    ids.push(meta.reviewId);
    await target.locator('[data-life-question-next]').click();
  }
  await target.locator('.life-complete').waitFor();
  check('review round completes only after each visible choice', ids.length > 0);
  return ids;
}

async function scenario() {
  const health = await fetch(origin + '/health').then(r => r.json());
  check('dedicated endpoint is a local rehearsal server', health.mode === 'rehearsal', health);
  catalog = await import(pathToFileURL(path.join(__dirname, '..', 'life-content.mjs')).href);
  questions = new Map(catalog.LESSONS.flatMap(l => l.questions.map(q => [q.id, q])));
  reviews = new Map(catalog.LESSONS.flatMap(l => l.questions.map(q => [q.review.id, q.review])));
  check('prepared curriculum has six packs, eighteen lessons, six stories, and 54 transfer questions', catalog.PACKS.length === 6 && catalog.LESSONS.length === 18 && catalog.LESSONS.filter(l => l.type === 'story').length === 6 && questions.size === 54 && reviews.size === 54);
  await launch(); const phone = await context(); page = phone.page;
  const epoch = Date.now(); await page.clock.setFixedTime(epoch);
  await page.goto(base + '/mobile.html', { waitUntil: 'domcontentloaded' }); await ready(); await lifeReady(); await homePlaying();
  let initial = await metrics(), guestOwner = initial.owner;
  check('fresh guest starts with real next progress and no invented completion', Object.keys(initial.progress.lessons).length === 0 && await page.locator('[data-life-next]').first().isVisible());
  await snap('home-fresh-portrait'); await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(260); await snap('home-fresh-landscape'); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-life-library],[data-life-packs]').first().click();
  check('home library exposes all six prepared life packs', await page.locator('[data-life-pack]').count() === 6);
  for (const pack of catalog.PACKS) {
    await page.locator(`[data-life-pack="${pack.id}"]`).click();
    check(`${pack.id}: expressions, story, and application are genuinely available`, await page.locator('[data-life-lesson]').count() === 3 && (await page.locator('#panel-content').textContent()).includes('표현 → 이야기 → 생활 적용'));
    await page.locator('[data-life-packs]').click();
  }
  await page.locator('#panel-content [data-life-stories]').click();
  check('story library exposes the six actual episodes', await page.locator('[data-life-lesson]').count() === 6);
  await snap('story-library-portrait'); await closePanel();
  await nextHome(); await advanceToQuestion();
  check('lesson describes actual reading and choice work', (await page.locator('#panel-content').textContent()).includes('읽고'));
  check('new content has no fake listening or recording control', await page.locator('#panel-content audio,#panel-content [data-life-audio],#panel-content [data-life-record]').count() === 0);
  await page.keyboard.press('Tab');
  check('keyboard focus stays inside the learning dialog', await page.evaluate(() => document.querySelector('#world-panel').contains(document.activeElement)));
  await questionRotation('first-question');
  const first = catalog.LESSONS[0], wrong = first.questions[0].choices.find(c => c.id !== first.questions[0].answerId).id;
  await page.locator(`[data-life-choice="${wrong}"]`).click(); await page.locator('.life-feedback').waitFor(); coverage.originalQuestions.push(first.questions[0].id);
  let saved = await metrics();
  check('wrong answer retains its first judgement and schedules remediation', saved.progress.lessons[first.id].answers[first.questions[0].id].correct === false && saved.progress.reviews[first.questions[0].review.id].dueAt === epoch + 60000);
  check('feedback prevents changing the first answer into a correct score', await page.locator('[data-life-choice]').evaluateAll(buttons => buttons.every(b => b.disabled)));
  await rotate(740, 320, 'wrong-feedback'); await snap('wrong-feedback-landscape');
  await page.locator('[data-life-pause]').click(); await homePlaying(); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await lifeReady(); await homePlaying(); await nextHome();
  let resumed = await metrics();
  check('pause and reload resume at the next unanswered question', resumed.lessonId === first.id && resumed.step === 1 && resumed.progress.lessons[first.id].attemptId === saved.progress.lessons[first.id].attemptId);
  await page.locator('[data-life-help]').click(); check('help reveals the explanation before answering', await page.locator('.life-hint').isVisible());
  await page.locator('[data-life-pause]').click(); await homePlaying(); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await lifeReady(); await homePlaying(); await nextHome();
  check('help used before pause remains visible after reload', await page.locator('.life-hint').isVisible()); await chooseCorrect(); await page.locator('[data-life-question-next]').click();
  const secondSaved = await metrics();
  check('helped correct answer is kept separate from unaided correctness', secondSaved.progress.lessons[first.id].answers[first.questions[1].id].correct === true && secondSaved.progress.lessons[first.id].answers[first.questions[1].id].helped === true);
  await finishVisibleLesson(first.id);
  const firstComplete = await metrics();
  check('help from one question does not leak to the next', firstComplete.progress.lessons[first.id].answers[first.questions[2].id].helped === false);
  const story = catalog.LESSONS[1];
  check('expression completion offers its matching character story', await page.locator(`.life-actions [data-life-lesson="${story.id}"]`).count() === 1);
  await page.locator(`[data-life-lesson="${story.id}"]`).click(); await page.locator('[data-life-begin]').click(); await page.locator('[data-life-scene-next]').click();
  const sceneBefore = await page.locator('.life-dialogue p').textContent(), storyState = await metrics();
  check('the story presents all three official friends', await page.locator('.life-story-photo img').evaluate(image => ['몽글', '까몽', '마린'].every(name => image.alt.includes(name))));
  await rotate(740, 320, 'story-scene'); await snap('story-scene-landscape'); await rotate(390, 844, 'story-scene-portrait'); await snap('story-scene-portrait'); await closePanel();
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await lifeReady(); await homePlaying(); await nextHome();
  const sceneAfter = await metrics();
  check('story close and reload restore the exact read scene', (await page.locator('.life-dialogue p').textContent()) === sceneBefore && sceneAfter.progress.lessons[story.id].stage.sceneIndex === storyState.progress.lessons[story.id].stage.sceneIndex);
  await finishVisibleLesson(story.id);
  for (const lesson of catalog.LESSONS.slice(2)) { await page.locator(`.life-actions [data-life-lesson="${lesson.id}"]`).click(); await finishVisibleLesson(lesson.id); }
  let complete = await metrics();
  check('all eighteen prepared lessons are truly completed through the UI', Object.values(complete.progress.lessons).filter(l => l.completedAt !== null).length === 18 && Object.values(complete.progress.lessons).reduce((n, l) => n + Object.keys(l.answers).length, 0) === 54);
  check('six character stories were read and answered', new Set(coverage.stories).size === 6);
  await returnHome(); await snap('home-all-content-portrait'); await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(260); await snap('home-all-content-landscape'); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-life-review]').first().click();
  check('before its due time review shows the genuine next schedule', await page.locator('[data-life-review-start]').count() === 0 && (await page.locator('#panel-content').textContent()).includes('다음 복습'));
  await returnHome(); await page.clock.setFixedTime(epoch + 120000); await page.locator('[data-life-review]').first().click(); await page.locator('[data-life-review-start]').click();
  const hardReview = await currentQuestion();
  check('difficult first answers return in a new situation', hardReview.question.prompt + hardReview.question.context !== questions.get(hardReview.meta.reviewId.replace(/-transfer$/, '')).prompt + questions.get(hardReview.meta.reviewId.replace(/-transfer$/, '')).context);
  await questionRotation('transformed-review'); await page.locator('[data-life-help]').click(); await page.locator('[data-life-pause]').click(); await homePlaying(); const reviewPaused = await metrics();
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await lifeReady(); await homePlaying(); await page.locator('[data-life-review]').first().click(); await page.locator('[data-life-review-start]').click();
  const reviewResumed = await metrics();
  check('review resumes the same bounded session after reload', reviewResumed.progress.activeReview.id === reviewPaused.progress.activeReview.id);
  check('review help survives pause and reload', await page.locator('.life-hint').isVisible());
  await finishReview(); await returnHome();
  await page.clock.setFixedTime(epoch + 240000); await page.locator('[data-life-review]').first().click(); await page.locator('[data-life-review-start]').click(); await finishReview(); await returnHome();
  await page.clock.setFixedTime(epoch + 2 * 86400000);
  const seenTransfer = new Set();
  for (let round = 0; round < 12; round++) {
    await page.locator('[data-life-review]').first().click();
    if (!await page.locator('[data-life-review-start]').count()) { await returnHome(); break; }
    await page.locator('[data-life-review-start]').click();
    for (const id of await finishReview()) seenTransfer.add(id);
    await returnHome();
  }
  check('all 54 transformed review questions are reachable and answerable', seenTransfer.size === 54, [...seenTransfer]);
  complete = await metrics();
  check('successful review moves each expression into a future interval', Object.values(complete.progress.reviews).every(r => r.dueAt > epoch + 2 * 86400000));
  await openLesson(first.id); check('completed lesson replay starts at its introduction instead of skipping', (await metrics()).phase === 'intro'); await closePanel();
  await login('login-a'); await lifeReady(); const aFresh = await metrics();
  check('account A cannot inherit guest progress', aFresh.owner !== guestOwner && Object.keys(aFresh.progress.lessons).length === 0);
  await nextHome(); await advanceToQuestion(); await chooseCorrect(); await page.locator('[data-life-pause]').click(); await homePlaying(); const ownerA = (await metrics()).owner, aRecord = (await metrics()).progress.lessons[first.id];
  await logout(); check('logout returns to the preserved guest curriculum', (await metrics()).owner === guestOwner && Object.values((await metrics()).progress.lessons).filter(l => l.completedAt !== null).length === 18);
  await login('login-b'); await lifeReady(); const bFresh = await metrics();
  check('account B cannot inherit A or guest answers', bFresh.owner !== ownerA && bFresh.owner !== guestOwner && Object.keys(bFresh.progress.lessons).length === 0);
  await nextHome(); await finishVisibleLesson(first.id); await returnHome(); await logout(); await login('login-a'); await lifeReady(); await nextHome();
  const aAgain = await metrics();
  check('returning to A restores A own paused attempt and answers', aAgain.owner === ownerA && aAgain.progress.lessons[first.id].attemptId === aRecord.attemptId && Object.keys(aAgain.progress.lessons[first.id].answers).length === 1 && aAgain.step === 1);
  await snap('account-a-own-resume'); await closePanel();
  check('no credentials are stored alongside curriculum progress', await page.evaluate(() => !Object.entries(localStorage).some(([k, v]) => /accessToken|refreshToken|Bearer|access_token/.test(k + v))));
  check('no JavaScript errors occur in the new curriculum flow', errors.length === 0, errors);
  check('no external or paid requests are attempted', blocked.length === 0, blocked);
  check('no unexpected asset or API errors occur', resources.length === 0, resources);
  await phone.ctx.close(); const result = report(); console.log(JSON.stringify({ passed: result.passed, output, coverage: { lessons: new Set(coverage.lessons).size, stories: new Set(coverage.stories).size, questions: new Set(coverage.originalQuestions).size, reviews: new Set(coverage.reviewQuestions).size } }));
}

module.exports = { base, origin, output, checks, errors, blocked, resources, observations, screenshots, check, report, launch, context, snap, ready, homePlaying, closePanel, hit, rotate, login, metrics };
if (require.main === module) scenario().catch(async error => {
  console.error(error.stack); if (page && !page.isClosed()) await snap('failure').catch(() => {}); report(error); process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
