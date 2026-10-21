#!/usr/bin/env python3
"""Static set operations on the node that owns the company data disk.

The PC tool sends this file through the existing pinned SSH path as
`sudo python3 -` with one leading line `REQUEST = {...}` and reads one JSON
line back. Layout under the persistent disk (follows the writer on failover):

  /srv/synk/static/sets/<id>/manifest.json  and files at repository paths
  /srv/synk/static/current -> sets/<id>     (relative link, replaced by rename)
  /srv/synk/static/history.json             (every flip, newest last)

Each file row records `origin`: the release bytes it was made against (null
when the release had no such file). The server serves the set copy only while
its image still holds those bytes, so an image release that changes a file
wins until a new set is made on top of it. Sets are immutable once written.

Nothing here touches the release root, the image, containers, services, data
or HA state; the release root is only read.
"""
import base64, hashlib, json, os, pathlib, re, shutil, stat, sys, time

SCHEMA = 'synk-company-static-set/v2'
SET_ID = re.compile(r'^[a-f0-9]{16}$')
SHA256 = re.compile(r'^[a-f0-9]{64}$')
COMMIT = re.compile(r'^[a-f0-9]{40}$')
MAX_FILES = 10000
MAX_SERVED_BYTES = 2_500_000  # base64 output must stay inside the 4 MiB SSH reply


class Refused(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Refused(code)


def safe(path):
    return isinstance(path, str) and 0 < len(path) <= 512 and not path.startswith('/') and '\\' not in path and '\0' not in path and all(part not in ('', '.', '..') for part in path.split('/'))


def canonical_id(files):
    body = json.dumps({'files': files}, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(body.encode('utf-8')).hexdigest()[:16]


def durable(path, directory=False):
    """fsync one file or directory so a crash cannot leave a listed file short."""
    if os.name == 'nt':  # Windows test runs only; production is Linux.
        return
    descriptor = os.open(path, os.O_RDONLY | (os.O_DIRECTORY if directory else 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def file_digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def validate(manifest, expected_id=None):
    require(isinstance(manifest, dict) and manifest.get('schema') == SCHEMA, 'STATIC_SET_SCHEMA')
    files = manifest.get('files')
    require(isinstance(files, dict) and 0 < len(files) <= MAX_FILES, 'STATIC_SET_FILES')
    for path, row in files.items():
        require(safe(path) and isinstance(row, dict) and set(row) == {'sha256', 'size', 'origin'} and SHA256.match(str(row['sha256'])) and isinstance(row['size'], int) and row['size'] >= 0 and (row['origin'] is None or SHA256.match(str(row['origin']))), 'STATIC_SET_FILE')
    require(SET_ID.match(str(manifest.get('id'))) and manifest['id'] == canonical_id(files), 'STATIC_SET_ID')
    require(expected_id is None or manifest['id'] == expected_id, 'STATIC_SET_ID')
    return manifest


class Node:
    def __init__(self, root='/srv/synk/static', release='/opt/synk/current', persistent='/srv/synk', clock=time.time, owner_check=True, symlink=os.symlink, readlink=os.readlink, islink=os.path.islink):
        self.root, self.release, self.persistent, self.clock, self.owner_check = pathlib.Path(root), pathlib.Path(release), pathlib.Path(persistent), clock, owner_check
        self.symlink, self.readlink, self.islink = symlink, readlink, islink

    # The data disk is attached read-write only to the current owner.
    def owner(self):
        if not self.owner_check:
            return
        require(os.path.ismount(self.persistent), 'NOT_DATA_DISK_OWNER')
        require(self.release.is_symlink() and self.release.resolve().is_dir(), 'RELEASE_ROOT_REQUIRED')

    def sets(self):
        return self.root / 'sets'

    def ensure_root(self):
        for directory in (self.root, self.sets()):
            if not directory.exists():
                directory.mkdir(mode=0o755)
            info = directory.lstat()
            require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), 'STATIC_ROOT_INVALID')
            if self.owner_check:
                require(info.st_uid == 0 and not info.st_mode & 0o022, 'STATIC_ROOT_INVALID')

    def lock(self):
        handle = open(self.root / '.lock', 'a+')
        try:
            import fcntl
        except ImportError:  # Windows test runs only; production is Linux.
            return handle
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return handle

    def current_id(self):
        link = self.root / 'current'
        if not self.islink(link):
            require(not link.exists(), 'CURRENT_NOT_LINK')
            return None
        target = self.readlink(link)
        require(target.startswith('sets/') and SET_ID.match(target[5:]), 'CURRENT_TARGET_INVALID')
        return target[5:]

    def manifest(self, set_id):
        require(SET_ID.match(str(set_id)), 'STATIC_SET_ID')
        path = self.sets() / set_id / 'manifest.json'
        require(path.is_file() and not path.is_symlink(), 'STATIC_SET_MISSING')
        return validate(json.loads(path.read_text('utf-8')), set_id)

    def verify(self, set_id):
        manifest, base = self.manifest(set_id), self.sets() / set_id
        for rel, row in manifest['files'].items():
            path = base.joinpath(*rel.split('/'))
            info = path.lstat()
            require(stat.S_ISREG(info.st_mode) and info.st_size == row['size'] and file_digest(path) == row['sha256'], 'STATIC_SET_FILE_MISMATCH')
        return manifest

    # A damaged record must not stop status, plan or the next flip; the link is the truth.
    def history(self):
        path = self.root / 'history.json'
        try:
            value = json.loads(path.read_text('utf-8')) if path.exists() else []
        except (OSError, ValueError):
            return []
        return value if isinstance(value, list) else []

    # The running release's copy of one repository path, or None.
    def release_digest(self, rel):
        path = self.release.resolve().joinpath(*rel.split('/'))
        return file_digest(path) if path.is_file() and not path.is_symlink() else None

    def write_set(self, files, commit, source):
        """files: rel -> (callable(dest) that writes or links bytes, origin); returns id."""
        rows = {}
        work = self.sets() / ('.work-' + os.urandom(6).hex())
        work.mkdir(mode=0o755)
        try:
            for rel in sorted(files):
                require(safe(rel), 'STATIC_SET_FILE')
                dest = work.joinpath(*rel.split('/'))
                dest.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                write, origin = files[rel]
                write(dest)
                os.chmod(dest, 0o644)
                rows[rel] = {'sha256': file_digest(dest), 'size': dest.stat().st_size, 'origin': origin}
            set_id = canonical_id(rows)
            manifest = {'schema': SCHEMA, 'id': set_id, 'commit': commit if commit and COMMIT.match(commit) else None, 'source': source, 'createdAt': int(self.clock()), 'files': rows}
            validate(manifest)
            (work / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=1) + '\n', 'utf-8')
            os.chmod(work / 'manifest.json', 0o644)
            final = self.sets() / set_id
            if final.exists():
                self.verify(set_id)
                return set_id, False
            # Every byte and directory entry reaches the disk before the set gets its name.
            for path in sorted(work.rglob('*'), key=lambda p: len(p.parts), reverse=True):
                durable(path, directory=path.is_dir())
            durable(work, directory=True)
            os.rename(work, final)
            durable(self.sets(), directory=True)
            work = None
            return set_id, True
        finally:
            if work is not None and work.exists():
                for path in sorted(work.rglob('*'), key=lambda p: len(p.parts), reverse=True):
                    path.rmdir() if path.is_dir() and not path.is_symlink() else path.unlink()
                work.rmdir()

    # The release compose binds this root read-only and refuses a missing source,
    # so the owner gets the empty root before the first release that mounts it.
    def ensure(self):
        self.owner()
        self.ensure_root()
        return {'status': 'ensured', 'root': str(self.root), 'current': self.current_id()}

    # Copy the listed screen files out of the running release root; each row's origin is its own bytes.
    def init(self, paths, commit):
        self.owner()
        self.ensure_root()
        release = self.release.resolve()
        listed = {}
        for rel in paths:
            require(safe(rel), 'STATIC_SET_FILE')
            source = release.joinpath(*rel.split('/'))
            require(source.is_file() and not source.is_symlink() and release in source.resolve().parents, 'RELEASE_FILE_MISSING')
            listed[rel] = ((lambda src: (lambda dest: shutil.copyfile(src, dest)))(source), file_digest(source))
        with self.lock():
            set_id, created = self.write_set(listed, commit, {'kind': 'release', 'releaseRoot': str(release)})
        return {'status': 'staged', 'set': set_id, 'created': created, 'files': len(listed)}

    # A new set: the base set's files hard-linked with their origins, and replacements
    # written against the bytes the running release holds now.
    def stage(self, base, changes, expected_id, commit):
        self.owner()
        self.ensure_root()
        with self.lock():
            manifest, base_dir = self.verify(base), self.sets() / base
            listed = {}
            for rel, row in manifest['files'].items():
                listed[rel] = ((lambda src: (lambda dest: os.link(src, dest)))(base_dir.joinpath(*rel.split('/'))), row['origin'])
            for rel, row in changes.items():
                require(safe(rel) and isinstance(row, dict), 'STATIC_SET_FILE')
                body = base64.b64decode(row['base64'], validate=True)
                require(hashlib.sha256(body).hexdigest() == row['sha256'], 'CHANGE_BYTES')
                listed[rel] = ((lambda data: (lambda dest: dest.write_bytes(data)))(body), self.release_digest(rel))
            set_id, created = self.write_set(listed, commit, {'kind': 'delta', 'base': base, 'changed': sorted(changes)})
        require(set_id == expected_id, 'STAGED_ID_MISMATCH')
        return {'status': 'staged', 'set': set_id, 'created': created, 'files': len(listed), 'changed': len(changes)}

    # Replace the link atomically after a full byte check of the target set.
    def flip(self, to, expected_from):
        self.owner()
        self.ensure_root()
        with self.lock():
            current = self.current_id()
            require(current == expected_from, 'CURRENT_CHANGED')
            manifest = self.verify(to)
            temporary = self.root / ('.current-' + os.urandom(6).hex())
            self.symlink('sets/' + to, temporary)
            os.replace(temporary, self.root / 'current')
            durable(self.root, directory=True)
            # The link has moved; a history failure must not hide that from the caller.
            try:
                history = self.history() + [{'at': int(self.clock()), 'from': current, 'to': to, 'commit': manifest.get('commit')}]
                body = json.dumps(history[-200:], ensure_ascii=False, indent=1) + '\n'
                temporary = self.root / ('.history-' + os.urandom(6).hex())
                temporary.write_text(body, 'utf-8')
                os.chmod(temporary, 0o644)
                durable(temporary)
                os.replace(temporary, self.root / 'history.json')
                recorded = True
            except Exception:
                recorded = False
        return {'status': 'flipped', 'from': current, 'to': to, 'files': len(manifest['files']), 'historyRecorded': recorded}

    # The bytes a request for each path gets now: the current set copy while the
    # release still holds its origin, otherwise the release copy, otherwise none.
    def served(self, paths):
        self.owner()
        current = self.current_id()
        rows = self.manifest(current)['files'] if current else {}
        out = {}
        for rel in paths:
            require(safe(rel), 'STATIC_SET_FILE')
            release, row = self.release_digest(rel), rows.get(rel)
            if row is not None and row['origin'] == release:
                path, source = (self.sets() / current).joinpath(*rel.split('/')), 'set'
            elif release is not None:
                path, source = self.release.resolve().joinpath(*rel.split('/')), 'release'
            else:
                out[rel] = {'from': None, 'release': None}
                continue
            require(path.stat().st_size <= MAX_SERVED_BYTES, 'SERVED_TOO_LARGE')
            out[rel] = {'from': source, 'release': release, 'base64': base64.b64encode(path.read_bytes()).decode('ascii')}
        return {'status': 'served', 'set': current, 'files': out}

    def status(self):
        if self.owner_check and not os.path.ismount(self.persistent):
            return {'status': 'not-owner'}
        if not self.root.exists():
            return {'status': 'absent'}
        current = self.current_id()
        sets = sorted(p.name for p in self.sets().iterdir() if SET_ID.match(p.name)) if self.sets().exists() else []
        manifest = self.manifest(current) if current else None
        return {'status': 'present', 'schema': SCHEMA, 'current': current, 'commit': manifest and manifest.get('commit'), 'files': manifest and len(manifest['files']), 'sets': sets, 'history': self.history()[-10:]}


def main(request, node=None):
    node = node or Node()
    op = request.get('op')
    if op == 'status':
        return node.status()
    if op == 'ensure':
        return node.ensure()
    if op == 'init':
        return node.init(request['paths'], request.get('commit'))
    if op == 'stage':
        return node.stage(request['base'], request['changes'], request['expectId'], request.get('commit'))
    if op == 'flip':
        return node.flip(request['to'], request.get('from'))
    if op == 'served':
        return node.served(request['paths'])
    if op == 'manifest':
        return {'status': 'manifest', 'manifest': node.manifest(request['set'])}
    if op == 'verify':
        manifest = node.verify(request['set'])
        return {'status': 'verified', 'set': manifest['id'], 'files': len(manifest['files'])}
    raise Refused('EXPLICIT_OPERATION_REQUIRED')


if __name__ == '__main__':
    try:
        result = main(globals().get('REQUEST') or json.loads(sys.stdin.readline() or '{}'))
    except Refused as error:
        result = {'status': 'refused', 'code': str(error)}
    except BlockingIOError:
        result = {'status': 'refused', 'code': 'STATIC_SET_BUSY'}
    except Exception as error:  # the PC side reads exactly one JSON line
        result = {'status': 'refused', 'code': 'NODE_ERROR_' + type(error).__name__}
    print(json.dumps(result, ensure_ascii=False))
