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

test('씨앗 먼저 — 새 원본은 씨앗이 올리고, 다른 계정은 17시간 뒤 첫 한국 14시 점검 뒤 칸에만', () => {
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
  assert.match(none.cells.find((c) => c.account === 'th' && c.format === '이야기').why, /TH 판본/);
});

// ── 명령(tools/돌림표.js) — 임시 원장 · 편 폴더 ──
const tool = path.resolve(__dirname, '..', 'tools', '돌림표.js');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
