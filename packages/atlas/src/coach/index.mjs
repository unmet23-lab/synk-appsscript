// 코치 3판(설계 §8 · 단계 4 계획 §3). 게임이 부르는 이름은 그대로 두고 속이 바뀐다 — 두뇌(src/select)가 고르고, 기록(src/record)이
// 남기고, Vellum(src/vellum)이 이유를 말한다. 메서드 이름은 아래 목록 하나이고 입구(loader/loader.js)의 METHODS와 같아야 한다(시험).
//   const coach = SynkAtlas.coach({ gameId, banks, host: { account, revision, guest, port, transport, health }, lang, label });
//   await coach.ready;   // 엔진 묶음 + 지도 조각 + 기록부 읽기
// 아직 짓지 않은 것(코드 NOT_IMPLEMENTED로 분명히 던진다 — 조용히 빈 값을 주면 제품이 엔진이 돈다고 믿는다):
//   live · today · presentation(순간 맞춤 · 오늘 컨디션 · 표시 설정 — 게임을 잇는 4-6), reset(비우기 — 「나」 4-5).
import { openMap } from '../map/index.mjs';
import { EDITION } from '../edition.mjs';
import { PARAMS } from '../params.mjs';
import { EVENT_TYPES, FEEDBACK_VALUES } from '../record/events.mjs';
import { storeName } from '../record/port.mjs';
import { elapsedDays, REASON_CODES } from '../reason/index.mjs';
import { planActivities } from '../select/plan.mjs';
import { dayKey } from '../select/session.mjs';
import { render } from '../vellum/index.mjs';
import { acquireHost, hostScope, releaseHost } from './host.mjs';
import { createSession, learnerOf } from './session.mjs';

export { COACH_METHODS } from './methods.mjs';

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

export function createCoach(options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('Atlas: coach options must be an object');
  }
  const gameId = options.gameId ?? 'atlas';
  const params = options.params ?? PARAMS;
  const dayOffset = options.dayOffset ?? -new Date().getTimezoneOffset();
  const scope = options.scope ?? globalThis; // 시험만 준다(틀 흉내)
  const state = { map: null, host: null, session: null, disposed: false };
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
    const opened = await acquireHost(
      {
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
        legacy: host.legacy ?? null,
        ...(host.legacyWait > 0 ? { legacyWait: host.legacyWait } : {}),
        // 차례의 자물쇠 · 일마다 한도 — 시험만 바꾼다(가짜 · null · 짧은 한도). 주지 않으면 브라우저의 navigator.locks와 표 그대로.
        ...(host.locks !== undefined ? { locks: host.locks } : {}),
        ...(host.turnJobs ? { turnJobs: host.turnJobs } : {}),
        now: host.now,
        map,
      },
      scope,
    );
    if (state.disposed) {
      releaseHost(opened);
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
            sittings: line.sittings,
            lapses: line.lapses,
            stubborn: line.stubborn === true,
            due: memory.isDue(line, now),
            recall: memory.retrievability(line, now),
            lastAt: line.lastAt,
          })),
        storage: {
          available: true,
          guest: state.host.guest,
          // 이 기기에 그 계정 · 그 동의 판의 요약이 있다(빈 요약 포함 — 계획 §6 셋째 조건). 손님은 기기가 원천이라 늘 참.
          base: state.host.guest || base != null,
          pending: state.host.pendingCount(),
          unsent: state.host.trail.unsent().length,
          sync: state.host.syncStatus(),
        },
      };
    },

    // 첫 받기(GET)의 결과를 한도 안에서 기다린다(계획 §18-5-5 G4) — 처음인 기기의 판 정하기가 쓴다. coach.ready는 받기를 기다리지
    // 않는다(요약이 있는 기기는 오프라인으로 바로 선다). { ok, base, kind?, code? } — ok: 받기가 됐다, base: 이 기기에 그 계정 · 그 동의
    // 판의 요약이 있다, kind: 못 받은 갈래(offline · switch · account · auth · other · timeout). 손님은 곧 { ok: true, base: true }.
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
    reset: notYet('reset'),

    plan(activities, opts = {}) {
      live();
      const view = learnerOf(state.host.view());
      view.log = state.host.issued();
      view.dayOffset = dayOffset; // 하루 경계(현지 새벽 4시)를 고르기와 같게 — 두뇌는 판 없는 보기에 이 값으로 판을 연다(아르곤 끝 판 C1)
      const mapped = (activities ?? []).map(activity => ({
        ...activity,
        candidates: (activity.candidates ?? []).map(mapItem).filter(Boolean),
      }));
      return planActivities(mapped, view, state.host.memory, state.host.now(), {
        params,
        seed: options.seed ?? gameId,
      }).map(entry => ({
        ...entry,
        why: entry.why ? { ...entry.why, line: say(entry.why, opts) } : null,
      }));
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
          days: elapsedDays(line, now),
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

    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      state.session?.dispose();
      if (state.host) releaseHost(state.host);
      scope.removeEventListener?.('pagehide', coach.dispose);
    },
  };
  // 틀 안 코치는 틀이 사라질 때 스스로 닫는다 — 위 창의 호스트에 듣는 함수 · 쓰는 사람 수를 남기지 않게(Fable 설계 P1-3).
  if (hostScope(scope) !== scope) scope.addEventListener?.('pagehide', coach.dispose);
  return Object.freeze(coach);
}
