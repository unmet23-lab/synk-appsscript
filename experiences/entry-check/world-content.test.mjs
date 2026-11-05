import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VENUES, CAST } from './content.mjs';
import { TUTORIAL } from './narration.mjs';
import { RULE_GRAMMAR } from './learning.mjs';
import { judge } from './core.mjs';
import { WORLD_CAST, applyWorld, worldDate, worldGuestImage, MOODS, AGE, BORN, SNEAKY, RULE_KEYS, EXPRESSIONS } from './world-content.mjs';

// 캠퍼스 판(WORLD 안) 원고 겉: 화면 글만 바뀌고 문항의 뜻 · 정답 · 목소리 대사는 그대로인지 본다.
// applyWorld는 같은 모듈 객체를 고친다 — node --test는 파일마다 따로 돌아 다른 시험 파일의 LAB 원고에는 닿지 않는다.
const require = createRequire(import.meta.url);
const { grammarIn } = require('../../strata/topik-i-forms.js');
const lab = structuredClone({ VENUES, CAST, TUTORIAL });
applyWorld({ VENUES, CAST, TUTORIAL });
const pairs = VENUES.flatMap((v, i) => v.cases.map((c, j) => [v, c, lab.VENUES[i].cases[j]]));

test('캠퍼스 판: 정답 · 근거 · 짐 · 시각 · 학습 항목 · 단계 · 확인용 표시는 LAB 원고와 같다', () => {
  for (const [, c, l] of pairs) {
    for (const k of ['id', 'who', 'at', 'items', 'answer', 'skill', 'difficulty', 'look', 'evidence', 'followupOnly', 'textOnly']) assert.deepEqual(c[k], l[k], `${c.id}.${k}`);
    assert.equal(!!c.doc, !!l.doc, `${c.id} 서류 유무`);
    if (c.doc) {
      assert.equal(c.doc.kind, l.doc.kind, `${c.id} 서류 종류`);
      assert.deepEqual(c.doc.rows.map(([k]) => k), l.doc.rows.map(([k]) => k), `${c.id} 서류 칸`);
      // 나이 · 구분 · 표 · 카드 번호는 그대로, 이름과 날짜만 바뀐다
      for (const [i, [k, val]] of c.doc.rows.entries()) {
        if (['이름', '날짜'].includes(k)) continue;
        const age = AGE[c.who], born = BORN[c.who], lab = l.doc.rows[i][1];
        const moved = age ? lab.split(`${age[0]}살`).join(`${age[1]}살`) : lab;
        assert.equal(val, born ? moved.split(born[0]).join(born[1]) : moved, `${c.id} ${k}`);
      }
    }
  }
});

test('캠퍼스 판: 목소리로 구운 손님 대사(line · reply)는 한 글자도 바뀌지 않는다', () => {
  for (const [, c, l] of pairs) if (!c.textOnly) { assert.equal(c.line, l.line, c.id); assert.equal(c.reply, l.reply, c.id); }
});

test('캠퍼스 판: 규칙 문장은 날짜만 옮기고 Strata 문형 · 판정은 그대로다', () => {
  for (const [i, v] of VENUES.entries()) {
    const rules = [...v.notice.rules, ...(v.memo ? [v.memo.rule] : [])], labRules = [...lab.VENUES[i].notice.rules, ...(lab.VENUES[i].memo ? [lab.VENUES[i].memo.rule] : [])];
    for (const [j, r] of rules.entries()) {
      assert.equal(r.text, worldDate(labRules[j].text), `${v.id}.${r.id}: 날짜 말고 바뀐 곳이 없다`);
      assert.deepEqual(grammarIn(r.text), RULE_GRAMMAR[`${v.id}.${r.id}`], `${v.id}.${r.id} 문형`);
    }
    for (const c of v.cases) {
      const l = lab.VENUES[i].cases.find((x) => x.id === c.id);
      for (const choice of ['pass', ...rules.map((r) => r.id)]) assert.deepEqual(judge(c, choice), judge(l, choice), `${c.id} ${choice}`);
    }
  }
});

test('캠퍼스 판: 날짜는 요일이 같은 5월 축제 주간으로 옮기고 간격을 지킨다', () => {
  const dow = (s) => { const [, m, d] = /(\d+)월 (\d+)일/.exec(s); return new Date(Date.UTC(2026, m - 1, d)).getUTCDay(); };
  const W = ['일', '월', '화', '수', '목', '금', '토'];
  for (const v of VENUES) {
    assert.match(v.date, /^5월 \d+일 .요일$/, v.id);
    assert.equal(W[dow(v.date)] + '요일', v.date.split(' ')[2], `${v.id} 요일`);
    for (const c of v.cases) for (const [k, val] of c.doc?.rows || []) if (k === '날짜' && /요일/.test(val)) assert.equal(W[dow(val)] + '요일', val.split(' ')[2], `${c.id} 표 요일`);
  }
  assert.equal(worldDate('8월 10일(일) · 9일 표 · 16일 · 2일'), '5월 17일(일) · 16일 표 · 23일 · 9일');
  assert.throws(() => worldDate('8월 20일'), /날짜 표에 없는 날/);
});

test('캠퍼스 판: 옛 이름 · 동물 말 · 옛 근무지 이름이 화면 글에 남지 않는다', () => {
  const text = JSON.stringify([VENUES, TUTORIAL.map((t) => t.text)]);
  for (const word of ['보리', '구리', '토순', '우진', '도치', '콩이', '오순 씨', '솜이', '수달수', '오리', '날개', '8월', '하늘 수영장', '별빛', '바람 미술관', '노을', '공원 관리실'])
    assert.ok(!text.includes(word), `남은 말: ${word}`);
});

test('캠퍼스 판: 손님은 원고 손님 열둘과 하나씩 짝이고 사진 · 이름 · 부르는 말이 있다', () => {
  assert.deepEqual(Object.keys(WORLD_CAST).sort(), Object.keys(lab.CAST).sort());
  for (const [key, c] of Object.entries(CAST)) {
    assert.equal(c.name, WORLD_CAST[key].name, key);
    assert.equal(c.img, worldGuestImage(key), key);
    assert.ok(c.call && c.label, key);
    assert.equal(c.age, AGE[key]?.[1] ?? lab.CAST[key].age, `${key} 나이`);
  }
  assert.deepEqual(MOODS, ['talk', 'idle', 'nervous', 'pass', 'sly', 'sorry', 'puzzled']);
  assert.equal(worldGuestImage('bear', 'nope'), 'assets/world/guests/bear-talk.webp');
  // 다른 사람의 카드(library-07): 카드의 이름과 손님 이름이 달라야 그 문항이 선다
  const l07 = pairs.find(([, c]) => c.id === 'library-07')[1];
  assert.notEqual(l07.doc.rows[0][1], CAST[l07.who].name);
});

test('캠퍼스 판: 옮긴 나이는 규칙의 나이 경계(7 · 13 · 65살)를 넘지 않고 어른 표 그대로다', () => {
  for (const [who, [from, to]] of Object.entries(AGE)) {
    for (const edge of [7, 13, 65]) assert.equal(from <= edge, to <= edge, `${who}: ${from} → ${to}이 ${edge}살 경계를 넘는다`);
    for (const [, c] of pairs) if (c.who === who) assert.ok(!(c.evidence.includes('kid') || c.evidence.includes('fee')) || c.answer !== 'fee', c.id);
  }
  const ages = Object.values(CAST).map((c) => c.age).sort((a, b) => a - b);
  assert.deepEqual(ages.filter((a) => a >= 20 && a < 30).length, 2, '20대는 둘');
  for (const [from, to] of [[0, 9], [10, 19], [20, 29], [30, 39], [40, 49], [60, 69], [70, 79]]) assert.ok(ages.some((a) => a >= from && a <= to), `${from}대 손님이 있다`);
});

test('캠퍼스 판 2판: 형광펜 낱말은 규칙 문장에 글자 그대로 있고, 규칙마다 표현 카드가 있다', () => {
  for (const v of VENUES) for (const r of [...v.notice.rules, ...(v.memo ? [v.memo.rule] : [])]) {
    const key = `${v.id}.${r.id}`;
    assert.ok(RULE_KEYS[key]?.length, `${key} 형광펜 낱말`);
    for (const phrase of RULE_KEYS[key]) assert.ok(r.text.includes(phrase), `${key}: 「${phrase}」가 「${r.text}」에 없다`);
    const e = EXPRESSIONS[key];
    assert.ok(e?.form && e.quote && e.plain, `${key} 표현 카드`);
  }
  assert.equal(Object.keys(RULE_KEYS).length, Object.keys(RULE_GRAMMAR).length);
  assert.deepEqual(Object.keys(EXPRESSIONS).sort(), Object.keys(RULE_KEYS).sort());
});

test('캠퍼스 판: 해설에 적은 손님 나이는 그 손님의 표와 같다(규칙의 나이 경계는 빼고)', () => {
  for (const [, c] of pairs) {
    const age = CAST[c.who].age, cited = [...(c.why || '').matchAll(/(\d+)살/g)].map((m) => Number(m[1])).filter((a) => ![7, 13, 65].includes(a));
    // 아이와 함께 온 손님의 해설에는 아이 나이가 나온다(그 표에 적혀 있다)
    const onDoc = (c.doc?.rows || []).flatMap(([, v]) => [...String(v).matchAll(/(\d+)살/g)].map((m) => Number(m[1])));
    for (const a of cited) assert.ok(a === age || onDoc.includes(a) || c.who === 'ducks', `${c.id}: 해설의 ${a}살이 손님 ${age}살 · 표와 다르다`);
  }
});

test('캠퍼스 판 2판: 놓치면 씩 웃는 문항은 거절이 정답이고, 아이 · 할머니 손님에게는 없다', () => {
  const byId = new Map(pairs.map(([, c]) => [c.id, c]));
  for (const id of SNEAKY) {
    const c = byId.get(id);
    assert.ok(c, `${id} 문항이 있다`);
    assert.notEqual(c.answer, 'pass', id);
    assert.ok(!['squirrel', 'hedgehog', 'rabbit'].includes(c.who), `${id}: 어린이 · 할머니를 속임수꾼으로 만들지 않는다`);
  }
});

test('캠퍼스 판: applyWorld는 두 번 불러도 한 번만 바꾼다', () => {
  const before = JSON.stringify(VENUES);
  applyWorld({ VENUES, CAST, TUTORIAL });
  assert.equal(JSON.stringify(VENUES), before);
});
