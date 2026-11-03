# 큰 낱말 자리 찾기(2026-11-03) — 가림검사.py가 「안 보이는 순간」을 찾은 낱말마다, 그 낱말이 떠 있는 프레임의 피사체 마스크 · 화면을 맞대어
# 자리(왼 · 가운데 · 오른 정렬, 높이) · 크기 · 색(짙은 INK · 밝은 PAPER) · 층(피사체 뒤 · 앞) 후보를 모두 재고 나은 순서로 낸다.
#   python -X utf8 자리찾기.py <탐침> <화면> --검사 <가림검사 결과.json> [--편 p11|p12] --낱말 0,3,4 [--묶음 9,10,11] [--그림 <후보.jpg>]
#   --묶음: 여러 낱말을 한 자리로(12번 속사포 컷처럼 자리가 컷마다 뛰면 어지러운 곳) — 프레임마다 그 프레임의 낱말로 잰다
# 글자 모양은 SUIT ExtraBold를 PIL로 그려 탐침 프레임에 위치를 맞춘(보정) 뒤 쓴다. 고른 자리는 P11.tsx · P12.tsx에 넣고 다시 탐침 렌더 + 가림검사.py로 확인한다.
# 점수: 괜찮은 프레임 몫(글자마다 88% 넘게 보이고 테두리 65% 넘게 대비 3:1)이 먼저, 그다음 S42 깊이(뒤 글자가 2~12% 덮임) · 원래 자리 · 크기 · INK를 조금씩 더 친다.
import argparse
import glob
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from 가림검사 import FILMS, FPS, REMO, SIZE, dilate, lum, subject_mask, use_size

FONT_XB = str(REMO.parents[4] / "브랜드_폰트" / "SUIT" / "SUIT-ExtraBold.otf")
LABEL = str(REMO.parents[4] / "브랜드_폰트" / "SUIT" / "SUIT-SemiBold.otf")
SEE, EDGE = 0.88, 0.65
BOX_L = 28                           # abs(56, y, …)의 반 크기


def pill_full():
    # P12.tsx 「번째」 알약 — marginLeft 18 + 좌우 padding 20 · 20 + 글자 40px(자간 −0.02em)
    f = ImageFont.truetype(FONT_XB, 40)
    return 18 + 40 + f.getlength("번째") - 2 * 0.02 * 40


# 편마다 — big: (낱말, 지금 y, 지금 크기, 아래 끝 한계[, 지금 정렬 — 없으면 왼쪽]), 찾을 크기 · 높이 아래 한계 · 글자 상자 폭(abs(56, y, 폭)) · 자간 처음값 · 숫자 뒤 알약 폭
CFG = {
    # 11번 P11.tsx BIG_A 순서. 말자막 상자 위 1460, 「튼튼」은 특징 칩(1360) 위
    "p11": {"big": [("외계인", 250, 250, 1460), ("바닷가", 250, 250, 1460), ("깜짝", 300, 300, 1460), ("특별한 걸", 330, 190, 1460),
                    ("튼튼", 300, 280, 1340), ("번쩍", 260, 300, 1460), ("멋있게", 1080, 200, 1460), ("외계인?", 1080, 220, 1460)],
            "sizes": [300, 270, 240, 210, 180], "ymin": 190, "box": 980, "ls": 0.05, "tail": 0},
    # 12번 P12.tsx 큰 숫자(장소 차례 1~15). 머리 줄 · 장소 칩(~360) 아래, 진행 선(1800) 위
    # rembg 마스크가 컷 절반에서 비거나 튀어(11-03, 남자가 작거나 카메라가 돌아 들어감) 뒤로는 안 보내고, 그 컷 마스크를 모두 합친 자리(+12px)를 피해 앞에 둔다
    "p12": {"big": [(d, 420, 440, 1700) for d in FILMS["p12"]["words"].split(",")],
            "sizes": [520, 480, 440, 400, 360, 320], "ymin": 400, "box": 968, "ls": 0.06, "tail": None,
            "layers": ("front",), "union": True, "cover_max": 0.03},
    # 매진 임박 hs16(1920×1080) — 강도 컷 둘. 말자막 상자(918) 위
    "hs": {"big": [("내놔!", 300, 300, 880, "r"), ("한국말이야?", 160, 220, 880, "r")],
           "sizes": [340, 300, 260, 220, 190], "ymin": 40, "box": 1808, "ls": 0.05, "tail": 0},
}


class Glyphs:
    def __init__(self, dy_k, dx, ls_k, box, tail):
        self.dy_k, self.dx, self.ls_k, self.fonts = dy_k, dx, ls_k, {}
        self.box_w, self.tail = box / 2, tail / 2

    def font(self, s):
        if s not in self.fonts:
            self.fonts[s] = ImageFont.truetype(FONT_XB, s)
        return self.fonts[s]

    def layout(self, word, size_full, xm, y_full):
        """글자마다 알파 배열 — 반 크기 화면 기준. 줄 폭에는 뒤 알약까지 넣어 가운데 · 오른 정렬을 맞춘다."""
        s = round(size_full / 2)
        f = self.font(s)
        adv = [f.getlength(ch) - self.ls_k * s for ch in word]
        width = sum(adv)
        line = width + self.tail
        x0 = BOX_L if xm == "l" else BOX_L + (self.box_w - line) / 2 if xm == "c" else BOX_L + self.box_w - line
        base = y_full / 2 + self.dy_k * s
        out, x = [], x0 + self.dx
        for ch, a in zip(word, adv):
            if ch != " ":
                im = Image.new("L", (SIZE['w'], SIZE['h']), 0)
                ImageDraw.Draw(im).text((x, base), ch, font=f, fill=255, anchor="ls")
                out.append(np.array(im))
            x += a
        return out, line


def calibrate(probe_dir, rows, cfg):
    """0번 낱말(지금 자리 · 정렬)이 가만히 선 프레임의 탐침 글자 테두리에 PIL 글자를 맞춘다 — 세로 기준선 · 가로 시작 · 자간."""
    name, y0, s0 = cfg["big"][0][:3]
    xm = cfg["big"][0][4] if len(cfg["big"][0]) > 4 else "l"
    st = [r for r in rows if r["w"] == 0 and r["steady"]]
    r = st[len(st) // 2]
    im = np.array(Image.open(sorted(glob.glob(os.path.join(probe_dir, "*.png")))[r["f"]]).convert("RGB")).astype(int)
    im[:12, :12] = 0
    m = im.max(2)
    ys, xs = np.nonzero(m >= 0.5 * m.max())
    pt, pb, pl, pr = ys.min(), ys.max(), xs.min(), xs.max()
    g = Glyphs(0.8, 0.0, cfg["ls"], cfg["box"], cfg["tail"])
    best = None
    for ls in np.arange(cfg["ls"] - 0.03, cfg["ls"] + 0.031, 0.005):
        g.ls_k = ls
        a, _ = g.layout(name, s0, xm, y0)
        u = np.maximum.reduce(a) >= 128
        yy, xx = np.nonzero(u)
        err = abs((xx.max() - xx.min()) - (pr - pl))
        if best is None or err < best[0]:
            best = (err, ls, yy.min(), xx.min())
    _, ls, gt, gl = best
    g.ls_k = ls
    g.dy_k = 0.8 + (pt - gt) / round(s0 / 2)
    g.dx = float(pl - gl)
    a, _ = g.layout(name, s0, xm, y0)
    u = np.maximum.reduce(a) >= 128
    yy, xx = np.nonzero(u)
    print(f"보정: 자간 −{ls:.3f}em · 기준선 {g.dy_k:.3f} · 가로 {g.dx:+.1f}px — 탐침 {pl},{pt}–{pr},{pb} / PIL {xx.min()},{yy.min()}–{xx.max()},{yy.max()}")
    return g


def union_mask(cut, film, cache={}):
    """그 컷 마스크를 모두 합쳐 넓힌 자리 — 마스크가 비는 프레임에도 사람이 있던 곳."""
    key = (film, cut["cut"])
    if key not in cache:
        u = None
        for n in range(1, cut["frames"] + 1):
            a = np.array(Image.open(REMO / "public" / film / "cut" / cut["cut"] / "m" / f"{n:05d}.png").getchannel("A").resize((SIZE['w'], SIZE['h']), Image.BILINEAR)) >= 128
            u = a if u is None else (u | a)
        cache[key] = dilate(u, 6)
    return cache[key]


def search(g, group, rows, pic_dir, cuts, film, cfg, top=5, step=1):
    big = cfg["big"]
    name, y0, s0, ylim = big[group[0]][:4]
    ink, paper = FILMS[film]["ink"], FILMS[film]["paper"]
    word_of, steady = {}, set()
    for r in rows:
        if r["w"] in group:
            word_of[r["f"]] = r["w"]
            if r["steady"]:
                steady.add(r["f"])
    allf = sorted(word_of)[::step]   # --간격: 긴 컷은 몇 장에 한 장만 재서 고르고, 마지막 확인은 가림검사.py 전 프레임으로
    steady &= set(allf)
    data = {}
    for f in allf:
        cut = next((c for c in cuts if c["from"] <= f / FPS < c["to"]), None)
        S = (union_mask(cut, film) if cut else None) if cfg.get("union") else subject_mask(f / FPS, cuts, film)
        L = lum(np.array(Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB")))
        pi = (np.maximum(L, lum(ink)) + 0.05) / (np.minimum(L, lum(ink)) + 0.05) >= 3.0
        pp = (np.maximum(L, lum(paper)) + 0.05) / (np.minimum(L, lum(paper)) + 0.05) >= 3.0
        data[f] = (S, pi, pp)
    sizes = sorted(set(cfg["only_sizes"]) if cfg.get("only_sizes") else {s0, *cfg["sizes"]}, reverse=True)
    res = []
    for size in sizes:
        for xm in cfg.get("only_x", "lcr"):
            for yf in (cfg["only_y"] if cfg.get("only_y") else range(cfg["ymin"], ylim - size + 1, 20)):
                geo, fit = {}, True
                for wi in group:
                    chars, line = g.layout(big[wi][0], size, xm, yf)
                    if line > g.box_w + 2:
                        fit = False
                        break
                    allg = np.maximum.reduce(chars) >= 40
                    ys, xs = np.nonzero(allg)
                    y_a, y_b, x_a, x_b = max(0, ys.min() - 8), min(SIZE['h'], ys.max() + 9), max(0, xs.min() - 8), min(SIZE['w'], xs.max() + 9)
                    cores = [c[y_a:y_b, x_a:x_b] >= 128 for c in chars]
                    allc = dilate(allg[y_a:y_b, x_a:x_b], 1)
                    geo[wi] = ((y_a, y_b, x_a, x_b), cores, np.logical_or.reduce(cores), [dilate(c, 4) & ~allc for c in cores])
                if not fit:
                    continue
                for layer in cfg.get("layers", ("behind", "front")):
                    for col in ("ink", "paper"):
                        ok = cover = occs = 0
                        cmax = cfg.get("cover_max", 1.0)
                        edges = []
                        worst = (9, None)
                        for f in allf:
                            (y_a, y_b, x_a, x_b), cores, union, rings = geo[word_of[f]]
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
                            cf = float((union & Sc).sum()) / max(1, union.sum()) if layer == "front" and Sc is not None else 0.0
                            if f in steady:
                                ok += see_m >= SEE and edge_m >= EDGE and cf <= cmax
                                edges.append(edge_m)
                                if layer == "behind" and Sc is not None:
                                    occs += 1 - see_m
                                cover += cf
                                sc = min(see_m / SEE, edge_m / EDGE, (cmax / cf) if cf > cmax else 9)
                                if sc < worst[0]:
                                    worst = (sc, f)
                        n = max(1, len(steady))
                        share = ok / n
                        occ = occs / n
                        depth = 6 if layer == "behind" and 0.02 <= occ <= 0.12 else 0
                        score = share * 100 + depth + 5 * float(np.mean(edges)) - abs(yf - y0) / 100 * 1.5 - (s0 - size) / 30 * 1.5 - (2 if col == "paper" else 0) - 25 * cover / n
                        res.append({"w": group, "name": name, "size": size, "x": xm, "y": yf, "layer": layer, "color": col, "share": round(share, 3),
                                    "edge": round(float(np.mean(edges)), 3), "occ": round(occ, 3), "cover": round(cover / n, 3), "score": round(score, 2), "worst_f": worst[1],
                                    "worst_w": word_of.get(worst[1], group[0])})
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


def preview(g, picks, pic_dir, cuts, film, cfg, path):
    """후보마다 가장 나쁜 프레임에 글자를 얹어(뒤 글자면 피사체를 다시 덮어) 한 장으로."""
    font = ImageFont.truetype(LABEL, 20)
    ink, paper = FILMS[film]["ink"], FILMS[film]["paper"]
    cols = max(len(p) for p in picks)
    bd = Image.new("RGB", (cols * SIZE['w'], len(picks) * (SIZE['h'] + 56)), (18, 18, 18))
    for ri, row in enumerate(picks):
        for ci, p in enumerate(row):
            f = p["worst_f"]
            pic = Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB")
            chars, _ = g.layout(cfg["big"][p["worst_w"]][0], p["size"], p["x"], p["y"])
            a = Image.fromarray(np.maximum.reduce(chars).astype(np.uint8))
            pic.paste(Image.new("RGB", (SIZE['w'], SIZE['h']), ink if p["color"] == "ink" else paper), (0, 0), a)
            S = subject_mask(f / FPS, cuts, film)
            if p["layer"] == "behind" and S is not None:
                src = Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB")
                pic.paste(src, (0, 0), Image.fromarray((S * 255).astype(np.uint8)))
            x, y = ci * SIZE['w'], ri * (SIZE['h'] + 56)
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
    ap.add_argument("--편", default="p11", choices=sorted(CFG))
    ap.add_argument("--낱말", default="")
    ap.add_argument("--묶음", action="append", default=[])
    ap.add_argument("--그림")
    ap.add_argument("--json")
    ap.add_argument("--간격", type=int, default=1)
    ap.add_argument("--크기", help="이 크기들만(쉼표) — 한 자리 고정을 재 볼 때")
    ap.add_argument("--높이", help="이 y들만(쉼표)")
    ap.add_argument("--정렬", help="l · c · r 가운데 쓸 것만(예: l)")
    a = ap.parse_args()
    cfg = dict(CFG[a.편])
    if a.크기:
        cfg["only_sizes"] = [int(x) for x in a.크기.split(",")]
    if a.높이:
        cfg["only_y"] = [int(x) for x in a.높이.split(",")]
    if a.정렬:
        cfg["only_x"] = a.정렬
    if cfg["tail"] is None:
        cfg["tail"] = pill_full()
    use_size(a.probe)
    rows = json.loads(open(a.검사, encoding="utf8").read())["rows"]
    cuts = json.loads((REMO / "src" / a.편 / "masks.json").read_text(encoding="utf8"))
    g = calibrate(a.probe, rows, cfg)
    groups = [[int(x)] for x in a.낱말.split(",") if x] + [[int(x) for x in m.split(",")] for m in a.묶음]
    allp = []
    for group in groups:
        picks = search(g, group, rows, a.pic, cuts, a.편, cfg, step=a.간격)
        allp.append(picks)
        names = " · ".join(cfg["big"][wi][0] for wi in group)
        print(f"\n{names} (지금 y {cfg['big'][group[0]][1]} · 크기 {cfg['big'][group[0]][2]})")
        for p in picks:
            print(f"  {p['size']:>3} {p['x']} y{p['y']:<5} {p['layer']:<7}{p['color']:<6} 괜찮은 몫 {p['share'] * 100:>4.0f}% 대비 {p['edge'] * 100:>3.0f}% 덮임 {p['occ'] * 100:>3.0f}% 앞에서 가림 {p['cover'] * 100:>3.0f}% 점수 {p['score']}")
    if a.json:
        open(a.json, "w", encoding="utf8").write(json.dumps(allp, ensure_ascii=False))
    if a.그림:
        preview(g, allp, a.pic, cuts, a.편, cfg, a.그림)
        print(a.그림)


if __name__ == "__main__":
    main()
