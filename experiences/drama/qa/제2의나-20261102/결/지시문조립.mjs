#!/usr/bin/env node
/**
 * 「제2의 나」 인물 참고 사진 결 시안 (2026-11-02) — 지시문 조립.
 *
 * 승인 실사 인물(권태오 · 문지영 교수)을 얼굴 · 머리 · 옷은 그대로 두고 「휴대폰 사진 결」로 다시 굽는다.
 * 인물마다 세 각도(정면 · 3/4 · 웃음) × 두 엔진, 그리고 고른 태오 판으로 T-C 「몽골 남 × 1화 식당 셀카」를 다시 굽는 적용 시험.
 * 원고는 `지시문/*.md`(qa 아래 .txt는 git이 뺀다). 조각 줄은 T-C의 `조각_mn-m.md`를 그대로 읽는다.
 *
 * 엔진 A(GPT 이미지 2.5 · Codex 구독) = 맨 앞에 「그림 도구로 한 장만」 머리말을 붙여 `<id>.gpt.txt`,
 * 엔진 B(나노바나나 2.1 · Gemini Ultra 웹) = 머리말 없이 `<id>.nb.txt`(4,300자 안) + 실행기 일감 `jobs.json`.
 *
 *   node experiences/drama/qa/제2의나-20261102/결/지시문조립.mjs
 *
 * 나오는 곳(공용 작업본, git 밖): `.tmp/me2-20261102/결/지시문/`, 나노바나나 실행기 폴더 `.tmp/me2-20261102/gyeol-nb/jobs.json`
 * (실행기는 카페 정지 화면 nb 실행기를 옮긴 것 — ego nodejs의 import가 한글 경로를 안 거치도록 영문 폴더에 둔다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102');
export const 밖 = process.env.ME2_GYEOL_OUT || path.join(작업, '결');
export const nb폴더 = process.env.ME2_GYEOL_NB || path.join(작업, 'gyeol-nb');
const 읽기 = (f) => fs.readFileSync(f.startsWith('T-C:') ? path.join(여기, '..', 'T-C', '지시문', `${f.slice(4)}.md`) : path.join(여기, '지시문', `${f}.md`), 'utf8').trim();

// 참고 그림: GPT는 `결/참고/<이름>.png`(원본 크기), 나노바나나는 `gyeol-nb/refs/<이름>.jpg`(긴 변 1,400 — 현장노트 gemini)
// taeo-pick-<엔진>은 엔진마다 고른 태오 참고 한 장(세 각도 가운데) — 셀카 굽기 전에 복사해 둔다.
const 인물참고 = { 태오: ['taeo-cafeteria', 'taeo-campus'], 교수: ['prof-office', 'prof-cafe'] };
export const 일감 = [];
for (const [누구, id] of [['태오', 'taeo'], ['교수', 'prof']]) {
  for (const [각도, 이름] of [['정면', 'front'], ['34', '34'], ['웃음', 'laugh']]) {
    일감.push({ id: `${id}-${이름}`, 줄: [`${누구}_신원`, `${누구}_${각도}`, `${누구}_결`, '_계절', '_규칙'], 참고: 인물참고[누구] });
  }
}
// 셀카는 T-C 셀카 원고에 Fable 지적(태오 귀걸이 없음 · 태오가 하는 일 하나 · 초점 있는 소매 쐐기)을 반영했다.
// 나노바나나는 4,300자 한도라 같은 내용을 줄인 `셀카_nb` 하나로 쓴다.
일감.push({ id: 'selfie-gpt', 엔진: 'gpt', 줄: ['셀카', 'T-C:조각_mn-m', '셀카_태오', '셀카_결', '_계절', '_규칙'], 참고: ['mn-m-id', 'taeo-pick-gpt'] });
일감.push({ id: 'selfie-nb', 엔진: 'nb', 줄: ['셀카_nb', 'T-C:조각_mn-m', '_계절', '_규칙'], 참고: ['mn-m-id', 'taeo-pick-nb'] });

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(path.join(밖, '지시문'), { recursive: true });
  const jobs = [];
  for (const j of 일감) {
    const 몸 = j.줄.map(읽기).join('\n\n') + '\n';
    if (j.엔진 !== 'nb') {
      const 글 = 읽기('_머리_gpt') + '\n\n' + 몸;
      fs.writeFileSync(path.join(밖, '지시문', `${j.id}.gpt.txt`), 글);
      console.log(`[조립] ${j.id}.gpt.txt ${글.length}자 · 참고 ${j.참고.map((r) => r + '.png').join(' ')}`);
    }
    if (j.엔진 !== 'gpt') {
      if (몸.length > 4300) throw new Error(`${j.id} 나노바나나 지시문이 4,300자를 넘는다(${몸.length})`);
      fs.writeFileSync(path.join(밖, '지시문', `${j.id}.nb.txt`), 몸);
      jobs.push({ id: j.id, ratio: '3:4', refs: j.참고.map((r) => path.join(nb폴더, 'refs', `${r}.jpg`).replace(/\\/g, '/')), prompt: 몸.trim(), out: path.join(nb폴더, 'out', `${j.id}-nb_g{n}.png`).replace(/\\/g, '/') });
      console.log(`[조립] ${j.id}.nb.txt ${몸.length}자`);
    }
  }
  fs.writeFileSync(path.join(nb폴더, 'jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
  console.log(`[조립] 나노바나나 일감 ${jobs.length}건 → ${path.join(nb폴더, 'jobs.json')}`);
}
