'use strict';
/* 회귀가 «산 세션들의 공유 상태 폴더»에 픽스처를 쓰지 않는다 — 4번째가 못 생기게 한다.
 *
 * ■ 실사고 (2026-08-15 · 세션 376f6598)
 *   HEAD 를 핀 박아 전량을 돌리니 **3583건 중 1건**만 빨갰다(`보드이관` — 「산 주인이면
 *   기다린다」). 그런데 그 파일만 단독으로 다시 돌리니 **54/54 초록**이었다. 경합이다.
 *   기전: 픽스처가 심장박동을 `handoff-store` 의 STATE_DIR 에 쓰는데 그 기본값이
 *   `os.tmpdir()/synk-context-budget` — **이 머신의 모든 세션이 공유하는 폴더**다. 남의
 *   `sweep()` 은 `if (!j.at || 나이>ttl) unlink` 라 `at` 없는 박동을 **나이와 무관하게 즉시**
 *   지운다. 그래서 「산 주인」이 「죽었다」로 보이고, 시험은 빨개진다.
 *
 * ■ 왜 이 검사가 있어야 하나 — **거짓 적색과 진짜 적색이 같은 모양**이기 때문이다
 *   이 적색은 전량 실행에서만, 그것도 세션이 여럿 도는 시간대에만 난다. 실제로 그 적색을
 *   본 세션(`3a029050`)은 「🔴 test-ci 미판정(못 믿는 적색)」이라 적고 판정을 비웠다.
 *   주인 없는 적색은 이 저장소 **모든 세션의 배포 게이트**를 막는다.
 *
 * ■ 이 기전은 2026-08-11 에 이미 적혀 있었다 (그래서 조항이 아니라 기계로 막는다)
 *   `tests/이종검수.test.js` 의 「표식은 남이 청소하는 폴더에 두지 않는다」가 같은 sweep
 *   규칙을 그대로 적고 자기 표식을 옮겼다. 그런데 **박동을 쓰는 회귀 3벌은 그대로 남아**
 *   넉 달째 같은 자리를 밟았다. 프로즈는 자기 파일만 지킨다 — CLAUDE.md 신뢰성 「3번째 =
 *   원인을 쓸 수 없게 만든다」대로 공용 통로(`tests/lib/상태격리.js`) + 이 검사로 닫는다.
 *
 * ■ 새 장치의 대가 (맹점 ④ — 안 도는 쪽보다 «맞는 얼굴로 틀린 값» 쪽으로 더 샌다)
 *   · 틀릴 때의 모습 = `stateDir()` 을 **읽기만** 하는 정당한 파일을 위반으로 잡는 거짓양성.
 *     실제로 그런 파일이 하나 있다(`이종검수` — 자기 표식이 그 폴더 «밖»인지 재는 검사라
 *     진짜 좌표를 봐야 한다). 그래서 예외를 목록으로 두되, **사유를 적게 하고 낡으면
 *     빨개지게** 했다(아래 「예외가 낡으면 빨개진다」).
 *   · 닫은 것 1개 = 판정을 파일마다 베끼던 것(3벌)을 공용 통로 한 벌로 모았다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 코드만 } = require('./lib/소스검사');

const TESTS = __dirname;
const 공용통로 = path.join(TESTS, 'lib', '상태격리.js');

/* 예외 = `stateDir()` 을 **읽기만** 하는 파일. 사유가 비면 예외로 안 친다. */
const 예외 = new Map([
  ['이종검수.test.js',
    '자기 표식이 handoff-store 청소 구역 «밖»인지 재는 검사라 진짜 좌표를 봐야 한다(08-11 F333 재발 경로).'],
]);

/** 한 파일의 판정 — { 쓴다, 격리됨 }. **주석은 지우고** 본다(가드는 자기 주석에 눈이 먼다).
 *
 * ⚠ 천장을 숨기지 않는다 — `코드만()` 은 주석만 지우고 **문자열 리터럴은 남긴다**(그 모듈의
 *   계약이 그렇다: 문자열도 코드다). 그래서 `'… stateDir() …'` 같은 «본문 속 예시»가 든 파일은
 *   이 판정기에 걸린다. 저장소에서 그런 파일은 **이 시험 자신** 하나뿐이고(아래 픽스처가
 *   두 모양을 다 문자열로 들고 있어야 한다), 그래서 자기 자신을 분모에서 뺀다.
 *   🔑 여기서 문자열 스트리퍼를 새로 짜지 않는 이유 = 그게 F401 이 사본 7벌을 걷어낸 자리다.
 *   지역 사본을 하나 더 만들면 그 사본이 다음 마찰이 된다. */
function 재기(본문) {
  const 코드 = 코드만(본문);
  return {
    쓴다: /stateDir\s*\(\s*\)/.test(코드),
    격리됨: /격리된store\s*\(/.test(코드),
  };
}

/** 위반 = stateDir() 을 쓰는데 공용 통로를 안 지난 파일. */
function 위반들(파일들) {
  const out = [];
  for (const p of 파일들) {
    if (path.resolve(p) === path.resolve(공용통로)) continue;   // 통로 자신은 대상이 아니다
    if (path.resolve(p) === path.resolve(__filename)) continue; // 판정기 자신(위 ⚠ 사유)
    const r = 재기(fs.readFileSync(p, 'utf8'));
    if (!r.쓴다 || r.격리됨) continue;
    if (예외.get(path.basename(p))) continue;
    out.push(path.basename(p));
  }
  return out;
}

const 회귀파일들 = () => fs.readdirSync(TESTS)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(TESTS, f));

/* ── ① 탐지력은 픽스처가 진다 ─────────────────────────────────────────────
 * 실저장소로 탐지력을 재면 「지금 0건」이 통과와 같은 모양이 되어, 판정기가 죽어도 초록이다. */
test('탐지력 — 공용 통로를 안 지나고 stateDir() 을 쓰면 위반으로 잡는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stateiso-fx-'));
  const 위반파일 = path.join(dir, '나쁜.test.js');
  fs.writeFileSync(위반파일, [
    "const store = require('../.claude/hooks/lib/handoff-store.js');",
    'const 박동 = path.join(store.stateDir(), "track-x.json");',
    'fs.mkdirSync(store.stateDir(), { recursive: true });',
  ].join('\n'), 'utf8');
  assert.deepEqual(위반들([위반파일]), ['나쁜.test.js'], '위반을 못 잡는다 — 판정기가 죽었다');
});

test('거짓양성 — 공용 통로를 지나면 안 잡는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stateiso-fx-'));
  const 착한파일 = path.join(dir, '착한.test.js');
  fs.writeFileSync(착한파일, [
    "const { 격리된store } = require('./lib/상태격리');",
    'const store = 격리된store(__filename);',
    'fs.mkdirSync(store.stateDir(), { recursive: true });',
  ].join('\n'), 'utf8');
  assert.deepEqual(위반들([착한파일]), [], '격리된 파일을 위반으로 잡는다 — 거짓양성');
});

test('🔴 주석 속 stateDir() 은 위반이 아니다 — 검사가 자기 설명을 신고하면 안 된다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stateiso-fx-'));
  const p = path.join(dir, '설명뿐.test.js');
  fs.writeFileSync(p, [
    '/* 박동을 store.stateDir() 에 쓰면 남의 sweep 이 지운다 — 그래서 안 쓴다. */',
    '// store.stateDir() 은 공유 폴더다',
    'const x = 1;',
  ].join('\n'), 'utf8');
  assert.deepEqual(위반들([p]), [], '설명을 코드로 읽었다 — 코드만() 이 안 걸렸다');
});

/* ── ② 실저장소에는 거짓양성만 묻는다 ────────────────────────────────── */
test('실저장소 — 공유 상태 폴더에 픽스처를 쓰는 회귀가 0벌이다', () => {
  const 파일들 = 회귀파일들();
  assert.ok(파일들.length > 50, `분모가 이상하다(${파일들.length}벌) — 스위트를 못 걷었다`);
  const 샌다 = 위반들(파일들);
  assert.deepEqual(샌다, [],
    `이 회귀들이 산 세션의 공유 폴더에 박동을 쓴다 — 남의 sweep 이 지워 «못 믿는 적색»이 된다.\n`
    + `  → tests/lib/상태격리.js 의 격리된store(__filename) 로 갈아 끼운다.\n  ${샌다.join(' · ')}`);
});

test('예외가 낡으면 빨개진다 — 없는 파일이나 실제로 안 쓰는 파일이 예외에 남지 않는다', () => {
  for (const [이름, 사유] of 예외) {
    const p = path.join(TESTS, 이름);
    assert.ok(fs.existsSync(p), `예외에 적힌 ${이름} 가 없다 — 목록이 낡았다`);
    assert.ok(사유 && 사유.length > 20, `${이름} 의 예외 사유가 비었다 — 사유 없는 예외는 예외가 아니다`);
    const r = 재기(fs.readFileSync(p, 'utf8'));
    assert.ok(r.쓴다, `${이름} 는 더 이상 stateDir() 을 안 쓴다 — 예외에서 빼라`);
  }
});

/* ── ③ 공용 통로가 실제로 좌표를 가는가 (선언이 아니라 프로세스로 잰다) ── */
const 자식 = (본문) => spawnSync(process.execPath, ['-e', 본문], {
  encoding: 'utf8',
  cwd: path.join(TESTS, '..'),
  env: { ...process.env, SYNK_CTXBUDGET_DIR: '' },
});

test('격리된store 는 STATE_DIR 을 이 시험 전용으로 간다 (기본 공유 폴더가 아니다)', () => {
  const r = 자식([
    "const { 격리된store } = require('./tests/lib/상태격리');",
    "const s = 격리된store('여기.test.js');",
    'process.stdout.write(s.stateDir());',
  ].join('\n'));
  assert.equal(r.status, 0, '통로가 죽었다: ' + r.stderr);
  const 기본 = path.join(os.tmpdir(), 'synk-context-budget');
  assert.notEqual(path.resolve(r.stdout), path.resolve(기본), '여전히 공유 폴더를 쓴다 — 격리가 안 됐다');
  assert.ok(r.stdout.includes('state-'), `전용 폴더 이름이 아니다: ${r.stdout}`);
});

test('🔴 handoff-store 를 먼저 require 했으면 조용히 넘어가지 않고 던진다 (순서가 이 통로의 전부다)', () => {
  /* 🔴 표식을 «서로의 부분문자열이 아닌» 두 낱말로 고른다 — 첫 판이 `던졌다`/`안던졌다` 였고
   *   `/던졌다/` 가 **`안던졌다` 에도 맞아** 변이가 통과했다(변이 실측 2026-08-15 · 구멍 1건).
   *   부정형이 긍정형을 품는 것은 한국어에서 기본값이라, 이 자리는 늘 이렇게 가른다. */
  const r = 자식([
    "require('./.claude/hooks/lib/handoff-store.js');",          // ← 먼저 굳혀 버린다
    "const { 격리된store } = require('./tests/lib/상태격리');",
    "try { 격리된store('여기.test.js'); process.stdout.write('MUTANT-SILENT'); }",
    "catch (e) { process.stdout.write('THREW:' + e.message); }",
  ].join('\n'));
  assert.equal(r.status, 0, '자식이 죽었다: ' + r.stderr);
  assert.doesNotMatch(r.stdout, /MUTANT-SILENT/,
    '먼저 굳은 STATE_DIR 을 그대로 쓰고 넘어갔다 — 격리한 줄 알고 공유 폴더에 쓰게 된다');
  assert.match(r.stdout, /THREW:.*격리된store/, '던지긴 했는데 고치는 법을 안 알려준다: ' + r.stdout);
});
