import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
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
});
