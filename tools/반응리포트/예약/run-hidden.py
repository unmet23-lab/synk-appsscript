"""Windows 작업 스케줄러 「SYNK 반응 리포트 랜딩 받기」가 창 없이 Clarity 하루 숫자를 받는 입구 — pythonw로 부른다(게시 성과 판정과 같은 꼴).

  pythonw.exe -X utf8 -B tools/반응리포트/예약/run-hidden.py

node tools/반응리포트/리포트.js 랜딩받기 --전부 를 창 없이 띄우고 마지막 출력만 output/반응리포트/예약실행.log에 덮어쓴다.
AI를 부르지 않는다. 3시간마다 깨지만 23시간 안에 받았으면 아무것도 부르지 않는다(Clarity API는 프로젝트마다 하루 10번, 받을 때 3번).
등록은 같은 폴더의 install-task.ps1.
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")


def main():
    env = dict(os.environ)
    log = ROOT / "output" / "반응리포트" / "예약실행.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run([str(NODE), str(ROOT / "tools" / "반응리포트" / "리포트.js"), "랜딩받기", "--전부"], cwd=ROOT, env=env,
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=300)
    except subprocess.TimeoutExpired as e:
        log.write_bytes((e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b"") + "\n--- 5분 넘어 멈춤 ---\n".encode())
        return 1
    log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
