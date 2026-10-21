"""Windows 작업 스케줄러 「SYNK 게시 성과 판정」이 창 없이 판정을 돌리는 입구 — pythonw로 부른다(SYNK 팁 적용안과 같은 방식).

  pythonw.exe -X utf8 -B tools/게시성과예약/run-hidden.py

node tools/게시성과.js --실행 을 창 없이 띄우고 마지막 출력만 output/게시성과/예약실행.log에 덮어쓴다.
AI를 부르지 않는다. 등록은 같은 폴더의 install-task.ps1.
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")


def main():
    env = dict(os.environ)
    log = ROOT / "output" / "게시성과" / "예약실행.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run([str(NODE), str(ROOT / "tools" / "게시성과.js"), "--실행"], cwd=ROOT, env=env,
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=1800)
    except subprocess.TimeoutExpired as e:
        log.write_bytes((e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b"") + "\n--- 30분 넘어 멈춤 ---\n".encode())
        return 1
    log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
