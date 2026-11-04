import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUNDS, WORDS, PICS } from './content.mjs';
import { albumTotal, combosOf, startRound, currentAsk, answer, applyPatch, finishRound, emptySave, normalizeSave, isRight, slotWords, patchOf, underlinedWords, noticeLines, otherScenes, peekScene, chooseCombo, openLine, makeRng, memoShown, setMemo, memoChoices } from './core.mjs';

const syllables = (s) => (String(s).match(/[가-힣]/g) || []).length;
const plain = (s) => String(s).replace(/\[\[|\]\]/g, '');

test('칸마다 갈림 양쪽에 정답이 하나씩 있고, 미끼가 하나 있다', () => {
  for (const r of ROUNDS) for (const s of r.slots) {
    const pair = r.forks[s.fork];
    for (const w of pair) assert.equal(s.opts.filter((o) => o.ok === w).length, 1, `${r.id} ${s.fork} ${w}`);
    assert.equal(s.opts.filter((o) => o.ok === null).length, 1, `${r.id} ${s.fork} 미끼`);
    assert.equal(s.opts.length, 3);
  }
});

test('낱말 하나를 바꾸면 그 칸의 답이 뒤집힌다 — 보기 글은 그대로', () => {
  for (const r of ROUNDS) for (const c of combosOf(r)) for (const s of r.slots) {
    const twin = { ...c, [s.fork]: r.forks[s.fork].find((w) => w !== c[s.fork]) };
    const a = s.opts.find((o) => isRight(s, c, o)), b = s.opts.find((o) => isRight(s, twin, o));
    assert.ok(a && b); assert.notEqual(a.t, b.t, `${r.id} ${s.fork}`);
  }
});

test('틀려도 판은 끝까지 간다 — 틀린 칸에 머물다 맞히면 나아가고 끝난다', () => {
  for (const r of ROUNDS) for (const c of combosOf(r)) {
    const st = startRound(r.id, emptySave(), { rng: makeRng(5), fork: c });
    for (let guard = 0; st.phase !== 'end' && guard < 40; guard += 1) {
      const ask = currentAsk(st);
      if (!ask) { applyPatch(st); continue; }
      const before = st.slot;
      for (const o of ask.opts) { const got = answer(st, o); if (got.right) break; assert.equal(st.slot, before); assert.ok(got.scene.title); st.scene = null; }
      if (st.phase === 'waiting-patch') applyPatch(st);
    }
    assert.equal(st.phase, 'end', `${r.id} ${JSON.stringify(c)}`);
  }
});

test('정정은 한 칸에만 붙고 보기는 앞 칸과 다르다', () => {
  for (const r of ROUNDS) for (const [w, p] of Object.entries(r.patches)) {
    assert.ok(r.forks[r.slots.at(-1).fork].includes(w), `${r.id} ${w}`);
    const before = new Set(r.slots.flatMap((s) => s.opts.map((o) => o.t)));
    for (const o of p.opts) assert.ok(!before.has(o.t), `앞 칸과 같은 보기: ${o.t}`);
    assert.equal(p.opts.filter((o) => o.ok).length, 1);
    assert.ok(WORDS[p.key], `${r.id} 정정 말 ${p.key}`);
  }
});

test('공략: 정정 칸은 「앞 답 그대로 · 뒤집기」 어느 쪽으로도 판의 절반 넘게 안 풀린다', () => {
  for (const r of ROUNDS) {
    const kinds = Object.values(r.patches).map((p) => p.flips);
    assert.equal(kinds.filter(Boolean).length, 1, `${r.id}: 뒤집히는 정정 하나`);
    assert.equal(kinds.filter((k) => !k).length, 1, `${r.id}: 안 뒤집히는 정정 하나`);
    // 보기 안에서 정답 글 자리가 판마다 섞이면 자리 외우기도 안 된다
    const st = startRound(r.id, emptySave(), { rng: makeRng(1) });
    assert.equal(st.patchOrder.length, 3);
  }
});

test('공략: 일부러 틀려도 앨범은 안 찬다 — 끝 화면에서 엿본 것만 찬다', () => {
  const r = ROUNDS[0], c = combosOf(r)[0], save = emptySave();
  const st = startRound(r.id, save, { rng: makeRng(9), fork: c });
  const wrong = currentAsk(st).opts.find((o) => !isRight(r.slots[0], c, o));
  answer(st, wrong); st.scene = null;
  for (const o of currentAsk(st).opts) { if (answer(st, o).right) break; st.scene = null; }
  for (const o of currentAsk(st).opts) { if (answer(st, o).right) break; st.scene = null; }
  applyPatch(st);
  for (const o of currentAsk(st).opts) { if (answer(st, o).right) break; st.scene = null; }
  finishRound(st, save);
  assert.deepEqual(save.album, {});
  const others = otherScenes(st);
  assert.ok(others.length >= 3);
  peekScene(save, others[0]);
  assert.equal(Object.keys(save.album).length, 1);
});

test('공략: 학습 기록 코드가 없다 — ko2 사건을 만들 길이 없다', async () => {
  const fs = await import('node:fs');
  for (const f of ['core.mjs', 'app.mjs', 'content.mjs']) {
    const url = new URL(`./${f}`, import.meta.url);
    if (!fs.existsSync(url)) continue;
    const text = fs.readFileSync(url, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    for (const bad of ['createGame', 'SynkLearning', 'ko2.', 'coach.', 'practice.submit']) assert.ok(!text.includes(bad), `${f}: ${bad}`);
  }
});

test('앨범의 모든 칸은 어느 조합인가의 끝 화면에서 열 수 있다', () => {
  const open = new Set();
  for (const r of ROUNDS) for (const fork of combosOf(r)) for (const o of otherScenes(startRound(r.id, emptySave(), { fork }))) open.add(o.title);
  assert.equal(open.size, albumTotal());
});

test('틀리고 맞힌 말은 다음 조합에 먼저 나온다, 안 푼 말이 그보다 먼저', () => {
  const r = ROUNDS[0], save = emptySave();
  const a = chooseCombo(r, save, makeRng(1));
  // 한 판을 끝내면 정정 쪽지 덕에 수첩에는 갈림 양쪽이 다 든다. 그래도 다음 판은 두 갈림 모두 다른 쪽으로 간다.
  for (const w of [a.f1, ...r.forks.f2]) save.words[w] = {};
  save.combos[r.id] = { [`${a.f1}+${a.f2}`]: 1 };
  const b = chooseCombo(r, save, makeRng(1));
  assert.notEqual(b.f1, a.f1); assert.notEqual(b.f2, a.f2);
  save.combos[r.id] = Object.fromEntries(combosOf(r).map((c) => [`${c.f1}+${c.f2}`, 1]));
  save.missed['한함'] = 1;
  assert.equal(chooseCombo(r, save, makeRng(2)).f1, '한함');
});

test('다음 판 첫 줄이 앞 판 결과를 잇는다', () => {
  const save = emptySave();
  assert.equal(openLine(ROUNDS[1], save), ROUNDS[1].open.first);
  for (const f2 of ROUNDS[0].forks.f2) { assert.ok(ROUNDS[0].patches[f2].win); save.last.laundry = ROUNDS[0].outcome({ f1: '제외', f2 }); assert.match(openLine(ROUNDS[1], save), /찾았어요/); }
  save.last.festival = 'done'; assert.match(openLine(ROUNDS[2], save), /콘서트/);
});

test('연필 메모는 틀려도 벌 없이 맞는 뜻으로 고쳐 적힌다', () => {
  const st = startRound('laundry', emptySave(), { rng: makeRng(3), fork: { f1: '제외', f2: '보관' } });
  setMemo(st, '제외', '그것만');
  assert.equal(memoShown(st, '제외'), '그것만');
  st.got.push('제외');
  assert.equal(memoShown(st, '제외'), '그건 빼고');
  assert.equal(memoShown(st, '보관'), null);
  const c = memoChoices('제외', makeRng(1));
  assert.deepEqual([...c].sort(), ['그건 빼고', '그것만'].sort());
});

test('저장이 깨져도 빈 판으로 시작한다', () => {
  assert.deepEqual(normalizeSave('이상한 값').words, {});
  assert.deepEqual(normalizeSave({ words: { 없는말: {} , 제외: {} } }).words, { 제외: {} });
});

// ── 원고 규칙(설계 3절) ──
test('밑줄 말마다 답이 걸린 칸이 있다 — 허탕 밑줄이 없다', () => {
  for (const r of ROUNDS) for (const c of combosOf(r)) {
    const keys = new Set(r.slots.flatMap((s) => slotWords(s, c)));
    for (const w of underlinedWords(r, c)) assert.ok(keys.has(w), `${r.id} ${w}`);
  }
});

test('보기에 쉬운 뜻 문자열이 없다 — 보기는 뜻풀이가 아니라 행동이다', () => {
  for (const r of ROUNDS) {
    const opts = [...r.slots.flatMap((s) => s.opts), ...Object.values(r.patches).flatMap((p) => p.opts)];
    const words = Object.values(r.forks).flat().concat(Object.values(r.patches).map((p) => p.key));
    for (const o of opts) for (const w of words) {
      assert.ok(!o.t.includes(w), `${r.id}: 보기에 낱말 그대로 「${o.t}」`);
      assert.ok(!o.t.includes(WORDS[w].easy), `${r.id}: 보기에 쉬운 뜻 「${o.t}」`);
    }
  }
});

test('게시물은 합쳐 90음절 이내(잡음 쪽지 빼고), 정정을 넣어도 125음절 이내', () => {
  for (const r of ROUNDS) for (const c of combosOf(r)) {
    let n = 0;
    for (const notice of r.notices) { n += syllables(notice.title); for (const l of noticeLines(r, c, notice)) n += syllables(plain(typeof l === 'string' ? l : l.text || l.big || '')); }
    assert.ok(n <= 90, `${r.id} ${JSON.stringify(c)}: ${n}음절`);
    assert.ok(n + syllables(plain(patchOf(r, c).line)) <= 125, `${r.id} 정정 포함 ${n}`);
  }
});

test('낱말마다 단서 둘 · 쉬운 뜻 · 틀린 뜻 · 그림이 있고, 단서에 그 낱말이 표시돼 있다', () => {
  for (const [w, d] of Object.entries(WORDS)) {
    assert.ok(d.easy && (d.decoy || WORDS[d.twin]), w); assert.ok(PICS[d.pic], `${w} 그림`);
    assert.equal(d.clues.length, 2, w);
    for (const c of d.clues) { assert.match(c, /\[\[[^\]]+\]\]/, w); assert.ok(!plain(c).includes(d.easy), `단서가 뜻을 그대로 말한다: ${c}`); }
  }
});

test('모든 틀린 보기에 사진 · 제목 · 한 줄이 있다', () => {
  for (const r of ROUNDS) {
    for (const s of r.slots) for (const o of s.opts) { assert.ok(o.pic && o.title && o.line, `${r.id} ${o.t}`); }
    for (const p of Object.values(r.patches)) for (const o of p.opts) if (!o.ok) assert.ok(o.pic && o.title && o.line, `${r.id} ${o.t}`);
    for (const p of Object.values(r.patches)) assert.ok(p.win && p.react && p.say && p.after_say);
  }
});

test('시간 제한 · 점수 코드가 없다', async () => {
  const fs = await import('node:fs');
  const text = fs.readFileSync(new URL('./core.mjs', import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('/**')).join('\n');
  for (const bad of ['setTimeout', 'Date.now', 'score =', 'timeLimit']) assert.ok(!text.includes(bad), bad);
});
