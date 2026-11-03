#!/usr/bin/env node
/**
 * 「제2의 나」 장면 판 편집 작은 시험 (2026-11-03) — 지시문 조립.
 *
 * 묻는 것: 일괄 처리 파이프라인에서 셀카마다 태오 줄세우기(Fable 눈 검사)를 학생마다 돌릴 수는 없다.
 * 태오 · 배경 · 식판이 확정된 장면 판을 한 번 굽고 검수해 두고, 학생마다 그 판의 왼쪽 학생 자리만 기준 사진의 사람으로 바꾸는
 * 편집으로 구우면 ① 새 학생이 기준과 같은 사람으로 나오나 ② 태오가 판 그대로 남나(판 태오와 숫자로 견줄 수 있게) ③ 성별이 다른
 * 대역 자리도 바뀌나. 옷장 편집(기준 사진에서 바꾼 것만 바뀜, 얼굴 0.75~0.96)과 같은 「한 가지만 바꾸기」 꼴이다.
 * 판은 GPT 셀카 결 확인에서 구운 김치 판 둘(u1 = 여 대역 자리, u2 = 남 대역 자리), 학생은 GPT 「강」 기준.
 *
 *   node experiences/drama/qa/제2의나-20261102/사진시험/판편집조립.mjs   → .tmp/me2-20261102/photo-gpt/판편집/<판>-to-<학생>.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 대상 } from './지시문조립.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 밖 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'photo-gpt', '판편집');

// 11-03 밤 Fable 2차(사진시험 README 「장면 판 편집」): 첫 판에서 학생 피부가 판의 매끈한 결로 끌려가 u2 여드름 자국이 거의 사라졌다 →
// 학생 피부는 Image 2 그대로, 판에서는 빛 방향 · 화이트밸런스 · 노이즈 · 선명도만 맞춘다. 체격 · 머리 길이는 학생 것으로 다시 그리고, 태오는 다시 그리지 않는다.
export const 판편집 = (옷, 몸짓 = 'the V sign at chest height') => `PHOTO EDIT of Image 1 (the plate), vertical 3:4 — the same real smartphone selfie in the university cafeteria, re-taken with ONE change: replace ONLY the person on the LEFT (the one holding the phone) with the person in Image 2 (the student). Nothing of the previous person remains.
THE STUDENT: Image 2 shows THE SAME PERSON to keep — their face exactly (face shape and width, eyelids, brows, nose, lips, skin tone), their hair and their clothes (${옷.replace(/^Clothes: /, '').replace(/\.$/, '')}). They keep the youthful look of Image 2 — about 19 to 20, no wrinkles or forehead lines. Their face never becomes rounder, softer or more generic.
SKIN: render the student with the raw phone-camera skin of Image 2 — keep their pores, marks, freckles, acne scars, oily sheen and uneven tone exactly as in Image 2. Do NOT smooth, brighten or even out their skin to match the plate — match only the plate's lighting direction, white balance, grain and sharpness.
BUILD AND POSE: scale the student to their real build — head size, shoulder width and seat height as a person of their sex and body type would sit beside Tae-o; redraw the left arm, the sleeve and the hand at their hand size; hair length as in Image 2. Keep the plate's gesture — ${몸짓} — and the arm reaching to the lower-left corner holding the phone (the phone itself outside the frame), at the same distance from the camera. Five fingers on each hand.
KEEP EXACTLY AS IN IMAGE 1: Kwon Tae-o on the RIGHT, the trays and food, the table, the windows, the students in the background and the framing — do not redraw, sharpen or re-beautify Tae-o.
No text, letters, logos or brand marks on anything.`;

// 판(대역 자리) × 학생: 남 → 여 · 여 → 남 · 같은 성별을 하나씩
export const 짝 = [['u1', 'yuho'], ['u1', 'u2'], ['u2', 'u1'], ['u2', 'yuho']];

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(밖, { recursive: true });
  for (const [판, 학생] of 짝) {
    const s = 대상.find((d) => d.id === 학생);
    fs.writeFileSync(path.join(밖, `${판}-to-${학생}.txt`), `${판편집(s.옷)}\n`);
  }
  console.log(`[판편집] ${짝.length}건 → ${밖}`);
}
