#!/usr/bin/env node
// 쇼케이스 1분 영상판의 날것 녹화 — 시범판 화면을 콘티 흐름대로 한 번 처음부터 끝까지 돈다(2026-11-03).
//   node experiences/drama/qa/쇼케이스-20261031/영상판녹화.mjs --나갈 <폴더> [--소리 <학습자 소리 폴더>] [--port 8797] [--로케일 ko-KR] [--창 390x844]
//   --창을 주면 틀을 키우지 않고 그 크기 그대로 돈다(화면 검수 캡처용 — 끝화면 · 끝화면_아래 png).
// · 틀 시험 서버(qa/WORLD올리기-20261102/틀시험.mjs)를 띄운다 — 판정은 talk와 같은 판정기, 받아 적힌 글만 아래 받아적기로 정한다.
//   운영 계정 · talk · DB · OpenAI를 부르지 않는다. 실제 받아쓰기(11-08 크레딧 뒤)로 다시 돌릴 수 있게 흐름은 같게 둔다.
// · 마이크 자리에 학습자 줄(Hana)을 흘려 음성 구가 실제 말소리에 반응하게 한다. 화면은 CDP 스크린캐스트, 소리는 재생 기록으로 나중에 원본 파일에서 얹는다.
// · 나오는 것: 나갈/frames/*.jpg · frames.json(프레임 시각) · timeline.json(소리 · 영상 재생 기록 · 학습자 줄 시각 · 화면 단계).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--나갈', path.join(process.env.USERPROFILE, 'Documents/synk-vendor/drama-showcase-20261031/영상판/날것')));
const VOICE = path.resolve(opt('--소리', path.join(process.env.USERPROFILE, 'Documents/synk-vendor/drama-showcase-20261031/영상판/소리')));
const PORT = Number(opt('--port', 8797));
const LOCALE = opt('--로케일', 'en-US');
const WINDOW = opt('--창', '').match(/^(\d+)x(\d+)$/);
const MAIN = process.env.SYNK_MAIN || path.resolve(ROOT, '../../..');
const req = createRequire(path.join(fs.existsSync(path.join(ROOT, 'node_modules/playwright')) ? ROOT : MAIN, 'x.js'));
const { chromium } = req('playwright');

// 받아 적힌 글(콘티 표의 학습자 말과 같다). 6번은 첫 테이크에 끝 「요」가 빠진다.
const TRANSCRIPTS = {
 's1e01-6': ['네, 맞아요. 길을 잃어서 한참 헤맸어', '네, 맞아요. 길을 잃어서 한참 헤맸어요'],
 's1e01-7': ['네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?', '선배님, 도서관이 어디예요?'],
 's1e01-8': ['정말요? 선배님 덕분에 살았어요'],
 's1e01-t9': ['선배님, 혹시 편의점이 어디에 있는지 아세요?'],
};
// 내 차례가 오는 순서대로 마이크에 흘릴 소리. trim = 파일 안 구간.
const CLIPS = [
 { label: '6-첫', file: path.join(VOICE, '학습자-헤맸어.mp3') },
 { label: '6-고침', file: path.join(ROOT, 'experiences/drama/s1/소리/ep01-model-06.mp3') },
 { label: '7', file: path.join(ROOT, 'experiences/drama/s1/소리/ep01-model-07.mp3') },
 { label: '8', file: path.join(ROOT, 'experiences/drama/s1/소리/ep01-model-08.mp3') },
 { label: '7-다른말', file: path.join(VOICE, '학습자-도서관.mp3') },
 { label: 't9', file: path.join(VOICE, '학습자-편의점.mp3') },
];
const VIEW = { width: 405, height: 720 }; // 앱이 그려지는 크기(휴대폰 폭). 스크린캐스트는 deviceScaleFactor를 안 따라 창을 1080×1920으로 두고 틀을 키운다.
const SCALE = 1080 / VIEW.width;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const transcriptsFile = path.join(OUT, '받아적기.json');
fs.writeFileSync(transcriptsFile, JSON.stringify(TRANSCRIPTS));

const server = spawn(process.execPath, [path.join(ROOT, 'experiences/drama/qa/WORLD올리기-20261102/틀시험.mjs'), '--port', String(PORT), '--받아적기', transcriptsFile], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { server.stdout.once('data', res); server.once('exit', (c) => rej(new Error(`서버 끝남 ${c}`))); });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] }); // 음성 구(WebGL)를 CPU로 그리면 화면이 끊긴다
const ctx = await browser.newContext({ viewport: WINDOW ? { width: +WINDOW[1], height: +WINDOW[2] } : { width: 1080, height: 1920 }, locale: LOCALE, hasTouch: false });
await ctx.addInitScript(() => {
 // 재생 기록(소리 없는 고리까지) — 소리를 나중에 원본 파일에서 얹으려고 시각 · 위치를 적는다.
 const tl = window.__tl = [];
 for (const type of ['playing', 'pause', 'ended', 'seeked']) document.addEventListener(type, (e) => {
  const m = e.target; if (!(m instanceof HTMLMediaElement)) return;
  tl.push({ type, at: Date.now(), id: m.id, src: m.currentSrc, ct: m.currentTime, muted: m.muted, volume: m.volume, rate: m.playbackRate });
 }, true);
 // 마이크 자리: 학습자 줄을 흘려 보내는 가짜 스트림.
 let ac, dest;
 const need = () => { ac ||= new AudioContext(); dest ||= ac.createMediaStreamDestination(); return ac.resume(); };
 if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { await need(); return dest.stream.clone(); };
 window.__feed = async (b64) => {
  await need();
  const buf = await ac.decodeAudioData(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer);
  const n = ac.createBufferSource(); n.buffer = buf; n.connect(dest); n.start();
  return { at: Date.now(), dur: buf.duration };
 };
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('페이지 오류', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('콘솔 오류', m.text().slice(0, 200)); });
page.on('response', (r) => { if (r.status() >= 400) console.log('응답', r.status(), r.url()); });
await page.goto(`http://127.0.0.1:${PORT}/`);
if (!WINDOW) await page.addStyleTag({ content: `iframe{width:${VIEW.width}px!important;height:${VIEW.height}px!important;transform:scale(${SCALE});transform-origin:0 0}` });
let frame;
for (let i = 0; i < 100 && !frame; i += 1) { frame = page.frames().find((f) => /\/drama\//.test(f.url())); if (!frame) await sleep(100); }
if (!frame) throw new Error('드라마 틀이 안 열림');
await frame.waitForSelector('#orbBtn', { state: 'attached' });

// 화면 녹화
const cdp = await ctx.newCDPSession(page);
const frames = [];
let writing = Promise.resolve();
cdp.on('Page.screencastFrame', (f) => {
 const i = frames.length; frames.push({ i, t: f.metadata.timestamp });
 const bytes = Buffer.from(f.data, 'base64');
 writing = writing.then(() => fs.promises.writeFile(path.join(OUT, 'frames', `${String(i).padStart(6, '0')}.jpg`), bytes));
 cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });

const stepsLog = [], learner = [];
const mark = (name, extra = {}) => { stepsLog.push({ name, at: Date.now(), ...extra }); console.log(new Date().toISOString().slice(14, 23), name, JSON.stringify(extra).slice(0, 160)); };
const look = () => frame.evaluate(() => {
 const q = (s) => document.querySelector(s);
 const vis = (el) => !!el && !el.hidden && el.getClientRects().length > 0;
 const dlg = q('dialog[open]');
 return { dlg: dlg ? [...dlg.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), primary: b.classList.contains('pill') })) : null,
  mic: vis(q('#mic')), orbOff: q('#orbBtn')?.disabled, mstate: q('#mstate')?.textContent || '', rec: document.body.classList.contains('is-recording'),
  pills: [...document.querySelectorAll('#panel .pill')].filter(vis).map((b) => b.textContent.trim()),
  panel: (q('#panel')?.innerText || '').replace(/\s+/g, ' ').slice(0, 110), slate: vis(q('#slate')) ? q('#slate').innerText.replace(/\s+/g, ' ') : '',
  subs: (q('#subs')?.innerText || '').replace(/\s+/g, ' ').slice(0, 60) };
});
// 단추 카드를 읽는 틈. 통과 칩(1초 남짓)이 다음 화면에 겹치지 않을 만큼 둔다.
const READ_MS = (label) => (/Start the scene|장면 시작/.test(label) ? 3200 : /Start take 2|New situation|Finish|테이크 2|새 상황|마치기/.test(label) ? 3000 : 1100);
let clip = 0, last = '', settled = 0, ended = false;
const start = Date.now();
while (Date.now() - start < 240000 && !ended) {
 const s = await look();
 const key = JSON.stringify([s.dlg?.map((b) => b.t), s.mstate, s.pills, s.panel, s.slate]);
 if (key !== last) { last = key; settled = Date.now(); mark('화면', { mstate: s.mstate, pills: s.pills, panel: s.panel, slate: s.slate, dlg: s.dlg?.map((b) => b.t) }); }
 if (s.dlg) { const b = s.dlg.find((x) => x.primary) || s.dlg.at(-1); await sleep(500); await frame.locator('dialog[open] button', { hasText: b.t }).first().click(); mark('대화 상자', { 눌림: b.t }); await sleep(200); continue; }
 if (s.mic && s.mstate === 'Tap to speak' && !s.orbOff) { // 구 글자는 언어와 상관없이 영문이다
  const c = CLIPS[clip]; if (!c) { mark('소리 줄 끝인데 또 차례'); break; }
  await sleep(c.label === 't9' ? 3600 : 1300); // 카드를 읽는 틈 — 편집에서 줄인다(새 상황은 영어 글이 길다)
  const b64 = fs.readFileSync(c.file).toString('base64');
  await frame.locator('#orbBtn').click();
  await frame.waitForFunction(() => document.body.classList.contains('is-recording'), null, { timeout: 8000 });
  const fed = await frame.evaluate((x) => window.__feed(x), b64);
  learner.push({ label: c.label, file: c.file, at: fed.at, dur: fed.dur });
  mark('학습자 말', { label: c.label, dur: fed.dur });
  await sleep(fed.dur * 1000 + 180);
  await frame.locator('#orbBtn').click();
  mark('말 끝', { label: c.label });
  clip += 1; continue;
 }
 // 단추만 있는 카드: 읽을 틈을 두고 주 단추를 누른다. 마침 화면(오늘 기록)에서 끝낸다.
 if (s.pills.length && !s.rec && Date.now() - settled > READ_MS(s.pills[0])) {
  if (/오늘 기록|Today/i.test(s.panel) && clip >= CLIPS.length) { mark('마침 화면'); await sleep(7000); ended = true; break; }
  await frame.locator('#panel .pill').first().click(); mark('단추', { 눌림: s.pills[0] }); settled = Date.now(); await sleep(150); continue;
 }
 await sleep(60);
}
const tl = await frame.evaluate(() => window.__tl);
await cdp.send('Page.stopScreencast');
await sleep(300); await writing;
await page.screenshot({ path: path.join(OUT, '끝화면.png') });
await frame.evaluate(() => { document.querySelector('details.takes')?.setAttribute('open', ''); const w = document.querySelector('.wrap'); let e = w; while (e && e.scrollHeight <= e.clientHeight + 1) e = e.parentElement; if (e) e.scrollTop = e.scrollHeight; });
await sleep(300);
await page.screenshot({ path: path.join(OUT, '끝화면_아래.png') });
const measure = await frame.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth, img: document.querySelector('.next-img')?.naturalWidth || 0 }));
console.log('끝 화면 폭 재기', JSON.stringify(measure));
const log = await (await fetch(`http://127.0.0.1:${PORT}/log`)).json();
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames));
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ tl, learner, steps: stepsLog, judge: log, view: VIEW }, null, 1));
await browser.close(); server.kill();
const span = frames.length > 1 ? frames.at(-1).t - frames[0].t : 0;
console.log(`프레임 ${frames.length} · ${span.toFixed(1)}초 · 평균 ${(frames.length / span).toFixed(1)}fps · 판정`, log.map((x) => `${x.line}:${x.verdict}${x.note ? '/' + x.note : ''}`).join(' '));
if (!ended) { console.log('마침 화면까지 못 감'); process.exitCode = 1; }
