const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/wide-tests.yml'), 'utf8').replace(/\r\n/g, '\n');
const step = workflow.match(/      - name: install dependencies\n([\s\S]*?)(?=      # 형제 저장소)/)?.[1];
assert.ok(step, 'dependency install step must exist');
const script = step.match(/        run: \|\n([\s\S]*)/)[1].split('\n').map(line => line.slice(10)).join('\n');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const posix = p => process.platform === 'win32' ? p.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase()) : p;

function run(t, { missing = [], updateExit = 0, updateFailures = 0, timeoutFailures = 0, probeExit = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-wide-deps-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin'), log = path.join(root, 'calls');
  fs.mkdirSync(bin); fs.mkdirSync(path.join(root, 'experiences/synk-account'), { recursive: true });
  const executable = (name, text) => fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n' + text, { mode: 0o755 });
  executable('npm', 'exit 0\n');
  executable('timeout', `printf '%s\\n' "timeout $*" >> "$CALLS"
n=0; if [ -f "$TIMEOUT_COUNT" ]; then read -r n < "$TIMEOUT_COUNT"; fi
n=$((n+1)); printf '%s\\n' "$n" > "$TIMEOUT_COUNT"
if [ "$n" -le "$TIMEOUT_FAILURES" ]; then exit 124; fi
shift; shift; exec "$@"
`);
  for (const name of ['ffmpeg', 'ffprobe']) if (!missing.includes(name)) {
    executable(name, `printf '%s\\n' '${name} version' >> "$CALLS"\nexit ${name === 'ffprobe' ? probeExit : 0}\n`);
  }
  executable('sudo', `printf '%s\\n' "$*" >> "$CALLS"
case "$*" in
  *update*)
    n=0; if [ -f "$UPDATE_COUNT" ]; then read -r n < "$UPDATE_COUNT"; fi
    n=$((n+1)); printf '%s\\n' "$n" > "$UPDATE_COUNT"
    if [ "$n" -le "$UPDATE_FAILURES" ]; then exit 23; fi
    exit "$UPDATE_EXIT";;
  *install*)
    for name in ffmpeg ffprobe; do
      printf '#!/bin/sh\\nprintf "%%s\\n" "%s version" >> "$CALLS"\\nexit 0\\n' "$name" > "$FIXTURE_BIN/$name"
      /bin/chmod +x "$FIXTURE_BIN/$name"
    done;;
  *) exit 99;;
esac
`);
  const result = spawnSync(bash, ['-e', '-c', 'export PATH="$FIXTURE_BIN"\n'+script], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PATH: posix(bin), RUNNER_TEMP: posix(root), BUNDLE: 'experiences', CALLS: posix(log), FIXTURE_BIN: posix(bin), UPDATE_EXIT: String(updateExit), UPDATE_FAILURES: String(updateFailures), UPDATE_COUNT: posix(path.join(root,'update-count')), TIMEOUT_FAILURES: String(timeoutFailures), TIMEOUT_COUNT: posix(path.join(root,'timeout-count')) },
  });
  assert.equal(result.error, undefined, result.error?.message);
  const sources = path.join(root, 'synk-media-ubuntu.list');
  return { ...result, sources: fs.existsSync(sources) ? fs.readFileSync(sources, 'utf8') : null, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [] };
}

test('wide dependency setup has a bounded step and avoids apt when both tools work', t => {
  const limit = Number(step.match(/timeout-minutes: (\d+)/)?.[1]);
  assert.ok(limit > 0 && limit <= 10, 'dependency setup must finish within ten minutes');
  const r = run(t); assert.equal(r.status, 0, r.stderr);
  assert.equal(r.sources, null, 'preinstalled tools must not prepare any APT source');
  assert.deepEqual(r.calls, ['ffmpeg version', 'ffprobe version']);
});

test('missing tools use only signed official Ubuntu pockets for every APT process, bypassing the slow runner mirrorlist', t => {
  const r = run(t, { missing: ['ffmpeg'], updateFailures: 1 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.sources.trim().split('\n'), [
    'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble main restricted universe multiverse',
    'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble-updates main restricted universe multiverse',
    'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://security.ubuntu.com/ubuntu noble-security main restricted universe multiverse',
  ]);
  const apt = r.calls.filter(call => call.startsWith('apt-get '));
  assert.equal(apt.length, 3, 'both update attempts and installation use the same isolated source list');
  for (const call of apt) {
    assert.match(call, /Dir::Etc::sourcelist=\S+\/synk-media-ubuntu\.list/);
    assert.match(call, /Dir::Etc::sourceparts=-(?:\s|$)/);
    assert.match(call, /APT::Get::List-Cleanup=0\b/);
    assert.doesNotMatch(call, /allow-unauthenticated|AllowInsecure|trusted=yes/);
  }
});

test('either missing media executable triggers bounded installation and verifies both tools', async t => {
  for (const name of ['ffmpeg', 'ffprobe']) await t.test(name, t => {
    const r = run(t, { missing: [name] }); assert.equal(r.status, 0, r.stderr);
    assert.equal(r.calls.filter(x => x.startsWith('apt-get ')).length, 2);
    for (const call of r.calls.filter(x=>x.startsWith('apt-get '))) {
      for (const kind of ['http', 'https']) {
        const seconds = Number(call.match(new RegExp(`Acquire::${kind}::Timeout=(\\d+)`))?.[1]);
        assert.ok(seconds > 0 && seconds <= 60, call);
      }
      assert.match(call, /Acquire::Retries=[1-3]\b/);
      assert.match(call, /Acquire::ForceIPv4=true/);
    }
    assert.equal(r.calls.filter(x=>/^timeout --kill-after=5s (90|120)s sudo apt-get /.test(x)).length,2,r.stderr+'\n'+r.calls.join('\n'));
    assert.deepEqual(r.calls.slice(-2), ['ffmpeg version', 'ffprobe version']);
  });
});

test('apt failure stops setup without continuing to installation or tests', t => {
  const r = run(t, { missing: ['ffprobe'], updateExit: 23 });
  assert.equal(r.status, 23, r.stderr);
  assert.equal(r.calls.filter(x=>x.startsWith('apt-get ')).length,2);
  assert.ok(r.calls.every(x=>x.includes('update')));
});

test('a failed update retries in a new process and then continues to tool validation', t => {
  const r=run(t,{missing:['ffprobe'],updateFailures:1});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.calls.filter(x=>x.startsWith('apt-get ')&&x.includes('update')).length,2);
  assert.deepEqual(r.calls.slice(-2),['ffmpeg version','ffprobe version']);
});

test('a timed-out process is retried without treating timeout as success', t => {
  const r=run(t,{missing:['ffprobe'],timeoutFailures:1});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.calls.filter(x=>x.startsWith('timeout ')).length,3);
  assert.deepEqual(r.calls.slice(-2),['ffmpeg version','ffprobe version']);
});

test('an installed but unusable ffprobe still fails setup', t => {
  const r = run(t, { probeExit: 7 });
  assert.equal(r.status, 7, r.stderr);
  assert.deepEqual(r.calls, ['ffmpeg version', 'ffprobe version']);
});
