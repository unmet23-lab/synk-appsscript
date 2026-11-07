# 오미톡 15초 「치익이 톡이 될 때까지」(치익톡 2판) 최종 편집(2026-11-07, Claude) — 01_새판_기획 7 · 9 · 10절. 받은 시댄스 2.5 판을 프레임 번호로 잘라 하드컷으로 잇고,
# 라벨이 보이는 두 컷에 실제 라벨을 다시 얹고(라벨다시얹기.py), 소리를 새로 놓고, 끝에 1번 오미톡의 그린 「톡」 마크를 얹는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/om2/오미톡15_9x16.mp4 · _폰.mp4 · _반초.jpg
# 후보정 없음(결정 10-24): 색 · 속도 · 얼굴 손질 없이 프레임 번호로만 자른다. 라벨 화소는 AI가 그리지 않은 원본(리허설 블렌더 캔 렌더)을 얹는 것이라 후보정이 아니다.
# 1번 오미톡(제품 히어로 · 얼굴 없음, 결정 11-05 「이 길로 확정」)과는 다른 편이다 — 같은 가상 브랜드의 모델 · 이야기 광고(리허설 손님 주문: 저녁 야외 농구장 · 한결).
import os
import subprocess
import sys

import cv2
import numpy as np
import scipy.signal as SG

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import 최종편집공통 as C   # noqa: E402
import 라벨다시얹기 as L    # noqa: E402

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = ROOT + "/최종/om2"
SND = OUT + "/소리"
REH = "C:/Users/q1212/Documents/synk-vendor/pulse-rehearsal-20261029/새판"
LIB = "C:/Users/q1212/Documents/synk-vendor/sound-library"
FAIR = LIB + "/fairlight/Media Files/"
SON = LIB + "/sonniss_gdc2026/풀림/"
FPS, W, H = 24, 1080, 1920
RATE = C.RATE

# ---------- 화면 — (컷, 판, 처음 장, 장수, 라벨 다시 얹기(시작 그림, 캔 찾을 칸 — 시작 그림 화소) 또는 None)
# 받은 판 점검(기획 10절): 띠 · 카메라 실측 · 색(Lab) · 얼굴 닮음 · 받아쓰기.
CUTS = [
    # 1 땀 왕관 — 첫 장이 이미 튄 왕관, 0.6초에 무너지고 김이 오른다(고정 매크로, 카메라 0.0%). 1.4초
    (1, "om2-1", 0, 34, None),
    # 2 친구 폰 시점 헐떡 — 다가감이 지시(0.3~1.0초)보다 늦게 2.5~4.0초에 1.73배로 오고 「아… 목 타 죽겠다」도 2.58~3.88초라, 그 구간을 쓴다:
    #   위에서 대자로 누운 그를 0.1초 보이자마자 폰이 얼굴로 내려가며 말하고, 땀 젖은 얼굴 클로즈업에서 숨으로 끝난다(유호님 10-30 「더 클로즈해서 갈증을」)
    (2, "om2-2", 58, 42, None),
    # 3 친구 손이 캔을 놓음 — 받은 om2-3은 대낮(파란 하늘, b* +3.9)이라 노을 컷 사이에서 시간이 되돌아가 빛만 노을로 고친 시작 그림으로 다시 냄(다시_1107_꾸러미.py om2-3b).
    #   om2-3b는 라벨 합성의 깨끗한 판이 캔 뚜껑 위에 남긴 주황 번짐을 모델이 「불꽃 같은 김」으로 키웠다(맥락 없는 볼 이유 심사 opus · GPT 시험관 「차가운 건지 뜨거운 건지」)
    #   → 번짐 자리만 고친 시작 그림으로 om2-3c. __2: 손이 1.25초에 화면 밖, 눈이 캔으로 커짐, 캔은 0.4px 안에서 멈춤(라벨은 잰 값의 중앙값 한 자리)
    (3, "om2-3c__2", 0, 36, (REH + "/본판_1107/om2-3c_라벨.png", (0, 1050, 460, 1850), True)),
    # 4 캔이 들린 자리의 젖은 고리가 김으로 — 0.8초(화면 밖에서 캔 따는 「치익」 · 꿀꺽)
    (4, "om2-4", 0, 20, None),
    # 5 한 방울에 코트가 식어 번짐 — 김이 1.95초까지, 식는 고리가 2.17~3.83초에 번지고 4.3초에 푸른 저녁 · 코트 조명(바우처 첫 프레임 판).
    #   Fable 맹검 「멈춘 왕관 3.25초(편의 22%) … 1.5~2초로」 — 1.0초 → 1.5초부터 써서 멈춘 왕관이 보이는 시간을 2.83초로(판은 왕관이 끝까지 멈춰 있어 더는 못 줄임)
    #   → Fable 2차 「덜 풀림」 · 유호님 「다시 내기」로 고리가 화면 끝에 닿으면 왕관이 풀려 떨어지는 om2-5e(OM2_5 · OM2_5_FROM, 시각은 아래 C5_TIMES)
    #   om2-5e 두 벌 중 __2: 김 ~1.9초 · 고리 1.25~2.9초 · 조명 ~2.2초 · 3.25초에 왕관이 풀려 4.0초에 물결(첫 벌은 끝이 물거울처럼 매끈해짐). 1.0~4.08초
    (5, os.environ.get("OM2_5", "om2-5e__2"), int(os.environ.get("OM2_5_FROM", "24")), 74, None),
    # 6 식은 코트에 누움 — 받은 om2-6은 밝은 중간 톤(L 37 · b* +4.2) → 빛만 푸른 저녁으로 고친 om2-6b → 그 판의 가슴 위 무지 캔이 「다른 제품으로 읽힌다」(Fable 맹검)
    #   → 캔을 뺀 om2-6c(손이 가슴에). 쓰는 구간은 「하아」 숨이 컷 앞쪽에 오게 고른다(OM2_6 · OM2_6_FROM)
    (6, os.environ.get("OM2_6", "om2-6c"), int(os.environ.get("OM2_6_FROM", "36")), 42, None),
    # 7 끝 — Fable 맹검 「끝 3초가 편에서 가장 조용한 그림 · 레퍼런스 셋은 마지막 칸이 브랜드가 제일 큰 칸 · 검붉은 웅덩이」 → 캔을 화면 가운데에 크게 다시 짠 시작 그림
    #   (리허설 렌더 라벨) · 왕관은 왼쪽 앞에서 스며 자국 없이 사라지고 카메라가 캔으로 다가가는 om2-7c. 옛 판 om2-7__2(캔이 오른쪽 끝, 6초에 13.5% 다가감, 검붉은 자국)는 안 씀
    (7, os.environ.get("OM2_7", "om2-7c"), 0, 112, (REH + "/본판_1107/om2-7c_라벨.png", (250, 300, 950, 1400))),   # 5번이 6장 늘어 118 → 112(15.00초 지킴)
]
F = [0]
for c in CUTS:
    F.append(F[-1] + c[3])
T = [f / FPS for f in F]   # 컷 경계(초)
TOTAL = T[-1]


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n, pid, a, k, lab in CUTS:
        src = C.clip(pid)
        if not os.path.exists(src):
            raise SystemExit(f"판이 없다: {src}")
        out = os.path.join(d, f"{n:02d}.mp4")
        if lab:
            tmp = os.path.join(d, f"{n:02d}_라벨720.mp4")
            L.overlay(src, lab[0], lab[1], a, k, tmp, fixed=len(lab) > 2 and lab[2])
            C.cut_video(tmp, 0, k, W, H, FPS, out)
        else:
            have = C.frames_of(src)
            if a + k > have:
                raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
            C.cut_video(src, a, k, W, H, FPS, out)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        paths.append(out)
        print(f"#{n} {pid} {a}장부터 {k}장 → {T[n - 1]:.3f}~{T[n]:.3f}초")
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


# ---------- 소리 — 기획 7 · 10절. 땀 · 캔 밑 김 · 캔 따기 · 첫 방울의 「치익」은 같은 재료(캔 따는 녹음 + 지글거림)로 운을 맞추고, 식는 순간 더위의 소리(매미 · 웅웅)가
# 꺼지고 풀벌레 · 저녁 공기가 들어오며, 코트 조명이 켜지는 자리에서 곡이 들어와 끝 「톡」에서 맺는다. 효과음은 상업 이용이 되는 녹음 모음(Fairlight · Sonniss GDC)과
# 여기서 짠 소리, 곡 · 매미 · 풀벌레 · 꿀꺽은 허깅페이스 stable-audio-3(곡후보.py, Stability AI Community 라이선스).
C5_AT = CUTS[4][2] / FPS                  # 5번 컷이 판의 몇 초부터인가
# 판마다 잰 시각(판 안 초): 김이 멎음 · 식는 고리 시작 · 끝 · 코트 조명 · 왕관이 풀려 떨어짐(없으면 None)
C5_TIMES = {
    "om2-5": dict(steam=1.95, wave=(2.17, 3.83), lights=3.6, release=None),
    "om2-5e__2": dict(steam=1.9, wave=(1.25, 2.9), lights=2.2, release=3.25),   # b* +30(0.9초) → 0(2.1초) → −21(3.5초), 왕관 칸 움직임 3.25~3.4초 봉우리
}
_c5 = C5_TIMES[CUTS[4][1].split("__")[0] if CUTS[4][1] not in C5_TIMES else CUTS[4][1]]
STEAM_END = T[4] + _c5["steam"] - C5_AT           # 5번 컷 방울의 김이 멎는 때
WAVE = (T[4] + _c5["wave"][0] - C5_AT, T[4] + _c5["wave"][1] - C5_AT)   # 식는 고리가 번지는 때
LIGHTS = T[4] + _c5["lights"] - C5_AT             # 코트 조명이 켜지는 때
RELEASE = T[4] + _c5["release"] - C5_AT if _c5["release"] is not None else None   # 왕관이 풀려 떨어지는 때
# 끝 — 마지막 방울 「톡」은 7번 컷 첫 장(왕관이 이미 튄 장). 끝말은 Mr. K(끝말_일레븐.py) 한 번에 구운 판을 셋으로 잘라 놓는다 — 시댄스 견본 판 셋은
# Gemini 소리 맹검 5.5~7.5, Mr. K 9.5(11-07 · 01_새판_기획 10절). Mr. K는 1번 오미톡의 브랜드 목소리(결정 11-06)라 두 편의 끝 목소리가 같아진다.
END_VO = SND + "/끝말_일레븐/MrK.mp3"
END_CUTS = [(0.00, 1.10), (1.60, 2.05), (2.54, 3.38)]   # 「다섯 가지 맛,」 · 「톡.」 · 「오미톡.」(파일 안 초 — 말 대역 크기 · 스펙트럼으로 잼, 끝 숨 · 꼬리까지)
END_AT0 = T[6] + float(os.environ.get("OM2_END_AT", "0.8"))   # 첫 줄 자리 — 마지막 왕관이 무너지는 1.2초는 맑은 「톡」만 들리게 비운다.
#   말과 말 사이는 「맛,」 → 「톡」 0.30초 · 「톡」 → 「오미톡」 0.58초(판의 0.65 · 0.72초를 조금 당김)
END_GAPS = (0.15, 0.35)             # 자른 조각 끝 → 다음 조각 머리(조각 꼬리 몫을 뺀 값)
MUSIC = {   # 곡 후보 — (파일, 곡 안 맺는 박(크게 도는 끝), 박 길이)
    "a": (SND + "/곡_스테이블/곡_a.wav", 10.26, 0.604),
    "c": (SND + "/곡_스테이블/곡_c.wav", 13.05, 0.545),
    "d": (SND + "/곡_스테이블/곡_d.wav", 13.40, 0.708),
}
SONG = os.environ.get("OM2_SONG", "c")
GULP = os.environ.get("OM2_GULP", "없음")
rng = np.random.default_rng(7)


def end_times():
    a0 = END_AT0
    t1 = a0 + (END_CUTS[0][1] - END_CUTS[0][0]) + END_GAPS[0]
    t2 = t1 + (END_CUTS[1][1] - END_CUTS[1][0]) + END_GAPS[1]
    return [a0, t1, t2]


TOK = end_times()[1] + 0.03   # 「톡.」 말이 터지는 때(조각 머리 0.03초 뒤) — 곡의 맺는 박 · 「톡」 마크의 빨간 점이 이 자리


def seg(path, a, b, stereo=False):
    x = C.load_stereo(path) if stereo else C.load(path)
    return x[int(a * RATE):int(b * RATE)].copy()


def rms_db(x):
    m = x if x.ndim == 1 else x.mean(axis=1)
    n = int(0.05 * RATE)
    e = np.array([np.sqrt(np.mean(m[i:i + n] ** 2) + 1e-12) for i in range(0, max(1, len(m) - n), n)])
    db = 20 * np.log10(e + 1e-12)
    live = e[db > db.max() - 30]
    return float(20 * np.log10(np.sqrt(np.mean(live ** 2)) + 1e-12))


def to_rms(x, target_db):
    return (x * 10 ** ((target_db - rms_db(x)) / 20)).astype(np.float32)


def to_peak(x, target_db):
    return (x * 10 ** (target_db / 20) / (float(np.max(np.abs(x))) or 1.0)).astype(np.float32)


def tame(x, over_db=9.0, release=0.06, look=0.002):
    """봉우리만 누른다(앞보기 리미터) — 10번 최종소리.py와 같음(현장노트 영상 「… 조각마다 봉우리만 누른다」)."""
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


def bp(x, lo, hi, order=2):
    return SG.sosfiltfilt(SG.butter(order, [lo, hi], "band", fs=RATE, output="sos"), x, axis=0).astype(np.float32)


# 짠 소리 — 가편집.py(10-30)의 지글거림 · 웅웅거림을 48kHz 모노로 옮김
def sizzle(dur, crackle=60, bright=1.0):
    n = int(dur * RATE)
    hiss = bp(rng.standard_normal(n).astype(np.float32), 2500, 11000) * 0.5 * bright
    imp = np.zeros(n, np.float32)
    for p in rng.integers(0, n - 400, rng.poisson(crackle * dur)):
        k = int(rng.integers(60, 300))
        imp[p:p + k] += (rng.standard_normal(k) * np.exp(-np.arange(k) / (k / 4))).astype(np.float32) * rng.uniform(0.3, 1.0)
    imp = bp(imp, 1500, 12000)
    t = np.arange(n) / RATE
    env = np.minimum(1, t / 0.012) * np.exp(-np.maximum(0, t - 0.012 - dur * 0.15) / (dur * 0.45))
    return ((hiss + imp * 0.8) * env).astype(np.float32)


def hum(dur):
    n = int(dur * RATE)
    b = np.cumsum(rng.standard_normal(n).astype(np.float32))
    b -= np.linspace(b[0], b[-1], n)
    return bp(b / (np.abs(b).max() + 1e-6), 40, 220)


def chiik(bright=1.0, crackle=70, dur=0.9):
    """「치익」 — 캔 따는 녹음 머리(0.95~1.65초) + 지글거림. 땀 · 캔 따기 · 첫 방울이 같은 소리로 운을 맞춘다."""
    can = seg(FAIR + "Soda Can Open Pour.M.wav", 0.95, 1.65)
    can = can / (np.max(np.abs(can)) or 1.0)
    n = int(dur * RATE)
    x = np.zeros(n, np.float32)
    x[:min(n, len(can))] += can[:n] * 0.8
    return x + sizzle(dur, crackle, bright)


def music_bed(total):
    """곡의 맺는 박이 「톡」에 오도록 놓는다 — 들어오는 자리는 코트 조명이 켜지기 조금(0.15초 넘게) 앞의 박이고, 두 박에 걸쳐 차올라
    조명 「탁」이 곡이 깔리는 중에 온다(om2-5 판이 그랬다 — 곡 7.36초 · 조명 7.6초, 그때 맹검은 곡 진입을 짚지 않음).
    11-07 om2-5e 판에서 「가장 가까운 박」을 쓰자 곡이 조명 뒤 0.28초에 따로 들어왔고, 완성 맹검 Lite 둘이 두 판 연속(0.25초 · 한 박 페이드)
    「7초 곡이 갑작스럽다 · 작위적」이라 바꿈."""
    path, hit, beat = MUSIC[SONG]
    s = C.load_stereo(path)
    n_beats = max(4, int(np.ceil((TOK - LIGHTS + 0.15) / beat)))
    t_in = TOK - n_beats * beat           # 화면에서 곡이 들어오는 때
    song_in = hit - n_beats * beat        # 그때의 곡 안 자리
    a = s[int(song_in * RATE):]
    bed = np.zeros((int(total * RATE) + RATE, 2), np.float32)
    i = int(t_in * RATE)
    m = min(len(a), len(bed) - i)
    bed[i:i + m] = a[:m]
    g = np.ones(len(bed), np.float32)
    g[:i] = 0
    r = int(2 * beat * RATE)
    g[i:i + r] = np.linspace(0, 1, r) ** 1.5
    return bed, g, t_in


def sound():
    total = TOTAL
    m = C.Mix(total)
    ends = end_times()
    # 더위(0초 ~ 식음): 낮게 웅웅거리는 열기 + 매미. 식는 고리가 번지는 동안 0.8초에 걸쳐 꺼진다(기획 「열기 소리는 식음과 함께 꺼지고」)
    heat_end = WAVE[0] + 0.8
    cic = to_rms(C.load_stereo(SND + "/곡_스테이블/매미_a.wav")[:int((heat_end + 0.1) * RATE)], -30)
    fade = np.ones(len(cic), np.float32)
    k0, k1 = int(WAVE[0] * RATE), int(heat_end * RATE)
    fade[k0:k1] = np.linspace(1, 0, k1 - k0) ** 1.5
    fade[k1:] = 0
    # 「아… 목 타 죽겠다」 컷(2번) 동안 매미 · 열기를 4 dB 숙인다 — 11-07 완성 맹검 두 Lite가 판을 바꿔 네 번 「대사가 매미에 묻힌다」
    j0, j1, rr = int(T[1] * RATE), int(T[2] * RATE), int(0.15 * RATE)
    dk = 10 ** (-4 / 20)
    fade[j0:j1] *= dk
    fade[j0 - rr:j0] *= np.linspace(1, dk, rr)
    fade[j1:j1 + rr] *= np.linspace(dk, 1, rr)
    m.put(0, cic * fade[:, None], fade=0.3)
    h = to_rms(hum(heat_end + 0.1), -34)
    m.put(0, h * fade[:len(h)], fade=0.3)
    # 1 땀 「치익」 — 첫 장에 이미 튄 왕관이라 0초부터
    m.put(0.00, tame(to_peak(chiik(1.0, 70, 1.2), -7)), fade=0.004, fade_out=0.3)
    # 2 친구 폰 — 판이 낸 소리(헐떡임 · 「아… 목 타 죽겠다」 · 코트 바탕) 그대로
    v2 = seg(C.clip("om2-2"), CUTS[1][2] / FPS, (CUTS[1][2] + CUTS[1][3]) / FPS, stereo=True)
    m.put(T[1], tame(to_rms(v2, -21), 8), fade=0.01)
    # 3 캔 「툭」(컷 첫 장에 손이 막 놓음) · 녹은 물이 김으로 「치이—」
    m.put(T[2] - 0.01, to_peak(bp(seg(FAIR + "Small Metal Object Dropped.M.wav", 0.0, 0.5), 80, 2500), -12), fade=0.002, fade_out=0.15)
    m.put(T[2] + 0.06, to_peak(sizzle(1.3, 35, 0.7), -20), fade=0.02, fade_out=0.4)
    # 4 화면 밖에서 캔 따는 「치익」(땀과 같은 소리) · 쏴 · 꿀꺽
    m.put(T[3] + 0.04, tame(to_peak(chiik(1.0, 70, 0.9), -6), 7), fade=0.004, fade_out=0.25)   # 봉우리 · 크기 차를 12 dB 안으로(현장노트 영상 11-07) — 9 → 7
    m.put(T[3] + 0.32, to_peak(seg(FAIR + "Soda Can Open Pour.M.wav", 1.3, 1.9), -22), fade=0.1, fade_out=0.2)
    # 꿀꺽(stable-audio-3)은 뺐다 — Gemini 소리 맹검 두 모델 모두 「기계적인 샘플 · 강제로 넣은 폴리, 실제 목넘김이 아님」(11-07). 마시는 건 화면 밖 캔 따기 · 쏴로 잇는다
    if GULP != "없음":
        gulp = {"a": (SND + "/곡_스테이블/꿀꺽_a.wav", [(0.0, 0.32)]), "b": (SND + "/곡_스테이블/꿀꺽_b.wav", [(0.48, 0.88), (1.43, 1.83)])}[GULP]
        for j, (ga, gb) in enumerate(gulp[1]):
            m.put(T[3] + 0.42 + j * 0.36, to_peak(seg(gulp[0], ga, gb), -15), fade=0.01, fade_out=0.08)
    # 5 첫 방울 — 가장 큰 「치익」, 김이 멎는 자리에서 끝나고 → 식는 고리(얼음이 얇게 갈라지는 소리 + 낮게 내려앉는 소리) → 풀벌레 · 저녁 공기 → 조명 「탁」
    # 길이는 김이 멎는 때까지, 다만 식는 고리가 오면 0.35초 안에 끝낸다 — om2-5e는 김이 0.9초 가고 고리가 방울 0.25초 뒤에 와서, 김에 맞춘
    #   1.05초 지글거림 꼬리가 얼음 소리 고역과 겹쳤다(11-07 맹검 두 Lite가 판마다 「치익이 날카롭게 튄다 · 겹칠 때 깨지듯」). 옛 om2-5 판과 같은 0.6초가 된다.
    big = chiik(1.2, 110, min(STEAM_END - T[4] + 0.15, WAVE[0] - T[4] + 0.35))
    #   짧게 한 뒤에도 두 Lite 모두 「치익 머리 고역이 귀를 찌른다」 — 크기는 지키고 7kHz 위만 4 dB 깎는다
    big = big - SG.sosfiltfilt(SG.butter(2, 7000, "high", fs=RATE, output="sos"), big).astype(np.float32) * (1 - 10 ** (-4 / 20))
    m.put(T[4], tame(to_peak(big, -5.5), 7), fade=0.004, fade_out=0.35)   # 3.1 Lite 「깜짝 놀랄 수준」 — 가장 큰 치익은 지키되 1.5 dB 내림
    # 붉은 방울이 마신 음료라는 걸 귀로 잇는다 — 이해 시험관 셋 중 둘이 「음료인지 땀인지」 헷갈림. 지글거림 머리에 액체가 떨어지는 「똑」
    drip0 = C.load(FAIR + "Water Drips Drops.M.wav")
    p0 = int(np.argmax(np.abs(drip0[:int(4 * RATE)])))
    m.put(T[4] - 0.01, to_peak(drip0[max(0, p0 - int(0.02 * RATE)): p0 + int(0.25 * RATE)], -13), fade=0.002, fade_out=0.1)
    ice = to_peak(bp(seg(SON + "Alexander Kopeikin - 100 kHz Designed Ice/ice, surface cracking, fissure, fast, hard-003.wav", 0.25, 2.25), 900, 9000), -20)
    m.put(WAVE[0] - 0.05, ice, db=-6, fade=0.04, fade_out=0.8)   # 맹검 두 모델 「6.2초 효과음이 튐」 → −4 dB · 머리 40ms, 확인 듣기 3.5 Lite 「날카로운 잔향」 → 9kHz 위 자르고 −6 dB
    if RELEASE is not None:
        # 멈췄던 왕관이 풀려 떨어지는 소리 — 슬로라 낮고 부드러운 찰랑 한 번(마지막 맑은 「톡」보다 작게, 그 「톡」이 판에서 가장 또렷하게 남도록)
        m.put(RELEASE - 0.02, to_peak(bp(seg(FAIR + "Water Light Splashing.M.wav", 0.10, 0.75), 120, 7000), -17), fade=0.01, fade_out=0.3)
    down = seg(SON + "344 Audio - Bass Drops & Downers Vol. 1/DSGNBass_Bass Drop & Downer Slow 10_344 Audio_Bass Drops & Downers.wav", 0.0, 1.6, stereo=True)
    m.put(WAVE[0], to_peak(down, -20), fade=0.3, fade_out=0.5)
    # 풀벌레 층은 1.148초에 봉우리/RMS 17.5 dB 튐이 있어(판 7.40초 — 곡이 차오르는 한가운데) 봉우리를 누른다(11-07)
    crk = tame(to_rms(C.load_stereo(SND + "/곡_스테이블/풀벌레_a.wav"), -36), 8)
    t_crk = WAVE[0] + 0.5
    m.put(t_crk, crk[:int((total - t_crk) * RATE)], fade=0.9, fade_out=0.6)
    air = bp(seg(FAIR + "Ext City Ambience, Car Drive-Bys, Pedestrian, Air.wav", 60.0, 60.0 + total - WAVE[0], stereo=True), 60, 6000)
    m.put(WAVE[0] + 0.3, to_rms(air, -40), fade=0.8, fade_out=0.6)
    # 조명 「탁」 — 봉우리/RMS 25 dB · 에너지 절반이 ±2ms에 몰린 딸깍이라 곡이 차오르는 첫머리에서 −3 dBFS로 튀었다(주변 −10~−14). 11-07 완성 맹검
    #   두 Lite가 판마다 「곡이 시작되는 지점의 공격음 · 피크」라 들은 자리 — 8 dB 낮추고 6kHz 위를 깎아 부드러운 「탁」으로.
    m.put(LIGHTS - 0.02, to_peak(bp(seg(FAIR + "Closet Light Switch On String.wav", 0.17, 0.5), 80, 6000), -24), fade=0.002, fade_out=0.1)
    buzz = seg(SON + "344 Audio - East Coast America Vol. 1/AMBSubn_Electricity Hum, Lightbulb,  Coil Pickup 01_344 Audio_East Coast America.wav", 4.0, 4.0 + total - LIGHTS, stereo=True)
    m.put(LIGHTS, to_rms(buzz, -48), fade=0.4, fade_out=0.8)   # 확인 듣기 「11.7~13초 치~ 잡음」 — 고역 조각 재기에서 셋째(29 dB)라 −4 dB
    # 6 식은 코트 — 판이 낸 「하아」(판 2.04~3.08초). 그림은 om2-6c지만 소리는 om2-6b 판 그대로 쓴다 — 두 판 모두 숨이 2.15~2.4초
    #   (6c 입 모양 2.2~2.6초, 시작 차 50ms)이고 6b 숨이 바닥보다 4 dB 또렷하다(11-07 잼).
    v6 = seg(C.clip("om2-6b"), CUTS[5][2] / FPS, (CUTS[5][2] + CUTS[5][3]) / FPS, stereo=True)
    m.put(T[5], tame(to_rms(v6, -27), 8), fade=0.02, fade_out=0.1)
    # 7 마지막 방울 — 김 없는 맑은 「톡」(가장 또렷한 봉우리) · 끝말 · 「톡」 마크 자리에 캔 「톡」
    drip = C.load(FAIR + "Water Drips Drops.M.wav")
    p = int(np.argmax(np.abs(drip[:int(4 * RATE)])))
    # 맑은 「톡」 — 판 봉우리를 혼자 정하지 않게 −5 → −8로 내렸다가, 확인 듣기 두 모델 모두 「여전히 곡에 묻힘」이라 −5.5로 올리고 봉우리만 누른다(아래 곡도 더 숙임)
    m.put(T[6] - 0.005, tame(to_peak(drip[max(0, p - int(0.02 * RATE)): p + int(0.35 * RATE)], -5.5), 8), fade=0.002, fade_out=0.15)
    pop = seg(FAIR + "Can Soda Pop Touches.M.wav", 0.88, 1.12)
    m.put(T[6] + 0.01, to_peak(pop, -8), fade=0.002, fade_out=0.08)
    vo = C.load(END_VO)
    used = np.concatenate([vo[int(a * RATE):int(b * RATE)] for a, b in END_CUTS])
    vo = vo * (10 ** ((-19 - rms_db(used)) / 20))
    # 「오미톡.」은 판에서 가장 세게 읽혀(0.25초 칸 RMS −9.2 — 앞 「톡.」 −15 · 그 사이 −24) 3 dB 내린다
    for (a, b), at, gdb in zip(END_CUTS, ends, (0.0, 0.0, -3.0)):
        m.put(at, tame(vo[int(a * RATE):int(b * RATE)], 8), db=gdb, fade=0.01, fade_out=0.05)
    m.put(TOK - 0.005, to_peak(pop, -14), fade=0.002, fade_out=0.08)
    # 곡 — 크기(RMS −27)는 들어오기 차오름만 건 곡으로 맞추고 숙임은 그 뒤에 건다(11-07: 전에는 숙임 뒤에 맞춰 숙임을 넓히면 곡 바탕이 따라 커졌다)
    bed, g, t_in = music_bed(total)
    i_in = int(t_in * RATE)
    bed = bed * g[:, None]
    # 확인 듣기 두 모델 「11.7초 · 12~13초 치~ 하는 고역 잡음」 — 고역(7~16kHz) 조각 재기에서 곡 c의 타악기가 가장 컸다(40 dB · 끝말 34 · 조명 웅 29) → 8kHz 위 −4 dB
    hi = SG.sosfiltfilt(SG.butter(2, 8000, "high", fs=RATE, output="sos"), bed, axis=0).astype(np.float32)
    bed = bed - hi * (1 - 10 ** (-4 / 20))
    bed[i_in:] = tame(to_rms(bed[i_in:], -27), 11)
    g = np.ones(len(bed), np.float32)
    # 「하아」(판 2.04~3.08초) 아래에서 곡을 4 dB 숙인다 — 3.1 Lite가 두 판 연속 「곡이 남자의 후— 숨을 덮는다」(11-07)
    h0, h1 = (T[5] + (x - CUTS[5][2] / FPS) for x in (2.04, 3.08))
    dk, rr = 10 ** (-4 / 20), int(0.1 * RATE)
    j0, j1 = int((h0 - 0.05) * RATE), int(h1 * RATE)
    g[j0:j1] = np.minimum(g[j0:j1], dk)
    g[j0 - rr:j0] = np.minimum(g[j0 - rr:j0], np.linspace(1, dk, rr))
    g[j1:j1 + rr] = np.minimum(g[j1:j1 + rr], np.linspace(dk, 1, rr))
    # 마지막 방울 「톡」(7번 컷 첫 장)에서 10 dB 숙이고(3.1 Lite 「10초 물방울 소리가 곡에 묻힘」), 0.3초에 걸쳐 5 dB 아래로만 올려 끝까지 둔다 —
    #   끝말이 그 위에 온다. 11-07 시각을 뺀 맹검에서 3.1 Lite 「10초 곡이 과하게 커져 툭」 — 재 보니 −10 dB를 0.15초 만에 풀어 10.65 → 10.95초
    #   −22 → −11 dB로 뛰었고, 끝말 조각마다 5 dB 숙였다 풀어 말 사이에서도 곡이 오르내렸다.
    #   끝말 아래는 −7 dB — −5 dB 판에서도 3.1 Lite가 두 번 「내레이션이 곡에 묻힌다」(3.5 Lite 한 번)
    duck_drop, duck = 10 ** (-10 / 20), 10 ** (-7 / 20)
    j0, j1, k = int((T[6] - 0.03) * RATE), int((T[6] + 0.35) * RATE), int(0.3 * RATE)
    g[j0:j1] = np.minimum(g[j0:j1], duck_drop)
    g[j1:j1 + k] = np.minimum(g[j1:j1 + k], np.linspace(duck_drop, duck, k))
    g[j1 + k:] = np.minimum(g[j1 + k:], duck)
    assert ends[0] - 0.05 > (j1 + k) / RATE, "끝말이 곡을 다 숙이기 전에 온다"
    bed = bed * g[:, None]
    m.put(t_in, bed[i_in:i_in + int((total - t_in) * RATE)], fade=0.0, fade_out=0.35)
    m.finish(os.path.join(OUT, os.environ.get("OM2_SOUND", "소리.wav")), boost_db=0)
    print(f"곡 {SONG} {t_in:.2f}초에 들어와 「톡」 {TOK:.2f}초에 맺음 · 끝말 {', '.join(f'{t:.2f}' for t in ends)}초")


# ---------- 끝 「톡」 마크 — 1번 오미톡 라벨/톡마크.py(유호님 11-06 「그린글자로 가자」, 슬롭 점검표 24번)를 같은 브랜드 끝 글로 다시 쓴다.
# 획 셋이 「다섯 가지 맛,」이 끝나는 자리부터 두 장 간격으로 들어오고, 빨간 점(라벨 i 점 · 마지막 루비 방울)이 떠올라 「톡.」에 박힌다. 화면에 붙은 글자라 다가감을 따라가지 않는다.
TOK_POS = (300, 600, 300)   # 마크 가운데 x · y · 높이(1080×1920) — 캔 왼쪽 같은 높이의 어두운 철망 · 나무 자리
# 기본은 끔(11-07): 첫 판에 얹었더니 이해 시험관 둘이 못 읽고(「작아 안 읽힘」 · 「E 같은 기호」), Fable 맹검도 「특 · E로 읽힘 · 얹은 PNG 티」 — 끝 시안 A(300) · B(440) · C(없음)
#   모두 약하다는 답. 슬롭 점검표 24번 「잘 그릴 수 없으면 넣지 않고 말로」에 따라 끝은 가운데 캔의 워드마크 + 「다섯 가지 맛, 톡. 오미톡.」 말로 닫는다(마크 디자인은 1번 오미톡에서 유호님이 고르신 것이라 여기서 바꾸지 않는다)
TOK_ON = os.environ.get("OM2_MARK", "0") == "1"


def tok_frames(d):
    sys.path.insert(0, os.path.join(HERE, "..", "product-hero-20261024", "라벨"))
    import 톡마크 as TM
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    cx, cy, hgt = TOK_POS
    strokes_at = TOK - 6 / FPS
    ease = lambda u: 1 - (1 - max(0.0, min(1.0, u))) ** 3   # noqa: E731
    for i in range(F[-1]):
        t = i / FPS
        layer = np.zeros((H, W, 4), np.uint8)
        if TOK_ON and t >= strokes_at:
            grow = 1.06 - 0.06 * ease((t - strokes_at) / (6 / FPS))
            for k, name in enumerate(("ㅌ", "ㅗ", "ㄱ")):
                u = (t - strokes_at - k * 2 / FPS) / (3 / FPS)
                if u <= 0:
                    continue
                mk = TM.draw(W, H, cx, cy, hgt, parts=[name], dot_scale=0, scale=grow, alpha=min(1.0, u))
                a = mk[..., 3:4].astype(np.float32) / 255
                layer[..., :3] = (layer[..., :3] * (1 - a) + mk[..., :3] * a).astype(np.uint8)
                layer[..., 3] = np.maximum(layer[..., 3], mk[..., 3])
            rise0 = TOK - 5 / FPS
            if t >= rise0:
                u = (t - rise0) / (5 / FPS)
                dy = -2.4 * TM.S * (1 - ease(u)) if u < 1 else 0.0
                popk = 1.0 if u < 1 else 1.0 + 0.28 * np.exp(-(t - TOK) * 14) * np.cos((t - TOK) * 22)
                mk = TM.draw(W, H, cx, cy, hgt, parts=[], dot_scale=max(0.55, min(1.0, 0.55 + u * 0.45)) * popk, dot_dy=dy, scale=grow)
                a = mk[..., 3:4].astype(np.float32) / 255
                layer[..., :3] = (layer[..., :3] * (1 - a) + mk[..., :3] * a).astype(np.uint8)
                layer[..., 3] = np.maximum(layer[..., 3], mk[..., 3])
        ok, buf = cv2.imencode(".png", layer)
        buf.tofile(os.path.join(d, f"{i:04d}.png"))


def render():
    pic = os.path.join(OUT, "화면.mp4")
    wav = os.path.join(OUT, "소리.wav")
    seq = os.path.join(OUT, "톡마크")
    tok_frames(seq)
    raw = os.path.join(OUT, "_합침.mp4")
    vf = "[1:v]format=rgba[k];[0:v][k]overlay=0:0:shortest=1,scale=out_color_matrix=bt709,format=yuv420p[v]"
    C.run("ffmpeg", "-y", "-v", "error", "-i", pic, "-framerate", str(FPS), "-i", os.path.join(seq, "%04d.png"),
          "-filter_complex", vf, "-map", "[v]", "-frames:v", str(F[-1]), "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-r", str(FPS),
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", raw)
    tmp = os.path.join(OUT, "_소리붙임.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", tmp)
    name = os.environ.get("OM2_NAME", "오미톡15_9x16")
    out = os.path.join(OUT, name + ".mp4")
    # 한계기 0.84는 AAC 뒤 −1.0 dBFS로 올라와 미통과(−1.2) — 1번 오미톡 최종편집.py와 같은 0.78
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), tmp, out, "--목표", "-14", "--리미터", "0.78", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=720:-2", "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=8x4:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for w in sys.argv[1:] or ["화면", "소리", "판"]:
        {"화면": picture, "소리": sound, "판": render}[w]()
