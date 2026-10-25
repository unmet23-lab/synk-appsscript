"""1번 6번 컷 끝 1초에 얹는 글자 — 낱말표(라벨과 같은 윤곽, i의 점은 루비 열매) + 한 줄 (2026-10-25).

화면 위에 얹는 글자라 후반에서 넣는다(AI로 그리지 않음). 이 스크립트는 투명 PNG(1080×1920 자리 그대로)를 만든다.
  python 끝글자.py [--이름 오미톡 --라틴 omitok --줄 "다섯 가지 맛, 톡."] [--가로]
"""
import argparse
import importlib.util
import os
import subprocess

여기 = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("label", os.path.join(여기, "라벨.py"))
L = importlib.util.module_from_spec(spec)
spec.loader.exec_module(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--이름", default="오미톡")
    ap.add_argument("--라틴", default="omitok")
    ap.add_argument("--줄", default="다섯 가지 맛, 톡.")
    ap.add_argument("--가로", action="store_true")
    a = ap.parse_args()
    W, H = (1920, 1080) if a.가로 else (1080, 1920)
    fr = L.글꼴(L.FRAUNCES, {"opsz": 144, "wght": 900, "SOFT": 100, "WONK": 0})
    suit = L.글꼴(L.SUIT["ExtraBold"])
    # 6번 컷은 원본 구도 그대로라 캔 낱말표가 아래 오른쪽으로 비스듬히 지나가 아래 1/3이 비지 않고, 세로 판은 아래 1/5을
    # 앱 글 · 단추가 덮는다 — 글자는 엠블럼 윗선(화면 위 약 10%) 위 가운데에 작게 두 줄로(Fable v1: 왼쪽 아래는 캔 낱말표와
    # 나란히 겹쳤다 · v2: 위 15%는 엠블럼 · 잎 위에 얹혔다)
    size = 100 if not a.가로 else 96
    cx = W / 2
    base = H * 0.06 if not a.가로 else H * 0.11
    d, wd, places = fr.경로(a.라틴, size, cx, base, anchor="middle", tracking=-0.018)
    parts = []
    i_idx = a.라틴.find("i")
    dot = ""
    if 0 <= i_idx < len(places) and "dotlessi" in fr.gs:
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen

        _, gx, _ = places[i_idx]
        d0, _, _ = fr.경로(a.라틴, size, cx, base, anchor="middle", tracking=-0.018, skip={i_idx})
        sp = SVGPathPen(fr.gs)
        s = size / fr.upem
        fr.gs["dotlessi"].draw(TransformPen(sp, (s, 0, 0, -s, gx, base)))
        d = d0 + " " + sp.getCommands()
        bx0, _, bx1, by1 = fr.글자상자("i", size)
        _, _, _, dy1 = fr.글자상자("dotlessi", size)
        tx, ty, tr = gx + (bx0 + bx1) / 2 + 0.35 * size / 24.5, base - (dy1 + (by1 - dy1) * 0.62), (by1 - dy1) * 0.43
        dot = f'<circle cx="{tx:.2f}" cy="{ty:.2f}" r="{tr:.2f}" fill="{L.색["루비"]}"/>' \
              f'<circle cx="{tx:.2f}" cy="{ty:.2f}" r="{tr:.2f}" fill="none" stroke="#fff" stroke-width="{size * 0.02:.2f}"/>'
    parts.append(f'<path d="{d}" fill="#ffffff"/>' + dot)
    d2, _, _ = suit.경로(a.줄, size * 0.30, cx, base + size * 0.50, anchor="middle", tracking=0.02)
    parts.append(f'<path d="{d2}" fill="#ffffff"/>')
    # 읽히게 위로 옅은 남색 그늘(화면 위 글자 뒤 아주 옅은 어둠)
    shade = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1433" stop-opacity="0.35"/>'
             f'<stop offset="1" stop-color="#0B1433" stop-opacity="0"/></linearGradient></defs>'
             f'<rect x="0" y="0" width="{W}" height="{H * 0.14:.0f}" fill="url(#g)"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{shade}{"".join(parts)}</svg>'
    tag = "가로" if a.가로 else "세로"
    p_svg = os.path.join(L.밖, f"끝글자_{a.이름}_{tag}.svg")
    with open(p_svg, "w", encoding="utf-8") as fh:
        fh.write(svg)
    import json

    job = {"sharp": L.SHARP, "svg": p_svg, "png": p_svg.replace(".svg", ".png"), "density": 72}
    js = ("let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>b+=c);"
          "process.stdin.on('end',()=>{const j=JSON.parse(b);const s=require(j.sharp);"
          "s(j.svg,{density:j.density}).png().toFile(j.png).then(i=>console.log(i.width+'x'+i.height+' '+j.png))"
          ".catch(e=>{console.error(e);process.exit(1)})})")
    subprocess.run(["node", "-e", js], input=json.dumps(job).encode("utf-8"), check=True)


if __name__ == "__main__":
    main()
