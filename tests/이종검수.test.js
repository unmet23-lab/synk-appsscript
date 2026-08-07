'use strict';
/* 이종 검수 게이트 회귀 — 2026-08-05
 *
 * 무엇을 지키나: **「검수됨」이 사실일 때만 초록**이어야 한다. 이 게이트가 새는 방향은
 * 언제나 「통과」다 — 장부를 못 읽어도, 지문이 안 맞아도, 판정이 죽어도 결과는 똑같이
 * 「조용함」으로 나타난다. 그래서 탐지력은 **픽스처가 진다**(실저장소 장부는 지금 마침
 * 지적이 0건일 수 있고, 그러면 검사가 죽어도 초록이라 아무것도 증명하지 못한다).
 *
 * 실저장소에는 **거짓양성만** 검사한다(CLAUDE.md 가드 맹점 ②).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process'); // 도구(codex 등) 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 검수 = require(path.join(ROOT, 'tools', 'codex-review.js'));
const 점검 = require(path.join(ROOT, 'tools', '배포판점검.js'));

const 루트프로젝트 = ROOT;
const 이름 = '(루트)';

/* 실제 지문을 쓴다 — 가짜 지문으로 시험하면 「지문이 맞을 때」 경로를 한 번도 안 밟는다. */
const 실지문 = 점검.지문(루트프로젝트, ROOT);

function 장부(기록들, 기각들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-fx-'));
  const 기록경로 = path.join(d, '기록.jsonl');
  const 기각경로 = path.join(d, '기각.jsonl');
  fs.writeFileSync(기록경로, 기록들.map((o) => JSON.stringify(o)).join('\n') + (기록들.length ? '\n' : ''));
  fs.writeFileSync(기각경로, 기각들.map((o) => JSON.stringify(o)).join('\n') + (기각들.length ? '\n' : ''));
  return { 기록경로, 기각경로, dir: d };
}

const 지적 = (등급, 키) => ({ 등급, 파일: 'Code.js', 라인: 1, 제목: '가짜 지적 ' + 키, 근거: 'ㄱ', 수정방향: 'ㄴ', 키 });
const 기록 = (opts = {}) => ({
  시각: '2026-08-05T00:00:00.000Z',
  대상: { 종류: 'commit', 값: 'deadbeef' },
  범위: opts.범위 || [이름],
  지문: opts.지문 || { [이름]: 실지문 },
  요약: '',
  지적: opts.지적 || [],
});

// ───────────────────────────────── 탐지력 (픽스처)

test('기록이 없으면 none — 「검수 안 함」은 조용하면 안 된다', () => {
  const fx = 장부([], []);
  const r = 검수.게이트판정(루트프로젝트, ROOT, fx);
  assert.strictEqual(r.level, 'none');
  assert.match(r.lines.join('\n'), /검수 기록이 없다/);
});

test('지문이 다르면 none — 파일이 바뀌면 옛 검수는 자동으로 무효다', () => {
  const fx = 장부([기록({ 지문: { [이름]: '00000000' } })], []);
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'none');
});

test('기록은 있으나 이 프로젝트가 범위 밖이면 scope — 「모름」과 「정상」을 가른다', () => {
  const fx = 장부([기록({ 범위: ['crewcard'] })], []);
  const r = 검수.게이트판정(루트프로젝트, ROOT, fx);
  assert.strictEqual(r.level, 'scope');
  assert.match(r.lines.join('\n'), /검수 범위 밖/);
});

test('🔑 차단급(P0/P1) 미해결이면 block — 지적을 안 고치고 배포하는 것만이 차단 대상이다', () => {
  for (const 등급 of ['P0', 'P1']) {
    const fx = 장부([기록({ 지적: [지적(등급, 'k1')] })], []);
    const r = 검수.게이트판정(루트프로젝트, ROOT, fx);
    assert.strictEqual(r.level, 'block', `${등급} 이 차단되지 않았다`);
  }
});

test('P2·P3 만이면 ok — 등급을 넓히면 사람이 우회를 배운다', () => {
  for (const 등급 of ['P2', 'P3']) {
    const fx = 장부([기록({ 지적: [지적(등급, 'k1')] })], []);
    assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'ok', `${등급} 이 배포를 막았다`);
  }
});

test('기각된 지적은 block 을 풀어준다 — 기각이 유일한 의식적 통과 레버다', () => {
  const fx = 장부(
    [기록({ 지적: [지적('P0', 'k1')] })],
    [{ 시각: '2026-08-05T00:00:00.000Z', 키: 'k1', 파일: 'Code.js', 제목: 'ㄱ', 사유: '오탐' }]
  );
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'ok');
});

test('기각은 **그 키만** 푼다 — 하나 기각했다고 나머지가 함께 열리면 안 된다', () => {
  const fx = 장부(
    [기록({ 지적: [지적('P0', 'k1'), 지적('P1', 'k2')] })],
    [{ 시각: '2026-08-05T00:00:00.000Z', 키: 'k1', 파일: 'Code.js', 제목: 'ㄱ', 사유: '오탐' }]
  );
  const r = 검수.게이트판정(루트프로젝트, ROOT, fx);
  assert.strictEqual(r.level, 'block');
  assert.strictEqual(r.지적.length, 1);
  assert.strictEqual(r.지적[0].키, 'k2');
});

test('같은 지문의 기록이 여럿이면 **최신**을 본다 — 고친 뒤 재검수가 옛 판정에 막히면 안 된다', () => {
  const fx = 장부([기록({ 지적: [지적('P0', 'k1')] }), 기록({ 지적: [] })], []);
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'ok');
});

test('깨진 JSONL 줄은 게이트를 초록으로 만들지 않는다', () => {
  const fx = 장부([기록({ 지적: [지적('P0', 'k1')] })], []);
  fs.appendFileSync(fx.기록경로, '{깨진 줄\n');
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'block');
});

// ───────────────────────────────── 지문 결속 (검수한 것 ≠ 기록하는 것 방지)

/* 🔴 이 세 검사는 **이 도구가 이 도구를 검수하다 잡은 P1**(2026-08-05 첫 실전 검수)을 못 박는다:
 *   `--commit` 으로 검수하면서 지문은 작업본에서 계산하면, 검수된 적 없는 바이트가
 *   「검수됨」으로 기록돼 게이트를 통과한다. 실패 방향이 「통과」인 전형이라 회귀로 고정한다. */

test('🔑 옛 커밋을 검수하면 지문을 기록하지 않는다 — 작업본은 그 커밋이 아니다', () => {
  const m = 검수.유효지문({ 종류: 'commit', 값: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' });
  assert.deepStrictEqual(m, {}, '검수 안 된 작업본 지문이 기록될 뻔했다');
});

test('미커밋 대상은 작업본 자체가 검수 대상이라 지문을 기록한다', () => {
  const m = 검수.유효지문({ 종류: 'uncommitted', 값: '(미커밋)' });
  assert.ok(Object.keys(m).length > 0, '작업본을 검수했는데 지문이 하나도 안 남았다');
  for (const fp of Object.values(m)) assert.match(fp, /^[0-9a-f]{8}$/);
});

test('배포 파일이 미커밋이면 커밋 대상 검수는 그 프로젝트 지문을 기록하지 않는다', () => {
  const { execFileSync } = require('node:child_process');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const 프로젝트 = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'clasp-project.js'));
  const dirty = 검수.미커밋파일들();

  const m = 검수.유효지문({ 종류: 'commit', 값: head });
  for (const p of 점검.claspProjects()) {
    const nm = path.relative(ROOT, p).replace(/\\/g, '/') || '(루트)';
    const 더러움 = dirty.some((f) => 프로젝트.isDeployFile(f, p, ROOT));
    if (더러움) assert.ok(!(nm in m), `${nm}: 배포 파일이 미커밋인데 지문이 기록됐다`);
    else assert.ok(nm in m, `${nm}: 깨끗한데 지문이 안 기록됐다(거짓양성 — 매번 알림이 뜬다)`);
  }
});

// ───────────────────────────────── 자기 처방 (F103)

test('🔑 차단 사유가 시키는 명령이 실제로 차단을 푼다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다', () => {
  const fx = 장부([기록({ 지적: [지적('P0', 'k1')] })], []);
  const before = 검수.게이트판정(루트프로젝트, ROOT, fx);
  assert.strictEqual(before.level, 'block');

  // 차단 메시지에서 처방 명령을 **문구 그대로** 뽑아 실행한다(손으로 다시 적으면 검사가 아니다).
  const 처방 = before.lines.join('\n').match(/--기각 (\S+) --사유/);
  assert.ok(처방, '차단 메시지가 기각 명령을 알려주지 않았다');

  // 처방 명령이 실패하면(0 아님) 통로가 던진다 — 안 뜬 것과 같은 모양이 되면 안 된다.
  훅띄우기([path.join(ROOT, 'tools', 'codex-review.js'), '--기각', 처방[1], '--사유', '회귀 시험'], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
  });
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'ok', '처방을 따랐는데 여전히 막힌다');
});

test('사유 없는 기각은 거부된다 — 왜 무시하는지 못 적으면 다음 회차에 설명할 수 없다', () => {
  const fx = 장부([], []);
  const r = 훅띄우기([path.join(ROOT, 'tools', 'codex-review.js'), '--기각', 'k1'], {
    encoding: 'utf8',
    통과코드: [0, 1, 2],   // 거절 코드 자체가 이 검사의 대상이라 통로는 「안 떴다」만 걷어낸다
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
  });
  assert.notStrictEqual(r.status, 0, '사유 없는 기각이 통과했다');
});

// ───────────────────────────────── 등록층 (가드가 실제로 이걸 부르는가)

test('🔑 clasp-guard 가 block 판정을 **실제 deny 로** 옮긴다 (등록층 — 가드는 로직보다 여기서 샌다)', () => {
  const fx = 장부([기록({ 지적: [지적('P0', 'k1')] })], []);
  const r = 훅띄우기(path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js'), {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'clasp push --force' }, cwd: ROOT }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
    timeout: 180000,
  });
  const out = (r.stdout || '').trim();
  assert.ok(out, '가드가 아무 말도 하지 않았다');
  const j = JSON.parse(out);
  assert.strictEqual(j.hookSpecificOutput?.permissionDecision, 'deny', '차단급 지적이 있는데 배포가 통과했다');
  assert.match(j.hookSpecificOutput.permissionDecisionReason, /이종 검수/);
});

test('🔑 알림(none)은 배포를 **막지 않는다** — 폰 클라우드 세션엔 codex 가 없어 따를 수 없는 처방이 된다', () => {
  const fx = 장부([], []); // 기록 0건 = none
  const r = 훅띄우기(path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js'), {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'clasp push --force' }, cwd: ROOT }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
    timeout: 180000,
  });
  const out = (r.stdout || '').trim();
  if (!out) return; // 다른 불변식이 먼저 통과시켰고 알릴 것도 없으면 조용한 게 맞다
  const j = JSON.parse(out);
  if (j.hookSpecificOutput?.permissionDecision === 'deny') {
    // 다른 사유(미커밋·미push 등)로 막힌 것은 이 테스트의 대상이 아니다 — 검수 사유로 막혔는지만 본다
    assert.doesNotMatch(j.hookSpecificOutput.permissionDecisionReason, /검수 기록이 없다/,
      '「검수 안 함」이 배포를 막았다 — 폰 배포 경로가 죽는다');
  }
});

test('가드 출력은 **JSON 객체 하나**다 — 두 번 쓰면 통째로 파싱에 실패해 알림이 둘 다 사라진다', () => {
  const fx = 장부([], []);
  const r = 훅띄우기(path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js'), {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'clasp push --force' }, cwd: ROOT }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
    timeout: 180000,
  });
  const out = (r.stdout || '').trim();
  if (!out) return;
  assert.doesNotThrow(() => JSON.parse(out), '가드 출력이 파싱되지 않는다 — JSON 을 두 번 쓴 형태');
});

// ───────────────────────────────── 실저장소 (거짓양성만)

test('실저장소에서 게이트가 터지지 않는다 (거짓양성 검사 — 탐지력은 위 픽스처가 진다)', () => {
  for (const p of 점검.claspProjects()) {
    const r = 검수.게이트판정(p, ROOT);
    assert.ok(['ok', 'none', 'scope', 'block'].includes(r.level), `알 수 없는 판정: ${r.level}`);
    assert.ok(Array.isArray(r.lines) && r.lines.length, '판정이 사람에게 아무 말도 안 한다');
  }
});

test('스키마 파일이 OpenAI 구조화 출력 규약을 지킨다 — properties 전부가 required 에 있어야 한다', () => {
  /* 2026-08-05 실측: 「라인」이 required 에 없어 API 가 400 을 냈다. 이 규약을 어기면
   * 2단계가 통째로 실패하는데, 그 실패는 「지적 0건」이 아니라 「확인 불가」로 나타나야 하고
   * 애초에 나면 안 된다. 스키마를 손볼 때 이 검사가 먼저 잡는다. */
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.schema.json'), 'utf8'));
  const 확인 = (obj, 경로) => {
    if (!obj || obj.type !== 'object' || !obj.properties) return;
    const keys = Object.keys(obj.properties);
    const req = obj.required || [];
    for (const k of keys) assert.ok(req.includes(k), `${경로}.${k} 가 required 에 없다`);
    assert.strictEqual(obj.additionalProperties, false, `${경로} 에 additionalProperties:false 가 없다`);
    for (const k of keys) 확인(obj.properties[k], `${경로}.${k}`);
    if (obj.properties) for (const k of keys) if (obj.properties[k].items) 확인(obj.properties[k].items, `${경로}.${k}[]`);
  };
  확인(s, '$');
});

// ───────────────────────────────── 모델·추론 수준

/* 🔴 이 세 검사가 막는 것: **모델만 박고 추론 수준을 안 박은 상태**(2026-08-05에 잡은 내 구멍).
 *   `--ignore-user-config` 가 사용자 설정의 effort 를 함께 버리는데 `gpt-5.6-sol` 의 기본은
 *   `low` 라, 겉보기엔 「최상급 모델」인데 실제로는 가장 얕은 추론으로 돌고 있었다. */

test('🔑 두 단계 모두 추론 수준이 **명시**돼 있다 — 기본값에 맡기면 최상급 모델이 low 로 돈다', () => {
  for (const [단계, s] of Object.entries(검수.모델설정)) {
    assert.ok(s.model, `${단계}: 모델이 비었다`);
    assert.ok(검수.효력들.includes(s.effort), `${단계}: 추론 수준이 명시되지 않았거나 알 수 없다(${s.effort})`);
    const f = 검수.모델플래그(s);
    assert.ok(f.includes('-m'), `${단계}: -m 플래그가 안 나간다`);
    assert.ok(f.some((x) => /model_reasoning_effort=/.test(x)), `${단계}: 추론 수준이 codex 로 안 나간다`);
  }
});

/* 🔴 F132(2026-08-06 실측): 읽기 전용 잠금을 실제로 지는 것은 `--ignore-user-config` **하나**다.
 *   그게 있으면 `-s workspace-write` 도 `-c sandbox_mode=` 도 read-only 를 못 열고, 빼는 순간 열린다.
 *   `-c sandbox_mode="read-only"` 는 기본값과 같은 값이라 **먹은 것과 무시된 것이 같은 모양**이었다 —
 *   그래서 그 줄을 잠금 근거로 읽고 이 플래그를 지우는 편집이 이 검사가 막는 사고다. */
test('🔒 읽기 전용 잠금의 진짜 근거 `--ignore-user-config` 가 검수 호출에 붙어 나간다 (F132)', () => {
  assert.ok(
    검수.잠금플래그.includes('--ignore-user-config'),
    '검수 codex 호출에서 --ignore-user-config 가 빠졌다 — 이 플래그 없이는 사용자 config 의 '
    + 'trust_level="trusted"·node_repl MCP 가 살아나 검수자가 쓰기까지 할 수 있다. '
    + '-c sandbox_mode= 는 대체재가 아니다(F132 실측: read-only 를 열지도 닫지도 못한다)'
  );
});

/* 🔴 F133(2026-08-06 실측): 위 잠금은 **디스크만** 막는다. codex 의 features 는 stage=stable 이면
 *   기본이 true 라 `--ignore-user-config` 로도 안 꺼지고, 그 상태에서 에이전트가
 *   `mcp__codex_apps__github_create_branch` 로 **원격 저장소 쓰기**를 시도했다(디스크는 잠겨 있었다).
 *   이 검사가 막는 사고 = 「읽기 전용이니 괜찮다」고 읽고 이 목록을 지우는 편집. */
test('🔒 바깥으로 나가는 문(GitHub·브라우저·데스크톱)이 검수 호출에서 꺼져 나간다 (F133)', () => {
  for (const f of 검수.외부도구들) {
    const i = 검수.잠금플래그.indexOf('--disable');
    assert.ok(i !== -1, '잠금에 --disable 이 하나도 없다 — 네트워크 문이 통째로 열려 있다');
    assert.ok(
      검수.잠금플래그.some((x, n) => x === f && 검수.잠금플래그[n - 1] === '--disable'),
      `${f} 가 --disable 로 안 나간다 — 샌드박스는 디스크를 막지 네트워크를 안 막는다(F133)`
    );
  }
  // 실사고 통로 3개는 이름으로 못박는다 — 배열을 비우면 위 루프는 0회로 조용히 통과한다.
  for (const f of ['apps', 'browser_use', 'computer_use']) {
    assert.ok(검수.외부도구들.includes(f), `${f} 가 차단 목록에서 빠졌다 (F133 실사고 통로)`);
  }
});

/* 이름이 바뀌면 codex 는 `Unknown feature flag` 로 죽는다 = 검수가 **안 도는** 것으로 드러난다.
 * 그건 조용히 열리는 것보다 낫지만, 14분 런이 시작된 뒤에 알 이유는 없다. codex 가 있는 기계에서만
 * 실측하고 CI 에서는 **skip 으로 드러낸다**(통과와 미실행이 같은 모양이면 안 된다). */
test('외부도구 이름이 이 기계의 codex 가 아는 이름이다 (없으면 skip)', (t) => {
  const bin = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'codex.cmd') : 'codex';
  if (process.platform === 'win32' && !fs.existsSync(bin)) return t.skip('codex CLI 없음 — 이름 대조 미실행');
  const r = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', bin, 'features', 'list'], { encoding: 'utf8' })
    : spawnSync(bin, ['features', 'list'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return t.skip('codex features list 실패 — 이름 대조 미실행');
  const 아는이름 = new Set(r.stdout.split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean));
  for (const f of 검수.외부도구들) {
    assert.ok(아는이름.has(f), `codex 가 모르는 feature 이름 "${f}" — 검수 런이 시작하자마자 죽는다`);
  }
});

/* 🔴 F135(2026-08-06 실사고): `--help` 가 거절이 아니라 **기본 동작**으로 떨어져 14분짜리 런이
 *   조용히 시작됐다. 느슨한 층이 실질 정책이 되는 자리다. */
test('🔒 모르는 인자는 기본 동작으로 접히지 않는다 — 거절 + 사용법 (F135)', () => {
  const r = 훅띄우기([path.join(ROOT, 'tools', 'codex-review.js'), '--없는플래그'], { encoding: 'utf8', 통과코드: [0, 1, 2] });
  assert.strictEqual(r.status, 2, '모르는 인자가 검수를 시작시켰다(F135 재발)');
  assert.match(r.stderr, /사용:/, '거절만 하고 따라갈 사용법을 안 준다(F103: 따를 수 없는 처방)');
  assert.doesNotMatch(r.stdout, /codex 검수 중/, '거절해 놓고 codex 를 불렀다');
});

test('--help 는 사용법을 내고 끝난다 (0) — 이게 F135 의 실제 입력이었다', () => {
  const r = 훅띄우기([path.join(ROOT, 'tools', 'codex-review.js'), '--help'], { encoding: 'utf8' });
  assert.match(r.stdout, /--심문/, '사용법에 심문 통로가 없다');
});

/* 화이트리스트는 손으로 적은 목록이라 **새 플래그가 붙으면 조용히 거절당한다**(반대 방향 사고).
 * 그래서 목록을 소스에서 파생시켜 대조한다 — 판정을 두 곳에 적으면 갈라지고, 갈라지는 쪽은 늘 얕다. */
test('🔑 코드가 실제로 읽는 플래그가 전부 화이트리스트에 있다 (새 플래그를 붙이면 여기서 잡힌다)', () => {
  const 소스 = ['tools/codex-review.js', 'tools/모델정책.js']
    .map((p) => fs.readFileSync(path.join(ROOT, p), 'utf8')).join('\n');
  const 쓰는것 = new Set([...소스.matchAll(/argv?\.(?:includes|indexOf)\('(--[^']+)'/g)].map((m) => m[1]));
  assert.ok(쓰는것.size >= 10, `소스에서 뽑은 플래그가 ${쓰는것.size}개뿐 — 스캔이 헛돌았다`);
  for (const f of 쓰는것) {
    if (f === '--help') continue;                    // 조기 반환으로 처리된다
    if (f === '--제미나이확인') continue;             // 모델정책.js 자체 CLI(이 도구 인자가 아니다)
    assert.ok(검수.아는플래그.has(f), `코드는 ${f} 를 읽는데 화이트리스트에 없다 — 쓰는 순간 거절당한다`);
  }
});

test('변환 단계(2단계)가 분석 단계보다 얕다 — 순수 변환에 최상급을 쓰면 「고쳐서」 옮긴다', () => {
  const 분석 = 검수.효력들.indexOf(검수.모델설정.분석.effort);
  const 구조화 = 검수.효력들.indexOf(검수.모델설정.구조화.effort);
  assert.ok(구조화 <= 분석, '구조화가 분석보다 깊게 설정됐다 — 축이 뒤집혔다');
});

test('알 수 없는 추론 수준은 조용히 넘어가지 않는다 (오타 → 기본값 low 로 도는 것을 막는다)', () => {
  assert.throws(() => 검수.모델플래그({ model: 'gpt-5.6-sol', effort: 'xhgih' }), /알 수 없는 추론 수준/);
});

// ───────────────────────────────── 환경 의존 (skip 으로 드러낸다)

test('codex CLI 가 있으면 로그인 상태다 (없으면 skip — 통과와 미실행이 같은 모양이면 안 된다)', (t) => {
  const bin = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'codex.cmd')
    : 'codex';
  if (process.platform === 'win32' && !fs.existsSync(bin)) {
    return t.skip('codex CLI 미설치 — 이 기계에서는 이종 검수를 돌릴 수 없다(CI 포함)');
  }
  const auth = path.join(os.homedir(), '.codex', 'auth.json');
  if (!fs.existsSync(auth)) return t.skip('codex 자격증명 없음 — 클라우드·CI 환경');
  const j = JSON.parse(fs.readFileSync(auth, 'utf8'));
  assert.ok(j.tokens || j.OPENAI_API_KEY, 'codex 자격증명이 비어 있다 — 검수가 조용히 안 돈다');
});

// ─────────────── 방향 스탬프 (제안 61d775a5b85d 채택분 · 소급이 안 되는 종류라 쓰는 시점에 박는다)

test('방향 지문은 결정론적이고, 정본이 1바이트만 바뀌어도 달라진다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-방향-'));
  const p = path.join(d, '제품방향.md');
  fs.writeFileSync(p, '방향 본문');
  const a = 검수.방향지문(p);
  assert.strictEqual(a, 검수.방향지문(p), '같은 파일인데 지문이 흔들린다 — 장부 대조가 불가능해진다');
  fs.writeFileSync(p, '방향 본문.');
  assert.notStrictEqual(검수.방향지문(p), a, '정본이 바뀌었는데 지문이 같다 — 개정을 못 가른다');
});

test('🔴 정본이 없으면 빈 값이 아니라 「없음」을 박는다 — 방향 없이 돈 것과 안 적힌 것이 같은 모양이면 안 된다', () => {
  const 없는경로 = path.join(os.tmpdir(), 'synk-방향-없는파일-' + process.pid, '제품방향.md');
  assert.strictEqual(검수.방향지문(없는경로), '없음');
});

test('🔑 실저장소 정본이 실제로 읽힌다 — 이음매만 맞고 대상이 비면 회귀가 공허해진다', () => {
  assert.notStrictEqual(검수.방향지문(), '없음',
    'docs/제품방향.md 를 못 읽는다 — 검수자가 방향 없이 도는 상태다');
});

test('🔴 판정 행이 **대상과 방향**을 싣는다 — 키만 있으면 그 판정이 어느 변경·어느 방향의 것인지 행이 스스로 못 말한다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-제안장부-'));
  const 제안장부 = path.join(d, '검수제안.jsonl');
  fs.writeFileSync(제안장부, JSON.stringify({
    종류: '제안', 시각: '2026-08-05T00:00:00.000Z',
    대상: { 종류: 'commit', 값: 'deadbee' }, 키: 'k9',
    제목: '픽스처 제안', 무엇을: 'ㄱ', 왜: 'ㄴ', 구현방향: 'ㄷ', 크기: '중', 관련기능: 'ㄹ',
  }) + '\n');

  훅띄우기([path.join(ROOT, 'tools', 'codex-review.js'), '--제안판정', 'k9', '--채택', '--사유', '회귀 시험'],
    { encoding: 'utf8', env: { ...process.env, SYNK_REVIEW_PROPOSALS: 제안장부 } });

  const 행들 = fs.readFileSync(제안장부, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const 판정 = 행들.find((x) => x.종류 === '판정');
  assert.ok(판정, '판정 행이 안 적혔다');
  assert.deepStrictEqual(판정.대상, { 종류: 'commit', 값: 'deadbee' },
    '판정 행이 원 제안의 대상을 안 물려받았다 — 어느 변경의 판정인지 복원할 수 없다');
  assert.strictEqual(판정.방향, 검수.방향지문(),
    '판정 행에 방향 지문이 없다 — 방향이 개정되면 이 판정의 전제를 복원할 방법이 사라진다');
});

/* 🔑 이 검사는 변이 시험이 만들어냈다 — 방향 스탬프를 기능지도·제안 행에서 통째로 빼도 28건이
 *   전부 초록이었다. 그 행은 실제 codex 호출로만 쓰여 **어떤 검사도 닿지 않는 자리**였다. */
test('🔴 선파악이 쓰는 기능지도·제안 행에도 방향과 대상이 박힌다 (codex 호출 없이 조립만 검사)', () => {
  const 결과 = {
    기능지도: [{ 기능: 'ㄱ', 설명: 'ㄴ' }],
    제안: [
      { 제목: '새 제안', 무엇을: 'a', 왜: 'b', 구현방향: 'c', 크기: '소', 관련기능: 'ㄱ' },
      { 제목: '이미 기각된 제안', 무엇을: 'a', 왜: 'b', 구현방향: 'c', 크기: '소', 관련기능: 'ㄱ' },
    ],
  };
  const 기각키 = 검수.제안키(결과.제안[1]);
  const 현황 = new Map([[기각키, { 상태: '기각' }]]);
  const { 기록행들, 신규 } = 검수.선파악행들(
    { 종류: 'commit', 값: 'cafe123' }, 결과, 현황, '2026-08-05T00:00:00.000Z');

  const 지도행 = 기록행들.find((r) => r.종류 === '기능지도');
  const 제안행 = 기록행들.find((r) => r.종류 === '제안');
  for (const [이름, 행] of [['기능지도', 지도행], ['제안', 제안행]]) {
    assert.ok(행, `${이름} 행이 안 만들어졌다`);
    assert.strictEqual(행.방향, 검수.방향지문(), `${이름} 행에 방향 지문이 없다`);
    assert.deepStrictEqual(행.대상, { 종류: 'commit', 값: 'cafe123' }, `${이름} 행에 대상이 없다`);
  }
  assert.strictEqual(신규.length, 1, '기각된 제안이 다시 올라왔다 — 기각의 뜻이 사라진다');
});

/* ⚠ 여기서 「실장부의 모든 판정 행에 방향이 있다」를 요구하면 **과거가 소급되기를 요구하는 검사**가 된다.
 *   스탬프 이전에 쓰인 행은 원리상 그 필드가 없고, 그건 결함이 아니라 도입 시점의 사실이다.
 *   탐지력은 위 픽스처가 진다(현재 코드가 쓰는 행에 반드시 박힌다). 실장부에서 볼 것은 호환뿐이다. */
test('실장부 — 방향 없는 옛 판정 행이 섞여 있어도 제안현황이 안 깨진다 (스탬프 도입 전 행 호환)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-옛장부-'));
  const 장부p = path.join(d, '검수제안.jsonl');
  fs.writeFileSync(장부p, [
    JSON.stringify({ 종류: '제안', 키: 'old1', 대상: { 종류: 'commit', 값: 'aaa' }, 제목: '옛 제안' }),
    JSON.stringify({ 종류: '판정', 키: 'old1', 상태: '채택', 사유: '방향 필드가 없던 시절 행' }),
  ].join('\n') + '\n');
  const 현황 = 검수.제안현황(장부p);
  assert.strictEqual(현황.get('old1').상태, '채택', '방향 없는 옛 행을 읽다가 상태가 사라졌다');

  // 실장부도 실제로 읽힌다 — 픽스처만 맞고 실물이 깨지면 그 사실이 안 보인다
  assert.doesNotThrow(() => 검수.제안현황(), '실장부를 못 읽는다');
});

/* ─────────────────── ②설계 심문 (2026-08-06 · 유호님 "키자")
 *
 * 이 심문이 새는 방향도 「통과」다 — 금지 목록을 못 실어도, 마커 치환이 죽어도, 결과는 똑같이
 * **아무 말 없는 심문**으로 나온다. 그래서 탐지력은 픽스처가 지고, 실저장소에는 거짓양성만 검사한다.
 * 조립을 순수 함수(`심문프롬프트(대상, 템플릿, 금지)`)로 가른 이유가 이것이다 — 실제 codex 호출로만
 * 쓰이는 자리는 **어떤 검사도 닿지 않는다**(2026-08-05 변이 실측). 검사할 수 없는 자리 = 조용히 새는 자리.
 */

function 심문픽스처(내용, 이름 = 't.md') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-심문-fx-'));
  const p = path.join(d, 이름);
  fs.writeFileSync(p, 내용, 'utf8');
  return p;
}

test('심문: 템플릿에 마커가 없으면 거절 — 치환 없이 보내면 빈 심문이 「통과」로 보인다', () => {
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const 금지 = 심문픽스처('- 🚫 어떤 것 재제안 금지', 'MEMORY.md');
  const 마커없음 = 심문픽스처('머리말\n\n---\n공격하라.\n{{대상문서}}\n', '템플릿.md');   // {{금지목록}} 이 빠졌다
  assert.throws(
    () => 검수.심문프롬프트(대상, 마커없음, 금지),
    /금지목록.*마커가 없다/,
    '마커가 없는데 조용히 통과했다 — 닫힌 결정을 안 실은 심문이 나간다'
  );
});

test('심문: 금지 목록을 못 읽으면 거절 — 심문의 모양을 한 재제안을 막는다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 템플릿 = 심문픽스처('머리말\n\n---\n{{금지목록}}\n{{대상문서}}', '템플릿.md');
  assert.throws(
    () => 검수.심문프롬프트(대상, 템플릿, path.join(os.tmpdir(), `없는-MEMORY-${process.pid}.md`)),
    /memory 인덱스를 못 찾았다/,
    '인덱스가 없는데 빈 목록으로 접었다'
  );
  // 파일은 있는데 🚫 가 0건 = 추출이 깨진 것이다. 「없음」과 「못 읽음」이 같은 모양이면 안 된다.
  assert.throws(
    () => 검수.심문프롬프트(대상, 템플릿, 심문픽스처('머리말만 있고 금지 항목이 없다', 'MEMORY.md')),
    /🚫 줄이 0건/,
    '🚫 0건인데 통과했다'
  );
});

test('심문: 치환이 실제로 일어난다 — 대상 전문 + 🚫 줄 전량', () => {
  const 대상 = 심문픽스처('# 계약 초안\n필드 A 는 소급 불가다');
  const 금지 = 심문픽스처('머리말\n- 🚫 포인트 재제안 금지\n평범한 줄\n- 🚫 스토어 재제안 금지', 'MEMORY.md');
  const 템플릿 = 심문픽스처('머리말\n\n---\n닫힌 결정:\n{{금지목록}}\n\n대상:\n{{대상문서}}\n', '템플릿.md');
  const p = 검수.심문프롬프트(대상, 템플릿, 금지);
  assert.match(p, /필드 A 는 소급 불가다/, '대상 전문이 안 들어갔다');
  assert.match(p, /🚫 포인트 재제안 금지/, '금지 줄이 안 들어갔다');
  assert.match(p, /🚫 스토어 재제안 금지/, '금지 줄을 일부만 실었다 — 골라 넣으면 독립성이 모델 이름에만 남는다');
  assert.doesNotMatch(p, /\{\{/, '치환 안 된 마커가 남았다');
  assert.doesNotMatch(p, /^평범한 줄$/m, '🚫 없는 줄까지 실었다');
});

test('심문(실저장소): 템플릿에 마커 둘이 실재한다 — 없으면 도구가 통째로 죽는다', () => {
  const t = fs.readFileSync(검수.심문템플릿, 'utf8');
  for (const 마커 of ['{{금지목록}}', '{{대상문서}}']) {
    assert.ok(t.includes(마커), `실저장소 템플릿에 ${마커} 가 없다: ${검수.심문템플릿}`);
  }
});

/* 🔴 2026-08-06 실사고: 템플릿 **전문**을 보냈더니 GPT 가 머리말의 ⏸꺼짐 표식을 읽고 실행을 거부했다
 *   — 종료코드 0 · 241바이트 · 겉보기 성공. 지시문과 운영 메모가 한 파일에 살면 모델은 둘을 안 가른다. */
test('심문: 첫 --- 위(운영 메모)는 심문자에게 가지 않는다 — 머리말이 실행을 뒤집는다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 금지 = 심문픽스처('- 🚫 무엇 재제안 금지', 'MEMORY.md');
  const 템플릿 = 심문픽스처(
    '# 템플릿 (정본)\n> ⏸ **꺼짐** — 어떤 세션도 이 심문을 실행하지 않는다.\n\n---\n\n당신은 심문자다.\n{{금지목록}}\n{{대상문서}}\n',
    '템플릿.md'
  );
  const p = 검수.심문프롬프트(대상, 템플릿, 금지);
  assert.doesNotMatch(p, /꺼짐/, '운영 메모가 프롬프트에 섞였다 — GPT 가 그걸 읽고 심문을 거부한다(08-06 실측)');
  assert.doesNotMatch(p, /템플릿 \(정본\)/, '머리말 제목이 남았다');
  assert.match(p, /당신은 심문자다/, '--- 아래 지시문까지 잘라냈다');
});

test('심문: --- 구분선이 없는 템플릿은 거절 — 경계가 없으면 머리말이 통째로 실린다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 금지 = 심문픽스처('- 🚫 무엇 재제안 금지', 'MEMORY.md');
  assert.throws(
    () => 검수.심문프롬프트(대상, 심문픽스처('꺼짐 표식\n{{금지목록}}\n{{대상문서}}', '템플릿.md'), 금지),
    /--- 구분선이 없다/,
    '경계 없는 템플릿이 통과했다'
  );
});

test('심문(실저장소): 템플릿에 --- 경계가 있고, 그 위 운영 메모가 프롬프트에 안 실린다', (ctx) => {
  const t = fs.readFileSync(검수.심문템플릿, 'utf8');
  assert.ok(t.includes('\n---'), '실저장소 템플릿에 --- 경계가 없다');
  /* 아래 조립은 **repo 밖**(홈의 memory 인덱스)에 기댄다 — CI 는 빈 HOME 이라 여기서 죽는다.
   * 실측: 이 한 줄이 master CI 를 빨갛게 만들었다(run 31110105803·31110558301·31112128282,
   * 셋 다 `fail 1` = 이 테스트 하나). 로컬 초록이 CI 초록이 아니라는 조항의 실사고다.
   * 탐지력은 위 픽스처 4건이 지므로, 실저장소 조립은 인덱스가 있을 때만 재고 없으면
   * **skip 으로 드러낸다**(통과와 미실행이 같은 모양이면 안 된다). */
  let p;
  try {
    // 실재료로 조립해 본다 — 이음매만 맞고 실물이 새면 그 사실이 안 보인다.
    // 대상은 아무 md 나 좋다(여기선 이 저장소의 방향 정본) — 검사하는 건 **프롬프트가 무엇으로 시작하는가**다.
    p = 검수.심문프롬프트(검수.방향경로);
  } catch (e) {
    if (e.확인불가) return ctx.skip('memory 인덱스 없음(빈 HOME) — 실재료 조립 미실행');
    throw e;
  }
  assert.match(p.slice(0, 60), /당신은 독립 반대심문자다/, '프롬프트가 지시문으로 시작하지 않는다 — 운영 메모가 앞에 붙었다');
});

/* 🔴 2026-08-07 유호님 지시("다음 동결 때 두 모델로 돌려줘 둘다 맥스로")로 드러난 구멍:
 *   결과 경로에 모델이 없어 두 번째 모델이 첫 번째를 **조용히 덮었다**(08-06 심문기록 2행이 같은 파일).
 *   sol↔luna 대조는 「같은 문서·같은 효력·모델만 다름」이 조건이라, 덮이면 실측 자체가 불가능하다. */
test('심문: 결과 경로가 모델로 갈린다 — 안 갈리면 두 모델 대조가 첫 결과를 덮는다', () => {
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const a = 검수.심문결과경로(대상, 'sol');
  const b = 검수.심문결과경로(대상, 'luna');
  assert.strictEqual(a.지문, b.지문, '같은 파일인데 지문이 갈렸다 — 지문은 내용에만 매여야 한다');
  assert.notStrictEqual(a.경로, b.경로, 'sol 과 luna 의 결과가 같은 파일이다 — 뒤에 돈 쪽이 앞을 덮는다');
  assert.match(a.경로, /-sol\.md$/, '경로에 모델 이름이 없다');
  assert.match(b.경로, /-luna\.md$/, '경로에 모델 이름이 없다');
});

test('심문: 대상이 한 바이트 바뀌면 결과 경로도 바뀐다 — 옛 심문이 새 문서의 것으로 읽히면 안 된다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 전 = 검수.심문결과경로(대상, 'sol').경로;
  fs.appendFileSync(대상, '.');
  assert.notStrictEqual(전, 검수.심문결과경로(대상, 'sol').경로, '내용이 바뀌었는데 같은 파일에 덮어쓴다');
});

test('심문: 모델 이름 없이는 경로를 안 만든다 — 이름 없는 결과는 남의 것을 덮는다', () => {
  assert.throws(() => 검수.심문결과경로(심문픽스처('# 계약'), ''), /모델 이름이 없다/);
});

/* 🔴 2026-08-07 같은 날 두 번 밟았다: 말하기_설계 sol↔luna 대조가 「luna 가 2건 더 잡았다」를 냈는데
 *   두 런 사이에 memory 인덱스가 갱신돼 **모델 차이인지 프롬프트 차이인지 못 갈랐고**, 그 대조는
 *   판정으로 승격되지 못했다. 장부가 박던 건 `방향`(제품방향.md — 거의 안 바뀐다) 지문뿐이고
 *   정작 매 런 바뀌는 금지목록은 안 박았다. 「조건이 같았다」를 사후에 증명할 수 없으면
 *   대조는 **돌린 적 없는 것과 같다** — 그런데 결과 파일은 멀쩡히 남아 판정처럼 인용된다. */
test('심문: 금지목록 지문이 내용에 매인다 — 같아야 「모델만 다름」이 성립한다', () => {
  const 금지 = 심문픽스처('머리말\n- 🚫 포인트 재제안 금지\n평범한 줄', 'MEMORY.md');
  const 전 = 검수.금지지문(금지);
  assert.match(전, /^[0-9a-f]{12}$/, '지문 모양이 아니다');
  assert.strictEqual(전, 검수.금지지문(금지), '같은 인덱스인데 지문이 흔들린다 — 대조 조건을 못 고정한다');

  // 🚫 줄이 바뀌면 지문도 바뀌어야 한다. 안 바뀌면 오염된 대조가 「조건 동일」로 남는다.
  fs.appendFileSync(금지, '\n- 🚫 스토어 재제안 금지');
  assert.notStrictEqual(전, 검수.금지지문(금지), '금지 줄이 늘었는데 지문이 그대로다');
});

test('심문: 🚫 없는 줄은 지문을 안 흔든다 — 무관한 편집이 「조건 달라짐」으로 오독되면 대조가 못 선다', () => {
  const 금지 = 심문픽스처('머리말\n- 🚫 포인트 재제안 금지', 'MEMORY.md');
  const 전 = 검수.금지지문(금지);
  fs.appendFileSync(금지, '\n색인 정리 메모 — 프롬프트에 안 실린다');
  assert.strictEqual(전, 검수.금지지문(금지), '프롬프트에 안 실리는 줄이 지문을 바꿨다 — 거짓 「조건 달라짐」');
});

/* 🔴 2026-08-07 실사고: 기능체크 프롬프트에 채택 제안의 **제목만** 실렸다. 그래서 08-04 에 범위를
 *   좁혀 채택한 3건이 「채택 기록은 있는데 구현이 없다」로 되돌아왔다(P1 2·P3 1) — 그중 둘은
 *   판정문이 명시적으로 잘라낸 부분을 요구했다. 새는 방향은 여기서도 「통과」다: 범위가 빠져도
 *   프롬프트는 멀쩡해 보이고, 결과는 그냥 **매번 나오는 지적**으로 나타난다. */
test('기능체크: 채택 제안 줄에 범위(판정 사유)가 실린다 — 제목만 실으면 좁힌 채택이 전량 채택으로 읽힌다', () => {
  const 현황 = new Map([
    ['k1', { 제목: '기능지도에 학습데이터 계약', 상태: '채택', 사유: '단 범위를 좁혀 채택한다 — 채택 범위=데이터 경로를 건드리는 변경에만' }],
    ['k2', { 제목: '기각된 제안', 상태: '기각', 사유: '틀렸다' }],
    ['k3', { 제목: '아직 판정 전', 상태: '제안됨' }],
  ]);
  const 줄 = 검수.채택제안줄들(현황);
  assert.strictEqual(줄.length, 1, '채택 아닌 제안이 섞였다 — 기각·미판정이 「구현했어야 할 것」으로 간다');
  assert.match(줄[0], /기능지도에 학습데이터 계약/, '제목이 빠졌다');
  assert.match(줄[0], /채택 범위=데이터 경로를 건드리는 변경에만/, '범위가 안 실렸다 — 검수자가 전량 채택으로 읽는다');
});

test('기능체크: 범위 기록이 없으면 그 사실이 드러난다 — 빈 자리가 「제한 없음」으로 읽히면 안 된다', () => {
  const 줄 = 검수.채택제안줄들(new Map([['k', { 제목: '범위 없는 채택', 상태: '채택' }]]));
  assert.match(줄[0], /범위 기록 없음/, '사유가 없는데 조용히 제목만 실었다');
});
