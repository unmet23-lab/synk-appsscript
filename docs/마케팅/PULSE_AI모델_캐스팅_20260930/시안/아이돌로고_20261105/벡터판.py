# 타이포그래피 방향의 벡터 로고 시안 — 그림 굽기 없이 글꼴 윤곽으로 만든다(2026-11-05).
# OFALIN: 같은 글자를 네 색 윤곽으로 겹겹이 — 「한 빛에서 갈라진 네 색」.
# OUTBLUE: 넓은 글자 위에 두정갑 황동 리벳을 획 가운데로 — 「쪽빛 갑주」.
import os
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.expanduser('~/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/글꼴')
OUT = os.path.join(HERE, '벡터')
os.makedirs(OUT, exist_ok=True)


def outline(font_path, axes, text, track):
    f = instantiateVariableFont(TTFont(font_path), axes, inplace=False)
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
    x, parts = 0, []
    for c in text:
        name = cmap[ord(c)]
        pen = SVGPathPen(gs)
        gs[name].draw(pen)
        parts.append((x, pen.getCommands()))
        x += hmtx[name][0] + track
    return parts, x - track, f['OS/2'].sCapHeight


def paths(parts, attrs):
    return ''.join(f'<path transform="translate({x} 0)" d="{d}" {attrs}/>' for x, d in parts)


def svg(body, width, cap, pad, bg=None):
    vb = f'{-pad} {-cap - pad} {width + pad * 2} {cap + pad * 2}'
    rect = f'<rect x="{-pad}" y="{-cap - pad}" width="{width + pad * 2}" height="{cap + pad * 2}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{rect}<g transform="scale(1 -1) translate(0 0)">{body}</g></svg>'


# ── OFALIN: 윤곽 네 겹 ─────────────────────────────
parts, width, cap = outline(os.path.join(F, 'Fraunces.ttf'), {'opsz': 72, 'wght': 700, 'SOFT': 0, 'WONK': 0}, 'OFALIN', 90)
layers = [('#1F2A52', 92), ('#FFFFFF', 76), ('#6DBE45', 62), ('#FFFFFF', 46), ('#5B2A86', 32), ('#FFFFFF', 18), ('#6E1423', 6)]
body = ''.join(paths(parts, f'fill="{c}" stroke="{c}" stroke-width="{w}" stroke-linejoin="round"') for c, w in layers)
body += paths(parts, 'fill="#FFFFFF"')
open(os.path.join(OUT, 'O4_네겹.svg'), 'w', encoding='utf-8').write(svg(body, width, cap, 90))

# ── OUTBLUE: 리벳 ─────────────────────────────────
parts2, width2, cap2 = outline(os.path.join(F, 'Unbounded.ttf'), {'wght': 900}, 'OUTBLUE', 46)
# 획 가운데 찾기: 글자를 그림으로 찍어 거리 변환의 능선에서 고르게 고른다
S = 0.25
font = ImageFont.truetype(os.path.join(F, 'Unbounded.ttf'), int(1000 * S))
font.set_variation_by_axes([900])
upm = TTFont(os.path.join(F, 'Unbounded.ttf'))['head'].unitsPerEm
k = 1000 / upm
W, H = int(width2 * S * k) + 40, int(cap2 * S * k) + 80
dots = []
for (x0, _), c in zip(parts2, 'OUTBLUE'):
    im = Image.new('L', (int(font.getlength(c)) + 40, H), 0)
    ImageDraw.Draw(im).text((20, H - 40), c, font=font, fill=255, anchor='ls')
    a = np.array(im) > 128
    dist = ndimage.distance_transform_edt(a)
    keep = (dist >= ndimage.maximum_filter(dist, size=5)) & (dist > dist.max() * 0.55)
    ys, xs = np.nonzero(keep)
    order = np.argsort(xs + ys * 0.001)
    spacing = 52 * S / 0.25 * 0.25 * 3.4
    chosen = []
    for i in order:
        p = (xs[i], ys[i])
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= spacing ** 2 for q in chosen):
            chosen.append(p)
    for px, py in chosen:
        dots.append((x0 + (px - 20) / (S * k), ((H - 40) - py) / (S * k)))
rivets = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="21" fill="#D9B46A"/><circle cx="{x - 5:.1f}" cy="{y + 6:.1f}" r="7" fill="#F6E4B5"/>' for x, y in dots)
body2 = paths(parts2, 'fill="#1646C8"') + rivets
open(os.path.join(OUT, 'B4_리벳.svg'), 'w', encoding='utf-8').write(svg(body2, width2, cap2, 60))
print('O4', round(width), 'B4', round(width2), '리벳', len(dots))
