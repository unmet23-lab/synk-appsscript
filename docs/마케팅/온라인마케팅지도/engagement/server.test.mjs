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
    // 행 수는 원장이 자라면 바뀐다(10-19 74행 → 11-09 88행) — 숫자를 박지 않고 지도 자료의 채널 행과 같은지 본다(11-11).
    const mapRows = JSON.parse(await readFile(new URL('../dashboard/src/data.json', import.meta.url), 'utf8')).queries.channels.rows;
    assert.equal(catalog.channels.length, mapRows.length);
    const readyRows = mapRows.filter(row => (row.channelScope === '기존 운영' && row.publishable === true) || row.channelScope === '확장 확보');
    assert.ok(readyRows.length > 0);
    assert.equal(catalog.channels.filter(row => row.ready).length, readyRows.length);
    assert.equal(catalog.staleSources.length, 0);
    const mapPage = await fetch(base + '/map/');
    assert.equal(mapPage.status, 200);
    const mapHtml = await mapPage.text();
    assert.match(mapHtml, /SYNK 온라인 마케팅 지도/);
    // 11-11: 첫 화면은 세계 지도, 예전 표 화면은 /map/detail/에서 그대로 열린다.
    assert.match(mapHtml, /aria-label="세계 지도"/);
    const detail = await fetch(base + '/map/detail/');
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /data-app-local-snapshot/);
    for (const [route, type] of [['/map/geo.json', /json/], ['/map/data.json', /json/], ['/map/pulse-targets.json', /json/],
      ['/map/world.js', /javascript/], ['/map/model.mjs', /javascript/], ['/map/world.css', /css/], ['/map/fonts/SUIT.woff2', /woff2/]]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('content-type'), type, route);
      // 몸을 다 읽어야 연결이 닫힌다(안 읽으면 시험 프로세스가 끝나지 않는다).
      if (/json/.test(type.source)) assert.ok(typeof (await response.json()) === 'object', route);
      else assert.ok((await response.arrayBuffer()).byteLength > 0, route);
    }
    const build = await (await fetch(base + '/map/detail/data-app-build.json')).json();
    const snapshot = await fetch(base + '/map/detail/' + build.snapshot.path);
    assert.equal(snapshot.status, 200);
    assert.ok(typeof (await snapshot.json()) === 'object');
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
