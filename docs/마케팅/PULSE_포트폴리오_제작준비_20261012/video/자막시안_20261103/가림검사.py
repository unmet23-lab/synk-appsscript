# 큰 낱말 가림 · 묻힘 검사(2026-11-03) — 유호님 「처음에 외계인이라는 글씨가 강아지 뒤로 가려져서 잘 안 보여 · 중간중간 가려져서 안 보이는 게 꽤 있어」
# 눈으로 몇 장 보는 대신 프레임마다 글자 하나하나를 잰다.
#   ① 가림: 피사체 뒤로 들어간 낱말에서 글자마다 피사체 마스크에 덮인 비율
#   ② 묻힘: 글자 테두리 바로 바깥 띠(4px)에서 글자색과 바탕 화면의 밝기 대비가 3:1 이상인 비율 — 짙은 글자가 검은 머리 · 회색 개 몸 위에 얹히면 낮다
#   준비:
#     npx remotion render src/index.ts p11-AB-probe <탐침> --sequence --image-format=png --scale=0.5   (remotion 폴더에서)
#     ffmpeg -i remotion/public/p11/picture.mp4 -vf scale=540:960 -start_number 0 <화면>/%05d.png
#   python -X utf8 가림검사.py <탐침> <화면> [--편 p11|p12] [--판 remotion/out/p11-AB.mp4 --그림 <모음.jpg>] [--json <결과.json>]
#   12번(--편 p12)은 컷마다 「그 사람 마주침」 큰 숫자(p12-probe, 낱말 번호 = 장소 차례 − 1)
#   ③ 덮음(--덮음): 앞에 둔 글자가 그 컷 마스크를 모두 합친 자리(+12px — 사람이 있던 곳)를 덮는 비율. 12번처럼 마스크가 튀어 앞에만 두는 편에서 본다
# 탐침 프레임: 큰 낱말만 글자마다 다른 순색(빨 · 초 · 파 · 노 · 자 · 청), 왼쪽 위 칸 색 = (16 × (낱말 번호 + 1), 피사체 뒤면 255, 밝은 글자면 255)
import argparse
import glob
import json
import math
import os
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
REMO = HERE / "remotion"
FPS = 24
SIZE = {'w': 540, 'h': 960}   # 탐침 · 화면은 반 크기 — main()이 탐침 첫 장에서 다시 읽는다(세로 540×960 · 가로 16:9는 960×540)
INK, PAPER = (0x0E, 0x13, 0x20), (0xF6, 0xF3, 0xEA)
# 편마다 글자색(P11.tsx · P12.tsx의 INK · PAPER)과 낱말 이름표
FILMS = {"p11": {"ink": INK, "paper": PAPER, "words": "외계인,바닷가,깜짝,특별한 걸,튼튼,번쩍,멋있게,외계인?"},
         "p12": {"ink": (0x10, 0x14, 0x14), "paper": (0xF7, 0xF6, 0xF1), "words": "02,03,04,05,06,07,07,08,09,10,11,12,13,14,15"},
         "hs": {"ink": INK, "paper": PAPER, "words": "내놔!,한국말이야?"}}
SEE_MIN, EDGE_MIN = 0.85, 0.60       # 글자마다 85% 넘게 보이고, 테두리 60% 넘게 대비 3:1 — 밑돌면 「안 보이는 순간」
FONT = HERE.parents[3] / "브랜드_폰트" / "SUIT" / "SUIT-SemiBold.otf"


def use_size(probe_dir):
    w, h = Image.open(sorted(glob.glob(os.path.join(probe_dir, "*.png")))[0]).size
    SIZE.update(w=w, h=h)


def lum(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def dilate(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.array(im.filter(ImageFilter.MaxFilter(2 * px + 1))) > 127


def subject_mask(t, cuts, film="p11"):
    # ../remotion/src/lib/subject.tsx maskAt과 같은 규칙 — 컷 안은 프레임으로(시작 ceil(from×24), 끝 round(to×24) 앞까지)
    f = round(t * FPS)
    for c in cuts:
        s0 = math.ceil(c["from"] * FPS - 1e-6)
        if s0 <= f < round(c["to"] * FPS):
            n = min(c["frames"], max(1, f - s0 + 1))
            a = Image.open(REMO / "public" / film / "cut" / c["cut"] / "m" / f"{n:05d}.png").getchannel("A")
            return np.array(a.resize((SIZE['w'], SIZE['h']), Image.BILINEAR)) >= 128
    return None


def measure(probe_dir, pic_dir, film="p11", cover=False):
    cuts = json.loads((REMO / "src" / film / "masks.json").read_text(encoding="utf8"))
    ink, paper = FILMS[film]["ink"], FILMS[film]["paper"]
    files = sorted(glob.glob(os.path.join(probe_dir, "*.png")))
    rows = []
    for f, fp in enumerate(files):
        im = np.array(Image.open(fp).convert("RGB")).astype(np.int32)
        meta = im[3, 3].copy()
        if meta.max() < 8:
            continue
        idx, behind, light = int(round(meta[0] / 16)) - 1, meta[1] > 127, meta[2] > 127
        im[:12, :12] = 0
        m = im.max(2)
        fmax = int(m.max())
        if fmax < 30:
            continue
        # 낱말 둘레(+16px)만 잘라 잰다 — 화면 전체로 거르면 한 번에 몇 분
        ys, xs = np.nonzero(m >= 0.15 * fmax)
        y0, y1, x0, x1 = max(0, ys.min() - 16), min(SIZE['h'], ys.max() + 17), max(0, xs.min() - 16), min(SIZE['w'], xs.max() + 17)
        im, m = im[y0:y1, x0:x1], m[y0:y1, x0:x1]
        core = m >= 0.5 * fmax
        bits = [(im[..., ch] >= 0.5 * np.maximum(m, 1)) for ch in range(3)]
        code = bits[0] * 4 + bits[1] * 2 + bits[2] * 1
        CH = {4: 0, 2: 1, 1: 2, 6: 3, 5: 4, 3: 5}
        t = f / FPS
        S = subject_mask(t, cuts, film) if behind else None
        U = None
        if cover and not behind:
            from 자리찾기 import union_mask
            cut = next((c for c in cuts if c["from"] <= t < c["to"]), None)
            U = union_mask(cut, film)[y0:y1, x0:x1] if cut else None
        if S is not None:
            S = S[y0:y1, x0:x1]
        pic = np.array(Image.open(os.path.join(pic_dir, f"{f:05d}.png")).convert("RGB"))[y0:y1, x0:x1]
        Lbg = lum(pic)
        Lt = float(lum(paper if light else ink))
        cr = (np.maximum(Lbg, Lt) + 0.05) / (np.minimum(Lbg, Lt) + 0.05)
        allg = dilate(m >= 0.15 * fmax, 1)
        chars = []
        for c_code, ci in sorted(CH.items(), key=lambda x: x[1]):
            g = core & (code == c_code)
            n = int(g.sum())
            if n < 20:
                continue
            occ = float((g & S).sum()) / n if S is not None else 0.0
            ring = dilate(g, 4) & ~allg
            if S is not None:
                ring &= ~S
            rn = int(ring.sum())
            edge = float((cr[ring] >= 3.0).sum()) / rn if rn else 0.0
            chars.append({"i": ci, "see": 1 - occ, "edge": edge})
        if not chars:
            continue
        glyph = core
        cov = float((glyph & U).sum()) / max(1, int(glyph.sum())) if U is not None else 0.0
        rows.append({"f": f, "t": round(t, 3), "w": idx, "behind": bool(behind), "light": bool(light), "cover": round(cov, 3),
                     "steady": fmax >= 0.9 * 255, "chars": chars,
                     "see": min(c["see"] for c in chars), "edge": min(c["edge"] for c in chars)})
    return rows


def summary(rows):
    out = []
    for idx in sorted({r["w"] for r in rows}):
        rs = [r for r in rows if r["w"] == idx]
        st = [r for r in rs if r["steady"]] or rs
        bad_see = [r for r in st if r["see"] < SEE_MIN]
        bad_edge = [r for r in st if r["edge"] < EDGE_MIN]
        bad = [r for r in st if r["see"] < SEE_MIN or r["edge"] < EDGE_MIN]
        worst = min(st, key=lambda r: min(r["see"], r["edge"] / EDGE_MIN * SEE_MIN))
        out.append({"w": idx, "from": rs[0]["t"], "to": round(rs[-1]["t"] + 1 / FPS, 3),
                    "behind_s": round(sum(r["behind"] for r in rs) / FPS, 2), "light": rs[0]["light"],
                    "see_min": round(min(r["see"] for r in st), 3), "edge_min": round(min(r["edge"] for r in st), 3),
                    "bad_see_s": round(len(bad_see) / FPS, 2), "bad_edge_s": round(len(bad_edge) / FPS, 2),
                    "ok_share": round(1 - len(bad) / len(st), 3), "steady_s": round(len(st) / FPS, 2), "cover_max": round(max(r.get("cover", 0) for r in st), 3),
                    "worst_f": worst["f"], "worst_chars": worst["chars"]})
    return out


def sheet(summ, rows, video, path, words):
    """낱말마다 가장 나쁜 프레임 — 실제 판 위에 가려진 글자 칸(빨강) · 묻힌 테두리(주황) 표시는 숫자로만, 그림은 실제 판 그대로."""
    fs = sorted({s["worst_f"] for s in summ})
    tmp = Path(path).with_suffix("")
    tmp.mkdir(parents=True, exist_ok=True)
    sel = "+".join(f"eq(n\\,{f})" for f in fs)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", f"select='{sel}',scale={SIZE['w']}:{SIZE['h']}", "-fps_mode", "passthrough", str(tmp / "%02d.png")], check=True)
    shots = {f: Image.open(tmp / f"{k + 1:02d}.png").convert("RGB") for k, f in enumerate(fs)}
    font = ImageFont.truetype(str(FONT), 22)
    cols = 4
    rows_n = math.ceil(len(summ) / cols)
    bd = Image.new("RGB", (cols * SIZE['w'], rows_n * (SIZE['h'] + 70)), (18, 18, 18))
    for k, s in enumerate(summ):
        x, y = (k % cols) * SIZE['w'], (k // cols) * (SIZE['h'] + 70)
        bd.paste(shots[s["worst_f"]], (x, y + 70))
        d = ImageDraw.Draw(bd)
        nm = words[s["w"]] if words and s["w"] < len(words) else f"#{s['w']}"
        d.text((x + 12, y + 8), f"{nm}  {s['worst_f'] / FPS:.2f}초", font=font, fill=(255, 255, 255))
        d.text((x + 12, y + 38), f"보임 최저 {s['see_min'] * 100:.0f}% · 대비 최저 {s['edge_min'] * 100:.0f}% · 괜찮은 몫 {s['ok_share'] * 100:.0f}%", font=ImageFont.truetype(str(FONT), 18), fill=(255, 210, 80) if s["ok_share"] < 0.95 else (150, 230, 150))
    bd.save(path, quality=90)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("probe")
    ap.add_argument("pic")
    ap.add_argument("--판")
    ap.add_argument("--그림")
    ap.add_argument("--json")
    ap.add_argument("--편", default="p11", choices=sorted(FILMS))
    ap.add_argument("--낱말")
    ap.add_argument("--덮음", action="store_true")
    a = ap.parse_args()
    words = (a.낱말 or FILMS[a.편]["words"]).split(",")
    use_size(a.probe)
    rows = measure(a.probe, a.pic, a.편, a.덮음)
    summ = summary(rows)
    print(f"{'낱말':<8}{'구간':>14}{'뒤(초)':>8}{'보임 최저':>10}{'대비 최저':>10}{'가림(초)':>9}{'묻힘(초)':>9}{'괜찮은 몫':>10}" + ("   덮음 최고" if a.덮음 else ""))
    for s in summ:
        nm = words[s["w"]] if s["w"] < len(words) else f"#{s['w']}"
        print(f"{nm:<8}{s['from']:>7.2f}–{s['to']:<6.2f}{s['behind_s']:>8.2f}{s['see_min'] * 100:>9.0f}%{s['edge_min'] * 100:>9.0f}%{s['bad_see_s']:>9.2f}{s['bad_edge_s']:>9.2f}{s['ok_share'] * 100:>9.0f}%"
              + (f"{s['cover_max'] * 100:>10.0f}%" if a.덮음 else "") + ("" if s["ok_share"] >= 0.95 else "  ← 손볼 것"))
    if a.json:
        Path(a.json).write_text(json.dumps({"summary": summ, "rows": rows}, ensure_ascii=False), encoding="utf8")
    if a.그림 and a.판:
        sheet(summ, rows, a.판, a.그림, words)
        print(a.그림)


if __name__ == "__main__":
    main()
