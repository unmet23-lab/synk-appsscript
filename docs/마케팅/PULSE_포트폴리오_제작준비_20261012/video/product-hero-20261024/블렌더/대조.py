"""원본 첫 프레임 | 우리 렌더를 나란히(격자 · 반투명 겹침) 놓아 구도를 맞춘다. 원본 프레임이 들어가 결과는 git 밖에만.

  python 대조.py <원본.jpg> <우리.png> <나갈.jpg> [--겹침]
"""
import sys

from PIL import Image, ImageDraw


def main():
    a, b, out = sys.argv[1:4]
    over = "--겹침" in sys.argv
    A = Image.open(a).convert("RGB")
    B = Image.open(b).convert("RGB")
    h = 768
    A = A.resize((round(A.width * h / A.height), h))
    B = B.resize((round(B.width * h / B.height), h))
    panels = [A, B]
    if over:
        panels.append(Image.blend(A, B.resize(A.size), 0.5))
    W = sum(p.width for p in panels) + 8 * (len(panels) - 1)
    s = Image.new("RGB", (W, h), (255, 255, 255))
    x = 0
    for p in panels:
        s.paste(p, (x, 0))
        d = ImageDraw.Draw(s)
        for k in range(1, 4):
            d.line([(x, k * h // 4), (x + p.width, k * h // 4)], fill=(255, 230, 0), width=1)
            d.line([(x + k * p.width // 4, 0), (x + k * p.width // 4, h)], fill=(255, 230, 0), width=1)
        x += p.width + 8
    s.save(out, quality=90)


if __name__ == "__main__":
    main()
