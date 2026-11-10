// 코치 3판(설계 §8 · 단계 4 계획 §3). 게임이 부르는 이름은 그대로 두고 속이 바뀐다 — 두뇌(src/select)가 고르고, 기록(src/record)이
// 남기고, Vellum(src/vellum)이 이유를 말한다. 메서드 이름은 아래 목록 하나이고 입구(loader/loader.js)의 METHODS와 같아야 한다(시험).
//   const coach = SynkAtlas.coach({ gameId, banks, host: { account, revision, guest, port, transport, health }, lang, label });
//   await coach.ready;   // 엔진 묶음 + 지도 조각 + 기록부 읽기
// 아직 짓지 않은 것(코드 NOT_IMPLEMENTED로 분명히 던진다 — 조용히 빈 값을 주면 제품이 엔진이 돈다고 믿는다):
//   live · today · presentation(순간 맞춤 · 오늘 컨디션 · 표시 설정 — 게임을 잇는 4-6), reset(비우기 — 「나」 4-5).
import { createMemory } from '../memory/index.mjs';
import { openMap } from '../map/index.mjs';
import { EDITION } from '../edition.mjs';
import { PARAMS } from '../params.mjs';
import { EVENT_TYPES, FEEDBACK_VALUES } from '../record/events.mjs';
import { idbPort } from '../record/idb.mjs';
import { storeName } from '../record/port.mjs';
import { elapsedDays } from '../reason/index.mjs';
import { planActivities } from '../select/plan.mjs';
import { render } from '../vellum/index.mjs';
import { acquireHost, releaseHost } from './host.mjs';
import { createSession, learnerOf } from './session.mjs';

export { COACH_METHODS } from './methods.mjs';

const SET_KINDS = ['short', 'diagnostic', 'mock'];
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
  const [slices, units, words] = await Promise.all([
    Promise.all(options.banks.map(bank => get(`items/${bank}.json`))),
    get('units.json'),
    options.words ? get('words.json') : null,
  ]);
  return openMap({ index: slices, units, words });
}

async function portOf(host, key) {
  if (host.port) return host.port;
  try {
    return await idbPort(key);
  } catch (error) {
    throw Object.assign(fail('STORAGE_FAILED', '저장소를 열지 못했다'), { cause: error });
  }
}

function hostOptions(options) {
  const host = options.host ?? {};
  const guest = host.guest === true || host.account == null;
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
  const state = { map: null, host: null, session: null, disposed: false };
  const label = id => options.label?.(id) ?? state.map?.unit(id)?.label ?? null;
  const say = (why, extra = {}) =>
    why
      ? render(why, {
          lang: extra.lang ?? options.lang ?? 'ko',
          level: extra.level ?? options.level ?? 'standard',
          speaker: extra.speaker ?? options.speaker ?? 'default',
          label,
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
    const port = await portOf(host, key);
    const opened = await acquireHost({
      key,
      port,
      revision: host.revision ?? 0,
      guest,
      memory: createMemory(params),
      params,
      health: host.health ?? null,
      transport: host.transport ?? null,
      now: host.now,
      map,
    });
    state.map = map;
    state.host = opened;
    state.session = createSession({
      host: opened,
      gameId,
      seed: options.seed ?? gameId,
      dayOffset: options.dayOffset ?? -new Date().getTimezoneOffset(),
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

  // 고른 줄 → recommend의 결과. none이면 낼 문항이 없다(제품은 판을 끝낸다), idle이면 할 것이 없다(채우기 문항이 selected).
  function picked(top, products, facts, opts) {
    if (!top || top.none)
      return { status: 'none', selected: null, why: null, none: true, idle: false, facts };
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
      const seen = coach.exposure(item).seen;
      return session.present(item, { firstExposure: context.firstExposure, seen });
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
      const presented = out.group.source.event;
      const fold = out.fold;
      const evidence = out.stored.then(ok => {
        if (!ok) return { stored: false, independent: false, assisted: null, exposure: null };
        const first = state.host.view().met.get(fold.item.familyKey) === fold.at;
        const exposure =
          !first || presented.firstExposure === false
            ? 'repeat'
            : presented.firstExposure === true
              ? 'new'
              : 'unknown';
        const independent =
          exposure === 'new' &&
          fold.answer.assessable &&
          !fold.answer.assisted &&
          !fold.answer.answerShown;
        return { stored: true, independent, assisted: fold.answer.assisted, exposure };
      });
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
      live();
      const { event } = state.host.write(EVENT_TYPES.excluded, { targetId: eventId });
      return event;
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
          pending: state.host.pendingCount(),
          unsent: state.host.trail.unsent().length,
        },
      };
    },

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
      if (state.host.view().met.has(familyKey) || base?.lines.item.has(itemKey) || shown)
        return { seen: true };
      return { seen: state.host.guest || base != null ? false : null };
    },

    finishSet({ kind } = {}) {
      const session = live();
      if (!SET_KINDS.includes(kind)) throw new TypeError('Atlas coach: 판의 종류가 아니다');
      const experienceId = `${gameId}.set`;
      const decided = state.host.write(EVENT_TYPES.setDecided, { experienceId, variant: kind });
      const done = state.host.write(EVENT_TYPES.setCompleted, {
        decisionId: decided.event.id,
        experienceId,
        variant: kind,
      });
      session.close();
      return { decisionId: decided.event.id, completionId: done.event.id };
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

    due() {
      const session = live();
      const learner = session.learner ?? learnerOf(state.host.view());
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
      if (state.host) void releaseHost(state.host);
    },
  };
  return Object.freeze(coach);
}
