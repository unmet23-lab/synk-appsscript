# 고친 사본 차이 (2026-11-10 · 설계 v0.2)

[설계](설계.md)의 고친 판을 저장소 밖 임시 사본에 넣어 잰 차이다. 바탕은 `3a89a847c`의 원천 다섯 파일이고, 설계 검수 GPT GA1 · GA2(1분 안의 한 번 다시는 모든 후보 뒤에서 기다린다)를 반영했다. 같은 판을 `적용/patch_proto.cjs` · `적용/patch_snap.cjs`가 작업본에 그대로 얹는다.

```diff
--- a/account/world-learning-host.js
+++ b/account/world-learning-host.js
@@ -22,7 +22,16 @@
   let sync, primary, memory, memoryReady, personal, privacyBlocked = false, closed = false, run = null, generation = 0;
   const coaches = new Set(), memoryListeners = new Set();
   const check = () => { guard(); if (closed || privacyBlocked) throw failure('WORLD account session ended', 'MEMORY_SESSION_ENDED'); };
-  const shared = { getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } };
+  // Page cleanup (atlas/learning-pages.js) and its writer fences need the store's own enumeration (key · length).
+  // Pass it through, guarded like every call, when the store has it (synk-account scopedStorage does); without it
+  // the engine keeps every page, as before.
+  const enumerated = (target, store) => {
+    if (typeof store?.key !== 'function' || !('length' in store)) return target;
+    Object.defineProperty(target, 'length', { enumerable: true, get() { check(); return store.length; } });
+    target.key = index => { check(); return store.key(index); };
+    return target;
+  };
+  const shared = enumerated({ getItem(key) { check(); return storage.getItem(key); }, setItem(key, value) { check(); storage.setItem(key, value); }, removeItem(key) { check(); storage.removeItem(key); } }, storage);
   const ownerKey = eventId => `${OWNER}.${eventId}`;
   // The list of owner records only serves to remove them later. Each record is its own key, so two
   // tabs writing the list at once can at worst leave a record behind, never lose one.
@@ -93,7 +102,7 @@
     check();
     const make = engine?.createGame && engine?.createLearningSync ? engine : { createGame: factory, createLearningSync: createSync };
     if (personalMemory && !personal) {
-      const own = personalMemory, ownStorage = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => { check(); return own.storage[method]?.(...args); }]));
+      const own = personalMemory, ownStorage = enumerated(Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => { check(); return own.storage[method]?.(...args); }])), own.storage);
       // This adapter uses the ordinary personal account store, including its existing epoch.
       // It never imports or uploads a class's evidence, and it keeps today's condition local.
       personal = make.createGame({ gameId: 'world-personal-memory', storage: ownStorage, learnerKey: 'device', storageScope: 'account', accountKey: own.accountKey, historyComplete: !own.connected, fold: { remote: true } });
--- a/atlas/game-learning.js
+++ b/atlas/game-learning.js
@@ -242,9 +242,11 @@
   };
   // Fold older, finished items once the kept log grows past the limit (see `fold`).
   function compact() {
-    // A large server restore keeps its complete causal log in durable pages. In
-    // particular, later pages may contain feedback/exclusions for early parents.
-    if (!folding || paged) return;
+    // A large server restore keeps its complete causal log in durable pages until it is complete: later pages
+    // may hold feedback/exclusions for early parents. Once the server has sent everything, a paged store folds
+    // like any other (plan() folds an item whole with its later entries; a synchronised store folds only what
+    // the server sent back), so a second or long-idle device does not carry its whole history forever.
+    if (!folding || paged && !complete) return;
     const events = log(), now = Date.parse(monotonicClock());
     if (events.length <= folding.max) return;
     // Nothing could fold a moment ago: try again after a minute or once more entries settle.
--- a/atlas/learning.js
+++ b/atlas/learning.js
@@ -1,7 +1,7 @@
 'use strict';
 // Core: operational practice priorities, NOT calibrated proficiency or TOPIK grades.
 // Receives Trail provenance and Strata nodes; owns neither identity nor storage.
-const POLICY = Object.freeze({ version: 'learning-priority-4', recentDays: 30, reviewDays: 7, sample: 4, stableRatio: .8 });
+const POLICY = Object.freeze({ version: 'learning-priority-5', recentDays: 30, reviewDays: 7, sample: 4, stableRatio: .8 });
 const RESPONSE_FORMATS = Object.freeze(['binary-choice', 'single-choice', 'cup-compose', 'action', 'spoken', 'unknown']); // spoken: a learner's own line judged by rules on its transcript
 const { learningReason, activityReason, SUPPORTS } = require('./vellum');
 const Ledger = require('./learning-ledger');
@@ -26,7 +26,9 @@
   // Keep the actual source even when an old item is due outside the recent window, or
   // a supported success has no independent attempt. A reason must not lose its provenance.
   const reasonEvidence = status === 'supported' ? helped.slice(-12) : status === 'review' && !recent.length ? valid.slice(-1) : recent;
-  return { difficulty, responseFormat, status, priority, n, correct, incorrect, lastAt,
+  // The item families whose recent first try missed: each may come back once (rankLearning retry).
+  const missed = recent.filter(a => a.verdict === 'incorrect').map(a => a.measure?.familyKey).filter(key => typeof key === 'string');
+  return { difficulty, responseFormat, status, priority, n, correct, incorrect, lastAt, missed,
     assisted: helped.length, evidence: recent.map(a => a.eventId), reasonEvidence: reasonEvidence.map(a => a.eventId),
     unassessed: rows.filter(a => a.verdict === 'unassessed' || a.verdict === 'skipped').length + (base?.unassessed || 0) };
 }
@@ -59,9 +61,15 @@
 // Missed or due content (a word, a grammar point) puts a candidate a little ahead of those its
 // ability's own state ranks alike; it never moves one ability, level or history past another.
 const CONTENT_LIFT = Object.freeze({ practice: 0.2, review: 0.1, supported: 0.05 });
+// Policy 5. A candidate that can give no new first try (every family already presented) goes behind every one that
+// still can, and among such candidates the least presented comes first: a small bank no longer holds a learner in
+// one cell. One exception: a single family presented once whose first try missed comes back once, a little ahead of
+// new items of its cell, once a minute has passed — until then it waits behind every other candidate, so the one
+// comeback is never spent early. A comeback is practice, never new evidence (Trail).
+const RETRY = Object.freeze({ lift: .05, gapMs: 60000 });
 function rankLearning({ profile, candidates, presentations = [], audioAvailable = true, excludeIds = [], prior = null }) {
   if (!Array.isArray(candidates)) throw new TypeError('Core: candidates must be an array');
-  const ids = new Set(), skills = new Map(profile.skills.map(s => [s.id, s]));
+  const ids = new Set(), skills = new Map(profile.skills.map(s => [s.id, s])), now = Date.parse(profile.asOf);
   const content = new Map((profile.concepts || []).map(c => [c.id, c.status]));
   // Index history once. A changed choice/item ID is still the same content when
   // it belongs to a seen family; overlapping keys count one presentation.
@@ -99,8 +107,13 @@
     const focus = states.sort((a, b) => b.priority - a.priority)[0];
     const previous = new Set([...(history.task.get(candidate.id) || []), ...(history.item.get(candidate.itemKey) || []),
       ...(history.family.get(candidate.familyKey || candidate.itemKey) || [])]);
-    const immediate = [...previous].some(index => typeof index === 'number' && index >= presentations.length - 4);
     const count = [...previous].reduce((n, index) => n + (weight.get(index) || 1), 0);
+    const family = candidate.familyKey || candidate.itemKey;
+    const seen = candidate.familyKeys ? candidate.familyKeys.every(key => history.family.has(key)) : typeof family === 'string' && history.family.has(family);
+    const retry = !candidate.familyKeys && seen && count === 1 && states.some(state => state.missed?.includes(family));
+    // A comeback's minute is measured from its one presentation, by time: a day's break is a break. Others keep the last four.
+    const waiting = retry && [...previous].some(index => typeof index === 'number' && now - Date.parse(presentations[index].at) < RETRY.gapMs);
+    const immediate = !retry && [...previous].some(index => typeof index === 'number' && index >= presentations.length - 4);
     // Explicit authored difficulty is a language-complexity bucket, never a TOPIK band.
     // Sparse evidence starts with simpler candidates, while supported needs can still be revisited.
     const readyForHarder = candidate.difficulty === 1 || candidate.skillIds.every(id => skills.get(id).levels[candidate.difficulty - 1].formats[responseFormat].status === 'recent-independent');
@@ -110,19 +123,30 @@
     const lift = Math.max(0, ...(candidate.conceptIds || []).map(id => CONTENT_LIFT[content.get(id)] || 0));
     // A candidate whose every item family was already presented can give no new first try:
     // it goes behind those that still can, and stays available when nothing else is.
-    const exhausted = !!candidate.familyKeys && candidate.familyKeys.every(key => history.family.has(key));
-    const score = focus.priority - (immediate ? .45 : 0) - (previous.size ? .10 : 0) - (!readyForHarder ? .25 * (candidate.difficulty - 1) : 0)
+    const exhausted = seen && !retry;
+    const score = focus.priority + (retry ? RETRY.lift : 0) - (immediate ? .45 : 0) - (previous.size && !retry ? .10 : 0) - (!readyForHarder ? .25 * (candidate.difficulty - 1) : 0)
       - (exhausted ? .5 : 0);
-    ranked.push({ candidate, focus, score, lift, count, exhausted });
+    // Tiers: new first tries and due comebacks (0) · no new first try, least presented first (1) · a comeback still in its minute (2).
+    ranked.push({ candidate, focus, score, lift, count, exhausted, retry: retry && !waiting, tier: waiting ? 2 : exhausted ? 1 : 0 });
   }
-  ranked.sort((a, b) => b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
+  ranked.sort((a, b) => a.tier - b.tier || (a.tier === 1 ? a.count - b.count : 0) || b.score - a.score || b.lift - a.lift || a.count - b.count || a.candidate.difficulty - b.candidate.difficulty || a.candidate.id.localeCompare(b.candidate.id));
   return ranked;
 }
+// What the reason line says about a ranked candidate. The cell state stays the measurement; an unseen cell of an
+// ability with evidence elsewhere is a step up or a new way of answering, not an ability with few records.
+function reasonStatus({ focus, candidate, retry }) {
+  if (retry) return 'retry';
+  if (focus.status !== 'unseen') return focus.status;
+  const levels = focus.skill.levels, format = candidate.responseFormat ?? 'unknown', difficulty = candidate.difficulty;
+  if (difficulty > 1 && levels[difficulty - 1].formats[format].status === 'recent-independent') return 'step-up';
+  if (Object.entries(levels[difficulty].formats).some(([name, cell]) => name !== format && (cell.n || cell.assisted))) return 'new-format';
+  return 'unseen';
+}
 function recommend(input) {
   const ranked = rankLearning(input);
   if (!ranked.length) return { status: 'unavailable', selected: null, reason: '지금 조건에 맞는 연습이 없어요.', alternatives: [] };
   const best = ranked[0], label = best.focus.skill.label;
-  return { status: 'ready', selected: best.candidate, reason: learningReason({ status: best.focus.status, label }), focusSkillId: best.focus.skill.id,
+  return { status: 'ready', selected: best.candidate, reason: learningReason({ status: reasonStatus(best), label }), focusSkillId: best.focus.skill.id,
     state: best.focus.status, responseFormat: best.focus.responseFormat, policy: POLICY.version, evidence: best.focus.evidence,
     alternatives: ranked.slice(1).map(r => r.candidate) };
 }
@@ -210,7 +234,7 @@
     evidence: [...(row.target?.focus.reasonEvidence || row.target?.focus.evidence || [])], ...(row.due ? { reviewAt: row.candidate.reviewAt, reviewSource: 'host-schedule' } : {}),
     ...(row.hostNeed ? { hostEvidence: { kind: row.hostNeed.kind, at: row.hostNeed.at, evidenceRefs: [...row.hostNeed.evidenceRefs], source: 'host-practice' } } : {}) });
   return { ...common, status: 'ready', selected: best.candidate, alternatives: ranked.slice(1).map(row => row.candidate),
-    ...detail(best), reason: activityReason({ reasons: best.reasons, state: best.state, label: best.target?.focus.skill.label }),
+    ...detail(best), reason: activityReason({ reasons: best.reasons, state: best.target && !best.spent ? reasonStatus(best.target) : best.state, label: best.target?.focus.skill.label }),
     basis: best.due ? 'review-schedule' : best.hostNeed ? 'host-practice' : best.target && best.state !== 'unseen' ? 'practice' : best.matchedGoals.length ? 'declared' : 'cold-start',
     assessments: ranked.map(detail) };
 }
--- a/atlas/vellum.js
+++ b/atlas/vellum.js
@@ -47,6 +47,10 @@
     supported: `${object} 도움과 함께 해냈어요. 이어서 살펴봐요.`,
     'recent-independent': `${object} 최근 혼자 해냈어요. 가볍게 이어가요.`,
     review: `${object} 다시 살펴볼 때예요.`,
+    // Policy 5 (learning.js reasonStatus): the cell is new, the ability is not; and a missed item's one comeback.
+    'step-up': `${named} 앞 단계를 최근 혼자 해냈어요. 한 단계 올려 봐요.`,
+    'new-format': `${object} 다른 방식으로 확인해 봐요.`,
+    retry: `${named}에서 놓친 문제를 한 번 더 풀어 봐요.`,
   };
   if (!Object.hasOwn(reasons, status)) throw new TypeError('Vellum: invalid learning reason');
   return reasons[status];
--- a/experiences/snap-words/learning.mjs
+++ b/experiences/snap-words/learning.mjs
@@ -10,6 +10,16 @@
 
 const BASIC_ABOVE = new Set(['water', 'tray', 'copier', 'vending']);   // 기초 낱말 목록 밖의 물건 이름(2중 검수 11-04)
 export const difficultyOf = (word) => (wordOf(word)?.band === 'notice' || BASIC_ABOVE.has(word) ? 2 : 1);
+// 낱말 태그(11-10 Atlas 검수 결함 4): 문항이 어느 낱말을 묻는지 Core가 알게 한다. 값은 Strata TOPIK I 지도의 낱말 마디
+// (국립국어원 학습용 어휘 A · B, strata/topik-i.words.json)이고 learning.test.mjs가 한국어 낱말과 마디 이름이 같은지 본다.
+// 목록 밖 낱말(band life · notice)은 마디가 없어 태그가 없다.
+export const WORD_CONCEPT = Object.freeze({
+  library: 'ko.word.w0600', dorm: 'ko.word.w0743', cafeteria: 'ko.word.w0553', bank: 'ko.word.w0039',
+  bookstore: 'ko.word.w0762', post: 'ko.word.w0040', pharmacy: 'ko.word.w0801', office: 'ko.word.w0605',
+  university: 'ko.word.w0733', stop: 'ko.word.w0776', cat: 'ko.word.w0042', bike: 'ko.word.w0035', tree: 'ko.word.w0050',
+  building: 'ko.word.w0391', toilet: 'ko.word.w0619', stairs: 'ko.word.w1737', entrance: 'ko.word.w1715',
+  umbrella: 'ko.word.w0025', sofa: 'ko.word.w0723', menu: 'ko.word.w0752',
+});
 export const SKILL = Object.freeze({ meaning: 'ko.reading.vocabulary', word: 'ko.reading.vocabulary', recall: 'ko.reading.vocabulary', notice: 'ko.reading.detail', sound: 'ko.listening.word' });
 
 /** 문항 하나의 기록 칸. form: meaning · word · sound · notice(부탁) / recall-word · recall-meaning(인화). */
@@ -17,7 +27,7 @@
   const version = ITEM_VERSION[`${form}.${word}`] || 1, sound = form === 'sound', notice = wordOf(word)?.band === 'notice';
   const skillId = sound ? SKILL.sound : notice || form === 'notice' ? SKILL.notice : SKILL.meaning;
   return { id: `${GAME_ID}.${form}.${word}`, itemKey: `${GAME_ID}.${form}.${word}.v${version}`, familyKey: `${GAME_ID}.${form}.${word}.v1`, skillId,
-    difficulty: difficultyOf(word), modality: sound ? 'listening' : 'reading', responseFormat: FORMAT, audioRequired: sound, confounded: false, conceptIds: [] };
+    difficulty: difficultyOf(word), modality: sound ? 'listening' : 'reading', responseFormat: FORMAT, audioRequired: sound, confounded: false, conceptIds: WORD_CONCEPT[word] ? [WORD_CONCEPT[word]] : [] };
 }
 export const missionMetadata = (m) => itemMetadata(m.kind, m.word);
 export const recallMetadata = (q) => itemMetadata(q.mode === 'word' ? 'recall-word' : 'recall-meaning', q.answer);
```
