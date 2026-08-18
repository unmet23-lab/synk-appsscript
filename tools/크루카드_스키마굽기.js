#!/usr/bin/env node
/* 크루카드 스키마 굽기 — docs 정본 JSON을 카드 HTML 2행의 base64로 다시 굽고, 서빙본→문서본을 미러한다.
 *
 * 왜 도구가 됐나 (2026-08-04 실측):
 *   카드 HTML 2행에는 `window.__resources.fieldSchema = "data:application/json;base64,…"` 가 박혀 있고,
 *   **런타임이 실제로 읽는 것은 이쪽**이다(loadSchema 의 상대 경로 `data/…json` 폴백은 타지 않는다).
 *   그런데 정본은 `docs/크루카드/크루카드_스키마.json` 파일이다. 08-04 에 source·referrer 2필드를
 *   JSON 에만 넣고 base64 를 안 구워, **정본과 실제가 조용히 갈라져 있었다**(실측으로 발견).
 *   손으로 굽는 절차는 아무도 기억 못 한다 — 그래서 절차가 아니라 도구다.
 *   짝이 되는 회귀 = tests/크루카드.test.js 「2행 base64 = 정본 JSON」.
 *
 * 사용:  node tools/크루카드_스키마굽기.js          — 굽고 미러한다
 *        node tools/크루카드_스키마굽기.js --check   — 갈라졌는지만 보고 종료코드로 답한다(CI용)
 *
 * ⚠ 바꾸는 것은 그 한 줄 안의 base64 문자열뿐이다. 카드의 다른 바이트는 손대지 않는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = path.join(ROOT, 'docs', '크루카드', '크루카드_스키마.json');
/* 서빙본(Apps Script 가 실제로 내려보내는 것) → 문서본(사람이 여는 사본). 방향은 한쪽뿐이다 —
 * 문서본을 고치고 서빙본을 안 고치면 라이브는 안 바뀌는데 검사만 초록이 된다. */
const PAIRS = [
  ['crewcard/카드_kr.html', 'docs/크루카드/크루카드_한국어.html'],
  ['crewcard/카드_mn.html', 'docs/크루카드/크루카드_몽골어.html'],
];
const RE = /("fieldSchema":\s*"data:application\/json;base64,)([A-Za-z0-9+/=]+)(")/;

function main() {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다. */
  const 아는플래그 = ['--check'];
  const 플래그오류 = 인자게이트('크루카드_스키마굽기', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const check = process.argv.includes('--check');
  /* LF 정규화 — autocrlf=true 체크아웃(Windows)은 이 파일을 CRLF로 내려준다. raw로 구우면
   * 굽는 기계의 OS에 따라 base64가 달라져, 같은 정본인데 CI(LF)와 로컬(CRLF)이 서로를 적색으로 본다. */
  const json = fs.readFileSync(SCHEMA, 'utf8').replace(/\r\n/g, '\n');
  JSON.parse(json); // 깨진 JSON을 구워 넣지 않는다 — 구우면 카드 전체의 스키마가 죽는다
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  let 갈라짐 = 0;

  for (const [servePath, docPath] of PAIRS) {
    const p = path.join(ROOT, servePath);
    const src = fs.readFileSync(p, 'utf8');
    const m = RE.exec(src);
    if (!m) { console.error('✖ 2행 스키마 앵커를 못 찾았다: ' + servePath); process.exit(2); }

    const 최신 = m[2] === b64;
    if (!최신) 갈라짐++;
    const next = 최신 ? src : src.replace(RE, '$1' + b64 + '$3');
    if (!최신 && !check) { fs.writeFileSync(p, next, 'utf8'); console.log('✔ 재굽기: ' + servePath); }
    else if (!최신) console.log('✖ 갈라짐: ' + servePath + ' (박힌 ' + m[2].length + ' ≠ 정본 ' + b64.length + ')');
    else console.log('= 최신: ' + servePath);

    const d = path.join(ROOT, docPath);
    const 같음 = fs.existsSync(d) && fs.readFileSync(d, 'utf8') === next;
    if (!같음) 갈라짐++;
    if (!같음 && !check) { fs.writeFileSync(d, next, 'utf8'); console.log('✔ 미러: ' + docPath); }
    else if (!같음) console.log('✖ 갈라짐: ' + docPath + ' (서빙본과 다르다)');
  }

  if (check && 갈라짐) {
    console.error('\n갈라진 곳 ' + 갈라짐 + '건 — `node tools/크루카드_스키마굽기.js` 로 굽고 커밋하라.');
    process.exit(1);
  }
  console.log(갈라짐 ? '\n' + 갈라짐 + '건 정리 완료.' : '\n전부 최신.');
}

if (require.main === module) main();
module.exports = { SCHEMA, PAIRS, RE };
