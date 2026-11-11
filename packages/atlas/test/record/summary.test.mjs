// 기기가 받은 요약을 얹는 장면(src/record/summary.mjs applyDelta · log.mjs receive — GPT 끝 판 GD1 · GD2).
// 부분 답은 그 답을 부른 기준 요약 위에서만 얹고, 같은 판 묶음의 늦게 온 옛 답은 지금 요약을 되돌리지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';
import { T0 } from '../support/trail-world.mjs';

const { applyDelta } = await subject('record/summary.mjs');
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
