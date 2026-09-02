'use strict';
/**
 * 소리어휘 — 영상이 부를 수 있는 소리 «이름»의 표를 정본에서 **파생**한다. 값을 새로 적지 않는다.
 *
 * 🔑 정본 사슬(한 값 두 곳 금지 — 여기는 읽기만 한다):
 *   · `docs/브랜드_사운드킷/_사운드킷.md` 원문: 「값의 정본은 `docs/디자인_토큰.json` 「사운드」다」
 *     → 토큰 `사운드.이벤트`(UI 킷 3 + 몽글 12 + 까몽 5 + 마린 4 = 24 · 09-01 실측) 이 킷 소리의 이름과 파일이다.
 *   · 옹알이 7종(만족·만족2·궁금·반김·간지럼·잠깸·잠꼬대)은 사운드킷 밖이다 — 정본은
 *     `tools/감각층소리합성.js` 의 `MURMURS`(이름 순서 = `murmur_N` 번호). 그 파일은 CLI 라 require 하면
 *     돌아 버리므로 «원문에서 이름만» 읽는다. 0개가 읽히면 던진다(조용히 빈 표를 내지 않는다).
 *   · 🗺 «어느 상황에 어느 소리»(배치)의 정본은 형제 저장소 **`SYNK-talk/lib/가이드목소리.js`** 하나다 —
 *     `_사운드킷.md` 가 그렇게 못 박았다(「한 값을 두 곳이 알면 갈린다」). 여기 옮겨 적지 않는다.
 *     영상의 배치는 `대본읽기.js` 의 꼴소리·라벨소리·옹알이배치 표가 지되, **이 어휘 안에서만** 고른다 —
 *     그것이 `발행검사.js` ④ 가 재는 것이다.
 *
 * 🔑 이름 규약(발행검사 ④ 와 킷 다리 `src/킷/소리.ts` 가 같은 표를 본다):
 *   · 킷 소리 = 토큰 이벤트 키 그대로 — `획득`·`성취`·`알림`·`몽글_먀앙`·`까몽_베에`·`마린_기동` …
 *   · 옹알이  = `옹알이_<가이드>_<이름>` — `옹알이_까몽_궁금`. 파일은 `자산모으기.js` 가 같은 규약으로 놓는다.
 *
 * 쓰기: node 영상/소리어휘.js            — 쓸 수 있는 이름 전량을 찍는다
 *       (대본읽기.js 가 생성물과 함께 `src/클립/생성/소리표.ts` 를 매번 다시 쓴다 — 킷 다리가 그것을 읽는다)
 */
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const 저장소 = path.resolve(방, '..');
const 토큰경로 = path.join(저장소, 'docs', '디자인_토큰.json');
const 사운드킷정본 = path.join(저장소, 'docs', '브랜드_사운드킷', '_사운드킷.md');
const 합성기경로 = path.join(저장소, 'tools', '감각층소리합성.js');
const 소리표경로 = path.join(방, 'src', '클립', '생성', '소리표.ts');

/** 옹알이가 구워지는 가이드 — `자산모으기.js`·`대본읽기.js` 가 여기서 읽는다(가이드 목록의 임자는 이 줄 하나). */
const 옹알이가이드들 = ['몽글', '까몽'];

/** `소리/<파일>` — `자산모으기.js` ③ 이 사운드킷 wav 를 놓는 방. 놓는 쪽과 읽는 쪽이 같은 이름을 본다. */
const 킷소리방 = '소리';

function 토큰() {
  return JSON.parse(fs.readFileSync(토큰경로, 'utf8'));
}

/** 토큰 `사운드.이벤트` → 킷 소리 목록. 이름은 이벤트 키 그대로다. */
function 킷소리() {
  const 이벤트 = 토큰()['사운드']['이벤트'];
  return Object.entries(이벤트).map(([이름, v]) => ({
    이름,
    파일: `${킷소리방}/${v.렌더.파일}`,
    가족: 이름.includes('_') ? '가이드 목소리' : 'UI 킷',
    길이ms: v.길이ms,
    파형: v.파형,
    형태: v.형태,
  }));
}

/** `tools/감각층소리합성.js` 의 MURMURS 이름을 «순서대로» 읽는다(순서 = murmur_N 번호). */
function 옹알이어휘() {
  const 원문 = fs.readFileSync(합성기경로, 'utf8');
  const 시작 = 원문.indexOf('const MURMURS = [');
  if (시작 === -1) throw new Error(`${path.relative(저장소, 합성기경로)} 에 MURMURS 표가 없다 — 옹알이 어휘의 정본이 옮겨졌다면 소리어휘.js 를 그리로 돌린다`);
  const 끝 = 원문.indexOf('];', 시작);
  const 이름들 = [...원문.slice(시작, 끝).matchAll(/\{\s*이름:\s*'([^']+)'/g)].map((m) => m[1]);
  if (!이름들.length) throw new Error('MURMURS 표에서 이름을 하나도 못 읽었다 — 표 꼴이 바뀌었다');
  return 이름들;
}

/** 이름 → 규격. 킷 소리 + 옹알이(가이드마다 한 벌). */
function 소리표() {
  const 표 = {};
  for (const s of 킷소리()) 표[s.이름] = s;
  const 옹알이 = 옹알이어휘();
  for (const 가이드 of 옹알이가이드들) {
    옹알이.forEach((이름, i) => {
      표[`옹알이_${가이드}_${이름}`] = {
        이름: `옹알이_${가이드}_${이름}`,
        파일: `옹알이_${가이드}/${이름}.wav`,
        가족: '옹알이',
        가이드,
        합성번호: i + 1,
      };
    });
  }
  return 표;
}

/**
 * 킷 다리가 읽을 생성물을 쓴다 — `src/클립/생성/` 은 git 밖(대본클립들.ts 와 같은 자리·같은 규율).
 * 내용이 같으면 안 쓴다(씨앗·게이트 지문이 헛되이 안 바뀌게).
 */
function 소리표쓰기(경로 = 소리표경로) {
  const 표 = 소리표();
  const 본문 = `/* ⚠ 기계가 쓴 파일이다 — 손으로 고치지 마라.
 * 정본은 토큰 \`사운드.이벤트\`(docs/디자인_토큰.json · _사운드킷.md 가 가리킨다) + 옹알이 7(tools/감각층소리합성.js)이고,
 * 이 파일은 \`영상/소리어휘.js\` 의 산출물이다. 대본읽기.js 가 생성물과 함께 매번 다시 쓴다.
 */
import type { 소리규격 } from "../../킷/소리";

export const 소리표: Record<string, 소리규격> = ${JSON.stringify(표, null, 2)};
`;
  fs.mkdirSync(path.dirname(경로), { recursive: true });
  const 옛 = fs.existsSync(경로) ? fs.readFileSync(경로, 'utf8') : '';
  if (옛 !== 본문) fs.writeFileSync(경로, 본문, 'utf8');
  return { 경로, 개수: Object.keys(표).length, 바뀜: 옛 !== 본문 };
}

module.exports = { 킷소리, 옹알이어휘, 옹알이가이드들, 소리표, 소리표쓰기, 소리표경로, 사운드킷정본, 토큰경로 };

if (require.main === module) {
  const 표 = 소리표();
  const 갈래 = {};
  for (const s of Object.values(표)) (갈래[s.가족] ??= []).push(s.이름);
  console.log(`소리 이름 ${Object.keys(표).length}개 = ${Object.entries(갈래).map(([g, v]) => `${g} ${v.length}`).join(' + ')}`);
  for (const [g, v] of Object.entries(갈래)) console.log(`  ${g}: ${v.join(' · ')}`);
  console.log(`  배치 정본(어느 상황에 어느 소리) = SYNK-talk/lib/가이드목소리.js — 여기엔 없다`);
}
