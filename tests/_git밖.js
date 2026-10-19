'use strict';
/* git 에 안 넣는(로컬에만 있는) 자료를 읽는 실저장소 검사의 CI 갈래 (2026-10-03).
 *
 * CI 는 깨끗한 체크아웃이라 그런 자료가 «설계상» 없다 — `.gitignore` 포괄 규칙(09-17)의 `_검토/`·영상,
 * 빌드 산출물(dist), 키트 사본, 후보 자산 폴더 같은 것들이다. 그래서
 *   · CI(`process.env.CI`)에서 없으면 → 그 검사(또는 그 부분)를 «건너뜀(사유)»으로 낸다.
 *   · CI 가 아니면(개발 PC) 없을 때 그대로 빨갛다 — 로컬에서는 느슨해지지 않는다.
 * GitHub Actions 는 CI=true 를 늘 넣고, 로컬 흉내 `node tools/test-ci.js` 도 같은 값을 넣는다(`tools/lib/ci모사환경.js`).
 * 이 파일은 `*.test.js` 가 아니라 스위트가 직접 돌리지 않는다.
 */
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const CI인가 = () => Boolean(process.env.CI);

/** CI 인데 이 자료(저장소 뿌리 기준 경로)가 없으면 건너뜀 사유, 아니면 null. */
function CI에없는로컬자료(rel, 왜) {
  if (!CI인가()) return null;
  if (fs.existsSync(path.join(루트, rel))) return null;
  return `CI 체크아웃에는 없다 — ${rel} (${왜})`;
}

/** 되살리지 않기로 한 옛 로컬 자료 — 없으면 개발 PC에서도 건너뜀 사유, 있으면 null(있으면 그대로 잰다).
 *  10-06·10-10 공간 정리가 Drive로 옮기고 지운 옛 기록·후보 그림은 10-19 유호님 결정으로 되살리지 않는다
 *  (필요한 그림은 지금 판으로 새로 굽는다). 지금 쓰는 자료에는 쓰지 않는다 — 그건 위 CI 갈래가 지킨다.
 *  정리는 파일만 지우고 빈 폴더를 남겨 두었다 — 빈 폴더도 «없음»으로 센다. */
function 되살리지않는옛자료(rel, 왜) {
  const 자리 = path.join(루트, rel);
  if (fs.existsSync(자리) && !(fs.statSync(자리).isDirectory() && fs.readdirSync(자리).length === 0)) return null;
  return `이 체크아웃에 없다(빈 폴더 포함) — ${rel} (${왜} · 지운 옛 로컬 자료는 되살리지 않는다, 10-19)`;
}

module.exports = { CI인가, CI에없는로컬자료, 되살리지않는옛자료 };
