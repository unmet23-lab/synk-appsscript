// Atlas 새 길의 WORLD 입구(재설계 단계 4-1 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §6 · §7). 기능 atlasNext가 켜졌을 때만
// 셸이 동적 import로 부른다 — 꺼진 판은 이 파일도 엔진 입구(/atlas/loader.mjs)도 받지 않고, 지금 판 코치로 돈다.
// 짓는 동안(4-1)은 손님만 새 길로 간다. 계정은 단계 3 서버(learning?view=trail)가 반영된 뒤 이어서 짓는다(그전엔 null → 지금 판).
// 엔진이 준비되지 못하면(입구 · 묶음 · 지도 · 저장소) null을 돌려주고 셸은 지금 판으로 간다 — 학습이 막히지 않는다.
import { createPracticeNextSession } from './world-practice-next.mjs';

const ENTRY = '/atlas/loader.mjs';
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
export function createAtlasNext({ owner, lang = () => 'ko', label = () => null, load = () => import(ENTRY), health = null } = {}) {
  let practice = null;
  let opening = null;
  async function open(pool) {
    const { coach } = await load();
    const made = coach({
      gameId: 'world-practice',
      banks: banksOf(pool),
      // TOPIK 문항의 단위는 낱말이 많다 — 이유 줄이 「「은행」 처음 만나요」처럼 낱말 이름을 말하려면 낱말 표(words.json)도 받는다.
      words: true,
      host: { guest: true, health },
      lang: lang(),
      label,
    });
    try {
      await made.ready;
    } catch (error) {
      health?.note('load', { ok: false, code: error?.reason ? `LOAD_${error.reason}` : (error?.code ?? 'LOAD_FAILED') });
      made.dispose();
      return null;
    }
    health?.note('load', { ok: true });
    return made;
  }
  return {
    createPracticeNextSession,
    // 짧은 연습의 코치 — 손님만(4-1). 한 번 연 코치는 다시 쓴다.
    async practiceCoach(pool) {
      if (owner !== 'guest') return null;
      if (practice) return practice;
      opening ??= open(pool).catch(() => null);
      practice = await opening;
      opening = null;
      return practice;
    },
    dispose() {
      practice?.dispose();
      practice = null;
    },
  };
}
