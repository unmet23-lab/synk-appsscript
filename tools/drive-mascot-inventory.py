"""Record unchanged source bytes before a user-authorized Drive migration."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

repo = Path(__file__).resolve().parents[1]
source = (repo / 'docs' / 'Loom_자산' / '옷').resolve()
output = repo / 'docs' / '_ops' / '마스코트_Drive이관_20260910'
output.mkdir(exist_ok=True)

def record(path):
    before = path.stat()
    if before.st_file_attributes & 1024:
        raise RuntimeError('Reparse point in source: ' + str(path))
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError('Source changed while hashing: ' + str(path))
    return dict(path=path.relative_to(source).as_posix(), bytes=after.st_size,
                mtime_ns=after.st_mtime_ns, sha256=digest.hexdigest())

paths = []
for parent, dirs, files in os.walk(source, followlinks=False):
    for name in dirs:
        if (Path(parent) / name).lstat().st_file_attributes & 1024:
            raise RuntimeError('Reparse directory in source')
    paths.extend(Path(parent) / name for name in files)

records = []
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for row in pool.map(record, sorted(paths)):
        records.append(row)
        if len(records) % 500 == 0:
            print(json.dumps({'hashed': len(records), 'total': len(paths)}), flush=True)

manifest = dict(version=1, created_at=datetime.now(timezone.utc).isoformat(),
                source=str(source),
                destination='G:/내 드라이브/SYNK/대용량 자산/마스코트/20260910/옷',
                cloud_upload_verified=False, files=records,
                count=len(records), bytes=sum(r['bytes'] for r in records))
dest = output / '옷_manifest.json'
with dest.open('x', encoding='utf-8') as stream:
    json.dump(manifest, stream, ensure_ascii=False, indent=2)
print(json.dumps({'manifest': str(dest), 'files': manifest['count'],
                  'bytes': manifest['bytes']}, ensure_ascii=True), flush=True)
