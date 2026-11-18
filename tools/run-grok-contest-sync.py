"""Run the contest map job without showing a console and record its exit."""
from datetime import datetime
from pathlib import Path
import subprocess
import sys


def main():
    node, worker = map(Path, sys.argv[1:])
    report_dir = Path.home() / "Documents" / "SYNK-보관함" / "지원사업" / "그록공모전"
    report_dir.mkdir(parents=True, exist_ok=True)
    log = report_dir / "예약실행.log"
    with log.open("ab") as out:
        def record(message):
            timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
            out.write(f"\n{timestamp} {message}\n".encode("utf-8"))
            out.flush()

        record("시작")
        try:
            run = subprocess.run(
                [str(node), str(worker)], cwd=worker.parent, stdout=out,
                stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW,
                timeout=1100,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            record(f"종료 1 · 공모 지도 예약 실행 오류 {error}")
            return 1
        record(f"종료 {run.returncode}")
        return run.returncode


if __name__ == "__main__":
    sys.exit(main())
