// Atlas 새 길의 WORLD 입구(재설계 단계 4-1 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §6 · §7). 기능 atlasNext가 켜졌을 때만
// 셸이 동적 import로 부른다 — 꺼진 판은 이 파일도 엔진 입구(/atlas/loader.mjs)도 받지 않고, 지금 판 코치로 돈다.
// 짓는 동안(4-1)은 손님만 새 길로 간다. 계정은 단계 3 서버(learning?view=trail)가 반영된 뒤 이어서 짓는다(그전엔 null → 지금 판).
// 엔진이 준비되지 못하면(입구 · 묶음 · 지도 · 저장소) null을 돌려주고 셸은 지금 판으로 간다 — 학습이 막히지 않는다.
import { createPracticeNextSession } from './world-practice-next.mjs';

const ENTRY = '/atlas/loader.mjs';
// 지금 판 코치(atlas/game-learning.js)가 손님 기록을 두는 자리 — { version, epoch, events, ledger, … }.
export const LEGACY_KEY = 'synk.atlas.learning.v1.device';

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

// owner: 'guest' 또는 계정 id. lang(): 지금 화면 언어. label(id): 능력 이름(단위 이름은 엔진의 지도가 안다).
export function createAtlasNext({
  owner,
  lang = () => 'ko',
  label = () => null,
  load = () => import(ENTRY),
  health = null,
  storage = globalThis.localStorage,
} = {}) {
  // 은행 조합마다 코치 하나(준비 중인 약속째) — 후보에 다른 은행이 섞이면 그 은행을 받는 코치를 따로 연다(아르곤 끝 판 B5 · 다시 A4).
  // 같은 저장소의 호스트를 나눠 쓰므로 기록은 하나다.
  const coaches = new Map();
  let disposed = false;
  // 입구 받기 · 코치 만들기 · 준비 — 어디서 실패해도 계기에 원인을 남기고 null(셸은 지금 판으로 간다).
  async function open(pool) {
    let made = null;
    try {
      const { coach } = await load();
      made = coach({
        gameId: 'world-practice',
        banks: banksOf(pool),
        // 이유 줄이 「「은행」 처음 만나요」처럼 낱말 이름을 말하려면 낱말 이름이 든다 — 조각이 실으면 조각에서, 아니면 낱말 표에서.
        words: true,
        host: { guest: true, health, legacy: legacyReader(storage) },
        lang: lang(),
        label,
      });
      await made.ready;
    } catch (error) {
      health?.note('load', {
        ok: false,
        code: error?.reason ? `LOAD_${error.reason}` : (error?.code ?? 'LOAD_FAILED'),
      });
      made?.dispose();
      return null;
    }
    health?.note('load', { ok: true });
    return made;
  }
  return {
    createPracticeNextSession,
    // 짧은 연습의 코치 — 손님만(4-1). 한 번 연 코치는 다시 쓴다.
    async practiceCoach(pool) {
      if (owner !== 'guest' || disposed) return null;
      const banks = banksOf(pool).join(',');
      if (!coaches.has(banks)) {
        const opening = open(pool).then(made => {
          if (!made && coaches.get(banks) === opening) coaches.delete(banks); // 못 열었으면 다음에 다시
          return made;
        });
        coaches.set(banks, opening);
      }
      const made = await coaches.get(banks);
      // 준비되는 사이에 닫혔으면 돌려주지 않는다 — 그 코치는 dispose()가 닫는다(떠난 화면의 코치 · 호스트가 남지 않게).
      return disposed ? null : made;
    },
    dispose() {
      disposed = true;
      for (const opening of coaches.values()) void opening.then(made => made?.dispose());
      coaches.clear();
    },
  };
}
