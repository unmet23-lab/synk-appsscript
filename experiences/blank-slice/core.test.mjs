import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, PRACTICE, SKILL_LABEL } from './content.mjs';
import { parts, filled, judge, readBlank, rng, shuffled, composeRound, pointsFor, scoreRound, hangTime, readDelay, tossLayout, segmentEntry, validateItems } from './core.mjs';
import { josa } from './kit/josa.mjs';

test('원고: 36문장 모두 검사 통과(빈칸 하나·보기 넷·정답 첫 보기·학습 항목·난도·설명), 연습 문장도', () => {
  assert.deepEqual(validateItems(ITEMS), []);
  assert.deepEqual(validateItems([PRACTICE]), []);
  assert.equal(ITEMS.length, 36);
  const n = (skill) => ITEMS.filter((x) => x.skill === skill).length;
  assert.ok(n('ko.reading.vocabulary') >= 12 && n('ko.reading.grammar') >= 12, '두 항목 모두 한 판 이상');
  assert.ok(ITEMS.some((x) => x.difficulty === 2) && ITEMS.filter((x) => x.difficulty === 1).length >= 12, '처음 한 판은 난도 1로 채울 수 있다');
});

test('빈칸 뒤 조사가 붙은 문장은 보기가 모두 같은 받침 조건이다(모양으로 답이 드러나지 않게)', () => {
  const hasBatchim = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
  for (const x of [...ITEMS, PRACTICE]) {
    const after = parts(x.text)[1];
    if (/^(을|은|이)(?![가-힣])/.test(after) || /^(을|은|이) /.test(after)) assert.ok(x.options.every(hasBatchim), `${x.id}: ‘${after.slice(0, 2)}’ 앞 보기는 모두 받침`);
    if (/^(를|는|가)[ .]/.test(after)) assert.ok(x.options.every((w) => !hasBatchim(w)), `${x.id}: ‘${after.slice(0, 2)}’ 앞 보기는 모두 받침 없음`);
  }
});

test('연습 안내의 조사는 낱말의 받침을 따른다 — 정답은 우유예요, ‘의자’는 · ‘병원’은', () => {
  // app.mjs 연습 문장 알림의 「정답은 N번 ○○이에요/예요」와 틀린 조각의 「‘○○’은/는 빈칸에 맞지 않아요」
  assert.equal(`${PRACTICE.answer}${josa(PRACTICE.answer, '이에요', '예요')}`, '우유예요');
  for (const w of PRACTICE.options) assert.equal(josa(w, '은', '는'), '는', w);
  const words = new Set(ITEMS.flatMap((x) => x.options));
  for (const [w, topic, copula] of [['병원', '은', '이에요'], ['물', '은', '이에요'], ['개', '는', '예요'], ['먹어요', '는', '예요']]) {
    assert.ok(words.has(w), `${w}: 원고의 보기`);
    assert.equal(josa(w, '은', '는'), topic, w);
    assert.equal(josa(w, '이에요', '예요'), copula, w);
  }
});

test('화면 읽기 문장은 빈칸을 ‘빈칸’으로 읽고 뒤 조사도 맞춘다 — 빈칸을 마셔요(빈칸를 아님)', () => {
  assert.equal(readBlank(PRACTICE.text), '저는 매일 아침에 빈칸을 마셔요.');
  assert.equal(readBlank('목이 말라요. {}을 마시고 싶어요.'), '목이 말라요. 빈칸을 마시고 싶어요.');
  assert.equal(readBlank('{}가 있어요.'), '빈칸이 있어요.');
  assert.equal(readBlank('{}로 가요.'), '빈칸으로 가요.');
  assert.equal(readBlank('학교{} 친구를 만나요.'), '학교빈칸 친구를 만나요.');
  assert.equal(readBlank('{}에서 편지를 보내요.'), '빈칸에서 편지를 보내요.');
  for (const x of [...ITEMS, PRACTICE]) assert.doesNotMatch(readBlank(x.text), /빈칸(를|가|는|와|로)(?![가-힣])/, x.id);
});

test('빈칸 나누기·채우기·판정', () => {
  const x = ITEMS.find((i) => i.id === 'v01');
  assert.deepEqual(parts(x.text), ['목이 말라요. ', '을 마시고 싶어요.']);
  assert.equal(filled(x, '물'), '목이 말라요. 물을 마시고 싶어요.');
  assert.equal(judge(x, '물').correct, true);
  assert.equal(judge(x, '빵').correct, false);
});

test('한 판 구성: 12문장, 두 항목 4문장 이상, 처음엔 난도 1만, 쉬운 것부터', () => {
  const first = composeRound(ITEMS, { firstTime: true });
  assert.equal(first.length, 12);
  assert.ok(first.every((x) => x.difficulty === 1), '처음은 난도 1');
  for (const s of Object.keys(SKILL_LABEL)) assert.ok(first.filter((x) => x.skill === s).length >= 4, s);
  // 아틀라스가 어려운 문법 문장을 앞에 두면 그 문장들이 판에 들어오고, 그래도 쉬운 것부터 놓인다
  const hard = ITEMS.filter((x) => x.difficulty === 2 && x.skill === 'ko.reading.grammar').map((x) => x.id);
  const round = composeRound(ITEMS, { ranked: hard });
  for (const id of hard) assert.ok(round.some((x) => x.id === id), `${id}가 들어온다`);
  for (const s of Object.keys(SKILL_LABEL)) assert.ok(round.filter((x) => x.skill === s).length >= 4, `${s} 4문장 이상`);
  const diffs = round.map((x) => x.difficulty);
  assert.deepEqual(diffs, [...diffs].sort((a, b) => a - b), '쉬운 것부터');
  assert.equal(new Set(round.map((x) => x.id)).size, 12, '겹치지 않는다');
});

test('아틀라스 순서가 없으면 판 번호로 섞어 판마다 다른 문장이 나온다(규칙은 그대로)', () => {
  const rounds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => composeRound(ITEMS, { seed }));
  for (const r of rounds) {
    assert.equal(r.length, 12);
    for (const s of Object.keys(SKILL_LABEL)) assert.ok(r.filter((x) => x.skill === s).length >= 4, s);
    const d = r.map((x) => x.difficulty); assert.deepEqual(d, [...d].sort((a, b) => a - b), '쉬운 것부터');
  }
  assert.ok(new Set(rounds.map((r) => r.map((x) => x.id).join())).size >= 6, '판마다 다르다');
  const seen = new Set(rounds.flat().map((x) => x.id));
  assert.ok(seen.size >= 30, `여덟 판이면 36문장 중 ${seen.size}개가 나온다`);
  assert.ok(rounds.flat().some((x) => x.difficulty === 2), '난도 2도 나온다');
  assert.deepEqual(composeRound(ITEMS, { seed: 3 }), composeRound(ITEMS, { seed: 3 }), '같은 판 번호는 같은 판');
  assert.deepEqual(composeRound(ITEMS, { firstTime: true, seed: 5 }), composeRound(ITEMS, { firstTime: true }), '처음 판은 섞지 않는다');
});

test('점수·별·연속·놓침', () => {
  assert.equal(pointsFor(1), 100); assert.equal(pointsFor(3), 140); assert.equal(pointsFor(20), 200);
  const r = (correct, skill = 'ko.reading.grammar') => ({ itemId: 'x', skill, choice: correct === null ? null : 'w', correct, points: correct ? 100 : 0 });
  const all = Array.from({ length: 12 }, () => r(true));
  assert.equal(scoreRound(all).stars, 3);
  const two = [...all.slice(0, 10), r(false), r(null)];
  const s2 = scoreRound(two);
  assert.equal(s2.stars, 2); assert.equal(s2.correct, 10); assert.equal(s2.missed, 1); assert.equal(s2.bestRun, 10);
  assert.equal(scoreRound([...all.slice(0, 6), ...Array(6).fill(0).map(() => r(false))]).stars, 1);
  assert.equal(scoreRound([...all.slice(0, 5), ...Array(7).fill(0).map(() => r(false))]).stars, 0);
});

test('속도: 연속으로 맞히면 빨라지되 2.6초 아래로는 안 간다, 천천히 모드는 1.4배', () => {
  assert.ok(hangTime({ combo: 3 }) < hangTime({ combo: 0 }));
  assert.equal(hangTime({ combo: 99 }), 2.88);
  assert.ok(hangTime({ difficulty: 2, combo: 99 }) >= 2.6);
  assert.equal(hangTime({ slow: true }), Math.round(3.6 * 1.4 * 100) / 100);
  assert.ok(readDelay('{}') >= 700 && readDelay('가'.repeat(80)) === 2600);
});

test('배치: 좁은 화면은 같은 열의 두 조각을 같은 순간에 던지고 꼭대기 높이만 다르다', () => {
  const narrow = tossLayout(0.5);
  for (const x of [-0.5, 0.5]) {
    const col = narrow.filter((p) => p.x === x);
    assert.equal(col.length, 2);
    assert.equal(col[0].delay, col[1].delay, '같은 순간');
    assert.ok(Math.abs(col[0].apex - col[1].apex) >= 0.4, '위아래로 떨어진 꼭대기');
  }
  const wide = tossLayout(1.6);
  assert.equal(new Set(wide.map((p) => p.x)).size, 4, '넓은 화면은 4열');
});

test('베기 판정: 그은 선이 처음 닿는 조각만', () => {
  const r = { l: 100, r: 200, t: 100, b: 150 };
  assert.equal(segmentEntry({ x: 50, y: 125 }, { x: 250, y: 125 }, r), 0.25);
  assert.equal(segmentEntry({ x: 50, y: 50 }, { x: 250, y: 60 }, r), null);
  assert.equal(segmentEntry({ x: 150, y: 120 }, { x: 160, y: 130 }, r), 0, '안에서 시작해도 벤다');
  const near = segmentEntry({ x: 0, y: 125 }, { x: 400, y: 125 }, r), far = segmentEntry({ x: 0, y: 125 }, { x: 400, y: 125 }, { l: 300, r: 350, t: 100, b: 150 });
  assert.ok(near < far, '먼저 닿는 쪽이 작다');
});

test('보기 섞기는 넷을 그대로 두고 순서만 바꾼다', () => {
  const a = shuffled(['을', '에', '이', '과'], rng(7));
  assert.deepEqual([...a].sort(), ['과', '에', '을', '이']);
});
