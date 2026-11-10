// 가상 학습자 관문 4(설계 §11) — 쉬다 돌아온 사람 · 하루 두 판 · 잇달아 다섯 판 일정에서 한도를 지키고,
// 쉬다 돌아온 첫 판의 정답률이 두 사다리보다 높다. 가정은 빨리 잊음(반감기 0.7일)과 천천히 잊음(2일) 둘.
// 한도는 새 두뇌가 남긴 「낸 것」 기록(learner.log)에서 센다: 하루에 처음 낸 단위 ≤ 하루 한도, 한 판에 처음 낸 단위 ≤ 한 판 한도,
// 하루에 돌아온 것으로 낸 문항 ≤ 하루 상한.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DAY, daily, mean, PARAMS, runMany, T0 } from './sim.mjs';

const LEARNERS = Number(process.env.ATLAS_LEARNERS) || 40;
const BASES = [0.7, 2];
const HOUR = 3_600_000;

// 판마다 낸 것을 잘라 센다(learner.log는 낸 순서대로 한 줄씩 — runOne의 판마다 낸 수로 자른다).
function overLimits(run) {
  const log = run.agent.learner.log;
  const bad = [];
  let cursor = 0;
  for (const session of run.sessions) {
    const entries = log.slice(cursor, cursor + session.shown);
    cursor += session.shown;
    const fresh = new Set(entries.flatMap(entry => entry.units)).size;
    if (fresh > PARAMS.newPerSession) bad.push(`${session.day}일째 판 새 단위 ${fresh}`);
  }
  const days = new Map();
  for (const entry of log) {
    const key = Math.floor((entry.at - T0) / DAY);
    const day = days.get(key) || { units: new Set(), reviews: 0 };
    for (const unit of entry.units) day.units.add(unit);
    if (entry.review) day.reviews += 1;
    days.set(key, day);
  }
  for (const [key, day] of days) {
    if (day.units.size > PARAMS.newPerDay) bad.push(`${key}일째 새 단위 ${day.units.size}`);
    if (day.reviews > PARAMS.reviewsPerDay) bad.push(`${key}일째 돌아온 것 ${day.reviews}`);
  }
  return bad;
}

function assertLimits(result) {
  const bad = result.runs.flatMap((run, i) => overLimits(run).map(what => `학습자 ${i} · ${what}`));
  assert.equal(bad.length, 0, bad.slice(0, 6).join('\n'));
}

const REST_DAYS = [14, 15, 16, 17, 18, 19, 20];

for (const base of BASES) {
  test(`쉬다 돌아온 사람(반감기 ${base}일) — 2주 공부 · 일주일 쉼: 한도를 지키고 돌아온 첫 판 정답률이 두 사다리보다 높다`, () => {
    const options = { truth: { base }, sessions: daily(30, 20, REST_DAYS) };
    const back = name =>
      mean(
        runMany(name, options, LEARNERS).runs.map(
          run => run.sessions.find(s => s.day === 21).success,
        ),
      );
    const brain = runMany('brain', options, LEARNERS);
    assertLimits(brain);
    const mine = mean(brain.runs.map(run => run.sessions.find(s => s.day === 21).success));
    for (const name of ['ladder', 'ladderMix'])
      assert.ok(mine > back(name), `새 두뇌 ${mine.toFixed(3)} · ${name} ${back(name).toFixed(3)}`);
  });

  test(`하루 두 판(반감기 ${base}일) — 아침 · 저녁 10문항씩 30일 동안 한도를 지킨다`, () => {
    const sessions = Array.from({ length: 30 }, (_, day) => [
      { day, at: 0, n: 10 },
      { day, at: 12 * HOUR, n: 10 },
    ]).flat();
    assertLimits(runMany('brain', { truth: { base }, sessions }, LEARNERS));
  });

  test(`잇달아 다섯 판(반감기 ${base}일) — 하루 20문항씩 다섯 판을 사흘 동안 해도 한도를 지킨다`, () => {
    const sessions = Array.from({ length: 3 }, (_, day) =>
      Array.from({ length: 5 }, (_, k) => ({ day, at: k * 30 * 60_000, n: 20 })),
    ).flat();
    const result = runMany('brain', { truth: { base }, sessions }, LEARNERS);
    assertLimits(result);
    // 하루 한도가 실제로 걸렸는가(무딘 시험이 아닌가): 첫날 다섯 판에 처음 낸 단위는 하루 한도에서 멈춘다
    const firstDay = result.runs.map(
      run => new Set(run.agent.learner.log.filter(e => e.at < T0 + DAY).flatMap(e => e.units)).size,
    );
    assert.ok(
      firstDay.every(n => n === PARAMS.newPerDay),
      firstDay.join(' '),
    );
  });
}
