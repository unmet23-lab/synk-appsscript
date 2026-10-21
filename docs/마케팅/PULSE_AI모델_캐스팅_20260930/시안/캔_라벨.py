# 시안용 가상 제품 「MORU 콜드브루 블랙 250 ml」 캔 라벨(펼친 그림)을 크롬으로 그린다(2026-10-21, 1차 다섯 명 영상 게이트).
#   MORU는 하린 아이스커피 광고(PULSE 포트폴리오)의 가칭 커피 브랜드다. 워드마크는 그 광고 엔드카드 C안(유호님 「c로 가자」)과 같다:
#   Inter Tight 700 · 자간 .025em · 얼음 모양 O(둥근 네모 테두리, 줄기 굵기 .16em, 12° 기울임).
#   펼친 그림 2400×1620 = 캔 둘레 166.5 mm × 인쇄 높이 112.4 mm(약 14.4 px/mm). 가운데(x 1200)가 캔 앞면이다.
#   쓰기: python -X utf8 캔_라벨.py <출력.png>
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[4]
FONTS = ROOT / "docs" / "브랜드_폰트"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
W, H = 2400, 1620
INK = "#2B1E17"   # 에스프레소 갈색(캔 바탕)
CREAM = "#F3EADB"  # 글자·선


def url(p):
    return "file:///" + quote(str(p).replace("\\", "/"), safe="/:")


HTML = f"""<!doctype html><html><head><meta charset='utf-8'><style>
@font-face{{font-family:'Inter Tight';font-weight:700;src:url('{url(FONTS / 'InterTight' / 'InterTight-Bold.ttf')}');}}
@font-face{{font-family:'DM Mono';font-weight:500;src:url('{url(FONTS / 'DM_Mono' / 'DMMono-Medium.ttf')}');}}
@font-face{{font-family:'SUIT';font-weight:500;src:url('{url(FONTS / 'SUIT' / 'SUIT-Medium.otf')}');}}
@font-face{{font-family:'SUIT';font-weight:600;src:url('{url(FONTS / 'SUIT' / 'SUIT-SemiBold.otf')}');}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:{INK};color:{CREAM};font-kerning:normal}}
.rule{{position:absolute;left:0;width:{W}px;height:3px;background:{CREAM};opacity:.85}}
.c{{position:absolute;left:0;width:{W}px;text-align:center}}
.eyebrow{{font-family:'DM Mono';font-weight:500;font-size:29px;letter-spacing:.3em;padding-left:.3em}}
.mark{{font-family:'Inter Tight';font-weight:700;font-size:166px;letter-spacing:.025em;line-height:1;white-space:nowrap}}
.o{{display:inline-block;width:.78em;height:.727em;border:.16em solid {CREAM};border-radius:.2em;margin:0 .04em;transform:rotate(12deg)}}
.name{{font-family:'SUIT';font-weight:600;font-size:70px;letter-spacing:-.01em}}
.slogan{{font-family:'SUIT';font-weight:500;font-size:44px;letter-spacing:-.02em;opacity:.92}}
.vol{{font-family:'DM Mono';font-weight:500;font-size:34px;letter-spacing:.22em;padding-left:.22em;opacity:.9}}
.side{{position:absolute;width:470px;font-family:'SUIT';font-weight:500;font-size:28px;line-height:1.55;letter-spacing:-.01em;opacity:.88}}
.side b{{font-weight:600}}
.small{{font-family:'Inter Tight';font-weight:700;font-size:58px;letter-spacing:.06em;white-space:nowrap}}
.small .o{{border-width:.17em}}
</style></head><body>
<div class="rule" style="top:118px"></div><div class="rule" style="top:{H - 121}px"></div>
<div class="c eyebrow" style="top:395px">COLD BREW COFFEE</div>
<div class="c mark" style="top:478px">M<span class="o"></span>RU</div>
<div class="c name" style="top:730px">콜드브루 블랙</div>
<div class="c vol" style="top:845px">BLACK · 250 ml</div>
<div class="c slogan" style="top:1290px">쨍한 한낮, 한 잔.</div>
<div class="side" style="left:{1960 - 235}px;top:640px">
<b>원재료명</b> 커피추출액(원두 100%), 정제수<br><b>내용량</b> 250 ml<br>무가당 · 차갑게 마시면 더 좋아요.<br>개봉 후에는 바로 드세요.</div>
<div class="small" style="position:absolute;left:{440}px;top:760px;transform:translateX(-50%)">M<span class="o"></span>RU</div>
</body></html>"""


def main():
    out = Path(sys.argv[1]).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        page = Path(td) / "label.html"
        page.write_text(HTML, encoding="utf-8")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        f"--window-size={W},{H}", f"--screenshot={out}", "--virtual-time-budget=3000",
                        f"--user-data-dir={Path(td) / 'prof'}", url(page)], check=True, capture_output=True, timeout=120)
    print(out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
