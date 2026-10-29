# -*- coding: utf-8 -*-
"""창 서리 한 장 — 컷마다 창에 낀 서리의 덮임 지도 (2026-10-29 2판, 안 3 「창에 쓴 말」, 크레딧 0).

Fable 10-29: 첫 판 C 컷은 창 전체가 같은 큰 고사리 무늬라 「벽지」로, 서리가 평평한 베이지라 「리넨」으로 읽혔다. 실제 창 서리는
가장 찬 틀 가장자리와 창 아래에서 두껍게 돋아 고사리가 안쪽으로 뻗고, 가운데는 얇은 서리 막이다. 이 장은 그 꼴을 숫자로 짓는다:
  덮임 = max(서리 막(가장자리 · 아래로 두껍게, 낮은 결 흔들림 · 고운 알갱이), 고사리(서리결정.py 지도 · 가장자리 쪽만 자람))
  손으로 쓴 말(손글씨.py)은 닦아 내고(0), 지난 말은 얇게 다시 끼고, 획 둘레엔 손끝이 밀어낸 둔덕, 획 속엔 물방울.
블렌더 안 파이썬에는 scipy가 없어 바깥에서 만들고 시안.py가 읽는다.
    python -I -X utf8 서리창.py --kind night   → <밖>/결정/창_night.npy(float16 · 행 = 위→아래 · 방 안에서 본 쪽) ·
                                                  창_night_물방울.json · 창_night_미리.png
"""
import argparse
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("--kind", required=True)
ap.add_argument("--sim", default=None)
ap.add_argument("--seed", type=int, default=6)
a = ap.parse_args()

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset",
                 "새컨셉", "결정")
PANE_W, PANE_H = 0.62, 1.00

# 컷마다: 고사리가 자란 시각(작을수록 가장자리에만) · 서리 막(가운데 · 가장자리) · 쓴 말(새로 닦음 / 지난 말이 다시 낌)
KINDS = {
    "night": dict(fern_t=0.80, mid=0.60, edge=0.72, letters=[("다녀올게", 0.45), ("바르고", 0.0)]),
    "dawn": dict(fern_t=0.80, mid=0.60, edge=0.72, letters=[("이거바르고", 0.0), ("화살표", 0.0)]),
    "morning": dict(fine_depth=0.06, fern_t=0.80, mid=0.58, edge=0.72, letters=[("고마워", 0.0)]),
    "plain": dict(fern_t=0.80, mid=0.58, edge=0.72, letters=[]),
    "end": dict(fine_depth=0.06, fern_t=0.80, mid=0.58, edge=0.72, letters=[("고마워_끝", 0.0)]),  # 끝 컷: 단지 바로 뒤 「고마워」
    "start": dict(fern_t=0.30, mid=0.0, edge=0.0, fine_depth=0.0, letters=[]),  # 첫 컷: 맑은 유리, 틀에서 고사리가 막 돋음
}
K = KINDS[a.kind]


def load_sim():
    for nm in ([a.sim] if a.sim else []) + ["window4096_e61", "window2048"]:
        d = os.path.join(밖, nm)
        if os.path.exists(os.path.join(d, "window_height.npy")):
            return nm, np.load(os.path.join(d, "window_arrival.npy")), np.load(os.path.join(d, "window_height.npy"))
    raise SystemExit("서리 지도 없음")


nm, arr, h = load_sim()
N = h.shape[0]
C = int(round(N * PANE_W / PANE_H))
# 정사각 지도의 왼 · 오른 가장자리(씨앗이 돋은 틀 쪽)를 창의 왼 · 오른쪽에 그대로 쓰고 가운데 띠를 뺀다 — 가운데를 잘라 쓰면
# 옆 틀에서 돋은 고사리가 다 잘려 나갔다. 이음매(아래 가운데)는 두 쪽 고사리를 겹쳐(max) 결정끼리 만난 자리처럼.
B = 48
half = C // 2
ramp = np.clip(np.arange(2 * B, dtype=np.float32) / (2 * B - 1), 0, 1)


def split(f, empty):
    out = np.empty((N, C), np.float32)
    out[:, :half - B] = f[:, :half - B]
    out[:, half + B:] = f[:, N - (C - half) + B:]
    a_, b_ = f[:, half - B:half + B], f[:, N - (C - half) - B:N - (C - half) + B]
    if empty == "min":
        out[:, half - B:half + B] = np.minimum(np.where(ramp < 1, a_, 2.0), np.where(ramp > 0, b_, 2.0))
    else:
        out[:, half - B:half + B] = np.maximum(a_ * (1 - ramp) ** 0.5, b_ * ramp ** 0.5)
    return out


arr, h = split(arr, "min"), split(h, "max")
rng = np.random.default_rng(a.seed)
px = PANE_H / N  # 한 칸의 길이(m)

# 가장자리까지 거리(m) — 아래는 더 차서 서리가 더 높이 올라온다(아래 거리를 0.6배로 셈)
rr, cc = np.mgrid[0:N, 0:C].astype(np.float32)
d_side = np.minimum(cc, C - 1 - cc) * px
d_bot = (N - 1 - rr) * px
d_top = rr * px
d = np.minimum(np.minimum(d_side, d_bot * 0.6), d_top * 1.4)

# 고사리 — 지금 시각까지 자란 가지(막 자란 끝은 얇게), 가장자리 쪽만 남기고 안쪽으로 갈수록 옅게
age = np.clip((K["fern_t"] - arr) / 0.06, 0.0, 1.0)
fern = h * np.sqrt(age)
keep = np.clip(1.0 - (d - 0.05) / 0.22, 0.0, 1.0) ** 1.4
fern = fern * keep

# 서리 막 — 가운데 mid, 틀 쪽으로 edge, 낮은 결 흔들림(±5% — ±14%는 얼룩진 유리로 보였다) · 고운 알갱이(±12%)
level = K["mid"] + (K["edge"] - K["mid"]) * np.exp(-d / 0.05)
# 창 위쪽은 얇게 — 찬 공기가 아래에 고여 서리는 아래로 두껍다. 위로 밤하늘 · 불빛이 비쳐야 「틀 안의 흐린 판」이 아니라 창으로 읽혔다
vv = rr / (N - 1)
level = level * (0.30 + 0.70 * np.clip((vv - 0.06) / 0.36, 0, 1) ** 1.5)
low = ndimage.gaussian_filter(rng.random((N, C)).astype(np.float32), 0.08 / px)
low = (low - low.mean()) / (low.std() + 1e-6)
grain = ndimage.gaussian_filter(rng.random((N, C)).astype(np.float32), 0.7)
grain = (grain - grain.mean()) / (grain.std() + 1e-6)
haze = level * (1.0 + 0.05 * np.tanh(low)) * (1.0 + 0.12 * np.tanh(grain))
# 잔 결정 막 — 고른 막은 화면에서 종이 · 리넨으로 읽혀(1 px = 0.5 mm라 알갱이가 안 보임), 작은 결정(약 2 cm) 수백 개가 자라
# 맞닿은 지도(서리결정.py --nuclei 1400 --edge 0)를 막의 결로 쓴다. 가지 사이는 막이 얇아 바깥이 비친다
fp = os.path.join(밖, "carpet4096", "window_height.npy")
if os.path.exists(fp):
    fine = np.load(fp).astype(np.float32)
    if fine.shape[0] != N:
        fine = np.asarray(Image.fromarray(fine).resize((N, N), Image.BILINEAR), np.float32)
    f0 = (N - C) // 2
    fine = fine[:, f0:f0 + C]
    # 결의 세기는 자리마다 다르게(약 8 cm 얼룩) · 얕게(0.12) — 0.42로 깔면 여섯 갈래 별이 「눈꽃 무늬 포장지」로 읽혔다
    patch = ndimage.gaussian_filter(rng.random((N, C)).astype(np.float32), 0.08 / px)
    patch = np.clip(0.5 + 0.9 * (patch - patch.mean()) / (patch.std() + 1e-6) * 0.5, 0.0, 1.0)
    depth = K.get("fine_depth", 0.12) * patch
    haze = level * (1.0 - depth * (1.0 - np.clip(fine * 1.15, 0, 1)))
    haze = haze * (1.0 + 0.04 * np.tanh(low)) * (1.0 + 0.06 * np.tanh(grain))
cov = np.maximum(haze, np.clip(fern * 1.05, 0, 1))

drops = []
for name, regrow in K["letters"]:
    m = np.load(os.path.join(밖, f"글자_{name}.npy")).astype(np.float32)
    if m.shape != cov.shape:
        m = np.asarray(Image.fromarray(m).resize((C, N), Image.BILINEAR), np.float32)
    rimp = os.path.join(밖, f"글자_{name}_테.npy")
    rim = np.load(rimp).astype(np.float32) if os.path.exists(rimp) else np.zeros_like(m)
    if rim.shape != cov.shape:
        rim = np.asarray(Image.fromarray(rim).resize((C, N), Image.BILINEAR), np.float32)
    if regrow > 0:  # 지난 말 — 닦인 자리에 다시 낀 얇은 서리(글씨가 희미하게 남는다)
        cov = cov * (1.0 - m) + m * cov * regrow
        cov = np.maximum(cov, np.clip(cov + rim * 0.15, 0, 1) * (1.0 - m))
        continue
    # 닦인 획 속에 남은 서리 — 손끝이 다 못 지운 알갱이(드문 점)와 얇은 물막. 속이 고르게 비면 잉크 · 인쇄로 읽혔다
    speck = ndimage.gaussian_filter((rng.random((N, C)) > 0.87).astype(np.float32), 1.0)
    speck = np.clip(speck / (speck.max() + 1e-9) * 1.6, 0, 1)
    resid = (0.45 * speck + 0.05) * cov
    cov = cov * (1.0 - m) + m * resid
    cov = np.maximum(cov, np.clip(cov + rim * 0.22, 0, 1) * (1.0 - m))
    # 획 속 물방울 — 닦인 유리에 남은 물(잘게, 드물게 굵게)
    ys, xs = np.nonzero(m > 0.75)
    if len(ys):
        pick = rng.choice(len(ys), size=min(len(ys), 260), replace=False)
        for i in pick:
            r = float(rng.uniform(0.00025, 0.0009) * (1.8 if rng.random() < 0.06 else 1.0))
            drops.append([float(xs[i] / (C - 1)), float(ys[i] / (N - 1)), r])

cov = np.clip(cov, 0, 1).astype(np.float16)
np.save(os.path.join(밖, f"창_{a.kind}.npy"), cov)
# 블렌더 5.2는 image.pixels.foreach_set으로 쓴 값을 렌더 · 저장에 넘기지 않는다(되읽으면 값이 있는데 그림은 0) — 16비트 PNG로 넘긴다
Image.fromarray((cov.astype(np.float32) * 65535).round().astype(np.uint16)).save(os.path.join(밖, f"창_{a.kind}.png"))
json.dump(drops, open(os.path.join(밖, f"창_{a.kind}_물방울.json"), "w"))
Image.fromarray((cov.astype(np.float32)[::4, ::4] * 255).astype(np.uint8)).save(os.path.join(밖, f"창_{a.kind}_미리.png"))
print(f"{a.kind}: {nm} {cov.shape} 물방울 {len(drops)}")
