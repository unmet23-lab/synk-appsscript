'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CONSULT_BUCKETS, CONSULT_COLUMNS, loadAccounts, readLedger, appendLedger, parseTelegramPage, toCount, handEntry, consultEntry,
  measureYoutube, measureTelegram, summarize, followerChange,
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

test('상담 수는 상담 폼의 인지채널 칸만 받는다', () => {
  const entry = consultEntry('2026-09-08~2026-09-14', ['페이스북=3', '유튜브=2', '기타=1']);
  assert.deepEqual(entry.counts, { 페이스북: 3, 유튜브: 2, 기타: 1 });
  assert.throws(() => consultEntry('2026-09-08~2026-09-14', ['광고=2']), /인지채널 집계에 없습니다/);
  assert.throws(() => consultEntry('9월 둘째 주', ['페이스북=1']), /기간은/);
});

// [2026-10-02] 상담 폼 문항(엔진_폼리포트.js)과 대조하던 검사는 학원 운영 시스템과 함께 폼 코드를 지워 뺐다.

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

test('KPI의 «미기입» 칸을 받고, 모든 칸을 셌다고 하면(--전부) 나머지를 0으로 채워 합을 확정한다', () => {
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
