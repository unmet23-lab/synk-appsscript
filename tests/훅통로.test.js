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
 *   규칙은 파일 단위다 — 훅 경로를 푸는 회귀 파일은 반환형 스폰(`spawnSync(process.execPath …)`
 *   과 그 'node' 표기)을 직접 쓰지 않는다. 자리 단위로 좁히면 훅을 **인자로 받는** 도우미가 통째로 사각이 된다(실측:
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
 *
 * 왜 토크나이저 하나인가(2026-08-07 재실측): 첫 판은 백틱만 지웠고, 이 파일이 자기 픽스처
 * (따옴표 문자열 속 옛 형태)를 안 물었던 건 문자열 속 **홑 백틱**끼리 엉뚱하게 짝지어 픽스처와
 * 'hooks' 단어가 통째로 소거된 **우연**이었다 — 같은 원리로 홑 백틱 사이의 실제 위반도
 * 지워진다. 문자열형을 종류별 순서로 지워도 같은 함정이 남는다(따옴표 안 백틱·백틱 안 따옴표가
 * 서로를 오짝 지운다 — 고치다 실측). 그래서 세 문자열형을 **한 정규식의 대안**으로 왼쪽부터
 * 한 번에 걷는다 — 먼저 열린 놈이 닫힐 때까지 다른 형을 내용으로 삼키므로 오짝이 원리상 없다.
 *   · 코드판 = 문자열 전부 소거 — 코드형 위반(process.execPath)을 찾는 판. 픽스처·설명
 *     문자열은 위반이 아니다.
 *   · 표기판 = 템플릿만 소거 — 'node' 표기형을 찾는 판(따옴표를 지우면 표기가 사라진다).
 *     그래서 이 파일의 표기형 픽스처는 전부 템플릿 리터럴이다(표기판의 사각에 둔다).
 *   · 게이트(/hooks/i)는 문자열을 살린 판(주석만 소거)에서 본다 — 훅 경로는 문자열에 산다.
 * 토크나이저 자신의 특수문자는 String.raw 템플릿 안에 둔다 — 스트리퍼가 자기 정규식 리터럴의
 * 홑 따옴표·홑 백틱에 걸려 넘어지는 것을 실측했다(F103 계열: 가드는 자기 전처리에 눈이 먼다).
 * 따옴표 짝짓기는 줄 안에서만이다(JS 문자열은 개행을 못 넘는다) — 반쪽 따옴표는 그대로 둔다. */
const 줄보존 = (m) => m.replace(/[^\n]/g, ' ');
/* 🔑 [2026-08-13] 주석 소거 지역 사본을 공용 통로로 돌렸다(F401 계열 · 대기열 P3 줄73).
 *   **`줄맞춰코드만` 이어야 한다** — 이 파일은 위반을 «행 번호»로 짚어 사람이 그 줄로 찾아간다.
 *   `코드만` 은 주석만 있던 줄을 «버려서» 번호가 밀린다(그 분리가 곧 이름 둘의 이유다).
 *   옛 사본이 «자기 정규식 리터럴에 걸려 넘어지던» 자리(위 F103 메모)도 공용 렉서가 함께 진다 —
 *   문자열·정규식 리터럴 «안»은 주석이 아니라는 판정이 이제 한 곳에서만 난다.
 *   ⚠ 열 위치는 안 지킨다(옛 `줄보존` 은 지켰다). 여기 소비자는 `행번호()` 뿐이라 무해하다 —
 *      개행 수가 보존되므로 줄 번호는 그대로다. 열로 짚는 소비자가 생기면 그때 갈라야 한다. */
const { 줄맞춰코드만: 주석소거 } = require('./lib/소스검사.js');
const 문자열토큰 = new RegExp(String.raw`'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|\`(?:\\[\s\S]|[^\\\`])*\``, 'g');
const 문자열소거 = (src) => src.replace(문자열토큰, 줄보존);
const 템플릿만소거 = (src) => src.replace(문자열토큰, (m) => (m.startsWith(String.fromCharCode(96)) ? 줄보존(m) : m));
const 행번호 = (src, i) => src.slice(0, i).split('\n').length;

/** 한 파일의 위반 행 번호들. 훅 경로를 푸는 파일에서 **반환형** node 자식을 직접 띄운 자리.
 *  (execFileSync 는 금지하지 않는다 — 던지는 형태라 미실행이 저절로 빨갛다. 결함은 반환형이
 *   미실행을 결과처럼 돌려주는 데서 났고, 실측된 반환형 표기는 아래 둘이다.) */
/* 🔴 F535 (2026-08-17) — 이 규칙이 **도구 스폰을 훅으로 오탐해** master 를 빨갛게 세워 뒀다.
 *
 * 실측 2026-08-17(수리 직전): `process.execPath` 를 띄우는 시험 파일 **15** 중 적색은 **1**
 *   (`형제초록.test.js:61`)뿐이었다. 나머지 14는 **같은 모양인데 파일에 「hooks」 낱말이 없어서**
 *   조용했다. 즉 적색이 자의적이고(그 파일은 훅 등재를 확인하느라 그 낱말을 쓸 뿐이다), 나머지
 *   14는 낱말 하나만 들어오면 빨개지는 지뢰다. 주인 세션이 죽어 **아무도 못 닫는 적색**이 되어
 *   남의 배포·트랙 종결 게이트를 상시로 막았다.
 *
 * 🔑 그런데 **게이트를 자리 단위로 좁히는 것은 답이 아니다** — 이 파일 머리말(12~14행)이 그걸
 *   이미 실측해 기각했다: 훅을 **인자로 받는** 도우미(`run(hook, …)`)가 통째로 사각이 된다.
 *   그래서 기본값은 그대로 **위반**으로 두고, «증명된 도구 호출»만 뗀다 — 인자에 `tools` 경로가
 *   **글자로** 있고 `hooks` 는 없는 자리. 변수로 넘어온 훅은 영원히 증명이 안 되므로 그 사각은
 *   닫힌 채로 남는다(면제의 방향을 「모르면 위반」으로 못박은 것이 이 설계의 전부다).
 *
 * ⚠ 인덱스는 **`주석뺀` 기준**이다 — `문자열소거`·`템플릿만소거` 는 길이를 보존하므로(줄보존)
 *   세 판의 자리가 정확히 겹친다. 문자열을 지운 판에서 `'tools'` 를 찾으면 당연히 못 찾는다.
 */
/* ⚠ 이 패턴에 **따옴표·백틱을 글자로 쓰지 않는다** — 위 스트리퍼는 정규식 리터럴을 모르는
 *   날 정규식이라, 여기 홑따옴표가 하나 들어가면 그 뒤 파일 전체의 문자열 짝이 밀린다.
 *   실측(이 수리 중): `['"`+백틱+`]tools…` 로 썼다가 **이 파일 자신의 픽스처 3자리**가 위반으로
 *   튀어나왔다 — 51~52행이 경고한 바로 그 함정(F103: 가드는 자기 전처리에 눈이 먼다)을
 *   고치는 사람이 그대로 밟았다. 그래서 낱말 경계로만 잰다(따옴표를 볼 이유가 없다). */
const 도구인자 = /\btools\b/;
const 인자창 = 400;
function 도구스폰(주석뺀, i) {
  const 창 = 주석뺀.slice(i, i + 인자창);
  const 끝 = 창.indexOf(']');                  // 첫 인자 배열까지만 본다 — 뒤 옵션 객체는 판정 재료가 아니다
  const 인자 = 끝 === -1 ? 창 : 창.slice(0, 끝);
  if (/hooks/i.test(인자)) return false;        // 훅이 섞이면 증명 실패 → 위반으로 남긴다
  return 도구인자.test(인자);
}

function 위반들(원문) {
  const 주석뺀 = 주석소거(원문);
  if (!/hooks/i.test(주석뺀)) return [];       // 훅과 무관한 회귀는 이 규칙의 대상이 아니다
  const 코드판 = 문자열소거(주석뺀);
  const 표기판 = 템플릿만소거(주석뺀);
  const 줄들 = new Set([
    ...[...코드판.matchAll(/spawnSync\s*\(\s*process\.execPath/g)]
      .filter((m) => !도구스폰(주석뺀, m.index)).map((m) => 행번호(코드판, m.index)),
    ...[...표기판.matchAll(/spawnSync\s*\(\s*['"]node['"]/g)]
      .filter((m) => !도구스폰(주석뺀, m.index)).map((m) => 행번호(표기판, m.index)),
  ]);
  return [...줄들].sort((a, b) => a - b);
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

/* 🔴 F535 — 「hooks 라는 낱말이 파일 어딘가에 있다」는 이유로 **도구 스폰**까지 벌하던 자리.
 *   위 「도구.test.js」 검사는 파일에 hooks 낱말이 **없어서** 통과했을 뿐이라 이 자리를 못 봤다 —
 *   실측 15파일 중 14가 그 모양이었고(조용한 지뢰), 낱말이 하나 들어온 1건만 빨갰다. */
test('🔴 F535 — 훅도 보는 파일 안의 «도구» 스폰은 위반이 아니다 (적색이 낱말 하나로 갈리면 안 된다)', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '섞인.test.js'),
    "const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');\n"
    + "const r0 = 훅띄우기(HOOK, { encoding: 'utf8' });\n"
    + "const r = spawnSync(process.execPath, [path.join(as, 'tools', '형제초록.js'), ...args], { cwd: as });\n");
  assert.deepStrictEqual(스캔(d), [],
    '🔴 도구를 띄우는 자리를 훅 위반으로 셌다 — 주인 없는 적색이 되어 남의 배포를 상시로 막는다(F535 실사고)');
});

test('🔴 F535 — 면제는 «증명된 도구»에만. 훅이 섞이면 그대로 위반이다 (모르면 위반)', () => {
  const d = 임시();
  // ① 변수로 넘어온 훅 옆에 tools 낱말이 있어도 면제되지 않는다 — 증명이 아니라 정황이다.
  fs.writeFileSync(path.join(d, '정황.test.js'),
    "const HOOKS = path.join(ROOT, '.claude', 'hooks');\n"
    + "const 도구들 = 'tools';\n"
    + 'function run(hook) { return spawnSync(process.execPath, [hook], { encoding: "utf8" }); }\n');
  assert.deepStrictEqual(스캔(d), ['정황.test.js:3'],
    '🔴 면제가 넓다 — 훅을 인자로 받는 도우미가 다시 사각이 됐다(머리말 12~14행이 기각한 그 구멍)');

  // ② 같은 인자 안에 hooks 가 섞이면 증명 실패다.
  const e = 임시();
  fs.writeFileSync(path.join(e, '혼합.test.js'),
    "const 설명 = 'hooks 도 함께 본다';\n"
    + "const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'x.js'), path.join(ROOT, '.claude', 'hooks', 'y.js')], {});\n");
  assert.deepStrictEqual(스캔(e), ['혼합.test.js:2'],
    '🔴 인자에 훅이 섞였는데 도구라고 면제했다');

  /* ③ 면제는 **인자 배열 안**에서만 증명된다 — 뒤따르는 옵션 객체의 `tools` 는 정황이다.
   *   (변이가 이 구멍을 드러냈다: 경계를 안 닫아도 13건이 전부 초록이었다.) */
  const f = 임시();
  fs.writeFileSync(path.join(f, '뒤에.test.js'),
    "const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');\n"
    + "const r = spawnSync(process.execPath, [HOOK], { cwd: path.join(ROOT, 'tools') });\n");
  assert.deepStrictEqual(스캔(f), ['뒤에.test.js:2'],
    '🔴 인자 배열 **뒤**의 tools 를 증거로 삼아 훅 스폰을 면제했다 — 경계를 안 닫으면 정황이 증명으로 격상된다');
});

/* 🔑 표기형(`'node'`)도 **같은 면제**를 지나야 한다 — 한쪽만 고치면 두 갈래가 갈라지고,
 *   갈라진 쪽의 증상은 언제나 「통과」다(CLAUDE.md 가드 맹점 ④). 변이가 이 구멍도 드러냈다. */
test("🔴 F535 — 'node' 표기형의 도구 스폰도 면제된다 (두 갈래가 갈라지지 않는다)", () => {
  /* ⚠ 표기형 픽스처는 **템플릿 리터럴**로 쓴다 — `표기판` 은 따옴표 문자열을 살려 두므로
   *   따옴표로 쓰면 이 파일 자신이 위반으로 잡힌다(48~49행의 규약 · 고치며 실제로 밟았다). */
  const d = 임시();
  fs.writeFileSync(path.join(d, '표기도구.test.js'), `const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');
const r = spawnSync('node', [path.join(ROOT, 'tools', 'bump-version.js')], { encoding: 'utf8' });
`);
  assert.deepStrictEqual(스캔(d), [],
    '🔴 표기형 갈래엔 면제가 안 걸렸다 — 같은 판정이 두 곳에 따로 살면 한쪽만 낡는다');

  // 반대 방향 — 표기형이라고 훅 스폰까지 면제되면 안 된다.
  const e = 임시();
  fs.writeFileSync(path.join(e, '표기훅.test.js'), `const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');
const r = spawnSync('node', [HOOK], { encoding: 'utf8' });
`);
  assert.deepStrictEqual(스캔(e), ['표기훅.test.js:2'], '🔴 표기형 훅 스폰이 면제로 샜다');
});

test('🔑 주석·문자열 속 옛 형태는 위반이 아니다 — 검사가 자기 픽스처를 신고하면 안 된다', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '설명.test.js'),
    "const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');\n"
    + '// 옛 통로: spawnSync(process.execPath, [HOOK], …) 는 미실행을 통과로 읽는다\n'
    + '/* spawnSync(process.execPath, [HOOK]) */\n'
    + 'const 픽스처 = `const r = spawnSync(process.execPath, [HOOK], {});`;\n'
    + "const 그림 = 'spawnSync(process.execPath 를 직접 쓰면 미실행이 결과가 된다';\n");
  assert.deepStrictEqual(스캔(d), [], '문서화·픽스처를 벌했다 — 그런 가드는 BYPASS 를 가르친다');
});

test('🔴 홑 백틱이 낀 문자열이 위반을 지우지 못한다 — 옛 스트리퍼의 소거 구멍', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '홑백틱.test.js'), `const 말 = '값은 \` 로 감싼다';
const HOOK = path.join(ROOT, '.claude', 'hooks', 'x.js');
const r = spawnSync(process.execPath, [HOOK], { encoding: 'utf8' });
const 끝 = '여기도 \` 하나 — 백틱만 지우면 첫 백틱과 짝지어 위 두 줄이 통째로 사라진다';
`);
  assert.deepStrictEqual(스캔(d), ['홑백틱.test.js:3'],
    '홑 백틱 사이의 실제 위반이 소거됐다 — 문자열을 백틱보다 먼저 지워야 한다');
});

test('🔴 node 를 따옴표로 부르는 반환형도 잡는다 — 형제 저장소의 옛 형태가 그 표기였다', () => {
  const d = 임시();
  fs.writeFileSync(path.join(d, '표기형.test.js'), `const HOOK = path.join(ROOT, '.claude', 'hooks', 'y.js');
const r = spawnSync('node', [HOOK], { encoding: 'utf8' });
`);
  assert.deepStrictEqual(스캔(d), ['표기형.test.js:2'],
    '표기만 바꾼 반환형 스폰을 놓쳤다 — 같은 결함이 다른 철자로 재발한다');
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
