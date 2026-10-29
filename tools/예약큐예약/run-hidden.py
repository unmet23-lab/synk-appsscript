"""Windows 작업 스케줄러 「SYNK 예약큐」가 창 없이 도는 입구 — pythonw로 부른다(「SYNK 게시 성과 판정」과 같은 방식).

  pythonw.exe -X utf8 -B tools/예약큐예약/run-hidden.py

⓪ node tools/편요약.js --실행
   저장소 편 기록(준비.json·게시결과.json·판정 장부)을 한 장으로 묶어 작업실 SNS·마케팅 간편판(오늘·성과·계정)이 읽게 보낸다
   (10-24 간편판). 1초짜리라 맨 앞에 둔다. 자격이 없으면 종료 코드 3으로 건너뛴다.
① node tools/작업실예약.js --대기열 --실행
   07시 작업이 올리기 전 검사를 마치고 준비.json에 「작업실등록」: true를 단 편을 회사 작업실에 올려 예약한다(유호님 링크 승인 전에는
   서버가 보내지 않는다). 검토 링크는 이 PC(%LOCALAPPDATA%\\synk\\작업실예약)에만 두고 텔레그램으로 보내지 않는다 — 10-30 유호님
   「당분간은 텔레그램으로 검수승인(게시물관련)안해도 돼」, 승인은 노트북 앱 세션에서 편을 보이고 받는다. 자격이 없으면 종료 코드 3으로 건너뛴다.
② node tools/예약큐.js --서버읽기 --알림
   회사 서버를 읽기 전용으로 읽어 %LOCALAPPDATA%\\synk\\예약큐\\서버.json에 두고(세션들은 이 캐시만 읽는다), 서버 대조 경고
   (「예약됨인데 서버에 없음」·「슬롯이 지났는데 나가지 않음」 등)·검사 「고칠 것」이 있으면 텔레그램 한 통(10-30부터 승인 대기 · 검토 링크 만료는 넣지 않는다)
   (같은 날 같은 내용은 한 번). 10-23부터 비축 목표·비축 부족 알림은 없다(결정 10-23).
AI를 부르지 않는다. 마지막 출력만 output/예약큐/예약실행.log에 덮어쓴다. 등록·해제는 같은 폴더의 install-task.ps1.
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")
STEPS = [
    # 1초짜리라 맨 앞(뒤 단계가 영상 올리기로 30분 한도를 다 써도 굶지 않게)
    ("편 요약 보내기", ["tools/편요약.js", "--실행"]),
    ("작업실 등록", ["tools/작업실예약.js", "--대기열", "--실행"]),
    ("예약큐 서버 대조·알림", ["tools/예약큐.js", "--서버읽기", "--알림"]),
]


def main():
    log = ROOT / "output" / "예약큐" / "예약실행.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    parts, worst = [], 0
    for name, args in STEPS:
        try:
            r = subprocess.run([str(NODE), *[str(ROOT / a) if a.startswith("tools/") else a for a in args]], cwd=ROOT, env=dict(os.environ),
                               capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=1500)
            code = r.returncode
            # 3 = 작업실 자동화 자격이 아직 없음(유호님 차례) — 실패로 세지 않는다
            if not (name in ("편 요약 보내기", "작업실 등록") and code == 3):
                worst = max(worst, code)
            parts.append(f"=== {name} (종료 {code}) ===\n".encode() + r.stdout + b"\n--- stderr ---\n" + r.stderr)
        except subprocess.TimeoutExpired as e:
            worst = 1
            parts.append(f"=== {name} — 25분 넘어 멈춤 ===\n".encode() + (e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b""))
    log.write_bytes(b"\n".join(parts))
    return worst


if __name__ == "__main__":
    sys.exit(main())
