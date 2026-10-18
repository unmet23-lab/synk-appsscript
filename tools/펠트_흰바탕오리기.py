# 펠트_흰바탕오리기 — 흰 바탕에서 구운 펠트 물건 한 장을 오린다. 크림·흰 펠트가 바탕에 먹히지 않게 (2026-10-17).
#
# 왜: tools/펠트판_칸오리기.py(흰판 걷기)는 밝게 빛나는 크림 펠트 윗면(약 247·233·216)을 흰 바탕으로 보고
#     가장자리를 물어뜯었고, 매끈한 회색 바닥 그늘은 반투명 띠로 남겼다(10-17 synkbrief 상자·자물쇠 상자).
#     tools/펠트_바탕색오리기.py는 그늘을 「바탕 × k」로 보는데, 흰 바탕에서는 크림 펠트도 「흰색 × 0.9」로 설명돼
#     몸통 절반이 지워졌다. 그래서 흰 바탕 판만을 위한 규칙을 따로 둔다.
#
# 방법: 1) 테두리 띠에서 바탕색 B(거의 흰색)를 잰다.
#       2) 바탕 후보 = 바탕과 아주 가까운 픽셀(색 거리 < 0.045) 또는 그늘(채도 < 0.10, 밝기 0.45~0.995, 5×5 밝기
#          흔들림 < 0.022 — 펠트는 털 결 때문에 흔들림이 크고 그늘은 매끈하다).
#       3) 바탕 = 바탕 후보 가운데 그림 테두리에 닿은 덩어리. 안쪽의 밝은 크림 면은 테두리와 이어지지 않으면 남는다.
#          물건 안에 갇힌 덩어리는 거의 순백(거리 < 0.03)이고 150칸이 넘을 때만 뚫린 구멍으로 보고 지운다(열쇠 고리 안).
#       4) 물건 둘레 3칸 안은 바탕과의 거리로 덮인 몫(알파)을 재고 「관측 = a·물건 + (1−a)·B」를 풀어 털끝의 흰빛을 뺀다.
#       5) 바닥 그늘은 남기지 않는다(화면에서 CSS drop-shadow로 준다). 무채색 그늘, 처진 그늘 혀, 따뜻한 갈회색·붉은 갈색 그늘 띠를
#          물건 아래쪽에서부터 벗긴다. 판의 0.03%보다 작은 부스러기는 지운다.
# 사용: python -X utf8 tools/펠트_흰바탕오리기.py <입력.png> <출력.webp> [--확인=시트.jpg] [--면=#RRGGBB]
#       python -X utf8 tools/펠트_흰바탕오리기.py <판.png> <낼폴더> --판=4x2 --이름=a,b,c,… [--확인] [--면=#RRGGBB]   판 모드
#   입력은 물건 하나(또는 한 묶음)가 든 칸. 판을 칸으로 자르는 일은 tools/펠트판_칸오리기.py의 상자 비율과 같은 식으로 먼저 한다.
#   --확인: 사업 색(--면, 기본 청금석 #3D6BC9)·검정·흰 바탕 세 장과 아래쪽 2배 확대를 한 장으로 낸다.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def opts(argv):
    pos = [a for a in argv if not a.startswith('--')]
    kv = {a.split('=', 1)[0]: (a.split('=', 1) + [''])[1] for a in argv if a.startswith('--')}
    return pos, kv


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def cut(img):
    h, w, _ = img.shape
    b = max(4, int(min(h, w) * 0.02))
    band = np.concatenate([img[:b].reshape(-1, 3), img[-b:].reshape(-1, 3), img[:, :b].reshape(-1, 3), img[:, -b:].reshape(-1, 3)])
    B = np.median(band, 0)
    dist = np.linalg.norm(img - B, axis=-1)
    lum = img.mean(-1)
    chroma = img.max(-1) - img.min(-1)
    mu = ndi.uniform_filter(lum, 5)
    wobble = np.sqrt(np.maximum(ndi.uniform_filter(lum * lum, 5) - mu * mu, 0))
    shadow = (chroma < 0.10) & (lum > 0.45) & (lum < 0.995) & (wobble < 0.022)
    cand = (dist < 0.045) | shadow
    lab, n = ndi.label(cand, structure=np.ones((3, 3)))
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    # 갇힌 순백 덩어리(뚫린 구멍)
    pure = (dist < 0.03) & ~bg
    plab, pn = ndi.label(pure)
    if pn:
        sizes = ndi.sum(np.ones_like(dist), plab, index=np.arange(1, pn + 1))
        holes = np.isin(plab, np.arange(1, pn + 1)[sizes > 150])
        bg |= holes
    # 물건 바로 밑 그늘: 그늘 가장자리는 밝기가 흔들려(그라데이션) 위 규칙에 안 걸린다. 아래쪽 16칸 안에서
    # 채도가 낮고 밝은 칸이 바탕과 이어지면 그늘로 본다(펠트 몸통은 크림이라도 채도 0.11 이상, 10-17 실측).
    # 닿는 자리의 짙은 그늘(밝기 0.35~0.55)은 거의 무채색(채도 < 0.06)이고, 그늘진 크림 펠트는 채도 0.08 이상을 지킨다.
    # 한 번에 16칸씩 다섯 번 벗겨 두꺼운 그늘 띠도 걷는다.
    for _ in range(5):
        below = np.full((h, w), 10 ** 6, np.int32)
        run = np.full(w, 10 ** 6, np.int32)
        for y in range(h - 1, -1, -1):
            run = np.where(bg[y], 0, run + 1)
            below[y] = run
        # 펠트 빛이 비친 따뜻한 그늘은 채도 0.086~0.098까지 오른다(10-17 실측) — 매끈할 때만(털 결이 없을 때만) 그늘로 본다.
        low = (~bg) & (below <= 16) & (((chroma < 0.085) & (lum > 0.55)) | ((chroma < 0.105) & (lum > 0.55) & (wobble < 0.03)) | ((chroma < 0.06) & (lum > 0.35)) | ((chroma < 0.09) & (lum > 0.35) & (wobble < 0.03)))
        if not low.any():
            break
        lab2, _ = ndi.label(bg | low, structure=np.ones((3, 3)))
        edge2 = np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))
        bg = np.isin(lab2, edge2[edge2 > 0]) | bg
    obj = ~bg
    # 매달린 이름표 밑처럼 펠트에 붙어 아래로 늘어진 옅은 그늘 줄기: 물건 맨 아래 45칸 안에만 있는 무채색 밝은 덩어리는 그늘로 본다.
    olab0, on0 = ndi.label(obj, structure=np.ones((3, 3)))
    if on0:
        bottoms = {k: sl[0].stop for k, sl in enumerate(ndi.find_objects(olab0), start=1) if sl is not None}
        pale = obj & (chroma < 0.11) & (lum > 0.5)
        plab2, pn2 = ndi.label(pale, structure=np.ones((3, 3)))
        near_bg = ndi.binary_dilation(bg, iterations=2)
        for k, sl in enumerate(ndi.find_objects(plab2), start=1):
            if sl is None:
                continue
            blob = plab2[sl] == k
            if blob.sum() > 4000 or not (near_bg[sl] & blob).any():
                continue
            owner = olab0[sl][blob][0]
            if sl[0].start >= bottoms.get(owner, 0) - 45:
                bg[sl] |= blob
        obj = ~bg
    # 맨 아래 24칸 안의 가는 돌기(이름표 밑 그늘 꼭지 등): 11칸 원으로 열기(opening)해 사라지는 밝은 무채색 칸만 걷는다.
    # 검정 펠트(열쇠 이처럼 가는 것)는 어두워서(밝기 < 0.45), 색 펠트는 채도가 높아서 남는다.
    olab1, on1 = ndi.label(obj, structure=np.ones((3, 3)))
    if on1:
        r = 5
        disk = (np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r)
        opened = ndi.binary_opening(obj, structure=disk)
        nub = obj & ~opened & (chroma < 0.12) & (lum > 0.45)
        rows_from_bottom = np.zeros((h, w), np.int32)
        for k, sl in enumerate(ndi.find_objects(olab1), start=1):
            if sl is None:
                continue
            part = olab1[sl] == k
            yy = np.arange(sl[0].start, sl[0].stop)[:, None]
            rows_from_bottom[sl] = np.where(part, sl[0].stop - yy, rows_from_bottom[sl])
        nub &= (rows_from_bottom > 0) & (rows_from_bottom <= 24)
        bg |= nub
        obj = ~bg
    # 바닥선 아래로 처진 그늘 혀(이름표가 바닥에 드리운 붉은 회색 그늘 등, 10-17 실측 171·146·136 · 채도 0.12 · 매끈):
    # 물건마다 열별 맨 아래 줄을 재고, 이웃 81열의 가운데값(바닥선)보다 3칸 넘게 처진 칸 가운데 매끈하고(흔들림 < 0.035)
    # 색이 옅고(채도 < 0.2) 밝은(밝기 0.4~0.8) 칸만 걷는다. 색 펠트·검정 펠트·크림 몸통의 꼬리는 남는다.
    olabp, onp = ndi.label(obj, structure=np.ones((3, 3)))
    for k, sl in enumerate(ndi.find_objects(olabp), start=1):
        if sl is None:
            continue
        part = olabp[sl] == k
        hh, ww = part.shape
        if ww < 40:
            continue
        rows_idx = np.arange(hh)[:, None]
        lowest = np.where(part.any(0), (part * (rows_idx + 1)).max(0) - 1, -1)
        valid = lowest >= 0
        pad = 40
        prof = np.pad(np.where(valid, lowest, np.nan).astype(np.float32), pad, mode='edge')
        win = np.lib.stride_tricks.sliding_window_view(prof, 2 * pad + 1)
        base = np.nanmedian(win, axis=1)
        sub = (rows_idx > base[None, :] + 3) & part
        sub &= (wobble[sl] < 0.035) & (chroma[sl] < 0.2) & (lum[sl] > 0.4) & (lum[sl] < 0.8)
        bg[sl] |= sub
    obj = ~bg
    # 물건 밑에 깔린 따뜻한 갈회색 그늘 띠(10-17 상자 둘: 닿는 선 65·48·33, 띠 164·147·137 · 채도 0.10~0.15 · 밝기 0.19~0.67):
    # 위 규칙들의 무채색 기준(채도 0.11 미만)보다 채도가 높아 남는다. 바로 위 그늘진 크림 펠트는 채도 0.18 이상, 빛 받은 크림은
    # 밝기 0.75 이상, 색 펠트는 채도 0.4 이상, 검정 펠트는 채도 0.08 미만이라 갈린다. 물건 맨 아래 40칸 안에서 바로 밑(3칸 안)이
    # 바탕인 칸만 3칸씩 위로 벗겨, 펠트에 닿으면 멈춘다(펠트 안쪽의 비슷한 칸은 건드리지 않는다).
    # 그늘은 R ≥ G ≥ B(따뜻한 쪽)일 때만 — 그늘진 초록·파랑 펠트는 채도가 이 범위로 내려와도 남는다.
    # 벗긴 자리 옆에 남는 가는 짙은 선(닿는 선 조각)은 3칸 원 열기로 걷는다.
    r_, g_, b_ = img[..., 0], img[..., 1], img[..., 2]
    warm = (chroma >= 0.08) & (chroma < 0.16) & (lum > 0.06) & (lum < 0.72) & (r_ >= g_ - 0.01) & (g_ >= b_ - 0.01)
    # 빨강 펠트 밑 붉은 갈색 그늘(10-17 도장: 69·30·24 ~ 162·117·110, 채도 0.16~0.29): 색상이 빨강 쪽(G−B ≤ (R−B)/4)이고
    # 채도 0.3 미만일 때만. 빨강 펠트는 채도 0.47 이상, 그늘진 크림은 G−B가 (R−B)의 절반쯤이라 남는다.
    warm |= (chroma >= 0.08) & (chroma < 0.3) & (lum > 0.06) & (lum < 0.6) & (r_ >= g_) & (g_ >= b_ - 0.02) & ((g_ - b_) <= 0.25 * (r_ - b_))
    bg_before = bg.copy()
    olabw, onw = ndi.label(obj, structure=np.ones((3, 3)))
    if onw:
        from_bottom = np.zeros((h, w), np.int32)
        for k, sl in enumerate(ndi.find_objects(olabw), start=1):
            if sl is None:
                continue
            part = olabw[sl] == k
            yy = np.arange(sl[0].start, sl[0].stop)[:, None]
            from_bottom[sl] = np.where(part, sl[0].stop - yy, from_bottom[sl])
        zone = warm & (from_bottom > 0) & (from_bottom <= 40)
        for _ in range(16):
            under = np.zeros((h, w), bool)
            for d in (1, 2, 3):
                under[:-d] |= bg[d:]
            peel = (~bg) & zone & under
            if not peel.any():
                break
            bg |= peel
        peeled = bg & ~bg_before
        if peeled.any():
            near = ndi.binary_dilation(peeled, iterations=4)
            r = 3
            disk = (np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r)
            thin = (~bg) & ~ndi.binary_opening(~bg, structure=disk) & near & (from_bottom <= 44)
            bg |= thin
        obj = ~bg
    olab, on = ndi.label(obj, structure=np.ones((3, 3)))
    if on:
        sizes = ndi.sum(np.ones_like(dist), olab, index=np.arange(1, on + 1))
        keep = np.arange(1, on + 1)[sizes >= max(60, h * w * 0.0003)]
        obj = np.isin(olab, keep)
    # 둘레 3칸 안: 바탕과의 거리로 덮인 몫
    inner = ndi.distance_transform_edt(obj)
    a = np.where(obj, 1.0, 0.0).astype(np.float32)
    rim = obj & (inner <= 3)
    a_rim = np.clip((dist - 0.03) / (0.16 - 0.03), 0, 1)
    a[rim] = np.maximum(a_rim[rim], (inner[rim] - 1) / 3)
    a = ndi.gaussian_filter(a, 0.6) * (ndi.binary_dilation(obj, iterations=1))
    a = np.clip(a, 0, 1)
    # 털끝의 흰빛 빼기
    safe = np.maximum(a, 0.08)[..., None]
    col = np.clip((img - (1 - safe) * B) / safe, 0, 1)
    col = np.where(a[..., None] > 0.97, img, col)
    return col, a, B


def sheet(rgba, face, path):
    h, w = rgba.shape[:2]
    tiles = []
    for c in (face, np.array([0.024, 0.027, 0.035]), np.array([1, 1, 1])):
        bgimg = np.ones((h, w, 3), np.float32) * c
        al = rgba[..., 3:4]
        tiles.append(rgba[..., :3] * al + bgimg * (1 - al))
    top = np.concatenate(tiles, 1)
    zoom_src = tiles[0][h // 2:, :]
    zoom = np.asarray(Image.fromarray((zoom_src * 255).astype(np.uint8)).resize((w * 2, (h - h // 2) * 2), Image.NEAREST)).astype(np.float32) / 255
    pad = np.ones((zoom.shape[0], max(0, top.shape[1] - zoom.shape[1]), 3), np.float32) * 0.3
    bottom = np.concatenate([zoom[:, :top.shape[1]], pad], 1)[:, :top.shape[1]]
    out = np.concatenate([top, bottom], 0)
    Image.fromarray((out * 255).astype(np.uint8)).save(path, quality=88)


def board(pos, kv):
    """판 모드: 판 전체를 한 번에 오리고, 덩어리를 가운데 점이 든 칸(열×행)에 나눠 이름마다 낸다.
    칸 경계를 넘는 물건이 잘리거나 옆 물건 조각이 따라오지 않는다."""
    src, outdir = pos[0], pos[1]
    cols, rows = (int(v) for v in kv['--판'].lower().split('x'))
    names = kv['--이름'].split(',')
    assert len(names) == cols * rows, '이름 수가 칸 수와 다르다'
    img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    col, a, B = cut(img)
    h, w = a.shape
    lab, n = ndi.label(a > 0.02, structure=np.ones((3, 3)))
    cells = {i: [] for i in range(cols * rows)}
    for k, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = np.where(lab[sl] == k)
        cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
        cells[min(rows - 1, int(cy / h * rows)) * cols + min(cols - 1, int(cx / w * cols))].append(k)
    import pathlib
    out = pathlib.Path(outdir); out.mkdir(parents=True, exist_ok=True)
    face = hexrgb(kv.get('--면') or '#3D6BC9')
    for i, name in enumerate(names):
        mask = np.isin(lab, cells[i])
        ys, xs = np.where(mask)
        if not len(ys):
            print(name, '빈 칸'); continue
        m = 4
        y0, y1 = max(0, ys.min() - m), min(h, ys.max() + m + 1)
        x0, x1 = max(0, xs.min() - m), min(w, xs.max() + m + 1)
        al = np.where(mask, a, 0)[y0:y1, x0:x1]
        rgba = np.concatenate([col[y0:y1, x0:x1], al[..., None]], -1)
        Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(out / f'{name}.webp', lossless=True)
        print(f'{name}  {x1 - x0}×{y1 - y0}  덩어리 {len(cells[i])}')
        if '--확인' in kv:
            sheet(rgba, face, str(out / f'_확인_{name}.jpg'))


def main():
    pos, kv = opts(sys.argv[1:])
    if '--판' in kv:
        return board(pos, kv)
    if len(pos) < 2:
        print(__doc__ or '사용: python -X utf8 tools/펠트_흰바탕오리기.py <입력.png> <출력.webp> [--확인=시트.jpg] [--면=#RRGGBB]')
        sys.exit(2)
    src, dst = pos[0], pos[1]
    img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    col, a, B = cut(img)
    ys, xs = np.where(a > 0.02)
    if not len(ys):
        print('물건을 찾지 못함'); sys.exit(1)
    m = 4
    y0, y1 = max(0, ys.min() - m), min(img.shape[0], ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(img.shape[1], xs.max() + m + 1)
    rgba = np.concatenate([col, a[..., None]], -1)[y0:y1, x0:x1]
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(dst, lossless=True)
    semi = int(((rgba[..., 3] > 0.02) & (rgba[..., 3] < 0.98)).sum())
    print(f'{dst}  {x1 - x0}×{y1 - y0}  잰 바탕 #{"".join(f"{int(v * 255):02X}" for v in B)}  반투명 가장자리 {semi}칸')
    if '--확인' in kv:
        sheet(rgba, hexrgb(kv.get('--면') or '#3D6BC9'), kv['--확인'])


if __name__ == '__main__':
    main()
