"""Run the contest eligibility check without showing a console and record its exit (2026-11-20).

왜: 지도 갱신 회차(09:30 · 15:30 · 21:00)는 그록 · Gemini 비교에 시간을 거의 다 써서, 자격 확인 몫이 1분 남짓만 남았다(11-20 09:30 회차 0번 물음).
  그래서 자격 확인을 따로 하루 두 번, 35분씩 돌린다. 설치는 tools/install-contest-eligibility.ps1.
"""
from datetime import datetime
from pathlib import Path
import subprocess
import sys


def main():
    node, worker = map(Path, sys.argv[1:3])
    folder = Path.home() / "Documents" / "SYNK-보관함" / "지원사업"
    folder.mkdir(parents=True, exist_ok=True)
    log = folder / "자격확인실행.log"
    with log.open("ab") as out:
        def record(message):
            timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
            out.write(f"\n{timestamp} {message}\n".encode("utf-8"))
            out.flush()

        record("시작")
        try:
            run = subprocess.run(
                [str(node), str(worker), "--분", "35"], cwd=worker.parent.parent, stdout=out,
                stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW,
                timeout=2400,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            record(f"종료 1 · 자격 확인 예약 실행 오류 {error}")
            return 1
        record(f"종료 {run.returncode}")
        return run.returncode


if __name__ == "__main__":
    sys.exit(main())
