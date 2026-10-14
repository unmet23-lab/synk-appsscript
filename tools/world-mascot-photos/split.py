# 표정 판 나누기: 흰 줄로 칸을 찾고, 칸마다 첫 칸에 맞춰 정렬(ECC)한 뒤 「첫 칸과 다른 곳(얼굴)」만 덮어
# 몸·배경은 모든 표정에서 같은 화소가 되게 한다(표정이 바뀌어도 몸이 흔들리지 않는다).
# 사용: python split.py <판 이름> <열> <행> <표정이름,...> [--size=512] [--crop=x0,y0,x1,y1(칸 비율)] [--free]
#   --free: 칸끼리 합치지 않고 따로 낸다(장면이 칸마다 다른 판).
# 결과: cut/<판>/<표정>.webp(+ .png 원본 크기), cut/<판>/_check.jpg
import os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
name, cols, rows, names = args[0], int(args[1]), int(args[2]), args[3].split(',')
size = int(opts.get('size', 512))
board = cv2.imdecode(np.fromfile(os.path.join(ROOT, 'boards', name + '.png'), np.uint8), cv2.IMREAD_COLOR)
H, W = board.shape[:2]
out_dir = os.path.join(ROOT, 'cut', name)
os.makedirs(out_dir, exist_ok=True)


def gutters(profile, n, length):
    # 흰 줄: 거의 흰(>=235) 화소 비율이 높은 줄. 예상 위치 근처에서 가장 흰 띠를 고른다.
    cuts = [0]
    for k in range(1, n):
        guess = int(length * k / n)
        lo, hi = guess - length // (n * 4), guess + length // (n * 4)
        seg = profile[lo:hi]
        white = np.where(seg > .9)[0]
        if len(white):
            # 가장 긴 연속 흰 띠의 가운데
            runs, start = [], white[0]
            for a, b in zip(white, white[1:]):
                if b != a + 1:
                    runs.append((start, a)); start = b
            runs.append((start, white[-1]))
            s, e = max(runs, key=lambda r: r[1] - r[0])
            cuts.append((lo + s, lo + e))
        else:
            cuts.append((guess - 1, guess + 1))
    cuts.append(length)
    spans = []
    for k in range(n):
        a = 0 if k == 0 else cuts[k][1] + 1
        b = length if k == n - 1 else cuts[k + 1][0]
        spans.append((a, b))
    return spans


gray = cv2.cvtColor(board, cv2.COLOR_BGR2GRAY)
colw = (gray >= 235).mean(axis=0)
roww = (gray >= 235).mean(axis=1)
xs, ys = gutters(colw, cols, W), gutters(roww, rows, H)
cells = []
for r in range(rows):
    for c in range(cols):
        (x0, x1), (y0, y1) = xs[c], ys[r]
        cell = board[y0:y1, x0:x1]
        # 칸 가장자리의 남은 흰 줄 2px 걷기
        cells.append(cell[2:-2, 2:-2])
h = min(c.shape[0] for c in cells); w = min(c.shape[1] for c in cells)
cells = [cv2.resize(c, (w, h), interpolation=cv2.INTER_AREA) if c.shape[:2] != (h, w) else c for c in cells]
print('칸', len(cells), w, 'x', h)

base = cells[0]
results = [base]
masks = [np.zeros((h, w), np.float32)]
if 'free' not in opts:
    g0 = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    for i, cell in enumerate(cells[1:], 1):
        g1 = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        warp = np.eye(2, 3, dtype=np.float32)
        try:
            _, warp = cv2.findTransformECC(cv2.GaussianBlur(g0, (0, 0), 2), cv2.GaussianBlur(g1, (0, 0), 2), warp,
                                           cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), None, 5)
        except cv2.error as e:
            print('정렬 실패', i, e)
        aligned = cv2.warpAffine(cell, warp, (w, h), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
        # 다른 곳 = 색 차이(흐리게 잰다). 큰 덩어리만 남기고 넓혀서 부드럽게.
        d = cv2.absdiff(cv2.GaussianBlur(aligned, (0, 0), 3), cv2.GaussianBlur(base, (0, 0), 3)).astype(np.float32).max(axis=2)
        m = (d > float(opts.get('thr', 28))).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
        keep = np.zeros_like(m)
        for k in range(1, n):
            if stats[k, cv2.CC_STAT_AREA] >= w * h * 0.0015:
                keep[lab == k] = 1
        keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
        keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
        soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 7)
        soft = np.clip(soft * 1.4, 0, 1)[..., None]
        comp = (aligned.astype(np.float32) * soft + base.astype(np.float32) * (1 - soft)).astype(np.uint8)
        results.append(comp)
        masks.append(soft[..., 0])
        print(i, names[i], '바뀐 면적 %.1f%%' % (soft.mean() * 100), '정렬', np.round(warp, 3).tolist())
else:
    results = cells

crop = opts.get('crop')
for img, nm in zip(results, names):
    if crop:
        x0, y0, x1, y1 = [float(v) for v in crop.split(',')]
        img = img[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    rgb = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    rgb.save(os.path.join(out_dir, nm + '.png'))
    s = rgb.copy()
    if s.width > size or s.height > size:
        s.thumbnail((size, size), Image.LANCZOS)
    s.save(os.path.join(out_dir, nm + '.webp'), quality=86, method=6)
# 확인 판: 결과 + 바뀐 곳 표시
tiles = []
for img, m in zip(results, masks):
    t = img.copy()
    edge = cv2.Canny((m * 255).astype(np.uint8), 50, 150)
    t[edge > 0] = (0, 255, 255)
    tiles.append(cv2.resize(t, (w // 2, h // 2)))
rows_img = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
rows_img = [np.pad(r, ((0, 0), (0, tiles[0].shape[1] * cols - r.shape[1]), (0, 0))) for r in rows_img]
check = np.vstack(rows_img)
cv2.imencode('.jpg', check, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(os.path.join(out_dir, '_check.jpg'))
print('완료', out_dir)
