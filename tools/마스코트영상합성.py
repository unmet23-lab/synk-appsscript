# -*- coding: utf-8 -*-
"""
마스코트 6초 합성 — A/B 대조용 파이프라인 (2026-08-14 · 세션 13d00f98)

왜 이 모양인가:
  판정하려는 변수는 **배경 하나뿐**이다. 그래서 마스코트 레이어(위치·크기·부유·깜빡임)는
  A/B 가 «같은 코드·같은 시드»로 돌아야 한다. 배경만 갈아끼운다.

  A = 배경도 여기서 그린다(코드 · 0원)
  B = 배경 mp4 를 밖에서 받아 프레임으로 깐다(Veo 3.1 Lite · 420원)

무손상 규격(메모리 mascot-video-tooling):
  마스코트는 **원본 PNG 를 얹기만** 한다 — 생성 모델에 통째로 넣지 않는다.
  깜빡임은 정본이 「깜빡임 프레임」으로 명시한 `본체눈감음2.png` 교대로 낸다.
  변형은 위치·회전·균등 스케일뿐(색 연산 0) — 그 결과를 --검증 이 픽셀에서 다시 잰다.
"""
import argparse
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 저장소 루트는 «이 파일 위치»에서 뽑는다 — 절대경로를 박으면 다른 기계·CI 에서 죽는다.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
누끼 = os.path.join(ROOT, "docs", "캐릭터", "마스코트_누끼")

FPS = 30
초 = 6.0
N = int(FPS * 초)

# 킷 값(docs/디자인_토큰.json 파생 — 여기서 새 색을 만들지 않는다)
NAVY2 = (0x0F, 0x17, 0x30)   # 마스코트 「가장 잘 뜨는 곳」
NAVY_INK = (0x08, 0x0D, 0x1C)  # Navy 2 를 더 가라앉힌 가장자리(같은 계열 · 새 색 아님)
SLATE = (0x8A, 0x93, 0xAD)   # 다크 위 3번째 글자 층 = 입자에 쓰는 유일한 유채 밖 값
체리코어 = (0xFB, 0x7A, 0x87)
체리하이라이트 = (0xF2, 0xB0, 0xB1)  # 바닥에 가장 먼저 먹히는 단 = 임계 판정 기준값


# ─────────────────────────────────────────────────────────── 마스코트 레이어 (A·B 공통)

def 마스코트컷():
    """원본 누끼 2컷. 정본 README: 본체=기본 · 본체눈감음2=깜빡임 프레임."""
    기본 = Image.open(os.path.join(누끼, "본체.png")).convert("RGBA")
    감음 = Image.open(os.path.join(누끼, "본체눈감음2.png")).convert("RGBA")
    return 기본, 감음


# 깜빡임 스케줄(초) — 사람 눈 리듬: 홑 → 홑 → 겹깜빡. 규칙적이면 기계로 읽힌다.
깜빡임 = [1.35, 3.10, 4.55, 4.78]
깜빡임길이 = 3.0 / FPS  # 0.1초


def 감았나(t):
    return any(0 <= t - s < 깜빡임길이 for s in 깜빡임)


def 부유(t):
    """2D 부유 — 젤리의 관성. 회전은 상하보다 늦게 따라온다(위상차)."""
    주기 = 3.0
    w = 2 * math.pi / 주기
    dy = math.sin(w * t) + 0.18 * math.sin(2 * w * t + 0.7)   # 2차 고조파 = 유기적
    deg = 1.10 * math.sin(w * t - 0.55)                        # 위상 지연
    숨 = 1.0 + 0.006 * math.cos(w * t)                          # 균등 스케일(색 연산 0)
    return dy, deg, 숨


def 마스코트프레임(기본, 감음, t, 폭, 높이):
    """이 함수의 출력이 A·B 에서 비트 단위로 같아야 대조가 성립한다."""
    컷 = 감음 if 감았나(t) else 기본
    dy, deg, 숨 = 부유(t)

    목표높이 = int(높이 * 0.46 * 숨)
    비율 = 목표높이 / 컷.height
    s = 컷.resize((max(1, int(컷.width * 비율)), 목표높이), Image.LANCZOS)
    s = s.rotate(deg, resample=Image.BICUBIC, expand=True)

    cx = 폭 // 2
    cy = int(높이 * 0.50 + dy * 높이 * 0.022)
    return s, (cx - s.width // 2, cy - s.height // 2), (cx, cy, 목표높이)


# ─────────────────────────────────────────────────────────── A안 배경 (코드 · 0원)

def 소프트디스크(r):
    """보케 한 점. 가장자리 살짝 밝은 링 = 얕은 심도의 실제 모양."""
    d = 2 * r + 1
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    u = np.sqrt(x * x + y * y) / max(r, 1)
    f = np.clip(1 - u * u, 0, 1) ** 1.6
    f += 0.30 * np.exp(-((u - 0.88) ** 2) / 0.010) * (u <= 1.0)
    return np.clip(f, 0, 1).astype(np.float32).reshape(d, d)


def 입자층(rng, 개수, r범위, 밝기, 속도, 폭, 높이):
    return dict(
        x=rng.uniform(-0.1, 1.1, 개수) * 폭,
        y=rng.uniform(-0.1, 1.1, 개수) * 높이,
        r=rng.integers(r범위[0], r범위[1], 개수),
        a=rng.uniform(0.45, 1.0, 개수) * 밝기,
        v=rng.uniform(0.6, 1.4, 개수) * 속도,
        w=rng.uniform(0, 2 * math.pi, 개수),   # 옆흔들림 위상
    )


def 배경_코드(폭, 높이):
    """빛·입자·안개·심도만. 사람도 공간도 교재도 그리지 않는다(철학 §0).
       코랄(신호)은 배경에 0점 — 신호는 마스코트 하나다(킷 철칙 ④)."""
    rng = np.random.default_rng(20260814)

    # 바탕: Navy 2 중심 → 가장자리로 가라앉는 방사 그라디언트(비네트를 색이 아니라 밀도로)
    yy, xx = np.mgrid[0:높이, 0:폭].astype(np.float32)
    nx = (xx - 폭 * 0.5) / (폭 * 0.5)
    ny = (yy - 높이 * 0.42) / (높이 * 0.5)
    d = np.clip(np.sqrt(nx * nx * 0.85 + ny * ny) / 1.35, 0, 1)
    k = (d ** 1.5)[..., None]
    바탕 = (np.array(NAVY2, np.float32) * (1 - k) + np.array(NAVY_INK, np.float32) * k)

    층 = [
        # 먼 층: 작고 흐리고 느리다 — 심도의 뒤쪽
        (입자층(rng, 110, (2, 5), 0.34, 8.0, 폭, 높이), 1.4),
        (입자층(rng, 38, (8, 18), 0.26, 14.0, 폭, 높이), 3.0),
        # 가까운 층: 크고 아주 흐리다 — 렌즈 앞을 지나는 먼지
        (입자층(rng, 10, (46, 86), 0.085, 26.0, 폭, 높이), 9.0),
    ]
    스프라이트 = {}

    # 안개 — 저주파 잡음 2옥타브를 서로 다른 속도로 흘려 「심도」를 만든다.
    # 새 색이 아니다: Navy 계열을 밝기로만 밀어 올린다(킷 철칙 ④ · 신호는 여전히 하나).
    def _옥타브(seed, gh, gw):
        n = np.random.default_rng(seed).random((gh, gw)).astype(np.float32)
        im = Image.fromarray((n * 255).astype(np.uint8)).resize((폭, 높이 * 2), Image.BICUBIC)
        return np.asarray(im.filter(ImageFilter.GaussianBlur(28)), np.float32) / 255.0

    안개A, 안개B = _옥타브(7, 9, 6), _옥타브(11, 14, 9)

    def 프레임(t):
        buf = 바탕.copy()

        oa = int((t * 5.0) % 높이)
        ob = int((t * 11.0) % 높이)
        f = (안개A[oa:oa + 높이] * 0.62 + 안개B[ob:ob + 높이] * 0.38) - 0.5
        buf += (f * 26.0)[..., None] * (np.array(SLATE, np.float32) / 255.0 * 1.6)

        for p, 흐림 in 층:
            acc = np.zeros((높이, 폭), np.float32)
            y = (p["y"] - p["v"] * t) % (높이 * 1.2) - 높이 * 0.1
            x = p["x"] + np.sin(p["w"] + t * 0.30) * 9.0
            for i in range(len(y)):
                r = int(p["r"][i])
                sp = 스프라이트.get(r)
                if sp is None:
                    sp = 소프트디스크(r)
                    스프라이트[r] = sp
                cx, cy = int(x[i]), int(y[i])
                x0, y0 = cx - r, cy - r
                x1, y1 = x0 + sp.shape[1], y0 + sp.shape[0]
                sx0, sy0 = max(0, -x0), max(0, -y0)
                sx1, sy1 = sp.shape[1] - max(0, x1 - 폭), sp.shape[0] - max(0, y1 - 높이)
                if sx1 <= sx0 or sy1 <= sy0:
                    continue
                acc[max(0, y0):max(0, y0) + (sy1 - sy0),
                    max(0, x0):max(0, x0) + (sx1 - sx0)] += sp[sy0:sy1, sx0:sx1] * p["a"][i]
            if 흐림 > 0:
                acc = np.asarray(
                    Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(흐림)), np.float32) / 255.0
            buf += acc[..., None] * np.array(SLATE, np.float32) * 0.95

        # 마스코트 «자신의» 빛 — 배경에 얹는 두 번째 신호가 아니라 젤리의 발광이다.
        _, _, 숨 = 부유(t)
        cy = 높이 * 0.50 + 부유(t)[0] * 높이 * 0.022
        rr = np.sqrt(((xx - 폭 * 0.5) / (폭 * 0.62)) ** 2 + ((yy - cy) / (높이 * 0.34)) ** 2)
        bloom = np.clip(1 - rr, 0, 1) ** 2.4 * (0.085 * 숨)
        buf += bloom[..., None] * np.array(체리코어, np.float32)
        return np.clip(buf, 0, 255)

    return 프레임


# ─────────────────────────────────────────────────────────── B안 배경 (Veo mp4)

def 배경_영상(경로, 폭, 높이):
    """Veo 산출물을 프레임으로 깐다. 길이가 모자라면 마지막 프레임을 물린다."""
    cmd = ["ffmpeg", "-v", "error", "-i", 경로, "-vf",
           f"fps={FPS},scale={폭}:{높이}:force_original_aspect_ratio=increase,crop={폭}:{높이}",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    한장 = 폭 * 높이 * 3
    수 = len(raw) // 한장
    if 수 == 0:
        raise SystemExit(f"배경 영상에서 프레임을 못 얻었다: {경로}")
    arr = np.frombuffer(raw[: 수 * 한장], np.uint8).reshape(수, 높이, 폭, 3).astype(np.float32)
    print(f"   배경 영상 프레임 {수}장 (필요 {N}장)")
    return lambda t: arr[min(int(round(t * FPS)), 수 - 1)]


# ─────────────────────────────────────────────────────────── 검증 (A·B 같은 자)

def _lab(rgb):
    c = np.asarray(rgb, np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    X, Y, Z = M @ c
    wp = (0.95047, 1.0, 1.08883)
    f = lambda v: v ** (1 / 3) if v > 0.008856 else (7.787 * v + 16 / 116)
    fx, fy, fz = f(X / wp[0]), f(Y / wp[1]), f(Z / wp[2])
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


def ciede2000(a, b):
    L1, a1, b1 = _lab(a); L2, a2, b2 = _lab(b)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0.5
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1 = math.degrees(math.atan2(b1, a1p)) % 360 if (a1p or b1) else 0
    h2 = math.degrees(math.atan2(b2, a2p)) % 360 if (a2p or b2) else 0
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2 - h1) <= 180:
        dhp = h2 - h1
    else:
        dhp = h2 - h1 - 360 if h2 > h1 else h2 - h1 + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp) / 2)
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1 + h2
    elif abs(h1 - h2) <= 180:
        hbp = (h1 + h2) / 2
    else:
        hbp = (h1 + h2 + 360) / 2 if (h1 + h2) < 360 else (h1 + h2 - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
                     + Rt * (dCp / Sc) * (dHp / Sh))


def 검증(프레임들, 마스크들):
    """① 코어 hex 가 정본 #FB7A87 로 살아남았나  ② 바닥이 임계 12 를 넘나(하이라이트 기준)."""
    코어표본, 바닥표본 = [], []
    for img, m in zip(프레임들, 마스크들):
        a = img.astype(np.int32)
        속 = m > 250
        if 속.sum() < 1000:
            continue
        r, g, b = a[..., 0][속], a[..., 1][속], a[..., 2][속]
        mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
        유채 = (mx - mn) / np.maximum(mx, 1) > 0.15
        r, g, b = r[유채], g[유채], b[유채]
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        lo, hi = np.percentile(lum, 40), np.percentile(lum, 60)
        s = (lum >= lo) & (lum <= hi)
        코어표본.append((np.median(r[s]), np.median(g[s]), np.median(b[s])))

        # 바닥 = 실루엣 «바로 바깥» 링(24px) — 손 목록이 아니라 실제 픽셀이다
        밖 = np.asarray(Image.fromarray((속 * 255).astype(np.uint8))
                        .filter(ImageFilter.MaxFilter(9)), bool)
        for _ in range(2):
            밖 = np.asarray(Image.fromarray((밖 * 255).astype(np.uint8))
                            .filter(ImageFilter.MaxFilter(9)), bool)
        링 = 밖 & ~속
        바닥표본.append((a[..., 0][링].mean(), a[..., 1][링].mean(), a[..., 2][링].mean()))

    코어 = np.median(np.array(코어표본), axis=0)
    바닥 = np.median(np.array(바닥표본), axis=0)
    return dict(
        코어=tuple(int(round(v)) for v in 코어),
        코어편차=round(ciede2000(코어, 체리코어), 2),
        바닥=tuple(int(round(v)) for v in 바닥),
        바닥ΔE=round(ciede2000(체리하이라이트, 바닥), 1),
    )


# ─────────────────────────────────────────────────────────── 조립

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--배경", default="코드", help="'코드' 또는 Veo mp4 경로")
    ap.add_argument("--출력", required=True)
    ap.add_argument("--폭", type=int, default=720)
    ap.add_argument("--높이", type=int, default=1280)
    ap.add_argument("--스틸", default=None, help="대표 프레임 png 도 같이 뽑는다")
    a = ap.parse_args()

    폭, 높이 = a.폭, a.높이
    기본, 감음 = 마스코트컷()
    배경 = 배경_코드(폭, 높이) if a.배경 == "코드" else 배경_영상(a.배경, 폭, 높이)

    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{폭}x{높이}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17",
         "-movflags", "+faststart", a.출력], stdin=subprocess.PIPE)

    샘플, 마스크 = [], []
    for i in range(N):
        t = i / FPS
        bg = Image.fromarray(배경(t).astype(np.uint8), "RGB")
        s, pos, _ = 마스코트프레임(기본, 감음, t, 폭, 높이)

        # 접지 그림자는 «없다». 부유하는 유령이라 바닥이 없고, 첫 판에 넣었더니
        # 실제로 안 보였다 — 안 보이는 장치는 「돌고 있다」는 얼굴로 남는 거짓말이다.

        bg.paste(s, pos, s)
        ff.stdin.write(bg.tobytes())

        if i % 12 == 0:
            샘플.append(np.asarray(bg))
            m = Image.new("L", (폭, 높이), 0)
            m.paste(s.getchannel("A"), pos)
            마스크.append(np.asarray(m))
        if a.스틸 and i == 96:
            bg.save(a.스틸)

    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("ffmpeg 실패")

    v = 검증(샘플, 마스크)
    print(f"\n[검증] {os.path.basename(a.출력)}  (표본 {len(샘플)}프레임)")
    print(f"  마스코트 코어  #{v['코어'][0]:02X}{v['코어'][1]:02X}{v['코어'][2]:02X}"
          f"  vs 정본 #FB7A87  → ΔE2000 {v['코어편차']}"
          f"   {'OK 무손상' if v['코어편차'] < 2.0 else 'X 색이 밀렸다'}")
    print(f"  바닥(실루엣 밖) #{v['바닥'][0]:02X}{v['바닥'][1]:02X}{v['바닥'][2]:02X}"
          f"  하이라이트 대비 ΔE {v['바닥ΔE']} / 임계 12"
          f"   {'OK' if v['바닥ΔE'] >= 12 else 'X 바닥이 캐릭터를 먹는다'}")
    sz = os.path.getsize(a.출력) / 1024
    print(f"  파일 {sz:.0f} KB · {폭}x{높이} · {초}초 {FPS}fps")


if __name__ == "__main__":
    main()
