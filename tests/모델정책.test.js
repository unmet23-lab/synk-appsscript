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

// ───────────────────────────────── 코덱스 — 선택지는 둘, 둘 다 max

test('🔑 검수 선택지는 sol·luna **둘뿐**이다 — terra 를 되살리려면 이 테스트부터 고쳐야 한다(유호 판정 2026-08-05)', () => {
  assert.deepStrictEqual(Object.keys(정책.검수선택지).sort(), ['luna', 'sol']);
});

test('🔑 두 선택지 모두 추론 = max — 모델만 고르게 하고 효력을 기본값에 맡기면 sol 은 low 로 돈다', () => {
  for (const [k, v] of Object.entries(정책.검수선택지)) {
    assert.strictEqual(v.effort, 'max', `${k} 의 효력이 max 가 아니다(${v.effort}) — 선택지 간 비교 조건이 깨진다`);
  }
  assert.strictEqual(정책.검수선택지.sol.model, 'gpt-5.6-sol');
  assert.strictEqual(정책.검수선택지.luna.model, 'gpt-5.6-luna');
});

test('기본 픽은 sol — 아무것도 안 고르면 프런티어가 본다', () => {
  assert.strictEqual(정책.검수기본, 'sol');
  assert.strictEqual(정책.검수선택().model, 'gpt-5.6-sol');
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

test('검수선택은 **사본**을 준다 — --효력 1회성 조정이 다음 호출의 기본값을 오염시키면 안 된다', () => {
  const a = 정책.검수선택('sol');
  a.effort = 'low';
  assert.strictEqual(정책.검수선택('sol').effort, 'max', '한 번의 조정이 선택지 원본을 바꿨다');
});

test('분석설정: --검수 luna 가 픽을 바꾸고 --효력 이 그 위에 얹힌다', () => {
  assert.strictEqual(정책.분석설정(['--검수', 'luna']).model, 'gpt-5.6-luna');
  const s = 정책.분석설정(['--검수', 'sol', '--효력', 'high']);
  assert.strictEqual(s.model, 'gpt-5.6-sol');
  assert.strictEqual(s.effort, 'high');
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

test('구조화(2단계)는 분석보다 얕고, 그 조합도 표를 통과한다 — 변환에 최상급을 쓰면 「고쳐서」 옮긴다', () => {
  const s = 정책.구조화설정;
  assert.ok(정책.효력들.indexOf(s.effort) < 정책.효력들.indexOf('max'), '구조화가 분석(max)만큼 깊다');
  assert.doesNotThrow(() => 정책.코덱스플래그(s), '구조화 기본 조합이 표를 통과하지 못한다');
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

test('🔑 제미나이 최상 = gemini-3.1-pro-preview / thinking_level=high — 유호 지시(2026-08-05) "최고 수준" 잠금', () => {
  const p = 정책.제미나이설정('최상');
  assert.strictEqual(p.model, 'gemini-3.1-pro-preview');
  assert.strictEqual(p.thinking_level, 'high');
  assert.strictEqual(정책.제미나이.기본, '최상');
});

test('🔑 폴백허용=false — 무료 키로 최상을 못 부르면 **말하고 멈춘다**(조용히 flash 로 내려가면 「최고로 세팅했다」가 거짓이 된다)', () => {
  assert.strictEqual(정책.제미나이.폴백허용, false);
});

test('무료최상 픽이 이름 붙어 있고, 결제 필요 여부가 표에 박혀 있다 — 등급 착오는 코드가 먼저 안다', () => {
  const p = 정책.제미나이설정('무료최상');
  assert.strictEqual(p.model, 'gemini-3-flash-preview');
  assert.strictEqual(p.thinking_level, 'high');
  assert.strictEqual(p.무료등급, true);
  assert.strictEqual(정책.제미나이설정('최상').무료등급, false, '3.1 Pro 는 API 무료 등급이 없다(공식 FAQ) — 이게 true 로 바뀌면 누가 실측 없이 고친 것');
});

test('두 픽 모두 사고 수준이 그 모델의 지원 목록 안이다 — 미지원 수준은 요청이 죽거나 조용히 무시된다', () => {
  for (const 키 of ['최상', '무료최상']) {
    assert.doesNotThrow(() => 정책.제미나이설정(키));
  }
  assert.throws(() => 정책.제미나이설정('없는픽'), /모르는 제미나이 픽/);
});
