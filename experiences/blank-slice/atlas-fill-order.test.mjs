// 채우기 차례(단계 4 계획 §23-14 · 설계 주인 11-20): 빈 기억 손님이 빈칸 베기를 같은 날 네 판 하는 장면(qa/atlas-fill-order.mjs)을 문 · 키트 ·
// 진짜 엔진 코치로 돌린다. 채우기(idle)로 고른 자리만 센다. 셋째 판과 넷째 판이 같지 않고, 앞 판에서 만나지 않은 단위의 채우기 후보가 남아 있는
// 동안 앞 판의 문항을 채우기로 다시 내지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { newRounds, ROUNDS } from './qa/atlas-fill-order.mjs';

// 앞 판의 문항을 채우기로 다시 낸 자리마다, 그때 남아 있던 「앞 판에서도 이번 판에서도 만나지 않은 단위」만 가진 이미 본 문항을 모은다.
export function earlyRepeats(rounds) {
  const found = [];
  const seen = new Map();
  rounds.forEach((round, r) => {
    if (r > 0) {
      const before = rounds[r - 1].shown;
      const keys = new Set(before.map(pick => pick.itemKey));
      const met = new Set(before.flatMap(pick => pick.units));
      const now = new Set();
      for (const pick of round.shown) {
        if (pick.idle && keys.has(pick.itemKey)) {
          const left = [...seen].filter(([key, units]) => !keys.has(key) && !now.has(key) && units.every(unit => !met.has(unit)));
          if (left.length) found.push(`판 ${r + 1} ${pick.itemKey} — 남은 것 ${left.map(([key]) => key).join(' ')}`);
        }
        now.add(pick.itemKey);
        for (const unit of pick.units) met.add(unit);
      }
    }
    for (const pick of round.shown) seen.set(pick.itemKey, pick.units);
  });
  return found;
}

test('빈칸 베기 같은 날 네 판 — 셋째 판과 넷째 판이 같지 않고, 앞 판에서 만나지 않은 단위의 채우기 후보가 남은 동안 앞 판을 다시 내지 않는다', async () => {
  const rounds = await newRounds();
  assert.equal(rounds.length, ROUNDS);
  const [third, fourth] = [rounds[2], rounds[3]];
  assert.ok(fourth.shown.some(pick => pick.idle), '넷째 판에 채우기가 있다(장면이 채우기에 닿는다)');
  assert.notDeepEqual(fourth.ids, third.ids, '넷째 판이 셋째 판과 같다');
  const samePlace = fourth.ids.filter((id, i) => third.ids[i] === id && fourth.shown[i].idle);
  assert.deepEqual(samePlace, [], '채우기 자리에 셋째 판의 같은 자리 문장이 그대로 섰다');
  assert.deepEqual(earlyRepeats(rounds), []);
});
