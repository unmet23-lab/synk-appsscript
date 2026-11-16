#!/usr/bin/env python3
"""Stream one live studio media body to stdout for the server-only Drive copy.

  media-read.py <company data dir> <disk name> <bytes>

The data dir is root's (the /data bind-mount source company-sources.py found);
`studio-media` and its files are written by the container, so nothing here
follows a link or blocks on a FIFO: the folder and the file are opened with
O_NOFOLLOW (the file also O_NONBLOCK) and the file must be a regular file with
one link, owned by the container user, on the same device, of the exact size.
backup.cjs checks the streamed sha256/md5 against the sidecar receipt. Exit 2
prints only `SYNK_MEDIA_READ <CODE>` on stderr.

  media-read.py <company data dir> <disk name> <bytes> <media bucket> <object> <generation>

Studio media cloud (2026-11-16): for a body the backup left in the media bucket
the three extra arguments name that object. When the volume no longer holds the
file (the server evicted it, or it was unlinked after it was opened), the body is
streamed from that exact generation with the host's metadata token instead. Only
a missing file falls back; any other problem with the local file still refuses.
"""
import os
import re
import stat
import sys
import json
import urllib.error
import urllib.parse
import urllib.request

NAME = re.compile(r'^[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)$', re.I)
CLOUD_BUCKET = re.compile(r'^synk-company-media-[0-9]{6,20}$')
CLOUD_OBJECT = re.compile(r'^studio-media/([0-9a-f-]{36}\.(?:mp4|webm|png|jpg|mp3|wav|srt|vtt|intake))(?:~[1-9][0-9]{0,3})?$')
METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
STORAGE = 'https://storage.googleapis.com/storage/v1/b/'
OWNER_UID = 1000
BLOCK = 1024 * 1024
SECURE = hasattr(os, 'O_NOFOLLOW') and os.open in os.supports_dir_fd


class Failure(Exception):
    pass


def need(condition, code):
    if not condition:
        raise Failure(code)


def open_body(data_dir, name, size, owner=OWNER_UID):
    need(NAME.match(name) and 0 <= size <= 64 * 1024 ** 3, 'ARGUMENT_INVALID')
    if not SECURE:  # the Windows test PC only; any other platform without these flags refuses
        need(os.name == 'nt', 'PLATFORM_UNSUPPORTED')
        folder = os.path.join(os.path.realpath(data_dir), 'studio-media')
        need(stat.S_ISDIR(os.lstat(folder).st_mode), 'MEDIA_FOLDER_INVALID')
        path = os.path.join(folder, name)
        try:
            mode = os.lstat(path).st_mode
        except FileNotFoundError:
            raise Failure('MEDIA_FILE_MISSING')
        need(stat.S_ISREG(mode), 'MEDIA_FILE_INVALID')
        fd, device = os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0)), os.stat(folder).st_dev
    else:
        root = os.open(os.path.realpath(data_dir), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
        try:
            folder = os.open('studio-media', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=root)
        except OSError:
            raise Failure('MEDIA_FOLDER_INVALID')
        finally:
            os.close(root)
        try:
            device = os.fstat(folder).st_dev
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
            try:
                fd = os.open(name, flags | getattr(os, 'O_NOATIME', 0), dir_fd=folder)
            except PermissionError:
                fd = os.open(name, flags, dir_fd=folder)
            except FileNotFoundError:
                raise Failure('MEDIA_FILE_MISSING')
            except OSError:
                raise Failure('MEDIA_FILE_UNREADABLE')
        finally:
            os.close(folder)
    try:
        info = os.fstat(fd)
        need(not stat.S_ISREG(info.st_mode) or info.st_nlink != 0, 'MEDIA_FILE_MISSING')  # unlinked after it was opened
        need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_dev == device, 'MEDIA_FILE_INVALID')
        need(not SECURE or info.st_uid == owner, 'MEDIA_FILE_INVALID')
        need(info.st_size == size, 'MEDIA_FILE_SIZE_CHANGED')
        if SECURE:
            import fcntl
            fcntl.fcntl(fd, fcntl.F_SETFL, fcntl.fcntl(fd, fcntl.F_GETFL) & ~os.O_NONBLOCK)
        return fd
    except BaseException:
        os.close(fd)
        raise


def stream(fd, size, out):
    left = size
    while left:
        block = os.read(fd, min(BLOCK, left))
        need(block, 'MEDIA_FILE_SIZE_CHANGED')
        out.write(block)
        left -= len(block)
    need(os.read(fd, 1) == b'', 'MEDIA_FILE_SIZE_CHANGED')


def cloud_reader(bucket, name, generation, urlopen=urllib.request.urlopen):
    """The body at that exact generation, read with the host's metadata token."""
    request = urllib.request.Request(METADATA_TOKEN, headers={'Metadata-Flavor': 'Google'})
    with urlopen(request, timeout=10) as response:
        token = json.load(response)['access_token']
    url = STORAGE + bucket + '/o/' + urllib.parse.quote(name, safe='') + '?alt=media&generation=' + generation
    try:
        response = urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token}), timeout=120)
    except urllib.error.HTTPError:
        raise Failure('MEDIA_CLOUD_UNREADABLE')
    need(response.status == 200 and response.headers.get('x-goog-generation') == generation, 'MEDIA_CLOUD_GENERATION')
    return response


def stream_cloud(response, size, out):
    with response:
        left = size
        while left:
            block = response.read(min(BLOCK, left))
            need(block, 'MEDIA_CLOUD_SIZE')
            out.write(block)
            left -= len(block)
        need(response.read(1) == b'', 'MEDIA_CLOUD_SIZE')


def main(argv, out=None, owner=OWNER_UID, urlopen=urllib.request.urlopen):
    try:
        need(len(argv) in (3, 6) and argv[2].isdigit(), 'ARGUMENT_INVALID')
        cloud = argv[3:] if len(argv) == 6 else None
        if cloud:
            match = CLOUD_OBJECT.match(cloud[1])
            need(CLOUD_BUCKET.match(cloud[0]) and match and match.group(1) == argv[1] and cloud[2].isdigit(), 'ARGUMENT_INVALID')
        try:
            fd = open_body(argv[0], argv[1], int(argv[2]), owner)
        except Failure as error:
            if str(error) != 'MEDIA_FILE_MISSING' or not cloud:
                raise
            stream_cloud(cloud_reader(cloud[0], cloud[1], cloud[2], urlopen), int(argv[2]), out or sys.stdout.buffer)
            return 0
        try:
            stream(fd, int(argv[2]), out or sys.stdout.buffer)
        finally:
            os.close(fd)
        return 0
    except Failure as error:
        print('SYNK_MEDIA_READ ' + str(error), file=sys.stderr)
    except Exception:
        print('SYNK_MEDIA_READ FAILED', file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
