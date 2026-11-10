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
 *
 * ■ 🔴 모든 기다림에 끝이 있다 (2026-11-10)
 *   띄우기 · 지면 통로 찾기 · 통로 열기 · 부름(보냄) · 사건 기다림 모두 시간 한도를 넘거나 통로가 닫히면 **깨진다**.
 *   그리고 깨질 때 띄운 크롬을 **반드시 끈다** — 11-10 전체 시험(`tools/test-ci.js`)이 글자검사에서 5시간 넘게 멈췄는데,
 *   크롬이 조종 통로를 안 열어 20초 뒤 깨진 다음에도 그 크롬이 살아 남아 stderr 통로를 붙잡았고,
 *   그래서 시험 파일 프로세스가 끝나지 못했다(시험 본문은 20초에 실패로 끝나 있었다).
 *   크롬이 통로를 안 연 까닭은 CI 모사가 바꾼 USERPROFILE이었다 — 아래 `크롬환경`.
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

/**
 * 크롬에게 줄 환경 — 윈도우에서는 USERPROFILE만 **로그인한 계정의 실제 폴더**로 돌려 둔다.
 *
 * 🔴 왜 (2026-11-10 실측 · 크롬 157): CI 모사(`tools/lib/ci모사환경.js`)는 HOME · USERPROFILE을 빈 폴더로 바꾼다.
 *   그 USERPROFILE을 받은 크롬은 `--user-data-dir`을 줬는데도
 *   「DevTools remote debugging requires a non-default data directory」를 찍고 조종 통로를 **열지 않는다**
 *   (HOME · TZ · CI만 바꾸면 연다 — 하나씩 갈라 쟀다). 그래서 `test-ci`에서만 크롬 시험이 깨졌다.
 *   크롬은 시험 대상이 아니라 도구이고 자기 프로필(`--user-data-dir`, 임시 폴더)만 쓴다. CI 모사가 홈을 지우는 까닭
 *   (우리 코드가 메모리 정본 · 자격증명을 못 읽게)과 무관하고, 진짜 CI(리눅스)는 홈이 원래 실제다 — 이렇게 둬야 그와 같다.
 *   `os.userInfo().homedir`은 환경 변수가 아니라 로그인 토큰에서 읽어 CI 모사가 못 바꾼다(`os.homedir()`은 바뀐 값을 준다).
 */
function 크롬환경(env = process.env) {
  if (process.platform !== 'win32') return env;
  let 실제 = '';
  try { 실제 = os.userInfo().homedir; } catch { return env; }
  if (!실제 || env.USERPROFILE === 실제) return env;
  return { ...env, USERPROFILE: 실제 };
}

/** 한도 글 — 「20초」 · 1초 아래는 「400ms」 */
const 초글 = (ms) => (ms >= 1000 ? `${Math.round(ms / 1000)}초` : `${ms}ms`);

/**
 * 크롬을 띄우고 «브라우저 층» 주소를 받는다 — 크롬이 stderr 로 한 줄 알려 준다.
 * 못 받으면(한도 넘김 · 먼저 끝남 · 못 띄움) 띄운 크롬을 **끄고** 깨진다 — 크롬이 남으면 부른 프로세스가 끝나지 못한다.
 * 깨질 때 크롬이 stderr에 남긴 끝 줄을 붙인다(11-10: 그 한 줄이 원인이었는데 옛 판은 버렸다).
 */
function 크롬띄우기(프로필, { 기다림ms = 20000 } = {}) {
  const 아이 = spawn(크롬찾기(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--remote-debugging-port=0',
    `--user-data-dir=${프로필}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, env: 크롬환경() });

  return new Promise((맞다, 아니다) => {
    let 쌓임 = '';
    let 끝 = false;
    const 크롬말 = () => {
      const 줄 = 쌓임.trim().split('\n').map((s) => s.trim()).filter(Boolean).slice(-3).join(' / ');
      return 줄 ? ` — 크롬이 남긴 말: ${줄.slice(-400)}` : '';
    };
    const 실패 = (e) => {
      if (끝) return;
      끝 = true;
      clearTimeout(늦음);
      try { 아이.kill(); } catch { /* 이미 끝났다 */ }
      아니다(e);
    };
    const 늦음 = setTimeout(() => 실패(new Error(`크롬이 조종 통로를 ${초글(기다림ms)} 안에 안 열었다${크롬말()}`)), 기다림ms);
    아이.stderr.on('data', (d) => {
      if (끝) return; // 주소를 받은 뒤의 말은 모으지 않는다(오래 쓰는 지면에서 끝없이 쌓인다)
      쌓임 = (쌓임 + d.toString()).slice(-8000);
      /* 공백 없는 찍히는 글자만 — 역슬래시를 안 쓰려고 이 꼴로 적는다.
       *   뒤에 찍히지 않는 글자(줄바꿈)가 와야 받는다 — stderr 조각이 주소 가운데서 끊기면 덜 받은 주소에 붙지 않게. */
      const m = 쌓임.match(/ws:[/][/][!-~]+(?=[^!-~])/);
      if (m) { 끝 = true; clearTimeout(늦음); 맞다({ 아이, 브라우저주소: m[0] }); }
    });
    아이.on('error', (e) => 실패(new Error(`크롬을 못 띄웠다: ${e.message}`)));
    아이.on('exit', (c) => 실패(new Error(`크롬이 먼저 끝났다 (rc=${c})${크롬말()}`)));
  });
}

/**
 * 브라우저 층 주소로는 지면 명령(Page.*)이 안 통한다 — 지면 층 통로를 따로 물어봐야 한다
 * (09-03 실측: 「'Page.enable' wasn't found」). 물음 하나도 전체도 한도가 있다(답 없는 fetch 를 끝없이 기다리지 않는다).
 */
async function 지면통로찾기(브라우저주소, { 기다림ms = 15000 } = {}) {
  const 항 = new URL(브라우저주소);
  const 끝 = Date.now() + 기다림ms;
  while (Date.now() < 끝) {
    try {
      const 목록 = await fetch(`http://127.0.0.1:${항.port}/json/list`, { signal: AbortSignal.timeout(Math.max(500, Math.min(3000, 끝 - Date.now()))) })
        .then((r) => r.json());
      const 지면 = 목록.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (지면) return 지면.webSocketDebuggerUrl;
    } catch { /* 아직 안 떴다 · 답이 늦다 — 잠깐 뒤 다시 묻는다 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`크롬에 «지면» 통로가 ${초글(기다림ms)} 안에 안 보인다 (탭이 안 열렸다)`);
}

/**
 * 조종 통로 한 벌 — 보내고, 답을 기다리고, 사건 하나를 기다린다.
 * 열림 · 보냄 · 사건은 `기다림ms`(부를 때 따로 줄 수 있다)를 넘기거나 통로가 닫히면 깨진다 — 크롬이 죽거나 멎어도 끝없이 기다리지 않는다.
 */
function 통로(주소, { 기다림ms = 120000 } = {}) {
  const ws = new WebSocket(주소);
  let 번호 = 0;
  let 끊김 = null;
  const 기다리는것 = new Map(); // id → { 맞다, 아니다, 시계 }
  const 사건듣기 = new Map();   // 사건 이름 → { 맞다, 아니다, 시계 }
  const 모두거절 = (e) => {
    for (const w of [...기다리는것.values(), ...사건듣기.values()]) { clearTimeout(w.시계); w.아니다(e); }
    기다리는것.clear(); 사건듣기.clear();
  };
  ws.addEventListener('message', (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.id && 기다리는것.has(m.id)) {
      const { 맞다, 아니다, 시계 } = 기다리는것.get(m.id);
      기다리는것.delete(m.id);
      clearTimeout(시계);
      m.error ? 아니다(new Error(`${m.error.message} (${JSON.stringify(m.error.data || '')})`)) : 맞다(m.result);
    } else if (m.method && 사건듣기.has(m.method)) {
      const { 맞다, 시계 } = 사건듣기.get(m.method);
      사건듣기.delete(m.method);
      clearTimeout(시계);
      맞다(m.params);
    }
  });
  ws.addEventListener('close', () => {
    끊김 = 끊김 || new Error('조종 통로가 닫혔다 (크롬이 끝났거나 끊겼다)');
    모두거절(끊김);
  });
  const 열림 = new Promise((r, j) => {
    const 시계 = setTimeout(() => j(new Error(`조종 통로가 ${초글(기다림ms)} 안에 안 열렸다`)), 기다림ms);
    ws.addEventListener('open', () => { clearTimeout(시계); r(); });
    ws.addEventListener('error', () => { clearTimeout(시계); j(new Error('조종 통로가 안 열렸다')); });
  });
  열림.catch(() => {}); // 기다리는 쪽이 없을 때 처리 안 된 거절로 프로세스가 죽지 않게 — 기다리는 쪽은 그대로 깨진다
  return {
    열림,
    보냄: (method, params = {}, 한도ms = 기다림ms) => {
      if (끊김) return Promise.reject(끊김);
      return new Promise((맞다, 아니다) => {
        const id = ++번호;
        const 시계 = setTimeout(() => { 기다리는것.delete(id); 아니다(new Error(`${method}가 ${초글(한도ms)} 안에 답하지 않았다`)); }, 한도ms);
        기다리는것.set(id, { 맞다, 아니다, 시계 });
        try { ws.send(JSON.stringify({ id, method, params })); } catch (e) { clearTimeout(시계); 기다리는것.delete(id); 아니다(e); }
      });
    },
    /** 사건 하나를 기다린다. 먼저 걸어 두고 나중에 await 하는 일이 많아, 처리 안 된 거절로 죽지 않게 빈 catch 를 달아 돌려준다. */
    사건: (name, 한도ms = 기다림ms) => {
      if (끊김) return Promise.reject(끊김);
      const 약속 = new Promise((맞다, 아니다) => {
        const 시계 = setTimeout(() => { 사건듣기.delete(name); 아니다(new Error(`${name}이 ${초글(한도ms)} 안에 안 왔다`)); }, 한도ms);
        사건듣기.set(name, { 맞다, 아니다, 시계 });
      });
      약속.catch(() => {});
      return 약속;
    },
    닫기: () => {
      끊김 = 끊김 || new Error('조종 통로를 닫았다');
      모두거절(끊김);
      try { ws.close(); } catch { /* 이미 닫혔다 */ }
    },
  };
}

/**
 * 지면 하나를 열고 «다 됐다»까지 기다린다. 쓰고 나면 반드시 닫기() 를 부른다.
 * ⚠ 못 기다리면 **깨진다** — 반쪽 상태를 결과로 내놓지 않는다. 깨질 때는 띄운 크롬까지 끄고 깨진다.
 * 부름초 = 조종 통로 부름 하나 · 사건 하나의 한도(인쇄처럼 오래 걸리는 부름은 c.보냄(…, …, ms)으로 따로 준다).
 */
async function 지면열기(html, { 기다림 = null, 최대초 = 90, 부름초 = 120 } = {}) {
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-크롬-'));
  let 아이 = null;
  let c = null;
  let 닫힘 = false;
  const 닫기 = () => {
    if (닫힘) return;
    닫힘 = true;
    if (c) c.닫기();
    if (아이) { try { 아이.kill(); } catch { /* 이미 끝났다 */ } }
    try { fs.rmSync(프로필, { recursive: true, force: true }); } catch { /* 청소 실패는 본 일과 무관 */ }
  };
  try {
    const 띄움 = await 크롬띄우기(프로필); // 못 띄우면 크롬은 거기서 이미 꺼졌다
    아이 = 띄움.아이;
    c = 통로(await 지면통로찾기(띄움.브라우저주소), { 기다림ms: 부름초 * 1000 });
    await c.열림;
    await c.보냄('Page.enable');
    const 실림 = c.사건('Page.loadEventFired');
    const 감 = await c.보냄('Page.navigate', { url: require('node:url').pathToFileURL(path.resolve(html)).href });
    if (감 && 감.errorText) throw new Error(`지면을 못 열었다 (${감.errorText}) — ${html}`);
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

module.exports = { 크롬찾기, 크롬환경, 크롬띄우기, 지면통로찾기, 통로, 지면열기 };
