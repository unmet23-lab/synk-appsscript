# OUTBLUE 날 선 뼈대(2026-11-06) — 유호님 「뭉뚝한 느낌」 뒤. 좁고 높은 글자, OFALIN과 비슷한 획 굵기,
# 모든 굽는 자리는 45° 사선으로 벤다(OFALIN이 원 · 삼각형이면 OUTBLUE는 직선 · 날).
# 판 A 「날」: 획만. 판 B 「갑편」: A에 단어 전체를 가로지르는 가는 틈 하나 — 두정갑 판이 겹친 자리.
# 판 C 「칼집」: A에서 O의 속을 비스듬한 칼자국 하나로. 리벳은 셋 다 한 개(B 허리).
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '전용3')
os.makedirs(OUT, exist_ok=True)

H, SW, W, GAP, CH = 1000, 108, 520, 100, 140
UC = 70  # U 아래 사선은 짧게(길면 V로 읽힌다)   # 높이 · 획 · 글자 폭 · 사이 · 사선 길이
h = SW / 2


def pl(pts, closed=False):
    d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return d + ('Z' if closed else '')


def letters():
    out, x = [], 0
    # O: 팔각 고리
    a, b, c = x + h, x + W - h, CH
    out.append(('O', pl([(a + c, h), (b - c, h), (b, h + c), (b, H - h - c), (b - c, H - h), (a + c, H - h), (a, H - h - c), (a, h + c)], True)))
    o_box = (x, W)
    x += W + GAP
    # U
    a, b = x + h, x + W - h
    out.append(('U', pl([(a, 0), (a, H - h - UC), (a + UC, H - h), (b - UC, H - h), (b, H - h - UC), (b, 0)])))
    x += W + GAP
    # T
    out.append(('T', pl([(x, h), (x + W, h)]) + pl([(x + W / 2, h), (x + W / 2, H)])))
    x += W + GAP
    # B: 위 · 아래 두 칸, 오른쪽 모서리를 사선으로
    a, b, m = x + h, x + W - h, H * 0.47
    out.append(('B', pl([(a, 0), (a, H)]) + pl([(x, h), (b - CH * .8, h), (b, h + CH * .8), (b, m - h - CH * .5), (b - CH * .5, m), (x + h, m)])
                + pl([(b - CH * .5 - 30, m), (b, m + CH * .6), (b, H - h - CH * .8), (b - CH * .8, H - h), (x, H - h)])))
    b_rivet = (b - CH * .5 - 15, m)
    x += W + GAP
    # L
    a = x + h
    out.append(('L', pl([(a, 0), (a, H - h), (x + W - 30, H - h)])))
    x += W - 30 + GAP
    # U
    a, b = x + h, x + W - h
    out.append(('U', pl([(a, 0), (a, H - h - UC), (a + UC, H - h), (b - UC, H - h), (b, H - h - UC), (b, 0)])))
    x += W + GAP
    # E
    a = x + h
    out.append(('E', pl([(x + W - 10, h), (a, h), (a, H - h), (x + W - 10, H - h)]) + pl([(a, H * 0.47), (x + W - 70, H * 0.47)])))
    x += W - 10
    return out, x, o_box, b_rivet


def blade_cuts(ls, w):
    # 위로 열린 기둥 끝(U 둘 · L · B 기둥)을 바깥쪽이 높게 45°로 벤다
    out, x = [], 0
    for name in [n for n, _ in ls]:
        wid = {'L': W - 30, 'E': W - 10, 'T': W}.get(name, W)
        if name == 'U':
            out.append(pl([(x - 5, -5), (x + SW + 5, -5), (x + SW + 5, SW * .9)], True))
            out.append(pl([(x + wid - SW - 5, -5), (x + wid + 5, -5), (x + wid - SW - 5, SW * .9)], True))
        if name == 'L':
            out.append(pl([(x - 5, -5), (x + SW + 5, -5), (x + SW + 5, SW * .9)], True))
        x += wid + GAP
    return out


def svg(kind, ink, bg, rivet):
    ls, w, o_box, br = letters()
    body = ''
    for name, d in ls:
        if kind == 'C' and name == 'O':
            # 고리 대신 꽉 찬 팔각 판 + 비스듬한 칼자국 하나
            ox = o_box[0]
            p = [(ox + CH, 0), (ox + W - CH, 0), (ox + W, CH), (ox + W, H - CH), (ox + W - CH, H), (ox + CH, H), (ox, H - CH), (ox, CH)]
            cut = [(ox + W * .62, H * .18), (ox + W * .62 + 26, H * .18 + 40), (ox + W * .38 + 26, H * .82 + 40), (ox + W * .38, H * .82)]
            cut = [(ox + W * .58, H * .2), (ox + W * .70, H * .2), (ox + W * .42, H * .8), (ox + W * .30, H * .8)]
            body += f'<path fill-rule="evenodd" fill="{ink}" d="{pl(p, True)}{pl(cut, True)}"/>'
            continue
        body += f'<path d="{d}" fill="none" stroke="{ink}" stroke-width="{SW}" stroke-linejoin="miter" stroke-miterlimit="10"/>'
    mask = ''
    if kind == 'X':
        mask = f'<mask id="m"><rect x="-50" y="-50" width="{w + 100}" height="{H + 100}" fill="#fff"/><rect x="-50" y="{H * .58}" width="{w + 100}" height="26" fill="#000"/></mask>'
        body = f'<g mask="url(#m)">{body}</g>'
    if kind == 'B':
        cuts = ''.join(f'<path d="{d}" fill="{bg}"/>' for d in blade_cuts(ls, w))
        body += cuts
    if rivet:
        body += f'<circle cx="{br[0]:.1f}" cy="{br[1]:.1f}" r="{SW * 1.05:.0f}" fill="{bg}"/><circle cx="{br[0]:.1f}" cy="{br[1]:.1f}" r="{SW * .78:.0f}" fill="{rivet}"/>'
    pad = 180
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {w + 2 * pad} {H + 2 * pad}"><defs>{mask}</defs><rect x="{-pad}" y="{-pad}" width="{w + 2 * pad}" height="{H + 2 * pad}" fill="{bg}"/>{body}</svg>'


for k in 'AB':
    open(os.path.join(OUT, f'{k}_흑.svg'), 'w', encoding='utf-8').write(svg(k, '#111111', '#FFFFFF', '#111111'))
    open(os.path.join(OUT, f'{k}_원고.svg'), 'w', encoding='utf-8').write(svg(k, '#1743B5', '#FFFFFF', '#D9B46A'))
print('ok')
