"""
꿈 무대 기념물 견본(2026-11-17) — 유호님께 보일 한 장. 줄마다 그림을 같은 높이로 놓고 그림 위에 설명 두 줄을 적는다.

    python -I -X utf8 견본판.py <밖.jpg> <제목> <줄>…
    줄: "설명 첫 줄^설명 둘째 줄|그림" 을 「;;」로 이어 쓴다
"""
import sys

from PIL import Image, ImageDraw, ImageFont

F = "C:/Windows/Fonts/malgun.ttf"
FB = "C:/Windows/Fonts/malgunbd.ttf"
H = 600


def main():
    밖, 제목, *줄 = sys.argv[1:]
    fb = ImageFont.truetype(FB, 30)
    fc = ImageFont.truetype(FB, 23)
    fs = ImageFont.truetype(F, 19)
    pad, head, cap = 28, 96, 70
    rows = []
    for 한줄 in 줄:
        칸 = []
        for 한 in 한줄.split(";;"):
            글, 그림 = 한.split("|")
            im = Image.open(그림).convert("RGB")
            im = im.resize((int(im.width * H / im.height + 0.5), H), Image.LANCZOS)
            칸.append((글.split("^"), im))
        rows.append(칸)
    W = max(sum(im.width for _, im in r) + pad * (len(r) + 1) for r in rows)
    canvas = Image.new("RGB", (W, head + (H + cap + pad) * len(rows)), (18, 18, 20))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 30), 제목, font=fb, fill=(245, 245, 245))
    y = head
    for r in rows:
        x = pad
        for 글, im in r:
            d.text((x, y), 글[0], font=fc, fill=(243, 223, 166))
            if len(글) > 1:
                d.text((x, y + 34), 글[1], font=fs, fill=(210, 210, 210))
            canvas.paste(im, (x, y + cap))
            x += im.width + pad
        y += H + cap + pad
    canvas.save(밖, quality=90)
    print(밖, canvas.size)


if __name__ == "__main__":
    main()
