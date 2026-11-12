# 고객 앱 의뢰서 큰 칸의 장면 사진 큰 판(model-scene-<id>-l.webp, 폭 1600)을 캐스팅북 원본에서 굽는다.
# 사용: python make-request-scene-large.py [--check]
#
# 작은 판(model-scene-<id>.webp, 폭 960)은 캐스팅북 context 사진을 줄인 것이다. 큰 칸은 화소비가 높은 큰 화면
# (맥북 프로 16형 · 4K 150% · 5K)에서 이 판을 실제 화소의 1.5배 넘게 늘려 그려서, 그런 화면만 srcset으로 큰 판을 받는다
# (request-flow.mjs SCENE_SIZES). 폭 1600이면 5K(2560×1320 @2)의 큰 칸 1127×1320도 1.41배다.
# 원본은 jobs/_img-manifest.json이 site/img/<코드>/context.webp마다 적어 둔 PNG · JPG(raw/는 저장소 밖)다.
# 같은 원본의 같은 비율이라 작은 판과 그림이 같아야 한다 — 줄여서 맞대 보고 다르면 멈춘다.
# --check: 굽지 않고 큰 판이 모두 있는지 · 크기 · 작은 판과 같은 그림인지만 본다(종료 코드 1이면 빠짐).
import json, math, os, sys
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', '온라인마케팅지도', 'engagement', 'company', 'public', 'pulse-app', 'assets', 'request')
WIDTH, QUALITY = 1600, 72

def sources():
    manifest = json.load(open(os.path.join(HERE, 'jobs', '_img-manifest.json'), encoding='utf-8'))
    out = {}
    for dst, key in manifest.items():
        parts = dst.replace(chr(92), '/').split('/')
        if parts[-1] == 'context.webp':
            out[parts[-2].lower()] = key[0]
    return out

def thumb(im):
    return ImageOps.fit(im.convert('L'), (80, 99), centering=(0.5, 0.5))

def distance(a, b):
    pa, pb = a.load(), b.load()
    return math.sqrt(sum((pa[x, y] - pb[x, y]) ** 2 for y in range(a.size[1]) for x in range(a.size[0])) / (a.size[0] * a.size[1]))

def main():
    check = '--check' in sys.argv[1:]
    src, bad, made = sources(), [], 0
    codes = sorted(n[len('model-scene-'):-len('.webp')] for n in os.listdir(APP) if n.startswith('model-scene-') and n.endswith('.webp') and not n.endswith('-l.webp'))
    for code in codes:
        small_path = os.path.join(APP, f'model-scene-{code}.webp')
        large_path = os.path.join(APP, f'model-scene-{code}-l.webp')
        small = Image.open(small_path)
        if check:
            if not os.path.exists(large_path):
                bad.append(f'{code}: 큰 판 없음'); continue
            large = Image.open(large_path)
        else:
            raw_path = src.get(code)
            if not raw_path or not os.path.exists(raw_path):
                bad.append(f'{code}: 원본 없음({raw_path})'); continue
            raw = Image.open(raw_path).convert('RGB')
            if abs(raw.width / raw.height - small.width / small.height) > 0.005:
                bad.append(f'{code}: 원본 비율 {raw.size}이 작은 판 {small.size}과 다르다'); continue
            if raw.width < WIDTH:
                bad.append(f'{code}: 원본 폭 {raw.width} < {WIDTH}'); continue
            large = raw.resize((WIDTH, round(WIDTH * raw.height / raw.width)), Image.LANCZOS)
        d = distance(thumb(small), thumb(large))
        if large.width != WIDTH or abs(large.width / large.height - small.width / small.height) > 0.005 or d > 2:
            bad.append(f'{code}: 큰 판 {large.size} · 작은 판 {small.size} · 차이 {d:.2f}'); continue
        if not check:
            large.save(large_path, 'WEBP', quality=QUALITY, method=6)
            made += 1
        print(f'{code} {large.size[0]}×{large.size[1]} {os.path.getsize(large_path) if os.path.exists(large_path) else 0}B 차이 {d:.2f}')
    for line in bad:
        print('빠짐', line)
    print(('확인' if check else f'구움 {made}'), f'· {len(codes)}명 · 빠짐 {len(bad)}')
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
