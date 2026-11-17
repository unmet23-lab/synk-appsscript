# 글 잉크 × 진짜 얼굴(자국 번호로 고름) — 모든 프레임
# python -X utf8 tools/pulse-hall-faces/inkhit.py <ink 폴더> [<real-wide ids> <real-tall ids>] [--다]
# 진짜 얼굴 자국 번호를 주지 않으면 data/real-faces-<판>.json을 쓴다. 쇼릴 판은 환경 변수 REEL(기본 20261109c).
# 얼굴 상자: YuNet 상자 + 턱 여유(아래 +6%), 쇼릴 상자 · 첫 화면 밖은 자름, 화면 폭 12px 미만은 뺌.
# 잉크: 검은 바탕 위 밝기 > 60 인 화소, 글 칸(label · title · lead · side · index) 상자 안만. 단추는 바탕까지 잉크다.
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
    img = cv2.imread(os.path.join(d, r['file']), cv2.IMREAD_GRAYSCALE)
    H, W = img.shape
    zone = np.zeros_like(img, dtype=bool)
    for k, b in r['parts'].items():
        x0, y0 = max(0, int(b['x']) - 2), max(0, int(b['y']) - 2); x1, y1 = min(W, int(b['x'] + b['w']) + 3), min(H, int(b['y'] + b['h']) + 3)
        if x1 > x0 and y1 > y0: zone[y0:y1, x0:x1] = True
    ink = (img > 60) & zone
    pinks = {}
    for k, b in r['parts'].items():
        z = np.zeros_like(img, dtype=bool)
        x0, y0 = max(0, int(b['x']) - 2), max(0, int(b['y']) - 2); x1, y1 = min(W, int(b['x'] + b['w']) + 3), min(H, int(b['y'] + b['h']) + 3)
        if x1 > x0 and y1 > y0: z[y0:y1, x0:x1] = True
        pinks[k] = (img > 60) & z
    # 잉크 열마다 가장 위 잉크 y(위에서 내려오는 얼굴과의 틈을 재려고)
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
            sub = ink[Y0:Y1, X0:X1]
            if sub.any():
                ys = np.where(sub.any(axis=1))[0]
                parts = ''.join(k[0] for k, m in pinks.items() if m[Y0:Y1, X0:X1].any())
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
