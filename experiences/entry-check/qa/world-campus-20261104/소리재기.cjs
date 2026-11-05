'use strict';
// 입장 검사 WORLD 효과음의 크기를 잰다(2026-11-04, 주문 폭주 소리재기.cjs를 옮김). 소리마다 브라우저(헤드리스 Chromium)의 OfflineAudioContext(48kHz · 모노)로
// world-sfx.mjs를 게임과 같은 길(renderSfx → 버스 → 리미터)로 그리고, 사운드킷과 같은 잣대 — BS.1770 K 가중 400ms 순간 음량의 최댓값
// (50ms 간격, 앞뒤 0 채움 — experiences/blank-slice/qa/sound_check.py measure와 같은 셈) — 을 씨앗 다섯으로 재어 평균한다.
// 목표(TARGET)와의 차이로 LEVEL을 정하고, --쓰기면 world-sfx.mjs의 LEVEL 덩이를 고쳐 쓴 뒤 다시 재서 qa/world-sfx-levels.json에 남긴다
// (world-sfx.test.mjs가 이 파일과 LEVEL이 같은지, 모든 소리가 목표 ±1 LU인지 본다).
//   node experiences/entry-check/qa/world-campus-20261104/소리재기.cjs           재기만(표)
//   node experiences/entry-check/qa/world-campus-20261104/소리재기.cjs --쓰기    LEVEL 고쳐 쓰기 → 다시 재기 → qa/world-sfx-levels.json
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const GAME = path.resolve(__dirname, '../..');
const SFX = path.join(GAME, 'world-sfx.mjs');
const OUT = path.join(__dirname, '..', 'world-sfx-levels.json');   // world-sfx.test.mjs가 읽는 기준이라 qa 실행 폴더(결과 파일 무시) 밖에 둔다

// 목표(LUFS, 순간 최대). 손님 목소리는 통합 −22 안팎 — 효과음은 그보다 아래에 두되, 맞음은 사운드킷 「획득」(−20.8), 근무 끝은 「성취」(−15.6)보다 조금 아래.
// 도장은 이 게임의 간판 소리라 효과음 가운데 가장 또렷하게(−20). 틱 · 굴림처럼 20ms 안팎의 짧은 소리는 400ms 창이 작게 재므로 목표를 낮췄다(주문 폭주 11-03 첫 측정).
const TARGET = {
  tap: -31, arrive: -24, leave: -28, open: -21, slide: -27, place: -26, stampPass: -21, stampReject: -21, choose: -26, hint: -27, notify: -22,
  correct: -20.8, combo: -19, differ: -26, roll: -34, land: -20, done: -17.5, coin: -21,
};
// 잴 때 넘기는 선택(게임에서 가장 흔한 모양)
const OPTS = { arrive: { guest: 'raccoon' }, leave: { guest: 'raccoon' }, place: { step: 2 }, correct: { combo: 2 } };
const SEEDS = [1, 2, 3, 5, 8];

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>소리재기</title>'); return; }
      const file = path.join(GAME, u);
      if (!file.startsWith(GAME) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function measureAll(page, levels) {
  return page.evaluate(async ({ names, opts, seeds, levels }) => {
    const m = await import(`/world-sfx.mjs?${Date.now()}`);
    if (levels) Object.assign(m.LEVEL, levels);
    const SR = 48000;
    // BS.1770-4 K 가중(48kHz 계수): 고역 선반 → RLB 고역 통과
    const K = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]], [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]]];
    const filt = (x, [b, a]) => {
      const y = new Float64Array(x.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i += 1) {
        const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
      }
      return y;
    };
    const momentaryMax = (data) => {
      const win = Math.round(0.4 * SR), hop = Math.round(0.05 * SR);
      const y = filt(filt(data, K[0]), K[1]);
      const pad = new Float64Array(y.length + 2 * win); pad.set(y, win);
      const cs = new Float64Array(pad.length + 1);
      for (let i = 0; i < pad.length; i += 1) cs[i + 1] = cs[i] + pad[i] * pad[i];
      let best = -120;
      for (let s = 0; s + win < pad.length; s += hop) { const z = (cs[s + win] - cs[s]) / win; if (z > 0) best = Math.max(best, -0.691 + 10 * Math.log10(z)); }
      return best;
    };
    const out = {};
    for (const name of names) {
      const vals = [], peaks = [];
      for (const seed of seeds) {
        const c = new OfflineAudioContext(1, Math.round(SR * 0.6), SR);
        const bus = m.createBus(c, { seed });
        m.renderSfx(bus, name, 0.05, opts[name] || {});
        const buf = await c.startRendering(), d = buf.getChannelData(0);
        let p = 0; for (let i = 0; i < d.length; i += 1) p = Math.max(p, Math.abs(d[i]));
        vals.push(momentaryMax(d)); peaks.push(20 * Math.log10(p || 1e-9));
      }
      out[name] = { lufs: vals.reduce((a, b) => a + b, 0) / vals.length, spread: Math.max(...vals) - Math.min(...vals), peakDb: Math.max(...peaks) };
    }
    return { out, level: { ...m.LEVEL } };
  }, { names: Object.keys(TARGET), opts: OPTS, seeds: SEEDS, levels });
}

(async () => {
  const write = process.argv.includes('--쓰기');
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    // 1) 날 크기(LEVEL 1)로 재고 2) 목표와의 차이로 LEVEL을 정한다
    const ones = Object.fromEntries(Object.keys(TARGET).map((k) => [k, 1]));
    const raw = await measureAll(page, ones);
    const level = Object.fromEntries(Object.entries(TARGET).map(([k, t]) => [k, Math.round(Math.pow(10, (t - raw.out[k].lufs) / 20) * 1000) / 1000]));
    if (write) {
      const src = fs.readFileSync(SFX, 'utf8');
      const entries = Object.entries(level).map(([k, v]) => `${k}: ${v}`), lines = [];
      for (let i = 0; i < entries.length; i += 8) lines.push(`  ${entries.slice(i, i + 8).join(', ')},`);
      const block = `export const LEVEL = {\n${lines.join('\n')}\n};`;
      if (!/export const LEVEL = \{[\s\S]*?\n\};/.test(src)) throw Error('LEVEL 덩이를 찾지 못했다');
      const next = src.replace(/export const LEVEL = \{[\s\S]*?\n\};/, block);
      fs.writeFileSync(SFX, next);
    }
    // 3) 그 LEVEL로 다시 재서(리미터가 일하면 선형이 아니다) 남긴다
    const fin = await measureAll(page, level);
    const rows = Object.keys(TARGET).map((k) => ({ 소리: k, 목표: TARGET[k], 날것: +raw.out[k].lufs.toFixed(1), LEVEL: level[k], 맞춘뒤: +fin.out[k].lufs.toFixed(1), 차이: +(fin.out[k].lufs - TARGET[k]).toFixed(2), 씨앗폭: +fin.out[k].spread.toFixed(1), 최대dBFS: +fin.out[k].peakDb.toFixed(1) }));
    console.table(rows);
    const bad = rows.filter((r) => Math.abs(r.차이) > 1);
    if (write) {
      fs.writeFileSync(OUT, JSON.stringify({
        measured: new Date().toISOString().slice(0, 10), method: 'OfflineAudioContext 48kHz mono → BS.1770 K-weighting → 400ms momentary max, hop 50ms, zero-padded (sound_check.py measure); mean of seeds ' + SEEDS.join(','),
        opts: OPTS, target: TARGET, level, measuredLufs: Object.fromEntries(rows.map((r) => [r.소리, r.맞춘뒤])), peakDbfs: Object.fromEntries(rows.map((r) => [r.소리, r.최대dBFS])),
      }, null, 1) + '\n');
      console.log('LEVEL을 world-sfx.mjs에 썼다 →', path.relative(process.cwd(), OUT));
    }
    if (bad.length) { console.log('목표 ±1 LU 밖:', bad.map((r) => r.소리).join(', ')); process.exitCode = 1; }
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
