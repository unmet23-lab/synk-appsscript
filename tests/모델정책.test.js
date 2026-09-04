'use strict';
/* 모델정책 회귀 — 2026-08-05
 *
 * 무엇을 지키나: **유호님이 닫은 선택지가 닫힌 채로 있는가.**
 *   "5.6 sol max 또는 5.6 luna max 둘 중 고르게. terra 는 버리고. 제미나이도 최고 수준으로."
 *   이 판정들은 코드 어디서도 다시 열리면 안 된다 — 열리는 방향은 언제나 조용하다
 *   (기본값이 스르르 낮아지거나, 오타가 기본값으로 접히거나, 폐기된 픽이 표에 되살아난다).
 *
 * 표 대조는 환경 의존이라 **skip 으로 드러낸다** — 캐시가 없는 기계(CI)에서 「대조했다」와
 * 「대조 못 했다」가 같은 초록이면 표가 낡아도 아무도 모른다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 정책 = require(path.join(ROOT, 'tools', '모델정책.js'));

// ───────────────────────────────── 코덱스 — 선택지는 둘, 둘의 효력은 늘 같다

test('🔑 검수 선택지는 astra·sol·luna **셋뿐**이다 — 이름을 늘리려면 이 테스트부터 고쳐야 한다(유호 판정 2026-08-05 · 09-05 에 astra 추가)', () => {
  assert.deepStrictEqual(Object.keys(정책.검수선택지).sort(), ['astra', 'luna', 'sol']);
});

/* [2026-08-15] 유호님 확정으로 값이 max → **high** 로 내려갔다(*"앞으로 심문 검수 모두 luna high
 * x2 로 바꾸자"* — 회차 2회와 한 벌). 이 테스트가 지키는 것은 **두 가지**이고 값은 그중 하나일 뿐이다:
 *   ① 효력이 벤더 기본에 안 맡겨진다(맡기면 sol 은 low · luna 는 medium 으로 돌아 고른 의미가 없어진다).
 *   ② **둘의 효력이 서로 같다** — 이게 깨지면 `--검수 sol` 로 돌린 날의 대조에서 모델 차이와 효력
 *      차이가 안 갈린다(2026-08-07 조건 통제 실패로 실측이 통째로 무효가 된 자리 · F045).
 * 그래서 ②는 값을 안 박고 **같음**으로 검사한다 — 유호님이 다음에 값을 또 바꿔도 ①②는 그대로 산다.
 *
 * ✅ [2026-08-31] 값이 `high` → **`xhigh`** 로 올라갔다(유호 확정 *"심문 검수 등 모든걸 luna/xhigh
 *   ×1 이거 1회만진행하고 나머지는 안했으면 해"*). 08-15 의 「깊이를 내주고 회차를 산다」가
 *   **반대로 닫혔다** — 회차를 내주고 깊이를 산다. ①② 는 그대로 산다(그게 이 검사의 설계다). */
test('🔑 효력은 벤더 기본에 안 맡긴다 + 두 선택지가 **같은 효력**을 쓴다 (값 = xhigh · 유호 확정 08-31)', () => {
  const 효력들 = Object.entries(정책.검수선택지).map(([k, v]) => [k, v.effort]);
  for (const [k, e] of 효력들) {
    assert.ok(정책.효력들.includes(e), `${k} 의 효력 "${e}" 이 알려진 수준이 아니다`);
  }
  assert.strictEqual(new Set(효력들.map(([, e]) => e)).size, 1,
    `두 선택지의 효력이 갈렸다(${효력들.map(([k, e]) => `${k}=${e}`).join(' · ')}) — 선택지 간 비교 조건이 깨진다`);
  assert.strictEqual(정책.검수선택지.luna.effort, 'xhigh', '유호님 확정값(08-31 xhigh)에서 조용히 벗어났다');
  assert.strictEqual(정책.검수선택지.sol.model, 'gpt-5.6-sol');
  assert.strictEqual(정책.검수선택지.luna.model, 'gpt-5.6-luna');
});

/* 🔴 [2026-09-05] 유호 확정이 09-04 를 되돌렸다 — 원문 "gpt 한도가 그냥 너무 녹거든??
 *   다시 gpt 심문 전부 다 luna 1회로 변경해줘". 09-04 가 예고한 재판정 자리가 실사용에서 왔다.
 *   ⚠ sol 은 선택지에 그대로 남는다 — 되돌림이 비싼 발주에만 `--검수 sol` 로 그날만 올린다.
 * ── 아래는 09-04 의 기록 ──────────────────────────────────
 * [2026-09-04] 유호 확정이 이 자리를 뒤집었다 — 원문 "아스트라 전까지 sol 1회로 진행해보자".
 *   08-05 의 "sol 쓰니까 너무 비싸다" 를 대체한다. 🔑 앞 판정이 «틀린» 게 아니라 그 전제가 사라졌다:
 *   ChatGPT Pro 20x(정액)로 올리셔서 단가가 판정에서 빠졌고, 남는 자는 「한도를 얼마나 먹나」다.
 *   ⚠ luna 는 선택지에 그대로 남는다 — 한도가 마르는 날 `--검수 luna` 로 그날만 내린다. */
test('기본 픽은 astra — 유호 확정 2026-09-05 저녁 "아스트라로 돌릴수있게 세팅" · luna·sol 은 그날만 내리고 올리는 손잡이로 남는다', () => {
  assert.strictEqual(정책.검수기본, 'astra');
  assert.strictEqual(정책.검수선택().model, 'gpt-6-astra');
  assert.strictEqual(정책.검수선택('luna').model, 'gpt-5.6-luna', 'luna 가 선택지에서 사라졌다 — 한도가 마르는 날 내릴 손잡이가 없어진다');
  assert.strictEqual(정책.검수선택('sol').model, 'gpt-5.6-sol', 'sol 이 선택지에서 사라졌다 — 올릴 손잡이가 없어진다');
});

test('사람이 실제로 쓰는 표기를 다 받는다 — "5.6 sol max" 는 모델+효력 조합이지 모델명이 아니다', () => {
  for (const 표기 of ['sol', 'SOL', 'gpt-5.6-sol', '5.6 sol max']) {
    assert.strictEqual(정책.검수선택(표기).model, 'gpt-5.6-sol', `"${표기}" 가 sol 로 안 읽혔다`);
  }
  for (const 표기 of ['luna', '5.6 luna max', 'gpt-5.6-luna']) {
    assert.strictEqual(정책.검수선택(표기).model, 'gpt-5.6-luna', `"${표기}" 가 luna 로 안 읽혔다`);
  }
});

test('🔑 모르는 픽은 기본값으로 접지 않고 **거절**한다 — 오타를 조용히 sol 로 읽으면 「luna 로 돌렸다」고 믿게 된다', () => {
  for (const 나쁨 of ['terra', 'gpt-5.6-terra', '5.6 terra max', 'lnua', 'gpt-4']) {
    assert.throws(() => 정책.검수선택(나쁨), /모르는 검수 선택지/, `"${나쁨}" 가 거절되지 않았다`);
  }
});

test('🔑 버전이 틀린 표기도 거절한다 — "5.5 luna" 를 luna 로 접으면 「5.5를 돌렸다」고 믿게 된다 (이종 검수 지적 655cc9ad)', () => {
  for (const 나쁨 of ['5.5 luna max', '5.5 sol', 'gpt-5.7-sol', '4 sol']) {
    assert.throws(() => 정책.검수선택(나쁨), /버전/, `"${나쁨}" 가 거절되지 않았다`);
  }
  assert.strictEqual(정책.검수선택('5.6 luna max').model, 'gpt-5.6-luna', '맞는 버전 표기가 막혔다');
});

test('🔑 폐지된 --모델 과 값 없는 --검수 는 조용히 무시되지 않는다 (이종 검수 지적 b3140c6c)', () => {
  assert.throws(() => 정책.분석설정(['--모델', 'gpt-5.6-terra']), /폐지/);
  assert.throws(() => 정책.분석설정(['--검수']), /픽이 없다/);
  assert.throws(() => 정책.분석설정(['--검수', '--효력', 'high']), /픽이 없다/);
});

test('검수선택은 **사본**을 준다 — --효력 1회성 조정이 다음 호출의 기본값을 오염시키면 안 된다', () => {
  const a = 정책.검수선택('sol');
  a.effort = 'low';
  assert.strictEqual(정책.검수선택('sol').effort, 'xhigh', '한 번의 조정이 선택지 원본을 바꿨다');
});

/* 🔑 조정값은 **기본과 달라야** 이 테스트가 무언가를 검사한다 — 기본이 high 인데 `--효력 high` 로
 * 재면 얹히지 않아도 초록이다(맹점 ④: 맞는 얼굴로 틀린 값). 08-15 에 기본이 high 가 되면서
 * 옛 픽스처가 정확히 그 모양이 됐고, 그래서 상향값 max 로 갈아 끼웠다. */
test('분석설정: --검수 luna 가 픽을 바꾸고 --효력 이 그 위에 얹힌다', () => {
  assert.strictEqual(정책.분석설정(['--검수', 'luna']).model, 'gpt-5.6-luna');
  assert.notStrictEqual(정책.검수선택지.sol.effort, 'max', '픽스처가 기본값과 같아졌다 — 얹힘을 못 잰다');
  const s = 정책.분석설정(['--검수', 'sol', '--효력', 'max']);
  assert.strictEqual(s.model, 'gpt-5.6-sol');
  assert.strictEqual(s.effort, 'max');
});

test('분석설정: SYNK_REVIEW_PICK 환경변수로도 고를 수 있다 (CLI 가 env 보다 우선)', () => {
  const 이전 = process.env.SYNK_REVIEW_PICK;
  try {
    process.env.SYNK_REVIEW_PICK = 'luna';
    assert.strictEqual(정책.분석설정([]).model, 'gpt-5.6-luna');
    assert.strictEqual(정책.분석설정(['--검수', 'sol']).model, 'gpt-5.6-sol');
    process.env.SYNK_REVIEW_PICK = 'terrra';
    assert.throws(() => 정책.분석설정([]), /모르는 검수 선택지/);
  } finally {
    if (이전 === undefined) delete process.env.SYNK_REVIEW_PICK;
    else process.env.SYNK_REVIEW_PICK = 이전;
  }
});

// ───────────────────────────────── 코덱스 — 조합 검사가 실제로 막는가

test('오타 효력은 「알 수 없는 추론 수준」으로 거절 — codex 에 넘기면 조용히 기본값으로 돈다', () => {
  assert.throws(() => 정책.코덱스플래그({ model: 'gpt-5.6-sol', effort: 'xhgih' }), /알 수 없는 추론 수준/);
});

test('🔑 luna + ultra 는 여기서 거절된다 — 벤더까지 갔다 오면 「확인 불가」가 몇 분 뒤에 온다', () => {
  assert.throws(() => 정책.코덱스플래그({ model: 'gpt-5.6-luna', effort: 'ultra' }), /지원하지 않는다/);
  // sol 은 ultra 를 받는다 — 1회성 상향 통로가 실제로 열려 있는지도 같은 무게로 본다
  assert.doesNotThrow(() => 정책.코덱스플래그({ model: 'gpt-5.6-sol', effort: 'ultra' }));
});

test('표에 없는 모델은 거절 — 지원 효력을 모르는 채 넘기지 않는다', () => {
  assert.throws(() => 정책.코덱스플래그({ model: 'gpt-5.9-nova', effort: 'max' }), /표에 먼저 적어야/);
});

test('플래그는 모델·효력이 **한 벌**로 나간다', () => {
  const f = 정책.코덱스플래그({ model: 'gpt-5.6-luna', effort: 'max' });
  assert.ok(f.includes('-m') && f.includes('gpt-5.6-luna'));
  assert.ok(f.some((x) => x === 'model_reasoning_effort="max"'));
});

/* [2026-08-06] 이 테스트는 원래 「구조화는 분석보다 얕아야 한다」를 못박고 있었다.
 * 유호님이 반대 근거를 듣고 **`max` 로 확정**했다(*"아니다 그냥 둘다 max로 할래"*) — 설계 의도가
 * 바뀌었으므로 그것을 못박던 회귀도 함께 바뀐다. 남는 검사는 **조합이 표를 통과하는가**다
 * (미지원 조합은 요청이 죽거나 조용히 무시된다 — 그게 이 파일의 원래 일이다).
 *
 * [2026-08-15] 유호님이 분석을 `high` 로 내리자 여기 박혀 있던 `max` 가 **변환을 판단보다 깊게**
 * 만들었다(`tests/이종검수.test.js` 가 fail 로 잡았다). 확정의 실질은 「**둘 다**」 = 같게 두라였으므로
 * 값을 분석 기본에서 **파생**시켰다. 그래서 이 회귀도 상수 대신 **같음**을 못박는다 — 값이 또 바뀌어도
 * 산다(🚫 `low` 로 되돌리는 재제안 금지는 그대로: 그건 값이 아니라 방향에 대한 판정이었다). */
test('구조화(2단계) 조합이 모델 표를 통과한다 · 효력 = 분석 기본과 같다(축이 안 뒤집힌다)', () => {
  const s = 정책.구조화설정;
  assert.doesNotThrow(() => 정책.코덱스플래그(s), '구조화 기본 조합이 표를 통과하지 못한다');
  if (!process.env.SYNK_REVIEW_FMT_EFFORT) {   // env 로 바꾼 경우는 그 사람의 선택이다
    const 분석 = 정책.분석설정([]).effort;
    assert.strictEqual(s.effort, 분석,
      `구조화(${s.effort})가 분석(${분석})에서 갈라졌다 — 두 곳에 적힌 판정은 언제나 조용히 갈라진다`);
    assert.ok(정책.효력들.indexOf(s.effort) <= 정책.효력들.indexOf(분석),
      '변환이 판단보다 깊다 — 순수 변환에 더 큰 사고력을 주면 「고쳐서」 옮긴다');
  }
});

test('구조화 기본 모델은 폐기 예고 자리(gpt-5.4-mini)가 아니다 — 벤더가 luna 를 후속으로 지목했다', () => {
  if (process.env.SYNK_REVIEW_FMT_MODEL) return; // env 로 바꾼 경우는 그 사람의 선택이다
  assert.notStrictEqual(정책.구조화설정.model, 'gpt-5.4-mini');
});

// ───────────────────────────────── 코덱스 — 표 대조 (환경 의존 → skip 으로 드러낸다)

test('코덱스효력 표가 벤더 실물(models_cache.json)과 같다 — 손으로 적은 표는 낡는 쪽으로 샌다', (t) => {
  const 캐시 = 정책.코덱스캐시();
  if (!캐시) return t.skip('~/.codex/models_cache.json 없음 — 이 기계에서는 표를 실물과 대조하지 못했다');
  for (const [m, 지원] of Object.entries(정책.코덱스효력)) {
    assert.ok(캐시[m], `${m} 이 벤더 목록에 없다 — 폐기됐으면 표·선택지를 갱신해야 한다`);
    assert.deepStrictEqual([...캐시[m].지원].sort(), [...지원].sort(), `${m} 지원 효력이 실물과 다르다`);
  }
});

// ───────────────────────────────── 제미나이 — 최상 픽 잠금

test('🔑 제미나이 기본 = flash/high — 유호 확정(2026-08-05 "flash high로 세팅해줘") 잠금', () => {
  assert.strictEqual(정책.제미나이.기본, '무료최상');
  const p = 정책.제미나이설정();
  assert.strictEqual(p.model, 'gemini-3.8-flash', '유호 지시 2026-09-03 「전부 3.8 로」와 다르다');
  /* 「심화추론모드」의 실물 = 이 한 줄이다. 09-03 프로브에서 3.8 은 max·ultra·deep·dynamic 을 전부
   * 400 으로 거절했다 — high 가 천장이라 **이 값이 내려가면 심화가 꺼진 것**이고, 위로 올릴 곳은 없다. */
  assert.strictEqual(p.thinking_level, 'high');
});

test('🔑 몽골어대조(첫 라이브 호출자)가 정책 픽을 실제로 소비한다 — 정책이 죽은 장치면 P1 재발 (지적 944e2a1c)', () => {
  const 대조 = require(path.join(ROOT, 'tools', '몽골어대조.js'));
  assert.ok(대조, '몽골어대조 require 실패');
  const src = require('node:fs').readFileSync(path.join(ROOT, 'tools', '몽골어대조.js'), 'utf8');
  assert.match(src, /제미나이설정\(\)/, '몽골어대조가 정책 픽을 안 읽는다');
  assert.doesNotMatch(src, /기본모델 = 'gemini-/, '모델이 다시 하드코딩됐다');
  /* 요청 조립은 09-02 부터 `tools/lib/제미나이호출.js` 한 통로다(검수 러너의 gemini 레인과 공유) —
   * 사고 수준이 «요청에 실리나»는 그 파일에서 재고, 몽골어대조는 «정책의 사고 수준을 건네나»를 잰다. */
  assert.match(src, /thinking/, '몽골어대조가 사고 수준을 호출에 안 건넨다');
  const 통로 = require('node:fs').readFileSync(path.join(ROOT, 'tools', 'lib', '제미나이호출.js'), 'utf8');
  assert.match(통로, /thinkingLevel/, '사고 수준이 요청에 안 실린다(제미나이호출.js)');
  assert.doesNotMatch(src, /generateContent/, '몽골어대조가 HTTP 를 제 손으로 다시 부른다 — 통로가 둘이면 갈린다');
});

test('제미나이 키는 파일에서만 읽고, 모르는 토큰 여럿이면 null (조용한 401 방지 · 지적 a7be9e8a)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gk-'));
  const 이전 = process.env.GEMINI_KEY_PATH_FREE;
  try {
    const f = path.join(d, 'k.txt');
    fs.writeFileSync(f, '﻿설명 텍스트\nAQ.abc123\n');
    process.env.GEMINI_KEY_PATH_FREE = f;
    assert.strictEqual(정책.제미나이키(), 'AQ.abc123', '아는 접두어(AQ.)를 못 골랐다');
    fs.writeFileSync(f, 'tok1 tok2\n');
    assert.strictEqual(정책.제미나이키(), null, '모르는 토큰 여럿인데 아무거나 집었다');
    fs.writeFileSync(f, '단일토큰\n');
    assert.strictEqual(정책.제미나이키(), '단일토큰');
    process.env.GEMINI_KEY_PATH_FREE = path.join(d, '없는파일.txt');
    assert.strictEqual(정책.제미나이키(), null, '없는 파일인데 null 이 아니다');
  } finally {
    if (이전 === undefined) delete process.env.GEMINI_KEY_PATH_FREE;
    else process.env.GEMINI_KEY_PATH_FREE = 이전;
  }
});

/* 🔑 열쇠가 «둘»이다 — 유호 확정 2026-09-03 「글은 공짜, 그림은 유료」.
 *   까닭은 실물이다: 09-02 저녁 그림 한 번 구운 크레딧 소진(−₩56)이 **글 검문까지** 멈춰 세웠다.
 *   여기서 지키는 것은 «기본이 싼 쪽인가» — 용도를 안 주면 공짜로 가야 실수의 방향이 「돈이 샌다」가 아니다. */
test('🔴 용도를 안 주면 «글»(공짜 몫) 열쇠다 · 공짜가 없다고 유료로 넘어가지 않는다(폴백 금지)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gk2-'));
  const 옛글 = process.env.GEMINI_KEY_PATH_FREE;
  const 옛돈 = process.env.GEMINI_KEY_PATH;
  try {
    const 글f = path.join(d, 'free.txt');
    const 돈f = path.join(d, 'paid.txt');
    fs.writeFileSync(글f, 'AQ.free\n');
    fs.writeFileSync(돈f, 'AQ.paid\n');
    process.env.GEMINI_KEY_PATH_FREE = 글f;
    process.env.GEMINI_KEY_PATH = 돈f;
    assert.strictEqual(정책.제미나이키(), 'AQ.free', '기본이 공짜 쪽이 아니다');
    assert.strictEqual(정책.제미나이키('글'), 'AQ.free');
    assert.strictEqual(정책.제미나이키('돈'), 'AQ.paid');
    // 🚫 폴백 금지 — 공짜가 없다고 유료로 넘어가면 「글은 공짜」가 거짓이 되고 아무도 그걸 모른다.
    process.env.GEMINI_KEY_PATH_FREE = path.join(d, '없다.txt');
    assert.strictEqual(정책.제미나이키('글'), null, '공짜 열쇠가 없을 때 유료로 넘어갔다');
    assert.strictEqual(정책.제미나이키('돈'), 'AQ.paid', '돈 열쇠까지 같이 죽으면 안 된다');
    assert.match(정책.제미나이키안내('글'), /만드는 법/, '없다고만 말하면 사람이 다음 수를 모른다');
    assert.throws(() => 정책.제미나이키('아무거나'), /용도/, '모르는 용도가 조용히 통과하면 안 된다');
  } finally {
    if (옛글 === undefined) delete process.env.GEMINI_KEY_PATH_FREE; else process.env.GEMINI_KEY_PATH_FREE = 옛글;
    if (옛돈 === undefined) delete process.env.GEMINI_KEY_PATH; else process.env.GEMINI_KEY_PATH = 옛돈;
  }
});

test('최상(3.1-pro/high) 픽은 이름만 남아 있다 — 결제를 켜는 날 기본만 바꾸면 되게', () => {
  const p = 정책.제미나이설정('최상');
  assert.strictEqual(p.model, 'gemini-3.1-pro-preview');
  assert.strictEqual(p.thinking_level, 'high');
});

test('🔑 폴백허용=false — 무료 키로 최상을 못 부르면 **말하고 멈춘다**(조용히 flash 로 내려가면 「최고로 세팅했다」가 거짓이 된다)', () => {
  assert.strictEqual(정책.제미나이.폴백허용, false);
});

test('무료최상 픽이 이름 붙어 있고, 결제 필요 여부가 표에 박혀 있다 — 등급 착오는 코드가 먼저 안다', () => {
  const p = 정책.제미나이설정('무료최상');
  assert.strictEqual(p.무료등급, true);
  assert.strictEqual(정책.제미나이설정('최상').무료등급, false, '3.1 Pro 는 API 무료 등급이 없다(공식 FAQ) — 이게 true 로 바뀌면 누가 실측 없이 고친 것');
});

test('두 픽 모두 사고 수준이 그 모델의 지원 목록 안이다 — 미지원 수준은 요청이 죽거나 조용히 무시된다', () => {
  for (const 키 of ['최상', '무료최상']) {
    assert.doesNotThrow(() => 정책.제미나이설정(키));
  }
  assert.throws(() => 정책.제미나이설정('없는픽'), /모르는 제미나이 픽/);
});

/* [2026-08-31 갱신] 유호님 확정: ①배포 검수 · ②설계 심문 **둘 다 luna/xhigh, 각 1회**
 * (원문 *"심문 검수 등 모든걸 luna/xhigh ×1 이거 1회만진행하고 나머지는 안했으면 해"* —
 * 08-15 의 `high ×2` 와 08-30 의 「섞은 2회」를 둘 다 대체).
 * 이 회귀가 지키는 것은 **효력**이다 — 새는 방향은 언제나 얕은 쪽이고, 모델이 같아진 지금
 * 조용히 갈라질 수 있는 자리는 effort 하나뿐이다(모델만 박고 효력을 안 박아 데인 게 이 파일의 출발점). */
test('역할별 기본 — ①검수·②심문 첫 런·③실행자가 «같은» 모델/효력 (한쪽만 갈리지 않는다)', () => {
  /* 🔑 값을 여기 박지 않는다 — 09-04 에 luna→sol, 09-05 에 sol→luna 로 두 번 움직였고 그때마다
   *   이 줄을 고쳐야 했다. 이 검사가 지키는 것은 «값»이 아니라 «일치»이므로 정본에서 파생시킨다. */
  const 기대 = 정책.검수선택지[정책.검수기본];
  for (const [이름, 설정] of [['심문', 정책.분석설정([], 정책.심문기본)], ['검수', 정책.분석설정([])]]) {
    assert.strictEqual(설정.model, 기대.model, `${이름} 기본이 검수기본과 다르다`);
    assert.strictEqual(설정.effort, 'xhigh', `${이름} 효력이 xhigh 가 아니다 — 모델만 맞고 깊이가 갈렸다`);
  }
  assert.strictEqual(정책.실행설정([]).model, 기대.model, '③실행자만 옛 값에 남았다 — 유호 확정은 「전부 다」였다');
});

/* [2026-08-15] 유호님 확정: 심문·검수 **둘 다 2회 · luna/high**(원문 「앞으로 심문 검수 모두
 * luna high x2 로 바꾸자」). 08-14 의 `max ×1` 을 유호님이 직접 대체했다 — **깊이 한 칸을 회차와
 * 맞바꾼 한 벌의 판정**이라, 둘 중 하나만 살아 있으면 유호님이 고른 편성이 아니다.
 * 편성이 조용히 바뀌는 것은 겉보기가 똑같다 — 방향이 뒤집혀도 **목록째 못박는 규율은 그대로다**
 * (지금 막을 것은 「sol 이 빠지는 것」이 아니라 「아무도 안 시켰는데 다시 늘거나 줄어드는 것」이다). */
/* ✅ 2026-08-31 확정 — **①검수·②심문 둘 다 `luna/xhigh ×1`.** 유호 원문 *"심문 검수 등 모든걸
 * luna/xhigh ×1 이거 1회만진행하고 나머지는 안했으면 해"*. 08-30 의 「섞은 2회」와 08-15 의
 * 「high ×2」를 **둘 다** 대체한다.
 *
 * 🔑 **이 검사가 못박는 축이 «또» 옮겨간다 — 세 번째다.**
 *   08-29 판 = 「회차 수로 역할이 갈린다」 → 둘 다 2회가 되며 무너짐.
 *   08-30 판 = 「효력이 섞였나로 갈린다」 → 둘 다 xhigh ×1 이 되며 무너짐.
 *   08-31 판 = **「①과 ②가 «같다»는 것 자체가 의도다」** — 이제 지킬 값은 갈림이 아니라 **일치**다.
 *   ⇒ 그래서 값을 두 번 적지 않고 **①에서 파생시켜 비교**한다. 유호님이 다음에 효력을 또 바꿔도
 *      한쪽만 따라가면 여기서 운다(같은 판정을 두 곳에 적으면 갈라진다 · 맹점 ④).
 * 🔴 **새는 방향은 「한쪽만 조용히 바뀌는 것」** — 매 배포에 걸리는 ①이 비용을 이유로 내려가거나,
 *   ②만 깊어지는 무늬. 둘 다 겉보기가 멀쩡하다.
 * 📏 유호님이 값을 보고 고르셨다: xhigh ×1 회수율 **74%**(분모 = 학생ID 심문 고유 쟁점 27) —
 *   **한 런은 4분의 1을 놓친다.** 🚫 이 수치를 근거로 2회 재제안 금지(되돌릴 손잡이는 `--회차 2`). */
/* ✅ [2026-09-04] 유호 확정 「웅 아스트라 한벌 + 제미나이 한 벌로 가자」 —
 *   08-31 의 「한 줄」을 **심문 몫만** 대체한다. 그래서 이 검사가 지키는 것이 셋으로 갈렸다:
 *     ① 코덱스 자리는 **여전히 ①검수와 같은 값**(08-31 의 「일치」가 그 자리에서 그대로 산다)
 *     ② 제미나이 한 벌이 **실제로 편성에 있다**(집안이 둘이어야 14:5 축을 산다)
 *     ③ **①검수는 안 따라 늘었다**(유호님이 정하신 것은 심문이다 · 둘을 같이 움직이지 않는다)
 *   🔴 셋 중 ③이 가장 조용히 샌다 — 편성을 늘리다 검수까지 늘리면 매 배포가 두 배로 길어진다. */
test('심문 편성 = GPT 한 벌 + 제미나이 한 벌 — 코덱스 자리는 ①검수와 «같아야» 한다 (확정 09-04)', () => {
  const 런 = 정책.심문런들([]);
  assert.deepStrictEqual(런.map((p) => p.벤더), ['codex', 'gemini'],
    '심문 편성의 집안이 바뀌었다 — 확정값은 GPT 한 벌 + 제미나이 한 벌이다');

  const 코 = 런.filter((p) => p.벤더 === 'codex');
  assert.strictEqual(코.length, 1, '코덱스 자리가 하나가 아니다');
  /* 🔑 이 두 줄이 이 검사의 심장이다 — 값이 아니라 **일치**를 본다(08-31 판정이 여기 남았다). */
  const 검수 = 정책.분석설정([]);
  assert.strictEqual(코[0].effort, 검수.effort,
    '②심문 코덱스 자리와 ①검수의 효력이 갈렸다 — 한쪽만 바뀌면 조용하다');
  assert.strictEqual(코[0].model, 검수.model, '②심문 코덱스 자리와 ①검수의 모델이 갈렸다');

  const 제 = 런.filter((p) => p.벤더 === 'gemini');
  assert.strictEqual(제.length, 1, '제미나이 자리가 사라졌다 — 집안이 하나면 같은 눈이 두 번 놓친다');
  /* 값은 여기 안 적고 제미나이 표에서 파생돼야 한다 — 두 곳에 적으면 갈라진다. */
  const g = 정책.제미나이설정();
  assert.strictEqual(제[0].model, g.model, '제미나이 심문 자리가 제미나이 픽과 갈렸다');
  assert.strictEqual(제[0].effort, g.thinking_level, '제미나이 심문 자리의 사고 수준이 픽과 갈렸다');
  /* 🔴 코덱스 효력 낱말이 제미나이 자리에 실리면 벤더가 400 을 낸다(사고 수준은 low·medium·high 뿐). */
  assert.ok(['low', 'medium', 'high'].includes(제[0].effort),
    `제미나이 자리에 코덱스 효력이 실렸다 — "${제[0].effort}" 는 사고 수준이 아니다`);

  assert.strictEqual(정책.회차설정([]), 1,
    '①검수 회차가 심문을 따라 늘었다 — 유호님이 09-04 에 정하신 것은 «심문»이다');
});

test('심문 편성: --회차 N 은 편성을 «늘리지» 않는다 · 명시 픽은 «모델만» 간다', () => {
  /* 🔑 편성이 한 벌이라 `--회차 2·3` 을 줘도 슬라이스는 1개다 — 「2회 돌렸다」는 착각이 안 생겨야 한다.
   *   ⚠ 08-31 이후 이 검사의 무게가 커졌다: 전엔 편성이 2벌이라 `--회차 3` 만 잘렸는데, 이제는
   *   **`--회차 2` 도 안 늘어난다.** 회차를 늘리려면 편성 줄을 늘려야 한다(값은 한 자리에만 산다). */
  /* 🔑 편성이 두 벌이 된 09-04 이후로 `--회차` 는 «자르는» 손잡이다 — 1 이면 앞 한 벌(코덱스)만.
   *   🔴 자르는 쪽이 제미나이인 것이 의도다: 급할 때 빠지는 것이 «둘째 집안»이고, 그러면 그날
   *   회수율이 74% 로 돌아간다는 사실이 편성 길이 하나로 드러난다. */
  assert.deepStrictEqual(정책.심문런들(['--회차', '1']).map((p) => p.이름), ['astra']);
  assert.deepStrictEqual(정책.심문런들(['--회차', '2']).map((p) => p.이름), ['astra', 'gemini']);
  assert.deepStrictEqual(정책.심문런들(['--회차', '3']).map((p) => p.이름), ['astra', 'gemini'],
    '--회차 3 이 심문 편성을 늘렸다 — 편성 길이가 곧 회차이고 인자가 그걸 못 늘린다');
  assert.deepStrictEqual(정책.심문런들(['--회차', '2']).map((p) => p.effort), ['xhigh', 'high'],
    '자르고 남은 런이 얕아졌다');
  /* 🔑 2026-08-29 — 명시 픽이 있어도 회차는 **심문 편성**이 정한다. 전엔 `회차기본`(①검수의 값)으로
   *   넘어가 `--검수 sol` 하나가 심문 회차를 조용히 바꿨다: 회차가 두 곳에서 나오는 셈이었다. */
  assert.deepStrictEqual(정책.심문런들(['--검수', 'sol']).map((p) => p.이름), ['sol', 'gemini'],
    '명시 픽이 심문 회차를 ①검수 쪽 값으로 끌어갔다 — 값은 편성 하나에서만 나와야 한다');
  assert.deepStrictEqual(정책.심문런들(['--검수', 'sol', '--회차', '1']).map((p) => p.이름), ['sol']);
  /* 🔴 09-04 — `--검수` 는 «코덱스» 픽이다. 제미나이 자리까지 갈아끼우면 그 회차가 코덱스 모델로
   *   바뀌어 집안이 하나가 되고, 그러면 「두 집안이 봤다」가 거짓이 된다. */
  assert.strictEqual(정책.심문런들(['--검수', 'sol'])[1].model, 정책.제미나이설정().model,
    '명시 픽이 제미나이 자리까지 갈아끼웠다 — 집안이 하나로 접혔다');
  /* 🔴 2026-08-30 — 명시 픽은 **모델만** 갈아끼운다. 효력은 편성 줄의 것을 그대로 쓴다.
   *   ⚠ 08-31 에 편성이 한 값이 되어 이 검사가 «지금은» 아무것도 안 갈라 보인다 — 그래도 남긴다.
   *   지키는 것은 「모델을 바꾸는 손잡이가 깊이까지 만지면 안 된다」는 계약이고, 편성이 다시
   *   여러 줄이 되는 날 이 줄이 없으면 그 계약이 조용히 깨진다. */
  assert.deepStrictEqual(정책.심문런들(['--검수', 'sol']).map((p) => p.effort), ['xhigh', 'high'],
    '명시 픽이 효력까지 갈아끼웠다 — 모델을 바꾸는 손잡이가 깊이를 만지면 안 된다');
  /* 효력 1회성 조정은 «코덱스» 자리만 눌러 덮는다(그날만). 🔴 제미나이에 `max` 가 실리면
   * 그 회차는 400 으로 죽고, 죽은 회차는 「지적 0건」과 같은 얼굴이다. */
  assert.deepStrictEqual(정책.심문런들(['--효력', 'max']).map((p) => p.effort), ['max', 'high']);
  // 오타는 기본으로 접지 않는다
  assert.throws(() => 정책.심문런들(['--검수', 'lnua']), /모르는 검수 선택지/);
  assert.throws(() => 정책.심문런들(['--검수']), /뒤에 픽이 없다/);
});

/* 회차 — 「1회」는 유호님 확정값(08-31)이라 기본이 조용히 2 로 «올라가도» 안 된다.
 * ⚠ 방향이 08-31 에 뒤집혔다: 전엔 「싼 쪽(1)으로 새는 것」을 막았는데, 이제 기본이 1이라
 *   샐 곳이 반대다 — 누가 「넓게 보자」로 2를 기본에 얹는 것. 값을 박아 양쪽을 다 막는다. */
test('회차: 기본 1 · --회차 로 1회성 조정 · 상한과 쓰레기값은 거절한다', () => {
  assert.strictEqual(정책.회차설정([]), 1, '기본 회차가 1 이 아니다 — 유호님 확정값(08-31)');
  assert.strictEqual(정책.회차설정(['--회차', '1']), 1);
  assert.strictEqual(정책.회차설정(['--회차', '2']), 2);
  assert.strictEqual(정책.회차설정(['--회차', '3']), 3);
  // 기본으로 접지 않고 거절한다 — 접으면 「1회로 돌렸다」고 믿으며 2회가 돈다(반대도 마찬가지)
  for (const 나쁨 of [['--회차'], ['--회차', '0'], ['--회차', '30'], ['--회차', '2.5'], ['--회차', 'two'], ['--회차', '--timeout']]) {
    assert.throws(() => 정책.회차설정(나쁨), /--회차 는 1~3 의 정수다/, `"${나쁨.join(' ')}" 이 안 막혔다`);
  }
});

test('심문에서도 --검수 는 기본을 이긴다 — 1회성 하향 통로가 살아 있어야 한다', () => {
  const 내린 = 정책.분석설정(['--검수', 'luna'], 정책.심문기본);
  assert.strictEqual(내린.model, 'gpt-5.6-luna', '명시 픽이 기본에 먹혔다');
  // 오타는 여전히 기본으로 접지 않고 거절한다 — 기본픽 인자가 그 계약을 무르면 안 된다
  assert.throws(() => 정책.분석설정(['--검수', 'solll'], 정책.심문기본), /모르는 검수 선택지/);
});

/* ── [F445] 폐지된 심문 통로가 «살아있는 지시문»에 되살아나지 않는다 ─────────────
 * 🔴 왜 여기 붙나: 이 파일이 지키는 것이 「유호님이 닫은 선택지가 닫힌 채로 있는가」인데,
 *   `fable심문` 은 08-14 유호 지시(「너무 낭비」)로 **폐지**된 뒤에도 정작 **모델 정본인
 *   `tools/모델정책.js` 가 그것을 「예외 하나」로 계속 적고 있었다**(실측 08-15 · :455).
 *   그 낡은 한 줄이 F445 의 마지막 자리였다 — 심문 통로가 둘로 읽히면 대기열·보드가 엉뚱한
 *   쪽을 지목하고, 그러면 회차 «간» 대조가 원리상 무효가 된다(F281 — 그 대조가 게이트의 존재 이유).
 *   08-13 재판정이 경고했는데 08-14 에 재발했으니 **2번째**다 — 그래서 프로즈가 아니라 이 검사가 진다.
 *
 * 🔑 재는 것은 «살아있는 지시문»뿐이다 — `docs/`·장부·아카이브는 **기록**이라 뺀다.
 *   기록까지 금지하면 사고 이력을 못 적게 되고, 그러면 다음 사람이 왜 폐지됐는지를 잃는다.
 * 💸 대가: 「폐지」·「🚫」가 같은 줄에 있으면 통과시킨다 — 그 낱말을 달고 되살리는 문장은 못 잡는다.
 *   그 대신 **「예외가 있다」고 태연히 적는 모양**(F445 가 실제로 난 그 모양)은 잡는다. */
test('[F445] 폐지된 `fable심문` 이 살아있는 지시문에 「쓸 수 있는 통로」로 남아 있지 않다', () => {
  const fs = require('node:fs');
  const 볼곳 = [];
  const 훑기 = (rel) => {
    const p = path.join(ROOT, rel);
    let st; try { st = fs.statSync(p); } catch (_) { return; }
    if (st.isFile()) { if (/\.(js|json|md)$/.test(rel)) 볼곳.push(rel); return; }
    for (const e of fs.readdirSync(p)) 훑기(`${rel}/${e}`);
  };
  훑기('tools'); 훑기('.claude/skills'); 훑기('.claude/agents'); 훑기('.claude/hooks'); 훑기('.claude/settings.json');

  // 분모부터 — 0건 훑기는 통과와 **같은 초록**이다(F207).
  assert.ok(볼곳.length > 50, `살아있는 지시문을 ${볼곳.length}개만 봤다 — 이 분모면 초록이 미실행이다`);

  const 위반 = [];
  for (const rel of 볼곳) {
    let src; try { src = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { continue; }
    if (!src.includes('fable심문')) continue;
    src.split(/\r?\n/).forEach((l, i) => {
      if (!l.includes('fable심문')) return;
      if (l.includes('폐지') || l.includes('🚫')) return;      // 폐지를 «기록하는» 줄은 통과
      위반.push(`${rel}:${i + 1}  ${l.trim().slice(0, 100)}`);
    });
  }
  assert.deepStrictEqual(위반, [],
    '폐지된 통로를 «있는 것»으로 적은 줄이다 — 이름이 겹치면 대기열이 엉뚱한 통로를 지목한다(F445·F281):\n'
    + 위반.join('\n'));

  // 구조 쪽도 못박는다 — 부를 통로 자체가 없어야 「이름 겹침」이 원리적으로 안 산다.
  for (const 죽은 of ['.claude/skills/fable심문', 'tools/심문자.md', 'docs/심문자.md']) {
    assert.ok(!fs.existsSync(path.join(ROOT, 죽은)), `${죽은} 이 되살아났다 — 폐지가 무름됐다(🚫부활)`);
  }
  // 살아남은 단일 통로가 실제로 있어야 이 폐지가 「둘 다 없앰」이 아니다.
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'codex-review.js')),
    '심문 통로가 하나도 없다 — 폐지가 게이트까지 지웠다');
});

/* 🔴 «항상 무료 먼저» — 유호 지시 2026-09-03 「항상 무료먼저 사용하게 해줘」.
 *
 * 기본이 무료인 것은 위 시험이 지킨다. 여기서 지키는 것은 그 다음 층이다:
 *   **돈을 쓰는 «자리»가 조용히 늘어나지 않는가.**
 * 09-03 실측으로 돈 열쇠를 부르는 곳은 둘뿐이었고(그림 굽기·음성 실측), 둘 다 사람이 손으로
 * 부르는 도구다 — 자동으로 도는 것은 하나도 없다. 그래서 «지금은 충전이 없어도 아무것도 안 멈춘다».
 * 그 사실이 이 저장소의 성질인데, 새 코드 한 줄이 `제미나이키('돈')` 을 쓰면 그 성질이 조용히 깨진다.
 * ⇒ 목록을 여기 박고, 늘어나면 시험이 운다. 늘리려면 **이름을 올리고 왜인지 적는 것**이 조건이다.
 */
test('🔴 「돈」 열쇠를 부르는 자리는 목록에 있는 것뿐이다 — 돈 쓰는 자리가 조용히 늘면 안 된다', () => {
  const fs = require('node:fs');
  /* 허용된 곳과 «왜 돈인가». 공짜 몫이 원리상 없는 갈래만 여기 온다
   * (구글 공식 가격표 09-03: 그림 Nano Banana Pro = Free Tier 「Not available」). */
  const 허용 = {
    'tools/lib/이미지굽기.js': '그림 1컷 — 공짜 몫이 없다(가격표 Not available). 쓰는 도구 = 라디오무대굽기·펠트색굽기',
    'tools/음성실측.js': '몽골어 음성(TTS) 실측 — 오디오는 공짜 몫 밖. 제품에 안 붙은 «재보는» 도구다',
  };
  /* 상대경로로 훑는다 — 절대경로에 자를 대면 저장소가 어디 놓였느냐로 답이 갈린다
   * (ai스택점검이 워크트리에서 자기 문서 229벌을 통째로 걸러낸 그 사고). */
  const 훑기 = (상대) => {
    const 절대 = path.join(ROOT, 상대);
    if (!fs.existsSync(절대)) return [];
    return fs.readdirSync(절대, { withFileTypes: true }).flatMap((e) => {
      const 다음 = 상대 ? `${상대}/${e.name}` : e.name;
      if (e.isDirectory()) return /^(node_modules|\.git|worktrees|_archive)$/.test(e.name) ? [] : 훑기(다음);
      return e.isFile() && e.name.endsWith('.js') ? [다음] : [];
    });
  };
  const 찾은 = [];
  for (const 상대 of [...훑기('tools'), ...훑기('evals')]) {
    const 본문 = fs.readFileSync(path.join(ROOT, 상대), 'utf8');
    // 정본(모델정책.js)은 표를 «정의»하는 자리라 뺀다 — 부르는 쪽만 센다.
    if (상대 === 'tools/모델정책.js') continue;
    if (/제미나이키(?:경로)?\(\s*['"]돈['"]\s*\)/.test(본문)) 찾은.push(상대);
  }
  const 새것 = 찾은.filter((p) => !(p in 허용));
  assert.deepStrictEqual(새것, [],
    `돈 열쇠를 새로 부르는 곳이 생겼다 — 「항상 무료 먼저」(유호 09-03)를 지나쳤다.\n`
    + `  공짜 몫으로 되는 일이면 용도를 '글'로 바꾸고, 정말 돈이 필요하면 이 시험의 «허용» 표에 이름과 까닭을 올려라.`);
  // 반대로도 잰다 — 목록에만 있고 실물이 없으면 그 줄은 낡은 것이다(자가 헐거워진 채 초록).
  const 사라진 = Object.keys(허용).filter((p) => !찾은.includes(p));
  assert.deepStrictEqual(사라진, [], '허용 표에 있는데 실물이 그 열쇠를 안 쓴다 — 표가 낡았다');
});

// ───────────────────────────────── 세 모델 배치 (2026-09-04 · 유호 확정 「이거 추가해줘」)

/* 🔴 이 시험이 지키는 것은 **「못 쓰는 이름이 쓰는 표에 안 들어간다」** 하나다.
 *   08-06 에 못박은 🚫(없는 모델 ID 를 미리 등록 금지)의 기계 판 — 표에 적히는 순간
 *   `코덱스플래그()` 가 그 이름을 «아는 모델»로 통과시키고, 벤더가 거절하면 검수는 종료 2 로
 *   죽는다. 그 죽음은 배포 직전에야 보인다. */
test('🚪 열림 대기 이름은 «쓰는 표»에 없다 — 있으면 조용히 죽을 이름을 아는 척하는 것이다', () => {
  /* 🔑 09-05 — 표가 «비어 있는 것»이 정상 상태가 됐다(gpt-6 이 열려서 나갔다).
   *   이 검사가 지키는 것은 「개수」가 아니라 **«기다리는 이름이 쓰는 표에 미리 들어오지 않는다»** 하나다. */
  for (const [id, d] of Object.entries(정책.열림대기)) {
    for (const 이름 of [id, ...(d.별칭 || [])]) {
      assert.ok(!(이름 in 정책.코덱스효력), `${이름} 이 코덱스효력 표에 들어갔다 — 못 쓰는 이름을 아는 모델로 세우면 검수가 배포 직전에 죽는다`);
      assert.ok(!Object.values(정책.검수선택지).some((v) => v.model === 이름), `${이름} 이 검수선택지에 들어갔다`);
      assert.ok(!Object.values(정책.실행선택지).some((v) => v.model === 이름), `${이름} 이 실행선택지에 들어갔다`);
    }
    assert.ok(d.상태 && d.쓸자리 && d.쓸자리.length, `${id} 에 상태·쓸자리가 없다 — 왜 기다리는지 모르면 뜬 날 무엇을 할지도 모른다`);
  }
  /* 09-05 — `gpt-6-astra` 는 이제 «아는 모델»이라 거절 검사를 여기서 뺀다(프로브로 효력을 실측했다).
   * 대신 아직 «모르는» 이름은 그대로 거절해야 한다 — 그게 이 줄이 원래 지키던 것이다. */
  assert.throws(() => 정책.코덱스플래그({ model: 'gpt-7-nonexistent', effort: 'xhigh' }),
    (e) => e.확인불가 === true && /모르는 코덱스 모델/.test(e.message));
});

test('🚫 제미나이 금지 목록에 «터미널·환경 조작»이 있다 — 맡기면 조용히 실패하는 자리(명령창 19.1)', () => {
  assert.ok(정책.제미나이금지.length >= 4, `금지가 ${정책.제미나이금지.length}개다 — 넷 아래로 줄었다`);
  const 터미널 = 정책.제미나이금지.find((x) => /터미널|환경 조작|명령창/.test(x.무엇));
  assert.ok(터미널, '터미널·환경 조작 금지 줄이 사라졌다');
  assert.ok(/19\.1/.test(터미널.근거), '근거에서 숫자가 빠졌다 — 「왜」가 없으면 다음 사람이 그냥 되돌린다');
  for (const g of 정책.제미나이금지) assert.ok(g.근거 && g.대신, `«${g.무엇}» 에 근거나 대신할 곳이 없다 — 처방 없는 금지는 우회를 가르친다`);
});

test('🔑 돈 열쇠가 필요한 제미나이 역할은 «계산»이 답한다 — 공짜 몫 하루 20발로는 한 판도 안 도는 것들', () => {
  assert.ok(정책.제미나이역할.length >= 6, `역할이 ${정책.제미나이역할.length}개다 — 여섯 아래로 줄었다`);
  for (const r of 정책.제미나이역할) {
    assert.strictEqual(typeof r.돈열쇠필요, 'boolean', `«${r.이름}» 에 돈열쇠필요 칸이 없다`);
    assert.ok(r.왜, `«${r.이름}» 에 까닭이 없다`);
    assert.ok(r.돈열쇠왜, `«${r.이름}» 에 「왜 그 문으로 가나」가 없다 — 계산이 답을 냈으면 까닭도 같이 나온다`);
  }
  /* 🔴 09-05 — 09-04 판은 이 값을 손으로 적었고, **같은 크기의 일 둘을 반대로 적어 놨었다**:
   *   콘텐츠 초벌(한 판 80요청)은 true 인데 몽골어 검문(같은 80요청)은 false 였다. 그래서 검문이
   *   09-02 저녁부터 조용히 멈춰 있었고, 이 파일은 「여유가 크다」고 적고 있었다.
   *   이제 한 판의 크기만 적고 「공짜로 도나」는 `돈열쇠판정()` 이 답한다. */
  const 검문 = 정책.제미나이역할.find((r) => r.키 === '몽골어검문');
  assert.ok(검문 && 검문.돈열쇠필요 === true,
    '몽골어 검문이 공짜 몫으로 열려 있다 — 한 판 80요청이라 20발 한도를 첫 판에 넘긴다(09-03 실측)');
  /* 🔒 유호 확정 09-04 — 과제·퀴즈는 클로드가 맡는다(학생이 읽는 것은 손을 갈라 두지 않는다).
   *   그 확정은 배치표에 09-05 에 닿았는데 **이 역할 표에는 「초벌」이 그대로 남아 있었다** —
   *   한 확정이 한 파일 안에서 두 번 적히면 한쪽만 고쳐진다. 이제 이 표는 배치표에서 파생된다. */
  const 초벌 = 정책.제미나이역할.find((r) => /초벌|과제·퀴즈/.test(r.이름));
  assert.ok(!초벌, `과제·퀴즈가 제미나이 역할에 남아 있다(«${초벌 && 초벌.이름}») — 유호 확정 09-04 로 클로드가 맡는다(배치표 과제글)`);
});

/* 🔴 감시는 «열리는 날» 처음 도는데, 그날 안 울면 영영 모른다(심문 9일 즉사와 같은 자리).
 *   그래서 실저장소가 아니라 픽스처로 탐지력을 못 박는다 — 지금 실저장소는 늘 「안 떴다」라
 *   거기서 초록은 「감시가 산다」를 하나도 증명하지 못한다. */
test('🚪 열림 감시가 실제로 발화한다 — 네 갈래를 픽스처로 잰다(탐지력·꼬리·침묵·확인 불가)', () => {
  const 정찰 = require(path.join(ROOT, 'tools', '모델정찰.js'));
  const 표 = { 'gpt-6': { 별칭: ['gpt-6-astra'], 상태: '못 쓴다', 쓸자리: ['검수'], 열리면: '표에 옮긴다' } };
  assert.deepStrictEqual(정찰.열림줄들(['gpt-5.6-luna'], true, 표), [], '안 떴는데 울면 매일 거짓 경보가 된다');
  const 떴다 = 정찰.열림줄들(['gpt-5.6-luna', 'gpt-6-astra'], true, 표);
  assert.ok(떴다.length === 2 && /gpt-6-astra/.test(떴다[0]), '떴는데 침묵했다 — 이 감시의 존재 이유가 그 한 줄이다');
  assert.ok(정찰.열림줄들(['gpt-6-astra-mini'], true, 표).length, '꼬리 붙은 이름을 놓친다 — 벤더가 변형을 내놓으면 조용해진다');
  const 못봄 = 정찰.열림줄들([], false, 표);
  assert.ok(못봄.length === 1 && /안 재봤다/.test(못봄[0]), '캐시를 못 읽었는데 침묵했다 — 「못 봤다」와 「아직」이 같은 얼굴이면 안 된다');
  assert.deepStrictEqual(정찰.열림줄들([], true, {}), [], '표가 비면 조용하다');
});

// ───────────────────────────────── 🚪 제미나이 «문» — 글은 공짜 문에, 돈은 크레딧 문에 (09-04)
/* 새는 방향: ⓐ 「Vertex 로 옮기자」가 통째 교체로 와서 «글» 열쇠까지 옮겨진다 → 그 프로젝트에 결제가
 *   붙고 공짜가 죽는다(되돌릴 수 없다 · 결정 09-03). ⓑ 누가 base 만 바꾸고 주소꼴을 안 바꿔 404 가
 *   난다. ⓒ 어느 파일이 주소를 다시 하드코딩해 문이 두 곳에 산다(constant-known-in-two-places).
 * 셋 다 조용해서 픽스처로 문다. */

test('🔴 «글» 문은 AI Studio 그대로다 — 옮기면 공짜가 죽는다(결정 09-03)', () => {
  const 글 = 정책.제미나이문('글');
  assert.strictEqual(글.base, 'https://generativelanguage.googleapis.com/v1beta', '글 열쇠는 결제가 안 붙어서 공짜다. 문을 옮기면 결제가 따라와 그 순간 죽는다');
  assert.strictEqual(글.목록가능, true, 'AI Studio 문에는 모델 목록이 있다 — 정찰이 그걸 읽는다');
  assert.match(정책.제미나이URL('글', 'M'), /\/v1beta\/models\/M:generateContent$/);
});

test('🔴 «돈» 문은 Vertex 다 — 무료 크레딧 $300 이 AI Studio 문에는 안 먹는다', () => {
  const 돈 = 정책.제미나이문('돈');
  assert.strictEqual(돈.base, 'https://aiplatform.googleapis.com/v1');
  assert.strictEqual(돈.목록가능, false, 'Vertex 에는 목록 조회가 없다 — 있다고 하면 «안 재봤다»가 «봤다»로 접힌다');
  /* 🔴 base 만 바꾸고 주소꼴을 안 바꾸면 404 다. 세 조각이 다 있어야 한다:
   *   `projects/<프로젝트>` · `locations/<위치>` · `publishers/google`.
   * 🔑 앞의 둘은 09-04 에 «인증이 API 키에서 OAuth 토큰으로 바뀌면서» 필수가 됐다 —
   *   키를 쓸 때는 프로젝트를 열쇠가 알았지만, 토큰은 그걸 모르므로 주소가 말해야 한다. */
  assert.match(
    정책.제미나이URL('돈', 'M'),
    /\/v1\/projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\/M:generateContent$/,
  );
  assert.strictEqual(돈.인증, 'oauth', 'Vertex 는 API 키를 못 받는다(조직 밖 프로젝트 · 09-04) — 키로 되돌리면 403 이다');
});

test('🔑 «돈» 문의 프로젝트·위치는 env 로 덮을 수 있다 — 되돌리기는 변수 지우기 하나', () => {
  const 옛 = [process.env.SYNK_VERTEX_PROJECT, process.env.SYNK_VERTEX_LOCATION];
  try {
    process.env.SYNK_VERTEX_PROJECT = 'p-시험';
    process.env.SYNK_VERTEX_LOCATION = 'loc-시험';
    assert.match(정책.제미나이URL('돈', 'M'), /\/projects\/p-시험\/locations\/loc-시험\//);
  } finally {
    if (옛[0] === undefined) delete process.env.SYNK_VERTEX_PROJECT; else process.env.SYNK_VERTEX_PROJECT = 옛[0];
    if (옛[1] === undefined) delete process.env.SYNK_VERTEX_LOCATION; else process.env.SYNK_VERTEX_LOCATION = 옛[1];
  }
  assert.strictEqual(정책.벌텍스위치(), 'global', '기본 위치는 전역이다 — 리전 문은 10% 비싸다');
});

test('🔑 두 문은 서로 다르다 · 모르는 용도는 거절한다', () => {
  assert.notStrictEqual(정책.제미나이문('글').base, 정책.제미나이문('돈').base, '둘이 같아졌다 — 통째 교체가 들어왔다는 뜻이다');
  assert.strictEqual(정책.제미나이문().base, 정책.제미나이문('글').base, '기본은 글이다');
  assert.throws(() => 정책.제미나이문('그림'), /용도는/, '모르는 용도를 조용히 글로 접으면 「돈 문으로 돌렸다」고 믿는 상태가 생긴다');
});

test('🔑 env 로 그 자리만 덮어쓸 수 있다 — 되돌리기는 변수 지우기 하나', () => {
  const 옛 = process.env.GEMINI_BASE_PAID;
  try {
    process.env.GEMINI_BASE_PAID = 'https://example.test/v9/';
    const 돈 = 정책.제미나이문('돈');
    assert.strictEqual(돈.base, 'https://example.test/v9', '끝의 빗금을 안 걷으면 주소에 // 가 생긴다');
    assert.strictEqual(돈.덮어씀, true, '덮어쓴 사실이 안 보이면 「정본대로 돈다」고 믿는다');
    assert.strictEqual(정책.제미나이문('글').덮어씀, undefined, '한쪽 덮어쓰기가 다른 쪽까지 물들면 안 된다');
  } finally {
    if (옛 === undefined) delete process.env.GEMINI_BASE_PAID; else process.env.GEMINI_BASE_PAID = 옛;
  }
  assert.strictEqual(정책.제미나이문('돈').base, 'https://aiplatform.googleapis.com/v1', '변수를 지우면 정본으로 돌아온다');
});

test('🔴 주소를 하드코딩한 파일이 없다 — 문은 모델정책 한 곳만 안다', () => {
  const fs = require('node:fs');
  const 볼것 = [
    'tools/모델정책.js', 'tools/lib/제미나이호출.js', 'tools/lib/이미지굽기.js', 'tools/음성실측.js',
  ];
  const 걸린 = [];
  for (const rel of 볼것) {
    const 본문 = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    본문.split('\n').forEach((줄, i) => {
      /* 🔑 «주소»만 잡는다 — 도메인 이름이 안내 문구에 나오는 것은 설명이지 호출이 아니다
       *   (첫 판이 「제한에 aiplatform.googleapis.com 을 더한다」는 처방 줄을 잡았다 · 09-04). */
      /* 🔑 «제미나이 문»만 잡는다(09-04). 토큰 발급처 `oauth2.googleapis.com` 은 문이 아니라
       *   «자격»을 받는 자리이고 정책 한 곳에만 산다 — 그것까지 잡으면 자가 엉뚱한 줄을 빨갛게 만든다. */
      if (!/https?:\/\/(generativelanguage|aiplatform)\.googleapis\.com/i.test(줄)) return;
      if (/^\s*[*/]/.test(줄)) return;                       // 주석은 설명이지 주소가 아니다
      if (rel === 'tools/모델정책.js' && /^\s*이름:/.test(줄)) return; // 문 표 = 유일한 정본 자리
      걸린.push(`${rel}:${i + 1} ${줄.trim().slice(0, 90)}`);
    });
  }
  assert.deepStrictEqual(걸린, [], '주소가 코드에 다시 박혔다 — 한쪽만 옮겨지면 그쪽이 조용히 갈린다');
});

// ───────────────────────────────── ⑤배치표 — 일감 36자리가 각각 어느 손인가
// (2026-09-04 신설 · 09-05 ⓐ 로 «자리를 부르는 이름»을 번호에서 키로 옮겼다)

test('🔴 ⓐ 자리마다 «안 바뀌는 키»가 있고 겹치지 않는다 — 부르는 이름이 번호이면 자리를 끼울 때 조용히 밀린다', () => {
  /* 09-05 실사고: 사람이 읽는 판이 새 자리를 «중간에» 끼워 뒤 번호가 전부 밀렸는데 이 표는 안 밀렸다.
   * 그래서 `--배치 22` 가 「과제·퀴즈(클로드)」 대신 「대조·채점(제미나이)」을 냈다 —
   * 유호님이 확정하신 것이 종이에만 있고 기계에는 안 들어간 상태로 하루가 돌았다. */
  const 키들 = 정책.배치표.map((r) => r.키);
  for (const r of 정책.배치표) {
    assert.ok(r.키 && typeof r.키 === 'string', `자리 ${r.n} 에 키가 없다 — 번호는 부르는 이름이 아니다`);
    assert.ok(!/[\s0-9]/.test(r.키), `키 "${r.키}" 에 공백이나 숫자가 있다 — 키에 번호를 섞으면 그 키도 같이 밀린다`);
  }
  assert.strictEqual(
    new Set(키들).size, 키들.length,
    `키가 겹친다 — ${키들.filter((k, i) => 키들.indexOf(k) !== i).join(' · ')}`
  );
});

test('🔒 ⓐ 키 명부 — 이름표가 바뀌거나 사라지면 여기가 운다(부르는 쪽이 조용히 깨지는 것을 막는다)', () => {
  /* 🔑 이 목록은 «자를 자로 재는» 자리다. 키는 그 자리가 살아 있는 한 안 바뀌어야 하니,
   *   바꾸려면 여기도 함께 고쳐야 한다 — 그 마찰이 이 시험의 값이다(고치는 것 자체는 막지 않는다).
   *   자리를 정말 없앨 때만 여기서도 지우고, 새 자리는 «끝에» 더한다. */
  const 명부 = [
    '설계쓰기', '설계재료', '설계심문', '발주구멍', '답합치기', '유호보고', '선택지짓기',
    '대규모코드', '명령창붙들기', '엔진코드', '잔손고침', '시험짓기',
    '배포전검수', '보안구멍', '숨은명령', '거짓초록', '글검사', '밖의사실',
    '화면조작', '웹조사', '시트점검',
    '과제글', '앱글', '대외문안', '종이물', '되돌림말',
    '채점분류', '몽골어검문', '뜻대조', '오류태깅',
    '그림굽기', '목소리굽기', '음악굽기', '영상코드',
    '발음채점', '성향뽑기',
    '삶이해', '일기맞장구',   // 09-05 — ㉢ 삶을 맡는 자리가 배치표에 없던 것을 판다
  ];
  const 지금 = 정책.배치표.map((r) => r.키);
  assert.deepStrictEqual(
    명부.filter((k) => !지금.includes(k)), [],
    '키가 사라졌다 — 이름표를 바꿨으면 부르는 쪽도 같이 고쳤는지 보고 이 명부를 고친다'
  );
  assert.deepStrictEqual(
    지금.filter((k) => !명부.includes(k)), [],
    '새 자리가 생겼다 — 이 명부 끝에 더한다(자리는 중간에 끼워도 키는 안 밀린다)'
  );
});

test('🔑 ⓐ 키로 부르면 그 자리 하나가 나온다 — 09-04 유호 확정 「과제·퀴즈 글은 클로드」가 기계에 서 있나', () => {
  const [과제] = 정책.배치('과제글');
  assert.strictEqual(과제.손, 'claude', '학생이 읽는 과제·퀴즈 글의 손이 클로드가 아니다 — 09-04 유호 확정 자리');
  assert.strictEqual(과제.갈래, '학생글', '학생이 «읽는» 것과 «뒤에서 도는» 판정은 갈래가 갈려야 한다');
  for (const r of 정책.배치표) {
    const 답 = 정책.배치(r.키);
    assert.strictEqual(답.length, 1, `키 "${r.키}" 가 ${답.length}자리를 냈다 — 키는 자리 하나만 가리킨다`);
    assert.strictEqual(답[0].n, r.n, `키 "${r.키}" 가 다른 자리를 가리킨다`);
  }
});

test('🔴 ⑦ 집안 — 같은 집안 둘은 «남남»이 아니다(09-05 · 「GPT ×2」 오기가 났던 자리)', () => {
  /* 밖의 사실 반박은 「조사원 둘」이 정본인데, 그 둘이 한 집안이면 사각이 겹쳐 한 벌과 다르지 않다.
   * 장부에 실제로 적히는 이름들(codex(live) · ChatGPT Deep Research …)로 잰다. */
  assert.strictEqual(정책.집안가르기('gemini'), 'google');
  assert.strictEqual(정책.집안가르기('제미나이 Deep Research'), 'google');
  assert.strictEqual(정책.집안가르기('codex(live)'), 'openai', 'codex 는 ChatGPT 와 한 집안이다 — 장부에 이 이름으로 적힌다');
  assert.strictEqual(정책.집안가르기('ChatGPT Deep Research'), 'openai');
  assert.strictEqual(정책.집안가르기('claude'), 'anthropic');
});

test('🔴 ⑦ 모르는 조사원은 «남남»으로 세지 않는다 — 모르는 것을 「다르다」로 세면 한 벌이 둘로 부푼다', () => {
  for (const 모르는것 of ['마누스', '', null, undefined, '   ']) {
    assert.strictEqual(정책.집안가르기(모르는것), null, `"${모르는것}" 을 아는 집안으로 셌다`);
  }
});

test('🔴 ⑥ 모든 자리가 배선 표 셋 중 하나에 든다 — 새 자리를 넣고 이 표를 안 고치면 조용히 「닿을 것 없음」으로 세어진다', () => {
  /* 09-05 에 도장을 갈랐다. 「누가 맡나」와 「엔진에 닿나」를 한 낱말로 재던 것이
   * 스물두 자리가 제 규칙을 어기는 꼴을 만들었다(두 집안 심문이 각각 P0). */
  for (const r of 정책.배치표) {
    const b = 정책.배선(r.키);   // 셋 중 하나로 안 떨어지면 여기서 던진다
    assert.ok(['학습', '운영'].includes(b.층), `${r.키} 의 층이 학습도 운영도 아니다`);
  }
  const 학습들 = 정책.배치표.map((r) => 정책.배선(r.키)).filter((b) => b.층 === '학습');
  assert.ok(학습들.length > 0, '학습 자리가 0이면 이 자는 눈이 먼 것이다 — 우리 목표축이 「엔진이 학습할 수 있게」다');
});

test('🔴 ⑥ 학습 갈래에서 「닿을 것 없음」을 쓰면 까닭이 있어야 한다 — 도피처가 되면 이 자가 죽는다', () => {
  for (const r of 정책.배치표.filter((x) => !정책.운영갈래.includes(x.갈래))) {
    const b = 정책.배선(r.키);
    if (b.닿았나 !== '닿을것없음') continue;
    assert.ok(
      b.까닭 && b.까닭.length >= 10,
      `${r.키} 를 학습 갈래에서 운영으로 뺐는데 까닭이 없거나 너무 짧다 — 왜 학생 산출이 안 지나가는지 적는다`
    );
  }
});

test('🔴 ⑥ 「닿았다」는 남기는 사건과 읽는 자가 «둘 다» 있을 때만 참이다 — 도장만 바꾸면 거짓 초록이다', () => {
  for (const [키, v] of Object.entries(정책.학습자리)) {
    if (v.닿았나 !== '섰다') continue;
    assert.ok(v.남기는사건, `${키} 가 「섰다」인데 어떤 기록이 생기는지 안 적혀 있다`);
    assert.ok(v.엔진소비자, `${키} 가 「섰다」인데 그 기록을 누가 언제 읽는지 안 적혀 있다`);
  }
});

test('⑤ 배치표는 1..N 이 빠짐없이 있고 번호가 겹치지 않는다 — 빠진 자리는 «아무도 안 맡는 자리»가 된다', () => {
  const 번호 = 정책.배치표.map((r) => r.n);
  assert.deepStrictEqual(
    번호, Array.from({ length: 배치길이() }, (_, i) => i + 1),
    '배치표 번호가 1부터 연속이 아니다 — 자리를 지웠으면 뒤를 당기지 말고 상태로 표시한다'
  );
  function 배치길이() { return 정책.배치표.length; }
  for (const r of 정책.배치표) {
    assert.ok(r.이름 && r.갈래 && r.손 && r.상태, `자리 ${r.n} 에 빈 칸이 있다 — ${JSON.stringify(r)}`);
  }
});

test('🔴 ⑤ 배치표는 «모델 이름과 효력»을 쥐지 않는다 — 층이 겹치면 유호님이 값을 바꾸신 날 갈라진다', () => {
  /* 이 자가 지키는 것: 배치표 = 자리→손 · 위 표들 = 손→모델·효력.
   * 여기에 `gpt-5.6-luna` 나 `xhigh` 를 적으면 검수 효력을 바꿀 때 이 표만 옛 값에 남는다(가드 맹점 ④). */
  const 본문 = JSON.stringify(정책.배치표);
  const 샌것 = [];
  for (const 모델 of Object.keys(정책.코덱스효력)) if (본문.includes(모델)) 샌것.push(모델);
  /* ⚠ 09-05 정정 — 여기 `\b` 가 «백틱 문자열 안»이라 정규식 단어경계가 아니라 백스페이스(\x08)로
   *   들어가 있었다. 그래서 이 줄은 무엇에도 안 맞는 자, 즉 «영원한 초록»이었다. `\\b` 로 고친다. */
  for (const 효력 of 정책.효력들) if (new RegExp(`"[^"]*\\b${효력}\\b[^"]*"`).test(본문)) 샌것.push(효력);
  for (const g of Object.keys(정책.제미나이사고)) if (본문.includes(g)) 샌것.push(g);
  assert.deepStrictEqual(샌것, [], '배치표에 모델·효력이 샜다 — 값은 검수선택지·실행선택지·제미나이 표만 쥔다');
});

test('🔴 ⑤ 검사 자리는 지은 쪽 없이 물으면 손을 «안» 준다 — 조용히 접으면 그게 곧 「지은 자가 검사」다', () => {
  const [답] = 정책.배치(13);
  assert.strictEqual(답.손, null, '지은 쪽을 모르는데 검사자를 정해 줬다');
  assert.match(String(답.되물음), /지은 쪽/, '되물음이 무엇을 달라는지 말하지 않는다');
});

test('⑤ 지은 쪽을 주면 검수자() 와 같은 답을 낸다 — 두 문이 갈라지면 한쪽이 조용히 낡는다', () => {
  for (const 지은쪽 of Object.keys(정책.검수독립)) {
    const [답] = 정책.배치(13, 지은쪽);
    assert.strictEqual(답.손, 정책.검수자(지은쪽).검수벤더, `${지은쪽} 에서 배치()와 검수자()가 갈렸다`);
  }
});

test('⑤ 모르는 자리는 기본값으로 접지 않고 거절한다 — 접으면 「배치를 봤다」는 착각이 생긴다', () => {
  assert.throws(() => 정책.배치(999), /모르는 자리/);
  assert.throws(() => 정책.배치(''), /자리 번호나 이름/);
});

test('⑤ 아직 안 도는 자리는 상태로 드러난다 — 「돈다」와 「안 돈다」가 같은 얼굴이면 안 된다', () => {
  const 아는상태 = ['돈다', '크레딧대기', '아스트라대기', '재판정대기', '미배선'];
  for (const r of 정책.배치표) {
    assert.ok(아는상태.includes(r.상태), `자리 ${r.n} 의 상태 "${r.상태}" 가 표에 없다 — 새 상태는 이 목록에 먼저 적는다`);
  }
  assert.ok(정책.배치표.some((r) => r.상태 !== '돈다'), '안 도는 자리가 0이면 자가 눈이 먼 것이다 — 실제로 넷 이상 있다');
});

test('🔴 제미나이 심문 자리는 코덱스 조합 검사를 «통과 못 한다» — 그래서 부르는 쪽이 벤더로 갈라야 한다', () => {
  /* 소스 글자를 읽지 않고 «실제로 막히나»를 잰다(자가 결함을 지키는 것을 막는 그 규율).
   * 이 자가 초록인 동안은 codex-review 의 `런들.filter(벤더 !== gemini)` 를 지울 수 없다 —
   * 지우면 심문이 시작하자마자 「모르는 코덱스 모델」로 죽는다. */
  const 런 = 정책.심문런들([]);
  const 제 = 런.find((p) => p.벤더 === 'gemini');
  const 코 = 런.find((p) => p.벤더 === 'codex');
  assert.ok(제 && 코, '편성에 두 집안이 다 있어야 이 검사가 뜻을 가진다');
  assert.throws(() => 정책.코덱스플래그(제), /모르는 코덱스 모델/,
    '제미나이 픽이 코덱스 조합 검사를 통과했다 — 그러면 벤더 갈래가 없어도 조용히 지나간다');
  const 플래그 = 정책.코덱스플래그(코);
  assert.ok(플래그.includes('-m') && 플래그.includes(코.model), '코덱스 자리가 플래그를 못 낸다');
});

test('🔴 편성 문구는 «회차 번호»가 아니라 «벤더별 몇 벌»을 말한다 — 09-04 에 이 표기가 오독을 만들었다', () => {
  /* 그날 유호님이 「지금 gpt 심문이 루나 2회인데」로 읽으셨다. 실제로는 GPT 자리가 한 벌이었고,
   * 출력이 `1회 gpt-5.6-luna · 2회 gemini-…` 였다 — 「1회·2회」는 회차 «번호»인데 «횟수»로 읽힌다.
   * 이 자가 초록인 동안은 그 표기로 못 돌아간다. */
  const 문구 = 정책.심문편성문구();
  const 코수 = 정책.심문런들([]).filter((p) => p.벤더 !== 'gemini').length;
  const 제수 = 정책.심문런들([]).filter((p) => p.벤더 === 'gemini').length;
  assert.match(문구, new RegExp(`GPT[^+]*${코수}벌`), `GPT 가 몇 벌인지 문구가 안 말한다 — "${문구}"`);
  assert.match(문구, new RegExp(`제미나이[^(]*${제수}벌`), `제미나이가 몇 벌인지 문구가 안 말한다 — "${문구}"`);
  assert.ok(!/\d+회/.test(문구), `문구에 「N회」가 남았다 — 그 표기가 횟수로 읽힌다: "${문구}"`);
});

test('🔒 GPT 자리는 «아스트라 한 벌»이다 — 셋(검수·심문·실행)이 한 값에서 나온다 (유호 확정 09-05 저녁)', () => {
  /* 09-04 원문 "아스트라 오면 아스트라로 바꾸자" → 09-05 아침 한도로 luna 로 내렸다가 → 09-05 저녁 아스트라로.
   * 심문·검수·실행 셋이 «같은 값»이어야 한다는 것이 그 확정의 실질이라 셋을 한 자리에서 문다. */
  const 코 = 정책.심문런들([]).filter((p) => p.벤더 !== 'gemini');
  assert.strictEqual(코.length, 1, 'GPT 심문 자리가 늘었다 — 유호 확정은 한 벌이다');
  assert.strictEqual(코[0].model, 정책.검수선택지[정책.검수기본].model, '심문 GPT 자리가 ①검수 기본과 갈렸다');
  assert.strictEqual(정책.회차설정([]), 1, '①검수 회차가 늘었다 — 확정은 1회다');
  assert.strictEqual(정책.실행설정([]).model, 코[0].model, '③실행자가 GPT 심문 자리와 갈렸다');
  /* ✅ 09-05 — 아스트라가 쓰는 표에 «실측과 함께» 들어왔다. 이제 지킬 것은 반대다:
   *   효력이 빈 채로 이름만 들어오면 조합 검사가 통째로 헐거워진다. */
  assert.ok((정책.코덱스효력['gpt-6-astra'] || []).includes('xhigh'),
    '아스트라가 쓰는 표에서 사라졌거나 효력이 비었다 — 실측 없이 이름만 두면 벤더 거절로 검수가 종료 2 로 죽는다');
});
