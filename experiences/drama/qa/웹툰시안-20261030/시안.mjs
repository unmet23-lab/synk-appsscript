#!/usr/bin/env node
/**
 * 드라마 말하기 1화 「개강 첫날」 웹툰 그림 시안(2026-10-30) — 인물 시트(문지영 교수 · 권태오 선배, 결이 다른 안 셋씩) · 핵심 칸 · 화풍 비교를
 * GPT Image 2.5 Sunburst · max로 굽는다. 유호님 10-30 「그림 시안부터 · gpt 2.5 sunburst로 작업 해봐」 — 기획 §6의 나노바나나 기본을
 * 이번에는 유호님이 Sunburst로 고르셨다(결정 표 10-30). 굽기는 tools/GPT콘티굽기.mjs(GPT Pro 월 API 크레딧 · 결제 수단 없는 조직).
 * 대본 정본은 experiences/drama/s1/ep01.mjs(칸 · 인물), 방법의 출발점은 만족 사례 장부 S21(참조 그림 + 칸마다 같은 얼굴 검사).
 *
 *   node 시안.mjs 목록                                 판 id · 크기 · 참고
 *   node 시안.mjs 지시문 <작업>                         <작업>/지시문/<id>.txt 모두 쓰기(이 파일이 정본, txt는 굽기에 넘길 사본)
 *   node 시안.mjs 굽기 <작업> <id…> [--동시 3] [--덮어쓰기]   <작업>/받음/<id>.png · <id>_기록.json(이미 있으면 건너뜀)
 *
 * - 칸의 인물 참고는 기준안(아래 「기준안」)의 시트다. 시트를 다시 고르면 기준안을 바꾸고 칸을 새 id로 굽는다.
 * - 학생 배역은 학습자 자신이라 얼굴을 그리지 않는다(뒷모습 · 어깨 너머 · 손, 내 시점) — 기획 §2 「학생 배역은 이름 없이」와 같은 선.
 * - 지킬 것: 실존 인물 얼굴 · 이름 없음, 마스코트 없음, 그림 안 글자 없음(달력 숫자만), 화면 · 공개물에 도구 이름 없음.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 굽개 = path.resolve(여기, '../../../../tools/GPT콘티굽기.mjs');

// 칸을 구울 때 인물 참고로 넣는 시트(시트를 보고 정한다 — 페이지에는 「칸은 교수 안 N · 선배 안 M으로 구웠다」로 보인다).
export const 기준안 = { 교수: 1, 선배: 1 };

export const 공통 = `This is an original illustration for a Korean-language learning webtoon. All characters are original — they must not resemble any real actor, idol or public figure.
Avoid an AI-generated look: no glossy plastic skin, no airbrushed gradients on faces, no over-detailed noise, no lens flare or bloom; hands have five fingers, drawn simply and clearly.
No text, letters, words, numbers, logos, watermarks, signatures, speech bubbles or sound-effect lettering anywhere unless this prompt asks for it. No mascots, no cartoon animals.
No comic emphasis marks either — no sweat drops, surprise lines, sparkle marks or motion squiggles — unless this prompt asks for one.`;
// 검수 반영(10-30 Fable): 앞쪽 흐림(A 다섯 칸 실측 8~40배) · 머리 잔선 · 입술 광택이 AI 단서 → A · B 글에 초점 · 머리 · 입술 줄.
// C는 렌즈 느낌이 화풍의 일부라 그대로 두고, 「AI 티」 걱정을 페이지에 적는다.
const 초점 = `Everything is drawn in uniform sharp focus from the nearest foreground to the far background — a webtoon has no camera lens: no depth-of-field blur, no blurred foreground objects, no bokeh.`;

export const 화풍 = {
 A: { 이름: '맑은 캠퍼스 웹툰', 글: `ART STYLE — clean Korean campus webtoon: crisp hand-inked lines in dark brown with a steady weight (thinner lines inside faces); flat cel coloring with exactly one shadow tone and tiny simple highlights; a soft spring palette — cream, mint, sky blue, light denim, warm coral accents; natural proportions (about seven heads tall), slightly large expressive eyes, small simple noses and mouths; backgrounds drawn the way a webtoon artist draws them — clear perspective, simplified shapes, few textures, soft atmospheric color. Hair is drawn as 5–8 large locks with flat color and no individual strand lines; matte lips with no gloss highlight; skin flat with one shadow tone and no airbrushed blush gradients. It must read clearly at small phone size.` },
 // B · C 1판(10-30)은 A 칸을 Image 1로 넣고 「구도 그대로, 그리는 방식만」으로 구웠더니 A와 거의 같은 그림이 나왔다(칸 1의 맴돈 고리는 빠짐).
 // 2판부터는 A 칸을 넣지 않고 같은 칸 글 + 시트(생김새만)로 굽고, 화풍 글에 재료 · 붓 · 종이를 A와 다르게 못 박는다.
 B: { 이름: '연필 수채 일상툰', 글: `ART STYLE — hand-drawn pencil-and-watercolor slice-of-life webtoon, clearly painted by hand and clearly different from a clean digital webtoon: loose graphite pencil lines that are visibly rough and sketchy — doubled strokes, slight overshoots at corners, uneven pressure, some lines left unfinished and a few light construction lines left in; transparent watercolor washes that bleed a little past the lines, with soft blooms and pigment granulation; the white of cold-press paper showing through in the highlights; the paper grain varies — stronger where the wash pools, almost absent in the white areas, never an even filter over the whole picture; a muted warm palette — oatmeal, sage green, dusty rose, faded indigo, honey yellow; no hard cel shading, no digital gradients, no crisp vector lines. Faces stay simple and gentle.` },
 C: { 이름: '시네마 드라마 웹툰', 글: `ART STYLE — cinematic semi-realistic drama webtoon, clearly different from a clean flat campus webtoon: realistic adult proportions and facial structure (no large anime eyes), fine dark ink lines only on the contours; painterly digital rendering with soft brush strokes in the shadows and three-tone shading; strong, low, directional morning sunlight with a warm rim light and long cast shadows; a cinematic lens feel — the nearest foreground slightly out of focus and the background simplified with a soft depth of field; a natural film-like color grade (cool teal shadows, warm highlights) like a still from a Korean drama. Still clearly a drawn illustration — never a photo and never a 3D render.` },
};

export const 인물 = {
 교수: {
  이름: '문지영 교수',
  // 검수 반영(10-30 Fable): 안 1은 40대 중반, 안 3은 얼굴이 젊어 은발이 염색처럼 읽혔다 → 바탕에 나이 줄.
  바탕: `PROFESSOR MOON JI-YOUNG — a Korean woman in her mid-fifties, a professor of International Studies; East Asian Korean features drawn in webtoon style; she clearly looks her age — visible fine lines at the eyes and mouth, a slightly softer jawline; warm, intelligent eyes, light natural makeup; a calm, upright posture. She wears reading glasses that she pushes up or takes off.`,
  안: {
   1: { 이름: '단정한 학자', 글: `LOOK 1 (neat and scholarly): a neat chin-length bob of dark brown hair with a few natural silver strands at the temples, side part; thin round gold-rimmed reading glasses; a cream blouse under a soft navy cardigan; small pearl stud earrings; a slim leather wristwatch, always on her LEFT wrist.` },
   2: { 이름: '푸근한 다정', 글: `LOOK 2 (warm and motherly): soft shoulder-length permed hair with loose waves (the "volume perm" common for Korean women in their fifties), warm dark brown with slightly grey roots; half-rim tortoiseshell glasses on a thin beaded glasses chain; a mustard-yellow knit cardigan over an ivory turtleneck; a small silk scarf with a simple geometric or floral print (no chain or belt motifs); a rounder face with rosy cheeks.` },
   3: { 이름: '세련된 단호', 글: `LOOK 3 (sharp and elegant): silver-grey hair, mostly grey with darker streaks, tied in a low neat bun with a few loose strands framing her face; sharp black rectangular glasses; a charcoal tailored blazer over a black fine-knit turtleneck; small silver earrings; an angular face with strong, straight eyebrows. Her smile is rare but genuinely warm and softens her whole face.` },
  },
  시트: `(1) a full-body FRONT view, standing naturally, holding a closed folder against her chest, glasses on;
(2) a full-body BACK view;
(3) a LARGE head-and-shoulders portrait in three-quarter view facing slightly left, a gentle closed-mouth smile, glasses on — the biggest and most detailed face on the sheet;
(4) a column of three head close-ups, top to bottom: a warm open smile with glasses on; listening with a small nod, head slightly tilted, pushing her glasses up with one finger; glasses OFF and held in one hand — a FIRM, serious face with NO smile: straight brows, mouth closed in a straight line, a steady gaze at the viewer.
All views are unmistakably the same woman: identical face shape, eyes, nose, hairline, hairstyle, glasses and clothes.`,
 },
 선배: {
  이름: '권태오 선배',
  바탕: `SENIOR KWON TAE-O — a Korean male university student, about 23, a third-year in International Studies; East Asian Korean features drawn in webtoon style; an open, friendly face with a slightly mischievous grin; average-tall, with a relaxed, easy posture — the kind of guy who cannot walk past a lost freshman.`,
  안: {
   1: { 이름: '다정한 동네 형', 글: `LOOK 1 (friendly big brother): short tousled black hair, thick eyebrows, a bright grin that crinkles his eyes and a small dimple on his left cheek; a navy university varsity jacket (the Korean "gwajam") with cream sleeves and a small embroidered school crest on the left chest — a simple shield outline with a stylized open book and one small star inside; NOT a laurel wreath and not any real brand's logo; no lettering anywhere — over a grey hoodie; light jeans; white sneakers; a black backpack slung on one shoulder.` },
   2: { 이름: '안경 쓴 장난꾸러기', 글: `LOOK 2 (playful, with glasses): medium-length black "comma hair" with the fringe curling to one side, round thin black-rimmed glasses, a lopsided smirk and an easily raised eyebrow; an oversized sage-green cardigan over a white T-shirt; wide beige trousers; canvas sneakers; a canvas tote bag with two small round pins (no lettering); a pencil tucked behind his ear.` },
   3: { 이름: '쿨한데 다정한', 글: `LOOK 3 (cool but kind): a two-block haircut with the longer top swept back, sharper eyes that turn soft and crescent-shaped when he smiles, tall and lean; an open black windbreaker over a navy-and-white striped long-sleeve T-shirt; black cargo trousers; chunky sneakers; one thin silver ring; a dark grey sling bag across his chest.` },
  },
  시트: `(1) a full-body FRONT view, relaxed, one hand in his pocket, carrying his bag as described;
(2) a full-body BACK view (no lettering on the back of any clothing);
(3) a LARGE head-and-shoulders portrait in three-quarter view facing slightly right, a friendly, easy grin — the biggest and most detailed face on the sheet;
(4) a column of three head close-ups, top to bottom: a big grin, pointing his thumb at the center of his own chest; laughing and waving one open hand in front of him as if saying "no need to be so formal"; a teasing look — ONE eyebrow clearly raised higher than the other, a lopsided half smile, eyes slightly narrowed.
All views are unmistakably the same young man: identical face shape, eyes, nose, hairline, hairstyle and clothes.`,
 },
};

// 학생 — 1판(10-30)은 비니 밑으로 어깨까지 머리카락이 보여 성별이 읽혔다 → 머리를 비니 안에 다 넣는다.
// 검수 반영(10-30 Fable): B · C 칸 1에서 뒷목 머리가 되살아남 → 비니 테를 귀 · 뒷목까지. 맨손이 크면 피부색이 학습자를 하나로 정하니 손은 소매로 덮는다.
const 학생 = `THE STUDENT (the viewer's own role) — NEVER show the student's face. The student is seen only from behind, over the shoulder, or as a hand in the foreground: an oversized beige spring jacket, a light-grey knit beanie with ALL of the hair tucked inside it — the ribbed edge of the beanie sits low over the ears and the nape, and no hair shows anywhere beneath it (not at the nape, temples or sideburns) — and a black backpack. When a hand shows, the long beige sleeve covers it down to the knuckles so only the fingers show. The student's hand, beanie, backpack and tray in the foreground are inked with the same crisp lines and flat colors as everything else — fully sharp, never blurred, never a bokeh silhouette. Gender, age and face stay unreadable, so any learner can feel the student is them.`;

// 계절 — 1판(10-30)은 같은 날 아침인데 창밖이 칸 4 초록 잎 · 칸 8 벚꽃 · 칸 12 초록 잎으로 칸마다 달랐다. 개강 첫날(3월 첫 주)로 못 박는다.
// 검수 반영(10-30 Fable): 노란 꽃이 덤불처럼 빽빽해 4월 개나리로 읽힘 → 「드문드문 작은 송이」.
export const 계절 = `SEASON: the first week of March in Seoul, the first day of the spring semester — trees are still bare with thin dark branches, with only a few small, sparse clusters of tiny yellow cornus (sansuyu) blossoms on otherwise bare branches — most branches have none; no dense yellow bushes, no forsythia in full bloom; NO green leaves and NO cherry blossoms anywhere, including through windows. People wear light spring jackets.`;

const 시트글 = (역, 안) => {
 const p = 인물[역];
 return `CHARACTER MODEL SHEET for an original Korean webtoon, landscape, on a plain light warm-grey studio background, laid out like a webtoon studio's character sheet.
${화풍.A.글}
${초점}
${p.바탕}
${p.안[안].글}
LAYOUT, left to right with even spacing:
${p.시트}
Even, soft studio light. No scenery, no other people, no text, labels, numbers, arrows, color swatches or logos.
${공통}`;
};

const 시트참고 = (역) => `Image 1 is the character model sheet of ${역 === '교수' ? 'Professor Moon Ji-young — copy her face, hair, glasses and clothes exactly' : 'Kwon Tae-o — copy his face, hair and clothes exactly'} (do not copy the sheet layout or its grey background).`;
// 시트(화풍 A)를 다른 화풍 칸에 넣을 때 — 생김새만 따르고 선 · 채색은 따르지 않게.
const 시트참고_생김만 = (역) => `Image 1 is the character model sheet of ${역 === '교수' ? 'Professor Moon Ji-young' : 'Kwon Tae-o'} — use it ONLY for the character's design: face shape, eyes, hairstyle, ${역 === '교수' ? 'glasses, ' : ''}clothes and colors of the clothes. Do NOT copy its drawing style, line work or coloring — draw everything, including the character, in the ART STYLE above.`;

// 칸 글 — ep01.mjs 칸의 「그림」을 카메라 · 감정 · 자리로 풀어 쓴 것(앵글은 감정으로: 길 잃음은 위에서, 약속은 아래에서).
// 이어: 화풍 A 칸에만 Image 2로 넣는 앞 칸(이어글이 그 설명). B · C에는 A 칸을 넣지 않는다(넣으면 A의 그리는 방식까지 따라감 — 현장노트).
// 다시 확인(10-30 Fable, P1 0 · P2 1 · P3 6)에서 남은 것 — 1인칭 앞쪽 손 · 비니 · 식판 흐림, 칸 8 시계, 칸 4 손등, 머리 잔선 — 은 이 판의 그림을 다시 굽지 않고
// 다음 굽기(고르신 시트로 칸을 다시 그릴 때)부터 먹도록 학생 줄 · 화풍 A · 칸 4 · 8 글에 넣었다.
// 검수 반영(10-30 Fable): 연구실 두 칸(4 · 8)은 머리 없는 진짜 1인칭(교수 연구실에서 비니 쓴 학생은 높임말 장면에서 걸림, 「화면 밖의 나」와도 맞춤),
// 달력: 검수 반영판에 「작은 날짜 숫자」를 넣었더니 넷 모두 순서가 뒤섞이거나 빠져 GPT 시험관이 AI 단서로 짚었다(10-30) → 숫자 없이 칸마다 작은 점.
// 칸 4 ↔ 8 방이 좌우로 뒤집혀 칸 8 A에 칸 4를 Image 2로(창은 왼쪽 · 책장은 오른쪽), 칸 12 엄지는 가슴, 칸 14는 진짜 낮은 앵글, 책등 · 종이에 글자 같은 낙서 없음.
export const 방 = `ROOM LAYOUT (the same in every office panel): seen from the door side, the window with a bare tree outside is on the LEFT behind her, the tall bookshelves are on the RIGHT. Book spines are plain colored with no markings; open books and papers are mostly blank with only a few faint grey lines, never letter-like marks.`;
const 칸 = {
 '01': { 역: ['선배'], 글: `SCENE (episode 1, panel 1): an early-spring morning by the main gate of a Korean university campus. A large outdoor campus-map signboard stands beside a stone-paved plaza; the map shows only colored building shapes and paths — no readable words.
CAMERA: a high angle from behind — the camera is well above head height, looking down at about 30 degrees, about four meters back — the student looks small and a little lost.
THE STUDENT stands in front of the map, holding up a phone and comparing it with the map, scratching the beanie with the other hand (one small scratching squiggle above the beanie is allowed). Around their feet, a dashed comic line on the paving stones loops around them exactly THREE times (three separate loops, like a loose spiral) — they have walked around the same spot three times.
TAE-O walks past along the path in the middle distance on the right, glancing sideways at the student with a curious, amused little smile, his eyes open and on the student. His whole body is visible and his face is clearly readable.
Background: a red-brick university building, bare trees, a few far-away students drawn simply. Cool, clear morning light with soft long shadows.` },
 '04': { 역: ['교수'], 글: `SCENE (episode 1, panel 4): her office in the International Studies building, morning. Tall bookshelves densely packed with books and binders, a potted plant on the sunny windowsill, stacks of papers on her desk, and at the front right of her desk a small white spiral desk calendar on a navy stand showing a month grid page where each date cell holds only a tiny grey dot — NO digits anywhere on the calendar (the same calendar appears in later panels — no photo on it).
${방}
CAMERA: true first-person point of view of the student standing in the open doorway, eye level, medium shot — the student's head and shoulders are NOT in the frame. Only the student's hand, in the long beige sleeve that covers it to the knuckles, rests small and low on the edge of the open door at the left edge of the frame.
She sits at her desk behind an open book and looks up toward the viewer, pushing her reading glasses up her nose with one finger — a soft, welcoming expression. She looks directly at the viewer.` },
 '08': { 역: ['교수'], 이어: 'panel-04', 이어글: `Image 2 is panel 4 of this episode — the SAME office seen from the same side. Use Image 2 ONLY for the room layout and the desk calendar; do not copy its camera position.`, 글: `SCENE (episode 1, panel 8): at her desk, a moment later. Her reading glasses now lie folded on the desk beside the calendar. She is BARE-FACED with NO glasses on her face (unlike the model sheet) — the ONLY pair of glasses in the whole panel is the folded pair on the desk.
${방}
CAMERA: true first-person point of view of the student standing across the desk, eye level, medium close-up — the student's head and shoulders are NOT in the frame. Only the student's hand, in the long beige sleeve, holds a printed assignment sheet with blank lines (no readable text) in the lower-left foreground.
Her slim leather watch is on her LEFT wrist, visible as she points. She taps her small white spiral desk calendar on its navy stand with her index finger, right on next week's Friday: her index fingertip rests ON the red-circled date — the bold red hand-drawn circle is drawn around the exact date cell her finger touches. Her face is serious now — no smile: straight brows, lips closed in a straight line, and she looks STRAIGHT INTO THE CAMERA (at the viewer), not to the side — firm but kind ("don't be late").
The calendar page is a month grid where each date cell holds only a tiny grey dot — NO digits, words or weekday letters anywhere on the calendar.` },
 '12': { 역: ['선배'], 글: `SCENE (episode 1, panel 12): a busy Korean university student cafeteria at lunchtime — long tables, stainless-steel compartment trays with rice, soup, kimchi and side dishes, other students in the background drawn simply.
CAMERA: the student's point of view, just sitting down across the table from him, eye level, medium shot. The student's own tray is at the bottom edge of the frame (rice, soup, kimchi), with the beige jacket sleeve and the edge of the grey beanie at the left edge.
TAE-O sits across the table, leaning slightly forward over his tray, grinning and pointing his thumb at the center of his own chest — the hand held at chest height and drawn no larger than his face — "just call me sunbae". He looks directly at the viewer. Warm indoor light from big windows.` },
 '14': { 역: ['선배'], 이어: 'panel-01', 이어글: `Image 2 is panel 1 of this episode — use it ONLY for the student's clothes (beige jacket, light-grey beanie, black backpack); do not copy its location or composition.`, 글: `SCENE (episode 1, panel 14 — the last panel of the episode): outside the cafeteria building on a campus path, early afternoon.
CAMERA: a low angle — the camera is at the student's waist height looking slightly UP at Tae-o, so he stands tall against the sky. The student's back and shoulder, hurrying with quick little steps to catch up, fill no more than the lower-left quarter of the frame (we see the beige jacket, the black backpack strap and the grey beanie — never the face).
TAE-O walks a few steps ahead, turns back over his shoulder toward the viewer and gives a big thumbs-up with a confident, warm grin — "next week's club fair — promise!".
In the far background, the university library: a large building with a tall glass facade. A bright spring afternoon, soft clouds.` },
};

const 칸글 = (n, 풍 = 'A') => {
 const k = 칸[n];
 return `WEBTOON PANEL, vertical 4:5, a single panel with no border and no gutter.
${화풍[풍].글}
${풍 === 'C' ? '' : `${초점}\n`}${풍 === 'A' ? 시트참고(k.역[0]) : 시트참고_생김만(k.역[0])}
${풍 === 'A' && k.이어글 ? `${k.이어글}\n` : ''}${k.글}
${계절}
${학생}
${공통}`;
};

// 판 목록 — id는 파일 이름(ASCII, 페이지 파일 경로로도 쓴다).
export function 판목록(기준 = 기준안) {
 const 판 = {};
 for (const [역, 영] of [['교수', 'prof'], ['선배', 'senior']]) {
  for (const 안 of Object.keys(인물[역].안)) 판[`sheet-${영}-${안}`] = { 크기: '2048x1152', 글: 시트글(역, Number(안)), 참고: [], 종류: '시트', 역, 안: Number(안) };
 }
 const 시트id = (역) => `sheet-${역 === '교수' ? 'prof' : 'senior'}-${기준[역]}`;
 for (const n of Object.keys(칸)) {
  const 참고 = [시트id(칸[n].역[0])];
  if (칸[n].이어) 참고.push(`${칸[n].이어}-A`);
  판[`panel-${n}-A`] = { 크기: '1280x1600', 글: 칸글(n), 참고, 종류: '칸', 칸: Number(n), 화풍: 'A' };
 }
 for (const 풍 of ['B', 'C']) {
  for (const n of ['01', '08']) 판[`panel-${n}-${풍}`] = { 크기: '1280x1600', 글: 칸글(n, 풍), 참고: [시트id(칸[n].역[0])], 종류: '칸', 칸: Number(n), 화풍: 풍 };
 }
 return 판;
}

export function 굽기하나(작업, id, 판, 덮어쓰기) {
 const 나갈 = path.join(작업, '받음', `${id}.png`);
 if (fs.existsSync(나갈) && !덮어쓰기) { console.log(`[시안] 건너뜀(있음): ${id}`); return Promise.resolve(0); }
 const 지시문 = path.join(작업, '지시문', `${id}.txt`);
 fs.mkdirSync(path.dirname(지시문), { recursive: true });
 fs.writeFileSync(지시문, `${판.글}\n`);
 const 참고 = 판.참고.map((r) => path.join(작업, '받음', `${r}.png`));
 for (const p of 참고) if (!fs.existsSync(p)) { console.error(`[시안] ${id}: 참고 그림이 아직 없다 — ${path.basename(p)}`); return Promise.resolve(2); }
 const 인자 = [굽개, 지시문, 나갈, ...참고, '--크기', 판.크기, ...(덮어쓰기 ? ['--덮어쓰기'] : [])];
 return new Promise((풀림) => {
  const 자식 = spawn(process.execPath, 인자, { stdio: ['ignore', 'inherit', 'inherit'] });
  자식.on('close', (코드) => { if (코드) console.error(`[시안] ${id}: 굽기 실패(종료 ${코드})`); 풀림(코드 ?? 1); });
 });
}

async function 굽기(작업, ids, { 동시 = 3, 덮어쓰기 = false } = {}) {
 const 판 = 판목록();
 for (const id of ids) if (!판[id]) { console.error(`[시안] 모르는 판: ${id}`); process.exit(2); }
 const 줄 = [...ids];
 const 결과 = {};
 const 일꾼 = async () => { for (let id = 줄.shift(); id; id = 줄.shift()) 결과[id] = await 굽기하나(작업, id, 판[id], 덮어쓰기); };
 await Promise.all(Array.from({ length: Math.min(동시, ids.length) }, 일꾼));
 const 실패 = Object.entries(결과).filter(([, c]) => c);
 if (실패.length) { console.error(`[시안] 실패 ${실패.length}: ${실패.map(([i, c]) => `${i}(${c})`).join(' · ')}`); process.exit(실패.some(([, c]) => c === 3) ? 3 : 1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const [명령, 작업, ...나머지] = process.argv.slice(2);
 const 판 = 판목록();
 if (명령 === '목록') {
  for (const [id, p] of Object.entries(판)) console.log(`${id}\t${p.크기}\t${p.참고.join(', ') || '-'}`);
 } else if (명령 === '지시문' && 작업) {
  fs.mkdirSync(path.join(작업, '지시문'), { recursive: true });
  for (const [id, p] of Object.entries(판)) fs.writeFileSync(path.join(작업, '지시문', `${id}.txt`), `${p.글}\n`);
  console.log(`[시안] 지시문 ${Object.keys(판).length}개 → ${path.join(작업, '지시문')}`);
 } else if (명령 === '굽기' && 작업) {
  const ids = []; let 동시 = 3; let 덮어쓰기 = false;
  for (let i = 0; i < 나머지.length; i++) {
   if (나머지[i] === '--동시') 동시 = Number(나머지[++i]) || 3;
   else if (나머지[i] === '--덮어쓰기') 덮어쓰기 = true;
   else ids.push(나머지[i]);
  }
  if (!ids.length) { console.error('굽을 판 id를 준다(목록은 `node 시안.mjs 목록`)'); process.exit(2); }
  await 굽기(작업, ids, { 동시, 덮어쓰기 });
 } else {
  console.error('쓰는 법: node 시안.mjs 목록 | 지시문 <작업> | 굽기 <작업> <id…> [--동시 3] [--덮어쓰기]');
  process.exit(2);
 }
}
