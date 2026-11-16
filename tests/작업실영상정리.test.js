'use strict';
// 작업실 영상 정리(tools/작업실영상정리.js) — 가짜 GCS 서버를 이 PC 안에 띄워 지울 것 고르기 · 멈춤 · 지우기 · 한 번 넘기기를 본다.
// 서버 시각은 PC 시계와 먼 2031년으로 두어, 도구가 GCS 응답의 Date로만 재는지 함께 본다.
//   node --test tests/작업실영상정리.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { run, describe, _storage } = require('../tools/작업실영상정리.js');

const NUMBER = '123456789012';
const MEDIA = 'synk-company-media-' + NUMBER;
const BACKUP = 'synk-company-backups-' + NUMBER;
const TOKEN = 'synthetic.fixture-token_1234567890';
const DAY = 86400000;
const HOUR = 3600000;
const T0 = Date.parse('2031-03-10T06:00:00.000Z');
const TOOL = path.join(__dirname, '..', 'tools', '작업실영상정리.js');
const object = (i, ext = 'mp4') => 'studio-media/' + String(i).padStart(8, '0') + '-1234-4234-8234-123456789abc.' + ext;

function fakeGcs() {
  const s = { now: T0, objects: new Map(), calls: [], pageSize: 1000, generation: 1000, failListPage: null, onList: null, lists: { [MEDIA]: 0, [BACKUP]: 0 } };
  s.put = (bucket, name, body, { created = s.now, generation } = {}) => {
    const g = String(generation ?? ++s.generation);
    s.objects.set(bucket + '\n' + name, { generation: g, body: Buffer.from(body), created });
    return g;
  };
  s.get = (bucket, name) => s.objects.get(bucket + '\n' + name);
  s.server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const reply = (status, body = '', headers = {}) => {
        res.writeHead(status, { date: new Date(s.now).toUTCString(), ...headers });
        res.end(body);
      };
      if (req.headers.authorization !== 'Bearer ' + TOKEN) return reply(401);
      const upload = url.pathname.startsWith('/upload/storage/v1/b/');
      const rest = url.pathname.slice((upload ? '/upload/storage/v1/b/' : '/storage/v1/b/').length);
      const cut = rest.indexOf('/o');
      const bucket = decodeURIComponent(rest.slice(0, cut));
      const name = rest.length > cut + 3 ? decodeURIComponent(rest.slice(cut + 3)) : '';
      s.calls.push([req.method, bucket, name || url.searchParams.get('name') || '']);
      if (req.method === 'GET' && !name) {
        const count = ++s.lists[bucket];
        if (s.onList) s.onList(bucket, count);
        const offset = Number(url.searchParams.get('pageToken') || 0);
        if (s.failListPage && s.failListPage.bucket === bucket && offset > 0) return reply(500);
        const prefix = url.searchParams.get('prefix') || '';
        const glob = url.searchParams.get('matchGlob');
        const names = [...s.objects.keys()].filter(k => k.startsWith(bucket + '\n')).map(k => k.slice(bucket.length + 1))
          .filter(n => n.startsWith(prefix) && (!glob || n.endsWith('.media-complete'))).sort();
        const page = names.slice(offset, offset + s.pageSize).map(n => {
          const o = s.get(bucket, n);
          return { name: n, generation: o.generation, size: String(o.body.length), timeCreated: new Date(o.created).toISOString() };
        });
        const body = { items: page };
        if (offset + s.pageSize < names.length) body.nextPageToken = String(offset + s.pageSize);
        return reply(200, JSON.stringify(body), { 'content-type': 'application/json' });
      }
      const found = s.get(bucket, name);
      if (req.method === 'GET') {
        if (!found || url.searchParams.get('generation') !== found.generation || url.searchParams.get('alt') !== 'media') return reply(404);
        return reply(200, found.body);
      }
      if (req.method === 'POST' && upload) {
        const target = url.searchParams.get('name');
        if (url.searchParams.get('ifGenerationMatch') !== '0') return reply(400);
        if (s.get(bucket, target)) return reply(412);
        const g = s.put(bucket, target, Buffer.concat(chunks));
        return reply(200, JSON.stringify({ name: target, generation: g }));
      }
      if (req.method === 'DELETE') {
        if (!found) return reply(404);
        if (url.searchParams.get('ifGenerationMatch') !== found.generation) return reply(412);
        s.objects.delete(bucket + '\n' + name);
        return reply(204);
      }
      reply(400);
    });
  });
  return s;
}

async function setup(t) {
  const s = fakeGcs();
  await new Promise(resolve => s.server.listen(0, '127.0.0.1', resolve));
  s.endpoint = 'http://127.0.0.1:' + s.server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-gc-'));
  t.after(() => { s.server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const go = (options = {}) => run({ config: { projectNumber: NUMBER, ...(options.config || {}) }, stateDir: dir, endpoint: s.endpoint, token: TOKEN,
    execute: !!options.execute, override: options.override ?? null });
  return { s, dir, go };
}

function completeBody(refs) {
  return JSON.stringify(refs ? { schema: 'synk-workspace-media-complete/v2', backup: 'synthetic', referenced: refs } : { schema: 'synk-workspace-media-complete/v1', backup: 'synthetic' });
}
const ref = (s, name, bucket = MEDIA) => ({ bucket, object: name, generation: s.get(MEDIA, name).generation });
const backupNow = (s, refs, label = String(s.now), prefix = 'company/production/') =>
  s.put(BACKUP, prefix + 'synk-workspace-' + label + '.media-complete', completeBody(refs), { created: s.now - HOUR });
const k = (s, name) => name + '#' + s.get(MEDIA, name).generation;
const backupCallsAreReadOnly = s => assert.deepEqual(s.calls.filter(c => c[1] === BACKUP && c[0] !== 'GET'), []);

/** 객체 15개: 가리킨 것 10, 오래되고 아무도 안 가리키는 것 B, 갓 올라온 C, 대기 자리 백업만 가리키는 D,
 *  generation이 바뀐 F, 다른 프로젝트 버킷만 가리키는 H, 이름이 규칙 밖인 것 하나. */
function fill(s) {
  const old = { created: T0 - 10 * DAY };
  const kept = [];
  for (let i = 0; i < 10; i++) kept.push(object(10 + i));
  for (const name of kept) s.put(MEDIA, name, 'kept ' + name, old);
  const B = object(1), C = object(2), D = object(3), F = object(4, 'png'), H = object(5, 'srt');
  for (const name of [B, D, F, H]) s.put(MEDIA, name, 'body ' + name, old);
  s.put(MEDIA, C, 'young', { created: T0 - DAY });
  s.put(MEDIA, 'studio-media/notes.txt', 'not a media name', old);
  const fOld = { bucket: MEDIA, object: F, generation: '7' };  // 같은 이름의 옛 generation만 가리킨다
  s.put(BACKUP, 'company/standby/synk-workspace-old.media-complete', completeBody([ref(s, D)]), { created: T0 - 20 * DAY });
  backupNow(s, [...kept.map(n => ref(s, n)), fOld, ref(s, H, 'synk-company-media-999999999')], 'first');
  return { kept, B, C, D, F, H };
}

test('미리 보기는 가리키지 않는 오래된 객체만 후보로 고르고, 처음 본 지 3일이 지나야 지울 것으로 센다', async t => {
  const { s, dir, go } = await setup(t);
  s.pageSize = 4;  // 쪽을 넘겨 끝까지 읽는다
  const { B, C, D, F, H } = fill(s);
  const first = await go();
  assert.equal(first.status, 'previewed');
  assert.equal(first.startedAt, '2031-03-10T06:00:00.000Z', 'PC 시계가 아니라 GCS의 Date로 잰다');
  assert.deepEqual(first.candidates.sort(), [k(s, B), k(s, F), k(s, H)].sort());
  assert.ok(!first.candidates.includes(k(s, C)) && !first.candidates.includes(k(s, D)), '갓 올라온 것과 다른 자리 백업이 가리킨 것은 지키다');
  assert.deepEqual(first.eligible, [], '처음 본 날에는 지우지 않는다');
  assert.deepEqual(first.strange, ['studio-media/notes.txt']);
  assert.equal(first.objects, 15);
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0);
  backupCallsAreReadOnly(s);
  const records = [...s.objects.keys()].filter(n => n.startsWith(MEDIA + '\ngc/runs/'));
  assert.equal(records.length, 1, '멈추지 않은 실행은 미디어 버킷 gc/runs/에 기록을 남긴다');
  assert.ok(fs.existsSync(path.join(dir, 'runs', first.runId + '.json')));

  s.now = T0 + 3 * DAY - 60000;
  backupNow(s, [...Array(10)].map((_, i) => ref(s, object(10 + i))), 'second');
  assert.deepEqual((await go()).eligible, [], '3일이 덜 지났다');
  s.now = T0 + 3 * DAY;
  backupNow(s, [...Array(10)].map((_, i) => ref(s, object(10 + i))), 'third');
  const third = await go();
  assert.equal(third.status, 'previewed');
  assert.deepEqual(third.eligible.sort(), [k(s, B), k(s, F), k(s, H)].sort());
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0, '미리 보기는 지우지 않는다');
  assert.match(describe(third), /지울 것은 3개/);
  backupCallsAreReadOnly(s);
});

test('지우기는 설정의 「지우기」와 --실행이 함께 있어야 하고, 그전에는 아무 요청도 보내지 않는다', async t => {
  const { s, go } = await setup(t);
  fill(s);
  await assert.rejects(go({ execute: true }), error => error.code === 'DELETE_NOT_ENABLED');
  await assert.rejects(go({ execute: true, config: { '지우기': 'true' } }), error => error.code === 'DELETE_NOT_ENABLED');
  assert.deepEqual(s.calls, []);
});

test('지우기 직전에 새로 생긴 완료 객체가 가리킨 것은 남기고, 그사이 바뀐 객체는 generation이 달라 지우지 않는다', async t => {
  const { s, go } = await setup(t);
  const { kept, B, F, H } = fill(s);
  for (let i = 0; i < 10; i++) s.put(MEDIA, object(30 + i), 'more kept', { created: T0 - 10 * DAY });
  const keepAll = () => [...kept, ...[...Array(10)].map((_, i) => object(30 + i))].map(n => ref(s, n));
  backupNow(s, keepAll(), 'first-b');
  await go();
  s.now = T0 + 3 * DAY;
  backupNow(s, keepAll(), 'later');
  const bKey = k(s, B), fKey = k(s, F), hOld = k(s, H);
  s.onList = (bucket, count) => {
    if (bucket !== BACKUP || count !== 3) return;  // 지우기 실행의 두 번째 완료 객체 목록(지우기 직전). 1은 앞선 미리 보기, 2는 이 실행의 첫 목록
    backupNow(s, [...keepAll(), ref(s, B)], 'mid-run');
    s.put(MEDIA, H, 'replaced while running', { created: T0 - 10 * DAY });
  };
  const report = await go({ execute: true, config: { '지우기': true } });
  assert.equal(report.status, 'cleaned');
  assert.deepEqual(report.keptByNewBackup, [bKey]);
  assert.deepEqual(report.deleted, [fKey]);
  assert.deepEqual(report.changed, [hOld]);
  assert.ok(s.get(MEDIA, B) && s.get(MEDIA, H) && !s.get(MEDIA, F));
  const deletes = s.calls.filter(c => c[0] === 'DELETE');
  assert.deepEqual(deletes.map(c => c[2]).sort(), [F, H].sort());
  backupCallsAreReadOnly(s);
});

test('백업이 48시간 멈췄거나 완료 객체를 못 읽으면 멈추고, 처음 본 시각도 적지 않는다', async t => {
  const { s, dir, go } = await setup(t);
  fill(s);
  s.now = T0 + 49 * HOUR;
  const stale = await go();
  assert.deepEqual([stale.status, stale.reasons], ['stopped', ['BACKUP_STALE']]);
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), false);
  assert.equal([...s.objects.keys()].some(n => n.startsWith(MEDIA + '\ngc/runs/')), false, '멈춘 실행은 gc/runs/에 남기지 않는다(7일이면 서버가 경보)');
  assert.ok(fs.existsSync(path.join(dir, 'runs', stale.runId + '.json')), 'PC에는 멈춘 실행도 남긴다');

  backupNow(s, [{ bucket: MEDIA, object: object(10), generation: s.get(MEDIA, object(10)).generation }], 'fresh');
  s.put(BACKUP, 'company/production/synk-workspace-broken.media-complete', '{not json', { created: s.now - HOUR });
  assert.deepEqual((await go()).reasons, ['COMPLETE_UNREADABLE']);
  s.put(BACKUP, 'company/production/synk-workspace-broken.media-complete', completeBody([{ bucket: MEDIA, object: 'studio-media/../x.mp4', generation: '1' }]), { created: s.now - HOUR });
  assert.deepEqual((await go()).reasons, ['COMPLETE_UNREADABLE']);
  s.put(BACKUP, 'company/production/synk-workspace-broken.media-complete', JSON.stringify({ schema: 'synk-workspace-media-complete/v3' }), { created: s.now - HOUR });
  assert.deepEqual((await go()).reasons, ['COMPLETE_UNREADABLE']);
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), false);
});

test('목록의 한 쪽이라도 실패하면 실패로 끝나고 아무것도 지우지 않는다', async t => {
  const { s, go } = await setup(t);
  fill(s);
  s.pageSize = 3;
  s.failListPage = { bucket: MEDIA };
  await assert.rejects(go(), error => error.code === 'STORAGE_LIST_FAILED');
  s.failListPage = { bucket: BACKUP };
  s.pageSize = 1;
  await assert.rejects(go({ execute: true, config: { '지우기': true } }), error => error.code === 'STORAGE_LIST_FAILED');
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0);
});

test('지울 것이 20%를 넘으면 멈추고, 그 실행의 목록을 본 뒤 --한번넘김으로 한 번만 넘긴다', async t => {
  const { s, go } = await setup(t);
  const old = { created: T0 - 10 * DAY };
  const kept = [object(10), object(11), object(12)], gone = [object(1), object(2)];
  for (const name of [...kept, ...gone]) s.put(MEDIA, name, 'body ' + name, old);
  backupNow(s, kept.map(n => ref(s, n)), 'a');
  await go();
  s.now = T0 + 3 * DAY;
  backupNow(s, kept.map(n => ref(s, n)), 'b');
  const stopped = await go({ execute: true, config: { '지우기': true } });
  assert.deepEqual([stopped.status, stopped.reasons, stopped.eligible.length], ['stopped', ['TOO_MANY'], 2]);
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0);

  await assert.rejects(go({ override: 'bad id' }), error => error.code === 'OVERRIDE_INVALID');
  const looked = await go({ override: stopped.runId });
  assert.deepEqual([looked.status, looked.overrode], ['previewed', stopped.runId], '미리 보기로 넘겨 본 것은 쓴 것으로 치지 않는다');
  const cleaned = await go({ execute: true, override: stopped.runId, config: { '지우기': true } });
  assert.deepEqual([cleaned.status, cleaned.overrode, cleaned.deleted.length], ['cleaned', stopped.runId, 2]);
  assert.ok(gone.every(n => !s.get(MEDIA, n)));

  // 같은 이름 · generation이 다시 나타나도 한 번 쓴 넘김은 다시 쓰지 못한다.
  for (const [i, name] of gone.entries()) s.put(MEDIA, name, 'back', { ...old, generation: cleaned.deleted[i].split('#')[1] });
  const again = await go({ execute: true, override: stopped.runId, config: { '지우기': true } });
  assert.deepEqual([again.status, again.reasons], ['stopped', ['OVERRIDE_INVALID']]);
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 2);
});

test('가장 최근 완료 객체가 v1이면 보고에 한 줄로 알린다', async t => {
  const { s, go } = await setup(t);
  s.put(MEDIA, object(1), 'young', { created: T0 - HOUR });
  backupNow(s, null, 'v1');
  const report = await go();
  assert.deepEqual([report.status, report.latestIsV1], ['previewed', true]);
  assert.match(describe(report), /v1입니다/);
});

test('미디어 버킷 기록과 지우기는 정해진 이름만 받는다', async () => {
  const gcs = _storage({ token: TOKEN, endpoint: 'http://127.0.0.1:9', media: MEDIA, backup: BACKUP });
  await assert.rejects(gcs.record('studio-media/' + 'x.json', {}), error => error.code === 'RECORD_NAME_REFUSED');
  await assert.rejects(gcs.remove('gc/runs/20310310T060000Z-abcdef.json', '1'), error => error.code === 'DELETE_NAME_REFUSED');
  await assert.rejects(gcs.remove(object(1).toUpperCase(), '1'), error => error.code === 'DELETE_NAME_REFUSED');
  await assert.rejects(gcs.remove(object(1), '1a'), error => error.code === 'DELETE_NAME_REFUSED');
});

function cli(args, input) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [TOOL, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => resolve({ code, out, err }));
    child.stdin.end(input);
  });
}

test('명령줄: 토큰은 stdin으로만 받고 출력에 나오지 않으며, 끝 코드가 상태를 말한다', async t => {
  const { s, dir } = await setup(t);
  fill(s);
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(config, JSON.stringify({ projectNumber: NUMBER }));
  const base = ['--설정', config, '--상태', dir, '--끝점', s.endpoint, '--토큰-stdin'];
  const ok = await cli([...base, '--json'], TOKEN + '\n');
  assert.equal(ok.code, 0, ok.err);
  assert.equal(JSON.parse(ok.out).status, 'previewed');
  assert.ok(!ok.out.includes(TOKEN) && !ok.err.includes(TOKEN));
  const refused = await cli([...base, '--실행'], TOKEN + '\n');
  assert.deepEqual([refused.code, refused.err.trim()], [2, 'SYNK_MEDIA_GC DELETE_NOT_ENABLED']);
  assert.equal((await cli(['--설정', config, '--상태', dir, '--끝점', 'http://example.com', '--토큰-stdin'], TOKEN)).code, 2, '실제 GCS 말고는 이 PC 안의 시험 서버만 받는다');
  s.now = T0 + 49 * HOUR;
  const stopped = await cli(base, TOKEN + '\n');
  assert.equal(stopped.code, 3);
  assert.match(stopped.out, /멈춤: 정기 백업의 가장 최근 완료 객체가 48시간보다 오래되었습니다/);
});
