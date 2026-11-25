#!/usr/bin/env node
// 4-4b 이번 주 계획 새 판의 변형 시험(Atlas 재설계 단계4_계획 §21-11 「변형」). 계획 셈의 읽개 갈래(world-exam-plan.mjs), 새 계획 모듈
// (world-plan-next.mjs — 읽개 · 시작점 · 기기 판 기록), 셸의 배선(world-learning-ui.mjs — 묶음 만남 다시 묻기 · 판 기록 · 받기 알림)의 규칙을 하나씩 일부러 깬
// 사본을 같은 폴더에 만들어 장면 시험이 잡는지 본다. 홈 계획(world-today.mjs)의 4-4b 변형은 qa/today-mutants.mjs에 있다. 원본은 건드리지 않는다.
// 사본은 점으로 시작하는 이름(서버가 내지 않는다)이고 끝나면 지운다. 장면 시험은 갈래마다 정한 환경 변수가 가리키는 사본을 받는다. 깨지 않은
// 사본이 먼저 통과해야 그 갈래의 변형을 돌린다(사본을 못 받아 모든 변형이 「잡음」이 되는 일을 막는다). 4-4b의 계획 규칙을 더하거나 고치면 여기에
// 깬 변형을 함께 더한다. 지금 판의 셈(읽개 없는 호출)을 바꾸는 변형은 고치기 전 함수와의 대조(qa/world-exam-plan-reader.test.mjs)가 잡는다.
// 4-6e-2의 게임 판의 한 수와 곁 기록의 열쇠(§25-3 불변식 나 · 가)도 같은 꼴로 본다 — 게임 문의 겉(world-atlas-game.mjs)은 game 갈래, 입구의 판 끝
// 적기 · 세대 읽기 · 세대 쓸기 · 기록이 바뀐 셈(world-atlas-next.mjs)은 entry 갈래, 길 표의 셸 배선은 routes 갈래가 잡는지 본다. 한 변형이 두 자리를
// 함께 바꿔야 하면 바꿀 글과 바꾼 글을 같은 길이의 목록으로 둔다(차례대로 바꾼다).
// 쓰는 법: node experiences/synk-world-app/qa/plan-mutants.mjs [--갈래 exam|next|shell|week|game|routes|entry]
// 종료코드: 0 = 모든 변형을 잡음 · 1 = 살아남은 변형이 있음 · 2 = 목록 오류 또는 깨지 않은 사본이 장면 시험에 떨어짐
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PLAN_SOURCES = Object.freeze({
  exam: { file: 'world-exam-plan.mjs', env: 'SYNK_EXAM_PLAN_MODULE', scenes: ['atlas-next-plan.test.mjs', 'world-exam-plan-reader.test.mjs'] },
  next: { file: 'world-plan-next.mjs', env: 'SYNK_PLAN_NEXT_MODULE', scenes: ['atlas-next-plan.test.mjs'] },
  shell: { file: 'world-learning-ui.mjs', env: 'SYNK_LEARNING_UI_MODULE', scenes: ['atlas-next-plan-shell.test.mjs', 'atlas-next-practice-shell.test.mjs', 'atlas-next-home-shell.test.mjs'] },
  // 같은 셸을 이레 측정(4-4d — 진짜 엔진과 셸로 첫 이레를 날마다 연다)으로만 본다. 하루씩 옮기는 장면이라 느려서 shell 갈래와 나눴다.
  week: { file: 'world-learning-ui.mjs', env: 'SYNK_LEARNING_UI_MODULE', scenes: ['atlas-next-check-week.test.mjs'] },
  // 게임 판의 한 수(4-6e-2 — §25-3 불변식 나): 게임 문의 겉. 진짜 엔진 코치와 진짜 입구로 판 끝을 돈다.
  game: { file: 'world-atlas-game.mjs', env: 'SYNK_ATLAS_GAME_MODULE', scenes: ['atlas-next-game-count.test.mjs'] },
  // 4-6e-2 · 4-6e-3 길 표의 셸 배선(§25-3 불변식 다 · §25-6) — 같은 셸을 길 표 셸 장면이 본다.
  routes: { file: 'world-learning-ui.mjs', env: 'SYNK_LEARNING_UI_MODULE', scenes: ['atlas-next-routes-shell.test.mjs'] },
  // 게임 판 끝의 판 기록 · 곁 기록의 열쇠(4-6e-2 — §25-3 불변식 나 · 가)와 기록이 바뀐 셈(createWriteCount — 불변식 다): 입구의 판 끝 적기 · 세대 읽기 · 세대 쓸기 · 쓰기 셈.
  entry: { file: 'world-atlas-next.mjs', env: 'SYNK_ATLAS_NEXT_MODULE', scenes: ['atlas-next-game-count.test.mjs', 'atlas-next-routes-shell.test.mjs'] },
});
const SWEEP_BASE = '        if (was !== null ? was < gen : base === plans && gen > 0) drop.push(key);\n';
const SWEEP_GEN = '        if (Number(rest.slice(1)) < gen) drop.push(key);\n';
const CLEAR_SWEEP = '      const whole = name && after !== null ? sweepGenerations(store, name, after) : null;\n';
const REAP = '      return save(rows.filter(row => row.at >= at - policy.keepMs || row === check));\n';
const DEVICE = '  const device = PLAN_LOG_AREAS.filter(area => !PLAN_COUNTED.includes(area)).map(area => ({ area, times: quiet(() => log?.times(area)) ?? [] }));\n';
const TOUCHED = "  const touched = Object.fromEntries(['present', 'help', 'delivery', 'startSet', 'observe'].map(name => [name, () => touch()]));\n";
const COUNTED = '    if (evidence?.stored !== true || evidence?.delivered !== true) continue;\n';
// 문이 게임이 넘긴 제시 칸을 적어 두는 변형(게임이 넘긴 audioRequired · confounded를 읽는 문).
const claimed = (name, test) =>
  `  const touched = { ...Object.fromEntries(['help', 'delivery', 'startSet', 'observe'].map(name => [name, () => touch()])), present: (pid, [item]) => { touch(); if (${test}) (globalThis.${name} ??= new Set()).add(pid); } };\n`;

// 길 표의 열쇠(4-6e-2 — 묶음 만남의 캐시 열쇠를 이어받았다).
const KEY = "  const key=[writes,summary.storage?.pending??null,planEnds,info?.type??'none',complete,summaryShape(summary),gameKeys].join('|');\n";
const ROUTES_KEEP = '  if(routesNow.coach!==coachNow||routesNow.key!==key||routesNow.pools.some((pool,i)=>pool!==pools[i]))\n';
const START = ' const start=reader?complete&&reader.start?.(skills.map(skill=>skill.id))===true:';
const HOMEWORK = ' const homework=skills.filter(reader?weakNext:weakOf).map(skill=>{';
const WAIT_OPEN = "if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(mine!==asked||!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}";
const MET = '      if (!wanted.has(item?.skillId) || quiet(() => skip(item)) === true) continue;\n';

// 변형 하나 = [갈래, 이름, 바꿀 글, 바꾼 글]. 바꿀 글은 원본에 꼭 한 번 있어야 한다.
export const PLAN_MUTANTS = [
  // ── 계획 셈의 읽개 갈래(world-exam-plan.mjs — §21-6 표의 여덟 자리) ──
  ['exam', '약한가에 도움받은 수를 세지 않는다', "const weakNext=skill=>skill.cell==='practicing'&&(skill.missed||0)+(skill.helped||0)>0;", "const weakNext=skill=>skill.cell==='practicing'&&(skill.missed||0)>0;"],
  ['exam', '기록 일부여도 필요를 만들고 시작점으로 본다', ' const complete=reader?.complete===true,needs={};', ' const complete=true,needs={};'],
  ['exam', 'TOPIK II 능력이 있는가를 읽개가 아니라 옛 요약으로 본다(카본 A2)', ' const ko2=reader?reader.topik2===true:', ' const ko2=null?reader.topik2===true:'],
  ['exam', '확인한 항목을 옛 상태로 센다', " const observed=skills.filter(skill=>reader?skill.cell!=='notyet':(skill.n||0)>0||skill.status!=='unseen');", " const observed=skills.filter(skill=>(skill.n||0)>0||skill.status!=='unseen');"],
  ['exam', '시작점을 모르면(null) 시작점으로 단정한다(검토 D4)', START, ' const start=reader?complete&&reader.start?.(skills.map(skill=>skill.id))!==false:'],
  ['exam', '시작점을 측정용 만남이 아니라 확인한 항목으로 정한다 — 생활 답만 있는 학생이 시작점이 아니다', START, ' const start=null?complete&&reader.start?.(skills.map(skill=>skill.id))===true:'],
  ['exam', '새 길의 약한 항목을 옛 규칙(weakOf)으로 고른다', HOMEWORK, ' const homework=skills.filter(weakOf).map(skill=>{'],
  ['exam', '지금 판(읽개 없음)의 약한 항목을 새 규칙으로 고른다 — 시범 중인 지금 판이 바뀐다(검토 D2)', HOMEWORK, ' const homework=skills.filter(weakNext).map(skill=>{'],
  ['exam', '도움받은 첫 만남만 있는 숙제를 놓친 답으로 적는다', "status:reader?(skill.missed>0?'missed':null):skill.status", "status:reader?'missed':skill.status"],
  ['exam', '줄 세울 값에 도움받은 수를 넣지 않는다', 'priority:reader?(skill.missed||0)+(skill.helped||0):skill.priority??0', 'priority:reader?(skill.missed||0):skill.priority??0'],
  ['exam', '같은 합이면 마지막 때가 이른 차례로 둔다', '(reader?(b.lastAt??-1)-(a.lastAt??-1):0)', '(reader?(a.lastAt??-1)-(b.lastAt??-1):0)'],
  ['exam', '숙제 줄에 마지막 때를 싣지 않는다 — 같은 합의 차례가 이름 차례로 떨어진다', '...(reader?{lastAt:skill.lastAt??null}:{})', '...({})'],
  ['exam', '혼자 해냄을 옛 상태로 센다', " const confirmed=skills.filter(skill=>reader?skill.cell==='independent':skill.status==='recent-independent').length;", " const confirmed=skills.filter(skill=>skill.status==='recent-independent').length;"],
  ['exam', '근거 수를 옛 n으로 센다', 'n+(reader?skill.answered||0:skill.n||0)', 'n+(skill.n||0)'],
  ['exam', '영역별 진행의 확인한 항목을 옛 상태로 센다', "checked:rows.filter(skill=>reader?skill.cell!=='notyet':skill.status!=='unseen').length", "checked:rows.filter(skill=>skill.status!=='unseen').length"],
  ['exam', '「이 기기에서 센 수」 표지를 싣지 않는다(검토 D5)', "...(doneScope==='device'?{doneScope}:{}),", ''],
  ['exam', '읽개가 있어도 옛 사건(examSkills)을 읽는다 — 한 문서에 두 판을 섞는다(§6)', ' const startSkills=reader?null:examSkills instanceof Set?', ' const startSkills=examSkills instanceof Set?'],
  ['exam', '지금 판(읽개 없음)의 시작점이 examSkills를 읽지 않는다 — 생활 답만으로 시작점 진단이 사라진다(11-08)', ' const startSkills=reader?null:examSkills instanceof Set?examSkills:Array.isArray(examSkills)?new Set(examSkills):null;', ' const startSkills=null;'],
  // ── 새 계획 모듈(world-plan-next.mjs) ──
  ['next', '모르는 문항(met null)이 있어도 시작점으로 단정한다(검토 D4)', '  return unknown ? null : true;\n', '  return true;\n'],
  ['next', '지금 낼 수 없는 문항(skip)의 만남도 센다', MET, '      if (!wanted.has(item?.skillId)) continue;\n'],
  ['next', '다른 능력의 만남도 시작점에 센다 — TOPIK I 문항만 푼 TOPIK II 학생이 시작점이 아니다', MET, '      if (quiet(() => skip(item)) === true) continue;\n'],
  ['next', '만난 것을 찾기 전에 모름에서 멈춘다', '      if (met === true) return false;\n      if (met !== false) unknown = true;\n', '      if (met !== false && met !== true) return null;\n      if (met === true) return false;\n'],
  ['next', 'TOPIK II 능력이 있는가를 만난 능력으로 본다 — 새 TOPIK II 학생이 TOPIK I 계획을 받는다(카본 A2)', "    topik2: skills.some(skill => skill.id.startsWith('ko2.')),\n", "    topik2: skills.some(skill => skill.id.startsWith('ko2.') && skill.cell !== 'notyet'),\n"],
  ['next', '기록이 다 왔는가를 늘 참으로 본다', '    complete: board?.complete === true,\n', '    complete: true,\n'],
  ['next', '쓰기 능력을 읽개에 넣지 않는다', "const PLAN_DOMAINS = Object.freeze(['listening', 'reading', 'writing']);", "const PLAN_DOMAINS = Object.freeze(['listening', 'reading']);"],
  ['next', '읽개의 칸을 TOPIK I 능력으로만 짓는다 — TOPIK II 학생의 TOPIK II 칸이 늘 아직이다', "    skills: [...examSkills(nodes, 'topik1'), ...examSkills(nodes, 'topik2')],\n", "    skills: examSkills(nodes, 'topik1'),\n"],
  ['next', '만나지 않은 능력을 연습 중으로 읽는다', "        cell: row?.cell ?? 'notyet',\n", "        cell: row?.cell ?? 'practicing',\n"],
  ['next', '판 기록을 거둘 때 마지막 다시 확인을 남기지 않는다', REAP, '      return save(rows.filter(row => row.at >= at - policy.keepMs));\n'],
  ['next', '판 기록의 영역을 가리지 않는다', '      if (!key || !PLAN_LOG_AREAS.includes(area) || !Number.isFinite(at)) return false;\n', '      if (!key || !Number.isFinite(at)) return false;\n'],
  ['next', '지난 다시 확인을 그 때 뒤에서도 고른다', "        .filter(row => row.area === 'recheck' && row.at < before)\n", "        .filter(row => row.area === 'recheck')\n"],
  ['next', '판 기록 열쇠에 저장소 이름을 쓰지 않는다 — 손님 · 계정 · 동의 판의 기록이 섞인다(검토 D5)', 'export const planLogKey = (store, gen = 0) => sideKey(PLAN_LOG_PREFIX, store, gen);', "export const planLogKey = (store, gen = 0) => (typeof store === 'string' && store ? PLAN_LOG_PREFIX : null);"],
  ['next', '이 기기의 판 기록을 이번 주 횟수에 넣지 않는다', DEVICE, '  const device = [];\n'],
  // ── 판 기록의 셈 · 거두기 · 열쇠(4-6e-2 — §25-3 「셈」 · 「거두기」 · 불변식 가) ──
  ['next', '판 기록의 듣기 · 읽기 수를 넘기지 않는다 — 게임 판이 이번 주 계획에 들지 않는다', '  const counted = weekCounts(quiet(() => log?.rows?.()) ?? [], week, examPlan.EXAM_PLAN_POLICY?.sessionGapMs);\n', '  const counted = [];\n'],
  ['next', '판 기록을 count와 times로 함께 넘긴다 — 한 판이 한 수로 두 번 세어진다', DEVICE, '  const device = PLAN_LOG_AREAS.map(area => ({ area, times: quiet(() => log?.times(area)) ?? [] }));\n'],
  ['next', '판 기록의 주 경계 거름을 뺀다 — weekActivity는 count를 주 경계로 거르지 않아 지난주 판이 든다', '    if (!PLAN_COUNTED.includes(row?.area) || !Number.isFinite(row.at) || row.at < week.start || row.at >= week.end) continue;\n', '    if (!PLAN_COUNTED.includes(row?.area) || !Number.isFinite(row.at)) continue;\n'],
  ['next', '경험을 하나로 묶어 센다 — 바람길 판 뒤 10분의 리듬 판이 한 수를 더 올리지 않는다', '    const key = `${row.area}|${row.experience}`;\n', '    const key = `${row.area}|all`;\n'],
  ['next', '경험 이름이 없는 옛 줄을 이름 없는 경험으로 읽는다 — 고치기 전후 10분 간격의 짧은 연습 두 판이 둘이 된다(넷째 판 검토 GPT GA4)', ': PLAN_COUNTED.includes(row.area) ? PRACTICE_EXPERIENCE : null,', ': null,'],
  ['next', '판 기록 줄을 수로 자른다 — 게임 판이 많은 주에 시험 형식 줄과 주초의 듣기 줄이 밀려난다(넷째 판 검토 Fable FA2)', REAP, '      return save(rows.filter(row => row.at >= at - policy.keepMs || row === check).slice(-240));\n'],
  ['next', '이레 지난 판 기록 줄을 거두지 않는다', REAP, '      return save(rows);\n'],
  ['next', '판 기록 열쇠에서 세대를 뺀다 — 비운 것을 모르는 탭의 늦은 쓰기가 새 세대의 판 기록을 덮는다(§25-3 불변식 가)', "${Number.isSafeInteger(gen) && gen > 0 ? `@${gen}` : ''}", ''],
  ['next', '값의 세대가 다른 판 기록도 읽는다', '    return !known || value?.gen === gen ? rowsIn(value) : (inherited(value) ?? []);\n', '    return rowsIn(value);\n'],
  // 세대 0의 옛 꼴은 읽기에서도 이어받는다(4-6e-2 검수 GPT GC3). 이 변형은 열 때 옮겨 적기만 뺀다.
  ['next', '세대 0의 옛 꼴을 열 때마다 읽을 때만 이어받고 옮겨 적지 않는다(v7 검토 Fable F1)', '      return rows ? save(rows) : false;\n', '      return false;\n'],
  ['next', '옛 꼴을 이어받을 때 같은 줄을 합치지 않는다', 'merged(rowsIn(value))', 'rowsIn(value)'],
  ['next', '쓰기 연습의 기기 시각을 세지 않는다', "    { area: 'writing', times: Array.isArray(writingTimes) ? writingTimes : [] },\n", ''],
  ['next', '지난 다시 확인을 판 기록에서 읽지 않는다', '    lastCheckAt: quiet(() => log?.lastCheck(week.start)) ?? null,\n', '    lastCheckAt: null,\n'],
  ['next', '말하기를 고른 학생의 시험 정보에 말하기를 붙이지 않는다', '    exam: speaking ? { ...info, speaking: true } : info,\n', '    exam: info,\n'],
  ['next', '계획에 「이 기기에서 센 수」 표지를 넘기지 않는다', "    doneScope: 'device',\n", ''],
  // ── 셸의 배선(world-learning-ui.mjs — weekNext · planOnce) ──
  ['shell', '목표 창 「내 위치 보기」 수를 새 길 문서에서도 옛 world-home 요약으로 짓는다(단계4_계획 §22-1 5b · 설계 주인 11-18)', "  if(phase==='old'){let summary=empty;", "  if(true){let summary=empty;"],
  // 4-6e-2부터 묶음 만남은 길 표가 묻는다(열쇠 KEY). 판 끝(planEnds) · 요약 모양(summaryShape)만 뺀 변형은 두지 않는다 — 그 둘을 바꾸는 일(이 문서의 쓰기 ·
  // 받기 알림 — 순간 맞춤 손잡이의 제시 · 답 포함, 4-6e-2 검수 Fable F1)은 「기록이 바뀐 셈」도 함께 올려 같은 동작이 된다(그 셈을 뺀 변형은 entry 갈래에 있다).
  ['shell', '목표 시험을 바꿔도 묶음 만남을 다시 묻지 않는다(설계 검토 A8)', KEY, "  const key=[writes,summary.storage?.pending??null,planEnds,complete,summaryShape(summary),gameKeys].join('|');\n"],
  ['shell', '기록이 다 와도 묶음 만남을 다시 묻지 않는다 — 기록 일부일 때의 판정이 그날 내내 굳는다(설계 검토 A8)', KEY, "  const key=[writes,summary.storage?.pending??null,planEnds,info?.type??'none',summaryShape(summary),gameKeys].join('|');\n"],
  ['shell', '다시 그릴 때마다 묶음 만남을 묻는다 — 홈이 그릴 때마다 풀 전체를 훑는다', ROUTES_KEEP, '  if(true)\n'],
  ['shell', '판 기록을 열지 않고 계획을 짓는다 — 이번 주에 한 판을 세지 못한다', '  const examPlan=N.buildPlanNext({examPlan:position.exam,info,reader,log:homeNext?.planLog?.(coachNow)??null,', '  const examPlan=N.buildPlanNext({examPlan:position.exam,info,reader,log:null,'],
  ['shell', '진단이 낼 문항이 있어도 홈에 알리지 않는다 — 점검 칸이 빈다', '  return {examPlan,routes,diagnostic:{ready},mock,mockDone,writing,speaking:speakingNow};\n', '  return {examPlan,routes,diagnostic:{ready:false},mock,mockDone,writing,speaking:speakingNow};\n'],
  ['shell', '세 줄 계획의 say 둘째 인자(단위 → 이름)를 버린다 — 게임 줄이 맡은 단위의 이름을 못 그린다(4-6e-1 GB2 결정)', 'say:(why,names)=>homePlanner.say(why,lang,names),week,...gameList});', 'say:why=>homePlanner.say(why,lang),week,...gameList});'],
  ['shell', '새 길 홈에 이번 주 계획을 넘기지 않는다 — 계획 입구 · 허브 줄 · 알림이 읽을 계획이 없다', '   labels:id=>skillLabel(id),opened:opened.kinds,lang,say:(why,names)=>homePlanner.say(why,lang,names),week,...gameList});\n', '   labels:id=>skillLabel(id),opened:opened.kinds,lang,say:(why,names)=>homePlanner.say(why,lang,names),...gameList});\n'],
  ['shell', '건너뛴 문항뿐인 판도 판 기록에 센다', "   if(!(Array.isArray(results)?results:[]).some(row=>row&&!row.skipped&&(row.verdict==='correct'||row.verdict==='incorrect')))return;\n", ''],
  // 판 기록의 「한 판에 한 번」 막이(planOnce의 done)를 빼는 변형은 두지 않는다 — 판 끝은 그만둔 판에서(ended), 그만두기는 끝난 판에서(ended)
  // 이미 그치므로 화면으로는 두 번째 부름에 닿지 않는다(같은 동작 변형 · 11-16 4c 실측). 막이는 판 끝과 그만두기가 바뀌어도 두 번 세지 않게 둔 것이다.
  ['shell', '진단을 다시 확인이 아닌 영역으로 적는다', "  const counted=planOnce(coachNow,'recheck'); // 이번 주 계획의 다시 확인(4-4b)\n", "  const counted=planOnce(coachNow,'reading'); // 이번 주 계획의 다시 확인(4-4b)\n"],
  ['shell', '진단 판 끝에 판 기록을 적지 않는다', '   counted(session.results());\n   // 저장을 기다리는 사이 판이 닫혔거나', '   // 저장을 기다리는 사이 판이 닫혔거나'],
  ['shell', '진단을 그만둘 때 판 기록을 적지 않는다', 'if(session.results().length)diagnosed=true;counted(session.results());', 'if(session.results().length)diagnosed=true;'],
  ['shell', '짧은 연습의 영역을 늘 읽기로 적는다', "  const counted=planOnce(next,listening?'listening':'reading'); // 이번 주 계획의 영역(4-4b)\n", "  const counted=planOnce(next,'reading'); // 이번 주 계획의 영역(4-4b)\n"],
  ['shell', '짧은 연습 판 끝에 판 기록을 적지 않는다', '   counted(results);\n   if(!box.isConnected)return;\n', '   if(!box.isConnected)return;\n'],
  ['shell', '확인 중에 연 이번 주 계획이 판이 서기를 기다리지 않는다 — 시험을 저장한 학생의 바로가기가 계획을 못 연다(4-4b 끝 판 Fable F1)', WAIT_OPEN, '}'],
  ['shell', '한도를 넘겨도 확인 중이면 목표 창을 연다 — 계획을 모르는 학생을 계획 없는 학생으로 본다(Fable F1)', "  if(!examPlan&&homePhase()==='checking'&&examChosen()){if(!keepScroll&&!quiet)home.toast(t('home.today.checking'));return 'skipped';}\n", ''],
  ['shell', '판이 서도 기다림을 깨우지 않는다 — 판이 선 뒤에도 한도(8초)까지 기다린다(Fable F1)', '  wakePlanWaits();\n', ''],
  // wakePlanWaits의 「닫혔는가」(!stopped) 확인을 빼는 변형은 두지 않는다 — 닫히면 판 상태(homePhase)가 지금 판('old')이라 기다림이 이미 풀린다
  // (같은 동작 변형 · 4-4b 다시 검수 카본 A1). 확인은 그 규칙에 기대지 않으려고 둔 것이다. settledHome 타이머의 unref는 프로세스 종료만 바꿔 장면으로 못 본다.
  ['shell', '확인 중에 학생이 누른 계획 열기가 기다린 사이 학생이 연 다른 판을 덮는다(4-4b 다시 검수 Fable FA2)', WAIT_OPEN, "if(homePhase()==='checking'&&examChosen()){await settledHome();check();if(mine!==asked)return 'skipped';}}"],
  ['shell', '문서가 닫혀도 계획 열기의 기다림을 깨우지 않는다 — 판을 기다리던 열기가 8초 한도까지 매달린다(4-4b 다시 검수 카본 A1)', "dispose(){stopped=true;wakePlanWaits();", "dispose(){stopped=true;"],
  ['shell', '짧은 연습을 도중에 닫을 때 판 기록을 적지 않는다', 'try{session.stop();}catch{}counted(session.results());queueMicrotask(()=>refresh());};', 'try{session.stop();}catch{}queueMicrotask(()=>refresh());};'],
  // ── 받기 알림(§21-20 — hearHome · heardHome · drawHeard). 열린 판 · 묶기 · 코치 바꾸기의 변형은 qa/position-mutants.mjs 「셸 받기 알림」에 있다 ──
  ['shell', "받기 알림을 듣지 않는다 — 기록이 다 오기 전에 그린 홈이 받기가 되어도 학생이 화면을 건드리기 전까지 다시 그리지 않는다(§21-20 · 카본 C1)", "  hearHome();heard.home=false;\n", "  heard.home=false;\n"],
  ['shell', "알림을 받아도 홈을 다시 그리지 않는다(§21-20 · 카본 C1)", "  if(heard.home)refresh();\n", ""],
  ['shell', "받기(receive) 알림을 넘긴다 — 다른 기기의 답 · 막힘이 풀려 올린 답이 홈에 닿지 않는다(§21-20 시험 1 · 4 · GPT GA1 · Fable FA3)", "off:coachNow.watch(()=>heardHome(coachNow))", "off:coachNow.watch(note=>{if(note?.kind==='refresh')heardHome(coachNow);})"],
  ['shell', "다른 탭(refresh) 알림을 넘긴다 — 같은 브라우저의 다른 창에서 쓴 답이 이 창의 홈에 닿지 않는다(§21-20 시험 2 · 3)", "off:coachNow.watch(()=>heardHome(coachNow))", "off:coachNow.watch(note=>{if(note?.kind==='receive')heardHome(coachNow);})"],
  ['shell', "알림을 받은 자리에서 바로 그린다 — 잇달아 온 알림을 묶지 않는다(§21-20 조건 3)", "  heard.home=true;heard.panel=true;\n  if(heard.timer==null)heard.timer=watchClock.set(drawHeard,0);\n", "  heard.home=true;heard.panel=true;\n  drawHeard();\n"],
  // 「알림이 묶음 만남을 버리지 않는다」(§21-20 시험 3)는 4-6e-2부터 입구의 받기 알림 셈이 맡는다 — entry 갈래의 「받기 알림 셈을 뺌」.
  ['shell', "문서를 닫아도 받기 알림의 듣기를 되돌리지 않는다(§21-20 조건 1)", "responseCoachOff?.();stopHearing();", "responseCoachOff?.();"],
  ['shell', "열린 이번 주 계획 판을 알림으로 다시 그리지 않는다 — 판 뒤의 홈만 새로 그려 학생이 보는 판은 옛 계획이다(받기 알림 설계 검토 D3)", "  if(planOpen&&heard.panel)void openPlan({keepScroll:true}).catch(()=>{});\n", ""],
  ['shell', "받기 알림을 걸지 못하는 엔진 판에서도 새 길 홈을 그대로 둔다 — 다른 기기의 답을 놓친다(받기 알림 설계 검토 D5)", "   if(error instanceof TypeError)unheard();\n", ""],
  ['shell', "겉에 watch가 없는 엔진 코치에서도 새 길 홈을 그대로 둔다 — 조용히 듣지 않아 다른 기기의 답을 놓친다(4-4b 다시 검수 -d Fable P3)", "  if(typeof coachNow.watch!=='function'){unheard();return;}\n", "  if(typeof coachNow.watch!=='function')return;\n"],
  ['shell', "알림으로 다시 그린 이번 주 계획 판이 판 안의 초점을 되돌리지 않는다 — 초점이 닫기 단추로 간다(4-4b 다시 검수 -d GPT GA1)", "const root=panelNode('[data-plan-board]');if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}", "const root=panelNode('[data-plan-board]');if(keepScroll){const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;}"],
  ['shell', "계획 판의 초점을 내 위치 판의 단추 이름으로만 찾는다 — 계획 판 단추로 되돌리지 못하고 판 머리로 간다(4-4b 다시 검수 -d GPT GA1)", "nextFocusOf(panelNode('[data-plan-board]'),PLAN_FOCUS)", "nextFocusOf(panelNode('[data-plan-board]'))"],
  ['shell', "생활 레슨 · 복습 · 카페 판이 열린 동안에도 알림마다 홈과 묶음 만남을 다시 짓는다(받기 알림 설계 검토 D8)", "return LIFE_SESSIONS.has(kind)||SESSION_PANELS.some(selector=>panelNode(selector));", "return SESSION_PANELS.some(selector=>panelNode(selector));"],
  // ── 점검 칸의 값(4-4d — 단계4_계획 §21-23의 3): 시험 형식 판 기록 · 셸이 이번 주 계획 값에 싣는 시험 형식 · 쓰기 · 말하기 ──
  ['next', "이 기기의 판 기록이 시험 형식 판을 받지 않는다 — 점검 칸의 시험 형식 줄이 이번 주 내내 선다(4-4d)", "export const PLAN_LOG_AREAS = Object.freeze(['recheck', 'listening', 'reading', 'mock']);", "export const PLAN_LOG_AREAS = Object.freeze(['recheck', 'listening', 'reading']);"],
  ['shell', "이번 주에 한 시험 형식 판을 보지 않는다 — 판을 한 뒤에도 점검 칸에 시험 형식을 넘긴다(4-4d)", "   done:mockDone>0}:null;", "   done:false}:null;"],
  ['shell', "시험 형식 판을 주 경계 없이 센다 — 지난주에 한 판이 이번 주 줄을 막는다(4-4d)", "mockDone=times.filter(at=>at>=examWeek.start&&at<examWeek.end).length;", "mockDone=times.length;"],
  ['shell', "한 가지 고치기의 시각을 보지 않는다 — 계획 시각 뒤의 기록도 열린 것으로 본다(4-4d)", "const need=row53?.practiceNeed&&Date.parse(row53.practiceNeed.at)<=now?row53.practiceNeed:null;", "const need=row53?.practiceNeed||null;"],
  ['shell', "TOPIK I 학생에게도 53번 쓰기를 넘긴다(4-4d)", "const row53=info.type==='topik2'?writingList().find(row=>row.route==='writing:53')||null:null;", "const row53=writingList().find(row=>row.route==='writing:53')||null;"],
  ['shell', "말하기 유형을 추천 첫 줄이 아니라 목록 첫 줄에서 읽는다(4-4d)", "listed=first?speaking.list.find(row=>row.route===first.routeId)||null:null", "listed=first?speaking.list[0]||null:null"],
  ['shell', "말하기의 안 해 본 유형 수 대신 유형 수를 넘긴다(4-4d)", "type,untried:speaking.untried}", "type,untried:speaking.list.length}"],
  ['shell', "시험 형식이 듣기 칸과 상관없이 소리를 요구한다 — 소리를 끈 날 듣기 없는 판도 잠근다(4-4d)", "audioRequired:(mockNow.sections||[]).some(row=>row.section==='listening'&&row.status==='ready')", "audioRequired:true"],
  ['shell', "시험 형식 풀의 만남을 묶음 만남과 따로 묻는다 — 다시 그릴 때마다 묻는다(카본 A8과 같은 막이 · 4-4d)", "exposures:met&&met.length===mock.pool.length?met:coachNow.exposures(mock.pool)", "exposures:coachNow.exposures(mock.pool)"],
  ['shell', '새 길 계획 판에 시험 형식 칸을 싣지 않는다 — 홈 줄이 서는 날에도 계획 판에 그 칸이 없다(Fable 끝 판 F8 · 설계 주인 11-17 저녁 답 3)', "  if(mockNow)examPlan.mock=", "  if(false)examPlan.mock="],
  // ── 게임 판 끝 듣기(4-6e-2 — §25-3 불변식 나: 셸이 판 끝 수를 올리고 홈 · 열린 이번 주 계획 판을 다시 그린다) ──
  ['shell', '셸이 게임 판 끝을 듣지 않는다 — 방금 한 게임 판이 홈과 계획에 들지 않는다', '  try{stopGameEnds=planner.gameEnds?.(heardGameEnd)??null;}catch{stopGameEnds=null;}\n', ''],
  ['shell', '게임 판 끝에 판 끝 수를 올리지 않는다 — 답 없이 문항만 본 판의 만남을 계획이 다시 묻지 않는다', "  planEnds+=1;\n  const draw=()=>{\n", "  const draw=()=>{\n"],
  ['shell', '문서를 닫아도 게임 판 끝 듣기를 끊지 않는다', 'try{stopGameEnds?.();}catch{/* 닫힌 입구 */}', ''],
  // ── 게임 판의 한 수(4-6e-2 — §25-3 불변식 나: 게임 문의 겉) ──
  ['game', '일반 길에서 recorded.verdict만 읽는다 — 일반 코치 answer는 판정을 맨 위에 돌려준다(넷째 판 검토 GPT GA2)', '      answer: (result, [pid]) => noteAnswer(pid, result),\n', '      answer: (result, [pid]) => noteAnswer(pid, result?.recorded),\n'],
  ['game', '손잡이 길에서 맨 위 verdict만 읽는다 — 손잡이 answer는 판정을 recorded에 돌려준다(넷째 판 검토 GPT GA7)', '        answer: (result, [pid]) => noteAnswer(pid, result?.recorded),\n', '        answer: (result, [pid]) => noteAnswer(pid, result),\n'],
  ['game', '전달이 pending인 답을 센다', COUNTED, '    if (evidence?.stored !== true) continue;\n'],
  ['game', '게임이 넘긴 audioRequired를 쓴다 — 소리가 드는 문항에 전달을 알리지 않은 답을 센다(셋째 판 확인 N2)', [TOUCHED, COUNTED], [claimed('__claimedQuiet', 'item?.audioRequired === false'), '    if (evidence?.stored !== true || (evidence?.delivered !== true && !globalThis.__claimedQuiet?.has(pid))) continue;\n']],
  ['game', '가려진(confounded) 답을 뺀다 — 바람길 지시 문항처럼 옛 길보다 적게 센다', [TOUCHED, COUNTED], [claimed('__claimedHidden', 'item?.confounded === true'), '    if (evidence?.stored !== true || evidence?.delivered !== true || globalThis.__claimedHidden?.has(pid)) continue;\n']],
  ['game', '판 끝 알림을 뺀다 — 센 첫 답이 없는 판(답 없이 문항만 본 판)을 셸에 알리지 않는다', '    if (!slot.touched) return;\n', '    if (!slot.answers.length) return;\n'],
  ['game', '판을 다시 정해 닫힌 판(retired)도 판 끝을 부른다', '      slot.answers = [];\n      slot.touched = false;\n      slot.retired =', '      closeSet(slot, null);\n      slot.retired ='],
  ['game', '게임이 닫은 판(finishSet)의 다시 접기를 싣지 않는다 — 접힌 뒤 홈을 다시 그리지 못한다(사슬 -d GA2)', '      finishSet: result => finished(result?.folded ?? null),\n', '      finishSet: () => finished(null),\n'],
  ['game', '겉의 finishSet을 판 끝으로 보지 않는다', '      finishSet: result => finished(result?.folded ?? null),\n', ''],
  ['game', '패널 닫힘 · 다시 open을 판 끝으로 보지 않는다 — finishSet 전에 닫은 판이 홈과 계획에 들지 않는다', '    closeSet(slot, hold(slot.coach, -1) === 0 ? endSet(slot.coach) : null);\n', '    if (hold(slot.coach, -1) === 0) endSet(slot.coach);\n'],
  // ── 게임 판 끝의 판 기록과 곁 기록의 열쇠(4-6e-2 — §25-3 불변식 나 · 가: 입구) ──
  ['entry', '게임 판 기록을 뺀다 — 게임 판이 이번 주 계획의 듣기 한 수가 되지 않는다', "        log?.record(area, at, typeof gameId === 'string' ? gameId : null);\n", '        void area;\n'],
  ['entry', '입구가 연 게임 문에 판 끝 함수를 넘기지 않는다', '          ended: (made, end) => void gameEnded(made, end),\n', ''],
  ['entry', '판 끝 알림을 뺀다 — 센 첫 답이 없는 판을 셸에 알리지 않는다', '    for (const fn of [...gameEndListeners])\n', '    for (const fn of areas.length ? [...gameEndListeners] : [])\n'],
  ['entry', '은퇴한 코치(gone)의 늦은 판 끝도 적는다 — 비운 뒤 판 기록이 되살아난다', '    if (disposed || gone.has(made)) return false;\n', '    if (disposed) return false;\n'],
  ['entry', '판 기록을 그 코치를 연 때의 세대 열쇠에 적지 않는다', 'gen: gens.get(made) ?? null', 'gen: null'],
  ['entry', '세대 쓸기를 뺀다 — 비운 것을 모르는 탭이 앞 세대 열쇠에 쓴 줄이 기기에 남는다(설계 주인 조건 1)', '    sweepGenerations(store, name, gen, openedWith.get(made) ?? null);\n', ''],
  ['entry', '세대 쓸기가 뒤 세대 열쇠도 지운다 — 연 직후 다른 탭이 비워 선 새 기록을 잃는다', SWEEP_GEN, '        if (Number(rest.slice(1)) !== gen) drop.push(key);\n'],
  ['entry', '세대 쓸기가 같은 세대가 든 기본 열쇠도 지운다 — 4c 고침(20beea9ed)의 같은 세대 이어받기가 깨진다', SWEEP_BASE, '        if (was !== null ? was <= gen : base === plans && gen > 0) drop.push(key);\n'],
  ['entry', '세대 쓸기가 #cleared 표지 열쇠도 지운다 — 비운 것을 모르는 탭이 비우기 전 기억을 다시 쓴다(25-12의 13)', '      // 그 밖(비운 세대 표지 #cleared · 이름이 더 긴 다른 저장소)은 건드리지 않는다.\n', "      if (rest === '#cleared') drop.push(key);\n"],
  ['entry', '세대 쓸기가 gen이 달린 지금 세대의 판 기록 줄도 지운다', SWEEP_GEN, '        if (Number(rest.slice(1)) < gen || base === plans) drop.push(key);\n'],
  [
    'entry',
    '세대 1 이상의 옛 꼴 판 기록을 지금 세대로 옮긴다 — 구판 탭이 비운 뒤 늦게 쓴 줄이 되살아난다(v8 검토 GPT GA1)',
    SWEEP_BASE,
    "        if (was !== null ? was < gen : base === plans && gen > 0) { if (was === null) { const old = JSON.parse(storage.getItem(key) ?? 'null'); const into = sideKey(PLAN_LOG_PREFIX, name, gen); const kept = JSON.parse(storage.getItem(into) ?? 'null'); storage.setItem(into, JSON.stringify({ v: 1, gen, rows: [...(kept?.rows ?? []), ...(Array.isArray(old?.rows) ? old.rows : [])] })); } drop.push(key); }\n",
  ],
  ['entry', '세대 0의 옛 꼴 판 기록을 이어받지 않는다 — 새 판으로 올린 날 지금 판에서 한 판이 사라진다', '  if (gen === 0) createPlanLog({ storage, store: name, gen, cleared: () => clearedGen(storage, name), opened }).adopt();\n', ''],
  [
    'entry',
    '비우기 자리의 쓸기가 옛 꼴 판 기록을 새 세대로 옮긴다(25-12의 14)',
    CLEAR_SWEEP,
    "      if (name && after !== null) { const old = JSON.parse(store.getItem(planLogKey(name)) ?? 'null'); if (old && !Number.isSafeInteger(old.gen) && Array.isArray(old.rows)) store.setItem(planLogKey(name, after), JSON.stringify({ v: 1, gen: after, rows: old.rows })); }\n" + CLEAR_SWEEP,
  ],
  ['entry', '비우기 자리의 쓸기를 뺀다 — 앞 세대 열쇠가 다음 코치를 열 때까지 기기에 남는다(다섯째 판 검토 Fable FA2)', CLEAR_SWEEP, '      const whole = name && after !== null ? true : null;\n'],
  // 「쓰기에서 셈 올림 뺌」은 길 표(불변식 다) 몫이라 이 갈래에 두지 않는다.
  ['week', '이번 주에 한 판의 수(mockDone)를 홈 플래너에 넘기지 않는다 — 차례 돌리기가 늘 0이라 하지 않은 시험 형식이 이레 내내 선다(설계 주인 11-17 저녁 답 1)', 'diagnostic:{ready},mock,mockDone,writing,', 'diagnostic:{ready},mock,writing,'],
  ['week', '쓰기의 한 가지 고치기가 열린 시각을 넘기지 않는다 — 몫이 모두 찬 날에도 보탬이 서지 않는다(설계 주인 11-17 다시 여쭘의 답 2)', 'needAt:needKind?need.at:null', 'needAt:null'],
  // ── 검수 s3e1로 고친 것(GB3 · GB4) ──
  ['shell', '확인 중에 기다린 계획 열기가 그 사이 학생이 누른 다른 학습(같은 카드의 짧은 진단 시작)을 덮는다(검수 s3e1 GB4)', WAIT_OPEN, "if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}"],
  ['shell', '새 길 연습 코치를 기다리는 사이 판을 닫아도 늦게 선 짧은 연습이 그 판을 덮는다(검수 s3e1 GB3 · 2a3a74e85a의 막이)', '  home.attachPanelResource?.(resource);\n', ''],
  // ── 4-6e-2 · 4-6e-3 길 표의 셸 배선(§25-3 불변식 다 · §25-6 — world-learning-ui.mjs) ──
  ['routes', '듣기 근거를 다시 비운다 — 짧은 연습 새 문항이 없는 듣기 숙제가 모자람이다', 'available:{practice:supply.practice,listening:supply.listening,', 'available:{practice:supply.practice,listening:{},'],
  ['routes', '계획이 길 함수 대신 목록 차례로 고른다 — 앞 게임이 돌아온 단위에 걸린 날 계획 단추만 앞 게임을 연다', '   if(route.games.length)listening[id]=route.games.map(game=>game.id);\n', '   if(route.games.length)listening[id]=routes.games.filter(game=>route.games.some(row=>row.id===game.id)).map(game=>game.id);\n'],
  ['routes', '내 위치가 학생 시험 풀로 고른다 — TOPIK I 학생이 누른 TOPIK II 판에 길이 없다(설계 주인 25-12의 10)', '  for(const skill of skills){let route=null;', '  for(const skill of [...new Set(practiceFor(values).map(item=>item.skillId))].map(id=>({id}))){let route=null;'],
  ['routes', '화면마다 길 표를 짓는다', ROUTES_KEEP, '  if(true)\n'],
  ['routes', '길 표 열쇠에서 홈 코치를 뺀다 — 바뀐 코치에 앞 코치의 길 표가 남는다(v8 검토)', ROUTES_KEEP, '  if(routesNow.key!==key||routesNow.pools.some((pool,i)=>pool!==pools[i]))\n'],
  ['routes', '길 표를 시험 관문 안에서 짓는다 — 시험을 고르지 않은 학생의 「이 항목 연습하기」가 없다(v7 검토)', "  const info=position.exam?.examInfo?.(values)||null;\n  let writes=0;", "  const info=position.exam?.examInfo?.(values)||null;if(!info)return null;\n  let writes=0;"],
  ['routes', 'nextData가 만남을 따로 묻는다(설계 주인 25-12의 14)', '  const summary=coachNow.summary(),diagnostic=routes.pools.diagnostic,practice=routes.pools.practice,rows=routes.rows;\n', '  const summary=coachNow.summary(),diagnostic=routes.pools.diagnostic,practice=routes.pools.practice,rows=(met=>({diagnostic:met.slice(0,diagnostic.length),practice:met.slice(diagnostic.length),mock:routes.rows.mock}))(coachNow.exposures([...diagnostic,...practice]));\n'],
  ['routes', '캐시 열쇠에서 게임 목록을 뺀다 — 해금 · 환승 난도가 바뀌어도 게임 몫이 옛 목록이다(넷째 판 검토)', KEY, "  const key=[writes,summary.storage?.pending??null,planEnds,info?.type??'none',complete,summaryShape(summary)].join('|');\n"],
  ['routes', '「이 항목 연습하기」가 게임을 짧은 연습보다 먼저 단다(§25-6)', "const practiceWay=(route,audioAvailable)=>route?.route==='practice'&&", "const practiceWay=(route,audioAvailable)=>route?.games?.length&&audioAvailable?{route:'game',gameId:route.games[0].gameId}:route?.route==='practice'&&"],
  ['routes', '「이 항목 연습하기」의 소리 거름을 뺀다 — 소리를 끈 날 게임 단추가 선다(§25-6)', "  :route?.route==='game'&&audioAvailable?{route:'game',gameId:route.gameId}:null;", "  :route?.route==='game'?{route:'game',gameId:route.gameId}:null;"],
  ['routes', '「이 항목 연습하기」 단추가 게임 길에도 짧은 연습을 연다(§25-6)', "void Promise.resolve(way?.route==='game'?launchGame(way.gameId):startPractice(id)).catch(failed);", "void Promise.resolve(startPractice(id)).catch(failed);"],
  ['routes', '시험 형식 풀이 없으면 그릴 때마다 새 빈 풀을 넘긴다 — 길 표가 매번 다시 서고 묶음 만남을 다시 묻는다(4-6e-2 검수 GPT GC4)', 'position.mock.pool:NO_MOCK;', 'position.mock.pool:[];'],
  ['shell', '게임 판이 다시 접힌 뒤 다시 그리지 않는다 — 기기 기록부의 홈과 열린 판이 접기 전 요약에 머문다(사슬 -c 카본 C1)', '  if(end?.folded)Promise.resolve(end.folded).then(draw,()=>{});\n', ''],
  ['shell', '게임 판이 다시 접힌 뒤 홈과 내 위치 판만 다시 그린다 — 열린 이번 주 계획 판이 접기 전 요약에 머문다(사슬 -d 카본 A1)', 'Promise.resolve(end.folded).then(draw,()=>{});', 'Promise.resolve(end.folded).then(foldedRedraw,()=>{});'],
  ['shell', '게임 판이 다시 접힌 뒤 홈만 다시 그린다 — 열린 내 위치 · 이번 주 계획 판이 접기 전의 길로 게임을 연다(사슬 -d-r2 카본 A1 · GPT GA1)', 'Promise.resolve(end.folded).then(draw,()=>{});', 'Promise.resolve(end.folded).then(()=>refresh(),()=>{});'],
  ['shell', '게임 판 끝에 열린 이번 주 계획 판을 다시 그리지 않는다', "   if(panelOpen()&&panelNode('[data-plan-board]'))void openPlan({keepScroll:true}).catch(()=>{});\n   foldedRedraw();\n", '   foldedRedraw();\n'],
  ['shell', '게임 판 끝에 열린 내 위치 판을 다시 그리지 않는다 — 저장을 기다리는 사이 연 판이 앞 게임의 길로 남는다(사슬 -d-r2 GPT GA1)', "catch(()=>{});\n   foldedRedraw();\n", "catch(()=>{});\n   refresh();\n"],
  ['shell', '게임 판 끝에 홈을 다시 그리지 않는다', "catch(()=>{});\n   foldedRedraw();\n", "catch(()=>{});\n   redrawNext();\n"],
  ['shell', '판 끝 때 계획 판이 열렸는지를 한 번만 보고 접힌 뒤에도 쓴다 — 그 사이 연 판을 다시 그리지 않는다(사슬 -d-r3 GPT GA2)', "  const draw=()=>{\n   if(stopped)return;\n   if(panelOpen()&&panelNode('[data-plan-board]'))", "  const planOpen=panelOpen()&&Boolean(panelNode('[data-plan-board]'));const draw=()=>{\n   if(stopped)return;\n   if(planOpen)"],
  ['shell', '닫히는 판도 다시 그린다 — 접히기 전에 닫은 이번 주 계획 판이 다시 열린다', "   if(panelOpen()&&panelNode('[data-plan-board]'))void openPlan", "   if(t('plan.week.title'))void openPlan"],
  ['shell', '뒤의 다시 그리기가 여는 중인 짧은 연습을 끊는다(사슬 -d GPT GA1)', 'if(atlasNext&&keepOpening){keepOpening(resource);return;}', ''],
  ['shell', '넘긴 자원을 무효로도 한다', 'if(atlasNext&&keepOpening){keepOpening(resource);return;}', 'if(atlasNext&&keepOpening)keepOpening(resource);'],
  ['shell', '꺼진 문서에서도 여는 중인 연습을 잇는다 — master와 다르다(5-3 꺼진 판 대조)', 'if(atlasNext&&keepOpening){keepOpening(resource);return;}', 'if(keepOpening){keepOpening(resource);return;}'],
  ['shell', '넘겨받은 자원을 새 판에 다시 달지 않는다 — 둘째 다시 그리기나 판 닫기가 그 열기를 모른다', 'finally{keepOpening=null;if(kept)home.attachPanelResource?.(kept);}', 'finally{keepOpening=null;}'],
  ['shell', '다시 그리기가 끝나도 이어 주기를 끄지 않는다 — 판을 닫아도 버린 연습이 뒤늦게 선다', 'finally{keepOpening=null;if(kept)', 'finally{if(kept)'],
  ['shell', '이번 주 계획 판의 다시 그리기가 여는 중인 연습을 잇지 않는다', '  (keepScroll?redrawPanel:(...args)=>home.showPanel(...args))(', '  home.showPanel('],
  ['shell', '은행 도착의 내 위치 다시 그리기가 여는 중인 연습을 잇지 않는다', 'showNext({keepScroll:true,redraw:true});return;}', 'showNext({keepScroll:true});return;}'],
  ['shell', '뒤의 내 위치 다시 그리기가 여는 중인 연습을 잇지 않는다', 'showNext({keepScroll:true,fresh:true,redraw:true});}', 'showNext({keepScroll:true,fresh:true});}'],
  ['shell', '내 위치의 다시 그리기가 이어 주기를 쓰지 않는다', '  show(t(\'position.title\'),draw.board({', '  home.showPanel(t(\'position.title\'),draw.board({'],
  ['shell', '학생이 연 첫 계획 판도 이어 주기로 그린다 — 여는 중이던 연습이 그 판을 덮는다', '  (keepScroll?redrawPanel:(...args)=>home.showPanel(...args))(', '  redrawPanel('],
  ['shell', '시험 형식 열기를 짧은 연습으로 바꾸면 미룬 다시 그리기를 잃는다(사슬 -d-r4 GPT GA1)', 'if(skipped)queueMicrotask(()=>{if(!stopped)repaint();});', ''],
  ['shell', '앞 연습의 정리가 뒤 연습의 열기를 무효로 한다', "const resource={dispose(){if(!launching||ticket!==practiceOpen)return;", "const resource={dispose(){if(!launching)return;"],
  ['shell', '짧은 진단 결과의 「이 항목 연습하기」가 진단 전의 길을 단다 — 진단 문항이 마지막 새 연습 문항이던 능력에 연습 단추가 남는다(사슬 -d GA3)', '   const routes=after.practice;\n', '   const routes=data.practice;\n'],
  ['shell', '짧은 진단 결과의 「이 항목 연습하기」가 길 표 대신 짧은 연습만 단다(사슬 -c GC2)', '   const routes=after.practice;\n', "   const routes=new Map(position.practice.pool.map(item=>[item.skillId,{route:'practice',skillId:item.skillId}]));\n"],
  ['routes', '「이 항목 연습하기」의 짧은 연습 길이 연습을 열지 않는다(사슬 -c GB1)', "way?.route==='game'?launchGame(way.gameId):startPractice(id)", "way?.route==='game'?launchGame(way.gameId):null"],
  ['routes', '계획의 짧은 연습 공급을 있음 · 없음으로만 넘긴다(사슬 -c GB2)', '   if(fresh>0)practice[id]=fresh;\n', '   if(fresh>0)practice[id]=1;\n'],
  ['routes', '계획 판의 게임 단추가 게임을 열지 않는다 — 속성은 그대로라 글만 보면 같다(새 사슬 GB1)', 'launchGame(button.dataset.planGame)', 'null'],
  ['routes', '문항이 없는 ko.listening.word에 게임 공급을 넣는다 — 계획이 열 것 없는 게임을 숙제로 낸다(새 사슬 GB2)', '  return {practice,listening};\n', "  listening['ko.listening.word']=['world.play.runner'];\n  return {practice,listening};\n"],
  ['routes', 'TOPIK II 판으로 옮길 때 nextData가 만남을 선택적 호출로 따로 묻는다(새 사슬 GB3)', '  const summary=coachNow.summary(),diagnostic=routes.pools.diagnostic,practice=routes.pools.practice,rows=routes.rows;\n', "  const summary=coachNow.summary(),diagnostic=routes.pools.diagnostic,practice=routes.pools.practice,rows=routes.rows;if(exam==='topik2')coachNow.exposures?.(practice);\n"],
  // ── 4-6e-2 기록이 바뀐 셈(입구 createWriteCount — world-atlas-next.mjs) ──
  ['entry', '쓰기에서 셈 올림을 뺀다 — 목록에 없는 화면 · 답 없이 닫은 판의 쓰기를 길 표가 모른다(설계 주인 25-12의 16)', "      const counted = call => (...args) => {\n        try {\n          return call(...args);\n        } finally {\n          bump();\n        }\n      };\n", "      const counted = call => (...args) => call(...args);\n"],
  ['entry', '순간 맞춤 손잡이를 감싸지 않는다 — 주문 폭주 · 레이싱의 손잡이 길 제시 · 답이 셈을 올리지 않아 길 표가 판 끝 수에만 기댄다(4-6e-2 검수 Fable F1)', '            ? (...args) => handleOf(made.live(...args))\n', '            ? (...args) => made.live(...args)\n'],
  ['entry', '길 표 열쇠에서 받기 알림 셈을 뺀다 — 다른 탭에서 마친 판을 길 표가 모른다(§21-20 시험 3)', "              made.watch((...args) => {\n                bump();\n                return listener(...args);\n              })\n", "              made.watch(listener)\n"],
  // ── 4-6e-2 검수 GPT GC1 · GC3(판 기록의 비운 세대 막이 · 세대 0 옛 꼴 읽기) ──
  ['next', '판 기록이 비운 세대 표지를 보지 않는다 — 다른 탭이 비운 뒤 늦게 끝난 판이 방금 지운 열쇠에 줄을 되살린다(4-6e-2 검수 GPT GC1)', '    if (Number.isSafeInteger(mark) && mark > Math.max(gen, opened?.mark ?? 0)) return true;\n', ''],
  ['next', '판 기록이 다음 세대 판 기록을 보지 않는다 — 표지를 못 읽은 저장소에서 비운 것을 모르는 탭이 쓴다(GC1)', '    return Boolean(next) && quiet(() => storage?.getItem?.(next)) != null;\n', '    return false;\n'],
  ['next', '판 기록의 저장이 막이를 보지 않는다(GC1)', '    !stale() &&\n', ''],
  ['next', '세대 0의 옛 꼴을 이어받기 전에는 읽지 않는다 — 가득 찬 저장소에서 이번 주 수와 마지막 다시 확인이 빠진다(4-6e-2 검수 GPT GC3)', ': (inherited(value) ?? []);\n', ': [];\n'],
  ['entry', '판 기록에 비운 세대 읽개를 넘기지 않는다 — 다른 탭이 비운 뒤 늦게 끝난 게임 판이 판 기록을 되살린다(4-6e-2 검수 GPT GC1)', 'gen: gens.get(made) ?? null, cleared: () => clearedGen(store, name), opened: openedWith.get(made) ?? null })', 'gen: gens.get(made) ?? null })'],
  ['next', '판 기록이 열 때 이미 있던 비운 세대 표지도 다른 탭의 비우기로 본다 — IndexedDB만 잃은 기기의 판 기록이 계속 멈춘다', 'mark > Math.max(gen, opened?.mark ?? 0)', 'mark > gen'],
  ['next', '판 기록이 열 때 이미 있던 다음 세대 열쇠도 다른 탭의 비우기로 본다 — IndexedDB만 잃은 기기의 판 기록이 계속 멈춘다', '    const next = gen + 1 > (opened?.last ?? 0) ? planLogKey(store, gen + 1) : null;\n', '    const next = planLogKey(store, gen + 1);\n'],
  ['entry', '입구가 열기 전에 본 값을 판 기록에 넘기지 않는다 — IndexedDB만 잃은 기기의 판 기록이 계속 멈춘다', ', opened: openedWith.get(made) ?? null })', ' })'],
];

// 없는 갈래 이름이면 아무 변형도 돌리지 않고 0으로 끝나던 것을 멈춘다(4-4b 끝 판 GPT GB1).
const at = process.argv.indexOf('--갈래');
const only = at >= 0 ? process.argv[at + 1] : null;
if (at >= 0 && !Object.hasOwn(PLAN_SOURCES, only ?? '')) {
  console.log(`없는 갈래다: ${only ?? '(빈 값)'} — ${Object.keys(PLAN_SOURCES).join(' · ')} 가운데 하나를 준다`);
  process.exit(2);
}
// 시험 묶음 안에서 이 실행기를 불러도 장면 시험이 돌게 NODE_TEST_CONTEXT를 지운다 — 두면 node가 「겹쳐 부른 시험」으로 보고 파일을 하나도
// 돌리지 않은 채 0으로 끝나, 깨지 않은 사본의 확인은 통과하고 모든 변형이 살아남은 것으로 보인다(4-4b 끝 판 GPT GB2 — position-mutants와 같은 고침).
// 통과는 종료 코드 0이면서 통과한 시험이 하나 이상일 때다.
function run(source, copy) {
  const env = { ...process.env, [source.env]: copy };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...source.scenes.map(name => path.join(here, name))], {
    env,
    encoding: 'utf8',
  });
  return result.status === 0 && /^# pass [1-9]/m.test(result.stdout ?? '');
}

let survived = 0;
let broken = 0;
let ran = 0;
// 목록의 갈래 오타(PLAN_SOURCES에 없는 갈래)는 건너뛰지 않고 목록 오류로 센다(4-4b 끝 판 카본 B2).
for (const [branch, name] of PLAN_MUTANTS)
  if (!Object.hasOwn(PLAN_SOURCES, branch)) {
    console.log(`목록 오류 · ${branch} · ${name} — 없는 갈래다`);
    broken += 1;
  }
for (const [kind, source] of Object.entries(PLAN_SOURCES)) {
  if (only && kind !== only) continue;
  const file = path.join(here, '..', source.file);
  const original = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const copyOf = tag => path.join(here, '..', `.mutant-${path.basename(source.file, '.mjs')}-${process.pid}-${tag}.mjs`);
  const plain = copyOf('plain');
  fs.writeFileSync(plain, original);
  let baseline;
  try {
    baseline = run(source, plain);
  } finally {
    fs.rmSync(plain, { force: true });
  }
  if (!baseline) {
    console.log(`깨지 않은 사본이 장면 시험에 떨어졌다 — ${kind} 갈래의 변형을 돌리지 않는다`);
    broken += 1;
    continue;
  }
  for (const [index, [branch, name, from, to]] of PLAN_MUTANTS.entries()) {
    if (branch !== kind) continue;
    // 두 자리를 함께 바꾸는 변형은 바꿀 글 · 바꾼 글이 같은 길이의 목록이다 — 자리마다 꼭 한 번 있어야 한다. 차례대로 바꾸므로 셈도 앞 자리를
    // 바꾼 뒤의 글에서 한다 — 앞 바꿈이 뒤 바꿀 글을 지우거나 새로 만들면 목록 오류다(4-6e-2 검수 GPT GB5).
    const froms = [from].flat();
    const tos = [to].flat();
    // 원본에서도 저마다 꼭 한 번 있어야 한다 — 앞 바꿈이 만든 글을 뒤 바꿀 글로 세지 않는다(사슬 -c GB5).
    const counts = froms.map(part => original.split(part).length - 1);
    let mutated = original;
    for (const [at, part] of froms.entries()) {
      const now = mutated.split(part).length - 1;
      if (now !== 1) counts[at] = now;
      else if (at < tos.length) mutated = mutated.replace(part, () => tos[at]);
    }
    if (froms.length !== tos.length || counts.some(count => count !== 1)) {
      console.log(`목록 오류 · ${branch} · ${name} — 바꿀 글이 ${counts.join(' · ')}번 있다${froms.length !== tos.length ? ' · 바꾼 글의 수가 다르다' : ''}`);
      broken += 1;
      continue;
    }
    const copy = copyOf(index);
    fs.writeFileSync(copy, mutated);
    try {
      ran += 1;
      const caught = !run(source, copy);
      if (!caught) survived += 1;
      console.log(`${caught ? '잡음' : '살아남음'} · ${branch} · ${name}`);
    } finally {
      fs.rmSync(copy, { force: true });
    }
  }
}
console.log(`변형 ${ran} · 살아남음 ${survived} · 목록 오류 ${broken}`);
if (!ran && !broken) {
  console.log('돌린 변형이 없다 — 목록이나 갈래를 확인한다');
  process.exit(2);
}
process.exit(broken ? 2 : survived ? 1 : 0);
