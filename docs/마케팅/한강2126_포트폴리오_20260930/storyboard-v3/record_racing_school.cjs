// 우리 한국어 레이싱 게임의 「학교」 문제 장면을 실제 플레이로 녹화한다(세로 화면, 소리 없음).
// 게임 코드는 건드리지 않는다. 이미 떠 있는 로컬 서버(experiences/korean-racing/server.mjs, 5197)를 읽기만 한다.
//
//   PLAYWRIGHT_MODULE=<playwright 경로> node record_racing_school.cjs <결과 접두어> [찾을 질문=어디에 가요] [친구=kkamong]
//
// 자동 시연(정답 차선으로 스스로 감)을 시작하고, 3D 화면(canvas)을 MediaRecorder로 받는다.
// 헤드리스 Chrome은 소리 시계가 멈춰 있어 음성을 기다리던 차가 관문 앞에서 서 버린다. 그래서 소리를 끄고 달린다.
// 소리를 끄면 게임이 지문·보기 창을 펼치고 기다리므로, 창이 펼쳐지면 바로 접어 준다(찾는 질문은 화면 한 장을 찍고 접는다).
// 찾는 질문의 관문을 지나고 8초 뒤 멈춘다. <접두어>.webm, <접두어>.json(시각 기록), <접두어>_hud.png(실제 화면 한 장).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const [out, want = '어디에 가요', friend = 'kkamong'] = process.argv.slice(2);
if (!out) { console.error('사용: node record_racing_school.cjs <결과 접두어> [보기] [친구]'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
  const ws = fs.createWriteStream(out + '.webm');
  await page.exposeFunction('__saveChunk', b64 => new Promise(res => ws.write(Buffer.from(b64, 'base64'), res)));
  await page.goto('http://127.0.0.1:5197/?capture=4k', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__racing?.snapshot().ready, null, { timeout: 240000 });
  await page.selectOption('#quality', 'high').catch(() => {});
  const friends = await page.$$eval('[id^="driver-"]', els => els.map(e => e.id));
  if (friends.includes('driver-' + friend)) await page.click('#driver-' + friend);
  await page.click('#sound'); await page.click('#sound');   // 켰다 꺼서 「소리 끔」을 고른 상태로 둔다
  await page.waitForTimeout(1500);
  await page.click('#watch');
  await page.waitForFunction(() => window.__racing.snapshot().running, null, { timeout: 120000 });
  const info = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const stream = canvas.captureStream(30);
    const mime = 'video/webm;codecs=vp9';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14000000 });
    let queue = Promise.resolve();
    rec.ondataavailable = e => {
      if (!e.data.size) return;
      queue = queue.then(async () => {
        const buf = new Uint8Array(await e.data.arrayBuffer()); let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        await window.__saveChunk(btoa(s));
      });
    };
    window.__recDone = new Promise(res => { rec.onstop = () => queue.then(res); });
    rec.start(1000); window.__rec = rec; window.__recT0 = performance.now();
    return { canvas: [canvas.width, canvas.height], mime, sound: document.getElementById('sound')?.getAttribute('aria-pressed') };
  });
  console.log('녹화 시작', JSON.stringify(info), friends.join(','));
  const log = []; let seenAt = null, passedAt = null, shot = false; const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => {
      const x = window.__racing.snapshot();
      return { t: +((performance.now() - window.__recT0) / 1000).toFixed(2), running: x.running, elapsed: x.elapsed, s: x.playerS, off: x.playerOffset,
        v: x.velocity, boost: x.boost, correct: x.correct, answers: x.answers.length, stage: x.stage?.title,
        gate: x.gate ? { s: x.gate.s, prompt: x.gate.prompt, types: x.gate.types, announced: x.gate.announced } : null };
    });
    log.push(s);
    const has = !!(s.gate && String(s.gate.prompt || '').includes(want));
    if (has && seenAt === null) { seenAt = { t: s.t, answers: s.answers }; console.log('찾는 관문 보임', s.t, JSON.stringify(s.gate)); }
    const open = await page.evaluate(() => document.getElementById('question-toggle')?.getAttribute('aria-expanded') === 'true');
    if (open) {
      if (has && !shot) { shot = true; await page.screenshot({ path: out + '_hud.png' }); }
      await page.click('#question-toggle');
    }
    if (seenAt && passedAt === null && s.answers > seenAt.answers) { passedAt = s.t; console.log('관문 지남', s.t, '맞힌 수', s.correct); }
    if (passedAt !== null && s.t - passedAt > 8) break;
    if (!s.running && s.t > 20) { console.log('주행 끝', s.t); break; }
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => { window.__rec.stop(); return window.__recDone; });
  await new Promise(res => ws.end(res));
  fs.writeFileSync(out + '.json', JSON.stringify({ want, friend, info, seenAt, passedAt, log }, null, 1));
  console.log('끝', JSON.stringify({ seenAt, passedAt, samples: log.length }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
