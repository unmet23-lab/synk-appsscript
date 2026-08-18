/**
 * tools/test-ci.js + tools/lib/런중변경.js 회귀 — **거짓 적색과 진짜 적색이 같은 모양이면 안 된다.**
 *
 * 왜 있나 (2026-08-04 실측, 거짓 적색 2회):
 *   이 저장소는 세션이 동시에 여럿 돈다. 스위트가 20초 넘게 도는 동안 옆 세션이
 *   Code.js·HTML 을 편집하면 테스트가 중간 상태를 읽고 빨간불이 된다. 그 적색은
 *   진짜 적색과 모양이 완전히 같아서, 실제로 그걸 보고 **남의 살아있는 작업본
 *   (Code.js ← 931bae1e 세션)을 고치러 갈 뻔했다.** 재실행하니 둘 다 초록이었다.
 *
 * 그리고 그 장치가 **반대 방향으로 새고 있었다** (F616 · 2026-08-18 실측 2회):
 *   스냅샷을 `mtimeMs:size` 로만 찍어서, **이 스위트가 제자리에서 다시 굽고 바이트를
 *   되돌리는 산출물**(`tests/이해대장.test.js:495` 가 대표)까지 「옆 세션이 편집 중」으로
 *   단정했다. 격리 컨테이너(다른 세션 0 · git status 전후 빈 출력)에서도 떴고, 그 두 검사가
 *   거의 모든 전체 런에 끼므로 사실상 **항상** 「이 적색은 못 믿는다」가 따라붙었다.
 *   새는 방향이 통과가 아니라 **「빨간 것을 안 믿게 만든다」**다.
 *
 * 이 파일의 분담 (CLAUDE.md 가드 맹점 ②):
 *   · **탐지력은 픽스처가 진다** — 임시 트리를 만들어 실제로 굽고·바꾸고·지운 뒤 잰다.
 *   · **실 저장소에는 거짓양성만 묻는다** — 「지금 이 repo 가 조용한가」는 옆 세션이 정하는 값이라
 *     fail 로 쓰면 남의 편집이 내 적색이 된다(F296). 분모만 못박고, 조용하지 않으면 skip 한다.
 *   · 배선(전후 스냅샷·경고 문구·두 갈래)은 소스 앵커가 진다 — 「경고를 지웠다」를 잡는 자리다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 파일소스 } = require('./lib/소스검사');
const { 스냅샷, 가르기 } = require('../tools/lib/런중변경.js');

const ROOT = path.resolve(__dirname, '..');
/* 🔑 `파일소스()` 로 읽는다 — 읽으면서 줄끝 표기를 접는다(#Q101 · 2026-08-17).
 *   그전엔 원문 그대로 읽고 앵커 쪽에서 `\r?\n` 으로 CRLF 만 받아냈다. 형제 축(줄 끝 공백)은
 *   열려 있어서, 행동을 한 글자도 안 바꾸는 변형에 아래 두 시험이 **실측으로** 빨개졌다.
 *   접기는 이제 이음매가 진다 — 여기 손 접기를 다시 적으면 그게 곧 사본이다. */
const SRC = 파일소스(path.join(ROOT, 'tools', 'test-ci.js'));

/* ── 픽스처 — 진짜 파일로 재는 자리 ─────────────────────────────────────────── */

/** 임시 트리를 짓고 콜백에 넘긴다. 트리는 반드시 치운다(임시 폴더가 쌓이면 다음 사람이 밟는다). */
function 임시트리(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-런중변경-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'Code.js'), 'function 엔진() {}\n');
    fs.writeFileSync(path.join(dir, 'docs', '대장.html'), '<html>원본</html>\n');
    fs.writeFileSync(path.join(dir, 'docs', '지울것.md'), '# 지울것\n');
    fs.writeFileSync(path.join(dir, 'tests', '안건드림.js'), '// 그대로\n');
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** mtime 을 확실히 벌린다 — 같은 ms 안에 다시 쓰면 「제자리 굽기」가 stat 상 안 보인다. */
function 시각밀기(p, 초 = 5) {
  const t = new Date(Date.now() + 초 * 1000);
  fs.utimesSync(p, t, t);
}

test('🔑 [픽스처] 내용이 달라진 파일은 «밖에서» 로 잡는다 — 수정도 삭제도', () => {
  임시트리((dir) => {
    const before = 스냅샷(dir);
    fs.writeFileSync(path.join(dir, 'Code.js'), 'function 엔진() { return 1; }\n');
    fs.rmSync(path.join(dir, 'docs', '지울것.md'));
    fs.writeFileSync(path.join(dir, '새파일.js'), '// 스위트가 만든 것\n');
    const { 밖에서, 제자리 } = 가르기(before, 스냅샷(dir));

    assert.ok(밖에서.includes('Code.js'), '내용이 바뀐 파일을 못 잡았다 — 거짓 적색이 진짜처럼 보인다');
    assert.ok(밖에서.some((m) => m.startsWith(path.join('docs', '지울것.md'))), '사라진 파일을 못 잡았다');
    assert.ok(!밖에서.some((m) => m.includes('안건드림')), '안 바뀐 파일을 바뀌었다고 했다 — 매번 경고면 경고가 죽는다');
    // 새로 **생긴** 파일은 셀 필요가 없다 — 테스트가 읽던 대상이 아니었다(스위트 자신의 산출물이 섞인다)
    assert.ok(!밖에서.some((m) => m.includes('새파일')), '새로 생긴 파일까지 셌다 — 거짓 경고가 는다');
    assert.deepStrictEqual(제자리, [], '내용이 진짜로 달라졌는데 «제자리» 로 눕혔다 — 이러면 진짜 창을 놓친다');
  });
});

test('🔑 [픽스처 · F616] 바이트가 되돌아온 파일은 «제자리» 다 — «밖에서» 에 안 섞인다', () => {
  임시트리((dir) => {
    const 산출 = path.join(dir, 'docs', '대장.html');
    const 원본 = fs.readFileSync(산출);
    const before = 스냅샷(dir);

    // 실제 스위트가 하는 일: 다시 굽고(내용이 잠깐 달라지고) 원본 바이트로 되돌린다.
    fs.writeFileSync(산출, '<html>다시 구운 중간판</html>\n');
    fs.writeFileSync(산출, 원본);
    시각밀기(산출);

    const { 밖에서, 제자리 } = 가르기(before, 스냅샷(dir));
    assert.deepStrictEqual(밖에서, [],
      '제자리 굽기를 «밖에서 바뀐 것» 으로 돌렸다 — F616 그대로다: 진짜 적색이 상시 「못 믿는다」로 내려앉는다');
    assert.deepStrictEqual(제자리, [path.join('docs', '대장.html')],
      '되돌아온 파일을 분모에서도 지웠다 — 「창이 있었다」는 사실이 통째로 사라진다');
  });
});

test('🔑 [픽스처] 아무것도 안 바뀌면 두 칸 다 0 (거짓양성 0)', () => {
  임시트리((dir) => {
    const before = 스냅샷(dir);
    const { 밖에서, 제자리 } = 가르기(before, 스냅샷(dir));
    assert.deepStrictEqual(밖에서, [], '아무것도 안 바뀌었는데 경고 대상이 생겼다');
    assert.deepStrictEqual(제자리, [], '아무것도 안 바뀌었는데 분모가 생겼다 — 매번 뜨는 줄은 안 읽힌다');
  });
});

test('🔑 [픽스처] 스냅샷 대상 — 루트·tests·tools·docs·.claude 와 html 을 덮고, 런타임 상태는 뺀다', () => {
  임시트리((dir) => {
    // 실측된 거짓 적색 2회의 진원지가 **Code.js(루트)** 와 **docs/ 아래 HTML** 이었다.
    fs.mkdirSync(path.join(dir, '.claude', 'state'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'tools', 'lib'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', '훅.js'), '// 훅\n');
    fs.writeFileSync(path.join(dir, '.claude', 'state', '턴.json'), '{}\n');
    fs.writeFileSync(path.join(dir, 'tools', 'lib', '깊이2.js'), '// 깊이 2\n');
    fs.writeFileSync(path.join(dir, 'node_modules', '남의것.js'), '// 남의 것\n');
    fs.writeFileSync(path.join(dir, 'docs', '그림.png'), 'PNG');

    const 본것 = new Set(스냅샷(dir).keys());
    for (const p of ['Code.js', path.join('docs', '대장.html'), path.join('tests', '안건드림.js'),
      path.join('.claude', '훅.js'), path.join('tools', 'lib', '깊이2.js')]) {
      assert.ok(본것.has(p), `스냅샷이 ${p} 를 안 본다 — 실측된 거짓 적색의 진원지가 이 갈래다`);
    }
    assert.ok(!본것.has(path.join('.claude', 'state', '턴.json')),
      '`.claude/state` 를 셌다 — 훅이 매 턴 갱신하는 런타임 상태라 경고가 노이즈로 죽는다');
    assert.ok(!본것.has(path.join('node_modules', '남의것.js')), 'node_modules 를 셌다');
    assert.ok(!본것.has(path.join('docs', '그림.png')), '테스트가 읽지 않는 확장자까지 셌다');
  });
});

/* ── 실 저장소 — 거짓양성과 분모만 묻는다 ────────────────────────────────────── */

test('[실 저장소] 분모가 있고, 조용할 때는 두 칸 다 0', (t) => {
  const before = 스냅샷(ROOT);
  // F207 — 초록은 분모와 함께만 읽는다. 0벌을 훑고 「깨끗하다」고 말하면 그건 미실행이다.
  assert.ok(before.size > 200, `스냅샷 대상이 ${before.size}벌 — 이 분모로는 아래 초록이 판정이 아니다`);
  assert.ok(before.has('Code.js'), '루트 Code.js 를 안 본다 — 실측된 거짓 적색의 진원지다');

  const { 밖에서, 제자리 } = 가르기(before, 스냅샷(ROOT));
  if (밖에서.length || 제자리.length) {
    /* 이 repo 는 상시 여러 세션이 돈다 — 「지금 조용한가」는 내가 못 정하는 값이라 fail 로 쓰면
     * 남의 편집이 내 적색이 된다(F296). 드러내되 skip 이다. */
    t.skip(`옆에서 편집 중이라 못 잰다 — 밖에서 ${밖에서.length} · 제자리 ${제자리.length}`);
    return;
  }
  assert.deepStrictEqual([밖에서, 제자리], [[], []]);
});

/* ── 배선 — 「경고를 지웠다」를 잡는 자리 ────────────────────────────────────── */

test('배선 — 실행 전후로 스냅샷을 찍고, 적색일 때만 «밖에서» 경고한다', () => {
  assert.match(SRC, /const before = 스냅샷\(ROOT\)[\s\S]{0,400}spawnSync[\s\S]{0,200}const after = 스냅샷\(ROOT\)/,
    '실행 **전후**로 스냅샷을 안 찍는다 — 한쪽만 찍으면 비교가 성립하지 않는다');
  assert.match(SRC, /if \(code !== 0 && 밖에서\.length\)/,
    '초록일 때도 경고하거나, 적색인데 변화를 안 본다');
  assert.match(SRC, /이 적색은 못 믿는다/, '거짓 적색이라는 표시가 사라졌다 — 진짜와 구별이 안 된다');
  assert.match(SRC, /재실행하라/, '무엇을 하라는 지시가 없다 — 경고만 있으면 또 고치러 간다');
  assert.match(SRC, /작업본소유자/, '누구 파일인지 가르는 도구를 안 알려준다(F073)');
});

test('🔑 [F616] 적색인데 «밖에서 0» 이면 「진짜다」를 말하고, 분모(제자리)는 색과 무관하게 낸다', () => {
  assert.match(SRC, /else if \(code !== 0\)[\s\S]{0,400}밖에서 바뀐 파일 \*\*0\*\*/,
    '「밖에서 0」인 적색에 아무 말도 안 한다 — 그 침묵이 곧 「못 믿는다」의 잔상으로 읽힌다');
  assert.match(SRC, /재실행은 답이 아니다/,
    '따를 수 없는 처방(F103)이 그대로 남았다 — 없는 옆 세션을 찾으러 보낸다');
  assert.match(SRC, /if \(제자리\.length\) \{[\s\S]{0,300}console\.log/,
    '제자리 굽기 분모를 «적색일 때만» 낸다 — 초록의 분모가 사라지면 F207 의 거울상이 그대로다');
  assert.match(SRC, /정확히 같은 바이트로.{0,40}돌아온 파일은 제자리 칸에 앉는다/,
    '이 장치가 «틀릴 때의 모습»을 안 적었다 — 새 장치엔 대가를 함께 적는다(CLAUDE.md 신뢰성)');
});

test('🔑 [옛 통로 금지] test-ci 는 스냅샷·가르기를 스스로 적지 않는다 (조리법 한 벌)', () => {
  assert.match(SRC, /require\('\.\/lib\/런중변경\.js'\)/, 'test-ci 가 lib/런중변경 을 안 쓴다');
  assert.ok(!/function snapshot\(/.test(SRC),
    'test-ci 에 인라인 스냅샷이 남았다 — 조리법이 두 벌이면 갈라지고, 갈라진 쪽의 증상은 언제나 「통과」다');
  assert.ok(!/const moved = \[\]/.test(SRC),
    '옛 단일 목록(moved)이 남았다 — 두 갈래를 다시 한 칸으로 뭉치면 F616 이 그대로 돌아온다');
  assert.ok(!/바뀌었다\(옆 세션이 편집 중\)/.test(SRC),
    '「옆 세션이 편집 중」 **단정**이 남았다 — 격리 컨테이너에서도 뜨던 그 문장이다(F616)');
});
