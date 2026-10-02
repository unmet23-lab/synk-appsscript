"""SNS 키트 자산 준비 — 승인 원본에서 키트용 사본·파생본을 만든다.

쓰는 법:  python tools/SNS키트_자산준비.py
결과:     docs/디자인/SNS키트/assets/

- 원본은 바꾸지 않는다. 키트 폴더에는 사본(같은 파일)과 크기만 줄인 파생본만 둔다.
- 마스코트는 docs/캐릭터/정본_4K(4096², 투명)에서 1400px webp로 줄인다. 투명 영역은 그대로 둔다.
- 사업별 펠트 물건 누끼·자수 로고는 synk.im(SYNK-website/dist/assets)의 공개본을 복사한다.
- 유호님 사진은 실제 인터뷰 4K 마스터(1:23.5) 한 프레임을 4:5로 잘라 쓴다. 합성 얼굴은 쓰지 않는다.
  다른 사진이 필요하면 바탕화면 HappyGangster_20260930/얼굴세트의 승인 얼굴이나 실제 사진만 쓴다.
"""
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', '디자인', 'SNS키트', 'assets')
WEB = os.path.join(os.path.dirname(ROOT), 'SYNK-website', 'dist', 'assets')
TOOL = os.path.join(ROOT, 'docs', '마케팅', '맞춤도구', 'assets')
MASCOT = os.path.join(ROOT, 'docs', '캐릭터', '정본_4K')
INTERVIEW = 'C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision9/render/SYNK_Founder_Film_4K60_v9.mp4'

COPY = [
    # (원본 폴더, 원본 이름, 키트 이름)
    (TOOL, 'thread-shift.webp', 'thread-lapis.webp'),
    (TOOL, 'sticker-adapt.webp', 'sticker-adapt.webp'),
    (TOOL, 'sticker-book.webp', 'sticker-book.webp'),
    (TOOL, 'sticker-check.webp', 'sticker-check.webp'),
    (TOOL, 'sticker-envelope.webp', 'sticker-envelope.webp'),
    (TOOL, 'sticker-person.webp', 'sticker-person.webp'),
    (TOOL, 'sticker-search.webp', 'sticker-search.webp'),
    (TOOL, 'sticker-time.webp', 'sticker-time.webp'),
    (TOOL, 'laptop-felt.webp', 'felt-laptop.webp'),
    (WEB, 'brand-synk.webp', 'logo-synk.webp'),
    (WEB, 'brand-synk-paper.webp', 'logo-synk-paper.webp'),
    (WEB, 'brand-lab.webp', 'logo-lab.webp'),
    (WEB, 'brand-shift.webp', 'logo-shift.webp'),
    (WEB, 'brand-pulse.webp', 'logo-pulse.webp'),
    (WEB, 'brand-path.webp', 'logo-path.webp'),
    (WEB, 'embroidered-lab-20260918.webp', 'stitch-lab.webp'),
    (WEB, 'embroidered-shift-20260918.webp', 'stitch-shift.webp'),
    (WEB, 'embroidered-pulse-20260918.webp', 'stitch-pulse.webp'),
    (WEB, 'embroidered-path-20260918.webp', 'stitch-path.webp'),
    (os.path.join(WEB, 'index'), 'lab-object-cut-20260930.webp', 'hero-lab.webp'),
    (os.path.join(WEB, 'index'), 'shift-work-hero-cut-20260930.webp', 'hero-shift.webp'),
    (os.path.join(WEB, 'index'), 'pulse-listening-hero-cut-20260930.webp', 'hero-pulse.webp'),
    (os.path.join(WEB, 'index'), 'path-vr-hero-cut-20260930.webp', 'hero-path.webp'),
]

MASCOTS = ['몽글_본체', '몽글_놀람', '몽글_눈웃음', '몽글_집중', '몽글_궁금함', '몽글_응원',
           '까몽_본체', '까몽_눈웃음', '마린_본체', '마린_눈웃음']


def copy_assets():
    for folder, name, dest in COPY:
        src = os.path.join(folder, name)
        if not os.path.exists(src):
            sys.exit(f'원본이 없다: {src}')
        shutil.copyfile(src, os.path.join(OUT, dest))
        print('복사', dest)


def mascots():
    for name in MASCOTS:
        src = os.path.join(MASCOT, name + '.png')
        if not os.path.exists(src):
            print('없음(건너뜀)', name)
            continue
        im = Image.open(src).convert('RGBA')
        bbox = im.getchannel('A').getbbox()
        im = im.crop(bbox)
        im.thumbnail((1400, 1400), Image.LANCZOS)
        dest = os.path.join(OUT, 'mascot-' + name + '.webp')
        im.save(dest, quality=92, method=6)
        print('마스코트', os.path.basename(dest), im.size)


def interview_portrait():
    if not os.path.exists(INTERVIEW):
        print('인터뷰 마스터가 없어 사진을 건너뜀')
        return
    tmp = os.path.join(OUT, '_frame.png')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', '83.5', '-i', INTERVIEW,
                    '-frames:v', '1', tmp], check=True)
    im = Image.open(tmp).convert('RGB')
    # 얼굴 중심 x≈2200, 눈 높이 y≈560(4K). 4:5로 자르고 승인본의 어두운 색보정만 조금 밝힌다.
    im = im.crop((1580, 80, 2820, 1630))
    im = ImageEnhance.Brightness(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im.thumbnail((1240, 1550), Image.LANCZOS)
    im.save(os.path.join(OUT, 'photo-yuho-interview-front.webp'), quality=90, method=6)
    os.remove(tmp)
    print('인터뷰 사진', im.size)


# 실땀 색. DESIGN §2: 스티치는 2027 실(청금석·메도우·버터·팝)과 코랄에서 고른다.
# 원본 실땀 사진(청금석)의 밝기 결은 그대로 두고, 그늘·몸통·보풀 빛 세 값으로 다시 칠한다.
THREADS = {
    'lapis-soft': ('#7f9fe0', '#c5d6f5', '#eef3fd'),
    'coral': ('#ae322a', '#f96859', '#fbb7a3'),
    'coral-soft': ('#e0806f', '#fbb7a3', '#fff1ec'),
    'butter': ('#7e5a10', '#f5c445', '#ffebb0'),
    'butter-soft': ('#d9a531', '#ffebb0', '#fffaf0'),
    'pop-soft': ('#d47aa6', '#f8c7de', '#fff2f8'),
    'meadow-soft': ('#7db45a', '#d3e8be', '#f6fbf0'),
}


def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def threads():
    src = Image.open(os.path.join(OUT, 'thread-lapis.webp')).convert('RGBA')
    px = src.load()
    w, h = src.size
    lum = [[0.0] * w for _ in range(h)]
    vals = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 16:
                v = 0.2126 * r + 0.7152 * g + 0.0722 * b
                lum[y][x] = v
                vals.append(v)
    vals.sort()
    lo, hi = vals[int(len(vals) * 0.02)], vals[int(len(vals) * 0.98)]
    for name, (deep, base, soft) in THREADS.items():
        d, m, s = _rgb(deep), _rgb(base), _rgb(soft)
        out = Image.new('RGBA', (w, h))
        op = out.load()
        for y in range(h):
            for x in range(w):
                a = px[x, y][3]
                if a == 0:
                    continue
                t = min(1.0, max(0.0, (lum[y][x] - lo) / max(1.0, hi - lo)))
                if t < 0.5:
                    k = t / 0.5
                    c = tuple(round(d[i] + (m[i] - d[i]) * k) for i in range(3))
                else:
                    k = (t - 0.5) / 0.5
                    c = tuple(round(m[i] + (s[i] - m[i]) * k) for i in range(3))
                op[x, y] = (*c, a)
        out.save(os.path.join(OUT, f'thread-{name}.webp'), quality=92, method=6)
        print('실땀', name)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    copy_assets()
    mascots()
    interview_portrait()
    threads()
