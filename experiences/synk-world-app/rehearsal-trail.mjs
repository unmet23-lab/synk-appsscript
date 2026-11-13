// 리허설 전용 Atlas 새 기록 길(재설계 단계 4 계획 §18-2 11 · §18-5-7 ④). 리허설 서버(server.mjs)가 /api/world/rehearsal/trail ·
// trail-clear · trail-account · trail-control을 이리로 보낸다. talk의 learning?view=trail(SYNK-talk lib/atlas-trail-route.js ·
// lib/atlas-trail-service.js)과 같은 검사 · 같은 답 꼴을 합성 계정의 메모리 기록으로 흉내 낸다 — 접기 · 요약은 엔진 묶음의 서버 접기
// (foldAccount · summaryOf · newGen, talk가 쓰는 것과 같은 코드)로 한다. 운영 경로가 아니다: 합성 계정(player-a · player-b)만 있고,
// 서버를 내리면 기록이 사라진다. 진짜 talk 끝점으로 보는 것은 4-8(시험 계정 하나에 SYNK_ATLAS_TRAIL · READERS_FENCED 참 뒤).
//
// 계정마다 흉내 내는 상태: 동의(learning.enabled) · 동의 판(learning.revision — talk처럼 동의를 켜고 끌 때마다 · 비울 때 오른다) ·
// 쓰기 문(capabilities.learningSync) · 서버 스위치(SYNK_ATLAS_TRAIL). 셸은 trail-account로 앞의 셋을 읽고(운영의 계정 읽기 자리),
// 스위치는 운영처럼 GET의 403 FEATURE_DISABLED로만 안다. trail-control은 리허설 시험 · 브라우저 한 바퀴가 이 넷을 바꾸는 손잡이다.
// trail-legacy는 talk의 옛 POST(learning — synk-server.js)의 흉내다: 손님 → 계정 옮기기의 옛 꼴 사건(§18-5-3 ②)을 같은 사건 기록에 더하고,
// 서버 접기가 다음 읽기 · 올리기에서 옛 꼴로 접는다. 옛 POST처럼 스위치 뒤가 아니고, 부모 확인은 하지 않는다(리허설 — 짝은 기기가 고른다).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ID = /^[a-zA-Z0-9_.:-]{1,120}$/;
const EDITION = /^[A-Za-z0-9_.:+-]{1,200}$/;
const GEN = /^[0-9]{13}\.[0-9a-z]{8}$/;
const MAX_BATCH = 256;
export const MAX_BODY = 262_144; // talk 입구의 본문 상한과 같다 — 넘으면 리허설 서버가 413
export const TRAIL_PATHS = Object.freeze(['trail', 'trail-clear', 'trail-account', 'trail-control', 'trail-legacy']);
// 옛 꼴 사건의 범위(talk synk-server.js — 계정 · 손님 모두 같다).
const LEGACY_SCOPE = { domain: 'LAB', workspace: 'learning', subject: 'device' };

const fail = (status, code, extra = {}) => {
  throw Object.assign(new Error(code), { status, code, ...extra });
};
const integer = value => Number.isSafeInteger(value) && value >= 0;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, form) => typeof value === 'string' && form.test(value);
const stable = value =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, v[k]]),
        )
      : v,
  );

// since = { edition, seq, gen? } — talk sinceOf와 같다(edition · gen은 문자열만, 모르는 열쇠는 400).
function sinceOf(value) {
  if (value == null) return null;
  if (
    !plain(value) ||
    Object.keys(value).some(k => !['edition', 'seq', 'gen'].includes(k)) ||
    !text(value.edition, EDITION) ||
    !integer(value.seq) ||
    (value.gen != null && !text(value.gen, GEN))
  )
    fail(400, 'INVALID_SINCE');
  return { edition: value.edition, seq: value.seq, ...(value.gen != null ? { gen: value.gen } : {}) };
}

// ── 메모리 계정(엔진 서버 접기의 포트 — talk lib/atlas-trail-store.js와 같은 뜻) ─────────────────────────────
// 엔진 패키지 시험 도우미(packages/atlas/test/support/trail-world.mjs createMemoryAccount)와 같은 포트다. 줄 값은 SQL 저장소(jsonb)처럼
// 열쇠를 길이 · 글자 순으로 바꿔 돌려준다 — 견주기가 열쇠 차례에 기대지 않게.
const jsonbOrder = value =>
  Array.isArray(value)
    ? value.map(jsonbOrder)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
            .map(key => [key, jsonbOrder(value[key])]),
        )
      : value;

function memoryAccount(atlas) {
  const T = atlas.EVENT_TYPES;
  const isSource = event =>
    event.type === T.presented ||
    (event.schema === atlas.EVENT_FORM.current && (event.type === T.stated || event.type === T.carried));
  const log = [];
  const heads = new Map();
  let seq = 0;
  let floor = 0;
  const visible = () => log.filter(record => record.seq > floor);

  function port(head) {
    const allRows = () => [...head.rows.values()].flat();
    const lineKey = (kind, key) => `${kind}\u0000${key}`;
    return {
      head: async () => ({
        foldedUntil: head.foldedUntil,
        floorSeq: floor,
        lineSeq: head.lineSeq,
        issued: structuredClone(head.issued),
        gen: head.gen ?? null,
      }),
      writeHead: async patch => Object.assign(head, structuredClone(patch)),
      entriesAfter: async (after, limit) =>
        visible()
          .filter(record => record.seq > after)
          .slice(0, limit),
      maxSeq: async () => seq,
      eventById: async (id, until = Infinity) =>
        visible().find(record => record.event.id === id && record.seq <= until) ?? null,
      presentationsOf: async (decisionId, until = Infinity) =>
        visible().filter(
          r => r.seq <= until && r.event.type === T.presented && r.event.decisionId === decisionId,
        ),
      group: async (sourceId, until = Infinity) => {
        const all = visible().filter(record => record.seq <= until);
        const source = all.find(r => r.event.id === sourceId && isSource(r.event));
        if (!source) return null;
        const children = all.filter(r => r.event.presentationId === sourceId);
        const ids = new Set([sourceId, ...children.map(r => r.event.id)]);
        if (source.event.schema === 1 && source.event.decisionId) ids.add(source.event.decisionId);
        const exclusions = all.filter(r => r.event.type === T.excluded && ids.has(r.event.targetId));
        return { source, children, exclusions };
      },
      rowsOf: async source => structuredClone(head.rows.get(source) ?? []),
      replaceRows: async (source, rows) => {
        if (rows.length) head.rows.set(source, structuredClone(rows));
        else head.rows.delete(source);
      },
      unitRows: async unit =>
        structuredClone(allRows().filter(r => (r.kind === 'unit' || r.kind === 'say') && r.unit === unit)),
      familyRows: async family =>
        structuredClone(allRows().filter(r => (r.kind === 'meet' || r.kind === 'carry') && r.family === family)),
      familiesOfSkill: async skill => [
        ...new Set(
          allRows()
            .filter(r => r.kind === 'meet' && r.skill === skill)
            .map(r => r.family),
        ),
      ],
      lines: async (kind, keys) =>
        new Map(
          keys
            .filter(key => head.lines.has(lineKey(kind, key)))
            .map(key => [key, jsonbOrder(head.lines.get(lineKey(kind, key)).value)]),
        ),
      writeLines: async changes => {
        for (const { kind, key, value } of changes) {
          head.lineSeq += 1;
          head.lines.set(lineKey(kind, key), { kind, key, value: structuredClone(value), seq: head.lineSeq });
        }
      },
      linesSince: async after =>
        [...head.lines.values()]
          .filter(line => line.seq > after)
          .sort((a, b) => a.seq - b.seq)
          .map(line => structuredClone(line)),
    };
  }

  const account = {
    active: async () => {
      const head = [...heads.values()].find(h => h.state === 'active');
      return head ? { edition: head.edition } : null;
    },
    head: async edition => (heads.has(edition) ? { ...heads.get(edition) } : null),
    // 이미 있으면 그대로(talk의 on conflict do nothing — gen을 덮지 않는다).
    create: async (edition, state, { gen = null } = {}) => {
      if (heads.has(edition)) return;
      heads.set(edition, {
        edition,
        state,
        gen,
        foldedUntil: 0,
        lineSeq: 0,
        issued: [],
        rows: new Map(),
        lines: new Map(),
      });
    },
    store: edition => port(heads.get(edition)),
    activate: async edition => {
      for (const key of [...heads.keys()]) if (key !== edition) heads.delete(key);
      heads.get(edition).state = 'active';
    },
  };

  return {
    account,
    hasHead: edition => heads.has(edition),
    // 같은 번호를 찾는다 — 사건 번호는 계정 안에서 하나(talk의 고유 열쇠), 바닥 아래 남은 사건도 본다.
    byIds: ids => new Map(log.filter(r => ids.includes(r.event.id)).map(r => [r.event.id, r])),
    visible,
    // revision: 옛 POST가 받은 판(옛 꼴 사건은 사건에 판이 없다 — talk처럼 기록에 적는다, 넘친 #8).
    append(events, receivedMs, revision = null) {
      return events.map(event => {
        seq += 1;
        const record = { seq, receivedMs, event: structuredClone(event), ...(revision == null ? {} : { revision }) };
        log.push(record);
        return record;
      });
    },
    // 비우기(talk engine.clear_synk_practice) — 리허설에는 교실 연결 · 첫걸음 점수가 없어 남길 사건이 없다. 머리를 모두 지우고
    // 바닥 = 지우기 전 마지막 차례를 적는다(저장소는 바닥 아래를 돌려주지 않는다).
    clear() {
      const removed = log.length;
      log.length = 0;
      floor = Math.max(floor, seq);
      heads.clear();
      return { removed, kept: 0 };
    },
  };
}

// ── 서버 스위치(talk trailSwitch와 같은 뜻) — 'on'(리허설 기본) · 'off' · 쉼표 목록(합성 계정 이름 player-a 또는 id) ──────────
function switchOf(raw, keys) {
  const value = String(raw ?? 'on').trim();
  if (!value || value === 'on') return () => true;
  if (value === 'off') return () => false;
  const allowed = new Set(
    value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
      .map(v => (Object.hasOwn(keys, v) ? keys[v] : v).toLowerCase()),
  );
  return id => allowed.has(String(id).toLowerCase());
}

// atlas: 엔진 입구(src/index.mjs 또는 그 묶음 atlas.mjs) · index: 접기의 문항 색인(openMap(…).foldIndex) · now: 서버 시각(시험만 준다).
export function createRehearsalTrail({
  atlas,
  index = atlas.EMPTY_INDEX,
  now = () => Date.now(),
  trailSwitch = 'on',
  keys = {},
  cap = atlas.FOLD_CAP,
  warn = message => console.warn(message),
  firstRevision = 1, // 합성 계정을 처음 만들 때의 판(서버를 켤 때 openRehearsalTrail이 켠 시각으로 준다 — 넘친 #9)
  onRevision = null, // 판을 내줄 때마다(계정을 만들 때 · 오를 때) — openRehearsalTrail이 마지막 판을 적어 다음 켤 때 그 뒤부터 시작한다(넘친 #10)
}) {
  const params = atlas.PARAMS;
  const memory = atlas.createMemory(params);
  const edition = atlas.foldEdition(params, index);
  const switchOn = switchOf(trailSwitch, keys);
  const accounts = new Map();
  const issued = revision => {
    try {
      onRevision?.(revision);
    } catch {
      // 적어 두기 실패는 리허설을 막지 않는다
    }
  };
  const bump = entry => {
    entry.revision += 1;
    issued(entry.revision);
  };

  function accountOf(id) {
    let entry = accounts.get(id);
    if (!entry) {
      entry = {
        id,
        revision: firstRevision,
        enabled: true,
        writes: true,
        on: switchOn(id),
        store: memoryAccount(atlas),
        lane: Promise.resolve(),
      };
      accounts.set(id, entry);
      issued(entry.revision);
    }
    return entry;
  }

  // 계정 잠금(talk withAccount)의 흉내 — 한 계정의 요청은 한 줄로 돈다(접기 도중 다른 요청이 끼어 머리를 섞지 않게).
  function locked(entry, work) {
    const run = entry.lane.then(work);
    entry.lane = run.catch(() => {});
    return run;
  }

  async function fold(entry) {
    const account = entry.store.account;
    if (!(await account.active())) await account.create(edition, 'active', { gen: atlas.newGen(now()) });
    try {
      return { ...(await atlas.foldAccount(account, { memory, params, index, nowMs: now(), cap })), ok: true };
    } catch (error) {
      // talk는 savepoint로 되돌리고 「받았다, 접지 못했다」로 답한다. 메모리에는 되돌리기가 없어 알리기만 한다(엔진 오류를 리허설에서 보이게).
      warn(`rehearsal trail: 접기 실패 ${entry.id} ${error?.code ?? error?.message ?? error}`);
      return { served: (await account.active())?.edition ?? null, ok: false };
    }
  }

  async function summary(entry, served, since) {
    if (!served || !entry.store.hasHead(served)) return null;
    return atlas.summaryOf(entry.store.account.store(served), { edition: served, since });
  }

  function checkBatch(body, revision) {
    if (
      !plain(body) ||
      Object.keys(body).some(k => !['revision', 'events', 'since'].includes(k)) ||
      !Array.isArray(body.events) ||
      !body.events.length ||
      body.events.length > MAX_BATCH
    )
      fail(400, 'INVALID_EVENTS');
    const ids = new Set();
    for (const event of body.events) {
      if (!plain(event) || !text(event.id, ID) || ids.has(event.id)) fail(400, 'INVALID_EVENTS');
      ids.add(event.id);
    }
    const stale = body.events.filter(event => event.revision !== revision).map(event => event.id);
    if (stale.length) fail(409, 'EVENT_REVISION', { revision, ids: stale });
    try {
      for (const event of body.events) atlas.checkEvent(event);
    } catch {
      fail(400, 'INVALID_EVENTS');
    }
  }

  async function post(entry, body) {
    const revision = body.revision;
    checkBatch(body, revision);
    const since = sinceOf(body.since);
    const ids = body.events.map(e => e.id);
    const old = entry.store.byIds(ids);
    const fresh = [];
    const conflicts = [];
    for (const event of body.events) {
      const existing = old.get(event.id);
      if (existing && (existing.event.revision !== revision || stable(existing.event) !== stable(event)))
        conflicts.push(event.id);
      else if (!existing) fresh.push(JSON.parse(stable(event)));
    }
    if (conflicts.length) fail(409, 'EVENT_CONFLICT', { ids: conflicts });
    let rejected = [];
    if (fresh.length) {
      const known = new Map(entry.store.visible().map(r => [r.event.id, r.event]));
      let parts;
      try {
        parts = atlas.partitionLinks(fresh, {
          find: id => known.get(id) ?? null,
          attemptCount: id =>
            [...known.values()].filter(e => e.type === atlas.EVENT_TYPES.attempted && e.presentationId === id).length,
        });
      } catch {
        fail(400, 'INVALID_EVENTS');
      }
      rejected = parts.rejected;
      if (parts.ok.length) entry.store.append(parts.ok, now());
    }
    const folded = await fold(entry);
    const records = [...entry.store.byIds(ids).values()].sort((a, b) => a.seq - b.seq);
    const result = await summary(entry, folded.served, since);
    const last = records.reduce((max, r) => Math.max(max, r.seq), 0);
    return {
      ok: true,
      scope: 'synk-atlas-trail',
      revision,
      accepted: records.map(r => ({ id: r.event.id, seq: r.seq })),
      clamped: atlas.clampedOf(records),
      ...(rejected.length ? { rejected, rejectedCode: 'EVENT_LINK' } : {}),
      folded: Boolean(result && result.foldedUntil >= last),
      serverTime: now(),
      summary: result,
    };
  }

  async function read(entry, query) {
    const raw = query.get('since');
    const asked = query.has('since') || query.has('edition') || query.has('gen');
    if (asked && !/^(?:0|[1-9]\d{0,15})$/.test(raw ?? '')) fail(400, 'INVALID_SINCE');
    const since = asked
      ? sinceOf({
          edition: query.get('edition'),
          seq: Number(raw),
          ...(query.has('gen') ? { gen: query.get('gen') } : {}),
        })
      : null;
    const folded = await fold(entry);
    return {
      ok: true,
      scope: 'synk-atlas-trail',
      revision: entry.revision,
      serverTime: now(),
      summary: await summary(entry, folded.served, since),
    };
  }

  // 옛 POST(talk synk-server.js learning POST와 같은 검사 — 범위 · 번호 · 같은 번호의 다른 사건 · 다른 판에서 받은 같은 번호는 409
  // EVENT_CONFLICT, ids 없음). 받은 판을 적어 두고 견준다 — 판을 안 보면 talk의 409가 리허설에서는 통과로 보였다(Fable 5.2 끝 판 넘친 #8 ①).
  // 부모 · 차례 · 꼴 검사는 talk에만 있다(파일 머리 — 4-8 리허설 대조에서).
  function legacy(entry, body) {
    const ids = new Set();
    for (const event of body.events) {
      if (
        !plain(event) ||
        !text(event.id, ID) ||
        ids.has(event.id) ||
        event.schema !== 1 ||
        typeof event.type !== 'string' ||
        stable(event.scope) !== stable(LEGACY_SCOPE)
      )
        fail(400, 'INVALID_EVENTS');
      ids.add(event.id);
    }
    const old = entry.store.byIds([...ids]);
    const fresh = [];
    for (const event of body.events) {
      const existing = old.get(event.id);
      if (existing && (stable(existing.event) !== stable(event) || existing.revision !== body.revision))
        fail(409, 'EVENT_CONFLICT');
      if (!existing) fresh.push(JSON.parse(stable(event)));
    }
    if (fresh.length) entry.store.append(fresh, now(), body.revision);
    return { ok: true, accepted: [...ids], revision: body.revision };
  }

  const learningOf = entry => ({ enabled: entry.enabled, revision: entry.revision });
  const fence = (entry, revision) => {
    if (!integer(revision) || revision !== entry.revision) fail(409, 'REVISION_CONFLICT', { revision: entry.revision });
    if (!entry.enabled) fail(403, 'LEARNING_DISABLED', { revision: entry.revision });
  };
  // 본문은 POST만 읽는다 — 비었거나 JSON이 아니면 talk 입구처럼 400 INVALID_JSON.
  const parse = raw => {
    try {
      return JSON.parse(Buffer.from(raw ?? []).toString('utf8'));
    } catch {
      return fail(400, 'INVALID_JSON');
    }
  };

  // 리허설 손잡이 — 동의 켬/끔(판이 오른다) · 쓰기 문 · 서버 스위치 · 판만 올리기(다른 기기의 비우기 · 동의 왕복).
  function control(entry, body) {
    if (!plain(body) || typeof body.action !== 'string') fail(400, 'INVALID_ACTION');
    const flag = body.enabled;
    if (body.action === 'revision' && Object.keys(body).length === 1) bump(entry);
    else if (typeof flag !== 'boolean' || Object.keys(body).length !== 2) fail(400, 'INVALID_ACTION');
    else if (body.action === 'consent') {
      if (entry.enabled !== flag) bump(entry);
      entry.enabled = flag;
    } else if (body.action === 'writes') entry.writes = flag;
    else if (body.action === 'switch') entry.on = flag;
    else fail(400, 'INVALID_ACTION');
    return { ok: true, learning: learningOf(entry), capabilities: { learningSync: entry.writes }, trail: entry.on };
  }

  async function route(entry, { path: name, method, query, body: raw, headers }) {
    if (name === 'trail-account') {
      if (method !== 'GET') fail(405, 'METHOD_NOT_ALLOWED');
      return { ok: true, learning: learningOf(entry), capabilities: { learningSync: entry.writes } };
    }
    if (name === 'trail-control') {
      if (method !== 'POST') fail(405, 'METHOD_NOT_ALLOWED');
      return control(entry, parse(raw));
    }
    if (!['GET', 'POST'].includes(method)) fail(405, 'METHOD_NOT_ALLOWED');
    if (headers?.get('x-synk-contract') !== '1') fail(426, 'CONTRACT_UNSUPPORTED');
    if (headers?.get('x-synk-product') !== 'world') fail(400, 'PRODUCT_REQUIRED');
    if (name === 'trail-legacy') {
      if (method !== 'POST') fail(405, 'METHOD_NOT_ALLOWED');
      const body = parse(raw);
      if (
        [...query.keys()].length ||
        !plain(body) ||
        Object.keys(body).some(k => !['revision', 'events'].includes(k)) ||
        !Array.isArray(body.events) ||
        !body.events.length ||
        body.events.length > MAX_BATCH
      )
        fail(400, 'INVALID_EVENTS');
      fence(entry, body.revision);
      if (!entry.writes) fail(403, 'FEATURE_DISABLED'); // 옛 POST의 쓰기 문 닫힘은 옛 talk 답 그대로
      return legacy(entry, body);
    }
    if (!entry.on) fail(403, 'FEATURE_DISABLED');
    if (name === 'trail-clear') {
      const body = method === 'POST' ? parse(raw) : undefined;
      if (method !== 'POST' || [...query.keys()].length || !plain(body) || Object.keys(body).some(k => k !== 'revision') || !integer(body.revision))
        fail(400, 'INVALID_ACTION');
      if (body.revision !== entry.revision) fail(409, 'REVISION_CONFLICT', { revision: entry.revision });
      const cleared = entry.store.clear();
      bump(entry);
      return { ok: true, learning: learningOf(entry), revision: entry.revision, ...cleared };
    }
    if (method === 'GET') {
      if ([...query.keys()].some(k => !['revision', 'edition', 'since', 'gen'].includes(k) || query.getAll(k).length !== 1))
        fail(400, 'INVALID_QUERY');
      const revision = query.get('revision');
      fence(entry, /^(?:0|[1-9]\d{0,9})$/.test(revision ?? '') ? Number(revision) : -1);
      return read(entry, query);
    }
    if ([...query.keys()].length) fail(400, 'INVALID_QUERY');
    const body = parse(raw);
    fence(entry, body?.revision);
    if (!entry.writes) fail(403, 'WRITES_DISABLED');
    return post(entry, body);
  }

  return {
    edition,
    // account: 리허설 서버의 identity(request) — { id }. 답은 talk 입구와 같은 꼴({ ok:false, error:{ code }, revision?, ids? }).
    async handle({ account, path: name, method, query = new URLSearchParams(), body = undefined, headers = null }) {
      if (!TRAIL_PATHS.includes(name)) return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND' } } };
      const entry = accountOf(account.id);
      try {
        return { status: 200, body: await locked(entry, () => route(entry, { path: name, method, query, body, headers })) };
      } catch (error) {
        const status = error?.status || 500;
        const code = error?.code && status < 500 ? error.code : 'REHEARSAL_UNAVAILABLE';
        if (status >= 500) warn(`rehearsal trail: ${error?.stack ?? error}`);
        return {
          status,
          body: {
            ok: false,
            error: { code, message: code },
            ...(Number.isSafeInteger(error?.revision) ? { revision: error.revision } : {}),
            ...(status === 409 && Array.isArray(error?.ids) ? { ids: error.ids.slice(0, 256) } : {}),
          },
        };
      }
    },
  };
}

// 리허설 서버가 부르는 입구 — 엔진은 SYNK_ATLAS_DEV_OUT의 묶음(브라우저가 받는 것과 같은 판)과 그 판의 전체 색인(map/index.json),
// 없으면 패키지 원천(packages/atlas/src · map/index.json)으로 연다.
// stateFile: 마지막으로 내준 판을 적는 파일(리허설 서버의 자료 폴더 옆 — server.mjs `${dataDir}-trail-revision.json`, Fable 5.2 합친 끝 판
// 넘친 #25) — 켤 때 max(켠 시각의 초, 적은 판 + 1)로 시작한다. 켠 시각만으로는 앞 서버에서 판을 k번 올린 뒤 k초 안에 다시 켜면 새 판이 기기의
// 판보다 작거나 같아, 기기가 앞 서버 때의 저장소를 그대로 열었다(넘친 #10).
export async function openRehearsalTrail({ root, devOut = null, trailSwitch, keys, stateFile = null }) {
  let atlas;
  let indexFile;
  if (devOut) {
    const base = path.resolve(devOut, 'atlas');
    const editions = fs
      .readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'atlas.mjs')));
    if (editions.length !== 1) throw new Error(`rehearsal trail: 엔진 판이 하나여야 한다(${base} — ${editions.length}개)`);
    const dir = path.join(base, editions[0].name);
    atlas = await import(pathToFileURL(path.join(dir, 'atlas.mjs')).href);
    indexFile = path.join(dir, 'map', 'index.json');
  } else {
    const pkg = path.resolve(root, '../../packages/atlas');
    atlas = await import(pathToFileURL(path.join(pkg, 'src', 'index.mjs')).href);
    indexFile = path.join(pkg, 'map', 'index.json');
  }
  const index = atlas.openMap({ index: JSON.parse(fs.readFileSync(indexFile, 'utf8')) }).foldIndex;
  // 켤 때마다 큰 판으로 시작한다(켠 시각의 초) — 서버를 다시 켜면 메모리 계정이 사라지는데 판이 1로 돌아가, 같은 브라우저의 기기가 앞 사본
  // (계정 · 판 1)을 그대로 열고 옛 받은 표지와 새 서버 차례가 어긋나 「답이 사라진다」처럼 보였다. 판이 오르면 기기는 새 저장소를 열고 앞 판
  // 사본을 버린다(coach/stores.mjs dropEarlier — Fable 5.2 끝 판 넘친 #9).
  // 적은 판 — 처음 켬 · 깨졌거나 못 읽은 파일은 0(켠 시각으로 시작한다).
  const saved = () => {
    try {
      const value = JSON.parse(fs.readFileSync(stateFile, 'utf8'))?.revision;
      return Number.isSafeInteger(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  };
  // 읽기 · 쓰기를 옆 잠금 폴더(`<파일>.lock` — 만들기는 한 쪽만 된다)로 묶는다. 같은 파일을 쓰는 다른 서버 프로세스가 그 사이 더 큰 판을
  // 적어도 덮지 않는다(읽고 쓰는 사이에 끼면 나중에 쓴 쪽의 낮은 판이 남았다 — GPT Fable 처리 다시 검수 GC1). 10초 넘은 잠금은 주인이
  // 죽은 것으로 치우고, 2초 안에 못 잡으면 잠금 없이 쓴다(리허설 서버가 멈추지 않게).
  const LOCK_STALE_MS = 10_000;
  const LOCK_WAIT_MS = 2_000;
  const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  const locked = fn => {
    const lock = `${stateFile}.lock`;
    const deadline = Date.now() + LOCK_WAIT_MS;
    let held = false;
    while (!held) {
      try {
        fs.mkdirSync(lock);
        held = true;
      } catch (error) {
        if (error?.code !== 'EEXIST') break;
        try {
          if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
            fs.rmdirSync(lock);
            continue;
          }
        } catch {}
        if (Date.now() > deadline) break;
        pause(5);
      }
    }
    try {
      return fn();
    } finally {
      if (held)
        try {
          fs.rmdirSync(lock);
        } catch {}
    }
  };
  let highest = stateFile ? saved() : 0;
  const onRevision = stateFile
    ? revision => {
        if (revision <= highest) return;
        // 쓴 뒤에 올린다 — 한 번 못 쓰면 같은 판(뒤 계정의 처음 판)이 다시 쓴다(카본 합친 끝 판 B3). 폴더는 서버가 만들지만(server.mjs) 이 함수만
        // 부르는 길에서도 서게. 쓸 때 파일을 다시 읽어 큰 판을 둔다 — 같은 파일을 쓰는 다른 서버가 더 큰 판을 적었으면 나중에 쓴 쪽의 낮은 판이
        // 남아, 다시 켠 서버가 제가 내준 판 이하로 시작했다(Fable 5.2 합친 끝 판 넘친 #25).
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        locked(() => fs.writeFileSync(stateFile, JSON.stringify({ revision: Math.max(saved(), revision) })));
        highest = revision;
      }
    : null;
  return createRehearsalTrail({
    atlas,
    index,
    trailSwitch,
    keys,
    firstRevision: Math.max(1, Math.floor(Date.now() / 1000), highest + 1),
    onRevision,
  });
}
