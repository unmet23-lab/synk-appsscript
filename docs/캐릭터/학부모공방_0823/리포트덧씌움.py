# -*- coding: utf-8 -*-
"""「리포트」 탭에 산 글자를 붓는다 — 그릇의 화면 칸(<출력>.png.칸.json)을 읽어 앉힌다.

손좌표를 안 쓰는 규율은 앞 네 화면과 같다: **그릇을 옮기면 글이 따라와야 한다.**


쓰기:  python 리포트덧씌움.py 리포트판_v1_그릇만 [없음|층별|전면]
       → 리포트판_v1[_층별].png  +  대비 실측표
"""
import io, json, os, sys

import PIL.ImageChops as C
from PIL import Image, ImageDraw, ImageFilter, ImageFont

여기 = os.path.dirname(os.path.abspath(__file__))
굵 = r"C:\Windows\Fonts\malgunbd.ttf"
보통 = r"C:\Windows\Fonts\malgun.ttf"
키릴 = r"C:\Windows\Fonts\segoeui.ttf"   # ⚠맑은고딕엔 몽골 키릴 ө·ү 글리프가 없다(두부 실측)
잉크 = (0xFB, 0xF7, 0xF0)      # Paper
보조 = (0xED, 0xE7, 0xDC)      # Oat
보조2 = (0xC7, 0xBF, 0xB2)     # Stone

이름 = sys.argv[1] if len(sys.argv) > 1 else "리포트판_v1_그릇만"
보조갈래 = sys.argv[2] if len(sys.argv) > 2 else "층별"   # 없음 | 층별 | 전면
바탕길 = os.path.join(여기, 이름 + ".png")
칸들 = json.load(io.open(바탕길 + ".칸.json", encoding="utf-8"))

im = Image.open(바탕길).convert("RGB")
W, H = im.size
d = ImageDraw.Draw(im)
기록 = []


def 글(x, y, 본문, 크기, 색, bold=True, 서체=None, 가운데=False, 오른쪽=False):
    f = ImageFont.truetype(서체 or (굵 if bold else 보통), 크기)
    if 가운데:
        x = int(x - d.textlength(본문, font=f) / 2)
    elif 오른쪽:
        x = int(x - d.textlength(본문, font=f))
    d.text((x, y), 본문, font=f, fill=색)
    return (x, y, 본문, 크기, bold, 서체)


# ⚠몽골어는 **검수 전 표본**이다. 학부모 앱은 학생 앱보다 몽골어 비중이 크다 —
#   결제자가 부모이고, 부모는 한국어를 못 읽는 쪽이 많다.
# ⚠보조줄은 **한 문자 체계만** 쓴다 — 키릴 폰트엔 한글 글리프가 없어 두부(□)가 뜬다(08-23 실측).
몽 = {"제목": "Тайлан",
      "카드": "8-р сарын тайлан бэлэн боллоо",
      "탭0": "Манай хүүхэд", "탭1": "Тайлан", "탭2": "Мэдээ"}
전면 = 보조갈래 == "전면"
키릴줄 = 보조갈래 != "없음"

카 = 칸들["이번달"]
카높 = 카["아래"] - 카["위"]
안여백 = 124
글좌 = 카["좌"] + 안여백

기록.append(("제목", 글(카["좌"] + 8, 카["위"] - (150 if not 전면 else 186), "리포트", 60, 잉크, True)))
if 전면:
    기록.append(("제목몽", 글(카["좌"] + 8, 카["위"] - 116, 몽["제목"], 30, 보조2, False, 서체=키릴)))

# ── ① 이번 달 리포트 — 부3. talk 이 하는 일은 «열람»뿐이다 ────────────────────
밑줄y = 카["위"] + 카높 * 0.8429
y = 카["위"] + 70
기록.append(("라벨", 글(글좌, y, "이번 달", 34, 보조2, False)))
y += 62
for 줄 in ("8월 성장 리포트가", "나왔어요"):
    기록.append(("큰줄%d" % len([k for k, _ in 기록 if k.startswith("큰줄")]),
                 글(글좌, y, 줄, 56, 잉크, True)))
    y += 84
if 키릴줄:
    기록.append(("카드몽", 글(글좌, y + 12, 몽["카드"], 28, 보조2, False, 서체=키릴)))
기록.append(("열기", 글(글좌, 밑줄y - 76, "열어보기 — 8쪽", 34, 보조, False)))

# ── ② 지난 달 넷 — 오른쪽 열이 «날짜»가 아니라 «성취»다 ───────────────────────
#   🔑 그릇은 학생 소식 탭과 같은데 그 한 칸이 이 탭을 «쌓인 것»으로 만든다.
#      시제는 부품이 아니라 «내용»이 정한다.
지난 = ((u"7월 리포트", u"3급 도달"),
        (u"6월 리포트", u"말하기 21회"),
        (u"5월 리포트", u"오류 12개 해소"),
        (u"4월 리포트", u"첫 발표"))
for 번, (이름표, 성취) in enumerate(지난):
    칸 = 칸들["지난%d" % 번]
    폭 = 칸["우"] - 칸["좌"]
    단추x = 칸["좌"] + 폭 * 0.0950
    중 = (칸["위"] + 칸["아래"]) / 2
    기록.append(("지난%d" % 번, 글(단추x + 92, 중 - 26, 이름표, 40, 보조2, False)))
    기록.append(("성취%d" % 번, 글(칸["우"] - (단추x - 칸["좌"]), 중 - 16, 성취, 28, 보조2, False, 오른쪽=True)))

if "탭0" in 칸들:
    for 번, 이름표 in enumerate(("우리 아이", "리포트", "소식")):
        탭 = 칸들["탭%d" % 번]
        가 = (탭["좌"] + 탭["우"]) / 2
        중 = (탭["위"] + 탭["아래"]) / 2
        지금 = (번 == 1)
        기록.append(("탭%d" % 번, 글(가, 중 - 22, 이름표, 34, 보조 if 지금 else 보조2, 지금, 가운데=True)))
        if 전면:
            기록.append(("탭%d몽" % 번, 글(가, 중 + 20, 몽["탭%d" % 번], 24, 보조2, False,
                                        서체=키릴, 가운데=True)))


꼬리 = "" if 보조갈래 == "층별" else "_" + 보조갈래
낸것 = os.path.join(여기, "리포트판_v1" + 꼬리 + ".png")
im.save(낸것)
print("구움:", os.path.basename(낸것))


# ── 대비 실측 — 앞 네 화면과 같은 잣대 ────────────────────────────────────────
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
색표 = {"라벨": 보조2, "열기": 보조, "카드몽": 보조2, "제목몽": 보조2,
        "탭0": 보조2, "탭1": 보조, "탭2": 보조2}
색표.update({"지난%d" % i: 보조2 for i in range(4)})
색표.update({"성취%d" % i: 보조2 for i in range(4)})
색표.update({"탭%d몽" % i: 보조2 for i in range(3)})
print()
print("%-10s %10s %10s  %s" % ("블록", "평균대비", "최악대비", "판정"))
print("-" * 52)
최악 = "AAA"
for 표이름, (x, y, 본문, 크기, bold, 서체) in 기록:
    m = Image.new("L", 바탕.size, 0)
    dm = ImageDraw.Draw(m)
    f = ImageFont.truetype(서체 or (굵 if bold else 보통), 크기)
    dm.text((x, y), 본문, font=f, fill=255)
    고리 = C.subtract(m.filter(ImageFilter.MaxFilter(5)), m)
    gl = 고리.load()
    글색 = 색표.get(표이름, 잉크)
    L글 = 상대휘도(*글색)
    ls = []
    x0, y0 = max(0, int(x) - 20), max(0, int(y) - 20)
    x1, y1 = min(W, int(x) + 1000), min(H, int(y) + 크기 * 2 + 40)
    for yy in range(y0, y1):
        for xx in range(x0, x1):
            if gl[xx, yy] > 128:
                ls.append(상대휘도(*bl[xx, yy]))
    if not ls:
        continue
    ls.sort()
    평균 = 대비(L글, sum(ls) / len(ls))
    나쁨 = 대비(L글, ls[int(len(ls) * 0.95)])
    표 = "AAA" if 나쁨 >= 7 else ("AA" if 나쁨 >= 4.5 else "X")
    if 표 != "AAA":
        최악 = 표
    print("%-10s %9.2f %9.2f  %s" % (표이름, 평균, 나쁨, 표))
print("전체:", 최악)
