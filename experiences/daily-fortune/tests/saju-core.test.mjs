import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getSaju, sajuText, SAJU_CONVENTION } from '../saju-core.mjs';

const today = '2026-10-06';
const result = (birthDate, birthTime = null) => getSaju({ birthDate, birthTime }, today);
const pairs = value => value.pillars.map(item => item.known ? item.hanja : null);

// Upstream MIT test fixtures, pinned npm 1.7.7 source:
// https://github.com/6tail/lunar-javascript/blob/eecd5d12c8221b82ce574dc2bad2d7aefcb46e56/__tests__/EightChar.test.js
test('공식 만세력 사례의 네 기둥과 천간·지지 오행을 재현한다', () => {
  const value = result('2005-12-23', '08:37');
  assert.deepEqual(pairs(value), ['乙酉', '戊子', '辛巳', '壬辰']);
  assert.deepEqual(value.pillars.map(item => item.hangul), ['을유', '무자', '신사', '임진']);
  assert.deepEqual(value.dayMaster, { hanja: '辛', hangul: '신', element: '금' });
  assert.deepEqual(value.elements.map(item => [item.label, item.count]), [['목', 1], ['화', 1], ['토', 2], ['금', 2], ['수', 2]]);
  assert.deepEqual(pairs(result('1988-02-02', '22:30')), ['丁卯', '癸丑', '丁亥', '辛亥']);
  assert.equal(value.modeLabel, '한국 사주');
  assert.equal(value.color, undefined);
  assert.equal(value.number, undefined);
});

test('23시는 자시지만 일주는 자정에 바꾸며 야자시의 시간천간 규칙을 지킨다', () => {
  assert.deepEqual(pairs(result('1988-02-15', '22:59')), ['戊辰', '甲寅', '庚子', '丁亥']);
  assert.deepEqual(pairs(result('1988-02-15', '23:00')), ['戊辰', '甲寅', '庚子', '戊子']);
  assert.deepEqual(pairs(result('1988-02-15', '23:59')), ['戊辰', '甲寅', '庚子', '戊子']);
  assert.deepEqual(pairs(result('1988-02-16', '00:00')), ['戊辰', '甲寅', '辛丑', '戊子']);
  assert.equal(SAJU_CONVENTION.sect, 2);
  assert.equal(SAJU_CONVENTION.dayBoundary, '00:00');
});

// Independent Korean standard-time reference: KASI, 2024 Korean Astronomical Almanac.
// https://astro.kasi.re.kr/file/astro_almanac_pdf/20231023135218580.pdf
// PDF p.8 (1-based): 입춘 2/4 17:27, 경칩 3/5 11:23, 청명 4/4 16:02, 입하 5/5 09:10.
// Minute-rounded reference; fixture inputs are a minute before/after, not the boundary minute.
test('한국천문연구원 입춘 전후의 한국시각에 연주·월주를 함께 바꾼다', () => {
  const early = result('2024-02-04', '16:40');
  const before = result('2024-02-04', '17:26');
  const after = result('2024-02-04', '17:28');
  assert.deepEqual(pairs(early).slice(0, 2), ['癸卯', '乙丑']); // must not change at UTC+8's 16:27
  assert.deepEqual(pairs(before).slice(0, 2), ['癸卯', '乙丑']);
  assert.deepEqual(pairs(after).slice(0, 2), ['甲辰', '丙寅']);
  assert.equal(before.pillars[2].hanja, '戊戌');
  assert.equal(after.pillars[2].hanja, '戊戌');
});

test('KASI 경칩·청명·입하 전후에 절기 월주만 바꾼다', () => {
  for (const [date, before, after, monthBefore, monthAfter] of [
    ['2024-03-05', '11:22', '11:24', '丙寅', '丁卯'],
    ['2024-04-04', '16:01', '16:03', '丁卯', '戊辰'],
    ['2024-05-05', '09:09', '09:11', '戊辰', '己巳'],
  ]) {
    const a = result(date, before);
    const b = result(date, after);
    assert.equal(a.pillars[0].hanja, '甲辰');
    assert.equal(b.pillars[0].hanja, '甲辰');
    assert.equal(a.pillars[1].hanja, monthBefore);
    assert.equal(b.pillars[1].hanja, monthAfter);
    assert.equal(a.pillars[2].hanja, b.pillars[2].hanja);
  }
});

// Same KASI PDF p.14 (1-based): February daily sexagenary cycle, including leap day.
test('KASI 2024년 2월 일진표와 윤일의 일주가 일치한다', () => {
  for (const [date, dayPillar] of [['2024-02-01', '乙未'], ['2024-02-04', '戊戌'], ['2024-02-10', '甲辰'], ['2024-02-29', '癸亥']]) {
    assert.equal(result(date, '12:00').pillars[2].hanja, dayPillar);
  }
});

test('시간 모름은 시주를 꾸며내지 않고 알려진 여섯 글자만 센다', () => {
  const value = result('2005-12-23');
  assert.deepEqual(pairs(value), ['乙酉', '戊子', '辛巳', null]);
  assert.equal(value.timeKnown, false);
  assert.equal(value.birthTime, null);
  assert.equal(value.pillars[3].stem, null);
  assert.equal(value.pillars[3].branch, null);
  assert.equal(value.elements.reduce((total, item) => total + item.count, 0), 6);
  assert.equal(value.pillars[2].hanja, result('2005-12-23', '23:59').pillars[2].hanja);
});

test('출생 시간 없는 절입 당일은 연·월주 중 결정할 수 없는 기둥도 유보한다', () => {
  const spring = result('2024-02-04');
  assert.deepEqual(pairs(spring), [null, null, '戊戌', null]);
  assert.equal(spring.elements.reduce((total, item) => total + item.count, 0), 2);
  assert.match(spring.notes.join(' '), /연주를 확정할 수 없어요/);
  assert.match(spring.notes.join(' '), /월주를 확정할 수 없어요/);
  const march = result('2024-03-05');
  assert.equal(march.pillars[0].known, true);
  assert.equal(march.pillars[1].known, false);
  assert.equal(march.elements.reduce((total, item) => total + item.count, 0), 4);
});

test('날짜·시간·지원 연도·미래 출생 입력을 거부한다', () => {
  for (const value of [null, [], '', 0, {}, { birthDate: '2023-02-29' }, { birthDate: '2000-13-01' }, { birthDate: '1899-12-31' }, { birthDate: '2026-10-07' }]) {
    assert.throws(() => getSaju(value, today));
  }
  for (const birthTime of ['24:00', '12:60', '8:00', '00:00:00', '', 0, {}, '<script>']) assert.throws(() => result('2000-01-01', birthTime), TypeError);
  assert.equal(result('1900-01-01', '00:00').pillars.length, 4);
  assert.throws(() => getSaju({ birthDate: '2000-01-01' }, '2101-01-01'), RangeError);
});

test('오늘이 달라져도 출생 사주는 유지하고 오늘의 일진만 갱신한다', () => {
  const a = result('2005-12-23', '08:37');
  const b = getSaju({ birthDate: '2005-12-23', birthTime: '08:37' }, '2026-10-07');
  assert.deepEqual(a, result('2005-12-23', '08:37'));
  assert.deepEqual(a.pillars, b.pillars);
  assert.deepEqual(a.elements, b.elements);
  assert.notEqual(a.todayPillar.hanja, b.todayPillar.hanja);
  assert.notEqual(a.title, b.title);
  assert.equal(Object.isFrozen(a.pillars[0].stem), true);
  assert.match(a.notes.join(' '), /지장간·합충·신강신약·용신·대운/);
});

test('복사문에 계산값·불확실성·관례를 포함하고 원본 생년월일·시각은 싣지 않는다', () => {
  const a = result('2005-12-23', '08:37');
  const text = sajuText(a);
  for (const value of [a.date, a.title, '辛巳', '일간', '겉글자 오행', 'UTC+9', '00시', '23시', '미래의 길흉']) assert.ok(text.includes(value), value);
  assert.equal(text.includes('2005-12-23'), false);
  assert.equal(text.includes('08:37'), false);
  assert.match(sajuText(result('2024-02-04')), /연주 \| 미확정/);
});

test('호스트 시간대가 서울·UTC·뉴욕이어도 동일한 한국시각 사주를 계산한다', () => {
  const moduleUrl = new URL('../saju-core.mjs', import.meta.url).href;
  const code = `import {getSaju} from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify(getSaju({birthDate:'2024-02-04',birthTime:'17:28'},'2026-10-06')))`;
  const outputs = ['Asia/Seoul', 'UTC', 'America/New_York'].map(TZ => execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TZ }, encoding: 'utf8', timeout: 10_000,
  }));
  assert.equal(outputs[0], outputs[1]);
  assert.equal(outputs[0], outputs[2]);
});

test('고정한 MIT 공급자 원본과 ESM 변환 해시를 확인한다', () => {
  const directory = new URL('../vendor/lunar-javascript-1.7.7/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('provenance.json', directory), 'utf8'));
  const module = readFileSync(new URL('lunar.mjs', directory));
  assert.equal(createHash('sha256').update(module).digest('hex'), provenance.esmSha256);
  const original = module.subarray(Buffer.byteLength(provenance.transformation.prepend), module.length - Buffer.byteLength(provenance.transformation.append));
  assert.equal(createHash('sha256').update(original).digest('hex'), provenance.originalSha256);
  assert.equal(provenance.version, '1.7.7');
  assert.match(readFileSync(new URL('LICENSE', directory), 'utf8'), /MIT License/);
});
