// 공개본(synk-policy 8ef6b67)의 계정 묶음에 Fable 배포 뒤 검수 P2-1·P2-2·P2-3과 같은 줄의 P3-2·P3-3을 문자열 값으로 얹는다.
// master는 SYNK-appsscript(platform.mjs·applications.mjs) 같은 글. 자리마다 정한 횟수만큼 있어야 바꾸고, platform.html의 ?v=도 맞춘다.
// node patch-strings-2.cjs <바탕 폴더> <후보 폴더> — 바탕은 공개본 account__dist__platform.js·account__platform.html(8ef6b67 바이트 그대로).
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [baseArg, outArg] = process.argv.slice(2);
if (!baseArg || !outArg) throw Error('node patch-strings-2.cjs <바탕 폴더> <후보 폴더>');
const base = path.resolve(baseArg), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const sha12 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const edits = [
  ['"회사에서 초대받은 계정으로 써요"', '"회사 초대를 받은 계정이나 반을 맡은 교사 계정으로 써요"', 1],
  ['"회사 초대를 받은 계정으로 로그인해요. SYNK ID만으로는 들어갈 수 없어요."', '"회사 일은 회사 초대를 받은 계정으로, 내 수업은 반을 맡은 교사로 등록된 SYNK ID로 로그인해요. 가입만 한 SYNK ID로는 들어갈 수 없어요."', 1],
  ['"회사에서 안내받은 Workspace 주소로 열어요."', '"회사에서 안내받은 Workspace 주소로 열어요. 교사는 같은 주소의 「내 수업」으로 들어가요."', 1],
  ['"회사 초대 필요"', '"회사 초대·교사 등록 필요"', 2],
  ['"학원 교사 권한과 회사 직원 권한은 따로 받아요."', '"교사 권한과 회사 직원 권한은 따로 받아요."', 1],
  ['<ul class="feature-list"><li><strong>미니게임</strong>', '<ul class="feature-list"><li><strong>TOPIK 준비</strong><span>TOPIK I 짧은 진단으로 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.</span></li><li><strong>미니게임</strong>', 1],
  ['keywords:["레이싱","리듬","주문 폭주","바람길","싱크 타운"]', 'keywords:["한글 만나기","바람길","리듬","TOPIK","싱크 타운"]', 1],
  ['name:"SYNK Workspace",category:"work",subtitle:', 'name:"SYNK Workspace",category:"work",keywords:["메신저","사내 메신저","Workspace"],subtitle:', 1],
  // P2-2 계정 라이브러리 모듈 이름표(master platform-library-view.mjs와 같은 값, partners는 공개본 처리가 달라 그대로)
  ['messenger:"메신저",teacher:"교사"', 'messenger:"Workspace",teacher:"Workspace 내 수업"', 1],
];
let s = fs.readFileSync(path.join(base, 'account__dist__platform.js'), 'utf8');
const before = sha12(fs.readFileSync(path.join(base, 'account__dist__platform.js')));
for (const [a, b, count] of edits) { const c = s.split(a).length - 1; if (c !== count) throw Error('expected ' + count + ' of ' + a.slice(0, 50) + ', found ' + c); s = s.split(a).join(b); }
fs.writeFileSync(path.join(out, 'account__dist__platform.js'), s);
const after = sha12(Buffer.from(s, 'utf8'));
let html = fs.readFileSync(path.join(base, 'account__platform.html'), 'utf8');
const from = './dist/platform.js?v=' + before, to = './dist/platform.js?v=' + after;
if (html.split(from).length !== 2) throw Error('platform.html ?v= anchor ' + from);
fs.writeFileSync(path.join(out, 'account__platform.html'), html.replace(from, to));
console.log(JSON.stringify({ before, after, edits: edits.length }));
