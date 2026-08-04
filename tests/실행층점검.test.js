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

// ── 실저장소 (거짓양성만) ──────────────────────────────────────────────────

test('실저장소에서 실행층 무관 커밋은 조용하다', () => {
  const r = 점검.훑기({ range: 'HEAD~1..HEAD' });
  assert.equal(r.잰것, true, `실저장소 범위를 못 읽었다: ${r.기준}`);
  // 항목이 있을 수도 없을 수도 있다(무엇을 커밋했느냐에 달렸다) — 여기서 재는 건 **읽히는가**다
  assert.ok(Array.isArray(r.항목));
});

test('🔴 한글 경로가 이스케이프돼 조용히 빠지지 않는다', () => {
  /* 실측: `git diff --name-only` 가 기본 설정에서 `엔진_폼리포트.js` 를 `"\354\227\224…"` 로 뱉어
   * 파일을 못 열었고, **읽기 실패가 「해당 없음」으로 보였다.** 이 저장소의 엔진 이름은 전부 한글이다. */
  const src = fs.readFileSync(path.join(ROOT, 'tools', '실행층점검.js'), 'utf8');
  assert.match(src, /core\.quotePath=false/, '경로 이스케이프를 끄지 않았다 — 한글 파일이 통째로 검사 밖으로 나간다');
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
  assert.ok(!/deny\([^)]*실행층/.test(guard), '실행층점검으로 배포를 차단한다 — 막으면 「배포 뒤 실행」이 불가능해진다');

  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-live.yml'), 'utf8');
  const 실행줄 = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n'); // YAML 주석도 산문이다
  assert.match(실행줄, /node tools\/실행층점검\.js/, '폰 배포(deploy-live)가 이 점검을 안 부른다 — clasp-guard 는 로컬 훅이라 거기엔 없다');
});
