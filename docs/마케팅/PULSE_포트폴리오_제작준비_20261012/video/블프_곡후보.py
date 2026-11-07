# 블프 두 편 곡 후보(2026-11-07, Claude) — 허깅페이스 PRO ZeroGPU의 stabilityai/stable-audio-3(medium)로 연주곡을 굽는다(옆집 편 곡후보.py와 같은 길).
# Suno · 일레븐 웹은 ego 프로필 바뀜(11-07 새벽)으로 로그아웃, 일레븐 키에는 music_generation이 없고, 무료 키 Lyria는 몫이 0이라 PRO의 ZeroGPU 몫으로 굽는다
# (tools/허깅페이스.py가 넘기기 전에 멈춤 — 돈 안 나감). 시간 지시는 이 모델이 따르지 않으니(옆집 편) 고른 판의 크기 · 박을 재어 편집에서 맞춘다.
#   python -X utf8 블프_곡후보.py [<이름>…]   → git 밖 최종/음악/블프_1107/스테이블/<이름>.wav · _지시문.json
import glob
import json
import os
import shutil
import subprocess
import sys

REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/블프_1107/스테이블"
S3 = "instrumental, no vocals, high quality studio recording, modern clean commercial production"
S4 = "instrumental, no vocals, high quality studio recording, cinematic, no comedy sound effects"
JOBS = [
    # 세일 15초 — 02_콘티 4절: 분당 128박 안팎 밝은 전자 음악, 처음부터 끝까지 쉬지 않고 크기가 고르다(내레이션이 위에 얹힌다)
    ("s3_a", f"Bright punchy electro-pop dance track for a Black Friday sportswear sale commercial in a neon spin-class studio, 128 BPM, four-on-the-floor kick from the first beat, tight claps, "
             f"bright synth stabs, bouncy sidechained bass, sparkling arpeggios, full energy the whole way, no intro, no breakdown, K-pop style, {S3}", 20, 1301),
    ("s3_b", f"Energetic EDM fitness workout anthem, 128 BPM, driving four-on-the-floor kick, big festive synth chords, bouncy bass, claps and shakers, uplifting shopping-sale excitement, "
             f"steady loudness from start to end, no intro, no breakdown, {S3}", 20, 1302),
    # 스나이퍼 — 02_콘티 3절: 1.0초부터 쉬지 않는 훈련 몽타주(작전물 · 신스 북), 조금씩 커져 26초 언저리 정점, 27.4초에 뚝
    ("s4_a", f"Over-the-top 1980s action movie training montage, 118 BPM, driving analog synth bass ostinato, tight military snare rolls, big gated reverb drums, heroic brass synth stabs, "
             f"triumphant synth lead, steadily building and getting more epic all the way, serious and heroic, slightly cheesy, {S4}", 32, 2401),
    ("s4_b", f"Epic synthwave training montage, 120 BPM, pounding drums, pulsing synth bass, heroic analog brass and lead synth, military snare, rising tension that keeps building to a triumphant peak, "
             f"retro 80s sports movie energy, {S4}", 32, 2402),
    # 11-07 오전 부모 세션 「블프 판매 영상은 곡 결이 중요하니 후보를 여럿 굽고 맹검으로 고른다」 — 결을 달리한 셋씩 더
    ("s3_c", f"Glossy K-pop dance-pop instrumental for a sportswear brand sale reel, 128 BPM, punchy kick and snappy claps, funky slap bass, shiny synth brass hits, catchy synth hook "
             f"that repeats every bar, confident and fashionable, full energy from the first beat, no intro, no breakdown, {S3}", 20, 1303),
    ("s3_d", f"Upbeat disco-house shopping anthem, 126 BPM, four-on-the-floor kick, funky muted guitar, filtered disco strings, groovy bass, hand claps, feel-good Friday night sale energy, "
             f"steady from start to end, no intro, no breakdown, {S3}", 20, 1304),
    ("s3_e", f"High-energy spin-class cardio track, 130 BPM, hard-hitting kick, rolling sidechained bass, rising synth riff, whoosh risers every four bars, motivating gym energy for a "
             f"limited-time sale, constant intensity, no intro, no breakdown, {S3}", 20, 1305),
    ("s4_c", f"Classic 1980s boxing-movie training montage instrumental, 116 BPM, rock drums with gated reverb, chugging power-chord electric guitar, analog synth brass fanfare, "
             f"determined and heroic, keeps building to a triumphant final climax, {S4}", 32, 2403),
    ("s4_d", f"Retro 80s spy-mission preparation montage, 118 BPM, pulsing analog synth bass arpeggio, tight snare, ticking hi-hats, suspenseful minor-key synth lead that turns heroic, "
             f"tension rising steadily to a big peak, serious tone, {S4}", 32, 2404),
    ("s4_e", f"Cheesy over-the-top 80s sports movie montage, 120 BPM, driving synth-rock groove, big tom fills, soaring saxophone-like synth lead, motivational and triumphant, "
             f"keeps getting bigger, {S4}", 32, 2405),
]


def main():
    want = sys.argv[1:]
    os.makedirs(OUT, exist_ok=True)
    json.dump([{"이름": n, "지시문": p, "초": s, "씨앗": seed} for n, p, s, seed in JOBS], open(os.path.join(OUT, "_지시문.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
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
                            "--인자", json.dumps(["medium", prompt, sec, 8, 1.0, "pingpong", seed]), "--예상초", "60", "--받을곳", OUT, "--메모", f"블프 곡 {name}"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
        new = sorted(set(glob.glob(os.path.join(OUT, "*", "*.wav"))) - before)
        if not new:
            print("못 받음", name, (r.stdout + r.stderr)[-500:])
            continue
        shutil.move(new[0], dst)
        shutil.rmtree(os.path.dirname(new[0]), ignore_errors=True)
        print("받음", name, dst)


if __name__ == "__main__":
    main()
