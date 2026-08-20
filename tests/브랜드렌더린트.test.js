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
const { findChrome, 측정, 대상, 제외, KIT, 킷밖_유예, 구역밖_유예, KC_COLORS, KC_SCOPE, ROOT } = 린트;

const CHROME = findChrome();
const 크롬없음 = !CHROME && '크롬이 없다 — 렌더 검사를 **안 돌렸다**(통과 아님). CHROME_PATH 로 지정 가능';

/* 픽스처를 임시 디렉터리에 쓴다. 저장소 안에 더러운 HTML 을 두면 다른 가드들이 그걸 잡는다. */
const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lint-fx-'));
test.after(() => { try { fs.rmSync(임시, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } });

function 픽스처(이름, body) {
  const p = path.join(임시, `${이름}.html`);
  /* 바탕은 «현재 킷»의 Paper 를 쓴다 — 옛 값(#F6F1E8)이 남으면 킷 개정 때 모든 픽스처가
   * 「킷 밖 색」으로 한꺼번에 빨개진다(2026-08-19 GitHub-hosted 첫 실행이 정확히 그 사고였다). */
  fs.writeFileSync(p, `<!doctype html><meta charset="utf-8"><body style="background:#FBF7F0">${body}</body>`, 'utf8');
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

/* 「킷밖 유예」는 색을 통과시키는 문이다 — 판정이 끝나면 반드시 닫혀야 하는데,
 * 닫는 것을 사람이 기억해야 하면 안 닫힌다. 킷에 편입되는 순간 이 항목은 거짓이 되므로
 * 그때 빨개지게 해 둔다(유예가 영구 화이트리스트로 굳는 것이 이 장치의 유일한 실패 형태다). */
test('킷밖 유예가 낡지 않았다 — 킷에 편입됐으면 유예를 지운다', () => {
  const 킷hex = new Set(require('../docs/디자인_토큰.json').색.킷.map((c) => c.hex.toUpperCase()));
  for (const [hex, v] of Object.entries(킷밖_유예)) {
    assert.ok(!킷hex.has(hex.toUpperCase()),
      `${v.이름} ${hex} 이 킷에 들어왔다 — 유예는 이제 거짓이다. tools/브랜드렌더린트.js 의 킷밖_유예 에서 지워라`);
    assert.ok(v.왜 && v.왜.length >= 40, `${hex} 유예에 사유가 부실하다 — 이유 없는 통과는 두지 않는다`);
    assert.ok(/⏳/.test(v.왜), `${hex} 유예에 누가 판정할지가 없다 — 주인 없는 유예는 안 닫힌다`);
  }
});

test('등록층과 제외가 겹치지 않는다', () => {
  const 제외집합 = new Set(제외.map(([r]) => r));
  for (const rel of 대상) assert.ok(!제외집합.has(rel), `${rel} 이 등록과 제외에 동시에 있다`);
});

/* 「구역밖 유예」도 같은 성격의 문이다 — 다만 여기서 「그 위반이 아직 있는가」를 검사하면
 * **버그가 남아 있기를 요구하는 회귀**가 된다(유호님이 고치는 순간 빨개진다). 그래서
 * 썩는 형태만 본다: 가리키는 파일이 없거나, 사유·주인이 없는 유예. */
test('구역밖 유예가 낡지 않았다 — 죽은 경로·주인 없는 유예를 막는다', () => {
  for (const [키, 사유] of Object.entries(구역밖_유예)) {
    const i = 키.indexOf(':');
    assert.ok(i > 0, `유예 키 형식이 아니다(파일:셀렉터): ${키}`);
    const rel = 키.slice(0, i);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `유예가 없는 파일을 가리킨다: ${rel}`);
    assert.ok(사유 && 사유.length >= 15, `${키} 유예에 사유가 없다 — 이유 없는 통과는 두지 않는다`);
  }
  /* 유예마다 판정 주인(⏳)이 있어야 한다. `some` 이 아니라 `every` 인 이유가 둘이다:
   * ① `some` 은 **유예가 최소 1건 남아 있기를 요구**한다 = 버그가 남아 있기를 요구하는 회귀다
   *    (실제로 2026-08-07 표지 띠 4건이 「C안」으로 해소돼 목록이 비자 이 줄이 빨개졌다).
   * ② 주인 없는 유예 1건은 나머지가 멀쩡해도 안 닫힌다 — 검사는 건별이어야 한다. */
  for (const [키, 사유] of Object.entries(구역밖_유예)) {
    assert.match(사유, /⏳/, `${키} 유예에 판정 주인(⏳)이 없다 — 주인 없는 유예는 안 닫힌다`);
  }
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

/* ── 조항 ⓙ(v1.13 · 2027 킷) — 몸통색의 면/글자 문법 ─────────────────────────
 * 새 실의 몸통(Lapis·Meadow·Pop)은 전부 킷 색이라 ②키트밖색으로는 절대 안 걸린다.
 * 유일한 오용은 **글자 문법을 틀리는 것**이고, 그건 ①대비만이 잡는다.
 * 조항이 글로만 살면 다음 사람이 지운다 — 그래서 실제로 물리는지를 여기서 못박는다.
 * (구 조항 ⓔ Slate·ⓖ Emerald 회귀가 이 자리에 있었다 — 그 색들은 08-20 킷에서 역사가 됐다.) */
test('청금석 면 위 Ink 글자를 소형에서 잡는다 — 조항 ⓙ 「Lapis 면 위 글자는 Paper」', { skip: 크롬없음 }, () => {
  const p = 픽스처('lapis-ink', '<div style="background:#3D6BC9"><p style="color:#2B2320;font-size:12px">힌트 보기</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.length, 0, 'Lapis·Ink 는 킷 색이다 — ②로 걸리면 이 테스트는 딴 것을 재는 것이다');
  assert.equal(r.대비위반.length, 1, 'Lapis 면 위 Ink(3.04)를 소형에서 못 잡았다');
  assert.ok(r.대비위반[0].대비 < 4.5 && r.대비위반[0].대비 > 3,
    `대비가 ${r.대비위반[0].대비} — 3.04 근처여야 한다. 4.5 아래·3.0 위라 **대형이면 통과**하고, 그 틈은 조항 ⓙ가 말로 막는다`);
});

/* Meadow 몸통은 「대형이면 통과하는 틈」이 없다(2.30) — 여기만 초록이면 「면 전용」이 기계로 지켜진다. */
test('메도우 몸통을 종이 위 글자로 쓰면 크기 불문 잡는다 — 조항 ⓙ 「Meadow 는 면 전용」', { skip: 크롬없음 }, () => {
  const p = 픽스처('meadow-text',
    '<div><p style="color:#7DB45A;font-size:12px">+120 P</p>'
    + '<p style="color:#7DB45A;font-size:32px">LEVEL 3</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.length, 0, 'Meadow 는 킷 색이다 — ②로 걸리면 이 테스트는 딴 것을 재는 것이다');
  assert.equal(r.대비위반.length, 2, 'Paper 위 Meadow(2.30)는 소형(4.5)도 대형(3.0)도 미달이라 둘 다 걸려야 한다');
  assert.ok(r.대비위반.every((v) => v.fg === '#7DB45A' && v.대비 < 3),
    `대비가 ${r.대비위반.map((v) => v.대비)} — 2.30 근처여야 한다(3.0 을 넘으면 대형이 새어 나간다)`);
});

test('팝 몸통을 종이 위 «소형» 글자로 쓰면 잡는다 — 대형은 3.20 이라 조항 ⓙ가 말로 막는 구간', { skip: 크롬없음 }, () => {
  const p = 픽스처('pop-small', '<div><p style="color:#E05C97;font-size:12px">이벤트 D-2</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 1, 'Paper 위 Pop(3.20)을 소형에서 못 잡았다');
  assert.ok(r.대비위반[0].대비 < 4.5 && r.대비위반[0].대비 > 3,
    `대비가 ${r.대비위반[0].대비} — 3.20 근처여야 한다. 4.5 아래·3.0 위라 **큰 글자 전용**이고, 그 경계가 조항 ⓙ다`);
});

test('조항 ⓙ의 처방 문법은 전부 통과한다 (자기 처방을 막지 않는지 · F103)', { skip: 크롬없음 }, () => {
  const p = 픽스처('j-ok',
    '<div style="background:#3D6BC9"><p style="color:#FBF7F0;font-size:12px">청금석 면 + 종이 글자 4.74</p></div>'
    + '<div style="background:#7DB45A"><p style="color:#2B2320;font-size:12px">메도우 면 + 잉크 글자 6.27</p></div>'
    + '<div><p style="color:#3F6B2E;font-size:12px">종이 위 메도우 Deep 글자 5.86</p></div>'
    + '<div style="background:#F5C445"><p style="color:#2B2320;font-size:12px">버터 면 + 잉크 글자 9.43</p></div>'
    + '<div style="background:#F96859"><p style="color:#2B2320;font-size:12px">코랄 면 + 잉크 글자 5.24</p></div>'
    + '<div><p style="color:#99295D;font-size:12px">종이 위 팝 Deep 글자 6.95</p></div>');
  const r = 측정(p, CHROME);
  assert.deepEqual(r.대비위반, [], '조항이 시키는 대로 썼는데 빨간불이면 사람은 가드를 끈다');
  assert.deepEqual(r.키트밖색, [], '2027 실이 킷 파생에 안 실렸다');
});

test('텍스트가 없는 컨테이너의 면도 잡는다 (자식에게 글을 넘긴 패널이 숨던 자리)', { skip: 크롬없음 }, () => {
  const p = 픽스처('panel', '<div style="background:#FFFFFF"><span style="color:#2B2320">글은 자식에</span></div>');
  const r = 측정(p, CHROME);
  assert.ok(r.키트밖색.some((v) => v.hex === '#FFFFFF' && v.자리 === '면'),
    '직접 텍스트가 없는 요소의 배경을 안 봤다 — 부분 집계가 완전 집계처럼 보이는 부류다');
});

/* ── 의사요소 ────────────────────────────────────────────────────────────────
 * 2026-08-07 실측: `getComputedStyle(el)` 은 요소 자신만 본다. 색이 오직 ::before 로만
 * 그려진 페이지에서 이 린트가 **「키트 밖 색 0」** 을 냈다 — 새는 방향은 언제나 통과다.
 * 크루카드의 점·띠가 정확히 그 형태라, 라이브의 그 색들은 여태 한 번도 검사되지 않았다. */
test('::before 로만 칠한 면·글자도 잡는다 (요소 자신만 보던 구멍)', { skip: 크롬없음 }, () => {
  const p = 픽스처('pseudo-bad', `
    <style>
      .dot::before{content:'';display:inline-block;width:12px;height:12px;background:#FF00FF}
      .txt::after{content:' 꼬리';color:#00FF00}
    </style>
    <p class="dot" style="color:#2B2320">면을 의사요소로만</p>
    <p class="txt" style="color:#2B2320">글자를 의사요소로만</p>`);
  const r = 측정(p, CHROME);
  assert.ok(r.키트밖색.some((v) => v.hex === '#FF00FF' && /::before/.test(v.sel)),
    `::before 배경을 놓쳤다: ${JSON.stringify(r.키트밖색)}`);
  assert.ok(r.키트밖색.some((v) => v.hex === '#00FF00' && /::after/.test(v.sel)),
    `::after 글자색을 놓쳤다: ${JSON.stringify(r.키트밖색)}`);
});

test('그려지지 않는 의사요소는 세지 않는다 (전 요소가 유령 2개씩 내던 오탐)', { skip: 크롬없음 }, () => {
  // content 가 없으면 ::before 는 렌더되지 않는다 — 그 background 는 화면에 없는 값이다.
  const p = 픽스처('pseudo-ghost',
    `<style>.g::before{background:#FF00FF}</style><p class="g" style="color:#2B2320">안 그려진다</p>`);
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.length, 0, `렌더되지 않는 의사요소를 위반으로 잡았다: ${JSON.stringify(r.키트밖색)}`);
});

/* ── 직책(구역) ──────────────────────────────────────────────────────────────
 * DESIGN.md 철칙 ④ — KC 4색은 Part 6 전용. 킷 멤버십만 보던 시절엔 어디에 써도 초록이었다. */
test('KC 색을 Part 6 밖에 쓰면 잡는다 (킷 안이어도 직책 위반)', { skip: 크롬없음 }, () => {
  const p = 픽스처('kc-out',
    `<style>.bar::before{content:'';display:inline-block;width:3px;height:12px;background:#4E7CFF}</style>
     <p class="bar" style="color:#2B2320">표지 띠</p>
     <p style="color:#FF3E88;background:#08090C;font-size:32px">Part 6 밖 핫핑크 글자</p>`);
  const r = 측정(p, CHROME);
  assert.ok(r.구역밖색.some((v) => v.hex === '#4E7CFF'), `::before 의 KC 색을 놓쳤다: ${JSON.stringify(r.구역밖색)}`);
  assert.ok(r.구역밖색.some((v) => v.hex === '#FF3E88'), `글자의 KC 색을 놓쳤다: ${JSON.stringify(r.구역밖색)}`);
  assert.deepEqual(r.키트밖색, [], 'KC 색은 킷 안이다 — 킷밖으로 이중 계상하면 안 된다');
});

test('KC 구역 안의 KC 색은 통과한다 (자기 처방을 막지 않는지 · F103)', { skip: 크롬없음 }, () => {
  const p = 픽스처('kc-in',
    `<section class="kc-page"><div class="kc-card">
       <p style="color:#FF3E88;background:#08090C;font-size:32px">Part 6 안</p>
     </div></section>`);
  const r = 측정(p, CHROME);
  assert.deepEqual(r.구역밖색, [], `제 구역 안의 KC 색을 위반으로 잡았다 — 따를 수 없는 처방이 된다: ${JSON.stringify(r.구역밖색)}`);
});

/* ── 표지 4칸 띠 — 유호님 확정 2026-08-07 2차 「예전처럼 알록달록하게」 ──────────
 * 색 경계(`KC_COLOR_SCOPE`)만 `.cov-deliverables` 로 넓히고 서체 경계(`KC_SCOPE`)는 그대로 뒀다.
 * 아래 두 시험이 **그 분리 자체**를 못 박는다 — 하나라도 빠지면 다음 사람이 상수를 다시 합친다.
 * (같은 날 오전의 「C안」은 경계가 `.kc-preview` 였고 이 지시로 폐기됐다.) */
test('표지 띠(.cov-deliverables) 안의 KC 색은 통과한다 (자기 처방 검사 · F103)', { skip: 크롬없음 }, () => {
  const p = 픽스처('cov-band-color',
    `<style>.del::before{content:'';display:inline-block;width:3px;height:12px;background:#FF3E88}
            .del2::before{content:'';display:inline-block;width:3px;height:12px;background:#4E7CFF}</style>
     <div class="cov-deliverables">
       <div class="del"><span style="color:#2B2320">03 · K-Track</span></div>
       <div class="del del2"><span style="color:#2B2320">02 · Roadmap</span></div>
     </div>`);
  const r = 측정(p, CHROME);
  assert.deepEqual(r.구역밖색, [],
    `표지 띠의 KC 색을 위반으로 잡았다 — 유호님이 확정한 화면이 영구 빨간불이 된다: ${JSON.stringify(r.구역밖색)}`);
});

test('표지 띠는 **서체까지** 넓히지 않는다 (색만 넓힌 경계가 서체로 새는지)', { skip: 크롬없음 }, () => {
  const p = 픽스처('cov-band-font',
    '<div class="cov-deliverables"><div class="del"><p style="font-family:Fraunces,serif;color:#2B2320">K</p></div></div>');
  const r = 측정(p, CHROME);
  assert.ok(r.키트밖서체.some((v) => v.font === 'Fraunces'),
    '표지 띠에서 Part 6 서체가 통과했다 — 표지가 Part 6 행세를 하게 되고, 두 상수를 나눈 이유가 사라진다');
});

test('KC 색 목록은 토큰의 05 K-Culture 팔레트에서 파생한다 (손 사본 금지 · F143)', () => {
  const 팔레트 = require('../docs/디자인_토큰.json').색.킷
    .filter((c) => c.팔레트 === '05 K-Culture').map((c) => c.hex.toUpperCase()).sort();
  assert.deepEqual(Object.keys(KC_COLORS).sort(), 팔레트,
    'KC_COLORS 가 토큰과 갈라졌다 — 사본을 두면 갈라지고, 갈라지는 방향은 언제나 통과다');
  assert.ok(팔레트.length === 4, `05 K-Culture 가 ${팔레트.length}색이다 — 철칙 ④ 문구(「KC 4색」)와 어긋난다`);
});

test('정본 3종 밖 서체를 잡되, **폴백 스택은 통과**시킨다', { skip: 크롬없음 }, () => {
  const 나쁨 = 측정(픽스처('font-bad', '<p style="font-family:Fraunces,serif;color:#2B2320">K</p>'), CHROME);
  assert.ok(나쁨.키트밖서체.some((v) => v.font === 'Fraunces'), '키트 밖 서체를 놓쳤다');

  // 정본 스택 그대로. 가드가 이걸 잡으면 사람은 정본을 따르고도 빨간불을 본다 → 가드를 끈다.
  const 좋음 = 측정(픽스처('font-ok',
    `<p style="font-family:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#2B2320">K</p>`), CHROME);
  assert.equal(좋음.키트밖서체.length, 0, `정본 스택을 위반으로 잡았다: ${JSON.stringify(좋음.키트밖서체)}`);
});

/* 전환·애니메이션 중간 프레임은 저자가 지정한 색이 아니다. 이걸 재면 원인 파일이 멀쩡한데
 * 가드만 빨개지고, 게다가 **타이밍에 걸리므로 로컬은 통과하고 CI 만 실패한다**(2026-08-04 실측:
 * `.m-card-lbl .dot` 의 `transition:background .3s` 중간값 #D3FC65 로 CI 적색 · F105).
 *
 * 🔑 진행률을 **손으로 못박는다**(`currentTime`). 앞 판은 rAF 로 전환을 걸어 두기만 했는데,
 *   load 시점의 진행이 ≈0 이라 값이 시작색(키트 안) 그대로였다 — 즉 **전환 팔이 공허**했고
 *   위반은 애니메이션 팔에서만 나와서, 정작 CI 를 빨갛게 만든 그 형태를 아무도 재현하지
 *   않고 있었다(2026-08-06 실측: 시간정지를 꺼도 나오는 건 `#FF0000@div#b` 하나뿐이었다).
 *   러너 속도에 기대면 픽스처 자신이 플래키가 된다 — 그래서 시간을 재지 않고 **세운다**.
 * 세 종류를 다 건다: CSS 전환 · CSS 애니메이션 · WAAPI(`element.animate`).
 *   WAAPI 는 `animation:none` 으로 **안 멈춘다**(실측 중간값 #808000). */
test('전환·애니메이션·WAAPI 중간 프레임을 재지 않는다 (CI 만 빨개지던 플래키 · F105)', { skip: 크롬없음 }, () => {
  const p = 픽스처('motion', `
    <style>@keyframes drift{0%{background:#FF0000}100%{background:#00FF00}}</style>
    <div id="a" style="background:rgba(251,247,240,.55);transition:background 10s linear"><span style="color:#2B2320">전환</span></div>
    <div id="b" style="background:#C8FF3D;animation:drift 10s linear infinite"><span style="color:#2B2320">회전</span></div>
    <div id="c" style="background:#C8FF3D"><span style="color:#2B2320">WAAPI</span></div>
    <script>
    /* 페이지 자신의 load 리스너가 **먼저** 돈다 — 측정기는 body 끝에 주입돼 등록이 더 늦다.
       그래서 여기서 세워 둔 「진행 50%」 상태를 측정기가 그대로 본다.
       ⚠ 이 픽스처 안에 body 닫는 태그를 문자로 쓰지 말 것 — 측정기가 그 첫 자리에 주입돼
         스크립트 안으로 들어가고, 증상은 「측정기가 결과를 못 냈다」로만 나온다(실측). */
    window.addEventListener('load', () => {
      const a = document.getElementById('a');
      a.style.background = '#C8FF3D';
      getComputedStyle(a).backgroundColor;              // 전환 시작을 확정시킨다
      document.getElementById('c').animate(
        [{ backgroundColor: '#FF0000' }, { backgroundColor: '#00FF00' }],
        { duration: 10000, iterations: Infinity });
      for (const an of document.getAnimations()) an.currentTime = 5000;   // 셋 다 정확히 50%
    });
    </script>`);
  const r = 측정(p, CHROME);
  const 중간값 = r.키트밖색.filter((v) => v.hex !== 'TRANSPARENT');
  assert.deepStrictEqual(중간값, [],
    `전환·애니메이션 중간색을 위반으로 잡았다 — 저자가 지정한 값이 아니다: ${JSON.stringify(중간값)}`);

  // 🔑 세 팔이 **각자** 물리는지 따로 못박는다 — 합계만 보면 한 팔이 공허해져도 다른 팔이 가려준다.
  //   그게 앞 판이 F105 의 실제 형태(전환)를 놓친 경로다.
  const 변이 = 측정(p, CHROME, { freeze: false });
  const 잡힌곳 = new Set(변이.키트밖색.filter((v) => v.hex !== 'TRANSPARENT').map((v) => v.sel));
  for (const [sel, 종류] of [['div#a', 'CSS 전환'], ['div#b', 'CSS 애니메이션'], ['div#c', 'WAAPI']]) {
    assert.ok(잡힌곳.has(sel),
      `${종류} 팔이 공허하다 — 시간정지를 꺼도 중간색이 안 나온다(잡힌 곳: ${[...잡힌곳].join(', ') || '없음'}). 이 팔은 아무것도 증명하지 않는다`);
  }
});

/* Part 06 예약 서체(정본 §4-1)의 무게는 **경계**에 있다 — 「이 폰트를 허용한다」가 아니라
 * 「이 구역 안에서만 허용한다」다. 경계는 조상 체인이라 소스 검색으로는 원리상 못 재고,
 * 렌더 층에서만 갈린다. 두 방향을 같이 못박는다 — 한쪽만 재면 반대쪽으로 샌다. */
test('Part 06 예약 서체는 .kc-page 안에서만 통과한다 (경계가 곧 예외다)', { skip: 크롬없음 }, () => {
  const 안 = 측정(픽스처('kc-inside',
    '<div class="kc-page"><p style="font-family:Fraunces,serif;color:#2B2320">K</p></div>'), CHROME);
  assert.equal(안.키트밖서체.length, 0,
    `예약 구역 안의 Fraunces 를 위반으로 잡았다 — 그러면 사람은 정본 §4-1 을 따르고도 빨간불을 본다: ${JSON.stringify(안.키트밖서체)}`);

  const 밖 = 측정(픽스처('kc-outside',
    '<div class="page"><p style="font-family:Fraunces,serif;color:#2B2320">K</p></div>'), CHROME);
  assert.ok(밖.키트밖서체.some((v) => v.font === 'Fraunces'),
    '구역 밖 Fraunces 를 놓쳤다 — 예외가 저장소 전체로 새는 방향이다');

  // 조상 체인으로 재는지: 손자 요소도 구역 안이어야 한다(closest 가 아니라 자기 클래스만 보면 여기서 샌다)
  const 손자 = 측정(픽스처('kc-descendant',
    '<div class="kc-card"><span><b style="font-family:Cormorant,serif;color:#2B2320">Ө</b></span></div>'), CHROME);
  assert.equal(손자.키트밖서체.length, 0, `구역의 손자 요소를 밖으로 판정했다: ${JSON.stringify(손자.키트밖서체)}`);
});

test('그라디언트 배경은 대비 **판정을 포기**한다 (억지로 재면 오탐이 쏟아진다)', { skip: 크롬없음 }, () => {
  const p = 픽스처('gradient', '<div style="background:linear-gradient(90deg,#0F1730,#FF6B5C)"><p style="color:#F6F1E8">x</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 0, '그라디언트 위 글자를 위반으로 셌다');
  assert.ok(r.그라디언트건너뜀 >= 1, '건너뛴 사실을 세지 않았다 — 안 잰 것을 「0건」으로 보고하면 안 된다');
});

/* 반투명 배경 — 알파를 무시하면 **양방향으로** 틀린다.
 * 실측 2026-08-06: 시스템 대장 내부판의 legend(코랄 12% on 네이비)가 코랄 원색으로 잡혀
 * 「대비 2.07」 오탐 2건을 냈다. 오탐은 사람이 가드를 끄게 만들고, 반대 방향은 조용히 샌다.
 * 그래서 두 방향을 한 픽스처씩 못박는다 — 한쪽만 두면 다음 사람이 반대쪽을 지운다. */
test('반투명 배경을 조상과 **합성**해서 잰다 — ① 옅은 틴트를 원색으로 읽지 않는다', { skip: 크롬없음 }, () => {
  const p = 픽스처('alpha-tint', '<div style="background:#0F1730">'
    + '<div style="background:rgba(255,107,92,.12)"><p style="color:#E7DDC7;font-size:11.5px">범례</p></div></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 0,
    `코랄 12% 를 원색으로 읽었다(실제 배경은 어둡다): ${JSON.stringify(r.대비위반)}`);
});

test('반투명 배경을 조상과 **합성**해서 잰다 — ② 밝은 반투명이 글자를 지우는 것은 잡는다', { skip: 크롬없음 }, () => {
  const p = 픽스처('alpha-wash', '<div style="background:#0F1730">'
    + '<div style="background:rgba(246,241,232,.92)"><p style="color:#F6F1E8;font-size:11.5px">지워진 글</p></div></div>');
  const r = 측정(p, CHROME);
  assert.ok(r.대비위반.length >= 1,
    '크림 92% 위의 크림 글자를 놓쳤다 — 알파를 무시하면 배경을 네이비로 읽어 통과한다');
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
  const p = 픽스처('nonrender', '<p style="color:#2B2320">본문</p>');
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

/* ── 1-b. 마스코트 바닥 (유호님 확정 08-13 실행 규칙 ②) ────────────────────────
 * 체리 마스코트를 코랄 짙은 면 위에 올리면 캐릭터 하이라이트가 바닥에 먹혀 윤곽이 뭉갠다.
 * 🔑 첫 구현은 **허용 바닥을 손 목록**으로 뒀다가 캐러셀의 Cream 바닥을 위반으로 잡았다 —
 *   재보니 23.5 로 충분했고, 틀린 것은 파일이 아니라 목록이었다. 그래서 판정을 색차 계산으로
 *   옮겼고, 아래 「막지 않는다」 쪽 테스트들이 그 회귀를 지킨다(손 목록으로 되돌리면 빨개진다). */
const 마스코트픽스처 = (이름, 바닥, 속성 = 'src="마스코트_누끼/본체.png"') =>
  픽스처(이름, `<div style="background:${바닥}"><img ${속성} alt="마스코트">`
    + '<p style="color:#2B2320">본문</p></div>');

test('마스코트 — 코랄 짙은 면 위는 **잡는다**(하이라이트가 먹힌다)', { skip: 크롬없음 }, () => {
  for (const [이름, 바닥] of [['soft', '#FFCFC6'], ['coral2', '#FF8877'], ['coral3', '#E8543F']]) {
    const r = 측정(마스코트픽스처(`mascot-${이름}`, 바닥), CHROME);
    assert.equal(r.마스코트잰것, 1, `${바닥}: 마스코트를 못 셌다 — 식별자(src 경로)가 안 물었다`);
    assert.equal(r.마스코트바닥위반.length, 1,
      `${바닥} 위 마스코트를 놓쳤다 — 새는 방향은 언제나 「통과」다`);
  }
});

test('마스코트 — 밝은 크림 계열은 **안 막는다**(손 목록이 Cream 을 금지했던 자리)', { skip: 크롬없음 }, () => {
  for (const [이름, 바닥] of [['paper', '#FBF7EE'], ['cream', '#F6F1E8'], ['cream2', '#EFE7D7'],
    ['cream3', '#E7DDC7'], ['wash', '#FFE9E4']]) {
    const r = 측정(마스코트픽스처(`mascot-ok-${이름}`, 바닥), CHROME);
    assert.equal(r.마스코트바닥위반.length, 0,
      `${바닥} 을 막았다 — 거짓양성은 사람이 가드를 끄게 만든다(실측 ΔE 16.2~24.6)`);
  }
});

test('마스코트 — 다크는 **안 막는다**(림 최암부가 최소인데도 26.7)', { skip: 크롬없음 }, () => {
  for (const [이름, 바닥] of [['navy2', '#0F1730'], ['navy', '#08090C'], ['navy3', '#2A3358']]) {
    const r = 측정(마스코트픽스처(`mascot-dark-${이름}`, 바닥), CHROME);
    assert.equal(r.마스코트바닥위반.length, 0,
      `${바닥} 을 막았다 — 다크는 마스코트가 가장 잘 뜨는 자리다(램프 최암부만 보고 막으면 안 된다)`);
  }
});

test('마스코트 — data URI 로 인라인해도 `data-synk-mascot` 이면 문다', { skip: 크롬없음 }, () => {
  // 1×1 투명 PNG — 경로가 사라진 자리를 속성이 대신 식별한다.
  const 인라인 = 'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" data-synk-mascot';
  const r = 측정(마스코트픽스처('mascot-inline', '#FFCFC6', 인라인), CHROME);
  assert.equal(r.마스코트잰것, 1, '속성으로 단 마스코트를 못 셌다 — 인라인 산출물이 통째로 안 보인다');
  assert.equal(r.마스코트바닥위반.length, 1, '속성 경로로 들어온 마스코트의 바닥을 안 쟀다');
});

test('마스코트 — 없는 파일에서 「0건」은 **깨끗함이 아니라 해당 없음**이다(분모)', { skip: 크롬없음 }, () => {
  const r = 측정(픽스처('mascot-none', '<p style="color:#2B2320">마스코트가 없는 문서</p>'), CHROME);
  assert.equal(r.마스코트잰것, 0, '없는 마스코트를 셌다');
  assert.equal(r.마스코트바닥위반.length, 0);
});

/* ── 1-b-2. 램프가 **의상별로 둘** (유호님 확정 08-15 ① 상태 의상) ─────────────
 * 평소=코랄(평상복램프) · 특별한 순간=체리(램프). 가르는 자리가 둘이라 새는 자리도 둘이다:
 *   ① 바닥 계산이 코랄을 안 읽으면 → **평상복을 못 본다**(제일 많이 보이는 옷인데)
 *   ② IP 색 판정이 코랄을 읽으면  → 킷 코랄 계열이 통째로 「마스코트 고유색」 행세를 한다
 * 둘 다 새는 방향이 「통과」라 눈으로는 안 보인다 — 그래서 양쪽을 픽스처로 못박는다. */
test('마스코트 바닥 — **평상복(코랄)** 단에 먹히는 면도 잡는다 (체리만 보면 놓치는 자리)', { skip: 크롬없음 }, () => {
  /* #941F19 = Coral Felt Rim 그 자체. 체리 램프와는 ΔE 14.8 로 «통과»라,
   * 바닥 계산이 체리만 읽는 옛 판으로 되돌아가면 이 줄이 빨개진다(탐지력 고정). */
  const r = 측정(마스코트픽스처('mascot-coral-rim', '#941F19'), CHROME);
  assert.equal(r.마스코트잰것, 1, '마스코트를 못 셌다 — 픽스처가 헛돌고 있다');
  assert.equal(r.마스코트바닥위반.length, 1,
    '평상복 램프에 먹히는 바닥을 놓쳤다 — 바닥 계산이 MASCOT(체리)만 읽고 있다');
});

test('마스코트 바닥 — 허용 넷은 두 의상을 합쳐도 **계속** 통과한다 (대가 = 새로 막히는 면 0)', () => {
  const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
  for (const 이름 of 토큰.색.마스코트.허용바닥.이름들) {
    const 킷색 = 토큰.색.킷.find((c) => c.이름 === 이름);
    assert.ok(킷색, `허용바닥 「${이름}」 이 킷에 없다 — 이름 참조가 갈라졌다`);
    const v = 린트.마스코트가바닥에서는가(킷색.hex);
    assert.ok(v.ok,
      `${이름}(${킷색.hex}) 이 막혔다 — 색차 ${v.최소} < ${린트.마스코트바닥_임계}. `
      + '평상복 램프를 더하면서 「올릴 수 있던 면」을 잃었다는 뜻이다(대가 실측은 0이었다).');
  }
});

test('IP 색 판정은 **체리만** 읽는다 — 평상복 코랄은 킷 색이지 마스코트 고유색이 아니다', () => {
  const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
  const 평상복 = (토큰.색.마스코트.평상복램프 || []).map((c) => c.hex.toUpperCase());
  assert.ok(평상복.length >= 3, '평상복 램프가 비었다 — 이 검사가 헛돈다');
  const 샌것 = 평상복.filter((h) => 린트.MASCOT[h]);
  assert.deepEqual(샌것, [],
    `평상복 코랄이 IP 색 집합에 들어갔다: ${샌것.join(', ')} — 마스코트 콘텐츠에서 킷 Coral 대신 `
    + '「측정된 렌더 hex」가 통과하게 되고, 그건 철칙 ④를 조용히 무디게 만든다.');
  /* 바닥 쪽은 반대로 **전부 들어 있어야** 한다 — 같은 값을 두 곳에 적으면 갈라진다(등록층 조항). */
  const 빠진것 = 평상복.filter((h) => !린트.MASCOT_바닥[h]);
  assert.deepEqual(빠진것, [], `평상복이 바닥 계산에서 빠졌다: ${빠진것.join(', ')}`);
});

test('평상복 램프는 어디서든 통과한다 — 조항 ⓙ 「킷 코랄 = 마스코트 램프」 (08-20 뒤집힘)', { skip: 크롬없음 }, () => {
  /* 옛 판은 「평상복 렌더값은 킷 밖」이었다 — 킷 Coral(#FF6B5C)과 램프(#F96859)가 다른 값이던
   * 시절의 규칙이다. 조항 ⓙ 가 둘을 한 값으로 합쳐 그 구분 자체가 사라졌다. */
  const p = 픽스처('coral-felt-anywhere', '<span style="color:#2B2320;background:#F96859">배지</span>');
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.filter((v) => v.hex === '#F96859').length, 0,
    '킷 Coral(#F96859 = 평상복 Core)을 킷 밖으로 잡았다 — 킷 파생이 토큰을 안 읽고 있다');
});

/* ── 1-c. 체리 램프는 **파일 단위**로 갈린다 (실행 규칙 ①) ──────────────────── */
test('체리 램프 — 마스코트 콘텐츠가 **아닌** 파일에서는 키트 밖 색으로 잡는다', { skip: 크롬없음 }, () => {
  const p = 픽스처('cherry-in-ui', '<button style="background:#FB7A87;color:#2B2320">이어서 풀기</button>');
  const r = 측정(p, CHROME);   // 픽스처는 마스코트콘텐츠 목록에 없다
  assert.ok(r.키트밖색.some((v) => v.hex === '#FB7A87'),
    '앱 UI 에 체리가 들어갔는데 통과시켰다 — 유호님 확정(B안)은 체리를 킷 색으로 올리지 않는 것이다');
});

test('체리 램프 — 퇴역(08-19) 후엔 마스코트 콘텐츠 «안»에서도 잡힌다 (면제 통로가 같이 닫혔다)', { skip: 크롬없음 }, () => {
  /* 옛 판은 콘텐츠 안 통과였다 — 체리가 IP 색이던 시절의 면제다. 퇴역 후 MASCOT 은 빈 집합이라
   * 면제가 사라졌고, 그게 정확한 동작이다: 캐러셀이 옛 체리 판을 다시 실으면 여기서 빨개진다. */
  const p = 픽스처('cherry-in-content', '<span style="color:#2B2320;background:#FB7A87">배지</span>');
  const r = 측정(p, CHROME, { 마스코트콘텐츠: true });
  assert.ok(r.키트밖색.some((v) => v.hex === '#FB7A87'),
    '퇴역한 체리가 마스코트 콘텐츠 면제로 통과했다 — 퇴역 뒤에도 면제 통로가 열려 있다');
});

test('마스코트콘텐츠 목록은 전부 실존하고 이유를 달고 있다', () => {
  for (const [rel, 이유] of Object.entries(린트.마스코트콘텐츠)) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `마스코트콘텐츠에 없는 파일이 남아 있다: ${rel}`);
    assert.ok(이유 && 이유.length >= 20, `이유 없는 통과는 두지 않는다: ${rel}`);
  }
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
test('킷이 DESIGN.md 와 어긋나지 않는다', () => {
  const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  /* DESIGN.md 가 인용하는 색은 전부 정본에 실존해야 한다 — 킷이거나 마스코트 램프이거나.
   * §2-b(마스코트 색)가 생기면서 인용 범위가 둘로 늘었다. */
  const 표색 = new Set((design.match(/`#[0-9A-Fa-f]{6}`/g) || []).map((s) => s.slice(1, -1).toUpperCase()));
  const 빠짐 = [...표색].filter((h) => !KIT[h] && !린트.MASCOT[h]);
  assert.deepEqual(빠짐, [], `DESIGN.md 에 있는데 정본(킷·마스코트) 어디에도 없는 색: ${빠짐.join(', ')}`);
});

/* 유호님 확정(2026-08-13 B안)의 기계 잠금 — 체리는 **킷이 아니다.**
 * 킷에 편입되는 순간 앱 UI 어디에나 쓸 수 있는 색이 되고, 그것이 확정을 뒤집는 형태다.
 * 「쓰지 말자」는 프로즈로는 안 지켜지므로 여기서 기계가 잡는다. */
test('🔴 체리 퇴역(08-19) — IP 색 집합은 «비어 있다», 그리고 그건 못 읽은 게 아니다', () => {
  /* 08-19 유호 확정 「이제 아예 안쓸거야」로 체리 램프를 토큰에서 뺐다. 그래서 MASCOT 은
   * 의도적으로 빈 집합이다 — «허용을 안 넓힌다»는 뜻이라 닫히는 쪽이다.
   * ⚠옛 판은 `>= 3` 으로 「안 실렸나」를 막았다. 그 방어를 버리지 않고 **값이 남아 있는 축**
   *   (MASCOT_바닥)으로 옮긴다 — 안 그러면 토큰이 깨져도 둘 다 0 이라 조용히 통과한다. */
  assert.deepEqual(Object.keys(린트.MASCOT), [],
    'IP 색 집합이 비어 있지 않다 — 체리는 퇴역했고, 코랄은 이미 킷 색이라 여기 오면 안 된다');
  const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
  assert.ok(토큰.색.마스코트, '토큰에 마스코트 절이 없다');
  assert.ok(!토큰.색.마스코트.램프, '체리 램프가 토큰에 되살아났다 — 퇴역 조항(_의상)부터 본다');
  /* 08-20 조항 ⓙ — 평상복 램프가 킷 코랄 축으로 «정당하게» 승격됐다(킷 41색). 개수 잠금은
   * tests/토큰정본.test.js 가 진다 — 여기는 체리의 부활만 문다. */
});

test('🔑 미측정 방어 — 바닥 축은 «실려 있어야» 한다 (여기까지 0 이면 아무것도 안 재고 통과한다)', () => {
  assert.ok(Object.keys(린트.MASCOT_바닥).length >= 3,
    '평상복 램프가 토큰에서 안 실렸다 — 「마스코트가 이 바닥에서 뜨는가」가 통째로 공회전한다');
  /* 08-20 조항 ⓙ — 킷 코랄 축 = 평상복 램프 «그대로»다(마스코트 색 = UI 색). 옛 단언은
   * 「겹치면 안 된다」였는데 그 걱정(측정 hex 가 킷 값을 대신)은 값이 같아진 지금 원리상 사라졌다.
   * 대신 반대 방향을 문다: 겹침이 **전부**여야 한다 — 일부만 겹치면 두 정본이 갈라진 것이다. */
  const 안겹침 = Object.keys(린트.MASCOT_바닥).filter((h) => !KIT[h]);
  assert.deepEqual(안겹침, [],
    `평상복 램프가 킷에 없다: ${안겹침.join(', ')} — 조항 ⓙ(킷 코랄 = 마스코트 램프)가 토큰에서 깨졌다`);
});
