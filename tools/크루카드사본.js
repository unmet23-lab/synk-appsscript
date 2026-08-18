#!/usr/bin/env node
/* 크루카드사본 — 라이브 카드(정본)와 docs 사본을 **바이트 단위로** 같게 유지한다.
 *
 * 왜 있나: 같은 파일이 두 경로에 있다.
 *   정본 = `crewcard/카드_*.html`   — `doGet` 이 `createHtmlOutputFromFile` 로 서빙하는 **라이브 화면**
 *   사본 = `docs/크루카드/크루카드_*.html` — 문서 폴더에서 열어보는 열람용
 *   2026-08-05 실측: 네 파일의 블롭 해시가 쌍끼리 정확히 일치했다. 즉 **지금은 같다.**
 *   그런데 같다는 사실을 아무것도 지키지 않아서, 한쪽만 고치면 조용히 갈라진다 —
 *   그리고 갈라진 뒤엔 **어느 쪽이 진짜인지 파일만 봐서는 알 수 없다.**
 *   브랜드킷 수리(위반 162→0)를 정본에만 넣고 끝냈다면 사본은 위반 162 를 그대로 안은 채
 *   「문서 폴더의 최신본」 행세를 했을 것이다.
 *
 * 방향은 한쪽뿐이다 — **정본 → 사본**. 사본을 고쳐도 라이브는 안 바뀌므로,
 * 사본이 앞선 상태는 언제나 사고지 갱신이 아니다.
 *
 * 사용법:
 *   node tools/크루카드사본.js           사본을 정본으로 덮는다
 *   node tools/크루카드사본.js --check   다르면 exit 1 (CI·테스트용 — 아무것도 안 쓴다)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const ROOT = path.resolve(__dirname, '..');

/** [정본, 사본] — 새 언어가 늘면 여기 한 줄만 추가한다. */
const 쌍 = [
  ['crewcard/카드_kr.html', 'docs/크루카드/크루카드_한국어.html'],
  ['crewcard/카드_mn.html', 'docs/크루카드/크루카드_몽골어.html'],
];

const 해시 = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12);

function main(argv) {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ 종료 코드를 **돌려주는** 꼴이라 `process.exit` 를 여기서 부르지 않는다. */
  const 아는플래그 = ['--check'];
  const 플래그오류 = 인자게이트('크루카드사본', argv, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); return 1; }
  const check = argv.includes('--check');
  let 어긋남 = 0;

  for (const [정본rel, 사본rel] of 쌍) {
    const 정본 = path.join(ROOT, 정본rel);
    const 사본 = path.join(ROOT, 사본rel);

    if (!fs.existsSync(정본)) {
      console.error(`✗ 정본이 없다: ${정본rel} — 경로가 바뀌었다면 이 파일의 \`쌍\` 을 고쳐라`);
      return 2;
    }
    // 사본이 아예 없는 것도 「어긋남」이다. 없는 것을 통과로 읽으면 검사가 헛돈다.
    const 같다 = fs.existsSync(사본) && fs.readFileSync(정본).equals(fs.readFileSync(사본));
    if (같다) { console.log(`✅ ${사본rel}  (${해시(정본)})`); continue; }

    어긋남++;
    if (check) {
      const 사본해시 = fs.existsSync(사본) ? 해시(사본) : '없음';
      console.error(`🔴 갈라졌다: ${사본rel}\n   정본 ${정본rel} = ${해시(정본)}\n   사본            = ${사본해시}`
        + '\n   → `node tools/크루카드사본.js` 로 정본을 사본에 덮어라(반대 방향은 없다).');
    } else {
      fs.mkdirSync(path.dirname(사본), { recursive: true });
      fs.copyFileSync(정본, 사본);
      console.log(`↻ ${사본rel} ← ${정본rel}  (${해시(정본)})`);
    }
  }

  if (check && 어긋남) return 1;
  console.log(check ? `\n검사 ${쌍.length}쌍 — 전부 일치` : `\n동기화 ${쌍.length}쌍 완료`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { 쌍, main };
