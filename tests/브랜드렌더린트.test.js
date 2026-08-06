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
const { findChrome, 측정, 대상, 제외, KIT, 킷밖_유예, ROOT } = 린트;

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

/* 조항 ⓔ(v1.8) — Slate·Slate 2 는 「킷에 있는 색」이라 ②키트밖색으로는 절대 안 걸린다.
 * 이 색의 유일한 오용은 **바닥을 바꿔 쓰는 것**이고, 그건 ①대비만이 잡는다.
 * 조항이 글로만 살면 다음 사람이 지운다 — 그래서 실제로 물리는지를 여기서 못박는다. */
test('Slate(다크 전용)를 라이트 바닥에 쓰면 잡는다 — 조항 ⓔ의 유일한 오용 형태', { skip: 크롬없음 }, () => {
  const p = 픽스처('slate-on-light', '<div style="background:#FBF7EE"><p style="color:#8A93AD;font-size:32px">v9.187</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.length, 0, 'Slate 는 킷 색이다 — ②로 걸리면 안 된다(그러면 이 테스트는 딴 것을 재는 것이다)');
  assert.equal(r.대비위반.length, 1, 'Slate on Paper(2.86)를 못 잡았다 — 32px 라 대형 기준 3.0 인데도 미달이다');
  assert.equal(r.대비위반[0].fg, '#8A93AD');
});

test('Slate 2(라이트 전용)를 다크 바닥에 쓰면 소형에서 잡는다 — 대형은 3.07 이라 말로 막는 구간', { skip: 크롬없음 }, () => {
  const p = 픽스처('slate2-on-dark', '<div style="background:#0F1730"><p style="color:#5F657D;font-size:12px">v9.187</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.대비위반.length, 1, 'Slate 2 on Navy 2(3.07)를 소형에서 못 잡았다');
  assert.ok(r.대비위반[0].대비 < 4.5 && r.대비위반[0].대비 > 3,
    `대비가 ${r.대비위반[0].대비} — 3.07 근처여야 한다. 4.5 아래·3.0 위라서 **대형이면 통과**하고, 그 틈은 정본 조항 ⓔ가 막는다`);
});

test('허용 바닥의 Slate·Slate 2 는 통과한다 (자기 처방을 막지 않는지 · F103)', { skip: 크롬없음 }, () => {
  const p = 픽스처('slate-ok',
    '<div style="background:#0F1730"><p style="color:#8A93AD;font-size:12px">다크 3층</p></div>'
    + '<div style="background:#FBF7EE"><p style="color:#5F657D;font-size:12px">라이트 3층</p></div>');
  const r = 측정(p, CHROME);
  assert.deepEqual(r.대비위반, [], '조항이 시키는 대로 썼는데 빨간불이면 사람은 가드를 끈다');
  assert.deepEqual(r.키트밖색, [], 'Slate 2색이 킷 파생에 안 실렸다');
});

/* 조항 ⓖ(v1.10) — Emerald 도 킷 색이라 ②로는 안 걸린다. 유일한 오용은 **다크에 쓰는 것**이고
 * (Navy 2 위 2.98 — 대형 기준 3.0 조차 못 넘는다) 그건 ①대비만 잡는다. Slate 2 와 달리
 * 「대형이면 통과하는 틈」이 없어서, 여기만 초록이면 조항이 기계로 지켜진다. */
test('Emerald(라이트 전용)를 다크 바닥에 쓰면 크기 불문 잡는다 — 조항 ⓖ의 유일한 오용 형태', { skip: 크롬없음 }, () => {
  const p = 픽스처('emerald-on-dark',
    '<div style="background:#0F1730"><p style="color:#13724A;font-size:12px">+120 P</p>'
    + '<p style="color:#13724A;font-size:32px">LEVEL 3</p></div>');
  const r = 측정(p, CHROME);
  assert.equal(r.키트밖색.length, 0, 'Emerald 는 킷 색이다 — ②로 걸리면 이 테스트는 딴 것을 재는 것이다');
  assert.equal(r.대비위반.length, 2, 'Navy 2 위 2.98 은 소형(4.5)도 대형(3.0)도 미달이라 둘 다 걸려야 한다');
  assert.ok(r.대비위반.every((v) => v.fg === '#13724A' && v.대비 < 3),
    `대비가 ${r.대비위반.map((v) => v.대비)} — 2.98 근처여야 한다(3.0 을 넘으면 대형이 새어 나간다)`);
});

test('허용 바닥의 Emerald 는 통과한다 — 라이트 4면 + 그 면 위 글자 (자기 처방 검사 · F103)', { skip: 크롬없음 }, () => {
  const p = 픽스처('emerald-ok',
    '<div style="background:#FBF7EE"><p style="color:#13724A;font-size:12px">Paper 5.56</p></div>'
    + '<div style="background:#F6F1E8"><p style="color:#13724A;font-size:12px">Cream 5.28</p></div>'
    + '<div style="background:#FFE9E4"><p style="color:#13724A;font-size:12px">Wash 5.10</p></div>'
    + '<div style="background:#EFE7D7"><p style="color:#13724A;font-size:12px">Cream 2 4.83</p></div>'
    + '<div style="background:#13724A"><p style="color:#F6F1E8;font-size:12px">면 위 글자는 Cream</p></div>');
  const r = 측정(p, CHROME);
  assert.deepEqual(r.대비위반, [], '조항이 시키는 대로 썼는데 빨간불이면 사람은 가드를 끈다');
  assert.deepEqual(r.키트밖색, [], 'Emerald 가 킷 파생에 안 실렸다');
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
    <div id="a" style="background:rgba(246,241,232,.55);transition:background 10s linear"><span style="color:#171820">전환</span></div>
    <div id="b" style="background:#C8FF3D;animation:drift 10s linear infinite"><span style="color:#171820">회전</span></div>
    <div id="c" style="background:#C8FF3D"><span style="color:#171820">WAAPI</span></div>
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
    '<div class="kc-page"><p style="font-family:Fraunces,serif;color:#171820">K</p></div>'), CHROME);
  assert.equal(안.키트밖서체.length, 0,
    `예약 구역 안의 Fraunces 를 위반으로 잡았다 — 그러면 사람은 정본 §4-1 을 따르고도 빨간불을 본다: ${JSON.stringify(안.키트밖서체)}`);

  const 밖 = 측정(픽스처('kc-outside',
    '<div class="page"><p style="font-family:Fraunces,serif;color:#171820">K</p></div>'), CHROME);
  assert.ok(밖.키트밖서체.some((v) => v.font === 'Fraunces'),
    '구역 밖 Fraunces 를 놓쳤다 — 예외가 저장소 전체로 새는 방향이다');

  // 조상 체인으로 재는지: 손자 요소도 구역 안이어야 한다(closest 가 아니라 자기 클래스만 보면 여기서 샌다)
  const 손자 = 측정(픽스처('kc-descendant',
    '<div class="kc-card"><span><b style="font-family:Cormorant,serif;color:#171820">Ө</b></span></div>'), CHROME);
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
test('킷이 DESIGN.md 와 어긋나지 않는다', () => {
  const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  // DESIGN.md §2 표에 적힌 색은 전부 이 도구의 KIT 안에 있어야 한다.
  const 표색 = new Set((design.match(/`#[0-9A-Fa-f]{6}`/g) || []).map((s) => s.slice(1, -1).toUpperCase()));
  const 빠짐 = [...표색].filter((h) => !KIT[h]);
  assert.deepEqual(빠짐, [], `DESIGN.md 에 있는데 린트의 KIT 에 없는 색: ${빠짐.join(', ')}`);
});
