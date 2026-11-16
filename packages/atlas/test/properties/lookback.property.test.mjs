// 30일째 문장의 자리 세기가 기억 모델과 같은 자리를 세는지(단계 4 계획 §21-7 「자리의 경계는 기억 모델과 같다」). 임의 줄 — 답(네 등급) ·
// 본인 말(이미 알아요 · 다시 배울래요)을 60일에 흩뿌리고, 모든 자리가 한 창에 들게 연 창으로 센 수를 기억 모델의 만난 자리 수 · 놓친 자리 수와
// 맞댄다. 어긋난 판은 씨앗과 함께 찍는다(ATLAS_FIRST_SEED=<씨앗> ATLAS_SEEDS=1로 다시 돈다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

const { createMemory } = await subject('memory/index.mjs');
const { lookbackOf } = await subject('memory/lookback.mjs');

const HOUR = 3_600_000;
const GRADES = ['again', 'hard', 'weak', 'good'];
const SEEDS = seedRange({ count: 500, first: 20261116 });
// 모든 자리가 앞 창에 드는 창과 뒤 창에 드는 창.
const ALL_BEFORE = {
  monthAgo: { from: -Infinity, to: Infinity },
  since: { from: Infinity, to: Infinity },
  last7: { from: Infinity, to: Infinity },
};
const ALL_AFTER = {
  monthAgo: { from: 0, to: 0 },
  since: { from: -Infinity, to: Infinity },
  last7: { from: -Infinity, to: Infinity },
};

// 같은 자리 안(몇 분 ~ 5시간)과 자리 밖(6시간 ~ 4일)을 섞는다. 6시간 경계 바로 앞뒤도 넣는다.
function gap(random) {
  const roll = random();
  if (roll < 0.4) return Math.floor(random() * 5 * HOUR);
  if (roll < 0.5) return 6 * HOUR - 1 + Math.floor(random() * 3);
  return Math.floor(6 * HOUR + random() * 96 * HOUR);
}

function rowsOf(random) {
  const rows = [];
  let at = Date.UTC(2026, 9, 1);
  const count = 1 + Math.floor(random() * 30);
  for (let i = 0; i < count; i += 1) {
    at += gap(random);
    const id = `e${String(i).padStart(3, '0')}`;
    const kind = random();
    if (kind < 0.06) rows.push({ id, at, say: 'known' });
    else if (kind < 0.09) rows.push({ id, at, say: 'relearn' });
    else rows.push({ id, at, grade: GRADES[Math.floor(random() * GRADES.length)] });
  }
  return rows;
}

test(`자리 수 · 놓친 자리 수가 기억 모델(memory.fold)과 같다 — 임의 줄 ${SEEDS.length}개`, () => {
  const memory = createMemory();
  for (const seed of SEEDS) {
    const rows = rowsOf(rng(seed));
    const line = memory.fold(rows);
    const sittings = line && !line.empty ? line.sittings : 0;
    const lapses = line && !line.empty ? line.lapses : 0;
    assert.equal(lookbackOf(rows, ALL_AFTER).reviews, sittings, `만난 자리 수(씨앗 ${seed})`);
    assert.equal(lookbackOf(rows, ALL_BEFORE).misses, lapses, `놓친 자리 수(씨앗 ${seed})`);
  }
});
