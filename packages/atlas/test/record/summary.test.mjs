// 기기가 받은 요약을 얹는 장면(src/record/summary.mjs applyDelta · log.mjs receive — GPT 끝 판 GD1 · GD2).
// 부분 답은 그 답을 부른 기준 요약 위에서만 얹고, 같은 판 묶음의 늦게 온 옛 답은 지금 요약을 되돌리지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';
import { T0 } from '../support/trail-world.mjs';

const { applyDelta, genTime, headOrder } = await subject('record/summary.mjs');
const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');

const line = (key, at) => ({ kind: 'family', key, value: { at, bits: 1, skills: ['s'] } });
const reply = (edition, { full, lineSeq, foldedUntil, lines }) => ({
  edition,
  full,
  lineSeq,
  foldedUntil,
  issued: [],
  lines,
});

test('부분 답은 기준 요약이 없거나 판 묶음이 다르면 얹지 않는다 — 앞 줄 없이 차례만 확정되지 않게(GD1)', () => {
  const partial = reply('E2', { full: false, lineSeq: 2, foldedUntil: 20, lines: [line('f2', 2)] });
  assert.equal(applyDelta(null, partial), null);
  const base = applyDelta(
    null,
    reply('E1', { full: true, lineSeq: 5, foldedUntil: 50, lines: [line('f1', 1)] }),
  );
  assert.equal(applyDelta(base, partial), null, '판 묶음이 다른 기준 위에도 얹지 않는다');
  const full = applyDelta(base, { ...partial, full: true });
  assert.deepEqual([...full.lines.family.keys()], ['f2'], '통째 답은 판 묶음이 달라도 갈아 끼운다');
});

test('같은 판 묶음의 늦게 온 옛 답은 지금 요약을 되돌리지 않는다(GD2)', () => {
  const current = applyDelta(
    null,
    reply('E1', { full: true, lineSeq: 2, foldedUntil: 20, lines: [line('f1', 2)] }),
  );
  const stale = reply('E1', { full: false, lineSeq: 1, foldedUntil: 10, lines: [line('f1', 1)] });
  assert.equal(applyDelta(current, stale), current);
  const same = reply('E1', { full: false, lineSeq: 2, foldedUntil: 15, lines: [] });
  assert.equal(applyDelta(current, same), current, '같은 차례에서 덜 접힌 답도');
  const fresh = applyDelta(
    current,
    reply('E1', { full: false, lineSeq: 3, foldedUntil: 30, lines: [line('f3', 3)] }),
  );
  assert.deepEqual([...fresh.lines.family.keys()].sort(), ['f1', 'f3'], '앞선 부분 답은 얹는다');
  assert.equal(fresh.lines.family.get('f1').at, 2);
});

// ── 세대 표지 gen(단계 4 계획 §18-5-4 — D1 · D2 · R17) ──
const genAt = (ms, tail = 'aaaaaaaa') => `${String(ms).padStart(13, '0')}.${tail}`;
const withGen = (summary, gen) => ({ ...summary, gen });

test('새 머리(다른 gen)의 통째 답은 줄 차례가 기기 것보다 작아도 갈아 끼운다(D1 — 다시 지은 머리 500 → 40)', () => {
  const old = applyDelta(
    null,
    withGen(
      reply('E1', { full: true, lineSeq: 500, foldedUntil: 900, lines: [line('f1', 1)] }),
      genAt(T0),
    ),
  );
  const rebuilt = withGen(
    reply('E1', { full: true, lineSeq: 40, foldedUntil: 30, lines: [line('f2', 2)] }),
    genAt(T0 + 60_000),
  );
  const next = applyDelta(old, rebuilt);
  assert.notEqual(next, old, '새 머리의 통째 답을 버리지 않는다');
  assert.equal(next.lineSeq, 40);
  assert.equal(next.gen, genAt(T0 + 60_000));
  assert.deepEqual([...next.lines.family.keys()], ['f2'], '옛 머리의 줄은 남지 않는다');
  const partial = withGen(
    reply('E1', { full: false, lineSeq: 41, foldedUntil: 31, lines: [line('f3', 3)] }),
    genAt(T0 + 120_000),
  );
  assert.equal(
    applyDelta(next, partial),
    null,
    '새 머리의 부분 답은 얹지 않는다(다음 요청이 통째로)',
  );
});

test('옛 머리(작은 gen)의 답은 통째든 부분이든 지금 요약을 되돌리지 않는다(D2)', () => {
  const current = applyDelta(
    null,
    withGen(
      reply('E1', { full: true, lineSeq: 3, foldedUntil: 30, lines: [line('f2', 2)] }),
      genAt(T0 + 60_000),
    ),
  );
  for (const full of [true, false]) {
    const late = withGen(
      reply('E1', { full, lineSeq: 900, foldedUntil: 999, lines: [line('f1', 1)] }),
      genAt(T0),
    );
    assert.equal(applyDelta(current, late), current, `옛 머리의 ${full ? '통째' : '부분'} 답`);
  }
});

test('gen이 없는 요약(gen 전에 받은 것)은 가장 작은 머리다 — 같은 밀리초의 다른 gen은 뒤에 온 답이 이긴다(R17)', () => {
  const bare = applyDelta(
    null,
    reply('E1', { full: true, lineSeq: 9, foldedUntil: 90, lines: [line('f1', 1)] }),
  );
  assert.equal(bare.gen, undefined, 'gen 없는 답은 gen 칸이 없다');
  const fresh = withGen(
    reply('E1', { full: true, lineSeq: 2, foldedUntil: 20, lines: [line('f2', 2)] }),
    genAt(T0),
  );
  const replaced = applyDelta(bare, fresh);
  assert.equal(replaced.gen, genAt(T0), 'gen 있는 통째 답이 gen 없는 요약을 갈아 끼운다');
  const stale = reply('E1', { full: true, lineSeq: 99, foldedUntil: 990, lines: [line('f9', 9)] });
  assert.equal(applyDelta(replaced, stale), replaced, 'gen 없는 답은 gen 있는 요약을 덮지 않는다');
  const twin = withGen(
    reply('E1', { full: true, lineSeq: 1, foldedUntil: 10, lines: [line('f3', 3)] }),
    genAt(T0, 'bbbbbbbb'),
  );
  assert.equal(applyDelta(replaced, twin).gen, genAt(T0, 'bbbbbbbb'), '같은 밀리초의 다른 머리');
  assert.equal(headOrder({ gen: genAt(T0) }, { gen: genAt(T0) }), 0);
  assert.equal(genTime('잘못된 꼴'), Number.NEGATIVE_INFINITY);
});

test('기록부: 포트에서 읽을 때도 새 머리의 요약이 이기고(줄 차례가 작아도), since는 gen을 싣고 gen 없는 요약이면 싣지 않는다', async () => {
  const port = memoryPort();
  const record = await openRecord({ port, revision: 1, memory, params: PARAMS, now: () => T0 });
  const edition = record.edition();
  assert.equal(record.since(), null, '요약이 없으면 통째로');
  await record.receive({
    summary: reply(edition, { full: true, lineSeq: 7, foldedUntil: 70, lines: [line('f1', 1)] }),
  });
  assert.deepEqual(record.since(), { edition, seq: 7 }, 'gen 없는 요약이면 since에 gen이 없다');
  await record.receive({
    summary: withGen(
      reply(edition, { full: true, lineSeq: 500, foldedUntil: 900, lines: [line('f1', 1)] }),
      genAt(T0),
    ),
  });
  // 다른 탭이 새 머리의 요약을 덧붙였다(줄 차례 40) — 다시 열면 그것이 서야 한다.
  const tab = await openRecord({ port, revision: 1, memory, params: PARAMS, now: () => T0 });
  await tab.receive({
    summary: withGen(
      reply(edition, { full: true, lineSeq: 40, foldedUntil: 30, lines: [line('f2', 2)] }),
      genAt(T0 + 60_000),
    ),
  });
  const reopened = await openRecord({ port, revision: 1, memory, params: PARAMS, now: () => T0 });
  assert.equal(reopened.summary.lineSeq, 40);
  assert.deepEqual(reopened.since(), { edition, seq: 40, gen: genAt(T0 + 60_000) });
});

test('기록부는 달라진 것이 없는 답(GET)으로 기록을 쓰지 않는다 — 빈 표지가 쌓이지 않고 다른 탭을 깨우지 않는다(B5)', async () => {
  const port = memoryPort();
  const record = await openRecord({ port, revision: 1, memory, params: PARAMS, now: () => T0 });
  const edition = record.edition();
  const summary = withGen(
    reply(edition, { full: true, lineSeq: 2, foldedUntil: 20, lines: [line('f1', 2)] }),
    genAt(T0),
  );
  await record.receive({ summary, serverTime: T0 + 5000 });
  const rows = (await port.read()).length;
  await record.receive({ summary, serverTime: T0 + 9000 });
  await record.receive({ summary: { ...summary, full: false, lines: [] }, serverTime: T0 + 9000 });
  assert.equal((await port.read()).length, rows, '같은 요약 · 빈 부분 답은 기록을 늘리지 않는다');
  assert.ok(record.clock.offsetMs > 8000, '서버 시각과의 차이는 맞춘다');
});

test('기록부는 얹을 수 없는 부분 답 · 늦은 옛 답으로 요약 기록을 새로 쓰지 않는다', async () => {
  const port = memoryPort();
  const record = await openRecord({ port, revision: 1, memory, params: PARAMS, now: () => T0 });
  const edition = record.edition();
  await record.receive({
    summary: reply(edition, { full: false, lineSeq: 2, foldedUntil: 20, lines: [line('f2', 2)] }),
  });
  assert.equal(record.summary, null, '기준 없는 부분 답은 얹지 않는다(다음 요청이 통째로)');
  await record.receive({
    summary: reply(edition, { full: true, lineSeq: 2, foldedUntil: 20, lines: [line('f1', 2)] }),
  });
  await record.receive({
    summary: reply(edition, { full: false, lineSeq: 1, foldedUntil: 10, lines: [line('f1', 1)] }),
  });
  assert.equal(record.summary.lineSeq, 2);
  assert.equal(record.summary.lines.family.get('f1').at, 2);
  const summaries = (await port.read()).filter(row => row.value.kind === 'summary');
  assert.equal(summaries.length, 1, '요약 기록은 하나뿐');
});
