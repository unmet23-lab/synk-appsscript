/**
 * tools/test-ci.js 회귀 — **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 옆 세션이
 *   Code.js·HTML 을 편집하면 테스트가 중간 상태를 읽고 빨간불이 된다. 그 적색은
 *   진짜 적색과 모양이 완전히 같아서, 실제로 그걸 보고 **남의 살아있는 작업본
 *   (Code.js ← 931bae1e 세션)을 고치러 갈 뻔했다.** 재실행하니 둘 다 초록이었다.
 *
 * 🔴 그 장치가 반대로 샌 자리 (F616 · 2026-08-18 실측 2회 · 격리 컨테이너 = 다른 세션 0):
 *   스냅샷 키가 `mtime:size` 뿐이라 「손댔다」와 「바뀌었다」를 못 갈랐고, 이 스위트 자신이
 *   제자리에서 다시 굽는 산출물 둘(`docs/이해대장.html`·`docs/교재_읽기본/권1.html`)이
 *   **「옆 세션이 편집 중」**으로 나갔다. 그 둘은 거의 모든 전체 런에 끼므로 적색이면 사실상 항상
 *   「이 적색은 못 믿는다」가 함께 떴다 — 새는 방향이 통과가 아니라 **「빨간 것을 안 믿게 만든다」**다.
 *   처방도 따를 수 없었다(F103): 「누구 파일인지는 `작업본소유자.js`」인데 그 목록엔 아무도 없다.
 *
 * ⚠ 이 파일의 탐지력 한계: 스위트 전체를 돌리는 스크립트라 실동작 재현이 비싸서
 *   **판정 함수를 직접 불러** 검사하고, 배선(전후 스냅샷·경고 발화)은 소스로 본다.
 * 🔑 옛 판은 판정 블록을 소스에서 **정규식으로 긁어** `new Function` 으로 돌렸다. 구조를 바꾸면
 *   그 긁기가 조용히 「못 찾음」이 되고 새는 방향은 통과다 — 그래서 `test-ci.js` 가 판정을
 *   내보내게 하고 여기서 **실물을 부른다**(F543 계보 · 판정을 순수 함수로 뗀다).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { 파일소스, 코드만 } = require('./lib/소스검사');

const ROOT = path.resolve(__dirname, '..');
/* 🔑 `파일소스()` 로 읽는다 — 읽으면서 줄끝 표기를 접는다(#Q101 · 2026-08-17).
 *   그전엔 원문 그대로 읽고 앵커 쪽에서 `\r?\n` 으로 CRLF 만 받아냈다. 형제 축(줄 끝 공백)은
 *   열려 있어서, 행동을 한 글자도 안 바꾸는 변형에 아래 두 시험이 **실측으로** 빨개졌다.
 *   접기는 이제 이음매가 진다 — 여기 손 접기를 다시 적으면 그게 곧 사본이다. */
const SRC = 파일소스(path.join(ROOT, 'tools', 'test-ci.js'));
const { snapshot, 판정, 알림줄들 } = require('../tools/test-ci.js');

/** 스냅샷 항목 한 칸 — 도장(mtime:size)과 내용 해시. */
const 칸 = (도장, 내용) => ({ 도장, 해시: 내용 === null ? null : crypto.createHash('sha1').update(String(내용)).digest('hex') });

// ── ① 판정 (픽스처가 탐지력을 진다) ──────────────────────────────────────────

test('🔑 도는 동안 «내용이» 바뀐 파일을 잡는다 — 수정도 삭제도', () => {
  const before = new Map([['Code.js', 칸('100:5', 'A')], ['docs/a.md', 칸('200:9', 'B')], ['tests/b.js', 칸('300:1', 'C')]]);
  const after = new Map([['Code.js', 칸('999:7', 'A2')], ['tests/b.js', 칸('300:1', 'C')], ['새파일.js', 칸('400:2', 'D')]]);
  const r = 판정(before, after);

  assert.deepStrictEqual(r.밖에서바뀜, ['Code.js'], '내용이 바뀐 파일을 못 잡았다 — 거짓 적색이 진짜처럼 보인다');
  assert.deepStrictEqual(r.사라짐, ['docs/a.md'], '사라진 파일을 못 잡았다');
  assert.deepStrictEqual(r.되돌아옴, [], '안 바뀐 파일을 어딘가에 넣었다 — 매번 경고면 경고가 죽는다');
  // 새로 **생긴** 파일은 셀 필요가 없다 — 테스트가 읽던 대상이 아니었다(스위트 자신의 산출물이 섞인다)
  assert.ok(!r.밖에서바뀜.includes('새파일.js'), '새로 생긴 파일까지 셌다 — 거짓 경고가 는다');
  assert.strictEqual(r.분모, 3, '분모를 안 낸다 — 0건 판정과 미실행을 못 가른다(F207)');
});

test('🔴 F616 — 다시 쓰였지만 «바이트가 그대로»면 «밖에서 바뀜»이 아니다', () => {
  /* 이 스위트가 제자리에서 다시 굽는 산출물의 실제 모양: mtime 은 움직이고 내용은 같다.
   * 옛 판(`mtime:size` 비교)은 이것을 「옆 세션이 편집 중」으로 냈다. */
  const before = new Map([['docs/이해대장.html', 칸('100:5', '같은내용')]]);
  const after = new Map([['docs/이해대장.html', 칸('999:5', '같은내용')]]);
  const r = 판정(before, after);
  assert.deepStrictEqual(r.밖에서바뀜, [], '자기 스위트가 다시 구운 것을 「밖에서 바뀜」으로 냈다 — 적색을 상시 못 믿게 만든다(F616)');
  assert.deepStrictEqual(r.되돌아옴, ['docs/이해대장.html'], '되돌아온 것을 안 센다 — 분모가 사라져 「몇 벌인지」를 또 아무도 모른다');
});

test('🔑 F616 — 한쪽을 못 읽었으면 «모름»이다(「같다」로 접지 않는다 · F207)', () => {
  const before = new Map([['docs/x.html', 칸('100:5', '내용')], ['docs/y.html', 칸('100:5', null)]]);
  const after = new Map([['docs/x.html', 칸('999:5', null)], ['docs/y.html', 칸('999:5', '내용')]]);
  const r = 판정(before, after);
  assert.deepStrictEqual(r.모름.sort(), ['docs/x.html', 'docs/y.html'], '못 읽은 것을 「같다」나 「바뀌었다」로 접었다');
  assert.deepStrictEqual(r.밖에서바뀜, []);
  assert.deepStrictEqual(r.되돌아옴, []);
});

test('🔑 변화가 없으면 조용하다 (거짓양성 0)', () => {
  const same = new Map([['Code.js', 칸('100:5', 'A')], ['docs/a.md', 칸('200:9', 'B')]]);
  const r = 판정(same, new Map(same));
  assert.deepStrictEqual([r.밖에서바뀜, r.되돌아옴, r.사라짐, r.모름], [[], [], [], []], '아무것도 안 바뀌었는데 경고 대상이 생겼다');
});

// ── ② 무엇을 말하는가 — 판정이 맞아도 문장이 틀리면 F616 이 그대로 산다 ──────────

test('🔴 F616 — «되돌아옴»만 있으면 「이 적색은 못 믿는다」를 안 낸다', () => {
  const 판 = { 밖에서바뀜: [], 되돌아옴: ['docs/이해대장.html'], 사라짐: [], 모름: [], 분모: 9 };
  const 글 = 알림줄들(판, 1).join('\n');
  assert.ok(!/못 믿/.test(글), '자기 부작용만 있는데 적색을 의심하라고 한다 — 그게 F616 이 잡은 그 자리다');
  assert.ok(!/작업본소유자/.test(글), '없는 옆 세션을 찾으라는 처방이 나온다 — 따를 수 없는 처방은 가드를 끄게 만든다(F103)');
  assert.match(글, /바이트 무변경/, '되돌아온 것을 아예 안 알린다 — 분모가 다시 안 보이게 된다');
});

test('🔑 «밖에서 바뀜»이 있으면 경고와 처방을 그대로 낸다 (2026-08-04 사고 방어는 살아 있다)', () => {
  const 판 = { 밖에서바뀜: ['Code.js'], 되돌아옴: [], 사라짐: [], 모름: [], 분모: 9 };
  const 글 = 알림줄들(판, 1).join('\n');
  assert.match(글, /못 믿/, '진짜 외부 편집인데 조용하다 — 08-04 거짓 적색 2회가 되살아난다');
  assert.match(글, /재실행하라/, '무엇을 하라는 지시가 없다 — 경고만 있으면 또 고치러 간다');
  assert.match(글, /작업본소유자/, '누구 파일인지 가르는 도구를 안 알려준다(F073)');
  assert.match(글, /Code\.js/, '어느 파일인지 안 짚어 준다');
});

test('🔑 초록이면 적색 경고를 안 낸다 — 되돌아옴 알림은 그래도 낸다(분모는 늘 보인다)', () => {
  const 판 = { 밖에서바뀜: ['Code.js'], 되돌아옴: ['docs/이해대장.html'], 사라짐: [], 모름: [], 분모: 9 };
  const 글 = 알림줄들(판, 0).join('\n');
  assert.ok(!/못 믿/.test(글), '초록인데 적색 경고를 냈다');
  assert.match(글, /바이트 무변경/, '초록 런에서는 분모를 안 낸다 — 「몇 벌인지」를 재는 유일한 자리가 적색뿐이 된다');
});

// ── ③ 배선 — 판정이 맞아도 안 불리면 장식이다 ────────────────────────────────

test('배선 — 실행 전후로 스냅샷을 찍고, 뒤판은 앞판을 물려받는다(해시 두 번 안 읽는다)', () => {
  assert.match(SRC, /const before = snapshot\(\)[\s\S]{0,400}spawnSync[\s\S]{0,200}const after = snapshot\(before\)/,
    '실행 **전후**로 스냅샷을 안 찍거나, 뒤판이 앞판을 안 물려받는다(그러면 해시 비용이 두 배다)');
  assert.match(SRC, /알림줄들\(판정\(before, after\), code\)/, '판정 결과가 화면으로 안 나간다 — 스스로 발화하지 않는 장치는 안 돈다');
  assert.match(SRC, /module\.exports = \{[^}]*판정[^}]*\}/, '판정을 안 내보낸다 — 회귀가 다시 소스를 긁게 되고, 긁기는 조용히 「못 찾음」이 된다');
  assert.match(SRC, /if \(require\.main === module\) 주\(\)/, 'require 만 해도 스위트가 돈다 — 회귀가 이 파일을 못 부른다');
});

test('🔴 배선 — 스냅샷이 **내용 해시**를 든다(도장만 들면 F616 이 그대로 되살아난다)', () => {
  assert.match(SRC, /createHash/, '내용 해시를 안 쓴다 — 「손댔다」와 「바뀌었다」가 다시 한 글자가 된다');
  assert.match(SRC, /앞\.도장 === 도장/, '도장이 같을 때 앞판을 재사용하지 않는다 — 전량 두 번 읽으면 비용이 두 배다');
});

/* 🔴 여기 있던 소스 앵커(`walk(ROOT, 0); for (const d of [...])` 정규식)를 **픽스처로 바꿨다**.
 *   왜 (2026-08-18 변이 실측 · 4건 중 **구멍 3**): 그 앵커는 «목록에 적힌 글자»만 봐서, 글자를 안
 *   건드리고 걸음만 망가뜨리는 변이가 전부 통과했다 — ①`.claude/state` 를 안 거른다 ②`node_modules`
 *   를 안 거른다 ③하위 폴더를 안 훑는다(깊이 2→0). 셋 다 새는 방향이 「통과」다.
 *   그리고 앵커 자신이 이 파일의 약점을 한 번 더 보여줬다: 인자 이름 하나(`ROOT`→`루트`)에
 *   빨개졌다 — **행동은 한 글자도 안 바뀌었는데**. 재는 것을 글자에서 행동으로 옮긴다. */
test('🔑 [픽스처] 스냅샷 걸음 — 루트·하위 2겹·html 은 담고, 런타임 상태와 node_modules 는 뺀다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-스냅샷걸음-'));
  try {
    // 실측된 거짓 적색 2회의 진원지가 **Code.js(루트)** 와 **docs/ 아래 HTML** 이었다.
    for (const d of ['docs/교재_읽기본', 'tests', 'tools/lib', '.claude/state', 'tools/node_modules/남의팩']) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
    }
    const 쓰기 = (상대, 내용) => fs.writeFileSync(path.join(dir, ...상대.split('/')), 내용);
    쓰기('Code.js', '// 루트\n');
    쓰기('docs/이해대장.html', '<html></html>\n');
    쓰기('docs/교재_읽기본/권1.html', '<html></html>\n');   // ③ 하위 2겹 — F616 이 본 두 파일 중 하나
    쓰기('tools/lib/깊이2.js', '// 하위 2겹\n');
    쓰기('tests/한벌.test.js', '// 검사\n');
    쓰기('.claude/훅.js', '// 훅\n');
    쓰기('.claude/state/턴.json', '{}\n');                 // ① 매 턴 갱신되는 런타임 상태
    쓰기('tools/node_modules/남의팩/index.js', '// 남의 것\n');   // ② 내 편집 대상이 아니다
    쓰기('docs/그림.png', 'PNG');                          // 테스트가 읽지 않는 확장자

    const 본것 = new Set([...snapshot(null, dir).keys()].map((p) => p.replace(/\\/g, '/')));
    assert.ok(본것.size > 0, '스냅샷이 0벌 — 이 초록은 판정이 아니라 미실행이다(F207)');
    for (const p of ['Code.js', 'docs/이해대장.html', 'docs/교재_읽기본/권1.html',
      'tools/lib/깊이2.js', 'tests/한벌.test.js', '.claude/훅.js']) {
      assert.ok(본것.has(p), `스냅샷이 ${p} 를 안 본다 — 그 자리의 편집은 영영 안 보인다`);
    }
    assert.ok(!본것.has('.claude/state/턴.json'),
      '`.claude/state` 를 셌다 — 훅이 매 턴 갱신하는 자리라 경고가 노이즈에 묻혀 죽는다');
    assert.ok(!본것.has('tools/node_modules/남의팩/index.js'),
      'node_modules 를 셌다 — 내 편집 대상이 아닌데 매 설치마다 수천 벌이 경고에 섞인다');
    assert.ok(!본것.has('docs/그림.png'), '테스트가 읽지 않는 확장자까지 셌다');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── ④ 실동작 — 픽스처가 아니라 진짜 파일로 한 바퀴 ───────────────────────────

test('🔑 실동작 — 진짜 파일의 mtime 만 움직이면 밖에서바뀜 0 · 되돌아옴 1 이다', (t) => {
  /* 픽스처는 내가 만든 Map 이라 「스냅샷이 해시를 제대로 담는가」는 원리상 못 잰다.
   * 그 한 칸만 실물로 본다 — 이 검사가 없으면 스냅샷이 해시를 안 담아도 위 ①이 전부 초록이다.
   * ⚠ **쓰지 않는다.** 같은 바이트를 되쓰는 것도 쓰기라, `node --test` 가 파일별로 병렬이라는 걸
   *   생각하면 남의 동시 편집을 덮을 수 있다. `utimes` 로 도장만 움직이면 재현은 같고 위험은 0이다. */
  const 대상 = path.join(ROOT, 'docs', '이해대장.html');
  if (!fs.existsSync(대상)) { t.skip(`산출물이 없는 체크아웃(${대상}) — 미실행이지 통과가 아니다`); return; }

  const before = snapshot();
  const 상대 = path.relative(ROOT, 대상).replace(/\\/g, '/');
  assert.ok([...before.keys()].some((p) => p.replace(/\\/g, '/') === 상대),
    '스냅샷이 이 산출물을 아예 안 본다 — 걸음이나 확장자 목록이 좁아졌다');

  const s = fs.statSync(대상);
  fs.utimesSync(대상, s.atime, new Date(s.mtimeMs + 1000));   // 도장만 1초 앞으로
  try {
    const after = snapshot(before);
    const r = 판정(before, after);
    const 든가 = (목록) => 목록.map((p) => p.replace(/\\/g, '/')).includes(상대);
    assert.ok(!든가(r.밖에서바뀜), '내용은 그대로인데 「밖에서 바뀜」이다 — 스냅샷이 해시를 안 담고 있다(F616)');
    assert.ok(든가(r.되돌아옴), '되돌아온 것으로도 안 센다 — 분모가 비면 「몇 벌인지」를 또 아무도 모른다');
  } finally {
    fs.utimesSync(대상, s.atime, s.mtime);   // 도장을 되돌린다 — 남의 런에 이 검사가 섞이지 않게
  }
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
