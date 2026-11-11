// 사건 → 접기 사건(단계 3 계획 §3). 2판과 옛 꼴 사건을 단계 2 src/fold의 입력 꼴(fold/events.mjs)로 바꾼다.
// 제시 하나를 묶음으로 보고, 그 묶음의 사건 전부에서 접기 사건을 통째로 다시 만든다(설계 §5-3 「줄은 고치지 않고 다시 짓는다」).
// 묶음 = 제시 + 그 제시의 전달 · 도움 · 답 + 그 가운데 어느 것을(옛 꼴은 그 제시의 결정도) 겨눈 제외. 본인 말 · 옮겨 온 장부는 혼자 한 묶음이다.
//
// 기록 하나(entry) = { event, key, atMs }
//   key   같은 시각의 차례 열쇠(글자). 2판 = 사건 id(a.<만든 시각>.…), 옛 꼴 = a.<적힌 시각>.s<서버 차례 15자리> · a.<적힌 시각>.l<기기 로그 순서 9자리>
//   atMs  접는 시각. 서버는 min(사건 at, 받은 시각), 기기는 사건 at
// index.lookup(itemKey) → { familyKey, skillId, difficulty, responseFormat, units, unknownOption? } | null  (단계 1의 문항 색인)
import { BITS, EVENT_FORM, EVENT_TYPES } from './events.mjs';
import { assessable } from './judge.mjs';

const SHOWN = new Set(['explanation', 'answer']);
export const EMPTY_INDEX = Object.freeze({ edition: 'index-0', lookup: () => null });

// 옛 꼴의 차례 열쇠 — 2판 번호(a.<만든 시각 13>.<순번 4>.<꼬리 8>)와 같은 머리 a.<적힌 시각 13>.를 쓴다(설계 §5-3 「차례는
// (접는 시각, 사건에 적힌 시각, 셋째 열쇠)」): 서버가 옛 꼴과 2판을 같은 시각으로 눌러도 적힌 시각이 꼴 글자보다 먼저 비교된다
// (머리가 s. · l.이던 판은 같은 시각에서 2판이 늘 앞서, 먼저 적힌 옛 답이 첫 만남 자격을 잃었다 — GPT 끝 판 GA1).
// 적힌 시각도 같으면 2판(순번 숫자) → 기기 로그(l) → 서버 차례(s), 그 안에서는 받은 차례 · 로그 순서.
const written = event => {
  const parsed = Date.parse(event.at);
  return String(Number.isFinite(parsed) ? Math.max(0, parsed) : 0).padStart(13, '0');
};
export const serverKey = (seq, event) => `a.${written(event)}.s${String(seq).padStart(15, '0')}`;
export const deviceKey = (position, event) =>
  `a.${written(event)}.l${String(position).padStart(9, '0')}`;
export const orderOf = (a, b) => a.atMs - b.atMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

const isCurrent = event => event.schema === EVENT_FORM.current;

// 문항 — 접는 때의 문항 색인이 먼저다(설계 §4). 색인에 없으면 사건에 적힌 값(2판 units · 옛 꼴 measure).
export function itemOf(presented, index = EMPTY_INDEX) {
  const indexed = index.lookup(presented.itemKey);
  const measure = isCurrent(presented) ? presented : presented.measure;
  const base = indexed ?? measure;
  if (!base?.familyKey || !base.skillId) return null;
  // 색인에 문항이 있으면 단위도 색인 것이다 — 색인이 단위를 비웠으면 사건에 적힌 옛 단위로 돌아가지 않는다(아르곤 끝 판 B4).
  const units = indexed ? indexed.units : isCurrent(presented) ? presented.units : undefined;
  return {
    itemKey: presented.itemKey,
    familyKey: base.familyKey,
    skillId: base.skillId,
    difficulty: base.difficulty,
    responseFormat: base.responseFormat || 'unknown',
    ...(units?.length ? { units: [...units] } : {}),
    ...(base.unknownOption === true ? { unknownOption: true } : {}),
  };
}

// judge가 읽는 제시의 꼴.
const judgeView = presented =>
  isCurrent(presented)
    ? {
        firstExposure: presented.firstExposure,
        measure: { confounded: presented.confounded, audioRequired: presented.audioRequired },
      }
    : { firstExposure: presented.firstExposure, measure: presented.measure ?? null };

function answerOf(entry, item, state, presented, view) {
  const attempt = entry.event;
  return {
    kind: 'answer',
    id: entry.key,
    at: entry.atMs,
    item,
    answer: {
      correct:
        attempt.verdict === 'correct' ? true : attempt.verdict === 'incorrect' ? false : null,
      unknown: attempt.verdict === 'unknown',
      assisted: state.helps.length > 0,
      answerShown: state.helps.some(level => SHOWN.has(level)),
      assessable: assessable(attempt, view, state.audio),
      ...(isCurrent(presented) && presented.reason?.target
        ? { target: presented.reason.target }
        : {}),
    },
  };
}

// 묶음 안의 제외 — 제시 · (옛 꼴) 결정을 거두면 답 전부를, 답을 거두면 그 답을 거둔다. 전달을 거두면 그 전달은 증거가 아니다.
function exclusionsOf(presented, exclusions) {
  const targets = new Map();
  for (const entry of [...exclusions].sort(orderOf))
    if (!targets.has(entry.event.targetId)) targets.set(entry.event.targetId, entry);
  const whole = targets.get(presented.id) ?? targets.get(presented.decisionId) ?? null;
  return { targets, whole };
}

const excludeOf = (exclusion, answerKey, at) => ({
  kind: 'exclude',
  id: `${exclusion.key}>${answerKey}`,
  at: exclusion.atMs ?? at,
  ref: answerKey,
});

function stepChild(entry, state, context) {
  const event = entry.event;
  if (event.type === EVENT_TYPES.delivery) {
    state.audio = context.targets.has(event.id) ? 'pending' : event.audio;
    return;
  }
  if (event.type === EVENT_TYPES.helped) {
    if (!state.firstHelp) state.firstHelp = entry;
    state.helps.push(event.level);
    return;
  }
  if (event.type !== EVENT_TYPES.attempted) return;
  if (!state.answered) state.firstAnswer = entry;
  state.answered = true;
  const answer = answerOf(entry, context.item, state, context.presented, context.view);
  state.out.push(answer);
  const exclusion = context.targets.get(event.id) ?? context.whole;
  if (exclusion) state.out.push(excludeOf(exclusion, entry.key, entry.atMs));
}

// 옛 꼴 제시의 firstExposure가 true가 아니면(기기가 앞선 만남을 알았거나 · 이력을 몰랐다) 지금 judge는 그 제시의 답을
// 독립 근거로 세지 않는다(다른 제시의 답에는 그 표시가 닿지 않는다). 같게 하려고, 그 제시의 첫 만남(첫 답 앞의 도움 또는 첫 답)과
// 같은 시각에 장부 만남 하나를 둔다 — 같은 시각에서 그 첫 만남 사건보다 먼저 선다.
// 그 계열의 더 이른 만남은 그대로이고, 장부 만남은 능력 줄 · 칸에 서지 않는다(단계 2 skillRowsOf).
// 차례 열쇠는 그 첫 만남 사건의 열쇠 바로 앞(justBefore)이다 — 제시 열쇠를 쓰면 서버가 눌러 같은 시각이 된 묶음에서 같은 계열의
// 다른 제시에 먼저 낸 답보다 앞에 서서 그 답의 첫 만남 자격을 빼앗는다(아르곤 끝 판 B1). 기기 얹기(단계 2 overlay)는 이번 얹기에서
// 내 사건이 정한 첫 만남 뒤의 내 사건을 기다리지 않는다(view.mine).
// 차례 열쇠는 꼴마다 자리 수가 같아(2판 a.<13>.<4>.<8> · 옛 꼴 a.<13>.s<15> · a.<13>.l<9>) 마지막 글자를 하나 내리고 열쇠에 없는
// 글자 '~'(어떤 열쇠 글자보다 큼)를 붙이면 그 열쇠 바로 앞, 그보다 작은 열쇠들보다는 뒤에 선다.
export const PRIOR_MARK = '~';
const justBefore = key =>
  `${key.slice(0, -1)}${String.fromCharCode(key.charCodeAt(key.length - 1) - 1)}${PRIOR_MARK}`;
export const isPrior = fold => fold.kind === 'carry' && fold.id.endsWith(PRIOR_MARK);

function priorOf(item, state) {
  const { firstHelp, firstAnswer } = state;
  const first = [firstHelp, firstAnswer].filter(Boolean).sort(orderOf)[0];
  if (!first) return null;
  return {
    kind: 'carry',
    id: justBefore(first.key),
    at: first.atMs,
    families: [item.familyKey],
    after: first.atMs,
  };
}

// 2판은 서버가 그 계정 이력을 다 알아 null(모름)은 읽지 않는다. 제품이 서버가 모르는 앞선 노출(같은 지문 세트를 다른 문항으로
// 이미 봄 — WORLD freshBySet)을 false로 적었을 때만 옛 꼴처럼 장부 만남을 세운다(단계 4 요청 11-11, 계획 §14-8 — §11 P2-5를 좁힘).
const priorNeeded = presented =>
  isCurrent(presented) ? presented.firstExposure === false : presented.firstExposure !== true;

function presentedGroup({ source, children = [], exclusions = [] }, index) {
  const presented = source.event;
  const item = itemOf(presented, index);
  if (!item) return [];
  const context = {
    item,
    presented,
    view: judgeView(presented),
    ...exclusionsOf(presented, exclusions),
  };
  const state = {
    presentationKey: source.key,
    audio: 'pending',
    helps: [],
    answered: false,
    firstHelp: null,
    firstAnswer: null,
    out: [],
  };
  for (const entry of [...children].sort(orderOf)) stepChild(entry, state, context);
  const out = [];
  const prior = priorNeeded(presented) ? priorOf(item, state) : null;
  if (prior) out.push(prior);
  if (state.firstHelp)
    out.push({ kind: 'help', id: state.firstHelp.key, at: state.firstHelp.atMs, item });
  return [...out, ...state.out];
}

function statedGroup({ source, exclusions = [] }) {
  const event = source.event;
  const say = { kind: 'say', id: source.key, at: source.atMs, unit: event.unit, say: event.say };
  const exclusion = [...exclusions].sort(orderOf)[0];
  return exclusion ? [say, excludeOf(exclusion, source.key, source.atMs)] : [say];
}

function carriedGroup({ source, exclusions = [] }) {
  if (exclusions.length) return []; // 거둔 장부는 없던 것이다
  const event = source.event;
  const after = event.after == null ? undefined : Date.parse(event.after);
  return [
    {
      kind: 'carry',
      id: source.key,
      at: source.atMs,
      families: Object.keys(event.families).sort(),
      ...(after === undefined ? {} : { after }),
    },
  ];
}

// 묶음 하나 → 접기 사건들(묶음 안 차례). 접기 재료가 아닌 사건(판 단위 결정 · 마침 · 응답, 옛 결정 · 신호 …)은 묶음이 되지 않는다.
export function foldEventsOf(group, index = EMPTY_INDEX) {
  const type = group.source.event.type;
  if (type === EVENT_TYPES.presented) return presentedGroup(group, index);
  if (type === EVENT_TYPES.stated) return statedGroup(group);
  if (type === EVENT_TYPES.carried) return carriedGroup(group);
  return [];
}

// 묶음의 머리가 되는 사건인가.
export const isSource = event =>
  event.type === EVENT_TYPES.presented ||
  (isCurrent(event) && (event.type === EVENT_TYPES.stated || event.type === EVENT_TYPES.carried));

// 사건 하나가 닿는 묶음들(머리 id). byId(id) = 그 id의 사건, presentationsOf(decisionId) = 그 결정의 제시들(옛 꼴).
export function sourcesOf(event, { byId, presentationsOf = () => [] }) {
  if (isSource(event)) return [event.id];
  if (event.presentationId) return [event.presentationId];
  if (event.type !== EVENT_TYPES.excluded) return [];
  const target = byId(event.targetId);
  if (!target) return [];
  if (target.type === EVENT_TYPES.setDecided && !isCurrent(target))
    return presentationsOf(target.id).map(p => p.id);
  if (target.type === EVENT_TYPES.excluded) return [];
  return sourcesOf(target, { byId, presentationsOf });
}

// 기록 열 전체 → 묶음들(손님 기기 · 시험 · 전부 다시 접기). 머리가 없는 자식은 버린다(부모 없는 사건은 근거가 아니다).
export function groupsOf(entries) {
  const byId = new Map(entries.map(entry => [entry.event.id, entry.event]));
  const groups = new Map();
  for (const entry of entries)
    if (isSource(entry.event))
      groups.set(entry.event.id, { source: entry, children: [], exclusions: [] });
  const presentationsOf = decisionId =>
    entries
      .map(entry => entry.event)
      .filter(e => e.type === EVENT_TYPES.presented && e.decisionId === decisionId);
  for (const entry of entries) {
    if (isSource(entry.event)) continue;
    const exclusion = entry.event.type === EVENT_TYPES.excluded;
    for (const id of sourcesOf(entry.event, { byId: id => byId.get(id), presentationsOf })) {
      const group = groups.get(id);
      if (group) group[exclusion ? 'exclusions' : 'children'].push(entry);
    }
  }
  return groups;
}

// 기록 열 전체 → 접기 사건 전부(시각 순은 접기가 다시 세운다).
export function foldEventsOfAll(entries, index = EMPTY_INDEX) {
  const out = [];
  for (const group of groupsOf(entries).values()) out.push(...foldEventsOf(group, index));
  return out;
}

// 만난 표의 세 비트(지금 trail.js BITS 그대로) — 그 제시에서 답했나(1) · 답을 봤나(도움 수준 answer, 2) · 도움을 받았나(cue · explanation, 4).
// 제외는 만났다는 사실을 지우지 않으므로 거둔 답 · 도움도 센다.
export function groupBits({ source, children = [] }) {
  if (source.event.type !== EVENT_TYPES.presented) return 0;
  let bits = 0;
  for (const { event } of children) {
    if (event.type === EVENT_TYPES.attempted) bits |= BITS.attempt;
    if (event.type === EVENT_TYPES.helped)
      bits |= event.level === 'answer' ? BITS.answer : BITS.help;
  }
  return bits;
}
