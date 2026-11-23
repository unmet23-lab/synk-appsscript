#!/usr/bin/env python3
"""Refuse to start the work-backup api while an RPC pair is split (server/README.md).

synk-wb-api.service runs this as `ExecStartPre=+` (root, before the api), every time the api
starts: by host-install, by the company stack, or by a restart. The api keeps the two RPC
secrets it reads at start, and each worker keeps its own half; if the halves differ, every
api call to that worker fails with RPC_AUTH. Here the api does not start at all instead, and
the journal says which pair. The files are read through directory descriptors opened without
following links, and each must be a plain file owned by its role. No value is printed.
"""
import os, stat, sys

SRV = '/srv/synk/workbackup'
UIDS = {'api': 10771, 'keys': 10772, 'files': 10773}
PAIRS = {'wb-keys-rpc': 'keys', 'wb-files-rpc': 'files'}
DIR = os.O_RDONLY | getattr(os, 'O_DIRECTORY', 0) | getattr(os, 'O_NOFOLLOW', 0)


def read(root, role, name):
    fd = os.open(root, DIR)
    try:
        for part in (role, 'secrets'):
            nxt = os.open(part, DIR, dir_fd=fd)
            os.close(fd)
            fd = nxt
        f = os.open(name, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0), dir_fd=fd)
    finally:
        os.close(fd)
    with os.fdopen(f, 'rb') as h:
        s = os.fstat(h.fileno())
        if not (stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_uid == UIDS[role]):
            raise OSError('unsafe file: ' + role + '/' + name)
        return h.read().strip()


def split(root=SRV):
    return [name for name, worker in PAIRS.items() if read(root, 'api', name) != read(root, worker, name)]


if __name__ == '__main__':
    try:
        bad = split()
    except OSError as e:
        print('SYNK_WB_PAIR_UNREADABLE ' + type(e).__name__, file=sys.stderr)
        sys.exit(1)
    if bad:
        print('SYNK_WB_PAIR_SPLIT ' + ','.join(bad) + ' (host-install secrets --바꿈 writes a new pair)', file=sys.stderr)
        sys.exit(1)
