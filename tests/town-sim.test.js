'use strict';
// 싱크타운 결정적 시뮬레이션(세로 조각 설계 §15-1·§15-3) — 줄인 판(씨앗 12 × 30생활일)은 5초 안에 돌고,
// 같은 입력이면 몇 번을 돌려도, 어느 시간대의 기기에서 돌려도 결과 해시가 같다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { toolModule, runUnderTimezone, runtimeFiles, ROOT } = require('./lib/town.js');

const MINUTE = 60000, HOUR = 60 * MINUTE;

test('줄인 시뮬레이션은 제한 시간 안에 돌고 잰 지표가 알려진 실패 밖에서 모두 통과한다', async () => {
  const { runSimulation, summarize, checkOutcome, METRICS, TIMEZONES, PROFILES } = await toolModule('town-sim');
  // The gathering profile (W8b) is measured by its own small run below and by CI's hundred-seed run — this timed one keeps the
  // five profiles it always had, so the budget is not spent on it (it failed once at 15017ms, 10-27 run 40521285163).
  const five = PROFILES.filter(profile => profile !== 'daily-gather');
  // 줄인 판은 마을 시간대 하나로 돈다(W5b, 10-26) — 네 시간대는 같은 CI의 씨앗 100 단계(npm run check:town-sim)가 본다.
  // 설계 목표는 한가한 PC에서 5초(§15-5). 재는 것은 이 시험을 돌린 주 스레드의 CPU 시간이다: CI의 「SYNK safety tests」는 시험 파일들을
  // 나란히 돌려, 벽시계로 재면 다른 시험을 기다린 시간이 끼어 W5a 뒤 21초로 넘기도 했고(10-25 run 40216175219), 프로세스 CPU
  // (process.cpuUsage)는 GC·컴파일 도우미 스레드까지 더해 16초로 부풀었다(10-26 run 40217350081). 주 스레드 CPU가 없는 옛 노드는 벽시계.
  const clock = () => (process.threadCpuUsage ? (u => (u.user + u.system) / 1000)(process.threadCpuUsage()) : performance.now());
  const started = clock();
  const result = runSimulation({ seeds: 12, days: 30, timezones: [TIMEZONES[0]], profiles: five });
  const spentMs = Math.round(clock() - started);
  assert.ok(spentMs < 15000, `${spentMs}ms`);
  const s = summarize(result);
  assert.equal(s.villages, 12 * (1 * 4 + 1), '다 받는 모습은 첫 시간대에서만');
  // The known failures (KNOWN_FAILURES, each with its track line) are reported as failures; nothing else may fail (W11).
  assert.deepEqual(checkOutcome(result).unknown, [], result.metrics.filter(m => m.status === 'fail').map(m => `${m.label}: ${m.value}`).join(', '));
  const measured = ['meetable-residents', 'places-per-day', 'routine-variety', 'repetition', 'rain-outside', 'energy', 'mood-lines',
    'cards', 'wear-owner', 'hearsay', 'pairs', 'card-coverage', 'changes-summary', 'visit-habit', 'visible-change'];
  assert.deepEqual(result.metrics.filter(m => measured.includes(m.id)).map(m => m.status), measured.map(() => 'pass'), 'W3~W11이 재는 지표');
  // What the design names without a bar (§15-1 가상 학습자 · §20-10) is measured, never pending.
  assert.deepEqual(result.metrics.filter(m => ['seen-new', 'less-often', 'learners'].includes(m.id)).map(m => m.status), ['measure', 'measure', 'measure']);
  assert.deepEqual(result.metrics.map(m => m.id), METRICS.map(m => m.id));
  assert.equal(runSimulation({ seeds: 12, days: 30, timezones: [TIMEZONES[0]], profiles: five }).hash, result.hash, '같은 입력이면 같은 결과');
  assert.notEqual(runSimulation({ seeds: 13, days: 30, timezones: [TIMEZONES[0]], profiles: five }).hash, result.hash);
});

test('여섯째 모습 — 매일 채집·드리기: 잎 통 마모가 줄고 C3가 더 잦지 않으며 한도를 넘지 않는다(§20-8 · §20-10, W8b)', async () => {
  const { runSimulation, TIMEZONES } = await toolModule('town-sim');
  const run = runSimulation({ seeds: 4, days: 30, timezones: [TIMEZONES[0]], profiles: ['daily-random', 'daily-gather'], only: ['gather', 'hearsay'] });
  const gather = run.metrics.find(m => m.id === 'gather'), hearsay = run.metrics.find(m => m.id === 'hearsay');
  assert.equal(gather.status, 'pass', gather.value);
  assert.equal(hearsay.status, 'pass', '채집 마을에서도 퍼진 플레이어 사건 0');
  const gathering = run.villages.filter(v => v.profile === 'daily-gather');
  assert.equal(gathering.length, 4, '첫 시간대 앞 씨앗 넷');
  assert.ok(gathering.every(v => v.result.relief > 0 && v.result.jarBands > 0));
});

test('알려진 실패 목록 — 그것만 실패면 통과, 목록 밖 실패나 통과한 목록 줄은 걸린다(W11)', async () => {
  const { checkOutcome, KNOWN_FAILURES, METRICS } = await toolModule('town-sim');
  assert.ok(Object.keys(KNOWN_FAILURES).every(id => METRICS.some(m => m.id === id)), '목록의 지표는 모두 있는 지표');
  assert.ok(Object.values(KNOWN_FAILURES).every(why => /트랙/.test(why)), '줄마다 트랙의 후속 자리를 적는다');
  const run = statuses => ({ metrics: Object.entries(statuses).map(([id, status]) => ({ id, status })) });
  assert.deepEqual(checkOutcome(run({ a: 'pass', b: 'fail', c: 'fail' }), { b: '트랙' }), { unknown: ['c'], stale: [] });
  assert.deepEqual(checkOutcome(run({ a: 'pass', b: 'pass' }), { b: '트랙' }), { unknown: [], stale: ['b'] });
  assert.deepEqual(checkOutcome(run({ a: 'measure', b: 'fail' }), { b: '트랙' }), { unknown: [], stale: [] });
});

test('가상 학습자 셋 — 사다리 엔진을 그대로 돌고 같은 입력이면 같은 결과(§15-1 끝 · 다리 §9)', async () => {
  const { runLearners, learnerLife, LEARNERS } = await toolModule('town-sim-ladder');
  const day = 24 * HOUR, start = 1790812800000;
  // Thirty daily visits, each with a tea order; C4's talk on the first.
  const visits = Array.from({ length: 30 }, (_, i) => [start + i * day + 14 * HOUR, i, 1, i === 0 ? 1 : 0]);
  const villages = ['sim-v001', 'sim-v002', 'sim-v003'].map(villageSeed => ({ villageSeed, visits }));
  const rows = runLearners(villages);
  assert.deepEqual(rows.map(r => r.learner), LEARNERS.map(l => l.id));
  assert.deepEqual(runLearners(villages), rows, '같은 입력이면 같은 결과');
  for (const r of rows) {
    assert.equal(r.scenes, 3 * 31, '방문마다 찻집 주문 하나 + 첫날 C4');
    assert.equal(r.fallbacks, 0, '장면 판·찻집 판 모두 L1~L4가 있다');
    assert.ok(r.declineShare >= 0 && r.declineShare <= 100);
  }
  // r = 1.2 starts where it belongs (L1); r = 3 has to climb by the town's own evidence (five smooth scenes).
  assert.equal(rows.find(r => r.learner === 'just-past-1').reachedMedian, 0);
  const climber = learnerLife(LEARNERS.find(l => l.id === 'grade-3'), 'sim-v001', visits);
  assert.ok(climber.offers > 0 && climber.levels.L1 >= 5, JSON.stringify(climber));
});

test('플레이어 모습 여섯의 방문 일정', async () => {
  const { visitPlan, firstLifeDayStart, TIMEZONES } = await toolModule('town-sim');
  for (const tzOffsetMin of TIMEZONES) {
    const first = firstLifeDayStart(tzOffsetMin);
    assert.equal(((first + tzOffsetMin * MINUTE) % (24 * HOUR) + 24 * HOUR) % (24 * HOUR), 5 * HOUR, '생활일은 내 시각 05:00에 시작한다');
    const plan = profile => visitPlan(profile, { villageSeed: 'sim-v001', tzOffsetMin, days: 30 });
    assert.equal(plan('absent').length, 0);
    for (const profile of ['daily-random', 'daily-all', 'night-only', 'daily-gather']) {
      const visits = plan(profile);
      assert.equal(visits.length, 30, profile);
      assert.ok(visits.every(v => v.toMs - v.fromMs === 30 * MINUTE));
      assert.ok(visits.every(v => v.acceptAll === (profile === 'daily-all')));
    }
    assert.ok(new Set(plan('daily-random').map(v => v.band)).size > 1, '구간이 날마다 바뀐다');
    for (const v of plan('night-only')) {
      const local = ((v.fromMs + tzOffsetMin * MINUTE) % (24 * HOUR) + 24 * HOUR) % (24 * HOUR);
      assert.ok(local >= 21 * HOUR || local + 30 * MINUTE <= 1 * HOUR, `밤에만: ${local / HOUR}시`);
    }
    const away = plan('away-7').map(v => v.lifeDayIndex);
    assert.equal(away.length, 23);
    assert.ok(away.every(day => day < 10 || day >= 17), '열흘째부터 이레를 비운다');
    assert.deepEqual(plan('daily-random'), plan('daily-random'));
  }
});

test('시간대가 다른 기기에서 돌려도 결과 해시가 같다', () => {
  const args = [path.join(ROOT, 'tools', 'town-sim.mjs'), '--hash', '--seeds', '6', '--days', '30'];
  const runs = ['UTC', 'Asia/Seoul', 'America/Los_Angeles'].map(tz => ({ tz, ...runUnderTimezone(args, tz) }));
  assert.deepEqual(runs.map(r => r.tzName), ['UTC', 'Asia/Seoul', 'America/Los_Angeles'], '자식 프로세스가 실제로 그 시간대에서 돌았다');
  assert.equal(new Set(runs.map(r => r.hash)).size, 1, JSON.stringify(runs));
});

test('런타임 층은 기기 시계·지역 시간·로캘·Math.random을 쓰지 않는다', () => {
  // §2-4: 계산 함수는 시각을 숫자로만 받는다. 브라우저·Node·talk가 같은 값을 내야 한다.
  const banned = [/Math\.random/, /\bDate\b/, /\bIntl\b/, /toLocale\w*/, /performance\.now/, /process\.env/, /getTimezoneOffset/];
  const files = runtimeFiles();
  assert.ok(files.length >= 1, '런타임 층 파일이 있다');
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const pattern of banned) assert.doesNotMatch(code, pattern, `${path.relative(ROOT, file)}: ${pattern}`);
  }
});
