// 꿈 무대 4급 시험판(experiences/drama/qa/꿈무대4급시험_20261121)의 판정 · 코치 노트 고르기 · 놓친 곳(3일 뒤 다시 만나기).
import test from 'node:test';
import assert from 'node:assert/strict';
import { 판정, 노트고르기, 놓친곳, learningDate } from '../experiences/drama/qa/꿈무대4급시험_20261121/판정.mjs';
import { 차례, 나줄, 문형, 규칙글, 빠짐글, 메시지, 다른자리 } from '../experiences/drama/qa/꿈무대4급시험_20261121/대본.mjs';
import fs from 'node:fs';

const 줄 = (id) => 나줄.find((x) => x.id === id);
const 들림글 = (들림, r) => 들림.replace(/\s+/g, ' ').trim().slice(...r.위치);

test('대답 3(-는 바람에): 지난 꼴을 붙이면 그 곳을 짚고, 맞는 꼴과 다른 낱말의 맞는 꼴은 통과', () => {
  const d3 = 줄('d3');
  let 들림 = '처음엔 지하철을 잘못 탄 바람에 수업에 자주 늦었어요.';
  let r = 판정(d3, 들림);
  assert.equal(r.결과, 'note'); assert.equal(r.갈래, 'form'); assert.equal(r.규칙, 'adnominal');
  assert.equal(r.보일, '탄 바람에'); assert.equal(r.바른, '타는 바람에'); assert.equal(들림글(들림, r), '탄 바람에');
  들림 = '처음엔 지하철을 잘못 탓는 바람에 수업에 자주 늦었어요.';
  r = 판정(d3, 들림);
  assert.equal(r.규칙, 'tense'); assert.equal(r.보일, '탔는 바람에'); assert.equal(들림글(들림, r), '탓는 바람에');
  assert.equal(판정(d3, '처음엔 지하철을 잘 못 타는 바람에 수업에 자주 늦었어요.').결과, 'pass');
  assert.equal(판정(d3, '처음엔 지하철을 잘못타는바람에 수업에 늦었어요').결과, 'pass');
  assert.equal(판정(d3, '처음엔 길을 잃는 바람에 늦었어요.').결과, 'pass');
  r = 판정(d3, '처음엔 길을 잃었는 바람에 늦었어요.');
  assert.deepEqual([r.결과, r.규칙, r.보일, r.바른], ['note', 'tense', '잃었는 바람에', null]);
  r = 판정(d3, '처음엔 길을 잃은 바람에 늦었어요.');
  assert.deepEqual([r.결과, r.규칙, r.보일], ['note', 'adnominal', '잃은 바람에']);
  r = 판정(d3, '처음엔 지하철을 잘 못 타서 수업에 자주 늦었어요.');
  assert.deepEqual([r.결과, r.갈래], ['note', 'missing']);
});

test('다른 줄의 틀린 곳: ㄹ 받침 -수록, -느라고 앞 지난 꼴, 끝난 대로', () => {
  let r = 판정(줄('d2'), '아직 잘 모르지만 알면 알을 수록 재미있어요.');
  assert.deepEqual([r.결과, r.규칙, r.보일, r.바른], ['note', 'rieul', '알을수록', '알수록']);
  assert.equal(판정(줄('d2'), '아직 잘 모르지만, 알면 알수록 재미있어요.').결과, 'pass');
  r = 판정(줄('d5'), '아니 아직. 대사 외웠느라고 못 먹었어.');
  assert.deepEqual([r.결과, r.규칙, r.바른], ['note', 'tense', '외우느라고']);
  r = 판정(줄('d5'), '아니 아직. 숙제했느라고 못 먹었어.');
  assert.deepEqual([r.결과, r.규칙, r.보일], ['note', 'tense', '숙제했느라고']);
  assert.equal(판정(줄('d5'), '아니, 아직. 대사 외우느라고 못 먹었어.').결과, 'pass');
  r = 판정(줄('d6'), '좋아! 촬영 끝난 대로 떡볶이 먹으러 가자.');
  assert.deepEqual([r.결과, r.규칙, r.바른], ['note', 'soon', '끝나는 대로']);
  assert.equal(판정(줄('d6'), '좋아. 촬영 끝나는 대로 떡볶이 먹으러 가자.').결과, 'pass');
  assert.equal(판정(줄('d7'), '힘들더라도 배우가 꼭 되고 싶어서 왔어.').결과, 'pass');
  assert.equal(판정(줄('d7'), '힘들어도 배우가 꼭 되고 싶어서 왔어.').갈래, 'missing');
  assert.equal(판정(줄('d1'), '네, 막상 올라오고 보니 서울이 한눈에 보이네요.').결과, 'pass');
});

test('판정 보류와 판정 없는 줄', () => {
  assert.equal(판정(줄('d3'), '').결과, 'hold');
  assert.equal(판정(줄('d3'), 'Thank you.').결과, 'hold');
  assert.equal(판정(줄('d4'), '응 좋아').결과, 'free');
});

test('코치 노트는 하나: 틀린 곳이 빠진 문형보다, 장면의 핵심 줄이 다른 줄보다 먼저', () => {
  const 후보 = [
    { 줄: 줄('d7'), 판정: 판정(줄('d7'), '힘들어도 배우가 되고 싶어서 왔어.') },
    { 줄: 줄('d2'), 판정: 판정(줄('d2'), '알면 알을수록 재밌어요') },
    { 줄: 줄('d3'), 판정: 판정(줄('d3'), '잘못 탄 바람에 늦었어요') },
    { 줄: 줄('d1'), 판정: 판정(줄('d1'), '네 서울이 보이네요') },
  ];
  assert.equal(노트고르기(후보).줄.id, 'd3');
  assert.equal(노트고르기(후보.filter((x) => x.줄.id !== 'd3')).줄.id, 'd2');
  assert.equal(노트고르기([후보[0], 후보[3]]).줄.id, 'd1');
  assert.equal(노트고르기([{ 줄: 줄('d1'), 판정: { 결과: 'pass' } }]), null);
});

test('놓친 곳: 3일 뒤 다시 만나고, 대본 없이 맞히면 닫힌다(테이크 2 · 3일 전 통과는 날을 바꾸지 않는다)', () => {
  const t0 = new Date(2026, 10, 21, 19, 0).getTime();
  const 날 = (n, 시 = 19) => new Date(2026, 10, 21 + n, 시, 0).getTime();
  const 기록 = [
    { 줄: 'd3', 판: 'scene', 보임: 's1', 결과: 'note', 갈래: 'form', 보일: '탄 바람에', 시각: t0 },
    { 줄: 'd1', 판: 'scene', 보임: 's1', 결과: 'pass', 시각: t0 },
    { 줄: 'd3', 판: 'take2', 보임: 't1', 결과: 'pass', 시각: t0 + 60000 },
  ];
  let [x] = 놓친곳(기록, { 지금: 날(0, 20) });
  assert.equal(x.줄, 'd3'); assert.equal(x.열림, true); assert.equal(x.때됨, false); assert.equal(x.고침, false);
  assert.equal(x.다시날.getDate(), 24);
  [x] = 놓친곳(기록, { 지금: 날(3, 9) });
  assert.equal(x.때됨, true); assert.equal(x.지난날, 3);
  // 3일째 전의 다시 만나기 통과는 고침 표시만
  [x] = 놓친곳([...기록, { 줄: 'd3', 판: 'review', 보임: 'r0', 결과: 'pass', 시각: 날(1) }], { 지금: 날(1, 20) });
  assert.equal(x.열림, true); assert.equal(x.고침, true); assert.equal(x.다시날.getDate(), 24);
  // 3일째 대본을 보고 맞히면 고침만, 안 보고 맞히면 닫힘
  [x] = 놓친곳([...기록, { 줄: 'd3', 판: 'review', 보임: 'r1', 결과: 'pass', 봄: true, 시각: 날(3, 9) }], { 지금: 날(3, 10) });
  assert.equal(x.열림, true); assert.equal(x.고침, true);
  [x] = 놓친곳([...기록, { 줄: 'd3', 판: 'review', 보임: 'r1', 결과: 'pass', 봄: false, 시각: 날(3, 9) }], { 지금: 날(3, 10) });
  assert.equal(x.열림, false); assert.ok(x.닫음);
  // 3일째에 또 틀리면 그날부터 다시 3일
  [x] = 놓친곳([...기록, { 줄: 'd3', 판: 'review', 보임: 'r1', 결과: 'note', 시각: 날(3, 9) }], { 지금: 날(3, 10) });
  assert.equal(x.열림, true); assert.equal(x.다시날.getDate(), 27);
  // 보임마다 첫 판정만 센다
  [x] = 놓친곳([...기록, { 줄: 'd3', 판: 'review', 보임: 'r1', 결과: 'note', 시각: 날(3, 9) }, { 줄: 'd3', 판: 'review', 보임: 'r1', 결과: 'pass', 시각: 날(3, 9) + 1000 }], { 지금: 날(3, 10) });
  assert.equal(x.열림, true);
  // 새벽 4시 전은 전날로 센다(앱과 같은 자)
  assert.equal(learningDate(new Date(2026, 10, 24, 3, 0).getTime()).getDate(), 23);
});

test('대본 · 글: 문형 번호는 국립국어원 목록의 급과 같고, 코치 노트 글이 한 · 몽 짝으로 있다', () => {
  const g = JSON.parse(fs.readFileSync(new URL('../strata/topik-ii.grammar.json', import.meta.url), 'utf8'));
  const 목록 = new Map(g.points.map((p) => [p[0], p]));
  for (const [id, p] of Object.entries(문형)) {
    const 원 = 목록.get(id);
    assert.ok(원, `${id} 없음`); assert.equal(원[3], p.급, `${id} 급`);
  }
  for (const x of 나줄) {
    if (!x.문형) continue;
    assert.ok(x.대본.includes(x.짚을), `${x.id} 짚을 글자가 대본에 없다`);
    assert.equal(판정(x, x.대본).결과, 'pass', `${x.id} 대본 그대로 말하면 통과해야 한다`);
    assert.ok(x.mn && 문형[x.문형].쓰임.mn && 문형[x.문형].쓰임.ko);
    assert.ok(빠짐글.mn(문형[x.문형]).includes(문형[x.문형].꼴));
    for (const t of x.판정.틀린꼴 || []) {
      assert.ok(규칙글[t.규칙]?.[x.문형], `${x.id} ${t.규칙} 규칙 글 없음`);
      assert.ok(x.대본.includes(t.바른), `${x.id} 바른 꼴 「${t.바른}」이 대본에 없다`);
    }
    for (const g of x.판정.일반 || []) assert.ok(규칙글[g]?.[x.문형], `${x.id} 일반 규칙 ${g} 글 없음`);
  }
  for (const 칸 of 차례.filter((x) => x.종류 !== '나' && x.말)) assert.ok(칸.mn, `${칸.클립} 몽골어 뜻 없음`);
  for (const id of 메시지.문형) assert.ok(문형[id]);
  const 은행 = JSON.parse(fs.readFileSync(new URL('../experiences/topik-items/items/tii-g4-a.json', import.meta.url), 'utf8'));
  const 문항들 = Array.isArray(은행) ? 은행 : 은행.items;
  for (const [p, id] of Object.entries(다른자리)) {
    const 문 = 문항들.find((x) => x.id === id);
    assert.ok(문 && 문.reviewStatus === 'ai-reviewed', `${id} 검수 통과 문항이 아니다`);
    assert.ok(문.choices[문.answer].includes('바람에') && p === 'S454');
  }
});
