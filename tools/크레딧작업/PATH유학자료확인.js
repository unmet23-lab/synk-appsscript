'use strict';
/**
 * PATH 유학 앱 공식 자료 만료 알림 — Windows 작업 스케줄러 「SYNK PATH 유학 자료 확인」이 하루 한 번 부른다(2026-11-22).
 *
 * 채널 글 · 재정 규칙 · 실제 과정 · 내 길 서류 묶음은 공식 쪽을 직접 읽은 값이고, 앱은 확인한 지 90일이 지나면 「다시 확인하세요」를 띄운다.
 * 실제 과정은 마지막 접수 차수가 끝나면 다음 요강으로 고쳐야 한다. tools/path유학자료만료.mjs가 AI 없이 남은 날을 재고,
 * 남은 날이 14일 이하이거나 지난 항목이 새로 생기면 텔레그램으로 한 통 알린다. 모델은 부르지 않는다(사전 확인이 늘 「할 일 없음」으로 끝난다).
 *
 * 같은 항목은 단계(곧 · 지남)마다 한 번만 알린다. 알린 항목은 output/크레딧작업/PATH유학자료확인/알린항목.json에 적고,
 * 자료를 고쳐 풀린 항목은 지운다(같은 항목이 다시 걸리면 다시 알린다). 이 파일의 `걸림`이 지금 걸린 항목 전부다.
 * 저장소 자료를 못 읽으면 하루 한 번 알린다.
 *
 *   node tools/크레딧실행.js 작업 PATH유학자료확인                  예약 작업이 부르는 길
 *   node tools/크레딧작업/PATH유학자료확인.js 마른실행 [--오늘 2027-02-10]
 *       임시 방에서 같은 사전 확인을 돌려 보낼 글과 기록을 보인다. 공개본은 실제로 받아 읽기만 하고 텔레그램은 보내지 않는다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { 공용작업본 } = require('../lib/공용작업본.js');

const 문턱 = 14;
const 기록이름 = '알린항목.json';
const 저장소뿌리 = path.resolve(__dirname, '..', '..');
const 자료뿌리 = 공용작업본(저장소뿌리);

const 만료모듈 = () => import(pathToFileURL(path.join(__dirname, '..', 'path유학자료만료.mjs')).href);

function JSON읽기(파일) { try { return JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { return null; } }
function JSON쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 1) + '\n');
  fs.renameSync(임시, 파일);
}
const 짧게 = (값, n) => String(값 ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// 텔레그램보내기는 { code }를 준다. 시험의 알림 함수가 아무것도 주지 않으면 보낸 것으로 친다.
const 보냈나 = (r) => !r || r.code === 0;

function 만들기({ fetch, 지금고정, 뿌리들 } = {}) {
  return {
    설명: 'PATH 유학 앱 공식 자료 — 남은 날 14일 이하이거나 지난 항목을 알림(AI 없음)',
    잠금시간: 30 * 60 * 1000,
    문턱,

    async 사전확인(ctx) {
      const 지금 = 지금고정 || (ctx.지금 ? new Date(ctx.지금) : new Date());
      const 만료 = await 만료모듈();
      const 오늘 = 만료.오늘KST(지금);
      const 기록파일 = path.join(ctx.방, 기록이름);
      const 기록 = JSON읽기(기록파일) || {};
      let 잰;
      try {
        잰 = await 만료.만료확인({ 뿌리들: 뿌리들 || [...new Set([자료뿌리, ctx.루트].filter(Boolean))], 오늘, 문턱, fetch, 지금: +지금 });
      } catch (e) {
        // 자료를 못 읽으면 조용히 지나가지 않게 하루 한 번 알린다.
        if (기록.읽기실패?.오늘 !== 오늘 && 보냈나(ctx.알림(`[PATH 유학] 공식 자료 만료 검사가 자료를 못 읽었어요 — ${짧게(e.message, 200)}. 내일 다시 봐요.`))) {
          JSON쓰기(기록파일, { ...기록, 읽기실패: { 오늘, 시각: 지금.toISOString(), 오류: 짧게(e.message, 300) } });
        }
        return { 할일: false, 이유: `자료 못 읽음 — ${짧게(e.message, 200)}` };
      }
      const 지금열쇠 = new Set(잰.걸림.map((x) => x.열쇠));
      const 알린 = Object.fromEntries(Object.entries(기록.알린 || {}).filter(([열쇠]) => 지금열쇠.has(열쇠)));
      const 새것 = 잰.걸림.filter((x) => !알린[x.열쇠]);
      let 보냄 = null;
      if (새것.length) {
        보냄 = 보냈나(ctx.알림(만료.알림글(잰, 새것)));
        if (보냄) for (const x of 새것) 알린[x.열쇠] = 지금.toISOString();
      }
      JSON쓰기(기록파일, {
        오늘, 시각: 지금.toISOString(), 문턱, 공개본: 잰.공개본, 알린,
        걸림: 잰.걸림.map((x) => ({ 열쇠: x.열쇠, 글: 만료.항목글(x) })),
      });
      const 가까운 = 잰.줄들.find((x) => x.남은날 !== null);
      const 이유 = `걸림 ${잰.걸림.length}건(새로 ${새것.length}건${보냄 === false ? ', 알림 실패 — 다음 회차에 다시' : ''}) · 가장 가까운 ${가까운 ? `${가까운.id} ${가까운.검사} ${가까운.남은날}일` : '없음'}`;
      return { 할일: false, 이유 };
    },
  };
}

module.exports = 만들기();
module.exports.만들기 = 만들기;

/** 마른 실행 — 임시 방에서 사전 확인을 돌리고, 텔레그램 대신 보낼 글을 보인다. */
async function 마른실행(argv) {
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : undefined; };
  const 오늘 = 값('--오늘');
  const 지금 = 오늘 ? new Date(`${오늘}T01:40:00.000Z`) : new Date(); // KST 10:40
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-path-study-dry-'));
  const 알림들 = [];
  try {
    const 결과 = await 만들기({ 지금고정: 지금 }).사전확인({ 루트: 저장소뿌리, 방, 알림: (글) => { 알림들.push(글); return { code: 0 }; } });
    console.log(`마른 실행 — 오늘 ${오늘 || '지금'} 기준, 임시 방 ${방}\n\n## 결과\n${JSON.stringify(결과, null, 1)}`);
    console.log(`\n## 텔레그램 대신 받은 알림\n${알림들.join('\n\n') || '(없음)'}`);
    console.log(`\n## ${기록이름}\n${fs.readFileSync(path.join(방, 기록이름), 'utf8')}`);
  } finally {
    fs.rmSync(방, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '마른실행') 마른실행(argv.slice(1)).catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
  else { console.error('사용: node tools/크레딧작업/PATH유학자료확인.js 마른실행 [--오늘 YYYY-MM-DD]'); process.exitCode = 1; }
}
