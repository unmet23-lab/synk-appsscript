'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../tools/lib/평소배수.js');
const cli = require('../tools/평소배수.js');

// YouTube 응답은 모두 합성이다. 실제 API를 부르지 않는다.
function fakeFetch(routes) {
  const calls = [];
  const impl = async url => {
    calls.push(url);
    const u = new URL(url);
    const key = u.pathname.split('/').pop();
    const handler = routes[key];
    const result = handler ? handler(u.searchParams) : { status: 404, body: { error: { message: 'none' } } };
    return { ok: result.status === undefined || result.status < 300, status: result.status || 200, json: async () => result.body || result };
  };
  impl.calls = calls;
  return impl;
}

const CH = 'UC' + 'b'.repeat(22);

test('중앙값과 배수 — 중앙값이 없거나 0이면 못 잼(null)', () => {
  assert.equal(lib.median([3, 1, 2]), 2);
  assert.equal(lib.median([4, 1, 2, 3]), 2.5);
  assert.equal(lib.median([]), null);
  assert.equal(lib.multiple(300, 100), 3);
  assert.equal(lib.multiple(1, 3), 0.33);
  assert.equal(lib.multiple(5, 0), null);
  assert.equal(lib.multiple(5, null), null);
});

test('유튜브 주소·핸들·채널 ID를 읽는다', () => {
  assert.deepEqual(lib.youtubeTarget('@synkkorean'), { kind: 'handle', handle: 'synkkorean' });
  assert.deepEqual(lib.youtubeTarget('https://www.youtube.com/@yuhobuilds/shorts'), { kind: 'handle', handle: 'yuhobuilds' });
  assert.deepEqual(lib.youtubeTarget('https://youtube.com/shorts/R3zPsNM6a2c?si=x'), { kind: 'video', id: 'R3zPsNM6a2c' });
  assert.deepEqual(lib.youtubeTarget(CH), { kind: 'channel', id: CH });
  assert.equal(lib.youtubeTarget('https://www.instagram.com/p/x/'), null);
  assert.equal(lib.seconds('PT1M5S'), 65);
});

test('쇼츠 탭 목록(UUSH)으로 맨 앞 12편을 읽는다', async () => {
  const ids = Array.from({ length: 14 }, (_, i) => `V${String(i).padStart(10, '0')}`);
  const fetchImpl = fakeFetch({
    channels: () => ({ body: { items: [{ id: CH, snippet: { title: '시험 채널', customUrl: '@test' } }] } }),
    playlistItems: q => (q.get('playlistId') === 'UUSH' + CH.slice(2) ? { body: { items: ids.slice(0, Number(q.get('maxResults'))).map(id => ({ contentDetails: { videoId: id } })) } } : { status: 404 }),
    videos: q => ({ body: { items: q.get('id').split(',').map((id, k) => ({ id, snippet: { title: id, publishedAt: '2026-10-01T00:00:00Z' }, statistics: { viewCount: String((k + 1) * 100) }, contentDetails: { duration: 'PT30S' } })) } }),
  });
  const tab = await lib.youtubeShortsTab({ target: { kind: 'handle', handle: 'test' }, token: 't', fetchImpl });
  assert.equal(tab.how, 'shorts-playlist');
  assert.equal(tab.n, 12);
  assert.equal(tab.median, 650);
});

test('쇼츠 목록을 못 읽으면 업로드 가운데 3분 이하만 고르고 그렇게 쟀다고 남긴다', async () => {
  const fetchImpl = fakeFetch({
    channels: () => ({ body: { items: [{ id: CH, snippet: { title: '시험', customUrl: '' } }] } }),
    playlistItems: q => (q.get('playlistId').startsWith('UUSH') ? { status: 404 } : { body: { items: ['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC'].map(id => ({ contentDetails: { videoId: id } })) } }),
    videos: () => ({ body: { items: [
      { id: 'AAAAAAAAAAA', snippet: { title: 'a' }, statistics: { viewCount: '100' }, contentDetails: { duration: 'PT59S' } },
      { id: 'BBBBBBBBBBB', snippet: { title: 'b' }, statistics: { viewCount: '9999' }, contentDetails: { duration: 'PT12M' } },
      { id: 'CCCCCCCCCCC', snippet: { title: 'c' }, statistics: { viewCount: '300' }, contentDetails: { duration: 'PT2M50S' } },
    ] } }),
  });
  const tab = await lib.youtubeShortsTab({ target: { kind: 'channel', id: CH }, token: 't', fetchImpl });
  assert.equal(tab.how, 'uploads-3min');
  assert.deepEqual(tab.items.map(i => i.id), ['AAAAAAAAAAA', 'CCCCCCCCCCC']);
  assert.equal(tab.median, 200);
});

test('명령 인자 — 손으로 넣은 조회수와 이 편', () => {
  const o = cli.인자(['--손', '100', '1,200', '300', '--이편', '900', '--json']);
  assert.deepEqual(o.손, [100, 1200, 300]);
  assert.equal(o.이편, 900);
  assert.equal(o.json, true);
});
