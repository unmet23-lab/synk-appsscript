"""Run a configured backup without a console window; preserve the child's exit status.

The run limit counts from this wrapper's own start, which is the scheduled start: under load the interpreter alone can
take tens of seconds to start, and a limit counted from the child's start could fall after the Task Scheduler limit one
minute later. On Windows the child runs in a job object, so at the limit the whole job (the backup and its git/pwsh
children) ends at once without starting a new process. Before (10-20), ending it needed taskkill.exe, which itself took
seconds to start at this priority under load; a taskkill slower than 20 seconds raised an uncaught TimeoutExpired that
ended only this wrapper and left the backup running. The wait does not count time the PC spends asleep (Windows 8+),
so a run that was suspended by a closed lid is not cut short. The job does not end the backup when this wrapper is ended
from outside: whether Task Scheduler's own limit counts sleep is not known here, and a run stretched by sleep should
finish rather than be killed (10-20 12:01 run: 59.6 minutes on the clock, 46.4 of them asleep).
Each start and end is one line in 상태/예약실행/<id>.jsonl next to the config (Task Scheduler history is off).
"""
import argparse
import ctypes
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import time

CREATE_NO_WINDOW, CREATE_SUSPENDED = 0x08000000, 0x00000004
TRACE_LIMIT_BYTES = 256 * 1024


def started_seconds_ago():
    """Seconds since this process was created (the scheduled start). 0 where it cannot be read."""
    if os.name != 'nt': return 0.0
    from ctypes import wintypes
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.GetCurrentProcess.restype = wintypes.HANDLE
    k32.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
    k32.GetSystemTimePreciseAsFileTime.argtypes = [ctypes.POINTER(wintypes.FILETIME)]
    times, now = [wintypes.FILETIME() for _ in range(4)], wintypes.FILETIME()
    if not k32.GetProcessTimes(k32.GetCurrentProcess(), *map(ctypes.byref, times)): return 0.0
    k32.GetSystemTimePreciseAsFileTime(ctypes.byref(now))
    ticks = lambda value: (value.dwHighDateTime << 32) | value.dwLowDateTime
    return max(0.0, (ticks(now) - ticks(times[0])) / 1e7)


class Job:
    """A Windows job object holding the backup and everything it starts, so the limit can end them all at once."""

    def __init__(self):
        from ctypes import wintypes
        k32 = self.k32 = ctypes.WinDLL('kernel32', use_last_error=True)
        k32.CreateJobObjectW.restype = wintypes.HANDLE
        k32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        k32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        k32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
        self.ntdll = ctypes.WinDLL('ntdll')
        self.ntdll.NtResumeProcess.argtypes = [wintypes.HANDLE]
        self.handle = k32.CreateJobObjectW(None, None)
        if not self.handle: raise ctypes.WinError(ctypes.get_last_error())

    def start(self, process):
        """Put a process created suspended into the job, then let it run. Its later children join the job too."""
        assigned = bool(self.k32.AssignProcessToJobObject(self.handle, int(process._handle)))
        if self.ntdll.NtResumeProcess(int(process._handle)) != 0: raise OSError('resume-failed')
        return assigned

    def terminate(self, code):
        return bool(self.k32.TerminateJobObject(self.handle, code))


def trace(config, item_id, **fields):
    """One line per start/end. Never fails the backup; keeps one previous file after TRACE_LIMIT_BYTES."""
    try:
        file = config.parent / '상태' / '예약실행' / f'{item_id}.jsonl'
        file.parent.mkdir(parents=True, exist_ok=True)
        if file.exists() and file.stat().st_size > TRACE_LIMIT_BYTES: os.replace(file, file.with_name(f'{item_id}.1.jsonl'))
        line = {'at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'pid': os.getpid(), **fields}
        with file.open('a', encoding='utf-8', newline='\n') as output: output.write(json.dumps(line, ensure_ascii=False) + '\n')
    except (OSError, ValueError):
        pass


def stop(process, job):
    """End the child and everything it started. A job needs no new process; otherwise taskkill, then the child alone."""
    if not (job and job.terminate(124)):
        if os.name == 'nt':
            try:
                subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, creationflags=CREATE_NO_WINDOW, timeout=120)
            except (OSError, subprocess.SubprocessError):
                pass
        try: process.kill()
        except OSError: pass
    try: process.wait(timeout=60)
    except subprocess.TimeoutExpired: pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--id', required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    item = next(x for x in config['components'] + config.get('auxiliaryTasks', []) if x['id'] == args.id)
    command = item['command']
    if not command or not all(isinstance(x,str) for x in command): return 2
    flags = CREATE_NO_WINDOW if os.name == 'nt' else 0
    limit = item['maxRunHours'] * 3600
    job = None
    if os.name == 'nt':
        try: job = Job()
        except OSError: job = None
    try:
        process = subprocess.Popen(command, cwd=item['workingDirectory'], stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags | (CREATE_SUSPENDED if job else 0))
    except OSError:
        return 2
    if job:
        try:
            if not job.start(process): job = None
        except OSError:
            process.kill(); return 2
    startup = started_seconds_ago()
    trace(args.config, args.id, event='start', child=process.pid, startupSeconds=round(startup, 1), limitSeconds=round(limit), job=job is not None)
    try:
        code, reason = process.wait(timeout=max(1.0, limit - startup)), 'exit'
    except subprocess.TimeoutExpired:
        stopping = time.monotonic()
        stop(process, job)
        code, reason = 124, 'limit'
        trace(args.config, args.id, event='stopped', child=process.pid, stopSeconds=round(time.monotonic() - stopping, 1))
    trace(args.config, args.id, event='end', child=process.pid, exitCode=code, reason=reason, seconds=round(started_seconds_ago()))
    return code


if __name__ == '__main__': sys.exit(main())
