// 기기가 얹을 내 사건(설계 §5-4 「낙관 상태 — 얹거나 기다린다」) — 기록부(log.mjs)가 든 사건에서, 아직 요약에 안 든 것을
// 단계 2 overlay의 입력(접기 사건)으로 바꾼다. 묶음의 다른 사건은 맥락으로만 쓴다(이미 접힌 것을 두 번 얹지 않는다).
// 얹을 수 없으면 기다리는 꼴(닿는 줄을 실은 제외 · 줄을 모르면 WAIT)을 낸다 — 기기는 서버와 다른 값을 지어내지 않는다.
//   pending = 아직 안 접힌 사건의 차례 열쇠(2판 = 사건 id, 옛 꼴 = l.<적힌 시각>.<순번>)
import { touchedBy } from '../fold/device.mjs';
import { foldEventsOf, groupsOf, isSource } from './adapt.mjs';
import { EVENT_FORM, EVENT_TYPES } from './events.mjs';

// 닿는 줄을 모르는 제외 꼴 — overlay가 이것을 만나면 요약 그대로 둔다(번호는 어떤 사건과도 겹치지 않는다).
export const WAIT = Object.freeze({
  kind: 'exclude',
  id: '#wait',
  at: Number.NEGATIVE_INFINITY,
  ref: '#unknown',
});

const union = (a, b) => [...new Set([...a, ...b])];

function mergeTouch(before, fold) {
  const touched = touchedBy(fold);
  if (!before) return touched;
  return {
    units: union(before.units, touched.units),
    skills: union(before.skills, touched.skills),
  };
}

// 이미 접힌 답을 건드리는 제외 — 그 답이 적힌 줄을 기다린다(줄을 모르면 아무것도 얹지 않는다).
const waitFor = (fold, touches) => ({
  ...fold,
  ref: `${fold.ref}#folded`,
  ...(touches ? { touches } : {}),
});

// 기다릴 줄은 요약에 든 꼴(아직 안 접힌 제외를 빼고 지은 묶음)과 거둔 뒤의 꼴 둘 다에서 센다 —
// 전달을 거두면 접힌 답의 판정이 바뀌어 거둔 뒤의 꼴만으로는 그 답이 적혀 있던 줄을 모른다.
function touchesByAnswer(group, folds, pending, index) {
  const settled = {
    ...group,
    exclusions: group.exclusions.filter(entry => !pending.has(entry.key)),
  };
  const answers = new Map();
  for (const fold of [...foldEventsOf(settled, index), ...folds])
    if (fold.kind === 'answer' || fold.kind === 'say')
      answers.set(fold.id, mergeTouch(answers.get(fold.id), fold));
  return answers;
}

// 거둔 답: 아직 요약에 안 든 내 답이면(제외가 이미 접힌 것이어도) 그 답을 만남으로만 얹고,
// 이미 접힌 답을 아직 안 접힌 제외가 거두면 그 답이 적힌 줄을 기다린다. 둘 다 접혔으면 요약에 들어 있다.
function exclusionsOf(folds, pending, touches) {
  const out = [];
  for (const fold of folds) {
    if (fold.kind !== 'exclude') continue;
    if (pending.has(fold.ref)) out.push(fold);
    else if (pending.has(fold.id.split('>')[0])) out.push(waitFor(fold, touches.get(fold.ref)));
  }
  return out;
}

// 전달을 거두면 그 뒤 답의 판정이 바뀐다 — 이미 접힌 그 묶음의 답이 적힌 줄을 기다린다.
function deliveryWaits(group, pending, touches) {
  const out = [];
  for (const entry of group.exclusions) {
    if (!pending.has(entry.key)) continue;
    const target = group.children.find(child => child.event.id === entry.event.targetId);
    if (target?.event.type !== EVENT_TYPES.delivery) continue;
    for (const [id, touched] of touches)
      if (!pending.has(id))
        out.push(
          waitFor({ kind: 'exclude', id: `${entry.key}~${id}`, at: entry.atMs, ref: id }, touched),
        );
  }
  return out;
}

// 이미 접힌 옮겨 온 장부를 거두면 그 계열들의 첫 만남이 바뀐다 — 어느 능력에 닿는지 기기가 다 모르므로 요약 그대로 둔다.
const carryPulled = (group, pending) =>
  group.source.event.type === EVENT_TYPES.carried &&
  !pending.has(group.source.key) &&
  group.exclusions.some(entry => pending.has(entry.key));

function ownOfGroup(group, pending, index) {
  if (carryPulled(group, pending)) return [WAIT];
  const folds = foldEventsOf(group, index);
  const touches = touchesByAnswer(group, folds, pending, index);
  return [
    ...folds.filter(fold => fold.kind !== 'exclude' && pending.has(fold.id)),
    ...exclusionsOf(folds, pending, touches),
    ...deliveryWaits(group, pending, touches),
  ];
}

const standalone = event =>
  isSource(event) ||
  event.type === EVENT_TYPES.setDecided ||
  event.type === EVENT_TYPES.setCompleted ||
  event.type === EVENT_TYPES.feedback;

// 머리가 없는 묶음의 사건(부모가 기기에 없다) — 제외를 만들 때 적어 둔 줄이 있으면 그 줄을, 없으면 아무것도 얹지 않는다.
function unknownOf(entry, touches) {
  if (!touches) return WAIT;
  return {
    kind: 'exclude',
    id: entry.key,
    at: entry.atMs,
    ref: `${entry.event.targetId}#folded`,
    touches,
  };
}

// 든 사건(entries)과 아직 안 접힌 것(pending — 차례 열쇠) → overlay의 입력. memo(id) = 제외를 만들 때 적어 둔 줄.
export function ownFoldEvents(entries, pending, { index, memo = () => null }) {
  const out = [];
  const covered = new Set();
  for (const group of groupsOf(entries).values()) {
    const members = [group.source, ...group.children, ...group.exclusions];
    if (!members.some(entry => pending.has(entry.key))) continue;
    for (const entry of members) covered.add(entry.key);
    out.push(...ownOfGroup(group, pending, index));
  }
  for (const entry of entries)
    if (pending.has(entry.key) && !covered.has(entry.key) && !standalone(entry.event))
      out.push(unknownOf(entry, memo(entry.event.id)));
  return out;
}

// 제외를 만들 때 그 답이 적힌 줄을 함께 적어 둔다(부모 사건이 기기에서 사라진 뒤에도 기다릴 줄을 안다 — 설계 §5-1).
export function touchesOf(entries, targetId, index) {
  let touched = { units: [], skills: [] };
  for (const group of groupsOf(entries).values()) {
    const members = [group.source, ...group.children].map(entry => entry.event.id);
    if (!members.includes(targetId) && group.source.event.decisionId !== targetId) continue;
    for (const fold of foldEventsOf(group, index))
      if (fold.kind === 'answer' || fold.kind === 'say') touched = mergeTouch(touched, fold);
  }
  if (!touched.units.length && !touched.skills.length) return null;
  return { units: touched.units.sort(), skills: touched.skills.sort() };
}

// 계열 → 그 계열의 문항이 속한 능력들 = 요약의 계열 줄(만남이 있는 능력) ∪ 문항 색인 ∪ 기기가 든 2판 제시.
// 내 이른 답이 그 계열의 첫 만남을 가져가면 이 능력들의 줄을 기다린다(단계 2 overlay의 index.familySkills).
export function familySkillsOf(summary, index, events) {
  const out = new Map();
  const add = (family, skills) => out.set(family, union(out.get(family) ?? [], skills));
  for (const [family, line] of summary?.lines.family ?? []) add(family, line.skills ?? []);
  for (const [family, skills] of index.familySkills ?? []) add(family, skills);
  for (const event of events)
    if (event.type === EVENT_TYPES.presented && event.schema === EVENT_FORM.current)
      add(event.familyKey, [event.skillId]);
  for (const [family, skills] of out) out.set(family, skills.sort());
  return out;
}
