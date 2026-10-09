// 한글 단계 판단의 시험(설계 §13의 인수 기준 가운데 MVP 범위). node --test experiences/hangul-stage/core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPack, decompose } from './pack.mjs';
import { songById, tileLetters, lettersIn, cueAt } from './songs.mjs';
import { josa } from './kit/josa.mjs';
import { emptyProgress, readProgress, planSession, answer, meet, finishSession, view, letterOf, retryItem, nextLetters, canPlayMore, graduationReady, graduate, SETTINGS } from './core.mjs';

const layer = JSON.parse(fs.readFileSync(new URL('../../strata/hangul.json', import.meta.url), 'utf8'));
const pack = createPack(layer);
const DAY = 86400000;
const at = (day, minutes = 0) => new Date(Date.UTC(2026, 9, 5 + day, 1, minutes)).toISOString();
const unitIndex = id => layer.units.findIndex(u => u.letters.includes(id));
const items = plan => plan.steps.filter(s => s.kind === 'item').map(s => s.item);
const optionLetters = item => item.options ? item.options.map(o => o.letter) : item.cards ? item.cards.map(c => c.letter)
  : [...item.pieces.consonants, ...item.pieces.vowels];

// 한 회차를 끝까지 푼다. choose(item)는 고른 답의 글자를 돌려준다(정답이면 target.letter).
function play(progress, { day, sessionNo = 0, choose = item => null }) {
  const now = at(day, sessionNo * 10);
  const plan = planSession(progress, pack, { now, sessionNo });
  let p = progress, total = 0, independent = 0;
  const sessionId = `${plan.day}#${sessionNo}`;
  for (const step of plan.steps) {
    if (step.kind === 'meet') { p = meet(p, [step.letter], now); continue; }
    const item = step.item, wrong = choose(item);
    const correct = !wrong;
    p = answer(p, { focus: item.focus, correct, at: now, sessionId, word: !!item.word, confused: wrong ? [[item.target.letter, wrong]] : [] });
    total += 1; if (correct) independent += 1;
  }
  p = finishSession(p, { day: plan.day, sessionNo, total, independent });
  return { progress: p, plan };
}

test('첫 회차: 새 글자 셋(ㅏ ㅓ ㅗ)을 만나기 카드로 먼저 만나고, 보기는 만난 글자뿐이다', () => {
  const plan = planSession(emptyProgress(), pack, { now: at(0) });
  assert.deepEqual(plan.fresh, ['v-a', 'v-eo', 'v-o']);
  const seen = new Set();
  for (const step of plan.steps) {
    if (step.kind === 'meet') { seen.add(step.letter); continue; }
    for (const id of optionLetters(step.item)) assert.ok(seen.has(id), `만나기 전 글자 ${id}가 보기로 나옴`);
  }
  assert.equal(items(plan).length, SETTINGS.amount);
  assert.equal(plan.reason.kind, 'new');
  assert.deepEqual(plan.reason.letters, ['ㅏ', 'ㅓ', 'ㅗ']);
});

test('단원은 선행이다: 앞 단원의 글자를 다 만나기 전에는 다음 단원의 새 글자가 나오지 않는다', () => {
  let p = emptyProgress();
  for (let day = 0; day < 30; day += 1) {
    const before = new Set(pack.letters.filter(l => letterOf(p, l.id).state !== 'unmet').map(l => l.id));
    const { progress, plan } = play(p, { day });
    for (const id of plan.fresh) {
      const u = unitIndex(id);
      for (const prev of layer.units.slice(0, u).flatMap(x => x.letters)) assert.ok(before.has(prev), `${id} 앞에 ${prev}를 만나지 않음`);
    }
    p = progress;
  }
  assert.ok(pack.letters.every(l => letterOf(p, l.id).state !== 'unmet'), '다 맞히는 사람은 30일 안에 이 판의 글자를 다 만난다');
});

test('같은 사람·같은 날·같은 회차는 같은 문항을 낸다', () => {
  const p = play(emptyProgress(), { day: 0 }).progress;
  const a = planSession(p, pack, { now: at(1), sessionNo: 0 }), b = planSession(p, pack, { now: at(1, 30), sessionNo: 0 });
  assert.deepEqual(a.steps, b.steps);
  const c = planSession(p, pack, { now: at(1), sessionNo: 1 });
  assert.notDeepEqual(a.steps, c.steps);
});

test('같은 꼴은 세 번 넘게 이어지지 않고, 꼴이 셋 이상이면 회차에 셋 이상 섞인다', () => {
  let p = emptyProgress();
  for (let day = 0; day < 20; day += 1) {
    const { progress, plan } = play(p, { day });
    const list = items(plan);
    for (let i = 3; i < list.length; i += 1) assert.ok(!(list[i].type === list[i - 1].type && list[i].type === list[i - 2].type && list[i].type === list[i - 3].type), `${day}일: ${list.map(x => x.type).join(',')}`);
    if (day > 2) assert.ok(new Set(list.map(x => x.type)).size >= 3, `${day}일 꼴: ${[...new Set(list.map(x => x.type))]}`);
    p = progress;
  }
});

test('소리로 가를 수 없는 짝(ㅐ/ㅔ)과 같은 소리는 소리 문항의 보기에 함께 나오지 않는다', () => {
  // ㅐ·ㅔ를 이미 만난 사람의 여러 회차를 훑는다.
  let p = meet(emptyProgress(), pack.letters.map(l => l.id), at(0));
  for (let day = 1; day < 40; day += 1) {
    for (let s = 0; s < 3; s += 1) {
      const plan = planSession(p, pack, { now: at(day, s * 10), sessionNo: s });
      for (const item of items(plan)) {
        const texts = item.options ? item.options.map(o => o.text) : item.cards ? item.cards.map(c => c.voice) : null;
        if (!texts) { assert.ok(!(item.pieces.vowels.includes('v-ae') && item.pieces.vowels.includes('v-e')), '음절 만들기에 ㅐ와 ㅔ가 함께'); continue; }
        for (let i = 0; i < texts.length; i += 1) for (let j = i + 1; j < texts.length; j += 1) assert.ok(!pack.sameSound(texts[i], texts[j]), `${item.type}: ${texts}`);
      }
    }
    p = play(p, { day }).progress;
  }
});

test('ㅓ/ㅗ를 자주 헷갈리는 사람에게 그 짝이 다시 오고, 이유 한 줄이 그 짝을 가리킨다', () => {
  let p = play(emptyProgress(), { day: 0, choose: item => (item.target.letter === 'v-eo' && optionLetters(item).includes('v-o') ? 'v-o' : null) }).progress;
  assert.ok(p.pairs['v-eo|v-o']?.wrong > 0, '헷갈린 짝이 남는다');
  const plan = planSession(p, pack, { now: at(1) });
  assert.equal(plan.reason.kind, 'pair');
  assert.deepEqual([...plan.reason.letters].sort(), ['ㅓ', 'ㅗ'].sort());
  assert.ok(plan.reviews.includes('v-eo') && plan.reviews.includes('v-o'), '복습 앞자리에 그 짝');
  assert.match(plan.reason.text, /헷갈린/);
});

test('「익힘」은 서로 다른 두 회차에 걸친 세 번의 혼자 맞힘으로만 선다', () => {
  const s = (n, i) => ({ focus: ['v-a'], correct: true, at: at(n, i), sessionId: `d${n}` });
  let p = meet(emptyProgress(), ['v-a'], at(0));
  p = answer(p, s(0, 1)); p = answer(p, s(0, 2)); p = answer(p, s(0, 3));
  assert.equal(letterOf(p, 'v-a').state, 'learning', '한 회차의 세 번은 익힘이 아니다');
  p = answer(p, s(1, 1));
  assert.equal(letterOf(p, 'v-a').state, 'mastered');
  // 도움받은 정답은 세지 않는다.
  let q = meet(emptyProgress(), ['v-o'], at(0));
  for (let d = 0; d < 3; d += 1) q = answer(q, { focus: ['v-o'], correct: true, assisted: true, at: at(d), sessionId: `d${d}` });
  assert.notEqual(letterOf(q, 'v-o').state, 'mastered');
  // 익힌 뒤에 틀리면 익히는 중으로 돌아가지만, 보이는 자수(best)는 줄지 않는다.
  p = answer(p, { focus: ['v-a'], correct: false, at: at(2), sessionId: 'd2', confused: [['v-a', 'v-eo']] });
  assert.equal(letterOf(p, 'v-a').state, 'learning');
  assert.equal(letterOf(p, 'v-a').best, 'mastered');
  assert.equal(view(p, pack, at(2)).letters.find(l => l.id === 'v-a').shown, 'mastered');
});

test('틀린 글자는 그날 다시 오고, 맞히기 시작하면 다음 복습까지의 간격이 벌어진다', () => {
  let p = meet(emptyProgress(), ['v-eo', 'v-o', 'v-a'], at(0));
  p = answer(p, { focus: ['v-eo'], correct: false, at: at(0), sessionId: 'd0', confused: [['v-eo', 'v-o']] });
  assert.ok(Date.parse(letterOf(p, 'v-eo').due) <= Date.parse(at(0)));
  const gaps = [];
  for (let d = 1; d <= 4; d += 1) {
    p = answer(p, { focus: ['v-eo'], correct: true, at: at(d * 10), sessionId: `d${d}` });
    gaps.push(Date.parse(letterOf(p, 'v-eo').due) - Date.parse(at(d * 10)));
  }
  for (let i = 1; i < gaps.length; i += 1) assert.ok(gaps[i] >= gaps[i - 1], `간격 ${gaps.map(g => g / DAY)}`);
  assert.ok(gaps.at(-1) > gaps[0]);
  // 다시 듣고 맞힌 것은 맞힘이지만 간격을 늘리지 않는다.
  const before = letterOf(p, 'v-eo').step;
  p = answer(p, { focus: ['v-eo'], correct: true, replays: 2, at: at(60), sessionId: 'd60' });
  assert.ok(letterOf(p, 'v-eo').step <= before);
  // 회차 안에서 한 번 더: 막 틀린 꼴과 다른 꼴로.
  const again = retryItem(p, pack, 'v-eo', { now: at(60), n: 1, avoid: 'listen_pick' });
  assert.equal(again.type, 'see_pick');
  assert.equal(again.target.letter, 'v-eo');
});

test('간판은 그 글자를 다 익혔을 때만 또렷해지고, 명패의 받침 칸은 받침을 익혀야 채워진다', () => {
  let p = meet(emptyProgress(), ['v-o', 'v-i'], at(0));
  assert.equal(view(p, pack, at(0)).signs.find(s => s.text === '오이').readable, false);
  for (const [d, id] of [[0, 'v-o'], [0, 'v-i'], [1, 'v-o'], [1, 'v-i'], [2, 'v-o'], [2, 'v-i']]) p = answer(p, { focus: [id], correct: true, at: at(d), sessionId: `d${d}` });
  const v = view(p, pack, at(2));
  assert.equal(v.signs.find(s => s.text === '오이').readable, true);
  assert.equal(v.signs.find(s => s.text === '나무').readable, false);
  // 다시 틀려도 읽히는 간판은 흐려지지 않는다.
  p = answer(p, { focus: ['v-o'], correct: false, at: at(3), sessionId: 'd3', confused: [['v-o', 'v-u']] });
  assert.equal(view(p, pack, at(3)).signs.find(s => s.text === '오이').readable, true);
  const plate = view(p, pack, at(3)).plate;
  const finalCells = plate.flatMap(s => s.cells).filter(c => c.final);
  assert.equal(finalCells.length, 2, '한·국의 받침 칸');
  assert.ok(finalCells.every(c => !c.filled && !c.later), '받침을 익히기 전에는 비어 있고, 채울 수 있는 칸이다');
  let q = p;
  for (const [d, id] of [[0, 'f-n'], [0, 'f-g'], [1, 'f-n'], [1, 'f-g'], [2, 'f-n'], [2, 'f-g']]) q = answer(q, { focus: [id], correct: true, at: at(d), sessionId: `d${d}` });
  assert.ok(view(q, pack, at(3)).plate.flatMap(s => s.cells).filter(c => c.final).every(c => c.filled), '받침 ㄴ·ㄱ을 익히면 채워진다');
});

test('막히는 사람에게는 새 글자를 쉬게 하고, 난이도는 이어서 두 회차가 막히면 내려간다', () => {
  let p = readProgress({ ...emptyProgress(), difficulty: 2 });
  p = meet(p, ['v-a', 'v-eo', 'v-o', 'v-u'], at(0));
  for (let d = 0; d < 2; d += 1) p = play(p, { day: d, choose: item => optionLetters(item).find(id => id !== item.target.letter) || null }).progress;
  assert.equal(p.difficulty, 1);
  assert.deepEqual(planSession(p, pack, { now: at(3) }).fresh, [], '혼자 맞힌 비율이 60% 아래면 새 글자 0');
});

test('「더 하기」는 하루 두 번까지다', () => {
  let p = emptyProgress();
  for (let s = 0; s < 3; s += 1) { assert.ok(canPlayMore(p, at(0, s * 10))); p = play(p, { day: 0, sessionNo: s }).progress; }
  assert.equal(canPlayMore(p, at(0, 40)), false);
  assert.equal(canPlayMore(p, at(1)), true);
});

test('보이는 글은 한국어뿐이다(이유 한 줄·단원 이름·간판)', () => {
  let p = emptyProgress();
  for (let day = 0; day < 12; day += 1) {
    const plan = planSession(p, pack, { now: at(day) });
    assert.doesNotMatch(plan.reason.text, /[A-Za-z]/);
    p = play(p, { day, choose: item => (day % 3 === 1 && item.target.letter === 'v-eo' ? optionLetters(item).find(id => id !== 'v-eo') : null) }).progress;
  }
  const v = view(p, pack, at(12));
  for (const u of v.units) assert.doesNotMatch(u.label, /[A-Za-z]/);
  assert.deepEqual(nextLetters(emptyProgress(), pack, 2), ['v-a', 'v-eo']);
});

test('필요한 소리의 목록에 글자·음절·받침 음절·낱말이 다 들어 있다(앱이 내는 소리는 모두 목록 안)', () => {
  const m = pack.audioManifest();
  assert.equal(m.voice, null);
  for (const l of pack.letters) assert.ok(m.clips.includes(l.voice));
  for (const w of pack.words) assert.ok(m.clips.includes(w.text));
  assert.ok(m.clips.length > 100);
  // 여러 회차의 모든 문항이 내는 소리(정답·보기·만든 음절)가 목록 안에 있다.
  let p = emptyProgress();
  const missing = new Set();
  for (let day = 0; day < 60; day += 1) {
    const plan = planSession(p, pack, { now: at(day) });
    for (const i of items(plan)) {
      const texts = i.type === 'match' ? i.cards.map(c => c.voice) : [i.target.text, ...(i.options || []).map(o => o.text)];
      for (const t of texts) if (!m.clips.includes(t)) missing.add(t);
    }
    p = play(p, { day }).progress;
  }
  assert.deepEqual([...missing], []);
});

// ── 둘째 판: 받침·짝·가르쳐 주기·졸업 ──
// 받침 앞의 다섯 단원(U1~U5)의 글자.
const U14 = layer.units.slice(0, 5).flatMap(u => u.letters);
const finalIds = pack.letters.filter(l => l.role === 'final').map(l => l.id);
const U7 = layer.units.find(u => u.id === 'U7').letters;

test('받침 단원은 다섯 단원(U1~U5)을 다 만난 뒤에 나오고, 받침 하나만 알 때는 「받침 없음」과 견준다', () => {
  assert.deepEqual(nextLetters(meet(emptyProgress(), U14.slice(0, -1), at(0)), pack, 3), [U14.at(-1)], 'U5가 남으면 받침이 먼저 나오지 않는다');
  let p = meet(emptyProgress(), U14, at(0));
  for (const id of U14) for (const d of [0, 1, 2]) p = answer(p, { focus: [id], correct: true, at: at(d), sessionId: `d${d}` });
  assert.deepEqual(nextLetters(p, pack, 2), ['f-n', 'f-r']);
  const plan = planSession(p, pack, { now: at(3) });
  assert.ok(plan.reason.text.includes('받침'), plan.reason.text);
  // 받침 ㄴ 하나만 만난 다음 날: 새 받침을 만나기 전의 복습 문항은 「안 / 아」처럼 받침이 있고 없음을 가른다.
  const solo = planSession(meet(p, ['f-n'], at(3)), pack, { now: at(4) });
  const firstMeet = solo.steps.findIndex(s => s.kind === 'meet');
  const early = (firstMeet < 0 ? solo.steps : solo.steps.slice(0, firstMeet)).filter(s => s.kind === 'item').map(s => s.item);
  assert.ok(early.some(i => i.focus.includes('f-n')), `받침 ㄴ 복습이 나온다: ${early.map(i => i.type)}`);
  for (const i of early.filter(x => x.final)) assert.ok(i.options.some(o => o.none), `받침 하나일 때 받침 없는 보기: ${i.options.map(o => o.text)}`);
});

test('받침 ㄱ·ㄷ·ㅂ·ㅅ·ㅈ(U7)은 1단에서 소리로 묻지 않고, [ㄷ]으로 같이 나는 받침은 소리 보기에 함께 나오지 않는다', () => {
  let p = readProgress({ ...meet(emptyProgress(), pack.letters.map(l => l.id), at(0)), difficulty: 1 });
  for (let day = 1; day < 25; day += 1) {
    const plan = planSession(p, pack, { now: at(day) });
    for (const i of items(plan)) {
      if (U7.includes(i.target.letter) && plan.difficulty === 1) assert.ok(!['listen_pick', 'pair', 'teach'].includes(i.type) || i.again, `${day}일 ${i.type} ${i.target.text}`);
      if (i.options) for (let a = 0; a < i.options.length; a += 1) for (let b = a + 1; b < i.options.length; b += 1) assert.ok(!pack.sameSound(i.options[a].text, i.options[b].text), `${i.type} ${i.options.map(o => o.text)}`);
      if (i.type === 'build' && i.pieces.finals) for (const f of i.pieces.finals.filter(x => x !== i.target.final)) assert.ok(!pack.sameSound(pack.syllable(i.target.consonant, i.target.vowel, f), i.target.text));
    }
    p = play(p, { day }).progress;
  }
  assert.ok(pack.sameSound('옷', '옫') && pack.sameSound('낮', '낟') && !pack.sameSound('안', '앙'));
});

test('받침을 둘 이상 알면 음절 만들기에 받침 줄이 붙는다(자음·모음·받침 조각으로 받침 음절 만들기)', () => {
  let p = readProgress({ ...meet(emptyProgress(), pack.letters.map(l => l.id), at(0)), difficulty: 2 });
  const built = [];
  for (let day = 1; day < 30; day += 1) {
    const plan = planSession(p, pack, { now: at(day) });
    built.push(...items(plan).filter(i => i.type === 'build' && i.pieces.finals));
    p = play(p, { day }).progress;
  }
  assert.ok(built.length >= 3, `받침 음절 만들기 ${built.length}번`);
  for (const i of built) {
    assert.ok(i.focus.includes(i.target.final) && i.pieces.finals.includes(i.target.final) && i.pieces.finals.length >= 2);
    assert.equal(i.target.text, pack.syllable(i.target.consonant, i.target.vowel, i.target.final));
  }
});

test('짝 문항은 소리로 가를 수 있는 짝 둘이고, 가르쳐 주기는 복습 자리에서만 몽글이 든 틀린 보기와 함께 나온다', () => {
  let p = meet(emptyProgress(), U14, at(0));
  p = answer(p, { focus: ['v-eo'], correct: false, at: at(0), sessionId: 'd0', confused: [['v-eo', 'v-o']] });
  let pairs = 0, teaches = 0;
  for (let day = 1; day < 30; day += 1) {
    const plan = planSession(p, pack, { now: at(day) });
    const list = items(plan);
    list.forEach((i, n) => {
      if (i.type === 'pair') { pairs += 1; assert.equal(i.options.length, 2); const [a, b] = i.options.map(o => o.letter); const rel = pack.related(a, b); assert.ok(rel?.sound && rel.byEar, `${a}|${b}`); }
      if (i.type === 'teach') { teaches += 1; assert.ok(i.wrong && i.wrong !== i.target.text && i.options.some(o => o.text === i.wrong)); assert.ok(n < plan.reviews.length, '복습 자리에서만'); }
    });
    assert.ok(list.filter(i => i.type === 'teach').length <= 1);
    p = play(p, { day }).progress;
  }
  assert.ok(pairs > 0 && teaches > 0, `짝 ${pairs} 가르쳐 주기 ${teaches}`);
});

test('졸업: 핵심 글자를 다 만나고, 최근 스무 문항 90% 이상, 낱말을 이어서 다섯 번 읽어 내면. 그 뒤는 짧은 몸풀기', () => {
  let p = meet(emptyProgress(), pack.units.flatMap(u => u.letters), at(0));
  assert.equal(graduationReady(p, pack), false, '최근 문항이 없으면 아니다');
  for (let i = 0; i < 20; i += 1) p = answer(p, { focus: [], correct: true, at: at(1), sessionId: 'd1' });
  assert.equal(graduationReady(p, pack), false, '낱말 다섯 번 전에는 아니다');
  for (let i = 0; i < 4; i += 1) p = answer(p, { focus: [], correct: true, word: true, at: at(1), sessionId: 'd1' });
  p = answer(p, { focus: [], correct: false, word: true, at: at(1), sessionId: 'd1' });
  assert.equal(p.wordStreak, 0, '틀리면 이어서 센 낱말 수가 처음부터');
  for (let i = 0; i < 5; i += 1) p = answer(p, { focus: [], correct: true, word: true, at: at(1), sessionId: 'd1' });
  assert.equal(graduationReady(p, pack), true);
  const g = graduate(p, at(1));
  assert.equal(graduationReady(g, pack), false, '한 번만 졸업한다');
  const plan = planSession(g, pack, { now: at(2) });
  assert.ok(plan.warmup && items(plan).length <= SETTINGS.warmup && !plan.fresh.length, `몸풀기 ${items(plan).length}`);
  assert.ok(view(g, pack, at(2)).graduated);
});

test('다 맞히는 사람은 받침까지 만나고 졸업에 닿는다(사람 입력 0)', () => {
  let p = emptyProgress(), day = 0;
  for (; day < 70 && !p.graduated; day += 1) {
    p = play(p, { day }).progress;
    if (graduationReady(p, pack)) p = graduate(p, at(day));
  }
  assert.ok(p.graduated, `70일 안에 졸업하지 못함 — 만난 받침 ${finalIds.filter(id => letterOf(p, id).state !== 'unmet').length}, 낱말 ${p.wordStreak}`);
  assert.ok(finalIds.every(id => letterOf(p, id).state !== 'unmet'));
  console.log(`졸업까지 ${day}일`);
});

// ── 셋째 판: 된소리·겹모음(U8·U9) ──
const coreLetters = layer.units.filter(u => u.core !== false).flatMap(u => u.letters);
const lateLetters = layer.units.filter(u => u.core === false).flatMap(u => u.letters);

test('된소리·겹모음(U8·U9)은 받침 뒤에 나오고 졸업 조건이 아니다 — 졸업 뒤 몸풀기에서 남은 글자를 만난다', () => {
  assert.deepEqual(layer.units.slice(-2).map(u => u.id), ['U8', 'U9']);
  assert.deepEqual(nextLetters(meet(emptyProgress(), coreLetters, at(0)), pack, 2), ['c-kk', 'c-tt'], '받침까지 만나면 된소리');
  assert.deepEqual(nextLetters(meet(emptyProgress(), [...coreLetters, ...layer.units.find(u => u.id === 'U8').letters], at(0)), pack, 2), ['v-wa', 'v-wo'], '된소리 다음 겹모음');
  let p = meet(emptyProgress(), coreLetters, at(0));
  for (let i = 0; i < 20; i += 1) p = answer(p, { focus: [], correct: true, at: at(1), sessionId: 'd1' });
  for (let i = 0; i < 5; i += 1) p = answer(p, { focus: [], correct: true, word: true, at: at(1), sessionId: 'd1' });
  assert.equal(graduationReady(p, pack), true, '된소리·겹모음을 만나지 않아도 졸업');
  const plan = planSession(graduate(p, at(1)), pack, { now: at(2) });
  assert.ok(plan.warmup && items(plan).length <= SETTINGS.warmup, `몸풀기 ${items(plan).length}`);
  assert.ok(plan.fresh.length >= 1 && plan.fresh.every(id => lateLetters.includes(id)), `졸업 뒤 새 글자 ${plan.fresh}`);
  assert.notEqual(plan.reason.kind, 'warmup', '새 글자를 만나는 날은 그렇게 말한다');
});

test('ㅒ·ㅖ·ㅢ는 문항에서 ㅇ하고만 음절을 만들고, 같은 소리(ㅚ·ㅙ·ㅞ, ㅒ·ㅖ)는 보기와 조각에 함께 나오지 않는다', () => {
  const alone = new Set(pack.letters.filter(l => l.alone).map(l => l.jamo));
  const odd = text => [...text].some(ch => { const d = decompose(ch); return d && d.initial !== pack.SILENT && alone.has(d.medial); });
  let builds = 0;
  const compound = new Set();
  for (const difficulty of [2, 3]) {
    let p = readProgress({ ...meet(emptyProgress(), pack.letters.map(l => l.id), at(0)), difficulty });
    for (let day = 1; day < 25; day += 1) {
      const plan = planSession(p, pack, { now: at(day) });
      for (const i of items(plan)) {
        if (i.word) continue; // 낱말(시계·의사)은 그대로 쓴다
        const texts = i.type === 'match' ? i.cards.map(c => c.voice) : [i.target.text, ...(i.options || []).map(o => o.text)];
        for (const t of texts) assert.ok(!odd(t), `${i.type}: ${texts}`);
        if (i.type === 'build') {
          builds += 1;
          assert.ok(!i.pieces.vowels.some(v => pack.byId.get(v).alone), `조각 ${i.pieces.vowels}`);
          const made = i.pieces.vowels.map(v => pack.syllable(i.target.consonant, v, i.target.final || null));
          for (let a = 0; a < made.length; a += 1) for (let b = a + 1; b < made.length; b += 1) assert.ok(!pack.sameSound(made[a], made[b]), `조각 ${made}`);
        }
        for (const id of i.focus) if (pack.byId.get(id).compound) compound.add(id);
      }
      p = readProgress({ ...play(p, { day }).progress, difficulty });
    }
  }
  assert.ok(builds > 0, '음절 만들기가 나온다');
  assert.ok(compound.size >= 6, `겹모음 문항 ${[...compound]}`);
  assert.ok(pack.sameSound('외', '왜') && pack.sameSound('왜', '웨') && pack.sameSound('얘', '예') && pack.sameSound('계', '게') && !pack.sameSound('의', '이'));
});

test('된소리를 헷갈리면(ㄲ을 ㄱ으로) 다음 회차 첫 문항이 그 짝의 짝 고르기다', () => {
  let p = meet(emptyProgress(), [...coreLetters, 'c-kk'], at(0));
  p = answer(p, { focus: ['c-kk'], correct: false, at: at(0), sessionId: 'd0', confused: [['c-kk', 'c-g']] });
  const plan = planSession(p, pack, { now: at(1) });
  assert.equal(plan.reason.kind, 'pair');
  assert.deepEqual([...plan.reason.letters].sort(), ['ㄱ', 'ㄲ'].sort());
  const first = items(plan)[0];
  assert.equal(first.type, 'pair');
  assert.deepEqual(first.options.map(o => o.letter).sort(), ['c-g', 'c-kk']);
});

test('오답 안내의 조사는 끝 음절의 받침을 따른다 — 각이 아니라 간이에요 · 다가 아니라 나예요, 사람은 · 엄마는', () => {
  // app.mjs 글자 만들기의 「○○이/가 아니라 ○○이에요/예요」와 보고 고르기의 「○○은/는 이 소리예요」
  const wrongBuild = (made, target) => `${made}${josa(made, '이', '가')} 아니라 ${target}${josa(target, '이에요', '예요')}`;
  assert.equal(wrongBuild(pack.syllable('c-g', 'v-a', 'f-g'), pack.syllable('c-g', 'v-a', 'f-n')), '각이 아니라 간이에요');
  assert.equal(wrongBuild(pack.syllable('c-d', 'v-a'), pack.syllable('c-n', 'v-a')), '다가 아니라 나예요');
  assert.equal(wrongBuild(pack.syllable(null, 'v-a', 'f-r'), pack.syllable(null, 'v-a')), '알이 아니라 아예요');
  for (const [word, particle] of [['사람', '은'], ['물', '은'], ['엄마', '는'], ['바나나', '는']]) {
    assert.ok(pack.words.some(w => w.text === word), `${word}: 이 판의 낱말`);
    assert.equal(josa(word, '은', '는'), particle, word);
  }
  // 글자 만나기의 짝 안내는 낱자를 이름으로 읽는다: ㅂ과 ㅍ(피읖)은 짝, ㅏ(아)는
  assert.equal(josa(pack.byId.get('c-p').glyph, '은', '는'), '은');
  assert.equal(josa(pack.byId.get('v-a').glyph, '은', '는'), '는');
});

test('받침 노래: 신호가 겹치지 않고, 칸 글자는 모두 이 판의 글자이며, 결과 음절은 바탕 + 받침이다', () => {
  const song = songById('batchim');
  assert.ok(song && song.cues.length > 30);
  let prev = 0;
  for (const cue of song.cues) {
    assert.ok(cue.t < cue.end && cue.t >= prev - 1e-6, `${cue.text} ${cue.t}~${cue.end}`);
    prev = cue.end;
    for (const m of (Array.isArray(cue.at) ? cue.at : [])) assert.ok(m >= cue.t && m < cue.end, `${cue.text} 표시 ${m}`);
    const n = cue.kind === 'batchim' ? 3 : cue.kind === 'sweep' ? cue.letters.length : 0;
    for (let i = 0; i < n; i += 1) for (const id of tileLetters(cue, i)) assert.ok(pack.byId.has(id), `${cue.text} 칸 ${i}: ${id}`);
    if (cue.kind === 'batchim') {
      const [c, v] = tileLetters(cue, 0);
      const made = c && pack.byId.get(c).role === 'consonant' ? pack.syllable(c, v, cue.final) : pack.syllable(null, c, cue.final);
      assert.equal(made, cue.made, cue.text);
      assert.equal(pack.byId.get(cue.final).unit, 'U6');
    }
    if (cue.kind === 'sweep') cue.texts.forEach((ch, i) => assert.deepEqual(Object.values(pack.lettersIn(ch)).filter(Boolean), tileLetters(cue, i), ch));
  }
  // 회차 끝 장단 구간에 받침 넷이 다 나오고, 1절 첫 줄 「아 은 안」의 세 걸음이 노래 시각에 맞는다
  const met = lettersIn(song, ...song.review);
  for (const f of ['f-n', 'f-r', 'f-m', 'f-ng']) assert.ok(met.has(f), f);
  assert.deepEqual([11.0, 11.3, 11.6].map(t => cueAt(song, t).step), [0, 1, 2]);
  assert.equal(cueAt(song, 11.6).cue.made, '안');
});

test('모음 댄스: 신호가 겹치지 않고, 글자는 노래에서 잰 음절 시각(10-09 목소리)에 차례로 켜진다', () => {
  const song = songById('vowel-dance');
  let prev = 0;
  for (const cue of song.cues) {
    assert.ok(cue.t < cue.end && cue.t >= prev - 1e-6, `${cue.text} ${cue.t}~${cue.end}`);
    prev = cue.end;
    const marks = Array.isArray(cue.at) ? cue.at : cue.at != null ? [cue.at] : [];
    marks.forEach((m, i) => assert.ok(m >= cue.t && m < cue.end && (i === 0 || m > marks[i - 1]), `${cue.text} 표시 ${m}`));
    if (cue.kind === 'sweep') assert.equal(marks.length, cue.letters.length, cue.text);
  }
  // 「차렷 이!」의 「이」는 19.085초(받아쓰기 표는 18.57초), 첫 후렴은 「Hey!」(21.36초) 뒤 「아」(21.67초)부터 켠다
  assert.deepEqual([19.0, 19.1].map(t => cueAt(song, t).step), [-1, 0]);
  assert.deepEqual([21.4, 21.6, 21.7].map(t => cueAt(song, t).cue.kind + cueAt(song, t).step), ['vowel0', 'sweep-1', 'sweep0']);
});
