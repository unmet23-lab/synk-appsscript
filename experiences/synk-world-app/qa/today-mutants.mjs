#!/usr/bin/env node
// 4-3 홈 세 줄(world-today.mjs)의 변형 시험(Atlas 재설계 단계4_계획 §20-10 「변형」). 홈 쪽 층의 규칙을 하나씩 일부러 깬 사본을 같은 폴더에
// 만들어 장면 시험(qa/atlas-next-home.test.mjs)이 잡는지 본다. 원본은 건드리지 않는다. 사본은 점으로 시작하는 이름(서버가 내지 않는다)이고
// 끝나면 지운다. 장면 시험은 SYNK_TODAY_MODULE이 가리키는 사본을 받는다. 깨지 않은 사본이 먼저 통과해야 변형을 돌린다(사본을 못 받아
// 모든 변형이 「잡음」이 되는 일을 막는다). 홈 쪽 층의 규칙을 더하거나 고치면 여기에 깬 변형을 함께 더한다.
// 쓰는 법: node experiences/synk-world-app/qa/today-mutants.mjs [--갈래 <갈래>]
// 종료코드: 0 = 모든 변형을 잡음 · 1 = 살아남은 변형이 있음 · 2 = 목록 오류 또는 깨지 않은 사본이 장면 시험에 떨어짐
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, '..', 'world-today.mjs');
const scenes = path.join(here, 'atlas-next-home.test.mjs');

// 변형 하나 = [갈래, 이름, 바꿀 글, 바꾼 글]. 바꿀 글은 원본에 꼭 한 번 있어야 한다.
export const TODAY_MUTANTS = [
  ['칸', '같은 칸의 둘째 활동도 줄로 세운다', '    if (!act || taken.has(act.kind)) continue;\n', '    if (!act) continue;\n'],
  [
    '줄의 차례',
    '줄을 plan() 차례의 거꾸로 세운다',
    '  for (const entry of entries) {\n    const act = byId.get(entry.id);',
    '  for (const entry of [...entries].reverse()) {\n    const act = byId.get(entry.id);',
  ],
  ['이유 문장', '화면 언어의 문장이 없는 활동도 줄로 세운다', '    if (!why?.line) continue;\n', '    if (!why) continue;\n'],
  [
    '빈 날',
    '조건에 걸린 날을 다 한 날로 적는다',
    "blocked ? 'blocked' : capped ? 'day.capped' : 'done',",
    "capped ? 'day.capped' : 'done',",
  ],
  ['상한', '상한 날에도 복습 줄을 세운다', '  if (capped || entry.none) return null;\n', '  if (entry.none) return null;\n'],
  [
    '상한',
    'plan 쪽 칸을 읽지 않고 항목에서만 읽는다(설계 주인 11-15 · §20-14)',
    "  const capped = typeof dayCapped === 'boolean' ? dayCapped : entries.some(entry => Boolean(entry?.capped));\n",
    '  const capped = entries.some(entry => Boolean(entry?.capped));\n',
  ],
  [
    '상한',
    '홈 계획이 plan 쪽 칸을 줄 규칙에 넘기지 않는다(§20-14)',
    '  const { rows, capped } = todayRows({ entries, activities, opened, say, dayCapped: live ? planned.capped : undefined });\n',
    '  const { rows, capped } = todayRows({ entries, activities, opened, say });\n',
  ],
  [
    '빈 날',
    '상한 날의 복습 칸 활동이 걸려도 조건에 걸린 날로 센다 — 풀려도 줄이 아닌데 조건을 바꾸라고 한다(Fable 엔진급 끝 판 F5)',
    "  const blocked = activities.some(act => act.blocked && !(capped && act.kind === 'again' && !act.open.resume));\n",
    '  const blocked = activities.some(act => act.blocked);\n',
  ],
  [
    '빈 날',
    '빈 날 코드에서 상한을 조건보다 앞에 둔다 — 판은 조건(unavailable)인데 빈 날은 상한이다(Fable 엔진급 끝 판 F5)',
    "code: checking ? 'checking' : blocked ? 'blocked' : capped ? 'day.capped' : 'done',",
    "code: checking ? 'checking' : capped ? 'day.capped' : blocked ? 'blocked' : 'done',",
  ],
  [
    '확인 중',
    'plan()이 실패해도 엔진 판으로 빈 목록을 읽는다 — 다음 레슨이 남았는데 다 한 날이 된다(Fable 엔진급 끝 판 F3)',
    '  const live = engine && Array.isArray(planned);\n  const entries = live ? planned : checkingEntries(activities, say);\n',
    '  const live = engine;\n  const entries = live ? (planned ?? []) : checkingEntries(activities, say);\n',
  ],
  [
    '판 셋',
    'reopen이 홈 코치를 내려놓지 않는다 — 은행 없이 연 코치가 그 문서에서 그대로 남는다(Fable 엔진급 끝 판 F2)',
    '      retryWait = every;\n      drop();\n',
    '      retryWait = every;\n',
  ],
  [
    '상한',
    '상한을 생활 복습 항목에서만 읽는다 — 짧은 연습만 상한인 날을 다 한 날로 적는다(GPT 끝 판 GB1)',
    "  const capped = typeof dayCapped === 'boolean' ? dayCapped : entries.some(entry => Boolean(entry?.capped));\n",
    "  const capped = typeof dayCapped === 'boolean' ? dayCapped : Boolean(entries.find(entry => entry.id === LIFE_REVIEW_ID)?.capped);\n",
  ],
  [
    '상한',
    '상한 문장을 짓지 않는다',
    "  const cappedText = capped ? quiet(() => say({ code: 'day.capped', slots: {} })) : null;\n",
    '  const cappedText = null;\n',
  ],
  [
    '확인 중',
    '생활 판정이 확인 중이어도 홈 코치가 있으면 엔진 줄을 그린다',
    "const engine = Boolean(coach) && typeof coach.plan === 'function' && judged?.state === 'engine';",
    "const engine = Boolean(coach) && typeof coach.plan === 'function';",
  ],
  [
    '확인 중',
    '확인 중에 한글 먼저를 하던 것보다 앞세운다',
    '    act.plan.facts.resume ? 0 : act.plan.facts.prerequisite ? 1 : act.plan.facts.describe ? 2 : 3;\n',
    '    act.plan.facts.prerequisite ? 0 : act.plan.facts.resume ? 1 : act.plan.facts.describe ? 2 : 3;\n',
  ],
  [
    '차례 표시',
    '하던 것 줄을 건너뛴다',
    '    rows.find(row => row.open.resume) ?? rows.find(row => !opened.has(row.kind)) ?? rows[0] ?? null\n',
    '    rows.find(row => !opened.has(row.kind)) ?? rows[0] ?? null\n',
  ],
  [
    '차례 표시',
    '연 칸을 건너뛰지 않는다',
    '    rows.find(row => row.open.resume) ?? rows.find(row => !opened.has(row.kind)) ?? rows[0] ?? null\n',
    '    rows.find(row => row.open.resume) ?? rows[0] ?? null\n',
  ],
  [
    'Core 거름',
    '정한 시간보다 긴 활동을 잠그지 않는다',
    "  if (settings.minutes != null && candidate.minutes > settings.minutes) return 'time.limit';\n",
    '',
  ],
  [
    'Core 거름',
    '소리를 끈 날 소리가 드는 활동을 잠그지 않는다',
    "  if (settings.audioAvailable === false && candidate.audioRequired) return 'audio.unavailable';\n",
    '',
  ],
  [
    '잠김',
    '걸린 활동을 잠그지 않고 후보를 넘긴다',
    '      ? { id: open.id, candidates: [], facts: { locked: true } }\n',
    '      ? { id: open.id, candidates, facts }\n',
  ],
  [
    '짧은 연습 후보',
    '돌아온 단위마다 하나가 아니라 돌아온 단위가 든 문항을 모두 넘긴다',
    '    const fresh = units.filter(unit => dueUnits.has(unit) && !seen.has(unit));\n',
    '    const fresh = units.filter(unit => dueUnits.has(unit));\n',
  ],
  ['짧은 연습 후보', '돌아온 단위가 없는 문항까지 넘긴다', '    if (!fresh.length) continue;\n', ''],
  [
    '짧은 연습 줄',
    '돌아옴(층 1)이 아닌 짧은 연습도 줄로 세운다',
    "  if (open.route === 'practice') return entry.tier === 1 ? entry.why : null;\n",
    "  if (open.route === 'practice') return entry.why;\n",
  ],
  [
    '다음 레슨 후보',
    '돌아온 단위가 든 문항을 빼지 않는다',
    '          itemsOf(open.targets).filter(item => !returned(item.itemKey)),\n',
    '          itemsOf(open.targets),\n',
  ],
  [
    '다음 레슨 문장',
    '맨 앞 줄이 새것이 아니어도 엔진의 문장을 쓴다',
    "    if (entry.why?.code === 'unit.new' && entry.why.line) return entry.why;\n",
    '    if (entry.why?.line) return entry.why;\n',
  ],
  [
    '생활 복습 줄',
    '채우기만 남은 생활 복습도 줄로 세운다',
    '  if (open.id === LIFE_REVIEW_ID) return entry.fact >= 0 || entry.tier <= 2 ? entry.why : null;\n',
    '  if (open.id === LIFE_REVIEW_ID) return entry.why;\n',
  ],
  [
    '생활 복습 사실',
    '①의 단위 이름을 첫 ①에서만 찾는다(이름 없는 ①이 먼저면 이름을 잃는다)',
    "    const named = missed.find(item => typeof item.unit === 'string');\n",
    "    const named = typeof missed[0].unit === 'string' ? missed[0] : null;\n",
  ],
  ['학습일', '학습일 경계를 자정으로 둔다', 'const DAY_START_HOUR = 4;', 'const DAY_START_HOUR = 0;'],
  [
    '학습일',
    '학습일 열쇠를 4시간을 빼서 센다 — 서머타임이 바뀌는 날 다시 그리는 때와 어긋난다(카본 엔진급 끝 판 B5)',
    '  const at = new Date(now);\n  if (at.getHours() < DAY_START_HOUR) at.setDate(at.getDate() - 1);\n',
    '  const at = new Date(now - DAY_START_HOUR * 3_600_000);\n',
  ],
  [
    'Core 거름',
    '소리를 끈 날 듣기 짧은 연습을 잠그지 않고 뺀다 — 듣기 연습만 남은 날을 다 한 날로 적는다(카본 엔진급 끝 판 B1)',
    '    const units = (quiet(() => itemUnits(item.itemKey)) ?? []).map(row => row?.unit);\n',
    "    if (settings.audioAvailable === false && item.skillId.split('.')[1] === 'listening') continue;\n    const units = (quiet(() => itemUnits(item.itemKey)) ?? []).map(row => row?.unit);\n",
  ],
  [
    '다시 그리기',
    '①이 열리는 때를 다시 그리는 때에 넣지 않는다',
    '  const upcoming = (Array.isArray(judged?.times) ? judged.times : [judged?.nextAt]).filter(\n',
    '  const upcoming = [].filter(\n',
  ],
  ['판 셋', '홈 코치가 닫혀도 확인 중으로 돌아가지 않는다', '              drop();\n              changed();\n', '              changed();\n'],
  [
    '판 셋',
    '홈 코치를 못 받으면 다시 열지 않는다',
    '          retryTimer = timers.setTimeout(() => {\n            retryTimer = null;\n            changed();\n          }, retryWait);\n',
    '          retryTimer = 1;\n',
  ],
  ['판 셋', '생활 판정이 확인 중이어도 엔진이 된다', "    if (life !== 'engine') return 'checking';\n", ''],
  [
    '판 셋',
    '홈 코치의 요약이 자리를 잡기 전에 엔진이다',
    "    if (!settled(quiet(() => coach.summary()))) {\n      settle();\n      return 'checking';\n    }\n",
    '',
  ],
];

function run(copy) {
  const result = spawnSync(process.execPath, ['--test', scenes], {
    env: { ...process.env, SYNK_TODAY_MODULE: copy },
    encoding: 'utf8',
  });
  return result.status === 0;
}

const original = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
const at = process.argv.indexOf('--갈래');
const only = at >= 0 ? process.argv[at + 1] : null;
const copyOf = tag => path.join(here, '..', `.mutant-world-today-${process.pid}-${tag}.mjs`);

const plain = copyOf('plain');
fs.writeFileSync(plain, original);
let baseline;
try {
  baseline = run(plain);
} finally {
  fs.rmSync(plain, { force: true });
}
if (!baseline) {
  console.log('깨지 않은 사본이 장면 시험에 떨어졌다 — 변형을 돌리지 않는다');
  process.exit(2);
}

let survived = 0;
let broken = 0;
let ran = 0;
for (const [index, [branch, name, from, to]] of TODAY_MUTANTS.entries()) {
  if (only && branch !== only) continue;
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.log(`목록 오류 · ${branch} · ${name} — 바꿀 글이 ${count}번 있다`);
    broken += 1;
    continue;
  }
  const copy = copyOf(index);
  fs.writeFileSync(copy, original.replace(from, to));
  try {
    ran += 1;
    const caught = !run(copy);
    if (!caught) survived += 1;
    console.log(`${caught ? '잡음' : '살아남음'} · ${branch} · ${name}`);
  } finally {
    fs.rmSync(copy, { force: true });
  }
}
console.log(`변형 ${ran} · 살아남음 ${survived} · 목록 오류 ${broken}`);
process.exit(broken ? 2 : survived ? 1 : 0);
