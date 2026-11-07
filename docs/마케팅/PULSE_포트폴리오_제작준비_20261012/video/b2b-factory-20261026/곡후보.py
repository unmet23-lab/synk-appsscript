# 10번 도담중공업 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 연주곡 조각을 굽는다(옆집 곡후보.py와 같은 길).
#   python -X utf8 곡후보.py [이름…]   → git 밖 pulse-portfolio12-20261024/최종/p10/소리/곡_스테이블/<이름>.wav
# 11-07 ego 로그인이 풀려 Suno · 일레븐 음악을 못 쓴다 — 이 모델은 노래(가사)를 못 하므로 원본의 「기타 한 대 + 목소리」 노래 자리를 기타 연주곡으로 받는다.
# 원본 짜임(02_콘티 4절 · 원본_소리.json): 0초 기타 → 0~36초 고르게(−18 dB 안팎) → 36.25~36.75 숨 → 37.0 크게 차오름 → 46.26 완전 무음 → 49.95 기타 낮은 음 한 번
#   → 52.35 다시 차오름 → 55.0~55.98 숨 → 56.0 복귀 → 58.6 맺음. 이 모델은 시간 지시를 따르지 않으니(현장노트 허깅페이스) 통째 판과 앞(기타만) · 절정 · 끝 조각을
#   같은 조(D장조) · 빠르기(76 BPM)로 따로 굽고, 원본이 쉬는 자리(숨 · 무음)에서만 잇는다.
import glob, json, os, shutil, subprocess, sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10/소리/곡_스테이블"
BASE = "instrumental, warm intimate acoustic folk film score, heartfelt, nostalgic and hopeful, high quality studio recording, close-miked, no vocals, no synths"
JOBS = [
    ("통째_a", f"Gentle fingerpicked steel-string acoustic guitar playing a tender lyrical folk melody, D major, 76 BPM, warm and intimate; around the middle a soft cello and a second guitar join; near the end it swells into a full heartfelt arrangement with warm strings, piano and a soft kick drum, then resolves on one final ringing guitar chord. {BASE}", 62, 1001),
    ("통째_b", f"Tender acoustic folk ballad on a fingerpicked steel-string guitar, D major, 76 BPM, like a father watching a child leave home; it slowly grows, cello and soft strings join, then a big proud emotional swell with piano and gentle drums, ending quietly on one ringing guitar chord. {BASE}", 62, 2002),
    ("앞_기타", f"Solo fingerpicked steel-string acoustic guitar only, a simple tender lyrical folk melody over gentle arpeggios, D major, 76 BPM, intimate and close, nostalgic and hopeful. No other instruments, no drums. {BASE}", 45, 3001),
    ("앞_기타2", f"Solo acoustic guitar only, warm fingerstyle folk in D major at 76 BPM, a slow singing melody on the high strings over soft bass notes, tender and patient, like careful hands at work. No other instruments, no drums. {BASE}", 45, 3002),
    ("절정", f"Full heartfelt cinematic folk swell in D major at 76 BPM: strummed and fingerpicked acoustic guitars, warm swelling strings, piano chords and a soft kick drum, big, emotional and proud from the very first beat, sustained. {BASE}", 20, 4001),
    ("절정2", f"Big emotional folk-rock anthem moment in D major, 76 BPM: open strummed acoustic guitars, soaring cello and violins, steady soft drums and piano, warm and proud, full from the first beat. {BASE}", 20, 4002),
    ("끝", f"A single low acoustic guitar bass note rings out alone and fades; then soft fingerpicked acoustic guitar comes back with warm strings, tender and hopeful, D major, 76 BPM, rising gently, then one last quiet phrase that resolves on a long ringing D major guitar chord. {BASE}", 20, 5001),
    ("끝2", f"Quiet ending of an acoustic folk film score in D major, 76 BPM: fingerpicked steel-string guitar with soft warm strings, a gentle rise, a short breath, then a tender final phrase and one long ringing guitar chord that fades out. {BASE}", 18, 5002),
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
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT, "--메모", f"p10 곡 {name}"],
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
