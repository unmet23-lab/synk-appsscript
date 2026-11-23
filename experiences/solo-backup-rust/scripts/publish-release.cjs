'use strict';
// Publishes one release of SYNK 업무 백업 (STAGE1_DESIGN.md 4.10 「게시 도구」 — 0.7.0 went out by hand on 11-22, these are
// the same steps in their order):
//   node publish-release.cjs <workbackup-clean-windows run id> [--apply] [--work <folder>] [--without-google]
// Without --apply nothing outside this PC changes: it checks the run (that workflow, on master, every job green), downloads
// its build, checks the build receipt, signs the installer on this PC (update-keys.cjs), makes the feed (update-feed.cjs)
// and checks both the way SYNK 솔리오's 「백업」 room does (desktop/src/solio-backup.cjs). It also refuses a version that is
// not newer than the live feed's, and a build without the Google sign-in settings (the receipt's googleClient, which CI sets
// from the WORKBACKUP_GOOGLE_CLIENT secret) unless --without-google says that build is meant to ship without them.
// With --apply it then puts the installer in synk-policy Releases (workbackup-<version>, a prerelease), publishes the
// release and checks the bytes the public address serves. The feed itself goes to synk.im through tools/공개.js with its
// own review; the tool prints those steps. A run again with the same work folder takes up where it stopped: it keeps the
// signature and the feed it made (the feed's bytes are what the review saw) — for the same run, attempt and artifact only.
// One publish at a time per signing key: it holds a lock file inside the key folder while it runs (only this PC signs).
// The feed it compares with is synk-policy main's, not the site's: a site that answers 404 or late is not 「no feed」. It reads
// the feed only to stop early; what keeps the feed's version from going down is tools/공개.js's 「피드 판」 check.
// What it keeps and what it accepts: STAGE1_DESIGN.md 4.10 「게시 도구가 지키는 것과 받아들이는 한계」(11-23 설계 검토).
// Operating rules (4.10): a version in the feed is never taken back — a bad one is covered by a higher version — and a
// published release's installer is never replaced.
const cp = require('node:child_process'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');

const APP = path.resolve(__dirname, '..');
const REPO = path.resolve(APP, '..', '..');
const SOURCE = 'unmet23-lab/SYNK-appsscript', SITE = 'unmet23-lab/synk-policy';
const WORKFLOW = '.github/workflows/workbackup-clean-windows.yml';
const JOBS = ['build', 'install', 'update', 'backup', 'restore'];
const FEED_URL = 'https://synk.im/desktop/releases/workbackup.json';
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
/** SYNK 솔리오's deadline for the whole installer download (solio-backup.cjs). */
const DOWNLOAD_MS = 30 * 60 * 1000;
const setupName = v => `SynkWorkBackup-${v}-setup.exe`;
const releaseTag = v => `workbackup-${v}`;
const releaseUrl = v => `https://github.com/${SITE}/releases/download/${releaseTag(v)}/${setupName(v)}`;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw Error(message); };

function newer(a, b) {
  const x = VERSION.exec(a), y = VERSION.exec(b);
  if (!x || !y) fail(`not a version: ${x ? b : a}`);
  for (let i = 1; i <= 3; i++) if (+x[i] !== +y[i]) return +x[i] > +y[i];
  return false;
}

/** The run must be the clean-Windows workflow's, on master, finished green in every job, at a commit master holds. */
function checkRun(run, jobs, onMaster) {
  if (!run || !String(run.path || '').endsWith(WORKFLOW)) fail(`run ${run?.id} is not ${WORKFLOW}'s`);
  // The weekly scheduled run is master's too (GPT publish-feed GA3); a pull request's is not.
  if (run.head_branch !== 'master' || !['push', 'workflow_dispatch', 'schedule'].includes(run.event)) fail(`run ${run.id} is not a run of master`);
  if (run.status !== 'completed' || run.conclusion !== 'success') fail(`run ${run.id} did not succeed (${run.status} ${run.conclusion})`);
  const by = new Map(jobs.map(j => [j.name, j.conclusion]));
  const off = JOBS.filter(n => by.get(n) !== 'success');
  if (off.length || jobs.length !== JOBS.length) fail(`run ${run.id}: every job must be green (${JOBS.map(n => `${n} ${by.get(n) ?? 'missing'}`).join(', ')})`);
  if (!onMaster) fail(`run ${run.id}'s commit ${run.head_sha} is not on origin/master`);
}

/** The receipt CI wrote beside the installer names this version and this installer's SHA-256, and says the build carries the
 *  Google sign-in settings: without them 「Google로 시작」 cannot work, and a published version cannot be taken back (11-23). */
function checkReceipt(receipt, version, bytes, withoutGoogle = false) {
  if (receipt?.version !== version) fail(`build receipt says ${receipt?.version}, the sources say ${version}`);
  if (receipt.setup !== setupName(version)) fail(`build receipt names ${receipt.setup}`);
  if (receipt.setupSha256 !== sha256(bytes)) fail('the installer is not the one the build receipt names');
  if (receipt.googleClient !== true && !withoutGoogle) fail('this build has no Google sign-in settings (CI secret WORKBACKUP_GOOGLE_CLIENT); pass --without-google only for a build meant to ship without them');
}

/** What the live feed allows: a newer version, or the very same installer again (nothing to do). */
function againstLive(live, version, digest) {
  if (!live) return 'new';
  if (newer(version, live.version)) return 'new';
  if (live.version === version && live.sha256 === digest) return 'same';
  fail(`the live feed has ${live.version}; publish a higher version (a version in the feed is never replaced)`);
}

/** What to do with synk-policy's release: make it, fill a draft, or leave a published one that already holds this file. */
function releasePlan(release, name, size, digest) {
  if (!release) return 'create';
  const asset = release.assets.find(a => a.name === name);
  const same = asset && asset.size === size && asset.digest === `sha256:${digest}`;
  if (release.assets.some(a => a.name !== name)) fail(`release ${release.tagName} holds other files: ${release.assets.map(a => a.name).join(', ')}`);
  if (!release.isDraft) { if (same) return 'published'; fail(`release ${release.tagName} is published with another installer; raise the version`); }
  return same ? 'publish' : 'upload';
}

function defaults() {
  const run = (exe, args) => cp.execFileSync(exe, args, { cwd: REPO, encoding: 'utf8', windowsHide: true, maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return {
    gh: args => run('gh', args),
    git: args => run('git', ['-C', REPO, ...args]),
    fetch: (url, options) => fetch(url, options),
    keys: require('./update-keys.cjs'),
    feeds: require('./update-feed.cjs'),
    solio: require(path.join(REPO, 'desktop', 'src', 'solio-backup.cjs')),
    log: line => console.log(line),
    lockFile: null,
  };
}

/** One publish at a time: a file made only if absent, taken away at the end. One left by a publish that died says so. */
function holdLock(file) {
  let fd;
  try { fd = fs.openSync(file, 'wx'); } catch (error) { if (error.code === 'EEXIST') fail(`another publish holds ${file} (if none is running, delete it)`); throw error; }
  fs.writeSync(fd, String(process.pid));
  return () => { try { fs.closeSync(fd); } finally { fs.rmSync(file, { force: true }); } };
}

/** The feed on synk-policy main — what synk.im serves once Pages has it; none only when main has no such file. */
async function liveFeed(d) {
  let file;
  try { file = JSON.parse(d.gh(['api', `repos/${SITE}/contents/desktop/releases/workbackup.json?ref=main`])); }
  catch (error) { if (/404|not found/i.test(String(error.stderr || error.message))) return null; throw error; }
  const entry = d.solio.validateFeed(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')));
  return { version: entry.version, sha256: entry.sha256 };
}

/** The installer as SYNK 솔리오 downloads it (solio-backup.cjs responseFor): from the release address, following at most
 *  three redirects and only to GitHub's release-assets host and path, with no content encoding (GPT GA4). */
async function publicBytes(d, version) {
  // One deadline for the whole download, as SYNK 솔리오 has (GPT publish-feed GA4). The release is out by then: running this
  // again with the same folder finds it published with this installer and checks the bytes again.
  const ms = d.downloadMs ?? DOWNLOAD_MS, signal = AbortSignal.timeout(ms);
  const within = promise => new Promise((resolve, reject) => {
    const stop = () => reject(Object.assign(new Error(`the public address did not finish within ${Math.round(ms / 60000)} minutes; the release is out — run this again with the same folder to check its bytes`), { late: true }));
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    promise.then(resolve, error => (signal.aborted ? stop() : reject(error)));
  });
  let url = releaseUrl(version);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await within(d.fetch(url, { redirect: 'manual', cache: 'no-store', signal }));
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      let next = null; if (typeof location === 'string' && location) { try { next = new URL(location, url); } catch { next = null; } }
      if (redirects === 3 || !next || next.protocol !== 'https:' || next.username || next.password || next.port
        || next.hostname !== 'release-assets.githubusercontent.com' || !next.pathname.startsWith('/github-production-release-asset/')) fail(`the public address redirects where SYNK 솔리오 does not follow: ${next?.hostname ?? location}`);
      url = next.href; continue;
    }
    if (response.status !== 200) fail(`the public address answered ${response.status}`);
    const encoding = response.headers.get('content-encoding');
    if (encoding && encoding !== 'identity') fail(`the public address encodes the installer (${encoding})`);
    const bytes = Buffer.from(await within(response.arrayBuffer()));
    return { size: bytes.length, sha256: sha256(bytes), host: new URL(url).hostname };
  }
  fail('the public address redirects too often');
}

/** The tag of that name, if synk-policy has one: its commit. */
function tagCommit(d, version) {
  let ref;
  try { ref = JSON.parse(d.gh(['api', `repos/${SITE}/git/ref/tags/${releaseTag(version)}`])); }
  catch (error) { if (/404|not found/i.test(String(error.stderr || error.message))) return null; throw error; }
  if (ref.object?.type === 'commit') return ref.object.sha;
  return JSON.parse(d.gh(['api', `repos/${SITE}/git/tags/${ref.object?.sha}`])).object?.sha ?? fail(`tag ${releaseTag(version)} names no commit`);
}
/** The release's commit must be one synk-policy's main holds (GPT GA5). */
function onSiteMain(d, ref) {
  const status = JSON.parse(d.gh(['api', `repos/${SITE}/compare/main...${encodeURIComponent(ref)}`])).status;
  if (!['behind', 'identical'].includes(status)) fail(`the release points at ${ref}, which synk-policy's main does not hold (${status})`);
}

async function publish(runId, options = {}) {
  const d = { ...defaults(), ...options.deps };
  if (!/^\d{1,20}$/.test(String(runId))) fail('usage: publish-release <run id> [--apply] [--work <folder>] [--without-google]');
  let keys = null;
  if (!d.lockFile) { try { keys = fs.realpathSync.native(d.keys.KEY_DIRECTORY); } catch { fail(`the signing key folder is not on this PC: ${d.keys.KEY_DIRECTORY}`); } }
  // Inside the key folder as it really is, so two spellings of one folder take one lock (11-23 설계 검토 GA4).
  const unlock = holdLock(d.lockFile ?? path.join(keys, 'publish.lock'));
  try { return await publishHeld(runId, options, d); } finally { unlock(); }
}

async function publishHeld(runId, { apply = false, work, withoutGoogle = false }, d) {
  // 1. The run, and the version its commit carries.
  const run = JSON.parse(d.gh(['api', `repos/${SOURCE}/actions/runs/${runId}`]));
  const jobs = JSON.parse(d.gh(['api', `repos/${SOURCE}/actions/runs/${runId}/jobs?per_page=50`])).jobs.map(j => ({ name: j.name, conclusion: j.conclusion }));
  d.git(['fetch', 'origin', 'master', '--quiet']);
  let onMaster = true;
  try { d.git(['merge-base', '--is-ancestor', run.head_sha, 'origin/master']); } catch { onMaster = false; }
  checkRun(run, jobs, onMaster);
  const version = JSON.parse(d.git(['show', `${run.head_sha}:experiences/solo-backup-rust/src-tauri/tauri.conf.json`])).version;
  if (!VERSION.test(version)) fail(`the sources at ${run.head_sha} carry version ${version}`);
  const name = setupName(version);
  // 2. The build: one artifact of this run (a run attempted again has one per attempt — then which is not known), downloaded
  //    once into a folder that says whose it is, so a folder of another run, attempt or artifact is never taken (GPT GA1).
  const builds = () => JSON.parse(d.gh(['api', `repos/${SOURCE}/actions/runs/${runId}/artifacts?per_page=100`])).artifacts.filter(a => a.name === 'workbackup-build' && !a.expired).map(a => a.id);
  const attempt = run.run_attempt ?? 1;
  const folder = path.resolve(work || path.join(REPO, '.tmp', 'workbackup-release', `${version}-${runId}-${attempt}`));
  const setup = path.join(folder, 'build', name), feedFile = path.join(folder, 'feed', 'workbackup.json'), mark = path.join(folder, 'publish.json');
  const receiptFile = path.join(folder, 'build', 'build-receipt.json');
  let had;
  if (fs.existsSync(mark)) {
    // A folder this tool filled: its own run, attempt and commit, whether or not GitHub still keeps the artifact.
    had = JSON.parse(fs.readFileSync(mark, 'utf8'));
    if (had.run !== Number(runId) || had.attempt !== attempt || had.commit !== run.head_sha) fail(`${folder} holds run ${had.run} attempt ${had.attempt}; use a new work folder`);
  } else {
    if (fs.existsSync(folder) && fs.readdirSync(folder).length) fail(`${folder} is not empty and not this tool's; use a new work folder`);
    // One artifact of this run before and after the download, the same one: a new attempt's in between is not taken (GPT -b GA4).
    const before = builds();
    if (before.length !== 1) fail(`run ${runId} has ${before.length} workbackup-build artifacts (kept 3 days; one per attempt)`);
    d.gh(['run', 'download', String(runId), '--repo', SOURCE, '--name', 'workbackup-build', '--dir', path.join(folder, 'build')]);
    const after = builds();
    if (after.length !== 1 || after[0] !== before[0]) fail(`run ${runId}'s artifact changed during the download; use a new work folder`);
    had = { run: Number(runId), attempt, commit: run.head_sha, artifact: before[0], setup: sha256(fs.readFileSync(setup)), receipt: sha256(fs.readFileSync(receiptFile)) };
    fs.writeFileSync(mark, JSON.stringify(had), { flag: 'wx' });
  }
  // The run again: still that attempt, still green — a run attempted again meanwhile is not this folder's (11-23 설계 검토 GA3).
  const sameRun = () => {
    const now = JSON.parse(d.gh(['api', `repos/${SOURCE}/actions/runs/${runId}`]));
    if ((now.run_attempt ?? 1) !== attempt || now.conclusion !== 'success' || now.head_sha !== run.head_sha) fail(`run ${runId} changed (attempt ${now.run_attempt}, ${now.conclusion}); use a new work folder after it is green`);
  };
  sameRun();
  const bytes = fs.readFileSync(setup), digest = sha256(bytes), receipt = fs.readFileSync(receiptFile);
  // The installer and receipt as they came from the run's artifact: one put in the folder since is not signed (GPT
  // publish-feed GA2). A folder from before this check has no digests and is not taken.
  if (had.setup !== digest || had.receipt !== sha256(receipt)) fail(`${folder}'s installer or receipt is not what was downloaded from run ${runId}; use a new work folder`);
  checkReceipt(JSON.parse(receipt.toString('utf8')), version, bytes, withoutGoogle === true);
  // 3. The live feed allows this version, and so does the release as it stands: a version published with another installer
  // gets no second signature (11-23 설계 검토 P2).
  const state = againstLive(await liveFeed(d), version, digest);
  const view = () => JSON.parse(d.gh(['release', 'view', releaseTag(version), '--repo', SITE, '--json', 'tagName,isDraft,assets,targetCommitish']));
  const readRelease = () => { try { return view(); } catch (error) { if (/not found/i.test(String(error.stderr || error.message))) return null; throw error; } };
  releasePlan(readRelease(), name, bytes.length, digest);
  // 4. The signature, made on this PC with the operating key and kept only if the app's keys verify it.
  const sig = `${setup}.sig`;
  let signer;
  if (fs.existsSync(sig)) {
    const found = d.keys.whichKey(setup, fs.readFileSync(sig, 'utf8'));
    signer = found && { key: found.role, version: found.comment?.version, file: found.comment?.file };
  } else signer = d.keys.sign(setup);
  if (!signer?.key || signer.version !== version || (signer.file ?? name) !== name) fail('no key built into the app verifies the signature for this version and file');
  // 5. The feed, made once (its bytes are what the review sees), and checked as SYNK 솔리오 reads it.
  if (!fs.existsSync(feedFile)) {
    const { feed } = d.feeds.feed({ setup, signature: sig, url: releaseUrl(version) });
    fs.mkdirSync(path.dirname(feedFile), { recursive: true });
    fs.writeFileSync(feedFile, JSON.stringify(feed, null, 2) + '\n', { flag: 'wx' });
  }
  const entry = d.solio.validateFeed(JSON.parse(fs.readFileSync(feedFile, 'utf8')));
  const role = d.solio.verifySignature(crypto.createHash('blake2b512').update(bytes).digest(), d.solio.parseSignature(entry.signature), d.solio.ENGINE_KEYS);
  if (entry.version !== version || entry.size !== bytes.length || entry.sha256 !== digest || entry.url !== releaseUrl(version) || !role) fail('the feed does not match the signed installer');
  const report = { version, run: Number(runId), commit: run.head_sha, folder, sha256: digest, size: bytes.length, signedBy: role, live: state };
  if (!apply) { d.log(JSON.stringify({ ...report, applied: false })); return report; }
  // 6. The release: a draft first, filled and checked, then published; a published one is never replaced.
  let release = readRelease();
  const plan = releasePlan(release, name, bytes.length, digest);
  // The commit the release stands on — its tag's, if the tag is there; a draft's target otherwise — is on synk-policy's main
  // (GPT GA5 · -b GA8). A tag without a release would be taken as it is, whatever --target says.
  const tagged = tagCommit(d, version);
  if (tagged) onSiteMain(d, tagged);
  if (release?.isDraft) onSiteMain(d, release.targetCommitish);
  if (plan === 'create') {
    if (tagged) fail(`synk-policy already has a tag ${releaseTag(version)} without a release; look at it first`);
    const target = JSON.parse(d.gh(['api', `repos/${SITE}/commits/main`])).sha;
    d.gh(['release', 'create', releaseTag(version), '--repo', SITE, '--target', target, '--draft', '--prerelease', '--title', `SYNK 업무 백업 ${version}`,
      '--notes', `SYNK 업무 백업 엔진 ${version}입니다. SYNK 솔리오 백업 방이 이 설치 파일을 받아 깝니다. 업데이트 피드: ${FEED_URL}`]);
  }
  if (plan === 'create' || plan === 'upload') d.gh(['release', 'upload', releaseTag(version), setup, '--repo', SITE, '--clobber']);
  if (plan !== 'published') {
    release = view();
    if (!release.isDraft || releasePlan(release, name, bytes.length, digest) !== 'publish') fail('the draft release does not hold this installer');
    onSiteMain(d, release.targetCommitish);
    // The live feed and the run again, just before publishing (GPT GA3 · 11-23 설계 검토 GA3).
    againstLive(await liveFeed(d), version, digest);
    sameRun();
    d.gh(['release', 'edit', releaseTag(version), '--repo', SITE, '--draft=false', '--prerelease', '--latest=false']);
  }
  // 7. What the public address serves.
  const served = await publicBytes(d, version);
  if (served.size !== bytes.length || served.sha256 !== digest) fail('the public address serves other bytes');
  const candidate = path.join(folder, 'publish-candidate');
  // The release is out and its bytes checked; what follows only tells, so a read that fails here does not hide the result
  // or the next steps (GPT -d GA1). The tag's commit says nothing of the installer; one moved off main meanwhile is told,
  // not judged (11-23 설계 검토 GA6).
  const tell = error => d.log(`알림: ${error.message}`);
  try { const tagNow = tagCommit(d, version); if (tagNow) onSiteMain(d, tagNow); } catch (error) { tell(error); }
  let now = null;
  try { now = againstLive(await liveFeed(d), version, digest); } catch (error) { tell(error); }
  d.log(JSON.stringify({ ...report, applied: true, release: plan, served }));
  if (now === 'same') d.log('피드는 이미 이 설치 파일을 가리킨다. 올릴 것이 없다.');
  else d.log([
    '다음은 피드다(공용 작업본에서, 공개 검수를 거쳐). 공개 도구의 「피드 판」 검사가 공개된 판보다 낮거나 같은 판을 막는다:',
    `  node tools/공개.js 올리기 "desktop/releases/workbackup.json=${feedFile}" --후보폴더 "${candidate}"`,
    `  node tools/검수묶음.mjs 준비 <이름> --종류 화면 --바탕 HEAD --저장소 "${REPO}" --배포후보 "${candidate}" → 카본 → 페이블`,
    `  node tools/공개.js 올리기 "desktop/releases/workbackup.json=${feedFile}" -m "<메시지>" --검수 <이름> --실행 --계획 <해시>`,
  ].join('\n'));
  return { ...report, release: plan, served };
}

module.exports = { publish, newer, checkRun, checkReceipt, againstLive, releasePlan, setupName, releaseUrl, JOBS, WORKFLOW };
if (require.main === module) {
  const args = process.argv.slice(2), at = args.indexOf('--work');
  publish(args.find(a => /^\d+$/.test(a)), { apply: args.includes('--apply'), work: at >= 0 ? args[at + 1] : undefined, withoutGoogle: args.includes('--without-google') })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
