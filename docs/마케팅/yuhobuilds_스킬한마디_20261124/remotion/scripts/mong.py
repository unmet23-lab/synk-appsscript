# 구운 몽글이 판(1024×1536)을 영상용 그림(1080×1620)으로 담는다.
#   python -I -X utf8 scripts/mong.py <구운 판.png> <public/mong/이름.jpg> [왼쪽으로 밀 픽셀]
# 왼쪽으로 밀면 오른쪽에 생기는 빈 띠는 그림의 오른쪽 끝을 거울로 이어 채운다(그 자리는 흐린 벽과 책상뿐이다).
# 까닭: 오른쪽 물건이 릴스 단추 자리(x 920 밖)에 걸리지 않게 한다.
import sys
from PIL import Image, ImageOps

src, dst = sys.argv[1], sys.argv[2]
shift = int(sys.argv[3]) if len(sys.argv) > 3 else 0
im = Image.open(src).convert("RGB").resize((1080, 1620), Image.LANCZOS)
if shift > 0:
    out = Image.new("RGB", (1080, 1620))
    out.paste(im.crop((shift, 0, 1080, 1620)), (0, 0))
    strip = ImageOps.mirror(im.crop((1080 - shift, 0, 1080, 1620)))
    out.paste(strip, (1080 - shift, 0))
    im = out
im.save(dst, quality=93)
print(dst, im.size, "shift", shift)
