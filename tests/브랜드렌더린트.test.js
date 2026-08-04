/* 브랜드렌더린트 회귀 — 렌더 기준 브랜드 가드가 ①실제로 잡는지 ②지금 저장소가 깨끗한지.
 *
 * 두 축을 분리하는 이유(CLAUDE.md 「가드·회귀의 두 맹점」):
 *   · **탐지력은 픽스처가 진다.** 실저장소가 깨끗해지면 「위반을 잡는다」는 사실을 아무도 증명하지
 *     않게 된다 — 그래서 일부러 더러운 픽스처를 만들어 검사한다.
 *     반대로 실저장소가 더러울 것을 **요구하는** 회귀는 절대 쓰지 않는다(고치면 빨개지는 테스트).
 *   · **실저장소는 거짓양성만 본다.** 등록층 5파일이 0 이어야 한다.
 *
 * ⚠ 이 파일 전체가 크롬에 기댄다. 없으면 **통과가 아니라 skip 으로 드러낸다** —
 *   CI 에서 조용히 안 도는 게 최악이고, 통과와 미실행이 같은 모양이면 안 된다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const 린트 = require('../tools/브랜드렌더린트');
const { findChrome, 측정, 대상, 제외, KIT, ROOT } = 린트;

const CHROME = findChrome();
const 크롬없음 = !CHROME && '크롬이 없다 — 렌더 검사를 **안 돌렸다**(통과 아님). CHROME_PATH 로 지정 가능';

/* 픽스처를 임시 디렉터리에 쓴다. 저장소 안에 더러운 HTML 을 두면 다른 가드들이 그걸 잡는다. */
const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lint-fx-'));
test.after(() => { try { fs.rmSync(임시, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } });

function 픽스처(이름, body) {
  const p = path.join(임시, `${이름}.html`);
  fs.writeFileSync(p, `<!doctype html><meta charset="utf-8"><body style="background:#F6F1E8">${body}</body>`, 'utf8');
  return p;
}

/* ── 0. 등록층이 살아 있는가 ──────────────────────────────────────────────── */
test('등록층 파일이 실제로 존재한다 (경로가 바뀌면 가드가 조용히 0건이 된다)', () => {
  assert.ok(대상.length >= 5, `등록층이 ${대상.length}개뿐 — 줄어들었다면 이유를 \`제외\` 에 적어라`);
  for (const rel of 대상) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `등록됐는데 파일이 없다: ${rel}`);
  }
});

test('제외는 전부 이유를 달고 있다 (이유 없는 제외가 등록층의 구멍이다)', () => {
  for (const [rel, 이유] of 제외) {
    assert.ok(이유 && 이유.length >= 20, `제외 이유가 비었거나 너무 짧다: ${rel}`);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `제외 목록에 없는 파일이 남아 있다: ${rel}`);
  }
});

test('등록층과 제외가 겹치지 않는다', () => {
  const 제외집합 = new Set(제외.map(([r]) => r));
  for (const rel of 대상) assert.ok(!제외집합.has(rel), `${rel} 이 등록과 제외에 동시에 있다`);
});

/* ── 1. 탐지력 — 픽스처 ───────────────────────────────────────────────────── */
test('라이트 배경 위 코랄 **글자**를 잡는다 (소스 검색으로는 원리상 못 잡는 것)', { skip: 크롬없음 }, () => {
  const p = 픽스처('coral-on-light', '<p style="color:#FF6B5C;font-size:10px">보증금 안내</p>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 1, '코랄 on 크림(2.49)을 못 잡았다');
  assert.equal(r.대비위반[0].fg, '#FF6B5C');
  assert.ok(r.대비위반[0].대비 < 3, `대비가 ${r.대비위반[0].대비} 로 계산됐다`);
});

test('배경이 **조상에서** 올 때도 잡는다 (그게 소스 검색과 갈리는 지점이다)', { skip: 크롬없음 }, () => {
  const p = 픽스처('inherited-bg', '<div style="background:#FBF7EE"><span><b style="color:#FF6B5C;font-size:11px">x</b></span></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 1);
  assert.equal(r.대비위반[0].bg, '#FBF7EE', '조상의 배경을 못 찾아 루트 흰색으로 셌다');
});

test('키트 밖 회색·순백·순검정을 **글자와 면 양쪽에서** 잡는다', { skip: 크롬없음 }, () => {
  const p = 픽스처('offkit', '<p style="color:#7A7566">회색</p><div style="background:#FFFFFF">흰 면</div>');
  const r = 측정(p, CHROME);
  const hexes = r.키트밖색.map((v) => v.hex);
  assert.ok(hexes.includes('#7A7566'), '키트 밖 회색을 놓쳤다');
  assert.ok(hexes.includes('#FFFFFF'), '순백 **면**을 놓쳤다 — 철칙 ①은 글자만의 규칙이 아니다');
});

test('텍스트가 없는 컨테이너의 면도 잡는다 (자식에게 글을 넘긴 패널이 숨던 자리)', { skip: 크롬없음 }, () => {
  const p = 픽스처('panel', '<div style="background:#FFFFFF"><span style="color:#171820">글은 자식에</span></div>');
  const r = 측정(p, CHROME);
  assert.ok(r.키트밖색.some((v) => v.hex === '#FFFFFF' && v.자리 === '면'),
    '직접 텍스트가 없는 요소의 배경을 안 봤다 — 부분 집계가 완전 집계처럼 보이는 부류다');
});

test('정본 3종 밖 서체를 잡되, **폴백 스택은 통과**시킨다', { skip: 크롬없음 }, () => {
  const 나쁨 = 측정(픽스처('font-bad', '<p style="font-family:Fraunces,serif;color:#171820">K</p>'), CHROME);
  assert.ok(나쁨.키트밖서체.some((v) => v.font === 'Fraunces'), '키트 밖 서체를 놓쳤다');

  // 정본 스택 그대로. 가드가 이걸 잡으면 사람은 정본을 따르고도 빨간불을 본다 → 가드를 끈다.
  const 좋음 = 측정(픽스처('font-ok',
    `<p style="font-family:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#171820">K</p>`), CHROME);
  assert.equal(좋음.키트밖서체.length, 0, `정본 스택을 위반으로 잡았다: ${JSON.stringify(좋음.키트밖서체)}`);
});

test('그라디언트 배경은 대비 **판정을 포기**한다 (억지로 재면 오탐이 쏟아진다)', { skip: 크롬없음 }, () => {
  const p = 픽스처('gradient', '<div style="background:linear-gradient(90deg,#0F1730,#FF6B5C)"><p style="color:#F6F1E8">x</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 0, '그라디언트 위 글자를 위반으로 셌다');
  assert.ok(r.그라디언트건너뜀 >= 1, '건너뛴 사실을 세지 않았다 — 안 잰 것을 「0건」으로 보고하면 안 된다');
});

test('aria-hidden 장식은 대비만 면제하고 **색은 계속 검사**한다', { skip: 크롬없음 }, () => {
  const p = 픽스처('deco', '<span aria-hidden="true" style="color:#FF3E88;font-size:11px">✦</span>'
    + '<span aria-hidden="true" style="color:#123456;font-size:11px">✦</span>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 0, '장식의 대비를 쟀다 — WCAG 1.4.3 이 면제하는 자리다');
  assert.ok(r.키트밖색.some((v) => v.hex === '#123456'),
    'aria-hidden 을 색 검사까지 면제하면 「위반 지우개」가 된다');
});

test('<style>·<script>·<title> 의 텍스트는 안 센다 (브라우저 기본값을 위반으로 보고하던 결함)', { skip: 크롬없음 }, () => {
  const p = 픽스처('nonrender', '<p style="color:#171820">본문</p>');
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.length, 0,
    `안 그려지는 요소를 셌다: ${JSON.stringify(r.키트밖색)} — 첫 실행에서 Noto Sans KR 4건·순검정 4건이 이렇게 나왔다`);
});

test('로드 실패를 「위반 0」으로 읽지 않는다', { skip: 크롬없음 }, () => {
  const p = path.join(임시, 'empty.html');
  fs.writeFileSync(p, '<!doctype html><meta charset="utf-8"><body></body>', 'utf8');
  assert.throws(() => 측정(p, CHROME), /하나도 못 쟀다/,
    '텍스트 0개인 문서가 조용히 통과했다 — 빈 문서의 위반은 언제나 0이다');
});

/* ── 2. 실저장소 — 거짓양성만 본다 ────────────────────────────────────────── */
for (const rel of 대상) {
  test(`[등록층] ${rel} — 렌더 위반 0`, { skip: 크롬없음 }, () => {
    const r = 측정(path.join(ROOT, rel), CHROME);
    const 요약 = (a) => a.slice(0, 5).map((v) => JSON.stringify(v)).join('\n      ');
    assert.equal(r.대비위반.length, 0, `대비 위반 ${r.대비위반.length}건\n      ${요약(r.대비위반)}`);
    assert.equal(r.키트밖색.length, 0, `키트 밖 색 ${r.키트밖색.length}건\n      ${요약(r.키트밖색)}`);
    assert.equal(r.키트밖서체.length, 0, `키트 밖 서체 ${r.키트밖서체.length}건\n      ${요약(r.키트밖서체)}`);
    assert.ok(r.잰것 > 50, `잰 요소가 ${r.잰것}개뿐 — 스캔이 헛돌고 있다`);
  });
}

/* ── 3. 사본 동일성 — 크롬 없이도 돈다 ────────────────────────────────────── */
test('라이브 카드와 docs 사본이 바이트 단위로 같다', () => {
  const r = execFileSync(process.execPath, [path.join(ROOT, 'tools', '크루카드사본.js'), '--check'],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(r, /전부 일치/);
});

/* ── 4. 정본 값이 두 곳에 적히지 않았는지 ─────────────────────────────────── */
test('키트 19색이 DESIGN.md 와 어긋나지 않는다', () => {
  const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  // DESIGN.md §2 표에 적힌 색은 전부 이 도구의 KIT 안에 있어야 한다.
  const 표색 = new Set((design.match(/`#[0-9A-Fa-f]{6}`/g) || []).map((s) => s.slice(1, -1).toUpperCase()));
  const 빠짐 = [...표색].filter((h) => !KIT[h]);
  assert.deepEqual(빠짐, [], `DESIGN.md 에 있는데 린트의 KIT 에 없는 색: ${빠짐.join(', ')}`);
});
