import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, dateRange, analyticsCsv, companyOverview } from './analytics.mjs';

const catalog = { channels: [
  { id: 'a', brand: 'LAB', platform: 'YouTube', country: '한국', ready: true },
  { id: 'b', brand: 'SHIFT', platform: 'Instagram', country: '몽골', ready: true },
  { id: 'unready', brand: 'LAB', platform: 'YouTube', country: '일본', ready: false }
] };
const post = (id, channelId, publishedDate, archived = false) => ({ id, title: id, url: 'https://example.test/' + id, channelId, publishedDate, archived });
const snap = (postId, date, likes, shares = null) => ({ postId, date, likes, shares });
const records = {
  posts: [post('old-a', 'a', '2026-09-01'), post('old-b', 'b', '2026-09-01'), post('new', 'a', '2026-09-24'),
    post('first-observation', 'b', '2026-09-01'), post('archived', 'a', '2026-09-01', true), post('future', 'a', '2026-09-25')],
  snapshots: [
    snap('old-a', '2026-09-21', 100), snap('old-a', '2026-09-23', 150, 10), snap('old-a', '2026-09-24', 170),
    snap('old-b', '2026-09-21', 900), snap('old-b', '2026-09-23', 950, 0), snap('old-b', '2026-09-24', 960, 0),
    snap('new', '2026-09-24', 30), snap('first-observation', '2026-09-24', 400),
    snap('archived', '2026-09-21', 10), snap('archived', '2026-09-23', 20), snap('archived', '2026-09-24', 25), snap('future', '2026-09-25', 9999)
  ],
  channelSnapshots: [{ channelId: 'a', date: '2026-09-23', followers: 100 }, { channelId: 'a', date: '2026-09-24', followers: 120 }, { channelId: 'b', date: '2026-09-24', followers: 800 }]
};
const options = { start: '2026-09-22', end: '2026-09-24' };

test('누적값은 게시물당 한 번 합산하고 신규·첫 관측·관리 종료를 구분한다', () => {
  const r = analyze(records, catalog, options), m = r.metrics.likes;
  assert.equal(m.latest, 1585);
  assert.equal(m.total, 1585);
  assert.equal(r.posts.length, 5);
  assert.equal(m.day.delta, 65);
  assert.equal(m.day.count, 4);
  assert.equal(m.day.eligible, 5);
  assert.equal(m.day.newCount, 1);
  assert.equal(m.day.newValue, 30);
  assert.equal(m.day.baseline, 1120);
  assert.equal(m.day.rate, 65 / 1120 * 100);
  assert.equal(m.day.complete, false);
  assert.equal(m.period.delta, 175);
  assert.equal(m.period.baseline, 1010);
  assert.equal(m.period.rate, 175 / 1010 * 100);
});
test('누락일을 0으로 채우거나 여러 날 증가를 하루에 몰지 않는다', () => {
  const r = analyze(records, catalog, options);
  assert.equal(r.daily[0].metrics.likes.total, null);
  assert.equal(r.daily[0].metrics.likes.change.delta, null);
  assert.equal(r.daily[1].metrics.likes.change.delta, null);
  assert.equal(r.metrics.likes.period.delta, 175);
  assert.equal(r.metrics.shares.latest, 10);
  assert.equal(r.metrics.shares.total, 0);
  assert.equal(r.metrics.shares.stale, 1);
  assert.equal(r.metrics.shares.latestCount, 2);
  assert.equal(r.metrics.shares.day.delta, 0);
  assert.equal(r.metrics.shares.day.rate, null);
  assert.equal(r.metrics.shares.day.baseline, 0);
});
test('팔로워는 계정당 한 번 합산하고 기존 계정의 첫 관측을 신규 성장으로 넣지 않는다', () => {
  const m = analyze(records, catalog, options).metrics.followers;
  assert.equal(m.latest, 920);
  assert.equal(m.day.delta, 20);
  assert.equal(m.day.rate, 20);
  assert.equal(m.day.count, 1);
  assert.equal(m.day.newCount, 0);
  assert.equal(m.period.delta, null);
});
test('필터·묶음·게시물 합계와 가중 증가율이 같은 범위를 사용한다', () => {
  const r = analyze(records, catalog, options);
  for (const dimension of ['channel', 'brand', 'platform', 'country']) {
    const groups = r.groups(dimension);
    assert.equal(groups.reduce((n, row) => n + (row.metrics.likes.latest ?? 0), 0), r.metrics.likes.latest);
    assert.equal(groups.reduce((n, row) => n + (row.metrics.likes.day.delta ?? 0), 0), r.metrics.likes.day.delta);
    assert.equal(groups.reduce((n, row) => n + (row.metrics.likes.period.delta ?? 0), 0), r.metrics.likes.period.delta);
  }
  const filtered = analyze(records, catalog, { ...options, platform: 'YouTube', country: '한국', brand: 'LAB' });
  assert.equal(filtered.channels.length, 1);
  assert.equal(filtered.metrics.likes.latest, 225);
  assert.equal(filtered.metrics.likes.day.delta, 55);
  assert.equal(filtered.metrics.likes.day.complete, true);
  const noMatch = analyze(records, catalog, { ...options, platform: 'Instagram', country: '한국' });
  assert.equal(noMatch.posts.length, 0);
  assert.equal(noMatch.metrics.likes.latest, null);
});
test('감소는 음수로, 기준 0의 증가율은 계산 불가로 보존한다', () => {
  const r = analyze({ posts: [post('x', 'a', '2026-09-01')], snapshots: [snap('x', '2026-09-23', 10, 0), snap('x', '2026-09-24', 7, 4)], channelSnapshots: [] }, catalog, options);
  assert.equal(r.metrics.likes.day.delta, -3);
  assert.equal(r.metrics.likes.day.rate, -30);
  assert.equal(r.metrics.shares.day.delta, 4);
  assert.equal(r.metrics.shares.day.rate, null);
});
test('기간 끝에 등록된 신규 게시물과 직전 동일 길이 기간의 경계가 맞다', () => {
  const r = analyze(records, catalog, options);
  assert.deepEqual(r.dates, ['2026-09-22', '2026-09-23', '2026-09-24']);
  assert.equal(r.metrics.likes.period.baseDate, '2026-09-21');
  assert.equal(r.metrics.likes.previousPeriod.baseDate, '2026-09-18');
  assert.equal(r.metrics.likes.previousPeriod.endDate, '2026-09-21');
  assert.equal(r.newPosts, 1);
  assert.throws(() => dateRange('2026-09-25', '2026-09-24'));
  assert.throws(() => dateRange('2025-01-01', '2026-09-24'));
  assert.throws(() => dateRange('2026-02-30', '2026-03-01'));
});
test('집계 CSV는 필터 범위·정의·누락·음수·전체 지표를 유지한다', () => {
  const copy = structuredClone(records); copy.posts[0].title = '=FORMULA';
  const csv = analyticsCsv(analyze(copy, catalog, { ...options, brand: 'LAB' }), 'platform');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=FORMULA"));
  assert.ok(csv.includes('조회수'));
  assert.ok(csv.includes('하루 비교 대상'));
  assert.ok(csv.includes('기존 게시물의 첫 관측은 제외'));
  assert.ok(!csv.includes('https://example.test/old-b'));
  assert.ok(!csv.includes('https://example.test/future'));
});

test('첫 화면은 모든 채널을 합산하고 총 반응에서 조회·도달·팔로워를 제외한다', () => {
  const fixture = { posts: [post('x','a','2026-09-01'), post('y','b','2026-09-24')], snapshots: [
    { postId:'x',date:'2026-09-23',likes:100,comments:10,shares:null,saves:0,views:1000000 },
    { postId:'x',date:'2026-09-24',likes:120,comments:12,shares:5,saves:null,views:2000000 },
    { postId:'y',date:'2026-09-24',likes:10,comments:0,shares:2,saves:0,views:1000 }
  ], channelSnapshots:[{channelId:'a',date:'2026-09-24',followers:10000}] };
  const all = companyOverview(fixture, catalog, '2026-09-24');
  assert.equal(all.channelCount,2);
  assert.equal(all.postCount,2);
  assert.equal(all.newPosts,1);
  assert.equal(all.reactions.latest,149);
  assert.equal(all.metrics.views.latest,2001000);
  assert.equal(all.metrics.followers.latest,10000);
  assert.equal(all.reactions.latestCount,8);
  assert.equal(all.reactions.stale,1);
  assert.equal(all.reactions.day.delta,34);
  assert.equal(all.reactions.day.baseline,110);
  assert.equal(all.reactions.day.rate,34 / 110 * 100);
  assert.equal(all.reactions.day.count,6);
  assert.equal(all.reactions.day.eligible,8);
  assert.equal(all.reactions.day.complete,false);
  assert.equal(analyze(fixture,catalog,{...options,brand:'LAB'}).metrics.likes.latest,120);
  assert.equal(all.metrics.likes.latest,130);
});

test('총 반응도 미기록과 확인한 0을 구분한다', () => {
  const empty = companyOverview({posts:[],snapshots:[],channelSnapshots:[]},catalog,'2026-09-24');
  assert.equal(empty.reactions.latest,null);
  assert.equal(empty.reactions.day.delta,null);
  const zero = companyOverview({posts:[post('x','a','2026-09-01')],snapshots:[
    {postId:'x',date:'2026-09-23',likes:0,comments:0,shares:0,saves:0},
    {postId:'x',date:'2026-09-24',likes:0,comments:0,shares:0,saves:0}
  ],channelSnapshots:[]},catalog,'2026-09-24');
  assert.equal(zero.reactions.latest,0);
  assert.equal(zero.reactions.day.delta,0);
  assert.equal(zero.reactions.day.rate,null);
  assert.equal(zero.reactions.day.complete,true);
});
