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
/* 자체 CLI 플래그 목록을 그 파일에서 읽어 온다 — 예외를 이 시험에 하드코딩하면 두 곳이 갈린다(09-04). */
const 정책 = require(path.join(ROOT, 'tools', '모델정책.js'));
const 점검 = require(path.join(ROOT, 'tools', '배포판점검.js'));

const 루트프로젝트 = ROOT;
const 이름 = '(루트)';

/* 실제 지문을 쓴다 — 가짜 지문으로 시험하면 「지문이 맞을 때」 경로를 한 번도 안 밟는다. */
const 실지문 = 점검.지문(루트프로젝트, ROOT);

/* 아래 등록층 검사가 훅에 주는 cwd — **워크트리가 아님이 보장된 픽스처 저장소**다(F217).
 * ROOT 를 주면 호스트가 워크트리일 때 clasp-guard 규칙 0(워크트리 배포 차단)이 이종검수보다
 * 먼저 발화해, 검사가 **다른 사유의 deny 를 결함으로** 읽는다 — 환경과 결함을 못 가른 것이다.
 * 08-07 실측: 워크트리 test-ci 2회 연속 같은 적색 / 본 트리·새 클론은 초록. 라이브 재현도
 * 같은 답이었다("워크트리에서는 clasp push/deploy를 하지 않는다 (angry-raman-d891af …)").
 * 판정 대상은 안 바뀐다 — resolveProject 는 .clasp.json 을 못 찾으면 root(=ROOT)로 떨어진다. */
const 훅CWD = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-훅cwd-'));
  spawnSync('git', ['-C', d, 'init', '-q']);
  return d;
})();

/* 세 등록층 검사가 **같은 입력 하나**를 쓴다 — cwd 를 되돌리려면 여기 한 곳뿐이고,
 * 바로 아래 회귀가 그 한 곳을 잰다(호출부마다 흩어두면 회귀가 못 따라간다). */
const 배포입력 = () => JSON.stringify({
  tool_name: 'Bash', tool_input: { command: 'clasp push --force' }, cwd: 훅CWD,
});

/* 세 번째 인자 = **작업본에 미커밋인 배포 파일 목록**(F335). 안 주면 게이트가 실저장소를 잰다.
 * 처방이 이 값으로 갈리므로 처방을 보는 검사는 반드시 값을 준다 — 실저장소는 옆 세션이
 * 배포 파일을 들었다 놨다 해서 같은 검사가 날마다 다른 갈래를 밟는다(그건 판정이 아니다). */
function 장부(기록들, 기각들, 배포미커밋) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-review-fx-'));
  const 기록경로 = path.join(d, '기록.jsonl');
  const 기각경로 = path.join(d, '기각.jsonl');
  fs.writeFileSync(기록경로, 기록들.map((o) => JSON.stringify(o)).join('\n') + (기록들.length ? '\n' : ''));
  fs.writeFileSync(기각경로, 기각들.map((o) => JSON.stringify(o)).join('\n') + (기각들.length ? '\n' : ''));
  return { 기록경로, 기각경로, dir: d, ...(배포미커밋 === undefined ? {} : { 배포미커밋 }) };
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

/* ☠️ 검수 기록이 이 배포에 **붙는가** — 2026-08-09 실측.
 * `--commit` 은 오래도록 「그 커밋이 곧 HEAD」일 때만 지문을 적었다. 지문은 배포집합만 해싱하니
 * HEAD 동일성은 뜻보다 넓은 조건이고, 이 저장소는 세션들이 docs·tools 를 쉼 없이 커밋해 버전
 * 커밋이 HEAD 인 순간이 거의 없다 → 「남이 안 밀고 간 판을 떠맡아 검수하고 미는」 확립된 통로에서
 * 게이트가 구조적으로 안 채워졌다. v9.198 검수가 차단급 P1 을 잡았는데 지문이 비어 배포를 못 막았다. */
test('🔑 배포 파일이 안 바뀐 뒤 커밋들은 검수 기록을 무효로 만들지 않는다', () => {
  assert.strictEqual(검수.배포변경있나(['docs/_ops/보드/x.md', 'tools/friction.js', 'tests/a.test.js'], 루트프로젝트, ROOT), false,
    'docs·tools·tests 커밋이 배포 바이트를 바꾼 것으로 읽히면 이 저장소에선 게이트가 영원히 안 닫힌다');
});

test('☠️ 배포 파일이 바뀌었으면 여전히 무효다 — 옛 검수를 새 바이트에 붙이면 게이트가 거짓이 된다', () => {
  assert.strictEqual(검수.배포변경있나(['docs/x.md', 'Code.js'], 루트프로젝트, ROOT), true,
    '배포 파일 하나만 섞여도 그 검수는 지금 나갈 바이트를 본 적이 없다');
});

/* ☠️ 처방이 자기 게이트를 여는가 (맹점 ③ · F103 과 같은 축) — 2026-08-09 실측.
 * 게이트는 오래도록 `node tools/codex-review.js` 를 인자 없이 처방했는데, 그러면 미커밋이
 * 있을 때 **작업본**을 검수한다(`대상결정`). 이 저장소는 세션이 동시에 돌아 작업본에 늘
 * 남의 미커밋이 있고, 그 diff 엔 배포 파일이 없어 `범위` 밖으로 기록된다 → 처방을 그대로
 * 따라도 게이트는 그대로다. 그 호출로 50분을 태우고 기록이 안 남는 것을 실측했다. */
for (const [갈래, 만들기] of [
  ['none', () => 장부([], [], [])],
  ['scope', () => 장부([기록({ 범위: ['crewcard'] })], [], [])],
]) {
  test(`☠️ ${갈래} 처방은 **과녁을 댄다**(작업본이 깨끗할 때) — 인자 없는 호출은 작업본을 검수해 이 게이트를 못 채운다`, () => {
    const r = 검수.게이트판정(루트프로젝트, ROOT, 만들기());
    const 처방 = r.lines.filter((l) => l.includes('→')).join(' ');
    assert.match(처방, /codex-review\.js\s+--commit\s+[0-9a-f]{7,}/,
      '과녁 없는 처방은 남의 미커밋을 검수하게 만든다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다');
    assert.match(r.lines.join('\n'), /작업본 미커밋/, '왜 과녁이 필요한지를 안 적으면 다음 사람이 인자를 뗀다');
  });
}

/* ☠️ F335 — 위 처방(과녁)이 **반대쪽 조건에서 되갚였다**(2026-08-11 실측 `81ffe463`).
 * 배포 파일을 고쳐 작업본이 더러워지면 지문이 바뀌어 게이트가 none 으로 내려가는데, 그 상태에서
 * `--commit <sha>` 검수는 `유효지문` 이 **일부러** 지문을 안 적는 갈래다(아래 「지문 결속」 3검사).
 * 즉 처방을 그대로 따라도 게이트는 **같은 문구로** 남는다 — F103 그 자체이고, 실측 소각은 20~40분.
 * 가르는 축은 하나뿐이다: 이 프로젝트의 배포 파일이 지금 미커밋인가. */
for (const 갈래 of ['none', 'scope']) {
  const 만들기 = (더러움) => (갈래 === 'none'
    ? 장부([], [], 더러움)
    : 장부([기록({ 범위: ['crewcard'] })], [], 더러움));

  test(`☠️ ${갈래} · 배포 파일이 미커밋이면 처방에서 **과녁을 뗀다** — 과녁을 대면 지문이 안 적혀 게이트가 원리상 안 열린다`, () => {
    const r = 검수.게이트판정(루트프로젝트, ROOT, 만들기(['Code.js', '엔진_수집.js']));
    const 전문 = r.lines.join('\n');
    assert.strictEqual(r.level, 갈래);
    assert.doesNotMatch(전문, /--commit\s/,
      '더러운 작업본에 과녁을 처방했다 — 따라도 게이트가 그대로다(F335)');
    assert.match(전문, /Code\.js/, '어느 파일이 미커밋인지 안 적으면 왜 갈렸는지 알 수 없다');
    assert.match(전문, /F335/, '근거 번호가 없으면 다음 사람이 「과녁을 빠뜨렸다」고 되돌린다');
  });

  test(`🔑 ${갈래} · 못 쟀으면 한쪽으로 접지 않는다 — 모름을 확신으로 적으면 그게 또 따를 수 없는 처방이다`, () => {
    const 전문 = 검수.게이트판정(루트프로젝트, ROOT, 만들기(null)).lines.join('\n');
    assert.match(전문, /못 쟀다/, '못 쟀다는 사실을 안 적었다');
    assert.match(전문, /--commit\s|과녁/, '깨끗할 때의 갈래를 안 남기면 그 경우에 따를 명령이 없다');
    assert.match(전문, /codex-review\.js\s*$|codex-review\.js\)/m, '미커밋일 때의 갈래(인자 없는 호출)를 안 남겼다');
  });
}

/* 🔴 [09-03] **자를 갈았다.** 옛 판은 `notStrictEqual(루트, 크루)` 로 «두 과녁이 서로 다른가»를
 *   쟀는데, 그건 지켜야 할 성질이 아니라 **실이력의 우연**이다. 한 커밋이 양쪽 배포 파일을 함께
 *   담으면(`3e30bc37` 이 루트 엔진 넷 + `crewcard/상담시트.js` 를 같이 담았다) 두 과녁이 «같은
 *   것»이 정확한 답이다 — 그 diff 에 양쪽 배포 파일이 다 들어 어느 쪽도 범위 밖이 아니다.
 *   그런데 옛 자는 그 정상 상태를 적색으로 냈고, 배포 게이트가 «테스트 실패»로 라이브를 막았다.
 *   ⇒ 이 파일 머리가 스스로 적어 둔 규칙(「실저장소에는 **거짓양성만** 검사한다」)을 어긴 자리였다.
 * 🔑 원래 막으려던 사고는 「그 diff 에 자기 배포 파일이 **없는** 커밋을 처방하는 것」이다(F292).
 *   그러니 그 성질을 직접 잰다 — 두 과녁이 우연히 갈리는지가 아니라, **각 과녁이 자기 프로젝트의**
 *   **배포 파일을 실제로 담았는지**. 커밋을 어떻게 가르든 이 자는 같은 답을 낸다. */
test('🔑 과녁은 **프로젝트별**이다 — 처방한 커밋에 그 프로젝트의 배포 파일이 들어 있어야 한다', () => {
  const 근 = (p) => 검수.게이트판정(p, ROOT, 장부([], [], []))
    .lines.join('\n').match(/--commit\s+([0-9a-f]+)/);
  for (const [proj, 이름] of [[루트프로젝트, '(루트)'], [path.join(ROOT, 'crewcard'), 'crewcard']]) {
    const m = 근(proj);
    assert.ok(m, 이름 + ' 과녁이 안 나왔다 — 두 프로젝트 다 과녁이 나와야 한다');
    const r = spawnSync('git', ['-C', ROOT, 'show', '--name-only', '--format=', m[1]], { encoding: 'utf8' });
    const 담김 = (r.stdout || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const 집합 = 점검.배포집합(proj, ROOT) || [];
    assert.ok(집합.length, 이름 + ' 배포집합을 못 읽었다 — 못 읽으면 아래 판정이 언제나 초록이다');
    /* 🔴 09-05: 「0건」이 «배포 파일이 없다»인지 «diff 를 못 읽었다»인지 갈라야 한다. 옛 판은 둘을
     *   한 말로 냈고, 원격 CI 에서 git 이 죽으면(실측: `fatal: not a git repository`) 멀쩡한 커밋을
     *   F292 위반으로 몰았다 — run 33915165291. 못 읽은 것은 «없음»이 아니라 «안 재봤음»이다. */
    if (r.status !== 0 || !담김.length) {
      console.log(`  ↷ skip: ${이름} 과녁 ${m[1]} 의 diff 를 못 읽었다`
        + ` (git 종료 ${r.status}${r.stderr ? ' · ' + String(r.stderr).trim().split('\n')[0] : ''})`
        + ' — 「배포 파일이 0건」이 아니라 «못 쟀다»다');
      continue;
    }
    assert.ok(담김.some((f) => 집합.includes(f)),
      이름 + ' 에 처방한 커밋 ' + m[1] + ' 의 diff 에 그 프로젝트 배포 파일이 0건이다 — '
      + '처방을 그대로 따라도 «범위 밖»으로 기록돼 게이트가 그대로 남는다(F292)');
  }
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

// ───────────────────────────────── 실패 판별 (F249 — 「확인 불가」가 원인을 가리면 안 된다)

/* 픽스처는 **실측한 그 바이트**다(2026-08-08 · codex-cli 0.146.0 을 실제로 실패시켜 받아 적었다).
 * 지어낸 모양으로 검사하면 배너 문구가 조금만 달라도 통과하면서 현장에선 그대로 샌다(맹점 ①). */
const 배너 = [
  'OpenAI Codex v0.146.0', '--------',
  'workdir: C:\\Users\\q1212\\Documents\\SYNK-appsscript',
  'model: gpt-5.6-sol', 'provider: openai', 'approval: never', 'sandbox: read-only',
  'reasoning effort: xhigh', 'reasoning summaries: none',
  'session id: 019fe050-2b93-7ea0-9142-60194347ca81', '--------',
];
const 타임아웃err = { signal: 'SIGTERM', status: null, stderr: [...배너, 'user', '1+1?', ''].join('\n') };
const 실행중err = {
  signal: null, status: 1,
  stderr: [...배너, 'user', 'hi', '',
    'warning: Model metadata for `no-such-model-xyz` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.',
    'ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'no-such-model-xyz\' model is not supported when using Codex with a ChatGPT account."}}',
  ].join('\n'),
};
const 인자err = {
  signal: null, status: 2,
  stderr: ["error: invalid value 'bogus-value' for '--sandbox <SANDBOX_MODE>'",
    '  [possible values: read-only, workspace-write, danger-full-access]', '',
    "For more information, try '--help'."].join('\n'),
};

test('🔑 타임아웃과 실행 중 실패가 **다른 문장**으로 나온다 — 같은 모양이면 원인 판별이 원리상 불가능하다', () => {
  const a = 검수.실패요점(타임아웃err, 900000, 'codex 검수');
  const b = 검수.실패요점(실행중err, 900000, 'codex 검수');
  assert.notStrictEqual(a, b, '두 실패가 같은 문장으로 나왔다 — F249 가 그대로 재발한다');
});

test('🔑 타임아웃은 signal 로 가른다 — 실측에서 e.killed 는 undefined 였다(그걸 봤으면 조용히 샌다)', () => {
  assert.strictEqual(타임아웃err.killed, undefined, '픽스처 전제가 깨졌다 — killed 를 봐도 되는 상황이면 이 검사는 무의미하다');
  const 문장 = 검수.실패요점(타임아웃err, 900000, 'codex 검수');
  assert.match(문장, /타임아웃/, '타임아웃을 타임아웃이라 부르지 않았다');
  assert.match(문장, /900/, '소진한 초를 안 밝혔다 — 얼마를 기다렸는지 모르면 얼마로 늘릴지도 모른다');
});

test('🔑 타임아웃 처방이 **실행 가능한 명령**이다 — 그 플래그를 도구가 실제로 안다 (F103 자기 처방)', () => {
  const 문장 = 검수.실패요점(타임아웃err, 900000, 'codex 검수');
  const m = 문장.match(/--timeout (\d+)/);
  assert.ok(m, '늘릴 명령을 안 줬다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다');
  assert.ok(검수.값플래그.includes('--timeout'), '처방이 시키는 --timeout 을 인자 파서가 모른다');
  assert.ok(Number(m[1]) > 900, '소진한 값보다 크게 늘리라고 하지 않았다');
});

test('🔑 실행 중 실패는 stderr **맨 뒤**를 보인다 — 배너가 앞 11줄이라 앞을 자르면 영영 배너만 보인다', () => {
  const 문장 = 검수.실패요점(실행중err, 900000, 'codex 검수');
  assert.match(문장, /invalid_request_error/, '진짜 오류 줄이 안 실렸다');
  assert.doesNotMatch(문장, /OpenAI Codex|workdir:|session id:/, '배너가 그대로 실렸다 — F249 그 자체다');
});

test('배너가 없는 인자 오류는 그대로 보인다 — 필터가 멀쩡한 오류까지 먹으면 안 된다', () => {
  const 문장 = 검수.실패요점(인자err, 900000, 'codex 검수');
  assert.match(문장, /invalid value 'bogus-value'/, '배너 필터가 진짜 오류를 먹었다');
});

test('stderr 가 배너뿐이면 **그 사실을 말한다** — 빈 문장이 「원인 없음」으로 읽히면 안 된다', () => {
  const 문장 = 검수.실패요점({ signal: null, stderr: 배너.join('\n') }, 900000, 'codex 검수');
  assert.match(문장, /배너뿐/, '걸러낸 결과가 비었는데 조용했다');
});

test('검수 기본 타임아웃이 심문보다 짧지 않다 — 더 무거운 쪽이 더 짧으면 「확인 불가」만 쌓인다 (F249 ③)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const 기본값들 = [...src.matchAll(/argv\.indexOf\('--timeout'\) \+ 1\]\) : (\d+);/g)].map((m) => Number(m[1]));
  assert.strictEqual(기본값들.length, 2, '타임아웃 기본값 자리가 2곳이 아니다 — 검사가 실제 코드를 못 짚고 있다');
  assert.ok(Math.min(...기본값들) >= 1800, `기본 타임아웃이 실측(15분+)보다 짧다: ${기본값들.join(', ')}`);
});

/* 위 검사는 **기본값 자리**만 본다 — 그래서 호출부가 그 값을 도로 깎아도 초록이었다(08-10 실측).
 * 기능체크에 실제로 건네지는 인자를 뽑는 한 함수를 두고, 탐지력은 픽스처가·거짓양성은 실저장소가 진다. */
/* 🔴 첫 인자를 이름으로 묶지 않는다(2026-08-17 실측으로 배웠다). 예전엔 `스키마실행\(프롬프트,` 로
 *   박아 뒀는데, 회차별 렌즈가 들어오며 그 인자가 `기능프롬프트들[i - 1]` 이 되자 **호출부를 통째로
 *   못 짚었다.** 그때 이 회귀는 「타임아웃이 안 깎인다」를 검사하는 게 아니라 **아무것도** 검사하지
 *   않는 상태로 초록이 될 수 있었다(마침 `assert.ok(인자)` 가 있어 빨갛게 죽어 준 것이다).
 *   재는 것은 「첫 인자가 무엇이라 불리나」가 아니라 「세 번째 인자가 깎이나」다 — 그것만 묶는다. */
const 기능체크타임아웃인자 = (src) => {
  const m = src.match(/스키마실행\([^,]+, 기능체크스키마경로, ([^,]+),/);
  return m && m[1].trim();
};

test('🔑 탐지력 — 옛 형태(호출부 상한)를 실제로 잡는다 (픽스처가 진다 · 실저장소는 거짓양성만)', () => {
  const 옛 = '모음.push(스키마실행(프롬프트, 기능체크스키마경로, Math.min(초 * 1000, 900000),\n  `codex 기능체크`));';
  const 인자 = 기능체크타임아웃인자(옛);
  assert.ok(인자, '픽스처에서 호출부를 못 찾았다 — 못 찾으면 실저장소에서도 못 찾아 이 회귀는 통째로 공회전한다');
  assert.match(인자, /Math\.min/, '옛 형태를 못 잡았다 — 탐지력 0 인 회귀다');
});

test('🔑 탐지력 — 인자 «이름»이 바뀌어도 호출부를 짚는다 (08-17 에 실제로 놓쳤던 형태)', () => {
  const 새 = 'const r = 스키마실행(기능프롬프트들[i - 1], 기능체크스키마경로, Math.min(초 * 1000, 900000),\n  `codex 기능체크`);';
  const 인자 = 기능체크타임아웃인자(새);
  assert.ok(인자, '인자 이름이 바뀌자 못 찾는다 — 이름에 묶인 회귀는 리팩터 한 번에 공회전한다');
  assert.match(인자, /Math\.min/, '새 형태에서 옛 병을 못 잡았다');
});

/* 🔑 호출부는 **둘**이다 — 자식 실행부(방에서 `입력.timeoutMs` 를 읽는다)와 부모 순차 폴백(`초 * 1000`).
 *   옛 검사는 첫 인자 이름에 묶여 **부모만** 봤고, 그래서 자식 쪽이 깎여도 초록이었다(08-17 발견).
 *   병렬이 기본이라 실제로 도는 것은 대개 **자식** 쪽이다 — 안 보던 그 자리가 정작 급소였다. */
const 기능체크타임아웃인자들 = (src) =>
  [...src.matchAll(/스키마실행\([^,]+, 기능체크스키마경로, ([^,]+),/g)].map((m) => m[1].trim());

test('🔑 기능체크 패스가 --timeout 을 **깎지 않는다** — 처방이 안 닿는 자리가 있으면 그 처방은 거짓이다 (F103 · 08-10 실측)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const 인자들 = 기능체크타임아웃인자들(src);
  assert.ok(인자들.length >= 2,
    `기능체크 호출부를 ${인자들.length}개만 찾았다(자식·부모 둘이어야 한다) — 검사가 실제 코드를 못 짚고 있다`);
  for (const 인자 of 인자들) {
    assert.doesNotMatch(인자, /Math\.min/,
      `기능체크 타임아웃이 호출부에서 눌린다(${인자}) — 도구는 「--timeout 을 늘려 다시 돌린다」고 처방하는데 그 플래그가 이 자리엔 안 닿는다`);
  }
  /* 사용자가 준 `초` 가 **어딘가에는** 닿아야 한다. 자식은 그 값을 방에서 받으므로 `입력.timeoutMs`
   * 가 정상이고, 그 방을 채우는 부모 자리가 `초 * 1000` 이어야 사슬이 이어진다. */
  assert.ok(인자들.some((a) => /초 \* 1000/.test(a)),
    `기능체크가 사용자 지정 타임아웃(초)을 어디서도 안 쓴다: ${인자들.join(' | ')}`);
  assert.match(src, /timeoutMs: 초 \* 1000/,
    '부모가 방에 적는 timeoutMs 가 `초` 에서 오지 않으면, 자식의 `입력.timeoutMs` 는 사용자 값이 아니다');
});

// ───────────────────────────────── 등록층 (가드가 실제로 이걸 부르는가)

test('🔑 등록층은 **워크트리 아닌 cwd** 로 훅을 띄운다 — 호스트가 워크트리면 규칙 0 이 먼저 답한다 (F217)', () => {
  const { execFileSync } = require('node:child_process');
  /* 상수가 아니라 **아래 검사가 실제로 보내는 입력**을 재야 한다 — 픽스처만 잠그면
   * 스폰 쪽을 ROOT 로 되돌려도 회귀가 초록인 채로 남는다(그러면 잠근 게 아니다). */
  const cwd = JSON.parse(배포입력()).cwd;
  const g = (...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim();
  assert.notStrictEqual(cwd, ROOT,
    '훅에 호스트 저장소를 주면 워크트리 세션에서 이종검수가 아닌 사유로 막히고, 아래 검사가 그걸 결함으로 읽는다');
  /* 「그냥 다른 경로」로는 부족하다 — 그 경로가 또 워크트리면 같은 자리에서 같은 병이 난다.
   * 규칙 0 의 판정식(git-dir vs git-common-dir)을 그대로 재서 못박는다. */
  assert.strictEqual(
    path.resolve(cwd, g('rev-parse', '--absolute-git-dir')),
    path.resolve(cwd, g('rev-parse', '--git-common-dir')),
    'cwd 가 워크트리다 — clasp-guard 규칙 0 이 발화해 아래 등록층 검사가 통째로 무의미해진다');
});

test('🔑 clasp-guard 가 block 판정을 **실제 deny 로** 옮긴다 (등록층 — 가드는 로직보다 여기서 샌다)', () => {
  const fx = 장부([기록({ 지적: [지적('P0', 'k1')] })], []);
  const r = 훅띄우기(path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js'), {
    input: 배포입력(),
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
    input: 배포입력(),
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
    input: 배포입력(),
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
    /* 모델정책.js «자체» CLI 플래그는 codex-review 의 인자가 아니다. 목록을 여기 하드코딩하면
     * 그쪽에 플래그를 더할 때마다 두 곳을 고쳐야 하고 한쪽만 고치면 조용히 빨개진다 —
     * 그래서 그 파일이 `자체플래그` 로 스스로 말하게 하고 여기서는 읽기만 한다(09-04). */
    if (정책.자체플래그.has(f)) continue;
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

// ─────────── 판단 정본 게이트 (2026-08-12 · F344 — 「gpt도 내 철학 정본을 읽고 있나」의 답은 «아니다»였다)
/* 이 게이트가 새는 방향도 「통과」다 — 정본을 못 뽑아도 검수는 **똑같이 끝까지 돌고** 지적만 안 나온다.
 * 그래서 위 방향 스탬프 4종을 그대로 대칭 복제하고, 여기에 **뽑기 실패**를 재는 검사를 더 건다:
 * 방향은 파일을 통째로 싣지만 철학은 절을 **발췌**하므로, 앵커가 깨지는 새 실패 모드가 있다. */

test('철학 지문은 결정론적이고, 정본이 1바이트만 바뀌어도 달라진다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-철학-'));
  const p = path.join(d, 'SYNK_철학.md');
  fs.writeFileSync(p, '판단 기준 본문');
  const a = 검수.철학지문(p);
  assert.strictEqual(a, 검수.철학지문(p), '같은 파일인데 지문이 흔들린다 — 장부 대조가 불가능해진다');
  fs.writeFileSync(p, '판단 기준 본문.');
  assert.notStrictEqual(검수.철학지문(p), a, '정본이 바뀌었는데 지문이 같다 — 개정을 못 가른다');
});

test('🔴 판단 정본이 없으면 빈 값이 아니라 「없음」을 박는다 — 기준 없이 돈 것과 안 적힌 것이 같은 모양이면 안 된다', () => {
  const 없는경로 = path.join(os.tmpdir(), 'synk-철학-없는파일-' + process.pid, 'SYNK_철학.md');
  assert.strictEqual(검수.철학지문(없는경로), '없음');
  assert.strictEqual(검수.철학텍스트(없는경로), '', '정본이 없는데 뭔가를 실었다');
});

/* 🔑 이 검사가 이 묶음의 급소다 — 앵커는 정본의 **절 구조 그 자체**라, 정본이 개정되며 절 제목이
 *   바뀌면 여기서 빨개져야 한다. 안 걸면 게이트는 조용히 반쪽이 되고 검수는 그대로 초록을 낸다. */
test('🔑 실저장소 정본에서 게이트 다섯 자리가 **전부** 뽑힌다 — 하나라도 빠지면 반쪽 기준으로 검수가 돈다', () => {
  const t = 검수.철학텍스트();
  assert.notStrictEqual(검수.철학지문(), '없음', 'docs/SYNK_철학.md 를 못 읽는다');
  assert.ok(t, '정본은 있는데 게이트를 한 자리도 못 뽑았다 — 앵커가 통째로 깨졌다');
  assert.doesNotMatch(t, /반쪽이다/, `게이트가 반쪽이다 — 정본 절 구조가 바뀌었다(앵커를 고쳐라):\n${t.slice(-300)}`);
  for (const 자리 of ['[궁극 가치]', '[「똑똑하게」 4층', '[하지 않는 것 셋]', '[적용 대상', '[이해 3층]']) {
    assert.ok(t.includes(자리), `게이트에 ${자리} 가 없다`);
  }
  assert.ok(t.length <= 검수.철학상한, `게이트가 상한을 넘었다(${t.length} > ${검수.철학상한})`);
});

test('🔴 자리를 못 뽑으면 «반쪽이다»를 블록 본문에 박는다 — stderr 는 심문 결과 파일에 안 남는다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-철학반쪽-'));
  const p = path.join(d, 'SYNK_철학.md');
  // 궁극 가치 앵커 하나만 살아 있는 정본 — 나머지 네 자리는 못 뽑힌다
  fs.writeFileSync(p, '# 철학\n\n**한 문장: 한 사람을 깊이 이해하는 교육 시스템\n\n다른 절\n');
  const t = 검수.철학텍스트(p);
  assert.match(t, /한 사람을 깊이 이해하는/, '뽑힌 자리까지 버렸다 — 하나라도 실리는 게 아무것도 안 실리는 것보다 낫다');
  assert.match(t, /반쪽이다/, '반쪽인데 온전한 것과 같은 모양으로 나갔다 — 이 게이트가 막으려는 상태가 바로 그것이다');
  assert.match(t, /하지 않는 것 셋/, '어느 자리가 빠졌는지 안 밝혔다 — 「반쪽」만으로는 고칠 자리를 모른다');
});

/* ── 경보의 «주소» — 픽스처가 낸 경보와 진짜 경보를 가른다 (#Q91 · 08-15) ─────────────
 * 🔴 사연: 바로 위 「반쪽」 픽스처가 stderr 로 **실정본 이름**을 외쳤다(경고문이 파일명을 상수로
 *   박았다). test-ci 출력만 보면 「정본 절 구조가 바뀌었다」와 구분이 안 돼, 한 세션이 정본이
 *   깨진 줄 알고 되짚었다 — 정본은 멀쩡했다. 적용 전/후가 같은 출력 모양을 쓰면 정상인 대상도
 *   경고로 읽힌다(F174). 값은 **읽는 사람의 오진단 비용**이고 CI 를 읽는 모든 세션에 반복된다.
 * 🔑 그래서 «정상 경보의 문구는 안 바꾼다» 쪽도 함께 못박는다 — 저장소 안 경로는 예전 그대로
 *   `docs/...` 상대 표기여야 한다. 안 그러면 진짜 경보를 알아보던 눈까지 같이 버린다. */
function 경고모으기(fn) {
  const 원래 = console.error;
  const 모음 = [];
  console.error = (...a) => 모음.push(a.map((x) => String(x)).join(' '));
  try { fn(); } finally { console.error = 원래; }
  return 모음.join('\n');
}

test('🔑 반쪽 픽스처의 경보는 **그 픽스처 경로**를 댄다 — 실정본 이름을 대면 진짜 경보와 구분이 안 된다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-철학주소-'));
  const p = path.join(d, 'SYNK_철학.md');
  fs.writeFileSync(p, '# 철학\n\n**한 문장: 한 사람을 깊이 이해하는 교육 시스템\n\n다른 절\n');
  try {
    const 경고 = 경고모으기(() => 검수.철학텍스트(p));
    assert.match(경고, /게이트 자리를 못 뽑았다/, '반쪽인데 경고가 안 나왔다 — 이 검사가 재는 대상이 사라졌다');
    assert.ok(경고.includes(p), `경보가 읽은 자리를 안 댄다 — 어느 파일이 반쪽인지 모른다:\n${경고}`);
    assert.doesNotMatch(경고, /docs\/SYNK_철학\.md/,
      '픽스처가 낸 경보가 **실정본 이름**을 댄다 — CI 출력에서 진짜 경보와 같은 모양이 되고, 읽는 세션이 없는 결함을 좇는다');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('🔑 「정본이 없다」 경보도 읽은 자리를 댄다 (두 경보 자리가 갈리지 않게)', () => {
  const 없는 = path.join(os.tmpdir(), 'synk-철학없음-' + process.pid, 'SYNK_철학.md');
  const 경고 = 경고모으기(() => 검수.철학텍스트(없는));
  assert.match(경고, /가 없다/, '없는 정본인데 경고가 안 나왔다');
  assert.ok(경고.includes(없는), `없음 경보가 읽은 자리를 안 댄다:\n${경고}`);
  assert.doesNotMatch(경고, /docs\/SYNK_철학\.md/, '없음 경보가 실정본 이름을 댄다 — 위 검사와 같은 병이 한 자리에만 고쳐졌다');
});

test('🔑 저장소 «안» 경로는 예전 그대로 `docs/…` 로 나온다 — 진짜 경보의 문구를 안 바꾼다 (거짓양성)', () => {
  /* 파일을 만들지 않는다 — repo 를 더럽히지 않고 「없음」 분기만 밟는다. 재는 것은 **표기**다. */
  const 경고 = 경고모으기(() => 검수.철학텍스트(path.join(ROOT, 'docs', '없는정본_회귀용.md')));
  assert.match(경고, /docs\/없는정본_회귀용\.md 가 없다/,
    `저장소 안 경로가 상대·슬래시 표기로 안 나온다 — 진짜 경보의 문구가 바뀌면 그것을 알아보던 눈도 같이 버린다:\n${경고}`);
  assert.doesNotMatch(경고, /[A-Za-z]:\\|\\\\/, `절대 경로·역슬래시가 샜다 — 플랫폼마다 경보 문구가 갈린다:\n${경고}`);
});

/* 🔴 서열이 이 배선의 절반이다: `docs/제품방향.md` 가 "화면·게임화는 … 목적이 아니다" 라고 가르치므로,
 *   두 정본을 나란히 놓기만 하면 갈리는 자리에서 방향이 이긴다 — 재미 축 지적은 그대로 안 나온다. */
test('🔴 선파악·기능체크 프롬프트가 게이트와 **서열 한 줄**을 둘 다 싣는다', () => {
  const 철학 = 검수.철학텍스트();
  for (const [이름, p] of [
    ['제안', 검수.제안프롬프트('diff 본문', [], 검수.방향텍스트(), 철학)],
    ['기능체크', 검수.기능체크프롬프트('diff 본문', [], 검수.방향텍스트(), 철학)],
  ]) {
    assert.match(p, /docs\/SYNK_철학\.md/, `${이름} 프롬프트에 판단 정본이 안 실렸다`);
    assert.match(p, /「앱의 방향」보다 상위다/, `${이름} 프롬프트에 서열 줄이 없다 — 갈리는 자리에서 방향이 이긴다`);
    assert.match(p, /재미/, `${이름} 프롬프트에 ①기본 게이트가 안 실렸다`);
    assert.match(p, /배관/, `${이름} 프롬프트에 적용 대상 분기가 없다 — 배관에까지 「재미있는가」를 묻게 된다`);
    assert.ok(p.indexOf('docs/SYNK_철학.md') < p.indexOf('앱의 방향 (유호님 확정'),
      `${이름} 프롬프트에서 방향이 판단 정본보다 앞에 온다 — 순서가 서열을 뒤집는다`);
  }
});

test('철학 블록은 비면 한 글자도 안 쓴다 — 빈 제목만 남으면 「실렸다」로 읽힌다', () => {
  assert.strictEqual(검수.철학블록(''), '');
  assert.strictEqual(검수.철학블록(null), '');
});

/* 방향 스탬프와 같은 축 — 변이 시험이 만들어낸 그 자리다(실제 codex 호출로만 쓰이는 행은 어떤
 * 검사도 안 닿는다). 철학 정본은 방향보다 **더 자주** 개정되므로 없으면 더 빨리 못 읽게 된다. */
test('🔴 선파악이 쓰는 기능지도·제안 행에 철학 지문이 박힌다', () => {
  const 결과 = { 기능지도: [{ 기능: 'ㄱ', 설명: 'ㄴ' }], 제안: [{ 제목: '새 제안', 무엇을: 'a', 왜: 'b', 구현방향: 'c', 크기: '소', 관련기능: 'ㄱ' }] };
  const { 기록행들 } = 검수.선파악행들(
    { 종류: 'commit', 값: 'cafe123' }, 결과, new Map(), '2026-08-12T00:00:00.000Z');
  for (const 종류 of ['기능지도', '제안']) {
    const 행 = 기록행들.find((r) => r.종류 === 종류);
    assert.strictEqual(행.철학, 검수.철학지문(), `${종류} 행에 철학 지문이 없다 — 정본이 개정되면 이 판정의 전제를 복원할 방법이 사라진다`);
  }
});

test('🔴 판정 행에도 철학 지문이 박힌다 (제안 채택/기각은 판단 기준 아래서 내려진다)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-제안장부-철학-'));
  const 제안장부 = path.join(d, '검수제안.jsonl');
  fs.writeFileSync(제안장부, JSON.stringify({
    종류: '제안', 시각: '2026-08-12T00:00:00.000Z',
    대상: { 종류: 'commit', 값: 'deadbee' }, 키: 'k철학',
    제목: '픽스처 제안', 무엇을: 'ㄱ', 왜: 'ㄴ', 구현방향: 'ㄷ', 크기: '중', 관련기능: 'ㄹ',
  }) + '\n');
  훅띄우기([path.join(ROOT, 'tools', 'codex-review.js'), '--제안판정', 'k철학', '--채택', '--사유', '회귀 시험'],
    { encoding: 'utf8', env: { ...process.env, SYNK_REVIEW_PROPOSALS: 제안장부 } });
  const 판정 = fs.readFileSync(제안장부, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    .find((x) => x.종류 === '판정');
  assert.ok(판정, '판정 행이 안 적혔다');
  assert.strictEqual(판정.철학, 검수.철학지문(), '판정 행에 철학 지문이 없다');
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
  const 템플릿 = 심문픽스처('머리말\n\n---\n닫힌 결정:\n{{금지목록}}\n\n기준:\n{{철학게이트}}\n\n대상:\n{{대상문서}}\n', '템플릿.md');
  const p = 검수.심문프롬프트(대상, 템플릿, 금지);
  assert.match(p, /필드 A 는 소급 불가다/, '대상 전문이 안 들어갔다');
  assert.match(p, /「똑똑하게」 4층/, '판단 정본 게이트가 안 들어갔다 — 기준 없이 돈 심문은 「지적 없음」과 같은 모양이다');
  assert.match(p, /🚫 포인트 재제안 금지/, '금지 줄이 안 들어갔다');
  assert.match(p, /🚫 스토어 재제안 금지/, '금지 줄을 일부만 실었다 — 골라 넣으면 독립성이 모델 이름에만 남는다');
  assert.doesNotMatch(p, /\{\{/, '치환 안 된 마커가 남았다');
  assert.doesNotMatch(p, /^평범한 줄$/m, '🚫 없는 줄까지 실었다');
});

test('심문(실저장소): 템플릿에 마커 셋이 실재한다 — 없으면 도구가 통째로 죽는다', () => {
  const t = fs.readFileSync(검수.심문템플릿, 'utf8');
  for (const 마커 of ['{{금지목록}}', '{{철학게이트}}', '{{대상문서}}']) {
    assert.ok(t.includes(마커), `실저장소 템플릿에 ${마커} 가 없다: ${검수.심문템플릿}`);
  }
});

/* 🔴 **코드가 먼저, 템플릿이 나중**이다(2026-08-12 착수 전 실측한 함정): `심문프롬프트` 는 아는
 *   마커만 치환하므로, 템플릿에 `{{철학게이트}}` 를 먼저 넣고 코드를 나중에 고치면 **치환 안 된
 *   문자열이 그대로 심문자에게 간다.** 아래 두 검사가 그 순서를 못박는다 — 템플릿에 마커가 있는데
 *   코드가 모르면 첫 검사가 빨개지고(치환 안 된 `{{` 가 남는다), 코드가 아는데 템플릿에 없으면
 *   위 실저장소 검사가 빨개진다. */
test('🔴 심문: 판단 정본 마커가 없는 템플릿은 거절 — 기준 없이 돈 심문이 「지적 없음」으로 보인다', () => {
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const 금지 = 심문픽스처('- 🚫 어떤 것 재제안 금지', 'MEMORY.md');
  const 철학없음 = 심문픽스처('머리말\n\n---\n{{금지목록}}\n{{대상문서}}\n', '템플릿.md');
  assert.throws(
    () => 검수.심문프롬프트(대상, 철학없음, 금지),
    /철학게이트.*마커가 없다/,
    '판단 정본 자리가 없는 템플릿이 통과했다'
  );
});

test('🔴 심문: 판단 정본을 못 뽑으면 거절 — 동결은 소급이 안 되므로 여기선 경고가 아니라 정지다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 금지 = 심문픽스처('- 🚫 어떤 것 재제안 금지', 'MEMORY.md');
  const 템플릿 = 심문픽스처('머리말\n\n---\n{{금지목록}}\n{{철학게이트}}\n{{대상문서}}\n', '템플릿.md');
  assert.throws(
    () => 검수.심문프롬프트(대상, 템플릿, 금지, path.join(os.tmpdir(), `없는-철학-${process.pid}.md`)),
    /판단 정본에서 게이트를 못 뽑았다/,
    '정본이 없는데 빈 게이트로 심문이 나갔다'
  );
});

/* 🔴 2026-08-06 실사고: 템플릿 **전문**을 보냈더니 GPT 가 머리말의 ⏸꺼짐 표식을 읽고 실행을 거부했다
 *   — 종료코드 0 · 241바이트 · 겉보기 성공. 지시문과 운영 메모가 한 파일에 살면 모델은 둘을 안 가른다. */
test('심문: 첫 --- 위(운영 메모)는 심문자에게 가지 않는다 — 머리말이 실행을 뒤집는다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 금지 = 심문픽스처('- 🚫 무엇 재제안 금지', 'MEMORY.md');
  const 템플릿 = 심문픽스처(
    '# 템플릿 (정본)\n> ⏸ **꺼짐** — 어떤 세션도 이 심문을 실행하지 않는다.\n\n---\n\n당신은 심문자다.\n{{금지목록}}\n{{철학게이트}}\n{{대상문서}}\n',
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
  const a = 검수.심문결과경로(대상, 'sol', 1, 'high');
  const b = 검수.심문결과경로(대상, 'luna', 1, 'high');
  assert.strictEqual(a.지문, b.지문, '같은 파일인데 지문이 갈렸다 — 지문은 내용에만 매여야 한다');
  assert.notStrictEqual(a.경로, b.경로, 'sol 과 luna 의 결과가 같은 파일이다 — 뒤에 돈 쪽이 앞을 덮는다');
  assert.match(a.경로, /-sol-high-1\.md$/, '경로에 모델 이름이 없다');
  assert.match(b.경로, /-luna-high-1\.md$/, '경로에 모델 이름이 없다');
});

/* ☠️ F375 (2026-08-12 실측) — 4회차는 결과 파일 3벌이 다 떨어졌는데 장부 행이 **0개**였다.
 * 장부를 완료 시에만 쓰면 부모가 죽는 순간 결과는 디스크에 남고 재현 재료(어느 문서판·어느
 * 금지목록·어느 방향/철학판)만 사라진다 — F281(회차 간 대조)·F374(낡음 기계대조)가 통째로 못 선다.
 * 탐지력은 픽스처 장부가 진다(실장부에 쓰면 이 검사가 판수를 부풀린다). */
const 임시장부 = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-심문장부-')), '심문기록.jsonl');
const 픽 = (이름 = 'luna') => ({ model: `gpt-5.6-${이름}`, effort: 'max', 이름 });
/* 금지 인덱스는 repo **밖**(홈)에 산다 — 픽스처로 준다. 환경에 기대면 CI 는 HOME 을 비워 모사하므로
 * 바로 그 자리에서 거짓 적색이 난다(이 커밋 전 test-ci 가 실제로 그렇게 빨갰다). */
const 금지픽스처 = () => 심문픽스처('머리말\n- 🚫 무엇 재제안 금지', 'MEMORY.md');

test('☠️ 심문: 던질 때 장부를 먼저 쓴다 — 부모가 죽으면 결과만 남고 재현 재료가 사라진다 (F375)', () => {
  const 장부p = 임시장부();
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  검수.심문던짐적기(대상, 픽(), 1, 3, 장부p, 금지픽스처());

  const 행 = fs.readFileSync(장부p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(행.length, 1, '던지기 전에 행이 안 생겼다 — 여기서 죽으면 회차가 통째로 없어진다');
  assert.strictEqual(행[0].상태, '던짐');
  // 재현 재료 — 하나라도 비면 그 회차는 나중에 다른 회차와 대조할 수 없다(F281).
  for (const 칸 of ['대상지문', '금지', '방향', '철학', '모델', '효력', '회차', '총회차', '결과']) {
    assert.ok(행[0][칸] !== undefined && 행[0][칸] !== '', `던짐 행에 ${칸} 이 없다 — 재현 재료가 빠졌다`);
  }
});

test('🔑 심문: 던짐 행은 「돌았다」로 안 센다 — 죽은 회차가 분모에 들어가면 「3판 돌았다」가 거짓이 된다', () => {
  const 던짐 = { 종류: '심문', 상태: '던짐', 대상지문: 'aaa', 회차: 1, 모델: 'gpt-5.6-luna' };
  const 완료 = { 종류: '심문', 상태: '완료', 대상지문: 'aaa', 회차: 1, 모델: 'gpt-5.6-luna' };
  const 옛행 = { 종류: '심문', 대상지문: 'aaa', 회차: 1, 모델: 'gpt-5.6-luna' };   // 상태 칸이 없던 시절
  assert.strictEqual(검수.완료행인가(던짐), false, '던짐을 완료로 세면 재실행이 막히고 판수가 부푼다');
  assert.strictEqual(검수.완료행인가(완료), true);
  assert.strictEqual(검수.완료행인가(옛행), true,
    '옛 행엔 상태 칸이 없다 — 「모름」으로 읽으면 지난 심문이 통째로 안 센 것이 되어 동결 분모가 깎인다');
});

test('🔑 심문: 던짐 행이 이미 있으면 두 번 안 적는다 — 이어받기가 장부를 부풀리면 안 된다', () => {
  const 장부p = 임시장부();
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const 금지 = 금지픽스처();
  검수.심문던짐적기(대상, 픽(), 1, 3, 장부p, 금지);
  검수.심문던짐적기(대상, 픽(), 1, 3, 장부p, 금지);
  assert.strictEqual(fs.readFileSync(장부p, 'utf8').trim().split('\n').length, 1);
});

test('🔑 심문: 던짐 행은 회차·모델로 갈린다 — 한 행이 편성 전체를 뜻하면 죽은 회차가 안 보인다', () => {
  const 장부p = 임시장부();
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const 금지 = 금지픽스처();
  검수.심문던짐적기(대상, 픽('luna'), 1, 3, 장부p, 금지);
  검수.심문던짐적기(대상, 픽('luna'), 2, 3, 장부p, 금지);
  검수.심문던짐적기(대상, 픽('sol'), 3, 3, 장부p, 금지);
  const 행 = fs.readFileSync(장부p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(행.length, 3);
  assert.deepStrictEqual(행.map((r) => r.결과).filter((v, i, a) => a.indexOf(v) === i).length, 3,
    '세 회차가 같은 결과 파일을 가리킨다 — 그러면 뒤가 앞을 덮는다');
});

/* ☠️ F411 (2026-08-14 실측) — 장부의 `방향·철학·금지` 는 「이 런이 어떤 조건 아래 돌았나」를 증명하려고
 *   둔 칸인데, 완료 행이 그 값을 **다시 계산**했다. 프롬프트는 던질 때 한 번만 조립되므로 그 사이
 *   정본이 바뀌면 장부에 남는 값이 실제로 쓴 것과 갈린다 — 그리고 지문이 들어 있으니 「쟀다」로 보인다.
 *   실장부 실측: 던짐↔완료 짝 9 중 **6이 갈려 있었다**(5회차 금지 1칸 · 6회차 철학+금지 2칸).
 *   최악의 모양은 6회차다 — 던짐은 철학 `afc4bbfb6bfb`(v1.7)인데 완료가 `1b4c3bdc50b1`(v1.8)이라,
 *   7회차와 대조하면 「철학 동일」로 읽힌다. **조건이 갈린 것을 안 갈린 것처럼 보이게 했다**(F281 정반대).
 *   탐지력은 픽스처가 진다 — 실장부는 아래 래칫이 「더 늘지 않는가」만 본다. */
test('☠️ 심문: 완료 행은 조건 지문을 «던짐 행에서 옮겨 적는다» — 재계산하면 갈린 조건이 감춰진다 (F411)', () => {
  const 장부p = 임시장부();
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  // 던질 때의 조건 — 프롬프트가 이 값들 아래 조립됐다.
  검수.심문던짐적기(대상, 픽(), 1, 3, 장부p, undefined, { 방향: '방향AAA', 철학: '철학v17', 금지: '금지AAA' });
  // …그 뒤 철학 정본과 금지 원천이 바뀌었다(실제로 23초 만에 일어났다).
  const 옮긴 = 검수.던짐지문읽기(장부p, 검수.심문결과경로(대상, 픽().이름, 1, 픽().effort).지문, 1, 픽().model, 픽().effort);
  assert.deepStrictEqual(옮긴, { 방향: '방향AAA', 철학: '철학v17', 금지: '금지AAA' },
    '완료 행이 «지금» 값을 쓰면 6회차처럼 v1.7 로 돈 런이 v1.8 로 돈 것처럼 남는다');
});

test('☠️ 심문: 던짐 행이 없으면 조건 지문을 «지어내지 않고» null 을 박는다 (F411)', () => {
  const 장부p = 임시장부();
  const 없는것 = 검수.던짐지문읽기(장부p, '없는지문aaaa', 1, 'gpt-5.6-luna', 'high');
  assert.deepStrictEqual(없는것, { 방향: null, 철학: null, 금지: null },
    '그럴듯한 해시를 채우면 「쟀는데 틀린 값」이라 안 보인다 — null 이라야 「안 쟀다」가 보인다');
});

test('🔑 심문: 던짐 행도 넘겨받은 얼린 지문을 쓴다 — 회차 3개를 적는 사이에도 갈릴 수 있다 (F411)', () => {
  const 장부p = 임시장부();
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const 얼린 = { 방향: '방향AAA', 철학: '철학AAA', 금지: '금지AAA' };
  for (let i = 1; i <= 3; i++) 검수.심문던짐적기(대상, 픽(), i, 3, 장부p, undefined, 얼린);
  const 행 = fs.readFileSync(장부p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(행.length, 3);
  for (const r of 행) {
    assert.deepStrictEqual({ 방향: r.방향, 철학: r.철학, 금지: r.금지 }, 얼린,
      '한 편성 안에서 회차마다 조건이 갈리면 그 편성은 「같은 심문 3회」가 아니다');
  }
});

/* 래칫 — 위 6건은 **고칠 수 없는 유물**이다(append-only 장부라 행을 고치면 그게 위조다 · CLAUDE.md).
 * 그래서 지우는 대신 «더 늘지 않는가»만 본다. 고친 뒤 도는 런은 짝이 맞아야 하므로 이 수는 6에서 멈춘다.
 * 🔑 대가: 이 검사는 옛 6건을 영원히 초록으로 통과시킨다 — 그 6건이 갈렸다는 사실은 위 주석과
 *   장부 자신이 지고, 검사는 «신규»만 막는다. 닫을 조건 = 저 6짝이 인용되지 않게 되는 날 상한을 0 으로. */
test('☠️ 심문 장부 래칫: 던짐↔완료 조건 지문이 갈린 짝이 6(F411 이전 유물)보다 늘지 않는다', () => {
  const 장부 = 검수.심문경로;
  if (!fs.existsSync(장부)) { console.log('  ↩ skip — 실장부 없음(분모 0)'); return; }
  const 행 = fs.readFileSync(장부, 'utf8').trim().split(/\r?\n/)
    .filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.종류 === '심문');
  const 키 = (r) => [r.대상지문, r.회차, r.모델].join('|');
  const 던짐 = new Map();
  for (const r of 행) if (r.상태 === '던짐') 던짐.set(키(r), r);
  const 갈림 = [];
  for (const r of 행) {
    if (r.상태 !== '완료') continue;
    const d = 던짐.get(키(r));
    if (!d) continue;                      // 짝이 없으면 대조 자체가 불가 — 여기서 판정하지 않는다
    if (['방향', '철학', '금지'].some((k) => d[k] !== r[k])) 갈림.push(키(r));
  }
  // 분모를 함께 낸다(F207) — 짝이 0이면 「갈림 0」은 통과가 아니라 미실행이다.
  const 짝수 = 행.filter((r) => r.상태 === '완료' && 던짐.has(키(r))).length;
  console.log(`  · 던짐↔완료 짝 ${짝수} · 갈린 짝 ${갈림.length}`);
  assert.ok(갈림.length <= 6,
    `조건 지문이 갈린 짝이 ${갈림.length}건으로 늘었다(유물 6) — F411 이 되살아났다: ${갈림.slice(6).join(', ')}`);
});

/* 🔴 2026-08-09: 같은 함정이 한 칸 안쪽에서 다시 열렸다 — 유호님 확정으로 심문이 **같은 모델 2회**가
 *   되면서, 모델 이름만으로는 두 회차가 같은 파일을 가리킨다. 덮이면 「2회 돌았다」는 기록만 남고
 *   재료는 1벌이 된다(합쳐 읽을 게 없어 2회차가 통째로 증발). 회차도 이름에 들어가야 한다. */
test('심문: 결과 경로가 회차로도 갈린다 — 같은 모델 2회가 서로를 덮으면 안 된다', () => {
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const 첫회 = 검수.심문결과경로(대상, 'luna', 1, 'high');
  const 둘째회 = 검수.심문결과경로(대상, 'luna', 2, 'high');
  assert.notStrictEqual(첫회.경로, 둘째회.경로, '같은 모델 2회가 같은 파일이다 — 2회차가 1회차를 덮는다');
  assert.match(둘째회.경로, /-luna-high-2\.md$/);
  // 회차가 정수가 아니면 경로를 안 만든다 — `-undefined.md` 같은 이름은 다음 런과 또 부딪힌다
  for (const 나쁨 of [0, -1, 1.5, '2', null]) {
    assert.throws(() => 검수.심문결과경로(대상, 'luna', 나쁨, 'high'), /회차가 정수가 아니다/, `회차 ${나쁨} 이 안 막혔다`);
  }
});

/* 🔴 2026-08-29 실측 — 유호님이 심문을 high → xhigh 로 올린 **그 자리에서** 났다: 편성 줄은
 *   「1회 luna/xhigh」로 찍혔는데 codex 호출이 0회였고, high 로 돈 `…-luna-1.md` 를 그대로
 *   결과로 냈다. 위 08-07(모델) 구멍과 **같은 병의 효력 판**이다 — 조건이 이름에 없으면
 *   이어받기는 조건이 바뀐 것을 원리상 못 보고, 새는 방향은 언제나 「이미 돌았다」= 통과 쪽이다. */
test('심문: 결과 경로가 «효력»으로도 갈린다 — 깊이를 올렸는데 옛 결과를 이어받으면 안 된다', () => {
  const 대상 = 심문픽스처('# 계약 초안\n필드 A');
  const h = 검수.심문결과경로(대상, 'luna', 1, 'high');
  const x = 검수.심문결과경로(대상, 'luna', 1, 'xhigh');
  assert.strictEqual(h.지문, x.지문, '지문은 내용에만 매여야 한다 — 효력이 지문을 흔들면 안 된다');
  assert.notStrictEqual(h.경로, x.경로,
    'high 와 xhigh 의 결과가 같은 파일이다 — 깊이를 올려도 옛 결과를 이어받는다(08-29 실측)');
  assert.match(x.경로, /-luna-xhigh-1\.md$/, '경로에 효력이 없다');
  // 효력을 안 주면 **접지 않고 거절한다** — 조용히 기본값을 쓰면 그 순간 다시 두 깊이가 한 파일이 된다
  assert.throws(() => 검수.심문결과경로(대상, 'luna', 1), /효력이 없다/, '효력 없이도 경로가 나온다');
});

/* 이어받기 판정도 같은 잣대를 써야 한다 — 경로만 갈라 두고 장부 키가 효력을 안 보면,
 * 「결과 파일은 없는데 장부는 이미 돌았다고 말하는」 어긋난 상태가 된다. */
test('심문: 장부 이어받기 키도 효력을 본다 — 효력 없는 옛 행은 안 맞힌다(모르면 다시 돈다)', () => {
  const 같음 = 검수.심문행키({ 대상지문: 'aaaa', 회차: 1, 모델: 'gpt-5.6-luna', 효력: 'high' }, 'aaaa', 1, 'gpt-5.6-luna', 'high');
  const 다름 = 검수.심문행키({ 대상지문: 'aaaa', 회차: 1, 모델: 'gpt-5.6-luna', 효력: 'high' }, 'aaaa', 1, 'gpt-5.6-luna', 'xhigh');
  assert.strictEqual(같음, true, '같은 조건 행을 못 맞히면 이어받기가 통째로 죽는다');
  assert.strictEqual(다름, false, 'high 행이 xhigh 요청에 맞았다 — 그게 08-29 에 새던 자리다');
  const 효력없는옛행 = 검수.심문행키({ 대상지문: 'aaaa', 회차: 1, 모델: 'gpt-5.6-luna' }, 'aaaa', 1, 'gpt-5.6-luna', 'high');
  assert.strictEqual(효력없는옛행, false, '깊이를 모르는 옛 행을 맞히면 「이미 돌았다」로 접힌다 — 모르면 다시 돈다');
});

test('심문: 대상이 한 바이트 바뀌면 결과 경로도 바뀐다 — 옛 심문이 새 문서의 것으로 읽히면 안 된다', () => {
  const 대상 = 심문픽스처('# 계약 초안');
  const 전 = 검수.심문결과경로(대상, 'sol', 1, 'high').경로;
  fs.appendFileSync(대상, '.');
  assert.notStrictEqual(전, 검수.심문결과경로(대상, 'sol', 1, 'high').경로, '내용이 바뀌었는데 같은 파일에 덮어쓴다');
});

/* 2026-08-09 유호님 확정: 판단 패스는 2회 돌고 **코드가** 합친다. 합치는 규칙이 틀리면 실패가
 * 조용하다 — 지적이 사라져도 「검수 통과」로 보인다. 그래서 병합만 따로 못박는다.
 * 🔑 급소는 「나쁜 쪽이 이긴다」다: 한 회차가 「깨짐」, 다른 회차가 「정상」이면 **깨진 것**이다.
 *   다수결이나 마지막 값으로 접으면, 2회를 돌린 것이 오히려 1회보다 관대해진다. */
test('기능체크 병합: 한 회차라도 깨짐이면 깨짐이 이긴다 (2회가 1회보다 관대해지면 안 된다)', () => {
  const 합 = 검수.기능체크병합([
    { 체크: [{ 기능: 'A', 판정: '정상' }, { 기능: 'B', 판정: '의심', 근거: 'b1' }], 학습데이터: [{ 기능: 'A' }] },
    { 체크: [{ 기능: 'A', 판정: '깨짐', 근거: 'a2' }, { 기능: 'B', 판정: '정상' }, { 기능: 'C', 판정: '정상' }], 학습데이터: [{ 기능: 'A' }, { 기능: 'C' }] },
  ]);
  const 표 = new Map(합.체크.map((c) => [c.기능, c.판정]));
  assert.strictEqual(표.get('A'), '깨짐', '2회차의 깨짐이 1회차의 정상에 눌렸다 — 게이트가 막을 것을 통과시킨다');
  assert.strictEqual(표.get('B'), '의심', '1회차의 의심이 2회차의 정상에 눌렸다');
  assert.strictEqual(표.get('C'), '정상', '한 회차에만 나온 기능이 사라졌다');
  assert.strictEqual(합.학습데이터.length, 2, '학습데이터가 회차만큼 중복됐다');
  // 지적으로 변환됐을 때도 같은 판정이어야 한다 — 게이트가 보는 건 이쪽이다
  assert.ok(검수.기능체크지적들(합.체크).some((f) => f.등급 === 'P1' && /기능 깨짐: A/.test(f.제목)));
});

/* 지적 합집합 — 2회를 도는 **이유 자체**다. 겹치는 지적은 한 건, 한쪽에만 있는 건 살아남아야 한다.
 * 원문을 회차별로 다 남기는 것도 회귀로 건다: 1벌만 남기면 「2회차가 무엇을 더 봤나」를 사후에
 * 물을 재료가 사라지고, 그러면 회차 자체가 값했는지 영원히 못 잰다. */
test('회차 병합: 지적은 합집합 · 회차별 건수와 원문이 둘 다 남는다', () => {
  const 지적 = (파일, 제목) => ({ 등급: 'P2', 파일, 라인: 1, 제목, 근거: '', 수정방향: '' });
  const 합 = 검수.회차병합([
    { 요약: '1차', 지적: [지적('a.js', '같은 결함'), 지적('b.js', '1회만')], 원문: '원문1' },
    { 요약: '2차', 지적: [지적('a.js', '같은  결함 '), 지적('c.js', '2회만')], 원문: '원문2' },
  ]);
  assert.deepStrictEqual(합.지적.map((f) => f.제목), ['같은 결함', '1회만', '2회만'],
    '겹친 지적이 두 번 세졌거나, 한쪽에만 있던 지적이 사라졌다');
  /* 🔑 `지적수` 만으로는 「2회가 값했나」에 답이 안 된다 — 두 회차가 각 2건인데 통째로 겹치면
   *   합집합도 2 이고 2회차는 한 건도 안 보탠 것인데, 건수만 보면 「2 · 2」라 값한 것처럼 읽힌다.
   *   그래서 `단독`(그 회차에만 있던 지적)과 그 **등급 분포**까지 함께 못박는다 — 단독 3건이
   *   P3 셋인 것과 P0 셋인 것은 완전히 다른 판정이다(회차병합 주석 · 2026-08-12 f2832ca5).
   *   이 픽스처에서 겹치는 건 a.js 「같은 결함」 하나뿐이므로 각 회차의 단독은 정확히 1건이다. */
  assert.deepStrictEqual(합.회차별, [
    { 회차: 1, 지적수: 2, 단독: 1, 단독등급: { P2: 1 } },
    { 회차: 2, 지적수: 2, 단독: 1, 단독등급: { P2: 1 } },
  ], '분모가 없으면 「2회가 값했나」를 못 읽는다');
  for (const s of ['원문1', '원문2']) assert.ok(합.원문.includes(s), `${s} 이 병합에서 사라졌다`);
  assert.ok(합.요약.includes('1차') && 합.요약.includes('2차'));

  /* 🔑 합의 스탬프(2026-08-29) — 같은 바이트를 회차 둘이 독립으로 보므로 「몇 회차가 이 결함을
   *   봤나」가 곧 공짜 재현성 측정이다. 원장 9일치 실측에서 처분된 P1 의 47%(9/19)가 기각이었는데
   *   처분자가 쓸 재현성 신호가 지적에 없었다.
   * ⚠ 이건 **신호지 게이트가 아니다** — 등급을 자동으로 깎으면 08-12 실측(sol 단독 3건이 전부 P0 ·
   *   둘은 코드로 사실 확인)이 그대로 묻힌다. 그래서 등급 불변까지 함께 못박는다. */
  assert.deepStrictEqual(합.지적.map((f) => f.합의), ['2/2', '1/2', '1/2'],
    '합의가 안 실리면 처분자가 「둘 다 본 것」과 「하나만 본 것」을 못 가른다');
  assert.deepStrictEqual(합.지적.map((f) => f.등급), ['P2', 'P2', 'P2'],
    '합의는 등급을 건드리면 안 된다 — 단독도 진짜일 수 있다(08-12 실측)');
});

/* 회차가 하나뿐이면 합의를 **지어내지 않는다**. 「1/1」은 「둘 다 봤다」와 글자 수가 같아 읽는 쪽이
 * 헷갈리고, 무엇보다 1회 런에는 대조할 상대가 없다 — 없는 측정을 있는 것처럼 적으면 그게 거짓 초록이다. */
test('회차 병합: 1회뿐이면 합의를 안 박는다 (측정하지 않은 것을 적지 않는다)', () => {
  const 하나 = { 요약: '1차', 지적: [{ 등급: 'P1', 파일: 'a.js', 라인: 1, 제목: '혼자', 근거: '', 수정방향: '' }], 원문: 'x' };
  const 합 = 검수.회차병합([하나]);
  assert.strictEqual(합.지적[0].합의, undefined, '1회 런에는 대조 상대가 없다 — 합의를 지어내면 안 된다');
});

test('기능체크 병합: 1회차뿐이면 그대로 돌려준다 (없는 회차를 지어내지 않는다)', () => {
  const 하나 = { 체크: [{ 기능: 'A', 판정: '정상' }], 학습데이터: [] };
  assert.strictEqual(검수.기능체크병합([하나]), 하나);
  assert.strictEqual(검수.기능체크병합([]), null);
});

test('심문: 모델 이름 없이는 경로를 안 만든다 — 이름 없는 결과는 남의 것을 덮는다', () => {
  assert.throws(() => 검수.심문결과경로(심문픽스처('# 계약'), '', 1, 'high'), /모델 이름이 없다/);
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

/* ─────────────────────────────────────────────────────────────────────────
 * F314 — 과녁 없이 부른 검수가 30분+ 타는데 끝나도 배포 게이트를 못 채운다 (2026-08-10 실측)
 *
 * 무엇을 지키나: **태우기 전에** 판정한다. 이 자리가 새는 방향은 「통과」가 아니라 「낭비」인데,
 *   그 낭비의 끝이 정확히 F103 이다 — 유호님이 22분째 도는 것을 보고 세션째 지웠고, 그러고도
 *   게이트는 그대로였다. 도구는 이 함정을 **주석과 알림문으로만** 알고 있었다(게이트판정 :709~).
 *
 * 탐지력은 픽스처가 진다 — 실저장소 작업본은 그때그때 배포 파일이 섞여 있어(08-10 실측: 남의
 *   미커밋 `엔진_콘텐츠AI.js` 1건 때문에 범위가 (루트)로 잡혔다) 정지 경로를 한 번도 안 밟을 수
 *   있고, 그러면 검사가 죽어도 초록이다.
 * ───────────────────────────────────────────────────────────────────────── */

const 대상픽스처 = (n = 31) => ({ 종류: 'uncommitted', 값: '(미커밋)', 파일들: Array.from({ length: n }, (_, i) => `docs/남의문서${i}.md`) });

test('☠️ 배포 파일 0건이면 **돌리기 전에** 멈춘다 — 태워도 게이트가 안 열리는 대상이다 (F314)', () => {
  const 정지 = 검수.범위밖정지(대상픽스처(), []);
  assert.ok(정지, '범위 0건인데 통과시켰다 — 5~30분을 태우고도 게이트는 그대로다');
  const 문 = 정지.join('\n');
  assert.match(문, /확인 불가/, '「안 돌았다」가 아니면 미실행이 통과와 같은 모양이 된다');
  // 굵게 표기(`**`)는 재지 않는다 — 강조 위치가 바뀌면 멀쩡한 문구가 빨개진다(F287).
  assert.match(문, /배포 파일이 0건/, '왜 멈췄는지가 없다');
});

test('🔑 범위 안이면 멈추지 않는다 — 정지가 정상 검수를 먹으면 그게 새 F103 이다', () => {
  assert.strictEqual(검수.범위밖정지(대상픽스처(), ['(루트)']), null, '배포 파일이 있는데 막았다');
});

test('🔑 정지문의 처방이 **실행 가능한 명령**이다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다 (F103)', () => {
  const 문 = (검수.범위밖정지(대상픽스처(), []) || []).join('\n');
  // 처방으로 나가는 모든 `node tools/codex-review.js …` 줄의 플래그를 도구가 실제로 아는지 본다.
  const 명령들 = 문.split('\n').filter((l) => l.includes('codex-review.js'));
  assert.ok(명령들.length, '처방 명령이 한 줄도 없다 — 「하지 마라」만 있고 「이렇게 하라」가 없다');
  for (const 줄 of 명령들) {
    for (const 낱말 of 줄.split(/\s+/)) {
      if (낱말.startsWith('--')) {
        assert.ok(검수.아는플래그.has(낱말), `처방이 모르는 플래그 "${낱말}" 를 시킨다 — 그대로 치면 F135 거절로 되돌아온다`);
      }
    }
  }
});

/* ☠️ F335 가 **정지문에도** 걸린다 — 게이트 알림문과 정지문이 같은 축으로 갈리는데 판정을 두 곳에
 * 적으면 한쪽만 고쳐지고, 안 고쳐진 쪽이 그대로 새는 쪽이 된다(가드 맹점 ④ · 이 파일이 F293 으로
 * 이미 밟았다). 그래서 두 자리가 `과녁판정` 한 벌을 쓰는지를 **출력으로** 잰다. */
test('☠️ 정지문도 배포 파일이 미커밋이면 과녁을 뗀다 — 판정을 두 곳에 적으면 한쪽만 고쳐진다 (F335)', () => {
  const 문 = (검수.범위밖정지(대상픽스처(), [], ROOT, ['Code.js']) || []).join('\n');
  assert.doesNotMatch(문, /--commit\s/, '더러운 작업본에 과녁을 처방했다 — 따라도 지문이 안 적힌다');
  assert.match(문, /F335/, '왜 과녁을 뺐는지 근거가 없으면 다음 사람이 되돌린다');
  assert.doesNotMatch(문, /과녁을 대고 다시 부른다/,
    '머리말이 아래 처방과 반대말을 한다 — 읽는 쪽이 명령을 고쳐 과녁을 다시 단다');
});

test('🔑 정지문은 작업본이 깨끗하면 과녁을 그대로 댄다 — F335 수리가 F292 를 되돌리면 안 된다', () => {
  const 문 = (검수.범위밖정지(대상픽스처(), [], ROOT, []) || []).join('\n');
  assert.match(문, /codex-review\.js\s+--commit\s+[0-9a-f]{7,}/,
    '깨끗한데 과녁을 뗐다 — 인자 없는 호출은 배포 파일 0건이라 「범위 밖」으로 기록된다(F292)');
});

test('🔑 탈출구가 실재한다 — 배포와 무관한 검수(도구·훅·테스트)를 영구히 막으면 안 된다 (F103)', () => {
  const 문 = (검수.범위밖정지(대상픽스처(), []) || []).join('\n');
  assert.ok(문.includes(검수.범위밖탈출), '탈출구를 안 알려준다 — 도구 코드 검수가 원리상 불가능해진다');
  assert.ok(검수.아는플래그.has(검수.범위밖탈출), '탈출구 플래그가 화이트리스트 밖이다 — 붙이면 F135 로 거절된다(처방이 자기를 막는다)');
});

test('🔑 과녁을 못 뽑아도 **그 사실을 말한다** — 빈 처방이 「방법 없음」으로 읽히면 안 된다', () => {
  const 없는루트 = path.join(os.tmpdir(), 'synk-없는루트-f314');
  const 문 = (검수.범위밖정지(대상픽스처(), [], 없는루트) || []).join('\n');
  assert.match(문, /--commit/, '과녁을 못 뽑았는데 대안 명령도 안 준다');
});

/* ── F308: git 출력 상한 ── 3.2MB 미커밋에서 `spawnSync git ENOBUFS` 로 죽었고, 그 죽음이
 *   파이프 뒤에서 「통과」와 같은 모양이 됐다. 세션 10개가 도는 시간대엔 상시 조건이다. */
test('☠️ git 호출이 maxBuffer 를 **명시**한다 — 기본 1MB 는 이 저장소 상시 조건에서 넘는다 (F308)', () => {
  assert.ok(검수.git버퍼 > 1024 * 1024, `버퍼가 ${검수.git버퍼} — 기본값(1MB) 이하면 남의 바이너리 미커밋 하나에 검수가 통째로 죽는다`);
  const 소스 = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  assert.match(소스, /execFileSync\('git',[\s\S]{0,300}maxBuffer/, 'git 호출에 maxBuffer 가 안 붙었다 — 상수만 있고 안 쓰면 아무것도 안 지킨다');
});

test('🔑 버퍼 초과는 `code` 와 문구 **둘 다**로 알아본다 — 하나만 보면 못 알아본 초과가 사유 없이 터진다', () => {
  assert.ok(검수.버퍼초과({ code: 'ENOBUFS' }), 'code 를 못 알아본다');
  assert.ok(검수.버퍼초과(new Error('spawnSync git.exe maxBuffer length exceeded')), '문구를 못 알아본다(플랫폼에 따라 code 가 안 붙는다)');
  assert.ok(!검수.버퍼초과(new Error('fatal: bad revision')), '멀쩡한 git 오류를 버퍼 초과로 삼켰다 — 진짜 원인이 사라진다');
  assert.ok(!검수.버퍼초과(null), 'null 에서 터진다');
});

test('실저장소: 지금 작업본에서 정지 판정이 터지지 않는다 (거짓양성 검사 — 탐지력은 위 픽스처가 진다)', () => {
  const 대상 = 검수.대상결정([]);
  assert.doesNotThrow(() => 검수.범위밖정지(대상, 검수.범위(대상.파일들)), '실저장소에서 정지 판정이 예외를 낸다');
});

/* ── F333: 진행 표식 ── ③최종검수가 「헤더만 찍고 기록 0」으로 4수 죽었고, 그 모양이 도구 결함으로
 *   읽혔다. 실제 원인은 산술이다 — 정상 완주 20~40분 vs 호출자 포그라운드 셸 상한 10분.
 *   밖에서 죽으면 catch 도 종료코드도 없으니, **남는 표식**만이 죽음의 유일한 증거다. */
const 진행픽스처 = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-진행-')), 'inflight.json');

test('🔑 표식은 시작에 생기고 정상 종료에 지워진다 — 남아 있는 것 자체가 죽음의 증거다 (F333)', () => {
  const p = 진행픽스처();
  const 옛 = process.env.SYNK_REVIEW_INFLIGHT;
  process.env.SYNK_REVIEW_INFLIGHT = p;
  try {
    assert.equal(검수.낡은진행(), null, '표식이 없는데 뭔가를 읽었다 — 거짓 경고는 사람이 경고를 무시하게 만든다');
    검수.진행시작({ 대상: { 종류: 'commit', 값: 'deadbeef' }, 회차: 2, 인자: ['--commit', 'deadbeef'] });
    const 읽음 = 검수.낡은진행();
    assert.ok(읽음 && 읽음.시작, '표식을 남겼는데 못 읽는다 — 그러면 죽음이 영영 침묵이다');
    assert.equal(읽음.대상.값, 'deadbeef', '무엇을 검수하다 죽었는지가 안 남으면 다음 사람이 대상을 다시 추측한다');
    assert.ok(읽음.pid, 'pid 가 없으면 「아직 도는 중」과 「죽었다」를 못 가른다');
    검수.진행종료();
    assert.equal(검수.낡은진행(), null, '완주했는데 표식이 남는다 — 거짓 경고가 상시로 뜬다');
  } finally {
    if (옛 === undefined) delete process.env.SYNK_REVIEW_INFLIGHT; else process.env.SYNK_REVIEW_INFLIGHT = 옛;
  }
});

/* ☠️ 첫 판이 표식을 `handoff-store.stateDir()` 에 뒀다가 **남의 청소에 즉시 지워졌다**(08-11 실측):
 *   sweep 규칙이 `!j.at` 이면 나이와 무관하게 unlink 라, `at` 없는 내 표식은 세션이 여럿 도는
 *   시간대에 몇 초 만에 사라진다. 증상은 「표식 없음」 = 「완주함」 — 증거 장치가 반대로 샜다. */
test('☠️ 표식은 남이 청소하는 폴더에 두지 않는다 — 거기 두면 증거가 조용히 사라진다 (F333 재발 경로)', () => {
  const 옛 = process.env.SYNK_REVIEW_INFLIGHT;
  delete process.env.SYNK_REVIEW_INFLIGHT;   // 기본 경로를 봐야 한다(env 를 두면 검사가 공허해진다)
  try {
    const store = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
    const 표식 = 검수.진행파일();
    const 청소구역 = path.resolve(store.stateDir());
    assert.notEqual(path.resolve(path.dirname(표식)), 청소구역,
      `표식이 handoff-store 청소 구역 안이다(${표식}) — sweep 이 \`at\` 없는 파일을 즉시 지운다`);
    // 이름 규칙은 그 모듈에서 파생돼야 한다 — 규칙을 손으로 베끼면 세션 구분이 갈라진다.
    /* 세션 키도 **그 도구가 쓰는 통로**에서 파생시킨다 — 도구는 `board-id.세션id()` 로 뽑는데(F634)
     * 여기서 `process.env` 를 직접 읽으면 클라우드에서 둘이 갈려 「이름을 안 쓴다」로 빨개진다. */
    const 보드id = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'board-id.js'));
    assert.ok(표식.includes(store.safeId(보드id.세션id() || '')),
      '표식 이름이 세션 키를 안 쓴다 — 남의 실행을 내 것으로 읽는다');
  } finally {
    if (옛 !== undefined) process.env.SYNK_REVIEW_INFLIGHT = 옛;
  }
});

test('🔑 경고가 **그대로 실행 가능한** 처방을 준다 — 「늘려라」는 이 자리에선 따를 수 없다 (F103·F333)', () => {
  const 문 = 검수.진행경고줄({ 시각: 'x', 시작: '2026-08-11T11:00:00Z', pid: 42, 대상: { 종류: 'commit', 값: 'abc1234' } },
    ['--commit', 'abc1234']).join('\n');
  assert.match(문, /통과가 아니다/, '완주 못 한 실행을 「통과가 아니다」라고 말하지 않는다 — 그게 이 도구의 불변식이다');
  assert.match(문, /node tools\/codex-review\.js --commit abc1234/, '받은 인자 그대로 다시 돌릴 명령을 안 준다 — 사람이 인자를 다시 조립하게 된다');
  assert.match(문, /2>&1/, '로그를 파일로 받는 형태가 아니다 — 파이프를 끼우면 종료코드가 사라진다(F308)');
  assert.ok(!/--timeout/.test(문), '`--timeout` 을 늘리라고 처방한다 — 도구가 더 버틸 뿐 호출자 상한은 그대로다(따를 수 없는 처방 = 우회가 정상 통로가 된다)');
});

test('☠️ 소요 안내는 **어느 조합에서도** 뜬다 — 가장 빠른 조합도 포그라운드 기본 2분을 넘는다 (F333)', () => {
  const 조합들 = [[[], 2], [['--버그만'], 1], [['--버그만'], 2], [[], 1], [['--commit', 'abc'], 3]];
  for (const [argv, 회차] of 조합들) {
    const 문 = 검수.소요안내(argv, 회차);
    assert.match(문, /포그라운드 셸에서는 죽는다/, `조합 ${JSON.stringify(argv)}/${회차}회 에서 경고가 빠졌다 — 빠진 자리가 다음 F333 이 된다`);
    const 하한 = Number((문.match(/정상 완주 (\d+)~/) || [])[1]);
    assert.ok(하한 >= 5, `예상 하한이 ${하한}분 — 실측(패스당 5~8분)보다 낮게 말하면 호출자가 포그라운드를 고른다`);
  }
  // 회차·패스가 늘면 예상도 늘어야 한다 — 고정 문구면 「2회나 3회나 같다」로 읽힌다.
  assert.notEqual(검수.소요안내([], 1), 검수.소요안내([], 2), '회차를 올려도 같은 시간을 말한다 — 곱을 사람이 암산하게 두는 자리다');
  assert.notEqual(검수.소요안내([], 2), 검수.소요안내(['--버그만'], 2), '`--버그만` 으로 패스가 절반인데 같은 시간을 말한다');
});

/* 등록층 — 이 저장소가 가장 여러 번 데인 자리다(CLAUDE.md 맹점 ③: 라우팅은 훅보다 넓어야 한다).
 * 표식 로직이 아무리 옳아도 **긴 경로 하나가 안 걸려 있으면** 그 문이 다음 F333 이 된다. */
test('☠️ 등록층 — 긴 codex 경로 **셋 전부**가 진행걸기를 탄다 (한 문만 빠져도 그 문이 다음 F333 이다)', () => {
  const 소스 = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  assert.match(소스, /function 진행걸기[\s\S]{0,600}process\.on\('exit', 진행종료\)/,
    '진행걸기가 exit 리스너를 안 건다 — 표식이 영영 안 지워져 거짓 경고가 상시가 된다');
  for (const 단계 of ['③최종검수', '①선파악', '②심문']) {
    assert.ok(new RegExp(`진행걸기\\(argv, \\{ 단계: '${단계}'`).test(소스),
      `${단계} 가 진행걸기를 안 탄다 — 그 문으로 들어가 죽으면 여전히 침묵이다`);
  }
  /* 호출부가 표식을 **직접** 걸면 통로가 둘로 갈린다(같은 판정을 두 곳에 적으면 갈라진다).
   * 정당한 호출은 진행걸기 안의 **한 번**뿐 — 그 하나가 어디 있는지까지 못박는다. */
  const 호출들 = (소스.match(/^[ \t]*진행시작\(/gm) || []).length;
  assert.equal(호출들, 1, `진행시작 호출부가 ${호출들}곳 — 진행걸기 안 한 곳이어야 한다(갈리면 한쪽만 고쳐진다)`);
  const 걸기본문 = (소스.match(/function 진행걸기[\s\S]*?\n\}/) || [''])[0];
  assert.match(걸기본문, /진행시작\(정보\)/, '그 하나가 진행걸기 안이 아니다 — 공용 통로가 표식을 안 건다');
});

/* 이 판별자(정상 종료엔 리스너가 돌고, 밖에서 죽으면 안 돈다)가 무너지면 위 장치가 통째로 무의미해진다.
 * 그래서 node 의 semantics 자체를 픽스처로 못박는다 — 우리 코드가 아니라 **기대는 전제**를 검사한다. */
test('☠️ 정상 종료엔 리스너가 돌고, 밖에서 죽이면 안 돈다 — 전제가 깨지면 F333 이 그대로 돌아온다', async (t) => {
  const { spawn } = require('node:child_process');
  const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
  const 생길때까지 = async (p) => {
    for (let i = 0; i < 100; i++) { if (fs.existsSync(p)) return true; await 잠깐(50); }
    return false;
  };
  const 스크립트 = (p) => `const fs=require('fs');const p=${JSON.stringify(p)};` +
    `process.on('exit',()=>{try{fs.unlinkSync(p)}catch(_){}});fs.writeFileSync(p,'{}');`;

  // ① 정상 종료 — 리스너가 돌아 표식이 지워진다
  const a = 진행픽스처();
  await new Promise((res) => spawn(process.execPath, ['-e', 스크립트(a)], { stdio: 'ignore' }).on('close', res));
  assert.ok(!fs.existsSync(a), '정상 종료인데 표식이 남았다 — 완주한 실행이 매번 거짓 경고를 낸다');

  // ② 밖에서 죽임 — 리스너가 안 돌아 표식이 남는다
  const b = 진행픽스처();
  const child = spawn(process.execPath, ['-e', 스크립트(b) + 'setInterval(()=>{},1000);'], { stdio: 'ignore' });
  if (!(await 생길때까지(b))) { child.kill(); t.skip('자식이 표식을 못 남겼다 — 탐지력이 아니라 환경 문제라 skip 으로 드러낸다'); return; }
  child.kill();
  await new Promise((res) => child.on('close', res));
  assert.ok(fs.existsSync(b), '밖에서 죽였는데 표식이 지워졌다 — 조용한 죽음을 볼 방법이 사라진다(F333 재발)');
});

/* ───────────────────────── 자식 창 숨김 — 호출부 전량이 통로를 지나는가 (F361)
 *
 * 왜 「전량」인가: 창이 뜨는 조건은 부모에게 콘솔이 없는 것이고, 던지기가 `detached` 로 뜨는 순간
 * 그 아래 사슬 전체가 그 상태가 된다. 그래서 한 자리만 빠져도 유호님 화면에는 그대로 검은 창이
 * 뜨고, stdio 가 파이프·파일 fd 라 **한 글자도 안 찍힌다** — 증상은 「도구가 멈춘 것 같다」뿐이다.
 * 탐지력은 픽스처가 지고(실저장소는 지금 마침 통과라 거짓양성만 검사한다), 분모를 함께 읽는다. */
const 창검사 = 검수.창숨김누락;

test('🔑 codex-review.js 의 자식 호출부 **전량**이 창숨김 통로를 지난다 — 한 자리만 빠져도 창이 뜬다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const 빠진줄 = 창검사(src);
  assert.notStrictEqual(빠진줄, null, '자식 호출부를 하나도 못 찾았다 — 검사가 0건을 돌고 초록을 냈다(분모 없는 초록 · F207)');
  assert.deepStrictEqual(빠진줄, [], `창숨김 통로를 안 지나는 자식 호출부: ${빠진줄 && 빠진줄.join(', ')} 줄 — 그 자리가 유호님 화면에 검은 창을 띄운다`);
});

test('🔑 탐지력(픽스처) — 통로를 안 지나는 호출부를 잡는다. 실저장소가 통과라고 검사가 산 것은 아니다', () => {
  const 가짜 = [
    'const x = 1;',
    "execFileSync('git', args, 자식옵션({ cwd: ROOT }));",
    "spawn(node, [f], { cwd: ROOT, stdio: 'ignore' });",
  ].join('\n');
  assert.deepStrictEqual(창검사(가짜), [3], '통로를 뺀 호출부를 못 잡았다 — 이 검사는 아무것도 지키지 못한다');
});

test('🔑 호출부가 0이면 null — 「검사할 게 없었다」가 「전부 통과」와 같은 모양이면 안 된다', () => {
  assert.strictEqual(창검사('const a = 1;\nconst b = a + 2;'), null);
  assert.strictEqual(창검사(''), null);
  assert.strictEqual(창검사(null), null, '함수가 사라져 undefined 를 받아도 빈 문자열을 검사하고 초록을 보면 안 된다');
});

test('🔑 문자열 안의 괄호가 슬라이스를 어긋내지 않는다 — 어긋난 슬라이스는 「지났다」로도 읽힌다', () => {
  const 가짜 = "spawn(bin, ['-c', 'f(x)'], { cwd: ROOT });\nexecFileSync('git', a, 자식옵션({}));";
  assert.deepStrictEqual(창검사(가짜), [1], "문자열 속 ')' 하나에 검사가 어긋났다");
});

test('🔑 통로가 창을 숨기고, 호출자가 준 옵션은 살린다 — 덮어쓰면 detached·env 가 조용히 사라진다', () => {
  const o = 검수.자식옵션({ cwd: 'X', detached: true, stdio: 'ignore' });
  assert.strictEqual(o.windowsHide, true);
  assert.strictEqual(o.cwd, 'X');
  assert.strictEqual(o.detached, true);
  assert.strictEqual(o.stdio, 'ignore');
  assert.deepStrictEqual(Object.keys(검수.자식옵션()), ['windowsHide'], '인자 없이도 창은 숨긴다');
});

/* ── F541 — 「사유가 «다른 지적»을 논하는 기각」 ────────────────────────────
 * 실측 2026-08-17: 같은 논증이 키를 하나 밀려 등록돼, 진짜 P1(rot-check.js:300)이 영구 기각되고
 * 정작 틀린 지적(loom.js:642)은 게이트에 남았다. 장부 행은 제목·파일을 «키에서» 채우므로
 * 겉보기엔 정상인 행이 된다 — 그래서 사람 눈이 아니라 기계가 져야 하는 자리다. */
const 어긋남 = (파일, 사유) => 검수.사유_파일어긋남({ 파일, 제목: 't' }, 사유);

test('☠️ F541 — 사유가 자기 파일을 한 번도 안 짚고 남의 파일만 논하면 기각을 안 받는다', () => {
  const v = 어긋남('tools/rot-check.js', 'loom.js:641 의 at 분기는 머리 자신을 안 고치는 것이다');
  assert.ok(v, '키를 밀려 친 기각이 그대로 등록됐다 — 진짜 결함이 영구히 걸러진다');
  assert.deepStrictEqual(v.남, ['loom.js'], '어느 파일을 논하는지 안 짚으면 처방이 안 선다(F103)');
});

test('🔑 자기 파일을 짚으면 통과한다 — 경로로도, 파일 이름만으로도', () => {
  assert.strictEqual(어긋남('tools/lib/loom.js', '`loom.js:598` 의 정규식은 keyframes 넷뿐이다'), null,
    '이름만 짚은 정당한 기각을 막았다 — 내가 방금 쓴 기각이 이 모양이다(자기 처방을 막지 않는다)');
  assert.strictEqual(어긋남('tools/lib/loom.js', 'tools/lib/loom.js 를 태워 반증했다'), null);
  /* ⚠ 이름 갈래는 «남의 파일이 함께 있을 때»만 갈린다 — 그게 없으면 경로 갈래만으로도 초록이라
   *   검사가 통과하는 척한다(변이가 드러냈다: 이 줄이 없으면 탐지를 실저장소가 지게 된다 · F296). */
  assert.strictEqual(어긋남('tools/lib/loom.js', '`loom.js:598` 을 태웠다 — rot-check.js 와는 무관하다'), null,
    '자기 파일을 이름으로 짚었는데 남의 파일이 함께 있다고 막았다');
});

test('🔑 닫은 것 — 사유가 «아무 파일도» 안 짚으면 판정하지 않는다(산문 기각은 정상이다)', () => {
  assert.strictEqual(어긋남('tools/rot-check.js', '이 트랙의 과녁이 아니다 — 배포집합 밖이라 라이브에 안 나간다'), null);
});

test('🔑 파일이 아닌 지적은 대조 대상이 아니다 — 없는 것을 대조하면 그게 거짓양성이다', () => {
  assert.strictEqual(어긋남('(기능체크)', 'tools/발표물린트.js:97 가 이미 고쳐졌다'), null);
  assert.strictEqual(어긋남('(모름)', 'a.js 를 본다'), null);
  assert.strictEqual(어긋남(undefined, 'a.js 를 본다'), null, '원본을 못 찾은 기각까지 막으면 통로가 죽는다');
});

test('☠️ 실저장소 — 거짓양성만 본다(탐지력은 위 픽스처가 진다 · F296)', (t) => {
  const 줄 = fs.readFileSync(path.join(ROOT, 'docs', '_ops', '검수기각.jsonl'), 'utf8').trim().split('\n');
  const 행들 = 줄.map((l) => JSON.parse(l));
  const 발화 = 행들.filter((r) => !r.딴파일확인 && 어긋남(r.파일, r.사유));
  /* 08-17 실측 = 73 중 4(진짜 1 = F541 그 행 · 남의 파일을 «근거로» 인용한 정당한 기각 3).
   * 이 수가 늘면 문턱이 헐거워진 것이다 — 늘리지 말고 `--딴파일` 로 지나간 행을 장부가 기록한다. */
  assert.ok(발화.length <= 4, `거짓양성이 늘었다(${발화.length}건) — 정당한 기각을 막기 시작하면 우회가 정상 통로가 된다(F103)`);
  /* 🔴 2026-08-29 — 이 아래를 **조건부로** 바꿨다. 옛 판은 실저장소 원장에 F541 그 행(`2b7e4da04edb`)이
   *   있다는 데 묶여 있었는데, 08-19 대철거(e75fc7fc)가 `검수기각.jsonl` 을 통째로 걷어 지금 원장은
   *   08-20 부터 새로 쌓인 것이다 — 그 행은 이제 원리상 없다. 그대로 두면 이 검사는 **코드가 성해도
   *   영영 빨간** 검사가 되고, 그러면 다음 세션이 「원래 빨간 것」으로 배우다 진짜 적색을 흘린다.
   * 🔑 그래도 **조용히 지우지 않는다** — 못 잰 것은 skip 으로 드러낸다(통과와 미실행이 같은 모양이면
   *   안 된다). 그 행이 원장에 다시 나타나면 검사는 저절로 되살아난다. */
  const 표본 = 행들.find((r) => r.키 === '2b7e4da04edb');
  if (!표본) return t.skip('F541 그 행이 지금 원장에 없다(08-19 대철거가 원장을 걷었다) — 탐지력은 위 픽스처가 진다');
  assert.ok(발화.some((r) => r.키 === '2b7e4da04edb'), 'F541 그 행을 못 잡는다 — 이 검사가 아무것도 안 지킨다');
});

test('🔑 등록층 — `--딴파일` 이 아는 플래그여야 처방이 실재한다(F515: 자기가 시킨 명령이 안 도는 자리)', () => {
  assert.ok(검수.아는플래그.has('--딴파일'), '차단문이 시키는 플래그를 도구가 모른다 — 따를 수 없는 처방이다');
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  assert.match(src, /const 어긋남 = 딴파일 \? null : 사유_파일어긋남\(원본, 사유\)/,
    '기각 등록부가 이 검사를 안 지난다 — 순수 함수가 맞아도 배선에서 죽는다');
});

// ───────────────────────────────── 🔍 2단계 «변환»이 판단을 섞었나 (2026-09-04)

test('🔍 등급갈림 — 산문과 칸의 등급 «개수»가 다르면 그것만 낸다(막지 않고 알린다)', () => {
  /* 유호 확정 09-04 「솔로하자」에 딸린 조건이 이 자다. 구조화가 검수와 같은 모델이 되면서
   * 「똑똑할수록 «고쳐서» 옮긴다」는 내 주장이 실측 없이 열린 채 남았고, 자가 없으면 그 주장도
   * 그 반대도 원리상 검증되지 않는다. */
  const 산문 = '[P0] 라이브가 깨진다\n[P1] 이건 배포 전\n[P1] 이것도\n[P2] 사소';

  // ① 그대로 옮겼으면 침묵한다 — 헛경보를 내면 자가 무뎌져 정작 갈린 날 안 보인다
  const 그대로 = [{ 등급: 'P0' }, { 등급: 'P1' }, { 등급: 'P1' }, { 등급: 'P2' }];
  assert.deepStrictEqual(검수.등급갈림(산문, 그대로), []);

  // ② 등급을 «내려» 옮기면 두 칸이 동시에 어긋난다 — 이것이 잡으려는 바로 그 무늬다
  const 내림 = [{ 등급: 'P0' }, { 등급: 'P1' }, { 등급: 'P2' }, { 등급: 'P2' }];
  assert.deepStrictEqual(검수.등급갈림(산문, 내림), ['P1 2→1', 'P2 1→2']);

  // ③ 지적을 통째로 떨어뜨린 것도 보인다(가장 조용한 실패)
  assert.deepStrictEqual(검수.등급갈림(산문, [{ 등급: 'P0' }]), ['P1 2→0', 'P2 1→0']);

  // ④ 원문에 없던 지적을 «만들어» 넣은 것도 보인다(변환이 검수가 된 자리)
  assert.deepStrictEqual(검수.등급갈림('[P1] 하나뿐', [{ 등급: 'P1' }, { 등급: 'P0' }]), ['P0 0→1']);
});

test('🔍 등급갈림 — 산문에 등급 표기가 없는 판은 «잴 것이 없다»로 침묵한다', () => {
  /* 모델·판에 따라 표기를 안 붙이는 산문이 있다. 그때 「0 대 N」을 빨간불로 내면 자가
   * 헛경보로 무뎌지고, 그러면 정작 등급이 갈린 날 아무도 안 본다(자를 무디게 만드는 그 자리). */
  assert.deepStrictEqual(검수.등급갈림('등급 표기가 없는 줄글이다', [{ 등급: 'P0' }]), []);
  assert.deepStrictEqual(검수.등급갈림('', [{ 등급: 'P0' }]), []);
  assert.deepStrictEqual(검수.등급갈림(null, null), []);
  // 칸이 비었거나 등급이 이상해도 던지지 않는다 — 자가 죽으면 검수 한 벌이 통째로 죽는다
  assert.deepStrictEqual(검수.등급갈림('[P0] 하나', [{ 등급: '' }, {}, null]), ['P0 1→0']);
});
