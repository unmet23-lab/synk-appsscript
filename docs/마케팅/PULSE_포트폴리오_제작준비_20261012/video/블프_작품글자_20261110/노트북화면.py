# 블프 스나이퍼 19번 노트북 화면 「블프 OPEN」 다시(2026-11-10, Claude) — 슬롭 점검표 55 · 46번.
# 11-07 판은 주황 띠 + 굵은 SUIT 「블프 OPEN · 75인치 TV 반값」을 화면 자리에 또렷하게 얹어, 옆으로 흐르는 장면 위에 혼자 선명하고
# 화면 밖으로 삐져나왔다. 이 화면은 느지막 웹페이지라 전단(전단.py)과 같은 브랜드 결로 만든다 — 크림 바탕 · 감은 눈 + 느지막 · 고운바탕 「블프」 +
# Fraunces 「OPEN」 · TV 사진. 화면에서는 S4.tsx가 화면 안쪽에 맞춰 옆 흐림 · 화면 빛을 준다.
#   python -X utf8 노트북화면.py   → git 밖 자막시안_public/s4/laptop_open.png(1600×1000 · B 감은 눈 묶음) · laptop_open_A.png(A 명조 묶음)
# 11-11: 끝 로고가 판마다 달라(A 명조 묶음 · B 감은 눈 + 가는 글자) 웹페이지 머리 표지도 그 판을 따른다 — 한 편 안에서 브랜드가 둘이 되지 않게.
import os
import subprocess

from PIL import Image

import 전단

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/자막시안_public/s4/laptop_open.png"


def page(tv, mark="eye"):
    amber = "#C9732E"
    logo = (전단.svg('neujimak_serif_word', 150, '#1d1a17') if mark == "serif"
            else f"{전단.svg('neujimak_eye', 52, amber)}{전단.svg('neujimak2', 180, '#1d1a17')}")
    return f"""<!doctype html><html><head><meta charset="utf-8">{전단.FONTS}<style>
body{{margin:0;width:1600px;height:1000px;overflow:hidden;background:#F7F2EA;color:#1d1a17;font-family:'IBM Plex Sans KR',sans-serif}}
.top{{position:absolute;left:70px;right:70px;top:46px;display:flex;align-items:center;justify-content:space-between}}
.mark{{display:flex;align-items:center;gap:16px}}
.nav{{font-size:24px;color:#6d6359;letter-spacing:.06em;display:flex;gap:34px}}
.hero{{position:absolute;left:70px;top:190px;width:640px}}
.k{{font-family:'Fraunces',serif;font-size:30px;letter-spacing:.3em;color:#6d6359}}
.h{{font-family:'Gowun Batang',serif;font-weight:700;font-size:170px;line-height:1.02;margin-top:18px;letter-spacing:-.02em}}
.h span{{font-family:'Fraunces',serif;font-weight:600;font-variation-settings:'opsz' 144}}
.s{{font-size:38px;font-weight:500;margin-top:26px}}
.btn{{display:inline-block;margin-top:40px;padding:16px 34px;border:3px solid #1d1a17;border-radius:999px;font-size:30px;font-weight:600}}
.tv{{position:absolute;right:40px;top:200px;width:820px}}
</style></head><body>
<div class="top"><div class="mark">{logo}</div><div class="nav"><span>TV · 영상</span><span>주방</span><span>생활</span></div></div>
<div class="hero"><div class="k">BLACK FRIDAY</div><div class="h">블프<br><span>OPEN</span></div><div class="s">75인치 TV 반값 · 선착순 없음</div><div class="btn">천천히 보기</div></div>
<img class="tv" src="{tv}">
</body></html>"""


def main():
    tv = 전단.tv_png()
    for mark, out in (("eye", OUT), ("serif", OUT.replace(".png", "_A.png"))):
        html = out.replace(".png", ".html")
        open(html, "w", encoding="utf-8").write(page(tv, mark))
        subprocess.run([전단.CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--screenshot={out}", "--window-size=1600,1000",
                        "--virtual-time-budget=8000", "--force-device-scale-factor=1", "file:///" + html.replace("\\", "/")], check=True, capture_output=True, timeout=120)
        os.remove(html)
        print(out, Image.open(out).size)


if __name__ == "__main__":
    main()
