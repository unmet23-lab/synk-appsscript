// 훅 회귀의 공용 통로 — **미실행을 「통과」로 번역하지 않는다.**
//
// 실사고(2026-08-07) — 자격증명가드 회귀가 전량 실행에서 「비밀이 페이지로 나갔다」로 빨개졌다.
//   실제로 일어난 일은 훅 프로세스가 뜨지 못한 것이고, 그때 stdout 이 비어서 회귀의 도우미가
//   그것을 「훅이 보고 그냥 뒀다」로 읽었다. 파일 하나만 돌리면 초록이라 그 초록이 구멍을 덮었다.
//
// 🔴 더 나쁜 절반은 **조용하다.** 차단을 기대하는 검사는 훅이 안 뜨면 빨개져 눈에 띈다. 그런데
//   통과를 기대하는 검사(거짓양성 검문 · 가드 맹점②가 「같은 무게로 보라」고 한 그 묶음)는
//   훅이 안 떠도 **초록**이다. 그래서 이 통로를 안 쓰면 스위트는 「가드가 산다」를 증명한 적이
//   없는데도 초록을 낸다 — 통과와 미실행이 같은 모양이면 안 된다(CLAUDE.md 신뢰성).
//
// 왜 도우미마다 안 고치고 통로를 뗐나 — 같은 형태가 훅 회귀 여러 곳에 그대로 복제돼 있었다.
//   호출부마다 세 줄씩 심으면 다음에 생기는 회귀가 옛 형태로 다시 태어난다(CLAUDE.md 「3번째」).
//   옛 통로는 `tests/훅통로.test.js`(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 가 저장소를 훑어 금지했다 — 그것이 걷혀, 지금 금지하는 기계는 없다.
//
// 쓰는 법 — spawnSync 자리를 그대로 바꾼다:
//   const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
//   →  const r = 훅띄우기(HOOK, { input, encoding: 'utf8' });
//   인자가 붙으면 배열로:              훅띄우기([HOOK, '--reset'], { … })
//   훅이 일부러 0 아닌 코드로 끝나면:  훅띄우기(HOOK, { …, 통과코드: [0, 1] })
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

/**
 * 훅을 띄우고 **떴다는 것까지 확인해서** spawnSync 결과를 그대로 돌려준다.
 * 판정(무엇이 차단이고 무엇이 조용인가)은 호출부 몫 — 여기서 바꾸는 건 「안 뜬 경우」뿐이다.
 *
 * @param {string|string[]} 훅  훅 파일 경로(또는 [경로, ...인자])
 * @param {object} [옵션]        spawnSync 옵션 + `통과코드`(기본 [0])
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 * @throws 프로세스를 못 띄웠거나 통과코드 밖으로 끝났을 때 — 그 둘은 결과가 아니다
 */
function 훅띄우기(훅, 옵션 = {}) {
  const 인자 = Array.isArray(훅) ? 훅 : [훅];
  const { 통과코드 = [0], ...spawn옵션 } = 옵션;
  const r = spawnSync(process.execPath, 인자, { encoding: 'utf8', ...spawn옵션 });

  if (r.error || !통과코드.includes(r.status)) {
    // 두 실패를 **가려서** 말한다 — 「안 떴다」와 「비정상 종료」는 원인도 처방도 다르다.
    const 무슨일 = r.error ? '훅을 못 띄웠다' : `훅이 ${r.status} 로 끝났다(기대=${통과코드.join('|')})`;
    throw new Error(
      `${무슨일} — 미실행도 비정상 종료도 결과가 아니다 (${path.basename(String(인자[0]))}): `
      + `error=${r.error ? (r.error.code || r.error.message) : '없음'} `
      + `status=${r.status} signal=${r.signal}\n`
      + `stderr=${String(r.stderr || '').slice(0, 400)}`,
    );
  }
  return r;
}

module.exports = { 훅띄우기 };
