#!/usr/bin/env python3
"""Send the newest daily work-backup database copy off the company host (server/README.md).

Runs as root from synk-wb-offsite.service on the company writer node. It takes the newest
`workbackup-YYYY-MM-DD.sqlite` the api wrote into its backups folder (a UTC date, jobs.mjs),
copies it through one no-follow file descriptor into a root-only stage, checks that copy
read-only, gzips it and creates `company/workbackup/<name>.gz` in the company backup bucket
with the node's own token (create-only, never overwrite). A bucket rule deletes these objects
after 14 days; with soft delete (7 days) and the rule's lag every copy is gone well inside
the 30 days the privacy policy promises. Each run prints one line `SYNK_WB_OFFSITE <WORD> {json}`.
No secret, bucket name or customer value is printed.
"""
import base64, datetime, gzip, hashlib, json, os, pathlib, re, shutil, sqlite3, stat, subprocess, sys, urllib.error, urllib.parse, urllib.request

BACKUPS = pathlib.Path('/srv/synk/workbackup/api/backups')
STATE = pathlib.Path('/var/lib/synk-wb-offsite')
ENV_FILE = pathlib.Path('/etc/synk/company.env')
API_UID = 10771
PREFIX = 'company/workbackup/'
NAME = re.compile(r'^workbackup-(\d{4}-\d{2}-\d{2})\.sqlite$')
MAX_AGE = 36 * 3600
SETTLE = 300
MAX_BYTES = 256 * 1024 ** 2
META = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token'


class Stop(Exception):
    """A quiet end (not the writer node, no work-backup folder): exit 0."""


class Failed(Exception):
    pass


def need(ok, code):
    if not ok:
        raise Failed(code)


def bucket_of(env_text):
    """The bucket of SYNK_BACKUP_GCS_DESTINATION (gs://bucket/prefix); the prefix is not used."""
    value = None
    for line in env_text.splitlines():
        if line.startswith('SYNK_BACKUP_GCS_DESTINATION='):
            need(value is None, 'DESTINATION_DUPLICATE')
            value = line.split('=', 1)[1].strip().strip('"\'')
    m = re.fullmatch(r'gs://([a-z0-9][a-z0-9._-]{1,61}[a-z0-9])/[A-Za-z0-9._/-]+', value or '')
    need(m, 'DESTINATION_INVALID')
    return m.group(1)


def valid_day(day):
    try:
        return datetime.date.fromisoformat(day).isoformat() == day
    except ValueError:
        return False


def pick(folder):
    """The newest well-named entry; the api never writes another name, so others are ignored."""
    if not folder.is_dir() or folder.is_symlink():
        raise Stop('ABSENT')
    rows = [(m.group(1), p) for p in folder.iterdir() for m in [NAME.match(p.name)] if m and valid_day(m.group(1))]
    need(rows, 'NO_COPY')
    return max(rows)[1]


def stage_copy(path, now, stage):
    """Open without following links, check what was opened, copy it into the root-only stage.

    The api's folder belongs to uid 10771; a compromised api could swap the name for a link
    or a hard link to another file. Only the opened descriptor is trusted from here on.
    """
    try:
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0))
    except OSError:
        raise Failed('COPY_UNREADABLE')
    try:
        s = os.fstat(fd)
        need(stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and (API_UID is None or s.st_uid == API_UID), 'COPY_NOT_PLAIN')
        need(0 < s.st_size <= MAX_BYTES, 'COPY_SIZE')
        age = now - s.st_mtime
        need(0 <= age <= MAX_AGE, 'COPY_STALE')
        need(age >= SETTLE, 'COPY_SETTLING')
        target = stage / path.name
        out = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        with os.fdopen(fd, 'rb', closefd=False) as reader, os.fdopen(out, 'wb') as writer:
            shutil.copyfileobj(reader, writer, 1024 * 1024)
        after = os.fstat(fd)
        need(after.st_size == s.st_size and after.st_mtime_ns == s.st_mtime_ns and target.stat().st_size == s.st_size, 'COPY_CHANGED')
        return target
    finally:
        os.close(fd)


def check_database(path):
    """Read-only, immutable open of the private stage copy."""
    try:
        con = sqlite3.connect('file:' + urllib.parse.quote(path.as_posix()) + '?mode=ro&immutable=1', uri=True)
        try:
            ok = con.execute('pragma quick_check').fetchall() == [('ok',)]
            tables = {r[0] for r in con.execute("select name from sqlite_master where type = 'table'")}
        finally:
            con.close()
    except sqlite3.DatabaseError:
        raise Failed('COPY_CORRUPT')
    need(ok, 'COPY_CORRUPT')
    need({'customers', 'devices', 'keys'} <= tables, 'COPY_NOT_WORKBACKUP')


def compress(source):
    """gzip next to the stage copy. Returns the gzip path, source SHA-256, gzip MD5 (base64) and size."""
    target = source.with_name(source.name + '.gz')
    source_hash, md5 = hashlib.sha256(), hashlib.md5()
    with source.open('rb') as reader, open(target, 'xb') as raw:
        os.chmod(target, 0o600)
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as out:
            for block in iter(lambda: reader.read(1024 * 1024), b''):
                source_hash.update(block)
                out.write(block)
    with target.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            md5.update(block)
    return target, source_hash.hexdigest(), base64.b64encode(md5.digest()).decode(), target.stat().st_size


def token():
    req = urllib.request.Request(META, headers={'Metadata-Flavor': 'Google'})
    with urllib.request.urlopen(req, timeout=10) as r:
        value = json.load(r).get('access_token')
    need(isinstance(value, str) and value, 'TOKEN_MISSING')
    return value


def upload(bucket, name, file, md5b64, size, access_token, opener=urllib.request.urlopen):
    """Create-only upload. Returns 'created', or 'exists' on a 412 (the name is taken)."""
    url = ('https://storage.googleapis.com/upload/storage/v1/b/' + bucket + '/o?uploadType=media&ifGenerationMatch=0&name='
           + urllib.parse.quote(PREFIX + name, safe=''))
    req = urllib.request.Request(url, data=file.read_bytes(), method='POST',
                                 headers={'Authorization': 'Bearer ' + access_token, 'Content-Type': 'application/gzip'})
    try:
        with opener(req, timeout=300) as r:
            body = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 412:
            return 'exists'
        raise Failed('UPLOAD_HTTP_' + str(e.code))
    need(body.get('name') == PREFIX + name and str(body.get('size')) == str(size) and body.get('md5Hash') == md5b64, 'UPLOAD_MISMATCH')
    return 'created'


def writer_node(run=subprocess.run):
    r = run(['systemctl', 'is-active', '--quiet', 'synk-company.service'], timeout=15)
    return r.returncode == 0 and os.path.ismount('/srv/synk')


def private_state():
    STATE.mkdir(mode=0o700, exist_ok=True)
    s = STATE.lstat()
    need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and stat.S_IMODE(s.st_mode) == 0o700, 'STATE_PERMISSIONS')


def main(now=None, run=subprocess.run, get_token=token, send=upload):
    now = now if now is not None else datetime.datetime.now(datetime.timezone.utc).timestamp()
    need(os.geteuid() == 0, 'ROOT_REQUIRED')
    if not writer_node(run):
        raise Stop('NOT_WRITER')
    path = pick(BACKUPS)
    private_state()
    marker = STATE / 'last.json'
    last = json.loads(marker.read_text()) if marker.exists() else {}
    name = path.name + '.gz'
    if last.get('name') == name and last.get('result') == 'created':
        # Already sent, but the api must still be writing new copies.
        need(0 <= now - path.lstat().st_mtime <= MAX_AGE, 'COPY_STALE')
        return 'ALREADY', {'name': name}
    stage = STATE / 'stage'
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(mode=0o700)
    try:
        copy = stage_copy(path, now, stage)
        check_database(copy)
        target, sha, md5b64, size = compress(copy)
        if not writer_node(run):
            raise Stop('NOT_WRITER')
        result = send(bucket_of(ENV_FILE.read_text()), name, target, md5b64, size, get_token())
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    need(result == 'created', 'OBJECT_EXISTS_UNVERIFIED')
    record = {'name': name, 'result': result, 'bytes': size, 'sourceSha256': sha, 'at': datetime.datetime.fromtimestamp(now, datetime.timezone.utc).isoformat()}
    tmp = STATE / 'last.json.tmp'
    tmp.write_text(json.dumps(record))
    os.chmod(tmp, 0o600)
    os.replace(tmp, marker)
    return 'OK', {'name': name, 'bytes': size}


if __name__ == '__main__':
    try:
        word, detail = main()
        print('SYNK_WB_OFFSITE ' + word + ' ' + json.dumps(detail), flush=True)
    except Stop as e:
        print('SYNK_WB_OFFSITE SKIPPED ' + json.dumps({'reason': str(e)}), flush=True)
    except Failed as e:
        print('SYNK_WB_OFFSITE FAILED ' + json.dumps({'code': str(e)}), flush=True)
        sys.exit(1)
    except Exception as e:
        print('SYNK_WB_OFFSITE FAILED ' + json.dumps({'code': 'UNEXPECTED_' + type(e).__name__}), flush=True)
        sys.exit(1)
