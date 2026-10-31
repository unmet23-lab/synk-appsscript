#!/usr/bin/env python3
"""Studio media bodies of the company backup, beside the archive in GCS.

  upload   backup node, root, called by company-backup.sh after the archive
           <snapshot name>.tar.gz is in GCS and before its upload marker: every
           body the snapshot lists goes once per content as
           <prefix>/<snapshot name>.media-<sha256>, then a small
           <snapshot name>.media-complete closes the set. GCS ends each object
           30 days after it was created, so bodies created after their archive
           never expire before it. A failed run can leave the archive without
           (all) its bodies and without the completion object; the node then
           writes no upload marker. The node keeps no media copy of its own: the
           disk-hungry part (bodies inside every local archive and recovery
           capsule) is what this replaces. With bytes in the archive (both) the
           bodies are read from the snapshot copy, so they equal the archive.
  hydrate  restore: fill <snapshot>/company/studio-media (and a prepared company
           volume) for a backup made with --media=manifest. Its own sidecars
           first; a body with the same sha256 from another backup is accepted.
  verify   read only: every listed sha256 has a sidecar of this backup with the
           right size and the set is closed; --download also streams each one
           and checks its sha256.

The OAuth access token is one line on standard input -- never argv, environment
or output. Failures print only `SYNK_BACKUP_MEDIA <CODE>` on stderr, exit 1.
The upload identity may only create objects: nothing here lists, reads,
overwrites or deletes with it, and every object name is new.
"""
import argparse
import base64
import hashlib
import http.client
import json
import os
import re
import stat
import sys
import time
import urllib.parse

MANIFEST = 'media-manifest.json'
INTEGRATION = 'integration-manifest.json'
MANIFEST_SCHEMA = 'synk-workspace-media/v1'
MEDIA_NAME = re.compile(r'^[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)$', re.I)
SNAPSHOT = re.compile(r'^synk-workspace-[0-9TZ-]+$')
SHA = re.compile(r'^[0-9a-f]{64}$')
SIDECAR = re.compile(r'^(synk-workspace-[0-9TZ-]+)\.media-([0-9a-f]{64})$')
COMPLETE_SCHEMA = 'synk-workspace-media-complete/v1'
TOKEN = re.compile(r'^[A-Za-z0-9._~+/-]+={0,2}$')
BUCKET = re.compile(r'^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$')
PREFIX = re.compile(r'^([A-Za-z0-9_-][A-Za-z0-9._-]*/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$')
LOOPBACK = re.compile(r'^http://127\.0\.0\.1:[0-9]{1,5}$')
GCS_HOST = 'storage.googleapis.com'
MAX_JSON = 16 * 1024 * 1024
MAX_FILES = 100000
MAX_BODY = 64 * 1024 ** 3
BLOCK = 1024 * 1024
# Production nodes are Linux. The path-based branch only lets the Windows
# development PC run the tests; any other platform without these flags refuses.
SECURE = hasattr(os, 'O_NOFOLLOW') and os.open in os.supports_dir_fd
BINARY = getattr(os, 'O_BINARY', 0)


class Failure(Exception):
    pass


def need(condition, code):
    if not condition:
        raise Failure(code)


def destination(text):
    need(isinstance(text, str) and text.startswith('gs://'), 'DESTINATION_INVALID')
    location = text[5:].rstrip('/')
    bucket, _, prefix = location.partition('/')
    need(BUCKET.match(bucket) and '..' not in bucket and '.-' not in bucket and '-.' not in bucket, 'DESTINATION_INVALID')
    need(not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+', bucket), 'DESTINATION_INVALID')
    need(prefix == '' or PREFIX.match(prefix), 'DESTINATION_INVALID')
    return bucket, prefix + '/' if prefix else ''


def read_token():
    token = sys.stdin.readline().rstrip('\n')
    need(20 <= len(token) <= 16384 and TOKEN.match(token), 'TOKEN_INVALID')
    return token


class Budget:
    """One deadline for the whole stage, checked between blocks, not only per request."""
    def __init__(self, seconds=None, clock=time.monotonic):
        self.clock = clock
        self.deadline = None if seconds is None else clock() + seconds

    def check(self):
        need(self.deadline is None or self.clock() < self.deadline, 'TIME_BUDGET')

    def timeout(self):
        if self.deadline is None:
            return 600.0
        left = self.deadline - self.clock()
        need(left > 0, 'TIME_BUDGET')
        return max(1.0, min(600.0, left))


# ---- files written by the container: never follow a link, never block -------------

def open_directory(path, parent=None):
    if not SECURE:
        need(os.name == 'nt', 'PLATFORM_UNSUPPORTED')
        target = path if parent is None else os.path.join(parent, path)
        try:
            info = os.lstat(target)
        except OSError:
            raise Failure('DIRECTORY_INVALID')
        need(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), 'DIRECTORY_INVALID')
        return target
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    try:
        return os.open(path, flags, dir_fd=parent) if parent is not None else os.open(path, flags)
    except OSError:
        raise Failure('DIRECTORY_INVALID')


def close_directory(handle):
    if SECURE and isinstance(handle, int):
        os.close(handle)


def open_file(directory, name, size=None, owner=None, single_link=True):
    """A regular file in `directory`: no link, FIFO or device, and (when given) the
    expected size and owner. O_NONBLOCK keeps a planted FIFO from holding the backup."""
    if SECURE:
        flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
        try:
            fd = os.open(name, flags | getattr(os, 'O_NOATIME', 0), dir_fd=directory)
        except PermissionError:
            fd = os.open(name, flags, dir_fd=directory)
        except OSError:
            raise Failure('MEDIA_FILE_UNREADABLE')
        device = os.fstat(directory).st_dev
    else:
        path = os.path.join(directory, name)
        try:
            before = os.lstat(path)
        except OSError:
            raise Failure('MEDIA_FILE_UNREADABLE')
        need(stat.S_ISREG(before.st_mode), 'MEDIA_FILE_INVALID')
        fd = os.open(path, os.O_RDONLY | BINARY)
        device = os.stat(directory).st_dev
    try:
        info = os.fstat(fd)
        need(stat.S_ISREG(info.st_mode), 'MEDIA_FILE_INVALID')
        need(info.st_dev == device, 'MEDIA_FILE_INVALID')
        need(not single_link or info.st_nlink == 1, 'MEDIA_FILE_INVALID')
        need(owner is None or not SECURE or info.st_uid == owner, 'MEDIA_FILE_INVALID')
        need(size is None or info.st_size == size, 'MEDIA_FILE_SIZE_CHANGED')
        if SECURE:
            import fcntl
            fcntl.fcntl(fd, fcntl.F_SETFL, fcntl.fcntl(fd, fcntl.F_GETFL) & ~os.O_NONBLOCK)
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_json_file(directory, name):
    fd = open_file(directory, name, single_link=False)
    try:
        need(os.fstat(fd).st_size <= MAX_JSON, 'MANIFEST_INVALID')
        chunks = []
        while True:
            block = os.read(fd, BLOCK)
            if not block:
                break
            chunks.append(block)
        return json.loads(b''.join(chunks))
    except (ValueError, UnicodeDecodeError):
        raise Failure('MANIFEST_INVALID')
    finally:
        os.close(fd)


def digests(fd, budget):
    sha, md5, size = hashlib.sha256(), hashlib.md5(), 0
    os.lseek(fd, 0, os.SEEK_SET)
    while True:
        budget.check()
        block = os.read(fd, BLOCK)
        if not block:
            return sha.hexdigest(), md5.digest(), size
        sha.update(block)
        md5.update(block)
        size += len(block)


def load_manifest(snapshot_path):
    """The snapshot's media list, checked as untrusted input against integration-manifest.json."""
    name = os.path.basename(os.path.normpath(snapshot_path))
    need(SNAPSHOT.match(name), 'SNAPSHOT_INVALID')
    snapshot = open_directory(snapshot_path)
    try:
        fd = open_file(snapshot, MANIFEST, single_link=False)
        try:
            manifest_sha = digests(fd, Budget())[0]
        finally:
            os.close(fd)
        manifest = read_json_file(snapshot, MANIFEST)
        integration = read_json_file(snapshot, INTEGRATION)
    finally:
        close_directory(snapshot)
    need(isinstance(manifest, dict) and manifest.get('schema') == MANIFEST_SCHEMA, 'MANIFEST_INVALID')
    need(type(manifest.get('bytesIncluded')) is bool, 'MANIFEST_INVALID')
    files = manifest.get('files')
    need(isinstance(files, list) and len(files) <= MAX_FILES, 'MANIFEST_INVALID')
    seen = set()
    for item in files:
        need(isinstance(item, dict) and set(item) == {'diskName', 'sha256', 'bytes'}, 'MANIFEST_INVALID')
        need(isinstance(item['diskName'], str) and MEDIA_NAME.match(item['diskName']) and item['diskName'] not in seen, 'MANIFEST_INVALID')
        need(isinstance(item['sha256'], str) and SHA.match(item['sha256']), 'MANIFEST_INVALID')
        need(type(item['bytes']) is int and 0 <= item['bytes'] <= MAX_BODY, 'MANIFEST_INVALID')
        seen.add(item['diskName'])
    need(isinstance(integration, dict) and integration.get('version') == 1 and integration.get('mediaCount') == len(files)
         and integration.get('mediaManifest') == MANIFEST and integration.get('mediaBytesIncluded') is manifest['bytesIncluded'], 'MANIFEST_INVALID')
    contents = {}
    for item in files:
        previous = contents.setdefault(item['sha256'], item['bytes'])
        need(previous == item['bytes'], 'MANIFEST_INVALID')
    return {'name': name, 'bytesIncluded': manifest['bytesIncluded'], 'files': files, 'contents': contents, 'sha256': manifest_sha}


# ---- GCS JSON API over one HTTPS host ---------------------------------------------

class Storage:
    def __init__(self, token, endpoint=None, budget=None):
        self.token = token
        self.budget = budget or Budget()
        if endpoint is None:
            self.connect = lambda timeout: http.client.HTTPSConnection(GCS_HOST, timeout=timeout, blocksize=BLOCK)
        else:
            need(LOOPBACK.match(endpoint), 'ENDPOINT_INVALID')  # tests only
            port = int(endpoint.rsplit(':', 1)[1])
            self.connect = lambda timeout: http.client.HTTPConnection('127.0.0.1', port, timeout=timeout, blocksize=BLOCK)

    def request(self, method, path, body=None, headers=None, stream=False):
        connection = self.connect(self.budget.timeout())
        sent = {'Authorization': 'Bearer ' + self.token}
        sent.update(headers or {})
        try:
            connection.request(method, path, body=body, headers=sent)
            response = connection.getresponse()
        except Failure:
            connection.close()
            raise
        except Exception:
            connection.close()
            raise Failure('STORAGE_REQUEST_FAILED')
        if stream:
            return connection, response
        try:
            data = response.read(MAX_JSON + 1)
        except Exception:
            raise Failure('STORAGE_REQUEST_FAILED')
        finally:
            connection.close()
        self.budget.check()
        return response.status, data

    def list(self, bucket, prefix):
        items, page = [], None
        for _ in range(1000):
            query = {'prefix': prefix, 'maxResults': '1000', 'fields': 'items(name,generation,size,md5Hash,timeCreated),nextPageToken'}
            if page:
                query['pageToken'] = page
            status, data = self.request('GET', '/storage/v1/b/' + urllib.parse.quote(bucket, safe='') + '/o?' + urllib.parse.urlencode(query))
            need(status == 200 and len(data) <= MAX_JSON, 'STORAGE_LIST_FAILED')
            try:
                body = json.loads(data)
            except ValueError:
                raise Failure('STORAGE_LIST_FAILED')
            items += body.get('items', [])
            page = body.get('nextPageToken')
            if not page:
                return items
        raise Failure('STORAGE_LIST_TOO_LONG')

    def create(self, bucket, name, reader, size):
        path = ('/upload/storage/v1/b/' + urllib.parse.quote(bucket, safe='') + '/o?uploadType=media&name='
                + urllib.parse.quote(name, safe='') + '&ifGenerationMatch=0')
        status, data = self.request('POST', path, body=reader, headers={'Content-Type': 'application/octet-stream', 'Content-Length': str(size)})
        need(status != 412, 'MEDIA_OBJECT_EXISTS')
        need(status in (200, 201) and len(data) <= MAX_JSON, 'MEDIA_UPLOAD_FAILED')
        try:
            return json.loads(data)
        except ValueError:
            raise Failure('MEDIA_UPLOAD_FAILED')

    def download(self, bucket, item, write, size):
        """Stream one exact generation; returns (sha256 hex, md5 bytes)."""
        path = ('/storage/v1/b/' + urllib.parse.quote(bucket, safe='') + '/o/' + urllib.parse.quote(item['name'], safe='')
                + '?alt=media&generation=' + str(item['generation']))
        connection, response = self.request('GET', path, stream=True)
        try:
            need(response.status == 200 and response.getheader('x-goog-generation') == str(item['generation']), 'MEDIA_DOWNLOAD_FAILED')
            sha, md5, total = hashlib.sha256(), hashlib.md5(), 0
            while True:
                self.budget.check()
                try:
                    block = response.read(BLOCK)
                except Exception:
                    raise Failure('MEDIA_DOWNLOAD_FAILED')
                if not block:
                    break
                total += len(block)
                need(total <= size, 'MEDIA_DOWNLOAD_TOO_LARGE')
                sha.update(block)
                md5.update(block)
                write(block)
            need(total == size, 'MEDIA_DOWNLOAD_SIZE')
            return sha.hexdigest(), md5.digest()
        finally:
            connection.close()


class HashingReader:
    """http.client body: reads the open file once, exactly `size` bytes, hashing as it goes."""
    def __init__(self, fd, size, budget):
        self.fd, self.left, self.budget = fd, size, budget
        self.sha, self.md5 = hashlib.sha256(), hashlib.md5()
        os.lseek(fd, 0, os.SEEK_SET)

    def read(self, amount=BLOCK):
        self.budget.check()
        if self.left <= 0:
            return b''
        block = os.read(self.fd, min(amount, self.left, BLOCK))
        need(block, 'MEDIA_FILE_SIZE_CHANGED')
        self.left -= len(block)
        self.sha.update(block)
        self.md5.update(block)
        return block


def sidecars(items, prefix):
    """sha256 -> listed sidecar objects [(backup name, item)], newest first."""
    result = {}
    for item in items:
        name = item.get('name', '')
        if not name.startswith(prefix):
            continue
        match = SIDECAR.match(name[len(prefix):])
        if not match or not str(item.get('generation', '')).isdigit() or not str(item.get('size', '')).isdigit():
            continue
        result.setdefault(match.group(2), []).append((match.group(1), item))
    for rows in result.values():
        rows.sort(key=lambda row: (row[1].get('timeCreated', ''), int(row[1]['generation'])), reverse=True)
    return result


def upload(args, token):
    bucket, prefix = destination(args.destination)
    manifest = load_manifest(args.snapshot)
    budget = Budget(args.budget_seconds)
    storage = Storage(token, args.endpoint, budget)
    owner = None if args.owner_uid < 0 else args.owner_uid
    summary = {'status': 'complete', 'mode': 'both' if manifest['bytesIncluded'] else 'manifest', 'files': len(manifest['files']),
               'contents': len(manifest['contents']), 'bytes': sum(manifest['contents'].values()), 'uploaded': 0, 'uploadedBytes': 0}
    if manifest['files']:
        # both: the snapshot's own copy, the same bytes as the archive. manifest: the live
        # volume (container-written folders either way: never follow a link).
        media = media_directory(args.snapshot if manifest['bytesIncluded'] else args.volume, manifest['bytesIncluded'])
        try:
            send_bodies(storage, bucket, prefix, manifest, media, owner, budget, summary)
        finally:
            close_directory(media)
    close_set(storage, bucket, prefix, manifest, summary)
    budget.check()
    return summary


def media_directory(root, in_snapshot):
    parts = ['company', 'studio-media'] if in_snapshot else ['studio-media']
    if not SECURE:
        return open_directory(os.path.join(os.path.realpath(root), *parts))
    handle = open_directory(os.path.realpath(root))
    for part in parts:
        try:
            child = open_directory(part, handle)
        finally:
            close_directory(handle)
        handle = child
    return handle


def close_set(storage, bucket, prefix, manifest, summary):
    """The last object of a backup's media set: only a run that sent every body writes it."""
    name = prefix + manifest['name'] + '.media-complete'
    body = json.dumps({'schema': COMPLETE_SCHEMA, 'backup': manifest['name'], 'manifestSha256': manifest['sha256'],
                       'files': summary['files'], 'contents': summary['contents'], 'bytes': summary['bytes']}, sort_keys=True).encode()
    reply = storage.create(bucket, name, body, len(body))
    try:
        remote_md5 = base64.b64decode(reply.get('md5Hash', ''), validate=True)
    except (ValueError, TypeError):
        raise Failure('MEDIA_UPLOAD_MISMATCH')
    need(reply.get('name') == name and str(reply.get('size')) == str(len(body)) and remote_md5 == hashlib.md5(body).digest(), 'MEDIA_UPLOAD_MISMATCH')
    summary['setClosed'] = True


def send_bodies(storage, bucket, prefix, manifest, media, owner, budget, summary):
    # Every listed file must be a plain file of its listed size before anything is sent.
    for item in manifest['files']:
        os.close(open_file(media, item['diskName'], item['bytes'], owner))
    sent = set()
    for item in manifest['files']:
        sha256, size = item['sha256'], item['bytes']
        if sha256 in sent:
            continue
        fd = open_file(media, item['diskName'], size, owner)
        try:
            first_sha, first_md5, first_size = digests(fd, budget)
            need(first_sha == sha256 and first_size == size, 'MEDIA_CHANGED')
            name = prefix + manifest['name'] + '.media-' + sha256
            reader = HashingReader(fd, size, budget)
            body = storage.create(bucket, name, reader, size)
            need(reader.left == 0 and os.read(fd, 1) == b'', 'MEDIA_FILE_SIZE_CHANGED')
            try:
                remote_md5 = base64.b64decode(body.get('md5Hash', ''), validate=True)
            except (ValueError, TypeError):
                raise Failure('MEDIA_UPLOAD_MISMATCH')
            need(body.get('name') == name and str(body.get('size')) == str(size) and str(body.get('generation', '')).isdigit()
                 and reader.sha.hexdigest() == sha256 and reader.md5.digest() == first_md5 == remote_md5, 'MEDIA_UPLOAD_MISMATCH')
            summary['uploaded'] += 1
            summary['uploadedBytes'] += size
            sent.add(sha256)
        finally:
            os.close(fd)


def make_directory(path):
    try:
        os.mkdir(path, 0o700)
    except FileExistsError:
        info = os.lstat(path)
        need(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), 'TARGET_INVALID')


def place(source, target, link):
    """A hard link when asked and the file system allows it, else a private copy; never overwrite."""
    need(not os.path.lexists(target), 'TARGET_EXISTS')
    if link:
        try:
            os.link(source, target)
            return True
        except OSError:
            pass
    fd_in = os.open(source, os.O_RDONLY | BINARY)
    fd_out = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0) | BINARY, 0o600)
    try:
        while True:
            block = os.read(fd_in, BLOCK)
            if not block:
                break
            os.write(fd_out, block)
        os.fsync(fd_out)
    finally:
        os.close(fd_in)
        os.close(fd_out)
    return False


def fetch(storage, bucket, rows, size, sha256, target):
    """Newest verified copy into `target`; returns the backup it came from (None: no good copy)."""
    for backup, row in rows:
        if str(row.get('size')) != str(size):
            continue
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0) | BINARY, 0o600)
        good = False
        try:
            got_sha, got_md5 = storage.download(bucket, row, lambda block: os.write(fd, block), size)
            good = got_sha == sha256 and got_md5 == base64.b64decode(row.get('md5Hash', '') or '', validate=True)
            os.fsync(fd)
        except Failure as error:
            if str(error) == 'TIME_BUDGET':
                raise
        except (ValueError, TypeError):
            pass
        finally:
            os.close(fd)
            if not good:
                os.unlink(target)
        if good:
            return backup
    return None


def ordered(rows, own):
    """This backup's own sidecars first, then the same content kept for other backups."""
    return [row for row in rows if row[0] == own] + [row for row in rows if row[0] != own]


def hydrate(args, token):
    bucket, prefix = destination(args.source)
    manifest = load_manifest(args.snapshot)
    need(not manifest['bytesIncluded'], 'BYTES_ALREADY_INCLUDED')
    storage = Storage(token, args.endpoint)
    listed = sidecars(storage.list(bucket, prefix + 'synk-workspace-'), prefix)
    snapshot_media = os.path.join(args.snapshot, 'company', 'studio-media')
    targets = [snapshot_media] + ([os.path.join(args.prepared, 'studio-media')] if args.prepared else [])
    if args.prepared:
        info = os.lstat(args.prepared)
        need(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode), 'TARGET_INVALID')
    for folder in targets:
        make_directory(folder)
    by_sha, borrowed = {}, 0
    for item in manifest['files']:
        by_sha.setdefault(item['sha256'], []).append(item)
    for sha256, items in by_sha.items():
        rows = ordered(listed.get(sha256, []), manifest['name'])
        staging = os.path.join(snapshot_media, '.' + sha256 + '.part')
        source = fetch(storage, bucket, rows, items[0]['bytes'], sha256, staging)
        need(source is not None, 'MEDIA_OFFSITE_MISSING')
        borrowed += source != manifest['name']
        try:
            for item in items:
                for folder in targets:
                    place(staging, os.path.join(folder, item['diskName']), link=True)
        finally:
            os.unlink(staging)
    return {'status': 'hydrated', 'files': len(manifest['files']), 'contents': len(by_sha),
            'bytes': sum(manifest['contents'].values()), 'targets': len(targets), 'fromOtherBackups': borrowed}


def verify(args, token):
    bucket, prefix = destination(args.source)
    manifest = load_manifest(args.snapshot)
    storage = Storage(token, args.endpoint)
    own = prefix + manifest['name'] + '.media-'
    items = storage.list(bucket, own)
    closed = any(item.get('name') == own + 'complete' for item in items)
    listed = sidecars(items, prefix)
    missing = mismatched = 0
    for sha256, size in manifest['contents'].items():
        rows = [row for row in listed.get(sha256, []) if row[0] == manifest['name'] and str(row[1].get('size')) == str(size)]
        if not rows:
            missing += 1
            continue
        if args.download:
            good = False
            for _, row in rows:
                try:
                    got_sha, got_md5 = storage.download(bucket, row, lambda block: None, size)
                    good = got_sha == sha256 and got_md5 == base64.b64decode(row.get('md5Hash', '') or '', validate=True)
                except (Failure, ValueError, TypeError):
                    good = False
                if good:
                    break
            mismatched += not good
    return {'status': 'verified' if not (missing or mismatched) and closed else 'incomplete', 'mode': 'both' if manifest['bytesIncluded'] else 'manifest',
            'files': len(manifest['files']), 'contents': len(manifest['contents']), 'bytes': sum(manifest['contents'].values()),
            'missing': missing, 'downloaded': bool(args.download), 'mismatched': mismatched, 'setClosed': closed}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    up = commands.add_parser('upload')
    up.add_argument('--snapshot', required=True)
    up.add_argument('--volume', required=True)
    up.add_argument('--destination', required=True)
    up.add_argument('--owner-uid', type=int, default=1000)
    up.add_argument('--budget-seconds', type=float, default=1200)
    for name in ('hydrate', 'verify'):
        sub = commands.add_parser(name)
        sub.add_argument('--snapshot', required=True)
        sub.add_argument('--source', required=True)
        if name == 'hydrate':
            sub.add_argument('--prepared')
        else:
            sub.add_argument('--download', action='store_true')
    for sub in commands.choices.values():
        sub.add_argument('--endpoint', help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    try:
        os.umask(0o077)
        token = read_token()
        if args.command == 'upload':
            result = upload(args, token)
        elif args.command == 'hydrate':
            result = hydrate(args, token)
        else:
            result = verify(args, token)
        print(json.dumps(result, sort_keys=True))
        return 0 if result['status'] in ('complete', 'hydrated', 'verified') else 1
    except Failure as error:
        print('SYNK_BACKUP_MEDIA ' + str(error), file=sys.stderr)
    except Exception:
        # Paths, names and response bodies stay out of the journal.
        print('SYNK_BACKUP_MEDIA FAILED', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
