// Atlas 새 길의 WORLD 입구(재설계 단계 4 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §6 · §7 · §18-2 · §18-5). 기능 atlasNext가
// 켜졌을 때만 셸이 동적 import로 부른다 — 꺼진 판은 이 파일도 엔진 입구(/atlas/loader.mjs)도 받지 않고, 지금 판 코치로 돈다.
// 손님은 이 기기가 원천인 손님 저장소로 간다. 계정은 판을 정해(§18-2 1 · §18-5-5) 셋 가운데 하나로 간다 — 올리는 길(계정 · 동의 판의
// 저장소 + 나르개), 기기 길(동의 꺼짐 · 쓰기 문 닫힘 — 올리지 않는 그 계정의 기기 저장소, F6), 지금 판(null).
// 엔진이 준비되지 못하면(입구 · 묶음 · 지도 · 저장소) null을 돌려주고 셸은 지금 판으로 간다 — 학습이 막히지 않는다.
import { createPracticeNextSession } from './world-practice-next.mjs';

const ENTRY = '/atlas/loader.mjs';
// 지금 판 코치(atlas/game-learning.js)가 손님 기록을 두는 자리 — { version, epoch, events, ledger, … }.
export const LEGACY_KEY = 'synk.atlas.learning.v1.device';
// 「새 길 간 적 있음」 · 「스위치 꺼짐」 표지 — 계정마다 하나, 판과 무관한 자리(§18-5-5 B4 · R15). 값 { went?: true, off?: true, path?, revision? }
// — path · revision은 마지막으로 정한 새 길('upload' | 'device')과 그 판이다. 계정을 네트워크로 못 읽을 때 그 값으로 새 길을 연다(Fable 5.2 끝 판 F1).
export const NEXT_MARK = 'synk.atlas.next.';
// 처음인 기기의 첫 받기를 기다리는 한도(§18-5-5 G4) · 스위치를 묻는 받기 한도 · 옮기기 물음을 세는 한도(셸이 쓴다).
export const FIRST_SYNC_MS = 4000;
export const SWITCH_ASK_MS = 4000;
export const GUEST_COUNT_MS = 8000;
// 옮기기 물음 · 로그아웃 표지가 여는 계정 코치의 은행(손님 저장소를 옆으로 열 지도 — 옛 기록 옮기기의 색인).
const MOVE_BANKS = ['topik-items'];
// 생활 화면의 은행(4-2 — 생활 원고 132문항, 경험 world-life, 단계 4 §19-1 ①).
const LIFE_BANKS = ['world-life'];

// 옛 기기 기록 읽개(계획 §1 #22 — 손님 호스트가 열 때마다 부른다). 옛 로그(events)와 접힌 장부(ledger)를 그대로 넘기고, 옮길 것을
// 고르는 일(아직 안 옮긴 옛 꼴 사건 · 새로 든 장부)은 엔진(record/carry.mjs)이 한다. 못 읽으면 null — 새 길은 그대로 연다.
export function legacyReader(storage) {
  return () => {
    try {
      const raw = storage?.getItem?.(LEGACY_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return {
        log: Array.isArray(value?.events) ? value.events : [],
        ledger: value?.ledger ?? null,
      };
    } catch {
      return null;
    }
  };
}
// 옮기기 물음을 지금 판 물음(null)으로 보내는 지금 판의 까닭 — 스위치 꺼짐 · 길(trail)을 받지 않은 셸 · 기기 길 계정의 스위치 모름 · 기기
// 길로 확인된 계정이 엔진만 못 받음(기기 길은 손님 기록을 올리지 않는다 — 카본 다시 A2, 그 판은 붙들지 않아 다음 연습에서 다시 정한다).
// 그 밖의 지금 판(계정을 못 읽음 · 첫 받기 실패 등)은 「못 셈」이다.
const SETTLED_OLD = new Set(['SWITCH_OFF', 'NO_TRAIL', 'SWITCH_UNKNOWN', 'DEVICE_UNLOADED']);
// 옮길 것이 없다는 답(손님 저장소도 고를 옛 기록도 없다) — 물음에 학습 줄을 넣지 않고 다녀감 표지도 쓰지 않는다.
const NOTHING_TO_MOVE = () => ({ attempts: 0, events: 0, none: true, note: async () => false, close() {} });
// 지금 판 규칙(pick)으로 고를 옛 기기 기록이 있나 — 못 읽으면 없다, 고르기가 던지면 있다고 본다(만들어 세는 쪽이 빠뜨리지 않는다).
function legacyCandidates(reader, pick) {
  const old = reader?.() ?? null;
  if (!old?.log?.length) return false;
  try {
    return pick(old.log).length > 0;
  } catch {
    return true;
  }
}
// 이 이름의 IndexedDB 저장소가 있을 수 있나 — 목록을 못 읽는 브라우저 · 읽기 실패는 「있을 수 있다」(코치가 열어 본다).
async function storeMaybe(name) {
  try {
    const list = await globalThis.indexedDB?.databases?.();
    return Array.isArray(list) ? list.some(db => db?.name === name) : true;
  } catch {
    return true;
  }
}
// 연습 문항의 열쇠 앞마디 → 지도의 은행 이름. 대개 같은 이름이고(TOPIK 은행 topik-items, 진단이 빌려 쓰는 게임 문항은 그 게임 이름),
// 다른 것만 따로 적는다 — 마을 읽기 문항(synk-town.…)의 은행은 synk-town-reading이다(Fable 5.2 최종 F4: 빠지면 그 30문항이 색인 밖
// 문항으로 떨어져 단위 · 진도 차례 · 이유 줄을 잃는다). 연습 풀에 새 은행이 들면 시험(world-practice.test.mjs 「은행 조각」)이 먼저 잡는다.
const SAME = [
  'topik-items',
  'blank-slice',
  'entry-check',
  'korean-runner',
  'korean-rhythm',
  'snap-words',
  'subway-rush',
  'talk-rally',
  'order-rush',
  'story-classroom',
];
const BANKS = new Map([...SAME.map(bank => [bank, bank]), ['synk-town', 'synk-town-reading']]);

export function banksOf(pool) {
  const banks = new Set();
  for (const item of pool ?? []) {
    const bank = BANKS.get(String(item?.itemKey ?? '').split('.')[0]);
    if (bank) banks.add(bank);
  }
  return [...banks].sort();
}

// 이 기기의 localStorage — 브라우저가 사이트 저장소를 막으면 속성을 읽기만 해도 SecurityError를 던진다. 그때는 null(옛 기록 읽개 없이 연다 —
// 옮기기는 저장소가 다시 열린 뒤에 연 판에서)이고 계기에 남긴다(GPT 최종 GB1: 기본 인수에서 던지면 입구가 load 전에 멈춰 지금 판으로 넘어갔다).
function deviceStorage(note) {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    note('save', { ok: false, code: 'LEGACY_STORAGE' });
    return null;
  }
}

const NEXT_PATHS = new Set(['upload', 'device']);
function markOf(storage, owner) {
  try {
    const value = JSON.parse(storage?.getItem?.(NEXT_MARK + owner) ?? 'null');
    const went = value?.went === true;
    const path = went && NEXT_PATHS.has(value?.path) ? value.path : null;
    const revision = path && Number.isSafeInteger(value?.revision) && value.revision > 0 ? value.revision : null;
    return { went, off: value?.off === true, path: revision ? path : null, revision };
  } catch {
    return { went: false, off: false, path: null, revision: null };
  }
}
function writeMark(storage, owner, patch) {
  const next = { ...markOf(storage, owner), ...patch };
  const kept = next.went && NEXT_PATHS.has(next.path) && Number.isSafeInteger(next.revision) && next.revision > 0;
  try {
    storage?.setItem?.(
      NEXT_MARK + owner,
      JSON.stringify({
        ...(next.went ? { went: true } : {}),
        ...(next.off ? { off: true } : {}),
        ...(kept ? { path: next.path, revision: next.revision } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

// 그 계정의 서버 스위치를 받기 한 번으로 묻는다 — 'on'(스위치 뒤의 답: 요약 · 판 울타리 · 동의 꺼짐), 'off'(GET 403 FEATURE_DISABLED —
// talk 입구는 스위치를 판 울타리보다 먼저 본다), 'unknown'(네트워크 · 인증 · 그 밖 · 한도).
export async function askSwitch(transport, wait = SWITCH_ASK_MS) {
  if (typeof transport?.get !== 'function') return 'unknown';
  let timer;
  const late = new Promise(resolve => {
    timer = setTimeout(() => resolve('unknown'), wait);
    timer?.unref?.();
  });
  const asked = Promise.resolve()
    .then(() => transport.get(null))
    .then(
      () => 'on',
      error => {
        const status = error?.status;
        const code = error?.code;
        if (status === 403 && code === 'FEATURE_DISABLED') return 'off';
        if ((status === 403 && code === 'LEARNING_DISABLED') || (status === 409 && code === 'REVISION_CONFLICT'))
          return 'on';
        return 'unknown';
      },
    );
  try {
    return await Promise.race([asked, late]);
  } finally {
    clearTimeout(timer);
  }
}

// 옛 꼴 사건을 옛 POST로(§18-5-3 ② — 부모 먼저 · 건수와 바이트로 자름, 지금 판 학습 호스트를 세우지 않는다). post(묶음) → 서버의 답.
// 차례: 결정 → 제시 → 딸린 사건 → 마침 → 응답 → 제외(옛 POST가 묶음마다 부모를 본다). 돌려줌 { ok, ids, skipped, gaveUp } — ids는 서버가
// 받은 번호. 옛 POST의 409 EVENT_CONFLICT는 「그 옛 꼴 묶음은 다른 판으로 이미 서버에 있다 — 되살리지 않는다」로 받는다: 번호가 없으면
// 옛 꼴 묶음(머리 + 자식을 쪼개지 않고)을 반씩 가려 걸리는 묶음만 건너뛰고, 번호가 있으면 그 번호의 묶음만 건너뛴다. 건너뛴 묶음이
// cap(8)을 넘으면 옛 꼴 몫의 남은 것을 건너뛴다(gaveUp — 부르는 쪽이 계기에). 다만 이미 머리(일부)를 보낸 묶음은 나머지까지 마저 보낸다 —
// 차례가 종류 먼저라 앞 묶음은 머리뿐이고, 표지의 until이 그 묶음들을 덮어 다시 고르지 않으므로 남기면 계정에 답 없는 제시가 남았다(Fable 5.2
// 끝 판 둘째 넘친 #20). 그 밖의 실패는 ok: false(표지 없이 다음에 다시). 옮기기가 끊긴 뒤
// 동의를 껐다 켜 판이 오르면 같은 번호 · 다른 판이라 다시 옮기기가 영영 실패하던 것(Fable 5.2 끝 판 F3 · 설계 주인 11-13).
export const LEGACY_SKIP_CAP = 8;
const legacyParent = event =>
  event?.presentationId ?? event?.targetId ?? event?.completionId ?? event?.decisionId ?? null;
// 사건 번호 → 그 옛 꼴 묶음의 뿌리(준 사건 안에서 부모를 거슬러 오른 끝).
function legacyRoots(events) {
  const byId = new Map(events.map(event => [event?.id, event]));
  const rootOf = event => {
    const seen = new Set();
    let at = event;
    for (let up = byId.get(legacyParent(at)); up && !seen.has(up); up = byId.get(legacyParent(at))) {
      seen.add(at);
      at = up;
    }
    return at?.id;
  };
  return new Map(events.map(event => [event?.id, rootOf(event)]));
}
const LEGACY_RANK = {
  'decision.made': 0,
  'practice.presented': 1,
  'experience.completed': 3,
  'feedback.given': 4,
  'record.excluded': 5,
};
const encoder = new TextEncoder();
export async function postLegacyBatches(events, post, { limit = 256, bytes = 200_000, cap = LEGACY_SKIP_CAP } = {}) {
  const rank = event => LEGACY_RANK[event?.type] ?? 2;
  const ordered = [...events].sort(
    (a, b) => rank(a) - rank(b) || String(a?.at ?? '').localeCompare(String(b?.at ?? '')),
  );
  const root = legacyRoots(ordered);
  const skipped = new Set(); // 건너뛴 묶음(뿌리 번호)
  const ids = [];
  const conflict = error => error?.status === 409 && error?.code === 'EVENT_CONFLICT';
  // 묶음을 건너뛴다 — cap을 넘으면 옛 꼴 몫 전체를 건너뛴다('gave-up').
  const skip = roots => {
    for (const id of roots) skipped.add(id);
    return skipped.size > cap ? 'gave-up' : 'ok';
  };
  // 한 묶음을 보낸다 — 받았으면 'ok', 409 EVENT_CONFLICT면 걸린 옛 꼴 묶음을 가려 건너뛰고, 그 밖의 실패는 'fail'.
  async function send(batch) {
    const live = batch.filter(event => !skipped.has(root.get(event?.id)));
    if (!live.length) return 'ok';
    try {
      if ((await post(live))?.ok !== true) return 'fail';
    } catch (error) {
      if (!conflict(error)) return 'fail';
      return Array.isArray(error.ids) && error.ids.length ? named(live, new Set(error.ids)) : sift(live);
    }
    ids.push(...live.map(event => event.id));
    return 'ok';
  }
  // 번호를 실은 409 — 그 번호의 묶음만 건너뛰고 나머지를 다시. 짚은 번호가 이 묶음에 없으면 되풀이하지 않게 실패로.
  async function named(live, hit) {
    const roots = new Set(live.filter(event => hit.has(event.id)).map(event => root.get(event.id)));
    if (!roots.size) return 'fail';
    const step = skip(roots);
    return step === 'ok' ? send(live) : step;
  }
  // 번호 없는 409 — 옛 꼴 묶음 단위로 반씩 나눠 걸리는 묶음을 찾는다(묶음 하나만 남으면 그 묶음을 건너뛴다).
  async function sift(live) {
    const roots = [...new Set(live.map(event => root.get(event.id)))];
    if (roots.length === 1) return skip(roots);
    const half = new Set(roots.slice(0, Math.ceil(roots.length / 2)));
    const first = await send(live.filter(event => half.has(root.get(event.id))));
    return first === 'ok' ? send(live.filter(event => !half.has(root.get(event.id)))) : first;
  }
  // 포기한 뒤 — 이미 보낸 묶음(건너뛴 것 말고)의 남은 사건을 같은 자르기로 마저 보낸다. 실패하면 실패(표지 없이 다음에 다시).
  async function finish() {
    const sent = new Set(ids);
    const started = new Set(ids.map(id => root.get(id)));
    const rest = ordered.filter(
      event => !sent.has(event?.id) && started.has(root.get(event?.id)) && !skipped.has(root.get(event?.id)),
    );
    let part = [];
    let used = 0;
    const flush = async () => {
      if (!part.length) return true;
      try {
        if ((await post(part))?.ok !== true) return false;
      } catch {
        return false;
      }
      ids.push(...part.map(event => event.id));
      part = [];
      used = 0;
      return true;
    };
    for (const event of rest) {
      const n = encoder.encode(JSON.stringify(event)).length;
      if ((part.length >= limit || (part.length && used + n > bytes)) && !(await flush())) return 'fail';
      part.push(event);
      used += n;
    }
    return (await flush()) ? 'gave-up' : 'fail';
  }
  const done = async step => {
    const end = step === 'gave-up' ? await finish() : step;
    return end === 'fail'
      ? { ok: false, ids, skipped: skipped.size, gaveUp: false }
      : { ok: true, ids, skipped: skipped.size, gaveUp: end === 'gave-up' };
  };
  let batch = [];
  let size = 0;
  for (const event of ordered) {
    const n = encoder.encode(JSON.stringify(event)).length;
    if (batch.length >= limit || (batch.length && size + n > bytes)) {
      const step = await send(batch);
      if (step !== 'ok') return done(step);
      batch = [];
      size = 0;
    }
    batch.push(event);
    size += n;
  }
  return done(batch.length ? await send(batch) : 'ok');
}

// 리허설 계정 길 — 리허설 서버의 /api/world/rehearsal/trail(rehearsal-trail.mjs)을 운영 계정 클라이언트(trail.get · post — talk
// lib/synk-account-client.js)와 같은 꼴로 감싼다. 오류는 { code, status, retryable, revision?, ids? }(엔진 sync.mjs failureOf가 가른다).
// headers(): 리허설 세션의 머리말(Authorization · X-Synk-Rehearsal-Tab — WorldClient와 같은 것). 운영은 world-account.mjs prepareAtlasTrail.
// owner(): 지금 세션의 주인 — 나르개를 받은 때의 주인과 다르면 요청 앞뒤에서 ACCOUNT_CHANGED로 던진다(운영 prepareAtlasTrail의 check와 같은
// 꼴 — 연습을 여는 사이 다른 합성 계정으로 들어오면 앞 계정의 코치가 새 토큰으로 받은 요약을 앞 계정 저장소에 받던 것, 넘친 #19).
// 손님 세션(로그아웃한 뒤)이면 계정 줄을 묻지 않고, 받은 줄에는 그때의 주인(account)을 싣는다 — 입구가 제 주인과 견준다(카본 끝 판 둘째 C).
// onAuth(): 401을 받으면 부른다 — 셸이 WorldClient의 401과 같은 일(로그인으로)을 한다. 운영 나르개는 401에서 세션을 닫는데 리허설 나르개는
// 클라이언트를 지나지 않아 아무도 받지 않았다 — 세션이 끝난 뒤 안내 없이 기기에만 쌓였다(Fable 5.2 끝 판 둘째 넘친 #9).
export function rehearsalTrail({ fetcher = (...args) => globalThis.fetch(...args), headers = () => ({}), owner = () => null, onAuth = null } = {}) {
  const changed = () => Object.assign(new Error('ACCOUNT_CHANGED'), { code: 'ACCOUNT_CHANGED' });
  // 401은 주인이 그대로일 때만 셸에 알린다(로그인으로) — 앞 계정의 늦은 요청이 새 세션까지 로그인 화면으로 돌리지 않게(GPT · 카본 합친 끝 판
  // GC1 · C5). 주인이 바뀌었으면 그 답은 ACCOUNT_CHANGED로 버린다.
  async function call(path, { method = 'GET', body } = {}, from = undefined) {
    if (from !== undefined && owner() !== from) throw changed();
    let data;
    try {
      data = await send(path, { method, body });
    } catch (error) {
      if (from !== undefined && owner() !== from) throw changed();
      if (error?.status === 401)
        try {
          onAuth?.();
        } catch {
          // 셸의 정리는 실패를 던지는 것을 막지 않는다
        }
      throw error;
    }
    if (from !== undefined && owner() !== from) throw changed();
    return data;
  }
  async function send(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetcher(`/api/world/${path}`, {
        method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Synk-Product': 'world',
          'X-Synk-Contract': '1',
          'X-Synk-Rehearsal': '1',
          ...headers(),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw Object.assign(new Error('NETWORK'), { code: 'NETWORK', retryable: true });
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || data?.ok === false) {
      const status = response.status;
      const code = (typeof data?.error === 'string' ? data.error : data?.error?.code) || 'SERVER_UNAVAILABLE';
      throw Object.assign(new Error(code), {
        code,
        status,
        retryable: status >= 500 || status === 408 || status === 429,
        ...(Number.isSafeInteger(data?.revision) ? { revision: data.revision } : {}),
        ...(Array.isArray(data?.ids) ? { ids: data.ids } : {}),
      });
    }
    return data;
  }
  const query = (revision, since) => {
    const q = new URLSearchParams({ revision: String(revision) });
    if (since) {
      q.set('edition', since.edition);
      q.set('since', String(since.seq));
      if (since.gen) q.set('gen', since.gen);
    }
    return q.toString();
  };
  return async () => {
    const from = owner();
    if (from === 'guest') throw changed();
    const data = await call('rehearsal/trail-account', {}, from);
    const revision = data?.learning?.revision;
    return {
      ...(typeof from === 'string' && from ? { account: from } : {}),
      learning: data?.learning ?? null,
      learningSync: data?.capabilities?.learningSync === true,
      transport: at =>
        Object.freeze({
          get: since => call(`rehearsal/trail?${query(at, since)}`, {}, from),
          post: (events, since) =>
            call('rehearsal/trail', { method: 'POST', body: { revision: at, events, ...(since ? { since } : {}) } }, from),
        }),
      postLegacy: events => call('rehearsal/trail-legacy', { method: 'POST', body: { revision, events } }, from),
    };
  };
}

// 첫 답 수(물음의 「답 N개」 — 지금 판 guestLearningEvents와 같은 셈): 옛 꼴 · 2판 모두 첫 시도의 답.
const firstAnswers = events =>
  events.filter(event => event?.type === 'practice.attempted' && event.attemptNo === 1).length;

const OLD = code => ({ path: 'old', code });
const GUEST = Object.freeze({ path: 'guest' });

// owner: 'guest' 또는 계정 id. lang(): 지금 화면 언어. label(id): 능력 이름(단위 이름은 엔진의 지도가 안다).
// storage: 옛 기록 · 표지를 둘 저장소(시험만 준다 — 주지 않으면 이 기기의 localStorage, null이면 읽개 · 표지 없이).
// trail: 계정 길(계정만 — 셸이 준다) — async () → { account?, learning: { enabled, revision }, learningSync, transport(revision) → { get(since),
//   post(events, since) }, postLegacy(events) → 답 }. 운영은 world-account.mjs prepareAtlasTrail, 리허설은 위 rehearsalTrail.
//   부를 때마다 계정을 다시 읽는다(판 · 동의 · 쓰기 문이 바뀌었으면 그 값으로). account(줄의 주인)를 실으면 이 입구의 주인과 같을 때만 쓴다.
// health: 계기(시험 · 셸이 줄 때만). 주지 않으면 엔진을 받은 뒤 엔진의 createHealth로 만들고, 그전 실패는 모았다가 옮긴다(§18-2 9 · F7).
export function createAtlasNext({
  owner,
  lang = () => 'ko',
  label = () => null,
  load = () => import(ENTRY),
  health: given = null,
  storage,
  trail = null,
  firstSyncMs = FIRST_SYNC_MS,
  switchAskMs = SWITCH_ASK_MS,
} = {}) {
  let health = given;
  const early = [];
  const note = (kind, outcome) => {
    if (health) health.note(kind, outcome);
    else if (early.length < 32) early.push([kind, outcome]);
  };
  const store = storage === undefined ? deviceStorage(note) : storage;
  const account = owner !== 'guest';
  // 은행 조합 · 판마다 코치 하나(준비 중인 약속째) — 후보에 다른 은행이 섞이면 그 은행을 받는 코치를 따로 연다(아르곤 끝 판 B5 · 다시 A4).
  // 같은 저장소의 호스트를 나눠 쓰므로 기록은 하나다.
  const coaches = new Map();
  const watchers = new Map(); // 코치 → 판을 다시 정해 닫을 때 부를 함수들(연습 화면이 안내 한 줄과 함께 닫힌다)
  const gone = new WeakMap(); // 판을 다시 정해 닫은 코치 → 그 까닭
  let disposed = false;
  let generation = 0; // 판을 다시 정할 때마다 오른다 — 앞 판에서 열기 시작한 코치는 돌려주지 않는다
  let decided = null; // 계정의 판(약속) — 다시 정하면 비운다
  // 지금 판으로 정했던 판이 풀렸을 때 부를 함수들(§19-3 7 — 생활 · 홈은 문서를 열 때 정한 지금 판을 붙들지 않는다). 규칙은 갈래를 세지
  // 않는다(설계 주인 11-13 · Fable 5.2 끝 판 둘째 F2): 면(practiceCoach · lifeCoach)에 지금 판(null)을 준 뒤 새 길 코치를 주게 되면 까닭이
  // 무엇이든 알린다 — 계정을 못 읽은 일시 실패 뒤 다시 읽음 · 낮춘 판 되돌림 · 꺼짐 표지 뒤 켜짐 · 엔진 · 지도 · 저장소를 못 받은 뒤 됨,
  // 계정 · 손님 모두(answered). 판이 풀린 것을 먼저 안 자리(정하기 · 다시 묻기 · 낮춤 되돌림)는 그때 바로 알리고, 그 알림 뒤 면이 다시 물어 새
  // 길을 받으면 또 알리지 않는다(told). lastPath는 마지막으로 정한 판의 길이다(연습이 다시 정한 것을 생활 화면이 모르고 지금 판으로 남지
  // 않게 — 아르곤 A4).
  const reopeners = new Set();
  let lastPath = null;
  let gave = null; // 면에 마지막으로 준 판 — 'old'(지금 판) · 'next'(새 길 코치)
  let told = false; // 지금 판을 준 뒤 이미 알렸다
  // 판이 풀린 횟수(알렸든 안 알렸든) — 면이 판을 묻는 사이에 풀렸는데(아직 지금 판을 주기 전이라 알림이 버려짐) 그 면이 낡은 지금 판을
  // 주면, 준 직후 알린다(카본 합친 끝 판 C3 ②).
  let loosened = 0;
  function reopen(reason) {
    loosened += 1;
    if (disposed || gave !== 'old' || told) return;
    told = true;
    for (const fn of [...reopeners])
      try {
        fn({ reason });
      } catch {
        // 한 화면의 실패가 다른 화면의 다시 묻기를 막지 않는다
      }
  }
  // 면에 준 판을 적는다(practiceCoach · lifeCoach가 돌려주는 값) — 지금 판 뒤의 새 길이면 알린다(위 규칙). since: 그 면이 묻기 시작할 때의
  // loosened — 묻는 사이에 판이 풀렸으면 지금 판을 준 직후 알린다.
  function answered(made, since = loosened) {
    if (disposed) return made;
    const was = gave;
    if (!made) {
      gave = 'old';
      told = false;
      if (since !== loosened) reopen('loosened');
      return made;
    }
    if (was === 'old') reopen('opened');
    gave = 'next';
    told = false;
    return made;
  }
  let loaded = null;

  // 입구(로더) · 엔진 모듈. 엔진은 로더의 SynkAtlas.load()(코치가 받는 것과 같은 약속) — 계기 · 저장소 이름(storeName)을 엔진에서 받는다.
  function entry() {
    loaded ??= Promise.resolve()
      .then(load)
      .then(async module => {
        let engine = null;
        try {
          engine = (await module?.SynkAtlas?.load?.()) ?? null;
        } catch {
          engine = null; // 코치의 ready가 같은 실패를 알린다
        }
        if (!health && typeof engine?.createHealth === 'function') {
          health = engine.createHealth();
          for (const [kind, outcome] of early.splice(0)) health.note(kind, outcome);
        }
        // 엔진을 못 받았으면(한 번의 네트워크 실패 등) 이 결과를 붙들지 않는다 — 문서 내내 엔진 없이 정하지 않게(카본 끝 판 B).
        if (!engine) loaded = null;
        return { coach: module.coach, engine };
      });
    loaded.catch(() => {
      loaded = null; // 못 받았으면 다음에 다시
    });
    return loaded;
  }

  // ── 계정의 판 정하기(§18-2 1 · §18-5-5 B4 · F6 · G4) ──────────────────────────────────────────
  // 계정을 못 읽은 실패(네트워크 · 인증 등)는 붙들지 않는다 — 다음 연습에서 다시 읽는다. 정한 판(지금 판 포함)은 다시 정할 때까지 쓴다.
  const failCode = error =>
    typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,30}$/.test(error.code) ? error.code : 'DECIDE_FAILED';
  const transientError = error => error?.retryable === true || error?.code === 'NETWORK';
  // 계정 줄을 읽는다 — 줄이 주인을 실으면(운영 prepareAtlasTrail · 리허설 rehearsalTrail) 이 입구의 주인과 같을 때만 쓴다. 입구를 만든 뒤
  // 세션이 다른 계정 · 손님으로 바뀌었는데 입구가 닫히기 전에 읽으면 새 계정의 판 · 나르개가 앞 계정의 저장소 · 표지에 붙었다(카본 끝 판 둘째 C).
  async function readLine() {
    const line = await trail();
    if (line?.account !== undefined && line.account !== owner)
      throw Object.assign(new Error('ACCOUNT_CHANGED'), { code: 'ACCOUNT_CHANGED' });
    return line;
  }
  // 계정 줄이 이 올리는 길의 판 그대로인가(판 · 동의 · 쓰기 문 · 나르개).
  const sameUpload = (plan, line) =>
    plan?.path === 'upload' &&
    line?.learning?.revision === plan.revision &&
    line?.learning?.enabled === true &&
    line?.learningSync === true &&
    typeof line?.transport === 'function';
  function decide() {
    if (decided) return decided;
    const at = generation;
    const deciding = decidePath(at)
      .catch(error => {
        if (decided === deciding && generation === at) decided = null;
        return settled(OLD(failCode(error)));
      })
      .then(plan => {
        if (generation !== at) return plan;
        const was = lastPath;
        lastPath = plan.path;
        // 지금 판 뒤에 새 길로 정해졌다(계정을 못 읽은 일시 실패 뒤 다시 읽음 등) — 지금 판으로 남은 면이 다시 묻게 알린다.
        if (was === 'old' && plan.path !== 'old') reopen('decided');
        return plan;
      });
    decided = deciding;
    return deciding;
  }
  function settled(plan) {
    if (plan.path === 'old') note('load', { ok: false, code: `PATH_${plan.code}`.slice(0, 40) });
    return plan;
  }
  // at: 이 판을 정하기 시작한 세대 — 기다리는 사이(계정 읽기 · 엔진 받기 · 스위치 묻기) 판을 다시 정했으면 표지를 쓰지 않는다(그 판은
  // 쓰이지 않는다 — planNow가 다시 정한다, GPT 끝 판 둘째 C와 같은 짜임).
  async function decidePath(at) {
    const mark = markOf(store, owner);
    if (mark.off) {
      void recheck(at); // 뒤에서 다시 물어 열리면 다음 연습부터 새 길
      return settled(OLD('SWITCH_OFF'));
    }
    if (typeof trail !== 'function') return settled(OLD('NO_TRAIL'));
    let line;
    try {
      line = await readLine();
    } catch (error) {
      const kept = await keptPath(mark, error, at);
      if (kept) return kept;
      throw error;
    }
    const revision = line?.learning?.revision;
    // 꼴에 안 맞는 계정 줄도 일시 실패로 — 입구 수명 내내 지금 판으로 붙들지 않고 다음 연습에서 다시 읽는다(Fable 5.2 끝 판 F1).
    if (!Number.isSafeInteger(revision) || revision < 1 || typeof line.transport !== 'function')
      throw Object.assign(new Error('ACCOUNT_UNREAD'), { code: 'ACCOUNT_UNREAD' });
    if (line.learning.enabled === true && line.learningSync === true)
      return { path: 'upload', revision, line, transport: line.transport(revision), went: mark.went };
    // 기기 길(F6) — 올리지 않는다. 저장소 이름은 엔진이 짓고(E1), 스위치는 받기 한 번으로 묻는다(꺼짐이면 지금 판).
    let engine = null;
    try {
      ({ engine } = await entry());
    } catch {
      engine = null;
    }
    // 엔진을 못 받은 것은 일시 실패다 — 붙들지 않고 다음 연습에서 다시 정한다(카본 끝 판 B). 기기 길인 것은 이미 알았다(DEVICE_UNLOADED).
    if (typeof engine?.storeName !== 'function')
      throw Object.assign(new Error('Atlas engine not loaded'), { code: 'DEVICE_UNLOADED' });
    const asked = await askSwitch(line.transport(revision), switchAskMs);
    const current = !disposed && at === generation;
    if (asked === 'off') {
      if (current) writeMark(store, owner, { off: true });
      return settled(OLD('SWITCH_OFF'));
    }
    if (asked !== 'on' && !mark.went) return settled(OLD('SWITCH_UNKNOWN'));
    if (current) writeMark(store, owner, { went: true, path: 'device', revision });
    return { path: 'device', revision, key: engine.storeName({ account: owner, revision, local: true }) };
  }
  // 새 길에 다녀간 계정이 계정 읽기에 네트워크 · 일시 실패로 못 닿으면(휴대폰을 오프라인으로 다시 엶) 표지의 마지막 길 · 판으로 새 길을
  // 연다 — 보기는 그 판의 기기 요약에서, 올리기는 나르개가 계정을 다시 읽을 때까지 오프라인 갈래다. 돌아와 판이 달랐으면 서버의 409 →
  // onAccount가 다시 정한다(이미 있는 길). 인증 실패 · 주인 바뀜 · 그 밖은 그 값으로 열지 않는다 — 표지는 계정마다라 남의 저장소를 열지
  // 않게(Fable 5.2 끝 판 F1 — 계획 §6 「켠 계정이 오프라인으로 다시 열어도 새 길이고 어제 놓친 것이 맨 앞」, 설계 주인 11-13).
  // 두 길 모두 「미확인」(unread)이다 — 계정 판을 확인하지 못했으니 옮기기 물음은 세지 않고(「못 셈」), 다음 연습 · 물음이 계정을 다시 읽어
  // 그대로면 푼다(planNow · 올리는 길은 나르개도 — GPT · 카본 끝 판 둘째 C).
  async function keptPath(mark, error, at) {
    if (!mark.went || !mark.path || !transientError(error) || error?.status === 401 || error?.code === 'ACCOUNT_CHANGED') return null;
    if (mark.path === 'upload') {
      const plan = { path: 'upload', revision: mark.revision, line: null, went: true, unread: true };
      plan.transport = unreadTransport(plan, at);
      return plan;
    }
    let engine = null;
    try {
      ({ engine } = await entry());
    } catch {
      engine = null;
    }
    // 엔진을 못 받았다 — 기기 길로 확인된 계정(DEVICE_UNLOADED · 지금 판 물음)이 아니다: 계정을 못 읽어 그 판을 확인하지 못했으니 옮기기
    // 물음은 「못 셈」이다(SETTLED_OLD 밖 — 설계 주인 11-13 · GPT 끝 판 둘째 GC3).
    if (typeof engine?.storeName !== 'function')
      throw Object.assign(new Error('Atlas engine not loaded'), { code: 'DEVICE_UNREAD' });
    const key = engine.storeName({ account: owner, revision: mark.revision, local: true });
    return { path: 'device', revision: mark.revision, key, unread: true };
  }
  // 계정을 못 읽은 채 연 올리는 길의 나르개 — 부를 때 계정을 다시 읽어 그 판의 나르개로 잇는다(아직 못 닿으면 그 실패를 그대로 던져 호스트가
  // 물러서며 다시 한다). 읽혔고 아직 이 판이면 판 · 동의 · 쓰기 문이 그대로일 때 줄을 채워 미확인을 풀고(옮기기 물음이 센다), 달라졌으면
  // 판을 다시 정한다 — 쓰기 문만 닫혀도 받기는 200으로 지나가 올리기가 실패할 때까지 이 코치에 머물던 것(카본 끝 판 둘째 C). 앞 세대의
  // 판이면 표지의 판으로 부른다 — 서버가 판 울타리(409 REVISION_CONFLICT)로 답하면 호스트가 알린다.
  function unreadTransport(plan, at) {
    let real = null;
    const ready = async () => {
      if (real) return real;
      const line = await readLine();
      if (typeof line?.transport !== 'function')
        throw Object.assign(new Error('ACCOUNT_UNREAD'), { code: 'ACCOUNT_UNREAD', retryable: true });
      if (plan.unread && !disposed && at === generation) {
        if (!sameUpload(plan, line)) {
          retire('account');
          throw Object.assign(new Error('PLAN_CHANGED'), { code: 'PLAN_CHANGED', retryable: true });
        }
        adopt(plan, line);
      }
      real = line.transport(plan.revision);
      return real;
    };
    return Object.freeze({
      get: async since => (await ready()).get(since),
      post: async (events, since) => (await ready()).post(events, since),
    });
  }
  // 표지로 연 올리는 길이 계정을 다시 읽어 그 판 그대로였다 — 줄을 채우고 미확인을 푼다(옛 POST · 옮기기 물음이 이 줄을 쓴다).
  function adopt(plan, line) {
    plan.line = line;
    plan.unread = false;
  }
  // at: 꺼짐 표지로 지금 판을 정한 판(세대). 다시 물어 켜졌으면 표지를 지우고, 그 판이 아직 지금 판이면 정한 것을 비운다 — 다음 연습(코치를
  // 청할 때)이 다시 정해 새 길로 간다(새로고침을 기다리지 않는다 — GPT 끝 판 GB2, 첫 받기를 다른 코치가 확인한 markWent와 같은 갈래).
  async function recheck(at) {
    if (typeof trail !== 'function') return;
    try {
      const line = await readLine();
      const revision = line?.learning?.revision;
      if (!Number.isSafeInteger(revision) || typeof line.transport !== 'function') return;
      if ((await askSwitch(line.transport(revision), switchAskMs)) === 'on') {
        writeMark(store, owner, { off: false });
        if (!disposed && at === generation) {
          decided = null;
          reopen('switch'); // 꺼짐 표지 뒤 켜짐 — 지금 판으로 남은 면이 다시 묻는다(§19-3 7)
        }
      }
    } catch {
      // 다음 시작에 다시 묻는다
    }
  }

  // 호스트가 셸에 알림(§18-5-2 표 — 판 · 동의 · 스위치 · 인증 · 그 밖). 판을 다시 정할 일이면 열린 코치를 닫는다.
  // at: 알린 코치를 연 판(세대) — 이미 다시 정한 뒤에 온 앞 판의 알림 · 늦게 끝난 다시 확인은 새 판의 코치를 닫지 않는다(카본 끝 판 B).
  // plan: 알린 코치를 연 판 — 다시 확인은 그 판과 견준다(그사이 같은 세대에서 decided를 비웠어도 — 넘친 #21).
  function changed(detail = {}, at = generation, plan = null) {
    if (disposed || at !== generation) return;
    const kind = detail?.kind;
    if (kind === 'auth') return; // 셸의 인증 처리에 맡긴다(운영: 계정 클라이언트가 토큰을 다시 받고도 안 되면 로그아웃)
    if (kind === 'writes' || kind === 'other' || kind == null) {
      // 쓰기 문만 닫힘 · 그 밖(426 · 404 등 그 밖의 4xx) — 호스트는 올리기 · 받기만 멈췄다. 계정을 다시 읽어 판 · 동의 · 쓰기 문이 달라졌을
      // 때만 닫는다. 그대로면 코치를 둔다 — 사건은 기기에 쌓이고 다음에 연 호스트가 다시 올린다(넘친 #7 — 같은 답이 이어지는 동안
      // 연습이 열자마자 닫히던 것).
      void recheckLine(at, kind === 'writes' ? 'writes' : 'other', plan);
      return;
    }
    if (kind === 'switch') writeMark(store, owner, { off: true });
    retire(kind);
  }
  let rechecking = null; // 다시 확인하는 판(같은 판의 겹친 알림은 한 번만 읽는다)
  let unsure = null; // 알림 뒤 계정을 못 읽은 판(세대) — 다음 연습 · 물음이 계정을 다시 읽어 정한다(planNow)
  async function recheckLine(at, reason, opened) {
    if (rechecking === at) return;
    rechecking = at;
    try {
      const line = await readLine();
      if (disposed || at !== generation) return;
      // 견줄 판 — 알린 코치를 연 판. 같은 세대에서 낮춘 판을 되돌리며 decided를 비웠으면 그것을 기다리면 판이 없어(undefined) 그대로인
      // 계정에도 코치를 닫았다(넘친 #21).
      const plan = opened ?? (await decided);
      if (disposed || at !== generation) return;
      if (!sameUpload(plan, line)) retire(reason);
      else if (plan.unread) adopt(plan, line);
    } catch (error) {
      // 계정을 못 읽었다 — 일시 실패면 지금 코치는 두고 다음 연습 · 물음이 다시 읽어 정하게 표시하고, 그 밖(인증 · 주인 바뀜 · 꼴)이면 판을
      // 다시 정한다(못 읽은 채 멈춘 코치를 문서 내내 다시 쓰던 것 — 카본 끝 판 둘째 C).
      if (disposed || at !== generation) return;
      if (transientError(error)) unsure = at;
      else retire(reason);
    } finally {
      if (rechecking === at) rechecking = null;
    }
  }
  // 판을 다시 정한다 — 열린 코치를 닫고(그 코치로 돌던 연습 화면에 먼저 알린다), 다음 practiceCoach가 계정을 다시 읽는다.
  function retire(reason) {
    generation += 1;
    decided = null;
    const open = [...coaches.values()];
    coaches.clear();
    for (const opening of open)
      void opening.then(made => {
        if (!made) return;
        gone.set(made, reason); // 닫은 뒤에 건 retired도 울린다 — 닫히기 직전에 그 코치를 받은 면이 영영 모르지 않게(카본 합친 끝 판 C2)
        for (const fn of [...(watchers.get(made) ?? [])])
          try {
            fn({ reason });
          } catch {
            // 화면의 정리는 코치를 닫는 것을 막지 않는다
          }
        watchers.delete(made);
        made.dispose();
      });
  }

  function hostOf(plan, at) {
    if (plan.path === 'guest') return { guest: true, health, legacy: store ? legacyReader(store) : null };
    if (plan.path === 'device')
      // 기기 길 계정에는 손님 기기의 옛 기록 읽개를 주지 않는다 — 손님 기록은 옮기기 물음을 지나서만 계정으로 간다(R16 · E2). 서버와
      // 오가지 않으니 알림은 저장소 닫힘(다른 탭이 판이 오른 저장소를 열어 이 판을 지움)뿐이다 — 판을 다시 정한다(F5 · 설계 주인 11-13).
      return { guest: true, account: owner, revision: plan.revision, key: plan.key, health, onAccount: detail => changed(detail, at) };
    return { account: owner, revision: plan.revision, transport: plan.transport, health, onAccount: detail => changed(detail, at, plan) };
  }

  // 올리는 길 — 이 기기에 그 계정 · 그 동의 판의 요약이 있거나(빈 요약 포함) 새 길 간 적이 있으면 새 길, 처음인 기기는 첫 받기를 한도 안에서
  // 기다려 요약을 받으면 새 길, 못 받으면 이번에는 지금 판(까닭은 계기에, 스위치 꺼짐이면 표지).
  let lowered = null; // 첫 받기를 못 해 이번 문서를 지금 판으로 낮춘 판(세대)
  // at: 이 코치를 연 판(세대) — 여는 사이(준비 · 첫 받기) 판을 다시 정했으면 앞 판의 코치는 표지를 쓰지 않는다: 늦게 준비된 판 1 코치가
  // 판 2의 표지를 판 1로 되돌려 다음 오프라인 재개가 앞 판을 열던 것(GPT 끝 판 둘째 C).
  async function confirmed(made, plan, at) {
    if (plan.went || made.summary().storage.base) return markWent(plan, at);
    const first = await made.synced(firstSyncMs);
    if (disposed || at !== generation) return false;
    // 같은 판의 다른 코치(옮기기 물음 · 다른 은행)가 그사이 새 길을 확인했으면 그대로 새 길이다.
    if ((first.ok && first.base) || plan.went || markOf(store, owner).went) return markWent(plan, at);
    // 스위치 꺼짐(받기의 403 FEATURE_DISABLED)은 지금 판으로 정해진 것이다 — 꺼짐 표지로 정할 때와 같은 까닭으로 낮춰 옮기기 물음도 지금 판
    // 물음으로 간다(「못 셈」으로 남아 손님 기록을 옮길 수 없던 것 — 카본 끝 판 둘째 C).
    const code = first.kind === 'switch' ? 'SWITCH_OFF' : (first.code ?? 'FIRST_SYNC');
    if (first.kind === 'switch') writeMark(store, owner, { off: true });
    // 이번 문서에서는 지금 판으로 — 연습마다 첫 받기를 다시 기다리지 않게(다시 열면 · 주인이 바뀌면 다시 정한다).
    if (decided && generation === at) {
      decided = Promise.resolve(OLD(code));
      lowered = at;
      lastPath = 'old';
    }
    note('load', { ok: false, code: `PATH_${code}`.slice(0, 40) });
    return false;
  }
  function markWent(plan, at) {
    if (disposed || at !== generation) return false;
    const mark = markOf(store, owner);
    if (!plan.went || mark.path !== 'upload' || mark.revision !== plan.revision) {
      writeMark(store, owner, { went: true, path: 'upload', revision: plan.revision });
      plan.went = true;
    }
    // 같은 판의 다른 코치가 먼저 낮췄으면 다음 연습에서 다시 정한다(표지가 있어 곧 새 길).
    if (lowered === at && generation === at) {
      lowered = null;
      decided = null;
      reopen('lowered'); // 낮춘 판 되돌림 — 지금 판으로 남은 면이 다시 묻는다(§19-3 7)
    }
    return true;
  }

  // 입구 받기 · 코치 만들기 · 준비 — 어디서 실패해도 계기에 원인을 남기고 null(셸은 지금 판으로 간다).
  async function open(banks, plan, at, gameId) {
    let made = null;
    try {
      const { coach } = await entry();
      made = coach({
        gameId,
        banks,
        // 이유 줄이 「「은행」 처음 만나요」처럼 낱말 이름을 말하려면 낱말 이름이 든다 — 조각이 실으면 조각에서, 아니면 낱말 표에서.
        words: true,
        host: hostOf(plan, at),
        lang: lang(),
        label,
      });
      await made.ready;
      if (plan.path === 'upload' && !(await confirmed(made, plan, at))) {
        made.dispose();
        return null;
      }
    } catch (error) {
      note('load', {
        ok: false,
        code: error?.reason ? `LOAD_${error.reason}` : (error?.code ?? 'LOAD_FAILED'),
      });
      // 계정이 새 길로 정해졌는데 엔진 · 지도 · 저장소를 못 받아 이번 연습이 지금 판으로 가는 것 — 따로 세어 4-8에서 얼마나 밟는지 본다
      // (Fable 5.2 끝 판 F1 · 설계 주인 11-13). 판은 붙들지 않는다 — 다음 연습에서 다시 연다(카본 끝 판 B · 다시 A2).
      if (plan.path !== 'guest') note('load', { ok: false, code: 'PATH_ENGINE' });
      made?.dispose();
      return null;
    }
    note('load', { ok: true });
    return made;
  }

  // gameId: 판 번호 · 도움의 contentRef · 단계 5 판 비교가 읽는 경험 이름(짧은 연습 world-practice · 생활 world-life — §19 M9).
  // at: 판을 정한 세대(planNow) — 앞 세대의 판이면 열지 않는다(판을 다시 정한 뒤 늦게 온 판으로 연습을 열지 않게, GPT 끝 판 둘째 C).
  function coachFor(plan, banks, gameId = 'world-practice', at = generation) {
    if (disposed || at !== generation) return Promise.resolve(null);
    const key = `${plan.path}:${plan.revision ?? 0}:${gameId}:${banks.join(',')}`;
    if (!coaches.has(key)) {
      const opening = open(banks, plan, at, gameId).then(made => {
        if (made && (at !== generation || disposed)) {
          made.dispose(); // 여는 사이에 판을 다시 정했다 — 앞 판의 코치는 돌려주지 않는다
          return null;
        }
        if (!made && coaches.get(key) === opening) coaches.delete(key); // 못 열었으면 다음에 다시
        return made;
      });
      coaches.set(key, opening);
    }
    // 준비되는 사이에 닫혔으면 돌려주지 않는다 — 그 코치는 dispose()가 닫는다(떠난 화면의 코치 · 호스트가 남지 않게). 받는 사이에 판을 다시
    // 정했으면(앞 세대 — 이미 연 코치를 다시 쓰는 길도) 그 코치는 retire가 닫으니 돌려주지 않는다(GPT · 카본 합친 끝 판 GC2 · C1 · C2).
    return coaches.get(key).then(made => (disposed || at !== generation ? null : made));
  }
  // 면(짧은 연습 · 생활)의 계정 코치 — 판을 정해 그 판의 코치를 연다. 여는 사이에 판을 다시 정했으면(그 판의 코치는 닫혔다 — 여는 길 자신이
  // 첫 받기에서 다시 정한 것 포함) 한 번만 다시 정한다(되풀이하면 세대가 이어 바뀌는 동안 끝나지 않는다). 견줄 세대는 planNow가 마지막으로
  // 판을 정하기 직전의 것이다(자기가 다시 정한 판까지 버리지 않게).
  async function faceCoach(banks, gameId, since) {
    for (let tries = 0; tries < 2; tries += 1) {
      const now = await planNow();
      if (disposed) return null;
      if (!now || now.plan.path === 'old') return answered(null, since);
      const made = await coachFor(now.plan, banks, gameId, now.at);
      if (disposed) return null;
      if (now.at === generation) return answered(made, since);
    }
    return answered(null, since);
  }

  // 지금 세대의 판(계정) → { plan, at } · 못 정하면 null(이번은 지금 판). 기다리는 사이(계정 읽기 · 엔진 받기) 판을 다시 정했으면 앞 판을
  // 버리고 다시 정한다 — 늦게 온 판 1에 판 2의 세대를 붙여 판 1 나르개로 연습을 열던 것(GPT 끝 판 둘째 C). 다시 읽어 볼 판(기기 길 · 표지로
  // 연 미확인 판 · 알림 뒤 못 읽은 판)은 한 번 읽어, 그대로면 그 판이고 달라졌으면 다시 정한다.
  async function planNow() {
    let looked = false;
    for (let tries = 0; tries < 3 && !disposed; tries += 1) {
      const at = generation;
      const plan = await decide();
      if (disposed) return null;
      if (at !== generation) continue;
      if (!looked && (plan.unread || plan.path === 'device' || unsure === at)) {
        looked = true;
        const fresh = await lookAgain(plan);
        if (disposed) return null;
        if (at !== generation) continue;
        if (fresh === false) {
          retire('account');
          continue;
        }
        if (fresh === true && unsure === at) unsure = null;
      }
      return { plan, at };
    }
    return null;
  }
  // 계정을 다시 읽어 이 판이 그대로인가 — true(그대로 · 미확인 올리는 길이면 줄을 채워 푼다) · false(달라졌다 — 다시 정한다) · null(못
  // 읽었다 — 그대로 간다, 기기 길은 기기가 원천이다). 기기 길은 서버와 오가지 않아 판 · 동의가 바뀐 것을 알 길이 없어 열 때마다 읽는다(운영은
  // 게임 열기처럼 verify 한 번). 표지로 연 기기 길은 스위치를 묻지 못했다 — 읽히면 처음부터 다시 정한다.
  async function lookAgain(plan) {
    let line;
    try {
      line = await readLine();
    } catch {
      return null;
    }
    if (plan.path === 'device') {
      const learning = line?.learning;
      return !plan.unread && learning?.revision === plan.revision && !(learning?.enabled === true && line?.learningSync === true);
    }
    if (plan.path !== 'upload') return true;
    if (!sameUpload(plan, line)) return false;
    if (plan.unread) adopt(plan, line);
    return true;
  }

  return {
    createPracticeNextSession,
    // 짧은 연습의 코치 — 손님은 손님 저장소, 계정은 정한 판의 저장소. 지금 판이면 null. 한 번 연 코치는 다시 쓴다.
    async practiceCoach(pool) {
      if (disposed) return null;
      const since = loosened;
      if (!account) return answered(await coachFor(GUEST, banksOf(pool)), since);
      return faceCoach(banksOf(pool), 'world-practice', since);
    },
    // 셸이 이 문서에서 학습 기록 설정(동의)을 바꾼 뒤 — 판을 다시 정한다(연 코치를 닫고 다음 연습이 계정을 다시 읽는다). 다른 기기에서 바뀐
    // 것만 올리기의 답으로 안다(넘친 #18 — 앞 판 코치로 연 다음 연습의 첫 답이 앞 판 저장소에만 남아 버려지던 것).
    redecide(reason = 'account') {
      if (!disposed && account) retire(reason);
    },
    // 생활 화면의 코치(4-2 — 은행 world-life · 경험 world-life, §19-1 ①). 짧은 연습과 같은 판 정하기 · 같은 호스트(저장소)이고,
    // 새 길 문서의 시작 때 셸이 미리 연다(M7 — 「돌아온 복습」 판정이 홈의 첫 그림부터 엔진을 읽게). 지금 판이면 null.
    async lifeCoach() {
      if (disposed) return null;
      const since = loosened;
      if (!account) return answered(await coachFor(GUEST, LIFE_BANKS, 'world-life'), since);
      return faceCoach(LIFE_BANKS, 'world-life', since);
    },
    // 지금 판을 준 뒤 새 길이 될 수 있을 때(판이 풀림 · 지금 판 뒤 새 길 코치를 줌) 부를 함수 — 생활 · 홈이 판을 다시 묻는다(§19-3 7 — 까닭을
    // 세지 않는다, 계정 · 손님 모두). retired(새 길 → 다시 정함)의 짝이다. 돌려준 함수로 끊는다.
    reopened(fn) {
      if (typeof fn !== 'function' || disposed) return () => {};
      reopeners.add(fn);
      return () => reopeners.delete(fn);
    },
    // 판을 다시 정해 그 코치를 닫을 때 부를 함수(연습 화면이 안내 한 줄과 함께 닫히게). 돌려준 함수로 끊는다.
    retired(made, fn) {
      if (!made || typeof fn !== 'function' || disposed) return () => {};
      // 이미 판을 다시 정해 닫은 코치 — 곧바로(다음 차례에) 알린다. 닫히기 직전에 그 코치를 받은 면이 닫힌 코치를 붙들고 남지 않게(카본 C2).
      if (gone.has(made)) {
        const reason = gone.get(made);
        let live = true;
        queueMicrotask(() => {
          if (!live || disposed) return;
          try {
            fn({ reason });
          } catch {
            // 화면의 정리는 다른 화면의 알림을 막지 않는다
          }
        });
        return () => {
          live = false;
        };
      }
      if (!watchers.has(made)) watchers.set(made, new Set());
      watchers.get(made).add(fn);
      return () => watchers.get(made)?.delete(fn);
    },
    // 손님 → 계정 옮기기 물음(§18-5-3 — 셸의 기기 기록 물음이 부른다). 올리는 길의 계정만 — 계정 코치가 손님 저장소를 옆으로 열어
    // (옛 기록 읽개와 함께 — 계정으로 시작한 문서도 옛 손님 연습을 센다, R7) 옮길 수를 센다. 손님 저장소는 고를 옛 기록이 있을 때만
    // 만든다(새 길을 켜기 전에 손님으로만 연습한 기기 — 만들지 않으면 그 연습이 물음에서 빠진다). 옮길 것이 없으면(손님 저장소도
    // 고를 옛 기록도 없음) 계정 코치를 열지 않는다 — 입장마다 지도 · 저장소 · 첫 받기를 열지 않게.
    //   watermarks: { others, all } — 지금 판의 기준 시각(남이 다녀간 때 · 자기 결정까지), pick(legacy) — 옛 꼴 후보 가운데 지금 판 규칙
    //   (device-records.mjs pickGuestLearning)으로 고른 것.
    // 돌려줌: null — 새 길이 아니다(지금 판 물음) · { failed: true } — 새 길인데 엔진 · 저장소를 못 열었다(학습 줄 없이 묻고 기준을 올리지
    //   않는다) · { attempts, move(), keep(), note(mark), close() } — move()는 { ok, … }(옛 꼴은 옛 POST로, 받았다는 답이 아니면 표지 없이).
    async guestMove({ watermarks = {}, pick = events => events } = {}) {
      if (!account || disposed) return null;
      const now = await planNow();
      if (disposed) return null;
      if (!now) return { failed: true }; // 판을 못 정했다(기다리는 사이 판이 거듭 바뀜) — 「못 셈」
      const { plan, at } = now;
      // 계정을 못 읽은 채 표지로 연 판(올리는 길 · 기기 길) — 판을 확인하지 못했고 옛 POST(계정 줄)도 없어 세지 않는다(「못 셈」 — 기준
      // 시각을 올리지 않는다). 길을 가르기 전에 본다 — 표지로 연 기기 길이 지금 판 물음으로 넘어가던 것(GPT 끝 판 둘째 C).
      if (plan.unread) return { failed: true };
      // 지금 판이 정해진 것(스위치 꺼짐 · 길 없음) · 기기 길은 지금 판 물음(null), 판을 못 정한 것(일시 실패 · 첫 받기 실패)은
      // 「못 셈」 — 「두기」가 결정의 기준 시각을 올려 새 길 손님 기록을 빼지 않게(GPT 끝 판 B1).
      if (plan.path !== 'upload') return plan.path === 'old' && !SETTLED_OLD.has(plan.code) ? { failed: true } : null;
      const reader = store ? legacyReader(store) : null;
      const before = legacyCandidates(reader, pick);
      let aside = null;
      try {
        if (!before) {
          const { engine } = await entry();
          if (disposed) return null;
          if (typeof engine?.storeName === 'function' && !(await storeMaybe(engine.storeName({})))) return NOTHING_TO_MOVE();
        }
        const made = await coachFor(plan, MOVE_BANKS, 'world-practice', at);
        // 못 열었다 — 첫 받기가 스위치 꺼짐을 알렸으면(꺼짐 표지) 지금 판으로 정해진 것이라 지금 판 물음, 그 밖은 「못 셈」(카본 끝 판 둘째 C).
        if (!made) return disposed ? null : markOf(store, owner).off ? null : { failed: true };
        aside = await made.guestRecords({ legacy: reader, create: before });
        if (!aside) return NOTHING_TO_MOVE();
        const found = await aside.plan(watermarks);
        const legacy = pick(found.legacy);
        const line = plan.line;
        const move = () =>
          aside.move({
            watermarks,
            // 보낸 옛 꼴 번호를 돌려준다 — 엔진이 옮김 표지 ids에 실어 그것을 겨눈 제외가 따라가게(GPT 다시 GA2). 고르지 않은 것은 안 보냈다.
            // 판이 오른 뒤의 409 EVENT_CONFLICT는 그 옛 꼴 묶음만 건너뛰고(이미 다른 판으로 서버에 있다) 계기에 남긴다(F3).
            postLegacy: async events => {
              const chosen = pick(events);
              if (!chosen.length) return { ok: true, ids: [] };
              if (typeof line.postLegacy !== 'function') return false;
              try {
                const sent = await postLegacyBatches(chosen, batch => line.postLegacy(batch));
                if (!sent.ok) return false;
                if (sent.skipped)
                  note('save', { ok: false, code: sent.gaveUp ? 'LEGACY_CONFLICT_ALL' : 'LEGACY_CONFLICT', dependent: true });
                return { ok: true, ids: sent.ids };
              } catch {
                return false;
              }
            },
          });
        const held = aside;
        return {
          attempts: firstAnswers(legacy) + firstAnswers(found.current),
          events: legacy.length + found.current.length,
          move,
          keep: () => held.keep(),
          note: mark => held.note(mark),
          close: () => held.close(),
        };
      } catch {
        aside?.close();
        return disposed ? null : { failed: true };
      }
    },
    // 로그아웃 표지(§18-5-3 — 되는 만큼만): 이미 연 계정 코치가 있을 때만, 손님 저장소가 있을 때만 쓴다. 실패는 계기에만.
    async noteLogout() {
      if (!account || disposed) return false;
      const open = await Promise.all([...coaches.values()]);
      const made = open.find(Boolean);
      if (!made) return false;
      let aside = null;
      try {
        aside = await made.guestRecords({ create: false });
        return aside ? await aside.note('logout') : false;
      } catch {
        return false;
      } finally {
        aside?.close();
      }
    },
    // 계기에 남긴다(생활 판 겉 · 판정 — 4-2). 엔진을 받기 전이면 모아 두었다가 넘긴다.
    note,
    // 계기 요약(수 · 코드 · 시각만) — 엔진을 받기 전이면 모아 둔 것.
    health: () => health?.snapshot?.() ?? { early: early.map(([kind, outcome]) => ({ kind, ...outcome })) },
    dispose() {
      disposed = true;
      generation += 1;
      for (const opening of coaches.values()) void opening.then(made => made?.dispose());
      coaches.clear();
      watchers.clear();
      reopeners.clear();
    },
  };
}
