// 공개본 계정 묶음(synk.im/account/dist/platform.js)에 PATH 면접 연습 주소 상수 선언 한 줄만 얹는다 — 2026-10-31.
//   node patch-live.cjs <바탕 폴더> <후보 폴더>
// 바탕은 공개본 account__dist__platform.js·account__platform.html 바이트 그대로(../library-modules-live-20261022/patch-live.cjs 받기).
// 공개본 회원 성향의 openInsightActivity는 PATH_INTERVIEW_URL을 쓰는데(synk-policy 12b1a30부터), 공개본 applications 모듈은
// 옛 판이라 선언이 없다. master applications.mjs는 APPLICATIONS 바로 앞에 `export const PATH_INTERVIEW_URL = …`을 두므로,
// esbuild가 지을 꼴(`var PATH_INTERVIEW_URL="…";`)을 같은 자리(`var APPLICATIONS=` 앞)에 넣는다. master로 다시 묶지 않는다
// (남의 미공개 기능이 나간다 — 현장 노트 배포_공개 「공개본 account/dist/platform.js를 master 빌드로 덮으면…」).
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const L = require('../library-modules-live-20261022/live-modules.cjs');
const [baseArg, outArg] = process.argv.slice(2);
if (!baseArg || !outArg) throw Error('node patch-live.cjs <바탕 폴더> <후보 폴더>');
const base = path.resolve(baseArg), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const sha12 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const NAME = 'PATH_INTERVIEW_URL', URL_ = 'https://synk.im/path/interview/film/rehearsal.html';
const ANCHOR = 'init_core();var APPLICATIONS=Object.freeze([';
const INSERT = `var ${NAME}=${JSON.stringify(URL_)};`;
const count = (s, a) => s.split(a).length - 1;
const assert = (ok, msg) => { if (!ok) throw Error(msg); };

const liveBuf = fs.readFileSync(path.join(base, 'account__dist__platform.js')), live = liveBuf.toString('utf8');
// 1) 공개본 상태: 이름은 한 번(쓰는 자리)만 나오고 선언 없이 쓰인다. 넣을 자리는 하나. 같은 주소의 다른 쓰임은 글자로 박힌 두 곳.
assert(count(live, NAME) === 1, `${NAME} 쓰임이 1이 아니다: ${count(live, NAME)}`);
assert(count(live, ANCHOR) === 1, `넣을 자리가 1이 아니다: ${count(live, ANCHOR)}`);
const before = L.globalsOf(live);
assert(before.has(NAME), `${NAME}이 이미 선언돼 있다 — 고칠 일이 없다`);
const liveDeclared = L.statements(live).flatMap(st => st.declared);
assert(!liveDeclared.includes(NAME), `${NAME}을 선언한 최상위 문장이 이미 있다`);

// 2) 얹기
const cand = live.replace(ANCHOR, 'init_core();' + INSERT + 'var APPLICATIONS=Object.freeze([');
assert(cand.length === live.length + INSERT.length && cand.replace(INSERT, '') === live, '넣은 한 줄 말고 다른 바이트가 바뀌었다');

// 3) 후보 확인: 최상위 문장으로 한 번 선언, 쓰는 함수보다 앞, 전역 참조는 그 이름 하나만 빠진다.
const list = L.statements(cand);
const declIdx = list.findIndex(st => st.declared.includes(NAME)), useIdx = list.findIndex(st => st.declared.includes('openInsightActivity'));
assert(list.filter(st => st.declared.includes(NAME)).length === 1 && declIdx >= 0 && useIdx > declIdx, `선언 자리 ${declIdx} · 쓰는 함수 ${useIdx}`);
assert(list.length === L.statements(live).length + 1, '최상위 문장 수가 하나 늘지 않았다');
const after = L.globalsOf(cand);
const removed = [...before].filter(n => !after.has(n)), added = [...after].filter(n => !before.has(n));
assert(removed.length === 1 && removed[0] === NAME && added.length === 0, `전역 참조 차이 — 빠짐 ${removed} · 새로 ${added}`);
fs.writeFileSync(path.join(out, 'account__dist__platform.js'), cand);

// 4) 페이지의 ?v=(묶음 sha256 앞 12자)
const from = sha12(liveBuf), to = sha12(Buffer.from(cand, 'utf8'));
const html = fs.readFileSync(path.join(base, 'account__platform.html'), 'utf8');
const vFrom = './dist/platform.js?v=' + from, vTo = './dist/platform.js?v=' + to;
assert(count(html, vFrom) === 1, 'platform.html ?v= 자리 ' + vFrom);
fs.writeFileSync(path.join(out, 'account__platform.html'), html.replace(vFrom, vTo));

const report = { bytes: { before: liveBuf.length, after: Buffer.byteLength(cand) }, v: { before: from, after: to }, inserted: INSERT, declaredStatement: declIdx, openInsightActivityStatement: useIdx,
  globals: { before: before.size, after: after.size, removed, added } };
fs.writeFileSync(path.join(out, 'patch-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
