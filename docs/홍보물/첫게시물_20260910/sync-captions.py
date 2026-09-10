"""Sync one static post's approved caption pair without rebuilding its artwork.

Only the existing 20260910 delivery and its existing full ZIP are updated.
Other entry bytes are preserved and checked; no account or archive is created.
"""
from pathlib import Path
import argparse
import copy
import datetime
import hashlib
import html
import json
import re
import shutil
import zipfile

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
SOURCE = BASE.parent / '첫게시물_20260911' / '비전_소개문안.json'
FIELDS = ('caption', 'captionKo')
STRING = r'"(?:\\.|[^"\\])*"'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def decode(data):
    return json.loads(data.decode('utf-8-sig'))


def replace_fields(text, values):
    for field, value in values.items():
        pattern = re.compile(r'("' + re.escape(field) + r'"\s*:\s*)(' + STRING + r'|\d+)')
        matches = list(pattern.finditer(text))
        if len(matches) != 1:
            raise ValueError(f'Expected one {field} in selected JSON object')
        match = matches[0]
        text = text[:match.start(2)] + json.dumps(value, ensure_ascii=False) + text[match.end(2):]
    return text


def patch_object(data, key, value, fields):
    """Replace only selected value tokens, retaining all other JSON bytes."""
    text = data.decode('utf-8')
    matches = list(re.finditer(r'"' + re.escape(key) + r'"\s*:\s*' + re.escape(json.dumps(value, ensure_ascii=False)), text))
    if len(matches) != 1:
        raise ValueError(f'Expected one {key}={value}')
    start = text.rfind('{', 0, matches[0].start())
    old, length = json.JSONDecoder().raw_decode(text[start:])
    replacement = replace_fields(text[start:start + length], fields)
    expected = {**old, **fields}
    if json.loads(replacement) != expected:
        raise ValueError('Non-caption JSON fields changed')
    result = (text[:start] + replacement + text[start + length:]).encode('utf-8')
    decode(result)
    return result


def caption_file(old, caption):
    newline = '\r\n' if b'\r\n' in old else '\n'
    return (caption.replace('\r\n', '\n').replace('\n', newline) + newline).encode('utf-8')


def caption_html(old, caption):
    text = old.decode('utf-8')
    pattern = re.compile(r'(<div class="copy-text" lang="[^"]+">)(.*?)(</div>)', re.S)
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise ValueError('Expected one existing caption block')
    match = matches[0]
    escaped = html.escape(caption, quote=True).replace('&#x27;', '&#39;')
    return (text[:match.start(2)] + escaped + text[match.end(2):]).encode('utf-8')


def patch_manifest(old, changed):
    result = old
    for name, data in changed.items():
        result = patch_object(result, 'path', name, {'bytes': len(data), 'sha256': digest(data)})
    return result


def write_zip(source, target, replacements):
    hashes = {}
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, 'w') as output:
        output.comment = original.comment
        for entry in original.infolist():
            if entry.filename in replacements:
                data = replacements[entry.filename]
                output.writestr(copy.copy(entry), data)
                hashes[entry.filename] = digest(data)
            else:
                hasher = hashlib.sha256()
                with original.open(entry) as src, output.open(copy.copy(entry), 'w') as dst:
                    while chunk := src.read(1024 * 1024):
                        hasher.update(chunk)
                        dst.write(chunk)
                hashes[entry.filename] = hasher.hexdigest()
    with zipfile.ZipFile(target) as result:
        if result.namelist() != list(hashes):
            raise ValueError('ZIP entry order or names changed')
        for entry in result.infolist():
            with result.open(entry) as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != hashes[entry.filename]:
                    raise ValueError('ZIP payload changed: ' + entry.filename)
    return len(hashes) - len(replacements)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--id', required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'\d{2}-[a-z0-9-]+', args.id):
        raise ValueError('Invalid static account id')
    approved_bytes = SOURCE.read_bytes()
    entries = [x for x in decode(approved_bytes)['items']
               if x['id'] == args.id and x['collection'] == BASE.name]
    if len(entries) != 1 or any(not isinstance(entries[0].get(f), str) or not entries[0][f].strip() for f in FIELDS):
        raise ValueError('One approved caption/captionKo pair is required')
    pair = {f: entries[0][f] for f in FIELDS}
    static = BASE / '원고/static.json'
    items = decode(static.read_bytes())['items']
    selected = [x for x in items if x['id'] == args.id]
    if len(selected) != 1:
        raise ValueError('Account must already exist in 원고/static.json')
    if selected[0]['platform'] == 'Instagram' and len(pair['caption']) > 2200:
        raise ValueError('Instagram caption exceeds the existing 2200-character check')
    # This delivery currently has one full bundle. Never silently miss a new bundle.
    archive = BASE / '전체_업로드.zip'
    other_archives = [p for p in BASE.glob('*_업로드.zip') if p != archive]
    other_archives += list((BASE / args.id).glob('*.zip'))
    if other_archives:
        raise ValueError('Additional bundles require their existing packaging flow')

    originals, changes = {}, {}

    def plan(path, transform):
        old = path.read_bytes()
        originals[path] = old
        new = transform(old)
        if new != old:
            changes[path] = new
        return new

    patch_item = lambda data: patch_object(data, 'id', args.id, pair)
    plan(static, patch_item)
    transforms = {
        f'{args.id}/게시문안.txt': lambda data: caption_file(data, pair['caption']),
        f'{args.id}/게시문안_한국어뜻.txt': lambda data: caption_file(data, pair['captionKo']),
        f'{args.id}/원고.json': patch_item,
        f'{args.id}/index.html': lambda data: caption_html(data, pair['caption']),
        '콘텐츠원고.json': patch_item,
    }
    for prefix in (BASE, BASE / '전체_업로드'):
        new_entries = {}
        for name, transform in transforms.items():
            result = plan(prefix / name, transform)
            if prefix / name in changes:
                new_entries[name] = result
        if prefix != BASE and new_entries:
            plan(prefix / '파일목록.json', lambda data: patch_manifest(data, new_entries))

    archive_hash = file_hash(archive)
    replacements = {}
    with zipfile.ZipFile(archive) as bundle:
        if len(bundle.namelist()) != len(set(bundle.namelist())):
            raise ValueError('Duplicate ZIP entry names')
        for name, transform in transforms.items():
            old = bundle.read(name)
            result = transform(old)
            if result != old:
                replacements[name] = result
        if replacements:
            replacements['파일목록.json'] = patch_manifest(bundle.read('파일목록.json'), replacements)
    archive_audit = BASE / '_검토/압축검증.json'
    if replacements:
        originals[archive_audit] = archive_audit.read_bytes()
        if sum(x['file'] == archive.name for x in decode(originals[archive_audit])) != 1:
            raise ValueError('Expected one existing archive checksum record')
    paths = list(changes) + ([archive, archive_audit] if replacements else [])
    report = {'account': args.id, 'mode': 'dry-run' if args.dry_run else 'apply',
              'sourceSha256': digest(approved_bytes),
              'changedFiles': [p.relative_to(ROOT).as_posix() for p in paths],
              'changedZipEntries': list(replacements)}
    if args.dry_run or not paths:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    snapshot = ROOT / 'tmp/firstpost-caption-sync' / stamp
    before, proposed = snapshot / 'before', snapshot / 'proposed'
    baseline = {}
    for path in paths + [SOURCE]:
        relative = path.relative_to(ROOT)
        dest = before / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        baseline[path] = file_hash(dest)
    report['snapshot'] = snapshot.as_posix()
    for path, data in changes.items():
        dest = proposed / path.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    if replacements:
        dest = proposed / archive.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        report['unchangedZipEntriesVerified'] = write_zip(archive, dest, replacements)
        changes[archive_audit] = patch_object(originals[archive_audit], 'file', archive.name,
                                             {'bytes': dest.stat().st_size, 'sha256': file_hash(dest)})
        audit_dest = proposed / archive_audit.relative_to(ROOT)
        audit_dest.parent.mkdir(parents=True, exist_ok=True)
        audit_dest.write_bytes(changes[archive_audit])
    # Refuse a concurrent source/output change between planning and replacement.
    expected = {p: digest(data) for p, data in originals.items()}
    expected.update({SOURCE: digest(approved_bytes), archive: archive_hash})
    if any(file_hash(p) != sha for p, sha in expected.items()):
        raise ValueError('Source or delivery changed during caption sync; snapshot retained')
    applied = []
    try:
        for path in paths:
            (proposed / path.relative_to(ROOT)).replace(path)
            applied.append(path)
        report['files'] = [{'path': p.relative_to(ROOT).as_posix(), 'before': baseline[p],
                            'after': file_hash(p)} for p in paths]
    except Exception:
        for path in reversed(applied):
            shutil.copy2(before / path.relative_to(ROOT), path)
        raise
    (snapshot / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
