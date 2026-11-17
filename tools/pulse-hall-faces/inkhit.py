# 글 잉크 × 진짜 얼굴(자국 번호로 고름) — 모든 프레임
# python -X utf8 tools/pulse-hall-faces/inkhit.py <ink 폴더> [<real-wide ids> <real-tall ids>] [--다]
# 닿은 글 표시: l 머리글 · t 제목 · d 소개 줄 · n 작품 줄 · c 단추 · p 값 안내 · i 번호 줄
# 진짜 얼굴 자국 번호를 주지 않으면 data/real-faces-<판>.json을 쓴다. 쇼릴 판은 환경 변수 REEL(기본 20261109c).
# 얼굴 상자: YuNet 상자 + 턱 여유(아래 +6%), 쇼릴 상자 · 첫 화면 밖은 자름, 화면 폭 12px 미만은 뺌.
# 잉크: 검은 바탕 위 밝기 > 60 인 화소, 글 칸(label · title · lead · now · cta · price · index) 상자 안만. 단추는 바탕까지 잉크다. 작품 줄은 작품마다 찍은 그림을 그 작품 컷 프레임에만 쓴다.
import json, sys, os, collections
import numpy as np, cv2
d = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(here, 'data'); REEL = os.environ.get('REEL', '20261109c')
args = [a for a in sys.argv[2:] if not a.startswith('--')]
if len(args) >= 2: real = {'wide': set(map(int, args[0].split(','))), 'tall': set(map(int, args[1].split(',')))}
else:
    rf = json.load(open(os.path.join(DATA, f'real-faces-{REEL}.json'), encoding='utf8')); real = {'wide': set(rf['wide']), 'tall': set(rf['tall'])}
showall = '--다' in sys.argv
FJ = {n: json.load(open(os.path.join(DATA, f'faces-{n}-{REEL}.json'))) for n in ['wide', 'tall']}
T = {n: json.load(open(os.path.join(DATA, f'tracks-{n}-{REEL}.json'))) for n in ['wide', 'tall']}
member = {n: {} for n in T}
for n, ts in T.items():
    for tr in ts:
        for i, x, y in tr['members']: member[n][(i, x, y)] = tr['id']
meta = json.load(open(os.path.join(d, 'meta.json')))
CHIN = 0.06
res = []; cnt = collections.Counter(); bad = []
for r in meta:
    n = 'tall' if r['tall'] else 'wide'
    if r['src'] and n not in r['src']: bad.append((r['vp'], r['page'], 'src', r['src']))
    if r['poster'] and n == 'tall' and 'tall' not in r['poster']: bad.append((r['vp'], r['page'], 'poster', r['poster']))
    F = FJ[n]
    CODE = {'label': 'l', 'title': 't', 'lead': 'd', 'now': 'n', 'cta': 'c', 'price': 'p', 'index': 'i', 'side': 's'}
    def zone_of(boxes, shape):
        H, W = shape; z = np.zeros(shape, dtype=bool)
        x0, y0 = max(0, int(boxes['x']) - 2), max(0, int(boxes['y']) - 2); x1, y1 = min(W, int(boxes['x'] + boxes['w']) + 3), min(H, int(boxes['y'] + boxes['h']) + 3)
        if x1 > x0 and y1 > y0: z[y0:y1, x0:x1] = True
        return z
    files = r.get('files') or {None: r['file']}
    imgs = {k: cv2.imread(os.path.join(d, f), cv2.IMREAD_GRAYSCALE) for k, f in files.items()}
    H, W = next(iter(imgs.values())).shape
    # 작품마다(그 작품 이름을 넣어 찍은 그림) 글 칸별 잉크 — 작품 줄은 그 작품 상자만
    pinks_by = {}
    for k, img in imgs.items():
        boxes = dict(r['parts'])
        if r.get('nowBoxes') and k in r['nowBoxes']: boxes['now'] = r['nowBoxes'][k]
        pinks_by[k] = {part: (img > 60) & zone_of(bx, img.shape) for part, bx in boxes.items()}
    ink_by = {k: np.logical_or.reduce(list(v.values())) if v else np.zeros((H, W), dtype=bool) for k, v in pinks_by.items()}
    tl = r.get('timeline')
    def work_at(t):
        if not tl or None in imgs: return next(iter(imgs))
        cur = tl[0]['work']
        for seg in tl:
            if t >= seg['at']: cur = seg['work']
        return cur if cur in imgs else next(iter(imgs))
    rv = r['reel']; s = max(rv['w'] / F['w'], rv['h'] / F['h']); ox = rv['x'] + (rv['w'] - F['w'] * s) / 2; oy = rv['y'] + (rv['h'] - F['h'] * s) / 2
    cT, cB = max(rv['y'], 0), min(rv['y'] + rv['h'], H); cL, cR = max(rv['x'], 0), min(rv['x'] + rv['w'], W)
    hits = collections.defaultdict(list); gap = None
    for fr in F['frames']:
        for f in fr['faces']:
            tid = member[n].get((fr['i'], round(f['x']), round(f['y'])))
            if tid not in real[n]: continue
            if f['w'] * s < 12: continue
            x0 = max(ox + f['x'] * s, cL); x1 = min(ox + (f['x'] + f['w']) * s, cR)
            y0 = max(oy + f['y'] * s, cT); y1 = min(oy + f['y'] * s + f['h'] * s * (1 + CHIN), cB)
            if x1 <= x0 or y1 <= y0: continue
            X0, X1, Y0, Y1 = int(x0), int(np.ceil(x1)), int(y0), int(np.ceil(y1))
            wk = work_at(fr['t']); ink = ink_by[wk]; pinks = pinks_by[wk]
            sub = ink[Y0:Y1, X0:X1]
            if sub.any():
                ys = np.where(sub.any(axis=1))[0]
                parts = ''.join(CODE.get(k, k[0]) for k, m in pinks.items() if m[Y0:Y1, X0:X1].any())
                hits[tid].append((fr["t"], int(sub.sum()), float(round(Y1 - (Y0 + int(ys[0])), 1)), parts))
            else:
                below = ink[Y1:, X0:X1]
                if below.any():
                    g = int(np.where(below.any(axis=1))[0][0])
                    if gap is None or g < gap[0]: gap = (g, tid, fr['t'])
    key = 'tall' if r['tall'] else 'wide'
    cnt[(r['page'], '걸림' if hits else '0')] += 1
    res.append({'vp': r['vp'], 'page': r['page'], 'tall': r['tall'], 'h1': r['h1px'], 'hits': {str(k): v for k, v in hits.items()}, 'gap': gap})
    if hits or showall:
        tag = f"{r['vp'][0]}x{r['vp'][1]} {r['page']:<10} {'세로' if r['tall'] else '가로'}판 h1 {r['h1px']:.1f}"
        if hits:
            print(tag, '잉크 겹침:', '; '.join(f"#{k}[{''.join(sorted(set(''.join(x[3] for x in v))))}] {v[0][0]:.2f}~{v[-1][0]:.2f}초 {len(v)}프레임 최대 {max(x[1] for x in v)}화소 깊이 {max(x[2] for x in v)}px" for k, v in hits.items()))
        else:
            print(tag, '겹침 0 · 가장 좁은 틈', gap)
print('합계', dict(cnt))
print('판 엇갈림', len(bad), bad[:8])
json.dump(res, open(os.path.join(d, 'inkhit.json'), 'w'))
