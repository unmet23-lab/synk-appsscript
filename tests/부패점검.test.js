// rot-check(주간 부패 점검 = 트리거 층) 회귀 테스트.
//
// 지키려는 성질 — 전부 「침묵으로 죽는 장치」를 막기 위한 것이다:
//   ①깨끗하면 완전 침묵(정지 조건이 무르면 루프가 매 세션 소음이 된다)
//   ②검사기가 고장 나면 **침묵하지 않는다**(고장과 청결이 같은 모양이면 이 도구는 무의미하다)
//   ③훅은 절대 차단하지 않는다(SessionStart는 세션을 막을 수 없어야 한다)
//   ④스로틀이 실제로 막는다(병행 세션 6개가 매번 같은 리포트를 붙이면 컨텍스트만 먹는다)
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'rot-check.js');
const R = require(TOOL);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotcheck-'));
const statePath = (name) => path.join(TMP, `${name}.json`);

/* 회귀는 네트워크를 안 탄다 — 라이브 대조(≈15초 pull)는 자격증명이 있는 기계에서만 서고,
 * 그걸 회귀에 태우면 CI 는 「자격증명이 없어서 초록」이 된다. 탐지력은 배포판점검 픽스처가 진다.
 * 🔑 끄는 것과 발동 배선이 사라진 것은 다르다 — 배선 자체는 아래 「등록층」 검사가 따로 본다. */
const 라이브끔 = { SYNK_ROT_LIVE: '0' };

/** 훅 모드 실행. 반환은 stdout 문자열(빈 문자열 = 침묵). */
function runHook(env = {}, extra = []) {
  return execFileSync(process.execPath, [TOOL, '--hook', ...extra], {
    input: '{"hook_event_name":"SessionStart","source":"startup"}',
    encoding: 'utf8',
    env: { ...process.env, ...라이브끔, ...env },
  });
}

test('훅 출력은 SessionStart 계약을 지킨다 — additionalContext, 차단 없음', () => {
  const out = runHook({ SYNK_ROT_STATE: statePath('contract') }, ['--force']);
  assert.ok(out, '실저장소에 낡은 인용·마찰 신호가 있는데 침묵했다');
  const j = JSON.parse(out);
  assert.strictEqual(j.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.ok(typeof j.hookSpecificOutput.additionalContext === 'string');
  assert.strictEqual(j.hookSpecificOutput.permissionDecision, undefined,
    'SessionStart가 권한 판정을 내면 나중 deny 규칙을 조용히 뚫는다');
});

test('스로틀 — 방금 돌았으면 다음 세션은 침묵한다', () => {
  const f = statePath('throttle');
  runHook({ SYNK_ROT_STATE: f }, ['--force']);          // 1회차: 상태를 찍는다
  assert.ok(fs.existsSync(f), '상태 파일을 안 남기면 매 세션 다시 돈다');
  const again = runHook({ SYNK_ROT_STATE: f });          // 2회차: 주기가 안 지났다
  assert.strictEqual(again, '', '스로틀이 안 먹으면 병행 세션마다 같은 리포트가 붙는다');
});

test('스로틀 — 주기가 지나면 다시 돈다', () => {
  const f = statePath('expired');
  fs.writeFileSync(f, JSON.stringify({ last: Date.now() - 40 * 24 * 3600 * 1000 }), 'utf8');
  assert.ok(runHook({ SYNK_ROT_STATE: f }), '40일 전 상태인데 안 돌았다 — 루프가 한 번 돌고 멈춘 것');
});

test('스로틀 판정은 주기 설정을 따른다', () => {
  const f = statePath('interval');
  fs.writeFileSync(f, JSON.stringify({ last: Date.now() - 3 * 24 * 3600 * 1000 }), 'utf8');
  const prev = { s: process.env.SYNK_ROT_STATE, d: process.env.SYNK_ROT_INTERVAL_DAYS };
  try {
    process.env.SYNK_ROT_STATE = f;
    process.env.SYNK_ROT_INTERVAL_DAYS = '7';
    assert.strictEqual(R.dueNow(Date.now()), false, '3일밖에 안 지났는데 돌 차례라고 했다');
    process.env.SYNK_ROT_INTERVAL_DAYS = '1';
    assert.strictEqual(R.dueNow(Date.now()), true, '주기 1일인데 3일 지난 걸 안 돈다고 했다');
  } finally {
    if (prev.s === undefined) delete process.env.SYNK_ROT_STATE; else process.env.SYNK_ROT_STATE = prev.s;
    if (prev.d === undefined) delete process.env.SYNK_ROT_INTERVAL_DAYS; else process.env.SYNK_ROT_INTERVAL_DAYS = prev.d;
  }
});

test('상태 파일을 못 써도 검사는 성공한다 — 쓰기 실패가 세션을 죽이면 안 된다', () => {
  // 디렉터리 자리에 파일이 있으면 mkdir이 실패한다
  const blocked = path.join(TMP, 'blocked-dir');
  fs.writeFileSync(blocked, 'not a dir', 'utf8');
  assert.doesNotThrow(() => runHook({ SYNK_ROT_STATE: path.join(blocked, 'x.json') }, ['--force']));
});

/* 2026-08-07 실측 — 이 검사의 옛 판이 위 `blocked` 픽스처를 안 쓰고 `R.stamp(Date.now(), 0)` 를
 * 맨손으로 불렀다. `SYNK_ROT_STATE` 가 없으니 도장은 **실저장소** `.claude/state/rot-check.json`
 * 에 `{findings:0}` 으로 찍혔고, 스로틀이 7일이라 그날의 🔴 3건(라이브 낡음·깨진 링크·예약작업
 * 실패)이 어느 세션에도 안 떴다. 세션 9개가 각자 스위트를 돌려 도장은 몇 분마다 갱신됐다 —
 * 주간 점검은 사실상 영구 침묵이었다. 그 내내 이 스위트는 18/18 초록이었다.
 * 그래서 고친 곳은 호출부가 아니라 **통로**다: 인프로세스로 실경로에 찍을 방법을 없앤다. */
test('상태 쓰기 함수는 export 되지 않는다 — 인프로세스 호출은 실저장소 도장을 찍는다', () => {
  assert.strictEqual(R.stamp, undefined,
    'stamp 를 내보내면 회귀가 SYNK_ROT_STATE 없이 부를 수 있고, 그 한 줄이 주간 점검을 7일 침묵시킨다');
});

/* 이 도구의 존재 이유 그 자체 — 「고장」이 「깨끗함」과 같은 모양이면 아무도 모른다.
 * 실제로 doc-graph가 SKIP 버그로 docs를 통째로 거른 적이 있고, 그때 증상은 에러가 아니라 침묵이었다. */
test('검사기가 고장 나면 침묵하지 않고 고장을 알린다', () => {
  const out = runHook({ SYNK_ROT_STATE: statePath('broken'), SYNK_MEMORY_DIR: path.join(TMP, '없는-메모리-폴더') }, ['--force']);
  assert.ok(out, '메모리 폴더가 통째로 없는데 침묵했다 — 죽은 검사기와 깨끗한 저장소가 같은 모양이 된다');
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /검사기 고장|실패/, '고장 사실이 리포트에 안 나온다');
});

test('한 검사가 죽어도 나머지는 계속 돈다', () => {
  const prev = process.env.SYNK_MEMORY_DIR;
  try {
    process.env.SYNK_MEMORY_DIR = path.join(TMP, '없는-메모리-폴더');
    const r = R.collect();
    assert.strictEqual(r.mem.ok, false, '없는 폴더인데 성공했다고 한다');
    assert.strictEqual(r.doc.ok, true, '메모리 검사가 죽자 문서 검사까지 멈췄다');
    assert.strictEqual(r.fri.ok, true, '메모리 검사가 죽자 마찰 검사까지 멈췄다');
  } finally {
    if (prev === undefined) delete process.env.SYNK_MEMORY_DIR; else process.env.SYNK_MEMORY_DIR = prev;
  }
});

test('깨끗하면 완전 침묵 — 정지 조건이 하드하다', () => {
  const clean = { mem: { ok: true, value: { decisions: { ranked: [], waiting: 0, cycles: [] }, unwired: [] } },
    doc: { ok: true }, fri: { ok: true }, red: [], warn: [], notes: [], findings: 0 };
  assert.strictEqual(R.render(clean), '', '깨끗한데 무언가 출력하면 매 세션 소음이 된다');
});

test('--json은 형식을 지키고, 🔴이 있으면 종료코드 1로 알린다', () => {
  // 실저장소는 지금 0건이 아니므로, 0건 경로는 render()로 못박고 여기선 형식·종료코드만 본다.
  // 종료코드는 스크립트에서 `&&`로 이어 쓰기 위한 계약이다 — 0건일 때만 0.
  let out, code = 0;
  try {
    out = execFileSync(process.execPath, [TOOL, '--json'], { encoding: 'utf8', env: { ...process.env, ...라이브끔 } });
  } catch (e) {
    out = e.stdout; code = e.status;
  }
  const j = JSON.parse(out);
  assert.ok(Number.isInteger(j.findings));
  assert.ok(Array.isArray(j.red) && Array.isArray(j.warn) && Array.isArray(j.notes));
  assert.strictEqual(code, j.red.length ? 1 : 0, '종료코드가 🔴 유무와 어긋난다');
});

test('마찰 신호가 기준치 이상이면 /evolve 발동 조건을 알린다', () => {
  const r = R.collect();
  if (r.fri.ok && r.fri.value.open.length >= R.EVOLVE_THRESHOLD) {
    assert.ok(r.notes.some((n) => /evolve/.test(n.kind)),
      `살아있는 신호 ${r.fri.value.open.length}건인데 알림이 없다 — 세는 것과 발동하는 것 사이가 다시 끊겼다`);
  }
});

test('SessionStart 훅이 settings.json에 실제로 등록돼 있다', () => {
  // 도구만 만들고 배선을 잊으면 트리거 층이 다시 0이 된다. 그게 이번에 고친 병이다.
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const entries = (s.hooks && s.hooks.SessionStart) || [];
  const cmds = entries.flatMap((e) => (e.hooks || []).map((h) => h.command || ''));
  assert.ok(cmds.some((c) => c.includes('rot-check.js') && c.includes('--hook')),
    'rot-check가 SessionStart에 안 걸려 있다 — 도구는 있는데 아무도 안 돌리는 상태로 되돌아갔다');
});

test('상태 파일은 git이 추적하지 않는다', () => {
  const ig = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ig, /^\.claude\/state\/$/m,
    '스로틀 상태가 추적되면 병행 세션끼리 매 실행 충돌한다');
});

/* 이식 폴더(다른 도구용 생성물) 낡음 감시 — 장치는 있는데 발동이 없어 v6.12 개정 당일
 * 폴더가 v6.11인 채로 하루를 보냈다(2026-08-03 실측). 탐지 능력은 픽스처로 못박는다 —
 * 실저장소의 낡음 여부에 기대면, 폴더를 재생성하는 순간 테스트가 빨간불이 된다. */
function withHarnessOut(dir, fn) {
  const prev = process.env.SYNK_HARNESS_OUT;
  try {
    process.env.SYNK_HARNESS_OUT = dir;
    return fn();
  } finally {
    if (prev === undefined) delete process.env.SYNK_HARNESS_OUT; else process.env.SYNK_HARNESS_OUT = prev;
  }
}

test('이식 폴더 — 스탬프가 정본과 다르면 낡음으로 잡는다 (픽스처)', () => {
  const dir = path.join(TMP, 'stale-export');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'),
    '> **생성물이다.** 정본 = SYNK-appsscript 저장소 · 지침 **v0.0 · 정본일 2026-01-01**\n', 'utf8');
  withHarnessOut(dir, () => {
    const v = R.harnessSection();
    assert.strictEqual(v.present, true);
    assert.strictEqual(v.stamp, 'v0.0');
    assert.strictEqual(v.stale, true, '스탬프가 정본과 다른데 낡음을 못 잡는다');
    const r = R.collect();
    assert.ok(r.warn.some((w) => w.kind === '이식 폴더 낡음'),
      '낡음을 알고도 리포트에 안 올린다 — 장치가 다시 침묵으로 돌아갔다');
  });
});

test('이식 폴더 — 정본과 같으면 조용하고, 아예 없으면 부패가 아니다', () => {
  const H = require(path.join(ROOT, 'tools', 'harness-export.js'));
  const fresh = path.join(TMP, 'fresh-export');
  fs.mkdirSync(fresh, { recursive: true });
  fs.writeFileSync(path.join(fresh, 'README.md'),
    `> **생성물이다.** 정본 = SYNK-appsscript 저장소 · 지침 **${H.VER} · 정본일 2026-08-03**\n`, 'utf8');
  withHarnessOut(fresh, () => {
    const v = R.harnessSection();
    assert.strictEqual(v.stale, false, '정본과 같은데 낡았다고 한다 — 거짓양성은 가드 불신을 만든다');
    assert.ok(!R.collect().warn.some((w) => w.kind === '이식 폴더 낡음'));
  });
  withHarnessOut(path.join(TMP, '없는-이식-폴더'), () => {
    const v = R.harnessSection();
    assert.strictEqual(v.present, false, '없는 폴더를 낡았다고 하면 「아직 안 씀」이 매주 경보가 된다');
    assert.ok(!R.collect().warn.some((w) => w.kind === '이식 폴더 낡음'));
  });
});

// ── 라이브 대조 배선 (2026-08-07) ────────────────────────────────────────────
// 루트 Apps Script 는 @HEAD 를 서빙해 배포 설명에 지문을 심을 자리가 없다 → deploy-freshness 훅은
// 루트에 원리상 침묵한다. 그 빈자리를 주간 점검이 진다. 여기선 **배선**만 본다(탐지력은 배포판점검 픽스처).

test('라이브를 안 켜면 네트워크를 안 타고 「미측정」으로 낸다 — 초록으로 접지 않는다', () => {
  const v = R.배포Section(false);
  assert.strictEqual(v.측정, false, '안 잰 것과 잰 것이 같은 모양이면 이 배선의 의미가 없다');
  assert.deepStrictEqual(v.결과, [], '안 재기로 했는데 결과가 있다 — 어딘가에서 실제로 쟀다는 뜻이다');
});

test('collect() 기본은 라이브를 안 잰다 — 회귀·CI 가 자격증명 없이 초록이 되면 안 된다', () => {
  const r = R.collect();
  assert.ok(r.dep && r.dep.ok, `배포판 검사기가 죽었다: ${r.dep && r.dep.error}`);
  assert.strictEqual(r.dep.value.측정, false);
  assert.ok(!r.red.some((x) => x.kind === '라이브 낡음'), '안 쟀는데 낡음 판정이 나왔다');
});

test('🔑 등록층 — 주간 실행이 실제로 라이브를 켠다 (스스로 발화하지 않는 장치는 안 돈다)', () => {
  /* 위 두 검사는 「끄면 안 돈다」만 증명한다. 끄기가 **영구 상태**가 돼 버리면 둘 다 초록인 채
   * 장치는 한 번도 안 도는데, 그 모양이 정확히 이 도구가 없애려는 침묵이다. 그래서 켜는 쪽을 본다.
   * 구조 검사인 이유: 켜진 경로는 라이브 pull(≈15초·자격증명)이라 회귀가 실제로 밟을 수 없다. */
  const src = fs.readFileSync(TOOL, 'utf8');
  assert.match(src, /SYNK_ROT_LIVE\s*!==\s*'0'/, '기본이 꺼짐으로 뒤집혔다 — 그러면 아무도 안 켠다');
  assert.match(src, /collect\(\{\s*라이브\s*\}\)/, 'main 이 collect 에 라이브를 안 넘긴다 — 플래그만 있고 배선이 없다');
  const 훅 = (JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'))
    .hooks?.SessionStart || []).flatMap((g) => g.hooks || []).find((h) => /rot-check/.test(h.command));
  assert.ok(훅, '주간 점검이 SessionStart 에 등록돼 있지 않다 — 발동 조건이 통째로 없다');
  assert.doesNotMatch(훅.command, /SYNK_ROT_LIVE=0/, '등록층에서 꺼 두면 코드가 멀쩡해도 영원히 안 돈다');
});

// ── 하루 스로틀 (F244 · 2026-08-08) ─────────────────────────────────────────
// 라이브 드리프트를 재는 유일한 재료(clasp pull)가 주간 스로틀에 묶여 있어 최대 7일 침묵했다.
// 네트워크 0 층(`안나간변경`)은 이 형태를 원리상 못 잰다 — 기준선으로 쓰는 마지막 `[vN]` 커밋
// **자신**이 push 안 된 판이면 기준선이 통째로 거짓이고, 새는 방향은 언제나 침묵이다.
// 🔑 네트워크는 안 탄다: `PATH` 를 비워 clasp 를 못 찾게 하면 조회가 즉시 실패해 「확인 불가」로 온다.
const clasp없음 = { PATH: '', APPDATA: path.join(TMP, '없는-앱데이터') };

test('하루 스로틀 — 주간이 안 지나도 라이브 배포 대조는 다시 돈다', () => {
  const f = statePath('배포하루');
  const now = Date.now();
  fs.writeFileSync(f, JSON.stringify({ last: now, 배포: now - 2 * 24 * 3600 * 1000 }), 'utf8');
  const out = runHook({ SYNK_ROT_STATE: f, SYNK_ROT_LIVE: '1', ...clasp없음 });
  assert.ok(out, '주간은 안 지났고 배포만 하루가 지났는데 침묵했다 — 하루 스로틀이 안 열린다');
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /라이브 미측정|라이브 낡음|배포 판정 불가/, '배포 절이 리포트에 없다 — 열렸는데 재지 않았다');
  assert.doesNotMatch(ctx, /결정 큐/, '하루짜리 알림에 주간 리포트가 딸려 왔다 — 소음은 읽히지 않아 침묵과 같은 값이다');
});

test('남이 고치는 중인 배포 파일은 「push 가 빠졌다」가 아니다 — 하루 알림이 매일 거짓말하면 무시당한다', () => {
  /* 라이브대조는 **작업본**을 잰다(clasp 가 미는 것이 작업본이라서다). 주간일 땐 드물어 안 보였고
   * 하루로 당기는 순간 흔해진다 — 실측 2026-08-08: 남이 12:44 에 고친 두 파일이 12:51 대조에서
   * 그대로 🔴 로 나왔다. 전부 미커밋일 때만 보류고, 하나라도 깨끗하면 진짜 안 나간 것이다. */
  // 🔑 `appsscript.json` 은 **접두어 붙은 형태로만** 넣는다 — 맨이름도 같이 넣으면 접두어를 안 붙여도
  //    통과해서, 「하위 프로젝트 경로를 안 붙인다」는 결함을 이 검사가 못 잡는다(첫 판이 그랬다).
  const 미커밋 = new Set(['Code.js', '엔진_운영배치.js', 'crewcard/appsscript.json']);
  assert.strictEqual(R.편집중인가(['Code.js', '엔진_운영배치.js'], ROOT, 미커밋), true);
  assert.strictEqual(R.편집중인가(['Code.js', 'contents_1.js'], ROOT, 미커밋), false,
    '하나라도 커밋돼 있으면 그건 진짜 안 나간 것이다 — 보류로 접으면 소급 불가 손실을 숨긴다');
  assert.strictEqual(R.편집중인가(['appsscript.json'], path.join(ROOT, 'crewcard'), 미커밋), true,
    '하위 프로젝트 경로를 안 붙이면 형제 저장소 파일이 영영 안 걸린다');
  assert.strictEqual(R.편집중인가(['appsscript.json'], ROOT, 미커밋), false,
    '루트 파일을 하위 프로젝트 것으로 읽었다 — 접두어가 양방향으로 서야 한다');
  assert.strictEqual(R.편집중인가(['Code.js'], ROOT, null), false,
    'git 을 못 읽은 것은 「편집 중」이 아니다 — 모름을 보류로 접으면 진짜 낡음이 조용해진다');
  assert.strictEqual(R.편집중인가([], ROOT, 미커밋), false, '파일이 0개면 보류할 것도 없다');
});

test('라이브 대조 상한 × 프로젝트 수가 훅 예산 안에서 끝난다', () => {
  /* 기본 120초는 훅 예산(60초)보다 길다 — 네트워크가 멎으면 훅이 통째로 죽고 **아무것도 안 찍힌다.**
   * 프로젝트가 늘면 이 검사가 먼저 빨개진다(상한을 내리든 훅 timeout 을 올리든 사람이 정한다). */
  const 훅 = (JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'))
    .hooks?.SessionStart || []).flatMap((g) => g.hooks || []).find((h) => /rot-check/.test(h.command));
  const m = fs.readFileSync(TOOL, 'utf8').match(/배포_대조_한도\s*=\s*(\d+)/);
  assert.ok(m, '대조 상한 상수가 사라졌다 — 기본값으로 돌아가면 훅 예산을 넘는다');
  const 프로젝트수 = require(path.join(ROOT, 'tools', '배포판점검.js')).claspProjects().length;
  assert.ok(프로젝트수 >= 1, 'clasp 프로젝트가 0개로 읽혔다 — 그러면 이 검사는 무엇이든 통과시킨다');
  assert.ok((Number(m[1]) * 프로젝트수) / 1000 < 훅.timeout,
    `최악 ${(Number(m[1]) * 프로젝트수) / 1000}초 > 훅 예산 ${훅.timeout}초 — 멎으면 리포트가 통째로 사라진다`);
  /* 상수가 있는 것과 그게 네트워크 호출까지 **닿는** 것은 다르다 — 끊기면 상수만 남고 기본 120초로
   * 돈다(초록인 채). 실행으로는 못 밟는 구간(clasp pull)이라 배선을 글자로 못박는다. */
  const 점검src = fs.readFileSync(path.join(ROOT, 'tools', '배포판점검.js'), 'utf8');
  const 시작 = 점검src.indexOf('function 점검(');
  assert.notStrictEqual(시작, -1, '`점검` 을 못 찾았다 — 앵커가 낡으면 이 검사는 무엇이든 통과시킨다');
  assert.match(점검src.slice(시작, 점검src.indexOf('\n}', 시작)), /라이브대조\([^)]*timeout:\s*시간제한/,
    '`점검` 이 시간제한을 라이브대조에 안 넘긴다 — 상한이 있는데 안 닿으면 없는 것과 같다');
});

test('두 도장은 서로를 안 지운다 — 통째로 덮으면 스로틀 둘이 다 무의미해진다', () => {
  const f = statePath('도장합침');
  const 옛배포 = Date.now() - 3 * 3600 * 1000;
  fs.writeFileSync(f, JSON.stringify({ last: 0, 배포: 옛배포 }), 'utf8');
  runHook({ SYNK_ROT_STATE: f }, ['--force']);   // 주간 도장은 찍히고, 라이브는 꺼져 있어 배포는 미측정
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.ok(s.last > 0, '주간 도장이 안 찍혔다');
  assert.strictEqual(s.배포, 옛배포, '주간 도장이 배포 도장을 지웠다 — 그러면 라이브 대조가 매 세션 다시 돈다');
});

test('못 잰 날엔 배포 도장을 안 찍는다 — 찍으면 안 잰 하루가 조용히 사라진다', () => {
  const f = statePath('미측정도장');
  const 옛배포 = Date.now() - 2 * 24 * 3600 * 1000;
  fs.writeFileSync(f, JSON.stringify({ last: Date.now(), 배포: 옛배포 }), 'utf8');
  runHook({ SYNK_ROT_STATE: f });                // 라이브끔 → 측정 자체를 안 했다
  assert.strictEqual(JSON.parse(fs.readFileSync(f, 'utf8')).배포, 옛배포,
    '안 쟀는데 도장을 찍었다 — 미측정이 통과와 같은 모양이 되는 그 자리다');
});

test('harness-export는 require로 불러도 생성기가 돌지 않는다', () => {
  // rot-check가 주간마다 require하는데 그때마다 바탕화면 폴더를 지우고 다시 만들면
  // 점검기가 곧 부작용 기계가 된다 — require 무해성을 실행으로 못박는다.
  const toolPath = path.join(ROOT, 'tools', 'harness-export.js');
  const out = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(toolPath)})`], { encoding: 'utf8' });
  assert.strictEqual(out, '', 'require만 했는데 내보내기 로그가 찍혔다 — 생성이 실행된 것');
  const H = require(toolPath);
  assert.ok(H.DEFAULT_OUT && /v[\d.]+/.test(H.VER), '경로·정본 버전을 내보내지 않는다');
});
