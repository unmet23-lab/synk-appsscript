# 10번 도담중공업 소리(2026-11-07, Claude) — 최종편집.py 「소리」가 부른다. 02_콘티 5절 소리 설계와 원본 소리 곡선(원본_소리.json)을 받은 판 · 화면 시각에 맞춰 놓는다.
#   곡: 허깅페이스 stable-audio-3로 구운 연주곡(곡후보.py) 둘 — ① 통째_b(기타 독주가 24.5초부터 악기를 더해 37초에 가장 커짐)를 0.10초부터 46.26초까지 이음 없이,
#       36.45~37.05초만 크기를 내려 원본의 「숨 → 37.2초 가장 크게 차오름」을 만든다 ② 끝2(0.1초 베이스 한 음 → 잔잔 → 13.0초 마지막 화음)를 49.75초에 놓고,
#       3.05초 뒤를 한 번 건너뛰어(7.55초로 — 크로마 닮음 0.995, 0.12초 겹침) 마지막 화음이 로고가 떠오르는 58.25초에 온다. 46.26~48.90초는 모든 소리가 끊긴다(원본 −47~−51 dB).
#   내레이션: 준호 — 시댄스 판 셋이 낸 목소리(허깅페이스 BS-RoFormer · Demucs로 뗌). Gemini 3.6 Flash 맹검으로 받은 판 셋 가운데 고름(02_콘티 12절).
#       쉼은 문장 사이만 줄였고 낱말 안은 자르지 않았다(현장노트 「쉼을 0.25초 아래로 줄이지 않는다」).
#   효과음: 다시 낸 판이 화면과 함께 낸 소리(19d 공회전 · 에어브레이크, 11m 라쳇, 12b 발소리, 24b 시험동 웅) + 녹음 모음(Fairlight · Sonniss — 상업 이용 가능)
#       + 여기서 짠 소리(방 공기 · 터빈 돌기 시작 · 바람). MMAudio는 가중치가 비상업이라 쓰지 않는다.
import os

import numpy as np
import scipy.signal as S

import 최종편집공통 as C

RATE = C.RATE
SONG = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10/소리/곡_스테이블"
VOX = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10/소리/목소리"
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = os.path.join(LIB, "fairlight", "Media Files")
SON = os.path.join(LIB, "sonniss_gdc2026", "풀림")
rng = np.random.default_rng(10)

SILENCE = (46.26, 48.90)   # 원본처럼 터빈 소리까지 모두 끊기는 정적


# ---------- 거르개 · 크기(6번 최종소리.py와 같은 꼴)
def lp(x, hz, order=4):
    return S.sosfiltfilt(S.butter(order, hz, "low", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def hp(x, hz, order=2):
    return S.sosfiltfilt(S.butter(order, hz, "high", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def bp(x, lo, hi, order=2):
    return S.sosfiltfilt(S.butter(order, [lo, hi], "band", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def rms_db(x):
    m = x if x.ndim == 1 else x.mean(axis=1)
    n = int(0.05 * RATE)
    e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, max(1, len(m) - n), n)])
    db = 20 * np.log10(e + 1e-12)
    live = e[db > db.max() - 30]
    return float(20 * np.log10(np.sqrt(np.mean(live ** 2)) + 1e-12))


def to_rms(x, target_db):
    g = target_db - rms_db(x)
    if g > 45:
        raise SystemExit(f"to_rms: {g:.0f} dB를 키워야 한다 — 조각이 거의 무음이다(자리 · 파일 확인)")
    return (x * 10 ** (g / 20)).astype(np.float32)


def seg(path, a, b, stereo=False):
    x = C.load_stereo(path) if stereo else C.load(path)
    return x[int(a * RATE):int(b * RATE)].copy()


def fades(x, fin=0.01, fout=0.01):
    x = x.copy()
    n, m = int(fin * RATE), int(fout * RATE)
    w = (lambda k: np.linspace(0, 1, k)[:, None]) if x.ndim == 2 else (lambda k: np.linspace(0, 1, k))
    if n:
        x[:n] *= w(n)
    if m:
        x[-m:] *= w(m)[::-1]
    return x


def pink(seconds, seed=0):
    r = np.random.default_rng(seed)
    w = r.standard_normal(int(seconds * RATE))
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return S.lfilter(b, a, w).astype(np.float32)


def loop_to(x, seconds):
    n = int(seconds * RATE)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x] * int(np.ceil(n / len(x))), axis=0)[:n]


def tame(x, over_db=9.0, release=0.06, look=0.002):
    """봉우리만 누른다(앞보기 리미터) — 조각 RMS보다 over_db 넘는 봉우리를 그 선으로. 말머리 파열음 · 딸깍이 한 판 마감의 봉우리를 정했다(11-07 첫 판 +0.8 dBFS)"""
    from scipy.ndimage import minimum_filter1d
    a = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
    thr = 10 ** ((rms_db(x) + over_db) / 20)
    g = np.minimum(1.0, thr / (a + 1e-9))
    g = minimum_filter1d(g, size=max(1, int(look * RATE)) * 2 + 1)
    k = np.exp(-1.0 / (release * RATE))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):   # 내려갈 때는 바로, 올라갈 때는 release로 천천히
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * k
        out[i] = cur
    return (x * (out if x.ndim == 1 else out[:, None])).astype(np.float32)


def envelope(t, pts):
    """(초, dB) 자국 사이를 직선으로 — t는 배열"""
    return 10 ** (np.interp(t, [p[0] for p in pts], [p[1] for p in pts]) / 20)


# ---------- 짠 소리
def room(seconds, seed, lp_hz=1200.0):
    # 큰 공장 안 공기 — 분홍 잡음을 낮게 거른다(디지털 무음 대신)
    return lp(hp(pink(seconds, seed), 50), lp_hz)


def turbine_spool(seconds):
    """터빈이 돌기 시작한다 — 낮은 웅(축 회전)이 올라가고, 날개 지나감 소리(축의 24배)와 공기 흐름이 뒤따른다. 끝은 46.26초에 칼같이 끊긴다."""
    n = int(seconds * RATE)
    t = np.arange(n) / RATE
    k = np.clip(t / seconds, 0, 1)
    f0 = 22 + 70 * k ** 1.6                                   # 축 회전 22 → 92 Hz
    ph = 2 * np.pi * np.cumsum(f0) / RATE
    hum = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * (0.25 + 0.75 * k)
    whine = (np.sin(24 * ph) * 0.18 + np.sin(48 * ph) * 0.05) * np.clip((k - 0.25) / 0.75, 0, 1) ** 1.5
    air = bp(pink(seconds, 77), 250, 3500) * (0.1 + 0.9 * k ** 1.3)
    air = air / (np.std(air) + 1e-9) * 0.35
    rumble = lp(pink(seconds, 78), 140)
    rumble = rumble / (np.std(rumble) + 1e-9) * 0.5 * (0.3 + 0.7 * k)
    x = hum * 0.6 + whine + air + rumble
    return (x * np.minimum(1, t / 0.6)).astype(np.float32)


def air_brake(d=0.55, seed=5):
    # 에어브레이크 「치익」 — 높은 띠 잡음, 빠른 시작 · 줄어듦
    n = int(d * RATE)
    t = np.arange(n) / RATE
    x = bp(np.random.default_rng(seed).standard_normal(n).astype(np.float32), 1800, 9000)
    return (x * np.minimum(1, t / 0.008) * np.exp(-t / 0.22)).astype(np.float32)


# ---------- 놓기
class Mix(C.Mix):
    pass


def voice(name, a, b):
    """뗀 목소리 a~b초(판 시각) — 해설은 마른 소리 그대로, 80 Hz 아래만 깎는다"""
    x = fades(seg(os.path.join(VOX, name + "_목소리.wav"), a, b), 0.01, 0.06)
    return tame(hp(x, 80), 6.0)


def build(out_wav, TF):
    total = TF[-1]
    m = Mix(total + 0.5)

    # ===== 곡 ①: 통째_b — 0.10초부터 46.26초까지(곡 시각 = 화면 − 0.10)
    s1 = C.load_stereo(os.path.join(SONG, "통째_b.wav"))
    a0 = 0.10
    seg1 = s1[:int((SILENCE[0] - a0) * RATE)].copy()
    t1 = a0 + np.arange(len(seg1)) / RATE
    # 크기 자국은 원본 소리 곡선(0.25초)에 맞춘다 — 첫 판은 곡이 스스로 28~36초에 커져 37.17초 차오름이 그 앞보다 작았다(원본은 37.2초가 편에서 가장 큼)
    g1 = envelope(t1, [(0.0, 4.0), (23.5, 4.0), (26.5, 1.5), (30.0, -2.5), (36.25, -2.5), (36.45, -12.0), (37.05, -12.0), (37.17, 3.0), (39.95, 3.0),
                       (40.10, -9.5), (44.25, -9.5), (44.55, 1.0), (SILENCE[0], 1.0)])   # 숨(36.45~37.05) · 차오름 · 내레이션 아래(40.1~44.3, 목소리가 나머지보다 +8 dB 넘게 — 첫 판 +4.7)
    seg1 = seg1 * g1[:, None].astype(np.float32)
    seg1 = fades(tame(seg1, 11.0), 0.25, 0.012)   # 곡 30.9초에 +0.8 dBFS로 깨진 봉우리(구운 곡 자체)가 있다
    m.put(a0, to_rms(seg1, -23.0), 0, fade=0.0)

    # ===== 곡 ②: 끝2 — 49.75초(곡 0.1초 베이스 한 음 = 49.85초), 곡 3.05초 뒤를 7.55초로 건너뜀 → 마지막 화음(곡 13.0초) = 58.25초(로고 표식과 함께)
    #   이음은 앞 0.5초 · 뒤 0.5초 크로마 닮음 0.995 · 크기 −19.7 / −18.4 dB인 자리 — 첫 판의 3.11 → 7.91초는 닮음 0.41(화음이 튐)이었다
    s2 = C.load_stereo(os.path.join(SONG, "끝2.wav"))
    b0, cutA, cutB, xf = 49.75, 3.05, 7.55, 0.12
    A = fades(s2[:int((cutA + xf / 2) * RATE)].copy(), 0.004, xf)
    B = fades(s2[int((cutB - xf / 2) * RATE):].copy(), xf, 0.004)
    tail_end = total - (b0 + cutA)
    B = B[:int((tail_end + xf / 2) * RATE)]
    tA = b0 + np.arange(len(A)) / RATE
    tB = b0 + cutA - xf / 2 + np.arange(len(B)) / RATE
    # 원본 곡선: 50.0 낮은 음(조용) → 52.35 다시 차오름 → 55.0~55.98 가장 조용한 숨 → 56.0 복귀 → 58.6 맺음. 끝2 자체의 크기는 이와 달라(55초 무렵이 큼) 자국으로 맞춘다
    pts2 = [(49.0, 0.0), (50.40, 0.0), (50.55, -4.0), (51.80, -4.0), (52.25, 3.0), (54.85, 3.0), (55.05, -8.0), (55.95, -8.0), (56.06, -6.0),
            (58.18, -6.0), (58.27, 2.0), (59.45, 0.5), (total - 0.40, -7.0), (total, -40.0)]   # 끝 줄(56.15~58.13) 아래는 −6, 화음과 로고가 함께 피고 끝 0.4초에 잦아듦
    A = A * envelope(tA, pts2)[:, None].astype(np.float32)
    B = B * envelope(tB, pts2)[:, None].astype(np.float32)
    lvl = rms_db(s2[:int(13.5 * RATE)])
    k2 = 10 ** ((-24.0 - lvl) / 20)
    m.put(b0, tame((A * k2).astype(np.float32), 11.0), 0, fade=0.0)
    m.put(b0 + cutA - xf / 2, tame((B * k2).astype(np.float32), 11.0), 0, fade=0.0)

    # ===== 내레이션(준호)
    n1a = voice("p10-말-준호-1", 0.44, 1.86)   # 한 대를 만드는 데 삼 년.
    n1b = voice("p10-말-준호-1", 3.38, 5.30)   # 볼트 하나도 그냥 넘어가지 않았습니다.
    m.put(40.14 - 0.06, to_rms(n1a, -20.0), 0, fade=0.004)
    m.put(42.55 - 0.07, to_rms(n1b, -20.0), 0, fade=0.004)
    n2a = voice("p10-말-준호-2", 0.64, 1.50)   # 오늘은,
    n2b = voice("p10-말-준호-2", 3.72, 4.90)   # 이 아이를 보냅니다.
    m.put(48.90 - 0.08, to_rms(n2a, -20.5), 0, fade=0.004)
    m.put(50.50 - 0.08, to_rms(n2b, -20.5), 0, fade=0.004)
    n3a = voice("p10-말-준호-3", 0.72, 1.52)   # 어디서든,
    n3b = voice("p10-말-준호-3", 2.42, 3.55)   # 잘 돌아갑니다.
    m.put(56.15 - 0.08, to_rms(n3a, -20.5), 0, fade=0.004)
    m.put(57.25 - 0.08, to_rms(n3b, -20.5), 0, fade=0.004)

    # ===== 바탕 소리 — 컷마다(컷 뒤 0.06초 꼬리)
    def bed(a, b, x, level, pre=0.0, post=0.06):
        x = loop_to(x, b - a + pre + post + 0.01)
        x = fades(to_rms(x, level), max(0.03, pre), post)
        m.put(a - pre, x, 0, fade=0.002)

    # 실내(0~25.5초) — 공장 안 공기, 아주 낮게
    bed(0.0, TF[18], room(TF[18] + 0.2, 1, 900), -50)
    # 19 바깥 마당 — 판이 낸 공회전 · 4.75초 에어브레이크(화면과 같은 판)
    eng = C.load_stereo(C.clip("p10-19d"))[:int((TF[19] - TF[18] + 0.05) * RATE)]
    m.put(TF[18], to_rms(tame(fades(lp(eng, 7000), 0.25, 0.08), 10.0), -30), 0, fade=0.0)
    # 20 운전석 — 차 안 웅(길 소음 낮춤)
    cab = lp(seg(os.path.join(SON, "InMotionAudio - Car Interior Driving Ambience", "VEHCar_TownDrivingAmbience06_InMotionAudio_CarInteriorDrivingAmbience.wav"), 8, 12, True), 900)
    bed(TF[19], TF[20], tame(cab, 8.0), -33, pre=0.05)
    # 21 창밖 거울 — 바람
    wind_all = seg(os.path.join(SON, "InMotionAudio - Chimney Wind", "WINDInt_ChimneyWind05_InMotionAudio_ChimneyWind.wav"), 0, 110, True)
    W_ = lambda a, b, hz: lp(wind_all[int(a * RATE):int(b * RATE)], hz)   # 바람 녹음(115초)의 구간마다 다른 결
    bed(TF[20], TF[21], W_(30, 40, 2500), -36)
    # 22~23 한낮 바깥 — 낮은 바람
    bed(TF[21], TF[23], W_(40, 50, 1200), -44)
    # 24~28 시험동 · 관제실 — 판이 낸 시험동 웅(24b)을 늘여 깜
    hum = lp(C.load_stereo(C.clip("p10-24b")), 900)
    bed(TF[22], SILENCE[0], hum, -42, pre=0.0, post=0.0)
    # 정적(46.26~48.90) — 거의 무음의 방 공기만(디지털 무음 대신, 원본 −47~−51 dB)
    m.put(SILENCE[0], fades(to_rms(room(SILENCE[1] - SILENCE[0] + 1.6, 9, 700), -62), 0.02, 0.6), 0, fade=0.0)
    # 33 노을 터빈동 · 34~37 바깥 해 질 녘 — 낮은 바람, 37은 높은 데 바람과 먼 도시
    bed(TF[32], TF[33], W_(60, 66, 1400), -46, pre=0.3)
    bed(TF[33], TF[36], W_(70, 78, 1800), -44)
    city = lp(seg(os.path.join(FAIR, "Ext City Ambience, Car Drive-Bys, Pedestrian, Air.wav"), 20, 26, True), 1500)
    bed(TF[36], total - 0.5, (W_(85, 91, 2200)[:len(city)] * 0.8 + city * 0.6).astype(np.float32), -42, pre=0.1, post=0.5)

    # ===== 사건 소리(화면 장에 맞춤) — 곡보다 9 dB 넘게 아래로 묻힌 것(종이 · 첫 렌치 · 라쳇 · 크레인 · 트럭 · 운전석)은 3~4 dB 올렸다(11-07 효과음 대 곡 실측)
    # 2 도면 — 종이 스침
    paper = seg(os.path.join(FAIR, "Paper Handle Airline Tickets.M.wav"), 0.6, 1.4)
    m.put(TF[1] + 0.10, to_rms(lp(paper, 7000), -41), 0, fade=0.01, fade_out=0.25)
    # 3 바닥 불꽃 — 튀는 소리(컷 0.1초 앞에서)
    spark = seg(os.path.join(FAIR, "Sparklers Whoosh Popping.M.wav"), 6.0, 6.8)
    m.put(TF[2] - 0.10, to_rms(tame(hp(spark, 900), 9.0), -34), 0, fade=0.03, fade_out=0.15)
    # 4 용접 아크가 켜짐(판 19장 = 컷 4장 → 화면 TF[3] + 4/24)
    arc = seg(os.path.join(SON, "InMotionAudio - Arc", "ELECArc_ArcDesign15_InMotionAudio_Arc.wav"), 0.0, 1.04)
    t_arc = TF[3] + 4 / 24
    m.put(t_arc - 0.02, to_rms(tame(arc, 10.0), -29), 0, fade=0.003, fade_out=0.3)
    # 5~6 용접 — 지지는 소리(낮게, 컷 7 앞에서 풀림)
    buzz = bp(seg(os.path.join(SON, "InMotionAudio - Arc", "ELECBuzz_Buzz27_InMotionAudio_Arc.wav"), 1.0, 4.0), 300, 6000)
    sizzle = hp(seg(os.path.join(FAIR, "Sparklers Sizzle Stamp.M.wav"), 3.0, 6.0), 1500)
    weld = (to_rms(buzz, -40) + to_rms(sizzle, -38)).astype(np.float32)
    m.put(TF[4], fades(weld[:int((TF[6] - TF[4] + 0.05) * RATE)], 0.05, 0.3), 0, fade=0.0)
    # 7 렌치 — 작게 두 번
    bolt = seg(os.path.join(FAIR, "Metal Bolts.M.wav"), 0.0, 1.2)
    m.put(TF[6] + 0.55, to_rms(bolt[:int(0.45 * RATE)], -37), 0, fade=0.003, fade_out=0.1)
    m.put(TF[6] + 1.35, to_rms(bolt[int(0.5 * RATE):], -42), 0, fade=0.003, fade_out=0.1)
    # 10 조립동 와이드 — 천장 크레인 모터(멀리)
    crane = lp(seg(os.path.join(SON, "Victor Ermakov - Industrial Ambiences - Ship Repair Factory", "MACHInd_Crane Onboard Ride Squeaks Motors_CW.wav"), 20, 23, True), 1500)
    bed(TF[9], TF[10], crane, -38, pre=0.1)
    # 11 라쳇 — 판이 낸 딸깍(11m)
    rat = C.load_stereo(C.clip("p10-11m"))[:int((TF[11] - TF[10] + 0.05) * RATE)]
    m.put(TF[10], to_rms(fades(hp(rat, 400), 0.02, 0.08), -35), 0, fade=0.0)
    # 12 날개 든 작업자 — 판이 낸 발소리(12b)
    steps = C.load_stereo(C.clip("p10-12b"))[:int((TF[12] - TF[11] + 0.05) * RATE)]
    m.put(TF[11], to_rms(fades(lp(steps, 6000), 0.02, 0.08), -38), 0, fade=0.0)
    # 14 이음매 볼트
    m.put(TF[13] + 0.62, to_rms(bolt[int(0.5 * RATE):], -41), 0, fade=0.003, fade_out=0.1)
    # 22 시험대 틀 — 사슬
    chain = seg(os.path.join(FAIR, "Metal Chains Movement.M.wav"), 1.0, 2.2)
    m.put(TF[21] + 0.15, to_rms(lp(chain, 6000), -40), 0, fade=0.02, fade_out=0.3)
    # 26 관제실 레버(손이 미는 자리)
    click = seg(os.path.join(SON, "Epic Stock Media - HD Lock And Mechanism Sound Design Kit", "MECHLtch_Click Deep Mechanism Latch Button Nearfield Thunk 02_ESM_HDLM.wav"), 0.0, 0.378)
    m.put(TF[25] + 0.55, to_rms(tame(click, 10.0), -31), 0, fade=0.002, fade_out=0.05)
    # 27~28 터빈이 돌기 시작 → 46.26초에 칼같이 끊김
    t0 = TF[26] + 0.05
    spool = turbine_spool(SILENCE[0] - t0)
    m.put(t0, fades(to_rms(spool, -35), 0.4, 0.008), 0, fade=0.0)
    # 34 걸어 나오는 세 사람 — 발소리
    fs = seg(os.path.join(FAIR, "BG Footsteps Concrete.wav"), 10.0, 11.6)
    m.put(TF[33] + 0.05, to_rms(lp(fs, 6000), -42), 0, fade=0.05, fade_out=0.2)

    m.finish(out_wav, boost_db=0.0)
    print("소리", out_wav)
