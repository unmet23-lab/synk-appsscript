"""
꿈 무대 콘티 둘째 판(2026-11-17, 옥상 장면) — 유호님 검수용 한 장.
위에 등록된 아바타의 각도 세트를 두고, 아래에 컷 넷을 차례로 놓는다. 얼굴 컷(2 · 4)은 아바타를 넣은 판을 크게, 대역 틀을 작게 겹쳐 보인다.

    python -I -X utf8 콘티판2.py <밖.jpg> <제목> <각도 세트 넷(쉼표)> <컷 줄>…
    컷 줄: "이름|소리|그림|틀(없으면 빈칸)|닮음 글(없으면 빈칸)"
"""
import sys

from PIL import Image, ImageDraw, ImageFont

F = "C:/Windows/Fonts/malgun.ttf"
FB = "C:/Windows/Fonts/malgunbd.ttf"
W = 900


def 칸(p, w=W):
    im = Image.open(p).convert("RGB")
    h = int(w * 9 / 16)
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def main():
    밖, 제목, 세트, *줄 = sys.argv[1:]
    f = ImageFont.truetype(F, 22)
    fb = ImageFont.truetype(FB, 30)
    fc = ImageFont.truetype(FB, 24)
    fs = ImageFont.truetype(F, 19)
    pad, head = 28, 250
    H = int(W * 9 / 16)
    row_h = H + 92
    rows = (len(줄) + 1) // 2
    canvas = Image.new("RGB", (pad * 3 + W * 2, head + row_h * rows + pad), (18, 18, 20))
    d = ImageDraw.Draw(canvas)
    x = pad
    for p in 세트.split(","):
        av = Image.open(p).convert("RGB")
        av = av.resize((int(190 * av.width / av.height), 190), Image.LANCZOS)
        canvas.paste(av, (x, 30))
        x += av.width + 8
    x += 18
    d.text((x, 34), 제목, font=fb, fill=(245, 245, 245))
    d.text((x, 86), "왼쪽 넷: 등록된 아바타와 그 각도 세트(정면 무표정, 왼쪽, 오른쪽)", font=f, fill=(200, 200, 200))
    d.text((x, 120), "얼굴 컷(2 · 4)의 작은 그림은 대역이 나오는 틀이다. 큰 그림이 아바타를 넣은 판이다.", font=f, fill=(200, 200, 200))
    d.text((x, 154), "닮음은 SFace로 잰 값이다. 같은 사람의 각도 세트끼리는 0.65~0.87이 나온다.", font=f, fill=(200, 200, 200))
    d.text((x, 188), "영상은 아직 만들지 않았다.", font=f, fill=(200, 200, 200))
    for i, 한 in enumerate(줄):
        이름, 소리, 그림, 틀, 닮음 = 한.split("|")
        cx = pad + (i % 2) * (W + pad)
        y = head + (i // 2) * row_h
        d.text((cx, y), 이름, font=fc, fill=(243, 223, 166))
        d.text((cx, y + 34), 소리, font=fs, fill=(210, 210, 210))
        canvas.paste(칸(그림), (cx, y + 66))
        if 틀:
            작 = 칸(틀, 270)
            canvas.paste(작, (cx + 10, y + 66 + H - 작.height - 10))
            d.rectangle((cx + 10, y + 66 + H - 작.height - 10, cx + 10 + 작.width, y + 66 + H - 10), outline=(255, 255, 255), width=2)
        if 닮음:
            d.rectangle((cx + W - 330, y + 66 + H - 40, cx + W, y + 66 + H), fill=(0, 0, 0))
            d.text((cx + W - 320, y + 66 + H - 34), 닮음, font=fs, fill=(255, 255, 255))
    canvas.save(밖, quality=90)
    print(밖, canvas.size)


if __name__ == "__main__":
    main()
