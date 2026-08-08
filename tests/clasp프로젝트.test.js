/* clasp 프로젝트 판별 회귀 — 가드가 「어느 프로젝트를 배포하는가」를 틀리면 통째로 헛돈다(F061).
 *
 * 왜 있나: 이 저장소에는 clasp 프로젝트가 둘이다(루트 · crewcard/). 가드가 항상 ROOT 로 검사해서
 *   ① 크루카드 배포가 메인의 무관한 미커밋·빨간 테스트에 막혔고(오탐 — 유호님이 신고한 쪽)
 *   ② 크루카드 코드는 보안 검사를 한 줄도 안 받았다(미탐 — 조용해서 아무도 신고하지 않은 쪽)
 *
 * 🔑 오판정의 두 방향이 **비대칭**이라 양쪽을 따로 검사한다:
 *     메인인데 서브로 봄  → 메인 검사가 통째로 안 돈다(위험)
 *     서브인데 메인으로 봄 → 기존 동작(안전)
 *   그래서 「못 찾으면 root」가 규칙이고, 그 폴백이 살아 있는지도 검사 대상이다.
 *
 * 탐지 능력은 **픽스처**로 못박고(실저장소가 바뀌어도 안 흔들린다), 실저장소에는 거짓양성만 본다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
// SYNK_TEST_CLASP_LIB = 변이 실험용 이음매. 평소엔 실모듈을 본다(실저장소를 흔들지 않고 탐지력만 잰다).
const lib = require(process.env.SYNK_TEST_CLASP_LIB
  || path.join(REPO, '.claude', 'hooks', 'lib', 'clasp-project.js'));

/* 픽스처 = 프로젝트 둘짜리 가짜 저장소.
 *   <root>/.clasp.json + .claspignore(!appsscript.json !Code.js)
 *   <root>/sub/.clasp.json  (.claspignore 없음 — crewcard 와 같은 형태)
 *   <root>/tests/…                                                          */
const FX = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-proj-'));
fs.writeFileSync(path.join(FX, '.clasp.json'), '{}');
fs.writeFileSync(path.join(FX, '.claspignore'), '**/**\n!appsscript.json\n!Code.js\n!엔진_수집.js\n');
fs.mkdirSync(path.join(FX, 'sub'));
fs.writeFileSync(path.join(FX, 'sub', '.clasp.json'), '{}');
fs.mkdirSync(path.join(FX, 'tests'));
fs.writeFileSync(path.join(FX, 'tests', '가.test.js'), "read('sub/카드.js')");
fs.writeFileSync(path.join(FX, 'tests', '나.test.js'), "read('Code.js')");
fs.mkdirSync(path.join(FX, '외딴'));
test.after(() => { try { fs.rmSync(FX, { recursive: true, force: true }); } catch (_) {} });

const SUB = path.join(FX, 'sub');
const 판별 = (cmd, cwd = FX) => lib.resolveProject(cmd, cwd, FX);

// ── 판별 ────────────────────────────────────────────────────────────────────

test('cd 로 옮겨간 서브 프로젝트를 알아본다 (cwd 만 보면 영원히 메인이다)', () => {
  assert.strictEqual(판별('cd sub && clasp push'), SUB);
  assert.strictEqual(판별('cd sub; clasp push'), SUB);
  assert.strictEqual(판별('Set-Location sub; clasp push'), SUB);
  assert.strictEqual(판별('cd "sub" && clasp push'), SUB);
});

test('cwd 자체가 서브 프로젝트여도 알아본다', () => {
  assert.strictEqual(판별('clasp push', SUB), SUB);
});

test('루트 배포는 루트로 남는다 (기존 동작이 안 바뀐다)', () => {
  assert.strictEqual(판별('clasp push'), FX);
  assert.strictEqual(판별('clasp deploy -d x'), FX);
});

test('clasp 뒤의 cd 는 배포와 무관하다', () => {
  // 배포가 먼저 돌고 그 다음 디렉터리를 옮기는 형태 — 대상은 여전히 루트다
  assert.strictEqual(판별('clasp push && cd sub'), FX);
});

test('되돌아온 cd 를 반영한다', () => {
  assert.strictEqual(판별('cd sub && cd .. && clasp push'), FX);
});

test('커밋 메시지 안에 적힌 cd 에는 안 속는다 (실행되는 명령만 본다)', () => {
  // 문장은 세그먼트로 쪼개도 `^cd …$` 가 아니므로 무시돼야 한다
  assert.strictEqual(판별('git commit -m "cd sub 로 옮겨 배포한다" && clasp push'), FX);
});

test('.clasp.json 이 없는 곳으로 가면 조상에서 찾고, 없으면 root 로 떨어진다', () => {
  // 폴백은 언제나 '더 많이 검사하는' 쪽 — 서브로 잘못 보면 메인 검사가 통째로 안 돈다
  assert.strictEqual(판별('cd 외딴 && clasp push'), FX);
  assert.strictEqual(판별('cd 없는디렉터리 && clasp push'), FX);
});

// ── 배포 대상 매칭 ──────────────────────────────────────────────────────────

test('서브 프로젝트는 접두사를 떼고 매칭한다 (이걸 빠뜨리면 전부 통과가 된다)', () => {
  // 글롭의 * 는 [^/]* 라 디렉터리를 건너지 않는다 → 접두사를 안 떼면 sub/카드.js 가 *.js 에 안 걸린다
  assert.strictEqual(lib.isDeployFile('sub/카드.js', SUB, FX), true);
  assert.strictEqual(lib.isDeployFile('sub/카드_kr.html', SUB, FX), true, 'html 이 빠지면 화면이 미커밋인 채 나간다');
  assert.strictEqual(lib.isDeployFile('sub/appsscript.json', SUB, FX), true);
});

test('서브 프로젝트는 저장소의 다른 파일을 자기 것으로 세지 않는다 (F061 의 오탐)', () => {
  assert.strictEqual(lib.isDeployFile('엔진_수집.js', SUB, FX), false);
  assert.strictEqual(lib.isDeployFile('Code.js', SUB, FX), false);
  assert.strictEqual(lib.isDeployFile('docs/아무거나.md', SUB, FX), false);
});

test('루트 프로젝트는 .claspignore 허용목록을 따르고, 하위 디렉터리는 자기 것이 아니다', () => {
  assert.strictEqual(lib.isDeployFile('Code.js', FX, FX), true);
  assert.strictEqual(lib.isDeployFile('엔진_수집.js', FX, FX), true);
  assert.strictEqual(lib.isDeployFile('sub/카드.js', FX, FX), false, '서브 프로젝트 파일이 루트 배포에 잡혔다');
  assert.strictEqual(lib.isDeployFile('없는파일.txt', FX, FX), false);
});

// ── 테스트 고르기 (미탐 방향이라 0건이 특히 위험하다) ───────────────────────

test('서브 프로젝트는 그 프로젝트를 읽는 테스트만 고른다', () => {
  const got = lib.testsFor(SUB, FX);
  assert.deepStrictEqual(got, ['가.test.js'], '고르기가 어긋났다');
});

test('루트 프로젝트는 전부 돈다 (좁힐 근거가 없다)', () => {
  assert.deepStrictEqual(lib.testsFor(FX, FX).sort(), ['가.test.js', '나.test.js']);
});

test('참조가 없으면 0건을 돌려준다 — 호출부가 이걸 「통과」로 읽으면 무검증 배포다', () => {
  const 고아 = path.join(FX, '고아');
  fs.mkdirSync(고아, { recursive: true });
  fs.writeFileSync(path.join(고아, '.clasp.json'), '{}');
  assert.deepStrictEqual(lib.testsFor(고아, FX), [],
    '0건이 나와야 호출부가 차단할 수 있다(F047 「목록이 조용히 비어도 초록」)');
});

// ── 보안 검사가 프로젝트를 따라간다 (F061 의 미탐 쪽) ───────────────────────

test('checkCode 는 지정한 프로젝트의 파일을 본다 (인자를 무시하면 크루카드는 영원히 무검사다)', () => {
  const sec = require(path.join(REPO, 'tools', 'deploy-security-check.js'));
  // 서브 프로젝트에만 위반을 심는다 — ROOT 고정이면 이걸 절대 못 본다
  fs.writeFileSync(path.join(SUB, '나쁜.js'),
    'function doGet(e){ if (e.parameter.key === "Xk7Qm2Vt9RbLpZa4wNc0") { SpreadsheetApp.getActive().deleteRow(1); } }\n');
  const 문제 = sec.checkCode(SUB);
  assert.ok(문제.length >= 2, `서브 프로젝트 코드를 안 봤다(문제 ${문제.length}건)`);
  assert.ok(문제.some((p) => /고정 토큰/.test(p)), '고정 토큰을 못 잡았다');
  assert.ok(문제.some((p) => /doGet/.test(p)), 'doGet 파괴 연산을 못 잡았다');
  fs.unlinkSync(path.join(SUB, '나쁜.js'));
});

test('기본 인자는 저장소 루트다 (기존 호출부 /deploy·CLI 가 안 깨진다)', () => {
  const sec = require(path.join(REPO, 'tools', 'deploy-security-check.js'));
  assert.deepStrictEqual(sec.checkCode(), sec.checkCode(REPO), '인자 없는 호출이 루트와 달라졌다');
});

// ── 실저장소 (거짓양성만 — 구조가 바뀌면 skip 으로 드러난다) ────────────────

test('실저장소: crewcard 가 별도 프로젝트로 인식되고 회귀도 붙어 있다', (t) => {
  if (!fs.existsSync(path.join(REPO, 'crewcard', '.clasp.json'))) {
    return t.skip('crewcard/.clasp.json 없음 — 이 검사는 실저장소에서만 돈다');
  }
  const proj = lib.resolveProject('cd crewcard && clasp push', REPO, REPO);
  assert.strictEqual(path.resolve(proj), path.resolve(REPO, 'crewcard'));

  const tests = lib.testsFor(proj, REPO);
  assert.ok(tests.length > 0,
    'crewcard 를 검사하는 테스트가 0건 — 가드가 차단하므로 배포 자체가 막힌다(회귀를 두거나 BYPASS)');

  // 오탐 쪽: 메인 엔진 파일이 크루카드 배포 대상으로 잡히면 F061 재발이다
  assert.strictEqual(lib.isDeployFile('엔진_수집.js', proj, REPO), false);
  assert.strictEqual(lib.isDeployFile('Code.js', proj, REPO), false);
});

test('실저장소: 프로젝트 열거가 둘 다 찾는다', (t) => {
  const sec = require(path.join(REPO, 'tools', 'deploy-security-check.js'));
  const projs = sec.claspProjects().map((p) => path.relative(REPO, p) || '(루트)');
  if (!projs.includes('crewcard')) return t.skip('crewcard 프로젝트 없음');
  assert.ok(projs.includes('(루트)'), '루트 프로젝트를 못 찾았다');
  assert.ok(projs.length >= 2, `프로젝트를 ${projs.length}개만 찾았다 — 하나만 보고 통과라 하면 미탐이다`);
});

/* ─── 원격초록 — 「배포 게이트가 무엇을 재는가」 (F240 축 B) ────────────────────────────
 * 새는 방향이 비대칭이다: 못 쟀는데 초록이라 하면 **미검증 배포**고, 초록인데 못 쟀다 하면
 * 오늘까지의 동작(작업본 전체 실행)이다. 그래서 「모름」은 전부 false 쪽으로 떨어져야 한다. */

const 가짜실행 = (r) => () => r;

test('원격 CI 가 이 HEAD 를 통과시켰으면 초록 — 판정은 첫 줄에서 읽는다', () => {
  const r = lib.원격초록(REPO, 가짜실행({ status: 0, stdout: '[원격ci] ✅ 초록 — abc1234 를 담은 run 1 통과\n' }));
  assert.strictEqual(r.초록, true);
  assert.match(r.출력, /초록/);
});

test('원격이 적색이면 초록이 아니고, 사유(첫 줄)를 남긴다 — 처방 줄을 집으면 사유가 사라진다', () => {
  const r = lib.원격초록(REPO, 가짜실행({
    status: 1,
    stdout: '[원격ci] 적색 — abc1234 를 담은 run 9 가 failure\n   -> gh run view 9 --log-failed\n',
  }));
  assert.strictEqual(r.초록, false);
  assert.match(r.출력, /적색/);
  assert.doesNotMatch(r.출력, /gh run view/, '마지막 줄(처방)을 집으면 무엇이 틀렸는지가 사라진다');
});

test('🔴 미검증도 초록이 아니다 — run 0건은 「아직 안 돎」이지 통과가 아니다', () => {
  const r = lib.원격초록(REPO, 가짜실행({ status: 1, stdout: '[원격ci] 원격 미검증 — run 이 0건이다\n' }));
  assert.strictEqual(r.초록, false);
});

test('🔴 gh 를 못 돌리면(폰 클라우드·인증 만료) 초록이 아니라 「모름」 — 던져도 통과가 아니다', () => {
  const r = lib.원격초록(REPO, () => { throw new Error('spawn gh ENOENT'); });
  assert.strictEqual(r.초록, false);
  assert.match(r.출력, /ENOENT/);
});

test('🔴 타임아웃(status null·SIGTERM)도 초록이 아니다 — 네트워크가 멎으면 게이트가 통째로 샌다', () => {
  const r = lib.원격초록(REPO, 가짜실행({ status: null, signal: 'SIGTERM', stdout: '' }));
  assert.strictEqual(r.초록, false);
});

test('🔴 실행 결과가 통째로 없어도 초록이 아니다', () => {
  assert.strictEqual(lib.원격초록(REPO, () => null).초록, false);
  assert.strictEqual(lib.원격초록(REPO, () => undefined).초록, false);
});

test('실저장소: 부르는 대상이 실재하는 tools/원격ci.js 다 — 경로가 어긋나면 영원히 false 로 조용히 옛 동작', () => {
  let 받은 = null;
  lib.원격초록(REPO, (bin, args) => { 받은 = { bin, args }; return { status: 1, stdout: '' }; });
  assert.strictEqual(받은.bin, process.execPath);
  assert.strictEqual(받은.args.length, 1, '인자를 더 넘기면 원격ci 가 그걸 대상 커밋으로 읽는다');
  assert.ok(fs.existsSync(받은.args[0]), `부르는 파일이 없다: ${받은.args[0]}`);
  assert.match(받은.args[0].replace(/\\/g, '/'), /tools\/원격ci\.js$/);
});
