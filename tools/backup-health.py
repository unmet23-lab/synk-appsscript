"""Four-store backup health, schedule checks and durable Windows notifications."""
import argparse
import ctypes
import datetime as dt
import functools
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

TOOLS = Path(__file__).resolve().parent
DEFAULT_ROOT = TOOLS.parent.parent / 'SYNK_원본창고'
BAD = {'failed', 'partial_failure', 'attention', 'blocked', 'unknown', 'missed', 'interrupted', 'unconfigured'}
GOOD = {'healthy', 'success'}
LABELS = {'onedrive': 'OneDrive 문서·소스', 'github': 'GitHub 커밋',
          'server': '20TB 서버·DB', 'media': '20TB 미디어 원본', 'archive': '5TB 기존 원본',
          'workspace': '20TB 업무 문서·첨부·조사 상태', 'space': '공간 지킴이(C: 여유 300GB)'}
STATUS_LABELS = {'healthy': '정상', 'pending': '동기화 대기', 'running': '실행 중', 'paused': '의도적 중지',
                 'attention': '확인 필요', 'failed': '실패', 'missed': '최신 백업 지연', 'interrupted': '실행 중단',
                 'partial_failure': '일부 실패', 'unknown': '상태 확인 불가', 'blocked': '준비 미완료',
                 'not_ready': '준비 전'}
# The space guard (../SYNK_원본창고/공간지킴이.py, 10-19) is not a backup store but a 30-minute task that keeps
# 300GB free on C:. It is checked here, not in backup-health-config.json, which the installer rewrites whole.
SPACE_GUARD = {'id': 'space', 'taskName': 'SYNK 공간 지킴이', 'receipt': '상태/공간지킴이/latest.json',
               'ledger': '상태/공간지킴이/내려놓은목록.jsonl', 'maxStaleHours': 2, 'maxRunHours': 2}
# The ledger is also copied to OneDrive (10MiB limit in 이어하기꾸러미.js). Once over it, the copied file turns into
# previously-backed-source-now-protected and every OneDrive run fails, so warn while it can still be split.
# The guard continues the ledger in 내려놓은목록-002.jsonl, -003… at 4MiB; a part reaching this size means that stopped.
SPACE_LEDGER_WARN_BYTES = 8 * 1024 * 1024
# A suspended PC runs no backup, yet a running receipt's heartbeat and run ages are wall-clock times (10-20: five
# sleeps, 46 minutes the longest). Each resume from sleep or hibernation sets the clock again from the hardware clock and
# logs Kernel-General 1 with reason 2 at once: OldTime is when the clock stopped, NewTime when it was set again, and
# nothing ran in between. Power-Troubleshooter 1 is not used: it is logged 5–25 s after the resume (the 14:02 check on
# 10-20 ran before it), its span also covers the sleep entry and wake while programs still run, and it gave the hour
# of sleep before the 10-17 hibernation as zero. The last 24 hours are read; older sleep stays in the ages (stricter).
SUSPEND_QUERY = ("*[System[Provider[@Name='Microsoft-Windows-Kernel-General'] and EventID=1 and "
                 "TimeCreated[timediff(@SystemTime) <= 86400000]]]")
EVENT_DATA = '{http://schemas.microsoft.com/win/2004/08/events/event}Data'


def load_legacy(root):
    spec = importlib.util.spec_from_file_location('synk_backup_status', Path(root) / '백업상태.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def safe_codes(receipt):
    return sorted(set(x.get('code') for x in receipt.get('issues', [])
        if isinstance(x, dict) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,99}', str(x.get('code', '')))))


def suspensions(run=subprocess.run):
    """Merged (stopped, resumed) spans of the last 24 hours in which the PC was suspended; None when unreadable."""
    try:
        result = run(['wevtutil.exe', 'qe', 'System', '/q:' + SUSPEND_QUERY, '/f:xml', '/rd:true', '/c:500'],
            capture_output=True, stdin=subprocess.DEVNULL, timeout=20, creationflags=0x08000000 if os.name == 'nt' else 0)
        if result.returncode: return None
        # wevtutil writes the ANSI code page (CP949 here); the times and reason read below are ASCII.
        events = ET.fromstring('<events>' + result.stdout.decode('utf-8', 'replace') + '</events>')
    except (OSError, subprocess.SubprocessError, ET.ParseError):
        return None
    spans = []
    for event in events:
        data = {x.get('Name'): x.text for x in event.iter(EVENT_DATA)}
        if data.get('Reason') != '2': continue
        try:
            stopped, resumed = (dt.datetime.fromisoformat(data[x].replace('Z', '+00:00')) for x in ('OldTime', 'NewTime'))
        except (KeyError, AttributeError, ValueError):
            continue
        # Reason 2 also comes just before a sleep, setting the clock back by a second or two.
        if stopped.tzinfo and resumed.tzinfo and stopped < resumed: spans.append((stopped, resumed))
    merged = []
    for stopped, resumed in sorted(spans):
        if merged and stopped <= merged[-1][1]: merged[-1] = (merged[-1][0], max(merged[-1][1], resumed))
        else: merged.append((stopped, resumed))
    return merged


def process_started(pid):
    """When the process with this id was created (UTC), or None."""
    if os.name != 'nt' or not isinstance(pid, int) or pid < 1: return None
    from ctypes import wintypes
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.OpenProcess.restype = wintypes.HANDLE
    k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k32.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = k32.OpenProcess(0x1000, False, pid)
    if not handle: return None
    try:
        times = [wintypes.FILETIME() for _ in range(4)]
        if not k32.GetProcessTimes(handle, *map(ctypes.byref, times)): return None
    finally:
        k32.CloseHandle(handle)
    ticks = (times[0].dwHighDateTime << 32) | times[0].dwLowDateTime
    return dt.datetime(1601, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(microseconds=ticks // 10)


def paused(spans, pid):
    """The suspended spans that began after this process started, so they stopped it too.

    A shutdown with fast startup also resumes from hibernation, but ends every program: a later process that got the
    same id must not have that gap taken off a dead run's ages."""
    started = process_started(pid) if spans else None
    return [x for x in spans if x[0] >= started] if started else []


def awake(since, now, spans):
    """The time from since to now minus the suspended spans inside it."""
    span = now - since
    for stopped, resumed in spans:
        overlap = min(resumed, now) - max(stopped, since)
        if overlap > dt.timedelta(): span -= overlap
    return span


def suspended_seconds():
    """Seconds this PC has been suspended since it started (interrupt time with and without sleep), or None."""
    if os.name != 'nt': return None
    interrupt, unbiased = ctypes.c_ulonglong(), ctypes.c_ulonglong()
    try:
        ctypes.WinDLL('kernelbase').QueryInterruptTime(ctypes.byref(interrupt))
        if not ctypes.WinDLL('kernel32').QueryUnbiasedInterruptTime(ctypes.byref(unbiased)): return None
    except (OSError, AttributeError):
        return None
    return (interrupt.value - unbiased.value) / 1e7


def evaluate(item, receipt, now, lib, task=None, installed_at=None, repair=None, suspended=None):
    receipt = receipt or {}
    state = receipt.get('status', 'unknown')
    checked = lib.instant(receipt.get('checkedAt') or receipt.get('finishedAt') or receipt.get('heartbeatAt'))
    success = lib.instant(receipt.get('lastSuccessAt'))
    codes = safe_codes(receipt)
    repaired = False
    repaired_at = None
    # The failed original run remains immutable. Only its exact, fully verified repair clears it.
    if item['id'] == 'server' and state in ('failed', 'partial_failure') and repair and repair.get('status') == 'success':
        repair_time = lib.instant(repair.get('finishedAt'))
        steps = repair.get('steps', [])
        failed = [x for x in receipt.get('steps', []) if x.get('status') == 'failed']
        covered = set(repair.get('repairedStepIds', []))
        if (repair.get('repairOfRunId') == receipt.get('runId') and failed and
            all(x.get('status') in ('success', 'failed') for x in receipt.get('steps', [])) and
            all(x.get('id') in covered for x in failed) and steps and
            all(x.get('status') == 'success' for x in steps) and repair_time and
            lib.instant(receipt.get('finishedAt')) and repair_time >= lib.instant(receipt.get('finishedAt'))):
            # Repairing one step does not refresh data from the other steps.
            source_time = lib.instant(receipt.get('startedAt')) or lib.instant(receipt.get('finishedAt'))
            state, success, checked, codes, repaired = 'success', source_time, repair_time, [], True
            repaired_at = repair_time
    if state in GOOD:
        state = 'healthy'
        success = success or checked
    elif state in ('first_run_pending',):
        state = 'pending'
    if not receipt:
        state = 'pending' if installed_at and now - installed_at < dt.timedelta(hours=item['maxAgeHours']) else 'unknown'
        if state == 'unknown': codes.append('RECEIPT_MISSING')
    slept = None
    if state == 'running':
        heartbeat = lib.instant(receipt.get('heartbeatAt') or receipt.get('checkedAt') or receipt.get('startedAt'))
        start = lib.instant(receipt.get('startedAt'))
        # Both ages leave out the time the PC was suspended while this run was alive; without the record, the wall clock.
        spans = paused(suspended or [], receipt.get('pid'))
        if suspended is not None and heartbeat: slept = round((now - heartbeat - awake(heartbeat, now, spans)).total_seconds())
        if not lib.process_alive(receipt.get('pid')) or not heartbeat or awake(heartbeat, now, spans) > dt.timedelta(minutes=15):
            state = 'interrupted'; codes.append('PROCESS_OR_HEARTBEAT_MISSING')
        elif not start or awake(start, now, spans) > dt.timedelta(hours=item.get('maxRunHours', 6)):
            state = 'interrupted'; codes.append('RUN_OVERRUN')
    if state in ('healthy', 'pending'):
        baseline = success or installed_at
        if baseline and now - baseline > dt.timedelta(hours=item['maxAgeHours']):
            state = 'missed'; codes.append('BACKUP_STALE')
        if item['id'] == 'server' and success and now > lib.next_daily(success) + dt.timedelta(hours=6):
            state = 'missed'; codes.append('DAILY_RUN_MISSED')
    if state not in GOOD | BAD | {'pending', 'running', 'paused'}:
        state = 'unknown'; codes.append('STATE_UNKNOWN')
    schedules = [] if task is None else [task] + task.get('auxiliaryTasks', [])
    for schedule in schedules:
        if not schedule.get('exists') or not schedule.get('enabled'):
            state = 'attention'; codes.append('SCHEDULE_MISSING_OR_DISABLED')
        elif state != 'paused' and schedule.get('result') not in (0, 267009, 267011, None) and not (
                item['id'] == 'onedrive' and schedule.get('result') == 2 and state == 'pending'):
            task_time = lib.instant(schedule.get('lastRunAt'))
            observed_from = lib.instant(item.get('installedAt'))
            if observed_from and task_time and task_time < observed_from:
                continue  # This added scope was not part of the earlier scheduled run.
            # A later verified manual repair clears a failed scheduled attempt.
            verified_at = repaired_at or success
            if schedule.get('state') != 'Running' and (not verified_at or not task_time or task_time > verified_at):
                if state not in BAD: state = 'attention'
                codes.append('SCHEDULE_LAST_RUN_FAILED')
    row = {'id': item['id'], 'label': LABELS[item['id']], 'status': state,
           'checkedAt': lib.stamp(checked) if checked else None,
           'lastSuccessAt': lib.stamp(success) if success else None, 'repaired': repaired,
           'repairedAt': lib.stamp(repaired_at) if repaired_at else None,
           'codes': sorted(set(codes)), 'task': task,
           'scope': item.get('scope'), 'receiptPath': item['receipt']}
    # Seconds of suspension left out of a running receipt's heartbeat age (absent when the record could not be read).
    if slept is not None: row['suspendedSinceHeartbeatSeconds'] = slept
    return row


def ledger_parts(root, item=SPACE_GUARD):
    # Same naming as 공간지킴이.py ledger_parts: the original name, then -002, -003… (three or more digits).
    base = Path(root) / item['ledger']
    pattern = re.compile(re.escape(base.stem) + r'(?:-[0-9]{3,})?' + re.escape(base.suffix))
    try:
        names = os.listdir(base.parent)
    except FileNotFoundError:
        return []
    return [base.parent / n for n in names if pattern.fullmatch(n) and (base.parent / n).is_file()]


def space_guard(root, lib, task, now, item=SPACE_GUARD):
    # Not registered yet means waiting for the owner's go-ahead (10-19 「예약은 아직 등록하지 마」), not a failure.
    task = task or {'exists': False}
    try:
        receipt = lib.read_json(root / item['receipt'])
        if receipt is None: receipt = {}
        elif not isinstance(receipt, dict): raise ValueError('SPACE_RECEIPT_SHAPE')
    except (OSError, ValueError):
        receipt = None
    guard = (receipt or {}).get('status')
    checked = lib.instant((receipt or {}).get('checkedAt'))
    last_run = lib.instant(task.get('lastRunAt'))
    codes, notes = [], []
    if not task.get('exists'):
        state = 'not_ready'; codes.append('SPACE_GUARD_SCHEDULE_NOT_REGISTERED'); notes.append('예약 등록 전(확인 대기)')
    elif not task.get('enabled'):
        state = 'attention'; codes.append('SCHEDULE_MISSING_OR_DISABLED'); notes.append('예약이 꺼져 있음')
    elif not last_run and lib.instant(task.get('nextRunAt')) and (
            lib.instant(task.get('nextRunAt')) - now <= dt.timedelta(hours=item['maxStaleHours'])):
        # Just registered: until the first scheduled run, the old manual receipt is not a stalled guard.
        state = 'not_ready'; codes.append('SPACE_GUARD_FIRST_RUN_PENDING'); notes.append('첫 예약 실행 대기')
    elif receipt is None:
        state = 'unknown'; codes.append('RECEIPT_UNREADABLE')
    elif not receipt:
        state = 'unknown'; codes.append('RECEIPT_MISSING')
    elif guard not in ('ok', 'low', 'attention'):
        state = 'unknown'; codes.append('STATE_UNKNOWN')
    else:
        state = 'attention' if guard == 'attention' else 'healthy'
        if guard == 'attention': codes.append('DISK_FREE_BELOW_FLOOR')
        free, floor = receipt.get('freeAfter'), receipt.get('floor')
        if guard != 'ok' and isinstance(free, (int, float)) and isinstance(floor, (int, float)):
            # GB as Explorer counts it (1024³), the unit of the guard's 300GB floor and of its own notice (10-20).
            notes.append(f'남은 공간 {free / 1024 ** 3:.0f}GB(지킬 선 {floor / 1024 ** 3:.0f}GB)')
        # A scheduled run may hold the receipt for up to its 2-hour limit; wait for it before calling the guard stalled.
        running = task.get('state') == 'Running' and last_run and now - last_run <= dt.timedelta(hours=item['maxRunHours'])
        if not running and (not checked or now - checked > dt.timedelta(hours=item['maxStaleHours'])):
            state = 'attention'; codes.append('SPACE_GUARD_STALE')
            notes.append(f'{int((now - checked).total_seconds() // 3600)}시간째 점검 없음' if checked else '점검 시각 없음')
        # The task ran after the last receipt and failed (the check raised): report it without waiting for staleness.
        if (task.get('state') != 'Running' and task.get('result') not in (0, 267009, 267011, None)
                and last_run and (not checked or last_run > checked)):
            state = 'attention'; codes.append('SCHEDULE_LAST_RUN_FAILED'); notes.append('마지막 점검 실패')
    # Every part is checked, so the part being written now (the last one) is always covered.
    size, name = max(((p.stat().st_size, p.name) for p in ledger_parts(root, item)), default=(0, None))
    if size >= SPACE_LEDGER_WARN_BYTES:
        if state not in BAD: state = 'attention'
        codes.append('SPACE_LEDGER_NEAR_ONEDRIVE_LIMIT')
        notes.append(f'내려놓은 장부 {name} {size / 1048576:.1f}MiB(OneDrive 10MiB 한도 전에 나눠야 함)')
    good_check = guard in ('ok', 'low') and checked
    return {'id': item['id'], 'label': LABELS[item['id']], 'status': state,
            'checkedAt': lib.stamp(checked) if checked else None,
            'lastSuccessAt': lib.stamp(checked) if good_check else None, 'repaired': False, 'repairedAt': None,
            'codes': sorted(set(codes)), 'detail': ', '.join(notes) or None, 'task': task,
            'freeBytes': (receipt or {}).get('freeAfter'), 'floorBytes': (receipt or {}).get('floor'),
            'scope': 'C: 여유 300GB 지킴이의 마지막 점검과 예약. 내려놓은 원본의 Drive 대조는 지킴이 장부가 맡는다.',
            'receiptPath': item['receipt']}


def task_snapshot(config_path, extra=()):
    query, temp = Path(config_path), None
    if extra:
        # Built-in checks are queried from a temporary copy; the installer owns the config file itself.
        config = json.loads(query.read_text(encoding='utf-8-sig'))
        config['additionalChecks'] = list(config.get('additionalChecks') or []) + [
            {'id': x['id'], 'taskName': x['taskName']} for x in extra]
        handle, temp = tempfile.mkstemp(prefix='backup-task-query-', suffix='.json')
        with os.fdopen(handle, 'wb') as output: output.write(json.dumps(config, ensure_ascii=False).encode('utf-8'))
        query = Path(temp)
    try:
        result = subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-File', str(TOOLS / 'backup-task-status.ps1'), '-ConfigPath', str(query)],
            capture_output=True, timeout=45, creationflags=0x08000000 if os.name == 'nt' else 0)
    finally:
        if temp: os.unlink(temp)
    if result.returncode: raise RuntimeError('SCHEDULE_QUERY_FAILED')
    values = json.loads(result.stdout.decode('utf-8-sig'))
    return {x['id']: x for x in values}


def gather(root, lib, config, tasks, now, sleep_record=lambda: None):
    components = []
    for item in config['components'] + config.get('additionalChecks', []):
        try:
            receipt = lib.read_json(root / item['receipt'])
            if item['id'] == 'onedrive' and receipt and receipt.get('status') == 'running' and not receipt.get('pid'):
                owner = lib.read_json(root / '상태' / 'OneDrive' / 'run.lock') or {}
                if owner.get('runId') == receipt.get('runId'):
                    receipt = dict(receipt, pid=owner.get('pid'))
            running = (receipt or {}).get('status') == 'running'
            suspended = sleep_record() if running else None  # read once, and only while a run is in progress
            repair = lib.read_json(root / 'backup-repair-status.json') if item['id'] == 'server' else None
            if item['id'] == 'server':
                derived = lib.local_summary(root, now)
                if running and suspended and derived['status'] == 'interrupted':
                    # 백업상태.py judges a running run's heartbeat (10 minutes) and length on the wall clock. Ask it again
                    # with the suspended time moved out of both; only its 'running' answer replaces the first one.
                    spans, moved = paused(suspended, receipt.get('pid')), dict(receipt)
                    for key in ('heartbeatAt', 'startedAt'):
                        moment = lib.instant(receipt.get(key))
                        if moment: moved[key] = lib.stamp(now - awake(moment, now, spans))
                    again = lib.derive_status(moved, {}, now, alive=lib.process_alive)
                    if again['status'] == 'running': derived = again
                receipt = dict(receipt or {}, status=derived['status'], issues=derived['issues'])
            task = dict(tasks.get(item['id'], {'exists': False}))
            auxiliary = [x for x in config.get('auxiliaryTasks', []) if x.get('component') == item['id']]
            if auxiliary:
                task['auxiliaryTasks'] = [tasks.get(x['id'], {'id':x['id'], 'exists':False}) for x in auxiliary]
            component = evaluate(item, receipt, now, lib, task,
                lib.instant(item.get('installedAt') or config.get('installedAt')), repair, suspended)
        except (OSError, ValueError, TypeError, KeyError):
            component = {'id': item['id'], 'label': LABELS[item['id']], 'status': 'unknown',
                         'codes': ['RECEIPT_UNREADABLE'], 'lastSuccessAt': None}
        components.append(component)
    try:
        components.append(space_guard(root, lib, tasks.get(SPACE_GUARD['id']), now))
    except (OSError, ValueError, TypeError, KeyError):
        components.append({'id': SPACE_GUARD['id'], 'label': LABELS[SPACE_GUARD['id']], 'status': 'unknown',
                           'codes': ['RECEIPT_UNREADABLE'], 'lastSuccessAt': None})
    bad = [x for x in components if x['status'] in BAD]
    # A guard waiting for registration must not turn the backups into 'pending'; that would block recovery notices.
    state = 'attention' if bad else ('pending' if any(x['status'] not in ('healthy', 'not_ready') for x in components) else 'healthy')
    return {'schemaVersion': 1, 'checkedAt': lib.stamp(now), 'status': state, 'components': components,
            'issues': [{'component': x['id'], 'code': c} for x in bad for c in (x['codes'] or ['BACKUP_FAILED'])],
            'scope': '예약·최근 실행·원격 검증 영수증. 실제 복호화·전체 복원 성공과 구분한다.'}


def choose_event(summary, previous, now, lib):
    bad = [x for x in summary['components'] if x['status'] in BAD]
    signature = [(x['id'], x['status'], x['codes']) for x in bad]
    digest = hashlib.sha256(json.dumps(signature, sort_keys=True).encode()).hexdigest()
    last_reminder = lib.instant(previous.get('lastNotifiedAt'))
    repeat_due = bad and last_reminder and now - last_reminder >= dt.timedelta(hours=24)
    waiting_recovery = (previous.get('pendingEvent') or {}).get('status') == 'healthy'
    recovery = not bad and summary['status'] == 'healthy' and previous.get('hasUnresolved') and not waiting_recovery
    changed = digest != previous.get('fingerprint')
    if not ((bad and (changed or repeat_due)) or recovery): return None, digest, bool(bad)
    title = 'SYNK 백업 확인 필요' if bad else 'SYNK 백업 정상 복구'
    body = ' · '.join(x['label'] + ': ' + (x.get('detail') or STATUS_LABELS.get(x['status'], '확인 필요')) for x in bad)
    body = body or '네 저장소의 예약과 최근 백업 검증이 정상으로 돌아왔습니다.'
    event_id = hashlib.sha256((digest + lib.stamp(now)).encode()).hexdigest()
    return {'schemaVersion': 1, 'id': event_id, 'at': lib.stamp(now), 'title': title, 'body': body,
            'status': summary['status'], 'issues': summary['issues']}, digest, bool(bad)


def deliver(root, event, lib):
    event_path = root / '상태' / '알림' / (event['id'] + '.json')
    lib.atomic_json(event_path, event)
    try:
        result = subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-File', str(TOOLS / 'backup-notify.ps1'), '-EventPath', str(event_path)],
            capture_output=True, timeout=20, creationflags=0x08000000 if os.name == 'nt' else 0)
        receipt = json.loads(result.stdout.decode('utf-8-sig'))
        if result.returncode: receipt['accepted'] = False
    except (OSError, ValueError, subprocess.TimeoutExpired):
        receipt = {'channel': 'windows-notification', 'accepted': False, 'code': 'NOTIFICATION_DELIVERY_FAILED'}
    receipt['eventId'] = event['id']
    receipt['checkedAt'] = lib.stamp()
    lib.atomic_json(event_path.with_suffix('.delivery.json'), receipt)
    return receipt


def update_notifications(root, summary, lib, now, sender=deliver):
    path = root / 'backup-notification-state.json'
    try:
        previous = lib.read_json(path) or {}
        if not isinstance(previous, dict): previous = {}
    except (OSError, ValueError):
        previous = {}
    event, digest, unresolved = choose_event(summary, previous, now, lib)
    pending = previous.get('pendingEvent')
    # A changed/recovered state supersedes an undelivered obsolete failure.
    if event: pending = event
    elif pending:
        if pending.get('status') == 'attention' and not unresolved:
            pending = None
        elif pending.get('status') == 'healthy' and summary['status'] != 'healthy':
            pending = None
    notification = {'channel': 'windows-notification', 'accepted': None, 'newEvent': bool(event)}
    if pending:
        notification = sender(root, pending, lib)
        notification['newEvent'] = bool(event)
        if notification.get('accepted'):
            previous['lastNotifiedAt'] = lib.stamp(now)
            previous['lastDeliveredEventId'] = pending['id']
            pending = None
    recovered_and_delivered = summary['status'] == 'healthy' and notification.get('accepted') is True
    previous.update(fingerprint=digest, hasUnresolved=unresolved or (previous.get('hasUnresolved', False) and not recovered_and_delivered),
                    checkedAt=lib.stamp(now), pendingEvent=pending, delivery=notification)
    lib.atomic_json(path, previous)
    return notification


def check(root, lib, now):
    lib.monitor(root, now)
    config_path = root / 'backup-health-config.json'
    config = lib.read_json(config_path)
    if not config: raise RuntimeError('BACKUP_HEALTH_CONFIG_MISSING')
    tasks = task_snapshot(config_path, (SPACE_GUARD,))
    return gather(root, lib, config, tasks, now, functools.cache(suspensions))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    parser.add_argument('--notify', action='store_true')
    parser.add_argument('--test-notification', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve(); lib = load_legacy(root); now = lib.utcnow()
    if args.test_notification:
        event = {'id': hashlib.sha256(('test-' + lib.stamp(now)).encode()).hexdigest(), 'at': lib.stamp(now),
                 'title': 'SYNK 백업 알림 시험', 'body': '실제 장애가 아닙니다. 백업 실패·누락 알림의 Windows 전달을 확인합니다.'}
        result = deliver(root, event, lib)
        print(json.dumps(result, ensure_ascii=False)); return 0 if result.get('accepted') else 1
    try:
        with lib.LocalLock(root / '.backup-health.lock'):
            asleep = suspended_seconds()
            try:
                summary = check(root, lib, now)
            except Exception:
                # A check the PC slept through can fail on its own timers: the 14:02 check on 10-20 started while the PC
                # was going to sleep and sent 「백업 감시: 상태 확인 불가」 4 seconds after it woke. It runs once more.
                later = suspended_seconds()
                if asleep is None or later is None or later - asleep < 1: raise
                now = lib.utcnow()
                summary = check(root, lib, now)
            if args.notify: summary['notification'] = update_notifications(root, summary, lib, now)
            lib.atomic_json(root / 'backup-health.json', summary)
            if sys.stdout: print(json.dumps(summary, ensure_ascii=False))
            return 1 if summary['status'] == 'attention' or summary.get('notification', {}).get('accepted') is False else 0
    except BlockingIOError:
        return 0
    except Exception:
        summary = {'schemaVersion': 1, 'checkedAt': lib.stamp(now), 'status': 'attention',
                   'components': [{'id': 'monitor', 'label': '백업 감시', 'status': 'unknown', 'codes': ['MONITOR_FAILED']}],
                   'issues': [{'component': 'monitor', 'code': 'MONITOR_FAILED'}]}
        if args.notify: summary['notification'] = update_notifications(root, summary, lib, now)
        lib.atomic_json(root / 'backup-health.json', summary)
        if sys.stdout: print(json.dumps(summary, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    sys.exit(main())
