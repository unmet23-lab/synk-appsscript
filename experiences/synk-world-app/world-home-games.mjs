// Atlas 새 길 홈의 게임 목록(재설계 단계 4 · 4-6e-1 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §25-1). 셸은 이 파일을 부르지 않는다 —
// 홈(world-today.mjs)과 입구(world-atlas-next.mjs)가 정적으로 받고, 입구는 홈 플래너(games)로도 넘긴다. 꺼진 판에는 실리지 않는다.
// 목록은 게임마다 { id, gameId, bank, open, items }다. id와 open은 옛 후보(계정 묶음의 buildWorldLearningCandidates — world.play.runner 등)의
// 것이고, gameId는 셸의 짧은 이름, bank는 그 게임의 은행이다. items는 그 게임이 recommend로 고르는 문항만이다 — 홈 줄의 단위를 게임이 실제로
// 낼 수 있게 하려는 것이다.
//   바람길  듣기 확인 12(옛 후보 함수의 문항).
//   환승    그 학생의 난도에서 게임이 낼 수 있는 결정 문항 — 난도마다 아래 표(첫 등굣길 25 · 바쁜 아침 30). 난도는 게임과 같은 규칙(저장한 난도가
//           목표 급보다 먼저 — subway-rush/level.mjs startLevel)이다. 옛 후보 함수의 급 거름은 쓰지 않는다 — 게임은 그 난도로 지은 여정의 결정만
//           내고(journeys.mjs practiceStarts), 게임이 내지 않는 문항이 후보에 남으면 영영 처음 보는 문항이라 숙제 줄과 게임 단추가 끝나지 않는다.
//           열렸는지는 옛 후보 함수에 환승 후보가 있는가(해금 표)로 본다.
//   리듬    곡 문항 30(아래 표). 다시 묻기 문항(새 문장 확인)은 게임이 정해진 차례로만 내므로 넣지 않는다.
// 두 표는 아무것도 import하지 않고 홈이 쓰는 칸(itemKey · familyKey · skillId — 형식은 모두 듣기이고 소리가 든다)만 싣는다. 게임 코드를 부르면
// 리듬 모듈 열두 개쯤과 JSON 모듈이 입구의 정적 import 닫힘에 들고(§25-0), 형제 폴더 import는 공개 빌드에서 경로가 바뀐다. 표가 게임이 고르는
// 문항과 같은지는 시험이 리듬 songItems() · 환승 practiceStarts(level)의 decisionMeta와 견준다(qa/atlas-next-home.test.mjs).
// 손님이 열 수 없는 게임(openGames 밖)과 해금 전 환승은 목록에 넣지 않는다 — 로그인으로만 열리는 게임을 잠근 줄로 넘기면 홈이 그날을 「시간이나
// 소리 설정을 바꿔 볼 수 있어요」의 조건에 걸린 날로 센다. 목록은 부를 때마다 지금 값(저장한 환승 난도 · 목표 급 · 해금 · 열린 게임)으로 짓는다.
// 4-6e-2(§25-3 불변식 다)에서 길 표(createRoutes)가 들어왔다 — 능력 하나에 짧은 연습인가 게임인가를 정하는 한 곳이다. 입구가 홈 플래너에 실어
// 셸에 넘기고, 셸이 문서마다 한 벌을 지어 계획 · 홈 숙제 · 「이 항목 연습하기」가 같은 표에 묻는다.
import { buildWorldLearningCandidates } from './world-account.bundle.mjs';
import { metOf, practiceFresh } from './world-practice-next.mjs';

// 셸의 짧은 이름과 그 게임의 은행 — 셸 games 표의 주소 폴더와 같다(원문 시험이 견준다).
export const GAME_BANK = Object.freeze({ runner: 'korean-runner', rhythm: 'korean-rhythm', subway: 'subway-rush' });
// 홈 코치가 늘 여는 게임 은행(입구 homeBanksOf가 고정으로 더한다).
export const HOME_GAME_BANKS = Object.freeze(Object.values(GAME_BANK).sort());
// 환승 러시가 저장하는 난도(subway-rush/app.mjs setLevel — WORLD와 같은 출처의 기기 저장소).
export const SUBWAY_LEVEL_KEY = 'synk.subway.level';

// 표의 줄: [itemKey, familyKey, skillId].
const RHYTHM_ROWS = [
  ['korean-rhythm:t0q0:v1:claim0', 'korean-rhythm:t0q0:v1', 'ko.listening.detail'],
  ['korean-rhythm:t0q0:v1:claim1', 'korean-rhythm:t0q0:v1', 'ko.listening.detail'],
  ['korean-rhythm:t0q1:v1:claim0', 'korean-rhythm:t0q1:v1', 'ko.listening.detail'],
  ['korean-rhythm:t0q1:v1:claim1', 'korean-rhythm:t0q1:v1', 'ko.listening.detail'],
  ['korean-rhythm:t0q2:v1:claim0', 'korean-rhythm:t0q2:v1', 'ko.listening.negation'],
  ['korean-rhythm:t0q2:v1:claim1', 'korean-rhythm:t0q2:v1', 'ko.listening.negation'],
  ['korean-rhythm:t0q3:v1:claim0', 'korean-rhythm:t0q3:v1', 'ko.listening.negation'],
  ['korean-rhythm:t0q3:v1:claim1', 'korean-rhythm:t0q3:v1', 'ko.listening.negation'],
  ['korean-rhythm:t0q4:v1:claim0', 'korean-rhythm:t0q4:v1', 'ko.listening.negation'],
  ['korean-rhythm:t0q4:v1:claim1', 'korean-rhythm:t0q4:v1', 'ko.listening.negation'],
  ['korean-rhythm:t1q0:v1:claim0', 'korean-rhythm:t1q0:v1', 'ko.listening.reason'],
  ['korean-rhythm:t1q0:v1:claim1:v2', 'korean-rhythm:t1q0:v1', 'ko.listening.reason'],
  ['korean-rhythm:t1q1:v1:claim0', 'korean-rhythm:t1q1:v1', 'ko.listening.detail'],
  ['korean-rhythm:t1q1:v1:claim1', 'korean-rhythm:t1q1:v1', 'ko.listening.detail'],
  ['korean-rhythm:t1q2:v1:claim0', 'korean-rhythm:t1q2:v1', 'ko.listening.reason'],
  ['korean-rhythm:t1q2:v1:claim1', 'korean-rhythm:t1q2:v1', 'ko.listening.reason'],
  ['korean-rhythm:t1q3:v1:claim0', 'korean-rhythm:t1q3:v1', 'ko.listening.detail'],
  ['korean-rhythm:t1q3:v1:claim1', 'korean-rhythm:t1q3:v1', 'ko.listening.detail'],
  ['korean-rhythm:t1q4:v1:claim0', 'korean-rhythm:t1q4:v1', 'ko.listening.reason'],
  ['korean-rhythm:t1q4:v1:claim1', 'korean-rhythm:t1q4:v1', 'ko.listening.reason'],
  ['korean-rhythm:t2q0:v1:claim0', 'korean-rhythm:t2q0:v1', 'ko.listening.condition'],
  ['korean-rhythm:t2q0:v1:claim1', 'korean-rhythm:t2q0:v1', 'ko.listening.condition'],
  ['korean-rhythm:t2q1:v1:claim0', 'korean-rhythm:t2q1:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q1:v1:claim1', 'korean-rhythm:t2q1:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q2:v1:claim0:v3', 'korean-rhythm:t2q2:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q2:v1:claim1:v3', 'korean-rhythm:t2q2:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q3:v1:claim0:v2', 'korean-rhythm:t2q3:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q3:v1:claim1:v2', 'korean-rhythm:t2q3:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q4:v1:claim0', 'korean-rhythm:t2q4:v1', 'ko.listening.detail'],
  ['korean-rhythm:t2q4:v1:claim1', 'korean-rhythm:t2q4:v1', 'ko.listening.detail'],
];
const SUBWAY_BASIC_ROWS = [
  ['subway-rush.stop.chungjeongno.pass.right.v1', 'subway-rush.stop.chungjeongno.pass.v1', 'ko.listening.detail'],
  ['subway-rush.stop.cityhall.off.left.v1', 'subway-rush.stop.cityhall.off.v1', 'ko.listening.detail'],
  ['subway-rush.fork.cheongnyangni.jongno5.v1', 'subway-rush.fork.cheongnyangni.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno3.pass.right.v1', 'subway-rush.stop.jongno3.pass.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno5.off.right.v1', 'subway-rush.stop.jongno5.off.v1', 'ko.listening.detail'],
  ['subway-rush.exit.3.v1', 'subway-rush.exit.3.v1', 'ko.listening.detail'],
  ['subway-rush.fork.cheongnyangni.dongdaemun.v1', 'subway-rush.fork.cheongnyangni.v1', 'ko.listening.detail'],
  ['subway-rush.stop.dongdaemun.off.left.v1', 'subway-rush.stop.dongdaemun.off.v1', 'ko.listening.detail'],
  ['subway-rush.exit.8.v1', 'subway-rush.exit.8.v1', 'ko.listening.detail'],
  ['subway-rush.stop.chungjeongno.pass.left.v1', 'subway-rush.stop.chungjeongno.pass.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno3.pass.left.v1', 'subway-rush.stop.jongno3.pass.v1', 'ko.listening.detail'],
  ['subway-rush.exit.5.v1', 'subway-rush.exit.5.v1', 'ko.listening.detail'],
  ['subway-rush.stop.cityhall.off.right.v1', 'subway-rush.stop.cityhall.off.v1', 'ko.listening.detail'],
  ['subway-rush.fork.cheongnyangni.jongno3.v1', 'subway-rush.fork.cheongnyangni.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno3.off.left.v1', 'subway-rush.stop.jongno3.off.v1', 'ko.listening.detail'],
  ['subway-rush.exit.2.v1', 'subway-rush.exit.2.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno5.off.left.v1', 'subway-rush.stop.jongno5.off.v1', 'ko.listening.detail'],
  ['subway-rush.exit.6.v1', 'subway-rush.exit.6.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno3.off.right.v1', 'subway-rush.stop.jongno3.off.v1', 'ko.listening.detail'],
  ['subway-rush.stop.dongdaemun.off.right.v1', 'subway-rush.stop.dongdaemun.off.v1', 'ko.listening.detail'],
  ['subway-rush.exit.7.v1', 'subway-rush.exit.7.v1', 'ko.listening.detail'],
  ['subway-rush.exit.4.v1', 'subway-rush.exit.4.v1', 'ko.listening.detail'],
  ['subway-rush.exit.1.v1', 'subway-rush.exit.1.v1', 'ko.listening.detail'],
  ['subway-rush.stop.euljiro3.pass.left.v1', 'subway-rush.stop.euljiro3.pass.v1', 'ko.listening.detail'],
  ['subway-rush.stop.euljiro3.pass.right.v1', 'subway-rush.stop.euljiro3.pass.v1', 'ko.listening.detail'],
];
const SUBWAY_BUSY_ROWS = [
  ['subway-rush.stop.chungjeongno.pass.right.v1', 'subway-rush.stop.chungjeongno.pass.v1', 'ko.listening.detail'],
  ['subway-rush.busy.short.right.v1', 'subway-rush.busy.short.v1', 'ko2.listening.detail'],
  ['subway-rush.fork.cheongnyangni.jongno3.v1', 'subway-rush.fork.cheongnyangni.v1', 'ko.listening.detail'],
  ['subway-rush.busy.express.jonggak.jongno3.v1', 'subway-rush.busy.express.jongno3.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.jongno3.off.right.v1', 'subway-rush.stop.jongno3.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.exit.7.6.v1', 'subway-rush.busy.exit.7.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.cityhall.off.left.v1', 'subway-rush.stop.cityhall.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.delay.1to2.v1', 'subway-rush.busy.delay.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.euljiro3.off.right.v1', 'subway-rush.stop.euljiro3.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.exit.4.3.v1', 'subway-rush.busy.exit.4.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.chungjeongno.pass.left.v1', 'subway-rush.stop.chungjeongno.pass.v1', 'ko.listening.detail'],
  ['subway-rush.busy.short.left.v1', 'subway-rush.busy.short.v1', 'ko2.listening.detail'],
  ['subway-rush.fork.cheongnyangni.jongno5.v1', 'subway-rush.fork.cheongnyangni.v1', 'ko.listening.detail'],
  ['subway-rush.busy.express.jonggak.jongno5.v1', 'subway-rush.busy.express.jongno5.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.jongno3.pass.left.v1', 'subway-rush.stop.jongno3.pass.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno5.off.right.v1', 'subway-rush.stop.jongno5.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.exit.5.3.v1', 'subway-rush.busy.exit.5.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.euljiro3.off.left.v1', 'subway-rush.stop.euljiro3.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.exit.6.7.v1', 'subway-rush.busy.exit.6.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.jongno5.off.left.v1', 'subway-rush.stop.jongno5.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.exit.1.2.v1', 'subway-rush.busy.exit.1.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.cityhall.off.right.v1', 'subway-rush.stop.cityhall.off.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno3.off.left.v1', 'subway-rush.stop.jongno3.off.v1', 'ko.listening.detail'],
  ['subway-rush.busy.exit.2.1.v1', 'subway-rush.busy.exit.2.v1', 'ko2.listening.detail'],
  ['subway-rush.busy.exit.3.4.v1', 'subway-rush.busy.exit.3.v1', 'ko2.listening.detail'],
  ['subway-rush.fork.cheongnyangni.jonggak.v1', 'subway-rush.fork.cheongnyangni.v1', 'ko.listening.detail'],
  ['subway-rush.busy.express.jonggak.jonggak.v1', 'subway-rush.busy.express.jonggak.v1', 'ko2.listening.detail'],
  ['subway-rush.stop.jonggak.off.right.v1', 'subway-rush.stop.jonggak.off.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jonggak.off.left.v1', 'subway-rush.stop.jonggak.off.v1', 'ko.listening.detail'],
  ['subway-rush.stop.jongno3.pass.right.v1', 'subway-rush.stop.jongno3.pass.v1', 'ko.listening.detail'],
];

const rowsOf = rows =>
  Object.freeze(
    rows.map(([itemKey, familyKey, skillId]) =>
      Object.freeze({ itemKey, familyKey, skillId, modality: 'listening', audioRequired: true }),
    ),
  );
export const RHYTHM_ITEMS = rowsOf(RHYTHM_ROWS);
export const SUBWAY_ITEMS = Object.freeze({ basic: rowsOf(SUBWAY_BASIC_ROWS), busy: rowsOf(SUBWAY_BUSY_ROWS) });

// 환승의 시작 난도 — subway-rush/level.mjs startLevel에서 주소로 정한 판(forced)만 뺀 것이다. WORLD는 주소로 난도를 정하지 않는다(셸 games 표는
// ?grade=만 넘긴다). 원문 시험이 startLevel과 같은지 본다.
export const subwayLevel = ({ saved = null, grade = null } = {}) =>
  saved === 'busy' || saved === 'basic' ? saved : Number(grade) >= 3 ? 'busy' : 'basic';

function savedSubwayLevel(storage) {
  try {
    return storage?.getItem?.(SUBWAY_LEVEL_KEY) ?? null;
  } catch {
    return null;
  }
}
// 이 기기의 localStorage — 사이트 저장소가 막히면 속성을 읽기만 해도 던진다. 그때는 저장한 난도가 없는 것으로 본다.
function deviceStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// 옛 후보의 겨눔(바람길) → 홈의 칸.
const targetRow = target =>
  Object.freeze({
    itemKey: target.itemKey,
    familyKey: target.familyKeys?.[0] ?? null,
    skillId: target.skillIds?.[0] ?? null,
    modality: target.modality ?? 'listening',
    audioRequired: true,
  });

const SHORT = Object.freeze({ 'world.play.runner': 'runner', 'world.play.rhythm': 'rhythm', 'world.play.subway': 'subway' });

// 지금 값으로 지은 게임 목록. progress: 생활 진도 스냅숏 · settings: 학습 설정 값(목표 급 targetGrade) · openGames: 손님에게 열린 게임
// (null이면 모두) · storage: 저장한 환승 난도를 읽을 기기 저장소. 옛 후보 함수가 던지면 빈 목록이다(게임 줄 없이 그린다).
export function homeGames({ progress = {}, settings = {}, now = Date.now(), openGames = null, storage = deviceStorage() } = {}) {
  let candidates = [];
  try {
    candidates = buildWorldLearningCandidates({ progress, settings, now, openGames });
  } catch {
    return [];
  }
  const out = [];
  for (const candidate of candidates) {
    const gameId = SHORT[candidate?.id];
    if (!gameId || candidate.available === false) continue;
    const items =
      gameId === 'runner'
        ? Object.freeze((candidate.targets ?? []).filter(target => typeof target?.itemKey === 'string').map(targetRow))
        : gameId === 'rhythm'
          ? RHYTHM_ITEMS
          : SUBWAY_ITEMS[subwayLevel({ saved: savedSubwayLevel(storage), grade: settings?.targetGrade })];
    // open의 겨눔은 비운다 — 환승의 옛 겨눔에는 게임이 내지 않는 문항이 든다. 홈이 읽는 문항은 items다.
    const open = Object.freeze({ ...candidate, targets: [] });
    out.push(Object.freeze({ id: candidate.id, gameId, bank: GAME_BANK[gameId], open, items }));
  }
  return out;
}

// ── 길 표(4-6e-2 — 단계4_계획 §25-3 불변식 다) ──
// 능력 하나의 길: 그 능력의 처음 보는 짧은 연습 문항이 있으면 짧은 연습, 없으면 처음 보는 문항이 남은 게임의 차례 맨 앞이다. 계획 단추 · 홈 숙제
// 줄 · 「이 항목 연습하기」 · 카드는 묻는 능력만 다르고, 같은 능력에는 같은 답을 받는다. 길은 소리를 켠 셈으로 정한다 — 소리를 끈 날의 처리는
// 부르는 쪽이 한다(계획은 듣기를 세지 않고, 홈은 숙제 줄을 잠그고, 「이 항목 연습하기」는 게임 단추를 달지 않는다).

// 홈 코치가 지금 돌아온 것으로 보는 단위(Set). 못 읽으면 빈 묶음이다.
function dueOf(coach) {
  try {
    const due = coach.due();
    return new Set(Array.isArray(due) ? due.map(row => row?.unit).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}
const NO_DUE = new Set();
const unitsOf = (itemUnits, key) => {
  try {
    return (typeof itemUnits === 'function' ? (itemUnits(key) ?? []) : []).map(row => row?.unit).filter(Boolean);
  } catch {
    return [];
  }
};
const listOf = items => (Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : []);

// 안쪽 함수 — 한 능력의 문항만 받아 길을 정한다. items의 한 줄은 { kind: 'practice', item, fresh } 또는 { kind: 'game', game, item, fresh, returned }다
// (fresh: 처음 보는가 · returned: 그 문항에 지금 돌아온 단위가 드는가). 능력 밖 문항을 받으면 던진다(설계 주인 25-12의 10) — 부르는 쪽이 능력을
// 잘못 거르면 다른 능력의 답이 섞인 길이 조용히 서지 않게.
// 돌려줌: { skillId, route: 'practice' | 'game' | null, gameId?, id?, practice: 처음 보는 짧은 연습 문항, games: [{ id, gameId, open, items, left }] }.
// games는 처음 보는 문항이 남은 게임의 차례다 — 처음 보는 문항 가운데 돌아온 단위가 든 문항을 빼고도 남은 게임(left > 0)이 앞이고, 그 밖에는
// 목록 차례다. 돌아온 단위가 든 문항은 그날 홈 복습 칸이 맡는다(§25-1).
export function routeFrom(skillId, items) {
  if (typeof skillId !== 'string' || !skillId) throw TypeError('WORLD routes need a skill id');
  const practice = [];
  const games = new Map();
  for (const entry of Array.isArray(items) ? items : []) {
    if (entry?.item?.skillId !== skillId)
      throw TypeError(`WORLD routes: ${entry?.item?.itemKey ?? '(문항 없음)'} is not an item of ${skillId}`);
    if (entry.kind === 'practice') {
      if (entry.fresh === true) practice.push(entry.item);
      continue;
    }
    if (entry.kind !== 'game' || !entry.game) throw TypeError('WORLD routes: an item is neither practice nor game');
    if (!games.has(entry.game)) games.set(entry.game, { fresh: [], left: 0 });
    const row = games.get(entry.game);
    if (entry.fresh !== true) continue;
    row.fresh.push(entry.item);
    if (entry.returned !== true) row.left += 1;
  }
  const listed = [...games]
    .filter(([, row]) => row.fresh.length > 0)
    .map(([game, row]) =>
      Object.freeze({ id: game.id, gameId: game.gameId, open: game.open, items: Object.freeze(row.fresh), left: row.left }),
    );
  const ordered = [...listed.filter(game => game.left > 0), ...listed.filter(game => game.left === 0)];
  const route = practice.length ? 'practice' : ordered.length ? 'game' : null;
  return Object.freeze({
    skillId,
    route,
    ...(route === 'game' ? { gameId: ordered[0].gameId, id: ordered[0].id } : {}),
    practice: Object.freeze(practice),
    games: Object.freeze(ordered),
  });
}

// 길 표 한 벌. 셸이 문서마다 하나를 시험 관문 밖에서 짓고(시험을 고르지 않은 학생에게도 선다), 열쇠(묶음 만남의 캐시 열쇠 · 기록이 바뀐 셈 ·
// 홈 코치)가 바뀔 때만 다시 짓는다. 받는 것: coach — 홈 코치 · practice — 짧은 연습 풀 전체(학생의 시험으로 거르기 전) · games — 지금 게임 목록
// (homeGames) · itemUnits — 단위 읽개 · diagnostic · mock · entry — 같은 묶음 만남에 함께 묻는 진단 풀 · 시험 형식 풀 · 입장 검사 정규 손님 문항.
// 묶음 만남은 한 번이고 차례는 진단 · 짧은 연습 · 시험 형식 · 게임 · 입장 검사다. 만남 줄(rows)은 문항마다의 만남(met · seen)이고 길 답이
// 아니다 — 계획 · 홈 · 내 위치의 칸 규칙(unseenFamilies · prefer · planStart)과 카드는 이 줄만 읽고 만남을 따로 묻지 않는다. 시험 형식 몫은 그
// 풀의 길이만큼 자른다(시험 형식 고르기가 그 길이로 받아야 만남을 다시 묻지 않는다).
// 짧은 연습 문항의 처음 보는가는 실제 짧은 연습과 같은 판정(world-practice-next.mjs practiceFresh)을 풀 전체에서 먼저 셈한 뒤 능력으로 고른다 —
// 같은 지문 세트의 다른 능력 문항을 만났으면 처음이 아니기 때문이다. 게임 문항의 처음 보는가는 묶음 만남의 게임 몫(seen === false)이다.
// 돌아온 단위는 표에 담지 않는다 — 시각에 따라 바뀌므로 routeOf를 물을 때마다(여러 능력을 한 번에 물으면 reader를 받을 때마다) 홈 코치의 due()로 읽는다.
export function createRoutes({ coach, practice = [], diagnostic = [], mock = [], entry = [], games = [], itemUnits = null } = {}) {
  if (typeof coach?.exposures !== 'function') throw TypeError('WORLD routes need the home coach');
  const lists = { diagnostic: listOf(diagnostic), practice: listOf(practice), mock: listOf(mock), entry: listOf(entry) };
  const gameList = Object.freeze((Array.isArray(games) ? games : []).filter(game => game && Array.isArray(game.items)));
  const gameItems = gameList.flatMap(game => game.items);
  const all = coach.exposures([...lists.diagnostic, ...lists.practice, ...lists.mock, ...gameItems, ...lists.entry]);
  const d = lists.diagnostic.length;
  const p = lists.practice.length;
  const m = lists.mock.length;
  const g = gameItems.length;
  const rows = Object.freeze({
    diagnostic: Object.freeze(all.slice(0, d)),
    practice: Object.freeze(all.slice(d, d + p)),
    mock: Object.freeze(all.slice(d + p, d + p + m)),
    games: Object.freeze(all.slice(d + p + m, d + p + m + g)),
    entry: Object.freeze(all.slice(d + p + m + g)),
  });
  const practiceRows = new Map(lists.practice.map((item, i) => [item, rows.practice[i]]));
  const freshPractice = practiceFresh({ setPool: lists.practice, met: item => metOf(practiceRows.get(item)) });
  const freshSet = new Set(lists.practice.filter(freshPractice));
  const gameEntries = [];
  let at = 0;
  for (const game of gameList) for (const item of game.items) gameEntries.push({ game, item, row: rows.games[at++] });
  const unitCache = new Map();
  const units = key => {
    if (!unitCache.has(key)) unitCache.set(key, unitsOf(itemUnits, key));
    return unitCache.get(key);
  };
  // 능력 하나의 길. dueNow(): 홈 코치의 돌아온 단위 — 게임의 차례만 정하므로, 이 능력의 처음 보는 게임 문항이 없으면 읽지 않는다.
  function routeWith(skillId, dueNow) {
    const mine = lists.practice.filter(item => item.skillId === skillId);
    const played = gameEntries.filter(({ item }) => item.skillId === skillId);
    const due = played.some(({ row }) => row?.seen === false) ? dueNow() : NO_DUE;
    return routeFrom(skillId, [
      ...mine.map(item => ({ kind: 'practice', item, fresh: freshSet.has(item) })),
      ...played.map(({ game, item, row }) => ({
        kind: 'game',
        game,
        item,
        fresh: row?.seen === false,
        returned: due.size > 0 && units(item.itemKey).some(unit => due.has(unit)),
      })),
    ]);
  }
  const routeOf = skillId => routeWith(skillId, () => dueOf(coach));
  // 한 번 그리는 동안 여러 능력을 물을 때의 읽개 — 돌아온 단위를 한 번만 읽는다(능력마다 읽으면 기록이 많은 기기에서 홈을 그릴 때마다 수십 번 셈한다).
  // 그릴 때마다 새로 받는다. 붙들고 쓰면 시각이 지나 돌아온 단위를 모른다.
  const reader = () => {
    let due = null;
    return skillId => routeWith(skillId, () => (due ??= dueOf(coach)));
  };
  return Object.freeze({
    pools: Object.freeze({ ...lists, games: Object.freeze(gameItems) }),
    rows,
    games: gameList,
    routeOf,
    reader,
  });
}
