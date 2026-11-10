'use strict';
// LAB 계정 · 나라 · 칸별 숫자 절(tools/lib/게시성과나라.js — 2026-11-10 LAB 하루 두 편 설계 7). 가짜 장부 · 원장만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const 나라 = require('../tools/lib/게시성과나라.js');

const NOW = Date.parse('2026-11-20T12:00:00+09:00');
const acct = (extra) => ({ brand: 'LAB', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'], ...extra });
const accounts = {
  'lab-instagram': acct({ platform: 'instagram', countryCode: 'MN', language: 'mn', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'], rotationSeed: true, metricsRoute: 'server', metricsState: 'reading' }),
  'lab-us-youtube': acct({ platform: 'youtube', countryCode: 'US', language: 'en', timeZone: 'America/New_York', dailyFrom: '미정', metricsRoute: 'server', metricsState: 'unconfirmed' }),
  'lab-youtube': acct({ platform: 'youtube', audience: 'global', language: 'en', timeZone: 'Asia/Seoul', rotationSeed: true, metricsRoute: 'server', metricsState: 'reading' }),
  'lab-ru-rutube': acct({ platform: 'rutube', countryCode: 'RU', language: 'ru', timeZone: 'Europe/Moscow', dailyFrom: '미정', metricsRoute: 'screen-only', metricsState: 'missing' }),
  'lab-uz-telegram': { brand: 'LAB', platform: 'telegram', countryCode: 'UZ', language: 'uz', timeZone: 'Asia/Tashkent', dailyTimes: ['21:00'], dailyFormats: ['퀴즈'], dailyFrom: '미정', metricsRoute: 'public-page', metricsState: 'missing' },
  'synkbrief-youtube': { brand: 'synkbrief', platform: 'youtube' },
};
const row = (post, account, point, views, publishedAt, at = '2026-11-19T00:00:00Z') => ({ kind: '판정', post, account, point, publishedAt, at, metrics: { views } });
const ledger = [
  // 몽골 인스타: 21:00 KST(현지 20:00 퀴즈 칸) 두 판, 13:00 KST(현지 12:00 이야기 칸) 한 판
  row('ig:1', 'lab-instagram', '24h', 1000, '2026-11-15T21:00:00+09:00'), row('ig:1', 'lab-instagram', '72h', 2400, '2026-11-15T21:00:00+09:00'),
  row('ig:2', 'lab-instagram', '24h', 3000, '2026-11-16T21:00:00+09:00'),
  row('ig:3', 'lab-instagram', '24h', 500, '2026-11-16T13:00:00+09:00'),
  // 같은 게시물 · 같은 시점의 옛 줄은 늦게 적힌 줄이 이긴다
  row('ig:3', 'lab-instagram', '24h', 400, '2026-11-16T13:00:00+09:00', '2026-11-17T00:00:00Z'),
  // 오래된 판(21일 밖) · 조회가 없는 줄 · 화면 읽기 줄은 세지 않는다
  row('ig:0', 'lab-instagram', '24h', 99999, '2026-10-01T21:00:00+09:00'),
  { kind: '판정', post: 'yt:1', account: 'lab-youtube', point: '24h', publishedAt: '2026-11-18T21:00:00+09:00', at: '2026-11-19T22:00:00Z', metrics: {} },
  { kind: '화면', post: 'ig:1', account: 'lab-instagram' },
];

test('계정 · 칸마다 같은 나이끼리 중앙값 — 숫자가 없으면 0이 아니라 빈칸, 결측 까닭을 적는다', () => {
  const rows = 나라.줄들({ ledger, accounts, now: NOW });
  assert.equal(rows.some((r) => r.key === 'synkbrief-youtube'), false, 'LAB 돌림 계정만');
  const ig = rows.filter((r) => r.key === 'lab-instagram');
  assert.deepEqual(ig.map((r) => [r.slot, r.v24, r.v72]), [['12:00 이야기', [500], []], ['20:00 퀴즈', [1000, 3000], [2400]]]);
  assert.equal(rows.find((r) => r.key === 'lab-youtube').country, '전 세계');
  assert.equal(rows.filter((r) => r.key === 'lab-uz-telegram').length, 1, '텔레그램은 칸 하나');
  const text = 나라.절({ ledger, accounts, now: NOW }).join('\n');
  assert.match(text, /^## LAB 계정 · 나라 · 칸별\(최근 21일 · 같은 나이끼리\)$/m);
  assert.match(text, /LAB 5계정 가운데 숫자가 있는 계정 1\./);
  assert.match(text, /^\| MN · 씨앗 \| instagram \| lab-instagram \| mn \| 20:00 퀴즈 \| 2,000 \(2\) \| 2,400 \(1\) \| 읽힘 \|$/m);
  assert.match(text, /^\| MN · 씨앗 \| instagram \| lab-instagram \| mn \| 12:00 이야기 \| 500 \(1\) \| — \| 읽힘 \|$/m);
  // 숫자가 없는 계정은 표에 줄을 늘리지 않고 까닭마다 한 줄로 모은다
  assert.doesNotMatch(text, /^\| US \|/m);
  assert.match(text, /^- 시작 전 · 확인 전\(첫 게시 뒤\) — 서버 수집 1곳: lab-us-youtube\(US\)$/m);
  assert.match(text, /^- 시작 전 · 결측 — 화면에서만 1곳: lab-ru-rutube\(RU\)$/m);
  assert.match(text, /^- 시작 전 · 결측 — 공개 페이지\(수집기 없음\) 1곳: lab-uz-telegram\(UZ\)$/m);
  assert.match(text, /^- 읽힘\(최근 판 없음\) 1곳: lab-youtube\(전 세계\)$/m);
  assert.doesNotMatch(text, /\| 0 \(/, '숫자가 없는 칸을 0으로 적지 않는다');
});

test('LAB 돌림 계정이 없으면 절을 내지 않는다 · 중앙값', () => {
  assert.deepEqual(나라.절({ ledger, accounts: { 'synkbrief-youtube': { brand: 'synkbrief' } }, now: NOW }), []);
  assert.equal(나라.median([]), null);
  assert.equal(나라.median([3, 1, 2]), 2);
  assert.equal(나라.median([1, 2, 3, 10]), 3);
});
