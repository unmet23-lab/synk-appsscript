// 임시 사본(proto)에 결함 다섯 고친 판을 넣는다. 정확한 원문 조각이 없으면 멈춘다.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const P = process.argv[2];
function patch(rel, pairs) {
  const file = path.join(P, rel); let text = fs.readFileSync(file, 'utf8');
  // 작업본은 core.autocrlf로 CRLF다: 조각의 줄끝을 파일에 맞춘다.
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  for (let [from, to] of pairs) {
    from = from.replace(/\n/g, eol); to = to.replace(/\n/g, eol);
    const at = text.indexOf(from);
    if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`${rel}: 조각이 없거나 둘 이상 — ${from.slice(0, 80)}`);
    text = text.slice(0, at) + to + text.slice(at + from.length);
  }
  fs.writeFileSync(file, text);
  console.log('고침', rel, pairs.length);
}
// 1번: 계정 호스트가 저장소 열거(key · length)를 넘긴다.
patch('account/world-learning-host.js', [
  [`  const shared = { getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } };\n`,
   `  // Page cleanup (atlas/learning-pages.js) and its writer fences need the store's own enumeration (key · length).\n` +
   `  // Pass it through, guarded like every call, when the store has it (synk-account scopedStorage does); without it\n` +
   `  // the engine keeps every page, as before.\n` +
   `  const enumerated = (target, store) => {\n` +
   `    if (typeof store?.key !== 'function' || !('length' in store)) return target;\n` +
   `    Object.defineProperty(target, 'length', { enumerable: true, get() { check(); return store.length; } });\n` +
   `    target.key = index => { check(); return store.key(index); };\n` +
   `    return target;\n` +
   `  };\n` +
   `  const shared = enumerated({ getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } }, storage);\n`],
  [`const own = personalMemory, ownStorage = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => { check(); return own.storage[method]?.(...args); }]));`,
   `const own = personalMemory, ownStorage = enumerated(Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => { check(); return own.storage[method]?.(...args); }])), own.storage);`],
]);
// 2번: 페이지 꼴 저장소도 기록이 다 모인 뒤에는 접는다.
patch('atlas/game-learning.js', [
  [`    // A large server restore keeps its complete causal log in durable pages. In\n    // particular, later pages may contain feedback/exclusions for early parents.\n    if (!folding || paged) return;\n`,
   `    // A large server restore keeps its complete causal log in durable pages until it is complete: later pages\n` +
   `    // may hold feedback/exclusions for early parents. Once the server has sent everything, a paged store folds\n` +
   `    // like any other (plan() folds an item whole with its later entries; a synchronised store folds only what\n` +
   `    // the server sent back), so a second or long-idle device does not carry its whole history forever.\n` +
   `    if (!folding || paged && !complete) return;\n`],
]);
// 3 · 5번: 추천 정책판 5.
patch('atlas/learning.js', [
  [`version: 'learning-priority-4'`, `version: 'learning-priority-5'`],
  [`  return { difficulty, responseFormat, status, priority, n, correct, incorrect, lastAt,\n`,
   `  // The item families whose recent first try missed: each may come back once (rankLearning retry).\n` +
   `  const missed = recent.filter(a => a.verdict === 'incorrect').map(a => a.measure?.familyKey).filter(key => typeof key === 'string');\n` +
   `  return { difficulty, responseFormat, status, priority, n, correct, incorrect, lastAt, missed,\n`],
  [`const CONTENT_LIFT = Object.freeze({ practice: 0.2, review: 0.1, supported: 0.05 });\n`,
   `const CONTENT_LIFT = Object.freeze({ practice: 0.2, review: 0.1, supported: 0.05 });\n` +
   `// Policy 5. A candidate that can give no new first try (every family already presented) goes behind every one that\n` +
   `// still can, and among such candidates the least presented comes first: a small bank no longer holds a learner in\n` +
   `// one cell. One exception: a single family presented once whose first try missed comes back once, a little ahead of\n` +
   `// new items of its cell, once a minute has passed — until then it waits behind every other candidate, so the one\n` +
   `// comeback is never spent early. A comeback is practice, never new evidence (Trail).\n` +
   `const RETRY = Object.freeze({ lift: .05, gapMs: 60000 });\n`],
  [`    const immediate = [...previous].some(index => typeof index === 'number' && index >= presentations.length - 4);\n    const count = [...previous].reduce((n, index) => n + (weight.get(index) || 1), 0);\n`,
   `    const count = [...previous].reduce((n, index) => n + (weight.get(index) || 1), 0);\n` +
   `    const family = candidate.familyKey || candidate.itemKey;\n` +
   `    const seen = candidate.familyKeys ? candidate.familyKeys.every(key => history.family.has(key)) : typeof family === 'string' && history.family.has(family);\n` +
   `    const retry = !candidate.familyKeys && seen && count === 1 && states.some(state => state.missed?.includes(family));\n` +
   `    // A comeback's minute is measured from its one presentation, by time: a day's break is a break. Others keep the last four.\n` +
   `    const waiting = retry && [...previous].some(index => typeof index === 'number' && now - Date.parse(presentations[index].at) < RETRY.gapMs);\n` +
   `    const immediate = !retry && [...previous].some(index => typeof index === 'number' && index >= presentations.length - 4);\n`],
  [`    // A candidate whose every item family was already presented can give no new first try:\n    // it goes behind those that still can, and stays available when nothing else is.\n    const exhausted = !!candidate.familyKeys && candidate.familyKeys.every(key => history.family.has(key));\n    const score = focus.priority - (immediate ? .45 : 0) - (previous.size ? .10 : 0) - (!readyForHarder ? .25 * (candidate.difficulty - 1) : 0)\n      - (exhausted ? .5 : 0);\n    ranked.push({ candidate, focus, score, lift, count, exhausted });\n  }\n  ranked.sort((a, b) => b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));\n`,
   `    // A candidate whose every item family was already presented can give no new first try:\n    // it goes behind those that still can, and stays available when nothing else is.\n    const exhausted = seen && !retry;\n` +
   `    const score = focus.priority + (retry ? RETRY.lift : 0) - (immediate ? .45 : 0) - (previous.size && !retry ? .10 : 0) - (!readyForHarder ? .25 * (candidate.difficulty - 1) : 0)\n      - (exhausted ? .5 : 0);\n` +
   `    // Tiers: new first tries and due comebacks (0) · no new first try, least presented first (1) · a comeback still in its minute (2).\n` +
   `    ranked.push({ candidate, focus, score, lift, count, exhausted, retry: retry && !waiting, tier: waiting ? 2 : exhausted ? 1 : 0 });\n  }\n` +
   `  ranked.sort((a, b) => a.tier - b.tier || (a.tier === 1 ? a.count - b.count : 0) || b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));\n`],
  [`  const ids = new Set(), skills = new Map(profile.skills.map(s => [s.id, s]));\n`,
   `  const ids = new Set(), skills = new Map(profile.skills.map(s => [s.id, s])), now = Date.parse(profile.asOf);\n`],
  [`function recommend(input) {\n  const ranked = rankLearning(input);\n  if (!ranked.length) return { status: 'unavailable', selected: null, reason: '지금 조건에 맞는 연습이 없어요.', alternatives: [] };\n  const best = ranked[0], label = best.focus.skill.label;\n  return { status: 'ready', selected: best.candidate, reason: learningReason({ status: best.focus.status, label }), focusSkillId: best.focus.skill.id,\n`,
   `// What the reason line says about a ranked candidate. The cell state stays the measurement; an unseen cell of an\n` +
   `// ability with evidence elsewhere is a step up or a new way of answering, not an ability with few records.\n` +
   `function reasonStatus({ focus, candidate, retry }) {\n` +
   `  if (retry) return 'retry';\n` +
   `  if (focus.status !== 'unseen') return focus.status;\n` +
   `  const levels = focus.skill.levels, format = candidate.responseFormat ?? 'unknown', difficulty = candidate.difficulty;\n` +
   `  if (difficulty > 1 && levels[difficulty - 1].formats[format].status === 'recent-independent') return 'step-up';\n` +
   `  if (Object.entries(levels[difficulty].formats).some(([name, cell]) => name !== format && (cell.n || cell.assisted))) return 'new-format';\n` +
   `  return 'unseen';\n` +
   `}\n` +
   `function recommend(input) {\n  const ranked = rankLearning(input);\n  if (!ranked.length) return { status: 'unavailable', selected: null, reason: '지금 조건에 맞는 연습이 없어요.', alternatives: [] };\n  const best = ranked[0], label = best.focus.skill.label;\n  return { status: 'ready', selected: best.candidate, reason: learningReason({ status: reasonStatus(best), label }), focusSkillId: best.focus.skill.id,\n`],
  [`    ...detail(best), reason: activityReason({ reasons: best.reasons, state: best.state, label: best.target?.focus.skill.label }),\n`,
   `    ...detail(best), reason: activityReason({ reasons: best.reasons, state: best.target && !best.spent ? reasonStatus(best.target) : best.state, label: best.target?.focus.skill.label }),\n`],
]);
patch('atlas/vellum.js', [
  [`    review: \`\${object} 다시 살펴볼 때예요.\`,\n  };\n`,
   `    review: \`\${object} 다시 살펴볼 때예요.\`,\n` +
   `    // Policy 5 (learning.js reasonStatus): the cell is new, the ability is not; and a missed item's one comeback.\n` +
   `    'step-up': \`\${named} 앞 단계를 최근 혼자 해냈어요. 한 단계 올려 봐요.\`,\n` +
   `    'new-format': \`\${object} 다른 방식으로 확인해 봐요.\`,\n` +
   `    retry: \`\${named}에서 놓친 문제를 한 번 더 풀어 봐요.\`,\n  };\n`],
]);
