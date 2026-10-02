"""해외 LAB 배너 원고(배너_LAB해외.html)를 계정별_문구_LAB해외.json에서 짓는다.

    python LAB해외_짓기.py
    node ../../../../tools/SNS키트굽기.js 배너_LAB해외.html --sheet --out out_LAB해외

판은 몽골 LAB 유튜브(배너.html 3번)와 같다: 크림 펠트 바탕, 나라 표시, 그 나라 말 두 줄 제목(강조 밑줄 하나),
한국어 한 줄 「하고 싶은 말, 한국어로」, 몽글(가운데 안전 영역)·마린·까몽(TV·넓은 화면에서만 보이는 바깥).
한글·라틴·키릴이 아닌 문자는 Windows에 깔린 글꼴을 local()로 불러 쓴다(굽는 PC 기준).
"""
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "계정별_문구_LAB해외.json")
OUT = os.path.join(HERE, "배너_LAB해외.html")
A = "../../../디자인"

# 언어별 제목 글꼴·크기·줄 간격. 라틴·키릴은 키트의 Inter Tight(.k-latin)
FONT = {
    "ja": ("'LAB JP'", 84, 1.2),
    "zh-Hant": ("'LAB TC'", 84, 1.2),
    "my": ("'LAB MY'", 68, 1.6),
    "th": ("'LAB TH'", 80, 1.4),
    "km": ("'LAB TH'", 60, 1.55),
    "hi": ("'LAB IN'", 80, 1.35),
    "ne": ("'LAB IN'", 58, 1.4),
    "si": ("'LAB IN'", 74, 1.45),
}
LATIN = (None, 86, 1.08)

HEAD = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>SYNK LAB 해외 배너 · 클로드판 2026-10-02</title>
<!-- LAB해외_짓기.py가 계정별_문구_LAB해외.json에서 지은 파일이다. 고칠 때는 json·짓기 스크립트를 고친다. -->
<link rel="stylesheet" href="{A}/SNS키트/kit.css">
<style>
  @font-face{{font-family:'LAB JP';font-weight:700 900;src:local('Noto Sans JP Bold'),local('NotoSansJP-Bold'),local('Yu Gothic Bold'),local('YuGothic-Bold')}}
  @font-face{{font-family:'LAB TC';font-weight:700 900;src:local('Microsoft JhengHei UI Bold'),local('Microsoft JhengHei Bold'),local('MicrosoftJhengHeiUIBold'),local('MicrosoftJhengHeiBold')}}
  @font-face{{font-family:'LAB MY';font-weight:700 900;src:local('Myanmar Text Bold'),local('MyanmarText-Bold')}}
  @font-face{{font-family:'LAB TH';font-weight:700 900;src:local('Leelawadee UI Bold'),local('LeelawadeeUI-Bold')}}
  @font-face{{font-family:'LAB IN';font-weight:700 900;src:local('Nirmala UI Bold'),local('NirmalaUI-Bold')}}
  body{{margin:0;background:#d9dbe0;display:flex;flex-direction:column;gap:40px;padding:40px;align-items:flex-start}}
  .k-slide{{font-family:var(--k-sans)}}
  .bg-cream{{background:url("{A}/펠트부품/assets/배경/wide-cream.webp") center/max(2560px,100%) auto no-repeat,#fbf7f0;color:#14110f}}
  .abs{{position:absolute}}
  .label{{margin:0;font:600 var(--ls,30px)/1.1 var(--k-mono);letter-spacing:.08em;color:#ae322a}}
  .title{{margin:0;font-weight:900;letter-spacing:-.03em}}
  .title .ln{{display:block;white-space:nowrap}}
  .title.script{{letter-spacing:0}}
  .sub{{margin:0;font-weight:600;line-height:1.25;letter-spacing:-.02em;opacity:.88}}
  .hl-ink{{background:linear-gradient(transparent 62%,rgba(255,224,122,.95) 62% 92%,transparent 92%)}}
  .obj{{position:absolute;height:auto}}
  .cut{{filter:drop-shadow(5px 0 0 #fff) drop-shadow(-5px 0 0 #fff) drop-shadow(0 5px 0 #fff) drop-shadow(0 -5px 0 #fff) drop-shadow(0 18px 20px rgba(0,0,0,.28))}}
</style>
<script>
  // 제목 한 줄이 칸보다 길면 넘치지 않을 때까지 글자를 줄인다(줄바꿈으로 세 줄이 되지 않게)
  document.fonts.ready.then(() => document.querySelectorAll('.fit').forEach((el) => {{
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const over = () => [...el.querySelectorAll('.ln')].some((l) => l.scrollWidth > el.clientWidth + 1);
    while (over() && fs > 40) {{ fs -= 2; el.style.fontSize = fs + 'px'; }}
  }}));
</script>
</head>
<body>
"""


def title_html(lines, hl):
    out = []
    done = False
    for ln in lines:
        s = html.escape(ln)
        h = html.escape(hl)
        if not done and h in s:
            s = s.replace(h, f'<span class="hl-ink">{h}</span>', 1)
            done = True
        out.append(f'<span class="ln">{s}</span>')
    return "".join(out)


def font_style(locale, scale=1.0):
    fam, size, lh = FONT.get(locale, LATIN)
    cls = "title fit" + (" script" if fam else " k-latin")
    style = f"font-size:{round(size * scale)}px;line-height:{lh}"
    if fam:
        style += f";font-family:{fam},var(--k-sans)"
    return cls, style


def youtube(a, korean):
    b = a["banner"]
    cls, style = font_style(a["locale"])
    return f"""
<!-- {a['id']} · {a['handle']} · 2560×1440 · 가운데 1546×423(x507~2053, y508~931)이 모든 기기에서 보인다 -->
<section class="k-slide bg-cream k-corners" lang="{a['locale']}" data-fmt="yt-banner" data-name="{a['id']}" data-acc="lab"
  style="--w:2560px;--h:1440px;--safe-t:508px;--safe-b:508px;--safe-l:507px;--safe-r:507px;--corner:220px;--corner-inset:60px">
  <div class="abs" style="left:560px;top:528px;width:1120px">
    <p class="label" style="--ls:44px">{html.escape(b['label'])}</p>
    <h1 class="{cls}" style="margin-top:12px;{style}">{title_html(b['title'], b['hl'])}</h1>
    <p class="sub" lang="ko" style="margin-top:16px;font-size:46px">{html.escape(korean)}</p>
  </div>
  <img class="obj cut" src="{A}/SNS키트/assets/mascot-몽글_눈웃음.webp" alt="" style="width:330px;left:1700px;top:560px">
  <img class="obj cut" src="{A}/SNS키트/assets/mascot-까몽_본체.webp" alt="" style="width:250px;right:150px;bottom:130px">
  <img class="obj cut" src="{A}/SNS키트/assets/mascot-마린_본체.webp" alt="" style="width:230px;left:170px;bottom:150px">
</section>
"""


# 페이스북 커버(1640×596) 제목 크기. 몽골 LAB 커버(배너.html 4번)의 64px에 맞춘다
FB_SIZE = {"ne": 62, "km": 58, "si": 60}


def facebook(a, korean):
    b = a["banner"]
    base = FONT.get(a["locale"], LATIN)[1]
    cls, style = font_style(a["locale"], scale=FB_SIZE.get(a["locale"], 64) / base)
    return f"""
<!-- {a['id']} · 페이스북 1640×596 · 휴대폰은 좌우를 잘라 가운데 1061px만 보인다 -->
<section class="k-slide bg-cream k-corners" lang="{a['locale']}" data-fmt="fb-cover" data-name="{a['id']}" data-acc="lab"
  style="--w:1640px;--h:596px;--safe-t:50px;--safe-b:50px;--safe-l:290px;--safe-r:290px;--corner:120px;--corner-inset:26px">
  <div class="abs" style="left:300px;top:140px;width:760px">
    <p class="label" style="--ls:24px">{html.escape(b['label'])}</p>
    <h1 class="{cls}" style="margin-top:16px;{style}">{title_html(b['title'], b['hl'])}</h1>
    <p class="sub" lang="ko" style="margin-top:16px;font-size:30px">{html.escape(korean)}</p>
  </div>
  <img class="obj cut" src="{A}/SNS키트/assets/mascot-몽글_눈웃음.webp" alt="" style="width:250px;left:1080px;top:150px">
  <img class="obj cut" src="{A}/SNS키트/assets/mascot-까몽_본체.webp" alt="" style="width:170px;right:90px;bottom:60px">
</section>
"""


if __name__ == "__main__":
    d = json.load(open(DATA, encoding="utf-8"))
    korean = d["korean"]["slogan"]
    parts = [HEAD]
    n = 0
    for a in d["accounts"]:
        if "banner" not in a:
            continue
        parts.append(youtube(a, korean) if a["platform"] == "YouTube" else facebook(a, korean))
        n += 1
    parts.append("\n</body>\n</html>\n")
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(parts))
    print(OUT, n, "장")
