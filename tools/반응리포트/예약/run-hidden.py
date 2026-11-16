"""Windows 작업 스케줄러 「SYNK 반응 리포트 랜딩 받기」가 창 없이 Clarity 하루 숫자를 받는 입구 — pythonw로 부른다(게시 성과 판정과 같은 꼴).

  pythonw.exe -X utf8 -B tools/반응리포트/예약/run-hidden.py

node tools/반응리포트/리포트.js 랜딩받기 --전부 를 창 없이 띄우고 마지막 출력만 output/반응리포트/예약실행.log에 덮어쓴다.
AI를 부르지 않는다. 3시간마다 깨지만 23시간 안에 받았으면 아무것도 부르지 않는다(Clarity API는 프로젝트마다 하루 10번, 받을 때 3번).
등록은 같은 폴더의 install-task.ps1.

2026-11-17부터 랜딩 받기 뒤에 synk.im 방문자 분석 모으기(node tools/사이트방문/모으기.js 돌리기)를 따로 띄운다 — 유호님 「내가 솔리오에서 확인할수있게」.
그 일은 시트 · 서치콘솔 읽기와 주 1회 AI 재기(무료 크레딧 Claude API · Gemini 구독)라 10분을 넘을 수 있어 기다리지 않는다(이 예약의 실행 한도 10분).
23시간 안에 돌았으면 모으기가 스스로 건너뛰고, 겹쳐 돌지 않게 잠금 파일을 쥔다. 출력은 output/사이트방문/예약실행.log.
"""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")


def start_site_visits(env):
    """방문자 분석 모으기를 창 없이 따로 띄운다. 실패해도 랜딩 받기의 결과를 바꾸지 않는다."""
    try:
        log = ROOT / "output" / "사이트방문" / "예약실행.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        out = open(log, "wb")
        args = [str(NODE), str(ROOT / "tools" / "사이트방문" / "모으기.js"), "돌리기"]
        flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
        try:
            # 작업 스케줄러의 작업 묶음(job)에서 빠져나와야 이 입구가 끝난 뒤에도 남는다. 묶음이 빠지기를 막으면 그냥 띄운다.
            subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT,
                             creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB)
        except OSError:
            subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT, creationflags=flags)
        out.close()
    except Exception:
        pass


def main():
    env = dict(os.environ)
    start_site_visits(env)
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
