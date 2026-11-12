"""캡처를 한 장으로 묶는다(2026-11-13).

python -X utf8 sheet.py 모아보기 <캡처 폴더> <a|b> <폭 1440|390> <출력.jpg> [열 수] [축소 비율]
python -X utf8 sheet.py 견줌 <캡처 폴더> <출력.jpg>      — A · B 기본 화면 · 첫 시작 · 흐름 하나를 나란히
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
FONT = ROOT / 'docs' / '브랜드_폰트' / 'SUIT' / 'SUIT-SemiBold.otf'
FONT_R = ROOT / 'docs' / '브랜드_폰트' / 'SUIT' / 'SUIT-Regular.otf'


def screens():
    text = (HERE / 'copy.mjs').read_text(encoding='utf-8')
    block = text.split('export const SCREENS = [', 1)[1].split('];', 1)[0]
    out = []
    for line in block.splitlines():
        line = line.strip()
        if line.startswith("['"):
            sid, title = line[2:].split("', '", 1)
            out.append((sid, title.rstrip("'],")))
    return out


def font(size, bold=True):
    return ImageFont.truetype(str(FONT if bold else FONT_R), size)


def fit_height(img, h):
    if img.height <= h:
        return img
    return img.crop((0, 0, img.width, h))


def contact(cap, key, width, out, cols=4, scale=None):
    suffix = '' if width > 900 else '-full'
    items = [(sid, t, cap / f'{key}-{sid}-{width}{suffix}.png') for sid, t in screens()]
    items = [i for i in items if i[2].exists()]
    if width > 900:
        scale = scale or 0.3
        tile_h = int(900 * scale)
    else:
        scale = scale or 0.3
        tile_h = int(1800 * scale)
    tile_w = int((width if width > 900 else width * 2) * scale)
    pad, label = 28, 40
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (pad + cols * (tile_w + pad), pad + rows * (tile_h + label + pad)), '#d9d9dc')
    draw = ImageDraw.Draw(sheet)
    for n, (sid, title, path) in enumerate(items):
        im = Image.open(path).convert('RGB')
        im = im.resize((tile_w, int(im.height * tile_w / im.width)), Image.LANCZOS)
        im = fit_height(im, tile_h)
        x = pad + (n % cols) * (tile_w + pad)
        y = pad + (n // cols) * (tile_h + label + pad)
        draw.text((x, y), f'{n + 1:02d}  {title}', fill='#1b1b1f', font=font(18))
        sheet.paste(im, (x, y + label))
    sheet.save(out, quality=88)
    print(out, sheet.size)


def compare(cap, out):
    pick = [('home', '기본 화면'), ('start-2', '첫 시작 · 보호 범위'), ('move-1', '옮겨 오기 · 자리 고르기'), ('undo-1', '사고 되돌리기 · 시각')]
    w = 1440 * 0.42
    h = 900 * 0.42
    pad, head, label = 36, 120, 44
    phone_w = 390 * 0.62
    sheet_w = int(pad + 2 * (w + pad + phone_w + pad))
    sheet_h = int(head + len(pick) * (h + label + pad) + pad)
    sheet = Image.new('RGB', (sheet_w, sheet_h), '#e6e6e8')
    draw = ImageDraw.Draw(sheet)
    names = {'a': 'A  확인서 — 매시간 보호 확인서 한 장이 찍힌다', 'b': 'B  눈금 — 지난 7일, 한 칸이 한 시간'}
    for col, key in enumerate('ab'):
        x0 = int(pad + col * (w + pad + phone_w + pad))
        draw.text((x0, 40), names[key], fill='#0b0b0c', font=font(30))
        for r, (sid, title) in enumerate(pick):
            y = int(head + r * (h + label + pad))
            draw.text((x0, y), title, fill='#3a3a40', font=font(20, False))
            big = cap / f'{key}-{sid}-1440.png'
            small = cap / f'{key}-{sid}-390.png'
            if big.exists():
                im = Image.open(big).convert('RGB').resize((int(w), int(h)), Image.LANCZOS)
                sheet.paste(im, (x0, y + label))
            if small.exists():
                im = Image.open(small).convert('RGB')
                im = im.resize((int(phone_w), int(im.height * phone_w / im.width)), Image.LANCZOS)
                im = fit_height(im, int(h))
                sheet.paste(im, (int(x0 + w + pad / 2), y + label))
    sheet.save(out, quality=90)
    print(out, sheet.size)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == '모아보기':
        contact(Path(sys.argv[2]), sys.argv[3], int(sys.argv[4]), Path(sys.argv[5]),
                int(sys.argv[6]) if len(sys.argv) > 6 else 4, float(sys.argv[7]) if len(sys.argv) > 7 else None)
    elif mode == '견줌':
        compare(Path(sys.argv[2]), Path(sys.argv[3]))
