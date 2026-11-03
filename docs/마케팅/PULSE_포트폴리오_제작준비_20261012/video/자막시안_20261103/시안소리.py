# 11번 시안 소리 — 민재 내레이션(한 판)을 timing.ts의 자리에 놓고, 음악은 말 밑으로 낮춘다. 효과음은 최종편집.py와 같은 자리.
#   python -X utf8 시안소리.py [판 id | 소리 파일]  → git 밖 최종/자막시안_public/p11/sound_narr.wav
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

PID = sys.argv[1] if len(sys.argv) > 1 else "p11-말-민재-전체"
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/p11"
SFX = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
DING = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx/ding1.wav"
BGM = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/p11_Splash_A.mp3"
END = 22.06
src = open(os.path.join(HERE, "remotion", "src", "p11", "timing.ts"), encoding="utf-8").read()
lines = json.loads(re.search(r"LINES: Line\[\] = (\[.*\]);", src, re.S).group(1))
voice = C.load(PID) if os.path.exists(PID) else C.load(C.voice_only(PID, os.path.join(PUB, "목소리")))   # 일레븐 파일은 목소리만이라 떼지 않는다
m = C.Mix(END + 0.3)
for ln in lines:
    a, b = ln["src"]
    x = voice[int(max(0, a - 0.04) * C.RATE):int((b + 0.18) * C.RATE)]
    m.put(ln["at"] - 0.04, x, 0, fade=0.01, fade_out=0.08)
m.put(0, C.load_stereo(BGM)[:int((END + 0.2) * C.RATE)], -17, fade_out=0.25)
sea = C.load_stereo(os.path.join(SFX, "Ocean Waves Day From Balcony.wav"))
m.put(0, sea[C.RATE * 3:C.RATE * 3 + int(6.50 * C.RATE)], -24, fade=0.004)
m.put(6.75, C.load(os.path.join(SFX, "Tape Ripping.M.wav"))[:int(1.0 * C.RATE)], -18, fade_out=0.2)
m.put(11.95, C.load(os.path.join(SFX, "Belt Buckle.M.wav"))[:int(0.5 * C.RATE)], -12, fade_out=0.1)
m.put(21.38, C.load(DING), -12)
m.finish(os.path.join(PUB, "sound_narr.wav"), boost_db=-1.8)   # −3.0이면 −15.2 LUFS(11-03 최종) — 다른 편처럼 −14 안팎으로
