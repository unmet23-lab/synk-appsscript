# synkbrief B74 「강아지 사진 한 장으로 연말 카드 그림」 화면 재료.
# 원본은 git 밖 %USERPROFILE%/ego/synkbrief-dogcard-20261126/ — 2026-11-26 ChatGPT 보통 새 채팅(휴대폰 크기 430 × 932 · 배율 2.5 · 밝은 화면)에
# 실제로 보낸 실험 E02(같은 대화에 세 줄)의 받은 그림 세 장과 화면이다. 보낸 사진은 AI로 만든 가상 강아지(편 폴더 그림/강아지사진_075620.png)다.
# 사용: python -I -X utf8 scripts/재료.py   (remotion 폴더에서) → public/img/<이름>.png(영상용, git 밖) · src/sizes.json · 편 폴더 그림/<이름>.jpg(정본 사본)
import json, os
from PIL import Image, ImageDraw

SRC = os.path.join(os.path.expanduser("~"), "ego", "synkbrief-dogcard-20261126", "runs", "E02")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EP = os.path.dirname(HERE)
OUT = os.path.join(HERE, "public", "img")
KEEP = os.path.join(EP, "그림")
os.makedirs(OUT, exist_ok=True)

sizes = {}
def put(name, im, keep=True):
    im.save(os.path.join(OUT, name + ".png"))
    sizes[name] = list(im.size)
    if keep:
        im.convert("RGB").save(os.path.join(KEEP, name + ".jpg"), quality=92)

# 보낸 사진과 받은 그림 셋(크기 · 색을 바꾸지 않는다)
put("photo", Image.open(os.path.join(EP, "그림", "강아지사진_075620.png")).convert("RGB"), keep=False)
put("pencil", Image.open(os.path.join(SRC, "E02_1.png")).convert("RGB"))   # 「색연필 그림으로 바꿔 줘. 털 무늬는 그대로.」
put("blank", Image.open(os.path.join(SRC, "E02_2.png")).convert("RGB"))    # 「연말 카드로 쓰게, 아래에 글 쓸 빈자리를 남겨 줘.」
put("card", Image.open(os.path.join(SRC, "E02_3.png")).convert("RGB"))     # 「아래 빈자리에 '메리 크리스마스, 우리 집 막내'를 손글씨로 써 줘.」

# 보낸 말풍선 셋 — 밝은 화면의 검은 말풍선만 자르고, 말풍선 밖 흰 바탕은 투명하게(모서리에서 이어진 흰 칸만)
def bubble(shot, box, name):
    im = Image.open(os.path.join(SRC, shot)).convert("RGBA").crop(box)
    w, h = im.size
    gray = im.convert("L")
    mask = Image.new("L", (w + 2, h + 2), 0)
    # 흰 바탕(밝기 200 넘음)을 테두리에서부터 채운다
    bright = gray.point(lambda v: 255 if v > 200 else 0)
    pad = Image.new("L", (w + 2, h + 2), 255)
    pad.paste(bright, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    outside = pad.point(lambda v: 255 if v == 128 else 0).crop((1, 1, w + 1, h + 1))
    alpha = Image.eval(outside, lambda v: 0 if v else 255)
    im.putalpha(alpha)
    put(name, im)
bubble("1_받은뒤.png", (334, 424, 1040, 616), "bub1")
bubble("2_받은뒤.png", (334, 1494, 1040, 1686), "bub2")
bubble("3_받은뒤.png", (334, 1498, 1040, 1689), "bub3")

json.dump(sizes, open(os.path.join(HERE, "src", "sizes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(sizes, ensure_ascii=False))
