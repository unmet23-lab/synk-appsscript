#!/usr/bin/env node
'use strict';
/**
 * 지면인쇄 — HTML 한 장을 PDF 로 뽑되, **「다 됐다」를 물어보고** 뽑는다.
 *
 * ■ 왜 있나 (2026-09-03 · 유호 지시 「쪽번호 도구를 우리 지면에 붙여라」)
 *   지금까지는 크롬에 `--virtual-time-budget=8000`(8초어치 기다린다)을 주고 인쇄했다.
 *   그건 «기다림»이 아니라 «추측»이다. 조판이 안 끝나도 크롬은 그 시점까지의 지면을
 *   멀쩡한 PDF 로 뱉는다.
 *
 * ■ 🔴 그게 조용히 틀린 실측 (09-03 · 몽골어 번역 작업본 7쪽)
 *     기다림 40초어치  → 1쪽      기다림 120초어치 → 2쪽      기다림 400초어치 → 3쪽
 *   셋 다 «열리는» PDF 다. 쪽이 사라진 것을 아무 검사도 안 문다.
 *   ⇒ 시간으로 기다리면 문서가 길어질수록 조용히 잘린다. 그래서 **신호로** 기다린다.
 *
 * ■ 어떻게 — 크롬을 «조종 통로»(DevTools 규약)로 몰아, 우리가 준 물음이 참이 될 때까지 기다린다.
 *   딸린 프로그램 0: 노드 24 에 웹소켓이 들어 있어 남의 꾸러미가 필요 없다.
 * ■ ⚠ 못 기다리면 **깨진다**. 시간이 다 되면 실패로 낸다 — 반쪽 PDF 를 내놓지 않는다.
 *
 * 쓰는 법:
 *   node tools/지면인쇄.js <html> <pdf>
 *   node tools/지면인쇄.js <html> <pdf> --기다림 "window.__SYNK_PAGED_DONE===true" --최대초 90
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const 크롬후보 = [
  process.env.SYNK_CHROME,
  /* 윈도 경로도 «슬래시»로 적는다 — 역슬래시는 셸·따옴표를 지나며 조용히 사라진다(09-03 실측). */
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

const 크롬찾기 = () => {
  const c = 크롬후보.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (!c) throw new Error('크롬을 못 찾았다 (SYNK_CHROME 으로 경로를 줄 수 있다)');
  return c;
};

/** 크롬을 띄우고 조종 통로 주소를 받는다 — 주소는 크롬이 stderr 로 한 줄 알려 준다. */
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
      const m = 쌓임.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(늦음); 맞다({ 아이, 브라우저주소: m[0] }); }
    });
    아이.on('exit', (c) => { clearTimeout(늦음); 아니다(new Error(`크롬이 먼저 끝났다 (rc=${c})\n${쌓임.slice(-400)}`)); });
  });
}

/** 조종 통로 한 벌 — 물어보고 답을 기다리는 최소한만 싼다. */
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
 * 크롬이 stderr 로 알려 주는 주소는 «브라우저 층»이라 지면 명령(Page.*)이 안 통한다.
 * 지면 층 통로는 따로 물어봐야 한다 — 크롬이 목록을 HTTP 로 준다(09-03 실측: Page.enable 없음 오류).
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


async function 인쇄(html, pdf, { 기다림 = null, 최대초 = 90 } = {}) {
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-인쇄-'));
  const { 아이, 브라우저주소 } = await 크롬띄우기(프로필);
  const c = 통로(await 지면통로찾기(브라우저주소));
  try {
    await c.열림;
    await c.보냄('Page.enable');
    const 실림 = c.사건('Page.loadEventFired');
    await c.보냄('Page.navigate', { url: pathToFileURL(path.resolve(html)).href });
    await 실림;

    let 잰것 = { 물음: 기다림, 걸린초: 0 };
    if (기다림) {
      const 끝 = Date.now() + 최대초 * 1000;
      const 시작 = Date.now();
      for (;;) {
        const r = await c.보냄('Runtime.evaluate', { expression: 기다림, returnByValue: true });
        if (r.result && r.result.value === true) break;
        if (Date.now() > 끝) {
          /* 🔴 여기서 «그냥 인쇄»하면 반쪽 PDF 가 정상 얼굴로 나간다. 깨는 것이 맞다. */
          throw new Error(`${최대초}초 안에 「다 됐다」가 안 왔다 — 물음: ${기다림}\n`
            + '   조판이 안 끝난 채 인쇄하면 쪽이 조용히 사라진다. 그래서 통과시키지 않는다.');
        }
        await new Promise((r2) => setTimeout(r2, 120));
      }
      잰것.걸린초 = (Date.now() - 시작) / 1000;
    }

    const { data } = await c.보냄('Page.printToPDF', {
      printBackground: true,      // 배경 색·면이 빠지면 우리 인쇄물은 흰 종이가 된다
      preferCSSPageSize: true,    // @page 의 용지 선언을 크롬 기본값보다 앞세운다
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    });
    fs.mkdirSync(path.dirname(path.resolve(pdf)), { recursive: true });
    fs.writeFileSync(pdf, Buffer.from(data, 'base64'));
    return { pdf, KB: Math.round(fs.statSync(pdf).size / 1024), ...잰것 };
  } finally {
    c.닫기();
    아이.kill();
    try { fs.rmSync(프로필, { recursive: true, force: true }); } catch { /* 프로필 청소 실패는 인쇄와 무관하다 */ }
  }
}

async function 본다(argv) {
  const 값 = (이름, 기본) => {
    const i = argv.indexOf(이름);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : 기본;
  };
  const 남은 = argv.filter((a, i) => !a.startsWith('--') && !['--기다림', '--최대초'].includes(argv[i - 1]));
  if (남은.length !== 2) {
    console.error('용법: node tools/지면인쇄.js <html> <pdf> [--기다림 "<표현식>"] [--최대초 90]');
    return 2;
  }
  const r = await 인쇄(남은[0], 남은[1], { 기다림: 값('--기다림', null), 최대초: Number(값('--최대초', 90)) });
  console.log(`✅ ${r.pdf}  (${r.KB} KB${r.물음 ? ` · 「다 됐다」까지 ${r.걸린초.toFixed(1)}초 기다렸다` : ''})`);
  return 0;
}

if (require.main === module) {
  본다(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => {
    console.error(`🔴 ${e.message}`);
    process.exit(1);
  });
}
module.exports = { 인쇄 };
