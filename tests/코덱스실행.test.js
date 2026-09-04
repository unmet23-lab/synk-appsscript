'use strict';
/* 코덱스 실행자 레인 회귀 — 2026-09-04
 *
 * 무엇을 지키나: 「범위 밖은 커밋되지 않는다」 · 「구멍 난 발주서는 코덱스를 안 태운다」 · 「정본 마커가 없으면
 * 조용히 빈 채로 돌지 않는다」 · 「실행자 잠금이 쓰기 한 칸만 열고 나머지는 검수 잠금과 같다」.
 * 새는 방향은 전부 「통과」다 — 그래서 탐지력은 픽스처가 진다(실저장소 상태에 기대지 않는다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 빌드 = require(path.join(ROOT, 'tools', 'codex-build.js'));
const 검수 = require(path.join(ROOT, 'tools', 'codex-review.js'));
const 정책 = require(path.join(ROOT, 'tools', '모델정책.js'));
const 런 = require(path.join(ROOT, 'tools', 'lib', '검수런.js'));

const 발주 = `# 발주 — add.js 에 빼기 함수를 더한다

## 목표
\`add.js\` 옆에 \`subtract(a, b)\` 를 더하고 시험을 붙인다.

## 범위
- \`add.js\`
- \`tests/\`

## 수용 기준
1. \`subtract(5, 3)\` 이 2 를 돌려준다.
2. 시험 파일이 있고 통과한다.

## 시험
- \`node --test tests/\`

## 금지
- 다른 파일을 만지지 않는다.
`;

// ───────────────────────────────── 발주서 형식 — 구멍 난 발주서는 코덱스를 안 태운다

test('🔑 규격대로 쓴 발주서는 오류 0 · 범위·시험·수용 기준이 그대로 읽힌다', () => {
  const r = 빌드.발주서검사(발주);
  assert.deepStrictEqual(r.오류들, []);
  assert.strictEqual(r.제목, '발주 — add.js 에 빼기 함수를 더한다');
  assert.deepStrictEqual(r.허용경로들, ['add.js', 'tests/']);
  assert.deepStrictEqual(r.시험명령들, ['node --test tests/']);
  assert.strictEqual(r.수용기준들.length, 2);
  assert.deepStrictEqual(r.금지항목들, ['다른 파일을 만지지 않는다.']);
});

test('☠️ 필수 절이 빠지면 그 절 이름으로 거절한다 — 시험 없는 발주는 판정할 수 없다', () => {
  const 없음 = 발주.replace(/## 시험[\s\S]*?(?=## 금지)/, '');
  const r = 빌드.발주서검사(없음);
  assert.ok(r.오류들.some((e) => e.includes('«시험»')), r.오류들.join(' / '));
});

test('☠️ 범위에 정본·가드 자리가 들어오면 거절한다(사람 몫) · 저장소 전부(`.`)도 범위가 아니다', () => {
  const 가드 = 발주.replace('- `tests/`', '- `.claude/hooks/`');
  assert.ok(빌드.발주서검사(가드).오류들.some((e) => e.includes('만질 수 없는')));
  const 전부 = 발주.replace('- `tests/`', '- `.`');
  assert.ok(빌드.발주서검사(전부).오류들.some((e) => e.includes('저장소 전부')));
  const 정본 = 발주.replace('- `add.js`', '- `tools/모델정책.js`');
  assert.ok(빌드.발주서검사(정본).오류들.some((e) => e.includes('모델정책')));
});

test('🔑 절 이름의 번호·기호는 걷어 낸다 — `## 1. 목표`·`## ② 범위` 도 같은 절이다', () => {
  const 번호 = 발주.replace('## 목표', '## 1. 목표').replace('## 범위', '## ② 범위');
  assert.deepStrictEqual(빌드.발주서검사(번호).오류들, []);
});

// ───────────────────────────────── 범위 — git status 가 자다

test('🔑 범위 밖 파일만 골라낸다 · 금지 경로는 범위에 있어도 밖이다', () => {
  assert.deepStrictEqual(빌드.범위밖(['add.js', 'tests/a.test.js', 'tools/x.js'], ['add.js', 'tests/']), ['tools/x.js']);
  assert.deepStrictEqual(빌드.범위밖(['AGENTS.md'], ['AGENTS.md']), ['AGENTS.md']);
  assert.deepStrictEqual(빌드.범위밖(['tests\\b.test.js'], ['tests/']), [], '윈도우 구분자도 같은 경로다');
  assert.deepStrictEqual(빌드.범위밖([], ['add.js']), []);
});

test('🔑 별표 — `*` 는 한 마디 · `**` 는 여러 마디 · 폴더는 그 아래 전부', () => {
  assert.ok(빌드.경로맞나('src/a/b.js', 'src/**'));
  assert.ok(빌드.경로맞나('src/a.js', 'src/*.js'));
  assert.ok(!빌드.경로맞나('src/a/b.js', 'src/*.js'));
  assert.ok(빌드.경로맞나('docs/x/y.md', 'docs/'));
  assert.ok(!빌드.경로맞나('docsx/y.md', 'docs/'), '접두가 아니라 폴더다');
  assert.ok(빌드.경로맞나('add.js', 'add.js') && !빌드.경로맞나('add.js.bak', 'add.js'));
});

// ───────────────────────────────── 비밀 무늬 — 커밋 전 마지막 벽

test('☠️ 열쇠처럼 생긴 문자열이 변경분에 있으면 잡는다 · 깨끗하면 0건', () => {
  assert.strictEqual(빌드.비밀검사('const k = "sk-abcdefghijklmnopqrstuvwxyz1234";').length, 1);
  assert.strictEqual(빌드.비밀검사('-----BEGIN RSA PRIVATE KEY-----').length, 1);
  assert.strictEqual(빌드.비밀검사('AIza' + 'A'.repeat(35)).length, 1);
  assert.deepStrictEqual(빌드.비밀검사('module.exports = (a, b) => a - b;'), []);
});

// ───────────────────────────────── 정본 발췌 — 마커가 없으면 조용히 빈 채로 돌지 않는다

test('🔑 역할 마커로 자른다 · 마커가 없으면 확인 불가로 던진다(빈 규율로 도는 실행이 「돌았다」의 얼굴을 못 쓰게)', () => {
  const md = '머리\n<!-- 역할: 실행자 시작 -->\n본문 A\n<!-- 역할: 실행자 끝 -->\n꼬리';
  assert.strictEqual(빌드.정본절('실행자', md), '본문 A');
  assert.throws(() => 빌드.정본절('검수자', md), (e) => e.확인불가 === true);
});

test('🔑 실물 docs/GPT_정본.md 에 역할 넷의 마커와 공통지침 펜스가 다 있다', () => {
  for (const 역할 of ['공통', '실행자', '검수자', '심문자']) {
    const 절 = 빌드.정본절(역할);
    assert.ok(절.length > 100, `«${역할}» 절이 너무 짧다(${절.length}자)`);
  }
  const 지침 = 빌드.공통지침정본();
  assert.ok(지침.includes('유호님') && 지침.includes('확인 불가'), '공통 지침에 사용자·확인 불가 규약이 있어야 한다');
  assert.ok(!빌드.정본절('실행자').includes('gpt-5.6'), '정본 발췌에 모델값을 적지 않는다(값의 정본은 모델정책.js)');
});

// ───────────────────────────────── 프롬프트 셋 — 실행자는 발주서 전문을, 대조는 기준 원문을

test('🔑 실행 프롬프트에 발주서 전문·실행자 절·라운드가 실리고, 라운드 2 는 앞 라운드가 남긴 것을 싣는다', () => {
  const p1 = 빌드.실행프롬프트({ 발주서: 발주, 실행자절: '규율 X', 공통: '공통 Y', 라운드: 1, 앞라운드: null });
  assert.ok(p1.includes('subtract(a, b)') && p1.includes('규율 X') && p1.includes('공통 Y') && p1.includes('라운드 1'));
  assert.ok(!p1.includes('앞 라운드'));
  const p2 = 빌드.실행프롬프트({ 발주서: 발주, 실행자절: '', 공통: '', 라운드: 2,
    앞라운드: { 지적들: [{ 등급: 'P1', 파일: 'add.js', 라인: 3, 제목: '음수 처리', 근거: 'a<b 면 틀린다', 수정방향: '' }], 미충족: [{ 기준: '기준 2', 근거: '시험 없음' }], 시험실패: ['node --test → 종료 1'] } });
  assert.ok(p2.includes('앞 라운드(1)') && p2.includes('[P1] add.js:3 음수 처리') && p2.includes('기준 2') && p2.includes('종료 1'));
});

test('🔑 수용 대조 프롬프트는 기준을 번호로 나열하고 시험 결과(도구가 돌린 값)를 싣는다', () => {
  const p = 빌드.수용대조프롬프트(['기준 하나', '기준 둘'], 'diff --git a/x b/x', '통과: node --test tests/');
  assert.ok(p.includes('1. 기준 하나') && p.includes('2. 기준 둘') && p.includes('통과: node --test tests/') && p.includes('diff --git'));
});

test('🔑 발주 검토 프롬프트는 구현하지 말라고 못박고 발주서 전문을 싣는다', () => {
  const p = 빌드.발주검토프롬프트(발주, '공통 Z');
  assert.ok(p.includes('구현하지 마라') && p.includes('subtract(a, b)') && p.includes('공통 Z'));
});

// ───────────────────────────────── 잠금 — 쓰기 한 칸만 열고 나머지는 검수와 같다

test('🔒 쓰기 플래그 = workspace-write + 네트워크 없음 + 웹검색 없음 + 검수와 같은 바깥 도구 차단', () => {
  const f = 빌드.쓰기플래그;
  assert.ok(f.includes('sandbox_mode="workspace-write"'));
  assert.ok(f.includes('sandbox_workspace_write.network_access=false'), '네트워크가 열리면 push·배포·유출이 통째로 열린다');
  assert.ok(f.includes('web_search="disabled"'));
  assert.ok(f.includes('--ignore-user-config') && f.includes('windows.sandbox="elevated"'));
  assert.ok(!f.includes('sandbox_mode="read-only"'));
  for (const 도구 of 검수.외부도구들) {
    assert.ok(f.some((x, i) => x === 도구 && f[i - 1] === '--disable'), `바깥 도구 ${도구} 가 실행자에서 안 막혔다`);
  }
});

test('🔒 읽기 플래그 = 검수 잠금 그대로 + 웹검색 없음', () => {
  const f = 빌드.읽기플래그;
  for (const x of 검수.잠금플래그) assert.ok(f.includes(x), `검수 잠금 ${x} 가 빠졌다`);
  assert.ok(f.includes('web_search="disabled"'));
});

// ───────────────────────────────── 모델정책 — 실행자 픽은 검수에서 파생한다

/* ✅ [2026-09-04] 기본이 luna → sol 로 올라갔다(유호 확정 「아스트라 전까지 sol 1회」).
 *   🔑 **이 검사의 심장은 «기본이 무엇이냐»가 아니라 «검수에서 파생하느냐»다** — 그래서 아래는
 *   값을 손으로 적지 않고 `검수선택지[검수기본]` 과 대조한다. 유호님이 다음에 또 바꾸셔도
 *   실행자만 옛 값에 남으면 여기서 운다(그것이 이 자가 막는 병이다). */
test('🔑 실행 선택지는 sol·luna 둘 · 기본은 ①검수 기본을 따라간다 · 값은 검수선택지에서 파생한다', () => {
  assert.deepStrictEqual(Object.keys(정책.실행선택지).sort(), ['luna', 'sol']);
  assert.strictEqual(정책.실행기본, 정책.검수기본,
    '③실행자 기본이 ①검수 기본과 갈렸다 — 유호 확정은 「싹다」라 셋이 한 값으로 움직인다');
  const 기본 = 정책.실행설정([]);
  assert.strictEqual(기본.model, 정책.검수선택지[정책.검수기본].model);
  assert.strictEqual(기본.effort, 정책.검수선택지[정책.검수기본].effort);
  /* 명시 픽은 여전히 기본을 이긴다 — 기본이 sol 이 됐으므로 반대편(luna)으로 뒤집어 잰다. */
  assert.strictEqual(정책.실행설정(['--실행', 'luna']).model, 'gpt-5.6-luna');
  assert.strictEqual(정책.실행설정(['--실행', 'sol', '--효력', 'max']).effort, 'max');
  assert.throws(() => 정책.실행설정(['--실행', 'terra']), (e) => e.확인불가 === true && /terra/.test(e.message));
  assert.throws(() => 정책.실행설정(['--실행']), (e) => e.확인불가 === true);
});

// ───────────────────────────────── 런 장부 — 실행 런의 이어받기 명령은 제 도구를 가리킨다

test('🔑 이어받기 명령은 런의 `도구` 칸을 따른다 — 없으면 옛 그대로 검수 도구다', () => {
  const 실행 = 런.이어받기명령({ 런ID: 'x', 종류: '실행', 인자: ['--발주', 'docs/a.md'], 도구: 'tools/codex-build.js' });
  assert.strictEqual(실행.명령, 'node tools/codex-build.js --발주 docs/a.md');
  const 검수런 = 런.이어받기명령({ 런ID: 'y', 종류: '검수', 인자: ['--commit', 'abc'] });
  assert.strictEqual(검수런.명령, 'node tools/codex-review.js --commit abc');
});

// ───────────────────────────────── 등록층 — 모르는 낱말은 거절 · 마른손은 코덱스 없이 ⓪만

const 도구 = path.join(ROOT, 'tools', 'codex-build.js');
function 실행(args, opts) {
  return spawnSync(process.execPath, [도구, ...args], { encoding: 'utf8', cwd: ROOT, timeout: 60000, ...(opts || {}) });
}

test('🔑 모르는 플래그는 종료 2 로 거절하고 아는 낱말을 알려 준다(F135)', () => {
  const r = 실행(['--엉뚱', '--발주', 'x.md']);
  assert.strictEqual(r.status, 2);
  assert.ok(/--발주/.test(r.stderr + r.stdout), '차단문에 아는 낱말이 실려야 처방이 된다');
});

/* 🔴 2026-09-05 실측 — 한도 마커가 있을 때 이 레인이 ①막고 ②처방대로 뚫리나.
 *   그날 ①은 섰는데 ②가 죽어 있었다: 차단문(codex() 안 · 두 레인이 «같은 문장»을 쓴다)이
 *   `--한도무시` 를 처방하는데 codex-build 의 등록층에 그 낱말이 없어 「모르는 플래그」로 거절됐다.
 *   처방이 그대로 안 먹으면 남는 길은 env 직접 심기뿐이고, 그게 곧 우회가 정상 통로가 되는 자리다(F103).
 * 📏 자는 «소스 글자»가 아니라 «가짜 코덱스가 불렸나»다 — 태우기 전에 막았으면 흔적이 0이고,
 *   처방이 먹었으면 그 가짜의 오류 문면이 나온다. 가짜라서 벤더에 닿지 않는다. */
test('🔴 한도 마커 — ① 태우기 전에 막고 ② 차단문이 준 처방(--한도무시)이 이 레인에서도 먹는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-quota-'));
  assert.strictEqual(spawnSync('git', ['init', '-q', 방], { encoding: 'utf8' }).status, 0);
  fs.writeFileSync(path.join(방, 'add.js'), 'module.exports = (a, b) => a + b;\n');
  fs.writeFileSync(path.join(방, '발주.md'), 발주);
  spawnSync('git', ['-C', 방, 'add', '--', 'add.js'], { encoding: 'utf8' });
  spawnSync('git', ['-C', 방, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base', '--', 'add.js'], { encoding: 'utf8' });

  /* 런방 = 마커가 사는 방(env 로 갈라 둔다 — 이 기계의 «진짜» 한도 판정을 건드리지 않는다). */
  const 런방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-quota-runs-'));
  fs.writeFileSync(path.join(런방, '한도.json'), JSON.stringify({
    감지시각: new Date().toISOString(),
    리셋시각: new Date(Date.now() + 3600e3).toISOString(),
    원문: "ERROR: You've hit your usage limit. Upgrade to Pro or try again at 9:37 PM.",
    출처런: '',
  }), 'utf8');

  /* 가짜 코덱스 — 불리면 제 이름을 오류에 적고 죽는다(벤더에 안 닿는다). 윈도는 `%APPDATA%\\npm\\codex.cmd`
   * 를 «직접» 부르고 다른 데선 PATH 를 탄다 — 두 통로를 다 막아 둬야 실측이 기계에 안 기댄다. */
  const 가짜방 = path.join(런방, 'npm');
  fs.mkdirSync(가짜방, { recursive: true });
  fs.writeFileSync(path.join(가짜방, 'codex.cmd'), '@echo off\r\necho ERROR: FAKECODEX burned 1>&2\r\nexit /b 1\r\n', 'utf8');
  fs.writeFileSync(path.join(가짜방, 'codex'), '#!/bin/sh\necho "ERROR: FAKECODEX burned" >&2\nexit 1\n', { mode: 0o755 });

  const env = { ...process.env, SYNK_REVIEW_RUNS: 런방, SYNK_BUILD_LEDGER: path.join(런방, '장부.jsonl'), APPDATA: 런방 };
  /* 윈도는 APPDATA 로 잡히므로 PATH 를 안 건드린다 — `PATH`/`Path` 두 키가 겹치면 자식의 git 이 죽는다. */
  if (process.platform !== 'win32') env.PATH = 가짜방 + path.delimiter + process.env.PATH;
  const 인자 = ['--발주', path.join(방, '발주.md'), '--저장소', 방, '--발주검토안함', '--timeout', '60'];

  const 막힘 = 실행(인자, { env });
  const 막힘글 = 막힘.stderr + 막힘.stdout;
  assert.ok(/한도/.test(막힘글), '마커가 있으면 한도로 끊어야 한다: ' + 막힘글.slice(-400));
  assert.ok(!/FAKECODEX/.test(막힘글), '태우기 «전»에 막아야 한다 — 코덱스가 불렸다: ' + 막힘글.slice(-400));
  assert.strictEqual(막힘.status, 2, '한도로 못 잰 것은 «확인 불가»(2)지 통과가 아니다');

  const 강행 = 실행([...인자, 검수.한도무시플래그], { env });
  const 강행글 = 강행.stderr + 강행.stdout;
  assert.ok(!/모르는 플래그/.test(강행글), '차단문이 준 처방이 거절되면 우회가 정상 통로가 된다(09-05 에 실제로 그랬다): ' + 강행글.slice(-400));
  assert.ok(/FAKECODEX/.test(강행글), '강행은 게이트를 지나 코덱스를 태워야 한다: ' + 강행글.slice(-400));
});

/* 🔴 2026-09-05 실측 — 한도로 죽은 런은 «커밋 없이 파일만» 남기고, 워크트리가 발주 지문으로
 *   정해지므로 다음 런이 그 잔해를 **제 결과로 커밋한다**. 이어 도는 것은 옳은데, 안 적으면
 *   커밋 제목이 「라운드 N」 하나뿐이라 합칠지 정하는 사람이 «이번 회차가 지은 것»으로 읽는다.
 * 📏 자 = 커밋의 제목·본문에 그 표시가 실제로 있나(소스 글자가 아니라 만들어진 커밋을 읽는다). */
test('🔴 앞 회차가 짓다 만 잔해를 이어받으면 커밋이 그렇게 말한다 — 「라운드 N」 하나로 뭉뚱그리지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-carry-'));
  assert.strictEqual(spawnSync('git', ['init', '-q', 방], { encoding: 'utf8' }).status, 0);
  fs.writeFileSync(path.join(방, 'add.js'), 'module.exports = (a, b) => a + b;\n');
  fs.writeFileSync(path.join(방, '발주.md'), 발주);
  spawnSync('git', ['-C', 방, 'add', '--', 'add.js'], { encoding: 'utf8' });
  spawnSync('git', ['-C', 방, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base', '--', 'add.js'], { encoding: 'utf8' });

  const 런방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-carry-runs-'));
  const 가짜방 = path.join(런방, 'npm');
  fs.mkdirSync(가짜방, { recursive: true });
  /* 가짜 코덱스 — 🪤 작업 폴더는 cwd 가 아니라 `-C` 로 온다(09-05 에 이걸 무시해 본 저장소에 파일이 샜다).
   *   FAKE_MODE=die  : `-C` 안에 반쯤 짓고 죽는다(= 한도로 끊긴 런)
   *   FAKE_MODE=ok   : 아무것도 안 짓고 답 파일만 남기고 성공한다(= 잔해만 남은 다음 런) */
  fs.writeFileSync(path.join(가짜방, 'fakecodex.js'), [
    "const fs = require('fs'), path = require('path');",
    'const a = process.argv.slice(2);',
    "const wt = a[a.indexOf('-C') + 1];",
    "const out = a[a.indexOf('-o') + 1];",
    "if (process.env.FAKE_MODE === 'die') {",
    "  fs.appendFileSync(path.join(wt, 'add.js'), '// 짓다 만 자국\\n');",
    '  process.stderr.write("ERROR: You\'ve hit your usage limit. Upgrade to Pro or try again at 9:37 PM.\\n");',
    '  process.exit(1);',
    '}',
    "fs.writeFileSync(out, JSON.stringify({ 상태: '완료', 요약: '새로 지은 것 없음', 바꾼파일들: [], 시험: [], 남긴것: [], 발주밖발견: [], 확신도: 0.5, 항목: [] }), 'utf8');",
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(가짜방, 'codex.cmd'), '@echo off\r\nnode "%~dp0fakecodex.js" %*\r\n', 'utf8');
  fs.writeFileSync(path.join(가짜방, 'codex'), '#!/bin/sh\nexec node "$(dirname "$0")/fakecodex.js" "$@"\n', { mode: 0o755 });

  const 바탕 = { ...process.env, SYNK_REVIEW_RUNS: 런방, SYNK_BUILD_LEDGER: path.join(런방, '장부.jsonl'), APPDATA: 런방 };
  if (process.platform !== 'win32') 바탕.PATH = 가짜방 + path.delimiter + process.env.PATH;
  const 인자 = ['--발주', path.join(방, '발주.md'), '--저장소', 방, '--발주검토안함', '--검수안함', '--라운드', '1', '--timeout', '60'];

  // ① 한도로 끊긴 런 — 커밋은 0 이고 짓다 만 파일만 워크트리에 남는다
  const 죽음 = 실행(인자, { env: { ...바탕, FAKE_MODE: 'die' } });
  assert.strictEqual(죽음.status, 2, 죽음.stderr + 죽음.stdout);
  const wt = 빌드.워크트리경로(방, 빌드.발주지문(fs.readFileSync(path.join(방, '발주.md'), 'utf8')));
  assert.ok(/짓다 만 자국/.test(fs.readFileSync(path.join(wt, 'add.js'), 'utf8')), '짓다 만 것은 워크트리에 남는다');
  assert.strictEqual(spawnSync('git', ['-C', 방, 'log', '--oneline', '--all'], { encoding: 'utf8' }).stdout.trim().split('\n').length, 1, '죽은 런은 커밋을 안 남긴다');

  // ② 한도가 풀린 뒤 같은 명령 — 잔해가 이 라운드의 커밋으로 들어간다
  fs.rmSync(path.join(런방, '한도.json'), { force: true });
  const 이어 = 실행(인자, { env: { ...바탕, FAKE_MODE: 'ok' } });
  const 이어글 = 이어.stdout + 이어.stderr;
  assert.ok(/이어받는다/.test(이어글), '화면이 먼저 말해야 한다: ' + 이어글.slice(-400));

  const 가지 = 빌드.가지이름(빌드.발주지문(fs.readFileSync(path.join(방, '발주.md'), 'utf8')));
  const 메시지 = spawnSync('git', ['-C', 방, 'log', '-1', '--format=%B', 가지], { encoding: 'utf8' }).stdout;
  assert.ok(/앞 회차 이어받음 1/.test(메시지), '제목만 보는 눈(--oneline)에도 보여야 한다: ' + 메시지);
  assert.ok(/add\.js/.test(메시지) && /새로 지은 것이 아니다/.test(메시지), '본문이 어느 파일인지 말해야 한다: ' + 메시지);
});

test('🔑 --마른손 은 코덱스를 안 태우고 ⓪만 낸다 — 임시 저장소에서 형식·범위·계획을 출력한다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-test-'));
  const 초기 = spawnSync('git', ['init', '-q', 방], { encoding: 'utf8' });
  assert.strictEqual(초기.status, 0, 초기.stderr);
  fs.writeFileSync(path.join(방, 'add.js'), 'module.exports = (a, b) => a + b;\n');
  fs.writeFileSync(path.join(방, '발주.md'), 발주);
  spawnSync('git', ['-C', 방, 'add', '--', 'add.js'], { encoding: 'utf8' });
  spawnSync('git', ['-C', 방, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base', '--', 'add.js'], { encoding: 'utf8' });
  const r = 실행(['--발주', path.join(방, '발주.md'), '--저장소', 방, '--마른손']);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.ok(/마른손/.test(r.stdout) && /범위 2개/.test(r.stdout) && /시험 1개/.test(r.stdout), r.stdout);
  assert.ok(!fs.existsSync(path.join(방, '.claude', 'worktrees')), '마른손은 워크트리를 만들지 않는다');
  const 깨진 = 발주.replace(/## 시험[\s\S]*?(?=## 금지)/, '');
  fs.writeFileSync(path.join(방, '깨진.md'), 깨진);
  const r2 = 실행(['--발주', path.join(방, '깨진.md'), '--저장소', 방, '--마른손']);
  assert.strictEqual(r2.status, 2, '구멍 난 발주서는 종료 2 다');
  assert.ok(/«시험»/.test(r2.stderr), r2.stderr);
});

/* ── 🔴 자기 채점 막기 (2026-09-04 · GPT 지적으로 잡힌 진짜 구멍) ─────────────────────────
 * 새는 방향은 「통과」다 — 실행자가 저를 재는 시험을 느슨하게 고쳐도 종료코드는 초록이 된다.
 * 그래서 여기서는 «막히나»를 문다(소스에 무슨 글자가 있나가 아니라 · 기억 `test-guards-the-defect`). */

test('🔴 시험파일인가 — 시험 자리는 잡고 보통 소스는 안 잡는다', () => {
  for (const p of ['tests/a.test.js', 'test/b.js', '__tests__/c.js', 'evals/d.js', 'src/x.spec.ts', 'a/tests/deep/e.js']) {
    assert.ok(빌드.시험파일인가(p), `시험으로 잡혀야 한다: ${p}`);
  }
  for (const p of ['tools/codex-build.js', 'Code.js', 'docs/틀.md', 'contents_a.js', 'src/latest.js', 'tools/protest.js']) {
    assert.ok(!빌드.시험파일인가(p), `시험이 아니어야 한다: ${p}`);
  }
});

test('🔴 시험손댐 — 있던 시험을 고치거나 지우면 잡고, 새 시험·발주서가 연 것은 통과시킨다', () => {
  const 원본 = new Map([['tests/a.test.js', 'AAA'], ['tests/b.test.js', 'BBB']]);
  const 지금 = (f) => ({ 'tests/a.test.js': 'CHANGED', 'tests/b.test.js': 'BBB' }[f] ?? null);

  // ⓐ 고친 것을 잡는다
  const r1 = 빌드.시험손댐(['tests/a.test.js', 'add.js'], 원본, 지금, []);
  assert.deepStrictEqual(r1, ['tests/a.test.js (고쳤다)'], JSON.stringify(r1));

  // ⓑ 안 고친 시험·범위 안 소스는 조용하다 — 거짓 빨강이면 레인이 아예 안 돈다
  assert.deepStrictEqual(빌드.시험손댐(['tests/b.test.js', 'add.js'], 원본, 지금, []), []);

  // ⓒ 지운 것을 «지웠다»로 잡는다(내용 비교로는 못 가른다)
  const r3 = 빌드.시험손댐(['tests/z.test.js'], new Map([['tests/z.test.js', 'ZZZ']]), () => null, []);
  assert.deepStrictEqual(r3, ['tests/z.test.js (지웠다)'], JSON.stringify(r3));

  // ⓓ 새로 지은 시험은 원본에 없으니 자유다 — 이게 막히면 발주가 시험을 못 붙인다
  assert.deepStrictEqual(빌드.시험손댐(['tests/새것.test.js'], 원본, () => 'NEW', []), []);

  // ⓔ 발주서가 «이름 대어» 연 자리만 통과 — 다른 시험은 그대로 막힌다
  assert.deepStrictEqual(빌드.시험손댐(['tests/a.test.js'], 원본, 지금, ['tests/a.test.js']), []);
  assert.deepStrictEqual(빌드.시험손댐(['tests/a.test.js'], 원본, 지금, ['tests/딴것.test.js']), ['tests/a.test.js (고쳤다)']);
});

test('🔴 «시험 수정 허용» 은 시험만 연다 — 그 절로 소스·금지 경로를 열면 발주서가 거절된다', () => {
  const 열림 = (본문) => 빌드.발주서검사(발주.replace('## 금지', `## 시험 수정 허용\n${본문}\n\n## 금지`));

  const ok = 열림('- `tests/a.test.js`');
  assert.deepStrictEqual(ok.오류들, [], JSON.stringify(ok.오류들));
  assert.deepStrictEqual(ok.시험수정허용, ['tests/a.test.js']);

  const 소스 = 열림('- `Code.js`');
  assert.ok(소스.오류들.some((e) => /시험 파일이 아니다/.test(e)), JSON.stringify(소스.오류들));

  const 금지 = 열림('- `tools/codex-build.js`');
  assert.ok(금지.오류들.some((e) => /시험 파일이 아니다|만질 수 없는/.test(e)), JSON.stringify(금지.오류들));

  const 빈절 = 열림('(없음)');
  assert.ok(빈절.오류들.some((e) => /경로가 0개다/.test(e)), JSON.stringify(빈절.오류들));

  // 절이 아예 없으면 조용하고 목록은 빈다 — 기본이 «막힘»이다
  const 기본 = 빌드.발주서검사(발주);
  assert.deepStrictEqual(기본.시험수정허용, []);
  assert.deepStrictEqual(기본.오류들, [], JSON.stringify(기본.오류들));
});

test('🔴 시험지문들 — 추적 중인 시험만 지문을 뜬다(미추적 새 시험은 원래 없던 것이다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-build-jam-'));
  assert.strictEqual(spawnSync('git', ['init', '-q', 방], { encoding: 'utf8' }).status, 0);
  fs.mkdirSync(path.join(방, 'tests'));
  fs.writeFileSync(path.join(방, 'tests', 'a.test.js'), 'AAA\n');
  fs.writeFileSync(path.join(방, 'add.js'), 'x\n');
  spawnSync('git', ['-C', 방, 'add', '--', 'tests/a.test.js', 'add.js'], { encoding: 'utf8' });
  spawnSync('git', ['-C', 방, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'b', '--', 'tests/a.test.js', 'add.js'], { encoding: 'utf8' });
  fs.writeFileSync(path.join(방, 'tests', '미추적.test.js'), 'NEW\n');

  const 맵 = 빌드.시험지문들(방);
  assert.ok(맵.has('tests/a.test.js'), '추적 중인 시험은 담긴다');
  assert.ok(!맵.has('tests/미추적.test.js'), '미추적 새 시험은 안 담긴다');
  assert.ok(!맵.has('add.js'), '시험 아닌 것은 안 담긴다');

  // 실제로 고치면 지문이 갈린다 — 이 대조가 자물쇠의 몸통이다
  fs.writeFileSync(path.join(방, 'tests', 'a.test.js'), 'AAA CHANGED\n');
  const 지금 = (f) => { try { return require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(방, f))).digest('hex'); } catch (_) { return null; } };
  assert.deepStrictEqual(빌드.시험손댐(['tests/a.test.js'], 맵, 지금, []), ['tests/a.test.js (고쳤다)']);
});
