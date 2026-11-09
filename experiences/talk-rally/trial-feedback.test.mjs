// 체험 의견 로직 시험(2026-11-09). 서버는 계약(trial-feedback.v1-final)을 흉내 낸 「fixture」다 — 실제 회사 서버 · 실제 참여 기록이 아니다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrialFeedback, resolveCollector, cohortFrom, normalizeAnswers, classify, seoulDate, STATE_KEY, OUTBOX_KEY, LIMITS } from './trial-feedback.mjs';

const DAY = 86400000;
const T0 = Date.parse('2026-11-09T03:00:00Z');   // 서울 12:00
function memory() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function ids() { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; }
const round = (over = {}) => ({ roundId: '11111111-1111-4111-8111-111111111111', startedAt: new Date(T0 - 120000).toISOString(), mode: 'normal', total: 12, correct: 9, helped: 2, soundOn: true, ...over });

/** fixture 서버: 계약의 응답 꼴만 흉내 낸다. mode로 오프라인 · 바쁨 · 거절을 만든다. */
function fixtureServer() {
  const calls = [], participants = new Map(), events = new Map(), withdrawn = new Set();
  let mode = 'ok';
  const reply = (status, body) => ({ status, json: async () => body });
  async function fetchImpl(url, init) {
    const path = new URL(url).pathname, body = JSON.parse(init.body);
    calls.push({ path, body, init });
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    if (mode === 'busy') return reply(503, { ok: false, error: 'stopped' });
    if (mode === 'full') return reply(503, { ok: false, error: 'full' });
    if (mode === 'refuse') return reply(403, { ok: false, error: 'origin' });
    if (mode === 'expired') return reply(410, { ok: false, error: 'expired' });
    if (path === '/trial-feedback/enroll') {
      if (withdrawn.has(body.participantId)) return reply(410, { ok: false, error: 'withdrawn' });
      const old = participants.get(body.participantId);
      const consentAt = body.consentAt, out = { ok: true, consentAt, expiresAt: new Date(Date.parse(consentAt) + 30 * DAY).toISOString(), deleteAt: new Date(Date.parse(consentAt) + 90 * DAY).toISOString() };
      if (old) return old.submissionId === body.submissionId ? reply(200, { ...out, duplicate: true }) : reply(409, { ok: false, error: 'already_enrolled' });
      participants.set(body.participantId, body);
      return reply(201, { ...out, duplicate: false });
    }
    if (path === '/trial-feedback/event') {
      if (!participants.has(body.participantId)) return reply(404, { ok: false, error: 'not_enrolled' });
      const dup = events.has(body.eventId); events.set(body.eventId, body);
      return reply(dup ? 200 : 201, { ok: true, duplicate: dup });
    }
    if (path === '/trial-feedback/withdraw') {
      participants.delete(body.participantId); withdrawn.add(body.participantId);
      for (const [k, v] of events) if (v.participantId === body.participantId) events.delete(k);
      return reply(200, { ok: true, deleted: true });
    }
    return reply(404, { ok: false });
  }
  return { fetchImpl, calls, participants, events, withdrawn, set mode(v) { mode = v; }, get mode() { return mode; } };
}
function setup({ storage = memory(), server = fixtureServer(), at = T0, cohort = 'qa-unit' } = {}) {
  const clock = { t: at };
  const tf = createTrialFeedback({ storage, fetchImpl: server.fetchImpl, now: () => clock.t, collector: 'http://localhost:9', cohort, uuid: ids() });
  return { tf, server, storage, clock };
}
const ANS = normalizeAnswers({ fun: 'fun_3', stuck: ['listen'], note: '  소리가 작아요 ', again: 'again_7d' });

test('수집 주소: synk.im만 회사 서버, 로컬은 trialCollector가 있을 때만, WORLD · 다른 주소는 끔', () => {
  assert.equal(resolveCollector({ origin: 'https://synk.im', hostname: 'synk.im' }), 'https://workspace.synk.im');
  assert.equal(resolveCollector({ origin: 'https://synk.im', hostname: 'synk.im', world: true }), null);
  assert.equal(resolveCollector({ origin: 'http://localhost:5221', hostname: 'localhost', search: '?qa' }), null);
  assert.equal(resolveCollector({ origin: 'http://localhost:5221', hostname: 'localhost', search: '?qa&trialCollector=http://localhost:7788' }), 'http://localhost:7788');
  assert.equal(resolveCollector({ origin: 'http://localhost:5221', hostname: 'localhost', search: '?trialCollector=https://evil.example' }), null);
  assert.equal(resolveCollector({ origin: 'http://127.0.0.1:5221', hostname: '127.0.0.1', search: '?trialCollector=http://localhost:7788' }), null);
  assert.equal(resolveCollector({ origin: 'https://evil.example', hostname: 'evil.example', search: '?trialCollector=http://localhost:7788' }), null);
  assert.equal(resolveCollector({ origin: 'https://www.synk.im', hostname: 'www.synk.im' }), null);
  assert.equal(cohortFrom('?trial=t1109'), 't1109');
  assert.equal(cohortFrom('?trial=BAD!'), 'open');
  assert.equal(cohortFrom(''), 'open');
});

test('답 정리: 일부만 · 전부 건너뜀 · none은 혼자 · 글 100자', () => {
  assert.equal(normalizeAnswers({}), null);
  assert.equal(normalizeAnswers({ note: '   ' }), null);
  assert.deepEqual(normalizeAnswers({ again: 'again_no' }), { fun: null, stuck: null, stuckNote: null, again: 'again_no' });
  assert.deepEqual(normalizeAnswers({ stuck: ['none', 'listen'] }).stuck, ['none']);
  assert.deepEqual(normalizeAnswers({ stuck: ['perf', 'listen', 'perf', 'x'] }).stuck, ['listen', 'perf']);
  assert.equal(normalizeAnswers({ note: 'a'.repeat(140) }).stuckNote.length, LIMITS.noteChars);
  assert.equal(normalizeAnswers({ note: 'a\u0000b' }).stuckNote, 'a b');
  assert.equal(normalizeAnswers({ fun: 'fun_9' }), null);
});

test('응답 부류', () => {
  assert.equal(classify(0, null), 'offline');
  assert.equal(classify(201, { ok: true }), 'ok');
  assert.equal(classify(503, { error: 'full' }), 'full');
  assert.equal(classify(503, { error: 'stopped' }), 'busy');
  assert.equal(classify(429, {}), 'busy');
  assert.equal(classify(410, { error: 'withdrawn' }), 'withdrawn');
  assert.equal(classify(410, { error: 'expired' }), 'expired');
  assert.equal(classify(404, {}), 'not_enrolled');
  assert.equal(classify(403, {}), 'refused');
  assert.equal(classify(409, {}), 'invalid');
});

test('동의 안 함: 괜찮아요 → 요청 0건, 30일 동안 카드 없음, 판 기록도 안 보냄', async () => {
  const { tf, server, clock } = setup();
  assert.equal(tf.canOffer(), true);
  tf.decline();
  assert.equal(tf.canOffer(), false);
  tf.lobby(); tf.roundStart({ roundId: round().roundId, mode: 'normal' }); tf.roundComplete(round());
  await tf.flush();
  assert.equal(server.calls.length, 0);
  clock.t += 31 * DAY;
  assert.equal(tf.canOffer(), true);
  assert.equal(server.calls.length, 0);
});

test('동의 전에는 어떤 요청도 없다(입구 · 판 시작 · 완료)', async () => {
  const { tf, server } = setup();
  tf.lobby(); tf.roundStart({ roundId: round().roundId, mode: 'normal' }); tf.roundComplete(round());
  await tf.flush();
  assert.equal(server.calls.length, 0);
});

test('14세 미체크 · 모두 건너뜀이면 보내지 않는다', async () => {
  const { tf, server } = setup();
  assert.equal((await tf.enroll({ answers: ANS, round: round(), age14: false })).kind, 'consent');
  assert.equal((await tf.enroll({ answers: null, round: round(), age14: true })).kind, 'empty');
  assert.equal(server.calls.length, 0);
  assert.equal(tf.status().phase, 'none');
});

test('보내기: 계약 꼴 · 서버 기한 반영 · credentials omit', async () => {
  const { tf, server } = setup();
  const r = await tf.enroll({ answers: ANS, round: round(), age14: true });
  assert.equal(r.kind, 'sent');
  const c = server.calls[0];
  assert.equal(c.path, '/trial-feedback/enroll');
  assert.equal(c.init.credentials, 'omit'); assert.equal(c.init.mode, 'cors'); assert.equal(c.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(Object.keys(c.body).sort(), ['answers', 'app', 'cohort', 'consent', 'consentAt', 'participantId', 'round', 'submissionId', 'surface', 'v'].sort());
  assert.deepEqual(Object.keys(c.body.round).sort(), ['correct', 'helped', 'mode', 'roundId', 'soundOn', 'startedAt', 'total'].sort());
  assert.equal(c.body.cohort, 'qa-unit');
  assert.equal(c.body.answers.stuckNote, '소리가 작아요');
  const st = tf.status();
  assert.equal(st.phase, 'active'); assert.equal(st.daysLeft, 30);
  assert.equal(tf.canOffer(), false);
});

test('중복 보내기: 이중 클릭은 한 요청, 응답을 잃은 재전송은 같은 submissionId', async () => {
  const { tf, server } = setup();
  const [a, b] = await Promise.all([tf.enroll({ answers: ANS, round: round(), age14: true }), tf.enroll({ answers: ANS, round: round(), age14: true })]);
  assert.equal(a.kind, 'sent'); assert.equal(b.kind, 'not_offered');
  assert.equal(server.calls.filter((x) => x.path.endsWith('/enroll')).length, 1);
});

test('오프라인 → 담아 둠 → 다음 날 입구: enroll 먼저, 그다음 visit(F1), 동시 요청 없음', async () => {
  const { tf, server, clock } = setup();
  server.mode = 'offline';
  const r = await tf.enroll({ answers: ANS, round: round(), age14: true });
  assert.equal(r.kind, 'offline');
  assert.equal(tf.status().phase, 'pending');
  const sub = server.calls[0].body.submissionId;
  clock.t += DAY; server.mode = 'ok'; server.calls.length = 0;
  let inflight = 0, maxInflight = 0;
  const orig = server.fetchImpl;
  const tf2 = createTrialFeedback({ storage: setupStorage(tf), fetchImpl: async (u, i) => { inflight++; maxInflight = Math.max(maxInflight, inflight); try { return await orig(u, i); } finally { inflight--; } }, now: () => clock.t, collector: 'http://localhost:9', cohort: 'qa-unit', uuid: ids() });
  tf2.lobby(); await tf2.flush();
  assert.deepEqual(server.calls.map((x) => x.path), ['/trial-feedback/enroll', '/trial-feedback/event']);
  assert.equal(server.calls[0].body.submissionId, sub);
  assert.equal(server.calls[1].body.kind, 'visit');
  assert.equal(maxInflight, 1);
  assert.equal(tf2.status().phase, 'active');
});
function setupStorage(tf) { const s = memory(); const d = tf.debug(); s.setItem(STATE_KEY, JSON.stringify(d.state)); s.setItem(OUTBOX_KEY, JSON.stringify(d.outbox)); return s; }

test('enroll이 막힌 채 11판 → enroll은 밀려나지 않고 사건은 20건까지(F14), 3일 넘으면 비움', async () => {
  const { tf, server, clock } = setup();
  server.mode = 'busy';
  await tf.enroll({ answers: ANS, round: round(), age14: true });
  for (let i = 0; i < 11; i++) {
    const id = `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`;
    tf.roundStart({ roundId: id, mode: 'normal' }); tf.roundComplete(round({ roundId: id }));
    await tf.flush();
  }
  let d = tf.debug();
  assert.ok(d.state.pendingEnroll);
  assert.equal(d.outbox.length, LIMITS.outboxMax);
  assert.equal(tf.status().phase, 'pending');
  server.mode = 'ok'; server.calls.length = 0;
  await tf.flush();
  assert.equal(server.calls[0].path, '/trial-feedback/enroll');
  assert.equal(server.calls.length, 1 + LIMITS.outboxMax);
  assert.equal(tf.debug().outbox.length, 0);
  // 다른 번호로 3일 넘게 막힘
  const s2 = setup(); s2.server.mode = 'busy';
  await s2.tf.enroll({ answers: ANS, round: round(), age14: true });
  s2.clock.t += 3 * DAY + 1000;
  assert.equal(s2.tf.status().phase, 'none');
  assert.equal(s2.tf.debug().outbox.length, 0);
});

test('서버 바쁨 · 자리 없음 · 받지 않음', async () => {
  const a = setup(); a.server.mode = 'busy';
  assert.equal((await a.tf.enroll({ answers: ANS, round: round(), age14: true })).kind, 'busy');
  assert.equal(a.tf.status().phase, 'pending');
  const b = setup(); b.server.mode = 'full';
  assert.equal((await b.tf.enroll({ answers: ANS, round: round(), age14: true })).kind, 'full');
  assert.equal(b.tf.status().phase, 'none'); assert.equal(b.tf.canOffer(), false);
  const c = setup(); c.server.mode = 'refuse';
  assert.equal((await c.tf.enroll({ answers: ANS, round: round(), age14: true })).kind, 'refused');
  assert.equal(c.tf.debug().outbox.length, 0); assert.equal(c.tf.canOffer(), false);
});

test('참여 뒤: 같은 날 입구는 visit 없음, 다음 날은 visit 1, 판 시작 · 완료는 같은 roundId', async () => {
  const { tf, server, clock } = setup();
  await tf.enroll({ answers: ANS, round: round(), age14: true });
  server.calls.length = 0;
  tf.lobby(); await tf.flush();
  assert.equal(server.calls.length, 0);
  clock.t += DAY;
  const rid = '33333333-3333-4333-8333-333333333333';
  tf.roundStart({ roundId: rid, mode: 'daily' }); tf.roundComplete(round({ roundId: rid, mode: 'daily' }));
  await tf.flush(); await tf.flush();
  assert.deepEqual(server.calls.map((x) => x.body.kind), ['visit', 'round_start', 'round_complete']);
  assert.equal(server.calls[1].body.round.roundId, rid); assert.equal(server.calls[2].body.round.roundId, rid);
  assert.deepEqual(Object.keys(server.calls[1].body.round).sort(), ['mode', 'roundId']);
  assert.equal('cohort' in server.calls[0].body, false);
});

test('만료: 30일 뒤 보내기 0 · 그만두기만, 90일 뒤 번호 지움', async () => {
  const { tf, server, clock } = setup();
  await tf.enroll({ answers: ANS, round: round(), age14: true });
  clock.t += 30 * DAY + 1000; server.calls.length = 0;
  tf.lobby(); tf.roundStart({ roundId: round().roundId, mode: 'normal' }); await tf.flush();
  assert.equal(server.calls.length, 0);
  assert.equal(tf.status().phase, 'expired');
  assert.ok(tf.debug().state.participantId);
  clock.t += 60 * DAY;
  assert.equal(tf.status().phase, 'none');
  assert.equal(tf.debug().state.participantId, undefined);
});

test('서버 410 expired는 보내기만 멈추고 그만두기는 남긴다', async () => {
  const { tf, server } = setup();
  await tf.enroll({ answers: ANS, round: round(), age14: true });
  server.mode = 'expired';
  tf.roundStart({ roundId: round().roundId, mode: 'normal' }); await tf.flush();
  assert.equal(tf.status().phase, 'expired');
  server.mode = 'ok';
  assert.equal((await tf.withdraw()).kind, 'withdrawn');
});

test('그만두기: 서버 기록 지움 · 이후 요청 0 · 실패하면 다시 지우기 · 대기 중이던 enroll은 되살아나지 않음', async () => {
  const { tf, server, clock } = setup();
  await tf.enroll({ answers: ANS, round: round(), age14: true });
  server.mode = 'offline';
  const w = await tf.withdraw();
  assert.equal(w.kind, 'offline');
  assert.equal(tf.status().phase, 'withdrawing');
  server.mode = 'ok';
  assert.equal((await tf.flush()).kind, 'withdrawn');
  assert.equal(server.participants.size, 0);
  server.calls.length = 0;
  tf.lobby(); tf.roundStart({ roundId: round().roundId, mode: 'normal' }); tf.roundComplete(round()); await tf.flush();
  assert.equal(server.calls.length, 0);
  assert.equal(tf.canOffer(), false);
  clock.t += 91 * DAY;
  assert.equal(tf.canOffer(), true);
  // 응답을 받기 전에 그만둔 enroll: withdraw만 가고 enroll은 버린다
  const b = setup(); b.server.mode = 'offline';
  await b.tf.enroll({ answers: ANS, round: round(), age14: true });
  b.server.mode = 'ok'; b.server.calls.length = 0;
  await b.tf.withdraw();
  assert.deepEqual(b.server.calls.map((x) => x.path), ['/trial-feedback/withdraw']);
});

test('저장소를 못 쓰는 브라우저: 이번 페이지에서만 기억, persistent false', async () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const { tf } = setup({ storage: broken });
  assert.equal(tf.status().persistent, false);
  assert.equal((await tf.enroll({ answers: ANS, round: round(), age14: true })).kind, 'sent');
});

test('수집 주소가 없으면 만들지 않는다(WORLD · 로컬 기본)', () => {
  assert.equal(createTrialFeedback({ storage: memory(), fetchImpl: async () => ({}), collector: null }), null);
});

test('서울 날짜', () => {
  assert.equal(seoulDate(Date.parse('2026-11-09T14:59:00Z')), '2026-11-09');
  assert.equal(seoulDate(Date.parse('2026-11-09T15:00:00Z')), '2026-11-10');
});

test('보내는 중에 그만두기(아르곤 C1): 진행 중이던 요청이 바쁨·404로 끝나도 같은 흐름에서 withdraw를 보내고 철회 표시를 덮지 않는다', async () => {
  for (const ending of ['busy', 'gone']) {
    const server = fixtureServer(); const storage = memory(); const clock = { t: T0 };
    let release; const gate = new Promise((r) => { release = r; });
    let first = true;
    const fetchImpl = async (url, init) => {
      const p = new URL(url).pathname;
      if (first && p.endsWith('/event')) { first = false; await gate; server.calls.push({ path: p, body: JSON.parse(init.body), init });
        return ending === 'busy' ? { status: 503, json: async () => ({ ok: false, error: 'stopped' }) } : { status: 404, json: async () => ({ ok: false, error: 'not_enrolled' }) }; }
      return server.fetchImpl(url, init);
    };
    const tf = createTrialFeedback({ storage, fetchImpl, now: () => clock.t, collector: 'http://localhost:9', cohort: 'qa-unit', uuid: ids() });
    await tf.enroll({ answers: ANS, round: round(), age14: true });
    clock.t += DAY;
    tf.lobby();                       // visit 요청이 gate에서 멈춘다
    const w = tf.withdraw();          // 그 사이에 그만두기
    release();
    const r = await w;
    assert.equal(r.kind, 'withdrawn', ending);
    assert.ok(server.calls.some((c) => c.path.endsWith('/withdraw')), ending);
    assert.equal(server.participants.size, 0, ending);
    assert.equal(tf.debug().state.withdrawPending, undefined, ending);
    assert.equal(tf.status().phase, 'withdrawn', ending);
  }
});

test('그만두기 요청이 나가는 동안 phase는 withdrawing이지만 busy가 참이다(아르곤 C2 — 화면은 「지우는 중」)', async () => {
  const server = fixtureServer(); const storage = memory(); let release; const gate = new Promise((r) => { release = r; });
  const fetchImpl = async (url, init) => { if (new URL(url).pathname.endsWith('/withdraw')) await gate; return server.fetchImpl(url, init); };
  const tf = createTrialFeedback({ storage, fetchImpl, now: () => T0, collector: 'http://localhost:9', cohort: 'qa-unit', uuid: ids() });
  await tf.enroll({ answers: ANS, round: round(), age14: true });
  const w = tf.withdraw();
  const mid = tf.status();
  assert.equal(mid.phase, 'withdrawing'); assert.equal(mid.busy, true);
  release(); await w;
  assert.equal(tf.status().busy, false);
});

test('묶음은 지금 연 주소의 것(아르곤 B3): 예전에 open으로 괜찮아요 → 30일 뒤 모집 링크로 참여하면 그 링크 이름', async () => {
  const storage = memory(), server = fixtureServer(), clock = { t: T0 };
  const a = createTrialFeedback({ storage, fetchImpl: server.fetchImpl, now: () => clock.t, collector: 'http://localhost:9', cohort: 'open', uuid: ids() });
  a.decline(); clock.t += 31 * DAY;
  const b = createTrialFeedback({ storage, fetchImpl: server.fetchImpl, now: () => clock.t, collector: 'http://localhost:9', cohort: 't1109', uuid: ids() });
  assert.equal((await b.enroll({ answers: ANS, round: round(), age14: true })).kind, 'sent');
  assert.equal(server.calls[0].body.cohort, 't1109');
});
