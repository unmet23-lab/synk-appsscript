# 전용 글자 뼈대 2판(2026-11-05) — 맹검 재심사 반영. 글꼴 없이 직접 그린다.
# OFALIN: O는 반지 — 고리 틈에 오팔 한 알을 획보다 크게 앉힌다. A는 가로줄 없는 삼각형. 무지개 줄은 뺐다(유명 음반 표지와 겹친다).
# OUTBLUE: 칼집 글자. 모서리 규칙 하나 — 둥근 글자가 굽는 자리만 벤다(O 넷 · U 아래 둘 · B 오른쪽 둘). 칼집 끝은 둥근 구멍, 금 못은 입체 판에서만.
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '전용2')
os.makedirs(OUT, exist_ok=True)


def ofalin(ink='#111111', gem=None, sw=112, bg='#FFFFFF'):
    gem = gem or ink
    cap, gap = 1000, 150
    s = []

    def rect(x, y, w, h):
        s.append(f'<rect x="{x:.1f}" y="{y}" width="{w:.1f}" height="{h}" fill="{ink}"/>')

    x = 0
    r = cap / 2
    mid = r - sw / 2
    ang = -42
    half = 25  # 고리 틈의 반각
    a1, a2 = math.radians(ang + half), math.radians(ang - half)
    p1 = (r + mid * math.cos(a1), r + mid * math.sin(a1))
    p2 = (r + mid * math.cos(a2), r + mid * math.sin(a2))
    s.append(f'<path d="M{p1[0]:.1f} {p1[1]:.1f}A{mid} {mid} 0 1 1 {p2[0]:.1f} {p2[1]:.1f}" fill="none" stroke="{ink}" stroke-width="{sw}"/>')
    g = (r + mid * math.cos(math.radians(ang)), r + mid * math.sin(math.radians(ang)))
    s.append(f'<ellipse cx="{g[0]:.1f}" cy="{g[1]:.1f}" rx="150" ry="150" fill="{gem}"/>')
    x += cap + gap - 20
    # F
    rect(x, 0, sw, cap)
    rect(x, 0, 540, sw)
    rect(x, 450, 410, sw)
    x += 540 + gap - 40
    # A — 가로줄 없는 삼각형, 획 굵기를 세 변 모두 같게
    aw = 980
    apex = x + aw / 2
    k = (aw / 2) / cap
    t = sw * math.sqrt(1 + k * k)
    top_in = t / k
    bot_in = cap - sw
    il, ir = apex - (bot_in - top_in) * k, apex + (bot_in - top_in) * k
    s.append(f'<path fill-rule="evenodd" fill="{ink}" d="M{x} {cap}L{apex} 0L{x + aw} {cap}Z M{il:.1f} {bot_in}L{apex} {top_in:.1f}L{ir:.1f} {bot_in}Z"/>')
    x += aw + gap - 60
    # L
    rect(x, 0, sw, cap)
    rect(x, cap - sw, 500, sw)
    x += 500 + gap - 30
    # I
    rect(x, 0, sw, cap)
    x += sw + gap
    # N
    nw = 780
    rect(x, 0, sw, cap)
    rect(x + nw - sw, 0, sw, cap)
    d = sw * 1.3
    s.append(f'<path fill="{ink}" d="M{x} 0L{x + d} 0L{x + nw} {cap}L{x + nw - d} {cap}Z"/>')
    return ''.join(s), x + nw, cap


def poly(pts):
    return 'M' + 'L'.join(f'{a:.1f} {b:.1f}' for a, b in pts) + 'Z'


def outblue(ink='#111111', rivet=None):
    H, W, c = 1000, 600, 120
    gap = 62
    s, dots = [], []
    x = 0

    def add(d):
        s.append(f'<path fill-rule="evenodd" fill="{ink}" d="{d}"/>')

    def vslit(cx, y1, y2, w):
        r = w / 2
        return f'M{cx - r} {y1 + r}A{r} {r} 0 0 1 {cx + r} {y1 + r}V{y2 - r}A{r} {r} 0 0 1 {cx - r} {y2 - r}Z'

    def hslit(x1, x2, y, w):
        r = w / 2
        return f'M{x1 + r} {y - r}H{x2}V{y + r}H{x1 + r}A{r} {r} 0 0 1 {x1 + r} {y - r}Z'

    # O: 네 모서리 대칭, 칼집을 넓게
    o = [(c, 0), (W - c, 0), (W, c), (W, H - c), (W - c, H), (c, H), (0, H - c), (0, c)]
    add(poly([(x + a, b) for a, b in o]) + vslit(x + W / 2, 200, H - 200, 150))
    dots += [(x + W / 2, 275), (x + W / 2, H - 275)]
    x += W + gap
    # U: 아래 두 모서리
    sl = 110
    u = [(0, 0), (W, 0), (W, H - c), (W - c, H), (c, H), (0, H - c)]
    cut = f'M{x + W / 2 - sl / 2} 0H{x + W / 2 + sl / 2}V{H - 215 - sl / 2}A{sl / 2} {sl / 2} 0 0 1 {x + W / 2 - sl / 2} {H - 215 - sl / 2}Z'
    add(poly([(x + a, b) for a, b in u]) + cut)
    dots += [(x + W / 2, H - 215 - sl / 2)]
    x += W + gap
    # T
    tw = W + 20
    stem = 250
    t = [(0, 0), (tw, 0), (tw, 250), (tw / 2 + stem / 2, 250), (tw / 2 + stem / 2, H), (tw / 2 - stem / 2, H), (tw / 2 - stem / 2, 250), (0, 250)]
    add(poly([(x + a, b) for a, b in t]))
    x += tw + gap
    # B: 오른쪽 두 모서리 + 허리, 칼집은 닫힌 것 둘
    b = [(0, 0), (W - c, 0), (W, c), (W, 450), (W - 44, 500), (W, 550), (W, H - c), (W - c, H), (0, H)]
    add(poly([(x + a, y) for a, y in b]) + hslit(x + 215, x + W - 215, 280, sl) + hslit(x + 215, x + W - 215, H - 280, sl))
    dots += [(x + 215 + sl / 2, 280), (x + 215 + sl / 2, H - 280)]
    x += W + gap
    # L
    lw = W - 30
    add(poly([(x, 0), (x + 260, 0), (x + 260, H - 260), (x + lw, H - 260), (x + lw, H), (x, H)]))
    x += lw + gap
    # U
    cut = f'M{x + W / 2 - sl / 2} 0H{x + W / 2 + sl / 2}V{H - 215 - sl / 2}A{sl / 2} {sl / 2} 0 0 1 {x + W / 2 - sl / 2} {H - 215 - sl / 2}Z'
    add(poly([(x + a, y) for a, y in u]) + cut)
    dots += [(x + W / 2, H - 215 - sl / 2)]
    x += W + gap
    # E: 오른쪽이 분명히 열린 칼집 둘, 가운데 팔은 짧게
    ew = W - 20
    e = [(0, 0), (ew, 0), (ew, 262), (250, 262), (250, 370), (ew - 80, 370), (ew - 80, 630), (250, 630), (250, 738), (ew, 738), (ew, H), (0, H)]
    add(poly([(x + a, y) for a, y in e]))
    x += ew
    extra = ''
    if rivet:
        extra = ''.join(f'<circle cx="{a:.1f}" cy="{y:.1f}" r="58" fill="{rivet}"/>' for a, y in dots)
    return ''.join(s) + extra, x, H


def svg(parts, bg, pad=200):
    body, w, h = parts
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {w + 2 * pad} {h + 2 * pad}"><rect x="{-pad}" y="{-pad}" width="{w + 2 * pad}" height="{h + 2 * pad}" fill="{bg}"/>{body}</svg>'


def save(name, parts, bg):
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(svg(parts, bg))


save('OFALIN_흑', ofalin(), '#FFFFFF')
save('OFALIN_흰', ofalin('#FFFFFF'), '#000000')
save('OUTBLUE_흑', outblue(), '#FFFFFF')
save('OUTBLUE_흰', outblue('#FFFFFF'), '#1743B5')
save('OUTBLUE_원고', outblue('#1743B5', '#D9B46A'), '#FFFFFF')
print('ok')
