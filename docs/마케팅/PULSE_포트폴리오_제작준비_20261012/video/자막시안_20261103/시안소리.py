# 11번 시안 소리 — 민재 내레이션(한 판)을 timing.ts의 자리에 놓고, 음악은 말 밑으로 낮춘다. 효과음은 최종편집.py와 같은 자리.
#   python -X utf8 시안소리.py [판 id | 소리 파일]  → git 밖 최종/자막시안_public/p11/sound_narr.wav
import glob, json, os, re, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

PID = sys.argv[1] if len(sys.argv) > 1 else "p11-말-민재-전체"
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/p11"
SFX = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
DING = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx/ding1.wav"
BGM = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/p11_Splash_A.mp3"
END = 23.92   # 고글 개 끝 + 물 판 끝까지(11-04)
SPLASH = 20.375   # 물 판의 큰 물보라 — 내레이션 「첨벙댕」과 같은 자리. 물 판은 19.875초에 시작
src = open(os.path.join(HERE, "remotion", "src", "p11", "timing.ts"), encoding="utf-8").read()
lines = json.loads(re.search(r"LINES: Line\[\] = (\[.*\]);", src, re.S).group(1))
voice = C.load(PID) if os.path.exists(PID) else C.load(C.voice_only(PID, os.path.join(PUB, "목소리")))   # 일레븐 파일은 목소리만이라 떼지 않는다
m = C.Mix(END + 0.3)
for ln in lines:
    a, b = ln["src"]
    x = voice[int(max(0, a - 0.04) * C.RATE):int((b + 0.18) * C.RATE)]
    m.put(ln["at"] - 0.04, x, 0, fade=0.01, fade_out=0.08)
song = C.load_stereo(BGM)
m.put(0, song[:int(SPLASH * C.RATE)], -17, fade_out=0.03)
# 물보라에서 곡을 16초(120 BPM 8마디) 건너뛰어 곡 끝이 23.76초에 맺는다 — 곡 중간을 페이드로 자르면 끝이 끊긴다(12번과 같은 까닭). 말이 끝나면 키운다
tail = song[int((SPLASH + 16.0) * C.RATE):].copy()
tt = np.arange(len(tail)) / C.RATE + SPLASH
tail = tail * (10 ** (np.interp(tt, [SPLASH, 21.25, 21.75, 40], [-17, -17, -10.5, -10.5]) / 20))[:, None].astype(np.float32)
m.put(SPLASH, tail, 0, fade=0.01, fade_out=0.3)
sea = C.load_stereo(os.path.join(SFX, "Ocean Waves Day From Balcony.wav"))
m.put(0, sea[C.RATE * 3:C.RATE * 3 + int(6.50 * C.RATE)], -24, fade=0.004)
m.put(6.75, C.load(os.path.join(SFX, "Tape Ripping.M.wav"))[:int(1.0 * C.RATE)], -18, fade_out=0.2)
m.put(11.95, C.load(os.path.join(SFX, "Belt Buckle.M.wav"))[:int(0.5 * C.RATE)], -12, fade_out=0.1)
# 물 — 차오르는 소리 → 큰 물보라(그림과 같은 자리) → 찰랑임. 글자가 솟을 때 작은 뽀글
SON = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림"
rush = C.load(os.path.join(SFX, "Bathtub On Fill Off Bubble .wav"))[20 * C.RATE:int(22.6 * C.RATE)].copy()
rt = np.arange(len(rush)) / C.RATE
rush = rush * (10 ** (np.interp(rt, [0, 0.2, 0.45, 0.56, 0.9, 2.6], [-30, -2, 6, -5, -11, -34]) / 20)).astype(np.float32)   # 말 직전에 터지고 말이 시작되면 뺀다
m.put(19.875, rush, 0, fade=0.01)
bath = C.load(os.path.join(SFX, "Water Splash Bath.M.wav"))
def under_word(x, hit=0.14, drop=-10.0, over=0.08):
    """맨 앞 타격은 그대로, 말이 시작되면 drop dB로 내린다 — 브랜드 이름 첫 음절이 물소리보다 6.8dB 작았다(11-04 소리 층을 떼어 잼 → 뒤로 차이 +8 이상)"""
    tt = np.arange(len(x)) / C.RATE
    g = 10 ** (np.interp(tt, [0, hit, hit + over, 99], [0, 0, drop, drop]) / 20)
    return x * (g[:, None] if x.ndim == 2 else g).astype(np.float32)


m.put(SPLASH - 0.13, under_word(bath[int(34.95 * C.RATE):int(36.05 * C.RATE)]), -7, fade=0.004, fade_out=0.55)
deep = glob.glob(os.path.join(SON, "Epic Stock Media - Elemental Mutation Whooshes and Impacts", "WATRImpt_Impact Water Deep Submerge Bubble*"))[0]
m.put(SPLASH - 0.08, under_word(C.load(deep), hit=0.09, drop=-8.0), -13, fade=0.002, fade_out=0.8)
lap = C.load(os.path.join(SFX, "Water Movement Light Splashes.M.wav"))
m.put(21.0, lap[int(3.0 * C.RATE):int(6.0 * C.RATE)], 16, fade=0.3, fade_out=1.0)
m.put(21.75, C.load(DING), -9)   # 물이 가라앉고 물속에 브랜드가 뜨는 자리(끝합성.py --나타남, 물 판 1.875초)
m.finish(os.path.join(PUB, "sound_narr.wav"), boost_db=-1.8)   # −3.0이면 −15.2 LUFS(11-03 최종) — 다른 편처럼 −14 안팎으로
