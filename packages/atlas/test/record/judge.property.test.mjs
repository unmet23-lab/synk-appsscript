// 측정 계약은 그대로(설계 §5-2) — 임의의 옛 꼴 기록을 지금 atlas/trail.js의 summarize와 새 접기에 함께 넣어,
// 「새 접기의 측정 자격(그 계열의 첫 만남 · 도움 없음 · 판정됨)」인 답 = 「지금 Trail의 독립 근거(independent)」인 답.
// 지금 판정기는 옛 atlas/(얼린 판 — 전환 뒤 지울 코드)에서 읽는다. 패키지 밖이라 실제 패키지 자리(PACKAGE_ROOT)로 찾는다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { seedRange } from '../support/seeds.mjs';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';
import {
  bank,
  createLegacyDevice,
  newState,
  rng,
  stepDevice,
  T0,
} from '../support/trail-world.mjs';

const require = createRequire(import.meta.url);
const Trail = require(path.join(PACKAGE_ROOT, '..', '..', 'atlas', 'trail.js'));
const { entryOf } = await subject('record/server.mjs');
const { groupsOf, serverKey } = await subject('record/adapt.mjs');
const { rowsOfGroup, toMark, groupBy } = await subject('record/rows.mjs');
const { skillRowsOf } = await subject('fold/server.mjs');

const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };

function measuredByFold(entries) {
  const rows = [...groupsOf(entries).values()].flatMap(group => rowsOfGroup(group));
  const families = groupBy(
    rows.filter(r => r.kind === 'meet' || r.kind === 'carry'),
    r => r.family,
  );
  const out = new Set();
  for (const list of families.values())
    for (const row of skillRowsOf(list.map(toMark)))
      if (row.lead && row.unaided && row.grade != null) out.add(row.id);
  return out;
}

test('새 접기의 측정 자격 = 지금 Trail의 독립 근거(임의의 옛 꼴 기록 — 도움 · 답 보기 · 전달 · 가림 · 사유 · 제외 · 다시 만남)', () => {
  let measured = 0;
  for (const seed of seedRange({ count: 300 })) {
    const random = rng(seed);
    const ctx = { items: bank(random) };
    const device = createLegacyDevice('old', { random });
    const state = newState();
    const events = [];
    const steps = 10 + Math.floor(random() * 50);
    for (let i = 0; i < steps; i += 1) events.push(...stepDevice(device, state, ctx, random));
    const summary = Trail.summarize(events, { scope, asOf: new Date(T0 + 1e10).toISOString() });
    const keyOf = new Map(events.map((event, i) => [event.id, serverKey(i + 1, event)]));
    const old = new Set(summary.attempts.filter(a => a.independent).map(a => keyOf.get(a.eventId)));
    const entries = events.map((event, i) =>
      entryOf({ seq: i + 1, receivedMs: Number.MAX_SAFE_INTEGER, event }),
    );
    const now = measuredByFold(entries);
    assert.deepEqual([...now].sort(), [...old].sort(), `씨앗 ${seed}`);
    measured += old.size;
  }
  assert.ok(measured > 50, `독립 근거가 충분히 나와야 시험이 뜻이 있다(${measured})`);
});
