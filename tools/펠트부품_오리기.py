# -*- coding: utf-8 -*-
"""펠트 부품 오리기 — tools/펠트부품GPT굽기.js가 구운 흰 바탕 판에서 부품을 하나씩 오려 투명 webp로 낸다.

쓰는 법
  python tools/펠트부품_오리기.py <판.png> <낼폴더> <이름1,이름2,...> [--시트 확인.jpg]
    원문: docs/디자인/펠트부품/README.md (보통 docs/디자인/펠트부품/raw/<판>.png → docs/디자인/펠트부품/assets/<폴더>)
    이름은 판 위 부품 순서(위→아래, 왼쪽→오른쪽)대로 준다. 개수가 다르면 멈춘다.
    그림자·털 띠의 크기는 판 크기에 맞춘다(2048 판 = 배율 1, 1536 판 = 0.75).
  python tools/펠트부품_오리기.py --고치기 <입력.webp|폴더> <출력.webp|폴더> [--배율 1] [--시트 확인.jpg]
    예전 방식으로 오린 부품의 흰 판을 걷고 그림자를 다시 만든다. 캔버스 크기는 그대로 둔다.
    1536 판(재료)에서 오린 것은 --배율 0.75. 투명한 곳이 없는 결 조각(tex·seam·wide)은 건너뛴다.
  python tools/펠트부품_오리기.py --검사 <webp|폴더 ...> [--배율 1]
    흰 띠 비율을 찍는다. 0.5%를 넘는 부품이 있으면 종료 코드 1.

오리는 법
  1) 흰 바탕과 색 거리가 있는 곳을 찾아 덩어리(부품)를 나눈다.
  2) 덩어리마다 흰색과 분명히 다른 곳을 몸통으로 잡고 안쪽 구멍을 채운다(밝은 섬유가 비쳐 보이지 않게).
     (rembg는 코랄 판 안쪽을 반투명으로 오려 쓰지 않았다, 2026-10-02)
  3) 흰 판 걷기: 2)의 몸통에는 펠트와 바닥 그림자 사이의 흰 바탕(사진의 접지 그림자 언저리)이 알파 255로 딸려 왔다
     (2026-10-02 입장 검사 짐 칸 지적, 637×320 판 아래쪽에서 약 16px). 펠트는 색·털 결이 있고 흰 판은 무채색·매끈하다.
     바깥과 이어진 «채도≤15·밝기≥180·5×5 표준편차≤6.5·고주파 결≤0.9» 픽셀을 걷는다. 크림·흰 펠트(크림 판·우유병·각설탕)는
     빛 받은 털(윗면 모서리)도 매끈해 보여서 밝기 236 넘는 픽셀은 판으로 보지 않는다(판은 그늘이라 그보다 어둡다).
     오목한 곳(눈송이 팔 사이)에 깊이 남은 판은 걷은 판 뒤에 이어진 것만 두 번 더 찾는다.
  4) 섞인 털 풀기: 가장자리의 «펠트 털 + 흰 바탕» 픽셀을 알파와 펠트색으로 되돌린다. 바닥(흰 바탕·그림자)은 무채색이라
     색 있는 펠트는 색 성분으로, 검은 펠트는 밝기로 털의 비율을 잰다. 바깥과 이어진 바탕만 바꾼다(바늘땀·잎맥은 그대로).
     흰·크림 펠트는 바탕과 구별되지 않아 손대지 않는다.
  5) 옛 그림자는 버리고 남은 펠트 모양으로 바닥 그림자를 새로 만든다(빛은 위·왼쪽).
  6) 알파를 손실 압축하지 않는다(webp 무손실). 손실 알파는 바깥이 흰 네모로 살아난다(2026-09-08 실측).
"""
import argparse
import collections
import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage as ndi

그림자색 = np.array([47, 33, 29], np.float32)
띠_한도 = 0.5   # --검사: 이 비율(%)을 넘으면 실패


# ---------- 공통 계산

def _국소표준편차(lum, w, k=5):
    sw = np.maximum(ndi.uniform_filter(w, k), 1e-3)
    m = ndi.uniform_filter(lum * w, k) / sw
    m2 = ndi.uniform_filter(lum * lum * w, k) / sw
    return np.sqrt(np.maximum(m2 - m * m, 0))


def _고주파결(lum, w, s=0.8, k=3):
    """밝기 - 살짝 흐린 밝기(불투명 픽셀만으로)의 절댓값 평균. 털 결은 크고, 사진 바탕은 0에 가깝다."""
    sw = np.maximum(ndi.gaussian_filter(w, s), 1e-3)
    blur = ndi.gaussian_filter(lum * w, s) / sw
    hp = np.abs(lum - blur) * w
    return ndi.uniform_filter(hp, k) / np.maximum(ndi.uniform_filter(w, k), 1e-3)


def _번지기(v, w, sigma):
    """w가 1인 픽셀의 값을 둘레로 번지게(정규화 흐림)."""
    sw = ndi.gaussian_filter(w, sigma)
    if v.ndim == 3:
        out = np.stack([ndi.gaussian_filter(v[..., i] * w, sigma) for i in range(v.shape[-1])], -1)
        return out / np.maximum(sw, 1e-6)[..., None], sw
    return ndi.gaussian_filter(v * w, sigma) / np.maximum(sw, 1e-6), sw


# ---------- 검사

def 흰띠(rgb, a, 배율=1.0, 결=True, 밝기상한=None, 깊이=34, 씨앗=None):
    """바깥(알파<128)과 이어진 «채도≤15·밝기≥180·5×5 표준편차≤6.5» 불투명 픽셀(바깥에서 깊이 px 안쪽까지).
    결=True면 고주파 결≤0.9도 본다(흰 펠트의 털을 판으로 잘못 잡지 않게).
    씨앗을 주면 그 둘레(3px)에서 이어진 것만 찾는다(걷은 판 뒤에 이어진 판)."""
    lum = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    opaque = a >= 250
    w = opaque.astype(np.float32)
    cand = opaque & (sat <= 15) & (lum >= 180) & (_국소표준편차(lum, w) <= 6.5)
    if 밝기상한 is not None:
        cand &= lum <= 밝기상한
    if 결:
        cand &= _고주파결(lum, w) <= 0.9
    dist_out = ndi.distance_transform_edt(a >= 128)
    cand &= dist_out <= 깊이 * 배율
    seed = cand & (dist_out <= 3) if 씨앗 is None else cand & ndi.binary_dilation(씨앗, iterations=3)
    lab, n = ndi.label(cand)
    if not n:
        return np.zeros_like(cand)
    ids = np.unique(lab[seed])
    return np.isin(lab, ids[ids > 0])


def 펠트종류(rgb, a, 배율=1.0):
    """몸통 안쪽(가장자리에서 22px 넘게 들어간 곳)의 펠트: '색'(코랄·연코랄·청금석·하늘색·초록·갈색),
    '짙음'(검정), '밝은무채'(크림·흰색 — 우유병·각설탕·크림 판), '기타'."""
    d = ndi.distance_transform_edt(a >= 128)
    deep = (a >= 250) & (d > 22 * 배율)
    if deep.sum() < 100:
        deep = a >= 250
    if not deep.any():
        return '기타'
    c = rgb[deep]
    lum = c.mean(-1)
    ch = c - lum[:, None]
    if np.percentile(np.sqrt((ch * ch).sum(-1)), 75) > 30:
        return '색'
    if np.median(lum) < 90:
        return '짙음'
    return '밝은무채' if np.median(lum) > 150 else '기타'


def _밝기상한(종류):
    # 크림·흰 펠트는 빛 받은 털(윗면 모서리·우유병 옆)도 매끈해 보인다. 판은 그늘이라 밝기 236 아래다(실측 95%가 234 이하)
    return 236 if 종류 == '밝은무채' else None


def 흰띠_비율(rgba, 배율=1.0):
    """(검사 기준 %, 결을 안 보는 옛 기준 %). 검사 기준은 고치기와 같은 판단(결, 크림·흰 펠트면 밝기 상한)."""
    rgb, a = rgba[..., :3], rgba[..., 3]
    op = max(int((a >= 250).sum()), 1)
    상한 = _밝기상한(펠트종류(rgb, a, 배율))
    새 = 흰띠(rgb, a, 배율, 결=True, 밝기상한=상한).sum() / op * 100
    옛 = 흰띠(rgb, a, 배율, 결=False).sum() / op * 100
    return float(새), float(옛)


# ---------- 고치기

def _옛그림자(rgb, a):
    """예전 오리기가 칠한 바닥 그림자(반투명 단색, 배경 부품은 색 보정된 단색)와 거의 투명한 검은 찌꺼기."""
    semi = (a > 3) & (a < 120)
    out = np.zeros(a.shape, bool)
    if semi.sum() > 50:
        cols = rgb[semi].astype(np.int64)
        key = cols[:, 0] * 65536 + cols[:, 1] * 256 + cols[:, 2]
        vals, cnt = np.unique(key, return_counts=True)
        if cnt.max() > 0.3 * semi.sum():
            top = vals[np.argmax(cnt)]
            c = np.array([top // 65536, (top // 256) % 256, top % 256], np.float32)
            out = (a < 250) & (np.abs(rgb - c).max(-1) <= 10)
    return out | ((a > 0) & (a < 60) & (rgb.max(-1) <= 24))


def _섞인털풀기(rgb, body, band, outside, 종류, 배율=1.0, 띠=16, 바탕밝기=238.0):
    """가장자리 띠(바깥·걷은 판에서 띠 px)의 «펠트 털 + 바닥» 픽셀을 알파와 펠트색으로 되돌린다.
    '색' 펠트는 색 성분으로, '짙음' 펠트는 밝기로 털의 비율을 잰다. 크림·흰 펠트는 바탕과 구별되지 않아 손대지 않는다."""
    al = np.ones(body.shape, np.float32)
    if 종류 not in ('색', '짙음'):
        return al, rgb, '없음'
    edge_src = outside | band
    d_edge = ndi.distance_transform_edt(~edge_src)
    zone = body & (d_edge <= 띠 * 배율)
    if not zone.any():
        return al, rgb, '-'
    lum = rgb.mean(-1)
    ch = rgb - lum[..., None]
    nch = np.sqrt((ch * ch).sum(-1))
    deep = body & (d_edge > (띠 + 6) * 배율)
    if deep.sum() < 200:
        deep = body & (d_edge > 띠 * 배율 * 0.5)
    if deep.sum() < 50:
        return al, rgb, '-'
    if 종류 == '색':
        방식 = '색'
        색세기 = float(np.percentile(nch[deep], 75))
        strong = (deep & (nch > 0.6 * 색세기)).astype(np.float32)
        chF, wf = _번지기(ch, strong, 8 * 배율)
        lumF, _ = _번지기(lum, strong, 8 * 배율)
        t = (ch * chF).sum(-1) / np.maximum((chF * chF).sum(-1), 1e-6)
        Frgb = np.clip(lumF[..., None] + chF, 0, 255)
    else:
        방식 = '밝기'
        darkp = (deep & (lum < np.median(lum[deep]) + 40)).astype(np.float32)
        lumF, wf = _번지기(lum, darkp, 8 * 배율)
        Frgb, _ = _번지기(rgb, darkp, 8 * 배율)
        bl, bw = _번지기(lum, band.astype(np.float32), 4 * 배율)
        k = np.clip(bw / 0.02, 0, 1)
        lumB = bl * k + 바탕밝기 * (1 - k)
        t = (lumB - lum) / np.maximum(lumB - lumF, 1e-6)
    t = np.clip(t, 0, 1)
    # 바깥(걷은 판)과 이어진 «바탕 같은» 픽셀과 그 둘레만 바꾼다
    bgl = zone & (t < 0.5) & (wf > 1e-4)
    lab, n = ndi.label(bgl)
    conn = np.zeros_like(bgl)
    if n:
        ids = np.unique(lab[bgl & ndi.binary_dilation(edge_src)])
        conn = np.isin(lab, ids[ids > 0])
    trans = zone & ndi.binary_dilation(conn, iterations=max(1, int(round(2 * 배율))))
    al = np.where(trans, t, 1.0).astype(np.float32)
    # 색: 무채색 바닥을 빼고 되돌리되, 털이 거의 없는 픽셀은 그 자리 펠트색 쪽으로
    a1 = np.maximum(al, 0.25)
    g = np.clip((lum - a1 * lumF) / np.maximum(1 - a1, 1e-3), 0, 255) if 방식 == '색' else lumB
    un = np.clip((rgb - (1 - a1[..., None]) * g[..., None]) / a1[..., None], 0, 255)
    wgt = np.clip((al - 0.15) / 0.35, 0, 1)[..., None]
    un = un * wgt + Frgb * (1 - wgt)
    return al, np.where(trans[..., None], un, rgb), 방식


def 흰판걷기(rgba, 배율=1.0, 옛그림자=None):
    """rgba: float32 (H,W,4). 흰 판을 걷고 섞인 털을 풀고 그림자를 다시 만든다. 캔버스 크기는 그대로.
    돌려주는 것: (uint8 RGBA, 통계)"""
    rgb, a = rgba[..., :3].astype(np.float32).copy(), rgba[..., 3].astype(np.float32)
    h, w = a.shape
    lum = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    opaque = a >= 250
    종류 = 펠트종류(rgb, a, 배율)
    상한 = _밝기상한(종류)
    band = 흰띠(rgb, a, 배율, 결=True, 밝기상한=상한)
    # 오목한 곳(눈송이 팔 사이)처럼 깊이 남은 판: 걷은 판을 바깥으로 보고, 그 뒤에 이어진 것만 두 번 더 찾는다
    for _ in range(2):
        더 = 흰띠(rgb, np.where(band, 0.0, a), 배율, 결=True, 밝기상한=상한, 씨앗=band) & ~band
        if 더.sum() < 20:
            break
        band |= 더
    # 판과 펠트가 맞닿은 줄(결 창이 펠트에 걸쳐 후보에서 빠진 픽셀)을 무채·밝은 픽셀로만 2px 넓힌다
    for _ in range(2):
        band = ndi.binary_dilation(band) & opaque & (sat <= 18) & (lum >= 170) & (lum <= (상한 or 255) + 4)

    # 몸통: 불투명 - 흰 판, 부스러기 정리, 큰 덩어리만(커피콩처럼 여럿이면 모두), 안쪽 구멍 메우기(고리 가운데는 그대로)
    body = ndi.binary_opening(opaque & ~band, iterations=1)
    lab, n = ndi.label(body)
    if n > 1:
        sizes = np.asarray(ndi.sum(body, lab, range(1, n + 1)))
        body = np.isin(lab, np.flatnonzero(sizes >= 0.02 * sizes.max()) + 1)
    filled = ndi.binary_fill_holes(body)
    holes = filled & ~body
    if holes.any():
        hl, hn = ndi.label(holes)
        투명 = np.asarray(ndi.mean((a < 128).astype(np.float32), hl, range(1, hn + 1)))
        filled &= ~np.isin(hl, np.flatnonzero(투명 > 0.5) + 1)
    body = filled

    풀린, rgb, 방식 = _섞인털풀기(rgb, body, band, a < 128, 종류, 배율)

    # 털 보풀(몸통 가까이의 반투명 펠트색)은 살리고 옛 그림자는 버린다
    if 옛그림자 is None:
        옛그림자 = _옛그림자(rgb, a)
    near = ndi.binary_dilation(body, iterations=max(2, int(round(3 * 배율))))
    fuzz = (a > 0) & (a < 250) & ~옛그림자 & near & ~band
    alpha = np.where(body, 255.0 * 풀린, 0.0)
    alpha = np.where(fuzz, a, alpha)
    # 걷은 자리의 계단을 부드럽게
    soft = ndi.gaussian_filter(body.astype(np.float32), 0.7 * 배율) * 255
    edge = body & ~ndi.binary_erosion(body, iterations=2)
    alpha = np.where(edge, np.minimum(alpha, np.maximum(soft, 140)), alpha)
    # 몸통과 떨어진 작은 알파 조각(털끝 잡티)을 지운다
    vis = alpha >= 26
    lab, n = ndi.label(vis)
    if n > 1:
        sizes = np.asarray(ndi.sum(vis, lab, range(1, n + 1)))
        alpha = np.where(np.isin(lab, np.flatnonzero(sizes < max(30, 0.002 * sizes.max())) + 1), 0.0, alpha)

    # 새 바닥 그림자: 펠트 모양을 아래로 조금 내려 흐린 것 + 맞닿는 곳의 짙은 그림자(빛은 위·왼쪽)
    m = (alpha / 255.0).astype(np.float32)
    sh = ndi.gaussian_filter(ndi.shift(m, (5 * 배율, 1.5 * 배율), order=1, mode='constant'), 7 * 배율)
    contact = ndi.gaussian_filter(ndi.shift(m, (2 * 배율, 0.5 * 배율), order=1, mode='constant'), 2.2 * 배율)
    shadow_a = np.clip(sh * 0.30 + contact * 0.16, 0, 0.42)
    # 그림 테두리에서는 그림자를 0으로 흐린다(잘린 줄이 생기지 않게)
    yy = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    xx = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    shadow_a = shadow_a * np.clip(np.minimum(yy, xx) / (6.0 * 배율), 0, 1)

    fa = alpha / 255.0
    sa = shadow_a * (1 - fa)
    oa = fa + sa
    col = (rgb * fa[..., None] + 그림자색 * sa[..., None]) / np.maximum(oa[..., None], 1e-6)
    out = np.clip(np.dstack([col, oa * 255]) + 0.5, 0, 255).astype(np.uint8)
    out[..., :3][out[..., 3] == 0] = 0
    return out, {'걷은판': int(band.sum()), '펠트': 종류, '털풀기': 방식}


# ---------- 오리기

def 판나누기(im):
    """흰 바탕 판에서 부품 덩어리의 상자를 위→아래, 왼쪽→오른쪽 순서로."""
    a = np.asarray(im).astype(np.int32)   # int16이면 어두운 펠트에서 제곱이 넘쳤다(2026-10-02)
    fg = np.sqrt(((255 - a) ** 2).sum(axis=2)) > 18
    # 가림판을 넓혀 보풀까지 한 덩어리로
    mask = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(21))) > 0
    H, W = mask.shape
    label = np.zeros((H, W), np.int32); boxes = []; cur = 0
    for y in range(0, H, 3):
        for x in range(0, W, 3):
            if mask[y, x] and label[y, x] == 0:
                cur += 1; q = collections.deque([(y, x)]); label[y, x] = cur; y0 = y1 = y; x0 = x1 = x; n = 0
                while q:
                    cy, cx = q.popleft(); n += 1
                    y0, y1, x0, x1 = min(y0, cy), max(y1, cy), min(x0, cx), max(x1, cx)
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and label[ny, nx] == 0:
                            label[ny, nx] = cur; q.append((ny, nx))
                if n > 4000:
                    boxes.append((y0, x0, y1, x1))
    # 줄 단위 정렬: 위→아래, 같은 줄은 왼쪽→오른쪽
    boxes.sort(key=lambda b: b[0])
    rows = []
    for b in boxes:
        if rows and abs(rows[-1][0][0] - b[0]) < 140:
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for r in rows for b in sorted(r, key=lambda b: b[1])]


def 오리기(crop):
    """흰 바탕 사진 조각 → (RGBA float32, 옛 그림자 마스크). 흰 판 걷기 전 단계."""
    c = np.asarray(crop).astype(np.float32)
    d = np.sqrt(((255 - c) ** 2).sum(axis=2))   # 흰색과의 거리
    # 몸통: 흰색과 분명히 다른 곳을 잇고 안쪽 구멍을 채운다(밝은 섬유가 비쳐 보이지 않게)
    # 흰 털(우유병·각설탕)은 바탕과 색이 거의 같다 → 털의 «결»(작은 범위의 밝기 흔들림)로 몸통을 더 잡는다
    lum = c.mean(axis=2)
    m1 = ndi.uniform_filter(lum, 7); m2 = ndi.uniform_filter(lum * lum, 7)
    tex = np.sqrt(np.clip(m2 - m1 * m1, 0, None))
    seed = (d > 34) | ((d > 7) & (tex > 3.2))
    core = ndi.binary_fill_holes(ndi.binary_closing(seed, iterations=4))
    core = ndi.binary_opening(core, iterations=2)
    core = ndi.binary_erosion(core, iterations=1)
    lab, n = ndi.label(core)
    if n > 1:
        sizes = ndi.sum(core, lab, range(1, n + 1)); core = lab == (1 + int(np.argmax(sizes)))
    # 가장자리 보풀: 흰색과의 거리로 부드럽게(몸통 근처 띠 안에서만)
    ring = ndi.binary_dilation(core, iterations=14)
    alpha = np.where(core, 1.0, np.where(ring, np.clip((d - 6) / 70.0, 0, 1), 0.0))
    alpha = ndi.gaussian_filter(alpha, 0.5); alpha[core] = 1.0
    # 흰 번짐 걷기: 관측색 = a*F + (1-a)*흰색 → F를 되돌린다
    a3 = np.clip(alpha, 1e-3, 1)[..., None]
    F = np.clip((c - (1 - a3) * 255) / a3, 0, 255)
    F = np.where(alpha[..., None] > 0.995, c, F)
    # 몸통 밖의 무채색 픽셀은 «흰 바탕이 어두워진 것»(옛 그림자) — 흰 판 걷기에서 버리고 새로 만든다
    sat = c.max(axis=2) - c.min(axis=2)
    shade = (~core) & ring & (sat < 16)
    alpha = np.where(shade, 0.0, alpha)
    return np.dstack([F, alpha * 255]).astype(np.float32), shade


# ---------- 확인 시트

def 시트(그림들, dst, 높이=150):
    """부품마다 한 줄: [어두운 | 종이 | 코랄] 바탕. 흰 띠가 0.05% 넘게 남으면 앞에 남색 칸을 두고 빨갛게 표시한다."""
    바탕들 = [(27, 26, 23), (243, 236, 224), (249, 104, 89)]
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
    except Exception:
        font = None
    rows = []
    for 이름, arr, 배율 in 그림들:
        f = arr.astype(np.float32)
        a = f[..., 3:4] / 255.0
        cells = []
        band = 흰띠(f[..., :3], f[..., 3], 배율, 결=True, 밝기상한=_밝기상한(펠트종류(f[..., :3], f[..., 3], 배율)))
        if band.sum() > 0.0005 * max(int((f[..., 3] >= 250).sum()), 1):
            mark = f[..., :3] * a + np.array((40, 52, 90), np.float32) * (1 - a)
            mark[band] = (255, 40, 40)
            cells.append(mark.astype(np.uint8))
        for bg in 바탕들:
            cells.append((f[..., :3] * a + np.array(bg, np.float32) * (1 - a)).astype(np.uint8))
        ims = []
        for c in cells:
            im = Image.fromarray(c)
            ims.append(im.resize((max(1, round(im.width * 높이 / im.height)), 높이), Image.LANCZOS))
        rows.append((이름, ims))
    W = max(sum(i.width + 10 for i in ims) for _, ims in rows) + 230
    H = len(rows) * (높이 + 10) + 10
    sheet = Image.new('RGB', (W, H), (128, 128, 128))
    dr = ImageDraw.Draw(sheet)
    y = 10
    for 이름, ims in rows:
        dr.text((10, y + 높이 // 2 - 10), 이름, fill=(255, 255, 255), font=font)
        x = 230
        for im in ims:
            sheet.paste(im, (x, y)); x += im.width + 10
        y += 높이 + 10
    sheet.save(dst, quality=92)


# ---------- 실행

def _저장(arr, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    Image.fromarray(arr, 'RGBA').save(path, 'WEBP', lossless=True, quality=100, method=6)


def _읽기(path):
    with Image.open(path) as im:
        return np.asarray(im.convert('RGBA')).astype(np.float32)


def _투명한곳있나(path):
    with Image.open(path) as im:
        if im.mode not in ('RGBA', 'LA', 'PA') and 'transparency' not in im.info:
            return False
        return bool(np.asarray(im.convert('RGBA'))[..., 3].min() < 255)


def _모으기(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            out += sorted(glob.glob(os.path.join(p, '*.webp')))
        else:
            out.append(p)
    return out


def 오리기_실행(판, 낼폴더, 이름들, 시트경로=None):
    with Image.open(판) as f:
        im = f.convert('RGB')
    order = 판나누기(im)
    if len(order) != len(이름들):
        sys.exit(f'부품 수가 다르다: 판 {len(order)}개, 이름 {len(이름들)}개')
    배율 = max(im.size) / 2048.0
    W, H = im.size
    report, 시트감 = [], []
    for (y0, x0, y1, x1), name in zip(order, 이름들):
        pad = 40   # 새 그림자가 들어갈 자리까지
        box = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))
        rgba, shade = 오리기(im.crop(box))
        out, st = 흰판걷기(rgba, 배율, 옛그림자=shade)
        bb = Image.fromarray(out[..., 3]).point(lambda v: 255 if v > 2 else 0).getbbox()
        if bb:
            out = out[bb[1]:bb[3], bb[0]:bb[2]]
        path = os.path.join(낼폴더, f'{name}.webp')
        _저장(out, path)
        새, 옛 = 흰띠_비율(out.astype(np.float32), 배율)
        report.append({'이름': name, '크기': [out.shape[1], out.shape[0]], '흰띠%': round(새, 2), **st})
        시트감.append((name, out, 배율))
    if 시트경로:
        시트(시트감, 시트경로)
    print(json.dumps(report, ensure_ascii=False))


def 고치기_실행(입력, 출력, 배율=1.0, 시트경로=None):
    if os.path.isdir(입력):
        pairs = [(p, os.path.join(출력, os.path.basename(p))) for p in sorted(glob.glob(os.path.join(입력, '*.webp')))]
    else:
        pairs = [(입력, 출력)]
    시트감 = []
    for src, dst in pairs:
        if not _투명한곳있나(src):
            print(f'건너뜀(투명한 곳 없음) {src}')
            continue
        rgba = _읽기(src)
        전, _ = 흰띠_비율(rgba, 배율)
        out, st = 흰판걷기(rgba, 배율)
        _저장(out, dst)
        후, 옛 = 흰띠_비율(out.astype(np.float32), 배율)
        print(f'{전:6.2f}% → {후:5.2f}%  (결을 안 보는 옛 기준 {옛:5.2f}%)  펠트 {st["펠트"]}  털풀기 {st["털풀기"]}  {dst}')
        시트감.append((os.path.basename(dst), out, 배율))
    if 시트경로 and 시트감:
        시트(시트감, 시트경로)


def 검사_실행(paths, 배율=1.0):
    나쁨 = 0
    for p in _모으기(paths):
        if not _투명한곳있나(p):
            continue
        새, 옛 = 흰띠_비율(_읽기(p), 배율)
        표 = '걸림' if 새 > 띠_한도 else '통과'
        나쁨 += 새 > 띠_한도
        print(f'{표}  흰 띠 {새:5.2f}%  (결을 안 보는 옛 기준 {옛:5.2f}%)  {p}')
    return 1 if 나쁨 else 0


def main():
    ap = argparse.ArgumentParser(description='펠트 부품 오리기·흰 판 걷기·흰 띠 검사 (원문: docs/디자인/펠트부품/README.md)')
    ap.add_argument('대상', nargs='+')
    ap.add_argument('--고치기', action='store_true', help='이미 오린 부품을 고친다: <입력> <출력>')
    ap.add_argument('--검사', action='store_true', help='흰 띠 비율만 찍는다: <webp|폴더 ...>')
    ap.add_argument('--배율', type=float, default=None, help='2048 판 = 1, 1536 판 = 0.75 (오릴 때는 판 크기로 정한다)')
    ap.add_argument('--시트', default=None, help='어두운·종이·코랄 바탕 확인 시트 경로(.jpg)')
    a = ap.parse_args()
    if a.검사:
        sys.exit(검사_실행(a.대상, a.배율 or 1.0))
    if a.고치기:
        if len(a.대상) != 2:
            sys.exit('--고치기 <입력> <출력>')
        고치기_실행(a.대상[0], a.대상[1], a.배율 or 1.0, a.시트)
        return
    if len(a.대상) != 3:
        sys.exit('python tools/펠트부품_오리기.py <판.png> <낼폴더> <이름1,이름2,...>')
    오리기_실행(a.대상[0], a.대상[1], a.대상[2].split(','), a.시트)


if __name__ == '__main__':
    main()
