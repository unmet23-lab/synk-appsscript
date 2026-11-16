#!/usr/bin/env node
// 4-4b 이번 주 계획 새 판의 변형 시험(Atlas 재설계 단계4_계획 §21-11 「변형」). 계획 셈의 읽개 갈래(world-exam-plan.mjs), 새 계획 모듈
// (world-plan-next.mjs — 읽개 · 시작점 · 기기 판 기록), 셸의 배선(world-learning-ui.mjs — 묶음 만남 다시 묻기 · 판 기록)의 규칙을 하나씩 일부러 깬
// 사본을 같은 폴더에 만들어 장면 시험이 잡는지 본다. 홈 계획(world-today.mjs)의 4-4b 변형은 qa/today-mutants.mjs에 있다. 원본은 건드리지 않는다.
// 사본은 점으로 시작하는 이름(서버가 내지 않는다)이고 끝나면 지운다. 장면 시험은 갈래마다 정한 환경 변수가 가리키는 사본을 받는다. 깨지 않은
// 사본이 먼저 통과해야 그 갈래의 변형을 돌린다(사본을 못 받아 모든 변형이 「잡음」이 되는 일을 막는다). 4-4b의 계획 규칙을 더하거나 고치면 여기에
// 깬 변형을 함께 더한다. 지금 판의 셈(읽개 없는 호출)을 바꾸는 변형은 고치기 전 함수와의 대조(qa/world-exam-plan-reader.test.mjs)가 잡는다.
// 쓰는 법: node experiences/synk-world-app/qa/plan-mutants.mjs [--갈래 exam|next|shell]
// 종료코드: 0 = 모든 변형을 잡음 · 1 = 살아남은 변형이 있음 · 2 = 목록 오류 또는 깨지 않은 사본이 장면 시험에 떨어짐
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PLAN_SOURCES = Object.freeze({
  exam: { file: 'world-exam-plan.mjs', env: 'SYNK_EXAM_PLAN_MODULE', scenes: ['atlas-next-plan.test.mjs', 'world-exam-plan-reader.test.mjs'] },
  next: { file: 'world-plan-next.mjs', env: 'SYNK_PLAN_NEXT_MODULE', scenes: ['atlas-next-plan.test.mjs'] },
  shell: { file: 'world-learning-ui.mjs', env: 'SYNK_LEARNING_UI_MODULE', scenes: ['atlas-next-plan-shell.test.mjs', 'atlas-next-practice-shell.test.mjs'] },
});

const KEY = "  const key=[homePlanner.todayKey(now),planEnds,info.type,N.recordsComplete(summary.storage,synced)].join('|');\n";
const START = ' const start=reader?complete&&reader.start?.(skills.map(skill=>skill.id))===true:';
const HOMEWORK = ' const homework=skills.filter(reader?weakNext:weakOf).map(skill=>{';
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
  ['next', '판 기록이 넘칠 때 마지막 다시 확인을 남기지 않는다', '      if (check && !kept.includes(check)) kept = [check, ...kept.slice(1)];\n', ''],
  ['next', '판 기록의 영역을 가리지 않는다', '      if (!key || !PLAN_LOG_AREAS.includes(area) || !Number.isFinite(at)) return false;\n', '      if (!key || !Number.isFinite(at)) return false;\n'],
  ['next', '지난 다시 확인을 그 때 뒤에서도 고른다', "        .filter(row => row.area === 'recheck' && row.at < before)\n", "        .filter(row => row.area === 'recheck')\n"],
  ['next', '판 기록 열쇠에 저장소 이름을 쓰지 않는다 — 손님 · 계정 · 동의 판의 기록이 섞인다(검토 D5)', "export const planLogKey = store => (typeof store === 'string' && store ? PLAN_LOG_PREFIX + store : null);", "export const planLogKey = store => (typeof store === 'string' && store ? PLAN_LOG_PREFIX : null);"],
  ['next', '이 기기의 판 기록을 이번 주 횟수에 넣지 않는다', '  const device = PLAN_LOG_AREAS.map(area => ({ area, times: quiet(() => log?.times(area)) ?? [] }));\n', '  const device = [];\n'],
  ['next', '쓰기 연습의 기기 시각을 세지 않는다', "    { area: 'writing', times: Array.isArray(writingTimes) ? writingTimes : [] },\n", ''],
  ['next', '지난 다시 확인을 판 기록에서 읽지 않는다', '    lastCheckAt: quiet(() => log?.lastCheck(week.start)) ?? null,\n', '    lastCheckAt: null,\n'],
  ['next', '말하기를 고른 학생의 시험 정보에 말하기를 붙이지 않는다', '    exam: speaking ? { ...info, speaking: true } : info,\n', '    exam: info,\n'],
  ['next', '계획에 「이 기기에서 센 수」 표지를 넘기지 않는다', "    doneScope: 'device',\n", ''],
  // ── 셸의 배선(world-learning-ui.mjs — weekNext · planOnce) ──
  ['shell', '판이 끝나도 묶음 만남을 다시 묻지 않는다 — 진단 뒤에도 시작점이 그날 그대로다(카본 A8)', KEY, "  const key=[homePlanner.todayKey(now),info.type,N.recordsComplete(summary.storage,synced)].join('|');\n"],
  ['shell', '목표 시험을 바꿔도 묶음 만남을 다시 묻지 않는다(카본 A8)', KEY, "  const key=[homePlanner.todayKey(now),planEnds,N.recordsComplete(summary.storage,synced)].join('|');\n"],
  ['shell', '기록이 다 와도 묶음 만남을 다시 묻지 않는다 — 기록 일부일 때의 판정이 그날 내내 굳는다(카본 A8)', KEY, "  const key=[homePlanner.todayKey(now),planEnds,info.type].join('|');\n"],
  ['shell', '다시 그릴 때마다 묶음 만남을 묻는다 — 홈이 그릴 때마다 풀 전체를 훑는다', '  if(weekMet.coach!==coachNow||weekMet.key!==key)weekMet={coach:coachNow,key,met:coachNow.exposures([...diagnostic,...practice])};\n', '  weekMet={coach:coachNow,key,met:coachNow.exposures([...diagnostic,...practice])};\n'],
  ['shell', '판 기록을 열지 않고 계획을 짓는다 — 이번 주에 한 판을 세지 못한다', '  const examPlan=N.buildPlanNext({examPlan:position.exam,info,reader,log:homeNext?.planLog?.(coachNow)??null,', '  const examPlan=N.buildPlanNext({examPlan:position.exam,info,reader,log:null,'],
  ['shell', '진단이 낼 문항이 있어도 홈에 알리지 않는다 — 점검 칸이 빈다', '  return examPlan?{examPlan,fresh:item=>seenOf(item)===false,diagnostic:{ready}}:null;\n', '  return examPlan?{examPlan,fresh:item=>seenOf(item)===false,diagnostic:{ready:false}}:null;\n'],
  ['shell', '새 길 홈에 이번 주 계획을 넘기지 않는다 — 계획 입구 · 허브 줄 · 알림이 읽을 계획이 없다', '   labels:id=>skillLabel(id),opened:opened.kinds,lang,say:why=>homePlanner.say(why,lang),week});\n', '   labels:id=>skillLabel(id),opened:opened.kinds,lang,say:why=>homePlanner.say(why,lang)});\n'],
  ['shell', '건너뛴 문항뿐인 판도 판 기록에 센다', "   if(!(Array.isArray(results)?results:[]).some(row=>row&&!row.skipped&&(row.verdict==='correct'||row.verdict==='incorrect')))return;\n", ''],
  // 판 기록의 「한 판에 한 번」 막이(planOnce의 done)를 빼는 변형은 두지 않는다 — 판 끝은 그만둔 판에서(ended), 그만두기는 끝난 판에서(ended)
  // 이미 그치므로 화면으로는 두 번째 부름에 닿지 않는다(같은 동작 변형 · 11-16 4c 실측). 막이는 판 끝과 그만두기가 바뀌어도 두 번 세지 않게 둔 것이다.
  ['shell', '진단을 다시 확인이 아닌 영역으로 적는다', "  const counted=planOnce(coachNow,'recheck'); // 이번 주 계획의 다시 확인(4-4b)\n", "  const counted=planOnce(coachNow,'reading'); // 이번 주 계획의 다시 확인(4-4b)\n"],
  ['shell', '진단 판 끝에 판 기록을 적지 않는다', '   counted(session.results());\n   // 저장을 기다리는 사이 판이 닫혔거나', '   // 저장을 기다리는 사이 판이 닫혔거나'],
  ['shell', '진단을 그만둘 때 판 기록을 적지 않는다', 'if(session.results().length)diagnosed=true;counted(session.results());', 'if(session.results().length)diagnosed=true;'],
  ['shell', '짧은 연습의 영역을 늘 읽기로 적는다', "  const counted=planOnce(next,listening?'listening':'reading'); // 이번 주 계획의 영역(4-4b)\n", "  const counted=planOnce(next,'reading'); // 이번 주 계획의 영역(4-4b)\n"],
  ['shell', '짧은 연습 판 끝에 판 기록을 적지 않는다', '   counted(results);\n   if(!box.isConnected)return;\n', '   if(!box.isConnected)return;\n'],
  ['shell', '짧은 연습을 도중에 닫을 때 판 기록을 적지 않는다', 'try{session.stop();}catch{}counted(session.results());queueMicrotask(()=>refresh());};', 'try{session.stop();}catch{}queueMicrotask(()=>refresh());};'],
];

const at = process.argv.indexOf('--갈래');
const only = at >= 0 ? process.argv[at + 1] : null;
function run(source, copy) {
  const result = spawnSync(process.execPath, ['--test', ...source.scenes.map(name => path.join(here, name))], {
    env: { ...process.env, [source.env]: copy },
    encoding: 'utf8',
  });
  return result.status === 0;
}

let survived = 0;
let broken = 0;
let ran = 0;
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
    const count = original.split(from).length - 1;
    if (count !== 1) {
      console.log(`목록 오류 · ${branch} · ${name} — 바꿀 글이 ${count}번 있다`);
      broken += 1;
      continue;
    }
    const copy = copyOf(index);
    fs.writeFileSync(copy, original.replace(from, () => to));
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
process.exit(broken ? 2 : survived ? 1 : 0);
