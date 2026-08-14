/**
 * 원시 제어문자(C0·DEL)는 추적 파일에도 커밋 메시지에도 들어가지 않는다 — F454 처방.
 *
 * 왜 기계로 막나: 2026-08-15 한 세션에서 **세 번** 났고 세 번째는 신고문 자신 안이었다.
 * 원시 0x01 은 화면에서 폭이 0이라 눈으로 안 보이고, `cat -v` 로 «찾으러 가야» 보인다.
 * 실피해가 0이었던 이유는 매번 찾으러 갔기 때문이라 그건 사람 손이다(철학 ㉡).
 *
 * 🔑 **탐지력은 픽스처가 진다.** 실저장소는 지금 0건이라(2026-08-15 실측 · 텍스트 1,137개)
 *   거짓양성밖에 못 잰다 — 위반이 없으면 검사가 죽어도 초록이다(CLAUDE.md 맹점 ②).
 *
 * ⚠ **이 파일에도 그 바이트를 적지 않는다** — 적으면 이 검사가 자기 소스에 걸린다.
 *   픽스처는 전부 `Buffer.from([바이트])` 로 «만들어» 쓴다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 훅띄우기 } = require('./lib/훅띄우기.js');

const ROOT = path.join(__dirname, '..');
const 검사기 = path.join(ROOT, 'tools', '제어문자검사.js');

/* 🔑 판정(금지 바이트 · 대상 확장자 · 자리 표기)은 **여기 없다** — `tools/제어문자검사.js`
 *   하나가 진다. 같은 판정을 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 「통과」다. */
const { 걸린줄, 대상인가, 대상확장자, 금지바이트인가 } = require('../tools/제어문자검사.js');

/** 금지 바이트 전량 — C0 에서 탭·개행·복귀만 뺀 것 + DEL. 손으로 안 적고 «만든다». */
const 금지전량 = [];
for (let b = 0x00; b <= 0x1f; b++) if (b !== 0x09 && b !== 0x0a && b !== 0x0d) 금지전량.push(b);
금지전량.push(0x7f);

function 추적파일(뿌리) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: 뿌리, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean).filter(대상인가);
}

/* 검사기를 통로 끝까지 밟는다 — `{코드, 출력}`. 종료코드 0/1/2 가 계약이다.
 *
 * 🔑 `spawnSync` 를 직접 안 쓴다 — 공용 통로 `tests/lib/훅띄우기.js` 가 「프로세스가 못 떴다」를
 *   결과로 번역하는 것을 막는다. 통과를 기대하는 검사(거짓양성 묶음)는 검사기가 안 떠도 **초록**이라
 *   그 구멍이 조용하다. `tests/훅통로.test.js` 가 옛 형태를 저장소째로 금지한다.
 * ⚠ 통과코드를 0/1/2 로 넓힌다 — 이 도구는 종료코드 «자체»가 계약이다(0 깨끗 · 1 걸림 · 2 미실행).
 * ⚠ `execFileSync` 도 안 된다 — 그건 **stdout 만** 돌려주는데 이 도구는 전부 stderr 로 쓴다.
 *   그러면 통과 경로에서 출력이 늘 빈 문자열이라 「분모를 말하나」를 원리상 못 잰다(재는 층이
 *   값을 깨뜨리는 자리다 — 실제로 이 회귀가 그걸 먼저 잡았다). */
function 돌린다(뿌리, 인자 = []) {
  const r = 훅띄우기([검사기, ...인자],
    { cwd: 뿌리, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], 통과코드: [0, 1, 2] });
  return { 코드: r.status, 출력: String(r.stderr || '') + String(r.stdout || '') };
}

/** 1회용 git 저장소. */
function 픽스처저장소(이름, 채우기) {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), `synk-제어문자-${이름}-`));
  execFileSync('git', ['init', '-q'], { cwd: 사본 });
  execFileSync('git', ['config', 'user.email', 'x@x'], { cwd: 사본 });
  execFileSync('git', ['config', 'user.name', 'x'], { cwd: 사본 });
  채우기(사본);
  return 사본;
}

/* ── 실저장소 — 거짓양성만 잰다(위반이 0이라 탐지력은 못 잰다) ────────────────── */

test('저장소 추적 텍스트에 원시 제어문자가 없다', () => {
  const 파일들 = 추적파일(ROOT);
  /* 🔴 **0건과 「아무것도 안 봤다」가 같은 모양이다** — 분모를 먼저 못박는다(F207).
   *   실측 2026-08-15 = 1,137개. 절반 아래로 떨어지면 그건 깨끗해진 게 아니라 검사가 죽은 것이다. */
  assert.ok(파일들.length > 500,
    `대상 파일이 ${파일들.length}개뿐이다 — 검사가 아무것도 안 본 채 통과할 뻔했다(실측 08-15 = 1,137)`);
  const 걸린곳 = [];
  for (const f of 파일들) {
    let buf;
    try { buf = fs.readFileSync(path.join(ROOT, f)); } catch { continue; }
    걸린곳.push(...걸린줄(f, buf));
  }
  assert.deepStrictEqual(걸린곳, [],
    '원시 제어문자를 지우고 이스케이프 표기로 쓴다 — 자리는 `node tools/제어문자검사.js` 가 낸다');
});

/* ── 탐지력 — 픽스처가 진다 ─────────────────────────────────────────────── */

test('탐지력 — 금지 바이트 30종을 하나도 안 놓친다', () => {
  for (const b of 금지전량) {
    assert.ok(금지바이트인가(b), `판정이 못 잡는다: 0x${b.toString(16)}`);
    const buf = Buffer.concat([Buffer.from('앞 ', 'utf8'), Buffer.from([b]), Buffer.from(' 뒤\n', 'utf8')]);
    const 잡힌것 = 걸린줄('x.md', buf);
    assert.strictEqual(잡힌것.length, 1, `본문에서 못 잡는다: 0x${b.toString(16)}`);
    assert.match(잡힌것[0], new RegExp(`U\\+${b.toString(16).padStart(4, '0').toUpperCase()}$`),
      `코드포인트 표기가 틀리다: ${잡힌것[0]}`);
  }
  assert.strictEqual(금지전량.length, 30, '금지 목록의 크기가 바뀌었다 — 의도한 변경인지 확인한다');
});

test('거짓양성 — 탭·개행·복귀와 실제로 쓰는 글자는 안 잡는다', () => {
  for (const b of [0x09, 0x0a, 0x0d]) {
    assert.ok(!금지바이트인가(b), `허용 바이트를 잡는다: 0x${b.toString(16)}`);
  }
  const 멀쩡한것 = [
    '한글 본문입니다\n\t들여쓴 줄\r\n',
    'Latin text 123 · const a = 1;\n',
    'Монгол хэл · Өө Үү\n',
    '기호 ₮ № → ✅ 🔴 ─ ⓐ «인용»\n',
  ];
  for (const s of 멀쩡한것) {
    assert.deepStrictEqual(걸린줄('x.md', Buffer.from(s, 'utf8')), [], `거짓양성: ${JSON.stringify(s)}`);
  }
});

/* 🔑 **양방향의 반대쪽** — F454 의 처방을 그대로 따른 글은 초록이어야 한다. 이게 빨개지면
 *   그 가드는 「따를 수 없는 처방」을 내미는 것이고, 그런 가드는 우회를 정상 통로로 만든다(F103). */
test('처방을 따른 글은 통과한다 — 이스케이프 표기는 그냥 ASCII 다', () => {
  const 처방대로 = '구분자는 `\\u0001` 로 둔다(원시 바이트를 적지 않는다 · U+0001).\n';
  assert.deepStrictEqual(걸린줄('docs/버전_이력.md', Buffer.from(처방대로, 'utf8')), []);
});

test('자리를 줄:칸으로 정확히 짚는다 — 폭 0이라 이것 말고는 찾을 길이 없다', () => {
  const buf = Buffer.concat([
    Buffer.from('첫 줄\n둘째 줄 시작', 'utf8'),
    Buffer.from([0x01]),
    Buffer.from('끝\n', 'utf8'),
  ]);
  const 잡힌것 = 걸린줄('a.md', buf);
  assert.strictEqual(잡힌것.length, 1);
  /* 칸은 **바이트** 기준이다 — 한글이 3바이트라 글자 수와 다르다. 그래도 `cat -v` 가 세는 것과
   * 같으므로 찾아가는 데 쓸 수 있고, 문자 기준으로 바꾸면 깨진 바이트열에서 자리가 밀린다. */
  assert.match(잡힌것[0], /^a\.md:2:\d+ {2}U\+0001$/, `자리 표기가 틀리다: ${잡힌것[0]}`);
});

/* ── 면제 — 없다. 옆 옛글자 규칙의 면제를 물려받으면 사고 자리가 영영 안 잡힌다 ──────── */

test('면제를 물려받지 않는다 — 장부·인계문도 대상이다(F454 세 번째가 그 자리였다)', () => {
  const 옛 = require('../tools/lib/옛글자.js');
  for (const p of ['docs/_ops/장부/F454.md', 'docs/_ops/인계문/abcd1234.md', 'evals/출력_v2재시도.json']) {
    assert.ok(!옛.대상인가(p), `전제가 깨졌다 — 옛글자 면제 목록에서 빠졌다: ${p}`);
    assert.ok(대상인가(p),
      `제어문자 검사가 «면제»를 물려받았다: ${p} — 신고문은 이스케이프로 쓰지 원시 바이트를 안 적는다`);
  }
});

test('대상 밖 확장자는 애초에 안 연다 — 이미지·폰트는 제어문자가 내용 그 자체다', () => {
  for (const p of ['a.png', 'b.mp4', 'c.ttf', 'd.pdf', 'e.glb']) {
    assert.ok(!대상인가(p), `바이너리를 대상으로 잡는다: ${p}`);
  }
  assert.ok(대상확장자.has('.ts'), '.ts 가 빠지면 형제 저장소 Edge Function 전량이 대상 밖이다(신뢰성 ③)');
});

/* 🔴 **가드가 자기 배선을 본다.** 첫 커밋 실측에서 5개를 담았는데 게이트는 「3개를 열었다」고
 *   말했고, 빠진 둘이 이 검사를 «등록하는» 훅 자신이었다(셸 스크립트라 확장자가 없다).
 *   그 자리에 원시 바이트가 박히면 훅이 깨지는데 정작 이 검사는 못 본다. */
test('확장자 없는 파일도 본다 — 특히 이 가드를 등록하는 훅 자신', () => {
  for (const p of ['tools/githooks/pre-commit', 'tools/githooks/commit-msg',
    'tools/githooks/prepare-commit-msg', '.gitignore', 'LICENSE', 'Makefile']) {
    assert.ok(대상인가(p), `확장자 없는 텍스트를 안 연다: ${p} — 가드가 자기 배선에 눈이 먼다`);
  }
});

/* ── 통로 끝까지 — 정규식이 잡는 것과 «검사가» 잡는 것은 다르다 ──────────────── */

test('탐지력 — 픽스처 저장소의 스테이징분을 통로 끝까지 밟아 잡는다', () => {
  const 사본 = 픽스처저장소('통로', (뿌리) => {
    const 더러운것 = Buffer.concat([
      Buffer.from("const 구분자 = '", 'utf8'), Buffer.from([0x01]), Buffer.from("';\n", 'utf8'),
    ]);
    fs.writeFileSync(path.join(뿌리, '엔진 수집.js'), 더러운것);          // 한글·공백 경로(-z 통로)
    fs.writeFileSync(path.join(뿌리, '깨끗한 문서.md'), '한글 · Latin · Монгол\n', 'utf8');
    fs.writeFileSync(path.join(뿌리, '그림.bin'), Buffer.from([0x01, 0x02, 0x0a]));  // 대상 밖 확장자
    execFileSync('git', ['add', '엔진 수집.js', '깨끗한 문서.md', '그림.bin'], { cwd: 뿌리 });
  });
  try {
    const { 코드, 출력 } = 돌린다(사본, ['--cached']);
    assert.strictEqual(코드, 1, `커밋을 막았어야 한다:\n${출력}`);
    assert.match(출력, /엔진 수집\.js:1:\d+ {2}U\+0001/, `한글 경로를 그대로 못 짚었다:\n${출력}`);
    assert.doesNotMatch(출력, /그림\.bin/, `대상 밖 확장자를 열었다:\n${출력}`);
    assert.doesNotMatch(출력, /깨끗한 문서\.md/, `거짓양성:\n${출력}`);
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

/* 🔑 **작업본이 아니라 인덱스를 본다**(F302) — `git add` 뒤에 작업본만 고치면 커밋되는 바이트는
 *   여전히 더럽다. 작업본을 보는 검사는 그 커밋을 통과시킨다. */
test('작업본을 고쳐도 인덱스가 더러우면 막는다', () => {
  const 사본 = 픽스처저장소('인덱스', (뿌리) => {
    fs.writeFileSync(path.join(뿌리, 'a.md'),
      Buffer.concat([Buffer.from('앞', 'utf8'), Buffer.from([0x01]), Buffer.from('뒤\n', 'utf8')]));
    execFileSync('git', ['add', 'a.md'], { cwd: 뿌리 });
    fs.writeFileSync(path.join(뿌리, 'a.md'), '앞뒤\n', 'utf8');          // 작업본만 깨끗해졌다
  });
  try {
    assert.strictEqual(돌린다(사본, ['--cached']).코드, 1, '작업본을 보고 통과시켰다 — 인덱스를 봐야 한다');
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

test('깨끗한 스테이징은 통과하고, 분모를 말한다', () => {
  const 사본 = 픽스처저장소('깨끗', (뿌리) => {
    fs.writeFileSync(path.join(뿌리, 'a.md'), '한글 · Latin · Монгол\n', 'utf8');
    execFileSync('git', ['add', 'a.md'], { cwd: 뿌리 });
  });
  try {
    const { 코드, 출력 } = 돌린다(사본, ['--cached']);
    assert.strictEqual(코드, 0, 출력);
    assert.match(출력, /1개 파일을 열었다/, `몇 개를 열었는지 안 말한다 — 미실행과 통과가 같은 모양이 된다:\n${출력}`);
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

/* ── 커밋 메시지 — 되돌릴 수 없는 자리다(F454 사고 ②) ─────────────────────── */

test('탐지력 — 커밋 메시지 본문의 원시 바이트를 잡는다', () => {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-제어문자-메시지-'));
  try {
    const 메시지 = path.join(사본, 'MSG');
    fs.writeFileSync(메시지, Buffer.concat([
      Buffer.from('fix: 구분자를 ', 'utf8'), Buffer.from([0x01]), Buffer.from(' 로 둔다\n', 'utf8'),
    ]));
    const { 코드, 출력 } = 돌린다(ROOT, ['--메시지', 메시지]);
    assert.strictEqual(코드, 1, `메시지를 통과시켰다 — 커밋되면 되돌릴 수 없다:\n${출력}`);
    assert.match(출력, /커밋 메시지/, 출력);
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

/* git 이 붙이는 안내 주석은 커밋에 **안 들어간다** — 그걸 잡으면 따를 수 없는 처방이 된다(F103). */
test('거짓양성 — 메시지의 `#` 주석줄은 커밋에 안 들어가므로 안 잡는다', () => {
  const 사본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-제어문자-주석-'));
  try {
    const 메시지 = path.join(사본, 'MSG');
    fs.writeFileSync(메시지, Buffer.concat([
      Buffer.from('fix: 깨끗한 제목\n\n# 아래는 git 안내다 ', 'utf8'),
      Buffer.from([0x01]), Buffer.from('\n', 'utf8'),
    ]));
    const { 코드, 출력 } = 돌린다(ROOT, ['--메시지', 메시지]);
    assert.strictEqual(코드, 0, `주석줄을 잡았다 — 그건 커밋에 안 들어간다:\n${출력}`);
  } finally {
    fs.rmSync(사본, { recursive: true, force: true, maxRetries: 3 });
  }
});

/* ── 배선 — 스스로 발화하지 않는 장치는 안 돈다(F044 계열) ──────────────────── */

test('배선 — pre-commit 과 commit-msg 원본이 이 검사를 부른다', () => {
  const 훅 = (이름) => fs.readFileSync(path.join(ROOT, 'tools', 'githooks', 이름), 'utf8');
  assert.match(훅('pre-commit'), /제어문자검사\.js" --cached/,
    'pre-commit 이 이 검사를 안 부른다 — 판정만 있고 발동 조건이 없으면 안 도는 장치다');
  assert.match(훅('commit-msg'), /제어문자검사\.js" --메시지/,
    'commit-msg 가 이 검사를 안 부른다 — 커밋 메시지는 되돌릴 수 없는 자리다');
});
