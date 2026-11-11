// 기기 길: 요약 줄에 내 사건을 얹는다(설계 §5-4 「낙관 상태 — 얹거나 기다린다」).
// 기기는 근거 줄을 다 들고 있지 않다. 그래서 얹을 수 있는 것만 얹고, 나머지는 올리기만 한 채 서버가 다시 접은 요약을 기다린다 —
// 서버와 다른 값을 지어내지 않는다.
//   단위 줄: 그 줄의 마지막 사건보다 뒤인 답 · 본인 말만.
//   능력 줄: 그 줄의 마지막 사건보다 뒤이고, 그 답이 그 계열의 첫 만남인지 알 수 있을 때만. 만난 적 없는 계열이면 첫 만남이고,
//            만난 표의 첫 만남 시각이 내 답보다 앞이면 첫 만남이 아니다. 내 답이 그 시각보다 앞이면(다른 기기의 뒤 답이 먼저 접혔다)
//            첫 만남이 내 쪽으로 바뀌므로 그 계열의 문항이 속한 능력은 기다린다. 다만 이번 얹기에서 내 앞 사건이 이미 첫 만남을
//            정한 계열은 같은 시각이어도 기다리지 않는다(같은 (시각, 차례)로 서버도 그 앞 사건을 첫 만남으로 둔다 — 단계 3 장부 만남).
//   기다리기 시작한 줄은 요약 값으로 돌려놓고 요약이 올 때까지 기다린다(앞 사건을 건너뛰고 뒤 사건만 얹지 않는다).
//   아무것도 얹지 못하는 보기(waitAll)에는 뒤에 오는 내 사건(applyOwn)도 얹지 않는다 — 판 안의 고르기가 내 답을 늘 보게 하려는
//   쪽(코치)은 판 연 때의 사본에서 waitAll을 끄고 그 위에 일지를 다시 돌린다.
// 보기(view)는 요약에서 받은 줄(memory · ability · met) 위에 얹은 값과 기다리는 줄뿐이다. 판 상태(shown · log · day · session)는
// src/select/session.mjs의 createLearner가 이 보기를 감싸 더한다.
import { EMPTY_SKILL, stepSkill } from '../ability/index.mjs';
import { PARAMS } from '../params.mjs';
import { gradeOfEvent, markOf, unitRowOf } from './evidence.mjs';
import { byTime } from './order.mjs';
import { creditedOf } from './units.mjs';

export function createView(summary = null) {
  return {
    base: summary,
    memory: new Map(summary?.memory),
    ability: new Map(summary?.ability),
    met: new Map(summary?.met),
    waitUnits: new Set(),
    waitSkills: new Set(),
    waitAll: false,
    // 이번 얹기에서 내 사건이 첫 만남을 정한 계열 — 같은 시각 · 차례가 뒤인 내 사건은 그것을 바꾸지 못한다(장부 만남과 그 답 · 단계 3 priorOf).
    mine: new Set(),
  };
}

const restore = (map, key, base) => {
  if (base?.has(key)) map.set(key, base.get(key));
  else map.delete(key);
};
const waitUnit = (view, unit) => {
  view.waitUnits.add(unit);
  restore(view.memory, unit, view.base?.memory);
};
const waitSkill = (view, id) => {
  view.waitSkills.add(id);
  restore(view.ability, id, view.base?.ability);
};
// 어느 줄에 닿는지 알 수 없는 사건이 밀려 있으면 아무것도 얹지 않는다 — 요약 그대로 두고 서버가 다시 접은 요약을 기다린다.
const waitEverything = view => {
  view.waitAll = true;
  view.memory = new Map(view.base?.memory);
  view.ability = new Map(view.base?.ability);
  view.met = new Map(view.base?.met);
};

// 사건 하나가 적히는 줄(단위 · 능력). 제외를 만들 때 기기가 이것을 대기열의 그 제외 옆에 적어 둔다 —
// 부모 사건이 기기에서 사라진 뒤에도 어느 줄을 기다릴지 알 수 있게.
// 판정 못 한 답은 도움을 받았어도 줄을 내지 않는다 — 거둔 답은 만남으로 남고 도움 표시(unaided)도 그대로라(evidence.mjs addEvent),
// 거두기 전후의 능력 줄 · 첫 만남이 같다(단계 4 아르곤 A3 — 재현 안 됨, 장면 stage2 ㉑).
export function touchedBy(event) {
  if (event.kind === 'say') return { units: [event.unit], skills: [] };
  const grade = event.kind === 'answer' ? gradeOfEvent(event) : null;
  if (grade == null) return { units: [], skills: [] };
  return { units: creditedOf(event.item, event.answer, grade), skills: [event.item.skillId] };
}

// 그 계열을 만났다고 적는다. 돌려주는 값 = 이 만남이 그 계열의 첫 만남인가(기기가 아는 만큼).
function meet(view, family, at, skills) {
  const known = view.met.get(family);
  const lead = known === undefined;
  // 이번 얹기에서 차례가 앞선 내 사건이 같은 시각에 이미 첫 만남을 정했다(장부 만남과 그 답 — 단계 3 priorOf) — 이 사건은 그것을
  // 바꾸지 못하므로 기다리지 않는다. 더 이른 만남(옮겨 온 장부의 after 등)은 아래에서 그대로 기다린다.
  if (!lead && at === known && view.mine.has(family)) return lead;
  if (!lead && at <= known) for (const id of skills) waitSkill(view, id); // 첫 만남이 내 쪽으로 바뀐다
  if (lead || at < known) view.met.set(family, at);
  if (lead || at < known) view.mine.add(family);
  return lead;
}

const blockedUnit = (view, memory, unit, at) =>
  view.waitUnits.has(unit) || !memory.canAppend(view.memory.get(unit), at);

function applySay(view, event, memory) {
  if (blockedUnit(view, memory, event.unit, event.at)) waitUnit(view, event.unit);
  else {
    const row = { id: event.id, at: event.at, say: event.say };
    view.memory.set(event.unit, memory.append(view.memory.get(event.unit), row));
  }
  return {};
}

// 옮겨 온 장부: 그 계열들에 「앞 장부를 뜬 때(처음이면 맨 앞)의 만남」이 생긴다 — 그보다 늦은 답을 첫 만남으로 센 능력은 기다린다.
function applyCarry(view, event, index) {
  for (const key of event.families)
    meet(view, key, event.after ?? Number.NEGATIVE_INFINITY, index?.familySkills?.get(key) || []);
  return {};
}

function applySkill(view, item, mark, lead, params) {
  const skill = view.ability.get(item.skillId) || EMPTY_SKILL;
  if (view.waitSkills.has(item.skillId) || !(mark.at > skill.lastAt)) waitSkill(view, item.skillId);
  else view.ability.set(item.skillId, stepSkill(skill, { ...mark, lead }, params));
}

// 아무것도 얹지 못하는 동안(waitAll)의 사건: 줄(기억 · 능력 · 만남)은 요약 값 그대로 두고, 판 상태가 쓸 판정 · 첫 만남 · 적힐 단위만
// 돌려준다 — 줄마다 기다림과 같은 규칙이다(앞 사건을 건너뛰고 뒤 사건만 얹지 않는다, GPT 끝 판 GA1).
function heldOwn(view, event) {
  if (event.kind !== 'answer' && event.kind !== 'help') return {};
  const grade = gradeOfEvent(event, Boolean(event.gone));
  const lead = !view.met.has(event.item.familyKey);
  if (grade == null) return { grade, lead };
  return { grade, lead, credited: creditedOf(event.item, event.answer, grade) };
}

// 내 사건 하나를 얹는다. index.familySkills = 계열 → 그 계열의 문항이 속한 능력들(문항 색인). 없으면 그 문항의 능력만 안다.
export function applyOwn(view, event, memory, params = PARAMS, index = null) {
  if (view.waitAll) return heldOwn(view, event);
  if (event.kind === 'say') return applySay(view, event, memory);
  if (event.kind === 'carry') return applyCarry(view, event, index);
  const item = event.item;
  const grade = gradeOfEvent(event, Boolean(event.gone));
  const mark = markOf(event, grade);
  const skills = index?.familySkills?.get(item.familyKey) || [item.skillId];
  const lead = meet(view, item.familyKey, event.at, skills);
  if (grade == null && mark.unaided) return { grade, lead }; // 판정 못 한 답 · 거둔 답: 만남만 남는다
  applySkill(view, item, mark, lead, params);
  if (grade == null) return { grade, lead }; // 도움만 본 것 · 도움을 받았지만 판정 못 한 답: 이어서 맞힌 수만 끊긴다
  const credited = creditedOf(item, event.answer, grade);
  for (const unit of credited) {
    if (blockedUnit(view, memory, unit, event.at)) waitUnit(view, unit);
    else view.memory.set(unit, memory.append(view.memory.get(unit), unitRowOf(event, grade)));
  }
  return { grade, lead, credited };
}

// 이미 접힌 사건을 거두는 제외: 그 사건이 적힌 줄은 기다린다. 닿는 줄을 모르면 false(아무것도 얹지 않는다).
function applyExclude(view, event, index) {
  const target = index?.lookup?.(event.ref);
  const touched = target ? touchedBy(target) : event.touches;
  if (!touched) return false;
  for (const unit of touched.units) waitUnit(view, unit);
  for (const id of touched.skills) waitSkill(view, id);
  return true;
}

// 이 사건 때문에 아무것도 얹을 수 없는가. 아직 요약에 들지 않은 내 사건의 제외는 그 사건을 얹지 않으면 되고(overlay가 거른다),
// 이미 접힌 사건의 제외는 닿는 줄을 기다리게 한다 — 닿는 줄을 모르면 아무것도 얹지 않는다. 옮겨 온 장부는 문항이 없어, 그 계열의
// 능력들(index.familySkills — 문항 색인)을 모르면 어느 능력 줄을 기다릴지 몰라 아무것도 얹지 않는다(Fable 끝 판 P3-3).
function stopsAll(view, event, mine, index) {
  if (event.kind === 'carry') return !index?.familySkills;
  if (event.kind !== 'exclude' || mine.has(event.ref)) return false;
  return !applyExclude(view, event, index);
}

// 요약 위에, 아직 요약에 들지 않은 내 사건들을 시각 순으로 얹는다.
// index.lookup(번호) = 이 기기가 든 최근 사건에서 찾는다(이미 접힌 내 사건도 이틀 동안 든다).
// index.familySkills(계열 → 그 계열의 문항이 속한 능력들, 문항 색인)는 꼭 준다 — 없으면 밀린 장부가 있을 때 아무것도 얹지 않는다.
export function overlay(summary, pending, memory, params = PARAMS, index = null) {
  const view = createView(summary);
  const mine = new Set(pending.map(event => event.id));
  const gone = new Set(pending.filter(event => event.kind === 'exclude').map(event => event.ref));
  for (const event of [...pending].sort(byTime)) {
    if (stopsAll(view, event, mine, index)) {
      waitEverything(view);
      break;
    }
    if (event.kind === 'exclude') continue;
    if (!gone.has(event.id)) applyOwn(view, event, memory, params, index);
    else if (event.kind === 'answer')
      applyOwn(view, { ...event, gone: true }, memory, params, index); // 거둔 답은 만남으로만
  }
  return view;
}
