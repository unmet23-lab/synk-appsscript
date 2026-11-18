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
// 시험 형식 새 판(world-mock-next.mjs — 4-4d §21-23의 1)은 사본을 SYNK_MOCK_NEXT_MODULE로 넘겨 장면 시험(qa/atlas-next-mock.test.mjs)이, 그 셸 배선
// (openMock의 판 셋 · runMockNext)은 셸 사본을 SYNK_LEARNING_UI_MODULE로 넘겨 qa/atlas-next-mock-shell.test.mjs가 잡는지 본다.
// 알림 시트 「시험 점검」(world-reminder-device.mjs — 4-4d §21-23의 5)은 사본을 SYNK_REMINDER_DEVICE_MODULE로 넘겨 qa/world-reminder-device.test.mjs가,
// 그 앱 배선(app-shell.mjs)은 깬 원문을 SYNK_APP_SHELL_SOURCE로 넘겨 qa/atlas-next-mock-shell.test.mjs가 잡는지 본다.
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
  // 시험 형식 새 판(4-4d — §21-23의 1): 고르기 · 진행 · 끝 한 장의 「다음 연습」. 진짜 엔진 코치로 새벽 4시 · 31분 쉼을 돈다.
  mockNext: {
    source: path.join(here, '..', 'world-mock-next.mjs'),
    scenes: path.join(here, 'atlas-next-mock.test.mjs'),
    env: 'SYNK_MOCK_NEXT_MODULE',
  },
  // 시험 형식 새 판의 셸 배선(openMock의 판 셋 · runMockNext) — 같은 셸 원천을 시험 형식 셸 장면이 본다.
  mockShell: {
    source: path.join(here, '..', 'world-learning-ui.mjs'),
    scenes: path.join(here, 'atlas-next-mock-shell.test.mjs'),
    env: 'SYNK_LEARNING_UI_MODULE',
  },
  // 알림 시트 「시험 점검」 카드(4-4d — §21-23의 5): 그린 때의 판정에 묶은 두 단추 · 열린 카드에 시험 형식 단추 더하기.
  reminder: {
    source: path.join(here, '..', 'world-reminder-device.mjs'),
    scenes: path.join(here, 'world-reminder-device.test.mjs'),
    env: 'SYNK_REMINDER_DEVICE_MODULE',
  },
  // 시험 형식 새 판과 시험 점검의 앱 배선(app-shell.mjs — 입구 감싸기 · 카드 판정 · 두 단추 · 열린 카드 맞추기)을 시험 형식 셸 시험이 원문으로 본다.
  mockAppShell: {
    source: path.join(here, '..', 'app-shell.mjs'),
    scenes: path.join(here, 'atlas-next-mock-shell.test.mjs'),
    env: 'SYNK_APP_SHELL_SOURCE',
  },
  // 셸(app-shell.mjs)은 node에서 못 올려 글 지킴이가 본다 — 깬 사본의 글을 학습일 답 셈 시험이 읽는다(4-4c 끝 판 Fable F3).
  appShell: {
    source: path.join(here, '..', 'app-shell.mjs'),
    scenes: path.join(here, 'atlas-next-month-answer.test.mjs'),
    env: 'SYNK_APP_SHELL_SOURCE',
  },
  // 새 길 입구(world-atlas-next.mjs)의 근거 줄(4-4d — §21-23의 2): 그 코치를 연 판 · 다시 닿은 나르개 — 입구 시험이 깬 사본을 받는다.
  entry: {
    source: path.join(here, '..', 'world-atlas-next.mjs'),
    scenes: path.join(here, 'atlas-next-account.test.mjs'),
    env: 'SYNK_ATLAS_NEXT_MODULE',
  },
  // 연습 기록 비우기의 입구 몫(4-5 — 단계4_계획 §22-4 · 22-1의 4): 「비우는 중」 표지 · lastClear 맞추기 · 본인 값 옮기기 · 앞 판 쓸기 · 손님
  // 비우기 · 손님 호스트의 은퇴 알림 — 입구 비우기 시험(qa/atlas-next-clear.test.mjs)이 깬 입구 사본을 받는다.
  clear: {
    source: path.join(here, '..', 'world-atlas-next.mjs'),
    scenes: path.join(here, 'atlas-next-clear.test.mjs'),
    env: 'SYNK_ATLAS_NEXT_MODULE',
  },
  // 「내가 남긴 응답」 · 짧은 연습 길이의 셸 배선(4-5 — §22-5, world-learning-ui.mjs): 응답 셸 시험(qa/world-set-response.test.mjs)이 깬 셸
  // 사본을 받는다.
  responseShell: {
    source: path.join(here, '..', 'world-learning-ui.mjs'),
    scenes: path.join(here, 'world-set-response.test.mjs'),
    env: 'SYNK_LEARNING_UI_MODULE',
  },
  // 「나」 칸(4-5 — §22-6): 목록의 거름 · 나눔 · 순서(world-me-next.mjs), 학습 화면의 몫(world-learning-ui.mjs — me · tellMe · undoMe · clearPractice),
  // 옛 엔진의 두 문(world-old-engine-doors.mjs — 셸 배선, 4-5 코드 검수 GPT GA1). 셋 다 「나」 시험(qa/atlas-next-me.test.mjs)이 깬 사본을 받는다.
  me: {
    source: path.join(here, '..', 'world-me-next.mjs'),
    scenes: path.join(here, 'atlas-next-me.test.mjs'),
    env: 'SYNK_ME_NEXT_MODULE',
  },
  meShell: {
    source: path.join(here, '..', 'world-learning-ui.mjs'),
    scenes: path.join(here, 'atlas-next-me.test.mjs'),
    env: 'SYNK_LEARNING_UI_MODULE',
  },
  doors: {
    source: path.join(here, '..', 'world-old-engine-doors.mjs'),
    scenes: path.join(here, 'atlas-next-me.test.mjs'),
    env: 'SYNK_OLD_DOORS_MODULE',
  },
  // 「나」 칸의 앱 배선(app-shell.mjs — 두 문 넘기기 · 감싸기의 clearPractice · 시트의 칸 · 한 번 더 묻기)을 「나」 시험이 원문으로 본다.
  meAppShell: {
    source: path.join(here, '..', 'app-shell.mjs'),
    scenes: path.join(here, 'atlas-next-me.test.mjs'),
    env: 'SYNK_APP_SHELL_SOURCE',
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
    "if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){if(session.results().length)diagnosed=true;queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}\n   finishing=false;unwatch();",
    "if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;if(left){if(session.results().length)diagnosed=true;queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}\n   finishing=false;unwatch();",
  ],
  [
    'shell',
    "셸 진단 끝",
    "F3 — 끝 화면이 접기를 기다리지 않는다(옛 줄)",
    "const set=session.finish({record:answering()});\n   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});return;}}",
    "const set=session.finish({record:answering()});\n   ",
  ],
  [
    'shell',
    "셸 진단 끝",
    "저장을 기다리는 사이 판만 닫히면 홈을 다시 그리지 않는다 — 홈 점검 칸이 방금 마친 진단을 모른다(시험 형식 판의 끝 판 검수 카본 E1과 같은 막이)",
    "if(left){if(session.results().length)diagnosed=true;queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}\n   finishing=false;unwatch();",
    "return;}\n   finishing=false;unwatch();",
  ],
  [
    'shell',
    "셸 진단 끝",
    "접기를 기다리는 사이 판이 닫히면 홈을 다시 그리지 않는다 — 끝낸 진단을 홈이 모른다(카본 E1과 같은 막이)",
    "const set=session.finish({record:answering()});\n   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});return;}}",
    "const set=session.finish({record:answering()});\n   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped||!box.isConnected)return;}",
  ],
  [
    'shell',
    "셸 진단 끝",
    "F3 — 서버 길 계정도 접기를 기다린다",
    "const set=session.finish({record:answering()});\n   if(local&&set?.folded){",
    "const set=session.finish({record:answering()});\n   if(set?.folded){",
  ],
  [
    'shell',
    "셸 진단 끝",
    "F2 셸 — 그만둔 뒤 접히면 다시 그리지 않는다",
    "counted(session.results());queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});",
    "counted(session.results());queueMicrotask(()=>refresh());",
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
    "reopenRows(root,openRows);const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}",
    "reopenRows(root,openRows);const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;}",
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
    "reopenRows(root,openRows);const node=root?.closest?.('#panel-content');if(node)node.scrollTop=scrollTop;refocusNext(root,focusKey);}",
    "reopenRows(root,openRows);const node=root?.closest?.('#panel-content');refocusNext(root,focusKey);}",
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
    "scope,month:monthOf(coachNow,P,routes),estimate:",
    "scope,estimate:",
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
    "손님 판도 학습일 답 상자의 막는 수를 본다 — 「이미 알아요」 · 응답 지우기 뒤 다음 판 끝까지 손님의 문장이 숨는다(카본 4-4d 설계 B4)",
    "  let counts=null;try{counts=typeof coachNow.lookback==='function'?coachNow.lookback():null;}catch{return null;}\n",
    "  let counts=null;try{counts=typeof coachNow.lookback==='function'&&!(coachNow.summary().storage.unfoldedRows>0)?coachNow.lookback():null;}catch{return null;}\n",
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
    "lineOf:coachNow=>homeNext?.lookback?.(coachNow)||null,dayOf:()=>homePlanner?homePlanner.todayKey(Date.now()):null,\n  offsetOf:()=>-new Date().getTimezoneOffset(),redraw:()=>redrawNext(),note:code=>homeNext?.note?.('load',{ok:false,code})",
    "lineOf:coachNow=>homeNext?.lookback?.(coachNow)||null,dayOf:()=>homePlanner?homePlanner.todayKey(Date.now()):null,\n  offsetOf:()=>-new Date().getTimezoneOffset(),redraw:()=>redrawNext(),note:()=>{}",
  ],
  [
    'shell',
    '예상 급수 셸',
    '근거 상자가 완결되지 않은 답의 까닭을 계기에 남기지 않는다(학습일 답 상자의 설계 주인 11-16 저녁 조건 2와 같은 막이 · 4-4d)',
    "lineOf:coachNow=>homeNext?.firstAnswers?.(coachNow)||null,dayOf:()=>homePlanner?homePlanner.todayKey(Date.now()):null,\n  offsetOf:()=>-new Date().getTimezoneOffset(),redraw:()=>redrawNext(),note:code=>homeNext?.note?.('load',{ok:false,code})",
    "lineOf:coachNow=>homeNext?.firstAnswers?.(coachNow)||null,dayOf:()=>homePlanner?homePlanner.todayKey(Date.now()):null,\n  offsetOf:()=>-new Date().getTimezoneOffset(),redraw:()=>redrawNext(),note:()=>{}",
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
    '        missed(kind.code(got?.reason));\n',
    '        missed(kind.code(got?.reason));\n        redraw();\n',
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
    '      if (storage?.guest !== false || heldBack(storage)) return null;\n',
    "      if (storage?.guest !== false) return null;\n",
  ],
  [
    'monthAnswer',
    '학습일 답 완결',
    '물은 사이 칸 밖의 답이 서도 적는다 — 그 답이 빠진 낡은 답이 남는다(설계 주인 11-16 저녁 조건 5)',
    '      if (storage && heldBack(storage)) return; // 물은 사이 접혀 돌아오지 않은 내 사건이 섰다 — 그 사건이 접힌 뒤 다시 묻는다\n',
    '',
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
    '      const stored = fresherOf(keptFor(key), answers.read(owner, { revision, day }));\n',
    '      const stored = answers.read(owner, { revision, day });\n',
  ],
  // `if (!storage)` 줄만 빼는 변형은 아래 try가 TypeError를 잡아 같은 false를 돌려주는 같은 꼴이라 살아남았다(11-16 밤). 되돌아갈 수 있는
  // 회귀는 고치기 전처럼 없는 저장소를 건너뛰고 참을 돌려주는 꼴이다.
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '저장소가 없어도 적었다고 한다 — 없는 저장소를 건너뛰고 참을 돌려준다(Fable 다시 보기 FA1 · 고치기 전의 꼴)',
    '      if (!storage) return false;\n      const value = { v: VERSION, revision, day, ...kind.shape(answer) };\n      try {\n        storage.setItem(keyOf(kind, account), JSON.stringify(value));\n',
    '      const value = { v: VERSION, revision, day, ...kind.shape(answer) };\n      try {\n        storage?.setItem(keyOf(kind, account), JSON.stringify(value));\n',
  ],
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '묻는 사이 앞선 기기가 다시 묻지 않는다 — 문장이 다음 그리기까지 서지 않는다(Fable 다시 보기 FA2)',
    "        else if (verdict === 'ask') ask(holder.coach, holder.line, { owner, revision, day, device: current });\n",
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
    "        if (settle() && still()) {\n",
    "        if (settle() && since === answers.generation()) {\n",
  ],
  [
    'monthAnswer',
    '학습일 답 다시 보기',
    '물은 사이 지우는 길이 돌아도 늦은 답을 든다 — 완결된 답으로 다시 그리고, 완결되지 않은 답이 새 세대의 받은 자리를 채운다(카본 다시 보기 A1 · 끝 판 GPT GB2)',
    '      if (!alive(owner) || since !== answers.generation()) return false;\n',
    '      if (!alive(owner)) return false;\n',
  ],
  // ── 끝 판 검수(GPT)로 고친 둘(GB1 · GB2) ──
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '저장소의 앞 답을 먼저 본다 — 쓰기만 막혀(용량 초과) 앞 답이 남으면 같은 자리에서 묻기와 다시 그리기가 끝없이 돈다(끝 판 GPT GB1 · 고치기 전의 꼴)',
    '      const stored = fresherOf(keptFor(key), answers.read(owner, { revision, day }));\n',
    '      const stored = answers.read(owner, { revision, day }) ?? keptFor(key);\n',
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
    '      if (!alive(owner) || since !== answers.generation()) return false;\n',
    '      if (since !== answers.generation()) return false;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '물은 사이 지우는 길이 돈 물음의 실패를 적는다 — 앞 세대의 실패가 새 세대의 계기를 덮는다(끝 판 GPT GB2)',
    "        if (settle() && still()) {\n",
    "        if (settle() && alive(owner)) {\n",
  ],
  // ── 끝 판 검수(카본)로 더한 셋(A1 · A2) ──
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '완결되지 않은 답의 앞선 자리로 받지 않는다 — 상한에 걸린 계정의 기기가 그 자리를 다음 5분 받기까지 기다린다(끝 판 카본 A2)',
    '        if (at && aheadOf(at, current)) pullOnce(holder.coach, at);\n',
    '        if (false) pullOnce(holder.coach, at);\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '완결되지 않은 답이면 자리를 가리지 않고 받는다 — 같은 자리 · 기기가 앞선 답으로도 5분 막이를 깬다(끝 판 카본 A1 · A2)',
    '        if (at && aheadOf(at, current)) pullOnce(holder.coach, at);\n',
    '        if (at) pullOnce(holder.coach, at);\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판',
    '같은 자리의 완결된 답 뒤에도 받는다 — 쓸 수 있는 답을 그린 뒤 5분 막이를 깨는 받기를 부른다(끝 판 카본 A1)',
    '      if (samePosition(current, at)) redraw();\n',
    '      if (samePosition(current, at)) {\n        redraw();\n        pullOnce(coach, at);\n      }\n',
  ],
  // ── 끝 판 검수(Fable)로 더한 다섯(F3 · F5) ──
  [
    'appShell',
    '학습일 답 끝 판 Fable',
    '로그아웃 때 지우기 빼기 — 떠난 계정의 학습일 답이 이 기기에 남는다(설계 §21-22 변형 · 끝 판 Fable F3)',
    'clearMonthAnswer(localStorage,leaving);',
    '',
  ],
  [
    'appShell',
    '학습일 답 끝 판 Fable',
    '동의를 바꾼 뒤 지우기 빼기 — 앞 동의 판의 답이 이 문서 · 다른 탭에 남는다(끝 판 Fable F3)',
    '.then(()=>{clearMonthAnswer(localStorage,client.snapshot?.accountId);',
    '.then(()=>{',
  ],
  [
    'appShell',
    '학습일 답 끝 판 Fable',
    '동의 바꾸기가 실패하면 지우지 않는다 — 서버는 바뀌었는데 뒤 확인만 실패한 갈래에 열쇠가 남는다(끝 판 Fable F3)',
    'control.checked=!enabled;clearMonthAnswer(localStorage,client.snapshot?.accountId);',
    'control.checked=!enabled;',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 Fable',
    '64줄을 넘는 답을 통째로 버린다 — 가장 열심히 한 학습자에게 문장이 서지 않는다(끝 판 Fable F5 · 고치기 전의 꼴)',
    '    rows.length <= MONTH_LIMIT &&\n',
    '    rows.length <= 64 &&\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 Fable',
    '점수가 아니라 받은 차례로 앞의 64줄을 둔다 — 문장을 고를 점수 큰 단위가 빠진다(끝 판 Fable F5)',
    'const keptRows = rows => (rows.length <= MONTH_ROWS ? rows : [...rows].sort(byScore).slice(0, MONTH_ROWS));\n',
    'const keptRows = rows => rows.slice(0, MONTH_ROWS);\n',
  ],
  // ── 끝 판 카본(-b 끝판)으로 더한 일곱(A1 · B1 · B2) ──
  [
    'shell',
    '학습일 답 끝 판 카본',
    '셸이 돌아보기 읽기에 코치를 넘기지 않는다 — 실제 배선(lookbackOf)은 null을 내 서버 길 계정에 문장이 서지 않는다(4-4c 끝 판 카본 A1)',
    'lineOf:coachNow=>homeNext?.lookback?.(coachNow)||null',
    'lineOf:coachNow=>homeNext?.lookback?.()||null',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본',
    '완결되지 않은 답을 물을 때의 자리와 견준다 — 묻는 사이 기기가 서버의 자리에 왔는데도 받는다(4-4c 끝 판 카본 B1 · 고치기 전의 꼴)',
    '        if (at && aheadOf(at, current)) pullOnce(holder.coach, at);\n',
    '        if (at && aheadOf(at, device)) pullOnce(holder.coach, at);\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본',
    '묻는 사이 기기 자리가 바뀌어도 완결되지 않은 답 뒤에 다시 묻지 않는다 — 열린 판에 문장이 서지 않는다(4-4c 끝 판 카본 B1)',
    '        else if (!samePosition(current, device)) ask(holder.coach, holder.line, { owner, revision, day, device: current });\n',
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본',
    '닫힌 코치면 물을 때의 자리로 받는다 — 닫힌 코치가 받은 자리를 채워 뒤에 연 코치의 받기를 막는다(4-4c 끝 판 카본 B1)',
    '        if (!storage) {\n          if (at) state.ahead = { key, at };\n          return;\n        }\n',
    '        if (!storage) {\n          if (at && aheadOf(at, device)) pullOnce(holder.coach, at);\n          return;\n        }\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본',
    '칸 밖의 내 답이 있어도 완결되지 않은 답 뒤에 받는다 — 접히지 않은 내 답을 두고 받기를 부른다(4-4c 끝 판 카본 B1)',
    '        if (heldBack(storage)) return;\n        const current = positionOf(storage.sync?.received);\n',
    '        const current = positionOf(storage.sync?.received);\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본',
    '밀려난 물음의 답과 실패도 쓴다 — 표지를 보지 않아 앞 판 물음의 실패가 새 코치의 상한을 덮는다(4-4c 끝 판 카본 B2 · 고치기 전의 꼴)',
    '      if (state.asking?.token !== token) return false;\n      state.asking = null;\n      return true;\n',
    '      if (state.asking?.token === token) state.asking = null;\n      return true;\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본',
    '물은 사이 학습일이 넘어간 답도 쓴다 — 어제 답이 다른 탭의 오늘 답을 덮는다(4-4c 끝 판 카본 B2)',
    '        return dayOf() === day;\n',
    '        return true;\n',
  ],
  // ── 끝 판 다시 보기(카본 -c 끝판)로 더한 넷(B1 — 묻는 사이 앞 코치가 닫히고 같은 판의 새 코치가 열린 경우) ──
  [
    'monthAnswer',
    '학습일 답 끝 판 카본 -c',
    '닫힌 코치에 온 완결된 답을 버린다 — 새 코치의 판에 문장이 서지 않고 같은 자리에서 다시 묻는다(4-4c 끝 판 카본 -c B1 · 고치기 전의 꼴)',
    '      if (storage && heldBack(storage)) return; // 물은 사이 접혀 돌아오지 않은 내 사건이 섰다 — 그 사건이 접힌 뒤 다시 묻는다\n',
    '      if (!storage || heldBack(storage)) return; // 물은 사이 접혀 돌아오지 않은 내 사건이 섰다 — 그 사건이 접힌 뒤 다시 묻는다\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본 -c',
    '물은 코치로만 답을 들인다 — 묻는 사이 같은 판의 새 코치가 열려도 닫힌 코치로 받고 그린다(4-4c 끝 판 카본 -c B1)',
    '    if (own || !last || last === asked) return { coach: asked, line: askedLine, storage: own };\n',
    '    return { coach: asked, line: askedLine, storage: own };\n',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본 -c',
    '닫힌 코치에 온 완결되지 않은 답의 앞선 자리를 남기지 않는다 — 뒤에 연 코치가 그 자리를 다음 5분 받기까지 기다린다(4-4c 끝 판 카본 -c B1)',
    '          if (at) state.ahead = { key, at };\n',
    '',
  ],
  [
    'monthAnswer',
    '학습일 답 끝 판 카본 -c',
    '남겨 둔 앞선 자리로 늘 받는다 — 기기가 이미 그 자리에 와도 5분 막이를 깨는 받기를 부른다(4-4c 끝 판 카본 -c B1)',
    '        if (state.ahead?.key === key && aheadOf(state.ahead.at, device)) pullOnce(coach, state.ahead.at);\n',
    '        if (state.ahead?.key === key) pullOnce(coach, state.ahead.at);\n',
  ],
  // ── 학습일 답을 막는 수(설계 주인 11-17 — 4-4c 끝 판 Fable F4, storage.unfoldedRows) ──
  [
    'monthAnswer',
    '학습일 답을 막는 수',
    '셸이 새 칸 대신 칸 밖의 답 수를 본다 — 응답을 지우거나 「이미 알아요」를 말한 뒤 접히기 전에 옛 답의 문장을 그린다(설계 주인 11-17 · 고치기 전의 꼴)',
    'const heldBack = storage => (Number.isInteger(storage.unfoldedRows) ? storage.unfoldedRows : (storage.unfolded ?? 0)) > 0;\n',
    'const heldBack = storage => (storage.unfolded ?? 0) > 0;\n',
  ],
  [
    'monthAnswer',
    '학습일 답을 막는 수',
    '새 칸이 정수가 아닌 엔진이면 아무것도 막지 않는다 — 칸 밖의 내 답이 서 있어도 묻고 적는다(옛 엔진과의 짝 · Fable 4-4d 설계 F5)',
    'const heldBack = storage => (Number.isInteger(storage.unfoldedRows) ? storage.unfoldedRows : (storage.unfolded ?? 0)) > 0;\n',
    'const heldBack = storage => (Number.isInteger(storage.unfoldedRows) ? storage.unfoldedRows : 0) > 0;\n',
  ],
  // 세 자리마다 되돌리기(카본 4-4d 설계 A1 · Fable F5) — 한 자리만 unfolded로 남아도 잡히게.
  [
    'monthAnswer',
    '학습일 답을 막는 수',
    '그리기 · 묻기 전 자리만 칸 밖의 답 수를 본다 — 응답을 지운 뒤 접히기 전에 옛 답의 문장을 그린다(카본 4-4d 설계 A1)',
    '      if (storage?.guest !== false || heldBack(storage)) return null;\n',
    '      if (storage?.guest !== false || (storage.unfolded || 0) > 0) return null;\n',
  ],
  [
    'monthAnswer',
    '학습일 답을 막는 수',
    '완결되지 않은 답 뒤의 자리만 칸 밖의 답 수를 본다 — 묻는 사이 본인 말이 섰는데 앞선 자리로 받거나 다시 묻는다(카본 4-4d 설계 A1)',
    '        if (heldBack(storage)) return;\n        const current = positionOf(storage.sync?.received);\n',
    '        if ((storage.unfolded || 0) > 0) return;\n        const current = positionOf(storage.sync?.received);\n',
  ],
  [
    'monthAnswer',
    '학습일 답을 막는 수',
    '적기 전 자리만 칸 밖의 답 수를 본다 — 묻는 사이 응답을 지웠는데 지우기 전의 답을 적고 다시 그린다(카본 4-4d 설계 A1)',
    '      if (storage && heldBack(storage)) return; // 물은 사이 접혀 돌아오지 않은 내 사건이 섰다 — 그 사건이 접힌 뒤 다시 묻는다\n',
    '      if (storage && (storage.unfolded || 0) > 0) return; // 물은 사이 접혀 돌아오지 않은 내 사건이 섰다 — 그 사건이 접힌 뒤 다시 묻는다\n',
  ],
  [
    "mockNext",
    "고르기",
    "모르는 문항(null)을 처음 보는 문항으로 고른다(§21-23의 1 — 모르면 처음이 아니다)",
    "    return value === false ? false : value === true ? true : null;\n",
    "    return value === true ? true : false;\n",
  ],
  [
    "mockNext",
    "고르기",
    "기록이 다 오지 않아도 연다(21-3)",
    "  if (complete !== true)\n    return {\n",
    "  if (complete === 'never')\n    return {\n",
  ],
  [
    "mockNext",
    "고르기",
    "화면용 봤나(seen)로 고른다 — 띄우기만 한 문항을 만난 것으로 친다(측정용 만남 met)",
    "    met.set(item.id, exposures[i]?.met ?? null);\n",
    "    met.set(item.id, exposures[i]?.seen ?? null);\n",
  ],
  [
    "mockNext",
    "진행",
    "다시 낼 때 늘 「처음이 아니다」를 넘긴다 — 다시 낸 혼자 답이 근거에서 빠진다(카본 설계 검토 B1)",
    "        cell.pid = coach.present(cell.item);\n        represented += 1;\n",
    "        cell.pid = coach.present(cell.item, { firstExposure: false });\n        represented += 1;\n",
  ],
  [
    "mockNext",
    "진행",
    "다시 낸 제시에 끝까지 들은 전달을 잇지 않는다",
    "        for (let n = 0; n < cell.delivered; n += 1) coach.delivery(cell.pid, { audio: 'completed' });\n",
    "",
  ],
  [
    "mockNext",
    "진행",
    "영역을 닫을 때 듣지 못한 문항도 「답하지 않음」으로 남긴다(audio를 가르지 않는다)",
    "        const reasonOf = cell.track.heard ? 'unanswered' : 'audio';\n",
    "        const reasonOf = 'unanswered';\n",
  ],
  [
    "mockNext",
    "진행",
    "허용 재생 수를 넘겨도 들린다(시험 형식은 closed)",
    "      if (kind === 'closed') return false;\n",
    "      if (kind === 'never') return false;\n",
  ],
  [
    "mockNext",
    "진행",
    "그만둔 판을 판 기록과 함께 닫는다(그만두면 기록 없이 — 21-5와 같은 규칙)",
    "    return closeSet(false);\n",
    "    return closeSet(true);\n",
  ],
  [
    "mockNext",
    "진행",
    "코치가 닫혀도(DISPOSED) 닫힌 줄 모르고 다음 문항을 부른다",
    "      if (error?.code === 'DISPOSED') {\n        end();\n        return null;\n      }\n      if (error?.code !== 'PRESENTATION_GONE') throw error;\n",
    "      if (error?.code === 'DISPOSED') {\n        return null;\n      }\n      if (error?.code !== 'PRESENTATION_GONE') throw error;\n",
  ],
  [
    "mockNext",
    "진행",
    "영역을 닫을 때 열어 보지 않은 문항도 남긴다(본 적 없는 문항은 다음에 처음 보는 문항으로 남아야 한다)",
    "      if (cell.pid && !cell.result && !disposed) {\n",
    "      if (!cell.result && !disposed) {\n",
  ],
  [
    "mockNext",
    "진행",
    "시간이 다 돼도 영역을 닫지 않는다",
    "    if (row && row.startedAt !== null && row.ended === null && clock() >= deadline(row)) close(row, 'time');\n",
    "    if (row && row.startedAt !== null && row.ended === null && clock() >= deadline(row) + 3600000) close(row, 'time');\n",
  ],
  [
    "mockNext",
    "진행",
    "끝까지 들은 재생을 지금 문항에만 남긴다(세트 대본은 열어 둔 세트 문항 모두에)",
    "        for (const entry of row.cells)\n          if (entry.track === track && entry.pid && !entry.result && !disposed) deliver(entry, 'completed');\n",
    "        if (cell.pid && !cell.result && !disposed) deliver(cell, 'completed');\n",
  ],
  [
    "mockNext",
    "다음 연습",
    "두뇌가 낼 것 없음(none)이라 한 연습도 잇는다(설계 검토 Fable F8)",
    "      if (entry && entry.none !== true && entry.locked !== true && bySkill.has(entry.id))\n",
    "      if (entry && entry.locked !== true && bySkill.has(entry.id))\n",
  ],
  [
    "mockNext",
    "다음 연습",
    "소리를 끈 날에도 듣기 문항을 센다",
    "      if (met[i]?.seen !== false || (listening && !audioAvailable)) return;\n",
    "      if (met[i]?.seen !== false) return;\n",
  ],
  [
    "mockShell",
    "시험 형식 여는 곳",
    "판 셋 검사를 뺀다 — 새 길 문서에서도 옛 코치 world-mock을 연다(설계 검토 Fable F7)",
    "  return homePhase()==='old'?openMockOld(options):openMockNext(options);\n",
    "  return openMockOld(options);\n",
  ],
  [
    "mockShell",
    "시험 형식 여는 곳",
    "확인 중에 기다림이 넘치면 옛 코치로 연다",
    "  if(!homeCoach){home.toast(t('homeTutor.checking'));return;}\n",
    "  if(!homeCoach)return openMockOld({exam});\n",
  ],
  [
    "mockShell",
    "시험 형식 여는 곳",
    "기다린 사이 학생이 연 다른 판을 덮는다(4-4b 다시 검수 Fable FA2와 같은 막이)",
    "  if(homePhase()==='checking'){await settledHome();check();if(moved())return;}\n",
    "  if(homePhase()==='checking'){await settledHome();check();}\n",
  ],
  [
    "mockShell",
    "시험 형식 셸",
    "판을 다시 정해 코치가 닫혀도 연습을 닫지 않는다",
    "  unwatch=atlasNext?.retired?.(next,closed)??(()=>{});\n",
    "  unwatch=()=>{};\n",
  ],
  [
    "mockShell",
    "시험 형식 셸",
    "끝까지 한 판을 닫지 않는다 — 손님 요약이 그 답으로 다시 접히지 않는다(진단 Fable 끝 판 F2)",
    "   let set=null;try{set=session.finish({record:answering()});}catch{set=null;}\n",
    "   let set=null;\n",
  ],
  [
    "mockShell",
    "시험 형식 셸",
    "저장을 기다리는 사이 판이 닫히면 판을 닫지 않는다 — 손님 요약이 그 답으로 다시 접히지 않는다(진단 Fable 끝 판 F2와 같은 막이)",
    "if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}\n   finishing=false;drawn=true;unwatch();",
    "if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;if(left){queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}\n   finishing=false;drawn=true;unwatch();",
  ],
  [
    "mockShell",
    "시험 형식 셸",
    "끝 한 장이 접기를 기다리지 않는다 — 손님 끝 한 장을 그 답이 접히기 전의 칸으로 짓는다(진단 Fable 끝 판 F3와 같은 막이)",
    "let set=null;try{set=session.finish({record:answering()});}catch{set=null;}\n   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});return;}}",
    "let set=null;try{set=session.finish({record:answering()});}catch{set=null;}\n   ",
  ],
  [
    'mockShell',
    "시험 형식 셸",
    "저장을 기다리는 사이 판만 닫히면 홈을 다시 그리지 않는다 — 홈 점검 칸이 방금 마친 판을 모른다(끝 판 검수 카본 E1)",
    "if(left){queueMicrotask(()=>refresh());if(set?.folded)Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});}return;}\n   finishing=false;drawn=true;unwatch();",
    "return;}\n   finishing=false;drawn=true;unwatch();",
  ],
  [
    'mockShell',
    "시험 형식 셸",
    "접기를 기다리는 사이 판이 닫히면 홈을 다시 그리지 않는다 — 끝낸 판을 홈이 모른다(카본 E1)",
    "let set=null;try{set=session.finish({record:answering()});}catch{set=null;}\n   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(()=>redrawNext(),()=>{});return;}}",
    "let set=null;try{set=session.finish({record:answering()});}catch{set=null;}\n   if(local&&set?.folded){await Promise.race([Promise.resolve(set.folded).catch(()=>null),new Promise(resolve=>setTimeout(resolve,FOLD_WAIT_MS))]);if(stopped||!box.isConnected)return;}",
  ],
  [
    'mockShell',
    "시험 형식 셸",
    "코치가 닫혀 판을 닫을 때 세션을 멈추지 않는다 — 닫힌 판의 보기 누름이 답을 적는다(끝 판 검수 GPT GB1 · 카본 B1)",
    "stopTick();player.silence();let set=null;try{set=session.stop();}catch{set=null;}queueMicrotask(()=>refresh());",
    "stopTick();player.silence();let set=null;queueMicrotask(()=>refresh());",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "판정이 참이 되어도 열린 카드에 시험 형식 단추를 더하지 않는다(설계 다시 검수 카본 A2)",
    "  if(!mock)return false;\n  start.insertAdjacentHTML(",
    "  if(mock||!mock)return false;\n  start.insertAdjacentHTML(",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "닫히며 흐려지는 판에도 단추를 더한다(내 위치 판 D1과 같은 막이)",
    "  if(kind!=='world-reminder')return false;\n",
    "  if(kind==='never')return false;\n",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "시험 형식 단추가 짧은 진단 명령을 쓴다 — 누른 때 앱이 다시 고르게 된다(설계 다시 검수 카본 A1)",
    "  const lead=mock?examButton('reminder-exam-mock',",
    "  const lead=mock?examButton('reminder-exam-start',",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "더할 때 짧은 진단 단추 앞에 끼운다 — 학생이 읽던 단추의 자리가 바뀐다(둘째 다시 검수 -c FA1)",
    "  start.insertAdjacentHTML('afterend',",
    "  start.insertAdjacentHTML('beforebegin',",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "시험 형식 단추의 명령이 짧은 진단을 연다",
    "  if(name==='reminder-exam-mock')return open('exam-mock');\n",
    "  if(name==='reminder-exam-mock')return open('exam-start');\n",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "누른 때 「education.mock이 있는가」로 다시 고른다(설계 다시 검수 카본 A1)",
    " if(kind==='exam-start')return run(()=>life.education?.position?.({start:true}));\n",
    " if(kind==='exam-start')return run(()=>{const education=life.education;return typeof education?.mock==='function'?education.mock():education?.position?.({start:true});});\n",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "홈을 다시 그려도 열린 카드를 맞추지 않는다",
    "  mockChanged:()=>reminders?.examChanged?.(),\n",
    "",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "카드 판정이 입구가 있는가만 본다(새 길 판정을 보지 않는다)",
    "canMock:()=>typeof education?.mockReady==='function'?education.mockReady()===true:typeof education?.mock==='function',",
    "canMock:()=>typeof education?.mock==='function',",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "입구 감싸기가 시험 형식 코치를 잇지 않는다(셸 시험 틀은 입구 칸을 손으로 짓는다)",
    "  async mockCoach(pool){if(disposed)return null;const entry=await load();return disposed?null:entry.mockCoach(pool);},\n",
    "",
  ],
  [
    "mockShell",
    "시험 점검 셸",
    "홈을 다시 그려도 앱에 알리지 않는다",
    "  if(typeof mockChanged==='function')try{mockChanged();}catch{/* 알림 카드는 다음에 열 때 맞춘다 */}\n",
    "",
  ],
  [
    "mockShell",
    "시험 점검 셸",
    "새 길 판정이 고르기를 보지 않는다(엔진 판이면 참)",
    "  return mockNextPlan(coachNow,values,studentExam(values))?.status==='ready';\n",
    "  return true;\n",
  ],
  [
    "mockShell",
    "시험 형식 셸",
    "이 기기의 판 기록에 끝낸 판만 적는다 — 그만둔 판이 이번 주 시험 형식 줄을 막지 않는다(4-4d — 설계 주인 11-17 답 3)",
    "  const markPlan=()=>{if(logged||!session.presented)return;",
    "  const markPlan=()=>{if(logged||!session.finished)return;",
  ],
  [
    "mockShell",
    "시험 형식 셸",
    "판을 다시 그릴 때마다 판 기록에 적는다 — 한 판이 여러 판으로 센다(4-4d)",
    "  const markPlan=()=>{if(logged||!session.presented)return;logged=true;",
    "  const markPlan=()=>{if(!session.presented)return;",
  ],
  // ── 예상 급수의 근거(4-4d — 단계4_계획 §21-23의 2): 근거 상자의 종류 · 제품 문턱 셈 · 셸 배선 · 입구의 근거 줄 ──
  [
    "monthAnswer",
    "근거 상자",
    "근거 답의 게임을 보지 않는다 — 다른 게임의 근거 수를 적는다(4-4d — §21-23의 2)",
    "  value?.game === FIRST_GAME && value.days === FIRST_DAYS && finite(value[start]) && validBySkill(value.bySkill);\n",
    "  value?.days === FIRST_DAYS && finite(value[start]) && validBySkill(value.bySkill);\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "근거 답의 날 수를 보지 않는다",
    "  value?.game === FIRST_GAME && value.days === FIRST_DAYS && finite(value[start]) && validBySkill(value.bySkill);\n",
    "  value?.game === FIRST_GAME && finite(value[start]) && validBySkill(value.bySkill);\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "능력마다의 수에 음수 · 소수를 받는다",
    "  Object.entries(value).every(([skill, n]) => FIRST_SKILL.test(skill) && Number.isSafeInteger(n) && n >= 0);\n",
    "  Object.entries(value).every(([skill, n]) => FIRST_SKILL.test(skill) && typeof n === 'number');\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "근거 읽기에 제품 상수와 다른 날 수를 묻는다",
    "  query: line => line.ask({ game: FIRST_GAME, days: FIRST_DAYS }),\n",
    "  query: line => line.ask({ game: FIRST_GAME, days: 30 }),\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "지우는 길이 학습일 답 열쇠만 지운다 — 근거 답이 로그아웃 뒤에 남는다(§21-23의 2 「지우는 길 넷이 두 열쇠를 함께」)",
    "  for (const kind of KINDS) {\n",
    "  for (const kind of [MONTH_KIND]) {\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "지우는 길이 근거 열쇠부터 지우다 던지면 나머지 열쇠를 지우지 않는다 — 로그아웃 뒤 학습일 답이 남는다(끝 판 검수 그록 C)",
    "  for (const kind of KINDS) {\n    try {\n      if (account) storage?.removeItem(keyOf(kind, account));\n    } catch {\n",
    "  try {\n    for (const kind of [...KINDS].reverse()) if (account) storage?.removeItem(keyOf(kind, account));\n  } catch {\n    {\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "근거 답을 학습일 답과 같은 열쇠에 둔다",
    "  prefix: 'synk:world:first-answers:',\n",
    "  prefix: 'synk:world:month-answer:',\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "셸에 내는 창의 시작을 적은 값의 다른 칸에서 읽는다 — 세대 수와 겹친 이름(since)",
    "  use: stored => ({ since: stored.from, bySkill: Object.freeze(bySkillCopy(stored.bySkill)) }),\n",
    "  use: stored => ({ since: stored.since, bySkill: Object.freeze(bySkillCopy(stored.bySkill)) }),\n",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "까닭 코드 빼기 — 완결되지 않은 근거 답이 늘 FIRST_ANSWERS_FAILED로 남는다",
    "export const firstAnswersCode = reason => FIRST_CODES[reason] ?? 'FIRST_ANSWERS_FAILED';\n",
    "export const firstAnswersCode = () => 'FIRST_ANSWERS_FAILED';\n",
  ],
  [
    "position",
    "예상 급수",
    "근거 수를 모르면 이르다로 본다 — 「확인 중」 대신 빈 근거로 문턱을 센다(4-4d — §21-23의 2)",
    "  if (!known) return { ...base, status: ibt ? 'mode-unsupported' : unread === true ? 'unread' : 'checking', evidence: 0, perDomain };\n",
    "  if (!known) return { ...base, status: ibt ? 'mode-unsupported' : 'too-early', evidence: 0, perDomain };\n",
  ],
  [
    "position",
    "예상 급수",
    "시험(능력 id 앞머리)을 가르지 않는다 — TOPIK II 판에 TOPIK I 근거를 센다",
    "    if (head !== ESTIMATE_PREFIX[which] || !ESTIMATE_DOMAINS.includes(domain) || !Number.isSafeInteger(n) || n < 0) continue;\n",
    "    if (!ESTIMATE_DOMAINS.includes(domain) || !Number.isSafeInteger(n) || n < 0) continue;\n",
  ],
  [
    "position",
    "예상 급수",
    "영역별 문턱을 보지 않는다",
    "  const enough = evidence >= policy.minEvidence && perDomain.listening >= policy.minPerDomain && perDomain.reading >= policy.minPerDomain;\n",
    "  const enough = evidence >= policy.minEvidence;\n",
  ],
  [
    "position",
    "예상 급수",
    "꼴이 아닌 수(음수 · 소수)도 센다",
    "    if (head !== ESTIMATE_PREFIX[which] || !ESTIMATE_DOMAINS.includes(domain) || !Number.isSafeInteger(n) || n < 0) continue;\n",
    "    if (head !== ESTIMATE_PREFIX[which] || !ESTIMATE_DOMAINS.includes(domain)) continue;\n",
  ],
  [
    "position",
    "예상 급수",
    "IBT로 본다고 한 학생에게도 PBT 연습의 근거로 범위를 잇는다",
    "  return { ...base, status: ibt ? 'mode-unsupported' : enough ? 'no-estimator' : 'too-early', evidence, perDomain };\n",
    "  return { ...base, status: enough ? 'no-estimator' : 'too-early', evidence, perDomain };\n",
  ],
  [
    "shell",
    "예상 급수 셸",
    "근거 수를 모르면 빈 근거(0)로 그린다 — 「확인 중」을 되돌린다(§21-23 「변형은 null을 0으로 그리게 되돌리기」)",
    "bySkill:counts?.bySkill??null,",
    "bySkill:counts?.bySkill??{},",
  ],
  [
    "shell",
    "예상 급수 셸",
    "손님 코치의 근거 셈을 쓰지 않는다 — 손님 판이 늘 「확인 중」이다",
    "  try{counts=typeof coachNow.firstAnswers==='function'?coachNow.firstAnswers({game:FIRST_GAME,days:FIRST_DAYS}):null;}catch{counts=null;}\n",
    "",
  ],
  [
    "shell",
    "예상 급수 셸",
    "코치에 제품 상수와 다른 창을 묻는다",
    "coachNow.firstAnswers({game:FIRST_GAME,days:FIRST_DAYS})",
    "coachNow.firstAnswers({game:FIRST_GAME,days:30})",
  ],
  [
    "shell",
    "예상 급수 셸",
    "서버 길 계정의 근거 상자를 부르지 않는다 — 계정 판이 늘 「확인 중」이다",
    "  if(!counts){try{counts=evidenceAsker.answer(coachNow);unread=!counts&&evidenceAsker.missed(coachNow);}catch{counts=null;}}\n",
    "",
  ],
  [
    "shell",
    "예상 급수 셸",
    "근거 상자가 돌아보기 읽기 줄로 묻는다",
    "lineOf:coachNow=>homeNext?.firstAnswers?.(coachNow)||null",
    "lineOf:coachNow=>homeNext?.lookback?.(coachNow)||null",
  ],
  [
    "shell",
    "예상 급수 셸",
    "내 위치 판에 시험 형식 단추를 싣지 않는다(내 위치 단추 — §21-23의 1)",
    "   mock:mockOf(coachNow,values,exam,met.slice(diagnostic.length+practice.length))};\n",
    "   mock:null};\n",
  ],
  // ── 4-4d Fable 끝 판과 설계 주인 11-17 저녁 답: 근거를 읽지 못한 자리 · 꼴 검사 · 시험 형식 고르기와 여는 길 ──
  [
    "monthAnswer",
    "근거 읽지 못함",
    "근거 상자가 묻기를 그만둔 자리에서 다시 그리지 않는다 — 열린 판이 「기록 확인 중」으로 남는다(설계 주인 11-17 저녁 답 4 나)",
    "  redrawMissed: true,\n",
    "",
  ],
  [
    "monthAnswer",
    "근거 읽지 못함",
    "완결되지 않은 답 뒤 받을 것도 다시 물을 것도 없는 자리에서 다시 그리지 않는다",
    "        else drawMissed();\n",
    "",
  ],
  [
    "monthAnswer",
    "근거 읽지 못함",
    "묻기를 그만둔 자리를 알리지 않는다 — 셸이 「기록 확인 중」을 그린다",
    "        if (state.asking?.key !== key && state.tried?.key === key && samePosition(state.tried.from, device)) state.missed = coach;\n",
    "",
  ],
  [
    "monthAnswer",
    "근거 읽지 못함",
    "꼴이 틀린 완결 답 뒤에 상한을 두지 않는다 — 판을 그릴 때마다 서버에 묻는다(Fable 끝 판 F11)",
    "      if (!at || !body) {\n        missed(kind.failed);\n",
    "      if (!at || !body) {\n        note(kind.failed);\n",
  ],
  [
    "monthAnswer",
    "근거 읽지 못함",
    "저장소에 적힌 근거 값의 꼴을 보지 않는다 — 깨진 값이 남은 브라우저에서 상자가 던진다(Fable 끝 판 F12)",
    "  valid: value => validFirst(value, 'from'),\n",
    "  valid: () => true,\n",
  ],
  [
    "position",
    "근거 읽지 못함",
    "읽지 못함을 「확인 중」으로 센다(설계 주인 11-17 저녁 답 4 나)",
    "unread === true ? 'unread' : 'checking'",
    "'checking'",
  ],
  [
    "shell",
    "근거 읽지 못함",
    "근거 상자가 묻기를 그만둔 자리를 보지 않는다 — 서버 길 계정 판이 「기록 확인 중」으로 남는다(설계 주인 11-17 저녁 답 4 나)",
    "unread=!counts&&evidenceAsker.missed(coachNow);",
    "",
  ],
  [
    "shell",
    "시험 형식 고르기와 여는 길",
    "홈의 시험 형식을 판에서 누른 시험으로 고른다 — 여는 판 · 알림 시트와 어긋난다(Fable 끝 판 F5 · F9)",
    "mockNextPlan(coachNow,values,studentExam(values),metMock)",
    "mockNextPlan(coachNow,values,exam,metMock)",
  ],
  [
    "shell",
    "시험 형식 고르기와 여는 길",
    "시험 형식을 기다리는 열기에 판 자원을 달지 않는다 — 그 사이 연 같은 종류의 판을 늦게 온 판이 덮는다(Fable 끝 판 F6)",
    "  home.attachPanelResource?.({dispose(){if(!settled&&ticket===mockOpen){mockOpen++;if(openMockNext.pending===ticket){openMockNext.pending=0;openMockNext.skipped=false;}}}});\n",
    "",
  ],
  [
    "shell",
    "시험 형식 고르기와 여는 길",
    "시험 형식을 기다리는 동안에도 열린 판을 뒤에서 다시 그린다 — 첫 받기 답이 그 열기를 끊는다(Fable 끝 판 F6)",
    "  if(redrawingNext||stopped||openPosition.pending||heldMock())return;\n",
    "  if(redrawingNext||stopped||openPosition.pending)return;\n",
  ],
  [
    "shell",
    "시험 형식 고르기와 여는 길",
    "시험 형식 열기가 판을 그리지 않고 끝나도 기다리는 사이 건너뛴 다시 그리기를 하지 않는다 — 열린 판이 옛 상태로 남는다(끝 판 카본 B1)",
    "if(skipped&&!settled&&!stopped)repaint();",
    "",
  ],
  [
    "shell",
    "시험 형식 고르기와 여는 길",
    "시험 형식 열기가 기다리는 사이 건너뛴 다시 그리기를 적지 않는다 — 끝에 다시 그릴 것을 모른다(끝 판 카본 B1)",
    "function heldMock(){if(!openMockNext.pending)return false;openMockNext.skipped=true;return true;}",
    "function heldMock(){return Boolean(openMockNext.pending);}",
  ],
  // 「판을 그린 뒤에도 끝에 다시 그린다」(!settled 빼기)와 「판이 바뀔 때 건너뛴 표를 지우지 않는다」는 넣지 않는다 — 새로 그린 판(시험 형식 판 ·
  // 다른 판)을 keepScroll로 한 번 더 그리거나 그리지 않는 같은 동작이 된다(방어용 막이).
  [
    "mockShell",
    "시험 형식 고르기와 여는 길",
    "끝 한 장이 답 저장을 기다리는 동안의 누름을 받는다 — 그만두기가 끝까지 마친 판을 기록 없이 닫는다(Fable 끝 판 F7)",
    "    if(finishing)return;\n",
    "",
  ],
  // 「손님 · 기기 길에도 근거 줄을 준다」(path 막이 빼기)는 넣지 않는다 — 손님은 판이 없고 기기 길 판에는 나르개가 없어 같은 동작이 된다(방어용 막이 · lookbackOf와 같다).
  [
    "entry",
    "근거 읽기 입구",
    "오프라인으로 연 올리는 길의 나르개가 근거 읽기를 잇지 않는다",
    "      firstAnswers: async query => {\n        const to = await ready();\n",
    "      firstAnswers_: async query => {\n        const to = await ready();\n",
  ],
  // ── 4-5 연습 기록 비우기의 입구 몫(단계4_계획 §22-4 · 22-1의 4) ──
  ["clear", "비우기 입구", "「비우는 중」 표지를 적지 않고 비운다", "    if (!store || !writeClearing(store, owner, mark)) return { ok: false, path, code: 'MARK_FAILED', known: true };\n", "    if (!store) return { ok: false, path, code: 'MARK_FAILED', known: true };\n"],
  ["clear", "비우기 입구", "옛 엔진의 올리기 대기열을 올리지 않고 비운다", "    if (path === 'upload' && typeof oldEngine?.flush === 'function') {\n", "    if (false) {\n"],
  ["clear", "비우기 입구", "옛 대기열을 못 올려도 비운다", "      if (flushed === false || flushed?.ok === false)\n", "      if (false)\n"],
  ["clear", "비우기 입구", "새 길 올리기에서 멈춘 것을 서버 비우기 실패로 본다", "    if (done?.step === 'upload' || done?.code === 'NO_CLEAR') {\n", "    if (done?.code === 'NO_CLEAR') {\n"],
  ["clear", "비우기 입구", "결과를 모르는 비우기의 표지를 지운다", "    if (done?.known === true && last !== undefined) writeClearing(store, owner, null);\n", "    writeClearing(store, owner, null);\n"],
  ["clear", "비우기 입구", "마지막 비우기를 못 읽었는데도 표지를 지운다", "    if (done?.known === true && last !== undefined) writeClearing(store, owner, null);\n", "    if (done?.known === true) writeClearing(store, owner, null);\n"],
  ["clear", "비우기 입구", "실패 뒤 다른 기기가 먼저 비운 것을 보지 않는다", "    if (last && last.revision > mark.revision) return cleared(mark, last.revision, 'cleared');\n", ""],
  ["clear", "비우기 입구", "표지 앞의 비우기(표지와 같은 판)도 비워진 것으로 본다", "      if (!(last && last.revision > mark.revision)) {\n", "      if (!(last && last.revision >= mark.revision)) {\n"],
  ["clear", "비우기 입구", "하루가 지난 표지를 지우지 않는다", "        if (Date.now() - mark.at > CLEARING_MS) writeClearing(store, owner, null);\n", ""],
  ["clear", "비우기 입구", "하루 안의 표지도 지운다", "        if (Date.now() - mark.at > CLEARING_MS) writeClearing(store, owner, null);\n", "        writeClearing(store, owner, null);\n"],
  ["clear", "비우기 입구", "판을 다시 정할 때 표지를 맞추지 않는다", "      await settleClearing(plan, at);\n", ""],
  ["clear", "비우기 입구", "쓸기의 경계를 비운 뒤의 판까지 넓힌다 — 새 판의 기록을 지운다", "    sweepEarlier(store, owner, Number.isSafeInteger(current) ? Math.min(current, revision) : revision);\n", "    sweepEarlier(store, owner, revision + 1);\n"],
  ["clear", "비우기 입구", "새 판 구역에 이미 있는 본인 값을 덮는다", "      if (value != null && storage.getItem(to + name) == null) storage.setItem(to + name, value);\n", "      if (value != null) storage.setItem(to + name, value);\n"],
  ["clear", "비우기 입구", "오늘 상태도 새 판으로 옮긴다", "const OWN_KEYS = [`${LEGACY_KEY}.presentation`, 'hangul-stage.v1'];\n", "const OWN_KEYS = [`${LEGACY_KEY}.presentation`, 'hangul-stage.v1', `${LEGACY_KEY}.today`];\n"],
  ["clear", "비우기 입구", "내용 기억(.flow)을 쓸지 않는다", "  if (name === `${LEGACY_KEY}.flow`) return true;\n", ""],
  ["clear", "비우기 입구", "옛 엔진 올리기 대기열을 쓸지 않는다", "  return [LEGACY_KEY, `synk.atlas.learning-sync.v1.${accountKey}`].some(\n", "  return [LEGACY_KEY].some(\n"],
  ["clear", "비우기 입구", "쪽 · 쓰는 중 표지를 쓸지 않는다", "    base => name === base || name.startsWith(`${base}.page.`) || name.startsWith(`${base}.writer.`),\n", "    base => name === base,\n"],
  ["clear", "비우기 입구", "기기 길 구역(local:)을 쓸지 않는다", "  for (const accountKey of [owner, `local:${owner}`]) {\n", "  for (const accountKey of [owner]) {\n"],
  ["clear", "비우기 입구", "앞 판의 판 기록 열쇠를 쓸지 않는다", "        if (/^\\d+$/.test(revision) && Number(revision) < below) drop.push(name);\n", ""],
  ["clear", "비우기 입구", "구역 앞머리로 통째로 쓴다 — 본인 값 · 오늘 상태까지 지운다", "        if (found && Number(found[1]) < below && engineRecord(found[2], accountKey)) drop.push(name);\n", "        if (found && Number(found[1]) < below) drop.push(name);\n"],
  ["clear", "비우기 입구", "30일째 문장의 답을 지우지 않는다", "    clearMonthAnswer(store, owner);\n", ""],
  ["clear", "비우기 입구", "본인 값을 새 판으로 옮기지 않는다", "    moveOwn(store, zoneOf(owner, mark.path, mark.revision), zoneOf(owner, mark.path, revision));\n", ""],
  ["clear", "비우기 입구", "비운 뒤 이 문서의 코치를 은퇴시키지 않는다", "    retire('cleared');\n    if (left && !disposed) await planNow();\n", "    if (left && !disposed) await planNow();\n"],
  ["clear", "비우기 입구", "손님 저장소의 남은 걸음을 곧바로 마저 하지 않는다", "    if (left && !disposed) await planNow();\n", ""],
  ["clear", "비우기 입구", "옛 손님 로그를 쥔 다른 창(busy)을 남은 걸음으로 세지 않는다", "    : guest?.legacy === 'busy' || guest?.legacy === 'failed'\n", "    : guest?.legacy === 'failed'\n"],
  ["clear", "비우기 입구", "남은 걸음이 4b뿐이어도 넷째 걸음부터 다시 한다 — 그 뒤 새로 옮긴 사건을 지운다", "    const done = await made.reset({ legacy: legacyPort(), settle: mark.left, revision: mark.revision });\n", "    const done = await made.reset({ legacy: legacyPort(), settle: 'cleared', revision: mark.revision });\n"],
  ["clear", "비우기 입구", "기기 길에서 판이 바뀐 것을 보지 않고 비운다", "        line?.learning?.revision === plan.revision && typeof line.transport === 'function'\n", "        typeof line.transport === 'function'\n"],
  ["clear", "비우기 입구", "기기 길의 서버 비우기를 엔진에 넘기지 않는다", "      done = await made.reset({ legacy: legacyPort(), ...(clear ? { clear } : {}) });\n", "      done = await made.reset({ legacy: legacyPort() });\n"],
  ["clear", "비우기 입구", "새 길이 아닌 판(스위치 꺼짐)에서도 비운다", "    if (plan.path === 'old') return { ok: false, path: 'old', code: 'NOT_NEXT', known: true };\n", ""],
  ["clear", "비우기 입구", "겹쳐 누르면 비우기를 두 번 한다", "      clearing ??= (account ? clearAccount() : clearGuest())\n", "      clearing = (account ? clearAccount() : clearGuest())\n"],
  ["clear", "비우기 입구", "손님 판 기록 열쇠를 지우지 않는다", "      if (name) store.removeItem(planLogKey(name));\n", ""],
  ["clear", "비우기 입구", "손님 비우기 뒤 같은 문서의 손님 코치를 은퇴시키지 않는다", "    retire('cleared');\n    return { ok: true, path: 'guest', partial };\n", "    return { ok: true, path: 'guest', partial };\n"],
  ["clear", "비우기 입구", "옛 엔진이 바빠도(busy) 다 비웠다고 한다", "    let partial = done.legacy === 'busy' || done.legacy === 'failed';\n", "    let partial = done.legacy === 'failed';\n"],
  ["clear", "비우기 입구", "저장소가 없는 손님도 비우려 한다", "    if (!store) return { ok: false, path: 'guest', code: 'NO_STORAGE', known: true };\n", ""],
  ["clear", "비우기 입구", "손님 호스트가 저장소 닫힘(STORE_CLOSED)에도 판을 다시 정한다", "          if (detail?.code === 'STORE_CLEARED') changed(detail, at);\n", "          changed(detail, at);\n"],
  ["clear", "비우기 입구", "손님 호스트가 다른 탭의 비우기 알림을 흘린다", "          if (detail?.code === 'STORE_CLEARED') changed(detail, at);\n", "          if (false) changed(detail, at);\n"],
  ["clear", "비우기 입구", "옛 로그 읽개가 epoch을 넘기지 않는다 — 옛 엔진 비우기를 확인하지 못한다", "        epoch: typeof value?.epoch === 'string' && value.epoch ? value.epoch : null,\n", ""],
  // ── 4-5 판 응답 읽기의 판 울타리(4-5 코드 검수 GPT GA7) ──
  ["entry", "판 응답 입구", "판 응답 읽기의 판 울타리를 판 다시 정하기로 잇지 않는다 — 앞 판의 목록을 준다", "          if (planFenced(error)) {\n", "          if (false) {\n"],
  ["entry", "판 응답 입구", "동의 꺼짐(403 LEARNING_DISABLED)을 판이 바뀐 것으로 보지 않는다", "    (error?.status === 403 && error?.code === 'LEARNING_DISABLED');\n", "    false;\n"],
  // ── 4-5 「내가 남긴 응답」 · 짧은 연습 길이의 셸(4-5 코드 검수 GPT GA8 · GA9) ──
  ["responseShell", "판 응답 셸", "짧은 연습 길이에 판을 여는 새 길 코치를 넘기지 않는다", "  const count=practiceLength(next),skill={id:skillId,label:skillLabel(skillId)};\n", "  const count=practiceLength(),skill={id:skillId,label:skillLabel(skillId)};\n"],
  ["responseShell", "판 응답 셸", "홈 코치가 서기 전에 연 「내 계정」은 읽지 않고 끝낸다", "   if(homePhase()!=='checking')return false;\n", "   return false;\n"],
  ["responseShell", "판 응답 셸", "코치가 선 뒤 기다린 읽기를 하지 않는다", "  void readResponses(shown).then(done,()=>done(false));\n", "  done(false);\n"],
  // ── 4-5 코드 다시 검수(GPT -b)의 고침 ──
  ["entry", "판 응답 입구", "같은 차례에 끝난 앞 읽기가 판을 다시 정한 뒤에도 앞 판의 목록을 준다(GA6)", "      if (disposed || at !== generation || gone.has(made)) return null;\n", "      if (disposed || gone.has(made)) return null;\n"],
  ["responseShell", "판 응답 셸", "기다린 읽기를 코치가 선 때의 목록과 견준다 — 빈 채로 그린 시트를 다시 그리지 않는다(GA7)", "  const before=shown??JSON.stringify(responseList());\n", "  const before=JSON.stringify(responseList());\n"],
  ["responseShell", "판 응답 셸", "다시 그리기가 기다리던 읽기를 끝내지 않는다 — 지금 판으로 서면 끝내 기다린다(GA2)", "  readWaitingResponses();\n  return current;\n", "  return current;\n"],
  ["responseShell", "판 응답 셸", "닫아도 기다리던 읽기를 끝내지 않는다(GA2)", "dispose(){stopped=true;wakePlanWaits();readWaitingResponses();", "dispose(){stopped=true;wakePlanWaits();"],
  ["me","나 칸","흔들리는 말을 놓친 수로 세우지 않는다","  finite(b.lapses) - finite(a.lapses) || finite(a.lastAt) - finite(b.lastAt) || byName(a, b);\n","  finite(a.lastAt) - finite(b.lastAt) || byName(a, b);\n"],
  ["me","나 칸","흔들리는 말에서 마지막 자리가 오래된 것을 앞세우지 않는다","  finite(b.lapses) - finite(a.lapses) || finite(a.lastAt) - finite(b.lastAt) || byName(a, b);\n","  finite(b.lapses) - finite(a.lapses) || byName(a, b);\n"],
  ["me","나 칸","이름이 없는 단위도 싣는다(N3를 어긴다)","    if (!label) {\n","    if (false) {\n"],
  ["me","나 칸","요약 줄의 이름이 단위 길의 이름보다 앞선다","  const label = typeof routed === 'string' && routed.trim() ? routed : row.label;\n","  const label = row.label ?? routed;\n"],
  ["me","나 칸","또렷한 말을 이름 차례로 세우지 않는다","  lists.clear.sort(byName);\n",""],
  ["me","나 칸","내가 안다고 한 말을 이름 차례로 세우지 않는다","  lists.said.sort(byName);\n",""],
  ["meShell","나 칸","확인 중에도 「나」를 세운다"," function meCoach(){if(stopped)return null;try{return homePhase()==='engine'?homeWatch?.coach?.()??null:null;}catch{return null;}}\n"," function meCoach(){if(stopped)return null;try{return homeWatch?.coach?.()??null;}catch{return null;}}\n"],
  ["meShell","나 칸","본인 말이 아닌 값도 적는다"," function tellMe(unit,kind){if(kind!=='known'&&kind!=='relearn')return null;const coachNow=meCoach();"," function tellMe(unit,kind){const coachNow=meCoach();"],
  ["meShell","나 칸","되돌리기가 그 사건을 빼지 않는다","try{coachNow.exclude(eventId);return true;}catch{return false;}}\n","return true;}\n"],
  ["meShell","나 칸","비우기가 입구를 부르지 않는다","return atlasNext.clearPractice();}\n","return null;}\n"],
  ["doors","나 칸","4b의 다시 판단을 건너뛰고 비운다(GA1)","        if (typeof check === 'function' && !check(typeof read === 'function' ? read() : null))\n          return 'kept';\n",""],
  ["doors","나 칸","다시 읽지 않고 판단한다(GA1)","check(typeof read === 'function' ? read() : null)","check(null)"],
  ["doors","나 칸","쓰기 임대를 기다리지 않고 비운다","        await leased(game, leaseWaitMs);\n",""],
  ["doors","나 칸","올리는 문이 대기열을 보지 않는다","        return drained(await host()?.retry?.());\n","        return true;\n"],
  ["doors","나 칸","연 옛 코치를 닫지 않는다","          game.dispose?.();\n",""],
  ["meAppShell","나 칸","비우기 전에 한 번 더 묻지 않는다"," if(!window.confirm(meText('me.clearAsk')))return;\n",""],
  ["meAppShell","나 칸","입구에 옛 엔진의 두 문을 넘기지 않는다","trail:trailOf(m),oldEngine:oldDoorsOf(m)});","trail:trailOf(m)});"],
  ["clear","나 칸","옛 엔진의 비우는 문에 옛 로그 읽개를 넘기지 않는다(GA1)","      ? { clear: options => oldEngine.clear({ ...(options ?? {}), read: store ? legacyReader(store) : () => null }) }\n","      ? { clear: options => oldEngine.clear(options) }\n"],
  ["doors","나 칸","올리는 문이 대기열 0만 믿는다 — 다른 탭이 임대를 쥔 낡은 0으로 다 올렸다고 답한다(Opus 대체 설계 검토 F1)","  state?.queued === 0 && (state.phase === 'synced' || state.phase === 'idle') && !state.code;\n","  state?.queued === 0;\n"],
  ["doors","나 칸","비우는 문이 손님이 고른 화면 값을 되살리지 않는다(Opus 대체 설계 검토 F2)","            game.setPresentation(kept);\n",""],
  ["clear","나 칸","비운 뒤 「새 길 간 적 있음」 표지를 새 판으로 옮기지 않는다 — 오프라인으로 다시 열면 앞 판 저장소가 열린다(Opus 대체 설계 검토 F3)","    writeMark(store, owner, { went: true, path: mark.path, revision });\n",""],
  ["clear","나 칸","남은 걸음에 그 비우기가 올린 판을 넘기지 않는다 — 넷째 걸음의 경계가 없다(Opus 대체 설계 검토 F5)","settle: mark.left, revision: mark.revision });","settle: mark.left });"],
  ["meAppShell","나 칸","비우기가 실패하면 계정 설정 스냅샷을 새로 받지 않는다(Opus 대체 설계 검토 F8)"," if(operating)try{await account.restore();}"," if(result?.ok&&operating)try{await account.restore();}"],
  ["clear","비우기 입구","옛 대기열을 코치를 열기 전에 올린다 — 서버 비우기와의 틈이 코치 열기 · 첫 받기만큼 넓다(Opus 대체 설계 검토 F1)","    const made = await coachFor(plan, MOVE_BANKS, 'world-practice', at);\n    if (disposed) return stopped(path);\n    if (!made) return { ok: false, path, code: 'OPEN_FAILED', known: true };\n    // 0 — 옛 엔진의 올리기 대기열을 다 올린다(올리는 계정 — 기기 길은 올리지 않는다). 못 올리면 아무것도 지우지 않는다. 코치를 연 뒤 표지를 적기\n    // 바로 전에 올려 서버 비우기와의 틈을 줄인다(4-5 Opus 대체 설계 검토 F1). 새 길의 대기열은 엔진 reset이 서버 비우기 앞에서 올린다.\n    if (path === 'upload' && typeof oldEngine?.flush === 'function') {\n      let flushed;\n      try {\n        flushed = await oldEngine.flush();\n      } catch {\n        flushed = false;\n      }\n      if (disposed) return stopped(path);\n      if (flushed === false || flushed?.ok === false)\n        return { ok: false, path, step: 'upload', code: 'UNSENT', known: true };\n    }\n","    // 0 — 옛 엔진의 올리기 대기열을 다 올린다(올리는 계정 — 기기 길은 올리지 않는다). 못 올리면 아무것도 지우지 않는다. 코치를 연 뒤 표지를 적기\n    // 바로 전에 올려 서버 비우기와의 틈을 줄인다(4-5 Opus 대체 설계 검토 F1). 새 길의 대기열은 엔진 reset이 서버 비우기 앞에서 올린다.\n    if (path === 'upload' && typeof oldEngine?.flush === 'function') {\n      let flushed;\n      try {\n        flushed = await oldEngine.flush();\n      } catch {\n        flushed = false;\n      }\n      if (disposed) return stopped(path);\n      if (flushed === false || flushed?.ok === false)\n        return { ok: false, path, step: 'upload', code: 'UNSENT', known: true };\n    }\n    const made = await coachFor(plan, MOVE_BANKS, 'world-practice', at);\n    if (disposed) return stopped(path);\n    if (!made) return { ok: false, path, code: 'OPEN_FAILED', known: true };\n"],
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
