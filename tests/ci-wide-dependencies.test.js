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

test('wide preparation retains deterministic installs, minimal checkout credentials and every test bundle', () => {
  const checkouts = [...workflow.matchAll(/(?:      - uses:|        uses:) actions\/checkout@v5\n([\s\S]*?)(?=      - |      # 형제 저장소|$)/g)];
  assert.equal(checkouts.length, 2);
  for (const checkout of checkouts) assert.match(checkout[1], /persist-credentials: false/);
  const setup = workflow.match(/      - uses: actions\/setup-node@v5\n([\s\S]*?)(?=      - name:)/)?.[1];
  assert.match(setup, /cache: npm/);
  for (const input of ['SYNK-appsscript/package-lock.json', 'desktop/package-lock.json', 'experiences/synk-account/package-lock.json', '영상/package-lock.json', 'SYNK-talk/package-lock.json', '.github/workflows/wide-tests.yml']) assert.ok(setup.includes(input), input);
  assert.doesNotMatch(setup, /cache-dependency-path:.*node_modules/);
  assert.match(workflow, /bundle: \[루트, 회사, desktop, experiences, tools\]/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /NODE_OPTIONS: --require .*\/tools\/ci읽기기록\.cjs/);
  const guard = workflow.match(/      - name: verify sparse inputs were not skipped\n([\s\S]*?)(?=      - name:)/)?.[1];
  assert.match(guard, /success\(\) \|\| failure\(\)/);
  assert.match(guard, /ci읽기대조\.cjs --sparse-only --trace/);
  assert.doesNotMatch(guard, /continue-on-error/);
});

test('wide sparse checkout excludes only intended production PNGs and keeps source, tests and common inputs in the Git index', t => {
  const { 희소목록 } = require('../tools/ci읽기대조.cjs');
  const [patterns] = 희소목록(workflow);
  assert.ok(patterns?.length);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-wide-checkout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const omitted = ['docs/캐릭터/nested/original.PNG', 'docs/홍보물/source.png', 'docs/라디오/nested/edit.png'];
  const kept = ['tests/check.test.cjs', 'tools/tool.cjs', 'docs/캐릭터/nested/source.cjs', 'docs/홍보물/source.json', 'docs/라디오/source.md',
    'docs/캐릭터/photo.jpg', 'docs/캐릭터/정본_4K/몽글_본체.png', 'docs/홍보물/계정별콘텐츠_20260909/input.png',
    'docs/홍보물/마케팅실행_20260909/브랜드킷/logo.png', 'docs/홍보물/브랜드소개_20260909/input.png',
    'docs/라디오/DJ장면_20261019/구운판/input.png', 'docs/라디오/무대/input.png', 'experiences/app/assets/image.png',
    'docs/마케팅/온라인마케팅지도/engagement/company/public/image.png'];
  for (const file of [...omitted, ...kept]) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), 'fixture'); }
  const git = (args, input) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', input, windowsHide: true });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  };
  git(['init', '-q']); git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
  git(['sparse-checkout', 'set', '--no-cone', '--stdin'], patterns.join('\n') + '\n');
  for (const file of omitted) assert.equal(fs.existsSync(path.join(root, file)), false, file);
  for (const file of kept) assert.equal(fs.existsSync(path.join(root, file)), true, file);
  assert.equal(git(['ls-files', '-z']).split('\0').filter(Boolean).length, omitted.length + kept.length, 'checkout narrowing never deletes source or changes the tracked test denominator');
});
