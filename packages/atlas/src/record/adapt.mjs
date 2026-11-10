// 사건 → 접기 사건(단계 3 계획 §3). 2판과 옛 꼴 사건을 단계 2 src/fold의 입력 꼴(fold/events.mjs)로 바꾼다.
// 제시 하나를 묶음으로 보고, 그 묶음의 사건 전부에서 접기 사건을 통째로 다시 만든다(설계 §5-3 「줄은 고치지 않고 다시 짓는다」).
// 묶음 = 제시 + 그 제시의 전달 · 도움 · 답 + 그 가운데 어느 것을(옛 꼴은 그 제시의 결정도) 겨눈 제외. 본인 말 · 옮겨 온 장부는 혼자 한 묶음이다.
//
// 기록 하나(entry) = { event, key, atMs }
//   key   같은 시각의 차례 열쇠(글자). 2판 = 사건 id(a.…), 옛 꼴 = 서버 차례 s.<15자리> · 기기 로그 순서 l.<9자리>
//   atMs  접는 시각. 서버는 min(사건 at, 받은 시각), 기기는 사건 at
// index.lookup(itemKey) → { familyKey, skillId, difficulty, responseFormat, units, unknownOption? } | null  (단계 1의 문항 색인)
import { BITS, EVENT_FORM, EVENT_TYPES } from './events.mjs';
import { assessable } from './judge.mjs';

const SHOWN = new Set(['explanation', 'answer']);
export const EMPTY_INDEX = Object.freeze({ edition: 'index-0', lookup: () => null });

// 옛 꼴의 차례 열쇠 — 적힌 시각을 앞에 둔다(설계 §5-3 「차례는 (접는 시각, 사건에 적힌 시각, 셋째 열쇠)」): 서버가 한 묶음을
// 같은 시각으로 눌러도 적힌 시각 순, 그것도 같으면 받은 차례(server_seq) · 로그 순서. 2판 번호(a.<만든 시각>.…)도 같은 순서다.
const written = event => String(Math.max(0, Date.parse(event.at))).padStart(13, '0');
export const serverKey = (seq, event) => `s.${written(event)}.${String(seq).padStart(15, '0')}`;
export const deviceKey = (position, event) =>
  `l.${written(event)}.${String(position).padStart(9, '0')}`;
export const orderOf = (a, b) => a.atMs - b.atMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

const isCurrent = event => event.schema === EVENT_FORM.current;

// 문항 — 접는 때의 문항 색인이 먼저다(설계 §4). 색인에 없으면 사건에 적힌 값(2판 units · 옛 꼴 measure).
export function itemOf(presented, index = EMPTY_INDEX) {
  const indexed = index.lookup(presented.itemKey);
  const measure = isCurrent(presented) ? presented : presented.measure;
  const base = indexed ?? measure;
  if (!base?.familyKey || !base.skillId) return null;
  const units = indexed?.units ?? (isCurrent(presented) ? presented.units : undefined);
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
  if (!state.answered) state.firstAnswerAt = entry.atMs;
  state.answered = true;
  const answer = answerOf(entry, context.item, state, context.presented, context.view);
  state.out.push(answer);
  const exclusion = context.targets.get(event.id) ?? context.whole;
  if (exclusion) state.out.push(excludeOf(exclusion, entry.key, entry.atMs));
}

// 옛 꼴 제시의 firstExposure가 true가 아니면(기기가 앞선 만남을 알았거나 · 이력을 몰랐다) 지금 judge는 그 제시의 답을
// 독립 근거로 세지 않는다(다른 제시의 답에는 그 표시가 닿지 않는다). 같게 하려고, 그 제시의 첫 만남(첫 답 앞의 도움 또는 첫 답)과
// 같은 시각에 장부 만남 하나를 둔다 — 번호(<제시 열쇠>.prior)가 그 제시의 자식들보다 작아 같은 시각에서 먼저 선다.
// 그 계열의 더 이른 만남은 그대로이고, 장부 만남은 능력 줄 · 칸에 서지 않는다(단계 2 skillRowsOf).
function priorOf(source, item, state) {
  const first = Math.min(state.firstHelp?.atMs ?? Infinity, state.firstAnswerAt ?? Infinity);
  if (first === Infinity) return null;
  return {
    kind: 'carry',
    id: `${source.key}.prior`,
    at: first,
    families: [item.familyKey],
    after: first,
  };
}

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
    audio: 'pending',
    helps: [],
    answered: false,
    firstHelp: null,
    firstAnswerAt: null,
    out: [],
  };
  for (const entry of [...children].sort(orderOf)) stepChild(entry, state, context);
  const out = [];
  const prior =
    !isCurrent(presented) && presented.firstExposure !== true ? priorOf(source, item, state) : null;
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
