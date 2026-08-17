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
/* 🔑 회차 장부 축(④-㉡)도 같이 끈다 — 그쪽은 형제 저장소의 도구를 **스폰해 네트워크를 탄다.**
 *   안 끄면 이 파일의 모든 훅 실행이 `api.supabase.com` 을 부르고, 자격증명 없는 기계(CI)에선
 *   그게 「미측정」 메모로 새어 나와 침묵 검사(정지 조건)를 통째로 무르게 만든다. */
const 라이브끔 = { SYNK_ROT_LIVE: '0', SYNK_ROT_LEDGER: '0' };

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

/* 🔴 이 검사는 **낡아서 빨갰다**(2026-08-13 실측 · F403 트랙에서 잡음). `open`(전체 열림)으로
 *   단언했는데 도구는 `새로`(지난 개정 뒤 신규)로 발동한다 — 같은 판정을 두 곳에 적어 갈라진
 *   자리다(가드 맹점 ④). 갈린 뒤로 「open 4 · 새로 0」이 되어 **아무도 못 고치는 적색**이었다:
 *   지침을 오늘 개정하면 오늘 난 신호는 전부 `묵은` 으로 떨어지므로, 이 단언을 만족시키는
 *   유일한 길이 「열린 행을 전부 닫기」가 된다. 따를 수 없는 처방은 방치를 정상으로 만든다(F103).
 *
 * 🔑 도구가 옳다 — `tools/rot-check.js:95` 가 그 판정을 직접 적어 두었다: 지침의 「마찰 신호
 *   2건」은 **새로 난** 둘이지 열린 전량이 아니다. 묵은 것은 갈래가 다른 warn 이 따로 낸다(F386).
 *   그래서 검사를 도구의 축으로 맞춘다. 대신 **탐지력은 픽스처가 진다** — 실저장소만 보면
 *   `새로` 가 0인 날엔 이 검사가 통째로 미실행이고, 미실행은 통과와 같은 모양이다(F207). */
/** 픽스처 장부를 물려 rot-check 를 **자식으로** 띄운다. 이음매는 friction.js 가 이미 가진
 *  `SYNK_FRICTION_LEDGER` 다 — 도구를 고치지 않는다(회귀를 위해 통로를 새로 뚫으면 그 통로가
 *  본선과 갈라진다). 날짜를 미래·과거로 잡아 실저장소의 「마지막 개정」 기준점 하나만 빌린다. */
function 장부물려(이름, 행들) {
  const 장부 = path.join(TMP, `${이름}.md`);
  fs.writeFileSync(장부, '| ID | 날짜 | 종류 | 신호 | 해소 |\n|---|---|---|---|---|\n'
    + 행들.map(([id, 날짜]) => `| ${id} | ${날짜} | 마찰 | 신고 ${id} | |`).join('\n') + '\n');
  /* 🔴 이 도구는 **적색이 있으면 종료코드 1**로 끝난다(위 `--json` 검사가 그 계약이다).
   * 실저장소엔 늘 적색이 있으므로 던진 것을 안 받으면 이 검사들은 「도구가 죽었다」로 빨개진다 —
   * 실제로 그렇게 3건이 빨갰다. stdout 은 그 갈래에서도 온전하다. */
  let out;
  try {
    out = execFileSync(process.execPath, [TOOL, '--json'], {
      encoding: 'utf8', env: { ...process.env, ...라이브끔, SYNK_FRICTION_LEDGER: 장부 },
    });
  } catch (e) { out = e.stdout; }
  return JSON.parse(out);
}
const evolve알림 = (j) => j.notes.some((n) => /evolve/.test(n.kind));

test('🔑 탐지 — 지난 개정 뒤 신호가 기준치를 넘으면 /evolve 발동을 알린다 (픽스처)', () => {
  const j = 장부물려('발동', [['F901', '2099-01-02'], ['F902', '2099-01-03']]);
  assert.ok(evolve알림(j),
    '세는 것과 발동하는 것 사이가 다시 끊겼다 — 트리거 층이 0이 되는 그 병이다(F019)');
});

test('거짓양성 — 기준 이전(묵은) 신호만으로는 /evolve 를 발동하지 않는다', () => {
  const j = 장부물려('묵은', [['F903', '1999-01-01'], ['F904', '1999-01-02']]);
  assert.ok(!evolve알림(j),
    '이미 그 판을 지난 신호로 개정을 또 제안한다 — 매번 뜨는 제안은 그 순간부터 안 읽힌다');
});

test('거짓양성 — 기준을 넘긴 신호가 하나뿐이면 발동하지 않는다 (문턱이 실제로 문턱인가)', () => {
  const j = 장부물려('하나', [['F905', '2099-01-02'], ['F906', '1999-01-02']]);
  assert.ok(!evolve알림(j), `기준 ${R.EVOLVE_THRESHOLD}건인데 1건으로 발동했다`);
});

test('실저장소 — 도구가 실제로 쓰는 축(새로)과 어긋나지 않는다', () => {
  const r = R.collect();
  if (!r.fri.ok) return;                       // 못 읽음은 위 「검사기 고장」 검사의 몫이다
  const 알림 = r.notes.some((n) => /evolve/.test(n.kind));
  assert.strictEqual(알림, r.fri.value.새로.length >= R.EVOLVE_THRESHOLD,
    `알림(${알림})이 새로 난 신호 ${r.fri.value.새로.length}건(기준 ${R.EVOLVE_THRESHOLD})과 어긋난다`);
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

test('🔑 라이브를 켠 실행은 결과마다 도장 재료(`실측{지문,초록}`)를 붙인다 — 이게 없으면 아래 층이 영원히 안 재워진다', () => {
  /* 2026-08-10 · F244 후속. 네트워크 0 층(`배포판점검.안나간변경`)은 **채번 기준선**(`Code.js` 의
   * `const SYNK_VERSION` 이 바뀐 마지막 커밋 · 2026-08-14 #Q75 전엔 제목의 `[vN]` 이었다)이
   * 양방향으로 틀려 매 SessionStart 거짓 🔴 를 낼 수 있고, 그걸 재우는 유일한 재료가 여기서 잰 값이다.
   * 이 한 줄이 죽으면 `배포도장()` 은 늘 **빈 도장**을 내고 아래 층은 조용히 옛 동작으로
   * 퇴화한다 — 죽는 모양이 「원래 그랬던 것」이라 아무 데서도 안 빨개진다. 그래서 여기서 문다.
   * 시간제한 1ms 로 네트워크를 일부러 죽인다: **못 읽은 갈래에도** 재료가 붙어야 도장이 정직해진다
   * (그 경우 `초록:false` 로 남아 「안 재움」이 되는 것이 옳은 답이다). */
  const v = R.배포Section(true, 1);
  assert.strictEqual(v.측정, true);
  assert.ok(v.결과.length, '프로젝트가 하나도 안 잡혔다 — 분모 0 은 통과가 아니다(F207)');
  for (const r of v.결과) {
    assert.ok(r.실측 && typeof r.실측 === 'object', `${r.이름}: 도장 재료가 없다 — 도장이 영원히 빈다`);
    assert.strictEqual(typeof r.실측.초록, 'boolean', `${r.이름}: 초록이 boolean 이 아니다`);
    assert.ok(r.실측.지문 === null || /^[0-9a-f]{8}$/.test(r.실측.지문),
      `${r.이름}: 지문 모양이 다르다 — 읽는 쪽이 대조를 못 한다: ${r.실측.지문}`);
  }
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
  assert.match(src, /collect\(\{\s*라이브,\s*장부:\s*장부켬\s*\}\)/, 'main 이 collect 에 라이브를 안 넘긴다 — 플래그만 있고 배선이 없다');
  const 훅 = (JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'))
    .hooks?.SessionStart || []).flatMap((g) => g.hooks || []).find((h) => /rot-check/.test(h.command));
  assert.ok(훅, '주간 점검이 SessionStart 에 등록돼 있지 않다 — 발동 조건이 통째로 없다');
  assert.doesNotMatch(훅.command, /SYNK_ROT_LIVE=0/, '등록층에서 꺼 두면 코드가 멀쩡해도 영원히 안 돈다');
});

// ── 하루 스로틀 (F244 · 2026-08-08) ─────────────────────────────────────────
// 라이브 드리프트를 재는 유일한 재료(clasp pull)가 주간 스로틀에 묶여 있어 최대 7일 침묵했다.
// 네트워크 0 층(`안나간변경`)은 이 형태를 원리상 못 잰다 — 기준선으로 쓰는 마지막 **채번 커밋**
// **자신**이 push 안 된 판이면 기준선이 통째로 거짓이고, 새는 방향은 언제나 침묵이다.
// (#Q75 로 기준선 재료가 제목 `[vN]` → `Code.js` 의 `const SYNK_VERSION` 으로 바뀌었지만, 이
//  천장은 그대로다 — 바뀐 것은 「채번을 못 보던 자리」이지 「채번 ≠ 배포」가 아니다.)
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

/* ── [F386] /evolve 알림의 분모 ────────────────────────────────────────────
 * 지침은 「굵직한 마찰 신호 2건이면 개정을 제안한다」고 하는데, 그 2건은 **새로 난** 둘이지
 * 누적 열림 둘이 아니다. 구현이 누적을 세는 바람에 40건이 쌓인 시점에 이 알림은 «영구히»
 * 켜져 있었고, 켜져 있는 알림은 안 읽힌다(F370 과 같은 병 — 침묵하도록 설계된 자리가 상시로
 * 운다). 기준점은 지침 이력의 마지막 개정 날짜다 — 나이는 기계가 정확히 아는 축이다. */

test('🔑 [F386] 마지막 개정 날짜 — 두 표기를 다 읽고 «가장 최근»을 고른다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-rot-evolve-'));
  const f = path.join(dir, '지침_이력.md');
  /* 실제 문서에 두 표기가 섞여 있다 — 하나만 읽으면 기준점이 과거로 밀리고,
   * 밀린 기준점은 묵은 행을 「새로 났다」로 세어 알림 포화가 그대로 돌아온다. */
  fs.writeFileSync(f, [
    '# 지침 이력', '', '## v8.6 (2026-08-08) — 괄호 표기', '본문',
    '## v8.7 — 2026-08-09 · 붙임표 표기', '본문',
    '## v8.8 (2026-08-10) — 괄호 표기', '본문',
    '## 재론 금지 — 2026-08-11 은 개정이 아니다', '이 줄의 날짜를 집으면 기준점이 미래로 샌다',
  ].join('\n'), 'utf8');
  assert.strictEqual(R.마지막개정(f), '2026-08-10');
  assert.strictEqual(R.마지막개정(path.join(dir, '없는파일.md')), null,
    '기준점을 못 읽었는데 날짜를 지어냈다 — 모름은 통과가 아니다');
});

test('🔑 [F386] 실장부 — 열림이 새로/묵은으로 «빠짐없이» 갈리고 보류는 어느 쪽도 아니다', () => {
  const v = R.frictionSection();
  assert.ok(v.기준, '기준점(마지막 개정)을 못 읽었다 — 못 읽으면 옛 동작(전량)으로 되돌아간다');
  assert.strictEqual(v.새로.length + v.묵은.length, v.open.length,
    `열림이 새로/묵은으로 안 갈렸다 — 새로 ${v.새로.length} + 묵은 ${v.묵은.length} ≠ 열림 ${v.open.length}`);
  const 열림id = new Set(v.open.map((r) => r.id));
  assert.ok(v.보류.every((r) => !열림id.has(r.id)),
    '보류가 열림에도 세어졌다 — /evolve 알림이 판정 끝난 행으로 다시 포화된다');
  assert.ok(v.새로.every((r) => r.date > v.기준) && v.묵은.every((r) => r.date <= v.기준),
    '날짜 가르기가 기준점을 안 지킨다');
});

// ── 회차 장부 축 (조용한 실패 장부 ④-㉡ · 2026-08-15) ────────────────────────
// 형제(SYNK-talk)의 cron 장부는 「부르면 답할 뿐」이라 아무도 안 부르면 조용하다 — 실측: radio 잡이
// url NULL 로 16회 전부 죽었는데 15시간 아무도 몰랐다. 여기서 6시간마다 먼저 말하게 한다.
// 🔑 탐지력은 전부 **픽스처**가 진다(F296) — 실저장소 경로는 자격증명·네트워크에 기대고, 그 기계에서
//    깨지는 검사는 곧 꺼진다. 실저장소에는 「거짓양성이 없나」만 남긴다.
const 장부픽스처 = (이름, 본문) => {
  const 뿌리 = path.join(TMP, `형제-${이름}`);
  fs.mkdirSync(path.join(뿌리, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(뿌리, 'tools', '회차장부.js'), 본문, 'utf8');
  return [{ 뿌리, 저장소: `형제-${이름}` }];
};

test('🔑 판정 갈래 — 「아직 안 부었다」는 조용하고 「돌았는데 안 적혔다」는 적색이다', () => {
  const 판정 = (v) => R.장부판정(v);
  const 하나 = (g, 섰던적 = false) => 판정({ 측정: true, 섰던적, 결과: [{ 저장소: 'talk', ...g }] });

  // ⏳유호(companion 승인 묶음)를 기다리는 상태 — 6시간마다 우는 경보가 되면 승인 날엔 아무도 안 읽는다
  const 미적용 = 하나({ 판정: 2, 판: false });
  assert.strictEqual(미적용.red.length + 미적용.notes.length, 0, '판 미적용이 경보를 냈다 — 매 6시간 거짓 적색이 된다');

  const 초록 = 하나({ 판정: 0, 판: true, 안적힘: 0, 이상: 0 });
  assert.strictEqual(초록.red.length + 초록.notes.length, 0, '이상 0인데 소리를 냈다');

  const 침묵 = 하나({ 판정: 1, 판: true, 안적힘: 7, 이상: 0, 과녁: 'ref' });
  assert.strictEqual(침묵.red.length, 1);
  assert.match(침묵.red[0].kind, /침묵/, '장부 자신이 안 불린 것과 cron 이상이 같은 문구면 처방이 갈리지 않는다');

  const 이상 = 하나({ 판정: 1, 판: true, 안적힘: 0, 이상: 16, 과녁: 'ref', 최근이상: [{ jobname: 'radio-promote-hourly', outcome: '발사실패' }] });
  assert.strictEqual(이상.red.length, 1);
  assert.match(이상.red[0].text, /radio-promote-hourly→발사실패/, '어느 잡이 죽었는지가 안 실렸다 — 「이상 16건」만으론 열 대상이 없다');

  // 스폰·파싱이 죽은 것 = 못 잼. 적색은 아니지만 침묵도 아니다.
  const 못잼 = 하나({ 못잼: true, 사유: 'timeout' });
  assert.strictEqual(못잼.red.length, 0);
  assert.strictEqual(못잼.notes.length, 1);
});

test('🔑 판정 2 안의 두 갈래 — 「판이 없다」와 「판을 못 열었다」는 처방이 다르다', () => {
  /* 자격증명이 죽었을 때 `판: null` 이 온다. 이걸 「아직 안 부었다」와 뭉치면 그 창이 통째로
   * 조용해진다 — 이 축이 막으려는 병 그 자체다(0건과 못 잼이 같은 모양). */
  const 못열었다 = R.장부판정({ 측정: true, 섰던적: false, 결과: [{ 저장소: 'talk', 판정: 2, 판: null, 사유: 'HTTP 401' }] });
  assert.strictEqual(못열었다.notes.length, 1, '판을 못 연 것이 조용히 넘어갔다');
  assert.match(못열었다.notes[0].text, /401/, '왜 못 열었는지가 안 실렸다');
});

test('🔑 래치 — 한 번 섰던 판이 사라지면 적색이다 (안 그러면 「아직 안 부었네」와 같은 모양이 된다)', () => {
  const g = { 저장소: 'talk', 판정: 2, 판: false };
  assert.strictEqual(R.장부판정({ 측정: true, 섰던적: false, 결과: [g] }).red.length, 0);
  const 사라짐 = R.장부판정({ 측정: true, 섰던적: true, 결과: [g] });
  assert.strictEqual(사라짐.red.length, 1, '섰던 판이 사라졌는데 조용했다');
  assert.match(사라짐.red[0].kind, /사라졌다/);

  // 도장은 켜기만 한다 — 끄면 다음 회차부터 위 갈래가 영영 안 열린다
  assert.deepStrictEqual(R.장부도장({ 결과: [{ 판: true }] }), { 장부섰나: true });
  assert.deepStrictEqual(R.장부도장({ 결과: [{ 판: false }] }), {}, '판이 없다고 래치를 껐다 — 그러면 「사라졌다」를 영영 못 낸다');
});

test('🔑 종료 코드 1·2 는 고장이 아니라 판정이다 — status!==0 을 「못 잼」으로 번역하면 적색이 사라진다', () => {
  const 형제 = 장부픽스처('적색', 'process.stdout.write(JSON.stringify({도구:"회차장부",판:true,판정:1,안적힘:3,이상:0,과녁:"ref"})+"\\n");process.exitCode=1;\n');
  const v = R.장부Section(true, 형제);
  assert.strictEqual(v.측정, true);
  assert.strictEqual(v.결과.length, 1);
  assert.strictEqual(v.결과[0].못잼, undefined, 'exit 1 을 고장으로 읽었다 — 진짜 적색이 통째로 사라진다');
  assert.strictEqual(v.결과[0].판정, 1);
  assert.strictEqual(R.장부판정({ ...v, 섰던적: true }).red.length, 1);
});

test('🔑 옛 체크아웃(사람글)·모양이 다른 JSON 은 둘 다 «못 잼» 이다 — 조용한 통과가 없다', () => {
  const 사람글 = R.장부Section(true, 장부픽스처('사람글', 'console.log("■ 대조 — cron 이 돈 횟수");\n'));
  assert.strictEqual(사람글.결과[0].못잼, true, '`--json` 을 모르는 옛 판이 조용히 통과했다');

  /* ⓑ 파싱은 통과하는데 모양이 다른 JSON — 여기가 유일한 문이다. 이 검사가 없으면 `판정` 이 없는
   * 응답이 아래 판정에서 어느 갈래에도 안 걸려 **초록과 구분이 안 된다**. */
  const 딴모양 = R.장부Section(true, 장부픽스처('딴모양', 'console.log(JSON.stringify({ok:true,빚:0}));\n'));
  assert.strictEqual(딴모양.결과[0].못잼, true, '모양이 다른 JSON 이 통과했다 — 「이상 0」과 같은 모양이 된다');
});

test('☠️ 모르는 «판정» 값은 «못 잼» 이다 — 문이 typeof 만 보면 새 상태 하나가 6시간 창을 재운다', () => {
  /* `장부판정` 은 1·2 만 갈래로 든다. 그래서 모르는 숫자가 이 문을 지나면 적색도 메모도 안 나고
   * 훅은 `측정:true` 를 받아 도장까지 찍는다 — 「이상 0」과 **구분이 안 되는 침묵**이 된다.
   * 옛 판은 `typeof o.판정 !== 'number'` 만 봐서 `판정:99` 가 그대로 통과했다(①배포 검수 P1 · F541). */
  const 모름 = R.장부Section(true, 장부픽스처('모르는판정',
    'process.stdout.write(JSON.stringify({도구:"회차장부",판:true,판정:99})+"\\n");\n'));
  assert.strictEqual(모름.결과[0].못잼, true, '모르는 판정이 통과했다 — 「이상 0」과 같은 모양이 된다');
  assert.match(모름.결과[0].사유, /99/, '어떤 값이 모르는 값인지 안 실렸다 — 그러면 따라갈 처방이 없다(F103)');

  /* 🔑 반대 방향도 못박는다 — 문을 닫다 «아는 값»까지 막으면 진짜 적색이 통째로 사라진다.
   *   가드의 새는 방향은 언제나 「통과」지만, 이 문은 좁히다 반대로 죽을 수도 있는 자리다. */
  for (const 판정 of [1, 2]) {
    const v = R.장부Section(true, 장부픽스처(`아는판정${판정}`,
      `process.stdout.write(JSON.stringify({도구:"회차장부",판:${판정 === 1},판정:${판정},안적힘:1})+"\\n");\n`));
    assert.strictEqual(v.결과[0].못잼, undefined, `아는 판정 ${판정} 을 「못 잼」으로 접었다`);
    assert.strictEqual(v.결과[0].판정, 판정);
  }
});

test('☠️ 스로틀 시계와 래치는 «따로» 찍힌다 — 비차례 실행이 창을 리셋하면 침묵 탐지가 하루로 늘어진다', () => {
  /* 병의 모양: `collect` 는 차례와 무관하게 장부를 «재고», `볼것` 은 장부차례가 false 면 그 축을
   * «걸러낸다». 그래서 한 번 묶어 찍으면 지적이 측정·도장까지 되고 **보고만 안 된 채** 6시간
   * 창이 리셋된다 — cron 침묵이 6시간이 아니라 하루 만에 잡힌다(①배포 검수 P1). */
  const now = 1000;
  const 판섰다 = { 결과: [{ 판: true }] };
  const 판없다 = { 결과: [{ 판: false }] };

  assert.deepStrictEqual(R.장부패치(false, 판섰다, now), { 장부섰나: true },
    '비차례 실행이 `장부` 시계를 갱신했다 — 보고도 안 하면서 창만 닫았다');
  assert.deepStrictEqual(R.장부패치(false, 판없다, now), {},
    '빈 패치여야 한다 — 부르는 쪽이 stamp 를 건너뛰게. 빈 패치로 찍으면 최상위 `at` 만 갱신돼 그날 점검이 사라진다');

  // 자기 차례면 시계도 함께 — 안 그러면 스로틀이 영영 안 닫혀 매 세션 형제를 스폰한다
  assert.deepStrictEqual(R.장부패치(true, 판섰다, now), { 장부: now, 장부섰나: true });
  assert.deepStrictEqual(R.장부패치(true, 판없다, now), { 장부: now });

  /* 배선 — 순수 함수가 맞아도 훅이 안 쓰면 아무것도 안 고쳐진 것이다(장치와 발동 조건은 같은 커밋). */
  const src = fs.readFileSync(TOOL, 'utf8');
  /* ⚠ 호출부를 «호출부로» 겨눈다 — 옛 판은 `/장부패치\(장부차례,/` 였는데 그 정규식은 **함수 정의**
   *   (`function 장부패치(장부차례, v, now)`)에도 걸려, 호출부를 `장부패치(true, …)` 로 망가뜨려도
   *   초록이었다(변이가 잡았다 · 가드가 자기 전처리에 눈이 머는 자리 · CLAUDE.md 신뢰성 ④). */
  assert.match(src, /장부패치\(장부차례,\s*r\.장부\.value/,
    '훅이 `장부패치` 에 차례를 안 넘긴다 — 순수 함수가 맞아도 갈라 찍기가 배선에서 죽는다');
  assert.match(src, /Object\.keys\(패치\)\.length/, '빈 패치로도 stamp 를 부른다 — `at` 만 갱신돼 그날 점검이 통째로 건너뛰어진다');
});

test('형제에 그 도구가 없으면 «해당 없음» 이다 — 없는 빚을 모름으로 세면 CI 가 영구 경보가 된다', () => {
  const 빈뿌리 = path.join(TMP, '형제-없음');
  fs.mkdirSync(빈뿌리, { recursive: true });
  const v = R.장부Section(true, [{ 뿌리: 빈뿌리, 저장소: '형제-없음' }]);
  assert.deepStrictEqual(v.결과, [], '도구가 없는데 모름을 냈다 — 따를 수 없는 경보는 통로를 끈다(F103)');
});

test('🔑 등록층 — 회차 장부 축이 기본 켜짐이고, 6시간 스로틀이 실제로 문을 연다', () => {
  /* 위 검사들은 전부 「판정이 맞나」다. 배선이 없으면 전부 초록인 채 이 축은 한 번도 안 돈다 —
   * 그 모양이 정확히 이 도구가 없애려는 침묵이다(장치와 발동 조건은 같은 커밋 · CLAUDE.md). */
  const src = fs.readFileSync(TOOL, 'utf8');
  assert.match(src, /SYNK_ROT_LEDGER\s*!==\s*'0'/, '기본이 꺼짐으로 뒤집혔다 — 그러면 아무도 안 켠다');
  assert.match(src, /!주간 && !배포차례 && !장부차례/, '스로틀 문이 장부 차례를 안 본다 — 6시간이 지나도 안 열린다');
  const 훅 = (JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'))
    .hooks?.SessionStart || []).flatMap((g) => g.hooks || []).find((h) => /rot-check/.test(h.command));
  assert.doesNotMatch(훅.command, /SYNK_ROT_LEDGER=0/, '등록층에서 꺼 두면 코드가 멀쩡해도 영원히 안 돈다');

  const f = statePath('장부주기');
  const now = Date.now();
  fs.writeFileSync(f, JSON.stringify({ last: now, 배포: now, 장부: now - 7 * 3600 * 1000 }), 'utf8');
  process.env.SYNK_ROT_STATE = f;
  try {
    assert.strictEqual(R.dueNow(now, '장부', R.장부_주기_일), true, '7시간이 지났는데 6시간 주기가 안 열렸다');
    assert.strictEqual(R.dueNow(now, '장부', 1), false, '주기 인자를 안 쓴다');
  } finally { delete process.env.SYNK_ROT_STATE; }
});

test('🔑 꺼져 있으면 «차례»도 아니다 — 아니면 도장을 영영 못 찍어 나머지 스로틀이 무의미해진다', () => {
  const f = statePath('장부꺼짐');
  const now = Date.now();
  // 주간·배포는 방금 돌았고, 장부만 한 번도 안 쟀다. 축이 꺼져 있으면 그래도 침묵이어야 한다.
  fs.writeFileSync(f, JSON.stringify({ last: now, 배포: now }), 'utf8');
  assert.strictEqual(runHook({ SYNK_ROT_STATE: f }), '',
    '꺼진 축이 스로틀 문을 열어 뒀다 — 매 세션 collect 가 통째로 다시 돈다');
});

test('축만() 은 그 축의 항목만 고른다 — 하루·6시간 알림에 주간 리포트가 딸려 오면 그게 소음이다', () => {
  const r = {
    red: [{ text: 'A', 배포: true }, { text: 'B', 장부: true }, { text: 'C' }],
    warn: [{ text: 'D', 장부: true }], notes: [{ text: 'E', 배포: true }],
  };
  assert.deepStrictEqual(R.축만(r, ['장부']).red.map((x) => x.text), ['B']);
  assert.deepStrictEqual(R.축만(r, ['장부']).warn.map((x) => x.text), ['D']);
  assert.strictEqual(R.축만(r, ['장부']).notes.length, 0);
  assert.strictEqual(R.축만(r, ['배포', '장부']).findings, 4);
  // render() 가 만지는 키가 빠지면 리포트 전체가 예외로 죽고, 그 자리에선 침묵과 같다
  for (const k of ['mem', 'doc', '장부']) assert.ok(R.축만(r, ['장부'])[k], `축약 판에 ${k} 키가 없다`);
});

test('실저장소 — 축을 끄면 형제를 안 부르고 거짓양성 0 (탐지는 위 픽스처가 진다)', () => {
  const v = R.장부Section(false);
  assert.strictEqual(v.측정, false, '꺼도 네트워크를 탔다');
  const r = R.collect();
  assert.ok(r.장부 && r.장부.ok, `회차 장부 검사기가 죽었다: ${r.장부 && r.장부.error}`);
  assert.strictEqual(r.장부.value.측정, false, 'collect() 기본이 형제를 부른다 — CI 가 네트워크를 탄다');
  assert.ok(!r.red.some((x) => x.장부), '안 쟀는데 장부 적색이 나왔다');
});
