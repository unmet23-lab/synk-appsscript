"""Four-store backup health, schedule checks and durable Windows notifications."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

TOOLS = Path(__file__).resolve().parent
DEFAULT_ROOT = TOOLS.parent.parent / 'SYNK_원본창고'
BAD = {'failed', 'partial_failure', 'attention', 'blocked', 'unknown', 'missed', 'interrupted', 'unconfigured'}
GOOD = {'healthy', 'success'}
LABELS = {'onedrive': 'OneDrive 문서·소스', 'github': 'GitHub 커밋',
          'server': '20TB 서버·DB', 'media': '20TB 미디어 원본', 'archive': '5TB 기존 원본',
          'workspace': '20TB 업무 문서·첨부·조사 상태'}
STATUS_LABELS = {'healthy': '정상', 'pending': '동기화 대기', 'running': '실행 중', 'paused': '의도적 중지',
                 'attention': '확인 필요', 'failed': '실패', 'missed': '최신 백업 지연', 'interrupted': '실행 중단',
                 'partial_failure': '일부 실패', 'unknown': '상태 확인 불가', 'blocked': '준비 미완료'}


def load_legacy(root):
    spec = importlib.util.spec_from_file_location('synk_backup_status', Path(root) / '백업상태.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def safe_codes(receipt):
    return sorted(set(x.get('code') for x in receipt.get('issues', [])
        if isinstance(x, dict) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,99}', str(x.get('code', '')))))


def evaluate(item, receipt, now, lib, task=None, installed_at=None, repair=None):
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
    if state == 'running':
        heartbeat = lib.instant(receipt.get('heartbeatAt') or receipt.get('checkedAt') or receipt.get('startedAt'))
        start = lib.instant(receipt.get('startedAt'))
        if not lib.process_alive(receipt.get('pid')) or not heartbeat or now - heartbeat > dt.timedelta(minutes=15):
            state = 'interrupted'; codes.append('PROCESS_OR_HEARTBEAT_MISSING')
        elif not start or now - start > dt.timedelta(hours=item.get('maxRunHours', 6)):
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
    return {'id': item['id'], 'label': LABELS[item['id']], 'status': state,
            'checkedAt': lib.stamp(checked) if checked else None,
            'lastSuccessAt': lib.stamp(success) if success else None, 'repaired': repaired,
            'repairedAt': lib.stamp(repaired_at) if repaired_at else None,
            'codes': sorted(set(codes)), 'task': task,
            'scope': item.get('scope'), 'receiptPath': item['receipt']}


def task_snapshot(config_path):
    result = subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', str(TOOLS / 'backup-task-status.ps1'), '-ConfigPath', str(config_path)],
        capture_output=True, timeout=45, creationflags=0x08000000 if os.name == 'nt' else 0)
    if result.returncode: raise RuntimeError('SCHEDULE_QUERY_FAILED')
    values = json.loads(result.stdout.decode('utf-8-sig'))
    return {x['id']: x for x in values}


def gather(root, lib, config, tasks, now):
    components = []
    for item in config['components'] + config.get('additionalChecks', []):
        try:
            receipt = lib.read_json(root / item['receipt'])
            if item['id'] == 'onedrive' and receipt and receipt.get('status') == 'running' and not receipt.get('pid'):
                owner = lib.read_json(root / '상태' / 'OneDrive' / 'run.lock') or {}
                if owner.get('runId') == receipt.get('runId'):
                    receipt = dict(receipt, pid=owner.get('pid'))
            repair = lib.read_json(root / 'backup-repair-status.json') if item['id'] == 'server' else None
            if item['id'] == 'server':
                derived = lib.local_summary(root, now)
                receipt = dict(receipt or {}, status=derived['status'], issues=derived['issues'])
            task = dict(tasks.get(item['id'], {'exists': False}))
            auxiliary = [x for x in config.get('auxiliaryTasks', []) if x.get('component') == item['id']]
            if auxiliary:
                task['auxiliaryTasks'] = [tasks.get(x['id'], {'id':x['id'], 'exists':False}) for x in auxiliary]
            component = evaluate(item, receipt, now, lib, task,
                lib.instant(item.get('installedAt') or config.get('installedAt')), repair)
        except (OSError, ValueError, TypeError, KeyError):
            component = {'id': item['id'], 'label': LABELS[item['id']], 'status': 'unknown',
                         'codes': ['RECEIPT_UNREADABLE'], 'lastSuccessAt': None}
        components.append(component)
    bad = [x for x in components if x['status'] in BAD]
    state = 'attention' if bad else ('pending' if any(x['status'] != 'healthy' for x in components) else 'healthy')
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
    body = ' · '.join(x['label'] + ': ' + STATUS_LABELS.get(x['status'], '확인 필요') for x in bad)
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
            lib.monitor(root, now)
            config_path = root / 'backup-health-config.json'
            config = lib.read_json(config_path)
            if not config: raise RuntimeError('BACKUP_HEALTH_CONFIG_MISSING')
            tasks = task_snapshot(config_path)
            summary = gather(root, lib, config, tasks, now)
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
