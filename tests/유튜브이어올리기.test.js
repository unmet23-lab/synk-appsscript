'use strict';
// 유튜브 이어 올리기(tools/유튜브이어올리기.cjs) — 가짜 YouTube 응답으로만 돈다. 실제 자격 보관소·네트워크·업로드 없음.
//   발행기(tools/lib/sns-publisher.js)로 승인한 격리 계획을 만들고, 둘째 자막에서 하루 한도(403 quota)로 멈춘 partial을 실제 발행 흐름으로 만든 뒤 이어 올린다.
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// 발행기를 불러오기 전에 막는다: 자격 보관소(PowerShell)와 실제 네트워크는 어떤 시험도 닿지 않는다.
mock.method(childProcess, 'spawnSync', () => { throw new Error('시험에서 자격 보관소를 읽으면 안 됨'); });
mock.method(globalThis, 'fetch', async () => { throw new Error('시험에서 실제 네트워크를 부르면 안 됨'); });
const P = require('../tools/lib/sns-publisher.js');
const R = require('../tools/유튜브이어올리기.cjs');

const temporary = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) {
    const allowed = path.resolve(P.REPO_ROOT, 'tmp');
    assert.equal(path.resolve(dir).startsWith(allowed + path.sep), true);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const CREDENTIAL = { clientId: 'fixture-client', clientSecret: 'fixture-secret', refreshToken: 'fixture-refresh', channelId: 'fixture-channel' };
const readCredentialImpl = () => CREDENTIAL;
const QUOTA = 'The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.';
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

function fixture({ playlist = true } = {}) {
  const base = path.join(P.REPO_ROOT, 'tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'youtube-resume-test-'));
  temporary.push(dir);
  const id = '01-test-youtube';
  const folder = path.join(dir, id);
  fs.mkdirSync(folder);
  const account = { brand: 'TEST', platform: 'youtube', handle: '@fixture', publisher: 'direct', expectedChannelId: 'fixture-channel', categoryId: '27', madeForKids: false };
  const accountsFile = path.join(dir, 'accounts.json');
  fs.writeFileSync(accountsFile, JSON.stringify({ accounts: { 'test-youtube': account }, policy: { allowUnreviewedPublicPublishing: false } }));
  fs.writeFileSync(path.join(folder, '원고.json'), JSON.stringify({ id, platform: 'youtube', account: '@fixture', title: '격리 시험 제목', caption: '격리 시험 본문', language: 'ko',
    ...(playlist ? { playlist: { title: '시험 재생목록', description: '', visibility: 'private' } } : {}) }));
  for (const file of ['video.mp4', 'thumbnail.jpg', 'subtitles-ko.srt', 'subtitles-mn.srt']) fs.writeFileSync(path.join(folder, file), `fixture-${file}`);
  const planFile = path.join(dir, 'plan.json');
  P.buildPlan({ root: dir, accountsFile, outputFile: planFile });
  P.approvePlan(planFile, [id], '격리 fixture 승인', { readCredentialImpl });
  return { dir, folder, id, accountsFile, planFile, resultFile: P.resultFileFor(planFile) };
}

// 실제 발행 흐름으로 partial을 만든다: 영상·썸네일·첫 자막(ko)까지 가고 둘째 자막(mn)에서 하루 한도로 멈춘다.
async function partialFixture(opts) {
  const f = fixture(opts);
  let captions = 0;
  const fetchImpl = async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'mock-access' });
    if (url.includes('/channels?')) return json({ items: [{ id: 'fixture-channel', snippet: { title: 'Fixture' } }] });
    if (url.includes('/upload/youtube/v3/videos?')) return new Response('', { status: 200, headers: { location: 'https://upload.invalid/session' } });
    if (url === 'https://upload.invalid/session') return json({ id: 'created-video' }, 201);
    if (url.includes('/thumbnails/set')) return json({ items: [{}] });
    if (url.includes('/captions?')) { captions++; return captions === 2 ? json({ error: { message: QUOTA } }, 403) : json({ id: 'caption-ko' }); }
    throw new Error('예상 밖 요청 ' + url);
  };
  await assert.rejects(P.publishPlan(f.planFile, [f.id], { fetchImpl, readCredentialImpl }), /quota/);
  const saved = P.readJson(f.resultFile).items[f.id];
  assert.equal(saved.state, 'partial');
  assert.deepEqual(saved.captions, [{ language: 'ko', id: 'caption-ko' }]);
  return { ...f, failedAt: saved.failedAt };
}

// 이어 올리기용 가짜 YouTube: 부른 주소·방법을 모두 적는다.
function youtube({ privacy = 'private', channelId = 'fixture-channel', remoteCaptions = ['ko'], playlists = [], failCaption = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'mock-access' });
    if (url.includes('/youtube/v3/channels?')) return json({ items: [{ id: channelId, snippet: { title: 'Fixture' } }] });
    if (url.includes('/youtube/v3/videos?part=status,snippet')) return json({ items: [{ id: 'created-video', status: { privacyStatus: privacy, uploadStatus: 'processed' }, snippet: { channelId: 'fixture-channel', title: '격리 시험 제목' } }] });
    if (url.includes('/youtube/v3/captions?part=snippet&videoId=')) return json({ items: remoteCaptions.map((language) => ({ id: 'remote-' + language, snippet: { language } })) });
    if (url.includes('/upload/youtube/v3/captions')) return failCaption ? json({ error: { message: QUOTA } }, 403) : json({ id: 'caption-mn' });
    if (url.includes('/youtube/v3/playlists?part=snippet&mine=true')) return json({ items: playlists });
    if (url.includes('/youtube/v3/playlists?part=snippet,status')) return json({ id: 'new-playlist' });
    if (url.includes('/youtube/v3/playlistItems?part=id&playlistId=')) return json({ items: [] });
    if (url.includes('/youtube/v3/playlistItems?part=snippet')) return json({ id: 'playlist-item-1' });
    throw new Error('예상 밖 요청 ' + url);
  };
  return { calls, fetchImpl };
}
const dayAfter = (iso) => () => new Date(new Date(iso).getTime() + 24 * 3600e3);
const quiet = { log: () => {} };

test('한도가 풀리는 때: 태평양 자정(서머타임 한국 16:00, 아니면 17:00)', () => {
  assert.equal(R.nextReset('2026-10-19T06:30:00Z').toISOString(), '2026-10-19T07:00:00.000Z'); // 15:30 KST 실패 → 16:00 KST
  assert.equal(R.nextReset('2026-10-19T08:10:00Z').toISOString(), '2026-10-20T07:00:00.000Z'); // 17:10 KST 실패(이미 새 날) → 다음 날 16:00
  assert.equal(R.nextReset('2026-11-10T07:30:00Z').toISOString(), '2026-11-10T08:00:00.000Z'); // 11월(PST) 16:30 KST → 17:00 KST
  assert.equal(R.isQuotaError(QUOTA), true);
  assert.equal(R.isQuotaError('YouTube ko 자막 업로드 실패 500: backendError'), false);
});

test('한도가 안 풀린 같은 태평양 날짜에는 네트워크 없이 멈춘다', async () => {
  const f = await partialFixture();
  const yt = youtube();
  const now = () => new Date(new Date(f.failedAt).getTime() + 60000);
  await assert.rejects(R.resumeItem(f.planFile, f.id, '한도 걸린 mn 자막 채우기', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now, ...quiet }), /아직 안 풀렸습니다/);
  assert.equal(yt.calls.length, 0);
  assert.equal(P.readJson(f.resultFile).items[f.id].state, 'partial');
});

test('한도가 풀린 뒤: 새로 올리지 않고 빠진 자막·재생목록만 채워 private으로 마친다', async () => {
  const f = await partialFixture();
  const before = P.readJson(f.resultFile).items[f.id];
  const yt = youtube({ remoteCaptions: ['ko'] });
  const { item } = await R.resumeItem(f.planFile, f.id, '한도 걸린 mn 자막 채우기', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), playlistRetry: { retryDelayMs: 1 }, ...quiet });
  assert.equal(yt.calls.filter((c) => c.url.includes('/upload/youtube/v3/videos')).length, 0, '영상은 다시 올리지 않는다');
  assert.equal(yt.calls.filter((c) => c.url.includes('/thumbnails/set')).length, 0, '이미 올린 썸네일은 다시 올리지 않는다');
  assert.deepEqual(yt.calls.filter((c) => c.url.includes('/upload/youtube/v3/captions')).map((c) => c.method), ['POST'], '빠진 mn 자막 하나만');
  assert.equal(yt.calls.filter((c) => c.method === 'PUT').length, 0, '공개·예약 전환 없음');
  assert.equal(item.state, 'private');
  assert.deepEqual(item.captions, [{ language: 'ko', id: 'caption-ko' }, { language: 'mn', id: 'caption-mn' }]);
  assert.equal(item.playlist.id, 'new-playlist');
  assert.equal(item.error, undefined);
  assert.equal(item.recovery.from, 'partial');
  assert.equal(item.recovery.failedAt, before.failedAt);
  assert.deepEqual(item.recovery.filled, { thumbnail: false, captions: ['mn'], playlist: true });
  assert.equal(item.publicationHash, before.publicationHash);
  assert.equal(fs.existsSync(`${f.resultFile}.이어올리기.lock`), false);
  // 다시 실행해도 이제 partial이 아니라 아무것도 부르지 않는다
  const again = youtube();
  await assert.rejects(R.resumeItem(f.planFile, f.id, '두 번째', { accountsFile: f.accountsFile, fetchImpl: again.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet }), /partial 항목이 아닙니다/);
  assert.equal(again.calls.length, 0);
  // 다 채운 결과는 평소 발행기의 다음 단계(--공개)가 받는 상태다
  const raw = fs.readFileSync(f.resultFile, 'utf8');
  for (const secret of ['fixture-secret', 'fixture-refresh', 'mock-access']) assert.equal(raw.includes(secret), false);
});

test('영상에 이미 붙은 자막은 다시 올리지 않고 기록만 채운다', async () => {
  const f = await partialFixture({ playlist: false });
  const yt = youtube({ remoteCaptions: ['ko', 'mn'] });
  const { item } = await R.resumeItem(f.planFile, f.id, '기록 맞추기', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet });
  assert.equal(yt.calls.filter((c) => c.url.includes('/upload/')).length, 0);
  assert.deepEqual(item.captions.map((c) => [c.language, c.id]), [['ko', 'caption-ko'], ['mn', 'remote-mn']]);
});

test('승인 뒤 계획이 바뀌었거나 결과 해시가 승인과 다르면 네트워크 전에 멈춘다', async () => {
  const f = await partialFixture();
  const plan = P.readJson(f.planFile);
  plan.items[0].text += ' 승인 뒤 바꿈';
  fs.writeFileSync(f.planFile, JSON.stringify(plan));
  const yt = youtube();
  await assert.rejects(R.resumeItem(f.planFile, f.id, '바뀐 계획', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet }), /다시 검수/);
  const g = await partialFixture();
  const result = P.readJson(g.resultFile);
  result.items[g.id].publicationHash = 'other-approval';
  fs.writeFileSync(g.resultFile, JSON.stringify(result));
  await assert.rejects(R.resumeItem(g.planFile, g.id, '다른 승인', { accountsFile: g.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(g.failedAt), ...quiet }), /해시가 지금 승인과 다릅니다/);
  assert.equal(yt.calls.length, 0);
});

test('영상이 비공개가 아니거나 다른 채널이면 아무것도 올리지 않는다', async () => {
  for (const [opts, pattern] of [[{ privacy: 'public' }, /public 상태/], [{ channelId: 'other-channel' }, /채널이 계정 설정과 다릅니다/]]) {
    const f = await partialFixture();
    const yt = youtube(opts);
    await assert.rejects(R.resumeItem(f.planFile, f.id, '확인', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet }), pattern);
    assert.equal(yt.calls.filter((c) => c.method !== 'GET' && !c.url.includes('oauth2')).length, 0);
    assert.equal(P.readJson(f.resultFile).items[f.id].state, 'partial');
  }
});

test('이어 올리다 또 한도에 걸리면 한 일을 남기고 partial로 둔다', async () => {
  const f = await partialFixture();
  const yt = youtube({ remoteCaptions: ['ko'], failCaption: true });
  await assert.rejects(R.resumeItem(f.planFile, f.id, '또 한도', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet }), /quota.*partial 그대로/);
  const saved = P.readJson(f.resultFile).items[f.id];
  assert.equal(saved.state, 'partial');
  assert.match(saved.error, /이어 올리기 중/);
  assert.equal(new Date(saved.failedAt).getTime(), dayAfter(f.failedAt)().getTime());
  // 새 실패 시각 기준으로 다시 같은 날에는 멈춘다
  const r = R.inspect({ ...loadForInspect(f) }, f.id, { now: dayAfter(f.failedAt)(), readCredentialImpl });
  assert.equal(r.ready, false);
});
function loadForInspect(f) {
  return { plan: P.readJson(f.planFile), config: P.loadAccounts(f.accountsFile), resultFile: f.resultFile, result: P.readJson(f.resultFile) };
}

test('한도와 무관한 실패는 --한도무관 없이 이어 올리지 않는다', async () => {
  const f = await partialFixture();
  const result = P.readJson(f.resultFile);
  result.items[f.id].error = 'YouTube mn 자막 업로드 실패 400: invalid subtitle';
  fs.writeFileSync(f.resultFile, JSON.stringify(result));
  const ctx = loadForInspect(f);
  assert.match(R.inspect(ctx, f.id, { now: dayAfter(f.failedAt)(), readCredentialImpl }).reasons.join(' '), /한도와 무관한 실패/);
  assert.equal(R.inspect(ctx, f.id, { now: dayAfter(f.failedAt)(), readCredentialImpl, notQuota: true }).ready, true);
});

test('잠금 파일이 있으면 두 번째 실행은 멈춘다', async () => {
  const f = await partialFixture();
  fs.writeFileSync(`${f.resultFile}.이어올리기.lock`, '{}');
  const yt = youtube();
  await assert.rejects(R.resumeItem(f.planFile, f.id, '겹침', { accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet }), /다른 이어 올리기가 도는 중/);
  assert.equal(yt.calls.length, 0);
});

test('근거 없이는 실행하지 않고, 미리보기는 네트워크 없이 빠진 것과 쓸 단위를 보여 준다', async () => {
  const f = await partialFixture();
  await assert.rejects(R.resumeItem(f.planFile, f.id, ' ', { accountsFile: f.accountsFile, readCredentialImpl, now: dayAfter(f.failedAt), ...quiet }), /--근거/);
  const r = R.inspect(loadForInspect(f), f.id, { now: dayAfter(f.failedAt)(), readCredentialImpl });
  assert.equal(r.ready, true);
  assert.deepEqual(r.missing.captions.map((c) => c.language), ['mn']);
  assert.equal(r.missing.thumbnail, false);
  assert.equal(r.missing.playlist, true);
  assert.equal(r.units, 2 + 50 + 400 + 2 + 50);
});

test('--상태는 읽기(GET)만 부른다', async () => {
  const f = await partialFixture();
  const yt = youtube();
  const rows = await R.readStatus({ planFile: f.planFile, accountsFile: f.accountsFile, fetchImpl: yt.fetchImpl, readCredentialImpl, ...quiet });
  assert.equal(rows[0].privacy, 'private');
  assert.deepEqual(rows[0].captions, ['ko']);
  assert.deepEqual([...new Set(yt.calls.filter((c) => !c.url.includes('oauth2')).map((c) => c.method))], ['GET']);
});
