#!/usr/bin/env node
// 4-4a 「내 위치」 새 판(world-position-next.mjs)과 짧은 진단 새 판(world-diagnostic-next.mjs)의 변형 시험(Atlas 재설계 단계4_계획 §21-11
// 「변형」). 두 모듈의 규칙을 하나씩 일부러 깬 사본을 같은 폴더에 만들어 장면 시험(qa/atlas-next-position.test.mjs ·
// qa/atlas-next-diagnostic.test.mjs)이 잡는지 본다. 원본은 건드리지 않는다. 사본은 점으로 시작하는 이름(서버가 내지 않는다)이고 끝나면 지운다.
// 장면 시험은 SYNK_POSITION_NEXT_MODULE · SYNK_DIAGNOSTIC_NEXT_MODULE이 가리키는 사본을 받는다. 깨지 않은 사본이 먼저 통과해야 변형을 돌린다.
// 셸(world-learning-ui.mjs)의 새 판 배선도 같은 꼴로 본다 — 사본을 SYNK_LEARNING_UI_MODULE로 넘겨 셸 장면 시험(qa/atlas-next-position-shell.test.mjs)이
// 잡는지 본다(4-4a 끝 판 F1 · F2 · F3와 다시 검수의 초점 · 11-16 오후의 받기 알림(§21-20) — 11-16까지 손으로 돌리던 셸 변형을 여기에 올렸다, Fable 다시 검수).
// 두 모듈의 규칙을 더하거나 고치면 여기에 깬 변형을 함께 더한다(설계 주인이 짚은 셋 가운데 「level 조건을 뺌」이 여기 있다 — 「묶음 만남이 한
// 문항을 다르게 냄」은 packages/atlas/tools/mutants/coach.mjs, 「숙제 연습의 층 9 거름을 뺌」은 4-4b에서 더한다).
// 30일째 문장의 계정 길(world-month-answer.mjs — 학습일 답의 저장 · 견주기 · 묻기와 받기의 상한)도 같은 꼴로 본다 — 사본을 SYNK_MONTH_ANSWER_MODULE로
// 넘겨 셈 시험(qa/atlas-next-month-answer.test.mjs)이 잡는지 본다(4-4c 둘째 묶음 — 설계 주인 11-16 밤 조건 3).
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
  lookback: {
    source: path.join(here, '..', 'world-lookback-next.mjs'),
    scenes: path.join(here, 'atlas-next-month.test.mjs'),
    env: 'SYNK_LOOKBACK_NEXT_MODULE',
  },
  // 30일째 문장의 계정 길(학습일 답 — 4-4c 둘째 묶음 §21-22). 셈 시험(묻기 · 받기 · 다시 그리기의 상한)이 진짜 엔진 코치와 리허설 서버로 돈다.
  monthAnswer: {
    source: path.join(here, '..', 'world-month-answer.mjs'),
    scenes: path.join(here, 'atlas-next-month-answer.test.mjs'),
    env: 'SYNK_MONTH_ANSWER_MODULE',
  },
  shell: {
    source: path.join(here, '..', 'world-learning-ui.mjs'),
    scenes: path.join(here, 'atlas-next-position-shell.test.mjs'),
    env: 'SYNK_LEARNING_UI_MODULE',
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
  [
    'shell',
    "셸 진단 끝",
    "F2 셸 — 저장을 기다리는 사이 판이 닫히면 판을 닫지 않는다(옛 줄)",
    "if(!finishing||!box.isConnected){try{session.finish({record:false});}catch{/* 닫힌 코치 */}return;}",
    "if(!finishing||!box.isConnected)return;",
  ],
  [
    'shell',
    "셸 진단 끝",
    "F3 — 끝 화면이 접기를 기다리지 않는다(옛 줄)",
    "if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped||!box.isConnected)return;}",
    "",
  ],
  [
    'shell',
    "셸 진단 끝",
    "F3 — 서버 길 계정도 접기를 기다린다",
    "if(local&&set?.folded){",
    "if(set?.folded){",
  ],
  [
    'shell',
    "셸 진단 끝",
    "F2 셸 — 그만둔 뒤 접히면 다시 그리지 않는다",
    "if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});",
    "",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 다시 그리기 전에 판 안의 초점을 읽지 않는다(설계 주인 11-16 조건 3)",
    ",focusKey=keepScroll?nextFocusOf(panelNode('[data-position-next]')):null,",
    ",focusKey=null,",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 판 밖의 초점도 판으로 가져온다(조건 3)",
    "if(!root||!active||typeof root.contains!=='function'||!root.contains(active))return null;",
    "if(!root||!active)return null;",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 판 머리에 있던 초점은 되돌리지 않는다(조건 3)",
    "return row?{name:null,skill:row.getAttribute('data-skill')}:{name:null};}",
    "return row?{name:null,skill:row.getAttribute('data-skill')}:null;}",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 같은 단추가 여럿이어도 첫째로 간다(조건 3)",
    "(same[key.index]??same[0]??row??root)",
    "(same[0]??row??root)",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 다시 그린 판에 그 단추가 없으면 판 머리에 두지 않는다(조건 3)",
    "(same[key.index]??same[0]??row??root)",
    "(same[key.index]??same[0]??row)",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 다시 그린 뒤 초점을 되돌리지 않는다(조건 3)",
    "if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}",
    "if(node)node.scrollTop=scrollTop;}",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 능력 줄의 summary에 있던 초점을 판 머리로 보낸다(조건 3)",
    "if(!name){const row=String(active.tagName||'').toUpperCase()==='SUMMARY'?active.closest?.('details[data-skill]'):null;return row?{name:null,skill:row.getAttribute('data-skill')}:{name:null};}",
    "if(!name)return{name:null};",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 되돌릴 때 능력 줄의 summary를 찾지 않는다(조건 3)",
    "(same[key.index]??same[0]??row??root)",
    "(same[key.index]??same[0]??root)",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 펴 둔 능력 줄을 다시 펴지 않는다(닫힌 줄 안의 단추로 초점이 가지 않는다 — Fable 다시 검수)",
    "reopenRows(root,openRows);",
    "",
  ],
  [
    'shell',
    "셸 초점",
    "초점 — 다시 그린 뒤 스크롤 자리를 되돌리지 않는다(조건 3 · Fable 다시 검수)",
    "if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}",
    "refocusNext(root,focusKey);}",
  ],
  [
    'lookback',
    "30일째 문장 고르기",
    "이름이 서지 않는 단위도 고른다(21-4 · 카본 설계 검토 A11)",
    "    .filter(entry => typeof entry.label === 'string' && entry.label.trim());\n",
    "",
  ],
  [
    'lookback',
    "30일째 문장 고르기",
    "합이 아니라 놓친 자리 수만 본다",
    "      b.row.misses + b.row.reviews - (a.row.misses + a.row.reviews) ||\n",
    "      b.row.misses - a.row.misses ||\n",
  ],
  [
    'lookback',
    "30일째 문장 고르기",
    "합이 같을 때 해시를 보지 않는다 — 날이 바뀌어도 늘 같은 단위다",
    "      hash(`${day}|${a.row.unit}`) - hash(`${day}|${b.row.unit}`) ||\n",
    "",
  ],
  [
    'lookback',
    "30일째 문장 고르기",
    "해시에 날짜 열쇠를 넣지 않는다",
    "hash(`${day}|${a.row.unit}`) - hash(`${day}|${b.row.unit}`)",
    "hash(a.row.unit) - hash(b.row.unit)",
  ],
  [
    'lookback',
    "30일째 문장 고르기",
    "수가 깨진 줄(정수 아님 · 음수)도 고른다",
    "    .filter(row => typeof row?.unit === 'string' && count(row.misses) !== null && count(row.reviews) !== null)\n",
    "    .filter(row => typeof row?.unit === 'string')\n",
  ],
  [
    'shell',
    "셸 30일째 문장",
    "내 위치 판에 30일째 문장을 넘기지 않는다",
    "scope,month:monthOf(coachNow,P,routes)};",
    "scope};",
  ],
  [
    'shell',
    "셸 30일째 문장",
    "고르기 없이 코치가 낸 첫 줄을 쓴다 — 이름이 서지 않는 단위로 문장이 사라진다(카본 설계 검토 A11)",
    "  const pick=P.pickMonth({month:counts.month,routes,day:homePlanner.todayKey(Date.now())});\n",
    "  const pick=counts.month[0]??null;\n",
  ],
  [
    'shell',
    "셸 30일째 문장",
    "코치가 셈에서 던지면 내 위치 판을 못 그린다",
    "  let counts=null;try{counts=typeof coachNow.lookback==='function'?coachNow.lookback():null;}catch{return null;}\n",
    "  const counts=typeof coachNow.lookback==='function'?coachNow.lookback():null;\n",
  ],
  [
    'shell',
    "셸 30일째 문장",
    "그 화면 언어의 줄이 없어도 줄을 싣는다",
    "  return pick&&typeof text==='string'&&text?{text,unit:pick.unit,misses:pick.misses,reviews:pick.reviews}:null;\n",
    "  return pick?{text:String(text),unit:pick.unit,misses:pick.misses,reviews:pick.reviews}:null;\n",
  ],
  [
    'shell',
    "셸 받기 알림",
    "알림마다 다음 틱 타이머를 건다 — 잇달아 온 알림을 하나로 묶지 않는다(§21-20 조건 3)",
    "  if(heard.timer==null)heard.timer=watchClock.set(drawHeard,0);\n",
    "  heard.timer=watchClock.set(drawHeard,0);\n",
  ],
  [
    'shell',
    "셸 받기 알림",
    "판이 열린 동안에도 바로 그린다 — 진단 · 연습 판 아래의 홈이 그 자리에서 다시 그려진다(§21-20 시험 5 · 조건 3)",
    "  if(stopped||!heard.home&&!heard.panel||sessionPanel())return;\n",
    "  if(stopped||!heard.home&&!heard.panel)return;\n",
  ],
  [
    'shell',
    "셸 받기 알림",
    "새로 그려도 미룬 알림을 비우지 않는다 — 그 뒤 타이머가 같은 알림으로 또 그린다(§21-20 조건 3)",
    "  hearHome();heard.home=false;\n",
    "  hearHome();\n",
  ],
  [
    'shell',
    "셸 받기 알림",
    "홈 코치가 바뀌어도 옛 코치를 듣는다 — 판을 다시 정한 뒤의 알림이 닿지 않는다(§21-20)",
    "  if(heard.coach===coachNow)return;\n",
    "  if(heard.coach)return;\n",
  ],
  [
    'shell',
    "셸 받기 알림",
    "코치를 바꿀 때 옛 코치의 듣기를 되돌리지 않는다(§21-20 조건 1)",
    "  try{heard.off?.();}catch{/* 닫힌 코치 */}\n  heard={...heard,coach:null,off:null};\n",
    "  heard={...heard,coach:null,off:null};\n",
  ],
  [
    'shell',
    "셸 받기 알림",
    "알림으로 열린 내 위치 판을 다시 그리지 않는다 — 기록 일부 판이 받기 뒤에도 그대로다(§21-20 · Fable 끝 판 F1)",
    "  if(engineOpen&&heard.panel)redrawNext();\n",
    "",
  ],
  [
    'shell',
    "셸 받기 알림",
    "닫힌 판에도 다시 그린다 — 늦게 온 첫 받기 답이 닫은 내 위치 판을 다시 연다(GPT 다시 검수 GA1 · 카본 A1)",
    "try{if(panelOpen()&&panelNode('[data-position-next]'))showNext({keepScroll:true,fresh:true});}",
    "try{showNext({keepScroll:true,fresh:true});}",
  ],
  [
    'shell',
    "셸 받기 알림",
    "닫으며 흐려지는 판을 열린 판으로 본다 — 닫은 내 위치 판이 알림으로 다시 열린다(받기 알림 설계 검토 D1)",
    "const panelOpen=()=>panelKind()!=='';",
    "const panelOpen=()=>true;",
  ],
  [
    'shell',
    "셸 받기 알림",
    "닫으며 흐려지는 진단 판 조각을 열린 판으로 본다 — 미룬 알림이 비워지지 않아 홈이 옛 계획에 남는다(받기 알림 설계 검토 D1)",
    "const kind=panelKind();if(kind==='')return false;return LIFE_SESSIONS",
    "const kind=panelKind();return LIFE_SESSIONS",
  ],
  [
    'shell',
    "셸 받기 알림",
    "다른 까닭의 새로 그리기가 열린 판 몫의 알림까지 비운다 — 열린 내 위치 판이 옛 칸에 남는다(받기 알림 설계 검토 D4)",
    "  hearHome();heard.home=false;\n",
    "  hearHome();heard.home=false;heard.panel=false;\n",
  ],
  [
    'shell',
    '셸 30일째 문장',
    '서버 길 계정이 학습일 답으로 묻지 않는다 — 코치가 null을 내는 계정에 문장이 서지 않는다(4-4c 둘째 묶음 §21-22)',
    '  if(!counts)counts=monthAsker.month(coachNow);\n',
    '',
  ],
  [
    'shell',
    '셸 30일째 문장',
    '완결되지 않은 답의 까닭을 계기에 남기지 않는다(설계 주인 11-16 저녁 조건 2)',
    "note:code=>homeNext?.note?.('load',{ok:false,code})",
    'note:()=>{}',
  ],
  // ── 30일째 문장의 계정 길 — 학습일 답(4-4c 둘째 묶음 §21-22 「설계 검토로 고친 것」 · 「설계 다시 검수로 고친 것」) ──
  [
    'monthAnswer',
    '학습일 답 상한',
    '상한 빼기 — 완결되지 않은 답 뒤에도 그릴 때마다 묻는다(설계 다시 검수 Fable FA1 · 카본 A1 · 설계 주인 11-16 밤 조건 3)',
    '    if (state.tried?.key === key && samePosition(state.tried.from, device)) return;\n',
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 상한',
    '상한 빼기 — 기기 자리가 그대로여도 머리 차례를 가리지 못하는 답이면 다시 묻는다(설계 주인 11-16 밤 조건 3)',
    "  return samePosition(device, stored.askedFrom) ? 'behind' : 'ask';\n",
    "  return 'ask';\n",
  ],
  [
    'monthAnswer',
    '학습일 답 상한',
    '머리 차례로 가리기 빼기 — edition과 gen이 다르면 늘 다시 묻는다(11-16 저녁의 옛 규칙 · 설계 주인 11-16 밤 조건 3)',
    "  if (aheadOf(stored.at, device)) return 'behind';\n",
    "  if (stored.at.edition !== device.edition || (stored.at.gen ?? null) !== (device.gen ?? null)) return 'ask';\n  if (aheadOf(stored.at, device)) return 'behind';\n",
  ],
  [
    'monthAnswer',
    '학습일 답 상한',
    '그릴 때마다 받기를 부른다 — 받기가 끊겨도 같은 자리로 거듭 부른다(설계 주인 11-16 밤 조건 1 · 3)',
    '    if (state.pulled.has(key)) return;\n',
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 상한',
    '쓸 수 없는 답에도 다시 그린다 — 뒤처진 답을 적고 판을 다시 그린다(설계 주인 11-16 밤 조건 3)',
    '      if (samePosition(current, at)) redraw();\n      else if (current) {\n',
    '      redraw();\n      if (current) {\n',
  ],
  [
    'monthAnswer',
    '학습일 답 상한',
    '쓸 수 없는 답에도 다시 그린다 — 완결되지 않은 답 뒤에 판을 다시 그린다(설계 주인 11-16 밤 조건 3)',
    '        missed(lookbackCode(got?.reason));\n',
    '        missed(lookbackCode(got?.reason));\n        redraw();\n',
  ],
  [
    'monthAnswer',
    '학습일 답 견주기',
    '자리 견주기 빼기 — 적어 둔 답을 늘 쓴다(설계 검토 GPT GA1 · GA3 · 카본 A3 · Fable P1 — 힌트 답이 문장을 숨기지 못한다)',
    "  if (samePosition(device, stored.at)) return 'use';\n",
    "  return 'use';\n",
  ],
  [
    'monthAnswer',
    '학습일 답 견주기',
    '뒤처짐 가리기 빼기 — 물은 뒤 조금 받았지만 아직 뒤처진 기기가 다시 묻는다(설계 검토 · 설계 주인 11-16 저녁 조건 5)',
    "  if (aheadOf(stored.at, device)) return 'behind';\n",
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 견주기',
    '앞섬에 다시 묻기 빼기 — 물은 뒤 기기가 앞서도 옛 답을 뒤처짐으로 본다(낮에 조건을 채워도 문장이 서지 않는다)',
    "  return samePosition(device, stored.askedFrom) ? 'behind' : 'ask';\n",
    "  return 'behind';\n",
  ],
  [
    'monthAnswer',
    '학습일 답 견주기',
    '같은 머리의 foldedUntil로 가리기 빼기 — 다른 기기의 답을 서버가 먼저 접은 답을 뒤처짐으로 보지 않는다',
    '  return order > 0 || (order === 0 && at.edition === device.edition && at.foldedUntil > device.foldedUntil);\n',
    '  return order > 0;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 완결',
    '까닭 코드 빼기 — 완결되지 않은 답이 늘 LOOKBACK_FAILED로 남는다(설계 주인 11-16 저녁 조건 2 · 설계 검토 GPT GA2 · 카본 A2)',
    "export const lookbackCode = reason => LOOKBACK_CODES[reason] ?? 'LOOKBACK_FAILED';\n",
    "export const lookbackCode = () => 'LOOKBACK_FAILED';\n",
  ],
  [
    'monthAnswer',
    '학습일 답 완결',
    '칸 밖의 내 답이 서 있어도 묻는다 — 내 놓침이 서버에 닿기 전에 묻는다(설계 주인 11-16 저녁 조건 5)',
    "      if (storage?.guest !== false || (storage.unfolded || 0) > 0) return null;\n",
    "      if (storage?.guest !== false) return null;\n",
  ],
  [
    'monthAnswer',
    '학습일 답 완결',
    '물은 사이 칸 밖의 답이 서도 적는다 — 그 답이 빠진 낡은 답이 남는다(설계 주인 11-16 저녁 조건 5)',
    "      if (!storage || (storage.unfolded || 0) > 0) return; // 물은 사이 칸 밖의 내 답이 섰다 — 그 답이 접힌 뒤 다시 묻는다\n",
    '      if (!storage) return;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 완결',
    '첫 받기 전에도 묻는다 — 받은 요약의 자리가 없는데 묻는다(설계 다시 검수 · 설계 주인 11-16 밤 조건 2)',
    "      const device = positionOf(storage.sync?.received);\n",
    "      const device = positionOf(storage.sync?.received) ?? { edition: 'none', gen: null, foldedUntil: 0 };\n",
  ],
  [
    'monthAnswer',
    '학습일 답 지우기',
    '늦은 답의 세대 수 보기 빼기 — 로그아웃 · 동의 끔 뒤에 도착한 답이 적힌다(설계 검토 카본 A4 · Fable P2)',
    '      if (since !== generation) return false;\n',
    '',
  ],
  // ── 설계 P1 다시 보기(-c)로 고친 셋(Fable FA1 · FA2 · 카본 A1) ──
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '이 문서가 든 답을 쓰지 않는다 — 막힌 저장소에서 완결된 답 뒤에도 그릴 때마다 묻는다(Fable 다시 보기 FA1)',
    '      const stored = fresherOf(keptFor(`${owner}|${revision}|${day}`), answers.read(owner, { revision, day }));\n',
    '      const stored = answers.read(owner, { revision, day });\n',
  ],
  // `if (!storage)` 줄만 빼는 변형은 아래 try가 TypeError를 잡아 같은 false를 돌려주는 같은 꼴이라 살아남았다(11-16 밤). 되돌아갈 수 있는
  // 회귀는 고치기 전처럼 없는 저장소를 건너뛰고 참을 돌려주는 꼴이다.
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '저장소가 없어도 적었다고 한다 — 없는 저장소를 건너뛰고 참을 돌려준다(Fable 다시 보기 FA1 · 고치기 전의 꼴)',
    '      if (!storage) return false;\n      const value = { v: VERSION, revision, day, ...shapeOf({ askedFrom, at, windows, month }) };\n      try {\n        storage.setItem(keyOf(account), JSON.stringify(value));\n',
    '      const value = { v: VERSION, revision, day, ...shapeOf({ askedFrom, at, windows, month }) };\n      try {\n        storage?.setItem(keyOf(account), JSON.stringify(value));\n',
  ],
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '묻는 사이 앞선 기기가 다시 묻지 않는다 — 문장이 다음 그리기까지 서지 않는다(Fable 다시 보기 FA2)',
    "        else if (verdict === 'ask') ask(coach, line, { owner, revision, day, device: current });\n",
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '계정 · 세대가 바뀌어도 상자를 비우지 않는다 — 앞 세대의 상한과 받은 자리가 다시 들어온 계정을 막는다(카본 다시 보기 A1)',
    '    reset();\n    state.owner = owner;\n',
    '    state.owner = owner;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '끊긴 물음 · 멈춘 문서의 실패를 적는다 — 다른 계정 · 멈춘 문서의 계기와 상한을 덮는다(카본 다시 보기 A1 · 끝 판 GPT GB2)',
    "        if (alive(owner) && since === answers.generation()) missed('LOOKBACK_FAILED');\n",
    "        if (since === answers.generation()) missed('LOOKBACK_FAILED');\n",
  ],
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '물은 사이 지우는 길이 돌아도 늦은 답을 든다 — 완결된 답으로 다시 그리고, 완결되지 않은 답이 새 세대의 받은 자리를 채운다(카본 다시 보기 A1 · 끝 판 GPT GB2)',
    '      if (!alive(owner) || since !== answers.generation()) return;\n',
    '      if (!alive(owner)) return;\n',
  ],
  // ── 끝 판 검수(GPT)로 고친 둘(GB1 · GB2) ──
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '저장소의 앞 답을 먼저 본다 — 쓰기만 막혀(용량 초과) 앞 답이 남으면 같은 자리에서 묻기와 다시 그리기가 끝없이 돈다(끝 판 GPT GB1 · 고치기 전의 꼴)',
    '      const stored = fresherOf(keptFor(`${owner}|${revision}|${day}`), answers.read(owner, { revision, day }));\n',
    '      const stored = answers.read(owner, { revision, day }) ?? keptFor(`${owner}|${revision}|${day}`);\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '저장소의 더 새 답을 버린다 — 다른 탭이 적은 더 새 답 대신 이 문서의 앞 답으로 견주어 다시 묻는다(끝 판 GPT GB1)',
    '  return aheadOf(stored.at, kept.at) ? stored : kept;\n',
    '  return kept;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '멈춘 문서에 온 답을 든다 — 계정 · 문서가 바뀐 뒤 온 늦은 답을 적고 다시 그린다(끝 판 GPT GB2)',
    '      if (!alive(owner) || since !== answers.generation()) return;\n',
    '      if (since !== answers.generation()) return;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '물은 사이 지우는 길이 돈 물음의 실패를 적는다 — 앞 세대의 실패가 새 세대의 계기를 덮는다(끝 판 GPT GB2)',
    "        if (alive(owner) && since === answers.generation()) missed('LOOKBACK_FAILED');\n",
    "        if (alive(owner)) missed('LOOKBACK_FAILED');\n",
  ],
  // ── 끝 판 검수(카본)로 더한 셋(A1 · A2) ──
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '완결되지 않은 답의 앞선 자리로 받지 않는다 — 상한에 걸린 계정의 기기가 그 자리를 다음 5분 받기까지 기다린다(끝 판 카본 A2)',
    '        if (at && aheadOf(at, device)) pullOnce(coach, at);\n',
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '완결되지 않은 답이면 자리를 가리지 않고 받는다 — 같은 자리 · 기기가 앞선 답으로도 5분 막이를 깬다(끝 판 카본 A1 · A2)',
    '        if (at && aheadOf(at, device)) pullOnce(coach, at);\n',
    '        if (at) pullOnce(coach, at);\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '같은 자리의 완결된 답 뒤에도 받는다 — 쓸 수 있는 답을 그린 뒤 5분 막이를 깨는 받기를 부른다(끝 판 카본 A1)',
    '      if (samePosition(current, at)) redraw();\n',
    '      if (samePosition(current, at)) {\n        redraw();\n        pullOnce(coach, at);\n      }\n',
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

// 없는 갈래 이름이면 아무 변형도 돌리지 않고 0으로 끝나던 것을 멈춘다(4-4b 끝 판 GPT GB1 — plan · today 실행기와 같은 고침).
const at = process.argv.indexOf('--갈래');
const only = at >= 0 ? process.argv[at + 1] : null;
const BRANCHES = [...new Set(POSITION_MUTANTS.map(([, branch]) => branch))];
if (at >= 0 && !BRANCHES.includes(only)) {
  console.log(`없는 갈래다: ${only ?? '(빈 값)'} — ${BRANCHES.join(' · ')} 가운데 하나를 준다`);
  process.exit(2);
}
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
