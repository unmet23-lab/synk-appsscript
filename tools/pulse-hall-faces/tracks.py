# 얼굴 자국 묶기: python -X utf8 tools/pulse-hall-faces/tracks.py <faces.json> <mp4> <out.json> <그림표.png>
# 그림표의 자국을 하나씩 보고 눈 · 입 · 턱이 보이는 것만 data/real-faces-<판>.json에 적는다(뒤통수 · 팔 · 기계는 뺀다).
import json, sys, cv2
F = json.load(open(sys.argv[1])); cap = cv2.VideoCapture(sys.argv[2])
def iou(a, b):
    ax1, ay1, ax2, ay2 = a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']
    bx1, by1, bx2, by2 = b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']
    ix = max(0, min(ax2, bx2) - max(ax1, bx1)); iy = max(0, min(ay2, by2) - max(ay1, by1))
    inter = ix * iy; u = a['w'] * a['h'] + b['w'] * b['h'] - inter
    return inter / u if u else 0
tracks = []; active = []
for fr in F['frames']:
    new_active = []
    for f in fr['faces']:
        if f['score'] < 0.5: continue
        best = None; bi = 0.2
        for tr in active:
            v = iou(tr['last'], f)
            if v > bi: bi = v; best = tr
        if best is None or best in new_active:
            best = {'id': len(tracks), 'frames': [], 'last': f}; tracks.append(best)
        best['frames'].append((fr['i'], fr['t'], f)); best['last'] = f
        new_active.append(best)
    # 한두 프레임 놓쳐도 잇는다
    active = new_active + [tr for tr in active if tr not in new_active and fr['i'] - tr['frames'][-1][0] <= 3]
out = []
for tr in tracks:
    fs = tr['frames']
    mid = fs[len(fs) // 2]
    out.append({'id': tr['id'], 't0': fs[0][1], 't1': fs[-1][1], 'n': len(fs), 'smax': round(max(x[2]['score'] for x in fs), 2),
                'ymax': round(max(x[2]['y'] + x[2]['h'] for x in fs)), 'xmin': round(min(x[2]['x'] for x in fs)), 'xmax': round(max(x[2]['x'] + x[2]['w'] for x in fs)),
                'ymin': round(min(x[2]['y'] for x in fs)), 'mid': {'i': mid[0], 'box': [round(mid[2][k]) for k in 'xywh']}, 'members': [[x[0], round(x[2]['x']), round(x[2]['y'])] for x in fs]})
json.dump(out, open(sys.argv[3], 'w'))
tiles = []
for o in out:
    cap.set(cv2.CAP_PROP_POS_FRAMES, o['mid']['i']); ok, img = cap.read()
    x, y, w, h = o['mid']['box']; m = int(max(w, h) * 0.6)
    H, W = img.shape[:2]
    crop = img[max(0, y - m):min(H, y + h + m), max(0, x - m):min(W, x + w + m)].copy()
    cv2.rectangle(crop, (x - max(0, x - m), y - max(0, y - m)), (x - max(0, x - m) + w, y - max(0, y - m) + h), (0, 255, 0), 2)
    crop = cv2.resize(crop, (180, 180))
    cv2.putText(crop, f"#{o['id']} {o['t0']:.1f}-{o['t1']:.1f}", (3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1)
    cv2.putText(crop, f"n{o['n']} s{o['smax']} y{o['ymin']}-{o['ymax']}", (3, 174), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 255, 255), 1)
    tiles.append(crop)
cols = 10
while len(tiles) % cols: tiles.append(tiles[0] * 0)
rows = [cv2.hconcat(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
cv2.imwrite(sys.argv[4], cv2.vconcat(rows))
print(len(out), 'tracks')
