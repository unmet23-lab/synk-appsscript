"""Windows 작업 스케줄러 「SYNK 스레드 21시 게시」가 창 없이 게시를 돌리는 입구 — pythonw로 부른다.

  pythonw.exe -X utf8 -B tools/스레드예약/run-hidden.py

node tools/스레드예약/게시.js 를 창 없이 띄우고 마지막 출력만 ~/ego/threads-daily/예약실행.log에 덮어쓴다.
AI를 부르지 않는다. 등록은 같은 폴더의 install-task.ps1. 무엇을 왜 하는지는 게시.js 머리말에 있다.
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")


def main():
    log = pathlib.Path.home() / "ego" / "threads-daily" / "예약실행.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run([str(NODE), str(ROOT / "tools" / "스레드예약" / "게시.js")], cwd=ROOT,
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=660)
    except subprocess.TimeoutExpired as e:
        log.write_bytes((e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b"") + "\n--- 11분 넘어 멈춤 ---\n".encode())
        return 1
    log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
