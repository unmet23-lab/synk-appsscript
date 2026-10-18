"""One pinned company Caddy route change. Read-only unless --apply is explicit.

Run under systemd-run with the existing company EnvironmentFile; never parse,
copy, print, or rewrite that file here. No company image/container/data mutation.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import time
import urllib.request

BASE = Path('/opt/synk/releases/1fa6475e97eb')
CURRENT = Path('/opt/synk/current')
COMPANY = 'docs/마케팅/온라인마케팅지도/engagement/company'
CADDY = COMPANY + '/deploy/Caddyfile'
MANIFEST_SHA = '1fa6475e97ebac718af571e748dbb3e1c6996308c74801332a62cd5bbe31d4cf'
FILE_COUNT = 444
CADDY_SHA = '174fa3f1787dd51083ffc497e8507c5b9d9e8a5b28c2a9ecb46195ca9ef6d874'


def require(value, code):
    if not value:
        raise RuntimeError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def regular_tree(root):
    require(root.is_dir() and not root.is_symlink() and root.resolve() == root, 'RELEASE_PATH')
    files = set()
    for path in root.rglob('*'):
        require(not path.is_symlink(), 'RELEASE_SYMLINK')
        require(path.is_dir() or path.is_file(), 'RELEASE_SPECIAL_FILE')
        if path.is_file():
            require(path.stat().st_nlink == 1, 'RELEASE_HARDLINK')
            files.add(path.relative_to(root).as_posix())
    return files


def verify_release(root, expected_sha, expected_count):
    files = regular_tree(root)
    raw = (root / 'release-manifest.json').read_bytes()
    require(sha(raw) == expected_sha, 'MANIFEST_DRIFT')
    manifest = json.loads(raw)
    rows = manifest['files']
    require(len(rows) == expected_count, 'FILE_COUNT')
    paths = set()
    for row in rows:
        name = row['path']
        part = PurePosixPath(name)
        require(not part.is_absolute() and '..' not in part.parts and '\\' not in name and part.as_posix() == name, 'MANIFEST_PATH')
        require(name not in paths and name != 'release-manifest.json', 'MANIFEST_DUPLICATE')
        paths.add(name)
        require(name in files, 'RELEASE_FILE_MISSING')
        data = (root / name).read_bytes()
        require(len(data) == row['bytes'] and sha(data) == row['sha256'], 'RELEASE_FILE_DRIFT')
    require(files == paths | {'release-manifest.json'}, 'RELEASE_EXTRA_FILE')
    return manifest


def route_candidate(root, route, manifest_sha=MANIFEST_SHA, count=FILE_COUNT, caddy_sha=CADDY_SHA):
    baseline = verify_release(root, manifest_sha, count)
    old = (root / CADDY).read_bytes()
    require(sha(old) == caddy_sha, 'CADDY_DRIFT')
    marker = b'    reverse_proxy company:4191 {'
    require(old.count(marker) == 1 and b'spaceship' not in old, 'CADDY_LAYOUT')
    # The review covers the accompanying fixed fragment, not a user-supplied config.
    require(b'\r' not in route and b'@spaceship path /api/spaceship /api/spaceship/*' in route, 'ROUTE_FORMAT')
    inserted = b''.join(b'    ' + line + b'\n' for line in route.rstrip(b'\n').split(b'\n'))
    replacement = old.replace(marker, inserted + b'\n' + marker)
    rows = [dict(row) for row in baseline['files']]
    for row in rows:
        if row['path'] == CADDY:
            row.update(bytes=len(replacement), sha256=sha(replacement))
    changed = [b['path'] for a, b in zip(baseline['files'], rows) if a != b]
    require(changed == [CADDY], 'CADDY_ONLY_CHANGE_REQUIRED')
    candidate = {'version': 1, 'kind': 'company-spaceship-route-only-candidate',
                 'parent': str(root), 'parentManifestSHA256': manifest_sha,
                 'routeSHA256': sha(route), 'delta': [CADDY], 'files': rows,
                 'productionDeployment': False, 'officialReviewCompleted': False,
                 'notes': 'Existing company image, environment, data and container stay unchanged. Only the HTTPS container is recreated.'}
    raw = encoded(candidate)
    return {'manifest': candidate, 'raw': raw, 'sha256': sha(raw), 'caddy': replacement, 'baseline': baseline}


def stage_candidate(source, target, candidate):
    require(target.parent == source.parent and target.name == candidate['sha256'][:12], 'TARGET_PATH')
    if target.exists() or target.is_symlink():
        verify_release(target, candidate['sha256'], len(candidate['manifest']['files']))
        verify_modes(source, target)
        return
    target.mkdir(mode=0o755)
    # Never hard-link: replacing one config must not change any earlier release.
    for row in candidate['manifest']['files']:
        data = candidate['caddy'] if row['path'] == CADDY else (source / row['path']).read_bytes()
        require(sha(data) == row['sha256'], 'SOURCE_DRIFT_WHILE_STAGING')
        out = target / row['path']
        out.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        with out.open('xb') as stream:
            stream.write(data)
        out.chmod(stat.S_IMODE((source / row['path']).stat().st_mode))
    with (target / 'release-manifest.json').open('xb') as stream:
        stream.write(candidate['raw'])
    (target / 'release-manifest.json').chmod(stat.S_IMODE((source / 'release-manifest.json').stat().st_mode))
    for directory in (path for path in target.rglob('*') if path.is_dir()):
        directory.chmod(stat.S_IMODE((source / directory.relative_to(target)).stat().st_mode))
    target.chmod(stat.S_IMODE(source.stat().st_mode))
    verify_release(target, candidate['sha256'], len(candidate['manifest']['files']))
    verify_modes(source, target)


def verify_modes(source, target):
    for entry in [source, *source.rglob('*')]:
        require(stat.S_IMODE(entry.stat().st_mode) == stat.S_IMODE((target / entry.relative_to(source)).stat().st_mode), 'RELEASE_MODE_DRIFT')


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=90)
    require(result.returncode == 0, 'COMMAND_FAILED:' + args[0])
    return result.stdout.strip()


def snapshot(name):
    template = '{"id":{{json .Id}},"image":{{json .Image}},"imageRef":{{json .Config.Image}},"startedAt":{{json .State.StartedAt}},"status":{{json .State.Status}},"health":{{with (index .State "Health")}}{{json .Status}}{{else}}null{{end}},"mounts":{{json .Mounts}},"networkAddress":{{json (index .NetworkSettings.Networks "synk-company_edge").IPAddress}}}'
    info = json.loads(command(['docker', 'inspect', name, '--format', template]))
    require(info['status'] == 'running', 'CONTAINER_NOT_RUNNING')
    return info


def identity(info):
    return {key: info[key] for key in ('id', 'image', 'imageRef', 'startedAt', 'mounts', 'networkAddress')}


def compose(release, *args):
    return ['docker', 'compose', '--project-name', 'synk-company', '--file', str(release / COMPANY / 'deploy/compose.yaml'), *args]


def recreate_https(release):
    command(compose(release, 'up', '--detach', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', 'https'))


def swap_current(expected, target):
    require(CURRENT.is_symlink() and CURRENT.resolve() == expected, 'CURRENT_DRIFT')
    temp = CURRENT.with_name('current.spaceship-route-next')
    require(not temp.exists() and not temp.is_symlink(), 'CURRENT_TEMP_EXISTS')
    os.symlink(target, temp)
    os.replace(temp, CURRENT)


def transition(source, target, switch, up, check, resolve):
    """Only the route cutover and its rollback; fixture tests inject these four actions."""
    switch(source, target)
    try:
        up(target)
        check(target, True)
    except Exception as original:
        require(resolve() == target, 'ROLLBACK_CURRENT_DRIFT')
        try:
            switch(target, source)
            up(source)
            check(source, False)
        except Exception as rollback:
            raise RuntimeError('ROLLBACK_INCOMPLETE') from rollback
        raise RuntimeError('ROLLED_BACK') from original


def probe(url, expected):
    for attempt in range(10):
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                raw = response.read(8193)
                require(len(raw) <= 8192, 'HEALTH_RESPONSE_SIZE')
                data = json.loads(raw)
                if response.status == 200 and all(data.get(key) == value for key, value in expected.items()):
                    return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('HTTPS_PROBE_FAILED')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--expect-plan-sha')
    args = parser.parse_args()
    require(sys.platform == 'linux', 'LINUX_REQUIRED')
    require(CURRENT.is_symlink() and CURRENT.resolve() == BASE, 'CURRENT_DRIFT')
    require(command(['systemctl', 'show', 'synk-company.service', '-p', 'ActiveState', '--value']) == 'active', 'COMPANY_UNIT_INACTIVE')
    unit = Path('/etc/systemd/system/synk-company.service')
    require(unit.read_bytes() == (BASE / COMPANY / 'deploy/systemd/synk-company.service').read_bytes(), 'COMPANY_UNIT_DRIFT')
    require(command(['systemctl', 'show', 'synk-company.service', '-p', 'DropInPaths', '--value']) == '', 'COMPANY_UNIT_OVERRIDE')
    route = Path(__file__).with_name('Caddyfile.route').read_bytes()
    candidate = route_candidate(BASE, route)
    target = BASE.parent / candidate['sha256'][:12]
    company, https = snapshot('synk-company-company-1'), snapshot('synk-company-https-1')
    require(company['health'] == 'healthy', 'COMPANY_UNHEALTHY')
    require(company['networkAddress'] == '172.30.77.2' and https['networkAddress'] == '172.30.77.3', 'PROXY_NETWORK_DRIFT')
    mounts = [item for item in https['mounts'] if item['Destination'] == '/etc/caddy/Caddyfile']
    require(len(mounts) == 1 and mounts[0]['Source'] == str(BASE / CADDY) and not mounts[0]['RW'], 'CADDY_BIND_DRIFT')
    require(command(['docker', 'image', 'inspect', 'caddy:2-alpine', '--format', '{{.Id}}']) == https['image'], 'CADDY_IMAGE_TAG_DRIFT')
    plan = {'baseline': str(BASE), 'baselineSHA256': MANIFEST_SHA, 'candidate': str(target),
            'candidateSHA256': candidate['sha256'], 'changedFiles': [CADDY], 'files': FILE_COUNT,
            'routeSHA256': sha(route), 'company': identity(company), 'https': identity(https),
            'companyRestart': False, 'httpsRecreated': True, 'apply': False}
    plan_sha = sha(encoded(plan))
    if not args.apply:
        print(json.dumps({'planSHA256': plan_sha, 'plan': plan}, ensure_ascii=False))
        return
    require(os.geteuid() == 0 and args.expect_plan_sha == plan_sha, 'EXPLICIT_MATCHING_PLAN_REQUIRED')
    require(os.environ.get('SYNK_COMPANY_DOMAIN') == 'workspace.synk.im' and os.environ.get('SYNK_COMPANY_IMAGE') == company['imageRef'] and os.environ.get('SYNK_TLS_EMAIL'), 'INHERITED_COMPANY_ENV_REQUIRED')
    tls_mounts = {item['Destination']: item['Source'] for item in https['mounts']}
    require(tls_mounts.get('/data') == os.environ.get('CADDY_DATA_DIR', '/srv/synk/caddy-data') and tls_mounts.get('/config') == os.environ.get('CADDY_CONFIG_DIR', '/srv/synk/caddy-config'), 'TLS_VOLUME_ENV_DRIFT')
    require(command(['docker', 'image', 'inspect', company['imageRef'], '--format', '{{.Id}}']) == company['image'], 'COMPANY_IMAGE_TAG_DRIFT')
    import fcntl
    # Existing shared operation lock; do not create or replace it.
    with Path('/var/lib/synk-company-ops/operations.lock').open('r') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(CURRENT.resolve() == BASE and identity(snapshot('synk-company-company-1')) == identity(company) and identity(snapshot('synk-company-https-1')) == identity(https), 'DRIFT_BEFORE_STAGING')
        verify_release(BASE, MANIFEST_SHA, FILE_COUNT)
        spaceship = snapshot('synk-spaceship-spaceship-1')
        require(spaceship['health'] == 'healthy' and spaceship['networkAddress'] == '172.30.77.4', 'SPACESHIP_NOT_READY')
        stage_candidate(BASE, target, candidate)
        command(compose(target, 'config', '--quiet'))
        command(['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'NET_BIND_SERVICE', '--security-opt', 'no-new-privileges', '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64', '--tmpfs', '/data:rw,noexec,nosuid,size=16m', '--tmpfs', '/config:rw,noexec,nosuid,size=16m', '--mount', 'type=bind,src=' + str(target / CADDY) + ',dst=/etc/caddy/Caddyfile,readonly', '--env', 'SYNK_COMPANY_DOMAIN', '--env', 'SYNK_TLS_EMAIL', https['image'], 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
        require(CURRENT.resolve() == BASE and identity(snapshot('synk-company-company-1')) == identity(company) and identity(snapshot('synk-company-https-1')) == identity(https), 'DRIFT_BEFORE_CUTOVER')
        verify_release(BASE, MANIFEST_SHA, FILE_COUNT)
        verify_release(target, candidate['sha256'], FILE_COUNT)
        verify_modes(BASE, target)

        def check(release, with_game):
            require(CURRENT.resolve() == release and identity(snapshot('synk-company-company-1')) == identity(company), 'COMPANY_CHANGED')
            fresh = snapshot('synk-company-https-1')
            require(fresh['image'] == https['image'] and fresh['networkAddress'] == '172.30.77.3', 'CADDY_IMAGE_OR_NETWORK_CHANGED')
            mounted = [item for item in fresh['mounts'] if item['Destination'] == '/etc/caddy/Caddyfile']
            require(len(mounted) == 1 and mounted[0]['Source'] == str(release / CADDY) and not mounted[0]['RW'], 'CADDY_BIND_INCORRECT')
            expected_mounts = [{**item, **({'Source': str(release / CADDY)} if item['Destination'] == '/etc/caddy/Caddyfile' else {})} for item in https['mounts']]
            require(sorted(fresh['mounts'], key=lambda item: item['Destination']) == sorted(expected_mounts, key=lambda item: item['Destination']), 'TLS_VOLUMES_CHANGED')
            require(snapshot('synk-company-company-1')['health'] == 'healthy', 'COMPANY_UNHEALTHY')
            probe('https://workspace.synk.im/api/health', {'ok': True, 'ready': True, 'app': 'synk-company', 'workspaceIntegration': True})
            if with_game:
                probe('https://workspace.synk.im/api/spaceship/health', {'ok': True, 'service': 'spaceship-coop'})

        transition(BASE, target, swap_current, recreate_https, check, lambda: CURRENT.resolve())
        print(json.dumps({'status': 'route-applied', 'planSHA256': plan_sha, 'release': str(target), 'manifestSHA256': candidate['sha256'], 'companyUnchanged': True, 'httpsOnlyRecreated': True, 'previousReleasePreserved': True}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'failed', 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__}), file=sys.stderr)
        sys.exit(1)
