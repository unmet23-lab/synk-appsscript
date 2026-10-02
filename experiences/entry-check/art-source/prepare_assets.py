# -*- coding: utf-8 -*-
"""입장 검사 자산 정리 — 구운 판(raw/)과 오린 부품(cut/)을 게임에서 쓰는 크기로 줄여 assets/에 낸다.

python experiences/entry-check/art-source/prepare_assets.py

- 알파는 손실 압축하지 않는다(webp alpha_quality=100). 손실 알파는 바깥에 흰 네모가 살아난다(2026-09-08 실측).
- 손님 판은 투명 바탕으로 구웠다. 덩어리를 찾아 사분면으로 묶고(오리 엄마+아기처럼 둘이 한 칸), 옅은 보풀 알파(<8)는 걷는다.
- 승인 원본(마스코트·로고·펠트 부품)은 복사본을 줄여서 쓰고 원본은 건드리지 않는다.
"""
import json, os, shutil, glob
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(GAME, '..', '..'))
OUT = os.path.join(GAME, 'assets')
RAW = os.path.join(HERE, 'raw')


def latest(prefix):
    files = sorted(glob.glob(os.path.join(RAW, prefix + '_*.png')))
    if not files:
        raise SystemExit('구운 판이 없다: ' + prefix)
    return files[-1]


def save_webp(im, path, quality=90):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.mode == 'RGBA':
        im.save(path, 'WEBP', quality=quality, alpha_quality=100, method=6)
    else:
        im.convert('RGB').save(path, 'WEBP', quality=quality, method=6)
    return os.path.getsize(path)


def fit(im, max_w, max_h):
    r = min(max_w / im.width, max_h / im.height, 1.0)
    if r < 1:
        im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    return im


report = {'부품': {}, '손님': {}, '장면': {}, '복사': []}

# 1) 오린 펠트 부품 → 쓰는 크기의 약 2~3배
PART_SIZE = {
    'tools': {'stamp-pass': 360, 'stamp-reject': 360, 'badge-pass': 200, 'badge-reject': 200, 'magnifier': 160,
              'clock': 160, 'memo': 220, 'bell': 160, 'heart': 120, 'drop': 120, 'sparkle': 120, 'dots': 140,
              'pin-coral': 96, 'pin-butter': 96},
    'items1': None, 'items2': None,
}
for folder, sizes in PART_SIZE.items():
    for f in sorted(glob.glob(os.path.join(HERE, 'cut-fixed', folder, '*.webp'))):
        name = os.path.splitext(os.path.basename(f))[0]
        side = (sizes or {}).get(name, 240)
        im = fit(Image.open(f).convert('RGBA'), side, side)
        dst = os.path.join(OUT, 'felt' if folder == 'tools' else 'items', name + '.webp')
        report['부품'][name] = {'크기': im.size, '바이트': save_webp(im, dst)}

# 2) 손님(투명 판) → 사분면별 한 장
CAST = {
    '손님1': ['bear', 'raccoon', 'rabbit', 'fox'],
    '손님2': ['squirrel', 'hedgehog', 'penguin', 'ducks'],
    '손님3': ['otter', 'deer', 'panda', 'sheep'],
}
for board, names in CAST.items():
    src = Image.open(latest(board)).convert('RGBA')
    a = np.asarray(src).copy()
    alpha = a[:, :, 3]
    alpha[alpha < 8] = 0
    a[:, :, 3] = alpha
    H, W = alpha.shape
    for qi, name in enumerate(names):
        qy, qx = divmod(qi, 2)
        # 사분면 안에 중심이 있는 픽셀만 그 손님으로 본다(넘친 꼬리는 사분면 경계 밖 여유 12%까지 허용)
        y0, y1 = int(max(0, qy * H / 2 - H * .12)), int(min(H, (qy + 1) * H / 2 + H * .12))
        x0, x1 = int(max(0, qx * W / 2 - W * .12)), int(min(W, (qx + 1) * W / 2 + W * .12))
        region = a[y0:y1, x0:x1].copy()
        m = region[:, :, 3] > 24
        # 이웃 사분면의 덩어리를 빼려고, 사분면 중심에서 이어진 덩어리만 남긴다
        from scipy import ndimage
        lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=6))
        cy, cx = (qy * H / 2 + H / 4) - y0, (qx * W / 2 + W / 4) - x0
        keep = set()
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab == i)
            if not len(ys):
                continue
            # 덩어리 무게중심이 이 사분면 안이면 이 손님의 일부(오리 엄마와 아기 = 두 덩어리)
            gy, gx = ys.mean() + y0, xs.mean() + x0
            if qy * H / 2 <= gy < (qy + 1) * H / 2 and qx * W / 2 <= gx < (qx + 1) * W / 2:
                keep.add(i)
        mask = np.isin(lab, list(keep))
        region[:, :, 3] = np.where(mask, region[:, :, 3], 0)
        ys, xs = np.nonzero(region[:, :, 3] > 0)
        pad = 10
        top, bot = max(0, ys.min() - pad), min(region.shape[0], ys.max() + pad)
        left, right = max(0, xs.min() - pad), min(region.shape[1], xs.max() + pad)
        im = Image.fromarray(region[top:bot, left:right])
        im = fit(im, 560, 720)
        dst = os.path.join(OUT, 'cast', name + '.webp')
        report['손님'][name] = {'크기': im.size, '바이트': save_webp(im, dst, 90)}

# 3) 근무지 장면 → 큰 화면 1600, 휴대폰 960
for scene, key in [('수영장', 'pool'), ('도서관', 'library'), ('미술관', 'museum'), ('음악회', 'concert')]:
    im = Image.open(latest(scene)).convert('RGB')
    big = save_webp(fit(im, 1600, 1100), os.path.join(OUT, 'scenes', key + '.webp'), 84)
    small = save_webp(fit(im, 960, 700), os.path.join(OUT, 'scenes', key + '-m.webp'), 82)
    report['장면'][key] = {'원본': latest(scene).split(os.sep)[-1], '큰': big, '작은': small}

# 4) 승인 원본에서 복사(줄인 사본)
COPY = [
    ('docs/디자인/SNS키트/assets/mascot-몽글_본체.webp', 'brand/mongle-body.webp', 560),
    ('docs/디자인/SNS키트/assets/mascot-몽글_눈웃음.webp', 'brand/mongle-smile.webp', 560),
    ('docs/디자인/SNS키트/assets/mascot-몽글_응원.webp', 'brand/mongle-cheer.webp', 560),
    ('docs/디자인/SNS키트/assets/mascot-몽글_궁금함.webp', 'brand/mongle-curious.webp', 560),
    ('docs/디자인/SNS키트/assets/mascot-몽글_집중.webp', 'brand/mongle-focus.webp', 560),
    ('docs/디자인/SNS키트/assets/logo-lab.webp', 'brand/logo-lab.webp', 520),
    ('docs/디자인/펠트부품/assets/ui/tex-coral.webp', 'kit/tex-coral.webp', None),
    ('docs/디자인/펠트부품/assets/ui/tex-blush.webp', 'kit/tex-blush.webp', None),
    ('docs/디자인/펠트부품/assets/배경/tex-cream.webp', 'kit/tex-cream.webp', None),
    ('docs/디자인/펠트부품/assets/배경/tex-butter.webp', 'kit/tex-butter.webp', None),
    ('docs/디자인/펠트부품/assets/ui/slab-coral-long.webp', 'kit/slab-coral-long.webp', 1400),
    ('docs/디자인/펠트부품/assets/ui/slab-cream-long.webp', 'kit/slab-cream-long.webp', 1400),
    ('docs/디자인/펠트부품/assets/ui/slab-blush-long.webp', 'kit/slab-blush-long.webp', 1400),
    ('docs/디자인/펠트부품/assets/ui/slab-cream.webp', 'kit/slab-cream.webp', 700),
    ('docs/디자인/펠트부품/assets/ui/slab-blush.webp', 'kit/slab-blush.webp', 700),
    ('docs/디자인/펠트부품/assets/ui/chip-blush-long.webp', 'kit/chip-blush-long.webp', 700),
    ('docs/디자인/펠트부품/assets/ui/badge-cream.webp', 'kit/badge-cream.webp', 160),
    ('docs/디자인/펠트부품/assets/ui/badge-coral.webp', 'kit/badge-coral.webp', 160),
    ('docs/디자인/펠트부품/assets/ui/badge-check.webp', 'kit/badge-check.webp', 160),
    ('docs/디자인/펠트부품/assets/ui/tag-cream.webp', 'kit/tag-cream.webp', 400),
]
for src, dst, side in COPY:
    s = os.path.join(REPO, src)
    d = os.path.join(OUT, dst)
    im = Image.open(s)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if side:
        im = fit(im, side, side)
    report['복사'].append({'원본': src, '사본': 'assets/' + dst, '크기': im.size, '바이트': save_webp(im, d, 90)})

with open(os.path.join(HERE, 'assets-report.json'), 'w', encoding='utf-8') as fp:
    json.dump(report, fp, ensure_ascii=False, indent=1)
print(json.dumps({k: len(v) for k, v in report.items()}, ensure_ascii=False))
