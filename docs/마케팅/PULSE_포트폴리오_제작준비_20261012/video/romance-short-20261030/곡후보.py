# 로맨스 「다 비침」 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 연주곡을 굽는다(옆집 곡후보.py와 같은 길).
#   python -X utf8 곡후보.py [이름…]   → git 밖 최종/rs/소리/곡_스테이블/<이름>.wav · _지시문.json
# 02_콘티 5절은 「노래 한 곡을 세 목소리로(남 → 여 → 남)」였다. 11-07 노래를 부르는 길이 모두 막혀(일레븐 · Suno 로그인 풀림, ACE-Step 1.5 Space는 세 번 다
# 「GPU task aborted」로 몫 993초만 쓰고 결과 없음 — 노래굽기.py) 같은 짜임을 악기로 옮긴다: 시작 편 회상 · 끝 = 첼로가 부르는 주제(남),
# 끝 편 회상 = 같은 조 · 빠르기의 바이올린 · 피아노 주제(여), 제목 카드 · 짧은 바닥 = 펠트 피아노 동기. 노랫말이 없으니 대사와 부딪히지 않는다.
import glob
import json
import os
import shutil
import subprocess
import sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/rs/소리/곡_스테이블"
BASE = ("cinematic Korean romance drama OST, instrumental, bittersweet, tender, intimate, restrained, rainy night, 72 BPM, D major, "
        "high quality studio recording, no drums, no vocals, no synths")
JOBS = [
    ("첼로_a", f"A warm solo cello sings a simple, singable lyrical melody like a male voice, over soft felt piano chords and a gentle nylon-string guitar; "
               f"halfway through, soft strings join under the cello and slowly swell, then it settles back to cello and piano. {BASE}", 95, 5101),
    ("첼로_b", f"Bittersweet ballad theme: a solo cello carries a tender, simple melody over sparse felt piano, then warm string ensemble swells under it "
               f"in a heartfelt climax and resolves gently on one piano chord. {BASE}", 95, 5102),
    ("바이올린_a", f"A solo violin sings a simple, singable lyrical melody like a soft female voice, over a gentle felt piano and soft nylon-string guitar; "
                f"then soft strings join and slowly swell, and it settles back to violin and piano, lonely and tender. {BASE}", 85, 5201),
    ("바이올린_b", f"A tender, wistful solo violin and close-miked felt piano duet with a simple singable melody, soft cello underneath in the second half, "
                f"quiet and restrained, like a goodbye. {BASE}", 85, 5202),
    ("피아노_a", f"Solo felt piano only: a simple, quiet four-note motif repeated with soft sustained chords, sparse and intimate, close-miked, like rain on a "
               f"window at night. No other instruments. {BASE}", 40, 5301),
    ("피아노_b", f"Solo felt piano only, gentle and slow, a simple lyrical phrase with long pauses, soft pedal, intimate and close, bittersweet. "
               f"No other instruments. {BASE}", 40, 5302),
    ("절정_a", f"Emotional orchestral finale of a Korean romance drama: a solo cello melody over felt piano, warm strings build quickly into a heartfelt, "
             f"tender climax, then the music thins out to piano and cello and resolves softly on one sustained chord that rings out. {BASE}", 45, 5401),
]


def main():
    want = sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    for name, prompt, sec, seed in JOBS:
        if want and name not in want:
            continue
        dst = os.path.join(OUT, name + ".wav")
        if os.path.exists(dst):
            print("있음", name)
            continue
        before = set(glob.glob(os.path.join(OUT, "*", "*.wav")))
        env = dict(os.environ, MSYS_NO_PATHCONV="1", PYTHONIOENCODING="utf-8")
        r = subprocess.run([sys.executable, "-X", "utf8", os.path.join(REPO, "tools", "허깅페이스.py"), "부르기", "stabilityai/stable-audio-3", "--api", "/infer",
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT, "--메모", f"로맨스 곡 {name}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        new = sorted(set(glob.glob(os.path.join(OUT, "*", "*.wav"))) - before)
        if not new:
            print("못 받음", name, (r.stdout + r.stderr)[-400:])
            continue
        shutil.move(new[0], dst)
        shutil.rmtree(os.path.dirname(new[0]), ignore_errors=True)
        print("받음", name, (r.stdout.strip().splitlines() or [""])[0][:120], flush=True)
    json.dump([{"이름": n, "지시문": p, "초": s, "씨앗": d} for n, p, s, d in JOBS], open(os.path.join(OUT, "_지시문.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
