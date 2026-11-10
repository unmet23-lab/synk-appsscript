'use strict';
// 계정 시간대 · 하루 칸(tools/lib/계정시간.js) — 11-11 Fable 5.2 끝 판 검수 P2-12(칸 고르기 선택 인자) · P2-13(원장 꼴 검사).
// 기본 셈(현지 날짜 · 칸 · 칸 이름)은 tests/돌림표.test.js 「계정 시간대」 · 「계정 칸」이 본다. 가짜 원장만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../tools/lib/계정시간.js');

const OPTS = { 돌아서: true, 열린칸만: true };
// 한국 시각 씨앗 유튜브 — 13:00 칸은 아직 닫힘(dailyTimesFrom 「미정」), 21:00 노래 칸만
const seoul = { brand: 'LAB', timeZone: 'Asia/Seoul', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '노래'], dailyTimesFrom: '미정' };
const seoulOpen = { ...seoul, dailyTimesFrom: '2026-11-01' };

test('slotFor 기본 셈은 그대로 — 자정을 넘긴 판도 그날 칸 가운데 가까운 칸(돌림 · 게시 장부 · 올리기 전 검사의 칸 열쇠)', () => {
  // 한국 01:55 — 그날 13:00(11시간 5분 뒤)이 21:00(19시간 5분 뒤)보다 가깝다. 닫힌 칸도 가리지 않는다
  assert.equal(T.slotFor('2026-10-26T01:55:02+09:00', seoul).time, '13:00');
  assert.equal(T.slotFor('2026-10-26T01:55:02+09:00', seoul, {}).time, '13:00', '빈 선택 인자는 기본 셈');
  assert.equal(T.slotFor('2026-10-26T01:55:02+09:00', seoul, { 돌아서: false, 열린칸만: false }).time, '13:00');
  assert.equal(T.slotFor('2026-11-17T13:05:00+09:00', seoul).time, '13:00');
});

test('돌아서 — 자정을 넘긴 새벽 판은 앞 날 마지막 칸, 그 칸의 현지 날짜는 앞 날', () => {
  assert.equal(T.slotFor('2026-10-26T01:55:02+09:00', seoulOpen, { 돌아서: true }).time, '21:00');
  assert.deepEqual(T.slotAt('2026-10-26T01:55:02+09:00', seoulOpen, { 돌아서: true }), { slot: { time: '21:00', format: '노래' }, day: '2026-10-25' });
  // 03:08도 앞 날 21:00(6시간 8분 전)이 그날 13:00(9시간 52분 뒤)보다 가깝다
  assert.deepEqual(T.slotAt('2026-11-02T03:08:08+09:00', seoulOpen, { 돌아서: true }), { slot: { time: '21:00', format: '노래' }, day: '2026-11-01' });
  // 낮 판은 그날 칸 그대로
  assert.deepEqual(T.slotAt('2026-11-17T13:05:00+09:00', seoulOpen, { 돌아서: true }), { slot: { time: '13:00', format: '이야기' }, day: '2026-11-17' });
  // 다음 날 쪽으로도 — 00:30 칸이 있는 계정의 23:50 판은 다음 날 00:30 칸
  const late = { timeZone: 'Asia/Seoul', dailyTimes: ['00:30', '12:00'], dailyFormats: ['이야기', '노래'] };
  assert.deepEqual(T.slotAt('2026-11-17T23:50:00+09:00', late, { 돌아서: true }), { slot: { time: '00:30', format: '이야기' }, day: '2026-11-18' });
  // 같은 거리(한가운데 17:00)는 늦은 칸 — 기본 셈과 같다
  assert.equal(T.slotFor('2026-11-17T17:00:00+09:00', seoulOpen, OPTS).time, T.slotFor('2026-11-17T17:00:00+09:00', seoulOpen).time);
  // 다른 시간대 — 울란바토르 00:40(한국 01:40)은 앞 날 20:00 칸
  const mn = { timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'], dailyFormats: ['이야기', '노래'] };
  assert.deepEqual(T.slotAt('2026-11-14T01:40:00+09:00', mn, OPTS), { slot: { time: '20:00', format: '노래' }, day: '2026-11-13' });
});

test('열린칸만 — 그날 안 열린 칸(dailyTimesFrom · dailyFormatsFrom 앞)으로 세지 않고, 고를 칸이 없으면 열림을 안 본다', () => {
  // 13:00 칸이 닫힌 날의 낮 판은 그날 21:00 칸
  assert.deepEqual(T.slotAt('2026-11-17T13:05:00+09:00', seoul, OPTS), { slot: { time: '21:00', format: '노래' }, day: '2026-11-17' });
  // 앞 칸이 열리는 날(dailyTimesFrom)부터는 13:00 칸
  const mn = { timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'], dailyFormats: ['이야기', '노래'], dailyTimesFrom: '2026-11-13' };
  assert.equal(T.slotFor('2026-11-12T13:00:00+09:00', mn, OPTS).time, '20:00', '11-12 현지 12:00 — 앞 칸 닫힘');
  assert.equal(T.slotFor('2026-11-13T13:00:00+09:00', mn, OPTS).time, '12:00', '11-13 현지 12:00 — 앞 칸 열림');
  // 형식마다 여는 날 — 노래 칸이 닫힌 나라별 계정의 밤 판은 13:00 이야기 칸
  const country = { timeZone: 'Asia/Bangkok', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '노래'], dailyFrom: '2026-11-12', dailyFormatsFrom: { 노래: '미정' } };
  assert.equal(T.slotFor('2026-11-15T23:00:00+09:00', country, OPTS).time, '13:00', '방콕 21:00 — 노래 칸 닫힘');
  assert.equal(T.slotFor('2026-11-15T23:00:00+09:00', country).time, '21:00', '기본 셈은 닫힌 칸도 고른다');
  // 줄이 아직 안 열린 날(dailyFrom 앞) — 열린 칸이 없으니 가장 가까운 칸
  assert.equal(T.slotFor('2026-11-10T23:00:00+09:00', country, OPTS).time, '21:00');
  assert.equal(T.slotFor('2026-11-10T23:00:00+09:00', { ...country, dailyFrom: '미정' }, OPTS).time, '21:00');
});

test('slotAt — 시각을 못 읽거나 칸에 시각이 없으면 맨 끝 칸', () => {
  assert.deepEqual(T.slotAt('', seoul, OPTS), { slot: { time: '21:00', format: '노래' }, day: null });
  assert.deepEqual(T.slotAt('아님', seoul, OPTS), { slot: { time: '21:00', format: '노래' }, day: null });
  assert.equal(T.slotFor(null, seoul, OPTS).time, '21:00');
  assert.deepEqual(T.slotAt('2026-11-17T13:05:00+09:00', { dailyFormats: ['노래'] }, OPTS), { slot: { time: null, format: '노래' }, day: '2026-11-17' });
  // 칸이 하나뿐이면 그 칸 — 날짜만 돌아선다
  const tg = { timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['20:00'], dailyFormats: ['노래'] };
  assert.deepEqual(T.slotAt('2026-11-14T01:40:00+09:00', tg, OPTS), { slot: { time: '20:00', format: '노래' }, day: '2026-11-13' });
});

test('원장 꼴 검사 — 여는 날 · 형식 열쇠 · 칸 시각 · 형식 길이 · 시간대(fxE 재현 꼴)', () => {
  const ok = { brand: 'LAB', platform: 'youtube', timeZone: 'Asia/Bangkok', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '노래'], dailyFrom: '2026-11-12', dailyTimesFrom: '미정', dailyFormatsFrom: { 노래: '미정' } };
  assert.deepEqual(T.checkAccount('lab-th-youtube', ok), []);
  assert.deepEqual(T.checkAccount('lab-th-youtube', { ...ok, dailyFormatsFrom: { 노래: '2026-11-20' }, dailyFrom: '미정' }), []);
  // fxE — 「2026-11-3」이면 칸 0, 열쇠 「노래 」면 노래 칸이 열리는데 종료 0이었다
  const fxE = { ...ok, dailyFrom: '2026-11-3', dailyFormatsFrom: { '노래 ': '미정' } };
  const got = T.checkAccount('lab-x-youtube', fxE);
  assert.equal(got.length, 2, got.join('\n'));
  assert.match(got[0], /^lab-x-youtube: dailyFrom 「2026-11-3」/);
  assert.match(got[1], /^lab-x-youtube: dailyFormatsFrom 열쇠 「노래 」\("노래 " — 앞뒤 빈칸\)/);
  // 하나씩
  const one = (extra) => T.checkAccount('k', { ...ok, ...extra });
  assert.match(one({ dailyFrom: '2026-02-30' }).join(), /dailyFrom 「2026-02-30」/, '없는 날짜');
  assert.match(one({ dailyFrom: '' }).join(), /dailyFrom 「」/);
  assert.match(one({ dailyFrom: null }).join(), /dailyFrom null/);
  assert.match(one({ dailyTimesFrom: 'TBD' }).join(), /dailyTimesFrom 「TBD」/);
  assert.match(one({ dailyFormatsFrom: { 노래: '2026/11/20' } }).join(), /dailyFormatsFrom\.노래 「2026\/11\/20」/);
  assert.match(one({ dailyFormatsFrom: { 퀴즈: '미정' } }).join(), /열쇠 「퀴즈」 — 이 계정 dailyFormats\(이야기 · 노래\)에 없는/);
  assert.match(one({ dailyFormatsFrom: ['노래'] }).join(), /dailyFormatsFrom \["노래"\]/);
  assert.match(one({ dailyTimes: ['9:00', '21:00'] }).join(), /dailyTimes 「9:00」 — 「HH:MM」/);
  assert.match(one({ dailyTimes: ['13:00', '24:00'] }).join(), /dailyTimes 「24:00」/);
  assert.match(one({ dailyTimes: ['21:00', '13:00'] }).join(), /이른 것부터 겹치지 않게/);
  assert.match(one({ dailyTimes: '13:00' }).join(), /dailyTimes 「13:00」 — 「HH:MM」 현지 시각 목록/);
  assert.match(one({ dailyFormats: ['노래'] }).join(), /dailyFormats 1개 · dailyTimes 2개/);
  assert.match(one({ dailyFormats: ['이야기', '노래 '] }).join(), /dailyFormats 「노래 」/);
  assert.match(one({ dailyFormats: undefined }).join(), /dailyFormats undefined — dailyTimes와 같은 순서/);
  assert.match(one({ timeZone: 'Asia/Seol' }).join(), /timeZone 「Asia\/Seol」 — Intl이 모르는/);
  assert.match(one({ timeZone: '' }).join(), /timeZone 「」/);
  // 시간대가 없으면 한국 시각(옛 계정) — 문제 아님 · LAB이 아니거나 dailyTimes가 없는 계정은 안 본다
  assert.deepEqual(one({ timeZone: undefined }), []);
  assert.deepEqual(T.checkAccount('synkbrief-youtube', { brand: 'synkbrief', dailyFrom: '2026-11-3' }), []);
  assert.deepEqual(T.checkAccount('lab-old', { brand: 'LAB', dailyFrom: '2026-11-3' }), []);
  assert.deepEqual(T.checkAccount('x', null), []);
});

test('checkLedger — 원장 accounts 전체의 문제를 모으고, 깨끗하면 빈 목록', () => {
  const accounts = {
    'lab-instagram': { brand: 'LAB', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'], dailyFormats: ['이야기', '노래'], dailyTimesFrom: '2026-11-13' },
    'lab-telegram': { brand: 'LAB', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['20:00'], dailyFormats: ['노래'] },
    'lab-x-youtube': { brand: 'LAB', timeZone: 'Asia/Seoul', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '노래'], dailyFrom: '2026-11-3', dailyFormatsFrom: { '노래 ': '미정' } },
    'lab-y-tiktok': { brand: 'LAB', timeZone: 'Mars/Olympus', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '노래'] },
    'synkbrief-youtube': { brand: 'synkbrief' },
  };
  const got = T.checkLedger(accounts);
  assert.equal(got.length, 3, got.join('\n'));
  assert.deepEqual(got.map((s) => s.split(':')[0]), ['lab-x-youtube', 'lab-x-youtube', 'lab-y-tiktok']);
  assert.deepEqual(T.checkLedger({ 'lab-instagram': accounts['lab-instagram'], 'lab-telegram': accounts['lab-telegram'] }), []);
  assert.deepEqual(T.checkLedger({}), []);
  assert.equal(T.checkLedger(null).length, 1);
  assert.equal(T.checkLedger([]).length, 1);
});
