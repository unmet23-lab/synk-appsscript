'use strict';
// 레이싱 한 판을 입구부터 결과까지 실제로 달린다(헤드리스 크롬, 실제 WebGL·실제 음성). 기다리는 주행 구간만 ?qa 빨리 감기로 줄인다.
// 순서: 입구(공통 코인 줄·다른 게임 링크) → (desktop만) 첫 조작 연습을 끝까지 → 레이스 다섯 문제
//   1번: 음성을 끝까지 듣고 ‘글로 보기’로 지문을 펼친 뒤 답 꼬리표로 맞힘 · 2번: 틀린 길(키보드) · 3번: 멈춤·이어 하기 뒤 ↑ 단추로 맞힘 · 4·5번: 맞힘
//   → 완주 뒤 드라이브 → 결과(공통 코인 줄·문제 목록·다시 듣기) → 처음으로(보유 코인이 늘었는지).
//   다시 보기(2026-10-07~): 도움을 쓰고 맞히거나 틀리거나 다시 확인 문제에 답하면 차가 서서 해설을 띄우고
//   ‘확인했어요 · 계속 달리기’(또는 ‘새 문제로 확인하기’, #feedback-continue)를 기다린다 — 차가 서 있는지·해설·배치를 보고 그 단추를 실제로 누른다.
//   단추가 없는 옛 판(공개판 원본)에서는 이 단계를 건너뛴다.
// 장면마다 3D 게이트·내 차의 화면 상자를 재서 문제 카드·차선 꼬리표·단추가 게이트와 차를 가리지 않는지, 가로 넘침·화면 밖·콘솔 오류를 본다.
// garage 장면: 공통 차고(?garage=1)에서 차를 사고 장착한다(코인을 미리 넣어 둔다). /try/racing/ 주소에서 다른 게임 링크가 맞게 바뀌는지도 본다.
// 쓰는 법: experiences 폴더를 정적 서버로 띄운 뒤(예: 5281)  node experiences/korean-racing/qa/play.cjs [desktop|phone|small|reduced|garage …]
const path = require('node:path'), fs = require('node:fs');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const ORIGIN = process.env.RACING_ORIGIN || (process.env.RACING_URL ? new URL(process.env.RACING_URL).origin : 'http://127.0.0.1:5281');
const URL_BASE = process.env.RACING_URL || `${ORIGIN}/korean-racing/`;   // 공개 후보 확인: RACING_URL=http://…/try/racing/
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const PHONE = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, ...PHONE },
  small: { viewport: { width: 320, height: 568 }, ...PHONE },
  reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DONE_TUTORIAL = JSON.stringify({ version: 1, completed: true });
const overlap = (a, b, pad = 0) => !!a && !!b && a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.hdr': 'application/octet-stream', '.txt': 'text/plain' };

async function open(browser, view, { url = URL_BASE + '?qa', tutorialDone = true, coins = null } = {}) {
  const ctx = await browser.newContext(view);
  await ctx.addInitScript(({ done, coins }) => {
    try {
      if (done) localStorage.setItem('SYNK_RACING_TUTORIAL_V1', done);
      if (coins != null && !localStorage.getItem('qa-seeded')) {
        localStorage.setItem('SYNK_PLAY_COLLECTION_V1', JSON.stringify({ version: 1, coins, totalEarned: coins }));
        localStorage.setItem('qa-seeded', '1');
      }
    } catch { /* 저장 공간 없음 */ }
  }, { done: tutorialDone ? DONE_TUTORIAL : null, coins });
  // /try/racing/ 주소를 이 폴더로 흉내 낸다(공개 사이트와 같은 경로 규칙을 보려고)
  await ctx.route('**/try/racing/**', async (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/try\/racing\//, '')) || 'index.html';
    const file = path.join(ROOT, rel.endsWith('/') ? rel + 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '404' });
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__racing?.snapshot().ready || window.__racingError, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__racingError || null);
  if (err) throw new Error('3D 준비 실패: ' + err);
  return { ctx, page, errors };
}

async function run(browser, name, view) {
  const { ctx, page, errors } = await open(browser, view, { tutorialDone: name !== 'desktop' });
  const shots = [], notes = [], fails = [];
  const check = (ok, what) => { if (!ok) fails.push(what); };
  const shot = async (label) => { const f = `play_${name}_${String(shots.length).padStart(2, '0')}_${label}.png`; await page.screenshot({ path: path.join(OUT, f) }); shots.push(f); };
  // reviewing: 다시 보기 단추가 떠서 차가 서 있다(그동안은 빨리 감아도 레이스가 나아가지 않는다)
  const Q = () => page.evaluate(() => { const b = document.querySelector('#feedback-continue'); return { ...window.__racingQA.state(), reviewing: !!b && !b.hidden }; });
  const L = () => page.evaluate(() => window.__racingQA.layout());
  async function waitFor(pred, what, { timeout = 30000, every = 60 } = {}) {
    const t0 = Date.now(); let s = null;
    while (Date.now() - t0 < timeout) { s = await Q(); if (pred(s)) return s; await sleep(every); }
    throw new Error(`${name}: 기다림 초과 — ${what} ${JSON.stringify(s && { gateIndex: s.gateIndex, gate: s.gate, tutorial: s.tutorial, coast: s.coast, screen: s.screen, reviewing: s.reviewing })}`);
  }
  const advance = (sec) => page.evaluate((s) => window.__racingQA.advance(s), sec);
  async function advanceUntil(pred, what, { step = .25, limit = 60 } = {}) {
    for (let t = 0; t < limit; t += step) {
      const s = await Q(); if (pred(s)) return s;
      if (s.reviewing) throw new Error(`${name}: 빨리 감기로도 안 됨 — ${what}: 다시 보기 단추(#feedback-continue)를 누르지 않아 차가 서 있음 ${JSON.stringify(s.gate)}`);
      await advance(step);
    }
    const s = await Q(); if (pred(s)) return s;
    throw new Error(`${name}: 빨리 감기로도 안 됨 — ${what} ${JSON.stringify(s.gate)}`);
  }
  // 다시 보기: 단추가 떴으면 해설·단추 글·차가 서 있는지·배치를 보고 실제로 누른다. must면 떠야 한다(단추가 없는 옛 판은 빼고). 뜬 단추 글을 돌려준다.
  async function review(label, { must = false } = {}) {
    const r = await page.evaluate(() => { const b = document.querySelector('#feedback-continue'), box = b?.getBoundingClientRect();
      return { exists: !!b, shown: !!b && !b.hidden && box.height > 0, text: b?.textContent, why: document.querySelector('#question-help').textContent, phase: document.querySelector('#question').dataset.phase }; });
    if (must && r.exists) check(r.shown, `${label}: 다시 보기 단추가 떠야 함 ${JSON.stringify(r)}`);
    if (!r.shown) return null;
    check(['확인했어요 · 계속 달리기', '새 문제로 확인하기'].includes(r.text) && r.phase === 'answer' && r.why.trim().length > 0, `${label}: 다시 보기 해설·단추 ${JSON.stringify(r)}`);
    await advance(1);
    const st = await Q();
    check(st.reviewing && st.velocity === 0, `${label}: 다시 보기 동안 차가 서 있어야 함 (속도 ${st.velocity})`);
    await layout(`${label} 다시 보기`, { gate: false });
    await page.click('#feedback-continue'); await sleep(150);
    const after = await page.evaluate(() => ({ button: !document.querySelector('#feedback-continue').hidden, card: !document.querySelector('#question').hidden }));
    check(!after.button && !after.card, `${label}: 단추를 누르면 해설을 닫고 달려야 함 ${JSON.stringify(after)}`);
    notes.push(`${label}: 다시 보기 「${r.text}」 — ${r.why.slice(0, 90)}`);
    return r.text;
  }
  // 넘침: 가로 스크롤·휴대폰 축소(innerWidth > visualViewport.width)
  async function fit(label) {
    const r = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1, zoomed: innerWidth > (window.visualViewport?.width ?? innerWidth) + 1,
      sw: document.documentElement.scrollWidth, iw: innerWidth, vw: window.visualViewport?.width }));
    check(!r.wide && !r.zoomed, `${label}: 가로 넘침/축소 ${JSON.stringify(r)}`);
  }
  // 레이스 화면 배치: 화면 안 · 카드·꼬리표·단추가 3D 게이트와 내 차를 가리지 않는지
  async function layout(label, { gate = true } = {}) {
    const l = await L(), vw = l.viewport.width, vh = await page.evaluate(() => innerHeight);
    const inside = (b) => !b || (b.left >= -1 && b.top >= -1 && b.right <= vw + 1 && b.bottom <= vh + 1);
    for (const key of ['bar', 'question', 'tutorial', 'cruise', 'toast', 'left', 'right', 'go', 'boost', 'cruiseAction']) check(inside(l[key]), `${label}: ${key} 화면 밖 ${JSON.stringify(l[key])}`);
    l.laneTags.forEach((b, i) => check(inside(b), `${label}: 꼬리표 ${i} 화면 밖 ${JSON.stringify(b)}`));
    const huds = { question: l.question, tutorial: l.tutorial, cruise: l.cruise, toast: l.toast, left: l.left, right: l.right, go: l.go, boost: l.boost, cruiseAction: l.cruiseAction };
    l.laneTags.forEach((b, i) => { huds['laneTag' + i] = b; });
    for (const [key, box] of Object.entries(huds)) {
      if (!box) continue;
      check(!overlap(box, l.car, 4), `${label}: ${key}가 내 차를 가림 ${JSON.stringify({ box, car: l.car })}`);
      if (gate && l.gate && !key.startsWith('laneTag')) check(!overlap(box, l.gate, 2), `${label}: ${key}가 게이트를 가림 ${JSON.stringify({ box, gate: l.gate })}`);
      if (gate && key.startsWith('laneTag')) for (const board of l.gateBoards) check(!overlap(box, board, 2), `${label}: ${key}가 게이트의 답 판을 가림 ${JSON.stringify({ box, board })}`);
    }
    return l;
  }
  // 캔버스가 실제로 그려졌는지: 캔버스 부분을 찍어 색의 고르지 않음을 잰다(빈 캔버스·한 색이면 실패)
  async function drawn(label) {
    const buf = await page.locator('#world canvas').screenshot();
    const stats = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 64; c.height = 40; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 40);
      const d = x.getImageData(0, 0, 64, 40).data; let sum = 0, sq = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; sq += v * v; n++; }
      const mean = sum / n; return { mean: Math.round(mean), sd: Math.round(Math.sqrt(sq / n - mean * mean)) };
    }, buf.toString('base64'));
    check(stats.sd > 12, `${label}: 3D 캔버스가 비었거나 한 색 ${JSON.stringify(stats)}`);
    return stats;
  }
  const clickLane = (id) => page.click(`#lane-choices .lane-tag[data-word="${id}"]`);
  // 실제 조작으로 그 길까지 옮긴다: 키보드(←→) 또는 화면 단추(#left·#right)를 누른 채 빨리 감는다. 화면 왼쪽 = 월드 +X
  async function steerTo(id, how) {
    const st = await Q(), target = -3.45 + 3.45 * st.gate.types.indexOf(id), delta = target - st.offset;
    if (Math.abs(delta) < .6) return;
    const side = delta > 0 ? 'left' : 'right', seconds = Math.abs(delta) / 5.8;
    if (how === 'key') await page.keyboard.down(side === 'left' ? 'ArrowLeft' : 'ArrowRight');
    else { const b = await page.locator('#' + side).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); }
    await advance(seconds);
    if (how === 'key') await page.keyboard.up(side === 'left' ? 'ArrowLeft' : 'ArrowRight'); else await page.mouse.up();
    await advance(.2);
  }

  /* ── 입구 ── */
  await sleep(500);
  await fit('입구'); await shot('lobby');
  const lobby = await page.evaluate(() => ({ start: (() => { const r = document.querySelector('#start').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })(), vh: innerHeight,
    balance: document.querySelector('#lobby [data-collection-balance]')?.textContent, garage: document.querySelector('#lobby [data-collection-garage]')?.href,
    runner: document.querySelector('#runner-play').href, rhythm: document.querySelector('#rhythm-play').href, runner2: document.querySelector('#runner-play-next').href,
    title: document.querySelector('#l-title').textContent, cta: document.querySelector('#start span').textContent }));
  check(lobby.start.bottom <= lobby.vh || name === 'small', `입구: 레이스 시작 단추가 첫 화면 밖 ${JSON.stringify(lobby.start)}`);
  check(lobby.balance === '보유 0코인', `입구 공통 코인 줄 ${lobby.balance}`);
  check(lobby.garage === URL_BASE + '?garage=1', `입구 공통 차고 링크 ${lobby.garage}`);
  // 다른 게임 링크: 학습 허브(/korean-racing/)에서는 /korean-<게임>/, 공개 주소(/try/racing/)에서는 /try/<게임>/
  const onTry = new URL(URL_BASE).pathname.startsWith('/try/');
  const want = (g) => (onTry ? `${ORIGIN}/try/${g}/` : `${ORIGIN}/korean-${g}/`);
  check(lobby.runner === want('runner') && lobby.runner2 === lobby.runner && lobby.rhythm === want('rhythm'), `다른 게임 링크 ${JSON.stringify(lobby)}`);
  notes.push(`입구: ${lobby.title} · ${lobby.cta}`);

  // 코스 고르기 창(desktop·phone): 열고 닫기
  if (name === 'desktop' || name === 'phone') {
    await page.click('#choose-course'); await sleep(350);
    check(await page.evaluate(() => document.querySelector('#course-dialog').open), '코스 고르기 창이 열리지 않음');
    await fit('코스 고르기'); await shot('courses');
    await page.click('#collection-words'); await sleep(200);
    check((await page.evaluate(() => document.querySelectorAll('#stage-grid .course-tile').length)) === 12, '어휘 연습 12개 타일');
    await page.click('#collection-campaign'); await sleep(150);
    await page.click('#course-close'); await sleep(200);
  }

  /* ── (desktop) 첫 조작 연습 ── */
  if (name === 'desktop') {
    check(lobby.cta === '조작 연습부터 시작', `처음 여는 사람의 시작 단추 ${lobby.cta}`);
    await page.click('#start');
    await waitFor((s) => s.tutorial === 'steer-left' && s.screen === 'game', '연습 시작');
    await sleep(400); await shot('tutorial');
    await layout('연습', { gate: false });
    for (const [key, step] of [['ArrowLeft', 'steer-right'], ['ArrowRight', 'listen']]) {
      await page.keyboard.down(key);
      await waitFor((s) => s.tutorial === step || s.tutorial === 'choose', `연습 ${step}`, { timeout: 20000 });
      await page.keyboard.up(key);
    }
    const t = await waitFor((s) => s.tutorial === 'choose' && !s.narrating, '연습 문제 음성', { timeout: 40000 });
    await sleep(300); await shot('tutorial_choose');
    await clickLane(t.gate.answer);
    await advanceUntil((s) => s.tutorial === 'boosting' || s.tutorial === 'boost-ready', '연습 정답');
    await waitFor((s) => s.tutorial === 'boosting', '연습 부스터 음성', { timeout: 40000 });
    await advanceUntil((s) => s.tutorial === 'complete', '연습 끝', { limit: 10 });
    await sleep(300); await shot('tutorial_done');
    await page.click('#tutorial-race');
  } else await page.click('#start');

  /* ── 레이스 ── */
  const t0 = Date.now();
  let s = await waitFor((x) => x.running && x.screen === 'game' && !x.tutorial && x.gateIndex === 0 && x.gate, '레이스 시작', { timeout: 60000 });
  notes.push(`시작 단추 → 레이스 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  await drawn('레이스');
  s = await advanceUntil((x) => x.gate?.announced, '1번 문제 나옴');
  await sleep(500); await shot('question_listening');
  await layout('1번 듣는 중');
  // 1번: 음성을 끝까지 듣는다(실제 음성) → 고르기 → 글로 보기
  s = await waitFor((x) => x.gate?.readyAt != null && !x.narrating, '1번 음성 끝', { timeout: 45000 });
  await advance(2.5);   // 멈춤선까지 다가간다(문장 문제는 고를 때까지 기다린다)
  s = await Q(); check(s.velocity < 1, `1번: 고르기 전에 차가 기다려야 함 (속도 ${s.velocity})`);
  await sleep(300); await shot('question_choose');
  const l1 = await layout('1번 고르기');
  notes.push(`게이트 화면 상자 ${JSON.stringify(l1.gate)} · 내 차 ${JSON.stringify(l1.car)}`);
  await page.click('#question-toggle'); await sleep(350);
  const help = await page.evaluate(() => ({ passage: !document.querySelector('#question-passage').hidden && document.querySelector('#question-passage').textContent, phase: document.querySelector('#question').dataset.phase }));
  check(!!help.passage, `글로 보기: 지문이 보이지 않음 ${JSON.stringify(help)}`);
  await shot('text_help'); await layout('글로 보기');
  await clickLane(s.gate.answer);
  s = await advanceUntil((x) => x.answers.length === 1, '1번 판정');
  check(s.answers[0].correct === true, '1번은 맞아야 함');
  await advance(.5); await sleep(200); await shot('right');   // 게이트를 막 지난 때(정답 글자가 떠 있는 동안)
  const right = await page.evaluate(() => ({ phase: document.querySelector('#question').dataset.phase, result: document.querySelector('#question').dataset.result, ask: document.querySelector('#prompt').textContent,
    tagRight: !!document.querySelector('#lane-choices .lane-tag.right'), pop: !document.querySelector('#pop').hidden }));
  check(right.result === 'ok' && right.tagRight, `정답 표시 ${JSON.stringify(right)}`);
  await layout('정답', { gate: false });
  await review('1번(글로 보고 맞힘)', { must: !!s.answers[0].learning?.assisted });
  // 2번: 틀린 길의 꼬리표를 누른다
  s = await advanceUntil((x) => x.gateIndex === 1 && x.gate?.announced, '2번 문제 나옴');
  await page.evaluate(() => window.__racingQA.hearNow());
  s = await Q();
  await clickLane(s.gate.screenOrder.find((id) => id !== s.gate.answer));
  s = await advanceUntil((x) => x.answers.length === 2, '2번 판정');
  check(s.answers[1].correct === false, `2번은 틀려야 함 ${JSON.stringify(s.answers[1])}`);
  await advance(.7); await sleep(200); await shot('wrong');
  const wrong = await page.evaluate(() => ({ result: document.querySelector('#question').dataset.result, ask: document.querySelector('#prompt').textContent, why: document.querySelector('#question-help').textContent,
    redX: /[×✕✗]/.test(document.querySelector('#question').textContent) }));
  check(wrong.result === 'miss' && wrong.ask.startsWith('정답:') && !wrong.redX, `틀림 쪽지 ${JSON.stringify(wrong)}`);
  await layout('틀림', { gate: false });
  await review('2번(틀림)', { must: true });
  // 3번: 멈춤 → 이어 하기 → ↑ 단추
  s = await advanceUntil((x) => x.gateIndex === 2 && x.gate?.announced, '3번 문제 나옴');
  await page.click('#pause'); await sleep(300);
  check(await page.evaluate(() => document.querySelector('#pause-dialog').open), '멈춤 창');
  await shot('pause'); await fit('멈춤');
  await page.click('#resume'); await sleep(200);
  check(!(await page.evaluate(() => document.querySelector('#pause-dialog').open)), '이어 하기 뒤 멈춤 창이 닫혀야 함');
  await page.evaluate(() => window.__racingQA.hearNow());
  s = await Q();
  await clickLane(s.gate.answer); await page.click('#go');
  s = await advanceUntil((x) => x.answers.length === 3, '3번 판정');
  check(s.answers[2].correct === true, '3번은 맞아야 함');
  await review('3번', { must: !!s.answers[2].recheck?.line });   // 2번 뒤 새 문제로 확인하는 문항이면 결과 줄을 읽을 시간을 준다
  // 4번: 키보드 ←→로 옮기고 ↑ · 5번: 화면 단추 ←→로 옮기고 ‘이 길로’
  for (const [n, how] of [[4, 'key'], [5, 'button']]) {
    s = await advanceUntil((x) => x.gateIndex === n - 1 && x.gate?.announced, `${n}번 문제 나옴`);
    await page.evaluate(() => window.__racingQA.hearNow());
    s = await Q(); await steerTo(s.gate.answer, how);
    if (how === 'key') await page.keyboard.press('ArrowUp'); else await page.click('#go');
    s = await advanceUntil((x) => x.answers.length === n, `${n}번 판정`);
    check(s.answers[n - 1].correct === true, `${n}번(${how === 'key' ? '키보드' : '화면 단추'}) 맞아야 함 ${JSON.stringify(s.answers[n - 1].chosen)}`);
    await review(`${n}번`, { must: !!s.answers[n - 1].recheck?.line });
  }
  check(s.answers.filter((a) => a.correct).length === 4, `맞힘 4개 ${JSON.stringify(s.answers.map((a) => a.correct))}`);
  s = await advanceUntil((x) => x.coast.phase === 'drive', '완주 뒤 드라이브', { limit: 20, step: 1 / 15 });
  await sleep(900); await shot('cruise'); await layout('드라이브', { gate: false });
  const fps = await page.evaluate(async () => { const a = performance.now(); let n = 0; await new Promise((r) => { const f = () => { n++; if (performance.now() - a < 1500) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return Math.round(n / ((performance.now() - a) / 1000)); });
  notes.push(`드라이브 중 화면 갱신 약 ${fps}fps`);
  await page.click('#cruise-results');
  await waitFor((x) => x.screen === 'results', '결과 화면');
  await sleep(1100); await fit('결과'); await shot('results');
  await page.screenshot({ path: path.join(OUT, `play_${name}_results_full.png`), fullPage: true });
  const res = await page.evaluate(() => ({ correct: document.querySelector('#r-correct').textContent, total: document.querySelector('#r-total').textContent, coins: document.querySelector('#r-coins').textContent,
    rows: document.querySelectorAll('#r-log li').length, listen: document.querySelectorAll('#r-log .say-again').length, stars: document.querySelectorAll('#r-stars i.on').length,
    garage: document.querySelector('#results [data-collection-garage]').href, runner: document.querySelector('#runner-play-next').href, next: document.querySelector('#next-stage').hidden }));
  check(res.correct === '4' && res.total === '5' && res.stars === 2, `결과 숫자 ${JSON.stringify(res)}`);
  check(/^공통 코인 \+\d+ · 보유 \d+/.test(res.coins), `결과 공통 코인 줄 ${res.coins}`);
  check(res.rows === 5 && res.listen === 5, `문제 목록·다시 듣기 ${JSON.stringify(res)}`);
  notes.push(`결과: ${res.correct}/${res.total} · ${res.coins}`);
  await page.click('#r-log .say-again');   // 다시 듣기(오류 없이)
  await sleep(300);
  await page.click('#home');
  await waitFor((x) => x.screen === 'lobby', '처음으로');
  const after = await page.evaluate(() => document.querySelector('#lobby [data-collection-balance]').textContent);
  check(/^보유 \d+코인$/.test(after) && after !== '보유 0코인', `처음으로 뒤 보유 코인 ${after}`);
  await fit('처음으로');
  check(errors.length === 0, `콘솔 오류 ${errors.join(' | ')}`);
  await ctx.close();
  return { name, shots, notes, fails, errors };
}

async function garageScene(browser) {
  const out = { name: 'garage', shots: [], notes: [], fails: [], errors: [] };
  for (const [label, view] of [['desktop', VIEWS.desktop], ['phone', VIEWS.phone]]) {
    const { ctx, page, errors } = await open(browser, view, { url: URL_BASE + '?garage=1&qa', coins: 260 });
    const check = (ok, what) => { if (!ok) out.fails.push(`${label}: ${what}`); };
    await sleep(800);
    const f0 = `play_garage_${label}_00_open.png`; await page.screenshot({ path: path.join(OUT, f0) }); out.shots.push(f0);
    const g = await page.evaluate(() => ({ screen: !document.querySelector('#garage').hidden, coins: document.querySelector('#garage-coins').textContent, items: document.querySelectorAll('.garage-item').length,
      equipped: document.querySelector('.garage-item.equipped')?.dataset.item, wait: !document.querySelector('#garage-wait').hidden }));
    check(g.screen && g.coins === '260' && g.items === 4 && g.equipped === 'vehicle-coast' && !g.wait, `차고 처음 ${JSON.stringify(g)}`);
    const canvas = await page.locator('#garage-world canvas').screenshot();
    const sd = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = 48; c.height = 32;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 32); const d = x.getImageData(0, 0, 48, 32).data; let s = 0, q = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; q += v * v; n++; } const m = s / n; return Math.sqrt(q / n - m * m); }, canvas.toString('base64'));
    check(sd > 10, `차고 3D 미리보기가 비었음 (${sd.toFixed(1)})`);
    // 브리즈 로드스터를 사서 장착한다
    await page.click('.garage-item[data-item="vehicle-open"]'); await sleep(400);
    await page.click('[data-action="buy"]'); await sleep(300);
    await page.click('[data-action="equip"]'); await sleep(900);
    const h = await page.evaluate(() => ({ coins: document.querySelector('#garage-coins').textContent, equipped: document.querySelector('.garage-item.equipped')?.dataset.item,
      notice: document.querySelector('#garage-notice').textContent, preview: window.__racing.snapshot().collection.preview }));
    check(h.coins === '140' && h.equipped === 'vehicle-open' && h.preview === 'open', `사고 장착 ${JSON.stringify(h)}`);
    const wide = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1, zoomed: innerWidth > (window.visualViewport?.width ?? innerWidth) + 1 }));
    check(!wide.wide && !wide.zoomed, `차고 가로 넘침 ${JSON.stringify(wide)}`);
    const f1 = `play_garage_${label}_01_equipped.png`; await page.screenshot({ path: path.join(OUT, f1) }); out.shots.push(f1);
    // 말 랠리 칸(2026-10-07): 같은 지갑으로 라켓을 사서 장착한다. 차 미리보기는 장착한 차 그대로다
    await page.click('#garage-tab-rally'); await sleep(300);
    const r0 = await page.evaluate(() => ({ items: [...document.querySelectorAll('.garage-item')].map((b) => b.dataset.item), equipped: [...document.querySelectorAll('.garage-item.equipped')].map((b) => b.dataset.item).sort(),
      selected: document.querySelector('.garage-item.selected')?.dataset.item, tab: document.querySelector('#garage-tab-rally')?.getAttribute('aria-selected') }));
    check(r0.tab === 'true' && r0.items.length === 8 && r0.items.every((id) => /^(racket|ball)-/.test(id)) && r0.equipped.join() === 'ball-cream,racket-coral' && r0.selected === 'racket-coral', `말 랠리 칸 ${JSON.stringify(r0)}`);
    await page.click('.garage-item[data-item="racket-butter"]'); await sleep(300);
    await page.click('[data-action="buy"]'); await sleep(300);
    await page.click('[data-action="equip"]'); await sleep(600);
    const r1 = await page.evaluate(() => ({ coins: document.querySelector('#garage-coins').textContent, equipped: [...document.querySelectorAll('.garage-item.equipped')].map((b) => b.dataset.item).sort(),
      have: document.querySelector('.garage-have')?.textContent, preview: window.__racing.snapshot().collection.preview, ball: window.__racing.snapshot().collection.equipped.ball,
      racket: window.__racing.snapshot().collection.equipped.racket, vehicle: window.__racing.snapshot().collection.equipped.vehicle }));
    check(r1.coins === '100' && r1.equipped.join() === 'ball-cream,racket-butter' && r1.racket === 'butter' && r1.vehicle === 'open' && r1.preview === 'open' && /말 랠리/.test(r1.have || ''), `말 랠리 라켓 사고 장착 ${JSON.stringify(r1)}`);
    const fr = `play_garage_${label}_02_rally.png`; await page.screenshot({ path: path.join(OUT, fr) }); out.shots.push(fr);
    const f2 = `play_garage_${label}_03_full.png`; await page.screenshot({ path: path.join(OUT, f2), fullPage: true }); out.shots.push(f2);
    await page.click('#garage-close');
    await page.waitForFunction(() => !document.querySelector('#lobby').hidden);
    check((await page.evaluate(() => document.querySelector('#lobby [data-collection-balance]').textContent)) === '보유 100코인', '차고를 닫은 뒤 입구 잔액');
    check(!(await page.evaluate(() => location.search.includes('garage=1'))), '차고를 닫으면 주소에서 garage=1을 뺀다');
    out.notes.push(`${label}: 260 → 브리즈 로드스터 120코인으로 사서 장착 → ${h.coins} → 말 랠리 칸에서 버터 라켓 40코인으로 사서 장착 → ${r1.coins}`);
    if (errors.length) out.fails.push(`${label}: 콘솔 오류 ${errors.join(' | ')}`);
    await ctx.close();
  }
  // 공개 사이트 경로(/try/racing/): 다른 게임 링크와 공통 차고 링크
  const { ctx, page, errors } = await open(browser, VIEWS.phone, { url: `${ORIGIN}/try/racing/?qa` });
  const links = await page.evaluate(() => ({ runner: [...document.querySelectorAll('#runner-play,#runner-play-next')].map((a) => a.getAttribute('href') && a.href),
    rhythm: [...document.querySelectorAll('#rhythm-play,#rhythm-play-next')].map((a) => a.href), garage: document.querySelector('#lobby [data-collection-garage]').href }));
  if (!(links.runner.every((h) => h === `${ORIGIN}/try/runner/`) && links.rhythm.every((h) => h === `${ORIGIN}/try/rhythm/`) && links.garage === `${ORIGIN}/try/racing/?garage=1`)) out.fails.push(`/try/racing/ 링크 ${JSON.stringify(links)}`);
  else out.notes.push(`/try/racing/: 바람길 → /try/runner/ · 말의 리듬 → /try/rhythm/ · 공통 차고 → /try/racing/?garage=1`);
  if (errors.length) out.fails.push(`/try/racing/ 콘솔 오류 ${errors.join(' | ')}`);
  await ctx.close();
  return out;
}

(async () => {
  const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const scenes = want.length ? want : ['desktop', 'phone', 'small', 'reduced', 'garage'];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  for (const name of scenes) {
    const t0 = Date.now();
    try { results.push(name === 'garage' ? await garageScene(browser) : await run(browser, name, VIEWS[name])); }
    catch (e) { results.push({ name, shots: [], notes: [], fails: ['중단: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' / ')], errors: [] }); }
    const r = results.at(-1); r.seconds = Math.round((Date.now() - t0) / 1000);
    console.log(`${r.fails.length ? '✗' : '✓'} ${name} (${r.seconds}초) ${r.fails.length ? '\n  - ' + r.fails.join('\n  - ') : ''}`);
    for (const n of r.notes) console.log('  · ' + n);
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'play-results.json'), JSON.stringify({ at: new Date().toISOString(), origin: ORIGIN, results }, null, 2));
  process.exitCode = results.some((r) => r.fails.length) ? 1 : 0;
})();
