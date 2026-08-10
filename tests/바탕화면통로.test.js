/* 바탕화면 탐지의 **단 하나의 통로** 회귀 — `tools/lib/바탕화면.js`.
 *
 * 무엇을 지키나 (2026-08-10 분리 반박 패스 M3):
 *   같은 탐지가 세 파일에 흩어져 있었다 — 철학열람빌드·교재읽기본은 글자 단위 사본,
 *   운영자료는 PowerShell `GetFolderPath('Desktop')` 로 **다른 방식**. 회귀는 운영자료 쪽만
 *   물어서, OneDrive 리디렉션이 바뀌는 날 셋이 다른 폴더를 가리켜도 **아무 데도 안 빨갰다**.
 *   CLAUDE.md 신뢰성: 「3번째 = 원인을 쓸 수 없게 만든다」 — 그래서 호출부를 고치는 게 아니라
 *   **옛 통로를 테스트로 금지**한다(아래 「옛 통로 금지」 절).
 *
 * 분모: 이 파일이 지는 몫은 셋이다.
 *   ① 순수 로직(확장·후보사슬·찾기) — **픽스처가 탐지력을 진다**. 실기계 상태와 무관하다.
 *   ② 옛 통로 금지 — tools/ 안 소스를 실제로 훑는다(검사한 파일 수를 함께 낸다).
 *   ③ repo 밖(진짜 레지스트리·진짜 바탕화면) — CI 에선 **skip 으로 드러낸다**. fail 이 아니다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 통로경로 = path.join(__dirname, '..', 'tools', 'lib', '바탕화면.js');
const { 찾기, 경로, 확장, 후보사슬, 레지키 } = require('../tools/lib/바탕화면.js');

/* ── ① 순수 로직: 픽스처가 탐지력을 진다 ─────────────────────── */

test('확장: REG_SZ 와 REG_EXPAND_SZ 를 둘 다 뽑는다', () => {
  const sz = '\r\nHKEY_CURRENT_USER\\...\\User Shell Folders\r\n    Desktop    REG_SZ    C:\\Users\\q\\OneDrive\\Desktop\r\n\r\n';
  const exp = '    Desktop    REG_EXPAND_SZ    C:\\Users\\q\\OneDrive\\Desktop\r\n';
  assert.strictEqual(확장(sz, {}), 'C:\\Users\\q\\OneDrive\\Desktop');
  assert.strictEqual(확장(exp, {}), 'C:\\Users\\q\\OneDrive\\Desktop');
});

test('확장: %VAR% 를 이 프로세스 환경으로 편다', () => {
  const out = '    Desktop    REG_EXPAND_SZ    %USERPROFILE%\\OneDrive\\Desktop\r\n';
  assert.strictEqual(확장(out, { USERPROFILE: 'C:\\Users\\q1212' }), 'C:\\Users\\q1212\\OneDrive\\Desktop');
});

test('확장: 한글·공백이 든 경로가 깨지지 않는다', () => {
  // 읽는 층이 값을 깨뜨리는 자리다 — 운영자료의 CP949 오보(2026-08-09)와 같은 계열
  const out = '    Desktop    REG_SZ    C:\\Users\\q\\OneDrive\\바탕 화면\r\n';
  assert.strictEqual(확장(out, {}), 'C:\\Users\\q\\OneDrive\\바탕 화면');
});

test('확장: 못 뽑으면 조용히 빈 문자열이 아니라 null 이다', () => {
  // 빈 문자열을 주면 path.join 이 상대경로를 만들어 **엉뚱한 곳에 폴더가 생긴다**
  assert.strictEqual(확장('ERROR: 찾을 수 없습니다', {}), null);
  assert.strictEqual(확장('', {}), null);
  assert.strictEqual(확장(null, {}), null);
  assert.strictEqual(확장('    Desktop    REG_SZ    %없는변수%', {}), null, '전부 못 편 값은 후보가 아니다');
});

test('확장: 일부만 못 편 값은 루트 상대경로로 남지 않는다', () => {
  /* 🔴 `%없는변수%\Desktop` 을 빈 문자열로 갈음하면 `\Desktop` 이 된다 — Windows 에선 이것도
   * path.isAbsolute 가 true 라 「멀쩡한 절대경로」의 얼굴을 하고, 그 폴더가 있는 기계에서는
   * 엉뚱한 곳이 바탕화면이 된다(유호님 화면엔 안 보인다 — 08-09 사고의 재판). */
  assert.strictEqual(확장('    Desktop    REG_EXPAND_SZ    %없는변수%\\Desktop', { USERPROFILE: 'C:\\u' }), null);
  assert.strictEqual(확장('    Desktop    REG_EXPAND_SZ    %OneDrive%\\Desktop', { OneDrive: 'C:\\u\\od' }), 'C:\\u\\od\\Desktop');
});

test('후보사슬: 레지스트리 정본이 맨 앞이고, 그 다음이 OneDrive·홈이다', () => {
  const 사슬 = 후보사슬('R:\\정본', { OneDrive: 'O:\\od', USERPROFILE: 'U:\\up' }, 'H:\\home');
  assert.deepStrictEqual(사슬, ['R:\\정본', path.join('O:\\od', 'Desktop'), path.join('U:\\up', 'Desktop')]);
});

test('후보사슬: 정본이 없어도 사슬은 선다(그게 폴백이다)', () => {
  const 사슬 = 후보사슬(null, { OneDrive: 'O:\\od', USERPROFILE: 'U:\\up' }, 'H:\\home');
  assert.deepStrictEqual(사슬, [path.join('O:\\od', 'Desktop'), path.join('U:\\up', 'Desktop')]);
});

test('후보사슬: USERPROFILE 이 없으면 홈으로 떨어진다', () => {
  const 사슬 = 후보사슬(null, {}, 'H:\\home');
  assert.deepStrictEqual(사슬, [path.join('H:\\home', 'Desktop')]);
});

test('후보사슬: 같은 자리가 두 번 들어오면 접는다', () => {
  const 정본 = path.join('O:\\od', 'Desktop');
  assert.deepStrictEqual(후보사슬(정본, { OneDrive: 'O:\\od' }, ''), [정본]);
});

/* ⚠ `조회` 를 주입하지 않으면 아래 픽스처가 **이 기계의 진짜 레지스트리**를 읽어, 사슬 순서를
 * 재려던 검사가 기계마다 다른 답을 낸다(2026-08-10 실측 — 실제로 이 자리에서 빨개졌다).
 * repo 밖 환경에 기대는 검사는 CI 에서 깨진다: 탐지력은 픽스처가 지고, 실기계는 맨 아래 skip 절이 본다. */
const 정본없음 = { 조회: () => null };

test('찾기: USERPROFILE\\Desktop 이 실존해도 레지스트리 정본을 이긴다', () => {
  /* 🔴 이게 2026-08-09 실사고 그 자체다 — 껍데기 `USERPROFILE\Desktop` 은 Test-Path 가 True 라
   * 「맞게 썼다」로 읽혔다. 사슬 순서가 뒤집히면 여기서 빨개진다. */
  const 정본 = 'C:\\Users\\q\\OneDrive\\Desktop';
  const r = 찾기({
    조회: () => 정본,
    env: { OneDrive: 'C:\\Users\\q\\OneDrive', USERPROFILE: 'C:\\Users\\q' },
    실존: () => true, // 껍데기까지 전부 존재하는 최악의 판
  });
  assert.strictEqual(r.경로, 정본);
  assert.strictEqual(r.폴백, false, '정본을 골랐으면 폴백이 아니다');
  assert.strictEqual(r.존재, true);
});

test('찾기: 폴백을 쓰면 삼키지 않고 드러낸다(F044 — 실제로 일하는 건 폴백이다)', () => {
  const r = 찾기({ ...정본없음, env: { OneDrive: 'O:\\od' }, 실존: () => true });
  assert.strictEqual(r.경로, path.join('O:\\od', 'Desktop'));
  assert.strictEqual(r.폴백, true, '레지스트리 정본이 아닌 자리를 골랐으면 폴백이다');
  assert.strictEqual(r.존재, true);
});

test('찾기: 정본을 읽었어도 그 폴더가 없으면 다음 후보로 내려가고 폴백으로 표시한다', () => {
  const 정본 = 'R:\\사라진정본';
  const r = 찾기({
    조회: () => 정본,
    env: { OneDrive: 'O:\\od' },
    실존: (p) => p !== 정본,
  });
  assert.strictEqual(r.경로, path.join('O:\\od', 'Desktop'));
  assert.strictEqual(r.폴백, true);
});

test('찾기: 아무 후보도 실존하지 않으면 존재=false 이고 경로는 추측이다', () => {
  const r = 찾기({ ...정본없음, env: { OneDrive: 'O:\\od', USERPROFILE: 'U:\\up' }, 실존: () => false });
  assert.strictEqual(r.존재, false);
  assert.strictEqual(r.폴백, true);
  assert.strictEqual(r.후보.length, 2, '후보를 삼키지 않는다 — 사람이 어디를 봤는지 알아야 한다');
});

test('경로: 못 찾으면 조용히 추측하지 않고 던진다', () => {
  // 빌드 산출물이 「없는 곳」에 나가면 유호님 화면엔 아무것도 안 보인다 — 그때는 실패가 낫다
  assert.throws(
    () => 경로({ ...정본없음, env: { OneDrive: 'O:\\od' }, 실존: () => false }),
    /바탕화면을 못 찾았다/
  );
});

/* ── ② 옛 통로 금지: 원인을 쓸 수 없게 만든다 ─────────────────── */

const 금지들 = [
  { 이름: '레지스트리 직접 조회', 정규식: /User Shell Folders/ },
  { 이름: 'PowerShell GetFolderPath', 정규식: /GetFolderPath\(\s*['"]Desktop['"]\s*\)/ },
  { 이름: '환경변수로 바탕화면 조립', 정규식: /process\.env\.(?:OneDrive|USERPROFILE)[^\n]*['"]Desktop['"]/ },
];

test('금지 패턴이 실제로 문다 — 픽스처가 탐지력을 진다', () => {
  /* ⚠ 이 절이 없으면 정규식이 아무것도 못 물어도 아래 실저장소 검사는 **초록**이다.
   * 탐지력은 여기가 지고, 실저장소는 거짓양성만 본다(CLAUDE.md 가드 세 맹점 ②). */
  const 픽스처 = [
    "execFileSync('reg', ['query', 'HKCU\\\\...\\\\User Shell Folders', '/v', 'Desktop'])",
    "const p = ps(\"[Environment]::GetFolderPath('Desktop')\");",
    "const d = path.join(process.env.OneDrive, 'Desktop');",
  ];
  픽스처.forEach((소스, i) => {
    assert.match(소스, 금지들[i].정규식, `금지 ${금지들[i].이름} 이 자기 픽스처를 못 문다`);
  });
});

test('자기 처방이 이 가드를 통과한다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)', () => {
  /* 차단 사유가 시키는 그 코드를 가드에 되먹여 본다(CLAUDE.md 가드 세 맹점 ③).
   * 통과하지 못하면 사람은 가드를 끄는 쪽으로 간다. */
  const 처방대로 = [
    "const { 경로: 바탕화면 } = require('./lib/바탕화면.js');\nconst OUT = path.join(바탕화면(), 'SYNK 철학');",
    "const { 찾기 } = require('./lib/바탕화면.js');\nconst { 경로: 바탕, 폴백 } = 찾기();",
  ];
  for (const 소스 of 처방대로) {
    for (const 금지 of 금지들) {
      assert.doesNotMatch(소스, 금지.정규식, `처방한 코드가 「${금지.이름}」 에 걸린다 — 처방이나 정규식이 틀렸다`);
    }
  }
});

test('옛 통로 금지: tools/ 안에서 바탕화면을 직접 찾는 곳은 통로 하나뿐이다', () => {
  const TOOLS = path.join(__dirname, '..', 'tools');
  const js파일들 = (디렉터리) => {
    const 낸것 = [];
    for (const e of fs.readdirSync(디렉터리, { withFileTypes: true })) {
      const p = path.join(디렉터리, e.name);
      if (e.isDirectory()) 낸것.push(...js파일들(p));
      else if (e.name.endsWith('.js')) 낸것.push(p);
    }
    return 낸것;
  };

  const 대상 = js파일들(TOOLS).filter((p) => path.resolve(p) !== path.resolve(통로경로));
  assert.ok(대상.length > 20, `분모가 이상하다 — tools/ 에서 ${대상.length}개만 훑었다(미실행은 통과와 같은 모양이다)`);

  const 걸린것 = [];
  for (const 파일 of 대상) {
    const 소스 = fs.readFileSync(파일, 'utf8');
    for (const 금지 of 금지들) {
      if (금지.정규식.test(소스)) 걸린것.push(`${path.relative(TOOLS, 파일)} — ${금지.이름}`);
    }
  }
  assert.deepStrictEqual(
    걸린것,
    [],
    `바탕화면을 직접 찾는 사본이 ${걸린것.length}곳 있다(훑은 파일 ${대상.length}개).\n` +
      `→ 고치는 법: require('./lib/바탕화면.js') 의 \`경로()\`(없으면 던짐) 또는 \`찾기()\`(폴백을 드러냄)를 쓴다.\n` +
      '  ⚠ 주석에 옛 방식 이름만 적어도 문다 — 그게 다음 사본의 씨앗이다. 설명이 필요하면 통로 머리나 docs 에 쓴다.\n' +
      걸린것.map((s) => '  · ' + s).join('\n')
  );
});

test('레지키는 통로에만 산다 — 문자열이 둘이면 그게 다음 사본의 씨앗이다', () => {
  assert.match(fs.readFileSync(통로경로, 'utf8'), /User Shell Folders/, '통로 자신은 정본 조회를 해야 한다');
  assert.ok(레지키.endsWith('User Shell Folders'), '레지키가 export 되어야 사본을 안 적는다');
});

/* ── ③ 실행 검사: require 부작용 0 · 상수가 아님 ─────────────── */

test('require 부작용 0 — 부르는 것만으로 레지스트리를 조회하지 않는다', () => {
  /* 철학열람빌드 회귀가 이 모듈을 require 한다(`require 는 부작용 0` 규약).
   * 최상위에서 조회하면 CI 에서 reg 를 때리고, 그 실패가 회귀의 얼굴로 나온다. */
  const cp = require('node:child_process');
  const 원본 = cp.execFileSync;
  let 불렸나 = false;
  cp.execFileSync = (...a) => { 불렸나 = true; return 원본(...a); };
  try {
    delete require.cache[require.resolve('../tools/lib/바탕화면.js')];
    require('../tools/lib/바탕화면.js');
  } finally {
    cp.execFileSync = 원본;
  }
  assert.strictEqual(불렸나, false, 'require 만으로 자식 프로세스가 떴다 — 최상위 조회를 함수 안으로 넣어라');
});

test('찾기는 경로를 상수로 쓰지 않고 셸에 묻는다', (t) => {
  // 운영자료.test.js 가 지던 몫의 승계 — 검사 대상만 통로로 옮겼다(방식은 PowerShell → 레지스트리)
  if (process.platform !== 'win32') {
    t.skip('win32 아님 — 바탕화면 리디렉션은 Windows 셸 개념이다');
    return;
  }
  const cp = require('node:child_process');
  const 원본 = cp.execFileSync;
  let 물었나 = false;
  cp.execFileSync = (파일, 인자, ...나머지) => {
    if (파일 === 'reg') 물었나 = true;
    return 원본(파일, 인자, ...나머지);
  };
  try {
    delete require.cache[require.resolve('../tools/lib/바탕화면.js')];
    require('../tools/lib/바탕화면.js').찾기({ 실존: () => true });
  } finally {
    cp.execFileSync = 원본;
    delete require.cache[require.resolve('../tools/lib/바탕화면.js')];
  }
  assert.strictEqual(물었나, true, '경로를 상수로 쓰지 말고 셸에 물어야 한다');
});

/* ── repo 밖 환경: 재지 못하는 것은 skip 으로 드러낸다 ────────── */

test('이 기계의 바탕화면은 실제로 존재한다', (t) => {
  if (process.platform !== 'win32' || !process.env.USERPROFILE) {
    t.skip('win32/USERPROFILE 없음(CI) — 실경로는 실기계에서만 검증된다');
    return;
  }
  const r = 찾기();
  assert.strictEqual(r.존재, true, `바탕화면을 못 찾았다: ${r.후보.join(' | ')}`);
  assert.ok(fs.existsSync(r.경로));
});
