"""Windows 작업 스케줄러 「SYNK tip ledger sync」가 창 없이 팁 장부 동기를 돌리는 입구 — pythonw로 부른다.

  pythonw.exe -X utf8 -B tools/팁장부동기예약/run-hidden.py

node tools/팁장부동기.js --실행 --조용히 를 창·입력 없이 띄우고 마지막 회차의 출력만 저장소 밖
%LOCALAPPDATA%/synk/팁장부동기/예약실행.log 에 덮어쓴다. 첫 줄에 이번 회차 시작 시각, 끝 줄에 결과와 끝난 시각을 적는다.
회차마다의 숫자는 도구가 같은 폴더의 기록.jsonl에 남긴다. AI를 부르지 않는다. 등록은 같은 폴더의 install-task.ps1(운영 사본 경로만).
끝 코드는 도구 그대로다(0 정상 · 3 작업실 자격 없음 · 4 다른 동기가 도는 중 · 5 상태열쇠 없음 · 1 그 밖).
"""
import datetime
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")
TOOL = ROOT / "tools" / "팁장부동기.js"
LOG = pathlib.Path(os.environ.get("LOCALAPPDATA", pathlib.Path.home() / "AppData" / "Local")) / "synk" / "팁장부동기" / "예약실행.log"
TIMEOUT = 4 * 60  # 5분 회차 안에서 끝낸다. 작업 스케줄러 한도는 10분.


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def write_log(started, body, ending):
    LOG.write_bytes(f"--- 회차 {started} ---\n".encode("utf-8") + body + f"\n--- {ending} · {now()} ---\n".encode("utf-8"))


def main():
    started = now()
    LOG.parent.mkdir(parents=True, exist_ok=True)
    if not NODE.is_file() or not TOOL.is_file():
        write_log(started, f"node 또는 도구 파일이 없습니다: {NODE} / {TOOL}".encode("utf-8"), "시작 못 함 · 종료 2")
        return 2
    try:
        r = subprocess.run([str(NODE), str(TOOL), "--실행", "--조용히"], cwd=ROOT, stdin=subprocess.DEVNULL, capture_output=True,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=TIMEOUT)
    except subprocess.TimeoutExpired as e:
        write_log(started, (e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b""), f"{TIMEOUT // 60}분 지나 종료")
        return 1
    except OSError as e:
        write_log(started, f"도구를 띄우지 못했습니다: {type(e).__name__}: {e}".encode("utf-8"), "시작 못 함 · 종료 2")
        return 2
    write_log(started, r.stdout + b"\n--- stderr ---\n" + r.stderr, f"종료 {r.returncode}")
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
