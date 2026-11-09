// 검수(2026-11-10)에서 재현된 결함 장면을 새 두뇌 시제품으로 다시 돌린다. 숫자는 지금 엔진의 재현(repro/)과 나란히 읽는다.
import { PARAMS, createMemory, createLearner, choose, present, record, startSession, reasonLine } from './brain.mjs';
import { loadFsrs } from './fsrs-path.mjs';
const memory = createMemory(loadFsrs());
const DAY = 86400000, T0 = Date.parse('2026-12-01T09:00:00Z');
const mk = (skill, d, i, extra = {}) => ({ id: `${skill}.d${d}.${i}`, familyKey: `${skill}.d${d}.${i}`, skillId: skill, difficulty: d, responseFormat: 'cup-compose', order: 0, ...extra });
const play = (learner, item, correct, now) => record(learner, memory, item, { correct, assessable: true }, now);
const run = (learner, all, n, clock, answer = () => true, log = null) => {
  for (let i = 0; i < n; i += 1) {
    const row = choose(all, learner, memory, clock.now)[0];
    present(learner, row); play(learner, row.item, answer(row.item), clock.now); log?.(row); clock.now += 20000;
  }
};

{ // ① 문항이 적은 칸에 갇힘 — 지금 엔진: 40문항 중 38번이 그 칸(35번은 본 문항), 「최근 놓친 …」 38번, 29일째까지 그대로
  const learner = createLearner(), clock = { now: T0 }; startSession(learner);
  const cell = Array.from({ length: 6 }, (_, i) => mk('ko.listening.negation', 2, i));
  const others = ['ko.listening.detail', 'ko.listening.condition'].flatMap(s => Array.from({ length: 6 }, (_, i) => mk(s, 1, i)));
  const all = [...cell, ...others];
  for (const [item, ok] of [[cell[0], false], [cell[1], false], [cell[2], true]]) { play(learner, item, ok, clock.now); clock.now += 20000; }
  let inCell = 0, repeats = 0, count = 0, idleFrom = null; const reasons = new Map(), seenBefore = new Set(learner.seenFamilies);
  run(learner, all, 40, clock, () => true, row => {
    count += 1;
    if (row.idle && idleFrom == null) idleFrom = count;
    if (idleFrom == null) {
      if (row.item.skillId === 'ko.listening.negation') { inCell += 1; if (seenBefore.has(row.item.familyKey)) repeats += 1; }
      reasons.set(row.why.code, (reasons.get(row.why.code) || 0) + 1);
    }
    seenBefore.add(row.item.familyKey);
  });
  console.log('① 문항 6개 칸에서 틀림·틀림·맞음 뒤 40문항 전부 정답');
  console.log(`   ${idleFrom - 1}문항 뒤 「급한 것도 새것도 없다」고 알림. 그때까지 그 칸 ${inCell}회(다시 본 문항 ${repeats} — 틀린 둘을 한 번씩) · 다른 칸 ${idleFrom - 1 - inCell}회 · 이유 종류 ${JSON.stringify([...reasons])}`);
  for (const days of [1, 8, 29]) {
    const now = T0 + days * DAY;
    const due = all.filter(item => { const r = memory.retrievability(learner.memory.get(`family:${item.familyKey}`), now); return r != null && r < PARAMS.retention; });
    console.log(`   ${days}일 뒤 돌아올 때가 된 문항 ${due.length}개(그 칸 ${due.filter(i => i.skillId === 'ko.listening.negation').length})`);
  }
}
{ // ② 찰칵 낱말 「약한 낱말 먼저」 — 지금 엔진: 틀린 두 낱말이 12개 중 7·9위, 추적된 내용 0건
  const learner = createLearner(), clock = { now: T0 }; startSession(learner);
  const words = ['cat', 'stop', 'dorm', 'store', 'university', 'bookstore', 'bank', 'cafeteria', 'library', 'office', 'pharmacy', 'post'];
  const items = words.map((w, i) => ({ id: `snap.${w}`, familyKey: `snap.${w}`, kcIds: [`word:${w}`], skillId: 'ko.reading.vocabulary', difficulty: 1, responseFormat: 'single-choice', order: i }));
  for (const item of items.slice(0, 8)) { play(learner, item, !['dorm', 'bookstore'].includes(item.id.slice(5)), clock.now); clock.now += 15000; }
  const ranked = choose(items, learner, memory, clock.now);
  console.log('② 낱말 12개 중 8개를 풀고 dorm · bookstore를 틀림');
  console.log('   다음 순서:', ranked.map(r => r.item.id.slice(5)).join(' > '));
  console.log('   첫 이유:', reasonLine(ranked[0].why, id => id.replace('word:', '')));
  startSession(learner);
  const later = choose(items, learner, memory, T0 + 3 * DAY);
  console.log('   사흘 뒤 순서:', later.slice(0, 6).map(r => `${r.item.id.slice(5)}(${r.why.code})`).join(' > '));
  console.log('   사흘 뒤 첫 이유:', reasonLine(later[0].why, id => id.replace('word:', '')));
}
{ // ③ 올라가는 순간의 이유 — 지금 엔진: 「… 아직 기록이 적어요. 짧게 확인해 봐요.」
  const learner = createLearner(), clock = { now: T0 }; startSession(learner);
  const d1 = Array.from({ length: 6 }, (_, i) => mk('ko.listening.detail', 1, i, { responseFormat: 'single-choice' }));
  const d2 = Array.from({ length: 6 }, (_, i) => mk('ko.listening.detail', 2, i, { responseFormat: 'single-choice' }));
  const all = [...d1, ...d2];
  for (const item of d1.slice(0, 4)) { const row = choose(all, learner, memory, clock.now).find(r => r.item === item); present(learner, row); play(learner, item, true, clock.now); clock.now += 20000; }
  const next = choose(all, learner, memory, clock.now)[0];
  console.log('③ 난도 1을 혼자 네 번 맞힌 뒤');
  console.log(`   고른 문항 난도 ${next.item.difficulty} · 예상 성공 ${next.p.toFixed(2)} · 이유: ${reasonLine(next.why, () => '듣고 세부 정보 찾기')}`);
  present(learner, next); play(learner, next.item, false, clock.now); clock.now += 20000;
  const again = choose(all, learner, memory, clock.now)[0]; present(learner, again); play(learner, again.item, false, clock.now); clock.now += 20000;
  const after = choose(all, learner, memory, clock.now)[0];
  console.log(`   난도 2를 두 번 틀린 뒤 고른 문항: 난도 ${after.item.difficulty}(${after.why.code}) · 능력 θ ${learner.ability.get('ko.listening.detail').theta.toFixed(2)}`);
}
{ // ④ 한 번 틀린 낱말과 한 번 맞힌 낱말, 8일 뒤 — 지금 엔진: 맞힌 낱말이 앞선다
  const learner = createLearner(); startSession(learner);
  const w = ['w0001', 'w0002', 'w0003', 'w0004'].map((id, i) => ({ id, familyKey: `racing:${id}`, kcIds: [`ko.word.${id}`], skillId: 'ko.listening.word', difficulty: 1, responseFormat: 'single-choice', order: i }));
  play(learner, w[0], false, T0); play(learner, w[1], true, T0 + 20000);
  startSession(learner);
  const ranked = choose(w, learner, memory, T0 + 8 * DAY);
  console.log('④ w0001 틀림 · w0002 맞음, 8일 뒤 순서:', ranked.map(r => `${r.item.id}(${r.why.code})`).join(' > '));
}
{ // ⑤ 다 아는 칸의 복습이 새것을 밀어냄 — 지금 엔진: 30문항 중 26번이 다 쓴 칸의 같은 네 문항
  const learner = createLearner(), clock = { now: T0 }; startSession(learner);
  const a = Array.from({ length: 4 }, (_, i) => mk('ko.reading.reason', 1, i, { responseFormat: 'single-choice' }));
  const b = Array.from({ length: 12 }, (_, i) => mk('ko.reading.detail', 1, i, { responseFormat: 'single-choice' }));
  for (const item of a) { play(learner, item, true, clock.now); clock.now += 20000; }
  clock.now = T0 + 8 * DAY; startSession(learner);
  let order = '', idleFrom = null;
  run(learner, [...a, ...b], 30, clock, () => true, row => { if (row.idle && idleFrom == null) idleFrom = order.length + 1; order += row.item.skillId.endsWith('reason') ? 'A' : 'b'; });
  console.log('⑤ 칸 A(4문항)를 첫날 다 맞히고 8일 뒤 30문항:', order);
  console.log(`   급한 것도 새것도 없다고 알린 때: ${idleFrom}번째부터 · 그 전까지 A ${[...order.slice(0, idleFrom - 1)].filter(c => c === 'A').length}회 · 새 문항 ${[...order.slice(0, idleFrom - 1)].filter(c => c === 'b').length}회`);
}
