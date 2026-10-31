import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const script = fileURLToPath(new URL('../tools/작업실예약.js', import.meta.url));
const local = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-links-'));
process.env.SYNK_WORKSPACE_LINK_DIR = local;
const booking = require(script);
test.after(() => fs.rmSync(local, { recursive: true, force: true }));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-safety-'));
  const dir = path.join(root, 'fixture'); fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
  const prep = { 작업실등록: true, 상태: '올릴 준비', 검사: { 결과: '정상' } };
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify(prep));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, bundle: { dir, name: 'fixture', prep }, state: path.join(dir, '게시', '작업실.json'), marker: path.join(dir, '게시', '작업실_자동등록중지.json') };
}
const rows = () => [{ eligible: true, video: { rel: 'fixture.mp4', path: 'fixture.mp4' }, variant: {}, channel: { id: 'fixture' }, notes: [] }];
const fakeCancel = { get: async u => u.endsWith('/review') ? { links: [] } : { post: { status: 'draft' }, jobs: [] }, post: async () => ({}) };

test('취소한 편은 대기열에 다시 잡히지 않고, 명시적으로 등록해야 표식이 풀린다', async t => {
  const f = fixture(t);
  fs.writeFileSync(f.state, JSON.stringify({ postId: 'test-post', 판: [] }));
  await booking.cancel(f.bundle, fakeCancel);
  assert.equal(fs.existsSync(f.marker), true);
  assert.deepEqual(booking.readyFolders(f.root), []);
  let uploads = 0;
  const ws = { origin: 'fixture', upload: async () => { uploads++; throw Error('upload stopped'); } };
  await assert.rejects(booking.register(f.bundle, ws, rows(), { queue: true }), { code: 'CANCELLED' });
  assert.equal(uploads, 0);
  await assert.rejects(booking.register(f.bundle, ws, rows(), {}), /upload stopped/);
  assert.equal(uploads, 1);
  assert.equal(fs.existsSync(f.marker), true, '명시적 재등록의 업로드가 실패해도 자동 등록 중지는 유지');
  assert.equal(fs.existsSync(f.state), false, '원고 요청 전 확정 실패는 재시도할 수 있다');
  const uncertain = { origin: 'fixture', upload: async () => ({asset:{id:'test'}}), post: async () => { throw Error('response lost'); } };
  await assert.rejects(booking.register(f.bundle, uncertain, rows(), {}), /response lost/);
  assert.equal(fs.existsSync(f.marker), true);
  assert.equal(JSON.parse(fs.readFileSync(f.state, 'utf8')).등록중, true);
  await assert.rejects(booking.register(f.bundle, uncertain, rows(), {}), { code: 'UNCERTAIN' });
  await assert.rejects(booking.cancel(f.bundle, fakeCancel), { code: 'UNCERTAIN' });
  assert.equal(uploads, 1);
});

test('취소 서버 요청이 실패해도 자동 등록 중지 표식과 기존 원고 기록을 보존한다', async t => {
  const f = fixture(t); fs.writeFileSync(f.state, JSON.stringify({ postId: 'test-post', 판: [] }));
  await assert.rejects(booking.cancel(f.bundle, { get: async () => { throw Error('offline'); } }), /offline/);
  assert.equal(fs.existsSync(f.marker), true);
  assert.equal(JSON.parse(fs.readFileSync(f.state, 'utf8')).postId, 'test-post');
  assert.deepEqual(booking.readyFolders(f.root), []);
});

test('원고 POST의 400도 저장 후 오류일 수 있어 자동으로 기록을 지우지 않는다', async t => {
  const { createSocialPublishingService } = await import('../docs/마케팅/온라인마케팅지도/engagement/company/social-publishing.mjs');
  const tables = new Map(), table = name => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
  const store = { get: (name,id) => table(name).get(id), put: (name,id,row) => table(name).set(id,row), all: name => [...table(name).values()], transaction: fn => fn() };
  const user = { id: 'u', role: 'admin', active: true }; store.put('users', 'u', user); store.put('channels', 'c', { id: 'c', platform: 'instagram', active: true });
  const provider = { capability: () => ({ mode: 'automatic', canPublish: true, formats: ['post'] }), preflight: () => { throw Object.assign(Error('after save'), { status: 400 }); } };
  const service = createSocialPublishingService({ store, provider });
  assert.throws(() => service.savePost(user, { title: 'fixture', variants: [{ channelId: 'c', format: 'post', text: 'fixture' }] }), { status: 400 });
  assert.equal(store.all('socialPosts').length, 1, '응답 오류 전 실제 원고 저장');
  const f = fixture(t), ws = { origin: 'fixture', upload: async () => ({ asset: { id: 'asset' } }), post: async () => { throw Object.assign(Error('HTTP 400'), { status: 400 }); } };
  await assert.rejects(booking.register(f.bundle, ws, rows(), {}), { code: 'UNCERTAIN' });
  assert.equal(JSON.parse(fs.readFileSync(f.state, 'utf8')).등록중, true);
});

test('별도 프로세스의 등록이 진행 중이면 같은 편의 등록과 취소는 서버 요청 전에 막힌다', async t => {
  const f = fixture(t);
  const program = `const b=require(process.argv[1]);const bundle=JSON.parse(process.argv[2]);
    const ws={origin:'fixture',upload:()=>new Promise((resolve,reject)=>{process.send('upload');process.once('message',()=>reject(Error('stop')));})};
    b.register(bundle,ws,[{eligible:true,video:{rel:'fixture.mp4',path:'fixture.mp4'},variant:{},channel:{id:'fixture'},notes:[]}],{}).catch(()=>process.exit(0));`;
  const child = spawn(process.execPath, ['-e', program, script, JSON.stringify(f.bundle)], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, SYNK_WORKSPACE_LINK_DIR: local } });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  assert.equal((await once(child, 'message'))[0], 'upload');
  let sent = 0; const ws = { origin: 'fixture', upload: async () => { sent++; throw Error('unexpected'); } };
  await assert.rejects(booking.register(f.bundle, ws, rows(), {}), { code: 'BUSY' });
  await assert.rejects(booking.cancel(f.bundle, fakeCancel), { code: 'BUSY' });
  assert.equal(sent, 0);
  child.send('stop'); const [code] = await once(child, 'exit'); assert.equal(code, 0);
  assert.equal(fs.existsSync(f.state), false);
  await assert.rejects(booking.register(f.bundle, ws, rows(), {}), /unexpected/);
  assert.equal(sent, 1, '원고 요청 전 업로드 실패는 다시 시도할 수 있다');
});

test('워크트리 편을 조용히 공용의 다른 판으로 바꿔 등록하지 않는다', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-worktrees-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const main = path.join(root, 'main'), tree = path.join(root, 'tree');
  for (const base of [main, tree]) { fs.mkdirSync(path.join(base, 'tools'), { recursive: true }); fs.mkdirSync(path.join(base, 'docs', '마케팅', 'episode', '게시'), { recursive: true }); }
  fs.mkdirSync(path.join(main, '.git', 'worktrees', 'w'), { recursive: true });
  fs.writeFileSync(path.join(tree, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'w')}\n`);
  fs.writeFileSync(path.join(main, '.git', 'worktrees', 'w', 'commondir'), '../..\n');
  fs.writeFileSync(path.join(main, 'docs', '마케팅', 'episode', '게시', '준비.json'), JSON.stringify({ 제목: '공용' }));
  fs.writeFileSync(path.join(tree, 'docs', '마케팅', 'episode', '게시', '준비.json'), JSON.stringify({ 제목: '워크트리' }));
  assert.throws(() => booking.sharedBundle(path.join(tree, 'docs', '마케팅', 'episode')), { code: 'WORKTREE_BUNDLE' });
  assert.equal(booking.sharedBundle(path.join(main, 'docs', '마케팅', 'episode')).prep.제목, '공용');
  for (const command of ['상태', '취소']) {
    const p = spawnSync(process.execPath, [script, command, path.join(tree, 'docs', '마케팅', 'episode')], { encoding: 'utf8', env: { ...process.env, SYNK_WORKSPACE_SESSION: '', SYNK_WORKSPACE_LINK_DIR: local } });
    assert.notEqual(p.status, 0);
    assert.match(p.stderr, command === '상태' ? /상태 확인/ : /취소/);
    assert.ok(p.stderr.includes(path.join(main, 'docs', '마케팅', 'episode')));
    assert.doesNotMatch(p.stderr, /자격|로그인/);
  }
});

test('연속 등록 실패는 한 번만 알리고, 전송 실패와 복구 뒤 새 실패는 다시 알린다', async t => {
  const f = fixture(t); let sent = 0;
  const send = async () => { sent++; };
  await assert.rejects(booking.notifyFailureOnce(f.bundle.dir, Error('first'), async () => { throw Error('send failed'); }), /send failed/);
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('first'), send), true);
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('again'), send), false);
  assert.equal(sent, 1);
  await booking.clearFailureNotice(f.bundle.dir);
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('new failure'), send), true);
  assert.equal(sent, 2);
});

test('같은 편의 실패 알림이 동시에 시작돼도 한 통만 보낸다', async t => {
  const f = fixture(t); let sent = 0, release;
  const waiting = new Promise(resolve => { release = resolve; });
  const first = booking.notifyFailureOnce(f.bundle.dir, Error('failure'), async () => { sent++; await waiting; });
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('failure'), async () => { sent++; }), false);
  release(); assert.equal(await first, true); assert.equal(sent, 1);
});

test('알림 전송과 등록 성공이 겹치면 전송이 끝난 뒤 표식을 초기화한다', async t => {
  const f = fixture(t); let sent = 0, release;
  const wait = new Promise(resolve => { release = resolve; });
  const sending = booking.notifyFailureOnce(f.bundle.dir, Error('failure'), async () => { sent++; await wait; });
  const clearing = booking.clearFailureNotice(f.bundle.dir);
  await new Promise(resolve => setTimeout(resolve, 50));
  release(); await sending; await clearing;
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('new failure'), async () => { sent++; }), true);
  assert.equal(sent, 2);
});

test('업로드 실패 뒤 원고 결과가 불확실해지면 별도로 알린다', async t => {
  const f = fixture(t); const messages = [];
  const send = async message => messages.push(message);
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('upload'), send), true);
  fs.writeFileSync(f.state, JSON.stringify({ 등록중: true }));
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Object.assign(Error('response lost'), { code: 'UNCERTAIN' }), send), true);
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Object.assign(Error('response lost'), { code: 'UNCERTAIN' }), send), false);
  assert.equal(messages.length, 2);
});

test('대기열이 비어도 전송 실패로 남은 알림을 다음 회차에 보낸다', async t => {
  const f = fixture(t);
  await assert.rejects(booking.notifyFailureOnce(f.bundle.dir, Error('failure'), async () => { throw Error('send failed'); }), /send failed/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-empty-queue-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tools')); fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
  const calls = path.join(root, 'calls.txt'), guard = path.join(root, 'guard.cjs');
  fs.writeFileSync(guard, `const fs=require('node:fs');global.fetch=async()=>{throw Error('NETWORK_BLOCKED')};require(${JSON.stringify(fileURLToPath(new URL('../tools/lib/헤르메스보내기.js', import.meta.url)))}).보내기=()=>{fs.appendFileSync(${JSON.stringify(calls)},'sent\\n');return {ok:true}};`);
  const env = { ...process.env, SYNK_WORKSPACE_SESSION: '', SYNK_WORKSPACE_LINK_DIR: local };
  const run = () => spawnSync(process.execPath, ['--require', guard, script, '--대기열', '--실행', '--텔레그램'], { cwd: root, encoding: 'utf8', env });
  const first = run(); assert.equal(first.status, 0, first.stderr); assert.match(first.stdout, /등록할 편이 없다/);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'sent\n');
  assert.equal(run().status, 0); assert.equal(fs.readFileSync(calls, 'utf8'), 'sent\n');
});

test('전송 중 프로세스가 종료되면 SQLite 잠금이 풀리고 미발송 알림을 재시도한다', async t => {
  const f = fixture(t);
  const program = `const b=require(process.argv[1]);setInterval(()=>{},1000);b.notifyFailureOnce(process.argv[2],Error('failure'),()=>new Promise(()=>{process.send('sending')}));`;
  const child = spawn(process.execPath, ['-e', program, script, f.bundle.dir], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, SYNK_WORKSPACE_LINK_DIR: local } });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  assert.equal((await once(child, 'message'))[0], 'sending');
  let sent = 0; const send = async () => { sent++; };
  assert.equal(await booking.notifyFailureOnce(f.bundle.dir, Error('failure'), send), false);
  assert.equal(sent, 0, '다른 프로세스가 전송 중이면 두 번째 전송을 시작하지 않는다');
  child.kill(); await once(child, 'exit');
  await booking.resendFailureNotices(send);
  await booking.resendFailureNotices(send);
  assert.equal(sent, 1);
});
