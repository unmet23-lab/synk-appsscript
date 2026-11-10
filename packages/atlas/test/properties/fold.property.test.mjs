// 접기를 임의의 사건 열로 확인한다(설계 §11 가상 학습자 관문 6 · 시제품 prototype/fuzz.mjs를 옮겼다).
//   가. 받는 차례 — 같은 사건들을 마구 섞어, 두 기기가 한 덩이씩, 거꾸로 받아도 서버가 접은 값이 같다.
//   나. 규칙의 뜻 — 두뇌가 접은 값이, 설계서 §3-2 · §3-3의 글을 그대로 옮긴 일괄 계산(test/oracle/spec.mjs)과 같다.
//   다. 기기 얹기 — 다른 기기의 사건까지 접힌 요약 위에 내 밀린 사건을 얹은 값이, 서버가 그 사건을 모두 접은 값과 같다.
//       얹을 수 없는 줄은 기다리고(요약 값 그대로), 기다리지 않는 줄은 하나도 어긋나지 않는다.
//   라. 한 기기가 제 차례로만 쓰면 기다리는 줄이 없다.
// 사건: 답(혼자 · 힌트 · 답을 본 뒤 · 모르겠어요 · 판정 못 함 / 단위 하나 · 여럿 / 겨눈 단위), 도움만 보고 나감, 본인 말,
//       제외(답이나 본인 말을 거둠), 옮겨 온 장부. 두 기기의 사건 몇은 시각이 같다(한 기기 안에서는 시각이 겹치지 않는다).
// 씨앗 수는 기본 3,000(ATLAS_SEEDS · ATLAS_SEED_SCALE로 바꾼다). 어긋난 판은 씨앗과 함께 찍는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { order, specGrade, specSkill, specUnit } from '../oracle/spec.mjs';
import { pick, rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

const { PARAMS, checkFoldEvent, createMemory, foldServer, overlay, unitsOf, touchedBy } =
  await subject();
const memory = createMemory();
const DAY = 86_400_000;
const T0 = Date.parse('2026-12-01T09:00:00Z');
const SEEDS = seedRange({ count: 3000 });

const UNITS = ['u0', 'u1', 'u2', 'u3'];
const SKILL_OF = i => (i % 2 ? 's1' : 's0');
const ITEMS = [
  ...UNITS.flatMap((u, i) => [
    {
      itemKey: `${u}.a`,
      familyKey: `${u}.a`,
      units: [u],
      skillId: SKILL_OF(i),
      difficulty: 1 + (i % 3),
      responseFormat: 'single-choice',
      unknownOption: i % 2 === 1, // 「모르겠어요」가 있는 문항 — 찍기 바닥이 절반
    },
    {
      itemKey: `${u}.b`,
      familyKey: `${u}.b`,
      units: [u],
      skillId: SKILL_OF(i),
      difficulty: 1 + ((i + 1) % 3),
      responseFormat: 'cup-compose',
    },
  ]),
  {
    itemKey: 'm01',
    familyKey: 'm01',
    units: ['u0', 'u1'],
    skillId: 's0',
    difficulty: 2,
    responseFormat: 'single-choice',
  },
  {
    itemKey: 'm123',
    familyKey: 'm123',
    units: ['u1', 'u2', 'u3'],
    skillId: 's1',
    difficulty: 3,
    responseFormat: 'cup-compose',
  },
  // 태그 없는 문항 — 계열이 곧 단위. 같은 계열의 두 문항이 다른 능력에 있다
  { itemKey: 'x.1', familyKey: 'x', skillId: 's0', difficulty: 1, responseFormat: 'binary-choice' },
  { itemKey: 'x.2', familyKey: 'x', skillId: 's1', difficulty: 2, responseFormat: 'spoken' },
];
const SKILLS = ['s0', 's1'];
const FAMILIES = [...new Set(ITEMS.map(item => item.familyKey))];
// 문항 색인: 계열 → 능력들
const familySkills = new Map(
  FAMILIES.map(key => [
    key,
    [...new Set(ITEMS.filter(item => item.familyKey === key).map(item => item.skillId))],
  ]),
);
// 같은 자리(6시간) 안 · 그날 저녁 · 며칠 뒤 · 60일 상한 너머를 고루 밟는다.
const GAPS = [
  20e3,
  90e3,
  10 * 60e3,
  3 * 3600e3,
  7 * 3600e3,
  DAY,
  3 * DAY,
  10 * DAY,
  40 * DAY,
  70 * DAY,
];

function answerOf(r, item) {
  const q = r();
  let answer;
  if (q < 0.1) answer = { correct: null, assessable: false };
  else if (q < 0.16) answer = { correct: false, unknown: true };
  else answer = { correct: r() < 0.65, assisted: r() < 0.2, answerShown: r() < 0.06 };
  return { ...answer, target: r() < 0.7 ? pick(r, unitsOf(item)) : undefined };
}

function eventOf(r, events, id, at, device) {
  const roll = r();
  // 제외는 그 기기가 든 사건을 거둔다
  const own = events.filter(e => e.device === device && (e.kind === 'answer' || e.kind === 'say'));
  if (roll < 0.08 && own.length) {
    const target = pick(r, own);
    const touches = r() < 0.6 ? { touches: touchedBy(target) } : {};
    return { kind: 'exclude', id, at, device, ref: target.id, ...touches };
  }
  if (roll < 0.11) {
    const before = events.filter(e => e.kind === 'carry' && e.device === device).at(-1);
    const families = FAMILIES.filter(() => r() < 0.25);
    return { kind: 'carry', id, at, device, families, ...(before ? { after: before.at } : {}) };
  }
  if (roll < 0.2) {
    const unit = pick(r, [...UNITS, 'family:x']);
    return { kind: 'say', id, at, device, unit, say: r() < 0.5 ? 'known' : 'relearn' };
  }
  if (roll < 0.25) return { kind: 'help', id, at, device, item: pick(r, ITEMS) };
  const item = pick(r, ITEMS);
  return { kind: 'answer', id, at, device, item, answer: answerOf(r, item) };
}

function makeEvents(seed) {
  const r = rng(seed);
  const n = 4 + Math.floor(r() * 40);
  const events = [];
  let at = T0;
  let tied = false;
  for (let i = 0; i < n; i += 1) {
    const prev = events.at(-1);
    // 앞 사건과 같은 시각 — 다른 기기의 사건일 때만(한 기기의 시계는 늘 앞으로 간다)
    const tie = Boolean(prev) && !tied && r() < 0.06;
    if (!tie) at += Math.round(pick(r, GAPS) * (0.5 + r())) + 1;
    tied = tie;
    let device;
    if (tie) device = 1 - prev.device;
    else device = r() < 0.5 ? 0 : 1;
    events.push(checkFoldEvent(eventOf(r, events, `e${String(i).padStart(2, '0')}`, at, device)));
  }
  return events;
}

const add = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

// 독립 기준의 재료: 사건에서 근거 줄과 만남 표를 따로 만든다(두뇌의 evidenceOf를 쓰지 않는다).
function specEvidence(events) {
  const gone = new Set(events.filter(e => e.kind === 'exclude').map(e => e.ref));
  const rows = new Map();
  const meets = new Map();
  // 장부에 접혀 있던 만남: 앞 장부를 뜬 때(처음이면 맨 앞)
  const ledger = e => ({
    id: e.id,
    at: e.after ?? -Infinity,
    ledger: true,
    grade: null,
    unaided: true,
  });
  for (const e of [...events].sort(order)) {
    if (e.kind === 'say' && !gone.has(e.id)) add(rows, e.unit, { id: e.id, at: e.at, say: e.say });
    if (e.kind === 'carry') for (const key of e.families) add(meets, key, ledger(e));
    if (e.kind === 'answer' || e.kind === 'help') specAnswer(e, gone, rows, meets);
  }
  for (const list of meets.values()) list.sort(order);
  return { rows, meets };
}

// 만남: 답했거나(판정 못 한 답 · 거둔 답도) 도움을 받았다. 성공은 문항이 묻는 모든 단위에, 실패는 겨눈 단위 하나에(없으면 주 단위).
function specAnswer(e, gone, rows, meets) {
  const units = e.item.units?.length ? e.item.units : [`family:${e.item.familyKey}`];
  const grade =
    e.kind === 'help' || gone.has(e.id) ? null : specGrade(e.answer, e.item.responseFormat);
  const unaided = e.kind === 'answer' && !e.answer.assisted && !e.answer.answerShown;
  const { skillId, difficulty, responseFormat } = e.item;
  const unknownOption = e.item.unknownOption === true;
  add(meets, e.item.familyKey, {
    id: e.id,
    at: e.at,
    skillId,
    difficulty,
    responseFormat,
    unknownOption,
    grade,
    unaided,
  });
  if (grade == null) return;
  const aimed = units.includes(e.answer.target) ? e.answer.target : units[0];
  for (const unit of grade === 'again' ? [aimed] : units)
    add(rows, unit, { id: e.id, at: e.at, grade, responseFormat });
}

function specOf(events) {
  const { rows, meets } = specEvidence(events);
  const units = new Map([...rows].map(([unit, list]) => [unit, specUnit(list, PARAMS)]));
  const skills = new Map();
  const met = new Map([...meets].map(([key, list]) => [key, list[0].at]));
  for (const id of SKILLS) {
    const list = [];
    // 판정된 답과 도움을 받은 흔적
    for (const marks of meets.values())
      marks.forEach((mark, i) => {
        if (!mark.ledger && mark.skillId === id && (mark.grade != null || !mark.unaided))
          list.push({ ...mark, lead: i === 0 });
      });
    if (list.length) skills.set(id, specSkill(list, PARAMS));
  }
  return { units, skills, met };
}

const num = x => x.toFixed(6);
// 글이 말하는 값
const plain = s => {
  if (!s) return 'none';
  if (s.empty) return `empty@${s.latestAt}`;
  return [
    num(s.stability),
    num(s.difficulty),
    s.sittings,
    s.lapses,
    s.firstAt,
    s.lastAt,
    s.latestAt,
    s.recent.map(cell => `${num(cell.q)}:${cell.m}`).join(','),
    s.stubborn,
    s.missed.join(','),
  ].join('|');
};
// 요약 줄 전체(이어 접을 재료까지)
const full = s => {
  if (!s || s.empty) return plain(s);
  const prev = s.prev
    ? [
        num(s.prev.stability),
        num(s.prev.difficulty),
        s.prev.lastAt,
        Boolean(s.prev.known),
        (s.prev.recent ?? []).map(cell => `${num(cell.q)}:${cell.m}`).join(','),
      ].join('/')
    : '-';
  return [plain(s), s.open.at, s.open.grade, prev].join('|');
};
const skillKey = s =>
  !s ? 'none' : [s.theta.toFixed(9), s.n, s.streak, s.level, s.lastAt].join('|');
const shape = s => ({ units: s.memory, skills: s.ability, met: s.met });
const shuffle = (r, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const NO_SKIP = { units: new Set(), skills: new Set() };

// 두 요약(단위 줄 · 능력 줄 · 만난 표)을 맞댄다. skip = 기다리는 줄(맞대지 않는다). 어긋난 것을 글로 돌려준다.
function compare(got, want, key, skip = NO_SKIP) {
  const out = [];
  for (const unit of new Set([...want.units.keys(), ...got.units.keys()])) {
    if (skip.units.has(unit)) continue;
    const a = key(got.units.get(unit));
    const b = key(want.units.get(unit));
    if (a !== b) out.push(`단위 ${unit}: ${a} ≠ ${b}`);
  }
  for (const id of SKILLS) {
    if (skip.skills.has(id)) continue;
    const a = skillKey(got.skills.get(id));
    const b = skillKey(want.skills.get(id));
    if (a !== b) out.push(`능력 ${id}: ${a} ≠ ${b}`);
  }
  for (const family of new Set([...want.met.keys(), ...got.met.keys()]))
    if (got.met.get(family) !== want.met.get(family))
      out.push(`첫 만남 ${family}: ${got.met.get(family)} ≠ ${want.met.get(family)}`);
  return out;
}

function sweep(check) {
  const bad = [];
  for (const seed of SEEDS) for (const what of check(seed)) bad.push(`씨앗 ${seed} · ${what}`);
  assert.equal(bad.length, 0, `어긋난 것 ${bad.length}:\n${bad.slice(0, 6).join('\n')}`);
}

test('가. 받는 차례 — 섞어 · 두 기기 한 덩이씩 · 거꾸로 받아도 서버가 접은 값이 같다', () => {
  sweep(seed => {
    const events = makeEvents(seed);
    const r = rng(seed * 7919 + 13);
    const truth = shape(foldServer(events, memory));
    const arrivals = {
      '마구 섞음': shuffle(r, events),
      '두 기기 한 덩이씩': [
        ...events.filter(e => e.device === 0),
        ...events.filter(e => e.device === 1),
      ],
      거꾸로: [...events].reverse(),
    };
    return Object.entries(arrivals).flatMap(([name, arrival]) =>
      compare(shape(foldServer(arrival, memory)), truth, full).map(what => `${name} · ${what}`),
    );
  });
});

test('나. 규칙의 뜻 — 두뇌가 접은 값이 글을 옮긴 일괄 계산과 같다', () => {
  sweep(seed => {
    const events = makeEvents(seed);
    return compare(shape(foldServer(events, memory)), specOf(events), plain);
  });
});

// 기기 0의 뒤쪽 사건이 아직 요약에 들지 않았다. 요약에는 기기 1의 사건이(내 밀린 사건보다 뒤의 것도) 다 들어 있다.
function overlayCase(seed) {
  const events = makeEvents(seed);
  const r = rng(seed * 7919 + 13);
  shuffle(r, events); // 받는 차례 시험과 같은 수열을 지난다(시제품과 같은 씨앗 자리)
  const mine = events.filter(e => e.device === 0);
  const known = new Map(mine.map(e => [e.id, e]));
  const pending = new Set(mine.slice(Math.floor(r() * (mine.length + 1))).map(e => e.id));
  // 기기가 든 최근 사건: 밀린 사건의 이틀 앞까지
  const oldest =
    Math.min(...mine.filter(e => pending.has(e.id)).map(e => e.at), Infinity) - 2 * DAY;
  const summary = structuredClone(
    foldServer(
      events.filter(e => !pending.has(e.id)),
      memory,
    ),
  );
  const lookup = id => (known.get(id)?.at >= oldest ? known.get(id) : undefined);
  const view = overlay(
    summary,
    events.filter(e => pending.has(e.id)),
    memory,
    PARAMS,
    { familySkills, lookup },
  );
  return { events, r, summary, view, truth: shape(foldServer(events, memory)) };
}

test('다. 기기 얹기 — 얹은 줄은 서버가 모두 접은 값과 같고, 기다리는 줄은 요약 값 그대로다', () => {
  const tally = { laid: 0, waited: 0, all: 0 };
  sweep(seed => {
    const { summary, view, truth } = overlayCase(seed);
    // 닿는 줄을 모르는 제외: 요약 그대로
    if (view.waitAll) {
      tally.all += 1;
      return compare(shape(view), shape(summary), full).map(what => `모두 기다림 · ${what}`);
    }
    tally.waited += view.waitUnits.size;
    tally.laid += [...truth.units.keys()].filter(unit => !view.waitUnits.has(unit)).length;
    const out = compare(shape(view), truth, full, {
      units: view.waitUnits,
      skills: view.waitSkills,
    });
    for (const unit of view.waitUnits)
      if (full(view.memory.get(unit)) !== full(summary.memory.get(unit)))
        out.push(`기다리는 단위 ${unit}가 요약 값이 아님`);
    for (const id of view.waitSkills)
      if (skillKey(view.ability.get(id)) !== skillKey(summary.ability.get(id)))
        out.push(`기다리는 능력 ${id}가 요약 값이 아님`);
    return out;
  });
  // 시험이 실제로 얹기와 기다리기를 모두 밟았는가(무딘 시험이 아닌가)
  assert.ok(tally.laid > 0 && tally.waited > 0, JSON.stringify(tally));
});

// 한 기기가 제 차례로만 쓰면(앞쪽이 요약, 뒤쪽이 밀린 사건) 기다리는 줄이 없다 — 이미 접힌 사건의 제외와, 장부가 덮는 경우만 기다린다.
function singleCase(seed) {
  const { events, r } = overlayCase(seed);
  // 한 기기의 시각은 겹치지 않는다
  const kept = events.filter((e, i) => !(i && e.at === events[i - 1].at));
  const keptIds = new Set(kept.map(e => e.id));
  const single = kept
    .filter(e => e.kind !== 'exclude' || keptIds.has(e.ref))
    .map(e => ({ ...e, device: 0 }));
  const cut = Math.floor(r() * (single.length + 1));
  const head = single.slice(0, cut);
  const tail = single.slice(cut);
  const headIds = new Set(head.map(e => e.id));
  const all = new Map(single.map(e => [e.id, e]));
  const alone = overlay(structuredClone(foldServer(head, memory)), tail, memory, PARAMS, {
    familySkills,
    lookup: id => all.get(id),
  });
  const mayWait = tail.some(
    e => (e.kind === 'exclude' && headIds.has(e.ref)) || e.kind === 'carry',
  );
  return { single, alone, mayWait };
}

test('라. 한 기기가 제 차례로만 쓰면 기다리는 줄이 없고, 얹은 값은 서버와 같다', () => {
  sweep(seed => {
    const { single, alone, mayWait } = singleCase(seed);
    const out = alone.waitAll
      ? []
      : compare(shape(alone), shape(foldServer(single, memory)), full, {
          units: alone.waitUnits,
          skills: alone.waitSkills,
        });
    if (!mayWait && (alone.waitUnits.size || alone.waitSkills.size))
      out.push(
        `기다릴 까닭이 없는데 기다림 — 단위 ${[...alone.waitUnits]} · 능력 ${[...alone.waitSkills]}`,
      );
    return out;
  });
});
