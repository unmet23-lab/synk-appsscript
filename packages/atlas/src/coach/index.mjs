// 코치 3판(설계 §8 · 단계 4 계획 §3). 게임이 부르는 이름은 그대로 두고 속이 바뀐다 — 두뇌(src/select)가 고르고, 기록(src/record)이
// 남기고, Vellum(src/vellum)이 이유를 말한다. 메서드 이름은 아래 목록 하나이고 입구(loader/loader.js)의 METHODS와 같아야 한다(시험).
//   const coach = SynkAtlas.coach({ gameId, banks, host: { account, revision, guest, port, transport, health }, lang, label });
//   await coach.ready;   // 엔진 묶음 + 지도 조각 + 기록부 읽기
// 아직 짓지 않은 것(코드 NOT_IMPLEMENTED로 분명히 던진다 — 조용히 빈 값을 주면 제품이 엔진이 돈다고 믿는다):
//   live · today · presentation(순간 맞춤 · 오늘 컨디션 · 표시 설정 — 게임을 잇는 4-6).
import { openMap } from '../map/index.mjs';
import { lookbackWindows } from '../memory/lookback.mjs';
import { EDITION } from '../edition.mjs';
import { PARAMS } from '../params.mjs';
import { firstLedgerCells } from '../record/carry.mjs';
import { EVENT_TYPES, FEEDBACK_VALUES } from '../record/events.mjs';
import { firstAnswersOf } from '../record/first.mjs';
import { unitLookback } from '../record/lookback.mjs';
import { storeName } from '../record/port.mjs';
import { noteGone, responseRows, storedRead } from '../record/responses.mjs';
import { elapsedDays, REASON_CODES } from '../reason/index.mjs';
import { planActivities } from '../select/plan.mjs';
import { dayKey } from '../select/session.mjs';
import { render } from '../vellum/index.mjs';
import { acquireHost, hostScope, releaseHost } from './host.mjs';
import { keepGuest, moveGuest, noteGuest, planMove } from './move.mjs';
import { resetAccount, resetGuest, settleAccount } from './reset.mjs';
import { createSession, learnerOf } from './session.mjs';
import { isGameId } from './set-id.mjs';
import { storeExists } from './stores.mjs';

export { COACH_METHODS } from './methods.mjs';

const DAY_MS = 86_400_000;
const SET_KINDS = ['short', 'diagnostic', 'mock'];
const HELD_CODES = new Set([REASON_CODES.capped, REASON_CODES.stubborn]);
const fail = (code, message) =>
  Object.assign(new Error(`Atlas coach: ${message} (${EDITION})`), { code });

// 지도 — 시험 · 호스트가 연 지도(map), 받은 자료(mapData), 또는 판 폴더의 은행 조각(banks — 브라우저).
async function loadMap(options) {
  if (options.map) return options.map;
  if (options.mapData) return openMap(options.mapData);
  if (!Array.isArray(options.banks) || !options.banks.length)
    throw fail('MAP_FAILED', '받을 은행(banks)이나 지도(map)가 있어야 한다');
  const base = new URL('./map/', import.meta.url);
  const get = async name => {
    const response = await fetch(new URL(name, base));
    if (!response.ok) throw fail('MAP_FAILED', `${name}을 받지 못했다(${response.status})`);
    return response.json();
  };
  const [slices, units] = await Promise.all([
    Promise.all(options.banks.map(bank => get(`items/${bank}.json`))),
    get('units.json'),
  ]);
  // 조각이 그 조각의 낱말 이름(words)을 실으면 낱말 표 전체(words.json, 70KB)는 받지 않는다 — 실리지 않은 조각이 있을 때만(atlas-1b 11-11:
  // 쓰는 낱말이 1~400개인 조각만 싣고, 레이싱처럼 큰 조각은 싣지 않는다). openMap의 unit(id)이 조각의 낱말 줄을 읽는다.
  const words =
    options.words && slices.some(slice => !slice?.words) ? await get('words.json') : null;
  return openMap({ index: slices, units, words });
}

// host.document: 틀(게임) 안 코치 — 저장소 열쇠를 스스로 짓지 않고 위 창의 셸이 연 문서 호스트를 받는다(Fable 설계 P1-3).
// 받는 중인 받기(호스트 sync.pull의 약속) → coach.pull()이 돌려준 약속. 받는 중이면 같은 약속을 돌려준다(§21-22 — 설계 주인 조건 「받는 중이면 그
// 약속을 같이 쓴다」). 호스트가 받는 중이 아니면 받기마다 새 약속이라 엮인 줄이 남지 않는다.
const SHARED_PULLS = new WeakMap();

// 첫 받기를 기다리는 기본 한도(synced) — 계정 클라이언트의 요청 한도(12초)를 그대로 기다리지 않는다(B4 · G4).
export const SYNC_WAIT_MS = 4000;

// 손님 길(기기가 원천)로 여는 계정의 저장소 이름이 그 계정의 올리는 저장소 이름이면 거절 — 올리지 않는 기록이 올리는 저장소에 섞인다(E4).
function uploadsTo(host) {
  try {
    return host.key === storeName({ account: host.account, revision: host.revision });
  } catch {
    return false; // 판 번호가 없으면 올리는 저장소 이름도 없다
  }
}

function hostOptions(options) {
  const host = options.host ?? {};
  if (host.document === true) return { host, guest: null, key: null };
  const guest = host.guest === true || host.account == null;
  // 손님 길(기기가 원천)로 여는 계정(동의 꺼진 계정 등)은 저장소 이름을 스스로 짓지 않는다 — 지으면 그 기기의 손님 기록과 한 저장소
  // (synk-atlas:guest)에 섞인다(설계 §5-4 「저장 이름은 계정과 동의 판마다」, Fable 5.2 최종 F6). 그 길을 여는 제품이 key를 준다 —
  // storeName({ account, revision, local: true })로 짓는다(계획 §18-5-5 E1).
  if (host.guest === true && host.account != null && host.key == null)
    throw new TypeError('Atlas coach: 손님 길로 여는 계정은 저장소 이름(host.key)을 준다');
  if (host.guest === true && host.account != null && uploadsTo(host))
    throw new TypeError('Atlas coach: 손님 길로 여는 계정은 올리는 저장소 이름을 쓰지 않는다');
  // key는 저장소 이름(storeName)이다. 시험 · 호스트가 같은 문서에서 저장소를 가를 때만 직접 준다.
  const key =
    host.key ??
    (guest ? storeName({}) : storeName({ account: host.account, revision: host.revision }));
  return { host, guest, key };
}

// 차례의 자물쇠 · 일마다 한도 — 시험만 바꾼다(가짜 · null · 짧은 한도). 주지 않으면 브라우저의 navigator.locks와 표 그대로.
const testHost = (host = {}) => ({
  ...(host.locks !== undefined ? { locks: host.locks } : {}),
  ...(host.turnJobs ? { turnJobs: host.turnJobs } : {}),
});

// 묶음 만남(코치 exposures)의 한 문항 — 열쇠와 물러서기는 exposure() · metBefore와 같다. 화면용 계열은 지도 밖 문항이면 제품이 준
// itemKey로, 측정용 계열은 지도가 준 itemKey까지 물러선다(metBefore와 같은 물러서기).
function keysOf(brain, product) {
  const itemKey = brain?.itemKey ?? product.itemKey;
  const family = brain?.familyKey ?? product.familyKey;
  return { itemKey, familyKey: family ?? product.itemKey, metFamily: family ?? itemKey };
}
function exposureIn({ itemKey, familyKey, metFamily }, seen) {
  const { base, view, shownItems, shownFamilies, unknown } = seen;
  const listed = Boolean(base?.lines.item.has(itemKey));
  const fallback = unknown ? null : false;
  const met = view.met.has(metFamily) || listed ? true : fallback;
  const shown = shownItems.has(itemKey) || shownFamilies.has(familyKey);
  return { seen: view.met.has(familyKey) || listed || shown ? true : fallback, met };
}

export function createCoach(options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('Atlas: coach options must be an object');
  }
  const gameId = options.gameId ?? 'atlas';
  // 게임 이름은 판 번호(set-id.mjs)와 근거 셈이 읽는 꼴이다. 꼴이 틀리면 판은 저장되지만 근거가 되지 못하고, 그 이름으로 물으면 던진다.
  // 그래서 만들 때 막는다(Fable 끝 판 F1 · 설계 주인 11-17 저녁 승인). 지금 쓰는 게임 이름은 tests/atlas-game-ids.test.mjs가 CI에서 본다.
  if (!isGameId(gameId)) throw new TypeError('Atlas: coach gameId must be a game name');
  const params = options.params ?? PARAMS;
  const dayOffset = options.dayOffset ?? -new Date().getTimezoneOffset();
  const scope = options.scope ?? globalThis; // 시험만 준다(틀 흉내)
  // watchers: watch가 건 듣는 함수의 되돌림들 — 코치를 닫으면 모두 부른다(§21-20 조건 1).
  const state = {
    map: null,
    host: null,
    claim: null,
    session: null,
    disposed: false,
    watchers: new Set(),
  };
  const label = id => options.label?.(id) ?? state.map?.unit(id)?.label ?? null;
  // 틀이 여럿일 때 같은 날 같은 것에는 같은 말 — Vellum에 하루 열쇠를 넘긴다(Fable 설계 P2-5 ⑥).
  const say = (why, extra = {}) =>
    why
      ? render(why, {
          lang: extra.lang ?? options.lang ?? 'ko',
          level: extra.level ?? options.level ?? 'standard',
          speaker: extra.speaker ?? options.speaker ?? 'default',
          label,
          day: dayKey(state.host.now(), params, dayOffset),
        })
      : null;
  const mapItem = product => {
    try {
      return state.map.item(product);
    } catch {
      return null;
    }
  };

  const ready = (async () => {
    const map = await loadMap(options);
    const { host, guest, key } = hostOptions(options);
    // 저장소(IndexedDB) · 올리기 타이머 · 알림 통로는 호스트를 만드는 창(같은 출처의 가장 위 창의 엔진)이 연다 — host.mjs.
    // claim: 셸로 받았는지 호스트가 적는 표 — 놓을 때 같이 넘겨 문서 호스트 셈을 내린다(host.mjs shellTakes · release).
    state.claim = {};
    const opened = await acquireHost(
      {
        claim: state.claim,
        key,
        document: host.document === true,
        wait: host.wait,
        port: host.port ?? null,
        revision: host.revision ?? 0,
        guest,
        params,
        health: host.health ?? null,
        transport: host.transport ?? null,
        onAccount: host.onAccount ?? null,
        account: guest ? null : (host.account ?? null),
        legacy: host.legacy ?? null,
        ...(host.legacyWait > 0 ? { legacyWait: host.legacyWait } : {}),
        ...testHost(host),
        now: host.now,
        map,
      },
      scope,
    );
    if (state.disposed) {
      releaseHost(opened, state.claim);
      throw fail('DISPOSED', '준비되기 전에 닫은 코치다');
    }
    state.map = map;
    state.host = opened;
    state.session = createSession({
      host: opened,
      gameId,
      seed: options.seed ?? gameId,
      dayOffset,
      mapItem,
    });
  })();
  // 아무도 기다리지 않는 코치의 거절이 처리되지 않은 거절로 새지 않게(기다리는 쪽은 그대로 거절을 받는다).
  ready.catch(() => {});

  const live = () => {
    if (state.disposed) throw fail('DISPOSED', '이미 닫은 코치다');
    if (!state.session) throw fail('NOT_READY', 'await coach.ready 뒤에 부른다');
    return state.session;
  };
  const notYet = name => () => {
    throw fail('NOT_IMPLEMENTED', `${name}은 단계 4의 다음 묶음에서 짓는다`);
  };

  // 측정용 「앞서 만났나」 — 만남(답 · 답 보기 · 도움)의 표와 요약의 문항 줄만 본다. 띄우기만 하고 답도 도움도 없이 닫은 제시는 만남이
  // 아니다(설계 §5-2) — 그것까지 세는 exposure()는 화면용이다(Fable 설계 P1-2). 모르면 null(계정 기기가 요약을 아직 못 받았을 때).
  function metBefore(item) {
    const brain = mapItem(item ?? {});
    const itemKey = brain?.itemKey ?? item?.itemKey;
    const familyKey = brain?.familyKey ?? item?.familyKey ?? itemKey;
    const base = state.host.trail.summary();
    const view = state.host.view();
    if (view.met.has(familyKey) || base?.lines.item.has(itemKey)) return true;
    // 보기가 아무것도 얹지 못하는 동안(판 묶음이 다른 요약 · 누른 사건)에는 요약 뒤의 만남이 표에 없다 — 「만난 적 없음」으로
    // 단정하지 않고 모름(null)이다. 단정하면 이미 푼 문항이 처음 보는 후보로 들고 측정용 「처음」이 잘못 적혔다(카본 끝 판 B1).
    if (view.waitAll === true) return null;
    return state.host.guest || base != null ? false : null;
  }

  // 답의 측정용 근거(계획 §16 ② — Fable 5.2 D1 · D2 · D6). 「누가 처음 만났나」는 시각이 아니라 접기의 차례(시각 → 사건 번호)로 가른다.
  //   먼저 꼬리를 한 번 읽는다 — 먼저 저장된 다른 탭의 답(같은 밀리초여도)이 들어와 그 차례에 선다.
  //   그 계열의 만난 표 시각에 선 만남 가운데 맨 앞 하나(어댑터가 짓는 만남 — 도움 · 장부 만남 · 옛 꼴 사건까지 접기와 같은 차례):
  //   exposure는 그 만남의 제시가 이 제시인가, independent는 그 만남이 이 답인가(혼자 낸 판정된 답 — 같은 제시의 둘째 답 · 도움 뒤 답은
  //   아니다). 손님 접기 · 서버 접기의 lead와 같은 규칙이다. 보기가 아무것도 얹지 못하거나 만난 표에 그 계열이 없으면 「모름」(unknown) —
  //   지어내지 않는다(설계 §5-2). 둘 다 기록부에 든 뒤에는 기기와 서버가 같은 차례이고, 아직 읽지 못한 다른 탭 · 다른 기기의 만남 ·
  //   서버가 시각을 누른 사건은 기기가 가를 수 없어 기기 판정이 임시다(설계 §5-2).
  async function measured(out) {
    const presented = out.group.source.event;
    const fold = out.fold;
    const assisted = fold.answer.assisted;
    try {
      await state.host.trail.refresh();
    } catch {
      // 꼬리를 못 읽어도 든 사건으로 가른다.
    }
    const view = state.host.view();
    const family = fold.item.familyKey;
    if (view.waitAll === true || !view.met.has(family))
      return { stored: true, independent: false, assisted, exposure: 'unknown' };
    const lead = state.host.trail.leadAt(family, view.met.get(family));
    const exposure = lead && !lead.carried && lead.source === presented.id ? 'new' : 'repeat';
    const independent = exposure === 'new' && lead.id === fold.id && lead.solo;
    return { stored: true, independent, assisted, exposure };
  }

  // none의 이유 — 엔진이 그 까닭을 아는 것(하루 복습 상한 · 끈질긴 단위의 판 몫, choose markTop)만 싣는다. 제품이 판 끝 줄을 그 사실대로
  // 쓰게(Fable 5.2 최종 F2 — 하루 상한에 걸려 하나도 못 낸 판). 그 밖의 none은 이유가 없다.
  const heldWhy = (top, opts) =>
    HELD_CODES.has(top?.why?.code) ? { ...top.why, line: say(top.why, opts) } : null;

  // 손님 저장소를 옆으로 연다(셸 표시 · 문서 호스트 없이 — 틀이 손님 저장소를 받지 않게, §18-5-3 R7). 옛 기록 읽개(legacy)를 주면 연 뒤 옛 기록
  // 옮기기를 한 번 돌린다. create: false면 손님 저장소가 없을 때 null(만들지 않는다). port는 시험만. 계정 코치의 손님 → 계정 옮기기와 계정
  // 비우기의 넷째 걸음(reset)이 쓴다.
  async function openGuestAside({ legacy = null, create = true, port = null } = {}) {
    const key = storeName({});
    if (!create && !port && !(await storeExists(key))) return null;
    return acquireHost(
      {
        key,
        aside: true,
        guest: true,
        params,
        // 계정 코치의 계기 — 옆으로 연 손님 저장소의 실패(다녀감 표지 · 옛 기록 옮기기 · 저장)도 셸의 계기에 남게(카본 끝 판 둘째 D).
        health: state.host.health ?? null,
        legacy,
        map: state.map,
        now: options.host?.now,
        ...(port ? { port } : {}),
        ...testHost(options.host),
      },
      scope,
    );
  }

  // 고른 줄 → recommend의 결과. none이면 낼 문항이 없다(제품은 판을 끝낸다), idle이면 할 것이 없다(채우기 문항이 selected).
  function picked(top, products, facts, opts) {
    if (!top || top.none)
      return {
        status: 'none',
        selected: null,
        why: heldWhy(top, opts),
        none: true,
        idle: false,
        facts,
      };
    return {
      status: top.idle ? 'idle' : 'ready',
      selected: products.get(top.item.itemKey),
      why: { ...top.why, line: say(top.why, opts) },
      tier: top.tier,
      target: top.target ?? null,
      targetLabel: top.target ? label(top.target) : null,
      stubborn: Boolean(top.stubborn),
      breather: Boolean(top.breather),
      expected: top.expected,
      // 「모르겠어요」 표지는 지도 문항의 칸이다 — 제품 문항 객체가 아니라 이 값으로 보기를 둔다(아르곤 끝 판).
      unknownOption: top.item.unknownOption === true,
      idle: Boolean(top.idle),
      none: false,
      facts,
    };
  }

  const coach = {
    edition: EDITION,
    ready,

    recommend(candidates, opts = {}) {
      const session = live();
      const health = state.host.health;
      try {
        const { rows, products, facts } = session.choose(candidates ?? [], opts);
        const result = picked(rows[0] ?? null, products, facts, opts);
        health?.note('recommend', result.none ? { ok: true, empty: true } : { ok: true });
        return result;
      } catch (error) {
        health?.note('recommend', { ok: false, code: 'RECOMMEND_FAILED' });
        throw error;
      }
    },

    present(item, context = {}) {
      const session = live();
      if (context.firstExposure !== undefined && context.firstExposure !== false)
        throw new TypeError(
          'Atlas coach: 제품은 「처음이 아니다」(firstExposure: false)만 말할 수 있다',
        );
      return session.present(item, { firstExposure: context.firstExposure, seen: metBefore(item) });
    },

    help(pid, kind) {
      return live().help(pid, kind).event;
    },

    delivery(pid, { audio } = {}) {
      return live().delivery(pid, { audio }).event;
    },

    answer(pid, result) {
      const session = live();
      const out = session.answer(pid, result);
      const evidence = out.stored.then(ok =>
        ok ? measured(out) : { stored: false, independent: false, assisted: null, exposure: null },
      );
      return {
        eventId: out.event.id,
        verdict: out.verdict,
        correct: out.verdict === 'correct',
        grade: out.grade,
        stored: out.stored,
        evidence,
      };
    },

    exclude(eventId) {
      return live().exclude(eventId).event;
    },

    // 판 응답(feedback.given)을 뺀다(단계 4 계획 §22-5 · 카본 A1 · Fable F6). 「내가 남긴 응답」 목록에서 온 번호만 받는다. 겨눈 사건이
    // 기기에 있으면 판 응답인지 보고 아니면 던진다 — 이 문으로 접기 재료를 빼면 계정 보기가 서버를 기다리지 않은 채 그 근거가 남는다.
    // 기기에 없으면(이틀 지나 치웠거나 다른 기기의 응답) 판 응답 목록에서 온 것을 믿고 「닿는 줄 없음」으로 적는다. 사건을 돌려준다.
    excludeResponse(eventId) {
      const session = live();
      const held = state.host.trail.heldEvents().find(event => event.id === eventId);
      if (held && held.type !== EVENT_TYPES.feedback)
        throw new TypeError('Atlas: excludeResponse takes a set response (feedback.given)');
      const host = state.host;
      const made = session.excludeResponse(eventId);
      // 빼기가 저장되면 그 겨눈 번호를 호스트가 사는 동안 든다 — 사이에 목록을 한 번도 읽지 않고 이틀 뒤 치워도 서버 앞 값에서 되살아나지
      // 않게(4-5 코드 다시 검수 GPT GA9). 저장되지 않은 빼기는 들지 않는다(GA1).
      made.stored.then(ok => {
        if (ok) host.responsesGone.add(eventId);
      });
      return made.event;
    },

    // 판 응답 목록(단계 4 계획 §22-5 — 「내가 남긴 응답」 · 짧은 연습 길이). 셈은 record/responses.mjs(옛 엔진과 같은 뜻 — 판마다 가장 새 응답
    // 하나, 뺀 것 제외, 30일 안, 새것부터)이고, 저장 중인 내 응답 · 빼기도 바로 든다. 손님과 동의를 끈 계정은 저장소의 사건으로 센다. 올리는
    // 계정은 마지막으로 읽은 서버 값 위에 서버가 보지 못한 내 응답(답의 seen에 없는 것)과 기기의 빼기를 얹는다(Fable 5.2 설계 검토 F1). 줄
    // 상한에서 멈춘 답이 닿지 못한 내 응답(받은 표지의 순번이 seenFrom 아래)은 앞 값대로 두고, 앞 값이 없으면 얹지 않는다(설계 주인 11-18).
    // server(나르개 responses()의 답 — 입구가 읽는다)를 주면 그 값을 호스트에 둔다 — 같은 저장소의 코치들이 호스트가 사는 동안만 나누고 기기에
    // 저장하지 않는다(Fable새6). 판이 다른 답 · 꼴이 아닌 답 · 둔 값보다 서버 시각이 앞선 옛 답(F2)은 버린다.
    // 돌려주는 것: { complete, rows: [{ id, at, kind, value, completionId }] } — complete는 손님 · 동의를 끈 계정이면 참이고, 올리는 계정은 끝까지
    // 읽은 서버 값이 있을 때만 참이다.
    responses({ server = null } = {}) {
      live();
      const host = state.host;
      if (!host.guest && server != null) {
        host.responsesRead = storedRead(host.responsesRead, server, host.revision);
      }
      const read = host.guest ? null : host.responsesRead;
      const events = host.ownEvents();
      // 겨눈 번호는 저장된 빼기(기록부가 든 사건 — 다른 탭의 빼기 포함)에서만 든다. 저장 중인 빼기는 목록에서 바로 빠지지만, 저장이 거절되면
      // 다시 보여야 한다(4-5 코드 다시 검수 GPT GA1).
      noteGone(host.responsesGone, host.trail.heldEvents());
      const rows = responseRows({
        events,
        server: read?.rows ?? null,
        known: read?.known ?? null,
        seenFrom: read?.seenFrom ?? null,
        held: read?.held ?? null,
        acked: id => host.trail.acked(id),
        gone: host.responsesGone,
        now: host.now(),
      });
      return Object.freeze({
        complete: host.guest || read?.complete === true,
        rows: Object.freeze(rows),
      });
    },

    recheck() {
      return { status: 'unavailable', reason: 'retired', learningEffectClaim: false };
    },

    summary() {
      live();
      const view = state.host.view();
      const base = state.host.trail.summary();
      const cells = [...(base?.lines.cell ?? new Map()).values()];
      const memory = state.host.memory;
      const now = state.host.now();
      return {
        skills: [...view.ability].map(([id, line]) => ({
          id,
          theta: line.theta,
          n: line.n,
          streak: line.streak,
          level: line.level ?? null,
          peak: line.peak ?? null,
          cells: cells
            .filter(cell => cell.skillId === id)
            .map(({ difficulty, independent, correct, helped, lastAt }) => ({
              difficulty,
              independent,
              correct,
              helped,
              lastAt,
            })),
        })),
        units: [...view.memory]
          .filter(([, unit]) => memory.has(unit))
          .map(([unit, line]) => ({
            unit,
            // 이름(단계 4 계획 §22-2 — 코치가 아는 이름: 지도 units.json과 코치 옵션 label이 넘긴 이름 사전). 없으면 null(「나」 목록과 수에서 뺀다 — N3).
            kind: state.map.unit(unit)?.kind ?? null,
            label: label(unit),
            sittings: line.sittings,
            lapses: line.lapses,
            stubborn: line.stubborn === true,
            // 마지막 자리의 결과(§22-3 · §19-1 ⑤): again · hard · weak · good · known. 「아직 혼자 못 맞힘」은 again이나 hard다.
            last: line.open.grade,
            // 흔들림 · 또렷함 · 익히는 중 · 직접 말함(§22-2 — 기억 모듈 standing).
            state: memory.standing(line, now),
            due: memory.isDue(line, now),
            recall: memory.retrievability(line, now),
            lastAt: line.lastAt,
            // 다음에 돌아올 때 — 떠올릴 확률이 목표 아래로 내려오는 때(같은 자리 6시간보다 이르지 않고 최대 간격보다 늦지 않다).
            // 생활 화면 · 알림이 「다음 복습은 ○일쯤」을 이 값으로 낸다(단계 4 §19-1 ⑤ F).
            dueAt: line.lastAt + memory.intervalDays(line) * DAY_MS,
          })),
        // 옮겨 오기 전 기록(정본 §5-6 · 단계 4 계획 §21-3 A4) — 한 기기에서 처음 옮긴 장부의 칸 요약을 능력마다 따로 낸다. skills의 측정
        // 요약에는 더하지 않는다. 사건을 치우지 않는 기록부(손님 판 — 손님과 동의를 끈 계정)에서만 낸다. 계정 기기는 이틀 뒤 사건을 치우고
        // 서버가 주는 요약에는 이 칸이 없어, 이틀만 보이다 사라지는 칸이 된다(§21-10 덧붙인 물음 3 — 서버 길 계정은 4-4c). 없으면 null.
        // 서버 길 계정은 서버 요약이 실어 준 그 칸이다(단계 4 계획 §21-22 — 서버가 접을 때 머리에 적는다).
        carried: state.host.guest
          ? firstLedgerCells(state.host.trail.heldEvents())
          : state.host.trail.receivedCarried(),
        storage: {
          available: true,
          guest: state.host.guest,
          // 이 기기에 그 계정 · 그 동의 판의 요약이 있다(빈 요약 포함 — 계획 §6 셋째 조건). 손님은 기기가 원천이라 늘 참.
          base: state.host.guest || base != null,
          pending: state.host.pendingCount(),
          unsent: state.host.trail.unsent().length,
          // 바탕 요약에 아직 접히지 않은 내 답 · 도움의 수(§21-3 M1) — 저장 중인 것과, 저장됐지만 요약이 아직 접지 않은 것(계정은 서버가
          // 받았어도 접은 요약이 오기 전까지). 0보다 크면 위 칸(skills[].cells)이 아직 모르는 답이 있다. pending · unsent로는 알 수 없다.
          unfolded: state.host.unfolded(),
          // 서버 접기가 단위 줄을 바꾸는 내 사건(답 · 도움 · 본인 말 · 제외) 가운데 아직 접혀 돌아오지 않은 수 — 0보다 크면 30일째 문장의
          // 수와 조건이 아직 그 사건을 모른다. 학습일 답(셸)이 묻기 전 · 적기 전 · 그리기 전에 본다(설계 주인 11-17 — 4-4c 끝 판 Fable F4).
          // 세는 법이 unfolded와 같아 늘 unfolded 이상이다.
          unfoldedRows: state.host.unfoldedRows(),
          // 올리기 · 받기 상태. pulled — 이 문서에서 받기가 된 적 있음(첫 받기가 실패로 적혀 synced()가 그 실패를 돌려줘도 뒤의 받기가 되면 참,
          // 4-4a Fable 끝 판 F1).
          sync: state.host.syncStatus(),
          // 보기가 아무것도 얹지 못하는 동안(판 묶음이 다른 요약 · 서버가 누른 사건) — 위 단위 · 능력 줄이 아직 내 답을 다 담지 않았다.
          // 제품의 「돌아온 복습」은 그동안 「확인 중」이다(단계 4 §19-1 ⑤ M7).
          waiting: view.waitAll === true,
        },
      };
    },

    // 손님 → 계정 옮기기(계정 코치 — 단계 4 계획 §18-5-3). 손님 저장소를 옆으로(셸 표시 · 문서 호스트 없이 — 틀이 손님 저장소를 받지
    // 않게, R7) 열어 옛 기록 옮기기를 한 번 돌린 뒤 다룬다: plan(watermarks) — 옮길 계획(물음의 수), move({ watermarks, postLegacy }) —
    // 다섯 걸음, keep() — 「이 기기에만 두기」, note(mark) — 되는 만큼만 쓰는 표지(visited · logout), close(). watermarks: { others, all }
    // (제품의 기준 시각 — 남이 다녀간 때 · 자기 결정까지). create: false면 손님 저장소가 없을 때 null(만들지 않는다). port는 시험만.
    async guestRecords({ legacy = null, create = true, port = null } = {}) {
      live();
      if (state.host.guest) throw fail('GUEST', '손님 코치에는 옮길 계정이 없다');
      const aside = await openGuestAside({ legacy, create, port });
      if (!aside) return null;
      // 여는 사이(저장소 열기 · 옛 기록 옮기기) 코치를 닫았으면 옆으로 연 것도 놓는다(카본 끝 판 C).
      if (state.disposed) {
        releaseHost(aside);
        throw fail('DISPOSED', '손님 기록을 여는 사이 닫은 코치다');
      }
      const target = state.host;
      let closed = false;
      // 닫은 손잡이 · 닫은 코치에서는 옮기지 않는다 — 옛 판 · 닫힌 계정 호스트로 사건 · 표지가 가지 않게(카본 끝 판 C).
      const open = () => {
        if (closed) throw fail('CLOSED', '닫은 손님 기록이다');
        live();
      };
      return {
        plan: async (watermarks = {}) => {
          open();
          return planMove(aside, {
            account: target.account,
            revision: target.revision,
            watermarks,
          });
        },
        move: async (how = {}) => {
          open();
          return moveGuest(aside, target, how);
        },
        keep: async () => {
          open();
          return keepGuest(aside, { account: target.account });
        },
        note: async mark => {
          open();
          return noteGuest(aside, { mark, account: mark === 'logout' ? null : target.account });
        },
        close() {
          if (closed) return;
          closed = true;
          releaseHost(aside);
        },
      };
    },

    // 첫 받기(GET)의 결과를 한도 안에서 기다린다(계획 §18-5-5 G4) — 처음인 기기의 판 정하기가 쓴다. coach.ready는 받기를 기다리지
    // 않는다(요약이 있는 기기는 오프라인으로 바로 선다). { ok, base, kind?, code? } — ok: 받기가 됐다, base: 이 기기에 그 계정 · 그 동의
    // 판의 요약이 있다, kind: 못 받은 갈래(offline · switch · account · auth · other · timeout). 손님은 곧 { ok: true, guest: true, base: true }.
    async synced(wait = SYNC_WAIT_MS) {
      live();
      const result = await state.host.firstPull(wait);
      return { ...result, base: state.host.guest || state.host.trail.summary() != null };
    },

    // 화면용 「봤나」(seen) — 띄우기만 한 제시도 본 것이다(지금 판 exposure와 같은 뜻). 측정용 「앞서 만났나」(met)를 함께 낸다 —
    // 처음 보는 문항 고르기 · 같은 지문 세트 판정처럼 측정 자격을 가르는 제품 규칙은 met을 쓴다(아르곤 끝 판).
    exposure(item) {
      live();
      const product = item ?? {};
      const brain = mapItem(product);
      const itemKey = brain?.itemKey ?? product.itemKey;
      const familyKey = brain?.familyKey ?? product.familyKey ?? product.itemKey;
      const base = state.host.trail.summary();
      const shown = state.host.trail
        .heldEvents()
        .some(
          event =>
            event.type === EVENT_TYPES.presented &&
            (event.itemKey === itemKey || event.familyKey === familyKey),
        );
      const met = metBefore(product);
      const view = state.host.view();
      if (view.met.has(familyKey) || base?.lines.item.has(itemKey) || shown)
        return { seen: true, met };
      // 보기가 얹지 못하는 동안은 화면용 seen도 모른다(카본 끝 판 B1과 같은 까닭).
      if (view.waitAll === true) return { seen: null, met };
      return { seen: state.host.guest || base != null ? false : null, met };
    },

    // 묶음 만남(단계 4 계획 §21-3 — 설계 주인 11-15): 여러 문항의 exposure()를 한 번에 — 판을 여는 진단 · 시작점 고르기가 쓴다. 문항마다
    // 부르면 그때마다 든 사건 전체를 줄 세우고 보기를 두 번 지어, 사건 만 건의 손님에서 527문항에 15초쯤 걸렸다(§21-0). 결과는 문항마다
    // exposure()를 부른 것과 같다 — exposure()가 기준이고 대조 시험이 깊은 같음으로 맞댄다(test/coach/exposures.test.mjs). 요약 · 보기 ·
    // 든 사건은 부를 때마다 한 번 읽고 그 위에서 문항마다 가린다. 부르는 사이에 들고 있는 것은 없다 — 새 사건이 든 뒤 낡은 답을 내지 않게.
    exposures(items) {
      live();
      if (!Array.isArray(items)) throw new TypeError('Atlas coach: exposures는 문항 배열을 받는다');
      const base = state.host.trail.summary();
      const view = state.host.view(); // 부를 때마다 새로 짓는다 — 들고 있지 않는다
      const shownItems = new Set();
      const shownFamilies = new Set();
      for (const event of state.host.trail.heldEvents()) {
        if (event.type !== EVENT_TYPES.presented) continue;
        shownItems.add(event.itemKey);
        shownFamilies.add(event.familyKey);
      }
      const waiting = view.waitAll === true;
      // 앞선 만남이 없다고 단정할 수 있을 때만 false — 보기가 얹지 못하거나 계정 요약이 없으면 모름(null).
      const unknown = waiting || !(state.host.guest || base != null);
      const seen = { base, view, shownItems, shownFamilies, unknown };
      return items.map(item => {
        const product = item ?? {};
        return exposureIn(keysOf(mapItem(product), product), seen);
      });
    },

    // 30일째 문장의 수(단계 4 계획 §21-7 — 설계 주인 승인 21-10의 9 · 13). 사건을 치우지 않는 기록부(손님과 동의를 끈 계정)에서만 센다.
    // 서버 길 계정은 null이다 — 기기에 이틀 치만 있어 처음부터 세지 못하므로, 제품이 서버의 돌아보기 읽기로 묻는다. 내는 것은
    // { windows, month }이고, month는 네 조건을 넘은 단위마다 { unit, misses, reviews, last, evidence }(단위 이름 차례)다. 이름이 서는
    // 단위 거르기와 하나 고르기는 제품이 서버 읽기와 같은 함수로 한다 — 코치가 하나를 골라 내면 그 단위의 이름이 서지 않을 때 조건을
    // 채운 다른 단위가 있어도 문장이 사라진다(카본 설계 검토 A11). 기록부의 든 사건 전부(저장이 끝난 사건 — 아직 요약에 접히지 않은 내 답
    // 포함)를 읽는다(카본 설계 검토 A3). 저장 중인 답은 저장이 끝나면 든다.
    lookback({ now } = {}) {
      live();
      if (!state.host.guest) return null;
      const hostParams = state.host.params ?? params;
      const at = Number.isFinite(now) ? now : state.host.now();
      const windows = lookbackWindows(at, {
        dayStartHour: hostParams.dayStartHour,
        offset: dayOffset,
      });
      const month = [];
      for (const [unit, rows] of state.host.trail.unitRows()) {
        const entry = unitLookback(unit, rows, windows, hostParams); // 서버 읽기와 같은 세기(§21-22)
        if (entry) month.push(entry);
      }
      month.sort((a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0));
      return Object.freeze({ windows, month: Object.freeze(month) });
    },

    // 예상 급수의 근거 수(단계 4 계획 §21-23의 2 — 설계 주인 11-17 답 2). 그 게임의 판에서 처음 본 문항에 혼자 낸 채점된 첫 답을 능력 id마다
    // 센다(셈은 서버 읽기와 같은 record/first.mjs firstAnswersOf). 게임 이름(game)은 제품이 넘기고, 기간은 정수 날 수(days, 1 ~ 365)다. 창의
    // 시작(since)은 코치 시계에서 days × 24시간을 뺀 때이고 학습일 경계로 맞추지 않는다. 내는 것은 { game, days, since, bySkill }(얼림).
    // 사건을 치우지 않는 기록부(손님과 동의를 끈 계정)에서만 센다 — lookback()과 같은 규칙. 서버 길 계정은 null이고, 보기가 아직 내 답을
    // 다 담지 않았으면(기록이 다 오지 않음 — 제품 recordsComplete가 거짓) null이다. 든 사건 전부(저장이 끝난 사건)를 읽는다.
    firstAnswers({ game, days } = {}) {
      live();
      if (!isGameId(game)) throw new TypeError('Atlas coach: firstAnswers의 game은 게임 이름이다');
      if (!Number.isInteger(days) || days < 1 || days > 365)
        throw new TypeError('Atlas coach: firstAnswers의 days는 1 ~ 365의 정수다');
      // 손님 기록부의 보기가 waitAll이 되는 길은 닿는 줄을 모르는 제외가 다시 접히기 전의 잠깐뿐이라, waitAll 막이는 지금 사실상 닿지 않는다(시험이
      // 없다 — Fable 끝 판 F3). 닿는 길이 생기면 그 장면의 시험과 변형을 더한다.
      if (!state.host.guest || state.host.view().waitAll === true) return null; // 서버 길 계정 · 기록이 다 오지 않음
      const since = state.host.now() - days * DAY_MS;
      const { families, setOf } = state.host.trail.meetRows();
      const bySkill = Object.freeze(firstAnswersOf(families.values(), setOf, { game, since }));
      return Object.freeze({ game, days, since, bySkill });
    },

    // 판을 닫는다. record: false면 판 단위 결정 · 마침 사건 없이 닫기만 한다(판 기록을 두지 않는 제품 길 — WORLD 손님).
    // 마침 사건에는 그 판의 번호(setId — 제시의 setId와 같은 값)를 싣는다(단계 5 판 비교, Fable 설계 P2-1 라 · 기록 1c412a995).
    // folded: 그 판의 쓰기가 다 저장된 뒤 손님 요약을 다시 접고 풀린다 — 그 뒤의 summary() 칸에 방금 푼 답이 든다(P2-3, 계정은 서버가 접는다).
    // 풀린 값은 이번에 쓴 판 기록의 저장 결과다 — true, false(저장 실패 — 다음 finishSet이 다시 쓴다), 쓴 것이 없으면 null(GPT 최종 GC2).
    finishSet({ kind, record = true } = {}) {
      const session = live();
      // 판 기록을 남길 때만 종류를 묻는다 — 닫기만 하는 길(record: false)은 어떤 제품(게임 포함)이든 부른다(N1).
      if (record !== false && !SET_KINDS.includes(kind))
        throw new TypeError('Atlas coach: 판의 종류가 아니다');
      // 기록할 판 — 열린 판, 아니면 닫혔지만(record: false) 아직 기록하지 않은 판. 같은 판을 두 번 기록하지 않는다(아르곤 끝 판 C7) —
      // 쓰는 동안은 자리를 잡아 두고, 저장이 실패하면 풀어 다음 finishSet이 다시 쓴다(GPT 최종 GC2).
      const setId = session.recordable();
      session.close();
      const slot = record !== false && setId ? session.claimRecord(setId) : null;
      let ids = { decisionId: null, completionId: null };
      let saved = Promise.resolve(null);
      if (slot) {
        const experienceId = `${gameId}.set`;
        // 앞 시도에서 결정이 저장됐으면 그 결정(종류째)에 마침만 단다 — 같은 판의 결정을 둘 남기지 않는다.
        const kept = slot.decision;
        const variant = kept?.variant ?? kind;
        const decided = kept
          ? null
          : state.host.write(EVENT_TYPES.setDecided, { experienceId, variant, setId });
        const decisionId = kept?.id ?? decided.event.id;
        const done = state.host.write(EVENT_TYPES.setCompleted, {
          decisionId,
          experienceId,
          variant,
          setId,
        });
        ids = { decisionId, completionId: done.event.id };
        saved = Promise.all([decided?.stored ?? true, done.stored]).then(
          ([made, finished]) =>
            session.settleRecord(slot, {
              decision: decided && made ? { id: decisionId, variant } : null,
              ok: made && finished,
            }),
          () => session.settleRecord(slot, { decision: null, ok: false }),
        );
      }
      const folded = state.host
        .settled()
        .then(() => state.host.trail.refold())
        .then(() => saved);
      folded.catch(() => {});
      return { ...ids, setId, folded };
    },

    feedback(set, value) {
      live();
      if (!FEEDBACK_VALUES.includes(value) || !set?.completionId)
        throw new TypeError('Atlas coach: 판 응답의 값이 아니다');
      const { event } = state.host.write(EVENT_TYPES.feedback, {
        completionId: set.completionId,
        value,
        ...(set.decisionId ? { decisionId: set.decisionId } : {}),
      });
      return event;
    },

    live: notYet('live'),
    today: notYet('today'),
    presentation: notYet('presentation'),
    // 연습 기록 비우기(단계 4 계획 §22-4 — 길 셋은 reset.mjs). 손님 코치는 이 기기의 손님 기록 전부를, 계정 코치는 서버 비우기로 판을 올린 뒤
    // 손님 저장소에서 그 계정으로 옮긴 사건을 지운다. 받는 것: legacy { read, clear }(옛 엔진의 손님 로그 — 입구가 준다), clear()(서버 비우기 —
    // 기기 길 계정은 입구가 준다, 올리는 계정은 나르개의 clear), guestPort(시험만 — 손님 저장소 포트). 돌려주는 것:
    //   손님 { ok, path: 'guest', gen, legacy: 'cleared' | 'busy' | 'failed' | 'none' } — busy · failed는 「일부만 비움」.
    //   계정 { ok: true, path: 'upload' | 'device', revision(새 판), guest: { ok, dropped, legacy, code? } } 또는
    //        { ok: false, path, step: 'upload' | 'clear', code, known }(known 거짓 — 서버의 결과를 모른다).
    //   settle('cleared' | 'legacy' — 계정만): 서버가 이미 비운 뒤 손님 저장소의 남은 걸음만 한다(입구가 「비우는 중」 표지를 맞출 때 —
    //   reset.mjs settleAccount). revision은 그 비우기가 올린 새 판이다 — 넷째 걸음은 그보다 앞선 판의 옮김 표지만 센다(없으면 이 코치의 판).
    //   돌려주는 것은 { ok: true, path, settled, guest }.
    // 「비우는 중」 표지 · 본인 값 옮기기 · 앞 판 쓸기 · 다시 정하기는 입구의 몫이다(22-1의 4).
    async reset({
      legacy = null,
      clear = null,
      guestPort = null,
      settle = null,
      revision = null,
    } = {}) {
      live();
      // 셸이 연 문서 호스트를 빌린 코치(틀의 게임 — host.document)는 비우지 않는다. 그 호스트의 계정 · 판을 몰라 손님으로 보고 기기 길 계정의
      // 저장소를 비울 수 있었다(4-5 코드 검수 GPT). 비우기는 호스트를 소유한 셸 코치(입구)가 한다 — 아무것도 쓰기 전에 거절한다.
      if (options.host?.document === true)
        return { ok: false, path: 'document', step: 'owner', code: 'NOT_OWNER', known: true };
      const host = state.host;
      const account = options.host?.account ?? null;
      if (host.guest && account == null) return resetGuest(host, legacy);
      const open = () =>
        openGuestAside({ legacy: legacy?.read ?? null, create: false, port: guestPort });
      if (settle === 'cleared' || settle === 'legacy')
        return settleAccount(host, { account, legacy, open, settle, revision });
      const transport = options.host?.transport;
      const call =
        clear ??
        (!host.guest && typeof transport?.clear === 'function' ? () => transport.clear() : null);
      return resetAccount(host, { account, clear: call, legacy, open });
    },

    plan(activities, opts = {}) {
      live();
      const view = learnerOf(state.host.view());
      view.log = state.host.issued();
      view.dayOffset = dayOffset; // 하루 경계(현지 새벽 4시)를 고르기와 같게 — 두뇌는 판 없는 보기에 이 값으로 판을 연다(아르곤 끝 판 C1)
      const mapped = (activities ?? []).map(activity => ({
        ...activity,
        candidates: (activity.candidates ?? []).map(mapItem).filter(Boolean),
      }));
      const planned = planActivities(mapped, view, state.host.memory, state.host.now(), {
        params,
        seed: options.seed ?? gameId,
      });
      const entries = planned.map(entry => ({
        ...entry,
        why: entry.why ? { ...entry.why, line: say(entry.why, opts) } : null,
      }));
      // 하루 복습 상한은 plan 쪽 칸 하나다 — 두뇌가 머리에서 한 번 센 값을 그대로 넘긴다(단계4 §20-14).
      entries.capped = planned.capped;
      return entries;
    },

    // 지도 문항의 단위(제품이 단위를 짓지 않는다 — 4-2 생활의 「복습 → 생활 단위」, 단계 4 §19-3 · 설계 주인 11-13). 받는 값은 열쇠 글자나
    // { itemKey }. 지도 차례 그대로(첫째 = 주 단위) [{ unit, kind, label }]의 얼린 사본 — unit은 due() · summary().units[]의 unit과 같은 이름이라
    // 그대로 맞댄다. 태그 없는 문항은 계열 단위 그대로({ unit: 'family:…', kind: 'family', label: null }), 생활 단위는 kind로 가른다(제품이 앞머리를
    // 잘라 보지 않는다). 이 코치가 받은 은행의 문항만 안다(lifeCoach는 world-life) — label은 그 단위의 이름이 실린 조각을 받았을 때만 있다(낱말은
    // null일 수 있다). 지도에 없는 문항이면 빈 목록, 준비 전에는 다른 메서드처럼 NOT_READY(받는 동안 모든 복습이 「생활 단위 없음」으로 읽히지 않게).
    itemUnits(ref) {
      live();
      const key = typeof ref === 'string' ? ref : ref?.itemKey;
      const item = typeof key === 'string' ? state.map.item(key) : null;
      return Object.freeze(
        (item?.units ?? []).map(unit =>
          Object.freeze({ unit, kind: state.map.unit(unit)?.kind ?? null, label: label(unit) }),
        ),
      );
    },

    // 돌아온 단위 — 늘 호스트 보기에서 읽는다(같은 문서 다른 코치의 답 · 본인 말까지, Fable 설계 P2-1 다).
    due() {
      live();
      const learner = learnerOf(state.host.view());
      const memory = state.host.memory;
      const now = state.host.now();
      return [...learner.memory]
        .filter(([, line]) => memory.has(line) && memory.isDue(line, now))
        .map(([unit, line]) => ({
          unit,
          days: elapsedDays(line, now, {
            dayStartHour: state.host.params?.dayStartHour ?? 4,
            offset: dayOffset,
          }),
          lapses: line.lapses,
          sittings: line.sittings,
          recall: memory.retrievability(line, now),
        }))
        .sort((a, b) => a.recall - b.recall || (a.unit < b.unit ? -1 : 1));
    },

    tell(unit, kind) {
      if (!['known', 'relearn'].includes(kind))
        throw new TypeError('Atlas coach: 본인 말은 known · relearn이다');
      return live().tell(unit, kind).event;
    },

    // 받기 알림(단계 4 계획 §21-20 — 설계 주인 11-16 오후 승인. 11-16 새벽에 고른 「셸이 다시 보기」를 바꾼 것이다). 문서 밖의 답이 이
    // 기록부에 들어왔다는 호스트 알림 두 가지만 넘긴다. receive는 받기 · 첫 받기 · 올리기 답을 기록부에 받았을 때, refresh는 다른 탭이 썼거나
    // 다른 저장소에서 사건을 옮겨 왔을 때 난다. 넘기는 것은 { kind } 하나다(사건 번호나 다른 칸은 넘기지 않는다). 알림은 기록부와 요약이
    // 바뀐 뒤에 나므로, 듣는 함수 안에서 summary()를 부르면 새 값이다(storage.sync.pulled 포함). 같은 문서 안의 일(written · failed)과 셸이
    // 따로 듣는 일(account · offline)은 넘기지 않는다. 되돌림 함수는 여러 번 불러도 되고, 코치를 닫으면 듣는 함수가 저절로 빠진다.
    watch(listener) {
      live();
      if (typeof listener !== 'function')
        throw new TypeError('Atlas coach: watch는 듣는 함수를 받는다');
      const off = state.host.subscribe(event => {
        // 이 알림을 돌리는 사이 되돌렸거나 코치를 닫았으면 부르지 않는다 — 호스트는 듣는 함수 목록의 사본을 돈다(엔진 묶음 GPT GA1 · 카본 A1).
        if (!state.watchers.has(off)) return;
        if (event?.kind === 'receive' || event?.kind === 'refresh') listener({ kind: event.kind });
      });
      state.watchers.add(off);
      return () => {
        if (!state.watchers.delete(off)) return;
        off();
      };
    },

    // 지금 받기(단계 4 계획 §21-22 「설계 다시 검수로 고친 것」 — 설계 주인 11-16 밤 승인). 셸이 학습일 답의 자리보다 기기가 뒤처졌다고 볼 때
    // 그 답의 자리마다 한 번 부른다. 받기의 5분 막이를 건너뛰는 길이지만 까닭이 있는 한 번이고, 자리마다 한 번으로 묶는 것은 셸의 몫이다.
    // 서버 길 계정에서만 곧 받는다. 손님과 동의를 끈 계정, 준비 전이거나 닫힌 코치, 올리기 · 받기가 멈춘 코치(stopped · writesOff · switchOff)는
    // 받지 않고 null이다. 받는 중이면 그 받기의 약속을 같이 쓴다(같은 약속을 돌려준다). 셸에 예외를 던지지 않는다 — 받기가 실패해도 false로
    // 풀린다. 풀린 값은 받았으면 true, 못 받았으면 false다. 받은 요약은 받기 알림(watch의 receive)이 알린다.
    pull() {
      if (state.disposed || !state.session || state.host.guest !== false) return null;
      try {
        const sync = state.host.syncStatus();
        if (sync.stopped || sync.writesOff || sync.switchOff) return null;
        const pulling = state.host.pull({ force: true });
        let shared = SHARED_PULLS.get(pulling);
        if (!shared) {
          shared = Promise.resolve(pulling).then(
            answer => answer != null,
            () => false,
          );
          if (pulling && typeof pulling === 'object') SHARED_PULLS.set(pulling, shared);
        }
        return shared;
      } catch {
        return null;
      }
    },

    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      for (const off of state.watchers) off();
      state.watchers.clear();
      state.session?.dispose();
      if (state.host) releaseHost(state.host, state.claim);
      scope.removeEventListener?.('pagehide', coach.dispose);
    },
  };
  // 틀 안 코치는 틀이 사라질 때 스스로 닫는다 — 위 창의 호스트에 듣는 함수 · 쓰는 사람 수를 남기지 않게(Fable 설계 P1-3).
  if (hostScope(scope) !== scope) scope.addEventListener?.('pagehide', coach.dispose);
  return Object.freeze(coach);
}
