// 시안 녹화 — 쪽을 열어 정한 초만큼 녹화하고(자동 재생 허용), 쪽이 남긴 소리 기록(window.__sfx)으로 소리를 입혀 mp4를 만든다. 정한 순간마다 캡처도 남긴다.
//   node 찍기.cjs <쪽 이름 a|b|c> <390x844|1440x900> <초> [--찍을 2,6,12] [--누를 "초:선택자,초:선택자"]
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const MAIN = path.join(os.homedir(), 'Documents/SYNK-appsscript');
const { chromium } = require(path.join(MAIN, 'node_modules/playwright'));
const shell = () => { const root = path.join(os.homedir(), 'AppData/Local/ms-playwright'); const d = fs.readdirSync(root).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop(); return path.join(root, d, 'chrome-headless-shell-win64/chrome-headless-shell.exe'); };
const [name, size = '390x844', secs = '14'] = process.argv.slice(2);
const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const shots = (opt('--찍을') || '').split(',').filter(Boolean).map(Number);
const clicks = (opt('--누를') || '').split(',').filter(Boolean).map((x) => { const k = x.indexOf(':'); return [Number(x.slice(0, k)), x.slice(k + 1)]; });
const [W, H] = size.split('x').map(Number);
const DIR = __dirname, OUT = path.join(DIR, '녹화'); fs.mkdirSync(OUT, { recursive: true });
const tag = `${name}_${W}`;
(async () => {
  const b = await chromium.launch({ executablePath: shell(), args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  const t0 = Date.now();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:4963/${name}.html`);
  const origin = await page.evaluate(() => performance.timeOrigin);
  const evs = [...shots.map((t) => ['shot', t]), ...clicks.map(([t, s]) => ['click', t, s])].sort((a, b) => a[1] - b[1]);
  const start = Date.now();
  for (const [k, t, s] of evs) {
    const wait = t * 1000 - (Date.now() - start); if (wait > 0) await page.waitForTimeout(wait);
    if (k === 'shot') await page.screenshot({ path: path.join(OUT, `${tag}_${String(t).padStart(4, '0')}s.png`) });
    else await page.click(s).catch((e) => errs.push(`click ${s}: ${e.message}`));
  }
  const rest = secs * 1000 - (Date.now() - start); if (rest > 0) await page.waitForTimeout(rest);
  const log = await page.evaluate(() => ({ sfx: window.__sfx || [], t0: (window.__T0abs || 0) }));
  const T0page = await page.evaluate(() => performance.now()); // 쓰지 않음 — 기준은 공용.js 불러온 때
  const modT0 = await page.evaluate(() => window.__modT0 || 0);
  const vid = page.video(); await ctx.close(); const webm = await vid.path(); await b.close();
  // 소리 입히기 — 공용.js의 시각 0은 그 모듈이 뜬 때(performance.now 기준 __modT0), 녹화 0은 문맥을 만든 때.
  const off = (origin + modT0 - t0) / 1000;
  const ins = ['-y', '-i', webm]; const parts = []; let n = 1;
  for (const e of log.sfx) {
    const file = e.name.startsWith('video:') ? path.join(DIR, e.name.slice(6)) : path.join(DIR, 's', e.name);
    if (!fs.existsSync(file) || e.vol === 0) continue;
    ins.push('-i', file);
    const ms = Math.max(0, Math.round((e.t + off) * 1000));
    parts.push(`[${n}:a]adelay=${ms}|${ms},volume=${(e.vol || .5).toFixed(2)}[s${n}]`); n++;
  }
  const mp4 = path.join(OUT, `${tag}.mp4`);
  if (n > 1) execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', ...ins, '-filter_complex', `${parts.join(';')};${Array.from({ length: n - 1 }, (_, i) => `[s${i + 1}]`).join('')}amix=inputs=${n - 1}:normalize=0,alimiter=limit=0.9,apad[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4]);
  else execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4]);
  fs.unlinkSync(webm);
  // 쪽이 뜨기 전의 빈 화면을 잘라 낸다(공용.js가 뜬 때의 0.3초 앞부터).
  const cut = Math.max(0, off - 0.3), tmp = mp4.replace(/\.mp4$/, '.tmp.mp4');
  if (cut > 0.05) { execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', cut.toFixed(2), '-i', mp4, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', tmp]); fs.renameSync(tmp, mp4); }
  console.log(JSON.stringify({ mp4, sounds: log.sfx.length, off: +off.toFixed(3), errors: errs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
