#!/usr/bin/env node
/**
 * 문지영 교수 새 얼굴 후보 (2026-11-05) — 유호님 「제미나이로 새로 뽑아야지 지금 GPT로 만든 슬롭처럼 생겼어」.
 *
 * 10-30 승인 판(office-real, GPT Image 2.5)은 매끈한 화보 결이고, 11-04 실존 인물 대조에서 아르곤 「높음」 · GPT 「중간」으로
 * 「새치 섞인 단발 · 아치형 눈썹 · 짙은 쌍꺼풀 · 도톰한 입술」이 걸렸다(결정 11-04). 그래서 옛 얼굴을 참고로 넣지 않고 글로만 새로 굽는다.
 * 방법은 유호님이 고른 덧니 선배와 같다(`쇼케이스-20261031/새얼굴후보.mjs` — 나노바나나 2.1, 얼굴마다 「꼭 보일 특징 둘」).
 * 11-05 로맨스 지적(「앵글이 슬롭 · 맹해」)대로 얼굴을 가운데 두지 않고, 한쪽 빛 · 녹은 배경 · 눈과 입의 힘을 지시문에 적는다.
 *
 *   node experiences/drama/qa/문교수얼굴-20261105/후보.mjs   → 공용 작업본 .tmp/prof-face-nb/jobs.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const D = path.join(공용작업본(뿌리), '.tmp', 'prof-face-nb').replace(/\\/g, '/');

const OPEN = `Create one photograph, vertical 9:16. A still from a bright, fresh Korean campus drama, shot by a top Seoul drama crew. PROFESSOR MOON JI-YOUNG, a Korean university professor in her early fifties, the student's academic advisor: warm and quick-witted, and quietly firm about deadlines. She is genuinely beautiful for her age, with an elegant, intelligent, lived-in face that makes you want to be taught by her, and her own clearly distinct, original face.`;

// 옛 얼굴에서 걸린 넷(새치 단발 · 아치형 눈썹 · 짙은 쌍꺼풀 · 도톰한 입술)을 어느 후보도 쓰지 않는다.
const FACES = {
  glasses: {
    얼굴: `Her face is a slim, gently long oval with soft cheekbones and a neat chin. Two features must be clearly visible: one pair of thin gold-rimmed round glasses, with warm, narrow, clever eyes and fine inner double eyelids behind them; and deep, kind laugh lines fanning from the outer corners of her eyes. Straight, soft natural brows; a straight, slim nose; neat, thin lips with a natural rose color. Dark-brown hair pulled back into a low, loose knot at the nape, a few soft strands at her temples.`,
    옷: `She wears a soft ivory knit top under a slim camel cardigan. No earrings, no necklace, no other jewelry.`,
  },
  crop: {
    얼굴: `Her face is a clean heart-shaped oval with defined cheekbones and a light, pointed chin. Two features must be clearly visible: a short, modern, softly tapered pixie cut in natural black with a little fine silver at the temples only, her ears showing; and calm, single-lidded (monolid) long eyes that turn into bright crescents when she smiles. Low, straight brows; a slim nose with a soft tip; a slightly wide, thin-lipped mouth.`,
    옷: `She wears a crisp white cotton shirt with the collar open under a soft dusty-blue blazer. Very small plain silver studs; no necklace.`,
  },
  wave: {
    얼굴: `Her face is a soft rounded oval with full, gently lifted cheeks and a short chin. Two features must be clearly visible: shoulder-length, loose chestnut-brown waves, one side tucked behind her ear; and gently hooded eyes with a soft inner eyelid fold above a wide, warm, slightly lopsided smile that shows a little of her upper teeth. Soft, straight, feathered brows; a small nose with a rounded tip; medium, natural lips.`,
    옷: `She wears a soft sage-green knit cardigan over a cream cotton blouse. No earrings, no necklace.`,
  },
};

const MOMENT = `THE MOMENT: morning in her university office in the first week of March. She sits at her desk by the window, a student's paper in front of her below the frame. The viewer, a new international student, has just knocked and stepped inside. She has just looked up from the paper straight at the viewer, about to say "Yes, come in": a warm, knowing half-smile starting at one corner of her mouth, one eyebrow very slightly lifted, her eyes bright, alert and fully engaged. She looks like she already knows something funny about you. Hands below the frame.
CAMERA: from the doorway side, about 1.5 m away, at her eye level, 85mm f/1.8; chest-up. Her body is turned about 30 degrees to the window and her face turns back toward the lens. Her face sits in the upper third of the frame, clearly off-centre to the left, with open space on the right side of the frame. Her face is about a third of the frame wide.`;

const LIGHT = `Light and color: bright, fresh and clear, one-sided. Soft March morning daylight from a tall window on her left falls on that side of her face, and the far side of her face falls into a gentle natural shadow, with clear modelling on her cheek and nose. A faint warm rim on the edge of her hair. Clean color with lifted, airy shadows. Nothing grey, dull or muddy; no film grain; no haze over her face; no flat frontal light.
Background: the office behind her melts into a very soft blur: tall wooden bookshelves with colorful book spines (no readable letters), a small green plant on the sill, and, through the window, bare trees with thin dark branches and a few tiny yellow sansuyu blossoms. No green leaves on the trees and no cherry blossoms. No other people.
The skin must look like an unretouched real photograph of a woman in her early fifties: visible pores on her nose and cheeks, fine lines at the corners of her eyes and soft smile lines, a natural soft sheen, tiny natural unevenness, very light natural makeup; absolutely no porcelain, airbrushed or plastic skin, no beauty filter. No moles or dots on her face. Natural dark-brown irises. A few flyaway hairs catch the window light.
She must not resemble any real actor, idol, model or public figure. No text, letters, logos or watermarks anywhere. No border. Hands, if any show, have five fingers.`;

// 2차(11-05 밤, 1차 여섯 장을 본 뒤): 얼굴 결은 실제 사진으로 나왔지만 배경이 또렷해 사무실 스톡 사진 같고, 픽시 + 블레이저는 정치인처럼,
// 웨이브 + 카디건은 평범하게 읽힌다. 표정도 사진을 찍으려고 멈춘 얼굴이다. 그래서 매력 · 옷을 올리고, 말하는 순간을 잡고, 배경을 렌즈로 녹인다.
const OPEN2 = `Create one photograph, vertical 9:16. A still from a bright, fresh Korean campus drama, shot by a top Seoul drama crew on a cinema camera with a fast portrait lens. PROFESSOR MOON JI-YOUNG, a Korean university professor around fifty who looks younger, played by the kind of luminous K-drama actress viewers admire: graceful and quick-witted, warm with students and quietly firm about deadlines. She is strikingly beautiful for her age, stylish and intelligent, with her own clearly distinct, original face.`;

const FACES2 = {
  chic: {
    얼굴: `Her face is a slim oval with high, soft cheekbones and a neat chin. Two features must be clearly visible: one pair of very thin gold-rimmed round glasses sitting a little low on her nose, with warm, clever almond eyes and fine inner double eyelids looking over the rims; and fine, kind laugh lines fanning from the outer corners of her eyes. Straight, soft natural brows; a straight, slim nose; neat lips with a natural rose color. Glossy dark-brown hair pulled back into a low, loose, elegant knot, with soft strands framing her face.`,
    옷: `She wears a fine-gauge black turtleneck. No earrings, no necklace.`,
  },
  silk: {
    얼굴: `Her face is a soft oval with gently lifted cheeks and a delicate chin. Two features must be clearly visible: loose, glossy dark-brown waves falling just past her shoulders, parted a little off-centre, one side tucked behind her ear; and warm, softly hooded eyes that crease into crescents above a wide, easy smile showing her upper teeth. Soft, straight, feathered brows; a small straight nose; medium natural lips.`,
    옷: `She wears a fluid cream silk blouse with a soft open collar. Small plain gold studs; no necklace.`,
  },
  terra: {
    얼굴: `Her face is a clean heart-shaped oval with defined cheekbones and a light, pointed chin. Two features must be clearly visible: a short, soft, textured cut with long side-swept bangs in warm dark-brown, just covering the tops of her ears; and long, calm, single-lidded eyes that turn into bright crescents when she smiles. Low, straight brows; a slim nose with a soft tip; a slightly wide mouth.`,
    옷: `She wears a soft terracotta fine-knit sweater. No earrings, no necklace.`,
  },
};

const MOMENT2 = `THE MOMENT: morning in her university office in the first week of March. The viewer, a new international student, has just knocked and stepped inside. She has just looked up from a paper on her desk, straight at the viewer, mid-word, saying "Yes, come in": lips just parted on the word, a warm, amused smile in her eyes and at one corner of her mouth, one eyebrow very slightly lifted, head tilted about 5 degrees. Alert, alive, engaged, a little teasing. She is not posing for a portrait. Hands below the frame.
CAMERA: about 1.2 m away, at her eye level, 85mm at f/1.4; a tight head-and-shoulders. Her body is turned about 30 degrees toward the window and her face turns back to the lens. Her face sits in the upper third of the frame, clearly off-centre to the left, about 40% of the frame wide, with open blurred space on the right. At the very front of the frame, at the lower right edge, the out-of-focus corner of a stack of books adds depth.`;

const LIGHT2 = `Light and color: bright, fresh and clear, one-sided. Soft March morning daylight from a tall window on her left falls on that side of her face, and the far side of her face falls into a gentle natural shadow, with clear modelling on her cheek and nose. A faint warm rim on the edge of her hair. Clean color with lifted, airy shadows. Nothing grey, dull or muddy; no film grain; no haze over her face; no flat frontal light.
BACKGROUND: completely out of focus, like a fast portrait lens wide open; nothing behind her has a sharp edge. The bookshelves dissolve into soft smears of warm wood and muted color, and the window into a glowing pale shape with only a hint of bare branches and tiny yellow sansuyu blossoms. No readable letters. No other people.
The skin must look like an unretouched real photograph of a well-kept woman around fifty: visible pores on her nose and cheeks, fine lines at the corners of her eyes, a natural soft sheen, tiny natural unevenness, very light natural makeup; absolutely no porcelain, airbrushed or plastic skin, no beauty filter. No moles or dots on her face. Natural dark-brown irises. A few flyaway hairs catch the window light.
She must not resemble any real actor, idol, model or public figure. No text, letters, logos or watermarks anywhere. No border.`;

// 3차(11-06 새벽, 2차 대조 뒤): 2차 다섯은 Gemini가 「배우 프로필 화보 같다」로 높음 · 중간을 줬고(A는 두 모델 모두 중간, C · D · E는 높음), 「K-drama actress」 줄을 넣은 판은
// 굽기 거절도 잦았다. 그래서 그 줄을 빼고 조각에서 통과한 순서 「그 나이 한국 사람의 흔한 얼굴 → 매력」으로 쓴다. 안경을 쓰면 렌즈가 안경 상품만 찾아 역검색이 얼굴을 못 보니 안경 없는 판도 둔다.
const OPEN3 = `Create one photograph, vertical 9:16. A still from a bright, fresh Korean campus drama. PROFESSOR MOON JI-YOUNG, a Korean university professor around fifty, the student's academic advisor: warm and quick-witted, and quietly firm about deadlines; an original person.`;

const FACES3 = {
  ga: {
    얼굴: `First the everyday Korean features of a woman her age: a soft oval face with gently rounded cheeks and a small, soft chin; warm light skin; natural, slightly narrow eyes with a thin inner eyelid fold; soft, nearly straight brows; a small nose with a low bridge and a rounded tip; natural medium lips. Then what makes her attractive: a bright, amused intelligence in her eyes and a quick, warm smile; graceful, stylish, younger than her years. One pair of very thin gold-rimmed round glasses. Dark-brown hair pulled back into a low, loose knot, with soft strands at her temples.`,
    옷: `She wears a fine-gauge black turtleneck. No earrings, no necklace.`,
  },
  gb: {
    얼굴: `First the everyday Korean features of a woman her age: a slightly long oval face with flat, gentle cheekbones and a narrow chin; light skin; long, calm single-lidded eyes; low, soft, straight brows; a slim, straight nose with a soft tip; a thin upper lip and a medium lower lip. Then what makes her attractive: clever eyes that turn into crescents when she smiles, an elegant neck and posture; graceful, stylish, younger than her years. One pair of very thin gold-rimmed round glasses. Dark hair in a neat low ponytail over one shoulder.`,
    옷: `She wears a soft navy fine-knit sweater with a white shirt collar showing. No earrings, no necklace.`,
  },
  na: {
    얼굴: `First the everyday Korean features of a woman her age: a soft, slightly wide oval face with gentle cheekbones and a rounded chin; warm light skin; natural eyes with a thin double eyelid; soft, medium, natural brows; a straight nose of medium width with a rounded tip; medium natural lips. Then what makes her attractive: lively eyes and a warm, easy smile with a hint of mischief; graceful, stylish, younger than her years. Dark-brown hair pulled back into a low, loose knot, with long side-swept bangs. No glasses.`,
    옷: `She wears a soft oatmeal fine-knit turtleneck. No earrings, no necklace.`,
  },
};

const jobs = [
  ...Object.entries(FACES3).map(([k, f]) => ({ id: `prof-${k}`, ratio: '9:16', refs: [], prompt: [OPEN3, f.얼굴, f.옷, MOMENT2, LIGHT2].join('\n'), out: `${D}/out/prof-${k}_g{n}.png` })),
  ...Object.entries(FACES).map(([k, f]) => ({ id: `prof-${k}`, ratio: '9:16', refs: [], prompt: [OPEN, f.얼굴, f.옷, MOMENT, LIGHT].join('\n'), out: `${D}/out/prof-${k}_g{n}.png` })),
  ...Object.entries(FACES2).map(([k, f]) => ({ id: `prof-${k}`, ratio: '9:16', refs: [], prompt: [OPEN2, f.얼굴, f.옷, MOMENT2, LIGHT2].join('\n'), out: `${D}/out/prof-${k}_g{n}.png` })),
];
// 안경 뺀 사본(역검색 전용 — 화면에 쓰지 않는다): 안경을 쓴 판은 구글 렌즈가 안경 상품만 찾아(2차 A · B 얼굴 카드 0~1장) 얼굴 대조가 안 된다.
// 고른 판에서 안경만 지운 사본을 렌즈에 올리고, 사본 ↔ 원판의 SFace로 같은 얼굴인지 함께 적는다.
const 안경빼기 = (process.env.PROF_NOGLASS || '').split(/[ ,]+/).filter(Boolean); // 예: PROF_NOGLASS="prof-ga_g1 prof-gb_g1"
const NOGLASS = `Image 1 = a photograph. Make the SAME photograph again with exactly one change: the woman is not wearing glasses. Remove the eyeglasses and their thin gold frames completely and show her bare eyes, eyelids, lashes and brows naturally, exactly as they would look without glasses, with no marks on her nose.
Keep everything else exactly as in Image 1: the same face and face shape, the same eyes and eye shape, the same expression and mouth, the same skin with its pores and fine lines, the same hair, clothes, pose, framing, light, colors and blurred background. Do not make her younger, smoother or prettier, and do not turn her into another person.
Vertical 9:16, the same framing as Image 1. No text, letters, logos or watermarks.`;
for (const 판 of 안경빼기) jobs.push({ id: `${판.replace('_g', '-')}-ng`, ratio: '9:16', refs: [`${D}/out/${판}.png`], prompt: NOGLASS, out: `${D}/out/${판.replace('_g', '-')}-ng_g{n}.png` });
for (const j of jobs) if (j.prompt.length > 4300) throw new Error(`${j.id} ${j.prompt.length}자 — 4,300자 넘음`);
fs.mkdirSync(D, { recursive: true });
fs.writeFileSync(`${D}/jobs.json`, `${JSON.stringify(jobs, null, 1)}\n`);
console.log(jobs.map((j) => `${j.id} ${j.prompt.length}자`).join(' · '), '→', `${D}/jobs.json`);
