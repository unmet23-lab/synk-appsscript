'use strict';
// 렌즈 계획(11-25 유호님 「카메라감독한테 몇미리(렌즈mm) 이것도 설정하는게 있어야 좋으려나 … 색감 정할때 몇 mm로 장면 구성해갈지도」 → 「지금 해 줘」) —
//   컷표 맨 위 「렌즈」(편의 렌즈 묶음)와 컷마다 「앵글.렌즈」(T29), 이미지 지시문 FRAME 줄의 mm(--그림지시문). 정본: docs/마케팅/제작양식/영상양식/렌즈_계획.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 도구폴더 = path.join(뿌리, 'tools');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'print(1)'], { encoding: 'utf8' }).status === 0;
const 건너뜀 = !파이썬 && '파이썬 없음';

function 부르기(스크립트, 입력) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 컷연속성검사 as k\n' + 스크립트, 도구폴더],
    { input: JSON.stringify(입력), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const 앵글 = 'a = json.load(sys.stdin)\nprint(json.dumps([x for x in k.앵글검사(a["seq"], a.get("폴더")) if "렌즈" in x[2] or "mm" in x[2]], ensure_ascii=False))';
const 컷 = (cut, 크기, 렌즈, 덧 = {}) => ({ cut, 장면: '방', 인물: ['수아'], 앵글: { 크기, 높이: '눈높이', 방향: '비스듬히', 까닭: '까닭', ...(렌즈 === undefined ? {} : { 렌즈 }) }, ...덧 });
const 새날 = { 만든날: '2026-11-25' };

test('T29 렌즈 — 11-25부터 묶음과 컷 렌즈가 비면 걸림, 앞선 편 · 날짜 없는 편에는 묻지 않는다', { skip: 건너뜀 }, () => {
  const 빈 = 부르기(앵글, { seq: { 편: 새날, detail: [컷('C1', '허리 위'), 컷('C2', '클로즈', 50)] } });
  assert.equal(빈.length, 2, JSON.stringify(빈));
  assert.ok(빈.every(x => x[0] === '걸림' && x[1] === '표'));
  assert.match(빈[0][2], /맨 위 「렌즈」\(편의 렌즈 묶음\)가 없다/);
  assert.match(빈[1][2], /컷 1개\(C1\)에 「앵글\.렌즈」/);
  assert.deepEqual(부르기(앵글, { seq: { 편: { 만든날: '2026-11-24' }, detail: [컷('C1', '허리 위'), 컷('C2', '클로즈')] } }), [], '앞선 편');
  assert.deepEqual(부르기(앵글, { seq: { detail: [컷('C1', '허리 위')] } }), [], '날짜 없는 편');
  const 폴더 = 부르기(앵글, { seq: { detail: [컷('C1', '허리 위')] }, 폴더: path.join(os.tmpdir(), 'PULSE_시험_20261126') });
  assert.equal(폴더.length, 2, '폴더 이름의 날짜로도 읽는다');
});

test('T29 렌즈 — 묶음 밖 · 값 아님은 날짜대로, 넓은 렌즈 얼굴 · 같은 크기 갈림 · 렌즈 다섯은 주의', { skip: 건너뜀 }, () => {
  const 줄 = 부르기(앵글, { seq: { 편: { 만든날: '2026-11-26' }, 렌즈: [24, 50, 85], detail: [
    컷('C1', '넓게', 24), 컷('C2', '클로즈', 24), 컷('C3', '클로즈', 85, { 인물: ['민호'] }), 컷('C4', '가슴 위', 35),
    컷('C5', '클로즈', 24, { 장면: '길', 앵글: { 크기: '클로즈', 높이: '로우', 방향: '정면', 렌즈: 24, 까닭: '넓은 렌즈로 코가 커지는 웃음' } }),
    컷('C6', '극접', 100, { 인물: [] })] } });
  const 찾기 = (어디, 꼴) => 줄.find(x => x[1] === 어디 && 꼴.test(x[2]));
  assert.equal(찾기('C4', /35mm가 편의 렌즈 묶음\(24mm · 50mm · 85mm\)에 없다/)[0], '걸림');
  assert.equal(찾기('C6', /100mm가 편의 렌즈 묶음/)[0], '걸림', '사람 없는 컷도 묶음 안에서');
  assert.equal(찾기('C2', /얼굴 가까운 컷\(클로즈\)을 24mm로/)[0], '주의');
  assert.equal(찾기('C5', /얼굴 가까운 컷/), undefined, '까닭에 「넓은 렌즈」를 적으면 일부러로 본다');
  assert.equal(찾기('표', /장면 「방」의 클로즈 사람 컷이 렌즈 2개로 갈린다\(24mm C2 \/ 85mm C3\)/)[0], '주의', '맞받는 두 얼굴');
  assert.equal(찾기('표', /장면 「길」/), undefined, '장면이 다르면 견주지 않는다');
  const 옛 = 부르기(앵글, { seq: { 렌즈: [3, 18, 24, 35, 50, 85], detail: [컷('C1', '허리 위', 900), 컷('C2', '넓게', 18)] } });
  assert.ok(옛.find(x => x[1] === '표' && /3mm는 렌즈 값으로 읽히지 않는다/.test(x[2]) && x[0] === '주의'));
  assert.ok(옛.find(x => x[1] === 'C1' && /900mm는 렌즈 값으로/.test(x[2]) && x[0] === '주의'), '날짜 없는 편의 틀린 값은 주의');
  assert.ok(옛.find(x => /렌즈 묶음이 6개다/.test(x[2])), "렌즈가 다섯을 넘으면 주의");
  assert.equal(옛.filter(x => x[1] === 'C1').length, 1, '값이 아닌 렌즈는 묶음과 견주지 않는다');
});

test('이미지 지시문 렌즈 — FRAME 줄에 컷표 mm 하나만, 판형 mm는 세지 않고, 끝 그림은 주의', { skip: 건너뜀 }, () => {
  const 판 = 'a = json.load(sys.stdin)\nprint(json.dumps([k.렌즈지시문검사(a["seq"], a["d"], c, g) for c, g in a["글"]], ensure_ascii=False))';
  const d = 컷('C2', '클로즈', 50);
  const 글 = [
    ['C2', 'FRAME: close-up, 50mm lens, 0.8 m away, her face fills 40% of the width.'],
    ['C2', 'A 1980s colour film photograph shot on a 35mm compact camera, 35mm film grain.\nFRAME: close-up, 50 mm lens.'],
    ['C2', 'A photograph shot on a Leica with a 35mm lens.\nFRAME: close-up, 50mm lens.'],
    ['C2', 'FRAME: close-up at 0.8 m.'],
    ['C2', 'FRAME: close-up, 85mm lens.'],
    ['C2_끝', 'FRAME: close-up, 85mm lens.'],
  ];
  const 값 = 부르기(판, { seq: { 편: 새날 }, d, 글 });
  assert.deepEqual(값[0], []);
  assert.deepEqual(값[1], [], '35mm film · 35mm compact camera는 판형이다');
  assert.match(값[2][0][1], /컷표 렌즈 50mm 말고 35mm가 있다/);
  assert.match(값[3][0][1], /FRAME 줄에 컷표 렌즈 50mm가 없다/);
  assert.equal(값[4].length, 1, 'FRAME이 다른 mm면 한 줄로');
  assert.match(값[4][0][1], /지시문의 렌즈 85mm가 컷표 렌즈 50mm와 다르다/);
  assert.ok([2, 3, 4].every(i => 값[i][0][0] === '걸림'));
  assert.equal(값[5][0][0], '주의', '끝 그림은 줌으로 렌즈가 바뀌는 컷이 있다');
  const 옛 = 부르기(판, { seq: { 편: { 만든날: '2026-11-24' } }, d, 글: [글[4]] });
  assert.equal(옛[0][0][0], '주의', '앞선 편은 주의');
  const 없음 = 부르기(판, { seq: { 편: 새날 }, d: 컷('C2', '클로즈'), 글: [글[4]] });
  assert.deepEqual(없음[0], [], '컷표에 렌즈가 없으면 T29가 묻는다');
});

test('--그림지시문으로 부르면 (렌즈) 줄이 그 컷의 그림지시문 항목에 든다', { skip: 건너뜀 }, () => {
  const 편 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lens-'));
  try {
    const 표 = { 틀: 2, 편: 새날, 렌즈: [35, 50], 장면: { 방: { 장소: 'a small room', 빛: 'window light' } }, 인물: {},
      detail: [컷('C1', '넓게', 35, { 인물: [] }), 컷('C2', '극접', 50, { 인물: [] })] };
    fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify(표));
    fs.mkdirSync(path.join(편, '이미지지시문'));
    fs.writeFileSync(path.join(편, '이미지지시문', 'C1.txt'), 'SETTING: a small room\nLIGHT: window light\nFRAME: wide shot, 35mm lens, 4 m away.\n');
    fs.writeFileSync(path.join(편, '이미지지시문', 'C2.txt'), 'SETTING: a small room\nLIGHT: window light\nFRAME: extreme close-up, 85mm lens.\n');
    const r = spawnSync('python', ['-I', '-X', 'utf8', path.join(도구폴더, '컷연속성검사.py'), path.join(편, '컷표.json'), '--그림지시문', path.join(편, '이미지지시문'), '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 24 });
    assert.ok(r.stdout.includes('(렌즈)'), r.stdout.slice(0, 2000) + r.stderr.slice(-1000));
    const 줄 = JSON.parse(r.stdout).filter(x => String(x.글).includes('(렌즈)'));
    assert.equal(줄.length, 1, JSON.stringify(줄));
    assert.deepEqual([줄[0].항목, 줄[0].컷, 줄[0].등급], ['그림지시문', 'C2', '걸림']);
    assert.match(줄[0].글, /85mm가 컷표 렌즈 50mm와 다르다/);
  } finally { fs.rmSync(편, { recursive: true, force: true }); }
});

test('렌즈 계획 — 아홉 컨셉의 출발 묶음이 둘~넷이고, 지시문 틀 FRAME 줄과 컷표 틀이 렌즈 칸을 쓴다', () => {
  const 읽기 = p => fs.readFileSync(path.join(뿌리, p), 'utf8').replace(/\r\n/g, '\n');
  const 계획 = 읽기('docs/마케팅/제작양식/영상양식/렌즈_계획.md');
  const 절 = /^## 컨셉마다[^\n]*\n([\s\S]*?)(?=^## )/m.exec(계획)[1];
  for (const 컨셉 of ['코믹', 'B급', '멜로', '감동', '비주얼', '스펙터클', '스릴러', '뮤직', '홍보']) {
    const 칸 = 절.split('\n').map(z => z.split('|').map(x => x.trim())).find(k => k[1] === 컨셉);
    assert.ok(칸, `${컨셉} 줄이 없다`);
    const 수 = 칸[2].split('·').map(x => Number(x.trim()));
    assert.ok(수.length >= 2 && 수.length <= 4 && 수.every(n => n >= 8 && n <= 400), `${컨셉}: ${칸[2]}`);
  }
  assert.match(읽기('docs/마케팅/제작양식/영상양식/지시문_틀.md'), /`FRAME:` 컷표 `구도` \+ `앵글\.렌즈` mm\(이 줄에만\)/);
  const 틀 = JSON.parse(읽기('docs/마케팅/제작양식/영상양식/컷표_틀.json'));
  assert.ok(Array.isArray(틀.렌즈) && 틀.detail.every(d => 틀.렌즈.includes(d.앵글.렌즈)));
  assert.match(틀.읽는법, /렌즈_계획\.md/);
});
