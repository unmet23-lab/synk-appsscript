// 순간 맞춤의 내용 기억(단계 4 계획 §23-4 (나)) — 저장소(storeName)의 세대마다 이 기기의 localStorage 열쇠 하나.
//   synk.atlas.next.flow.<저장소 이름>[@세대] = { v: 1, gen, seeded, contents: { [내용]: 기억 }, declined: { [내용]: 시각 } } — 세대 0은 「@」 없이
// 내용 기억은 손잡이 자리 · 추정 · 지연뿐이다 — 답 · 글 · 신원은 없다(옛 game-flow.js와 같은 꼴, 기억 값은 Flow의 run.memory()).
// gen: 그 저장소의 비움 세대(기록부 generation). 읽을 때 세대가 다르면 빈 기억이고, 쓸 때 판을 연 때의 세대(since)와 지금 세대가 다르면
//   쓰지 않는다 — 비운 뒤 다른 탭의 열린 판이 end()로 앞 기억을 되살리지 않는다(카본 A8 · GPT GA8). 다음 세대의 열쇠가 섰으면 이 탭의 세대가
//   아직 그대로여도 읽지도 쓰지도 않는다(GPT GA2 · D2). 앞 꼴(기본 열쇠에 세대를 함께 둔 꼴)로 저장된 같은 세대의 기억은 이어받는다(GPT GA1).
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

// 세대마다 열쇠 하나(다시 보기 GC1 · 둘째 다시 보기 A2). 세대 0은 앞마디 + 저장소 이름 그대로다 — 계정 저장소는 비우면 판이 올라 이름이
// 바뀌므로 세대가 늘 0이고, 입구의 앞 판 쓸기가 읽는 열쇠 꼴도 그대로다. 손님 저장소는 비우면 세대가 올라(기록부 clear · dropMoved) 열쇠에
// 「@세대」를 붙인다. 앞 세대의 탭이 늦게 써도 다른 열쇠라 비운 뒤의 기억을 덮지 못한다 — 한 열쇠를 함께 쓰면 탭 사이 잠금이 없는 Web
// Storage에서 늦은 쓰기가 앞선 세대의 기억을 지웠다.
const keyOf = (base, gen) => (gen ? `${base}@${gen}` : base);

// storage: localStorage 꼴(getItem · setItem). store: 저장소 이름. generation(): 지금 비움 세대. seed(): 옛 내용 기억 읽개(없으면 씨앗 없이).
export function createFlowMemory({ storage, store, generation, seed = null }) {
  const base = FLOW_MEMORY_PREFIX + store;
  const gen = () => {
    try {
      return generation() ?? 0;
    } catch {
      return null;
    }
  };
  // 앞 꼴(세대 1 이상의 기억도 기본 열쇠에 「gen」과 함께 둔 앞 판)으로 저장된 같은 세대의 기억(GPT GA1). 그 세대의 열쇠가 없을 때만
  // 이어받는다 — 다음 쓰기가 그 값 위에 그 세대의 열쇠를 세운다.
  const inherited = now => {
    const old = readRaw(storage, base);
    return old?.gen === now ? old : null;
  };
  // 지금 세대의 값. 세대 0에서 처음이면(열쇠가 없거나 씨앗을 아직 안 읽음) 옛 기억에서 씨앗을 한 번 읽어 적는다. 세대가 오른 뒤(비운 뒤)에는
  // 씨앗을 다시 읽지 않는다.
  function current() {
    const now = gen();
    // 다른 탭이 이미 비워 다음 세대의 열쇠가 섰다 — 이 탭의 세대가 아직 그대로여도 비우기 전 기억을 읽지 않는다(GPT GA2 — 쓰기는 update가
    // 이미 막는다).
    if (Number.isSafeInteger(now) && readRaw(storage, keyOf(base, now + 1)))
      return fresh(now, true);
    const stored = readRaw(storage, keyOf(base, now)) ?? (now ? inherited(now) : null);
    if (stored?.seeded) return stored.gen === now ? stored : fresh(now, true);
    const value = fresh(now, true);
    if (now) return value;
    const old = seedOf(seed);
    if (old) {
      value.contents = JSON.parse(JSON.stringify(old.contents));
      value.declined = { ...old.declined };
    }
    writeRaw(storage, keyOf(base, now), value);
    return value;
  }
  // 판을 연 때의 세대(since)에서만, 그 세대의 열쇠에 쓴다.
  function update(since, change) {
    if (since !== gen()) return false;
    // 다른 탭이 이미 비워 다음 세대의 열쇠가 섰다 — 이 탭의 세대가 아직 그대로여도 쓰지 않는다(카본 끝 판 D2).
    if (Number.isSafeInteger(since) && readRaw(storage, keyOf(base, since + 1))) return false;
    const value = current();
    change(value);
    return writeRaw(storage, keyOf(base, since), value);
  }
  return Object.freeze({
    key: base,
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
    // 손님 비우기가 부른다(reset.mjs resetGuest — record.clear() 바로 뒤). gen: 비운 뒤의 세대.
    clear: gen => clearFlowMemory(storage, store, gen),
  });
}

// 비우기 — 열쇠를 지우지 않고 「비움 · 씨앗 끝」 표지를 남긴다(카본 A8). 손님 비우기는 저장소 이름이 그대로라 reset이 이것을 직접 부른다
// (설계 주인 11-19 조건 — 부르는 줄은 4-5를 닫은 뒤). gen: 비운 뒤의 세대(모르면 null — 다음 읽기에서 세대가 맞지 않아 빈 기억이다).
// 그 세대의 열쇠에 표지를 쓰고, 바로 앞 세대의 열쇠도 표지로 덮는다 — 아직 비운 것을 모르는 탭이 앞 세대의 기억을 읽지 않게. 앞 세대의
// 기억은 비운 것이라 덮어도 잃는 것이 없다. 그 세대(1 이상)의 열쇠는 비어 있을 때만 표지를 쓴다 — 그 열쇠에 든 기억은 비운 것을 알아챈
// 다른 탭이 비운 뒤에 쓴 것이라, 표지가 늦게 쓰이면 그 기억을 지운다(설계 관문 검토 M1). 세대가 0이거나 모르면(null) 그 열쇠는 기본
// 열쇠(비우기 전 세대의 것)라 늘 덮는다.
export function clearFlowMemory(storage, store, gen = null) {
  const base = FLOW_MEMORY_PREFIX + store;
  const kept = Number.isSafeInteger(gen) && gen > 0 && readRaw(storage, keyOf(base, gen)) !== null;
  const mark = kept || writeRaw(storage, keyOf(base, gen), fresh(gen, true));
  if (Number.isSafeInteger(gen) && gen > 0)
    writeRaw(storage, keyOf(base, gen - 1), fresh(gen, true));
  return mark;
}
