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
const { spawnSync } = require('node:child_process');
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

  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), '--기각', 처방[1], '--사유', '회귀 시험'], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
  });
  assert.strictEqual(r.status, 0, `처방 명령이 실패했다: ${r.stderr}`);
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, fx).level, 'ok', '처방을 따랐는데 여전히 막힌다');
});

test('사유 없는 기각은 거부된다 — 왜 무시하는지 못 적으면 다음 회차에 설명할 수 없다', () => {
  const fx = 장부([], []);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), '--기각', 'k1'], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
  });
  assert.notStrictEqual(r.status, 0, '사유 없는 기각이 통과했다');
});

// ───────────────────────────────── 등록층 (가드가 실제로 이걸 부르는가)

test('🔑 clasp-guard 가 block 판정을 **실제 deny 로** 옮긴다 (등록층 — 가드는 로직보다 여기서 샌다)', () => {
  const fx = 장부([기록({ 지적: [지적('P0', 'k1')] })], []);
  const r = spawnSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js')], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'clasp push --force' }, cwd: ROOT }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_REVIEW_LEDGER: fx.기록경로, SYNK_REVIEW_REJECTS: fx.기각경로 },
    timeout: 180000,
  });
  assert.strictEqual(r.status, 0);
  const out = (r.stdout || '').trim();
  assert.ok(out, '가드가 아무 말도 하지 않았다');
  const j = JSON.parse(out);
  assert.strictEqual(j.hookSpecificOutput?.permissionDecision, 'deny', '차단급 지적이 있는데 배포가 통과했다');
  assert.match(j.hookSpecificOutput.permissionDecisionReason, /이종 검수/);
});

test('🔑 알림(none)은 배포를 **막지 않는다** — 폰 클라우드 세션엔 codex 가 없어 따를 수 없는 처방이 된다', () => {
  const fx = 장부([], []); // 기록 0건 = none
  const r = spawnSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js')], {
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
  const r = spawnSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js')], {
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
