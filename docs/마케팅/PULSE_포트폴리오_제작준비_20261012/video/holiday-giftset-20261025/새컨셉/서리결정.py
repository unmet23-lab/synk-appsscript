# -*- coding: utf-8 -*-
"""서리 · 눈 결정이 자라는 지도 — Kobayashi(1993) 위상장 모형 (2026-10-29, 기프트 세트 새 컨셉 시안용, 크레딧 0).

창에 피는 서리꽃(Eisblumen)과 눈 결정은 가지(덴드라이트)가 자라는 물리라, 손으로 그린 무늬 대신 그 식을 그대로 풀어
블렌더가 쓸 지도를 만든다. 결정마다 방향(θ0)이 다르고, 가지 끝이 녹는 열을 내놓아 이웃 가지와 만나면 멎는다.

    python -I -X utf8 서리결정.py --mode macro  --n 1024 --steps 30000 --seed 7  --out <폴더>
    python -I -X utf8 서리결정.py --mode window --n 1536 --steps 40000 --seed 11 --nuclei 16 --out <폴더>
    (GPU) <torch가 있는 파이썬> 서리결정.py … --gpu   → arrival · phi만 남긴다. 높이 · 미리보기는 scipy가 있는 파이썬으로
          python -I -X utf8 서리결정.py --mode <같은 모드> --out <같은 폴더> --post
    numpy(CPU)는 1024칸 한 단계에 0.18초라 30분 넘게 걸려 GPU 판을 더했다(같은 식 · 같은 씨앗).

산출(<폴더>/<mode>_*):
  arrival.npy  자란 순간(0~1, 자라지 않은 곳 = 2) — 블렌더에서 「지금 시각보다 먼저 자란 곳만 서리」로 움직인다
  phi.npy      끝 상태의 고체 비율 φ(0~1)
  height.npy   가지 능선 높이(0~1) — 가지 가운데 등뼈가 높고 가장자리로 낮아진다
  미리.png     자란 순서를 색으로 본 미리보기
식(Kobayashi 1993):
  τ ∂φ/∂t = −∂x(ε ε′ ∂yφ) + ∂y(ε ε′ ∂xφ) + ε²∇²φ + φ(1−φ)(φ − ½ + m(T) + 잡음)
  ∂T/∂t   = ∇²T + K ∂φ/∂t ,  ε(θ) = ε̄(1 + δ cos(j(θ − θ0))),  m(T) = (α/π) atan(γ(Teq − T))
"""
import argparse
import math
import time
from pathlib import Path

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--mode", default="macro", choices=["macro", "window"])
ap.add_argument("--n", type=int, default=512)
ap.add_argument("--steps", type=int, default=4000)
ap.add_argument("--seed", type=int, default=7)
ap.add_argument("--nuclei", type=int, default=9)
ap.add_argument("--aniso", type=float, default=6.0)
ap.add_argument("--delta", type=float, default=0.04)
ap.add_argument("--kappa", type=float, default=1.8)
ap.add_argument("--noise", type=float, default=0.012)
ap.add_argument("--every", type=int, default=10)
ap.add_argument("--edge", type=float, default=0.5, help="window 씨앗 가운데 가장자리에서 돋는 몫")
ap.add_argument("--grad", type=float, default=0.0, help="창 아래가 더 차다(아래로 갈수록 Teq를 이만큼 키움 — 서리가 아래에서 위로 뻗음)")
ap.add_argument("--inner", type=float, default=0.15, help="안쪽 씨앗을 둘 범위(가장자리에서 이 비율만큼 비움)")
ap.add_argument("--fill", type=float, default=0.62, help="window 채움이 이만큼이면 멈춤(잔 결정 막은 0.9)")
ap.add_argument("--gap", type=float, default=0.9, help="씨앗 사이 최소 거리 = gap · N / √씨앗 수")
ap.add_argument("--gpu", action="store_true")
ap.add_argument("--post", action="store_true")
ap.add_argument("--out", required=True)
a = ap.parse_args()

out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
f32 = np.float32


def post():
    """능선 높이 — 가지 안쪽 거리(가지 가운데가 가장 높다), 굵은 가지가 지나치게 솟지 않게 제곱근으로 누름 + 미리보기."""
    from scipy import ndimage
    from PIL import Image

    arr = np.load(out / f"{a.mode}_arrival.npy")
    p = np.load(out / f"{a.mode}_phi.npy")
    solid = p > 0.5
    edt = ndimage.distance_transform_edt(solid).astype(f32)
    cap = np.percentile(edt[solid], 97) if solid.any() else 1.0
    h = np.sqrt(np.clip(edt / max(cap, 1e-6), 0, 1)).astype(f32)
    h = ndimage.gaussian_filter(h, 0.6).astype(f32)
    np.save(out / f"{a.mode}_height.npy", h)
    c0 = np.array([1.0, 0.78, 0.38], f32)
    c1 = np.array([0.72, 0.86, 1.0], f32)
    tt = np.clip(arr, 0, 1)[..., None]
    col = (c0 * (1 - tt) + c1 * tt) * (0.25 + 0.75 * h[..., None]) * solid[..., None]
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(out / f"{a.mode}_미리.png")
    print(f"높이 · 미리보기 → {out}  (채움 {solid.mean():.3f})")


if a.post:
    post()
    raise SystemExit

rng = np.random.default_rng(a.seed)
N = a.n
dx = 0.03
dt = 1e-4
tau = 3e-4
eps_b = 0.01
alpha, gamma, teq = 0.9, 10.0, 1.0

p0 = np.zeros((N, N), f32)
yy, xx = np.mgrid[0:N, 0:N]

# 씨앗 — macro는 가운데 하나, window는 흩어진 여럿
if a.mode == "macro":
    seeds = [(N / 2, N / 2, rng.uniform(0, math.pi / 3))]
else:
    # 창 서리는 가장 찬 창틀 가장자리에서 먼저 돋아 안쪽으로 고사리처럼 뻗는다 — 씨앗 반은 아래 · 옆 가장자리, 반은 안쪽 흠집
    seeds = []
    tries = 0
    while len(seeds) < a.nuclei and tries < 5000:
        tries += 1
        if len(seeds) < int(a.nuclei * a.edge):
            side = rng.integers(0, 3)
            t = rng.uniform(0.06, 0.94) * N
            sx, sy = [(t, N - 12), (12, t), (N - 12, t)][side]
        else:
            sx, sy = rng.uniform(a.inner, 1 - a.inner, 2) * N
        if all((sx - qx) ** 2 + (sy - qy) ** 2 > (N * a.gap / math.sqrt(a.nuclei)) ** 2 for qx, qy, _ in seeds):
            seeds.append((sx, sy, rng.uniform(0, math.pi / 3)))
# 둘레 띠는 늘 비운다 — 주기 경계로 반대편에 넘어가 자라지 않게(띠를 녹는점으로 두면 그 열이 가장자리 씨앗을 녹였다)
band0 = np.zeros((N, N), bool)
band0[:4], band0[-4:], band0[:, :4], band0[:, -4:] = True, True, True, True

# 결정마다 방향 — 가장 가까운 씨앗의 θ0를 그 자리의 방향으로(결정끼리 만나는 경계 = 보로노이 경계)
d2 = np.full((N, N), np.inf, f32)
theta00 = np.zeros((N, N), f32)
for sx, sy, th in seeds:
    dd = ((xx - sx) ** 2 + (yy - sy) ** 2).astype(f32)
    near = dd < d2
    theta00[near] = th
    d2 = np.minimum(d2, dd)
    p0[dd < 5.0 ** 2] = 1.0

teq0 = (teq * (1.0 + a.grad * (yy / (N - 1) - 0.5))).astype(f32)

if a.gpu:
    import torch as xp

    dev = "cuda"
    gen = xp.Generator(device=dev).manual_seed(a.seed)
    T_ = lambda v: xp.as_tensor(v, device=dev)
    roll = lambda f, s, ax: xp.roll(f, s, ax)
    atan2, cos, sin, atan = xp.atan2, xp.cos, xp.sin, xp.atan
    rand = lambda: xp.rand((N, N), generator=gen, device=dev, dtype=xp.float32)
    p, T = T_(p0), xp.zeros((N, N), device=dev, dtype=xp.float32)
    theta0, band = T_(theta00), T_(band0)
    teqf = T_(teq0)
    arrival = xp.full((N, N), float("inf"), device=dev, dtype=xp.float32)
    isinf = xp.isinf
    tonp = lambda v: v.detach().cpu().numpy()
    rimmax = lambda q: float(xp.max(xp.cat([q[:6].flatten(), q[-6:].flatten(), q[:, :6].flatten(), q[:, -6:].flatten()])))
else:
    xp = np
    roll = lambda f, s, ax: np.roll(f, s, ax)
    atan2, cos, sin, atan = np.arctan2, np.cos, np.sin, np.arctan
    rand = lambda: rng.random((N, N), f32)
    p, T = p0, np.zeros((N, N), f32)
    theta0, band = theta00, band0
    teqf = teq0
    arrival = np.full((N, N), np.inf, f32)
    isinf = np.isinf
    tonp = lambda v: v
    rimmax = lambda q: float(np.concatenate([q[:6].ravel(), q[-6:].ravel(), q[:, :6].ravel(), q[:, -6:].ravel()]).max())


def ddx(f):
    return (roll(f, -1, 1) - roll(f, 1, 1)) * (0.5 / dx)


def ddy(f):
    return (roll(f, -1, 0) - roll(f, 1, 0)) * (0.5 / dx)


def lap(f):
    # 9점 라플라시안 — 5점은 격자 축 방향을 편애해 가지가 네모로 기울고, 넓은 중심 차분의 발산은 홀짝 칸이 갈라져 줄무늬가 졌다
    n, s = roll(f, 1, 0), roll(f, -1, 0)
    e, w = roll(f, -1, 1), roll(f, 1, 1)
    ne, nw = roll(n, -1, 1), roll(n, 1, 1)
    se, sw = roll(s, -1, 1), roll(s, 1, 1)
    return (4 * (n + s + e + w) + (ne + nw + se + sw) - 20 * f) * (1 / (6 * dx ** 2))


arrival[p > 0.5] = 0
t0 = time.time()
last_fill = 0.0
j, delta = float(a.aniso), float(a.delta)
step = 0
for step in range(1, a.steps + 1):
    px, py = ddx(p), ddy(p)
    th = atan2(py, px)
    ang = j * (th - theta0)
    eps = eps_b * (1 + delta * cos(ang))
    epsd = -eps_b * j * delta * sin(ang)
    ee = eps * epsd
    m = (alpha / math.pi) * atan(gamma * (teqf - T))
    react = p * (1 - p) * (p - 0.5 + m + a.noise * (rand() - 0.5))
    # 흔히 쓰는 꼴(Kobayashi 원 논문의 수치 예와 같음): 비등방 두 항 + ε²∇²φ
    rhs = ddy(ee * px) - ddx(ee * py) + eps * eps * lap(p) + react
    dp = rhs * (dt / tau)
    T = T + lap(T) * dt + a.kappa * dp
    p = p + dp
    p[band] = 0
    if step % a.every == 0:
        hit = (p > 0.5) & isinf(arrival)
        arrival[hit] = step
        if step % (a.every * 100) == 0:
            fill = float((p > 0.5).float().mean()) if a.gpu else float((p > 0.5).mean())
            print(f"{step}/{a.steps}  채움 {fill:.3f}  {time.time() - t0:.0f}초", flush=True)
            if fill > a.fill and a.mode == "window":
                break
            # 결정끼리 만나 열이 차면 더 자라지 않는다 — 1000단계 사이 채움이 0.2 %p도 안 늘면 멈춘다
            if a.mode == "window" and fill - last_fill < 0.002 and step > 4000:
                break
            last_fill = fill
            # 가장자리에 닿으면 멈춘다(macro — 둘레가 주기 경계로 넘어가 다시 들어오지 않게)
            if a.mode == "macro" and rimmax(p) > 0.5:
                break

arrival = tonp(arrival)
p = tonp(p)
last = float(np.nanmax(np.where(np.isinf(arrival), np.nan, arrival)))
arr = np.where(np.isinf(arrival), 2.0, arrival / max(last, 1.0)).astype(f32)
np.save(out / f"{a.mode}_arrival.npy", arr)
np.save(out / f"{a.mode}_phi.npy", np.clip(p, 0, 1).astype(f32))
print(f"끝 — 단계 {step} · 채움 {(p > 0.5).mean():.3f} · 씨앗 {len(seeds)} · {time.time() - t0:.0f}초 → {out}")
try:
    post()
except ImportError:
    print("scipy가 없어 높이 · 미리보기는 --post로 따로")
