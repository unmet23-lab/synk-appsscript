#!/usr/bin/env python3
"""Queue sanitized systemd failures and deliver them to Cloud Logging; no AI calls."""
import contextlib
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = Path('/var/lib/synk-argon-alerts')
RUN_STATE = Path('/var/lib/synk-argon-77yuhbs/run-status')
RUN_UID = 994
PROJECT = 'synk-bake-unmet27'
LOG_NAME = 'projects/' + PROJECT + '/logs/synk_argon_ops'
METADATA_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
LOGGING_URL = 'https://logging.googleapis.com/v2/entries:write'
UNITS = {'synk-argon-ultra-' + role + '.service': role
         for role in ('full', 'yt-tt', 'meta-brand', 'synkbrief')}
UNITS['synk-argon-alert-test.service'] = 'alert-test'
RESULTS = {'success', 'resources', 'timeout', 'exit-code', 'signal', 'core-dump',
           'watchdog', 'start-limit-hit', 'protocol', 'exec-condition', 'oom-kill', 'unknown'}
STATES = {'active', 'inactive', 'failed', 'activating', 'deactivating', 'reloading',
          'maintenance', 'unknown'}
ERRORS = {'DOC_READ_FAILED', 'BEGIN_DOC_READ_FAILED', 'BEGIN_INVOCATION_ID_INVALID', 'SERVICE_FAILED',
          'MISSING_OR_MULTIPLE_RUNS', 'MODEL_MISMATCH', 'CONVERSATION_MISMATCH',
          'CLI_FAILED_OR_DENIED', 'MISSING_DELIVERY_MARKER', 'DOC_SHA_MISMATCH',
          'NO_CHANGE_DOC_CHANGED_OR_NO_BASELINE', 'RUN_CHECK_FAILED',
          'RUN_STATE_UNAVAILABLE', 'SYSTEMD_FAILURE', 'SYNTHETIC_ALERT_TEST'}
KEYS = {'event', 'schemaVersion', 'eventId', 'role', 'unit', 'test', 'testId', 'occurredAt',
        'error', 'systemdResult', 'execMainStatus', 'execMainCode', 'activeState',
        'invocationId'}
HEX64 = re.compile(r'[a-f0-9]{64}')
HEX32 = re.compile(r'[a-f0-9]{32}')


class SafeFailure(Exception):
    """Only fixed error codes, never HTTP bodies, state text, or credentials."""


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def valid_time(value):
    if not isinstance(value, str) or len(value) != 25:
        return False
    try:
        parsed = dt.datetime.fromisoformat(value)
        return parsed.utcoffset() == dt.timedelta(0) and parsed.isoformat(timespec='seconds') == value
    except ValueError:
        return False


def check_private(path, directory=False, uid=0):
    info = path.lstat()
    expected = stat.S_ISDIR if directory else stat.S_ISREG
    if not expected(info.st_mode) or (not directory and info.st_nlink != 1):
        raise SafeFailure('UNSAFE_FILE')
    if os.name == 'posix' and (info.st_uid != uid or stat.S_IMODE(info.st_mode) != (0o700 if directory else 0o600)):
        raise SafeFailure('UNSAFE_PERMISSIONS')
    if path.resolve() != path.absolute():
        raise SafeFailure('UNSAFE_PATH')
    return info


def private_dir(path):
    path.mkdir(mode=0o700, exist_ok=True)
    check_private(path, directory=True)


def read_json(path, uid=0, max_size=8192):
    before = check_private(path, uid=uid)
    if before.st_size > max_size:
        raise SafeFailure('FILE_TOO_LARGE')
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    try:
        opened = os.fstat(fd)
        if (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino):
            raise SafeFailure('FILE_CHANGED')
        with os.fdopen(fd, 'rb', closefd=False) as handle:
            raw = handle.read(max_size + 1)
        if len(raw) > max_size:
            raise SafeFailure('FILE_TOO_LARGE')
        return json.loads(raw)
    finally:
        os.close(fd)


def atomic_new(path, value):
    """Publish one complete immutable record without overwriting a prior record."""
    fd, temporary = tempfile.mkstemp(prefix='.new-', dir=path.parent)
    temp = Path(temporary)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as handle:
            json.dump(value, handle, sort_keys=True, separators=(',', ':'))
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.link(temp, path)
            created = True
        except FileExistsError:
            created = False
    finally:
        temp.unlink(missing_ok=True)
    if os.name == 'posix':
        directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    return created


def event_id(unit, invocation):
    return hashlib.sha256((unit + '\n' + invocation).encode('ascii')).hexdigest()


def validate_event(event, filename=None):
    if not isinstance(event, dict) or set(event) != KEYS:
        raise SafeFailure('INVALID_EVENT')
    unit = event['unit']
    if not isinstance(unit, str) or unit not in UNITS or event['role'] != UNITS[unit]:
        raise SafeFailure('INVALID_UNIT')
    if event['event'] != 'SYNK_ARGON_RUN_FAILED' or type(event['schemaVersion']) is not int or event['schemaVersion'] != 1:
        raise SafeFailure('INVALID_EVENT')
    if type(event['test']) is not bool or event['test'] != (UNITS[unit] == 'alert-test'):
        raise SafeFailure('INVALID_TEST')
    if event['testId'] != ('SYNK_ARGON_ALERT_TEST_20261018' if event['test'] else 'none'):
        raise SafeFailure('INVALID_TEST')
    invocation = event['invocationId']
    if not isinstance(invocation, str) or not HEX32.fullmatch(invocation):
        raise SafeFailure('INVALID_INVOCATION')
    if event['eventId'] != event_id(unit, invocation) or (filename is not None and filename != event['eventId'] + '.json'):
        raise SafeFailure('INVALID_EVENT_ID')
    if not valid_time(event['occurredAt']):
        raise SafeFailure('INVALID_TIME')
    for name, allowed in [('error', ERRORS), ('systemdResult', RESULTS), ('activeState', STATES)]:
        if not isinstance(event[name], str) or event[name] not in allowed:
            raise SafeFailure('INVALID_CODE')
    if (event['error'] == 'SYNTHETIC_ALERT_TEST') != event['test']:
        raise SafeFailure('INVALID_TEST')
    for name in ('execMainStatus', 'execMainCode'):
        if type(event[name]) is not int or not 0 <= event[name] <= 65535:
            raise SafeFailure('INVALID_EXIT_STATUS')
    return event


def show_unit(unit):
    if unit not in UNITS:
        raise SafeFailure('INVALID_UNIT')
    properties = ('Result', 'ExecMainStatus', 'ExecMainCode', 'InvocationID', 'ActiveState')
    command = ['/usr/bin/systemctl', 'show', unit, '--no-pager']
    command += ['--property=' + name for name in properties]
    result = subprocess.run(command, capture_output=True, text=True, timeout=5, check=False)
    if result.returncode or len(result.stdout) > 4096:
        raise SafeFailure('SYSTEMCTL_FAILED')
    parsed = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if set(parsed) != set(properties):
        raise SafeFailure('SYSTEMCTL_INVALID')
    return parsed


def error_code(role, invocation=None):
    if role == 'alert-test':
        return 'SYNTHETIC_ALERT_TEST'
    try:
        check_private(RUN_STATE, directory=True, uid=RUN_UID)
        record = read_json(RUN_STATE / (role + '.json'), uid=RUN_UID, max_size=512 * 1024)
        if not isinstance(record, dict) or record.get('role') != role:
            return 'RUN_STATE_UNAVAILABLE'
        if 'invocationId' in record and record['invocationId'] != invocation:
            return 'RUN_STATE_UNAVAILABLE'
        if record.get('status') != 'failed':
            return 'SYSTEMD_FAILURE'
        error = record.get('error')
        return error if isinstance(error, str) and error in ERRORS - {'SYNTHETIC_ALERT_TEST'} else 'RUN_CHECK_FAILED'
    except (OSError, ValueError, SafeFailure):
        return 'RUN_STATE_UNAVAILABLE'


def capture(unit):
    properties = show_unit(unit)
    def bounded_number(value):
        return int(value) if re.fullmatch(r'[0-9]{1,5}', value) and int(value) <= 65535 else 0
    role = UNITS[unit]
    event = {'event': 'SYNK_ARGON_RUN_FAILED', 'schemaVersion': 1,
             'eventId': event_id(unit, properties['InvocationID']), 'unit': unit, 'role': role,
             'test': role == 'alert-test', 'occurredAt': utc_now(), 'error': error_code(role, properties['InvocationID']),
             'testId': 'SYNK_ARGON_ALERT_TEST_20261018' if role == 'alert-test' else 'none',
             'systemdResult': properties['Result'] if properties['Result'] in RESULTS else 'unknown',
             'execMainStatus': bounded_number(properties['ExecMainStatus']),
             'execMainCode': bounded_number(properties['ExecMainCode']),
             'activeState': properties['ActiveState'] if properties['ActiveState'] in STATES else 'unknown',
             'invocationId': properties['InvocationID']}
    validate_event(event)
    if acknowledged(event['eventId']):
        return event['eventId']
    destination = ROOT / 'outbox' / (event['eventId'] + '.json')
    if not atomic_new(destination, event):
        validate_event(read_json(destination), destination.name)
    return event['eventId']


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise SafeFailure('HTTP_REDIRECT_REJECTED')


def request_json(url, headers, body=None):
    # Neither proxy environment variables nor redirects may receive the token.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(url, headers=headers, data=body)
    try:
        with opener.open(request, timeout=10) as response:
            if not 200 <= response.status < 300:
                raise SafeFailure('HTTP_FAILED')
            data = response.read(65537)
            if len(data) > 65536:
                raise SafeFailure('HTTP_RESPONSE_TOO_LARGE')
            return json.loads(data) if data else {}
    except (OSError, ValueError, urllib.error.URLError):
        raise SafeFailure('HTTP_FAILED') from None


def send(event):
    validate_event(event)
    metadata = request_json(METADATA_URL, {'Metadata-Flavor': 'Google'})
    token = metadata.get('access_token') if isinstance(metadata, dict) else None
    if not isinstance(token, str) or not token or len(token) > 8192 or '\r' in token or '\n' in token:
        raise SafeFailure('METADATA_TOKEN_INVALID')
    payload = {'logName': LOG_NAME, 'resource': {'type': 'gce_instance', 'labels': {
        'project_id': PROJECT, 'instance_id': '8318146427425792493', 'zone': 'asia-northeast3-b'}},
        'partialSuccess': False, 'entries': [{'insertId': event['eventId'],
        'timestamp': event['occurredAt'], 'severity': 'ERROR', 'jsonPayload': event}]}
    request_json(LOGGING_URL, {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
                 json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8'))


def acknowledged(identifier):
    path = ROOT / 'ack' / (identifier + '.json')
    try:
        value = read_json(path)
    except FileNotFoundError:
        return False
    if (not isinstance(value, dict) or set(value) != {'eventId', 'deliveredAt'}
            or value['eventId'] != identifier or not valid_time(value['deliveredAt'])):
        raise SafeFailure('INVALID_ACK')
    return True


def drain(limit=4):
    counts = {'delivered': 0, 'retained': 0, 'rejected': 0, 'alreadyAcknowledged': 0}
    for path in sorted((ROOT / 'outbox').iterdir()):
        if path.name.startswith('.new-'):
            continue
        if counts['delivered'] + counts['retained'] >= limit:
            break
        try:
            if not path.name.endswith('.json') or not HEX64.fullmatch(path.stem):
                raise SafeFailure('INVALID_QUEUE_NAME')
            event = validate_event(read_json(path), path.name)
            if acknowledged(event['eventId']):
                path.unlink()
                counts['alreadyAcknowledged'] += 1
                continue
            try:
                send(event)
            except SafeFailure:
                counts['retained'] += 1
                continue
            ack = ROOT / 'ack' / path.name
            atomic_new(ack, {'eventId': event['eventId'], 'deliveredAt': utc_now()})
            if not acknowledged(event['eventId']):
                raise SafeFailure('ACK_NOT_SAVED')
            path.unlink()
            counts['delivered'] += 1
        except (OSError, ValueError, SafeFailure):
            counts['rejected'] += 1
    return counts


@contextlib.contextmanager
def delivery_lock():
    import fcntl
    path = ROOT / '.delivery.lock'
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        check_private(path)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            acquired = True
        except BlockingIOError:
            acquired = False
        yield acquired
    finally:
        os.close(fd)


def main(argv):
    if sys.platform != 'linux' or os.geteuid() != 0:
        raise SafeFailure('ROOT_LINUX_REQUIRED')
    if not (argv == ['drain'] or len(argv) == 2 and argv[0] == 'capture' and argv[1] in UNITS):
        raise SafeFailure('INVALID_ARGUMENTS')
    private_dir(ROOT)
    private_dir(ROOT / 'outbox')
    private_dir(ROOT / 'ack')
    identifier = capture(argv[1]) if argv[0] == 'capture' else None
    with delivery_lock() as acquired:
        result = drain(limit=1 if identifier else 4) if acquired else {'queued': True}
    if identifier:
        result['eventId'] = identifier
    print(json.dumps(result, sort_keys=True))
    return 1 if result.get('retained') or result.get('rejected') else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception:
        # The exception may originate in untrusted JSON or an HTTP body.
        print('{"error":"ALERT_OPERATION_FAILED"}', file=sys.stderr)
        raise SystemExit(1)
