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

test('🔑 검수 선택지는 sol·luna **둘뿐**이다 — terra 를 되살리려면 이 테스트부터 고쳐야 한다(유호 판정 2026-08-05)', () => {
  assert.deepStrictEqual(Object.keys(정책.검수선택지).sort(), ['luna', 'sol']);
});

/* [2026-08-15] 유호님 확정으로 값이 max → **high** 로 내려갔다(*"앞으로 심문 검수 모두 luna high
 * x2 로 바꾸자"* — 회차 2회와 한 벌). 이 테스트가 지키는 것은 **두 가지**이고 값은 그중 하나일 뿐이다:
 *   ① 효력이 벤더 기본에 안 맡겨진다(맡기면 sol 은 low · luna 는 medium 으로 돌아 고른 의미가 없어진다).
 *   ② **둘의 효력이 서로 같다** — 이게 깨지면 `--검수 sol` 로 돌린 날의 대조에서 모델 차이와 효력
 *      차이가 안 갈린다(2026-08-07 조건 통제 실패로 실측이 통째로 무효가 된 자리 · F045).
 * 그래서 ②는 값을 안 박고 **같음**으로 검사한다 — 유호님이 다음에 값을 또 바꿔도 ①②는 그대로 산다. */
test('🔑 효력은 벤더 기본에 안 맡긴다 + 두 선택지가 **같은 효력**을 쓴다 (값 = high · 유호 확정 08-15)', () => {
  const 효력들 = Object.entries(정책.검수선택지).map(([k, v]) => [k, v.effort]);
  for (const [k, e] of 효력들) {
    assert.ok(정책.효력들.includes(e), `${k} 의 효력 "${e}" 이 알려진 수준이 아니다`);
  }
  assert.strictEqual(new Set(효력들.map(([, e]) => e)).size, 1,
    `두 선택지의 효력이 갈렸다(${효력들.map(([k, e]) => `${k}=${e}`).join(' · ')}) — 선택지 간 비교 조건이 깨진다`);
  assert.strictEqual(정책.검수선택지.luna.effort, 'high', '유호님 확정값(08-15 high)에서 조용히 벗어났다');
  assert.strictEqual(정책.검수선택지.sol.model, 'gpt-5.6-sol');
  assert.strictEqual(정책.검수선택지.luna.model, 'gpt-5.6-luna');
});

test('기본 픽은 luna — 유호 확정 2026-08-05 "sol 쓰니까 너무 비싸다" · sol 은 `--검수 sol` 명시로만', () => {
  assert.strictEqual(정책.검수기본, 'luna');
  assert.strictEqual(정책.검수선택().model, 'gpt-5.6-luna');
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
  assert.strictEqual(정책.검수선택('sol').effort, 'high', '한 번의 조정이 선택지 원본을 바꿨다');
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
  assert.strictEqual(p.model, 'gemini-3.6-flash', '플래시 최신 실측(2026-08-05 라이브 목록)과 다르다');
  assert.strictEqual(p.thinking_level, 'high');
});

test('🔑 몽골어대조(첫 라이브 호출자)가 정책 픽을 실제로 소비한다 — 정책이 죽은 장치면 P1 재발 (지적 944e2a1c)', () => {
  const 대조 = require(path.join(ROOT, 'tools', '몽골어대조.js'));
  assert.ok(대조, '몽골어대조 require 실패');
  const src = require('node:fs').readFileSync(path.join(ROOT, 'tools', '몽골어대조.js'), 'utf8');
  assert.match(src, /제미나이설정\(\)/, '몽골어대조가 정책 픽을 안 읽는다');
  assert.doesNotMatch(src, /기본모델 = 'gemini-/, '모델이 다시 하드코딩됐다');
  assert.match(src, /thinkingLevel/, '사고 수준이 요청에 안 실린다');
});

test('제미나이 키는 파일에서만 읽고, 모르는 토큰 여럿이면 null (조용한 401 방지 · 지적 a7be9e8a)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gk-'));
  const 이전 = process.env.GEMINI_KEY_PATH;
  try {
    const f = path.join(d, 'k.txt');
    fs.writeFileSync(f, '﻿설명 텍스트\nAQ.abc123\n');
    process.env.GEMINI_KEY_PATH = f;
    assert.strictEqual(정책.제미나이키(), 'AQ.abc123', '아는 접두어(AQ.)를 못 골랐다');
    fs.writeFileSync(f, 'tok1 tok2\n');
    assert.strictEqual(정책.제미나이키(), null, '모르는 토큰 여럿인데 아무거나 집었다');
    fs.writeFileSync(f, '단일토큰\n');
    assert.strictEqual(정책.제미나이키(), '단일토큰');
    process.env.GEMINI_KEY_PATH = path.join(d, '없는파일.txt');
    assert.strictEqual(정책.제미나이키(), null, '없는 파일인데 null 이 아니다');
  } finally {
    if (이전 === undefined) delete process.env.GEMINI_KEY_PATH;
    else process.env.GEMINI_KEY_PATH = 이전;
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

/* [2026-08-15 갱신] 유호님 확정: ①배포 검수 · ②설계 심문 **둘 다 luna/high, 각 2회**
 * (원문 *"앞으로 심문 검수 모두 luna high x2 로 바꾸자"* — 08-14 의 `max ×1` 을 대체).
 * 이 회귀가 지키는 것은 **효력**이다 — 새는 방향은 언제나 얕은 쪽이고, 모델이 같아진 지금
 * 조용히 갈라질 수 있는 자리는 effort 하나뿐이다(모델만 박고 효력을 안 박아 데인 게 이 파일의 출발점). */
test('역할별 기본 — ①검수·②심문 첫 런 둘 다 luna/high (효력이 조용히 안 내려간다)', () => {
  for (const [이름, 설정] of [['심문', 정책.분석설정([], 정책.심문기본)], ['검수', 정책.분석설정([])]]) {
    assert.strictEqual(설정.model, 'gpt-5.6-luna', `${이름} 기본이 luna 가 아니다`);
    assert.strictEqual(설정.effort, 'high', `${이름} 효력이 high 가 아니다 — 모델만 맞고 깊이가 갈렸다`);
  }
});

/* [2026-08-15] 유호님 확정: 심문·검수 **둘 다 2회 · luna/high**(원문 「앞으로 심문 검수 모두
 * luna high x2 로 바꾸자」). 08-14 의 `max ×1` 을 유호님이 직접 대체했다 — **깊이 한 칸을 회차와
 * 맞바꾼 한 벌의 판정**이라, 둘 중 하나만 살아 있으면 유호님이 고른 편성이 아니다.
 * 편성이 조용히 바뀌는 것은 겉보기가 똑같다 — 방향이 뒤집혀도 **목록째 못박는 규율은 그대로다**
 * (지금 막을 것은 「sol 이 빠지는 것」이 아니라 「아무도 안 시켰는데 다시 늘거나 줄어드는 것」이다). */
test('심문 편성 = luna/high ×2 · 검수(①)도 2회 — 유호님 확정 08-15', () => {
  const 런 = 정책.심문런들([]);
  assert.deepStrictEqual(런.map((p) => p.model), ['gpt-5.6-luna', 'gpt-5.6-luna'],
    '심문 편성이 바뀌었다 — 유호님 확정값은 luna 두 벌이다');
  assert.deepStrictEqual(런.map((p) => p.effort), ['high', 'high'], 'high 가 아니면 유호님이 고른 깊이가 아니다');
  assert.strictEqual(정책.회차설정([]), 2, '검수 회차가 유호님 확정값(2)에서 벗어났다');
  assert.strictEqual(정책.분석설정([]).model, 'gpt-5.6-luna');
  /* 🔑 「2회」가 두 자리에서 나온다(①=회차기본 · ②=편성 길이) — 갈라지면 조용하니 같음을 못박는다. */
  assert.strictEqual(런.length, 정책.회차설정([]), '①검수 회차와 ②심문 편성 길이가 갈렸다');
});

test('심문 편성: --회차 N 은 앞 N개 · --검수 X 는 그 픽으로 회차만큼', () => {
  assert.deepStrictEqual(정책.심문런들(['--회차', '2']).map((p) => p.이름), ['luna', 'luna']);
  // --회차 1 은 편성의 앞 1개만 — 자르는 쪽이 뒤가 되게 순서를 짰다
  assert.deepStrictEqual(정책.심문런들(['--회차', '1']).map((p) => p.이름), ['luna']);
  // 편성이 두 벌이라 --회차 3 을 줘도 슬라이스가 2개다 — 「3회 돌렸다」는 착각이 안 생겨야 한다
  assert.deepStrictEqual(정책.심문런들(['--회차', '3']).map((p) => p.이름), ['luna', 'luna']);
  // 명시 픽은 편성을 이긴다(옛 1회성 통로 보존) — 그때 횟수는 검수 기본값 2
  assert.deepStrictEqual(정책.심문런들(['--검수', 'sol']).map((p) => p.이름), ['sol', 'sol']);
  assert.deepStrictEqual(정책.심문런들(['--검수', 'sol', '--회차', '1']).map((p) => p.이름), ['sol']);
  // 효력 1회성 조정이 **모든 런에** 걸린다 (기본 high 와 다른 값으로 재야 얹힘이 보인다)
  assert.deepStrictEqual(정책.심문런들(['--효력', 'max']).map((p) => p.effort), ['max', 'max']);
  // 오타는 기본으로 접지 않는다
  assert.throws(() => 정책.심문런들(['--검수', 'lnua']), /모르는 검수 선택지/);
  assert.throws(() => 정책.심문런들(['--검수']), /뒤에 픽이 없다/);
});

/* 회차 — 「2회」는 유호님 확정값이라 기본이 조용히 1 로 내려가면 안 된다(내려가도 겉보기가 같다). */
test('회차: 기본 2 · --회차 로 1회성 조정 · 상한과 쓰레기값은 거절한다', () => {
  assert.strictEqual(정책.회차설정([]), 2, '기본 회차가 2 가 아니다 — 유호님 확정값');
  assert.strictEqual(정책.회차설정(['--회차', '1']), 1);
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
