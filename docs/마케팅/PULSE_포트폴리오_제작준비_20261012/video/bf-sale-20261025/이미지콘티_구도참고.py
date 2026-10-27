# 블프 세일 이미지 콘티 — 다시 굽기용 참고 그림(2026-10-27). 고른 판의 구도는 그대로 두고 머리 · 헤드셋만 흐리게 지운 「구도 참고」(S33)와
# 헤드셋 자리 참고를 만든다. 참고로만 넣고 굽은 판을 손질하지 않는다(만족 사례 장부 — 후보정 최대한 안 함).
#   python -X utf8 이미지콘티_구도참고.py → git 밖 콘티/bf-sale/참조/<컷>_구도2.png · 헤드셋_오른쪽귀.png
# 헤드셋: 정면 컷(① ⑥ ⑬)이 그림 오른쪽 귀(채원의 왼쪽 귀)에 걸려 나와, ⑬ 얼굴을 좌우로 뒤집은 그림으로 「그림 왼쪽 귀(채원의 오른쪽 귀)」 자리를 보여 준다.
import os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter, ImageOps

sys.argv = sys.argv[:1]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "이미지콘티_닮음.py"), encoding="utf-8").read().split("ref = [")[0])   # FD(YuNet) · read()
B = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale")
SRC = {"C01": "받음/C01_203313.jpg", "C06": "받음/C06_203639.jpg", "C13": "받음/C13_204414.jpg", "C08": "받음/C08c_005449.jpg"}


def face(p):
    img = read(p)
    s = 1600 / img.shape[1]
    sm = cv2.resize(img, None, fx=s, fy=s)
    FD.setInputSize((sm.shape[1], sm.shape[0]))
    r = FD.detect(sm)[1]
    f = max(r, key=lambda b: b[2] * b[3])
    return [float(v) / s for v in f[:4]]


for cut, rel in SRC.items():
    p = os.path.join(B, rel)
    x, y, w, h = face(p)
    im = Image.open(p).convert("RGB")
    cx, cy = x + w / 2, y + h * 0.45
    rx, ry = w * 1.25, h * 1.15          # 귀 · 헤드셋 붐까지 덮는다
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(max(8, w * 0.15)))
    out = Image.composite(im.filter(ImageFilter.GaussianBlur(max(20, w * 0.35))), im, m)
    out.save(os.path.join(B, "참조", f"{cut}_구도2.png"))
    print(cut, "얼굴", int(w), "px →", f"참조/{cut}_구도2.png")

x, y, w, h = face(os.path.join(B, SRC["C13"]))
im = Image.open(os.path.join(B, SRC["C13"])).convert("RGB")
pad = w * 0.9
head = im.crop((int(x - pad), int(y - pad), int(x + w + pad), int(y + h + pad)))
ImageOps.mirror(head).resize((900, int(900 * head.height / head.width)), Image.LANCZOS).save(os.path.join(B, "참조", "헤드셋_오른쪽귀.png"))
print("헤드셋 참고 → 참조/헤드셋_오른쪽귀.png")
