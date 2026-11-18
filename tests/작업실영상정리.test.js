'use strict';
// 작업실 영상 정리(tools/작업실영상정리.js) — 가짜 GCS 서버를 이 PC 안에 띄워 지울 것 고르기 · 멈춤 · 지우기 · 승인과 한 번 넘기기 · 잠금을 본다.
// 서버 시각은 PC 시계와 먼 2031년으로 두어, 도구가 GCS 응답의 Date로만 재는지 함께 본다.
// 잠금(이름 있는 파이프 · 추상 소켓)과 넘김(한 번 쓰는 승인 파일)은 Fable 설계 검토(L4 + O2)의 시험 목록을 따른다.
//   node --test tests/작업실영상정리.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { run, approve, describe, _storage, _takeLock } = require('../tools/작업실영상정리.js');

const NUMBER = '123456789012';
const MEDIA = 'synk-company-media-' + NUMBER;
const BACKUP = 'synk-company-backups-' + NUMBER;
const CONFIG = { projectNumber: NUMBER };
const ENABLED = { '지우기': true };
const TOKEN = 'synthetic.fixture-token_1234567890';
const DAY = 86400000;
const HOUR = 3600000;
const T0 = Date.parse('2031-03-10T06:00:00.000Z');
const TOOL = path.join(__dirname, '..', 'tools', '작업실영상정리.js');
const object = (i, ext = 'mp4') => 'studio-media/' + String(i).padStart(8, '0') + '-1234-4234-8234-123456789abc.' + ext;

function fakeGcs() {
  const s = { now: T0, objects: new Map(), calls: [], pageSize: 1000, generation: 1000, failListPage: null, failUpload: false, onList: null, lists: {},
    deleteHook: null, deletes: 0 };
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
        const count = s.lists[bucket] = (s.lists[bucket] || 0) + 1;
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
        if (s.failUpload) return reply(500);
        if (url.searchParams.get('ifGenerationMatch') !== '0') return reply(400);
        if (s.get(bucket, target)) return reply(412);
        const g = s.put(bucket, target, Buffer.concat(chunks));
        return reply(200, JSON.stringify({ name: target, generation: g }));
      }
      if (req.method === 'DELETE') {
        const count = ++s.deletes;  // 이 서버가 받은 지우기 요청 수(훅과 상관없이 센다)
        const hooked = s.deleteHook ? s.deleteHook(name, count) : undefined;
        if (hooked === 'drop') return req.socket.destroy();
        if (typeof hooked === 'number') return reply(hooked);
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
  const go = (options = {}) => run({ config: { ...CONFIG, ...(options.config || {}) }, stateDir: dir, endpoint: s.endpoint, token: TOKEN,
    execute: !!options.execute, override: options.override ?? null, ...(options._rename ? { _rename: options._rename } : {}) });
  const approveRun = runId => approve({ config: CONFIG, stateDir: dir, runId });
  return { s, dir, go, approveRun };
}

function completeBody(refs) {
  return JSON.stringify(refs ? { schema: 'synk-workspace-media-complete/v2', backup: 'synthetic', referenced: refs } : { schema: 'synk-workspace-media-complete/v1', backup: 'synthetic' });
}
const ref = (s, name, bucket = MEDIA) => ({ bucket, object: name, generation: s.get(MEDIA, name).generation });
const backupNow = (s, refs, label = String(s.now), prefix = 'company/production/') =>
  s.put(BACKUP, prefix + 'synk-workspace-' + label + '.media-complete', completeBody(refs), { created: s.now - HOUR });
const k = (s, name) => name + '#' + s.get(MEDIA, name).generation;
const backupCallsAreReadOnly = s => assert.deepEqual(s.calls.filter(c => c[1] === BACKUP && c[0] !== 'GET'), []);
const records = s => [...s.objects.keys()].filter(n => n.startsWith(MEDIA + '\ngc/runs/')).length;
const approvalFile = (dir, runId, where = '') => path.join(dir, 'approvals', where, runId + '.json');
const readRuns = dir => fs.readdirSync(path.join(dir, 'runs')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, 'runs', f), 'utf8')));

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

/** 객체 다섯: 가리킨 것 셋, 아무도 안 가리키는 것 둘. 3일 뒤 지우기 실행이 20%(2/5)에 걸려 멈춘다. */
async function tooMany(s, go) {
  const old = { created: T0 - 10 * DAY };
  const kept = [object(10), object(11), object(12)], gone = [object(1), object(2)];
  for (const name of [...kept, ...gone]) s.put(MEDIA, name, 'body ' + name, old);
  backupNow(s, kept.map(n => ref(s, n)), 'a');
  await go();
  s.now = T0 + 3 * DAY;
  backupNow(s, kept.map(n => ref(s, n)), 'b');
  const stopped = await go({ execute: true, config: ENABLED });
  assert.deepEqual([stopped.status, stopped.reasons, stopped.eligible.length], ['stopped', ['TOO_MANY'], 2]);
  return { kept, gone, stopped, old };
}

test('미리 보기는 가리키지 않는 오래된 객체만 후보로 고르고, 처음 본 지 3일이 지나야 지울 것으로 센다', async t => {
  const { s, dir, go } = await setup(t);
  s.pageSize = 4;  // 쪽을 넘겨 끝까지 읽는다
  const { B, C, D, F, H } = fill(s);
  const first = await go();
  assert.equal(first.status, 'previewed');
  assert.equal(first.startedAt, '2031-03-10T06:00:00.000Z', 'PC 시계가 아니라 GCS의 Date로 잰다');
  assert.deepEqual(first.candidates.sort(), [k(s, B), k(s, F), k(s, H)].sort());
  assert.ok(!first.candidates.includes(k(s, C)) && !first.candidates.includes(k(s, D)), '갓 올라온 것과 다른 자리 백업이 가리킨 것은 지킨다');
  assert.deepEqual(first.eligible, [], '처음 본 날에는 지우지 않는다');
  assert.deepEqual(first.strange, ['studio-media/notes.txt']);
  assert.equal(first.objects, 15);
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0);
  backupCallsAreReadOnly(s);
  assert.equal(records(s), 1, '지우기를 켜기 전에는 멈추지 않은 미리 보기가 gc/runs/에 기록을 남긴다');
  assert.ok(fs.existsSync(path.join(dir, 'runs', first.runId + '.json')));

  s.now = T0 + DAY;
  backupNow(s, [...Array(10)].map((_, i) => ref(s, object(10 + i))), 'second');
  await go();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).firstSeen[k(s, B)], iso(T0), '처음 본 시각은 그대로이고 앞당겨지거나 늦춰지지 않는다');
  s.now = T0 + 3 * DAY - 60000;
  backupNow(s, [...Array(10)].map((_, i) => ref(s, object(10 + i))), 'third');
  assert.deepEqual((await go()).eligible, [], '3일이 덜 지났다');
  s.now = T0 + 3 * DAY;
  backupNow(s, [...Array(10)].map((_, i) => ref(s, object(10 + i))), 'fourth');
  const last = await go();
  assert.equal(last.status, 'previewed');
  assert.deepEqual(last.eligible.sort(), [k(s, B), k(s, F), k(s, H)].sort());
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0, '미리 보기는 지우지 않는다');
  assert.match(describe(last), /지울 것은 3개/);
  backupCallsAreReadOnly(s);
});
function iso(ms) { return new Date(ms).toISOString(); }

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
  const report = await go({ execute: true, config: ENABLED });
  assert.equal(report.status, 'cleaned');
  assert.deepEqual(report.keptByNewBackup, [bKey]);
  assert.deepEqual(report.deleted, [fKey]);
  assert.deepEqual(report.changed, [hOld]);
  assert.ok(s.get(MEDIA, B) && s.get(MEDIA, H) && !s.get(MEDIA, F));
  assert.deepEqual(s.calls.filter(c => c[0] === 'DELETE').map(c => c[2]).sort(), [F, H].sort());
  backupCallsAreReadOnly(s);
});

test('백업이 48시간 멈췄거나 완료 객체를 못 읽으면 멈추고, 처음 본 시각도 적지 않는다', async t => {
  const { s, dir, go } = await setup(t);
  fill(s);
  s.now = T0 + 49 * HOUR;
  const stale = await go();
  assert.deepEqual([stale.status, stale.reasons], ['stopped', ['BACKUP_STALE']]);
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), false);
  assert.equal(records(s), 0, '멈춘 실행은 gc/runs/에 남기지 않는다(7일이면 서버가 경보)');
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

test('목록의 한 쪽이라도 실패하면 실패로 끝나고 아무것도 지우지 않으며, 잠금은 풀린다', async t => {
  const { s, go } = await setup(t);
  fill(s);
  s.pageSize = 3;
  s.failListPage = { bucket: MEDIA };
  await assert.rejects(go(), error => error.code === 'STORAGE_LIST_FAILED');
  s.failListPage = { bucket: BACKUP };
  s.pageSize = 1;
  await assert.rejects(go({ execute: true, config: ENABLED }), error => error.code === 'STORAGE_LIST_FAILED');
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0);
  s.failListPage = null;
  assert.equal((await go()).status, 'previewed', '던진 실행 뒤에도 잠금이 풀려 다음 실행이 돈다');
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
  // UUID 꼴(8-4-4-4-12)이 아닌 이름은 지우지 않는다(GPT GA3).
  await assert.rejects(gcs.remove('studio-media/' + '-'.repeat(36) + '.mp4', '1'), error => error.code === 'DELETE_NAME_REFUSED');
  await assert.rejects(gcs.remove('studio-media/' + 'a'.repeat(36) + '.mp4', '1'), error => error.code === 'DELETE_NAME_REFUSED');
});

test('UUID 꼴이 아닌 이름은 후보가 되지 않고, 넓은 꼴의 가리킴은 그대로 읽는다(GPT GA3)', async t => {
  const { s, go } = await setup(t);
  const odd = 'studio-media/' + '-'.repeat(36) + '.mp4';
  s.put(MEDIA, odd, 'odd', { created: T0 - 10 * DAY });
  s.put(MEDIA, object(1), 'kept', { created: T0 - 10 * DAY });
  backupNow(s, [ref(s, object(1)), { bucket: MEDIA, object: 'studio-media/' + 'a'.repeat(36) + '.mp4', generation: '5' }], 'odd');
  const report = await go();
  assert.equal(report.status, 'previewed');
  assert.deepEqual(report.strange, [odd]);
  assert.deepEqual(report.candidates, []);
});

test('지우기가 실패한 실행은 실패로 남기고 gc/runs/에 남기지 않는다(GPT GA4)', async t => {
  const { s, dir, go } = await setup(t);
  const { kept } = fill(s);
  for (let i = 0; i < 10; i++) s.put(MEDIA, object(30 + i), 'more kept', { created: T0 - 10 * DAY });
  const keepAll = () => [...kept, ...[...Array(10)].map((_, i) => object(30 + i))].map(n => ref(s, n));
  backupNow(s, keepAll(), 'first-b');
  await go();
  s.now = T0 + 3 * DAY;
  backupNow(s, keepAll(), 'later');
  s.deleteHook = () => 403;
  await assert.rejects(go({ execute: true, config: ENABLED }), error => error.code === 'DELETE_FAILED' && error.report.status === 'failed' && error.report.failed.length === 3);
  assert.equal(records(s), 1, '앞의 미리 보기 한 장만 있다');
  assert.equal(readRuns(dir).filter(r => r.status === 'failed').length, 1);
});

test('지우기를 켠 뒤에는 미리 보기가 gc/runs/에 기록을 남기지 않는다(Fable P2 3)', async t => {
  const { s, go } = await setup(t);
  fill(s);
  assert.equal((await go({ config: ENABLED })).status, 'previewed');
  assert.equal(records(s), 0, '손으로 돌린 미리 보기가 서버의 7일 경보 시계를 되돌리지 않는다');
  assert.equal((await go({ execute: true, config: ENABLED })).status, 'cleaned');
  assert.equal(records(s), 1, '지우기 실행은 기록을 남긴다');
});

test('gc/runs/ 기록 올리기가 실패해도 보고가 함께 나온다(Fable P2 5)', async t => {
  const { s, go } = await setup(t);
  fill(s);
  s.failUpload = true;
  await assert.rejects(go(), error => error.code === 'RECORD_FAILED' && error.report && error.report.status === 'previewed' && error.report.objects === 15);
});

test('처음 본 시각은 7일 넘게 적지 못했으면 모두 다시 시작하고, 상태 폴더는 한 버킷에만 쓴다(Fable P3 6 · 7)', async t => {
  const { s, dir, go } = await setup(t);
  const { B } = fill(s);
  await go();
  s.now = T0 + 8 * DAY;
  backupNow(s, [...Array(10)].map((_, i) => ref(s, object(10 + i))), 'late');
  const late = await go();
  assert.deepEqual(late.eligible, [], '8일 만에 돈 실행은 시계를 다시 시작한다');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).firstSeen[k(s, B)], iso(T0 + 8 * DAY));
  await assert.rejects(run({ config: { projectNumber: '999999999999' }, stateDir: dir, endpoint: s.endpoint, token: TOKEN }), error => error.code === 'STATE_BUCKET_MISMATCH');
});

test('실행 기록 폴더에 깨진 파일이 있어도 보통 실행은 그 폴더를 읽지 않고 돈다', async t => {
  const { s, dir, go } = await setup(t);
  fill(s);
  fs.mkdirSync(path.join(dir, 'runs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'runs', '20310309T000000Z-abcdef.json'), '{broken');
  assert.equal((await go()).status, 'previewed');
  assert.equal((await go({ execute: true, config: ENABLED })).status, 'cleaned');
});

// ── 승인과 한 번 넘기기(O2) ──

test('20%에 걸려 멈춘 실행은 승인 뒤 한 번만 넘기고, 미리 보기는 승인을 쓰지 않는다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { gone, stopped, old } = await tooMany(s, go);
  assert.equal(s.calls.filter(c => c[0] === 'DELETE').length, 0);
  const unapproved = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([unapproved.status, unapproved.reasons], ['stopped', ['OVERRIDE_INVALID']], '승인 없이는 넘기지 못한다');
  await assert.rejects(go({ override: 'bad id' }), error => error.code === 'OVERRIDE_INVALID');

  assert.deepEqual([(await approveRun(stopped.runId)).status, (await approveRun(stopped.runId)).status], ['approved', 'already-approved'], '쓰기 전에는 두 번 승인해도 하나다');
  const looked = await go({ override: stopped.runId });
  assert.deepEqual([looked.status, looked.overrode, looked.approvalUsed, looked.eligible.length], ['previewed', stopped.runId, false, 2]);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)), '미리 보기는 승인을 읽기만 한다');
  assert.match(describe(looked), /승인은 쓰지 않고 남아 있습니다/);

  const cleaned = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([cleaned.status, cleaned.overrode, cleaned.approvalUsed, cleaned.deleted.length], ['cleaned', stopped.runId, true, 2]);
  assert.ok(gone.every(n => !s.get(MEDIA, n)));
  assert.ok(!fs.existsSync(approvalFile(dir, stopped.runId)) && fs.existsSync(approvalFile(dir, stopped.runId, 'used')));
  await assert.rejects(approveRun(stopped.runId), error => error.code === 'APPROVAL_ALREADY_USED', '쓴 승인은 다시 만들지 못한다');

  for (const [i, name] of gone.entries()) s.put(MEDIA, name, 'back', { ...old, generation: cleaned.deleted[i].split('#')[1] });
  const again = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([again.status, again.reasons], ['stopped', ['OVERRIDE_INVALID']]);
  assert.equal(s.deletes, 2);
});

test('승인은 20% 하나로만 멈춘 실행에만 만든다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  fill(s);
  const previewed = await go();
  await assert.rejects(approveRun(previewed.runId), error => error.code === 'APPROVAL_SOURCE_INVALID', '멈추지 않은 실행');
  s.now = T0 + 49 * HOUR;
  const stale = await go();
  await assert.rejects(approveRun(stale.runId), error => error.code === 'APPROVAL_SOURCE_INVALID', '다른 이유로 멈춘 실행');
  await assert.rejects(approveRun('20310310T060000Z-000000'), error => error.code === 'APPROVAL_SOURCE_INVALID', '없는 실행');
  await assert.rejects(approveRun('../runs/x'), error => error.code === 'APPROVAL_SOURCE_INVALID', '경로를 벗어나는 이름');
  assert.equal(fs.existsSync(path.join(dir, 'approvals')), false);
});

test('승인은 그 실행이 멈춘 GCS 시각에서 3일까지만 쓰이고, 늦게 승인해도 늘지 않는다', async t => {
  for (const [late, usable] of [[3 * DAY - 60000, true], [3 * DAY + 60000, false]]) {
    const { s, dir, go, approveRun } = await setup(t);
    const { kept, stopped } = await tooMany(s, go);
    s.now = Date.parse(stopped.startedAt) + late;
    backupNow(s, kept.map(n => ref(s, n)), 'c');
    await approveRun(stopped.runId);
    const report = await go({ execute: true, override: stopped.runId, config: ENABLED });
    if (usable) assert.deepEqual([report.status, report.deleted.length], ['cleaned', 2]);
    else {
      assert.deepEqual([report.status, report.reasons], ['stopped', ['OVERRIDE_INVALID']]);
      assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)), '만료로 멈춘 실행은 승인을 쓰지 않는다');
    }
  }
});

test('넘김 실행이 다른 이유로 멈추거나 지울 것이 없으면 승인을 쓰지 않는다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { kept, gone, stopped } = await tooMany(s, go);
  await approveRun(stopped.runId);
  s.now = T0 + 3 * DAY + 49 * HOUR;
  assert.deepEqual((await go({ execute: true, override: stopped.runId, config: ENABLED })).reasons, ['BACKUP_STALE']);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)));
  backupNow(s, kept.map(n => ref(s, n)), 'c');
  s.onList = (bucket, count) => {
    // 백업 버킷 목록 5번째 = 이 실행의 둘째 읽기(1 미리 보기, 2 20% 멈춤, 3 백업 멈춤으로 멈춘 실행, 4 이 실행의 첫 읽기)
    if (bucket === BACKUP && count === 5) s.put(BACKUP, 'company/production/synk-workspace-broken.media-complete', '{broken', { created: s.now - HOUR });
  };
  const unreadable = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([unreadable.reasons, unreadable.approvalResult], [['COMPLETE_UNREADABLE'], 'kept'], '지우기 직전의 둘째 읽기에서 멈춤');
  assert.match(describe(unreadable), /다른 이유로 멈췄습니다. 승인은 쓰지 않고 남아 있습니다/);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)));
  s.onList = null;
  s.objects.delete(BACKUP + '\ncompany/production/synk-workspace-broken.media-complete');
  backupNow(s, [...kept, ...gone].map(n => ref(s, n)), 'd');  // 새 백업이 둘 다 가리켜 지울 것이 0개다
  const none = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([none.status, none.approvalUsed, none.deleted.length], ['cleaned', false, 0]);
  assert.match(describe(none), /지금 지울 것이 없어 승인은 쓰지 않고 남겨 두었습니다/);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)), '지울 것이 없으면 승인을 그대로 둔다');
  assert.equal(s.deletes, 0);
});

test('승인 파일이 깨졌거나 목록이 바뀌었으면 지우지 않고 멈춘다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { stopped } = await tooMany(s, go);
  await approveRun(stopped.runId);
  const file = approvalFile(dir, stopped.runId), body = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...body, eligible: [...body.eligible, object(99) + '#1'] }));
  assert.deepEqual((await go({ execute: true, override: stopped.runId, config: ENABLED })).reasons, ['OVERRIDE_INVALID'], '목록 sha256이 맞지 않는다');
  fs.writeFileSync(file, '{broken');
  assert.deepEqual((await go({ execute: true, override: stopped.runId, config: ENABLED })).reasons, ['OVERRIDE_INVALID']);
  assert.equal(s.deletes, 0);
});

test('승인을 옮기지(rename) 못하면 지우기 요청을 하나도 보내지 않는다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { stopped } = await tooMany(s, go);
  await approveRun(stopped.runId);
  const busy = () => { throw Object.assign(new Error('synthetic'), { code: 'EPERM' }); };
  const report = await go({ execute: true, override: stopped.runId, config: ENABLED, _rename: busy });
  assert.deepEqual([report.status, report.reasons, report.approvalUsed, report.approvalResult], ['stopped', ['OVERRIDE_INVALID'], false, 'not-moved']);
  assert.equal(s.deletes, 0);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)));
  assert.match(describe(report), /옮기지 못해 지우지 않고 멈췄습니다/);
  assert.doesNotMatch(describe(report), /넘겼습니다|남아 있습니다/, '멈춘 실행에 넘겼다거나 남아 있다고 말하지 않는다(카본 넷째 검수)');
  // 옮긴 뒤 내용이 맞지 않으면 쓴 것으로 남기고 멈춘다
  const spoil = (from, to) => { fs.renameSync(from, to); fs.writeFileSync(to, '{}'); };
  const spoiled = await go({ execute: true, override: stopped.runId, config: ENABLED, _rename: spoil });
  assert.deepEqual([spoiled.status, spoiled.reasons, spoiled.approvalResult], ['stopped', ['OVERRIDE_INVALID'], 'used-invalid']);
  assert.match(describe(spoiled), /쓴 것으로 남아 다시 승인할 수 없습니다/);
  assert.doesNotMatch(describe(spoiled), /한 번 넘겼습니다/);
  assert.equal(s.deletes, 0);
});

test('지우기 도중 끊기면 승인은 쓴 것으로 남아, 같은 실행으로 다시 넘기거나 다시 승인하지 못한다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { stopped } = await tooMany(s, go);
  await approveRun(stopped.runId);
  s.deleteHook = (name, count) => (count === 2 ? 'drop' : undefined);
  await assert.rejects(go({ execute: true, override: stopped.runId, config: ENABLED }),
    error => error.code === 'STORAGE_REQUEST_FAILED' && error.report.status === 'failed' && error.report.approvalUsed === true && error.report.deleted.length === 1);
  assert.equal(readRuns(dir).filter(r => r.status === 'failed').length, 1);
  s.deleteHook = null;
  assert.deepEqual((await go({ execute: true, override: stopped.runId, config: ENABLED })).reasons, ['OVERRIDE_INVALID']);
  await assert.rejects(approveRun(stopped.runId), error => error.code === 'APPROVAL_ALREADY_USED');
  assert.equal(s.deletes, 2);
});

test('승인 뒤 새 백업이 가리킨 객체와 generation이 바뀐 객체는 남는다', async t => {
  const { s, go, approveRun } = await setup(t);
  const { kept, gone, stopped } = await tooMany(s, go);
  await approveRun(stopped.runId);
  const [first, second] = gone, firstKey = k(s, first), secondOld = k(s, second);
  s.onList = (bucket, count) => {
    if (bucket !== BACKUP || count !== 4) return;  // 넘김 실행의 둘째 완료 객체 읽기(지우기 직전)
    backupNow(s, [...kept, first].map(n => ref(s, n)), 'mid');
    s.put(MEDIA, second, 'replaced', { created: T0 - 10 * DAY });
  };
  const report = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([report.status, report.keptByNewBackup, report.changed, report.deleted], ['cleaned', [firstKey], [secondOld], []]);
  assert.ok(s.get(MEDIA, first) && s.get(MEDIA, second));
});

test('넘김을 주면 그 승인 목록에 있는 것만 지운다(목록 밖의 것은 다음 보통 실행이 본다)', async t => {
  const { s, go, approveRun } = await setup(t);
  const old = { created: T0 - 10 * DAY };
  const kept = [object(10), object(11), object(12)], gone = [object(1), object(2)], X = object(3);
  for (const name of [...kept, ...gone]) s.put(MEDIA, name, 'body ' + name, old);
  backupNow(s, kept.map(n => ref(s, n)), 'a');
  await go();
  s.now = T0 + DAY;
  s.put(MEDIA, X, 'late', old);  // 하루 늦게 후보가 된 객체
  backupNow(s, kept.map(n => ref(s, n)), 'b');
  await go();
  s.now = T0 + 3 * DAY;
  backupNow(s, kept.map(n => ref(s, n)), 'c');
  const stopped = await go({ execute: true, config: ENABLED });
  assert.deepEqual([stopped.reasons, stopped.eligible.length], [['TOO_MANY'], 2]);
  await approveRun(stopped.runId);
  s.now = T0 + 4 * DAY;
  backupNow(s, kept.map(n => ref(s, n)), 'd');
  const xKey = k(s, X);
  const cleaned = await go({ execute: true, override: stopped.runId, config: ENABLED });
  assert.deepEqual([cleaned.status, cleaned.deleted.slice().sort(), cleaned.notApproved], ['cleaned', stopped.eligible.slice().sort(), [xKey]]);
  assert.ok(s.get(MEDIA, X), '승인 목록 밖에 있던 객체는 지우지 않는다');
  assert.match(describe(cleaned), /목록에 없던 1개는 이번에 지우지 않았습니다/);
});

test('보통 지우기가 지우기에 들어가면 쓰지 않은 승인은 무효가 된다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { kept, stopped, old } = await tooMany(s, go);
  await approveRun(stopped.runId);
  const more = [...Array(10)].map((_, i) => object(40 + i));
  for (const name of more) s.put(MEDIA, name, 'more', old);
  backupNow(s, [...kept, ...more].map(n => ref(s, n)), 'c');
  const busy = () => { throw Object.assign(new Error('synthetic'), { code: 'EPERM' }); };
  const blocked = await go({ execute: true, config: ENABLED, _rename: busy });
  assert.deepEqual([blocked.status, blocked.reasons], ['stopped', ['APPROVAL_VOID_FAILED']], '다른 승인을 무효로 옮기지 못하면 지우지 않는다(GPT 넷째 검수)');
  assert.deepEqual(blocked.voidFailed, { name: stopped.runId + '.json', code: 'EPERM' }, '어느 파일을 무슨 오류로 못 옮겼는지 남긴다(Fable 재확인)');
  assert.match(describe(blocked), /무효로 옮기지 못했습니다\(EPERM\)/);
  assert.equal(s.deletes, 0);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId)));
  const normal = await go({ execute: true, config: ENABLED });
  assert.deepEqual([normal.status, normal.overrode, normal.deleted.length, normal.voidedApprovals], ['cleaned', null, 2, [stopped.runId]]);
  assert.match(describe(normal), /다른 승인 1개\(.+\)를 무효로 옮겼습니다/);
  assert.ok(fs.existsSync(approvalFile(dir, stopped.runId, 'void')));
  assert.deepEqual((await go({ execute: true, override: stopped.runId, config: ENABLED })).reasons, ['OVERRIDE_INVALID']);
  await assert.rejects(approveRun(stopped.runId), error => error.code === 'APPROVAL_VOID');
});

test('잠금 없이 승인 소비만 두 프로세스가 한꺼번에 해도 하나만 성공한다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  const { stopped } = await tooMany(s, go);
  await approveRun(stopped.runId);
  const child = "const { _consumeApproval } = require(" + JSON.stringify(TOOL) + "); const got = _consumeApproval(" + JSON.stringify(dir) + ", " + JSON.stringify(stopped.runId) + "); console.log(got && got.runId ? 'used' : 'none');";
  const outs = await Promise.all([0, 1].map(() => new Promise(resolve => {
    const p = spawn(process.execPath, ['-e', child], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.on('close', () => resolve(out.trim()));
  })));
  assert.deepEqual(outs.sort(), ['none', 'used'], outs.join(' | '));
});

// ── 잠금(L4) ──

function holder(dir) {
  const code = `
    const { _takeLock } = require(process.argv[1]);
    _takeLock(process.argv[2]).then(release => {
      process.stdin.once('end', release);
      process.stdin.resume();
      console.log('held');
    }, error => console.log(error.code));
  `;
  const p = spawn(process.execPath, ['-e', code, TOOL, dir], { stdio: ['pipe', 'pipe', 'inherit'] });
  const ready = new Promise((resolve, reject) => {
    let output = '';
    p.stdout.on('data', data => { output += data; if (output.includes('\n')) resolve(output.trim()); });
    p.once('error', reject);
    p.once('close', (code, signal) => reject(new Error(`잠금 결과를 받기 전에 자식이 끝났다 (${signal || code})`)));
  });
  const gone = new Promise(resolve => p.once('close', resolve));
  return { p, ready, gone };
}

test('다른 프로세스가 잡고 있는 동안은 실행과 승인이 BUSY이고, 그 프로세스를 죽이면 바로 다음 실행이 잡는다', async t => {
  const { s, dir, go, approveRun } = await setup(t);
  fill(s);
  const h = holder(dir);
  t.after(() => h.p.kill('SIGKILL'));
  assert.equal(await h.ready, 'held');
  await assert.rejects(go(), error => error.code === 'BUSY');
  await assert.rejects(approveRun('20310310T060000Z-000000'), error => error.code === 'BUSY');
  h.p.kill('SIGKILL');
  await h.gone;
  assert.equal((await go()).status, 'previewed', '죽은 프로세스가 남긴 잠금은 없다');
});

test('같은 폴더를 다른 철자로 불러도 같은 잠금이다', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-gc-name-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const release = await _takeLock(dir);
  const spellings = process.platform === 'win32' ? [dir.toUpperCase(), dir + path.sep] : [];
  if (process.platform !== 'win32') { const link = dir + '-link'; fs.symlinkSync(dir, link); t.after(() => fs.rmSync(link, { force: true })); spellings.push(link, dir + '/'); }
  for (const other of spellings) await assert.rejects(_takeLock(other), error => error.code === 'BUSY', other);
  await release();
  const again = await _takeLock(dir);
  await again();
});

test('여덟 프로세스가 한꺼번에 잠금을 잡으면 하나만 잡는다', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-gc-race-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const contenders = [];
  try {
    for (let i = 0; i < 8; i++) contenders.push(holder(dir));
    // 늦게 뜬 자식까지 모두 시도한 뒤에만 부모가 연결을 닫아 잠금을 푼다.
    const outs = await Promise.all(contenders.map(child => child.ready));
    assert.equal(outs.filter(result => result === 'held').length, 1, outs.join(' | '));
    assert.ok(outs.every(result => result === 'held' || result === 'BUSY'), outs.join(' | '));
  } finally {
    for (const { p } of contenders) p.stdin.end();
    await Promise.all(contenders.map(child => child.gone));
  }
  assert.deepEqual(fs.readdirSync(dir), [], '상태 폴더에 잠금 파일이 남지 않는다');
});

// ── 명령줄 ──

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

test('명령줄: 토큰은 stdin으로만 받고 출력에 나오지 않으며, 끝 코드가 상태를 말하고, 프로세스가 매달리지 않는다', async t => {
  const { s, dir } = await setup(t);
  fill(s);
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(config, JSON.stringify(CONFIG));
  const base = ['--설정', config, '--상태', dir, '--끝점', s.endpoint, '--토큰-stdin'];
  const ok = await cli([...base, '--json'], TOKEN + '\n');
  assert.equal(ok.code, 0, ok.err);
  assert.equal(JSON.parse(ok.out).status, 'previewed');
  assert.ok(!ok.out.includes(TOKEN) && !ok.err.includes(TOKEN));
  const refused = await cli([...base, '--실행'], TOKEN + '\n');
  assert.deepEqual([refused.code, refused.err.trim()], [2, 'SYNK_MEDIA_GC DELETE_NOT_ENABLED']);
  assert.equal((await cli(['--설정', config, '--상태', dir, '--끝점', 'http://example.com', '--토큰-stdin'], TOKEN)).code, 2, '실제 GCS 말고는 이 PC 안의 시험 서버만 받는다');
  assert.equal((await cli(['--설정', config, '--상태', dir, '--토큰-stdin'], TOKEN)).code, 2, '실제 GCS 끝점에는 상태 폴더를 바꾸지 못한다');
  assert.equal((await cli(['--설정', config, '--승인', '20310310T060000Z-abcdef', '--실행'], '')).code, 2, '승인과 실행은 함께 받지 않는다');
  const unknown = await cli(['--설정', config, '--상태', dir, '--끝점', s.endpoint, '--승인', '20310310T060000Z-abcdef'], '');
  assert.deepEqual([unknown.code, unknown.err.trim()], [2, 'SYNK_MEDIA_GC APPROVAL_SOURCE_INVALID']);
  s.now = T0 + 49 * HOUR;
  const stopped = await cli(base, TOKEN + '\n');
  assert.equal(stopped.code, 3);
  assert.match(stopped.out, /멈춤: 정기 백업의 가장 최근 완료 객체가 48시간보다 오래되었습니다/);
});

test('이 PC 시각으로 이미 만료된 실행은 승인하지 않는다(Fable 재확인)', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-gc-expired-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const runId = '20200101T000000Z-abcdef';
  fs.mkdirSync(path.join(dir, 'runs'));
  fs.writeFileSync(path.join(dir, 'runs', runId + '.json'), JSON.stringify({ schema: 'synk-media-cloud-gc-run/v1', runId, bucket: MEDIA, status: 'stopped',
    reasons: ['TOO_MANY'], startedAt: '2020-01-01T00:00:00.000Z', eligible: [object(1) + '#1001'] }));
  await assert.rejects(approve({ config: CONFIG, stateDir: dir, runId }), error => error.code === 'APPROVAL_EXPIRED');
  assert.equal(fs.existsSync(path.join(dir, 'approvals')), false);
});
