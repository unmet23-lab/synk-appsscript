#!/usr/bin/env python3
"""Local retention for the company backup copies on a company node (root).

The offsite copies are the backups; these local ones are only a fast-restore cache. Every backup used to keep
its expanded snapshot and its archive forever, and once the studio videos went into every backup the data disk
filled and the disaster-recovery capture stopped with DISASTER_DISK_SPACE_LOW (2026-10-31).

How it runs:
  * after each successful offsite upload, as an ExecStartPost of synk-company-backup.service. The drop-in
    40-local-retention.conf sorts before disaster-recovery.conf, so this frees space before the DR capture
    measures it. The drop-in prefixes the command with '-', so a hold here never stops the DR capture;
  * by hand through the pinned SSH path for a reviewed one-off clean-up: `REQUEST = {...}` on the first line,
    then this file. `plan` only reads. `apply` with the plan's sha256 and the GCS md5 of every archive in it
    removes exactly that plan, and only after that same run matched each archive to its remote object; `dry`
    checks everything and removes nothing.

What it may remove, nothing else:
  * workspace archive sets <ARCHIVES>/synk-workspace-<T>.tar.gz{,.sha256,.uploaded} whose upload marker names
    exactly this node's GCS destination object, beyond the newest KEEP_ARCHIVES such sets;
  * expanded snapshots <BACKUPS>/synk-workspace-<T>/ that are COMPLETE and whose archive set is such an
    uploaded set, beyond the newest KEEP_SNAPSHOTS complete snapshots.
Never: archives without a valid upload marker, partial files, disaster-recovery capsules (the DR helper keeps
those), other names, symlinks, anything outside the two directories, remote copies.
"""
import hashlib, json, os, pathlib, re, shutil, socket, stat, subprocess, sys, time

KEEP_ARCHIVES = 3
KEEP_SNAPSHOTS = 1
GIB = 1024 ** 3
NAME = r'synk-workspace-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z'
SNAPSHOT = re.compile('^(' + NAME + ')$')
ARCHIVE = re.compile('^(' + NAME + r')\.tar\.gz(\.sha256|\.uploaded)?$')
DESTINATION = re.compile(r'^gs://[a-z0-9][a-z0-9._-]{1,61}[a-z0-9](/[A-Za-z0-9_-][A-Za-z0-9._-]*)*/?$')
SIDECARS = ('', '.sha256', '.uploaded')
OPERATIONS_LOCK = '/var/lib/synk-company-ops/operations.lock'
RELEASE_LOCK = '/run/lock/synk-ha-deploy.lock'
BACKUP_UNIT = 'synk-company-backup.service'
OWNER_UID = 0  # archives and their sidecars are written by root (company-backup.sh)


class Hold(Exception):
    pass


def need(ok, code):
    if not ok:
        raise Hold(code)


def ident(path):
    st = os.lstat(path)
    return {'dev': st.st_dev, 'ino': st.st_ino, 'mtimeNs': str(st.st_mtime_ns), 'bytes': st.st_size}


def tree_bytes(path):
    total = 0
    for root, dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.lstat(os.path.join(root, name)).st_size
            except FileNotFoundError:
                pass
    return total


def real_directory(path, root):
    try:
        st = os.lstat(path)
    except FileNotFoundError:
        raise Hold('DIRECTORY_REQUIRED')
    need(stat.S_ISDIR(st.st_mode), 'DIRECTORY_REQUIRED')
    need(os.path.realpath(path) == path, 'DIRECTORY_PATH_NOT_CANONICAL')
    need(path.startswith(root + os.sep), 'DIRECTORY_OUTSIDE_PERSISTENT_ROOT')
    return st


def settings(environ):
    root = os.path.realpath(environ.get('SYNK_PERSISTENT_ROOT') or '/srv/synk')
    archives = environ.get('COMPANY_ARCHIVE_DIR') or os.path.join(root, 'backup-archives')
    backups = environ.get('COMPANY_BACKUP_DIR') or os.path.join(root, 'backups')
    destination = environ.get('SYNK_BACKUP_GCS_DESTINATION') or ''
    need(DESTINATION.match(destination) is not None, 'DESTINATION_INVALID')
    a = real_directory(archives, root)
    # The archive directory is the host-only place of company-backup.sh (root:root 0700).
    need(a.st_uid == OWNER_UID and (os.name != 'posix' or stat.S_IMODE(a.st_mode) & 0o077 == 0), 'ARCHIVE_DIRECTORY_NOT_PRIVATE')
    real_directory(backups, root)
    need(archives != backups and not archives.startswith(backups + os.sep) and not backups.startswith(archives + os.sep), 'DIRECTORIES_OVERLAP')
    return {'root': root, 'archives': archives, 'backups': backups, 'object': destination.rstrip('/') + '/'}


def regular(path, root_owned=True):
    st = os.lstat(path)
    return stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and (st.st_uid == OWNER_UID or not root_owned)


def read_small(path, limit=1024):
    with open(path, 'rb') as f:
        data = f.read(limit + 1)
    need(len(data) <= limit, 'SIDECAR_TOO_LARGE')
    return data


def archive_problem(cfg, name, files):
    """None when the set is a complete archive whose upload to this destination succeeded, else why not."""
    if set(files) != set(SIDECARS):
        return 'SET_INCOMPLETE'
    archive, checksum, marker = (files[s] for s in SIDECARS)
    if not all(regular(p) for p in (archive, checksum, marker)):
        return 'NOT_PRIVATE_REGULAR_FILES'
    if os.lstat(archive).st_size <= 0:
        return 'ARCHIVE_EMPTY'
    # company-backup.sh: printf '%s\n' "gs://<bucket>/<prefix>/<name>.tar.gz" after HTTP 200/201 with ifGenerationMatch=0.
    if read_small(marker) != (cfg['object'] + name + '.tar.gz\n').encode():
        return 'MARKER_NOT_THIS_DESTINATION'
    if not re.fullmatch(rb'[0-9a-f]{64}  \S*/' + re.escape((name + '.tar.gz').encode()) + rb'\n', read_small(checksum, 4096)):
        return 'CHECKSUM_FILE_INVALID'
    # A marker older than its archive means the archive changed after the upload.
    if os.lstat(archive).st_mtime_ns > os.lstat(marker).st_mtime_ns:
        return 'ARCHIVE_CHANGED_AFTER_UPLOAD'
    return None


def inventory(cfg):
    sets = {}
    for entry in os.scandir(cfg['archives']):
        m = ARCHIVE.match(entry.name)
        if m:
            sets.setdefault(m.group(1), {})[m.group(2) or ''] = entry.path
    archives = []
    for name in sorted(sets, reverse=True):  # names carry the UTC time, newest first
        archives.append({'name': name, 'files': sets[name], 'problem': archive_problem(cfg, name, sets[name])})
    snapshots = []
    for entry in os.scandir(cfg['backups']):
        if SNAPSHOT.match(entry.name) and entry.is_dir(follow_symlinks=False):
            marker = os.path.join(entry.path, 'COMPLETE')
            complete = os.path.lexists(marker) and regular(marker, root_owned=False) and read_small(marker) == b'ok\n'
            snapshots.append({'name': entry.name, 'path': entry.path, 'complete': complete})
    snapshots.sort(key=lambda s: s['name'], reverse=True)
    return archives, snapshots


def plan(cfg):
    archives, snapshots = inventory(cfg)
    uploaded = [a for a in archives if a['problem'] is None]
    uploaded_names = {a['name'] for a in uploaded}
    complete = [s for s in snapshots if s['complete']]
    targets = []
    # Snapshots first: each is removed only while its uploaded archive set is still here.
    for s in complete[KEEP_SNAPSHOTS:]:
        if s['name'] in uploaded_names:
            row = ident(s['path'])
            targets.append({'kind': 'snapshot', 'name': s['name'], 'path': s['path'], **row, 'bytes': tree_bytes(s['path'])})
    for a in reversed(uploaded[KEEP_ARCHIVES:]):  # oldest first
        for suffix in SIDECARS:  # the archive before its checksum, the upload marker last
            path = a['files'][suffix]
            targets.append({'kind': 'archive' + (suffix or '.tar.gz'), 'name': a['name'], 'path': path, **ident(path)})
    kept = {'archives': [a['name'] for a in uploaded[:KEEP_ARCHIVES]],
            'snapshots': [s['name'] for s in complete[:KEEP_SNAPSHOTS]],
            'archivesNotUploaded': [{'name': a['name'], 'problem': a['problem']} for a in archives if a['problem']],
            'snapshotsKept': [s['name'] for s in snapshots if s['name'] not in {t['name'] for t in targets if t['kind'] == 'snapshot'}]}
    body = json.dumps([[t['kind'], t['path'], t['dev'], t['ino'], t['mtimeNs'], t['bytes']] for t in targets], separators=(',', ':'))
    summary = {}
    for t in targets:
        row = summary.setdefault(t['kind'].split('.')[0], {'count': 0, 'bytes': 0})
        row['count'] += 1 if t['kind'] in ('snapshot', 'archive.tar.gz') else 0
        row['bytes'] += t['bytes']
    return {'status': 'planned', 'node': socket.gethostname(), 'keep': {'archives': KEEP_ARCHIVES, 'snapshots': KEEP_SNAPSHOTS},
            'targets': targets, 'kept': kept, 'summary': summary, 'free': shutil.disk_usage(cfg['archives']).free,
            'planSha256': hashlib.sha256(body.encode()).hexdigest()}


def recheck(cfg, t):
    """The target is still the planned object, inside its directory, and still allowed by the rule."""
    path = t['path']
    parent = cfg['backups'] if t['kind'] == 'snapshot' else cfg['archives']
    need(os.path.dirname(path) == parent, 'TARGET_SCOPE')
    now = ident(path)
    need((now['dev'], now['ino'], now['mtimeNs']) == (t['dev'], t['ino'], t['mtimeNs']), 'TARGET_CHANGED')
    if t['kind'] == 'snapshot':
        need(stat.S_ISDIR(os.lstat(path).st_mode) and SNAPSHOT.match(os.path.basename(path)), 'TARGET_TYPE')
    else:
        need(regular(path) and ARCHIVE.match(os.path.basename(path)) and now['bytes'] == t['bytes'], 'TARGET_TYPE')


def remove(t):
    if t['kind'] == 'snapshot':
        # Snapshot folders are written by the container; never follow a link it may have planted.
        need(os.name != 'posix' or shutil.rmtree.avoids_symlink_attacks, 'SAFE_RMTREE_REQUIRED')
        shutil.rmtree(t['path'])
    else:
        os.unlink(t['path'])
    need(not os.path.lexists(t['path']), 'REMOVE_FAILED')


def md5_base64(path):
    import base64
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return base64.b64encode(h.digest()).decode()


def verify_remote(cfg, expected, remote_md5):
    """Every archive of the exact plan matches its remote object byte for byte ({name: GCS md5Hash}).
    Reads the archives without the operations lock, so a backup that starts meanwhile is not kept waiting."""
    planned = plan(cfg)
    need(planned['planSha256'] == expected, 'PLAN_CHANGED')
    checked = 0
    for t in planned['targets']:
        recheck(cfg, t)
        if t['kind'] == 'archive.tar.gz':
            need(remote_md5.get(t['name'] + '.tar.gz') == md5_base64(t['path']), 'REMOTE_COPY_MISMATCH')
            checked += 1
    return checked


def apply(cfg, expected=None, dry=False, removed=None):
    """Remove the plan; with `expected`, only that exact plan. `dry` checks everything and removes nothing."""
    removed = [] if removed is None else removed
    planned = plan(cfg)
    if expected is not None:
        need(planned['planSha256'] == expected, 'PLAN_CHANGED')
    for t in planned['targets']:
        recheck(cfg, t)
    before = shutil.disk_usage(cfg['archives']).free
    if not dry:
        for t in planned['targets']:
            recheck(cfg, t)
            remove(t)
            removed.append({'kind': t['kind'], 'name': t['name'], 'bytes': t['bytes']})
    out = {'status': 'dry-run-ok' if dry else 'applied', 'node': planned['node'], 'planSha256': planned['planSha256'],
           'summary': planned['summary'], 'removed': len(removed), 'removedBytes': sum(r['bytes'] for r in removed),
           'freeBefore': before, 'freeAfter': shutil.disk_usage(cfg['archives']).free,
           'kept': planned['kept']}
    return out


def capture_estimate(cfg, kept):
    """Rough free space the DR capture will ask for next time (disaster-capture.py required_disk_bytes:
    3 x (images + source + newest archive) + 2 x expanded data + 1 GiB). Informational only."""
    try:
        newest = kept['archives'][0]
        archive = os.lstat(os.path.join(cfg['archives'], newest + '.tar.gz')).st_size
        snapshot = tree_bytes(os.path.join(cfg['backups'], kept['snapshots'][0]))
        ids = subprocess.run(['docker', 'ps', '--quiet', '--no-trunc'], capture_output=True, text=True, timeout=30, check=True).stdout.split()
        images = set()
        for cid in ids:
            images.add(subprocess.run(['docker', 'inspect', '--format', '{{.Image}}', cid], capture_output=True, text=True, timeout=30, check=True).stdout.strip())
        image_bytes = sum(int(subprocess.run(['docker', 'image', 'inspect', '--format', '{{.Size}}', i], capture_output=True, text=True, timeout=30, check=True).stdout.strip()) for i in images)
        source = tree_bytes(os.path.realpath('/opt/synk/current'))
        return 3 * (image_bytes + source + archive) + 2 * snapshot + GIB
    except Exception:
        return None


def lock_free(path):
    try:
        st = os.stat(path)
    except FileNotFoundError:
        return True
    key = (os.major(st.st_dev), os.minor(st.st_dev), st.st_ino)
    for line in pathlib.Path('/proc/locks').read_text().splitlines():
        for token in line.split():
            m = re.fullmatch(r'([0-9a-f]+):([0-9a-f]+):([0-9]+)', token)
            if m and (int(m.group(1), 16), int(m.group(2), 16), int(m.group(3))) == key:
                return False
    return True


def take_operations_lock():
    """The same flock as company-backup.sh and the health check, waiting like a backup does (120 s)."""
    import fcntl
    fd = os.open(OPERATIONS_LOCK, os.O_RDWR | os.O_CREAT | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    end = time.monotonic() + 120
    while True:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except BlockingIOError:
            need(time.monotonic() < end, 'OPERATIONS_LOCK_BUSY')
            time.sleep(1)


def manual_idle():
    """A by-hand run must not overlap a backup run or a release transaction."""
    state = subprocess.run(['systemctl', 'is-active', BACKUP_UNIT], capture_output=True, text=True, timeout=10).stdout.strip()
    need(state in ('inactive', 'failed'), 'BACKUP_RUNNING')
    need(lock_free(RELEASE_LOCK), 'RELEASE_LOCK_HELD')


def run(request, environ):
    need(os.name != 'posix' or os.geteuid() == 0, 'ROOT_REQUIRED')
    cfg = settings(environ)
    op = request.get('op')
    if op == 'plan':
        return plan(cfg)
    need(op == 'apply', 'EXPLICIT_OPERATION_REQUIRED')
    manual = request.get('manual') is True
    expected = request.get('planSha256') if manual else None
    remote = request.get('remoteMd5')
    removed, checked = [], None
    try:
        if manual:
            need(re.fullmatch(r'[0-9a-f]{64}', expected or '') is not None, 'PLAN_SHA256_REQUIRED')
            # A by-hand removal never rests on an earlier dry run: the same run must match every archive to GCS.
            need(isinstance(remote, dict), 'REMOTE_CHECK_REQUIRED')
            manual_idle()
            checked = verify_remote(cfg, expected, remote)
        else:
            need(remote is None, 'REMOTE_CHECK_IS_MANUAL')
        lock = take_operations_lock()
        try:
            if manual:
                manual_idle()
            out = apply(cfg, expected, request.get('dry') is True, removed)
        finally:
            os.close(lock)
    except Hold as error:
        return {'status': 'held', 'code': str(error), 'removed': len(removed), 'removedBytes': sum(r['bytes'] for r in removed)}
    out['remoteChecked'] = checked
    need_bytes = capture_estimate(cfg, out['kept'])
    out['estimatedCaptureNeed'] = need_bytes
    out['headroomLow'] = need_bytes is not None and out['freeAfter'] < need_bytes * 5 // 4
    return out


def main():
    request = globals().get('REQUEST')
    systemd = request is None
    try:
        environ = dict(os.environ)
        if systemd:
            need(sys.argv[1:] == ['--apply'], 'USAGE_APPLY_ONLY')
            request = {'op': 'apply'}
        else:
            # `sudo python3 -` carries no unit environment; a by-hand run names the backup destination itself.
            # It only narrows what counts as uploaded, and the dry run checks every archive against that object.
            extra = request.get('environ') or {}
            need(set(extra) <= {'SYNK_BACKUP_GCS_DESTINATION', 'COMPANY_ARCHIVE_DIR', 'COMPANY_BACKUP_DIR', 'SYNK_PERSISTENT_ROOT'}, 'ENVIRON_KEYS')
            environ.update(extra)
        out = run(request, environ)
    except Hold as error:
        out = {'status': 'held', 'code': str(error)}
    except Exception as error:
        out = {'status': 'held', 'code': 'ERROR_' + type(error).__name__.upper()}
    if not systemd:
        print(json.dumps(out))
        return 0
    code = {'applied': 'LOCAL_RETENTION_HEADROOM_LOW' if out.get('headroomLow') else 'LOCAL_RETENTION_COMPLETE'}.get(out['status'], 'LOCAL_RETENTION_HELD')
    brief = {k: out.get(k) for k in ('code', 'removed', 'removedBytes', 'freeAfter', 'estimatedCaptureNeed') if k in out}
    print('SYNK_LOCAL_RETENTION ' + code + ' ' + json.dumps(brief, separators=(',', ':')))
    return 0 if out['status'] == 'applied' else 1


if __name__ == '__main__':
    sys.exit(main())
