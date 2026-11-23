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
import { buildWorldLearningCandidates } from './world-account.bundle.mjs';

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
