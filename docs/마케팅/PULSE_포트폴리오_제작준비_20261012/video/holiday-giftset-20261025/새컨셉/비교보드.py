# 움직임 시험 · 명품 광고와 섞은 눈가림 시험 보드 (2026-10-30)
# 영상마다 프레임 6장을 한 줄로 이은 정지컷을 만든다. 이름은 「영상 1~N」뿐이고 순서는 시험관 묶음마다 다르다.
# 명품 광고 프레임은 남의 저작물이라 보드 · 프레임 모두 git 밖에만 둔다.
#   python -I -X utf8 비교보드.py <출력 폴더> <순서 예: 2,0,3,1,4> <영상 폴더 또는 프레임 글롭>...
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = r"C:\Windows\Fonts\malgunbd.ttf"


def frames_of(src, k=6):
    files = sorted(glob.glob(os.path.join(src, "*.png")) + glob.glob(os.path.join(src, "*.jpg"))) if os.path.isdir(src) \
        else sorted(glob.glob(src))
    if not files:
        raise SystemExit(f"프레임 없음: {src}")
    idx = [round(i * (len(files) - 1) / (k - 1)) for i in range(k)]
    return [files[i] for i in idx]


def strip(files, label, h=640):
    ims = [Image.open(f).convert("RGB") for f in files]
    ims = [im.resize((round(im.width * h / im.height), h), Image.LANCZOS) for im in ims]
    gap, top = 12, 84
    W = sum(im.width for im in ims) + gap * (len(ims) + 1)
    board = Image.new("RGB", (W, h + top + gap), (14, 16, 22))
    d = ImageDraw.Draw(board)
    d.text((gap + 4, 22), label, font=ImageFont.truetype(FONT, 40), fill=(236, 236, 240))
    x = gap
    for im in ims:
        board.paste(im, (x, top))
        x += im.width + gap
    return board


def main():
    out, order, srcs = sys.argv[1], [int(v) for v in sys.argv[2].split(",")], sys.argv[3:]
    os.makedirs(out, exist_ok=True)
    for n, i in enumerate(order, 1):
        b = strip(frames_of(srcs[i]), f"영상 {n}  (3~5초를 6장으로, 왼쪽 → 오른쪽 시간 순)")
        b.save(os.path.join(out, f"정지컷_{n}.jpg"), quality=88)
    print("보드", out, "순서", order)


if __name__ == "__main__":
    main()
