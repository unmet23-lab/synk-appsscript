# 캐스팅북 「줄 세워 보기」의 전신 오리기. 사용: python -X utf8 make-cutouts.py [코드…]
# site/img/<코드>/fullbody.webp에서 사람만 오려 같은 바닥에 세울 수 있게 만든다. 새로 굽지 않으므로 승인된 얼굴이 그대로다.
#   site/img/<코드>/cut.webp    사람 상자로 자른 알파 판(가운데 사람)
#   site/img/<코드>/cut-b.webp  미리 흐린 작은 판(옆 사람 · 처음 뜨는 판)
#   cuts.json                   비율 · 번호 점 좌표 · 원본 지문(같은 원본이면 건너뛴다). 이 파일만 커밋한다(site/는 git 밖)
# build-site.cjs가 사진을 구운 뒤 이 도구를 부른다. 점 하나만 옮길 때는 catalog.json의 models.<코드>.pins에 적는다(다시 오려도 남는다).
# 오리기 고침은 현장 노트 그림_굽기_오리기 「단색 바탕에서 구운 입신을 rembg로 오리면…」을 따른다.
import hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ni

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, 'site', 'img')
BOOK = os.path.join(HERE, 'cuts.json')
SMALL_H = 360   # 흐린 판 세로
SMALL_R = 1.7   # 흐린 판 흐림(작은 판 기준 화소) — 옆 사람 얼굴이 대강 읽힐 만큼만

def mask_of(im, ses):
    from rembg import remove
    a = np.array(remove(im, session=ses, only_mask=True, post_process_mask=False)).astype(np.float32) / 255
    semi = float(((a > .04) & (a < .96)).mean())
    solid = ni.binary_fill_holes(a > .5)
    inner = ni.binary_erosion(solid, iterations=6)
    out = a.copy()
    out[inner & (a > .05)] = 1           # 바탕과 비슷한 옷이 비치지 않게 안쪽을 채운다
    holes = solid & ~(a > .5)
    lab, n = ni.label(holes)
    if n:
        sizes = ni.sum(holes, lab, range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s < 2000: out[lab == i] = 1   # 목 · 소매 안 작은 구멍만 메운다(팔과 몸 사이 큰 틈은 남긴다)
    out = ni.minimum_filter(out, 5)      # 바탕 테를 2px 깎는다
    lab, n = ni.label(out > .5)
    if n > 1:                            # 바닥에 떨어진 조각을 버리고 가장 큰 덩어리만
        sizes = ni.sum(out > .5, lab, range(1, n + 1))
        out = out * ni.binary_dilation(lab == 1 + int(np.argmax(sizes)), iterations=3)
    return ni.gaussian_filter(out, .7), semi, n

def bleed_rgb(rgb, a):
    # 가장자리 반투명 화소에 남은 바탕색을 안쪽 불투명 화소 색으로 바꾼다(흰 옷 소매의 밝은 테를 없앤다)
    solid = a > .98
    idx = ni.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    return rgb[idx[0], idx[1]]

def blur_small(rgba):
    # 알파를 곱한 뒤 흐려야 투명한 곳의 색이 번지지 않는다
    h = SMALL_H; w = max(1, round(rgba.width * h / rgba.height))
    pad = 8
    arr = np.array(rgba.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    arr = np.pad(arr, ((pad, pad), (pad, pad), (0, 0)))
    al = arr[..., 3:]
    pre = np.concatenate([arr[..., :3] * al, al], axis=2)
    pre = np.stack([ni.gaussian_filter(pre[..., c], SMALL_R) for c in range(4)], axis=2)
    a2 = pre[..., 3:]
    rgb = np.where(a2 > 1e-3, pre[..., :3] / np.maximum(a2, 1e-3), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), a2], axis=2)
    return Image.fromarray((out * 255 + .5).astype(np.uint8), 'RGBA'), pad / w, pad / h

def pins_of(a, y0, y1, x0, x1):
    h = y1 - y0 + 1; w = x1 - x0 + 1
    def extent(fy):
        xs = np.where(a[y0 + int(h * fy)] > .5)[0]
        return (int(xs.min()), int(xs.max())) if xs.size else None
    # 얼굴 점은 위 15% 안에서 가장 넓은 줄(머리)의 오른쪽 끝 — 얼굴을 가리지 않는다. 몸통 · 다리 점은 그 줄의 가운데
    rows = [(fy, extent(fy)) for fy in np.arange(.02, .15, .01)]
    rows = [(fy, e) for fy, e in rows if e]
    fy, (lo, hi) = max(rows, key=lambda r: r[1][1] - r[1][0])
    face = [round(min((hi - x0 + w * .035) / w, .97), 4), round(float(fy), 4)]
    def middle(fy):
        e = extent(fy) or (x0, x1)
        return [round(((e[0] + e[1]) / 2 - x0) / w, 4), fy]
    return {'face': face, 'look': middle(.31), 'body': middle(.70)}

def main():
    book = json.load(open(BOOK, encoding='utf-8')) if os.path.exists(BOOK) else {}
    args = sys.argv[1:]
    again = '--다시' in args  # 원본이 같아도 다시 오린다(자리 계산을 고쳤을 때)
    args = [a for a in args if a != '--다시']
    want = args or sorted(d for d in os.listdir(IMG) if len(d) == 3 and os.path.exists(os.path.join(IMG, d, 'fullbody.webp')))
    ses = None
    for code in want:
        src = os.path.join(IMG, code, 'fullbody.webp')
        sha = hashlib.sha256(open(src, 'rb').read()).hexdigest()[:12]
        cut = os.path.join(IMG, code, 'cut.webp'); small = os.path.join(IMG, code, 'cut-b.webp')
        if book.get(code, {}).get('src') == sha and os.path.exists(cut) and os.path.exists(small) and not again:
            continue
        if not ses:  # 건너뛸 때는 rembg가 없어도 빌드가 돈다
            from rembg import new_session
            ses = new_session('isnet-general-use', providers=['CPUExecutionProvider'])
        im = Image.open(src).convert('RGB')
        a, semi, parts = mask_of(im, ses)
        ys, xs = np.where(a > .5)
        y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
        rgb = bleed_rgb(np.array(im), a)
        rgba = Image.fromarray(np.dstack([rgb, (a * 255 + .5).astype(np.uint8)]), 'RGBA').crop((x0, y0, x1 + 1, y1 + 1))
        rgba.save(cut, 'WEBP', quality=84, method=6, exact=False)
        sm, px, py = blur_small(rgba)
        sm.save(small, 'WEBP', quality=70, method=6, exact=False)
        book[code] = {'src': sha, 'w': rgba.width, 'h': rgba.height, 'padX': round(px, 4), 'padY': round(py, 4), 'pins': pins_of(a, y0, y1, x0, x1)}
        print(code, rgba.size, f'반투명 {semi*100:.1f}% · 조각 {parts} · cut {os.path.getsize(cut)//1024}KB · 흐림 {os.path.getsize(small)//1024}KB', flush=True)
    lines = ',\n'.join(f'{json.dumps(k)}:{json.dumps(book[k], ensure_ascii=False, separators=(",", ":"))}' for k in sorted(book))
    with open(BOOK, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n' + lines + '\n}\n')
    print('오린 전신', len(book), '명')

main()
