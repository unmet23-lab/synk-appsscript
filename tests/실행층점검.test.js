/* 실행층점검 회귀 — 「배포 뒤 1회 실행」 목록이 실제로 나오는가 (F081)
 *
 * F081 의 결론은 「회귀를 더 짜라」가 아니었다 — 폼·드라이브처럼 **실행층에서만 드러나는 API** 는
 *   회귀로 못 막고 배포 뒤 1회 실행이 유일한 검증이다. 그래서 검사 대상은 「코드가 옳은가」가 아니라
 *   **「배포 시점에 그 사실을 말해 주는가」**다.
 *
 * ⚠ 탐지력은 **픽스처로** 못박는다 — 실저장소 커밋에 기대면 그 커밋이 흘러간 뒤 검사가 죽는다.
 *   실저장소에는 거짓양성만 묻는다(CLAUDE.md 가드 맹점 ②).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 점검 = require(path.join(ROOT, 'tools', '실행층점검.js'));

const 임시들 = [];
function 픽스처(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'execlayer-'));
  임시들.push(dir);
  for (const [상대, 내용] of Object.entries(파일들)) {
    const p = path.join(dir, 상대);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 내용);
  }
  return dir;
}
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 결과가 아니다 */ } } });

// ── 탐지력 (픽스처) ────────────────────────────────────────────────────────

test('🔴 F081 의 실제 모양을 잡는다 — 한글 함수 이름 + FormApp', () => {
  /* 처음 짰을 때 식별자 정규식을 `\w` 로 적어 **이 저장소에서 아무것도 못 찾았다.**
   * 함수 이름이 한글이기 때문이다(`면접URL틀보증_`). 가드는 사람이 실제로 쓰는 표기로 검사한다. */
  const dir = 픽스처({
    '엔진_폼리포트.js': [
      'function 면접URL틀보증_(ss) {',
      "  const form = FormApp.openById(fid);",
      "  const it = form.addTextItem().setTitle('학생ID');",
      '  form.moveItem(it.getIndex(), 2);',
      '}',
    ].join('\n'),
  });
  const 항목 = 점검.파일훑기(path.join(dir, '엔진_폼리포트.js'), '엔진_폼리포트.js', null);
  assert.equal(항목.length, 1, `FormApp 호출을 못 찾았다: ${JSON.stringify(항목)}`);
  assert.equal(항목[0].함수, '면접URL틀보증_', '한글 함수 이름을 못 읽었다 — `\\w` 로 짜면 이 저장소에선 전량 미탐이다');
  assert.equal(항목[0].api, 'FormApp');
});

test('실행층 API 목록 전부가 잡힌다 (하나만 알면 나머지가 조용히 샌다)', () => {
  for (const [api] of 점검.API목록) {
    const dir = 픽스처({ 'x.js': `function 배치_() {\n  ${api}.something();\n}` });
    const 항목 = 점검.파일훑기(path.join(dir, 'x.js'), 'x.js', null);
    assert.equal(항목.length, 1, `${api} 를 못 잡았다`);
    assert.equal(항목[0].함수, '배치_');
  }
});

test('🔑 주석 안의 언급은 호출이 아니다 — 안 그러면 이 도구가 자기 머리말 때문에 영원한 오탐이 된다', () => {
  const dir = 픽스처({
    'x.js': [
      '/* FormApp.openById 를 쓰던 시절의 설명 — DriveApp 도 여기 적혀 있다',
      ' * MailApp.sendEmail 도 마찬가지다. 전부 산문이다. */',
      '// ScriptApp.newTrigger 도 주석이다',
      'function 무해_() { return 1; }',
    ].join('\n'),
  });
  assert.deepEqual(점검.파일훑기(path.join(dir, 'x.js'), 'x.js', null), [], '주석 속 언급을 호출로 셌다');
});

test('🔴 바뀐 함수만 담는다 — 파일 하나 건드렸다고 전부 늘어놓으면 목록이 안 읽힌다', () => {
  const dir = 픽스처({
    'x.js': [
      'function 안바뀐_() {',        // 1
      '  FormApp.openById(a);',       // 2
      '}',                            // 3
      'function 바뀐_() {',           // 4
      '  DriveApp.getFileById(b);',   // 5
      '}',                            // 6
    ].join('\n'),
  });
  const 바뀐줄 = new Set([5]);
  const 항목 = 점검.파일훑기(path.join(dir, 'x.js'), 'x.js', 바뀐줄);
  assert.equal(항목.length, 1, `바뀐 함수만 담아야 한다: ${JSON.stringify(항목)}`);
  assert.equal(항목[0].함수, '바뀐_');
});

test('실행층 API 가 없으면 조용하다 (거짓양성이 곧 무시로 이어진다)', () => {
  const dir = 픽스처({ 'x.js': 'function 계산_() {\n  return SpreadsheetApp.getActive().getId();\n}' });
  assert.deepEqual(점검.파일훑기(path.join(dir, 'x.js'), 'x.js', null), [], '시트 API 까지 실행층으로 셌다');
  assert.equal(점검.체크리스트({ 항목: [], 잰것: true, 기준: 'x' }), '', '항목이 없는데 체크리스트가 나왔다');
});

test('🔴 못 잰 것은 「없음」이 아니라 「검사하지 않았다」로 나온다', () => {
  const 글 = 점검.체크리스트({ 항목: [], 잰것: false, 기준: '범위를 읽지 못했다' });
  assert.match(글, /검사하지 않았다/, '측정 실패가 통과와 같은 모양이다 — 그게 이 저장소가 반복해 밟은 형태다');
});

test('체크리스트에 무엇을·왜 실행해야 하는지가 다 있다', () => {
  const 글 = 점검.체크리스트({
    잰것: true, 기준: '범위 A..B',
    항목: [{ 파일: '엔진_폼리포트.js', 함수: '면접URL틀보증_', api: 'FormApp', 왜: '폼 — 오버로드', 줄: 2 }],
  });
  assert.match(글, /면접URL틀보증_/, '실행할 함수 이름이 없다');
  assert.match(글, /F081/, '근거가 없다');
  assert.match(글, /두 번 돌려/, '멱등이 수렴이 아니었다는 교훈(재실행 확인)이 빠졌다');
});

// ── 🔴 실행하라는 이름이 실행 가능한 이름인가 ([v9.184] 실측) ──────────────

test('🔴 안쪽 헬퍼가 바깥 함수 이름을 가로채지 않는다 — 실행 못 하는 이름을 주면 목록이 죽는다', () => {
  /* 실측: `systemWatchdog` 안의 변경을 보고 **`add()` 를 실행하라**고 답했다. `add` 는 그 함수
   *   안쪽 보조 함수라 Apps Script 편집기 ▶ 로 부를 수가 없다(같은 파일에 둘이라 구별도 안 된다).
   *   원인은 안쪽 선언이 구간을 열어 **바깥 함수 구간이 첫 헬퍼 직전에서 끊긴** 것이다. */
  const dir = 픽스처({
    'x.js': [
      'function 배치_() {',              // 1  ← 실행 가능한 이름은 이것뿐이다
      '  function add(ok) { return ok; }', // 2  안쪽 헬퍼
      '  const 꾸미기 = () => 1;',         // 3  안쪽 화살표
      '  DriveApp.getFileById(b);',        // 4  ← API 는 헬퍼 **뒤**에 있다
      '}',                                 // 5
    ].join('\n'),
  });
  const 항목 = 점검.파일훑기(path.join(dir, 'x.js'), 'x.js', null);
  assert.equal(항목.length, 1, `DriveApp 을 못 찾았다: ${JSON.stringify(항목)}`);
  assert.equal(항목[0].함수, '배치_',
    `안쪽 헬퍼(${항목[0].함수})로 귀속됐다 — 편집기에서 부를 수 없는 이름이라 체크리스트가 못 쓰게 된다`);
});

test('🔑 실저장소 — systemWatchdog 이 안쪽 add() 로 쪼개지지 않는다 (거짓양성)', () => {
  /* 커밋에 기대지 않는다(그 커밋이 흘러가면 검사가 죽는다) — **구간 계산 자체**를 실파일로 잰다.
   * 이 파일은 안쪽 `add` 가 두 개(정확히 이 결함이 난 자리)라 실저장소 반례로 딱 맞다. */
  const src = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');
  const 구간 = 점검.함수구간(점검.주석지우기(src).split('\n'));
  assert.ok(구간.some((f) => f.이름 === 'systemWatchdog'), '최상위 함수 systemWatchdog 을 못 찾았다');
  assert.ok(!구간.some((f) => f.이름 === 'add'), '안쪽 헬퍼 add 가 구간을 열었다 — 바깥 함수 본문을 가로챈다');
  const w = 구간.find((f) => f.이름 === 'systemWatchdog');
  const 다음 = 구간.filter((f) => f.s > w.s).sort((a, b) => a.s - b.s)[0];
  assert.ok(w.e > w.s + 20, `systemWatchdog 구간이 ${w.e - w.s}줄로 잘렸다 — 첫 헬퍼에서 끊긴 모양이다`);
  assert.ok(!다음 || 다음.s > w.s + 20, '바로 뒤에 붙은 구간이 있다(안쪽 선언이 샜다)');
});

// ── 🔴 모르는 인자를 조용히 삼키지 않는다 ([v9.184] 실측) ───────────────────

test('🔴 모르는 인자는 막는다 — 오타 하나가 배포 점검을 거짓 초록으로 만든다', () => {
  /* 실측: `--from` 이라고 잘못 줬더니 무시하고 기본값(마지막 커밋)으로 떨어졌는데
   *   화면엔 「실행층 전용 API 변경 없음」 초록 한 줄이 그대로 나왔고, 나는 그걸 믿었다. */
  assert.deepEqual(점검.인자검사(['--from', 'synk-v9.183']), ['--from', 'synk-v9.183'],
    '모르는 인자를 못 알아본다');
  assert.deepEqual(점검.인자검사(['--range', 'A..B', '--quiet']), [],
    '멀쩡한 인자를 모른다고 한다 — 거짓양성이 곧 무시로 이어진다');
  assert.deepEqual(점검.인자검사(['--files', 'a.js,b.js']), [],
    '값 플래그의 **다음 토큰은 값**인데 그것까지 인자로 셌다');
});

test('🔴 CLI 가 실제로 막는가 — 그리고 초록일 때 무엇을 쟀는지 말하는가', () => {
  /* 문구가 아니라 **실행**으로 잰다. 이 도구의 결함 둘 다 「소스엔 적혀 있는데 그 경로가 안 돈」 형태였다. */
  const 실행 = (args) => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [path.join(ROOT, 'tools', '실행층점검.js'), ...args],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) {
      /* 🔴 **실행 실패를 「막았다」로 번역하지 않는다.** 처음 이 파일은 execFileSync 를 require 하지
       *   않은 채였다 — ReferenceError 가 이 catch 로 떨어져 `{code: undefined, out: ''}` 가 됐고,
       *   바로 아래 「exit 0 이 아니다」 단언이 **통과**했다(도구를 부른 적조차 없는데 차단으로 보였다).
       *   exit code 가 아닌 것(`status` 없음 = 스폰 실패·코드 오류)은 삼키지 말고 그대로 터뜨린다. */
      if (typeof e.status !== 'number') throw e;
      return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
    }
  };

  const 오타 = 실행(['--from', 'synk-v9.183']);
  assert.notEqual(오타.code, 0, '모르는 인자인데 exit 0 이다 — 배포 로그에선 통과와 구별되지 않는다');
  assert.match(오타.out, /모르는 인자/, '무엇이 틀렸는지 안 말한다');
  assert.ok(!/변경 없음/.test(오타.out), '🔴 모르는 인자인데 「변경 없음」 초록을 냈다 — 이게 나를 속인 그 출력이다');

  // 범위를 명시했으면 자동 범위 경고가 뜨면 안 된다(거짓양성).
  // HEAD..HEAD 는 **이력이 없어도** 읽히므로 이 단언은 얕은 클론에서도 유효하다.
  const 명시 = 실행(['--range', 'HEAD..HEAD']);
  assert.match(명시.out, /변경 없음/, '빈 범위인데 조용하지 않다');
  assert.ok(!/만 봤다/.test(명시.out), '범위를 명시했는데 자동 범위 경고가 떴다');
});

// ── 실저장소 (거짓양성만) ──────────────────────────────────────────────────
/* ⚠ 아래 둘은 **저장소 이력**에 기댄다(`HEAD~1`). repo 밖 조건에 기대는 검사는 CI에서 깨지므로
 *   — 실제로 깨졌다: 얕은 클론(actions/checkout 기본 fetch-depth: 1)에는 HEAD~1 이 없어
 *   로컬은 초록인데 CI만 적색이었다 —
 *   **통과로 넘기지 않고 skip 으로 드러낸다.** 통과와 미실행이 같은 모양이면 안 된다(F044 계열).
 *   워크플로에 fetch-depth: 0 을 준 뒤로는 CI 에서도 실제로 돌아야 정상이고, skip 이 뜬다면
 *   그 사유 문자열에 git 오류 원문이 실려 나와 **원인을 스스로 말한다.** */
function 이력스킵(range) {
  const r = 점검.훑기({ range });
  return r.잰것 ? false : `저장소 이력을 못 읽어 건너뛴다(${range}) — ${r.기준}`;
}
const 이력없음 = 이력스킵('HEAD~1..HEAD');
const F081없음 = 이력스킵('26ebb2f~1..26ebb2f'); // 옛 커밋 — 얕은 클론엔 아예 없다

test('실저장소에서 실행층 무관 커밋은 조용하다', { skip: 이력없음 }, () => {
  const r = 점검.훑기({ range: 'HEAD~1..HEAD' });
  assert.equal(r.잰것, true, `실저장소 범위를 못 읽었다: ${r.기준}`);
  // 항목이 있을 수도 없을 수도 있다(무엇을 커밋했느냐에 달렸다) — 여기서 재는 건 **읽히는가**다
  assert.ok(Array.isArray(r.항목));
});

/* ⚠ 이 검사는 **실저장소의 마지막 커밋 내용에 기대지 않는다.**
 *   예전 판은 초록 경로의 문구만 알아서, 실행층 API 가 실제로 든 정상 커밋을 만나면 적색이 됐다
 *   — 도구는 옳게 동작하는데 테스트가 빨개지고, 그 적색이 배포 게이트를 막았다(2026-08-05 실측).
 *   지금은 **초록·적색 어느 쪽이든 같은 한 줄**(범위주석)이 나오는지를 본다. 탐지력은 아래 픽스처가 진다. */
test('자동 범위는 초록이든 적색이든 「무엇만 봤는지」를 밝힌다', { skip: 이력없음 }, () => {
  const r = execFileSync(process.execPath, [path.join(ROOT, 'tools', '실행층점검.js')],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(r, /HEAD~1\.\.HEAD 만 봤다/, '자동 범위인데 무엇만 봤는지를 안 밝힌다');
});

test('범위 주석은 한 곳에서 나온다 — 초록·적색이 갈라지면 회귀가 한쪽만 안다', () => {
  const 자동 = { 잰것: true, 자동범위: true, 범위: 'HEAD~1..HEAD', 기준: '직전 배포 기준점 없음', 항목: [] };
  const 명시 = { 잰것: true, 자동범위: false, 범위: 'A..B', 기준: '명시 범위(A..B)', 항목: [] };
  assert.match(점검.범위주석(자동), /HEAD~1\.\.HEAD 만 봤다/);
  assert.match(점검.범위주석(명시), /기준: 명시 범위/);
  // 적색 경로의 체크리스트가 **같은 문자열**을 싣는지 — 두 곳에 따로 적으면 여기서 갈라진다
  const 적색 = 점검.체크리스트(Object.assign({}, 자동, {
    항목: [{ 파일: 'x.js', 함수: 'f', api: 'MailApp', 왜: '메일 발송' }],
  }));
  assert.ok(적색.includes(점검.범위주석(자동)),
    '적색 체크리스트가 초록과 다른 문구로 범위를 말한다 — 회귀가 한쪽만 알게 된다');
});

/* 실측: `git diff --name-only` 가 기본 설정에서 `엔진_폼리포트.js` 를 `"\354\227\224…"` 로 뱉어
 * 파일을 못 열었고, **읽기 실패가 「해당 없음」으로 보였다.** 이 저장소의 엔진 이름은 전부 한글이다.
 * 두 층으로 나눠 단다 — 소스 층은 이력 없이도 늘 돌고(탐지력의 본체), 실이력 층만 skip 대상이다. */
test('🔴 한글 경로가 이스케이프돼 조용히 빠지지 않는다 (소스)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', '실행층점검.js'), 'utf8');
  assert.match(src, /core\.quotePath=false/, '경로 이스케이프를 끄지 않았다 — 한글 파일이 통째로 검사 밖으로 나간다');
});

test('🔴 한글 경로의 엔진 파일이 실제 커밋에서 잡힌다 (F081)', { skip: F081없음 }, () => {
  const r = 점검.훑기({ range: '26ebb2f~1..26ebb2f' }); // F081 이 난 커밋
  assert.ok(r.항목.some((it) => /엔진_폼리포트\.js$/.test(it.파일)),
    'F081 이 난 커밋에서 한글 경로의 엔진 파일을 못 봤다 — 이스케이프 때문에 미탐이다');
});

// ── 발동 조건 (장치가 스스로 안 울면 안 돈다) ───────────────────────────────

test('🔴 배포 통로 **둘 다** 이 점검을 부른다 — 한쪽만 달면 느슨한 쪽이 실질 정책이 된다', () => {
  /* ⚠ **주석을 지우고 본다.** 처음엔 그냥 `/실행층점검/` 으로 물었는데, 호출을 스텁으로 바꾼
   *   변이를 놓쳤다 — 바로 위 주석에 그 이름이 적혀 있어 검사가 산문을 보고 통과했다.
   *   F087 이 지적한 그 형태(문자열 존재만 보고 동작을 안 잼)라 실제 호출을 본다. */
  const guard = 점검.주석지우기(fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'clasp-guard.js'), 'utf8'));
  assert.match(guard, /require\([^)]*실행층점검/, '로컬 배포 게이트(clasp-guard)가 이 점검을 require 하지 않는다');
  assert.match(guard, /\.체크리스트\(/, 'require 만 하고 체크리스트를 안 만든다 — 부른 적 없는 것과 같다');
  assert.match(guard, /systemMessage/, '만들어 놓고 아무에게도 안 보여준다');
  assert.match(guard, /describe[\s\S]{0,80}--match[\s\S]{0,20}synk-v/, '기준점(직전 버전 태그)을 안 잡는다 — 범위가 없으면 마지막 커밋만 본다');
  /* ⚠ `guard` 는 **이미 공용 통로를 지났다** — `주석지우기` 는 `tests/lib/소스검사.js` 의
   *   `줄맞춰코드만` 을 별칭으로 받아 다시 내보낸 것이다(`tools/실행층점검.js:57`). 또 감싸지 않는다.
   *   🔴 계수기(`가드계수.js`)는 **별칭 import 를 못 본다** — 그래서 이 자리를 「위험」으로 센다.
   *      정제가 빠진 게 아니라 계수기의 눈이 비었다(같은 병의 5차 · 대기열 #Q72 ⑨에 넘긴다). */
  assert.ok(!/deny\([^)]*실행층/.test(guard), '실행층점검으로 배포를 차단한다 — 막으면 「배포 뒤 실행」이 불가능해진다');

  /* 옛 둘째 발화 자리(`deploy-live` 워크플로)는 2026-08-12 에 폐지됐다 — 배포 통로가 하나로
   * 줄었으니 발화 자리도 하나다. ⚠ 통로가 다시 늘면 **그 통로에도 이 점검을 붙여야 한다**:
   * 발화 자리를 안 붙인 통로는 「배포는 됐는데 실행층은 아무도 안 본」 상태로 조용히 지나간다. */
  const 통로 = fs.existsSync(path.join(ROOT, '.github', 'workflows'))
    ? fs.readdirSync(path.join(ROOT, '.github', 'workflows'))
    : [];
  assert.ok(!통로.includes('deploy-live.yml'),
    '폰 배포 통로가 되살아났다 — 되살릴 거면 그 워크플로에도 `node tools/실행층점검.js` 를 붙여라');
});
