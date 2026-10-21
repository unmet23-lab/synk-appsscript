"""Windows 작업 스케줄러가 크레딧 작업을 창 없이 돌리는 입구 — pythonw로 부른다(SYNK 백업 예약과 같은 방식).

  pythonw.exe -X utf8 -B tools/크레딧작업/run-hidden.py 팁적용안

node·claude 창이 15분마다 깜빡이지 않게 자식은 창 없이 띄우고, 마지막 출력 하나만
output/크레딧작업/<이름>/마지막실행.log에 덮어쓴다. 등록은 같은 폴더의 install-task.ps1.
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")
CLAUDE = pathlib.Path.home() / ".local" / "bin" / "claude.exe"


def main():
    name = sys.argv[1]
    env = dict(os.environ)
    if CLAUDE.exists():
        env.setdefault("SYNK_CLAUDE_BIN", str(CLAUDE))
    r = subprocess.run([str(NODE), str(ROOT / "tools" / "크레딧실행.js"), "작업", name], cwd=ROOT, env=env,
                       capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    log = ROOT / "output" / "크레딧작업" / name / "마지막실행.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
