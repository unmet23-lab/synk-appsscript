# 오미톡 15초 곡 · 바탕 소리 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 굽는다(10번 · 옆집 곡후보.py와 같은 길).
#   python -X utf8 곡후보.py [이름…]   → git 밖 pulse-portfolio12-20261024/최종/om2/소리/곡_스테이블/<이름>.wav
# 11-07 ego 로그인이 풀려 Suno · 일레븐 음악을 못 쓴다. 라이선스는 Stability AI Community(연 매출 US$100만 미만 상업 무료 — 현장노트 허깅페이스).
# 소리 짜임(01_새판_기획 7 · 10절): 더운 앞 절반은 곡 없이 열기 · 매미(한국 여름 더위의 소리), 식는 순간 매미가 끊기고 풀벌레 · 저녁 공기,
#   코트 조명이 켜지는 자리부터 시원한 곡이 들어와 마지막 「톡」에서 맺는다. 이 모델은 시간 지시를 따르지 않으니 곡은 처음부터 같은 박으로 도는 판을 굽고
#   편집에서 박을 재서 놓는다.
import glob, json, os, shutil, subprocess, sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/om2/소리/곡_스테이블"
HQ = "no vocals, high quality studio mix"
AMB = "no music, no voices, high quality stereo field recording"
JOBS = [
    ("곡_a", f"Cool, crisp, minimal chill-pop instrumental for a refreshing sparkling-drink commercial: clean plucked synth arpeggio, airy shimmering pad, soft deep sub bass, light snappy finger-snap percussion, sparkling and refreshing like a cold soda, 100 BPM, A major, steady groove from the very first beat, {HQ}", 16, 7101),
    ("곡_b", f"Refreshing summer-night future-garage instrumental: soft lush synth chords, gentle shuffled hi-hats, deep warm sub bass, a glassy bell melody, cool blue evening mood after a hot day, 120 BPM, C major, steady from the first beat, {HQ}", 16, 7202),
    ("곡_c", f"Minimal tropical-house instrumental for a fizzy drink ad: bright marimba plucks, soft kick on every beat, airy pad, cool, fresh and fizzy, 110 BPM, F major, steady groove from the first beat, {HQ}", 16, 7303),
    ("곡_d", f"Cool lo-fi R&B instrumental: mellow Rhodes electric piano chords, soft vinyl crackle, laid-back drums with a crisp snare, round sub bass, a relaxed blue evening on an outdoor basketball court, 85 BPM, D major, steady from the first beat, {HQ}", 16, 7404),
    ("매미_a", f"Loud summer cicadas buzzing in the trees around an outdoor basketball court on a scorching late afternoon in Seoul, a dense shimmering insect drone that pulses slowly, very distant traffic hum, {AMB}", 12, 8101),
    ("매미_b", f"Korean summer cicadas singing in a hot city park at the end of a heatwave day, rhythmic rising and falling buzz from many cicadas, dry hot air, a faint distant city, {AMB}", 12, 8202),
    ("풀벌레_a", f"A calm cool summer evening in a city park after sunset: gentle crickets chirping softly in the grass, light evening air, a faint distant city, peaceful and fresh, {AMB}", 12, 8303),
    ("꿀꺽_a", "Close-up foley of a young man gulping a cold sparkling drink straight from a can: two big, wet, satisfying swallows in his throat, a tiny fizz, a short relieved breath out at the end, dry studio recording, no music, no voices, no words", 4, 9101),
    ("꿀꺽_b", "Foley sound effect: three quick, deep gulps of a cold soda, the throat swallowing loudly and wetly, close microphone, clean, no music, no talking", 4, 9202),
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
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT, "--메모", f"om2 곡 {name}"],
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
