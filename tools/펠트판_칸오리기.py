# -*- coding: utf-8 -*-
"""한 판에 구운 펠트 그림(3×2 등)을 조각마다 오려 투명 webp로 낸다(영상마다 GPT 이미지 2.5 구독으로 굽는 판, 10-13 결정 · 만족 사례 S17). 조각 곁의 소품·색종이·땀방울·김도 살린다.
가장자리 털 풀기·흰 판 걷기는 저장소 tools/펠트부품_오리기.py의 함수를 그대로 쓴다(그 도구는 가장 큰 덩어리 하나만 남긴다).

python -X utf8 tools/펠트판_칸오리기.py <판.png> <낼폴더> <열> <행> 이름1,이름2,...          칸을 고르게 나눈 판
python -X utf8 tools/펠트판_칸오리기.py <판.png> <낼폴더> 상자 "x0,y0,x1,y1;..." 이름1,...    칸이 고르지 않은 판(판 너비·높이에 대한 비율)
끝에 --재기를 붙이면 오리지 않고 덩어리 목록만 찍는다. 환경 변수 CUT_VIEW=이름1,이름2 를 주면 단계별 가림판(_보기_*.png)을 낸다.
결과 폴더에 _확인시트.jpg(어두운·종이·코랄 바탕)가 생긴다 — 화면에 넣기 전에는 놓일 바탕색에 실제 크기로 얹어 2배로 확대해 본다.

덩어리는 판 전체에서 한 번 찾고, 픽셀이 가장 많이 든 칸(상자)에 붙인다.
바닥 그림자 조각(무채색 · 밝음 · 털 결 없음)과 작은 먼지는 버린다. 흰 펠트(김·눈알)는 결이 있어 남는다.
"""
import importlib.util, os, sys, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

TOOL = pathlib.Path(__file__).resolve().parent / '펠트부품_오리기.py'
spec = importlib.util.spec_from_file_location('felt_cut', TOOL)
fc = importlib.util.module_from_spec(spec); spec.loader.exec_module(fc)

args = [a for a in sys.argv[1:] if a != '--재기']
measure = '--재기' in sys.argv
src, out = args[0], pathlib.Path(args[1])
if args[2] == '상자':
    boxes = [tuple(float(v) for v in b.split(',')) for b in args[3].split(';')]
else:
    cols, rows = int(args[2]), int(args[3])
    boxes = [(cx / cols, ry / rows, (cx + 1) / cols, (ry + 1) / rows) for ry in range(rows) for cx in range(cols)]
names = args[4].split(',')
assert len(names) == len(boxes), '이름 수가 칸 수와 다르다'

im = Image.open(src).convert('RGB')
W, H = im.size
scale = max(W, H) / 2048.0

# 판 전체에서 몸통 덩어리 찾기(fc.오리기와 같은 기준)
c = np.asarray(im).astype(np.float32)
d = np.sqrt(((255 - c) ** 2).sum(axis=2))
lum = c.mean(axis=2)
m1 = ndi.uniform_filter(lum, 7); m2 = ndi.uniform_filter(lum * lum, 7)
tex = np.sqrt(np.clip(m2 - m1 * m1, 0, None))
sat = c.max(axis=2) - c.min(axis=2)
seed = (d > 34) | ((d > 7) & (tex > 3.2))
core = ndi.binary_fill_holes(ndi.binary_closing(seed, iterations=4))
core = ndi.binary_opening(core, iterations=2)
core = ndi.binary_erosion(core, iterations=1)
lab, n = ndi.label(core)
idx = np.arange(1, n + 1)
area = ndi.sum(core, lab, idx)
m_sat = np.array(ndi.median(sat, lab, idx))
m_lum = np.array(ndi.median(lum, lab, idx))
m_tex = np.array(ndi.median(tex, lab, idx))
shadowish = (m_sat < 14) & (m_lum > 150) & (m_tex < 2.6)
keep = (area >= 60 * scale * scale) & ~shadowish

# 덩어리마다 픽셀이 가장 많이 든 칸
box_id = np.full((H, W), -1, np.int32)
for k, (x0, y0, x1, y1) in enumerate(boxes):
    box_id[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = k
sel = (lab > 0) & (box_id >= 0)
cnt = np.bincount(lab[sel] * len(boxes) + box_id[sel], minlength=(n + 1) * len(boxes)).reshape(n + 1, len(boxes))
owner = np.where(cnt.max(1) > 0, cnt.argmax(1), -1)

if measure:
    cy = ndi.center_of_mass(core, lab, idx)
    for i in idx:
        if area[i - 1] < 60 * scale * scale:
            continue
        y, x = cy[i - 1]
        print(f'#{i:3d} 칸 {names[owner[i]] if owner[i] >= 0 else "-":14s} 넓이 {int(area[i - 1]):7d}  중심 {x / W:.3f},{y / H:.3f}'
              f'  채도 {m_sat[i - 1]:5.1f} 밝기 {m_lum[i - 1]:5.1f} 결 {m_tex[i - 1]:4.1f}  {"버림(그림자)" if shadowish[i - 1] else ""}')
    sys.exit(0)

def 매끈함(lum, w):
    """무채색 픽셀(w)끼리만 잰 매끈함: 5×5 표준편차 ≤ 6.5, 고주파 결을 5×5로 한 번 더 평균해 ≤ 0.9.
    좁은 틈에서는 옆 펠트의 결이 섞여 바닥도 거칠게 나왔다(10-13 손 사이)."""
    std = fc._국소표준편차(lum, w)
    hp = ndi.uniform_filter(fc._고주파결(lum, w) * w, 5) / np.maximum(ndi.uniform_filter(w, 5), 1e-3)
    return (std <= 6.5) & (hp <= 0.9)


def 바닥띠(rgb, a):
    """무채색·밝은 불투명 덩어리(채도 ≤ 34, 밝기 ≥ 150) 가운데 매끈한 픽셀이 60% 넘는 덩어리는 바닥이다
    (펠트 사이로 보이는 판, 펠트 빛이 비쳐 색기가 도는 그림자). 바깥과 닿지 않은 갇힌 틈(두 발 사이)도 잡는다.
    실측(10-13 GPT 판): 바닥 덩어리 매끈비 0.74~0.85, 흰 펠트(눈알·만두·김·크림 사람) 0.04~0.28.
    흰 펠트에 둘러싸인 매끈한 곳(만두 사이 그늘)은 남긴다 — 지우면 만두 더미에 구멍이 났다."""
    lum = rgb.mean(-1); s = rgb.max(-1) - rgb.min(-1)
    achro = (a >= 250) & (s <= 34) & (lum >= 150)
    smooth = achro & 매끈함(lum, achro.astype(np.float32))
    # 흰 펠트에 둘러싸인 매끈한 곳은 펠트 사이 그늘이다(만두 사이) → 둘레 3px 가운데 흰 펠트가 40% 넘으면 남긴다
    white = achro & ~smooth
    floor = np.zeros_like(achro)

    def 흰둘레(m):
        rim = ndi.binary_dilation(m, iterations=3) & ~m
        return rim.any() and (white & rim).sum() / rim.sum() > 0.4

    # 크기: 30px 넘고, 바깥에 닿거나 300px 넘는 것만(작은 매끈한 점 — 흰자·시계판 안 — 을 걷으면 바늘구멍이 났다)
    edge = ndi.binary_dilation(a < 128, iterations=3)
    lab2, n2 = ndi.label(achro)
    if n2:
        ids2 = np.arange(1, n2 + 1)
        ratio = np.asarray(ndi.mean(smooth.astype(np.float32), lab2, ids2))
        size2 = np.asarray(ndi.sum(achro, lab2, ids2))
        for i in ids2[(ratio >= 0.6) & (size2 >= 30)]:
            m = lab2 == i
            if (size2[i - 1] >= 300 or (m & edge).any()) and not 흰둘레(m):
                floor |= m
    # 좁은 틈(두 손·두 발 사이)의 바닥은 살구색 펠트 빛을 세게 받아 채도가 35~60까지 오른다. 살구 펠트(채도 ~100)는 결이 세다
    # → 채도 60까지의 옅은 픽셀끼리 잰 매끈한 덩어리(30px 넘게)도 바닥으로 본다. 경계 2px의 옅은 픽셀도 함께 걷는다.
    # 앞에서 찾은 바닥이나 바깥에 닿은 것만 본다(몸통 안 얼굴 — 흰자·시계판·별 눈 — 이 구멍 났다)
    pale = (a >= 250) & (s <= 60) & (lum >= 150)
    near = ndi.binary_dilation(floor | (a < 128), iterations=3)
    psmooth = ndi.binary_opening(pale & 매끈함(lum, pale.astype(np.float32)), iterations=1)
    lab3, n3 = ndi.label(psmooth)
    if n3:
        ids3 = np.arange(1, n3 + 1)
        size3 = np.asarray(ndi.sum(psmooth, lab3, ids3))
        for i in ids3[size3 >= 30]:
            m = lab3 == i
            if (m & near).any() and not 흰둘레(m):
                floor |= m
    return ndi.binary_dilation(floor, iterations=2) & (pale | floor) & ~white


def 밑단(rgb, a):
    """색 있는 펠트 바로 아래(14px 안) 가장자리의 무채색·밝은 픽셀(바닥에 닿은 털과 비친 바닥, 결이 있어 바닥띠에 안 걸림)을
    «그 픽셀 채도 ÷ 위 펠트 채도»만큼만 남긴다. 아래쪽만 보므로 위·옆으로 드러난 흰 펠트(김·만두 윗면·눈알)는 그대로."""
    lum = rgb.mean(-1); s = rgb.max(-1) - rgb.min(-1)
    felt = (a >= 250) & (s >= 60)
    fs, _w = fc._번지기(s, felt.astype(np.float32), 4 * scale)
    above = np.zeros_like(felt)
    for k in range(1, int(round(14 * scale)) + 1):
        above[k:] |= felt[:-k]
    outside = a < 128
    dist_out = ndi.distance_transform_edt(~outside)
    cand = (a > 0) & (s < 35) & (lum > 150) & above & (dist_out <= 14 * scale)
    lab2, n2 = ndi.label(cand)
    if not n2:
        return a, np.zeros_like(cand)
    ids = np.unique(lab2[cand & (dist_out <= 2)])
    conn = np.isin(lab2, ids[ids > 0])
    t = np.clip((s - 8) / np.maximum(fs - 8, 20), 0, 1)
    return np.where(conn, a * t, a), conn


def 한덩어리(comp, other, 보기=None):
    """덩어리 하나(comp) → (uint8 RGBA, 왼쪽 위 (y, x), 통계). 다른 덩어리(other)는 가장자리 띠에 넣지 않는다."""
    yy, xx = np.where(comp)
    pad = 40   # 새 그림자가 들어갈 자리까지
    y0, y1 = max(0, yy.min() - pad), min(H, yy.max() + pad + 1)
    x0, x1 = max(0, xx.min() - pad), min(W, xx.max() + pad + 1)
    sl = (slice(y0, y1), slice(x0, x1))
    cc, dd, gg = c[sl], d[sl], comp[sl]
    ring = ndi.binary_dilation(gg, iterations=14) & ~ndi.binary_dilation(other[sl], iterations=3)
    alpha = np.where(gg, 1.0, np.where(ring, np.clip((dd - 6) / 70.0, 0, 1), 0.0))
    alpha = ndi.gaussian_filter(alpha, 0.5); alpha[gg] = 1.0
    a3 = np.clip(alpha, 1e-3, 1)[..., None]
    F = np.clip((cc - (1 - a3) * 255) / a3, 0, 255)
    F = np.where(alpha[..., None] > 0.995, cc, F)
    # 몸통 밖 무채색 중 매끈한 것만 옛 그림자로 버린다(흰 펠트의 결 있는 털은 남겨 가장자리가 찢겨 보이지 않게)
    ach = ring & ~gg & (sat[sl] < 16)
    shade = ach & 매끈함(cc.mean(-1), ach.astype(np.float32))
    a255 = np.where(shade, 0.0, alpha) * 255
    floor = 바닥띠(F, a255)
    a255 = np.where(floor, 0.0, a255); shade |= floor
    a255, 밑 = 밑단(F, a255)
    arr, st = fc.흰판걷기(np.dstack([F, a255]).astype(np.float32), scale, 옛그림자=shade)
    # 흰판걷기는 색 펠트 부품(노란 상)에 붙은 흰 펠트의 그늘(만두 사이·김 안쪽)도 판으로 보고 걷었다 → 되살린다:
    # 몸통이었고 바닥띠가 아니며, 둘레 3px의 40% 넘게가 흰 펠트(무채색·결 있음)이거나 75% 넘게가 아직 불투명한 곳(부품 안에 갇힌 구멍)
    lost = gg & (arr[..., 3] < 250) & ~floor & ~밑   # 반투명으로 풀린 둘레까지(밑단이 걷은 것은 빼고)
    solid = arr[..., 3] >= 250
    back = np.zeros_like(lost)
    if lost.any():
        lum_c = cc.mean(-1); s_c = cc.max(-1) - cc.min(-1)
        achro_c = gg & (s_c <= 34) & (lum_c >= 150)
        white = achro_c & ~매끈함(lum_c, achro_c.astype(np.float32))
        labL, nL = ndi.label(lost)
        for j in range(1, nL + 1):
            m = labL == j
            rim = ndi.binary_dilation(m, iterations=3) & ~m
            if (white & rim).sum() > 0.4 * rim.sum() or (solid & rim).sum() > 0.75 * rim.sum():
                back |= m
        if back.any():
            arr = arr.copy()
            arr[back, :3] = np.clip(cc[back] + 0.5, 0, 255).astype(np.uint8)
            arr[back, 3] = 255
    if 보기:   # 단계별 가림판: 빨강 = 바닥띠, 초록 = 옛 그림자, 파랑 = 흰판걷기가 걷은 몸통(되살리지 않은 것), 노랑 = 되살림
        v = (cc * 0.5).astype(np.uint8)
        v[floor] = (255, 40, 40); v[shade & ~floor] = (40, 220, 40)
        v[lost & ~back] = (60, 90, 255); v[back] = (255, 220, 0)
        Image.fromarray(v).save(보기)
    st['바닥띠'] = int(floor.sum()); st['밑단'] = int(밑.sum()); st['되살림'] = int(back.sum())
    return arr, (y0, x0), st


out.mkdir(parents=True, exist_ok=True)
kept = [[i for i in idx if owner[i] == k and keep[i - 1]] for k in range(len(boxes))]
allkept = np.isin(lab, [i for ids in kept for i in ids])
시트감 = []
for k, name in enumerate(names):
    # 덩어리마다 따로 걷는다(흰판걷기는 가장 큰 것의 2% 밑 조각을 버려 색종이가 사라졌다) → 큰 것부터 한 캔버스에 겹친다
    parts = []
    for i in sorted(kept[k], key=lambda i: -area[i - 1]):
        comp = lab == i
        보기 = str(out / f'_보기_{name}_{i}.png') if name in os.environ.get('CUT_VIEW', '').split(',') else None
        arr, (py, px), st = 한덩어리(comp, allkept & ~comp, 보기)
        parts.append((arr, py, px, st))
    gy0 = min(p[1] for p in parts); gx0 = min(p[2] for p in parts)
    gy1 = max(p[1] + p[0].shape[0] for p in parts); gx1 = max(p[2] + p[0].shape[1] for p in parts)
    acc = np.zeros((gy1 - gy0, gx1 - gx0, 4), np.float32)   # 미리 곱한 색 + 알파
    for arr, py, px, _st in parts:
        f = arr.astype(np.float32) / 255.0
        sa = f[..., 3:4]
        dst = acc[py - gy0:py - gy0 + arr.shape[0], px - gx0:px - gx0 + arr.shape[1]]
        dst[..., :3] = f[..., :3] * sa + dst[..., :3] * (1 - sa)
        dst[..., 3:4] = sa + dst[..., 3:4] * (1 - sa)
    al = acc[..., 3:4]
    rgb = np.where(al > 1e-4, acc[..., :3] / np.maximum(al, 1e-4), 0)
    res = np.clip(np.dstack([rgb, al]) * 255 + 0.5, 0, 255).astype(np.uint8)
    # 몸통 안 바늘구멍(40px 이하)을 원래 색으로 메운다. 바탕이 비치던 구멍(고리 가운데, 흰색과 거리 30 이하)은 그대로
    pin = ndi.binary_fill_holes(res[..., 3] >= 128) & (res[..., 3] < 128)
    labP, nP = ndi.label(pin)
    if nP:
        sizes = np.asarray(ndi.sum(pin, labP, range(1, nP + 1)))
        meanD = np.asarray(ndi.mean(d[gy0:gy1, gx0:gx1], labP, range(1, nP + 1)))
        fill = np.isin(labP, np.flatnonzero((sizes <= 40) & (meanD > 30)) + 1)
        res[fill, :3] = np.clip(c[gy0:gy1, gx0:gx1][fill] + 0.5, 0, 255).astype(np.uint8)
        res[fill, 3] = 255
    bb = Image.fromarray(res[..., 3]).point(lambda v: 255 if v > 2 else 0).getbbox()
    if bb:
        res = res[bb[1]:bb[3], bb[0]:bb[2]]
    Image.fromarray(res, 'RGBA').save(out / f'{name}.webp', 'WEBP', lossless=True, quality=100, method=6)
    새, _옛 = fc.흰띠_비율(res.astype(np.float32), scale)
    print(f'{name} {res.shape[1]}x{res.shape[0]} 덩어리 {len(parts)} 흰띠 {새:.2f}%', [p[3] for p in parts][0])
    시트감.append((name, res, scale))
fc.시트(시트감, str(out / '_확인시트.jpg'))
