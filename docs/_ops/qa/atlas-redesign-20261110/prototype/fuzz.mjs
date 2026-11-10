// 접기를 임의의 사건 열로 확인한다(3차 설계 검토와 구조 검토 뒤 — 검토가 짚을 때마다 장면을 하나씩 더하는 대신 기계로 훑는다).
// 세 가지를 본다.
//   가. 받는 차례 — 같은 사건들을 마구 섞어, 두 기기가 한 덩이씩, 거꾸로 받아도 서버가 접은 값이 같다.
//   나. 규칙의 뜻 — 두뇌가 접은 값이, 설계서 §3-2 · §3-3의 글을 그대로 옮긴 일괄 계산(spec.mjs — 두뇌의 접기 코드를 쓰지 않는다)과 같다.
//   다. 기기 얹기 — 다른 기기의 사건까지 접힌 요약 위에 내 밀린 사건을 얹은 값이, 서버가 그 사건을 모두 접은 값과 같다.
//       얹을 수 없는 줄은 기다리고(요약 값 그대로), 기다리지 않는 줄은 하나도 어긋나지 않는다. 한 기기가 제 차례로만 쓰면 기다리는 줄이 없다.
// 사건: 답(혼자 · 힌트 · 답을 본 뒤 · 모르겠어요 · 판정 못 함 / 단위 하나 · 여럿 / 겨눈 단위), 도움만 보고 나감, 본인 말(이미 알아요 · 다시 배울래요),
//       제외(답이나 본인 말을 거둠), 옮겨 온 장부. 두 기기의 사건 몇은 시각이 같다(차례는 사건 번호로 정한다. 한 기기 안에서는 시각이 겹치지 않는다).
// 쓰는 법: node fuzz.mjs [씨앗 수=3000] [첫 씨앗=1]
import { PARAMS, createMemory, foldServer, overlay, unitsOf, touchedBy } from './brain.mjs';
import { specGrade, specUnit, specSkill } from './spec.mjs';
import { loadFsrs } from './fsrs-path.mjs';

const tsfsrs = loadFsrs(), memory = createMemory(tsfsrs);
const DAY = 86400000, T0 = Date.parse('2026-12-01T09:00:00Z');
const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (r, list) => list[Math.floor(r() * list.length)];
const order = (a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); // 시각 순, 같으면 사건 번호 순

const UNITS = ['u0', 'u1', 'u2', 'u3'];
const ITEMS = [
  ...UNITS.flatMap((u, i) => [
    { id: `${u}.a`, familyKey: `${u}.a`, kcIds: [u], skillId: i % 2 ? 's1' : 's0', difficulty: 1 + (i % 3), responseFormat: 'single-choice' },
    { id: `${u}.b`, familyKey: `${u}.b`, kcIds: [u], skillId: i % 2 ? 's1' : 's0', difficulty: 1 + ((i + 1) % 3), responseFormat: 'cup-compose' },
  ]),
  { id: 'm01', familyKey: 'm01', kcIds: ['u0', 'u1'], skillId: 's0', difficulty: 2, responseFormat: 'single-choice' },
  { id: 'm123', familyKey: 'm123', kcIds: ['u1', 'u2', 'u3'], skillId: 's1', difficulty: 3, responseFormat: 'cup-compose' },
  { id: 'x.1', familyKey: 'x', skillId: 's0', difficulty: 1, responseFormat: 'binary-choice' }, // 태그 없는 문항 — 계열이 곧 단위. 같은 계열의 두 문항이 다른 능력에 있다
  { id: 'x.2', familyKey: 'x', skillId: 's1', difficulty: 2, responseFormat: 'spoken' },
];
const SKILLS = ['s0', 's1'], FAMILIES = [...new Set(ITEMS.map(item => item.familyKey))];
const familySkills = new Map(FAMILIES.map(key => [key, [...new Set(ITEMS.filter(item => item.familyKey === key).map(item => item.skillId))]])); // 문항 색인: 계열 → 능력들
// 같은 자리(6시간) 안 · 그날 저녁 · 며칠 뒤 · 60일 상한 너머를 고루 밟는다.
const GAPS = [20e3, 90e3, 10 * 60e3, 3 * 3600e3, 7 * 3600e3, DAY, 3 * DAY, 10 * DAY, 40 * DAY, 70 * DAY];

function makeEvents(seed) {
  const r = rng(seed), n = 4 + Math.floor(r() * 40), events = [];
  let at = T0, tied = false;
  for (let i = 0; i < n; i += 1) {
    const prev = events.at(-1), tie = Boolean(prev) && !tied && r() < 0.06; // 앞 사건과 같은 시각 — 다른 기기의 사건일 때만(한 기기의 시계는 늘 앞으로 간다)
    if (!tie) at += Math.round(pick(r, GAPS) * (0.5 + r())) + 1;
    tied = tie;
    const device = tie ? 1 - prev.device : r() < 0.5 ? 0 : 1, roll = r(), id = `e${String(i).padStart(2, '0')}`;
    const own = events.filter(e => e.device === device && (e.kind === 'answer' || e.kind === 'say')); // 제외는 그 기기가 든 사건을 거둔다
    if (roll < 0.08 && own.length) { const target = pick(r, own); events.push({ kind: 'exclude', id, at, device, ref: target.id, ...(r() < 0.6 ? { touches: touchedBy(target) } : {}) }); }
    else if (roll < 0.11) { const before = events.filter(e => e.kind === 'carry' && e.device === device).at(-1); events.push({ kind: 'carry', id, at, device, families: FAMILIES.filter(() => r() < 0.25), ...(before ? { after: before.at } : {}) }); }
    else if (roll < 0.2) events.push({ kind: 'say', id, at, device, unit: pick(r, [...UNITS, 'family:x']), say: r() < 0.5 ? 'known' : 'relearn' });
    else if (roll < 0.25) events.push({ kind: 'help', id, at, device, item: pick(r, ITEMS) });
    else {
      const item = pick(r, ITEMS), q = r();
      const answer = q < 0.1 ? { correct: null, assessable: false } : q < 0.16 ? { correct: false, unknown: true } : { correct: r() < 0.65, assisted: r() < 0.2, answerShown: r() < 0.06 };
      events.push({ kind: 'answer', id, at, device, item, answer: { ...answer, target: r() < 0.7 ? pick(r, unitsOf(item)) : undefined } });
    }
  }
  return events;
}

// 독립 기준: 사건에서 근거 줄과 만남 표를 따로 만들고(두뇌의 evidenceOf를 쓰지 않는다) 글을 옮긴 일괄 계산으로 낸다.
function specOf(events) {
  const gone = new Set(events.filter(e => e.kind === 'exclude').map(e => e.ref));
  const rows = new Map(), meets = new Map();
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const e of [...events].sort(order)) {
    if (e.kind === 'say') { if (!gone.has(e.id)) add(rows, e.unit, { id: e.id, at: e.at, say: e.say }); continue; }
    if (e.kind === 'carry') { for (const key of e.families) add(meets, key, { id: e.id, at: e.after ?? -Infinity, ledger: true, grade: null, unaided: true }); continue; } // 장부에 접혀 있던 만남: 앞 장부를 뜬 때(처음이면 맨 앞)
    if (e.kind !== 'answer' && e.kind !== 'help') continue;
    const units = unitsOf(e.item), grade = e.kind === 'help' || gone.has(e.id) ? null : specGrade(e.answer, e.item.responseFormat);
    // 만남: 답했거나(판정 못 한 답 · 거둔 답도) 도움을 받았다. 성공은 문항이 묻는 모든 단위에, 실패는 겨눈 단위 하나에(없으면 주 단위) 적는다.
    add(meets, e.item.familyKey, { id: e.id, at: e.at, skillId: e.item.skillId, difficulty: e.item.difficulty, responseFormat: e.item.responseFormat, grade, unaided: e.kind === 'answer' && !e.answer.assisted && !e.answer.answerShown });
    if (grade == null) continue;
    const aimed = units.includes(e.answer.target) ? e.answer.target : units[0];
    for (const unit of grade === 'again' ? [aimed] : units) add(rows, unit, { id: e.id, at: e.at, grade });
  }
  const units = new Map([...rows].map(([unit, list]) => [unit, specUnit(tsfsrs, list, PARAMS)]));
  const skills = new Map(), met = new Map();
  for (const list of meets.values()) list.sort(order);
  for (const [key, list] of meets) met.set(key, list[0].at);
  for (const id of SKILLS) {
    const list = [];
    for (const marks of meets.values()) marks.forEach((mark, i) => { if (!mark.ledger && mark.skillId === id && (mark.grade != null || !mark.unaided)) list.push({ ...mark, lead: i === 0 }); }); // 판정된 답과 도움을 받은 흔적
    if (list.length) skills.set(id, specSkill(list, PARAMS));
  }
  return { units, skills, met };
}

const num = x => x.toFixed(6);
const plain = s => (!s ? 'none' : s.empty ? `empty@${s.latestAt}` : [num(s.stability), num(s.difficulty), s.sittings, s.lapses, s.firstAt, s.lastAt, s.latestAt].join('|')); // 글이 말하는 값
const full = s => (!s || s.empty ? plain(s) : [plain(s), s.open.at, s.open.grade, s.prev ? [num(s.prev.stability), num(s.prev.difficulty), s.prev.lastAt, Boolean(s.prev.known)].join('/') : '-'].join('|')); // 요약 줄 전체(이어 접을 재료까지)
const skillKey = s => (!s ? 'none' : [s.theta.toFixed(9), s.n, s.streak, s.lastAt].join('|'));
const shuffle = (r, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const count = Number(process.argv[2]) || 3000, first = Number(process.argv[3]) || 1;
const ORDERS = ['마구 섞음', '두 기기 한 덩이씩', '거꾸로'];
const bad = [], tally = { events: 0, answer: 0, help: 0, say: 0, exclude: 0, carry: 0, ties: 0, rows: 0, laid: 0, waited: 0, skillLaid: 0, skillWaited: 0, solo: 0, all: 0 };
const fail = (seed, where, what, got, want) => bad.push({ seed, where, what, got, want });
// 두 요약(단위 줄 · 능력 줄 · 만난 표)을 맞댄다. skip = 기다리는 줄(맞대지 않는다).
function compare(seed, where, got, want, key, skip = { units: new Set(), skills: new Set() }) {
  for (const unit of new Set([...want.units.keys(), ...got.units.keys()])) if (!skip.units.has(unit) && key(got.units.get(unit)) !== key(want.units.get(unit))) fail(seed, where, `단위 ${unit}`, key(got.units.get(unit)), key(want.units.get(unit)));
  for (const id of SKILLS) if (!skip.skills.has(id) && skillKey(got.skills.get(id)) !== skillKey(want.skills.get(id))) fail(seed, where, `능력 ${id}`, skillKey(got.skills.get(id)), skillKey(want.skills.get(id)));
  for (const family of new Set([...want.met.keys(), ...got.met.keys()])) if (got.met.get(family) !== want.met.get(family)) fail(seed, where, `첫 만남 ${family}`, got.met.get(family), want.met.get(family));
}
const shape = s => ({ units: s.memory, skills: s.ability, met: s.met });

for (let seed = first; seed < first + count; seed += 1) {
  const events = makeEvents(seed), r = rng(seed * 7919 + 13), truth = shape(foldServer(events, memory));
  tally.events += events.length; tally.rows += truth.units.size;
  events.forEach((e, i) => { tally[e.kind] += 1; if (i && e.at === events[i - 1].at) tally.ties += 1; });
  // 가. 받는 차례
  [shuffle(r, events), [...events.filter(e => e.device === 0), ...events.filter(e => e.device === 1)], [...events].reverse()]
    .forEach((arrival, k) => compare(seed, `받는 차례(${ORDERS[k]})`, shape(foldServer(arrival, memory)), truth, full));
  // 나. 규칙의 뜻
  compare(seed, '글을 옮긴 일괄 계산', truth, specOf(events), plain);
  // 다. 기기 얹기 — 기기 0의 뒤쪽 사건이 아직 요약에 들지 않았다. 요약에는 기기 1의 사건이(내 밀린 사건보다 뒤의 것도) 다 들어 있다.
  const mine = events.filter(e => e.device === 0), known = new Map(mine.map(e => [e.id, e]));
  const pending = new Set(mine.slice(Math.floor(r() * (mine.length + 1))).map(e => e.id));
  const oldest = Math.min(...mine.filter(e => pending.has(e.id)).map(e => e.at), Infinity) - 2 * DAY; // 기기가 든 최근 사건: 밀린 사건의 이틀 앞까지
  const summary = structuredClone(foldServer(events.filter(e => !pending.has(e.id)), memory)); // 요약으로 내려갔다 온 줄
  const view = overlay(summary, events.filter(e => pending.has(e.id)), memory, PARAMS, { familySkills, lookup: id => (known.get(id)?.at >= oldest ? known.get(id) : undefined) });
  if (view.waitAll) { tally.all += 1; compare(seed, '기기 얹기(모두 기다림)', shape(view), shape(summary), full); } // 닿는 줄을 모르는 제외: 요약 그대로
  else compare(seed, '기기 얹기', shape(view), truth, full, { units: view.waitUnits, skills: view.waitSkills });
  for (const unit of view.waitUnits) if (full(view.memory.get(unit)) !== full(summary.memory.get(unit))) fail(seed, '기기 얹기', `기다리는 단위 ${unit}가 요약 값이 아님`, full(view.memory.get(unit)), full(summary.memory.get(unit)));
  for (const id of view.waitSkills) if (skillKey(view.ability.get(id)) !== skillKey(summary.ability.get(id))) fail(seed, '기기 얹기', `기다리는 능력 ${id}가 요약 값이 아님`, skillKey(view.ability.get(id)), skillKey(summary.ability.get(id)));
  if (!view.waitAll) { tally.waited += view.waitUnits.size; tally.laid += new Set([...truth.units.keys()].filter(unit => !view.waitUnits.has(unit))).size; tally.skillWaited += view.waitSkills.size; tally.skillLaid += SKILLS.length - view.waitSkills.size; }
  // 한 기기가 제 차례로만 쓰면(앞쪽이 요약, 뒤쪽이 밀린 사건) 기다리는 줄이 없다 — 이미 접힌 사건의 제외와, 이미 만난 계열을 옮겨 온 장부가 덮는 경우만 기다린다.
  const kept = events.filter((e, i) => !(i && e.at === events[i - 1].at)), keptIds = new Set(kept.map(e => e.id)); // 한 기기의 시각은 겹치지 않는다
  const single = kept.filter(e => e.kind !== 'exclude' || keptIds.has(e.ref)).map(e => ({ ...e, device: 0 })), cut = Math.floor(r() * (single.length + 1));
  const head = single.slice(0, cut), tail = single.slice(cut), headIds = new Set(head.map(e => e.id)), all = new Map(single.map(e => [e.id, e]));
  const alone = overlay(structuredClone(foldServer(head, memory)), tail, memory, PARAMS, { familySkills, lookup: id => all.get(id) });
  if (!alone.waitAll) compare(seed, '한 기기 제 차례', shape(alone), shape(foldServer(single, memory)), full, { units: alone.waitUnits, skills: alone.waitSkills });
  const mayWait = tail.some(e => (e.kind === 'exclude' && headIds.has(e.ref)) || e.kind === 'carry');
  if (!mayWait && (alone.waitUnits.size || alone.waitSkills.size)) fail(seed, '한 기기 제 차례', '기다릴 까닭이 없는데 기다림', `단위 ${[...alone.waitUnits]} · 능력 ${[...alone.waitSkills]}`, '없음');
  if (!mayWait) tally.solo += 1;
}
console.log(`임의 사건 열 ${count}개(씨앗 ${first}~${first + count - 1}) — 사건 ${tally.events}건: 답 ${tally.answer} · 도움만 봄 ${tally.help} · 본인 말 ${tally.say} · 제외 ${tally.exclude} · 옮겨 온 장부 ${tally.carry} · 두 기기의 시각이 같은 것 ${tally.ties}`);
console.log(`가. 받는 차례 ${ORDERS.length}가지(${ORDERS.join(' · ')})로 받아 서버가 접은 값 · 나. 글을 옮긴 일괄 계산(단위 줄 ${tally.rows}개와 능력 줄)과 맞댐`);
console.log(`다. 기기 얹기 — 단위 줄 ${tally.laid}개는 얹고 ${tally.waited}개는 기다림 · 능력 줄 ${tally.skillLaid}개는 얹고 ${tally.skillWaited}개는 기다림 · 닿는 줄을 모르는 제외가 밀려 있어 아무것도 얹지 않은 열 ${tally.all}개 · 한 기기가 제 차례로 쓴 열 ${tally.solo}개에서는 기다리는 줄 없음`);
const kinds = new Map(); for (const row of bad) kinds.set(row.where, (kinds.get(row.where) || 0) + 1);
console.log(`어긋난 것: ${bad.length}${kinds.size ? ' — ' + [...kinds].map(([where, n]) => `${where} ${n}`).join(' · ') : ''}`);
const seen = new Set();
for (const row of bad) { if (seen.has(row.where) || seen.size >= 6) continue; seen.add(row.where); console.log(`   씨앗 ${row.seed} · ${row.where} · ${row.what}\n      낸 값: ${row.got}\n      기준: ${row.want}`); }
if (bad.length) process.exitCode = 1;
