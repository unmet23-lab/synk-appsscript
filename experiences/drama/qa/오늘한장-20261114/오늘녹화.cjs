#!/usr/bin/env node
// 「오늘」 화면 녹화(11-19) — 대역 판(오늘시험.mjs)을 열어 정한 초만큼 녹화하고, 드라마 틀이 남긴 소리 기록(window.__sfx — msg.mjs가 효과음과
// 태오 영상 메시지를 틀 때마다 시각을 남긴다)으로 효과음과 태오 목소리를 입혀 mp4를 만든다. 정한 순간마다 캡처도 남긴다.
// 정지 캡처 점수로 끝내지 않고 소리를 입힌 녹화로 본다(DESIGN 「정지 캡처 점수로 끝내지 않는다」, 11-18).
//   node experiences/drama/qa/오늘한장-20261114/오늘녹화.cjs [주소=http://127.0.0.1:8798] [--s A|B] [--size 390x844] [--secs 22]
//        [--찍을 3,12,20] [--누를 "15:.td [data-ph]"] [--out .tmp/today-msg-1119] [--이름 a_390]
// playwright는 공용 작업본 node_modules, 크롬은 설치된 헤드리스 껍데기(소리 자동 재생 허용).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const MAIN = process.env.SYNK_MAIN || path.join(os.homedir(), 'Documents/SYNK-appsscript');
const ROOT = path.resolve(__dirname, '../../../..');
const { chromium } = require(path.join(MAIN, 'node_modules/playwright'));
const args = process.argv.slice(2);
const opt = (k, d = null) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const base = args.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8798';
const [W, H] = opt('--size', '390x844').split('x').map(Number);
const secs = Number(opt('--secs', '22'));
const shots = (opt('--찍을') || '').split(',').filter(Boolean).map(Number);
const clicks = (opt('--누를') || '').split(',').filter(Boolean).map((x) => { const k = x.indexOf(':'); return [Number(x.slice(0, k)), x.slice(k + 1)]; });
const out = path.resolve(opt('--out', '.tmp/today-msg-1119'));
const tag = opt('--이름', `${opt('--s', 'A')}_${W}`);
const shell = () => { const r = path.join(os.homedir(), 'AppData/Local/ms-playwright'); const d = fs.readdirSync(r).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop(); return path.join(r, d, 'chrome-headless-shell-win64/chrome-headless-shell.exe'); };
fs.mkdirSync(out, { recursive: true });
// 소리 기록의 이름 → 파일. sfx/<이름>은 오늘 화면의 효과음, video:/drama/<경로>는 드라마 틀의 파일.
const fileOf = (name) => (name.startsWith('sfx/') ? path.join(ROOT, 'experiences/drama/pilot/today', name)
 : name.startsWith('video:') ? path.join(ROOT, 'experiences/drama/pilot', decodeURIComponent(name.slice(6)).replace(/^\/drama\//, '')) : null);

(async () => {
 const b = await chromium.launch({ executablePath: shell(), args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
 const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: W, height: H } } });
 await ctx.addInitScript(() => { window.__sfx = []; });
 const t0 = Date.now();
 const page = await ctx.newPage();
 const errors = [];
 page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
 page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`console: ${m.text()}`); });
 await page.goto(`${base}/?s=${opt('--s', 'A')}`);
 const F = () => page.frame({ url: /\/drama\// });
 // 오늘 화면이 뜬 때를 녹화의 0초로 본다(대역이 기록을 심는 동안의 빈 화면은 잘라 낸다).
 for (let i = 0; i < 900 && !(await F()?.$('.td-msg').catch(() => null)); i++) await page.waitForTimeout(100); // PC가 바쁘면 기록 심기가 늦다 — 90초까지
 const shownAt = Date.now();
 const evs = [...shots.map((t) => ['shot', t]), ...clicks.map(([t, s]) => ['click', t, s])].sort((x, y) => x[1] - y[1]);
 for (const [k, t, s] of evs) {
  const wait = t * 1000 - (Date.now() - shownAt); if (wait > 0) await page.waitForTimeout(wait);
  if (k === 'shot') await page.screenshot({ path: path.join(out, `${tag}_${String(t).padStart(4, '0')}s.png`) });
  else await F().click(s, { timeout: 5000 }).catch((e) => errors.push(`click ${s}: ${e.message.split('\n')[0]}`));
 }
 const rest = secs * 1000 - (Date.now() - shownAt); if (rest > 0) await page.waitForTimeout(rest);
 const frame = F();
 const log = frame ? await frame.evaluate(() => ({ sfx: window.__sfx || [], origin: performance.timeOrigin })) : { sfx: [], origin: 0 };
 const vid = page.video(); await ctx.close(); const webm = await vid.path(); await b.close();
 const off = (log.origin - t0) / 1000; // 틀의 performance 0초 → 녹화 0초
 const ins = ['-y', '-i', webm]; const parts = []; let n = 1;
 for (const e of log.sfx) {
  const f = fileOf(e.name);
  if (!f || !fs.existsSync(f) || !e.vol) continue;
  ins.push('-i', f);
  const ms = Math.max(0, Math.round((e.t + off) * 1000));
  parts.push(`[${n}:a]adelay=${ms}|${ms},volume=${Number(e.vol).toFixed(2)}[s${n}]`); n++;
 }
 const mp4 = path.join(out, `${tag}.mp4`), tmp = mp4.replace(/\.mp4$/, '.full.mp4');
 if (n > 1) execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', ...ins, '-filter_complex', `${parts.join(';')};${Array.from({ length: n - 1 }, (_, i) => `[s${i + 1}]`).join('')}amix=inputs=${n - 1}:normalize=0,alimiter=limit=0.9,apad[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest', tmp]);
 else execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', tmp]);
 fs.unlinkSync(webm);
 const cut = Math.max(0, (shownAt - t0) / 1000 - 0.3);
 execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', cut.toFixed(2), '-i', tmp, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', mp4]);
 fs.unlinkSync(tmp);
 console.log(JSON.stringify({ mp4, sounds: log.sfx.length, cut: +cut.toFixed(2), errors }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
