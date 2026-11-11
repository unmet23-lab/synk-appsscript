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
// 연습 문항의 열쇠 앞마디가 지도의 은행 이름이다(TOPIK 은행 topik-items, 진단이 빌려 쓰는 게임 문항은 그 게임 이름).
const BANKS = new Set([
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
]);

export function banksOf(pool) {
  const banks = new Set();
  for (const item of pool ?? []) {
    const head = String(item?.itemKey ?? '').split('.')[0];
    if (BANKS.has(head)) banks.add(head);
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
  let practice = null;
  let practiceBanks = '';
  let opening = null;
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
      // 연 코치는 다시 쓰되, 후보에 그 코치가 받지 않은 은행이 있으면 새로 연다(그 은행 문항이 계약 밖으로 빠지지 않게 — 아르곤 끝 판).
      const banks = banksOf(pool).join(',');
      if (practice && practiceBanks === banks) return practice;
      if (practice) {
        practice.dispose();
        practice = null;
      }
      opening ??= open(pool);
      const made = await opening;
      opening = null;
      // 준비되는 사이에 닫혔으면 그 코치를 닫고 돌려주지 않는다 — 떠난 화면의 코치 · 호스트가 남지 않게.
      if (disposed) {
        made?.dispose();
        return null;
      }
      practice = made;
      practiceBanks = banks;
      return practice;
    },
    dispose() {
      disposed = true;
      practice?.dispose();
      practice = null;
    },
  };
}
