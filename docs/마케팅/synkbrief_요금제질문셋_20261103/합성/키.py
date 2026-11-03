# B24 초록 화면 합성 — 제미나이 동영상의 초록 휴대폰 화면 자리에 실제 요금 화면(화면/*.png 그대로)을 끼운다.
# 초록 판정은 G가 R·B보다 얼마나 큰가로 하고, 화면 네 변은 그 프레임의 초록 칸 경계에서 곧은 선을 맞춰 찾는다(엄지 · 손바닥이 가린 자리는 선 맞춤에서 빠진다).
import cv2
import numpy as np


def 초록정도(bgr):
    b, g, r = [bgr[..., i].astype(np.float32) for i in range(3)]
    return g - np.maximum(r, b)


def 알파(bgr, 낮=38.0, 높=95.0):
    """1 = 완전히 초록(화면이 비침), 0 = 손 · 테두리. 낮~높 사이는 부드럽게."""
    return np.clip((초록정도(bgr) - 낮) / (높 - 낮), 0, 1)


def 초록빼기(bgr, a):
    """가장자리 초록 번짐을 뺀다 — 비친 정도만큼 G를 max(R,B)로 끌어내린다."""
    out = bgr.astype(np.float32)
    상한 = np.maximum(out[..., 0], out[..., 2]) * 1.02 + 4
    넘음 = out[..., 1] > 상한
    out[..., 1] = np.where(넘음, 상한, out[..., 1])
    return out


def _선맞춤(점):
    """(u, v) 점들에서 v = a*u + b, 튀는 점은 RANSAC 비슷하게 두 번 걸러 낸다."""
    u, v = 점[:, 0].astype(np.float64), 점[:, 1].astype(np.float64)
    keep = np.ones(len(u), bool)
    for _ in range(4):
        a, b = np.polyfit(u[keep], v[keep], 1)
        e = np.abs(a * u + b - v)
        lim = max(1.2, np.percentile(e[keep], 70) * 2.2)
        keep = e < lim
        if keep.sum() < 8:
            break
    return np.polyfit(u[keep], v[keep], 1)


def 네모서리(mask, 전=None):
    """mask(0/1 초록)에서 화면 네 변을 맞춰 모서리 넷(왼위 · 오위 · 오아 · 왼아, x y)을 돌려준다."""
    H, W = mask.shape
    ys, xs = np.where(mask > 0)
    if len(xs) < 500:
        return 전
    x0, x1, y0, y1 = np.percentile(xs, 0.5), np.percentile(xs, 99.5), np.percentile(ys, 0.5), np.percentile(ys, 99.5)
    # 모서리 둥근 자리를 뺀 안쪽 구간에서 변마다 경계 점을 모은다
    mx, my = (x1 - x0) * 0.12, (y1 - y0) * 0.07
    위, 아래, 왼, 오 = [], [], [], []
    for x in np.linspace(x0 + mx, x1 - mx, 60).astype(int):
        col = np.where(mask[:, x] > 0)[0]
        if len(col) > 5:
            위.append((x, col[0]))
            # 아래 변은 엄지 · 손이 오른쪽을 가리니 왼쪽 45%만 믿는다
            if x < x0 + (x1 - x0) * 0.45:
                아래.append((x, col[-1]))
    # 옆 변은 위쪽 55%만 믿는다(엄지와 쥔 손은 아래쪽을 가린다)
    for y in np.linspace(y0 + my, y0 + (y1 - y0) * 0.55, 90).astype(int):
        row = np.where(mask[y, :] > 0)[0]
        if len(row) > 5:
            왼.append((y, row[0]))
            오.append((y, row[-1]))
    a1, b1 = _선맞춤(np.array(위))
    a2, b2 = _선맞춤(np.array(아래))
    a3, b3 = _선맞춤(np.array(왼))
    a4, b4 = _선맞춤(np.array(오))

    def 만남(ah, bh, av, bv):  # y = ah x + bh, x = av y + bv
        y = (ah * bv + bh) / (1 - ah * av)
        x = av * y + bv
        return [x, y]

    return np.array([만남(a1, b1, a3, b3), 만남(a1, b1, a4, b4), 만남(a2, b2, a4, b4), 만남(a2, b2, a3, b3)], np.float32)


def 끼우기(bgr, 화면bgr, 모서리, 낮=20.0, 높=68.0, 밝기=0.93, 들뜸=11.0):
    """화면 그림을 네 모서리로 펴서 초록 자리에 비친다. 손 가장자리의 초록 띠는 알파를 2px 넓혀 덮고, 남은 번짐은 띠 안에서 G를 눌러 뺀다.
    화면이 주변 낮빛과 따로 놀지 않게 까만색을 조금 들뜨게 하고(밝은 방에서 유리에 비치는 빛) 비스듬한 옅은 반사를 얹는다."""
    H, W = bgr.shape[:2]
    h, w = 화면bgr.shape[:2]
    src = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
    M = cv2.getPerspectiveTransform(src, 모서리)
    펴짐 = cv2.warpPerspective(화면bgr, M, (W, H), flags=cv2.INTER_AREA if w > W else cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    # 유리 빛: 위 왼쪽에서 내려오는 옅은 반사
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    x0, y0 = 모서리[0]; x1, y1 = 모서리[2]
    u = (xx - x0) / max(x1 - x0, 1); v = (yy - y0) / max(y1 - y0, 1)
    반사 = np.clip(1.0 - np.abs((u + v * 0.55) - 0.28) / 0.38, 0, 1) * 15.0
    펴짐 = 펴짐 * 밝기 + 들뜸 + 반사[..., None]
    # 화면 칸 안에서만 비친다(뒤 화분 같은 초록은 건드리지 않는다)
    칸 = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(칸, np.round(cv2.convexHull(모서리.astype(np.float32))).astype(np.int32), 1)
    칸 = cv2.dilate(칸, np.ones((91, 91), np.uint8)).astype(np.float32)  # 툭 칠 때 휴대폰이 빠르게 움직이면 모서리 추적이 늦다
    # 빠르게 움직이는 손가락의 연두 띠까지 비치게 문턱을 낮추고(살빛은 G가 R보다 낮아 안 걸린다) 3px 넓힌다
    a0 = 알파(bgr, 낮, 높) * 칸
    a = cv2.dilate(a0, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    a = cv2.GaussianBlur(a, (3, 3), 0)[..., None]
    바탕 = bgr.astype(np.float32)
    띠 = (cv2.dilate((a0 > 0.02).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0)
    # 띠 안에서 G가 R을 넘는 자리는 번짐 — G를 R 아래로, 파랑 빠진 노랑 끼도 살빛 쪽으로
    r_, g_, b_ = 바탕[..., 2], 바탕[..., 1], 바탕[..., 0]
    번짐 = 띠 & (g_ > r_ * 0.86)
    바탕[..., 1] = np.where(번짐, r_ * 0.84, g_)
    바탕[..., 0] = np.where(번짐, np.maximum(b_, r_ * 0.68), b_)
    return np.clip(펴짐 * a + 바탕 * (1 - a), 0, 255).astype(np.uint8)
