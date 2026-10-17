import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('./server.mjs', import.meta.url));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function start(port, dataPath) {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, SYNK_RECORD_PORT: String(port), SYNK_RECORD_DATA_PATH: dataPath },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  const base = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error('Server exited: ' + output);
    try {
      const response = await fetch(base + '/api/records');
      if (response.ok) return { child, base };
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
  child.kill();
  throw new Error('Server did not start: ' + output);
}
async function post(base, route, value) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
  });
  return { status: response.status, body: await response.json() };
}

test('daily post and follower records persist, reject unconfirmed channels, and export safely', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'synk-sns-records-'));
  const dataPath = join(temp, 'records.json');
  const port = 42000 + Math.floor(Math.random() * 10000);
  const { child, base } = await start(port, dataPath);
  try {
    const catalog = await (await fetch(base + '/api/catalog')).json();
    // 2026-10-02 브라질·멕시코 4자리 추가: 74행, 공개 발행 기존 22곳 + 확장 확보 26곳 = 48곳.
    assert.equal(catalog.channels.length, 74);
    assert.equal(catalog.channels.filter(row => row.ready).length, 48);
    assert.equal(catalog.staleSources.length, 0);
    const mapPage = await fetch(base + '/map/');
    assert.equal(mapPage.status, 200);
    assert.match(await mapPage.text(), /SYNK 온라인 마케팅 지도/);
    for (const module of ['calendar.mjs', 'calendar-ui.mjs']) {
      const response = await fetch(base + '/' + module);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /javascript/);
      assert.match(await response.text(), /export /);
    }
    const ready = catalog.channels.find(row => row.ready);
    const unconfirmed = catalog.channels.find(row => !row.ready);
    const rejected = await post(base, '/api/posts', {
      channelId: unconfirmed.id, title: 'Test', url: 'https://example.com/test', publishedDate: today()
    });
    assert.equal(rejected.status, 400);
    const created = await post(base, '/api/posts', {
      channelId: ready.id, title: '=sample', url: 'https://example.com/test',
      publishedDate: today(), monitorDays: 14
    });
    assert.equal(created.status, 200);
    const id = created.body.record.id;
    const blank = await post(base, '/api/snapshots', { postId: id, date: today() });
    assert.equal(blank.status, 400);
    const first = await post(base, '/api/snapshots', { postId: id, date: today(), likes: 0, comments: 2, shares: 1 });
    assert.equal(first.status, 200);
    assert.equal(first.body.record.likes, 0);
    assert.equal(first.body.record.views, null);
    const corrected = await post(base, '/api/snapshots', { postId: id, date: today(), likes: 5, comments: 2, shares: 1 });
    assert.equal(corrected.status, 200);
    const follower = await post(base, '/api/channel-snapshots', { channelId: ready.id, date: today(), followers: 0 });
    assert.equal(follower.status, 200);
    const record = await (await fetch(base + '/api/records')).json();
    assert.equal(record.posts.length, 1);
    assert.equal(record.snapshots.length, 1);
    assert.equal(record.snapshots[0].likes, 5);
    assert.equal(record.channelSnapshots[0].followers, 0);
    assert.deepEqual(JSON.parse(await readFile(dataPath, 'utf8')), record);
    assert.ok((await readdir(join(temp, 'backups'))).length >= 2);
    const csv = await (await fetch(base + '/api/export.csv')).text();
    assert.match(csv, /"'=sample"/);
    assert.match(csv, /"게시물"/);
    assert.match(csv, /"채널"/);
  } finally {
    child.kill();
    assert.equal(resolve(temp).startsWith(resolve(tmpdir()) + '\\') || resolve(temp).startsWith(resolve(tmpdir()) + '/'), true);
    assert.ok(basename(temp).startsWith('synk-sns-records-'));
    await rm(temp, { recursive: true, force: true });
  }
});
