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
  assert.doesNotThrow(() => R.stamp(Date.now(), 0));
  assert.doesNotThrow(() => runHook({ SYNK_ROT_STATE: path.join(blocked, 'x.json') }, ['--force']));
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

test('harness-export는 require로 불러도 생성기가 돌지 않는다', () => {
  // rot-check가 주간마다 require하는데 그때마다 바탕화면 폴더를 지우고 다시 만들면
  // 점검기가 곧 부작용 기계가 된다 — require 무해성을 실행으로 못박는다.
  const toolPath = path.join(ROOT, 'tools', 'harness-export.js');
  const out = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(toolPath)})`], { encoding: 'utf8' });
  assert.strictEqual(out, '', 'require만 했는데 내보내기 로그가 찍혔다 — 생성이 실행된 것');
  const H = require(toolPath);
  assert.ok(H.DEFAULT_OUT && /v[\d.]+/.test(H.VER), '경로·정본 버전을 내보내지 않는다');
});
