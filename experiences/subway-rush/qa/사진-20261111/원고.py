"""환승 러시 사진 다시 굽기(11-11) 표지 원고 — 사진 속 표지를 장면과 한 장으로 굽게 참고로 넣는 인쇄 원고(흰 여백 JPEG).
정답(방면 이름 · 출구 번호)은 넣지 않는다: 통로 = 역 이름 띠(시청 · 1·2호선, 통로 갈림은 늘 시청), 출구 = 번호 없는 「나가는 곳」.
글꼴 Noto Sans KR(OFL, synk-vendor/fonts).  python -I -X utf8 원고.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path.home() / 'Documents' / 'SYNK-appsscript' / '.tmp' / 'subway-rush-20261111' / 'refs'   # 공용 작업본(git 밖)
OUT.mkdir(exist_ok=True)
FONT = Path.home() / 'Documents' / 'synk-vendor' / 'fonts' / 'NotoSansKR.ttf'


def font(size, weight):
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def circle(d, cx, cy, r, color, label):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    f = font(int(r * 1.35), 800)
    d.text((cx, cy + r * 0.02), label, font=f, fill='white', anchor='mm')


def station_band():
    W, H, M = 2600, 420, 120
    im = Image.new('RGB', (W + 2 * M, H + 2 * M), 'white')
    d = ImageDraw.Draw(im)
    x0, y0 = M, M
    d.rectangle((x0, y0, x0 + W, y0 + H), fill='#1b2232')
    cy = y0 + H // 2
    circle(d, x0 + 230, cy, 105, '#0052A4', '1')
    circle(d, x0 + 470, cy, 105, '#00A84D', '2')
    d.text((x0 + 650, cy + 6), '시청', font=font(250, 800), fill='white', anchor='lm')
    d.text((x0 + 1290, cy + 50), 'City Hall', font=font(130, 500), fill='#dfe4ee', anchor='ls')
    im.save(OUT / 'sign-station.jpg', quality=95)


def exit_sign():
    W, H, M = 2000, 420, 120
    im = Image.new('RGB', (W + 2 * M, H + 2 * M), 'white')
    d = ImageDraw.Draw(im)
    x0, y0 = M, M
    d.rectangle((x0, y0, x0 + W, y0 + H), fill='#24262b')
    cy = y0 + H // 2
    # 위 화살표(번호 없음)
    ax = x0 + 230
    d.polygon([(ax, cy - 140), (ax - 115, cy - 10), (ax - 42, cy - 10), (ax - 42, cy + 140), (ax + 42, cy + 140), (ax + 42, cy - 10), (ax + 115, cy - 10)], fill='#ffd400')
    d.text((x0 + 430, cy + 4), '나가는 곳', font=font(230, 800), fill='#ffd400', anchor='lm')
    d.text((x0 + 1560, cy + 60), 'Exit', font=font(140, 600), fill='white', anchor='ls')
    im.save(OUT / 'sign-exit.jpg', quality=95)


station_band()
exit_sign()
print('ok', sorted(p.name for p in OUT.iterdir()))
