#!/usr/bin/env python3
"""Keep-the-newest-N retention for one company node (static/README.md#retention).

Sent through the pinned SSH path as `sudo python3 -` with a leading
`REQUEST = {...}` line. `plan` only reads and returns what each rule would
remove plus a plan digest. `apply` recomputes the plan and removes exactly
that list only when the digest still matches. Remote copies (GCS, Drive),
HA job records, data, the running release and every image a container or the
environment names are never candidates.
"""
import hashlib, json, os, pathlib, re, shutil, socket, subprocess, sys, time

RULES = {'releases': 5, 'snapshots': 3, 'archiveDays': 14, 'archives': 10, 'stage': 2, 'restores': 1}
RELEASE = re.compile(r'^[a-f0-9]{12}$')
SNAPSHOT = re.compile(r'^synk-workspace-[0-9TZ-]+$')
ARCHIVE = re.compile(r'^(synk-workspace-[0-9TZ-]+)\.tar\.gz(\.sha256|\.uploaded)?$')
RESTORE = re.compile(r'^infra-dr-[A-Za-z0-9_.-]+$')
IMAGE_TAG = re.compile(r'^synk-company(?:-[a-z0-9-]+)?$')


class Refused(Exception):
    pass


def size(path):
    if path.is_symlink() or path.is_file():
        return path.lstat().st_size
    return sum(p.lstat().st_size for p in path.rglob('*') if not p.is_symlink() and p.is_file())


def entry(path, kind):
    info = path.lstat()
    return {'kind': kind, 'path': str(path), 'bytes': size(path), 'mtime': int(info.st_mtime)}


def newest_first(paths):
    return sorted(paths, key=lambda p: (p.lstat().st_mtime, p.name), reverse=True)


class Inventory:
    def __init__(self, root='/', docker=None, clock=time.time, current=None):
        self.root, self.clock, self.current = pathlib.Path(root), clock, current
        self.docker = docker or (lambda *args: subprocess.run(['docker', *args], capture_output=True, text=True, timeout=120, check=True).stdout)

    def p(self, path):
        return self.root / path.lstrip('/')

    def listing(self, path, pattern):
        directory = self.p(path)
        return [c for c in directory.iterdir() if pattern.match(c.name) and not c.is_symlink()] if directory.is_dir() else []

    def current_release(self):
        if self.current is not None:  # Windows test runs cannot create the link
            return self.current
        link = self.p('/opt/synk/current')
        if not link.is_symlink():
            return None
        name = pathlib.PurePosixPath(os.readlink(link)).name
        return name if RELEASE.match(name) else None

    def releases(self, keep):
        current, found = self.current_release(), newest_first(self.listing('/opt/synk/releases', RELEASE))
        kept = {p.name for p in found[:keep]} | ({current} if current else set())
        return [p for p in found if p.name in kept], [entry(p, 'release') for p in found if p.name not in kept]

    def images(self, kept_releases):
        try:
            listing = self.docker('image', 'ls', '--no-trunc', '--format', '{{json .}}')
        except FileNotFoundError:  # the HA control VM has no Docker and no company images
            return []
        rows = [json.loads(line) for line in listing.splitlines() if line.strip()]
        used = set()
        for line in self.docker('ps', '--all', '--no-trunc', '--format', '{{.ID}}').splitlines():
            if line.strip():
                used.add(self.docker('inspect', '--format', '{{.Image}}', line.strip()).strip())
        for path in ('/etc/synk/company.env',):
            text = self.p(path).read_text('utf-8') if self.p(path).exists() else ''
            used.update(m.group(1) for m in re.finditer(r'^SYNK_COMPANY_IMAGE=(\S+)$', text, re.M))
        node = self.p('/etc/synk/ha/node.json')
        if node.exists():
            used.update(c.get('imageId', '') for c in json.loads(node.read_text('utf-8')).get('containers', []))
        prefixes = {p.name for p in kept_releases}
        company = [r for r in rows if IMAGE_TAG.match(r.get('Repository') or '') and re.fullmatch(r'sha256:[a-f0-9]{64}', r.get('ID') or '')]
        # An image stays when any of its tags is in use or belongs to a kept release.
        kept = {r['ID'] for r in company if r['ID'] in used or r['Repository'] + ':' + r['Tag'] in used or any(r['Tag'].startswith(prefix) for prefix in prefixes)}
        removed, seen = [], set()
        for row in company:
            if row['ID'] in kept:
                continue
            reference = row['ID'] if row['Tag'] == '<none>' else row['Repository'] + ':' + row['Tag']
            if reference not in seen:
                seen.add(reference)
                removed.append({'kind': 'image', 'path': reference, 'image': row['ID'], 'bytes': 0, 'mtime': 0, 'created': row.get('CreatedAt')})
        return removed

    def archives(self, days, keep):
        groups = {}
        for path in self.listing('/srv/synk/backup-archives', ARCHIVE):
            groups.setdefault(ARCHIVE.match(path.name).group(1), []).append(path)
        names = sorted(groups, reverse=True)
        cutoff, removed = self.clock() - days * 86400, []
        for index, name in enumerate(names):
            members = {p.name[len(name):]: p for p in groups[name]}
            archive = members.get('.tar.gz')
            # Only an archive whose upload succeeded may leave this disk.
            if index < keep or archive is None or '.tar.gz.uploaded' not in members or archive.lstat().st_mtime >= cutoff:
                continue
            removed.extend(entry(p, 'archive') for p in sorted(groups[name]))
        return removed

    def newest(self, path, pattern, keep, kind):
        found = newest_first(self.listing(path, pattern))
        return [entry(p, kind) for p in found[keep:]]

    def plan(self, rules):
        kept, removed = self.releases(rules['releases'])
        candidates = removed + self.images(kept)
        candidates += self.newest('/srv/synk/backups', SNAPSHOT, rules['snapshots'], 'snapshot')
        candidates += self.archives(rules['archiveDays'], rules['archives'])
        candidates += self.newest('/srv/synk/stage', re.compile(r'.+'), rules['stage'], 'stage')
        candidates += self.newest('/opt/synk/ha-qa', RESTORE, rules['restores'], 'restore')
        for item in candidates:
            path = item['path']
            if item['kind'] != 'image':
                resolved = pathlib.Path(path).resolve()
                if any(str(resolved).startswith(str(self.p(guard))) for guard in ('/opt/synk/ha-maintenance', '/srv/synk/company', '/etc')):
                    raise Refused('PROTECTED_PATH')
        summary = {}
        for item in candidates:
            row = summary.setdefault(item['kind'], {'count': 0, 'bytes': 0, 'oldest': None, 'newest': None})
            row['count'] += 1
            row['bytes'] += item['bytes']
            stamp = item['mtime'] or None
            if stamp:
                row['oldest'] = min(row['oldest'] or stamp, stamp)
                row['newest'] = max(row['newest'] or stamp, stamp)
        body = json.dumps(sorted((c['kind'], c['path'], c['bytes'], c['mtime'], c.get('image')) for c in candidates), separators=(',', ':'))
        return {'status': 'planned', 'node': socket.gethostname(), 'rules': rules, 'kept': {'releases': sorted(p.name for p in kept), 'current': self.current_release()}, 'summary': summary, 'candidates': candidates, 'sha256': hashlib.sha256(body.encode()).hexdigest()}

    def apply(self, rules, expected):
        planned = self.plan(rules)
        if planned['sha256'] != expected:
            raise Refused('PLAN_CHANGED')
        done = []
        for item in planned['candidates']:
            try:
                if item['kind'] == 'image':
                    self.docker('image', 'rm', item['path'])  # never --force
                else:
                    path = pathlib.Path(item['path'])
                    shutil.rmtree(path) if path.is_dir() and not path.is_symlink() else path.unlink()
            except Exception as error:
                return {'status': 'partial', 'sha256': expected, 'removed': done, 'failed': item['path'], 'error': type(error).__name__}
            done.append(item['path'])
        return {'status': 'applied', 'sha256': expected, 'removed': len(done), 'bytes': sum(c['bytes'] for c in planned['candidates'])}


def main(request, inventory=None):
    inventory = inventory or Inventory()
    rules = {**RULES, **request.get('rules', {})}
    if request.get('op') == 'plan':
        return inventory.plan(rules)
    if request.get('op') == 'apply':
        return inventory.apply(rules, request['sha256'])
    raise Refused('EXPLICIT_OPERATION_REQUIRED')


if __name__ == '__main__':
    try:
        print(json.dumps(main(globals().get('REQUEST') or json.loads(sys.stdin.readline() or '{}'))))
    except Refused as error:
        print(json.dumps({'status': 'refused', 'code': str(error)}))
