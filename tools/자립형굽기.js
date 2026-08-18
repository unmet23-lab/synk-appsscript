#!/usr/bin/env node
/* 자립형 굽기 — HTML 이 참조하는 이미지를 전부 data URI 로 박아 «1파일»로 만든다.
 *
 * 왜 있나(F440 · 2026-08-14): 자개 캐러셀 자립형을 손으로 만들었더니, 원본을 고친 뒤
 * 자립형이 **낡은 그림을 그대로 안고** 남았다. 두 벌을 손으로 맞추는 일은 반드시 갈라진다.
 * 킷 규칙 「인쇄 공통 규격 = 자립형 1파일(외부 자원 0)」(DESIGN.md §5)의 기계 통로이기도 하다.
 *
 * 쓰기: node tools/자립형굽기.js <원본.html> [나갈곳.html]
 *       나갈곳을 안 주면 `<원본>_자립형.html`.
 *
 * 틀릴 때의 모습: 참조가 하나라도 안 박히면 그 자리는 **깨진 그림 아이콘**으로 남는데,
 * 페이지 나머지는 멀쩡해서 「됐다」로 읽힌다. 그래서 끝에 잔존 외부 참조를 세어 0 이 아니면
 * **exit 1 로 죽는다** — 조용히 반쪽짜리를 내놓지 않는다.
 * 닫을 것: 없다(신설 통로 · 손 조립을 대신한다).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

/* 🔑 위치 인자만 받는다 — 그래도 모르는 `--` 낱말은 막는다. 판정은 `require.main` 블록 안에
 * 둔다(이 파일은 몸통이 최상위에서 돈다 · 회귀 ③-3). */
const 아는플래그 = [];
if (require.main === module) {
  const 플래그오류 = 인자게이트('자립형굽기', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(2); }
}
const 원본 = process.argv[2];
if (!원본) { console.error('쓰기: node tools/자립형굽기.js <원본.html> [나갈곳.html]'); process.exit(2); }
const 나갈곳 = process.argv[3] || 원본.replace(/\.html$/, '_자립형.html');
const 기준 = path.dirname(path.resolve(원본));

let s = fs.readFileSync(원본, 'utf8');
let 박음 = 0;
const 못찾음 = [];

// src="…" 와 url('…') 둘 다 — 이미 data: 인 것은 건드리지 않는다.
s = s.replace(/(src=|url\()\s*(['"]?)(?!data:|https?:)([^'")\s>]+\.(?:png|jpe?g|webp|gif|svg))\2/gi,
  (전체, 앞, 따옴, 경로) => {
    const 실경로 = path.resolve(기준, decodeURIComponent(경로));
    if (!fs.existsSync(실경로)) { 못찾음.push(경로); return 전체; }
    const mime = MIME[path.extname(실경로).toLowerCase()] || 'application/octet-stream';
    박음++;
    const uri = `data:${mime};base64,${fs.readFileSync(실경로).toString('base64')}`;
    return 앞 === 'url(' ? `url('${uri}'` : `src="${uri}"`;
  });

fs.writeFileSync(나갈곳, s, 'utf8');

// 분모와 함께 읽는다 — 「박았다」만으로는 반쪽을 못 가른다.
const 잔존 = (s.match(/(src=|url\()\s*['"]?(?!data:|https?:)[^'")\s>]+\.(?:png|jpe?g|webp|gif|svg)/gi) || []).length;
console.log(`${path.basename(나갈곳)} · ${(fs.statSync(나갈곳).size / 1048576).toFixed(2)} MB`);
console.log(`박은 이미지 ${박음}건 · 잔존 외부 참조 ${잔존}건`);
if (잔존) { console.error(`🔴 못 찾은 파일: ${못찾음.join(', ')}`); process.exit(1); }
console.log('✅ 외부 자원 0 — 어디서 열어도 같은 그림이다.');
