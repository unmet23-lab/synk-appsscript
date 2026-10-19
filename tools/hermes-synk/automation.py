"""Official Hermes no-agent cron entrypoint: durable, private, at-most-once alerts."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone


def save(file, data):
    file.parent.mkdir(parents=True, exist_ok=True)
    temp = file.with_name(file.name + f'.{os.getpid()}.tmp')
    with temp.open('w', encoding='utf-8') as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, file)


def deliver(folder, item, sender, recipient):
    """Persist send intent first. An interrupted/unknown attempt is never replayed."""
    if item.get('needs_attention') is not True:
        return 'suppressed_success'
    identity = item.get('id', '')
    if not re.fullmatch(r'(?:event-[a-f0-9]{24}|daily-\d{4}-\d{2}-\d{2}|health-[a-f0-9]{24}|setup-\d{8})', identity):
        raise ValueError('invalid notification identity')
    message = str(item.get('text', ''))[:3400].replace('MEDIA:', 'MEDIA :').replace('[[as_document]]', '').replace('[[audio_as_voice]]', '')
    if not message:
        return 'empty'
    claim = folder / (identity + '.claim')
    receipt = folder / (identity + '.receipt.json')
    folder.mkdir(parents=True, exist_ok=True)
    try:
        with claim.open('x', encoding='utf-8') as handle:
            handle.write(datetime.now(timezone.utc).isoformat())
            handle.flush()
            os.fsync(handle.fileno())
    except FileExistsError:
        return 'already_claimed'
    status = {'id': identity, 'status': 'unconfirmed', 'attemptedAt': datetime.now(timezone.utc).isoformat()}
    save(receipt, status)
    try:
        response = sender({'action': 'send', 'target': 'telegram:' + recipient, 'message': message})
        if isinstance(response, str):
            response = json.loads(response)
        message_id = response.get('message_id') or (response.get('result') or {}).get('message_id')
        if response.get('success') is True and message_id:
            status.update(status='sent', message_id=str(message_id))
    except Exception:
        pass
    save(receipt, status)
    return status['status']


def check_manifest(config):
    for record in config.get('files', []):
        file = Path(record['path'])
        if file.is_symlink() or not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != record['sha256']:
            return False
    return bool(config.get('files'))


def health_failure(folder, kind, message, sender, recipient):
    try:
        before = json.loads((folder / 'health.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        before = {}
    started = before.get('incidentAt') if before.get('status') == kind else None
    started = started or datetime.now(timezone.utc).isoformat()
    identity = 'health-' + hashlib.sha256((kind + started).encode()).hexdigest()[:24]
    save(folder / 'health.json', {'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': kind, 'incidentAt': started, 'noAgent': True})
    return deliver(folder / 'outbox', {'id': identity, 'needs_attention': True, 'text': message}, sender, recipient)


def main():
    home = Path(os.environ.get('HERMES_HOME') or Path(os.environ['LOCALAPPDATA']) / 'hermes').resolve()
    sys.path.insert(0, str(home / 'hermes-agent'))
    from hermes_cli.env_loader import load_hermes_dotenv
    load_hermes_dotenv(hermes_home=home)
    from tools.send_message_tool import send_message_tool
    folder = home / 'runtime' / 'synk-automation'
    config = json.loads((folder / 'config.json').read_text(encoding='utf-8'))
    recipient = str(config.get('recipient', ''))
    allowed = set(re.split(r'[\s,;]+', os.environ.get('TELEGRAM_ALLOWED_USERS', '')))
    if not recipient.isdecimal() or recipient not in allowed:
        raise RuntimeError('SYNK recipient authorization unavailable')
    if not check_manifest(config):
        health_failure(folder, 'source_contract_changed', 'SYNK 자동 조회를 잠시 멈췄습니다. 연결 코드나 Hermes 버전이 바뀌어 호환 확인이 필요합니다. 기존 팁 봇과 작업 결과는 각 기존 경로에서 확인할 수 있습니다.', send_message_tool, recipient)
        return
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    env = os.environ.copy()
    env['HERMES_HOME'] = str(home)
    try:
        result = subprocess.run([config['node'], config['monitor']], capture_output=True, text=True, encoding='utf-8', timeout=90, env=env, creationflags=flags)
        if result.returncode:
            raise RuntimeError('collector_failed')
        report = json.loads(result.stdout)
        if report.get('busy'):
            try:
                before = json.loads((folder / 'health.json').read_text(encoding='utf-8'))
            except (OSError, ValueError):
                before = {}
            started = before.get('incidentAt') if before.get('status') == 'collector_busy' else None
            started = started or datetime.now(timezone.utc).isoformat()
            if (datetime.now(timezone.utc) - datetime.fromisoformat(started)).total_seconds() >= 600:
                health_failure(folder, 'collector_busy', 'SYNK 자동 조회 잠금이 10분 이상 풀리지 않았습니다. 중복 실행을 막기 위해 조회를 보류했습니다. 기존 작업을 재실행하지 않았습니다.', send_message_tool, recipient)
            else:
                save(folder / 'health.json', {'checkedAt': datetime.now(timezone.utc).isoformat(), 'status': 'collector_busy', 'incidentAt': started, 'noAgent': True})
            return
        for item in report.get('notifications', []):
            deliver(folder / 'outbox', item, send_message_tool, recipient)
        save(folder / 'health.json', {'checkedAt':datetime.now(timezone.utc).isoformat(),'status':'ok','noAgent':True})
    except Exception:
        health_failure(folder, 'collector_failed', 'SYNK 자동 조회가 현재 자료를 읽지 못했습니다. 결과를 완료로 바꾸거나 작업을 재실행하지 않았습니다. /synk_today에서 확인할 수 있습니다.', send_message_tool, recipient)


if __name__ == '__main__':
    main()
