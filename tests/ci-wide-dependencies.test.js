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

function run(t, { missing = [], updateExit = 0, probeExit = 0 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-wide-deps-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin'), log = path.join(root, 'calls');
  fs.mkdirSync(bin); fs.mkdirSync(path.join(root, 'experiences/synk-account'), { recursive: true });
  const executable = (name, text) => fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n' + text, { mode: 0o755 });
  executable('npm', 'exit 0\n');
  for (const name of ['ffmpeg', 'ffprobe']) if (!missing.includes(name)) {
    executable(name, `printf '%s\\n' '${name} version' >> "$CALLS"\nexit ${name === 'ffprobe' ? probeExit : 0}\n`);
  }
  executable('sudo', `printf '%s\\n' "$*" >> "$CALLS"
case "$*" in
  *update*) exit "$UPDATE_EXIT";;
  *install*)
    for name in ffmpeg ffprobe; do
      printf '#!/bin/sh\\nprintf "%%s\\n" "%s version" >> "$CALLS"\\nexit 0\\n' "$name" > "$FIXTURE_BIN/$name"
      /bin/chmod +x "$FIXTURE_BIN/$name"
    done;;
  *) exit 99;;
esac
`);
  const result = spawnSync(bash, ['-e', '-c', script], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PATH: posix(bin), BUNDLE: 'experiences', CALLS: posix(log), FIXTURE_BIN: posix(bin), UPDATE_EXIT: String(updateExit) },
  });
  assert.equal(result.error, undefined, result.error?.message);
  return { ...result, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [] };
}

test('wide dependency setup has a bounded step and avoids apt when both tools work', t => {
  const limit = Number(step.match(/timeout-minutes: (\d+)/)?.[1]);
  assert.ok(limit > 0 && limit <= 10, 'dependency setup must finish within ten minutes');
  const r = run(t); assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.calls, ['ffmpeg version', 'ffprobe version']);
});

test('either missing media executable triggers bounded installation and verifies both tools', async t => {
  for (const name of ['ffmpeg', 'ffprobe']) await t.test(name, t => {
    const r = run(t, { missing: [name] }); assert.equal(r.status, 0, r.stderr);
    assert.equal(r.calls.filter(x => x.startsWith('apt-get ')).length, 2);
    for (const call of r.calls.slice(0, 2)) {
      for (const kind of ['http', 'https']) {
        const seconds = Number(call.match(new RegExp(`Acquire::${kind}::Timeout=(\\d+)`))?.[1]);
        assert.ok(seconds > 0 && seconds <= 60, call);
      }
      assert.match(call, /Acquire::Retries=[1-3]\b/);
    }
    assert.deepEqual(r.calls.slice(-2), ['ffmpeg version', 'ffprobe version']);
  });
});

test('apt failure stops setup without continuing to installation or tests', t => {
  const r = run(t, { missing: ['ffprobe'], updateExit: 23 });
  assert.equal(r.status, 23, r.stderr);
  assert.equal(r.calls.length, 1); assert.match(r.calls[0], /update/);
});

test('an installed but unusable ffprobe still fails setup', t => {
  const r = run(t, { probeExit: 7 });
  assert.equal(r.status, 7, r.stderr);
  assert.deepEqual(r.calls, ['ffmpeg version', 'ffprobe version']);
});
