"""펠트 결 넓히기 — 작은 결 조각(tex-*.webp)으로 반복 무늬가 보이지 않는 넓은 바탕을 만든다.

2×2 거울 타일(seam-*.webp)을 배너처럼 큰 면에 깔면 결의 얼룩이 거울로 되풀이돼 마름모 무늬가 보였다
(2026-10-02 LAB 유튜브 배너). 결 조각에서 무작위 자리·회전·뒤집기로 떼어 낸 조각을 부드러운 가장자리로
겹쳐 깔고, 겹치며 줄어든 결의 대비를 원본 조각만큼 되돌린다.

    python tools/펠트결_넓히기.py docs/디자인/펠트부품/assets/배경/tex-cream.webp wide-cream.webp --크기 2560x1440
    python tools/펠트결_넓히기.py <결.webp> <출력.webp> --크기 2560x1440 --배율 0.82 --씨앗 7
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage


def synth(src, w, h, patch=176, step=104, seed=7):
    rng = np.random.default_rng(seed)
    s = np.asarray(src.convert("RGB")).astype(np.float32)
    sh, sw = s.shape[:2]
    acc = np.zeros((h + patch, w + patch, 3), np.float32)
    wsum = np.zeros((h + patch, w + patch), np.float32)
    # 가장자리로 갈수록 0이 되는 창(코사인)
    t = np.sin(np.linspace(0, np.pi, patch)) ** 2
    win = np.outer(t, t).astype(np.float32) + 1e-4
    for y in range(-patch, h + patch, step):
        for x in range(-patch, w + patch, step):
            jx, jy = rng.integers(-step // 3, step // 3 + 1, 2)
            px, py = x + jx, y + jy
            # 결의 방향은 크게 바꾸지 않는다: 90° 돌리거나 뒤집으면 사선 결이 엇갈려 짠 천처럼 보였고,
            # 하나도 안 돌리면 사선 줄이 능직 천처럼 늘어섰다. ±35° 안에서만 흩는다
            big = int(patch * 1.45)
            sx = int(rng.integers(0, sw - big))
            sy = int(rng.integers(0, sh - big))
            p = s[sy:sy + big, sx:sx + big]
            p = ndimage.rotate(p, float(rng.uniform(-35, 35)), axes=(1, 0), reshape=False, order=1, mode="reflect")
            o = (big - patch) // 2
            p = p[o:o + patch, o:o + patch]
            if rng.random() < 0.5:
                p = p[::-1, ::-1]
            x0, y0 = px + patch // 2, py + patch // 2
            ax0, ay0 = max(0, x0), max(0, y0)
            ax1, ay1 = min(w + patch, x0 + patch), min(h + patch, y0 + patch)
            if ax1 <= ax0 or ay1 <= ay0:
                continue
            cx0, cy0 = ax0 - x0, ay0 - y0
            cw, ch = ax1 - ax0, ay1 - ay0
            ww = win[cy0:cy0 + ch, cx0:cx0 + cw]
            acc[ay0:ay1, ax0:ax1] += p[cy0:cy0 + ch, cx0:cx0 + cw] * ww[..., None]
            wsum[ay0:ay1, ax0:ax1] += ww
    out = acc / np.maximum(wsum, 1e-3)[..., None]
    out = out[patch // 2:patch // 2 + h, patch // 2:patch // 2 + w]
    # 겹치며 흐려진 잔결을 원본만큼 되돌린다(큰 얼룩은 그대로 두고 고운 결만)
    def fine(a):
        return a - ndimage.gaussian_filter(a, (6, 6, 0))
    src_fine = fine(s).std()
    out_low = ndimage.gaussian_filter(out, (6, 6, 0))
    out_fine = out - out_low
    k = src_fine / max(out_fine.std(), 1e-6)
    out = out_low + out_fine * min(k, 1.5)
    # 색의 평균은 원본에 맞춘다
    out += s.reshape(-1, 3).mean(0) - out.reshape(-1, 3).mean(0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--크기", default="2560x1440")
    ap.add_argument("--배율", type=float, default=1.0, help="결의 크기(원본 대비)")
    ap.add_argument("--씨앗", type=int, default=7)
    a = ap.parse_args()
    w, h = map(int, a.크기.lower().split("x"))
    src = Image.open(a.src)
    if a.배율 != 1.0:
        src = src.resize((round(src.width * a.배율), round(src.height * a.배율)), Image.LANCZOS)
    im = synth(src, w, h, seed=a.씨앗)
    im.save(a.out, quality=90, method=6)
    print(a.out, im.size)
