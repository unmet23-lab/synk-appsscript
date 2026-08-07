/* 훅 회귀는 「훅이 안 돌았다」를 「통과」로 읽으면 안 된다 — 옛 통로 금지 (2026-08-07)
 *
 * 실사고: 자격증명가드 회귀가 전량 실행에서 「비밀이 페이지로 나갔다」로 빨개졌다. 실제로는 훅
 *   프로세스가 못 떴고, 그때 stdout 이 비어서 도우미가 그것을 「훅이 보고 그냥 뒀다」로 읽었다.
 *   그 파일 하나만 고쳤지만 **같은 형태가 훅 회귀 전반에 복제돼 있었다**(실측 18파일·29자리).
 *
 * 🔴 이 결함의 나쁜 절반은 **조용하다.** 차단을 기대하는 검사는 훅이 안 뜨면 빨개져 눈에 띈다.
 *   그런데 통과를 기대하는 검사(거짓양성 검문)는 훅이 안 떠도 **초록**이다. 즉 스위트가
 *   「가드가 산다」를 증명한 적 없이 초록을 낸다 — 통과와 미실행이 같은 모양이면 안 된다.
 *
 * 그래서 판정을 `tests/lib/훅띄우기.js` 한 곳으로 모으고, 여기서 **옛 통로를 금지**한다.
 *   규칙은 파일 단위다 — 훅 경로를 푸는 회귀 파일은 `spawnSync(process.execPath …)` 를 직접
 *   쓰지 않는다. 자리 단위로 좁히면 훅을 **인자로 받는** 도우미가 통째로 사각이 된다(실측:
 *   컨텍스트예산.test.js 의 `run(hook, …)` 가 그 모양이라 첫 판 스캐너가 못 봤다).
 *
 * 검사 구조 — 탐지력은 **픽스처**로 못박고, 실저장소에는 **거짓양성만** 묻는다(CLAUDE.md 맹점②).
 *   실저장소를 「위반이 아직 있어야 통과」로 쓰면 고치는 순간 회귀가 죽는다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 훅띄우기 } = require('./lib/훅띄우기');

const TESTS = __dirname;

const 임시들 = [];
function 임시() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-hookpath-'));
  임시들.push(d);
  return d;
}
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 결과가 아니다 */ } } });

/* 실행되지 않는 텍스트를 지운다 — **줄 수는 보존**한다(행 번호로 짚어야 사람이 찾아간다).
 * 템플릿 리터럴까지 지우는 이유: 이 회귀의 픽스처가 옛 형태를 문자열로 들고 있어서, 안 지우면
 * 검사가 **자기 자신을 위반으로** 신고한다(가드는 자기 전처리에도 눈이 먼다 · F103 계열). */
const 줄보존 = (m) => m.replace(/[^\n]/g, ' ');
function 코드만(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, 줄보존)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, 앞) => 앞 + 줄보존(m.slice(앞.length)))
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, 줄보존);
}

/** 한 파일의 위반 행 번호들. 훅 경로를 푸는 파일에서 node 자식을 직접 띄운 자리. */
function 위반들(원문) {
  const src = 코드만(원문);
  if (!/hooks/i.test(src)) return [];          // 훅과 무관한 회귀는 이 규칙의 대상이 아니다
  return [...src.matchAll(/spawnSync\s*\(\s*process\.execPath/g)]
    .map((m) => src.slice(0, m.index).split('\n').length);
}

function 스캔(dir) {
  const 결과 = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(test|check)\.js$/.test(f)) continue;
    const 줄 = 위반들(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (줄.length) 결과.push(`${f}:${줄.join(',')}`);
  }
  return 결과;
}

// ── ① 탐지력 (픽스처) ───────────────────────────────────────────────────────

test('🔴 옛 통로를 잡는다 — 훅을 직접 spawn 하는 회귀', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '나쁜.test.js'),
    "const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');\n"
    + 'const r = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8" });\n');
  assert.deepStrictEqual(스캔(d), ['나쁜.test.js:2'], '옛 형태를 못 잡았다 — 이 회귀가 무력하다');
});

test('훅을 **인자로 받는** 도우미도 잡는다 (자리 단위 규칙이 놓치던 자리)', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '인자.test.js'),
    "const HOOKS = path.join(ROOT, '.claude', 'hooks');\n"
    + 'function run(hook) { return spawnSync(process.execPath, [hook], { encoding: "utf8" }); }\n');
  assert.deepStrictEqual(스캔(d), ['인자.test.js:2'],
    '훅 경로가 변수로 흘러 들어오면 못 본다 — 그 구멍이 규칙을 파일 단위로 만든 이유다');
});

test('새 통로는 통과한다 — 거짓양성이 곧 우회 손버릇이 된다', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '좋은.test.js'),
    "const { 훅띄우기 } = require('./lib/훅띄우기');\n"
    + "const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');\n"
    + 'const r = 훅띄우기(HOOK, { input, encoding: "utf8" });\n');
  assert.deepStrictEqual(스캔(d), [], '고친 형태를 위반이라 했다');
});

test('훅과 무관한 회귀는 대상이 아니다 (규칙이 자기 범위를 넘지 않는다)', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '도구.test.js'),
    "const TOOL = path.join(ROOT, 'tools', 'bump-version.js');\n"
    + 'const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8" });\n');
  assert.deepStrictEqual(스캔(d), [], '훅을 안 보는 회귀까지 끌어왔다');
});

test('🔑 주석·문자열 속 옛 형태는 위반이 아니다 — 검사가 자기 픽스처를 신고하면 안 된다', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '설명.test.js'),
    "const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');\n"
    + '// 옛 통로: spawnSync(process.execPath, [HOOK], …) 는 미실행을 통과로 읽는다\n'
    + '/* spawnSync(process.execPath, [HOOK]) */\n'
    + 'const 픽스처 = `const r = spawnSync(process.execPath, [HOOK], {});`;\n');
  assert.deepStrictEqual(스캔(d), [], '문서화·픽스처를 벌했다 — 그런 가드는 BYPASS 를 가르친다');
});

// ── ② 통로가 실제로 미실행을 드러내는가 (통로가 조용하면 위 규칙이 장식이 된다) ──

test('🔴 훅이 안 뜨면 던진다 — 이게 이 통로의 전부다', () => {
  const 없는훅 = path.join(임시(), '없다.js');
  assert.throws(() => 훅띄우기(없는훅, { encoding: 'utf8' }),
    /못 띄웠다|끝났다/, '없는 훅을 조용히 통과시켰다 — 미실행이 결과가 됐다');
});

test('0 아닌 종료도 결과가 아니다 — 그리고 통과코드로 넓힐 수 있다', () => {
  const d = 임시();
  const 훅 = path.join(d, '터진다.js');
  fs.writeFileSync(훅, 'process.exit(3);\n');

  assert.throws(() => 훅띄우기(훅, { encoding: 'utf8' }), /3 로 끝났다/, '0 아닌 종료를 통과로 읽었다');
  // 종료 코드 자체가 검사 대상인 자리(도구의 거절 코드 등)는 넓혀 쓴다 — 그때도 미실행은 남는다.
  assert.strictEqual(훅띄우기(훅, { encoding: 'utf8', 통과코드: [0, 3] }).status, 3);
});

test('빈 stdout 은 그대로 돌려준다 — 「조용한 훅」은 여전히 정상 결과다', () => {
  const d = 임시();
  const 훅 = path.join(d, '조용.js');
  fs.writeFileSync(훅, 'process.exit(0);\n');
  assert.strictEqual(String(훅띄우기(훅, { encoding: 'utf8' }).stdout || '').trim(), '');
});

// ── ③ 실저장소 (거짓양성만 — 위반이 아직 있을 것을 요구하지 않는다) ───────────

test('🔴 저장소의 훅 회귀는 전부 새 통로를 쓴다', () => {
  assert.deepStrictEqual(스캔(TESTS), [],
    '훅 회귀가 node 자식을 직접 띄운다 — 그 자리에서 미실행이 「통과」로 번역된다(tests/lib/훅띄우기.js 를 쓴다)');
});
