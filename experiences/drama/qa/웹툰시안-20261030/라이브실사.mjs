#!/usr/bin/env node
/**
 * 드라마 말하기 1화 — 2D 라이브 · 실사 느낌 비교 시안(2026-10-30). 유호님 「뭔가 너무 뻔해보이는데. 2d live? 3d live? 이런식으로 해보는거 어때? …
 * 실사느낌으로 gpt 2.5 sunburst로 한번 뽑아보자 … 2d live 버전이랑 실사느낌버전이랑 나란히 비교해보면 좋을것같아」.
 *
 * - 2D 라이브: 게임 · 비주얼 노벨의 라이브2D처럼 캐릭터가 배경 위에서 숨 쉬고 · 눈 깜빡이고 · 말할 때 입이 움직이는 판.
 *   배경(사람 없음) · 서 있는 반신 그림(입신, 단색 바탕 → 오려 냄) · 같은 그림의 눈 감은 판 · 입 벌린 판을 굽고, 페이지가 겹쳐 움직인다(보기 · 라이브조각.py).
 * - 실사 느낌: 같은 두 장면(연구실 문 교수 · 식당 태오)을 GPT Image 2.5 Sunburst 실사 드라마 스틸로. 기획 원칙 1(실사처럼 보이려는 AI 인물을 쓰지 않음)과
 *   부딪치므로 비교용 시안이고, 고르시면 그 원칙부터 다시 정한다.
 * - 인물 생김새는 웹툰 시안의 교수 안 1 · 선배 안 1 시트를 따른다(기준안). 학생은 두 판 모두 화면에 없는 내 시점이다.
 *
 *   node 라이브실사.mjs 목록 | 굽기 <작업> <id…> [--동시 3] [--덮어쓰기]      (<작업>은 웹툰 시안과 같은 .tmp/drama-webtoon-20261030)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 인물, 기준안, 공통, 계절, 방, 굽기하나 } from './시안.mjs';

const 교수생김 = `${인물.교수.바탕}\n${인물.교수.안[기준안.교수].글}`;
const 선배생김 = `${인물.선배.바탕}\n${인물.선배.안[기준안.선배].글}`;
const 교수시트 = `sheet-prof-${기준안.교수}`;
const 선배시트 = `sheet-senior-${기준안.선배}`;

export const 라이브화풍 = `ART STYLE — premium Korean mobile-game character art made for Live2D animation, the look of a high-end visual novel or otome game: crisp clean anime line art with varied line weight; soft cel shading with smooth blended gradients (two to three tones); luminous eyes with detailed irises and soft catchlights; a gentle warm rim light; vivid but harmonious colors; hair as large glossy locks with soft highlights. Original characters and an original look — not imitating any specific game or studio.`;
export const 실사화풍 = `STYLE — a photoreal still frame from a high-budget Korean drama: shot on a cinema camera with a 50mm lens, natural soft window light, gentle film grain, true-to-life skin texture and fabric. The characters are strikingly attractive like Korean drama leads, but they are ORIGINAL people who must not resemble any real actor, idol or public figure. A real photograph — never an illustration, never a 3D render.`;

export const 게임결 = `ART STYLE — splash-art quality of a premium Korean mobile otome / visual-novel game made for Live2D: clean thin line art; rich painterly cel rendering with soft blended gradients and subtle glow; luminous eyes with layered irises, soft reflections and catchlights; glossy hair rendered as large locks with bright highlight bands; a warm rim light separating the character from the background; saturated but tasteful palette. Clearly a polished game character, NOT a flat webtoon panel. Original look — not imitating any specific game or studio.`;

const 생김만 = (역) => `Image 1 is the character model sheet of ${역 === '교수' ? 'Professor Moon Ji-young' : 'Kwon Tae-o'} — use it ONLY for the character's design: face shape, hairstyle, ${역 === '교수' ? 'glasses, ' : ''}clothes and clothing colors. Do NOT copy its drawing style — render the character in the STYLE above.`;
const 입신틀 = `LAYOUT: a standing visual-novel character portrait ("tachie") for compositing over a separate background — the character alone, facing the viewer and looking straight into the camera, centered horizontally; the top of the head is about 12% below the top edge and the bottom edge cuts the body at mid-thigh. Plain flat light-grey background (#DADADA) with no shadow, no floor and no scenery. Soft daylight from the viewer's LEFT.`;
const 바뀐것만 = (무엇) => `Image 1 is a finished character portrait. Create EXACTLY the same image — same pose, framing, lighting, colors, hair, clothes, background and line work, pixel-for-pixel wherever possible — with ONE change only: ${무엇}. Nothing else moves.`;

export function 판목록() {
 const 판 = {
  'live-bg-office': { 크기: '1152x2048', 참고: [], 글: `VISUAL NOVEL BACKGROUND, vertical 9:16, no people at all.
${라이브화풍}
SCENE: Professor Moon's office in the International Studies building, morning, seen at standing eye height from just inside the doorway, as the backdrop behind a character who will be composited standing in the center. Her desk with an open book and a small white spiral desk calendar on a navy stand sits in the middle distance; ${방.replace('ROOM LAYOUT (the same in every office panel): seen from the door side, ', '')}
The calendar grid holds only tiny grey dots — no digits.
${계절}
Keep the center of the image calm and slightly soft in detail so a character can stand there; no characters, no hands, no people.
${공통}` },
  'live-bg-cafeteria': { 크기: '1152x2048', 참고: [], 글: `VISUAL NOVEL BACKGROUND, vertical 9:16, no people in the foreground.
${라이브화풍}
SCENE: a bright Korean university student cafeteria at lunchtime, seen at seated eye height across a long table: stainless-steel compartment trays with rice, soup, kimchi and side dishes on the table in the lower part of the frame, big windows behind, far-away students drawn small and simple in the back.
${계절}
Keep the center of the image calm so a character can be composited standing there; no character in the center or foreground.
${공통}` },
  'live-prof': { 크기: '1152x2048', 참고: [교수시트], 글: `${라이브화풍}
${생김만('교수')}
${교수생김}
${입신틀}
POSE AND FACE: standing relaxed, holding a closed folder against her chest with both hands; her reading glasses on; a warm, welcoming closed-mouth smile with kind eyes, as if greeting a new student — lips CLOSED.
${공통}` },
  'live-senior': { 크기: '1152x2048', 참고: [선배시트], 글: `${라이브화풍}
${생김만('선배')}
${선배생김}
${입신틀}
POSE AND FACE: standing relaxed, pointing his thumb at the center of his own chest (hand at chest height, no larger than his face), a friendly confident grin with lips CLOSED, eyes bright — as if saying "just call me sunbae".
${공통}` },
  'real-prof': { 크기: '1152x2048', 참고: [교수시트], 글: `PHOTOREAL KOREAN DRAMA STILL, vertical 9:16.
${실사화풍}
${생김만('교수')}
${교수생김}
SCENE (episode 1): her office in the International Studies building, morning. ${방}
CAMERA: the student's first-person point of view standing across her desk, eye level, medium close-up — no part of the student is in the frame.
She sits at her desk, glasses on, looks up straight into the camera with a warm, welcoming smile, as if asking "so, how is life in Korea?". A small white spiral desk calendar on a navy stand (only tiny dots, no digits) and an open book on the desk.
${계절}
${공통}` },
  'real-senior': { 크기: '1152x2048', 참고: [선배시트], 글: `PHOTOREAL KOREAN DRAMA STILL, vertical 9:16.
${실사화풍}
${생김만('선배')}
${선배생김}
SCENE (episode 1): a busy Korean university student cafeteria at lunchtime — long tables, stainless-steel compartment trays with rice, soup, kimchi and side dishes, other students in the background.
CAMERA: the student's first-person point of view, sitting down across the table from him, eye level, medium shot — the student's own tray at the bottom edge of the frame, no other part of the student.
He sits across the table, leaning slightly forward, grinning and pointing his thumb at the center of his own chest (hand no larger than his face) — "just call me sunbae". He looks straight into the camera.
${계절}
${공통}` },
 };
 // 게임 결 시험(-g): 시트를 넣으면 그림체가 웹툰 시트 쪽으로 끌려(10-30 첫 판) — 시트 없이 글로만 생김새를 주고 게임 일러스트 결을 세게 민다.
 판['live-prof-g'] = { 크기: '1152x2048', 참고: [], 글: `${게임결}\n${교수생김}\n${입신틀}\nPOSE AND FACE: standing relaxed, holding a closed folder against her chest with both hands; her reading glasses on; a warm, welcoming closed-mouth smile with kind eyes, as if greeting a new student — lips CLOSED.\n${공통}` };
 판['live-senior-g'] = { 크기: '1152x2048', 참고: [], 글: `${게임결}\n${선배생김}\n${입신틀}\nPOSE AND FACE: standing relaxed, pointing his thumb at the center of his own chest (hand at chest height, no larger than his face), a friendly confident grin with lips CLOSED, eyes bright — as if saying "just call me sunbae".\n${공통}` };
 // 실사도 눈 · 입 판(10-30 Fable 검수 #3 — 왼쪽만 움직이면 비교가 움직임 쪽으로 기운다). 사진 결은 그대로 두라고 덧붙인다.
 const 사진그대로 = ' Keep the photographic skin texture, film grain and focus pixel-identical.';
 for (const [역, id] of [['교수', 'live-prof'], ['선배', 'live-senior'], ['교수', 'live-prof-g'], ['선배', 'live-senior-g'], ['교수', 'real-prof'], ['선배', 'real-senior']]) {
  const 끝 = id.startsWith('real-') ? 사진그대로 : '';
  판[`${id}-blink`] = { 크기: '1152x2048', 참고: [id], 글: 바뀐것만(`${역 === '교수' ? 'her' : 'his'} eyes are gently CLOSED in a natural blink (eyelids down, lashes visible${역 === '교수' ? ', glasses unchanged' : ''})`) + 끝 };
  판[`${id}-talk`] = { 크기: '1152x2048', 참고: [id], 글: 바뀐것만(`${역 === '교수' ? 'her' : 'his'} mouth is OPEN mid-word as if speaking — a natural relaxed talking mouth, upper teeth barely visible; the smile stays the same`) + 끝 };
 }
 return 판;
}

async function 굽기(작업, ids, { 동시 = 3, 덮어쓰기 = false } = {}) {
 const 판 = 판목록();
 for (const id of ids) if (!판[id]) { console.error(`[라이브실사] 모르는 판: ${id}`); process.exit(2); }
 const 줄 = [...ids];
 const 결과 = {};
 const 일꾼 = async () => { for (let id = 줄.shift(); id; id = 줄.shift()) 결과[id] = await 굽기하나(작업, id, 판[id], 덮어쓰기); };
 await Promise.all(Array.from({ length: Math.min(동시, ids.length) }, 일꾼));
 const 실패 = Object.entries(결과).filter(([, c]) => c);
 if (실패.length) { console.error(`[라이브실사] 실패: ${실패.map(([i, c]) => `${i}(${c})`).join(' · ')}`); process.exit(실패.some(([, c]) => c === 3) ? 3 : 1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const [명령, 작업, ...나머지] = process.argv.slice(2);
 if (명령 === '목록') {
  for (const [id, p] of Object.entries(판목록())) console.log(`${id}\t${p.크기}\t${p.참고.join(', ') || '-'}`);
 } else if (명령 === '굽기' && 작업) {
  const ids = []; let 동시 = 3; let 덮어쓰기 = false;
  for (let i = 0; i < 나머지.length; i++) {
   if (나머지[i] === '--동시') 동시 = Number(나머지[++i]) || 3;
   else if (나머지[i] === '--덮어쓰기') 덮어쓰기 = true;
   else ids.push(나머지[i]);
  }
  if (!ids.length) { console.error('굽을 판 id를 준다(목록은 `node 라이브실사.mjs 목록`)'); process.exit(2); }
  if (!fs.existsSync(작업)) { console.error(`작업 폴더가 없다: ${작업}`); process.exit(2); }
  await 굽기(작업, ids, { 동시, 덮어쓰기 });
 } else {
  console.error('쓰는 법: node 라이브실사.mjs 목록 | 굽기 <작업> <id…> [--동시 3] [--덮어쓰기]');
  process.exit(2);
 }
}
