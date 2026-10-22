"""Windows 작업 스케줄러가 node 도구를 창 없이 돌리는 입구 — pythonw로 부른다(크레딧작업/run-hidden.py와 같은 방식).

  pythonw.exe -X utf8 -B tools/숨김실행.py tools/ci빨간불.js --알림
  pythonw.exe -X utf8 -B tools/숨김실행.py --한도 900 tools/운영사본.js 갱신 --실행   (기본 한도 280초 대신)

node 창이 몇 분마다 깜빡이지 않게 자식을 창 없이 띄우고, 마지막 출력 하나만
<공용 git 폴더>/synk-숨김실행/<도구 이름>.log에 덮어쓴다(저장소 밖이라 커밋에 섞이지 않는다). 예약이 도는 운영 사본(tools/운영사본.js)
같은 연결 워크트리는 .git이 파일이라 그것이 가리키는 공용 git 폴더에 쓴다(10-22 — 그 전에는 로그가 조용히 안 남았다).
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")


def common_git(root):
    """메인 작업본이면 .git 폴더, 연결 워크트리면 .git 파일 → 워크트리 git 폴더 → commondir. 못 찾으면 None."""
    git = root / ".git"
    if git.is_dir():
        return git
    try:
        found = re.match(r"gitdir:\s*(.+)", git.read_text(encoding="utf-8").strip())
        if not found:
            return None
        own = (root / found.group(1).strip()).resolve()
        common = (own / (own / "commondir").read_text(encoding="utf-8").strip()).resolve()
        return common if common.is_dir() else None
    except OSError:
        return None


def main():
    args = sys.argv[1:]
    limit = 280
    if len(args) >= 2 and args[0] == "--한도" and args[1].isdigit():
        limit, args = int(args[1]), args[2:]
    if not args:
        return 2
    script = pathlib.Path(args[0])
    try:
        r = subprocess.run([str(NODE), str(script), *args[1:]], cwd=ROOT, capture_output=True,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=limit)
        out, err, code = r.stdout, r.stderr, r.returncode
    except subprocess.TimeoutExpired as e:  # 시간이 넘어도 그때까지의 출력과 까닭을 남긴다(빈 로그로 죽지 않게)
        out, err, code = e.stdout or b"", (e.stderr or b"") + f"\n{limit}초 안에 끝나지 않아 멈췄다".encode(), 124
    git = common_git(ROOT)
    if git:
        log = git / "synk-숨김실행" / f"{script.stem}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_bytes(out + b"\n--- stderr ---\n" + err + f"\n--- 종료 {code} ---\n".encode())
    return code


if __name__ == "__main__":
    sys.exit(main())
