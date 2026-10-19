'use strict';
// 업로드 도구의 YouTube 「동영상 언어」(defaultAudioLanguage) 칸(10-19, 제작 방식 v2 §4-3 「언어 및 자막 면제 인증서」).
// 원고.json의 audioLanguage가 계획 항목 → 승인 해시 → 업로드 메타데이터로 이어지고, 이 칸이 없는 묶음은 예전과 같다.

const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

// 발행기는 불러올 때 spawnSync를 잡아 둔다 — 실제 자격 보관소·네트워크에 닿지 않게 먼저 막는다.
mock.method(childProcess, 'spawnSync', () => { throw new Error('자격 보관소를 부르면 안 됩니다'); });
mock.method(globalThis, 'fetch', async () => { throw new Error('실제 네트워크를 부르면 안 됩니다'); });
const {
  REPO_ROOT, DEFAULT_ACCOUNTS, loadAccounts, buildPlan, validateItem, publicationHash, youtubeUpload,
} = require('../tools/lib/sns-publisher.js');

const temporary = [];
afterEach(() => {
  for (const target of temporary.splice(0)) {
    const resolved = path.resolve(target);
    assert.equal(resolved.startsWith(`${path.resolve(REPO_ROOT, 'tmp')}${path.sep}`), true);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

function tempDir() {
  const base = path.join(REPO_ROOT, 'tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'sns-audio-lang-test-'));
  temporary.push(dir);
  return dir;
}

function packageDir(root, id, extra) {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '원고.json'), JSON.stringify({
    id, brand: 'LAB', platform: 'YouTube', format: 'video', title: '시험 제목', caption: '시험 본문', alt: [], ...extra,
  }));
  fs.writeFileSync(path.join(dir, 'video.mp4'), Buffer.alloc(1024, 1));
}

function plannedItems() {
  const root = tempDir();
  packageDir(root, '01-lab-lk-youtube', { language: 'si', audioLanguage: 'ko' });
  packageDir(root, '02-lab-youtube', { language: 'en' });
  const plan = buildPlan({ root, accountsFile: DEFAULT_ACCOUNTS, outputFile: path.join(root, 'plan.json') });
  const byId = Object.fromEntries(plan.items.map((item) => [item.id, item]));
  return { withAudio: byId['01-lab-lk-youtube'], without: byId['02-lab-youtube'] };
}

test('원고.json의 audioLanguage는 YouTube 계획 항목에 실리고, 없으면 칸이 생기지 않는다', () => {
  const { withAudio, without } = plannedItems();
  assert.equal(withAudio.language, 'si');
  assert.equal(withAudio.audioLanguage, 'ko');
  assert.deepEqual(withAudio.errors, []);
  assert.equal('audioLanguage' in without, false);
  assert.deepEqual(without.errors, []);
});

test('동영상 언어는 승인 해시에 묶이고, 칸이 없는 기존 항목의 해시는 그대로다', () => {
  const { withAudio, without } = plannedItems();
  const accounts = loadAccounts(DEFAULT_ACCOUNTS).accounts;
  const lk = accounts['lab-lk-youtube'];
  assert.notEqual(publicationHash(withAudio, lk), publicationHash({ ...withAudio, audioLanguage: 'en' }, lk));
  const lab = accounts['lab-youtube'];
  assert.equal(publicationHash(without, lab), publicationHash({ ...without, audioLanguage: undefined }, lab));
});

test('YouTube 밖 항목이나 언어 코드가 아닌 값은 --준비에서 고칠 것으로 낸다', () => {
  const { withAudio } = plannedItems();
  assert.deepEqual(validateItem({ ...withAudio, audioLanguage: 'korean' }), ['동영상 언어 코드가 아님: korean']);
  assert.deepEqual(validateItem({ ...withAudio, audioLanguage: 'zh-Hant' }), []);
  const telegram = { platform: 'telegram', title: '제목', text: '본문', video: 'video.mp4', images: [], dependencies: [], audioLanguage: 'ko' };
  assert.deepEqual(validateItem(telegram), ['동영상 언어는 YouTube만 지원']);
});

test('업로드 메타데이터에 동영상 언어(defaultAudioLanguage)를 싣고, 없으면 싣지 않는다', async () => {
  const { withAudio, without } = plannedItems();
  const upload = async (item) => {
    const calls = [];
    const responses = [
      new Response(JSON.stringify({ access_token: 'access', scope: 'scope' }), { status: 200 }),
      new Response(JSON.stringify({ items: [{ id: 'channel-1', snippet: { title: 'SYNK LAB' } }] }), { status: 200 }),
      new Response('', { status: 200, headers: { location: 'https://upload.invalid/session' } }),
      new Response(JSON.stringify({ id: 'video-1' }), { status: 201 }),
    ];
    const result = await youtubeUpload({ ...item, thumbnail: null }, { expectedChannelId: 'channel-1', categoryId: '27', madeForKids: false },
      { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' },
      { fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift(); } });
    assert.equal(result.id, 'video-1');
    assert.match(calls[2].url, /upload\/youtube\/v3\/videos\?uploadType=resumable/);
    return JSON.parse(calls[2].options.body).snippet;
  };
  const sent = await upload(withAudio);
  assert.equal(sent.defaultLanguage, 'si');
  assert.equal(sent.defaultAudioLanguage, 'ko');
  const plain = await upload(without);
  assert.equal(plain.defaultLanguage, 'en');
  assert.equal('defaultAudioLanguage' in plain, false);
});
