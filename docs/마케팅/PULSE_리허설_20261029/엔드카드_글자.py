"""리허설(10-29) 화면 위 글자 층 — 엔드카드 셋 · 말 자막 둘을 1080×1920 투명 PNG로(AI로 그리지 않음).

1 · 3번 편의 라벨.py 글꼴(Fraunces 낱말표 · SUIT)을 그대로 쓴다 — 손님 라벨의 낱말표 · 한글 서체와 같은 윤곽.
자리는 앱 글이 덮지 않는 칸(위 14%~65% · 좌우 65~920) 안. v2(Fable 완성본 P1-3): 콘티대로 캔을 화면 29~56%(557~1075px)에 두고,
로고 · 한글 이름 · 문구는 캔 위(290~530), 출시 · AI 고지는 캔 아래(1192 · 1238)에 둔다 — v1은 다섯 줄이 캔 위에 몰려 고지가 뚜껑에 걸렸다.
  python -X utf8 엔드카드_글자.py   → 작업 폴더 글자/*.png
"""
import importlib.util
import json
import os
import subprocess

여기 = os.path.dirname(os.path.abspath(__file__))
라벨 = os.path.join(여기, "..", "PULSE_포트폴리오_제작준비_20261012", "video", "product-hero-20261024", "라벨", "라벨.py")
spec = importlib.util.spec_from_file_location("label", 라벨)
L = importlib.util.module_from_spec(spec)
spec.loader.exec_module(L)
OUT = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-rehearsal-20261029", "글자")
W, H = 1080, 1920
CX = 492  # 앱 글 칸(65~920) 가운데 — 오른쪽 160px는 단추 자리라 비운다


def wordmark(size, base):
    fr = L.글꼴(L.FRAUNCES, {"opsz": 144, "wght": 900, "SOFT": 100, "WONK": 0})
    word = "omitok"
    i_idx = word.find("i")
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    _, _, places = fr.경로(word, size, CX, base, anchor="middle", tracking=-0.018)
    d0, _, _ = fr.경로(word, size, CX, base, anchor="middle", tracking=-0.018, skip={i_idx})
    sp = SVGPathPen(fr.gs)
    s = size / fr.upem
    _, gx, _ = places[i_idx]
    fr.gs["dotlessi"].draw(TransformPen(sp, (s, 0, 0, -s, gx, base)))
    bx0, _, bx1, by1 = fr.글자상자("i", size)
    _, _, _, dy1 = fr.글자상자("dotlessi", size)
    tx, ty, tr = gx + (bx0 + bx1) / 2 + 0.35 * size / 24.5, base - (dy1 + (by1 - dy1) * 0.62), (by1 - dy1) * 0.43
    return (f'<path d="{d0} {sp.getCommands()}" fill="#ffffff"/>'
            f'<circle cx="{tx:.2f}" cy="{ty:.2f}" r="{tr:.2f}" fill="{L.색["루비"]}"/>'
            f'<circle cx="{tx:.2f}" cy="{ty:.2f}" r="{tr:.2f}" fill="none" stroke="#fff" stroke-width="{size * 0.02:.2f}"/>')


def line(text, weight, size, base, fill="#ffffff", opacity=1.0, tracking=0.02):
    f = L.글꼴(L.SUIT[weight])
    d, w, _ = f.경로(text, size, CX, base, anchor="middle", tracking=tracking)
    return f'<path d="{d}" fill="{fill}" fill-opacity="{opacity}"/>', w


SHADOW = ('<defs><filter id="sh" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="6"/>'
          '<feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer><feMerge><feMergeNode/>'
          '<feMergeNode in="SourceGraphic"/></feMerge></filter></defs>')


def save(name, body, shadow=True):
    os.makedirs(OUT, exist_ok=True)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{SHADOW if shadow else ""}'
           f'<g{" filter=\"url(#sh)\"" if shadow else ""}>{body}</g></svg>')
    p = os.path.join(OUT, name + ".svg")
    open(p, "w", encoding="utf-8").write(svg)
    job = {"sharp": L.SHARP, "svg": p, "png": p.replace(".svg", ".png"), "density": 72}
    js = ("let b='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>b+=c);"
          "process.stdin.on('end',()=>{const j=JSON.parse(b);const s=require(j.sharp);"
          "s(j.svg,{density:j.density}).png().toFile(j.png).then(i=>console.log(i.width+'x'+i.height+' '+j.png))"
          ".catch(e=>{console.error(e);process.exit(1)})})")
    subprocess.run(["node", "-e", js], input=json.dumps(job).encode("utf-8"), check=True)


def caption(name, text):
    """말 자막 — 위에서 1150~1230px 띠 가운데, 흰 글에 옅은 남색 판(흰 티 위에서도 읽히게)."""
    body, w = line(text, "ExtraBold", 50, 1208)
    pad_x, top, bot = 34, 1150, 1232
    plate = (f'<rect x="{CX - w / 2 - pad_x:.1f}" y="{top}" width="{w + 2 * pad_x:.1f}" height="{bot - top}" rx="{(bot - top) / 2}" '
             f'fill="#0B1433" fill-opacity="0.55"/>')
    save(name, plate + body, shadow=False)


if __name__ == "__main__":
    s1, _ = line("다섯 가지 맛, 톡.", "ExtraBold", 66, 522)
    save("끝_말", s1)
    k, _ = line("오미톡 오미자 스파클링", "SemiBold", 34, 444, tracking=0.04)
    save("끝_로고", wordmark(132, 392) + k)
    r1, _ = line("11월 편의점 출시", "SemiBold", 34, 1192)
    r2, _ = line("영상 속 인물 · 장면 · 목소리는 AI로 만들었습니다.", "SemiBold", 24, 1238, opacity=0.86, tracking=0.0)
    save("끝_출시", r1 + r2)
    caption("자막_1", "아… 목 타 죽겠다.")
    caption("자막_2", "맛이… 자꾸 바뀌네?")
