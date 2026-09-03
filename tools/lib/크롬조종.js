'use strict';
/**
 * 크롬조종 — 크롬을 «조종 통로»(DevTools 규약)로 몰아, 물어보고 답을 기다리는 최소한.
 *
 * ■ 왜 한 곳인가 (2026-09-03)
 *   인쇄(`tools/지면인쇄.js`)와 접근성 검사(`tools/접근성검사.js`)가 같은 일을 한다 —
 *   크롬을 띄우고, 지면 통로를 찾고, 물음이 참이 될 때까지 기다린다.
 *   두 곳에 적으면 갈린다. 그래서 여기 하나가 임자다.
 *
 * ■ 딸린 프로그램 0 — 노드 24 에 웹소켓과 fetch 가 들어 있어 남의 꾸러미가 필요 없다.
 * ■ ⚠ 경로는 «슬래시»로 적는다 — 역슬래시는 셸·따옴표를 지나며 조용히 사라진다(09-03 실측).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const 크롬후보 = [
  process.env.SYNK_CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

const 크롬찾기 = () => {
  const c = 크롬후보.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (!c) throw new Error('크롬을 못 찾았다 (SYNK_CHROME 으로 경로를 줄 수 있다)');
  return c;
};

/** 크롬을 띄우고 «브라우저 층» 주소를 받는다 — 크롬이 stderr 로 한 줄 알려 준다. */
function 크롬띄우기(프로필) {
  const 아이 = spawn(크롬찾기(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--remote-debugging-port=0',
    `--user-data-dir=${프로필}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  return new Promise((맞다, 아니다) => {
    let 쌓임 = '';
    const 늦음 = setTimeout(() => 아니다(new Error('크롬이 조종 통로를 20초 안에 안 열었다')), 20000);
    아이.stderr.on('data', (d) => {
      쌓임 += d.toString();
      /* 공백 없는 찍히는 글자만 — 역슬래시를 안 쓰려고 이 꼴로 적는다 */
      const m = 쌓임.match(/ws:[/][/][!-~]+/);
      if (m) { clearTimeout(늦음); 맞다({ 아이, 브라우저주소: m[0] }); }
    });
    아이.on('exit', (c) => { clearTimeout(늦음); 아니다(new Error(`크롬이 먼저 끝났다 (rc=${c})\n${쌓임.slice(-400)}`)); });
  });
}

/**
 * 브라우저 층 주소로는 지면 명령(Page.*)이 안 통한다 — 지면 층 통로를 따로 물어봐야 한다
 * (09-03 실측: 「'Page.enable' wasn't found」).
 */
async function 지면통로찾기(브라우저주소) {
  const 항 = new URL(브라우저주소);
  for (let i = 0; i < 60; i += 1) {
    try {
      const 목록 = await fetch(`http://127.0.0.1:${항.port}/json/list`).then((r) => r.json());
      const 지면 = 목록.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (지면) return 지면.webSocketDebuggerUrl;
    } catch { /* 아직 안 떴다 — 잠깐 뒤 다시 묻는다 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('크롬에 «지면» 통로가 안 보인다 (탭이 안 열렸다)');
}

/** 조종 통로 한 벌 — 보내고, 답을 기다리고, 사건 하나를 기다린다. */
function 통로(주소) {
  const ws = new WebSocket(주소);
  let 번호 = 0;
  const 기다리는것 = new Map();
  const 사건듣기 = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && 기다리는것.has(m.id)) {
      const { 맞다, 아니다 } = 기다리는것.get(m.id);
      기다리는것.delete(m.id);
      m.error ? 아니다(new Error(`${m.error.message} (${JSON.stringify(m.error.data || '')})`)) : 맞다(m.result);
    } else if (m.method && 사건듣기.has(m.method)) {
      사건듣기.get(m.method)();
      사건듣기.delete(m.method);
    }
  });
  return {
    열림: new Promise((r, j) => {
      ws.addEventListener('open', r);
      ws.addEventListener('error', () => j(new Error('조종 통로가 안 열렸다')));
    }),
    보냄: (method, params = {}) => new Promise((맞다, 아니다) => {
      const id = ++번호;
      기다리는것.set(id, { 맞다, 아니다 });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    사건: (name) => new Promise((r) => 사건듣기.set(name, r)),
    닫기: () => ws.close(),
  };
}

/**
 * 지면 하나를 열고 «다 됐다»까지 기다린다. 쓰고 나면 반드시 닫기() 를 부른다.
 * ⚠ 못 기다리면 **깨진다** — 반쪽 상태를 결과로 내놓지 않는다.
 */
async function 지면열기(html, { 기다림 = null, 최대초 = 90 } = {}) {
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-크롬-'));
  const { 아이, 브라우저주소 } = await 크롬띄우기(프로필);
  const c = 통로(await 지면통로찾기(브라우저주소));
  const 닫기 = () => {
    c.닫기(); 아이.kill();
    try { fs.rmSync(프로필, { recursive: true, force: true }); } catch { /* 청소 실패는 본 일과 무관 */ }
  };
  try {
    await c.열림;
    await c.보냄('Page.enable');
    const 실림 = c.사건('Page.loadEventFired');
    await c.보냄('Page.navigate', { url: require('node:url').pathToFileURL(path.resolve(html)).href });
    await 실림;

    /* 🔴 `load` 는 **활자가 앉기 전**이다. 심은 활자로 다시 짜이면 줄이 접히는 자리가 달라지고,
     *   그 전에 찍으면 «폴백 활자로 조판된 판»이 결과가 된다. 새는 방향은 언제나 「통과」다.
     *   같은 교훈을 tools/발표물린트.js 의 넘침 검사가 먼저 적었다(2026-08-10 · 18px 가 튀었다).
     *   여기서는 그 기다림을 «모든 부름»에 깐다 — 인쇄든 검사든 활자가 앉은 판을 본다.
     *   ⚠ 프레임(requestAnimationFrame)이 아니라 setTimeout 으로 한 턴 넘긴다(재배치를 앉힌다). */
    await c.보냄('Runtime.evaluate', {
      expression: '(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())'
        + '.then(() => new Promise((r) => setTimeout(() => r(true), 0)))',
      awaitPromise: true, returnByValue: true,
    });
    let 걸린초 = 0;
    if (기다림) {
      const 시작 = Date.now(); const 끝 = 시작 + 최대초 * 1000;
      for (;;) {
        const r = await c.보냄('Runtime.evaluate', { expression: 기다림, returnByValue: true });
        if (r.result && r.result.value === true) break;
        if (Date.now() > 끝) {
          throw new Error(`${최대초}초 안에 「다 됐다」가 안 왔다 — 물음: ${기다림}\n`
            + '   덜 된 지면을 결과로 쓰면 조용히 틀린다. 그래서 통과시키지 않는다.');
        }
        await new Promise((r2) => setTimeout(r2, 120));
      }
      걸린초 = (Date.now() - 시작) / 1000;
    }
    return { c, 닫기, 걸린초 };
  } catch (e) { 닫기(); throw e; }
}

module.exports = { 크롬찾기, 크롬띄우기, 지면통로찾기, 통로, 지면열기 };
