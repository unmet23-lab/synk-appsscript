#!/usr/bin/env node
// 4-3 홈 세 줄(world-today.mjs)의 변형 시험(Atlas 재설계 단계4_계획 §20-10 「변형」). 홈 쪽 층의 규칙을 하나씩 일부러 깬 사본을 같은 폴더에
// 만들어 장면 시험(qa/atlas-next-home.test.mjs · 4-4b의 qa/atlas-next-plan.test.mjs)이 잡는지 본다. 원본은 건드리지 않는다. 사본은 점으로 시작하는 이름(서버가 내지 않는다)이고
// 끝나면 지운다. 장면 시험은 SYNK_TODAY_MODULE이 가리키는 사본을 받는다. 깨지 않은 사본이 먼저 통과해야 변형을 돌린다(사본을 못 받아
// 모든 변형이 「잡음」이 되는 일을 막는다). 홈 쪽 층의 규칙을 더하거나 고치면 여기에 깬 변형을 함께 더한다.
// 4-6e-1(§25-1)부터 홈 게임 목록(world-home-games.mjs)의 변형도 둔다 — 다섯째 칸이 그 파일 이름인 변형은 그 파일의 깬 사본을 만들고, 홈 사본이 그
// 사본을 부르게 import를 바꾼다. 장면 시험은 SYNK_HOME_GAMES_MODULE로 같은 사본을 받는다.
// 쓰는 법: node experiences/synk-world-app/qa/today-mutants.mjs [--갈래 <갈래>]
// 종료코드: 0 = 모든 변형을 잡음 · 1 = 살아남은 변형이 있음 · 2 = 목록 오류 또는 깨지 않은 사본이 장면 시험에 떨어짐
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, '..', 'world-today.mjs');
const GAMES_FILE = 'world-home-games.mjs';
const gamesSource = path.join(here, '..', GAMES_FILE);
const scenes = [path.join(here, 'atlas-next-home.test.mjs'), path.join(here, 'atlas-next-plan.test.mjs')];
// 갈래마다 더 도는 장면 — 점검 칸의 차례 돌리기는 이레 측정(진짜 셸과 엔진 코치로 이레를 날마다 연다 — 느려서 그 갈래만)이 잡는다(설계 주인 11-17 저녁 답 1).
const BRANCH_SCENES = Object.freeze({ '점검 칸 돌리기': [path.join(here, 'atlas-next-check-week.test.mjs')] });

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
    '  const { rows, capped } = todayRows({ entries, activities, opened, say, dayCapped: live ? planned.capped : undefined, shift, due: dueRows, lang });\n',
    '  const { rows, capped } = todayRows({ entries, activities, opened, say, shift, due: dueRows, lang });\n',
  ],
  [
    '빈 날',
    '상한 날의 복습 칸 활동이 걸려도 조건에 걸린 날로 센다 — 풀려도 줄이 아닌데 조건을 바꾸라고 한다(Fable 엔진급 끝 판 F5)',
    // 4-4b에서 소리를 끈 날의 듣기 숙제(dry — 카본 A10)가 같은 줄에 들어왔다. 이 변형은 상한 날의 거름만 뺀다.
    "    act => act.blocked && !dry.has(act.plan.id) && !(capped && act.kind === 'again' && !act.open.resume),\n",
    '    act => act.blocked && !dry.has(act.plan.id),\n',
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
  [
    '짧은 연습 후보',
    '돌아온 단위가 없는 문항까지 넘긴다',
    '    if (!fresh.length) continue;\n    for (const unit of fresh) seen.add(unit);\n',
    '    for (const unit of fresh) seen.add(unit);\n',
  ],
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
    'export function todayKey(now = Date.now()) {\n  const at = new Date(now);\n  if (at.getHours() < DAY_START_HOUR) at.setDate(at.getDate() - 1);\n',
    'export function todayKey(now = Date.now()) {\n  const at = new Date(now - DAY_START_HOUR * 3_600_000);\n',
  ],
  [
    'Core 거름',
    '소리를 끈 날 듣기 짧은 연습을 잠그지 않고 뺀다 — 듣기 연습만 남은 날을 다 한 날로 적는다(카본 엔진급 끝 판 B1)',
    "    if (typeof item?.itemKey !== 'string' || typeof item.skillId !== 'string') continue;\n    const units = (quiet(() => itemUnits(item.itemKey)) ?? []).map(row => row?.unit);\n",
    "    if (typeof item?.itemKey !== 'string' || typeof item.skillId !== 'string') continue;\n    if (settings.audioAvailable === false && item.skillId.split('.')[1] === 'listening') continue;\n    const units = (quiet(() => itemUnits(item.itemKey)) ?? []).map(row => row?.unit);\n",
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
  // 4-4b 이번 주 계획(단계4_계획 §21-6) — 숙제 연습 · 점검 칸 · 이번 주 계획 싣기. 설계 주인이 짚은 「숙제 연습의 층 9 거름을 뺌」이 첫 줄이다.
  [
    "숙제 연습 줄",
    "맨 앞 층이 9(낼 것 없음)여도 숙제 연습 줄을 세운다 — 숙제 문장만 있고 낼 문항이 없는 줄(설계 주인 11-15)",
    "  if (act.role === 'homework') return entry.none ? null : entry.why;\n",
    "  if (act.role === 'homework') return entry.why;\n",
  ],
  [
    "숙제 연습 줄",
    "숙제 연습을 층으로 가른다 — 층 3 · 4의 상태 없는 숙제가 홈에 서지 않는다(카본 A9)",
    "  if (act.role === 'homework') return entry.none ? null : entry.why;\n",
    "  if (act.role === 'homework') return entry.none || entry.tier > 2 ? null : entry.why;\n",
  ],
  [
    "숙제 연습 줄",
    "상한 날에는 숙제 연습 줄을 세우지 않는다 — 상한은 복습만 미룬다(20-3)",
    "  if (act.role === 'homework') return entry.none ? null : entry.why;\n",
    "  if (act.role === 'homework') return entry.none || capped ? null : entry.why;\n",
  ],
  [
    "숙제 연습 후보",
    "돌아온 단위가 든 문항을 빼지 않는다 — 그 단위는 복습 칸의 짧은 연습이 맡는다(검토 D3)",
    "        quiet(() => fresh(item)) === true &&\n        !returned(item.itemKey),\n",
    "        quiet(() => fresh(item)) === true,\n",
  ],
  [
    "숙제 연습 후보",
    "처음 보는 문항이 아닌 것도 넘긴다",
    "        quiet(() => fresh(item)) === true &&\n        !returned(item.itemKey),\n",
    "        !returned(item.itemKey),\n",
  ],
  [
    "숙제 목표",
    "상태 없는 숙제를 놓친 답으로 넘긴다 — 사실이 아닌 숙제 문장을 짓는다(§21-6)",
    "    const goal = { kind: 'homework', skill: skillId, ...(typeof row.status === 'string' ? { status: row.status } : {}) };\n",
    "    const goal = { kind: 'homework', skill: skillId, status: row.status ?? 'missed' };\n",
  ],
  [
    "숙제 연습 칸",
    "숙제 연습을 복습 칸에 세운다",
    "      activity('new', open, { goals: [goal] }, items.map(item => ({ itemKey: item.itemKey })), settings, 'homework'),\n",
    "      activity('again', open, { goals: [goal] }, items.map(item => ({ itemKey: item.itemKey })), settings, 'homework'),\n",
  ],
  [
    "숙제 연습 잠김",
    "소리를 끈 날 듣기 숙제를 잠그지 않고 뺀다",
    "    if (typeof skillId !== 'string' || !['listening', 'reading'].includes(row.domain)) continue;\n",
    "    if (typeof skillId !== 'string' || !['listening', 'reading'].includes(row.domain) || (settings.audioAvailable === false && row.domain === 'listening')) continue;\n",
  ],
  [
    "소리 끈 날",
    "소리를 끈 날의 듣기 숙제를 한 번 더 셈하지 않는다 — 새 단위 한도에 막힌 날을 조건에 걸린 날로 적는다(카본 A10)",
    "      if (Array.isArray(again) && again[0]?.none) dry.add(act.plan.id);\n",
    "",
  ],
  [
    "소리 끈 날",
    "한 번 더 셈한 결과와 상관없이 조건에서 뺀다 — 소리를 켜면 낼 것이 있는 날을 다 한 날로 적는다",
    "      if (Array.isArray(again) && again[0]?.none) dry.add(act.plan.id);\n",
    "      dry.add(act.plan.id);\n",
  ],
  [
    "소리 끈 날",
    "다시 셈을 소리 조건에만 한다 — 시간 조건에 걸린 낼 것 없는 숙제를 조건에 걸린 날로 적는다(4-4b 끝 판 Fable F2)",
    "      if (act.role !== 'homework' || !act.blocked || !act.unlocked) continue;\n",
    "      if (act.role !== 'homework' || act.blocked !== 'audio.unavailable' || !act.unlocked) continue;\n",
  ],
  [
    "점검 칸",
    "진단이 낼 문항이 없어도 짧은 진단 줄을 세운다",
    "  if (!area || !(area.remaining > 0) || week.diagnostic?.ready !== true) return null;\n",
    "  if (!area || !(area.remaining > 0)) return null;\n",
  ],
  [
    "점검 칸",
    "이번 주 다시 확인을 마쳐도 짧은 진단 줄을 세운다",
    "  if (!area || !(area.remaining > 0) || week.diagnostic?.ready !== true) return null;\n",
    "  if (!area || week.diagnostic?.ready !== true) return null;\n",
  ],
  [
    "점검 칸",
    "시작점이어도 다시 확인 문장을 쓴다",
    "  const start = Array.isArray(plan.notes) && plan.notes.includes('start');\n",
    "  const start = false;\n",
  ],
  [
    "점검 칸",
    "후보 없이 넘긴 짧은 진단을 낼 것 없음으로 보고 줄에서 뺀다",
    "  if (act.role === 'check') return entry.why;\n",
    "",
  ],
  [
    "이번 주 계획",
    "확인 중에도 이번 주 계획을 싣는다",
    "    examPlan: live ? (week?.examPlan ?? null) : null,\n",
    "    examPlan: week?.examPlan ?? null,\n",
  ],
  [
    "이번 주 계획",
    "홈 계획이 이번 주 계획을 싣지 않는다 — 계획 입구 · 알림이 읽을 계획이 없다",
    "    examPlan: live ? (week?.examPlan ?? null) : null,\n",
    "    examPlan: null,\n",
  ],
  [
    '판 셋',
    "판 감시가 받은 코치의 받기 알림을 듣지 않는다 — 요약이 자리를 잡아도 타이머(3초부터 60초)까지 확인 중이다(받기 알림 설계 검토 D7)",
    "    offSettle = quiet(() =>\n      typeof made.watch === 'function'\n        ? made.watch(() => {\n            if (disposed || at !== generation || coach !== made) return;\n            if (!settled(quiet(() => made.summary()))) return;\n            stopSettle();\n            settleWait = every;\n            queueMicrotask(() => {\n              if (!disposed && at === generation && coach === made) changed();\n            });\n          })\n        : null,\n    );\n",
    "",
  ],
  [
    '판 셋',
    "받기 알림을 걸어도 타이머를 남긴다 — 자리를 잡기를 기다리는 길이 다시 둘이 된다(받기 알림 설계 검토 D7 · 설계 주인 조건 4)",
    "    if (typeof offSettle === 'function') return;\n",
    "",
  ],
  [
    '판 셋',
    "판 감시가 자리를 잡은 알림을 받은 자리에서 바로 그린다 — 엔진의 알림 도중에 홈을 다시 짓는다(§21-20 조건 3 · 4-4b 다시 검수 -d Fable P3)",
    "            queueMicrotask(() => {\n              if (!disposed && at === generation && coach === made) changed();\n            });\n",
    "            changed();\n",
  ],
  [
    '확인 중',
    '확인 중 판이 계획이 넘긴 활동(숙제 연습 · 점검 칸)의 설명을 다음 레슨으로 읽는다(Fable 끝 판 F10)',
    '    .filter(act => !act.role && rank(act) < 3)\n',
    '    .filter(act => rank(act) < 3)\n',
  ],
  // ── 점검 칸 넷(4-4d — 단계4_계획 §21-23의 3, 설계 주인 11-17 답 3 · 4): 시험 형식 · 쓰기 · 말하기 줄, 제품 차례, 계획 목표의 범위 ──
  [
    '점검 칸 넷',
    "같은 자리의 점검 칸을 두뇌 차례(활동 id 사전 순)로 둔다 — 제품 차례를 뺀다(설계 주인 11-17 답 3)",
    "  entries = gamesBehind(checkOrdered(Array.isArray(entries) ? entries : [], byId, shift), byId);\n",
    "  entries = gamesBehind(Array.isArray(entries) ? entries : [], byId);\n",
  ],
  [
    '점검 칸 넷',
    "제품 차례에서 시험 형식과 쓰기를 바꾼다",
    "export const CHECK_ORDER = Object.freeze(['world.position.check', 'world.mock', 'topik2-writing-53', 'world.speaking.check']);",
    "export const CHECK_ORDER = Object.freeze(['world.position.check', 'topik2-writing-53', 'world.mock', 'world.speaking.check']);",
  ],
  [
    '점검 칸 넷',
    "제품 차례로 가를 때 두뇌의 맞춘 목표 수를 보지 않는다 — 목표를 맞춘 줄이 앞서지 못한다",
    "  -(entry.goals ?? 0),\n",
    "",
  ],
  [
    '점검 칸 넷',
    "쓰기에 한 가지 고치기의 목표를 싣지 않는다",
    "        goals: [...areaGoal(week, 'writing'), { kind: 'practiceNeed', id: writing.focus }],\n",
    "        goals: areaGoal(week, 'writing'),\n",
  ],
  [
    '점검 칸 넷',
    "말하기에 다음 영역의 목표를 싣지 않는다",
    "      ? { describe: { key: 'speaking', slots: { type: speaking.type, untried: speaking.untried } }, goals: areaGoal(week, 'speaking') }\n",
    "      ? { describe: { key: 'speaking', slots: { type: speaking.type, untried: speaking.untried } }, goals: [] }\n",
  ],
  [
    '점검 칸 넷',
    "짧은 진단에 다음 영역의 목표를 싣지 않는다",
    "    { describe: start ? 'start' : 'recheck', goals: areaGoal(week, 'recheck') },\n",
    "    { describe: start ? 'start' : 'recheck' },\n",
  ],
  [
    '점검 칸 넷',
    "다음 영역이 아닌 점검 칸 활동에도 영역 목표를 싣는다",
    "  week?.examPlan?.next?.area === area ? [{ kind: `plan.area.${area}` }] : [];\n",
    "  week?.examPlan?.next?.area ? [{ kind: `plan.area.${week.examPlan.next.area}` }] : [];\n",
  ],
  [
    '점검 칸 넷',
    "이번 주에 시험 형식 판을 했어도 시험 형식 줄을 세운다",
    "  if (!mock || mock.done === true || !Number.isFinite(mock.minutes)) return null;\n",
    "  if (!mock || !Number.isFinite(mock.minutes)) return null;\n",
  ],
  [
    '점검 칸 넷',
    "시험 형식의 분을 싣지 않는다 — 시간 설정에 걸리지 않는다",
    "      minutes: mock.minutes,\n",
    "",
  ],
  [
    '점검 칸 넷',
    "시험 형식의 소리 요구를 버린다 — 소리를 끈 날 듣기가 든 판이 선다",
    "      audioRequired: mock.audioRequired === true,\n",
    "      audioRequired: false,\n",
  ],
  [
    '점검 칸 넷',
    "말하기가 소리를 요구하지 않는다 — 소리를 끈 날 말하기 줄이 선다",
    "    goals: ['exam', 'prepare', 'speaking'],\n    audioRequired: true,\n",
    "    goals: ['exam', 'prepare', 'speaking'],\n    audioRequired: false,\n",
  ],
  [
    '점검 칸 넷',
    "이번 주에 여섯 유형을 다 해 본 말하기에도 칸이 있는 문장을 고른다 — 칸이 틀려 줄이 서지 않는다",
    "    speaking.untried > 0\n",
    "    speaking.untried >= 0\n",
  ],
  [
    '점검 칸 넷',
    "쓰기 줄의 이번 주 몫 막이를 뺀다 — 쓰기가 계획을 넘어 매일 서고 말하기 차례가 오지 않는다(이레 측정 · 설계 주인 11-17 다시 여쭘의 답 1)",
    "  if (!writing || typeof writing.routeId !== 'string' || !areaLeft(week, 'writing')) return null;\n",
    "  if (!writing || typeof writing.routeId !== 'string') return null;\n",
  ],
  [
    '점검 칸 넷',
    "말하기 줄의 이번 주 몫 막이를 뺀다",
    "  if (!speaking || typeof speaking.routeId !== 'string' || !areaLeft(week, 'speaking')) return null;\n",
    "  if (!speaking || typeof speaking.routeId !== 'string') return null;\n",
  ],
  // 보탬을 막는 몫(끝 판 검수 GPT GE1 — 설계 주인 11-17 오후 답): 계획이 낸 넷을 고르게 본다. 쓰기 항을 빼는 변형은 동등 변형이라 두지 않는다
  // (보탬도 쓰기 값이 있어야 서고, 그 값이 있으면 쓰기 몫이 남은 날 쓰기 줄이 넘어간다 — world-today.mjs checkLeft 주석).
  [
    '점검 칸 넷',
    "보탬을 막는 몫이 다시 확인을 보지 않는다 — 진단이 낼 문항이 없는 날 다시 확인 몫이 남았는데 보탬이 선다(장면 나 · GPT GE1)",
    "  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking');\n",
    "  mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking');\n",
  ],
  [
    '점검 칸 넷',
    "보탬을 막는 몫이 시험 형식을 보지 않는다 — 판의 분을 읽지 못한 날 시험 형식 몫이 남았는데 보탬이 선다(장면 나)",
    "  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking');\n",
    "  areaLeft(week, 'recheck') || areaLeft(week, 'writing') || areaLeft(week, 'speaking');\n",
  ],
  [
    '점검 칸 넷',
    "보탬을 막는 몫이 말하기를 보지 않는다 — 말하기 값이 없는 날 말하기 몫이 남았는데 보탬이 선다(장면 나)",
    "  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking');\n",
    "  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing');\n",
  ],
  [
    '점검 칸 넷',
    "소리 때문에 계획에서 빠진 말하기를 남은 몫으로 본다(되돌린 안 1) — 소리를 끈 주에 보탬 대신 빈 점검 칸이 된다(장면 가)",
    "  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking');\n",
    "  areaLeft(week, 'recheck') || mockLeft(week) || areaLeft(week, 'writing') || areaLeft(week, 'speaking') || Boolean(week?.examPlan?.notes?.includes('speaking-audio-off'));\n",
  ],
  [
    '점검 칸 넷',
    "시험 형식 몫이 이번 주에 한 판을 가리지 않는다 — 판을 마친 주에도 몫이 남은 것으로 보아 보탬이 서지 않는다(장면 가)",
    "const mockLeft = week => Boolean(week?.mock) && week.mock.done !== true;\n",
    "const mockLeft = week => Boolean(week?.mock);\n",
  ],
  [
    '점검 칸 넷',
    "시험 형식 판이 없는 주도 몫이 남은 것으로 본다 — 시험 형식을 낼 수 없는 주에 보탬이 서지 않는다",
    "const mockLeft = week => Boolean(week?.mock) && week.mock.done !== true;\n",
    "const mockLeft = week => week?.mock?.done !== true;\n",
  ],
  [
    '점검 칸 넷',
    "보탬이 몫을 보지 않고 넘길 줄만 본다 — 몫이 남았는데 넘길 줄이 없는 날에도 보탬이 선다(장면 나 · GPT GE1)",
    "    if (checks.length === 0 && !checkLeft(week)) checks.push(writingFixActivity(week, normalized));\n",
    "    if (checks.length === 0) checks.push(writingFixActivity(week, normalized));\n",
  ],
  [
    '점검 칸 넷',
    "몫을 남은 수가 아니라 계획 수로 본다 — 채운 영역도 남은 것으로 본다",
    "  return Boolean(row) && row.remaining > 0;\n",
    "  return Boolean(row) && row.planned > 0;\n",
  ],
  [
    '점검 칸 넷',
    "보탬이 다른 줄이 설 수 있는 날에도 선다 — 이번 주 쓰기에서 열린 고치기가 말하기를 민다(설계 주인 11-17 다시 여쭘의 답 2)",
    "    if (checks.length === 0 && !checkLeft(week)) checks.push(writingFixActivity(week, normalized));\n",
    "    checks.push(writingFixActivity(week, normalized));\n",
  ],
  [
    '점검 칸 넷',
    "보탬을 세우지 않는다 — 몫이 모두 찬 날 이번 주에 열린 고치기가 다음 주까지 식는다",
    "    if (checks.length === 0 && !checkLeft(week)) checks.push(writingFixActivity(week, normalized));\n",
    "",
  ],
  [
    '점검 칸 넷',
    "보탬이 이번 주 쓰기에서 열린 고치기인지 보지 않는다 — 지난주에 열린 고치기도 선다",
    "  if (!(at >= bounds.start && at < bounds.end)) return null;\n",
    "",
  ],
  // ── 점검 칸 돌리기(4-4d — 설계 주인 11-17 저녁 답 1): 밀린 날 수만큼 넘길 수 있는 줄을 돌린다. 이레 측정의 장면 셋이 잡는다. ──
  [
    '점검 칸 돌리기',
    '밀린 날 수를 늘 0으로 둔다 — 하지 않은 줄이 이레 내내 맨 앞에 선다(시험 형식만 하지 않는 학생 장면이 잡는다)',
    '  return Math.max(0, day - 1 - done);\n',
    '  return 0;\n',
  ],
  [
    '점검 칸 돌리기',
    '「− 1」을 뺀다 — 줄을 따르는 학생도 첫날부터 돈다(따르는 학생 장면이 잡는다)',
    '  return Math.max(0, day - 1 - done);\n',
    '  return Math.max(0, day - done);\n',
  ],
  [
    '점검 칸 돌리기',
    '시험 형식 판을 한 수로 세지 않는다 — 시험 형식을 한 학생도 다음 날부터 하루씩 밀린다',
    '  let done = mock;\n',
    '  let done = 0;\n',
  ],
  [
    '점검 칸 돌리기',
    '잠긴 줄도 돌린다 — 조건에 걸린 줄이 오늘의 줄 자리에 선다',
    '  const open = sorted.filter(entry => !entry.locked);\n',
    '  const open = sorted;\n',
  ],
  // ── 복습 칸의 게임(4-6e-1 — 단계4_계획 §25-1): 장면 시험(qa/atlas-next-home.test.mjs의 4-6e-1 절)이 잡는다. ──
  [
    '게임',
    '단위마다 하나를 풀어 돌아온 단위가 든 문항을 모두 넘긴다',
    '        const fresh = row.due.filter(unit => !covered.has(unit) && !owned(unit));\n',
    '        const fresh = row.due.filter(unit => !owned(unit));\n',
  ],
  [
    '게임',
    '게임 활동에 목표를 넘긴다 — 맞춘 목표 수가 할 것의 수보다 먼저 갈라 생활 복습을 앞지른다',
    "    if (items.length) out.push({ ...activity('again', game.open, {}, items, settings), assigned: Object.freeze(assigned) });\n",
    "    if (items.length) out.push({ ...activity('again', game.open, { goals: goalsOf(game.open, settings) }, items, settings), assigned: Object.freeze(assigned) });\n",
  ],
  [
    '게임',
    '배정 단위 대신 전체 단위로 이유 짓기 — 두뇌가 문항의 모든 단위로 지은 이유(짧은 연습 몫 S340)를 게임 줄이 그대로 말한다(GB2 결정)',
    "  if (open.route === 'game') return entry.tier === 1 ? gameWhy(entry, act, { say, due, lang }) : null;\n",
    "  if (open.route === 'game') return entry.tier === 1 ? entry.why : null;\n",
  ],
  [
    '게임',
    '맡은 단위에 이름이 없으면 다른 활동 몫의 이름을 빌린다 — 두뇌의 이유로 물러선다(GB2 결정 2)',
    '  return { ...why, line: line || (Object.hasOwn(GAME_NAMELESS, lang) ? GAME_NAMELESS[lang] : GAME_NAMELESS.ko) };\n',
    '  return line ? { ...why, line } : entry.why;\n',
  ],
  [
    '게임',
    '맡은 단위의 이름을 say에 넘기지 않는다 — 셸 이름표는 단위 이름을 몰라 늘 이름 없는 줄이 된다',
    '  const line = named ? quiet(() => say(why, id => (id === named.unit ? named.label : null))) : null;\n',
    '  const line = named ? quiet(() => say(why)) : null;\n',
  ],
  [
    '게임',
    '놓친 적이 있어도 unit.due로 짓는다 — 두뇌 dueReason과 다른 꼴',
    '  return row.lapses > 0\n',
    '  return false\n',
  ],
  [
    '게임',
    '짧은 연습 먼저를 뺀다 — 짧은 연습 풀의 단위도 게임이 함께 센다',
    '  const owned = unit => taken.life.has(unit) || taken.practice.has(unit);\n',
    '  const owned = unit => taken.life.has(unit);\n',
  ],
  [
    '게임',
    '생활 먼저를 뺀다 — 그날 생활 복습이 실은 단위도 게임이 함께 센다',
    '  const owned = unit => taken.life.has(unit) || taken.practice.has(unit);\n',
    '  const owned = unit => taken.practice.has(unit);\n',
  ],
  [
    '게임',
    '게임 사이 단위 나눔을 뺀다 — 앞 게임이 맡은 단위를 뒤 게임이 다시 센다',
    '    const picked = new Set();\n',
    '    const picked = new Set();\n    const covered = new Set();\n',
  ],
  [
    '게임',
    '첫 훑기에서 같은 게임이 앞에서 맡은 단위도 다른 활동 몫으로 센다 — 함께 실은 문항이 밀려 다른 활동 몫 문항을 고른다',
    '        if (pure && row.due.some(unit => owned(unit) || earlier.has(unit))) continue;\n',
    '        if (pure && row.due.some(unit => owned(unit) || covered.has(unit))) continue;\n',
  ],
  [
    '게임',
    '다른 활동이 맡은 단위가 없는 문항 먼저를 뺀다 — 두뇌가 다른 활동 몫의 단위로 이유를 짓는다',
    '    for (const pure of [true, false])\n',
    '    for (const pure of [false])\n',
  ],
  [
    '게임',
    '게임 뒤로 보내기를 뺀다 — 두뇌의 사전 순 차례로 게임이 생활 복습 · 짧은 연습을 앞지른다',
    '  entries = gamesBehind(checkOrdered(Array.isArray(entries) ? entries : [], byId, shift), byId);\n',
    '  entries = checkOrdered(Array.isArray(entries) ? entries : [], byId, shift);\n',
  ],
  [
    '게임',
    '게임 뒤로 보내기가 목표 수 · 할 것의 수까지 본다 — 맡은 단위가 많은 게임이 앞에 남는다',
    '    const [locked, fact, tier] = brainKey(entry);\n    const key = `${locked}|${fact}|${tier}`;\n',
    "    const key = brainKey(entry).join('|');\n",
  ],
  ['게임', '층 2의 게임도 줄로 세운다', "  if (open.route === 'game') return entry.tier === 1 ? gameWhy(entry, act, { say, due, lang }) : null;\n", "  if (open.route === 'game') return entry.tier <= 2 ? gameWhy(entry, act, { say, due, lang }) : null;\n"],
  [
    '게임',
    '상한 날에도 게임 줄을 세운다',
    "  if (open.route === 'lesson') {\n",
    "  if (open.route === 'game' && entry.tier === 1) return entry.why;\n  if (open.route === 'lesson') {\n",
  ],
  [
    '게임',
    '소리를 끈 날 게임을 잠그지 않고 뺀다 — 게임에만 돌아온 단위가 있는 날이 조건에 걸린 날이 아니라 다 한 날로 보인다',
    "    if (items.length) out.push({ ...activity('again', game.open, {}, items, settings), assigned: Object.freeze(assigned) });\n",
    "    if (items.length && settings.audioAvailable !== false) out.push({ ...activity('again', game.open, {}, items, settings), assigned: Object.freeze(assigned) });\n",
  ],
  [
    '게임',
    '오늘 공부 칸에 자유 게임을 넘긴다',
    "    if (items.length) out.push({ ...activity('again', game.open, {}, items, settings), assigned: Object.freeze(assigned) });\n",
    "    if (items.length) out.push({ ...activity('new', game.open, {}, items, settings), assigned: Object.freeze(assigned) });\n",
  ],
  [
    '게임',
    '손님에게 닫힌 게임을 빼지 않고 잠가 넘긴다 — 그날을 조건에 걸린 날로 센다',
    '    if (!gameId || candidate.available === false) continue;\n',
    '    if (!gameId) continue;\n',
    GAMES_FILE,
  ],
  [
    '게임',
    '환승 난도를 목표 급으로만 정한다 — 저장한 난도를 보지 않는다',
    '          : SUBWAY_ITEMS[subwayLevel({ saved: savedSubwayLevel(storage), grade: settings?.targetGrade })];\n',
    '          : SUBWAY_ITEMS[subwayLevel({ grade: settings?.targetGrade })];\n',
    GAMES_FILE,
  ],
  [
    '게임',
    '환승 문항을 옛 후보 함수의 급 거름으로 되돌린다 — 게임이 내지 않는 결정도 싣는다',
    '          : SUBWAY_ITEMS[subwayLevel({ saved: savedSubwayLevel(storage), grade: settings?.targetGrade })];\n',
    '          : Object.freeze((candidate.targets ?? []).map(targetRow));\n',
    GAMES_FILE,
  ],
];

// 시험 묶음 안에서 이 실행기를 불러도 장면 시험이 돌게 NODE_TEST_CONTEXT를 지운다 — 두면 node가 「겹쳐 부른 시험」으로 보고 파일을 하나도
// 돌리지 않은 채 0으로 끝나, 깨지 않은 사본의 확인은 통과하고 모든 변형이 살아남은 것으로 보인다(4-4b 끝 판 GPT GB2 — position-mutants와 같은 고침).
// 통과는 종료 코드 0이면서 통과한 시험이 하나 이상일 때다.
function run(copy, more = [], games = null) {
  const env = { ...process.env, SYNK_TODAY_MODULE: copy, ...(games ? { SYNK_HOME_GAMES_MODULE: games } : {}) };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...scenes, ...more], {
    env,
    encoding: 'utf8',
  });
  return result.status === 0 && /^# pass [1-9]/m.test(result.stdout ?? '');
}

const original = fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
const gamesOriginal = fs.readFileSync(gamesSource, 'utf8').replace(/\r\n/g, '\n');
// 없는 갈래 이름이면 아무 변형도 돌리지 않고 0으로 끝나던 것을 멈춘다(4-4b 끝 판 GPT GB1).
const at = process.argv.indexOf('--갈래');
const only = at >= 0 ? process.argv[at + 1] : null;
const BRANCHES = [...new Set(TODAY_MUTANTS.map(([branch]) => branch))];
if (at >= 0 && !BRANCHES.includes(only)) {
  console.log(`없는 갈래다: ${only ?? '(빈 값)'} — ${BRANCHES.join(' · ')} 가운데 하나를 준다`);
  process.exit(2);
}
const copyOf = tag => path.join(here, '..', `.mutant-world-today-${process.pid}-${tag}.mjs`);

const plain = copyOf('plain');
fs.writeFileSync(plain, original);
let baseline;
try {
  // 깨지 않은 사본은 이번에 돌 갈래의 장면을 모두 돈다(갈래를 주지 않으면 모든 갈래의 장면).
  baseline = run(plain, only ? (BRANCH_SCENES[only] ?? []) : [...new Set(Object.values(BRANCH_SCENES).flat())]);
} finally {
  fs.rmSync(plain, { force: true });
}
if (!baseline) {
  console.log('깨지 않은 사본이 장면 시험에 떨어졌다 — 변형을 돌리지 않는다');
  process.exit(2);
}
// 게임 목록 변형은 따로 적재 길(게임 목록 사본 · 홈 사본의 import 바꾸기 · SYNK_HOME_GAMES_MODULE)을 탄다. 그 길도 깨지 않은 사본으로 먼저
// 통과해야 그 변형들을 돌린다 — 사본을 못 받아 모든 게임 목록 변형이 「잡음」이 되는 일을 막는다.
const GAMES_IMPORT = `import { homeGames } from './${GAMES_FILE}';`;
if (TODAY_MUTANTS.some(([branch, , , , file]) => file && (!only || branch === only))) {
  const plainGames = path.join(here, '..', `.mutant-world-home-games-${process.pid}-plain.mjs`);
  const plainToday = copyOf('plain-games');
  fs.writeFileSync(plainGames, gamesOriginal);
  fs.writeFileSync(plainToday, original.replace(GAMES_IMPORT, `import { homeGames } from './${path.basename(plainGames)}';`));
  let gamesBaseline;
  try {
    gamesBaseline = original.split(GAMES_IMPORT).length === 2 && run(plainToday, [], plainGames);
  } finally {
    fs.rmSync(plainGames, { force: true });
    fs.rmSync(plainToday, { force: true });
  }
  if (!gamesBaseline) {
    console.log('깨지 않은 게임 목록 사본이 장면 시험에 떨어졌다 — 변형을 돌리지 않는다');
    process.exit(2);
  }
}

let survived = 0;
let broken = 0;
let ran = 0;
for (const [index, [branch, name, from, to, file = null]] of TODAY_MUTANTS.entries()) {
  if (only && branch !== only) continue;
  if (file && file !== GAMES_FILE) {
    console.log(`목록 오류 · ${branch} · ${name} — 모르는 파일 ${file}`);
    broken += 1;
    continue;
  }
  const target = file ? gamesOriginal : original;
  const count = target.split(from).length - 1;
  if (count !== 1) {
    console.log(`목록 오류 · ${branch} · ${name} — 바꿀 글이 ${count}번 있다`);
    broken += 1;
    continue;
  }
  const copy = copyOf(index);
  // 게임 목록의 변형: 그 파일의 깬 사본을 만들고, 홈 사본이 그 사본을 부르게 import를 바꾼다.
  const games = file ? path.join(here, '..', `.mutant-world-home-games-${process.pid}-${index}.mjs`) : null;
  const importLine = GAMES_IMPORT;
  if (games && original.split(importLine).length !== 2) {
    console.log(`목록 오류 · ${branch} · ${name} — 홈의 게임 목록 import를 못 찾았다`);
    broken += 1;
    continue;
  }
  if (games) fs.writeFileSync(games, gamesOriginal.replace(from, to));
  fs.writeFileSync(copy, games ? original.replace(importLine, `import { homeGames } from './${path.basename(games)}';`) : original.replace(from, to));
  try {
    ran += 1;
    const caught = !run(copy, BRANCH_SCENES[branch] ?? [], games);
    if (!caught) survived += 1;
    console.log(`${caught ? '잡음' : '살아남음'} · ${branch} · ${name}`);
  } finally {
    fs.rmSync(copy, { force: true });
    if (games) fs.rmSync(games, { force: true });
  }
}
console.log(`변형 ${ran} · 살아남음 ${survived} · 목록 오류 ${broken}`);
if (!ran && !broken) {
  console.log('돌린 변형이 없다 — 목록이나 갈래를 확인한다');
  process.exit(2);
}
process.exit(broken ? 2 : survived ? 1 : 0);
