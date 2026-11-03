#!/usr/bin/env node
/**
 * 「제2의 나」 옷장 작은 시험 (2026-11-03, 유호님 「옷장 시험도 해」) — 기준 사진 편집 지시문 조립.
 *
 * 묻는 것: 학생 캐릭터의 기준 사진(사진 시험의 「강」 판, 유호님이 고름)에서 머리 · 옷 · 액세서리를 바꿔 입혀도 같은 사람으로 남나,
 * 한 번에 몇 초 · 몇 번 만에 되나. 잘라 붙이지 않고 기준 사진 한 장을 통째로 다시 찍는 편집으로 한다(T-C — 칸 합성은 빛 · 그림자 이음새).
 * 머리는 얼굴까지 바꾸기 쉬워(유호님 얼굴 작업 「글로 머리만 바꾸면 얼굴까지 바뀐다 0.28~0.32」, 현장노트 그림_굽기_오리기) 얼굴을 붙드는 줄을 앞에 둔다.
 * 엔진은 기준 사진과 같은 GPT 이미지 2.5(`T-C/굽기.cjs` — ChatGPT 구독, 현금 0). 늘 까는 「젊게」 보정은 기준에 이미 들어 있어 「그대로」로만 적는다.
 *
 *   node experiences/drama/qa/제2의나-20261102/사진시험/옷장조립.mjs   → .tmp/me2-20261102/photo-gpt/옷장/<id>.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 밖 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'photo-gpt', '옷장');

const 머리말 = (무엇) => `PHOTO EDIT of Image 1, vertical 3:4 — the same real smartphone photo, re-taken with ONE change: ${무엇}.
KEEP EXACTLY: the same person — face shape and width, eyes and eyelids, brows, nose, lips, ears, skin tone and the same youthful, wrinkle-free, firm skin with a fine natural texture; the same smile, head angle, pose, camera distance and framing; the same empty university cafeteria, window light and colours. Everything that is not the change stays as in Image 1.`;
const 꼬리 = 'Realistic and natural, as if the student really looks like this today — not a costume, not a fashion shoot, no airbrushing. No text, letters, logos or brand marks on anything. Hands have five fingers.';

// 대상마다 머리 둘(작은 변화 · 큰 변화) · 옷 하나 · 액세서리 하나. 학생이 실제로 고를 법한 한국 캠퍼스 흐름에서 골랐다.
export const 옷장 = {
  yuho: [
    ['hair1', 'his hair restyled into a soft Korean "comma hair" cut — the same length and black colour, side-parted, the fringe curving down toward one brow', 'His hairline and forehead shape stay his.'],
    ['hair2', 'his hair dyed a clearly lighter ash-brown, obvious in the daylight, same cut and length', 'Only the hair colour changes; brows stay dark.'],
    ['outfit', 'he now wears an oversized light-blue denim jacket over a plain white T-shirt instead of the sweater', 'The hair stays exactly as in Image 1.'],
    ['acc', 'he now wears thin round silver-rimmed glasses with clear lenses', 'The eyes stay the same size and shape behind clear lenses, no reflections hiding them.'],
  ],
  u1: [
    ['hair1', 'her hair let down into a shoulder-length layered cut with soft face-framing layers, same black colour', 'Her hairline and forehead shape stay hers.'],
    ['hair2', 'her hair tied up in a high, bouncy ponytail with a few loose strands at the temples', 'Her hairline stays hers.'],
    ['outfit', 'she now wears a pale-blue cotton shirt under a cream knit vest instead of the cardigan', 'The hair stays exactly as in Image 1.'],
    ['acc', 'she now wears a thin gold necklace worn clearly over the T-shirt neckline and small gold hoop earrings, one side of her hair tucked behind the ear so an earring shows', 'Nothing else changes.'],
  ],
  u2: [
    ['hair1', 'his hair restyled into a neat Korean down-perm two-block cut — the sides clipped short with the shaved sides visible, a soft fringe falling forward, same black colour', 'His hairline and forehead shape stay his.'],
    ['hair2', 'his hair dyed a warm light brown, styled into a side-parted comma cut', 'Brows stay dark; only the hair changes.'],
    ['outfit', 'he now wears a khaki MA-1 bomber jacket over a grey T-shirt instead of the sweatshirt', 'The hair stays exactly as in Image 1.'],
    ['acc', 'he now wears a plain black baseball cap (no logo), worn forward', 'The face under the cap stays fully visible and the same.'],
  ],
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(밖, { recursive: true });
  for (const [who, 칸] of Object.entries(옷장)) for (const [k, 무엇, 지킴] of 칸) {
    const 글 = [머리말(무엇), 지킴, 꼬리].join('\n');
    fs.writeFileSync(path.join(밖, `${who}-${k}.txt`), `${글}\n`);
  }
  console.log(`[옷장] ${Object.values(옷장).flat().length}건 → ${밖}`);
}
