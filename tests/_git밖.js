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

module.exports = { CI인가, CI에없는로컬자료 };
