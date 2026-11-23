'use strict';
// The release publisher (scripts/publish-release.cjs, STAGE1_DESIGN.md 4.10 「게시 도구」): its rules, and its steps in order
// with GitHub, git, the network and the signing key stood in for. The feed is made by the real update-feed.cjs.
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const P = require('../scripts/publish-release.cjs');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const good = { id: 7, path: P.WORKFLOW, head_branch: 'master', event: 'push', status: 'completed', conclusion: 'success', head_sha: 'abc123' };
const green = P.JOBS.map(name => ({ name, conclusion: 'success' }));

test('only a green run of the clean-Windows workflow on master, every job included, at a commit master holds', () => {
  assert.doesNotThrow(() => P.checkRun(good, green, true));
  assert.doesNotThrow(() => P.checkRun({ ...good, event: 'workflow_dispatch' }, green, true));
  assert.doesNotThrow(() => P.checkRun({ ...good, event: 'schedule' }, green, true), 'the weekly scheduled run of master');
  assert.throws(() => P.checkRun({ ...good, path: '.github/workflows/wide-tests.yml' }, green, true), /not .*workbackup-clean-windows/);
  assert.throws(() => P.checkRun({ ...good, head_branch: 'claude/x' }, green, true), /not a run of master/);
  assert.throws(() => P.checkRun({ ...good, event: 'pull_request' }, green, true), /not a run of master/);
  assert.throws(() => P.checkRun({ ...good, conclusion: 'failure' }, green, true), /did not succeed/);
  assert.throws(() => P.checkRun({ ...good, status: 'in_progress', conclusion: null }, green, true), /did not succeed/);
  assert.throws(() => P.checkRun(good, green.map(j => j.name === 'update' ? { ...j, conclusion: 'skipped' } : j), true), /update skipped/);
  assert.throws(() => P.checkRun(good, green.slice(1), true), /build missing/);
  assert.throws(() => P.checkRun(good, [...green, { name: 'extra', conclusion: 'success' }], true), /every job/);
  assert.throws(() => P.checkRun(good, green, false), /not on origin\/master/);
});

test('the build receipt must name this version, this installer and its SHA-256', () => {
  const bytes = Buffer.from('MZ installer');
  const receipt = { version: '0.7.1', setup: 'SynkWorkBackup-0.7.1-setup.exe', setupSha256: sha(bytes), googleClient: true };
  assert.doesNotThrow(() => P.checkReceipt(receipt, '0.7.1', bytes));
  assert.throws(() => P.checkReceipt({ ...receipt, version: '0.7.0' }, '0.7.1', bytes), /receipt says 0.7.0/);
  assert.throws(() => P.checkReceipt({ ...receipt, setup: 'other.exe' }, '0.7.1', bytes), /names other.exe/);
  assert.throws(() => P.checkReceipt(receipt, '0.7.1', Buffer.from('MZ other')), /not the one/);
});

test('a build without the Google sign-in settings is refused unless --without-google says so', async (t) => {
  const bytes = Buffer.from('MZ installer');
  const receipt = { version: '0.7.1', setup: 'SynkWorkBackup-0.7.1-setup.exe', setupSha256: sha(bytes) };
  // The 0.7.0 receipts have no googleClient field, and a false or a string is not a yes.
  for (const value of [undefined, false, 'true', 1]) {
    assert.throws(() => P.checkReceipt({ ...receipt, googleClient: value }, '0.7.1', bytes), /no Google sign-in settings/, String(value));
    assert.doesNotThrow(() => P.checkReceipt({ ...receipt, googleClient: value }, '0.7.1', bytes, true));
  }
  // Through publish: nothing is signed for such a build, and the same folder goes on with --without-google.
  const w = world(t, { google: false });
  await assert.rejects(P.publish('7', { work: w.work, deps: w.deps }), /no Google sign-in settings/);
  assert.ok(!fs.existsSync(path.join(w.work, 'build', `${w.name}.sig`)), 'not signed');
  const r = await P.publish('7', { work: w.work, deps: w.deps, withoutGoogle: true });
  assert.equal(r.version, '0.7.1'); assert.equal(r.live, 'new');
  assert.ok(fs.existsSync(path.join(w.work, 'build', `${w.name}.sig`)), 'signed where the refused run would have signed');
});

test('the live feed allows only a newer version, or the very same installer again', () => {
  assert.equal(P.againstLive(null, '0.7.0', 'a'), 'new');
  assert.equal(P.againstLive({ version: '0.7.0', sha256: 'a' }, '0.7.1', 'b'), 'new');
  assert.equal(P.againstLive({ version: '0.7.9', sha256: 'a' }, '0.7.10', 'b'), 'new', 'numbers, not letters');
  assert.equal(P.againstLive({ version: '0.7.1', sha256: 'b' }, '0.7.1', 'b'), 'same');
  assert.throws(() => P.againstLive({ version: '0.7.1', sha256: 'a' }, '0.7.1', 'b'), /never replaced/);
  assert.throws(() => P.againstLive({ version: '0.8.0', sha256: 'a' }, '0.7.1', 'b'), /higher version/);
});

test('a release is made, a draft filled, a published one only kept when it already holds this installer', () => {
  const name = 'SynkWorkBackup-0.7.1-setup.exe', asset = { name, size: 10, digest: 'sha256:aa' };
  assert.equal(P.releasePlan(null, name, 10, 'aa'), 'create');
  assert.equal(P.releasePlan({ tagName: 't', isDraft: true, assets: [] }, name, 10, 'aa'), 'upload');
  assert.equal(P.releasePlan({ tagName: 't', isDraft: true, assets: [{ ...asset, digest: 'sha256:bb' }] }, name, 10, 'aa'), 'upload');
  assert.equal(P.releasePlan({ tagName: 't', isDraft: true, assets: [asset] }, name, 10, 'aa'), 'publish');
  assert.equal(P.releasePlan({ tagName: 't', isDraft: false, assets: [asset] }, name, 10, 'aa'), 'published');
  assert.throws(() => P.releasePlan({ tagName: 't', isDraft: false, assets: [{ ...asset, size: 11 }] }, name, 10, 'aa'), /raise the version/);
  assert.throws(() => P.releasePlan({ tagName: 't', isDraft: true, assets: [asset, { name: 'x.sig', size: 1, digest: 'sha256:cc' }] }, name, 10, 'aa'), /other files/);
});

// A minisign-shaped signature naming this version and file (update.test.cjs's helper); no key verifies it, so the
// keys and SYNK 솔리오's signature check are stood in for.
function signature(version, file) {
  const comment = ['timestamp:1794788230', `file:${file}`, `version:${version}`].join('\t');
  const raw = Buffer.concat([Buffer.from('ED'), Buffer.alloc(72, 7)]).toString('base64'), global = Buffer.alloc(64, 9).toString('base64');
  return Buffer.from(`untrusted comment: signature from tauri secret key\n${raw}\ntrusted comment: ${comment}\n${global}\n`).toString('base64');
}

const ASSET = 'https://release-assets.githubusercontent.com/github-production-release-asset/1/x';
const headers = values => ({ get: key => values[key.toLowerCase()] ?? null });

function world(t, { live = null, release = null, served = null, version = '0.7.1', redirect = ASSET, tag = false, onMain = 'identical', tagOnMain = 'identical', builds = 1, attempt = 1, secondNoLocation = false, google = true } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-publish-')); t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const folder = path.join(work, 'release');
  const name = P.setupName(version), bytes = Buffer.from(`MZ installer ${version}`);
  const calls = [], logs = [];
  const state = { release, live };
  const solio = require('../../../desktop/src/solio-backup.cjs');
  const blake = crypto.createHash('blake2b512').update(bytes).digest();
  const deps = {
    lockFile: path.join(work, 'publish.lock'),
    log: line => logs.push(line),
    git: args => {
      calls.push(['git', ...args]);
      if (args[0] === 'show') return JSON.stringify({ version });
      return '';
    },
    gh: args => {
      calls.push(['gh', ...args]);
      if (args[0] === 'api' && args[1].includes('/contents/desktop/releases/workbackup.json')) {
        if (!state.live) throw Object.assign(Error('gh: Not Found (HTTP 404)'), { stderr: 'HTTP 404' });
        return JSON.stringify({ content: Buffer.from(JSON.stringify(state.live)).toString('base64') });
      }
      if (args[0] === 'api' && args[1].endsWith('/jobs?per_page=50')) return JSON.stringify({ jobs: green });
      if (args[0] === 'api' && args[1].includes('/artifacts?per_page=100')) return JSON.stringify({ artifacts: Array.from({ length: builds }, (_, i) => ({ id: 90 + i, name: 'workbackup-build', expired: false })).concat([{ id: 5, name: 'workbackup-carry', expired: false }]) });
      if (args[0] === 'api' && args[1].includes('/actions/runs/')) return JSON.stringify({ ...good, run_attempt: attempt });
      if (args[0] === 'api' && args[1].endsWith('/commits/main')) return JSON.stringify({ sha: 'site-main' });
      if (args[0] === 'api' && args[1].includes('/git/ref/tags/')) { if (tag) return JSON.stringify({ ref: 'refs/tags/x', object: { type: 'commit', sha: 'tagsha' } }); throw Object.assign(Error('gh: Not Found (HTTP 404)'), { stderr: 'HTTP 404' }); }
      if (args[0] === 'api' && args[1].includes('/compare/main...')) return JSON.stringify({ status: args[1].endsWith('...tagsha') ? tagOnMain : onMain });
      if (args[0] === 'run' && args[1] === 'download') {
        const dir = args[args.indexOf('--dir') + 1]; fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name), bytes);
        fs.writeFileSync(path.join(dir, 'build-receipt.json'), JSON.stringify({ version, setup: name, setupSha256: sha(bytes), ...(google ? { googleClient: true } : {}) }));
        return '';
      }
      if (args[0] === 'release' && args[1] === 'view') { if (!state.release) throw Object.assign(Error('release not found'), { stderr: 'release not found' }); return JSON.stringify(state.release); }
      if (args[0] === 'release' && args[1] === 'create') { state.release = { tagName: args[2], isDraft: true, assets: [], targetCommitish: args[args.indexOf('--target') + 1] }; return ''; }
      if (args[0] === 'release' && args[1] === 'upload') {
        const file = fs.readFileSync(args[3]);
        state.release.assets = [{ name: path.basename(args[3]), size: file.length, digest: `sha256:${sha(file)}` }]; return '';
      }
      if (args[0] === 'release' && args[1] === 'edit') { state.release.isDraft = false; return ''; }
      throw Error(`unexpected gh ${args.join(' ')}`);
    },
    fetch: async (url, options) => {
      calls.push(['fetch', url.replace(/\?probe=.*/, '?probe')]);
      assert.equal(options.redirect, 'manual', 'redirects are followed by hand, as SYNK 솔리오 does');
      if (url === P.releaseUrl(version)) return { status: 302, headers: headers(redirect === null ? {} : { location: redirect }) };
      if (url === ASSET && secondNoLocation) return { status: 302, headers: headers({}) };
      return { status: 200, headers: headers({}), arrayBuffer: async () => served ?? bytes };
    },
    keys: {
      sign: setup => { fs.writeFileSync(`${setup}.sig`, signature(version, name)); return { out: `${setup}.sig`, version, key: 'operating', id: 'a906d76e18dc50e4' }; },
      whichKey: (setup, text) => text === signature(version, name) ? { role: 'operating', id: 'a906d76e18dc50e4', comment: { version, file: name } } : null,
    },
    // Stands in for the key check alone: it verifies only the BLAKE2b of this installer (GPT GA6).
    solio: { ...solio, verifySignature: (digest) => Buffer.compare(digest, blake) === 0 ? 'operating' : null },
  };
  return { work: folder, name, bytes, calls, logs, state, deps };
}

test('without --apply: the run, the build, the signature and the feed — nothing outside this PC changes', async (t) => {
  const w = world(t);
  const r = await P.publish('7', { work: w.work, deps: w.deps });
  assert.equal(r.version, '0.7.1'); assert.equal(r.live, 'new'); assert.equal(r.sha256, sha(w.bytes));
  const feed = JSON.parse(fs.readFileSync(path.join(w.work, 'feed', 'workbackup.json'), 'utf8'));
  assert.equal(feed.platforms['windows-x86_64-nsis'].url, P.releaseUrl('0.7.1'));
  assert.equal(feed.platforms['windows-x86_64-nsis'].sha256, sha(w.bytes));
  assert.deepEqual(w.calls.filter(c => c[0] === 'gh' && c[1] === 'release').map(c => c[2]), ['view'], 'the release is only read');
  assert.ok(!fs.existsSync(w.deps.lockFile), 'the lock goes at the end');
  // A second run keeps the signature and the feed it made — the feed's bytes are what the review saw.
  const before = fs.readFileSync(path.join(w.work, 'feed', 'workbackup.json'));
  await P.publish('7', { work: w.work, deps: { ...w.deps, keys: { ...w.deps.keys, sign: () => assert.fail('signed again') } } });
  assert.deepEqual(fs.readFileSync(path.join(w.work, 'feed', 'workbackup.json')), before);
});

test('--apply: a draft release, filled and checked, published, then the public bytes checked the way SYNK 솔리오 downloads', async (t) => {
  const w = world(t);
  const r = await P.publish('7', { apply: true, work: w.work, deps: w.deps });
  assert.equal(r.release, 'create'); assert.equal(r.served.sha256, sha(w.bytes)); assert.equal(r.served.host, 'release-assets.githubusercontent.com');
  const steps = w.calls.filter(c => c[0] === 'gh' && c[1] === 'release').map(c => c[2]);
  assert.deepEqual(steps, ['view', 'view', 'create', 'upload', 'view', 'edit'], 'read before signing, again before making it');
  const create = w.calls.find(c => c[2] === 'create');
  for (const flag of ['--draft', '--prerelease']) assert.ok(create.includes(flag), flag);
  assert.equal(create[create.indexOf('--target') + 1], 'site-main');
  assert.ok(w.calls.find(c => c[2] === 'edit').includes('--latest=false'));
  assert.match(w.logs.at(-1), /tools\/공개\.js 올리기/);
  assert.equal(w.state.release.isDraft, false);
});

test('--apply refuses other public bytes, a redirect SYNK 솔리오 would not follow, and a published release with another installer', async (t) => {
  const w1 = world(t, { served: Buffer.from('MZ something else') });
  await assert.rejects(P.publish('7', { apply: true, work: w1.work, deps: w1.deps }), /other bytes/);
  for (const redirect of ['https://objects.githubusercontent.com/github-production-release-asset/1/x', 'https://release-assets.githubusercontent.com/x', 'http://release-assets.githubusercontent.com/github-production-release-asset/1/x', null]) {
    const w = world(t, { redirect });
    await assert.rejects(P.publish('7', { apply: true, work: w.work, deps: w.deps }), /does not follow/, redirect);
  }
  // An allowed asset address that answers 302 with no Location (11-23 설계 검토 GA2).
  const w0 = world(t, { secondNoLocation: true });
  await assert.rejects(P.publish('7', { apply: true, work: w0.work, deps: w0.deps }), /does not follow/);
  const w2 = world(t, { release: { tagName: 'workbackup-0.7.1', isDraft: false, targetCommitish: 'main', assets: [{ name: 'SynkWorkBackup-0.7.1-setup.exe', size: 1, digest: 'sha256:00' }] } });
  await assert.rejects(P.publish('7', { apply: true, work: w2.work, deps: w2.deps }), /raise the version/);
  assert.ok(!w2.calls.some(c => c[2] === 'upload' || c[2] === 'edit'), 'a published release is left as it is');
});

test('--apply refuses a release or tag that does not stand on synk-policy main', async (t) => {
  const w1 = world(t, { tag: true });
  await assert.rejects(P.publish('7', { apply: true, work: w1.work, deps: w1.deps }), /tag workbackup-0.7.1 without a release/);
  assert.ok(!w1.calls.some(c => c[2] === 'create'), 'no release made over a stray tag');
  const w2 = world(t, { onMain: 'diverged', release: { tagName: 'workbackup-0.7.1', isDraft: true, targetCommitish: 'other-branch', assets: [] } });
  await assert.rejects(P.publish('7', { apply: true, work: w2.work, deps: w2.deps }), /does not hold/);
  assert.ok(!w2.calls.some(c => c[2] === 'upload' || c[2] === 'edit'));
  // A draft aimed at main whose tag of that name is a commit main does not hold (GPT -b GA8).
  const w3 = world(t, { tag: true, tagOnMain: 'diverged', release: { tagName: 'workbackup-0.7.1', isDraft: true, targetCommitish: 'main', assets: [] } });
  await assert.rejects(P.publish('7', { apply: true, work: w3.work, deps: w3.deps }), /points at tagsha/);
  assert.ok(!w3.calls.some(c => c[2] === 'upload' || c[2] === 'edit'));
});

test('a version published with another installer is not signed again, even without --apply', async (t) => {
  const w = world(t, { release: { tagName: 'workbackup-0.7.1', isDraft: false, targetCommitish: 'main', assets: [{ name: 'SynkWorkBackup-0.7.1-setup.exe', size: 1, digest: 'sha256:00' }] } });
  let signed = false;
  await assert.rejects(P.publish('7', { work: w.work, deps: { ...w.deps, keys: { ...w.deps.keys, sign: () => { signed = true; } } } }), /published with another installer/);
  assert.equal(signed, false);
});

test('once the release is out, a read that fails after it still prints the result and the next steps', async (t) => {
  const w = world(t), logs = [];
  const flaky = { ...w.deps, log: line => logs.push(line), gh: args => {
    if (args[0] === 'api' && (args[1].includes('/git/ref/tags/') || args[1].includes('/contents/desktop/releases/workbackup.json')) && w.calls.some(c => c[2] === 'edit')) throw Object.assign(Error('gh: HTTP 502'), { stderr: 'HTTP 502' });
    return w.deps.gh(args);
  } };
  const result = await P.publish('7', { apply: true, work: w.work, deps: flaky });
  assert.equal(result.release, 'create');
  assert.equal(logs.filter(l => l.startsWith('알림: ')).length, 2, 'the tag read and the feed read are each told');
  assert.ok(logs.some(l => l.includes('"applied":true')) && logs.some(l => l.includes('tools/공개.js 올리기')));
});

test('the live feed is read before signing and again just before publishing', async (t) => {
  const other = { version: '0.7.1', sha256: '0'.repeat(64) };
  // An equal version with another installer stops before anything is signed.
  const w = world(t);
  const live = { ...w.deps, solio: { ...w.deps.solio, validateFeed: () => other } };
  w.state.live = {};
  let signed = false;
  await assert.rejects(P.publish('7', { work: w.work, deps: { ...live, keys: { ...live.keys, sign: () => { signed = true; } } } }), /never replaced/);
  assert.equal(signed, false);
  // A higher version that went out while the draft was filled stops the publishing (GPT GA3).
  const w2 = world(t);
  const later = { ...w2.deps, solio: { ...w2.deps.solio, validateFeed: value => value.late ? { version: '0.7.2', sha256: 'f'.repeat(64) } : w2.deps.solio.validateFeed(value) } };
  const ghLive = later.gh;
  later.gh = args => {
    if (args[0] === 'api' && args[1].includes('/contents/desktop/releases/workbackup.json') && w2.calls.some(c => c[2] === 'upload')) return JSON.stringify({ content: Buffer.from(JSON.stringify({ late: true })).toString('base64') });
    return ghLive(args);
  };
  await assert.rejects(P.publish('7', { apply: true, work: w2.work, deps: later }), /higher version/);
  assert.ok(!w2.calls.some(c => c[2] === 'edit'), 'the draft stays a draft');
});

test('one publish at a time, and a work folder serves only its own run, attempt and artifact', async (t) => {
  const w = world(t);
  fs.writeFileSync(w.deps.lockFile, '1');
  await assert.rejects(P.publish('7', { work: w.work, deps: w.deps }), /another publish holds/);
  fs.rmSync(w.deps.lockFile);
  await P.publish('7', { work: w.work, deps: w.deps });
  // The same folder for another attempt of the same run is refused (GPT GA1); the folder alone serves once GitHub no longer
  // keeps the artifact (GPT -b GA2).
  const again = { ...w.deps, gh: args => (args[0] === 'api' && /\/actions\/runs\/\d+$/.test(args[1])) ? JSON.stringify({ ...good, run_attempt: 2 }) : w.deps.gh(args) };
  await assert.rejects(P.publish('7', { work: w.work, deps: again }), /holds run 7 attempt 1/);
  const expired = { ...w.deps, gh: args => (args[0] === 'api' && args[1].includes('/artifacts?per_page=100')) ? JSON.stringify({ artifacts: [] }) : w.deps.gh(args) };
  await P.publish('7', { work: w.work, deps: expired });
  // An artifact that changes during the download is not taken (GPT -b GA4).
  const w4 = world(t); let lists = 0;
  const swapped = { ...w4.deps, gh: args => (args[0] === 'api' && args[1].includes('/artifacts?per_page=100')) ? JSON.stringify({ artifacts: [{ id: ++lists === 1 ? 90 : 91, name: 'workbackup-build', expired: false }] }) : w4.deps.gh(args) };
  await assert.rejects(P.publish('7', { work: w4.work, deps: swapped }), /changed during the download/);
  // A folder that is not the tool's, and a run with two builds, are refused too.
  const stray = path.join(path.dirname(w.work), 'stray'); fs.mkdirSync(stray); fs.writeFileSync(path.join(stray, 'x'), '');
  await assert.rejects(P.publish('7', { work: stray, deps: w.deps }), /not empty/);
  const two = world(t, { builds: 2 });
  await assert.rejects(P.publish('7', { work: two.work, deps: two.deps }), /2 workbackup-build artifacts/);
});

test('a run attempted again meanwhile stops the publishing', async (t) => {
  const w = world(t); let reads = 0;
  const moved = { ...w.deps, gh: args => (args[0] === 'api' && /\/actions\/runs\/\d+$/.test(args[1])) ? JSON.stringify({ ...good, run_attempt: ++reads > 2 ? 2 : 1 }) : w.deps.gh(args) };
  await assert.rejects(P.publish('7', { apply: true, work: w.work, deps: moved }), /run 7 changed/);
  assert.ok(!w.calls.some(c => c[2] === 'edit'), 'the draft stays a draft');
});

test('the folder\'s installer and receipt must be the ones downloaded from the run', async (t) => {
  const w = world(t);
  await P.publish('7', { work: w.work, deps: w.deps });
  // Another installer of the same version, with a receipt that names it, put in the folder afterwards (GPT publish-feed GA2).
  const other = Buffer.from('MZ another 0.7.1');
  fs.writeFileSync(path.join(w.work, 'build', w.name), other);
  fs.writeFileSync(path.join(w.work, 'build', 'build-receipt.json'), JSON.stringify({ version: '0.7.1', setup: w.name, setupSha256: sha(other), googleClient: true }));
  await assert.rejects(P.publish('7', { apply: true, work: w.work, deps: w.deps }), /not what was downloaded/);
  assert.ok(!w.calls.some(c => c[2] === 'create' || c[2] === 'upload'));
  // A folder marked before the digests were kept is not taken either.
  const mark = path.join(w.work, 'publish.json'), old = JSON.parse(fs.readFileSync(mark, 'utf8'));
  delete old.setup; delete old.receipt; fs.writeFileSync(mark, JSON.stringify(old));
  fs.writeFileSync(path.join(w.work, 'build', w.name), w.bytes);
  await assert.rejects(P.publish('7', { work: w.work, deps: w.deps }), /not what was downloaded/);
});

test('the public bytes have one deadline, and a run past it says the release is out', async (t) => {
  const w = world(t);
  // Each answer and the body come 40 ms late — every step within 50 ms, the whole past it: only one deadline for the whole
  // download stops it (GPT publish-feed -b GA1).
  const late = value => new Promise(resolve => setTimeout(() => resolve(value), 40));
  const slow = { ...w.deps, downloadMs: 50, fetch: async (url, options) => {
    const answer = await late(await w.deps.fetch(url, options));
    return answer.status === 200 ? { ...answer, arrayBuffer: async () => late(await answer.arrayBuffer()) } : answer;
  } };
  await assert.rejects(P.publish('7', { apply: true, work: w.work, deps: slow }), /did not finish within .* the release is out/);
  assert.ok(w.calls.some(c => c[2] === 'edit'), 'published before the bytes were checked');
  // Run again with the same folder: published with this installer, the bytes checked.
  const again = await P.publish('7', { apply: true, work: w.work, deps: w.deps });
  assert.equal(again.release, 'published');
});

test('a run that is not green, or not on master, stops before anything is downloaded', async (t) => {
  const w = world(t);
  const red = { ...w.deps, gh: args => (args[0] === 'api' && args[1].endsWith('/jobs?per_page=50')) ? JSON.stringify({ jobs: green.map(j => j.name === 'restore' ? { ...j, conclusion: 'failure' } : j) }) : w.deps.gh(args) };
  await assert.rejects(P.publish('7', { work: w.work, deps: red }), /restore failure/);
  assert.ok(!fs.existsSync(path.join(w.work, 'build')), 'nothing downloaded');
  const w2 = world(t);
  const off = { ...w2.deps, git: args => { if (args[0] === 'merge-base') throw Error('not an ancestor'); return w2.deps.git(args); } };
  await assert.rejects(P.publish('7', { work: w2.work, deps: off }), /not on origin\/master/);
  await assert.rejects(P.publish('not-a-number', { work: w2.work, deps: w2.deps }), /usage/);
});

test('the feed is checked against this installer\'s own BLAKE2b, not any signature', async (t) => {
  const w = world(t);
  const wrong = { ...w.deps, solio: { ...w.deps.solio, verifySignature: () => null } };
  await assert.rejects(P.publish('7', { work: w.work, deps: wrong }), /does not match the signed installer/);
});
