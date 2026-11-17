'use strict';
/**
 * GPT가 검수와 검사로 보는 모든 자리의 모델과 추론을 이 한 곳에서 정한다.
 *
 * 2026-11-18 유호님 「지금 GPT 6.2 출시했거든? 우리 검수모델 싹다 6.2 SOL MAX로 바꿔」.
 * 그 전에는 백엔드 검수가 gpt-6-astra · high였고(11-15), 그림과 글을 보는 검사 눈은 모델을 넘기지 않아
 * 굽기 계정 폴더의 config.toml(그림 굽기용 gpt-6-astra · ultra)을 그대로 탔다.
 *
 * 이 값을 쓰는 곳:
 * - tools/검수묶음.mjs GPT — 백엔드 검수와 시간 초과 대체 모델
 * - tools/lib/그림눈.js GPT묻기 — 그림검사 · 미학맹검의 GPT 눈
 * - tools/뜻검사.js — gpt 시험관을 부르는 안내 줄
 * 모두 codex exec에 -m과 -c model_reasoning_effort로 넘긴다. 넘기지 않으면 계정 폴더의 옛 설정을 탄다.
 * 낯선 사람 이해 시험의 GPT 시험관(tools/GPT시험관.mjs)은 검수자가 아니라 처음 보는 시청자 역할이라 이 값을 쓰지 않는다.
 */
const GPT검수 = Object.freeze({ 모델: 'gpt-6.2-sol', 추론: 'max' });

/** codex exec에 붙일 모델 · 추론 인자. */
const codex모델인자 = (설정 = GPT검수) => ['-m', 설정.모델, '-c', `model_reasoning_effort="${설정.추론}"`];

module.exports = { GPT검수, codex모델인자 };
