"""탭 아이콘 시안: 솔리오 구 · 몽글. 큰 판(1024)에 그려 16 · 32 · 48로 줄인다."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
OUT = Path(__file__).parent / '시안'
REPO = Path(r'C:/Users/q1212/Documents/SYNK-appsscript')
N = 1024


def radial(n, cx, cy, stops):
    """원 중심 (cx,cy)(0~1)에서 반지름 n 기준 거리로 색을 섞는다. stops = [(t, (r,g,b)), …]"""
    y, x = np.mgrid[0:n, 0:n] / n
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    # CSS radial-gradient(circle at …) farthest-corner 크기
    far = max(np.hypot(cx - a, cy - b) for a in (0, 1) for b in (0, 1))
    t = np.clip(d / far, 0, 1)
    out = np.zeros((n, n, 3))
    for i in range(3):
        out[..., i] = np.interp(t, [s[0] for s in stops], [s[1][i] for s in stops])
    return out


def solio(rim=0.0, eye=0.125, pad=0.04):
    """작은 구 정본(orb-face.css .ofc-orb): 34% 30%에서 #3b3b38 → 46% #171716 → #050505, 점 눈 지름 3/24, 가운데 높이 11.5/24, 좌우 9.5/24 · 14.5/24"""
    n = N
    s = int(n * (1 - 2 * pad))
    o = int(n * pad)
    col = radial(s, .34, .30, [(0, (0x3b, 0x3b, 0x38)), (.46, (0x17, 0x17, 0x16)), (1, (5, 5, 5))])
    body = Image.fromarray(col.astype('uint8'), 'RGB').convert('RGBA')
    m = Image.new('L', (s, s), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s - 1, s - 1), fill=255)
    if rim:
        # 가장자리 빛: 구 겉의 얇고 부드러운 빛(어두운 탭에서 윤곽이 보이게). 위쪽이 조금 더 밝다
        y, x = np.mgrid[0:s, 0:s] / s
        d = np.sqrt((x - .5) ** 2 + (y - .5) ** 2) / .5
        band = np.clip((d - (1 - .16)) / .16, 0, 1) ** 2.2
        lift = 0.55 + 0.45 * np.clip(1 - y * 1.2, 0, 1)
        a = (band * lift * rim)[..., None]
        paper = np.array([0xF3, 0xF1, 0xEC])
        arr = np.asarray(body.convert('RGB')).astype(float)
        arr = arr * (1 - a) + paper * a
        body = Image.fromarray(arr.astype('uint8'), 'RGB').convert('RGBA')
    body.putalpha(m)
    d = ImageDraw.Draw(body)
    r = eye * s / 2
    for cx in (9.5 / 24, 14.5 / 24):
        d.ellipse((cx * s - r, 11.5 / 24 * s - r, cx * s + r, 11.5 / 24 * s + r), fill=(0xF3, 0xF1, 0xEC, 235))
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    img.alpha_composite(body, (o, o))
    return img


def mongle(pad=0.03):
    """몽글 정본의 실루엣(알파)을 납작한 코랄로 채우고 검은 구슬 눈을 얹는다. 펠트 결은 넣지 않는다."""
    src = Image.open(REPO / 'docs/캐릭터/정본_4K/몽글_본체.png').convert('RGBA')
    a = src.split()[3]
    bb = a.getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    side = max(w, h)
    cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    box = (int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))
    a = a.crop(box).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(side / 600))
    s = int(N * (1 - 2 * pad))
    a = a.resize((s, s), Image.LANCZOS)
    y, x = np.mgrid[0:s, 0:s] / s
    # 코랄: 위 왼쪽이 조금 밝고 아래가 조금 깊다(정본의 빛 방향)
    hi, mid, lo = np.array([0xF2, 0x84, 0x70]), np.array([0xE6, 0x68, 0x58]), np.array([0xC8, 0x4A, 0x45])
    t = np.clip(np.sqrt((x - .38) ** 2 + (y - .22) ** 2) / .85, 0, 1)[..., None]
    col = np.where(t < .5, hi + (mid - hi) * (t / .5), mid + (lo - mid) * ((t - .5) / .5))
    body = Image.fromarray(col.astype('uint8'), 'RGB').convert('RGBA')
    body.putalpha(a)
    d = ImageDraw.Draw(body)
    # 눈 자리: 정본 512판 기준 (190,182) · (320,182), 지름 약 40 — 정본 실루엣 박스 안의 비율로 옮긴다
    sc = 4096 / 512
    for ex in (190, 320):
        exs, eys = (ex * sc - box[0]) / side * s, (182 * sc - box[1]) / side * s
        r = 0.075 * s
        d.ellipse((exs - r, eys - r, exs + r, eys + r), fill=(0x14, 0x10, 0x10, 255))
        hr = r * .32
        d.ellipse((exs - r * .35 - hr, eys - r * .38 - hr, exs - r * .35 + hr, eys - r * .38 + hr), fill=(255, 255, 255, 150))
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    o = int(N * pad)
    img.alpha_composite(body, (o, o))
    return img


def tile(icon, bg=(0xF5, 0xF1, 0xE8, 255), radius=.22, inset=.12):
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, N - 1, N - 1), radius=int(N * radius), fill=255)
    base = Image.new('RGBA', (N, N), bg)
    base.putalpha(m)
    img.alpha_composite(base)
    k = int(N * (1 - 2 * inset))
    img.alpha_composite(icon.resize((k, k), Image.LANCZOS), (int(N * inset), int(N * inset)))
    return img


V = {
    'solio': solio(rim=.0),
    'solio_rim': solio(rim=.55),
    'solio_tile': tile(solio(rim=0, pad=0)),
    'mongle': mongle(),
}
for k, im in V.items():
    im.save(OUT / f'{k}_1024.png')
    for z in (16, 32, 48, 180):
        im.resize((z, z), Image.LANCZOS).save(OUT / f'{k}_{z}.png')
print('ok', list(V))
