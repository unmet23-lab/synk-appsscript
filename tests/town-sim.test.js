'use strict';
// 싱크타운 결정적 시뮬레이션(세로 조각 설계 §15-1·§15-3) — 줄인 판(씨앗 12 × 30생활일)은 5초 안에 돌고,
// 같은 입력이면 몇 번을 돌려도, 어느 시간대의 기기에서 돌려도 결과 해시가 같다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { toolModule, runUnderTimezone, runtimeFiles, ROOT } = require('./lib/town.js');

const MINUTE = 60000, HOUR = 60 * MINUTE;

test('줄인 시뮬레이션은 제한 시간 안에 돌고 잰 지표가 모두 통과한다', async () => {
  const { runSimulation, summarize, METRICS } = await toolModule('town-sim');
  const started = Date.now();
  const result = runSimulation({ seeds: 12, days: 30 });
  // 설계 목표는 한가한 PC에서 5초(§15-5) — CI에서 다른 시험과 함께 돌 때도 넘지 않을 상한을 둔다.
  assert.ok(Date.now() - started < 15000, `${Date.now() - started}ms`);
  const s = summarize(result);
  assert.equal(s.villages, 12 * 4 * 5);
  assert.equal(s.fail, 0, result.metrics.filter(m => m.status === 'fail').map(m => `${m.label}: ${m.value}`).join(', '));
  const measured = ['meetable-residents', 'places-per-day', 'routine-variety', 'repetition', 'rain-outside', 'energy', 'mood-lines'];
  assert.deepEqual(result.metrics.filter(m => measured.includes(m.id)).map(m => m.status), measured.map(() => 'pass'), 'W3·W4가 재는 지표');
  assert.deepEqual(result.metrics.map(m => m.id), METRICS.map(m => m.id));
  assert.equal(runSimulation({ seeds: 12, days: 30 }).hash, result.hash, '같은 입력이면 같은 결과');
  assert.notEqual(runSimulation({ seeds: 13, days: 30 }).hash, result.hash);
});

test('플레이어 모습 다섯의 방문 일정', async () => {
  const { visitPlan, firstLifeDayStart, TIMEZONES } = await toolModule('town-sim');
  for (const tzOffsetMin of TIMEZONES) {
    const first = firstLifeDayStart(tzOffsetMin);
    assert.equal(((first + tzOffsetMin * MINUTE) % (24 * HOUR) + 24 * HOUR) % (24 * HOUR), 5 * HOUR, '생활일은 내 시각 05:00에 시작한다');
    const plan = profile => visitPlan(profile, { villageSeed: 'sim-v001', tzOffsetMin, days: 30 });
    assert.equal(plan('absent').length, 0);
    for (const profile of ['daily-random', 'daily-all', 'night-only']) {
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
