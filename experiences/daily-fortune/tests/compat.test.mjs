import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompatibility, COMPAT_TEXT } from '../compat.mjs';
import { addDays, branchRelation, BRANCHES } from '../fortune-base.mjs';
import { assertGentle } from './fortune-text.mjs';

const today = '2026-10-14';

// 결정적인 표본: 1940~2020년 사이 날짜·시간·이름을 섞는다.
const sample = Array.from({ length: 40 }, (_, index) => ({
  birthDate: addDays('1940-01-03', index * 733 + (index % 7) * 31),
  birthTime: index % 3 === 0 ? null : `${String((index * 5) % 24).padStart(2, '0')}:${String((index * 13) % 60).padStart(2, '0')}`,
  ...(index % 4 === 0 ? { name: `사람${index}` } : {}),
}));

test('순서를 바꿔도 같은 결과이고 같은 두 사람은 언제나 같은 결과다(오늘 날짜와도 무관)', () => {
  let pairs = 0;
  for (let i = 0; i < sample.length; i++) {
    for (let j = i; j < sample.length; j += 3) {
      const forward = getCompatibility(sample[i], sample[j], { today });
      assert.deepEqual(getCompatibility(sample[j], sample[i], { today }), forward, `${i}-${j}`);
      if (j % 9 === 0) assert.deepEqual(getCompatibility(sample[i], sample[j], { today: '2100-12-31' }), forward);
      pairs++;
    }
  }
  assert.ok(pairs > 200);
});

test('결과 형식: 전체 2~5, 대화·생활 속도·마음 챙김 세 칸, 한 줄 제목·조언·근거 세 줄', () => {
  const levels = new Set();
  for (let i = 0; i < sample.length; i++) {
    const result = getCompatibility(sample[i], sample[(i * 7 + 3) % sample.length], { today });
    assert.ok(Number.isInteger(result.overall) && result.overall >= 2 && result.overall <= 5);
    assert.deepEqual(result.aspects.map(item => item.id), ['talk', 'pace', 'care']);
    assert.deepEqual(result.aspects.map(item => item.title), ['대화', '생활 속도', '마음 챙김']);
    for (const aspect of result.aspects) {
      assert.ok(Number.isInteger(aspect.level) && aspect.level >= 2 && aspect.level <= 5);
      assert.ok(aspect.text.length > 10);
    }
    assert.ok(COMPAT_TEXT.headlines[result.overall].includes(result.headline));
    assert.ok(result.tip.length > 10);
    assert.equal(result.basis.length, 3);
    assert.match(result.basis[0], /^일간 · /);
    assert.match(result.basis[1], /^띠 · /);
    assert.match(result.basis[2], /^별자리 · /);
    assert.equal(Object.isFrozen(result.aspects[0]), true);
    levels.add(result.overall);
  }
  assert.ok(levels.size >= 3, '표본에서 여러 결이 나온다');
});

test('일간 상생상극을 근거로 적는다', () => {
  // 1990-05-17 임수(壬), 1990-05-14 기토(己): 토가 수를 다듬는 상극. 1990-05-19 갑목(甲): 수가 목을 키우는 상생.
  const control = getCompatibility({ birthDate: '1990-05-17' }, { birthDate: '1990-05-14' }, { today });
  assert.equal(control.relations.dayMaster, 'control');
  assert.match(control.basis[0], /토가 수를 다듬어 주는 사이라 서로 좋은 자극이 돼요\.$/);
  const generate = getCompatibility({ birthDate: '1990-05-17', name: '민지' }, { birthDate: '1990-05-19', name: '서준' }, { today });
  assert.equal(generate.relations.dayMaster, 'generate');
  assert.match(generate.basis[0], /민지 임수\(큰 바다\).*서준 갑목\(큰 나무\).*수가 목을 키워 주는 상생이에요\.$/);
  const same = getCompatibility({ birthDate: '1990-05-17' }, { birthDate: '1990-05-18' }, { today });
  assert.equal(same.relations.dayMaster, 'same');
});

test('띠는 입춘 기준 연지의 삼합·육합·충·원진을 부드럽게 읽고, 띠를 못 정하면 빼고 본다', () => {
  assert.equal(branchRelation(BRANCHES[2], BRANCHES[6]), 'threeHarmony');
  assert.equal(branchRelation(BRANCHES[0], BRANCHES[1]), 'sixHarmony');
  assert.equal(branchRelation(BRANCHES[0], BRANCHES[6]), 'clash');
  assert.equal(branchRelation(BRANCHES[0], BRANCHES[7]), 'wonjin');
  assert.equal(branchRelation(BRANCHES[3], BRANCHES[3]), 'same');
  const cases = [
    ['1998-06-10', '2002-06-10', 'threeHarmony', /호랑이띠 .* 말띠 — 인오술 삼합이라 함께 움직이기 좋아요\.$/],
    ['1996-06-10', '1997-06-10', 'sixHarmony', /쥐띠 .* 소띠 — 자축 육합이라 서로 잘 어울려요\.$/],
    ['1996-06-10', '2002-06-10', 'clash', /마주 보는 띠라 속도가 다를 수 있어요\. 서로의 속도를 존중하면/],
    ['1996-06-10', '2003-06-10', 'wonjin', /서운한 일은 그때그때 말로 확인하면 좋아요\.$/],
    ['1990-06-10', '2002-06-10', 'same', /같은 띠라 생활 리듬이 비슷해요\.$/],
    ['1996-06-10', '1998-06-10', 'none', /쥐띠 .* 호랑이띠 — 특별한 합이나 충이 없는 무난한 사이예요\.$/],
    // 1998-02-03은 입춘 전이라 앞해 정축(소띠)이다. 소·뱀은 사유축 삼합.
    ['1998-02-03', '2001-06-10', 'threeHarmony', /소띠 .* 뱀띠 — 사유축 삼합이라/],
    ['2024-02-04', '2002-06-10', 'unknown', /^띠 · 입춘 무렵에 태어나 띠를 정하지 못한 사람이 있어/],
  ];
  for (const [first, second, relation, pattern] of cases) {
    const result = getCompatibility({ birthDate: first, birthTime: null }, { birthDate: second, birthTime: null }, { today });
    assert.equal(result.relations.animal, relation, `${first}·${second}`);
    assert.match(result.basis[1], pattern);
  }
  // 1998-02-03(입춘 전)은 앞해 축(소)띠, 시간을 알면 입춘 당일 띠도 정한다.
  assert.equal(getCompatibility({ birthDate: '2024-02-04', birthTime: '17:28' }, { birthDate: '2002-06-10' }, { today }).relations.animal, 'none');
});

test('별자리 원소는 같은 원소·보완·무난·다름으로 나누고 경계일을 알려 준다', () => {
  const pick = (a, b) => getCompatibility({ birthDate: a }, { birthDate: b }, { today });
  assert.equal(pick('1990-04-01', '1991-08-01').relations.zodiac, 'same'); // 양자리·사자자리 불
  assert.equal(pick('1990-04-01', '1991-06-01').relations.zodiac, 'complement'); // 불·바람
  assert.equal(pick('1990-04-01', '1991-05-01').relations.zodiac, 'neutral'); // 불·흙
  assert.equal(pick('1990-04-01', '1991-07-01').relations.zodiac, 'challenging'); // 불·물
  assert.match(pick('1990-03-21', '1991-07-01').basis[2], /경계일 생일은 이웃 별자리일 수도 있어요/);
});

test('비극적·단정적 결론 없이 금지어를 쓰지 않는다', () => {
  assertGentle(COMPAT_TEXT, '궁합 문장');
  for (let i = 0; i < sample.length; i++) {
    for (let j = 0; j < sample.length; j += 5) assertGentle(getCompatibility(sample[i], sample[j], { today }), `${i}-${j}`);
  }
  assert.doesNotMatch(JSON.stringify(COMPAT_TEXT), /안 맞|나쁜 궁합|헤어|끝내|포기/);
});

test('잘못된 입력을 거부한다', () => {
  assert.throws(() => getCompatibility(null, { birthDate: '1990-01-01' }, { today }), TypeError);
  assert.throws(() => getCompatibility({ birthDate: '1990-01-01' }, { birthDate: '2026-10-15' }, { today }), RangeError);
  assert.throws(() => getCompatibility({ birthDate: '1990-02-30' }, { birthDate: '1990-01-01' }, { today }), TypeError);
  assert.throws(() => getCompatibility({ birthDate: '1990-01-01', birthTime: '25:00' }, { birthDate: '1990-01-01' }, { today }), TypeError);
  for (const name of ['', '   ', '가'.repeat(21), '줄\n바꿈', 12]) {
    assert.throws(() => getCompatibility({ birthDate: '1990-01-01', name }, { birthDate: '1991-01-01' }, { today }), TypeError, String(name));
  }
  assert.equal(getCompatibility({ birthDate: '1990-01-01', name: ' 민지 ' }, { birthDate: '1991-01-01' }, { today }).people.find(item => item.name).name, '민지');
});
