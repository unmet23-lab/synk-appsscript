# Y21 실제 화면 · 그림을 렌더 크기로 다듬는다(2026-10-29). 원본 캡처 · 구운 PNG는 git 밖 공용 작업본 .tmp/yuhobuilds_Y21/.
#   python -I 자료/다듬기.py   (편 폴더에서)
# 실제 화면: @yuhobuilds 릴스 탭(ego, 3배 확대 캡처 · 보는 계정의 메시지 창만 숨김) · 릴스 한 편의 좋아요 줄 · 지난 두 편(Y9 v3 · Y19) 최종본의 끝 장면.
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
RAW = Path(r"C:/Users/q1212/Documents/SYNK-appsscript/.tmp/yuhobuilds_Y21")
OUT = HERE / "실제화면"
ART = HERE / "그림"
OUT.mkdir(exist_ok=True)
ART.mkdir(exist_ok=True)

def save(im, path, q=88):
    im.convert("RGB").save(path, quality=q, optimize=True, progressive=True)

grid = Image.open(RAW / "실제화면/grid_2rows.png")
k = grid.width / 833  # CSS 833px 폭을 잡은 배율
save(grid.resize((1600, round(grid.height * 1600 / grid.width)), Image.LANCZOS), OUT / "그리드.jpg")
for i, (x, y) in enumerate([(0, 0), (278, 0), (556, 0), (0, 431), (278, 431), (556, 431)]):
    c = grid.crop((round(x * k), round(y * k), round((x + 277) * k), round((y + 431) * k)))
    save(c.resize((640, round(c.height * 640 / c.width)), Image.LANCZOS), OUT / f"칸{i + 1}.jpg")
hdr = Image.open(RAW / "실제화면/header.png")
hdr = hdr.crop((0, 0, hdr.width, round(hdr.height * 0.83)))  # 보는 계정의 팔로우 · 메시지 단추 줄은 뺀다
save(hdr.resize((1600, round(hdr.height * 1600 / hdr.width)), Image.LANCZOS), OUT / "프로필.jpg")
heart = Image.open(RAW / "실제화면/heart_row.png")
save(heart.resize((1080, round(heart.height * 1080 / heart.width)), Image.LANCZOS), OUT / "좋아요줄.jpg")
for name in ["y9_end", "y19_end"]:
    f = Image.open(RAW / f"실제화면/{name}.png").crop((0, 280, 1080, 1200))
    save(f, OUT / f"끝_{name.split('_')[0]}.jpg")

def pad_white(src, dst, w=1080, h=936):
    im = Image.open(src).convert("RGB")
    s = min(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    bg = Image.new("RGB", (w, h), (255, 255, 255))
    bg.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    save(bg, dst)

pad_white(RAW / "판/I1_시험관_033816.png", ART / "시험관.jpg")
pad_white(RAW / "판/I4_썸네일벽_033817.png", ART / "썸네일벽.jpg")
for p in sorted(list(OUT.glob("*.jpg")) + list(ART.glob("*.jpg"))):
    print(p.relative_to(HERE), Image.open(p).size, f"{p.stat().st_size // 1024}KB")
