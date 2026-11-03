#!/usr/bin/env node
/**
 * 환승 러시 시안(2026-11-04) — 실사 판 굽기. 설계 8절의 두 그림 길(A 실사 깊이 판 · B 사진 결 3D 역)을 견줄 재료.
 *
 * 굽기는 싱크타운 카페 0단계의 `굽기.cjs`(GPT 이미지 2.5 · Codex 구독 · `tools/codex계정.js` 계정 돌려쓰기)를 그대로 부른다 — 현금 0.
 * 지시문은 `지시문/_공통.md` + 장면 글. 그림 원본 · 조립한 지시문 · 기록은 git 밖 공용 작업본 `.tmp/subway-rush-20261104/`.
 *
 *   node experiences/subway-rush/qa/시안-20261104/굽기순서.mjs [train fork platform textures …]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
export const 밖 = path.join(공용작업본(뿌리), '.tmp', 'subway-rush-20261104');
const 굽기 = path.join(뿌리, 'experiences', 'synk-town', 'qa', '카페0단계시험-20261031', '굽기.cjs');
const 장면들 = ['train', 'fork', 'platform', 'textures', 'train-open'];
// 결 판은 사람 · 글자 규칙만 빼고 공통 머리를 쓰지 않는다(평면 견본이라 장면 묘사가 섞이면 안 된다).
const 공통없음 = new Set(['textures']);
// 편집 판: Image 1 = 앞서 구운 판의 가장 새 것(같은 카메라 · 같은 칸에서 한 가지만 바꾼다).
const 참고판 = { 'train-open': 'train' };
const 가장새판 = (이름) => fs.readdirSync(path.join(밖, '판')).filter((f) => new RegExp(`^${이름}_\\d{6}\\.png$`).test(f)).sort().at(-1);

const 대상 = process.argv.slice(2).length ? process.argv.slice(2) : 장면들;
for (const d of ['지시문', '판']) fs.mkdirSync(path.join(밖, d), { recursive: true });
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f + '.md'), 'utf8').trim();

let 실패 = 0;
for (const 이름 of 대상) {
  if (!장면들.includes(이름)) { console.error('모르는 장면: ' + 이름); process.exit(2); }
  const 글 = (공통없음.has(이름) ? [읽기(이름)] : [읽기(이름), 읽기('_공통')]).join('\n\n') + '\n';
  const 지시문 = path.join(밖, '지시문', 이름 + '.txt');
  fs.writeFileSync(지시문, 글);
  const 참고 = [];
  if (참고판[이름]) {
    const f = 가장새판(참고판[이름]);
    if (!f) { console.error(`[굽기] ${이름}: 참고 판 ${참고판[이름]}이 아직 없다`); 실패++; continue; }
    참고.push(path.join(밖, '판', f));
  }
  console.log(`[굽기] ${이름} …${참고.length ? ' (참고 ' + path.basename(참고[0]) + ')' : ''}`);
  const r = spawnSync(process.execPath, [굽기, 지시문, 이름, ...참고], { cwd: 뿌리, stdio: 'inherit', env: { ...process.env, TOWN_CAFE_OUT: 밖 } });
  if (r.status !== 0) { 실패++; console.error(`[굽기] ${이름} 실패(${r.status})`); }
}
process.exit(실패 ? 1 : 0);
