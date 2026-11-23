// 묶음 색인(기기 답 저장 빠르게 하기 설계 ① — 11-23). 기록부가 사건을 들 때마다(takeEvent) 그 사건 하나를 넣어, 든 사건 전부로 지은
// groupsOf(adapt.mjs)와 같은 묶음을 늘 든다. 묶음마다 근거 줄(rowsOfGroup)은 처음 물을 때 지어 두고, 묶음에 사건이 붙으면 버린다.
// 넣는 규칙은 groupsOf · sourcesOf와 같은 뜻을 사건 하나씩 따른다.
//   머리(isSource)는 새 묶음을 세우고 그 묶음을 기다리던 사건을 붙인다.
//   제시의 자식(presentationId)은 묶음이 있으면 붙고, 없으면 그 머리를 기다린다.
//   제외는 겨눈 사건이 없으면 그 사건을 기다린다. 겨눈 사건이 들면 그 사건의 머리(머리 자신 · 자식이면 그 제시)를 찾고, 머리가 아직 없으면
//   머리를 기다린다(제외 → 답 → 제시 차례로 들 때). 옛 꼴 판 결정을 겨누면 그 결정의 제시 모두(뒤에 드는 제시 포함)에 붙는다. 제외를 겨눈
//   제외는 어디에도 들지 않는다. 머리가 끝내 없는 사건은 기다림에만 남는다(groupsOf가 부모 없는 사건을 버리는 것과 같다).
// 묶음 안의 자식 · 제외는 든 차례로 둔다(groupsOf가 든 사건을 든 차례로 훑는 것과 같다). 코치에 내주는 묶음은 포트 열쇠 차례로 다시 둔다
// (코치는 heldEvents()의 열쇠 차례로 묶음을 지어 왔다 — 놓침 기록의 첫 판정 답이 그 차례로 고른다).
// hot = 그 묶음 사건과 제외를 놓는 데 쓴 사건(겨눈 사건 · 옛 꼴 판 결정)의 포트 열쇠 가운데 가장 큰 값이다. 줄이지 않는다(같은 번호가 더
// 작은 열쇠로 다시 서도 — R10). 손님 접기가 until까지만 접을 때 hot ≤ until인 묶음은 지어 둔 근거 줄을 쓰고, 그 밖의 묶음은 열쇠 ≤ until인
// 사건만으로 그 자리에서 다시 짓는다(cut — 캐시하지 않는다).
// 지도가 더해지거나(index.revision) 판 묶음이 바뀌면 근거 줄 · 계열 모음 · 계열 → 능력 표를 모두 버린다. 다시 읽기(reset) · 치우기(rebuild)는
// 통째로 다시 짓는다.
import { groupsOf, isSource, itemOf } from './adapt.mjs';
import { EVENT_FORM, EVENT_TYPES } from './events.mjs';
import { addHeldSkills, familySkillsOf } from './own.mjs';
import { rowsOfGroup } from './rows.mjs';

const legacyDecision = event =>
  event.type === EVENT_TYPES.setDecided && event.schema !== EVENT_FORM.current;
const listOf = (map, key) => {
  if (!map.has(key)) map.set(key, []);
  return map.get(key);
};
const takeList = (map, key) => {
  const list = map.get(key) ?? [];
  map.delete(key);
  return list;
};

const blank = epoch => ({
  epoch,
  nodes: new Map(), // 사건 번호 → { entry(기록 꼴), key(포트 열쇠), rank(든 차례) }
  groups: new Map(), // 머리 번호 → { source, children, exclusions } (든 차례)
  meta: new Map(), // 머리 번호 → { seq, hot, rows }
  of: new Map(), // 사건 번호 → 그 사건이 든 묶음들(머리 · 자식 · 제외)
  waitGroup: new Map(), // 아직 없는 머리 → [사건 번호, 놓는 데 쓴 열쇠]
  waitTarget: new Map(), // 아직 없는 겨눈 사건 → 제외 번호들
  decisions: new Map(), // 결정 번호 → { shown: 그 결정의 제시들, aims: 그 결정(옛 꼴)을 겨눈 제외들 }
  skills: new Map(), // 계열 → 든 제시의 능력들(familySkillsOf의 「든 사건」 몫)
  rank: 0,
  touched: new Set(), // 지난 drainTouched 뒤에 근거 줄을 버린 묶음(손님 접기 ③)
  stamp: null,
  families: null, // { by: 계열 → 제시 묶음들, carried: 장부 묶음들 }
  familySkills: null, // { summary, value }
});

export function createGroupIndex(index, edition) {
  let s = blank(0);
  const stampNow = () => `${edition()}#${index.revision ?? 0}#${s.epoch}`;
  // 지도 · 판 묶음이 바뀌었으면 문항 찾기(itemOf)에 기댄 캐시를 버린다.
  function current() {
    const stamp = stampNow();
    if (s.stamp === stamp) return;
    s.stamp = stamp;
    for (const meta of s.meta.values()) meta.rows = null;
    s.families = null;
    s.familySkills = null;
  }
  const decisionOf = id => {
    if (!s.decisions.has(id)) s.decisions.set(id, { shown: [], aims: [] });
    return s.decisions.get(id);
  };
  const join = (id, source) => {
    if (!s.of.has(id)) s.of.set(id, new Set());
    s.of.get(id).add(source);
  };
  const rankOf = entry => s.nodes.get(entry.event.id).rank;
  function insert(list, node) {
    let i = list.length;
    while (i > 0 && rankOf(list[i - 1]) > node.rank) i -= 1;
    list.splice(i, 0, node.entry);
  }
  function attach(id, source, dep) {
    const node = s.nodes.get(id);
    const group = s.groups.get(source);
    insert(
      node.entry.event.type === EVENT_TYPES.excluded ? group.exclusions : group.children,
      node,
    );
    join(id, source);
    const meta = s.meta.get(source);
    meta.hot = Math.max(meta.hot, node.key, dep);
    meta.rows = null;
    s.touched.add(source);
  }
  function toGroup(id, source, dep) {
    if (s.groups.has(source)) attach(id, source, dep);
    else listOf(s.waitGroup, source).push([id, dep]);
  }
  // 제외 하나를 놓는다(sourcesOf의 제외 갈래).
  function aim(id) {
    const targetId = s.nodes.get(id).entry.event.targetId;
    const target = s.nodes.get(targetId);
    if (!target) {
      listOf(s.waitTarget, targetId).push(id);
      return;
    }
    const event = target.entry.event;
    if (legacyDecision(event)) {
      const decision = decisionOf(event.id);
      decision.aims.push([id, target.key]);
      for (const source of decision.shown) attach(id, source, target.key);
      return;
    }
    if (event.type === EVENT_TYPES.excluded) return;
    const source = isSource(event) ? event.id : event.presentationId;
    if (source) toGroup(id, source, target.key);
  }
  function fileFamily(id) {
    const event = s.groups.get(id).source.event;
    if (event.type === EVENT_TYPES.carried) s.families.carried.push(id);
    else if (event.type === EVENT_TYPES.presented) {
      const family = itemOf(event, index)?.familyKey;
      if (family != null) listOf(s.families.by, family).push(id);
    }
  }
  function open(id, node) {
    const event = node.entry.event;
    s.groups.set(id, { source: node.entry, children: [], exclusions: [] });
    s.meta.set(id, { seq: node.rank, hot: node.key, rows: null });
    join(id, id);
    s.touched.add(id);
    if (s.families) fileFamily(id);
    for (const [waiting, dep] of takeList(s.waitGroup, id)) attach(waiting, id, dep);
    if (event.type !== EVENT_TYPES.presented || event.decisionId == null) return;
    const decision = decisionOf(event.decisionId);
    decision.shown.push(id);
    for (const [exclusion, dep] of decision.aims) attach(exclusion, id, dep);
  }
  const noteSkills = (family, skills) => {
    if (!s.skills.has(family)) s.skills.set(family, new Set());
    const held = s.skills.get(family);
    for (const skill of skills)
      if (!held.has(skill)) {
        held.add(skill);
        s.familySkills = null;
      }
  };
  function add(entry, key) {
    const id = entry.event.id;
    const node = { entry, key, rank: s.rank++ };
    s.nodes.set(id, node);
    addHeldSkills([entry.event], noteSkills);
    if (isSource(entry.event)) open(id, node);
    else if (entry.event.presentationId) toGroup(id, entry.event.presentationId, 0);
    else if (entry.event.type === EVENT_TYPES.excluded) aim(id);
    for (const waiting of takeList(s.waitTarget, id)) aim(waiting);
  }

  function rows(id) {
    current();
    const meta = s.meta.get(id);
    meta.rows ??= rowsOfGroup(s.groups.get(id), index);
    return meta.rows;
  }
  // 열쇠 ≤ until인 사건만으로 지은 그 묶음의 근거 줄 — 묶음 사건과 제외가 겨눈 사건을 든 차례로 groupsOf에 넣는다.
  function cut(id, until) {
    const group = s.groups.get(id);
    const picked = new Map();
    const pick = node => {
      if (node && node.key <= until) picked.set(node.entry.event.id, node);
    };
    for (const entry of [group.source, ...group.children, ...group.exclusions])
      pick(s.nodes.get(entry.event.id));
    for (const entry of group.exclusions) pick(s.nodes.get(entry.event.targetId));
    const entries = [...picked.values()].sort((a, b) => a.rank - b.rank).map(node => node.entry);
    const part = groupsOf(entries).get(id);
    return part ? rowsOfGroup(part, index) : [];
  }
  function rowsAt(id, until) {
    const meta = s.meta.get(id);
    return meta.hot <= until ? { rows: rows(id), cut: false } : { rows: cut(id, until), cut: true };
  }

  const portKey = entry => s.nodes.get(entry.event.id).key;
  const byKey = list =>
    list.every((entry, i) => i === 0 || portKey(list[i - 1]) < portKey(entry))
      ? list
      : [...list].sort((a, b) => portKey(a) - portKey(b));
  // 코치에 내주는 묶음 — 자식 · 제외를 포트 열쇠 차례로.
  const keyed = group =>
    group && {
      source: group.source,
      children: byKey(group.children),
      exclusions: byKey(group.exclusions),
    };
  function familyGroups(family) {
    current();
    if (!s.families) {
      s.families = { by: new Map(), carried: [] };
      for (const id of s.groups.keys()) fileFamily(id);
    }
    return [...(s.families.by.get(family) ?? []), ...s.families.carried]
      .sort((a, b) => s.meta.get(a).seq - s.meta.get(b).seq)
      .map(id => [id, keyed(s.groups.get(id))]);
  }
  function familySkills(summary) {
    current();
    if (s.familySkills?.summary !== summary)
      s.familySkills = { summary, value: familySkillsOf(summary, index, s.skills) };
    return s.familySkills.value;
  }
  function drainTouched() {
    const touched = s.touched;
    s.touched = new Set();
    return touched;
  }

  return {
    add,
    // 같은 번호가 더 작은 열쇠로 다시 섰다(R10) — hot은 줄이지 않는다.
    lowerKey(id, key) {
      const node = s.nodes.get(id);
      if (node) node.key = key;
    },
    reset() {
      s = blank(s.epoch + 1);
    },
    rebuild(items, entryOf) {
      s = blank(s.epoch + 1);
      for (const item of items) add(entryOf(item), item.key);
    },
    entry: id => s.nodes.get(id)?.entry,
    sourcesOf: id => s.of.get(id),
    // 기록부 안에서 쓰는 묶음(든 차례 — 머리가 든 차례로 늘어선 Map)과 묶음 하나의 근거 줄.
    all: () => s.groups,
    get: id => s.groups.get(id),
    seq: id => s.meta.get(id).seq,
    rows,
    rowsAt,
    rowsUntil(until) {
      const out = [];
      for (const id of s.meta.keys()) out.push(...rowsAt(id, until).rows);
      return out;
    },
    // 제외가 겨눈 사건이 머리 · 자식으로 든 묶음과, 그 번호를 결정으로 든 제시 묶음(touchesOf가 다시 거른다).
    touching: id =>
      [...(s.of.get(id) ?? []), ...(s.decisions.get(id)?.shown ?? [])].map(source =>
        s.groups.get(source),
      ),
    familyGroups,
    familySkills,
    // 코치에 내주는 묶음 — 자식 · 제외는 포트 열쇠 차례, 모음은 머리의 포트 열쇠 차례.
    keyedGroups: () =>
      new Map(
        [...s.groups]
          .sort(([a], [b]) => s.nodes.get(a).key - s.nodes.get(b).key)
          .map(([id, group]) => [id, keyed(group)]),
      ),
    keyedGroup: id => keyed(s.groups.get(id)),
    stamp() {
      current();
      return s.stamp;
    },
    drainTouched,
  };
}
