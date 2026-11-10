// 기기 ↔ 메모리 서버 — 패키지 시험이 올리기 · 요약 받기를 서버 없이 돌린다(SYNK-talk의 view=trail과 같은 뜻).
import { subject } from './subject.mjs';
import { createMemoryAccount, T0 } from './trail-world.mjs';

const S = await subject('record/server.mjs');
const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');
const { EMPTY_INDEX } = await subject('record/adapt.mjs');

export const memory = createMemory(PARAMS);
export { PARAMS };

export function createServer({ random, index = EMPTY_INDEX, foldChance = 1 }) {
  const server = createMemoryAccount();
  let now = T0;
  const self = {
    server,
    index,
    get now() {
      return now;
    },
    tick(ms) {
      now += ms;
    },
    async fold(cap = 1 + Math.floor(random() * 8)) {
      for (let guard = 0; guard < 10_000; guard += 1) {
        const result = await S.foldAccount(server.account, {
          memory,
          params: PARAMS,
          index: self.index,
          nowMs: now,
          cap,
        });
        if (result.done && !result.building) return result;
      }
      throw new Error('접기가 끝나지 않는다');
    },
    async summary(since) {
      const active = await server.account.active();
      if (!active) return null;
      return S.summaryOf(server.account.store(active.edition), { edition: active.edition, since });
    },
    // 2판 올리기(view=trail). 같은 번호는 한 번만 넣는다. 접기는 foldChance로 일부러 건너뛴다(접기 실패).
    async post(events, since) {
      now += Math.floor(random() * 3 * 60_000);
      const known = new Map(server.log().map(r => [r.event.id, r]));
      const fresh = events.filter(event => !known.has(event.id));
      const records = server.append(fresh, now);
      for (const record of records) known.set(record.event.id, record);
      if (random() < foldChance) await self.fold();
      const accepted = events.map(event => ({ id: event.id, seq: known.get(event.id).seq }));
      const clamped = S.clampedOf(events.map(event => known.get(event.id)));
      return { accepted, clamped, summary: await self.summary(since), serverTime: now };
    },
    // 옛 판 기기(옛 POST) — 접기는 다음 읽기에서.
    legacy(events) {
      now += Math.floor(random() * 60_000);
      return server.append(events, now);
    },
  };
  return self;
}

// 기기 하나 — 기록부 + 시계 어긋남(drift). 서버 시각을 받으면 기기 시계가 그 차이를 고친다.
export async function createClient(
  server,
  {
    name,
    revision = 1,
    drift = 0,
    port = memoryPort(),
    health = null,
    index = server.index,
    pull = true,
  },
) {
  const record = await openRecord({
    port,
    revision,
    memory,
    params: PARAMS,
    index,
    health,
    now: () => server.now + drift,
    tag: name.padEnd(8, '0').slice(0, 8),
  });
  const client = {
    name,
    record,
    port,
    stores: [],
    device: {
      name,
      time: () => record.clock.lastAt,
      make(type, fields) {
        const { event, stored } = record.add(type, fields);
        client.stores.push(stored);
        return event;
      },
    },
    async settle() {
      await Promise.all(client.stores.splice(0));
    },
    since() {
      const summary = record.summary;
      return summary ? { edition: summary.edition, seq: summary.lineSeq } : null;
    },
    async push(limit = 256) {
      await client.settle();
      const events = record.unsent(limit);
      if (!events.length) return null;
      const reply = await server.post(events, client.since());
      await record.receive(reply);
      return reply;
    },
    async pull() {
      await client.settle();
      await server.fold();
      const summary = await server.summary(client.since());
      if (summary) await record.receive({ summary, serverTime: server.now });
    },
  };
  if (pull) await client.pull();
  return client;
}
