# shot.cjs 그림에 그 프레임의 진짜 얼굴 상자(초록, 턱 여유 +6%)를 그려 한 장으로: python overlay.py <폴더> <lang-WxH.json> <out.png> <real-wide ids> <real-tall ids> [줄임 배율]
import json, sys, os, cv2
d, mj, outp = sys.argv[1:4]
real = {'wide': set(map(int, sys.argv[4].split(','))), 'tall': set(map(int, sys.argv[5].split(',')))}
scale = float(sys.argv[6]) if len(sys.argv) > 6 else 0.5
here = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(here, 'data'); REEL = os.environ.get('REEL', '20261109c')
FJ = {n: json.load(open(os.path.join(DATA, f'faces-{n}-{REEL}.json'))) for n in ['wide', 'tall']}
T = {n: json.load(open(os.path.join(DATA, f'tracks-{n}-{REEL}.json'))) for n in ['wide', 'tall']}
member = {n: {} for n in T}
for n, ts in T.items():
    for tr in ts:
        for i, x, y in tr['members']: member[n][(i, x, y)] = tr['id']
tiles = []
for s in json.load(open(os.path.join(d, mj))):
    n = 'tall' if 'tall' in (s['src'] or '') else 'wide'
    F = FJ[n]; img = cv2.imread(os.path.join(d, s['file']))
    rv = s['reel']; k = max(rv['w'] / F['w'], rv['h'] / F['h']); ox = rv['x'] + (rv['w'] - F['w'] * k) / 2; oy = rv['y'] + (rv['h'] - F['h'] * k) / 2
    i = round(s['ct'] * F['fps'])
    for f in F['frames'][min(i, len(F['frames']) - 1)]['faces']:
        tid = member[n].get((F['frames'][i]['i'], round(f['x']), round(f['y'])))
        c = (0, 255, 0) if tid in real[n] else (0, 140, 255)
        x0, y0 = round(ox + f['x'] * k), round(oy + f['y'] * k)
        cv2.rectangle(img, (x0, y0), (round(x0 + f['w'] * k), round(y0 + f['h'] * k * 1.06)), c, 2)
        for j in (0, 2): cv2.circle(img, (round(ox + f['mouth'][j] * k), round(oy + f['mouth'][j + 1] * k)), 4, (0, 0, 255), -1)
    cv2.putText(img, f"{s['ct']:.2f}s {n}", (10, img.shape[0] - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 255), 2)
    tiles.append(cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA))
cols = 2
while len(tiles) % cols: tiles.append(tiles[0] * 0)
cv2.imwrite(outp, cv2.vconcat([cv2.hconcat(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]))
