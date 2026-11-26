'use strict';
/* 관련시험 몰이 — tools/관련시험.js 돌리기가 띄우고, 고른 시험 파일마다 `node --test`를 따로 돌린다 (2026-11-26).
 *
 * 왜 파일마다인가: 한 실행기로 여러 파일을 나란히 돌리면 TAP은 파일 이름순으로만 나온다. 그래서 15분 한도에 끊기면 이미 깨진 뒤 파일의
 *   실패가 TAP에 없어 「시간만 넘김」으로 올라갔다. 파일마다 따로 돌리면 끝난 파일의 TAP과 종료 코드가 곧 Node의 판정이다.
 *   Node의 실패 셈을 흉내 내지 않는다(GPT 검수 두 회차 P1이 모두 그 흉내에서 나왔다 — Fable 5.2 설계 재검토).
 * 쓰는 법: node tools/lib/관련시험몰이.cjs <일 파일>. 일 파일(JSON)은 { 시험: [...], 동시, 한도ms, 폴더, 고정: [...] }다.
 *   cwd와 환경은 띄운 쪽 것을 그대로 물려준다. 시험 목록을 파일로 받으니 Windows 명령 길이 한도에 걸리지 않는다.
 * 장부: <폴더>/장부.jsonl. 줄마다 appendFileSync로 써서, 몰이가 강제로 끝나도 앞 줄은 남는다.
 *   첫 줄 {"몰이판":1,"수":N} · 띄우기 직전 {"번호":i,"시작":true} · 스스로 끝나면 {"번호":i,"종료":status,"신호":signal} ·
 *   띄우지 못하면 {"번호":i,"오류":code} · 한도에 닿으면 {"끊김":true} · 마지막 {"끝":true}.
 * 한도: 끊김을 먼저 적고 도는 실행기를 SIGKILL한다. 그 뒤에 오는 끝은 적지 않는다(Windows 강제 종료의 종료 코드 1을 깨짐으로 읽지 않게).
 *   실행기가 죽으면 그 실행기가 띄운 시험 파일 프로세스도 Windows에서는 함께 끝난다(지금과 같은 범위).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

/** 번호째 시험 파일을 돌리는 실행기 인자 — TAP은 <폴더>/<번호>.tap에 쓴다. */
function 자식명령(일, 번호) {
  return [...일.고정, `--test-reporter-destination=${path.join(일.폴더, `${번호}.tap`)}`, 일.시험[번호]];
}

/** 일을 끝까지(또는 한도까지) 몬다. 장부를 다 쓰면 풀린다. */
function 몰기(일, { 띄우기 = spawn, 끝기다림ms = 3000 } = {}) {
  const 장부 = path.join(일.폴더, '장부.jsonl');
  const 적기 = (값) => fs.appendFileSync(장부, `${JSON.stringify(값)}\n`);
  const 수 = 일.시험.length, 동시 = Math.max(1, Math.floor(일.동시) || 1);
  const 도는 = new Map();
  let 다음 = 0, 끊김 = false, 마침 = false, 한도시계 = null, 끝시계 = null;
  적기({ 몰이판: 1, 수 });
  return new Promise((풀기) => {
    const 마치기 = () => {
      if (마침) return;
      마침 = true;
      clearTimeout(한도시계); clearTimeout(끝시계);
      적기({ 끝: true });
      풀기();
    };
    const 끝보기 = () => { if (!도는.size && (끊김 || 다음 >= 수)) 마치기(); };
    const 채우기 = () => {
      while (!끊김 && 도는.size < 동시 && 다음 < 수) {
        const 번호 = 다음++;
        적기({ 번호, 시작: true });
        let 자식;
        try { 자식 = 띄우기(process.execPath, 자식명령(일, 번호), { stdio: 'ignore', windowsHide: true }); }
        catch (e) { 적기({ 번호, 오류: e.code || e.message }); continue; }
        도는.set(번호, 자식);
        let 닫힘 = false;
        const 닫기 = (줄) => {
          if (닫힘) return;
          닫힘 = true;
          도는.delete(번호);
          if (!끊김) 적기({ 번호, ...줄 });
          채우기();
          끝보기();
        };
        자식.on('error', (e) => 닫기({ 오류: e.code || e.message }));
        자식.on('close', (status, signal) => 닫기({ 종료: status, 신호: signal }));
      }
    };
    if (일.한도ms > 0) 한도시계 = setTimeout(() => {
      끊김 = true;
      적기({ 끊김: true });
      for (const 자식 of 도는.values()) { try { 자식.kill('SIGKILL'); } catch { /* 이미 끝났다 */ } }
      끝시계 = setTimeout(마치기, 끝기다림ms); // 실행기가 다 닫히거나 기다림이 지나면 끝낸다
      끝보기();
    }, 일.한도ms);
    채우기();
    끝보기();
  });
}

if (require.main === module) {
  const 일 = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  몰기(일).then(() => process.exit(0), (e) => { console.error(e && e.stack || e); process.exit(2); });
}

module.exports = { 자식명령, 몰기 };
