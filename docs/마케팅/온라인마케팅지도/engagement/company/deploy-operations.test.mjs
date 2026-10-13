import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const deploy = fileURLToPath(new URL('./deploy/', import.meta.url));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const unix = value => value.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, letter) => '/' + letter.toLowerCase());
const skip = !existsSync(bash) ? 'Bash is unavailable; Linux runtime checks still required' : false;
const caddy = process.env.SYNK_QA_CADDY;

test('Caddy adapter advertises only reachable TCP protocols and clears cached alternatives', {
  skip: caddy ? false : 'Set SYNK_QA_CADDY to an existing Caddy binary; no download is performed.',
}, () => {
  const result = spawnSync(caddy, ['adapt', '--config', join(deploy, 'Caddyfile'), '--adapter', 'caddyfile'], {
    env: { ...process.env, SYNK_COMPANY_DOMAIN: 'workspace.example.test', SYNK_TLS_EMAIL: 'ops@example.test' },
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const servers = Object.values(JSON.parse(result.stdout).apps.http.servers);
  assert.equal(servers.length, 1);
  assert.deepEqual(servers[0].protocols, ['h1', 'h2']);
  const handlers = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.handler) handlers.push(value);
    for (const child of Object.values(value)) visit(child);
  };
  visit(servers[0].routes);
  const clear = handlers.filter(value => value.handler === 'headers' && value.response?.set?.['Alt-Svc']);
  assert.equal(clear.length, 1);
  assert.deepEqual(clear[0].response.set['Alt-Svc'], ['clear']);
  assert.equal(clear[0].response.deferred, true, 'clear must be applied when response headers are written');
  assert.deepEqual(handlers.filter(value => value.handler === 'reverse_proxy').flatMap(value => value.upstreams.map(upstream => upstream.dial)).sort(),
    ['company:4191', 'synk-spaceship:4318']);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'synk-deploy-ops-'));
  t.after(async () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); });
  for (const sub of ['bin', 'state', 'disk/company/messenger', 'disk/backups', 'disk/archives', 'disk/caddy-data', 'disk/caddy-config']) await mkdir(join(root, sub), { recursive: true });
  for (const name of ['company.sqlite', 'encryption.key', 'workspace-integration.json', 'messenger/messenger.sqlite']) await writeFile(join(root, 'disk/company', name), 'synthetic fixture');
  await writeFile(join(root, 'runtime.env'), 'SYNTHETIC_SECRET=do-not-print-fixture-secret\n', { mode: 0o600 });
  const commands = {
    mountpoint: '[[ "${MOCK_MOUNTED:-1}" = 1 ]]',
    flock: '[[ "${MOCK_LOCK_BUSY:-0}" = 0 ]]',
    stat: `if [[ "$2" = '%u:%a' ]]; then
  if [[ "$4" = "$COMPANY_ARCHIVE_DIR" ]]; then printf '%s\\n' "\${MOCK_ARCHIVE_META:-0:700}"; else printf '%s\\n' "\${MOCK_PARENT_META:-0:755}"; fi
else printf '%s\\n' "\${MOCK_ENV_MODE:-600}"; fi`,
    docker: `printf 'docker %s\n' "$*" >> "$MOCK_CALLS"
if [[ "$*" = *healthcheck.mjs* ]]; then [[ "\${MOCK_HEALTH:-failed}" = ready ]]; exit; fi
if [[ "$*" = *'restart --timeout 60 company'* ]]; then [[ "\${MOCK_RESTART_FAIL:-0}" = 0 ]]; exit; fi
if [[ "$*" = *workspace-backup.mjs* ]]; then
  [[ "\${MOCK_BACKUP_FAIL:-0}" = 0 ]] || exit 1
  name=synk-workspace-2026-10-08T00-00-00-000Z
  mkdir -p "$COMPANY_BACKUP_DIR/$name"
  printf 'synthetic database bytes\n' > "$COMPANY_BACKUP_DIR/$name/snapshot.txt"
  if [[ "\${MOCK_INCOMPLETE:-0}" = 0 ]]; then printf 'ok\n' > "$COMPANY_BACKUP_DIR/$name/COMPLETE"; fi
  printf '/backups/%s\n' "$name"
fi
exit 0`,
    gcloud: `printf 'gcloud %s\n' "$*" >> "$MOCK_CALLS"
[[ ! \${access_token+x} ]] || exit 96
[[ "$*" = 'auth print-access-token --quiet' ]] || exit 90
[[ "\${MOCK_AUTH_FAIL:-0}" = 0 ]] || exit 1
case "\${MOCK_TOKEN_KIND:-valid}" in
  valid) printf 'synthetic.fixture-token_1234567890\n' ;;
  newline) printf 'synthetic.fixture-token_1234567890\nheader = "X-Injected: secret"\n' ;;
  quote) printf 'synthetic.fixture-token_1234567890"\\\\bad\n' ;;
  short) printf 'x\n' ;;
esac`,
    curl: `printf 'curl %s\n' "$*" >> "$MOCK_CALLS"
[[ ! \${access_token+x} ]] || exit 96
[[ "$*" != *synthetic.fixture-token* ]] || exit 91
config="$(cat)"
[[ "$config" = 'header = "Authorization: Bearer synthetic.fixture-token_1234567890"' ]] || exit 92
printf 'CURL_AUTH_STDIN_OK\n' >> "$MOCK_CALLS"
[[ "$*" = *'--config -'* && "$*" = *'--request POST'* && "$*" = *'--upload-file '* ]] || exit 93
[[ "$*" = *'uploadType=media&name=backups%2Fsynk-workspace-'* && "$*" = *'&ifGenerationMatch=0'* ]] || exit 94
[[ "$*" = *'--retry 0'* && "$*" = *'--disable'* && "$*" != *'--location'* ]] || exit 95
if [[ "\${MOCK_UPLOAD_FAIL:-0}" = 1 || "\${MOCK_OBJECT_EXISTS:-0}" = 1 ]]; then
  printf 'private-object-response-sensitive-body\n'
  printf 'private-object-sensitive-error\n' >&2
  exit 22
fi
printf '%s' "\${MOCK_HTTP_STATUS:-200}"`,
  };
  for (const [name, body] of Object.entries(commands)) await writeFile(join(root, 'bin', name), '#!/usr/bin/env bash\n' + body + '\n', { mode: 0o755 });
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^path$|^SYNK_|^COMPANY_|^CADDY_|^MOCK_/i.test(key))),
    PATH: unix(join(root, 'bin')) + ':/usr/bin:/bin', MSYS_NO_PATHCONV: '1',
    OPS_TEST_BIN: unix(join(root, 'bin')),
    SYNK_COMPANY_RUNTIME_ENV_FILE: unix(join(root, 'runtime.env')), SYNK_PERSISTENT_ROOT: unix(join(root, 'disk')),
    COMPANY_VOLUME_DIR: unix(join(root, 'disk/company')), COMPANY_BACKUP_DIR: unix(join(root, 'disk/backups')),
    COMPANY_ARCHIVE_DIR: unix(join(root, 'disk/archives')),
    CADDY_DATA_DIR: unix(join(root, 'disk/caddy-data')), CADDY_CONFIG_DIR: unix(join(root, 'disk/caddy-config')),
    SYNK_OPS_STATE_DIR: unix(join(root, 'state')), SYNK_COMPANY_DOMAIN: 'workspace.example.test',
    SYNK_COMPANY_IMAGE: 'synk-company:fixture', SYNK_TLS_EMAIL: 'ops@example.test',
    SYNK_BACKUP_UPLOAD_ENABLED: '1', SYNK_BACKUP_GCS_DESTINATION: 'gs://synthetic-fixture/backups', MOCK_CALLS: unix(join(root, 'calls.log')) };
  const run = (name, values = {}, args = []) => spawnSync(bash, ['-c', 'export PATH="$OPS_TEST_BIN:/usr/bin:/bin"; exec bash "$@"', 'fixture', unix(join(deploy, name + '.sh')), ...args], { env: { ...env, ...values }, encoding: 'utf8', timeout: 15000 });
  const calls = async () => existsSync(join(root, 'calls.log')) ? await readFile(join(root, 'calls.log'), 'utf8') : '';
  return { root, env, run, calls };
}

test('cloud shell scripts parse and stack refuses a missing disk or unfinished restore', { skip }, async t => {
  for (const script of ['cloud-common', 'company-stack', 'company-health', 'company-backup']) {
    const syntax = spawnSync(bash, ['-n', unix(join(deploy, script + '.sh'))], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
  const f = await fixture(t);
  assert.equal(f.run('company-stack', { MOCK_MOUNTED: '0' }, ['start']).status, 1);
  await writeFile(join(f.root, 'disk/company/PREPARATION_INCOMPLETE'), 'fixture');
  const refused = f.run('company-stack', {}, ['start']);
  assert.equal(refused.status, 1); assert.match(refused.stderr, /RESTORE_ACCEPTANCE_REQUIRED/);
  assert.equal(await f.calls(), '');
  await rm(join(f.root, 'disk/company/PREPARATION_INCOMPLETE'));
  await rm(join(f.root, 'disk/company/messenger/messenger.sqlite'));
  assert.match(f.run('company-stack', {}, ['start']).stderr, /EXISTING_WORKSPACE_REQUIRED/);
  assert.equal(await f.calls(), '');
  await writeFile(join(f.root, 'disk/company/messenger/messenger.sqlite'), 'synthetic fixture');
  const start = f.run('company-stack', {}, ['start']);
  assert.equal(start.status, 0, start.stderr);
  assert.match(await f.calls(), /up --detach --no-build --pull never/);
  assert.doesNotMatch(start.stdout + start.stderr, /do-not-print-fixture-secret/);
});

test('recovery waits for three failed probes and never exceeds two attempts per hour', { skip }, async t => {
  const f = await fixture(t);
  for (let i = 1; i <= 9; i++) {
    const result = f.run('company-health'); assert.equal(result.status, 1, result.stderr);
    const restarts = ((await f.calls()).match(/restart --timeout 60 company/g) || []).length;
    assert.equal(restarts, Math.min(2, Math.floor(i / 3)), 'probe ' + i);
    if (i >= 9) assert.match(result.stderr, /RESTART_LIMIT_REACHED/);
  }
  const recovered = f.run('company-health', { MOCK_HEALTH: 'ready' });
  assert.equal(recovered.status, 0); assert.match(recovered.stdout, /HEALTH_READY/);
  const current = await readFile(join(f.root, 'state/health.state'), 'utf8');
  assert.match(current, /^0 [0-9]+ 2\n$/);
  await writeFile(join(f.root, 'state/health.state'), `0 ${Math.floor(Date.now() / 1000) - 3601} 2\n`);
  for (let i = 0; i < 3; i++) f.run('company-health');
  assert.equal(((await f.calls()).match(/restart --timeout 60 company/g) || []).length, 3);
});

test('failed restart consumes its attempt, busy backup lock skips recovery, corrupt state fails closed', { skip }, async t => {
  const f = await fixture(t);
  const locked = f.run('company-health', { MOCK_LOCK_BUSY: '1' });
  assert.equal(locked.status, 0); assert.match(locked.stdout, /OPERATION_ALREADY_RUNNING/); assert.equal(await f.calls(), '');
  for (let i = 0; i < 3; i++) f.run('company-health', { MOCK_RESTART_FAIL: '1' });
  assert.match(await readFile(join(f.root, 'state/health.state'), 'utf8'), /^0 [0-9]+ 1\n$/);
  await writeFile(join(f.root, 'state/health.state'), 'bad state\n');
  assert.match(f.run('company-health').stderr, /HEALTH_STATE_INVALID/);
  assert.equal(((await f.calls()).match(/restart --timeout 60 company/g) || []).length, 1);
});

test('backup transfers only completed snapshots and retains its local archive after upload failure', { skip }, async t => {
  const f = await fixture(t);
  const result = f.run('company-backup', { MOCK_UPLOAD_FAIL: '1' });
  assert.equal(result.status, 1); assert.match(result.stderr, /OFFSITE_BACKUP_FAILED/);
  const files = await readdir(join(f.root, 'disk/archives'));
  assert.equal(files.filter(name => name.endsWith('.tar.gz')).length, 1);
  assert.equal(files.filter(name => name.endsWith('.uploaded')).length, 0);
  const calls = await f.calls();
  assert.match(calls, /exec -T company node .*workspace-backup.mjs \/backups/);
  assert.match(calls, /gcloud auth print-access-token --quiet/);
  assert.match(calls, /curl --disable --config - .*--request POST .*--upload-file .*uploadType=media.*ifGenerationMatch=0/);
  assert.match(calls, /CURL_AUTH_STDIN_OK/);
  assert.doesNotMatch(result.stdout + result.stderr + calls, /synthetic.fixture-token|private-object/);
  assert.doesNotMatch(calls, /--canned-acl|--predefined-acl|--recursive|\brm\b/);
});

test('incomplete backup or unconfigured offsite storage never invokes upload', { skip }, async t => {
  const f = await fixture(t);
  assert.equal(f.run('company-backup', { SYNK_BACKUP_UPLOAD_ENABLED: '0' }).status, 1);
  assert.equal(await f.calls(), '');
  const incomplete = f.run('company-backup', { MOCK_INCOMPLETE: '1' });
  assert.equal(incomplete.status, 1); assert.match(incomplete.stderr, /BACKUP_INCOMPLETE/);
  assert.doesNotMatch(await f.calls(), /gcloud/);
});

test('successful offsite backup records success only after upload succeeds and keeps all local data', { skip }, async t => {
  const f = await fixture(t), result = f.run('company-backup', { access_token: 'inherited-fixture-placeholder' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /OFFSITE_BACKUP_COMPLETE/);
  const files = await readdir(join(f.root, 'disk/archives'));
  assert.equal(files.filter(name => name.endsWith('.uploaded')).length, 1);
  assert.equal(files.filter(name => name.endsWith('.sha256')).length, 1);
  assert.equal(files.filter(name => name.endsWith('.tar.gz')).length, 1);
  assert.ok((await readdir(join(f.root, 'disk/backups'))).includes('synk-workspace-2026-10-08T00-00-00-000Z'));
  assert.equal((await readdir(join(f.root, 'disk/backups'))).some(name => name.endsWith('.tar.gz')), false);
  const calls = await f.calls();
  assert.match(calls, /CURL_AUTH_STDIN_OK/); assert.doesNotMatch(calls + result.stdout + result.stderr, /synthetic.fixture-token|private-object/);
});

test('create-only upload never retries or marks an existing object or a redirect as successful', { skip }, async t => {
  for (const values of [{ MOCK_OBJECT_EXISTS: '1' }, { MOCK_HTTP_STATUS: '302' }]) {
    const f = await fixture(t), result = f.run('company-backup', values);
    assert.equal(result.status, 1); assert.match(result.stderr, /^SYNK_COMPANY_OPS OFFSITE_BACKUP_FAILED\n$/);
    const files = await readdir(join(f.root, 'disk/archives'));
    assert.equal(files.filter(name => name.endsWith('.uploaded')).length, 0);
    assert.equal(files.filter(name => name.endsWith('.tar.gz')).length, 1);
    const calls = await f.calls(); assert.equal((calls.match(/^curl /gm) || []).length, 1);
    assert.doesNotMatch(calls, /gcloud storage|--location|--canned-acl|--predefined-acl/);
  }
});

test('bad token formats and failed auth never reach curl or expose credential text', { skip }, async t => {
  for (const values of [{ MOCK_TOKEN_KIND: 'newline' }, { MOCK_TOKEN_KIND: 'quote' }, { MOCK_TOKEN_KIND: 'short' }, { MOCK_AUTH_FAIL: '1' }]) {
    const f = await fixture(t), result = f.run('company-backup', values);
    assert.equal(result.status, 1); assert.equal(result.stderr, 'SYNK_COMPANY_OPS OFFSITE_BACKUP_FAILED\n');
    assert.doesNotMatch(await f.calls(), /^curl /m);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic.fixture-token|Injected|secret/);
    assert.equal((await readdir(join(f.root, 'disk/archives'))).filter(name => name.endsWith('.uploaded')).length, 0);
  }
});

test('malformed bucket, prefix traversal or query injection fails before snapshot or auth', { skip }, async t => {
  for (const destination of ['gs://UPPERCASE/backups', 'gs://127.0.0.1/backups', 'gs://bucket/../backups', 'gs://bucket/backups//child', 'gs://bucket/backups?ifGenerationMatch=1', 'gs://bucket/backups%2Fchild', 'gs://bucket/']) {
    const f = await fixture(t), result = f.run('company-backup', { SYNK_BACKUP_GCS_DESTINATION: destination });
    assert.equal(result.status, 1); assert.equal(result.stderr, 'SYNK_COMPANY_OPS BACKUP_DESTINATION_INVALID\n');
    assert.equal(await f.calls(), '');
  }
});

test('host archive directory rejects writable ownership, parent and container mount overlap', { skip }, async t => {
  for (const values of [{ MOCK_ARCHIVE_META: '1000:700' }, { MOCK_ARCHIVE_META: '0:770' }, { MOCK_PARENT_META: '0:777' }]) {
    const f = await fixture(t), result = f.run('company-backup', values);
    assert.equal(result.status, 1); assert.match(result.stderr, /BACKUP_ARCHIVE_DIRECTORY_INVALID/); assert.equal(await f.calls(), '');
  }
  const f = await fixture(t);
  const result = f.run('company-backup', { COMPANY_ARCHIVE_DIR: f.env.COMPANY_BACKUP_DIR });
  assert.equal(result.status, 1); assert.match(result.stderr, /BACKUP_ARCHIVE_DIRECTORY_INVALID/); assert.equal(await f.calls(), '');
});

test('dangling archive and sidecar links never cause a privileged write', { skip }, async t => {
  for (const suffix of ['', '.partial', '.sha256', '.uploaded']) {
    const f = await fixture(t), target = join(f.root, 'must-not-exist');
    const link = join(f.root, 'disk/archives/synk-workspace-2026-10-08T00-00-00-000Z.tar.gz' + suffix);
    try { await symlink(target, link, 'file'); }
    catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('OS disallows symlinks; Linux verification required'); return; } throw error; }
    const result = f.run('company-backup');
    assert.equal(result.status, 1); assert.match(result.stderr, /BACKUP_ARCHIVE_EXISTS/);
    assert.equal(existsSync(target), false); assert.doesNotMatch(await f.calls(), /gcloud|curl/);
  }
});
