#!/usr/bin/env python3
"""Pick the Ultra login for one scheduled Argon run, then exec the official CLI; no LLM calls.

The run user keeps two agy logins in separate 0700 HOMEs: 77yuhbs (default, the run tree itself) and
unmet25 (2026-10-22 spare). `launch` keeps 77yuhbs unless its Gemini quota is under the rule - weekly
or 5-hour remaining below 10%, or the usage check failing - and unmet25 is healthy, signed in as
itself and has the same tool permissions with no paid fallback. `/usage` spends no model tokens.

  agy-account.py launch UNIT -- /opt/synk-argon-77yuhbs/bin/agy ...   role service ExecStart
  agy-account.py status [--usage]                                     mode, logins, last choices
  agy-account.py mode auto|77yuhbs|unmet25                            root
  agy-account.py sync-settings                                        unmet25 gets 77yuhbs permissions
  agy-account.py login ACCOUNT [SSH_CONNECTION]                       root, from an ssh -tt session: sign-in
                                                                      screen with the other HOME hidden

status and sync-settings only touch files the run user owns; started as root they rerun as that
user, so root never follows a path the run user could swap for a link.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile

ROLES = ('full', 'yt-tt', 'meta-brand', 'synkbrief', 'scan-lab', 'scan-ai', 'scan-platform')
UNIT_PREFIX = 'synk-argon-ultra-'
AGY = '/opt/synk-argon-77yuhbs/bin/agy'
RUN_USER = 'synk-argon-ultra'
DEFAULT = '77yuhbs'
SPARE = 'unmet25'
ACCOUNTS = {
    DEFAULT: {'home': Path('/var/lib/synk-argon-77yuhbs'), 'email': '77yuhbs@gmail.com'},
    SPARE: {'home': Path('/var/lib/synk-argon-unmet25'), 'email': 'unmet25@gmail.com'},
}
RUN_STATUS = Path('/var/lib/synk-argon-77yuhbs/run-status')
MODE_FILE = Path('/etc/synk-argon-77yuhbs/agy-account.json')
MODE_OWNER_UID = 0
MODES = ('auto', DEFAULT, SPARE)
# 2026-10-22 rule: move off 77yuhbs only when a Gemini window is under 10% or the check fails.
MIN_REMAINING = {'gemini-weekly': 0.10, 'gemini-5h': 0.10}
PROBE_TIMEOUT = 60
AUTH = re.compile(r'authenticated successfully as ([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)')


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def cli_dir(account):
    return ACCOUNTS[account]['home'] / '.gemini' / 'antigravity-cli'


def read_mode():
    """Root-owned mode file. Missing means auto; anything unexpected keeps today's 77yuhbs run."""
    try:
        info = MODE_FILE.lstat()
    except FileNotFoundError:
        return 'auto', None
    except OSError:
        return DEFAULT, 'MODE_FILE_UNREADABLE'
    if (not stat.S_ISREG(info.st_mode) or info.st_size > 1024
            or (os.name == 'posix' and (info.st_uid != MODE_OWNER_UID or info.st_mode & 0o022))):
        return DEFAULT, 'MODE_FILE_UNSAFE'
    try:
        value = json.loads(MODE_FILE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return DEFAULT, 'MODE_FILE_INVALID'
    mode = value.get('mode') if isinstance(value, dict) else None
    return (mode, None) if mode in MODES else (DEFAULT, 'MODE_FILE_INVALID')


def signed_in(log):
    try:
        text = Path(log).read_text(encoding='utf-8', errors='replace')
    except OSError:
        return None
    found = AUTH.findall(text[-1024 * 1024:])
    return found[-1] if found else None


def remaining(stdout):
    value = json.loads(stdout)
    if not isinstance(value, dict) or value.get('status') != 'SUCCESS':
        raise ValueError('USAGE_NOT_SUCCESS')
    command = value.get('command') if isinstance(value.get('command'), dict) else {}
    data = command.get('data') if isinstance(command.get('data'), dict) else {}
    if command.get('name') != 'usage':
        raise ValueError('USAGE_NOT_SUCCESS')
    found = {}
    for group in data.get('groups') or []:
        for bucket in (group.get('buckets') or []) if isinstance(group, dict) else []:
            if not isinstance(bucket, dict) or bucket.get('id') not in MIN_REMAINING:
                continue
            fraction = bucket.get('remaining_fraction')
            if type(fraction) in (int, float) and 0 <= fraction <= 1:
                found[bucket['id']] = float(fraction)
    if set(found) != set(MIN_REMAINING):
        raise ValueError('USAGE_BUCKETS_MISSING')
    return found


def probe(account):
    """One `/usage` call in that account's HOME: quota windows and the email the login really is."""
    home = ACCOUNTS[account]['home']
    result = {'ok': False, 'healthy': False}
    env = {'HOME': str(home), 'USER': RUN_USER, 'LOGNAME': RUN_USER, 'PATH': '/usr/local/bin:/usr/bin:/bin',
           'LANG': 'C.UTF-8', 'TZ': os.environ.get('TZ', 'Asia/Seoul'), 'AGY_CLI_DISABLE_AUTO_UPDATE': 'true'}
    with tempfile.TemporaryDirectory(prefix='agy-account-') as scratch:
        log = os.path.join(scratch, 'usage.log')
        try:
            done = subprocess.run([AGY, '-p', '/usage', '--output-format', 'json', '--print-timeout', '30s',
                                   '--log-file', log], env=env, cwd=str(home), stdin=subprocess.DEVNULL,
                                  capture_output=True, text=True, timeout=PROBE_TIMEOUT, check=False)
        except (OSError, subprocess.SubprocessError):
            result['error'] = 'PROBE_FAILED'
            return result
        result['email'] = signed_in(log)
    if done.returncode != 0:
        result['error'] = 'PROBE_EXIT_%d' % done.returncode if -255 <= done.returncode <= 255 else 'PROBE_FAILED'
        return result
    try:
        result.update(remaining(done.stdout))
    except (ValueError, TypeError, AttributeError) as exc:
        result['error'] = str(exc) if str(exc).startswith('USAGE_') else 'USAGE_UNREADABLE'
        return result
    result['ok'] = True
    result['healthy'] = all(result[key] >= floor for key, floor in MIN_REMAINING.items())
    return result


def spare_settings_ok():
    """unmet25 runs only with 77yuhbs's exact tool permissions and no paid fallback.

    agy rewrites settings.json and drops `useG1Credits` while it holds the default false (seen 10-22),
    so a missing key counts as off; true or an API `modelProvider` does not.
    """
    try:
        base = json.loads((cli_dir(DEFAULT) / 'settings.json').read_text(encoding='utf-8'))
        spare = json.loads((cli_dir(SPARE) / 'settings.json').read_text(encoding='utf-8'))
        config = ACCOUNTS[SPARE]['home'] / '.gemini' / 'config' / 'user_config.json'
        credits = json.loads(config.read_text(encoding='utf-8') or '{}') if config.exists() else {}
    except (OSError, ValueError):
        return False
    return (isinstance(base, dict) and isinstance(spare, dict) and isinstance(credits, dict)
            and spare.get('useG1Credits', False) is False and 'modelProvider' not in spare
            and credits.get('use_ai_credits') in (None, False)
            and isinstance(base.get('permissions'), dict) and base.get('permissions') == spare.get('permissions'))


def choose(mode):
    """(account, reason, probes). Every doubt keeps the 77yuhbs default."""
    probes = {}
    if mode == DEFAULT:
        return DEFAULT, 'MODE_77YUHBS', probes
    prefix = 'MODE' if mode == SPARE else 'AUTO'
    if mode == 'auto':
        probes[DEFAULT] = probe(DEFAULT)
        if probes[DEFAULT]['healthy']:
            return DEFAULT, 'AUTO_77YUHBS_OK', probes
    if not spare_settings_ok():
        return DEFAULT, prefix + '_UNMET25_SETTINGS_MISMATCH', probes
    probes[SPARE] = spare = probe(SPARE)
    if not spare['ok'] or spare.get('email') != ACCOUNTS[SPARE]['email']:
        return DEFAULT, prefix + '_UNMET25_NOT_READY', probes
    if mode == SPARE:
        return SPARE, 'MODE_UNMET25', probes
    if spare['healthy']:
        return SPARE, 'AUTO_SWITCH_UNMET25', probes
    return DEFAULT, 'AUTO_UNMET25_ALSO_LOW', probes


def write_json(path, value, mode=0o600, owner=None):
    fd, name = tempfile.mkstemp(prefix='.' + path.name + '-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as handle:
            json.dump(value, handle, ensure_ascii=False, indent=1, sort_keys=True)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        if owner:
            shutil.chown(name, *owner)
        os.chmod(name, mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def launch(argv):
    if (len(argv) < 3 or argv[1] != '--' or argv[2] != AGY or not argv[0].startswith(UNIT_PREFIX)
            or argv[0][len(UNIT_PREFIX):] not in ROLES):
        print('agy-account: usage: launch synk-argon-ultra-ROLE -- ' + AGY + ' ...', file=sys.stderr)
        return 2
    role, command = argv[0][len(UNIT_PREFIX):], argv[2:]
    mode, account, reason, probes = DEFAULT, DEFAULT, 'LAUNCHER_ERROR', {}
    try:
        mode, issue = read_mode()
        account, reason, probes = (DEFAULT, issue, {}) if issue else choose(mode)
    except Exception:  # never block the run on the chooser; today's login is the fallback
        account = DEFAULT
    invocation = os.environ.get('INVOCATION_ID', '')
    decision = {'schemaVersion': 1, 'role': role, 'decidedAt': now(), 'mode': mode, 'account': account,
                'reason': reason, 'probes': {name: {key: value for key, value in result.items()
                                                    if key in ('ok', 'healthy', 'email', 'error', *MIN_REMAINING)}
                                             for name, result in probes.items()},
                'invocationId': invocation if re.fullmatch(r'[a-f0-9]{32}', invocation) else None}
    try:
        write_json(RUN_STATUS / (role + '.agy-account.json'), decision)
    except OSError:
        pass
    # stdout is the run's event stream; only stderr may carry this line.
    parts = []
    for name, result in probes.items():
        shown = ','.join('%s:%.2f' % (key, result[key]) for key in MIN_REMAINING if key in result)
        parts.append('%s=%s' % (name, shown or result.get('error', 'no-usage')))
    print('agy-account: role=%s mode=%s account=%s reason=%s %s' % (role, mode, account, reason, ' '.join(parts)),
          file=sys.stderr, flush=True)
    env = dict(os.environ)
    env['HOME'] = str(ACCOUNTS[account]['home'])
    os.execve(AGY, command, env)


def runs_as_root():
    return os.name == 'posix' and os.geteuid() == 0


def require_root():
    if not runs_as_root():
        print('agy-account: run as root', file=sys.stderr)
        raise SystemExit(2)


def permissions_sha(account):
    value = json.loads((cli_dir(account) / 'settings.json').read_text(encoding='utf-8'))
    permissions = value.get('permissions') if isinstance(value, dict) else None
    if not isinstance(permissions, dict):
        return None
    return hashlib.sha256(json.dumps(permissions, sort_keys=True).encode()).hexdigest()


def status(argv):
    mode, issue = read_mode()
    out = {'mode': mode, 'modeIssue': issue, 'spareSettingsOk': spare_settings_ok(), 'accounts': {}, 'lastChoices': {}}
    for name in ACCOUNTS:
        cli = cli_dir(name)
        try:
            log = cli / 'cli.log'
            last = signed_in(log.resolve()) if log.exists() else None
        except OSError:
            last = None
        entry = {'home': str(ACCOUNTS[name]['home']), 'tokenPresent': (cli / 'antigravity-oauth-token').exists(),
                 'lastSignedIn': last}
        try:
            entry['permissionsSha256'] = permissions_sha(name)
        except (OSError, ValueError):
            entry['permissionsSha256'] = None
        if '--usage' in argv:
            entry['usage'] = probe(name)
        out['accounts'][name] = entry
    for role in ROLES:
        try:
            value = json.loads((RUN_STATUS / (role + '.agy-account.json')).read_text(encoding='utf-8'))
            out['lastChoices'][role] = {key: value.get(key) for key in ('decidedAt', 'account', 'reason')}
        except (OSError, ValueError, AttributeError):
            out['lastChoices'][role] = None
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0


def set_mode(argv):
    require_root()
    if len(argv) != 1 or argv[0] not in MODES:
        print('agy-account: mode auto|77yuhbs|unmet25', file=sys.stderr)
        return 2
    before = read_mode()
    write_json(MODE_FILE, {'mode': argv[0], 'changedAt': now()}, mode=0o644, owner=('root', 'root'))
    print(json.dumps({'before': before[0], 'beforeIssue': before[1], 'after': read_mode()[0]}))
    return 0


def sync_settings(argv):
    """Copy 77yuhbs's tool permissions into unmet25's settings.json; the old file stays beside it."""
    base = json.loads((cli_dir(DEFAULT) / 'settings.json').read_text(encoding='utf-8'))
    target = cli_dir(SPARE) / 'settings.json'
    spare = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
    if (not isinstance(base, dict) or not isinstance(spare, dict) or 'modelProvider' in base
            or 'modelProvider' in spare or not isinstance(base.get('permissions'), dict)):
        print('agy-account: refuse - modelProvider present or permissions missing', file=sys.stderr)
        return 1
    backup = None
    if target.exists():
        name = 'settings.json.bak-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        backup, number = target.with_name(name), 1
        while backup.exists():  # two runs in one second must not overwrite the older copy
            number += 1
            backup = target.with_name('%s-%d' % (name, number))
        write_json(backup, spare)
    spare['useG1Credits'] = False
    spare['permissions'] = base['permissions']
    write_json(target, spare)
    print(json.dumps({'backup': str(backup) if backup else None, 'spareSettingsOk': spare_settings_ok(),
                      'permissionsEqual': permissions_sha(DEFAULT) == permissions_sha(SPARE)}))
    return 0


def login(argv):
    """Interactive agy sign-in for one account's HOME (2026-10-22). The person opens the printed URL,
    picks that Google account and pastes the code back; the other account's HOME is not visible."""
    require_root()
    if len(argv) not in (1, 2) or argv[0] not in ACCOUNTS:
        print('agy-account: login 77yuhbs|unmet25 [SSH_CONNECTION]', file=sys.stderr)
        return 2
    home = ACCOUNTS[argv[0]]['home']
    other = next(info['home'] for name, info in ACCOUNTS.items() if name != argv[0])
    connection = argv[1] if len(argv) == 2 and re.fullmatch(r'[0-9A-Fa-f:. ]{1,200}', argv[1]) else ''
    term = os.environ.get('TERM', '') if re.fullmatch(r'[A-Za-z0-9.+-]{1,40}', os.environ.get('TERM', '')) else 'xterm-256color'
    command = ['/usr/bin/systemd-run', '--unit=synk-argon-%s-login' % argv[0], '--uid=' + RUN_USER, '--gid=' + RUN_USER,
               '--working-directory=' + str(home), '--pty', '--wait', '--collect',
               '--property=NoNewPrivileges=yes', '--property=ProtectSystem=strict', '--property=ProtectHome=yes',
               '--property=PrivateTmp=yes', '--property=ReadWritePaths=' + str(home),
               '--property=InaccessiblePaths=-' + str(other), '--property=UMask=0077',
               '/usr/bin/env', '-i', 'HOME=' + str(home), 'USER=' + RUN_USER, 'LOGNAME=' + RUN_USER,
               'PATH=/usr/local/bin:/usr/bin:/bin', 'TERM=' + term, 'LANG=C.UTF-8', 'AGY_CLI_DISABLE_AUTO_UPDATE=true',
               'SSH_CONNECTION=' + connection, AGY]
    os.execv(command[0], command)


def as_run_user(argv):
    """Rerun this command as the run user (root never reads or writes the run user's own paths)."""
    done = subprocess.run([sys.executable, '-I', os.path.abspath(__file__), *argv], user=RUN_USER, group=RUN_USER,
                          extra_groups=[], cwd='/', check=False,
                          env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'TZ': os.environ.get('TZ', 'Asia/Seoul')})
    return done.returncode


def main(argv):
    commands = {'launch': launch, 'status': status, 'mode': set_mode, 'sync-settings': sync_settings, 'login': login}
    if len(argv) < 2 or argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        return 2
    if argv[1] in ('status', 'sync-settings') and runs_as_root():
        return as_run_user(argv[1:])
    return commands[argv[1]](argv[2:])


if __name__ == '__main__':
    sys.exit(main(sys.argv))
