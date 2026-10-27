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


def c08_shrink():
    # ⑧ 원본 크기 판(10-27): 7차 C08t를 통째로 0.766배로 줄여 원본 자리(정수리 0.30 · 높이 0.50)에 두고, 바깥 테두리만
    # GPT 이미지 2.5로 같은 터널 · 바닥을 이어 채운 판(gpt/판/C08out_202501.png — 지시문 gpt/C08out_지시문.txt) 위에
    # 원래 C08t의 사람+자전거만 모양대로(u2net) 다시 덮는다. 사람 · 얼굴 · 빛은 구운 그대로, 배경은 C08t 자신의 비스듬한 터널 원근을 이어 씀.
    # Gemini는 크기 숫자 · 실루엣 · 구도 참고를 줘도 사람을 1.25~1.3배로 키웠고(8 · 9차), 정면 터널 배경 판에 오려 얹은 첫 판은
    # 원근이 엇갈렸다(Fable 10-27 P1). 네모로 다시 덮으면 두 그림의 바닥 색이 달라 테두리 선이 보여 사람 모양대로만 덮는다.
    from rembg import new_session, remove
    src = Image.open(os.path.join(B, "받음/C08t_181209.jpg")).convert("RGB")
    W, H = src.size
    k, ox, oy = 0.766, int(0.194 * W), int(0.118 * H)
    small = src.resize((int(W * k), int(H * k)), Image.LANCZOS)
    can = Image.new("RGB", (W, H), (128, 128, 128))
    can.paste(small, (ox, oy))
    can.save(os.path.join(B, "합성판", "C08t_넓힐판.png"))        # GPT에 넣는 판(회색 테두리)
    ext_p = os.path.join(B, "gpt", "판", "C08out_202501.png")
    if not os.path.exists(ext_p):
        print("GPT로 테두리를 채운 판이 아직 없다 — node 굽기_gpt.cjs gpt <C08out_지시문.txt> C08out <C08t_넓힐판.png>"); return
    ext = Image.open(ext_p).convert("RGB").resize((W, H), Image.LANCZOS)
    m = remove(small, session=new_session("u2net"), only_mask=True).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(1.5))
    out = ext.convert("RGBA")
    small.putalpha(m)
    out.alpha_composite(small, (ox, oy))
    out.convert("RGB").save(os.path.join(B, "합성판", "C08_넓혀줄임.png"))
    print("⑧ 넓혀 줄인 판 → 합성판/C08_넓혀줄임.png")


if "--c08" in sys.argv[1:] or os.environ.get("C08_SHRINK") == "1":
    c08_shrink()
