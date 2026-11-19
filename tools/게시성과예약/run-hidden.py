"""Windows 작업 스케줄러 「SYNK 게시 성과 판정」이 창 없이 판정을 돌리는 입구 — pythonw로 부른다(SYNK 팁 적용안과 같은 방식).

  pythonw.exe -X utf8 -B tools/게시성과예약/run-hidden.py

node tools/게시성과.js --실행 을 창 없이 띄우고 마지막 출력만 output/게시성과/예약실행.log에 덮어쓴다.
AI를 부르지 않는다. 등록은 같은 폴더의 install-task.ps1.

2026-11-19부터 판정 뒤에 솔리오 「계정 건강」의 요약을 다시 쓴다(node tools/계정건강.js --요약쓰기) — 유호님 「PC 앱에 옮겨」.
요약은 저장소 밖 %LOCALAPPDATA%\\synk\\sns-health\\summary.json 한 장이고 PC 앱이 읽는다. 판정이 실패해도 장부에 있는 숫자로 쓴다.
요약 쓰기가 실패해도 판정의 종료 코드는 바뀌지 않는다. 출력은 output/계정건강/예약실행.log에 덮어쓴다.

팔로워도 하루 한 번 다시 잰다(node tools/채널성과.js --재기, 읽기만 한다 · AI 없음). 계정 건강의 「팔로워에게 닿는가」와
「팔로워로 남는가」가 이 값으로 판정하는데 재는 예약이 없어 11-15 값에 멈춰 있었다(11-19 설계 검토 P1). 23시간 안에 쟀으면 건너뛴다.
실패하면 다음 회차(3시간 뒤)에 다시 잰다. 출력은 output/계정건강/팔로워재기.log, 잰 때는 output/계정건강/팔로워잰때.txt의 파일 시각이다.

차례는 판정 → 요약 쓰기 → 팔로워 재기다. 재기는 이 입구가 끝난 뒤에도 남는 따로 띄운 프로세스(이 파일을 --팔로워로 다시 부른다)가
하고, 재고 나면 요약을 한 번 더 쓴다. 11-20 첫 회차에 판정이 24분 걸린 뒤 재기가 이 입구 안에서 돌다가 예약의 30분 한도에 끊겨
요약도 기록도 남지 않았다. 그래서 몇 초면 되는 요약을 먼저 쓰고, 몇 분이 걸리는 재기는 한도 밖으로 뺐다.
"""
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
NODE = pathlib.Path(r"C:\Program Files\nodejs\node.exe")
FOLLOWERS_EVERY = 23 * 3600


def followers_due():
    """팔로워를 잴 때가 됐는가. 23시간 안에 쟀거나, 따로 띄운 재기가 30분 안에 시작했으면 아니다."""
    folder = ROOT / "output" / "계정건강"
    stamp, running = folder / "팔로워잰때.txt", folder / "팔로워재는중.txt"
    if stamp.exists() and time.time() - stamp.stat().st_mtime < FOLLOWERS_EVERY:
        return False
    if running.exists() and time.time() - running.stat().st_mtime < 1800:
        return False
    return True


def start_followers(env):
    """팔로워 재기를 창 없이 따로 띄운다. 예약의 30분 한도에 끊기지 않게 작업 묶음(job)에서 빠져나온다(방문자 분석 모으기와 같은 방식)."""
    try:
        if not followers_due():
            return
        args = [sys.executable, "-X", "utf8", "-B", str(pathlib.Path(__file__).resolve()), "--팔로워"]
        flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
        io = dict(cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            subprocess.Popen(args, creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB, **io)
        except OSError:
            subprocess.Popen(args, creationflags=flags, **io)
    except Exception:
        pass


def measure_followers(env):
    """팔로워를 다시 잰다(따로 띄운 프로세스 안에서). 재면 True."""
    folder = ROOT / "output" / "계정건강"
    folder.mkdir(parents=True, exist_ok=True)
    stamp, running, log = folder / "팔로워잰때.txt", folder / "팔로워재는중.txt", folder / "팔로워재기.log"
    running.write_text(time.strftime("%Y-%m-%d %H:%M:%S"), encoding="utf-8")
    try:
        r = subprocess.run([str(NODE), str(ROOT / "tools" / "채널성과.js"), "--재기"], cwd=ROOT, env=env,
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=1500)
        log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
        if r.returncode == 0:
            stamp.write_text(time.strftime("%Y-%m-%d %H:%M:%S"), encoding="utf-8")
        return r.returncode == 0
    except subprocess.TimeoutExpired as e:
        log.write_bytes((e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b"") + "\n--- 25분 넘어 멈춤 ---\n".encode())
        return False
    finally:
        try:
            running.unlink()
        except OSError:
            pass


def write_health_summary(env):
    """솔리오 「계정 건강」의 요약을 다시 쓴다. 장부만 읽어 몇 초면 끝난다. 실패해도 판정의 결과를 바꾸지 않는다."""
    try:
        log = ROOT / "output" / "계정건강" / "예약실행.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        try:
            r = subprocess.run([str(NODE), str(ROOT / "tools" / "계정건강.js"), "--요약쓰기"], cwd=ROOT, env=env,
                               capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=120)
            log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
        except subprocess.TimeoutExpired as e:
            log.write_bytes((e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b"") + "\n--- 2분 넘어 멈춤 ---\n".encode())
    except Exception:
        pass


def main():
    env = dict(os.environ)
    if "--팔로워" in sys.argv[1:]:
        # 따로 띄운 재기: 재고 나면 새 팔로워 값으로 요약을 한 번 더 쓴다
        try:
            if measure_followers(env):
                write_health_summary(env)
        except Exception:
            pass
        return 0
    log = ROOT / "output" / "게시성과" / "예약실행.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run([str(NODE), str(ROOT / "tools" / "게시성과.js"), "--실행"], cwd=ROOT, env=env,
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=1800)
    except subprocess.TimeoutExpired as e:
        log.write_bytes((e.stdout or b"") + b"\n--- stderr ---\n" + (e.stderr or b"") + "\n--- 30분 넘어 멈춤 ---\n".encode())
        write_health_summary(env)
        start_followers(env)
        return 1
    log.write_bytes(r.stdout + b"\n--- stderr ---\n" + r.stderr + f"\n--- 종료 {r.returncode} ---\n".encode())
    write_health_summary(env)
    start_followers(env)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
