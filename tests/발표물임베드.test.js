/* 발표물 폰트 임베드 회귀 — 「이름만 쓰고 로드를 빠뜨리는」 실패를 산출물 층에서 막는다.
 *
 * 왜 있나 (유호님 08-05 "임베드 통로에 태운다"):
 *   발표물 6종은 폰트를 이름으로만 지정했다. 그 폰트가 깔린 기계에서만 제대로 나오고,
 *   안 깔린 기계에선 맑은고딕·굴림으로 조용히 폴백한다. 이 PC 가 그 상태였다(설치된 브랜드
 *   폰트는 SUIT 뿐) — 화면은 멀쩡해 보이고 **종이에서만 틀린다.** 눈으로는 구별이 안 된다.
 *
 * 🔑 이 검사가 막는 건 「폰트가 예쁜가」가 아니라 **임베드 안 된 사본이 산출물 자리에 앉는 것**이다.
 *   소스만 고치고 빌드를 안 돌리면 파일은 그대로 있으니 아무 신호도 안 난다 — 그게 조용한 자리다.
 *
 * 탐지력은 픽스처가 진다(SYNK_PRESENT_ROOT 이음매). 실저장소는 **거짓양성만** 검사한다 —
 * repo 상태를 탐지력의 근거로 쓰면 「버그가 아직 있을 것」을 요구하는 회귀가 된다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'tools', '발표물빌드.js');
const DIR = path.join(ROOT, 'docs', '발표물');
const FACE = "@font-face{font-family:'SUIT';font-weight:400;src:url(data:font/woff2;base64,AAAA) format('woff2')}";

function check(dir) {
  const r = spawnSync(process.execPath, [BUILD, '--check'], {
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, SYNK_PRESENT_ROOT: dir },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-present-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test('픽스처 — 임베드된 산출물 한 쌍은 통과한다 (거짓양성 0)', () => {
  const d = fixture({
    '_src_a.html': '<style>/*@FONTS@*/\n@page{size:A4}</style>',
    'a.html': `<style>${FACE}\n@page{size:A4}</style>`,
  });
  const v = check(d);
  assert.strictEqual(v.code, 0, `멀쩡한 임베드 한 쌍을 잡았다:\n${v.out}`);
});

test('픽스처 — 산출물이 아예 없으면 잡는다', () => {
  const d = fixture({ '_src_a.html': '<style>/*@FONTS@*/</style>' });
  const v = check(d);
  assert.strictEqual(v.code, 1, '소스만 있고 산출물이 없는데 통과시켰다');
  assert.match(v.out, /산출물 없음/);
});

test('🔑 픽스처 — 산출물에 @font-face 가 없으면 잡는다 (임베드 안 된 사본)', () => {
  const d = fixture({
    '_src_a.html': '<style>/*@FONTS@*/</style>',
    'a.html': "<style>@page{size:A4}\nbody{font-family:'SUIT',sans-serif}</style>",
  });
  const v = check(d);
  assert.strictEqual(v.code, 1,
    '이름만 쓰고 로드가 없는 산출물을 통과시켰다 — 이게 폴백이 조용히 사는 자리다');
  assert.match(v.out, /@font-face 가 없다/);
});

test('픽스처 — 마커가 그대로 남은 치환 실패본을 잡는다', () => {
  const d = fixture({
    '_src_a.html': '<style>/*@FONTS@*/</style>',
    'a.html': `<style>/*@FONTS@*/\n${FACE}</style>`,
  });
  const v = check(d);
  assert.strictEqual(v.code, 1, '마커가 남은 산출물을 통과시켰다');
  assert.match(v.out, /마커가 그대로/);
});

/* 🔑 판정은 **내용**이지 시각이 아니다. mtime 으로 재던 초판이 로컬 1254/0 초록인데 CI 에선
 * 빨갰다 — git 이 파일 시각을 보존하지 않아 새 클론에선 순서가 제멋대로다(08-05 원격 run 실측).
 * 그래서 이 픽스처는 시각을 건드리지 않고 **내용을 어긋나게** 해서 잡히는지 본다. */
test('🔑 픽스처 — 소스를 고치고 안 구우면 잡는다 (시각이 아니라 내용으로)', () => {
  const d = fixture({
    '_src_a.html': '<style>/*@FONTS@*/\n@page{size:A4}\n.새문단{color:red}</style>',
    'a.html': `<style>${FACE}\n@page{size:A4}</style>`, // 소스의 새 규칙이 안 반영된 낡은 산출물
  });
  const v = check(d);
  assert.strictEqual(v.code, 1, '소스를 고치고 빌드를 안 돌렸는데 통과시켰다');
  assert.match(v.out, /내용이 어긋난다/);
});

test('픽스처 — 시각이 뒤집혀도 내용이 같으면 통과한다 (CI 새 클론 재현)', () => {
  const d = fixture({
    '_src_a.html': '<style>/*@FONTS@*/\n@page{size:A4}</style>',
    'a.html': `<style>${FACE}\n@page{size:A4}</style>`,
  });
  // 새 클론에서 소스가 산출물보다 「새로」 보이는 상태를 그대로 만든다
  const older = new Date(Date.now() - 60000);
  fs.utimesSync(path.join(d, 'a.html'), older, older);
  const v = check(d);
  assert.strictEqual(v.code, 0,
    `내용이 같은데 시각만 보고 잡았다 — 이게 CI 를 빨갛게 만든 결함이다:\n${v.out}`);
});

test('🔑 픽스처 — 소스가 0건이면 「할 일 없음」이 아니라 실패다 (스캔이 조용히 죽는 것 방지)', () => {
  const v = check(fixture({}));
  assert.strictEqual(v.code, 1, '0건을 통과로 넘겼다 — 경로가 바뀌면 검사가 통째로 사라진다');
});

test('실저장소의 발표물이 전부 임베드본이다 (거짓양성 0)', (t) => {
  if (!fs.existsSync(DIR)) return t.skip('docs/발표물 없음');
  if (!fs.readdirSync(DIR).some((f) => f.startsWith('_src_') && f.endsWith('.html'))) {
    return t.skip('_src_*.html 0건 — 아직 임베드 통로에 안 태운 상태');
  }
  const v = check(DIR);
  assert.strictEqual(v.code, 0, `실저장소 발표물이 임베드 검사를 통과하지 못했다:\n${v.out}`);
});

/* ── 폰트 스택 린트 ────────────────────────────────────────────────
 * 위 검사들은 「@font-face 가 들어갔나」까지만 본다. 실제로 08-06 에 걸린 건 그 다음 층이다:
 * 임베드는 멀쩡한데 **소스가 안 실린 이름('SUIT Variable')을 폴백보다 앞에서 불러서**
 * 한글이 전부 이 PC 에 깔린 폰트로 나가고 있었다(PDF 실측 BAAAAA+SUITVariable-ExtraBold).
 * 안 깔린 기계에선 굵기가 내려앉는다 — 양쪽 다 화면은 멀쩡해 보인다.
 */
const GOOD_STACK = "body{font-family:'Inter Tight','SUIT',system-ui,'Malgun Gothic',sans-serif;font-weight:800}";

test('🔑 픽스처 — 임베드 안 된 폰트를 폴백보다 앞에서 부르면 잡는다', () => {
  const d = fixture({
    '_src_a.html': `<style>/*@FONTS@*/\nbody{font-family:'Inter Tight','SUIT Variable','SUIT',system-ui,sans-serif}</style>`,
    'a.html': `<style>${FACE}\nbody{font-family:'Inter Tight','SUIT Variable','SUIT',system-ui,sans-serif}</style>`,
  });
  const v = check(d);
  assert.strictEqual(v.code, 1, '기계에 깔린 폰트가 그리게 되는 소스를 통과시켰다');
  assert.match(v.out, /SUIT Variable/);
});

test('픽스처 — 임베드 굵기 범위를 넘는 굵기를 잡는다 (가짜 볼드 합성)', () => {
  const d = fixture({
    '_src_a.html': '<style>/*@FONTS@*/\nh1{font-weight:950}</style>',
    'a.html': `<style>${FACE}\nh1{font-weight:950}</style>`,
  });
  const v = check(d);
  assert.strictEqual(v.code, 1, '어떤 face 도 없는 굵기를 통과시켰다');
  assert.match(v.out, /굵기 950/);
});

test('픽스처 — 멀쩡한 스택·굵기는 안 잡는다 (거짓양성 0)', () => {
  const d = fixture({
    '_src_a.html': `<style>/*@FONTS@*/\n${GOOD_STACK}</style>`,
    'a.html': `<style>${FACE}\n${GOOD_STACK}</style>`,
  });
  const v = check(d);
  assert.strictEqual(v.code, 0, `임베드된 이름만 부르는 소스를 잡았다:\n${v.out}`);
});

/* 소스 쪽도 못박는다 — 마커가 사라지면 빌드가 「마커 없음」으로 죽는데,
 * 그 실패는 빌드를 돌린 사람만 본다. 회귀가 먼저 말하게 한다. */
test('실저장소 소스 전량에 /*@FONTS@*/ 마커가 있다', (t) => {
  if (!fs.existsSync(DIR)) return t.skip('docs/발표물 없음');
  const srcs = fs.readdirSync(DIR).filter((f) => f.startsWith('_src_') && f.endsWith('.html'));
  if (!srcs.length) return t.skip('_src_*.html 0건');
  for (const s of srcs) {
    const html = fs.readFileSync(path.join(DIR, s), 'utf8');
    assert.ok(html.includes('/*@FONTS@*/'),
      `${s} 에 /*@FONTS@*/ 마커가 없다 — 빌드가 이 파일에서 죽는다`);
  }
});
