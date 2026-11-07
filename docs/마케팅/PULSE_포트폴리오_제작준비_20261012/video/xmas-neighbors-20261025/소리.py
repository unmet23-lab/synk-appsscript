# 옆집의 크리스마스 소리(2026-11-07, Claude) — 02_콘티 4절. 목소리 · 사건 소리 · 바탕 · 곡을 화면 초에 놓아 소리.wav 하나로 섞는다.
#   python -X utf8 소리.py   → git 밖 pulse-portfolio12-20261024/최종/s1/소리.wav (+ 목소리만.wav · 곡뺀.wav — 점검용)
# 목소리: 엄마 · 민재 · 하린은 시댄스가 처음 낸 목소리(목소리 판 — 목소리꾸러미.py, 결정 10-29 · 11-01), 끝 내레이션은 일레븐 v4(내레이터굽기.py —
#   시댄스 판이 브랜드를 「늘큼」으로 읽음). 판 소리는 Demucs로 목소리만 떼고, 말 사이 긴 쉼만 줄인다(빠르기 · 음높이는 손대지 않음 — 결정 10-24).
#   전화 · 창 너머 · 복도 울림은 여기서 입힌다(판 소리는 깨끗하게 받음).
# 사건 소리: 소리 모음(fairlight · sonniss) — 없는 셋(전자레인지 띵 · 배터리 알림음 · 꺼지는 전구 지직)은 짧게 합성한다.
# 곡: 최종/s1/소리/곡.wav가 있으면 깐다(곡 편집은 곡편집.py). 없으면 곡 없이.
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집공통 as C   # noqa: E402

R = C.RATE
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s1"
SND = os.path.join(ROOT, "소리")
LF = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files"
LS = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림"
MUSIC = os.path.join(SND, "곡.wav")
PARTY = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/p11_Splash_B.mp3"   # 504 집들이 곡(우리 Suno 곡 — 문 너머라 흐리게)
END = 60.04
NARRATOR = "Elara-또렷-1"   # 일레븐 v4 넷 가운데 Elara → 같은 목소리 「[clearly] 늘켬」 판(11-07 Gemini 일곱 판 청취 「가장 자연스러움」, 받침은 위스퍼 · 스크라이브 둘 다 「늘켬」)
NARR_AT = 56.25   # 35 끝에서 시작해 36으로 이어짐(J컷) — 「켬」이 59.25초쯤 끝나고 글로켄이 끝까지 0.75초 운다(11-07 Fable 끝 맹검 「종 뒤 여운 0.6초는 급함」)
MUSIC_DB = -4.0   # 곡.wav(피아노 −27 · 현악 −22 · 절정 −19 dB RMS) → 섞을 때 −31 · −26 · −23
TIMING = {}   # Remotion s1 자막 · 끝 글 시각(소리를 놓은 자리에서 그대로)
T = [0.00, 3.56, 4.52, 5.88, 7.04, 8.64, 10.08, 11.88, 13.28, 15.00, 15.96, 17.40, 18.80, 20.00, 21.44, 22.76, 24.12, 24.60, 25.88, 28.44,
     30.76, 32.00, 33.36, 34.48, 35.92, 37.48, 38.88, 40.12, 42.88, 44.04, 46.44, 47.60, 49.68, 50.84, 53.84, 57.08, 60.04]


def f(name):
    return os.path.join(LF, name)


def s(folder, name):
    return os.path.join(LS, folder, name)


def load(path, a=0.0, d=None, stereo=False):
    x = C.load_stereo(path) if stereo else C.load(path)
    i = int(a * R)
    return x[i:i + int(d * R)] if d else x[i:]


def filt(x, lo=None, hi=None, order=2):
    # 위상이 안 밀리는 대역 거르기(짧은 조각에만)
    n = len(x)
    fr = np.fft.rfftfreq(n, 1 / R)
    g = np.ones_like(fr)
    if hi:
        g *= 1 / np.sqrt(1 + (fr / hi) ** (2 * order))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(fr, 1e-3)) ** (2 * order))
    if x.ndim == 1:
        return np.fft.irfft(np.fft.rfft(x) * g, n).astype(np.float32)
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c]) * g, n) for c in range(x.shape[1])], axis=1).astype(np.float32)


def verb(x, seconds=0.6, wet_db=-12, seed=3, lo=None, hi=6000):
    n = int(seconds * R)
    rng = np.random.default_rng(seed)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / R / (seconds / 6.9))
    ir = filt(ir.astype(np.float32), lo=lo, hi=hi)
    m = len(x) + n
    mono = x if x.ndim == 1 else x.mean(axis=1)
    wet = np.fft.irfft(np.fft.rfft(mono, m) * np.fft.rfft(ir, m), m).astype(np.float32)
    wet *= (np.sqrt(np.mean(mono ** 2)) / (np.sqrt(np.mean(wet ** 2)) or 1)) * 10 ** (wet_db / 20)
    out = np.zeros(m, np.float32)
    out[:len(mono)] += mono
    return out + wet


def rms_db(x):
    v = x if x.ndim == 1 else x.mean(axis=1)
    k = max(1, int(0.05 * R))
    e = np.array([np.sqrt(np.mean(v[i:i + k] ** 2) + 1e-12) for i in range(0, max(1, len(v) - k), k)])
    on = e[e > e.max() * 0.1] if len(e) else e
    return 20 * np.log10(np.sqrt(np.mean(on ** 2)) + 1e-12) if len(on) else -120.0


def at_rms(x, db):
    return x * 10 ** ((db - rms_db(x)) / 20)


def at_peak(x, db):
    return x * 10 ** (db / 20) / (float(np.max(np.abs(x))) or 1.0)


def add(*xs):
    # 길이가 다른 조각을 짧은 쪽에 맞춰 더한다
    n = min(len(x) for x in xs)
    return sum(x[:n] for x in xs)


def fade(x, a=0.01, b=0.05):
    x = x.copy()
    na, nb = int(a * R), int(b * R)
    if na:
        x[:na] *= np.linspace(0, 1, na)[:, None] if x.ndim > 1 else np.linspace(0, 1, na)
    if nb:
        x[-nb:] *= np.linspace(1, 0, nb)[:, None] if x.ndim > 1 else np.linspace(1, 0, nb)
    return x


def onset(x, th_db=-30):
    # 첫 소리(봉우리 대비 th_db 위)가 시작하는 표본
    v = np.abs(x if x.ndim == 1 else x.mean(axis=1))
    k = int(0.005 * R)
    e = np.array([v[i:i + k].max() for i in range(0, len(v) - k, k)])
    j = np.argmax(e > e.max() * 10 ** (th_db / 20))
    return j * k


def tighten(x, gaps, keep=0.28):
    """말 사이 긴 쉼만 keep초로 줄인다 — gaps = [(쉼 시작초, 쉼 끝초), …](판 안 시각). 말 자체의 빠르기는 그대로."""
    out, last = [], 0
    for a, b in gaps:
        ia, ib = int(a * R), int(b * R)
        cut = max(0, (ib - ia) - int(keep * R))
        if cut <= 0:
            continue
        mid = ia + (ib - ia - cut) // 2
        out.append(x[last:mid])
        last = mid + cut
        # 잇는 자리 10ms 겹침 페이드
        n = int(0.01 * R)
        if len(out[-1]) > n and last + n < len(x):
            seg = out[-1]
            seg[-n:] = seg[-n:] * np.linspace(1, 0, n) + x[last:last + n] * np.linspace(0, 1, n)
            last += n
    out.append(x[last:])
    return np.concatenate(out)


def voice(pid):
    # 판 소리에서 목소리만(Demucs CPU — 이미 있으면 그대로)
    return C.load(C.voice_only(pid, os.path.join(SND, "목소리")))


def phone(x):
    # 전화 스피커: 좁은 대역(450~3000) + 작은 스피커의 1.2 kHz 울림 + 찌그러짐 + 귀에 댄 반사(7 ms) + 복도 울림
    # 첫 판은 맹검(Gemini) 「AI가 전화 필터만 씌운 소리」 — 스피커 결과 공간을 더함
    y = filt(x, lo=450, hi=3000, order=4)
    y = y + 0.8 * filt(y, lo=900, hi=1600, order=2)
    y = np.tanh(y * 4.0 / (np.max(np.abs(y)) or 1)) * 0.5
    d = int(0.007 * R)
    y = y + 0.35 * np.concatenate([np.zeros(d, np.float32), y[:-d]])
    return verb(y, 0.45, wet_db=-16, lo=300, hi=3000)


def through_window(x, hi=1100):
    # 창 · 복도 너머: 높은 소리가 깎이고 울림이 붙는다 — 맹검 1차 「바짝 댄 마이크처럼 들림」 → 1.4 kHz, 2차(11-07) 「거리감이 약해 바로 옆」 → 1.1 kHz · 울림을 소리만큼
    return verb(filt(x, lo=220, hi=hi, order=3), 1.2, wet_db=-2, hi=max(1900, hi + 700))


# ---------- 합성 소리 ----------

def ding():
    # 전자레인지 「띵」 — 1.4 kHz 종소리 배음 + 지수 감쇠
    t = np.arange(int(1.4 * R)) / R
    y = sum(a * np.sin(2 * np.pi * fr * t) for fr, a in ((1396, 1.0), (2792, 0.35), (4188, 0.12), (1402, 0.4)))
    return (y * np.exp(-t * 3.2) * np.clip(t / 0.004, 0, 1)).astype(np.float32)


def glock(f0=1046.5, d=2.6):
    # 끝 소리 마침표 — 곡 끝 화음(다 장조, 베이스 C3)의 C6 글로켄슈필 한 점. 막대의 배음(×2.76 · ×5.40)은 빨리 사라진다(11-07 Gemini 맹검 「사운드 마침표가 없다」)
    t = np.arange(int(d * R)) / R
    y = (np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.95)
         + 0.22 * np.sin(2 * np.pi * f0 * 2.756 * t) * np.exp(-t / 0.22)
         + 0.07 * np.sin(2 * np.pi * f0 * 5.404 * t) * np.exp(-t / 0.08)
         + 0.18 * np.sin(2 * np.pi * f0 * 1.5 * t) * np.exp(-t / 0.7))   # 위 5도(G6)를 살짝 — 화음 안에 앉게
    y *= np.clip(t / 0.0025, 0, 1)
    return filt(y.astype(np.float32), hi=7000)


def low_battery():
    # 배터리 부족 알림음 — 짧은 두 음(높음 → 낮음)
    def tone(fr, d):
        t = np.arange(int(d * R)) / R
        e = np.clip(t / 0.006, 0, 1) * np.clip((d - t) / 0.03, 0, 1)
        return (np.sin(2 * np.pi * fr * t) * 0.8 + np.sin(2 * np.pi * 2 * fr * t) * 0.15) * e
    gap = np.zeros(int(0.06 * R))
    return np.concatenate([tone(1175, 0.11), gap, tone(880, 0.16)]).astype(np.float32)


def dying_bulb(seed=5):
    # 꺼지기 직전 필라멘트 「지직」 — 100 Hz 웅 + 끊기는 잡음 다발(0.32초) → 「툭」
    rng = np.random.default_rng(seed)
    d = 0.34
    t = np.arange(int(d * R)) / R
    hum = sum(np.sin(2 * np.pi * 100 * k * t) / k for k in (1, 2, 3, 5)) * 0.5
    gate = (rng.random(len(t) // 240 + 1) > 0.35).repeat(240)[:len(t)].astype(np.float32)
    crack = rng.standard_normal(len(t)) * gate * 0.6
    y = (hum + filt(crack.astype(np.float32), lo=1500, hi=9000)) * np.clip((d - t) / 0.05, 0, 1) * np.clip(t / 0.01, 0, 1)
    pop_t = np.arange(int(0.08 * R)) / R
    pop = rng.standard_normal(len(pop_t)) * np.exp(-pop_t * 70)
    return y.astype(np.float32), filt(pop.astype(np.float32), lo=200, hi=5000)


def build():
    m = C.Mix(END + 0.4)
    put = m.put

    # ---- 바탕(장소마다, 컷 경계에서 바뀜) ----
    night = load(f("Magnolia Night Traffic Car Bus B.wav"), 3, 30, stereo=True)
    wind = load(s("InMotionAudio - Chimney Wind", "WINDInt_ChimneyWind05_InMotionAudio_ChimneyWind.wav"), 2, 40, stereo=True)
    hum = load(s("Jake Fielding - Fridge Hums Vol.2", "MACHAppl_Deep Fridge Hum, Buzz, Electric Tone, Deep_Jake Fielding_Fridge Hums Pt2.wav"), 1, 30, stereo=True)
    rain = load(s("Sonic Bat - Stormy Night Ambience", "SBsna_City Block Square Storm 003.wav"), 5, 10, stereo=True)
    town = load(s("Epic Stock Media - Public Spaces - Urban Life Exteriors", "AMBTown_City Courtyard Calm Street Distant Traffic Children Playing 03_ESM_CPS.wav"), 20, 20, stereo=True)
    seg = lambda x, a, b, off=0.0: x[int(off * R):int((off + b - a) * R)]

    corridor = add(at_rms(filt(night, hi=5000), -40), at_rms(filt(wind, lo=250, hi=3500), -46))
    for a, b, off in ((T[0], T[6], 0.0), (T[11], T[12], 6.0), (T[15], T[17], 9.0), (T[26], T[30], 12.0)):
        put(a, seg(corridor, a, b, off), 0, fade=0.004)
    # 집 안(13 · 14 · 22 · 25 · 31~34): 냉장고 웅 아주 작게
    room = at_rms(filt(hum, lo=60, hi=1200), -50)
    for a, b, off in ((T[12], T[14], 0.0), (T[21], T[22], 3.0), (T[24], T[25], 5.0), (T[30], T[34], 7.0)):
        put(a, seg(room, a, b, off), 0, fade=0.004)
    # 핼러윈 해질녘(18 · 19) · 눈 오는 골목(23 · 24 · 35 · 36): 먼 동네 소리
    dusk = at_rms(filt(town, hi=4000), -42)
    for a, b, off in ((T[17], T[19] + 0.2, 0.0), (T[22], T[24], 4.0), (T[34], T[36], 7.0)):
        put(a, seg(dusk, a, b, off), 0 if a < 50 else -4, fade=0.12, fade_out=0.35)
    # 폭우(20 · 21) — 컷보다 0.14초 먼저 들어와 0.45초에 차오른다
    put(T[19] - 0.14, fade(filt(seg(at_rms(rain, -27), T[19] - 0.14, T[21] + 0.2), hi=6500), 0.45, 0.45), 0, fade=0.004)   # 끝도 0.2초 넘겨 0.45초에 잦아듦(맹검 4차 「32초 눈길로 넘어갈 때 급작」)

    # ---- 504 집들이(7~12 · 13~14는 벽 너머) ----
    party = load(PARTY, 8, 14, stereo=True)
    walla = load(s("Jake Fielding - British Walla and Crowd", "CRWDWalla_Pub Walla, Crowd, Bar, _Jake Fielding_British Walla and Crowd_14.wav"), 4, 12, stereo=True)
    door_open = add(filt(at_rms(party, -31), hi=4200), at_rms(filt(walla, lo=200), -33))
    open_part = door_open[:int((T[11] - T[6]) * R)].copy()
    tt = np.arange(len(open_part)) / R + T[6]
    g = np.interp(tt, [T[6], T[6] + 0.25, 15.35, 15.55, T[10], T[11]], [-14, 0, 0, 5, 3, -8])   # 문이 열리며 쏟아짐 → 10번 볼륨을 올림 → 11번 멀어짐
    put(T[6], open_part * (10 ** (g / 20))[:, None].astype(np.float32), 0, fade=0.004)
    muffled = at_rms(filt(party, hi=650, order=3), -41)   # 12 복도에 남은 소리 · 13 · 14 벽 너머
    put(T[11], seg(muffled, T[11], T[14], 6.0), 0, fade=0.004)
    laugh = load(s("SoundBits - Vox Hominis - Human Effort Voices", "VOXLaff_Laughing Female 02 06_SNDBTS_VH.wav"))
    put(13.30, at_peak(filt(laugh, lo=150), -20)[:int(1.6 * R)], 0, fade=0.003, fade_out=0.4)   # 9 하린이 고개를 젖혀 웃음
    put(15.38, at_peak(load(f("Glass Cheers.M.wav"), 0, 1.0), -24), 0)   # 10 볼륨을 올리자 환호 · 잔

    # ---- 사건 소리 ----
    lock = load(s("344 Audio - Antique Small Metals", "METLMvmt_  Tinkering Antique Lock_344 Audio_Antique Small Metals.wav"))
    keys = load(f("Keys Movement.M.wav"))
    for t0, a in ((0.75, 0.4), (1.55, 1.2), (2.35, 2.0)):   # 1 어둠 속 긁음(멀리 · 작게)
        put(t0, filt(at_peak(lock[int(a * R):int((a + 0.45) * R)], -27), hi=6000), 0, fade=0.01, fade_out=0.12)
    drop = load(f("Keys Rattle.M.wav"))
    put(3.28, at_peak(verb(filt(drop[onset(drop):onset(drop) + int(0.9 * R)], lo=150, hi=7000), 0.8, wet_db=-6, hi=5000), -18), 0, fade=0.002, fade_out=0.5)   # 열쇠 꾸러미가 떨어짐 — 화면 3.33초 바닥
    buzz, pop = dying_bulb()
    put(3.625, at_peak(buzz, -19), 0)   # 2 번쩍 · 지직(판 37~41장 = 화면 3.64초 — 11-07 컷 자리를 8장 당김)
    put(3.995, at_peak(pop, -24), 0)    # 툭 — 꺼짐
    put(4.70, at_peak(keys[int(0.3 * R):int(1.2 * R)], -22), 0, fade=0.01, fade_out=0.2)   # 3 열쇠 짤랑
    bag = load(f("Rustling Plastic Bag.M.wav"))
    put(7.20, at_peak(bag[int(0.2 * R):int(1.3 * R)], -18), 0, fade=0.02, fade_out=0.2)    # 5 봉투 내려놓음
    for t0, a in ((8.80, 0.5), (9.42, 1.4), (9.92, 2.2)):   # 6 긁 · 긁(가까이)
        put(t0, at_peak(lock[int(a * R):int((a + 0.35) * R)], -15), 0, fade=0.005, fade_out=0.08)
    stair = load(s("InMotionAudio - USA Hotel", "DOORMetl_StairWellDoor01_InMotionAudio_USAHotel.wav"))
    so = onset(stair)
    put(T[6] - 0.04, at_peak(stair[so:so + int(0.9 * R)], -17), 0, fade=0.002, fade_out=0.25)   # 7 504 철문이 열림
    kil = load(f("Key in Lock.M.wav"))
    put(17.30, at_peak(kil[onset(kil):onset(kil) + int(0.6 * R)], -18), 0, fade=0.002, fade_out=0.12)   # 12 한참 만에 철컥
    put(18.62, at_peak(stair[so + int(0.9 * R):so + int(2.2 * R)], -16), 0, fade=0.01, fade_out=0.3)   # 철문 닫힘 → 13으로 이어짐
    put(19.18, at_peak(ding(), -23), 0)   # 13 전자레인지 띵(벽 너머 음악 아래)
    latch = load(s("Epic Stock Media - HD Lock And Mechanism Sound Design Kit", "MECHLtch_Click Deep Mechanism Latch Button Nearfield Thunk 02_ESM_HDLM.wav"))
    lo_ = onset(latch)
    put(19.52, filt(at_peak(latch[lo_:lo_ + int(0.25 * R)], -26), hi=3000), 0)   # 전자레인지 문
    put(20.30, at_peak(load(f("Ceramic Plate Rubs.M.wav"), 0.3, 0.8), -30), 0, fade=0.02, fade_out=0.2)   # 14 혼자 먹는 저녁
    put(22.90, at_peak(keys[int(1.0 * R):int(2.0 * R)], -21), 0, fade=0.01, fade_out=0.2)   # 16 열쇠 짤랑
    put(23.55, at_peak(lock[int(3.0 * R):int(3.4 * R)], -21), 0, fade=0.005, fade_out=0.08)
    put(24.16, at_peak(low_battery(), -20), 0)   # 17 배터리 부족
    steps = load(f("BG Footsteps Concrete.wav"), 2, 4)
    put(T[17], at_peak(steps[:int(1.3 * R)], -26), 0, fade=0.02, fade_out=0.3)   # 18 무리 발소리 · 웃음
    put(T[17] + 0.15, filt(at_peak(laugh, -28), lo=200, hi=5000), 0, fade=0.02, fade_out=0.3)
    crowd = load(s("Epic Stock Media - Public Spaces - Crowds Walla and Everyday Ambiences", "AMBPubl_Cruise Ship Walla Distant Adults Children Laughing Screaming 4_ESM_CPS.wav"), 6, 4, stereo=True)
    put(T[17], filt(at_rms(crowd[:int((T[19] - T[17]) * R)], -40), lo=250, hi=3500), 0, fade=0.05, fade_out=0.8)   # 18 · 19 무리 웃음이 계단 쪽으로 멀어짐
    put(28.90, at_peak(steps[int(1.5 * R):int(3.3 * R)], -28), 0, fade=0.05, fade_out=0.3)   # 20 빗속 이웃 발소리
    put(30.95, at_peak(keys[int(2.0 * R):int(2.8 * R)], -20), 0, fade=0.01, fade_out=0.2)   # 21 열쇠 · 봉투가 미끄러짐
    gb = load(f("Grocery Bag Falling.M.wav"))
    put(31.50, at_peak(gb[onset(gb):onset(gb) + int(0.6 * R)], -19), 0, fade=0.003, fade_out=0.2)
    put(32.05, at_peak(load(f("Cloth Putting On Taking Off.M.wav"), 0.2, 1.2), -21), 0, fade=0.03, fade_out=0.25)   # 22 목도리
    snow = load(f("FS in Gravel Snow.M.wav"))
    so2 = onset(snow)
    for t0, k in ((33.42, 0), (33.92, 1), (34.38, 2)):   # 23 첫눈을 밟음
        a = so2 + int(k * 0.55 * R)
        put(t0, at_peak(snow[a:a + int(0.42 * R)], -18), 0, fade=0.003, fade_out=0.1)
    for t0, k, db in ((37.62, 3, -30), (38.12, 4, -28), (38.62, 5, -26)):   # 26 다가오는 발소리
        a = so2 + int(k * 0.55 * R)
        put(t0, filt(at_peak(snow[a:a + int(0.4 * R)], db), lo=150), 0, fade=0.003, fade_out=0.1)
    fl = load(f("Plastic Flashlight Switch.M.wav"))
    put(39.73, at_peak(fl[onset(fl):onset(fl) + int(0.2 * R)], -24), 0)   # 27 버릇처럼 켜는 손전등
    sw = load(s("InMotionAudio - USA Hotel", "MECHClik_USALightSwitch_On05_InMotionAudio_USAHotel.wav"))
    sw = sw[onset(sw):onset(sw) + int(0.35 * R)]
    put(40.10, filt(at_peak(sw, -16), lo=450), 0)   # 28 딸깍 — 센서등(긁는 소리가 사라진다). 맹검 2차 「크고 둔탁한 플라스틱」 → −4 dB · 낮은 쿵을 덜어냄
    put(40.98, at_peak(kil[onset(kil):onset(kil) + int(0.45 * R)], -19), 0, fade=0.002, fade_out=0.1)   # 열쇠가 한 번에
    put(41.55, at_peak(latch[lo_:lo_ + int(0.3 * R)], -15), 0)   # 철컥
    put(46.62, through_window(at_peak(latch[lo_:lo_ + int(0.25 * R)], -24))[:int(0.8 * R)], 0)   # 31 창 너머 문
    gl = load(f("Glass Down On wood.M.wav"))
    put(49.44, at_peak(gl[onset(gl):onset(gl) + int(0.3 * R)], -21), 0)   # 32 유리 전구를 집음
    put(49.58, at_peak(bag[int(1.5 * R):int(2.1 * R)], -24), 0, fade=0.01, fade_out=0.15)   # 비닐
    put(49.76, at_peak(bag[int(2.4 * R):int(3.0 * R)], -27), 0, fade=0.02, fade_out=0.15)   # 33 비닐
    scr = load(s("344 Audio - Climbing Gear Foley Vol. 1", "EQUISprt_Climbing Gear, Carabiner, Screwing Lock 01_344 Audio_Climbing Gear Foley Vol 1.wav"))
    so3 = onset(scr)
    put(49.98, filt(at_peak(scr[so3:so3 + int(0.55 * R)], -29), lo=600, hi=7000), 0, fade=0.01, fade_out=0.12)   # 33 전구를 돌려 끼움(쇠 나사산) — 맹검 2차 「끼우는데 스위치 소리」
    put(50.78, filt(at_peak(sw, -17), lo=450), 0)   # 스탠드 딸깍 — 34의 켜진 빛으로
    put(54.80, filt(at_peak(stair[so + int(1.2 * R):so + int(2.4 * R)], -24), hi=3500), 0, fade=0.01, fade_out=0.3)   # 35 503 문이 닫힘(멀리)

    # ---- 목소리 ----
    mom = voice("s1-목소리-엄마")
    mom = tighten(mom, [(2.05, 2.78)], keep=0.22)[int(1.62 * R):int(3.25 * R)]   # 「아들,」 뒤 0.75초 쉼 → 0.22초
    put(0.30, at_rms(phone(mom), -24), 0, fade=0.01, fade_out=0.08)
    mj = voice("s1-목소리-민재")
    put(1.90 - 0.08, at_rms(verb(mj[int(0.57 * R):int(1.62 * R)], 0.5, wet_db=-20, hi=5000), -21), 0, fade=0.01, fade_out=0.12)   # 「응, 들어왔어.」
    line2 = tighten(mj[int(3.75 * R):int(5.85 * R)], [(0.62, 1.42)], keep=0.25)   # 「응, 엄마.」 뒤 0.8초 쉼 → 0.25초
    put(46.50 - 0.08, at_rms(through_window(line2, hi=1700), -31.0), 0, fade=0.01, fade_out=0.3)   # 31 창 너머로 작게 — 이번엔 참말. 맹검 3차 「창에 바짝 붙어 지르는 것처럼」(−30, 1.1 kHz) → 4 · 5차 「곡에 묻혀 웅얼거림」(−32.5 · −31.5, 1 kHz) — 크기보다 거르기가 말소리를 지웠다 → 1.7 kHz · −31 · 그 아래 곡을 낮춤(곡편집)
    hr = voice("s1-목소리-하린")
    hseg = hr[int(1.40 * R):int(3.62 * R)].copy()
    hseg[:int(0.24 * R)] *= 10 ** (12 / 20)   # 판 1.48~1.56초 들숨(−60 dB)을 살린다 — 맹검 2차 「숨과 목소리가 만나는 데가 잘린 듯」
    put(52.97 - 0.24, at_rms(verb(hseg, 0.5, wet_db=-20, hi=6000), -20), 0, fade=0.06, fade_out=0.3)   # 고개를 돌려 입이 안 보일 때 — 말머리는 그대로 52.97초
    nar = C.load(os.path.join(SND, "내레이터_일레븐", NARRATOR + ".mp3"))
    # 「옆집까지,」 · 「늘 켜 둡니다.」 뒤 쉼만 줄인다 — 자르는 자리는 크기 곡선의 실제 무음(1.00~1.26 · 2.38~2.82초). 첫 판은 스크라이브 낱말 시각(2.30~3.00)으로 잘라
    # 「늘」 첫소리(2.82초) 40ms를 먹었고, 맹검 2 · 3차가 브랜드를 「늘켜」로 들었다
    gaps = [(0.86, 1.40), (2.38, 2.82)]
    keeps = [0.28, 0.22]
    for (a_, b_), k_ in sorted(zip(gaps, keeps), reverse=True):   # 뒤 쉼부터 줄여야 앞 쉼의 시각이 안 밀린다
        nar = tighten(nar, [(a_, b_)], keep=k_)
    o = onset(nar, -35)
    put(NARR_AT, at_rms(nar[o:], -18), 0, fade=0.005, fade_out=0.15)
    cut = lambda t: t - sum(max(0.0, (b - a) - k) for (a, b), k in zip(gaps, keeps) if b <= t + 1e-6)   # 판 시각 → 줄인 뒤 시각
    at = lambda t: round(NARR_AT + cut(t) - o / R, 3)
    TIMING.update({"lockup_at": round(T[35] + 0.22, 3), "name_at": at(2.82)})   # 끝 로고 판은 36이 열리고 0.22초 뒤 서서히(콘티 3절 「거리 그림 위에 서서히」)
    put(at(3.52) + 0.03, verb(at_peak(glock(), -19), 1.4, wet_db=-9, hi=6500), 0, fade=0.001, fade_out=0.4)   # 「켬」의 받침까지 끝난 뒤 글로켄 한 점 — 겹치면 받침 ㅁ이 묻힘(맹검 3차 「늘켜」)

    # ---- 곡 ----
    if os.path.exists(MUSIC):
        put(0, C.load_stereo(MUSIC) * 10 ** (MUSIC_DB / 20), 0, fade=0.002)   # 곡편집.py가 이미 짜임 · 낮춤을 넣었다 — 여기선 고정 크기만
    return m


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    tail = r.stderr.split("Summary:")[-1]
    i = float(tail.split("I:")[1].split("LUFS")[0])
    pk = float(tail.split("Peak:")[1].split("dBFS")[0])
    return i, pk


def finish(m, path, target=-14.0, ceiling=0.74):   # 0.79는 여섯째 판에서 음량마감이 +0.3 dB 올리며 봉우리 −1.0 dBFS로 막힘 → 0.74(−2.6 dBFS)
    # 봉우리를 1로 둔 합 → 목표 크기만큼 올리고 −2 dBFS 한계기(음량마감.mjs가 −14 LUFS · 최대 −1.2 dBFS를 보므로 거기서 더 올릴 게 없게)
    import wave
    raw = path + ".합.wav"
    peak = float(np.max(np.abs(m.a))) or 1.0
    with wave.open(raw, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(R)
        w.writeframes((m.a[:m.n] / peak * 0.5 * 32767).astype(np.int16).tobytes())
    gain = 0.0
    for _ in range(5):
        C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-af", f"volume={gain:.2f}dB,alimiter=limit={ceiling}:attack=3:release=80:level=false", "-ar", str(R), "-c:a", "pcm_s16le", path)
        i, pk = lufs(path)
        if abs(i - target) < 0.1:
            break
        gain += target - i
    print(f"소리 {i:.1f} LUFS · 봉우리 {pk:.1f} dBFS · 올림 {gain:.1f} dB")


def main():
    import json
    os.makedirs(SND, exist_ok=True)
    m = build()
    finish(m, os.path.join(ROOT, "소리.wav"))
    TIMING.update({
        "cut_f": [round(t * 24) for t in T],
        "lines": [
            {"a": 0.30, "b": 1.86, "s": "아들, 집엔 들어갔어?"},
            {"a": 1.88, "b": 3.40, "s": "응, 들어왔어"},
            {"a": 46.50, "b": 47.60, "s": "응, 엄마, 들어왔어"},
            {"a": 52.98, "b": 54.35, "s": "메리 크리스마스, 옆집", "keep": True, "dim": True},   # 크림 니트 위라 뒤를 더 어둡게(Fable 2차)
        ],
        "copy_at": 54.42, "copy_out": round(NARR_AT - 0.07, 3),
    })
    out = os.path.join(HERE, "..", "자막시안_20261103", "remotion", "src", "s1", "timing.json")
    json.dump(TIMING, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("시각", json.dumps({k: v for k, v in TIMING.items() if k != "cut_f"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
