import test from 'node:test';
import assert from 'node:assert/strict';
import { ZODIAC, WESTERN_ZODIAC, FORTUNE_MODES, getSigns, seoulDateKey, displayDate, millisecondsUntilNextSeoulDay, getFortune, fortuneText } from '../core.mjs';

test('서울 자정 직전과 직후를 호스트 시간대와 무관하게 나눈다', () => {
  assert.equal(seoulDateKey('2026-10-06T14:59:59.999Z'), '2026-10-06');
  assert.equal(seoulDateKey('2026-10-06T15:00:00.000Z'), '2026-10-07');
  assert.equal(seoulDateKey('2026-12-31T15:00:00.000Z'), '2027-01-01');
  assert.equal(millisecondsUntilNextSeoulDay('2026-10-06T14:59:59.999Z'), 1);
  assert.equal(millisecondsUntilNextSeoulDay('2026-10-06T15:00:00.000Z'), 86_400_000);
  assert.match(displayDate('2026-10-06'), /10월 6일 화요일/);
});

test('12띠와 12별자리 모두 같은 날짜에 같은 결과를 반환하고 이튿날 총운을 바꾼다', () => {
  assert.deepEqual(FORTUNE_MODES.map(mode => mode.id), ['korean', 'western']);
  assert.equal(getSigns(), ZODIAC);
  assert.equal(getSigns('western'), WESTERN_ZODIAC);
  for (const mode of FORTUNE_MODES) {
    const signs = getSigns(mode.id);
    assert.equal(signs.length, 12);
    assert.equal(new Set(signs.map(sign => sign.id)).size, 12);
    for (const sign of signs) {
      const fortune = getFortune(sign.id, '2026-10-06', mode.id);
      assert.deepEqual(fortune, getFortune(sign.id, '2026-10-06', mode.id));
      assert.notEqual(fortune.title, getFortune(sign.id, '2026-10-07', mode.id).title);
      assert.equal(fortune.signLabel, sign.label);
      assert.equal(fortune.mode, mode.id);
      assert.equal(fortune.modeLabel, mode.id === 'korean' ? '한국 운세 · 띠별' : mode.label);
      for (const field of ['overall', 'relationship', 'focus', 'action', 'color']) assert.ok(fortune[field].length > 2, field);
      assert.ok(fortune.number >= 1 && fortune.number <= 9);
      assert.equal(Object.isFrozen(fortune), true);
    }
  }
});

test('방식 인자를 생략한 기존 호출과 한국 운세 결과를 보존한다', () => {
  const fortune = getFortune('rat', '2026-10-06');
  assert.deepEqual(fortune, getFortune('rat', '2026-10-06', 'korean'));
  assert.equal(fortune.title, '새로운 순서를 시도하는 날');
  assert.equal(fortune.overall, '익숙한 일의 순서를 조금 바꿔 보세요. 나에게 더 편한 방법을 찾는 작은 실험이면 충분해요.');
  assert.equal(fortune.relationship, '친숙한 사람에게도 새로운 질문 하나를 던져 보세요. 요즘 즐기는 것부터 물어봐도 좋아요.');
  assert.equal(fortune.focus, '오늘 잘 맞았던 방법 하나를 기억해 두세요. 내일도 써 보고 싶은 작은 요령이면 좋아요.');
  assert.equal(fortune.action, '읽고 싶었던 책의 첫 페이지를 펼쳐 보세요.');
  assert.equal(fortune.color, '버터 옐로');
  assert.equal(fortune.number, 1);
});

test('별자리 운세의 총운·관계·집중은 한국 운세와 별도 내용이다', () => {
  for (const date of ['2026-10-06', '2026-12-31', '2028-02-29']) {
    const korean = ZODIAC.map(sign => getFortune(sign.id, date));
    for (const sign of WESTERN_ZODIAC) {
      const western = getFortune(sign.id, date, 'western');
      for (const field of ['title', 'overall', 'relationship', 'focus']) {
        assert.ok(korean.every(fortune => fortune[field] !== western[field]), `${sign.id}: ${field}`);
      }
    }
  }
});

test('별자리 선택에는 영문명과 윤일·연말까지 빠짐없이 이어지는 일반 생일 구간이 있다', () => {
  const coverage = new Map();
  for (const sign of WESTERN_ZODIAC) {
    assert.match(sign.english, /^[A-Z][a-z]+$/);
    assert.match(sign.range, /^\d{1,2}\.\d{1,2}–\d{1,2}\.\d{1,2}$/);
    const [[startMonth, startDay], [endMonth, endDay]] = sign.range.split('–').map(part => part.split('.').map(Number));
    const start = startMonth * 100 + startDay;
    const end = endMonth * 100 + endDay;
    for (let day = Date.UTC(2028, 0, 1); day < Date.UTC(2029, 0, 1); day += 86_400_000) {
      const date = new Date(day);
      const key = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
      const belongs = start <= end ? key >= start && key <= end : key >= start || key <= end;
      if (belongs) {
        assert.equal(coverage.has(key), false, `중복 생일 구간: ${key}`);
        coverage.set(key, sign.id);
      }
    }
  }
  assert.equal(coverage.size, 366);
  assert.equal(coverage.get(229), 'pisces');
  assert.equal(coverage.get(1231), 'capricorn');
  assert.equal(coverage.get(101), 'capricorn');
});

test('월말, 연말, 윤일에 유효한 결과를 만들고 없는 날짜와 띠를 거부한다', () => {
  for (const day of ['2026-10-31', '2026-11-01', '2026-12-31', '2027-01-01', '2028-02-29']) assert.equal(getFortune('rat', day).date, day);
  for (const day of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-00-10', '06-10-2026', '', null, '2026-10-06<script>']) assert.throws(() => getFortune('rat', day), TypeError);
  for (const sign of ['unknown', 'constructor', '__proto__', '', null, 0]) assert.throws(() => getFortune(sign, '2026-10-06'), TypeError);
  for (const mode of ['unknown', 'constructor', '__proto__', '', null, 0]) {
    assert.throws(() => getSigns(mode), TypeError);
    assert.throws(() => getFortune('rat', '2026-10-06', mode), TypeError);
  }
  assert.throws(() => getFortune('aries', '2026-10-06', 'korean'), TypeError);
  assert.throws(() => getFortune('rat', '2026-10-06', 'western'), TypeError);
  assert.throws(() => getFortune('aries', '2026-02-29', 'western'), TypeError);
});

test('복사 글은 운세 방식·날짜·선택·모든 결과와 각 방식의 설명을 포함한다', () => {
  for (const [sign, mode] of [['rabbit', 'korean'], ['aries', 'western']]) {
    const fortune = getFortune(sign, '2026-10-06', mode);
    const text = fortuneText(fortune);
    for (const value of [fortune.modeLabel, fortune.date, fortune.signLabel, fortune.title, fortune.overall, fortune.relationship, fortune.focus, fortune.action, fortune.color, String(fortune.number)]) assert.ok(text.includes(value));
    assert.match(text, /미래를 예측하지 않아요/);
    assert.match(text, mode === 'western' ? /정밀 천체 계산을 하지 않아요/ : /사주는 아니에요/);
  }
});
