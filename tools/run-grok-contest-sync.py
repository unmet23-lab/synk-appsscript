"""Run the contest map job without showing a console and record its exit."""
from pathlib import Path
import subprocess
import sys


def main():
    node, worker = map(Path, sys.argv[1:])
    report_dir = Path.home() / "Documents" / "SYNK-보관함" / "지원사업" / "그록공모전"
    report_dir.mkdir(parents=True, exist_ok=True)
    log = report_dir / "예약실행.log"
    with log.open("wb") as out:
        try:
            run = subprocess.run(
                [str(node), str(worker)], cwd=worker.parent, stdout=out,
                stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW,
                timeout=1100,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            out.write(("\n공모 지도 예약 실행 오류 " + str(error) + "\n").encode())
            return 1
        out.write(f"\n종료 {run.returncode}\n".encode())
        return run.returncode


if __name__ == "__main__":
    sys.exit(main())
