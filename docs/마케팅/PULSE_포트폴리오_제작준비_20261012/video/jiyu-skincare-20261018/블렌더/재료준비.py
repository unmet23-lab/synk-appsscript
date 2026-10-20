# 지유 스킨케어 · 블렌더 장면에 쓸 그림 재료를 만든다(PIL).
#   python -X utf8 재료준비.py   → Documents/synk-vendor/jiyu-skincare-20261018/블렌더/배경판.jpg, 잎그림자.png
# - 배경판: 컷 3 키프레임(Gemini, 같은 욕실·창 왼쪽·화분)의 위쪽 흐린 배경을 잘라 병 뒤 먼 판에 붙인다.
#   100mm 얕은 심도라 어차피 흐려지고, 사람 컷과 같은 욕실로 이어 보이게 하는 것이 목적이다.
# - 잎그림자: 창과 병 사이에 둘 화분 잎 실루엣(검정 잎 · 흰 바탕). 블렌더에서 알파로 잘라 빛을 가린다.
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
OUT = os.path.join(V, "블렌더")


def backplate(set2=False):
    # 10-18 Fable 재검수: 병 컷이 회색 스튜디오처럼 보여 사람 컷과 다른 장소로 읽혔다 → 컷 3 최종판(v4b)의 위쪽 배경
    # (왼쪽 커튼 창·흰 벽·오른쪽 화분, 대리석 뒤 끝 위까지)을 판으로 쓰고, 블렌더에서 화면 폭에 창과 화분이 함께 들어오게 놓는다
    # 세트 2(10-19 새 욕실): 세트 2 컷 3 원본(1536×2752) 위쪽 → 배경판_세트2.jpg(같은 1536×1211)
    src_path = os.path.join(V, "키프레임_세트2", "컷3_원본.jpg") if set2 else os.path.join(V, "키프레임_A", "컷3_시작_v4b.jpg")
    src = Image.open(src_path).convert("RGB")
    w, h = src.size
    bp = src.crop((0, 0, w, round(h * 0.44)))
    bp = bp.filter(ImageFilter.GaussianBlur(4))
    p = os.path.join(OUT, "배경판_세트2.jpg" if set2 else "배경판.jpg")
    bp.save(p, quality=92)
    return p, bp.size


def leaf(d, x, y, length, width, ang):
    # 끝이 뾰족한 잎 하나(다각형)
    pts = []
    for i in range(41):
        t = i / 40
        r = width * math.sin(math.pi * t) ** 0.8 * (1 - 0.35 * t)
        pts.append((t * length, r))
    poly = pts + [(px, -py) for px, py in reversed(pts)]
    ca, sa = math.cos(ang), math.sin(ang)
    d.polygon([(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in poly], fill=0)


def gobo():
    # 10-18 첫 판은 잎이 가운데 아래에만 있어 그림자가 병 옆으로 떨어졌다 → 그림 전체에 줄기를 고르게 퍼뜨린다(빈틈 40% 안팎)
    random.seed(1018)
    W, H = 2048, 2048
    im = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(im)
    for s in range(9):
        x0, y0 = W * (0.06 + 0.11 * s) + random.uniform(-60, 60), H * 1.02
        ang = -math.pi / 2 + random.uniform(-0.45, 0.45)
        x, y = x0, y0
        for k in range(8):
            seg = random.uniform(200, 280)
            x2, y2 = x + seg * math.cos(ang), y + seg * math.sin(ang)
            d.line((x, y, x2, y2), fill=0, width=9)
            for side in (-1, 1) if k % 3 == 0 else ((1 if k % 2 else -1),):
                la = ang + side * random.uniform(0.6, 1.1)
                leaf(d, x2, y2, random.uniform(200, 300), random.uniform(60, 95), la)
            x, y = x2, y2
            ang += random.uniform(-0.3, 0.3)
            if y < -200:
                break
    im = im.filter(ImageFilter.GaussianBlur(3))
    p = os.path.join(OUT, "잎그림자.png")
    im.save(p)
    return p


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if "--세트2" in sys.argv:  # 세트 2 배경판만(잎 그림은 그대로 씀)
        print(backplate(set2=True))
        sys.exit(0)
    print(backplate())
    print(gobo())
