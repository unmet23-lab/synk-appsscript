# -*- coding: utf-8 -*-
"""조합판에 산 글자를 붓는다 — 3차판. 2차(조합덧씌움2.py)와 다른 점은 **좌표의 출처** 하나다.
2차는 본문 자리를 손좌표(150/596/692…)로 박아, 카드를 줄이면 글이 카드 위쪽에 쏠리거나 넘쳤다.
3차는 굽기가 함께 낸 `<출력>.png.칸.json`(카드의 화면 픽셀 상자)을 읽어 **카드 안에 앉힌다** —
판마다 다시 재지 않는다. 대비 실측은 2차 그대로(후광 고리 최악값)."""
import io, json, os, sys

import PIL.ImageChops as C
from PIL import Image, ImageDraw, ImageFilter, ImageFont

여기 = os.path.dirname(os.path.abspath(__file__))
굵 = r"C:\Windows\Fonts\malgunbd.ttf"
보통 = r"C:\Windows\Fonts\malgun.ttf"
키릴 = r"C:\Windows\Fonts\segoeui.ttf"   # 맑은고딕엔 몽골 키릴 ө·ү 글리프가 없다(두부 실측)
잉크 = (0xFB, 0xF7, 0xF0)      # Paper
보조 = (0xED, 0xE7, 0xDC)      # Oat
보조2 = (0xC7, 0xBF, 0xB2)     # Stone

이름 = sys.argv[1]
바탕길 = os.path.join(여기, "렌더", 이름 + ".png")
칸길 = 바탕길 + ".칸.json"

im = Image.open(바탕길).convert("RGB")
W, H = im.size
d = ImageDraw.Draw(im)

# ── 본문 자리 — 카드 칸에서 뽑는다 ──────────────────────────────────────────────
#   왼 들여쓰기 98 · 줄새 96 · 키릴 내림 210 · 블록 높이 256 은 2차 채택판의 «비례»를 그대로 옮긴 값이다
#   (2차 실측: 카드 좌 52 → 글 150 · 카드 위 479 → 글 596 · 블록 596~852).
#   ⚠광학 보정 −12: PIL 의 text top 은 폰트 상자 위끝이라 글자는 그보다 아래에서 시작한다.
#     기하 중앙에 그대로 앉히면 «아래로 처져» 보인다.
칸들 = json.load(io.open(칸길, encoding="utf-8"))
칸 = 칸들["카드"]
좌 = int(round(칸["좌"] + 98))
줄1 = int(round((칸["위"] + 칸["아래"]) / 2 - 128 - 12))
줄2, 몽골 = 줄1 + 96, 줄1 + 210


def 글(x, y, 본문, 크기, 색, bold=True, 서체=None):
    f = ImageFont.truetype(서체 or (굵 if bold else 보통), 크기)
    d.text((x, y), 본문, font=f, fill=색)
    return (x, y, 본문, 크기, bold, 서체)


기록 = []
# ── 카드 위: 문제 (keep-all 은 짧은 줄로 손수 보장 · 위계는 밀도) ──
기록.append(("문제줄1", 글(좌, 줄1, "저는 아침마다", 62, 잉크, True)))
기록.append(("문제줄2", 글(좌, 줄2, "커피를 ___.", 62, 잉크, True)))
기록.append(("몽골줄", 글(좌, 몽골, "Би өглөө болгон кофе уудаг.", 34, 보조2, False, 서체=키릴)))

# ── 알약 위: 보기 — 알약도 자기 칸을 말한다(3차). 2차 손좌표(1244/1496/1748)는 알약을 옮기자
#    글이 알약 아래로 흘러내렸다. 알약 세로 중앙 − 30(48px 글의 반) − 12(광학 보정)에 앉힌다.
for 번, 본문 in enumerate(("①  마셔요", "②  먹어요", "③  봐요")):
    알 = 칸들["알약%d" % (번 + 1)]
    py = int(round((알["위"] + 알["아래"]) / 2 - 30 - 12))
    기록.append((본문[:1], 글(190, py, 본문, 48, 잉크, False)))
기록.append(("힌트", 글(150, 1930, "힌트 — 「마시다」는 액체에 씁니다", 37, 보조, False)))

낸것 = os.path.join(여기, "렌더", 이름 + "_본문.png")
im.save(낸것)
print("구움:", os.path.basename(낸것), "· 카드칸 좌%d 위%d 아래%d · 글 좌%d 줄1 %d"
      % (칸["좌"], 칸["위"], 칸["아래"], 좌, 줄1))


# ── 대비 실측 — 블록마다 후광 고리 최악값 ──
def 상대휘도(r, g, b):
    def f(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def 대비(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


바탕 = Image.open(바탕길).convert("RGB")
bl = 바탕.load()
print()
print("%-10s %10s %10s  %s" % ("블록", "평균대비", "최악대비", "판정"))
print("-" * 52)
최악표 = "AAA"
for 표이름, (x, y, 본문, 크기, bold, 서체) in 기록:
    m = Image.new("L", 바탕.size, 0)
    dm = ImageDraw.Draw(m)
    f = ImageFont.truetype(서체 or (굵 if bold else 보통), 크기)
    dm.text((x, y), 본문, font=f, fill=255)
    고리 = C.subtract(m.filter(ImageFilter.MaxFilter(5)), m)
    gl = 고리.load()
    글색 = {"문제줄1": 잉크, "문제줄2": 잉크, "몽골줄": 보조2, "힌트": 보조}.get(표이름, 잉크)
    L글 = 상대휘도(*글색)
    ls = []
    x0, y0 = max(0, x - 20), max(0, y - 20)
    x1, y1 = min(W, x + 1000), min(H, y + 크기 * 2 + 40)
    for yy in range(y0, y1):
        for xx in range(x0, x1):
            if gl[xx, yy] > 128:
                ls.append(상대휘도(*bl[xx, yy]))
    ls.sort()
    평균 = 대비(L글, sum(ls) / len(ls))
    나쁨 = 대비(L글, ls[int(len(ls) * 0.95)])
    표 = "AAA" if 나쁨 >= 7 else ("AA" if 나쁨 >= 4.5 else "X")
    if 표 != "AAA":
        최악표 = 표
    print("%-10s %9.2f %9.2f  %s" % (표이름, 평균, 나쁨, 표))
print("전체:", 최악표)
