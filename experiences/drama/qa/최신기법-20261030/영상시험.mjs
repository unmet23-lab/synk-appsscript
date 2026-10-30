#!/usr/bin/env node
/**
 * 드라마 말하기 1화 — 「살아 있는 상대역」 영상 시험(2026-10-30). 유호님 「시험해 봐」 뒤 「훨씬 더 살아있는 느낌이었으면 좋겠어. 4d? 실사? …
 * 처음 보는 사람이 "와. 진짜 신기하다" 라는 느낌」. 조사 문서(같은 폴더 조사.md)의 ①②를 같은 장면 · 같은 대사로 결 셋에 굽는다.
 *
 * - 결 셋: 실사(real) · 3D 애니메이션 영화(3d) · 지금 게임 쪽 반실사(game). 실사는 기획 원칙 1과 부딪쳐 시험으로만 본다.
 * - 장면: 연구실, 문 교수가 책상 너머에서 학생(화면 밖의 나)을 본다. 교수 5번 「다음 주 금요일 …」(단호) → 학생 → 교수 6번 「그래요. …」(따뜻).
 * - 클립 셋(결마다): talk5 · talk6(우리 녹음을 소리 참고로 넣고 입을 맞춤), listen(내 차례에 듣는 반응, 소리 없음).
 *   세 클립 모두 같은 시작 그림에서 시작해 같은 그림으로 끝난다(시작 · 끝 잠금) — 페이지가 끊김 없이 이어 붙인다.
 * - Seedance 2.0 std 480p를 쓴다. 2.5 omni_reference는 얼굴 정지컷 + 소리 참고에서 첫 화면을 다시 짰고, 2.0은 시작 · 끝 그림 + 소리 참고를
 *   그대로 지켰다(현장노트 higgsfield 「얼굴 정지컷에 소리 참고를 같이 주면 첫 화면을 다시 짠다」).
 *
 * - 둘째 판(10-30): 유호님 「왜 이 교수님으로 해준거야? 캠퍼스분위기로 상큼하고 잘생기고 예쁜그림으로 해줬어야지」 → 태오 선배 · 봄 캠퍼스(vid-senior-*).
 *   「힉스필드 크레딧 쓰는거면 지금 당장 진행하지는 마」라 시작 그림만 먼저 굽고(결은 실사 · 3D 게임 시네마틱 · 2D 게임 쪽), 영상은 고르신 결 하나만 나중에.
 *
 *   node 영상시험.mjs 목록 | 굽기 <작업> <id…> [--동시 3] [--덮어쓰기]     시작 그림(GPT Image 2.5 Sunburst, 월 API 크레딧)
 *   node 영상시험.mjs 영상글 <결> <클립>                                  힉스필드에 낼 영상 지시문(정본)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 인물, 기준안, 계절, 방, 굽기하나 } from '../웹툰시안-20261030/시안.mjs';
import { 실사화풍, 게임결 } from '../웹툰시안-20261030/라이브실사.mjs';

const 교수생김 = `${인물.교수.바탕}\n${인물.교수.안[기준안.교수].글}`;

// 1판(10-30)은 게임 쪽 입신(live-prof-g)을 생김새 참고로 넣었더니 반실사 게임 결로 끌려 게임 판과 거의 같았다 → 참고 없이 글로만, 양식화를 세게.
export const 입체화풍 = `STYLE — a frame from a modern 3D CG animated feature film of the kind families watch in theaters: clearly STYLIZED, not realistic — a slightly larger head and big expressive eyes with clear irises and bright catchlights, simplified rounded shapes, a small simple nose, soft smooth skin with subsurface scattering and gentle rosy cheeks (still showing her age with a few soft smile lines), hair sculpted as soft rounded clumps, fabrics with a visible but simplified knit texture, warm cinematic lighting with soft global illumination, gentle bounce light and a soft background blur. Unmistakably a 3D animated-movie character — never a photo, never semi-realistic game art, never a 2D drawing. An original design — not imitating any specific studio, film or character.`;

const 영상공통 = `This is an original character for a Korean-language learning drama. She is an ORIGINAL person who must not resemble any real actor, idol or public figure.
Avoid an AI-generated look: no glossy plastic skin, no over-smoothed airbrushed face, no over-detailed noise, no lens flare or bloom; hands have five fingers, natural and relaxed.
No text, letters, words, numbers, logos, watermarks or signatures anywhere. No mascots, no cartoon animals.`;

// 세 결이 같은 구도 — 첫 화면이자 끝 화면(듣는 얼굴)이라 입은 다물고, 손은 책상 위에서 다 보이게(말할 때 손짓 · 달력 짚기).
const 영상틀 = `VERTICAL 9:16 FIRST FRAME of a short dialogue video. CAMERA: the student's first-person point of view, sitting across her desk at eye level — a MEDIUM CLOSE-UP. She sits behind her desk facing the camera, framed from mid-chest up; her face is in the upper-middle of the frame (eyes about 35% from the top) and large enough to read every small expression; her forearms rest on the desk at the bottom of the frame with her hands loosely together — both hands fully visible. A small white spiral desk calendar on a navy stand stands on the desk at the lower LEFT, within reach of her right hand; its grid holds only tiny grey dots, no digits. No part of the student is in the frame.
FACE: she looks straight into the camera with a calm, attentive, gently warm expression — lips CLOSED and relaxed, not smiling broadly — the neutral face of someone listening. Reading glasses on.
ROOM: her office in the International Studies building, morning. ${방} Soft morning window light from the LEFT.
${계절}`;

// 둘째 판 — 태오 선배 · 봄 캠퍼스. 교수 판의 3D(가족 애니메이션 결)는 잘생긴 인물과 안 맞아 고급 3D 연애 게임 컷신 결로 바꾼다.
// 생김새 글의 「drawn in webtoon style」은 실사 · 3D에서 결을 끌어당기니 뺀다. 실사는 지난 비교의 실사 태오(real-senior, 식당)를 얼굴 참고로만 넣고 배경은 버리게 한다.
const 선배생김 = `${인물.선배.바탕.replace(' drawn in webtoon style', '')}\n${인물.선배.안[기준안.선배].글}
He is strikingly handsome in a fresh, boyish way — bright clear eyes, clean skin, a defined jawline, the warm charm of a Korean campus-drama lead — an ORIGINAL face that must not resemble any real actor or idol.`;
// 1판(10-30)은 「stylized-realistic」을 사진처럼 읽어 실사 판과 거의 같았다 → 게임 엔진 렌더임이 한눈에 보이게(모공 없는 매끈한 피부 · 조각한 머리 덩어리 · 살짝 큰 눈).
export const 게임3D결 = `STYLE — a frame from the real-time story cutscene of a premium mobile 3D romance game, rendered in a game engine: an obviously CG 3D character model, NOT photorealistic — slightly stylized idealized proportions with slightly larger, luminous eyes and a smaller refined nose, flawless smooth skin shaded with soft subsurface scattering and no pores or photo texture, hair modelled as clearly sculpted glossy clumps with clean specular highlights (no flyaway photo strands), clean physically based fabrics with tidy simplified detail, slightly saturated colors, a crisp rim light and a soft game-engine depth of field. It must read at first glance as a beautiful 3D game character — never a photograph, never a 2D illustration, never a cartoonish family-film character. An original design — not imitating any specific game, studio or character.`;
const 선배공통 = `This is an original character for a Korean-language learning drama. He is an ORIGINAL person who must not resemble any real actor, idol or public figure.
Avoid an AI-generated look: no glossy plastic skin, no over-smoothed airbrushed face, no over-detailed noise, no lens flare or bloom; hands have five fingers, natural and relaxed.
No text, letters, words, numbers, logos, watermarks or signatures anywhere — the small school crest on his jacket has no lettering. No mascots, no cartoon animals.`;
// 세 결이 같은 구도 — 첫 화면이자 끝 화면이라 입은 다문 반가운 얼굴. 선배 2번(「…편하게 선배라고 불러요」)에서 엄지로 가슴을 가리킬 손이 화면 안에 있게.
const 선배틀 = `VERTICAL 9:16 FIRST FRAME of a short dialogue video. CAMERA: the freshman's first-person point of view, standing on the campus plaza facing him at eye level — a MEDIUM CLOSE-UP. Kwon Tae-o stands facing the camera, framed from mid-chest up; his face is in the upper-middle of the frame (eyes about 33% from the top) and large enough to read every small expression; one hand loosely holds the strap of the backpack on his shoulder, inside the frame. No part of the student is in the frame.
FACE: he looks straight into the camera with a friendly, easy, confident expression — a warm closed-mouth smile with bright eyes and a hint of his dimple, lips CLOSED — the face of someone who just spotted a lost freshman and is about to say hello.
PLACE: a bright, fresh Korean university campus on the first morning of the spring semester — a wide stone-paved plaza in front of clean modern campus buildings of red brick and glass, a few students in light spring jackets far behind him, a clear blue sky with a few soft white clouds, crisp morning sunlight from the LEFT giving a fresh golden rim light on his hair and shoulder. The color feel is fresh and bright: clear sky blue, cream, navy and soft yellow accents.
${계절}`;

export function 판목록() {
 return {
  'vid-senior-real': { 크기: '1152x2048', 참고: ['real-senior'], 글: `PHOTOREAL KOREAN DRAMA STILL.
${실사화풍}
Image 1 shows this exact young man — keep his face, hair and clothes identical; he is the same person. Use it only for who he is: ignore its cafeteria background entirely — the pose, framing and the outdoor campus follow this prompt.
${선배생김}
${선배틀}
${선배공통}` },
  'vid-senior-3d': { 크기: '1152x2048', 참고: [], 글: `${게임3D결}
${선배생김}
${선배틀}
${선배공통}` },
  'vid-senior-game': { 크기: '1152x2048', 참고: ['live-senior-g'], 글: `${게임결}
Image 1 is this exact character in this exact art style — keep his face, hair, clothes and the painted game-art rendering identical. Use it only for who he is and how he is drawn; the pose, framing and the outdoor campus scene follow this prompt and are painted in the same style.
${선배생김}
${선배틀}
${선배공통}` },
  'vid-real': { 크기: '1152x2048', 참고: ['real-prof'], 글: `PHOTOREAL KOREAN DRAMA STILL.
${실사화풍}
Image 1 shows this exact woman — keep her face, hair, glasses, earrings, wristwatch and clothes identical; she is the same person. Use it only for who she is; the pose and framing follow this prompt.
${교수생김}
${영상틀}
${영상공통}` },
  'vid-3d': { 크기: '1152x2048', 참고: [], 글: `${입체화풍}
${교수생김}
${영상틀}
${영상공통}` },
  'vid-game': { 크기: '1152x2048', 참고: ['live-prof-g'], 글: `${게임결}
Image 1 is this exact character in this exact art style — keep her face, hair, glasses, clothes and the painted game-art rendering identical. Use it only for who she is and how she is drawn; the pose, framing and the office scene follow this prompt and are painted in the same style.
${교수생김}
${영상틀}
${영상공통}` },
 };
}

// 영상 지시문 — 힉스필드 Seedance 2.0 std 480p 9:16, 시작 그림 = 끝 그림(같은 미디어), 말하는 클립만 소리 참고(앞 0.3초 무음 + 우리 녹음).
const 결이름 = { real: 'a photoreal Korean TV drama shot', '3d': 'a 3D animated feature film', game: 'painted game art' };
const 한판 = 'One single continuous take with absolutely no cut. The camera keeps the same framing with only a very slight natural handheld breathing — it never zooms, never pushes in, never cuts, never switches angle.';
const 그대로 = (결) => `Keep her face, hair, glasses and clothes identical to the first frame in every frame, and keep the look of ${결이름[결]} in every frame. She ends in exactly the starting pose and expression, lips closed.`;
export const 클립 = {
 talk5: { 소리: 'ep01-professor-05.mp3', 초: 7, 글: `Professor Moon speaks the Korean line in the audio reference directly to the camera, perfectly in sync with it, starting right away: on the first words she glances down and taps the small desk calendar once with her right index finger, then looks back up into the camera and says the last sentence slowly and firmly with a small serious nod, eyebrows slightly lowered. Natural, subtle acting like a Korean TV drama — real blinks, breathing and small head movements. After the line she settles back.` },
 talk6: { 소리: 'ep01-professor-06.mp3', 초: 6, 글: `Professor Moon speaks the Korean line in the audio reference directly to the camera, perfectly in sync with it, starting right away: her face softens into a warm smile, she tilts her head slightly and opens one hand toward the camera in a small welcoming gesture, then lets it rest on the desk again. Natural, subtle acting like a Korean TV drama — real blinks, breathing and small head movements. After the line she settles back.` },
 listen: { 소리: null, 초: 5, 글: `Professor Moon silently listens to the student speaking off-camera: her lips stay closed the whole time; she keeps eye contact with the camera, gives two small slow nods, blinks naturally, and a faint warm smile comes and goes. Subtle breathing. No speech and no mouth movement.` },
};
export const 영상글 = (결, 이름) => `${한판}\n${클립[이름].글}\n${그대로(결)}`;

async function 굽기(작업, ids, { 동시 = 3, 덮어쓰기 = false } = {}) {
 const 판 = 판목록();
 for (const id of ids) if (!판[id]) { console.error(`[영상시험] 모르는 판: ${id}`); process.exit(2); }
 const 줄 = [...ids];
 const 결과 = {};
 const 일꾼 = async () => { for (let id = 줄.shift(); id; id = 줄.shift()) 결과[id] = await 굽기하나(작업, id, 판[id], 덮어쓰기); };
 await Promise.all(Array.from({ length: Math.min(동시, ids.length) }, 일꾼));
 const 실패 = Object.entries(결과).filter(([, c]) => c);
 if (실패.length) { console.error(`[영상시험] 실패: ${실패.map(([i, c]) => `${i}(${c})`).join(' · ')}`); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const [명령, 가, ...나머지] = process.argv.slice(2);
 if (명령 === '목록') {
  for (const [id, p] of Object.entries(판목록())) console.log(`${id}\t${p.크기}\t${p.참고.join(', ') || '-'}`);
 } else if (명령 === '영상글' && 결이름[가] && 클립[나머지[0]]) {
  console.log(영상글(가, 나머지[0]));
 } else if (명령 === '굽기' && 가) {
  const ids = []; let 동시 = 3; let 덮어쓰기 = false;
  for (let i = 0; i < 나머지.length; i++) {
   if (나머지[i] === '--동시') 동시 = Number(나머지[++i]) || 3;
   else if (나머지[i] === '--덮어쓰기') 덮어쓰기 = true;
   else ids.push(나머지[i]);
  }
  if (!ids.length || !fs.existsSync(가)) { console.error('굽을 판 id와 있는 작업 폴더를 준다'); process.exit(2); }
  await 굽기(가, ids, { 동시, 덮어쓰기 });
 } else {
  console.error('쓰는 법: node 영상시험.mjs 목록 | 굽기 <작업> <id…> [--동시 3] [--덮어쓰기] | 영상글 <real|3d|game> <talk5|talk6|listen>');
  process.exit(2);
 }
}
