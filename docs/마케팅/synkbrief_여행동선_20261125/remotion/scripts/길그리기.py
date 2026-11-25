# synkbrief B77 — 펼친 지도(모든 날짜, 그림/map_all.png)의 실제 흰 길을 날마다 첫 핀부터 차례로 드러내는 재료.
# 장면 심사 v6(「지도가 4초 멈춰 있다 · 경로가 1번부터 이어 그려지면」)에 따른 것이다.
# 길 화소만 지운 바탕(map_base.png — 길 자리를 둘레 지도로 메움, 핀 · 지명은 그대로)과,
# 날마다 길 화소를 첫 핀에서 길을 따라 잰 거리 순으로 드러낸 겹 그림 24장(route/d<날>_<nn>.png)을 만든다.
# 겹 그림의 화소는 원래 화면의 화소 그대로이고, 마지막 장을 모두 겹치면 원래 화면과 같다.
# 사용: python -I -X utf8 scripts/길그리기.py   (remotion 폴더에서, 재료.py 뒤)
import json, os
from collections import deque
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(HERE), "그림", "map_all.png")
OUT = os.path.join(HERE, "public", "img")
os.makedirs(os.path.join(OUT, "route"), exist_ok=True)
STEPS = 24

im = np.array(Image.open(SRC).convert("RGB"))
H, W, _ = im.shape
white = ((im[..., 0] > 200) & (im[..., 1] > 200) & (im[..., 2] > 200)).astype(np.uint8)
# 굵은 길만 남긴다(지명 · 번호 글자는 획이 가늘어 열기에서 빠진다)
thick = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
# 날마다 길이 있는 자리(map_all 좌표)와 첫 핀 쪽 씨앗
DAYS = {
    1: {"box": (600, 430, 1075, 580), "seed": (945, 500)},   # 청사포(1) → 해운대(2) → 광안리(3)
    2: {"box": (120, 780, 260, 870), "seed": (150, 845)},    # 감천(4) → 국제시장(5) → 자갈치(6)
    3: {"box": (180, 900, 470, 1060), "seed": (450, 1040)},  # 태종대(7) → 흰여울(8) → 송도(9)
}
allmask = np.zeros((H, W), np.uint8)
info = {}
for d, c in DAYS.items():
    x0, y0, x1, y1 = c["box"]
    m = np.zeros((H, W), np.uint8)
    m[y0:y1, x0:x1] = thick[y0:y1, x0:x1]
    # 가장자리의 밝은 회색(앤티에일리어싱)까지 넣는다
    near = cv2.dilate(m, np.ones((5, 5), np.uint8))
    light = ((im[..., 0] > 120) & (im[..., 1] > 120) & (im[..., 2] > 120)).astype(np.uint8)
    m = np.maximum(m, near & light)
    # 씨앗에서 가장 가까운 길 화소부터 길을 따라 BFS 거리(대각 포함)
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        raise SystemExit(f"{d}일차 길 화소 없음")
    sx, sy = c["seed"]
    k = int(np.argmin((xs - sx) ** 2 + (ys - sy) ** 2))
    dist = np.full((H, W), -1, np.int32)
    q = deque([(ys[k], xs[k])])
    dist[ys[k], xs[k]] = 0
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and dist[ny, nx] < 0:
                    dist[ny, nx] = dist[y, x] + 1
                    q.append((ny, nx))
    # 이어지지 않은 조각(핀 밑에서 끊긴 길)은 씨앗에서 곧은 거리로 차례를 준다
    far = (m > 0) & (dist < 0)
    if far.any():
        fy, fx = np.nonzero(far)
        dist[fy, fx] = np.sqrt((fx - sx) ** 2 + (fy - sy) ** 2).astype(np.int32)
    mx = max(1, int(dist[m > 0].max()))
    info[d] = {"pixels": int(m.sum()), "max": mx}
    for s in range(STEPS):
        lim = mx * (s + 1) / STEPS
        a = ((m > 0) & (dist <= lim)).astype(np.uint8) * 255
        rgba = np.dstack([im, a])
        Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "route", f"d{d}_{s:02d}.png"), optimize=True)
    allmask = np.maximum(allmask, m)

# 길 자리를 둘레 지도로 메운 바탕(핀 · 지명은 그대로)
hole = cv2.dilate(allmask, np.ones((5, 5), np.uint8))
base = cv2.inpaint(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), hole * 255, 6, cv2.INPAINT_TELEA)
Image.fromarray(cv2.cvtColor(base, cv2.COLOR_BGR2RGB)).save(os.path.join(OUT, "map_base.png"))
json.dump({"steps": STEPS, "days": info}, open(os.path.join(OUT, "route", "info.json"), "w"), indent=1)
print(json.dumps(info))
