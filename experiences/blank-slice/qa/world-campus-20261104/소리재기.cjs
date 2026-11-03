'use strict';
// 빈칸 베기 캠퍼스 판 종이 소리 크기 재기(2026-11-04). world-sfx.mjs의 소리를 헤드리스 크롬 OfflineAudioContext로 굽고(게임과 같은 버스 · 리미터),
// ffmpeg ebur128로 K 가중 순간 음량(400ms) 최대를 잰다 — LAB 펠트 소리(qa/sound.cjs · sound_check.py)와 같은 잣대.
// 목표(LAB 펠트와 같은 자리): 베기 맞힘 −17.8 · 끼워짐 −28 · 던지기 −26.6 LUFS, 몽글 목소리 자리는 목소리보다 작게(묻는 두 음 −24 · 연속 세 음 −22 · 단추 −30).
// 시안 때는 겉 셋을 같은 크기로 맞춰 견줬다(11-04). 결과는 표로 찍고, 맞출 LEVEL 값(지금 값 × 10^((목표−잰 값)/20))을 함께 낸다.
//   node experiences/blank-slice/qa/world-campus-20261104/소리재기.cjs
const path = require('node:path'), fs = require('node:fs'), http = require('node:http'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const GAME = path.resolve(__dirname, '../..');
const TARGET = { slice: -17.8, snap: -28, launch: -26.6, nudge: -24, streak: -22, tap: -30, mark: -30 };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><meta charset=utf-8>'); return; }
      const file = path.join(GAME, u);
      if (!file.startsWith(GAME) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function momentaryMax(wav) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const ms = [...`${r.stderr}`.matchAll(/ M:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
  const peak = /Peak:\s*\n\s*Peak:\s*(-?[\d.]+)/.exec(r.stderr) || /True peak:[\s\S]*?Peak:\s*(-?[\d.]+)/.exec(r.stderr);
  return { lufs: Math.max(...ms), peak: peak ? Number(peak[1]) : null };
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  const cases = [];
  cases.push(['찢기', 'slice', { correct: true, combo: 1 }], ['찢기', 'slice', { correct: false }], ['찢기', 'snap', {}], ['찢기', 'launch', { n: 2 }],
    ['찢기', 'nudge', {}], ['찢기', 'streak', {}], ['찢기', 'tap', {}], ['찢기', 'mark', { ok: true, step: 3 }]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blank-slice-sound-'));
  const rows = [];
  for (const [kind, name, opts] of cases) {
    const b64 = await page.evaluate(async ({ kind, name, opts }) => {
      const { createBus } = await import('/sfx.mjs'), { VOICES } = await import('/world-sfx.mjs');
      const sr = 48000, c = new OfflineAudioContext(2, sr * 1.2, sr), bus = createBus(c, { seed: 7 });
      VOICES[name](bus, 0.05, opts);
      const buf = await c.startRendering(), n = buf.length, out = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
      out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
      str(36, 'data'); out.setUint32(40, n * 4, true);
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      let s = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, { kind, name, opts });
    const wav = path.join(tmp, `${kind}-${name}${opts.correct === false ? '-wrong' : ''}.wav`);
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    rows.push({ kind, name: name + (opts.correct === false ? '(틀림)' : ''), ...momentaryMax(wav), target: opts.correct === false ? null : TARGET[name] });
  }
  await browser.close(); srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const r of rows) console.log(`${r.kind.padEnd(7)} ${r.name.padEnd(10)} ${r.lufs.toFixed(1).padStart(6)} LUFS  꼭대기 ${r.peak ?? '-'}  ${r.target != null ? `목표 ${r.target} → 배율 ×${(10 ** ((r.target - r.lufs) / 20)).toFixed(3)}` : ''}`);
})().catch((e) => { console.error(e); process.exit(1); });
