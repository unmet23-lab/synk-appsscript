/* 점유의 **세 번째 층** — `origin/master` 에는 있는데 이 트리가 아직 안 받은 보드 선언 (F628).
 *
 * 이 검사가 지키는 것: **「빈 자리다 · 집어라」가 「그 층을 안 봤다」의 얼굴로 나가지 않게.**
 *
 * 🔴 사연 (2026-08-18 · 라이브 실측) — `활성줄전량` 은 두 층만 봤다:
 *   ①`줄들(root)` = 내 디스크 ②`가지끝()` = `--no-merged 기준` 이라 **기준 자신(=origin/master)을
 *   정의상 뺀다.** 그래서 남이 master 에 직접 올린 선언(규약상 단발 편집은 그렇게 간다)은 내가
 *   fetch·merge 를 받기 전까지 **어느 층에도 없다.** 그런데 반환은 `못본층: []` 이었다 — 못 본 것을
 *   못 봤다고도 안 하고 「전부 봤다」고 **단언**했다(F207 · 새는 방향이 «집어라»).
 *   실측: 내 트리가 41커밋 뒤일 때 놓친 표줄 5 · **활성 1**. 그 뒤처짐은 **17분** 만에 생겼다.
 *   그리고 그 층(`원격줄들`)은 F542 가 **이미 지어 놨다** — 인계문만 부르고 점유 셋은 안 불렀다.
 *
 * 🔑 탐지력은 **픽스처가 진다**(F296) — 주입구로 git 없이 전부 재고, 실저장소는 계약만 본다.
 *   ⚠ 이 파일이 F619(`tests/보드가지.test.js`)와 **다른 파일**인 이유: 그쪽은 「아직 안 머지된 가지」,
 *     이쪽은 「이미 머지됐는데 내가 안 받았다」다. 처방이 정반대라(PR 을 봐라 / 받아라) 한 파일에
 *     두면 다음 사람이 두 축을 섞는다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const 보드 = require(path.join(ROOT, 'tools', 'lib', '보드.js'));

/** 실행층이 내는 모양 그대로 — 모양 정본은 `가지끝줄()` 하나다(손으로 베끼면 파서를 안 잰다). */
const 원격출력 = (파일, ...줄들) => 줄들.map((l) => 보드.가지끝줄(보드.원격기준, 파일, l)).join('\n');
const 가지출력 = (가지, 파일, ...줄들) => 줄들.map((l) => 보드.가지끝줄(가지, 파일, l)).join('\n');

const 표줄 = (트랙, 파일칸 = '`tools/x.js`', 상태 = '▶착수') =>
  `| 2026-08-18 | **${트랙}** | ${파일칸} | ${상태} |`;

/** 메인·가지를 **둘 다 주입해** git 을 안 부르게 한다 — 안 그러면 이 검사가 실저장소 상태에 기댄다. */
const 판 = (옵션) => 보드.활성줄전량(ROOT, { 메인: [], 출력: '', ...옵션 });

// ───────────────────────────────── ① 탐지력 — 그 줄이 실제로 실리나 (픽스처 · git 0)

test('🔑 [628] origin/master 에만 있는 활성 선언이 «활성 줄»로 실린다 — 이게 0이면 그 자리는 「빈 자리」로 불린다', () => {
  const r = 판({ 원격출력: 원격출력('bbbbbbbb.md', 표줄('남의 트랙 — 장부 999 를 잡는다')) });
  assert.strictEqual(r.모름, false);
  assert.strictEqual(r.줄들.length, 1, `원격 층의 줄이 안 실렸다: ${JSON.stringify(r.줄들)}`);
  assert.match(r.줄들[0].줄, /장부 999/);
  assert.strictEqual(r.줄들[0].파일, 'bbbbbbbb.md', '주인 지문이 안 실렸다 — 「누가 잡았나」를 못 답한다');
});

test('🔑 [628] 이름표가 **가지와 갈린다** — 처방이 정반대다(PR 을 봐라 / 받아라)', () => {
  const r = 판({ 원격출력: 원격출력('bbbbbbbb.md', 표줄('원격 트랙')) });
  assert.strictEqual(r.줄들[0].원격, 보드.원격기준, '`원격` 이름표가 비었다 — 소비자가 처방을 못 가른다');
  assert.strictEqual(r.줄들[0].가지, '', '원격 줄에 «가지» 이름표가 붙었다 — 없는 PR 을 뒤지게 된다(F103)');
});

test('☠️ [628] 완료된 줄은 안 싣는다 — 활성 거르기는 세 층에 **같은 잣대**여야 한다', () => {
  const r = 판({ 원격출력: 원격출력('bbbbbbbb.md', 표줄('끝난 트랙', '`tools/x.js`', '✅종결')) });
  assert.strictEqual(r.줄들.length, 0, '완료 줄이 점유로 섰다 — 거짓 차단은 관습을 죽인다(F221)');
});

// ───────────────────────────────── ② 분모 — 0 과 «안 봤다»를 가른다 (F207)

test('🔴 [628] 가지 층만 주입한 픽스처는 원격을 **모름**으로 둔다 — 조용한 0 이면 이 함수가 없애려는 병을 자기가 낸다', () => {
  const r = 보드.활성줄전량(ROOT, { 메인: [], 출력: '' });
  assert.ok(r.못본층.includes('원격 master'), `못본층에 원격이 없다: ${JSON.stringify(r.못본층)}`);
  assert.strictEqual(r.분모.원격, null, '못 본 층의 분모가 0 으로 적혔다 — 「없다」와 「안 봤다」가 같아진다(F207)');
  assert.strictEqual(r.모름, true);
});

test('🔑 [628] 원격을 주입하면 «잰 것»이 된다 — 분모가 줄 수로 선다', () => {
  const r = 판({ 원격출력: 원격출력('bbbbbbbb.md', 표줄('하나'), 표줄('둘')) });
  assert.ok(!r.못본층.includes('원격 master'), '주입해 줬는데도 「못 봤다」로 남았다');
  assert.strictEqual(r.분모.원격, 2, '분모가 **활성 거르기 전**의 날수가 아니다');
});

test('🔑 [628] 원격 ref 가 아예 없으면 «재서 얻은 0» 이다 — 모름으로 올리면 참인 단정까지 죽는다', () => {
  const r = 판({ 원격출력: '' });
  assert.ok(!r.못본층.includes('원격 master'));
  assert.strictEqual(r.분모.원격, 0);
});

test('🔑 [628] 실행층이 못 부르면 **모름**이다 — 빈 배열과 안 접는다', () => {
  const r = 판({ 원격실행: () => null });
  assert.ok(r.못본층.includes('원격 master'), '실행층이 null 을 냈는데 「0건」으로 접혔다');
  assert.strictEqual(r.분모.원격, null);
});

test('🔑 [628] 실행층이 **던져도** 모름이다 — 예외를 0 으로 접으면 새는 방향이 「집어라」다', () => {
  const r = 판({ 원격실행: () => { throw new Error('git 없음'); } });
  assert.ok(r.못본층.includes('원격 master'));
  assert.strictEqual(r.분모.원격, null);
});

test('🔑 [628] 저장소가 아닌 곳에서는 이 층이 **원리상 0** 이다 — 못 잰 게 아니라 잴 것이 없다', () => {
  const 밖 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'f628-'));
  try {
    /* 🔑 실행층을 **모름으로 고정**해야 이 갈래가 실제로 돈다. git 이 있는 기계에서는 임시 디렉터리도
     *   `rev-parse` 가 «ref 없음»(=잰 0)으로 답해 버려서, 그냥 부르면 `저장소인가` 줄에 **도달조차
     *   안 한다** — 변이 M5 가 그 사실을 잡아 줬다(초록인데 안 도는 자리였다). 모름이 되는 판은
     *   git 을 아예 못 부르는 기계이고, 그것을 주입으로 세운다. */
    const r = 보드.원격몫(밖, { 원격실행: () => null });
    assert.strictEqual(r.모름, false, '저장소가 아닌 곳을 「못 봤다」로 올렸다 — 픽스처마다 경보가 뜬다');
    assert.deepStrictEqual(r.줄들, []);
    /* 반대쪽도 못박는다 — **저장소 안에서** 모름은 모름이어야 한다(안 그러면 위가 모름을 통째로 삼킨다). */
    const 안 = 보드.원격몫(ROOT, { 원격실행: () => null });
    assert.strictEqual(안.모름, true, '저장소 안에서도 모름을 0 으로 접었다 — 이 층의 존재 이유가 사라진다');
  } finally { fs.rmSync(밖, { recursive: true, force: true }); }
});

// ───────────────────────────────── ③ 접기·순서 — 거짓 차단을 안 만든다 (F221)

test('🔴 [628] 같은 줄이 가지에도 원격에도 있으면 **한 줄**이고 이름표는 **둘 다** 남는다', () => {
  const 한줄 = 표줄('같은 선언');
  const r = 판({ 출력: 가지출력('가지A', 'aaaaaaaa.md', 한줄), 원격출력: 원격출력('aaaaaaaa.md', 한줄) });
  assert.strictEqual(r.줄들.length, 1, '같은 줄이 두 번 섰다 — 둘째가 「남의 선언」으로 읽혀 거짓 차단이 된다(F221)');
  assert.strictEqual(r.줄들[0].가지, '가지A');
  assert.strictEqual(r.줄들[0].원격, 보드.원격기준, '원격 이름표가 안 채워졌다 — 두 처방 중 하나가 사라진다');
});

test('🔴 [628] **순서가 판정이다** — 메인에 이미 있는 줄은 원격 이름표만 채우고 새로 서지 않는다', () => {
  const 한줄 = 표줄('내 선언');
  const r = 판({ 메인: [{ 줄: 한줄, 파일: '9a6c0547.md' }], 원격출력: 원격출력('9a6c0547.md', 한줄) });
  assert.strictEqual(r.줄들.length, 1, '내 산 선언이 「내가 안 받은 남의 줄」로 한 번 더 섰다');
  assert.strictEqual(r.줄들[0].파일, '9a6c0547.md');
});

test('🔴 [628] `가지제외파일` 은 **원격 쪽에도** 걸린다 — 안 걸면 board-guard 가 자기 옛 선언에 막힌다', () => {
  const 한줄 = 표줄('내 트랙');
  const r = 판({ 원격출력: 원격출력('9a6c0547.md', 한줄), 가지제외파일: '9a6c0547.md' });
  assert.strictEqual(r.줄들.length, 0, '제외 파일의 원격 줄이 남았다 — F291 면제가 꺼져 자기 줄이 자기를 막는다');
});

// ───────────────────────────────── ④ 소비자 배선 — 안 읽히는 분모는 없는 것과 같다

test('🔴 [628] 소비자 셋이 전부 원격 층을 읽는다 — 하나라도 빠지면 그 도구만 두 층으로 돈다', () => {
  const 대상 = [
    ['tools/friction.js', '점유 화면'],
    ['tools/대기열.js', '일감 고르기'],
    ['.claude/hooks/board-guard.js', '선언 시점 겹침'],
  ];
  for (const [상대, 쓰임] of 대상) {
    const 코드 = fs.readFileSync(path.join(ROOT, 상대), 'utf8');
    assert.ok(/원격/.test(코드) && /(원격 master|원격몫|\.원격\b)/.test(코드),
      `${상대}(${쓰임})가 원격 층을 안 읽는다 — 그 도구만 조용히 좁은 분모로 돈다`);
  }
});

test('🔴 [628] `friction --open` 의 층 목록 문장이 실제 층 수와 맞는다 — 문장과 과녁이 갈리면 정직한 화면이 거짓말이 된다', () => {
  const 코드 = fs.readFileSync(path.join(ROOT, 'tools', 'friction.js'), 'utf8');
  const m = 코드.match(/점유는 \*\*[^']*?\*\* 세 층을 함께 본다/);
  assert.ok(m, '층 목록 문장을 못 찾았다 — 문장을 고쳤으면 이 회귀도 함께 고친다');
  assert.match(m[0], /메인 보드/);
  assert.match(m[0], /미머지 가지/);
  assert.match(m[0], /origin\/master/);
});

test('🔴 [628] `점유()` 가 원격 몫을 **실제로 나른다** — 여기서 끊기면 인쇄기는 원리상 못 낸다', () => {
  const { 점유 } = require(path.join(ROOT, 'tools', 'friction.js'));
  const 줄 = 표줄('남의 트랙 — 장부 777');
  /* 판을 통째로 주입한다 — 이 검사가 재는 것은 「보드가 뭘 냈나」가 아니라 **점유가 그것을 나르나**다. */
  const 판 = 보드.활성줄전량(ROOT, { 메인: [], 출력: '', 원격출력: 원격출력('cccccccc.md', 줄) });
  const r = 점유(['F777'], { 판, 내지문: '' });
  assert.strictEqual(r.원격몫, 1, '원격 분모가 점유에서 끊겼다 — 화면은 영원히 「참인 0」만 본다');

  const 못본판 = 보드.활성줄전량(ROOT, { 메인: [], 출력: '' });
  assert.strictEqual(점유(['F777'], { 판: 못본판, 내지문: '' }).원격몫, null,
    '못 본 층이 0 으로 전해졌다 — 「안 봤다」가 「없다」와 같아진다(F207)');
});

test('🔴 [628] 원격 줄의 «자리»는 `보드 <파일>` 로 안 적는다 — 열어 보면 없는 주소다', () => {
  const { 점유 } = require(path.join(ROOT, 'tools', 'friction.js'));
  const 줄 = `| 2026-08-18 | **F778 을 잡는다** | \`tools/x.js\` | 🔵착수 |`;
  const 판 = 보드.활성줄전량(ROOT, { 메인: [], 출력: '', 원격출력: 원격출력('dddddddd.md', 줄) });
  const 자리 = (점유(['F778'], { 판, 내지문: '' }).표.get('F778') || {}).자리 || [];
  assert.strictEqual(자리.length, 1, `잡힘으로 안 섰다: ${JSON.stringify(자리)}`);
  assert.match(자리[0], /origin\/master/, '원격 줄인데 출처가 안 적혔다');
  assert.doesNotMatch(자리[0], /^보드 /, '이 트리에 없는 파일을 「보드 …」로 적었다 — 열어 본 사람이 이 화면을 안 믿게 된다');
});

test('🔑 [628] 인쇄기는 «못 쟀다»·«참인 0»·«N건»을 **다른 글자**로 낸다', () => {
  const { 원격몫줄 } = require(path.join(ROOT, 'tools', 'friction.js'));
  assert.match(원격몫줄(null), /안 쟀다/, '못 잰 것이 조용하면 그 화면은 「빈 자리」로 읽힌다');
  assert.strictEqual(원격몫줄(0), '', '참인 0 에 경보를 달면 사람이 무시하는 법을 배운다(F113)');
  assert.match(원격몫줄(3), /3개/);
  assert.match(원격몫줄(3), /merge --ff-only/, '처방이 없으면 읽은 사람이 할 것이 없다');
});

// ───────────────────────────────── ⑤ 실저장소 — 계약만 본다 (판정은 위 픽스처가 진다)

test('🔴 [628] 실저장소에서 세 층이 **다 실린다** — 한 층이라도 빠지면 조용히 반쪽이 된다', () => {
  const r = 보드.활성줄전량(ROOT);
  assert.ok(r.분모 && typeof r.분모 === 'object');
  for (const 칸 of ['메인', '가지', '원격']) {
    assert.ok(Object.prototype.hasOwnProperty.call(r.분모, 칸), `분모에 «${칸}» 칸이 없다`);
  }
  /* ⚠ 값 자체는 단정하지 않는다 — 이 기계의 fetch 상태에 달렸다(F296). 계약만 못박는다. */
  assert.ok(r.분모.원격 === null || Number.isInteger(r.분모.원격),
    `원격 분모가 «수 아니면 null» 계약을 깼다: ${JSON.stringify(r.분모.원격)}`);
});
