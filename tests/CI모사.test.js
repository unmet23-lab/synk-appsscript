/**
 * tools/test-ci.js 회귀 — **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 옆 세션이
 *   Code.js·HTML 을 편집하면 테스트가 중간 상태를 읽고 빨간불이 된다. 그 적색은
 *   진짜 적색과 모양이 완전히 같아서, 실제로 그걸 보고 **남의 살아있는 작업본
 *   (Code.js ← 931bae1e 세션)을 고치러 갈 뻔했다.** 재실행하니 둘 다 초록이었다.
 *
 * ⚠ 이 파일의 탐지력 한계: 스위트 전체를 돌리는 스크립트라 실동작 재현이 비싸서
 *   **비교 로직만 격리해 검사**하고, 배선(전후 스냅샷·경고 출력)은 소스로 본다.
 *   즉 「경고를 지웠다」는 잡지만 「비교가 미묘하게 틀렸다」는 아래 격리 검사가 진다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 파일소스, 코드만 } = require('./lib/소스검사');

const ROOT = path.resolve(__dirname, '..');
/* 🔑 `파일소스()` 로 읽는다 — 읽으면서 줄끝 표기를 접는다(#Q101 · 2026-08-17).
 *   그전엔 원문 그대로 읽고 앵커 쪽에서 `\r?\n` 으로 CRLF 만 받아냈다. 형제 축(줄 끝 공백)은
 *   열려 있어서, 행동을 한 글자도 안 바꾸는 변형에 아래 두 시험이 **실측으로** 빨개졌다.
 *   접기는 이제 이음매가 진다 — 여기 손 접기를 다시 적으면 그게 곧 사본이다. */
const SRC = 파일소스(path.join(ROOT, 'tools', 'test-ci.js'));

/** test-ci.js 의 비교 로직을 그 소스에서 **꺼내 와** 돌린다(베껴 쓰면 같이 눈이 먼다). */
function movedFrom(src, before, after) {
  const body = src.match(/const moved = \[\];\n([\s\S]*?)\nif \(code !== 0/);
  assert.ok(body, 'test-ci.js 에서 변화 비교 블록을 못 찾았다 — 구조가 바뀌었으면 이 회귀도 갱신하라');
  const moved = [];
  new Function('moved', 'before', 'after', body[1])(moved, before, after);
  return moved;
}

test('🔑 도는 동안 바뀐 파일을 잡는다 — 수정도 삭제도', () => {
  const before = new Map([['Code.js', '100:5'], ['docs/a.md', '200:9'], ['tests/b.js', '300:1']]);
  const after = new Map([['Code.js', '999:7'], ['tests/b.js', '300:1'], ['새파일.js', '400:2']]);
  const moved = movedFrom(SRC, before, after);

  assert.ok(moved.some((m) => m.startsWith('Code.js')), '내용이 바뀐 파일을 못 잡았다 — 거짓 적색이 진짜처럼 보인다');
  assert.ok(moved.some((m) => m.startsWith('docs/a.md')), '사라진 파일을 못 잡았다');
  assert.ok(!moved.some((m) => m.startsWith('tests/b.js')), '안 바뀐 파일을 바뀌었다고 했다 — 매번 경고면 경고가 죽는다');
  // 새로 **생긴** 파일은 셀 필요가 없다 — 테스트가 읽던 대상이 아니었다(스위트 자신의 산출물이 섞인다)
  assert.ok(!moved.some((m) => m.startsWith('새파일.js')), '새로 생긴 파일까지 셌다 — 거짓 경고가 는다');
});

test('🔑 변화가 없으면 조용하다 (거짓양성 0)', () => {
  const same = new Map([['Code.js', '100:5'], ['docs/a.md', '200:9']]);
  assert.deepStrictEqual(movedFrom(SRC, same, new Map(same)), [], '아무것도 안 바뀌었는데 경고 대상이 생겼다');
});

test('배선 — 실행 전후로 스냅샷을 찍고, 적색일 때만 경고한다', () => {
  assert.match(SRC, /const before = snapshot\(\)[\s\S]{0,400}spawnSync[\s\S]{0,200}const after = snapshot\(\)/,
    '실행 **전후**로 스냅샷을 안 찍는다 — 한쪽만 찍으면 비교가 성립하지 않는다');
  assert.match(SRC, /if \(code !== 0 && moved\.length\)/,
    '초록일 때도 경고하거나, 적색인데 변화를 안 본다');
  assert.match(SRC, /이 적색은 못 믿는다/, '거짓 적색이라는 표시가 사라졌다 — 진짜와 구별이 안 된다');
  assert.match(SRC, /재실행하라/, '무엇을 하라는 지시가 없다 — 경고만 있으면 또 고치러 간다');
  assert.match(SRC, /작업본소유자/, '누구 파일인지 가르는 도구를 안 알려준다(F073)');
});

test('스냅샷 대상이 테스트가 읽는 곳을 덮는다 — 루트·tests·tools·docs·.claude', () => {
  // 실측된 거짓 적색 2회의 진원지가 **Code.js(루트)** 와 **docs/ 아래 HTML** 이었다.
  const walk = SRC.match(/walk\(ROOT, 0\);\s*for \(const d of \[([^\]]*)\]\)/);
  assert.ok(walk, '스냅샷 대상 목록을 못 찾았다');
  for (const d of ['tests', 'tools', 'docs', '.claude']) {
    assert.ok(walk[1].includes(`'${d}'`), `스냅샷이 ${d} 를 안 본다`);
  }
  assert.match(SRC, /\.\(js\|json\|md\|html\|txt\)\$/i, '확장자 목록이 좁아졌다 — html 이 빠지면 실측된 거짓 적색을 놓친다');
});

/* ── ③ 플랫폼 축 — 모사가 **못 지우는** 차이 (마찰 F620 · 2026-08-18) ────────────────
 *
 * ■ 실사고: 리눅스 클라우드 세션이 `test-ci` 를 돌리자 fail 3 이 났고, 셋 다 윈도우에서는
 *   **초록**이던 것이다. 그런데 이 도구의 머리말은 지우는 축을 ①시간대 ②홈 둘로 못박아 놓고
 *   「초록이면 CI 도 초록」이라고 **단언**했다 — 플랫폼은 그 목록에 없다.
 *   즉 **재지 않은 축에 대한 주장**이고(F474·F608 과 같은 병), 새는 방향은 「통과」다.
 *
 * ■ 지울 수 없는 축은 **이름 대고 말하는 것**이 유일한 처방이다. 그래서 여기서 재는 것은
 *   「플랫폼이 같은가」가 아니라 **「같다/다르다/모른다 셋이 문장에서 갈리는가」**다 —
 *   셋이 같은 문장이면 이 축은 없는 것과 같다.
 *
 * ■ 왜 픽스처가 지나: 이 검사가 도는 판은 그날 하나뿐이라(이 기계의 OS 하나) 실행 환경으로는
 *   세 갈래 중 한 갈래밖에 못 잰다. 실환경에는 거짓양성 불변식만 건다. */

const 모사환경 = require(path.join(ROOT, 'tools', 'lib', 'ci모사환경.js'));

test('☠️ 러너 라벨 → 판 — 모르는 라벨을 **추측하지 않는다**(추측하면 「같다」가 거짓으로 선다)', () => {
  assert.strictEqual(모사환경.러너판('ubuntu-latest'), 'linux');
  assert.strictEqual(모사환경.러너판('windows-2022'), 'win32');
  assert.strictEqual(모사환경.러너판('macos-14'), 'darwin');
  for (const 모름 of ['self-hosted', '${{ matrix.os }}', '', null, '처음보는라벨']) {
    assert.strictEqual(모사환경.러너판(모름), null, `모르는 라벨을 판으로 단정했다: ${모름}`);
  }
});

/** 임시 워크플로 폴더 — 실저장소의 `.github` 는 하나뿐이라 갈래를 연출할 수 없다. */
function 워크트리픽스처(파일들) {
  const 뿌리 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'synk-ci판-'));
  const dir = path.join(뿌리, '.github', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  for (const [이름, 본문] of Object.entries(파일들 || {})) fs.writeFileSync(path.join(dir, 이름), 본문, 'utf8');
  return 뿌리;
}

test('☠️ CI판 — 유일하면 그 판, 갈리거나 못 읽으면 **null(모름)**. 「없음」을 「같음」으로 접지 않는다', () => {
  const 하나 = 모사환경.CI판(워크트리픽스처({ 'a.yml': 'jobs:\n  t:\n    runs-on: ubuntu-latest\n' }));
  assert.strictEqual(하나.판, 'linux');
  assert.deepStrictEqual(하나.라벨들, ['ubuntu-latest']);

  const 갈림 = 모사환경.CI판(워크트리픽스처({
    'a.yml': 'jobs:\n  t:\n    runs-on: ubuntu-latest\n',
    'b.yaml': 'jobs:\n  t:\n    runs-on: windows-latest\n',
  }));
  assert.strictEqual(갈림.판, null, '🔴 OS 가 갈린 판을 하나로 접었다 — 그 순간 「같다」가 절반만 참인 말이 된다');
  assert.match(갈림.사유, /다르다/);

  assert.strictEqual(모사환경.CI판(워크트리픽스처({})).판, null, '워크플로 0건을 판으로 단정했다');
  assert.strictEqual(모사환경.CI판(워크트리픽스처({ 'a.yml': 'jobs:\n  t:\n    steps: []\n' })).판, null,
    '`runs-on:` 이 없는데 판을 단정했다');
  assert.strictEqual(모사환경.CI판(path.join(ROOT, '없는폴더-xyz')).판, null, '폴더가 없는데 판을 단정했다');
});

test('☠️ [F620 급소] 플랫폼줄이 **세 갈래를 다르게** 낸다 — 셋이 같으면 이 축은 없는 것과 같다', () => {
  const 리 = { 판: 'linux', 라벨들: ['ubuntu-latest'], 파일수: 1 };
  const 셋 = [
    모사환경.플랫폼줄('linux', 리),                                           // 같다
    모사환경.플랫폼줄('win32', 리),                                           // 다르다
    모사환경.플랫폼줄('win32', { 판: null, 라벨들: [], 사유: '워크플로 파일이 0건이다' }), // 모른다
  ];
  assert.strictEqual(new Set(셋).size, 3, `갈래가 문장에서 안 갈렸다:\n${셋.join('')}`);
  assert.match(셋[0], /같다.*linux/, '같은 판인데 그 사실을 안 적으면 재진 축이 안 보인다');
  assert.match(셋[1], /win32[\s\S]*CI 는 linux/, '어느 판에서 재고 어느 판을 못 쟀는지 이름을 대야 한다');
  assert.match(셋[1], /원리상 안 보인다/, '🔴 다른 판인데 한계를 안 적었다 — 그게 F620 의 거짓 보증이다');
  assert.match(셋[2], /모른다/, '못 읽은 것을 「같다」로도 「다르다」로도 접지 않는다(F207)');
  /* ⚠ 「같다」라는 **낱말**로 재면 자기 설명(「같다」로 접지 않는다)에 걸린다 — 가드는 자기
   *   전처리에도 눈이 먼다(CLAUDE.md 맹점). 재는 것은 낱말이 아니라 **판정 문구**다. */
  assert.doesNotMatch(셋[2], /플랫폼은 CI 와 \*\*같다\*\*/,
    '🔴 모름이 「같다」 판정으로 샜다 — 새는 방향은 언제나 통과다');
});

test('☠️ [F620 배선] test-ci 가 플랫폼 줄을 **실제로 낸다** — 순수 함수만 세우고 안 부르면 장치는 안 돈다', () => {
  const 코드 = 코드만(SRC);
  assert.match(코드, /모사환경\.플랫폼줄\(/, '🔴 플랫폼 줄을 안 부른다 — 지울 수 없는 축이 다시 침묵한다(F620)');
  assert.match(코드, /모사환경\.CI판\(/, 'CI 판을 안 읽으면 견줄 대상이 없다');
  assert.match(코드, /plat=\$\{process\.platform\}/, '머리 줄이 어느 판에서 재는지 안 밝힌다');
  /* 🔑 판정과 분모는 **함께 다닌다** — 초록에만 달면 「내 적색이 저쪽 판에도 나는가」를 못 가른다. */
  const i = 코드.indexOf('모사환경.플랫폼줄(');
  const j = 코드.indexOf('console.log(code === 0');
  assert.ok(i > 0 && j > i, '🔴 플랫폼 줄이 초록/적색 판정보다 뒤에 있다 — 적색 판에서는 분모가 안 붙는다');
});

test('☠️ 실저장소 거짓양성 — 이 저장소의 CI 판은 실제로 읽히고, 갈래 이름이 아는 것 중 하나다', () => {
  const ci = 모사환경.CI판(ROOT);
  assert.ok(ci.파일수 > 0, '워크플로가 0건이다 — 이 저장소에 CI 가 있는데 못 읽었다면 그게 결함이다');
  if (ci.판 === null) return;   // 갈린 판은 위 픽스처가 진다
  assert.ok(['linux', 'win32', 'darwin'].includes(ci.판), `모르는 판: ${ci.판}`);
});
