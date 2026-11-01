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
"""
import os
import re
import stat
import sys

NAME = re.compile(r'^[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)$', re.I)
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
        need(stat.S_ISREG(os.lstat(path).st_mode), 'MEDIA_FILE_INVALID')
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
            except OSError:
                raise Failure('MEDIA_FILE_UNREADABLE')
        finally:
            os.close(folder)
    try:
        info = os.fstat(fd)
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


def main(argv, out=None, owner=OWNER_UID):
    try:
        need(len(argv) == 3 and argv[2].isdigit(), 'ARGUMENT_INVALID')
        fd = open_body(argv[0], argv[1], int(argv[2]), owner)
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
