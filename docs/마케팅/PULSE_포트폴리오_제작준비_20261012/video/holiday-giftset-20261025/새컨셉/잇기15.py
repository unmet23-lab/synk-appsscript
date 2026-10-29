# 기프트 세트 · 안 1 · 2 합친 판 15초 · 6초 — 소리 · 잇기 · 보드 (2026-10-30, 크레딧 0)
#   python -X utf8 잇기15.py 소리          → <밖>/움직임/15초/소리_15초.wav · 소리_6초.wav
#   python -X utf8 잇기15.py 잇기 [15 6]    → 기프트세트_안12_15초.mp4 · _6초.mp4(빛 번짐 · 기 → 승 디졸브 · 이름 · 소리)
#   python -X utf8 잇기15.py 보드 [15 6]    → 0.5초마다 한 장
# 장면은 움직임.py m1(기) · 움직임15.py 승 · 전 · 결이 굽고, 여기서는 잇고 소리 · 이름을 얹는다. 이름은 렌더에 그리지 않고
# 포장 원고와 같은 Noto Serif KR로 얹는다(제품 · 글자는 AI로 그리지 않는다). 소리는 음악 없이 소리 디자인만 —
# 결정이 자라는 얼음 소리 → 깨짐 한 방 뒤 멈춤의 침묵 → 결의 유리 종(기획 7절). 효과음은 녹음 모음(Sonniss GDC 2026 ·
# Fairlight) 한 타씩을 사건 프레임에, 얼음 금 알갱이 · 낮은 부풂 · 얼어붙은 반짝임 · 유리 종의 긴 울림은 만든다.
import math
import os
import subprocess
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "블렌더"))
import 움직임잇기 as J  # noqa: E402  load_audio · win_rms · attack · limiter · lufs_of · write_wav · font · spaced
from 빛번짐 import bloom  # noqa: E402

FPS = 30
SR = J.SR
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset",
                 "새컨셉", "움직임")
ROOT = os.path.join(밖, "15초")
LIB = J.LIB
SFX = {  # 녹음 모음에서 이름 조각으로 찾는다
    "금": "ice, surface cracking, fissure, fast, hard-003",
    "깨짐": "ice, crack, ice block snapping-001",
    "유리깨짐": "Glass Break 1",
    "들판": "ice, movement, ice drift, ice field cracking up",
    "휘익": "GLASMvmt_Whoosh Glass Crystal Fragments Sharp Shards Dry 05",
    "부스러기": "Glass Debris",
    "놓음": "Glass Down On wood",
    "잔": "Glass Clink Toast",
}
_SRC = {}

# 덩이: (이름, 프레임 폴더, 원천 첫 장, 장 수) — 15초는 기 끝 8장과 승 첫 8장을 겹쳐 디졸브(둘 다 카메라가 멎은 자리).
# m1 결정은 뒤 금빛 보케가 비쳐 금빛, 승 첫 장은 그 보케가 없어 은빛이라 5장(0.17초)은 결 색이 툭 바뀌었다
XF = 8
CUTS = {
    "15": [("기", "m1", 0, 90), ("승", "승", 0, 90), ("전", "전", 0, 150), ("결", "결", 0, 120)],
    # 6초: 기 가운데 1.2초 → 승 끝 1.07초(돔이 서리로 덮임) → 전 머리 1초(금 · 깨짐 · 멈춤) → 결 2.73초(내려앉는 순간부터 끝까지)
    "6": [("기", "m1", 40, 36), ("승", "승", 58, 32), ("전", "전", 0, 30), ("결", "결", 38, 82)],
}
LEN = {"15": 450, "6": 180}


def sfx(name):
    if name not in _SRC:
        for dp, _, fs in os.walk(LIB):
            hit = next((f for f in fs if SFX[name] in f), None)
            if hit:
                _SRC[name] = J.load_audio(os.path.join(dp, hit))
                break
        else:
            raise FileNotFoundError(SFX[name])
    return _SRC[name]


def timeline(film):
    """화면 프레임 → (덩이, 폴더, 원천 장, 다음 덩이와 섞을 몫(0~1), 다음 덩이의 (폴더, 장))."""
    out = []
    cuts = CUTS[film]
    for i, (beat, d, s0, n) in enumerate(cuts):
        for k in range(n):
            out.append([beat, d, s0 + k, 0.0, None])
    if film == "15":  # 기 끝 XF장 ↔ 승 첫 XF장
        i0 = 90 - XF
        for k in range(XF):
            out[i0 + k][3] = (k + 1) / (XF + 1)
            out[i0 + k][4] = ("승", k)
        del out[90:90 + XF]
        last = out[-1]
        out += [[last[0], last[1], last[2], 0.0, None] for _ in range(XF)]  # 결 마지막 장을 XF장 더(카메라 · 제품 모두 멈춘 1초 안)
    assert len(out) == LEN[film], (film, len(out))
    return out


FOLDER = {"기": "m1", "승": "승", "전": "전", "결": "결"}


def beat_start(film, beat):
    """그 덩이가 화면에 처음 온전히 서는 시각(15초 승은 디졸브 뒤 3.0초)."""
    tl = timeline(film)
    return next(i for i, r in enumerate(tl) if r[0] == beat) / FPS


def src_time(film, beat, t_local):
    """그 덩이 원천 시각(초) t_local이 화면에서 몇 초인가 — 디졸브로 겹친 장 · 6초처럼 잘라 쓴 덩이도 원천 장으로 찾는다
    (화면에 없는 장이면 가장 가까운 장에서 늘려 잰다)."""
    d = FOLDER[beat]
    idx = {}
    for i, r in enumerate(timeline(film)):
        if r[1] == d:
            idx.setdefault(r[2], i)
        if r[4] and r[4][0] == d:
            idx.setdefault(r[4][1], i)
    f = t_local * FPS
    near = min(idx, key=lambda k: abs(k - f))
    return (idx[near] + (f - near)) / FPS


# ── 소리 ────────────────────────────────────────────────────────────────────
def ice_ticks(n, t0, t1, rate0, rate1, lvl0, lvl1, seed, width=0.8):
    """얼음 금 알갱이 — 잡음 한 톨 + 2~8 kHz 짧은 울림(3~12 ms)을 점점 잦게. 얼음이 자라며 내는 잔 「틱 · 칙」."""
    rng = np.random.default_rng(seed)
    buf = np.zeros((n, 2), np.float32)
    t = t0
    while t < t1:
        u = (t - t0) / max(1e-6, t1 - t0)
        rate = rate0 + (rate1 - rate0) * u
        lvl = lvl0 + (lvl1 - lvl0) * u + rng.normal(0, 3.0)
        m = int(0.03 * SR)
        x = np.arange(m) / SR
        f = rng.uniform(2200, 8200)
        tau = rng.uniform(0.003, 0.012)
        g = (rng.standard_normal(m) * np.exp(-x / 0.0004) * 0.6 + np.sin(2 * math.pi * f * x) * np.exp(-x / tau)).astype(np.float32)
        g *= J.db(lvl) / max(1e-6, np.abs(g).max())
        pan = rng.uniform(-width, width)
        i0 = int(t * SR)
        seg = g[: max(0, n - i0)]
        buf[i0:i0 + len(seg), 0] += seg * (1 - max(0.0, pan))
        buf[i0:i0 + len(seg), 1] += seg * (1 + min(0.0, pan))
        t += rng.exponential(1.0 / max(rate, 0.1))
    return buf


def highpass(x, f, order=2):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x, axis=0).astype(np.float32)


def bandpass(x, lo, hi, order=2):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x, axis=0).astype(np.float32)


def glass_bell(length=4.0):
    """유리 종 — 실제 잔 부딪힘(Glass Clink Toast)의 배음 1,080 · 2,880 · 5,424 · 6,806 Hz를 길게 울린다(크리스털 잔을
    두드린 뒤 남는 울림). 치는 순간은 녹음 한 타를 그대로 겹친다. 두 배음을 0.4 Hz 어긋내 천천히 맥놀이가 돈다."""
    x = np.arange(int(length * SR)) / SR
    # 울림 1.1초(첫 섞기 2.6초는 끝 2초 내내 −20 dB로 남아 깨짐 한 방만큼 컸다)
    parts = [(1080.0, 1.0, 1.1), (1080.4, 0.35, 1.0), (2880.0, 0.55, 0.6), (5424.0, 0.18, 0.3), (6806.0, 0.12, 0.2)]
    sig = sum(g * np.sin(2 * math.pi * f * x + k) * np.exp(-x / d) for k, (f, g, d) in enumerate(parts))
    sig *= np.minimum(1.0, x / 0.0015)
    sig = np.stack([sig, sig * 0.96], 1).astype(np.float32)
    hit = sfx("잔")
    hit = hit[J.attack(hit):][: len(sig)]
    sig[: len(hit)] += hit * (np.abs(sig).max() / max(1e-6, np.abs(hit).max())) * 0.7
    return sig


def frozen_shimmer(src, length, seed=5):
    """얼어붙은 반짝임 — 깨짐 소리의 높은 몫(3~11 kHz)에서 짧은 알갱이를 떼어 겹쳐 이어 붙인다(시간이 멈춘 소리)."""
    rng = np.random.default_rng(seed)
    hi = bandpass(src, 3000, 11000)
    n = int(length * SR)
    out = np.zeros((n, 2), np.float32)
    g = int(0.12 * SR)
    win = np.hanning(g).astype(np.float32)[:, None]
    a = J.attack(src)
    pos = 0
    while pos < n:
        s = a + int(rng.uniform(0.02, 0.25) * SR)
        grain = hi[s:s + g]
        if len(grain) < g:
            break
        k = min(g, n - pos)
        out[pos:pos + k] += (grain * win)[:k]
        pos += g // 3
    return out


def mix(film):
    """사건 자리는 장면 시각(움직임15.py의 LAND · GLINT_AT · 깨짐 장)에서 온다. 15초 기준 —
    0–3 결정이 자람(얼음 금 알갱이, 잦아지며 커짐) · 3–6 서리가 돔으로 번짐(알갱이가 넓게 · 잦게, 낮은 부풂) ·
    6.00 금이 번짐(0.13초) · 6.13 깨짐 한 방(가장 큼) → 6.45부터 얼어붙은 반짝임만 남은 침묵 ·
    11.0 시간이 흐르며 조각이 빠지는 휘익 · 12.15 · 12.30 앰플 · 단지가 내려앉음 · 13.0 유리 종 · 끝은 작은 공간 소리."""
    n = int(LEN[film] / FPS * SR)
    out = np.zeros((n, 2), np.float32)

    def place(t, sig, level, at="attack", pan=0.0, length=None, fade_out=None, fade_in=None):
        sig = sig[: int(length * SR)].copy() if length else sig.copy()
        if fade_in:
            k = min(len(sig), int(fade_in * SR))
            sig[:k] *= np.linspace(0, 1, k)[:, None]
        if fade_out:
            k = min(len(sig), int(fade_out * SR))
            sig[len(sig) - k:] *= np.linspace(1, 0, k)[:, None]
        r, ipk = J.win_rms(sig)
        sig *= J.db(level) / max(r, 1e-9)
        ref = {"attack": J.attack(sig), "start": 0, "peak": ipk + int(0.05 * SR)}[at]
        i0 = int(round(t * SR)) - ref
        s0 = max(0, -i0)
        i0 = max(0, i0)
        seg = sig[s0: s0 + n - i0]
        if pan:
            seg = seg * np.array([1 - max(0.0, pan), 1 + min(0.0, pan)], np.float32)
        out[i0: i0 + len(seg)] += seg

    def T(beat, t):  # 덩이 원천 시각 → 화면 시각(6초는 잘린 몫만큼 옮긴다)
        return src_time(film, beat, t)

    a = 0.0
    s0 = beat_start(film, "승")  # 기 → 승 경계(15초는 디졸브 끝)
    crack = T("전", 0.0)
    hit = T("전", 4 / FPS)
    gy = beat_start(film, "결")  # 멈춤이 끝나는 자리(15초 11.0 · 6초 결로 넘어가는 컷)
    # 기 · 승 — 얼음 금 알갱이(자라는 결정) · 들판 얼음의 높은 잔금(밑결). 첫 섞기는 기 3초가 −45 dB(0.25초 RMS)로
    # 휴대폰에서 거의 안 들렸다 — 알갱이 · 밑결을 올리고 높은 서리 울림을 깐다
    out += ice_ticks(n, a, s0, 7, 12, -26, -22, seed=1, width=0.35)
    out += ice_ticks(n, s0, crack - 0.04, 14, 70, -24, -17, seed=2, width=0.9)
    bed = highpass(sfx("들판")[int(20.0 * SR): int(32.0 * SR)], 2500)
    L = crack - 0.04 - a
    if L > 0.2:
        place(a, bed, -36, at="start", length=L, fade_in=0.4, fade_out=0.05)
        # 서리 울림 — G5 · D6 · G6 순음 셋이 천천히 일렁인다(유리 하모니카 결), 금에서 끊긴다. 한 옥타브 위(G6~)는
        # 귀를 찌르는 순음이라 내렸다
        m = int(L * SR)
        x = np.arange(m) / SR
        pad = sum(np.sin(2 * math.pi * f * x) * (0.6 + 0.4 * np.sin(2 * math.pi * r * x + k))
                  for k, (f, r) in enumerate(((783.99, 0.31), (1174.66, 0.47), (1567.98, 0.63))))
        env = np.minimum(1.0, x / 1.5).astype(np.float32)
        env[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
        pad = (pad * env).astype(np.float32)
        place(a, np.stack([pad, pad * 0.9], 1), -40, at="start")
    # 승 — 낮은 부풂(A1 + E2), 서리가 덮일수록 커져 금 직전에 멎는다
    if crack - s0 > 0.3:
        m = int((crack - s0) * SR)
        x = np.arange(m) / SR
        sw = sum(np.sin(2 * math.pi * f0 * x) / k for k, f0 in ((1, 55.0), (2, 82.41), (3, 110.0)))
        env = (np.linspace(0, 1, m) ** 2.2).astype(np.float32)
        env[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
        sw = (sw * env).astype(np.float32)
        place(s0, np.stack([sw, sw], 1), -27, at="start")
    # 금이 번짐(0–4장) → 깨짐 한 방(4장): 얼음 깨짐 + 유리 깨짐 + 낮은 쿵을 한 덩이로
    c = sfx("금")
    place(crack, c[J.attack(c):], -19, at="start", length=0.16, fade_out=0.03, pan=-0.1)
    m = int(1.4 * SR)
    x = np.arange(m) / SR
    thud = (np.sin(2 * math.pi * 52 * x) * np.exp(-x / 0.20)).astype(np.float32)
    big = np.stack([thud, thud], 1) * J.db(-5)
    for nm, pk, ln in (("깨짐", -4, 1.4), ("유리깨짐", -7, 1.1)):
        s_ = sfx(nm)[J.attack(sfx(nm)):]
        s_ = s_[: int(ln * SR)].copy()
        s_ *= J.db(pk) / max(1e-6, np.abs(s_).max())
        big[: len(s_)] += s_[:m]
    # 멈춤 — 0.32초 뒤 0.12초에 걸쳐 침묵으로(소리도 얼어붙는다)
    k0, k1 = int(0.32 * SR), int(0.44 * SR)
    big[k0:k1] *= np.linspace(1, 0, k1 - k0)[:, None]
    big[k1:] = 0
    place(hit, J.limiter(big, -3.0), -8, at="start")
    # 얼어붙은 반짝임 — 깨짐의 높은 몫을 이어 붙여 멈춘 동안 아주 작게 남긴다(전 끝에서 잦아듦)
    frz_t0 = hit + 0.30
    frz_L = gy - frz_t0
    if frz_L > 0.2:
        place(frz_t0, frozen_shimmer(sfx("유리깨짐"), frz_L), -41, at="start", fade_in=0.15, fade_out=min(1.2, frz_L * 0.5))
    # 결 — 시간이 흐르며 조각이 빠진다(15초만 — 6초는 내려앉는 순간에서 시작). 휘익은 멈춘 장면 안에서 미리 커지지 않게
    # 시간이 다시 흐르는 장 바로 앞에서 시작(첫 섞기는 0.6초 앞부터 올라왔다)
    if film == "15":
        wh = sfx("휘익")
        _, ipk = J.win_rms(wh)
        pk_at = gy + 0.45
        cut = max(0, ipk + int(0.05 * SR) - int((pk_at - (gy - 0.05)) * SR))
        place(pk_at, wh[cut:], -21, at="peak", fade_in=0.06, fade_out=0.4, pan=0.15)
        place(gy + 0.15, sfx("부스러기"), -31, fade_out=0.3, pan=-0.3)
        place(T("결", 1.15), sfx("놓음"), -27, pan=-0.2)  # 앰플
    place(T("결", 1.30), sfx("놓음"), -24, pan=0.15)  # 단지
    for k, (dt, lv) in enumerate(((0.16, -37), (0.31, -42))):  # 흔들림 두 번
        place(T("결", 1.30 + dt), sfx("놓음")[: int(0.25 * SR)], lv, pan=0.15)
    # 유리 종 — 뚜껑 결정 반짝임과 같은 자리(결 2.0초). 깨짐 한 방(−8)보다 작고 맑게
    place(T("결", 2.0), glass_bell(), -15, at="start")
    # 작은 공간 소리 — 디지털 무음 대신(지난 판 원본 실측 −41), 끝 0.4초에 잦아든다
    rng = np.random.default_rng(7)
    air = bandpass(rng.standard_normal((n, 2)).astype(np.float32), 60, 1500)
    air = air / np.sqrt((air ** 2).mean()) * J.db(-50)
    env = np.ones(n, np.float32)
    env[-int(0.4 * SR):] = np.linspace(1, 0, int(0.4 * SR)) ** 2
    out += air * env[:, None]
    # 크기: 침묵이 길어 통합 크기는 낮게 둔다 — 깨짐 한 방의 0.1초가 −8 dBFS 언저리, 표본 최대 −2.5 dBFS 안
    return J.limiter(out, -2.5)


def sound(args):
    for film in ("15", "6"):
        x = mix(film)
        p = os.path.join(ROOT, f"소리_{film}초.wav")
        J.write_wav(p, x)
        print(film, "초 소리", p, "통합", round(J.lufs_of(x), 1), "LUFS · 최대", round(20 * math.log10(np.abs(x).max()), 1), "dBFS")


# ── 이름 ────────────────────────────────────────────────────────────────────
NAME_AT = 2.35  # 결 원천 시각 — 단지가 멈춘 뒤(1.9) · 유리 종(2.0) 뒤
NAME_POS = 0.215  # 화면 높이 비율 — 제품 위 어두운 밤(아래는 앰플 반사의 뚜껑이 0.87에 오고, 세로 SNS 자막 · 단추에 가린다)


def name_layer(W, H):
    """「유리결」 + 서리꽃 홀리데이 에디션(작게) — 상아 · 옅은 금, 가는 명조."""
    from PIL import Image, ImageDraw
    u = min(W, H)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = W / 2, H * NAME_POS
    d.text((cx, cy - u * 0.016), "유리결", font=J.font(int(u * 0.058), "Medium"), fill=(243, 236, 222, 255), anchor="mm")
    J.spaced(d, cx, cy + u * 0.034, "서리꽃 홀리데이 에디션", J.font(int(u * 0.020), "Regular"), (214, 190, 140, 255), u * 0.004)
    return np.asarray(im, np.float32) / 255.0


# ── 잇기 ────────────────────────────────────────────────────────────────────
def load(d, f, size):
    from PIL import Image
    p = os.path.join(ROOT, d, f"{d}_{f:03d}.png")
    im = Image.open(p).convert("RGB")
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(bloom(im), np.float32)


def assemble(args):
    films = [a for a in args if a in ("15", "6")] or ["15", "6"]
    for film in films:
        wav = os.path.join(ROOT, f"소리_{film}초.wav")
        J.write_wav(wav, mix(film))  # 늘 새로 — 디졸브 길이가 바뀌면 사건 자리가 옮는다
        W, H = 1080, 1920
        nm = name_layer(W, H)
        rgb, al = nm[..., :3] * 255.0, nm[..., 3:4]
        name_at = src_time(film, "결", NAME_AT)
        rng = np.random.default_rng(11)
        outp = os.path.join(ROOT, f"기프트세트_안12_{film}초.mp4")
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
               "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outp]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i, (beat, d, f, mixk, nxt) in enumerate(timeline(film)):
            v = load(d, f, (W, H))
            if nxt:
                v = v * (1 - mixk) + load(nxt[0], nxt[1], (W, H)) * mixk
            t = i / FPS
            a = min(1.0, max(0.0, (t - name_at) / 0.6))
            if a > 0:
                v = v * (1 - al * a) + rgb * al * a
            v += rng.random(v.shape, dtype=np.float32) - rng.random(v.shape, dtype=np.float32)  # ±1 디더(어두운 밤 등고선)
            p.stdin.write(np.clip(np.rint(v), 0, 255).astype(np.uint8).tobytes())
        p.stdin.close()
        p.wait()
        print("잇기", outp, "코드", p.returncode)


def board(args):
    from PIL import Image, ImageDraw, ImageFont
    films = [a for a in args if a in ("15", "6")] or ["15", "6"]
    lab = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)
    for film in films:
        mp4 = os.path.join(ROOT, f"기프트세트_안12_{film}초.mp4")
        w, h = 216, 384
        times = [round(i * 0.5, 2) for i in range(int(LEN[film] / FPS / 0.5))]
        cols = 10
        rows = (len(times) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * w, rows * (h + 30)), (16, 17, 22))
        d = ImageDraw.Draw(sheet)
        tl = timeline(film)
        for i, t in enumerate(times):
            f = min(int(round(t * FPS)), LEN[film] - 1)
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{f}),scale={w}:{h}", "-frames:v", "1",
                                  "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
            x, y = (i % cols) * w, (i // cols) * (h + 30)
            if len(raw) == w * h * 3:
                sheet.paste(Image.frombytes("RGB", (w, h), raw), (x, y + 30))
            d.text((x + 6, y + 4), f"{t:.1f}초 · {tl[f][0]}", font=lab, fill=(255, 230, 150))
        out = os.path.join(ROOT, f"보드_{film}초.jpg")
        sheet.save(out, quality=88)
        print("보드", out)


if __name__ == "__main__":
    cmd, rest = sys.argv[1], sys.argv[2:]
    {"소리": sound, "잇기": assemble, "보드": board}[cmd](rest)
