"""Run the collection runner (tools/수집/돌리기.js) without a console window and record its exit.

Windows task "SYNK 수집" calls this every 30 minutes from the ops copy (2026-11-25).
The runner itself decides which collection is due and exits at once when nothing is.
"""
from datetime import datetime
from pathlib import Path
import subprocess
import sys


def main():
    node, worker = map(Path, sys.argv[1:3])
    log_dir = Path.home() / "Documents" / "SYNK-appsscript" / ".tmp" / "수집"
    log_dir.mkdir(parents=True, exist_ok=True)
    log = log_dir / "예약실행.log"
    with log.open("ab") as out:
        def record(message):
            timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
            out.write(f"\n{timestamp} {message}\n".encode("utf-8"))
            out.flush()

        record("시작")
        try:
            run = subprocess.run(
                [str(node), str(worker)], cwd=worker.parent.parent.parent, stdout=out,
                stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW,
                timeout=4 * 3600,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            record(f"종료 1 · 수집 예약 실행 오류 {error}")
            return 1
        record(f"종료 {run.returncode}")
        return run.returncode


if __name__ == "__main__":
    sys.exit(main())
