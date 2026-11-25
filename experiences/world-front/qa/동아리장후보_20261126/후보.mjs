#!/usr/bin/env node
/**
 * 한국어 동아리장 얼굴 후보 (2026-11-26) — 유호님 「네, 후보 만들기」.
 *
 * 임시 얼굴(club-head, 「민우」)은 11-24 실존 인물 대조를 통과했다(렌즈 공인 카드 0 · 두 모델 흔함). 그 셀카 틀(동아리방 문간 · 손 인사 ·
 * 초록 맨투맨과 목걸이 명찰 · 밝은 앞빛과 금빛 역광)은 그대로 두고 얼굴 글만 세 방향으로 바꾼다. 옷 · 방 · 빛이 같아야 얼굴만 견줘 고르신다.
 * 얼굴 글은 실존 대조를 통과한 순서 「그 나이 한국 사람의 흔한 얼굴(작은 어긋남 포함) → 매력 → 꼭 보일 것 둘」로 쓰고 배우 · 아이돌을 닮으라는 말은 넣지 않는다
 * (새여자선배 4차의 교훈 — 갸름한 턱 · 곧은 콧대 · 긴 눈매 같은 다듬어진 생김새 글이 판별 모델에 걸린다).
 * 겹치지 않게 본 얼굴: 태오(갈색 앞머리 · 덧니), 지호(안경), 임시 민우(옆 가르마 짧은 머리 · 네모난 얼굴). 안경 · 수염 · 점은 넣지 않는다.
 *
 *   node experiences/world-front/qa/동아리장후보_20261126/후보.mjs   → 공용 작업본 .tmp/senior-f-face/jobs.json에 chd-* 작업을 넣는다(다른 작업은 그대로)
 *   bash .tmp/senior-f-face/돌림.sh "chd-perm_g1 chd-perm_g2 chd-crop_g1 chd-crop_g2 chd-round_g1 chd-round_g2"
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const D = path.join(공용작업본(뿌리), '.tmp', 'senior-f-face').replace(/\\/g, '/');

const OPEN = (나이) => `Create one photograph, vertical 3:4. A selfie a Korean university student just took with his phone for his messenger profile, in a bright, fresh Korean campus drama look.
He is the president of the university's Korean-language club: a fourth-year Korean student, ${나이} years old and looking his age, the easy, warm, talkative senior who learns every new international student's name on the first day. He has his own clearly distinct, original face.`;

// 얼굴마다 「흔한 얼굴 → 매력 → 꼭 보일 것 둘」
export const FACES = {
  // 가: 반곱슬 펌 · 눈웃음 — 먼저 들어 주는 다정한 형
  perm: {
    이름: '가 · 펌 머리',
    나이: 23,
    얼굴: `First the everyday Korean features of a man of 23: a long oval face with soft, low cheekbones and a slightly narrow chin; clear fair skin with a little natural redness on the cheeks; monolid eyes, the left one a touch smaller than the right; soft, slightly uneven natural brows; a medium nose with a rounded tip; medium lips. Then what makes him likeable: a gentle, open warmth, the senior who listens first and remembers what you said. Two things must be clearly visible: soft, natural wavy permed black hair, parted slightly off-centre, the loose waves falling to his brows; and eyes that curve into deep crescents as he laughs, his mouth open showing his upper teeth.`,
  },
  // 나: 투블럭 · 굵은 눈썹 — 사람 많은 곳에서 먼저 손 흔드는 활발한 형
  crop: {
    이름: '나 · 짧은 투블럭',
    나이: 23,
    얼굴: `First the everyday Korean features of a man of 23: a broad face with a strong, slightly wide jaw; healthy lightly tanned skin; medium double-lidded eyes; thick, dark, straight brows, one sitting a little higher than the other; a broad nose with a rounded tip; full lips. Then what makes him likeable: an energetic, sporty big-brother brightness, the first to wave across a crowded hall. Two things must be clearly visible: a short two-block cut, the sides clipped very short and the top a little longer and pushed up so his whole forehead shows; and a big open laugh with both thick brows lifted high, as if he just called out "hey!".`,
  },
  // 다: 둥근 얼굴 · 짧게 민 머리 — 다들 편해지는 푸근한 큰형
  round: {
    이름: '다 · 둥근 얼굴',
    나이: 24,
    얼굴: `First the everyday Korean features of a man of 24 with a stocky, solid build: a round face with full, soft cheeks and a short neck; warm skin with a natural ruddy flush; small single-lidded eyes; short, soft brows; a small rounded nose; a wide mouth. Then what makes him likeable: a comfortable, teddy-bear warmth, the big friendly senior everyone relaxes around. Two things must be clearly visible: a very short, even buzz cut; and round full cheeks pushed up by a broad laugh that almost closes his small eyes.`,
  },
};

// 임시 얼굴(club-head)과 같은 옷 · 순간 · 방 · 빛
const REST = `He wears a dark forest-green crew-neck sweatshirt with no lettering, and a navy lanyard around his neck with a plain white staff card turned backwards so nothing is readable. No glasses, no earrings, no jewelry, no hat, no beard or moustache.
THE MOMENT: he holds the phone himself at arm's length slightly above eye level (the phone and his arm are out of frame), standing in the open doorway of the club room, and raises his other hand in a small wave next to his face, palm toward the camera. He looks straight into the lens, mid-laugh, as if he has just said hi to someone new.
CAMERA: phone front camera, about 60 cm away, slightly wide, chest-up; his face in the upper third, slightly right of centre, about a third of the frame wide.
THE ROOM: a small, lived-in Korean university club room for a Korean-language club in early March: a long pale wooden table, mismatched chairs, a whiteboard with large hand-written Korean practice words that are too soft and far to read, a paper world map with a few coloured pins, an electric kettle and paper cups, a window with bare branches outside. Everything behind the person is soft and out of focus.
Light and color: bright, high-key, fresh and clear. A large soft frontal light from the window beside the camera falls evenly on both sides of the face, with bright catchlights in the eyes; a warm golden late-afternoon backlight from the window behind makes the edges of the hair glow; a gentle bloom only on the brightest highlights; a clean grade with lifted, milky-bright shadows. Nothing grey, dull, cold or muddy; no film grain; no haze over the face. The skin must look like an unretouched real photograph: fine visible pores, a natural sheen; absolutely no porcelain, airbrushed or plastic skin. No moles, freckles or dots on his face. Natural dark-brown irises.
Photorealistic, true skin texture, no beauty-filter smoothing. Hands have five natural fingers. No captions, subtitles, letters you can read, logos or watermarks anywhere. No border. The person must not resemble any real actor, idol, model or public figure.`;

export const 프롬프트 = (k) => `${OPEN(FACES[k].나이)}\n${FACES[k].얼굴}\n${REST}`;
export const 아이디들 = Object.keys(FACES).flatMap((k) => [1, 2].map((n) => `chd-${k}_g${n}`));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const 파일 = `${D}/jobs.json`;
  const 있던 = fs.existsSync(파일) ? JSON.parse(fs.readFileSync(파일, 'utf8')) : [];
  const 남김 = 있던.filter((j) => !String(j.id).startsWith('chd-'));
  const 새 = Object.keys(FACES).flatMap((k) => [1, 2].map((n) => ({ id: `chd-${k}_g${n}`, 얼굴: k, model: 'carbon', ratio: '3:4', refs: [], prompt: 프롬프트(k), out: `${D}/out/chd-${k}_g${n}.png` })));
  fs.writeFileSync(파일, `${JSON.stringify([...남김, ...새], null, 1)}\n`);
  console.log(새.map((j) => `${j.id} ${j.prompt.length}자`).join(' · '), '→', 파일, `(다른 작업 ${남김.length}개 그대로)`);
}
