#!/usr/bin/env node
/**
 * 가게 정지 화면 3장 굽기 지시문 조립 (2026-11-01) — 지시문/<이름>.md 앞뒤에 공통 줄을 붙여
 * 공용 작업본 `.tmp/town-cafe-1-20261101/지시문/<이름>.<엔진>.txt`로 쓴다.
 *   엔진 gpt — GPT 이미지 2.5(Codex 구독, 0단계 `굽기.cjs`) · 앞에 「그림 도구로 한 장만」 머리말
 *   엔진 nb  — 나노바나나 2.1(Gemini Ultra 웹, `nb/` 실행기) · 머리말 없음, 4,300자 안(현장노트 gemini_사진)
 * 원고는 .md다 — 저장소 .gitignore가 qa 아래 .txt를 뺀다(0단계와 같음).
 *
 *   node experiences/synk-town/qa/카페정지화면-20261101/지시문조립.mjs [이름…]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
export const 밖뿌리 = process.env.TOWN_CAFE_OUT || path.join(공용작업본(뿌리), '.tmp', 'town-cafe-1-20261101');
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f), 'utf8').trim();

// 이름 → 붙일 줄(순서대로). 「본문」 자리에 <이름>.md, 「머리」는 gpt 엔진에만 붙는다.
export const 짜임 = {
  // 카운터는 가게가 흐린 배경이라 가게 줄 대신 참고 그림(구도 · 홀)으로 잡고, 학생 손 줄은 본문에 넣어 4,300자 안으로 맞춘다
  'counter-talk': ['머리', '본문', '_공통_교수', '_공통_빛결_카운터', '_공통_계절규칙'],
  'counter-thanks': ['머리', '본문', '_공통_계절규칙'],
  'counter-ask': ['머리', '본문', '_공통_계절규칙'],
  'hall-open': ['머리', '본문', '_공통_가게', '_공통_계절규칙'],
  'hall-rain': ['머리', '본문', '_공통_가게', '_공통_계절규칙'],
  'hall-rain-plant': ['머리', '본문', '_공통_계절규칙'],
};

const 고를것 = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(짜임);
fs.mkdirSync(path.join(밖뿌리, '지시문'), { recursive: true });
for (const 이름 of 고를것) {
  const 줄 = 짜임[이름];
  if (!줄) throw new Error('짜임에 없는 이름: ' + 이름);
  for (const 엔진 of ['gpt', 'nb']) {
    const 글 = 줄
      .filter((k) => !(k === '머리' && 엔진 === 'nb'))
      .map((k) => 읽기(k === '본문' ? `${이름}.md` : k === '머리' ? '_공통_머리.md' : `${k}.md`))
      .join('\n\n') + '\n';
    if (엔진 === 'nb' && 글.length > 4300) console.warn(`[조립] ${이름}.nb ${글.length}자 — 4,300자를 넘는다(입력창이 자를 수 있음)`);
    const 낼 = path.join(밖뿌리, '지시문', `${이름}.${엔진}.txt`);
    fs.writeFileSync(낼, 글);
    console.log(`[조립] ${이름}.${엔진} → ${낼} (${글.length}자)`);
  }
}
