"""
꿈 무대 콘티(2026-11-17) — 유호님 검수용 한 장. 컷마다 「대역 틀(Seedream)」과 「아바타로 바꾼 판」을 나란히 놓고, 위에 등록된 아바타를 둔다.

    python -I -X utf8 콘티판.py <밖.jpg> <아바타> <컷 이름|설명|틀 그림|바꾼 그림|닮음 글>…
"""
import sys

from PIL import Image, ImageDraw, ImageFont

F = "C:/Windows/Fonts/malgun.ttf"
FB = "C:/Windows/Fonts/malgunbd.ttf"
W = 760  # 그림 한 칸 너비


def 칸(p, w=W):
    im = Image.open(p).convert("RGB")
    h = int(w * 9 / 16)
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def main():
    밖, 아바타, *줄 = sys.argv[1:]
    f = ImageFont.truetype(F, 22)
    fb = ImageFont.truetype(FB, 28)
    fs = ImageFont.truetype(F, 19)
    pad, head = 28, 230
    row_h = int(W * 9 / 16) + 86
    canvas = Image.new("RGB", (pad * 3 + W * 2, head + row_h * len(줄) + pad), (18, 18, 20))
    d = ImageDraw.Draw(canvas)
    av = Image.open(아바타).convert("RGB")
    av = av.resize((int(170 * av.width / av.height), 170), Image.LANCZOS)
    canvas.paste(av, (pad, 30))
    x0 = pad + av.width + 24
    d.text((x0, 34), "꿈 무대 영상 — 이미지 콘티 (배우 판 8화 시사회 속 내 영화 장면)", font=fb, fill=(245, 245, 245))
    d.text((x0, 84), "왼쪽 사진: 등록된 아바타(11-03 유호님 사진으로 만든 19~20살 판)", font=f, fill=(200, 200, 200))
    d.text((x0, 118), "가운데 열: 대역이 나오는 틀(Seedream 5.5 무제한) · 오른쪽 열: 대역 자리를 아바타로 바꾼 판", font=f, fill=(200, 200, 200))
    d.text((x0, 152), "닮음은 SFace(아바타 · 대역). 아바타와 대역 사이는 0.37이다. 영상은 아직 만들지 않았다.", font=f, fill=(200, 200, 200))
    for i, 한 in enumerate(줄):
        이름, 설명, 틀, 바꾼, 닮음 = 한.split("|")
        y = head + i * row_h
        d.text((pad, y), f"{이름}  {설명}", font=fb, fill=(243, 223, 166))
        canvas.paste(칸(틀), (pad, y + 44))
        canvas.paste(칸(바꾼), (pad * 2 + W, y + 44))
        d.text((pad + 10, y + 44 + int(W * 9 / 16) - 34), "대역 틀", font=fs, fill=(255, 255, 255))
        d.text((pad * 2 + W + 10, y + 44 + int(W * 9 / 16) - 34), f"아바타로 바꿈 · {닮음}", font=fs, fill=(255, 255, 255))
    canvas.save(밖, quality=90)
    print(밖, canvas.size)


if __name__ == "__main__":
    main()
