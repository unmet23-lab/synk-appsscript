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
const { 훅띄우기 } = require('./lib/훅띄우기');

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

test('🔑 고정 배포가 없으면(@HEAD 만) level 은 ok 지만 그건 **아무것도 안 잰 것**이다', () => {
  /* 2026-08-07: 여기가 루트(유호님이 매일 쓰는 라이브)의 자리다. 지문은 배포 설명에 심는데
   * 고정 배포가 없으면 심을 자리가 없어 이 층은 원리상 못 잰다. level 을 'ok' 로 두는 이유는
   * 이 갈래의 상시 호출자가 `clasp push` **직후**에 도는 deploy-freshness 훅이라서다 —
   * 그 순간엔 라이브가 실제로 최신이므로 경보가 거짓이 된다. 대신 **문장이 안 쟀다고 말해야** 한다. */
  const r = 판정('aaaaaaaa', [배포('DEP0', 'HEAD', '')]);
  assert.strictEqual(r.level, 'ok', '훅이 push 직후에 짖으면 거짓 경보다');
  assert.strictEqual(r.측정, false, '안 쟀다는 사실이 기계 판독 가능해야 호출자가 재려는 결정을 할 수 있다');
  assert.match(r.lines.join('\n'), /안 쟀다/, '「push 가 곧 라이브다」는 기전 진술이지 측정이 아니다');
  assert.match(r.lines.join('\n'), /--라이브/, '재는 방법을 같은 줄에 줘야 사람이 다음 수를 안다');
  assert.doesNotMatch(r.lines.join('\n'), /최신|동일/, '안 쟀는데 최신이라 말하면 이 도구가 없애려던 형태 그대로다');
});

// ── ②-b @HEAD 프로젝트: 지문 대신 **바이트**로 잰다 (2026-08-07) ─────────────
// 탐지력은 전부 여기 픽스처가 진다 — 라이브를 요구하면 CI 는 자격증명이 없어 초록이 된다.

const 헤드 = (대조) => 점검.판정({ 이름: '(루트)', 경로: '.', fp: 'aaaaaaaa', deployments: [배포('DEP0', 'HEAD', '')], 대조 });

test('대조가 깨끗하면 초록 — 이번엔 「안 쟀다」가 아니라 **잰 초록**이다', () => {
  const r = 헤드({ 다름: [], 라이브없음: [], 저장소없음: [], 총: 15 });
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.측정, true, '잰 초록과 안 잰 초록이 같은 모양이면 이 수리가 무의미하다');
  assert.match(r.lines.join('\n'), /15개/);
});

test('내용이 다르면 잡는다 — 「커밋은 했는데 clasp push 를 안 했다」', () => {
  const r = 헤드({ 다름: ['엔진_두뇌.js'], 라이브없음: [], 저장소없음: [], 총: 15 });
  assert.strictEqual(r.level, 'stale');
  assert.match(r.lines.join('\n'), /엔진_두뇌\.js/, '어느 파일인지 안 대면 사람이 확인할 수가 없다');
  assert.match(r.lines.join('\n'), /push 가 빠졌다/);
  /* 호출부는 「push 가 빠졌다」와 「지금 누가 그 파일을 고치는 중이다」를 갈라야 하는데(라이브대조는
   * 작업본을 잰다), 그러려면 이 목록이 **구조로** 와야 한다 — 문장에서 되뽑으면 문구가 바뀌는 날
   * 조용히 안 갈린다. 세 갈래(다름·라이브없음·저장소없음)가 전부 실려야 한 파일이라도 빠지지 않는다. */
  const 세갈래 = 헤드({ 다름: ['엔진_두뇌.js'], 라이브없음: ['새것.js'], 저장소없음: ['지운것.js'], 총: 15 });
  assert.deepStrictEqual(세갈래.파일들, ['엔진_두뇌.js', '새것.js', '지운것.js'],
    '낡은 파일 목록을 구조로 안 내면 rot-check 가 「남이 편집 중」을 못 갈라 매일 거짓 🔴 를 낸다');
});

test('라이브에 아예 없는 파일도 낡음이다 (한 번도 push 된 적 없는 새 파일)', () => {
  const r = 헤드({ 다름: [], 라이브없음: ['contents_새것.js'], 저장소없음: [], 총: 16 });
  assert.strictEqual(r.level, 'stale');
  assert.match(r.lines.join('\n'), /contents_새것\.js/);
});

test('🔑 반대 방향도 잡는다 — 저장소에서 지웠는데 라이브에 남은 코드는 **계속 돈다**', () => {
  /* 한 방향만 재면 「지웠다」가 「안 돈다」로 읽힌다. 그 오독은 삭제한 사람에게만 조용하다. */
  const r = 헤드({ 다름: [], 라이브없음: [], 저장소없음: ['옛_상담AI.js'], 총: 15 });
  assert.strictEqual(r.level, 'stale');
  assert.match(r.lines.join('\n'), /옛_상담AI\.js/);
  assert.match(r.lines.join('\n'), /계속 돈다/);
});

test('@HEAD 처방은 손 clasp push 가 아니라 /deploy 다 (자기 처방을 스스로 막지 않는지 · F103)', () => {
  const r = 헤드({ 다름: ['Code.js'], 라이브없음: [], 저장소없음: [], 총: 15 });
  const 처방 = r.lines.filter((l) => l.includes('→')).join(' ');
  assert.match(처방, /\/deploy/, '처방이 없으면 사람은 손 push 를 시도하고 clasp-guard 에 막힌다');
  assert.doesNotMatch(처방, /clasp\s+push/, 'clasp-guard 가 막는 명령을 처방하면 우회가 정상 통로가 된다');
  assert.doesNotMatch(처방, /CLASP_GUARD_BYPASS/);
});

test('☠️ 라이브를 받는 곳은 반드시 작업본 **밖**이다 (작업본 pull 은 남의 커밋을 되돌린다 · F040)', () => {
  /* 이 검사만 구조를 읽는다 — 실패하면 옆 세션의 커밋이 라이브 판으로 조용히 되돌아가고,
   * git 은 오류를 안 낸다. 실행으로 재려면 실제로 사고를 내야 하므로 재현 대신 형태를 못박는다. */
  const src = fs.readFileSync(path.join(ROOT, 'tools', '배포판점검.js'), 'utf8');
  const 시작 = src.indexOf('function 라이브대조');
  assert.notStrictEqual(시작, -1, '라이브대조 를 못 찾았다 — 앵커가 낡으면 이 검사는 무엇이든 통과시킨다');
  const 몸통 = src.slice(시작, src.indexOf('\nfunction ', 시작 + 1));
  assert.ok(몸통.length > 200, '몸통을 못 잘랐다 — 빈 문자열에는 어떤 doesNotMatch 도 통과한다');
  assert.match(몸통, /mkdtempSync/, '임시 디렉터리를 안 만든다 — 어디로 받는지가 흐리면 언젠가 작업본이다');
  assert.match(몸통, /cwd:\s*tmp\b/, 'pull 의 cwd 가 임시 디렉터리가 아니다');
  assert.doesNotMatch(몸통, /cwd:\s*(projRoot|root|ROOT)\b/, '작업본에서 pull 하면 옆 세션 커밋이 라이브 판으로 덮인다');
  assert.match(몸통, /rmSync/, '임시 디렉터리를 안 지우면 매주 라이브 사본이 디스크에 쌓인다');
});

test('조회 실패는 세 원인을 한 문장으로 접지 않는다 — 원문 끝 줄을 함께 낸다', () => {
  /* 오프라인·미로그인·clasp 없음은 대처가 전부 다르다(기다린다 / 30초면 고친다 / 설치한다).
   * 한 문장으로 접으면 읽는 사람이 매번 셋을 다 확인하거나 아무것도 안 한다.
   * 🔑 진짜 clasp 을 호출해서 재지 않는다 — 그러면 이 검사가 20초 타임아웃에 매달리고,
   *   기계마다(로그인 여부·네트워크) 결과가 갈린다. 실패 객체를 직접 준다. */
  const e = Object.assign(new Error('spawn failed'), { stderr: 'Error: Could not read API credentials.\nRun clasp login.\n' });
  const r = 점검.못읽음('(루트)', '배포 목록을 못 읽었다', e);
  assert.strictEqual(r.level, 'unreachable');
  assert.ok(r.lines.length >= 2, `원인 원문이 없다: ${r.lines.join(' / ')}`);
  assert.match(r.lines[1], /clasp login/, '원문 끝 줄을 안 실었다 — 셋 중 어느 원인인지 못 가른다');
  assert.match(r.lines[0], /확인 불가/, '통과와 미실행이 같은 모양이면 안 된다');
  // 원문이 아예 없을 때도 조용히 빈 줄을 내면 안 된다(있으나 마나 한 줄)
  assert.match(점검.못읽음('x', 'y', new Error('')).lines[1], /\S{3,}/);
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
    const r = 훅띄우기(훅, {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'cd crewcard && clasp push --force' }, cwd: ROOT }),
      encoding: 'utf8',
      /* APPDATA·PATH 를 비워 clasp 조회를 실패시킨다 → 확인 불가 → **반드시 알린다**
       *
       * 🔑 PATH 는 `빈곳` 이어야 한다 — 2026-08-05 이종 검수(Codex)가 잡은 결함:
       *   여기 원래 `path.dirname(process.execPath)` 가 있었는데, **POSIX(nvm·Homebrew)에서는
       *   그 폴더가 npm 전역 바이너리 자리와 같다.** 즉 이 픽스처가 유호님의 **실제 로그인된
       *   clasp 을 실행**해 라이브 배포 상태를 조회하고, 그 결과에 따라 `ok`/`stale`/`unknown`
       *   이 갈려 단언이 기계마다 달라진다. 이 PC(Windows)는 node 와 npm 전역이 다른 폴더라
       *   **안 터졌다** — 로컬 초록이 방어가 안 되는 자리의 표본이다(CLAUDE.md 「repo 밖 환경에
       *   기대는 검사는 CI에서 깨진다」).
       *   node 는 위에서 `process.execPath` 절대경로로 띄우고 훅도 cmd 를 ComSpec 절대경로로
       *   부르므로, PATH 를 비워도 **clasp 만** 못 찾는다 — 정확히 이 테스트가 원하는 상태다. */
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, APPDATA: 빈곳, PATH: 빈곳 },
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
  const r = 훅띄우기(path.join(ROOT, '.claude', 'hooks', 'deploy-freshness.js'), {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: ROOT }),
    encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT }, timeout: 30000,
  });
  assert.strictEqual((r.stdout || '').trim(), '');
});
