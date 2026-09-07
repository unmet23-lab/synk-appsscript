# -*- coding: utf-8 -*-
"""마스코트 치수 재기 — 정본_4K 「본체」 컷에서 숫자를 뽑는다.

  왜 있나  : 그림은 다시 구울 때마다 달라진다. 달라졌는지 알려면 «자»가 있어야 하고,
             나중에 입체(3D)로 다시 지을 때 넘어가는 것은 그림이 아니라 이 숫자다.
  정본     : docs/캐릭터/마스코트_치수_정본_v1.md — 판정과 뜻은 그 문서가 진다.
             이 파일은 그 숫자를 «다시 뽑는 자»다(숫자를 여기 또 적지 않는다).
  쓰는 법  : python tools/마스코트치수재기.py            → 숫자만 (JSON)
             python tools/마스코트치수재기.py --그림 <폴더> → 확인용 그림도 같이

  🔴 09-08 에 눈 자를 한 번 고쳤다(유호님이 지면에서 «짝짝이 상자»를 잡으셨다). 밟은 함정 셋:
     ① **밝기만으로 몽글의 눈을 찾으면 눈 둘레의 그늘까지 삼킨다** — 오른쪽 눈이 44% 커 보였다.
        가르는 자는 밝기가 아니라 «붉은기»(r-g)다: 구슬 r-g≈2 · 코랄 그늘 r-g≈116.
     ② **까몽의 초록 문턱이 높으면 홍채 고리의 «밝은 쪽»만 잡힌다** — 눈이 실제의 3분의 2로 나왔다.
     ③ **덩어리로 안 묶으면** 눈 밖의 밝은 털이 반짝임으로 잡힌다 — 반짝임은 «가장 큰 밝은 덩어리» 하나다.
"""
import io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

SRC = os.path.join('docs', '캐릭터', '정본_4K')
NAMES = ['몽글', '까몽', '마린']

# 눈을 찾는 자 — 캐릭터마다 다르다 (한 가지 자로는 셋을 못 잰다)
EYE_KEY = {
    '몽글': lambda r, g, b, l: (l < 70) & ((r - g) < 40),          # 검은 구슬 — 붉은기로 그늘과 가른다
    '까몽': lambda r, g, b, l: (g > r) & (g > b) & (l > 30),        # 초록 홍채 고리 전체
    '마린': lambda r, g, b, l: (r > 150) & (g > 120) & ((r - b) > 70),  # 노란 렌즈
}
GLINT_TH = {'몽글': 190, '까몽': 190, '마린': 240}                   # 반짝임 문턱 밝기


def _load(name, cut='본체'):
    a = np.asarray(Image.open(os.path.join(SRC, f'{name}_{cut}.png')).convert('RGBA'))
    r, g, b = (a[..., i].astype(int) for i in range(3))
    lum = .2126 * r + .7152 * g + .0722 * b
    return a, a[..., 3] > 128, r, g, b, lum


def _blobs(mask, min_px):
    """이웃 붙은 덩어리 — scipy 없이 줄 훑기."""
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    par = {0: 0}

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    def uni(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            par[max(ra, rb)] = min(ra, rb)

    nxt = 1
    for y in range(H):
        if not mask[y].any():
            continue
        for x in np.where(mask[y])[0]:
            cand = [c for c in (lab[y - 1, x] if y else 0, lab[y, x - 1] if x else 0) if c]
            if not cand:
                lab[y, x] = nxt
                par[nxt] = nxt
                nxt += 1
            else:
                mn = min(cand)
                lab[y, x] = mn
                for c in cand:
                    uni(mn, c)
    flat = np.zeros(nxt, np.int32)
    for i in range(1, nxt):
        flat[i] = find(i)
    lab = flat[lab]
    out = []
    for i in np.unique(lab):
        if i == 0:
            continue
        ys, xs = np.where(lab == i)
        if len(xs) < min_px:
            continue
        out.append(dict(n=int(len(xs)), x0=int(xs.min()), x1=int(xs.max()),
                        y0=int(ys.min()), y1=int(ys.max()),
                        cx=float(xs.mean()), cy=float(ys.mean())))
    return sorted(out, key=lambda d: -d['n'])


def _palette(a, m, n=8):
    px = a[..., :3][m]
    if len(px) > 300000:
        px = px[:: len(px) // 300000 + 1]
    q = Image.fromarray(px.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=n)
    pal, idx = q.getpalette()[: n * 3], np.asarray(q).reshape(-1)
    out = []
    for i in range(n):
        c = int((idx == i).sum())
        if c:
            R, G, B = pal[i * 3: i * 3 + 3]
            out.append(dict(hex='#%02X%02X%02X' % (R, G, B), pct=round(100 * c / len(idx), 1)))
    return sorted(out, key=lambda d: -d['pct'])


def _hex(px):
    return '#%02X%02X%02X' % tuple(np.median(px, axis=0).astype(int))


def _lab(hx):
    c = np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)], float) / 255.
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    x = M @ c / np.array([.95047, 1., 1.08883])
    f = np.where(x > .008856, np.cbrt(x), 7.787 * x + 16 / 116.)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def kit_distance(hx, kit, k=2):
    L = _lab(hx)
    ds = sorted((float(np.linalg.norm(L - _lab(t['hex']))), t['이름'], t['hex']) for t in kit)[:k]
    return [dict(킷=n, hex=h, 거리=round(d, 1)) for d, n, h in ds]


def measure(name):
    a, m, r, g, b, lum = _load(name)
    ys, xs = np.where(m)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bw, bh = x1 - x0 + 1, y1 - y0 + 1

    prof = []
    for i in range(20):
        ya, yb = y0 + bh * i // 20, y0 + bh * (i + 1) // 20
        cols = np.where(m[ya:yb].any(axis=0))[0]
        prof.append(0 if not len(cols) else int(cols.max() - cols.min() + 1))

    rec = dict(캔버스=[int(a.shape[1]), int(a.shape[0])], 몸상자=[x0, y0, x1, y1],
               몸=[bw, bh], 가로세로비=round(bw / bh, 3),
               가장넓은띠=f'{int(np.argmax(prof)) * 5}~{int(np.argmax(prof)) * 5 + 5}%',
               폭프로파일=[round(100 * p / bw) for p in prof],
               색=_palette(a, m))

    key = m & EYE_KEY[name](r, g, b, lum)
    key[y0 + int(bh * .7):] = False
    cs = _blobs(key[::4, ::4], 150)[:2]
    for c in cs:
        for k in ('x0', 'x1', 'y0', 'y1'):
            c[k] *= 4
        c['cx'] *= 4
        c['cy'] *= 4
        c['n'] *= 16
    if len(cs) == 2:
        L, R = sorted(cs, key=lambda d: d['cx'])
        wL, wR = L['x1'] - L['x0'] + 1, R['x1'] - R['x0'] + 1
        hL, hR = L['y1'] - L['y0'] + 1, R['y1'] - R['y0'] + 1
        ew, eh = (wL + wR) / 2, (hL + hR) / 2
        span = R['cx'] - L['cx']
        rec['눈'] = dict(잡은것={'몽글': '검은 구슬', '까몽': '초록 홍채 고리 전체',
                              '마린': '노란 렌즈'}[name],
                        왼쪽=[wL, hL], 오른쪽=[wR, hR],
                        폭px=int(ew), 높이px=int(eh), 세로가로비=round(eh / ew, 2),
                        좌우_폭차이=f'{round(100 * abs(wL - wR) / max(wL, wR), 1)}%',
                        사이_중심간px=int(span),
                        폭_몸폭대비=round(ew / bw, 3), 사이_몸폭대비=round(span / bw, 3),
                        사이_눈폭배수=round(span / ew, 2),
                        틈_눈폭배수=round((R['x0'] - L['x1']) / ew, 2),
                        눈높이_위에서=round(((L['cy'] + R['cy']) / 2 - y0) / bh, 3),
                        기울기px=int(abs(L['cy'] - R['cy'])),
                        상자=[[L['x0'], L['y0'], L['x1'], L['y1']],
                            [R['x0'], R['y0'], R['x1'], R['y1']]])

        # 반짝임 — 눈 상자 «안»에서 가장 큰 밝은 덩어리 하나
        빛 = []
        for bx in rec['눈']['상자']:
            w, h = bx[2] - bx[0] + 1, bx[3] - bx[1] + 1
            sub = lum[bx[1]:bx[3] + 1, bx[0]:bx[2] + 1]
            hot = _blobs((sub > GLINT_TH[name])[::2, ::2], 10)
            if not hot:
                continue
            t = hot[0]
            d = (max(t['x1'] - t['x0'], t['y1'] - t['y0']) + 1) * 2
            빛.append(dict(지름_눈폭대비=round(d / w, 3),
                          가로_눈안에서=round(t['cx'] * 2 / w, 3),
                          세로_눈안에서=round(t['cy'] * 2 / h, 3)))
        rec['눈']['반짝임'] = 빛 if 빛 else '없다(무광)'
    return rec, (a, m, r, g, b, lum, x0, y0, x1, y1, bw, bh)


def extras(name, ctx):
    a, m, r, g, b, lum, x0, y0, x1, y1, bw, bh = ctx
    if name == '몽글':
        bottom = np.array([np.where(m[:, x])[0].max() if m[:, x].any() else -1
                           for x in range(x0, x1 + 1)], float)
        sm = np.convolve(bottom[bottom > 0], np.ones(41) / 41, 'valid')
        d, tips, last = np.diff(sm), [], 0
        for i in range(1, len(d)):
            s = np.sign(d[i])
            if s and s != last:
                if last == 1 and s == -1:
                    tips.append(i)
                last = s
            elif s:
                last = s
        tips = [t for j, t in enumerate(tips) if j == 0 or t - tips[j - 1] > bw * .05]
        st = m & (r - g < 62) & (g - b > 26) & (lum > 115) & (lum < 235)
        st[: y0 + int(bh * .70)] = False
        st[:, :x0 + int(bw * .06)] = False
        st[:, x1 - int(bw * .06):] = False
        sy = np.where(st)[0]
        return dict(밑단물결_꼭짓점=len(tips),
                    밑단물결_깊이_몸높이대비=round(float(sm.max() - sm.min()) / bh, 3),
                    실땀_색=_hex(a[..., :3][st]),
                    실땀_높이_바닥에서=round(float((y1 - sy.mean()) / bh), 3))
    if name == '마린':
        navy = m & (b - r > 25) & (b > 45) & (b < 190)
        ny, nx = np.where(navy)
        lens = m & (r > 150) & (g > 120) & (r - b > 70)
        cream = m & (r > 150) & (r - b > 20) & (r - b < 75) & (g > 130)
        cream[: y0 + int(bh * .55)] = False
        return dict(투구폭_몸폭대비=round((nx.max() - nx.min() + 1) / bw, 3),
                    투구높이_몸높이대비=round((ny.max() - ny.min() + 1) / bh, 3),
                    투구끝_위에서=round(float((ny.max() - y0) / bh), 3),
                    투구_색=_hex(a[..., :3][navy]), 렌즈_색=_hex(a[..., :3][lens]),
                    몸_색=_hex(a[..., :3][cream]))
    if name == '까몽':
        iris = m & (g - r > 18) & (g - b > 18) & (lum > 55)
        iris[y0 + int(bh * .7):] = False
        return dict(홍채_색=_hex(a[..., :3][iris]),
                    동공='안 쟀다 — 털과 밝기가 같아 기계로 못 가른다')
    return {}


if __name__ == '__main__':
    kit = json.load(io.open(os.path.join('docs', '디자인_토큰.json'), encoding='utf-8'))['색']['킷']
    draw_to = None
    if '--그림' in sys.argv:
        draw_to = sys.argv[sys.argv.index('--그림') + 1]
    rep = {}
    for name in NAMES:
        rec, ctx = measure(name)
        rec.update(extras(name, ctx))
        rec['킷과의거리'] = {}
        for label, hx in [('몸 밝은 면', rec['색'][0]['hex']), ('몸 그늘', rec['색'][2]['hex'])]:
            rec['킷과의거리'][label] = kit_distance(hx, kit)
        rep[name] = rec
        if draw_to and '눈' in rec:
            # 🔴 자르는 기준은 «투명도 128 초과»여야 한다. PIL 의 getbbox() 는 투명도 0 초과라
            #    그림이 더 넓게 잘리고, 그 위에 백분율로 그린 상자가 통째로 밀린다(09-08 유호 지적).
            bb = rec['몸상자']
            im = Image.open(os.path.join(SRC, f'{name}_본체.png')).convert('RGBA') \
                      .crop((bb[0], bb[1], bb[2] + 1, bb[3] + 1))
            sc = 420. / max(im.size)
            im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
            bg = Image.new('RGB', im.size, (240, 240, 236))
            bg.paste(im, (0, 0), im)
            dr = ImageDraw.Draw(bg)
            for bx in rec['눈']['상자']:
                dr.rectangle([(bx[0] - bb[0]) * sc, (bx[1] - bb[1]) * sc,
                              (bx[2] - bb[0]) * sc, (bx[3] - bb[1]) * sc],
                             outline=(210, 30, 20), width=3)
            bg.save(os.path.join(draw_to, f'치수확인_{name}.png'))
    sys.stdout.write(json.dumps(rep, ensure_ascii=False, indent=1))
    if not draw_to:
        sys.stderr.write(
            '\n⚠ 확인 그림 없이 낸 값이다. 자가 틀리면 «숫자»로는 안 보이고 «그림»에서 보인다(09-08 함정 셋).\n'
            '   판정에 쓰기 전에  python tools/마스코트치수재기.py --그림 <폴더>  로 다시 돌려 상자를 눈으로 겹쳐 본다.\n'
            '   짝이 있는 것은 「좌우_폭차이」를 먼저 본다 — 10%를 넘으면 눈이 아니라 자를 의심한다.\n')
