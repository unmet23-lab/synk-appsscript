#!/usr/bin/env python3
"""Weekly isolated restore drill on the company standby node.

`synk-company-restore-drill.timer` starts `tick` every 15 minutes. A tick
  1. once a week, after Monday 10:00 KST (and again early when the passed
     backup gets old), restores the newest complete company recovery bundle
     into a disposable folder and boots it once with network none -- the same
     checks as the release-time isolated restore -- and keeps RESULT.json as
     the proof the light rearm accepts for 8 days;
  2. turns the drill state into alerts and delivers each once to Cloud Logging
     `synk_server_backup` (event SYNK_SERVER_BACKUP_FAILED, role company, error
     RESTORE_DRILL_FAILED or RESTORE_DRILL_STALE).

While HA is busy (release, maintenance, failover) the drill waits for a later
tick and gives the node back at once. It never writes production data, HA
control state, images, tags or services, and never takes the release locks.
Buckets, node ids and reviewed tool hashes come from
/etc/synk/restore-drill/config.json on the node, never from this file.
"""
import base64, datetime, hashlib, json, os, pathlib, re, shutil, signal, stat, subprocess, sys, tarfile, time, urllib.error, urllib.parse, urllib.request

CONFIG = pathlib.Path('/etc/synk/restore-drill/config.json')
CONFIG_SCHEMA = 'synk-company-restore-drill-config/v1'
RESULT_SCHEMA = 'synk-company-restore-drill/v1'
STATE_SCHEMA = 'synk-company-restore-drill-state/v1'
DEFAULT_STATE_DIR = pathlib.Path('/var/lib/synk-restore-drill')
KST = datetime.timezone(datetime.timedelta(hours=9))
RETRY_AFTER_FAILURE = datetime.timedelta(hours=6)
# The light rearm accepts a restore proof whose backup is at most 8 days old.
# Refresh a day before the alert, and alert half a day before the rule bites.
REFRESH_AFTER = datetime.timedelta(days=6, hours=12)
STALE_AFTER = datetime.timedelta(days=7, hours=12)
NO_PASS_GRACE = datetime.timedelta(days=1)
NEWEST_BUNDLE_MAX_AGE = datetime.timedelta(days=3)
KEEP_RUNS = 8
KEEP_ACKS = 64
STATUS_FRESH_MS = 15000
WATCH_SECONDS = 30
RELEASE_LOCKS = (pathlib.Path('/run/lock/synk-ha-deploy.lock'), pathlib.Path('/var/lib/synk-company-ops/operations.lock'))
NODE = pathlib.Path('/etc/synk/ha/node.json')
STATUS_URL = 'http://127.0.0.1:4192/status'
HA_RUNTIME = ('controller.mjs', 'failover-policy.mjs', 'node-agent.mjs', 'node-host.py')
APP_SOURCES = ('server.mjs', 'store.mjs', 'synk-identity.mjs', 'customer-identity.mjs', 'teaching-service.mjs')
SOURCE_PREFIX = 'docs/마케팅/온라인마케팅지도/engagement/company/'
BUNDLE_PREFIX = 'company/production/synk-server-recovery-'
BUNDLE = re.compile(r'company/production/synk-server-recovery-[0-9TZ-]+-[0-9]+\.tar\.gz')
RUN_DIR = re.compile(r'drill-[0-9]{8}T[0-9]{6}Z-[0-9]+')
CONTAINER_PREFIX = 'synk-restore-drill-'
CONTAINER_LABEL = 'synk.restore-drill'
# Release QA on this node: never overlap it.
FOREIGN_QA = re.compile(r'synk-(compat-qa|worker-qa|infra-dr|isolated-dr)-')
PAYLOADS = ('restored', 'readonly-snapshot', 'disposable-company', 'archived-disposable-company', 'recovery.tar.gz',
            'identity-public.json', 'disaster-restore.py', 'disaster-rehearsal.mjs', 'session-proof.mjs', 'media')
MEDIA_SCHEMA = 'synk-workspace-media/v1'
MEDIA_PREFIX = 'company/production/'
MEDIA_OBJECT = re.compile(r'company/production/(synk-workspace-[0-9TZ-]+)\.media-([0-9a-f]{64})')
MEDIA_NAME = re.compile(r'[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)', re.I)
EMPLOYEE_IDENTITY = {'SYNK_ID_ACCOUNT_API_URL', 'SYNK_ID_PUBLISHABLE_KEY', 'SYNK_ID_SUPABASE_URL', 'SYNK_ID_MESSENGER_CLIENT_ID'}
CUSTOMER_IDENTITY = {'SYNK_ID_CUSTOMER_' + k for k in ('ACCOUNT_API_URL', 'PUBLISHABLE_KEY', 'SUPABASE_URL', 'CLIENT_ID', 'REDIRECT_URI')}


class Hold(Exception):
    """A check failed: this drill did not pass."""


class Defer(Exception):
    """HA is doing something else: try again at a later tick."""


def need(value, code):
    if not value:
        raise Hold(code)


def quiet(value, code):
    if not value:
        raise Defer(code)


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


def parse_time(text):
    return datetime.datetime.fromisoformat(text.replace('Z', '+00:00'))


def from_ms(value):
    return datetime.datetime.fromtimestamp(value / 1000, datetime.timezone.utc)


def digest(path, kind='sha256'):
    h = hashlib.new(kind)
    with pathlib.Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest() if kind == 'sha256' else base64.b64encode(h.digest()).decode()


def read_json(path):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except (OSError, ValueError):
        return {}


def save_json(path, value):
    """Write, fsync, rename, fsync the folder: no short file after a crash."""
    path = pathlib.Path(path)
    temporary = path.with_name(path.name + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(json.dumps(value))
        f.flush()
        os.fsync(f.fileno())
    os.replace(temporary, path)
    if os.name != 'nt':
        folder = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(folder)
        finally:
            os.close(folder)


# ---- when to run and what to tell -------------------------------------------

def week_anchor(now):
    """The most recent Monday 10:00 KST at or before `now`, in UTC."""
    local = now.astimezone(KST)
    anchor = (local - datetime.timedelta(days=local.weekday())).replace(hour=10, minute=0, second=0, microsecond=0)
    if anchor > local:
        anchor -= datetime.timedelta(days=7)
    return anchor.astimezone(datetime.timezone.utc)


def failed_after_pass(state):
    passed, failed = state.get('lastPassed'), state.get('lastFailed')
    return failed if failed and (not passed or parse_time(failed['at']) > parse_time(passed['completedAt'])) else None


def decide(state, now):
    """'run', 'refresh' (passed this week but its backup is getting old), 'done-this-week' or 'backoff'."""
    failed, passed = failed_after_pass(state), state.get('lastPassed')
    if failed and now - parse_time(failed['at']) < RETRY_AFTER_FAILURE:
        return 'backoff'
    if passed and parse_time(passed['startedAt']) >= week_anchor(now):
        return 'refresh' if now - from_ms(passed['backupCreatedAt']) >= REFRESH_AFTER else 'done-this-week'
    return 'run'


def drill_alerts(state, installed_at, now):
    """Current alerts as (error, detail, dedupe key, run id); stale first because it blocks releases."""
    alerts, passed, failed = [], state.get('lastPassed'), failed_after_pass(state)
    if passed:
        if now - from_ms(passed['backupCreatedAt']) > STALE_AFTER:
            alerts.append(('RESTORE_DRILL_STALE', 'PASSED_BACKUP_OLDER_THAN_7D12H', 'stale|' + passed['runId'], passed['runId']))
    elif now - parse_time(installed_at) > NO_PASS_GRACE:
        alerts.append(('RESTORE_DRILL_STALE', 'NO_PASSED_DRILL_SINCE_INSTALL', 'stale|never', None))
    if failed:
        anchor = week_anchor(parse_time(failed['at'])).isoformat()
        alerts.append(('RESTORE_DRILL_FAILED', failed['code'], 'failed|' + anchor + '|' + failed['code'], failed.get('runId')))
    return alerts


def alert_payload(alert, now):
    error, detail, key, run_id = alert
    event_id = hashlib.sha256(('company|restore-drill|' + key).encode()).hexdigest()
    return {'eventId': event_id, 'payload': {'event': 'SYNK_SERVER_BACKUP_FAILED', 'role': 'company', 'error': error,
                                            'detail': detail, 'runId': run_id or 'none', 'occurredAt': now.isoformat()}}


# ---- what to restore ---------------------------------------------------------

def newest_bundle(items):
    """Newest archive whose receipt sidecar was uploaded too (the uploader writes it last)."""
    names = {item['name']: item for item in items}
    archives = [item for item in items if BUNDLE.fullmatch(item['name']) and item['name'] + '.receipt.json' in names]
    need(archives, 'RECOVERY_BUNDLE_REQUIRED')
    archive = max(archives, key=lambda item: int(item['generation']))
    return archive, names[archive['name'] + '.receipt.json']


def check_receipt(receipt, archive, now):
    """The sidecar must describe exactly the listed archive. Returns the data backup time."""
    need(receipt.get('format') == 'synk-server-recovery/v1', 'RECEIPT_FORMAT')
    need(receipt.get('archiveObject') == archive['name'] and str(receipt.get('generation')) == archive['generation']
         and receipt.get('bytes') == int(archive['size']) and receipt.get('md5Hash') == archive['md5Hash'], 'RECEIPT_ARCHIVE_MISMATCH')
    need(all(re.fullmatch(r'[a-f0-9]{64}', str(receipt.get(k))) for k in ('sha256', 'releaseManifestSha256')), 'RECEIPT_HASHES')
    backup = parse_time(receipt['dataBackupCreatedAt'])
    need(parse_time(receipt['createdAt']) >= backup and backup <= now, 'RECEIPT_TIMES')
    need(now - backup <= NEWEST_BUNDLE_MAX_AGE, 'NEWEST_BACKUP_OLDER_THAN_3_DAYS')
    return backup


def public_identity(text):
    """Only the public sign-in configuration the session proof needs; never secrets."""
    allowed = EMPLOYEE_IDENTITY | CUSTOMER_IDENTITY | {'SYNK_ID_TEACHER_CLIENT_ID'}
    out, seen = {}, set()
    for line in text.splitlines():
        if '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        if key not in allowed:
            continue
        need(key not in seen, 'DUPLICATE_PUBLIC_IDENTITY_FIELD')
        seen.add(key)
        value = value.strip()
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except ValueError:
                raise Hold('PUBLIC_ENV_QUOTE')
            need(isinstance(value, str), 'PUBLIC_ENV_QUOTE')
        elif value.startswith("'"):
            need(value.endswith("'") and '\\' not in value, 'PUBLIC_ENV_QUOTE')
            value = value[1:-1]
        if key not in EMPLOYEE_IDENTITY and value == '':
            continue
        need(value and not any(c.isspace() for c in value), 'PUBLIC_ENV_VALUE')
        out[key] = value
    need(EMPLOYEE_IDENTITY <= out.keys() and len(out.keys() & CUSTOMER_IDENTITY) in (0, len(CUSTOMER_IDENTITY)), 'PUBLIC_IDENTITY_FIELDS_REQUIRED')
    return out


def count(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def session_passed(p, pins):
    """As strict as the rearm's validSessionProof (session-proof-contract.cjs), plus our source pins."""
    if not isinstance(p, dict) or p.get('sourceHashes') != pins:
        return False
    expected = {'schema': 'synk-ha-dr-session-preservation/v2', 'status': 'regional-session-proof-passed', 'protectedAccountTables': 9,
                'unchangedNonTokenAccountTables': 8, 'protectedAccountRowsPreservedExceptExpiredTokens': True,
                'activeSessionAndTokenRowsPreservedBeforeAndAfterStart': True, 'originalKeyPreservedBeforeAndAfterStart': True,
                'sourceManifestPinsMatched': True, 'clockOverridden': False, 'externalRequestAttempts': 0, 'healthReady': True}
    if any(type(p.get(k)) is not type(v) or p.get(k) != v for k, v in expected.items()):
        return False
    c = p.get('expiredTokenCleanup')
    if not isinstance(c, dict) or c.get('boundary') != 'before-server-import' or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', str(c.get('cutoffAt'))):
        return False
    if c.get('allRemovedExpiredBeforeStartup') is not True or any(c.get(k) != 0 or not count(c.get(k)) for k in ('addedRows', 'changedRows', 'unexpiredRemovedRows')):
        return False
    if not all(count(c.get(k)) for k in ('tokenRowsBefore', 'tokenRowsAfter', 'removedRows')) or c['tokenRowsBefore'] - c['tokenRowsAfter'] != c['removedRows']:
        return False
    purposes = c.get('removedByPurpose')
    if not isinstance(purposes, dict) or any(not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', k) for k in purposes) \
            or any(not count(n) or n == 0 for n in purposes.values()) or sum(purposes.values()) != c['removedRows']:
        return False
    nothing_removed = c['removedRows'] == 0
    return p.get('protectedAccountRowsPreservedBeforeAndAfterStart') is nothing_removed and p.get('sessionValuesPreservedBeforeAndAfterStart') is nothing_removed


def safe_lines(stdout):
    """JSON lines from the container; anything else is kept as text, never trusted."""
    parsed, other = [], []
    for line in stdout.splitlines():
        if line.startswith('{'):
            try:
                value = json.loads(line)
            except ValueError:
                other.append(line[:200])
                continue
            if isinstance(value, dict):
                parsed.append(value)
    return parsed, other


def changed_keys(before, after):
    """Which guard groups differ between two HA snapshots (empty when unchanged)."""
    keys = []
    if (before['control']['generation'], before['control']['sha256']) != (after['control']['generation'], after['control']['sha256']):
        keys.append('control')
    fields = ('nodeId', 'activeEpoch', 'releaseSha256', 'alive', 'ready', 'reason', 'guardsAccepted', 'stopFailed', 'activationAllowed')
    if {k: before['status'].get(k) for k in fields} != {k: after['status'].get(k) for k in fields}:
        keys.append('status')
    for name in ('protectedHashes', 'containers'):
        if before[name] != after[name]:
            keys.append(name)
    return keys


def runs_to_prune(names, keep=KEEP_RUNS, protect=()):
    """Old drill folders beyond the newest `keep`; the last passed run is always kept."""
    runs = sorted((n for n in names if RUN_DIR.fullmatch(n)), reverse=True)
    return [n for n in runs[keep:] if n not in protect]


def lock_busy(locks_text, devices):
    """Whether /proc/locks lists a lock on any of the (major, minor, inode) files."""
    for line in locks_text.splitlines():
        for token in line.split():
            m = re.fullmatch(r'([0-9a-f]+):([0-9a-f]+):([0-9]+)', token)
            if m and (int(m.group(1), 16), int(m.group(2), 16), int(m.group(3))) in devices:
                return True
    return False


# ---- the node ---------------------------------------------------------------

def metadata(key):
    request = urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/' + key, headers={'Metadata-Flavor': 'Google'})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.read().decode()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise Hold('GCS_REDIRECT_REJECTED')


OPENER = urllib.request.build_opener(NoRedirect())


def cloud(url, data=None, timeout=30):
    """Every request uses this VM's own service account, refreshed per request."""
    token = json.loads(metadata('instance/service-accounts/default/token'))['access_token']
    headers = {'Authorization': 'Bearer ' + token}
    if data is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(data).encode()
    return OPENER.open(urllib.request.Request(url, data=data, headers=headers), timeout=timeout)


def cloud_json(url, data=None):
    with cloud(url, data) as response:
        return json.loads(response.read(16 << 20))


def object_url(bucket, name):
    return 'https://storage.googleapis.com/storage/v1/b/' + bucket + '/o/' + urllib.parse.quote(name, safe='')


def list_bundles(bucket):
    base = 'https://storage.googleapis.com/storage/v1/b/' + bucket + '/o'
    items, page = [], None
    for _ in range(50):
        query = {'prefix': BUNDLE_PREFIX, 'maxResults': '1000', 'fields': 'items(name,generation,size,md5Hash,timeCreated),nextPageToken'}
        if page:
            query['pageToken'] = page
        body = cloud_json(base + '?' + urllib.parse.urlencode(query))
        items += body.get('items', [])
        page = body.get('nextPageToken')
        if not page:
            return items
    raise Hold('BUNDLE_LISTING_TOO_LONG')


def download(bucket, name, generation, target, size):
    url = object_url(bucket, name) + '?alt=media&generation=' + str(generation)
    total = 0
    with cloud(url, timeout=120) as response, target.open('xb') as output:
        need(response.status == 200 and response.headers.get('x-goog-generation') == str(generation), 'EXACT_GCS_GENERATION_REQUIRED')
        while True:
            block = response.read(1 << 20)
            if not block:
                break
            total += len(block)
            need(total <= size, 'DOWNLOAD_TOO_LARGE')
            output.write(block)
    need(total == size, 'DOWNLOAD_SIZE_MISMATCH')


# ---- studio media kept once per sha256 (deploy/backup-media.py) ---------------
# A backup made with --media=manifest lists its studio media in media-manifest.json
# and keeps each body beside its archive as company/production/<backup>.media-<sha256>
# (same 30-day life as the archive). The drill fills the restored copies from this
# backup's own sidecars, so the archived rehearsal still compares snapshot and data
# bytes; with --media=both it streams every sidecar once to prove them before media
# leaves the archives.

def media_list(manifest, integration):
    """Checked media list or None for an archive from before the list existed."""
    if manifest is None:
        need(integration.get('mediaManifest') is None and integration.get('mediaBytesIncluded') is None, 'MEDIA_LIST_MISSING')
        return None
    need(isinstance(manifest, dict) and manifest.get('schema') == MEDIA_SCHEMA and type(manifest.get('bytesIncluded')) is bool, 'MEDIA_LIST_INVALID')
    files = manifest.get('files')
    need(isinstance(files, list) and len(files) <= 100000, 'MEDIA_LIST_INVALID')
    contents, names = {}, set()
    for item in files:
        need(isinstance(item, dict) and set(item) == {'diskName', 'sha256', 'bytes'}, 'MEDIA_LIST_INVALID')
        need(isinstance(item['diskName'], str) and MEDIA_NAME.fullmatch(item['diskName']) and item['diskName'] not in names, 'MEDIA_LIST_INVALID')
        need(isinstance(item['sha256'], str) and re.fullmatch('[0-9a-f]{64}', item['sha256']), 'MEDIA_LIST_INVALID')
        need(type(item['bytes']) is int and 0 <= item['bytes'] <= 64 << 30, 'MEDIA_LIST_INVALID')
        need(contents.setdefault(item['sha256'], item['bytes']) == item['bytes'], 'MEDIA_LIST_INVALID')
        names.add(item['diskName'])
    need(integration.get('mediaCount') == len(files) and integration.get('mediaManifest') == 'media-manifest.json'
         and integration.get('mediaBytesIncluded') is manifest['bytesIncluded'], 'MEDIA_LIST_INVALID')
    return {'included': manifest['bytesIncluded'], 'files': files, 'contents': contents}


def list_media(bucket, backup):
    """sha256 -> this backup's own sidecar objects, newest first (one listing by prefix)."""
    need(re.fullmatch(r'synk-workspace-[0-9TZ-]+', backup), 'DATA_SNAPSHOT_NAME')
    base = 'https://storage.googleapis.com/storage/v1/b/' + bucket + '/o'
    items, page = [], None
    for _ in range(1000):
        query = {'prefix': MEDIA_PREFIX + backup + '.media-', 'maxResults': '1000', 'fields': 'items(name,generation,size,md5Hash,timeCreated),nextPageToken'}
        if page:
            query['pageToken'] = page
        body = cloud_json(base + '?' + urllib.parse.urlencode(query))
        items += body.get('items', [])
        page = body.get('nextPageToken')
        if not page:
            break
    else:
        raise Hold('MEDIA_LISTING_TOO_LONG')
    copies = {}
    for item in items:
        match = MEDIA_OBJECT.fullmatch(item.get('name', ''))
        if match and match.group(1) == backup and str(item.get('generation', '')).isdigit() and str(item.get('size', '')).isdigit():
            copies.setdefault(match.group(2), []).append(item)
    for rows in copies.values():
        rows.sort(key=lambda row: (row.get('timeCreated', ''), int(row['generation'])), reverse=True)
    return copies


def stream_object(bucket, item, size, write):
    """One exact generation, hashed as it streams; returns (sha256 hex, md5 base64)."""
    url = object_url(bucket, item['name']) + '?alt=media&generation=' + str(item['generation'])
    sha, md5, total = hashlib.sha256(), hashlib.md5(), 0
    with cloud(url, timeout=120) as response:
        need(response.status == 200 and response.headers.get('x-goog-generation') == str(item['generation']), 'EXACT_GCS_GENERATION_REQUIRED')
        while True:
            block = response.read(1 << 20)
            if not block:
                break
            total += len(block)
            need(total <= size, 'MEDIA_DOWNLOAD_TOO_LARGE')
            sha.update(block)
            md5.update(block)
            write(block)
    need(total == size, 'MEDIA_DOWNLOAD_SIZE')
    return sha.hexdigest(), base64.b64encode(md5.digest()).decode()


def good_copy(bucket, rows, sha256, size, target=None):
    """Newest listed copy whose bytes really are `sha256`; into `target` when given."""
    for row in rows:
        if str(row.get('size')) != str(size):
            continue
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0)
        fd = os.open(target, flags, 0o600) if target else None
        good = False
        try:
            got_sha, got_md5 = stream_object(bucket, row, size, (lambda block: os.write(fd, block)) if fd is not None else (lambda block: None))
            good = got_sha == sha256 and got_md5 == row.get('md5Hash')
        except Exception as error:  # this copy failed: try an older one, but a stop request stops
            if isinstance(error, Hold) and str(error) == 'TERMINATED':
                raise
            good = False
        finally:
            if fd is not None:
                os.close(fd)
                if not good:
                    os.unlink(target)
        if good:
            return True
    return False


def can_link(folder):
    probe = folder / '.link-probe'
    probe.write_bytes(b'')
    try:
        os.link(probe, folder / '.link-probe-2')
        os.unlink(folder / '.link-probe-2')
        return True
    except OSError:
        return False
    finally:
        probe.unlink()


def place(source, target, link):
    need(not os.path.lexists(target), 'MEDIA_TARGET_EXISTS')
    if link:
        try:
            os.link(source, target)
            return
        except OSError:
            pass
    shutil.copyfile(source, target)
    os.chmod(target, 0o600)


def media_step(bucket, run_dir, snapshot, data_dirs, backup):
    """Fill or prove the restored studio media; returns the report's `media` part."""
    manifest_file = snapshot / 'media-manifest.json'
    integration = json.loads(inside(snapshot, 'integration-manifest.json').read_text())
    manifest = json.loads(inside(snapshot, 'media-manifest.json').read_text()) if manifest_file.exists() else None
    media = media_list(manifest, integration)
    if media is None:
        return {'mode': 'absent'}
    contents, total = media['contents'], sum(media['contents'].values())
    report = {'files': len(media['files']), 'contents': len(contents), 'bytes': total}
    snapshot_media = snapshot / 'company' / 'studio-media'
    copies = list_media(bucket, backup) if contents else {}
    if media['included']:
        for item in media['files']:
            need(digest(inside(snapshot_media.parent, 'studio-media/' + item['diskName'])) == item['sha256'], 'MEDIA_LIST_BYTES_MISMATCH')
        for sha256, size in contents.items():
            need(good_copy(bucket, copies.get(sha256, []), sha256, size), 'MEDIA_OFFSITE_MISSING')
        return dict(report, mode='included', offsiteVerified=True)
    data_media = [folder / 'studio-media' for folder in data_dirs]
    need(not any(os.path.lexists(folder) for folder in [snapshot_media] + data_media), 'MEDIA_LIST_WITH_BYTES')
    staging = run_dir / 'media'
    staging.mkdir(mode=0o700)
    linked = can_link(staging)
    free = shutil.disk_usage(run_dir).free
    # The snapshot gets its own copy, so the rehearsal still compares two separate copies;
    # the two throwaway volumes share the verified download when the disk allows it.
    # Without links every name is a full copy: the download plus three per file.
    per_file = sum(item['bytes'] for item in media['files'])
    need(free > (2 * total if linked else total + 3 * per_file) + 1024 ** 3, 'STANDBY_DRILL_MEDIA_SPACE_LOW')
    for folder in [snapshot_media] + data_media:
        folder.mkdir(mode=0o700)
    for sha256, size in contents.items():
        body = staging / sha256
        need(good_copy(bucket, copies.get(sha256, []), sha256, size, body), 'MEDIA_OFFSITE_MISSING')
        own = None  # names with the same content share the snapshot's own copy
        for item in media['files']:
            if item['sha256'] == sha256:
                target = snapshot_media / item['diskName']
                place(own or body, target, link=own is not None)
                own = own or target
                for folder in data_media:
                    place(body, folder / item['diskName'], link=True)
    for item in media['files']:  # the separate snapshot copy must still be what the list says
        need(digest(snapshot_media / item['diskName']) == item['sha256'], 'MEDIA_COPY_MISMATCH')
    return dict(report, mode='external', offsiteVerified=True, linked=linked, freeBytesBeforeMedia=free)


def run(args, timeout=60):
    process = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    need(process.returncode == 0, 'COMMAND_FAILED')
    return process.stdout.strip()


def read_status():
    try:
        response = urllib.request.urlopen(STATUS_URL, timeout=10)
    except urllib.error.HTTPError as error:
        response = error  # a standby answers 503 with the same JSON body
    with response:
        return json.load(response)


def node_status():
    """The local HA agent's view; an agent that does not answer means HA is busy, not a failed drill."""
    try:
        return read_status()
    except (OSError, ValueError):
        raise Defer('STANDBY_STATUS_UNREADABLE')


def read_control(cfg):
    url = object_url(cfg['controlBucket'], cfg['controlObject'])
    generation = cloud_json(url + '?fields=generation')['generation']
    value = cloud_json(url + '?alt=media&generation=' + generation)
    canonical = json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
    return {'generation': generation, 'sha256': hashlib.sha256(canonical).hexdigest(), 'value': value}


def protected_paths(node):
    paths = ['/etc/synk/ha/node.json', '/etc/synk/ha/plan.json', node['releaseRoot'] + '/release-manifest.json', '/etc/fstab']
    paths += [row['path'] for row in node['guardFiles'] + node['envFiles']]
    paths += ['/opt/synk/ha/' + name for name in HA_RUNTIME]
    return sorted(set(paths))


def container_names():
    return run(['docker', 'ps', '-a', '--format', '{{.Names}}']).splitlines()


def production_containers(node, names):
    found = sorted({c['name'] for c in node['containers']} & set(names))
    rows = json.loads(run(['docker', 'inspect', *found])) if found else []
    return [{'id': r['Id'], 'image': r['Image'], 'startedAt': r['State']['StartedAt'], 'running': r['State']['Running']} for r in rows]


def release_locks_free():
    """Read /proc/locks instead of taking a lock: a release must never meet ours (LOCK_EX|LOCK_NB fails on any holder)."""
    devices = set()
    for lock in RELEASE_LOCKS:
        try:
            st = os.stat(lock, follow_symlinks=False)
        except FileNotFoundError:
            continue
        devices.add((os.major(st.st_dev), os.minor(st.st_dev), st.st_ino))
    if not devices:
        return True
    try:
        text = pathlib.Path('/proc/locks').read_text()
    except OSError:
        raise Hold('PROC_LOCKS_UNREADABLE')
    return not lock_busy(text, devices)


def ha_snapshot(cfg):
    node = json.loads(NODE.read_text())
    names = container_names()
    mounted = subprocess.run(['mountpoint', '-q', '/srv/synk'], capture_output=True, timeout=5).returncode
    found = subprocess.run(['findmnt', '-rn', '-M', '/srv/synk'], capture_output=True, text=True, timeout=5)
    return {
        'node': node,
        'status': node_status(),
        'control': read_control(cfg),
        'protectedHashes': {path: digest(path) for path in protected_paths(node)},
        'containers': production_containers(node, names),
        'foreignQa': sorted(n for n in names if FOREIGN_QA.match(n)),
        'dataUnmounted': mounted == 32 and found.returncode == 1 and not found.stdout.strip(),
    }


def standby_quiet(status, before_status, now_ms):
    quiet(status.get('nodeId') == before_status.get('nodeId') and status.get('reason') == 'STANDBY' and status.get('ready') is False
          and status.get('alive') is True and status.get('guardsAccepted') is True and status.get('stopFailed') is False, 'STANDBY_NOT_IDLE')
    quiet(0 <= now_ms - status.get('at', 0) <= STATUS_FRESH_MS, 'STANDBY_STATUS_NOT_FRESH')
    quiet(status.get('activationAllowed') is True, 'HA_NOT_ARMED')
    quiet(status.get('activeEpoch') == before_status.get('activeEpoch'), 'OWNER_CHANGED')


def require_quiet(snapshot, cfg, now_ms):
    """Hold when this is not the configured standby; Defer while HA is busy."""
    node, status, control = snapshot['node'], snapshot['status'], snapshot['control']['value']
    need(node['nodeId'] == cfg['standbyNodeId'] and status.get('nodeId') == node['nodeId'], 'STANDBY_NODE_REQUIRED')
    standby_quiet(status, status, now_ms)
    quiet(control.get('activeId') == cfg['ownerNodeId'] and control.get('activeEpoch') == status.get('activeEpoch'), 'OWNER_CHANGED')
    quiet(control.get('maintenanceUntil', 0) == 0 and all(control.get(k) is None for k in ('operation', 'deployment', 'command', 'api', 'runner')), 'HA_CONTROL_BUSY')
    quiet(snapshot['dataUnmounted'], 'REGIONAL_DATA_MOUNTED_ON_STANDBY')
    quiet(not any(c['running'] for c in snapshot['containers']), 'STANDBY_CONTAINERS_RUNNING')
    quiet(not snapshot['foreignQa'], 'RELEASE_QA_RUNNING')
    quiet(release_locks_free(), 'RELEASE_LOCK_HELD')


def still_quiet(cfg, before):
    """HA moved (release, failover) -> Defer; a guarded file or container changed while HA stayed idle -> Hold."""
    after = ha_snapshot(cfg)
    require_quiet(after, cfg, int(time.time() * 1000))
    moved = changed_keys(before, after)
    quiet('control' not in moved and 'status' not in moved, 'HA_CHANGED_DURING_DRILL')
    need('protectedHashes' not in moved, 'STANDBY_PROTECTED_FILES_CHANGED')
    need('containers' not in moved, 'STANDBY_CONTAINERS_CHANGED')
    return after


def busy_now(before):
    """A cheap check while a long step runs."""
    standby_quiet(node_status(), before['status'], int(time.time() * 1000))
    quiet(not any(FOREIGN_QA.match(n) for n in container_names()), 'RELEASE_QA_RUNNING')
    quiet(release_locks_free(), 'RELEASE_LOCK_HELD')


def run_watched(args, timeout, before, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL):
    """Run a long step in its own process group; give the node back at once if HA starts to need it."""
    process = subprocess.Popen(args, stdout=stdout, stderr=stderr, text=True, start_new_session=True)
    deadline = time.monotonic() + timeout
    try:
        while True:
            try:
                out, _ = process.communicate(timeout=WATCH_SECONDS)
                return process.returncode, out or ''
            except subprocess.TimeoutExpired:
                need(time.monotonic() < deadline, 'STEP_TIMEOUT')
                busy_now(before)
    finally:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(30)


def inside(base, relative):
    """A file the root process reads from the restored tree: no link on any part of the way."""
    target = base
    for part in pathlib.PurePosixPath(relative).parts:
        need(part not in ('/', '.', '..'), 'RESTORED_PATH_ESCAPE')
        target = target / part
        need(not target.is_symlink(), 'RESTORED_PATH_ESCAPE')
    need(target.is_file(), 'RESTORED_PATH_ESCAPE')
    return target


def plain_tree(target):
    """Only plain files and folders (one lstat each): what root reads, copies and hands to uid 1000."""
    need(stat.S_ISDIR(target.lstat().st_mode), 'PLAIN_TREE_REQUIRED')
    for item in target.rglob('*'):
        mode = item.lstat().st_mode
        need(stat.S_ISREG(mode) or stat.S_ISDIR(mode), 'LINK_OR_SPECIAL_FILE_IN_RESTORE')


def chown_tree(target):
    os.chown(target, 1000, 1000, follow_symlinks=False)
    for item in target.rglob('*'):
        os.chown(item, 1000, 1000, follow_symlinks=False)


def remove(parent, target):
    need(target.parent == parent, 'REMOVE_PATH_ESCAPE')
    if target.is_symlink() or not target.is_dir():
        target.unlink()
    else:
        shutil.rmtree(target)  # unlinks links inside without following them


def clean_payloads(run_dir):
    """Remove this run's restored copies and download; keep the small evidence files. Tries every item."""
    removed, failed = [], []
    for name in PAYLOADS:
        target = run_dir / name
        if target.exists() or target.is_symlink():
            try:
                remove(run_dir, target)
                removed.append(name)
            except (OSError, Hold):
                failed.append(name)
    need(not failed, 'PAYLOAD_CLEANUP_FAILED')
    return removed


def remove_left_containers():
    rows = run(['docker', 'ps', '-a', '--filter', 'label=' + CONTAINER_LABEL, '--format', '{{.ID}} {{.Names}}']).splitlines()
    for row in rows:
        container, name = row.split(' ', 1)
        if name.startswith(CONTAINER_PREFIX):
            subprocess.run(['docker', 'rm', '--force', container], capture_output=True, timeout=30)
    need(not any(n.startswith(CONTAINER_PREFIX) for n in container_names()), 'LEFT_DRILL_CONTAINER')


def progress(run_dir, stage):
    save_json(run_dir / 'PROGRESS.json', {'stage': stage, 'at': utcnow().isoformat(), 'pid': os.getpid()})


# ---- one drill ----------------------------------------------------------------

def bootstrap_from(archive):
    """The first disaster-restore.py member, read without decompressing the whole archive."""
    with tarfile.open(archive, 'r:gz') as source:
        for member in source:
            if member.name == 'disaster-restore.py':
                need(member.isfile() and member.size < 100000, 'BOOTSTRAP_TYPE')
                return source.extractfile(member).read()
    raise Hold('BOOTSTRAP_MISSING')


def restore(cfg, run_dir, before, report, archive_item, sidecar_item):
    """Download, verify, prepare offline and boot once with network none."""
    bucket = cfg['backupBucket']
    need(int(sidecar_item['size']) <= 1 << 20, 'RECEIPT_TOO_LARGE')
    progress(run_dir, 'download-receipt')
    receipt_file = run_dir / 'receipt.json'
    download(bucket, sidecar_item['name'], sidecar_item['generation'], receipt_file, int(sidecar_item['size']))
    need(digest(receipt_file, 'md5') == sidecar_item['md5Hash'], 'RECEIPT_MD5_MISMATCH')
    receipt = json.loads(receipt_file.read_text())
    backup_at = check_receipt(receipt, archive_item, utcnow())
    release = receipt['releaseManifestSha256']
    report.update({'archive': {'object': receipt['archiveObject'], 'generation': receipt['generation'], 'bytes': receipt['bytes'],
                               'sha256': receipt['sha256'], 'sidecarGeneration': sidecar_item['generation']},
                   'receiptSha256': digest(receipt_file), 'dataBackupCreatedAt': receipt['dataBackupCreatedAt'],
                   'backupCreatedAt': int(backup_at.timestamp() * 1000), 'releaseSha256': release})
    free = shutil.disk_usage(run_dir.parent).free
    need(free > 12 * receipt['bytes'] + 2 * 1024 ** 3, 'STANDBY_DRILL_SPACE_LOW')
    report['freeBytesBefore'] = free

    progress(run_dir, 'download-archive')
    archive = run_dir / 'recovery.tar.gz'
    download(bucket, receipt['archiveObject'], receipt['generation'], archive, receipt['bytes'])
    need(digest(archive) == receipt['sha256'] and digest(archive, 'md5') == receipt['md5Hash'], 'ARCHIVE_INTEGRITY_MISMATCH')
    body = bootstrap_from(archive)
    bootstrap_sha = hashlib.sha256(body).hexdigest()
    need(bootstrap_sha in cfg['restoreSha256'], 'REVIEWED_BOOTSTRAP_REQUIRED')
    bootstrap = run_dir / 'disaster-restore.py'
    bootstrap.write_bytes(body)
    bootstrap.chmod(0o600)

    still_quiet(cfg, before)
    progress(run_dir, 'offline-prepare')
    prepared = run_dir / 'restored'
    with (run_dir / 'prepare.stderr').open('w') as stderr:
        code, out = run_watched(['python3', '-B', str(bootstrap), 'prepare', str(archive), '--sha256', receipt['sha256'], '--destination', str(prepared)],
                                3600, before, stderr=stderr)
    need(code == 0, 'OFFLINE_PREPARE_FAILED')
    offline = json.loads(out)
    need(offline.get('haDependencyClosureVerified') is True and offline.get('haAutomaticActivationAllowed') is False
         and offline.get('cloudAuthorityRestored') is False and offline.get('livePathsWritten') == 0 and offline.get('servicesStarted') == 0, 'OFFLINE_INERT_CONTRACT')
    report['offlinePrepare'] = offline
    plain_tree(prepared)  # nothing below may be a link or a special file, so every later read and copy stays inside

    manifest = json.loads(inside(prepared, 'recovery-manifest.json').read_text())
    ha = manifest['haRecovery']
    need(manifest.get('captureSchema') == 'synk-server-recovery-capture/v2' and manifest.get('releaseManifestSha256') == release
         and ha.get('releaseSha256') == release and ha.get('nodeId') == cfg['ownerNodeId']
         and ha.get('automaticActivationAllowed') is False and ha.get('cloudAuthorityRestored') is False, 'CAPTURE_IDENTITY')
    host = prepared / 'host'
    archived_node = json.loads(inside(host, 'etc/synk/ha/node.json').read_text())
    need(archived_node.get('releaseSha256') == release, 'ARCHIVED_NODE_RELEASE')
    release_manifest = inside(host, archived_node['releaseRoot'].lstrip('/') + '/release-manifest.json')
    need(digest(release_manifest) == release, 'EXACT_RELEASE_MANIFEST')
    files = json.loads(release_manifest.read_text())['files']
    need(isinstance(files, list) and files, 'RELEASE_FILES')
    marker = json.loads(inside(host, 'srv/synk/HA_VOLUME_IDENTITY.json').read_text())
    node = before['node']
    need(marker.get('diskId') == node['diskId'] and marker.get('filesystemUuid') == node['filesystemUuid'], 'REGIONAL_VOLUME_IDENTITY')
    key = node['originalKeySha256']
    need(archived_node.get('originalKeySha256') == key and ha.get('originalKeySha256') == key, 'ORIGINAL_KEY_CONTRACT')
    need(digest(inside(prepared, 'prepared-company/encryption.key')) == key, 'ORIGINAL_KEY_BYTES')
    fstab = digest(inside(host, 'etc/fstab'))
    need(fstab == cfg['expectedFstabSha256'], 'CORRECTED_FSTAB_NOT_CAPTURED')
    runtime_dir = host / 'opt/synk/ha'
    need(runtime_dir.is_dir() and not runtime_dir.is_symlink(), 'HA_RUNTIME_NOT_CAPTURED')
    captured = {'opt/synk/ha/' + p.name: digest(p) for p in sorted(runtime_dir.iterdir()) if p.is_file()}
    need(all('opt/synk/ha/' + name in captured for name in HA_RUNTIME), 'HA_RUNTIME_NOT_CAPTURED')
    envfile = inside(host, 'etc/synk/company.env')
    env_rows = [row for row in archived_node['envFiles'] if row['path'] == '/etc/synk/company.env']
    need(len(env_rows) == 1 and digest(envfile) == env_rows[0]['sha256'], 'CAPTURED_ENV_HASH')
    pins = {}
    for name in APP_SOURCES:
        rows = [row for row in files if row.get('path') == SOURCE_PREFIX + name]
        need(len(rows) == 1, 'APP_SOURCE_MANIFEST_ENTRY')
        pins[name] = rows[0]['sha256']
    recovery = host / 'opt/synk/disaster-recovery'
    helpers = sorted(recovery.glob('*/disaster-rehearsal.mjs')) if recovery.is_dir() and not recovery.is_symlink() else []
    need(len(helpers) == 1 and not helpers[0].is_symlink() and helpers[0].is_file() and digest(helpers[0]) in cfg['rehearsalSha256'], 'REVIEWED_REHEARSAL_REQUIRED')
    images = [item for item in manifest['images'] if item.get('container') == 'synk-company-company-1']
    need(len(images) == 1, 'EXACT_COMPANY_IMAGE')
    for item in manifest['images']:  # never docker load or retag: every image must already be here
        inspected = subprocess.run(['docker', 'image', 'inspect', item['imageId']], capture_output=True, text=True, timeout=30)
        need(inspected.returncode == 0 and json.loads(inspected.stdout)[0]['Id'] == item['imageId'], 'BACKUP_IMAGE_NOT_ON_STANDBY')
    report.update({'releaseFiles': len(files), 'haRequiredFiles': len(ha['requiredFiles']), 'correctedFstabSha256': fstab,
                   'capturedProtectedHashes': captured, 'regionalVolumeIdentityMatched': True, 'originalKeySha256': key,
                   'originalKeyMatchesBothCapturedAndStandbyNode': True, 'companyImage': images[0]['imageId']})

    progress(run_dir, 'disposable-copies')
    snapshots_dir = prepared / 'data-snapshots'
    need(snapshots_dir.is_dir() and not snapshots_dir.is_symlink(), 'EXACTLY_ONE_SNAPSHOT')
    snapshots = list(snapshots_dir.iterdir())
    need(len(snapshots) == 1, 'EXACTLY_ONE_SNAPSHOT')
    snapshot = run_dir / 'readonly-snapshot'
    shutil.copytree(snapshots[0], snapshot, symlinks=True)
    data, data_archived = run_dir / 'disposable-company', run_dir / 'archived-disposable-company'
    for target in (data, data_archived):
        shutil.copytree(prepared / 'prepared-company', target, symlinks=True)
    for target in (snapshot, data, data_archived):
        plain_tree(target)
    progress(run_dir, 'studio-media')
    # A list-only backup gets its bodies from its GCS sidecars: a separate copy in the
    # snapshot, one shared copy for the two throwaway volumes.
    report['media'] = media_step(cfg['backupBucket'], run_dir, snapshot, (data, data_archived), snapshots[0].name)
    for target in (data, data_archived):
        inside(target, 'PREPARATION_INCOMPLETE').unlink()
    for target in (snapshot, data, data_archived):
        chown_tree(target)
    pin_file = run_dir / 'source-pins.json'
    pin_file.write_text(json.dumps({'schema': 'synk-ha-dr-application-sources/v1', 'releaseSha256': release, 'sourceHashes': pins}))
    public = run_dir / 'identity-public.json'
    identity = public_identity(envfile.read_text())
    public.write_text(json.dumps(identity, sort_keys=True))
    rehearsal_file = run_dir / 'disaster-rehearsal.mjs'
    shutil.copyfile(helpers[0], rehearsal_file)
    session_file = run_dir / 'session-proof.mjs'
    shutil.copyfile(cfg['sessionProof']['path'], session_file)
    need(digest(session_file) == cfg['sessionProof']['sha256'], 'SESSION_PROOF_SHA')
    for target in (pin_file, public, rehearsal_file, session_file):
        os.chown(target, 1000, 1000)
        target.chmod(0o400)

    still_quiet(cfg, before)
    progress(run_dir, 'network-isolated-startup-and-session-proof')
    image = images[0]['imageId']
    name = CONTAINER_PREFIX + run_dir.name
    need(name not in container_names(), 'NEW_QA_CONTAINER_REQUIRED')
    command = ['docker', 'run', '--pull', 'never', '--name', name, '--label', CONTAINER_LABEL + '=' + run_dir.name,
               '--network', 'none', '--read-only', '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
               '--pids-limit', '128', '--memory', '512m', '--cpus', '0.5', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m']
    for source, guest, mode in ((snapshot, '/snapshot', 'ro'), (data, '/data', 'rw'), (data_archived, '/data-archived', 'rw'),
                                (public, '/qa/identity-public.json', 'ro'), (pin_file, '/qa/source-pins.json', 'ro'),
                                (rehearsal_file, '/qa/disaster-rehearsal.mjs', 'ro'), (session_file, '/qa/regional-dr-session-proof.mjs', 'ro')):
        need(source.parent == run_dir and source.resolve() == source and not source.is_symlink(), 'QA_BIND_MOUNT_ESCAPE')
        command += ['-v', str(source) + ':' + guest + ':' + mode]
    command += ['-e', 'SYNK_DR_NETWORK_ISOLATED=1', '--entrypoint', 'node', image, '/qa/regional-dr-session-proof.mjs']
    try:
        exit_code, stdout = run_watched(command, 600, before)
    finally:
        left = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True, timeout=15)
        if left.returncode == 0:
            row = json.loads(left.stdout)[0]
            need(row['Name'] == '/' + name and row['Image'] == image and row['Config']['Labels'].get(CONTAINER_LABEL) == run_dir.name
                 and row['HostConfig']['NetworkMode'] == 'none' and row['Config']['User'] == '1000:1000', 'QA_CONTAINER_CLEANUP_IDENTITY')
            subprocess.run(['docker', 'rm', '--force', row['Id']], capture_output=True, timeout=30)
    safe, other = safe_lines(stdout)
    save_json(run_dir / 'QA.json', {'exitCode': exit_code, 'safeOutput': safe, 'otherLines': other[:20]})
    rehearsal = next((x for x in safe if x.get('status') == 'isolated-restore-startup-passed'), None)
    sessions = next((x for x in safe if x.get('status') == 'regional-session-proof-passed'), None)
    report.update({'rehearsal': rehearsal, 'sessionProof': sessions, 'rehearsalExit': exit_code,
                   'qaContainersRemoved': name not in container_names(), 'network': 'none', 'uid': 1000, 'publishedPorts': 0,
                   'productionEnvFilePassed': False, 'publicIdentityFieldNames': sorted(identity)})
    need(exit_code == 0 and rehearsal, 'ISOLATED_RESTORE_STARTUP_FAILED')
    need(session_passed(sessions, pins), 'STRICT_SESSION_PRESERVATION_REQUIRED')
    need(report['qaContainersRemoved'], 'QA_CONTAINER_NOT_REMOVED')
    need(inside(prepared, 'prepared-company/PREPARATION_INCOMPLETE').is_file(), 'INERT_PREPARATION_MARKER_REMOVED')
    need(digest(archive) == receipt['sha256'], 'DOWNLOADED_ARCHIVE_CHANGED')
    report.update({'originalPreparedMarkerPreserved': True, 'archiveUnchanged': True,
                   'runner': {'sha256': digest(__file__), 'configSha256': digest(CONFIG), 'bootstrapSha256': bootstrap_sha,
                              'rehearsalSha256': digest(rehearsal_file), 'sessionProofSha256': cfg['sessionProof']['sha256']}})


def prepare_root(cfg, protect):
    """Private folder on the OS disk; leftovers of a killed run (payloads, container) go first."""
    root = pathlib.Path(cfg['root'])
    need(root.parent.is_dir() and root.parent.resolve() == root.parent and root.parent.stat().st_uid == 0
         and not root.parent.stat().st_mode & 0o022 and root.parent.stat().st_dev == pathlib.Path('/').stat().st_dev, 'PRIVATE_OS_DISK_PARENT_REQUIRED')
    root.mkdir(mode=0o700, exist_ok=True)
    need(root.stat().st_uid == 0 and not root.is_symlink() and not root.stat().st_mode & 0o077, 'PRIVATE_DRILL_ROOT_REQUIRED')
    remove_left_containers()
    for old in root.iterdir():
        if RUN_DIR.fullmatch(old.name) and old.is_dir() and not old.is_symlink():
            clean_payloads(old)
    for name in runs_to_prune([p.name for p in root.iterdir()], protect=protect):
        remove(root, root / name)
    return root


def attempt(cfg, state, now, refresh=False):
    state_dir = pathlib.Path(cfg['stateDir'])
    run_id = now.strftime('%Y%m%dT%H%M%SZ')
    record = {'at': now.isoformat(), 'runId': run_id}
    passed = state.get('lastPassed') or {}
    try:
        need(metadata('instance/id') == cfg['standbyNodeId'], 'STANDBY_INSTANCE_REQUIRED')
        need(metadata('instance/service-accounts/default/email') == cfg['serviceAccount'], 'VM_SERVICE_ACCOUNT_REQUIRED')
        before = ha_snapshot(cfg)
        require_quiet(before, cfg, int(time.time() * 1000))
        archive_item, sidecar_item = newest_bundle(list_bundles(cfg['backupBucket']))
        if refresh and int(archive_item['generation']) <= int(passed['archiveGeneration']):
            return {'status': 'refresh-waits-for-a-newer-backup'}
        root = prepare_root(cfg, {pathlib.Path(passed.get('result', '/none/none')).parent.name})
    except Defer as error:
        state['lastAttempt'] = dict(record, status='deferred', code=str(error))
        save_json(state_dir / 'state.json', state)
        return {'status': 'deferred', 'code': str(error)}
    except Exception as error:
        code = str(error) if isinstance(error, Hold) else 'PRECHECK_' + type(error).__name__.upper()
        state['lastFailed'] = dict(record, code=code)
        state['lastAttempt'] = dict(record, status='failed', code=code)
        save_json(state_dir / 'state.json', state)
        return {'status': 'failed', 'code': code}

    run_dir = root / ('drill-' + run_id + '-' + archive_item['generation'])
    run_dir.mkdir(mode=0o700)
    report = {'schema': RESULT_SCHEMA, 'status': 'pending', 'runId': run_id, 'startedAt': now.isoformat(),
              'standbyNodeId': cfg['standbyNodeId'], 'ownerNodeId': cfg['ownerNodeId'],
              'haBefore': {'controlGeneration': before['control']['generation'], 'controlSha256': before['control']['sha256'],
                           'activeEpoch': before['status'].get('activeEpoch'), 'standbyReleaseSha256': before['status'].get('releaseSha256')},
              'productionServicesChanged': False, 'liveDataWritten': False, 'haStateWritten': False, 'cloudAuthorityRestored': False,
              'imagesLoadedOrRetagged': False, 'newVmProvisioned': False, 'realUserLoginTest': False}
    outcome = {}
    try:
        restore(cfg, run_dir, before, report, archive_item, sidecar_item)
        still_quiet(cfg, before)
        progress(run_dir, 'passed-cleaning-payloads')
        report['ownPayloadsCleaned'] = clean_payloads(run_dir)
        after = still_quiet(cfg, before)  # once more after cleanup, as the release-time restore did
        report.update({'status': 'passed', 'completedAt': utcnow().isoformat(), 'freeBytesAfter': shutil.disk_usage(root).free,
                       'standbyConfigRuntimeGuardEnvUnchanged': True, 'standbyProductionContainersUnchanged': True, 'haControlUnchanged': True,
                       'haAfter': {'controlGeneration': after['control']['generation'], 'activeEpoch': after['status'].get('activeEpoch')}})
        save_json(run_dir / 'RESULT.json', report)
        result_sha = digest(run_dir / 'RESULT.json')
        save_json(state_dir / 'latest-passed.json', report)
        state['lastPassed'] = {'runId': run_id, 'startedAt': report['startedAt'], 'completedAt': report['completedAt'],
                               'backupCreatedAt': report['backupCreatedAt'], 'releaseSha256': report['releaseSha256'],
                               'archiveGeneration': report['archive']['generation'], 'result': str(run_dir / 'RESULT.json'),
                               'resultSha256': result_sha}
        state['lastAttempt'] = dict(record, status='passed')
        outcome = {'status': 'passed', 'result': str(run_dir / 'RESULT.json'), 'resultSha256': result_sha}
    except Defer as error:
        report.update(status='deferred', code=str(error))
        state['lastAttempt'] = dict(record, status='deferred', code=str(error))
        outcome = {'status': 'deferred', 'code': str(error)}
    except BaseException as error:
        code = str(error) if isinstance(error, Hold) else 'DRILL_' + type(error).__name__.upper()
        report.update(status='failed', code=code)
        state['lastFailed'] = dict(record, code=code)
        state['lastAttempt'] = dict(record, status='failed', code=code)
        outcome = {'status': 'failed', 'code': code}
        if not isinstance(error, Exception):
            raise
    finally:
        with stop_held():
            if report['status'] != 'passed':
                try:
                    report['ownPayloadsCleaned'] = clean_payloads(run_dir)
                except Hold as error:
                    report['cleanupError'] = str(error)
                report['completedAt'] = utcnow().isoformat()
                save_json(run_dir / 'RESULT.json', report)
            save_json(state_dir / 'state.json', state)
    return outcome


def deliver(state_dir, alerts, now, project):
    """Queue current alerts durably and write each once to Cloud Logging; resolved ones are dropped unsent."""
    state_dir = pathlib.Path(state_dir)
    current = [alert_payload(alert, now) for alert in alerts]
    ids = {item['eventId'] for item in current}
    acked = read_json(state_dir / 'alert-ack.json').get('eventIds', [])
    pending = [item for item in read_json(state_dir / 'alert-pending.json').get('items', []) if item['eventId'] in ids]
    pending += [item for item in current if item['eventId'] not in acked and item['eventId'] not in {p['eventId'] for p in pending}]
    save_json(state_dir / 'alert-pending.json', {'items': pending})
    delivered = []
    for item in pending:
        cloud_json('https://logging.googleapis.com/v2/entries:write', {
            'logName': 'projects/' + project() + '/logs/synk_server_backup',
            'resource': {'type': 'global', 'labels': {'project_id': project()}},
            'entries': [{'insertId': item['eventId'], 'severity': 'ERROR', 'jsonPayload': item['payload']}]})
        acked = (acked + [item['eventId']])[-KEEP_ACKS:]
        save_json(state_dir / 'alert-ack.json', {'eventIds': acked, 'deliveredToCloudLoggingAt': utcnow().isoformat()})
        delivered.append(item['payload']['error'] + ':' + item['payload']['detail'])
    save_json(state_dir / 'alert-pending.json', {'items': []})
    return delivered


def load_config():
    cfg = json.loads(CONFIG.read_text())
    need(cfg.get('schema') == CONFIG_SCHEMA, 'CONFIG_SCHEMA')
    for key in ('installedAt', 'standbyNodeId', 'ownerNodeId', 'serviceAccount', 'backupBucket', 'controlBucket', 'controlObject',
                'expectedFstabSha256', 'restoreSha256', 'rehearsalSha256', 'sessionProof', 'root', 'stateDir'):
        need(cfg.get(key), 'CONFIG_' + key.upper())
    return cfg


def project():
    return metadata('project/project-id')


def tick():
    cfg = load_config()
    state_dir = pathlib.Path(cfg['stateDir'])
    state_dir.mkdir(mode=0o700, exist_ok=True)
    state = read_json(state_dir / 'state.json') or {'schema': STATE_SCHEMA}
    now = utcnow()
    result = {'decision': decide(state, now)}
    if result['decision'] in ('run', 'refresh'):
        result.update(attempt(cfg, state, now, refresh=result['decision'] == 'refresh'))
    state = read_json(state_dir / 'state.json') or state
    result['delivered'] = deliver(state_dir, drill_alerts(state, cfg['installedAt'], utcnow()), utcnow(), project)
    return result


def run_now():
    """Root-only manual drill: the same checks and records as a due tick, without the weekly schedule."""
    cfg = load_config()
    state_dir = pathlib.Path(cfg['stateDir'])
    state_dir.mkdir(mode=0o700, exist_ok=True)
    state = read_json(state_dir / 'state.json') or {'schema': STATE_SCHEMA}
    result = {'decision': 'manual'}
    result.update(attempt(cfg, state, utcnow()))
    state = read_json(state_dir / 'state.json') or state
    result['delivered'] = deliver(state_dir, drill_alerts(state, cfg['installedAt'], utcnow()), utcnow(), project)
    return result


def nested_media_lists(archive):
    """(media-manifest.json or None, integration-manifest.json, snapshot name) of the data archive inside a capsule, streamed."""
    with tarfile.open(archive, 'r:gz') as capsule:
        for member in capsule:
            if member.name != 'data/workspace.tar.gz':
                continue
            need(member.isfile(), 'DATA_ARCHIVE_TYPE')
            found, roots = {}, set()
            with tarfile.open(fileobj=capsule.extractfile(member), mode='r|gz') as data:
                for inner in data:
                    parts = inner.name.split('/')
                    roots.add(parts[0])
                    if len(parts) == 2 and parts[1] in ('media-manifest.json', 'integration-manifest.json'):
                        need(inner.isfile() and inner.size <= 16 << 20 and parts[1] not in found, 'DATA_ARCHIVE_LIST_INVALID')
                        found[parts[1]] = json.loads(data.extractfile(inner).read())
            need('integration-manifest.json' in found and len(roots) == 1, 'DATA_ARCHIVE_INCOMPLETE')
            return found.get('media-manifest.json'), found['integration-manifest.json'], roots.pop()
    raise Hold('DATA_ARCHIVE_MISSING')


def verify_media():
    """Root-only, read-only for GCS: does every studio medium of the newest capsule have a good sidecar of its backup?
    Needs one capsule of disk, streams the bodies without keeping them, never touches the drill state."""
    cfg = load_config()
    state_dir = pathlib.Path(cfg['stateDir'])
    state_dir.mkdir(mode=0o700, exist_ok=True)
    report = {'schema': 'synk-company-media-verify/v1', 'startedAt': utcnow().isoformat(), 'status': 'pending'}
    root = pathlib.Path(cfg['root'])
    work = None
    try:
        need(metadata('instance/id') == cfg['standbyNodeId'], 'STANDBY_INSTANCE_REQUIRED')
        need(metadata('instance/service-accounts/default/email') == cfg['serviceAccount'], 'VM_SERVICE_ACCOUNT_REQUIRED')
        need(root.is_dir() and not root.is_symlink() and root.stat().st_uid == 0 and not root.stat().st_mode & 0o077, 'PRIVATE_DRILL_ROOT_REQUIRED')
        for old in root.iterdir():
            if re.fullmatch(r'media-verify-[0-9]{8}T[0-9]{6}Z', old.name) and old.is_dir() and not old.is_symlink():
                remove(root, old)
        bucket = cfg['backupBucket']
        archive_item, sidecar_item = newest_bundle(list_bundles(bucket))
        work = root / ('media-verify-' + utcnow().strftime('%Y%m%dT%H%M%SZ'))
        work.mkdir(mode=0o700)
        need(int(sidecar_item['size']) <= 1 << 20, 'RECEIPT_TOO_LARGE')
        receipt_file = work / 'receipt.json'
        download(bucket, sidecar_item['name'], sidecar_item['generation'], receipt_file, int(sidecar_item['size']))
        need(digest(receipt_file, 'md5') == sidecar_item['md5Hash'], 'RECEIPT_MD5_MISMATCH')
        receipt = json.loads(receipt_file.read_text())
        check_receipt(receipt, archive_item, utcnow())
        need(shutil.disk_usage(work).free > receipt['bytes'] + 1024 ** 3, 'STANDBY_VERIFY_SPACE_LOW')
        archive = work / 'recovery.tar.gz'
        download(bucket, receipt['archiveObject'], receipt['generation'], archive, receipt['bytes'])
        need(digest(archive) == receipt['sha256'] and digest(archive, 'md5') == receipt['md5Hash'], 'ARCHIVE_INTEGRITY_MISMATCH')
        manifest, integration, backup = nested_media_lists(archive)
        media = media_list(manifest, integration)
        archive.unlink()
        need(media is not None, 'MEDIA_LIST_MISSING')
        copies = list_media(bucket, backup) if media['contents'] else {}
        missing = sum(1 for sha256, size in media['contents'].items() if not good_copy(bucket, copies.get(sha256, []), sha256, size))
        report.update({'status': 'verified' if not missing else 'incomplete', 'archiveGeneration': receipt['generation'],
                       'dataBackupCreatedAt': receipt['dataBackupCreatedAt'], 'mode': 'included' if media['included'] else 'external',
                       'files': len(media['files']), 'contents': len(media['contents']), 'bytes': sum(media['contents'].values()), 'missing': missing})
    except Exception as error:
        report.update(status='failed', code=str(error) if isinstance(error, Hold) else 'VERIFY_' + type(error).__name__.upper())
    finally:
        if work is not None and work.exists():
            remove(root, work)
        report['completedAt'] = utcnow().isoformat()
        save_json(state_dir / 'media-verify-latest.json', report)
    return report


def on_terminate(signum, frame):
    # One stop request is enough: later ones are ignored so they never cut the cleanup short.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    raise Hold('TERMINATED')  # run the finally blocks: container, payloads and state are cleaned and recorded


class stop_held:
    """Hold SIGTERM back while the last cleanup and the state file are written."""
    def __enter__(self):
        if hasattr(signal, 'pthread_sigmask'):
            signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})

    def __exit__(self, *error):
        if hasattr(signal, 'pthread_sigmask'):
            signal.pthread_sigmask(signal.SIG_UNBLOCK, {signal.SIGTERM})


if __name__ == '__main__':
    sys.dont_write_bytecode = True
    # tick: the timer. run-now: one drill by hand (root), skipping only the weekly schedule.
    # verify-media: GCS studio media of the newest capsule, no drill and no drill state.
    if sys.argv[1:] not in (['tick'], ['run-now'], ['verify-media']):
        raise SystemExit('usage: restore-drill.py tick|run-now|verify-media')
    if os.geteuid() != 0:
        raise SystemExit('root required')
    os.umask(0o077)
    import fcntl
    DEFAULT_STATE_DIR.mkdir(mode=0o700, exist_ok=True)
    lock = os.open(DEFAULT_STATE_DIR / 'run.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print(json.dumps({'status': 'already-running'}))
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, on_terminate)
    if sys.argv[1] == 'verify-media':
        verified = verify_media()
        print(json.dumps(verified))
        raise SystemExit(0 if verified['status'] == 'verified' else 1)
    try:
        print(json.dumps(tick() if sys.argv[1] == 'tick' else run_now()))
    except Exception as error:
        code = str(error) if isinstance(error, Hold) else 'TICK_' + type(error).__name__.upper()
        print(json.dumps({'status': 'hold', 'code': code}))
        try:  # even a broken config must reach a person
            state_dir = pathlib.Path(read_json(CONFIG).get('stateDir') or DEFAULT_STATE_DIR)
            state_dir.mkdir(mode=0o700, exist_ok=True)
            deliver(state_dir, [('RESTORE_DRILL_FAILED', code, 'tick|' + week_anchor(utcnow()).isoformat() + '|' + code, None)], utcnow(), project)
        except Exception:
            pass
        raise SystemExit(1)
