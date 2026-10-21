"""Windows 작업 스케줄러가 node 도구를 창 없이 돌리는 입구 — pythonw로 부른다(크레딧작업/run-hidden.py와 같은 방식).

  pythonw.exe -X utf8 -B tools/숨김실행.py tools/ci빨간불.js --알림

node 창이 몇 분마다 깜빡이지 않게 자식을 창 없이 띄우고, 마지막 출력 하나만
<공용 git 폴더>/synk-숨김실행/<도구 이름>.log에 덮어쓴다(저장소 밖이라 커밋에 섞이지 않는다).
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")


def main():
    if len(sys.argv) < 2:
        return 2
    script = pathlib.Path(sys.argv[1])
    try:
        r = subprocess.run([str(NODE), str(script), *sys.argv[2:]], cwd=ROOT, capture_output=True,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=280)
        out, err, code = r.stdout, r.stderr, r.returncode
    except subprocess.TimeoutExpired as e:  # 시간이 넘어도 그때까지의 출력과 까닭을 남긴다(빈 로그로 죽지 않게)
        out, err, code = e.stdout or b"", (e.stderr or b"") + "\n280초 안에 끝나지 않아 멈췄다".encode(), 124
    git = ROOT / ".git"
    if git.is_dir():
        log = git / "synk-숨김실행" / f"{script.stem}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_bytes(out + b"\n--- stderr ---\n" + err + f"\n--- 종료 {code} ---\n".encode())
    return code


if __name__ == "__main__":
    sys.exit(main())
