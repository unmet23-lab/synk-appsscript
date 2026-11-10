'use strict';
// LAB 계정 · 나라 · 칸별 숫자 절(tools/lib/게시성과나라.js — 2026-11-10 LAB 하루 두 편 설계 7). 가짜 장부 · 원장만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const 나라 = require('../tools/lib/게시성과나라.js');

const NOW = Date.parse('2026-11-20T12:00:00+09:00');
const acct = (extra) => ({ brand: 'LAB', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '노래'], ...extra });
const accounts = {
  'lab-instagram': acct({ platform: 'instagram', countryCode: 'MN', language: 'mn', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'], rotationSeed: true, metricsRoute: 'server', metricsState: 'reading' }),
  'lab-us-youtube': acct({ platform: 'youtube', countryCode: 'US', language: 'en', timeZone: 'America/New_York', dailyFrom: '미정', metricsRoute: 'server', metricsState: 'unconfirmed' }),
  'lab-youtube': acct({ platform: 'youtube', audience: 'global', language: 'en', timeZone: 'Asia/Seoul', rotationSeed: true, metricsRoute: 'server', metricsState: 'reading' }),
  'lab-ru-rutube': acct({ platform: 'rutube', countryCode: 'RU', language: 'ru', timeZone: 'Europe/Moscow', dailyFrom: '미정', metricsRoute: 'screen-only', metricsState: 'missing' }),
  'lab-uz-telegram': { brand: 'LAB', platform: 'telegram', countryCode: 'UZ', language: 'uz', timeZone: 'Asia/Tashkent', dailyTimes: ['21:00'], dailyFormats: ['노래'], dailyFrom: '미정', metricsRoute: 'public-page', metricsState: 'missing' },
  'synkbrief-youtube': { brand: 'synkbrief', platform: 'youtube' },
};
const row = (post, account, point, views, publishedAt, at = '2026-11-19T00:00:00Z') => ({ kind: '판정', post, account, point, publishedAt, at, metrics: { views } });
const ledger = [
  // 몽골 인스타: 21:00 KST(현지 20:00 칸) 두 판, 13:00 KST(현지 12:00 칸) 한 판
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
  // 편 형식을 알 길(편형식)이 없으면 칸은 시각으로만 나누고 형식은 「모름」 — 원장의 지금 칸 형식을 이름으로 붙이지 않는다(11-11 Fable 5.2 P2-12)
  assert.deepEqual(ig.map((r) => [r.slot, r.format, r.v24, r.v72]), [['12:00', '모름', [500], []], ['20:00', '모름', [1000, 3000], [2400]]]);
  assert.equal(rows.find((r) => r.key === 'lab-youtube').country, '전 세계');
  assert.equal(rows.filter((r) => r.key === 'lab-uz-telegram').length, 1, '텔레그램은 칸 하나');
  const text = 나라.절({ ledger, accounts, now: NOW }).join('\n');
  assert.match(text, /^## LAB 계정 · 나라 · 칸별\(최근 21일 · 같은 나이끼리\)$/m);
  assert.match(text, /LAB 5계정 가운데 숫자가 있는 계정 1\./);
  assert.match(text, /^\| 나라 \| 플랫폼 \| 계정 \| 말 \| 칸\(현지\) \| 편 형식 \| 24시간 조회 \| 72시간 조회 \| 숫자 \|$/m);
  assert.match(text, /^\| MN · 씨앗 \| instagram \| lab-instagram \| mn \| 20:00 \| 모름 \| 2,000 \(2\) \| 2,400 \(1\) \| 읽힘 \|$/m);
  assert.match(text, /^\| MN · 씨앗 \| instagram \| lab-instagram \| mn \| 12:00 \| 모름 \| 500 \(1\) \| — \| 읽힘 \|$/m);
  assert.doesNotMatch(text, /\| (12|20):00 (이야기|노래) \|/, '칸 이름에 원장 형식을 붙이지 않는다');
  // 숫자가 없는 계정은 표에 줄을 늘리지 않고 까닭마다 한 줄로 모은다
  assert.doesNotMatch(text, /^\| US \|/m);
  assert.match(text, /^- 시작 전 · 확인 전\(첫 게시 뒤\) — 서버 수집 1곳: lab-us-youtube\(US\)$/m);
  assert.match(text, /^- 시작 전 · 결측 — 화면에서만 1곳: lab-ru-rutube\(RU\)$/m);
  assert.match(text, /^- 시작 전 · 결측 — 공개 페이지\(수집기 없음\) 1곳: lab-uz-telegram\(UZ\)$/m);
  assert.match(text, /^- 읽힘\(최근 판 없음\) 1곳: lab-youtube\(전 세계\)$/m);
  assert.doesNotMatch(text, /\| 0 \(/, '숫자가 없는 칸을 0으로 적지 않는다');
});

test('편 형식 — 칸 안을 그 판 편의 형식(준비.json 「돌림」.형식, 없으면 줄 편)으로 나누고, 편을 못 찾은 판은 따로 센다(11-11 Fable 5.2 P2-12)', () => {
  // 몽골 인스타 20:00 칸(원장은 지금 「노래」 칸): ig:1 · ig:2는 옛 줄 편, ig:4는 이야기 원본, ig:5는 편을 못 찾음
  const 편 = { 'ig:1': { 슬롯: '2026-11-15' }, 'ig:2': null, 'ig:3': { 돌림: { 형식: '이야기' } }, 'ig:4': { 돌림: { 형식: '이야기' } }, 'ig:6': { 돌림: { 형식: '노래' } }, 'ig:7': { 돌림: { 형식: '틀린형식' } } };
  const more = [
    row('ig:4', 'lab-instagram', '24h', 20000, '2026-11-17T21:00:00+09:00'),
    row('ig:5', 'lab-instagram', '24h', 700, '2026-11-18T21:00:00+09:00'),
    row('ig:6', 'lab-instagram', '24h', 900, '2026-11-19T21:00:00+09:00'),
    row('ig:7', 'lab-instagram', '24h', 50, '2026-11-14T21:00:00+09:00'),
  ];
  const 편형식 = (l) => (l.post in 편 ? 나라.형식Of(편[l.post]) : null);
  const rows = 나라.줄들({ ledger: [...ledger, ...more], accounts, now: NOW, 편형식 }).filter((r) => r.key === 'lab-instagram');
  assert.deepEqual(rows.map((r) => [r.slot, r.format, r.v24, r.v72]), [
    ['12:00', '이야기', [500], []],
    ['20:00', '노래', [900], []],
    ['20:00', '이야기', [20000], []],
    ['20:00', '줄 편', [1000, 3000, 50], [2400]],
    ['20:00', '편 못 찾음', [700], []],
  ]);
  // 판이 없는 칸은 형식 없이 한 줄
  const yt = 나라.줄들({ ledger: [...ledger, row('yt:9', 'lab-youtube', '24h', 10, '2026-11-18T21:00:00+09:00')], accounts, now: NOW, 편형식: () => '줄 편' }).filter((r) => r.key === 'lab-youtube');
  assert.deepEqual(yt.map((r) => [r.slot, r.format, r.v24]), [['13:00', null, []], ['21:00', '줄 편', [10]]]);
  const text = 나라.절({ ledger: [...ledger, ...more], accounts, now: NOW, 편형식 }).join('\n');
  assert.match(text, /^\| MN · 씨앗 \| instagram \| lab-instagram \| mn \| 20:00 \| 줄 편 \| 1,000 \(3\) \| 2,400 \(1\) \| 읽힘 \|$/m);
  assert.match(text, /^\| MN · 씨앗 \| instagram \| lab-instagram \| mn \| 20:00 \| 이야기 \| 20,000 \(1\) \| — \| 읽힘 \|$/m);
  assert.match(text, /원장의 지금 칸 형식\(13:00 이야기 · 21:00 노래\)이 아니다/);
  assert.equal(나라.형식Of(undefined), '줄 편');
  assert.equal(나라.형식Of({ 돌림: { 형식: '퀴즈' } }), '퀴즈');
});

test('칸 고르기 — 자정을 넘긴 새벽 판은 앞 날 마지막 칸, 그날 안 열린 칸에는 넣지 않는다(11-11 Fable 5.2 P2-12: lab-youtube 새벽 세 건)', () => {
  const acc = {
    // 한국 시각 씨앗 — 13:00 칸은 아직 닫힘
    'lab-youtube': acct({ platform: 'youtube', audience: 'global', language: 'en', timeZone: 'Asia/Seoul', dailyTimesFrom: '미정', rotationSeed: true, metricsRoute: 'server', metricsState: 'reading' }),
    // 몽골 — 11-17부터 12:00 칸이 열린다
    'lab-tiktok': acct({ platform: 'tiktok', countryCode: 'MN', language: 'mn', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['12:00', '20:00'], dailyTimesFrom: '2026-11-17', rotationSeed: true, metricsRoute: 'server', metricsState: 'reading' }),
  };
  const led = [
    row('yt:a', 'lab-youtube', '24h', 11, '2026-11-15T01:55:02+09:00'), // 새벽 — 앞 날 21:00 칸
    row('yt:b', 'lab-youtube', '24h', 13, '2026-11-16T03:08:08+09:00'), // 새벽 — 앞 날 21:00 칸
    row('yt:c', 'lab-youtube', '24h', 17, '2026-11-17T13:05:00+09:00'), // 13:00 칸이 닫힌 날 — 그날 21:00 칸
    row('yt:d', 'lab-youtube', '24h', 19, '2026-11-17T21:00:00+09:00'),
    row('tt:a', 'lab-tiktok', '24h', 100, '2026-11-16T13:00:00+09:00'), // 현지 12:00 — 앞 칸이 열리기 전이라 20:00 칸
    row('tt:b', 'lab-tiktok', '24h', 200, '2026-11-17T13:00:00+09:00'), // 현지 12:00 — 열린 날
    row('tt:c', 'lab-tiktok', '24h', 300, '2026-11-18T01:40:00+09:00'), // 현지 00:40 — 두 칸이 다 열린 날이어도 앞 날 20:00 칸(그날 12:00 칸이 아니다)
  ];
  const rows = 나라.줄들({ ledger: led, accounts: acc, now: NOW });
  assert.deepEqual(rows.filter((r) => r.key === 'lab-youtube').map((r) => [r.slot, r.v24]), [['13:00', []], ['21:00', [11, 13, 17, 19]]]);
  assert.deepEqual(rows.filter((r) => r.key === 'lab-tiktok').map((r) => [r.slot, r.v24]), [['12:00', [200]], ['20:00', [100, 300]]]);
});

test('LAB 돌림 계정이 없으면 절을 내지 않는다 · 중앙값', () => {
  assert.deepEqual(나라.절({ ledger, accounts: { 'synkbrief-youtube': { brand: 'synkbrief' } }, now: NOW }), []);
  assert.equal(나라.median([]), null);
  assert.equal(나라.median([3, 1, 2]), 2);
  assert.equal(나라.median([1, 2, 3, 10]), 3);
});
