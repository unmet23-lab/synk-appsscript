"""Run a configured backup without a console window; preserve the child's exit status."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--id', required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    item = next(x for x in config['components'] + config.get('auxiliaryTasks', []) if x['id'] == args.id)
    command = item['command']
    if not command or not all(isinstance(x,str) for x in command): return 2
    flags = 0x08000000 if os.name == 'nt' else 0
    try:
        process = subprocess.Popen(command, cwd=item['workingDirectory'], stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
        try:
            return process.wait(timeout=item['maxRunHours']*3600)
        except subprocess.TimeoutExpired:
            if os.name == 'nt':
                subprocess.run(['taskkill.exe','/PID',str(process.pid),'/T','/F'],
                               stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags,timeout=20)
            else: process.kill()
            process.wait(timeout=20)
            return 124
    except OSError:
        return 2


if __name__ == '__main__': sys.exit(main())
