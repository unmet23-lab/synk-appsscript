// 작업실 예약 등록(10-21)을 실제 회사 서버 코드(createCompanyApp, 임시 SQLite, 이 PC 안에서만)에 끝까지 돌린다.
// SNS로는 아무것도 나가지 않는다 — 게시는 시험 안의 가짜 공급자가 받는다. 확인하는 것:
// 원본 업로드 → 원고 → 잠금 링크 → 사내 승인 → 예약이 모두 「검토 대기」 → 유호님 링크 하나만 필수 → 링크 승인 전에는 시각이 돼도 안 보냄
// → 승인 뒤에만 보냄 → 상태가 게시결과.json으로. 서버가 언어 칸을 모르면 유튜브 판을 등록하지 않는 것도 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { createCompanyApp } = await import(new URL('../docs/마케팅/온라인마케팅지도/engagement/company/server.mjs', import.meta.url));
const 묶음 = require('../tools/lib/게시묶음.js');

const ALL_OPTIONS = ['privacy', 'madeForKids', 'hashtags', 'madeWithAi', 'notifySubscribers', 'language', 'audioLanguage', 'categoryId', 'shareToFeed', 'thumbnailTimestamp'];

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function fixture(t, { options = ALL_OPTIONS } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '작업실예약-'));
  const linkDir = path.join(root, '.링크');
  process.env.SYNK_WORKSPACE_LINK_DIR = linkDir;
  delete require.cache[require.resolve('../tools/작업실예약.js')];
  const 예약 = require('../tools/작업실예약.js');
  fs.mkdirSync(path.join(root, 'tools'));
  fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', '마케팅', 'sns-계정.json'), JSON.stringify({ accounts: {
    'yuhobuilds-instagram': { platform: 'instagram', handle: '@yuhobuilds' },
    'yuhobuilds-youtube': { platform: 'youtube', handle: '@yuhobuilds', categoryId: '22', madeForKids: false },
    'shift-tistory': { platform: 'tistory', handle: 'yuhobuilds.tistory.com' } } }));
  const dir = path.join(root, 'docs', '마케팅', 'yuhobuilds_시험_20261021');
  fs.mkdirSync(path.join(dir, '게시', '01-ig'), { recursive: true });
  fs.mkdirSync(path.join(dir, '게시', '02-yt'), { recursive: true });
  const video = path.join(dir, 'remotion', 'out', 'a_final.mp4');
  fs.mkdirSync(path.dirname(video), { recursive: true });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x355f52:s=1080x1920:d=4:r=30', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', video]);
  fs.writeFileSync(path.join(dir, '게시', '01-ig', '원고.json'), JSON.stringify({ caption: '42초 쇼츠를 재 보니 24초가 멈춰 있었어요.\n\n#쇼츠만들기', alteredContent: true }));
  fs.writeFileSync(path.join(dir, '게시', '02-yt', '원고.json'), JSON.stringify({ title: '42초 쇼츠, 재 보니 24초가 멈춰 있었어요', caption: '설명란 첫 줄', pinnedComment: '몇 %였어요?', language: 'ko', audioLanguage: 'ko', alteredContent: true, madeForKids: false }));
  fs.writeFileSync(path.join(dir, '게시', '티스토리.md'), '**제목**\n\n글');
  const slot = new Date(Date.now() + 2 * 86400000);
  const day = new Date(slot.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const stat = fs.statSync(video);
  const rel = path.relative(root, video).split(path.sep).join('/');
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드: 'yuhobuilds', 슬롯: day, 상태: '올릴 준비', 제목: '멈춘 시간 재기', 역할: '권위',
    판: [
      { 계정: 'yuhobuilds-instagram', 파일: rel, 원고: '게시/01-ig/원고.json', 시각: `${day}T21:00:00+09:00` },
      { 계정: 'yuhobuilds-youtube', 파일: rel, 원고: '게시/02-yt/원고.json', 시각: `${day}T21:00:00+09:00` },
      { 계정: 'shift-tistory', 파일: '게시/티스토리.md', 시각: `${day}T21:30:00+09:00` },
    ],
    검사: { 결과: '확인할 것', 파일: [{ 경로: rel, 바이트: stat.size, 수정: new Date(stat.mtimeMs).toISOString() }] } }, null, 2));

  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  let at = new Date().toISOString();
  const sent = [];
  const socialProvider = {
    settings: () => ({ configured: true, integrations: [] }),
    capability: (channel) => ({ mode: 'automatic', canPublish: true, formats: ['reel', 'shorts', 'video'], maxTextLength: 5000, maxMediaCount: 1, options,
      connection: { status: 'connected', integrationId: channel.externalId, profile: channel.handle } }),
    publish: async ({ channel, variant, job }) => { sent.push({ channel: channel.id, options: variant.options, title: variant.title }); return { status: 'published', url: `https://example.test/${channel.id}/${job.id}`, publishedAt: at }; },
    status: async () => ({ status: 'unknown' }),
  };
  const dataDir = path.join(root, '.company');
  const app = createCompanyApp({ dataDir, port, origin, schedule: false, socialProvider, clock: () => at, synkIdentityConfig: null, teachingConfig: null,
    synkCustomerIdentityConfig: null, workNotificationsEnabled: false, webPushEnabled: false, messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });
  const bot = app.store.createUser({ email: 'automation@company.test', name: '제작 자동화', role: 'admin', password: '시험용-비밀번호-0123456789' });
  for (const [id, platform] of [['ig', 'instagram'], ['yt', 'youtube']]) {
    app.store.put('channels', id, { id, displayName: `유호빌드 ${platform}`, platform, handle: '@yuhobuilds', externalId: `ext-${id}`, active: true, ownerIds: [bot.id], connectionVersion: 1 });
  }
  await app.start();
  t.after(async () => { await app.stop(); delete process.env.SYNK_WORKSPACE_LINK_DIR; fs.rmSync(root, { recursive: true, force: true }); });
  const ws = new 예약.Workspace(origin);
  await ws.login({ email: 'automation@company.test', password: '시험용-비밀번호-0123456789' });
  return { 예약, root, dir, linkDir, app, ws, sent, slot, origin, setTime: (iso) => { at = iso; } };
}

test('작업실 등록 → 예약은 모두 검토 대기, 유호님 링크 승인 전에는 시각이 돼도 안 보내고 승인 뒤에만 보낸다', async (t) => {
  const f = await fixture(t);
  const bundle = 묶음.load(f.dir);
  const rows = f.예약.planBundle(bundle, await f.ws.get('/api/social/workspace'), {});
  assert.deepEqual(rows.map((r) => [r.account, r.eligible]), [['yuhobuilds-instagram', true], ['yuhobuilds-youtube', true], ['shift-tistory', false]]);
  assert.deepEqual(rows[1].variant.options, { privacy: 'public', madeForKids: false, notifySubscribers: true, madeWithAi: true, language: 'ko', audioLanguage: 'ko', categoryId: '22' });
  assert.deepEqual(rows[0].variant.options, { shareToFeed: true, madeWithAi: true });
  assert.ok(rows[1].notes.some((n) => /고정 댓글/.test(n)), '유튜브 고정 댓글은 후속으로 남긴다');

  const done = await f.예약.register(bundle, f.ws, rows, {});
  const jobs = f.app.store.all('socialPublishJobs');
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.status === 'scheduled' && j.reviewWaiting === true), '예약은 모두 검토 대기');
  assert.equal(f.app.store.all('socialMedia').length, 1, '같은 영상은 한 번만 올린다');
  const requirement = f.app.store.get('socialReviewRequirements', done.post.id);
  const links = f.app.store.all('socialReviewLinks');
  assert.equal(links.length, 2);
  const lock = links.find((l) => l.label.startsWith('잠금')), mine = links.find((l) => l.label === '유호님 승인');
  assert.ok(lock.revokedAt, '잠금 링크는 폐기');
  assert.deepEqual(requirement.linkIds, [mine.id], '필수 링크는 유호님 링크 하나');
  // 링크 기록에 승인 하나로 함께 거는 판(같은 영상 페북 · 틱톡 · 텔레그램)과 따로 「올려」를 받는 판을 적는다(10-26) — 이 편은 티스토리 글만 따로
  const linkRecord = JSON.parse(fs.readFileSync(path.join(process.env.SYNK_WORKSPACE_LINK_DIR, `${bundle.name}.json`), 'utf8'));
  assert.deepEqual([linkRecord.함께, linkRecord.따로.map((p) => p.계정)], [[], ['shift-tistory']]);
  // 저장소에 남는 기록에는 링크 열쇠가 없다
  const state = JSON.parse(fs.readFileSync(path.join(f.dir, '게시', '작업실.json'), 'utf8'));
  assert.equal(state.postId, done.post.id);
  assert.doesNotMatch(JSON.stringify(state), /token=/);
  const result = JSON.parse(fs.readFileSync(path.join(f.dir, '게시', '게시결과.json'), 'utf8'));
  assert.deepEqual(result.판.map((p) => [p.계정, p.상태, p.방법]), [['yuhobuilds-instagram', '승인 대기', '작업실'], ['yuhobuilds-youtube', '승인 대기', '작업실']]);
  const local = JSON.parse(fs.readFileSync(path.join(f.linkDir, 'yuhobuilds_시험_20261021.json'), 'utf8'));
  assert.equal(local.링크, done.url);

  // 슬롯 시각 30초 뒤 — 승인 전이라 보내지 않는다
  const due = jobs[0].scheduledAt;
  f.setTime(new Date(Date.parse(due) + 30000).toISOString());
  await f.app.scanSocialPublishing();
  assert.equal(f.sent.length, 0, '승인 전에는 안 보낸다');
  // 유호님이 링크에서 승인한다(공개 검토 API — 휴대폰 화면이 부르는 것과 같다)
  const token = new URL(done.url).hash.split('=')[1];
  const headers = { 'content-type': 'application/json', origin: f.origin, authorization: 'Bearer ' + token };
  const opened = await (await fetch(f.origin + '/api/social-review/open', { method: 'POST', headers, body: '{}' })).json();
  assert.equal(opened.review.snapshot.variants.length, 2, '링크 화면에 두 판이 다 보인다');
  const approved = await fetch(f.origin + '/api/social-review/respond', { method: 'POST', headers, body: JSON.stringify({ revision: opened.review.revision, requestId: 'yuho-approve-1', decision: 'approve', name: '유호' }) });
  assert.equal(approved.status, 200, await approved.text());
  f.setTime(new Date(Date.parse(due) + 60000).toISOString());
  await f.app.scanSocialPublishing();
  assert.equal(f.sent.length, 2, '승인 뒤에는 두 판을 보낸다');
  assert.deepEqual(f.sent.find((s) => s.channel === 'yt').options.language, 'ko');
  const after = await f.예약.status(bundle, f.ws);
  assert.deepEqual(after.rows.map((r) => r.상태), ['게시됨', '게시됨']);
  assert.ok(after.rows.every((r) => r.주소?.startsWith('https://example.test/')));
  await assert.rejects(() => f.예약.register(묶음.load(f.dir), f.ws, rows, {}), (e) => e.code === 'ALREADY', '같은 편을 두 번 등록하지 않는다');
  // 캐시로 맞추기 — 서버에 묻지 않고 예약큐 캐시의 작업 목록만 쓴다
  const cached = await f.예약.status(묶음.load(f.dir), null, { save: false, jobs: f.app.store.all('socialPublishJobs').map((j) => ({ ...j, id: j.id })) });
  assert.deepEqual(cached.rows.map((r) => r.상태), ['게시됨', '게시됨']);
});

test('상태 맞추기는 「승인」을 적은 예약됨을 승인 대기로, 게시물 ID까지 적은 게시됨을 확인 필요로 내리지 않는다(10-28 B8)', async (t) => {
  const f = await fixture(t);
  const bundle = 묶음.load(f.dir);
  await f.예약.register(bundle, f.ws, f.예약.planBundle(bundle, await f.ws.get('/api/social/workspace'), {}), {});
  const file = path.join(f.dir, '게시', '게시결과.json');
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  result.판[0] = { ...result.판[0], 상태: '예약됨', 승인: '검토 링크 승인' };
  result.판[1] = { ...result.판[1], 상태: '게시됨', 게시물ID: 'abc123', 주소: 'https://www.youtube.com/watch?v=abc123' };
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  // 서버는 승인 뒤에도 내보내기 전까지 reviewWaiting을 남기고, 공개를 본 판은 AI 표시 비교로 unknown을 낼 수 있다
  const jobs = f.app.store.all('socialPublishJobs').map((j) => (j.channelId === 'yt' ? { ...j, status: 'unknown', reviewWaiting: false, publicationUrl: 'https://www.youtube.com/watch?v=abc123' } : { ...j }));
  await f.예약.status(묶음.load(f.dir), null, { jobs });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(after.판.map((p) => [p.계정, p.상태]), [['yuhobuilds-instagram', '예약됨'], ['yuhobuilds-youtube', '게시됨']]);
  // 거두기(취소됨)는 그대로 덮는다
  await f.예약.status(묶음.load(f.dir), null, { jobs: jobs.map((j) => ({ ...j, status: j.channelId === 'yt' ? 'unknown' : 'cancelled' })) });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).판[0].상태, '취소됨');
});

test('등록을 거두면 예약 작업이 취소되고 링크가 폐기돼, 그 링크를 눌러도 보내지 않는다', async (t) => {
  const f = await fixture(t);
  const bundle = 묶음.load(f.dir);
  const done = await f.예약.register(bundle, f.ws, f.예약.planBundle(bundle, await f.ws.get('/api/social/workspace'), {}), {});
  const gone = await f.예약.cancel(묶음.load(f.dir), f.ws);
  assert.equal(gone.postId, done.post.id);
  assert.ok(f.app.store.all('socialPublishJobs').every((j) => j.status === 'cancelled'));
  assert.ok(f.app.store.all('socialReviewLinks').every((l) => l.revokedAt));
  assert.equal(fs.existsSync(path.join(f.dir, '게시', '작업실.json')), false, '다시 등록할 수 있게 기록을 옮긴다');
  const token = new URL(done.url).hash.split('=')[1];
  const opened = await fetch(f.origin + '/api/social-review/open', { method: 'POST', headers: { 'content-type': 'application/json', origin: f.origin, authorization: 'Bearer ' + token }, body: '{}' });
  assert.notEqual(opened.status, 200, '폐기한 링크는 열리지 않는다');
  f.setTime(new Date(Date.parse(f.app.store.all('socialPublishJobs')[0].scheduledAt) + 60000).toISOString());
  await f.app.scanSocialPublishing();
  assert.equal(f.sent.length, 0);
  const result = JSON.parse(fs.readFileSync(path.join(f.dir, '게시', '게시결과.json'), 'utf8'));
  assert.deepEqual(result.판.map((p) => p.상태), ['취소됨', '취소됨']);
});

test('실제 등록 흐름이 성공하면 이전 실패 알림이 지워져 새 실패를 알릴 수 있다', async (t) => {
  const f = await fixture(t); let sent = 0;
  await f.예약.notifyFailureOnce(f.dir, Error('먼저 실패'), async () => { sent++; });
  await f.예약.notifyFailureOnce(f.dir, Object.assign(Error('확인 필요'), { code: 'UNCERTAIN' }), async () => { sent++; });
  const ledger = require('../tools/lib/장부올리기.js'), before = ledger.장부올리기;
  ledger.장부올리기 = async () => null;
  try {
    const result = await f.예약.handleOne(f.dir, f.ws, { run: true, json: true, telegram: false });
    assert.equal(result.registered, true);
  } finally { ledger.장부올리기 = before; }
  const { DatabaseSync } = require('node:sqlite');
  const noticeDir = path.join(f.linkDir, '등록실패알림');
  const files = fs.readdirSync(noticeDir).filter(name => name.endsWith('.sqlite'));
  assert.equal(files.length, 2);
  for (const file of files) {
    const db = new DatabaseSync(path.join(noticeDir, file));
    try { assert.equal(db.prepare('SELECT count(*) AS n FROM notice').get().n, 0); } finally { db.close(); }
  }
  assert.equal(await f.예약.notifyFailureOnce(f.dir, Error('다시 실패'), async () => { sent++; }), true);
  assert.equal(sent, 3);
});

test('대기열은 07시 작업이 「작업실등록」을 단 편만 집는다', async (t) => {
  const f = await fixture(t);
  const root = path.join(f.root, 'docs', '마케팅');
  assert.deepEqual(f.예약.readyFolders(root), []);
  const prepFile = path.join(f.dir, '게시', '준비.json');
  fs.writeFileSync(prepFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(prepFile, 'utf8')), 작업실등록: true }));
  assert.deepEqual(f.예약.readyFolders(root).map((d) => path.basename(d)), ['yuhobuilds_시험_20261021']);
});

test('서버가 아직 유튜브 언어 칸·인스타 AI 표시를 못 보내면 그 판은 등록하지 않는다(넘김 플래그는 따로)', async (t) => {
  const f = await fixture(t, { options: ['privacy', 'madeForKids', 'hashtags', 'notifySubscribers', 'shareToFeed', 'thumbnailTimestamp'] });
  const bundle = 묶음.load(f.dir);
  const workspace = await f.ws.get('/api/social/workspace');
  const rows = f.예약.planBundle(bundle, workspace, {});
  assert.deepEqual(rows.map((r) => r.eligible), [false, false, false]);
  assert.match(rows[0].reasons.join(' '), /AI 정보 표시/);
  assert.match(rows[1].reasons.join(' '), /언어 칸/);
  const loose = f.예약.planBundle(bundle, workspace, { withoutLanguage: true, withoutAiLabel: true });
  assert.deepEqual(loose.map((r) => r.eligible), [true, true, false]);
  assert.equal('language' in loose[1].variant.options, false);
  assert.equal('madeWithAi' in loose[0].variant.options, false);
});

test('검사 뒤 영상이 바뀌거나 「고칠 것」이 남으면 등록하지 않는다', async (t) => {
  const f = await fixture(t);
  const prepFile = path.join(f.dir, '게시', '준비.json');
  const prep = JSON.parse(fs.readFileSync(prepFile, 'utf8'));
  fs.writeFileSync(prepFile, JSON.stringify({ ...prep, 검사: { ...prep.검사, 결과: '고칠 것' } }));
  const workspace = await f.ws.get('/api/social/workspace');
  assert.match(f.예약.planBundle(묶음.load(f.dir), workspace, {})[0].reasons.join(' '), /고칠 것/);
  fs.writeFileSync(prepFile, JSON.stringify({ ...prep, 검사: { ...prep.검사, 파일: [{ ...prep.검사.파일[0], 바이트: 1 }] } }));
  assert.match(f.예약.planBundle(묶음.load(f.dir), workspace, {})[0].reasons.join(' '), /다시 검사/);
});

test('첫 인자(명령·편 폴더)가 빠지지 않고, 명령 이름은 NFC·영어 이름도 받으며, 명령도 폴더도 아니면 자격을 읽기 전에 멈춘다(10-22 「자격」이 사라짐)', () => {
  const { 명령이름 } = require('../tools/작업실예약.js');
  assert.equal(명령이름('자격'.normalize('NFD')), '자격');
  assert.equal(명령이름('credential'), '자격');
  assert.equal(명령이름('Status'), '상태');
  assert.equal(명령이름('cancel'), '취소');
  assert.equal(명령이름('docs/마케팅/어느편'), 'docs/마케팅/어느편');
  const tool = path.join(here, '..', 'tools', '작업실예약.js');
  let out = '';
  try { execFileSync(process.execPath, [tool, '없는편_시험_20261022'], { encoding: 'utf8', stdio: 'pipe' }); assert.fail('멈춰야 한다'); } catch (error) {
    assert.equal(error.status, 2);
    out = String(error.stderr);
  }
  assert.match(out, /모르는 명령이거나 없는 편 폴더다/);
  assert.match(out, /credential/);
  assert.doesNotMatch(out, /자격이 없습니다/);
});

function queueCli(t, { records = {}, ready = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-queue-cli-'));
  const linkDir = path.join(root, 'links'), callsFile = path.join(root, 'calls.jsonl');
  fs.mkdirSync(path.join(root, 'tools'));
  fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
  fs.mkdirSync(linkDir);
  for (const [name, record] of Object.entries(records)) fs.writeFileSync(path.join(linkDir, name + '.json'), JSON.stringify(record));
  if (ready) {
    const posting = path.join(root, 'docs', '마케팅', 'ready', '게시');
    fs.mkdirSync(posting, { recursive: true });
    fs.writeFileSync(path.join(posting, '준비.json'), JSON.stringify({ 작업실등록: true, 상태: '올릴 준비', 검사: { 결과: '확인할 것' } }));
  }
  // 자격 보관소·네트워크·실제 텔레그램에 닿기 전에 모두 대역으로 바꾼다.
  const preload = path.join(root, 'guards.cjs');
  fs.writeFileSync(preload, `
    const fs = require('node:fs');
    const record = (kind) => fs.appendFileSync(${JSON.stringify(callsFile)}, JSON.stringify({ kind }) + '\\n');
    require('node:child_process').spawnSync = () => { record('credential'); return { status: 1, stderr: 'CREDENTIAL_BLOCKED_BY_TEST' }; };
    global.fetch = async () => { record('fetch'); throw new Error('NETWORK_BLOCKED_BY_TEST'); };
    require(${JSON.stringify(path.join(here, '..', 'tools', 'lib', '헤르메스보내기.js'))}).보내기 = () => { record('telegram'); return { ok: true }; };
  `);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    linkDir,
    run: (argv) => spawnSync(process.execPath, ['--require', preload, path.join(here, '..', 'tools', '작업실예약.js'), ...argv], {
      cwd: root, encoding: 'utf8', timeout: 10000, windowsHide: true,
      env: { ...process.env, SYNK_WORKSPACE_SESSION: '', SYNK_WORKSPACE_LINK_DIR: linkDir },
    }),
    calls: () => fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line).kind) : [],
  };
}

const pendingLink = (extra = {}) => ({ 편: 'fixture', 링크: 'https://example.test/review', 판: [], 만료: new Date(Date.now() + 86400000).toISOString(), 보냄: false, ...extra });

test('빈 대기열은 자격을 읽거나 서버에 로그인하지 않고 정상 종료한다', (t) => {
  const f = queueCli(t);
  const r = f.run(['--대기열', '--실행', '--텔레그램']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /등록할 편이 없다/);
  assert.deepEqual(f.calls(), []);
});

test('빈 대기열도 미발송 검토 링크를 이어 보내고, 보낸 링크·만료 링크는 다시 보내지 않는다', (t) => {
  const f = queueCli(t, { records: { pending: pendingLink(), sent: pendingLink({ 보냄: true }), expired: pendingLink({ 만료: '2000-01-01T00:00:00Z' }) } });
  const r = f.run(['--대기열', '--실행', '--텔레그램']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(f.calls(), ['telegram']);
  const record = JSON.parse(fs.readFileSync(path.join(f.linkDir, 'pending.json'), 'utf8'));
  assert.equal(record.보냄, true);
  assert.ok(Number.isFinite(Date.parse(record.보낸때)));
  const again = f.run(['--대기열', '--실행', '--텔레그램']);
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(f.calls(), ['telegram'], '같은 링크를 다음 회차에 다시 보내지 않는다');
});

test('빈 대기열 미리보기는 미발송 링크도 보내거나 고치지 않는다', (t) => {
  const f = queueCli(t, { records: { pending: pendingLink() } });
  const file = path.join(f.linkDir, 'pending.json'), before = fs.readFileSync(file);
  const r = f.run(['--대기열', '--텔레그램']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(f.calls(), []);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('등록할 편이 있으면 인증 실패를 빈 대기열 성공으로 숨기지 않는다', (t) => {
  const f = queueCli(t, { ready: true, records: { pending: pendingLink() } });
  const r = f.run(['--대기열', '--실행', '--텔레그램']);
  assert.equal(r.status, process.platform === 'win32' ? 1 : 3, r.stderr);
  assert.doesNotMatch(r.stdout, /등록할 편이 없다/);
  assert.deepEqual(f.calls(), process.platform === 'win32' ? ['credential'] : []);
  if (process.platform === 'win32') assert.match(r.stderr, /CREDENTIAL_BLOCKED_BY_TEST/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.linkDir, 'pending.json'), 'utf8')).보냄, false);
});

test('승인 하나로 함께 거는 판(10-26 유호님) — 작업실 판과 같은 원본 영상의 페북 · 틱톡 · 텔레그램만, 다른 렌더 · 글 판은 따로, 텔레그램 승인 요청에 두 줄', async (t) => {
  const 예약 = require('../tools/작업실예약.js');
  const row = (account, platform, file, eligible = false) => ({ account, platform, time: '2026-10-30T12:00:00Z', eligible, plate: { video: file ? { path: file } : null }, ...(eligible ? { video: { path: file } } : {}) });
  const rows = [row('lab-instagram', 'instagram', '/v/mn.mp4', true), row('lab-facebook', 'facebook', '/v/mn.mp4'), row('lab-tiktok', 'tiktok', '/v/mn.mp4'),
    row('lab-telegram', 'telegram', '/v/mn.mp4'), row('lab-mm-tiktok', 'tiktok', '/v/mm.mp4'), row('lab-cn-xiaohongshu', 'xiaohongshu', '/v/mn.mp4'),
    row('yuhobuilds-x', 'x', '/v/mn.mp4'), row('shift-tistory', 'tistory', null)];
  const c = 예약.companions(rows);
  assert.deepEqual(c.함께.map((p) => p.계정), ['lab-facebook', 'lab-tiktok', 'lab-telegram']);
  assert.deepEqual(c.따로.map((p) => p.계정), ['lab-mm-tiktok', 'lab-cn-xiaohongshu', 'yuhobuilds-x', 'shift-tistory']);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '작업실예약-함께-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'a.json');
  fs.writeFileSync(file, JSON.stringify({ ...pendingLink(), 제목: '시험 편', 판: [{ 계정: 'lab-instagram', 시각: '2026-10-30T12:00:00Z' }], ...c }));
  const 헤르메스 = require('../tools/lib/헤르메스보내기.js');
  const original = 헤르메스.보내기;
  let text = null;
  헤르메스.보내기 = (_exe, _to, body) => { text = body; return { ok: true }; };
  t.after(() => { 헤르메스.보내기 = original; });
  assert.equal(await 예약.sendLink(file), true);
  assert.match(text, /^승인하시면 같은 영상으로 함께 걸어요: lab-facebook 10-30 21:00 · lab-tiktok 10-30 21:00 · lab-telegram 10-30 21:00$/m);
  assert.match(text, /^「올려」를 따로 받는 판: lab-mm-tiktok 10-30 21:00 · lab-cn-xiaohongshu 10-30 21:00 · yuhobuilds-x 10-30 21:00 · shift-tistory 10-30 21:00$/m);
});
