// 채우기 차례(단계 4 계획 §23-14 · 설계 주인 11-20) — WORLD 짧은 연습(4-1)도 같은 choose를 쓴다. 빈 기억 손님이 같은 읽기 항목으로
// 같은 날 짧은 연습(5문항)을 여섯 판 한다(판마다 넷째 문항을 틀림). 앞 판과 겹치는 채우기 문항은 앞 판에서 만나지 않은 단위의 채우기 후보가
// 남아 있지 않을 때만 선다. 앞 판의 문항이 「다시」(놓친 단위)로 돌아오는 것은 채우기가 아니다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const atlas = await import('../../../packages/atlas/src/index.mjs');
const { createPracticeNextSession } = await import('../world-practice-next.mjs');
const { bankItems } = await import('../world-topik-items.mjs');
const { allowedPlays, nextPlay } = await import('../world-exam-form.mjs');
const json = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));

// 앞 판의 문항을 채우기로 다시 낸 자리마다, 그때 남아 있던 「앞 판에서도 이번 판에서도 만나지 않은 단위」만 가진 이미 본 문항을 모은다.
function earlyRepeats(rounds) {
  const found = [];
  const seen = new Map();
  rounds.forEach((round, r) => {
    if (r > 0) {
      const before = rounds[r - 1];
      const keys = new Set(before.map(pick => pick.itemKey));
      const met = new Set(before.flatMap(pick => pick.units));
      const now = new Set();
      for (const pick of round) {
        if (pick.idle && keys.has(pick.itemKey)) {
          const left = [...seen].filter(([key, units]) => !keys.has(key) && !now.has(key) && units.every(unit => !met.has(unit)));
          if (left.length) found.push(`판 ${r + 1} ${pick.itemKey} — 남은 것 ${left.map(([key]) => key).join(' ')}`);
        }
        now.add(pick.itemKey);
        for (const unit of pick.units) met.add(unit);
      }
    }
    for (const pick of round) seen.set(pick.itemKey, pick.units);
  });
  return found;
}

test('WORLD 짧은 연습 같은 날 여섯 판 — 앞 판과 겹치는 채우기는 앞 판에서 만나지 않은 단위의 후보가 다 쓰인 뒤에만 선다', async () => {
  const bank = bankItems(json('../world-topik-items.json'));
  const pool = bank.filter(item => item.skillId === 'ko.reading.condition');
  assert.ok(pool.length >= 15, `읽기 항목 은행 ${pool.length}문항`);
  const mapData = { index: json('../../../packages/atlas/map/index.json'), units: json('../../../packages/atlas/map/units.json') };
  const time = { t: Date.UTC(2026, 10, 19, 1) };
  const port = atlas.memoryPort();
  const coach = atlas.createCoach({ gameId: 'world-practice', mapData, dayOffset: 540, host: { guest: true, port, key: 'synk-atlas:fill-test', now: () => time.t } });
  await coach.ready;
  const rounds = [];
  for (let r = 0; r < 6; r++) {
    const session = createPracticeNextSession({ plays: { allowedPlays, nextPlay }, coach, pool, length: 5 });
    let i = 0;
    while (session.next()) {
      const { item, heard } = session.current;
      if (!heard) session.delivery('completed');
      session.answer(i % 4 === 3 ? item.choices.find(choice => choice.id !== item.correctId).id : item.correctId);
      i++;
      time.t += 30_000;
    }
    await session.settled?.();
    await new Promise(resolve => setTimeout(resolve, 0));
    const presented = (await port.read()).map(row => row.value?.event).filter(event => event?.type === 'practice.presented');
    rounds.push(presented.slice(-i).map(event => ({ itemKey: event.itemKey, units: event.units, idle: event.reason?.code === 'idle' })));
    time.t += 60_000;
  }
  coach.dispose();
  assert.ok(rounds.slice(1).every(round => round.some(pick => pick.idle)), '둘째 판부터 채우기가 있다(장면이 채우기에 닿는다)');
  for (let r = 1; r < rounds.length; r++)
    assert.notDeepEqual(rounds[r].map(pick => pick.itemKey), rounds[r - 1].map(pick => pick.itemKey), `판 ${r + 1}이 앞 판과 같다`);
  assert.deepEqual(earlyRepeats(rounds), []);
});
