#!/usr/bin/env node
// 4-4a 「내 위치」 새 판(world-position-next.mjs)과 짧은 진단 새 판(world-diagnostic-next.mjs)의 변형 시험(Atlas 재설계 단계4_계획 §21-11
// 「변형」). 두 모듈의 규칙을 하나씩 일부러 깬 사본을 같은 폴더에 만들어 장면 시험(qa/atlas-next-position.test.mjs ·
// qa/atlas-next-diagnostic.test.mjs)이 잡는지 본다. 원본은 건드리지 않는다. 사본은 점으로 시작하는 이름(서버가 내지 않는다)이고 끝나면 지운다.
// 장면 시험은 SYNK_POSITION_NEXT_MODULE · SYNK_DIAGNOSTIC_NEXT_MODULE이 가리키는 사본을 받는다. 깨지 않은 사본이 먼저 통과해야 변형을 돌린다.
// 두 모듈의 규칙을 더하거나 고치면 여기에 깬 변형을 함께 더한다(설계 주인이 짚은 셋 가운데 「level 조건을 뺌」이 여기 있다 — 「묶음 만남이 한
// 문항을 다르게 냄」은 packages/atlas/tools/mutants/coach.mjs, 「숙제 연습의 층 9 거름을 뺌」은 4-4b에서 더한다).
// 쓰는 법: node experiences/synk-world-app/qa/position-mutants.mjs [--갈래 <갈래>]
// 종료코드: 0 = 모든 변형을 잡음 · 1 = 살아남은 변형이 있음 · 2 = 목록 오류 또는 깨지 않은 사본이 장면 시험에 떨어짐
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODULES = {
  position: {
    source: path.join(here, '..', 'world-position-next.mjs'),
    scenes: path.join(here, 'atlas-next-position.test.mjs'),
    env: 'SYNK_POSITION_NEXT_MODULE',
  },
  diagnostic: {
    source: path.join(here, '..', 'world-diagnostic-next.mjs'),
    scenes: path.join(here, 'atlas-next-diagnostic.test.mjs'),
    env: 'SYNK_DIAGNOSTIC_NEXT_MODULE',
  },
};

// 변형 하나 = [모듈, 갈래, 이름, 바꿀 글, 바꾼 글]. 바꿀 글은 그 모듈에 꼭 한 번 있어야 한다.
export const POSITION_MUTANTS = [
  [
    'position',
    '칸 규칙',
    '다의 길에서 peak 조건을 뺀다 — 쉬운 난도 넷으로 막힌 어려운 난도의 능력이 풀린다(설계 주인 11-15 · 11-16)',
    "  if (streak >= policy.streak && Number.isFinite(peak) && peak >= top) return 'independent';\n",
    "  if (streak >= policy.streak) return 'independent';\n",
  ],
  [
    'position',
    '칸 규칙',
    '닿을 수 있는 칸에서도 다의 길을 연다 — 처음 보는 문항이 남은 ①이 풀린다(설계 주인 11-16 · 카본 A1)',
    "  if (!stuck) return 'practicing';\n",
    '',
  ],
  [
    'position',
    '칸 규칙',
    'peak 대신 마지막 답의 level로 본다 — ②가 내려가고 peak이 없는 옛 요약이 풀린다(카본 A1)',
    '  const peak = line?.peak;\n',
    '  const peak = line?.level;\n',
  ],
  [
    'position',
    '칸 규칙',
    'peak이 없는 옛 요약도 푼다(설계 주인 11-16의 조건 3)',
    "  if (streak >= policy.streak && Number.isFinite(peak) && peak >= top) return 'independent';\n",
    "  if (streak >= policy.streak && (peak ?? top) >= top) return 'independent';\n",
  ],
  [
    'position',
    '칸 규칙',
    'F를 모르면 닿을 수 없는 칸으로 본다 — unseen이 없어도 다의 길이 열린다',
    '    return Number.isSafeInteger(value) && value >= 0 ? value : null;\n',
    '    return Number.isSafeInteger(value) && value >= 0 ? value : 0;\n',
  ],
  [
    'position',
    '칸 규칙',
    '닿는가의 표본 문턱을 넘음(>)으로 센다 — 다 맞혀 첫 답 4개에 닿는 칸을 닿을 수 없다고 본다',
    '  return independent >= policy.sample && correct * den >= independent * num;\n',
    '  return independent > policy.sample && correct * den >= independent * num;\n',
  ],
  [
    'position',
    '칸 규칙',
    '닿는가의 비율 문턱을 넘음(>)으로 센다 — 다 맞혀 정확히 0.8에 닿는 칸을 닿을 수 없다고 본다',
    '  return independent >= policy.sample && correct * den >= independent * num;\n',
    '  return independent >= policy.sample && correct * den > independent * num;\n',
  ],
  [
    'position',
    '다의 길의 F',
    '만남을 모르는 문항을 만난 것으로 센다 — F가 줄어 닿을 수 있는 칸을 닿을 수 없다고 본다',
    '      if (exposures[i]?.met === true || quiet(() => skip(item)) === true) return;\n',
    '      if (exposures[i]?.met !== false || quiet(() => skip(item)) === true) return;\n',
  ],
  [
    'position',
    '다의 길의 F',
    '같은 계열을 문항마다 센다',
    '      families.get(key).add(item.familyKey || item.itemKey);\n',
    '      families.get(key).add(item.itemKey);\n',
  ],
  [
    'position',
    '다의 길의 F',
    '뺀 문항(레이싱)도 센다 — 새 길이 지금 낼 수 없는 문항으로 닿을 수 있다고 본다',
    '      if (exposures[i]?.met === true || quiet(() => skip(item)) === true) return;\n',
    '      if (exposures[i]?.met === true) return;\n',
  ],
  [
    'position',
    '칸 규칙',
    '맞힌 비율 문턱을 넘음(>)으로 센다 — 정확히 0.8인 칸이 연습 중이 된다',
    '  if (independent >= policy.sample && correct * den >= independent * num) return \'independent\';\n',
    "  if (independent >= policy.sample && correct * den > independent * num) return 'independent';\n",
  ],
  [
    'position',
    '칸 규칙',
    '표본 문턱을 넘음(>)으로 센다 — 첫 답 4개인 칸이 연습 중이 된다',
    'if (independent >= policy.sample && correct * den',
    'if (independent > policy.sample && correct * den',
  ],
  [
    'position',
    '칸 규칙',
    '본 난도 가운데 하나만 혼자 해냄이어도 능력이 혼자 해냄이 된다',
    "  const open = seen.filter(level => level.cell !== 'independent');\n  if (!open.length) return 'independent';\n",
    "  const open = seen.filter(level => level.cell !== 'independent');\n  if (open.length < seen.length) return 'independent';\n",
  ],
  [
    'position',
    '방금 답한 능력',
    '칸이 아직인 능력을 끌어올리지 않는다 — 방금 답한 능력이 접히기 전 빈 칸으로 보인다(검토 A2)',
    "  if (cell === 'notyet') return { cell: 'practicing', catching: true };\n",
    "  if (cell === 'notyet') return { cell, catching: true };\n",
  ],
  [
    'position',
    '방금 답한 능력',
    '접히지 않은 놓침 뒤에도 혼자 해냄을 그대로 둔다(카본 A4)',
    "  if (cell === 'independent' && count(line?.streak) < behind)\n    return { cell: 'practicing', catching: true };\n",
    '',
  ],
  [
    'position',
    '방금 답한 능력',
    '혼자 해냄인 능력을 이어서 맞혀도 접히기 전에 연습 중으로 내린다(설계 주인 11-15의 고침을 깬다)',
    "  if (cell === 'independent' && count(line?.streak) < behind)\n",
    "  if (cell === 'independent')\n",
  ],
  [
    'position',
    '놓친 수',
    '놓친 수 · 도움받은 수를 혼자 해냄 난도까지 합한다(카본 A5)',
    "    const open = levels.filter(level => level.cell !== 'independent');\n",
    '    const open = levels;\n',
  ],
  [
    'position',
    '먼저 볼 항목',
    '먼저 볼 항목에 혼자 해냄 능력도 넣는다',
    "    .filter(skill => skill.cell === 'practicing' && skill.missed + skill.helped > 0)\n",
    '    .filter(skill => skill.missed + skill.helped > 0)\n',
  ],
  [
    'position',
    '먼저 볼 항목',
    '지금 낼 새 문항이 있는 항목을 앞세우지 않는다',
    '        b.ready - a.ready ||\n',
    '',
  ],
  [
    'position',
    '기록이 다 왔는가',
    '서버 길 계정도 받기 없이 다 온 것으로 본다(검토 A3)',
    '  return (synced?.ok === true || sync.pulled === true) && !sync.stopped && !sync.writesOff && !sync.switchOff;\n',
    '  return !sync.stopped && !sync.writesOff && !sync.switchOff;\n',
  ],
  [
    'position',
    '기록이 다 왔는가',
    '올리기가 멈춘 계정도 다 온 것으로 본다(검토 A3)',
    '  return (synced?.ok === true || sync.pulled === true) && !sync.stopped && !sync.writesOff && !sync.switchOff;\n',
    '  return synced?.ok === true || sync.pulled === true;\n',
  ],
  [
    'position',
    '기록이 다 왔는가',
    '첫 받기가 실패로 끝난 뒤 된 받기(storage.sync.pulled)를 읽지 않는다 — 기록 일부와 닫힌 진단이 문서를 새로 열 때까지 남는다(Fable 끝 판 F1)',
    '  return (synced?.ok === true || sync.pulled === true) && !sync.stopped && !sync.writesOff && !sync.switchOff;\n',
    '  return synced?.ok === true && !sync.stopped && !sync.writesOff && !sync.switchOff;\n',
  ],
  [
    'position',
    '기록이 다 왔는가',
    '동의를 끈 계정(기기 길)에도 첫 받기를 묻는다 — 진단이 영영 닫힌다(카본 A12)',
    '  if (storage.guest === true) return true;\n',
    '  if (storage.guest === true) return synced?.ok === true;\n',
  ],
  [
    'position',
    '기록이 다 왔는가',
    '보기가 기다리는 동안에도 다 온 것으로 본다',
    "  if (!storage || storage.base !== true || storage.waiting === true) return false;\n",
    "  if (!storage || storage.base !== true) return false;\n",
  ],
  [
    'position',
    '옮겨 오기 전 기록',
    '옮겨 오기 전 기록에 다른 시험의 능력도 싣는다',
    '    .filter(row => known.has(row?.id))\n',
    '    .filter(row => row?.id)\n',
  ],
  [
    'position',
    '카드',
    '이름 없는 family: 단위도 카드로 싣는다(검토 C1 · N3)',
    "        if (!row?.unit || row.kind === 'family' || typeof row.label !== 'string' || !row.label) continue;\n",
    '        if (!row?.unit) continue;\n',
  ],
  [
    'position',
    '카드',
    '생활 문항에 든 낱말 단위도 생활 복습으로 연다 — 짧은 연습에 그 낱말이 있어도 「낼 문항 없음」이 된다(11-16 4c)',
    "        if (source === 'life' && row.kind === 'life') route.life = true;\n",
    "        if (source === 'life') route.life = true;\n",
  ],
  [
    'position',
    '카드',
    '앞으로 돌아올 단위도 지금 열 수 있다고 한다(카본 A6)',
    "    if (!dueNow) why = 'not-due';\n    else if (route.life ?",
    '    if (route.life ?',
  ],
  [
    'position',
    '카드',
    '돌아올 때가 정해지지 않은 단위도 앞으로 돌아올 목록에 싣는다(카본 A6)',
    "    .filter(line => !now.has(line.unit) && line.due !== true && Number.isFinite(line.dueAt))\n",
    '    .filter(line => !now.has(line.unit) && line.due !== true)\n',
  ],
  [
    'position',
    '카드',
    '하루 상한 날에도 짧은 연습 카드를 연다(검토 C2)',
    "    else if (capped) why = 'capped';\n",
    '',
  ],
  [
    'position',
    '카드',
    '하루 상한 날에도 생활 카드를 연다(상한은 엔진 전체의 값 — 4-3 GB1, 11-16 4c 자체 검토)',
    "    else if (capped) why = 'capped';\n",
    "    else if (capped && !route.life) why = 'capped';\n",
  ],
  [
    'position',
    '카드',
    '소리를 끈 날에도 듣기 문항뿐인 카드를 연다(검토 C2)',
    "    else if (!route.life && !audioAvailable && !route.silent) why = 'audio';\n",
    '',
  ],
  [
    'position',
    '칸',
    '칸이 따라오는 중에도 다의 길을 연다 — 접히기 전에 잠깐 혼자 해냄으로 올랐다 내려간다(카본 끝 판 C1)',
    "  if (behind > 0) return 'practicing';\n",
    '',
  ],
  [
    'diagnostic',
    '고르기',
    '고르기가 측정용 만남(met) 대신 화면용 seen을 읽는다 — 띄우기만 한 문항을 다시 고르지 않는다(21-5 · GPT 끝 판 GA2)',
    '  const met = new Map(pool.map((item, i) => [item.id, exposures[i]?.met ?? null]));\n',
    '  const met = new Map(pool.map((item, i) => [item.id, exposures[i]?.seen ?? null]));\n',
  ],
  [
    'diagnostic',
    '진행',
    '틀린 보기도 맞은 답으로 코치에 넘긴다(카본 끝 판)',
    "          correct: choiceId === current.item.correctId,\n",
    "          correct: true,\n",
  ],
  [
    'diagnostic',
    '진행',
    '도움 없이 다시 낸 문항도 처음 만남이 아닌 것으로 낸다 — 혼자 낸 첫 답을 잃는다(카본 끝 판)',
    "        current.pid = coach.present(current.item, helped ? { firstExposure: false } : {});\n",
    "        current.pid = coach.present(current.item, { firstExposure: false });\n",
  ],
  [
    'diagnostic',
    '진행',
    '판 닫기에서 코치가 닫혔으면 던진다(카본 끝 판)',
    "      try {\n        finished = coach.finishSet(record ? { kind: 'diagnostic' } : { kind: 'diagnostic', record: false }) ?? null;\n      } catch {\n        finished = null;\n      }\n",
    "      finished = coach.finishSet(record ? { kind: 'diagnostic' } : { kind: 'diagnostic', record: false }) ?? null;\n",
  ],
  [
    'diagnostic',
    '고르기',
    '모르는 문항(null)도 처음 보는 문항으로 고른다(카본 끝 판 B1과 같은 까닭)',
    '      .filter(item => met.get(item.id) === false && !(item.setId && touched.has(item.setId)))\n',
    '      .filter(item => met.get(item.id) !== true && !(item.setId && touched.has(item.setId)))\n',
  ],
  [
    'diagnostic',
    '고르기',
    '세트의 다른 문항을 만났어도 처음 보는 문항으로 고른다',
    '      .filter(item => met.get(item.id) === false && !(item.setId && touched.has(item.setId)))\n',
    '      .filter(item => met.get(item.id) === false)\n',
  ],
  [
    'diagnostic',
    '고르기',
    '한 진단에 같은 세트에서 둘을 낸다',
    '    if (left[0].setId) usedSets.add(left[0].setId);\n',
    '',
  ],
  [
    'diagnostic',
    '고르기',
    '기록이 다 오지 않아도 진단을 연다(21-3)',
    '  if (!position.complete)\n',
    '  if (false)\n',
  ],
  [
    'diagnostic',
    '고르기',
    '레이싱 문항을 빼지 않는다 — 조각이 서기 전에 이름 없는 단위로 떨어진 문항을 낸다(21-2)',
    "  withheld: Object.freeze(['korean-racing']),\n",
    '  withheld: Object.freeze([]),\n',
  ],
  [
    'diagnostic',
    '고르기',
    '처음 볼 난도를 혼자 해냄 난도까지 센다',
    "  for (const level of skill.levels ?? []) if (level.cell !== 'independent') return level.difficulty;\n",
    '  for (const level of skill.levels ?? []) return level.difficulty;\n',
  ],
  [
    'diagnostic',
    '고르기',
    '소리를 끈 날에도 듣기 문항을 낸다',
    '    const playable = audioAvailable ? mine : mine.filter(item => !listeningOf(item));\n',
    '    const playable = mine;\n',
  ],
  [
    'diagnostic',
    '진행',
    '다시 낸 문항에 앞 제시의 넘긴 다시 듣기(도움)를 이어 남기지 않는다 — 도움받은 답이 혼자 맞힘이 된다(카본 A7)',
    "        for (let n = 0; n < current.plays.extra; n += 1) coach.help(current.pid, 'replay');\n",
    '',
  ],
  [
    'diagnostic',
    '진행',
    '다시 낸 문항에 앞 제시의 끝까지 들은 재생을 이어 남기지 않는다(카본 A7)',
    "        for (let n = 0; n < current.plays.completed; n += 1)\n          coach.delivery(current.pid, { audio: 'completed' });\n",
    '',
  ],
  [
    'diagnostic',
    '진행',
    '끝까지 듣기 전에도 답을 받는다',
    '      if (!current || current.answered || disposed || !current.heard) return null;\n',
    '      if (!current || current.answered || disposed) return null;\n',
  ],
  [
    'diagnostic',
    '진행',
    '코치가 닫힌 뒤에도 진단이 닫혔음을 알리지 않는다(검토 C4)',
    '      if (error?.code === \'DISPOSED\') {\n        end();\n        return null;\n      }\n      if (error?.code !== \'PRESENTATION_GONE\') throw error;\n',
    "      if (error?.code !== 'PRESENTATION_GONE') throw error;\n",
  ],
  [
    'diagnostic',
    '진행',
    '판을 두 번 닫는다',
    '      if (finished !== null) return finished;\n',
    '',
  ],
  [
    'diagnostic',
    '진행',
    '학습자 응답이 꺼진 날에도 판 기록을 남긴다(지금 판 finishSet의 규칙)',
    "        finished = coach.finishSet(record ? { kind: 'diagnostic' } : { kind: 'diagnostic', record: false }) ?? null;\n",
    "        finished = coach.finishSet({ kind: 'diagnostic' }) ?? null;\n",
  ],
  [
    'diagnostic',
    '진행',
    '그만두기에서 판을 닫지 않는다 — 손님 칸이 그 답으로 접히지 않고 다음 진단이 그만둔 판으로 묶인다(Fable 끝 판 F2)',
    "          finished = coach.finishSet({ kind: 'diagnostic', record: false }) ?? null;\n",
    '          finished = null;\n',
  ],
  [
    'diagnostic',
    '진행',
    '문항을 내기 전에 그만두어도 판을 닫는다 — 이 진단이 열지 않은 판을 닫는다(Fable 끝 판 F2)',
    '      if (finished === null && !disposed && index >= 0) {\n',
    '      if (finished === null && !disposed) {\n',
  ],
];

// 시험 묶음 안에서 이 실행기를 불러도 장면 시험이 돌게 NODE_TEST_CONTEXT를 지운다 — 빈 글로 두면 node가 「겹쳐 부른 시험」으로 보고 파일을
// 하나도 돌리지 않은 채 0으로 끝나 모든 변형이 살아남은 것으로 보인다(11-16 실측).
function run(target, copy) {
  const { scenes, env: name } = MODULES[target];
  const env = { ...process.env, [name]: copy };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=dot', scenes], {
    encoding: 'utf8',
    env,
    timeout: 600_000,
  });
  return result.status === 0 && /\./.test(result.stdout ?? '');
}

const at = process.argv.indexOf('--갈래');
const only = at >= 0 ? process.argv[at + 1] : null;
const originals = Object.fromEntries(
  Object.entries(MODULES).map(([name, { source }]) => [name, fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n')]),
);
const copyOf = (target, tag) => path.join(here, '..', `.mutant-${target}-next-${process.pid}-${tag}.mjs`);

for (const target of Object.keys(MODULES)) {
  const plain = copyOf(target, 'plain');
  fs.writeFileSync(plain, originals[target]);
  let ok;
  try {
    ok = run(target, plain);
  } finally {
    fs.rmSync(plain, { force: true });
  }
  if (!ok) {
    console.log(`깨지 않은 ${target} 사본이 장면 시험에 떨어졌다 — 변형을 돌리지 않는다`);
    process.exit(2);
  }
}

let survived = 0;
let broken = 0;
let ran = 0;
for (const [index, [target, branch, name, from, to]] of POSITION_MUTANTS.entries()) {
  if (only && branch !== only) continue;
  const original = originals[target];
  const found = original.split(from).length - 1;
  if (found !== 1) {
    console.log(`목록 오류 · ${branch} · ${name} — 바꿀 글이 ${found}번 있다`);
    broken += 1;
    continue;
  }
  const copy = copyOf(target, index);
  fs.writeFileSync(copy, original.replace(from, to));
  try {
    ran += 1;
    const caught = !run(target, copy);
    if (!caught) survived += 1;
    console.log(`${caught ? '잡음' : '살아남음'} · ${branch} · ${name}`);
  } finally {
    fs.rmSync(copy, { force: true });
  }
}
console.log(`변형 ${ran} · 살아남음 ${survived} · 목록 오류 ${broken}`);
process.exit(broken ? 2 : survived ? 1 : 0);
