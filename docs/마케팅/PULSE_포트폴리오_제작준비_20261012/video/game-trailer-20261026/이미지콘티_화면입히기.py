# 9번 이미지 콘티 — 받은 그림의 TV 화면 자리에 SYNK WORLD 그림을 네 모서리에 맞춰 입힌다(2026-10-26).
# 제작 때 실제 녹화를 입히는 길(경로 D)과 같은 꼴 — GPT가 그린 화면 속 그림은 자리만이었다.
# 낯선 사람 시험 1차(2점)에서 「인형이 게임 캐릭터인가?」 · 「비 온다는데 비가 없다」가 나와서:
#   2번 첫 그림 = 우리 동네 펠트 홈(세 친구가 서 있음) → 2번 끝 그림 = 같은 동네에서 세 친구가 빠진 판(친구들이 화면에서 나옴),
#   5번 = 비가 오기 시작한 찻집(3D 주민 시제품 장면 ③), 7번(화면 전체) = 소나기 · 번개 속 찻집 주인 말풍선(장면 ④).
#   python -X utf8 이미지콘티_화면입히기.py   → 콘티/p9/정지컷/S02a.png · S02b.png · S05.png · game7.png
import os
import random

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "콘티", "p9")
# 3D 주민 시제품 네 장면(1240×700, 2×2) — Fable 1차 P1: 2번에서 친구 셋이 화면을 나왔으니 5 · 7번 게임 화면에 몽글이 또 있으면 모순.
# 몽글이 없는 쪽(각 장면 왼쪽의 몽글을 뺀 오른쪽)을 자른다: ③ 비가 오기 시작한 찻집(찻집 주인 · 교수) · ④ 비 오는 찻집과 찻집 주인 말풍선.
RESIDENTS = os.path.join(REPO, "docs", "디자인", "싱크타운_그림체_20261026", "3D주민_네장면.jpg")
SCENE3 = (110, 352, 620, 639)
SCENE4 = (730, 352, 1240, 639)

# 받은 판(1536×1024) 속 화면 안쪽 네 모서리 — 격자로 잼(위왼 · 위오 · 아래오 · 아래왼)
SCREENS = {
    "S02a": ("S02a_185144", [(816, 203), (1341, 195), (1339, 480), (816, 485)], 0.0),
    "S02b": ("S02b_185144", [(876, 122), (1355, 100), (1355, 382), (876, 385)], 5.0),   # 초점이 앞 친구로 — 화면은 흐림
    "S05": ("S05_185401", [(341, 247), (1179, 73), (1200, 731), (309, 760)], 0.0),
}


def warp_onto(base, content, quad, blur, glow=1.0):
    b = np.array(base.convert("RGB"), dtype=np.float32)
    c = np.array(content.convert("RGB"), dtype=np.float32) * glow
    h, w = c.shape[:2]
    src = np.float32([(0, 0), (w, 0), (w, h), (0, h)])
    M = cv2.getPerspectiveTransform(src, np.float32(quad))
    warped = cv2.warpPerspective(c, M, (b.shape[1], b.shape[0]))
    mask = cv2.warpPerspective(np.ones((h, w), np.float32), M, (b.shape[1], b.shape[0]))
    mask = cv2.GaussianBlur(mask, (0, 0), 0.8)[..., None]
    if blur:
        warped = cv2.GaussianBlur(warped, (0, 0), blur)
    out = b * (1 - mask) + np.clip(warped, 0, 255) * mask
    return Image.fromarray(out.astype(np.uint8))


def rainy(img, amount=1.0, flash=False, seed=7):
    """게임 속 비(제작 때는 게임의 비 효과 녹화) — 자리 그림용으로 빗줄기 · 어두움 · 번개만 얹는다."""
    im = ImageEnhance.Brightness(img).enhance(0.78 if not flash else 1.05)
    im = ImageEnhance.Color(im).enhance(0.85)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    W, H = im.size
    for _ in range(int(1600 * amount)):
        x, y = rnd.uniform(-60, W), rnd.uniform(-40, H)
        L = rnd.uniform(30, 70) * W / 1536
        d.line([(x, y), (x + L * 0.28, y + L)], fill=(230, 238, 255, rnd.randint(110, 190)), width=2)
    layer = layer.filter(ImageFilter.GaussianBlur(0.5))
    sky = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(sky)
    for yy in range(int(H * 0.45)):   # 위쪽 먹구름 그늘
        a = int(110 * (1 - yy / (H * 0.45)) * amount)
        ds.line([(0, yy), (W, yy)], fill=(40, 46, 60, a))
    out = Image.alpha_composite(Image.alpha_composite(im.convert("RGBA"), sky), layer)
    if flash:
        fl = Image.new("RGBA", im.size, (255, 255, 255, 0))
        df = ImageDraw.Draw(fl)
        for r in range(0, int(W * 0.9), 6):   # 왼쪽 위에서 번지는 번개 빛
            df.ellipse([-r * 0.6, -r * 0.6, r, r], outline=(240, 244, 255, max(0, 120 - r // 10)), width=6)
        out = Image.alpha_composite(out, fl.filter(ImageFilter.GaussianBlur(30)))
    return out.convert("RGB")


def align(src, ref):
    """빈 판(GPT가 다시 구워 구도가 조금 밀림)을 원본 동네 사진 좌표로 맞춘다 — SIFT + 호모그래피."""
    a = cv2.cvtColor(np.array(ref.convert("RGB")), cv2.COLOR_RGB2GRAY)
    b = cv2.cvtColor(np.array(src.convert("RGB")), cv2.COLOR_RGB2GRAY)
    sift = cv2.SIFT_create(4000)
    ka, da = sift.detectAndCompute(a, None)
    kb, db = sift.detectAndCompute(b, None)
    good = [m for m, n in cv2.BFMatcher().knnMatch(db, da, k=2) if m.distance < 0.7 * n.distance]
    Hm, _ = cv2.findHomography(np.float32([kb[m.queryIdx].pt for m in good]), np.float32([ka[m.trainIdx].pt for m in good]), cv2.RANSAC, 3.0)
    out = cv2.warpPerspective(np.array(src.convert("RGB")), Hm, ref.size)
    return Image.fromarray(out)


TOWN_BOX = (370, 250, 1090, 655)   # 1280×720 동네 사진에서 가게 앞 세 친구 쪽 16:9


if __name__ == "__main__":
    town = Image.open(os.path.join(V, "참고", "펠트동네_우리동네.jpg")).convert("RGB")
    empty_p = sorted(p for p in os.listdir(os.path.join(V, "받음")) if p.startswith("T0_동네빈판_"))
    empty = align(Image.open(os.path.join(V, "받음", empty_p[-1])), town) if empty_p else town
    res = Image.open(RESIDENTS).convert("RGB")
    scene3 = res.crop(SCENE3).resize((1536, 864), Image.LANCZOS)
    scene4 = res.crop(SCENE4).resize((1536, 864), Image.LANCZOS)
    contents = {"S02a": town.crop(TOWN_BOX), "S02b": empty.crop(TOWN_BOX), "S05": rainy(scene3, amount=0.5)}
    for key, (src, quad, blur) in SCREENS.items():
        base = Image.open(os.path.join(V, "받음", f"{src}.png"))
        warp_onto(base, contents[key], quad, blur, glow=1.04).save(os.path.join(V, "정지컷", f"{key}.png"))
        print(key, "←", src)
    rainy(scene4, amount=1.0, flash=True).save(os.path.join(V, "정지컷", "game7.png"))
    print("game7 소나기 · 번개(주민 장면 ④)")
