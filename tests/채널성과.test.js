'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CONSULT_BUCKETS, CONSULT_COLUMNS, loadAccounts, readLedger, appendLedger, parseTelegramPage, toCount, handEntry, consultEntry,
  measureYoutube, measureTelegram, summarize, followerChange,
  SERVER_SOURCE, serverEntries, unseenServerEntries, measureServer,
} = require('../tools/채널성과.js');

// 계정·장부는 모두 임시 폴더의 합성 자료다. 실제 계정 설정과 장부를 건드리지 않는다.
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-channel-metrics-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeResponse(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) };
}

const ACCOUNTS = [
  { key: 'lab-youtube', brand: 'LAB', platform: 'youtube', handle: '@labtube', expectedChannelId: 'UC-LAB' },
  { key: 'lab-instagram', brand: 'LAB', platform: 'instagram', handle: '@lab.ig' },
  { key: 'lab-telegram', brand: 'LAB', platform: 'telegram', handle: 't.me/labchannel' },
];

test('Telegram 공개 페이지에서 채널 구독자·그룹 인원을 읽고 개인 프로필은 null이다', () => {
  assert.deepEqual(parseTelegramPage('<div class="tgme_page_extra">1 234 subscribers</div>'), { followers: 1234, kind: 'channel' });
  assert.deepEqual(parseTelegramPage('<div class="tgme_page_extra">56 members, 3 online</div>'), { followers: 56, kind: 'group' });
  assert.equal(parseTelegramPage('<div class="tgme_page_extra">@someone</div>'), null);
  assert.equal(toCount('1.2K'), 1200);
  assert.equal(toCount('12 345'), 12345);
});

test('손으로 적는 값은 아는 계정·아는 지표·0 이상의 정수만 받는다', () => {
  const at = new Date('2026-09-18T03:00:00Z');
  const entry = handEntry('lab-instagram', ['팔로워=120', '게시물=4'], { accounts: ACCOUNTS, at });
  assert.equal(entry.followers, 120);
  assert.equal(entry.posts, 4);
  assert.equal(entry.date, '2026-09-18');
  assert.throws(() => handEntry('없는-계정', ['팔로워=1'], { accounts: ACCOUNTS }), /목록에 없습니다/);
  assert.throws(() => handEntry('lab-instagram', ['좋아요=3'], { accounts: ACCOUNTS }), /계정 지표에 없습니다/);
  assert.throws(() => handEntry('lab-instagram', ['팔로워=-1'], { accounts: ACCOUNTS }), /읽지 못했습니다/);
});

test('과거 상담 수동 기록은 정의된 인지채널 칸만 받는다', () => {
  const entry = consultEntry('2026-09-08~2026-09-14', ['페이스북=3', '유튜브=2', '기타=1']);
  assert.deepEqual(entry.counts, { 페이스북: 3, 유튜브: 2, 기타: 1 });
  assert.throws(() => consultEntry('2026-09-08~2026-09-14', ['광고=2']), /인지채널 집계에 없습니다/);
  assert.throws(() => consultEntry('9월 둘째 주', ['페이스북=1']), /기간은/);
});

// [2026-10-02] 옛 상담 폼 문항과 대조하던 검사는 학원 운영 시스템과 함께 폼 코드를 지워 뺐다.

test('운영 제외 계정은 목록에서 빠지고 장부는 쌓인 순서대로 읽힌다', t => {
  const dir = tempDir(t);
  const accountsFile = path.join(dir, 'accounts.json');
  fs.writeFileSync(accountsFile, JSON.stringify({ accounts: {
    'a-youtube': { brand: 'LAB', platform: 'youtube', handle: '@a' },
    'old-linkedin': { brand: 'SHIFT', platform: 'linkedin', handle: 'old', connection: 'duplicate-account-do-not-expand' },
  } }));
  assert.deepEqual(loadAccounts(accountsFile).map(a => a.key), ['a-youtube']);

  const ledgerFile = path.join(dir, 'ledger.jsonl');
  appendLedger([{ kind: 'account', account: 'a-youtube', followers: 1 }], ledgerFile);
  appendLedger([{ kind: 'account', account: 'a-youtube', followers: 2 }], ledgerFile);
  assert.deepEqual(readLedger(ledgerFile).map(e => e.followers), [1, 2]);
});

test('팔로워 변화는 7일 이상 앞선 값과만 비교한다', () => {
  const entries = [
    { date: '2026-09-01', followers: 10 },
    { date: '2026-09-10', followers: 14 },
    { date: '2026-09-15', followers: 20 },
  ];
  assert.equal(followerChange(entries), '+10 (09-01 대비)');
  assert.equal(followerChange(entries.slice(1)), '—');
  assert.equal(followerChange([]), '—');
});

test('요약은 안 잰 계정을 0이 아니라 «아직 안 잼»으로, 상담 표는 칸별 합과 함께 보여 준다', () => {
  const ledger = [
    { at: '2026-09-18T01:00:00Z', date: '2026-09-18', kind: 'account', account: 'lab-youtube', followers: 1, posts: 0, views: 16 },
    { at: '2026-09-18T02:00:00Z', date: '2026-09-18', kind: 'consult', period: '2026-09-08~2026-09-14', counts: { 페이스북: 2, 추천: 1 } },
  ];
  const text = summarize({ accounts: ACCOUNTS, ledger, today: '2026-09-18' });
  assert.match(text, /\| LAB \| YouTube @labtube \| 1 \| — \| 0 \| 16 \| 2026-09-18 \|/);
  assert.match(text, /\| LAB \| Instagram @lab\.ig \| 아직 안 잼 \|/);
  // 적지 않은 칸은 0이 아니라 «—», 그런 칸이 있으면 합은 «이상»
  assert.match(text, /\| 2026-09-08~2026-09-14 \| 2 \| — \| — \| — \| — \| 1 \| — \| — \| — \| — \| — \| 3 이상 \|/);
  assert.match(text, /자동\(공개 채널만\)/);
});

test('지난 날짜의 값을 나중에 적어도 최신값을 덮지 않는다 — 측정 날짜가 먼저다', () => {
  const ledger = [
    { at: '2026-09-18T01:00:00Z', date: '2026-09-18', kind: 'account', account: 'lab-instagram', followers: 20 },
    { at: '2026-09-19T01:00:00Z', date: '2026-09-10', kind: 'account', account: 'lab-instagram', followers: 10 },
  ];
  const text = summarize({ accounts: ACCOUNTS, ledger, today: '2026-09-19' });
  assert.match(text, /\| LAB \| Instagram @lab\.ig \| 20 \| \+10 \(09-10 대비\) \|/);
});

test('과거 «미기입» 칸을 받고, 모든 칸을 셌다고 하면(--전부) 나머지를 0으로 채워 합을 확정한다', () => {
  const partial = consultEntry('2026-09-01~2026-09-30', ['미기입=2', '유튜브=1']);
  assert.deepEqual(partial.counts, { 미기입: 2, 유튜브: 1 });
  const whole = consultEntry('2026-09-01~2026-09-30', ['미기입=2', '유튜브=1'], { complete: true });
  assert.equal(Object.keys(whole.counts).length, CONSULT_COLUMNS.length);
  assert.equal(whole.counts.페이스북, 0);
  const text = summarize({ accounts: ACCOUNTS, ledger: [{ ...whole, at: '2026-10-01T00:00:00Z' }], today: '2026-10-01' });
  assert.match(text, /\| 2026-09-01~2026-09-30 \| 0 \| 0 \| 0 \| 1 \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| 2 \| 3 \|/);
});

test('같은 기간을 다시 적으면 나중 값이 고친 값이고, 표는 기간 순서다', () => {
  const ledger = [
    { at: '2026-09-20T00:00:00Z', kind: 'consult', period: '2026-09-08~2026-09-14', counts: { 페이스북: 1 } },
    { at: '2026-09-21T00:00:00Z', kind: 'consult', period: '2026-09-01~2026-09-07', counts: { 페이스북: 5 } },
    { at: '2026-09-22T00:00:00Z', kind: 'consult', period: '2026-09-08~2026-09-14', counts: { 페이스북: 4 } },
  ];
  const text = summarize({ accounts: ACCOUNTS, ledger, today: '2026-09-22' });
  const rows = text.split('\n').filter(line => /^\| 2026-09-/.test(line));
  assert.equal(rows.length, 2);
  assert.match(rows[0], /^\| 2026-09-01~2026-09-07 \| 5 \|/);
  assert.match(rows[1], /^\| 2026-09-08~2026-09-14 \| 4 \|/);
});

test('YouTube는 기존 인증으로 공개 통계를 읽고, 등록된 채널 ID와 다르면 기록하지 않는다', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push(String(url));
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return fakeResponse(200, { access_token: 'token-for-test' });
    assert.equal(options.headers.authorization, 'Bearer token-for-test');
    if (String(url).includes('forHandle=labtube')) {
      return fakeResponse(200, { items: [{ id: 'UC-LAB', statistics: { subscriberCount: '7', videoCount: '2', viewCount: '90' } }] });
    }
    return fakeResponse(200, { items: [{ id: 'UC-OTHER', statistics: { hiddenSubscriberCount: true, videoCount: '1', viewCount: '5' } }] });
  };
  const credential = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' };
  const results = await measureYoutube([
    ACCOUNTS[0],
    { key: 'other-youtube', platform: 'youtube', handle: '@other' },
    { key: 'moved-youtube', platform: 'youtube', handle: '@other', expectedChannelId: 'UC-EXPECTED' },
  ], { fetchImpl, credential });
  assert.deepEqual(results[0], { account: 'lab-youtube', followers: 7, posts: 2, views: 90, source: 'youtube-api' });
  assert.equal(results[1].followers, null, '구독자 수를 숨긴 채널은 0이 아니라 null이다');
  assert.match(results[2].error, /다른 채널/);
  assert.equal(calls.filter(u => u.startsWith('https://oauth2')).length, 1, '토큰은 한 번만 갱신한다');
});

test('YouTube 인증이 없으면 조회하지 않고 계정마다 이유를 남긴다', async () => {
  const results = await measureYoutube([ACCOUNTS[0]], { credential: null, fetchImpl: async () => assert.fail('호출하면 안 된다') });
  assert.match(results[0].error, /인증이 없어/);
});

test('Telegram은 공개 페이지만 읽고, 구독자 수가 없으면 건너뛴다', async () => {
  const channel = await measureTelegram(ACCOUNTS[2], { fetchImpl: async url => {
    assert.equal(url, 'https://t.me/labchannel');
    return fakeResponse(200, '<div class="tgme_page_extra">42 subscribers</div>');
  } });
  assert.deepEqual(channel, { account: 'lab-telegram', followers: 42, source: 'telegram-public-page' });
  const profile = await measureTelegram({ key: 'me', handle: 't.me/someone' }, { fetchImpl: async () => fakeResponse(200, '<div class="tgme_page_extra">@someone</div>') });
  assert.ok(profile.skipped);
});

// 회사 서버 값 — 계정성과점검의 audit 결과 모양을 합성으로 만든다(실제 서버·자격 없음).
function serverAccount(id, platform, { connected = true, followers, increase, complete = true, previous, views } = {}) {
  const metric = (latest, inc, extra = {}) => ({ latest: latest ?? null, known: latest === undefined ? 0 : 1, eligible: 1, increase: inc ?? null,
    comparison: { current: inc ?? null, previous: previous ?? null, complete, reason: complete ? null : 'missing-baseline', previousBaseDate: '2026-11-01', baseDate: '2026-11-08', endDate: '2026-11-15', ...extra } });
  return { id, platform, connected, periods: { 7: { start: '2026-11-09', end: '2026-11-15', metrics: { followers: metric(followers, increase), views: metric(views, null, { complete: false }) } } } };
}
const SERVER_RESULT = {
  checkedAt: '2026-11-15T20:40:29.351Z',
  accounts: [
    serverAccount('lab-instagram', 'instagram', { followers: 602, increase: 180, previous: 291, views: 115459 }),
    serverAccount('lab-youtube', 'youtube', { followers: 15, increase: 1, previous: 2, views: 15652 }),
    serverAccount('lab-telegram', 'telegram', { connected: false, views: 24 }),
    serverAccount('lab-tiktok', 'tiktok', { followers: 83, increase: 34, complete: false, views: 39471 }),
    serverAccount('lab-facebook', 'facebook', { connected: false, followers: 1 }),
    serverAccount('not-in-list', 'instagram', { followers: 9 }),
  ],
};
const SERVER_ACCOUNTS = [...ACCOUNTS,
  { key: 'lab-tiktok', brand: 'LAB', platform: 'tiktok', handle: '@lab.tt' },
  { key: 'lab-facebook', brand: 'LAB', platform: 'facebook', handle: 'labfb' },
];

test('회사 서버 값은 연결된 Instagram·TikTok·Facebook만 옮기고, 조회는 게시물 합(postViews)으로, 변화는 서버가 확정한 것만 붙인다', () => {
  const entries = serverEntries(SERVER_RESULT, { accounts: SERVER_ACCOUNTS });
  assert.deepEqual(entries.map(e => e.account), ['lab-instagram', 'lab-tiktok'], 'YouTube·Telegram·미연결·목록 밖 계정은 옮기지 않는다');
  const [ig, tt] = entries;
  assert.deepEqual(ig, {
    at: '2026-11-15T20:40:29.351Z', date: '2026-11-15', kind: 'account', account: 'lab-instagram', followers: 602,
    followersChange: { delta: 180, since: '2026-11-08', previous: 291, previousSince: '2026-11-01' }, postViews: 115459, source: SERVER_SOURCE,
  });
  assert.equal(ig.views, undefined, '서버의 게시물 조회 합을 계정 조회(views) 칸에 넣지 않는다');
  assert.equal(tt.followersChange, undefined, '기준일 관측이 모자라 complete가 아니면 변화를 붙이지 않는다');
  assert.throws(() => serverEntries({ checkedAt: 'x' }, { accounts: SERVER_ACCOUNTS }), /accounts가 없습니다/);
});

test('요약은 서버 값을 날짜와 「자동(회사 서버 · 공식 API)」로 보이고, 같은 날 값은 한 번만 쌓인다', () => {
  const entries = serverEntries(SERVER_RESULT, { accounts: SERVER_ACCOUNTS });
  const ledger = [
    { at: '2026-10-21T01:00:00Z', date: '2026-10-21', kind: 'account', account: 'lab-instagram', followers: 15, source: 'hand' },
    ...entries,
  ];
  const text = summarize({ accounts: SERVER_ACCOUNTS, ledger, today: '2026-11-16' });
  assert.match(text, /\| LAB \| Instagram @lab\.ig \| 602 \| \+180 \(11-08 대비\) · 그 전 7일 \+291 \| — \| 115,459 \(게시물 합\) \| 2026-11-15 \| 자동\(회사 서버 · 공식 API\) · `lab-instagram` \|/);
  // 서버가 변화를 확정하지 않은 계정은 장부 안에서 7일 이상 앞선 값이 없으면 «—»
  assert.match(text, /\| LAB \| TikTok @lab\.tt \| 83 \| — \| — \| 39,471 \(게시물 합\) \| 2026-11-15 \| 자동\(회사 서버 · 공식 API\) · `lab-tiktok` \|/);
  // 서버에 연결되지 않은 계정은 그대로 «아직 안 잼 · 손»
  assert.match(text, /\| LAB \| Facebook labfb \| 아직 안 잼 \| — \| — \| — \| — \| 손 · `lab-facebook` \|/);
  assert.match(text, /게시물 합」은 서버가 관측한 게시물의 누적 조회를 더한 값이다/);

  assert.equal(unseenServerEntries(entries, ledger).length, 0, '같은 계정·같은 잰 날의 서버 값은 다시 쌓지 않는다');
  const nextDay = entries.map(e => ({ ...e, date: '2026-11-16' }));
  assert.equal(unseenServerEntries(nextDay, ledger).length, 2);
  // 서버 값 뒤에 손으로 적으면 재는 법도 그 줄을 따른다
  const later = summarize({ accounts: SERVER_ACCOUNTS, ledger: [...ledger, { at: '2026-11-17T00:00:00Z', date: '2026-11-17', kind: 'account', account: 'lab-tiktok', followers: 90, source: 'hand' }], today: '2026-11-17' });
  assert.match(later, /\| LAB \| TikTok @lab\.tt \| 90 \| — \| — \| 39,471 \(게시물 합\) \| 2026-11-17 \| 손 · `lab-tiktok` \|/);
});

test('회사 서버 읽기는 자기 세션으로 GET만 하고 그 세션을 닫으며, 실패해도 다른 재기를 막지 않는다', async () => {
  const { 읽기 } = require('../tools/계정성과점검.js');
  const calls = [], connects = [];
  const connect = async options => { connects.push(options); return {
    get: async route => { calls.push(`GET ${route.split('?')[0]}`); return route === '/api/state' ? { channels: [], capabilities: [] } : { start: '2026-11-09', end: '2026-11-15', groups: [] }; },
    post: async route => { calls.push(`POST ${route}`); return {}; },
  }; };
  const server = await measureServer(SERVER_ACCOUNTS, { read: () => 읽기({ connect, days: [7] }) });
  assert.deepEqual(connects, [{ origin: 'https://workspace.synk.im', session: null }]);
  assert.deepEqual(calls, ['GET /api/state', 'GET /api/analytics', 'POST /api/logout']);
  assert.equal(server.error, undefined);
  assert.ok(Array.isArray(server.entries));

  const failed = await measureServer(SERVER_ACCOUNTS, { read: async () => { throw new Error('작업실 자동화 자격이 없습니다(시험)'); } });
  assert.deepEqual(failed, { error: '작업실 자동화 자격이 없습니다(시험)', entries: [] });
});
