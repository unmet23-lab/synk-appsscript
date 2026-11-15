"""Windows 작업 스케줄러 「SYNK account metrics routine」이 창 없이 계정 통계 루틴을 돌리는 입구 — pythonw로 부른다.

  pythonw.exe -X utf8 -B tools/계정통계예약/run-hidden.py

node tools/계정통계루틴.cjs --실행 을 창·입력 없이 띄우고 마지막 회차의 출력만 저장소 밖
~/.synk/account-metrics/logs/예약실행.log 에 덮어쓴다. 첫 줄에 이번 회차 시작 시각, 끝 줄에 결과와 끝난 시각을 적어 지난 회차 기록과 헷갈리지 않게 한다.
node를 띄우지 못하면(OSError: 권한·작업 폴더·실행 파일 문제) 그 시각과 원인을 남기고 2로 끝낸다. 회차별 기록·증거·영수증은 루틴이 같은 상태 폴더에 따로 남긴다.
AI를 부르지 않는다. 등록은 같은 폴더의 install-task.ps1(운영 사본 경로만 등록한다).
"""
import datetime
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")
ROUTINE = ROOT / "tools" / "계정통계루틴.cjs"
LOG = pathlib.Path.home() / ".synk" / "account-metrics" / "logs" / "예약실행.log"
TIMEOUT = 25 * 60  # 작업 스케줄러 한도(30분) 안에서 끝낸다. 루틴 자체 예산은 15분.


def now():
    """회차를 가릴 수 있게 시간대가 붙은 지금 시각(초까지)."""
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def write_log(started, body, ending):
    """마지막 회차 기록을 덮어쓴다. 첫 줄은 이번 회차 시작 시각, 끝 줄은 결과와 끝난 시각."""
    LOG.write_bytes(f"--- 회차 {started} ---\n".encode("utf-8") + body + f"\n--- {ending} · {now()} ---\n".encode("utf-8"))


def main():
    started = now()
    LOG.parent.mkdir(parents=True, exist_ok=True)
    if not NODE.is_file() or not ROUTINE.is_file():
        write_log(started, f"node 또는 루틴 파일이 없습니다: {NODE} / {ROUTINE}".encode("utf-8"), "시작 못 함 · 종료 2")
        return 2
    try:
        r = subprocess.run([str(NODE), str(ROUTINE), "--실행"], cwd=ROOT, stdin=subprocess.DEVNULL, capture_output=True,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=TIMEOUT)
    except subprocess.TimeoutExpired as e:
        write_log(started, (e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b""), "25분 넘어 멈춤 · 종료 1")
        return 1
    except OSError as e:
        # node를 띄우지 못함(권한·작업 폴더 없음·실행 파일이 그 사이 사라짐 등). 지난 회차 기록이 성공처럼 남지 않게 이번 시각과 원인으로 덮어쓴다.
        write_log(started, f"루틴을 띄우지 못했습니다: {type(e).__name__}: {e}".encode("utf-8"), "시작 못 함 · 종료 2")
        return 2
    write_log(started, r.stdout + b"\n--- stderr ---\n" + r.stderr, f"종료 {r.returncode}")
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
