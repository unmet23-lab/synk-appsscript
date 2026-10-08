import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, utimes, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const deploy = fileURLToPath(new URL('./deploy/', import.meta.url));
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const unix = value => value.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, letter) => '/' + letter.toLowerCase());
const skip = !existsSync(bash) ? 'Bash unavailable; Linux runtime check required' : false;
const now = 1800000000, maxAge = 27 * 60 * 60;
const name = 'synk-workspace-2026-10-08T00-00-00-000Z.tar.gz';
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'synk-backup-watch-'));
  t.after(async () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true, force: true }); });
  for (const sub of ['bin', 'disk/archives', 'outside']) await mkdir(join(root, sub), { recursive: true });
  await writeFile(join(root, 'bin/mountpoint'), '#!/usr/bin/env bash\n[[ "${MOCK_MOUNTED:-1}" = 1 ]]\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/stat'), '#!/usr/bin/env bash\nif [[ "$2" = "%u:%a" ]]; then if [[ "$4" = "$COMPANY_ARCHIVE_DIR" ]]; then printf "%s\\n" "${MOCK_ARCHIVE_META:-0:700}"; else printf "%s\\n" "${MOCK_PARENT_META:-0:755}"; fi; else exec /usr/bin/stat "$@"; fi\n', { mode: 0o755 });
  await writeFile(join(root, 'bin/date'), `#!/usr/bin/env bash\nprintf '%s\\n' '${now}'\n`, { mode: 0o755 });
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^path$|^SYNK_|^COMPANY_|^CADDY_|^MOCK_/i.test(key))),
    PATH: unix(join(root, 'bin')) + ':/usr/bin:/bin', MSYS_NO_PATHCONV: '1',
    WATCH_TEST_BIN: unix(join(root, 'bin')), WATCH_SCRIPT: unix(join(deploy, 'company-backup-watch.sh')),
    SYNK_PERSISTENT_ROOT: unix(join(root, 'disk')), COMPANY_ARCHIVE_DIR: unix(join(root, 'disk/archives')),
    SYNK_BACKUP_UPLOAD_ENABLED: '1', SYNK_BACKUP_GCS_DESTINATION: 'gs://synthetic-fixture/backups' };
  const archive = join(root, 'disk/archives', name), marker = archive + '.uploaded';
  // Git Bash may prepend its system tools during initialization on Windows.
  // Set the fixture PATH inside that shell so the test clock is deterministic.
  const run = (values = {}) => spawnSync(bash, ['-c', 'export PATH="$WATCH_TEST_BIN:/usr/bin:/bin"; source "$WATCH_SCRIPT"'], { env: { ...env, ...values }, encoding: 'utf8', timeout: 10000 });
  const pair = async ({ age = 100, markerAge = age, content = `gs://synthetic-fixture/backups/${name}\n`, bytes = 'synthetic archive' } = {}) => {
    await writeFile(archive, bytes); await writeFile(marker, content);
    await utimes(archive, now - age, now - age); await utimes(marker, now - markerAge, now - markerAge);
  };
  const stale = values => {
    const result = run(values); assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.stdout, ''); assert.equal(result.stderr, 'SYNK_COMPANY_OPS BACKUP_STALE\n');
  };
  return { root, archive, marker, run, pair, stale };
}

test('watchdog parses and requires a complete upload record with an existing nonempty archive', { skip }, async t => {
  const syntax = spawnSync(bash, ['-n', unix(join(deploy, 'company-backup-watch.sh'))], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const f = await fixture(t); f.stale();
  await f.pair(); await rm(f.marker); f.stale();
  await f.pair(); await rm(f.archive); f.stale();
  await f.pair({ bytes: '' }); f.stale();
  await f.pair(); const result = f.run();
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'SYNK_COMPANY_OPS BACKUP_FRESH\n'); assert.equal(result.stderr, '');
});

test('27 hour boundary, fresh marker on old archive, future time and post-upload writes fail correctly', { skip }, async t => {
  const f = await fixture(t);
  await f.pair({ age: maxAge }); assert.equal(f.run().status, 0);
  await f.pair({ age: maxAge + 1 }); f.stale();
  await f.pair({ age: maxAge + 1, markerAge: 0 }); f.stale();
  await f.pair({ age: -60, markerAge: -30 }); f.stale();
  await f.pair({ age: 0, markerAge: 60 }); f.stale();
});

test('missing mount, disabled upload and out-of-disk paths fail without disclosing paths or content', { skip }, async t => {
  const f = await fixture(t); await f.pair();
  f.stale({ MOCK_ARCHIVE_META: '1000:700' }); f.stale({ MOCK_ARCHIVE_META: '0:770' }); f.stale({ MOCK_PARENT_META: '0:777' });
  f.stale({ MOCK_MOUNTED: '0' }); f.stale({ SYNK_BACKUP_UPLOAD_ENABLED: '0' });
  f.stale({ COMPANY_ARCHIVE_DIR: unix(join(f.root, 'outside')) });
  f.stale({ COMPANY_ARCHIVE_DIR: unix(join(f.root, 'absent-secret-path')) });
  f.stale({ SYNK_BACKUP_GCS_DESTINATION: 'invalid-sensitive-destination' });
  await f.pair({ content: 'gs://another-private-bucket/secret-object\n' }); f.stale();
  await f.pair({ content: 'sensitive-fixture'.repeat(100) }); f.stale();
});

test('symlink markers and archives cannot count as successful backups', { skip }, async t => {
  const f = await fixture(t); await f.pair();
  const target = join(f.root, 'outside/target'); await writeFile(target, 'synthetic');
  await rm(f.marker);
  try { await symlink(target, f.marker, 'file'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('OS disallows symlinks; validate on Linux'); return; } throw error; }
  f.stale(); await rm(f.marker); await f.pair(); await rm(f.archive); await symlink(target, f.archive, 'file'); f.stale();
});

test('symlink or junction backup directories and ancestors cannot count as mounted storage', { skip }, async t => {
  const f = await fixture(t); await f.pair();
  await symlink(join(f.root, 'disk'), join(f.root, 'disk-link'), process.platform === 'win32' ? 'junction' : 'dir');
  f.stale({ SYNK_PERSISTENT_ROOT: unix(join(f.root, 'disk-link')), COMPANY_ARCHIVE_DIR: unix(join(f.root, 'disk-link/backups')) });
  await symlink(join(f.root, 'disk/archives'), join(f.root, 'disk/archives-link'), process.platform === 'win32' ? 'junction' : 'dir');
  f.stale({ COMPANY_ARCHIVE_DIR: unix(join(f.root, 'disk/archives-link')) });
});

test('company service starts the watchdog and timer checks every thirty minutes', async () => {
  const service = await readFile(join(deploy, 'systemd/synk-company.service'), 'utf8');
  const timer = await readFile(join(deploy, 'systemd/synk-company-backup-watch.timer'), 'utf8');
  const watch = await readFile(join(deploy, 'systemd/synk-company-backup-watch.service'), 'utf8');
  assert.match(service, /^Wants=.*\bsynk-company-backup-watch\.timer\b/m);
  assert.match(timer, /^OnUnitActiveSec=30min$/m); assert.match(timer, /^PartOf=synk-company\.service$/m);
  assert.match(watch, /^Requisite=synk-company\.service$/m); assert.match(watch, /^PartOf=synk-company\.service$/m);
});
