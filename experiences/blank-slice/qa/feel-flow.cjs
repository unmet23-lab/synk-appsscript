'use strict';
// 10-03 「3번」 흐름 확인: 벨 때의 맞음·틀림 손맛은 베는 순간 그대로, 읽기 확인(멈춘 보기)은 두 번 다 놓친 문장에만.
// 한 판에서 맞게 베기 · 틀리게 베기 · 놓치고 멈춘 보기에서 틀린 답 · 놓치고 맞는 답을 차례로 하고 본다:
//   소리 기록(slice correct:true/false)과 손맛 판정(impacts ok/wrong), 화면(읽기 확인·해설), 해설 첫 줄, 결과 칸, 아틀라스 기록(문장마다 한 번).
// 쓰는 법: node experiences/blank-slice/server.mjs 를 켠 뒤  node experiences/blank-slice/qa/feel-flow.cjs
const path = require('node:path');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.SLICE_URL || 'http://127.0.0.1:5217/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const S = () => page.evaluate(() => window.__slice.state());
  const visible = (sel) => page.evaluate((s) => !document.querySelector(s).hidden, sel);
  await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(1500);
  await page.click('#btn-start');
  const waitToss = async () => { let st = await S(); for (let w = 0; w < 120 && !((st.practice && st.practice.tries > 0) || (st.cur && st.cur.tosses > 0 && !st.cur.done)); w++) { await sleep(100); st = await S(); } await sleep(900); return S(); };
  // 연습
  let st = await waitToss();
  await page.evaluate((i) => window.__slice.stage().sliceIndex(i, { x: 0.85, y: -0.5 }), st.practice.options.indexOf('우유'));
  await sleep(2600);
  const out = { steps: [] };
  const step = async (name, act) => {
    st = await waitToss();
    const cur = st.cur;
    await page.evaluate(() => { window.__slice.sound.start(); window.__slice.impacts(); });
    await act(cur);
    const sounds = (await page.evaluate(() => window.__slice.sound.take())).filter((e) => e.name === 'slice' || e.name === 'calm1' || e.name === 'calm2' || e.name === 'earn');
    const impacts = await page.evaluate(() => window.__slice.impacts());
    const r = (await S()).results.at(-1);
    const view = { check: await visible('#answer-check'), explain: await visible('#explain'), kicker: (await page.textContent('#x-kicker')).trim() };
    out.steps.push({ name, id: cur.id, answer: cur.answer, sounds: sounds.map((e) => `${e.name}${e.opts && 'correct' in e.opts ? (e.opts.correct ? ':맞음' : ':틀림') : ''}`), impacts: impacts.map((i) => i.verdict), result: r && { choice: r.choice, correct: r.correct, reading: r.readingChoice, readingCorrect: r.readingCorrect, recorded: r.readingRecorded }, view });
    if (view.explain) { await page.click('#btn-next'); await sleep(300); }
  };
  const sliceWord = (cur, word) => page.evaluate((i) => window.__slice.stage().sliceIndex(i, { x: 0.85, y: -0.5 }), cur.options.indexOf(word));
  await step('맞게 베기', async (cur) => { await sliceWord(cur, cur.answer); await sleep(700); });
  await step('틀리게 베기', async (cur) => { await sliceWord(cur, cur.options.find((o) => o !== cur.answer)); await sleep(900); });
  const missThen = (pick) => async (cur) => {
    for (let w = 0; w < 160 && !(await visible('#answer-check')); w++) await sleep(100);   // 두 번 떨어질 때까지
    const before = { check: await visible('#answer-check'), explain: await visible('#explain'), blankFilled: await page.evaluate(() => !!document.querySelector('.blank.filled, .blank.answer')) };
    out.steps.push({ name: '놓친 직후 화면', ...before });
    const word = pick(cur);
    await page.click(`#check-options button[data-word="${word}"]`); await sleep(700);
  };
  await step('놓치고 멈춘 보기에서 틀린 답', missThen((cur) => cur.options.find((o) => o !== cur.answer)));
  await step('놓치고 멈춘 보기에서 맞는 답', missThen((cur) => cur.answer));
  // 아틀라스 기록: 이번 판의 문장마다 답이 한 번씩(맞음·틀림 각 한 번, 놓친 두 문장은 멈춘 보기의 답)
  out.atlas = await page.evaluate(() => {
    const g = window.SynkLearning.createGame({ gameId: 'probe', storage: localStorage });
    const ev = g.events().filter((e) => e.type === 'practice.attempted');
    return { attempts: ev.length, last: ev.slice(-4).map((e) => ({ item: e.payload?.itemKey || e.itemKey || null, verdict: e.payload?.verdict ?? e.verdict ?? null })) };
  });
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  const [ok, wrong, missWrong, missRight] = out.steps.filter((s) => s.sounds);
  const after = out.steps.filter((s) => s.name === '놓친 직후 화면');
  const bad = errors.length
    || !(ok.sounds.includes('slice:맞음') && ok.impacts.includes('ok') && !ok.view.check && !ok.view.explain && ok.result.correct === true && ok.result.recorded)
    || !(wrong.sounds.includes('slice:틀림') && wrong.impacts.includes('wrong') && !wrong.view.check && wrong.view.explain && wrong.view.kicker.startsWith('정답은') && wrong.result.correct === false)
    || !after.every((a) => a.check && !a.explain)
    || !(missWrong.result.correct === null && missWrong.result.readingCorrect === false && missWrong.view.explain && missWrong.view.kicker.includes('정답은') && missWrong.impacts.length === 0)
    || !(missRight.result.correct === null && missRight.result.readingCorrect === true && missRight.view.kicker.includes('맞아요'));
  console.log(bad ? 'PROBLEM' : 'ok — 벨 때 손맛 그대로, 읽기 확인은 놓친 문장에만');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
