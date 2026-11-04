# 11번 첨벙댕 B급 소리(2026-11-04) — 유호님 「B급처럼 재밌게」 · 「번쩍이란 글을 강조」. Kevin 내레이션은 그대로 두고(「나레이션은 참 만족스럽네」), 강한 낱말과 말이 안 되는 짓마다 만화 소리를 얹는다.
#   python -X utf8 B급소리.py <Kevin.mp3>  → git 밖 최종/자막시안_public/p11/sound_b.wav
# 시각은 화면 장(24fps, 최종편집.py CUTS_B)과 낱말 자리(timing.ts)에서 온다. 효과음은 말 뒤에 깔고, 말이 시작되면 내린다(under_word) — 말이 묻히면 편 전체가 무너진다.
# 소리 창고에 없는 슬라이드 휘슬 · 테레민 · 소나 · 오락실 음은 여기서 합성한다.
import glob
import os
import re
import json
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

VOICE = sys.argv[1]
RATE = C.RATE
HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, "..", "자막시안_20261103")
V = "C:/Users/q1212/Documents/synk-vendor"
PUB = V + "/pulse-portfolio12-20261024/최종/자막시안_public/p11"
BGM = V + "/pulse-portfolio12-20261024/최종/음악/p11_Splash_A.mp3"
H = V + "/homeshopping-horror-20261021/remotion_v1-v3_워크트리사본/public/sfx/"
F = V + "/sound-library/fairlight/Media Files/"
S = V + "/sound-library/sonniss_gdc2026/풀림/"
END = 574 / 24
rng = np.random.default_rng(11)


def one(pattern):
    return glob.glob(S + pattern)[0]


def part(path, a=0.0, b=None):
    x = C.load(path)
    return x[int(a * RATE):(int(b * RATE) if b else None)].copy()


def stretch(x, speed):
    """재생 속도를 바꾼다(음높이도 같이) — speed < 1이면 느리고 낮다"""
    idx = np.arange(0, len(x) - 1, speed)
    return np.interp(idx, np.arange(len(x)), x).astype(np.float32)


def under_word(x, hit=0.12, drop=-9.0, over=0.06):
    """맨 앞 타격은 그대로, 말이 시작되면 drop dB로 내린다"""
    tt = np.arange(len(x)) / RATE
    return (x * 10 ** (np.interp(tt, [0, hit, hit + over, 99], [0, 0, drop, drop]) / 20)).astype(np.float32)


def room(x, wet=0.22, tail=0.55):
    """작은 잔향 — 합성음이 맨 소리로 뜨지 않게"""
    n = int(tail * RATE)
    ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (0.16 * RATE))
    ir /= np.sqrt((ir * ir).sum())
    out = np.convolve(x, ir)
    out[:len(x)] = out[:len(x)] * wet + x * (1 - wet)
    out[len(x):] *= wet
    return out.astype(np.float32)


def env(n, a=0.02, r=0.06):
    e = np.ones(n, np.float32)
    na, nr = int(a * RATE), int(r * RATE)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def slide(f0, f1, dur, breath=0.05):
    """슬라이드 휘슬 — 올라가면 뜨고 내려가면 떨어진다"""
    t = np.arange(int(dur * RATE)) / RATE
    f = f0 * (f1 / f0) ** (t / dur) * (1 + 0.010 * np.sin(2 * np.pi * 6.4 * t))
    ph = 2 * np.pi * np.cumsum(f) / RATE
    x = np.sin(ph) + 0.16 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    noise = np.convolve(rng.normal(0, 1, len(t)), np.ones(9) / 9, mode="same")
    x = (x + breath * noise * np.abs(np.sin(ph))) * env(len(t), 0.015, 0.05)
    return room(x / np.abs(x).max(), 0.15, 0.3)


def theremin(points, dur, rate=5.4, depth=0.028, release=0.25):
    """테레민 — 옛날 영화의 비행접시 소리. points는 (0~1 자리, Hz) 줄"""
    t = np.arange(int(dur * RATE)) / RATE
    xs, ys = zip(*points)
    f = np.exp(np.interp(t / dur, xs, np.log(ys))) * (1 + depth * np.sin(2 * np.pi * rate * t))
    ph = 2 * np.pi * np.cumsum(f) / RATE
    x = (np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)) * env(len(t), 0.12, release)
    return room(x / np.abs(x).max(), 0.32, 0.7)


def sonar(f=1320.0, dur=0.55):
    """소나 핑 — 귀 레이더"""
    t = np.arange(int(dur * RATE)) / RATE
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.09) + 0.3 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.05)
    d = int(0.19 * RATE)
    y = np.zeros(len(x) + d * 2, np.float32)
    y[:len(x)] += x
    y[d:d + len(x)] += 0.32 * x
    y[d * 2:d * 2 + len(x)] += 0.11 * x
    return room(y / np.abs(y).max(), 0.2, 0.4)


def chip(notes, step=0.075):
    """오락실 뽑기 기계 음 — 네모파 아르페지오"""
    out = []
    for hz in notes:
        t = np.arange(int(step * RATE)) / RATE
        x = np.sign(np.sin(2 * np.pi * hz * t)) * 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * hz * 2 * t))
        out.append(x * np.exp(-t / (step * 0.8)))
    t = np.arange(int(0.28 * RATE)) / RATE
    hz = notes[-1]
    out.append((np.sign(np.sin(2 * np.pi * hz * t)) * 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * hz * 2 * t))) * np.exp(-t / 0.1))
    x = np.concatenate(out)
    x = np.convolve(x, np.ones(5) / 5, mode="same")   # 네모파 모서리를 살짝 죽인다
    return x.astype(np.float32) / np.abs(x).max() * 0.8


# ── 낱말 자리
src = open(os.path.join(CAP, "remotion", "src", "p11", "timing.ts"), encoding="utf-8").read()
lines = json.loads(re.search(r"LINES: Line\[\] = (\[.*\]);", src, re.S).group(1))
w = lambda li, wi: lines[li]["words"][wi]["t"]
SPLASH = w(8, 3)  # 첨벙댕 20.39

# ── 화면 자리(장 → 초, CUTS_B와 같은 값)
CUT_MOON, CUT_RUN, CUT_BOX, CUT_WRAP, CUT_OWL, CUT_CLAW, CUT_GLAM, CUT_DROP = 52 / 24, 91 / 24, 163 / 24, 185 / 24, 280 / 24, 330 / 24, 371 / 24, 453 / 24
VEST_SHOOT = CUT_WRAP                     # p11-b04e 0장 — 조끼가 날아가기 시작(「특별한」)
VEST_SLAM = 191 / 24                      # 6장 — 조끼가 개에게 철썩, 촉수
SLAM = w(3, 1)                            # 구명조끼! — 스티커 쾅
STRAPS = 216 / 24                         # 촉수가 다 들어가 찰칵 조인다
MOON_LIFT = CUT_MOON + (32 - 30) / 24     # p11-b02 32장 — 발이 떨어진다
MOON_FALL = CUT_MOON + (60 - 30) / 24     # 60장 — 내려오기 시작
SHOOT = CUT_RUN + 0.02                    # p11-b03 — 막대기처럼 솟는다(×1.45)
SHOOT_TOP = CUT_RUN + (18 - 4) / 24 / 1.45   # 18장 — 다 솟았다
MAN_FALL = w(1, 3) + (75 - 62) / 24       # 75장 — 남자가 앞으로 처박힌다
CLAMP = CUT_CLAW + (36 - 25) / 24         # p11-b07 36장 — 집게가 손잡이를 문다
YANK = w(5, 5)                            # 번쩍 14.34 — 판이 위로 튀는 자리(39장)
RISE = CUT_GLAM + (45 - 15) / 24          # p11-b09 45장 — 뜨기 시작
BEAM_ON = w(7, 0) - 0.04                  # 띠가 열리고 납치 빔이 켜진다(B.tsx Beam)
BEAM_OFF = CUT_DROP + 30 / 24             # 빔이 꺼진다
HIT = CUT_DROP + 37 / 24                  # p11-b11 37장 — 물에 닿는다
FALL = CUT_DROP + 31 / 24                 # 31장 — 떨어지기 시작
WATER = CUT_DROP + 11 / 24                # 11장 — 물이 들어온다
UNDER = CUT_DROP + 56 / 24                # 56장 — 물속
POPUP = CUT_DROP + 70 / 24                # 70장 — 코르크처럼 솟는다

m = C.Mix(END + 0.3)

# ── 내레이션 — 낱말 시각표 그대로
voice = C.load(VOICE)
for ln in lines:
    a, b = ln["src"]
    m.put(ln["at"] - 0.04, voice[int(max(0, a - 0.04) * RATE):int((b + 0.18) * RATE)], 0, fade=0.01, fade_out=0.08)

# ── 곡 — 말 밑 −17, 샴푸 광고 자리만 뚝 낮춰 분위기가 어이없게 바뀐다, 물보라에서 16초 건너뛰어 곡 끝이 맺는다
song = C.load_stereo(BGM)
head = song[:int(SPLASH * RATE)].copy()
tt = np.arange(len(head)) / RATE
head *= (10 ** (np.interp(tt, [0, CUT_GLAM - 0.02, CUT_GLAM + 0.03, CUT_DROP - 0.03, CUT_DROP + 0.25, 99], [-17, -17, -33, -33, -17, -17]) / 20))[:, None].astype(np.float32)
m.put(0, head, 0, fade_out=0.03)
tail = song[int((SPLASH + 16.0) * RATE):].copy()
tt = np.arange(len(tail)) / RATE + SPLASH
tail *= (10 ** (np.interp(tt, [SPLASH, 21.25, 21.75, 40], [-17, -17, -10.5, -10.5]) / 20))[:, None].astype(np.float32)
m.put(SPLASH, tail, 0, fade=0.01, fade_out=0.3)

# ── 바다 — 바닷가 컷에만
sea = C.load_stereo(F + "Ocean Waves Day From Balcony.wav")
m.put(0, sea[RATE * 3:RATE * 3 + int(CUT_BOX * RATE)], -24, fade=0.004, fade_out=0.05)
m.put(CUT_CLAW, sea[RATE * 12:RATE * 12 + int((CUT_GLAM - CUT_CLAW) * RATE)], -22, fade=0.01, fade_out=0.05)

# ── 외계인 닮은 우리 개는 — 귀 레이더: 소나 핑 + 서보
ping = sonar()
servo = part(one("Epic Stock Media - Tower Defense Game/ROBTMvmt_*"))
m.put(0.02, ping, -20)
m.put(0.52, servo, -22, fade_out=0.3)
m.put(1.25, ping, -15)
m.put(1.62, servo, -20, fade_out=0.3)

# ── 뛰어노는 걸 — 달 중력: 느린 보잉, 위로 미끄러지는 휘슬, 공중에 뜬 동안 테레민
boing = C.load(H + "boing.wav")
m.put(MOON_LIFT - 0.06, stretch(boing, 0.72), -15)
m.put(MOON_LIFT, slide(380, 1250, 0.62), -22)
m.put(MOON_LIFT + 0.55, theremin([(0, 980), (0.5, 1120), (1, 840)], CUT_RUN - MOON_LIFT - 0.5), -27)

# ── 근데 사람들이 보면 — 막대기처럼 쑥 솟는다, 그리고 어색한 정적(곡은 그대로, 위에서 희미한 비행접시)
m.put(SHOOT - 0.01, slide(300, 1700, SHOOT_TOP - SHOOT + 0.05), -18)
m.put(SHOOT_TOP, theremin([(0, 1150), (0.5, 1260), (1, 1090)], w(1, 3) - SHOOT_TOP - 0.05), -28)
lock = chip([1319, 1760], step=0.05)   # 조준 표시가 잠기는 삐빅(B.tsx LockMark)
m.put(4.62, lock, -21)
m.put(4.90, lock, -20)

# ── 깜짝 — 부웅 → 쿵, 비명 두 개, 처박히는 소리
m.put(w(1, 3) - 0.34, C.load(H + "whoosh_down.wav"), -11)
m.put(w(1, 3) - 0.04, under_word(part(one("Epic Stock Media - Anime Game/FGHTImpt_*")), hit=0.07, drop=-14, over=0.03), -9, fade_out=0.4)
m.put(w(1, 3) - 0.04, under_word(C.load(H + "boom.wav"), hit=0.07, drop=-14, over=0.03), -15, fade_out=0.5)
YELL_F = part(one("344 Audio - Anime Fight Voices Vol. 2/VOXFem_Anime, Warrior Elf*"))
YELL_M = part(one("344 Audio - Anime Fight Voices Vol. 1/VOXMale_Male Adventurer*"))
m.put(w(1, 3) + 0.56, stretch(YELL_F, 1.12), -23, fade_out=0.25)
m.put(w(1, 3) + 0.62, YELL_M, -20, fade_out=0.1)
m.put(MAN_FALL - 0.2, part(F + "Heavy Body Fall with Hand.M.wav"), -12, fade_out=0.5)

# ── 그래서 — 판이 바뀌며 눈이 켜진다. 외계 소리가 부풀고 테레민이 올라가다 뚝
m.put(CUT_BOX + 0.04, servo, -22, fade_out=0.3)
m.put(CUT_BOX + 0.08, ping, -21)
swell = part(one("Epic Stock Media - Halloween Game - Haunted House and Horror Audio Scare Kit/UIAlert_*"), 0.0, 4.6)
m.put(CUT_BOX + 0.1, swell[:int((VEST_SHOOT - CUT_BOX - 0.1) * RATE)], -23, fade=0.1, fade_out=0.04)
m.put(CUT_BOX + 0.1, theremin([(0, 330), (0.8, 980), (1, 1180)], VEST_SHOOT - CUT_BOX - 0.1, release=0.012), -24)

# ── 특별한 걸 — 조끼가 휙 날아와 철썩, 촉수가 꿀렁꿀렁 나왔다 들어가 찰칵
m.put(VEST_SHOOT, C.load(H + "swish.wav"), -19)
m.put(VEST_SLAM - 0.03, under_word(C.load(H + "thud.wav"), hit=0.05, drop=-12, over=0.03), -11)
m.put(VEST_SLAM - 0.03, under_word(part(one("Epic Stock Media - Anime Game/FGHTImpt_*")), hit=0.05, drop=-14, over=0.03), -14, fade_out=0.3)
tentacle = part(one("Epic Stock Media - Anime Game/DSGNMisc_*"), 0, STRAPS - VEST_SLAM - 0.03)
m.put(VEST_SLAM + 0.03, tentacle, -20, fade=0.01, fade_out=0.12)
m.put(STRAPS - 0.12, part(F + "Belt Buckle.M.wav", 0, 0.3), -20, fade_out=0.08)
m.put(STRAPS, part(one("Epic Stock Media - HD Lock And Mechanism Sound Design Kit/MECHLtch_*")), -15)

# ── 구명조끼! — 스티커 쾅
m.put(SLAM - 0.04, under_word(C.load(H + "thud.wav"), hit=0.06, drop=-12, over=0.03), -9)
m.put(SLAM - 0.01, under_word(C.load(H + "snap.wav"), hit=0.05, drop=-10), -15)

# ── 값도 착하고 — 동전 땡그랑, 착하니까 천사 반짝
m.put(w(4, 0) - 0.03, part(one("Cinematic Sound Design - UI Interaction Elements/Ting Coins*")), -21)
m.put(w(4, 1) - 0.02, C.load(H + "sparkle.wav"), -18)

# ── 튼튼 — 쇳덩이가 떨어져 꽝 울린다
TOUGH = w(4, 2) + 0.09
m.put(TOUGH - 0.235, under_word(part(F + "Metal Hit.M.wav"), hit=0.3, drop=-7), -5, fade_out=0.6)
m.put(TOUGH - 0.005, under_word(C.load(H + "boom.wav"), hit=0.1, drop=-9), -12, fade_out=0.5)
m.put(TOUGH + 0.26 - 0.235, under_word(part(F + "Metal Hit.M.wav"), hit=0.3, drop=-7), -16, fade_out=0.4)   # 한 번 더 튕긴다(B.tsx Tough)

# ── 고개가 돈다 — 태엽 감는 소리가 점점 빨라지다 뚝(화면 304장에서 빨라지고 318장에서 멈춘다, CUTS_B)
SPIN, STOP = 304 / 24, 318 / 24
wind = part(F + "Toy Winding Up.M.wav", 2.0, 2.0 + (SPIN - TOUGH - 0.1))
m.put(TOUGH + 0.1, wind, -15, fade=0.03, fade_out=0.01)
fast = stretch(part(F + "Toy Winding Up.M.wav", 4.0, 7.0), 1.9)[:int((STOP - SPIN) * RATE)]
m.put(SPIN, fast, -13, fade=0.01, fade_out=0.01)
m.put(STOP - 0.04, part(one("Epic Stock Media - HD Lock And Mechanism Sound Design Kit/MECHLtch_*")), -13)

# ── 손잡이 두 개 — 조준 표시가 삐빅 잠긴다(B.tsx Handles)
m.put(w(5, 1) - 0.01, lock, -23)
m.put(w(5, 3) - 0.02, lock, -21)

# ── 뽑기 집게 — 줄 내려오는 소리, 물었다 찰칵
m.put(CUT_CLAW, part(F + "Pulley.M.wav", 2.0, 2.0 + (YANK - CUT_CLAW)), -20, fade=0.01, fade_out=0.03)
m.put(CLAMP, part(one("Epic Stock Media - HD Lock And Mechanism Sound Design Kit/MECHLtch_*")), -8)

# ── 번쩍! — 번쩍이는 소리 + 위로 휙 + 물이 쏟아진다
power = part(one("Epic Stock Media - Anime Game/DSGNStngr_*"))
m.put(YANK - 0.09, under_word(power, hit=0.14, drop=-6), -8, fade_out=0.5)
m.put(YANK - 0.06, under_word(part(F + "Sparkler Fast Whoosh.M.wav", 0.4, 1.4), hit=0.12, drop=-6), -6, fade_out=0.4)
m.put(YANK - 0.02, slide(500, 2100, 0.28), -19)
bath = C.load(F + "Water Splash Bath.M.wav")
m.put(YANK + 0.12, bath[int(34.95 * RATE):int(35.9 * RATE)], -21, fade=0.01, fade_out=0.5)

# ── 건져요 — 뽑았다! 오락실 음
m.put(lines[5]["end"] - 0.34, chip([784, 988, 1175, 1568]), -19)

# ── 멋있을 거예요 — 곡이 뚝 줄고 샴푸 광고 바람 · 반짝
storm = C.load_stereo(one("344 Audio - Extreme Winds Vol. 1/WINDDsgn_*"))
m.put(CUT_GLAM, storm[RATE * 20:RATE * 20 + int((CUT_DROP - CUT_GLAM) * RATE)], -21, fade=0.08, fade_out=0.9)
for k in [0.25, 0.95, 1.5]:
    m.put(CUT_GLAM + k, C.load(H + "sparkle.wav"), -21)

# ── 외계인인 줄 — 납치 빔: 띠가 열리면 비행접시 소리가 위로 올라가고, 물이 차도 계속 울리다 뚝 끊긴다
ufo = theremin([(0, 420), (0.35, 760), (0.7, 1050), (1, 1180)], BEAM_OFF - BEAM_ON, rate=7.2, depth=0.05, release=0.012)[:int((BEAM_OFF - BEAM_ON) * RATE)]
m.put(BEAM_ON, ufo, -19, fade=0.01)
click = part(F + "Plastic Flashlight Switch.M.wav")
hit = int(np.argmax(np.abs(click)))
m.put(BEAM_OFF - 0.02, click[max(0, hit - int(0.02 * RATE)):hit + int(0.14 * RATE)], -15, fade=0.002)
m.put(BEAM_OFF + 0.02, part(one("Cinematic Sound Design - System & UI Feedback Elements/Interface Deny Low Fat Dark*")), -25, fade_out=0.15)   # 신호 끊김

# ── 물놀이 — 물이 차오른다
rush = part(F + "Bathtub On Fill Off Bubble .wav", 20.0, 22.6)
tt = np.arange(len(rush)) / RATE
rush = rush * (10 ** (np.interp(tt, [0, 0.25, HIT - WATER - 0.25, HIT - WATER - 0.03, HIT - WATER + 0.02, 2.6], [-26, -21, -21, -6, -14, -34]) / 20)).astype(np.float32)   # 「날엔」이 묻히지 않게 말 동안은 낮게(첫 판 +0.6dB)
m.put(WATER, rush, 0, fade=0.01)

# ── 떨어진다 — 휘슬이 뚝 → 첨벙
m.put(FALL - 0.06, slide(1500, 240, HIT - FALL + 0.06), -19)
m.put(HIT - 0.13, under_word(bath[int(34.95 * RATE):int(36.05 * RATE)], hit=0.14, drop=-10, over=0.08), -7, fade=0.004, fade_out=0.55)
deep = glob.glob(S + "Epic Stock Media - Elemental Mutation Whooshes and Impacts/WATRImpt_Impact Water Deep Submerge Bubble*")[0]
m.put(HIT - 0.08, under_word(C.load(deep), hit=0.09, drop=-8), -13, fade=0.002, fade_out=0.8)
lap = C.load(F + "Water Movement Light Splashes.M.wav")
m.put(21.0, lap[int(3.0 * RATE):int(6.0 * RATE)], 14, fade=0.3, fade_out=1.0)

# ── 물속 뽀글 → 코르크처럼 퐁
m.put(UNDER, part(one("Cinematic Sound Design - Cartoon & Animation Vol 2/Cartoon Bubbles Short*")), -11, fade_out=0.3)
m.put(POPUP - 0.03, stretch(boing, 1.25), -9)

# ── 브랜드 땡, 착륙 성공 음, 끝 농담에 비행접시 한 번, 고글이 켜지는 핑
m.put(21.75, C.load(H + "ding1.wav"), -9)
m.put(21.95, part(one("Cinematic Sound Design - Hybrid Game & UI Elements/Game Entry Happy Short*")), -18)
m.put(22.59, theremin([(0, 1050), (0.35, 1320), (1, 760)], 0.95), -19)
m.put(22.85, sonar(880.0), -16)

# ── 시스템 메시지가 뜰 때마다 작은 틱(B.tsx HUD)
tick = C.load(H + "tick.wav")
for at in [0.06, CUT_MOON + 0.04, CUT_RUN + 0.04, w(1, 3) + 0.6, CUT_BOX + 0.1, VEST_SLAM + 0.12, STRAPS, CUT_OWL + 0.2, STOP, CUT_CLAW + 0.04, BEAM_ON]:
    m.put(at, tick, -27)

m.finish(os.path.join(PUB, "sound_b.wav"), boost_db=-1.8)

# ── 말 대 나머지를 낱말마다 잰다(귀로 못 들어 숫자로 본다) — 말이 실제로 나는 칸(20ms)만 견준다. 낱말 뒤 빈자리까지 평균 내면 비명 · 물소리가 낱말을 먹는 것처럼 나온다
only = C.Mix(END + 0.3)
for ln in lines:
    a, b = ln["src"]
    only.put(ln["at"] - 0.04, voice[int(max(0, a - 0.04) * RATE):int((b + 0.18) * RATE)], 0, fade=0.01, fade_out=0.08)
rest = m.a - only.a
STEP = int(0.02 * RATE)
print("낱말별 말 − 나머지 dB, 말이 나는 칸만 (6 아래면 묻힐 수 있음)")
worst = []
for li, ln in enumerate(lines):
    row = []
    for wi, word in enumerate(ln["words"]):
        a = word["t"]
        b = ln["words"][wi + 1]["t"] if wi + 1 < len(ln["words"]) else ln["end"]
        i, j = int(a * RATE), int(b * RATE)
        v = only.a[i:j, 0]
        r = rest[i:j, 0]
        n = len(v) // STEP
        if not n:
            continue
        vs = np.sqrt(np.mean(v[:n * STEP].reshape(n, STEP) ** 2, axis=1) + 1e-12)
        rs = np.sqrt(np.mean(r[:n * STEP].reshape(n, STEP) ** 2, axis=1) + 1e-12)
        on = vs > vs.max() * 0.25
        d = 20 * np.log10(np.sqrt(np.mean(vs[on] ** 2)) / np.sqrt(np.mean(rs[on] ** 2)))
        row.append(f"{word['w']} {d:+.1f}")
        worst.append((round(float(d), 1), word["w"], word["t"]))
    print(" ", " · ".join(row))
print("가장 낮은 다섯:", sorted(worst)[:5])
