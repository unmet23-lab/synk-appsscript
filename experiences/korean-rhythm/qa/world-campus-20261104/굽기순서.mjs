#!/usr/bin/env node
/**
 * 말의 리듬 캠퍼스 판(WORLD 안 겉, 2026-11-04) — 축제 무대 연습실 실사 판 굽기 순서.
 *
 * 그림 다섯: 입구(연습실 · 마이크가 주인공 — 노을 판 · 블루아워 판), 놀이 무대 바닥(세로 9:16 · 가로 16:9 — 소실점이 가운데 위 22%),
 * 결과(축제 본무대 끝난 순간), 「놀이」 카드(흰 바탕 마이크 한 개). 사람 · 마스코트 · 글자는 어느 판에도 없다.
 * 굽기는 주문 폭주 캠퍼스 판과 같은 길 — 카페 0단계의 `굽기.cjs`(GPT 이미지 2.5 · Codex 구독 · `tools/codex계정.js`) — 현금 0.
 * 그림 원본 · 지시문 .txt · 기록은 git 밖 공용 작업본 `.tmp/rhythm-world-20261104/`, 게임에 쓰는 WebP는 `웹판.py`가 만든다.
 *
 *   node experiences/korean-rhythm/qa/world-campus-20261104/굽기순서.mjs [이름 …]   (빼면 다섯 모두, 동시에 셋까지)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
export const 밖 = path.join(공용작업본(뿌리), '.tmp', 'rhythm-world-20261104');
const 굽기 = path.join(뿌리, 'experiences', 'synk-town', 'qa', '카페0단계시험-20261031', '굽기.cjs');
export const 그림 = { 입구_노을: ['_머리', '입구_노을', '_실사결'], 입구_블루: ['_머리', '입구_블루', '_실사결'], 무대_세로: ['_머리', '무대_세로', '_실사결'],
  무대_가로: ['_머리', '무대_가로', '_실사결'], 결과: ['_머리', '결과', '_실사결'], 카드: ['_머리', '카드'] };

const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f + '.md'), 'utf8').trim();
function 조립(이름) {
  fs.mkdirSync(path.join(밖, '지시문'), { recursive: true });
  const 낼 = path.join(밖, '지시문', 이름 + '.txt');
  fs.writeFileSync(낼, 그림[이름].map(읽기).join('\n\n') + '\n');
  return 낼;
}
function 부르기(이름) {
  return new Promise((ok) => {
    const 자식 = spawn(process.execPath, [굽기, 조립(이름), 이름], { cwd: 뿌리, stdio: 'inherit', env: { ...process.env, TOWN_CAFE_OUT: 밖 } });
    자식.on('close', (code) => ok({ 이름, code }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 대상 = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(그림);
  for (const n of 대상) if (!그림[n]) { console.error('모르는 그림: ' + n); process.exit(2); }
  const 결과 = [], 줄 = [...대상];
  await Promise.all([0, 1, 2].map(async () => { while (줄.length) 결과.push(await 부르기(줄.shift())); }));
  console.log(JSON.stringify(결과));
  if (결과.some((r) => r.code)) process.exit(1);
}
