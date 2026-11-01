'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), net = require('node:net');
const { pathToFileURL } = require('node:url');
const { readManifest, sha256, judge } = require('./contract.cjs');
const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_VARS = ['SYNK_ACCOUNT_BROWSER_QA_OUT', 'SYNK_CAFE_STATIC_QA_RUN', 'SYNK_DAILY_TUTOR_STATIC_QA_RUN', 'SYNK_HOME_TUTOR_STATIC_RUN', 'SYNK_LIFE_TUTOR_STATIC_RUN', 'SYNK_HOMEWORK_QA_OUT', 'SYNK_CLASSROOM_QA_OUT', 'SYNK_EXAM_LINK_QA_OUT', 'SYNK_PUSH_QA_OUT', 'SYNK_REMINDERS_QA_OUT', 'SYNK_SPEAKING_QA_OUT', 'SYNK_WRITING_QA_OUT', 'SYNK_HOMEWORK_REVIEW_QA_OUT', 'SYNK_TOWN_CHECK_SHOTS'];
function sourceState(root, files) {
  return { commit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
    trackedDiff: sha256(cp.execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: root, windowsHide: true, maxBuffer: 64 << 20 })),
    files: Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.join(root, file)))])) };
}
function childRun(args, { cwd, env, log, timeoutMs = 20 * 60_000 }) {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(log, 'a');
    const child = cp.spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', fd, fd] });
    let timedOut = false, closed = false;
    const close = () => { if (!closed) { closed = true; clearTimeout(timer); fs.closeSync(fd); } };
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.exitCode === null) {
        // Only this live child and its descendants. Never search by command-name substring.
        if (process.platform === 'win32') cp.spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 15_000 });
        else child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.once('error', error => { close(); reject(error); });
    child.once('close', (exitCode, signal) => { close(); resolve({ exitCode, signal, timedOut }); });
  });
}
async function rehearsal(root, env, output) {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const fd = fs.openSync(path.join(output, 'server.log'), 'a');
  const child = cp.spawn(process.execPath, [path.join(root, 'experiences/synk-world-app/server.mjs')], {
    cwd: root, windowsHide: true, stdio: ['ignore', fd, fd], env: { ...env, SYNK_WORLD_MODE: 'rehearsal', SYNK_WORLD_PORT: String(port), SYNK_WORLD_DATA_DIR: path.join(output, 'database') },
  });
  let startupError;
  child.once('error', error => { startupError = error; });
  const exited = new Promise(resolve => child.once('close', resolve));
  async function stop() { if (child.exitCode === null && child.pid) child.kill(); await exited; fs.closeSync(fd); }
  try {
    const url = `http://127.0.0.1:${port}`;
    for (let n = 0; n < 160; n++) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw Error('Owned rehearsal server stopped before readiness');
      let health;
      try { const response = await fetch(url + '/health', { signal: AbortSignal.timeout(500) }); if (response.ok) health = await response.json(); } catch {}
      if (health) {
        if (health.production !== false || health.rehearsal !== true) throw Error('Refusing a non-rehearsal server');
        return { url, stop };
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw Error('Owned rehearsal server readiness timeout');
  } catch (error) { await stop(); throw error; }
}
async function run({ route, output, context, root = ROOT }) {
  if (!['windows', 'linux', 'local', 'all'].includes(route)) throw Error('Choose windows, linux, local, or all');
  if (route === 'windows' && process.platform !== 'win32') throw Error('Windows coverage requires Windows');
  if (['local', 'all'].includes(route) && (!context || context.version !== 1 || path.resolve(context.root) !== path.resolve(root))) throw Error('Local QA requires an explicitly prepared, isolated workspace');
  if (!path.isAbsolute(output) || fs.existsSync(path.join(output, 'result.json'))) throw Error('Use a new absolute output directory');
  fs.mkdirSync(output, { recursive: true });
  const manifest = readManifest(root), cases = manifest.cases.filter(row => route === 'all' || row.route === route);
  if (!cases.length) throw Error('Empty test selection');
  const files = [...new Set(cases.map(row => row.file))];
  const before = sourceState(root, [...files, 'tools/conditional-qa/cases.json']);
  const receipt = { version: 1, commit: before.commit, manifestDigest: manifest.digest, route, startedAt: new Date().toISOString(), platform: process.platform, node: process.version,
    inputDigest: context?.inputDigest || null, candidate: Boolean(context?.candidate), expected: cases.length, passed: 0, ok: false, rows: [], phases: [], sourceBefore: before };
  fs.writeFileSync(path.join(output, 'started.json'), JSON.stringify(receipt, null, 2));
  try {
    for (const profile of ['default', 'homework', 'client']) {
      const selected = cases.filter(row => row.profile === profile);
      if (!selected.length) continue;
      const folder = path.join(output, profile); fs.mkdirSync(folder, { recursive: true });
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      // CI credentials and operating-service switches are not inputs to a test process.
      for (const key of Object.keys(env)) if (/^(?:GH_TOKEN|GITHUB_TOKEN|SYNK_)/.test(key)) delete env[key];
      if (context) {
        delete env.CI;
        Object.assign(env, context.env, { TEMP: path.join(folder, 'temp'), TMP: path.join(folder, 'temp'),
          SYNK_TALK_ROOT: profile === 'homework' ? context.homeworkTalk : context.localTalk });
        fs.mkdirSync(env.TEMP, { recursive: true });
        env.SYNK_BACKUP_KEY_DIR = path.join(folder, 'synthetic-keys-only');
        for (const key of OUTPUT_VARS) env[key] = path.join(folder, key.toLowerCase());
      }
      let server;
      try {
        if (profile === 'client') { server = await rehearsal(root, env, folder); env.SYNK_WORLD_QA_URL = server.url; }
        const escaped = selected.map(row => row.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const args = ['--test', '--test-concurrency=2', '--test-timeout=180000', `--test-name-pattern=^(?:${escaped.join('|')})$`,
          '--test-reporter=tap', `--test-reporter-destination=${path.join(folder, 'tests.tap')}`,
          `--test-reporter=${pathToFileURL(path.join(root, 'tools/conditional-qa/reporter.cjs')).href}`, `--test-reporter-destination=${path.join(folder, 'events.jsonl')}`,
          ...new Set(selected.map(row => row.file))];
        const execution = await childRun(args, { cwd: root, env, log: path.join(folder, 'process.log') });
        const events = fs.readFileSync(path.join(folder, 'events.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
        const result = judge(selected, events, { root, ...execution });
        receipt.phases.push({ profile, ...result }); receipt.rows.push(...result.rows);
        console.log(`${profile}: ${result.passed}/${result.expected}; ${result.ok ? 'PASS' : 'INCOMPLETE OR FAILED'}`);
      } catch (error) { receipt.phases.push({ profile, ok: false, error: error.message }); }
      finally { if (server) await server.stop(); }
    }
    const after = sourceState(root, [...files, 'tools/conditional-qa/cases.json']);
    receipt.sourceUnchanged = JSON.stringify(before) === JSON.stringify(after);
    receipt.passed = receipt.rows.filter(row => row.status === 'pass').length;
    receipt.ok = receipt.sourceUnchanged && receipt.rows.length === cases.length && receipt.passed === cases.length && receipt.phases.every(row => row.ok);
  } finally {
    receipt.endedAt = new Date().toISOString();
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(receipt, null, 2));
  }
  return receipt;
}
if (require.main === module) {
  const args = process.argv.slice(2), value = name => args[args.indexOf(name) + 1];
  run({ route: value('--route'), output: value('--output'), context: args.includes('--context') ? JSON.parse(fs.readFileSync(value('--context'), 'utf8')) : undefined })
    .then(result => { console.log(JSON.stringify({ commit: result.commit, route: result.route, passed: result.passed, expected: result.expected, ok: result.ok })); process.exitCode = result.ok ? 0 : 1; })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { sourceState, childRun, run };
