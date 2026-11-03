# 큰 낱말 자리 찾기(2026-11-03) — 가림검사.py가 「안 보이는 순간」을 찾은 낱말마다, 그 낱말이 떠 있는 프레임의 피사체 마스크 · 화면을 맞대어
# 자리(왼 · 가운데 · 오른 정렬, 높이) · 크기 · 색(짙은 INK · 밝은 PAPER) · 층(피사체 뒤 · 앞) 후보를 모두 재고 나은 순서로 낸다.
#   python -X utf8 자리찾기.py <탐침> <화면> --검사 <가림검사 결과.json> --낱말 0,3,4 [--그림 <후보.jpg>]
# 글자 모양은 SUIT ExtraBold를 PIL로 그려 탐침 프레임에 위치를 맞춘(보정) 뒤 쓴다. 고른 자리는 P11.tsx에 넣고 다시 탐침 렌더 + 가림검사.py로 확인한다.
# 점수: 괜찮은 프레임 몫(글자마다 88% 넘게 보이고 테두리 65% 넘게 대비 3:1)이 먼저, 그다음 S42 깊이(뒤 글자가 2~12% 덮임) · 원래 자리 · 크기 · INK를 조금씩 더 친다.
import argparse
import glob
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from 가림검사 import FPS, H, INK, PAPER, REMO, W, dilate, lum, subject_mask

FONT_XB = str(REMO.parents[4] / "브랜드_폰트" / "SUIT" / "SUIT-ExtraBold.otf")
LABEL = str(REMO.parents[4] / "브랜드_폰트" / "SUIT" / "SUIT-SemiBold.otf")
# P11.tsx BIG_A 순서 — (낱말, 지금 y, 지금 크기, 아래 끝 한계). 말자막 상자 위 1460, 「튼튼」은 특징 칩(1360) 위
BIG = [("외계인", 250, 250, 1460), ("바닷가", 250, 250, 1460), ("깜짝", 300, 300, 1460), ("특별한 걸", 330, 190, 1460),
       ("튼튼", 300, 280, 1340), ("번쩍", 260, 300, 1460), ("멋있게", 1080, 200, 1460), ("외계인?", 1080, 220, 1460)]
SEE, EDGE = 0.88, 0.65
BOX_L, BOX_W = 28, 490               # abs(56, y, 980)의 반 크기


class Glyphs:
    def __init__(self, dy_k, dx, ls_k):
        self.dy_k, self.dx, self.ls_k, self.fonts = dy_k, dx, ls_k, {}

    def font(self, s):
        if s not in self.fonts:
            self.fonts[s] = ImageFont.truetype(FONT_XB, s)
        return self.fonts[s]

    def layout(self, word, size_full, xm, y_full):
        """글자마다 (알파 배열, 바탕 좌표) — 반 크기 화면 기준."""
        s = round(size_full / 2)
        f = self.font(s)
        adv = [f.getlength(ch) - self.ls_k * s for ch in word]
        width = sum(adv)
        x0 = BOX_L if xm == "l" else BOX_L + (BOX_W - width) / 2 if xm == "c" else BOX_L + BOX_W - width
        base = y_full / 2 + self.dy_k * s
        out, x = [], x0 + self.dx
        for ch, a in zip(word, adv):
            if ch != " ":
                im = Image.new("L", (W, H), 0)
                ImageDraw.Draw(im).text((x, base), ch, font=f, fill=255, anchor="ls")
                out.append(np.array(im))
            x += a
        return out, width


def calibrate(probe_dir, rows):
    """외계인(0번) 가만히 선 프레임의 탐침 글자 테두리에 PIL 글자를 맞춘다 — 세로 기준선 · 가로 시작 · 자간."""
    st = [r for r in rows if r["w"] == 0 and r["steady"]]
    r = st[len(st) // 2]
    im = np.array(Image.open(sorted(glob.glob(os.path.join(probe_dir, "*.png")))[r["f"]]).convert("RGB")).astype(int)
    im[:12, :12] = 0
    m = im.max(2)
    ys, xs = np.nonzero(m >= 0.5 * m.max())
    pt, pb, pl, pr = ys.min(), ys.max(), xs.min(), xs.max()
    g = Glyphs(0.8, 0.0, 0.05)
    best = None
    for ls in np.arange(0.02, 0.081, 0.005):
        g.ls_k = ls
        a, _ = g.layout("외계인", 250, "l", 250)
        u = np.maximum.reduce(a) >= 128
        yy, xx = np.nonzero(u)
        err = abs((xx.max() - xx.min()) - (pr - pl))
        if best is None or err < best[0]:
            best = (err, ls, yy.min(), xx.min())
    _, ls, gt, gl = best
    g.ls_k = ls
    g.dy_k = 0.8 + (pt - gt) / round(250 / 2)
    g.dx = float(pl - gl)
    a, _ = g.layout("외계인", 250, "l", 250)
    u = np.maximum.reduce(a) >= 128
    yy, xx = np.nonzero(u)
    print(f"보정: 자간 −{ls:.3f}em · 기준선 {g.dy_k:.3f} · 가로 {g.dx:+.1f}px — 탐침 {pl},{pt}–{pr},{pb} / PIL {xx.min()},{yy.min()}–{xx.max()},{yy.max()}")
    return g


def frames_of(rows, wi):
    rs = [r for r in rows if r["w"] == wi]
    return [r["f"] for r in rs], [r["f"] for r in rs if r["steady"]]


def search(g, wi, rows, pic_dir, cuts, top=5):
    name, y0, s0, ylim = BIG[wi]
    allf, steady = frames_of(rows, wi)
    data = {}
    for f in allf:
        t = f / FPS
        S = subject_mask(t, cuts)
        pic = np.array(Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB"))
        L = lum(pic)
        pi = (np.maximum(L, lum(INK)) + 0.05) / (np.minimum(L, lum(INK)) + 0.05) >= 3.0
        pp = (np.maximum(L, lum(PAPER)) + 0.05) / (np.minimum(L, lum(PAPER)) + 0.05) >= 3.0
        data[f] = (S, pi, pp)
    sizes = sorted({s0, 300, 270, 240, 210, 180}, reverse=True)
    res = []
    for size in sizes:
        for xm in "lcr":
            for yf in range(190, ylim - size + 1, 20):
                chars, width = g.layout(name, size, xm, yf)
                if width > BOX_W + 2:
                    continue
                cores = [c >= 128 for c in chars]
                allg = np.maximum.reduce(chars) >= 40
                ys, xs = np.nonzero(allg)
                if not len(ys):
                    continue
                y_a, y_b, x_a, x_b = max(0, ys.min() - 8), min(H, ys.max() + 9), max(0, xs.min() - 8), min(W, xs.max() + 9)
                cores = [c[y_a:y_b, x_a:x_b] for c in cores]
                union = np.logical_or.reduce(cores)
                allc = dilate(allg[y_a:y_b, x_a:x_b], 1)
                rings = [dilate(c, 4) & ~allc for c in cores]
                for layer in ("behind", "front"):
                    for col in ("ink", "paper"):
                        ok = cover = occs = 0
                        edges = []
                        worst = (9, None)
                        for f in allf:
                            S, pi, pp = data[f]
                            Sc = S[y_a:y_b, x_a:x_b] if S is not None else None
                            pc = (pi if col == "ink" else pp)[y_a:y_b, x_a:x_b]
                            see_m, edge_m = 1.0, 1.0
                            for c, rg in zip(cores, rings):
                                n = c.sum()
                                if layer == "behind" and Sc is not None:
                                    see = 1 - (c & Sc).sum() / n
                                    rv = rg & ~Sc
                                else:
                                    see, rv = 1.0, rg
                                rn = rv.sum()
                                e = (rv & pc).sum() / rn if rn else 0.0
                                see_m, edge_m = min(see_m, see), min(edge_m, e)
                            if f in steady:
                                good = see_m >= SEE and edge_m >= EDGE
                                ok += good
                                edges.append(edge_m)
                                if layer == "behind" and Sc is not None:
                                    occs += 1 - see_m
                                if layer == "front" and Sc is not None:
                                    cover += float((union & Sc).sum()) / max(1, union.sum())
                                sc = min(see_m / SEE, edge_m / EDGE)
                                if sc < worst[0]:
                                    worst = (sc, f)
                        n = max(1, len(steady))
                        share = ok / n
                        occ = occs / n
                        depth = 6 if layer == "behind" and 0.02 <= occ <= 0.12 else 0
                        score = share * 100 + depth + 5 * float(np.mean(edges)) - abs(yf - y0) / 100 * 1.5 - (s0 - size) / 30 * 1.5 - (2 if col == "paper" else 0) - 25 * cover / n
                        res.append({"w": wi, "name": name, "size": size, "x": xm, "y": yf, "layer": layer, "color": col, "share": round(share, 3),
                                    "edge": round(float(np.mean(edges)), 3), "occ": round(occ, 3), "cover": round(cover / n, 3), "score": round(score, 2), "worst_f": worst[1]})
    # 같은 층 · 색 · 정렬에서 높이만 다른 이웃은 하나만
    res.sort(key=lambda r: -r["score"])
    pick = []
    for r in res:
        if any(p["layer"] == r["layer"] and p["color"] == r["color"] and p["x"] == r["x"] and p["size"] == r["size"] and abs(p["y"] - r["y"]) < 120 for p in pick):
            continue
        pick.append(r)
        if len(pick) >= top:
            break
    return pick


def preview(g, picks, pic_dir, cuts, path):
    """후보마다 가장 나쁜 프레임에 글자를 얹어(뒤 글자면 피사체를 다시 덮어) 한 장으로."""
    font = ImageFont.truetype(LABEL, 20)
    cols = max(len(p) for p in picks)
    bd = Image.new("RGB", (cols * W, len(picks) * (H + 56)), (18, 18, 18))
    for ri, row in enumerate(picks):
        for ci, p in enumerate(row):
            f = p["worst_f"]
            pic = Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB")
            chars, _ = g.layout(p["name"], p["size"], p["x"], p["y"])
            a = Image.fromarray(np.maximum.reduce(chars).astype(np.uint8))
            col = INK if p["color"] == "ink" else PAPER
            pic.paste(Image.new("RGB", (W, H), col), (0, 0), a)
            S = subject_mask(f / FPS, cuts)
            if p["layer"] == "behind" and S is not None:
                src = Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB")
                pic.paste(src, (0, 0), Image.fromarray((S * 255).astype(np.uint8)))
            x, y = ci * W, ri * (H + 56)
            bd.paste(pic, (x, y + 56))
            d = ImageDraw.Draw(bd)
            d.text((x + 10, y + 6), f"{p['name']} {p['size']} {p['x']}{p['y']} {p['layer']} {p['color']}", font=font, fill=(255, 255, 255))
            d.text((x + 10, y + 30), f"괜찮은 몫 {p['share'] * 100:.0f}% · 대비 {p['edge'] * 100:.0f}% · 덮임 {p['occ'] * 100:.0f}% · 점수 {p['score']}", font=font, fill=(255, 210, 80))
    bd.save(path, quality=88)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("probe")
    ap.add_argument("pic")
    ap.add_argument("--검사", required=True)
    ap.add_argument("--낱말", default="0,3,4,5,6,7")
    ap.add_argument("--그림")
    ap.add_argument("--json")
    a = ap.parse_args()
    rows = json.loads(open(a.검사, encoding="utf8").read())["rows"]
    cuts = json.loads((REMO / "src" / "p11" / "masks.json").read_text(encoding="utf8"))
    g = calibrate(a.probe, rows)
    allp = []
    for wi in [int(x) for x in a.낱말.split(",")]:
        picks = search(g, wi, rows, a.pic, cuts)
        allp.append(picks)
        print(f"\n{BIG[wi][0]} (지금 y {BIG[wi][1]} · 크기 {BIG[wi][2]})")
        for p in picks:
            print(f"  {p['size']:>3} {p['x']} y{p['y']:<5} {p['layer']:<7}{p['color']:<6} 괜찮은 몫 {p['share'] * 100:>4.0f}% 대비 {p['edge'] * 100:>3.0f}% 덮임 {p['occ'] * 100:>3.0f}% 앞에서 가림 {p['cover'] * 100:>3.0f}% 점수 {p['score']}")
    if a.json:
        open(a.json, "w", encoding="utf8").write(json.dumps(allp, ensure_ascii=False))
    if a.그림:
        preview(g, allp, a.pic, cuts, a.그림)
        print(a.그림)


if __name__ == "__main__":
    main()
