#!/usr/bin/env node
/**
 * T2 굽기 지시문 조립 — 지시문/<이름>.md 앞뒤에 공통 줄(머리 · 실사결 · 인물 · 학생 · 가게 · 계절과 규칙)을 붙여
 * 공용 작업본 `.tmp/town-cafe-0-20261031/지시문/<이름>.txt`로 쓴다. 굽기는 그 파일을 `굽기.cjs`에 넘긴다.
 * 원고는 .md다 — 저장소 .gitignore가 qa 아래 .txt를 빼서(`**\/qa/*\/**\/*.txt`), .txt로 두면 정본이 git에 남지 않는다.
 *
 *   node experiences/synk-town/qa/카페0단계시험-20261031/지시문조립.mjs [이름…]   (이름이 없으면 모두)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 밖뿌리 } from './글판.mjs';

const 여기 = path.join(path.dirname(fileURLToPath(import.meta.url)), '지시문');
const 읽기 = (f) => fs.readFileSync(path.join(여기, f), 'utf8').trim();

// 이름 → 붙일 공통 줄(순서대로). 「본문」 자리에 <이름>.md가 들어간다.
export const 짜임 = {
  'hall-real': ['_공통_머리', '본문', '_공통_가게', '_공통_계절규칙'],
  'counter-taeo-1': ['_공통_머리', '본문', '_공통_실사결', '_공통_태오', '_공통_학생', '_공통_가게', '_공통_계절규칙'],
  'counter-taeo-2': ['_공통_머리', '본문', '_공통_계절규칙'],
  'counter-prof-1': ['_공통_머리', '본문', '_공통_실사결', '_공통_교수', '_공통_학생', '_공통_가게', '_공통_계절규칙'],
  'counter-prof-2': ['_공통_머리', '본문', '_공통_계절규칙'],
  'hall-diorama-a': ['_공통_머리', '본문', '_공통_가게', '_공통_계절규칙'],
  'hall-diorama-b': ['_공통_머리', '본문', '_공통_계절규칙'],
  'hall-real-b': ['_공통_머리', '본문', '_공통_계절규칙'],
};

const 고를것 = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(짜임);
fs.mkdirSync(path.join(밖뿌리, '지시문'), { recursive: true });
for (const 이름 of 고를것) {
  const 줄 = 짜임[이름];
  if (!줄) throw new Error('짜임에 없는 이름: ' + 이름);
  if (!fs.existsSync(path.join(여기, `${이름}.md`))) { console.warn(`[조립] ${이름}.md 없음 — 건너뜀`); continue; }
  const 글 = 줄.map((k) => 읽기(k === '본문' ? `${이름}.md` : `${k}.md`)).join('\n\n') + '\n';
  const 낼 = path.join(밖뿌리, '지시문', `${이름}.txt`);
  fs.writeFileSync(낼, 글);
  console.log(`[조립] ${이름} → ${낼} (${Buffer.byteLength(글)}바이트)`);
}
