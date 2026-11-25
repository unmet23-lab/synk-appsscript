// Vellum 문장 표(단계 4 계획 §4) — 한국어 기능 글이 단계 2의 reasonLine과 같은 문장인가, 언어는 물러서지 않는가, 조사가 제품 규칙과 같은가.
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';

const { render, subjectOf, LANGS, SILENT_CODES, SPEAKERS } = await subject('vellum/index.mjs');
const { finalOf, josa } = await subject('vellum/josa.mjs');
const { reasonLine } = await subject('reason/ko.mjs');
const { REASON_CODES, PROGRESS_CODES } = await subject('reason/index.mjs');
const { DESCRIBE_SLOTS, SCENE_SLOTS, SCENE_STEPS, SCENE_STATES } =
  await subject('vellum/slots.mjs');
const { KO } = await subject('vellum/ko.mjs');
const { EN } = await subject('vellum/en.mjs');
const { MN } = await subject('vellum/mn.mjs');

// 점검 칸의 쓰기 · 말하기 설명(4-4d — 단계 4 계획 §21-23의 3) — 칸 표(vellum/slots.mjs)에 맞는 칸의 보기.
const DESCRIBED = Object.freeze({
  'host.writing': { focus: 'ending-53', need: 'retry' },
  'host.writing.start': {},
  'host.speaking': { type: 'answer', untried: 3 },
  'host.speaking.again': {},
});

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
      [1, 1, 0], // 같은 하루 — 날 수를 말하지 않는 줄(Fable 5.2 끝 판 둘째 넘친 #7)
      [4, 2, 0],
    ])
      out.push({ code: 'unit.shaky', slots: { unit, reviews, misses, days }, name, id: unit });
    out.push({ code: 'unit.due', slots: { unit, days: 8 }, name, id: unit });
    out.push({ code: 'unit.due', slots: { unit, days: 0 }, name, id: unit });
    out.push({ code: 'unit.new', slots: { unit }, name, id: unit });
    out.push({ code: 'unit.new', slots: { unit, relearn: true }, name, id: unit }); // 다시 배우기(5-3 전 고침 GB4)
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
  out.push({ code: 'idle', slots: { left: true }, name: '', id: null }); // 돌아온 말이 남음(5-3 전 고침 GB3)
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

// 말하지 않는 종류(제품 순서 host.order)는 이유 종류이지만 문장이 없다 — 이 시험은 말하는 종류만 본다(단계 4 §20-6의 4 · 설계 검토 H17).
// 5-3 전 고침 GB3 · GB4(설계 주인 11-25): 돌아온 말이 남은 채우기(idle의 left)와 다시 배우기(unit.new의 relearn)는 한국어 줄만 있다.
// 영어 · 몽골어 줄은 세 겹 대조 전까지 없고(null), 언어는 물러서지 않는다. 근거 칸이 없는 줄은 지금 문장 그대로다.
test('돌아온 말이 남은 채우기 · 다시 배우기 — 한국어는 정한 문장, 영어 · 몽골어는 세 겹 대조 전까지 null(5-3 전 고침 GB3 · GB4)', () => {
  const left = { code: 'idle', slots: { left: true } };
  const relearn = { code: 'unit.new', slots: { unit: 'u1', relearn: true } };
  assert.equal(
    render(left, { label }),
    '돌아온 말은 이번 판에 여기까지예요. 남은 말은 다음에 만나요.',
  );
  assert.equal(render(relearn, { label }), '「이름:u1」 처음부터 다시 만나요.');
  assert.equal(
    render({ code: 'idle', slots: {} }, { label }),
    '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.',
  );
  assert.equal(
    render({ code: 'unit.new', slots: { unit: 'u1' } }, { label }),
    '「이름:u1」 처음 만나요.',
  );
  for (const lang of ['en', 'mn']) {
    assert.equal(render(left, { lang, label }), null, `${lang} idle left`);
    assert.equal(render(relearn, { lang, label }), null, `${lang} unit.new relearn`);
    assert.equal(
      typeof render({ code: 'idle', slots: {} }, { lang, label }),
      'string',
      `${lang} idle`,
    );
    assert.equal(
      typeof render({ code: 'unit.new', slots: { unit: 'u1' } }, { lang, label }),
      'string',
      `${lang} unit.new`,
    );
  }
});

test('reasonLine이 다루는 이유 종류는 모두 표에 있다', () => {
  const host = new Set(['host.resume', 'host.prerequisite', 'host.homework', 'goal.match']);
  assert.deepEqual([...SILENT_CODES], ['host.order']);
  assert.ok(Object.values(REASON_CODES).includes('host.order'), '제품 순서도 이유 종류다');
  for (const code of Object.values(REASON_CODES)) {
    if (SILENT_CODES.includes(code)) {
      assert.equal(render({ code, slots: {} }, { label }), null, `${code}는 말하지 않는다`);
      // 말하지 않는 종류는 가리키는 것도 없다 — 기본 칸 unit의 id를 내지 않는다(카본 엔진급 끝 판 C1)
      assert.equal(
        subjectOf({ code, slots: { unit: 'u1' } }),
        null,
        `${code}는 가리키는 것이 없다`,
      );
      continue;
    }
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
    const line = render({ code, slots: DESCRIBED[code] ?? slots }, { label });
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
  // 영어 · 몽골어 줄은 화면이 열린 종류만 있다 — 홈의 host.*는 4-3에서 들어왔다. 없는 언어는 한국어로 물러서지 않는다
  const home = { code: 'host.next', slots: {} };
  assert.equal(render(home, { lang: 'ko', label }), '생활 팩의 다음 레슨이에요.');
  assert.equal(render(home, { lang: 'en', label }), 'This is your next daily-life lesson.');
  assert.equal(render(home, { lang: 'mn', label }), 'Өдөр тутмын багцын дараагийн хичээл.');
  assert.equal(render(home, { lang: 'fr', label }), null);
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

// 4-3 홈의 생활 복습 사실(단계 4 §20-6의 5): 이름은 근거의 단위에서만 — 단위를 모르거나 이름이 실리지 않았으면 이름 없는 틀이다
// (생활 단위가 없는 복습 19개는 놓친 것으로만 돌아온다). 다음 레슨은 엔진 기록을 읽지 않는 제품 사실이라 기록을 말하지 않는다(설계 검토 H8).
test('생활 복습 사실 — 놓친 것 · 다리는 이름이 있으면 「」 안에, 없으면 이름 없는 문장이다', () => {
  const opt = { label: labelOf({ u: '주문' }) };
  assert.equal(
    render({ code: 'host.missed', slots: { unit: 'u' } }, opt),
    '놓친 「주문」, 오늘은 다른 장면에서 다시 해 봐요.',
  );
  assert.equal(
    render({ code: 'host.missed', slots: {} }, opt),
    '놓친 표현을 오늘은 다른 장면에서 다시 해 봐요.',
  );
  assert.equal(
    render({ code: 'host.missed', slots: { unit: 'x' } }, opt),
    '놓친 표현을 오늘은 다른 장면에서 다시 해 봐요.',
    '이름이 실리지 않은 단위',
  );
  assert.equal(
    render({ code: 'host.bridge', slots: { unit: 'u' } }, opt),
    '레슨에서 만난 「주문」, 오늘은 새 상황에서 다시 만나요.',
  );
  assert.equal(
    render({ code: 'host.bridge', slots: {} }, opt),
    '레슨에서 만난 표현을 오늘은 새 상황에서 다시 만나요.',
  );
  assert.equal(render({ code: 'host.next', slots: {} }, opt), '생활 팩의 다음 레슨이에요.');
  assert.equal(
    render({ code: 'unit.new', slots: { unit: 'x' } }, opt),
    null,
    '다른 종류는 이름이 없으면 그대로 짓지 않는다',
  );
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

// 4-3 WORLD 홈의 세 줄과 활동 고르기 문장(단계 4 §20-8)은 영어 · 몽골어 줄이 있다 — 세 겹 대조를 지난 문장. 학습 대상 이름(단위 · 주제)은
// 한국어 그대로 따옴표 안에, 능력 이름(숙제)은 화면 언어로 번역된 이름이라 따옴표 없이 맨 앞에 둔다.
test('영어 · 몽골어 줄 — 홈 · 활동 고르기 종류마다 있고, 한국어는 따옴표 안 이름에만(단계 4 §20-8)', () => {
  const HOME = [
    ['goal.match', { topic: 't' }],
    ['host.resume', {}],
    ['host.prerequisite', {}],
    ['host.homework', { skill: 's', status: 'review' }],
    ['host.homework', { skill: 's', status: 'missed' }],
    ['host.form', {}],
    ['host.recheck', {}],
    ['host.start', {}],
    ['host.next', {}],
    ['host.missed', { unit: 'u' }],
    ['host.missed', {}],
    ['host.bridge', { unit: 'u' }],
    ['host.bridge', {}],
    ['host.writing', { focus: 'ending-53', need: 'retry' }],
    ['host.writing', { focus: 'ending-53', need: 'assisted' }],
    ['host.writing.start', {}],
    ['host.speaking', { type: 'answer', untried: 1 }],
    ['host.speaking', { type: 'opinion', untried: 6 }],
    ['host.speaking.again', {}],
  ];
  const skillName = { en: 'Reading for details', mn: 'Уншаад нарийн мэдээллийг олох' };
  for (const lang of ['en', 'mn'])
    for (const [code, slots] of HOME) {
      const names = { u: '은행', t: '카페에서 주문하기', s: skillName[lang] };
      const line = render({ code, slots }, { lang, label: id => names[id] });
      assert.equal(typeof line, 'string', `${lang} ${code}`);
      assert.doesNotMatch(line, /「|」/, `${lang} ${code}: 낫표는 한국어 화면만`);
      assert.doesNotMatch(
        line.replace(lang === 'en' ? /‘[^’]*’/g : /«[^»]*»/g, ''),
        /[가-힣]/,
        `${lang} ${code}: 이름 밖에 한국어가 없다`,
      );
      if (code === 'host.homework') {
        assert.ok(line.startsWith(`${skillName[lang]}:`), `${lang} ${code}: 능력 이름이 앞에`);
        assert.doesNotMatch(line, /‘|«/, `${lang} ${code}: 능력 이름에 따옴표 없음`);
      }
      if (slots.unit || slots.topic)
        assert.ok(line.includes(names[slots.unit ?? slots.topic]), `${lang} ${code}: 이름`);
      assert.doesNotMatch(line, /‘\s*’|«\s*»/, `${lang} ${code}: 빈 따옴표가 없다`);
    }
  for (const lang of ['en', 'mn'])
    assert.equal(
      render({ code: 'host.homework', slots: { skill: 's' } }, { lang, label: () => 'R' }),
      null,
      `숙제 상태를 모르면 ${lang}도 말하지 않는다`,
    );
});

// 이름 없는 복습 문장 — 생활 단위가 없거나(빈 칸) 이름이 실리지 않은(빈 이름) 복습은 세 언어 모두 이름 없는 틀이고, 이름이 있으면 따옴표 안에
// 든다(카본 엔진급 끝 판 C2 — 홈 줄 시험은 꼴만 보아 이름 분기가 깨져 빈 따옴표가 찍혀도 통과했다).
test('이름 없는 복습 문장 — 세 언어 모두 이름 없는 틀이고 빈 따옴표가 없다(카본 엔진급 끝 판 C2)', () => {
  const NAMELESS_LINES = {
    ko: {
      'host.missed': '놓친 표현을 오늘은 다른 장면에서 다시 해 봐요.',
      'host.bridge': '레슨에서 만난 표현을 오늘은 새 상황에서 다시 만나요.',
    },
    en: {
      'host.missed':
        'You missed some expressions — today, let’s try them again in a different situation.',
      'host.bridge': 'Today, let’s review expressions from your lessons in a new situation.',
    },
    mn: {
      'host.missed': 'Алдсан үг хэллэгээ өнөөдөр өөр нөхцөл байдалд дахин ашиглаж үзье.',
      'host.bridge': 'Хичээл дээр үзсэн үг хэллэгээ өнөөдөр шинэ нөхцөл байдалд дахин давтъя.',
    },
  };
  for (const [lang, lines] of Object.entries(NAMELESS_LINES))
    for (const [code, text] of Object.entries(lines)) {
      assert.equal(
        render({ code, slots: {} }, { lang, label: () => '은행' }),
        text,
        `${lang} ${code}: 단위 없음`,
      );
      for (const name of [null, '', '  '])
        assert.equal(
          render({ code, slots: { unit: 'u' } }, { lang, label: () => name }),
          text,
          `${lang} ${code}: 이름 없음(${JSON.stringify(name)})`,
        );
    }
  assert.equal(
    render({ code: 'host.bridge', slots: { unit: 'u' } }, { lang: 'en', label: () => '은행' }),
    'You learned ‘은행’ in a lesson — today, let’s review it in a new situation.',
  );
  assert.equal(
    render({ code: 'host.bridge', slots: { unit: 'u' } }, { lang: 'mn', label: () => '은행' }),
    'Хичээл дээр үзсэн үг хэллэг: «은행». Өнөөдөр шинэ нөхцөл байдалд дахин давтъя.',
  );
  assert.equal(
    render({ code: 'host.missed', slots: { unit: 'u' } }, { lang: 'en', label: () => '은행' }),
    'You missed ‘은행’ — today, let’s try it again in a different situation.',
  );
  assert.equal(
    render({ code: 'host.missed', slots: { unit: 'u' } }, { lang: 'mn', label: () => '은행' }),
    'Алдсан үг хэллэг: «은행». Өнөөдөр өөр нөхцөл байдалд дахин ашиглаж үзье.',
  );
});

test('같은 하루(기기 새벽 4시 경계)에 돌아온 말은 날 수를 말하지 않는다 — 한국어 · 영어 · 몽골어(Fable 5.2 끝 판 F4 · 설계 주인 11-13)', () => {
  const line = (lang, code, slots) =>
    render({ code, slots: { unit: 'u', ...slots } }, { lang, label: () => '은행' });
  const one = { reviews: 1, misses: 1, days: 0 };
  const many = { reviews: 3, misses: 2, days: 0 };
  assert.equal(line('ko', 'unit.shaky', one), '오늘 놓친 「은행」, 다시 만나요.');
  assert.equal(
    line('ko', 'unit.shaky', many),
    '「은행」 3번 중 2번 놓쳤어요. 오늘 한 번 더 만나요.',
  );
  assert.equal(
    line('ko', 'unit.due', { days: 0 }),
    '오늘 만난 「은행」, 잊기 전에 한 번 더 만나요.',
  );
  assert.equal(
    line('en', 'unit.shaky', one),
    'You missed ‘은행’ earlier today — here it is again.',
  );
  assert.equal(
    line('en', 'unit.shaky', many),
    '‘은행’: missed 2 out of 3 times. Back again today.',
  );
  assert.equal(
    line('en', 'unit.due', { days: 0 }),
    'You saw ‘은행’ earlier today. Let’s review it once more before it fades.',
  );
  assert.equal(line('mn', 'unit.shaky', one), 'Өнөөдөр алдсан үг хэллэг: «은행». Дахин давтъя.');
  assert.equal(
    line('mn', 'unit.shaky', many),
    '«은행»: 3 оролдлогоос 2 удаа алдсан. Өнөөдөр дахин давтъя.',
  );
  assert.equal(
    line('mn', 'unit.due', { days: 0 }),
    '«은행»: өнөөдөр үзсэн. Мартахаасаа өмнө дахин нэг давтъя.',
  );
  for (const lang of ['ko', 'en', 'mn'])
    for (const [code, slots] of [
      ['unit.shaky', one],
      ['unit.shaky', many],
      ['unit.due', { days: 0 }],
    ])
      assert.doesNotMatch(
        line(lang, code, slots),
        /\b0\b|0일|0 хоног/,
        `${lang} ${code}: 0일을 말하지 않는다`,
      );
  assert.equal(
    line('ko', 'unit.shaky', { ...one, days: 2 }),
    '지난번에 놓친 「은행」, 2일 만에 다시 만나요.',
    '하루를 넘기면 날 수를 그대로',
  );
});

test('상속한 열쇠로는 표를 읽지 않는다 — constructor · toString 같은 언어 · 종류는 없는 것, 눈높이 · 말하는 사람은 물러선다(카본 끝 판 둘째 G1)', () => {
  const why = { code: 'unit.new', slots: { unit: 'ko.word.x' } };
  const plain = render(why, { label });
  assert.ok(plain);
  assert.equal(
    render(why, { level: 'constructor', speaker: 'caller', label }),
    plain,
    '모르는 눈높이 · 말하는 사람은 standard · default로',
  );
  assert.equal(render(why, { level: 'toString', label }), plain);
  assert.equal(
    render({ code: 'toString' }, { level: 'caller', label }),
    null,
    '상속한 종류는 없는 종류',
  );
  assert.equal(render({ code: '__proto__' }, { label }), null);
  assert.equal(render(why, { lang: 'constructor', label }), null, '상속한 언어는 없는 언어');
});

test('수 칸이 비었거나 음수 · 정수가 아니면 문장을 짓지 않는다 — 날 수가 빠져 「오늘」로 읽히거나 「undefined번」이 박히지 않게(카본 끝 판 둘째 G2)', () => {
  for (const lang of LANGS) {
    const opts = { lang, label };
    assert.equal(
      render({ code: 'unit.due', slots: { unit: 'u' } }, opts),
      null,
      `${lang} 날 수 없음`,
    );
    assert.equal(
      render({ code: 'unit.due', slots: { unit: 'u', days: -1 } }, opts),
      null,
      `${lang} 음수`,
    );
    assert.equal(
      render({ code: 'unit.due', slots: { unit: 'u', days: 1.5 } }, opts),
      null,
      `${lang} 정수 아님`,
    );
    assert.equal(
      render({ code: 'unit.shaky', slots: { unit: 'u', days: 2, reviews: 3 } }, opts),
      null,
      `${lang} 놓친 수 없음`,
    );
    assert.equal(
      render({ code: 'unit.shaky', slots: { unit: 'u', days: 2, misses: 1 } }, opts),
      null,
      `${lang} 만난 수 없음`,
    );
    assert.equal(
      render({ code: 'skill.up', slots: { skill: 's', streak: Number.NaN } }, opts),
      null,
      `${lang} NaN`,
    );
    assert.equal(
      render({ code: 'pace.breather', slots: { unit: 'u' } }, opts),
      null,
      `${lang} 놓친 수 없음`,
    );
    assert.ok(
      render({ code: 'unit.due', slots: { unit: 'u', days: 0 } }, opts),
      `${lang} 같은 하루(0)는 짓는다`,
    );
    assert.ok(
      render({ code: 'unit.shaky', slots: { unit: 'u', days: 2, reviews: 1, misses: 1 } }, opts),
      `${lang} 바른 칸`,
    );
  }
});

// 30일째 문장(단계 4 계획 §21-7) — 진도의 사실이라 고르기의 이유(REASON_CODES)와 따로 둔다. 한국어만 있고 영어 · 몽골어는 세 겹 대조 뒤에
// 들인다(언어는 물러서지 않는다). 말하는 조건의 하한(memory/lookback.mjs의 MONTH_FLOOR) 아래의 수나 이름 없는 단위로는 짓지 않는다.
test('progress.month — 한국어 문장 · 영어 · 몽골어는 null · 하한 아래와 이름 없는 단위는 짓지 않는다', async () => {
  const { MONTH_FLOOR } = await subject('memory/lookback.mjs');
  const { monthReason, PROGRESS_CODES, REASON_CODES: codes } = await subject('reason/index.mjs');
  assert.equal(PROGRESS_CODES.month, 'progress.month');
  assert.ok(!Object.values(codes).includes('progress.month'), '고르기의 이유 종류가 아니다');
  const row = { unit: 'ko.grammar.seyo', misses: 3, reviews: 7, last: 1, evidence: { misses: 3 } };
  const why = monthReason(row);
  assert.deepEqual(why, {
    code: 'progress.month',
    slots: { unit: 'ko.grammar.seyo', misses: 3, reviews: 7 },
    evidence: { misses: 3 },
  });
  const names = labelOf({ 'ko.grammar.seyo': '-(으)세요' });
  assert.equal(
    render(why, { label: names }),
    '한 달 전에 3번 놓친 「-(으)세요」, 그 뒤로 7번 모두 혼자 맞혔어요.',
  );
  assert.equal(render(why, { label: names, lang: 'en' }), null, '영어 줄은 아직 없다');
  assert.equal(render(why, { label: names, lang: 'mn' }), null, '몽골어 줄은 아직 없다');
  assert.equal(render(why, { label: labelOf({}) }), null, '이름 없는 단위로는 짓지 않는다');
  // 하한은 MONTH_FLOOR와 같다 — 그 수면 짓고, 하나라도 모자라면 짓지 않는다.
  const at = (misses, reviews) =>
    render(monthReason({ unit: 'ko.grammar.seyo', misses, reviews }), { label: names });
  assert.ok(at(MONTH_FLOOR.misses, MONTH_FLOOR.reviews), '하한 그대로면 짓는다');
  assert.equal(at(MONTH_FLOOR.misses - 1, MONTH_FLOOR.reviews), null, '놓친 자리가 모자라다');
  assert.equal(at(MONTH_FLOOR.misses, MONTH_FLOOR.reviews - 1), null, '뒤 창 자리가 모자라다');
  assert.equal(at(Number.NaN, 5), null);
});

// 점검 칸의 쓰기 · 말하기 설명(4-4d — 단계 4 계획 §21-23의 3, 설계 주인 11-17 답 4). 칸 표는 vellum/slots.mjs 한 곳이고, 세 언어 줄은
// 그 코드의 칸을 빠짐없이, 그 칸만 쓴다. 열거값마다 · 정수의 하한과 상한마다 줄을 지어 읽은 칸을 표와 맞댄다(Proxy로 읽은 칸을 센다).
function samplesOf(table) {
  let out = [{}];
  for (const [name, form] of Object.entries(table)) {
    const values = form.enum
      ? [...form.enum]
      : [...new Set([form.min, form.min + 1, form.max ?? form.min + 9])];
    out = out.flatMap(sample => values.map(value => ({ ...sample, [name]: value })));
  }
  return out;
}
test('점검 칸의 쓰기 · 말하기 설명 — 한국어 · 영어 · 몽골어 줄이 칸 표의 칸을 빠짐없이, 그 칸만 쓴다(설계 주인 11-17 답 4)', () => {
  const tables = { ko: KO, en: EN, mn: MN };
  assert.deepEqual(Object.keys(DESCRIBE_SLOTS).sort(), [
    'host.speaking',
    'host.speaking.again',
    'host.writing',
    'host.writing.start',
  ]);
  let lines = 0;
  for (const [code, table] of Object.entries(DESCRIBE_SLOTS)) {
    const names = Object.keys(table).sort();
    for (const sample of samplesOf(table))
      for (const lang of LANGS) {
        const list = tables[lang][code]?.standard?.default;
        assert.ok(Array.isArray(list) && list.length, `${lang} ${code}: 줄이 있다`);
        for (const template of list) {
          const used = new Set();
          const slots = new Proxy(sample, {
            get(target, key) {
              if (typeof key === 'string') used.add(key);
              return target[key];
            },
          });
          const line = template(slots, '', josa);
          assert.equal(typeof line, 'string', `${lang} ${code}`);
          assert.deepEqual(
            [...used].sort(),
            names,
            `${lang} ${code} ${JSON.stringify(sample)}: 읽은 칸`,
          );
          assert.doesNotMatch(line, /undefined|null|NaN|\[object/, `${lang} ${code}`);
          assert.equal(
            render({ code, slots: sample }, { lang }),
            line,
            `${lang} ${code}: render와 같은 줄`,
          );
          lines += 1;
        }
      }
  }
  assert.ok(lines >= 3 * (2 + 1 + 6 * 3 + 1), `줄 ${lines}개`);
});

test('설명 칸이 표에 맞지 않으면 문장을 짓지 않는다 — 표 밖의 열거값 · 글자로 넘긴 수 · 하한 밑 · 상한 위 · 빠진 칸 · 더한 칸(카본 B3)', () => {
  const bad = [
    ['host.writing', { focus: 'ending-54', need: 'retry' }],
    ['host.writing', { focus: 'ending-53', need: 'found' }],
    ['host.writing', { focus: 'ending-53' }],
    ['host.writing', { focus: 'ending-53', need: 'retry', extra: 1 }],
    ['host.writing', { focus: ['ending-53'], need: 'retry' }],
    ['host.writing', null],
    ['host.writing', []],
    ['host.speaking', { type: 'answer', untried: '3' }],
    ['host.speaking', { type: 'answer', untried: 0 }],
    ['host.speaking', { type: 'answer', untried: 7 }],
    ['host.speaking', { type: 'answer', untried: 2.5 }],
    ['host.speaking', { type: 'answer', untried: Number.MAX_SAFE_INTEGER + 1 }],
    ['host.speaking', { type: 'toString', untried: 2 }],
    ['host.speaking', { type: 'answer' }],
    ['host.speaking', { untried: 2 }],
    ['host.writing.start', { focus: 'ending-53' }],
    ['host.speaking.again', { untried: 0 }],
    // 보통 객체가 아닌 칸 — 칸 자체는 맞아도 받지 않는다(프로토타입이 다른 객체 · 프로토타입이 없는 객체, Fable 끝 판 F4)
    [
      'host.writing',
      Object.assign(Object.create({ inherited: true }), { focus: 'ending-53', need: 'retry' }),
    ],
    ['host.writing', Object.assign(Object.create(null), { focus: 'ending-53', need: 'retry' })],
  ];
  for (const lang of LANGS)
    for (const [code, slots] of bad)
      assert.equal(
        render({ code, slots }, { lang }),
        null,
        `${lang} ${code} ${JSON.stringify(slots)}`,
      );
  // 칸 없는 둘은 근거 없는 정상 경로다 — 하한에 막혀 null이 되지 않고, 「0개」 문장도 없다(다시 검수 Opus 대체 FA3)
  for (const lang of LANGS)
    for (const code of ['host.writing.start', 'host.speaking.again']) {
      const line = render({ code, slots: {} }, { lang });
      assert.equal(typeof line, 'string', `${lang} ${code}`);
      assert.equal(render({ code }, { lang }), line, `${lang} ${code}: 칸이 없어도`);
      assert.doesNotMatch(line, /\b0\b|0개/, `${lang} ${code}: 0을 말하지 않는다`);
    }
  assert.equal(
    render({ code: 'host.writing', slots: { focus: 'ending-53', need: 'retry' } }),
    '지난 53번 글에서 놓친 「-다」 끝맺음을 다시 연습해요. TOPIK 쓰기의 언어 사용 점수에 도움이 돼요.',
  );
  assert.equal(
    render({ code: 'host.writing', slots: { focus: 'ending-53', need: 'assisted' } }),
    '도움을 받아 고친 53번 글의 「-다」 끝맺음을 이번에는 혼자 써 봐요. TOPIK 쓰기의 언어 사용 점수에 도움이 돼요.',
  );
  assert.equal(
    render({ code: 'host.speaking', slots: { type: 'interpret', untried: 2 } }),
    'TOPIK 말하기 여섯 유형 가운데 이번 주에 이 기기에서 아직 안 해 본 유형이 2개예요. 오늘은 「자료 해석하기」를 해 봐요.',
  );
  // 가리키는 것이 없는 종류 — 이름을 찾지 않는다(NAMELESS)
  for (const code of Object.keys(DESCRIBE_SLOTS)) {
    assert.equal(subjectOf({ code, slots: { unit: 'u' } }), null, code);
    assert.equal(
      typeof render({ code, slots: DESCRIBED[code] }, { label: () => null }),
      'string',
      `${code}: 이름이 없어도 짓는다`,
    );
  }
});

// 장면 사실(서울행 「내 팬」 1차 — experiences/seoul-arrival/팬설계.md §12-2 · §12-3). 칸 표는 vellum/slots.mjs SCENE_SLOTS이고, 세 언어 ·
// 두 말하는 사람(default · fan) 줄이 다 있다. 한국어 팬 줄은 기록과 맞댄 다섯 문장 그대로다(통과를 뜻하는 말을 더하지 않는다).
const SCENE_SAMPLES = Object.freeze([
  ...[1, 2, 3, 10, 25].map(n => ['scene.lines', { n }]),
  ...['take2', 'transfer'].flatMap(step =>
    ['done', 'wait'].map(state => ['scene.step', { step, state }]),
  ),
]);
const KO_FAN = Object.freeze({
  'take2:done': '「한 번 더」도 말해 봤어요.',
  'take2:wait': '「한 번 더」는 기다릴게요. 하면 자리 하나가 켜져요.',
  'transfer:done': '「처음 보는 말」까지 말해 봤어요.',
  'transfer:wait': '「처음 보는 말」도 들어 보고 싶어요.',
});
const KO_DEFAULT = Object.freeze({
  'take2:done': '「한 번 더」를 말해 봤어요.',
  'take2:wait': '「한 번 더」는 아직이에요.',
  'transfer:done': '처음 보는 말을 말해 봤어요.',
  'transfer:wait': '처음 보는 말은 아직이에요.',
});

// 언어 × 말하는 사람 × 칸 보기를 한 줄로 편다(시험 함수의 복잡도 상한 15).
const SCENE_CASES = LANGS.flatMap(lang =>
  ['default', 'fan'].flatMap(speaker =>
    SCENE_SAMPLES.map(([code, slots]) => ({ lang, speaker, code, slots })),
  ),
);

test('장면 사실 — scene.lines · scene.step은 세 언어 · default와 fan 줄이 다 있고, 영어 · 몽골어 줄에 한국어가 없다(팬설계 §12-2)', () => {
  assert.deepEqual([...SPEAKERS], ['default', 'marin', 'kkamong', 'mongle', 'fan']);
  assert.deepEqual([...SCENE_STEPS], ['take2', 'transfer']);
  assert.deepEqual([...SCENE_STATES], ['done', 'wait']);
  for (const { lang, speaker, code, slots } of SCENE_CASES) {
    const at = `${lang} ${speaker} ${code} ${JSON.stringify(slots)}`;
    const line = render({ code, slots }, { lang, speaker });
    assert.equal(typeof line, 'string', at);
    assert.ok(line.trim().length > 5, at);
    assert.doesNotMatch(line, /undefined|null|NaN|\[object/, at);
    if (lang !== 'ko') assert.doesNotMatch(line, /「|」|[가-힣]/, `${at}: 한국어가 없다`);
    if (code === 'scene.lines') assert.ok(line.includes(String(slots.n)), `${at}: 수`);
  }
  assert.equal(
    render({ code: 'scene.lines', slots: { n: 1 } }, { lang: 'en' }),
    'You said 1 line out loud.',
    '한 줄은 단수',
  );
  assert.equal(
    render({ code: 'scene.lines', slots: { n: 2 } }, { lang: 'en' }),
    'You said 2 lines out loud.',
  );
});

test('장면 사실 — 한국어 줄은 설계 표 그대로이고, 팬 줄은 기본 줄과 다르며, 통과를 단정하는 말이 없다(팬설계 §12-2)', () => {
  for (let n = 1; n <= 10; n += 1)
    for (const speaker of ['default', 'fan'])
      assert.equal(
        render({ code: 'scene.lines', slots: { n } }, { speaker }),
        `대사 ${n}줄을 소리 내어 말했어요.`,
      );
  for (const [key, text] of Object.entries(KO_FAN)) {
    const [step, state] = key.split(':');
    const why = { code: 'scene.step', slots: { step, state } };
    assert.equal(render(why, { speaker: 'fan' }), text, `fan ${key}`);
    assert.equal(render(why), KO_DEFAULT[key], `default ${key}`);
    for (const lang of LANGS)
      assert.notEqual(
        render(why, { lang, speaker: 'fan' }),
        render(why, { lang }),
        `${lang} ${key}: 팬 줄은 기본 줄과 다르다`,
      );
  }
  // 통과 · 솜씨를 단정하는 말은 1차 줄에 없다(줄마다 판정이 오는 2차로). 내 팬 화면에서도 쓰므로 「오늘」 · 「이번에」도 없다.
  for (const { speaker, code, slots } of SCENE_CASES.filter(row => row.lang === 'ko'))
    assert.doesNotMatch(
      render({ code, slots }, { speaker }),
      /잘|끝까지|해냈|맞게|맞았|오늘|이번에/,
      `${speaker} ${code} ${JSON.stringify(slots)}`,
    );
});

test('장면 사실 칸이 표에 맞지 않으면 세 언어 · 두 말하는 사람 모두 문장을 짓지 않는다 — 0줄 · 음수 · 정수 아님 · 글자 · 모르는 단계 · 상태 · 빠지거나 더한 칸', () => {
  const bad = [
    ['scene.lines', { n: 0 }],
    ['scene.lines', { n: -1 }],
    ['scene.lines', { n: 1.5 }],
    ['scene.lines', { n: '2' }],
    ['scene.lines', { n: Number.NaN }],
    ['scene.lines', { n: Number.POSITIVE_INFINITY }],
    ['scene.lines', { n: Number.MAX_SAFE_INTEGER + 1 }],
    ['scene.lines', { n: [2] }],
    ['scene.lines', { n: null }],
    ['scene.lines', {}],
    ['scene.lines', undefined],
    ['scene.lines', null],
    ['scene.lines', { n: 2, extra: 1 }],
    ['scene.lines', { lines: 2 }],
    ['scene.lines', Object.assign(Object.create({ inherited: 1 }), { n: 2 })],
    ['scene.step', { step: 'take3', state: 'done' }],
    ['scene.step', { step: 'take2', state: 'skipped' }],
    ['scene.step', { step: 'take2', state: true }],
    ['scene.step', { step: 'take2', done: true }],
    ['scene.step', { step: 'toString', state: 'done' }],
    ['scene.step', { step: ['take2'], state: 'done' }],
    ['scene.step', { step: 'take2' }],
    ['scene.step', { state: 'wait' }],
    ['scene.step', {}],
    ['scene.step', { step: 'take2', state: 'done', extra: 1 }],
    ['scene.step', { step: 'take2', state: 'done', n: 1 }],
    ['scene.step', Object.assign(Object.create(null), { step: 'take2', state: 'done' })],
  ];
  for (const lang of LANGS)
    for (const speaker of ['default', 'fan'])
      for (const [code, slots] of bad)
        assert.equal(
          render({ code, slots }, { lang, speaker }),
          null,
          `${lang} ${speaker} ${code} ${JSON.stringify(slots)}`,
        );
});

test('장면 사실 — 팬 줄은 다른 눈높이에서 standard의 fan으로 물러서고, 다른 말하는 사람은 default로, 이름은 찾지 않는다', () => {
  const lines = { code: 'scene.lines', slots: { n: 4 } };
  const wait = { code: 'scene.step', slots: { step: 'transfer', state: 'wait' } };
  for (const lang of LANGS) {
    const fan = render(wait, { lang, speaker: 'fan' });
    const plain = render(wait, { lang });
    for (const level of ['word', 'easy', 'standard', 'constructor']) {
      assert.equal(render(wait, { lang, level, speaker: 'fan' }), fan, `${lang} ${level} fan`);
      assert.equal(render(wait, { lang, level }), plain, `${lang} ${level} default`);
      assert.equal(
        render(lines, { lang, level, speaker: 'fan' }),
        render(lines, { lang }),
        `${lang} ${level} 줄 수`,
      );
    }
    for (const speaker of ['marin', 'kkamong', 'mongle', 'caller'])
      assert.equal(render(wait, { lang, speaker }), plain, `${lang} ${speaker}`);
    // 이름 없는 종류(NAMELESS) — 이름표가 null을 돌려줘도 짓고, 가리키는 것이 없다
    assert.equal(render(wait, { lang, speaker: 'fan', label: () => null }), fan);
  }
  for (const why of [lines, wait]) {
    assert.equal(subjectOf({ ...why, slots: { ...why.slots, unit: 'u' } }), null, why.code);
  }
  // 다른 종류에는 fan 줄이 없다 — default로 물러선다
  assert.equal(
    render({ code: 'idle', slots: {} }, { speaker: 'fan' }),
    render({ code: 'idle', slots: {} }),
  );
  // 진도의 사실 쪽 이름이다 — 고르기의 이유 종류가 아니다
  assert.equal(PROGRESS_CODES.lines, 'scene.lines');
  assert.equal(PROGRESS_CODES.step, 'scene.step');
  for (const code of ['scene.lines', 'scene.step'])
    assert.ok(!Object.values(REASON_CODES).includes(code), code);
  assert.deepEqual(
    Object.keys(SCENE_SLOTS).sort(),
    Object.values(PROGRESS_CODES)
      .filter(c => c.startsWith('scene.'))
      .sort(),
  );
});

test('장면 사실 — 세 언어 · 두 말하는 사람 줄이 칸 표(SCENE_SLOTS)의 칸을 빠짐없이, 그 칸만 쓴다', () => {
  const tables = { ko: KO, en: EN, mn: MN };
  let lines = 0;
  for (const [code, table] of Object.entries(SCENE_SLOTS)) {
    const names = Object.keys(table).sort();
    for (const sample of samplesOf(table))
      for (const lang of LANGS)
        for (const speaker of ['default', 'fan']) {
          const list = tables[lang][code]?.standard?.[speaker];
          assert.ok(
            Array.isArray(list) && list.length === 1,
            `${lang} ${code} ${speaker}: 줄이 하나`,
          );
          const used = new Set();
          const slots = new Proxy(sample, {
            get(target, key) {
              if (typeof key === 'string') used.add(key);
              return target[key];
            },
          });
          const line = list[0](slots, '', josa);
          assert.deepEqual([...used].sort(), names, `${lang} ${code} ${speaker}: 읽은 칸`);
          assert.equal(render({ code, slots: sample }, { lang, speaker }), line);
          lines += 1;
        }
  }
  assert.equal(lines, 3 * 2 * (3 + 4));
});
