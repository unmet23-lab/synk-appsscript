'use strict';
/* 화면시험 — qa 화면 스크립트(Playwright)를 전체 시간 한도 안에서 돌리고, 어떻게 끝나든 자기 브라우저까지 함께 끝낸다(2026-11-04).
 *
 *   const { 화면시험, 닫기 } = require('…/tools/lib/화면시험.cjs');
 *   async function run(name, view) {
 *     const browser = await chromium.launch(…);
 *     try { …; return 결과; } finally { await 닫기(browser); }
 *   }
 *   화면시험({ 분: 20 }, async () => { …; });
 *
 *   - main이 끝나면(성공이든 실패든) 프로세스를 끝낸다. main이 던지면 오류를 보이고 종료 코드 1, process.exitCode를 줬으면 그 값이다.
 *   - 한도를 넘으면 종료 코드 124로 끝낸다. 한 번만 더 오래 돌려야 하면 SYNK_QA_LIMIT_SEC=<초>로 그 실행의 한도를 바꾼다.
 *
 * 왜 있나: 11-04 앱화면.cjs 셋이 부모 셸이 사라진 채 10~13시간 돌며 코어 약 6개를 잡아 조건부 시험을 밀었다. 멈춘 호출은 없었다.
 *   run()이 실패하면 browser.close()를 건너뛰고, Playwright가 쥔 브라우저 파이프 때문에 main이 끝나도 node가 끝나지 않으며,
 *   남은 브라우저는 게임 화면을 계속 그린다(현장노트 시험_화면확인). process.exitCode만 주는 꼴도 같다.
 *   setDefaultTimeout이 닿지 않는 호출(page.evaluate · mouse · keyboard · title · browser.close)은 렌더러가 막히면 영원히 돌아오지 않을 수 있다.
 *
 * 왜 process.exit이면 브라우저까지 끝나나: Playwright가 exit 때 자기 브라우저 트리를 taskkill /T로 끄고 임시 프로필을 지운다(렌더러가 막혀 있어도, 11-04 실측).
 *   detached가 아닌 직속 자식(시범 서버 · 브라우저 메인)은 Windows에서 libuv 작업 객체로 부모와 함께 죽는다. 그래서 PID를 따로 쫓지 않는다.
 * 왜 작업 스레드까지 두나: 주 스레드가 동기 호출이나 무한 루프로 막히면 타이머가 울리지 않고, exit 처리 자체가 막힐 수도 있다. 그때를 위한 마지막 수단이다.
 *   브라우저의 렌더러 · GPU는 그 작업 객체 밖이라 node만 죽이면 남는다(Edge 렌더러가 30초 넘게, 11-04 실측) → taskkill /T로 자기 트리를 끈다.
 *   정리 없이 끄므로(임시 프로필이 남을 수 있다) 첫 단계로 쓰지 않는다. Linux에는 이 단계에서 브라우저가 남을 수 있다 — 이 도구는 이 PC용이다. */
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const 한도넘김코드 = 124;
const 기본강제여유초 = 30;
const 기본닫기초 = 20;
const 비우기한도ms = 5000;

function 알림(글) { try { fs.writeSync(2, `[화면시험] ${글}\n`); } catch { /* 표준 오류가 닫혀 있다 */ } }
const 이름 = () => (process.argv[1] ? path.relative(process.cwd(), process.argv[1]) : '스크립트');

function 한도초(옵션) {
  const 덮어쓰기 = Number(process.env.SYNK_QA_LIMIT_SEC);
  if (Number.isFinite(덮어쓰기) && 덮어쓰기 > 0) return 덮어쓰기;
  const 초 = (옵션?.분 ?? 0) * 60 + (옵션?.초 ?? 0);
  if (!(초 > 0)) throw Error('화면시험: 한도가 없다 — 화면시험({ 분: 20 }, main)처럼 준다');
  return 초;
}

const 강제시계글 = `
const { workerData: { ms, 글 } } = require('node:worker_threads');
setTimeout(() => {
  try { require('node:fs').writeSync(2, 글); } catch {}
  if (process.platform === 'win32') {
    try { require('node:child_process').spawnSync('taskkill', ['/PID', String(process.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 15000 }); } catch {}
  }
  process.kill(process.pid, 'SIGKILL');
}, ms);
`;

function 강제시계(ms, 글) {
  const worker = new Worker(강제시계글, { eval: true, workerData: { ms, 글: `[화면시험] ${글}\n` } });
  worker.on('error', () => {});
  worker.unref();
}

// 파이프로 받은 표준 출력은 Windows에서 비동기라, 그대로 process.exit하면 끝에 찍은 JSON이 잘린다.
function 비우기(흐름) {
  return new Promise((끝) => {
    const 시계 = setTimeout(끝, 비우기한도ms);
    const 마침 = () => { clearTimeout(시계); 끝(); };
    흐름.once('error', 마침);
    try { 흐름.write('', 마침); } catch { 마침(); }
  });
}

async function 끝내기(코드) {
  await 비우기(process.stdout);
  await 비우기(process.stderr);
  process.exit(코드);
}

async function 화면시험(옵션, main) {
  const 초 = 한도초(옵션), 강제여유초 = 옵션?.강제여유초 ?? 기본강제여유초, 누구 = 이름();
  강제시계((초 + 강제여유초) * 1000, `한도 ${초}초에서 ${강제여유초}초가 더 지나도 끝나지 않아 자기 프로세스 트리를 바로 끈다: ${누구}`);
  // 일부러 unref하지 않는다 — main이 끝나지 않은 채 할 일이 없어져도 조용히 성공(0)으로 끝나면 안 된다.
  setTimeout(() => {
    알림(`한도 ${초}초를 넘겨 브라우저까지 끄고 실패(${한도넘김코드})로 끝낸다: ${누구} — 더 오래 돌려야 하면 SYNK_QA_LIMIT_SEC=<초>`);
    process.exit(한도넘김코드);
  }, 초 * 1000);
  let 코드;
  try {
    await main();
    코드 = process.exitCode ?? 0;
  } catch (error) {
    console.error(error);
    코드 = process.exitCode || 1;
  }
  await 끝내기(코드);
}

// browser.close()에는 setDefaultTimeout이 닿지 않는다. 정해진 시간 안에 안 닫히면 넘어가고, 남은 브라우저는 화면시험이 끝날 때 함께 끝난다.
async function 닫기(대상, { 초 = 기본닫기초 } = {}) {
  let 시계;
  const 닫힘 = await Promise.race([
    Promise.resolve().then(() => 대상.close()).then(() => true, (error) => { 알림(`브라우저 닫기 실패: ${String(error).split('\n')[0]}`); return false; }),
    new Promise((끝) => { 시계 = setTimeout(() => { 알림(`브라우저가 ${초}초 안에 닫히지 않았다 — 끝날 때 함께 끈다`); 끝(false); }, 초 * 1000); }),
  ]);
  clearTimeout(시계);
  return 닫힘;
}

module.exports = { 화면시험, 닫기, 한도넘김코드 };
