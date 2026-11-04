#!/usr/bin/env node
/**
 * MT 바닷가 레이스(WORLD 판, 2026-11-04) — 입구 · 결과 사진과 놀이 카드 지시문을 조립해 나노바나나 2.1 실행기의 작업 목록(jobs.json)을 쓴다.
 * 말 랠리 캠퍼스 판 굽기순서와 같은 길: 승인 사진(F1 · 쇼케이스 C1 · 웃는 기준)을 참고로, 동기는 얼굴을 보이지 않는다(2화 인물이 정해지기 전이라 새 얼굴을 굽지 않는다).
 * 실행기 · 원본은 git 밖 공용 작업본 .tmp/world-mt-20261104/nb/. 게임에 쓰는 WebP는 assets/world/.
 *   node experiences/korean-racing/qa/world-mt-20261104/굽기순서.mjs
 *   python -X utf8 C:/Users/q1212/Documents/synk-vendor/_공용차례/차례.py gemini 기다리기 world-mt "입구 · 결과 사진" --두줄
 *   bash .tmp/world-mt-20261104/nb/차례.sh "mt-lobby:1 mt-lobby:2 mt-win:1 …"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
const NB = path.join(공용작업본(path.resolve(여기, '../../../..')), '.tmp', 'world-mt-20261104', 'nb').replace(/\\/g, '/');
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', `${f}.md`), 'utf8').trim();
const 조립 = (...names) => names.map(읽기).join('\n\n');
const 참고 = ['taeo2-f1.jpg', 'taeo2-c1.jpg', 'taeo2-smile.jpg'].map((f) => `${NB}/refs/${f}`);
const jobs = [
  { id: 'mt-lobby', ratio: '9:16', refs: 참고, prompt: 조립('입구', '_태오', '_공통'), out: `${NB}/out/mt-lobby_g{n}.png` },
  { id: 'mt-win', ratio: '3:4', refs: 참고, prompt: 조립('결과_1등', '_태오', '_공통'), out: `${NB}/out/mt-win_g{n}.png` },
  { id: 'mt-mid', ratio: '3:4', refs: 참고, prompt: 조립('결과_2등', '_태오', '_공통'), out: `${NB}/out/mt-mid_g{n}.png` },
  { id: 'mt-lose', ratio: '3:4', refs: 참고, prompt: 조립('결과_3등', '_태오', '_공통'), out: `${NB}/out/mt-lose_g{n}.png` },
  { id: 'mt-card', ratio: '1:1', refs: [], prompt: 읽기('놀이카드'), out: `${NB}/out/mt-card_g{n}.png` },
];
fs.writeFileSync(`${NB}/jobs.json`, JSON.stringify(jobs, null, 1));
for (const j of jobs) console.log(`${j.id} · ${j.ratio} · 참고 ${j.refs.length} · 지시문 ${j.prompt.length}자`);
if (jobs.some((j) => j.prompt.length > 4300)) { console.error('지시문이 4,300자를 넘는다(현장노트 gemini)'); process.exitCode = 1; }
