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

export const 판편집 = (옷) => `PHOTO EDIT of Image 1, vertical 3:4 — the same real smartphone selfie in the university cafeteria, re-taken with ONE change: the student on the LEFT (the one holding the phone) is now the person in Image 2.
THE NEW STUDENT: Image 2 shows THE SAME PERSON to keep — their face exactly (face shape and width, eyelids, brows, nose, lips, skin tone), their hair and their clothes (${옷.replace(/^Clothes: /, '').replace(/\.$/, '')}). They keep the youthful look of Image 2 — about 19 to 20, no wrinkles or forehead lines, firm skin with a fine natural texture. Their face never becomes rounder, softer or more generic.
POSE: the new student takes the left person's place, pose and gesture from Image 1 — the same V sign at chest height, the same head position, size and tilt, the same arm reaching to the lower-left corner holding the phone (the phone itself outside the frame), the same distance from the camera. Their body, shoulders and hands are their own and natural for them; five fingers on each hand.
KEEP EXACTLY AS IN IMAGE 1: Kwon Tae-o on the RIGHT — his face, hair, expression, finger heart, clothes and position stay unchanged; the cafeteria, windows, trays and food, the students in the background, the light, colours and phone-camera finish stay as in Image 1. Both faces share the same real phone-camera skin — visible pores, slight unevenness.
No text, letters, logos or brand marks on anything. Hands have five fingers.`;

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
