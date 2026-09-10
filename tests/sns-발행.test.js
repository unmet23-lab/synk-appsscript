'use strict';

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  REPO_ROOT,
  DEFAULT_ACCOUNTS,
  loadAccounts,
  scanPackages,
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
} = require('../tools/lib/sns-publisher.js');

const PACKAGE_ROOT = path.join(REPO_ROOT, 'docs', '홍보물', '첫게시물_20260910', '전체_업로드');
const temporary = [];

afterEach(() => {
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
  assert.equal(items.length, 19);
  assert.equal(new Set(items.map((item) => item.accountKey)).size, 19);
  assert.deepEqual(items.map((item) => item.id).slice(0, 3), [
    '01-lab-youtube', '02-lab-instagram', '03-lab-tiktok',
  ]);
  assert.equal(items.find((item) => item.id === '01-lab-youtube').video.endsWith('video.mp4'), true);
  assert.equal(items.find((item) => item.id === '17-shift-naverblog').dependencies.some((dep) => dep.role === 'article'), true);
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
  approvePlan(planFile, ['01-lab-youtube'], '시험 승인');
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

test('Windows 자격 증명 보관소에 비밀을 저장·회수·삭제한다', { skip: process.platform !== 'win32' }, () => {
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
  writeCredential(key, fixture);
  const responses = [
    new Response(JSON.stringify({ access_token: 'short-lived', scope: 'https://www.googleapis.com/auth/youtube.force-ssl' }), { status: 200 }),
    new Response(JSON.stringify({ items: [{ id: account.expectedChannelId, snippet: { title: 'SYNK LAB', customUrl: '@synkkorean' } }] }), { status: 200 }),
  ];
  try {
    const checked = await checkConnection(key, account, { fetchImpl: async () => responses.shift() });
    assert.equal(checked.state, 'connected');
    assert.equal(checked.channelId, account.expectedChannelId);
    assert.deepEqual(checked.scopes, ['https://www.googleapis.com/auth/youtube.force-ssl']);
    assert.equal(JSON.stringify(checked).includes('short-lived'), false);
  } finally {
    deleteCredential(key);
  }
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
