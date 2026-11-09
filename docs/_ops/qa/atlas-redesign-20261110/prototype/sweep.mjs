// 새 두뇌가 고정 사다리보다 나은 것이 가상 학습자의 가정 하나에 기댄 결과인지 본다(지금 엔진은 느려서 뺀다).
// 사다리는 두 갈래다: 복습 먼저(ladder) · 돌아온 것 셋에 새것 하나(ladderMix). 가정마다 둘 가운데 나은 쪽과 견준다.
// ① 가정 훑기: 망각 속도 2 × 어렵게 떠올린 보람 3 × 놓쳤을 때 깎임 3 × 찍어 맞힌 답의 처리 2 = 36가지.
// ② 등급 대응 견주기: 고르는 꼴 정답을 약한 성공(0.4 · 0.6)으로 둘 때와 Good(1.0)으로 둘 때.
// ③ 일정 견주기: 2주 뒤 일주일을 쉬고 돌아옴 · 하루 두 판(아침 · 저녁 10문항씩).
// ④ 목표 보유율 견주기: 0.9(08-22 확정값) · 0.85 · 0.8. 확정값을 바꾸자는 것이 아니라 값에 얼마나 민감한지 보는 자료다.
import { PARAMS } from './brain.mjs';
import { daily, mean, runMany } from './sim-core.mjs';

const LEARNERS = Number(process.env.LEARNERS || 40);
const one = value => value.toFixed(1), pct = value => `${(100 * value).toFixed(0)}%`, signed = value => (value >= 0 ? '+' : '') + one(value);
const all = options => ({ ladder: runMany('ladder', options, LEARNERS), ladderMix: runMany('ladderMix', options, LEARNERS), brain: runMany('brain', options, LEARNERS) });
const NAME = { ladder: '사다리(복습 먼저)      ', ladderMix: '사다리(셋에 하나 새것)', brain: '새 두뇌                ' };

console.log(`① 가정 훑기 — 30일째 아는 낱말 / 일주일 쉰 뒤(60 중, 가상 학습자 ${LEARNERS}명 평균). 「차이」는 새 두뇌 − 두 사다리 가운데 나은 쪽`);
console.log('반감기 | 보람 | 깎임 | 찍은 정답 | 사다리(복습 먼저) | 사다리(셋에 하나) | 새 두뇌 | 차이(30일째 · 쉰 뒤)');
const tally = { fast: { n: 0, win30: 0, winRest: 0, worst30: Infinity, worstRest: Infinity, worstPct30: Infinity, worstPctRest: Infinity }, slow: { n: 0, win30: 0, winRest: 0, worst30: Infinity, worstRest: Infinity, worstPct30: Infinity, worstPctRest: Infinity } };
for (const base of [0.7, 2]) for (const slope of [1.5, 3, 6]) for (const lapse of [0.25, 0.4, 0.6]) for (const guessShrink of [true, false]) {
  const r = all({ truth: { base, slope, lapse, guessShrink }, sessions: daily(30, 20) });
  const best30 = Math.max(r.ladder.known(30), r.ladderMix.known(30)), bestRest = Math.max(r.ladder.rest, r.ladderMix.rest);
  const d30 = r.brain.known(30) - best30, dRest = r.brain.rest - bestRest, t = tally[base < 1 ? 'fast' : 'slow'];
  t.n += 1; if (d30 >= 0) t.win30 += 1; if (dRest >= 0) t.winRest += 1;
  t.worst30 = Math.min(t.worst30, d30); t.worstRest = Math.min(t.worstRest, dRest); t.worstPct30 = Math.min(t.worstPct30, d30 / best30); t.worstPctRest = Math.min(t.worstPctRest, dRest / bestRest);
  console.log(`${String(base).padEnd(6)} | ${String(slope).padEnd(4)} | ${String(lapse).padEnd(4)} | ${(guessShrink ? '놓친 것' : '그대로').padEnd(6)} | ${one(r.ladder.known(30)).padStart(5)} / ${one(r.ladder.rest).padStart(5)} | ${one(r.ladderMix.known(30)).padStart(5)} / ${one(r.ladderMix.rest).padStart(5)} | ${one(r.brain.known(30)).padStart(5)} / ${one(r.brain.rest).padStart(5)} | ${signed(d30)} · ${signed(dRest)}`);
}
for (const [key, name] of [['fast', '빨리 잊는 가정(반감기 0.7일)'], ['slow', '천천히 잊는 가정(반감기 2일)']]) {
  const t = tally[key];
  console.log(`   ${name} ${t.n}가지: 새 두뇌가 나은 사다리 이상 — 30일째 ${t.win30}/${t.n} · 쉰 뒤 ${t.winRest}/${t.n}. 가장 나쁜 차이 — 30일째 ${signed(t.worst30)}(${pct(t.worstPct30)}) · 쉰 뒤 ${signed(t.worstRest)}(${pct(t.worstPctRest)})`);
}

console.log('\n② 고르는 꼴 정답의 등급 대응 — 30일째 / 일주일 쉰 뒤 / 잊은 뒤에야 물음');
for (const base of [0.7, 2]) for (const guessShrink of [true, false]) for (const weakWeight of [0.4, 0.6, 1]) {
  const r = runMany('brain', { truth: { base, guessShrink }, policy: { params: { ...PARAMS, weakWeight } }, sessions: daily(30, 20) }, LEARNERS);
  console.log(`   반감기 ${String(base).padEnd(3)} · 찍은 정답 ${guessShrink ? '놓친 것' : '그대로 '} · 증가분 ${String(weakWeight).padEnd(3)}${weakWeight === 1 ? '(Good과 같음)' : ''}: ${one(r.known(30))} / ${one(r.rest)} / ${pct(r.lost)}`);
}

console.log('\n③-가 2주 공부 → 일주일 쉼 → 9일 공부(하루 20문항). 돌아온 첫 판의 정답률 · 돌아온 뒤 새로 만난 낱말 · 30일째 아는 낱말');
for (const base of [0.7, 2]) {
  const r = all({ truth: { base }, sessions: daily(30, 20, [14, 15, 16, 17, 18, 19, 20]) });
  for (const name of ['ladder', 'ladderMix', 'brain']) {
    const back = mean(r[name].runs.map(run => run.sessions.find(s => s.day === 21).success));
    const fresh = mean(r[name].runs.map(run => run.sessions.filter(s => s.day >= 21).reduce((sum, s) => sum + s.fresh, 0)));
    console.log(`   반감기 ${String(base).padEnd(3)} · ${NAME[name]}: 첫 판 정답률 ${pct(back)} · 새 낱말 ${one(fresh)} · 30일째 ${one(r[name].known(30))} · 그 뒤 일주일 쉬면 ${one(r[name].rest)}`);
  }
}

console.log('\n③-나 하루 두 판(아침 9시 · 저녁 9시, 10문항씩) 30일 — 30일째 / 일주일 쉰 뒤 / 만난 낱말');
for (const base of [0.7, 2]) {
  const sessions = Array.from({ length: 30 }, (_, day) => [{ day, at: 0, n: 10 }, { day, at: 12 * 3600000, n: 10 }]).flat();
  const r = all({ truth: { base }, sessions });
  for (const name of ['ladder', 'ladderMix', 'brain']) console.log(`   반감기 ${String(base).padEnd(3)} · ${NAME[name]}: ${one(r[name].known(30))} / ${one(r[name].rest)} / ${one(r[name].met)}`);
}

console.log('\n④ 목표 보유율 — 30일째 / 일주일 쉰 뒤 / 정답률(새 두뇌)');
for (const [base, slope] of [[0.7, 3], [2, 3], [2, 6]]) for (const retention of [0.9, 0.85, 0.8]) {
  const r = runMany('brain', { truth: { base, slope }, policy: { params: { ...PARAMS, retention } }, sessions: daily(30, 20) }, LEARNERS);
  console.log(`   반감기 ${String(base).padEnd(3)} · 보람 ${slope} · 목표 ${String(retention).padEnd(4)}: ${one(r.known(30))} / ${one(r.rest)} / ${pct(r.success)}`);
}
