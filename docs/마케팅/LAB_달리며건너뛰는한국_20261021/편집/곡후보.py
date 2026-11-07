# 「달리며 건너뛰는 한국」 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 120 BPM 연주곡을 굽는다.
#   python -X utf8 편집/곡후보.py [<이름> …]   → git 밖 synk-vendor/korea-run-montage-20261021/편집/소리/곡/<이름>.wav
# 일레븐 음악 · Suno는 11-07 새벽부터 ego 로그인이 풀려 있어 PRO에 든 ZeroGPU 몫으로 굽는다(넘기기 전에 tools/허깅페이스.py가 멈춤 — 돈 안 나감).
# 라이선스: Stability AI Community(연 매출 US$100만 미만 상업 무료). 이 모델은 곡 안 시각 지시를 따르지 않으니(현장노트 허깅페이스 11-07),
#   박표의 모양(0~10초 작게 쌓기 · 9.5~10.0초 비움 · 10.0초 드롭 · 끝 한 타)은 곡편집.py가 박 자리에서 자르고 걸러 만든다. 여기서는 120 BPM으로
#   처음부터 꽉 찬 「드롭」 판과, 같은 조 · 빠르기의 가벼운 「앞」 판을 따로 굽는다.
import glob
import json
import os
import shutil
import subprocess
import sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021/편집/소리/곡"
BASE = ("instrumental, no vocals, 120 BPM, 4/4, A major, high quality studio recording, punchy modern mix, clean low end, "
        "for a fast travel montage video")
JOBS = [
    ("드롭_a", "Upbeat euphoric travel montage track: four-on-the-floor kick, tight claps on 2 and 4, bright plucky synth arpeggios, "
               "warm sub bass, rising energy, festival-pop drop from the very first beat, joyful and adventurous. " + BASE, 40, 5101),
    ("드롭_b", "Bright K-pop inspired dance-pop instrumental: driving kick and snappy claps, glossy synth chords on the off-beats, "
               "catchy plucked lead melody, sub bass groove, feel-good summer road trip energy, full and punchy from the start. " + BASE, 40, 5102),
    ("드롭_c", "Energetic indie electronic travel anthem: steady kick, shuffling hi-hats, claps, bouncy bass, sparkling marimba and synth hook, "
               "carefree jumping and running energy, big and bright from the very first bar. " + BASE, 40, 5103),
    ("앞_a", "Minimal intro groove: soft muted kick, light shaker and finger snaps, a filtered plucky synth playing a simple A major pattern, "
             "anticipation before a journey, sparse and clean, steady 120 BPM, gradually adding a soft riser. " + BASE, 24, 5201),
    ("앞_b", "Light anticipatory beat: tight hi-hats, soft clicks, muted bass pulses, a plucked synth motif in A major, playful and curious, "
             "like getting ready for a challenge, sparse and steady, 120 BPM. " + BASE, 24, 5202),
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
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT,
                            "--메모", f"달리며 건너뛰는 한국 곡 {name}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        new = sorted(set(glob.glob(os.path.join(OUT, "*", "*.wav"))) - before)
        if not new:
            print("못 받음", name, (r.stdout + r.stderr)[-400:], flush=True)
            continue
        shutil.move(new[0], dst)
        shutil.rmtree(os.path.dirname(new[0]), ignore_errors=True)
        print("받음", name, (r.stdout.strip().splitlines() or [""])[0][:120], flush=True)
    json.dump([{"이름": n, "지시문": p, "초": s, "씨앗": d} for n, p, s, d in JOBS], open(os.path.join(OUT, "_지시문.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
