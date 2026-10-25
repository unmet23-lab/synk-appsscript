"""PULSE 1 · 3번 가상 브랜드 캔 라벨 — 2D 원본(SVG)과 블렌더용 그림을 만든다 (2026-10-25).

제작 규칙대로 제품 · 로고 · 글자는 AI로 그리지 않는다. 글자는 OFL 글꼴(Fraunces · SUIT)의
윤곽을 하프버즈로 짜서 SVG 경로로 굳히고, 무늬는 이 파일의 좌표로 그린다.

  python 라벨.py                    # 가칭(오미톡)으로 SVG · PNG 세 장
  python 라벨.py --이름 톡미 --라틴 tokmi

나오는 것:
  라벨/라벨_<이름>.svg             — 원본(벡터). 캔 몸통을 편 그림, 단위 mm
  <밖>/라벨_<이름>_색.png           — 블렌더 바탕색
  <밖>/라벨_<이름>_금속.png         — 금속 몫(흰 · 연분홍 잉크 0, 남색 · 루비 잉크는 알루미늄이 비침)
  <밖>/라벨_<이름>_미리.png         — 보기용 작은 판
<밖> = Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/라벨
"""
import argparse
import math
import os
import random
import subprocess

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

여기 = os.path.dirname(os.path.abspath(__file__))
저장소 = os.path.abspath(os.path.join(여기, *[".."] * 6))
밖 = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/라벨"
FRAUNCES = r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p1p3/글꼴/Fraunces.ttf"
SUIT = {
    "Heavy": os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-Heavy.otf"),
    "ExtraBold": os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-ExtraBold.otf"),
    "SemiBold": os.path.join(저장소, "docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf"),
}
SHARP = os.path.join(저장소, "desktop/node_modules/sharp")

# 355ml 표준 캔: 몸통 지름 66 mm. 펼친 폭 = 둘레, 높이 = 몸통 아래 굽이(z 4)부터 목(z 118)까지
W = 2 * math.pi * 33.0  # 207.35
H = 114.0
CX = W / 2  # 앞면 가운데
SIDE_X = CX - W / 4 - 9.0  # 큰 세로 낱말표 자리(앞에서 왼쪽으로 약 106°) — 오른쪽이면 2번 컷에 뒷면 표시가 같이 읽혔다(Fable v1 P2)
SMALL_X = CX + W / 4  # 작은 세로 글자 자리(오른쪽)

색 = {
    "남색": "#16214a",
    "남색_진": "#0d1533",
    "루비": "#b3122f",
    "루비_진": "#7c0a20",
    "연분홍": "#f6c3d1",
    "흰": "#ffffff",
}
# 금속 그림에서 각 색이 받는 회색(0 = 금속 아님, 255 = 알루미늄 그대로)
금속값 = {
    "남색": "#8c8c8c",
    "남색_진": "#8c8c8c",
    "루비": "#737373",
    "루비_진": "#737373",
    "연분홍": "#000000",
    "흰": "#000000",
}


class 글꼴:
    def __init__(self, path, variations=None):
        self.tt = TTFont(path)
        if variations:
            from fontTools.varLib import instancer

            self.tt = instancer.instantiateVariableFont(self.tt, variations)
        blob = hb.Blob.from_file_path(path)
        self.face = hb.Face(blob)
        self.font = hb.Font(self.face)
        if variations:
            self.font.set_variations(variations)
        self.upem = self.tt["head"].unitsPerEm
        self.gs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()

    def 모양(self, text, features=None):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.font, buf, features or {"kern": True, "liga": True})
        return buf.glyph_infos, buf.glyph_positions

    def 경로(self, text, size, x, y, anchor="middle", tracking=0.0, skip=None):
        """size = 1em의 mm. (x, y)는 기준선 위 점. tracking은 em 비율. 돌려주는 값: (d, 너비, 글자별 자리)."""
        infos, poss = self.모양(text)
        s = size / self.upem
        pen_x = 0.0
        items = []
        for i, (inf, pos) in enumerate(zip(infos, poss)):
            items.append((inf.codepoint, pen_x + pos.x_offset, pos.y_offset, i))
            pen_x += pos.x_advance + tracking * self.upem
        width = (pen_x - tracking * self.upem) * s
        if anchor == "middle":
            x0 = x - width / 2
        elif anchor == "end":
            x0 = x - width
        else:
            x0 = x
        ds = []
        places = []
        for gid, ox, oy, i in items:
            name = self.order[gid]
            gx = x0 + ox * s
            places.append((i, gx, name))
            if skip and i in skip:
                continue
            sp = SVGPathPen(self.gs)
            # 글꼴 좌표(y 위로) → SVG(y 아래로)
            tp = TransformPen(sp, (s, 0, 0, -s, gx, y - oy * s))
            self.gs[name].draw(tp)
            ds.append(sp.getCommands())
        return " ".join(ds), width, places

    def 글자상자(self, name, size):
        from fontTools.pens.boundsPen import BoundsPen

        bp = BoundsPen(self.gs)
        self.gs[name].draw(bp)
        s = size / self.upem
        x0, y0, x1, y1 = bp.bounds
        return x0 * s, y0 * s, x1 * s, y1 * s


def 감싸기(fn, x, *args, **kw):
    """둘레 이음매를 넘는 요소는 x와 x±W에 같이 그린다."""
    return "".join(fn(x + dx, *args, **kw) for dx in (-W, 0, W))


def 원(cx, cy, r, fill, extra=""):
    return f'<circle cx="{cx:.3f}" cy="{cy:.3f}" r="{r:.3f}" fill="{fill}" {extra}/>'


def 열매무늬(cx, cy, k, 바탕, 그림):
    """오미자 송이: 휘어 내려오는 줄기에 열매 다섯, 위에 잎 하나. k = 크기 배율(지름 34 mm 엠블럼 기준 1)."""
    p = lambda x, y: (cx + x * k, cy + y * k)
    out = []
    # 줄기
    a, b, c, d = p(1.2, -10.6), p(4.2, -5.0), p(-2.6, 2.0), p(-0.4, 8.4)
    out.append(
        f'<path d="M{a[0]:.3f},{a[1]:.3f} C{b[0]:.3f},{b[1]:.3f} {c[0]:.3f},{c[1]:.3f} {d[0]:.3f},{d[1]:.3f}" '
        f'stroke="{그림}" stroke-width="{0.95 * k:.3f}" fill="none" stroke-linecap="round"/>'
    )
    # 잎: 줄기 끝에서 오른쪽 위로, 통통한 아몬드꼴
    l0, l1, l2, l3 = p(1.2, -10.6), p(3.6, -16.6), p(11.2, -16.2), p(12.4, -12.4)
    l4, l5 = p(9.4, -7.9), p(3.4, -8.4)
    out.append(
        f'<path d="M{l0[0]:.3f},{l0[1]:.3f} C{l1[0]:.3f},{l1[1]:.3f} {l2[0]:.3f},{l2[1]:.3f} {l3[0]:.3f},{l3[1]:.3f} '
        f'C{l4[0]:.3f},{l4[1]:.3f} {l5[0]:.3f},{l5[1]:.3f} {l0[0]:.3f},{l0[1]:.3f} Z" fill="{그림}"/>'
    )
    m0, m1, m2 = p(2.6, -11.0), p(6.6, -12.9), p(10.6, -12.6)
    out.append(
        f'<path d="M{m0[0]:.3f},{m0[1]:.3f} Q{m1[0]:.3f},{m1[1]:.3f} {m2[0]:.3f},{m2[1]:.3f}" stroke="{바탕}" '
        f'stroke-width="{0.5 * k:.3f}" fill="none" stroke-linecap="round"/>'
    )
    # 열매 다섯 — 아래로 갈수록 작게, 왼오른 번갈아. 윤기는 왼쪽 위 작은 점 하나
    for x, y, r in [(-3.3, -5.4, 3.35), (3.5, -2.3, 3.2), (-3.0, 1.9, 3.0), (2.8, 5.3, 2.7), (-0.9, 9.1, 2.35)]:
        bx, by = p(x, y)
        out.append(원(bx, by, r * k, 그림))
        hx, hy = p(x - r * 0.40, y - r * 0.40)
        out.append(원(hx, hy, r * 0.22 * k, 바탕))
    return "".join(out)


def 엠블럼(cx, cy, r, c):
    return (
        원(cx, cy, r, c["루비"])
        + f'<circle cx="{cx:.3f}" cy="{cy:.3f}" r="{r - 1.45:.3f}" fill="none" stroke="{c["흰"]}" stroke-width="0.85"/>'
        + 열매무늬(cx, cy + 0.6, r / 17.0, c["루비"], c["흰"])
    )


def 만들기(이름, 라틴, 한줄, 모드):
    c = 색 if 모드 == "색" else 금속값
    random.seed(25)
    fr = 글꼴(FRAUNCES, {"opsz": 144, "wght": 900, "SOFT": 100, "WONK": 0})
    suit_h = 글꼴(SUIT["Heavy"])
    suit_e = 글꼴(SUIT["ExtraBold"])
    suit_s = 글꼴(SUIT["SemiBold"])

    parts = [f'<rect x="0" y="0" width="{W:.3f}" height="{H}" fill="{c["남색"]}"/>']
    # 목 쪽 가는 테 두 줄
    parts.append(f'<rect x="0" y="5.2" width="{W:.3f}" height="0.7" fill="{c["루비"]}"/>')

    # 아래 루비 띠 = 캔 속 음료. 위 가장자리는 곧게
    band_top = 92.5
    parts.append(f'<rect x="0" y="{band_top}" width="{W:.3f}" height="{H - band_top:.3f}" fill="{c["루비"]}"/>')
    parts.append(f'<rect x="0" y="{band_top + 18.6}" width="{W:.3f}" height="{H - band_top - 18.6:.3f}" fill="{c["루비_진"]}"/>')

    # 기포 줄기: 띠 속에서 올라와 위로 갈수록 작고 성겨진다. 글자 자리는 비운다
    비울곳 = [
        (CX - 30, CX + 30, 76.0, 82.6),  # 한글 이름 줄
        (CX - 40, CX + 40, 98.6, 105.6),  # 띠 안 글자
    ]
    비울곳.append((SMALL_X - 4.5, SMALL_X + 4.5, 12.0, 82.0))  # 오른 옆면 작은 세로 글자
    비울곳.append((SIDE_X - 13.0, SIDE_X + 8.5, 8.0, 93.0))  # 오른 옆면 큰 세로 낱말표(위 끝이 왼쪽)
    for bx in (0.0, W):  # 뒷면 표시 상자
        비울곳.append((bx - 22, bx + 22, 18.0, 80.0))

    def 빈자리(x, y, r):
        xs = [x, x - W, x + W]
        return any(x0 - r < xx < x1 + r and y0 - r < y < y1 + r for xx in xs for (x0, x1, y0, y1) in 비울곳)

    n_stream = 18
    for k in range(n_stream):
        x = (k + 0.5) * W / n_stream + random.uniform(-3.0, 3.0)
        front = abs(((x - CX + W / 2) % W) - W / 2) < 46
        y_top = 84.6 if front else random.uniform(58, 74)
        y = band_top + random.uniform(6, 15)
        r = random.uniform(1.05, 1.45)
        phase = random.uniform(0, 6.28)
        while y > y_top:
            xx = x + 0.7 * math.sin(phase + y * 0.45)
            if not 빈자리(xx, y, r):
                inside = y > band_top + r
                fill, op = (c["연분홍"], 0.6) if inside else (c["흰"], 0.92)
                parts.append(
                    감싸기(
                        lambda a, b, rr: f'<circle cx="{a:.3f}" cy="{b:.3f}" r="{rr:.3f}" fill="none" '
                        f'stroke="{fill}" stroke-width="{max(0.2, rr * 0.3):.3f}" opacity="{op}"/>',
                        xx,
                        y,
                        r,
                    )
                )
            y -= 1.9 + r * 1.6 + random.uniform(0, 0.8)
            r = max(0.32, r * random.uniform(0.86, 0.95))

    # 엠블럼
    em_cy, em_r = 37.5, 21.5  # 원본 캔처럼 엠블럼이 앞면을 이끈다(지름 43 mm)
    parts.append(엠블럼(CX, em_cy, em_r, c))

    # 낱말표 — 라틴 소문자, i의 점은 루비 열매. 앞면은 가로, 오른 옆면은 아래에서 위로 읽는 큰 세로판
    def 낱말표(size, x, base):
        d, wd, places = fr.경로(라틴, size, x, base, tracking=-0.018)
        dot = None
        i_idx = 라틴.find("i")
        if 0 <= i_idx < len(places) and "dotlessi" in fr.gs:
            _, gx, _ = places[i_idx]
            d0, _, _ = fr.경로(라틴, size, x, base, tracking=-0.018, skip={i_idx})
            sp = SVGPathPen(fr.gs)
            s = size / fr.upem
            fr.gs["dotlessi"].draw(TransformPen(sp, (s, 0, 0, -s, gx, base)))
            d = d0 + " " + sp.getCommands()
            bx0, _, bx1, by1 = fr.글자상자("i", size)
            _, _, _, dy1 = fr.글자상자("dotlessi", size)
            dot = (gx + (bx0 + bx1) / 2 + 0.35 * size / 24.5, base - (dy1 + (by1 - dy1) * 0.62), (by1 - dy1) * 0.43)
        out = f'<path d="{d}" fill="{c["흰"]}"/>'
        if dot:
            tx, ty, tr = dot
            out += 원(tx, ty, tr, c["루비"])
            out += f'<circle cx="{tx:.3f}" cy="{ty:.3f}" r="{tr:.3f}" fill="none" stroke="{c["흰"]}" stroke-width="{0.5 * size / 24.5:.3f}"/>'
        return out, wd

    front, _ = 낱말표(14.0, CX, 74.0)
    parts.append(front)
    side_size = 26.0
    xh = fr.tt["OS/2"].sxHeight / fr.upem * side_size
    side_x = SIDE_X
    side, side_len = 낱말표(side_size, 0.0, 0.0)
    parts.append(f'<g transform="translate({side_x + xh / 2:.3f},50.5) rotate(-90)">{side}</g>')

    # 한글 이름 + 한 줄(앞면, 낱말표 아래)
    d, _, _ = suit_e.경로(f"{이름}  오미자 스파클링", 3.6, CX, 80.8, tracking=0.04)
    parts.append(f'<path d="{d}" fill="{c["연분홍"]}"/>')

    # 띠 안 글자
    d, _, _ = suit_s.경로("SPARKLING OMIJA   ·   355ml", 3.3, CX, 103.6, tracking=0.12)
    parts.append(f'<path d="{d}" fill="{c["흰"]}"/>')

    # 오른 옆면: 작은 세로 글자
    d, wd, _ = suit_s.경로("SPARKLING OMIJA", 4.0, 0, 0, anchor="middle", tracking=0.10)
    parts.append(f'<g transform="translate({SMALL_X:.3f},46) rotate(-90)"><path d="{d}" fill="{c["연분홍"]}"/></g>')

    # 뒷면 표시 상자(이음매 자리에 걸쳐 감싸 그림)
    def 뒷면(bx):
        out = []
        d, _, _ = suit_h.경로(이름, 9.0, bx, 30.0)
        out.append(f'<path d="{d}" fill="{c["흰"]}"/>')
        d, _, _ = suit_e.경로("오미자 스파클링", 3.6, bx, 36.4, tracking=0.05)
        out.append(f'<path d="{d}" fill="{c["연분홍"]}"/>')
        lines = ["다섯 가지 맛, 톡.", "식품유형  탄산음료 · 내용량  355 ml", "냉장 보관 후 차갑게 드세요"]
        for k, ln in enumerate(lines):
            d, _, _ = suit_s.경로(ln, 2.5, bx, 46.0 + k * 4.0, tracking=0.03)
            out.append(f'<path d="{d}" fill="{c["흰"]}"/>')
        out.append(
            f'<rect x="{bx - 15:.3f}" y="40.6" width="30" height="0.3" fill="{c["연분홍"]}" opacity="0.8"/>'
        )
        out.append(엠블럼(bx, 70.0, 7.5, c))
        return "".join(out)

    parts.append(뒷면(0.0) + 뒷면(W))

    if 한줄:
        pass  # 끝 1초 문구는 후반 글자(화면 위)라 라벨에 넣지 않는다

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.3f}mm" height="{H}mm" viewBox="0 0 {W:.3f} {H}">'
        f'<title>{이름} 캔 라벨 ({모드})</title>' + "".join(parts) + "</svg>"
    )
    return svg


def 래스터(svg_path, png_path, px_w):
    """sharp(rsvg)로 굽는다. 윈도에서 한글 경로가 명령줄 인자로 깨져, 경로는 표준 입력(UTF-8 JSON)으로 넘긴다."""
    import json

    # SVG의 width/height(mm)를 화소로 바꿔 쓴 사본을 굽는다 — sharp는 mm를 96dpi로 읽고 density를 72 기준으로 곱해 크기가 엇나간다
    with open(svg_path, encoding="utf-8") as fh:
        src = fh.read()
    px_h = round(px_w * H / W)
    src = src.replace(f'width="{W:.3f}mm" height="{H}mm"', f'width="{px_w}" height="{px_h}"', 1)
    tmp = png_path + ".tmp.svg"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(src)
    job = {"sharp": SHARP, "svg": tmp, "png": png_path, "density": 72}
    js = (
        "let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>b+=c);"
        "process.stdin.on('end',()=>{const j=JSON.parse(b);const s=require(j.sharp);"
        "s(j.svg,{density:j.density,limitInputPixels:false}).png({compressionLevel:6}).toFile(j.png)"
        ".then(i=>console.log(i.width+'x'+i.height+' '+j.png)).catch(e=>{console.error(e);process.exit(1)})})"
    )
    subprocess.run(["node", "-e", js], input=json.dumps(job).encode("utf-8"), check=True)
    os.remove(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--이름", default="오미톡")
    ap.add_argument("--라틴", default="omitok")
    ap.add_argument("--폭", type=int, default=8192)
    a = ap.parse_args()
    os.makedirs(밖, exist_ok=True)
    for 모드 in ("색", "금속"):
        svg = 만들기(a.이름, a.라틴, None, 모드)
        if 모드 == "색":
            p = os.path.join(여기, f"라벨_{a.이름}.svg")
        else:
            p = os.path.join(밖, f"라벨_{a.이름}_금속.svg")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(svg)
        래스터(p, os.path.join(밖, f"라벨_{a.이름}_{모드}.png"), a.폭)
    래스터(os.path.join(여기, f"라벨_{a.이름}.svg"), os.path.join(밖, f"라벨_{a.이름}_미리.png"), 2400)


if __name__ == "__main__":
    main()
