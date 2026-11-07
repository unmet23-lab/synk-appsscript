# 4번 패션 필름 「결채」 소리(2026-11-07, Claude) — 최종편집.py 「소리」가 부른다. 02_콘티 3절 소리 설계와 원본 소리 곡선(0.25초 크기, 이 세션 실측)을 화면 시각에 맞춰 놓는다.
#   곡: 허깅페이스 stable-audio-3로 구운 연주곡(곡후보.py, D단조 · 86 BPM — 원본 타악도 0.348초 간격 = 86 BPM의 8분음표)
#     ① 통째_a를 0.76초 당겨(화면 = 곡 − 0.76) 이음 없이 0.25 ~ 26.28초 — 곡의 패드 앞머리(0~5.5초)가 원본의 조용한 시작, 곡 5.58초 첫 박이 화면 4.82초(원본 5.0초 「한 번 들림」),
#        곡 11.0초에 타악이 한 단 세지는 자리가 화면 10.24초(원본 타악이 본격으로 시작하는 자리)에 온다. 크기는 자국으로 원본 곡선에 맞춘다.
#     ② 앞_패드의 붐(곡 0.99초)을 화면 2.0초 타격에 — 붐 앞 0.5초 스웰이 원본 1.75~2.0초 부풂, 꼬리가 4초까지 잔향.
#     ③ 끝을 끝 화면 첫 장(26.28초)에 — 큰 타격 하나, 곡은 그 장에서 한꺼번에 멈추고 잔향만 29.5초까지(원본 65.0초).
#   효과음(원본 자리 그대로): 억새밭으로 넘어가는 바람 러시(8.5~9.2초) · 29 안감이 줄 블러로 넘어가는 회전 우시(21.56초), 6.75초 타격 · 10.75초 고조에 트레일러 붐(낮게).
#   폴리(우리가 더함 — 원본에 없음, 아주 작게): 억새 바람(17 · 18 · 21) · 트렌치 천 스침(13 · 24 · 30) · 흙길 부츠 한 걸음(27) · 흰 빛 번쩍마다 짧은 바람.
#   녹음 모음은 Fairlight · Sonniss GDC(상업 이용 가능, 10번 · 6번과 같은 자료실). 판이 낸 소리(드리미나가 붙임)는 쓰지 않는다 — 말 · 음악 없는 컷이다.
import os

import numpy as np
import scipy.signal as S

import 최종편집공통 as C

RATE = C.RATE
SONG = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p4/소리/곡_스테이블"
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = os.path.join(LIB, "fairlight", "Media Files")
SON = os.path.join(LIB, "sonniss_gdc2026", "풀림")
OFF = 0.76   # 통째_a를 당기는 몫 — 화면 t = 곡 t − OFF


# ---------- 거르개 · 크기(10번 최종소리.py와 같은 꼴)
def lp(x, hz, order=4):
    return S.sosfiltfilt(S.butter(order, hz, "low", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


def hp(x, hz, order=2):
    return S.sosfiltfilt(S.butter(order, hz, "high", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


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


def tame(x, over_db=9.0, release=0.06, look=0.002):
    """봉우리만 누른다(앞보기 리미터) — 조각 RMS보다 over_db 넘는 봉우리를 그 선으로(10번 11-07: 구운 곡 자체에 +0.8 dBFS 깨진 봉우리)"""
    from scipy.ndimage import minimum_filter1d
    a = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
    thr = 10 ** ((rms_db(x) + over_db) / 20)
    g = np.minimum(1.0, thr / (a + 1e-9))
    g = minimum_filter1d(g, size=max(1, int(look * RATE)) * 2 + 1)
    k = np.exp(-1.0 / (release * RATE))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * k
        out[i] = cur
    return (x * (out if x.ndim == 1 else out[:, None])).astype(np.float32)


def envelope(t, pts):
    return 10 ** (np.interp(t, [p[0] for p in pts], [p[1] for p in pts]) / 20)


def loop_to(x, seconds):
    n = int(seconds * RATE)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x] * int(np.ceil(n / len(x))), axis=0)[:n]


# 곡 크기 자국(화면 초, dB) — 원본 0.25초 크기 곡선: 0.25~1.5 −24~−35 → 2.0 타격 −13 → 3~5 −21~−29 → 5.0 −19 → 6.25 −11 · 6.75 −8
#   → 7.25~8.0 −17~−19 → 8.25부터 올라 10.75 −5(가장 큼) → 12~24 −15~−21 → 24.25~26.28 −12~−10
#   8.45~9.15는 바람 러시가 지나는 동안 곡을 비켜 준다(원본도 그 자리는 바람이 앞에 선다 — 곡이 그대로면 러시가 묻히거나 합의 봉우리가 됐다).
#   첫 판은 붐 꼬리 뒤(2.75~4.75)가 원본보다 9 dB 크고, 6.25~7.0 타격 · 8.25~11.0 고조가 7~8 dB 작았다(크기견줌, 11-07) — 두 번 맞춰 고조가 편에서 가장 크게
SONG_PTS = [(0.25, -4.0), (1.00, -3.0), (1.70, -3.0), (2.05, -12.0), (2.60, -14.0), (4.60, -13.0), (4.82, -6.0), (6.10, -6.0), (6.25, 9.0), (6.75, 10.0),
            (7.10, 8.0), (7.45, 3.0), (8.05, 3.0), (8.25, 5.0), (8.45, 0.5), (9.15, 1.5), (9.45, 9.0), (10.70, 13.0), (11.40, 12.0), (11.80, 6.0), (12.10, -1.0), (24.10, -1.0), (24.30, 4.0), (26.20, 7.0), (26.28, 7.0)]


CUT_NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "17a", "18", "19", "20",
             "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "끝"]   # 최종편집.py NAMES와 같은 차례


def at(TF, cut):
    """컷 이름의 화면 시작 초"""
    return TF[CUT_NAMES.index(cut)]


def build(out_wav, TF):
    total = TF[-1]
    m = C.Mix(total + 0.5)
    END = at(TF, "끝")   # 끝 화면 첫 장(26.28초)

    # ===== 곡 ①: 통째_a — 0.25 ~ 26.28초, 끝 장에서 칼같이 멈춘다(끝 타격이 덮는다)
    s1 = C.load_stereo(os.path.join(SONG, "통째_a.wav"))
    a0 = at(TF, "2")
    body = s1[int((a0 + OFF) * RATE):int((END + OFF) * RATE)].copy()
    t1 = a0 + np.arange(len(body)) / RATE
    body = body * envelope(t1, SONG_PTS)[:, None].astype(np.float32)
    body = fades(tame(body, 11.0), 0.35, 0.006)
    m.put(a0, to_rms(body, -21.0), 0, fade=0.0)

    # ===== 곡 ②: 앞_패드의 붐(곡 0.99초) → 화면 2.0초, 스웰은 1.5초부터
    p = C.load_stereo(os.path.join(SONG, "앞_패드.wav"))
    hit = 0.99
    b0 = 0.45
    boom = p[int(b0 * RATE):int(4.6 * RATE)].copy()   # 꼬리를 화면 5.6초에서 거둔다(원본은 4초까지 잔향, 첫 판은 6초 넘게 남아 2.75~4.75가 컸다)
    tb0 = np.arange(len(boom)) / RATE
    boom = boom * envelope(tb0, [(0.0, 0.0), (hit - b0 + 0.25, 0.0), (hit - b0 + 1.2, -7.0), (hit - b0 + 2.6, -16.0), (len(boom) / RATE, -30.0)])[:, None].astype(np.float32)
    boom = fades(tame(boom, 10.0), 0.30, 0.4)
    m.put(2.0 - (hit - b0), to_rms(boom, -21.0), 0, fade=0.0)

    # ===== 곡 ③: 끝 타격 — 끝 화면 첫 장, 잔향은 29.5초까지(마지막 0.5초 화면과 함께 잦아듦)
    e = C.load_stereo(os.path.join(SONG, "끝.wav"))
    tail = e[:int((total - END) * RATE)].copy()
    tt = np.arange(len(tail)) / RATE
    # 원본 끝 화면: 65.0 타격 −5 → 66.0 −15 → 67.0 −25 → 68.0 −32 → 무음(첫 판은 잔향이 28초까지 −10 안팎으로 남았다)
    tail = tail * envelope(tt, [(0.0, 0.0), (0.5, -3.0), (1.0, -9.0), (1.5, -14.0), (2.0, -19.0), (2.5, -24.0), (3.0, -30.0), (total - END, -60.0)])[:, None].astype(np.float32)
    m.put(END - 0.004, to_rms(fades(tame(tail, 10.0), 0.004, 0.05), -19.0), 0, fade=0.0)

    # ===== 트레일러 붐(낮게) — 6.75초 타격(스튜디오 번쩍 셋 위) · 10.75초 고조
    tb = seg(os.path.join(SON, "Federico Soler - Effective Trailer Booms Vol. 2", "EffectiveTrailer_Booms_Vol2_075.wav"), 0.15, 3.0, True)
    hit2 = 0.15   # 파일 0.3초가 어택 — 자른 조각 안 0.15초
    m.put(6.75 - hit2, to_rms(fades(tame(lp(tb, 2500), 10.0), 0.01, 0.9)[:int(1.2 * RATE)], -19.0), 0, fade=0.0, fade_out=0.35)
    m.put(10.75 - hit2, to_rms(fades(tame(lp(tb, 2500), 6.0), 0.01, 1.2), -23.0), 0, fade=0.0)   # 봉우리 6 dB — 10 dB면 마감에서 −1.1 dBFS로 문턱을 넘었다

    # ===== 효과음
    # 억새밭으로 넘어가는 바람 러시 — 8.5초쯤 시작해 8.68초 컷을 넘어 9.2초까지 강한 바람 꼬리(원본 9.0~9.25초가 더 큼)
    rush = seg(os.path.join(SON, "344 Audio - Elemental Palette Designed Vol. 1", "WINDDsgn_Wind, Rush, Whoosh, Long x5 01_344 Audio_Elemental Palette Designed Vol 1.wav"), 0.0, 1.0, True)
    m.put(8.40, to_rms(tame(fades(rush, 0.12, 0.35), 4.0), -18.0), 0, fade=0.0)   # −22도 곡 고조(+9 dB)보다 7~10 dB 아래라 두 번째 맹검도 「바람 소리 못 들음」   # −27은 곡 고조에 묻혔다(Gemini Lite 두 귀 모두 「효과음이 따로 안 들림」)
    # 29 안감 → 30: 짧은 회전 우시(21.56초 컷 앞에서 일어나 넘어감)
    tw = seg(os.path.join(FAIR, "Whooshes Quick Succession, Twirling Fast.M.wav"), 0.85, 1.45)
    m.put(at(TF, "29") - 0.30, to_rms(fades(hp(tw, 250), 0.03, 0.2), -20.0), 0, fade=0.0)
    # 흰 빛 번쩍마다 짧은 바람(10 · 17a · 31)
    lw = seg(os.path.join(FAIR, "Low Whoosh x2.wav"), 0.08, 0.40)
    for cut in ("10", "17a", "31"):
        m.put(at(TF, cut) - 0.10, to_rms(fades(lw, 0.02, 0.12), -28.0), 0, fade=0.0)

    # 폴리 — 억새 바람(17 · 18 · 21) — 바람에 쓸리는 소리, 아주 작게
    grass = seg(os.path.join(FAIR, "Grass Moving With The Win.M.wav"), 2.0, 12.0)
    g1 = loop_to(grass, at(TF, "19") - at(TF, "17") + 0.3)
    m.put(at(TF, "17"), to_rms(fades(g1, 0.08, 0.25), -38.0), 0, fade=0.0)
    g2 = grass[int(4.0 * RATE):int((4.0 + at(TF, "22") - at(TF, "21") + 0.25) * RATE)]
    m.put(at(TF, "21"), to_rms(fades(g2, 0.06, 0.2), -39.0), 0, fade=0.0)
    # 트렌치 천 스침(13 팔짱 · 24 허리에 손 · 30 팔을 흔듦)
    cloth = seg(os.path.join(FAIR, "Cloth Movement.M.wav"), 0.0, 9.0)
    for cut, (a, b), late in (("13", (0.0, 0.35), 0.0), ("24", (3.95, 4.50), 0.12), ("30", (4.70, 5.40), 0.12)):
        c = fades(hp(cloth[int(a * RATE):int(b * RATE)], 200), 0.01, 0.12)
        m.put(at(TF, cut) + late, to_rms(c, -39.0), 0, fade=0.0)
    # 흙길 부츠 한 걸음(27 — 판 57장 = 컷 1.0초에 앞발이 딛는다)
    st = seg(os.path.join(FAIR, "Boots On Rough Dirt Footsteps.M.wav"), 2.34, 2.80)
    m.put(at(TF, "27") + 1.00 - 0.06, to_rms(fades(st, 0.004, 0.15), -33.0), 0, fade=0.0)

    m.finish(out_wav, boost_db=1.5)   # 마감이 소리를 올려야 하면(−15.2 LUFS → +1.2 dB) AAC 뒤 봉우리가 −1.1 dBFS로 문턱을 넘었다 — 합을 1.5 dB 크게 넘겨 마감이 내리기만 하게
    print("소리", out_wav)
