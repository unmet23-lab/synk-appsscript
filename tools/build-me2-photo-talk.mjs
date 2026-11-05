#!/usr/bin/env node
// 「제2의 나」 사진 아바타 — SYNK-talk me2-photo 함수가 동봉하는 지시문 · 옷장 · 장면 · 동의 판 사본을 만든다(2026-11-04, 일괄 처리 설계 8절).
//   node tools/build-me2-photo-talk.mjs --talk <talk 폴더>          lib/me2-photo-prompts.js를 다시 쓴다
//   node tools/build-me2-photo-talk.mjs --talk <talk 폴더> --check  사본이 지금 원본에서 만든 것과 같은지만 본다
// 정본: 지시문 experiences/drama/qa/제2의나-20261102/사진시험/지시문/*.md · 판 편집 판편집조립.mjs · 알림 줄 본판조립.mjs · 옷장 · 장면 룩목록.mjs,
//       동의 글 experiences/synk-world-app/me2-photo-consent.json(화면이 그대로 보이고, 서버는 판과 문서 해시로 대조한다).
// 사본은 손으로 고치지 않는다. 사진 · 학생 정보는 들지 않는다(지시문 글뿐).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 알림줄 } from '../experiences/drama/qa/제2의나-20261102/사진시험/본판조립.mjs';
import { 판편집 } from '../experiences/drama/qa/제2의나-20261102/사진시험/판편집조립.mjs';
import { 룩들, 장면들, 옷참고글 } from '../experiences/drama/qa/제2의나-20261102/사진시험/룩목록.mjs';

const 뿌리 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 시험 = path.join(뿌리, 'experiences', 'drama', 'qa', '제2의나-20261102', '사진시험');
const 읽기 = (이름) => readFileSync(path.join(시험, '지시문', `${이름}.md`), 'utf8').replace(/\r\n/g, '\n').trim();
const sha = (글) => createHash('sha256').update(글).digest('hex');

// 동의 글의 문서 해시 — JSON 파일을 키 정렬 없이 그대로 파싱해 다시 적은 글의 sha256. 화면과 서버가 같은 값을 쓴다.
export function 동의판() {
  const 원 = JSON.parse(readFileSync(path.join(뿌리, 'experiences', 'synk-world-app', 'me2-photo-consent.json'), 'utf8'));
  return { version: 원.version, docHash: sha(JSON.stringify(원)) };
}

export function 사본글() {
  const PARTS = {
    head: 읽기('_기준_머리'), moment: 읽기('_기준_순간'), finish: 읽기('_기준_빛결'), rules: 읽기('_규칙'), young: 읽기('_젊게'), older: 읽기('_나이_더'),
    strong: 읽기('_보정_강'), natural: 읽기('_보정_약'),
  };
  const ALERTS = { glasses: 알림줄.안경, head_cover: 알림줄.머리가림, facial_hair: 알림줄.수염,
    wheelchair: 'THE STUDENT USES A WHEELCHAIR: they sit in their own wheelchair at the table, at the same height and distance as before; only the top of the wheelchair may show.' };
  const SCENE_TEMPLATE = 판편집('Clothes: @@CLOTHES@@.', '@@GESTURE@@');
  const LOOK_HEAD = `PHOTO EDIT of Image 1, vertical 3:4 — the same real smartphone photo, re-taken with ONE change: @@CHANGE@@.
KEEP EXACTLY: the same person — face shape and width, eyes and eyelids, brows, nose, lips, ears, skin tone and the same youthful, wrinkle-free, firm skin with a fine natural texture; the same smile, head angle, pose, camera distance and framing; the same empty university cafeteria, window light and colours. Everything that is not the change stays as in Image 1.`;
  const LOOK_TAIL = 'Realistic and natural, as if the student really looks like this today — not a costume, not a fashion shoot, no airbrushing. No text, letters, logos or brand marks on anything. Hands have five fingers.';
  // garment: 옷 가게 상점 사진을 Image 2로 넣을 때의 옷 글(없으면 null — 글만으로 굽는다). LOOK_GARMENT의 @@GARMENT@@ 자리에 들어간다.
  const LOOK_GARMENT = 옷참고글;
  const LOOKS = 룩들.map((x) => ({ id: x.id, group: x.묶음, gate: x.문턱, label: x.이름, exclude: x.뺌, change: x.바꿈, garment: x.옷 ?? null, keep: x.지킴 }));
  const SCENES = 장면들.map((x) => ({ id: x.id, label: x.이름, gesture: x.몸짓, plates: x.판 }));
  const 몸 = { PARTS, ALERTS, SCENE_TEMPLATE, LOOK_HEAD, LOOK_TAIL, LOOK_GARMENT, LOOKS, SCENES };
  const 판 = sha(JSON.stringify(몸)).slice(0, 16);
  const 동의 = 동의판();
  const 얼림 = (이름, 값) => `const ${이름} = Object.freeze(${JSON.stringify(값)});\n`;
  return `'use strict';
// 생성물 — SYNK-appsscript tools/build-me2-photo-talk.mjs가 사진시험 지시문 · 판 편집 · 옷장 목록 · 동의 글에서 만든다. 손으로 고치지 않는다.
const PROMPTS_HASH = ${JSON.stringify(판)};
${얼림('CONSENT', { version: 동의.version, docHash: 동의.docHash })}${얼림('PARTS', PARTS)}${얼림('ALERTS', ALERTS)}const SCENE_TEMPLATE = ${JSON.stringify(SCENE_TEMPLATE)};
const LOOK_HEAD = ${JSON.stringify(LOOK_HEAD)};
const LOOK_TAIL = ${JSON.stringify(LOOK_TAIL)};
const LOOK_GARMENT = ${JSON.stringify(LOOK_GARMENT)};
${얼림('LOOKS', LOOKS)}${얼림('SCENES', SCENES)}module.exports = { PROMPTS_HASH, CONSENT, PARTS, ALERTS, SCENE_TEMPLATE, LOOK_HEAD, LOOK_TAIL, LOOK_GARMENT, LOOKS, SCENES };
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('--talk');
  if (i < 0 || !process.argv[i + 1]) { console.error('사용: node tools/build-me2-photo-talk.mjs --talk <talk 폴더> [--check]'); process.exit(2); }
  const 파일 = path.join(path.resolve(process.argv[i + 1]), 'lib', 'me2-photo-prompts.js');
  const 글 = 사본글();
  if (process.argv.includes('--check')) {
    let 있던 = '';
    try { 있던 = readFileSync(파일, 'utf8'); } catch { /* 아래에서 다름으로 나온다 */ }
    if (있던 !== 글) { console.error('[me2] talk 사본이 지금 원본과 다르다 — --check 없이 다시 만든다'); process.exit(1); }
    console.log('[me2] talk 사본이 지금 원본과 같다');
  } else {
    writeFileSync(파일, 글);
    console.log(`[me2] ${파일} (${글.length}자)`);
  }
}
