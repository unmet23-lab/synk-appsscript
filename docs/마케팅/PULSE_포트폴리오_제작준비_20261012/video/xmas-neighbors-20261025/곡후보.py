# 옆집 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 연주곡 후보를 굽는다.
#   python -X utf8 곡후보.py   → git 밖 pulse-portfolio12-20261024/최종/s1/소리/곡_스테이블/<이름>.wav
# 일레븐 음악 · Suno는 ego 로그인이 풀려 있고, Gemini 무료 키의 Lyria는 하루 몫이 0이라(11-07) PRO에 든 ZeroGPU 몫으로 굽는다(넘기기 전에 도구가 멈춤 — 돈 안 나감).
# 시간 지시(「35초에 숨」)는 이 모델이 따르지 않으니, 통째 판(60초 쌓아 올림)과 앞(피아노만) · 끝(오케스트라 절정) 따로 판을 구워 크기 곡선을 재고 박에서 잇는다.
import glob, json, os, shutil, subprocess, sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s1/소리/곡_스테이블"
BASE = "tender cinematic Christmas film score, instrumental, warm, hopeful, heartfelt, high quality studio recording, no drums, no vocals, no synths"
JOBS = [
    ("통째_a", f"Starts with a soft solo felt piano playing a simple lyrical melody, sparse and intimate, slow 66 BPM, C major. Around the middle, warm strings enter and slowly build. Near the end a full emotional orchestral climax with strings, french horns, gentle timpani and glockenspiel, then it resolves into a quiet final piano chord. {BASE}", 62, 1108),
    ("통째_b", f"Gentle Christmas lullaby on a close-miked felt piano, 66 BPM, C major, a lonely late-autumn night, then soft strings join and swell into a heartfelt orchestral finale with french horns and glockenspiel, ending on one quiet piano chord. {BASE}", 62, 2207),
    ("앞_피아노", f"Solo felt piano only, a simple tender lyrical melody with soft sustained chords, sparse and intimate, close-miked, slow 66 BPM, C major, a quiet lonely winter night. No other instruments. {BASE}", 42, 3301),
    ("앞_피아노2", f"Solo felt piano only, gentle and slow, a simple hopeful melody in C major at 66 BPM, soft pedal, intimate and close, like a quiet Christmas night alone. No other instruments. {BASE}", 42, 3302),
    ("끝_절정", f"Emotional orchestral Christmas finale in C major at 66 BPM: piano and warm strings build quickly, then a full heartfelt climax with soaring strings, french horns, gentle timpani roll and glockenspiel sparkle, then it resolves into one quiet final piano chord that rings out. {BASE}", 28, 4401),
    ("끝_절정2", f"Soft warm strings enter under a felt piano and swell into a big tender orchestral climax with french horns and glockenspiel, C major, 66 BPM, cinematic and hopeful, ending softly on a single sustained piano chord. {BASE}", 28, 4402),
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
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT, "--메모", f"옆집 곡 {name}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        new = sorted(set(glob.glob(os.path.join(OUT, "*", "*.wav"))) - before)
        if not new:
            print("못 받음", name, (r.stdout + r.stderr)[-400:])
            continue
        shutil.move(new[0], dst)
        shutil.rmtree(os.path.dirname(new[0]), ignore_errors=True)
        print("받음", name, (r.stdout.strip().splitlines() or [""])[0][:120], flush=True)
    json.dump([{"이름": n, "지시문": p, "초": s, "씨앗": d} for n, p, s, d in JOBS], open(os.path.join(OUT, "_지시문.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
