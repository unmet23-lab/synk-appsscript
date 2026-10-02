#!/usr/bin/env node
/**
 * SNS 키트 굽기 — 원고 HTML 한 벌의 장(.k-slide)을 SNS 규격 그림으로 굽고, 조잡해지는 것을 검사한다.
 * 원문: docs/디자인/SNS키트/README.md (2026-10-01)
 *
 * 쓰는 법:
 *   node tools/SNS키트굽기.js <원고.html> [--out 폴더] [--webp] [--45] [--pdf] [--sheet] [--force]
 *     --out    결과 폴더(기본: 원고 옆 out/)
 *     --webp   PNG 대신 webp(품질 92)로 굽는다. 저장소에 남기는 견본용. 올릴 파일은 PNG.
 *     --45     3:4(feed34) 장을 4:5(1080×1350)로도 잘라 굽는다. 예약 도구·API는 4:5까지만 받는다.
 *     --pdf    링크드인 문서용 PDF를 만든다(doc45 장, 없으면 feed34의 4:5 자른 판).
 *     --sheet  모든 장을 한 장에 모은 확인용 시트(_시트.png)를 만든다.
 *     --force  검사에서 걸려도 굽는다(종료 코드는 그대로 1).
 *
 * 원고 쓰는 법: README §5. 장마다 <section class="k-slide k-paper|k-field" data-fmt="feed34" data-acc="brief" data-name="표지">.
 * 장식에는 data-deco, 유행 장치에는 data-trend를 단다. 이 표시를 세서 검사한다.
 *
 * 검사(장마다):
 *   장식(data-deco) 3개 이하 · 유행 장치(data-trend) 1개 이하 · 제목 하나에 형광펜(.k-mark) 1곳 이하 ·
 *   보이는 글자 최소 크기(폭 1080 기준 24px, 썸네일 44px) · 안전영역 밖 글자 없음 · 넘친 글자 없음 ·
 *   서체 셋(SUIT·Inter Tight·DM Mono 중 쓴 것) 실제 로드 · 깨진 그림 없음.
 *   주의(실패는 아님): 흰 종이 장의 본문이 상자 높이의 70%를 못 채우면 '아래가 비어 있음'.
 *   통과는 '규칙을 지켰다'는 뜻이지 '좋은 디자인'이라는 뜻이 아니다. 굽고 나면 사람 눈으로 본다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const 원고 = args.find((a) => !a.startsWith('--') && a !== opt('--out'));
if (!원고) { console.error('쓰는 법: node tools/SNS키트굽기.js <원고.html> [--out 폴더] [--webp] [--45] [--pdf] [--sheet]'); process.exit(2); }
const 원고경로 = path.resolve(원고);
if (!fs.existsSync(원고경로)) { console.error('원고가 없다:', 원고경로); process.exit(2); }
const 출력 = path.resolve(opt('--out') || path.join(path.dirname(원고경로), 'out'));
const 확장 = flag('--webp') ? 'webp' : 'png';

function 크롬경로() {
  const 후보 = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    .filter((p) => p && fs.existsSync(p));
  if (!후보[0]) throw new Error('크롬을 못 찾았다. CHROME_PATH로 지정한다.');
  return 후보[0];
}

/* ── 크롬 개발자 도구 연결(CDP) ── 외부 패키지 없이 Node 내장 WebSocket으로 */
async function 크롬열기() {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sns키트-'));
  const 프로세스 = spawn(크롬경로(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--remote-debugging-port=0', `--user-data-dir=${방}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  const 포트파일 = path.join(방, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !fs.existsSync(포트파일); i++) await new Promise((r) => setTimeout(r, 50));
  if (!fs.existsSync(포트파일)) throw new Error('크롬 디버깅 포트를 못 열었다.');
  const [포트, 경로] = fs.readFileSync(포트파일, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${포트}${경로}`);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const 대기 = new Map(); const 듣기 = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && 대기.has(m.id)) { const { ok, no } = 대기.get(m.id); 대기.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
    else if (m.method) 듣기.forEach((f) => f(m));
  };
  const 보내기 = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const n = ++id; 대기.set(n, { ok, no }); ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  const { targetId } = await 보내기('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await 보내기('Target.attachToTarget', { targetId, flatten: true });
  const 쪽 = (method, params) => 보내기(method, params, sessionId);
  const 기다리기 = (method) => new Promise((ok) => { const f = (m) => { if (m.method === method && m.sessionId === sessionId) { 듣기.splice(듣기.indexOf(f), 1); ok(m.params); } }; 듣기.push(f); });
  await 쪽('Page.enable'); await 쪽('Runtime.enable');
  const 닫기 = async () => { try { await 보내기('Browser.close'); } catch { /* 이미 닫혔다 */ } ws.close(); 프로세스.kill(); setTimeout(() => { try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 남아도 해가 없다 */ } }, 500); };
  return { 쪽, 기다리기, 닫기 };
}

async function 평가(쪽, 식) {
  const r = await 쪽('Runtime.evaluate', { expression: 식, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('페이지 오류: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

/* 페이지 안에서 도는 검사. 장마다 결과를 돌려준다 */
const 검사식 = `(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const 로드된서체 = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')))];
  const 결과 = [];
  const slides = [...document.querySelectorAll('.k-slide, .kv-frame')];
  slides.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    const cs = getComputedStyle(s);
    const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    const safe = { t: px('--safe-t'), b: px('--safe-b'), l: px('--safe-l'), r: px('--safe-r') };
    const fmt = s.dataset.fmt || (s.classList.contains('kv-frame') ? 'video916' : '?');
    const 문제 = [];
    const deco = s.querySelectorAll('[data-deco]').length;
    if (deco > 3) 문제.push('장식 ' + deco + '개(3개까지)');
    const trend = [...s.querySelectorAll('[data-trend]')].map(e => e.dataset.trend);
    if (trend.length > 1) 문제.push('유행 장치 ' + trend.length + '개(' + trend.join('·') + ', 한 장에 하나)');
    s.querySelectorAll('.k-title, .k-quote, .kv-hook, .k-sub').forEach(t => { const n = t.querySelectorAll('.k-mark').length; if (n > 1) 문제.push('형광펜 ' + n + '곳: ' + t.textContent.trim().slice(0, 20)); });
    const 최소 = r.width >= 1900 ? 44 : (r.width >= 1150 && r.height < 700 ? 22 : 24);
    const 글자요소 = [...s.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    const 작은글자 = new Set(); const 밖 = new Set(); const 넘침 = new Set();
    글자요소.forEach(e => {
      const st = getComputedStyle(e);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) return;
      const fs = parseFloat(st.fontSize);
      const 글 = e.textContent.trim().slice(0, 24);
      if (fs < 최소) 작은글자.add(글 + '(' + fs + 'px)');
      const range = document.createRange(); range.selectNodeContents(e);
      for (const b of range.getClientRects()) {
        if (b.width < 1 || b.height < 1) continue;
        if (e.closest('[data-safe-skip]')) continue;
        if (b.left < r.left + safe.l - 1 || b.right > r.right - safe.r + 1 || b.top < r.top + safe.t - 1 || b.bottom > r.bottom - safe.b + 1) { 밖.add(글); break; }
      }
      if (e.scrollWidth > e.clientWidth + 2 && st.overflow !== 'visible' && st.display !== 'inline') 넘침.add(글);
    });
    s.querySelectorAll('.k-in').forEach(box => {
      const br = box.getBoundingClientRect();
      [...box.children].forEach(c => { const cr = c.getBoundingClientRect(); if (cr.bottom > br.bottom + 2 && getComputedStyle(c).position !== 'absolute') 넘침.add('본문 상자 아래로 ' + Math.round(cr.bottom - br.bottom) + 'px: ' + c.textContent.trim().slice(0, 20)); });
    });
    // 빈 공간(경고): 흰 종이 장에서 본문이 상자 높이의 70%도 못 채우면 허전하다. 실패는 아니고 알림이다
    const 주의 = [];
    s.querySelectorAll('.k-in').forEach(box => {
      if (!s.classList.contains('k-paper')) return;
      const br = box.getBoundingClientRect();
      const 끝 = Math.max(...[...box.children].filter(c => getComputedStyle(c).position !== 'absolute' && !c.classList.contains('k-grow')).map(c => c.getBoundingClientRect().bottom), br.top);
      const 그림끝 = Math.max(...[...s.querySelectorAll('.k-sticker,.k-object,.k-arch,.k-photo')].map(e => e.getBoundingClientRect().bottom), 0);
      const 채움 = (Math.max(끝, 그림끝) - br.top) / br.height;
      if (채움 < 0.7) 주의.push('아래가 ' + Math.round((1 - 채움) * 100) + '% 비어 있음');
    });
    if (작은글자.size) 문제.push('작은 글자(' + 최소 + 'px 미만): ' + [...작은글자].slice(0, 4).join(', '));
    if (밖.size) 문제.push('안전영역 밖 글자: ' + [...밖].slice(0, 4).join(', '));
    if (넘침.size) 문제.push('넘침: ' + [...넘침].slice(0, 4).join(', '));
    const 깨진그림 = [...s.querySelectorAll('img')].filter(im => !im.naturalWidth).map(im => im.getAttribute('src'));
    if (깨진그림.length) 문제.push('깨진 그림: ' + 깨진그림.join(', '));
    const 쓴서체 = new Set(글자요소.map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()));
    const 안된서체 = [...쓴서체].filter(f => !로드된서체.includes(f) && !/system-ui|sans-serif|monospace/.test(f));
    if (안된서체.length) 문제.push('로드 안 된 서체: ' + 안된서체.join(', '));
    결과.push({ i: i + 1, name: s.dataset.name || '', fmt, acc: s.closest('[data-acc]')?.dataset.acc || '', x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, deco, trend, 문제, 주의 });
  });
  return { 로드된서체, 결과 };
})()`;

async function main() {
  fs.mkdirSync(출력, { recursive: true });
  const { 쪽, 기다리기, 닫기 } = await 크롬열기();
  let 실패 = false;
  try {
    await 쪽('Emulation.setDeviceMetricsOverride', { width: 2200, height: 2000, deviceScaleFactor: 1, mobile: false });
    const 로드 = 기다리기('Page.loadEventFired');
    await 쪽('Page.navigate', { url: pathToFileURL(원고경로).href });
    await 로드;
    const { 로드된서체, 결과 } = await 평가(쪽, 검사식);
    if (!결과.length) throw new Error('.k-slide가 없다.');
    console.log(`■ ${path.relative(process.cwd(), 원고경로)} — ${결과.length}장 · 서체 ${로드된서체.join(', ') || '없음'}`);
    const 만든것 = [];
    for (const s of 결과) {
      const 이름 = `${String(s.i).padStart(2, '0')}_${s.fmt}${s.name ? '_' + s.name.replace(/[\\/:*?"<>|\s]+/g, '-') : ''}`;
      const 찍기 = async (clip, 파일) => {
        const r = await 쪽('Page.captureScreenshot', { format: 확장, quality: 확장 === 'webp' ? 92 : undefined, clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
        fs.writeFileSync(파일, Buffer.from(r.data, 'base64'));
        만든것.push({ 파일, w: clip.width, h: clip.height });
      };
      await 찍기({ x: s.x, y: s.y, width: s.w, height: s.h }, path.join(출력, `${이름}.${확장}`));
      if (flag('--45') && s.fmt === 'feed34') await 찍기({ x: s.x, y: s.y + 45, width: s.w, height: s.h - 90 }, path.join(출력, `${이름}_4x5.${확장}`));
      const 표 = (s.문제.length ? '✗ ' + s.문제.join(' / ') : '✓') + (s.주의.length ? '  (주의: ' + s.주의.join(' / ') + ')' : '');
      if (s.문제.length) 실패 = true;
      console.log(`  ${String(s.i).padStart(2, '0')} ${s.fmt.padEnd(9)} ${(s.acc || '-').padEnd(7)} ${(s.name || '').padEnd(10)} 장식 ${s.deco} · 장치 ${s.trend.length}  ${표}`);
    }
    fs.writeFileSync(path.join(출력, '검사.json'), JSON.stringify({ 원고: path.relative(process.cwd(), 원고경로), 시각: new Date().toISOString(), 로드된서체, 결과 }, null, 1));

    if (flag('--sheet')) {
      const 그림 = 만든것.filter((m) => !/_4x5\./.test(m.파일));
      const 폭 = 300;
      const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#e9eaee;font:14px sans-serif}.g{display:flex;flex-wrap:wrap;gap:14px;padding:18px;align-items:flex-start;width:${(폭 + 14) * 5 + 22}px}figure{margin:0;width:${폭}px}img{width:100%;display:block;box-shadow:0 1px 6px rgba(0,0,0,.25)}figcaption{padding:4px 2px;color:#444}</style><div class=g>${그림.map((m) => `<figure><img src="${pathToFileURL(m.파일).href}"><figcaption>${path.basename(m.파일)}</figcaption></figure>`).join('')}</div>`;
      const 시트원고 = path.join(출력, '_시트.html');
      fs.writeFileSync(시트원고, html);
      const l = 기다리기('Page.loadEventFired');
      await 쪽('Page.navigate', { url: pathToFileURL(시트원고).href });
      await l;
      const 크기 = await 평가(쪽, `(async()=>{await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));const g=document.querySelector('.g').getBoundingClientRect();return {w:g.width,h:g.height}})()`);
      const r = await 쪽('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 크기.w, height: 크기.h, scale: 1 }, captureBeyondViewport: true });
      fs.writeFileSync(path.join(출력, '_시트.png'), Buffer.from(r.data, 'base64'));
      fs.rmSync(시트원고);
      console.log('  시트', path.relative(process.cwd(), path.join(출력, '_시트.png')));
    }

    if (flag('--pdf')) {
      const 문서 = 결과.some((s) => s.fmt === 'doc45') ? 만든것.filter((m) => m.h === 1350 && !/_4x5\./.test(m.파일))
        : 만든것.filter((m) => /_4x5\./.test(m.파일));
      if (!문서.length) console.log('  PDF: doc45 장이나 --45 판이 없어 건너뜀');
      else {
        const html = `<!doctype html><meta charset=utf-8><style>@page{size:1080px 1350px;margin:0}body{margin:0}img{display:block;width:1080px;height:1350px;page-break-after:always}</style>${문서.map((m) => `<img src="${pathToFileURL(m.파일).href}">`).join('')}`;
        const 문서원고 = path.join(출력, '_문서.html');
        fs.writeFileSync(문서원고, html);
        const l = 기다리기('Page.loadEventFired');
        await 쪽('Page.navigate', { url: pathToFileURL(문서원고).href });
        await l;
        await 평가(쪽, `Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})))`);
        const r = await 쪽('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
        fs.writeFileSync(path.join(출력, '링크드인_문서.pdf'), Buffer.from(r.data, 'base64'));
        fs.rmSync(문서원고);
        console.log(`  PDF ${문서.length}쪽`, path.relative(process.cwd(), path.join(출력, '링크드인_문서.pdf')));
      }
    }
  } finally { await 닫기(); }
  if (실패) { console.log('검사에 걸린 장이 있다(위 ✗). 고치거나, 의도라면 README §6의 예외를 적는다.'); process.exitCode = 1; }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
