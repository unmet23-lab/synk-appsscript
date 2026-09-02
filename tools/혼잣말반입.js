#!/usr/bin/env node
/**
 * 혼잣말 — **앱(SYNK-talk) 반입**.
 *
 * ■ 🔴 왜 이제야 도구가 생겼나 (09-02)
 *   반입 «사본»은 08-28부터 있었는데(`contents/혼잣말.json`) **옮기는 통로가 손이었다.**
 *   대조 회귀(talk `tests/혼잣말.test.js`)는 있으니 갈라지면 빨개지긴 하는데,
 *   그건 「갈라진 걸 알려 준다」지 「안 갈라지게 한다」가 아니다 — 그리고 손 절차는
 *   바쁠 때 가장 먼저 빠진다(워크트리 규약이 손 규율에 대해 내린 판정과 같다).
 *   ⇒ 정본을 고친 사람이 이 한 줄을 돌리면 끝나게 한다.
 *
 * ■ 정본 관계
 *   · 문구의 주인 = `docs/캐릭터/혼잣말_정본.json`(검사 = `node tools/혼잣말검사.js`)
 *   · 반입 사본 = talk `contents/혼잣말.json` — 대조는 talk `tests/혼잣말.test.js`
 *   · 여기는 **옮기기만** 한다. 규격 판정(자리·소재·급수·어절·금지패턴)은 검사 도구 몫이다.
 *
 * ■ ⚠ 반입해도 «앱이 고르는» 것은 늘지 않는다
 *   talk `lib/마스코트생명.js` 의 `혼잣말자리들`(활성 자리)에 없는 자리는 색인에 안 들어온다.
 *   데이터로만 살고 코드는 안 본다 — 차강사르가 그렇게 서 있다. **새 자리를 열려면 거기 한 줄이
 *   같이 가야 한다**(그리고 활성 조합 수를 못 박은 회귀도).
 *
 * 쓰기: node tools/혼잣말반입.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 저장소 = path.join(__dirname, '..');
const 정본경로 = path.join(저장소, 'docs', '캐릭터', '혼잣말_정본.json');
const talk = path.join(저장소, '..', 'SYNK-talk');
const 나갈곳 = path.join(talk, 'contents', '혼잣말.json');

if (!fs.existsSync(talk)) {
  console.error(`🔴 형제 저장소가 없다: ${talk} — 반입할 곳이 없다.`);
  process.exit(1);
}

const 정본 = JSON.parse(fs.readFileSync(정본경로, 'utf8'));
if (!Array.isArray(정본.문구) || 정본.문구.length === 0) {
  console.error('🔴 정본 문구가 비었다 — 빈 사본을 놓으면 마스코트가 통째로 입을 다문다.');
  process.exit(1);
}

/* 사본 머리말은 «여기가 사본»이라는 것과 정본 머리말을 함께 든다 — 08-28 판의 모양 그대로다.
   다음 사람이 이 파일을 열었을 때 정본이 어디인지 한 줄 안에 알아야 한다. */
const 사본 = {
  _주:
    '반입 사본 — 정본은 SYNK-appsscript docs/캐릭터/혼잣말_정본.json 이다. 여기는 반입 사본이고, '
    + '정본이 바뀌면 같이 옮긴다(통로 = node tools/혼잣말반입.js · 대조 = tests/혼잣말.test.js · '
    + '형제 저장소가 있을 때만 돈다 — 없으면 skip). 여기서 문구를 고치지 않는다: 고치면 정본과 '
    + `갈라지고, 갈라지는 방향은 언제나 「통과」다. ⟨정본 _주⟩ ${정본._주}`,
  _생성: 정본._생성,
  문구: 정본.문구,
};

fs.writeFileSync(나갈곳, `${JSON.stringify(사본, null, 2)}\n`, 'utf8');

const 자리별 = {};
for (const r of 정본.문구) 자리별[r.자리] = (자리별[r.자리] || 0) + 1;
console.log(`혼잣말 반입 — ${정본.문구.length}벌 → ${path.relative(저장소, 나갈곳)}`);
console.log(`  자리 ${Object.keys(자리별).length}종: ${Object.entries(자리별).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log('  ⚠ 앱이 «고르는» 자리는 talk lib/마스코트생명.js 의 `혼잣말자리들` 이 따로 정한다.');
