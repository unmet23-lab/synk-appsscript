// 순간 맞춤의 내용 기억(단계 4 계획 §23-4 (나)) — 저장소(storeName)마다 이 기기의 localStorage 열쇠 하나.
//   synk.atlas.next.flow.<저장소 이름> = { v: 1, gen, seeded, contents: { [내용]: 기억 }, declined: { [내용]: 시각 } }
// 내용 기억은 손잡이 자리 · 추정 · 지연뿐이다 — 답 · 글 · 신원은 없다(옛 game-flow.js와 같은 꼴, 기억 값은 Flow의 run.memory()).
// gen: 그 저장소의 비움 세대(기록부 generation). 읽을 때 세대가 다르면 빈 기억이고, 쓸 때 판을 연 때의 세대(since)와 지금 세대가 다르면
//   쓰지 않는다 — 비운 뒤 다른 탭의 열린 판이 end()로 앞 기억을 되살리지 않는다(카본 A8 · GPT GA8).
// seeded: 옛 엔진의 내용 기억에서 씨앗을 한 번 읽었다. 비워도 남는다 — 비운 뒤 옛 기억에서 다시 씨앗을 읽지 않는다.
// 판이 오르면 저장소 이름이 바뀌어 내용 기억도 새로 선다. 앞 판의 열쇠는 입구의 앞 판 쓸기가 지운다(GPT GA9 — FLOW_MEMORY_PREFIX).
// 다른 기기와 맞추지 않는다(§6 알려진 한계 — talk 묶음 뒤).
export const FLOW_MEMORY_PREFIX = 'synk.atlas.next.flow.';

const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const fresh = (gen, seeded) => ({ v: 1, gen, seeded, contents: {}, declined: {} });

function readRaw(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (raw == null || raw === '') return null;
    const value = JSON.parse(raw);
    return object(value) && value.v === 1 && object(value.contents) && object(value.declined)
      ? value
      : null;
  } catch {
    return null;
  }
}

function writeRaw(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// 옛 엔진의 내용 기억(씨앗) — { contents, declined } 꼴만 받는다. 읽개가 없거나 던지면 씨앗 없음.
function seedOf(read) {
  try {
    const value = typeof read === 'function' ? read() : null;
    if (!object(value)) return null;
    return {
      contents: object(value.contents) ? value.contents : {},
      declined: object(value.declined) ? value.declined : {},
    };
  } catch {
    return null;
  }
}

// storage: localStorage 꼴(getItem · setItem). store: 저장소 이름. generation(): 지금 비움 세대. seed(): 옛 내용 기억 읽개(없으면 씨앗 없이).
export function createFlowMemory({ storage, store, generation, seed = null }) {
  const key = FLOW_MEMORY_PREFIX + store;
  const gen = () => {
    try {
      return generation() ?? 0;
    } catch {
      return null;
    }
  };
  // 지금 세대의 값. 처음이면(열쇠가 없거나 씨앗을 아직 안 읽음) 옛 기억에서 씨앗을 한 번 읽어 적는다.
  function current() {
    const now = gen();
    const stored = readRaw(storage, key);
    if (stored?.seeded) return stored.gen === now ? stored : fresh(now, true);
    const value = fresh(now, true);
    const old = seedOf(seed);
    if (old) {
      value.contents = JSON.parse(JSON.stringify(old.contents));
      value.declined = { ...old.declined };
    }
    writeRaw(storage, key, value);
    return value;
  }
  // 판을 연 때의 세대(since)에서만 쓴다.
  function update(since, change) {
    if (since !== gen()) return false;
    const value = current();
    change(value);
    return writeRaw(storage, key, value);
  }
  return Object.freeze({
    key,
    since: gen,
    memory: contentId => {
      const value = current().contents[contentId];
      return object(value) ? value : null;
    },
    declined: contentId => current().declined[contentId] ?? null,
    save: (contentId, memory, since) =>
      update(since, value => {
        value.contents[contentId] = memory;
      }),
    decline: (contentId, at, since) =>
      update(since, value => {
        value.declined[contentId] = at;
      }),
  });
}

// 비우기 — 열쇠를 지우지 않고 「비움 · 씨앗 끝」 표지를 남긴다(카본 A8). 손님 비우기는 저장소 이름이 그대로라 reset이 이것을 직접 부른다
// (설계 주인 11-19 조건 — 부르는 줄은 4-5를 닫은 뒤). gen: 비운 뒤의 세대(모르면 null — 다음 읽기에서 세대가 맞지 않아 빈 기억이다).
export function clearFlowMemory(storage, store, gen = null) {
  return writeRaw(storage, FLOW_MEMORY_PREFIX + store, fresh(gen, true));
}
