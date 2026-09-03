#!/usr/bin/env node
'use strict';
/* 알림 값 점검 — 「내가 지은 알림이 값이 있었나」를 정해진 날에 기계가 스스로 꺼낸다.
 *
 * ■ 왜 있나 (2026-09-03 · 유호님 「2주 뒤 세는 것도 자동으로 되게 해줘」)
 *   그날 나는 「2주 뒤에 몇 번 떴는지 세서 0이면 걷겠다」고 적었다.
 *   그 약속이 **내 기억에만** 걸려 있었다 — 유호님이 안 물으시면 영영 안 세진다.
 *   유호님이 그 자리를 짚으셨다: 사람이 기억해야 하는 것은 그 자체로 미완이다.
 *
 * ■ 왜 예약 작업이 아니라 세션 시작인가
 *   예약 «등록»이 조용히 증발한 적이 있다(memory scheduled-task-registration-vanishes).
 *   유호님은 매일 세션을 여시니, 「열 때 날짜를 본다」가 더 확실하고 고장날 자리가 적다.
 *
 * ■ 어떻게 판정하나
 *   docs/_ops/알림값판정.json 이 «판정일»과 «0이면 어떻게 할지»를 미리 쥐고 있다.
 *   판정일 전 → 완전 침묵. 판정일 후 → 장부를 세어 결과와 처방을 낸다.
 *   판정을 마치면 그 파일의 `판정함` 을 true 로 바꾸고 커밋한다(그래야 다시 안 뜬다).
 *   ⚠ 일부러 «계속» 뜨게 두었다 — 처리하기 전에는 잊히면 안 되기 때문이다.
 *
 * ■ 쓰는 법
 *     node tools/알림값점검.js        ← 지금 세어 보기(판정일과 무관하게 언제나)
 *     node tools/알림값점검.js --훅    ← 세션 시작용. 판정일이 안 됐으면 조용
 */
const fs = require('fs');
const path = require('path');

const 뿌리 = path.resolve(__dirname, '..');
const 판정경로 = path.join(뿌리, 'docs', '_ops', '알림값판정.json');
const 장부경로 = path.join(뿌리, '.claude', '알림장부.jsonl');

const 훅모드 = process.argv.includes('--훅');

function 장부읽기() {
  // 🔑 「못 쟀다」(null)와 「0건」(빈 배열)을 가른다 — 둘이 같은 얼굴이면 이 자가 거짓말을 한다.
  //    장부 파일이 «아직 없는» 것은 0건이 맞다(한 번도 안 떴다는 뜻이므로).
  if (!fs.existsSync(장부경로)) return [];
  try {
    return fs.readFileSync(장부경로, 'utf8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return null; }
}

let 판정표;
try {
  판정표 = JSON.parse(fs.readFileSync(판정경로, 'utf8'));
} catch {
  if (!훅모드) console.log('판정표를 못 읽었다:', 판정경로);
  process.exit(0);
}

const 줄들 = 장부읽기();
if (줄들 === null) {
  if (!훅모드) console.log('장부를 못 읽었다 — 이건 「0건」이 아니라 «확인 불가»다:', 장부경로);
  process.exit(0);
}

const 오늘 = new Date();
const 낼말 = [];

for (const 건 of 판정표.판정건 || []) {
  if (건.판정함) continue;
  const 판정일 = new Date(건.판정일 + 'T00:00:00');
  if (훅모드 && 오늘 < 판정일) continue; // 아직 때가 아니다 — 완전 침묵

  const 걸린것 = 줄들.filter((r) => r.종류 === 건.이름);
  const 지은날 = new Date(건.지은날 + 'T00:00:00');
  const 지난날 = Math.max(1, Math.round((오늘 - 지은날) / 86400000));
  const 하루당 = (걸린것.length / 지난날).toFixed(1);

  if (훅모드) {
    const 처방 = 걸린것.length === 0
      ? `**0번 떴다 → 걷는다.** 미리 적어 둔 판정: ${건['0이면']}`
      : (건.너무잦으면 && 걸린것.length / 지난날 > 2)
        ? `**하루 ${하루당}번 떴다 → 너무 잦다.** 미리 적어 둔 판정: ${건.너무잦으면}`
        : `**${걸린것.length}번 떴다**(${지난날}일 · 하루 ${하루당}번). 값이 있었다 — 그대로 둔다.`;
    낼말.push(
      `   · **「${건.이름}」 알림** — ${건.무엇}\n` +
      `     ${처방}\n` +
      `     처리한 뒤 \`docs/_ops/알림값판정.json\` 에서 이 건의 \`판정함\` 을 true 로 바꾸고 커밋한다(그래야 이 줄이 사라진다)`
    );
  } else {
    낼말.push(`· ${건.이름}: ${걸린것.length}번 (${지난날}일 · 하루 ${하루당}번) · 판정일 ${건.판정일}`);
  }
}

if (!낼말.length) {
  if (!훅모드) {
    console.log('판정할 것이 없다 — 전부 처리됐거나 아직 때가 아니다.');
    console.log('장부에 쌓인 줄:', 줄들.length);
  }
  process.exit(0);
}

if (훅모드) {
  console.log('⚖ **알림 값 판정일이 됐다** — 지어 두고 「나중에 세겠다」고 한 것들이다:');
  console.log(낼말.join('\n'));
} else {
  console.log('알림 장부 집계 (줄 ' + 줄들.length + '개)');
  console.log(낼말.join('\n'));
}
process.exit(0);
