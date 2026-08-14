# -*- coding: utf-8 -*-
"""마스코트 «정본» 조립 파이프라인 (유호 확정 08-14 「③으로 통일」 + 같은 날 보완 지시 2건).

렌더 2048 원본에서 전 과정을 건다:
  렌더(2048 · 회색 배경) → ①누끼(플러드필) → ②속수리(유령 윤곽 제거 · 마스코트속수리.py)
  → ③검은 밴드 완화(--밴드 · 유호 「머리 위 검정 최소화」) → ④비율 강 0.925(마스코트비율.py)
  → docs/캐릭터/마스코트_정본/<컷>.png

왜 2048 부터인가 (실측 08-14): 마스코트_누끼 는 1024 — 렌더의 절반 해상도다.
  ③ 시안의 「질 깨짐」(유호 감지)의 원인이 이것: 절반 해상 가공 + 640 축소 미리보기.
  그래서 정본은 누끼 층을 거치지 않고 렌더에서 직접 새로 깎는다.

①누끼 로직은 talk `tools/마스코트변환.py`(08-13 검수 통과) 이식 — 저채도·밝음 후보를
  가장자리 플러드필로 걷어 배경·바닥그림자만 제거, 몸 안 흰 하이라이트는 살아남는다.
  (두 repo 가 서로 import 하지 않도록 복사 이식 · 원본 주석 참조)

③밴드 완화: 검정을 «회색으로 밝히면» 유리가 죽는다 — 어두운 픽셀을 깊은 체리 유리색
  쪽으로 끌어올린다(darkness 비례라 광택 줄무늬·반사는 그대로). 세기 0=지금 그대로.

틀릴 때의 모습: 밴드 세기를 너무 올리면 상단 대비가 죽어 「명품 검은 유리」 인상이
  사라진다 — 세기는 유호 픽이고, 기본값은 그 픽으로 고정한다.
"""
import argparse
import os
import sys
from collections import deque

import importlib.util
import numpy as np
from PIL import Image, ImageFilter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
렌더 = os.path.join(ROOT, "docs", "캐릭터", "마스코트_렌더")
정본 = os.path.join(ROOT, "docs", "캐릭터", "마스코트_정본")


def _모듈(이름):
    spec = importlib.util.spec_from_file_location(이름, os.path.join(ROOT, "tools", 이름 + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


속수리모듈 = _모듈("마스코트속수리")
비율모듈 = _모듈("마스코트비율")


# ── ① 누끼 (talk 마스코트변환.py 이식 · 2048 그대로 — 축소 없음)
def 배경플러드(cand):
    H, W = cand.shape
    bg = np.zeros_like(cand)
    stack = deque()
    for yy in (0, H - 1):
        xs = np.nonzero(cand[yy])[0]
        if xs.size:
            for x in xs[np.concatenate(([True], np.diff(xs) > 1))]:
                stack.append((yy, int(x)))
    for y in range(H):
        if cand[y, 0]: stack.append((y, 0))
        if cand[y, W - 1]: stack.append((y, W - 1))
    while stack:
        y, x = stack.pop()
        if bg[y, x] or not cand[y, x]:
            continue
        row = cand[y] & ~bg[y]
        left_false = np.nonzero(~row[:x + 1])[0]
        l = int(left_false[-1]) + 1 if left_false.size else 0
        right_false = np.nonzero(~row[x:])[0]
        r = x + int(right_false[0]) - 1 if right_false.size else W - 1
        bg[y, l:r + 1] = True
        for ny in (y - 1, y + 1):
            if 0 <= ny < H:
                seg = cand[ny, l:r + 1] & ~bg[ny, l:r + 1]
                xs = np.nonzero(seg)[0]
                if xs.size:
                    for sx in xs[np.concatenate(([True], np.diff(xs) > 1))]:
                        stack.append((ny, l + int(sx)))
    return bg


def 누끼깎기(im):
    a = np.asarray(im.convert("RGB")).astype(np.int32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    lum = (R * 299 + G * 587 + B * 114) // 1000
    sat = a.max(axis=2) - a.min(axis=2)
    bg = 배경플러드((sat < 30) & (lum > 140))
    mask = Image.fromarray(((~bg) * 255).astype(np.uint8), "L")
    mask = mask.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(2))
    m = np.power(np.asarray(mask).astype(np.float32) / 255.0, 1.6)
    return Image.fromarray(np.dstack([np.asarray(im.convert("RGB")),
                                      (m * 255).astype(np.uint8)]), "RGBA")


# ── ③ 검은 밴드 완화 — 상단의 어두운 픽셀만 깊은 체리 쪽으로 (광택·눈은 자동 보존)
체리깊은 = np.array([126.0, 21.0, 29.0])   # 딥 #DB3037 과 림 #4F0F10 사이의 유리 그늘색


def 밴드완화(im, 세기):
    if 세기 <= 0:
        return im
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    ys, xs = np.where(al > 128)
    y0, y1 = ys.min(), ys.max()
    h = y1 - y0 + 1

    L = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    yy = np.arange(a.shape[0], dtype=np.float32)[:, None]
    # 머리 꼭대기 1.0 → 몸 32% 지점 0.0 으로 페더 (눈은 36%대라 영향권 밖)
    region = np.clip(1.0 - (yy - y0) / (h * 0.32), 0, 1) ** 1.5
    darkness = np.clip((90.0 - L) / 90.0, 0, 1) ** 0.8
    k = (세기 * region * darkness * (al > 128))[..., None]

    lift = 체리깊은[None, None, :] * (0.55 + 0.45 * (L[..., None] / 90.0))
    out = rgb * (1 - k) + lift * k
    return Image.fromarray(np.clip(np.dstack([out, al]), 0, 255).astype(np.uint8), "RGBA")


def 조립(컷, 밴드세기, 나가는곳, 비율smin=0.50):
    im = Image.open(os.path.join(렌더, 컷 + ".png"))
    print(f"{컷}: 렌더 {im.size[0]}x{im.size[1]}")
    nk = 누끼깎기(im)
    nk = 속수리모듈.속수리(nk)
    nk = 밴드완화(nk, 밴드세기)
    m = 비율모듈.몸측정(nk)
    최종 = 비율모듈.다듬기(비율모듈.밑단압축(nk, m, 비율smin))
    mm = 비율모듈.몸측정(최종)
    print(f"  최종 {mm['w']}x{mm['h']} · 세로/가로 {mm['h']/mm['w']:.3f} · 눈 {(mm['눈y']-mm['y0'])/mm['h']*100:.1f}% · 밴드 {밴드세기}")
    os.makedirs(나가는곳, exist_ok=True)
    최종.save(os.path.join(나가는곳, 컷 + ".png"))
    return 최종


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--컷", default="본체")
    ap.add_argument("--전컷", action="store_true", help="talk 소비 6컷 전부(마스코트변환.py 목록과 동일)")
    ap.add_argument("--밴드", type=float, default=0.0, help="검은 밴드 완화 세기 0~1 (유호 픽으로 고정)")
    ap.add_argument("--나가는곳", default=정본)
    a = ap.parse_args()

    컷들 = ["본체", "본채깜찍", "본체별눈", "본체놀람", "본체눈감음", "본체눈감음2"] if a.전컷 else [a.컷]
    for 컷 in 컷들:
        조립(컷, a.밴드, a.나가는곳)


if __name__ == "__main__":
    main()
