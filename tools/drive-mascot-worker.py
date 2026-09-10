"""Continue the verified mascot migration without treating partial Drive files as ready.

This is a manual migration helper, not a scheduled job. It only packs immutable
manifest rows and calls the archive tool's verify-before-reclaim operation.
Browser upload remains a separate visible step.
"""
import json
import importlib.util
import os
from pathlib import Path
import time


ARCHIVE_TOOL = Path(__file__).with_name('drive-mascot-archive.py')
_SPEC = importlib.util.spec_from_file_location('synk_drive_mascot_archive_worker', ARCHIVE_TOOL)
archive = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(archive)


MAX_STAGED_ARCHIVES = int(os.environ.get('SYNK_MAX_STAGED_ARCHIVES', '12'))
POLL_SECONDS = 10


def receipt_path(number):
    return archive.OPS / f'mascot-{number:04}.json'


def audit_path(number):
    return archive.OPS / f'mascot-{number:04}-reclaimed.jsonl'


def remote_is_ready(number):
    receipt = archive.read(receipt_path(number))
    remote = archive.REMOTE / receipt['archive']
    try:
        return remote.exists() and remote.stat().st_size == receipt['bytes']
    except OSError:
        return False


def staged_count():
    return sum(1 for _ in archive.STAGE.glob('mascot-*.zip'))


def emit(event, **data):
    print(json.dumps({'event': event, **data}, ensure_ascii=True), flush=True)


def main():
    total = len(archive.plan()['packs'])
    last_waiting = {}
    while True:
        progressed = False
        for number in range(1, total + 1):
            if not receipt_path(number).exists() or archive.reclaim_complete(number):
                continue
            if not remote_is_ready(number):
                continue
            try:
                archive.reclaim(number)
                progressed = True
                last_waiting.pop(number, None)
            except (OSError, RuntimeError) as error:
                # Drive can expose the final filename while its virtual file is
                # still settling. No source has been removed when remote digest
                # cannot be read; retry after the next poll.
                message = f'{type(error).__name__}: {error}'
                if last_waiting.get(number) != message:
                    emit('remote-not-ready', number=number, reason=message)
                    last_waiting[number] = message

        while staged_count() < MAX_STAGED_ARCHIVES:
            number = next((n for n in range(1, total + 1)
                           if not receipt_path(n).exists()), None)
            if number is None:
                break
            try:
                archive.pack(number)
                progressed = True
            except RuntimeError as error:
                emit('packing-paused', number=number, reason=str(error))
                break

        completed = sum(archive.reclaim_complete(n) for n in range(1, total + 1))
        if completed == total:
            emit('migration-complete', packs=total)
            return
        if progressed:
            emit('progress', verified_packs=completed, total_packs=total,
                 staged_archives=staged_count())
        time.sleep(POLL_SECONDS)


if __name__ == '__main__':
    main()
