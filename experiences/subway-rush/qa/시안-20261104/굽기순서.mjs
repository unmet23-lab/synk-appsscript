#!/usr/bin/env node
/**
 * 환승 러시 실사 판 굽기(2026-11-04, 설계 8절). 시안 1판의 네 장에 더해 MVP 판 전부 — 칸 · 문 열림 · 사람 · 장면.
 *
 * 굽기는 싱크타운 카페 0단계의 `굽기.cjs`(GPT 이미지 2.5 · Codex 구독 · `tools/codex계정.js` 계정 돌려쓰기)를 그대로 부른다 — 현금 0.
 * 지시문은 `지시문/<이름>.md`(사람 · 편집 판은 그 글만, 장면 판은 `_공통` 또는 글 끝 규칙). 그림 원본 · 조립한 지시문 · 기록은 git 밖 공용 작업본 `.tmp/subway-rush-20261104/`.
 * 이미 구운 판은 건너뛴다(같은 이름의 판이 있으면) — 한도로 멈춘 뒤 다시 돌리면 이어서 굽는다. 한도에 걸리면 멈춘다(유료 경로로 돌리지 않음).
 *
 *   node experiences/subway-rush/qa/시안-20261104/굽기순서.mjs            차례대로 모두
 *   node experiences/subway-rush/qa/시안-20261104/굽기순서.mjs gate car-rush …   그 판만(있어도 다시 굽는다)
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

// 차례 = 2판 시안에 먼저 필요한 것부터.
const 차례 = [
  'train', 'fork', 'platform', 'textures', 'train-open', 'gate', 'person-fan', 'person-fan-react',
  'train-open-left', 'car-rush', 'car-rush-open-right', 'car-rush-open-left',
  'person-worker', 'person-worker-react', 'person-traveler', 'person-traveler-react',
  'exit-fork', 'gate-out', 'stairs-sun', 'bus-stop', 'detour',
  'person-grandma', 'person-grandma-react', 'play-card',
  'car-concert', 'car-concert-open-right', 'car-concert-open-left',
  'car-hike', 'car-hike-open-right', 'car-hike-open-left',
  'person-hiker', 'person-hiker-react', 'person-freshman', 'person-freshman-react', 'platform-1',
];
// 공통 머리를 붙이는 판(시안 1판의 장면들). 나머지는 지시문 글에 규칙이 들어 있다.
const 공통붙임 = new Set(['train', 'fork', 'platform', 'train-open', 'gate']);
// 편집 판: Image 1 = 앞서 구운 판의 가장 새 것(같은 카메라 · 같은 칸에서 한 가지만 바꾼다).
const 참고판 = {
  'train-open': 'train', 'train-open-left': 'train',
  'car-rush': 'train', 'car-concert': 'train', 'car-hike': 'train',
  'car-rush-open-right': 'car-rush', 'car-rush-open-left': 'car-rush',
  'car-concert-open-right': 'car-concert', 'car-concert-open-left': 'car-concert',
  'car-hike-open-right': 'car-hike', 'car-hike-open-left': 'car-hike',
  'person-fan-react': 'person-fan', 'person-worker-react': 'person-worker', 'person-traveler-react': 'person-traveler',
  'person-grandma-react': 'person-grandma', 'person-hiker-react': 'person-hiker', 'person-freshman-react': 'person-freshman',
};
const 판폴더 = path.join(밖, '판');
const 가장새판 = (이름) => fs.readdirSync(판폴더).filter((f) => new RegExp(`^${이름}_\\d{6}(_\\d)?\\.png$`).test(f)).sort().at(-1);

const 고른 = process.argv.slice(2);
const 대상 = 고른.length ? 고른 : 차례.filter((n) => !가장새판(n));
for (const d of ['지시문', '판']) fs.mkdirSync(path.join(밖, d), { recursive: true });
const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f + '.md'), 'utf8').trim();

let 실패 = 0, 구움 = 0;
for (const 이름 of 대상) {
  if (!차례.includes(이름)) { console.error('모르는 판: ' + 이름); process.exit(2); }
  const 글 = (공통붙임.has(이름) ? [읽기(이름), 읽기('_공통')] : [읽기(이름)]).join('\n\n') + '\n';
  const 지시문 = path.join(밖, '지시문', 이름 + '.txt');
  fs.writeFileSync(지시문, 글);
  const 참고 = [];
  if (참고판[이름]) {
    const f = 가장새판(참고판[이름]);
    if (!f) { console.error(`[굽기] ${이름}: 참고 판 ${참고판[이름]}이 아직 없다`); 실패++; continue; }
    참고.push(path.join(판폴더, f));
  }
  console.log(`[굽기] ${이름} …${참고.length ? ' (참고 ' + path.basename(참고[0]) + ')' : ''}`);
  const r = spawnSync(process.execPath, [굽기, 지시문, 이름, ...참고], { cwd: 뿌리, stdio: 'inherit', env: { ...process.env, TOWN_CAFE_OUT: 밖 } });
  if (r.status !== 0) { 실패++; console.error(`[굽기] ${이름} 실패(${r.status}) — 한도일 수 있어 여기서 멈춘다. 다시 돌리면 이어서 굽는다.`); break; }
  구움++;
}
console.log(`[굽기] 구움 ${구움} · 실패 ${실패} · 남음 ${차례.filter((n) => !가장새판(n)).length}`);
process.exit(실패 ? 1 : 0);
