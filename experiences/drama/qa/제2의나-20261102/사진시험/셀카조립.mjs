#!/usr/bin/env node
/**
 * 「제2의 나」 GPT 셀카 결 확인 (2026-11-03) — 지시문 조립.
 *
 * 묻는 것: 학생 사진이 닿는 길에는 Google 생성형 AI를 쓰지 않으므로(결정 10-30) 본판 셀카도 GPT 이미지 2.5여야 한다.
 * 사진시험 셀카는 Gemini(나노바나나 2.1)로 구웠고, 옛 태오 때 GPT 셀카는 「태오만 매끈」했다(설계 8절).
 * 같은 지시문(`지시문조립.mjs`의 sf- 일감 — 태오 F1 특징 줄 · 카메라 수평 · 문장 책 빈칸 · 태오 피부 결도 학생과 같게)을
 * GPT로 구우면 ① 학생이 「강」 기준과 같은 사람으로 남나 ② 태오가 F1과 같은 사람인가(줄세우기) ③ 태오만 매끈한가(결재기 · 나란히 보기).
 * 참고는 5장(Codex 그림 도구 상한): Image 1 = GPT 「강」 기준(gpt2-<사람>-강), Image 2~5 = 덧니 태오 F1 · C1 · C4 · 웃는 기준.
 *
 *   node experiences/drama/qa/제2의나-20261102/사진시험/셀카조립.mjs   → .tmp/me2-20261102/photo-gpt/셀카/sf-<사람>-<포즈>.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 일감들 } from './지시문조립.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102');
const 밖 = path.join(작업, 'photo-gpt', '셀카');

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(밖, { recursive: true });
  // Gemini 판과 글자 하나 다르지 않게 같은 일감에서 지시문만 꺼낸다(참고 경로는 굽기 스크립트가 GPT 기준 · 태오 넷으로 붙인다)
  const 셀카 = 일감들(path.join(작업, 'photo-nb')).filter((j) => j.id.startsWith('sf-'));
  for (const j of 셀카) fs.writeFileSync(path.join(밖, `${j.id}.txt`), `${j.prompt}\n`);
  console.log(`[셀카] ${셀카.length}건 → ${밖} (${셀카.map((j) => `${j.id} ${j.prompt.length}자`).join(' · ')})`);
}
