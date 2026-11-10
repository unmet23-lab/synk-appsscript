// 가상 학습자 관문 2 · 3 · 5(설계 §11) — 가정 36가지(망각 속도 2 × 어렵게 떠올린 보람 3 × 놓쳤을 때 깎임 3 × 찍어 맞힌 답의 처리 2)마다
// 새 두뇌와 고정 사다리 두 갈래를 가상 학습자 40명(ATLAS_LEARNERS)으로 30일 돌린다(하루 한 판 20문항).
//   2. 빨리 잊는 가정 18가지에서 30일째 평균이 두 사다리보다 높고, 일주일 쉰 뒤는 18가지 모두 나은 쪽 사다리보다 앞선다.
//   3. 36가지 어느 가정에서도 나은 쪽 사다리보다 10% 넘게 뒤지지 않는다(30일째 · 쉰 뒤).
//   5. 앞 판보다 36가지 평균이 나빠지지 않는다 — 앞 판 값은 baseline.json(두뇌 판을 올릴 때 ATLAS_WRITE_BASELINE=1로 고쳐 쓴다).
//   §1 표 2. 이미 아는 것은 점점 드물게 묻는다 — 또렷한 단위를 또 물은 몫이 망각 속도마다(18가지 평균) 두 사다리 이하.
// 「모든 가정에서 사다리 이상」은 관문이 아니다 — 천천히 잊는 가정에서는 고정 사다리가 이미 좋은 일정이다(설계 §3-8).
// 몇 분 걸린다. check에 들지 않고 두뇌 판을 올릴 때 npm run gate로 돈다. 숫자는 규칙을 견주는 자료이고 학습 효과의 증거가 아니다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ASSUMPTIONS, daily, mean, PARAMS, runMany } from './sim.mjs';

const LEARNERS = Number(process.env.ATLAS_LEARNERS) || 40;
const BASELINE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'baseline.json');
const one = value => value.toFixed(2);

const results = ASSUMPTIONS.map(truth => {
  const options = { truth, sessions: daily(30, 20) };
  const run = name => runMany(name, options, LEARNERS);
  const [brain, ladder, ladderMix] = [run('brain'), run('ladder'), run('ladderMix')];
  return {
    truth,
    fast: truth.base < 1,
    brain: { known: brain.known(30), rest: brain.rest, easy: brain.easy },
    ladder: { known: ladder.known(30), rest: ladder.rest, easy: ladder.easy },
    ladderMix: { known: ladderMix.known(30), rest: ladderMix.rest, easy: ladderMix.easy },
    best: {
      known: Math.max(ladder.known(30), ladderMix.known(30)),
      rest: Math.max(ladder.rest, ladderMix.rest),
    },
  };
});
const label = r =>
  `반감기 ${r.truth.base} · 보람 ${r.truth.slope} · 깎임 ${r.truth.lapse} · 찍은 정답 ${r.truth.guessShrink ? '놓친 것' : '그대로'}`;
if (process.env.ATLAS_VERBOSE)
  for (const r of results)
    console.log(
      `${label(r)}: 새 두뇌 ${one(r.brain.known)} / ${one(r.brain.rest)} · 나은 사다리 ${one(r.best.known)} / ${one(r.best.rest)}`,
    );

test('관문 2 — 빨리 잊는 18가지: 30일째 평균이 두 사다리보다 높고, 쉰 뒤는 모두 앞선다', () => {
  const fast = results.filter(r => r.fast);
  assert.equal(fast.length, 18);
  const avg = key => mean(fast.map(r => r[key].known));
  assert.ok(
    avg('brain') > avg('ladder'),
    `새 두뇌 ${avg('brain')} · 사다리(복습 먼저) ${avg('ladder')}`,
  );
  assert.ok(
    avg('brain') > avg('ladderMix'),
    `새 두뇌 ${avg('brain')} · 사다리(셋에 하나) ${avg('ladderMix')}`,
  );
  const behind = fast.filter(r => !(r.brain.rest > r.best.rest));
  assert.equal(behind.length, 0, behind.map(label).join('\n'));
});

test('관문 3 — 36가지 어느 가정에서도 나은 쪽 사다리보다 10% 넘게 뒤지지 않는다', () => {
  const behind = results.filter(
    r => r.brain.known < 0.9 * r.best.known || r.brain.rest < 0.9 * r.best.rest,
  );
  assert.equal(
    behind.length,
    0,
    behind
      .map(
        r =>
          `${label(r)}: ${one(r.brain.known)}/${one(r.best.known)} · ${one(r.brain.rest)}/${one(r.best.rest)}`,
      )
      .join('\n'),
  );
});

test('§1 표 2 — 또렷한 단위를 또 물은 몫이 망각 속도마다 두 사다리 이하다', () => {
  for (const fast of [true, false]) {
    const group = results.filter(r => r.fast === fast);
    const easy = key => mean(group.map(r => r[key].easy));
    for (const ladder of ['ladder', 'ladderMix'])
      assert.ok(
        easy('brain') <= easy(ladder),
        `${fast ? '빨리' : '천천히'} 잊음: 새 두뇌 ${easy('brain').toFixed(3)} · ${ladder} ${easy(ladder).toFixed(3)}`,
      );
  }
});

test('관문 5 — 앞 판보다 36가지 평균이 나빠지지 않는다', t => {
  const now = {
    editions: PARAMS.editions,
    learners: LEARNERS,
    known30: mean(results.map(r => r.brain.known)),
    rest: mean(results.map(r => r.brain.rest)),
  };
  if (process.env.ATLAS_WRITE_BASELINE) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    t.diagnostic(`baseline.json을 고쳐 썼다: ${JSON.stringify(now)}`);
    return;
  }
  const before = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  assert.equal(LEARNERS, before.learners, `앞 판 값은 가상 학습자 ${before.learners}명으로 쟀다`);
  assert.ok(
    now.known30 >= before.known30 - 1e-9,
    `30일째 평균 ${now.known30} < 앞 판 ${before.known30}`,
  );
  assert.ok(now.rest >= before.rest - 1e-9, `쉰 뒤 평균 ${now.rest} < 앞 판 ${before.rest}`);
});
