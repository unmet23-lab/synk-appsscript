import test from 'node:test';
import assert from 'node:assert/strict';

// 표는 모듈 안 객체를 바꾸므로 경우마다 새로 불러온다.
let loads = 0;
const load = () => import(`../src/platform-downloads.mjs?case=${++loads}`);
const hex = c => c.repeat(64);
const feed = (version, overrides = {}) => ({
  schemaVersion: 1, product: 'platform', channel: 'preview', version, releaseId: `platform-preview-${version}`, buildId: '20261014.9', publishedAt: '2026-10-14T05:00:00.000Z', sourceHash: hex('0'),
  artifacts: [['win32', 'x64', 'win-x64.exe', 402704384, 'a'], ['darwin', 'arm64', 'mac-arm64.dmg', 461999512, 'b'], ['darwin', 'x64', 'mac-x64.dmg', 479680541, 'c']].map(([platform, arch, suffix, bytes, c]) => ({
    platform, arch, url: `https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-${version}/SYNK-Platform-Preview-${version}-Signal-${suffix}`, bytes, sha256: hex(c), asarSHA256: hex('d') })),
  ...overrides,
});
const fetcherFor = (body, { ok = true, calls = [] } = {}) => async (url, options) => { calls.push([url, options]);return { ok, json: async () => (typeof body === 'function' ? body() : body) }; };

test('a newer release in the shared feed replaces every file, link and install step', async () => {
  const m = await load(), calls = [];
  assert.equal(await m.refreshPlatformDownloads(fetcherFor(feed('0.4.9'), { calls })), true);
  assert.equal(calls[0][0], '/desktop/releases/preview.json');
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].credentials, 'omit');
  assert.equal(m.PLATFORM_DOWNLOADS.version, '0.4.9');
  assert.equal(m.downloadHref('windows'), 'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.9/SYNK-Platform-Preview-0.4.9-Signal-win-x64.exe');
  assert.equal(m.downloadHref('mac-x64'), 'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.9/SYNK-Platform-Preview-0.4.9-Signal-mac-x64.dmg');
  assert.equal(m.checksumHref('mac-arm64'), 'https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.9');
  assert.equal(m.PLATFORM_DOWNLOADS['mac-arm64'].bytes, 461999512);
  assert.equal(m.PLATFORM_DOWNLOADS.windows.label, 'Windows용 다운로드');
  assert.match(m.DOWNLOAD_STEPS.windows[0][1], /SYNK-Platform-Preview-0\.4\.9-Signal-win-x64\.exe를 열어요/);
  assert.match(m.DOWNLOAD_STEPS.mac[0][1], /SYNK-Platform-Preview-0\.4\.9 DMG를 열어요/);
});

test('the fallback table is the published release the feed named when it was written', async () => {
  const m = await load(), fallback = structuredClone(m.PLATFORM_DOWNLOADS);
  assert.equal(await m.refreshPlatformDownloads(fetcherFor(feed(fallback.version))), false);
  assert.deepEqual(m.PLATFORM_DOWNLOADS, fallback);
  for (const os of m.DOWNLOAD_OS) assert.match(m.downloadHref(os), new RegExp(`/platform-preview-${fallback.version.replaceAll('.', '\\.')}/SYNK-Platform-Preview-${fallback.version.replaceAll('.', '\\.')}-`));
});

test('an unreadable or doubtful feed keeps the table as it is', async () => {
  const doubtful = {
    'http error': [feed('0.4.9'), { ok: false }],
    'not json': [() => { throw new SyntaxError('bad'); }],
    'other product': [feed('0.4.9', { product: 'world' })],
    'release id': [feed('0.4.9', { releaseId: 'platform-preview-0.4.8' })],
    'version shape': [feed('0.4.9-beta', { releaseId: 'platform-preview-0.4.9-beta' })],
    'missing system': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.slice(0, 2) }],
    'duplicate system': [{ ...feed('0.4.9'), artifacts: [...feed('0.4.9').artifacts.slice(0, 2), feed('0.4.9').artifacts[1]] }],
    'other host': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.map((a, i) => i ? a : { ...a, url: a.url.replace('https://github.com', 'https://example.com') }) }],
    'other repository': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.map((a, i) => i ? a : { ...a, url: a.url.replace('/unmet23-lab/synk-policy/', '/someone/synk-policy/') }) }],
    'query string': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.map((a, i) => i ? a : { ...a, url: a.url + '?x=1' }) }],
    'wrong extension': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.map((a, i) => i ? a : { ...a, url: a.url.replace('.exe', '.dmg') }) }],
    'zero bytes': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.map((a, i) => i ? a : { ...a, bytes: 0 }) }],
    'bad sha256': [{ ...feed('0.4.9'), artifacts: feed('0.4.9').artifacts.map((a, i) => i ? a : { ...a, sha256: 'x' }) }],
  };
  for (const [name, [body, options]] of Object.entries(doubtful)) {
    const m = await load(), before = structuredClone(m.PLATFORM_DOWNLOADS);
    assert.equal(await m.refreshPlatformDownloads(fetcherFor(body, options)), false, name);
    assert.deepEqual(m.PLATFORM_DOWNLOADS, before, name);
  }
  const m = await load(), before = structuredClone(m.PLATFORM_DOWNLOADS);
  assert.equal(await m.refreshPlatformDownloads(async () => { throw new TypeError('offline'); }), false);
  assert.equal(await m.refreshPlatformDownloads(undefined), false);
  assert.deepEqual(m.PLATFORM_DOWNLOADS, before);
});
