import subprocess, json, re, collections, datetime

raw = subprocess.check_output(['journalctl', '-u', 'radio-live', '--since', '90 minutes ago', '--no-pager', '-o', 'json'], text=True)
counts = collections.Counter()
speeds = collections.defaultdict(list)
incidents = []
stats = []
for row in raw.splitlines():
    try:
        record = json.loads(row)
    except ValueError:
        continue
    message = str(record.get('MESSAGE', ''))
    stamp = datetime.datetime.fromtimestamp(int(record.get('__REALTIME_TIMESTAMP', '0')) / 1e6, datetime.timezone.utc).isoformat()
    pid = record.get('_PID', '?')
    # Never emit chat identifiers or credentials, even for a matching error.
    if any(x in message for x in ['처음 말을 건', '사건 넣었다', '채팅', '닉네임']):
        continue
    safe = re.sub(r'rtmps?://\S+', '[RTMP REDACTED]', message)
    safe = re.sub(r'https?://\S+', '[URL REDACTED]', safe)
    if '실시간대비' in safe:
        match = re.search(r'실시간대비\s+([\d.]+)x', safe)
        if match:
            speeds[pid].append({'t': stamp, 'speed': float(match[1])})
        stats.append({'t': stamp, 'pid': pid, 'message': safe})
    if re.search(r'Non-monoton|non.monoton|DTS|PTS|timestamp|queue|Connection|Broken pipe|Error|error|Failed|failed|Stopped|Started|Stopping|Scheduled restart|ffmpeg 끝|방송 시각이|스스로 나간다|Killed|killed|Main process exited|Consumed', safe):
        counts[re.sub(r'\d+', 'N', safe[:180])] += 1
        incidents.append({'t': stamp, 'pid': pid, 'message': safe[:700]})

print(json.dumps({
    'timeUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'service': subprocess.check_output(['systemctl', 'show', 'radio-live', '--property=ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestamp,ExecMainCode,ExecMainStatus,CPUUsageNSec,MemoryCurrent'], text=True),
    'processes': subprocess.check_output(['ps', '-C', 'ffmpeg,node,chromium', '-o', 'pid,ppid,pcpu,pmem,etimes,stat,comm'], text=True),
    'cpuPressure': open('/proc/pressure/cpu').read(),
    'memPressure': open('/proc/pressure/memory').read(),
    'speedSummary': {p: {'count': len(v), 'min': min(x['speed'] for x in v), 'max': max(x['speed'] for x in v), 'first': v[0], 'last': v[-1], 'below098': [x for x in v if x['speed'] < .98]} for p, v in speeds.items()},
    'lastStats': stats[-15:],
    'priorRestartStats': [s for s in stats if s['pid'] == '137314'],
    'incidentCounts': counts,
    'incidents': incidents[-100:],
}, ensure_ascii=False, indent=2))
