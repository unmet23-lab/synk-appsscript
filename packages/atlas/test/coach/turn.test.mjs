// 차례(src/coach/turn.mjs — 단계 4 계획 §18-5-1 R1 · R2): 일 하나 동안만 쥐었다 놓는 저장소 자물쇠. 일마다 한도 · 못 얻었을 때 ·
// 못 얻는 일이 이어질 때의 표, 「차례 안」 표시, 닫을 때 기다리던 청하기 거두기, 차례가 없는 브라우저.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { fakeLocks } from './support.mjs';

const { createTurn, TURN_JOBS, STREAK_COUNT } = await subject('coach/turn.mjs');

// 시험용 짧은 한도 — 표의 갈래(miss · streak)는 그대로.
const SHORT = Object.fromEntries(
  Object.entries(TURN_JOBS).map(([job, rule]) => [job, { ...rule, wait: 20 }]),
);
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

test('차례가 없는 브라우저(Web Locks 없음)는 모든 일을 차례 규칙만으로 한다 — 「차례 안」 표시는 켠다', async () => {
  const marks = [];
  const turn = createTurn({
    name: 's',
    locks: null,
    enter: () => marks.push('in'),
    leave: () => marks.push('out'),
  });
  for (const job of Object.keys(TURN_JOBS)) assert.equal(await turn(job, async () => job), job);
  assert.equal(marks.length, Object.keys(TURN_JOBS).length * 2);
  assert.throws(() => turn('모르는 일', async () => {}), TypeError);
});

test('얻으면 일 하나 동안만 쥐고 놓는다 — 일의 오류는 그대로 올라오고 못 얻음으로 세지 않는다', async () => {
  const locks = fakeLocks();
  const turn = createTurn({ name: 's', locks, jobs: SHORT });
  assert.equal(await turn('upload', async () => (locks.held('s') ? '쥠' : '안 쥠')), '쥠');
  assert.equal(locks.held('s'), false, '일이 끝나면 놓는다');
  await assert.rejects(
    turn('get', async () => Promise.reject(new Error('망'))),
    /망/,
  );
  assert.equal(turn.misses('get'), 0);
});

test('못 얻으면 일마다 표대로 — 올리기 · 받기 · 요약 저장 · 치우기 · 옮기기는 이번을 쉬고(TURN_BUSY), 옛 기록 옮기기는 차례 없이 한다', async () => {
  const locks = fakeLocks();
  const release = locks.hold('s'); // 다른 탭이 쥐고 안 놓는다
  const turn = createTurn({ name: 's', locks, jobs: SHORT });
  for (const job of ['upload', 'get', 'summary', 'compact', 'move'])
    await assert.rejects(
      turn(job, async () => job),
      { code: 'TURN_BUSY', job },
    );
  assert.equal(
    await turn('legacy', async () => '옮김'),
    '옮김',
    'coach.ready가 기다리는 일 — 차례 없이',
  );
  release();
});

test('못 얻는 일이 이어지면(3번) 올리기 · 받기 · 요약 저장은 기다리지 않고 차례 없이 하고, 치우기 · 옮기기는 이어져도 쉰다(R2)', async () => {
  const locks = fakeLocks();
  const release = locks.hold('s');
  const turn = createTurn({ name: 's', locks, jobs: SHORT });
  for (let i = 0; i < STREAK_COUNT; i += 1) {
    await assert.rejects(
      turn('upload', async () => {}),
      { code: 'TURN_BUSY' },
    );
    await assert.rejects(
      turn('compact', async () => {}),
      { code: 'TURN_BUSY' },
    );
  }
  const started = Date.now();
  assert.equal(await turn('upload', async () => (locks.held('s') ? '남이 쥠' : '?')), '남이 쥠');
  assert.ok(Date.now() - started < 15, '이어진 뒤에는 한도를 기다리지 않는다');
  await assert.rejects(
    turn('compact', async () => {}),
    { code: 'TURN_BUSY' },
    '치우기는 차례 없이 하지 않는다',
  );
  release();
  await tick();
  // 비면 다시 쥔다 — 이어짐이 끝난다.
  assert.equal(await turn('upload', async () => (locks.held('s') ? '쥠' : '안 쥠')), '쥠');
  assert.equal(turn.misses('upload'), 0);
});

test('60초 동안 못 얻으면 세 번이 안 되어도 이어진 것으로 본다', async () => {
  const locks = fakeLocks();
  const release = locks.hold('s');
  let clock = 0;
  const turn = createTurn({ name: 's', locks, jobs: SHORT, now: () => clock });
  await assert.rejects(
    turn('get', async () => {}),
    { code: 'TURN_BUSY' },
  );
  clock = 60_000;
  assert.equal(await turn('get', async () => '받음'), '받음');
  release();
});

test('청하기 자체가 거절되면(막힌 문맥의 SecurityError) 못 얻음으로 센다', async () => {
  const locks = {
    request: () => Promise.reject(Object.assign(new Error('막힘'), { name: 'SecurityError' })),
  };
  const turn = createTurn({ name: 's', locks, jobs: SHORT });
  await assert.rejects(
    turn('upload', async () => {}),
    { code: 'TURN_BUSY' },
  );
  assert.equal(turn.misses('upload'), 1);
  assert.equal(await turn('legacy', async () => '옮김'), '옮김');
});

// 시간 한도 — 거두지 않는 판에서는 기다리던 청하기가 끝나지 않는다(그 판을 잡아야 하는 시험이다).
test('호스트를 닫으면 기다리던 청하기를 거두고, 닫힌 뒤의 일은 하지 않는다', {
  timeout: 5000,
}, async () => {
  const locks = fakeLocks();
  const release = locks.hold('s');
  const turn = createTurn({
    name: 's',
    locks,
    jobs: { ...SHORT, upload: { ...SHORT.upload, wait: 60_000 } },
  });
  let ran = false;
  const waiting = turn('upload', async () => {
    ran = true;
  });
  await tick(5);
  turn.close();
  await assert.rejects(waiting, { code: 'TURN_BUSY' });
  await assert.rejects(
    turn('get', async () => {}),
    { code: 'TURN_BUSY' },
  );
  release();
  await tick(5);
  assert.equal(ran, false);
});

test('가짜 자물쇠는 쥔 일 안에서 같은 이름을 또 청한 것을 남기고, 놓은 뒤의 청하기는 세지 않는다(R1 시험의 눈)', async () => {
  const locks = fakeLocks();
  const turn = createTurn({ name: 's', locks, jobs: SHORT });
  let later = null;
  await turn('upload', async () => {
    later = new Promise(resolve => setTimeout(resolve, 5)).then(() =>
      turn('get', async () => '다음 바퀴'),
    );
  });
  assert.equal(await later, '다음 바퀴');
  assert.deepEqual(locks.reentered, [], '놓은 뒤 돈 청하기');
  await assert.rejects(
    turn('upload', () => turn('get', async () => '안')),
    { code: 'TURN_BUSY' },
    '안에서 또 청하면 앞이 놓을 때까지 기다려 한도에 걸린다',
  );
  assert.deepEqual(locks.reentered, ['s']);
});
