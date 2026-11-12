// Vellum 문장 표(단계 4 계획 §4) — 한국어 기능 글이 단계 2의 reasonLine과 같은 문장인가, 언어는 물러서지 않는가, 조사가 제품 규칙과 같은가.
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';

const { render, subjectOf, LANGS } = await subject('vellum/index.mjs');
const { finalOf, josa } = await subject('vellum/josa.mjs');
const { reasonLine } = await subject('reason/ko.mjs');
const { REASON_CODES } = await subject('reason/index.mjs');

const NAMES = [
  '기숙사',
  '약국',
  '물',
  '-(으)세요',
  '우체국',
  '듣고 세부 정보 찾기',
  'ㄱ',
  'ㅏ',
  '3',
  'GT',
];
const label = id => `이름:${id}`;
const labelOf = names => id => names[id] ?? null;

// reasonLine이 다루는 종류마다 근거 칸 조합 — 단계 2 reason/index.mjs가 내는 꼴 그대로.
function cases() {
  const out = [];
  for (const [i, name] of NAMES.entries()) {
    const unit = `u${i}`;
    const skill = `s${i}`;
    out.push({ code: 'unit.retry', slots: { unit, other: true }, name, id: unit });
    out.push({ code: 'unit.retry', slots: { unit, other: false }, name, id: unit });
    for (const [reviews, misses, days] of [
      [1, 1, 1],
      [5, 3, 3],
    ])
      out.push({ code: 'unit.shaky', slots: { unit, reviews, misses, days }, name, id: unit });
    out.push({ code: 'unit.due', slots: { unit, days: 8 }, name, id: unit });
    out.push({ code: 'unit.new', slots: { unit }, name, id: unit });
    out.push({
      code: 'skill.up',
      slots: { skill, unit, streak: 4, from: 1, to: 2 },
      name,
      id: skill,
    });
    out.push({ code: 'skill.ease', slots: { skill, unit, from: 2, to: 1 }, name, id: skill });
    out.push({ code: 'pace.breather', slots: { unit, misses: 2 }, name, id: unit });
  }
  for (const code of ['idle', 'day.capped', 'pace.stubborn'])
    out.push({ code, slots: {}, name: '', id: null });
  return out;
}

test('한국어 기능 글은 reasonLine과 같다 — 다른 것은 받침 뒤의 「으로」 하나', () => {
  let checked = 0;
  for (const row of cases()) {
    const names = row.id ? { [row.id]: row.name } : {};
    const mine = render({ code: row.code, slots: row.slots }, { label: labelOf(names) });
    const theirs = reasonLine({ code: row.code, slots: row.slots }, labelOf(names));
    const final = finalOf(row.name);
    if (row.code === 'pace.breather' && final !== 0 && final !== 8) {
      assert.equal(mine, theirs.replace(`「${row.name}」로`, `「${row.name}」으로`), row.name);
      assert.notEqual(mine, theirs);
    } else assert.equal(mine, theirs, `${row.code} · ${row.name}`);
    checked += 1;
  }
  assert.ok(checked > 80);
});

test('reasonLine이 다루는 이유 종류는 모두 표에 있다', () => {
  const host = new Set(['host.resume', 'host.prerequisite', 'host.homework', 'goal.match']);
  for (const code of Object.values(REASON_CODES)) {
    const slots = {
      unit: 'u',
      skill: 's',
      topic: 't',
      days: 2,
      reviews: 3,
      misses: 1,
      streak: 2,
      status: 'missed',
    };
    const line = render({ code, slots }, { label });
    assert.equal(typeof line, 'string', code);
    if (!host.has(code)) assert.ok(line.length > 5, code);
  }
  // 숙제 상태를 모르면 말하지 않는다 — 모르는 상태를 「놓친 답이 있어」로 짓지 않는다(카본 끝 판 C4)
  assert.equal(render({ code: 'host.homework', slots: { skill: 's' } }, { label }), null);
  assert.equal(
    render({ code: 'host.homework', slots: { skill: 's', status: 'later' } }, { label }),
    null,
  );
  // 빈 이유 · 이름 없는 종류에는 가리키는 것이 없다(카본 끝 판 C2)
  assert.equal(subjectOf(null), null);
  assert.equal(subjectOf({ code: 'idle', slots: { unit: 'u' } }), null);
  assert.equal(subjectOf({ code: 'toString', slots: { unit: 'u' } }), 'u');
});

test('언어는 물러서지 않는다 — 그 언어 줄이 없으면 null, 눈높이 · 말하는 사람은 물러선다', () => {
  const why = { code: 'unit.new', slots: { unit: 'u1' } };
  assert.equal(render(why, { lang: 'ko', label }), '「이름:u1」 처음 만나요.');
  assert.equal(render(why, { lang: 'en', label }), 'Seeing ‘이름:u1’ for the first time.');
  assert.equal(render(why, { lang: 'fr', label }), null);
  // 영어 · 몽골어 줄은 화면이 열린 종류만 있다 — 없는 종류(홈의 host.*)는 한국어로 물러서지 않는다
  const home = { code: 'host.next', slots: {} };
  assert.equal(typeof render(home, { lang: 'ko', label }), 'string');
  assert.equal(render(home, { lang: 'en', label }), null);
  assert.equal(render(home, { lang: 'mn', label }), null);
  assert.equal(
    render(why, { lang: 'ko', level: 'easy', speaker: 'marin', label }),
    '「이름:u1」 처음 만나요.',
  );
  assert.deepEqual([...LANGS], ['ko', 'en', 'mn']);
});

test('이름이 있어야 하는 문장에 이름이 없으면 null, 모르는 종류 · 문장 없는 종류(host.order)도 null', () => {
  assert.equal(
    render({ code: 'unit.due', slots: { unit: 'u1', days: 3 } }, { label: () => '' }),
    null,
  );
  assert.equal(render({ code: 'unit.due', slots: { days: 3 } }, { label }), null);
  assert.equal(render({ code: 'host.order', slots: {} }, { label }), null);
  assert.equal(render({ code: 'nope', slots: {} }, { label }), null);
  assert.equal(render(null), null);
  assert.equal(
    render({ code: 'idle', slots: {} }),
    '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.',
  );
});

test('제품 사실 · 목표 문장 — 숙제는 까닭에 따라, 관심 주제는 받침에 따라', () => {
  const names = { s: '듣고 세부 정보 찾기', cafe: '카페에서 주문하기', bank: '은행' };
  const opt = { label: labelOf(names) };
  assert.equal(
    render({ code: 'host.homework', slots: { skill: 's', status: 'review' } }, opt),
    '이번 주 숙제예요. 「듣고 세부 정보 찾기」 기록이 오래돼 새 문항으로 다시 확인해요.',
  );
  assert.equal(
    render({ code: 'host.homework', slots: { skill: 's', status: 'missed' } }, opt),
    '이번 주 숙제예요. 「듣고 세부 정보 찾기」에서 놓친 답이 있어 새 문항으로 다시 확인해요.',
  );
  assert.equal(
    render({ code: 'goal.match', slots: { topic: 'cafe' } }, opt),
    '더 배우고 싶다고 알려 준 「카페에서 주문하기」예요.',
  );
  assert.equal(
    render({ code: 'goal.match', slots: { topic: 'bank' } }, opt),
    '더 배우고 싶다고 알려 준 「은행」이에요.',
  );
  assert.equal(subjectOf({ code: 'skill.up', slots: { skill: 'a', unit: 'b' } }), 'a');
});

test('조사 규칙은 제품의 kit/josa.mjs와 같다', async () => {
  const product = await import(
    pathToFileURL(
      path.join(PACKAGE_ROOT, '..', '..', 'experiences', 'brand-opening', 'kit', 'josa.mjs'),
    ).href
  );
  const words = [
    ...NAMES,
    '「약국」',
    '「물」',
    '“무엇을 먹어요?”',
    '코스트 GT',
    '',
    '10',
    '0',
    'ㄹ',
    '라켓',
  ];
  for (const word of words) {
    assert.equal(finalOf(word), product.finalOf(word), word);
    for (const [a, b] of [
      ['으로', '로'],
      ['이에요', '예요'],
      ['을', '를'],
    ])
      assert.equal(josa(word, a, b), product.josa(word, a, b), `${word} ${a}/${b}`);
  }
});

// 4-1 WORLD 짧은 연습에 보이는 종류(문항 위 이유 · 판 끝 문장)는 영어 줄이 있다 — 세 겹 대조를 지난 문장(단계 4 계획 §4).
test('영어 · 몽골어 줄 — 짧은 연습에 보이는 종류마다 있고, 한국어는 「」 안 이름에만', () => {
  const PRACTICE = [
    ['unit.retry', { unit: 'u', other: true }],
    ['unit.retry', { unit: 'u', other: false }],
    ['unit.shaky', { unit: 'u', reviews: 1, misses: 1, days: 1 }],
    ['unit.shaky', { unit: 'u', reviews: 4, misses: 2, days: 3 }],
    ['unit.due', { unit: 'u', days: 5 }],
    ['unit.new', { unit: 'u' }],
    ['skill.up', { skill: 's', streak: 3 }],
    ['skill.ease', { skill: 's' }],
    ['pace.breather', { unit: 'u', misses: 2 }],
    ['idle', {}],
    ['day.capped', {}],
    ['pace.stubborn', {}],
  ];
  // 단위 이름은 한국어 학습 대상이라 「」 안에, 능력 이름은 셸이 화면 언어로 번역해 넘기므로 낫표 없이(11-12 화면 검수 카본 A8).
  const skillName = { en: 'Reading for details', mn: 'Уншаад нарийн мэдээллийг олох' };
  for (const lang of ['en', 'mn'])
    for (const [code, slots] of PRACTICE) {
      const names = { u: '은행', s: skillName[lang] };
      const line = render({ code, slots }, { lang, label: id => names[id] });
      assert.equal(typeof line, 'string', `${lang} ${code}`);
      assert.doesNotMatch(line, /「|」/, `${lang} ${code}: 낫표는 한국어 화면만`);
      assert.doesNotMatch(
        line.replace(lang === 'en' ? /‘[^’]*’/g : /«[^»]*»/g, ''),
        /[가-힣]/,
        `${lang} ${code}: 이름 밖에 한국어가 없다`,
      );
      if (code.startsWith('skill.')) {
        assert.ok(line.startsWith(`${skillName[lang]}:`), `${lang} ${code}: 능력 이름이 앞에`);
        assert.doesNotMatch(line, /「|‘|«/, `${lang} ${code}: 능력 이름에 따옴표 없음`);
      }
    }
  assert.equal(
    render(
      { code: 'unit.shaky', slots: { unit: 'u', reviews: 1, misses: 1, days: 1 } },
      { lang: 'en', label: () => '은행' },
    ),
    'You missed ‘은행’ last time — it’s back after 1 day.',
    '하루는 단수',
  );
});
