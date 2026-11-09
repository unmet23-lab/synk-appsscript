// 말 랠리 체험 의견(2026-11-09) — 동의 상태 · 보내지 못한 요청 · 한 건씩 보내기 · 그만두기 · 기한. 화면(DOM)은 trial-feedback-ui.mjs가 맡는다.
// 계약 판 trial-feedback.v1-final(설계 · 계약 원문은 저장소 README의 체험 의견 절). 동의(보내기) 전에는 수집 주소로 아무 요청도 하지 않는다.
// 이 브라우저의 익명 참여 번호만 쓴다 — 계정 · 학습 기록(Atlas) · 게임 저장(synk.talk-rally.v1)과 따로 둔다.

export const CONTRACT = 'trial-feedback.v1-final';
export const APP = 'talk-rally';
export const CONSENT_VERSION = '2026-11-09';
export const STATE_KEY = 'synk.trial-feedback.talk-rally.v1';
export const OUTBOX_KEY = 'synk.trial-feedback.talk-rally.outbox.v1';
export const PRODUCTION_ORIGIN = 'https://synk.im';
export const PRODUCTION_COLLECTOR = 'https://workspace.synk.im';
const DAY = 86400000;
export const LIMITS = Object.freeze({ sendDays: 30, keepDays: 90, quietDays: 30, pendingDays: 3, outboxMax: 20, outboxDays: 3, noteChars: 100, timeoutMs: 10000 });
export const FUN = ['fun_4', 'fun_3', 'fun_2', 'fun_1'];
export const STUCK = ['listen', 'read', 'howto', 'control', 'sound', 'perf', 'none'];
export const AGAIN = ['again_1d', 'again_7d', 'again_unsure', 'again_no'];
const COHORT = /^[a-z0-9-]{1,24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LOCAL_HOSTS = new Set(['localhost']);   // 로컬 시험은 localhost 주소로만 연다(공개 파일에 이 PC 주소를 남기지 않는다)

/** 서울 달력 날짜(UTC+9 고정, 서머타임 없음). */
export const seoulDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

/**
 * 수집 주소. synk.im 공개판에서만 회사 서버로, 로컬(localhost)에서는 ?trialCollector=http://localhost:<포트>일 때만(시험).
 * WORLD 안 · 앱 사본 · 다른 주소는 null — 기능 전체가 꺼진다. ?qa는 끄는 조건이 아니다.
 */
export function resolveCollector({ origin, hostname, search = '', world = false } = {}) {
  if (world) return null;
  if (origin === PRODUCTION_ORIGIN) return PRODUCTION_COLLECTOR;
  if (!LOCAL_HOSTS.has(hostname)) return null;
  const raw = new URLSearchParams(search).get('trialCollector');
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname) && u.pathname === '/' && !u.search && !u.hash ? u.origin : null;
  } catch { return null; }
}

/** 모집 링크 묶음(?trial=<코드>). 없거나 꼴이 다르면 open. qa-로 시작하면 서버가 시험 자료로 따로 둔다. */
export function cohortFrom(search = '') {
  const v = new URLSearchParams(search).get('trial');
  return v && COHORT.test(v) ? v : 'open';
}

export function newId(cryptoObj = globalThis.crypto) {
  if (typeof cryptoObj?.randomUUID === 'function') return cryptoObj.randomUUID();
  const b = cryptoObj.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * 화면의 답을 계약 꼴로. 하나도 답하지 않았으면 null(보내지 않는다).
 * stuck: 「막힌 곳 없었어요(none)」는 혼자만. note: 앞뒤 공백을 자르고 100자까지, 제어문자는 빈칸으로.
 */
export function normalizeAnswers({ fun = null, stuck = [], note = '', again = null } = {}) {
  const f = FUN.includes(fun) ? fun : null;
  const a = AGAIN.includes(again) ? again : null;
  let s = [...new Set((Array.isArray(stuck) ? stuck : []).filter((x) => STUCK.includes(x)))];
  if (s.includes('none') && s.length > 1) s = ['none'];
  s.sort((x, y) => STUCK.indexOf(x) - STUCK.indexOf(y));
  const n = String(note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, LIMITS.noteChars).trim();
  const out = { fun: f, stuck: s.length ? s : null, stuckNote: n || null, again: a };
  return out.fun || out.stuck || out.stuckNote || out.again ? out : null;
}

/** 응답 → 처리 부류. 계약의 frontendObligations를 따른다. */
export function classify(status, body) {
  if (status === 0) return 'offline';
  if (status === 200 || status === 201) return body?.ok === true ? 'ok' : 'busy';
  if (status === 503 && body?.error === 'full') return 'full';
  if (status === 429 || status >= 500) return 'busy';
  if (status === 410) return body?.error === 'withdrawn' ? 'withdrawn' : 'expired';
  if (status === 404) return 'not_enrolled';
  if (status === 403) return 'refused';
  return 'invalid';   // 400 · 405 · 409 · 413 · 415 그 밖
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

const EMPTY = Object.freeze({ v: 1, state: 'none' });

/**
 * storage: localStorage 꼴(못 쓰면 이번 페이지 동안만 기억). fetchImpl: fetch 꼴. now: ms. collector: resolveCollector 결과(null이면 만들지 않는다).
 */
export function createTrialFeedback({ storage, fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now(), collector, cohort = 'open', uuid = () => newId(), onChange = () => {} } = {}) {
  if (!collector || typeof fetchImpl !== 'function') return null;
  let store = storage, persistent = true;
  try { const k = STATE_KEY + '.probe'; store.setItem(k, '1'); store.removeItem(k); } catch { store = memoryStorage(); persistent = false; }
  let flushing = null, lastResult = null;

  const read = (k, fallback) => { try { const v = JSON.parse(store.getItem(k) || 'null'); return v ?? fallback; } catch { return fallback; } };
  const write = (k, v) => { try { if (v == null) store.removeItem(k); else store.setItem(k, JSON.stringify(v)); return true; } catch { persistent = false; return false; } };
  const loadState = () => { const s = read(STATE_KEY, null); return s && s.v === 1 && typeof s.state === 'string' ? s : { ...EMPTY }; };
  const loadOutbox = () => { const o = read(OUTBOX_KEY, []); return Array.isArray(o) ? o.filter((x) => x && typeof x === 'object' && x.body) : []; };
  const iso = (ms) => new Date(ms).toISOString();
  const later = (days) => iso(now() + days * DAY);
  const passed = (at) => !!at && Date.parse(at) <= now();
  const changed = () => { try { onChange(status()); } catch { /* 화면 쪽 오류가 상태를 깨지 않게 */ } };

  /** 기한이 지난 것을 정리한다: 90일 지난 번호 지움, 3일 넘게 못 나간 enroll 버림, 3일 지난 사건 버림. */
  function tidy() {
    let s = loadState(), o = loadOutbox(), dirty = false;
    if (s.keepUntil && passed(s.keepUntil)) { s = { ...EMPTY, cohort: s.cohort }; o = []; dirty = true; }
    if (s.pendingEnroll && s.pendingEnrollSince && now() - Date.parse(s.pendingEnrollSince) > LIMITS.pendingDays * DAY) {
      s = { ...EMPTY, cohort: s.cohort }; o = []; dirty = true;
    }
    if (['declined', 'withdrawn'].includes(s.state) && s.quietUntil && passed(s.quietUntil) && !s.withdrawPending) { s = { ...EMPTY, cohort: s.cohort }; dirty = true; }
    const fresh = o.filter((x) => now() - Date.parse(x.queuedAt || 0) <= LIMITS.outboxDays * DAY);
    if (fresh.length !== o.length) { o = fresh; dirty = true; }
    if (dirty) { write(STATE_KEY, s); write(OUTBOX_KEY, o); }
    return { s, o };
  }

  /** 지금 상태(화면용). phase: none · declined · pending(enroll 대기) · active · expired(30일 지남 — 그만두기만) · ended(서버가 더 받지 않음) · withdrawing · withdrawn */
  function status() {
    const { s, o } = tidy();
    let phase = s.state;
    if (s.state === 'enrolled') phase = s.pendingEnroll ? 'pending' : s.sendUntil && passed(s.sendUntil) ? 'expired' : 'active';
    if (s.withdrawPending) phase = 'withdrawing';
    const daysLeft = s.sendUntil ? Math.max(0, Math.ceil((Date.parse(s.sendUntil) - now()) / DAY)) : null;
    return { phase, ended: !!s.ended, persistent, outbox: o.length, daysLeft, sendUntil: s.sendUntil || null, keepUntil: s.keepUntil || null, quietUntil: s.quietUntil || null,
      cohort: s.cohort || cohort, last: lastResult, busy: !!flushing };
  }

  /** 결과 화면에 카드를 띄워도 되는지(아직 참여도 거절도 안 했거나, 쉬는 기한이 지났을 때). */
  function canOffer() {
    const { s } = tidy();
    if (s.state === 'none') return !s.quietUntil || passed(s.quietUntil);
    return false;
  }

  function decline() {
    const s = tidy().s;
    if (s.state !== 'none') return status();
    write(STATE_KEY, { v: 1, state: 'declined', quietUntil: later(LIMITS.quietDays), cohort: s.cohort || cohort });
    changed(); return status();
  }

  function enqueue(kind, round) {
    const { s, o } = tidy();
    if (s.state !== 'enrolled' || s.withdrawPending || (s.sendUntil && passed(s.sendUntil))) return false;
    const body = { v: 1, app: APP, participantId: s.participantId, eventId: uuid(), kind, occurredAt: iso(now()) };
    if (round) body.round = round;
    o.push({ queuedAt: iso(now()), body });
    while (o.length > LIMITS.outboxMax) o.shift();   // 계약: 가득 차면 가장 오래된 사건부터 버린다(enroll은 따로 있어 밀려나지 않는다)
    write(OUTBOX_KEY, o);
    return true;
  }
  /** 서울 날짜가 바뀌었으면 visit 1건(입구 · 판 시작 앞). */
  function markVisit() {
    const { s } = tidy();
    if (s.state !== 'enrolled' || s.withdrawPending || (s.sendUntil && passed(s.sendUntil))) return false;
    const today = seoulDate(now());
    if (s.lastVisitDate === today) return false;
    if (!enqueue('visit')) return false;
    write(STATE_KEY, { ...loadState(), lastVisitDate: today });
    return true;
  }

  /** 동의 + 답 + 방금 끝낸 판. answers는 normalizeAnswers 결과(null이면 보내지 않는다). */
  function enroll({ answers, round, age14 }) {
    const { s } = tidy();
    if (s.state !== 'none' || (s.quietUntil && !passed(s.quietUntil))) return Promise.resolve({ kind: 'not_offered' });
    if (age14 !== true) return Promise.resolve({ kind: 'consent' });
    if (!answers) return Promise.resolve({ kind: 'empty' });
    if (!round || !UUID.test(round.roundId || '')) return Promise.resolve({ kind: 'invalid' });
    const at = now(), consentAt = iso(at), participantId = uuid();
    const body = { v: 1, app: APP, surface: 'lab-web', participantId, submissionId: uuid(), cohort, consentAt,   // 묶음은 지금 연 주소(?trial=)의 것 — 예전 거절 · 만료 때 남은 값을 쓰지 않는다
     
      consent: { version: CONSENT_VERSION, age14: true },
      round: { roundId: round.roundId, startedAt: round.startedAt, mode: round.mode, total: round.total, correct: round.correct, helped: round.helped, soundOn: round.soundOn },
      answers };
    write(STATE_KEY, { v: 1, state: 'enrolled', participantId, consentAt, sendUntil: iso(at + LIMITS.sendDays * DAY), keepUntil: iso(at + LIMITS.keepDays * DAY),
      pendingEnroll: body, pendingEnrollSince: consentAt, cohort: body.cohort, lastVisitDate: seoulDate(at) });
    changed();
    return flush();
  }

  /** 그만두기: 대기 중인 enroll · 사건을 버리고 withdraw만 보낸다(응답만 잃었을 수 있어 늘 보낸다). */
  function withdraw() {
    const { s } = tidy();
    if (!s.participantId) return Promise.resolve({ kind: 'none' });
    write(STATE_KEY, { v: 1, state: 'withdrawn', participantId: s.participantId, withdrawPending: true, keepUntil: s.keepUntil, quietUntil: s.keepUntil || later(LIMITS.keepDays), cohort: s.cohort });
    write(OUTBOX_KEY, []);
    changed();
    return flush();
  }

  async function post(path, body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), LIMITS.timeoutMs) : null;
    try {
      const res = await fetchImpl(collector + path, { method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl?.signal });
      let data = null; try { data = await res.json(); } catch { data = null; }
      return { status: res.status, body: data };
    } catch { return { status: 0, body: null }; }
    finally { if (timer) clearTimeout(timer); }
  }

  /** 요청을 기다리는 사이 그만두기를 눌렀는지(그때는 멈추거나 상태를 덮지 않고 곧장 withdraw로 간다). */
  const withdrawingNow = () => !!loadState().withdrawPending;

  /** 한 번에 한 요청만. withdraw → enroll → 사건(넣은 순서). 다시 막히면 거기서 멈춘다. */
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      let result = { kind: 'idle' };
      for (let guard = 0; guard < LIMITS.outboxMax + 4; guard++) {
        const { s, o } = tidy();
        if (s.withdrawPending) {
          const r = await post('/trial-feedback/withdraw', { v: 1, app: APP, participantId: s.participantId });
          const k = classify(r.status, r.body);
          if (k === 'ok') { write(STATE_KEY, { v: 1, state: 'withdrawn', quietUntil: s.quietUntil || later(LIMITS.keepDays), cohort: s.cohort }); write(OUTBOX_KEY, []); result = { kind: 'withdrawn' }; break; }
          if (k === 'offline' || k === 'busy' || k === 'full') { result = { kind: k === 'offline' ? 'offline' : 'busy', target: 'withdraw' }; break; }
          // 403 · 400대: 다시 보내도 같은 답이다. 서버 기록이 남았을 수 있다고 그대로 알린다(번호는 keepUntil까지 남긴다).
          result = { kind: 'withdraw_failed', status: r.status }; break;
        }
        if (s.state !== 'enrolled') break;
        if (s.pendingEnroll) {
          const r = await post('/trial-feedback/enroll', s.pendingEnroll);
          const k = classify(r.status, r.body);
          if (k === 'ok') {
            const cur = loadState();
            if (cur.state === 'enrolled' && cur.participantId === s.participantId) {
              const next = { ...cur }; delete next.pendingEnroll; delete next.pendingEnrollSince;
              if (r.body.expiresAt) next.sendUntil = r.body.expiresAt;   // 서버 확정 기한(R5)
              if (r.body.deleteAt) next.keepUntil = r.body.deleteAt;
              write(STATE_KEY, next);
            }
            result = { kind: 'sent', duplicate: !!r.body.duplicate };
            continue;
          }
          if (withdrawingNow()) continue;   // 기다리는 사이 그만두기: 이 결과로 멈추거나 상태를 덮지 않는다
          if (k === 'offline' || k === 'busy') { result = { kind: k, target: 'enroll', retryAfter: r.body?.retryAfterSeconds ?? null }; break; }
          // enroll 거절(400 · 403 · 409 · 410 · 503 full): 서버에 아무것도 남지 않았다 — 다 비우고 쉰다
          write(STATE_KEY, { v: 1, state: 'none', quietUntil: later(LIMITS.quietDays), cohort: s.cohort }); write(OUTBOX_KEY, []);
          result = { kind: k === 'full' ? 'full' : k === 'refused' ? 'refused' : k === 'withdrawn' ? 'refused' : 'invalid', target: 'enroll', status: r.status };
          break;
        }
        if (!o.length) break;
        if (s.sendUntil && passed(s.sendUntil)) { write(OUTBOX_KEY, []); break; }
        const head = o[0];
        const r = await post('/trial-feedback/event', head.body);
        const k = classify(r.status, r.body);
        const drop = () => { const cur = loadOutbox(); if (cur[0]?.body?.eventId === head.body.eventId) cur.shift(); write(OUTBOX_KEY, cur); };
        if (k === 'ok' || k === 'invalid') { drop(); if (result.kind === 'idle' || result.kind === 'events') result = { kind: 'events' }; continue; }
        if (withdrawingNow()) continue;   // 기다리는 사이 그만두기
        if (k === 'offline' || k === 'busy') { result = { kind: k, target: 'event' }; break; }
        if (k === 'not_enrolled') { write(STATE_KEY, { v: 1, state: 'none', quietUntil: later(LIMITS.quietDays), cohort: s.cohort }); write(OUTBOX_KEY, []); result = { kind: 'not_enrolled' }; break; }
        // 410 expired · 403 · 503 full: 보내기만 멈춘다. 번호는 keepUntil까지 그만두기용으로 남긴다.
        const cur = loadState(); write(STATE_KEY, { ...cur, sendUntil: iso(Math.min(now(), Date.parse(cur.sendUntil || iso(now())))), ...(k === 'expired' ? {} : { ended: true }) }); write(OUTBOX_KEY, []);
        result = { kind: 'stopped', status: r.status }; break;
      }
      lastResult = result;
      return result;
    })().finally(() => { flushing = null; changed(); });
    changed();
    return flushing;
  }

  return {
    status, canOffer, decline, enroll, withdraw, flush,
    /** 입구가 그려질 때: 날짜가 바뀌었으면 visit, 그리고 밀린 것 보내기. */
    lobby() { markVisit(); const st = status(); if (st.phase !== 'none' && st.phase !== 'declined' && st.phase !== 'withdrawn') flush(); return st; },
    roundStart({ roundId, mode }) { markVisit(); if (enqueue('round_start', { roundId, mode })) flush(); },
    roundComplete({ roundId, mode, total, correct, helped, soundOn }) { if (enqueue('round_complete', { roundId, mode, total, correct, helped, soundOn })) flush(); },
    /** 시험용: 지금 저장된 원본. */
    debug: () => ({ state: loadState(), outbox: loadOutbox(), persistent }),
  };
}
