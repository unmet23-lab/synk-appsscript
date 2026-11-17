#!/usr/bin/env node
/**
 * 새 여자 선배(튜터 선배 두 판의 둘째 판) 얼굴 후보 (2026-11-17) — 유호님 「네, 시안 만들어」.
 *
 * 이야기 지도 3-5의 「같은 과 3학년. 무심한 듯 챙긴다. 걸음이 빠르고 군말이 없다. 또박또박한 해요체」인 선배다.
 * 태오를 정한 방법 그대로 참고 그림 없이 글로만 굽는다(`쇼케이스-20261031/새얼굴후보.mjs` — 얼굴마다 「꼭 보일 것 둘」).
 * 문 교수 3차에서 실존 인물 대조를 통과한 순서 「그 나이 한국 사람의 흔한 얼굴 → 매력」으로 쓰고, 배우 · 아이돌을 닮으라는 말은 넣지 않는다.
 * 11-05 지적(「앵글이 슬롭 · 맹해」)대로 얼굴을 가운데서 조금 비키고, 한쪽 창빛 · 녹은 배경 · 말을 꺼내기 직전의 얼굴을 적는다.
 * 자리 · 철 · 과 점퍼는 태오 기준 사진과 같다(3월 첫 주 학생 식당, 산수유) — 선배 소개에 둘이 나란히 놓인다.
 * 겹치지 않게 본 얼굴: 태오(갈색 앞머리 · 덧니), 서하(짧은 단발 · 둥근 얼굴 · 활짝 웃음 · 청자켓), 지호(안경). 짧은 머리는 무대감독 몫으로 남긴다.
 *
 *   node experiences/drama/qa/새여자선배-20261117/후보.mjs   → 공용 작업본 .tmp/senior-f-face/jobs.json
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

const OPEN = `Create one photograph, vertical 9:16. A still from a bright, fresh Korean campus drama. A third-year Korean university student, about 22, the senior who quietly looks after a lost first-year student: brisk, dry-witted, a woman of few words who is kinder than she lets on; an original person.`;

// 얼굴마다 「흔한 얼굴 → 매력 → 꼭 보일 것 둘」 + 그 얼굴의 표정 한 줄(MOMENT의 {표정} 자리에 들어간다).
export const FACES = {
  // 가: 높은 포니테일 · 한쪽 입꼬리 — 군말 없이 앞서 걷는 선배
  pony: {
    이름: '가 · 포니테일',
    얼굴: `First the everyday Korean features of a woman in her early twenties: a slim oval face with smooth, gently flat cheekbones and a neat small chin; clear light skin; long, calm eyes with a thin inner eyelid fold; soft, straight natural brows; a slim straight nose with a soft tip; a thin upper lip and a slightly fuller lower lip. Then what makes her striking: a clear, steady, intelligent gaze; fresh, clean and effortlessly pretty, the senior a new student remembers after one glance. Two things must be clearly visible: her black hair tied in a high, neat ponytail with a few loose strands at her temples, her ears and neck showing; and a small one-sided smile that lifts only one corner of her mouth.`,
    표정: `lips closed, one corner of her mouth lifting into a small dry half-smile, one eyebrow very slightly raised, her eyes steady and bright`,
  },
  // 나: 쇄골 길이 층 낸 머리 · 외꺼풀 · 왼쪽 보조개 — 무표정이다가 웃으면 풀리는 선배(태오의 덧니와 짝이 되는 한 가지)
  dimple: {
    이름: '나 · 보조개',
    얼굴: `First the everyday Korean features of a woman in her early twenties: a soft oval face with gently full cheeks and a small rounded chin; warm light skin; single-lidded (monolid) eyes that curve into crescents when she smiles; soft, slightly short straight brows; a small nose with a low bridge and a rounded tip; medium natural lips. Then what makes her striking: a face that looks cool and unreadable at rest and turns disarmingly warm the moment she smiles; fresh, natural and pretty, the senior a new student remembers after one glance. Two things must be clearly visible: one deep dimple in her left cheek only; and dark-brown hair cut to the collarbone in soft straight layers, parted off-centre, one side tucked behind her ear.`,
    표정: `a closed-lip smile breaking through despite herself, the single dimple deep in her left cheek, her monolid eyes just starting to curve`,
  },
  // 다: 긴 생머리 옆 가르마 · 순한 눈매에 덤덤한 표정 — 조용히 다 알고 있는 선배
  long: {
    이름: '다 · 긴 머리',
    얼굴: `First the everyday Korean features of a woman in her early twenties: a small heart-shaped face with soft cheekbones and a neat, slightly pointed chin; fair skin; round, clear eyes with a thin natural double eyelid and slightly downturned outer corners; natural, medium-thick straight brows; a small straight nose; a short upper lip and soft medium lips. Then what makes her striking: gentle-looking eyes paired with a level, unimpressed, quietly amused expression; fresh, clean and luminous, the senior a new student remembers after one glance. Two things must be clearly visible: long, straight, glossy black hair falling past her shoulders, parted on the side, one side tucked behind her ear; and those soft, slightly downturned eyes looking straight into the lens.`,
    표정: `a level, quietly amused look, lips together with the faintest smile, her soft eyes fixed on the viewer as if she already knows the answer`,
  },
};

// 옷은 세 얼굴이 같다 — 얼굴만 견줘 고르시게. 태오와 같은 과 점퍼를 흰 티 위에 열어 입는다(태오는 회색 후드).
const CLOTHES = `She wears a navy university varsity jacket with cream sleeves and striped navy-and-cream cuffs, with a small embroidered crest on the left chest (a simple shield with a stylized open book and one small star inside, no lettering), worn open over a plain white cotton crew-neck T-shirt. No earrings, no necklace, no jewelry.`;

const MOMENT = (표정) => `THE MOMENT: lunchtime in a bright university cafeteria in the first week of March. She has just sat down across a long pale table from the viewer, a lost first-year student, without being asked; only the front edge of her stainless-steel lunch tray shows at the bottom of the frame. She has just looked up at the viewer, about to speak: her head tilted about 5 degrees, ${표정}. Alert, alive, a little amused. She is not posing for a portrait. Hands below the frame.
CAMERA: eye level across the table, about 1 m away, 85mm at f/2; chest-up. Her shoulders are turned about 20 degrees toward the windows and her face turns back to the lens. Her face sits in the upper third of the frame, slightly off-centre to the left, about a third of the frame wide, with open blurred space on the right.`;

const LIGHT = `Light and color: bright, high-key, fresh and clear. Soft March daylight from the tall windows on her left is the key light on that side of her face; the far side stays bright but clearly modelled on her cheek and nose. A warm golden backlight makes the edges of her hair glow. Clean color with airy, lifted shadows; her face glows. Nothing grey, dull or muddy; no film grain; no haze over her face; no flat frontal light.
BACKGROUND: the cafeteria behind her is soft and well out of focus, like a fast portrait lens: long tables, a few students eating in soft dark and grey jackets, tall windows; through the windows, bare trees with thin dark branches and only a few tiny yellow sansuyu blossoms; no green leaves and no cherry blossoms. No readable letters.
The skin must look like an unretouched real photograph: visible pores on her nose and cheeks, a natural soft sheen, tiny natural unevenness, very light natural makeup with a soft natural lip tint; absolutely no porcelain, airbrushed or plastic skin, no beauty filter. No moles, freckles or dots on her face. Natural dark-brown irises. A few flyaway hairs catch the backlight.
She must not resemble any real actor, idol, model or public figure. No text, letters, logos or watermarks anywhere. No border.`;

// ── 2차(11-17 저녁, 1차 첫 두 장을 본 뒤) ──
// 1차는 실제 사진처럼 나왔지만 태오 기준 사진 옆에 놓으면 빛이 차고 평평하고, 긴 머리 판은 스물일곱쯤으로 읽혔다. 문 교수의 「한쪽 창빛」을
// 그대로 옮긴 탓이다. 태오를 만든 틀(만족 사례 장부 S41 — 얼굴 양쪽에 고른 큰 앞빛 + 금빛 역광 + 밝은 곳만 옅은 번짐 + 우윳빛 그늘, 기획사 메이크업 + 진짜 피부)로
// 되돌리고, 나이를 스물하나로 적고, 표정을 살린다. 얼굴 순서(흔한 얼굴 → 매력 → 꼭 보일 것 둘)와 「배우 · 아이돌」 낱말을 안 쓰는 것은 그대로다.
const OPEN2 = `Create one photograph, vertical 9:16. A still from a bright, fresh Korean campus romance drama, shot by a top Seoul drama crew. A third-year Korean university student, 21 years old and looking her age, the cool, dry-witted senior every first-year student ends up following: brisk, a woman of few words, kinder than she lets on. She is strikingly pretty in a fresh, clear way, the kind of face that makes a viewer want to talk to her, with her own clearly distinct, original face.`;

export const FACES2 = {
  pony: {
    이름: '가 · 포니테일',
    얼굴: `First the everyday Korean features of a woman of 21: a slim oval face with smooth, softly full cheeks and a neat small chin; clear light skin; long, bright eyes with a thin inner eyelid fold; soft, straight natural brows; a slim straight nose with a soft tip; a thin upper lip and a slightly fuller lower lip. Then what makes her striking: a clear, steady, intelligent gaze and a youthful freshness. Two things must be clearly visible: her glossy black hair tied in a high, neat ponytail with a few loose strands at her temples, her ears and neck showing; and a small one-sided smile that lifts only one corner of her mouth.`,
    표정: `a small one-sided smile, one eyebrow very slightly raised, her eyes bright and amused`,
  },
  dimple: {
    이름: '나 · 보조개',
    얼굴: `First the everyday Korean features of a woman of 21: a soft oval face with gently full cheeks and a small rounded chin; warm light skin; single-lidded (monolid) eyes that curve into crescents when she smiles; soft, slightly short straight brows; a small nose with a low bridge and a rounded tip; medium natural lips. Then what makes her striking: a face that looks cool at rest and turns disarmingly warm the moment she smiles, and a youthful freshness. Two things must be clearly visible: one deep dimple in her left cheek only (a soft dent in the skin, never a dark dot); and glossy dark-brown hair cut to the collarbone in soft straight layers, parted off-centre, one side tucked behind her ear.`,
    표정: `a closed-lip smile she cannot quite hold back, the single dimple deep in her left cheek, her eyes curving into soft crescents`,
  },
  long: {
    이름: '다 · 긴 머리',
    얼굴: `First the everyday Korean features of a woman of 21: a small heart-shaped face with soft, full cheeks and a neat, slightly pointed chin; fair skin; round, clear eyes with a thin natural double eyelid and slightly downturned outer corners; natural, medium-thick straight brows; a small straight nose; a short upper lip and soft medium lips. Then what makes her striking: gentle-looking eyes paired with a calm, knowing expression, and a youthful freshness. Two things must be clearly visible: long, straight, glossy black hair falling past her shoulders with light, wispy see-through bangs over her forehead, one side tucked behind her ear; and those soft, slightly downturned eyes looking straight into the lens.`,
    표정: `a calm, knowing little smile with her lips together, her soft eyes bright and fixed on the viewer`,
  },
};

const MOMENT2 = (표정) => `THE MOMENT: lunchtime in a bright university cafeteria in the first week of March. She sits across a long pale table from the viewer; only the front edge of her stainless-steel lunch tray shows at the bottom of the frame. She has just looked up at the viewer, about to speak, her head tilted about 5 degrees: ${표정}, looking straight into the lens. Alive and engaged; she is not posing for a portrait. Hands below the frame.
CAMERA: eye level across the table, about 1 m away, 85mm at f/2, chest-up; her face in the upper third of the frame, slightly left of centre, about a third of the frame wide.`;

const LIGHT2 = `Light and color: bright, high-key, fresh and clear. A large soft frontal light from the tall windows falls evenly on both sides of her face, with bright catchlights in her eyes; a warm golden backlight from the windows behind her makes the edges of her hair glow; a gentle bloom only on the brightest highlights; a clean grade with lifted, milky-bright shadows. Nothing grey, dull, cold or muddy; no film grain; no haze over her face.
Makeup by a top agency team, fresh and natural for a university student: a dewy, even base, soft peach blush high on the cheeks, softly defined lashes, natural straight brows, a coral gradient lip tint. The skin must look like an unretouched real photograph of a 21-year-old: fine visible pores, fine peach fuzz caught by the backlight, a natural dewy sheen; absolutely no porcelain, airbrushed or plastic skin. No moles, freckles or dots on her face. Natural dark-brown irises. A few flyaway hairs catch the light.
Background: the cafeteria behind her is soft and well out of focus, long tables and a few students eating, nobody looking at the camera; through the windows, bare trees with thin dark branches and only a few tiny yellow sansuyu blossoms; no green leaves and no cherry blossoms.
She must not resemble any real actor, idol, model or public figure. No text, letters, logos or watermarks anywhere. No border.`;

const 판수 = Number(process.env.SF_TAKES || 2);
const jobs = [];
for (const [k, f] of Object.entries(FACES2)) {
  const prompt = [OPEN2, f.얼굴, CLOTHES, MOMENT2(f.표정), LIGHT2].join('\n');
  if (prompt.length > 4300) throw new Error(`sf2-${k} ${prompt.length}자 — 4,300자 넘음`);
  for (let n = 1; n <= 판수; n++) jobs.push({ id: `sf2-${k}_g${n}`, 얼굴: k, 차: 2, model: 'carbon', ratio: '9:16', refs: [], prompt, out: `${D}/out/sf2-${k}_g${n}.png` });
}
for (const [k, f] of Object.entries(FACES)) {
  const prompt = [OPEN, f.얼굴, CLOTHES, MOMENT(f.표정), LIGHT].join('\n');
  if (prompt.length > 4300) throw new Error(`sf-${k} ${prompt.length}자 — 4,300자 넘음`);
  for (let n = 1; n <= 판수; n++) jobs.push({ id: `sf-${k}_g${n}`, 얼굴: k, model: 'carbon', ratio: '9:16', refs: [], prompt, out: `${D}/out/sf-${k}_g${n}.png` });
}
// ── 3차(11-17 밤, 2차 실존 인물 대조 뒤) — 「다」만 다시 ──
// 2차 「다 · 긴 머리」 두 판은 구글 렌즈에서 같은 공인 얼굴이 셋 모여 걸렸다(공인 최고 0.47 · 0.51). 가는 앞머리 + 긴 생머리 + 작은 하트형 얼굴 + 둥근 쌍꺼풀 눈의 조합이
// 한 사람 쪽으로 몰린 것이라, 머리(앞머리 없는 긴 웨이브) · 눈(외꺼풀 긴 눈) · 얼굴형(조금 긴 타원) · 눈썹 · 입을 바꿔 새로 굽는다. 빛 · 옷 · 자리는 2차와 같다.
export const FACES3 = {
  wave: {
    이름: '다 · 긴 웨이브',
    얼굴: `First the everyday Korean features of a woman of 21: a slightly long oval face with a smooth, softly defined jawline and gentle cheekbones; clear light skin; long, single-lidded (monolid) eyes with a cool, level gaze; straight, slightly thick natural brows; a straight nose of medium width with a soft tip; a slightly wide mouth with natural medium lips. Then what makes her striking: a calm, unbothered, quietly confident look that softens the moment she is amused, and a youthful freshness. Two things must be clearly visible: long dark-brown hair in loose, soft waves falling past her shoulders, with a deep side part and no bangs, her forehead open, one side tucked behind her ear; and those long monolid eyes looking straight into the lens.`,
    표정: `a calm, knowing little smile at one corner of her mouth, lips together, her eyes bright and level`,
  },
};
for (const [k, f] of Object.entries(FACES3)) {
  const prompt = [OPEN2, f.얼굴, CLOTHES, MOMENT2(f.표정), LIGHT2].join('\n');
  if (prompt.length > 4300) throw new Error(`sf3-${k} ${prompt.length}자 — 4,300자 넘음`);
  for (let n = 1; n <= 판수; n++) jobs.push({ id: `sf3-${k}_g${n}`, 얼굴: k, 차: 3, model: 'carbon', ratio: '9:16', refs: [], prompt, out: `${D}/out/sf3-${k}_g${n}.png` });
}
// ── 4차(11-17 밤, 2차 · 3차 판별 뒤) ──
// 2차 네 장은 역검색을 넘었지만 판별 모델이 GPT 「중간」 · Gemini 「높음」으로 봤다(또렷한 아몬드 눈 · 애교살 · 정돈된 눈썹 · 계란형 턱선 — 「배우 프로필처럼 다듬어진 인상」).
// 문 교수 2차와 같은 걸림이다. 3차 긴 웨이브도 한 장이 역검색에 걸렸다. 머리를 내린 판은 렌즈가 배우 프로필 카드를 25~44장 모아 왔고, 묶은 머리(포니테일)는 0~1장이었다.
// 그래서 ① 「드라마 스틸 · 기획사 메이크업 · strikingly pretty · 번짐」을 빼고 친구가 찍은 사진의 결로 굽는다(대조를 낮음으로 넘은 얼굴 조각의 틀). 밝고 따뜻한 빛과 스물한 살은 그대로 둔다.
// ② 얼굴 글에 흔한 얼굴의 작은 어긋남(조금 다른 두 눈, 고르지 않은 눈썹, 둥근 코끝, 볼의 홍조)을 넣고, 매력은 표정(이가 조금 보이는 진짜 웃음)에서 낸다.
// ③ 셋째 방향은 머리를 내리지 않는다 — 집게핀으로 올린 머리.
const OPEN4 = `Create one photograph, vertical 9:16. A candid moment that looks like a real photo a friend took across the table, in the natural look of a bright Korean campus drama. A third-year Korean university student, 21 years old and looking her age, the senior who quietly looks after a lost first-year student: brisk, dry-witted, kinder than she lets on; an original, ordinary-looking person.`;

export const FACES4 = {
  pony: {
    이름: '가 · 포니테일',
    얼굴: `First the everyday Korean features of a woman of 21: a slim oval face with softly full cheeks and a small rounded chin; light skin with a natural flush on the cheeks; ordinary, slightly narrow eyes with a thin inner eyelid fold, one eye a touch narrower than the other; soft, natural, slightly uneven straight brows; a small nose with a low bridge and a rounded tip; a thin upper lip and a slightly fuller lower lip. Then what makes her likeable: a clear, steady, intelligent gaze and a quick, dry smile. Two things must be clearly visible: her black hair tied in a high ponytail with loose strands at her temples and a few baby hairs along the hairline, her ears showing; and a one-sided smile that lifts one corner of her mouth and shows a little of her upper teeth.`,
    표정: `a one-sided smile breaking out at one corner of her mouth, a little of her upper teeth showing, her eyes narrowing slightly with amusement`,
  },
  dimple: {
    이름: '나 · 보조개',
    얼굴: `First the everyday Korean features of a woman of 21: a soft, slightly round oval face with full cheeks and a small rounded chin; warm light skin with a natural flush; natural single-lidded eyes that narrow into crescents when she smiles; soft, slightly short, natural brows; a small nose with a low bridge and a rounded tip; medium natural lips. Then what makes her likeable: she looks cool at rest and turns warm the moment she smiles. Two things must be clearly visible: one dimple in her left cheek only (a soft dent in the skin, never a dark dot), showing as she smiles; and dark-brown hair cut to the collarbone, parted off-centre, one side tucked behind her ear.`,
    표정: `a real smile she cannot hold back, her upper teeth just showing, the single dimple in her left cheek, her eyes narrowing into soft crescents`,
  },
  clip: {
    이름: '다 · 올린 머리',
    얼굴: `First the everyday Korean features of a woman of 21: a slightly long oval face with gentle cheekbones and a soft jaw; light skin with a natural flush; natural, long single-lidded eyes; straight, natural, slightly thick brows; a straight nose of medium width with a rounded tip; a slightly wide mouth with natural lips. Then what makes her likeable: a calm, unbothered look that softens the moment she is amused. Two things must be clearly visible: her dark-brown hair twisted up loosely at the back of her head and held with a plain matte claw clip, a few loose strands falling at her temples and neck, her ears showing; and her long single-lidded eyes looking at the viewer.`,
    표정: `a small, amused smile, lips just parting, her long eyes bright and level`,
  },
};

const MOMENT4 = (표정) => `THE MOMENT: lunchtime in a bright university cafeteria in the first week of March. She sits across a long pale table from the viewer; only the front edge of her stainless-steel lunch tray shows at the bottom of the frame. The viewer has just said something a little clumsy and she is amused: ${표정}, looking at the viewer. A real, unposed moment. Hands below the frame.
CAMERA: across the table at eye level, about 1 m away; chest-up; her face in the upper third of the frame, a little off-centre, about a third of the frame wide.`;

const LIGHT4 = `Light and color: bright, fresh March daylight. Large soft window light from the front-left falls across her face, the far side only slightly darker; warm sunlight from the windows behind her catches the edges of her hair. A clean, natural exposure with a slightly warm white balance. Nothing grey, dull or cold; no haze, no glow, no bloom, no HDR.
Finish: a real photograph, never an advert, a fashion shoot or an actor's profile picture. Real, unretouched skin: visible pores, slight unevenness, a natural flush, a little shine on the nose. Everyday makeup she did herself, almost none, just a tinted lip balm. No airbrushing. No moles, freckles or dots on her face. Natural dark-brown irises. A few flyaway hairs catch the light.
Background: the cafeteria behind her is soft and out of focus, long tables and a few students eating, nobody looking at the camera; through the windows, bare trees with thin dark branches and only a few tiny yellow sansuyu blossoms; no green leaves and no cherry blossoms.
She must not resemble any real actor, idol, model or public figure. No text, letters, logos or watermarks anywhere. No border.`;

for (const [k, f] of Object.entries(FACES4)) {
  const prompt = [OPEN4, f.얼굴, CLOTHES, MOMENT4(f.표정), LIGHT4].join('\n');
  if (prompt.length > 4300) throw new Error(`sf4-${k} ${prompt.length}자 — 4,300자 넘음`);
  for (let n = 1; n <= 판수; n++) jobs.push({ id: `sf4-${k}_g${n}`, 얼굴: k, 차: 4, model: 'carbon', ratio: '9:16', refs: [], prompt, out: `${D}/out/sf4-${k}_g${n}.png` });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(`${D}/out`, { recursive: true });
  fs.writeFileSync(`${D}/jobs.json`, `${JSON.stringify(jobs, null, 1)}\n`);
  console.log(jobs.map((j) => `${j.id} ${j.prompt.length}자`).join(' · '), '→', `${D}/jobs.json`);
}
