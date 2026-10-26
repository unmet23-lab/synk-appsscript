# 빈 무대 사진에서 「앞에 있는 물건」만 오려 가림 겹을 만든다 — 주민이 그 뒤로 지나가면 이 겹이 위에 그려진다.
# 각 겹은 사진 좌표 그대로(x, y, w, h)이고 base는 그 물건이 바닥에 닿는 높이(그림 순서 기준)다.
#   python -I occluders.py <낮 사진> <비 사진> <나올 폴더>
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

day, rain, out = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 1536, 1024

def poly_mask(shapes):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for kind, v in shapes:
        if kind == 'ellipse': x, y, rx, ry = v; d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=255)
        elif kind == 'rect': d.rounded_rectangle(v, radius=4, fill=255)
        else: d.polygon(v, fill=255)
    return np.asarray(m) > 0

def coral_mask(box):
    x0, y0, x1, y1 = box; hsv = np.asarray(Image.open(day).convert('RGB').convert('HSV')).astype(np.float32)
    h, s = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255
    m = ((h < 22) | (h > 340)) & (s > .28); keep = np.zeros_like(m); keep[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    keep = ndi.binary_closing(keep, iterations=3); keep = ndi.binary_fill_holes(keep)
    lab, n = ndi.label(keep); sizes = ndi.sum(keep, lab, range(1, n + 1)); return lab == (1 + int(np.argmax(sizes)))

LAYERS = [
    ('table', [('ellipse', (771, 551, 71, 23)), ('poly', [(727, 558), (817, 558), (811, 627), (733, 627)])], 626),
    ('stool-left', [('rect', (655, 566, 718, 593)), ('rect', (660, 588, 714, 622))], 621),
    ('stool-right', [('rect', (831, 580, 898, 607)), ('rect', (836, 602, 893, 640))], 639),
    ('post-left', [('rect', (556, 360, 593, 606))], 606),
    ('post-right', [('rect', (970, 350, 1000, 604))], 604),
]
meta = []
for name, shapes, base in LAYERS + [('awning', 'coral', 612)]:
    m = coral_mask((535, 318, 1005, 404)) if shapes == 'coral' else poly_mask(shapes)
    a = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))
    ys, xs = np.nonzero(m); box = (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max()) + 3, int(ys.max()) + 3)
    for tag, src in (('day', day), ('rain', rain)):
        im = Image.open(src).convert('RGBA'); im.putalpha(a); im.crop(box).save(f'{out}/occ-{name}-{tag}.png')
    meta.append({'id': name, 'x': box[0], 'y': box[1], 'w': box[2] - box[0], 'h': box[3] - box[1], 'base': base})
json.dump(meta, open(f'{out}/occluders.json', 'w'), indent=1)
# A check picture: every layer tinted over the day photo.
chk = Image.open(day).convert('RGBA'); tint = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for i, l in enumerate(meta):
    o = Image.open(f'{out}/occ-{l["id"]}-day.png'); c = Image.new('RGBA', o.size, [(255, 60, 60, 120), (60, 200, 255, 120), (80, 255, 80, 120), (255, 220, 0, 120), (200, 80, 255, 120), (255, 255, 255, 140)][i % 6])
    c.putalpha(Image.fromarray((np.asarray(o.split()[3]) * .55).astype(np.uint8))); tint.alpha_composite(c, (l['x'], l['y']))
chk.alpha_composite(tint); chk.convert('RGB').crop((500, 300, 1060, 700)).resize((1120, 800)).save(f'{out}/_occ_check.jpg', quality=85)
print(json.dumps(meta))
