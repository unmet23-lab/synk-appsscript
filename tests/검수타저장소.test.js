'use strict';
/* 이종 검수 — «형제 저장소» 회귀 (2026-08-31)
 *
 * 무엇을 지키나, 그리고 왜 이 파일이 따로 있나:
 *   `tools/codex-review.js` 의 `ROOT` 한 값이 **두 가지**를 뜻하고 있었다 — ①이 도구의 집
 *   (스키마·판단 정본·장부·Apps Script 배포층) ②지금 재는 저장소(git·codex 가 도는 곳).
 *   둘이 같은 값이라 SYNK-talk 은 **원리상** 검수를 못 받았다(08-31 실측: talk 커밋 sha 를
 *   `--commit` 으로 주자 여기서 `unknown revision` 으로 종료 2). `--저장소` 가 ②만 떼어낸다.
 *
 * 🔴 이 분리가 새로 만드는 위험은 하나고, 그게 이 파일의 과녁이다 —
 *   **남의 저장소 검수가 이 집의 배포 게이트를 여는 것.** 지적 키는 `sha256(파일+제목)` 이라
 *   저장소를 모르고, 두 저장소에 같은 상대 경로는 흔하다(`tools/…`·`lib/…`·`docs/…`).
 *   그래서 벽을 **읽는 쪽에** 세웠고(`장부읽기`), 여기 6·9번이 그 벽을 적대 픽스처로 민다.
 *
 * ⚠ 탐지력은 **픽스처가 진다.** 실제 SYNK-talk 경로에 기대면 CI(새 클론)엔 형제 저장소가 없어
 *   그 초록은 「막았다」가 아니라 「안 재봤다」다(cross-repo-blindness). 그래서 이 파일은
 *   `git init` 으로 제 저장소를 만들어 쓴다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 검수 = require(path.join(ROOT, 'tools', 'codex-review.js'));
const 점검 = require(path.join(ROOT, 'tools', '배포판점검.js'));

const 루트프로젝트 = ROOT;
const 이름 = '(루트)';
const 실지문 = 점검.지문(루트프로젝트, ROOT);

/* 모듈 상태(`대상ROOT`)는 프로세스 전역이다 — 한 검사가 안 되돌리면 **뒤 검사가 남의 저장소를
 * 재면서 초록**을 낸다. 그러면 이 파일 자체가 「맞는 얼굴로 틀린 값」이 된다. 그래서 통로 하나로 싼다. */
function 저장소로(경로, 본문) {
  try { return 본문(검수.저장소잡기(경로)); }
  finally { 검수.저장소잡기(ROOT); }
}

/** 픽스처 git 저장소 — 커밋 하나를 두고 sha 를 돌려준다. */
function 픽스처저장소(이름표, 파일들 = { 'App.js': '// 기본\n' }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `synk-타저장소-${이름표}-`));
  const git = (...args) => execFileSync('git', ['-C', d, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
  git('init', '-q');
  git('config', 'user.email', 'fixture@synk.test');
  git('config', 'user.name', 'fixture');
  git('config', 'commit.gpgsign', 'false');
  for (const [f, 내용] of Object.entries(파일들)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), 내용, 'utf8');
  }
  git('add', '-A');
  git('commit', '-q', '-m', '픽스처 첫 커밋');
  return { 경로: d, sha: git('rev-parse', 'HEAD'), git };
}

function 장부(기록들, 기각들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-타저장소-장부-'));
  const 기록경로 = path.join(d, '기록.jsonl');
  const 기각경로 = path.join(d, '기각.jsonl');
  const 쓰기 = (p, 행들) => fs.writeFileSync(p, 행들.map((o) => JSON.stringify(o)).join('\n') + (행들.length ? '\n' : ''));
  쓰기(기록경로, 기록들);
  쓰기(기각경로, 기각들);
  return { 기록경로, 기각경로, dir: d };
}

const 지적 = (등급, 키) => ({ 등급, 파일: 'Code.js', 라인: 1, 제목: '가짜 지적 ' + 키, 근거: 'ㄱ', 수정방향: 'ㄴ', 키 });
const 기록 = (opts = {}) => ({
  시각: '2026-08-31T00:00:00.000Z',
  ...(opts.저장소 ? { 저장소: opts.저장소 } : {}),
  대상: { 종류: 'commit', 값: 'deadbeef' },
  범위: opts.범위 || [이름],
  지문: opts.지문 || { [이름]: 실지문 },
  요약: '',
  지적: opts.지적 || [],
});

// ───────────────────────────────── ① 집과 재는 것이 갈린다

test('기본은 이 도구의 집이다 — 아무것도 안 주면 옛 동작과 한 글자도 안 달라진다', () => {
  assert.strictEqual(검수.타저장소(), false);
  assert.strictEqual(검수.대상저장소(), ROOT);
  assert.deepStrictEqual(검수.저장소스탬프(), {}, '집에서 스탬프를 찍으면 옛 행 전량과 모양이 갈린다');
  assert.strictEqual(검수.이저장소표(), '', '집의 표는 빈 문자열이어야 스탬프 없는 옛 행과 같은 값이다');
});

test('🔑 --저장소 가 대상을 열고 **인자를 절대 경로로 고친다** — 자식은 cwd 가 다르다', () => {
  const 픽 = 픽스처저장소('열기');
  const 원래cwd = process.cwd();
  try {
    process.chdir(path.dirname(픽.경로));
    const argv = ['--저장소', path.basename(픽.경로), '--commit', 픽.sha];
    검수.저장소열기(argv);
    assert.strictEqual(검수.타저장소(), true);
    assert.strictEqual(fs.realpathSync(검수.대상저장소()), fs.realpathSync(픽.경로));
    assert.strictEqual(argv[1], 검수.대상저장소(),
      '상대 경로가 그대로 남았다 — 던지기·회차 자식은 cwd 가 달라 딴 저장소를 열거나 못 연다(실패는 30분 뒤 「멈춤」으로만 보인다)');
  } finally { process.chdir(원래cwd); 검수.저장소잡기(ROOT); }
});

test('🔑 git 저장소가 아니면 **확인 불가로 거절**한다 — 조용히 집으로 접으면 남의 판을 검수한다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-타저장소-비git-'));
  assert.throws(() => 검수.저장소열기(['--저장소', d]), (e) => e && e.확인불가 === true);
  assert.throws(() => 검수.저장소열기(['--저장소']), (e) => e && e.확인불가 === true);
  assert.strictEqual(검수.타저장소(), false, '거절했는데 대상이 옮겨 갔다');
});

test('☠️ 저장소 이름은 **워크트리에서도 본 저장소 이름**이다 — 안 그러면 어제 찍은 처분이 오늘 안 걸러진다', () => {
  const 픽 = 픽스처저장소('워크트리');
  const wt = path.join(픽.경로, '..', path.basename(픽.경로) + '-wt');
  try { 픽.git('worktree', 'add', '-q', '-b', 'lane', wt); }
  catch (e) { assert.fail(`워크트리를 못 만들었다 — 이 검사는 그때 「통과」가 아니라 미실행이다: ${e.message}`); }
  assert.strictEqual(검수.저장소이름(wt), path.basename(픽.경로),
    '워크트리에서 다른 이름이 나왔다 — 이 저장소는 레인마다 워크트리를 파므로 장부가 세션마다 갈린다');
});

test('🔑 재는 저장소의 커밋을 실제로 읽는다 — 이것이 08-31 에 `unknown revision` 으로 죽던 그 자리다', () => {
  const 픽 = 픽스처저장소('대상', { 'App.js': 'a\n', 'lib/x.js': 'b\n' });
  // 집에서는 이 sha 가 없다 — 「집에서도 어차피 되는 것」을 재는 헛초록을 막는 분모다
  assert.throws(() => 검수.대상결정(['--commit', 픽.sha]), /.../, '픽스처 sha 가 이 저장소에도 있다 — 검사가 무의미하다');
  저장소로(픽.경로, () => {
    const 대상 = 검수.대상결정(['--commit', 픽.sha]);
    assert.strictEqual(대상.종류, 'commit');
    assert.deepStrictEqual(대상.파일들.sort(), ['App.js', 'lib/x.js']);
  });
});

// ───────────────────────────────── ② 배포 게이트에 원리상 못 닿는다 (거짓 초록 벽)

test('☠️ 형제 저장소엔 Apps Script 배포층이 **원리상 없다** — 프로젝트·범위·지문이 전부 빈다', () => {
  const 픽 = 픽스처저장소('배포층', { 'Code.js': 'x\n', 'appsscript.json': '{}\n' });
  // 파일 이름을 일부러 이 집의 `.claspignore` 배포 대상과 **똑같이** 골랐다 — 글롭이 우연히
  // 맞는 날 남의 파일이 이 집의 배포집합으로 세어지는 것이 정확히 막으려는 사고다.
  assert.ok(검수.클라스프프로젝트들().length > 0, '집에서 프로젝트가 0건이면 아래 대비가 분모를 잃는다');
  저장소로(픽.경로, () => {
    assert.deepStrictEqual(검수.클라스프프로젝트들(), []);
    assert.deepStrictEqual(검수.범위(['Code.js', 'appsscript.json', '엔진_x.js']), [],
      '남의 파일이 이 집의 배포 범위로 세어졌다 — 그 기록 하나가 이 집의 배포 게이트를 연다');
    assert.deepStrictEqual(검수.유효지문({ 종류: 'commit', 값: 'x' }), {},
      '남의 검수 기록이 이 집의 지문을 들고 다니면 그게 열쇠가 된다');
  });
});

test('🔴 게이트판정은 **저장소 스탬프가 찍힌 행을 안 읽는다** — 지문·범위가 완벽히 맞아도', () => {
  // 적대 픽스처: 이 집의 지문·범위를 그대로 든 행에 talk 스탬프만 붙였다.
  const 적대 = 장부([기록({ 저장소: 'SYNK-talk' })], []);
  const r = 검수.게이트판정(루트프로젝트, ROOT, 적대);
  assert.strictEqual(r.level, 'none',
    '남의 저장소 검수 기록이 이 집의 배포 게이트를 「검수됨」으로 열었다 — 이 분리가 만드는 유일한 거짓 초록이다');

  // 분모 — 같은 행에서 스탬프만 떼면 열려야 한다(안 열리면 위 초록은 「검사가 죽었다」다)
  const 집 = 장부([기록()], []);
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, 집).level, 'ok');
});

test('🔴 남의 저장소에서 찍은 **기각이 이 집의 차단을 못 푼다** — 키는 저장소를 모른다', () => {
  const k = 'a1b2c3d4e5f6';
  const 차단행 = 기록({ 지적: [지적('P1', k)] });
  const 남의기각 = { 시각: '2026-08-31T00:00:00.000Z', 저장소: 'SYNK-talk', 키: k, 사유: '거기선 틀렸다', 처분: '기각' };
  const r = 검수.게이트판정(루트프로젝트, ROOT, 장부([차단행], [남의기각]));
  assert.strictEqual(r.level, 'block',
    '형제 저장소에서 찍은 기각이 이 집의 P1 을 풀었다 — 같은 상대 경로는 두 저장소에 흔하다');

  // 분모 — 같은 기각에서 스탬프만 떼면 풀려야 한다
  const { 저장소: _버림, ...집기각 } = 남의기각;
  assert.strictEqual(검수.게이트판정(루트프로젝트, ROOT, 장부([차단행], [집기각])).level, 'ok');
});

test('🔑 형제 저장소에선 「배포 파일 0건」 정지를 안 세운다 — 막을 게이트가 없다(탈출구 상시화 방지 · F103)', () => {
  const 픽 = 픽스처저장소('정지');
  const 대상 = { 종류: 'commit', 값: 픽.sha, 파일들: ['App.js'] };
  assert.ok(검수.범위밖정지(대상, [], ROOT, []), '집에서는 여전히 세워야 한다 — 아니면 아래 초록이 분모를 잃는다');
  저장소로(픽.경로, () => {
    assert.strictEqual(검수.범위밖정지(대상, [], ROOT, []), null,
      '매 호출에 --범위밖 을 붙이게 만들면 그 습관이 이 집의 배포 검수까지 따라온다');
  });
});

// ───────────────────────────────── ③ 장부는 한 벌이되 저장소로 갈린다

test('🔑 스탬프 없는 옛 행은 **집 행**이다 — 하위호환이 규칙 하나로 닫힌다', () => {
  assert.strictEqual(검수.행저장소({ 키: 'x' }), '');
  assert.strictEqual(검수.행저장소({ 키: 'x', 저장소: 'SYNK-talk' }), 'SYNK-talk');
  const p = 장부([], []).기각경로;
  fs.writeFileSync(p, [
    JSON.stringify({ 키: '옛행', 처분: '기각', 사유: 'ㄱ' }),                     // 스탬프 없음 = 집
    JSON.stringify({ 키: '남행', 처분: '기각', 사유: 'ㄴ', 저장소: 'SYNK-talk' }),
  ].join('\n') + '\n');
  assert.deepStrictEqual(검수.장부읽기(p).map((r) => r.키), ['옛행'], '집에서 남의 행이 섞였다');
  assert.deepStrictEqual(검수.장부읽기(p, 'SYNK-talk').map((r) => r.키), ['남행']);
  assert.deepStrictEqual(검수.장부읽기(p, '').map((r) => r.키), ['옛행'], '게이트가 읽는 축(집)이 흔들렸다');
});

test('🔑 재발 필터가 저장소를 못 넘는다 — 한 파일을 쓰되 읽을 때 가른다', () => {
  const k = '0f0f0f0f0f0f';
  const p = 장부([], []).기각경로;
  fs.writeFileSync(p, JSON.stringify({ 키: k, 처분: '기각', 사유: '거기선 틀렸다', 저장소: 'SYNK-talk' }) + '\n');
  assert.strictEqual(검수.걸러지는키들(검수.장부읽기(p)).has(k), false, '집에서 남의 기각으로 걸러냈다');
  assert.strictEqual(검수.걸러지는키들(검수.장부읽기(p, 'SYNK-talk')).has(k), true,
    '그 저장소에서조차 안 걸러진다 — 그러면 스탬프가 필터를 통째로 죽인 것이다');
});

// ───────────────────────────────── ④ 방·런 — 두 저장소가 서로를 이어받지 않는다

test('☠️ 방 지문에 저장소 축이 있다 — `(미커밋)` 은 어느 저장소에서나 같은 문자열이다', () => {
  const 런 = require(path.join(ROOT, 'tools', 'lib', '검수런.js'));
  const 바탕 = { 종류: 'uncommitted', 값: '(미커밋)', 모델: 'm', 효력: 'high', 버그만: false, 총회차: 2 };
  assert.notStrictEqual(런.방지문({ ...바탕, 저장소: 'SYNK-talk' }), 런.방지문(바탕),
    '두 저장소의 미커밋 검수가 같은 방을 쓴다 — 서로의 회차를 「이미 돌았다」로 이어받는다(통과 방향)');
  assert.strictEqual(런.방지문({ ...바탕, 저장소: '' }), 런.방지문(바탕), '집의 축 값은 빈 문자열 하나여야 한다');
});

test('🔴 훅은 런마다 **그 런이 재는 저장소**의 HEAD 와 댄다 — 아니면 매 세션 거짓 경보가 뜬다', () => {
  const 픽 = 픽스처저장소('훅head');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-타저장소-런-'));
  const env = { ...process.env, SYNK_REVIEW_RUNS: path.join(d, 'runs') };
  delete require.cache[require.resolve(path.join(ROOT, 'tools', 'lib', '검수런.js'))];
  process.env.SYNK_REVIEW_RUNS = env.SYNK_REVIEW_RUNS;
  const 런 = require(path.join(ROOT, 'tools', 'lib', '검수런.js'));
  const 바탕 = {
    종류: '검수', 상태: '진행', pid: process.pid, 시작: new Date().toISOString(),
    대상: `--commit ${픽.sha}`, 인자: ['--commit', 픽.sha], 로그: path.join(d, 'x.log'),
  };
  런.런쓰기({ ...바탕, 런ID: '검수-타저장소', HEAD: 픽.sha, 저장소: 'FIX', 저장소경로: 픽.경로 });
  런.런쓰기({ ...바탕, 런ID: '검수-집', HEAD: 픽.sha });   // 저장소 칸 없음 = 집 → 이 집 HEAD 와 다르다

  const 훅 = (() => {
    try {
      return execFileSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'review-runs.js')],
        { encoding: 'utf8', env });
    } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
  })();

  const 줄들 = 훅.split('\n');
  const 경보줄 = 줄들.map((l, i) => ({ l, i })).filter((x) => /HEAD 가 움직였다/.test(x.l));
  assert.strictEqual(경보줄.length, 1,
    `거짓/누락 경보 — 기대 1건(집 런만), 실제 ${경보줄.length}건:\n${훅}`);
  const 앞줄 = 줄들.slice(0, 경보줄[0].i).reverse().find((l) => /검수-/.test(l)) || '';
  assert.match(앞줄, /검수-집/,
    `형제 저장소 런에 거짓 경보가 붙었다 — 거짓 경보는 사람이 훅을 통째로 무시하게 만든다:\n${훅}`);
});

// ───────────────────────────────── ⑤ 등록층 — 플래그와 문구(가드는 로직보다 여기서 샌다)

test('🔑 --저장소 는 **값플래그**다 — 아니면 뒤 경로를 「모르는 인자」로 읽고 거절한다(F135)', () => {
  assert.ok(검수.값플래그.includes(검수.저장소플래그));
  assert.ok(검수.아는플래그.has(검수.저장소플래그));
});

test('🔒 git·codex 자식이 **재는 저장소**에서 돈다 — 되돌리면 그 자리가 그대로 08-31 이다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  for (const 머리 of ['function git(args) {', 'function codex(args, 입력, timeoutMs, 라벨) {']) {
    const i = src.indexOf(머리);
    assert.notStrictEqual(i, -1, `${머리} 를 못 찾았다 — 이 검사는 그때 「통과」가 아니라 미실행이다`);
    const 몸 = src.slice(i, i + 2600);
    assert.match(몸, /cwd:\s*대상ROOT/, `${머리} 가 재는 저장소에서 안 돈다`);
    assert.doesNotMatch(몸, /cwd:\s*ROOT\b/, `${머리} 에 집이 다시 못박혔다`);
  }
});

test('🔑 --확인 + --저장소 는 **확인 불가(2)** 다 — 「잴 게 없었다」가 「통과(0)」와 같은 모양이면 안 된다', () => {
  const 픽 = 픽스처저장소('확인');
  const r = spawnSync(process.execPath,
    [path.join(ROOT, 'tools', 'codex-review.js'), '--확인', 검수.저장소플래그, 픽.경로],
    { encoding: 'utf8', windowsHide: true });
  assert.strictEqual(r.status, 2, `기대 2, 실제 ${r.status}\n${r.stdout}${r.stderr}`);
  assert.match(String(r.stderr), /원격배포\.js/,
    '그 저장소의 **진짜 게이트**를 안 대면 「검수 통과 = 배포해도 됨」으로 읽힌다');
});

test('🔑 --심문 과는 겸용을 거절한다 — 결과·장부가 어디 남는지에 대해 틀린 그림을 안 만든다', () => {
  const 픽 = 픽스처저장소('심문겸용');
  const r = spawnSync(process.execPath,
    [path.join(ROOT, 'tools', 'codex-review.js'), '--심문', 'docs/없는문서.md', 검수.저장소플래그, 픽.경로],
    { encoding: 'utf8', windowsHide: true });
  assert.strictEqual(r.status, 2);
  assert.match(String(r.stderr), /심문은 문서 경로를 그대로 받는다/);
});

/* 없는 개정의 git 문구는 **셋으로 갈린다**(실측 08-31) — 문구 목록으로 재면 넷째가 생기는 날
 * 조용히 침묵한다. 그래서 세 모양을 다 걸어 「축이 문구가 아님」을 회귀가 못박는다. */
for (const [갈래, 만들기] of [
  ['짧은 sha', (픽) => ['--commit', 픽.sha.slice(0, 7)]],
  ['40자 sha', (픽) => ['--commit', 픽.sha]],
  ['브랜치',   () => ['--base', '없는브랜치-xyz']],
]) {
  test(`🔑 집의 개정이 아니면 **형제 저장소를 대라**고 말한다 (${갈래}) — 08-31 은 여기서 사유 없이 죽었다`, () => {
    const 픽 = 픽스처저장소('힌트');
    const r = spawnSync(process.execPath,
      [path.join(ROOT, 'tools', 'codex-review.js'), ...만들기(픽)],
      { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(r.status, 2, '없는 개정을 통과로 접으면 안 된다');
    assert.match(String(r.stderr), new RegExp(검수.저장소플래그),
      '처방이 없으면 다음 사람도 08-31 처럼 「도구가 고장났다」로 읽는다(F103)');
  });
}

// ───────────────────────────────── ⑥ 「아는 미완」 재료는 저장소마다 다르다 (08-31 · talk 첫 런이 낸 구멍)

/* talk 첫 이종 검수(런 …0840-6b9bbf)의 지적 3건이 **전부** 「저장소가 스스로 미완이라 적어 둔 칸」
 * 이었다. 재료가 `gh pr list` 하나였고 talk 은 열린 PR 이 0개라, 블록이 통째로 안 실린 채
 * 로그만 「열린 트랙 0개」라고 적었다 — 없는 것과 «출처가 다른 것»이 같은 모양이었다. */

/** 이름이 `SYNK-talk` 인 픽스처 저장소 — 규약형 갈래를 «실제로» 밟는다(표를 안 건드린다). */
function 이름있는저장소(이름표, 파일들) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-이름-'));
  const d = path.join(뿌리, 이름표);
  fs.mkdirSync(d);
  const git = (...a) => execFileSync('git', ['-C', d, ...a],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
  git('init', '-q');
  git('config', 'user.email', 'fixture@synk.test');
  git('config', 'user.name', 'fixture');
  for (const [f, 내용] of Object.entries(파일들 || {})) fs.writeFileSync(path.join(d, f), 내용, 'utf8');
  return d;
}

test('🔑 출처 표 — 집은 목록(PR) · talk 은 규약 · **모르는 저장소는 null**(빈 목록이 아니다)', () => {
  assert.strictEqual(검수.아는미완출처('').종류, '목록');
  assert.strictEqual(검수.아는미완출처('SYNK-talk').종류, '규약');
  assert.strictEqual(검수.아는미완출처('무슨-저장소'), null,
    '모르는 저장소가 빈 목록을 받으면 그 침묵이 「미완 없음」으로 읽힌다 — 08-31 이 그 모양이었다');
});

test('☠️ 출처를 모르면 블록이 **침묵하지 않는다** — 침묵은 「이 저장소엔 미완이 없다」로 읽힌다', () => {
  const b = 검수.아는미완블록({ 줄들: [], 전체: 0, 출처: null });
  assert.notStrictEqual(b, '', '출처 없음인데 블록이 비었다 — 08-31 talk 런이 정확히 이 자리였다');
  assert.match(b, /모른다/);
  assert.match(b, /미완이 없다」로 읽지 마라/);
  assert.match(b, /실제로 깨뜨린 것/, '면죄부가 되면 안 된다 — 억제와 안내를 가르는 줄이 빠졌다');
});

test('🔒 옛 계약은 그대로 — 출처 «칸이 없는» 호출은 여전히 빈 문자열이다', () => {
  // 이 뜻은 지금도 옳다(없는 목록을 지어내지 않는다). 새 동작은 «출처를 명시한» 호출에만 붙는다.
  assert.strictEqual(검수.아는미완블록({ 줄들: [], 전체: 0 }), '');
  assert.strictEqual(검수.아는미완블록(null), '');
});

test('🔑 출처를 «읽었는데 정말 0건»과 «못 읽었다»가 다른 문장이다', () => {
  const 진짜0 = 검수.아는미완블록({ 줄들: [], 전체: 0, 출처: { 종류: '목록', 이름: '열린 PR' } });
  const 못읽음 = 검수.아는미완블록({ 줄들: [], 전체: 0, 출처: { 종류: '목록', 이름: '열린 PR' }, 오류: 'gh 인증 끊김' });
  assert.match(진짜0, /정말 0건/);
  assert.match(못읽음, /못 읽었다/);
  assert.match(못읽음, /gh 인증 끊김/, '사유가 안 나가면 다음 사람이 0건과 못 읽음을 못 가른다');
  assert.notStrictEqual(진짜0, 못읽음);
});

test('☠️ talk 규약형 — 목록이 아니라 «읽는 법»을 준다(취소선·추정값·빈 측정란)', () => {
  const d = 이름있는저장소('SYNK-talk', {
    'README.md': '# t\n\n## 다음 관문 (순서대로)\n\n1. ~~끝난 것~~ ✅\n2. 남은 것 — 학생 1명 실사용\n\n## 앱 실행\n\nnpm start\n',
  });
  저장소로(d, () => {
    assert.strictEqual(검수.이저장소표(), 'SYNK-talk', '픽스처 이름이 안 잡혔다 — 이 검사는 그때 미실행이다');
    const m = 검수.아는미완줄들();
    assert.strictEqual(m.출처.종류, '규약');
    assert.ok(!m.오류, `관문 절을 못 읽었다: ${m.오류}`);
    assert.strictEqual(m.줄들.length, 2, '「다음 관문」 절만 떼어야 한다(다음 ## 앞까지)');

    const b = 검수.아는미완블록(m);
    assert.match(b, /취소선/, '해소된 것을 미완으로 읽는 «거꾸로 된 지적»을 막는 줄이 없다');
    assert.match(b, /추정값/, '주석이 스스로 밝힌 추정값 — 08-31 지적 be7074b2 가 정확히 이것이었다');
    assert.match(b, /빈 측정란|빈 표/, '08-31 지적 2ef9c6fb 가 정확히 이것이었다');
    assert.match(b, /학생 1명 실사용/, '큐레이션된 관문이 안 실렸다');
    assert.match(b, /실제로 깨뜨린 것/, '면죄부가 되면 안 된다');
    assert.doesNotMatch(b, /gh pr list/, '이 저장소는 PR 을 안 쓴다 — 따를 수 없는 처방을 주면 안 된다(F103)');
  });
});

test('🔴 재료 표가 낡으면 **크게 운다** — 관문 절이 사라지면 조용한 0건이 아니라 오류다', () => {
  const d = 이름있는저장소('SYNK-talk', { 'README.md': '# t\n\n## 딴 절\n\n아무것도 없다\n' });
  저장소로(d, () => {
    const m = 검수.아는미완줄들();
    assert.ok(m.오류, '절을 못 찾았는데 오류가 없다 — 이 표는 talk 이 바뀌는 날 조용히 낡는다');
    assert.match(m.오류, /낡았다/);
    assert.notStrictEqual(검수.아는미완블록(m), '', '못 읽었으면 그 사실이라도 말해야 한다');
  });
});

test('🔑 장부가 «어느 자로 쟀나»를 적는다 — 옛 칸 이름 `열린PR전체` 가 분모를 거짓말했다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'codex-review.js'), 'utf8');
  const i = src.indexOf('아는미완: 미완 ?');
  assert.notStrictEqual(i, -1, '장부 칸을 못 찾았다 — 이 검사는 그때 「통과」가 아니라 미실행이다');
  const 몸 = src.slice(i, i + 400);
  assert.match(몸, /출처:/, '어느 출처로 쟀는지 안 적으면 talk 의 0 이 「열린 PR 0개」로 읽힌다');
  assert.doesNotMatch(몸, /열린PR전체/, '한 값에 이름이 둘이면 갈린다 — 옛 이름이 되살아났다');
});
