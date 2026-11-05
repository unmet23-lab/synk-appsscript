#!/usr/bin/env node
/**
 * 입장 검사 캠퍼스 판(WORLD 안 겉, 2026-11-04) — 입장 부스 창밖 실사 판 굽기 순서.
 *
 * 주문 폭주 캠퍼스 판(`experiences/order-rush/qa/world-campus-20261103/굽기순서.mjs`)과 같은 길이다:
 * 빈 창(booth)을 먼저 굽고, 손님 열둘의 「말함」 바탕을 그 판을 Image 1로 구워 창 · 뒤 풍경 · 빛이 모든 손님에게 같게 한다.
 * 표정 여섯(기다림 · 긴장 · 통과 · 몰래 · 머쓱 · 갸웃)은 바탕을 Image 1로 편집해 굽고, 통째로 쓰지 않고 싱크타운 카페의 `얼굴합성.py`로
 * 얼굴 안쪽만 바탕에 붙인다(바뀌는 것은 얼굴뿐이라 손님이 표정을 바꿔도 창이 떨리지 않는다).
 * 손님 열둘의 나이 · 성별은 원고(content.mjs)의 손님과 같다 — 미리 구운 손님 목소리를 그대로 쓰기 때문이다.
 * 굽기는 카페 0단계 `굽기.cjs`(GPT 이미지 2.5 · Codex 구독 · `tools/codex계정.js`) — 현금 0.
 * 그림 원본 · 지시문 .txt · 기록은 git 밖 공용 작업본 `.tmp/entry-check-world-20261104/`.
 *
 *   node experiences/entry-check/qa/world-campus-20261104/굽기순서.mjs [창|바탕|표정|합성|모두] [bear …]
 *   MOODS=pass,sorry 처럼 주면 그 표정만 굽는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
const 공용 = 공용작업본(뿌리);
export const 밖 = path.join(공용, '.tmp', 'entry-check-world-20261104');
const 굽기 = path.join(뿌리, 'experiences', 'synk-town', 'qa', '카페0단계시험-20261031', '굽기.cjs');
const 합성 = path.join(뿌리, 'experiences', 'synk-town', 'qa', '카페정지화면-20261101', '얼굴합성.py');
export const 손님 = ['bear', 'raccoon', 'rabbit', 'fox', 'squirrel', 'hedgehog', 'penguin', 'ducks', 'otter', 'deer', 'panda', 'sheep'];
const 모든표정 = { idle: '_표정_기다림', nervous: '_표정_긴장', pass: '_표정_통과', sly: '_표정_몰래', sorry: '_표정_머쓱', puzzled: '_표정_갸웃' };
const 표정 = process.env.MOODS ? Object.fromEntries(process.env.MOODS.split(',').map((k) => [k, 모든표정[k]]).filter(([, f]) => f)) : 모든표정;

const [단계 = '모두', ...골라] = process.argv.slice(2);
const 대상 = 골라.length ? 골라 : 손님;
for (const d of ['지시문', '판', '묶음']) fs.mkdirSync(path.join(밖, d), { recursive: true });

const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f + '.md'), 'utf8').trim();
function 조립(이름, 줄) {
  const 낼 = path.join(밖, '지시문', 이름 + '.txt');
  fs.writeFileSync(낼, 줄.map(읽기).join('\n\n') + '\n');
  return 낼;
}
function 부르기(지시문, 이름, 참고들) {
  const 전 = new Set(fs.readdirSync(path.join(밖, '판')));
  const r = spawnSync(process.execPath, [굽기, 지시문, 이름, ...참고들], { cwd: 뿌리, stdio: 'inherit', env: { ...process.env, TOWN_CAFE_OUT: 밖 } });
  if (r.status !== 0) throw new Error(`${이름} 굽기 실패(종료 ${r.status})`);
  const 새 = fs.readdirSync(path.join(밖, '판')).filter((f) => !전.has(f) && f.startsWith(이름 + '_') && /\.(png|jpe?g|webp)$/i.test(f));
  if (!새.length) throw new Error(`${이름} 판을 못 찾았다`);
  return path.join(밖, '판', 새.sort().at(-1));
}
/** 가장 새 판(파일 시각 — 판 이름의 시각은 시분초뿐이라 자정을 넘기면 이름순이 거꾸로다). `판/고른.json`이 있으면 그 이름이 이긴다. */
export function 판(이름) {
  const 고른경로 = path.join(밖, '판', '고른.json');
  const 고른 = fs.existsSync(고른경로) ? JSON.parse(fs.readFileSync(고른경로, 'utf8')) : {};
  if (고른[이름]) return path.join(밖, '판', 고른[이름]);
  const 후보 = fs.readdirSync(path.join(밖, '판')).filter((f) => new RegExp(`^${이름}_\\d{6}(_\\d+)?\\.(png|jpe?g|webp)$`, 'i').test(f))
    .map((f) => [f, fs.statSync(path.join(밖, '판', f)).mtimeMs]).sort((a, b) => a[1] - b[1]).map(([f]) => f);
  return 후보.length ? path.join(밖, '판', 후보.at(-1)) : null;
}

const 실패 = [];
const 한번 = (이름, f) => { try { f(); } catch (e) { 실패.push(e.message); console.error('[순서]', e.message); } };
// 짐(손님이 창턱에 올려 둔 물건 열넷): 주문 폭주 재료처럼 한 가지씩 같은 빛 · 같은 각도로. 수영 모자를 먼저 굽고 나머지는 그 판을 Image 1로 맞춘다.
export const 짐 = ['swim-cap', 'towel', 'water-bottle', 'gimbap', 'snack', 'swim-ring', 'book', 'coffee-lid', 'coffee-open', 'phone', 'purse', 'camera', 'picnic-mat', 'chair'];
if (단계 === '짐') {
  let 기준 = 판('item-swim-cap');
  for (const k of (골라.length ? 골라 : 짐)) {
    if (판(`item-${k}`) && !process.env.DO_AGAIN) continue;
    const 참고들 = k !== 'swim-cap' && 기준 ? [기준] : [];
    한번(k, () => { const 낸 = 부르기(조립(`item-${k}`, ['_공통_머리', '_짐_공통', `짐_${k}`, ...(참고들.length ? ['_짐_참고'] : [])]), `item-${k}`, 참고들); if (k === 'swim-cap') 기준 = 낸; });
  }
}
// 고무도장 머리(찍는 순간 표 위로 내려왔다 올라가는 사진 한 장, 흰 바탕에서 구워 웹판.py가 오린다)
if (단계 === '도장') 한번('stamp-head', () => 부르기(조립('stamp-head', ['_공통_머리', 'stamp-head']), 'stamp-head', []));
// 2판 바탕(11-04): 호두나무 책상 · 쇠 쟁반 · 근무지 입구
if (단계 === '바닥') for (const k of 골라) 한번(k, () => 부르기(조립(k, ['_공통_머리', k]), k, []));
if (['창', '모두'].includes(단계) && !(단계 === '모두' && 판('booth'))) {
  한번('booth', () => 부르기(조립('booth', ['_공통_머리', 'booth', '_공통_자리', '_공통_실사결', '_공통_계절규칙']), 'booth', []));
}
if (['바탕', '모두'].includes(단계)) {
  const 창 = 판('booth');
  if (!창) 실패.push('빈 창(booth) 판이 없어 바탕을 건너뜀');
  else for (const g of 대상) {
    if (단계 === '모두' && 판(`${g}-talk`)) continue;
    한번(g, () => 부르기(조립(`${g}-talk`, ['_공통_머리', g, '_공통_자리', '_참고_자리', '_공통_실사결', '_공통_계절규칙']), `${g}-talk`, [창]));
  }
}
if (['표정', '모두'].includes(단계)) {
  for (const g of 대상) for (const [k, f] of Object.entries(표정)) {
    const 바탕 = 판(`${g}-talk`);
    if (!바탕) { 실패.push(`${g} 바탕이 없어 ${k}를 건너뜀`); continue; }
    if (단계 === '모두' && 판(`${g}-${k}`)) continue;
    한번(`${g}-${k}`, () => 부르기(조립(`${g}-${k}`, ['_공통_머리', f, '_공통_계절규칙']), `${g}-${k}`, [바탕]));
  }
}
if (['합성', '모두'].includes(단계)) {
  for (const g of 대상) for (const k of Object.keys(표정)) {
    const 바탕 = 판(`${g}-talk`), 편집 = 판(`${g}-${k}`);
    if (!바탕 || !편집) continue;
    // 아이와 함께 온 손님(ducks)은 얼굴이 둘이라 자동 얼굴 잡기가 엄마 얼굴(가장 큰 얼굴)만 붙인다 — 아이 표정은 바탕 그대로다
    const r = spawnSync('python', ['-I', '-X', 'utf8', 합성, 바탕, 편집, path.join(밖, '묶음', `${g}-${k}.png`), '--얼굴', '자동', '--페더', '12'], { stdio: 'inherit' });
    if (r.status !== 0) 실패.push(`${g}-${k} 얼굴 합성 실패`);
  }
}
if (실패.length) { console.error('[순서] 남은 것:\n- ' + 실패.join('\n- ')); process.exitCode = 1; }
else console.log('[순서] 끝 —', 밖);
