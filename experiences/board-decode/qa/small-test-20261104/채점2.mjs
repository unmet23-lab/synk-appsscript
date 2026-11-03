#!/usr/bin/env node
/**
 * 게시판 해독 · 작은 시험 2회차 채점(2026-11-04) — 답.md의 마지막 JSON 줄을 변형표와 맞춘다.
 *   node experiences/board-decode/qa/small-test-20261104/채점2.mjs
 * 판2.mjs의 시험관 묶음은 보기를 원고 순서(a, b, c)로 보여 주므로 기호 = 원고 순서다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { 밖, 판들, 변형표, 시험관들 } from './판2.mjs';

function 마지막JSON(글) {
  const 줄들 = 글.trim().split(/\r?\n/).reverse();
  for (const 줄 of 줄들) { const s = 줄.trim().replace(/^```(json)?$/, ''); if (s.startsWith('{')) { try { return JSON.parse(s); } catch { /* 다음 줄 */ } } }
  return null;
}
const 답읽기 = (종류, 이름) => { const f = path.join(밖, 종류, 이름, '답.md'); return fs.existsSync(f) ? 마지막JSON(fs.readFileSync(f, 'utf8')) : null; };
const 정답기호 = (R, 고름, i) => {
  const k = R.slots[i].keys.at(-1);
  const 필요 = R.forks[k].find((w) => 고름.includes(w));
  return 'abc'[R.slots[i].options.findIndex((o) => o.ok === 필요)];
};
const 맞춤 = (R, 고름, 답) => R.slots.map((_, i) => String(답?.[String(i + 1)] ?? '').trim().toLowerCase().slice(0, 1) === 정답기호(R, 고름, i));
const 합 = (a) => a.filter(Boolean).length;

console.log('① 안 읽고 풀기(칸마다 보기 셋 · 찍기 기준값 칸당 33%)');
let 전체맞음 = 0, 전체칸 = 0;
for (const 이름 of Object.keys(변형표).filter((n) => n.startsWith('안읽고'))) {
  const 답 = 답읽기('안읽고', 이름);
  if (!답) { console.log(`  ${이름}: 답 없음`); continue; }
  for (const R of 판들) {
    const r = 맞춤(R, 변형표[이름][R.id], 답[R.id]);
    전체맞음 += 합(r); 전체칸 += r.length;
    console.log(`  ${이름} 판${R.id} [${변형표[이름][R.id].join('·')}]: ${합(r)}/${r.length}`);
  }
}
console.log(`  → 칸 ${전체맞음}/${전체칸} (${전체칸 ? Math.round((전체맞음 / 전체칸) * 100) : 0}%)`);

console.log('\n② 해독(갈림 말을 가림): 단서 없이 → 단서 카드 뒤');
let 처음 = 0, 뒤 = 0, 칸 = 0;
for (const 이름 of Object.keys(변형표).filter((n) => n.startsWith('해독'))) {
  const 답 = 답읽기('해독', 이름);
  if (!답) { console.log(`  ${이름}: 답 없음`); continue; }
  for (const R of 판들) {
    const a = 맞춤(R, 변형표[이름][R.id], 답[R.id]?.처음);
    const b = 맞춤(R, 변형표[이름][R.id], 답[R.id]?.단서뒤);
    처음 += 합(a); 뒤 += 합(b); 칸 += a.length;
    console.log(`  ${이름} 판${R.id} [${변형표[이름][R.id].join('·')}]: 처음 ${합(a)}/${a.length} → 단서 뒤 ${합(b)}/${b.length} · 뜻 ${JSON.stringify(답[R.id]?.뜻 || {})}`);
  }
}
console.log(`  → 처음 ${처음}/${칸} · 단서 뒤 ${뒤}/${칸}`);

console.log('\n③ 재미(판 번호를 판 꼴로 되돌림 · 1회차 기준: 끝까지 3.3 · 게임같음 2.8~3.3)');
const 모음 = Object.fromEntries(판들.map((R) => [R.id, { 끝까지: [], 게임같음: [] }]));
const 또 = {}, 낱말 = {}, 장면 = {}; const 다시 = [];
for (const [이름, 사람] of Object.entries(시험관들)) {
  const 답 = 답읽기('시험관', 이름);
  if (!답) { console.log(`  ${이름}: 답 없음`); continue; }
  사람.순서.forEach((id, i) => { 모음[id].끝까지.push(답.끝까지?.[`판${i + 1}`]); 모음[id].게임같음.push(답.게임같음?.[`판${i + 1}`]); });
  const 꼴 = 사람.순서[Number(String(답.또할판).replace(/\D/g, '')) - 1] || '?';
  또[꼴] = (또[꼴] || 0) + 1;
  낱말[답.낱말바뀜] = (낱말[답.낱말바뀜] || 0) + 1;
  장면[답.틀림장면] = (장면[답.틀림장면] || 0) + 1;
  다시.push(답.다시하겠나);
}
const 평균 = (a) => { const b = a.filter((x) => Number.isFinite(x)); return b.length ? (b.reduce((p, c) => p + c, 0) / b.length).toFixed(1) : '—'; };
for (const R of 판들) console.log(`  판${R.id} ${R.kind}: 끝까지 ${평균(모음[R.id].끝까지)} ${JSON.stringify(모음[R.id].끝까지)} · 게임같음 ${평균(모음[R.id].게임같음)} ${JSON.stringify(모음[R.id].게임같음)}`);
console.log('  또 할 판:', 또, '· 낱말 바뀜:', 낱말, '· 틀림 장면:', 장면, '· 다시 하겠나:', 평균(다시), JSON.stringify(다시));

console.log('\n④ 판마다 게시물 글 양(한글 음절)');
for (const R of 판들) {
  const 글 = R.notices.flatMap((N) => [N.head, N.title, N.foot || '', ...N.lines.map((L) => (typeof L === 'string' ? L : L.li || L.note || L.big || ''))]).join(' ').replace(/\[\[[^\]]+\]\]/g, '말말');
  console.log(`  판${R.id}: 게시물 ${(글.match(/[가-힣]/g) || []).length}음절 · 쪽지 ${(R.scraps.join('').match(/[가-힣]/g) || []).length}음절 · 칸 ${R.slots.length}개`);
}
