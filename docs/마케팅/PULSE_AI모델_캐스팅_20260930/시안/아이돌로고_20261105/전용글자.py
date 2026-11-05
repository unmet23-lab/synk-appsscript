# 두 팀 전용 글자 뼈대 — 글꼴 없이 직접 그린다(2026-11-05, 맹검 「기성 글꼴 + 재질」 지적 뒤).
# OFALIN: A가 프리즘. 왼쪽 빛 한 줄이 A로 들어가 네 줄로 갈라져 L I N 아래로 나간다 — 「한 빛에서 갈라진 네 색」.
# OUTBLUE: 묵직한 판 글자의 빈 곳이 모두 칼집이고, 칼집 끝은 둥근 리벳 구멍 — 두정갑 판과 못. 대각선 모서리가 앞으로 나간다(OUT).
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '전용')
os.makedirs(OUT, exist_ok=True)

MEMBER = ['#6E1423', '#5B2A86', '#6DBE45', '#1F2A52']


# ── OFALIN ────────────────────────────────────────
def ofalin(ink='#111111', lines=None, gem=None, beam=None, sw=88):
    lines = lines or [ink] * 4
    gem = gem or ink
    beam = beam or ink
    cap = 1000
    s = []

    def fill(d, c=ink):
        s.append(f'<path d="{d}" fill="{c}" fill-rule="evenodd"/>')

    def rect(x, y, w, h, c=ink):
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')

    x = 0
    # O: 반지 고리 — 오른쪽 위에 오팔 한 알이 물린다
    r = cap / 2
    s.append(f'<circle cx="{x + r}" cy="{r}" r="{r - sw / 2}" fill="none" stroke="{ink}" stroke-width="{sw}"/>')
    ang = math.radians(-48)
    gx, gy = x + r + (r - sw / 2) * math.cos(ang), r + (r - sw / 2) * math.sin(ang)
    s.append(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="128" fill="#FFFFFF"/>')
    s.append(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="96" fill="{gem}"/>')
    x += cap + 150
    # F: 기둥 + 위 팔. 가운데 팔이 A로 들어가는 빛줄기다
    fx = x
    rect(fx, 0, sw, cap)
    rect(fx, 0, 560, sw)
    x += 600
    # A: 프리즘 — 가로줄 없는 삼각형, 바깥 꼭지와 바닥을 cap 안에 맞춘다
    ax, aw = x, 960
    apex = ax + aw / 2
    k = (aw / 2) / cap  # 빗변 기울기(가로/세로)
    t = sw * math.sqrt(1 + k * k)  # 빗변 가로 두께
    inner_top = t / k
    ib = cap - sw
    inner_l = apex - (ib - inner_top) * k
    inner_r = apex + (ib - inner_top) * k
    fill(f'M{ax} {cap}L{apex} 0L{ax + aw} {cap}Z M{inner_l:.1f} {ib}L{apex} {inner_top:.1f}L{inner_r:.1f} {ib}Z')
    # 들어가는 빛: F 기둥에서 A 왼쪽 빗변 안쪽까지
    by = 520
    enter = apex - by * k
    rect(fx, by - 26, enter - fx + t * 0.6, 52, beam)
    x = ax + aw + 90
    # L
    rect(x, 0, sw, cap)
    rect(x, cap - sw, 500, sw)
    x += 590
    # I
    rect(x, 0, sw, cap)
    x += sw + 150
    # N — 위아래 꼭지를 잘라 cap 안에 맞춘다
    nx, nw = x, 760
    rect(nx, 0, sw, cap)
    rect(nx + nw - sw, 0, sw, cap)
    d = sw * 1.25
    fill(f'M{nx} 0L{nx + d} 0L{nx + nw} {cap}L{nx + nw - d} {cap}Z')
    end = nx + nw
    # 나가는 네 줄 — 프리즘 오른쪽 빗변의 네 자리에서 나란히 내려와 L I N 아래로 곧게 뻗는다
    for c, sy, y in zip(lines, [600, 665, 730, 795], [1085, 1150, 1215, 1280]):
        sx = apex + sy * k - t * 0.5
        ex = sx + (y - sy) * 0.56
        s.append(f'<path d="M{sx:.1f} {sy}L{ex:.1f} {y}H{end}" fill="none" stroke="{c}" stroke-width="34" stroke-linejoin="miter"/>')
    return ''.join(s), end, 1300


# ── OUTBLUE ───────────────────────────────────────
def poly(pts):
    return 'M' + 'L'.join(f'{x} {y}' for x, y in pts) + 'Z'


def slit(x, y1, y2, w):
    # 세로 칼집 — 양끝이 둥글다
    r = w / 2
    return f'M{x - r} {y1 + r}A{r} {r} 0 0 1 {x + r} {y1 + r}V{y2 - r}A{r} {r} 0 0 1 {x - r} {y2 - r}Z'


def hslit(x1, x2, y, w):
    r = w / 2
    return f'M{x1 + r} {y - r}H{x2}V{y + r}H{x1 + r}A{r} {r} 0 0 1 {x1 + r} {y - r}Z'


def outblue(ink='#111111', rivet=None):
    H, W, c, sl = 1000, 590, 130, 92
    box = [(0, 0), (W - c, 0), (W, c), (W, H), (c, H), (0, H - c)]  # 오른쪽 위 · 왼쪽 아래를 벤 판

    def at(pts, x):
        return [(px + x, py) for px, py in pts]

    gap, x, s, dots = 62, 0, [], []

    def letter(path_cut, x0, pts=None):
        d = poly(at(pts or box, x0)) + path_cut
        s.append(f'<path fill-rule="evenodd" fill="{ink}" d="{d}"/>')

    mid = W / 2
    # O
    letter(slit(x + mid, 210, H - 210, sl), x)
    dots += [(x + mid, 210 + sl / 2), (x + mid, H - 210 - sl / 2)]
    x += W + gap
    # U — 위가 열린 칼집
    u = f'M{x + mid - sl / 2} 0H{x + mid + sl / 2}V{H - 210 - sl / 2}A{sl / 2} {sl / 2} 0 0 1 {x + mid - sl / 2} {H - 210 - sl / 2}Z'
    letter(u, x)
    dots += [(x + mid, H - 210 - sl / 2)]
    x += W + gap
    # T — 기둥 양쪽을 벤다
    tw = W + 40
    t = [(x, 0), (x + tw - c, 0), (x + tw, c), (x + tw, 250), (x + tw / 2 + 125, 250), (x + tw / 2 + 125, H), (x + tw / 2 - 125 + 40, H), (x + tw / 2 - 125, H - 40), (x + tw / 2 - 125, 250), (x, 250)]
    s.append(f'<path fill="{ink}" d="{poly(t)}"/>')
    dots += [(x + tw / 2, 125)]
    x += tw + gap
    # B — 가로 칼집 둘, 가운데 허리를 앞에서 판다
    b = hslit(x + 190, x + W + 1, 290, sl) if False else ''
    b = hslit(x + 210, x + W - 130, 300, sl) + hslit(x + 210, x + W - 130, H - 300, sl)
    bp = [(0, 0), (W - c, 0), (W, c), (W, 440), (W - 46, 500), (W, 560), (W, H), (c, H), (0, H - c)]
    letter(b, x, bp)
    dots += [(x + 210 + sl / 2, 300), (x + 210 + sl / 2, H - 300)]
    x += W + gap
    # L
    lw = W - 40
    lp = [(x, 0), (x + 260, 0), (x + 260, H - 260), (x + lw - c * 0.6, H - 260), (x + lw, H - 260 + c * 0.6), (x + lw, H), (x + c, H), (x, H - c)]
    s.append(f'<path fill="{ink}" d="{poly(lp)}"/>')
    dots += [(x + 130, H - 130)]
    x += lw + gap
    # U
    u2 = f'M{x + mid - sl / 2} 0H{x + mid + sl / 2}V{H - 210 - sl / 2}A{sl / 2} {sl / 2} 0 0 1 {x + mid - sl / 2} {H - 210 - sl / 2}Z'
    letter(u2, x)
    dots += [(x + mid, H - 210 - sl / 2)]
    x += W + gap
    # E — 앞으로 열린 칼집 둘
    e1 = f'M{x + 230 + sl / 2} {300 - sl / 2}H{x + W}V{300 + sl / 2}H{x + 230 + sl / 2}A{sl / 2} {sl / 2} 0 0 1 {x + 230 + sl / 2} {300 - sl / 2}Z'
    e2 = f'M{x + 230 + sl / 2} {H - 300 - sl / 2}H{x + W}V{H - 300 + sl / 2}H{x + 230 + sl / 2}A{sl / 2} {sl / 2} 0 0 1 {x + 230 + sl / 2} {H - 300 - sl / 2}Z'
    letter(e1 + e2, x)
    dots += [(x + 230 + sl / 2, 300), (x + 230 + sl / 2, H - 300)]
    x += W
    extra = ''
    if rivet:
        extra = ''.join(f'<circle cx="{a:.1f}" cy="{b_:.1f}" r="{sl / 2 + 9}" fill="{rivet}"/>' for a, b_ in dots)
    return ''.join(s) + extra, x, H


def svg(body, w, h, pad, bg):
    rect = f'<rect x="{-pad}" y="{-pad}" width="{w + 2 * pad}" height="{h + 2 * pad}" fill="{bg}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {w + 2 * pad} {h + 2 * pad}">{rect}{body}</svg>'


def save(name, parts, bg, pad=220):
    body, w, h = parts
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(svg(body, w, h, pad, bg))


save('OFALIN_흑', ofalin(), '#FFFFFF')
save('OFALIN_색', ofalin('#111111', MEMBER, '#111111', '#111111'), '#FFFFFF')
save('OUTBLUE_흑', outblue(), '#FFFFFF')
save('OUTBLUE_색', outblue('#FFFFFF', '#D9B46A'), '#1743B5')
save('OUTBLUE_색2', outblue('#1743B5', '#D9B46A'), '#FFFFFF')
print('그림')
