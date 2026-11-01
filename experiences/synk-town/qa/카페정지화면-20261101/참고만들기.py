"""
가게 정지 화면 3장(기획 9절 1단계 ③, 2026-11-01)의 굽기 참고 그림을 만든다.

- 교수얼굴.jpg — 드라마 1화 연구실 승인 그림(office-real)에서 문지영 교수 머리 · 어깨만 자른 얼굴 참고
- 카운터구도.jpg — 0단계 카운터 판(counter-prof-1)에서 손님 머리만 흐린 구도 참고(장부 S33 방법:
  구도 · 가게 · 학생 손은 따르고 얼굴은 얼굴 참고에서만 가져오게)
- 홀.jpg — 0단계 실사 홀(hall-real-a-fix, 메모 글줄 자국을 지운 판) — 같은 방 · 같은 카메라의 붐빔 판을 굽는 바탕

참고는 긴 변 1,400px JPEG로 줄인다(현장노트 gemini_사진 — 큰 PNG는 올리기가 늦고 실패가 잦다).

    python -I -X utf8 experiences/synk-town/qa/카페정지화면-20261101/참고만들기.py <0단계 판 폴더> <낼 폴더>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

판 = Path(sys.argv[1])
낼 = Path(sys.argv[2])
낼.mkdir(parents=True, exist_ok=True)


def 줄여쓰기(im, 이름, 긴변=1400):
    s = 긴변 / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.convert("RGB").save(낼 / 이름, quality=92)
    print(이름, im.size)


# 교수 얼굴 — 1280×1600 판에서 머리와 어깨(귀걸이 · 머리 끝 포함)
교수 = Image.open(판 / "office-real.png").convert("RGB")
줄여쓰기(교수.crop((380, 110, 980, 860)), "교수얼굴.jpg")

# 카운터 구도 — 1122×1402 판에서 손님 머리만 흐리게(타원 페더)
카운터 = Image.open(sorted(판.glob("counter-prof-1_*.png"))[-1]).convert("RGB")
흐림 = 카운터.filter(ImageFilter.GaussianBlur(28))
m = Image.new("L", 카운터.size, 0)
ImageDraw.Draw(m).ellipse((318, 128, 742, 560), fill=255)
m = m.filter(ImageFilter.GaussianBlur(18))
줄여쓰기(Image.composite(흐림, 카운터, m), "카운터구도.jpg")

# 홀 바탕
줄여쓰기(Image.open(판 / "hall-real-a-fix.png"), "홀.jpg")
