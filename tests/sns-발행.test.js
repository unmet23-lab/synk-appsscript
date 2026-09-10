'use strict';

const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// Install before loading the publisher, which captures spawnSync. No test may
// reach the real vault, browser, network, or legacy credentials.
const vault = new Map();
mock.method(childProcess, 'spawnSync', (command, args, options) => {
  assert.equal(command, 'powershell.exe');
  assert.equal(path.basename(args[2]), 'sns-자격.ps1');
  const [mode, key] = args.slice(3);
  assert.match(key, /^SYNK\/SNS\/test-/);
  if (mode === 'set') { vault.set(key, options.input); return { status: 0, stdout: 'ok' }; }
  if (mode === 'delete') { vault.delete(key); return { status: 0, stdout: 'ok' }; }
  if (mode === 'has') return { status: 0, stdout: vault.has(key) ? '1' : '0' };
  assert.equal(mode, 'get');
  return vault.has(key) ? { status: 0, stdout: vault.get(key) } : { status: 3, stdout: '' };
});
mock.method(globalThis, 'fetch', async () => { throw new Error('Live network is forbidden in publishing tests'); });
const {
  REPO_ROOT,
  DEFAULT_ACCOUNTS,
  loadAccounts,
  scanPackages,
  validateItem,
  buildPlan,
  approvePlan,
  verifyDependencies,
  splitText,
  writeCredential,
  readCredential,
  hasCredential,
  deleteCredential,
  checkConnection,
  youtubeUpload,
  telegramPublish,
  pinterestPublish,
  threadsPublish,
  publishPlan,
  resultFileFor,
  publicationHash,
  renderPlanMarkdown,
  openManualItem,
} = require('../tools/lib/sns-publisher.js');

const PACKAGE_ROOT = path.join(REPO_ROOT, 'docs', '홍보물', '첫게시물_20260910', '전체_업로드');
const temporary = [];

afterEach(() => {
  vault.clear();
  for (const target of temporary.splice(0)) {
    const resolved = path.resolve(target);
    const allowed = path.resolve(REPO_ROOT, 'tmp');
    assert.equal(resolved.startsWith(`${allowed}${path.sep}`), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

function tempDir() {
  const base = path.join(REPO_ROOT, 'tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'sns-publish-test-'));
  temporary.push(dir);
  return dir;
}

test('현재 첫 게시물 19계정을 계정 지도와 한 번에 묶는다', () => {
  const items = scanPackages(PACKAGE_ROOT, DEFAULT_ACCOUNTS);
  const accounts = loadAccounts(DEFAULT_ACCOUNTS);
  assert.equal(items.length, 19);
  assert.equal(new Set(items.map((item) => item.accountKey)).size, 19);
  assert.deepEqual(accounts.accounts['shift-tistory'], {
    brand: 'SHIFT',
    platform: 'tistory',
    handle: 'yuhobuilds.tistory.com',
    publisher: 'manual-assisted',
    editorUrl: 'https://yuhobuilds.tistory.com/manage/newpost',
    connection: 'official-editor',
  });
  assert.deepEqual(items.map((item) => item.id).slice(0, 3), [
    '01-lab-youtube', '02-lab-instagram', '03-lab-tiktok',
  ]);
  assert.equal(items.find((item) => item.id === '01-lab-youtube').video.endsWith('video.mp4'), true);
  assert.equal(items.find((item) => item.id === '17-shift-naverblog').dependencies.some((dep) => dep.role === 'article'), true);
});

test('티스토리 원문 묶음은 본문 파일을 요구하고 수동 편집기로 넘긴다', () => {
  const dir = tempDir();
  const packageDir = path.join(dir, '20-shift-tistory');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, '원고.json'), JSON.stringify({
    id: '20-shift-tistory', brand: 'SHIFT', platform: 'Tistory',
    account: 'yuhobuilds.tistory.com', format: 'article', language: 'ko', title: '시험',
  }));
  fs.writeFileSync(path.join(packageDir, '본문.md'), '# 회사 기록\n\n실제 시도와 수정입니다.');
  const items = scanPackages(dir, DEFAULT_ACCOUNTS);
  assert.equal(items.length, 1);
  assert.equal(items[0].platformName, '티스토리');
  assert.equal(items[0].publisher, 'manual-assisted');
  assert.deepEqual(validateItem(items[0]), []);
  fs.rmSync(path.join(packageDir, '본문.md'));
  assert.deepEqual(validateItem(scanPackages(dir, DEFAULT_ACCOUNTS)[0]), ['본문 없음', '본문.md 없음']);
});

test('발행 검수판에 자격증명을 담지 않고 모든 자료를 검사한다', () => {
  const dir = tempDir();
  const planFile = path.join(dir, 'plan.json');
  const plan = buildPlan({ root: PACKAGE_ROOT, accountsFile: DEFAULT_ACCOUNTS, outputFile: planFile });
  assert.equal(plan.items.length, 19);
  assert.deepEqual(plan.items.flatMap((item) => item.errors), []);
  const raw = fs.readFileSync(planFile, 'utf8');
  assert.doesNotMatch(raw, /access[_-]?token|refresh[_-]?token|client[_-]?secret|botToken/i);
  assert.equal(fs.existsSync(path.join(dir, 'plan.md')), true);
});

test('승인은 현재 파일 해시에 묶이고 원본 변경을 발행 전에 잡는다', () => {
  const dir = tempDir();
  const packageDir = path.join(dir, '01-lab-youtube');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, '원고.json'), JSON.stringify({
    id: '01-lab-youtube', brand: 'LAB', platform: 'YouTube', account: '@synkkorean',
    format: 'video', language: 'ko', title: '시험', caption: '본문', alt: [],
  }));
  fs.writeFileSync(path.join(packageDir, 'video.mp4'), Buffer.from('fixture-video'));
  const planFile = path.join(dir, 'plan.json');
  const plan = buildPlan({ root: dir, accountsFile: DEFAULT_ACCOUNTS, outputFile: planFile });
  assert.deepEqual(plan.items[0].errors, []);
  approvePlan(planFile, ['01-lab-youtube'], '격리 fixture 승인', { readCredentialImpl: () => null });
  const approved = JSON.parse(fs.readFileSync(planFile, 'utf8')).items[0];
  assert.equal(approved.approval.contentHash, approved.contentHash);
  fs.appendFileSync(path.join(packageDir, 'video.mp4'), 'changed');
  assert.deepEqual(verifyDependencies(approved).map((value) => value.includes('내용 변경')), [true]);
});

test('Telegram 긴 본문을 4096자 이하의 의미 단위로 나눈다', () => {
  const text = `${'가'.repeat(3000)}\n${'나'.repeat(3000)}\n${'다'.repeat(3000)}`;
  const chunks = splitText(text, 4096);
  assert.equal(chunks.length, 3);
  assert.equal(chunks.every((chunk) => chunk.length <= 4096), true);
  assert.equal(chunks.join(''), text.replaceAll('\n', ''));
});

test('Windows 자격 어댑터의 저장·회수·삭제를 메모리 mock으로 격리한다', { skip: process.platform !== 'win32' }, () => {
  const key = `test-${process.pid}-${Date.now()}`;
  const value = { fixture: 'credential-round-trip', number: 42 };
  try {
    writeCredential(key, value);
    assert.equal(hasCredential(key), true);
    assert.deepEqual(readCredential(key, { allowLegacy: false }), value);
  } finally {
    deleteCredential(key);
  }
  assert.equal(hasCredential(key), false);
});

test('YouTube 연결 점검은 기대 채널 ID와 스코프만 보고한다', async () => {
  const config = loadAccounts(DEFAULT_ACCOUNTS);
  const account = config.accounts['lab-youtube'];
  const key = `test-youtube-${process.pid}-${Date.now()}`;
  const fixture = { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' };
  const responses = [
    new Response(JSON.stringify({ access_token: 'short-lived', scope: 'https://www.googleapis.com/auth/youtube.force-ssl' }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: account.expectedChannelId, snippet: { title: 'SYNK LAB', customUrl: '@synkkorean' } }] }), { status: 200 }),
  ];
  const checked = await checkConnection(key, account, {
    fetchImpl: async () => responses.shift(), readCredentialImpl: () => fixture,
  });
  assert.equal(checked.state, 'connected');
  assert.equal(checked.channelId, account.expectedChannelId);
  assert.deepEqual(checked.scopes, ['https://www.googleapis.com/auth/youtube.force-ssl']);
  assert.equal(JSON.stringify(checked).includes('short-lived'), false);
});

test('YouTube 발행기는 재개 가능 업로드로 영상과 썸네일을 올린다', async () => {
  const dir = tempDir();
  const video = path.join(dir, 'video.mp4');
  const thumbnail = path.join(dir, 'thumbnail.jpg');
  fs.writeFileSync(video, Buffer.alloc(1024, 1));
  fs.writeFileSync(thumbnail, Buffer.alloc(128, 2));
  const item = {
    id: 'fixture-youtube', title: '시험 영상', text: '시험 본문', language: 'ko',
    video: path.relative(REPO_ROOT, video).replaceAll('\\', '/'),
    thumbnail: path.relative(REPO_ROOT, thumbnail).replaceAll('\\', '/'),
    subtitles: [], publish: { visibility: 'private', publishAt: null, notifySubscribers: false },
  };
  const account = { expectedChannelId: 'channel-1', categoryId: '27', madeForKids: false };
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ access_token: 'access', scope: 'scope' }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: 'channel-1', snippet: { title: 'SYNK LAB' } }] }), { status: 200 }),
    new Response('', { status: 200, headers: { location: 'https://upload.invalid/session' } }),
    new Response(JSON.stringify({ id: 'video-1' }), { status: 201 }),
    new Response(JSON.stringify({ items: [{}] }), { status: 200 }),
  ];
  const result = await youtubeUpload(item, account, { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' }, {
    fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift(); },
  });
  assert.equal(result.state, 'private');
  assert.equal(result.url, 'https://www.youtube.com/watch?v=video-1');
  assert.equal(calls[2].options.headers['x-upload-content-length'], '1024');
  assert.equal(calls[3].options.headers['content-range'], 'bytes 0-1023/1024');
  assert.match(calls[4].url, /thumbnails\/set/);
});

test('Telegram 발행기는 사진과 긴 본문을 누락 없이 나눠 보낸다', async () => {
  const dir = tempDir();
  const image = path.join(dir, 'upload-01.jpg');
  fs.writeFileSync(image, Buffer.alloc(64, 3));
  const item = {
    title: '표지', text: '가'.repeat(5000), images: [path.relative(REPO_ROOT, image).replaceAll('\\', '/')],
  };
  const calls = [];
  let id = 10;
  const result = await telegramPublish(item, { chatId: '@synkmn', handle: 't.me/synkmn' }, { botToken: 'fixture' }, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: true, result: { message_id: id++ } }), { status: 200 });
    },
  });
  assert.equal(result.state, 'published');
  assert.equal(calls.filter((call) => call.url.endsWith('/sendPhoto')).length, 1);
  assert.equal(calls.filter((call) => call.url.endsWith('/sendMessage')).length, 2);
  assert.deepEqual(result.ids, [10, 11, 12]);
});

test('Pinterest 발행기는 핀 자료와 대체텍스트를 하나의 공식 요청으로 묶는다', async () => {
  const dir = tempDir();
  const image = path.join(dir, 'upload-01.jpg');
  fs.writeFileSync(image, Buffer.alloc(32, 4));
  let payload;
  const result = await pinterestPublish({
    title: '핀 제목', text: '핀 설명', alt: ['대체 설명'], link: 'https://example.com',
    images: [path.relative(REPO_ROOT, image).replaceAll('\\', '/')],
  }, {}, { accessToken: 'fixture', boardId: 'board-1' }, {
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'pin-1' }), { status: 201 });
    },
  });
  assert.equal(payload.board_id, 'board-1');
  assert.equal(payload.alt_text, '대체 설명');
  assert.equal(payload.media_source.source_type, 'image_base64');
  assert.equal(result.url, 'https://www.pinterest.com/pin/pin-1/');
});

test('Threads는 첨부 자료를 몰래 빼고 텍스트만 게시하지 않는다', async () => {
  await assert.rejects(
    threadsPublish({ text: '본문', images: ['upload-01.jpg'] }, {}, { userId: 'u', accessToken: 't' }, { fetchImpl: async () => { throw new Error('호출되면 안 됨'); } }),
    /HTTPS 미디어 URL/,
  );
});

function approvedFixture(platform = 'youtube') {
  const dir = tempDir();
  const key = `test-${platform}`;
  const id = `01-${key}`;
  const folder = path.join(dir, id);
  fs.mkdirSync(folder);
  const account = {
    brand: 'TEST', platform, handle: '@fixture',
    publisher: platform === 'tistory' ? 'manual-assisted' : 'direct',
    expectedChannelId: 'fixture-channel', categoryId: '27', madeForKids: false,
    ...(platform === 'tistory' ? { editorUrl: 'https://editor.invalid/new' } : {}),
  };
  const config = { accounts: { [key]: account }, policy: { allowUnreviewedPublicPublishing: false } };
  const accountsFile = path.join(dir, 'accounts.json');
  fs.writeFileSync(accountsFile, JSON.stringify(config));
  fs.writeFileSync(path.join(folder, '원고.json'), JSON.stringify({
    id, platform, account: '@fixture', title: '격리 시험 제목', caption: '격리 시험 본문', language: 'ko',
  }));
  fs.writeFileSync(path.join(folder, '본문.md'), '격리 시험 본문');
  for (const file of ['video.mp4', 'thumbnail.jpg', 'upload-01.jpg', 'upload-02.jpg', 'document.pdf', 'subtitles-ko.srt', 'subtitles-mn.srt']) {
    fs.writeFileSync(path.join(folder, file), `fixture-${file}`);
  }
  const planFile = path.join(dir, 'plan.json');
  buildPlan({ root: dir, accountsFile, outputFile: planFile });
  const credential = {
    clientId: 'fixture-client', clientSecret: 'fixture-secret', refreshToken: 'fixture-refresh',
    accessToken: 'fixture-access', channelId: 'fixture-channel',
    pageId: 'fixture-page', userId: 'fixture-user', authorUrn: 'fixture-author', boardId: 'fixture-board',
  };
  const readCredentialImpl = () => credential;
  const plan = approvePlan(planFile, [id], '격리 fixture 전용 승인', { readCredentialImpl });
  return { dir, folder, id, key, account, config, accountsFile, planFile, plan,
    credential, readCredentialImpl, resultFile: resultFileFor(planFile) };
}

test('승인 후 실제 발행 내용·대상·설정 변경은 네트워크 호출 전에 막는다', async (t) => {
  const cases = [
    ['제목', (i) => { i.title += ' 변경'; }],
    ['본문', (i) => { i.text += ' 변경'; }],
    ['표시 계정', (i) => { i.account = '@other'; }],
    ['계정 키', (i, f) => { f.config.accounts.other = f.account; i.accountKey = 'other'; }],
    ['플랫폼', (i) => { i.platform = 'facebook'; }],
    ['언어', (i) => { i.language = 'mn'; }],
    ['공개범위', (i) => { i.publish.visibility = 'public'; }],
    ['예약시각', (i) => { i.publish.publishAt = '2030-01-01T00:00:00Z'; }],
    ['구독 알림', (i) => { i.publish.notifySubscribers = true; }],
    ['TikTok 통제값', (i) => { i.publish.tiktok = { privacyLevel: 'SELF_ONLY', disableDuet: true, disableComment: true, disableStitch: true, coverTimestampMs: 500 }; }],
    ['영상 경로', (i, f) => { const file = path.join(f.folder, 'other.mp4'); fs.copyFileSync(path.join(f.folder, 'video.mp4'), file); i.video = path.relative(REPO_ROOT, file); }],
    ['이미지 순서', (i) => { i.images.reverse(); }],
    ['썸네일 경로', (i) => { i.thumbnail = i.images[0]; }],
    ['문서 경로', (i) => { i.document = null; }],
    ['자막 순서', (i) => { i.subtitles.reverse(); }],
    ['HTTPS 미디어 주소', (i) => { i.remoteMediaUrls = ['https://media.invalid/new.jpg']; }],
    ['대체텍스트', (i) => { i.alt = ['새 설명']; }],
    ['연결 링크', (i) => { i.link = 'https://destination.invalid/'; }],
    ['기존 파일 내용', (_i, f) => { fs.appendFileSync(path.join(f.folder, 'video.mp4'), 'changed'); }],
    ['기대 채널 ID', (_i, f) => { f.account.expectedChannelId = 'other-channel'; }],
    ['계정 핸들', (_i, f) => { f.account.handle = '@other'; }],
    ['YouTube 카테고리', (_i, f) => { f.account.categoryId = '22'; }],
    ['아동용 설정', (_i, f) => { f.account.madeForKids = true; }],
    ['수동 통로로 바꿔 승인 검사 우회', (_i, f) => { f.account.publisher = 'manual-assisted'; }],
    ['Telegram 도착 채널', (_i, f) => { f.account.chatId = '@other'; }],
    ['Meta API 버전', (_i, f) => { f.account.graphVersion = 'changed'; }],
    ['LinkedIn API 버전', (_i, f) => { f.account.apiVersion = 'changed'; }],
    ['자격의 게시 페이지', (_i, f) => { f.credential.pageId = 'other-page'; }],
    ['자격의 게시 사용자', (_i, f) => { f.credential.userId = 'other-user'; }],
    ['자격의 LinkedIn 작성자', (_i, f) => { f.credential.authorUrn = 'other-author'; }],
    ['자격의 Pinterest 보드', (_i, f) => { f.credential.boardId = 'other-board'; }],
    ['자격의 API 버전 덮어쓰기', (_i, f) => { f.credential.graphVersion = 'changed'; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const f = approvedFixture();
      mutate(f.plan.items[0], f);
      fs.writeFileSync(f.planFile, JSON.stringify(f.plan));
      fs.writeFileSync(f.accountsFile, JSON.stringify(f.config));
      let networkCalls = 0;
      await assert.rejects(publishPlan(f.planFile, [f.id], {
        readCredentialImpl: f.readCredentialImpl,
        fetchImpl: async () => { networkCalls++; throw new Error('호출되면 안 됨'); },
      }), /다시 검수|원본이 계획 후 바뀌었습니다|발행 계정\/플랫폼이 다릅니다/);
      assert.equal(networkCalls, 0);
      assert.equal(fs.existsSync(f.resultFile), false);
    });
  }
});

test('이전 승인 형식은 재검수가 필요하며 재승인은 최신 설정으로 계산한다', async () => {
  const f = approvedFixture();
  const before = f.plan.items[0].approval.publicationHash;
  f.plan.items[0].approval = { contentHash: f.plan.items[0].contentHash, note: 'old fixture' };
  fs.writeFileSync(f.planFile, JSON.stringify(f.plan));
  await assert.rejects(publishPlan(f.planFile, [f.id], { readCredentialImpl: f.readCredentialImpl }), /기존 형식 승인/);
  f.plan.items[0].publish.visibility = 'public';
  fs.writeFileSync(f.planFile, JSON.stringify(f.plan));
  const approved = approvePlan(f.planFile, [f.id], '변경된 fixture만 승인', { readCredentialImpl: f.readCredentialImpl });
  assert.notEqual(approved.items[0].approval.publicationHash, before);
  assert.match(renderPlanMarkdown(approved), /승인 기록 1\/1개/);
  const raw = fs.readFileSync(f.planFile, 'utf8');
  for (const secret of ['fixture-secret', 'fixture-refresh', 'fixture-access']) assert.equal(raw.includes(secret), false);
});

test('토큰 교체와 JSON 키 순서만 바뀌면 같은 승인 내용이다', () => {
  const f = approvedFixture();
  const item = f.plan.items[0];
  const rotated = { ...f.credential, accessToken: 'rotated', refreshToken: 'rotated-refresh', clientSecret: 'rotated-secret' };
  const reordered = { ...item, publish: { notifySubscribers: false, publishAt: null, visibility: 'private' } };
  assert.equal(publicationHash(reordered, f.account, rotated), item.approval.publicationHash);
});

test('의존 목록 밖에 지정한 미디어도 실제 바이트 변경을 감지한다', async () => {
  const f = approvedFixture();
  const added = path.join(f.folder, 'extra.jpg');
  fs.writeFileSync(added, 'reviewed extra image');
  f.plan.items[0].images.push(path.relative(REPO_ROOT, added));
  fs.writeFileSync(f.planFile, JSON.stringify(f.plan));
  approvePlan(f.planFile, [f.id], '추가 fixture 검수', { readCredentialImpl: f.readCredentialImpl });
  fs.appendFileSync(added, ' changed');
  await assert.rejects(publishPlan(f.planFile, [f.id], { readCredentialImpl: f.readCredentialImpl }), /다시 검수/);
});

test('수동 통로도 승인 검증을 거치고 변경된 원고는 편집기를 열지 않는다', async () => {
  const f = approvedFixture('tistory');
  const result = await publishPlan(f.planFile, [f.id]);
  assert.equal(result.result.items[f.id].state, 'manual-required');
  f.plan.items[0].text += ' 승인 뒤 변경';
  fs.writeFileSync(f.planFile, JSON.stringify(f.plan));
  assert.throws(() => openManualItem(f.planFile, f.id), /다시 검수/);
});

function youtubeMock(f, failAt) {
  const calls = [];
  let captions = 0;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  return {
    calls,
    fetchImpl: async (url) => {
      calls.push(url);
      if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'mock-access' });
      if (url.includes('/channels?')) return json({ items: [{ id: 'fixture-channel', snippet: { title: 'Fixture' } }] });
      if (url.includes('/videos?')) return new Response('', { status: 200, headers: { location: 'https://upload.invalid/session' } });
      if (url === 'https://upload.invalid/session') return json({ id: 'created-video' }, 201);
      const checkpoint = JSON.parse(fs.readFileSync(f.resultFile, 'utf8')).items[f.id];
      assert.equal(checkpoint.state, 'partial');
      assert.equal(checkpoint.id, 'created-video');
      if (url.includes('/thumbnails/set')) {
        assert.equal(checkpoint.thumbnail, null);
        assert.deepEqual(checkpoint.captions, []);
        return failAt === 'thumbnail' ? json({ error: { message: 'mock thumbnail failure' } }, 403) : json({ items: [{}] });
      }
      if (url.includes('/captions?')) {
        assert.equal(checkpoint.thumbnail, true);
        assert.equal(checkpoint.captions.length, captions);
        captions++;
        if (failAt === `caption-${captions}`) return json({ error: { message: 'mock caption failure' } }, 403);
        return json({ id: `caption-${captions}` });
      }
      throw new Error('Unexpected mocked YouTube request');
    },
  };
}

for (const failAt of ['thumbnail', 'caption-1', 'caption-2']) {
  test(`YouTube ${failAt} 실패는 원격 ID·완료 작업을 보존하고 재업로드를 차단한다`, async () => {
    const f = approvedFixture();
    const remote = youtubeMock(f, failAt);
    const options = { fetchImpl: remote.fetchImpl, readCredentialImpl: f.readCredentialImpl };
    await assert.rejects(publishPlan(f.planFile, [f.id], options), /기존 YouTube 영상 created-video/);
    const saved = JSON.parse(fs.readFileSync(f.resultFile, 'utf8')).items[f.id];
    assert.equal(saved.state, 'partial');
    assert.equal(saved.id, 'created-video');
    assert.equal(saved.url, 'https://www.youtube.com/watch?v=created-video');
    assert.equal(saved.thumbnail, failAt === 'thumbnail' ? null : true);
    assert.equal(saved.captions.length, failAt === 'caption-2' ? 1 : 0);
    assert.equal(saved.finishedAt, undefined);
    const callCount = remote.calls.length;
    for (const force of [false, true]) {
      await assert.rejects(publishPlan(f.planFile, [f.id], { ...options, force }), /partial.*created-video/);
    }
    // Even reapproval of a changed plan cannot turn partial success into a new upload.
    f.plan.items[0].text += ' 재검수';
    f.plan.items[0].contentHash = 'different-content';
    fs.writeFileSync(f.planFile, JSON.stringify(f.plan));
    approvePlan(f.planFile, [f.id], '변경 fixture', { readCredentialImpl: f.readCredentialImpl });
    await assert.rejects(publishPlan(f.planFile, [f.id], options), /partial.*created-video/);
    assert.equal(remote.calls.length, callCount);
    assert.equal(remote.calls.filter((url) => url.includes('/videos?')).length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.resultFile, 'utf8')).items[f.id], saved);
  });
}

test('YouTube 전체 성공 뒤 같은 계획을 재실행해도 업로드는 한 번이다', async () => {
  const f = approvedFixture();
  const remote = youtubeMock(f);
  const options = { fetchImpl: remote.fetchImpl, readCredentialImpl: f.readCredentialImpl };
  const first = await publishPlan(f.planFile, [f.id], options);
  const saved = first.result.items[f.id];
  assert.equal(saved.state, 'private');
  assert.equal(saved.id, 'created-video');
  assert.equal(saved.thumbnail, true);
  assert.equal(saved.captions.length, 2);
  assert.ok(saved.finishedAt);
  const count = remote.calls.length;
  await publishPlan(f.planFile, [f.id], options);
  assert.equal(remote.calls.length, count);
});

test('원격 ID 기록 전 중단된 publishing 상태도 자동 재시도하지 않는다', async () => {
  const f = approvedFixture();
  fs.writeFileSync(f.resultFile, JSON.stringify({ items: { [f.id]: { state: 'publishing', contentHash: f.plan.items[0].contentHash } } }));
  await assert.rejects(publishPlan(f.planFile, [f.id], {
    force: true, readCredentialImpl: () => { throw new Error('자격을 읽으면 안 됨'); },
  }), /publishing.*원격 결과/);
});
