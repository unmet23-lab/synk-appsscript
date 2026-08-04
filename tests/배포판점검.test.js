'use strict';
/* 배포판 점검 회귀 — 「push 는 됐는데 라이브는 옛 코드」를 잡는 장치.
 *
 * 🔑 탐지력은 **전부 픽스처**가 진다. 이 검사가 노리는 상태(고정 배포가 낡음)는 라이브에서만
 *   재현되는데, 라이브를 요구하면 CI 는 자격증명이 없어 **초록**이 된다 — 그게 이 도구가
 *   없애려는 형태와 같은 모양이다. 실저장소·네트워크에는 **거짓양성만** 묻는다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 점검 = require(path.join(ROOT, 'tools', '배포판점검.js'));

const 배포 = (id, ver, desc) => ({ id, ver, desc, temp: /temp|tmp|임시|runner|러너/i.test(desc) });
const 판정 = (fp, deployments) => 점검.판정({ 이름: 'crewcard', 경로: 'crewcard', fp, deployments });

// ── ① 탐지력 (픽스처) ───────────────────────────────────────────────────────

test('지문이 다르면 「옛 코드를 서빙한다」로 잡는다', () => {
  const r = 판정('aaaaaaaa', [배포('DEP1', '16', '[v9.186] 오류 감시 #fp:bbbbbbbb')]);
  assert.strictEqual(r.level, 'stale');
  assert.match(r.lines.join('\n'), /옛 코드를 서빙한다/);
  assert.match(r.lines.join('\n'), /bbbbbbbb.*aaaaaaaa/s, '두 지문을 나란히 보여줘야 사람이 판단한다');
});

test('지문이 같으면 초록 — 갱신을 끝낸 뒤엔 조용해야 한다(소음은 알림을 죽인다)', () => {
  const r = 판정('aaaaaaaa', [배포('DEP1', '18', '브랜드 키트 적용 #fp:aaaaaaaa')]);
  assert.strictEqual(r.level, 'ok');
});

test('🔑 지문이 **없으면** 통과가 아니라 「판정 불가」다 (모름을 통과로 접지 않는다)', () => {
  const r = 판정('aaaaaaaa', [배포('DEP1', '16', '[v9.186] 오류 감시')]);
  assert.notStrictEqual(r.level, 'ok', '지문 없는 배포를 초록으로 접으면 이 도구가 없애려던 형태 그대로다');
  assert.strictEqual(r.level, 'unknown');
});

test('고정 배포가 없으면(@HEAD 만) 초록 — push 가 곧 라이브인 프로젝트다', () => {
  const r = 판정('aaaaaaaa', [배포('DEP0', 'HEAD', '')]);
  assert.strictEqual(r.level, 'ok');
  assert.match(r.lines.join('\n'), /@HEAD/);
});

test('임시 러너 배포는 이 검사 몫이 아니다 — deploy-security-check 가 따로 잡는다', () => {
  const r = 판정('aaaaaaaa', [배포('DEPT', '9', 'temp-runner 임시')]);
  assert.strictEqual(r.level, 'ok', '임시 배포까지 여기서 세면 두 가드가 같은 것을 두 번 짖는다');
});

test('여러 배포 중 하나만 낡아도 잡는다 (부분 집계를 완전 집계로 읽지 않는다)', () => {
  const r = 판정('aaaaaaaa', [
    배포('DEP1', '18', '최신 #fp:aaaaaaaa'),
    배포('DEP2', '11', '옛것 #fp:cccccccc'),
  ]);
  assert.strictEqual(r.level, 'stale');
  assert.match(r.lines.join('\n'), /DEP2/);
});

// ── ② 처방이 따를 수 있는 것인가 (가드 맹점 ③) ───────────────────────────────

test('🔑 처방에 --deploymentId 가 반드시 있다 — 빠지면 새 배포가 생겨 접수 주소가 둘이 된다', () => {
  const r = 판정('aaaaaaaa', [배포('DEP1', '16', '옛것 #fp:bbbbbbbb')]);
  const 글 = r.lines.join('\n');
  assert.match(글, /clasp deploy --deploymentId DEP1/);
  assert.match(글, /새 배포/, '왜 위험한지를 처방 옆에 적어야 사람이 지운 채 실행하지 않는다');
});

test('처방은 옛 지문을 **갈아끼운다** — 설명에 지문이 두 개 붙으면 다음 판정이 갈라진다', () => {
  const r = 판정('aaaaaaaa', [배포('DEP1', '16', '설명 #fp:bbbbbbbb')]);
  const 처방 = r.lines.find((l) => l.includes('--description'));
  assert.match(처방, /#fp:aaaaaaaa/);
  assert.doesNotMatch(처방, /#fp:bbbbbbbb/, '옛 지문이 남으면 정규식이 앞의 것을 읽어 영원히 낡음이 된다');
});

test('처방 명령은 clasp-guard 가 막는 형태가 아니다 (자기 처방을 스스로 막지 않는지 · F103)', () => {
  const r = 판정('aaaaaaaa', [배포('DEP1', '16', '옛것 #fp:bbbbbbbb')]);
  const 처방 = r.lines.filter((l) => /clasp deploy/.test(l)).join(' ');
  // clasp-guard 가 차단하는 축은 「범위 과잉」이 아니라 저장소 상태다 — 처방에 우회 레버(BYPASS)나
  // 금지된 동사(clasp pull)가 섞이면 그 순간 따를 수 없는 처방이 되고, 우회가 정상 통로가 된다.
  assert.doesNotMatch(처방, /CLASP_GUARD_BYPASS/, '처방이 우회를 시키면 가드가 스스로를 무력화한다');
  assert.doesNotMatch(처방, /clasp\s+pull/, 'clasp pull 은 작업본 덮어쓰기라 금지다(F040)');
});

// ── ③ 지문 자체의 성질 (임시 픽스처 — 실저장소에 기대지 않는다) ─────────────

function 픽스처() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fp-'));
  fs.writeFileSync(path.join(d, '.clasp.json'), '{"scriptId":"x"}');
  fs.writeFileSync(path.join(d, 'appsscript.json'), '{}');
  fs.writeFileSync(path.join(d, 'Code.js'), 'function a(){}');
  fs.writeFileSync(path.join(d, '카드.html'), '<p>가</p>');
  fs.writeFileSync(path.join(d, 'README.md'), '배포 대상 아님');
  return d;
}

test('지문은 결정론적이고, 1바이트만 바뀌어도 달라진다', () => {
  const d = 픽스처();
  try {
    const a = 점검.지문(d, d);
    assert.strictEqual(a, 점검.지문(d, d), '같은 입력에 다른 값이 나오면 매번 「낡음」이 된다');
    fs.writeFileSync(path.join(d, 'Code.js'), 'function a(){} ');
    assert.notStrictEqual(a, 점검.지문(d, d));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('지문 대상에 clasp 설정 파일은 안 들어간다 (clasp 가 안 올리는 것을 세면 없는 변경이 생긴다)', () => {
  const d = 픽스처();
  try {
    const 집합 = 점검.배포집합(d, d);
    assert.ok(!집합.some((f) => /\.clasp(ignore|\.json)$/.test(f)), `설정 파일이 섞였다: ${집합}`);
    assert.ok(집합.includes('카드.html'), 'HTML 이 빠지면 카드 화면 자체가 지문 밖이 된다');
    assert.ok(!집합.includes('README.md'), '배포 대상이 아닌 파일이 섞이면 거짓 「낡음」이 난다');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// ── ④ 실저장소 — 거짓양성만 (탐지력을 여기에 기대지 않는다) ──────────────────

test('실저장소: crewcard 지문 대상이 clasp 이 실제로 미는 집합과 어긋나지 않는다', () => {
  const 집합 = 점검.배포집합(path.join(ROOT, 'crewcard'), ROOT);
  assert.ok(집합.includes('crewcard/카드_kr.html'), '고객이 보는 화면이 지문 밖이면 이 도구가 눈이 먼다');
  assert.ok(집합.includes('crewcard/appsscript.json'));
  assert.ok(!집합.some((f) => f.includes('.clasp')), `설정 파일이 섞였다: ${집합}`);
  for (const f of 집합) assert.match(f, /\.(js|gs|html|json)$/, `배포 확장자가 아닌 것이 섞였다: ${f}`);
});

// ── ⑤ 등록층 — 안 도는 장치는 없는 장치다 ──────────────────────────────────

const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
const post = (settings.hooks?.PostToolUse || []).flatMap((g) => (g.hooks || []).map((h) => ({ ...h, matcher: g.matcher })));
const 내훅 = post.find((h) => /deploy-freshness/.test(h.command));

test('deploy-freshness 가 PostToolUse 에 등록돼 있고 파일이 실재한다', () => {
  assert.ok(내훅, '훅을 만들고 등록을 안 했다 — 스스로 발화하지 않는 장치는 안 돈다');
  assert.ok(fs.existsSync(path.join(ROOT, '.claude', 'hooks', 'deploy-freshness.js')));
});

test('🔑 라우팅이 훅보다 넓다 — 훅이 보는 명령을 case 필터가 전부 통과시킨다 (맹점 ③)', () => {
  /* 정규식은 **훅에서 가져온다**. 여기 사본을 적었더니 변이 테스트에서 드러났다 —
   * 훅을 `push` 만 보게 좁혀도 이 검사는 자기 사본을 봐서 초록이었다(2026-08-05 실측). */
  const { 배포명령: 훅정규식 } = require(path.join(ROOT, '.claude', 'hooks', 'deploy-freshness.js'));
  const 표본 = [
    'clasp push',
    'clasp push --force',
    'clasp deploy --deploymentId ABC --description "x"',
    'cd crewcard && clasp push --force',
    '"/c/Users/q/AppData/Roaming/npm/clasp.cmd" push --force',
  ];
  for (const cmd of 표본) {
    assert.ok(훅정규식.test(cmd), `훅이 못 본다: ${cmd}`);
    // settings 의 case 패턴은 *clasp* — 훅이 보는 것보다 넓어야 한다
    assert.ok(/clasp/.test(cmd) && /\*clasp\*/.test(내훅.command), `라우팅이 좁다: ${cmd}`);
  }
  // 반대 방향 — 조회 명령은 훅이 안 본다(소음 금지). `deployments` 는 낱말 경계로 갈린다.
  for (const cmd of ['clasp deployments', 'clasp versions', 'git push origin master']) {
    assert.ok(!훅정규식.test(cmd), `조회·무관 명령에 발화한다: ${cmd}`);
  }
});

test('알림 훅은 **차단하지 않는다** — push 뒤에 뜨는 알림이 작업을 세우면 안 된다', () => {
  /* 🔑 단언을 `if (출력이 있으면)` 안에 두었더니 **아무것도 검사하지 않았다**(2026-08-05 변이로 적발).
   *   그때 배포판이 마침 초록이라 훅이 조용했고, 조건문이 통째로 건너뛰어 「차단하도록 뒤집는」
   *   변이가 초록으로 통과했다. 그래서 **반드시 말하게 만드는 상태**를 만들어 놓고 잰다:
   *   clasp 를 못 찾게 하면 판정은 `unreachable` 이 되고 훅은 알림을 낸다. */
  const 훅 = path.join(ROOT, '.claude', 'hooks', 'deploy-freshness.js');
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-noclasp-'));
  try {
    const r = spawnSync(process.execPath, [훅], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'cd crewcard && clasp push --force' }, cwd: ROOT }),
      encoding: 'utf8',
      // APPDATA·PATH 를 비워 clasp 조회를 실패시킨다 → 확인 불가 → **반드시 알린다**
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, APPDATA: 빈곳, PATH: path.dirname(process.execPath) },
      timeout: 60000,
    });
    assert.strictEqual(r.status, 0, `알림 훅이 0 아닌 코드로 끝났다: ${r.stderr}`);
    const out = (r.stdout || '').trim();
    assert.ok(out, '알려야 하는 상태인데 조용했다 — 확인 불가를 통과로 접었다');
    const j = JSON.parse(out);
    assert.strictEqual(j.hookSpecificOutput?.permissionDecision, undefined,
      '알림인데 permissionDecision 을 냈다 — 편의 기능이 배포를 세운다');
    assert.match(j.systemMessage, /확인 불가/);
  } finally { fs.rmSync(빈곳, { recursive: true, force: true }); }
});

test('무관한 명령에는 조용하다 (거짓양성 0 — 짖는 알림은 곧 무시된다)', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'deploy-freshness.js')], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: ROOT }),
    encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT }, timeout: 30000,
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual((r.stdout || '').trim(), '');
});
