/* 심문 프롬프트에 «실물»을 싣는 자리를 잰다 (2026-09-05 신설).
 *
 * 🔴 **왜 생겼나 — 두 집안이 서로 다른 것을 볼 수 있었다.** 같은 문서(일기 설계 v7)를 두 벌이
 *   심문했는데 GPT 는 줄 번호까지 18곳을 인용했고 제미나이는 **0곳**이었다. 갈린 자리는 모델
 *   실력이 아니라 «문»이다: 코덱스는 저장소 안에서 돌고, 제미나이는 프롬프트에 준 것만 본다.
 *   ⇒ 모델을 올려도 그 0 은 안 움직인다. 그래서 실물을 **프롬프트에 실어** 둘 다 보게 했다.
 *
 * 🔑 **행동으로 잰다** — 소스 글자를 읽지 않는다. 임시 문서를 만들어 실제로 `실물첨부()` 를
 *   부르고 나온 글을 본다(`tests/소스검사통로.test.js` 의 래칫이 겨누는 그 병을 안 짓는다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { 실물첨부 } = require('../tools/codex-review.js');
const ROOT = path.resolve(__dirname, '..');

/** 임시 설계 문서 하나를 만들고 그 경로를 준다(호출자가 지운다). */
function 임시문서(본문) {
  const 자리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-첨부시험-'));
  const p = path.join(자리, '설계.md');
  fs.writeFileSync(p, 본문, 'utf8');
  return { p, 자리 };
}

test('문서가 «부른» 이름만 싣는다 — 저장소를 훑어 추측하지 않는다', () => {
  const { p, 자리 } = 임시문서('이 설계는 `tools/모델정책.js` 를 쓴다.');
  try {
    const 글 = 실물첨부(p);
    assert.ok(글.includes('tools/모델정책.js'), '문서가 부른 파일이 안 실렸다');
    assert.ok(!글.includes('tools/codex-review.js'),
      '부르지도 않은 파일이 실렸다 — 추측해 넣으면 프롬프트가 부풀고 정작 볼 것이 밀린다');
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('🔴 없는 이름은 «조용히» 빠지고, 그 사실을 머리말이 말한다', () => {
  const { p, 자리 } = 임시문서('아직 안 지은 `tools/그런건없다_9f8e7d.js` 를 세운다.');
  try {
    const 글 = 실물첨부(p);
    assert.ok(!글.includes('그런건없다_9f8e7d'), '없는 파일이 실렸다(읽기가 안 막혔다)');
    if (글) {
      assert.ok(/여기 없는 이름은 .*안 지어진 것/.test(글),
        '「없는 이름 = 아직 안 지은 것」을 안 밝혔다 — 심문자가 없는 자리를 공격한다');
    }
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('🔴 큰 파일은 «이름만» 싣고 그렇게 밝힌다 — 본문이 잘린 것을 통과로 읽지 않게', () => {
  /* 이 저장소에서 확실히 큰 파일 하나(엔진_콘텐츠AI.js ≈509K)를 부른다. */
  const { p, 자리 } = 임시문서('궤적은 `엔진_콘텐츠AI.js` 의 `aiCall_` 을 쓴다.');
  try {
    const 글 = 실물첨부(p);
    assert.ok(글.includes('엔진_콘텐츠AI.js'), '큰 파일이 통째로 빠졌다 — 이름조차 없으면 판정할 근거가 0이다');
    assert.ok(/이름만/.test(글), '「이름만 실었다」를 안 밝혔다');
    assert.ok(/내용이 맞나.*판정 못|판정 못 한다/.test(글),
      '이름 목록으로 «내용»까지 판정할 수 있다고 읽힐 여지를 안 닫았다');
    assert.ok(글.includes('aiCall_'), '이름 목록에 실제 함수 이름이 안 들어갔다 — 목록이 비면 이 층이 헛돈다');
    assert.ok(글.length < 200000, `첨부가 ${글.length}자다 — 큰 파일 본문이 통째로 실린 것으로 보인다`);
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('작은 파일은 «전문»으로 싣는다 — 내용 대조가 이 층의 일이다', () => {
  const { p, 자리 } = 임시문서('규격은 `package.json` 이 쥔다.');
  try {
    const 글 = 실물첨부(p);
    const 원문 = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8').trim().split('\n')[1];
    assert.ok(글.includes(원문), '작은 파일의 본문이 안 실렸다');
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('🔴 저장소 밖으로 못 나간다 — 경로 탈출이 막힌다', () => {
  const { p, 자리 } = 임시문서('`../../../../Windows/System32/drivers/etc/hosts.json` 을 읽는다.');
  try {
    const 글 = 실물첨부(p);
    assert.ok(!/System32/i.test(글), '저장소 밖 파일을 읽었다 — 프롬프트로 새는 통로가 된다');
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('상한을 넘기면 «뺀 것»을 이름과 크기로 남긴다 (no silent caps)', () => {
  const { p, 자리 } = 임시문서('`tools/모델정책.js` 와 `tools/codex-review.js` 둘을 쓴다.');
  try {
    const 글 = 실물첨부(p, 3000);          // 일부러 좁힌 상한
    assert.ok(/안 실은 파일 \d+개/.test(글), '상한을 넘겼는데 뺀 것을 안 밝혔다');
    assert.ok(/\d[\d,]*자/.test(글), '뺀 파일의 크기를 안 적었다 — 얼마나 큰지 모르면 상한을 어떻게 고칠지도 모른다');
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('부른 이름이 하나도 실재하지 않으면 «빈 문자열»이다 — 빈 절을 붙이지 않는다', () => {
  const { p, 자리 } = 임시문서('아무 파일도 안 부르는 설계다.');
  try {
    assert.strictEqual(실물첨부(p), '', '붙일 것이 없는데 머리말만 붙었다 — 프롬프트에 빈 절이 생긴다');
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});

test('🔑 두 집안이 «같은» 프롬프트를 받는다 — 첨부는 벤더를 안 가린다', () => {
  /* F281: 한쪽에만 더 주면 「같은 문서를 두 집안이 봤다」가 아니라 «서로 다른 심문 둘»이 된다.
   * `실물첨부` 는 벤더 인자를 아예 안 받는다 — 그것이 이 보장의 물리다. */
  /* ⚠ `Function.length` 는 «기본값 없는» 인자만 센다 — 여기서 1 은 `대상경로` 하나뿐이라는 뜻이다.
   *   (`상한` 은 기본값이 있어 안 세어진다.) 2 이상이면 벤더를 받는 자리가 생겼다는 신호다. */
  assert.strictEqual(실물첨부.length, 1, '실물첨부가 필수 인자를 둘 이상 받는다 — 벤더별로 갈릴 자리가 생겼다');
  /* 같은 문서면 몇 번을 불러도 같은 글이 나온다 — 벤더마다 다른 것을 줄 통로가 없다. */
  const { p, 자리 } = 임시문서('`tools/모델정책.js` 를 쓴다.');
  try {
    assert.strictEqual(실물첨부(p), 실물첨부(p), '같은 문서인데 부를 때마다 다른 글이 나온다');
  } finally { fs.rmSync(자리, { recursive: true, force: true }); }
});
