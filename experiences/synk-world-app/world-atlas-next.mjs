// Atlas 새 길의 WORLD 입구(재설계 단계 4 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §6 · §7 · §18-2 · §18-5). 기능 atlasNext가
// 켜졌을 때만 셸이 동적 import로 부른다 — 꺼진 판은 이 파일도 엔진 입구(/atlas/loader.mjs)도 받지 않고, 지금 판 코치로 돈다.
// 손님은 이 기기가 원천인 손님 저장소로 간다. 계정은 판을 정해(§18-2 1 · §18-5-5) 셋 가운데 하나로 간다 — 올리는 길(계정 · 동의 판의
// 저장소 + 나르개), 기기 길(동의 꺼짐 · 쓰기 문 닫힘 — 올리지 않는 그 계정의 기기 저장소, F6), 지금 판(null).
// 엔진이 준비되지 못하면(입구 · 묶음 · 지도 · 저장소) null을 돌려주고 셸은 지금 판으로 간다 — 학습이 막히지 않는다.
import { createPracticeNextSession } from './world-practice-next.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from './world-today.mjs';
import { buildPositionNext, estimateNext, examSkills, recheckCards, unitRoutes, unseenFamilies } from './world-position-next.mjs';
import { createDiagnosticNextSession, selectDiagnosticNext, withheldItem } from './world-diagnostic-next.mjs';
import { createMockNextSession, selectMockNext, todayPractice } from './world-mock-next.mjs';
import { createPositionNextView } from './world-position-next-view.mjs';
import {
  buildPlanNext,
  createPlanLog,
  PLAN_LOG_PREFIX,
  planBoard,
  planLogKey,
  planReader,
  planStart,
  recordsComplete,
} from './world-plan-next.mjs';
import { monthWhy, pickMonth } from './world-lookback-next.mjs';
import { meUnits } from './world-me-next.mjs';
// 옛 엔진의 두 문(4-5 §22-4 — 셸이 짓는다): 새 길이 켜졌을 때만 받는 이 모듈이 함께 싣는다(새 길이 꺼진 셸은 받지 않는다).
export { oldEngineDoors } from './world-old-engine-doors.mjs';
import { clearMonthAnswer, FIRST_GAME } from './world-month-answer.mjs';
import { lifeReviewCandidate } from './world-account.bundle.mjs';

const ENTRY = '/atlas/loader.mjs';
// 「내 위치」 새 판(4-4a — 단계4_계획 §21-2 ~ 21-5): 계약(칸 셋 · 다시 확인 카드 · 짧은 진단)과 최소 그림. 홈 플래너에 실어 셸에 넘긴다 — 홈 코치
// 하나로 그린다(코치와 지도를 하나 더 열지 않는다, 21-2). 생활 카드는 지금 판 홈과 같은 생활 복습 후보 규칙(lifeReviewCandidate — 계정 묶음,
// world-today.mjs와 같은 주소)으로 연다.
export const positionPlanner = Object.freeze({
  examSkills,
  buildPositionNext,
  unseenFamilies,
  unitRoutes,
  recheckCards,
  selectDiagnosticNext,
  withheldItem,
  createDiagnosticNextSession,
  // 시험 형식 연습 새 판(4-4d — 단계4_계획 §21-23의 1): 구성은 지금 판 selectMock(셸이 넘긴다), 처음 보는 문항은 묶음 만남, 진행은 'world-mock' 코치,
  // 끝 한 장의 「다음 연습」은 그날 낼 것이 있는 짧은 연습만(todayPractice).
  selectMockNext,
  createMockNextSession,
  todayPractice,
  createView: createPositionNextView,
  lifeReview: lifeReviewCandidate,
  // 30일째 문장(4-4c — 단계4_계획 §21-7): 코치(손님 · 동의를 끈 계정)나 서버 읽기가 낸 단위마다의 수에서 이름이 서는 단위 하나를 고르고 이유를 짓는다.
  pickMonth,
  monthWhy,
  // 예상 급수 칸(4-4d — 단계4_계획 §21-23의 2): 코치나 근거 상자가 낸 능력마다의 근거 수를 시험 · 영역으로 묶어 지금 판 문턱으로 센다.
  estimateNext,
  // 「나」 칸(4-5 — 단계4_계획 §22-6): 코치 요약의 단위 줄을 흔들리는 말 · 또렷한 말 · 내가 안다고 한 말로 나눈다(이름은 unitRoutes와 같은 단위 길).
  meUnits,
});
// 이번 주 계획 새 판(4-4b — 단계4_계획 §21-6): 능력 읽개 · 시작점 · 기기 판 기록으로 지금 판의 buildExamPlan을 새 칸으로 읽는다. 홈 코치 하나로
// 짓는다(내 위치와 같은 코치 · 같은 묶음 만남 — 셸 world-learning-ui.mjs weekNext).
export const planPlanner = Object.freeze({ planBoard, planReader, planStart, buildPlanNext, recordsComplete });
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
// 홈 코치의 은행(4-3 — §20-4): 생활과 짧은 연습 문항 풀 전체(학생의 수준으로 거르기 전)의 은행을 고정 묶음으로 — 설정이 바뀌어도 코치와
// 지도가 하나 더 열리지 않게(설계 검토 H24). 경험 이름은 world-home이다(다른 면과 같은 호스트라 기억은 문서 안에서 하나).
export const homeBanksOf = pool => [...new Set([...LIFE_BANKS, ...banksOf(pool)])].sort();

// 옛 기기 기록 읽개(계획 §1 #22 — 손님 호스트가 열 때마다 부른다). 옛 로그(events)와 접힌 장부(ledger)를 그대로 넘기고, 옮길 것을
// 고르는 일(아직 안 옮긴 옛 꼴 사건 · 새로 든 장부)은 엔진(record/carry.mjs)이 한다. 못 읽으면 null — 새 길은 그대로 연다.
// epoch은 옛 로그의 세대다(옛 엔진 reset이 비울 때마다 새로 쓴다 — 4-5 §22-4). 엔진이 비운 뒤의 바닥과 견주고, 옛 엔진 비우기가 된 것을
// 비운 뒤 다시 읽어 바뀐 epoch으로 확인한다. 없으면 null(모름).
export function legacyReader(storage) {
  return () => {
    try {
      const raw = storage?.getItem?.(LEGACY_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return {
        log: Array.isArray(value?.events) ? value.events : [],
        ledger: value?.ledger ?? null,
        epoch: typeof value?.epoch === 'string' && value.epoch ? value.epoch : null,
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
  const was = markOf(storage, owner);
  const next = { ...was, ...patch };
  // 마지막 길 · 판은 내려가지 않는다 — 계정의 판은 오르기만 한다. 늦게 온 계정 읽기, 늦게 끝난 앞 비우기, 앞 판의 코치가 앞 판을 적으면
  // 다음 오프라인 시작이 비운 판을 열었다(4-5 끝 판 GPT GC2 · GC3).
  if (Number.isSafeInteger(was.revision) && Number.isSafeInteger(patch.revision) && patch.revision < was.revision) {
    next.path = was.path;
    next.revision = was.revision;
  }
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

// ── 연습 기록 비우기의 입구 몫(4-5 — 단계4_계획 §22-4 · 22-1의 4) ──────────────────────────────────────────
// 「비웠는가」는 판 견줌으로 정한다(설계 주인 11-19 아침 — Fable 5.2 설계 검토 atlas-redesign-stage4-me-clearing-design-20261119). 결과를 모르는
// 비우기를 따로 적는 표지는 없다 — 한 칸을 여러 탭이 「누구 것인가」를 따지며 고쳐 쓰던 짜임에서 P1이 거듭 나왔다(-c GA3 · GC2 · 끝 판 F3).
//   CLEARED_MARK — 계정마다 오르기만 하는 수 둘 { account, settled, asked }. settled는 이 기기가 몫(본인 값 옮기기 · 앞 판 쓸기 · 30일째 답)을
//   마친 마지막 비우기의 판, asked는 마지막 비우기(lastClear)를 읽는 데 성공했을 때의 계정 판이다. 판을 다시 정할 때 계정 판이 asked보다
//   올랐으면 lastClear를 읽고, 그 판이 settled보다 크면 누가 비웠든(누른 기기 · 다른 기기 · 결과를 모르던 이 기기의 비우기) 이 기기의 몫을 한다.
//   몫은 다시 해도 같아 여러 탭이 겹쳐도 큰 값이 이기면 된다(「새 길 간 적 있음」의 판과 같은 규칙).
//   CLEARING_MARK — 「남은 걸음」 표지, 계정마다 하나 { account, path, revision, at, left }. 서버 비우기는 끝났고(revision은 비운 뒤의 새 판) 이
//   기기의 손님 저장소 걸음이 남았다 — 'cleared'(넷째 걸음과 4b) · 'legacy'(4b만 — 옛 손님 로그 남음) · 'sweep'(앞 판 쓸기만 — 못 지운 열쇠가
//   있다, 4-5 끝 판 GPT GC6). 더 큰 판의 표지가 이기고(그 판의 넷째 걸음 경계가 앞 판의 것을 덮는다), 걸음을 마친 뒤에는 판과 남은 걸음이
//   그대로일 때만 지운다(GC2). 남은 걸음은 늘 앞 판 쓸기를 다시 한다. left가 없는 옛 꼴(결과를 모르던 표지)은 읽지 않는다.
export const CLEARING_MARK = 'synk.atlas.clearing.';
export const CLEARED_MARK = 'synk.atlas.cleared.';
// 마지막 비우기가 누른 비우기의 시작보다 앞서 끝났는지 서버 시각으로 견줄 때의 여유(시계 어긋남을 재는 읽기의 오간 시간 절반에 더한다).
const CLOCK_SLACK_MS = 2000;
const LEFT = new Set(['cleared', 'legacy', 'sweep']);
export function clearingOf(storage, owner) {
  try {
    const value = JSON.parse(storage?.getItem?.(CLEARING_MARK + owner) ?? 'null');
    if (
      value?.account !== owner ||
      !NEXT_PATHS.has(value.path) ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 1 ||
      !Number.isFinite(value.at) ||
      !LEFT.has(value.left)
    )
      return null;
    return { path: value.path, revision: value.revision, at: value.at, left: value.left };
  } catch {
    return null;
  }
}
// 판 견줌의 두 수 — 못 읽으면 0(처음 보는 기기는 다시 정할 때 한 번 묻는다).
const countOf = value => (Number.isSafeInteger(value) && value > 0 ? value : 0);
export function clearedOf(storage, owner) {
  try {
    const value = JSON.parse(storage?.getItem?.(CLEARED_MARK + owner) ?? 'null');
    if (value?.account !== owner) return { settled: 0, asked: 0 };
    return { settled: countOf(value.settled), asked: countOf(value.asked) };
  } catch {
    return { settled: 0, asked: 0 };
  }
}
// 두 수를 올린다(내리지 않는다 — 늦게 끝난 앞 비우기나 늦게 온 읽기가 작은 판을 적어도 그대로다). 못 쓰면 거짓 — 다음 다시 정하기가 또 묻는다.
function raiseCleared(storage, owner, { settled = 0, asked = 0 }) {
  const was = clearedOf(storage, owner);
  const next = { settled: Math.max(was.settled, countOf(settled)), asked: Math.max(was.asked, countOf(asked)) };
  if (next.settled === was.settled && next.asked === was.asked) return true;
  try {
    storage?.setItem?.(CLEARED_MARK + owner, JSON.stringify({ account: owner, ...next }));
    return true;
  } catch {
    return false;
  }
}
// 서버 시각 값(밀리초 수 · ISO 글) → 밀리초, 읽을 수 없으면 null.
const msOf = value => {
  const ms = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
};
function clearingOwners(storage) {
  const out = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const name = storage.key(index);
      if (typeof name === 'string' && name.startsWith(CLEARING_MARK)) out.push(name.slice(CLEARING_MARK.length));
    }
  } catch {
    return [];
  }
  return out;
}
function writeClearing(storage, owner, mark) {
  try {
    if (!mark) storage?.removeItem?.(CLEARING_MARK + owner);
    else
      storage.setItem(
        CLEARING_MARK + owner,
        JSON.stringify({
          account: owner,
          path: mark.path,
          revision: mark.revision,
          at: mark.at,
          left: mark.left,
        }),
      );
    return true;
  } catch {
    return false;
  }
}
// 옛 엔진 구역(synk-account scopedStorage — `synk.account.<계정 열쇠>.r<판>.`). 계정 열쇠는 올리는 길이면 계정 id, 기기 길이면 local:<계정 id>다.
const zoneOf = (owner, path, revision) =>
  `synk.account.${path === 'upload' ? owner : `local:${owner}`}.r${revision}.`;
// 학생 본인 값 — 판이 올라도 남긴다(22-4 「판이 올라도 남기는 값」): 고른 화면 값과 한글 진도 사본. 오늘 상태(.today)와 내용 기억(.flow)은
// 엔진에서 나온 값이라 옮기지 않는다.
const OWN_KEYS = [`${LEGACY_KEY}.presentation`, 'hangul-stage.v1'];
// 본인 값을 새 판 구역으로 옮긴다 — 값이 남아 있는 가장 가까운 앞 판 구역에서(판이 둘 넘게 올라도, 이 기기가 그사이의 비우기를 몰랐어도
// 잇는다 — Fable 5.2 설계 검토 F1). 새 판 구역에 이미 값이 있으면 덮지 않는다. 열쇠를 셀 수 없는 저장소면 바로 앞 판 구역만 본다. 못 읽거나
// 못 쓰면 그 열쇠만 건너뛴다.
function moveOwn(storage, owner, path, revision) {
  const zone = `synk.account.${path === 'upload' ? owner : `local:${owner}`}.r`;
  const to = zoneOf(owner, path, revision);
  let names = null;
  try {
    const count = storage?.length;
    if (typeof storage?.key === 'function' && Number.isSafeInteger(count) && count >= 0) {
      names = [];
      for (let index = 0; index < count; index += 1) {
        const name = storage.key(index);
        if (typeof name === 'string') names.push(name);
      }
    }
  } catch {
    names = null;
  }
  for (const name of OWN_KEYS)
    try {
      if (storage.getItem(to + name) != null) continue;
      let from = revision > 1 ? revision - 1 : null;
      if (names) {
        from = null;
        for (const key of names) {
          const found = key.startsWith(zone) ? /^(\d+)\.(.+)$/.exec(key.slice(zone.length)) : null;
          const at = found && found[2] === name ? Number(found[1]) : 0;
          if (at > 0 && at < revision && (from == null || at > from)) from = at;
        }
      }
      const value = from == null ? null : storage.getItem(zoneOf(owner, path, from) + name);
      if (value != null) storage.setItem(to + name, value);
    } catch {
      // 그 열쇠만 건너뛴다
    }
}
// 앞 판 구역의 엔진 기록 열쇠(구역 앞머리 뒤의 이름) — 옛 엔진의 학습 로그와 그 쪽 · 쓰는 중 표지, 내용 기억, 옛 엔진 올리기 대기열과 그
// 쪽 · 쓰는 중 표지(계정 구역에서도 학습자 열쇠는 device다 — 11-18 조사). 구역 앞머리로 통째로 쓸지 않는다 — 본인 값 · 오늘 상태는 둔다.
function engineRecord(name, accountKey) {
  if (name === `${LEGACY_KEY}.flow`) return true;
  return [LEGACY_KEY, `synk.atlas.learning-sync.v1.${accountKey}`].some(
    base => name === base || name.startsWith(`${base}.page.`) || name.startsWith(`${base}.writer.`),
  );
}
// 앞 판 쓸기(22-4 올리는 계정 3) — 이 계정의 두 구역(계정 id · local:)에서 판이 below보다 앞선 엔진 기록 열쇠와, 그 판들의 판 기록 열쇠
// (synk.world.plan-log.v1:<저장소 이름>)를 지운다. 판이 확실히 앞선 것만 지운다 — 늦게 도는 탭이 다른 탭의 새 판 기록을 지우지 않게(GPT GA2).
// 열쇠를 셀 수 없는 저장소면 쓸지 않는다(null). 한 열쇠를 지우다 던져도 나머지는 지우고, 못 지운 열쇠가 있으면 거짓이다 — 입구가 「일부만
// 비움」으로 알리고 표지에 쓸기를 남겨 다음 다시 정하기가 다시 쓴다(4-5 끝 판 GPT GC6). 다 지웠으면 참.
function sweepEarlier(storage, owner, below) {
  const names = [];
  try {
    const count = storage?.length;
    if (typeof storage?.key !== 'function' || !Number.isSafeInteger(count) || count < 0) return null;
    for (let index = 0; index < count; index += 1) {
      const name = storage.key(index);
      if (typeof name === 'string') names.push(name);
    }
  } catch {
    return null;
  }
  const drop = [];
  for (const accountKey of [owner, `local:${owner}`]) {
    const zone = `synk.account.${accountKey}.r`;
    const plans = `${PLAN_LOG_PREFIX}synk-atlas:${accountKey}:`;
    for (const name of names)
      if (name.startsWith(zone)) {
        const found = /^(\d+)\.(.+)$/.exec(name.slice(zone.length));
        if (found && Number(found[1]) < below && engineRecord(found[2], accountKey)) drop.push(name);
      } else if (name.startsWith(plans)) {
        const revision = name.slice(plans.length);
        if (/^\d+$/.test(revision) && Number(revision) < below) drop.push(name);
      }
  }
  let whole = true;
  for (const name of drop)
    try {
      storage.removeItem(name);
    } catch {
      whole = false; // 나머지는 지운다
    }
  return whole;
}
// 손님 저장소의 걸음 결과 → 남은 걸음. 넷째 걸음이 안 됐으면 앞의 남은 걸음 그대로(없었으면 'cleared'), 옛 손님 로그를 다른 창이 쥐었거나
// 비우기를 확인하지 못했으면 'legacy'(4b만 — 일부만 비움), 다 됐으면 null.
const leftOf = (guest, before = null) =>
  guest?.ok === false
    ? (before ?? 'cleared')
    : guest?.legacy === 'busy' || guest?.legacy === 'failed'
      ? 'legacy'
      : null;

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
// 끝 판 둘째 넘친 #20). 마저 보낼 때의 409도 걸린 묶음만 건너뛴다(몫은 더 세지 않는다 — 합친 끝 판 넘친 #23). 그 밖의 실패는 ok: false(표지
// 없이 다음에 다시). 옮기기가 끊긴 뒤 동의를 껐다 켜 판이 오르면 같은 번호 · 다른 판이라 다시 옮기기가 영영 실패하던 것(Fable 5.2 끝 판 F3 ·
// 설계 주인 11-13).
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
  let finishing = false; // 포기한 뒤 마저 보내는 중 — 걸린 묶음은 건너뛰되 몫(cap)은 더 세지 않는다
  // 묶음을 건너뛴다 — cap을 넘으면 옛 꼴 몫 전체를 건너뛴다('gave-up').
  const skip = roots => {
    for (const id of roots) skipped.add(id);
    return !finishing && skipped.size > cap ? 'gave-up' : 'ok';
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
  // 포기한 뒤 — 이미 보낸 묶음(건너뛴 것 말고)의 남은 사건을 같은 자르기로 마저 보낸다. 409 EVENT_CONFLICT는 보낼 때처럼 걸린 묶음만
  // 건너뛰고(이미 포기했으니 몫은 더 세지 않는다) 나머지를 보낸다 — 실패로 돌리면 다시 옮겨도 같은 차례라 그 옮기기가 영영 실패했다(Fable
  // 5.2 합친 끝 판 넘친 #23 — 머리는 받았는데 자식이 걸리는 묶음). 그 밖의 실패는 실패(표지 없이 다음에 다시).
  async function finish() {
    finishing = true;
    const sent = new Set(ids);
    const started = new Set(ids.map(id => root.get(id)));
    const rest = ordered.filter(
      event => !sent.has(event?.id) && started.has(root.get(event?.id)) && !skipped.has(root.get(event?.id)),
    );
    let part = [];
    let used = 0;
    for (const event of rest) {
      const n = encoder.encode(JSON.stringify(event)).length;
      if (part.length >= limit || (part.length && used + n > bytes)) {
        if ((await send(part)) !== 'ok') return 'fail';
        part = [];
        used = 0;
      }
      part.push(event);
      used += n;
    }
    return part.length && (await send(part)) !== 'ok' ? 'fail' : 'gave-up';
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
          // 30일째 문장의 돌아보기 읽기(단계 4 계획 §21-22) — offset = 기기의 현지 시각 − UTC(분).
          lookback: offset =>
            call(`rehearsal/trail-lookback?${new URLSearchParams({ revision: String(at), offset: String(offset) })}`, {}, from),
          // 예상 급수의 근거 읽기(단계 4 계획 §21-23의 2) — game · days는 상자(world-month-answer.mjs FIRST_KIND)가 준다.
          firstAnswers: ({ game, days }) =>
            call(`rehearsal/trail-first-answers?${new URLSearchParams({ revision: String(at), game, days: String(days) })}`, {}, from),
          // 연습 기록 비우기(단계 4 계획 §22-4) — 이 판으로 비운다. 답의 revision이 비운 뒤의 새 판이다.
          clear: () => call('rehearsal/trail-clear', { method: 'POST', body: { revision: at } }, from),
          // 판 응답 읽기(단계 4 계획 §22-5) — 30일 안, 뺀 것 제외, 새것부터.
          responses: () => call(`rehearsal/trail-responses?${new URLSearchParams({ revision: String(at) })}`, {}, from),
        }),
      // 마지막 비우기 읽기(단계 4 계획 §22-4) — 판을 묻지 않는다. 답은 revision(지금 판) · lastClear({ revision, at } | null).
      lastClear: () => call('rehearsal/trail-clear', {}, from),
      postLegacy: events => call('rehearsal/trail-legacy', { method: 'POST', body: { revision, events } }, from),
    };
  };
}

// 첫 답 수(물음의 「답 N개」 — 지금 판 guestLearningEvents와 같은 셈): 옛 꼴 · 2판 모두 첫 시도의 답.
const firstAnswers = events =>
  events.filter(event => event?.type === 'practice.attempted' && event.attemptNo === 1).length;
// 생활 경험(world-life — life-items.mjs LIFE_GAME_ID)의 몫 { attempts, events } — 물음은 생활 레슨의 답을 생활 줄에 센다(짧은 진단 · 연습
// 줄에 넣으면 생활 레슨만 한 손님에게 같은 답이 다른 이름으로 두 줄에 섰다 — Fable 5.2 합친 끝 판 넘친 #8). 2판은 판 번호(set.<경험>.… — §19
// M9)와 판 결정 · 마침의 경험 이름(<경험>.set), 옛 꼴은 결정의 경험 이름으로 가리고, 딸린 사건은 부모(제시 · 결정 · 마침 · 제외 대상)를 따른다.
const LIFE_GAME = 'world-life';
const lifeOwn = event =>
  event?.experienceId === LIFE_GAME ||
  event?.experienceId === `${LIFE_GAME}.set` ||
  (typeof event?.setId === 'string' && event.setId.startsWith(`set.${LIFE_GAME}.`));
function lifeShare(events) {
  const byId = new Map(events.map(event => [event?.id, event]));
  const life = events.filter(event => {
    const seen = new Set();
    for (let at = event; at && !seen.has(at); at = byId.get(legacyParent(at))) {
      if (lifeOwn(at)) return true;
      seen.add(at);
    }
    return false;
  });
  return { attempts: firstAnswers(life), events: life.length };
}

const OLD = code => ({ path: 'old', code });
const GUEST = Object.freeze({ path: 'guest' });

// owner: 'guest' 또는 계정 id. lang(): 지금 화면 언어. label(id): 능력 이름(단위 이름은 엔진의 지도가 안다).
// storage: 옛 기록 · 표지를 둘 저장소(시험만 준다 — 주지 않으면 이 기기의 localStorage, null이면 읽개 · 표지 없이).
// trail: 계정 길(계정만 — 셸이 준다) — async () → { account?, learning: { enabled, revision }, learningSync, transport(revision) → { get(since),
//   post(events, since) }, postLegacy(events) → 답 }. 운영은 world-account.mjs prepareAtlasTrail, 리허설은 위 rehearsalTrail.
//   부를 때마다 계정을 다시 읽는다(판 · 동의 · 쓰기 문이 바뀌었으면 그 값으로). account(줄의 주인)를 실으면 이 입구의 주인과 같을 때만 쓴다.
// health: 계기(시험 · 셸이 줄 때만). 주지 않으면 엔진을 받은 뒤 엔진의 createHealth로 만들고, 그전 실패는 모았다가 옮긴다(§18-2 9 · F7).
// oldEngine: 옛 엔진의 두 문(셸이 준다 — 연습 기록 비우기, 4-5 §22-4). flush() — 계정의 옛 올리기 대기열을 다 올린다(던지거나 false ·
//   { ok: false }면 아무것도 지우지 않는다). clear({ check, read }?) — 옛 엔진의 손님 기록을 비운다(옛 손님 코치 reset — 던지면 그 code:
//   STORAGE_BUSY · STORAGE_ERROR). check가 오면(계정 비우기의 4b) 쓰기 임대를 쥔 채 read(입구가 넘기는 legacyReader)로 옛 로그를 다시 읽어 check가
//   참일 때만 비우고, 거짓이면 비우지 않고 'kept'를 돌려준다(4-5 코드 검수 GPT GA1). 없으면 옛 엔진 몫은 건너뛴다(엔진이 'none'으로 센다).
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
  oldEngine = null,
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
  const plans = new WeakMap(); // 코치 → 그 코치를 연 판(30일째 문장의 돌아보기 읽기가 그 판의 동의 판 · 나르개로 묻는다 — §21-22)
  // 코치 → 그 저장소 이름(손님 synk-atlas:guest · 올리는 길 · 기기 길 — 엔진 storeName). 기기의 판 기록(4-4b §21-6 가)의 열쇠다 — 같은 판의
  // 코치(짧은 연습 · 홈)는 같은 저장소라 같은 기록을 읽는다. 동의 판이 오르면 이름이 바뀌어 앞 판의 기록은 읽히지 않는다.
  const stores = new WeakMap();
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
    // 지금 판 앞(문서 시작의 처음 정하기 · 새 길 그대로)에 준 새 길 코치도 센다 — 다른 면이 묻는 사이 이 면이 새 길을 받았으면 그 면이 지금
    // 판을 준 직후 알린다(짧은 연습만 새 길로 가고 생활 판정이 알림 없이 지금 판에 남던 것 — 카본 처리 판 A2). 지금 판 뒤면 reopen이 센다.
    else loosened += 1;
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
  // 판이 바뀐 답(서버의 판 울타리 · 동의 꺼짐 — 엔진 sync.mjs의 'account' 갈래와 같다).
  const planFenced = error =>
    (error?.status === 409 && error?.code === 'REVISION_CONFLICT') ||
    (error?.status === 403 && error?.code === 'LEARNING_DISABLED');
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
      // 30일째 문장의 돌아보기 읽기(§21-22)도 같은 길로 잇는다 — 오프라인으로 연 뒤 다시 닿으면 그 판의 나르개로 묻는다. 이것이 없으면 다시 닿아
      // 받기가 이어져도 lookbackOf가 그 코치 내내 null이었다(4-4c 끝 판 GPT GA1). 다시 읽은 계정의 나르개에 읽기가 없으면(옛 계정
      // 클라이언트) 그 실패로 던진다 — 셸은 같은 기기 자리에서 다시 묻지 않는다.
      lookback: async offset => {
        const to = await ready();
        if (typeof to.lookback !== 'function')
          throw Object.assign(new Error('LOOKBACK_UNAVAILABLE'), { code: 'LOOKBACK_UNAVAILABLE' });
        return to.lookback(offset);
      },
      // 예상 급수의 근거 읽기(§21-23의 2)도 같은 길로 잇는다 — 돌아보기 읽기와 같은 까닭. 읽기가 없는 나르개면 그 실패로 던진다.
      firstAnswers: async query => {
        const to = await ready();
        if (typeof to.firstAnswers !== 'function')
          throw Object.assign(new Error('FIRST_ANSWERS_UNAVAILABLE'), { code: 'FIRST_ANSWERS_UNAVAILABLE' });
        return to.firstAnswers(query);
      },
      // 판 응답 읽기(§22-5)와 연습 기록 비우기(§22-4)도 같은 길로 잇는다 — 오프라인으로 연 뒤 다시 닿으면 그 판의 나르개로 한다. 문이 없는
      // 나르개(옛 계정 클라이언트)면 그 실패로 던진다.
      responses: async () => {
        const to = await ready();
        if (typeof to.responses !== 'function')
          throw Object.assign(new Error('RESPONSES_UNAVAILABLE'), { code: 'RESPONSES_UNAVAILABLE' });
        return to.responses();
      },
      clear: async () => {
        const to = await ready();
        if (typeof to.clear !== 'function') throw Object.assign(new Error('NO_CLEAR'), { code: 'NO_CLEAR' });
        return to.clear();
      },
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
    // 손님 호스트는 다른 탭이 손님 저장소를 비웠다는 알림(STORE_CLEARED — 4-5 §22-4 다른 탭의 은퇴 알림)만 받아 판을 다시 정한다. 저장소
    // 닫힘(STORE_CLOSED)은 지금처럼 계기에만 남긴다(손님 저장소는 지우기 대상이 아니다 — Fable 5.2 끝 판 F5 · 설계 주인 11-13).
    if (plan.path === 'guest')
      return {
        guest: true,
        health,
        legacy: store ? legacyReader(store) : null,
        onAccount: detail => {
          if (detail?.code === 'STORE_CLEARED') changed(detail, at);
        },
      };
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

  // 그 판의 저장소 이름(엔진 storeName — 호스트가 여는 이름과 같다). 엔진을 못 받았으면 null(판 기록을 열지 않을 뿐이다).
  function storeOf(plan, engine) {
    if (typeof engine?.storeName !== 'function') return null;
    try {
      if (plan.path === 'guest') return engine.storeName({});
      if (plan.path === 'device') return plan.key ?? null;
      return engine.storeName({ account: owner, revision: plan.revision });
    } catch {
      return null;
    }
  }

  // 입구 받기 · 코치 만들기 · 준비 — 어디서 실패해도 계기에 원인을 남기고 null(셸은 지금 판으로 간다).
  async function open(banks, plan, at, gameId) {
    let made = null;
    try {
      const { coach, engine } = await entry();
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
      const name = storeOf(plan, engine);
      if (name) stores.set(made, name);
      plans.set(made, plan);
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
    // 손님 입구는 판을 정하지 않는다 — 손님 코치를 처음 열 때 비우기가 확인된 계정의 남은 걸음을 뒤에서 건다(세대마다 한 번, F7).
    if (!account && plan.path === 'guest') void settleClearing(plan, at);
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
  // 판을 정하기 직전의 것이다(자기가 다시 정한 판까지 버리지 않게). 판이 거듭 바뀌어 못 정한 물음(planNow가 null · 두 번 다 세대가 바뀜)이
  // 지금 판으로 가는 것도 계기에 센다(PATH_CHANGING — 4-8에서 얼마나 밟는지 본다, Fable 5.2 합친 끝 판 넘친 #24).
  async function faceCoach(banks, gameId, since) {
    for (let tries = 0; tries < 2; tries += 1) {
      const now = await planNow();
      if (disposed) return null;
      if (!now) note('load', { ok: false, code: 'PATH_CHANGING' });
      if (!now || now.plan.path === 'old') return answered(null, since);
      const made = await coachFor(now.plan, banks, gameId, now.at);
      if (disposed) return null;
      if (now.at === generation) return answered(made, since);
    }
    note('load', { ok: false, code: 'PATH_CHANGING' });
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
      // 이번에 읽은 계정 줄 — 판 견줌이 마지막 비우기를 물을 때 쓴다(줄을 또 읽지 않게). 올리는 길은 판을 정한 줄이다.
      let seen = plan.line ?? null;
      if (!looked && (plan.unread || plan.path === 'device' || unsure === at)) {
        looked = true;
        const fresh = await lookAgain(plan, line => {
          seen = line;
        });
        if (disposed) return null;
        if (at !== generation) continue;
        if (fresh === false) {
          retire('account');
          continue;
        }
        if (fresh === true && unsure === at) unsure = null;
      }
      // 판 견줌과 남은 걸음을 새 판의 코치를 열기 전에 맞춘다(4-5 §22-4 — 본인 값을 옮기기 전에 새 판이 그 열쇠에 쓰지 않게).
      await settleClearing(plan, at, seen);
      if (disposed) return null;
      if (at !== generation) continue;
      return { plan, at };
    }
    return null;
  }
  // 계정을 다시 읽어 이 판이 그대로인가 — true(그대로 · 미확인 올리는 길이면 줄을 채워 푼다) · false(달라졌다 — 다시 정한다) · null(못
  // 읽었다 — 그대로 간다, 기기 길은 기기가 원천이다). 기기 길은 서버와 오가지 않아 판 · 동의가 바뀐 것을 알 길이 없어 열 때마다 읽는다(운영은
  // 게임 열기처럼 verify 한 번). 표지로 연 기기 길은 스위치를 묻지 못했다 — 읽히면 처음부터 다시 정한다.
  async function lookAgain(plan, seen = () => {}) {
    let line;
    try {
      line = await readLine();
    } catch {
      return null;
    }
    seen(line);
    if (plan.path === 'device') {
      const learning = line?.learning;
      return !plan.unread && learning?.revision === plan.revision && !(learning?.enabled === true && line?.learningSync === true);
    }
    if (plan.path !== 'upload') return true;
    if (!sameUpload(plan, line)) return false;
    if (plan.unread) adopt(plan, line);
    return true;
  }

  // ── 연습 기록 비우기(4-5 — 단계4_계획 §22-4 · 22-1의 4) ──────────────────────────────────────────
  // 옛 엔진의 손님 로그 — 엔진 reset이 받는 꼴({ read, clear }). 비우는 문은 셸이 준 옛 엔진 문이다. 엔진이 넘기는 { check }(계정 비우기의
  // 4b — GA1)를 그대로 넘긴다.
  // wait: 옛 쓰기 임대를 기다릴 한도(없으면 문의 기본). 손님 저장소의 남은 걸음은 0 — 다른 창이 쥐었으면 곧바로 busy로 둔다(F7).
  const legacyPort = ({ wait = null } = {}) => ({
    read: store ? legacyReader(store) : () => null,
    // 옛 엔진의 비우는 문에 옛 로그 읽개를 함께 넘긴다 — check가 오면(4b) 문이 쓰기 임대를 쥔 채 이 읽개로 다시 읽어 판단한다(4-5 코드 검수 GPT GA1).
    ...(typeof oldEngine?.clear === 'function'
      ? {
          clear: options =>
            oldEngine.clear({
              ...(options ?? {}),
              read: store ? legacyReader(store) : () => null,
              ...(wait == null ? {} : { wait }),
            }),
        }
      : {}),
  });
  // 같은 계정의 마지막 비우기(서버 — trail 길의 읽기). 받은 계정 줄(given)이 있으면 그 줄로 묻는다 — 마지막 비우기 읽기는 따로 서버에 가므로
  // 줄을 또 읽지 않는다. { revision, at, offset, slack, current } · undefined(못 읽음 · 읽기가 없는 줄 · 꼴이 틀림). revision은 마지막 비우기가 올린 판이다(비운 적이 없으면 0). current는 읽은 때의 계정 판이다(답에 없으면 null — 판 견줌의 asked).
  // at은 서버 시각(밀리초), offset은 답의 serverTime으로 잰 기기 시계의 어긋남(서버 − 기기 — 답에 시각이 없으면 null), slack은 그 어긋남을
  // 잰 읽기의 오간 시간 절반에 여유를 더한 것이다(clearedBefore).
  async function lastClearOf(given = null) {
    try {
      const line = given ?? (await readLine());
      if (typeof line?.lastClear !== 'function') return undefined;
      const sent = Date.now();
      const read = await line.lastClear();
      const back = Date.now();
      const last = read?.lastClear;
      if (last !== null && !(Number.isSafeInteger(last?.revision) && last.revision > 0)) return undefined;
      const server = msOf(read.serverTime);
      return {
        revision: last?.revision ?? 0,
        at: last ? msOf(last.at) : null,
        offset: server == null ? null : server - (sent + back) / 2,
        slack: (back - sent) / 2 + CLOCK_SLACK_MS,
        current: Number.isSafeInteger(read?.revision) && read.revision > 0 ? read.revision : null,
      };
    } catch {
      return undefined;
    }
  }
  // 마지막 비우기가 누른 비우기를 시작하기(at — 기기 시각, 이 문서만 안다) 전에 끝났나 — 그러면 이 비우기가 아니다(4-5 끝 판 GPT GC4). 서버
  // 시각으로 견주고, 시각을 모르면 거짓(이 비우기일 수 있다)이다.
  const clearedBefore = (last, at) =>
    Number.isFinite(last?.at) && Number.isFinite(last?.offset) && last.at + last.slack < at + last.offset;
  // 비운 뒤 이 기기의 몫(22-4 올리는 계정 2 · 3 — 성공 길과 판 견줌): 본인 값을 새 판 구역으로 옮기고(값이 남은 가장 가까운 앞 판 구역에서),
  // 앞 판을 쓸고, 30일째 문장의 답을 지운다. 쓸기 직전에 지금 판을 다시 읽어 그보다 앞선 판만 쓴다(GPT GA2 — 못 읽으면 서버가 준 판). 앞 판에서
  // 못 지운 열쇠가 있으면 거짓이다(GC6).
  async function settleDevice(path, revision) {
    moveOwn(store, owner, path, revision);
    let current = null;
    try {
      current = (await readLine())?.learning?.revision ?? null;
    } catch {
      current = null;
    }
    const swept = sweepEarlier(store, owner, Number.isSafeInteger(current) ? Math.min(current, revision) : revision);
    clearMonthAnswer(store, owner);
    return swept !== false;
  }
  // 판 견줌과 남은 걸음(22-4 「실패와 다시 누르기」) — 판을 다시 정할 때(planNow) 새 판의 코치를 열기 전에. 세대마다 한 번만 돈다(면 여럿이
  // 함께 물어도). 못 읽으면 수를 올리지 않아 다음 다시 정하기가 또 묻는다. 판 정하기가 기다리는 것은 이 기기의 몫(본인 값 옮기기 · 앞 판
  // 쓸기)뿐이다 — 손님 저장소의 남은 걸음(넷째 걸음 · 4b)은 계정의 새 판 코치가 보는 값을 바꾸지 않아 뒤에서 하고(slot.guest), 옛 쓰기 임대도
  // 기다리지 않는다(4-5 Opus 대체 설계 검토 F7 · 설계 주인 11-18). 로그아웃한 기기의 손님 입구는 남은 걸음 표지가 있는 계정의 걸음을 마저 한다.
  let settling = null;
  function settleClearing(plan, at, line = null) {
    if (!store || !(account ? NEXT_PATHS.has(plan.path) : plan.path === 'guest')) return null;
    if (settling?.at !== at) {
      // 자리를 먼저 적는다 — 손님 걸음이 여는 손님 코치(coachFor)가 같은 세대의 맞추기를 다시 부르면 이 자리를 본다.
      const slot = { at, guest: null, done: null };
      settling = slot;
      slot.done = settleOnce(plan, at, slot, line).catch(() => {});
    }
    return settling.done;
  }
  // 손님 저장소의 남은 걸음 하나(whose 계정의 표지 mark). 그사이 표지가 바뀌었으면(새 비우기 · 다른 탭이 마저 함) 덮지 않는다. 앞 판 쓸기만
  // 남았으면 손님 코치를 열지 않는다(GC6).
  async function guestSteps(plan, at, whose, mark) {
    if (mark.left === 'sweep') return stepsDone(at, whose, mark, null);
    const made = await coachFor(plan, MOVE_BANKS, 'world-practice', at);
    if (!made || disposed || at !== generation) return;
    // 넷째 걸음은 그 비우기가 올린 새 판(표지의 판)보다 앞선 판의 옮김 표지만 센다 — 비운 뒤 그 계정으로 새로 옮긴 사건은 둔다(4-5 Opus 대체
    // 설계 검토 F5). 손님 코치는 어느 계정의 걸음인지 받는다.
    const done = await made.reset({
      legacy: legacyPort({ wait: 0 }),
      settle: mark.left,
      revision: mark.revision,
      ...(account ? {} : { account: whose }),
    });
    if (!done?.ok) return;
    return stepsDone(at, whose, mark, leftOf(done.guest, mark.left));
  }
  // 남은 걸음의 끝 — 앞 판 쓸기를 다시 한다. 비운 뒤 못 지운 열쇠가 남았으면 또 지워 보고, 또 못 지우면 쓸기를 남긴다(4-5 끝 판 GPT GC6).
  function stepsDone(at, whose, mark, left) {
    if (disposed || at !== generation) return;
    const now = clearingOf(store, whose);
    if (!now || now.revision !== mark.revision || now.left !== mark.left) return;
    const rest = sweepEarlier(store, whose, mark.revision) === false ? (left ?? 'sweep') : left;
    writeClearing(store, whose, rest ? { ...mark, left: rest } : null);
  }
  async function settleOnce(plan, at, slot, line = null) {
    if (!account) {
      // 손님 입구 — 남은 걸음 표지가 있는 계정마다 차례로 뒤에서 한다. 손님은 그 계정의 마지막 비우기를 읽을 수 없다 — 이 기기가 아직 모르는
      // 비우기는 그 계정이 돌아오면 판 견줌이 맞춘다(§6).
      const marks = clearingOwners(store)
        .map(whose => [whose, clearingOf(store, whose)])
        .filter(([, mark]) => mark);
      if (!marks.length) return;
      slot.guest = (async () => {
        for (const [whose, mark] of marks) {
          if (disposed || at !== generation) return;
          await guestSteps(plan, at, whose, mark).catch(() => {});
        }
      })();
      return;
    }
    // 판 견줌 — 계정 판이 마지막으로 물은 판(asked)보다 올랐을 때만 마지막 비우기를 읽는다(계정을 못 읽은 채 연 판은 묻지 않는다). 비우기는
    // 늘 판을 올리므로, 판이 그대로면 그사이 비우기도 없다.
    if (!plan.unread && plan.revision > clearedOf(store, owner).asked) {
      const last = await lastClearOf(line);
      if (disposed || at !== generation) return;
      if (last !== undefined) {
        await followClear(plan.path, last, plan.revision);
        if (disposed || at !== generation) return;
        // 고른 판이 비운 뒤의 판보다 앞서면 그 판의 코치를 열지 않고 판을 다시 정한다 — 판을 정한 뒤에 끝난 비우기를 여기서 알았다(GC3).
        if (plan.revision < last.revision) {
          writeMark(store, owner, { went: true, path: plan.path, revision: last.revision });
          retire('cleared');
          return;
        }
      }
    }
    // 손님 저장소의 남은 걸음 — 비운 뒤의 판을 받은 판의 코치로 뒤에서 한다. 고른 판이 그 판보다 앞서면 다시 정한다(GC3).
    const mark = clearingOf(store, owner);
    if (!mark) return;
    if (plan.revision < mark.revision) {
      writeMark(store, owner, { went: true, path: plan.path, revision: mark.revision });
      retire('cleared');
      return;
    }
    slot.guest = guestSteps(plan, at, owner, mark).catch(() => {});
  }
  // 판 견줌의 한 걸음 — 마지막 비우기(last)가 이 기기가 몫을 마친 판(settled)보다 뒤면, 누가 비웠든 이 기기의 몫을 하고 손님 저장소의 걸음
  // (넷째 걸음과 4b — 표지가 없던 기기도 한다, 설계 주인 11-19 아침)을 남은 걸음 표지로 남긴다. 「새 길 간 적 있음」은 기다리기 전에 비운 뒤의
  // 판으로 옮긴다(GC3). 두 수는 몫을 마친 뒤에 올린다 — 그 사이 문서를 닫으면 다음 다시 정하기가 또 묻고 다시 한다(몫은 다시 해도 같다).
  // asked는 물은 때의 계정 판이다(답이 준 지금 판과 고른 판 가운데 큰 쪽). 몫을 했으면 참.
  async function followClear(path, last, revision) {
    const asked = Math.max(revision ?? 0, last.current ?? 0);
    if (!(last.revision > clearedOf(store, owner).settled)) {
      raiseCleared(store, owner, { asked });
      return false;
    }
    writeMark(store, owner, { went: true, path, revision: last.revision });
    await settleDevice(path, last.revision);
    settleLeft(path, last.revision, 'cleared');
    raiseCleared(store, owner, { settled: last.revision, asked: Math.max(asked, last.revision) });
    return true;
  }
  // 비운 뒤의 남은 걸음 표지(rest — 없으면 다 했다). 더 큰 판의 표지가 이기고, 같은 판이면 먼저 적은 표지를 둔다(같은 판의 좁은 표지는 넓은
  // 걸음을 마친 뒤에만 선다 — 넷째 걸음을 다시 하지 않게). 다 했으면 이 판 이하의 표지를 지운다 — 그 판의 넷째 걸음 경계와 쓸기가 앞 판의 것을
  // 덮는다. 그사이 다른 탭이 더 새 판의 표지를 적었으면 덮지도 지우지도 않는다: 늦게 끝난 앞 비우기가 뒤 비우기의 표지를 지워 다음 오프라인
  // 시작이 앞 판을 열었다(4-5 끝 판 GPT GC2).
  function settleLeft(path, revision, rest) {
    const now = clearingOf(store, owner);
    if (!rest) {
      if (now && now.revision <= revision) writeClearing(store, owner, null);
      return;
    }
    if (now && now.revision >= revision) return;
    writeClearing(store, owner, { path, revision, at: Date.now(), left: rest });
  }
  const stopped = path => ({ ok: false, path, code: 'DISPOSED', known: true });
  // 손님(22-4 손님 1 ~ 4). 손님 코치의 reset이 손님 저장소와 옛 엔진의 손님 기록을 비운다. 손님 판 기록 열쇠를 지우고 같은 문서의 손님 코치를
  // 은퇴시킨다(다시 정한다). 다른 탭은 엔진의 은퇴 알림(STORE_CLEARED)으로 바뀐다. 기기에 저장소가 없으면 「지금은 비우지 못했어요」.
  async function clearGuest() {
    if (!store) return { ok: false, path: 'guest', code: 'NO_STORAGE', known: true };
    const made = await coachFor(GUEST, MOVE_BANKS);
    if (disposed) return stopped('guest');
    if (!made) return { ok: false, path: 'guest', code: 'OPEN_FAILED', known: true };
    let done;
    try {
      done = await made.reset({ legacy: legacyPort() });
    } catch (error) {
      done = { ok: false, code: failCode(error) };
    }
    if (!done?.ok) return { ok: false, path: 'guest', code: done?.code ?? 'CLEAR_FAILED', known: true };
    // 옛 엔진 비우기가 안 됐거나(busy · failed) 판 기록 열쇠를 못 지웠으면 「일부만 비움」이다 — 새 길은 이미 비었고 바닥이 있어 되살아나지 않는다.
    let partial = done.legacy === 'busy' || done.legacy === 'failed';
    const name = stores.get(made);
    try {
      if (name) store.removeItem(planLogKey(name));
    } catch {
      partial = true;
    }
    retire('cleared');
    return { ok: true, path: 'guest', partial };
  }
  // 계정(22-4 올리는 계정 · 기기 길 계정 — 길 하나). 옛 엔진의 올리기 대기열을 먼저 올리고 판의 코치로 비운다.
  async function clearAccount({ allowSkipped = 0 } = {}) {
    const now = await planNow();
    if (disposed) return stopped('account');
    if (!now) return { ok: false, path: 'account', code: 'PATH_CHANGING', known: true };
    const { plan, at } = now;
    if (plan.path === 'old') return { ok: false, path: 'old', code: 'NOT_NEXT', known: true };
    const path = plan.path;
    // 기기 길의 서버 비우기는 입구가 준다 — 계정을 다시 읽어 그 판의 나르개로 비운다(판이 바뀌었으면 다시 정한다). 올리는 길은 판을 정한
    // 줄이다 — 실패 뒤 마지막 비우기를 이 줄로 묻는다.
    let clear = null;
    let line = plan.line ?? null;
    if (path === 'device') {
      try {
        line = await readLine();
      } catch (error) {
        return { ok: false, path, step: 'clear', code: failCode(error), known: true };
      }
      if (disposed) return stopped(path);
      const to =
        line?.learning?.revision === plan.revision && typeof line.transport === 'function'
          ? line.transport(plan.revision)
          : null;
      if (!to) {
        if (at === generation) retire('account');
        return { ok: false, path, step: 'clear', code: 'PLAN_CHANGED', known: true };
      }
      if (typeof to.clear !== 'function') return { ok: false, path, step: 'clear', code: 'NO_CLEAR', known: true };
      clear = () => to.clear();
    }
    const made = await coachFor(plan, MOVE_BANKS, 'world-practice', at);
    if (disposed) return stopped(path);
    if (!made) return { ok: false, path, code: 'OPEN_FAILED', known: true };
    // 0 — 옛 엔진의 올리기 대기열을 다 올린다(올리는 계정 — 기기 길은 올리지 않는다). 못 올리면 아무것도 지우지 않는다. 코치를 연 뒤 표지를 적기
    // 바로 전에 올려 서버 비우기와의 틈을 줄인다(4-5 Opus 대체 설계 검토 F1). 새 길의 대기열은 엔진 reset이 서버 비우기 앞에서 올린다.
    // 서버가 받지 않아 지금 보낼 수 없는 옛 사건은 막지도 버리지도 않는다 — 그 수를 엔진 reset에 넘겨 새 길의 몫과 더해 한 번에 알린다
    // (UNSENT_SKIPPED — 4-5 Opus 대체 설계 검토 F4 · 설계 주인 11-18). 학생이 그 수를 보고 한 번 더 확인하면 셸이 allowSkipped로 다시 부른다.
    let elsewhere = 0;
    if (path === 'upload' && typeof oldEngine?.flush === 'function') {
      let flushed;
      try {
        flushed = await oldEngine.flush();
      } catch {
        flushed = false;
      }
      if (disposed) return stopped(path);
      if (flushed?.code === 'UNSENT_SKIPPED' && Number.isSafeInteger(flushed.skipped) && flushed.skipped > 0)
        elsewhere = flushed.skipped;
      else if (flushed === false || flushed?.ok === false)
        return { ok: false, path, step: 'upload', code: 'UNSENT', known: true };
    }
    // 1 — 서버를 비운다. 결과를 모르는 비우기를 따로 적지 않는다 — 다음 다시 정하기의 판 견줌이 맞춘다(계정 판이 오르면 마지막 비우기를
    // 읽는다). 앞 비우기의 남은 걸음 표지는 건드리지 않는다: 이 비우기가 서버에 닿지 않고 끝나도, 결과를 몰라도 그대로 남는다(4-5 코드 다시
    // 검수 GPT -c GA3 · 끝 판 Fable F3). 누른 때(began)는 이 문서만 안다 — 다른 기기의 비우기와 가를 때 쓴다(GC4). 이 기기의 몫을 적을
    // 저장소가 없으면 비우지 않는다.
    if (!store) return { ok: false, path, code: 'MARK_FAILED', known: true };
    const began = Date.now();
    let done;
    try {
      done = await made.reset({
        legacy: legacyPort(),
        ...(clear ? { clear } : {}),
        ...(path === 'upload' ? { allowSkipped, skippedElsewhere: elsewhere } : {}),
      });
    } catch (error) {
      done = { ok: false, path, step: 'clear', code: failCode(error), known: false };
    }
    if (done?.ok) return cleared(path, done.revision, leftOf(done.guest));
    // 올리기에서 멈췄거나 서버 비우기를 부를 수 없었다 — 서버에 닿지 않은 것이 분명하다. 아무것도 바꾸지 않는다.
    if (done?.step === 'upload' || done?.code === 'NO_CLEAR') {
      return {
        ok: false,
        path,
        step: done.step,
        code: done.code,
        known: true,
        ...(Number.isSafeInteger(done.skipped) && done.skipped > 0 ? { skipped: done.skipped } : {}),
      };
    }
    // 서버 비우기가 실패했다(409 · 닿지 못함 · 답 끊김) — 같은 계정의 마지막 비우기를 읽어 판 견줌으로 맞춘다. 이 기기가 아직 몫을 하지 않은
    // 비우기면 누가 비웠든 몫을 한다(followClear — 결과를 모르던 앞 비우기도 여기서 맞는다, Fable 5.2 설계 검토 F1).
    const last = await lastClearOf(line);
    if (disposed) return stopped(path);
    if (last !== undefined) {
      await followClear(path, last, plan.revision);
      if (disposed) return stopped(path);
      if (last.revision > plan.revision) {
        // 고른 판 뒤에 비워졌다. 그 비우기가 이 비우기가 아닌 것이 분명하면(서버가 받지 않았다 — 409 등, 또는 누르기 전에 끝났다) 「비웠어요」가
        // 아니다: 그사이 새 판에 쌓인 기록이 남았을 수 있어 판이 바뀌었다고 알린다. 다시 누르면 새 판을 비운다(4-5 끝 판 GPT GC4).
        const after = await afterClear(path, last.revision, leftFor(last.revision));
        if (done?.known === true || clearedBefore(last, began))
          return { ok: false, path, step: 'clear', code: 'PLAN_CHANGED', known: true };
        return after;
      }
    }
    // 비워지지 않았다(또는 마지막 비우기를 못 읽었다). 결과를 모르면 늦게 끝나는 요청이 있을 수 있다 — 계정 판이 오르면 다음 다시 정하기가
    // 맞춘다. 서버가 받지 않은 것이 분명하면 판을 다시 정한다 — 다른 기기에서 동의를 껐다 켜 판만 올랐으면, 다시 눌러도 같은 앞 판으로 가서
    // 거절당했다(Fable 5.2 설계 검토 F2).
    if (done?.known === true && at === generation) retire('account');
    return { ok: false, path, step: 'clear', code: done?.code ?? 'CLEAR_FAILED', known: done?.known === true };
  }
  // 이 비우기(revision — 비운 뒤의 판)의 남은 걸음이 아직 있나 — 이 판 이상의 남은 걸음 표지(더 새 비우기의 넷째 걸음 경계가 앞 판의 것을 덮는다).
  function leftFor(revision) {
    const now = clearingOf(store, owner);
    return now != null && now.revision >= revision;
  }
  // 비운 뒤(22-4 올리는 계정 2 · 3 · 5) — 이 기기의 몫을 하고 남은 걸음을 적은 뒤 이 문서의 코치를 은퇴시킨다(새 판으로 다시 연다).
  async function cleared(path, revision, left) {
    // 「새 길 간 적 있음」 표지를 비운 뒤의 새 판으로 옮긴다 — 계정을 못 읽은 채 다시 열면 이 표지의 판으로 새 길을 연다(keptPath). 앞 판을
    // 가리키면 새 판 코치가 서기 전까지 남은 앞 판 저장소가 열려, 비운 기록이 다시 보이고 그 사이의 답은 버려졌다(4-5 Opus 대체 설계 검토 F3).
    // 그사이 다른 탭이 더 새 판을 적었으면 writeMark가 내리지 않는다(4-5 코드 다시 검수 GPT -c GA2). 기다리기 전에 적는다 — 기다리는 사이
    // 문서를 닫아도 앞 판에 머물지 않게(4-5 끝 판 GPT GC3).
    writeMark(store, owner, { went: true, path, revision });
    const swept = await settleDevice(path, revision);
    // 앞 판에서 못 지운 열쇠가 있으면 쓸기를 남겨 「일부만 비움」으로 알린다(GC6).
    const rest = left ?? (swept ? null : 'sweep');
    settleLeft(path, revision, rest);
    // 이 판까지 몫을 마쳤다 — 다음 다시 정하기는 이 판에서 마지막 비우기를 다시 묻지 않는다.
    raiseCleared(store, owner, { settled: revision, asked: revision });
    return afterClear(path, revision, rest);
  }
  // 비운 뒤의 끝 — 이 문서의 코치를 은퇴시킨다(새 판으로 다시 연다). 이 비우기의 걸음이 남았으면(rest) 곧바로 다시 정해 새 판의 코치로
  // 마저 한다 — 그사이 다른 탭이 적은 더 새 비우기의 걸음은 그 탭이 한다(GC2). 남은 걸음이 있으면 「일부만 비움」이다(다음 다시 정하기가
  // 또 한다).
  async function afterClear(path, revision, rest) {
    retire('cleared');
    if (rest && !disposed) {
      await planNow();
      // 판 정하기는 손님 저장소의 걸음을 기다리지 않지만, 누른 비우기는 「일부만 비움」인지 알리려고 그 걸음을 한 번 기다린다(F7).
      await settling?.guest;
    }
    return { ok: true, path, revision, partial: leftFor(revision) };
  }
  let clearing = null; // 지금 도는 비우기 — 겹쳐 누르면 같은 약속을 준다

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
    // 연습 기록 비우기(4-5 — 단계4_계획 §22-4). 셸이 「연습 기록 비우기」를 한 번 더 물어 확인한 뒤 부른다. 길은 기록이 사는 곳으로 가른다 —
    // 손님(이 기기의 손님 기록 전부) · 올리는 계정 · 기기 길 계정(서버 비우기로 판을 올린다). 돌려줌:
    //   { ok: true, path, revision?(계정 — 비운 뒤의 새 판), partial } — partial이면 「일부만 비움」(옛 손님 기록이나 손님 저장소의 걸음이
    //   남았다 — 다음 다시 정하기가 마저 한다).
    //   { ok: false, path, step?, code, known } — 아무것도 비웠다고 하지 않는다(「지금은 비우지 못했어요」). code UNSENT는 아직 올리지 못한
    //   기록이 있어 멈춘 것이다. code UNSENT_SKIPPED(skipped — 서버가 받지 않아 지금 보낼 수 없는 기록 수)면 셸이 그 수를 알려 한 번 더 묻고,
    //   확인하면 clearPractice({ allowSkipped: skipped })로 다시 부른다(F4). known이 거짓이면 서버의 결과를 모른다 — 계정 판이 오르면 다음 다시 정하기가 판 견줌으로 맞춘다.
    // 성공하면 이 문서의 코치를 은퇴시킨다(새 판으로 다시 연다). 셸은 계정 설정 스냅샷을 새로 받아 「내 계정」 시트를 다시 그린다. 겹쳐 누르면
    // 도는 비우기의 약속을 그대로 준다.
    clearPractice(options = {}) {
      if (disposed) return Promise.resolve(stopped(account ? 'account' : 'guest'));
      clearing ??= (account ? clearAccount(options) : clearGuest())
        .catch(error => ({ ok: false, path: account ? 'account' : 'guest', code: failCode(error), known: false }))
        .finally(() => {
          clearing = null;
        });
      return clearing;
    },
    // 생활 화면의 코치(4-2 — 은행 world-life · 경험 world-life, §19-1 ①). 짧은 연습과 같은 판 정하기 · 같은 호스트(저장소)이고,
    // 새 길 문서의 시작 때 셸이 미리 연다(M7 — 「돌아온 복습」 판정이 홈의 첫 그림부터 엔진을 읽게). 지금 판이면 null.
    async lifeCoach() {
      if (disposed) return null;
      const since = loosened;
      if (!account) return answered(await coachFor(GUEST, LIFE_BANKS, 'world-life'), since);
      return faceCoach(LIFE_BANKS, 'world-life', since);
    },
    // 홈의 코치(4-3 — §20-4). 생활 · 짧은 연습과 같은 판 정하기 · 같은 호스트다. 지금 판이면 null. pool: 짧은 연습 문항 풀 전체.
    async homeCoach(pool) {
      if (disposed) return null;
      const since = loosened;
      const banks = homeBanksOf(pool);
      if (!account) return answered(await coachFor(GUEST, banks, 'world-home'), since);
      return faceCoach(banks, 'world-home', since);
    },
    // 시험 형식 연습의 코치(4-4d — §21-23의 1). 짧은 연습 · 생활 · 홈과 같은 판 정하기 · 같은 호스트이고 gameId는 근거를 세는 판의 게임 이름
    // (world-month-answer.mjs FIRST_GAME — 'world-mock')이다. 판 번호(set.world-mock.…)가 예상 급수 근거의 판을 가리므로 근거 상자와 같은
    // 상수를 쓴다(Fable 끝 판 F15). 지금 판이면 null. pool: 시험 형식 풀(은행 + 빈칸 베기).
    async mockCoach(pool) {
      if (disposed) return null;
      const since = loosened;
      if (!account) return answered(await coachFor(GUEST, banksOf(pool), FIRST_GAME), since);
      return faceCoach(banksOf(pool), FIRST_GAME, since);
    },
    // 홈 플래너(4-3 — world-today.mjs). 엔진을 받아야 화면 언어의 문장(Vellum)을 그린다 — 못 받으면 null(셸은 생활 판정을 따라 지금 판으로 간다).
    async homePlanner() {
      if (disposed) return null;
      const loaded = await entry().catch(() => null);
      const render = loaded?.engine?.renderReason;
      if (disposed || typeof render !== 'function') return null;
      return Object.freeze({
        createWorldTodayPlan,
        watchHomePlan,
        todayKey,
        say: (why, language = lang()) => render(why, { lang: language, label }),
        // 내 위치 새 판(4-4a) — 홈과 같은 판 셋 · 같은 홈 코치로 그린다(셸 world-learning-ui.mjs openPosition).
        position: positionPlanner,
        // 이번 주 계획 새 판(4-4b) — 홈과 같은 홈 코치 · 내 위치와 같은 묶음 만남으로 짓는다(셸 world-learning-ui.mjs weekNext).
        plan: planPlanner,
      });
    },
    // 30일째 문장의 돌아보기 읽기(4-4c 둘째 묶음 — 단계4_계획 §21-22). 그 코치를 연 판이 올리는 길이면 그 판의 동의 판과 묻는 함수를 준다.
    // 묻기는 그 판의 나르개(계정 감싸개를 지난다 — 계정이 바뀌면 답을 받은 뒤 던진다)로 한다. 손님 · 기기 길 · 이 입구가 연 코치가 아님 ·
    // 판을 다시 정해 닫은 코치 · 나르개에 읽기가 없으면 null(문장 없이 그린다).
    lookbackOf(made) {
      const plan = made && !gone.has(made) ? plans.get(made) : null;
      if (disposed || plan?.path !== 'upload' || typeof plan.transport?.lookback !== 'function') return null;
      return Object.freeze({ revision: plan.revision, ask: offset => plan.transport.lookback(offset) });
    },
    // 예상 급수의 근거 읽기(4-4d — 단계4_계획 §21-23의 2). lookbackOf와 같은 규칙으로 그 판의 동의 판과 묻는 함수를 준다(묻는 값 game · days는
    // 상자가 넘긴다). 손님 · 기기 길 · 이 입구가 연 코치가 아님 · 닫은 코치 · 나르개에 읽기가 없으면 null(근거 수 없이 「확인 중」).
    firstAnswersOf(made) {
      const plan = made && !gone.has(made) ? plans.get(made) : null;
      if (disposed || plan?.path !== 'upload' || typeof plan.transport?.firstAnswers !== 'function') return null;
      return Object.freeze({ revision: plan.revision, ask: query => plan.transport.firstAnswers(query) });
    },
    // 판 응답 읽기(4-5 — 단계4_계획 §22-5). 그 코치를 연 판이 올리는 길이면 서버를 읽어 코치에 넘기고(코치가 그 값을 호스트가 사는 동안 든다),
    // 코치의 목록({ complete, rows })을 준다. 손님 · 기기 길은 서버를 읽지 않고 코치의 목록이다. 못 읽으면 앞 값 그대로이고 계기(load)에
    // 남긴다. 이 입구가 연 코치가 아니거나 판을 다시 정해 닫은 코치 · 닫힌 코치면 null.
    async readResponses(made) {
      const plan = made && !gone.has(made) ? plans.get(made) : null;
      if (disposed || !plan || typeof made.responses !== 'function') return null;
      // 읽기를 시작한 때의 판 — 기다리는 사이 판을 다시 정했으면(다른 읽기가 받은 409 · 403 포함) 앞 판의 목록을 주지 않는다. 닫은 코치 표(gone)는
      // 은퇴의 다음 차례에 적히므로, 같은 차례에 끝난 앞 읽기는 이 번호로 거른다(4-5 코드 다시 검수 GPT GA6).
      const at = generation;
      let server = null;
      if (plan.path === 'upload' && typeof plan.transport?.responses === 'function') {
        try {
          server = await plan.transport.responses();
        } catch (error) {
          const code = failCode(error);
          note('load', { ok: false, code: (code.startsWith('RESPONSES_') ? code : `RESPONSES_${code}`).slice(0, 40) });
          // 판 울타리 · 동의 꺼짐(409 REVISION_CONFLICT · 403 LEARNING_DISABLED)은 판이 바뀐 것이다 — 판을 다시 정하고(코치를 닫는다) 앞 판의
          // 목록을 주지 않는다(4-5 코드 검수 GPT — 다른 기기에서 비운 판의 응답이 「내 계정」 · 연습 길이에 남던 것). 그 밖의 실패는 앞 값 그대로다.
          if (planFenced(error)) {
            if (!disposed && at === generation && !gone.has(made) && plans.get(made) === plan) retire('account');
            return null;
          }
        }
      }
      if (disposed || at !== generation || gone.has(made)) return null;
      try {
        return made.responses(server == null ? {} : { server });
      } catch {
        return null;
      }
    },
    // 이 기기의 판 기록(4-4b — 단계4_계획 §21-6 가): 그 코치의 저장소 이름으로 연다. 이 입구가 연 코치가 아니거나 엔진을 못 받았으면 null —
    // 계획이 이번 주에 한 판을 세지 못할 뿐이다. 저장소가 없는 입구(storage null — 시험)도 null.
    planLog(made) {
      const name = made ? stores.get(made) : null;
      return name && store ? createPlanLog({ storage: store, store: name }) : null;
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
    //   않는다) · { attempts, events, life, move(), keep(), note(mark), close() } — attempts는 짧은 진단 · 연습의 첫 답 수, life는 생활
    //   경험의 { attempts, events }(물음의 생활 줄이 센다 — 넘친 #8), events는 옮길 사건 전체. move()는 { ok, … }(옛 꼴은 옛 POST로, 받았다는
    //   답이 아니면 표지 없이).
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
        const life = lifeShare([...legacy, ...found.current]);
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
          attempts: firstAnswers(legacy) + firstAnswers(found.current) - life.attempts,
          events: legacy.length + found.current.length,
          life,
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
