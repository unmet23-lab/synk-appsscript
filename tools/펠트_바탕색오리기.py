# 펠트_바탕색오리기 — 놓일 바탕색(사업 색)에서 구운 펠트 물건 한 장을 바탕 거리로 오린다 (2026-10-17).
#
# 왜: 흰 바탕 판을 오리면 짙은 펠트 둘레에 흰 테가 남고 바닥 그림자가 허옇게 따라온다(10-13 카타나·PULSE).
#     물건을 그것이 놓일 사업 색 바탕에서 구우면, 오리고 남는 털끝·그림자가 같은 색이라 화면에서 보이지 않는다.
#     예전 cut_lapis.py(Documents/synk-vendor, 옛 노트북에만 있음)와 같은 규칙을 저장소 도구로 다시 짰다.
#
# 방법: 1) 테두리 띠에서 바탕색을 재고, 바탕으로 보이는 픽셀로 매끈한 바탕 면(3차 다항식)을 맞춘다.
#       2) 픽셀마다 「바탕 × k」(그림자는 바탕을 어둡게 한 것)로 설명되는지 잰다. 남는 색 차이가 크면 물건,
#          작으면 바탕·그림자다. 그림자는 검정 반투명(1−k)으로 남겨 어느 면에 얹어도 같은 그늘이 된다.
#       3) 불투명도를 정한 뒤 「관측 = a·물건 + (1−a)·바탕」을 풀어 털끝 색에서 바탕색을 빼낸다.
#       4) 그림자는 물건 가까이만 남긴다(먼 곳의 빛 얼룩·비네팅은 버림). 작은 부스러기는 지우고 작은 구멍은 메운다.
# 사용: python -X utf8 tools/펠트_바탕색오리기.py <입력.png> <출력.webp> [--최대=1400] [--확인=시트.jpg] [--면=#RRGGBB]
#   --면: 확인 시트에 얹어 볼 화면 면 색(안 주면 잰 바탕색). 출력은 물건 둘레만 남긴 webp(알파 무손실 품질).
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


def poly_terms(x, y, deg=3):
    return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], -1)


def fit_background(img):
    h, w, _ = img.shape
    b = max(4, int(min(h, w) * 0.03))
    band = np.concatenate([img[:b].reshape(-1, 3), img[-b:].reshape(-1, 3), img[:, :b].reshape(-1, 3), img[:, -b:].reshape(-1, 3)])
    c0 = np.median(band, 0)
    k = (img @ c0) / (c0 @ c0)
    resid = np.linalg.norm(img - k[..., None] * c0, axis=-1)
    cand = (resid < 0.05) & (k > 0.9) & (k < 1.12)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X, Y = xx / w * 2 - 1, yy / h * 2 - 1
    T = poly_terms(X, Y)
    field = np.broadcast_to(c0, img.shape).copy()
    for _ in range(3):
        idx = np.flatnonzero(cand.ravel()[::7]) * 7
        if idx.size < 500:
            break
        A = T.reshape(-1, T.shape[-1])[idx]
        coef, *_ = np.linalg.lstsq(A, img.reshape(-1, 3)[idx], rcond=None)
        field = (T.reshape(-1, T.shape[-1]) @ coef).reshape(img.shape)
        err = np.linalg.norm(img - field, axis=-1)
        cand = cand & (err < 0.035)
    return np.clip(field, 0.02, 1), c0


def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def cut(img):
    h, w, _ = img.shape
    bg, c0 = fit_background(img)
    k = np.sum(img * bg, -1) / np.sum(bg * bg, -1)
    resid = np.linalg.norm(img - k[..., None] * bg, axis=-1)
    # 펠트 결(고주파)은 물건 쪽 증거다 — 그림자·바탕은 매끈하다.
    lum = img @ np.array([.299, .587, .114], np.float32)
    tex = np.abs(lum - ndi.uniform_filter(lum, 5))
    a_obj = np.maximum(smoothstep(resid, 0.035, 0.10), smoothstep(tex, 0.025, 0.06) * smoothstep(resid, 0.02, 0.05))
    a_obj = np.maximum(a_obj, (k < 0.26).astype(np.float32))
    # 바닥의 그늘·비친 빛(바탕과 색상이 같고 채도·밝기만 다른 칸)은 물건이 아니다. 그림이 그늘을 더 진하고 채도 높게 그려
    # 「바탕 × k」로 설명되지 않아도 색상은 바탕 그대로다. 남기면 면의 그늘 위에 다른 색 얼룩이 된다.
    def hsv(x):
        mx, mn = x.max(-1), x.min(-1)
        c = mx - mn
        r, g, b = x[..., 0], x[..., 1], x[..., 2]
        hh = np.where(mx == r, ((g - b) / np.maximum(c, 1e-4)) % 6, np.where(mx == g, (b - r) / np.maximum(c, 1e-4) + 2, (r - g) / np.maximum(c, 1e-4) + 4)) * 60
        return hh, c / np.maximum(mx, 1e-4), mx
    H, S, V = hsv(img)
    bH, bS, bV = hsv(bg)
    dH = np.abs((H - bH + 180) % 360 - 180)
    bgish = (dH < 9) & (S > bS * 0.75) & (V > bV * 0.5) & (V < bV * 1.2)
    a_obj = np.where(bgish, 0, a_obj)
    core =ndi.binary_opening(a_obj > 0.5, iterations=1)
    lab, n = ndi.label(core)
    keep = np.isin(lab, 1 + np.flatnonzero(ndi.sum(core, lab, range(1, n + 1)) >= h * w * 0.0005)) if n else core
    # 메우는 구멍은 아주 작은 것만 — 리본 고리 안처럼 바탕이 보이는 틈을 메우면 다른 바탕에서 사업 색 조각이 남는다.
    holes = ndi.binary_fill_holes(keep) & ~keep
    hl, hn = ndi.label(holes)
    if hn:
        small = np.isin(hl, 1 + np.flatnonzero(ndi.sum(holes, hl, range(1, hn + 1)) < h * w * 0.00005))
        a_obj = np.where(small, 1.0, a_obj)
        keep = keep | small
    # 부스러기 지우기: 남긴 덩어리 둘레 밖의 물건 증거는 버린다.
    a_obj = np.where(ndi.binary_dilation(keep, iterations=6), a_obj, 0)
    # 가장자리 섞임 풀기: 속(가장자리에서 7칸 안쪽 — 털 안개가 바탕 쪽으로 몇 칸 번져 있다)의 펠트 색 F와 바탕 B 사이에서 관측색이 어디쯤인지로 덮인 몫을 잰다.
    # 색 차이만 보면 반쯤 덮인 가장자리 칸이 통째로 불투명이 되어 다른 바탕에서 바탕색 테가 보인다.
    inner = ndi.binary_erosion(keep & (a_obj >= 0.92), iterations=7)
    if inner.any():
        _, (iy, ix) = ndi.distance_transform_edt(~inner, return_indices=True)
        F = ndi.uniform_filter(img, size=(5, 5, 1))[iy, ix]
        band = ndi.binary_dilation(keep, iterations=12) & ~inner
        d = F - bg
        dd = np.sum(d * d, -1)
        frac = np.clip(np.sum((img - bg) * d, -1) / np.maximum(dd, 1e-4), 0, 1)
        sure = band & (dd > 0.03)
        a_obj = np.where(sure, frac, a_obj)
        # 덮인 몫을 빼고 남은 빛으로 그림자를 다시 잰다.
        rest = (img - frac[..., None] * F) / np.maximum(1 - frac, 0.05)[..., None]
        k = np.where(sure, np.sum(rest * bg, -1) / np.sum(bg * bg, -1), k)
        felt = np.where(inner[..., None], img, F)
    else:
        felt = img
    # 그림자: 바탕보다 어두운 만큼(1−k), 물건 가까이만, 바깥으로 갈수록 0으로.
    dist = ndi.distance_transform_edt(~keep)
    R = min(h, w) * 0.10
    reach = 1 - smoothstep(dist, R * 0.45, R)
    shade = np.clip((1 - np.clip(k, 0, 1) - 0.035) / 0.965, 0, 1) * reach
    alpha = np.clip(a_obj + (1 - a_obj) * shade, 0, 1)
    alpha[alpha < 0.012] = 0
    # 털끝 색은 결을 살리려고 덮인 몫이 클수록 관측색을 섞는다(바탕을 빼낸 값).
    own = np.clip((img - (1 - a_obj[..., None]) * np.clip(k, 0, 1)[..., None] * bg) / np.maximum(a_obj, 1e-3)[..., None], 0, 1)
    w = smoothstep(a_obj, 0.6, 0.95)[..., None]
    felt = np.where(inner[..., None] if inner.any() else True, img, w * own + (1 - w) * felt)
    # 한 층으로 합친다: 관측 = a·물건 + (1−a)·k·바탕 → 불투명도 alpha, 색 = a·물건 / alpha (그림자 몫은 검정).
    rgb = np.clip(a_obj[..., None] * felt / np.maximum(alpha, 1e-3)[..., None], 0, 1)
    rgb[alpha == 0] = 0
    return rgb, alpha, bg, c0, keep


def pad_colors(rgb, alpha):
    # 투명 칸 아래 RGB를 가장 가까운 보이는 칸 색으로 채워 손실 압축의 검은 테를 막는다.
    vis = alpha > 0.02
    if not vis.any():
        return rgb
    _, (iy, ix) = ndi.distance_transform_edt(~vis, return_indices=True)
    out = rgb[iy, ix]
    return np.where(vis[..., None], rgb, out)


def main():
    pos, kv = opts(sys.argv[1:])
    if len(pos) < 2:
        sys.exit(__doc__ or '사용: <입력> <출력.webp>')
    src, dst = pos
    img = np.asarray(Image.open(src).convert('RGB'), np.float32) / 255
    rgb, alpha, bg, c0, keep = cut(img)
    ys, xs = np.nonzero(alpha > 0.02)
    p = int(min(img.shape[:2]) * 0.02)
    y0, y1 = max(0, ys.min() - p), min(img.shape[0], ys.max() + p + 1)
    x0, x1 = max(0, xs.min() - p), min(img.shape[1], xs.max() + p + 1)
    rgb, alpha = pad_colors(rgb, alpha)[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    im = Image.fromarray(np.dstack([rgb * 255, alpha * 255]).round().astype(np.uint8), 'RGBA')
    m = int(kv.get('--최대', '1400') or 1400)
    if max(im.size) > m:
        im.thumbnail((m, m), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=90, alpha_quality=100, method=6)
    edge = alpha[(alpha > 0.05) & (alpha < 0.95)]
    hexc = '#%02X%02X%02X' % tuple((c0 * 255).round().astype(int))
    print(f'{dst}  {im.size[0]}×{im.size[1]}  잰 바탕 {hexc}  반투명 가장자리 {edge.size}칸')
    if '--확인' in kv:
        face = hexrgb(kv['--면']) if kv.get('--면') else c0
        a = alpha[..., None]
        tiles = []
        for col in (face, np.array([6, 7, 9], np.float32) / 255, np.array([1, 1, 1], np.float32)):
            tiles.append(rgb * a + col * (1 - a))
        row = np.concatenate(tiles, 1)
        # 아래 가장자리(바닥 그림자·접지)를 2배로
        hh = rgb.shape[0]
        zb = slice(int(hh * 0.62), hh)
        zoom = (rgb[zb] * a[zb] + face * (1 - a[zb]))
        zoom = np.asarray(Image.fromarray((zoom * 255).astype(np.uint8)).resize((zoom.shape[1] * 2, zoom.shape[0] * 2), Image.NEAREST), np.float32) / 255
        W = row.shape[1]
        zoom = zoom[:, :W] if zoom.shape[1] >= W else np.pad(zoom, ((0, 0), (0, W - zoom.shape[1]), (0, 0)), constant_values=0.3)
        sheet = np.concatenate([row, zoom], 0)
        Image.fromarray((sheet * 255).astype(np.uint8)).save(kv['--확인'], quality=88)


if __name__ == '__main__':
    main()
