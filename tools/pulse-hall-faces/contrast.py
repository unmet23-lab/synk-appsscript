# contrast.cjs 결과로 글 상자 밑 배경의 밝은 쪽 90% 휘도와 대비비
import json, sys, cv2, numpy as np
d = json.load(open(sys.argv[1]))
def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def L(rgb):
    r, g, b = lin(rgb[..., 0]), lin(rgb[..., 1]), lin(rgb[..., 2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
ink = np.array([242, 239, 233], float)
import re
def parse(c):
    m = re.findall(r'[\d.]+', c); r, g, b = map(float, m[:3]); a = float(m[3]) if len(m) > 3 else 1.0
    return np.array([r, g, b]), a
cols = {k: parse(d['boxes'][k + ':color']) for k in ['title', 'label', 'now', 'price'] if k + ':color' in d['boxes']}
worst = {}
for s in d['shots']:
    img = cv2.imread(s['file'])[:, :, ::-1].astype(float)
    for k, bx in d['boxes'].items():
        if ':' in k: continue
        for b in bx:
            x0, y0 = int(b['x']), int(b['y']); x1, y1 = int(b['x'] + b['w']), int(b['y'] + b['h'])
            patch = img[max(0, y0):y1, max(0, x0):x1]
            if patch.size == 0: continue
            col, a = cols[k]
            # 글자 색 = 글 색을 a만큼 배경 위에 섞은 것(머리글 ink-3)
            fg = col * a + patch * (1 - a)
            Lb = L(patch); Lf = L(fg)
            ratio = (np.maximum(Lf, Lb) + 0.05) / (np.minimum(Lf, Lb) + 0.05)
            p10 = float(np.percentile(ratio, 10))
            key = k
            if key not in worst or p10 < worst[key][0]: worst[key] = (p10, s['t'], round(b['y']))
print(d['vp'], {k: (round(v[0], 2), v[1], v[2]) for k, v in worst.items()})
