"""
T2 홀 꾸미기 칸 짝을 「벽만 다른 짝」으로 맞춘다 (2026-10-31, Fable 그림 검수 P1 반영).

GPT 이미지 편집은 「벽만 바꿔」라고 해도 그림 전체를 다시 그린다 — 실사 홀 B는 선반 · 기계 · 창 · 손님 고개까지 달라졌다
(벽 밖 바뀐 픽셀 15~21%, 현장노트 그림 굽기 「장면째 구운 마스코트의 … 통째로 바꿔 끼우면」과 같은 원인).
그래서 판 A를 바탕으로 판 B의 벽 사변형만 떼어 붙인다(가장자리 페더). 벽 앞 손님 머리는 A 그대로 둔다.
실사 홀 A의 게시판 왼쪽 흰 메모에 남은 글줄 자국(Fable P2)도 그 메모 안만 흐려 지운다.

    python -I -X utf8 experiences/synk-town/qa/카페0단계시험-20261031/벽합성.py <판 폴더>

낸 것: hall-real-a-fix.png · hall-real-b-merged.png · hall-diorama-b-merged.png, 그리고 마스크 밖 바뀐 픽셀 수(0이어야 한다).
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

판 = Path(sys.argv[1])


def 고른판(머리):
    후보 = sorted(p for p in 판.glob(f"{머리}_*.png"))
    if not 후보:
        raise SystemExit(f"구운 판이 없다: {머리}")
    return 후보[-1]


def 마스크(크기, 다각형, 빼기=(), 페더=5):
    m = Image.new("L", 크기, 0)
    d = ImageDraw.Draw(m)
    d.polygon(다각형, fill=255)
    for 타원 in 빼기:
        d.ellipse(타원, fill=0)
    return m.filter(ImageFilter.GaussianBlur(페더))


def 밖바뀜(바탕, 결과, m):
    """마스크가 0인 곳에서 바탕과 달라진 픽셀 수(합성이 벽 밖을 건드리지 않았는지)."""
    차 = ImageChops.difference(바탕, 결과).convert("L").point(lambda v: 255 if v > 2 else 0)
    밖 = m.point(lambda v: 255 if v == 0 else 0)
    return ImageChops.multiply(차, 밖).histogram()[255]


def 합성(바탕, 위, m):
    return Image.composite(위, 바탕, m)


# ── 실사 홀: A의 메모 자국 지우기 → B의 벽만 붙이기 ──────────────────────────────
a = Image.open(고른판("hall-real")).convert("RGB")
b = Image.open(고른판("hall-real-b")).convert("RGB")
메모 = (981, 328, 993, 373)  # 게시판 왼쪽 흰 메모 안쪽(테두리 빼고)
조각 = a.crop(메모).filter(ImageFilter.GaussianBlur(4))
a_fix = a.copy()
a_fix.paste(조각, 메모[:2])
a_fix.save(판 / "hall-real-a-fix.png")

# 벽 사변형: 게시판 · 식물 벽 테두리와 그 아래로 늘어진 고사리 끝(y ≤ 537)까지. 손님 머리(x 955~1015 · y 518~578)는 뺀다.
# 아래 변은 고사리 끝 바로 밑(y 548) — 더 내리면 B에만 있는 벽의 햇빛 얼룩이 마스크 밑변에서 수평으로 끊긴다(Fable 다시 확인 P2).
벽_실사 = [(968, 160), (1122, 50), (1122, 548), (1022, 548), (1017, 521), (968, 514)]
머리_실사 = [(952, 515, 1018, 580)]
m1 = 마스크(a.size, 벽_실사, 머리_실사, 페더=5)
b_merged = 합성(a_fix, b, m1)
b_merged.save(판 / "hall-real-b-merged.png")
print("실사 홀 B 합성 — 벽 밖 바뀐 픽셀", 밖바뀜(a_fix, b_merged, m1))

# ── 디오라마 홀: A 바탕에 B의 벽 사변형만 ─────────────────────────────────────
da = Image.open(고른판("hall-diorama-a")).convert("RGB")
db = Image.open(고른판("hall-diorama-b")).convert("RGB")
벽_디오 = [(974, 250), (1088, 316), (1088, 900), (974, 618)]
m2 = 마스크(da.size, 벽_디오, (), 페더=4)
db_merged = 합성(da, db, m2)
db_merged.save(판 / "hall-diorama-b-merged.png")
print("디오라마 B 합성 — 벽 밖 바뀐 픽셀", 밖바뀜(da, db_merged, m2))
