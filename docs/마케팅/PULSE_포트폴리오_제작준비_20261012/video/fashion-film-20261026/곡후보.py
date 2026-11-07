# 4번 패션 필름 「결채」 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 연주곡 조각을 굽는다(10번 · 옆집 곡후보.py와 같은 길).
#   python -X utf8 곡후보.py [이름…]   → git 밖 pulse-portfolio12-20261024/최종/p4/소리/곡_스테이블/<이름>.wav
# 11-07 ego 로그인이 풀려 Suno · 일레븐 음악을 못 쓴다. 라이선스 Stability AI Community(연 매출 US$100만 미만 상업 무료, 현장노트 허깅페이스).
# 원본 소리(02_콘티 3절 · 이 세션 실측): 0.25~1.5초 조용한 패드(−24~−35 dB) → 1.75 바람 · 저음 스웰 → 2.0~2.16 묵직한 타격(−13) → 4초까지 잦아듦 → 5.0 한 번 들림
#   → 6.25 오름 · 6.75 타격(−8) → 7.25~8.0 숨(−17~−19) → 8.25부터 올라 10.75 가장 큼(−5) → 10.24부터 0.348초 간격 타악(86 BPM의 8분음표)이 26.28까지(−16~−20)
#   → 24.25 다시 부풂(−12~−10) → 끝 화면 첫 장(원본 65.0 = 우리 26.28)에 큰 타격 하나, 잔향만 사라짐.
# 이 모델은 시간 지시를 따르지 않으니(현장노트) 같은 조(D단조) · 빠르기(86 BPM)로 통째 · 앞(패드 + 타격) · 그루브 · 끝 타격을 따로 굽고 원본이 쉬는 자리에서만 잇는다.
import glob, json, os, shutil, subprocess, sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p4/소리/곡_스테이블"
BASE = "instrumental, refined minimal luxury fashion film score, sensual and expensive, high quality studio recording, wide stereo, no vocals, no choir, no lyrics"
JOBS = [
    ("통째_a", f"Moody, elegant fashion film score in D minor at 86 BPM. It opens with an airy shimmering synth pad and a low wind-like swell, then one deep cinematic sub boom; "
              f"plucked nylon-string guitar and soft strings start a hypnotic arpeggio; then a tight driving percussion groove of soft toms, shaker and finger snaps on eighth notes at 86 BPM builds up to a big, confident peak and keeps pulsing. {BASE}", 32, 1101),
    ("통째_b", f"Dark minimal electronic fashion runway film score in D minor, 86 BPM: breathing synth pad and distant wind, a heavy low boom, then a pulsing plucked arpeggio with warm strings, "
              f"and a crisp hypnotic groove of tom drums, shakers and claps on eighth notes, rising to a powerful peak, stylish and expensive. {BASE}", 32, 2202),
    ("앞_패드", f"Only an airy, shimmering synth pad and a soft low wind-like swell in D minor, slowly breathing and rising, then one deep cinematic sub boom hit with a long dark reverb tail. "
               f"No drums, no melody, no rhythm. {BASE}", 10, 3301),
    ("앞_패드2", f"Quiet ambient opening: a glassy, airy synth pad in D minor and a breath of low wind that swells into one heavy, deep cinematic impact boom, then a long reverb tail. "
                f"No drums, no melody. {BASE}", 10, 3302),
    ("그루브", f"Hypnotic plucked nylon-string guitar and soft string arpeggio in D minor at 86 BPM over a tight driving percussion groove — soft tom drums, shaker and finger snaps on eighth notes, "
              f"a deep pulsing sub bass on every beat; full and steady from the very first beat, elegant, minimal and confident. {BASE}", 24, 4401),
    ("그루브2", f"Stylish fashion film groove in D minor at 86 BPM: a pulsing plucked synth and guitar arpeggio, warm low strings, crisp tom drums, shakers and claps on eighth notes, "
               f"steady and hypnotic from the first beat, sensual and expensive. {BASE}", 24, 4402),
    ("끝", f"One huge, deep cinematic boom hit in D minor with a long dark reverb tail that slowly fades to silence; nothing else plays after the hit. {BASE}", 8, 5501),
    ("끝2", f"A single heavy low cinematic impact with a soft sub drop and a long, wide reverb tail fading out to complete silence. No melody, no drums after the hit. {BASE}", 8, 5502),
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
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT, "--메모", f"p4 곡 {name}"],
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
