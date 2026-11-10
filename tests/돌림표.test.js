'use strict';
// LAB 돌림표(tools/lib/돌림.js · tools/돌림표.js — 2026-11-10 LAB 하루 두 편 · 39계정 설계 1 · 2 · 3 · 22)와 계정 시간대(tools/lib/계정시간.js).
// 임시 폴더의 가짜 원장 · 편 폴더만 읽고 쓴다(docs/마케팅은 건드리지 않는다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const T = require('../tools/lib/계정시간.js');
const 돌림 = require('../tools/lib/돌림.js');

const HOUR = 3600000;
const ver = (keys) => Object.fromEntries(keys.map((k) => [k, { ready: true }]));
const acct = (platform, versionKey, timeZone, extra = {}) => ({ platform, language: extra.language || versionKey.toLowerCase(), versionKey, timeZone,
  dailyTimes: platform === 'telegram' ? ['21:00'] : ['13:00', '21:00'], dailyFormats: platform === 'telegram' ? ['퀴즈'] : ['이야기', '퀴즈'], ...extra });
// 예전에 씨앗이 올린 원본(점검이 오래전에 지남) — 씨앗 판을 기존 판으로 준다
const seeded = (ids, format, keys, seedAccount = 'seed-ig') => ({
  originals: ids.map((id) => ({ id, format, versions: ver(keys) })),
  existing: ids.map((id, i) => ({ original: id, account: seedAccount, time: `2026-10-${String(10 + i).padStart(2, '0')}T21:00:00+09:00` })),
});

test('계정 시간대 — 현지 날짜 · 현지 시각 · 서머타임 · 판 시각 꼴', () => {
  // 뉴욕 11-20 21:00(표준시 −05:00) = 한국 11-21 11:00
  const ms = T.zonedMs('2026-11-20', '21:00', 'America/New_York');
  assert.equal(T.isoAt(ms, 'America/New_York'), '2026-11-20T21:00:00-05:00');
  assert.equal(T.isoAt(ms, 'Asia/Seoul'), '2026-11-21T11:00:00+09:00');
  // 여름(−04:00)과 겨울(−05:00)이 다르다
  assert.equal(T.isoAt(T.zonedMs('2026-07-01', '21:00', 'America/New_York'), 'America/New_York'), '2026-07-01T21:00:00-04:00');
  // 카트만두 +05:45 · 오클랜드 여름 +13:00
  assert.equal(T.isoAt(T.zonedMs('2026-11-20', '13:00', 'Asia/Kathmandu'), 'Asia/Kathmandu'), '2026-11-20T13:00:00+05:45');
  assert.equal(T.isoAt(T.zonedMs('2026-11-20', '21:00', 'Pacific/Auckland'), 'Asia/Seoul'), '2026-11-20T17:00:00+09:00');
  assert.equal(T.localDate(Date.parse('2026-11-20T23:30:00+09:00'), 'Asia/Ulaanbaatar'), '2026-11-20');
  assert.equal(T.localDate(Date.parse('2026-11-21T00:30:00+09:00'), 'Asia/Ulaanbaatar'), '2026-11-20');
  assert.equal(T.validZone('Asia/Seoul'), true);
  assert.equal(T.validZone('Mars/Olympus'), false);
});

test('계정 칸 — 형식 · 시작 전(미정) · 앞 칸 열리는 날 · 칸 이름', () => {
  const a = { dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'], timeZone: 'Asia/Bangkok' };
  assert.deepEqual(T.slotsOn(a, '2026-11-20').map((s) => `${s.time} ${s.format}`), ['13:00 이야기', '21:00 퀴즈']);
  assert.deepEqual(T.slotsOn({ ...a, dailyFrom: '미정' }, '2026-11-20'), []);
  assert.deepEqual(T.slotsOn({ ...a, dailyFrom: '2026-11-21' }, '2026-11-20'), []);
  assert.equal(T.slotsOn({ ...a, dailyFrom: '2026-11-21' }, '2026-11-21').length, 2);
  assert.deepEqual(T.slotsOn({ ...a, dailyTimesFrom: '미정' }, '2026-11-20').map((s) => s.time), ['21:00']);
  // 형식마다 여는 날(11-10) — 나라별 계정은 이야기 칸부터 열고 퀴즈 칸은 닫아 둔다
  assert.deepEqual(T.slotsOn({ ...a, dailyFormatsFrom: { 퀴즈: '미정' } }, '2026-11-20').map((s) => s.time), ['13:00']);
  assert.deepEqual(T.slotsOn({ ...a, dailyFormatsFrom: { 퀴즈: '2026-11-25' } }, '2026-11-24').map((s) => s.time), ['13:00']);
  assert.equal(T.slotsOn({ ...a, dailyFormatsFrom: { 퀴즈: '2026-11-25' } }, '2026-11-25').length, 2);
  assert.deepEqual(T.slotsOn({ ...a, dailyFrom: '미정', dailyFormatsFrom: { 퀴즈: '미정' } }, '2026-11-20'), []);
  assert.deepEqual(T.slotsOn({ dailyTimes: ['21:00'], dailyFormats: ['퀴즈'], dailyFormatsFrom: { 퀴즈: '미정' } }, '2026-11-20'), [], '퀴즈 한 칸뿐인 텔레그램은 칸이 없다');
  assert.equal(T.slotFor('2026-11-20T13:05:00+07:00', a).format, '이야기');
  assert.equal(T.slotFor('2026-11-20T15:00:00+09:00', a).format, '이야기'); // 한국 15:00 = 방콕 13:00
  assert.equal(T.slotFor('2026-11-20T22:00:00+09:00', a).format, '퀴즈'); // 한국 22:00 = 방콕 20:00 — 21:00 칸이 가깝다
  assert.equal(T.slotKey('lab-th-youtube', a, T.allSlots(a)[0]), 'lab-th-youtube 이야기');
  assert.equal(T.slotKey('lab-th-youtube', a, T.allSlots(a)[1]), 'lab-th-youtube');
  assert.equal(T.slotKey('lab-instagram', { dailyTimes: ['12:00', '21:00'] }, { time: '12:00' }), 'lab-instagram 12시');
});

test('틱톡 7곳 · 원본 5편 — 첫날 다섯 곳만 차고(그 뒤 넷 · 다섯), 같은 날 같은 원본이 없고, 계정마다 순서가 다르다', () => {
  const zones = ['Asia/Ulaanbaatar', 'Asia/Yangon', 'America/Mexico_City', 'Asia/Almaty', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Ho_Chi_Minh'];
  const accounts = Object.fromEntries(zones.map((z, i) => [`tt${i}`, acct('tiktok', `C${i}`, z)]));
  accounts['seed-ig'] = acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' });
  const { originals, existing } = seeded(['s1', 's2', 's3', 's4', 's5'], '이야기', zones.map((_, i) => `C${i}`));
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 5 });
  const story = r.cells.filter((c) => c.format === '이야기' && c.account.startsWith('tt'));
  for (const day of r.range) {
    const today = story.filter((c) => c.day === day);
    const used = today.filter((c) => c.original).map((c) => c.original);
    // 멕시코(서쪽 하나)의 그날 저녁 판은 동쪽 여섯의 다음 날 아침 판과 10~13시간이라 그 원본은 다음 날 하루 빠진다 — 원본이 늘기 전엔 넷
    if (day === r.range[0]) assert.equal(used.length, 5, `${day}: 첫날은 다섯 곳`);
    else assert.ok(used.length === 4 || used.length === 5, `${day}: ${used.length}곳`);
    assert.equal(new Set(used).size, used.length, `${day}: 같은 날 같은 원본 없음`);
    for (const c of today.filter((x) => !x.original)) assert.match(c.why, /겹침|다 올림/);
  }
  // 20시간 안에 같은 원본이 틱톡 둘에 안 나간다
  const filled = story.filter((c) => c.original);
  for (const x of filled) for (const y of filled) if (x !== y && x.original === y.original) assert.ok(Math.abs(x.ms - y.ms) >= 20 * HOUR, `${x.account}·${y.account} ${x.original}`);
  // 한 계정이 같은 원본을 두 번 올리지 않는다
  for (const k of Object.keys(accounts)) { const mine = filled.filter((c) => c.account === k).map((c) => c.original); assert.equal(new Set(mine).size, mine.length, k); }
  // 순서 섞기: 첫날 계정마다 다른 원본, 그리고 같은 입력이면 늘 같은 표
  const again = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 5 });
  assert.deepEqual(again.cells.map((c) => c.original), r.cells.map((c) => c.original));
});

test('유튜브 — 언어가 다른 판은 같은 날 여러 채널(다섯까지), 같은 언어 판은 20시간 안에 둘이 안 된다', () => {
  const accounts = {
    us: acct('youtube', 'US', 'America/New_York', { language: 'en' }), ca: acct('youtube', 'CA', 'America/Toronto', { language: 'en' }),
    au: acct('youtube', 'AU', 'Australia/Sydney', { language: 'en' }), th: acct('youtube', 'TH', 'Asia/Bangkok', { language: 'th' }),
    jp: acct('youtube', 'JP', 'Asia/Tokyo', { language: 'ja' }), vn: acct('youtube', 'VN', 'Asia/Ho_Chi_Minh', { language: 'vi' }),
    'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
  };
  const { originals, existing } = seeded(['q1', 'q2'], '퀴즈', ['US', 'CA', 'AU', 'TH', 'JP', 'VN']);
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 2 });
  const quiz = r.cells.filter((c) => c.format === '퀴즈' && c.original && accounts[c.account].platform === 'youtube');
  const day1 = quiz.filter((c) => c.day === '2026-11-20');
  assert.equal(day1.length, 5, '원본 둘이면 영어 셋 가운데 둘(원본마다 하나) + 태국 · 일본 · 베트남 셋');
  assert.equal(day1.filter((c) => accounts[c.account].language === 'en').length, 2);
  for (const x of quiz) for (const y of quiz) {
    if (x === y || x.original !== y.original) continue;
    if (accounts[x.account].language === accounts[y.account].language) assert.ok(Math.abs(x.ms - y.ms) >= 20 * HOUR, `${x.account}·${y.account}`);
  }
  // 한 원본이 하루 다섯 채널을 넘지 않는다(youtubeCap)
  const capped = 돌림.plan({ accounts, originals: originals.slice(0, 1), existing: existing.slice(0, 1), from: '2026-11-20', days: 1, cfg: { youtubeCap: 2 } });
  assert.equal(capped.cells.filter((c) => c.original && c.format === '퀴즈').length, 2);
});

test('유튜브 자리 내주기 — 다섯이 찬 원본에서 다른 언어 칸을 옮겨도 같은 언어 둘이 한 원본을 받지 않는다(11-10 Fable 검수 재현 꼴)', () => {
  // 유튜브 일곱(스페인어 둘) · 원본 둘 · 채널 다섯 한도. 계정 이름에 따라 섞는 순서가 바뀌므로 이름을 바꿔 가며 본다(고치기 전: 60번에 5번 겹침).
  const yt = (language, extra = {}) => ({ platform: 'youtube', language, versionKey: 'X', timeZone: 'Asia/Seoul', dailyTimes: ['13:00'], dailyFormats: ['이야기'], ...extra });
  const originals = ['가', '나'].map((id) => ({ id, format: '이야기', versions: ver(['X']) }));
  for (let n = 0; n < 60; n++) {
    const accounts = { [`seed${n}`]: yt('ko', { seed: true }), [`a${n}`]: yt('ja'), [`b${n}`]: yt('vi'), [`c${n}`]: yt('id'), [`d${n}`]: yt('th'), [`es1_${n}`]: yt('es'), [`es2_${n}`]: yt('es'),
      tk: { ...yt('mn', { seed: true, blocked: '시험 밖' }), platform: 'tiktok' } };
    const existing = [{ original: '가', account: 'tk', time: '2026-11-01T13:00:00+09:00' }, { original: '나', account: 'tk', time: '2026-11-02T13:00:00+09:00' }];
    const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-13', days: 1 });
    const by = new Map();
    for (const c of r.cells) if (c.original) by.set(`${c.original}|${accounts[c.account].language}`, (by.get(`${c.original}|${accounts[c.account].language}`) || 0) + 1);
    for (const [k, v] of by) assert.equal(v, 1, `${n}번째 이름: ${k}가 ${v}곳`);
  }
});

test('유튜브 하루 다섯 — 현지 날짜 이름이 아니라 흐른 24시간으로 센다(멕시코 저녁 다섯 + 5시간 뒤 오클랜드 다섯이 한 원본을 받지 않는다)', () => {
  // 멕시코 11-20 21:00 = 11-21 03:00Z, 오클랜드 11-21 21:00 = 11-21 08:00Z — 현지 날짜는 다르지만 다섯 시간 차이다(고치기 전: 24시간 안에 열 곳).
  const accounts = { 'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }) };
  for (let i = 0; i < 5; i++) accounts[`mx${i}`] = acct('youtube', 'X', 'America/Mexico_City', { language: `mx-${i}`, dailyFrom: '2026-11-20' });
  for (let i = 0; i < 5; i++) accounts[`nz${i}`] = acct('youtube', 'X', 'Pacific/Auckland', { language: `nz-${i}`, dailyFrom: '2026-11-21' });
  const { originals, existing } = seeded(['q1'], '퀴즈', ['X']);
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 4 });
  const t = r.cells.filter((c) => c.original === 'q1').map((c) => c.ms).sort((x, y) => x - y);
  assert.equal(t.length, 10, '열 곳 모두 언젠가는 받는다(하루 밀릴 뿐)');
  for (let i = 0; i < t.length; i++) assert.ok(t.filter((x) => x >= t[i] && x - t[i] < 24 * HOUR).length <= 5, '어느 24시간에도 다섯까지');
  // 이미 걸려 있는 유튜브 판도 같이 센다 — 앞서 다섯이 걸려 있으면 24시간 안의 새 칸은 못 받는다
  const held = [0, 1, 2, 3, 4].map((i) => ({ original: 'q1', account: `mx${i}`, time: '2026-11-20T21:00:00-06:00' }));
  const next = 돌림.plan({ accounts, originals, existing: [...existing, ...held], from: '2026-11-21', days: 1 });
  const nz = next.cells.filter((c) => c.account.startsWith('nz') && c.format === '퀴즈');
  assert.equal(nz.length, 5);
  assert.equal(nz.filter((c) => c.original).length, 0, '오클랜드 11-21 21:00은 멕시코 판과 다섯 시간 차이라 빈다');
});

test('crowded — 새 시각이 든 구간만 센다(이미 있던 몰림은 새 시각과 상관없으면 막지 않는다)', () => {
  const day = 24 * HOUR;
  const five = [0, 1, 2, 3, 4].map((h) => h * HOUR);
  assert.equal(돌림.crowded(five, 5 * HOUR, 5, day), true, '여섯째가 24시간 안');
  assert.equal(돌림.crowded(five, 24 * HOUR, 5, day), false, '첫 판에서 꼭 24시간 뒤는 새 구간');
  assert.equal(돌림.crowded(five, 23 * HOUR, 5, day), true, '첫 판에서 23시간 뒤는 아직 같은 구간');
  assert.equal(돌림.crowded(five.slice(0, 4), 5 * HOUR, 5, day), false, '다섯째는 된다');
  // 이미 여섯이 몰려 있어도(옛 판) 멀리 떨어진 새 시각은 된다
  assert.equal(돌림.crowded([0, 1, 2, 3, 4, 5].map((h) => h * HOUR), 80 * HOUR, 5, day), false);
});

test('씨앗 먼저 — 새 원본은 씨앗이 올리고, 다른 계정은 24시간 뒤 첫 한국 14시 점검 뒤 칸에만', () => {
  const accounts = {
    'seed-tt': acct('tiktok', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyTimes: ['12:00', '20:00'] }),
    jp: acct('youtube', 'JP', 'Asia/Tokyo', { language: 'ja' }), us: acct('youtube', 'US', 'America/New_York', { language: 'en' }),
  };
  const originals = [{ id: 'new', format: '이야기', versions: ver(['MN', 'JP', 'US']), readyFrom: '2026-11-20' }];
  const r = 돌림.plan({ accounts, originals, from: '2026-11-20', days: 3 });
  const story = r.cells.filter((c) => c.format === '이야기' && c.original === 'new');
  const seed = story.find((c) => c.account === 'seed-tt');
  assert.equal(seed.day, '2026-11-20', '씨앗이 첫날(울란바토르 12:00 = 한국 13:00)');
  const checkpoint = 돌림.checkpointOf(seed.ms);
  assert.equal(T.isoAt(checkpoint, 'Asia/Seoul'), '2026-11-21T14:00:00+09:00');
  const jp = story.find((c) => c.account === 'jp');
  // 도쿄 11-21 13:00은 한국 14시 점검 전이라 못 받고 11-22에 받는다
  assert.equal(jp.day, '2026-11-22');
  const us = story.find((c) => c.account === 'us');
  assert.equal(us.day, '2026-11-21', '뉴욕 11-21 13:00 = 한국 11-22 03:00 → 점검 뒤');
  for (const c of story) if (c !== seed) assert.ok(c.ms >= checkpoint);
  // 씨앗이 안 올린 원본은 다른 계정이 못 받는다
  const noSeed = 돌림.plan({ accounts: { jp: accounts.jp }, originals, from: '2026-11-20', days: 2 });
  assert.equal(noSeed.cells.filter((c) => c.original).length, 0);
  assert.match(noSeed.cells.find((c) => c.format === '이야기').why, /씨앗/);
});

test('텔레그램은 21:00 퀴즈 한 편 · 시작 전 계정은 칸이 없다 · 이미 있는 판은 칸을 차지하고 되풀이를 막는다', () => {
  const accounts = {
    tg: acct('telegram', 'UZ', 'Asia/Tashkent', { language: 'uz' }),
    later: acct('facebook', 'NP', 'Asia/Kathmandu', { dailyFrom: '미정' }),
    fb: acct('facebook', 'KH', 'Asia/Phnom_Penh'),
    'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
  };
  const story = seeded(['s1', 's2'], '이야기', ['UZ', 'NP', 'KH']);
  const quiz = seeded(['q1', 'q2'], '퀴즈', ['UZ', 'NP', 'KH']);
  const existing = [...story.existing, ...quiz.existing, { original: 's1', account: 'fb', time: '2026-11-20T13:00:00+07:00' }];
  const r = 돌림.plan({ accounts, originals: [...story.originals, ...quiz.originals], existing, from: '2026-11-20', days: 2 });
  assert.deepEqual([...new Set(r.cells.filter((c) => c.account === 'tg').map((c) => c.format))], ['퀴즈']);
  assert.equal(r.cells.filter((c) => c.account === 'later').length, 0);
  const fbFirst = r.cells.find((c) => c.account === 'fb' && c.day === '2026-11-20' && c.format === '이야기');
  assert.equal(fbFirst.taken, true);
  assert.equal(r.cells.find((c) => c.account === 'fb' && c.day === '2026-11-21' && c.format === '이야기').original, 's2', '이미 올린 s1은 다시 안 받는다');
});

test('멈춘 원본은 안 쓰고, 예비편은 useSpares일 때만, 판본이 없으면 그 나라 칸은 빈다', () => {
  const accounts = { th: acct('youtube', 'TH', 'Asia/Bangkok'), 'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }) };
  const a = seeded(['bad', 'spare'], '이야기', ['TH']);
  a.originals[0].stopped = true;
  a.originals[1].spare = true;
  const off = 돌림.plan({ accounts, originals: a.originals, existing: a.existing, from: '2026-11-20', days: 1 });
  assert.equal(off.cells.find((c) => c.account === 'th' && c.format === '이야기').original, null);
  const on = 돌림.plan({ accounts, originals: a.originals, existing: a.existing, from: '2026-11-20', days: 1, useSpares: true });
  assert.equal(on.cells.find((c) => c.account === 'th' && c.format === '이야기').original, 'spare');
  const none = 돌림.plan({ accounts, originals: [{ id: 'x', format: '이야기', versions: ver(['JP']) }], existing: [{ original: 'x', account: 'seed-ig', time: '2026-10-01T21:00:00+09:00' }], from: '2026-11-20', days: 1 });
  assert.equal(none.cells.find((c) => c.account === 'th' && c.format === '이야기').why, 'TH 판본이 검수를 넘긴 이야기 원본 없음 — TH 판본이 아직 못 듦 1편(판본 없음)');
  // 받을 원본이 남았는데 그 판본이 검수 전이거나 쓸날 전이면 「다 올림」이 아니라 그 까닭을 말한다(11-11 — 지마를 받은 채널의 화날때 판본이 검수 전)
  const seedPlate = (id, day) => ({ original: id, account: 'seed-ig', time: `2026-10-${day}T21:00:00+09:00` });
  const story = (originals, days = 2) => 돌림.plan({ accounts, originals, existing: originals.map((o, i) => seedPlate(o.id, `0${i + 1}`)), from: '2026-11-20', days })
    .cells.filter((c) => c.account === 'th' && c.format === '이야기');
  const half = story([{ id: 'a', format: '이야기', versions: ver(['TH']) }, { id: 'b', format: '이야기', versions: { TH: { ready: false, why: '뜻 검수 전' } } }, { id: 'c', format: '이야기', versions: ver(['TH']), readyFrom: '2026-12-01' }]);
  assert.equal(half[0].original, 'a');
  assert.equal(half[1].why, '안 받은 이야기 원본 2편이 아직 못 나간다 — TH 판본이 아직 못 듦 1편(뜻 검수 전) · 쓸날 전 1편');
  const all = story([{ id: 'a', format: '이야기', versions: ver(['TH']) }]);
  assert.equal(all[1].why, '이 계정이 이야기 원본을 다 올림', '안 받은 원본이 정말 없을 때만 「다 올림」');
});

// ── 명령(tools/돌림표.js) — 임시 원장 · 편 폴더 ──
const tool = path.resolve(__dirname, '..', 'tools', '돌림표.js');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// 판본 원고 — 파일이 없거나 게시글 고칠 것이 있으면 그 판본은 돌림에 안 든다(11-11 versionState)
const 원고쓰기 = (dir, key, language = key.toLowerCase(), extra = {}) => fs.writeFileSync(path.join(dir, '게시', '판본', key, '원고.json'),
  JSON.stringify({ brand: 'LAB', platform: 'youtube', language, title: 'One Korean phrase', caption: 'A short Korean phrase for friends only.', ...extra }));

function 마당() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '돌림표-'));
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), '돌림표-캐시-'));
  const L = (platform, cc, tz, extra = {}) => ({ brand: 'LAB', platform, countryCode: cc, language: cc.toLowerCase(), timeZone: tz, dailyLine: 'LAB 나라별',
    dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'], publicProfileComplete: true, postRoute: 'youtube-studio', postRouteVerified: true, ...extra });
  const ledger = { accounts: {
    'lab-instagram': { ...L('instagram', 'MN', 'Asia/Ulaanbaatar', { dailyLine: 'LAB 몽골', dailyTimes: ['12:00', '20:00'], rotationSeed: true }) },
    'lab-th-youtube': L('youtube', 'TH', 'Asia/Bangkok'),
    'lab-jp-youtube': L('youtube', 'JP', 'Asia/Tokyo'),
    'lab-np-facebook': L('facebook', 'NP', 'Asia/Kathmandu', { publicProfileComplete: false }),
    'lab-vn-tiktok': L('tiktok', 'VN', 'Asia/Ho_Chi_Minh', { dailyFrom: '미정' }),
  }, labRotation: { 판본검수: ['뜻', '글자'] } };
  fs.writeFileSync(path.join(root, 'sns-계정.json'), JSON.stringify(ledger));
  // 원본 둘: 이미 몽골 씨앗이 올린 이야기 편 — 태국 · 일본 판본은 검수 통과, 일본 글은 검수 뒤 바뀜(뜻 검수 무효)
  for (const name of ['LAB_가_mn_20261101', 'LAB_나_mn_20261102']) {
    const dir = path.join(root, name);
    fs.mkdirSync(path.join(dir, '게시', '판본', 'TH'), { recursive: true });
    fs.mkdirSync(path.join(dir, '게시', '판본', 'JP'), { recursive: true });
    const 판본 = {};
    for (const k of ['TH', 'JP']) {
      const video = path.join(dir, '게시', '판본', k, 'video.mp4');
      const text = path.join(dir, '게시', '판본', k, '글.json');
      fs.writeFileSync(video, `${name}-${k}-video`);
      fs.writeFileSync(text, JSON.stringify({ 줄: [`${name} ${k}`] }));
      원고쓰기(dir, k);
      판본[k] = { 언어: k.toLowerCase(), 파일: `게시/판본/${k}/video.mp4`, 글: `게시/판본/${k}/글.json`, 원고: { youtube: `게시/판본/${k}/원고.json` },
        검수: { 뜻: { 결과: '통과', 지문: sha(text) }, 글자: { 결과: '통과', 지문: sha(video) } } };
    }
    if (name.includes('나')) fs.writeFileSync(path.join(dir, '게시', '판본', 'JP', '글.json'), JSON.stringify({ 줄: ['고친 글'] }));
    const day = name.includes('가') ? '2026-11-01' : '2026-11-02';
    fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: day, 돌림: { 형식: '이야기', 판본 },
      판: [{ 계정: 'lab-instagram', 파일: 'x.mp4', 시각: `${day}T13:00:00+09:00`, AI표시: false }] }, null, 2));
    fs.writeFileSync(path.join(dir, '게시', '게시결과.json'), JSON.stringify({ 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: `ig-${name}` }] }));
  }
  const run = (...args) => {
    const r = spawnSync(process.execPath, [tool, '--폴더', root, '--지금', '2026-11-19T12:00:00+09:00', ...args], { encoding: 'utf8', env: { ...process.env, SYNK_ROTATION_DIR: cache } });
    return r;
  };
  return { root, cache, run, cleanup: () => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(cache, { recursive: true, force: true }); } };
}

test('돌림표 명령 — 셈 · 쓰기(돌림 판) · 다시 셈해도 겹쳐 쓰지 않음 · 준비 안 된 계정 · 검수 무효 판본', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const plan = m.run('--부터', '2026-11-20', '--일수', '2', '--json');
  assert.equal(plan.status, 0, plan.stderr);
  const j = JSON.parse(plan.stdout);
  assert.equal(j.versions['LAB_나_mn_20261102'].JP.ready, false);
  assert.match(j.versions['LAB_나_mn_20261102'].JP.why, /뜻 검수 뒤 글이 바뀜/);
  assert.ok(j.notReady.some((x) => x.account === 'lab-np-facebook' && x.why.some((w) => /프로필/.test(w))));
  assert.equal(j.cells.some((c) => c.account === 'lab-vn-tiktok'), false, '시작 전(미정) 계정은 칸이 없다');
  const th = j.cells.filter((c) => c.account === 'lab-th-youtube' && c.format === '이야기');
  assert.deepEqual(th.map((c) => Boolean(c.original)), [true, true]);
  const jp = j.cells.filter((c) => c.account === 'lab-jp-youtube' && c.format === '이야기');
  assert.equal(jp.filter((c) => c.original).length, 1, '일본은 검수가 산 판본(가)만');

  const w = m.run('--부터', '2026-11-20', '--일수', '2', '--쓰기');
  assert.equal(w.status, 0, w.stderr);
  assert.match(w.stdout, /준비\.json에 썼다/);
  const prep = JSON.parse(fs.readFileSync(path.join(m.root, 'LAB_가_mn_20261101', '게시', '준비.json'), 'utf8'));
  const gen = prep.판.filter((p) => p.돌림);
  assert.ok(gen.length >= 1);
  for (const p of gen) {
    assert.match(p.시각, /^2026-11-2[01]T13:00:00\+0[79]:00$/);
    assert.equal(p.AI표시, false);
    assert.match(p.지문, /^[0-9a-f]{64}$/);
    assert.ok(p.원고.endsWith('원고.json'));
  }
  // 다시 쓰면 이미 찬 칸이라 더할 것이 없다
  const again = m.run('--부터', '2026-11-20', '--일수', '2', '--쓰기');
  assert.match(again.stdout, /더할 판 없음/);
  // 장부: 같은 칸 두 번 없음
  const ledger = m.run('--부터', '2026-11-20', '--일수', '2', '--장부', '--json');
  assert.equal(ledger.status, 0, ledger.stderr);
  const rows = JSON.parse(ledger.stdout);
  assert.equal(rows.doubles.length, 0);
  assert.ok(rows.rows.some((r) => r.계정 === 'lab-th-youtube' && r.상태 === '건 전' && r.돌림));
});

test('돌림표 비상 정지 — 멈춤은 안 건 돌림 판을 빼고, 예약된 판은 보이고, 다음 셈에서 그 원본을 쓰지 않는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '2', '--쓰기').status, 0);
  const file = path.join(m.root, 'LAB_가_mn_20261101', '게시', '준비.json');
  const prep = JSON.parse(fs.readFileSync(file, 'utf8'));
  const booked = prep.판.find((p) => p.돌림);
  // 한 판은 이미 예약됨
  const resultFile = path.join(m.root, 'LAB_가_mn_20261101', '게시', '게시결과.json');
  const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  result.판.push({ 계정: booked.계정, 상태: '예약됨', 시각: booked.시각 });
  fs.writeFileSync(resultFile, JSON.stringify(result));
  const stop = m.run('--멈춤', 'LAB_가_mn_20261101', '--까닭', '첫 판 조회 급락');
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(stop.stdout, /이미 예약된 판 1개/);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(after.돌림.멈춤.까닭, '첫 판 조회 급락');
  assert.deepEqual(after.판.filter((p) => p.돌림).map((p) => p.계정), [booked.계정], '예약된 판만 남는다');
  const plan = JSON.parse(m.run('--부터', '2026-11-22', '--일수', '2', '--json').stdout);
  assert.equal(plan.cells.some((c) => c.original === 'LAB_가_mn_20261101'), false);
});

test('돌림표 비상 정지 점검 — 사흘 안 씨앗 판의 24시간 배수가 모두 0.3배 밑이면 급락(종료 1), 숫자가 없으면 판정 전', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const dir = path.join(m.root, 'LAB_가_mn_20261101');
  const prep = JSON.parse(fs.readFileSync(path.join(dir, '게시', '준비.json'), 'utf8'));
  prep.판[0].시각 = '2026-11-18T13:00:00+09:00'; // 씨앗(인스타 @synk.mn)이 하루 전에 올림
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify(prep));
  const perf = (배수) => fs.writeFileSync(path.join(dir, '게시', '성과.json'), JSON.stringify({ 자동판정: { 판: [{ 계정: 'lab-instagram', 시점: { '24시간': { 평소대비: { 배수 } } } }] } }));
  const before = m.run('--점검', '--json');
  assert.equal(before.status, 0, before.stderr);
  assert.equal(JSON.parse(before.stdout).find((x) => x.piece === 'LAB_가_mn_20261101').verdict, '판정 전');
  perf(0.12);
  const low = m.run('--점검');
  assert.equal(low.status, 1);
  assert.match(low.stdout, /급락 · LAB_가_mn_20261101/);
  perf(2.4);
  assert.equal(m.run('--점검').status, 0);
  // 사흘이 지난 원본도 이번 셈에서 판을 받거나(같은 회차의 --쓰기가 달 판 — 점검이 먼저 돈다) 아직 안 나간 돌림 판이 있으면 본다(11-11).
  // 나 편은 씨앗이 17일 전에 올렸다
  const range = ['--부터', '2026-11-20', '--일수', '2'];
  const seen = () => JSON.parse(m.run('--점검', '--json', ...range).stdout);
  const ahead = seen().find((x) => x.piece === 'LAB_나_mn_20261102');
  assert.ok(ahead && ahead.planned >= 1 && ahead.pending === 0, `판을 달기 전 점검이 이번 셈에서 판을 받을 옛 원본을 본다(${JSON.stringify(seen().map((x) => [x.piece, x.pending, x.planned]))})`);
  assert.match(m.run('--점검', ...range).stdout, /LAB_나_mn_20261102\(이야기\).* · 남은 돌림 판 0 · 이번 셈에서 달 판 \d/);
  assert.equal(m.run(...range, '--쓰기').status, 0);
  const old = seen().find((x) => x.piece === 'LAB_나_mn_20261102');
  assert.ok(old && old.pending >= 1, `안 나간 돌림 판이 남은 오래된 원본(${JSON.stringify(seen().map((x) => [x.piece, x.pending]))})`);
  // 판을 받을 길이 없는 옛 원본(판본이 다 검수 전)은 사흘 창 밖이라 안 본다
  const m2 = 마당();
  t.after(m2.cleanup);
  for (const k of ['TH', 'JP']) fs.writeFileSync(path.join(m2.root, 'LAB_나_mn_20261102', '게시', '판본', k, '글.json'), JSON.stringify({ 줄: ['고친 글'] }));
  const none = JSON.parse(m2.run('--점검', '--json', ...range).stdout);
  assert.equal(none.some((x) => x.piece === 'LAB_나_mn_20261102'), false, '돌림 판도 받을 판도 없으면 사흘 창 밖이라 안 본다');
  assert.ok(none.some((x) => x.piece === 'LAB_가_mn_20261101' && x.planned >= 1));
});

// ── 11-10 Fable 5.2 계획 검수 뒤 더한 것 — 첫 판 시험 · 판정 불가 · 걸린 판 지키기 · 나가지 않는 판 · 「미정」 까닭 ──
const G = 'LAB_가_mn_20261101';
const N = 'LAB_나_mn_20261102';
const 읽기 = (m, name, file = '준비.json') => JSON.parse(fs.readFileSync(path.join(m.root, name, '게시', file), 'utf8'));
const 적기 = (m, name, file, data) => fs.writeFileSync(path.join(m.root, name, '게시', file), JSON.stringify(data, null, 2));
const 원장고침 = (m, change) => {
  const file = path.join(m.root, 'sns-계정.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(j.accounts, j);
  fs.writeFileSync(file, JSON.stringify(j));
};

test('첫 판 시험(trial) — 판이 하나도 없을 때만 칸 하나를 받고, 그 뒤 칸은 비운다', () => {
  const accounts = {
    'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
    th: acct('youtube', 'TH', 'Asia/Bangkok', { trial: true }), jp: acct('youtube', 'JP', 'Asia/Tokyo'),
  };
  const s = seeded(['a', 'b', 'c'], '이야기', ['TH', 'JP']);
  const r = 돌림.plan({ accounts, originals: s.originals, existing: s.existing, from: '2026-11-20', days: 3 });
  const th = r.cells.filter((c) => c.account === 'th' && c.format === '이야기');
  assert.deepEqual(th.map((c) => Boolean(c.original)), [true, false, false], '첫 날 칸 하나만');
  for (const c of th.slice(1)) assert.match(c.why, /첫 판 확인 전/);
  assert.equal(r.cells.filter((c) => c.account === 'jp' && c.original).length, 3, '확인된 계정은 그대로 받는다');
  // 이미 판이 있으면(지난 날 것이라도) 새 칸을 받지 않는다
  const again = 돌림.plan({ accounts, originals: s.originals, existing: [...s.existing, { original: 'a', account: 'th', time: '2026-11-19T13:00:00+07:00' }], from: '2026-11-20', days: 3 });
  assert.equal(again.cells.filter((c) => c.account === 'th' && c.original).length, 0);
  // 나가지 않는 판(gone)은 첫 판으로 세지 않는다 — 그 원본만 다시 받지 않는다
  const gone = 돌림.plan({ accounts, originals: s.originals, existing: [...s.existing, { original: 'a', account: 'th', time: '2026-11-19T13:00:00+07:00', gone: true }], from: '2026-11-20', days: 3 });
  const got = gone.cells.filter((c) => c.account === 'th' && c.original);
  assert.equal(got.length, 1);
  assert.notEqual(got[0].original, 'a');
  // 걸리지 않은 채 날이 지난 첫 판(실패 · 못 건 판 — booked: false)은 첫 판으로 세지 않는다(11-11): 다른 원본으로 새 첫 판을 받는다.
  // 걸린 판 · 아직 날이 안 지난 안 건 판은 그대로 「판 하나」다
  const first = (extra) => 돌림.plan({ accounts, originals: s.originals, existing: [...s.existing, { original: 'a', account: 'th', ...extra }], from: '2026-11-20', days: 3 })
    .cells.filter((c) => c.account === 'th' && c.original).map((c) => c.original);
  const missed = first({ time: '2026-11-19T13:00:00+07:00', booked: false });
  assert.equal(missed.length, 1);
  assert.notEqual(missed[0], 'a', '그 원본은 받은 것으로 남는다');
  assert.deepEqual(first({ time: '2026-11-19T13:00:00+07:00', booked: true }), [], '걸린 판은 첫 판이다');
  assert.deepEqual(first({ time: '2026-11-21T13:00:00+07:00', booked: false }), [], '아직 날이 안 지난 안 건 판은 다시 걸 판이다');
});

test('돌림표 명령 — 첫 판 시험 계정(postRouteVerified 「첫판」)은 판 하나만 쓰고, 다시 돌려도 더하지 않는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원장고침(m, (acc) => { acc['lab-th-youtube'].postRouteVerified = '첫판'; });
  const j = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--json').stdout);
  assert.equal(j.notReady.some((x) => x.account === 'lab-th-youtube'), false, '첫 판 시험 계정은 칸을 받는 계정이다');
  const th = j.cells.filter((c) => c.account === 'lab-th-youtube' && c.format === '이야기');
  assert.equal(th.filter((c) => c.original).length, 1);
  assert.match(th.find((c) => !c.original).why, /첫 판 확인 전/);
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '2', '--쓰기').status, 0);
  const plates = () => [G, N].flatMap((name) => 읽기(m, name).판.filter((p) => p.계정 === 'lab-th-youtube'));
  assert.equal(plates().length, 1);
  const again = m.run('--부터', '2026-11-20', '--일수', '4', '--쓰기');
  assert.equal(again.status, 0, again.stderr);
  assert.equal(plates().length, 1, '첫 판을 확인하기 전에는 다음 판을 쓰지 않는다');
  원장고침(m, (acc) => { acc['lab-th-youtube'].postRouteVerified = true; });
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '4', '--쓰기').status, 0);
  assert.equal(plates().length, 2, 'true로 바꾸면 남은 원본을 받는다');
});

test('돌림표 비상 정지 점검 — 씨앗 과반으로 가리고, 숫자를 볼 씨앗이 없으면 「판정 불가」, 안 나간 씨앗 판은 세지 않는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const seeds = ['lab-instagram', 'lab-facebook', 'lab-tiktok'];
  원장고침(m, (acc) => { acc['lab-facebook'] = { ...acc['lab-instagram'], platform: 'facebook' }; acc['lab-tiktok'] = { ...acc['lab-instagram'], platform: 'tiktok' }; });
  const prep = 읽기(m, G);
  prep.판 = seeds.map((계정) => ({ 계정, 파일: 'x.mp4', 시각: '2026-11-17T13:00:00+09:00', AI표시: false })); // 47시간 전
  적기(m, G, '준비.json', prep);
  const rows = (states) => 적기(m, G, '게시결과.json', { 판: Object.entries(states).map(([계정, 상태]) => ({ 계정, 상태 })) });
  const perf = (multiples) => 적기(m, G, '성과.json', { 자동판정: { 판: Object.entries(multiples).map(([계정, 배수]) => ({ 계정, 시점: { '24시간': { 평소대비: { 배수 } } } })) } });
  const mine = (r) => JSON.parse(r.stdout).find((x) => x.piece === G);
  rows({ 'lab-instagram': '게시됨', 'lab-facebook': '게시됨', 'lab-tiktok': '게시됨' });
  // 40시간이 지났는데 숫자가 하나도 없다 — 판정 전이 아니라 판정 불가
  const none = m.run('--점검', '--json');
  assert.equal(none.status, 0, none.stderr);
  assert.equal(mine(none).verdict, '판정 불가');
  assert.deepEqual([mine(none).known, mine(none).seeds], [0, 3]);
  const said = m.run('--점검');
  assert.match(said.stdout, /! 판정 불가 · LAB_가_mn_20261101/);
  assert.match(said.stdout, /24시간 숫자 없음\(47시간\)/);
  assert.match(said.stdout, /눈으로 보고/);
  // 셋 가운데 둘이 0.3배 밑 → 급락(종료 1)
  perf({ 'lab-instagram': 0.1, 'lab-facebook': 0.2, 'lab-tiktok': 2 });
  const low = m.run('--점검');
  assert.equal(low.status, 1);
  assert.match(low.stdout, /급락 · LAB_가_mn_20261101.*판정할 수 있는 씨앗 3\/3/);
  // 셋 가운데 하나만 낮으면 괜찮음
  perf({ 'lab-instagram': 0.1, 'lab-facebook': 2, 'lab-tiktok': 2 });
  const ok = m.run('--점검', '--json');
  assert.equal(ok.status, 0);
  assert.equal(mine(ok).verdict, '괜찮음');
  // 숫자가 하나뿐이고 그것이 낮으면 급락 — 줄에 1/3이 보인다
  perf({ 'lab-instagram': 0.1 });
  const one = m.run('--점검');
  assert.equal(one.status, 1);
  assert.match(one.stdout, /판정할 수 있는 씨앗 1\/3/);
  assert.match(one.stdout, /하나뿐이면 그 씨앗 글을 먼저 눈으로/);
  // 씨앗 판이 안 나갔으면(실패 · 건 전) 성과 숫자가 있어도 세지 않는다
  rows({ 'lab-instagram': '실패' });
  const gone = m.run('--점검');
  assert.equal(gone.status, 0);
  assert.match(gone.stdout, /판정 불가/);
  assert.match(gone.stdout, /lab-instagram 안 나감\(실패\)/);
  assert.match(gone.stdout, /lab-facebook 안 나감\(건 전\)/);
});

test('돌림표 — --다시 · --멈춤은 걸린 판(거는 중 · 다른 작업본이 표에 잡은 판)을 지우지 않는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '2', '--쓰기').status, 0);
  const before = 읽기(m, G).판.filter((p) => p.돌림);
  const th = before.find((p) => p.계정 === 'lab-th-youtube');
  const jp = before.find((p) => p.계정 === 'lab-jp-youtube');
  assert.ok(th && jp, '가 편에 태국 · 일본 판이 있다');
  // 태국 판은 이 작업본에서 거는 중
  const res = 읽기(m, G, '게시결과.json');
  res.판.push({ 계정: th.계정, 상태: '거는 중', 거는중: '2026-11-19T11:30:00+09:00', 시각: th.시각 });
  적기(m, G, '게시결과.json', res);
  // 일본 판은 다른 작업본(지금은 읽을 수 없다)이 칸 장부에 예약됨으로 적었다
  fs.mkdirSync(path.join(m.root, '.게시장부'), { recursive: true });
  fs.writeFileSync(path.join(m.root, '.게시장부', '칸.json'), JSON.stringify({ 칸: { [`lab-jp-youtube|${jp.시각.slice(0, 10)}|13:00`]: { 편: G, 상태: '예약됨', 때: '2026-11-19T02:00:00.000Z', 자리: path.join(m.root, '없는-작업본') } }, 풀림: [] }));
  const replan = m.run('--부터', '2026-11-20', '--일수', '2', '--다시', '--쓰기');
  assert.equal(replan.status, 0, replan.stderr);
  const after = 읽기(m, G).판.filter((p) => p.돌림);
  assert.deepEqual(after.filter((p) => p.계정 === th.계정).map((p) => p.시각), [th.시각]);
  assert.deepEqual(after.filter((p) => p.계정 === jp.계정).map((p) => p.시각), [jp.시각]);
  const ledger = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--장부', '--json').stdout);
  assert.equal(ledger.rows.find((r) => r.원본 === G && r.계정 === th.계정).상태, '거는 중');
  assert.equal(ledger.rows.find((r) => r.원본 === G && r.계정 === jp.계정).상태, '예약됨(다른 작업본)');
  assert.equal(ledger.doubles.length, 0);
  const stop = m.run('--멈춤', G, '--까닭', '시험');
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(stop.stdout, /거는 중인 판 1개/);
  assert.match(stop.stdout, /이미 예약된 판 1개/);
  assert.deepEqual(읽기(m, G).판.filter((p) => p.돌림).map((p) => p.계정).sort(), [jp.계정, th.계정].sort());
});

test('돌림표 — 나가지 않는 판(취소됨 · 지움)은 칸을 비우되 그 계정에 그 원본을 다시 주지 않는다 · 한 계정의 여러 줄은 걸린 줄로 읽는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '2', '--쓰기').status, 0);
  const th = 읽기(m, G).판.find((p) => p.계정 === 'lab-th-youtube' && p.돌림);
  const day = th.시각.slice(0, 10);
  const res = 읽기(m, G, '게시결과.json');
  res.판.push({ 계정: th.계정, 상태: '취소됨', 방법: '작업실', 작업: 'job-1' });
  적기(m, G, '게시결과.json', res);
  const cellsOf = (r) => JSON.parse(r.stdout).cells.filter((c) => c.account === th.계정 && c.format === '이야기');
  const plan = cellsOf(m.run('--부터', '2026-11-20', '--일수', '6', '--json'));
  assert.equal(plan.some((c) => c.original === G), false, '취소된 원본을 다시 받지 않는다');
  assert.notEqual(plan.find((c) => c.day === day).why, '이미 찬 칸', '그 칸은 비어 있다');
  // --다시가 취소된 돌림 판을 빼도(게시결과 줄만 남는다) 다시 주지 않는다
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '2', '--다시', '--쓰기').status, 0);
  assert.equal(읽기(m, G).판.some((p) => p.계정 === th.계정), false);
  assert.equal(cellsOf(m.run('--부터', '2026-11-20', '--일수', '6', '--json')).some((c) => c.original === G), false);
  // 여러 줄: 취소됨(옛 작업) 뒤에 예약됨(새 작업) — 걸린 판으로 읽어 --다시에도 남는다
  const other = 읽기(m, N).판.find((p) => p.계정 === th.계정 && p.돌림);
  assert.ok(other, '나 편에 태국 판이 있다');
  const res2 = 읽기(m, N, '게시결과.json');
  res2.판.push({ 계정: th.계정, 상태: '취소됨', 방법: '작업실', 작업: 'job-2' }, { 계정: th.계정, 상태: '예약됨', 방법: '작업실', 작업: 'job-3', 시각: other.시각 });
  적기(m, N, '게시결과.json', res2);
  assert.equal(m.run('--부터', '2026-11-20', '--일수', '2', '--다시', '--쓰기').status, 0);
  assert.deepEqual(읽기(m, N).판.filter((p) => p.계정 === th.계정).map((p) => p.시각), [other.시각]);
  const ledger = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--장부', '--json').stdout);
  assert.equal(ledger.rows.find((r) => r.원본 === N && r.계정 === th.계정).상태, '예약됨');
});

test('돌림표 — 같은 이야기를 다른 편 폴더로 낸 계정(「돌림」.같은이야기)은 이 원본을 다시 받지 않는다(11-10 지마 — 영어 · 간체 · 버마어 판이 다른 폴더로 나갔다)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const 짝 = 'LAB_가_20261102';
  fs.mkdirSync(path.join(m.root, 짝, '게시'), { recursive: true });
  적기(m, 짝, '준비.json', { 브랜드: 'LAB', 슬롯: '2026-11-06', 판: [
    { 계정: 'lab-th-youtube', 파일: 'y.mp4', 시각: '2026-11-06T21:00:00+09:00', AI표시: false },
    { 계정: 'lab-jp-youtube', 파일: 'z.mp4', 시각: '2026-11-06T21:00:00+09:00', AI표시: false }] });
  적기(m, 짝, '게시결과.json', { 판: [{ 계정: 'lab-th-youtube', 상태: '게시됨', 게시물ID: 'yt-1' }, { 계정: 'lab-jp-youtube', 상태: '취소됨' }] });
  const cellsOf = (account) => {
    const r = m.run('--부터', '2026-11-20', '--일수', '6', '--json');
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout).cells.filter((c) => c.account === account && c.format === '이야기');
  };
  assert.ok(cellsOf('lab-th-youtube').some((c) => c.original === G), '같은이야기를 적기 전에는 태국 채널이 가 편을 받는다');
  const prep = 읽기(m, G);
  prep.돌림.같은이야기 = [짝];
  적기(m, G, '준비.json', prep);
  const th = cellsOf('lab-th-youtube');
  assert.equal(th.some((c) => c.original === G), false, '다른 폴더로 같은 이야기를 받은 계정은 이 원본을 다시 받지 않는다');
  assert.ok(th.some((c) => c.original === N), '다른 원본은 그대로 받는다');
  assert.ok(cellsOf('lab-jp-youtube').some((c) => c.original === G), '그 편이 취소된 계정은 받은 것으로 치지 않는다');
  // 없는 폴더 이름은 셈을 멈춘다(조용히 넘기면 같은 이야기가 또 나간다)
  prep.돌림.같은이야기 = ['LAB_없는편_20261101'];
  적기(m, G, '준비.json', prep);
  const bad = m.run('--부터', '2026-11-20', '--일수', '2', '--json');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /같은이야기/);
});

test('돌림표 — 「미정」 까닭 · 앞 칸이 닫힌 계정 · --준비무시는 셈만(--쓰기와 함께 못 쓴다)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원장고침(m, (acc) => { acc['lab-jp-youtube'].dailyTimesFrom = '미정'; });
  const j = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--json').stdout);
  assert.ok(j.notReady.some((x) => x.account === 'lab-vn-tiktok' && x.why.some((w) => /시작 날 미정/.test(w))));
  assert.deepEqual(j.closedStory, [{ account: 'lab-jp-youtube', closed: ['13:00 이야기'] }]);
  assert.deepEqual([...new Set(j.cells.filter((c) => c.account === 'lab-jp-youtube').map((c) => c.slot))], ['21:00']);
  // --준비무시: 준비 안 된 계정 · 「미정」 칸까지 셈에 넣되, 까닭은 원장 값 그대로 적는다
  const loose = m.run('--부터', '2026-11-20', '--일수', '2', '--준비무시');
  assert.equal(loose.status, 0, loose.stderr);
  assert.match(loose.stdout, /\(--준비무시 — 셈만 해 본 것\) 실제로는 칸을 못 받는 계정 2/);
  assert.match(loose.stdout, /lab-vn-tiktok\(시작 날 미정\(dailyFrom\)\)/);
  assert.match(loose.stdout, /lab-np-facebook\(프로필 빈 칸/);
  assert.match(loose.stdout, /실제로는 닫힌 칸이 있는 계정 1/);
  const lj = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--준비무시', '--json').stdout);
  assert.ok(lj.cells.some((c) => c.account === 'lab-vn-tiktok'));
  assert.ok(lj.cells.some((c) => c.account === 'lab-jp-youtube' && c.slot === '13:00'));
  // --쓰기와 함께면 거절하고 아무것도 쓰지 않는다
  const before = fs.readFileSync(path.join(m.root, G, '게시', '준비.json'), 'utf8');
  const refused = m.run('--부터', '2026-11-20', '--일수', '2', '--준비무시', '--쓰기');
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /셈만 해 보는 길/);
  assert.equal(fs.readFileSync(path.join(m.root, G, '게시', '준비.json'), 'utf8'), before);
});

// ── 같은 언어 묶음(돌림 ⑥ — 유호님 11-10 지적 — 같은 언어를 쓰는 나라 계정끼리 같은 영상이 겹치지 않게) ──
test('같은 언어 묶음 — 같은 원본은 24시간 안에 둘이 받지 않고(필리핀은 판이 필리핀어여도 영어 묶음), 묶음표 · 겹침 확인', () => {
  const en = (versionKey, timeZone, extra = {}) => acct('youtube', versionKey, timeZone, { language: 'en', ...extra });
  const accounts = {
    us: en('US', 'America/New_York'), ca: en('CA', 'America/Toronto'), au: en('AU', 'Australia/Sydney'), nz: en('NZ', 'Pacific/Auckland'),
    ph: acct('youtube', 'PH', 'Asia/Manila', { language: 'fil', group: 'en' }), th: acct('youtube', 'TH', 'Asia/Bangkok'),
    mx: acct('youtube', 'MX', 'America/Mexico_City', { language: 'es' }), py: acct('youtube', 'PY', 'America/Asuncion', { language: 'es' }),
    'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
  };
  assert.deepEqual(돌림.bundlesOf(accounts).map((b) => `${b.platform}|${b.group}|${b.accounts.join(',')}`), ['youtube|en|us,ca,au,nz,ph', 'youtube|es|mx,py']);
  // 시드니 13:00 → 다음 날 오클랜드 13:00은 22시간 — 예전 20시간 셈은 넘겼지만 같은 언어 묶음은 24시간
  const au = [{ account: 'au', platform: 'youtube', language: 'en', group: 'en', ms: T.zonedMs('2026-11-20', '13:00', 'Australia/Sydney') }];
  assert.equal(돌림.clashes(au, accounts.nz, T.zonedMs('2026-11-21', '13:00', 'Pacific/Auckland'), 돌림.DEFAULTS), true);
  assert.equal(돌림.clashes(au, accounts.nz, T.zonedMs('2026-11-22', '13:00', 'Pacific/Auckland'), 돌림.DEFAULTS), false);
  assert.equal(돌림.clashes(au, accounts.ph, T.zonedMs('2026-11-20', '13:00', 'Asia/Manila'), 돌림.DEFAULTS), true, '필리핀도 영어 묶음');
  assert.equal(돌림.clashes(au, accounts.th, T.zonedMs('2026-11-20', '13:00', 'Asia/Bangkok'), 돌림.DEFAULTS), false, '말이 다른 유튜브 판은 같은 날 된다');
  const keys = ['US', 'CA', 'AU', 'NZ', 'PH', 'TH', 'MX', 'PY'];
  const { originals, existing } = seeded(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], '이야기', keys);
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 6 });
  const filled = r.cells.filter((c) => c.original && c.format === '이야기');
  let pairs = 0;
  for (const x of filled) for (const y of filled) {
    if (x === y || x.original !== y.original || !돌림.sameGroup(accounts[x.account], accounts[y.account], 'youtube')) continue;
    pairs += 1;
    assert.ok(Math.abs(x.ms - y.ms) >= 24 * HOUR, `${x.account} · ${y.account} ${x.original}: ${Math.abs(x.ms - y.ms) / HOUR}시간`);
  }
  assert.ok(pairs > 0, '같은 원본을 묶음의 여러 계정이 (날을 띄워) 받는다');
  assert.ok(filled.some((c) => c.account === 'ph'));
  assert.deepEqual(돌림.overlaps(r.plates, accounts), []);
  // 원본 여덟 · 엿새면 영어 다섯 곳의 이야기 서른 칸 가운데 스물아홉이 찬다(24시간을 띄우느라 동쪽 계정으로 넘어가는 차례에서 하루를 쉰다 —
  // 새 원본이 날마다 들어오는 실제 흐름에서는 처음 재고 여섯부터 다 찬다: 11-10 재 본 값 70/70)
  assert.ok(filled.filter((c) => 돌림.groupOf(accounts[c.account]) === 'en').length >= 27);
  // overlaps — 24시간 안이거나 같은 파일인 짝만(말이 다른 계정은 같은 파일이어도 넘어간다)
  const ov = 돌림.overlaps([{ original: 'x', account: 'us', ms: 0, file: 'f1' }, { original: 'x', account: 'ca', ms: 30 * HOUR, file: 'f1' }, { original: 'x', account: 'au', ms: 60 * HOUR, file: 'f2' },
    { original: 'x', account: 'nz', ms: 70 * HOUR, file: 'f3' }, { original: 'x', account: 'th', ms: 0, file: 'f1' }, { original: 'y', account: 'ph', ms: 0, file: 'f1' }], accounts);
  assert.deepEqual(ov.map((o) => `${o.a}·${o.b}:${o.hours}:${o.sameFile}`), ['us·ca:30:true', 'au·nz:10:false']);
});

test('같은 언어 묶음 — 같은 파일(같은 판본 지문 · 같은 판본 키)은 날이 달라도 둘이 받지 않는다', () => {
  const en = (versionKey, timeZone) => acct('youtube', versionKey, timeZone, { language: 'en' });
  const seed = acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' });
  const existing = [{ original: 'x1', account: 'seed-ig', time: '2026-10-10T21:00:00+09:00' }];
  // 미국 · 캐나다 판본이 같은 파일(지문 aaa), 호주는 다른 파일
  const x1 = { id: 'x1', format: '이야기', versions: { US: { ready: true, sha: 'aaa' }, CA: { ready: true, sha: 'aaa' }, AU: { ready: true, sha: 'bbb' } } };
  const p = 돌림.plan({ accounts: { us: en('US', 'America/New_York'), ca: en('CA', 'America/Toronto'), au: en('AU', 'Australia/Sydney'), 'seed-ig': seed }, originals: [x1], existing, from: '2026-11-20', days: 5 });
  const got = p.cells.filter((c) => c.original === 'x1').map((c) => c.account).sort();
  assert.deepEqual(got, ['au', 'us'], '캐나다는 미국과 같은 파일이라 끝까지 못 받는다');
  assert.ok(p.cells.some((c) => c.account === 'ca' && /같은 파일/.test(c.why || '')));
  // 지문이 없어도 같은 판본 키를 둘이 쓰면 같은 파일이다
  const x2 = { id: 'x2', format: '이야기', versions: ver(['EN']) };
  const q = 돌림.plan({ accounts: { a: en('EN', 'America/New_York'), b: en('EN', 'Europe/London'), 'seed-ig': seed }, originals: [x2], existing: [{ original: 'x2', account: 'seed-ig', time: '2026-10-10T21:00:00+09:00' }], from: '2026-11-20', days: 5 });
  assert.equal(q.cells.filter((c) => c.original === 'x2').length, 1);
  // 이미 있는 판의 지문(existing file)도 센다 — 손으로 단 미국 판과 같은 파일인 캐나다 판본
  const x3 = { id: 'x3', format: '이야기', versions: { CA: { ready: true, sha: 'ccc' } } };
  const r = 돌림.plan({ accounts: { us: en('US', 'America/New_York'), ca: en('CA', 'America/Toronto'), 'seed-ig': seed }, originals: [x3],
    existing: [{ original: 'x3', account: 'seed-ig', time: '2026-10-10T21:00:00+09:00' }, { original: 'x3', account: 'us', time: '2026-11-01T13:00:00-05:00', file: 'ccc' }], from: '2026-11-20', days: 3 });
  assert.equal(r.cells.filter((c) => c.original === 'x3').length, 0);
});

test('씨앗 판이 걸리지 않은 채 지나갔으면 씨앗 첫 판으로 세지 않는다 — 나가지 않은 판의 24시간 뒤를 다른 계정의 문으로 삼지 않는다(11-11 P3-1)', () => {
  const accounts = { th: acct('youtube', 'TH', 'Asia/Bangkok'), 'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
    'seed-fb': acct('facebook', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }) };
  const originals = [{ id: 'a', format: '이야기', versions: ver(['TH', 'MN']) }];
  const th = (existing) => 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 2 }).cells.filter((c) => c.account === 'th' && c.format === '이야기');
  const seedPlate = (extra) => ({ original: 'a', account: 'seed-ig', time: '2026-11-18T21:00:00+09:00', ...extra });
  assert.equal(th([seedPlate({ booked: true })])[0].original, 'a', '나간 씨앗 판은 씨앗 첫 판이다');
  assert.equal(th([seedPlate({})])[0].original, 'a', '걸렸는지 모르는 판(옛 꼴)은 예전처럼 센다');
  const missed = th([seedPlate({ booked: false })]);
  assert.equal(missed.some((c) => c.original), false, '걸리지 않은 채 지나간 씨앗 판뿐이면 다른 계정은 기다린다');
  assert.match(missed[0].why, /씨앗 계정이 아직/);
  // 다른 씨앗 판이 나갔으면 그 판이 씨앗 첫 판이다 — 11-19 13:00에 나간 판의 24시간 뒤 첫 14시(11-20 14:00) 뒤 칸부터
  const other = th([seedPlate({ booked: false }), { original: 'a', account: 'seed-fb', time: '2026-11-19T13:00:00+09:00', booked: true }]);
  assert.deepEqual(other.map((c) => [c.day, c.original]), [['2026-11-20', 'a'], ['2026-11-21', null]]);
});

test('연재 — 같은 차례 번호의 옛 곡을 받은 계정은 그 번호의 고친 곡을 다시 받지 않는다(11-11 P3-4)', () => {
  const accounts = { th: songAcct('youtube', 'TH', 'Asia/Bangkok', { language: 'th' }), jp: songAcct('youtube', 'JP', 'Asia/Tokyo', { language: 'ja' }),
    'seed-ig': songAcct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }) };
  const base = songs(3, ['TH', 'JP']);
  // 둘째 곡을 고쳤다 — 옛 곡 n2는 멈춤, 새 원본 n2b를 같은 차례 번호로
  const originals = [base[0], { ...base[1], stopped: true }, { id: 'n2b', format: '노래', versions: ver(['TH', 'JP']), series: { id: '한글노래', order: 2 } }, base[2]];
  const existing = [...seedPlates(['n1', 'n2', 'n2b', 'n3']),
    { original: 'n1', account: 'th', time: '2026-11-18T21:00:00+07:00' }, { original: 'n2', account: 'th', time: '2026-11-19T21:00:00+07:00' }];
  const got = (k) => 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 4 }).cells.filter((c) => c.account === k && c.format === '노래');
  // 옛 둘째 곡을 받은 태국 채널: 셋째 곡으로 넘어가고 고친 둘째 곡은 받지 않는다
  assert.deepEqual(got('th').map((c) => c.original), ['n3', null, null, null]);
  assert.equal(got('th')[1].why, '이 계정이 노래 원본을 다 올림');
  // 둘째 차례에 아직 안 온 일본 채널: 1 → 고친 둘째 곡 → 3
  assert.deepEqual(got('jp').map((c) => c.original), ['n1', 'n2b', 'n3', null]);
});

test('돌림표 명령 --묶음 — 묶음표 · 나라별판이 같은 파일인 원본 · 판 겹침(--장부도 같이 본다)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원장고침(m, (acc) => {
    acc['lab-us-youtube'] = { ...acc['lab-th-youtube'], countryCode: 'US', language: 'en', timeZone: 'America/New_York' };
    acc['lab-ca-youtube'] = { ...acc['lab-th-youtube'], countryCode: 'CA', language: 'en', timeZone: 'America/Toronto' };
  });
  const 판본더하기 = (name, key, body) => {
    const dir = path.join(m.root, name);
    fs.mkdirSync(path.join(dir, '게시', '판본', key), { recursive: true });
    const video = path.join(dir, '게시', '판본', key, 'video.mp4');
    const text = path.join(dir, '게시', '판본', key, '글.json');
    fs.writeFileSync(video, body);
    fs.writeFileSync(text, JSON.stringify({ 줄: [`${name} ${key}`] }));
    원고쓰기(dir, key, 'en');
    const prep = 읽기(m, name);
    prep.돌림.판본[key] = { 언어: 'en', 파일: `게시/판본/${key}/video.mp4`, 글: `게시/판본/${key}/글.json`, 원고: { youtube: `게시/판본/${key}/원고.json` },
      검수: { 뜻: { 결과: '통과', 지문: sha(text) }, 글자: { 결과: '통과', 지문: sha(video) } } };
    적기(m, name, '준비.json', prep);
  };
  판본더하기(G, 'US', '영어판 한 파일');
  판본더하기(G, 'CA', '영어판 한 파일'); // 나라별판을 따로 안 만들고 같은 파일을 둘에 넣었다
  판본더하기(N, 'US', '나-미국판');
  판본더하기(N, 'CA', '나-캐나다판');
  const range = ['--부터', '2026-11-20', '--일수', '4'];
  const bad = m.run('--묶음', ...range);
  assert.equal(bad.status, 1, bad.stderr);
  assert.match(bad.stdout, /youtube · en\(2\): lab-us-youtube\[US\] · lab-ca-youtube\[CA\]/);
  assert.match(bad.stdout, /나라별판이 같은 파일인 원본 1: LAB_가_mn_20261101 US = CA/);
  assert.match(bad.stdout, /판 겹침.* 0$/m, '셈은 같은 파일을 둘에 주지 않는다');
  const cells = JSON.parse(m.run(...range, '--json').stdout).cells.filter((c) => c.original);
  assert.equal(cells.filter((c) => c.original === G && /-(us|ca)-/.test(c.account)).length, 1, '같은 파일인 가 편은 미국 · 캐나다 가운데 한 곳만');
  assert.equal(cells.filter((c) => c.original === N && /-(us|ca)-/.test(c.account)).length, 2);
  // 캐나다판을 따로 만들면 풀린다
  판본더하기(G, 'CA', '가-캐나다판');
  const ok = m.run('--묶음', ...range);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /나라별판이 같은 파일인 원본 0/);
  assert.equal(m.run(...range, '--쓰기').status, 0);
  const ledger = m.run(...range, '--장부', '--json');
  assert.equal(ledger.status, 0, ledger.stderr);
  assert.deepEqual(JSON.parse(ledger.stdout).sameLanguage, []);
  // 누가 손으로 캐나다 판 시각을 미국 판과 같은 때로 옮기면 장부 · 묶음 확인이 잡는다
  const prep = 읽기(m, G);
  const us = prep.판.find((p) => p.계정 === 'lab-us-youtube');
  const ca = prep.판.find((p) => p.계정 === 'lab-ca-youtube');
  assert.ok(us && ca, '가 편에 미국 · 캐나다 판이 있다');
  assert.ok(Math.abs(Date.parse(us.시각) - Date.parse(ca.시각)) >= 24 * HOUR);
  ca.시각 = us.시각;
  적기(m, G, '준비.json', prep);
  const clash = m.run(...range, '--장부');
  assert.equal(clash.status, 1);
  assert.match(clash.stdout, /! 같은 언어 묶음 겹침: LAB_가_mn_20261101: lab-(us|ca)-youtube · lab-(us|ca)-youtube\(youtube · en · 0시간\)/);
  const again = m.run('--묶음', ...range);
  assert.equal(again.status, 1);
  assert.match(again.stdout, /판 겹침.* 1: LAB_가_mn_20261101/);
});

// ── 나라별 계정은 이야기 칸부터 연다(11-10 유호님 「지금 길로 열어」 뒤) — 퀴즈 칸은 dailyFormatsFrom {퀴즈: 「미정」}으로 닫아 둔다 ──
test('형식마다 여는 날 — 퀴즈 칸을 닫아 둔 계정은 이야기 칸만 받는다(첫 판 시험과 함께 — 판 하나)', () => {
  const closed = { dailyFormatsFrom: { 퀴즈: '미정' } };
  const accounts = {
    'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
    th: acct('youtube', 'TH', 'Asia/Bangkok', closed), jp: acct('youtube', 'JP', 'Asia/Tokyo', { ...closed, trial: true }), vn: acct('youtube', 'VN', 'Asia/Ho_Chi_Minh'),
  };
  const story = seeded(['a', 'b'], '이야기', ['TH', 'JP', 'VN']);
  const quiz = seeded(['q1', 'q2'], '퀴즈', ['TH', 'JP', 'VN']);
  const r = 돌림.plan({ accounts, originals: [...story.originals, ...quiz.originals], existing: [...story.existing, ...quiz.existing], from: '2026-11-20', days: 2 });
  const of = (k) => r.cells.filter((c) => c.account === k);
  assert.deepEqual([...new Set(of('th').map((c) => c.format))], ['이야기']);
  assert.equal(of('th').filter((c) => c.original).length, 2);
  assert.deepEqual(of('jp').map((c) => [c.format, Boolean(c.original)]), [['이야기', true], ['이야기', false]], '첫 판 시험 계정은 이야기 한 판만');
  assert.equal(of('vn').filter((c) => c.format === '퀴즈' && c.original).length, 2, '닫지 않은 계정은 퀴즈 칸도 받는다');
});

test('돌림표 명령 — 퀴즈 칸을 닫아 둔 계정은 「닫힌 칸이 있는 계정」에 보이고 퀴즈 칸이 없다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원장고침(m, (acc) => { acc['lab-th-youtube'].dailyFormatsFrom = { 퀴즈: '미정' }; });
  const j = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--json').stdout);
  assert.deepEqual(j.closedStory, [{ account: 'lab-th-youtube', closed: ['21:00 퀴즈'] }]);
  assert.deepEqual([...new Set(j.cells.filter((c) => c.account === 'lab-th-youtube').map((c) => c.slot))], ['13:00']);
  assert.deepEqual([...new Set(j.cells.filter((c) => c.account === 'lab-jp-youtube').map((c) => c.slot))].sort(), ['13:00', '21:00']);
  // --준비무시는 닫힌 형식 칸도 셈에 넣어 본다
  const loose = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--준비무시', '--json').stdout);
  assert.ok(loose.cells.some((c) => c.account === 'lab-th-youtube' && c.slot === '21:00'));
});

// ── 21:00 노래 칸 · 연재(차례 고정) · 이미받음(11-10 밤 — 유호님 「초보자에게는 노래」, 한글 노래 여섯 곡의 나라별판으로 연다) ──
const songs = (n, keys, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `n${i + 1}`, format: '노래', versions: ver(keys), series: { id: '한글노래', order: i + 1 }, ...extra }));
const seedPlates = (ids) => ids.map((id, i) => ({ original: id, account: 'seed-ig', time: `2026-10-${String(10 + i).padStart(2, '0')}T21:00:00+09:00` }));
const songAcct = (platform, key, zone, extra = {}) => acct(platform, key, zone, { dailyFormats: ['이야기', '노래'], ...extra });

test('형식 — 이야기 · 노래 · 퀴즈(21:00 칸은 노래)', () => {
  assert.deepEqual([...돌림.FORMATS], ['이야기', '노래', '퀴즈']);
});

test('연재(차례 고정) — 틱톡 다섯 곳이 1 → 6 차례로만 받고, 첫 곡을 하루에 한 곳씩 받아 시작 날이 어긋난다', () => {
  const zones = ['Asia/Bangkok', 'Asia/Jakarta', 'Asia/Ho_Chi_Minh', 'Asia/Almaty', 'America/Mexico_City'];
  const accounts = Object.fromEntries(zones.map((z, i) => [`tt${i}`, songAcct('tiktok', `C${i}`, z)]));
  accounts['seed-ig'] = songAcct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' });
  const originals = songs(6, zones.map((_, i) => `C${i}`));
  const existing = seedPlates(originals.map((o) => o.id));
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 12 });
  const song = r.cells.filter((c) => c.format === '노래' && c.original);
  const starts = [];
  for (const k of Object.keys(accounts).filter((x) => x.startsWith('tt'))) {
    const mine = song.filter((c) => c.account === k).sort((x, y) => x.ms - y.ms).map((c) => c.original);
    assert.deepEqual(mine, ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].slice(0, mine.length), `${k}: 1 → 6 차례(건너뛰지 않는다)`);
    assert.ok(mine.length >= 5, `${k}: 12일 안에 다섯 곡 넘게 받는다(${mine.length})`);
    starts.push(song.find((c) => c.account === k && c.original === 'n1').day);
  }
  assert.equal(new Set(starts).size, starts.length, `첫 곡 받는 날이 계정마다 다르다(${starts.join(' · ')})`);
  // 같은 플랫폼에서 같은 원본은 20시간 안에 둘이 안 나간다(①은 그대로)
  for (const x of song) for (const y of song) if (x !== y && x.original === y.original) assert.ok(Math.abs(x.ms - y.ms) >= 20 * HOUR, `${x.account}·${y.account} ${x.original}`);
  // 같은 입력이면 늘 같은 표
  assert.deepEqual(돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 12 }).cells.map((c) => c.original), r.cells.map((c) => c.original));
});

test('연재 — 앞 차례 판본이 검수 전이면 기다리고, 멈춘 차례는 건너뛰고, 뒤에 걸린 앞 차례보다 먼저 받지 않는다', () => {
  const accounts = { th: songAcct('youtube', 'TH', 'Asia/Bangkok', { language: 'th' }), 'seed-ig': songAcct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }) };
  const base = songs(3, ['TH']);
  const existing = seedPlates(['n1', 'n2', 'n3']);
  const got = (originals, more = []) => 돌림.plan({ accounts, originals, existing: [...existing, ...more], from: '2026-11-20', days: 4 }).cells.filter((c) => c.account === 'th' && c.format === '노래');
  assert.deepEqual(got(base).map((c) => c.original), ['n1', 'n2', 'n3', null]);
  // 둘째 곡의 태국 판본이 검수 전 — 셋째로 건너뛰지 않고 기다린다
  const noSecond = base.map((o) => (o.id === 'n2' ? { ...o, versions: {} } : o));
  const waited = got(noSecond);
  assert.deepEqual(waited.map((c) => c.original), ['n1', null, null, null]);
  assert.match(waited[1].why, /연재 「한글노래」 2번째를 먼저/);
  // 뒤 곡이 모두 검수 전이면 「다 올림」이 아니라 어느 차례의 판본이 검수 전인지 말한다(11-11 Fable 검수)
  const noRest = got(base.map((o) => (o.id === 'n1' ? o : { ...o, versions: {} })));
  assert.deepEqual(noRest.map((c) => c.original), ['n1', null, null, null]);
  assert.equal(noRest[1].why, '안 받은 노래 원본 2편이 아직 못 나간다 — 연재 「한글노래」 2번째 판본부터 · TH 판본이 아직 못 듦 2편(판본 없음)');
  // 둘째 곡이 멈춤(비상 정지) — 그 차례는 건너뛴다(한 곡의 정지가 연재를 세우지 않는다)
  assert.deepEqual(got(base.map((o) => (o.id === 'n2' ? { ...o, stopped: true } : o))).map((c) => c.original), ['n1', 'n3', null, null]);
  // 첫 곡이 사흘째 칸에 이미 걸려 있다 — 그 앞 날에는 둘째 곡을 받지 않는다
  const later = got(base, [{ original: 'n1', account: 'th', time: '2026-11-22T21:00:00+07:00' }]);
  assert.deepEqual(later.map((c) => [c.day.slice(8), c.original]), [['20', null], ['21', null], ['22', null], ['23', 'n2']]);
  assert.match(later[0].why, /1번째를 먼저/);
  // 연재가 아닌 노래는 차례와 상관없이 받는다
  const mixed = [...noSecond, { id: 'free', format: '노래', versions: ver(['TH']) }];
  assert.deepEqual(got(mixed, seedPlates(['free'])).map((c) => c.original).filter(Boolean).sort(), ['free', 'n1']);
});

test('이미받음 · 같은이야기의 때(seenAt) — 다른 길로 올린 계정은 다시 받지 않고, 때가 있는 씨앗은 씨앗 첫 판으로 센다', () => {
  const accounts = { th: songAcct('youtube', 'TH', 'Asia/Bangkok', { language: 'th' }), us: songAcct('youtube', 'US', 'America/New_York', { language: 'en' }),
    'seed-ig': songAcct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }) };
  const originals = songs(1, ['TH', 'US', 'MN']);
  const cells = (existing) => 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 2 }).cells.filter((c) => c.format === '노래');
  // 씨앗이 다른 길로 올렸지만 때를 모른다 — 씨앗 첫 판이 없어 다른 계정은 기다린다
  const blind = cells([{ original: 'n1', account: 'seed-ig', gone: true }]);
  assert.equal(blind.some((c) => c.original), false);
  assert.match(blind.find((c) => c.account === 'th').why, /씨앗 계정이 아직/);
  // 때를 적으면 씨앗 첫 판으로 센다 · 이미 받은 미국 채널은 받지 않는다
  const seen = cells([{ original: 'n1', account: 'seed-ig', gone: true, seenAt: '2026-10-06T21:00:00+09:00' }, { original: 'n1', account: 'us', gone: true }]);
  assert.deepEqual(seen.filter((c) => c.original).map((c) => c.account), ['th']);
  assert.equal(seen.some((c) => c.account === 'us' && c.original), false);
});

test('돌림표 명령 — 원고에 게시글 고칠 것(상대 날짜)이 있거나 원고 파일이 없는 판본은 돌림에 안 든다(그 원고가 판이 되면 올리기 전 검사가 편 전체를 막는다)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원고쓰기(path.join(m.root, G), 'TH', 'en', { pinnedComment: 'Which one did you use this week?' });
  fs.rmSync(path.join(m.root, N, '게시', '판본', 'TH', '원고.json'));
  const j = JSON.parse(m.run('--부터', '2026-11-20', '--일수', '2', '--json').stdout);
  assert.match(j.versions[G].TH.why, /원고 고칠 것 — youtube 고정 댓글: 상대 날짜 「this week」/);
  assert.match(j.versions[N].TH.why, /원고 고칠 것 — youtube: 원고 파일이 없다/);
  assert.equal(j.versions[G].JP.ready, true, '다른 판본은 그대로 든다');
  assert.equal(j.cells.some((c) => c.account === 'lab-th-youtube' && c.original), false);
  assert.ok(j.cells.some((c) => c.account === 'lab-jp-youtube' && c.original === G));
});

test('다른 길로 올린 판(seenAt)도 같은 원본의 판이다 — 같은 언어 묶음 24시간 · 같은 플랫폼 20시간 창에 든다(11-11: @synkkorean의 지마 영어판이 창 밖이었다)', () => {
  const accounts = {
    'seed-ig': acct('instagram', 'MN', 'Asia/Ulaanbaatar', { seed: true, dailyFrom: '2099-01-01' }),
    glob: acct('youtube', 'EN', 'Asia/Seoul', { language: 'en', seed: true, dailyFrom: '2099-01-01' }), // 다른 편 폴더로 영어판을 올린 전 세계 채널
    au: acct('youtube', 'AU', 'Australia/Sydney', { language: 'en' }),
    th: acct('youtube', 'TH', 'Asia/Bangkok', { language: 'th' }),
    mm: acct('tiktok', 'MM', 'Asia/Yangon', { language: 'my', dailyFrom: '2099-01-01' }), // 다른 편 폴더로 버마어판을 올린 틱톡
    vn: acct('tiktok', 'VN', 'Asia/Ho_Chi_Minh', { language: 'vi' }),
  };
  const originals = [{ id: 's1', format: '이야기', versions: ver(['MN', 'EN', 'AU', 'TH', 'MM', 'VN']) }];
  const old = { original: 's1', account: 'seed-ig', time: '2026-10-31T13:00:00+08:00' }; // 씨앗 첫 판 — 점검은 오래전에 지났다
  const at = '2026-11-19T21:00:00+09:00';
  const story = (existing) => 돌림.plan({ accounts, originals, existing: [old, ...existing], from: '2026-11-20', days: 2 }).cells.filter((c) => c.format === '이야기');
  const dayOf = (cells, k) => (cells.find((c) => c.account === k && c.original === 's1') || {}).day || null;
  // 때를 모르는 「이미 받음」은 예전 그대로 — 그 계정만 다시 받지 않는다
  const blind = story([{ original: 's1', account: 'glob', gone: true }, { original: 's1', account: 'mm', gone: true }]);
  assert.deepEqual([dayOf(blind, 'au'), dayOf(blind, 'th'), dayOf(blind, 'vn')], ['2026-11-20', '2026-11-20', '2026-11-20']);
  // 때가 있으면 그 판과 창을 띄운다: 호주(같은 말 유튜브 — 11-20 13:00 시드니는 14시간 뒤) · 베트남 틱톡(같은 플랫폼 — 18시간 뒤)은 하루 미룬다.
  // 태국 유튜브는 말이 달라 그날 받는다
  const seen = story([{ original: 's1', account: 'glob', gone: true, seenAt: at }, { original: 's1', account: 'mm', gone: true, seenAt: at }]);
  assert.deepEqual([dayOf(seen, 'au'), dayOf(seen, 'th'), dayOf(seen, 'vn')], ['2026-11-21', '2026-11-20', '2026-11-21']);
  // 그 계정은 다시 받지 않고, 칸도 차지하지 않는다(그 칸은 그 편 폴더의 판이 따로 채운다)
  assert.equal(seen.some((c) => ['glob', 'mm'].includes(c.account) && c.original), false);
  // 겹침 확인(overlaps)도 그 판을 본다 — 손으로 24시간 안에 단 판이 있으면 짝으로 나온다
  const r = 돌림.plan({ accounts, originals, existing: [old, { original: 's1', account: 'glob', gone: true, seenAt: at }, { original: 's1', account: 'au', time: '2026-11-20T13:00:00+11:00' }], from: '2026-11-20', days: 1 });
  assert.deepEqual(돌림.overlaps(r.plates, accounts).map((o) => [o.a, o.b, o.hours, o.sameFile].join('|')), ['glob|au|14|false']);
});

test('돌림표 명령 — 원장의 여는 날 · 형식 열쇠 꼴이 틀리면 셈을 멈춘다(조용히 칸이 닫히거나 열리지 않게 — 11-11 P2-13)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const run = () => m.run('--부터', '2026-11-20', '--일수', '2', '--json');
  assert.equal(run().status, 0);
  원장고침(m, (acc) => { acc['lab-th-youtube'].dailyFrom = '2026-11-3'; });
  const bad = run();
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /계정 원장\(sns-계정\.json\)의 칸 · 여는 날 꼴이 틀렸다[\s\S]*lab-th-youtube: dailyFrom 「2026-11-3」/);
  원장고침(m, (acc) => { acc['lab-th-youtube'].dailyFrom = '2026-11-03'; acc['lab-jp-youtube'].dailyFormatsFrom = { '퀴즈 ': '미정' }; });
  assert.match(run().stderr, /lab-jp-youtube: dailyFormatsFrom 열쇠 「퀴즈 」/);
  원장고침(m, (acc) => { acc['lab-jp-youtube'].dailyFormatsFrom = { 퀴즈: '미정' }; });
  assert.equal(run().status, 0);
  assert.equal(m.run('--점검', '--json').status, 0);
});

test('돌림표 명령 --장부 — 같은 이야기를 다른 편 폴더로 낸 판도 같은 언어 묶음 겹침에서 그 원본의 판으로 짝을 짓는다(11-11 P3-5)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원장고침(m, (acc) => {
    acc['lab-us-youtube'] = { ...acc['lab-th-youtube'], countryCode: 'US', language: 'en', timeZone: 'America/New_York' };
    acc['lab-ca-youtube'] = { ...acc['lab-th-youtube'], countryCode: 'CA', language: 'en', timeZone: 'America/Toronto' };
  });
  // 가 편의 영어판을 다른 폴더(LAB_가_20261102)로 미국 채널에 걸어 둠 · 가 편의 돌림 판이 같은 때 캐나다 채널에 달려 있음
  const 짝 = 'LAB_가_20261102';
  fs.mkdirSync(path.join(m.root, 짝, '게시'), { recursive: true });
  적기(m, 짝, '준비.json', { 브랜드: 'LAB', 슬롯: '2026-11-20', 판: [{ 계정: 'lab-us-youtube', 파일: 'us.mp4', 시각: '2026-11-20T13:00:00-05:00', AI표시: false }] });
  적기(m, 짝, '게시결과.json', { 판: [{ 계정: 'lab-us-youtube', 상태: '예약됨', 게시물ID: 'yt-us' }] });
  const prep = 읽기(m, G);
  prep.판.push({ 계정: 'lab-ca-youtube', 파일: '게시/판본/TH/video.mp4', 시각: '2026-11-20T13:00:00-05:00', 돌림: true });
  적기(m, G, '준비.json', prep);
  const range = ['--부터', '2026-11-20', '--일수', '2'];
  const before = m.run('--장부', ...range);
  assert.doesNotMatch(before.stdout, /같은 언어 묶음 겹침/, '같은이야기를 적기 전에는 다른 폴더의 판과 짝을 못 짓는다');
  prep.돌림.같은이야기 = [짝];
  적기(m, G, '준비.json', prep);
  const after = m.run('--장부', ...range);
  assert.equal(after.status, 1, after.stdout + after.stderr);
  assert.match(after.stdout, /! 같은 언어 묶음 겹침: LAB_가_mn_20261101: lab-(us|ca)-youtube · lab-(us|ca)-youtube\(youtube · en · 0시간/);
});

test('돌림표 명령 — 이미받음의 「때」 · 같은이야기 편의 걸린 때가 씨앗 첫 판으로 든다(seenAt — 11-11: 이 변환을 지워도 시험이 통과했다)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const got = () => {
    const r = m.run('--부터', '2026-11-20', '--일수', '3', '--json');
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout).cells.filter((c) => c.account === 'lab-jp-youtube' && c.original === G).length;
  };
  assert.equal(got(), 1, '씨앗이 이 폴더로 올린 편은 일본 채널이 받는다');
  // 가 편: 씨앗(인스타 @synk.mn)이 이 폴더로는 올린 적이 없다 — 판 · 게시결과를 비운다
  const prep = 읽기(m, G);
  prep.판 = [];
  적기(m, G, '준비.json', prep);
  적기(m, G, '게시결과.json', { 판: [] });
  assert.equal(got(), 0, '씨앗 첫 판이 없으면 다른 계정은 못 받는다');
  // ① 이미받음 — 때 없이 적으면 씨앗 첫 판으로 못 세고, 때를 적으면 센다
  prep.돌림.이미받음 = ['lab-instagram'];
  적기(m, G, '준비.json', prep);
  assert.equal(got(), 0);
  prep.돌림.이미받음 = [{ 계정: 'lab-instagram', 때: '2026-11-01T13:00:00+09:00' }];
  적기(m, G, '준비.json', prep);
  assert.equal(got(), 1, '때를 적은 씨앗은 씨앗 첫 판이다');
  // ② 같은이야기 — 그 편에 걸린 씨앗 판의 시각이 씨앗 첫 판이다(게시결과에 시각이 없으면 판 시각)
  delete prep.돌림.이미받음;
  const 짝 = 'LAB_가_20261102';
  fs.mkdirSync(path.join(m.root, 짝, '게시'), { recursive: true });
  적기(m, 짝, '준비.json', { 브랜드: 'LAB', 슬롯: '2026-11-06', 판: [{ 계정: 'lab-instagram', 파일: 'y.mp4', 시각: '2026-11-06T13:00:00+09:00', AI표시: false }] });
  적기(m, 짝, '게시결과.json', { 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 게시물ID: 'ig-짝' }] });
  prep.돌림.같은이야기 = [짝];
  적기(m, G, '준비.json', prep);
  assert.equal(got(), 1, '같은이야기 편의 씨앗 판 시각이 씨앗 첫 판이다');
  // 그 편이 취소됐으면 씨앗 첫 판이 아니다
  적기(m, 짝, '게시결과.json', { 판: [{ 계정: 'lab-instagram', 상태: '취소됨' }] });
  assert.equal(got(), 0, '취소된 같은이야기 판은 씨앗 첫 판으로 세지 않는다');
});

test('돌림표 명령 — 노래 원본의 연재 · 이미받음을 읽고, 꼴이 틀리거나 원장에 없는 계정이면 셈을 멈춘다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  원장고침(m, (acc) => { for (const k of ['lab-instagram', 'lab-th-youtube', 'lab-jp-youtube']) acc[k].dailyFormats = ['이야기', '노래']; });
  // 가 편을 노래 원본으로(연재 1번) — 태국 채널은 다른 길로 이미 올렸다
  const prep = 읽기(m, G);
  prep.돌림.형식 = '노래';
  prep.돌림.연재 = { 이름: '한글노래', 차례: 1 };
  prep.돌림.이미받음 = ['lab-th-youtube'];
  prep.판[0].시각 = '2026-11-01T21:00:00+09:00';
  적기(m, G, '준비.json', prep);
  const run = () => m.run('--부터', '2026-11-20', '--일수', '3', '--json');
  // 쓸날 없는 노래 원본은 셈을 멈춘다(11-11 — 씨앗의 빈 21:00 칸에 바로 달려 그날 줄 편과 같은 칸에 두 번 걸린다), 날짜 꼴이 아니어도 멈춘다
  const noDay = run();
  assert.notEqual(noDay.status, 0);
  assert.match(noDay.stderr, /노래 원본에 「돌림」\.쓸날이 없다/);
  prep.돌림.쓸날 = '11-20';
  적기(m, G, '준비.json', prep);
  assert.match(run().stderr, /쓸날은 YYYY-MM-DD 꼴이다/);
  prep.돌림.쓸날 = '2026-11-20';
  적기(m, G, '준비.json', prep);
  const ok = run();
  assert.equal(ok.status, 0, ok.stderr);
  const cells = JSON.parse(ok.stdout).cells.filter((c) => c.original === G);
  assert.deepEqual([...new Set(cells.map((c) => c.account))], ['lab-jp-youtube'], '이미 받은 태국 채널은 빼고 일본 채널만');
  assert.equal(cells[0].format, '노래');
  // 버린 편은 꼴 검사를 하지 않는다 — 원장에서 빠진 계정이 버린 편의 이미받음에 남아 있어도 돌림표가 죽지 않는다(11-11)
  const dead = 읽기(m, N);
  dead.상태 = '버림 — 시험';
  dead.돌림.이미받음 = ['lab-없는계정'];
  적기(m, N, '준비.json', dead);
  const withDead = run();
  assert.equal(withDead.status, 0, withDead.stderr);
  assert.equal(JSON.parse(withDead.stdout).cells.some((c) => c.original === N), false, '버린 편은 돌림에 안 든다');
  // 원장에 없는 계정 이름 · 틀린 연재 꼴은 조용히 넘기지 않는다
  prep.돌림.이미받음 = ['lab-없는계정'];
  적기(m, G, '준비.json', prep);
  const bad = run();
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /이미받음/);
  prep.돌림.이미받음 = [{ 계정: 'lab-th-youtube', 때: '2026-10-06T21:00:00+09:00' }];
  prep.돌림.연재 = { 이름: '한글노래' };
  적기(m, G, '준비.json', prep);
  const bad2 = run();
  assert.notEqual(bad2.status, 0);
  assert.match(bad2.stderr, /연재/);
});
