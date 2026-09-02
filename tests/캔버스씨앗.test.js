/* 캔버스씨앗 회귀 — 클로드 디자인 캔버스에 실어 보내는 «킷»이 반쪽으로 나가지 않게.
 *
 * ■ 무엇을 지키나 (2026-09-03 · 첫 판이 흰 바탕으로 나왔다)
 *   `loom.css()` 는 간격은 스스로 정의하지만 **색은 «바깥이 준다»고 본다** — 저장소의 지면들이
 *   자기 `:root` 에 킷 색을 적어 두기 때문이다. 그런데 캔버스 아트보드는 **빈 종이**라 그 바깥이
 *   없다. 그대로 실으면 `var(--paper)` 가 못 풀려 **흰 바탕**이 되고, 부품은 멀쩡히 그려진다 —
 *   즉 «거의 맞는 얼굴로» 틀린다. 헤드리스 크롬으로 실제로 그려 보고서야 봤다.
 *
 * 🔴 이 도구가 새는 방향 둘, 둘 다 «조용하다»:
 *   ⓐ 씨앗이 킷의 한 층을 빠뜨린다(위 사고) — 화면은 그럴듯하다.
 *   ⓑ 이름표를 손으로 적어 두고 킷이 늘어도 안 따라간다 — 「그 색은 없다」가 거짓이 된다.
 *   ⇒ ①이 ⓐ를, ②가 ⓑ를 문다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const 루트 = path.resolve(__dirname, '..');
const 씨 = require(path.join(루트, 'tools', '캔버스씨앗.js'));
const 토큰 = require(path.join(루트, 'docs', '디자인_토큰.json'));

/* ── ① 급소 — 빈 종이에서도 킷 색이 풀린다 ────────────────────────────────── */

test('🔴 «가득» 씨앗이 킷 색을 스스로 싣는다 — 빈 캔버스에서 흰 바탕이 되던 자리', () => {
  const s = 씨.씨앗덩어리({ 맨: false, 지면: '밝은부품', 부품: null });
  for (const v of ['--paper', '--ink', '--coral', '--stitch']) {
    assert.match(s, new RegExp(v.replace('-', '\\-') + '\\s*:\\s*#'),
      `${v} 가 씨앗에 없다 — 캔버스에는 이 값을 줄 바깥이 없어서 그 자리가 통째로 비어 버린다`);
  }
  assert.match(s, /background:\s*var\(--paper\)/, '바닥이 Paper 를 안 깐다');
  assert.match(s, /\/\*loom부품:/, '구운 부품이 하나도 안 실렸다 — 「가득」이 아니다');

  /* 탐지력 — `loom.css()` «만» 실으면 왜 안 되는지를 값으로 못박는다.
     이 줄이 초록이면 위 단언은 자기 자신만 증명하는 것이 아니다. */
  const loom만 = require(path.join(루트, 'tools', 'lib', 'loom.js')).css({ 지면: '밝은부품' });
  assert.doesNotMatch(loom만, /--paper\s*:\s*#/,
    'loom 이 색을 스스로 낸다면 씨앗이 색을 더할 까닭이 사라진다 — 그날 이 칸을 다시 쓴다');
});

test('«맨» 씨앗도 색·서체는 싣는다(간격까지) — 뼈대 판도 킷 위에 선다', () => {
  const s = 씨.씨앗덩어리({ 맨: true, 지면: '밝은부품', 부품: null });
  assert.match(s, /--paper\s*:\s*#/, '맨 판에 색이 없다');
  assert.match(s, /--칸\s*:\s*\d+px/, '맨 판에 간격이 없다(가득은 loom 이 내지만 맨은 스스로 내야 한다)');
  assert.doesNotMatch(s, /\/\*loom부품:/, '맨 판에 구운 부품이 실렸다 — 가벼워야 할 판이 아니다');
  assert.match(s, /«맨»이다/, '맨 판이 자기를 안 밝힌다 — 그대로 내보내는 것을 막을 자가 사라진다');
});

/* ── ② 이름표는 킷에서 나온다 — 손으로 적은 값 0 ─────────────────────────── */

test('🔴 색 이름표가 킷을 그대로 센다 — 킷이 늘면 그날 같이 는다', () => {
  const 전량 = 토큰.색.킷.length;
  const 퇴역 = 토큰.색.킷.filter((c) => /퇴역|retire/i.test(String(c.팔레트) + String(c.직책))).length;
  /* 0 은 분모와 함께 쓴다 — 「30색」만 적으면 킷이 늘어난 날 그 수가 거짓이 된다. */
  assert.equal(씨.색표().length, 전량 - 퇴역,
    `이름표 ${씨.색표().length} ≠ 킷 ${전량} − 퇴역 ${퇴역} — 어딘가에 손으로 적은 목록이 있다`);
  assert.ok(퇴역 > 0, '퇴역 대기가 0이면 이 검사가 거르는 것을 증명 못 한다(킷에서 정말 사라졌으면 이 줄을 고친다)');
  assert.equal(씨.부품표().length, 토큰.부품.목록.length, '부품 이름표가 킷과 다르다');
  assert.deepEqual(씨.간격표(), Object.keys(토큰.율.단계), '간격 이름표가 킷과 다르다');
});

/* ── ③ 한 판정엔 자 하나 — 간격을 두 곳이 같게 안다 ──────────────────────── */

test('🔴 간격이 토큰과 loom 에서 안 갈렸다 — 갈리면 씨앗이 갈린 값을 퍼뜨린다', () => {
  const 어긋남 = 씨.간격대조();
  assert.deepEqual(어긋남, [], `간격이 두 곳에서 다르다:\n   ${어긋남.join('\n   ')}`);
});

/* ── ④ 모르는 것을 조용히 빼지 않는다 ─────────────────────────────────────── */

const 돌린다 = (인자) => {
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '캔버스씨앗.js'), ...인자],
      { cwd: 루트, encoding: 'utf8' });
    return { 코드: 0, 말: '' };
  } catch (e) { return { 코드: e.status, 말: `${e.stdout || ''}${e.stderr || ''}` }; }
};

test('🔴 모르는 부품·판·플래그는 거절한다 — 오타가 「그것 없이 지었다」로 지나가면 화면만 허전해진다', () => {
  const 부품 = 돌린다(['--부품', '없는부품']);
  assert.equal(부품.코드, 2, '모르는 부품을 통과시킨다');
  assert.match(부품.말, /--목록/, '거절만 하고 처방을 안 준다 — 따를 수 없는 차단이다');

  assert.equal(돌린다(['--판', '없는판', '--쓰기', 'x.dc.html']).코드, 2, '모르는 판을 통과시킨다');
  assert.equal(돌린다(['--빨강']).코드, 2, '모르는 플래그를 삼킨다');
  assert.equal(돌린다(['--맨', '--가득']).코드, 2, '갈래 둘을 같이 받는다 — 어느 판이 나왔는지 알 수 없어진다');
});

/* ── ⑤ 아트보드가 실제로 «판 크기»로 선다 ───────────────────────────────── */

test('아트보드가 고른 판 크기 그대로 선다', () => {
  for (const [이름, p] of Object.entries(씨.판들)) {
    const html = 씨.아트보드({ 판: 이름, 씨앗: '<style></style>' });
    assert.ok(html.includes(`width:${p.w}px`), `${이름} 의 너비가 안 박혔다`);
    assert.ok(html.includes(`min-height:${p.h}px`), `${이름} 의 높이가 안 박혔다`);
    assert.match(html, /class="룸"/, '`.룸` 이 없으면 맨요소 부품이 어디에도 안 닿는다');
  }
  assert.ok(Object.keys(씨.판들).length >= 6, `판 ${Object.keys(씨.판들).length}종 — 줄었으면 왜인지 여기 적어라`);
});
