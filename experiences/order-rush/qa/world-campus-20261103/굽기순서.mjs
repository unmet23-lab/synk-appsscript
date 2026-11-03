#!/usr/bin/env node
/**
 * 주문 폭주 캠퍼스 판(WORLD 안 겉, 2026-11-03) — 싱크타운 카페 손님 실사 판 굽기 순서.
 *
 * 손님 여섯(g1~g6, 모두 젊은 여성 — 주문 음성이 여성 합성 음성 하나라서)을 「주문(말하는 중)」 바탕으로 굽고,
 * 그 바탕을 Image 1로 「받음(웃음)」 · 「다름(갸웃)」 표정 편집을 굽는다. 표정 판은 통째로 쓰지 않고
 * 싱크타운 카페 정지 화면의 `얼굴합성.py`로 얼굴 안쪽만 바탕에 붙인다(카페정지화면-20261101 README · 현장노트 그림 굽기).
 * 굽기는 카페 0단계의 `굽기.cjs`(GPT 이미지 2.5 · Codex 구독 · `tools/codex계정.js`)를 그대로 부른다 — 현금 0.
 * 그림 원본 · 지시문 .txt · 기록은 git 밖 공용 작업본 `.tmp/order-rush-world-20261103/`, 게임에 쓰는 WebP는 `웹판.py`가 만든다.
 *
 *   node experiences/order-rush/qa/world-campus-20261103/굽기순서.mjs [바탕|표정|합성|모두] [g1 …]
 *   node experiences/order-rush/qa/world-campus-20261103/굽기순서.mjs 재료 [coffee tea …]   (11-03 밤 재료 사진 — 아래)
 *
 * 재료(11-03 밤, 유호님 「메뉴판 커피 · 차 · 우유가 대충 만든 것 같다 · 사진도」): 회색 종이 한 판(3×2)을 잘라 쓰던 것을 버리고, 어두운 호두나무
 * 카운터 위 한 가지씩 따로 굽는다(_재료_공통 + 재료_<이름>). 커피를 먼저 굽고 나머지는 그 판을 Image 1 참고로 빛 · 카운터 · 각도 · 크기를 맞춘다(_재료_참고).
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
export const 밖 = path.join(공용, '.tmp', 'order-rush-world-20261103');
const 굽기 = path.join(뿌리, 'experiences', 'synk-town', 'qa', '카페0단계시험-20261031', '굽기.cjs');
const 합성 = path.join(뿌리, 'experiences', 'synk-town', 'qa', '카페정지화면-20261101', '얼굴합성.py');
export const 손님 = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
const 모든표정 = { thanks: '_표정_받음', puzzled: '_표정_다름' };
// MOODS=puzzled 처럼 주면 그 표정만 다시 굽는다(지시문을 고친 표정만 다시 구울 때)
const 표정 = process.env.MOODS ? Object.fromEntries(process.env.MOODS.split(',').map((k) => [k, 모든표정[k]]).filter(([, f]) => f)) : 모든표정;

const [단계 = '모두', ...골라] = process.argv.slice(2);
const 대상 = 골라.length ? 골라 : 손님;
for (const d of ['지시문', '판', '참고', '묶음']) fs.mkdirSync(path.join(밖, d), { recursive: true });

const 읽기 = (f) => fs.readFileSync(path.join(여기, '지시문', f + '.md'), 'utf8').trim();
function 조립(이름, 줄) {
  const 글 = 줄.map(읽기).join('\n\n') + '\n';
  const 낼 = path.join(밖, '지시문', 이름 + '.txt');
  fs.writeFileSync(낼, 글);
  return 낼;
}
/** 참고 둘: 0단계 카운터 구도(손님 머리만 흐림)에서 학생 손 · 수첩 아래를 잘라 낸 판, 같은 가게 홀 실사 전경. */
function 참고() {
  const 구도 = path.join(밖, '참고', '카운터구도_손없음.jpg'), 홀 = path.join(밖, '참고', '홀.jpg');
  if (fs.existsSync(구도) && fs.existsSync(홀)) return [구도, 홀];
  const 원 = path.join(공용, '.tmp', 'town-cafe-1-20261101', 'nb', 'refs', 'counter_layout.jpg');
  const 홀원 = path.join(공용, '.tmp', 'town-cafe-0-20261031', '웹판', 'hall-real-b.webp');
  const py = `from PIL import Image\nim=Image.open(r'''${원}''').convert('RGB')\nim.crop((0,0,im.width,round(im.height*0.765))).save(r'''${구도}''',quality=92)\nImage.open(r'''${홀원}''').convert('RGB').save(r'''${홀}''',quality=92)\n`;
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', py], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('참고 그림을 만들지 못했다');
  return [구도, 홀];
}
/** 굽기.cjs를 부르고 새로 생긴 판 파일 경로를 돌려준다. */
function 부르기(지시문, 이름, 참고들) {
  const 전 = new Set(fs.readdirSync(path.join(밖, '판')));
  const r = spawnSync(process.execPath, [굽기, 지시문, 이름, ...참고들], { cwd: 뿌리, stdio: 'inherit', env: { ...process.env, TOWN_CAFE_OUT: 밖 } });
  if (r.status !== 0) throw new Error(`${이름} 굽기 실패(종료 ${r.status})`);
  const 새 = fs.readdirSync(path.join(밖, '판')).filter((f) => !전.has(f) && f.startsWith(이름 + '_') && /\.(png|jpe?g|webp)$/i.test(f));
  if (!새.length) throw new Error(`${이름} 판을 못 찾았다`);
  return path.join(밖, '판', 새.sort().at(-1));
}
/** 가장 최근 판(이름_시각.png). 고른 판이 따로 있으면 `판/고른.json`의 이름이 이긴다. */
export function 판(이름) {
  const 고른경로 = path.join(밖, '판', '고른.json');
  const 고른 = fs.existsSync(고른경로) ? JSON.parse(fs.readFileSync(고른경로, 'utf8')) : {};
  if (고른[이름]) return path.join(밖, '판', 고른[이름]);
  // 판 이름의 시각은 시분초뿐이라 자정을 넘기면 새 판이 이름순으로 앞에 선다(11-04 00:26 판 < 11-03 16:57 판) — 파일 시각으로 가장 새 판을 고른다
  const 후보 = fs.readdirSync(path.join(밖, '판')).filter((f) => new RegExp(`^${이름}_\\d{6}(_\\d+)?\\.(png|jpe?g|webp)$`, 'i').test(f))
    .map((f) => [f, fs.statSync(path.join(밖, '판', f)).mtimeMs]).sort((a, b) => a[1] - b[1]).map(([f]) => f);
  return 후보.length ? path.join(밖, '판', 후보.at(-1)) : null;
}

const 실패 = [];
if (단계 === '재료') {
  const 재료 = ['coffee', 'tea', 'milk', 'ice', 'sugar', 'cold'];
  let 기준 = 판('ing-coffee');
  for (const k of (골라.length ? 골라 : 재료)) {
    if (판(`ing-${k}`) && !process.env.DO_AGAIN) continue;   // 이미 구운 것은 건너뛴다(다시 굽기는 DO_AGAIN=1)
    const 참고들 = k !== 'coffee' && 기준 ? [기준] : [];
    try {
      const 낸 = 부르기(조립(`ing-${k}`, ['_재료_공통', `재료_${k}`, ...(참고들.length ? ['_재료_참고'] : [])]), `ing-${k}`, 참고들);
      if (k === 'coffee') 기준 = 낸;
    } catch (e) { 실패.push(e.message); console.error('[순서]', e.message); }
  }
}
if (['바탕', '모두'].includes(단계)) {
  const 참고들 = 참고();
  for (const g of 대상) {
    if (단계 === '모두' && 판(`${g}-order`)) continue;   // 모두: 이미 구운 바탕은 건너뛴다
    try { 부르기(조립(`${g}-order`, ['_공통_머리', g, '_공통_자리', '_공통_실사결', '_공통_가게', '_공통_계절규칙']), `${g}-order`, 참고들); }
    catch (e) { 실패.push(e.message); console.error('[순서]', e.message); }
  }
}
if (['표정', '모두'].includes(단계)) {
  for (const g of 대상) for (const [k, f] of Object.entries(표정)) {
    const 바탕 = 판(`${g}-order`);
    if (!바탕) { 실패.push(`${g} 바탕이 없어 ${k}를 건너뜀`); continue; }
    if (단계 === '모두' && 판(`${g}-${k}`)) continue;
    try { 부르기(조립(`${g}-${k}`, ['_공통_머리', f, '_공통_계절규칙']), `${g}-${k}`, [바탕]); }
    catch (e) { 실패.push(e.message); console.error('[순서]', e.message); }
  }
}
if (['합성', '모두'].includes(단계)) {
  for (const g of 대상) for (const k of Object.keys(표정)) {
    const 바탕 = 판(`${g}-order`), 편집 = 판(`${g}-${k}`);
    if (!바탕 || !편집) continue;
    const 낼 = path.join(밖, '묶음', `${g}-${k}.png`);
    const r = spawnSync('python', ['-I', '-X', 'utf8', 합성, 바탕, 편집, 낼, '--얼굴', '자동', '--페더', '12'], { stdio: 'inherit' });
    if (r.status !== 0) 실패.push(`${g}-${k} 얼굴 합성 실패`);
  }
}
if (실패.length) { console.error('[순서] 남은 것:\n- ' + 실패.join('\n- ')); process.exitCode = 1; }
else console.log('[순서] 끝 —', 밖);
