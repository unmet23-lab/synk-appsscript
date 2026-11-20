// 순간 맞춤의 내용 기억(단계 4 계획 §23-4 (나)) — 저장소(storeName)의 세대마다 이 기기의 localStorage 열쇠 하나.
//   synk.atlas.next.flow.<저장소 이름>[@세대] = { v: 1, gen, seeded, contents: { [내용]: 기억 }, declined: { [내용]: 시각 } } — 세대 0은 「@」 없이
// 내용 기억은 손잡이 자리 · 추정 · 지연뿐이다 — 답 · 글 · 신원은 없다(옛 game-flow.js와 같은 꼴, 기억 값은 Flow의 run.memory()).
// gen: 그 저장소의 비움 세대(기록부 generation). 읽을 때 세대가 다르면 빈 기억이고, 쓸 때 판을 연 때의 세대(since)와 지금 세대가 다르면
//   쓰지 않는다 — 비운 뒤 다른 탭의 열린 판이 end()로 앞 기억을 되살리지 않는다(카본 A8 · GPT GA8). 비운 것을 아직 모르는 탭은 이 탭의
//   세대가 그대로여도 읽지도 쓰지도 않는다 — 기본 열쇠가 든 「마지막으로 비운 세대」가 이 탭의 세대보다 크거나 다음 세대의 열쇠가 섰으면
//   (설계 검토 가 · GPT GA2 · GA3 · 카본 D2). 세대를 모르면(generation()이 던짐) 빈 기억이고 쓰지 않으며 씨앗도 읽지 않는다(Fable 설계 검토 4).
//   앞 꼴(기본 열쇠에 세대를 함께 둔 꼴)로 저장된 같은 세대의 기억은 이어받는다(GPT GA1).
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
  // 앞 꼴(세대 1 이상의 기억도 기본 열쇠에 「gen」과 함께 둔 앞 판)으로 저장된 같은 세대의 기억(GPT GA1) — 또는 그 세대를 비운 표지. 그
  // 세대의 열쇠가 없을 때만 이어받는다 — 다음 쓰기가 그 값 위에 그 세대의 열쇠를 세운다.
  const inherited = now => {
    const old = readRaw(storage, base);
    return old?.gen === now ? old : null;
  };
  // 이 탭이 아직 비운 것을 모른다 — 세대를 모르거나, 다른 탭이 이 세대보다 뒤의 세대로 비웠다(기본 열쇠의 표지 · 다음 세대의 열쇠).
  // 표지는 세대를 몇 번 건너뛰어도 기본 열쇠 하나로 알린다(GPT GA3 — 다음 세대의 열쇠만 보면 세대 0 탭이 세대 3 비우기를 놓쳤다).
  const behind = now => {
    if (!Number.isSafeInteger(now)) return true;
    if (readRaw(storage, keyOf(base, now + 1))) return true;
    const cleared = readRaw(storage, base)?.gen;
    return Number.isSafeInteger(cleared) && cleared > now;
  };
  // 지금 세대의 값. 세대 0에서 처음이면(열쇠가 없거나 씨앗을 아직 안 읽음) 옛 기억에서 씨앗을 한 번 읽어 적는다. 세대가 오른 뒤(비운 뒤)에는
  // 씨앗을 다시 읽지 않는다.
  function current() {
    const now = gen();
    // 비운 것을 아직 모르는 탭은 비우기 전 기억을 읽지 않는다(쓰기는 update가 따로 막는다).
    if (behind(now)) return fresh(now, true);
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
    // 비운 것을 아직 모르는 탭은 쓰지 않는다 — 세대 0 탭의 쓰기는 기본 열쇠라 표지를 지운다(카본 끝 판 D2 · Fable 설계 검토 2).
    if (behind(since)) return false;
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

// 비우기 — 열쇠를 지우지 않고 기본 열쇠에 「비운 세대 · 씨앗 끝」 표지를 남긴다(카본 A8 · 설계 검토 가). 손님 비우기는 저장소 이름이 그대로라
// reset이 record.clear() 바로 뒤, 같은 차례 안에서 이것을 부른다. gen: 비운 뒤의 세대(1 이상 — 모르면 아무것도 쓰지 않는다. record.clear는
// 세대를 돌려주거나 던진다).
// - 그 세대의 열쇠(@gen)에는 쓰지 않는다. 그 열쇠는 비운 것을 알아챈 다른 탭이 새 기억을 쓰는 자리라, 표지가 늦게 쓰이면 그 기억을 지운다
//   (설계 관문 검토 M1 · GPT GA1). 세대 1 이상은 열쇠가 없으면 원래 씨앗 없는 빈 기억이라 표지가 필요 없다.
// - 기본 열쇠의 gen이 이미 그 세대 이상이면 덮지 않는다. 그 값은 비운 뒤에 쓴 것(앞 꼴로 쓰는 옛 판 탭의 같은 세대 기억)뿐이라 남겨도
//   비우기 전 기억이 새지 않는다(Fable 설계 검토 1 · GPT GA2). 읽고 쓰는 사이의 동기 구간은 남는다(계획 §6 알려진 한계).
// - 바로 앞 세대의 열쇠(세대 2 이상)도 표지로 덮는다 — 기본 열쇠의 표지가 뒤처진 탭의 늦은 쓰기로 지워져도 바로 앞 세대 탭이 앞 기억을
//   읽지 않는 둘째 방어선이다(Fable 설계 검토 5). 앞 세대의 기억은 비운 것이라 덮어도 잃는 것이 없다.
export function clearFlowMemory(storage, store, gen = null) {
  if (!Number.isSafeInteger(gen) || gen < 1) return false;
  const base = FLOW_MEMORY_PREFIX + store;
  const marked = readRaw(storage, base)?.gen;
  const mark =
    (Number.isSafeInteger(marked) && marked >= gen) || writeRaw(storage, base, fresh(gen, true));
  if (gen > 1) writeRaw(storage, keyOf(base, gen - 1), fresh(gen, true));
  return mark;
}
