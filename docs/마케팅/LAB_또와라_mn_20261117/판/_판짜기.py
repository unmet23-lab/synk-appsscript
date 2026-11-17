# M60 판 짜기 — 2:3 구운 판(1024×1536)을 1080×1920 jpg로 쓴다(E42 _판짜기.py에서 가져옴).
# 기본: 1.25배(1280×1920)로 키워 가로 x0~x0+1080을 자른다(x0 기본 80, @x0로 옮긴다).
# ~fit: 인물이 양 끝까지 있는 판 — 자르지 않고 폭 1080에 맞춰(1080×1620) 아래에 두고, 위 300px는 판 맨 위 빈 벽 띠를 늘여 채운다.
# 쓰는 법: python -I -X utf8 _판짜기.py <판 폴더> <img 폴더> b1=b1_100142~fit a1=a1_095910@0 a2=a2_100142 …
import sys
from pathlib import Path
from PIL import Image, ImageFilter

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
for pair in sys.argv[3:]:
    name, stem = pair.split('=')
    fit = stem.endswith('~fit')
    stem = stem.removesuffix('~fit')
    x0 = 80
    if '@' in stem:
        stem, x0 = stem.split('@')
        x0 = int(x0)
    im = Image.open(src / f'{stem}.png').convert('RGB')
    assert im.size == (1024, 1536), (stem, im.size)
    if fit:
        body = im.resize((1080, 1620), Image.LANCZOS)
        띠 = body.crop((0, 0, 1080, 60)).resize((1080, 300), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
        out = Image.new('RGB', (1080, 1920))
        out.paste(띠, (0, 0))
        out.paste(body, (0, 300))
        # 이음매를 부드럽게 — 띠 아래 40px를 판 위쪽과 섞는다
        for k in range(40):
            a = k / 40
            row_b = body.crop((0, 0, 1080, 1))
            row_t = 띠.crop((0, 299, 1080, 300))
            out.paste(Image.blend(row_t, row_b, a), (0, 260 + k))
        im = out
    else:
        im = im.resize((1280, 1920), Image.LANCZOS).crop((x0, 0, x0 + 1080, 1920))
    im.save(dst / f'{name}.jpg', quality=92)
    print(name, '←', stem, 'fit' if fit else f'x0={x0}')
