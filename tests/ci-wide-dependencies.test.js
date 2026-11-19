const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { 이번push새파일 } = require('./_git밖.js');

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/wide-tests.yml'), 'utf8').replace(/\r\n/g, '\n');
const step = workflow.match(/      - name: install dependencies\n([\s\S]*?)(?=      # 형제 저장소)/)?.[1];
assert.ok(step, 'dependency install step must exist');
const script = step.match(/        run: \|\n([\s\S]*)/)[1].split('\n').map(line => line.slice(10)).join('\n');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const posix = p => process.platform === 'win32' ? p.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase()) : p;
const mediaInstaller = 'tools/ci-install-ffmpeg.sh';

test('syntax-check runs the shared media installer before the full safety suite and checks skipped tests', () => {
  const syntax = fs.readFileSync(path.join(__dirname, '../.github/workflows/syntax-check.yml'), 'utf8');
  const install = syntax.search(/^ +(?:run: )?bash tools\/ci-install-ffmpeg\.sh\s*$/m);
  const safety = syntax.search(/^ +node --test [^\n]* tests\/\*\.test\.js\b/m);
  const skipGuard = syntax.indexOf('node tools/conditional-qa/guard.cjs --skips');
  assert.ok(install >= 0 && install < safety && safety < skipGuard);
  assert.doesNotMatch(syntax, /^ +sudo apt-get (?:update|install)\b/m);
});

test('experiences runs inside Xvfb and other bundles use node directly, preserving the baseline argument', t => {
  const section = workflow.match(/      - name: run tests[^\n]*\n([\s\S]*?)(?=      - name: verify sparse)/)?.[1];
  const body = section?.match(/        run: \|\n([\s\S]*)/)?.[1].split('\n').map(line => line.slice(10)).join('\n');
  assert.ok(body);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-wide-display-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tests'));
  const prefix = 'node() { printf "node"; printf " <%s>" "$@"; printf "\\n"; }\nxvfb-run() { printf "xvfb"; printf " <%s>" "$@"; printf "\\n"; }\n';
  const command = path.join(root, 'run.sh');
  fs.writeFileSync(command, prefix + body);
  for (const [bundle,baseline] of [['experiences',false],['experiences',true],['desktop',true],['tools',true]]) {
    if (baseline) fs.writeFileSync(path.join(root, 'tests/ci넓은시험_알려진실패.json'), '{}');
    const result = spawnSync(bash, [posix(command)], {
      cwd: root, encoding: 'utf8', windowsHide: true,
      env: { ...process.env, BUNDLE: bundle, RUNNER_TEMP: 'fixture-output' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), (bundle === 'experiences'
      ? 'xvfb <--auto-servernum> <--server-args=-screen 0 1600x1000x24 -nolisten tcp> <node>'
      : 'node') + ' <tools/ci넓은시험.js> <' + bundle + '> <' + (baseline ? '--후보' : '--기준선') + '> <fixture-output/wide-baseline.json>');
  }
});

function run(t, { bundle = 'experiences', missing = [], updateExit = 0, updateFailures = 0, timeoutFailures = 0, probeExit = 0,
  distribution = 'Ubuntu', codename = 'noble', architecture = 'amd64' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-wide-deps-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin'), log = path.join(root, 'calls'), npmLog = path.join(root, 'npm-calls');
  fs.mkdirSync(bin); for (const folder of ['synk-account', 'solo-backup', 'solo-backup-rust/engine']) fs.mkdirSync(path.join(root, 'experiences', folder), { recursive: true });
  // experiences 묶음은 WORLD 새 길 시험이 부르는 엔진(packages/atlas)의 의존성도 그 폴더에서 깐다(11-13).
  fs.mkdirSync(path.join(root, 'packages', 'atlas'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tools'));
  const installer = fs.readFileSync(path.join(__dirname, '..', mediaInstaller), 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(path.join(root, mediaInstaller), installer);
  const executable = (name, text) => fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n' + text, { mode: 0o755 });
  executable('lsb_release', `case "$1" in -is) echo '${distribution}' ;; -cs) echo '${codename}' ;; *) exit 1 ;; esac\n`);
  executable('dpkg', `[ "$1" = --print-architecture ] || exit 1\nprintf '%s\\n' '${architecture}'\n`);
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
  // npm only records the current directory and arguments. Keep the APT retry processes separate.
  const setup = 'export PATH="$FIXTURE_BIN"\nbash() { /bin/bash "$@"; }\nnpm() { printf "%s|%s\\n" "$PWD" "$*" >> "$NPM_CALLS"; }\n';
  const result = spawnSync(bash, ['-e', '-c', setup + script], {
    // This watchdog bounds the entire fixture, including Git Bash process startup on a busy Windows host.
    cwd: root, encoding: 'utf8', timeout: process.platform === 'win32' ? 60000 : 10000, windowsHide: true,
    env: { ...process.env, PATH: posix(bin), RUNNER_TEMP: posix(root), BUNDLE: bundle, CALLS: posix(log), NPM_CALLS: posix(npmLog), FIXTURE_BIN: posix(bin), UPDATE_EXIT: String(updateExit), UPDATE_FAILURES: String(updateFailures), UPDATE_COUNT: posix(path.join(root,'update-count')), TIMEOUT_FAILURES: String(timeoutFailures), TIMEOUT_COUNT: posix(path.join(root,'timeout-count')) },
  });
  assert.equal(result.error, undefined, result.error?.message);
  const sources = path.join(root, 'synk-media-ubuntu.list');
  // npm을 부른 폴더를 저장소 뿌리에서 본 자리('' = 뿌리)로 남긴다.
  const npm = fs.existsSync(npmLog) ? fs.readFileSync(npmLog, 'utf8').trim().split('\n').map(line => line.split('|')[0].replace(/^.*?\/synk-wide-deps-[^/]*/, '')) : [];
  return { ...result, npm, sources: fs.existsSync(sources) ? fs.readFileSync(sources, 'utf8') : null, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [] };
}

// 11-16 tools 묶음의 WORLD 공개 준비 시험이 플랫폼 원천을 묶다가 계정 폴더의 @supabase/supabase-js를 못 찾아 wide (tools)가 빨갰다.
test('the tools bundle installs the account folder with its lock and keeps it in the npm cache key', t => {
  const r = run(t, { bundle: 'tools' }); assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.npm, ['', '/experiences/synk-account']);
  assert.deepEqual(r.calls, [], 'the tools bundle does not need ffmpeg');
  const experiences = run(t); assert.equal(experiences.status, 0, experiences.stderr);
  assert.deepEqual(experiences.npm, ['', '/experiences/synk-account', '/experiences/solo-backup', '/experiences/solo-backup-rust/engine', '/packages/atlas']);
  const setup = workflow.match(/      - uses: actions\/setup-node@v5\n([\s\S]*?)(?=      - name:)/)?.[1];
  assert.match(setup, /\(matrix\.bundle == 'experiences' \|\| matrix\.bundle == 'tools'\) && 'experiences\/synk-account\/package-lock\.json'/);
});

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
    assert.match(call, /Acquire::Languages=none(?:\s|$)/);
    assert.doesNotMatch(call, /allow-unauthenticated|AllowInsecure|trusted=yes/);
  }
  assert.match(apt[2], /--no-install-recommends\b/);
});

test('other self-hosted distributions and architectures use their configured repositories', async t => {
  for (const host of [{ distribution: 'Debian', codename: 'bookworm' }, { codename: 'jammy' }, { architecture: 'arm64' }]) {
    await t.test(host.distribution ?? host.codename ?? host.architecture, t => {
      const r = run(t, { ...host, missing: ['ffprobe'] });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.sources, null);
      const apt = r.calls.filter(call => call.startsWith('apt-get '));
      assert.equal(apt.length, 2);
      for (const call of apt) assert.doesNotMatch(call, /Dir::Etc::source|Acquire::Languages/);
      assert.match(apt[1], /--no-install-recommends\b/);
      assert.deepEqual(r.calls.slice(-2), ['ffmpeg version', 'ffprobe version']);
    });
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
  const exhausted = run(t, { missing: ['ffprobe'], timeoutFailures: 2 });
  assert.equal(exhausted.status, 124, exhausted.stderr);
  assert.equal(exhausted.calls.length, 2);
  assert.ok(exhausted.calls.every(call => call.startsWith('timeout ') && /\bupdate\b/.test(call)));
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
  for (const input of ['SYNK-appsscript/package-lock.json', 'desktop/package-lock.json', 'experiences/synk-account/package-lock.json', 'experiences/solo-backup/package-lock.json', '영상/package-lock.json', 'SYNK-talk/package-lock.json', '.github/workflows/wide-tests.yml']) assert.ok(setup.includes(input), input);
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

// 11-08 experiences/solo-backup이 tar-stream을 더했는데 이 단계에 설치가 없어 그 폴더 시험이 파일째 죽어 wide (experiences)가 빨갰다.
function checkExperienceInstalls(root, newFiles) {
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'experiences/*/package.json', 'experiences/*/package-lock.json'], {
    cwd: root, encoding: 'utf8',
  }).split('\0');
  const files = new Set([...tracked, ...newFiles]);
  for (const manifest of files) {
    if (!/^experiences\/[^/]+\/package\.json$/.test(manifest)) continue;
    const file = path.join(root, manifest);
    if (!fs.existsSync(file)) continue;
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Object.keys(pkg.dependencies || {}).length) continue;
    const folder = path.posix.dirname(manifest);
    assert.ok(script.includes(`(cd ${folder} && npm ci `), `wide-tests.yml install dependencies에 ${folder}의 npm ci가 없다`);
    const lock = folder + '/package-lock.json';
    assert.ok(files.has(lock) && fs.existsSync(path.join(root, lock)), `CI 체크아웃에 ${lock}이 없으면 npm ci가 멈춘다`);
  }
}

test('every experiences folder with dependencies is installed for the experiences bundle', () => {
  checkExperienceInstalls(path.join(__dirname, '..'), 이번push새파일());
});

test('local prototypes stay outside CI while tracked and incoming manifests require an install and a lock', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-wide-manifests-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  const account = 'experiences/synk-account';
  const prototype = 'experiences/local-prototype';
  fs.writeFileSync(path.join(root, '.gitignore'), prototype + '/\n');
  for (const folder of [account, prototype]) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
    fs.writeFileSync(path.join(root, folder, 'package.json'), JSON.stringify({ dependencies: { example: '1' } }));
    fs.writeFileSync(path.join(root, folder, 'package-lock.json'), '{}');
  }
  execFileSync('git', ['add', '--', account + '/package.json'], { cwd: root });
  assert.throws(() => checkExperienceInstalls(root, []), /synk-account\/package-lock\.json/);
  const incomingLock = [account + '/package-lock.json'];
  checkExperienceInstalls(root, incomingLock);
  assert.throws(() => checkExperienceInstalls(root, [...incomingLock, prototype + '/package.json']), /local-prototype의 npm ci/);
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
