// 검수(2026-11-10)에서 재현된 결함 장면 ①~⑤와, 설계 검토(아르곤 · 아스트라)가 시제품 1판에서 짚은 장면 ⑥~⑪을 새 두뇌 2판으로 돌린다.
// ①~⑤의 「지금 엔진」 숫자는 검수 재현(atlas-fable-review-20261110/repro/)에 있다.
import { PARAMS, createMemory, createLearner, choose, present, record, startSession, reasonLine } from './brain.mjs';
import { loadFsrs } from './fsrs-path.mjs';
const memory = createMemory(loadFsrs());
const DAY = 86400000, T0 = Date.parse('2026-12-01T09:00:00Z');
const mk = (skill, d, i, extra = {}) => ({ id: `${skill}.d${d}.${i}`, familyKey: `${skill}.d${d}.${i}`, skillId: skill, difficulty: d, responseFormat: 'cup-compose', order: 0, ...extra });
const play = (learner, item, correct, now, extra = {}) => record(learner, memory, item, { correct, assessable: true, ...extra }, now);
const run = (learner, all, n, clock, answer = () => true, log = null) => {
  for (let i = 0; i < n; i += 1) {
    const row = choose(all, learner, memory, clock.now)[0];
    present(learner, row); play(learner, row.item, answer(row.item), clock.now); log?.(row); clock.now += 20000;
  }
};
const word = (id, i, extra = {}) => ({ id, familyKey: id, kcIds: [`word:${id}`], skillId: 'ko.reading.vocabulary', difficulty: 1, responseFormat: 'single-choice', order: i, ...extra });
const bare = id => id.replace('word:', '');

{ // ① 문항이 적은 칸에 갇힘 — 지금 엔진: 40문항 중 38번이 그 칸(35번은 본 문항), 「최근 놓친 …」 38번, 29일째까지 그대로
  const learner = createLearner(), clock = { now: T0 }; startSession(learner, clock.now);
  const cell = Array.from({ length: 6 }, (_, i) => mk('ko.listening.negation', 2, i));
  const others = ['ko.listening.detail', 'ko.listening.condition'].flatMap(s => Array.from({ length: 6 }, (_, i) => mk(s, 1, i)));
  const all = [...cell, ...others];
  for (const [item, ok] of [[cell[0], false], [cell[1], false], [cell[2], true]]) { play(learner, item, ok, clock.now); clock.now += 20000; }
  let inCell = 0, repeats = 0, count = 0, idleFrom = null; const reasons = new Map(), seenBefore = new Set(learner.seenFamilies), after = { cell: 0, other: 0 };
  run(learner, all, 40, clock, () => true, row => {
    count += 1;
    if (row.idle && idleFrom == null) idleFrom = count;
    const here = row.item.skillId === 'ko.listening.negation';
    if (idleFrom == null) { if (here) { inCell += 1; if (seenBefore.has(row.item.familyKey)) repeats += 1; } reasons.set(row.why.code, (reasons.get(row.why.code) || 0) + 1); }
    else after[here ? 'cell' : 'other'] += 1;
    seenBefore.add(row.item.familyKey);
  });
  console.log('① 문항 6개 칸에서 틀림 · 틀림 · 맞음 뒤 40문항 전부 정답');
  console.log(`   ${idleFrom - 1}문항 뒤 「급한 것도 새것도 없다」고 알림. 그때까지 그 칸 ${inCell}회(다시 본 문항 ${repeats} — 틀린 둘을 한 번씩) · 다른 칸 ${idleFrom - 1 - inCell}회 · 이유 종류 ${JSON.stringify([...reasons])}`);
  console.log(`   알린 뒤에도 판을 이어 가면(길이가 정해진 게임): 그 칸 ${after.cell}회 · 다른 칸 ${after.other}회`);
  for (const days of [1, 8, 29]) {
    const now = T0 + days * DAY; startSession(learner, now);
    const due = all.filter(item => memory.isDue(learner.memory.get(`family:${item.familyKey}`), now));
    console.log(`   ${days}일 뒤 돌아올 때가 된 문항 ${due.length}개(그 칸 ${due.filter(i => i.skillId === 'ko.listening.negation').length})`);
  }
}
{ // ② 찰칵 낱말 「약한 낱말 먼저」 — 지금 엔진: 틀린 두 낱말이 12개 중 7·9위, 추적된 내용 0건
  const learner = createLearner(), clock = { now: T0 }; startSession(learner, clock.now);
  const items = ['cat', 'stop', 'dorm', 'store', 'university', 'bookstore', 'bank', 'cafeteria', 'library', 'office', 'pharmacy', 'post'].map((w, i) => word(w, i));
  for (const item of items.slice(0, 8)) { play(learner, item, !['dorm', 'bookstore'].includes(item.id), clock.now); clock.now += 15000; }
  const ranked = choose(items, learner, memory, clock.now);
  console.log('② 낱말 12개 중 8개를 풀고 dorm · bookstore를 틀림');
  console.log('   다음 순서:', ranked.map(r => r.item.id).join(' > '));
  console.log('   첫 이유:', reasonLine(ranked[0].why, bare));
  startSession(learner, T0 + 14 * 3600000);
  const evening = choose(items, learner, memory, T0 + 14 * 3600000);
  console.log('   같은 날 밤(14시간 뒤) 순서:', evening.slice(0, 4).map(r => `${r.item.id}(${r.why.code})`).join(' > '));
  startSession(learner, T0 + 3 * DAY);
  const later = choose(items, learner, memory, T0 + 3 * DAY);
  console.log('   사흘 뒤 순서:', later.slice(0, 6).map(r => `${r.item.id}(${r.why.code})`).join(' > '));
  console.log('   사흘 뒤 첫 이유:', reasonLine(later[0].why, bare));
}
{ // ③ 올라가는 순간의 이유 — 지금 엔진: 「… 아직 기록이 적어요. 짧게 확인해 봐요.」 (난도의 움직임만 보려고 새것 한도를 넉넉히 둔다)
  const P = { ...PARAMS, newPerSession: 30, newPerDay: 30 };
  const learner = createLearner(), clock = { now: T0 }; startSession(learner, clock.now, P);
  const levels = [1, 2].map(d => Array.from({ length: 10 }, (_, i) => mk('ko.listening.detail', d, i, { responseFormat: 'single-choice' })));
  const all = levels.flat(), label = () => '듣고 세부 정보 찾기', lines = [];
  const pick = () => choose(all, learner, memory, clock.now, { params: P });
  const answer = (row, correct) => { present(learner, row); record(learner, memory, row.item, { correct, assessable: true }, clock.now, P); clock.now += 20000; };
  const step = correct => { const row = pick()[0]; answer(row, correct); lines.push(`난도 ${row.item.difficulty}(${row.why.code}) ${correct ? '맞힘' : '틀림'}`); return row; };
  for (const item of levels[0].slice(0, 4)) answer(pick().find(r => r.item === item), true);
  const up = pick()[0];
  console.log('③ 난도 1을 혼자 네 번 맞힌 뒤');
  console.log(`   고른 문항 난도 ${up.item.difficulty} · 예상 성공 ${up.p.toFixed(2)} · 이유: ${reasonLine(up.why, label)}`);
  for (let i = 0; i < 2; i += 1) step(false); // 올라간 난도에서 두 번 틀린다
  for (let i = 0; i < 9; i += 1) step(true);
  console.log('   그 뒤 열한 걸음(둘 틀리고 아홉 맞힘):\n     ' + lines.join(' → '));
  const reasons = lines.filter(line => /skill\./.test(line)).length;
  console.log(`   그 사이 「올려요 · 쉬운 것부터」 이유가 나온 횟수: ${reasons}(난도가 실제로 바뀐 걸음에서만)`);
}
{ // ④ 한 번 틀린 낱말과 한 번 맞힌 낱말, 8일 뒤 — 지금 엔진: 맞힌 낱말이 앞선다
  const learner = createLearner(); startSession(learner, T0);
  const w = ['w0001', 'w0002', 'w0003', 'w0004'].map((id, i) => word(id, i));
  play(learner, w[0], false, T0); play(learner, w[1], true, T0 + 20000);
  startSession(learner, T0 + 8 * DAY);
  console.log('④ w0001 틀림 · w0002 맞음, 8일 뒤 순서:', choose(w, learner, memory, T0 + 8 * DAY).map(r => `${r.item.id}(${r.why.code})`).join(' > '));
}
{ // ⑤ 다 아는 칸의 복습이 새것을 밀어냄 — 지금 엔진: 30문항 중 26번이 다 쓴 칸의 같은 네 문항
  const learner = createLearner(), clock = { now: T0 }; startSession(learner, clock.now);
  const a = Array.from({ length: 4 }, (_, i) => mk('ko.reading.reason', 1, i, { responseFormat: 'single-choice' }));
  const b = Array.from({ length: 12 }, (_, i) => mk('ko.reading.detail', 1, i, { responseFormat: 'single-choice' }));
  for (const item of a) { play(learner, item, true, clock.now); clock.now += 20000; }
  clock.now = T0 + 8 * DAY; startSession(learner, clock.now);
  let order = '', idleFrom = null;
  run(learner, [...a, ...b], 30, clock, () => true, row => { if (row.idle && idleFrom == null) idleFrom = order.length + 1; order += row.item.skillId.endsWith('reason') ? 'A' : 'b'; });
  console.log('⑤ 칸 A(4문항)를 첫날 다 맞히고 8일 뒤 30문항:', order);
  console.log(`   급한 것도 새것도 없다고 알린 때: ${idleFrom}번째부터 · 그 전까지 A ${[...order.slice(0, idleFrom - 1)].filter(c => c === 'A').length}회 · 새 문항 ${[...order.slice(0, idleFrom - 1)].filter(c => c === 'b').length}회(한 판 한도 ${PARAMS.newPerSession})`);
}
{ // ⑥ 최대 간격 60일(아스트라): 떠올릴 확률이 높아도 60일이 지나면 돌아온 것으로 본다
  const learner = createLearner(); let now = T0; startSession(learner, now);
  const old = word('known', 0, { responseFormat: 'cup-compose' }), fresh = Array.from({ length: 3 }, (_, i) => word(`new${i}`, i + 1));
  for (let i = 0; i < 7; i += 1) { play(learner, old, true, now); now += Math.ceil(memory.intervalDays(learner.memory.get('word:known'))) * DAY; startSession(learner, now); }
  const state = learner.memory.get('word:known'), at = state.lastAt + 61 * DAY; startSession(learner, at);
  const top = choose([old, ...fresh], learner, memory, at)[0];
  console.log(`⑥ 일곱 번 제때 맞힌 낱말(안정도 ${state.stability.toFixed(0)}일), 61일 뒤: 떠올릴 확률 ${memory.retrievability(state, at).toFixed(2)} · 맨 앞 ${top.item.id}(${top.why.code})`);
}
{ // ⑦ 재시도 한도(아스트라 · 아르곤): 세 단위를 계속 틀려도 한 판에 단위당 세 번(처음 + 다시 둘)까지
  const learner = createLearner(), clock = { now: T0 }; startSession(learner, clock.now);
  const hard = Array.from({ length: 3 }, (_, i) => word(`hard${i}`, i)), easy = Array.from({ length: 24 }, (_, i) => word(`easy${i}`, i + 3));
  const shown = new Map(); let order = '';
  run(learner, [...hard, ...easy], 24, clock, item => !item.id.startsWith('hard'), row => { shown.set(row.item.id, (shown.get(row.item.id) || 0) + 1); order += row.item.id.startsWith('hard') ? 'H' : 'e'; });
  console.log(`⑦ 늘 틀리는 낱말 셋 + 쉬운 낱말 스물넷, 한 판 24문항: ${order} · 늘 틀리는 낱말이 나온 횟수 ${hard.map(i => shown.get(i.id) || 0).join(' · ')}`);
  startSession(learner, T0 + DAY);
  const next = choose([...hard, ...easy], learner, memory, T0 + DAY)[0];
  console.log(`   다음 날 맨 앞: ${next.item.id}(${next.why.code}) — ${reasonLine(next.why, bare)}`);
}
{ // ⑦-나 숨 고르기: 아는 낱말이 있는 사람이 새 낱말을 이어서 놓치면, 다시 내기 전에 잘 아는 것 하나를 먼저 낸다
  const learner = createLearner(); startSession(learner, T0);
  const known = Array.from({ length: 8 }, (_, i) => word(`known${i}`, i)), hard = Array.from({ length: 4 }, (_, i) => word(`hard${i}`, i + 8));
  for (const [i, item] of known.entries()) play(learner, item, true, T0 + i * 20000);
  const at = T0 + DAY; startSession(learner, at); // 하루 뒤: 아는 낱말은 아직 또렷하다(돌아올 때가 아니다)
  let order = ''; const clock = { now: at }; let line = '';
  run(learner, [...known, ...hard], 12, clock, item => !item.id.startsWith('hard'), row => { order += row.breather ? 'B' : row.item.id.startsWith('hard') ? 'H' : 'k'; if (row.breather && !line) line = reasonLine(row.why, bare); });
  console.log(`⑦-나 아는 낱말 여덟 + 늘 틀리는 새 낱말 넷: ${order}(H 놓친 새 낱말 · B 숨 고르기 · k 아는 낱말) — ${line}`);
}
{ // ⑧ 아는 단위 + 처음 만나는 단위가 섞인 문항(아스트라 · 아르곤): 새것으로 세고 idle로 덮지 않는다. 실패는 주 단위에 적는다
  const learner = createLearner(), clock = { now: T0 }; startSession(learner, clock.now);
  const a = { ...word('A', 0), kcIds: ['word:A'] }, ab = { id: 'AB', familyKey: 'AB', kcIds: ['word:B', 'word:A'], skillId: 'ko.reading.vocabulary', difficulty: 1, responseFormat: 'single-choice', order: 1 };
  play(learner, a, true, clock.now); clock.now += 20000;
  const row = choose([ab], learner, memory, clock.now)[0];
  console.log(`⑧ A를 맞힌 뒤 A+B 문항만 남음: ${row.why.code}(${bare(row.why.slots.unit || '')}) · idle ${row.idle} · 새 단위 ${row.fresh}`);
  present(learner, row); const result = play(learner, ab, false, clock.now);
  console.log(`   그 문항을 틀리면 실패가 적히는 단위: ${result.credited.map(bare).join(', ')} · A의 놓친 횟수 ${learner.memory.get('word:A').lapses}`);
}
{ // ⑨ 같은 자리의 답은 하나로(아르곤): 틀린 뒤 몇 분 사이 두 번 맞혀도 간격이 그대로, 힌트를 봐도 난이도 값이 겹쳐 오르지 않는다
  const learner = createLearner(); startSession(learner, T0);
  const w = word('sit', 0), log = [];
  const snap = label => { const s = learner.memory.get('word:sit'); log.push(`${label} 안정도 ${s.stability.toFixed(2)}일 · 난이도 ${s.difficulty.toFixed(2)} · 만난 자리 ${s.sittings} · 놓침 ${s.lapses}`); };
  play(learner, w, false, T0); snap('틀림:');
  play(learner, w, true, T0 + 60000, { assisted: true }); snap('1분 뒤 힌트 보고 맞힘:');
  play(learner, w, true, T0 + 120000); snap('2분 뒤 혼자 맞힘:');
  play(learner, w, true, T0 + DAY); snap('다음 날 혼자 맞힘:');
  console.log('⑨ 같은 자리의 답\n   ' + log.join('\n   '));
}
{ // ⑩ 쉬다 돌아온 사람(아르곤): 2주 동안 40낱말을 배우고 3주를 쉰 뒤의 첫 판 — 살릴 수 있는 것부터, 셋에 하나는 새것
  const learner = createLearner(); let now = T0;
  const items = Array.from({ length: 120 }, (_, i) => word(`w${String(i).padStart(3, '0')}`, i));
  for (let day = 0; day < 14; day += 1) { now = T0 + day * DAY; startSession(learner, now); run(learner, items, 15, { now }, () => true); }
  now = T0 + 35 * DAY; startSession(learner, now);
  const first = choose(items, learner, memory, now)[0], met = learner.memory.size;
  const all = [...learner.memory.values()].map(state => memory.retrievability(state, now)).sort((a, b) => a - b);
  let order = ''; const picked = [];
  run(learner, items, 12, { now }, () => true, row => { order += row.tier === 1 ? 'R' : row.tier === 2 ? 'N' : '·'; if (row.tier === 1) picked.push(row.need); }); // 밀린 것이 많을 때 need = 떠올릴 확률
  console.log(`⑩ 2주 동안 낱말 ${met}개를 만나고 3주를 쉰 뒤의 첫 판: 밀린 단위 ${first.backlog}개(떠올릴 확률 ${all[0].toFixed(2)}~${all.at(-1).toFixed(2)}) · 낸 차례 ${order}(R 돌아온 것 · N 새것)`);
  console.log(`   돌아온 것으로 낸 단위의 떠올릴 확률: ${picked.map(p => p.toFixed(2)).join(' ')} — 살릴 수 있는 것부터`);
}
{ // ⑪ 능력 추정이 답 순서가 아니라 답 열로 정해지는가(아르곤 · 아스트라): 같은 답들을 다른 차례로 받아도 같은 값
  const answers = [[0, true, 1], [1, true, 1], [2, false, 2], [3, true, 1], [4, true, 2], [5, false, 2], [6, true, 1]];
  const feed = order => { const learner = createLearner(); startSession(learner, T0); for (const k of order) { const [i, ok, d] = answers[k]; record(learner, memory, mk('ko.listening.detail', d, i, { responseFormat: 'single-choice' }), { correct: ok, assessable: true }, T0 + i * 60000); } return learner; };
  const inOrder = feed([0, 1, 2, 3, 4, 5, 6]), late = feed([0, 1, 4, 5, 6, 2, 3]);
  const stateOf = l => JSON.stringify([...l.memory].sort().map(([unit, s]) => [unit, s.stability.toFixed(4), s.lapses]));
  // 시제품의 record는 받은 차례로 불리지만 계산은 시각 순 답 열의 함수다. (「처음 본 계열」을 시각 순으로 다시 가리는 일은 서버 접기의 몫이고 시제품에는 없다 — 여기 답들은 계열이 겹치지 않는다.)
  console.log(`⑪ 같은 답 일곱을 제 차례로 / 둘을 늦게 받았을 때: θ ${inOrder.ability.get('ko.listening.detail').theta.toFixed(4)} / ${late.ability.get('ko.listening.detail').theta.toFixed(4)} · 단위 상태 같음 ${stateOf(inOrder) === stateOf(late)}`);
  // 아스트라가 짚은 장면: A 맞힘(0일) · B 맞힘(8일) · A+B 틀림(10일), 그리고 A 맞힘(9일)이 늦게 도착. 실패가 적히는 단위가 다른 단위의 상태에 기대면 두 결과가 달라진다.
  const a = word('A', 0), b = word('B', 1), ab = { id: 'A+B', familyKey: 'A+B', kcIds: ['word:A', 'word:B'], skillId: 'ko.reading.vocabulary', difficulty: 1, responseFormat: 'single-choice', order: 2 };
  const late9 = word('A2', 3, { kcIds: ['word:A'] });
  const events = [[a, true, 0], [b, true, 8], [late9, true, 9], [ab, false, 10]];
  const replay = order => { const learner = createLearner(); startSession(learner, T0); for (const k of order) { const [item, ok, day] = events[k]; record(learner, memory, item, { correct: ok, assessable: true }, T0 + day * DAY); } return learner; };
  const full = replay([0, 1, 2, 3]), delayed = replay([0, 1, 3, 2]);
  console.log(`   여러 단위 문항의 실패 귀속: 제 차례 A 놓침 ${full.memory.get('word:A').lapses} · B 놓침 ${full.memory.get('word:B').lapses} / 늦게 받음 A 놓침 ${delayed.memory.get('word:A').lapses} · B 놓침 ${delayed.memory.get('word:B').lapses} · 단위 상태 같음 ${stateOf(full) === stateOf(delayed)}`);
}
{ // ⑫ 하루 한도: 게임을 잇달아 다섯 판(판마다 20문항) 해도 새 단위는 판마다 여섯, 하루 스물에서 멈춘다
  const learner = createLearner(); let now = T0; const perRound = [];
  const items = Array.from({ length: 120 }, (_, i) => word(`d${String(i).padStart(3, '0')}`, i));
  for (let round = 0; round < 5; round += 1) {
    startSession(learner, now);
    const before = learner.memory.size, clock = { now }; let idleAt = null, n = 0;
    run(learner, items, 20, clock, () => true, row => { n += 1; if (row.idle && idleAt == null) idleAt = n; });
    perRound.push(`${learner.memory.size - before}${idleAt ? `(${idleAt}번째부터 아는 것으로 채움)` : ''}`); now = clock.now + 60000;
  }
  console.log(`⑫ 잇달아 다섯 판(20문항씩, 다 맞힘) — 판마다 새로 만난 낱말: ${perRound.join(' · ')} · 하루 합 ${learner.memory.size}(하루 한도 ${PARAMS.newPerDay})`);
}
